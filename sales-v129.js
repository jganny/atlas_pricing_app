/**
 * Vertex Sales v129 — pipeline upgrades (leads only; quotes untouched).
 */
(function () {
  'use strict';

  var STATUSES = ['new', 'contacted', 'qualified', 'quoted', 'won', 'lost'];
  var viewMode = 'list';

  function leads() {
    return (window.appState && window.appState.leads) || [];
  }

  function quotes() {
    if (window.__atlasUi && window.__atlasUi.getQuotes) return window.__atlasUi.getQuotes() || [];
    return (window.appState && window.appState.quotes) || [];
  }

  function isStale(lead) {
    if (!lead.nextDueDate) return false;
    return lead.nextDueDate < new Date().toISOString().split('T')[0];
  }

  function quotesForLead(lead) {
    if (!lead || !lead.company) return [];
    var c = lead.company.toLowerCase();
    return quotes().filter(function (q) {
      return (q.customer || '').toLowerCase().indexOf(c) !== -1;
    }).slice(0, 8);
  }

  function setSalesView(mode) {
    viewMode = mode;
    var list = document.getElementById('sales-view-list');
    var board = document.getElementById('sales-view-kanban');
    var stats = document.getElementById('sales-pipeline-stats');
    document.querySelectorAll('[data-sales-view]').forEach(function (btn) {
      btn.classList.toggle('active', btn.getAttribute('data-sales-view') === mode);
    });
    if (list) list.style.display = mode === 'list' ? '' : 'none';
    if (board) board.style.display = mode === 'kanban' ? '' : 'none';
    if (mode === 'kanban') renderKanban();
    else if (typeof window.renderSalesPanel === 'function') window.renderSalesPanel();
    if (stats) renderPipelineStats();
  }

  function renderPipelineStats() {
    var el = document.getElementById('sales-pipeline-stats');
    if (!el) return;
    var all = leads();
    var open = all.filter(function (l) { return l.status !== 'won' && l.status !== 'lost'; });
    var pipeline = open.reduce(function (s, l) { return s + (Number(l.dealValue) || 0); }, 0);
    var stale = all.filter(isStale).length;
    el.innerHTML =
      '<div class="sps-item"><span class="sps-val">' + all.length + '</span><span class="sps-lbl">Leads</span></div>' +
      '<div class="sps-item"><span class="sps-val">' + formatINR(pipeline) + '</span><span class="sps-lbl">Open pipeline</span></div>' +
      '<div class="sps-item"><span class="sps-val">' + stale + '</span><span class="sps-lbl">Needs follow-up</span></div>';
  }

  function formatINR(n) {
    if (!n) return '₹0';
    return '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 });
  }

  function renderKanban() {
    var board = document.getElementById('sales-view-kanban');
    if (!board) return;
    var q = (document.getElementById('sales-search-input')?.value || '').toLowerCase().trim();
    board.innerHTML = STATUSES.map(function (status) {
      var cards = leads().filter(function (lead) {
        if ((lead.status || 'new') !== status) return false;
        if (!q) return true;
        var hay = (lead.company + ' ' + (lead.contactName || '') + ' ' + (lead.lane || '')).toLowerCase();
        return hay.indexOf(q) !== -1;
      });
      var cardsHtml = cards.map(function (lead) {
        var stale = isStale(lead) ? '<span class="sk-stale">Due</span>' : '';
        return '<div class="sales-kanban-card" draggable="true" data-lead-id="' + lead.id + '">' +
          '<strong>' + esc(lead.company) + '</strong>' +
          stale +
          '<div class="sk-meta">' + esc(lead.contactName || '—') + '</div>' +
          (lead.dealValue ? '<div class="sk-deal">' + formatINR(lead.dealValue) + '</div>' : '') +
          (lead.lane ? '<div class="sk-lane">' + esc(lead.lane) + '</div>' : '') +
          '<div class="sk-actions">' +
            '<button type="button" onclick="openLeadDetailModal(\'' + lead.id + '\')">Open</button>' +
            '<button type="button" onclick="createQuoteFromLead(\'' + lead.id + '\')">Quote</button>' +
          '</div></div>';
      }).join('');
      return '<div class="sales-kanban-col" data-kanban-status="' + status + '">' +
        '<div class="sales-kanban-col-head">' + status.charAt(0).toUpperCase() + status.slice(1) +
        ' <span>(' + cards.length + ')</span></div>' +
        '<div class="sales-kanban-col-body">' + (cardsHtml || '<div class="sk-empty">—</div>') + '</div></div>';
    }).join('');

    board.querySelectorAll('.sales-kanban-card').forEach(function (card) {
      card.addEventListener('dragstart', function (e) {
        e.dataTransfer.setData('text/plain', card.getAttribute('data-lead-id'));
      });
    });
    board.querySelectorAll('.sales-kanban-col-body').forEach(function (col) {
      col.addEventListener('dragover', function (e) { e.preventDefault(); });
      col.addEventListener('drop', function (e) {
        e.preventDefault();
        var id = e.dataTransfer.getData('text/plain');
        var status = col.closest('.sales-kanban-col').getAttribute('data-kanban-status');
        updateLeadStatus(id, status);
      });
    });
  }

  function esc(s) {
    return String(s || '').replace(/</g, '&lt;');
  }

  async function updateLeadStatus(leadId, status) {
    var lead = leads().find(function (l) { return l.id === leadId; });
    if (!lead || !status) return;
    try {
      if (window.DB && window.DB.isCloud && window.DB.firestoreRef) {
        await window.DB.firestoreRef.collection('leads').doc(leadId).update({ status: status });
      } else {
        lead.status = status;
        window.appState.leads = leads();
        localStorage.setItem('gl_leads', JSON.stringify(window.appState.leads));
        if (viewMode === 'kanban') renderKanban();
        else if (window.renderSalesPanel) window.renderSalesPanel();
      }
    } catch (err) {
      console.error('updateLeadStatus', err);
    }
  }

  function createQuoteFromLead(leadId) {
    var lead = leads().find(function (l) { return l.id === leadId; });
    if (!lead) return;
    var modeMap = { air: 'air', sea: 'sea', transport: 'transport', warehouse: 'warehouse' };
    var desk = modeMap[(lead.mode || 'air').toLowerCase()] || 'air';
    if (typeof window.openActiveCalculator !== 'function') return;
    window.openActiveCalculator(desk);
    window.setTimeout(function () {
      var map = {
        air: 'air-cust-name',
        sea: 'sea-cust-name',
        transport: 'transport-customer-name',
        warehouse: 'warehouse-customer-name'
      };
      var id = map[desk];
      var el = id && document.getElementById(id);
      if (el && lead.company) el.value = lead.company;
      try { sessionStorage.setItem('vertex_lead_context', JSON.stringify({ leadId: lead.id, company: lead.company })); } catch (e) {}
    }, 350);
  }

  function aiSummarizeLead(leadId) {
    var lead = leads().find(function (l) { return l.id === leadId; });
    if (!lead) return;
    var related = quotesForLead(lead);
    var msg = 'Summarize this sales lead and suggest next steps:\n' +
      'Company: ' + (lead.company || '') + '\nStatus: ' + (lead.status || '') +
      '\nLane: ' + (lead.lane || '—') + '\nDeal value: ' + (lead.dealValue || '—') +
      '\nNext action: ' + (lead.nextAction || '—') +
      '\nPast quotes: ' + related.length;
    if (typeof window.openAtlasHelpWithPrompt === 'function') {
      window.openAtlasHelpWithPrompt(msg, true);
    }
  }

  function enhanceLeadDetailModal(leadId) {
    var lead = leads().find(function (l) { return l.id === leadId; });
    if (!lead) return;
    var box = document.getElementById('activity-lead-extra');
    if (!box) return;
    var related = quotesForLead(lead);
    var html = '';
    if (lead.nextAction) {
      html += '<div class="ale-row"><strong>Next:</strong> ' + esc(lead.nextAction) +
        (lead.nextDueDate ? ' · due ' + esc(lead.nextDueDate) : '') + '</div>';
    }
    if (lead.lane || lead.mode) {
      html += '<div class="ale-row"><strong>Lane:</strong> ' + esc(lead.lane || '—') +
        ' · <strong>Mode:</strong> ' + esc(lead.mode || '—') + '</div>';
    }
    if (lead.dealValue) html += '<div class="ale-row"><strong>Deal value:</strong> ' + formatINR(lead.dealValue) + '</div>';
    if (lead.status === 'lost' && lead.winLossReason) {
      html += '<div class="ale-row"><strong>Loss reason:</strong> ' + esc(lead.winLossReason) + '</div>';
    }
    html += '<div class="ale-actions">' +
      '<button type="button" class="btn-secondary" onclick="createQuoteFromLead(\'' + lead.id + '\')">Create quote from lead</button>' +
      '<button type="button" class="btn-secondary" onclick="aiSummarizeLead(\'' + lead.id + '\')">AI summary</button>' +
      '</div>';
    if (related.length) {
      html += '<div class="ale-quotes"><div class="ale-quotes-title">Quote history</div><ul>';
      related.forEach(function (q) {
        html += '<li>' + esc(q.date || '') + ' · ' + esc((q.type || '').toUpperCase()) +
          ' · ' + formatINR(q.amountINR || q.amount) + '</li>';
      });
      html += '</ul></div>';
    }
    box.innerHTML = html;
  }

  function wrapRenderSalesPanel() {
    if (typeof window.renderSalesPanel !== 'function' || window.renderSalesPanel._v129) return;
    var orig = window.renderSalesPanel;
    window.renderSalesPanel = function () {
      if (viewMode === 'kanban') {
        renderKanban();
        renderPipelineStats();
        return;
      }
      orig.apply(this, arguments);
      var body = document.getElementById('sales-leads-body');
      if (!body) return;
      body.querySelectorAll('tr').forEach(function (row) {
        var btn = row.querySelector('button[onclick*="openLeadDetailModal"]');
        if (!btn) return;
        var m = btn.getAttribute('onclick').match(/'([^']+)'/);
        if (!m) return;
        var lead = leads().find(function (l) { return l.id === m[1]; });
        if (!lead) return;
        if (isStale(lead)) {
          var td = row.cells[1];
          if (td && !td.querySelector('.sales-stale-badge')) {
            td.innerHTML += ' <span class="sales-stale-badge">Follow-up due</span>';
          }
        }
      });
      renderPipelineStats();
    };
    window.renderSalesPanel._v129 = true;
  }

  function wrapOpenLeadDetail() {
    if (typeof window.openLeadDetailModal !== 'function' || window.openLeadDetailModal._v129) return;
    var orig = window.openLeadDetailModal;
    window.openLeadDetailModal = function (leadId) {
      orig(leadId);
      window.setTimeout(function () { enhanceLeadDetailModal(leadId); }, 50);
    };
    window.openLeadDetailModal._v129 = true;
  }

  function init() {
    wrapRenderSalesPanel();
    wrapOpenLeadDetail();
    renderPipelineStats();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.setSalesView = setSalesView;
  window.createQuoteFromLead = createQuoteFromLead;
  window.aiSummarizeLead = aiSummarizeLead;
})();

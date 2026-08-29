/**
 * Atlas Help — navigation & workflow assistant (UI only).
 * Uses cloud AI when atlasCopilot is deployed; exact-match local guides for quick prompts.
 */
(function () {
  'use strict';

  var busy = false;

  var LOCAL_HELP = {
    'how do i save an air freight quote': 'Open Air Freight from the sidebar, complete Shipment Details and Carrier & Tariffs, then click Save Quote in the sticky bar at the top. Use Reset only when starting a fresh quote.',
    'how do i save a quote': 'On any desk (Air, Sea, Transport, Warehouse), complete the form and click Save Quote in the sticky highlights bar at the top.',
    'how do i save a quote on the transport desk': 'On the Transport desk, enter the customer name and charge rows, then click Save Quote in the sticky bar at the top. Reset clears the desk only after you confirm.',
    'how do i save a quote on the warehouse desk': 'On the Warehouse desk, enter the customer name and charge rows, then click Save Quote in the sticky bar at the top. Reset clears the desk only after you confirm.',
    'explain the difference between air nomination and free hand pricing desks': 'Air Nomination desks quote in USD for nominated agent flows. Free Hand desks quote in INR for direct sales. Currency and agency rules adjust automatically per role — your formulas are unchanged.',
    'draft a short professional follow-up email for a quoted shipment': 'Subject: Freight Quotation — [Ref ID]\n\nDear [Agent Name],\n\nThank you for your enquiry. Please find our quotation for [Origin] to [Destination] attached. Rates are valid as noted on the quote. Let us know if you would like to proceed or need any adjustments.\n\nBest regards,\nAtlas Pricing Team',
    'how do i filter enquiries and generate financial reports in the enquiry database?': 'Use + Add filter to show Ref ID, Date, Mode, Desk, or Status chips. Click a table row to inspect it on the right. For reports, pick a Reporting period and User/desk, then Generate summary or Export to CSV. Your live quotes and archives are never deleted by these tools.',
    'how do i run a financial report and export enquiries to csv?': 'In Enquiry Database → right panel: choose Reporting period and User/desk, click Generate summary. To export the same filtered set, click Export to CSV. Archive lookup finds older quotes by Ref ID without changing live data.',
    'how do i use air freight filters and surcharges?': 'On Air Freight: Shipment Details tab for cargo, Carrier & Tariffs for airline options. Use the sticky bar to watch totals. Save Quote when ready — nothing is stored until you save.',
    'how do i use sea freight desk?': 'Sea Freight works like Air: Shipment Details then Carrier & Tariffs. Switch liner cards with the tabs inside each option. Save Quote stores your work; Reset clears the desk only after you confirm.'
  };

  var CONTEXT_TIPS = {
    dashboard: 'Tip: Press ⌘K (Ctrl+K) to jump anywhere. Admin tabs — Overview, Enquiry Database, Analytics — are along the top of the dashboard.',
    air: 'Air desk: fill Shipment Details, then Carrier & Tariffs. Totals update in the sticky bar. Save Quote when finished.',
    sea: 'Sea desk: enter cargo and containers, then configure liner tariffs. Save Quote preserves your work for the team.',
    transport: 'Transport desk: enter legs and charges, then Save Quote. Currency syncs from the header dropdown.',
    warehouse: 'Warehouse desk: enter storage parameters and charges, then Save Quote.',
    directory: 'Directory: search agents, expand regions, use Add Contact for new entries. Import/export stays in the toolbar.',
    circulars: 'Circulars: browse tariff PDFs by category. Upload adds new documents for the team.',
    sales: 'Sales pipeline: track leads and statuses. This view is read/update only — pricing still happens on the desks.',
    enquiry: 'Enquiry Database: click + Add filter, then click any row to inspect. Reports panel on the right — filters do not delete data.'
  };

  function ui() {
    return window.__atlasUi || {};
  }

  function detectContextKey() {
    var active = document.querySelector('.view-panel.active');
    if (!active) return 'dashboard';
    var id = active.id || '';
    if (id.indexOf('air-freight') !== -1) return 'air';
    if (id.indexOf('sea-freight') !== -1) return 'sea';
    if (id.indexOf('transport') !== -1) return 'transport';
    if (id.indexOf('warehousing') !== -1) return 'warehouse';
    if (id.indexOf('directory') !== -1) return 'directory';
    if (id.indexOf('circulars') !== -1) return 'circulars';
    if (id.indexOf('sales') !== -1) return 'sales';
    if (id.indexOf('manager') !== -1) {
      var visible = document.querySelector('#manager-panel .desk-tab-pane:not([style*="display: none"])');
      if (visible && visible.getAttribute('data-tab-pane') === 'enquiry-database') return 'enquiry';
      return 'dashboard';
    }
    return 'dashboard';
  }

  function formatQuoteContext(quote) {
    if (!quote) return '';
    var refFn = typeof window.getQuoteRefId === 'function' ? window.getQuoteRefId : function (q) { return q.id; };
    return [
      'Selected enquiry (read-only):',
      'Ref: ' + refFn(quote),
      'Date: ' + (quote.date || '—'),
      'Mode: ' + (quote.type || '—'),
      'Customer: ' + (quote.customer || '—'),
      'Route: ' + (quote.route || '—'),
      'Status: ' + (quote.status || '—')
    ].join('\n');
  }

  function normalizeQuestion(text) {
    return (text || '').toLowerCase().trim().replace(/\?+$/, '').replace(/\s+/g, ' ');
  }

  /** Only exact matches — avoids irrelevant canned answers for free-form questions. */
  function matchLocalHelp(message) {
    var key = normalizeQuestion(message);
    if (!key) return null;
    if (LOCAL_HELP[key]) return LOCAL_HELP[key];
    if (key.charAt(key.length - 1) !== '?') {
      var withQ = key + '?';
      if (LOCAL_HELP[withQ]) return LOCAL_HELP[withQ];
    }
    return null;
  }

  function appendMessage(role, text) {
    var log = document.getElementById('atlas-copilot-log');
    if (!log) return;
    var bubble = document.createElement('div');
    bubble.className = 'atlas-copilot-msg atlas-copilot-msg-' + role;
    bubble.textContent = text;
    log.appendChild(bubble);
    log.scrollTop = log.scrollHeight;
  }

  function setBusy(on) {
    busy = on;
    var btn = document.getElementById('atlas-copilot-send');
    var input = document.getElementById('atlas-copilot-input');
    if (btn) btn.disabled = on;
    if (input) input.disabled = on;
  }

  function togglePanel(forceOpen) {
    var panel = document.getElementById('atlas-copilot-panel');
    if (!panel) return;
    var open = forceOpen === true ? true : (forceOpen === false ? false : !panel.classList.contains('open'));
    panel.classList.toggle('open', open);
    panel.setAttribute('aria-hidden', open ? 'false' : 'true');
    if (open) {
      var input = document.getElementById('atlas-copilot-input');
      if (input) window.setTimeout(function () { input.focus(); }, 80);
    }
  }

  function openAtlasHelpWithPrompt(prompt, autoSend) {
    togglePanel(true);
    var input = document.getElementById('atlas-copilot-input');
    if (input && prompt) {
      input.value = prompt;
      if (autoSend !== false) sendMessage();
    }
  }

  async function sendMessage() {
    if (busy) return;
    var input = document.getElementById('atlas-copilot-input');
    if (!input) return;
    var message = (input.value || '').trim();
    if (!message) return;

    var includeCheckbox = document.getElementById('atlas-copilot-include-quote');
    var includeQuote = includeCheckbox && includeCheckbox.checked;
    var quoteContext = '';
    if (includeQuote && typeof window.getSelectedEnquiryQuote === 'function') {
      var selected = window.getSelectedEnquiryQuote();
      if (selected) quoteContext = formatQuoteContext(selected);
      else {
        appendMessage('user', message);
        appendMessage('assistant', 'No enquiry row selected. Open Admin → Enquiry Database and click a row, or uncheck the include option.');
        setBusy(false);
        return;
      }
    }

    appendMessage('user', message);
    input.value = '';
    setBusy(true);

    var local = matchLocalHelp(message);
    if (local) {
      var localReply = local;
      if (quoteContext) localReply = quoteContext + '\n\n' + local;
      appendMessage('assistant', localReply);
      setBusy(false);
      return;
    }

    var ctx = CONTEXT_TIPS[detectContextKey()] || '';
    var fullMessage = (ctx ? 'Context: ' + ctx + '\n\n' : '') + (quoteContext ? quoteContext + '\n\nUser question: ' : '') + message;

    try {
      if (!window.firebase || !firebase.functions) throw new Error('offline');
      var fn = firebase.functions().httpsCallable('atlasCopilot');
      var result = await fn({
        message: fullMessage,
        workspace: typeof ui().getWorkspaceName === 'function' ? ui().getWorkspaceName() : 'Dashboard',
        role: typeof ui().getCurrentUser === 'function' ? (ui().getCurrentUser() || 'user') : 'user'
      });
      var reply = (result && result.data && result.data.reply) || 'No response.';
      appendMessage('assistant', reply);
    } catch (err) {
      appendMessage('assistant',
        'I could not reach Atlas Help cloud for that question. Try rephrasing with a specific screen name (e.g. "How do I filter enquiries?" or "How do I save an air quote?"). ' +
        'Use the quick prompts below for common tasks. I never change your saved quotes or rates.');
    } finally {
      setBusy(false);
    }
  }

  function bindQuickPrompts() {
    document.querySelectorAll('[data-copilot-prompt]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var input = document.getElementById('atlas-copilot-input');
        if (input) input.value = btn.getAttribute('data-copilot-prompt') || '';
        sendMessage();
      });
    });
  }

  function bindContextHelpButtons() {
    document.querySelectorAll('[data-atlas-help]').forEach(function (btn) {
      if (btn._atlasHelpBound) return;
      btn._atlasHelpBound = true;
      btn.addEventListener('click', function () {
        openAtlasHelpWithPrompt(btn.getAttribute('data-atlas-help') || 'How do I use this screen?', true);
      });
    });
  }

  function injectDeskHelpButtons() {
    var desks = [
      { sel: '#air-freight-panel .desk-shell-header', prompt: 'How do I use air freight filters and surcharges?' },
      { sel: '#sea-freight-panel .desk-shell-header', prompt: 'How do I use sea freight desk?' },
      { sel: '#transportation-panel .desk-shell-header', prompt: 'How do I save a quote on the transport desk?' },
      { sel: '#warehousing-panel .desk-shell-header', prompt: 'How do I save a quote on the warehouse desk?' }
    ];
    desks.forEach(function (d) {
      var header = document.querySelector(d.sel);
      if (!header || header.querySelector('.atlas-context-help-btn')) return;
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'atlas-context-help-btn';
      btn.setAttribute('data-atlas-help', d.prompt);
      btn.setAttribute('aria-label', 'Atlas Help for this desk');
      btn.textContent = '?';
      var backBtn = header.querySelector('.btn-back-dashboard');
      if (backBtn && backBtn.parentNode) {
        backBtn.parentNode.insertBefore(btn, backBtn);
      } else {
        header.appendChild(btn);
      }
    });
    bindContextHelpButtons();
  }

  function refreshAtlasHelpContext() {
    injectDeskHelpButtons();
    bindContextHelpButtons();
  }

  function init() {
    var fab = document.getElementById('atlas-copilot-fab');
    if (fab) fab.addEventListener('click', function () { togglePanel(); });
    var closeBtn = document.getElementById('atlas-copilot-close');
    if (closeBtn) closeBtn.addEventListener('click', function () { togglePanel(false); });
    var sendBtn = document.getElementById('atlas-copilot-send');
    if (sendBtn) sendBtn.addEventListener('click', sendMessage);
    var input = document.getElementById('atlas-copilot-input');
    if (input) {
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          sendMessage();
        }
      });
    }
    bindQuickPrompts();
    bindContextHelpButtons();
    injectDeskHelpButtons();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.toggleAtlasCopilot = togglePanel;
  window.openAtlasHelpWithPrompt = openAtlasHelpWithPrompt;
  window.refreshAtlasHelpContext = refreshAtlasHelpContext;
})();

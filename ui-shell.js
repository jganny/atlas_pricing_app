/**
 * Atlas UI Shell — navigation, command palette, enquiry inspector.
 * Does NOT modify formulas, quote save/load, or calculation functions.
 */
(function () {
  'use strict';

  function ui() {
    return window.__atlasUi || {};
  }

  function roleCategory(role) {
    var r = (role || '').toLowerCase();
    return (window.TEAM_ROLES && window.TEAM_ROLES[r] && window.TEAM_ROLES[r].category) || '';
  }

  function navigateRoleLanding(role) {
    var r = (role || '').toLowerCase();
    if (!r || r === 'ganny' || r === 'manager') return;
    var cat = roleCategory(r);

    if (r === 'shashank' || cat.indexOf('AIR - NOMINATION') !== -1 || cat.indexOf('AIR NOMINATION') !== -1) {
      if (typeof window.openActiveCalculator === 'function') window.openActiveCalculator('air');
      return;
    }
    if (r === 'shaheer' || cat.indexOf('SEA - NOMINATION') !== -1 || cat.indexOf('SEA NOMINATION') !== -1) {
      if (typeof window.openActiveCalculator === 'function') window.openActiveCalculator('sea');
      return;
    }
    if (r === 'cathrina' || cat.indexOf('NRS') !== -1) {
      var nrsPanel = document.getElementById('nrs-notifications-panel');
      if (nrsPanel) {
        window.setTimeout(function () {
          nrsPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 120);
      }
    }
  }

  if (typeof window.switchRole === 'function') {
    var _origSwitchRole = window.switchRole;
    window.switchRole = function (role) {
      _origSwitchRole(role);
      if (!window._suppressRoleLanding) navigateRoleLanding(role);
    };
  }

  /* ── Command palette (⌘K / Ctrl+K) ── */
  var COMMANDS = [
    { label: 'Home Dashboard', keywords: 'home dashboard', run: function () { if (window.goHome) window.goHome(); } },
    { label: 'Air Freight Desk', keywords: 'air freight quote', run: function () { if (window.openActiveCalculator) window.openActiveCalculator('air'); } },
    { label: 'Sea Freight Desk', keywords: 'sea ocean freight quote', run: function () { if (window.openActiveCalculator) window.openActiveCalculator('sea'); } },
    { label: 'Transportation Desk', keywords: 'transport trucking', run: function () { if (window.openActiveCalculator) window.openActiveCalculator('transport'); } },
    { label: 'Warehousing Desk', keywords: 'warehouse storage', run: function () { if (window.openActiveCalculator) window.openActiveCalculator('warehouse'); } },
    { label: 'Agent Directory', keywords: 'directory agents contacts', run: function () { if (window.openActiveCalculator) window.openActiveCalculator('directory'); } },
    { label: 'Circulars Library', keywords: 'circulars documents tariffs', run: function () { if (window.openActiveCalculator) window.openActiveCalculator('circulars'); } },
    { label: 'Sales Module', keywords: 'sales', run: function () { if (window.openActiveCalculator) window.openActiveCalculator('sales'); } },
    { label: 'Atlas Copilot (AI)', keywords: 'ai assistant help copilot', run: function () { if (window.toggleAtlasCopilot) window.toggleAtlasCopilot(true); } }
  ];

  function openCommandPalette() {
    var overlay = document.getElementById('atlas-command-palette');
    var input = document.getElementById('atlas-cp-input');
    if (!overlay) return;
    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden', 'false');
    renderCommands('');
    if (input) {
      input.value = '';
      window.setTimeout(function () { input.focus(); }, 50);
    }
  }

  function closeCommandPalette() {
    var overlay = document.getElementById('atlas-command-palette');
    if (!overlay) return;
    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden', 'true');
  }

  function renderCommands(query) {
    var list = document.getElementById('atlas-cp-list');
    if (!list) return;
    var q = (query || '').toLowerCase().trim();
    var matches = COMMANDS.filter(function (cmd) {
      if (!q) return true;
      return (cmd.label + ' ' + cmd.keywords).toLowerCase().indexOf(q) !== -1;
    });
    list.innerHTML = '';
    matches.forEach(function (cmd, idx) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'atlas-cp-item' + (idx === 0 ? ' active' : '');
      btn.textContent = cmd.label;
      btn.addEventListener('click', function () {
        closeCommandPalette();
        cmd.run();
      });
      list.appendChild(btn);
    });
    if (!matches.length) {
      list.innerHTML = '<div class="atlas-cp-empty">No matching commands</div>';
    }
  }

  function initCommandPalette() {
    var overlay = document.getElementById('atlas-command-palette');
    var input = document.getElementById('atlas-cp-input');
    if (!overlay) return;

    document.addEventListener('keydown', function (e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (overlay.classList.contains('open')) closeCommandPalette();
        else openCommandPalette();
      }
      if (e.key === 'Escape' && overlay.classList.contains('open')) {
        closeCommandPalette();
      }
    });

    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeCommandPalette();
    });

    if (input) {
      input.addEventListener('input', function () { renderCommands(input.value); });
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          var first = overlay.querySelector('.atlas-cp-item');
          if (first) { closeCommandPalette(); first.click(); }
        }
      });
    }
  }

  /* ── Enquiry row inspector (read-only) ── */
  function formatMoney(quote) {
    if (!quote || quote.amount == null) return '—';
    var sym = quote.currency === 'INR' ? '₹' : (quote.currency === 'USD' ? '$' : (quote.currency === 'EUR' ? '€' : '£'));
    return sym + Number(quote.amount).toLocaleString(undefined, { minimumFractionDigits: 2 });
  }

  function populateEnquiryInspector(quote) {
    var panel = document.getElementById('enquiry-row-inspector');
    if (!panel || !quote) return;
    var empty = panel.querySelector('.eri-empty');
    var content = panel.querySelector('.eri-content');
    if (empty) empty.style.display = 'none';
    if (content) content.style.display = 'block';

    var refFn = typeof window.getQuoteRefId === 'function' ? window.getQuoteRefId : function (q) { return q.id; };
    var set = function (id, val) {
      var el = document.getElementById(id);
      if (el) el.textContent = val != null && val !== '' ? val : '—';
    };

    set('eri-ref', '#' + refFn(quote));
    set('eri-date', quote.date || '—');
    set('eri-mode', (quote.type || '—').toUpperCase());
    set('eri-customer', quote.customer || '—');
    set('eri-desk', (window.TEAM_ROLES && window.TEAM_ROLES[quote.creator] && window.TEAM_ROLES[quote.creator].name) || quote.creator || '—');
    set('eri-carrier', (quote.details && (quote.details.airline || quote.details.shippingLine || quote.details.carrier)) || '—');
    set('eri-route', quote.route || ((quote.details && quote.details.origin) ? quote.details.origin + ' → ' + (quote.details.destination || '') : '—'));
    set('eri-tonnage', (quote.details && (quote.details.chargeableWeight || quote.details.grossWeight))
      ? Number(quote.details.chargeableWeight || quote.details.grossWeight).toLocaleString() + ' kg' : '—');
    set('eri-sell', formatMoney(quote));
    set('eri-status', quote.status ? quote.status.charAt(0).toUpperCase() + quote.status.slice(1) : '—');

    var gpEl = document.getElementById('eri-gp');
    if (gpEl) {
      gpEl.textContent = (quote.grossProfit != null && quote.amount)
        ? ((quote.grossProfit / quote.amount) * 100).toFixed(2) + '%' : '—';
    }
    panel.classList.add('eri-has-selection');
  }

  function initEnquiryRowInspector() {
    var tbody = document.getElementById('admin-quotes-body');
    if (!tbody || tbody._eriBound) return;
    tbody._eriBound = true;

    tbody.addEventListener('click', function (e) {
      if (e.target.closest('button') || e.target.closest('a') || e.target.closest('input')) return;
      var row = e.target.closest('tr[data-quote-id]');
      if (!row) return;
      tbody.querySelectorAll('tr.eri-selected').forEach(function (r) { r.classList.remove('eri-selected'); });
      row.classList.add('eri-selected');
      var quoteId = row.getAttribute('data-quote-id');
      var quotes = typeof ui().getQuotes === 'function' ? ui().getQuotes() : [];
      var quote = quotes.find(function (q) { return q.id === quoteId; });
      if (quote) populateEnquiryInspector(quote);
    });
  }

  var _origApplyDb = window.applyDbFiltersAndSort;
  if (typeof _origApplyDb === 'function') {
    window.applyDbFiltersAndSort = function () {
      _origApplyDb.apply(this, arguments);
      var selected = document.querySelector('#admin-quotes-body tr.eri-selected');
      if (selected) {
        var quoteId = selected.getAttribute('data-quote-id');
        var quotes = typeof ui().getQuotes === 'function' ? ui().getQuotes() : [];
        var quote = quotes.find(function (q) { return q.id === quoteId; });
        if (quote) populateEnquiryInspector(quote);
      }
    };
  }

  function boot() {
    initEnquiryRowInspector();
    initCommandPalette();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  window.navigateRoleLanding = navigateRoleLanding;
  window.openAtlasCommandPalette = openCommandPalette;
})();

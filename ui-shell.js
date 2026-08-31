/**
 * Atlas UI Shell — navigation, command palette, enquiry inspector.
 * Does NOT modify formulas, quote save/load, or calculation functions.
 */
(function () {
  'use strict';

  function ui() {
    return window.__atlasUi || {};
  }

  function isLoggedIn() {
    var user = typeof ui().getCurrentUser === 'function' ? ui().getCurrentUser() : null;
    if (user) return true;
    var overlay = document.getElementById('login-overlay');
    if (!overlay) return false;
    return overlay.style.display === 'none';
  }

  function isAdminSession() {
    var user = (typeof ui().getCurrentUser === 'function' ? ui().getCurrentUser() : '') || '';
    user = user.toLowerCase();
    return user === 'ganny' || user === 'manager';
  }

  function roleCategory(role) {
    var r = (role || '').toLowerCase();
    return (window.TEAM_ROLES && window.TEAM_ROLES[r] && window.TEAM_ROLES[r].category) || '';
  }

  function navigateRoleLanding(role) {
    var r = (role || '').toLowerCase();
    if (!r || r === 'ganny' || r === 'manager') return;

    /* Admin previewing another desk should stay on dashboard — avoid jarring jumps */
    var current = typeof ui().getCurrentUser === 'function' ? (ui().getCurrentUser() || '').toLowerCase() : '';
    if (current === 'ganny' || current === 'manager') return;

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

  function switchAdminTab(tabName) {
    var panel = document.getElementById('manager-panel');
    if (!panel) return;
    var hubCard = panel.querySelector('.home-hub-card[data-hub-tab="' + tabName + '"]');
    if (typeof window.switchHomeHubTab === 'function') {
      window.switchHomeHubTab(tabName, hubCard);
      return;
    }
    var buttons = panel.querySelectorAll('.desk-tab-strip .desk-tab-btn');
    var targetBtn = null;
    buttons.forEach(function (btn) {
      var onclick = btn.getAttribute('onclick') || '';
      if (onclick.indexOf("'" + tabName + "'") !== -1) targetBtn = btn;
    });
    if (typeof window.switchDeskTab === 'function') {
      window.switchDeskTab('manager-panel', tabName, targetBtn);
    }
    if (tabName === 'enquiry-database' && typeof window.applyDbFiltersAndSort === 'function') {
      window.applyDbFiltersAndSort();
    }
    if (tabName === 'analytics') {
      if (typeof window.renderExecutiveDashboard === 'function') window.renderExecutiveDashboard();
      if (typeof window.renderExecutiveDashboardIntelligence === 'function') {
        window.lastCalculatedQuotesKey = '';
        window.renderExecutiveDashboardIntelligence();
      }
    }
  }

  function buildCommands() {
    var cmds = [
      { label: 'Home Dashboard', keywords: 'home dashboard', run: function () { if (window.goHome) window.goHome(); } },
      { label: 'Air Freight Desk', keywords: 'air freight quote', run: function () { if (window.openActiveCalculator) window.openActiveCalculator('air'); } },
      { label: 'Sea Freight Desk', keywords: 'sea ocean freight quote', run: function () { if (window.openActiveCalculator) window.openActiveCalculator('sea'); } },
      { label: 'Transportation Desk', keywords: 'transport trucking', run: function () { if (window.openActiveCalculator) window.openActiveCalculator('transport'); } },
      { label: 'Warehousing Desk', keywords: 'warehouse storage', run: function () { if (window.openActiveCalculator) window.openActiveCalculator('warehouse'); } },
      { label: 'Agent Directory', keywords: 'directory agents contacts', run: function () { if (window.openActiveCalculator) window.openActiveCalculator('directory'); } },
      { label: 'Circulars Library', keywords: 'circulars documents tariffs', run: function () { if (window.openActiveCalculator) window.openActiveCalculator('circulars'); } },
      { label: 'Sales Module', keywords: 'sales', run: function () { if (window.openActiveCalculator) window.openActiveCalculator('sales'); } },
      { label: 'Atlas Help', keywords: 'ai assistant help copilot', run: function () { if (window.toggleAtlasCopilot) window.toggleAtlasCopilot(true); } }
    ];
    if (isAdminSession()) {
      cmds.push(
        { label: 'Admin — Overview', keywords: 'admin overview dashboard', run: function () { if (window.goHome) window.goHome(); } },
        { label: 'Admin — Enquiry Database', keywords: 'admin enquiry database quotes', run: function () {
          if (window.goHome) window.goHome();
          window.setTimeout(function () { switchAdminTab('enquiry-database'); }, 80);
        }},
        { label: 'Admin — Analytics', keywords: 'admin analytics executive', run: function () {
          if (window.goHome) window.goHome();
          window.setTimeout(function () { switchAdminTab('analytics'); }, 80);
        }},
        { label: 'Admin — Quoting Agents', keywords: 'admin agents directory', run: function () {
          if (window.goHome) window.goHome();
          window.setTimeout(function () { switchAdminTab('agent-directory'); }, 80);
        }}
      );
    }
    return cmds;
  }

  var cpActiveIndex = 0;
  var cpMatches = [];

  function openCommandPalette() {
    if (!isLoggedIn()) return;
    var overlay = document.getElementById('atlas-command-palette');
    var input = document.getElementById('atlas-cp-input');
    if (!overlay) return;
    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden', 'false');
    cpActiveIndex = 0;
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

  function highlightActiveItem(list) {
    if (!list) return;
    var items = list.querySelectorAll('.atlas-cp-item');
    items.forEach(function (item, idx) {
      item.classList.toggle('active', idx === cpActiveIndex);
    });
    var active = items[cpActiveIndex];
    if (active) active.scrollIntoView({ block: 'nearest' });
  }

  function runActiveCommand() {
    if (!cpMatches.length) return;
    var cmd = cpMatches[cpActiveIndex] || cpMatches[0];
    closeCommandPalette();
    if (cmd && cmd.run) cmd.run();
  }

  function renderCommands(query) {
    var list = document.getElementById('atlas-cp-list');
    if (!list) return;
    var q = (query || '').toLowerCase().trim();
    var all = buildCommands();
    cpMatches = all.filter(function (cmd) {
      if (!q) return true;
      return (cmd.label + ' ' + cmd.keywords).toLowerCase().indexOf(q) !== -1;
    });
    if (cpActiveIndex >= cpMatches.length) cpActiveIndex = 0;
    list.innerHTML = '';
    cpMatches.forEach(function (cmd, idx) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'atlas-cp-item' + (idx === cpActiveIndex ? ' active' : '');
      btn.textContent = cmd.label;
      btn.addEventListener('click', function () {
        cpActiveIndex = idx;
        runActiveCommand();
      });
      list.appendChild(btn);
    });
    if (!cpMatches.length) {
      list.innerHTML = '<div class="atlas-cp-empty">No matching commands</div>';
    }
  }

  function initCommandPalette() {
    var overlay = document.getElementById('atlas-command-palette');
    var input = document.getElementById('atlas-cp-input');
    if (!overlay) return;

    document.addEventListener('keydown', function (e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        if (!isLoggedIn()) return;
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
      input.addEventListener('input', function () {
        cpActiveIndex = 0;
        renderCommands(input.value);
      });
      input.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          if (cpMatches.length) {
            cpActiveIndex = (cpActiveIndex + 1) % cpMatches.length;
            highlightActiveItem(document.getElementById('atlas-cp-list'));
          }
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          if (cpMatches.length) {
            cpActiveIndex = (cpActiveIndex - 1 + cpMatches.length) % cpMatches.length;
            highlightActiveItem(document.getElementById('atlas-cp-list'));
          }
        } else if (e.key === 'Enter') {
          e.preventDefault();
          runActiveCommand();
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

  function clearEnquiryInspector() {
    var panel = document.getElementById('enquiry-row-inspector');
    if (!panel) return;
    var empty = panel.querySelector('.eri-empty');
    var content = panel.querySelector('.eri-content');
    if (empty) empty.style.display = '';
    if (content) content.style.display = 'none';
    panel.classList.remove('eri-has-selection');
    panel._selectedQuoteId = null;
    var tbody = document.getElementById('admin-quotes-body');
    if (tbody) {
      tbody.querySelectorAll('tr.eri-selected').forEach(function (r) { r.classList.remove('eri-selected'); });
    }
  }

  function wireInspectorAction(btnId, fn) {
    var btn = document.getElementById(btnId);
    if (!btn) return;
    btn.onclick = function (e) {
      if (e) e.stopPropagation();
      if (typeof fn === 'function') fn();
    };
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

    var refText = '#' + refFn(quote);
    set('eri-ref', refText);
    set('eri-date', quote.date || '—');
    set('eri-mode', (quote.type || '—').toUpperCase());
    set('eri-customer', quote.customer || '—');
    set('eri-desk', (window.TEAM_ROLES && window.TEAM_ROLES[quote.creator] && window.TEAM_ROLES[quote.creator].name) || quote.creator || '—');
    set('eri-carrier', (quote.details && (quote.details.airline || quote.details.shippingLine || quote.details.carrier)) || '—');
    set('eri-route', quote.route || ((quote.details && quote.details.origin) ? quote.details.origin + ' → ' + (quote.details.destination || '') : '—'));
    set('eri-tonnage', (typeof window.getQuoteBillingWeight === 'function')
      ? window.getQuoteBillingWeight(quote)
      : '—');
    set('eri-sell', formatMoney(quote));
    var statusLabel = quote.status ? quote.status.charAt(0).toUpperCase() + quote.status.slice(1) : '—';
    if (quote.status === 'converted') statusLabel = 'Won';
    set('eri-status', statusLabel);

    var pill = document.getElementById('eri-status-pill');
    if (pill) {
      pill.textContent = statusLabel;
      pill.className = 'eri-status-pill status-' + (quote.status || 'quoted');
    }

    var gpEl = document.getElementById('eri-gp');
    if (gpEl) {
      gpEl.textContent = (quote.grossProfit != null && quote.amount)
        ? ((quote.grossProfit / quote.amount) * 100).toFixed(2) + '%' : '—';
    }

    var qid = quote.id;
    wireInspectorAction('eri-btn-view', function () {
      if (typeof window.viewSavedQuote === 'function') window.viewSavedQuote(qid);
    });
    wireInspectorAction('eri-btn-amend', function () {
      if (typeof window.amendQuote === 'function') window.amendQuote(qid);
    });
    var convertBtn = document.getElementById('eri-btn-convert');
    if (convertBtn) {
      if (quote.status === 'quoted') {
        convertBtn.style.display = '';
        convertBtn.textContent = 'Won';
        convertBtn.className = 'eri-cta eri-cta-win';
        convertBtn.onclick = function (e) {
          if (e) e.stopPropagation();
          if (typeof window.convertQuote === 'function') window.convertQuote(qid);
        };
      } else {
        convertBtn.style.display = '';
        convertBtn.textContent = 'Revert';
        convertBtn.className = 'eri-cta eri-cta-revert';
        convertBtn.onclick = function (e) {
          if (e) e.stopPropagation();
          if (typeof window.revertQuoteToOriginal === 'function') window.revertQuoteToOriginal(qid);
        };
      }
    }

    panel.classList.add('eri-has-selection');
    panel._selectedQuoteId = quote.id;
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
      var panel = document.getElementById('enquiry-row-inspector');
      var selectedId = panel && panel._selectedQuoteId;
      if (!selectedId) return;
      var selectedRow = document.querySelector('#admin-quotes-body tr[data-quote-id="' + selectedId + '"]');
      if (!selectedRow) {
        clearEnquiryInspector();
        if (panel) panel._selectedQuoteId = null;
        return;
      }
      var quotes = typeof ui().getQuotes === 'function' ? ui().getQuotes() : [];
      var quote = quotes.find(function (q) { return q.id === selectedId; });
      if (quote) populateEnquiryInspector(quote);
      else clearEnquiryInspector();
    };
  }

  /* ── URL hash ↔ module sync (navigation only; no calc/save changes) ── */
  var HASH_TO_MODULE = {
    '': 'dashboard',
    dashboard: 'dashboard',
    home: 'dashboard',
    'air-freight': 'air',
    air: 'air',
    'sea-freight': 'sea',
    sea: 'sea',
    transport: 'transport',
    warehouse: 'warehouse',
    directory: 'directory',
    circulars: 'circulars',
    sales: 'sales'
  };
  var MODULE_TO_HASH = {
    dashboard: '',
    air: 'air-freight',
    sea: 'sea-freight',
    transport: 'transport',
    warehouse: 'warehouse',
    directory: 'directory',
    circulars: 'circulars',
    sales: 'sales'
  };

  function setNavHash(module) {
    var slug = MODULE_TO_HASH[module];
    if (slug === undefined) return;
    var nextHash = slug ? '#' + slug : '';
    var current = window.location.hash || '';
    if (current === nextHash || (nextHash === '' && (current === '' || current === '#'))) return;
    var url = window.location.pathname + window.location.search + nextHash;
    if (window.history && window.history.replaceState) {
      window.history.replaceState(null, '', url);
    } else if (slug) {
      window.location.hash = slug;
    } else {
      window.location.hash = '';
    }
  }

  function navigateFromHash() {
    if (!isLoggedIn()) return;
    var raw = (window.location.hash || '').replace(/^#/, '').toLowerCase();
    if (!raw || raw === 'dashboard' || raw === 'home') {
      if (window.goHome && !window._suppressHashHome) window.goHome();
      return;
    }
    var mod = HASH_TO_MODULE[raw];
    if (mod && mod !== 'dashboard' && typeof window.openActiveCalculator === 'function') {
      window.openActiveCalculator(mod);
    }
  }

  if (typeof window.openActiveCalculator === 'function') {
    var _origOpenCalc = window.openActiveCalculator;
    window.openActiveCalculator = function (type) {
      _origOpenCalc(type);
      setNavHash(type);
      if (typeof window.refreshAtlasHelpContext === 'function') window.refreshAtlasHelpContext();
      if (typeof window.setAtlasBreadcrumb === 'function') window.setAtlasBreadcrumb(type);
    };
  }
  if (typeof window.goHome === 'function') {
    var _origGoHome = window.goHome;
    window.goHome = function () {
      window._suppressHashHome = true;
      _origGoHome();
      window._suppressHashHome = false;
      setNavHash('dashboard');
      if (typeof window.refreshAtlasHelpContext === 'function') window.refreshAtlasHelpContext();
      if (typeof window.setAtlasBreadcrumb === 'function') window.setAtlasBreadcrumb('dashboard');
    };
  }
  window.addEventListener('hashchange', navigateFromHash);

  function boot() {
    initEnquiryRowInspector();
    initCommandPalette();
    if (isLoggedIn() && window.location.hash) {
      window.setTimeout(navigateFromHash, 400);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  window.navigateRoleLanding = navigateRoleLanding;
  window.openAtlasCommandPalette = openCommandPalette;
  window.clearEnquiryInspector = clearEnquiryInspector;
  window.getSelectedEnquiryQuote = function () {
    var panel = document.getElementById('enquiry-row-inspector');
    var id = panel && panel._selectedQuoteId;
    if (!id) return null;
    var quotes = typeof ui().getQuotes === 'function' ? ui().getQuotes() : [];
    return quotes.find(function (q) { return q.id === id; }) || null;
  };
})();

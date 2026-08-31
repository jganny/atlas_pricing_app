/**
 * Atlas Enterprise UI — Phases 0–5 (presentation only)
 * Does not modify calculate* or DB.saveQuote schemas.
 */
(function () {
  'use strict';

  var ROUTE_HOSTS = { air: 'air-quote-routes-host', sea: 'sea-quote-routes-host' };
  var ROUTE_SECTIONS = { air: 'air-quote-routes-section', sea: 'sea-quote-routes-section' };
  var ROUTE_COMPOSER_MODE = null;

  var MODULE_LABELS = {
    dashboard: 'Home',
    air: 'Air Freight',
    sea: 'Sea Freight',
    transport: 'Transportation',
    warehouse: 'Warehousing',
    directory: 'Directory',
    circulars: 'Circulars',
    sales: 'Sales'
  };

  var DESK_PANELS = {
    air: 'air-freight-panel',
    sea: 'sea-freight-panel',
    transport: 'transportation-panel',
    warehouse: 'warehousing-panel'
  };

  function $(id) { return document.getElementById(id); }

  function extractShort(value) {
    if (typeof window.extractDeskRouteShortLabel === 'function') {
      return window.extractDeskRouteShortLabel(value);
    }
    var v = (value || '').trim();
    if (!v) return '?';
    var i = v.indexOf(' - ');
    if (i > 0) return v.substring(0, i).trim().toUpperCase();
    return v.split(/\s+/)[0].substring(0, 8).toUpperCase();
  }

  /* ── Breadcrumb (Phase 0) ── */
  function setBreadcrumb(module, context) {
    var current = $('atlas-breadcrumb-current');
    if (!current) return;
    var label = MODULE_LABELS[module] || module || 'Home';
    current.textContent = context ? label + ' · ' + context : label;
    current.title = current.textContent;
  }

  function initBreadcrumb() {
    var root = document.querySelector('.atlas-breadcrumb .bc-root');
    if (root) {
      root.addEventListener('click', function () {
        if (typeof window.goHome === 'function') window.goHome();
      });
    }
    var cmdBtn = $('header-cmdk-btn');
    if (cmdBtn) {
      cmdBtn.addEventListener('click', function () {
        if (typeof window.openAtlasCommandPalette === 'function') window.openAtlasCommandPalette();
      });
    }
  }

  /* ── Route composer (Phase 1) ── */
  function openRouteComposer(mode) {
    var sectionId = ROUTE_SECTIONS[mode];
    var hostId = ROUTE_HOSTS[mode];
    var section = $(sectionId);
    var body = $('route-composer-drawer-body');
    var drawer = $('route-composer-drawer');
    if (!section || !body || !drawer) return;

    ROUTE_COMPOSER_MODE = mode;
    body.appendChild(section);
    section.hidden = false;

    var tbody = section.querySelector('tbody');
    if (tbody && !tbody.querySelector('tr[data-route-id]')) {
      if (typeof window.initDeskRoutes === 'function') window.initDeskRoutes(mode);
    }

    drawer.classList.add('open');
    drawer.setAttribute('aria-hidden', 'false');
    document.body.classList.add('enterprise-drawer-open');
  }

  function closeRouteComposer() {
    var drawer = $('route-composer-drawer');
    if (!drawer) return;
    var mode = ROUTE_COMPOSER_MODE;
    if (mode) {
      var section = $(ROUTE_SECTIONS[mode]);
      var host = $(ROUTE_HOSTS[mode]);
      if (section && host) {
        section.hidden = true;
        host.appendChild(section);
      }
      refreshRouteChips(mode);
      refreshLaneVisual(mode);
    }
    drawer.classList.remove('open');
    drawer.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('enterprise-drawer-open');
    ROUTE_COMPOSER_MODE = null;
  }

  function refreshRouteChips(mode) {
    var strip = $(mode + '-route-chip-strip');
    if (!strip) return;
    var routes = typeof window.getDeskRoutes === 'function' ? window.getDeskRoutes(mode) : [];
    strip.innerHTML = '';
    routes.forEach(function (r, idx) {
      var chip = document.createElement('span');
      chip.className = 'enterprise-route-chip' + (idx === 0 ? ' is-primary' : '');
      var o = extractShort(r.origin);
      var d = extractShort(r.destination);
      chip.textContent = (routes.length > 1 ? r.label + ': ' : '') + o + ' → ' + d;
      chip.title = (r.origin || '?') + ' → ' + (r.destination || '?');
      strip.appendChild(chip);
    });
    if (routes.length <= 1) {
      var hint = document.createElement('span');
      hint.className = 'enterprise-route-chip is-primary';
      var meta = mode === 'air'
        ? { o: 'air-origin', d: 'air-dest' }
        : { o: 'sea-origin', d: 'sea-dest' };
      var oEl = $(meta.o);
      var dEl = $(meta.d);
      hint.textContent = extractShort(oEl && oEl.value) + ' → ' + extractShort(dEl && dEl.value);
      if (!strip.children.length) strip.appendChild(hint);
    }
  }

  function refreshLaneVisual(mode) {
    var meta = mode === 'air'
      ? { o: 'air-lane-origin-code', d: 'air-lane-dest-code', of: 'air-origin', df: 'air-dest' }
      : { o: 'sea-lane-origin-code', d: 'sea-lane-dest-code', of: 'sea-origin', df: 'sea-dest' };
    var oCode = $(meta.o);
    var dCode = $(meta.d);
    var oField = $(meta.of);
    var dField = $(meta.df);
    if (oCode && oField) oCode.textContent = extractShort(oField.value);
    if (dCode && dField) dCode.textContent = extractShort(dField.value);
  }

  function refreshRecordContext(mode) {
    var prefix = mode;
    var custEl = $(prefix + '-ctx-customer');
    var laneEl = $(prefix + '-ctx-lane');
    var incEl = $(prefix + '-ctx-incoterm');
    var curEl = $(prefix + '-ctx-currency');
    if (!custEl && mode === 'transport') {
      custEl = $('transport-ctx-customer');
      laneEl = $('transport-ctx-lane');
      curEl = $('transport-ctx-currency');
    }
    if (!custEl && mode === 'warehouse') {
      custEl = $('warehouse-ctx-customer');
      curEl = $('warehouse-ctx-currency');
    }

    if (mode === 'air' || mode === 'sea') {
      var custField = $(mode === 'air' ? 'air-cust-name' : 'sea-cust-name');
      var oField = $(mode === 'air' ? 'air-origin' : 'sea-origin');
      var dField = $(mode === 'air' ? 'air-dest' : 'sea-dest');
      var incField = $(mode === 'air' ? 'air-incoterm' : 'sea-incoterm');
      var curField = $(mode === 'air' ? 'air-currency' : 'sea-currency');
      if (custEl) custEl.textContent = (custField && custField.value.trim()) || '—';
      if (laneEl) laneEl.textContent = extractShort(oField && oField.value) + ' → ' + extractShort(dField && dField.value);
      if (incEl && incField) incEl.textContent = incField.value || '—';
      if (curEl && curField) curEl.textContent = curField.value || '—';
    } else if (mode === 'transport') {
      var tCust = $('transport-customer-name');
      var tCur = $('transport-header-currency');
      var pickup = $('transport-pickup-city');
      var delivery = $('transport-delivery-city');
      if (custEl) custEl.textContent = (tCust && tCust.value.trim()) || '—';
      if (laneEl) laneEl.textContent = ((pickup && pickup.value) || 'Pickup') + ' → ' + ((delivery && delivery.value) || 'Delivery');
      if (curEl && tCur) curEl.textContent = tCur.value || 'INR';
    } else if (mode === 'warehouse') {
      var wCust = $('warehouse-customer-name');
      var wCur = $('warehouse-header-currency');
      if (custEl) custEl.textContent = (wCust && wCust.value.trim()) || '—';
      if (curEl && wCur) curEl.textContent = wCur.value || 'INR';
    }
  }

  function bindDeskContextRefresh(mode) {
    var fields = [];
    if (mode === 'air') fields = ['air-cust-name', 'air-origin', 'air-dest', 'air-incoterm', 'air-currency'];
    if (mode === 'sea') fields = ['sea-cust-name', 'sea-origin', 'sea-dest', 'sea-incoterm', 'sea-currency'];
    if (mode === 'transport') fields = ['transport-customer-name', 'transport-header-currency', 'transport-pickup-city', 'transport-delivery-city'];
    if (mode === 'warehouse') fields = ['warehouse-customer-name', 'warehouse-header-currency'];
    fields.forEach(function (id) {
      var el = $(id);
      if (!el || el._enterpriseCtxBound) return;
      el._enterpriseCtxBound = true;
      el.addEventListener('input', function () {
        refreshRecordContext(mode);
        if (mode === 'air' || mode === 'sea') {
          refreshLaneVisual(mode);
          refreshRouteChips(mode);
        }
      });
      el.addEventListener('change', function () {
        refreshRecordContext(mode);
      });
    });
  }

  /* ── Carrier route override toggle (Phase 1) ── */
  function toggleCarrierRouteOverride(btn) {
    var wrap = btn.closest('.card-route-select-wrap');
    if (!wrap) return;
    wrap.classList.add('is-route-expanded');
    var panel = wrap.querySelector('.enterprise-route-select-panel');
    if (panel) panel.hidden = false;
    var sel = wrap.querySelector('.card-route-select');
    if (sel) sel.focus();
  }

  function enhanceCarrierRouteWraps(root) {
    (root || document).querySelectorAll('.card-route-select-wrap:not(.enterprise-route-default)').forEach(function (wrap) {
      if (wrap.classList.contains('is-bb-only')) return;
      var label = wrap.querySelector('label');
      var select = wrap.querySelector('.card-route-select');
      if (!select) return;
      wrap.classList.add('enterprise-route-default');
      var inline = document.createElement('div');
      inline.className = 'enterprise-route-inline';
      inline.innerHTML = '<span class="enterprise-route-same-label">Same lane as shipment</span>' +
        '<button type="button" class="enterprise-ghost-btn enterprise-route-override-btn">Different route</button>';
      inline.querySelector('button').addEventListener('click', function () {
        toggleCarrierRouteOverride(this);
      });
      var panel = document.createElement('div');
      panel.className = 'enterprise-route-select-panel';
      panel.hidden = true;
      if (label) panel.appendChild(label);
      panel.appendChild(select);
      wrap.innerHTML = '';
      wrap.appendChild(inline);
      wrap.appendChild(panel);
      if (select.value && select.value !== 'primary') {
        wrap.classList.add('is-route-expanded');
        panel.hidden = false;
      }
    });
  }

  /* ── Remove broken insight rails + restore 2-column desk grid ── */
  function removeInsightRails() {
    document.querySelectorAll('.atlas-insight-rail').forEach(function (el) { el.remove(); });
    document.querySelectorAll('.atlas-has-rail').forEach(function (el) {
      el.classList.remove('atlas-has-rail');
      if (el.style.gridTemplateColumns) el.style.gridTemplateColumns = '';
    });
  }

  /* ── Quick fill bar — paste enquiry text → fill desk fields (time-saver) ── */
  function buildAiCommandBar(mode) {
    var panelId = DESK_PANELS[mode];
    if (!panelId) return;
    var panel = $(panelId);
    if (!panel) return;
    var barId = mode + '-ai-command-bar';
    var existing = $(barId);
    if (existing) existing.remove();

    var anchor = panel.querySelector('.enterprise-record-context') ||
      panel.querySelector('.desk-highlights-bar');
    if (!anchor) return;

    var examples = mode === 'sea'
      ? [
          { label: 'LCL lane', text: '2 pkgs 120x80x100 cm, 1.8 CBM, INNSA to SGSIN FOB general' },
          { label: 'Weight only', text: '5000 kg Nhava Sheva to Jebel Ali CIF' }
        ]
      : [
          { label: 'With dims', text: '2 pkgs 120x80x100 cm 500 kg AMD to SVO EXW general' },
          { label: 'Lane + wt', text: '500kg BLR to DXB general EXW' }
        ];

    var bar = document.createElement('div');
    bar.className = 'atlas-ai-command-bar';
    bar.id = barId;
    bar.innerHTML =
      '<div class="atlas-quickfill-head">' +
        '<span class="atlas-ai-command-label">Quick fill</span>' +
        '<span class="atlas-quickfill-purpose">Paste an enquiry line — fills route, cargo &amp; terms in one go</span>' +
      '</div>' +
      '<div class="atlas-quickfill-row">' +
        '<input type="text" class="atlas-ai-command-input" id="' + mode + '-ai-intake" ' +
          'placeholder="' + (mode === 'sea'
            ? 'e.g. 2 pkgs 120x80x100 cm INNSA to SGSIN FOB'
            : 'e.g. 2 pkgs 120x80x100 cm 500 kg AMD to SVO EXW') + '" ' +
          'aria-label="Paste enquiry text to quick-fill the desk" />' +
        '<button type="button" class="atlas-ai-command-parse" data-ai-desk="' + mode + '">Fill form</button>' +
      '</div>' +
      '<div class="atlas-quickfill-chips" role="group" aria-label="Example enquiry lines">' +
        examples.map(function (ex) {
          return '<button type="button" class="atlas-quickfill-chip" data-example="' +
            String(ex.text).replace(/"/g, '&quot;') + '">' + ex.label + '</button>';
        }).join('') +
      '</div>' +
      '<span class="atlas-ai-command-hint" id="' + mode + '-ai-tip"></span>';

    anchor.insertAdjacentElement('afterend', bar);

    var parseBtn = bar.querySelector('[data-ai-desk]');
    if (parseBtn) {
      parseBtn.addEventListener('click', function () { parseAiIntake(mode); });
    }
    var input = bar.querySelector('.atlas-ai-command-input');
    if (input) {
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); parseAiIntake(mode); }
      });
    }
    bar.querySelectorAll('.atlas-quickfill-chip').forEach(function (chip) {
      chip.addEventListener('click', function () {
        if (!input) return;
        input.value = chip.getAttribute('data-example') || '';
        input.focus();
        parseAiIntake(mode);
      });
    });
  }

  function setFieldValue(id, value) {
    var el = $(id);
    if (!el || value == null || value === '') return false;
    el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }

  function fillAirCargoRow(dims, qty, weightKg) {
    var body = $('air-cargo-body');
    if (!body) return false;
    var row = body.querySelector('.cargo-item-row');
    if (!row) {
      var addBtn = $('air-add-cargo');
      if (addBtn) addBtn.click();
      row = body.querySelector('.cargo-item-row');
    }
    if (!row) return false;
    var filled = false;
    if (dims) {
      var len = row.querySelector('.cargo-len');
      var wid = row.querySelector('.cargo-wid');
      var hei = row.querySelector('.cargo-hei');
      if (len) { len.value = dims.l; filled = true; }
      if (wid) { wid.value = dims.w; filled = true; }
      if (hei) { hei.value = dims.h; filled = true; }
    }
    if (qty) {
      var qtyEl = row.querySelector('.cargo-qty');
      if (qtyEl) { qtyEl.value = qty; filled = true; }
    }
    if (weightKg) {
      var gw = row.querySelector('.cargo-gw');
      if (gw) { gw.value = weightKg; filled = true; }
    }
    row.querySelectorAll('input').forEach(function (inp) {
      inp.dispatchEvent(new Event('input', { bubbles: true }));
    });
    return filled;
  }

  function fillSeaCargoRow(dims, qty) {
    var body = $('sea-cargo-body');
    if (!body) return false;
    var row = body.querySelector('.sea-cargo-item-row');
    if (!row) {
      var addBtn = $('sea-add-cargo-row');
      if (addBtn) addBtn.click();
      row = body.querySelector('.sea-cargo-item-row');
    }
    if (!row) return false;
    var filled = false;
    if (dims) {
      var len = row.querySelector('.sea-cargo-len');
      var wid = row.querySelector('.sea-cargo-wid');
      var hei = row.querySelector('.sea-cargo-hei');
      if (len) { len.value = dims.l; filled = true; }
      if (wid) { wid.value = dims.w; filled = true; }
      if (hei) { hei.value = dims.h; filled = true; }
    }
    if (qty) {
      var qtyEl = row.querySelector('.sea-cargo-qty');
      if (qtyEl) { qtyEl.value = qty; filled = true; }
    }
    row.querySelectorAll('input').forEach(function (inp) {
      inp.dispatchEvent(new Event('input', { bubbles: true }));
    });
    if (typeof window.calculateSeaVolumeFromDimensions === 'function') {
      window.calculateSeaVolumeFromDimensions();
    }
    return filled;
  }

  function parseAiIntake(mode) {
    var input = $(mode + '-ai-intake');
    var tip = $(mode + '-ai-tip');
    if (!input || !input.value.trim()) {
      if (tip) tip.textContent = 'Paste an enquiry line first, or tap an example chip.';
      return;
    }
    var text = input.value.trim();
    var applied = [];

    var weightMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:kg|kgs|kilos?)\b/i);
    var routeMatch = text.match(/\b([A-Za-z]{3,5})\s*(?:to|→|->|-|\/)\s*([A-Za-z]{3,5})\b/i);
    var incotermMatch = text.match(/\b(EXW|FCA|FOB|CIF|CFR|CPT|CIP|DAP|DPU|DDU|DDP|FAS)\b/i);
    var dimMatch = text.match(/(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)\s*(cm|mm|m)?/i);
    var qtyMatch = text.match(/\b(\d+)\s*(?:pkgs?|packages?|ctns?|cartons?|pcs?|pieces?|boxes?)\b/i);
    var commodityMatch = text.match(/\b(general|garments?|pharma|perishable|electronics?|machinery|dangerous|dg|haz|hazardous|temperature|temp)\b/i);

    if (mode === 'air' || mode === 'sea') {
      if (routeMatch) {
        var originId = mode === 'air' ? 'air-origin' : 'sea-origin';
        var destId = mode === 'air' ? 'air-dest' : 'sea-dest';
        if (setFieldValue(originId, routeMatch[1].toUpperCase())) applied.push('origin ' + routeMatch[1].toUpperCase());
        if (setFieldValue(destId, routeMatch[2].toUpperCase())) applied.push('destination ' + routeMatch[2].toUpperCase());
      }
      if (incotermMatch) {
        var incId = mode === 'air' ? 'air-incoterm' : 'sea-incoterm';
        if (setFieldValue(incId, incotermMatch[1].toUpperCase())) applied.push('incoterm');
      }
      if (commodityMatch && mode === 'air') {
        var raw = commodityMatch[1].toLowerCase();
        var commodity = /garment/.test(raw) ? 'GARMENTS'
          : /pharma/.test(raw) ? 'PHARMA'
          : /perish/.test(raw) ? 'PERISHABLE'
          : /electron/.test(raw) ? 'ELECTRONICS'
          : /machin/.test(raw) ? 'MACHINERY'
          : /(dangerous|dg|haz)/.test(raw) ? 'DANGEROUS GOODS'
          : /temp/.test(raw) ? 'TEMPERATURE'
          : 'GENERAL';
        if (setFieldValue('air-commodity', commodity)) applied.push('commodity');
      }

      var dims = null;
      if (dimMatch) {
        var unit = (dimMatch[4] || 'cm').toLowerCase();
        var l = parseFloat(dimMatch[1]);
        var w = parseFloat(dimMatch[2]);
        var h = parseFloat(dimMatch[3]);
        if (unit === 'mm') { l /= 10; w /= 10; h /= 10; }
        if (unit === 'm') { l *= 100; w *= 100; h *= 100; }
        dims = { l: Math.round(l * 100) / 100, w: Math.round(w * 100) / 100, h: Math.round(h * 100) / 100 };
      }
      var qty = qtyMatch ? parseInt(qtyMatch[1], 10) : (dims ? 1 : null);
      var weightKg = weightMatch ? weightMatch[1] : null;

      if (mode === 'air' && (dims || qty || weightKg)) {
        if (fillAirCargoRow(dims, qty, weightKg)) {
          if (dims) applied.push('dimensions');
          if (qty) applied.push('qty ' + qty);
          if (weightKg) applied.push(weightKg + ' kg');
        }
      }
      if (mode === 'sea' && (dims || qty)) {
        if (fillSeaCargoRow(dims, qty)) {
          if (dims) applied.push('dimensions');
          if (qty) applied.push('qty ' + qty);
        }
      }

      if (typeof window.calculateAirFreight === 'function' && mode === 'air') window.calculateAirFreight();
      if (typeof window.calculateSeaFreight === 'function' && mode === 'sea') window.calculateSeaFreight();
    }

    refreshRecordContext(mode);
    refreshLaneVisual(mode);
    refreshRouteChips(mode);

    if (tip) {
      tip.textContent = applied.length
        ? 'Filled: ' + applied.join(' · ') + '. Check autocomplete suggestions if needed.'
        : 'Could not read route / weight / dimensions from that text. Try: 2 pkgs 120x80x100 cm 500 kg AMD to SVO EXW';
      tip.classList.toggle('is-error', !applied.length);
      tip.classList.toggle('is-success', !!applied.length);
    }
  }

  /* ── Density toggle (Phase 5) ── */
  function applyDensityMode(mode) {
    var compact = mode === 'compact';
    document.documentElement.classList.remove('atlas-density-compact-pending');
    document.body.classList.toggle('atlas-density-compact', compact);
    document.body.classList.toggle('atlas-density-comfortable', !compact);
    var btn = $('header-density-btn');
    if (btn) {
      btn.textContent = compact ? 'Comfortable' : 'Compact';
      btn.title = compact ? 'Switch to comfortable spacing' : 'Switch to compact spacing';
      btn.setAttribute('aria-pressed', compact ? 'true' : 'false');
    }
  }

  function initDensityToggle() {
    var btn = $('header-density-btn');
    if (!btn) return;
    btn.setAttribute('aria-pressed', 'false');
    var stored = localStorage.getItem('gl_ui_density');
    applyDensityMode(stored === 'compact' ? 'compact' : 'comfortable');
    btn.addEventListener('click', function () {
      var compact = !document.body.classList.contains('atlas-density-compact');
      localStorage.setItem('gl_ui_density', compact ? 'compact' : 'comfortable');
      applyDensityMode(compact ? 'compact' : 'comfortable');
    });
  }

  /* ── Admin session class for sync badge ── */
  function refreshAdminSessionClass() {
    var user = (window.__atlasUi && window.__atlasUi.getCurrentUser && window.__atlasUi.getCurrentUser()) || '';
    user = (user || '').toLowerCase();
    if (user === 'ganny' || user === 'manager') {
      document.body.classList.add('atlas-admin-session');
    }
  }

  /* ── Wrap route fns for chip refresh ── */
  function wrapRouteFns() {
    ['addDeskRoute', 'removeDeskRoute', 'initDeskRoutes'].forEach(function (name) {
      var orig = window[name];
      if (typeof orig !== 'function') return;
      window[name] = function (mode) {
        var result = orig.apply(this, arguments);
        if (mode === 'air' || mode === 'sea') {
          refreshRouteChips(mode);
          refreshLaneVisual(mode);
        }
        return result;
      };
    });
  }

  /* ── Observe carrier cards for route wrap enhancement ── */
  function observeCarrierCards() {
    var targets = ['air-airlines-list-container', 'sea-liners-container'];
    targets.forEach(function (id) {
      var el = $(id);
      if (!el || el._enterpriseObserved) return;
      el._enterpriseObserved = true;
      var obs = new MutationObserver(function () {
        enhanceCarrierRouteWraps(el);
      });
      obs.observe(el, { childList: true, subtree: true });
      enhanceCarrierRouteWraps(el);
    });
  }

  /* ── Navigation hooks ── */
  function hookNavigation() {
    if (typeof window.openActiveCalculator === 'function') {
      var orig = window.openActiveCalculator;
      window.openActiveCalculator = function (type) {
        orig(type);
        setBreadcrumb(type);
        if (type === 'air' || type === 'sea') {
          refreshRouteChips(type);
          refreshLaneVisual(type);
        }
      };
    }
    if (typeof window.goHome === 'function') {
      var origHome = window.goHome;
      window.goHome = function () {
        origHome();
        setBreadcrumb('dashboard');
      };
    }
  }

  function initDesks() {
    removeInsightRails();
    // Remove leftover Quick Fill bars / density chrome from earlier builds
    document.querySelectorAll('.atlas-ai-command-bar').forEach(function (el) { el.remove(); });
    ['air', 'sea'].forEach(function (mode) {
      refreshRouteChips(mode);
      refreshLaneVisual(mode);
    });
    observeCarrierCards();
  }

  function boot() {
    document.body.classList.add('atlas-enterprise-ui');
    initBreadcrumb();
    wrapRouteFns();
    hookNavigation();
    setBreadcrumb('dashboard');
    document.body.classList.add('atlas-copilot-rail-mode');
    document.body.classList.remove('atlas-density-compact', 'atlas-density-comfortable');
    document.documentElement.classList.remove('atlas-density-compact-pending');
    try { localStorage.removeItem('gl_ui_density'); } catch (e) { /* ignore */ }

    if (document.readyState === 'complete' || document.getElementById('app-workspace')) {
      window.setTimeout(function () {
        initDesks();
        refreshAdminSessionClass();
      }, 800);
    }

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && $('route-composer-drawer') && $('route-composer-drawer').classList.contains('open')) {
        closeRouteComposer();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  window.openRouteComposer = openRouteComposer;
  window.closeRouteComposer = closeRouteComposer;
  window.toggleCarrierRouteOverride = toggleCarrierRouteOverride;
  window.setAtlasBreadcrumb = setBreadcrumb;
  window.refreshAtlasEnterpriseContext = function (mode) {
    refreshRecordContext(mode);
    refreshLaneVisual(mode);
    refreshRouteChips(mode);
  };
})();

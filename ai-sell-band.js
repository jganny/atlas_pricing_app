/**
 * Desk Quick Assist — opt-in left drawer (read-only).
 * Never auto-covers pricing results. User opens via "Quick assist" button.
 */
(function () {
  'use strict';

  var DESKS = {
    air: { type: 'air', customerSel: '#air-cust-name', originSel: '#air-origin', destSel: '#air-dest', panelSel: '#air-freight-panel' },
    sea: { type: 'sea', customerSel: '#sea-cust-name', originSel: '#sea-origin', destSel: '#sea-dest', panelSel: '#sea-freight-panel' },
    transport: { type: 'transport', customerSel: '#transport-customer-name', panelSel: '#transportation-panel' },
    warehouse: { type: 'warehouse', typeAlt: 'warehousing', customerSel: '#warehouse-customer-name', panelSel: '#warehousing-panel' }
  };

  var IN_AIR = ['BLR', 'BOM', 'DEL', 'MAA', 'HYD', 'CCU', 'AMD', 'COK', 'GOI', 'PNQ', 'TRV', 'ATQ', 'JAI', 'GAU', 'BBI', 'IXC'];
  var GULF = ['DXB', 'AUH', 'DOH', 'MCT', 'BAH', 'KWI', 'RUH', 'JED', 'DMM', 'SHJ'];
  var EU = ['LHR', 'LGW', 'STN', 'MAN', 'FRA', 'AMS', 'CDG', 'MUC', 'ZRH', 'MXP', 'FCO', 'MAD', 'BRU', 'VIE', 'BCN'];
  var US = ['JFK', 'LAX', 'ORD', 'SFO', 'EWR', 'IAD', 'MIA', 'DFW', 'ATL', 'SEA'];
  var APAC = ['SIN', 'HKG', 'BKK', 'KUL', 'NRT', 'HND', 'ICN', 'PVG', 'PEK', 'SYD', 'MEL', 'CGK'];

  var AIR_CORRIDOR_CARRIERS = {
    'IN-EU': [
      { name: 'EK - Emirates', note: 'Daily via Dubai — common on India–Europe lanes' },
      { name: 'QR - Qatar Airways', note: 'Strong hub at Doha — wide Europe coverage' },
      { name: 'BA - British Airways', note: 'Direct or one-stop to UK & Europe' },
      { name: 'AI - Air India', note: 'National carrier — direct options on major routes' },
      { name: 'LH - Lufthansa', note: 'Frankfurt/Munich hub — Europe network' },
      { name: 'TK - Turkish Airlines', note: 'Istanbul hub — competitive transit times' }
    ],
    'IN-GULF': [
      { name: 'EK - Emirates', note: 'High frequency India–Dubai' },
      { name: 'QR - Qatar Airways', note: 'Daily Gulf connections' },
      { name: 'AI - Air India', note: 'Direct Gulf sectors from major Indian gateways' },
      { name: '6E - IndiGo', note: 'Regional Gulf connectivity' },
      { name: 'EY - Etihad Airways', note: 'Abu Dhabi hub' },
      { name: 'OV - Salam Air / WY - Oman Air', note: 'Muscat gateway options' }
    ],
    'IN-US': [
      { name: 'EK - Emirates', note: 'One-stop via Dubai to US East & West' },
      { name: 'QR - Qatar Airways', note: 'Doha hub to major US gateways' },
      { name: 'AI - Air India', note: 'Direct US routes where available' },
      { name: 'LH - Lufthansa', note: 'Transatlantic via Germany' },
      { name: 'BA - British Airways', note: 'London hub to US' }
    ],
    'IN-APAC': [
      { name: 'SQ - Singapore Airlines', note: 'Singapore hub — Southeast Asia & beyond' },
      { name: 'AI - Air India', note: 'Direct Asia-Pacific where filed' },
      { name: 'CX - Cathay Pacific', note: 'Hong Kong hub' },
      { name: 'TG - Thai Airways', note: 'Bangkok connection' },
      { name: 'MH - Malaysia Airlines', note: 'Kuala Lumpur hub' }
    ],
    'EU-IN': null,
    'GULF-IN': null,
    'US-IN': null,
    'APAC-IN': null
  };

  var SEA_CORRIDOR_LINERS = {
    'IN-EU': ['MSC', 'Maersk', 'CMA CGM', 'Hapag-Lloyd', 'ONE'],
    'IN-GULF': ['MSC', 'CMA CGM', 'Hapag-Lloyd', 'Maersk', 'PIL'],
    'IN-US': ['MSC', 'Maersk', 'CMA CGM', 'Hapag-Lloyd', 'ZIM'],
    'IN-APAC': ['MSC', 'Maersk', 'ONE', 'COSCO', 'Evergreen', 'PIL']
  };

  var drawerOpen = false;
  var fab = null;
  var drawer = null;
  var bodyEl = null;
  var badgeEl = null;

  function esc(s) {
    return String(s || '').replace(/</g, '&lt;');
  }

  function getQuotes() {
    if (typeof window.__atlasUi !== 'undefined' && typeof window.__atlasUi.getQuotes === 'function') {
      return window.__atlasUi.getQuotes() || [];
    }
    if (window.appState && window.appState.quotes) return window.appState.quotes;
    return [];
  }

  function parseIata(val) {
    var m = (val || '').trim().match(/^([A-Za-z0-9]{3})/);
    return m ? m[1].toUpperCase() : '';
  }

  function region(code) {
    if (!code) return '';
    if (IN_AIR.indexOf(code) >= 0) return 'IN';
    if (GULF.indexOf(code) >= 0) return 'GULF';
    if (EU.indexOf(code) >= 0) return 'EU';
    if (US.indexOf(code) >= 0) return 'US';
    if (APAC.indexOf(code) >= 0) return 'APAC';
    return 'OTHER';
  }

  function corridorKey(origin, dest) {
    var ro = region(origin);
    var rd = region(dest);
    if (!ro || !rd || ro === 'OTHER' || rd === 'OTHER') return '';
    if (ro === rd) return ro + '-LOCAL';
    return ro + '-' + rd;
  }

  function reverseKey(key) {
    if (!key || key.indexOf('-') === -1) return '';
    var p = key.split('-');
    return p[1] + '-' + p[0];
  }

  function quoteTypes(cfg) {
    var types = [cfg.type];
    if (cfg.typeAlt) types.push(cfg.typeAlt);
    return types;
  }

  function routeLabel(q) {
    var o = (q.details && q.details.origin) || '';
    var d = (q.details && q.details.destination) || '';
    if (o || d) return (o || '—') + ' → ' + (d || '—');
    return q.route || '—';
  }

  function weightLabel(q) {
    var w = (q.details && (q.details.chargeableWeight || q.details.grossWeight)) || 0;
    return w ? w.toLocaleString() + ' kg' : '';
  }

  function customerQuotes(deskKey, customerName) {
    var cfg = DESKS[deskKey];
    var types = quoteTypes(cfg);
    var cust = (customerName || '').toLowerCase().trim();
    if (cust.length < 2) return [];
    return getQuotes().filter(function (q) {
      return types.indexOf((q.type || '').toLowerCase()) !== -1 &&
        (q.customer || '').toLowerCase().indexOf(cust) !== -1;
    }).sort(function (a, b) {
      return (b.date || '').localeCompare(a.date || '');
    }).slice(0, 5);
  }

  function getSmartLaneCarriers(mode, origin, dest) {
    var o = parseIata(origin);
    var d = parseIata(dest);
    if (!o || !d) return { route: '', items: [], historyCount: 0 };

    var key = corridorKey(o, d);
    var rev = reverseKey(key);
    var lookup = key;
    if (!AIR_CORRIDOR_CARRIERS[lookup] && AIR_CORRIDOR_CARRIERS[rev]) lookup = rev;

    var items = [];
    var seen = {};

    function add(name, note, source) {
      var k = (name || '').toLowerCase();
      if (!k || seen[k]) return;
      seen[k] = true;
      items.push({ name: name, note: note || '', source: source || 'intel' });
    }

    if (mode === 'air') {
      var intel = AIR_CORRIDOR_CARRIERS[lookup] || AIR_CORRIDOR_CARRIERS['IN-EU'] || [];
      if (lookup === 'IN-LOCAL' || lookup === 'GULF-LOCAL') {
        intel = [
          { name: '6E - IndiGo', note: 'Domestic / short-haul leader' },
          { name: 'AI - Air India', note: 'Full-service domestic & regional' },
          { name: 'SG - SpiceJet', note: 'Regional cargo options' },
          { name: 'IX - Air India Express', note: 'Point-to-point regional' }
        ];
      }
      intel.forEach(function (c) {
        add(c.name, c.note, 'intel');
      });
    } else if (mode === 'sea') {
      var liners = SEA_CORRIDOR_LINERS[lookup] || SEA_CORRIDOR_LINERS[rev] || SEA_CORRIDOR_LINERS['IN-EU'] || [];
      liners.forEach(function (ln) {
        add(ln, 'Common liner on this trade lane', 'intel');
      });
    }

    if (typeof window.getRouteVendorHistory === 'function') {
      var hist = window.getRouteVendorHistory(mode, origin, dest);
      (hist.vendors || []).forEach(function (v) {
        var note = 'Your team quoted ' + v.timesUsed + '×' + (v.timesWon ? ' · won ' + v.timesWon + '×' : '');
        add(v.name, note, 'history');
      });
      return { route: origin.trim() + ' → ' + dest.trim(), items: items, historyCount: hist.totalQuotes || 0 };
    }

    return { route: origin.trim() + ' → ' + dest.trim(), items: items, historyCount: 0 };
  }

  function activeDeskKey() {
    for (var key in DESKS) {
      var panel = document.querySelector(DESKS[key].panelSel);
      if (panel && panel.classList.contains('active')) return key;
    }
    return null;
  }

  function ensureUi() {
    if (fab && drawer) return;
    fab = document.getElementById('vertex-quick-assist-fab');
    drawer = document.getElementById('vertex-quick-assist-drawer');
    bodyEl = document.getElementById('vertex-quick-assist-body');
    badgeEl = document.getElementById('vertex-quick-assist-badge');
    if (fab && drawer) return;

    fab = document.createElement('button');
    fab.type = 'button';
    fab.id = 'vertex-quick-assist-fab';
    fab.className = 'vertex-quick-assist-fab';
    fab.setAttribute('aria-expanded', 'false');
    fab.innerHTML = '<span class="vqaf-icon">✦</span><span class="vqaf-label">Quick assist</span><span class="vqaf-badge" id="vertex-quick-assist-badge" hidden>0</span>';
    fab.addEventListener('click', toggleDrawer);

    drawer = document.createElement('aside');
    drawer.id = 'vertex-quick-assist-drawer';
    drawer.className = 'vertex-quick-assist-drawer';
    drawer.setAttribute('aria-hidden', 'true');
    drawer.innerHTML =
      '<div class="vqad-header">' +
        '<div><div class="vqad-eyebrow">Quick assist</div><div class="vqad-title">Suggestions only</div></div>' +
        '<button type="button" class="vqad-close" aria-label="Close">&times;</button>' +
      '</div>' +
      '<div class="vqad-body" id="vertex-quick-assist-body"></div>' +
      '<div class="vqad-foot">Nothing here changes your form or saves a quote.</div>';

    drawer.querySelector('.vqad-close').addEventListener('click', closeDrawer);
    document.body.appendChild(fab);
    document.body.appendChild(drawer);
    bodyEl = drawer.querySelector('#vertex-quick-assist-body');
    badgeEl = fab.querySelector('#vertex-quick-assist-badge');
  }

  function openDrawer() {
    ensureUi();
    drawerOpen = true;
    drawer.classList.add('open');
    drawer.setAttribute('aria-hidden', 'false');
    fab.classList.add('open');
    fab.setAttribute('aria-expanded', 'true');
    renderDrawerContent();
  }

  function closeDrawer() {
    if (!drawer) return;
    drawerOpen = false;
    drawer.classList.remove('open');
    drawer.setAttribute('aria-hidden', 'true');
    if (fab) {
      fab.classList.remove('open');
      fab.setAttribute('aria-expanded', 'false');
    }
  }

  function toggleDrawer() {
    if (drawerOpen) closeDrawer();
    else openDrawer();
  }

  function hideQuickAssist() {
    closeDrawer();
  }

  function renderDrawerContent() {
    ensureUi();
    if (!bodyEl) return;
    var deskKey = activeDeskKey();
    if (!deskKey) {
      bodyEl.innerHTML = '<p class="vqad-empty">Open a desk to see suggestions.</p>';
      return;
    }

    var cfg = DESKS[deskKey];
    var custEl = document.querySelector(cfg.customerSel);
    var customer = custEl ? custEl.value : '';
    var origin = cfg.originSel ? ((document.querySelector(cfg.originSel) || {}).value || '') : '';
    var dest = cfg.destSel ? ((document.querySelector(cfg.destSel) || {}).value || '') : '';
    var html = '';

    if ((deskKey === 'air' || deskKey === 'sea') && origin.trim() && dest.trim()) {
      var lane = getSmartLaneCarriers(deskKey, origin, dest);
      html += '<section class="vqad-section"><h4>Carriers on ' + esc(lane.route) + '</h4>';
      if (lane.historyCount) {
        html += '<p class="vqad-meta">' + lane.historyCount + ' past quote' + (lane.historyCount === 1 ? '' : 's') + ' in your database</p>';
      }
      if (lane.items.length) {
        html += '<ul class="vqad-list">';
        lane.items.forEach(function (item) {
          html += '<li><span class="vqad-item-name">' + esc(item.name) + '</span>' +
            '<span class="vqad-item-tag vqad-tag-' + esc(item.source) + '">' +
            (item.source === 'history' ? 'Your team' : 'Common lane') + '</span>' +
            (item.note ? '<span class="vqad-item-note">' + esc(item.note) + '</span>' : '') + '</li>';
        });
        html += '</ul>';
      } else {
        html += '<p class="vqad-empty">Enter full airport/port codes for smarter suggestions.</p>';
      }
      html += '</section>';
    }

    var recent = customerQuotes(deskKey, customer);
    if (recent.length) {
      html += '<section class="vqad-section"><h4>Recent quotes for this customer</h4><ul class="vqad-list vqad-quote-list">';
      recent.forEach(function (q) {
        var meta = esc(routeLabel(q));
        var wt = weightLabel(q);
        if (wt) meta += ' · ' + wt;
        if (q.date) meta += ' · ' + esc(String(q.date).split('T')[0]);
        html += '<li class="vqad-quote-row"><span class="vqad-quote-meta">' + meta + '</span>' +
          '<button type="button" class="vqad-recreate-btn" data-quote-id="' + esc(q.id) + '">Recreate</button></li>';
      });
      html += '</ul></section>';
    }

    if (!html) {
      html = '<p class="vqad-empty">Enter customer name and route to see suggestions. Pricing results stay fully visible — open this panel only when you want tips.</p>';
    }

    bodyEl.innerHTML = html;
    bodyEl.querySelectorAll('.vqad-recreate-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var qid = btn.getAttribute('data-quote-id');
        closeDrawer();
        if (qid && typeof window.recreateQuoteFromExisting === 'function') {
          window.recreateQuoteFromExisting(qid);
        }
      });
    });
  }

  function updateBadge() {
    ensureUi();
    var deskKey = activeDeskKey();
    var count = 0;
    if (deskKey) {
      var cfg = DESKS[deskKey];
      var custEl = document.querySelector(cfg.customerSel);
      var customer = custEl ? custEl.value : '';
      var origin = cfg.originSel ? ((document.querySelector(cfg.originSel) || {}).value || '') : '';
      var dest = cfg.destSel ? ((document.querySelector(cfg.destSel) || {}).value || '') : '';
      if (customer.trim().length >= 2) count++;
      if (origin.trim() && dest.trim()) count++;
    }
    if (badgeEl) {
      if (count > 0) {
        badgeEl.textContent = String(count);
        badgeEl.hidden = false;
      } else {
        badgeEl.hidden = true;
      }
    }
    if (drawerOpen) renderDrawerContent();
  }

  function refreshAll() {
    ensureUi();
    updateBadge();
    if (!activeDeskKey()) closeDrawer();
  }

  function init() {
    ensureUi();
    document.querySelectorAll('.vertex-dream-bubble, #vertex-dream-dock').forEach(function (el) { el.remove(); });
    refreshAll();
    window.setInterval(refreshAll, 2500);

    if (typeof window.openActiveCalculator === 'function') {
      var orig = window.openActiveCalculator;
      window.openActiveCalculator = function () {
        orig.apply(this, arguments);
        window.setTimeout(refreshAll, 400);
      };
    }

    if (typeof window.recreateQuoteFromExisting === 'function') {
      var origRecreate = window.recreateQuoteFromExisting;
      window.recreateQuoteFromExisting = function (id) {
        closeDrawer();
        return origRecreate.apply(this, arguments);
      };
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.refreshVertexSellBand = refreshAll;
  window.hideVertexQuickAssist = hideQuickAssist;
  window.getSmartLaneCarriers = getSmartLaneCarriers;
})();

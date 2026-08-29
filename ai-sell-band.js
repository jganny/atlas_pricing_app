/**
 * Desk Quick Assist — draggable AI bubble near route fields (read-only).
 * Never auto-covers pricing results. User opens via bubble tap; drag grip to move.
 */
(function () {
  'use strict';

  var DESKS = {
    air: { type: 'air', customerSel: '#air-cust-name', originSel: '#air-origin', destSel: '#air-dest', panelSel: '#air-freight-panel', slotSel: '#air-quick-assist-slot' },
    sea: { type: 'sea', customerSel: '#sea-cust-name', originSel: '#sea-origin', destSel: '#sea-dest', panelSel: '#sea-freight-panel', slotSel: '#sea-quick-assist-slot' },
    transport: { type: 'transport', customerSel: '#transport-customer-name', panelSel: '#transportation-panel' },
    warehouse: { type: 'warehouse', typeAlt: 'warehousing', customerSel: '#warehouse-customer-name', panelSel: '#warehousing-panel' }
  };

  var POS_KEY = 'vertex-quick-assist-pos-v129';
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
  var dragState = null;
  var posMode = 'anchor';

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

  function carrierKey(name) {
    var trimmed = (name || '').trim();
    var codeMatch = trimmed.match(/^([A-Za-z0-9]{2,3})\s*[-–]\s*\S/);
    if (codeMatch) return codeMatch[1].toUpperCase();
    if (/^[A-Za-z0-9]{2,3}$/.test(trimmed)) return trimmed.toUpperCase();
    return trimmed.toLowerCase();
  }

  function getSmartLaneCarriers(mode, origin, dest) {
    var o = parseIata(origin);
    var d = parseIata(dest);
    if (!o || !d) return { route: '', items: [] };

    var key = corridorKey(o, d);
    var rev = reverseKey(key);
    var lookup = key;
    if (!AIR_CORRIDOR_CARRIERS[lookup] && AIR_CORRIDOR_CARRIERS[rev]) lookup = rev;

    var byKey = {};

    function add(name, note, usedOnLane) {
      if (!name) return;
      var k = carrierKey(name);
      var displayName = name.trim();
      if (byKey[k]) {
        if (displayName.length > byKey[k].name.length) byKey[k].name = displayName;
        if (note && byKey[k].note.indexOf(note) === -1) {
          byKey[k].note = byKey[k].note ? byKey[k].note + ' · ' + note : note;
        }
        if (usedOnLane) byKey[k].usedOnLane = true;
        return;
      }
      byKey[k] = { name: displayName, note: note || '', usedOnLane: !!usedOnLane };
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
        add(c.name, c.note, false);
      });
    } else if (mode === 'sea') {
      var liners = SEA_CORRIDOR_LINERS[lookup] || SEA_CORRIDOR_LINERS[rev] || SEA_CORRIDOR_LINERS['IN-EU'] || [];
      liners.forEach(function (ln) {
        add(ln, 'Regular liner on this trade lane', false);
      });
    }

    if (typeof window.getRouteVendorHistory === 'function') {
      var hist = window.getRouteVendorHistory(mode, origin, dest);
      (hist.vendors || []).forEach(function (v) {
        var note = 'Previously quoted ' + v.timesUsed + '× on this lane' +
          (v.timesWon ? ' · won ' + v.timesWon + '×' : '');
        add(v.name, note, true);
      });
    }

    var items = Object.keys(byKey).map(function (k) { return byKey[k]; });
    items.sort(function (a, b) {
      if (a.usedOnLane !== b.usedOnLane) return a.usedOnLane ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    return { route: origin.trim() + ' → ' + dest.trim(), items: items };
  }

  function activeDeskKey() {
    for (var key in DESKS) {
      var panel = document.querySelector(DESKS[key].panelSel);
      if (panel && panel.classList.contains('active')) return key;
    }
    return null;
  }

  function readSavedPos() {
    try {
      return JSON.parse(localStorage.getItem(POS_KEY) || 'null');
    } catch (e) {
      return null;
    }
  }

  function savePos(mode, x, y) {
    try {
      localStorage.setItem(POS_KEY, JSON.stringify({ mode: mode, x: x, y: y }));
    } catch (e) { /* ignore quota */ }
  }

  function clamp(n, min, max) {
    return Math.min(max, Math.max(min, n));
  }

  function getAnchorRect() {
    var deskKey = activeDeskKey();
    if (!deskKey) return null;
    var cfg = DESKS[deskKey];
    var slot = cfg.slotSel ? document.querySelector(cfg.slotSel) : null;
    if (slot) {
      var r = slot.getBoundingClientRect();
      if (r.width || r.height) return r;
    }
    var originEl = cfg.originSel ? document.querySelector(cfg.originSel) : null;
    var custEl = cfg.customerSel ? document.querySelector(cfg.customerSel) : null;
    var anchor = originEl || custEl;
    if (!anchor) return null;
    return anchor.getBoundingClientRect();
  }

  function applyFabPosition() {
    if (!fab) return;
    var saved = readSavedPos();
    var rect = fab.getBoundingClientRect();
    var w = rect.width || 168;
    var h = rect.height || 44;

    if (saved && saved.mode === 'free' && typeof saved.x === 'number' && typeof saved.y === 'number') {
      posMode = 'free';
      fab.style.left = clamp(saved.x, 8, window.innerWidth - w - 8) + 'px';
      fab.style.top = clamp(saved.y, 8, window.innerHeight - h - 8) + 'px';
      fab.style.bottom = 'auto';
      fab.style.right = 'auto';
      fab.classList.add('vqaf-free');
      fab.classList.remove('vqaf-anchored');
    } else {
      posMode = 'anchor';
      var anchor = getAnchorRect();
      if (anchor) {
        var left = clamp(anchor.left, 8, window.innerWidth - w - 8);
        var top = clamp(anchor.bottom + 8, 8, window.innerHeight - h - 8);
        fab.style.left = left + 'px';
        fab.style.top = top + 'px';
        fab.style.bottom = 'auto';
        fab.style.right = 'auto';
      } else {
        fab.style.left = 'max(14px, calc(240px + 10px))';
        fab.style.top = 'auto';
        fab.style.bottom = '18px';
      }
      fab.classList.add('vqaf-anchored');
      fab.classList.remove('vqaf-free');
    }
    positionDrawer();
  }

  function positionDrawer() {
    if (!drawer || !fab) return;
    var fabRect = fab.getBoundingClientRect();
    var dw = drawer.offsetWidth || 300;
    var left = clamp(fabRect.left, 8, window.innerWidth - dw - 8);
    var top = fabRect.bottom + 10;
    if (top + 200 > window.innerHeight) {
      top = Math.max(8, fabRect.top - (drawer.offsetHeight || 280) - 10);
    }
    drawer.style.left = left + 'px';
    drawer.style.top = top + 'px';
    drawer.style.bottom = 'auto';
  }

  function onDragMove(e) {
    if (!dragState || !fab) return;
    var pt = e.touches ? e.touches[0] : e;
    var x = pt.clientX - dragState.ox;
    var y = pt.clientY - dragState.oy;
    var w = fab.offsetWidth;
    var h = fab.offsetHeight;
    x = clamp(x, 8, window.innerWidth - w - 8);
    y = clamp(y, 8, window.innerHeight - h - 8);
    fab.style.left = x + 'px';
    fab.style.top = y + 'px';
    fab.style.bottom = 'auto';
    fab.style.right = 'auto';
    fab.classList.add('vqaf-free');
    fab.classList.remove('vqaf-anchored');
    posMode = 'free';
    positionDrawer();
  }

  function onDragEnd() {
    if (!dragState || !fab) return;
    dragState = null;
    fab.classList.remove('vqaf-dragging');
    document.removeEventListener('mousemove', onDragMove);
    document.removeEventListener('mouseup', onDragEnd);
    document.removeEventListener('touchmove', onDragMove);
    document.removeEventListener('touchend', onDragEnd);
    var rect = fab.getBoundingClientRect();
    savePos('free', rect.left, rect.top);
  }

  function onDragStart(e) {
    if (!fab) return;
    e.preventDefault();
    e.stopPropagation();
    var pt = e.touches ? e.touches[0] : e;
    var rect = fab.getBoundingClientRect();
    dragState = { ox: pt.clientX - rect.left, oy: pt.clientY - rect.top };
    fab.classList.add('vqaf-dragging');
    document.addEventListener('mousemove', onDragMove);
    document.addEventListener('mouseup', onDragEnd);
    document.addEventListener('touchmove', onDragMove, { passive: false });
    document.addEventListener('touchend', onDragEnd);
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
    fab.className = 'vertex-quick-assist-fab vqaf-anchored';
    fab.setAttribute('aria-expanded', 'false');
    fab.setAttribute('title', 'AI Quick Assist — drag the grip to move anywhere');
    fab.innerHTML =
      '<span class="vqaf-grip" aria-hidden="true" title="Drag to move">⠿</span>' +
      '<span class="vqaf-bubble-core">' +
        '<span class="vqaf-glow" aria-hidden="true"></span>' +
        '<span class="vqaf-icon">✦</span>' +
        '<span class="vqaf-label">AI Assist</span>' +
        '<span class="vqaf-badge" id="vertex-quick-assist-badge" hidden>0</span>' +
      '</span>';

    fab.querySelector('.vqaf-grip').addEventListener('mousedown', onDragStart);
    fab.querySelector('.vqaf-grip').addEventListener('touchstart', onDragStart, { passive: false });
    fab.querySelector('.vqaf-bubble-core').addEventListener('click', function (e) {
      e.stopPropagation();
      toggleDrawer();
    });

    drawer = document.createElement('aside');
    drawer.id = 'vertex-quick-assist-drawer';
    drawer.className = 'vertex-quick-assist-drawer';
    drawer.setAttribute('aria-hidden', 'true');
    drawer.innerHTML =
      '<div class="vqad-header">' +
        '<div><div class="vqad-eyebrow">AI Quick Assist</div><div class="vqad-title">Lane &amp; customer hints</div></div>' +
        '<button type="button" class="vqad-close" aria-label="Close">&times;</button>' +
      '</div>' +
      '<div class="vqad-body" id="vertex-quick-assist-body"></div>' +
      '<div class="vqad-foot">Suggestions only — nothing here saves or changes your quote.</div>';

    drawer.querySelector('.vqad-close').addEventListener('click', closeDrawer);
    document.body.appendChild(fab);
    document.body.appendChild(drawer);
    bodyEl = drawer.querySelector('#vertex-quick-assist-body');
    badgeEl = fab.querySelector('#vertex-quick-assist-badge');

    window.addEventListener('resize', applyFabPosition);
    window.addEventListener('scroll', function () {
      if (posMode === 'anchor') applyFabPosition();
      else positionDrawer();
    }, true);
  }

  function openDrawer() {
    ensureUi();
    drawerOpen = true;
    drawer.classList.add('open');
    drawer.setAttribute('aria-hidden', 'false');
    fab.classList.add('open');
    fab.setAttribute('aria-expanded', 'true');
    positionDrawer();
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
      bodyEl.innerHTML = '<p class="vqad-empty">Open a desk to see AI suggestions.</p>';
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
      if (lane.items.length) {
        html += '<ul class="vqad-list">';
        lane.items.forEach(function (item) {
          html += '<li><span class="vqad-item-name">' + esc(item.name) + '</span>' +
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
      html = '<p class="vqad-empty">Enter customer name and route (POL/POD or origin/dest) for AI lane hints. Drag the bubble anywhere you prefer.</p>';
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
    applyFabPosition();
    updateBadge();
    if (!activeDeskKey()) closeDrawer();
  }

  function init() {
    ensureUi();
    document.querySelectorAll('.vertex-dream-bubble, #vertex-dream-dock').forEach(function (el) { el.remove(); });
    applyFabPosition();
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

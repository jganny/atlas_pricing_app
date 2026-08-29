/**
 * Desk Quick Assist — floating dream-style PiP bubbles (read-only).
 * - Recent quotes for this customer (Recreate as new quote)
 * - Carriers used on this lane (from saved quote history)
 * NEVER writes to inputs or saves quotes automatically.
 * Does not inject into the pricing results panel.
 */
(function () {
  'use strict';

  var DESKS = {
    air: {
      type: 'air',
      customerSel: '#air-cust-name',
      originSel: '#air-origin',
      destSel: '#air-dest',
      panelSel: '#air-freight-panel'
    },
    sea: {
      type: 'sea',
      customerSel: '#sea-cust-name',
      originSel: '#sea-origin',
      destSel: '#sea-dest',
      panelSel: '#sea-freight-panel'
    },
    transport: {
      type: 'transport',
      customerSel: '#transport-customer-name',
      panelSel: '#transportation-panel'
    },
    warehouse: {
      type: 'warehouse',
      typeAlt: 'warehousing',
      customerSel: '#warehouse-customer-name',
      panelSel: '#warehousing-panel'
    }
  };

  var STACK_BOTTOM = 88;
  var STACK_GAP = 16;

  function dismissKey(kind, deskKey, sig) {
    return 'vertex_dream_' + kind + '_' + deskKey + '_' + sig;
  }

  function isDismissed(key) {
    try { return sessionStorage.getItem(key) === '1'; } catch (e) { return false; }
  }

  function setDismissed(key) {
    try { sessionStorage.setItem(key, '1'); } catch (e) { /* ignore */ }
  }

  function getQuotes() {
    if (typeof window.__atlasUi !== 'undefined' && typeof window.__atlasUi.getQuotes === 'function') {
      return window.__atlasUi.getQuotes() || [];
    }
    if (window.appState && window.appState.quotes) return window.appState.quotes;
    return [];
  }

  function esc(s) {
    return String(s || '').replace(/</g, '&lt;');
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

  function activeDeskKey() {
    for (var key in DESKS) {
      var panel = document.querySelector(DESKS[key].panelSel);
      if (panel && panel.classList.contains('active')) return key;
    }
    return null;
  }

  function removeBubble(id) {
    var el = document.getElementById(id);
    if (el) el.remove();
  }

  function closeBubble(id, dismissStoreKey) {
    removeBubble(id);
    if (dismissStoreKey) setDismissed(dismissStoreKey);
    repositionBubbles();
  }

  function repositionBubbles() {
    var bubbles = Array.from(document.querySelectorAll('.vertex-dream-bubble'));
    var offset = STACK_BOTTOM;
    bubbles.forEach(function (b) {
      b.style.bottom = offset + 'px';
      offset += (b.offsetHeight || 180) + STACK_GAP;
    });
  }

  function mountBubble(id, title, bodyHtml, dismissStoreKey) {
    removeBubble(id);
    var bubble = document.createElement('div');
    bubble.id = id;
    bubble.className = 'vertex-dream-bubble';
    bubble.setAttribute('role', 'complementary');
    bubble.innerHTML =
      '<div class="vdb-shimmer" aria-hidden="true"></div>' +
      '<div class="vdb-header">' +
        '<div class="vdb-title">' + title + '</div>' +
        '<button type="button" class="vdb-close" aria-label="Close suggestion">&times;</button>' +
      '</div>' +
      '<div class="vdb-body">' + bodyHtml + '</div>' +
      '<div class="vdb-foot">Suggestions only — nothing here saves or changes your quote.</div>';
    document.body.appendChild(bubble);
    bubble.querySelector('.vdb-close').addEventListener('click', function () {
      closeBubble(id, dismissStoreKey);
    });
    window.setTimeout(repositionBubbles, 30);
  }

  function renderCustomerBubble(deskKey, customer) {
    var recent = customerQuotes(deskKey, customer);
    if (!recent.length) {
      removeBubble('vertex-dream-customer-' + deskKey);
      return;
    }
    var sig = (customer || '').toLowerCase().trim().slice(0, 40);
    var dKey = dismissKey('customer', deskKey, sig);
    if (isDismissed(dKey)) {
      removeBubble('vertex-dream-customer-' + deskKey);
      return;
    }
    var html = '<ul class="vdb-quote-list">';
    recent.forEach(function (q) {
      var meta = esc(routeLabel(q));
      var wt = weightLabel(q);
      if (wt) meta += ' · ' + wt;
      if (q.date) meta += ' · ' + esc(String(q.date).split('T')[0]);
      html += '<li><span class="vdb-quote-meta">' + meta + '</span>' +
        '<button type="button" class="vdb-recreate-btn" data-quote-id="' + esc(q.id) + '">Recreate</button></li>';
    });
    html += '</ul><p class="vdb-hint">Recreate copies details into a <strong>new</strong> quote — adjust route or weight, then Save.</p>';
    mountBubble(
      'vertex-dream-customer-' + deskKey,
      'Recent quotes for this customer',
      html,
      dKey
    );
    var bubble = document.getElementById('vertex-dream-customer-' + deskKey);
    if (bubble) {
      bubble.querySelectorAll('.vdb-recreate-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var qid = btn.getAttribute('data-quote-id');
          if (qid && typeof window.recreateQuoteFromExisting === 'function') {
            window.recreateQuoteFromExisting(qid);
          }
        });
      });
    }
  }

  function renderLaneBubble(deskKey, origin, dest) {
    if (deskKey !== 'air' && deskKey !== 'sea') {
      removeBubble('vertex-dream-lane-' + deskKey);
      return;
    }
    if (!origin.trim() || !dest.trim()) {
      removeBubble('vertex-dream-lane-' + deskKey);
      return;
    }
    if (typeof window.getRouteVendorHistory !== 'function') return;
    var hist = window.getRouteVendorHistory(deskKey, origin, dest);
    if (!hist.vendors.length) {
      removeBubble('vertex-dream-lane-' + deskKey);
      return;
    }
    var sig = (origin + '|' + dest).toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 60);
    var dKey = dismissKey('lane', deskKey, sig);
    if (isDismissed(dKey)) {
      removeBubble('vertex-dream-lane-' + deskKey);
      return;
    }
    var html = '<p class="vdb-lane-route">' + esc(origin) + ' → ' + esc(dest) +
      ' <span class="vdb-muted">(' + hist.totalQuotes + ' past quote' + (hist.totalQuotes === 1 ? '' : 's') + ')</span></p>' +
      '<ul class="vdb-vendor-list">';
    hist.vendors.slice(0, 6).forEach(function (v) {
      html += '<li><span class="vdb-vendor-name">' + esc(v.name) + '</span>' +
        '<span class="vdb-vendor-stat">quoted ' + v.timesUsed + '×' +
        (v.timesWon ? ' · won ' + v.timesWon + '×' : '') + '</span></li>';
    });
    html += '</ul><p class="vdb-hint">From your team\'s saved quotes on this lane — not live market rates.</p>';
    mountBubble(
      'vertex-dream-lane-' + deskKey,
      'Carriers used on this lane',
      html,
      dKey
    );
  }

  function clearInactiveDeskBubbles(activeKey) {
    Object.keys(DESKS).forEach(function (key) {
      if (key !== activeKey) {
        removeBubble('vertex-dream-customer-' + key);
        removeBubble('vertex-dream-lane-' + key);
      }
    });
  }

  function refreshDesk(deskKey) {
    var cfg = DESKS[deskKey];
    var panel = document.querySelector(cfg.panelSel);
    if (!panel || !panel.classList.contains('active')) return;

    var custEl = document.querySelector(cfg.customerSel);
    var customer = custEl ? custEl.value : '';
    var origin = cfg.originSel ? ((document.querySelector(cfg.originSel) || {}).value || '') : '';
    var dest = cfg.destSel ? ((document.querySelector(cfg.destSel) || {}).value || '') : '';

    renderCustomerBubble(deskKey, customer);
    renderLaneBubble(deskKey, origin, dest);
  }

  function refreshAll() {
    var active = activeDeskKey();
    clearInactiveDeskBubbles(active);
    if (active) refreshDesk(active);
    else {
      document.querySelectorAll('.vertex-dream-bubble').forEach(function (el) { el.remove(); });
    }
  }

  function init() {
    refreshAll();
    window.setInterval(refreshAll, 2500);

    if (typeof window.openActiveCalculator === 'function') {
      var orig = window.openActiveCalculator;
      window.openActiveCalculator = function () {
        orig.apply(this, arguments);
        window.setTimeout(refreshAll, 400);
      };
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.refreshVertexSellBand = refreshAll;
})();

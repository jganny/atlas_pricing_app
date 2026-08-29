/**
 * Desk Quick Assist — read-only helpers on operational desks.
 * - Recent quotes for this customer (Recreate as new quote)
 * - Carriers used on this lane (from saved quote history)
 * - Price sanity check vs similar past quotes
 * NEVER writes to inputs or saves quotes automatically.
 */
(function () {
  'use strict';

  var DESKS = {
    air: {
      panel: '#air-freight-panel .desk-pip-panel',
      type: 'air',
      totalSel: '[data-air-grandtotal-mirror]',
      customerSel: '#air-cust-name',
      originSel: '#air-origin',
      destSel: '#air-dest'
    },
    sea: {
      panel: '#sea-freight-panel .desk-pip-panel',
      type: 'sea',
      totalSel: '[data-sea-grandtotal-mirror], #res-sea-grand-total',
      customerSel: '#sea-cust-name',
      originSel: '#sea-origin',
      destSel: '#sea-dest'
    },
    transport: {
      panel: '#transportation-panel .desk-pip-panel',
      type: 'transport',
      totalSel: '[data-mirror-of="res-transport-total"], #res-transport-total',
      customerSel: '#transport-customer-name'
    },
    warehouse: {
      panel: '#warehousing-panel .desk-pip-panel',
      type: 'warehouse',
      typeAlt: 'warehousing',
      totalSel: '[data-mirror-of="res-warehouse-total"], #res-warehouse-total',
      customerSel: '#warehouse-customer-name'
    }
  };

  function getQuotes() {
    if (typeof window.__atlasUi !== 'undefined' && typeof window.__atlasUi.getQuotes === 'function') {
      return window.__atlasUi.getQuotes() || [];
    }
    if (window.appState && window.appState.quotes) return window.appState.quotes;
    return [];
  }

  function parseAmount(text) {
    if (!text) return 0;
    var n = parseFloat(String(text).replace(/[^0-9.\-]/g, ''));
    return isNaN(n) ? 0 : n;
  }

  function formatMoney(amount) {
    if (!amount) return '₹0';
    return '₹' + amount.toLocaleString(undefined, { maximumFractionDigits: 0 });
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

  function matchQuotes(deskKey, currentAmount, customerName) {
    var cfg = DESKS[deskKey];
    var types = quoteTypes(cfg);
    var cust = (customerName || '').toLowerCase().trim();
    var matched = getQuotes().filter(function (q) {
      if (types.indexOf((q.type || '').toLowerCase()) === -1) return false;
      var amt = q.amountINR || q.amount || 0;
      if (!amt || amt <= 0) return false;
      if (cust && q.customer && q.customer.toLowerCase().indexOf(cust) !== -1) return true;
      if (!currentAmount) return true;
      var ratio = amt / currentAmount;
      return ratio >= 0.5 && ratio <= 1.5;
    });
    return matched.slice(0, 40).map(function (q) {
      return q.amountINR || q.amount || 0;
    }).filter(function (a) { return a > 0; });
  }

  function computeBand(amounts) {
    if (!amounts.length) return null;
    amounts.sort(function (a, b) { return a - b; });
    return {
      min: amounts[0],
      max: amounts[amounts.length - 1],
      median: amounts[Math.floor(amounts.length / 2)],
      count: amounts.length
    };
  }

  function insightText(current, band) {
    if (!band || !band.count) {
      return 'Not enough similar saved quotes yet to compare totals.';
    }
    if (!current) {
      return 'Typical sell range for similar quotes: ' + formatMoney(band.min) + ' – ' + formatMoney(band.max) + '.';
    }
    if (current > band.max * 1.08) {
      return 'Your total is above recent similar quotes — worth a quick review before sending.';
    }
    if (current < band.min * 0.92) {
      return 'Your total is below recent similar quotes — check buy rates and minimums.';
    }
    return 'Your total is in line with recent similar quotes for this desk.';
  }

  function ensurePanel(deskKey) {
    var cfg = DESKS[deskKey];
    var host = document.querySelector(cfg.panel);
    if (!host) return null;
    var id = 'vertex-sell-band-' + deskKey;
    var el = document.getElementById(id);
    if (!el) {
      el = document.createElement('div');
      el.id = id;
      el.className = 'vertex-sell-band';
      el.innerHTML =
        '<div class="vsb-header">' +
          '<span class="vsb-eyebrow">Quick assist</span>' +
          '<span class="vsb-badge">Suggestions only</span>' +
        '</div>' +
        '<div class="vsb-section vsb-customer-quotes"></div>' +
        '<div class="vsb-section vsb-lane-vendors"></div>' +
        '<div class="vsb-section vsb-price-check">' +
          '<div class="vsb-section-title">Price check</div>' +
          '<div class="vsb-band-range">—</div>' +
          '<div class="vsb-detail">—</div>' +
        '</div>' +
        '<div class="vsb-foot">Nothing here changes your form or saves a quote. You always review and click Save Quote.</div>';
      host.insertBefore(el, host.firstChild);
    }
    return el;
  }

  function renderCustomerSection(el, deskKey, customer) {
    var box = el.querySelector('.vsb-customer-quotes');
    if (!box) return;
    var recent = customerQuotes(deskKey, customer);
    if (!recent.length) {
      box.innerHTML = '';
      return;
    }
    var html = '<div class="vsb-section-title">Recent quotes for this customer</div><ul class="vsb-quote-list">';
    recent.forEach(function (q) {
      var meta = esc(routeLabel(q));
      var wt = weightLabel(q);
      if (wt) meta += ' · ' + wt;
      if (q.date) meta += ' · ' + esc(String(q.date).split('T')[0]);
      html += '<li><span class="vsb-quote-meta">' + meta + '</span>' +
        '<button type="button" class="vsb-recreate-btn" data-quote-id="' + esc(q.id) + '">Recreate</button></li>';
    });
    html += '</ul><div class="vsb-hint">Recreate copies customer, carriers, and surcharges into a <strong>new</strong> quote — change route, weight, or date, then Save.</div>';
    box.innerHTML = html;
    box.querySelectorAll('.vsb-recreate-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-quote-id');
        if (id && typeof window.recreateQuoteFromExisting === 'function') {
          window.recreateQuoteFromExisting(id);
        }
      });
    });
  }

  function renderVendorSection(el, deskKey, origin, dest) {
    var box = el.querySelector('.vsb-lane-vendors');
    if (!box) return;
    if ((deskKey !== 'air' && deskKey !== 'sea') || !origin.trim() || !dest.trim()) {
      box.innerHTML = '';
      return;
    }
    if (typeof window.getRouteVendorHistory !== 'function') {
      box.innerHTML = '';
      return;
    }
    var hist = window.getRouteVendorHistory(deskKey, origin, dest);
    if (!hist.vendors.length) {
      box.innerHTML = '<div class="vsb-section-title">Carriers on ' + esc(origin) + ' → ' + esc(dest) + '</div>' +
        '<div class="vsb-empty">No saved quotes on this exact lane yet. Your choices will build history over time.</div>';
      return;
    }
    var html = '<div class="vsb-section-title">Carriers used on ' + esc(origin) + ' → ' + esc(dest) +
      ' <span class="vsb-muted">(' + hist.totalQuotes + ' past quote' + (hist.totalQuotes === 1 ? '' : 's') + ')</span></div><ul class="vsb-vendor-list">';
    hist.vendors.slice(0, 6).forEach(function (v) {
      html += '<li><span class="vsb-vendor-name">' + esc(v.name) + '</span>' +
        '<span class="vsb-vendor-stat">quoted ' + v.timesUsed + '×' +
        (v.timesWon ? ' · won ' + v.timesWon + '×' : '') + '</span></li>';
    });
    html += '</ul><div class="vsb-hint">Based on your team\'s saved quotes on this lane — not live market rates.</div>';
    box.innerHTML = html;
  }

  function refreshDesk(deskKey) {
    var cfg = DESKS[deskKey];
    var panel = document.querySelector(cfg.panel.replace('.desk-pip-panel', ''));
    if (!panel || !panel.classList.contains('active')) return;

    var el = ensurePanel(deskKey);
    if (!el) return;

    var totalEl = document.querySelector(cfg.totalSel);
    var custEl = document.querySelector(cfg.customerSel);
    var customer = custEl ? custEl.value : '';
    var origin = cfg.originSel ? ((document.querySelector(cfg.originSel) || {}).value || '') : '';
    var dest = cfg.destSel ? ((document.querySelector(cfg.destSel) || {}).value || '') : '';

    renderCustomerSection(el, deskKey, customer);
    renderVendorSection(el, deskKey, origin, dest);

    var current = parseAmount(totalEl ? totalEl.textContent : '');
    var band = computeBand(matchQuotes(deskKey, current, customer));
    var rangeEl = el.querySelector('.vsb-band-range');
    var detailEl = el.querySelector('.vsb-detail');
    if (band && band.count) {
      rangeEl.textContent = formatMoney(band.min) + ' – ' + formatMoney(band.max) +
        ' · median ' + formatMoney(band.median) + ' (' + band.count + ' quotes)';
    } else {
      rangeEl.textContent = 'Building comparison range…';
    }
    var currentLine = current ? ('Desk total now: ' + formatMoney(current) + '. ') : '';
    detailEl.textContent = currentLine + insightText(current, band);
  }

  function refreshAll() {
    Object.keys(DESKS).forEach(refreshDesk);
  }

  function init() {
    refreshAll();
    window.setInterval(refreshAll, 2500);

    if (typeof window.openActiveCalculator === 'function') {
      var orig = window.openActiveCalculator;
      window.openActiveCalculator = function (type) {
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

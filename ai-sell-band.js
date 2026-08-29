/**
 * Vertex AI Sell Band — read-only pricing insights on operational desks.
 * Compares current desk total to similar historical quotes.
 * NEVER writes to inputs, appState quotes, or triggers save.
 */
(function () {
  'use strict';

  var DESKS = {
    air: {
      panel: '#air-freight-panel .desk-pip-panel',
      type: 'air',
      totalSel: '[data-air-grandtotal-mirror]',
      customerSel: '#air-cust-name'
    },
    sea: {
      panel: '#sea-freight-panel .desk-pip-panel',
      type: 'sea',
      totalSel: '[data-sea-grandtotal-mirror], #res-sea-grand-total',
      customerSel: '#sea-cust-name'
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

  function formatMoney(amount, currency) {
    var sym = currency === 'INR' ? '₹' : (currency === 'USD' ? '$' : (currency === 'EUR' ? '€' : '₹'));
    if (!amount) return sym + '0';
    return sym + amount.toLocaleString(undefined, { maximumFractionDigits: 0 });
  }

  function matchQuotes(deskKey, currentAmount, customerName) {
    var cfg = DESKS[deskKey];
    var quotes = getQuotes();
    var types = [cfg.type];
    if (cfg.typeAlt) types.push(cfg.typeAlt);
    var cust = (customerName || '').toLowerCase().trim();

    var matched = quotes.filter(function (q) {
      if (types.indexOf((q.type || '').toLowerCase()) === -1) return false;
      var amt = q.amountINR || q.amount || 0;
      if (!amt || amt <= 0) return false;
      if (cust && q.customer && q.customer.toLowerCase().indexOf(cust) !== -1) return true;
      if (!currentAmount) return true;
      var ratio = amt / currentAmount;
      return ratio >= 0.5 && ratio <= 1.5;
    });

    if (matched.length < 2 && cust) {
      matched = quotes.filter(function (q) {
        return types.indexOf((q.type || '').toLowerCase()) !== -1 && (q.amountINR || q.amount) > 0;
      });
    }

    return matched.slice(0, 40).map(function (q) {
      return q.amountINR || q.amount || 0;
    }).filter(function (a) { return a > 0; });
  }

  function computeBand(amounts) {
    if (!amounts.length) return null;
    amounts.sort(function (a, b) { return a - b; });
    var min = amounts[0];
    var max = amounts[amounts.length - 1];
    var mid = amounts[Math.floor(amounts.length / 2)];
    var avg = amounts.reduce(function (s, v) { return s + v; }, 0) / amounts.length;
    return { min: min, max: max, median: mid, avg: avg, count: amounts.length };
  }

  function insightText(current, band) {
    if (!band || !band.count) {
      return 'Not enough similar saved quotes yet. Complete and save quotes to build your reference band.';
    }
    if (!current) {
      return 'Based on ' + band.count + ' similar quotes: typical sell band ' +
        formatMoney(band.min) + ' – ' + formatMoney(band.max) + ' (median ' + formatMoney(band.median) + ').';
    }
    if (current > band.max * 1.08) {
      return 'Current total is above recent similar quotes. Review surcharges or confirm premium service with the customer.';
    }
    if (current < band.min * 0.92) {
      return 'Current total is below your recent band — double-check buy rates and minimum charges before sending.';
    }
    return 'Current total sits within your recent sell band for this desk type. Good alignment with historical quotes.';
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
          '<span class="vsb-eyebrow">Vertex AI Insight</span>' +
          '<span class="vsb-badge">Read-only</span>' +
        '</div>' +
        '<div class="vsb-band-range">—</div>' +
        '<div class="vsb-detail">Analyzing similar quotes…</div>' +
        '<div class="vsb-foot">Suggestions never change rates or save quotes. You always confirm Save Quote.</div>';
      host.insertBefore(el, host.firstChild);
    }
    return el;
  }

  function refreshDesk(deskKey) {
    var cfg = DESKS[deskKey];
    var panel = document.querySelector(cfg.panel.replace('.desk-pip-panel', ''));
    if (!panel || !panel.classList.contains('active')) return;

    var el = ensurePanel(deskKey);
    if (!el) return;

    var totalEl = document.querySelector(cfg.totalSel);
    var custEl = document.querySelector(cfg.customerSel);
    var current = parseAmount(totalEl ? totalEl.textContent : '');
    var customer = custEl ? custEl.value : '';
    var amounts = matchQuotes(deskKey, current, customer);
    var band = computeBand(amounts);

    var rangeEl = el.querySelector('.vsb-band-range');
    var detailEl = el.querySelector('.vsb-detail');

    if (band && band.count) {
      rangeEl.textContent = formatMoney(band.min) + ' – ' + formatMoney(band.max) +
        ' · median ' + formatMoney(band.median) + ' (' + band.count + ' quotes)';
    } else {
      rangeEl.textContent = 'Building reference band…';
    }

    var currentLine = current ? ('Your desk now: ' + formatMoney(current) + '. ') : '';
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

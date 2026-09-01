/**
 * Atlas Courier Desk — express parcel quoting (DHL / FedEx / UPS patterns).
 * UI + calculation only; persists via DB.saveQuote (same quotes collection).
 */
(function () {
  'use strict';

  var DIM_DIVISOR_CM = 5000;
  var DIM_DIVISOR_IN = 139;

  var DEFAULT_COURIER_TERMS =
    '1. Rates are based on chargeable weight (max of actual vs volumetric per piece).\n' +
    '2. Volumetric weight (cm): L × W × H ÷ 5000 × quantity per piece.\n' +
    '3. Fuel surcharge, remote area, residential, oversized and insurance are additional unless stated.\n' +
    '4. Transit times are estimates only — not guaranteed unless express service is confirmed in writing.\n' +
    '5. Customs duties, taxes and brokerage are receiver\'s account unless DDP is quoted.\n' +
    '6. Dangerous goods, lithium batteries and restricted commodities require prior approval.\n' +
    '7. Claims subject to carrier terms; insurance as declared value basis only.';

  var SERVICE_LEVELS = {
    express: { label: 'Express (T+1–2)', factor: 1.35, transit: '1–2 business days' },
    economy: { label: 'Economy (T+3–5)', factor: 1.0, transit: '3–5 business days' },
    same_day: { label: 'Same Day (domestic)', factor: 1.85, transit: 'Same day cut-off 14:00' },
    document: { label: 'Document Express', factor: 0.72, transit: '1–3 business days' }
  };

  var CARRIERS = [
    { id: 'dhl', name: 'DHL Express', color: '#FFCC00', textColor: '#C8102E' },
    { id: 'fedex', name: 'FedEx International', color: '#4D148C', textColor: '#fff' },
    { id: 'ups', name: 'UPS Worldwide', color: '#351C15', textColor: '#FFB500' },
    { id: 'aramex', name: 'Aramex', color: '#E31937', textColor: '#fff' },
    { id: 'bluedart', name: 'Blue Dart', color: '#003DA5', textColor: '#fff' },
    { id: 'dtdc', name: 'DTDC', color: '#ED1C24', textColor: '#fff' }
  ];

  /* Zone matrix simplified from global express lane groupings */
  var ZONE_TABLE = {
    IN: { IN: 1, AE: 2, SG: 3, GB: 4, US: 5, DE: 4, AU: 5, CN: 3, HK: 3, default: 6 },
    AE: { IN: 2, AE: 1, GB: 3, US: 4, DE: 3, SG: 3, default: 5 },
    US: { US: 1, CA: 2, GB: 3, DE: 3, IN: 5, AE: 4, default: 6 },
    GB: { GB: 1, DE: 2, FR: 2, US: 3, IN: 4, AE: 3, default: 5 },
    default: { default: 5 }
  };

  /* Base USD per kg by zone (economy); breaks reduce $/kg */
  var ZONE_RATES = {
    1: { min: 8, breaks: [{ w: 0.5, r: 18 }, { w: 5, r: 12 }, { w: 30, r: 8.5 }, { w: 100, r: 6.2 }, { w: 9999, r: 5.1 }] },
    2: { min: 12, breaks: [{ w: 0.5, r: 22 }, { w: 5, r: 14 }, { w: 30, r: 9.8 }, { w: 100, r: 7.1 }, { w: 9999, r: 5.8 }] },
    3: { min: 15, breaks: [{ w: 0.5, r: 26 }, { w: 5, r: 16 }, { w: 30, r: 11 }, { w: 100, r: 8.2 }, { w: 9999, r: 6.5 }] },
    4: { min: 18, breaks: [{ w: 0.5, r: 32 }, { w: 5, r: 19 }, { w: 30, r: 13 }, { w: 100, r: 9.5 }, { w: 9999, r: 7.2 }] },
    5: { min: 22, breaks: [{ w: 0.5, r: 38 }, { w: 5, r: 22 }, { w: 30, r: 15 }, { w: 100, r: 11 }, { w: 9999, r: 8.4 }] },
    6: { min: 28, breaks: [{ w: 0.5, r: 45 }, { w: 5, r: 26 }, { w: 30, r: 18 }, { w: 100, r: 13 }, { w: 9999, r: 9.8 }] }
  };

  var CARRIER_FACTORS = { dhl: 1.05, fedex: 1.08, ups: 1.06, aramex: 0.92, bluedart: 0.78, dtdc: 0.72 };

  function $(id) { return document.getElementById(id); }
  function fmt(n, cur) {
    var sym = { INR: '₹', USD: '$', EUR: '€', GBP: '£', AED: 'د.إ', SGD: 'S$', AUD: 'A$', CNY: '¥' };
    return (sym[cur] || cur + ' ') + (n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function roundChargeableKg(w) {
    if (w <= 0) return 0;
    return Math.ceil(w * 2) / 2;
  }

  function getZone(originCountry, destCountry) {
    var o = (originCountry || 'IN').toUpperCase().slice(0, 2);
    var d = (destCountry || 'IN').toUpperCase().slice(0, 2);
    var row = ZONE_TABLE[o] || ZONE_TABLE.default;
    return row[d] || row.default || 6;
  }

  function getRatePerKg(chargeableKg, zone) {
    var z = ZONE_RATES[zone] || ZONE_RATES[6];
    var rate = z.breaks[z.breaks.length - 1].r;
    for (var i = 0; i < z.breaks.length; i++) {
      if (chargeableKg <= z.breaks[i].w) { rate = z.breaks[i].r; break; }
    }
    return { ratePerKg: rate, minCharge: z.min };
  }

  function readPackages() {
    var rows = [];
    var tbody = $('courier-packages-body');
    if (!tbody) return rows;
    var dimUnit = $('courier-dim-unit')?.value || 'cm';
    var divisor = dimUnit === 'in' ? DIM_DIVISOR_IN : DIM_DIVISOR_CM;
    tbody.querySelectorAll('tr').forEach(function (tr) {
      var qty = parseFloat(tr.querySelector('.cour-qty')?.value) || 1;
      var gw = parseFloat(tr.querySelector('.cour-gw')?.value) || 0;
      var l = parseFloat(tr.querySelector('.cour-l')?.value) || 0;
      var w = parseFloat(tr.querySelector('.cour-w')?.value) || 0;
      var h = parseFloat(tr.querySelector('.cour-h')?.value) || 0;
      var volPerPiece = (l * w * h) / divisor;
      var chargeablePerPiece = Math.max(gw, volPerPiece);
      var lineChargeable = roundChargeableKg(chargeablePerPiece) * qty;
      rows.push({ qty: qty, gw: gw, l: l, w: w, h: h, volPerPiece: volPerPiece, chargeable: lineChargeable });
    });
    return rows;
  }

  function sumChargeable(packages) {
    var total = 0;
    packages.forEach(function (p) { total += p.chargeable; });
    return roundChargeableKg(total);
  }

  function readSurcharges(baseFreight) {
    var fuelPct = parseFloat($('courier-fuel-pct')?.value) || 0;
    var remote = $('courier-remote')?.checked ? (parseFloat($('courier-remote-amt')?.value) || 0) : 0;
    var residential = $('courier-residential')?.checked ? (parseFloat($('courier-residential-amt')?.value) || 0) : 0;
    var saturday = $('courier-saturday')?.checked ? (parseFloat($('courier-saturday-amt')?.value) || 0) : 0;
    var dg = $('courier-dg')?.checked ? (parseFloat($('courier-dg-amt')?.value) || 0) : 0;
    var declared = parseFloat($('courier-declared-value')?.value) || 0;
    var insurancePct = parseFloat($('courier-insurance-pct')?.value) || 1.5;
    var insurance = $('courier-insurance')?.checked ? Math.max(declared * insurancePct / 100, 25) : 0;
    var oversized = $('courier-oversized-flag')?.value === '1' ? (parseFloat($('courier-oversized-amt')?.value) || 0) : 0;
    var fuel = baseFreight * fuelPct / 100;
    var marginPct = parseFloat($('courier-margin-pct')?.value) || 0;
    return { fuel: fuel, fuelPct: fuelPct, remote: remote, residential: residential, saturday: saturday, dg: dg, insurance: insurance, oversized: oversized, marginPct: marginPct, declared: declared };
  }

  function convertFromUsd(amountUsd, currency) {
    var rates = window.EXCHANGE_RATES || {};
    if (currency === 'USD') return amountUsd;
    if (currency === 'INR') return amountUsd * (rates.USD_TO_INR || 83);
    if (currency === 'EUR') return amountUsd / (rates.EUR_TO_USD || 1.08);
    if (currency === 'GBP') return amountUsd / (rates.GBP_TO_USD || 1.25);
    if (currency === 'AED') return amountUsd / (rates.USD_TO_AED || 0.27);
    if (currency === 'SGD') return amountUsd / (rates.USD_TO_SGD || 0.74);
    if (currency === 'AUD') return amountUsd / (rates.USD_TO_AUD || 0.65);
    if (currency === 'CNY') return amountUsd / (rates.USD_TO_CNY || 0.14);
    return amountUsd * (rates.USD_TO_INR || 83);
  }

  function buildCarrierQuotes(chargeableKg, zone, serviceKey, currency) {
    var svc = SERVICE_LEVELS[serviceKey] || SERVICE_LEVELS.economy;
    var isDoc = serviceKey === 'document';
    var rateInfo = getRatePerKg(isDoc ? Math.max(chargeableKg, 0.5) : chargeableKg, zone);
    var quotes = [];
    CARRIERS.forEach(function (c) {
      var factor = (CARRIER_FACTORS[c.id] || 1) * svc.factor;
      var baseUsd = isDoc
        ? Math.max(rateInfo.minCharge * factor, rateInfo.ratePerKg * factor * 0.5)
        : Math.max(rateInfo.minCharge * factor, rateInfo.ratePerKg * factor * chargeableKg);
      var sellUsd = baseUsd * (1 + (parseFloat($('courier-margin-pct')?.value) || 0) / 100);
      var buyUsd = baseUsd;
      quotes.push({
        id: c.id,
        name: c.name,
        color: c.color,
        buyUsd: buyUsd,
        sellUsd: sellUsd,
        buyLocal: convertFromUsd(buyUsd, currency),
        sellLocal: convertFromUsd(sellUsd, currency),
        ratePerKg: rateInfo.ratePerKg * factor,
        transit: svc.transit
      });
    });
    quotes.sort(function (a, b) { return a.sellLocal - b.sellLocal; });
    return quotes;
  }

  function renderCarrierGrid(quotes, selectedId) {
    var grid = $('courier-carrier-grid');
    if (!grid) return;
    grid.innerHTML = quotes.map(function (q, idx) {
      var sel = (selectedId || quotes[0].id) === q.id;
      return '<button type="button" class="courier-carrier-card' + (sel ? ' is-selected' : '') + '" data-carrier="' + q.id + '" onclick="selectCourierCarrier(\'' + q.id + '\')">' +
        '<span class="courier-carrier-rank">#' + (idx + 1) + '</span>' +
        '<span class="courier-carrier-name" style="color:' + q.color + '">' + q.name + '</span>' +
        '<span class="courier-carrier-price">' + fmt(q.sellLocal, $('courier-header-currency')?.value || 'INR') + '</span>' +
        '<span class="courier-carrier-meta">' + q.transit + ' · $' + q.ratePerKg.toFixed(2) + '/kg</span>' +
        '</button>';
    }).join('');
  }

  function calculateCourier() {
    var packages = readPackages();
    var chargeableKg = sumChargeable(packages);
    var tbody = $('courier-packages-body');
    if (tbody) {
      var rows = tbody.querySelectorAll('tr');
      packages.forEach(function (p, i) {
        if (rows[i]) {
          var cell = rows[i].querySelector('.cour-chw-cell');
          if (cell) cell.textContent = p.chargeable.toFixed(2) + ' kg';
        }
      });
    }
    var origin = ($('courier-origin-country')?.value || 'IN').toUpperCase();
    var dest = ($('courier-dest-country')?.value || 'IN').toUpperCase();
    var zone = getZone(origin, dest);
    var service = $('courier-service')?.value || 'economy';
    var currency = $('courier-header-currency')?.value || 'INR';
    var scope = $('courier-scope')?.value || 'domestic';
    if ($('courier-currency')) $('courier-currency').value = currency;

    var quotes = buildCarrierQuotes(chargeableKg, zone, service, currency);
    var selected = $('courier-selected-carrier')?.value || (quotes[0] && quotes[0].id);
    var chosen = quotes.find(function (q) { return q.id === selected; }) || quotes[0];
    renderCarrierGrid(quotes, selected);

    var baseFreight = chosen ? chosen.sellLocal : 0;
    var buyFreight = chosen ? chosen.buyLocal : 0;
    var sur = readSurcharges(baseFreight);
    var surTotal = sur.fuel + sur.remote + sur.residential + sur.saturday + sur.dg + sur.insurance + sur.oversized;
    var subtotal = baseFreight + surTotal;
    var gstOn = $('courier-gst-enabled')?.checked !== false;
    var tax = gstOn ? subtotal * 0.18 : 0;
    var total = subtotal + tax;
    var grossProfit = (chosen ? chosen.sellLocal - chosen.buyLocal : 0) + sur.fuel * (sur.marginPct / 100);

    if ($('res-courier-chw')) $('res-courier-chw').textContent = chargeableKg.toFixed(2) + ' kg';
    if ($('res-courier-zone')) $('res-courier-zone').textContent = 'Zone ' + zone + (scope === 'domestic' ? ' · Domestic' : ' · International');
    if ($('res-courier-pieces')) $('res-courier-pieces').textContent = packages.reduce(function (s, p) { return s + p.qty; }, 0);
    if ($('res-courier-carrier')) $('res-courier-carrier').textContent = chosen ? chosen.name : '—';
    if ($('res-courier-transit')) $('res-courier-transit').textContent = chosen ? chosen.transit : '—';
    if ($('res-courier-base')) $('res-courier-base').textContent = fmt(baseFreight, currency);
    if ($('res-courier-surcharges')) $('res-courier-surcharges').textContent = fmt(surTotal, currency);
    if ($('res-courier-subtotal')) $('res-courier-subtotal').textContent = fmt(subtotal, currency);
    if ($('res-courier-tax')) $('res-courier-tax').textContent = fmt(tax, currency);
    if ($('res-courier-total')) $('res-courier-total').textContent = fmt(total, currency);

    var oversized = packages.some(function (p) {
      return Math.max(p.l, p.w, p.h) > 120 || (p.l + p.w + p.h) > 300;
    });
    if ($('courier-oversized-flag')) $('courier-oversized-flag').value = oversized ? '1' : '0';
    var flag = $('courier-oversized-warn');
    if (flag) flag.style.display = oversized ? 'block' : 'none';

    window._courierCalcState = {
      packages: packages, chargeableKg: chargeableKg, zone: zone, service: service,
      currency: currency, chosen: chosen, quotes: quotes, surcharges: sur,
      subtotal: subtotal, tax: tax, total: total, buyFreight: buyFreight, baseFreight: baseFreight, grossProfit: grossProfit
    };
  }

  function addCourierPackageRow(data) {
    var tbody = $('courier-packages-body');
    if (!tbody) return;
    var d = data || {};
    var tr = document.createElement('tr');
    tr.innerHTML =
      '<td><input type="number" class="cour-qty" min="1" step="1" value="' + (d.qty || 1) + '" oninput="calculateCourier()"></td>' +
      '<td><input type="number" class="cour-gw" min="0" step="0.1" value="' + (d.gw || '') + '" placeholder="kg" oninput="calculateCourier()"></td>' +
      '<td><input type="number" class="cour-l" min="0" step="0.1" value="' + (d.l || '') + '" placeholder="L" oninput="calculateCourier()"></td>' +
      '<td><input type="number" class="cour-w" min="0" step="0.1" value="' + (d.w || '') + '" placeholder="W" oninput="calculateCourier()"></td>' +
      '<td><input type="number" class="cour-h" min="0" step="0.1" value="' + (d.h || '') + '" placeholder="H" oninput="calculateCourier()"></td>' +
      '<td class="cour-chw-cell">—</td>' +
      '<td style="text-align:center"><button type="button" class="delete-btn" onclick="removeCourierPackageRow(this)" style="padding:4px 8px;font-size:0.72rem">×</button></td>';
    tbody.appendChild(tr);
    calculateCourier();
  }

  function removeCourierPackageRow(btn) {
    btn.closest('tr').remove();
    calculateCourier();
  }

  function selectCourierCarrier(id) {
    if ($('courier-selected-carrier')) $('courier-selected-carrier').value = id;
    calculateCourier();
  }

  function syncCourierCurrency() {
    var h = $('courier-header-currency');
    var t = $('courier-currency');
    if (h && t) { t.value = h.value; calculateCourier(); }
  }

  function initCourierDesk() {
    var tbody = $('courier-packages-body');
    if (tbody && !tbody.children.length) {
      addCourierPackageRow({ qty: 1 });
    }
    var terms = $('courier-terms');
    if (terms && !terms.value.trim()) terms.value = DEFAULT_COURIER_TERMS;
    calculateCourier();
  }

  async function saveCourierQuote() {
    calculateCourier();
    var st = window._courierCalcState;
    if (!st || !st.packages.length) {
      alert('❌ Add at least one package row.');
      return;
    }
    var customer = ($('courier-customer-name')?.value || '').trim();
    if (!customer) {
      customer = prompt('Customer name for this courier quote:', 'Walk-in Customer');
      if (!customer) return;
    }
    var originCity = ($('courier-origin-city')?.value || '').trim();
    var destCity = ($('courier-dest-city')?.value || '').trim();
    var originPin = ($('courier-origin-pin')?.value || '').trim();
    var destPin = ($('courier-dest-pin')?.value || '').trim();
    var route = (originCity || originPin || st.packages[0] ? 'Origin' : '?') + ' → ' + (destCity || destPin || '?');

    var rateInr = typeof window.convertToInr === 'function'
      ? window.convertToInr(st.total, st.currency)
      : st.total;

    var quoteData = {
      id: 'Q' + Math.random().toString(36).substr(2, 9),
      date: new Date().toISOString().split('T')[0],
      customer: customer,
      creator: (window.appState && window.appState.currentUser) || 'user',
      status: 'quoted',
      quoteNumber: (window.appState && window.appState.quotes ? window.appState.quotes.length : 0) + 1,
      mode: 'Courier',
      type: 'courier',
      amount: st.total,
      currency: st.currency,
      amountINR: rateInr,
      grossProfit: st.grossProfit || 0,
      grossProfitCurrency: st.currency,
      grossProfitINR: typeof window.convertToInr === 'function' ? window.convertToInr(st.grossProfit || 0, st.currency) : 0,
      route: route,
      routingDetails: route,
      details: {
        mode: 'Courier',
        type: 'courier',
        module: 'courier',
        routing: route,
        originCity: originCity,
        destCity: destCity,
        originPin: originPin,
        destPin: destPin,
        originCountry: $('courier-origin-country')?.value,
        destCountry: $('courier-dest-country')?.value,
        scope: $('courier-scope')?.value,
        service: st.service,
        shipmentType: $('courier-shipment-type')?.value,
        chargeableWeight: st.chargeableKg,
        zone: st.zone,
        carrier: st.chosen ? st.chosen.id : '',
        carrierName: st.chosen ? st.chosen.name : '',
        transit: st.chosen ? st.chosen.transit : '',
        packages: st.packages,
        carrierQuotes: st.quotes,
        surcharges: st.surcharges,
        baseFreight: st.baseFreight,
        buyFreight: st.buyFreight,
        subtotal: st.subtotal,
        gstEnabled: $('courier-gst-enabled')?.checked !== false,
        gstRate: $('courier-gst-enabled')?.checked !== false ? 18 : 0,
        gstAmount: st.tax,
        marginPct: parseFloat($('courier-margin-pct')?.value) || 0,
        declaredValue: st.surcharges.declared,
        termsAndConditions: ($('courier-terms')?.value || '').trim() || DEFAULT_COURIER_TERMS
      },
      notes: 'Courier quote. CHW: ' + st.chargeableKg + ' kg, Zone ' + st.zone + ', ' + (st.chosen ? st.chosen.name : '')
    };

    if (window.appState && window.appState.editingQuoteId) {
      var existingIndex = window.appState.quotes.findIndex(function (q) { return q.id === window.appState.editingQuoteId; });
      if (existingIndex !== -1) {
        var original = window.appState.quotes[existingIndex];
        quoteData = Object.assign({}, original, quoteData);
        quoteData.id = original.id;
        quoteData.status = original.status || 'quoted';
        quoteData.creator = original.creator;
        window.appState.editingQuoteId = null;
      }
    }

    if (window.DB && window.DB.saveQuote) {
      var saved = await window.DB.saveQuote(quoteData);
      if (!saved) return;
      alert('Courier quotation saved successfully!');
      if (typeof window.saveCustomCustomer === 'function') window.saveCustomCustomer(customer);
      if (typeof window.showMyQuotationLogs === 'function') window.showMyQuotationLogs();
    }
  }

  function loadCourierFromQuote(quote) {
    if (!quote || quote.type !== 'courier') return;
    var d = quote.details || {};
    if ($('courier-customer-name')) $('courier-customer-name').value = quote.customer || '';
    if ($('courier-origin-city')) $('courier-origin-city').value = d.originCity || '';
    if ($('courier-dest-city')) $('courier-dest-city').value = d.destCity || '';
    if ($('courier-origin-pin')) $('courier-origin-pin').value = d.originPin || '';
    if ($('courier-dest-pin')) $('courier-dest-pin').value = d.destPin || '';
    if ($('courier-origin-country')) $('courier-origin-country').value = d.originCountry || 'IN';
    if ($('courier-dest-country')) $('courier-dest-country').value = d.destCountry || 'IN';
    if ($('courier-scope')) $('courier-scope').value = d.scope || 'domestic';
    if ($('courier-service')) $('courier-service').value = d.service || 'economy';
    if ($('courier-shipment-type')) $('courier-shipment-type').value = d.shipmentType || 'parcel';
    if ($('courier-selected-carrier')) $('courier-selected-carrier').value = d.carrier || 'dhl';
    if ($('courier-margin-pct')) $('courier-margin-pct').value = d.marginPct || 12;
    if ($('courier-header-currency')) $('courier-header-currency').value = quote.currency || 'INR';
    if ($('courier-terms')) $('courier-terms').value = d.termsAndConditions || DEFAULT_COURIER_TERMS;
    var tbody = $('courier-packages-body');
    if (tbody) {
      tbody.innerHTML = '';
      (d.packages || [{ qty: 1 }]).forEach(function (p) { addCourierPackageRow(p); });
    }
    calculateCourier();
  }

  window.DEFAULT_COURIER_TERMS = DEFAULT_COURIER_TERMS;
  window.calculateCourier = calculateCourier;
  window.addCourierPackageRow = addCourierPackageRow;
  window.removeCourierPackageRow = removeCourierPackageRow;
  window.selectCourierCarrier = selectCourierCarrier;
  window.syncCourierCurrency = syncCourierCurrency;
  window.initCourierDesk = initCourierDesk;
  window.saveCourierQuote = saveCourierQuote;
  window.loadCourierFromQuote = loadCourierFromQuote;
})();

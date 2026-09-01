/**
 * Atlas Smart Quote — single orchestrator for minimal-touch air quoting.
 * Paste enquiry → auto POL/POD/cargo/carrier → tariff apply → draft ready.
 */
(function () {
  'use strict';

  var AIRLINE_HINTS = {
    EK: 'EK - Emirates', QR: 'QR - Qatar Airways', GF: 'GF - Gulf Air',
    AI: 'AI - Air India', '6E': '6E - IndiGo', BA: 'BA - British Airways',
    LH: 'LH - Lufthansa', SQ: 'SQ - Singapore Airlines', CX: 'CX - Cathay Pacific',
    TK: 'TK - Turkish Airlines', EY: 'EY - Etihad Airways', KL: 'KL - KLM',
    AF: 'AF - Air France', UA: 'UA - United Airlines', FX: 'FX - FedEx (air)'
  };

  function $(id) { return document.getElementById(id); }

  function setStatus(msg, level) {
    var el = $('atlas-smart-quote-status');
    if (!el) return;
    el.className = 'atlas-smart-quote-status atlas-sq-' + (level || 'info');
    el.textContent = msg;
    el.style.display = msg ? 'block' : 'none';
  }

  function parseEnquiryText(text) {
    var t = (text || '').replace(/\r/g, '');
    var result = { customer: '', origin: '', destination: '', airline: '', airlineLabel: '', packages: [], pivotWeight: 0, raw: t };

    var custMatch = t.match(/(?:customer|client|shipper|consignee|for)[:\s]+([^\n,;]+)/i);
    if (custMatch) result.customer = custMatch[1].trim();
    else {
      var firstLine = t.split('\n').map(function (l) { return l.trim(); }).find(function (l) {
        return l.length > 3 && !/^(hi|dear|hello|thanks|regards)/i.test(l);
      });
      if (firstLine && /(ltd|pvt|inc|llc|corp|trading|logistics)/i.test(firstLine)) result.customer = firstLine;
    }

    var routePatterns = [
      /([A-Z]{3})\s*(?:to|→|->|-|–)\s*([A-Z]{3})/i,
      /(?:pol|origin|from)[:\s]+([A-Z]{3}).*?(?:pod|dest|destination|to)[:\s]+([A-Z]{3})/is,
      /\b([A-Z]{3})\b[^A-Z]{0,40}\b([A-Z]{3})\b/
    ];
    for (var i = 0; i < routePatterns.length; i++) {
      var m = t.match(routePatterns[i]);
      if (m) { result.origin = m[1].toUpperCase(); result.destination = m[2].toUpperCase(); break; }
    }

    var gwMatch = t.match(/(?:gross|actual|total)?\s*weight[:\s]*(\d+(?:\.\d+)?)\s*(?:kg|kgs)?/i) ||
      t.match(/(\d+(?:\.\d+)?)\s*(?:kg|kgs|kilos?)\s*(?:gross|actual)?/i);
    var gw = gwMatch ? parseFloat(gwMatch[1]) : 0;

    var dimMatch = t.match(/(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)/i);
    var qtyMatch = t.match(/(\d+)\s*(?:pcs|pieces|pkgs|packages|cartons)/i);
    var qty = qtyMatch ? parseInt(qtyMatch[1], 10) : 1;

    if (dimMatch || gw) {
      result.packages.push({
        qty: qty,
        gw: gw || 0,
        l: dimMatch ? parseFloat(dimMatch[1]) : 0,
        w: dimMatch ? parseFloat(dimMatch[2]) : 0,
        h: dimMatch ? parseFloat(dimMatch[3]) : 0
      });
    }

    var pivotM = t.match(/pivot[:\s]*(\d+(?:\.\d+)?)/i);
    if (pivotM) result.pivotWeight = parseFloat(pivotM[1]);

    var codeM = t.match(/\b([A-Z0-9]{2})\s*[-–]\s*([A-Za-z][A-Za-z\s]{2,30})/);
    if (codeM) {
      result.airline = codeM[1].toUpperCase();
      result.airlineLabel = codeM[1].toUpperCase() + ' - ' + codeM[2].trim();
    } else {
      Object.keys(AIRLINE_HINTS).forEach(function (code) {
        if (result.airline) return;
        var re = new RegExp('\\b' + code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b|'
          + AIRLINE_HINTS[code].split(' - ')[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        if (re.test(t)) {
          result.airline = code;
          result.airlineLabel = AIRLINE_HINTS[code];
        }
      });
    }

    return result;
  }

  function setAirportField(id, code) {
    var el = $(id);
    if (!el || !code) return;
    el.value = code;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function fillCargoRow(pkg) {
    var tbody = $('air-cargo-body');
    if (!tbody) return;
    if (!tbody.querySelector('.cargo-item-row')) {
      var addBtn = $('air-add-cargo');
      if (addBtn) addBtn.click();
    }
    var row = tbody.querySelector('.cargo-item-row');
    if (!row) return;
    if (pkg.l) row.querySelector('.cargo-len').value = pkg.l;
    if (pkg.w) row.querySelector('.cargo-wid').value = pkg.w;
    if (pkg.h) row.querySelector('.cargo-hei').value = pkg.h;
    if (pkg.qty) row.querySelector('.cargo-qty').value = pkg.qty;
    if (pkg.gw) row.querySelector('.cargo-gw').value = pkg.gw;
  }

  function suggestCarrier(origin, dest) {
    if (typeof window.getRouteVendorHistory === 'function') {
      var hist = window.getRouteVendorHistory('air', origin, dest);
      if (hist.vendors && hist.vendors.length) {
        return { code: hist.vendors[0].name.split(' ')[0], label: hist.vendors[0].name, source: 'history' };
      }
    }
    return null;
  }

  async function runAtlasSmartQuote() {
    setStatus('Analysing enquiry…', 'info');
    var text = ($('atlas-enquiry-paste') && $('atlas-enquiry-paste').value) || '';
    var fileInput = $('atlas-enquiry-file');
    var file = fileInput && fileInput.files[0];

    if (file && window.AtlasTariffEngine) {
      try {
        var imp = await window.AtlasTariffEngine.importTariffFile(file, {});
        if (imp.count > 0) setStatus(imp.message, 'ok');
      } catch (e) { /* continue with quote */ }
    }

    if (!text.trim() && file && file.name.match(/\.(txt|eml)$/i)) {
      text = await file.text();
    }

    if (!text.trim()) {
      setStatus('Paste a customer enquiry above, or attach a rate sheet (.xlsx) with the enquiry.', 'warn');
      return;
    }

    var parsed = parseEnquiryText(text);
    if (!parsed.origin || !parsed.destination) {
      setStatus('Could not detect POL/POD airport codes. Add BLR, LHR etc. in the enquiry text.', 'warn');
      return;
    }

    if (typeof window.openActiveCalculator === 'function') window.openActiveCalculator('air');

    if (parsed.customer && $('air-cust-name')) $('air-cust-name').value = parsed.customer;
    setAirportField('air-origin', parsed.origin);
    setAirportField('air-dest', parsed.destination);

    if (parsed.packages.length) fillCargoRow(parsed.packages[0]);

    var carrier = parsed.airline ? { code: parsed.airline, label: parsed.airlineLabel, source: 'enquiry' } : suggestCarrier(parsed.origin, parsed.destination);
    if (!carrier && parsed.airlineLabel) carrier = { label: parsed.airlineLabel, source: 'enquiry' };

    await window.AtlasTariffEngine.loadTariffs();
    var tariff = window.AtlasTariffEngine.lookupTariff(parsed.origin, parsed.destination, carrier && carrier.code);

    var container = $('air-airlines-list-container');
    if (container) container.innerHTML = '';

    if (typeof window.addAirlineCard === 'function') {
      window.addAirlineCard({
        name: carrier ? carrier.label : '',
        pivotWeight: parsed.pivotWeight || '',
        breaks: tariff ? tariff.breaks : {},
        selected: true
      });
    }

    if (tariff) {
      window.AtlasTariffEngine.applyTariffToAirDesk(tariff, carrier ? carrier.label : tariff.carrier);
    }

    if (typeof window.calculateAirFreight === 'function') window.calculateAirFreight();

    if (typeof window.advanceDeskStep === 'function') window.advanceDeskStep('air-freight-panel', tariff ? 'terms' : 'carrier');

    var parts = [
      '✓ Smart draft ready',
      parsed.origin + ' → ' + parsed.destination
    ];
    if (parsed.packages[0] && parsed.packages[0].gw) parts.push(parsed.packages[0].gw + ' kg');
    if (carrier) parts.push(carrier.label + ' (' + carrier.source + ')');
    if (tariff) parts.push('tariff applied');
    else parts.push('no published tariff — add rates or upload .xlsx sheet');
    setStatus(parts.join(' · '), tariff ? 'ok' : 'warn');
  }

  function initSmartQuoteShell() {
    var terms = $('atlas-enquiry-paste');
    if (terms && !terms.dataset.bound) {
      terms.dataset.bound = '1';
      terms.addEventListener('keydown', function (e) {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') runAtlasSmartQuote();
      });
    }
  }

  window.parseEnquiryText = parseEnquiryText;
  window.runAtlasSmartQuote = runAtlasSmartQuote;
  window.initAtlasSmartQuote = initSmartQuoteShell;

  document.addEventListener('DOMContentLoaded', initSmartQuoteShell);
})();

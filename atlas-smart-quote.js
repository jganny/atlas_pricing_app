/**
 * Atlas Smart Quote — orchestrator: ingest enquiry → fill desk → Circulars tariffs.
 */
(function () {
  'use strict';

  var SOURCE_LABELS = {
    'email-text': 'Email text',
    'email-file': 'Email file',
    'excel-cargo': 'Excel cargo sheet',
    'excel-text-fallback': 'Excel (text scan)',
    'pdf-cargo': 'PDF cargo details',
    'word-cargo': 'Word document',
    'word-legacy': 'Word (.doc)',
    'desk-manual': 'Desk fields'
  };

  function $(id) { return document.getElementById(id); }

  function setStatus(msg, level) {
    var el = $('atlas-smart-quote-status');
    if (!el) return;
    el.className = 'atlas-smart-quote-status atlas-sq-' + (level || 'info');
    el.innerHTML = msg;
    el.style.display = msg ? 'block' : 'none';
  }

  function setAirportField(id, code) {
    var el = $(id);
    if (!el || !code) return;
    el.value = code;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function fillCargoRows(packages) {
    var tbody = $('air-cargo-body');
    var addBtn = $('air-add-cargo');
    if (!tbody || !packages || !packages.length) return;

    tbody.innerHTML = '';
    packages.forEach(function (pkg, idx) {
      if (addBtn) addBtn.click();
      var rows = tbody.querySelectorAll('.cargo-item-row');
      var row = rows[rows.length - 1];
      if (!row) return;
      if (pkg.l) row.querySelector('.cargo-len').value = pkg.l;
      if (pkg.w) row.querySelector('.cargo-wid').value = pkg.w;
      if (pkg.h) row.querySelector('.cargo-hei').value = pkg.h;
      if (pkg.qty) row.querySelector('.cargo-qty').value = pkg.qty;
      if (pkg.gw) row.querySelector('.cargo-gw').value = pkg.gw;
    });
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

  async function applySmartQuoteParsed(parsed, fromForm) {
    if (!parsed.origin || !parsed.destination) {
      setStatus('Could not detect POL/POD. Include airport codes (BLR, LHR…) in the paste or file, or type them on the desk.', 'warn');
      return;
    }

    if (!fromForm && typeof window.openActiveCalculator === 'function') window.openActiveCalculator('air');

    if (parsed.customer && $('air-cust-name')) $('air-cust-name').value = parsed.customer;
    if (!fromForm) {
      setAirportField('air-origin', parsed.origin);
      setAirportField('air-dest', parsed.destination);
      if (parsed.packages && parsed.packages.length) fillCargoRows(parsed.packages);
    }

    var carrier = parsed.airline
      ? { code: parsed.airline, label: parsed.airlineLabel, source: 'enquiry' }
      : suggestCarrier(parsed.origin, parsed.destination);
    if (!carrier && parsed.airlineLabel) carrier = { label: parsed.airlineLabel, source: 'enquiry' };

    if (window.AtlasTariffEngine) await window.AtlasTariffEngine.loadTariffs();
    var tariff = window.AtlasTariffEngine
      ? window.AtlasTariffEngine.lookupTariff(parsed.origin, parsed.destination, carrier && carrier.code)
      : null;

    if (!fromForm) {
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
    }

    if (tariff && window.AtlasTariffEngine) {
      window.AtlasTariffEngine.applyTariffToAirDesk(tariff, carrier ? carrier.label : tariff.carrier);
    }

    if (typeof window.calculateAirFreight === 'function') window.calculateAirFreight();

    var nextStep = tariff ? 'terms' : 'carrier';
    if (typeof window.advanceDeskStep === 'function') window.advanceDeskStep('air-freight-panel', nextStep);

    var srcLabel = SOURCE_LABELS[parsed.source] || parsed.source || 'Enquiry';
    var parts = [
      '<strong>✓ Draft ready</strong>',
      parsed.origin + ' → ' + parsed.destination,
      'via <em>' + srcLabel + '</em>',
      (parsed.confidence || 0) + '% match'
    ];
    if (parsed.packages && parsed.packages.length > 1) parts.push(parsed.packages.length + ' cargo lines');
    if (carrier) parts.push(carrier.label + ' (' + carrier.source + ')');
    if (tariff) parts.push('rates from <strong>Circulars</strong>');
    else parts.push('no Circulars tariff — enter rates on Carriers tab (CWT still auto)');
    setStatus(parts.join(' · '), tariff ? 'ok' : 'warn');
  }

  async function runAtlasSmartQuote() {
    setStatus('Extracting enquiry data…', 'info');
    var text = ($('atlas-enquiry-paste') && $('atlas-enquiry-paste').value) || '';
    var fileInput = $('atlas-enquiry-upload');
    var file = fileInput && fileInput.files && fileInput.files[0];

    if (!text.trim() && !file) {
      setStatus('Paste the email body <strong>or</strong> upload cargo file (PDF, Excel, Word). Tariffs come from Circulars.', 'warn');
      return;
    }

    if (!window.AtlasEnquiryIngest) {
      setStatus('Enquiry engine not loaded — refresh the page.', 'warn');
      return;
    }

    try {
      var parsed = await window.AtlasEnquiryIngest.ingest({ text: text, file: file });
      if (parsed.source === 'word-legacy' && parsed.raw) {
        setStatus(parsed.raw, 'warn');
        return;
      }
      await applySmartQuoteParsed(parsed);
    } catch (err) {
      setStatus('Extraction failed: ' + (err.message || err) + ' — try pasting email text.', 'warn');
    }
  }

  async function runAtlasSmartQuoteFromForm() {
    setStatus('Applying automation from desk fields…', 'info');
    var origin = ($('air-origin') && $('air-origin').value) || '';
    var dest = ($('air-dest') && $('air-dest').value) || '';
    var oCode = (origin.match(/\b([A-Z]{3})\b/) || [])[1] || origin.trim().toUpperCase().slice(0, 3);
    var dCode = (dest.match(/\b([A-Z]{3})\b/) || [])[1] || dest.trim().toUpperCase().slice(0, 3);
    if (!oCode || !dCode || oCode.length !== 3 || dCode.length !== 3) {
      setStatus('Enter valid POL and POD first.', 'warn');
      return;
    }
    var parsed = {
      customer: ($('air-cust-name') && $('air-cust-name').value) || '',
      origin: oCode, destination: dCode,
      airline: '', airlineLabel: '', packages: [], pivotWeight: 0,
      source: 'desk-manual', confidence: 60
    };
    var card = document.querySelector('#air-airlines-list-container .airline-card .air-name');
    if (card && card.value) {
      var m = card.value.match(/^([A-Z0-9]{2,3})/);
      parsed.airline = m ? m[1] : '';
      parsed.airlineLabel = card.value;
    }
    await applySmartQuoteParsed(parsed, true);
  }

  async function applyTariffFromCirculars() {
    await runAtlasSmartQuoteFromForm();
  }

  function initSmartQuoteShell() {
    var ta = $('atlas-enquiry-paste');
    if (ta && !ta.dataset.bound) {
      ta.dataset.bound = '1';
      ta.addEventListener('keydown', function (e) {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') runAtlasSmartQuote();
      });
    }
    var drop = $('atlas-enquiry-dropzone');
    var fileIn = $('atlas-enquiry-upload');
    if (drop && fileIn && !drop.dataset.bound) {
      drop.dataset.bound = '1';
      drop.addEventListener('click', function () { fileIn.click(); });
      drop.addEventListener('dragover', function (e) { e.preventDefault(); drop.classList.add('is-drag'); });
      drop.addEventListener('dragleave', function () { drop.classList.remove('is-drag'); });
      drop.addEventListener('drop', function (e) {
        e.preventDefault();
        drop.classList.remove('is-drag');
        if (e.dataTransfer.files.length) {
          fileIn.files = e.dataTransfer.files;
          var nameEl = $('atlas-enquiry-filename');
          if (nameEl) nameEl.textContent = e.dataTransfer.files[0].name;
        }
      });
      fileIn.addEventListener('change', function () {
        var nameEl = $('atlas-enquiry-filename');
        if (nameEl && fileIn.files[0]) nameEl.textContent = fileIn.files[0].name;
      });
    }
  }

  window.runAtlasSmartQuote = runAtlasSmartQuote;
  window.runAtlasSmartQuoteFromForm = runAtlasSmartQuoteFromForm;
  window.applyTariffFromCirculars = applyTariffFromCirculars;
  window.initAtlasSmartQuote = initSmartQuoteShell;

  document.addEventListener('DOMContentLoaded', initSmartQuoteShell);
})();

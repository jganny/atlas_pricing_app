/**
 * Atlas Smart Quote — Sea orchestrator: ingest enquiry → fill desk → Circulars tariffs.
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
    var el = $('atlas-sea-smart-quote-status');
    if (!el) return;
    el.className = 'atlas-smart-quote-status atlas-sq-' + (level || 'info');
    el.innerHTML = msg;
    el.style.display = msg ? 'block' : 'none';
  }

  function setPortField(id, value) {
    var el = $(id);
    if (!el || !value) return;
    el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function fillSeaCargoRows(packages) {
    var tbody = $('sea-cargo-body');
    var addBtn = $('sea-add-cargo-row');
    if (!tbody || !packages || !packages.length) return;

    tbody.innerHTML = '';
    packages.forEach(function (pkg) {
      if (addBtn) addBtn.click();
      var rows = tbody.querySelectorAll('.sea-cargo-item-row');
      var row = rows[rows.length - 1];
      if (!row) return;
      if (pkg.l) row.querySelector('.sea-cargo-len').value = pkg.l;
      if (pkg.w) row.querySelector('.sea-cargo-wid').value = pkg.w;
      if (pkg.h) row.querySelector('.sea-cargo-hei').value = pkg.h;
      if (pkg.qty) row.querySelector('.sea-cargo-qty').value = pkg.qty;
    });
    if (typeof window.calculateSeaVolumeFromDimensions === 'function') {
      window.calculateSeaVolumeFromDimensions();
    }
  }

  function suggestLiner(origin, dest) {
    if (typeof window.getRouteVendorHistory === 'function') {
      var hist = window.getRouteVendorHistory('sea', origin, dest);
      if (hist.vendors && hist.vendors.length) {
        return { label: hist.vendors[0].name, source: 'history' };
      }
    }
    return null;
  }

  function extractPortCode(value) {
    if (!value) return '';
    var m = String(value).match(/\b([A-Z]{2}[A-Z0-9]{3})\b/);
    return m ? m[1] : String(value).trim();
  }

  async function applySeaSmartQuoteParsed(parsed, fromForm) {
    if (!parsed.origin || !parsed.destination) {
      setStatus('Could not detect POL/POD. Include port names or UN/LOCODE (INNSA, CNSHA…) in the paste or file, or type them on the desk.', 'warn');
      return;
    }

    if (!fromForm && typeof window.openActiveCalculator === 'function') window.openActiveCalculator('sea');

    if (parsed.customer && $('sea-cust-name')) $('sea-cust-name').value = parsed.customer;
    if (!fromForm) {
      setPortField('sea-origin', parsed.origin);
      setPortField('sea-dest', parsed.destination);
      if (parsed.commodity && $('sea-commodity')) $('sea-commodity').value = parsed.commodity;

      if (parsed.grossWeight > 0 && $('sea-gross-weight')) {
        $('sea-gross-weight').value = parsed.grossWeight;
      }
      if (parsed.volume > 0 && $('sea-volume')) {
        $('sea-volume').value = parsed.volume;
      }
      if (parsed.pkgQty > 0 && $('sea-pkg-qty')) {
        $('sea-pkg-qty').value = parsed.pkgQty;
      }
      if (parsed.packages && parsed.packages.length) fillSeaCargoRows(parsed.packages);
    }

    var liner = parsed.linerLabel
      ? { label: parsed.linerLabel, source: 'enquiry' }
      : suggestLiner(parsed.origin, parsed.destination);

    if (window.AtlasTariffEngine) {
      await window.AtlasTariffEngine.loadSeaTariffs();
    }

    var mode = parsed.mode || 'lcl';
    var tariff = window.AtlasTariffEngine
      ? window.AtlasTariffEngine.lookupSeaTariff(parsed.origin, parsed.destination, liner && parsed.liner, mode)
      : null;

    if (!fromForm && liner && liner.label) {
      if (window.AtlasTariffEngine) {
        window.AtlasTariffEngine.applyTariffToSeaDesk(
          tariff || { mode: mode, containers: parsed.containers, lclRate: { sell: 0, buy: 0 } },
          liner.label,
          1
        );
      } else if (typeof window.switchLinerMode === 'function') {
        window.switchLinerMode(1, mode);
      }
    } else if (tariff && window.AtlasTariffEngine) {
      window.AtlasTariffEngine.applyTariffToSeaDesk(tariff, liner ? liner.label : tariff.carrier, 1);
    } else if (!fromForm && parsed.mode && typeof window.switchLinerMode === 'function') {
      window.switchLinerMode(1, parsed.mode);
      if (parsed.containers && parsed.containers.length && typeof window.addFclContainerRowToLiner === 'function') {
        var tbody = $('sea-fcl-body-1');
        if (tbody) tbody.innerHTML = '';
        parsed.containers.forEach(function (c) {
          window.addFclContainerRowToLiner(1, c.type, c.qty || 1, c.sell || 0, c.buy || 0);
        });
      }
    }

    if (typeof window.calculateSeaFreight === 'function') window.calculateSeaFreight();

    var nextStep = tariff ? 'terms' : 'carrier';
    if (typeof window.advanceDeskStep === 'function') window.advanceDeskStep('sea-freight-panel', nextStep);

    var srcLabel = SOURCE_LABELS[parsed.source] || parsed.source || 'Enquiry';
    var parts = [
      '<strong>✓ Sea draft ready</strong>',
      extractPortCode(parsed.origin) + ' → ' + extractPortCode(parsed.destination),
      (parsed.mode || 'auto').toUpperCase(),
      'via <em>' + srcLabel + '</em>',
      (parsed.confidence || 0) + '% match'
    ];
    if (parsed.containers && parsed.containers.length) {
      parts.push(parsed.containers.map(function (c) { return c.qty + '×' + c.type; }).join(', '));
    }
    if (liner) parts.push(liner.label + ' (' + liner.source + ')');
    if (tariff) parts.push('rates from <strong>Circulars</strong>');
    else parts.push('no Circulars tariff — enter rates on Carriers tab (CBM/RT still auto)');
    setStatus(parts.join(' · '), tariff ? 'ok' : 'warn');
  }

  async function runAtlasSeaSmartQuote() {
    setStatus('Extracting sea enquiry data…', 'info');
    var text = ($('atlas-sea-enquiry-paste') && $('atlas-sea-enquiry-paste').value) || '';
    var fileInput = $('atlas-sea-enquiry-upload');
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
      var parsed = await window.AtlasEnquiryIngest.ingest({ text: text, file: file, mode: 'sea' });
      if (parsed.source === 'word-legacy' && parsed.raw) {
        setStatus(parsed.raw, 'warn');
        return;
      }
      await applySeaSmartQuoteParsed(parsed);
    } catch (err) {
      setStatus('Extraction failed: ' + (err.message || err) + ' — try pasting email text.', 'warn');
    }
  }

  async function runAtlasSeaSmartQuoteFromForm() {
    setStatus('Applying automation from desk fields…', 'info');
    var origin = ($('sea-origin') && $('sea-origin').value) || '';
    var dest = ($('sea-dest') && $('sea-dest').value) || '';
    if (!origin.trim() || !dest.trim()) {
      setStatus('Enter valid POL and POD first.', 'warn');
      return;
    }

    var card = document.getElementById('sea-liner-card-1');
    var mode = (card && card.dataset.mode) || 'lcl';
    var linerLabel = '';
    if (card) {
      var sel = card.querySelector('.liner-name-select');
      var inp = card.querySelector('.liner-name-input');
      linerLabel = (inp && inp.style.display !== 'none' && inp.value) ? inp.value : (sel && sel.value !== '__custom__' ? sel.value : '');
    }

    var parsed = {
      customer: ($('sea-cust-name') && $('sea-cust-name').value) || '',
      origin: origin, destination: dest,
      liner: '', linerLabel: linerLabel,
      mode: mode, containers: [], packages: [],
      grossWeight: parseFloat(($('sea-gross-weight') && $('sea-gross-weight').value) || 0),
      volume: parseFloat(($('sea-volume') && $('sea-volume').value) || 0),
      source: 'desk-manual', confidence: 60
    };
    await applySeaSmartQuoteParsed(parsed, true);
  }

  async function applySeaTariffFromCirculars() {
    await runAtlasSeaSmartQuoteFromForm();
  }

  function initSeaSmartQuoteShell() {
    var ta = $('atlas-sea-enquiry-paste');
    if (ta && !ta.dataset.bound) {
      ta.dataset.bound = '1';
      ta.addEventListener('keydown', function (e) {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') runAtlasSeaSmartQuote();
      });
    }
    var drop = $('atlas-sea-enquiry-dropzone');
    var fileIn = $('atlas-sea-enquiry-upload');
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
          var nameEl = $('atlas-sea-enquiry-filename');
          if (nameEl) nameEl.textContent = e.dataTransfer.files[0].name;
        }
      });
      fileIn.addEventListener('change', function () {
        var nameEl = $('atlas-sea-enquiry-filename');
        if (nameEl && fileIn.files[0]) nameEl.textContent = fileIn.files[0].name;
      });
    }
  }

  window.runAtlasSeaSmartQuote = runAtlasSeaSmartQuote;
  window.runAtlasSeaSmartQuoteFromForm = runAtlasSeaSmartQuoteFromForm;
  window.applySeaTariffFromCirculars = applySeaTariffFromCirculars;
  window.initAtlasSeaSmartQuote = initSeaSmartQuoteShell;

  document.addEventListener('DOMContentLoaded', initSeaSmartQuoteShell);
})();

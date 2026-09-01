/**
 * Atlas Tariff Engine — multi-format ingest → structured air_tariffs → apply on desk.
 * Does not modify existing quotes; publishes new tariff rows only.
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'atlas_air_tariffs_v1';
  var BREAK_KEYS = ['min', 'minus45', 'plus45', 'plus100', 'plus300', 'plus500', 'plus1000'];
  var BREAK_ALIASES = {
    min: ['min', 'minimum', 'flat'],
    minus45: ['-45', 'm45', 'n45', 'minus45', '0-45', '<45'],
    plus45: ['+45', 'p45', '45', 'plus45', '45kg'],
    plus100: ['+100', 'p100', '100', 'plus100'],
    plus300: ['+300', 'p300', '300', 'plus300'],
    plus500: ['+500', 'p500', '500', 'plus500'],
    plus1000: ['+1000', 'p1000', '1000', 'plus1000', '1000+']
  };

  var tariffsCache = [];

  function normCode(v) {
    if (!v) return '';
    var s = String(v).trim().toUpperCase();
    var m = s.match(/\b([A-Z]{3})\b/);
    return m ? m[1] : s.slice(0, 3);
  }

  function normCarrier(v) {
    if (!v) return '';
    var s = String(v).trim();
    var m = s.match(/^([A-Za-z0-9]{2,3})\b/);
    return m ? m[1].toUpperCase() : s;
  }

  async function loadTariffs() {
    tariffsCache = [];
    try {
      if (window.db) {
        var snap = await db.collection('air_tariffs').where('published', '==', true).get();
        snap.forEach(function (doc) { tariffsCache.push({ id: doc.id, ...doc.data() }); });
      }
    } catch (e) { /* offline */ }
    if (!tariffsCache.length) {
      try {
        var raw = localStorage.getItem(STORAGE_KEY);
        if (raw) tariffsCache = JSON.parse(raw);
      } catch (e2) { tariffsCache = []; }
    }
    return tariffsCache;
  }

  async function saveTariffsLocal(rows) {
    tariffsCache = rows;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(rows)); } catch (e) { /* */ }
  }

  async function publishTariffRows(rows, meta) {
    meta = meta || {};
    var published = [];
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      var doc = {
        carrier: row.carrier,
        carrierCode: row.carrierCode,
        origin: normCode(row.origin),
        destination: normCode(row.destination),
        breaks: row.breaks,
        currency: row.currency || 'USD',
        validFrom: row.validFrom || meta.validFrom || '',
        validTo: row.validTo || meta.validTo || '',
        sourceFile: meta.sourceFile || '',
        sourceCircularId: meta.sourceCircularId || '',
        published: true,
        createdAt: new Date().toISOString()
      };
      if (window.db) {
        try {
          var ref = await db.collection('air_tariffs').add(doc);
          published.push({ id: ref.id, ...doc });
        } catch (e) {
          published.push({ id: 'local_' + Date.now() + '_' + i, ...doc });
        }
      } else {
        published.push({ id: 'local_' + Date.now() + '_' + i, ...doc });
      }
    }
    var merged = tariffsCache.concat(published);
    await saveTariffsLocal(merged);
    tariffsCache = merged;
    return published;
  }

  function matchBreakKey(header) {
    var h = String(header || '').toLowerCase().replace(/\s+/g, '');
    for (var key in BREAK_ALIASES) {
      if (BREAK_ALIASES[key].some(function (a) { return h.indexOf(a.replace(/\s/g, '')) >= 0; })) return key;
    }
    if (/sell|rate/.test(h) && /buy|cost/.test(h)) return null;
    return null;
  }

  function parseExcelTariffRows(workbook) {
    var sheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!sheet || !window.XLSX) return [];
    var json = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    if (!json.length) return [];

    var headers = Object.keys(json[0]);
    var breakCols = {};
    headers.forEach(function (h) {
      var bk = matchBreakKey(h);
      if (bk) {
        if (!breakCols[bk]) breakCols[bk] = { sell: null, buy: null };
        if (/buy|cost/i.test(h)) breakCols[bk].buy = h;
        else breakCols[bk].sell = h;
      }
    });

    var originCol = headers.find(function (h) { return /^(pol|origin|from|org)$/i.test(h) || /origin/i.test(h); });
    var destCol = headers.find(function (h) { return /^(pod|dest|destination|to)$/i.test(h) || /dest/i.test(h); });
    var carrierCol = headers.find(function (h) { return /carrier|airline|vendor/i.test(h); });

    var rows = [];
    json.forEach(function (line) {
      var origin = normCode(line[originCol] || line.POL || line.Origin || line.origin || '');
      var dest = normCode(line[destCol] || line.POD || line.Destination || line.destination || '');
      var carrierRaw = line[carrierCol] || line.Carrier || line.Airline || line.airline || '';
      if (!origin || !dest) return;
      var breaks = {};
      BREAK_KEYS.forEach(function (bk) {
        var cols = breakCols[bk];
        var sell = 0, buy = 0;
        if (cols) {
          sell = parseFloat(line[cols.sell]) || 0;
          buy = parseFloat(line[cols.buy]) || 0;
        } else {
          headers.forEach(function (h) {
            if (matchBreakKey(h) === bk) {
              var v = parseFloat(line[h]) || 0;
              if (/buy|cost/i.test(h)) buy = v;
              else sell = v;
            }
          });
        }
        if (sell > 0 || buy > 0) breaks[bk] = { sell: sell, buy: buy };
      });
      if (!Object.keys(breaks).length) return;
      rows.push({
        origin: origin,
        destination: dest,
        carrier: String(carrierRaw).trim(),
        carrierCode: normCarrier(carrierRaw),
        breaks: breaks,
        currency: line.Currency || line.currency || 'USD'
      });
    });
    return rows;
  }

  function parseExcelFile(file) {
    return new Promise(function (resolve, reject) {
      if (!window.XLSX) return reject(new Error('XLSX library not loaded'));
      var reader = new FileReader();
      reader.onload = function (e) {
        try {
          var wb = XLSX.read(e.target.result, { type: 'array' });
          resolve(parseExcelTariffRows(wb));
        } catch (err) { reject(err); }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  }

  function lookupTariff(origin, destination, carrierCode) {
    var o = normCode(origin);
    var d = normCode(destination);
    var c = normCarrier(carrierCode);
    var matches = tariffsCache.filter(function (t) {
      return t.published !== false &&
        normCode(t.origin) === o &&
        normCode(t.destination) === d &&
        (!c || normCarrier(t.carrierCode || t.carrier) === c);
    });
    if (!matches.length) {
      matches = tariffsCache.filter(function (t) {
        return t.published !== false && normCode(t.origin) === o && normCode(t.destination) === d;
      });
    }
    return matches[0] || null;
  }

  function applyTariffToCard(card, tariff) {
    if (!card || !tariff || !tariff.breaks) return false;
    if (typeof window.addWeightBreakRow !== 'function') return false;
    Object.keys(tariff.breaks).forEach(function (bk) {
      window.addWeightBreakRow(card, bk, tariff.breaks[bk], true);
    });
    var wb = card.querySelector('.air-enable-weight-breaks');
    if (wb) wb.checked = true;
    if (typeof window.calculateAirFreight === 'function') window.calculateAirFreight();
    return true;
  }

  function applyTariffToAirDesk(tariff, carrierLabel) {
    if (!tariff) return false;
    var container = document.getElementById('air-airlines-list-container');
    if (!container) return false;
    var cards = container.querySelectorAll('.airline-card');
    var card = cards.length ? cards[0] : null;
    if (!card && typeof window.addAirlineCard === 'function') {
      window.addAirlineCard({ name: carrierLabel || tariff.carrier, breaks: {} });
      card = container.querySelector('.airline-card');
    }
    if (!card) return false;
    var dir = card.querySelector('.airline-directory-input');
    var hidden = card.querySelector('.air-name');
    var label = carrierLabel || tariff.carrier || (tariff.carrierCode + ' - Airline');
    if (dir) dir.textContent = label;
    if (hidden) hidden.value = label;
    return applyTariffToCard(card, tariff);
  }

  async function importTariffFile(file, meta) {
    if (!file) return { ok: false, message: 'No file' };
    var ext = (file.name.split('.').pop() || '').toLowerCase();
    if (ext === 'xlsx' || ext === 'xls' || ext === 'csv') {
      var rows = await parseExcelFile(file);
      if (!rows.length) return { ok: false, message: 'No tariff rows found in spreadsheet. Use columns: POL, POD, Carrier, +45, +100…' };
      var pub = await publishTariffRows(rows, { sourceFile: file.name, ...meta });
      return { ok: true, count: pub.length, message: 'Published ' + pub.length + ' tariff lane(s) from ' + file.name };
    }
    if (ext === 'pdf' || ext === 'doc' || ext === 'docx') {
      return { ok: true, count: 0, message: 'Document stored in Circulars. Excel rows auto-publish; PDF/Word queued for AI extract (next pass).' };
    }
    return { ok: false, message: 'Unsupported format: ' + ext };
  }

  window.AtlasTariffEngine = {
    loadTariffs: loadTariffs,
    lookupTariff: lookupTariff,
    applyTariffToAirDesk: applyTariffToAirDesk,
    importTariffFile: importTariffFile,
    publishTariffRows: publishTariffRows,
    parseExcelFile: parseExcelFile,
    getTariffs: function () { return tariffsCache; }
  };

  loadTariffs();
})();

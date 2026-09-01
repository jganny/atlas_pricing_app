/**
 * Atlas Tariff Engine — multi-format ingest → structured air_tariffs → apply on desk.
 * Does not modify existing quotes; publishes new tariff rows only.
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'atlas_air_tariffs_v1';
  var SEA_STORAGE_KEY = 'atlas_sea_tariffs_v1';
  var FCL_TYPES = ["20'GP", "40'GP", "20'HC", "40'HC", "45'HC", "20'OT", "40'OT", "20'FR", "40'FR", "20'RF", "40'RF"];
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
  var seaTariffsCache = [];

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

  function normPort(v) {
    if (!v) return '';
    var s = String(v).trim();
    var m = s.match(/\b([A-Z]{2}[A-Z0-9]{3})\b/);
    return m ? m[1].toUpperCase() : s.toLowerCase();
  }

  function normLiner(v) {
    if (!v) return '';
    var s = String(v).trim();
    var m = s.match(/^([A-Za-z0-9]{2,6})\b/);
    return m ? m[1].toUpperCase() : s.toLowerCase().slice(0, 12);
  }

  function normContainerKey(raw) {
    if (!raw) return '';
    var s = String(raw).toUpperCase().replace(/[\s"]/g, '');
    if (s.indexOf("'") < 0 && /^(20|40|45)(GP|HC|HQ|OT|FR|RF)$/.test(s)) {
      return s.slice(0, 2) + "'" + (s.slice(2) === 'HQ' ? 'HC' : s.slice(2));
    }
    return raw;
  }

  async function loadSeaTariffs() {
    seaTariffsCache = [];
    try {
      if (window.db) {
        var snap = await db.collection('sea_tariffs').where('published', '==', true).get();
        snap.forEach(function (doc) { seaTariffsCache.push(Object.assign({ id: doc.id }, doc.data())); });
      }
    } catch (e) { /* offline */ }
    if (!seaTariffsCache.length) {
      try {
        var raw = localStorage.getItem(SEA_STORAGE_KEY);
        if (raw) seaTariffsCache = JSON.parse(raw);
      } catch (e2) { seaTariffsCache = []; }
    }
    return seaTariffsCache;
  }

  async function saveSeaTariffsLocal(rows) {
    seaTariffsCache = rows;
    try { localStorage.setItem(SEA_STORAGE_KEY, JSON.stringify(rows)); } catch (e) { /* */ }
  }

  async function publishSeaTariffRows(rows, meta) {
    meta = meta || {};
    var published = [];
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      var doc = {
        carrier: row.carrier,
        carrierCode: row.carrierCode,
        origin: normPort(row.origin),
        destination: normPort(row.destination),
        mode: row.mode || 'lcl',
        lclRate: row.lclRate || { sell: 0, buy: 0 },
        bbRate: row.bbRate || { sell: 0, buy: 0 },
        fclRates: row.fclRates || {},
        containers: row.containers || [],
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
          var ref = await db.collection('sea_tariffs').add(doc);
          published.push({ id: ref.id, ...doc });
        } catch (e) {
          published.push({ id: 'sea_local_' + Date.now() + '_' + i, ...doc });
        }
      } else {
        published.push({ id: 'sea_local_' + Date.now() + '_' + i, ...doc });
      }
    }
    var merged = seaTariffsCache.concat(published);
    await saveSeaTariffsLocal(merged);
    seaTariffsCache = merged;
    return published;
  }

  function matchFclColumn(header) {
    var h = String(header || '').toLowerCase().replace(/\s+/g, '');
    for (var i = 0; i < FCL_TYPES.length; i++) {
      var t = FCL_TYPES[i].replace(/'/g, '').toLowerCase();
      if (h.indexOf(t) >= 0) return FCL_TYPES[i];
    }
    return null;
  }

  function parseSeaExcelTariffRows(workbook) {
    var sheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!sheet || !window.XLSX) return [];
    var json = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    if (!json.length) return [];

    var headers = Object.keys(json[0]);
    var originCol = headers.find(function (h) { return /^(pol|origin|from|org)$/i.test(h) || /origin|loading/i.test(h); });
    var destCol = headers.find(function (h) { return /^(pod|dest|destination|to)$/i.test(h) || /dest|discharge/i.test(h); });
    var carrierCol = headers.find(function (h) { return /carrier|liner|shipping|line|vendor/i.test(h); });
    var modeCol = headers.find(function (h) { return /^mode$|service|type/i.test(h); });
    var lclSellCol = headers.find(function (h) { return /lcl.*sell|lcl.*rate|^lcl$/i.test(h) && !/buy|cost/i.test(h); });
    var lclBuyCol = headers.find(function (h) { return /lcl.*buy|lcl.*cost/i.test(h); });
    var contTypeCol = headers.find(function (h) { return /container|equip|cntr/i.test(h); });
    var contQtyCol = headers.find(function (h) { return /qty|quantity/i.test(h) && /cont|cntr|equip/i.test(h); });
    var sellCol = headers.find(function (h) { return /^sell|rate$/i.test(h); });
    var buyCol = headers.find(function (h) { return /^buy|cost$/i.test(h); });

    var fclCols = {};
    headers.forEach(function (h) {
      var ct = matchFclColumn(h);
      if (!ct) return;
      if (!fclCols[ct]) fclCols[ct] = { sell: null, buy: null };
      if (/buy|cost/i.test(h)) fclCols[ct].buy = h;
      else fclCols[ct].sell = h;
    });

    var rows = [];
    json.forEach(function (line) {
      var origin = line[originCol] || line.POL || line.Origin || line.origin || '';
      var dest = line[destCol] || line.POD || line.Destination || line.destination || '';
      var carrierRaw = line[carrierCol] || line.Carrier || line.Liner || line.liner || '';
      if (!origin || !dest) return;

      var mode = 'lcl';
      if (modeCol) {
        var mv = String(line[modeCol] || '').toLowerCase();
        if (/fcl/.test(mv)) mode = 'fcl';
        else if (/bb|break/.test(mv)) mode = 'bb';
        else if (/lcl/.test(mv)) mode = 'lcl';
      }

      var fclRates = {};
      Object.keys(fclCols).forEach(function (ct) {
        var cols = fclCols[ct];
        var sell = cols.sell ? parseFloat(line[cols.sell]) || 0 : 0;
        var buy = cols.buy ? parseFloat(line[cols.buy]) || 0 : 0;
        if (!sell && !buy && cols.sell === null) {
          headers.forEach(function (h) {
            if (matchFclColumn(h) === ct) {
              var v = parseFloat(line[h]) || 0;
              if (/buy|cost/i.test(h)) buy = v;
              else if (v > 0) sell = v;
            }
          });
        }
        if (sell > 0 || buy > 0) {
          fclRates[ct] = { sell: sell, buy: buy };
          mode = 'fcl';
        }
      });

      var lclSell = lclSellCol ? parseFloat(line[lclSellCol]) || 0 : 0;
      var lclBuy = lclBuyCol ? parseFloat(line[lclBuyCol]) || 0 : 0;
      if (!lclSell && !lclBuy) {
        headers.forEach(function (h) {
          if (/lcl/i.test(h) && !/buy|cost/i.test(h)) lclSell = parseFloat(line[h]) || lclSell;
          if (/lcl/i.test(h) && /buy|cost/i.test(h)) lclBuy = parseFloat(line[h]) || lclBuy;
        });
      }

      var containers = [];
      if (contTypeCol) {
        var ct = normContainerKey(line[contTypeCol]);
        var qty = contQtyCol ? parseInt(line[contQtyCol], 10) || 1 : 1;
        var sell = sellCol ? parseFloat(line[sellCol]) || 0 : 0;
        var buy = buyCol ? parseFloat(line[buyCol]) || 0 : 0;
        if (ct) {
          containers.push({ type: ct, qty: qty, sell: sell, buy: buy });
          if (!fclRates[ct] && (sell || buy)) fclRates[ct] = { sell: sell, buy: buy };
          mode = 'fcl';
        }
      }

      if (!Object.keys(fclRates).length && !lclSell && !lclBuy && !containers.length) return;

      rows.push({
        origin: origin,
        destination: dest,
        carrier: String(carrierRaw).trim(),
        carrierCode: normLiner(carrierRaw),
        mode: mode,
        lclRate: { sell: lclSell, buy: lclBuy },
        bbRate: { sell: 0, buy: 0 },
        fclRates: fclRates,
        containers: containers,
        currency: line.Currency || line.currency || 'USD'
      });
    });
    return rows;
  }

  function parseSeaExcelFile(file) {
    return new Promise(function (resolve, reject) {
      if (!window.XLSX) return reject(new Error('XLSX library not loaded'));
      var reader = new FileReader();
      reader.onload = function (e) {
        try {
          var wb = XLSX.read(e.target.result, { type: 'array' });
          resolve(parseSeaExcelTariffRows(wb));
        } catch (err) { reject(err); }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  }

  function lookupSeaTariff(origin, destination, carrierCode, mode) {
    var o = normPort(origin);
    var d = normPort(destination);
    var c = normLiner(carrierCode);
    var m = (mode || '').toLowerCase();

    var matches = seaTariffsCache.filter(function (t) {
      if (t.published === false) return false;
      if (normPort(t.origin) !== o || normPort(t.destination) !== d) return false;
      if (m && t.mode && t.mode !== m) return false;
      if (c && t.carrierCode && normLiner(t.carrierCode) !== c && normLiner(t.carrier) !== c) return false;
      return true;
    });

    if (!matches.length) {
      matches = seaTariffsCache.filter(function (t) {
        return t.published !== false && normPort(t.origin) === o && normPort(t.destination) === d;
      });
    }
    return matches[0] || null;
  }

  function setLinerNameOnCard(cardIndex, label) {
    var card = document.getElementById('sea-liner-card-' + cardIndex);
    if (!card || !label) return;
    var select = card.querySelector('.liner-name-select');
    var input = card.querySelector('.liner-name-input');
    if (!select) return;

    var found = false;
    Array.prototype.forEach.call(select.options, function (opt) {
      if (opt.value && opt.value !== '__custom__' && opt.value === label) found = true;
    });

    if (found) {
      select.value = label;
      if (input) { input.style.display = 'none'; input.value = label; }
    } else {
      select.value = '__custom__';
      if (input) { input.style.display = 'inline-block'; input.value = label; }
    }
    if (typeof window.handleLinerSelectChange === 'function') window.handleLinerSelectChange(cardIndex);
  }

  function applyTariffToSeaDesk(tariff, linerLabel, linerIndex) {
    if (!tariff) return false;
    linerIndex = linerIndex || 1;
    var mode = tariff.mode || 'lcl';

    if (typeof window.switchLinerMode === 'function') window.switchLinerMode(linerIndex, mode);

    setLinerNameOnCard(linerIndex, linerLabel || tariff.carrier);

    if (mode === 'fcl') {
      var tbody = document.getElementById('sea-fcl-body-' + linerIndex);
      if (tbody) tbody.innerHTML = '';

      var entries = [];
      if (tariff.containers && tariff.containers.length) {
        entries = tariff.containers;
      } else if (tariff.fclRates) {
        Object.keys(tariff.fclRates).forEach(function (ct) {
          var r = tariff.fclRates[ct];
          entries.push({ type: ct, qty: 1, sell: r.sell, buy: r.buy });
        });
      }

      if (entries.length && typeof window.addFclContainerRowToLiner === 'function') {
        entries.forEach(function (c) {
          window.addFclContainerRowToLiner(linerIndex, c.type, c.qty || 1, c.sell || (c.rate && c.rate.sell) || 0, c.buy || (c.rate && c.rate.buy) || 0);
        });
      } else if (typeof window.addFclContainerRowToLiner === 'function') {
        window.addFclContainerRowToLiner(linerIndex, "20'GP", 1, 0, 0);
      }
    } else if (mode === 'lcl') {
      var card = document.getElementById('sea-liner-card-' + linerIndex);
      if (card && tariff.lclRate) {
        var sellInp = card.querySelector('.sea-lcl-rate');
        var buyInp = card.querySelector('.sea-lcl-buy-rate');
        if (sellInp) sellInp.value = tariff.lclRate.sell || 0;
        if (buyInp) buyInp.value = tariff.lclRate.buy || 0;
      }
    } else if (mode === 'bb') {
      var bbCard = document.getElementById('sea-liner-card-' + linerIndex);
      if (bbCard && tariff.bbRate) {
        var bbSell = bbCard.querySelector('.sea-bb-rate');
        var bbBuy = bbCard.querySelector('.sea-bb-buy-rate');
        if (bbSell) bbSell.value = tariff.bbRate.sell || 0;
        if (bbBuy) bbBuy.value = tariff.bbRate.buy || 0;
      }
    }

    if (typeof window.calculateSeaFreight === 'function') window.calculateSeaFreight();
    return true;
  }

  async function importSeaTariffFile(file, meta) {
    if (!file) return { ok: false, message: 'No file' };
    var ext = (file.name.split('.').pop() || '').toLowerCase();
    if (ext === 'xlsx' || ext === 'xls' || ext === 'csv') {
      var rows = await parseSeaExcelFile(file);
      if (!rows.length) return { ok: false, message: 'No sea tariff rows found. Use columns: POL, POD, Liner, Mode, LCL rate or 20GP/40HC…' };
      var pub = await publishSeaTariffRows(rows, { sourceFile: file.name, ...meta });
      return { ok: true, count: pub.length, message: 'Published ' + pub.length + ' sea tariff lane(s) from ' + file.name };
    }
    if (ext === 'pdf' || ext === 'doc' || ext === 'docx') {
      return { ok: true, count: 0, message: 'Document stored in Circulars. Excel rows auto-publish; PDF/Word queued for AI extract (next pass).' };
    }
    return { ok: false, message: 'Unsupported format: ' + ext };
  }

  async function loadTariffs() {
    tariffsCache = [];
    try {
      if (window.db) {
        var snap = await db.collection('air_tariffs').where('published', '==', true).get();
        snap.forEach(function (doc) { tariffsCache.push(Object.assign({ id: doc.id }, doc.data())); });
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
    loadSeaTariffs: loadSeaTariffs,
    lookupTariff: lookupTariff,
    lookupSeaTariff: lookupSeaTariff,
    applyTariffToAirDesk: applyTariffToAirDesk,
    applyTariffToSeaDesk: applyTariffToSeaDesk,
    importTariffFile: importTariffFile,
    importSeaTariffFile: importSeaTariffFile,
    publishTariffRows: publishTariffRows,
    publishSeaTariffRows: publishSeaTariffRows,
    parseExcelFile: parseExcelFile,
    parseSeaExcelFile: parseSeaExcelFile,
    getTariffs: function () { return tariffsCache; },
    getSeaTariffs: function () { return seaTariffsCache; }
  };

  loadTariffs();
  loadSeaTariffs();
})();

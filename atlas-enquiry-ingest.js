/**
 * Atlas Enquiry Ingest — universal cargo extraction from paste or file.
 * Text email body · Excel cargo sheet · PDF · Word (.docx)
 * → structured enquiry → Smart Quote / Air desk automation.
 */
(function () {
  'use strict';

  var AIRLINE_HINTS = {
    EK: 'EK - Emirates', QR: 'QR - Qatar Airways', GF: 'GF - Gulf Air',
    AI: 'AI - Air India', '6E': '6E - IndiGo', BA: 'BA - British Airways',
    LH: 'LH - Lufthansa', SQ: 'SQ - Singapore Airlines', CX: 'CX - Cathay Pacific',
    TK: 'TK - Turkish Airlines', EY: 'EY - Etihad Airways', KL: 'KL - KLM',
    AF: 'AF - Air France', UA: 'UA - United Airlines'
  };

  function emptyResult() {
    return {
      customer: '', origin: '', destination: '', airline: '', airlineLabel: '',
      packages: [], pivotWeight: 0, commodity: '', source: 'unknown', confidence: 0, raw: ''
    };
  }

  function normIata(v) {
    if (!v) return '';
    var s = String(v).trim().toUpperCase();
    var m = s.match(/\b([A-Z]{3})\b/);
    return m ? m[1] : (s.length === 3 ? s : '');
  }

  function parseEnquiryText(text, sourceLabel) {
    var t = (text || '').replace(/\r/g, '');
    var result = emptyResult();
    result.raw = t;
    result.source = sourceLabel || 'email-text';

    var custMatch = t.match(/(?:customer|client|shipper|consignee|for|attn)[:\s]+([^\n,;]+)/i);
    if (custMatch) result.customer = custMatch[1].trim();
    else {
      var lines = t.split('\n').map(function (l) { return l.trim(); }).filter(Boolean);
      for (var i = 0; i < Math.min(lines.length, 8); i++) {
        if (/(ltd|pvt|pte|inc|llc|corp|trading|logistics|freight|exports?)/i.test(lines[i]) &&
            !/^(hi|dear|hello|thanks|regards|subject)/i.test(lines[i])) {
          result.customer = lines[i];
          break;
        }
      }
    }

    var routePatterns = [
      /([A-Z]{3})\s*(?:to|→|->|-|–|\/)\s*([A-Z]{3})/i,
      /(?:pol|origin|from|airport of loading)[:\s]*([A-Z]{3}).*?(?:pod|dest|destination|to|airport of discharge)[:\s]*([A-Z]{3})/is,
      /\b([A-Z]{3})\b[^\n]{0,60}\b([A-Z]{3})\b/
    ];
    for (var r = 0; r < routePatterns.length; r++) {
      var rm = t.match(routePatterns[r]);
      if (rm) { result.origin = rm[1].toUpperCase(); result.destination = rm[2].toUpperCase(); break; }
    }

    var pivotM = t.match(/pivot[:\s]*(\d+(?:\.\d+)?)/i);
    if (pivotM) result.pivotWeight = parseFloat(pivotM[1]);

    var commM = t.match(/(?:commodity|goods|description)[:\s]+([^\n]+)/i);
    if (commM) result.commodity = commM[1].trim().slice(0, 120);

    var dimGlobal = /(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)/gi;
    var dimMatch;
    var dimHits = [];
    while ((dimMatch = dimGlobal.exec(t)) !== null) {
      dimHits.push({ l: parseFloat(dimMatch[1]), w: parseFloat(dimMatch[2]), h: parseFloat(dimMatch[3]) });
    }

    var gwMatches = [];
    var gwRe = /(?:gross|actual|total|net)?\s*weight[:\s]*(\d+(?:\.\d+)?)\s*(?:kg|kgs)?/gi;
    var gwm;
    while ((gwm = gwRe.exec(t)) !== null) gwMatches.push(parseFloat(gwm[1]));
    if (!gwMatches.length) {
      var simpleGw = t.match(/(\d+(?:\.\d+)?)\s*(?:kg|kgs|kilos?)\b/gi);
      if (simpleGw) simpleGw.forEach(function (s) {
        var n = parseFloat(s);
        if (n > 0 && n < 50000) gwMatches.push(n);
      });
    }

    var qtyDefault = 1;
    var qtyM = t.match(/(\d+)\s*(?:pcs|pieces|pkgs|packages|cartons|ctns)/i);
    if (qtyM) qtyDefault = parseInt(qtyM[1], 10);

    if (dimHits.length) {
      dimHits.forEach(function (d, idx) {
        result.packages.push({
          qty: qtyDefault,
          gw: gwMatches[idx] || gwMatches[0] || 0,
          l: d.l, w: d.w, h: d.h
        });
      });
    } else if (gwMatches.length) {
      result.packages.push({ qty: qtyDefault, gw: gwMatches[0], l: 0, w: 0, h: 0 });
    }

    var codeM = t.match(/\b([A-Z0-9]{2})\s*[-–]\s*([A-Za-z][A-Za-z\s]{2,40})/);
    if (codeM) {
      result.airline = codeM[1].toUpperCase();
      result.airlineLabel = codeM[1].toUpperCase() + ' - ' + codeM[2].trim();
    } else {
      Object.keys(AIRLINE_HINTS).forEach(function (code) {
        if (result.airline) return;
        var namePart = AIRLINE_HINTS[code].split(' - ')[1];
        if (new RegExp('\\b' + code + '\\b', 'i').test(t) || new RegExp(namePart.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(t)) {
          result.airline = code;
          result.airlineLabel = AIRLINE_HINTS[code];
        }
      });
    }

    result.confidence = scoreConfidence(result);
    return result;
  }

  function scoreConfidence(r) {
    var s = 0;
    if (r.origin && r.destination) s += 40;
    if (r.packages.length) s += 25;
    if (r.packages.some(function (p) { return p.gw > 0; })) s += 15;
    if (r.customer) s += 10;
    if (r.airline) s += 10;
    return Math.min(100, s);
  }

  function mergeResults(base, extra) {
    if (!extra) return base;
    var out = Object.assign({}, base);
    ['customer', 'origin', 'destination', 'airline', 'airlineLabel', 'commodity'].forEach(function (k) {
      if (!out[k] && extra[k]) out[k] = extra[k];
    });
    if (extra.pivotWeight && !out.pivotWeight) out.pivotWeight = extra.pivotWeight;
    if (extra.packages && extra.packages.length) {
      out.packages = extra.packages.length >= (out.packages || []).length ? extra.packages : out.packages;
    }
    out.confidence = Math.max(out.confidence || 0, extra.confidence || 0);
    if (extra.source) out.source = extra.source;
    return out;
  }

  function colFind(headers, patterns) {
    return headers.find(function (h) {
      var hl = String(h).toLowerCase().replace(/\s+/g, '');
      return patterns.some(function (p) { return p.test(hl); });
    });
  }

  function parseExcelCargo(workbook) {
    var result = emptyResult();
    result.source = 'excel-cargo';
    if (!workbook || !window.XLSX) return result;

    var bestRows = [];
    workbook.SheetNames.forEach(function (sn) {
      var sheet = workbook.Sheets[sn];
      var json = XLSX.utils.sheet_to_json(sheet, { defval: '' });
      if (!json.length) return;

      var headers = Object.keys(json[0]);
      var polCol = colFind(headers, [/^(pol|origin|from|org|airportorigin)$/i, /origin/i, /^from$/i]);
      var podCol = colFind(headers, [/^(pod|dest|destination|to)$/i, /dest/i, /^to$/i]);
      var lenCol = colFind(headers, [/^(l|len|length)$/i]);
      var widCol = colFind(headers, [/^(w|wid|width)$/i]);
      var heiCol = colFind(headers, [/^(h|hei|height)$/i]);
      var gwCol = colFind(headers, [/gross/, /gwt/, /^gw$/, /weight/, /actual/]);
      var qtyCol = colFind(headers, [/qty/, /quantity/, /pieces/, /pkgs/, /cartons/, /ctns/]);
      var custCol = colFind(headers, [/customer/, /shipper/, /consignee/, /client/]);

      json.forEach(function (line) {
        if (!result.origin && polCol) result.origin = normIata(line[polCol]);
        if (!result.destination && podCol) result.destination = normIata(line[podCol]);
        if (!result.customer && custCol) result.customer = String(line[custCol] || '').trim();

        var gw = gwCol ? parseFloat(line[gwCol]) || 0 : 0;
        var l = lenCol ? parseFloat(line[lenCol]) || 0 : 0;
        var w = widCol ? parseFloat(line[widCol]) || 0 : 0;
        var h = heiCol ? parseFloat(line[heiCol]) || 0 : 0;
        var qty = qtyCol ? parseInt(line[qtyCol], 10) || 1 : 1;

        if (gw > 0 || (l && w && h)) {
          bestRows.push({ qty: qty, gw: gw, l: l, w: w, h: h });
        }
      });
    });

    if (bestRows.length) result.packages = bestRows;
    if (!result.origin || !result.destination) {
      var textBlob = workbook.SheetNames.map(function (sn) {
        return XLSX.utils.sheet_to_csv(workbook.Sheets[sn]);
      }).join('\n');
      result = mergeResults(result, parseEnquiryText(textBlob, 'excel-text-fallback'));
      result.source = 'excel-cargo';
    }
    result.confidence = scoreConfidence(result);
    return result;
  }

  async function extractPdfText(file, maxPages) {
    if (typeof pdfjsLib === 'undefined') return '';
    try {
      if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
      }
      var arrayBuffer = await file.arrayBuffer();
      var pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      var text = '';
      var pages = Math.min(pdf.numPages, maxPages || 8);
      for (var i = 1; i <= pages; i++) {
        var page = await pdf.getPage(i);
        var content = await page.getTextContent();
        text += content.items.map(function (it) { return it.str; }).join(' ') + '\n';
      }
      return text;
    } catch (e) {
      console.warn('PDF extract failed', e);
      return '';
    }
  }

  async function extractDocxText(file) {
    if (typeof mammoth === 'undefined') {
      throw new Error('Word parser loading — try again in a moment or paste email text.');
    }
    var buf = await file.arrayBuffer();
    var out = await mammoth.extractRawText({ arrayBuffer: buf });
    return out.value || '';
  }

  async function ingestFromFile(file) {
    if (!file) return emptyResult();
    var ext = (file.name.split('.').pop() || '').toLowerCase();

    if (ext === 'xlsx' || ext === 'xls' || ext === 'csv') {
      var buf = await file.arrayBuffer();
      var wb = XLSX.read(buf, { type: 'array' });
      return parseExcelCargo(wb);
    }
    if (ext === 'pdf') {
      var pdfText = await extractPdfText(file, 10);
      if (!pdfText.trim()) return emptyResult();
      return parseEnquiryText(pdfText, 'pdf-cargo');
    }
    if (ext === 'docx') {
      var docText = await extractDocxText(file);
      return parseEnquiryText(docText, 'word-cargo');
    }
    if (ext === 'doc') {
      var legacy = emptyResult();
      legacy.source = 'word-legacy';
      legacy.confidence = 0;
      legacy.raw = 'Legacy .doc detected — save as .docx or paste enquiry text.';
      return legacy;
    }
    if (ext === 'txt' || ext === 'eml') {
      var txt = await file.text();
      return parseEnquiryText(txt, 'email-file');
    }
    return emptyResult();
  }

  /* ── Sea freight enquiry parsing ── */

  var LINER_HINTS = {
    MSC: 'MSC (Mediterranean Shipping Company)', MAERSK: 'Maersk Line', CMA: 'CMA CGM',
    COSCO: 'COSCO Shipping', HAPAG: 'Hapag-Lloyd', ONE: 'ONE (Ocean Network Express)',
    EVERGREEN: 'Evergreen Line', HMM: 'HMM Co., Ltd.', YANG: 'Yang Ming Marine Transport',
    ZIM: 'ZIM Integrated Shipping', PIL: 'PIL (Pacific International Lines)',
    OOCL: 'OOCL (Orient Overseas Container Line)', ECU: 'ECU Worldwide'
  };

  var CONTAINER_ALIASES = {
    "20GP": "20'GP", "20'GP": "20'GP", "20DC": "20'GP",
    "40GP": "40'GP", "40'GP": "40'GP", "40DC": "40'GP",
    "20HC": "20'HC", "20'HC": "20'HC", "20HQ": "20'HC",
    "40HC": "40'HC", "40'HC": "40'HC", "40HQ": "40'HC",
    "45HC": "45'HC", "45'HC": "45'HC"
  };

  var MAJOR_PORTS = [
    { code: 'CNSHA', name: 'Shanghai Port', city: 'Shanghai' },
    { code: 'SGPIN', name: 'Singapore Port', city: 'Singapore' },
    { code: 'NLRTM', name: 'Port of Rotterdam', city: 'Rotterdam' },
    { code: 'INNSA', name: 'Nhava Sheva (JNPT)', city: 'Mumbai' },
    { code: 'INMAA', name: 'Chennai Port', city: 'Chennai' },
    { code: 'AEDXB', name: 'Jebel Ali Port', city: 'Dubai' },
    { code: 'USLAX', name: 'Port of Los Angeles', city: 'Los Angeles' },
    { code: 'GBFXT', name: 'Felixstowe Port', city: 'Felixstowe' },
    { code: 'DEHAM', name: 'Hamburg Port', city: 'Hamburg' },
    { code: 'LKCMB', name: 'Colombo Port', city: 'Colombo' },
    { code: 'BEANR', name: 'Port of Antwerp', city: 'Antwerp' }
  ];

  function emptySeaResult() {
    return {
      customer: '', origin: '', destination: '', liner: '', linerLabel: '',
      mode: '', grossWeight: 0, volume: 0, pkgQty: 0,
      containers: [], packages: [], commodity: '',
      source: 'unknown', confidence: 0, raw: ''
    };
  }

  function normContainerType(raw) {
    if (!raw) return '';
    var s = String(raw).toUpperCase().replace(/[\s'"]/g, '');
    if (CONTAINER_ALIASES[s]) return CONTAINER_ALIASES[s];
    var m = s.match(/^(20|40|45)(GP|HC|HQ|DC|OT|FR|RF)$/);
    if (m) return m[1] + "'" + (m[2] === 'HQ' || m[2] === 'DC' ? (m[2] === 'DC' ? 'GP' : 'HC') : m[2]);
    return '';
  }

  function resolvePortLabel(token) {
    if (!token) return '';
    var s = String(token).trim();
    var codeM = s.match(/\b([A-Z]{2}[A-Z0-9]{3})\b/);
    var code = codeM ? codeM[1].toUpperCase() : '';
    var ports = (window.appState && window.appState.seaports && window.appState.seaports.length)
      ? window.appState.seaports : MAJOR_PORTS;
    if (code) {
      var hit = ports.find(function (p) { return (p.code || '').toUpperCase() === code; });
      if (hit) return hit.code + ' - ' + hit.name;
    }
    var lower = s.toLowerCase();
    var byName = ports.find(function (p) {
      return (p.name || '').toLowerCase().indexOf(lower) >= 0 ||
        (p.city || '').toLowerCase().indexOf(lower) >= 0 ||
        lower.indexOf((p.city || '').toLowerCase()) >= 0;
    });
    if (byName) return byName.code + ' - ' + byName.name;
    return s;
  }

  function parseSeaEnquiryText(text, sourceLabel) {
    var t = (text || '').replace(/\r/g, '');
    var result = emptySeaResult();
    result.raw = t;
    result.source = sourceLabel || 'email-text';

    var custMatch = t.match(/(?:customer|client|shipper|consignee|for|attn)[:\s]+([^\n,;]+)/i);
    if (custMatch) result.customer = custMatch[1].trim();

    var polM = t.match(/(?:pol|port of loading|origin|from)[:\s]+([^\n,;]+)/i);
    var podM = t.match(/(?:pod|port of discharge|destination|to)[:\s]+([^\n,;]+)/i);
    if (polM) result.origin = resolvePortLabel(polM[1].trim());
    if (podM) result.destination = resolvePortLabel(podM[1].trim());

    if (!result.origin || !result.destination) {
      var routeM = t.match(/(?:from|ex)\s+([A-Za-z][A-Za-z\s.'()-]{2,40}?)\s+(?:to|→|->|-|–)\s+([A-Za-z][A-Za-z\s.'()-]{2,40}?)(?:\s|$|[,.])/i);
      if (routeM) {
        if (!result.origin) result.origin = resolvePortLabel(routeM[1].trim());
        if (!result.destination) result.destination = resolvePortLabel(routeM[2].trim());
      }
    }

    if (!result.origin || !result.destination) {
      var codes = t.match(/\b([A-Z]{2}[A-Z0-9]{3})\b/g);
      if (codes && codes.length >= 2) {
        if (!result.origin) result.origin = resolvePortLabel(codes[0]);
        if (!result.destination) result.destination = resolvePortLabel(codes[1]);
      }
    }

    if (/break\s*bulk|breakbulk|\bbb\b/i.test(t)) result.mode = 'bb';
    else if (/\blcl\b|less\s*than\s*container|consolidat/i.test(t)) result.mode = 'lcl';
    else if (/\bfcl\b|full\s*container|container\s*load/i.test(t)) result.mode = 'fcl';

    var cbmM = t.match(/(\d+(?:\.\d+)?)\s*(?:cbm|m3|m³|cubic\s*m)/i);
    if (cbmM) result.volume = parseFloat(cbmM[1]);

    var tonM = t.match(/(\d+(?:\.\d+)?)\s*(?:mt|metric\s*ton|tons?)\b/i);
    if (tonM) result.grossWeight = parseFloat(tonM[1]) * 1000;
    if (!result.grossWeight) {
      var kgM = t.match(/(?:gross|total|net)?\s*weight[:\s]*(\d+(?:\.\d+)?)\s*(?:kg|kgs)?/i);
      if (kgM) result.grossWeight = parseFloat(kgM[1]);
    }
    if (!result.grossWeight) {
      var simpleKg = t.match(/(\d+(?:\.\d+)?)\s*(?:kg|kgs|kilos?)\b/i);
      if (simpleKg) result.grossWeight = parseFloat(simpleKg[1]);
    }

    var pkgM = t.match(/(\d+)\s*(?:pcs|pieces|pkgs|packages|cartons|ctns|pallets)/i);
    if (pkgM) result.pkgQty = parseInt(pkgM[1], 10);

    var contRe = /(\d+)\s*[x×*]\s*(20|40|45)\s*['']?\s*(gp|hc|hq|dc|ot|fr|rf)/gi;
    var cm;
    while ((cm = contRe.exec(t)) !== null) {
      var ctype = normContainerType(cm[2] + cm[3].toUpperCase());
      if (ctype) {
        result.containers.push({ type: ctype, qty: parseInt(cm[1], 10) || 1, sell: 0, buy: 0 });
        if (!result.mode) result.mode = 'fcl';
      }
    }

    if (!result.containers.length) {
      var singleCont = t.match(/\b(20|40|45)\s*['']?\s*(gp|hc|hq)\b/i);
      if (singleCont) {
        result.containers.push({ type: normContainerType(singleCont[1] + singleCont[2].toUpperCase()), qty: 1, sell: 0, buy: 0 });
        if (!result.mode) result.mode = 'fcl';
      }
    }

    var dimGlobal = /(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)/gi;
    var dimMatch;
    while ((dimMatch = dimGlobal.exec(t)) !== null) {
      result.packages.push({
        l: parseFloat(dimMatch[1]), w: parseFloat(dimMatch[2]), h: parseFloat(dimMatch[3]),
        qty: result.pkgQty || 1
      });
    }

    var commM = t.match(/(?:commodity|goods|description|cargo)[:\s]+([^\n]+)/i);
    if (commM) result.commodity = commM[1].trim().slice(0, 120);

    Object.keys(LINER_HINTS).forEach(function (key) {
      if (result.liner) return;
      var label = LINER_HINTS[key];
      var namePart = label.split(' - ').pop() || label;
      if (new RegExp('\\b' + key + '\\b', 'i').test(t) ||
          new RegExp(namePart.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(t)) {
        result.liner = key;
        result.linerLabel = label;
      }
    });

    if (!result.mode && result.containers.length) result.mode = 'fcl';
    if (!result.mode && (result.volume > 0 || result.packages.length)) result.mode = 'lcl';

    result.confidence = scoreSeaConfidence(result);
    return result;
  }

  function scoreSeaConfidence(r) {
    var s = 0;
    if (r.origin && r.destination) s += 35;
    if (r.mode) s += 15;
    if (r.grossWeight > 0 || r.volume > 0) s += 20;
    if (r.containers.length || r.packages.length) s += 15;
    if (r.customer) s += 8;
    if (r.liner) s += 7;
    return Math.min(100, s);
  }

  function mergeSeaResults(base, extra) {
    if (!extra) return base;
    var out = Object.assign({}, base);
    ['customer', 'origin', 'destination', 'liner', 'linerLabel', 'commodity', 'mode'].forEach(function (k) {
      if (!out[k] && extra[k]) out[k] = extra[k];
    });
    if (extra.grossWeight && !out.grossWeight) out.grossWeight = extra.grossWeight;
    if (extra.volume && !out.volume) out.volume = extra.volume;
    if (extra.pkgQty && !out.pkgQty) out.pkgQty = extra.pkgQty;
    if (extra.containers && extra.containers.length) {
      out.containers = extra.containers.length >= (out.containers || []).length ? extra.containers : out.containers;
    }
    if (extra.packages && extra.packages.length) {
      out.packages = extra.packages.length >= (out.packages || []).length ? extra.packages : out.packages;
    }
    out.confidence = Math.max(out.confidence || 0, extra.confidence || 0);
    if (extra.source) out.source = extra.source;
    return out;
  }

  function parseSeaExcelCargo(workbook) {
    var result = emptySeaResult();
    result.source = 'excel-cargo';
    if (!workbook || !window.XLSX) return result;

    workbook.SheetNames.forEach(function (sn) {
      var sheet = workbook.Sheets[sn];
      var json = XLSX.utils.sheet_to_json(sheet, { defval: '' });
      if (!json.length) return;

      var headers = Object.keys(json[0]);
      var polCol = colFind(headers, [/^(pol|origin|from|org)$/i, /origin/i, /^from$/i, /loading/i]);
      var podCol = colFind(headers, [/^(pod|dest|destination|to)$/i, /dest/i, /^to$/i, /discharge/i]);
      var gwCol = colFind(headers, [/gross/, /gwt/, /^gw$/, /weight/, /kg/]);
      var volCol = colFind(headers, [/cbm/, /volume/, /m3/]);
      var qtyCol = colFind(headers, [/qty/, /quantity/, /pieces/, /pkgs/, /cartons/]);
      var modeCol = colFind(headers, [/mode/, /service/, /type/]);
      var contCol = colFind(headers, [/container/, /equip/, /cntr/]);
      var lenCol = colFind(headers, [/^(l|len|length)$/i]);
      var widCol = colFind(headers, [/^(w|wid|width)$/i]);
      var heiCol = colFind(headers, [/^(h|hei|height)$/i]);
      var custCol = colFind(headers, [/customer/, /shipper/, /consignee/, /client/]);
      var linerCol = colFind(headers, [/liner/, /carrier/, /shipping/, /line/]);

      json.forEach(function (line) {
        if (!result.origin && polCol) result.origin = resolvePortLabel(line[polCol]);
        if (!result.destination && podCol) result.destination = resolvePortLabel(line[podCol]);
        if (!result.customer && custCol) result.customer = String(line[custCol] || '').trim();
        if (!result.linerLabel && linerCol) result.linerLabel = String(line[linerCol] || '').trim();

        var gw = gwCol ? parseFloat(line[gwCol]) || 0 : 0;
        var vol = volCol ? parseFloat(line[volCol]) || 0 : 0;
        if (gw > result.grossWeight) result.grossWeight = gw;
        if (vol > result.volume) result.volume = vol;

        if (modeCol) {
          var mv = String(line[modeCol] || '').toLowerCase();
          if (/lcl/.test(mv)) result.mode = 'lcl';
          else if (/fcl/.test(mv)) result.mode = 'fcl';
          else if (/bb|break/.test(mv)) result.mode = 'bb';
        }

        if (contCol) {
          var ct = normContainerType(String(line[contCol] || ''));
          var cq = qtyCol ? parseInt(line[qtyCol], 10) || 1 : 1;
          if (ct) result.containers.push({ type: ct, qty: cq, sell: 0, buy: 0 });
        }

        var l = lenCol ? parseFloat(line[lenCol]) || 0 : 0;
        var w = widCol ? parseFloat(line[widCol]) || 0 : 0;
        var h = heiCol ? parseFloat(line[heiCol]) || 0 : 0;
        var qty = qtyCol ? parseInt(line[qtyCol], 10) || 1 : 1;
        if (l && w && h) result.packages.push({ l: l, w: w, h: h, qty: qty });
      });
    });

    if (!result.origin || !result.destination) {
      var textBlob = workbook.SheetNames.map(function (sn) {
        return XLSX.utils.sheet_to_csv(workbook.Sheets[sn]);
      }).join('\n');
      result = mergeSeaResults(result, parseSeaEnquiryText(textBlob, 'excel-text-fallback'));
      result.source = 'excel-cargo';
    }
    result.confidence = scoreSeaConfidence(result);
    return result;
  }

  async function ingestSeaFromFile(file) {
    if (!file) return emptySeaResult();
    var ext = (file.name.split('.').pop() || '').toLowerCase();

    if (ext === 'xlsx' || ext === 'xls' || ext === 'csv') {
      var buf = await file.arrayBuffer();
      var wb = XLSX.read(buf, { type: 'array' });
      return parseSeaExcelCargo(wb);
    }
    if (ext === 'pdf') {
      var pdfText = await extractPdfText(file, 10);
      if (!pdfText.trim()) return emptySeaResult();
      return parseSeaEnquiryText(pdfText, 'pdf-cargo');
    }
    if (ext === 'docx') {
      var docText = await extractDocxText(file);
      return parseSeaEnquiryText(docText, 'word-cargo');
    }
    if (ext === 'doc') {
      var legacy = emptySeaResult();
      legacy.source = 'word-legacy';
      legacy.raw = 'Legacy .doc detected — save as .docx or paste enquiry text.';
      return legacy;
    }
    if (ext === 'txt' || ext === 'eml') {
      var txt = await file.text();
      return parseSeaEnquiryText(txt, 'email-file');
    }
    return emptySeaResult();
  }

  async function ingest(opts) {
    opts = opts || {};
    var text = (opts.text || '').trim();
    var file = opts.file || null;
    var mode = opts.mode || 'air';

    if (mode === 'sea') {
      var seaResult = emptySeaResult();
      if (text) seaResult = parseSeaEnquiryText(text, 'email-text');
      if (file) {
        var seaFile = await ingestSeaFromFile(file);
        seaResult = text ? mergeSeaResults(seaResult, seaFile) : seaFile;
      }
      seaResult.confidence = scoreSeaConfidence(seaResult);
      return seaResult;
    }

    var result = emptyResult();
    if (text) result = parseEnquiryText(text, 'email-text');
    if (file) {
      var fromFile = await ingestFromFile(file);
      result = text ? mergeResults(result, fromFile) : fromFile;
    }
    result.confidence = scoreConfidence(result);
    return result;
  }

  window.AtlasEnquiryIngest = {
    ingest: ingest,
    parseEnquiryText: parseEnquiryText,
    parseSeaEnquiryText: parseSeaEnquiryText,
    ingestFromFile: ingestFromFile,
    ingestSeaFromFile: ingestSeaFromFile
  };
  window.parseEnquiryText = parseEnquiryText;
  window.parseSeaEnquiryText = parseSeaEnquiryText;
})();

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
      return { ...emptyResult(), source: 'word-legacy', confidence: 0,
        raw: 'Legacy .doc detected — save as .docx or paste enquiry text.' };
    }
    if (ext === 'txt' || ext === 'eml') {
      var txt = await file.text();
      return parseEnquiryText(txt, 'email-file');
    }
    return emptyResult();
  }

  async function ingest(opts) {
    opts = opts || {};
    var text = (opts.text || '').trim();
    var file = opts.file || null;
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
    ingestFromFile: ingestFromFile
  };
  window.parseEnquiryText = parseEnquiryText;
})();

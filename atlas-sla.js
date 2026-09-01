/**
 * Atlas SLA Automation — response-time visibility (Phase 0).
 * Read-only: never modifies existing quote documents.
 */
(function () {
  'use strict';

  var SLA_HOURS_GREEN = 4;
  var SLA_HOURS_AMBER = 8;

  function hoursSince(dateStr) {
    if (!dateStr) return 0;
    var d = new Date(dateStr);
    if (isNaN(d.getTime())) return 0;
    return (Date.now() - d.getTime()) / (1000 * 60 * 60);
  }

  function slaStatus(quote) {
    if (!quote || quote.status === 'converted' || quote.status === 'cancelled' || quote.status === 'lost') {
      return { level: 'done', label: 'Closed', hours: 0 };
    }
    var h = hoursSince(quote.date);
    if (h <= SLA_HOURS_GREEN) return { level: 'ok', label: 'On track', hours: h };
    if (h <= SLA_HOURS_AMBER) return { level: 'warn', label: 'Due soon', hours: h };
    return { level: 'overdue', label: 'Overdue', hours: h };
  }

  function formatHours(h) {
    if (h < 1) return Math.round(h * 60) + 'm';
    if (h < 48) return h.toFixed(1) + 'h';
    return Math.round(h / 24) + 'd';
  }

  function renderSlaBanner() {
    var host = document.getElementById('atlas-sla-banner');
    if (!host || !window.appState || !window.appState.quotes) return;

    var open = window.appState.quotes.filter(function (q) {
      return q.status === 'quoted' || q.status === 'new' || !q.status;
    });
    var overdue = 0, warn = 0;
    open.forEach(function (q) {
      var s = slaStatus(q);
      if (s.level === 'overdue') overdue++;
      else if (s.level === 'warn') warn++;
    });

    host.innerHTML =
      '<div class="atlas-sla-strip">' +
        '<div class="atlas-sla-stat"><span class="atlas-sla-num">' + open.length + '</span><span class="atlas-sla-lbl">Open quotes</span></div>' +
        '<div class="atlas-sla-stat atlas-sla-warn"><span class="atlas-sla-num">' + warn + '</span><span class="atlas-sla-lbl">Due soon (&gt;' + SLA_HOURS_GREEN + 'h)</span></div>' +
        '<div class="atlas-sla-stat atlas-sla-overdue"><span class="atlas-sla-num">' + overdue + '</span><span class="atlas-sla-lbl">Overdue (&gt;' + SLA_HOURS_AMBER + 'h)</span></div>' +
        '<div class="atlas-sla-hint">Target: quote within <strong>' + SLA_HOURS_GREEN + ' hours</strong> · No changes to saved data</div>' +
      '</div>';
  }

  function slaBadgeHtml(quote) {
    var s = slaStatus(quote);
    if (s.level === 'done') return '';
    return '<span class="atlas-sla-badge atlas-sla-' + s.level + '" title="' + s.label + ' · ' + formatHours(s.hours) + ' since quote date">' +
      s.label + ' · ' + formatHours(s.hours) + '</span>';
  }

  function hookApplyDbFilters() {
    if (typeof window.applyDbFiltersAndSort !== 'function' || window._atlasSlaHooked) return;
    var orig = window.applyDbFiltersAndSort;
    window.applyDbFiltersAndSort = function () {
      var r = orig.apply(this, arguments);
      renderSlaBanner();
      return r;
    };
    window._atlasSlaHooked = true;
  }

  function init() {
    hookApplyDbFilters();
    setInterval(renderSlaBanner, 60000);
    document.addEventListener('DOMContentLoaded', function () {
      hookApplyDbFilters();
      setTimeout(renderSlaBanner, 2000);
    });
  }

  window.atlasSlaStatus = slaStatus;
  window.atlasSlaBadgeHtml = slaBadgeHtml;
  window.renderAtlasSlaBanner = renderSlaBanner;
  init();
})();

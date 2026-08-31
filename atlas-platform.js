/**
 * Atlas Platform — Ops / Docs / Finance / HR shell (UI only).
 * Reuses existing quote + NRS data; no calc/save/schema changes.
 */
(function () {
  'use strict';

  function esc(s) {
    if (s == null) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  }

  function refId(q) {
    return typeof window.getQuoteRefId === 'function' ? window.getQuoteRefId(q) : q.id;
  }

  function deskName(q) {
    return (window.TEAM_ROLES && window.TEAM_ROLES[q.creator] && window.TEAM_ROLES[q.creator].name) || q.creator || '—';
  }

  function nrsByQuoteId() {
    const map = {};
    (window._nrsRegistryCached || []).forEach(function (item) {
      if (item && item.id) map[item.id] = item;
    });
    return map;
  }

  window.renderOpsCommandCenter = function () {
    const tbody = document.getElementById('ops-shipments-body');
    const meta = document.getElementById('ops-shipment-meta');
    const chips = document.getElementById('ops-pipeline-chips');
    if (!tbody) return;

    const user = window.appState && window.appState.currentUser;
    const isAdmin = typeof window.isAdminUser === 'function' && window.isAdminUser(user);
    let won = (window.appState && window.appState.quotes || []).filter(function (q) {
      return q.status === 'converted';
    });
    if (!isAdmin && user) {
      won = won.filter(function (q) { return q.creator === user; });
    }

    const nrsMap = nrsByQuoteId();
    let pendingDocs = 0;
    let ready = 0;
    won.forEach(function (q) {
      const nrs = nrsMap[q.id];
      if (nrs && nrs.pendingShipperDetails) pendingDocs += 1;
      else ready += 1;
    });

    if (meta) {
      meta.textContent = won.length + ' won shipment' + (won.length === 1 ? '' : 's') + ' · ' + pendingDocs + ' awaiting shipper/consignee';
    }
    if (chips) {
      chips.innerHTML =
        '<span class="ops-chip is-active">All <b>' + won.length + '</b></span>' +
        '<span class="ops-chip">Docs pending <b>' + pendingDocs + '</b></span>' +
        '<span class="ops-chip">Ready <b>' + ready + '</b></span>';
    }

    if (won.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" class="ops-empty">No won shipments yet. Convert a quoted enquiry to populate Operations.</td></tr>';
      return;
    }

    won.sort(function (a, b) {
      return new Date(b.conversionDate || b.date) - new Date(a.conversionDate || a.date);
    });

    tbody.innerHTML = won.map(function (q) {
      const nrs = nrsMap[q.id];
      const route = q.route || ((q.details && q.details.origin) ? q.details.origin + ' → ' + (q.details.destination || '') : '—');
      const carrier = (q.details && (q.details.airline || q.details.shippingLine || q.details.carrier)) || '—';
      const wonDate = q.conversionDate || q.date || '—';
      const stage = nrs && nrs.pendingShipperDetails
        ? '<span class="ops-stage ops-stage-warn">Docs pending</span>'
        : '<span class="ops-stage ops-stage-ok">Execution</span>';
      const tonnage = typeof window.getQuoteBillingWeightMeta === 'function'
        ? window.getQuoteBillingWeightMeta(q).html
        : esc(typeof window.getQuoteBillingWeight === 'function' ? window.getQuoteBillingWeight(q) : '—');

      return '<tr data-quote-id="' + esc(q.id) + '">' +
        '<td><strong>#' + esc(refId(q)) + '</strong></td>' +
        '<td>' + esc(wonDate) + '</td>' +
        '<td>' + esc(q.customer || '—') + '</td>' +
        '<td>' + esc(route) + '</td>' +
        '<td>' + esc((q.type || '').toUpperCase()) + ' · ' + esc(carrier) + '</td>' +
        '<td>' + tonnage + '</td>' +
        '<td>' + stage + '</td>' +
        '<td class="ops-actions">' +
        '<button type="button" class="edb-act edb-act-view" onclick="viewSavedQuote(\'' + esc(q.id) + '\')">Quote</button>' +
        (isAdmin ? '<button type="button" class="edb-act" onclick="goHome(); if(typeof switchDeskTab===\'function\') switchDeskTab(\'manager-panel\',\'enquiry-database\',null);">Enquiry DB</button>' : '') +
        '</td></tr>';
    }).join('');
  };

  window.renderPlatformRoadmap = function (moduleKey) {
    const root = document.getElementById('platform-roadmap-root');
    if (!root) return;

    const plans = {
      documentation: {
        phase: 'Phase 2',
        title: 'Documentation',
        subtitle: 'Shipment file checklist — AWB/BL, invoices, packing lists',
        accent: 'var(--violet)',
        live: ['Circulars library (carrier notices)', 'Quote print with package dimensions', 'Agency agreement on NRS convert'],
        next: ['Doc checklist per won shipment', 'Generate AWB/BL from quote data', 'Versioned uploads + audit trail']
      },
      finance: {
        phase: 'Phase 3',
        title: 'Finance',
        subtitle: 'Accruals, invoicing, and AR from quoted buy/sell/GP',
        accent: 'var(--green)',
        live: ['Enquiry DB GP % / amount toggle', 'Financial reports + CSV export', '90-day archive lookup'],
        next: ['Invoice from won quote', 'Buy/sell accrual lock', 'AR aging + desk P&L']
      },
      hr: {
        phase: 'Phase 4',
        title: 'Human Resources',
        subtitle: 'Desks, targets, leave — after ops money flow is stable',
        accent: 'var(--amber)',
        live: ['Desk roles (TEAM_ROLES)', 'Admin user registration', 'Per-desk quote ownership'],
        next: ['Leave calendar', 'Desk KPI targets', 'Attendance + handover']
      }
    };

    const plan = plans[moduleKey] || plans.documentation;
    root.innerHTML =
      '<div class="platform-roadmap-card" style="--platform-accent:' + plan.accent + '">' +
      '<span class="platform-phase">' + esc(plan.phase) + '</span>' +
      '<h2 class="platform-roadmap-title">' + esc(plan.title) + '</h2>' +
      '<p class="platform-roadmap-sub">' + esc(plan.subtitle) + '</p>' +
      '<div class="platform-roadmap-grid">' +
      '<div class="platform-roadmap-col"><h4>Live today</h4><ul>' +
      plan.live.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') +
      '</ul></div>' +
      '<div class="platform-roadmap-col"><h4>Building next</h4><ul>' +
      plan.next.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') +
      '</ul></div></div>' +
      '<div class="platform-roadmap-actions">' +
      (moduleKey === 'finance'
        ? '<button type="button" class="btn-primary" onclick="openActiveCalculator(\'ops\'); goHome(); if(typeof switchDeskTab===\'function\') switchDeskTab(\'manager-panel\',\'enquiry-database\',null);">Open financial reports</button>'
        : '') +
      (moduleKey === 'documentation'
        ? '<button type="button" class="btn-secondary" onclick="openActiveCalculator(\'circulars\')">Open Circulars</button>'
        : '') +
      '<button type="button" class="btn-secondary" onclick="openActiveCalculator(\'ops\')">Operations board</button>' +
      '<button type="button" class="btn-text" onclick="goHome()">Back to Home</button>' +
      '</div></div>';

    root.setAttribute('data-module', moduleKey);
  };

  /** Refresh NRS cache then render ops (best-effort). */
  window.refreshOpsBoard = function () {
    if (typeof window.renderNrsRegistryDatabase === 'function') {
      try {
        window.renderNrsRegistryDatabase();
      } catch (e) { /* non-blocking */ }
    }
    window.renderOpsCommandCenter();
  };
})();

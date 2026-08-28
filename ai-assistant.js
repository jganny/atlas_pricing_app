/**
 * Atlas Help — navigation & workflow assistant (UI only).
 * Uses cloud AI when atlasCopilot is deployed; falls back to built-in guides.
 */
(function () {
  'use strict';

  var busy = false;

  var LOCAL_HELP = {
    'how do i save an air freight quote': 'Open Air Freight from the sidebar, complete Shipment Details and Carrier & Tariffs, then click Save Quote in the sticky bar at the top. Use Reset only when starting a fresh quote.',
    'how do i save a quote': 'On any desk (Air, Sea, Transport, Warehouse), complete the form and click Save Quote in the sticky highlights bar at the top.',
    'explain the difference between air nomination and free hand pricing desks': 'Air Nomination desks quote in USD for nominated agent flows. Free Hand desks quote in INR for direct sales. Currency and agency rules adjust automatically per role — your formulas are unchanged.',
    'draft a short professional follow-up email for a quoted shipment': 'Subject: Freight Quotation — [Ref ID]\n\nDear [Agent Name],\n\nThank you for your enquiry. Please find our quotation for [Origin] to [Destination] attached. Rates are valid as noted on the quote. Let us know if you would like to proceed or need any adjustments.\n\nBest regards,\nAtlas Pricing Team'
  };

  function ui() {
    return window.__atlasUi || {};
  }

  function formatQuoteContext(quote) {
    if (!quote) return '';
    var refFn = typeof window.getQuoteRefId === 'function' ? window.getQuoteRefId : function (q) { return q.id; };
    var lines = [
      'Selected enquiry (read-only):',
      'Ref: ' + refFn(quote),
      'Date: ' + (quote.date || '—'),
      'Mode: ' + (quote.type || '—'),
      'Customer: ' + (quote.customer || '—'),
      'Route: ' + (quote.route || '—'),
      'Status: ' + (quote.status || '—')
    ];
    return lines.join('\n');
  }

  function matchLocalHelp(message) {
    var key = (message || '').toLowerCase().trim();
    if (LOCAL_HELP[key]) return LOCAL_HELP[key];
    for (var k in LOCAL_HELP) {
      if (key.indexOf(k) !== -1 || k.indexOf(key) !== -1) return LOCAL_HELP[k];
    }
    if (key.indexOf('save') !== -1 && key.indexOf('quote') !== -1) return LOCAL_HELP['how do i save a quote'];
    if (key.indexOf('nomination') !== -1 || key.indexOf('free hand') !== -1) return LOCAL_HELP['explain the difference between air nomination and free hand pricing desks'];
    if (key.indexOf('email') !== -1 || key.indexOf('follow') !== -1) return LOCAL_HELP['draft a short professional follow-up email for a quoted shipment'];
    if (key.indexOf('air') !== -1 && key.indexOf('desk') !== -1) return 'Press ⌘K (Ctrl+K) and choose Air Freight Desk, or use the sidebar → Air Freight.';
    if (key.indexOf('sea') !== -1) return 'Press ⌘K (Ctrl+K) and choose Sea Freight Desk, or use the sidebar → Sea Freight.';
    if (key.indexOf('enquiry') !== -1 || key.indexOf('database') !== -1) return 'Admin → Enquiry Database tab. Click a row to inspect details in the right panel. Use filters at the top to narrow results.';
    return null;
  }

  function appendMessage(role, text) {
    var log = document.getElementById('atlas-copilot-log');
    if (!log) return;
    var bubble = document.createElement('div');
    bubble.className = 'atlas-copilot-msg atlas-copilot-msg-' + role;
    bubble.textContent = text;
    log.appendChild(bubble);
    log.scrollTop = log.scrollHeight;
  }

  function setBusy(on) {
    busy = on;
    var btn = document.getElementById('atlas-copilot-send');
    var input = document.getElementById('atlas-copilot-input');
    if (btn) btn.disabled = on;
    if (input) input.disabled = on;
  }

  function togglePanel(forceOpen) {
    var panel = document.getElementById('atlas-copilot-panel');
    if (!panel) return;
    var open = forceOpen === true ? true : (forceOpen === false ? false : !panel.classList.contains('open'));
    panel.classList.toggle('open', open);
    panel.setAttribute('aria-hidden', open ? 'false' : 'true');
    if (open) {
      var input = document.getElementById('atlas-copilot-input');
      if (input) window.setTimeout(function () { input.focus(); }, 80);
    }
  }

  async function sendMessage() {
    if (busy) return;
    var input = document.getElementById('atlas-copilot-input');
    if (!input) return;
    var message = (input.value || '').trim();
    if (!message) return;

    if (includeQuote && typeof window.getSelectedEnquiryQuote === 'function') {
      var selected = window.getSelectedEnquiryQuote();
      if (selected) quoteContext = formatQuoteContext(selected);
      else {
        appendMessage('user', message);
        appendMessage('assistant', 'No enquiry row selected. Open Admin → Enquiry Database and click a row, or uncheck the include option.');
        setBusy(false);
        return;
      }
    }

    appendMessage('user', message);
    input.value = '';
    setBusy(true);

    var local = matchLocalHelp(message);
    if (local) {
      var localReply = local;
      if (quoteContext) localReply = quoteContext + '\n\n' + local;
      appendMessage('assistant', localReply);
      setBusy(false);
      return;
    }

    var fullMessage = quoteContext ? (quoteContext + '\n\nUser question: ' + message) : message;

    try {
      if (!window.firebase || !firebase.functions) throw new Error('offline');
      var fn = firebase.functions().httpsCallable('atlasCopilot');
      var result = await fn({
        message: fullMessage,
        workspace: typeof ui().getWorkspaceName === 'function' ? ui().getWorkspaceName() : 'Dashboard',
        role: typeof ui().getCurrentUser === 'function' ? (ui().getCurrentUser() || 'user') : 'user'
      });
      var reply = (result && result.data && result.data.reply) || 'No response.';
      appendMessage('assistant', reply);
    } catch (err) {
      appendMessage('assistant',
        'Built-in help: try the quick buttons above, or press ⌘K (Ctrl+K) to jump between modules. ' +
        'For pricing, use Air / Sea / Transport / Warehouse desks — rates are calculated there, not here. ' +
        'Full AI chat will be enabled when the server function is deployed.');
    } finally {
      setBusy(false);
    }
  }

  function bindQuickPrompts() {
    document.querySelectorAll('[data-copilot-prompt]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var input = document.getElementById('atlas-copilot-input');
        if (input) input.value = btn.getAttribute('data-copilot-prompt') || '';
        sendMessage();
      });
    });
  }

  function init() {
    var fab = document.getElementById('atlas-copilot-fab');
    if (fab) fab.addEventListener('click', function () { togglePanel(); });
    var closeBtn = document.getElementById('atlas-copilot-close');
    if (closeBtn) closeBtn.addEventListener('click', function () { togglePanel(false); });
    var sendBtn = document.getElementById('atlas-copilot-send');
    if (sendBtn) sendBtn.addEventListener('click', sendMessage);
    var input = document.getElementById('atlas-copilot-input');
    if (input) {
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          sendMessage();
        }
      });
    }
    bindQuickPrompts();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.toggleAtlasCopilot = togglePanel;
})();

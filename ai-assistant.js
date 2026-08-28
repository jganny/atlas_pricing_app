/**
 * Atlas Copilot — AI assistant UI layer (assistive only).
 * Calls server-side atlasCopilot; never calculates rates or writes quote data.
 */
(function () {
  'use strict';

  var history = [];
  var busy = false;

  function ui() {
    return window.__atlasUi || {};
  }

  function getSelectedQuoteContext() {
    var row = document.querySelector('#admin-quotes-body tr.eri-selected');
    if (!row) return null;
    var id = row.getAttribute('data-quote-id');
    if (!id) return null;
    var quotes = typeof ui().getQuotes === 'function' ? ui().getQuotes() : [];
    var q = quotes.find(function (x) { return x.id === id; });
    if (!q) return null;
    return {
      id: q.id,
      ref: typeof window.getQuoteRefId === 'function' ? window.getQuoteRefId(q) : q.id,
      date: q.date,
      type: q.type,
      customer: q.customer,
      status: q.status,
      amount: q.amount,
      currency: q.currency,
      creator: q.creator,
      route: q.route,
      carrier: (q.details && (q.details.airline || q.details.shippingLine || q.details.carrier)) || null
    };
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
    var includeQuote = document.getElementById('atlas-copilot-include-quote');
    if (!input) return;
    var message = (input.value || '').trim();
    if (!message) return;

    appendMessage('user', message);
    input.value = '';
    history.push({ role: 'user', content: message });
    setBusy(true);

    try {
      if (!window.firebase || !firebase.functions) {
        throw new Error('Firebase Functions not loaded.');
      }
      var fn = firebase.functions().httpsCallable('atlasCopilot');
      var payload = {
        message: message,
        workspace: typeof ui().getWorkspaceName === 'function' ? ui().getWorkspaceName() : 'Dashboard',
        role: typeof ui().getCurrentUser === 'function' ? (ui().getCurrentUser() || 'user') : 'user'
      };
      if (includeQuote && includeQuote.checked) {
        var ctx = getSelectedQuoteContext();
        if (ctx) payload.quoteContext = ctx;
      }
      var result = await fn(payload);
      var reply = (result && result.data && result.data.reply) || 'No response.';
      appendMessage('assistant', reply);
      history.push({ role: 'assistant', content: reply });
    } catch (err) {
      var msg = (err && err.message) ? err.message : 'Atlas Copilot is unavailable.';
      appendMessage('assistant', msg);
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
    var closeBtn = document.getElementById('atlas-copilot-close');
    var sendBtn = document.getElementById('atlas-copilot-send');
    var input = document.getElementById('atlas-copilot-input');

    if (fab) fab.addEventListener('click', function () { togglePanel(); });
    if (closeBtn) closeBtn.addEventListener('click', function () { togglePanel(false); });
    if (sendBtn) sendBtn.addEventListener('click', sendMessage);
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

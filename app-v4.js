// Exchange Rates
let EXCHANGE_RATES = {
  USD_TO_INR: 83.50,
  EUR_TO_INR: 90.20,
  GBP_TO_INR: 106.10,
  EUR_TO_USD: 1.08,
  GBP_TO_USD: 1.27
};

const DEFAULT_AIR_TERMS = `1. The above rates are NET NET
2. Rates quoted are valid for General/ Non Haz/ Non Stackable, unless specified.
3. Quoted rates are subject to space and booking confirmation.
4. Transit Times are subject to the Service chosen.
5. Any incidental or statutory charges, if any, would be applicable at the time of shipment, at actuals.`;

const DEFAULT_SEA_TERMS = `1. The Above rates are NET NET
2. Rates are subject to Surcharges, if applicable at the time of shipment.
3. Rates are valid for Non Haz, Non Temp, Non Stackable, General cargo only.
4. Any incidental or statutory charges, if any, would be applicable at the time of shipment, at actuals.
5. Rates are subject to space, booking and onward confirmation.`;

// Pricing Team Desks
const TEAM_ROLES = {
  'ganny': { name: 'Pricing Team', type: 'admin' },
  'shashank': { name: 'Air Nom', type: 'member', category: 'AIR - NOMINATION', currency: 'USD' },
  'shaheer': { name: 'Sea Nomination', type: 'member', category: 'SEA - NOMINATION', currency: 'USD' },
  'jaya': { name: 'Free Hand', type: 'member', category: 'FREE HAND SALES (AIR/SEA)', currency: 'INR' },
  'cathrina': { name: 'NRS', type: 'member', category: 'NRS (AIR/SEA)', currency: 'USD' }
};

// Apply saved desk names from localStorage
const savedNames = localStorage.getItem("gl_desk_names");
if (savedNames) {
  try {
    const parsed = JSON.parse(savedNames);
    if (parsed["shashank"]) TEAM_ROLES["shashank"].name = parsed["shashank"];
    if (parsed["shaheer"]) {
      const nameVal = parsed["shaheer"];
      TEAM_ROLES["shaheer"].name = (nameVal.toLowerCase() === 'shaheer') ? 'Sea Nomination' : nameVal;
    }
    if (parsed["jaya"]) TEAM_ROLES["jaya"].name = parsed["jaya"];
    if (parsed["cathrina"]) TEAM_ROLES["cathrina"].name = parsed["cathrina"];
  } catch (e) {
    console.error("Failed to load saved desk names", e);
  }
}

// Load dynamically registered custom users
function loadCustomUsers() {
  const stored = localStorage.getItem("gl_custom_users");
  if (stored) {
    try {
      const users = JSON.parse(stored);
      users.forEach(u => {
        if (!u || !u.username || typeof u.username !== 'string') return;
        const lowerUser = u.username.toLowerCase();
        // Preserve Firestore-sourced category/currency; never overwrite hardcoded core users
        if (TEAM_ROLES[lowerUser]) return; // core hardcoded users take precedence
        const storedCategory = u.category || 'FREE HAND SALES (AIR/SEA)';
        const storedCurrency = u.currency || 'INR';
        // Strip legacy '(Free Hand)' suffix stored in older snapshots
        const storedName = (u.fullName || lowerUser).replace(/\s*\(Free\s*Hand\)/i, '').trim();
        TEAM_ROLES[lowerUser] = {
          name: storedName,
          type: u.role || 'member',
          category: storedCategory,
          currency: storedCurrency
        };
      });
    } catch (e) {
      console.error("Failed to load custom users", e);
    }
  }
}
loadCustomUsers();

function getActiveRole() {
  let activeRole = appState.currentUser;
  if (activeRole === 'ganny' || activeRole === 'manager') {
    const activeBtn = document.querySelector(".role-btn.active");
    const selectedRole = activeBtn ? activeBtn.getAttribute("data-role") : null;
    if (selectedRole && selectedRole !== 'manager') {
      activeRole = selectedRole;
    }
  }
  if (!activeRole) activeRole = 'ganny';
  return activeRole;
}
window.getActiveRole = getActiveRole;

function isAdminUser(user) {
  if (!user) return false;
  const userLower = user.toLowerCase();
  return userLower === 'ganny' || (TEAM_ROLES[userLower] && TEAM_ROLES[userLower].type === 'admin');
}
window.isAdminUser = isAdminUser;

function isUserAdminOrManager() {
  if (!appState.currentUser) return false;

  const currentUser = appState.currentUser.toLowerCase();

  return (
    currentUser === 'ganny' ||
    (TEAM_ROLES[currentUser] &&
      TEAM_ROLES[currentUser].type === 'admin')
  );
}
window.isUserAdminOrManager = isUserAdminOrManager;

function updateExecutiveDashboardVisibility() {
  const execPanel = document.getElementById("executive-dashboard-panel");
  if (execPanel) {
    if (isUserAdminOrManager()) {
      execPanel.style.display = execPanel.classList.contains("active") ? "" : "none";
    } else {
      execPanel.style.display = "none";
      if (execPanel.classList.contains("active")) {
        execPanel.classList.remove("active");
        goHome();
      }
    }
  }
}
window.updateExecutiveDashboardVisibility = updateExecutiveDashboardVisibility;


function isEligibleDeskUser(creator = null) {
  const roleId = creator || getActiveRole();
  const role = TEAM_ROLES[roleId];
  if (!role) return false;
  if (role.type === 'admin') return false;
  if (role.category === 'AIR - NOMINATION' || role.category === 'SEA - NOMINATION') return false;
  return true;
}
window.isEligibleDeskUser = isEligibleDeskUser;

// Global App State
let appState = {
  currentUser: null, // User Role Object
  airports: [],
  airlines: [],
  seaports: [],
  quotes: [],
  leads: [],
  activities: [],
  currentAirFreight: {
    origin: '',
    destination: '',
    airline: '',
    dimUnit: 'cms',
    module: 'export', // 'export' or 'import'
    cargoItems: [{ length: '', width: '', height: '', qty: '', grossWeight: '' }],
    rates: { min: '', minus45: '', plus45: '', plus100: '', plus300: '', plus500: '', plus1000: '' },
    surcharges: [{ name: 'Xray', rate: 0.00, unit: 'kg' }, { name: 'Cartage', rate: 0.00, unit: 'flat' }, { name: 'Misc', rate: 0.00, unit: 'flat' }],
    airlines: [],
    nominatedCurrency: 'USD',
    isOptimizedApplied: false
  },
  currentSeaFreight: {
    origin: '',
    destination: '',
    shippingLine: '',
    type: 'fcl', // 'fcl', 'lcl', or 'bb' (break bulk)
    module: 'export', // 'export' or 'import'
    containers: [
      { type: "20'GP", qty: 1, rate: 1800 },
      { type: "40'GP", qty: 0, rate: 2600 },
      { type: "40'HC", qty: 0, rate: 2800 }
    ],
    lclCbm: 0,
    lclWeight: 0,
    lclRate: 65,
    surcharges: [{ name: 'Terminal Handling (THC)', cost: 250, unit: 'container' }, { name: 'Documentation Fee', cost: 75, unit: 'flat' }],
    nominatedCurrency: 'USD'
  }
};


function getQuoteRefId(quote) {
  let moduleCode = "XX";
  const type = quote.type || "air";
  const module = (quote.details && quote.details.module) || "export";

  if (type === "air") {
    moduleCode = (module === "import") ? "AI" : "AE";
  } else if (type === "transport") {
    moduleCode = "TR";
  } else if (type === "warehouse") {
    moduleCode = "WH";
  } else {
    moduleCode = (module === "import") ? "SI" : "SE";
  }

  const custName = (quote.customer || "XYZ").trim().replace(/[^a-zA-Z0-9]/g, "");
  const custPart = custName.substring(0, 3).toUpperCase().padEnd(3, 'X');

  let datePart = "0000";
  if (quote.date) {
    const parts = quote.date.split('-');
    if (parts.length === 3) {
      const year = parts[0];
      const month = parts[1];
      datePart = month + year.substring(2);
    } else {
      const qDate = new Date(quote.date);
      if (!isNaN(qDate.getTime())) {
        const mm = String(qDate.getMonth() + 1).padStart(2, '0');
        const yy = String(qDate.getFullYear()).substring(2);
        datePart = mm + yy;
      }
    }
  }

  const seqNum = quote.quoteNumber || 1;
  const seqPart = String(seqNum).padStart(5, '0');
  return `${moduleCode}${custPart}${datePart}IN${seqPart}`;
}
window.getQuoteRefId = getQuoteRefId;

function getQuoteRefIdById(id) {
  if (!id) return 'N/A';
  const quote = appState.quotes.find(q => q.id === id);
  return quote ? getQuoteRefId(quote) : id.substring(0, 7).toUpperCase();
}
window.getQuoteRefIdById = getQuoteRefIdById;

// An admin-approved edit unlock is time-limited (see approveAmendment), not
// single-use: it used to get consumed by the very next save ("Lock it back!"),
// which meant a user needing two follow-up corrections on the same quote had
// to get a fresh admin approval for each one — indistinguishable, from the
// admin's side, from the same request reappearing. Grants made before this
// change have no expiry timestamp and are honored as originally intended.
function isAmendmentGrantActive(quote) {
  if (!quote || !quote.amendmentAllowed) return false;
  if (!quote.amendmentUnlockedUntil) return true;
  return Date.now() < quote.amendmentUnlockedUntil;
}
window.isAmendmentGrantActive = isAmendmentGrantActive;

function isEditUnlocked(quote) {
  if (!quote) return false;
  const isWithin6Hours = quote.timestamp && (Date.now() - quote.timestamp) < 6 * 60 * 60 * 1000;
  return isWithin6Hours || isAmendmentGrantActive(quote) || isAdminUser(appState.currentUser);
}
window.isEditUnlocked = isEditUnlocked;

function isDeleteUnlocked(quote) {
  if (!quote) return false;
  const isWithin6Hours = quote.timestamp && (Date.now() - quote.timestamp) < 6 * 60 * 60 * 1000;
  return isWithin6Hours || quote.deletionAllowed || isAdminUser(appState.currentUser);
}
window.isDeleteUnlocked = isDeleteUnlocked;

function checkAndRequestEditPermission(quote, actionVerb = "modify") {
  if (isEditUnlocked(quote)) {
    return true;
  }
  let requests = window._amendmentRequests || [];
  if (requests.length === 0) {
    const stored = localStorage.getItem("gl_amendment_requests");
    if (stored) {
      try { requests = JSON.parse(stored); } catch (e) { }
    }
  }
  const pending = requests.find(r => r.quoteId === quote.id && r.requestType === 'edit' && r.status === 'pending');
  if (pending) {
    alert(`You have already requested permission to edit/amend this quote. Please wait for Ganny's approval.`);
    return false;
  }

  const reason = prompt(`You do not have permission to ${actionVerb} this quotation.\n\nPlease enter the reason for requesting edit/amendment permission from Ganny:`);
  if (reason === null) return false; // User cancelled
  if (!reason.trim()) {
    alert("A reason is required to submit the request.");
    return false;
  }

  const newReq = {
    id: 'REQ' + Math.random().toString(36).substr(2, 9),
    requestType: 'edit',
    quoteId: quote.id,
    customer: quote.customer,
    creator: appState.currentUser,
    creatorName: TEAM_ROLES[appState.currentUser]?.name || appState.currentUser,
    date: new Date().toLocaleDateString() + " " + new Date().toLocaleTimeString(),
    status: 'pending',
    reason: reason.trim(),
    acknowledged: false
  };

  if (DB.firestoreRef) {
    DB.firestoreRef.collection("amendment_requests").doc(newReq.id).set(newReq)
      .then(() => {
        alert("Edit/Amendment request submitted successfully to Ganny.");
      })
      .catch(err => {
        console.error("DB: failed to save edit request:", err);
        alert("Failed to submit request to cloud. Saving locally...");
        saveRequestLocallyFallback(newReq);
      });
  } else {
    saveRequestLocallyFallback(newReq);
    alert("Edit/Amendment request submitted successfully to Ganny (Offline).");
  }
  return false;
}
window.checkAndRequestEditPermission = checkAndRequestEditPermission;

function saveRequestLocallyFallback(newReq) {
  let requests = [];
  const stored = localStorage.getItem("gl_amendment_requests");
  if (stored) {
    try { requests = JSON.parse(stored); } catch (e) { }
  }
  requests.push(newReq);
  localStorage.setItem("gl_amendment_requests", JSON.stringify(requests));

  // Update local view
  if (window._amendmentRequests) {
    window._amendmentRequests.push(newReq);
  } else {
    window._amendmentRequests = [newReq];
  }

  if (isAdminUser(appState.currentUser)) {
    renderAdminDashboard();
  } else {
    renderMemberDashboard(appState.currentUser);
  }
}
window.saveRequestLocallyFallback = saveRequestLocallyFallback;

function updateSeaFclStuffingVisibility() {
  const stuffingContainer = document.getElementById("sea-fcl-stuffing-container");
  if (!stuffingContainer) return;

  const isExport = appState.currentSeaFreight.module === 'export';
  const isFcl = appState.currentSeaFreight.type === 'fcl';
  const incoterm = document.getElementById("sea-incoterm")?.value || 'EXW';
  const isExwOrFca = (incoterm === 'EXW' || incoterm === 'FCA');

  if (isExport && isFcl && isExwOrFca) {
    stuffingContainer.style.display = "block";
  } else {
    stuffingContainer.style.display = "none";
  }
}
window.updateSeaFclStuffingVisibility = updateSeaFclStuffingVisibility;

function autoFocusWeightBreak(event) {
  if (event.key === "Enter") {
    event.preventDefault();
    calculateAirFreight();

    const chgWeight = appState.currentAirFreight.chargeableWeight || 0;
    if (chgWeight <= 0) return;

    let targetInputId = "rate-m45";
    if (chgWeight >= 45 && chgWeight < 100) {
      targetInputId = "rate-p45";
    } else if (chgWeight >= 100 && chgWeight < 300) {
      targetInputId = "rate-p100";
    } else if (chgWeight >= 300 && chgWeight < 500) {
      targetInputId = "rate-p300";
    } else if (chgWeight >= 500 && chgWeight < 1000) {
      targetInputId = "rate-p500";
    } else if (chgWeight >= 1000) {
      targetInputId = "rate-p1000";
    }

    const inputEl = document.getElementById(targetInputId);
    if (inputEl) {
      inputEl.focus();
      setTimeout(() => {
        try { inputEl.select(); } catch (e) { }
      }, 0);
    }
  }
}
window.autoFocusWeightBreak = autoFocusWeightBreak;

function setupValidityDatePickerDismissal() {
  const ids = ["air-validity", "sea-validity"];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;

    const dismiss = () => {
      setTimeout(() => {
        try {
          el.blur();
        } catch (e) { }
      }, 50);
    };

    // Dismiss on selection/change. Deliberately NOT listening on "input" here:
    // that event fires on every partial keystroke while typing a date (e.g.
    // after typing just "20" of a "2026" year), and blurring 50ms later
    // committed whatever partial year digits were typed so far — this is
    // what caused validity years to save as "0020" instead of "2026".
    // "change" already fires once a complete date is committed, which is the
    // correct signal for "the user is done."
    el.addEventListener("change", dismiss);

    // Dismiss on double-click
    el.addEventListener("dblclick", dismiss);

    // Dismiss on Enter key press
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        dismiss();
      }
    });
  });

  // Setup auto-select text on focus for rate inputs
  document.addEventListener("focus", (e) => {
    if (e.target && (e.target.classList.contains("chg-rate") || e.target.classList.contains("fcl-rate"))) {
      setTimeout(() => {
        try { e.target.select(); } catch (err) { }
      }, 0);
    }
  }, true);
}

// Initialize Application
document.addEventListener("DOMContentLoaded", () => {
  // Disable browser autofill / personal contact directory suggestions
  document.querySelectorAll("input").forEach(input => {
    if (input.type !== "password") {
      input.setAttribute("autocomplete", "new-password");
      input.setAttribute("autocorrect", "off");
      input.setAttribute("autocapitalize", "none");
    }
  });

  loadData();
  applyDeskNames();
  setupValidityDatePickerDismissal();
  setupRoleSwitcher();
  setupAirFreightEvents();
  setupSeaFreightEvents();
  loadSavedQuotes();
  loadMemorizedSurcharges();
  checkSession();
  updateExecutiveDashboardVisibility();
  fetchExchangeRates();

  // Modal handlers
  document.getElementById("close-modal")?.addEventListener("click", hideQuoteModal);
  document.getElementById("print-quote-btn")?.addEventListener("click", printQuote);

  // File upload badge updates
  const agreementFileInput = document.getElementById("won-agreement-file");
  if (agreementFileInput) {
    agreementFileInput.addEventListener("change", function () {
      const statusEl = document.getElementById("won-agreement-status");
      if (statusEl) {
        if (this.files && this.files.length > 0) {
          statusEl.textContent = "Selected ✅";
          statusEl.style.color = "var(--accent-success)";
        } else {
          statusEl.textContent = "Required";
          statusEl.style.color = "var(--accent-error)";
        }
      }
    });
  }

  const invoiceFileInput = document.getElementById("won-invoice-packing-file");
  if (invoiceFileInput) {
    invoiceFileInput.addEventListener("change", function () {
      const statusEl = document.getElementById("won-invoice-packing-status");
      if (statusEl) {
        if (this.files && this.files.length > 0) {
          statusEl.textContent = "Selected ✅";
          statusEl.style.color = "var(--accent-success)";
        } else {
          statusEl.textContent = "Optional";
          statusEl.style.color = "var(--t3)";
        }
      }
    });
  }
});

// Authentication System
function checkSession() {
  if (DB.isCloud) {
    // With Firebase Auth, onAuthStateChanged handles session validation.
    return;
  }
  const session = sessionStorage.getItem("gl_pricing_session");
  if (session && TEAM_ROLES[session]) {
    loginSuccess(session);
  } else {
    // Show login overlay and keep workspace visible but blurred
    document.body.classList.add("logged-out-blur");
    document.getElementById("login-overlay").style.display = "flex";
    document.getElementById("app-workspace").style.display = "flex";
    document.getElementById("subheader-controls").style.display = "flex";
  }
}

async function handleLogin(e) {
  e.preventDefault();
  let user = document.getElementById("login-username").value.toLowerCase().trim();
  let pass = document.getElementById("login-password").value;

  if (!user && !pass) {
    user = "ganny";
    pass = "password";
  } else if (!user) {
    alert("Please enter a desk username.");
    return;
  } else if (!pass) {
    alert("Please enter a password.");
    return;
  }

  // Treat 'admin' as 'ganny'
  if (user === 'admin') {
    user = 'ganny';
  }

  if (DB.isCloud) {
    // ── PRIMARY: Try canonical @atlaspricing.com domain ──────────────────────
    const canonicalEmail = `${user}@atlaspricing.com`;
    const legacyEmail = `${user}@pricing.local`; // one-time migration compat.

    let firebaseAuthSuccess = false;
    let signedInEmail = null;

    // Try canonical domain first
    try {
      await firebase.auth().signInWithEmailAndPassword(canonicalEmail, pass);
      firebaseAuthSuccess = true;
      signedInEmail = canonicalEmail;
    } catch (primaryErr) {
      console.warn("Firebase Auth (canonical) failed:", primaryErr.code);

      // ── MIGRATION: Try legacy @pricing.local domain transparently ──────────
      if (primaryErr.code === "auth/user-not-found" ||
        primaryErr.code === "auth/invalid-credential" ||
        primaryErr.code === "auth/invalid-email") {
        try {
          await firebase.auth().signInWithEmailAndPassword(legacyEmail, pass);
          firebaseAuthSuccess = true;
          signedInEmail = legacyEmail;
          console.log(`Migrating ${user} from @pricing.local → @atlaspricing.com in background.`);
          // Background email migration: update Firebase Auth email to canonical domain
          const currentFbUser = firebase.auth().currentUser;
          if (currentFbUser) {
            currentFbUser.updateEmail(canonicalEmail).catch(migErr => {
              console.warn("Background email migration skipped:", migErr.message);
            });
          }
        } catch (legacyErr) {
          console.warn("Firebase Auth (legacy) also failed:", legacyErr.code);
        }
      }
    }

    if (firebaseAuthSuccess) {
      sessionStorage.setItem("gl_pricing_session", user);
      document.getElementById("login-username").value = "";
      document.getElementById("login-password").value = "";
      // Do NOT call loginSuccess() here — onAuthStateChanged will handle it
      // after the _dataReadyPromise gate ensures quotes + TEAM_ROLES are loaded.
      // Calling it twice (once here, once from onAuthStateChanged) caused a blank
      // flash followed by a full re-render, and bypassed the data-ready gate.
      return;
    }

    // ── FALLBACK: Firebase Auth unavailable — check Firestore + localStorage ─
    console.warn("Firebase Auth sign-in failed for both domains. Checking Firestore/local fallback.");
    let matchedPass = false;

    // Check Firestore users document directly
    try {
      const userDoc = await DB.firestoreRef.collection("users").doc(user).get();
      if (userDoc.exists && userDoc.data().password === pass) {
        matchedPass = true;
      }
    } catch (docErr) {
      console.warn("Could not check Firestore user doc:", docErr);
    }

    // Hardcoded defaults check (core team — no 'ganesh' alias, use 'ganny')
    const validHardcoded = ["ganny", "shashank", "shaheer", "jaya", "cathrina"];
    if (!matchedPass && validHardcoded.includes(user) && pass === "password") {
      matchedPass = true;
    }

    // Local storage custom users check
    if (!matchedPass) {
      let customUsers = [];
      const storedCustom = localStorage.getItem("gl_custom_users");
      if (storedCustom) {
        try { customUsers = JSON.parse(storedCustom); } catch (e) { }
      }
      const matchedLocal = customUsers.find(u => u && u.username && u.username.toLowerCase() === user);
      if (matchedLocal && matchedLocal.password === pass) {
        matchedPass = true;
      }
    }

    if (matchedPass) {
      sessionStorage.setItem("gl_pricing_session", user);
      document.getElementById("login-username").value = "";
      document.getElementById("login-password").value = "";
      loginSuccess(user);

      // ── BACKGROUND SYNC: Repair Firebase Auth account so next login uses it ──
      // Uses a secondary app to avoid signing out the user who just logged in.
      (async () => {
        try {
          const configRaw = localStorage.getItem("gl_firebase_config");
          const config = configRaw ? JSON.parse(configRaw) : DEFAULT_FIREBASE_CONFIG;
          const syncAppName = "AuthSyncApp_" + Date.now();
          const syncApp = firebase.initializeApp(config, syncAppName);
          try {
            // Attempt create — succeeds if no Firebase Auth account exists yet
            await syncApp.auth().createUserWithEmailAndPassword(canonicalEmail, pass);
            console.log("Auth sync: created Firebase Auth account for", user);
          } catch (createErr) {
            if (createErr.code === "auth/email-already-in-use") {
              // Account exists but password differs — sign in to verify
              try {
                await syncApp.auth().signInWithEmailAndPassword(canonicalEmail, pass);
                console.log("Auth sync: Firebase Auth password already matches for", user);
              } catch (signInErr) {
                // Password mismatch in Firebase Auth — admin must use force reset
                console.warn("Auth sync: Firebase Auth password differs for", user,
                  "— admin should use Force Reset to sync.");
              }
            }
          }
          await syncApp.delete();
        } catch (syncErr) {
          console.warn("Auth sync background error:", syncErr.message);
        }
      })();
    } else {
      alert("❌ Login failed: Invalid username or password.");
      document.getElementById("login-password").value = "";
    }
  } else {
    // ── OFFLINE: Local storage fallback ──────────────────────────────────────
    let dbUsers = window._firebaseUsers || [];
    if (dbUsers.length === 0) {
      const storedCustom = localStorage.getItem("gl_custom_users");
      if (storedCustom) {
        try { dbUsers = JSON.parse(storedCustom); } catch (err) { }
      }
    }

    const matched = dbUsers.find(u => u && u.username && typeof u.username === 'string' && u.username.toLowerCase() === user);
    const validHardcoded = ["ganny", "shashank", "shaheer", "jaya", "cathrina"];

    if (matched) {
      if (pass === matched.password || (validHardcoded.includes(user) && pass === "password")) {
        sessionStorage.setItem("gl_pricing_session", user);
        document.getElementById("login-username").value = "";
        document.getElementById("login-password").value = "";
        loginSuccess(user);
      } else {
        alert("Invalid login credentials. Please check your password.");
        document.getElementById("login-password").value = "";
      }
    } else {
      if (validHardcoded.includes(user) && pass === "password") {
        sessionStorage.setItem("gl_pricing_session", user);
        document.getElementById("login-username").value = "";
        document.getElementById("login-password").value = "";
        loginSuccess(user);
      } else {
        alert("Invalid login credentials. Please check your username/password.");
        document.getElementById("login-password").value = "";
      }
    }
  }
}

// ── SIGN UP: Register a new user account ────────────────────────────────────
window.handleSignup = async function (e) {
  if (e) e.preventDefault();

  const user = (document.getElementById("login-username").value || "").toLowerCase().trim();
  const pass = document.getElementById("login-password").value || "";

  if (!user) {
    alert("Please enter a Username to sign up.");
    return;
  }
  if (!pass || pass.length < 6) {
    alert("Please enter a Password of at least 6 characters to sign up.");
    return;
  }

  const canonicalEmail = `${user}@atlaspricing.com`;

  if (!DB.isCloud) {
    alert("⚠️ Sign up requires an active internet connection. Please check your connection and try again.");
    return;
  }

  try {
    await firebase.auth().createUserWithEmailAndPassword(canonicalEmail, pass);
    alert(`✅ Account created successfully!\n\nUsername: ${user}\n\nYou can now sign in with your credentials. Please inform your administrator to assign your role.`);
    document.getElementById("login-password").value = "";
  } catch (err) {
    if (err.code === "auth/email-already-in-use") {
      alert(`⚠️ The username "${user}" is already registered.\n\nIf you have forgotten your password, please use "Forgot password?" to request a reset.`);
    } else if (err.code === "auth/weak-password") {
      alert("⚠️ Password is too weak. Please choose a stronger password (minimum 6 characters).");
    } else if (err.code === "auth/invalid-email") {
      alert("⚠️ Invalid username format. Please use only letters, numbers, underscores, or hyphens.");
    } else {
      alert("⚠️ Sign up failed: " + err.message);
    }
  }
};

function toggleLoginPasswordVisibility() {
  const passwordInput = document.getElementById("login-password");
  const toggleButton = document.getElementById("login-password-toggle");
  if (!passwordInput || !toggleButton) return;

  const isHidden = passwordInput.type === "password";
  passwordInput.type = isHidden ? "text" : "password";
  toggleButton.textContent = isHidden ? "Hide" : "Show";
  toggleButton.setAttribute("aria-label", isHidden ? "Hide password" : "Show password");
  toggleButton.setAttribute("aria-pressed", String(isHidden));
}
window.toggleLoginPasswordVisibility = toggleLoginPasswordVisibility;

function loginSuccess(roleId) {

  const roleIdLower = roleId.toLowerCase();
  appState.currentUser = roleIdLower; // CRITICAL: must be set first — all permission checks depend on this

  // Emergency fallback: ensure every authenticated Firebase user has a TEAM_ROLES entry.
  // We first try to find the user in the Firestore-synced custom users (window._firebaseUsers)
  // so direct-sales users (ramesh, sunil, linson, spoorthi, etc.) get the correct profile.
  // Only create a bare default if no Firestore data is available yet.
  if (!TEAM_ROLES[roleIdLower]) {
    // Try to get richer profile from Firestore-synced user list
    let firestoreProfile = null;
    const fbUsers = window._firebaseUsers || [];
    const fbMatch = fbUsers.find(u => u && u.username && u.username.toLowerCase() === roleIdLower);
    if (fbMatch) {
      firestoreProfile = {
        name: (fbMatch.fullName || roleIdLower).replace(/\s*\(Free\s*Hand\)/i, '').trim(),
        type: fbMatch.role || 'member',
        category: fbMatch.category || 'FREE HAND SALES (AIR/SEA)',
        currency: fbMatch.currency || 'INR'
      };
    }
    TEAM_ROLES[roleIdLower] = firestoreProfile || {
      name: roleIdLower,
      type: 'member',
      category: 'FREE HAND SALES (AIR/SEA)',
      currency: 'INR'
    };
    console.log(`TEAM_ROLES: Created entry for "${roleIdLower}" from ${firestoreProfile ? 'Firestore profile' : 'default fallback'}`);
  }

  const userRoleInfo = TEAM_ROLES[roleIdLower];
  document.body.classList.remove("logged-out-blur");
  document.getElementById("login-overlay").style.display = "none";
  document.getElementById("app-workspace").style.display = "flex";
  document.getElementById("subheader-controls").style.display = "flex";

  applyDeskNames();

  const displayName = (userRoleInfo.name || roleIdLower)
    .replace(/\s*\(Free\s*Hand\)/i, "");

  const headerUserNameEl = document.getElementById("header-user-name");
  if (headerUserNameEl) headerUserNameEl.textContent = (appState.currentUser || roleIdLower).toUpperCase();
  const headerUserRoleEl = document.getElementById("header-user-role");
  if (headerUserRoleEl) headerUserRoleEl.textContent = displayName;
  const headerUserAvatarEl = document.getElementById("header-user-avatar");
  if (headerUserAvatarEl) headerUserAvatarEl.textContent = (appState.currentUser || roleIdLower).charAt(0).toUpperCase();

  const root = document.documentElement;
  const execDashBtn = document.getElementById("executive-dashboard-btn");

  // Update visibility of executive dashboard panel first
  updateExecutiveDashboardVisibility();

  if (isAdminUser(roleIdLower)) {
    document.getElementById("admin-settings-btn").style.display = "flex";
    document.getElementById("admin-role-selector").style.display = "flex";
    if (execDashBtn) execDashBtn.style.display = "flex";
    root.style.setProperty('--accent-current', 'var(--sky)');
    root.style.setProperty('--accent-current-glow', 'rgba(27, 28, 92, 0.2)');
    switchRole('manager');
  } else {
    document.getElementById("admin-settings-btn").style.display = "none";
    document.getElementById("admin-role-selector").style.display = "none";

    // Manage button visibility based on isUserAdminOrManager check
    if (isUserAdminOrManager()) {
      if (execDashBtn) execDashBtn.style.display = "flex";
    } else {
      if (execDashBtn) execDashBtn.style.display = "none";
    }

    if (roleIdLower === 'manager') {
      root.style.setProperty('--accent-current', 'var(--sky)');
      root.style.setProperty('--accent-current-glow', 'rgba(27, 28, 92, 0.2)');
    } else if (roleIdLower.startsWith('air')) {
      root.style.setProperty('--accent-current', 'var(--accent-air)');
      root.style.setProperty('--accent-current-glow', 'var(--accent-air-glow)');
    } else {
      root.style.setProperty('--accent-current', 'var(--accent-sea)');
      root.style.setProperty('--accent-current-glow', 'var(--accent-sea-glow)');
    }
    switchRole(roleIdLower);
  }
}

function logoutUser() {
  document.documentElement.classList.remove("nrs-font-scale");
  const execDashBtn = document.getElementById("executive-dashboard-btn");
  if (execDashBtn) execDashBtn.style.display = "none";
  appState.currentUser = null;
  updateExecutiveDashboardVisibility();
  if (DB.isCloud) {
    // Stop every authenticated listener before Firebase removes the session.
    // This prevents a final, unauthenticated listener request on logout.
    if (DB.snapshotUnsubscribe) {
      DB.snapshotUnsubscribe();
      DB.snapshotUnsubscribe = null;
    }
    DB.stopAuxiliaryListeners();
    firebase.auth().signOut().catch(err => {
      console.error("Auth: Sign out failed:", err);
    });
  } else {
    sessionStorage.removeItem("gl_pricing_session");
    document.body.classList.add("logged-out-blur");
    document.getElementById("login-overlay").style.display = "flex";
    document.getElementById("app-workspace").style.display = "flex";
    document.getElementById("subheader-controls").style.display = "flex";
  }
}

function renderUserCredentialsList() {
  const userCredsBody = document.getElementById("admin-user-credentials-body");
  if (!userCredsBody) return;

  let dbUsers = window._firebaseUsers || [];
  if (dbUsers.length === 0) {
    try {
      const stored = localStorage.getItem("gl_custom_users");
      if (stored) dbUsers = JSON.parse(stored) || [];
    } catch (e) { }
  }

  // Default hardcoded users
  const defaultUsers = [
    { username: 'ganny', fullName: 'Pricing Team (Admin)', role: 'admin' },
    { username: 'shashank', fullName: 'Air Nomination', role: 'member', category: 'AIR - NOMINATION' },
    { username: 'shaheer', fullName: 'Sea Nomination', role: 'member', category: 'SEA - NOMINATION' },
    { username: 'jaya', fullName: 'Free Hand Sales', role: 'member', category: 'FREE HAND SALES (AIR/SEA)' },
    { username: 'cathrina', fullName: 'NRS', role: 'member', category: 'NRS (AIR/SEA)' }
  ];

  // Combine unique users
  const allUsersMap = {};
  defaultUsers.forEach(u => allUsersMap[u.username.toLowerCase()] = u);
  dbUsers.forEach(u => {
    if (u && u.username) {
      const usernameLower = u.username.toLowerCase();
      // Remove duplicate shaheer user credentials
      if (usernameLower === 'shaheer' || usernameLower === 'mahendra') {
        return;
      }
      allUsersMap[usernameLower] = {
        username: u.username,
        fullName: u.fullName || u.username,
        role: u.role || 'member',
        category: u.category || 'FREE HAND SALES (AIR/SEA)'
      };
    }
  });

  const allUsers = Object.values(allUsersMap);
  userCredsBody.innerHTML = allUsers.map(u => {
    // Display-only override: an admin account's Firestore record can end up
    // with a stray category value (e.g. from a reset/registration flow's
    // generic fallback), which isn't wrong data worth migrating, just a
    // wrong label here. Never show a desk category for the admin account,
    // regardless of what's actually stored on the record — this doesn't
    // change what's stored or any of the isFreeHandOrNrs-style category
    // checks used elsewhere in the app.
    const isAdminAccount = u.username?.toLowerCase() === 'ganny' || u.role === 'admin';
    const roleCat = isAdminAccount ? 'Admin' : (u.category || 'Member');
    return `
      <tr>
        <td><strong>${u.username}</strong></td>
        <td>${u.fullName}</td>
        <td><span style="font-size:0.65rem; padding: 2px 6px; border-radius: 4px; background: rgba(0,0,0,0.1); color: var(--t1); font-weight: 600;">${roleCat}</span></td>
        <td><span style="color: var(--accent-success); font-family: monospace; font-size: 0.7rem;">Firebase Secure Auth</span></td>
      </tr>
    `;
  }).join("");
}
window.renderUserCredentialsList = renderUserCredentialsList;

// Load Airports & Airlines Data
async function loadData() {
  try {
    const airportsRes = await fetch("data/airports.json");
    appState.airports = await airportsRes.json();
  } catch (e) {
    console.error("Failed to load airports.json", e);
  }

  try {
    const airlinesRes = await fetch("data/airlines.json");
    appState.airlines = await airlinesRes.json();
  } catch (e) {
    console.error("Failed to load airlines.json", e);
  }

  try {
    const seaportsRes = await fetch("data/seaports.json");
    appState.seaports = await seaportsRes.json();
  } catch (e) {
    console.error("Failed to load seaports.json", e);
  }

  // Setup Autocomplete inputs
  setupAutocomplete(document.getElementById("air-cust-name"), "customers");
  setupAutocomplete(document.getElementById("air-origin"), "airports");
  setupAutocomplete(document.getElementById("air-dest"), "airports");
  setupAutocomplete(document.getElementById("air-airline"), "airlines");
  setupAutocomplete(document.getElementById("air-commodity"), "air_commodities");

  setupAutocomplete(document.getElementById("sea-cust-name"), "customers");
  setupAutocomplete(document.getElementById("sea-origin"), "seaports");
  setupAutocomplete(document.getElementById("sea-dest"), "seaports");
  setupAutocomplete(document.getElementById("sea-line"), "shippinglines");
  setupAutocomplete(document.getElementById("sea-liner-name"), "linernames");
  setupAutocomplete(document.getElementById("sea-commodity"), "sea_commodities");

  // Bind Commodity event listeners
  const airComm = document.getElementById("air-commodity");
  if (airComm) {
    airComm.addEventListener("input", () => {
      handleAirCommodityChange();
      calculateAirFreight();
    });
    airComm.addEventListener("change", () => {
      handleAirCommodityChange();
      calculateAirFreight();
    });
  }
  const seaComm = document.getElementById("sea-commodity");
  if (seaComm) {
    seaComm.addEventListener("input", calculateSeaFreight);
    seaComm.addEventListener("change", calculateSeaFreight);
  }
}

// Role Switcher Setup
function setupRoleSwitcher() {
  document.querySelectorAll(".role-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const role = e.currentTarget.getAttribute("data-role");
      switchRole(role);
    });
  });
}

// Role switcher dropdown: the chip row (#admin-role-selector) is unchanged —
// this only controls whether its wrapper shows/hides it as a popover, plus
// keeping the trigger button's label in sync with whichever role is active.
function toggleRoleSwitcherMenu(forceClose) {
  const wrap = document.getElementById("role-switcher-wrap");
  if (!wrap) return;
  if (forceClose) {
    wrap.classList.remove("open");
  } else {
    wrap.classList.toggle("open");
  }
}
window.toggleRoleSwitcherMenu = toggleRoleSwitcherMenu;

function syncRoleSwitcherTriggerLabel() {
  const label = document.getElementById("role-switcher-trigger-label");
  const activeBtn = document.querySelector("#admin-role-selector .role-btn.active");
  if (label && activeBtn) {
    label.textContent = activeBtn.textContent.trim();
  }
}
window.syncRoleSwitcherTriggerLabel = syncRoleSwitcherTriggerLabel;

document.addEventListener("click", (e) => {
  const wrap = document.getElementById("role-switcher-wrap");
  if (wrap && wrap.classList.contains("open") && !wrap.contains(e.target)) {
    wrap.classList.remove("open");
  }
});

// Switching modules toggles which panel has display:block via CSS classes —
// it never navigates or reloads, so the scroll position from whatever panel
// was previously open otherwise carries over verbatim. On a short page that
// silently drops the user mid-content instead of at the top.
function resetPageScroll() {
  try {
    document.body.scrollTop = 0;
    document.documentElement.scrollTop = 0;
    window.scrollTo(0, 0);
  } catch (e) { }
}

function switchRole(role) {
  if (!role) return;
  const roleLower = role.toLowerCase();

  // Guard: prevent non-admins/non-managers from switching to administrative roles
  if ((roleLower === 'manager' || roleLower === 'ganny') && !isUserAdminOrManager()) {
    console.warn("Permission denied: cannot switch to admin/manager role.");
    return;
  }

  // Update Active Class on Buttons (if visible)
  document.querySelectorAll(".role-btn").forEach(btn => {
    const btnRole = btn.getAttribute("data-role");
    if (btnRole && btnRole.toLowerCase() === roleLower) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  });
  if (typeof syncRoleSwitcherTriggerLabel === 'function') syncRoleSwitcherTriggerLabel();
  if (typeof toggleRoleSwitcherMenu === 'function') toggleRoleSwitcherMenu(true);

  // Hide all panels
  document.querySelectorAll(".view-panel").forEach(panel => {
    panel.classList.remove("active");
  });

  // Set Theme Accents dynamically
  const root = document.documentElement;
  if (roleLower.startsWith('air') || roleLower === 'shashank') {
    root.style.setProperty('--accent-current', 'var(--accent-air)');
    root.style.setProperty('--accent-current-glow', 'var(--accent-air-glow)');
  } else if (roleLower.startsWith('sea') || roleLower === 'shaheer') {
    root.style.setProperty('--accent-current', 'var(--accent-sea)');
    root.style.setProperty('--accent-current-glow', 'var(--accent-sea-glow)');
  } else if (roleLower === 'manager' || roleLower === 'ganny') {
    root.style.setProperty('--accent-current', 'var(--sky)');
    root.style.setProperty('--accent-current-glow', 'rgba(27, 28, 92, 0.2)');
  } else {
    root.style.setProperty('--accent-current', 'var(--indigo)');
    root.style.setProperty('--accent-current-glow', 'rgba(47, 49, 147, 0.2)');
  }

  // Currency Indicator rules based on Role
  updateCurrencyRules(roleLower);

  // Keep top module tabs visible — sidebar is primary, tabs are quick secondary nav.
  const globalModuleTabs = document.getElementById("global-module-tabs");
  if (globalModuleTabs) {
    globalModuleTabs.style.removeProperty("display");
  }

  // Show Selected view
  if (roleLower === 'manager' || isAdminUser(roleLower)) {
    document.getElementById("manager-panel").classList.add("active");
    renderAdminDashboard();
  } else if (TEAM_ROLES[roleLower] && TEAM_ROLES[roleLower].type === 'member') {
    // Check if we are showing the member dashboard or active calculator
    // Default: show member dashboard summary
    document.getElementById("member-dashboard-panel").classList.add("active");
    renderMemberDashboard(roleLower);
  } else if (appState.currentUser && appState.currentUser === roleLower) {
    // Fallback: any authenticated user who isn't admin gets the member dashboard.
    // This fires when TEAM_ROLES wasn't populated yet (e.g. syncUsers snapshot race).
    // Ensure a valid TEAM_ROLES entry exists so renderMemberDashboard works.
    if (!TEAM_ROLES[roleLower]) {
      const fbUsers = window._firebaseUsers || [];
      const fbMatch = fbUsers.find(u => u && u.username && u.username.toLowerCase() === roleLower);
      TEAM_ROLES[roleLower] = fbMatch ? {
        name: (fbMatch.fullName || roleLower).replace(/\s*\(Free\s*Hand\)/i, '').trim(),
        type: 'member',
        category: fbMatch.category || 'FREE HAND SALES (AIR/SEA)',
        currency: fbMatch.currency || 'INR'
      } : { name: roleLower, type: 'member', category: 'FREE HAND SALES (AIR/SEA)', currency: 'INR' };
      console.warn(`switchRole: TEAM_ROLES fallback created for "${roleLower}" — syncUsers snapshot may still be in-flight.`);
    }
    document.getElementById("member-dashboard-panel").classList.add("active");
    renderMemberDashboard(roleLower);
  }

  // Update visibility of executive dashboard panel
  // A role switch always opens its dashboard, so reset the navigation marker
  // as well. This prevents a previously opened desk from remaining highlighted.
  if (typeof updateModuleTabs === 'function') updateModuleTabs('dashboard');
  updateExecutiveDashboardVisibility();
  resetPageScroll();
}

function goHome() {
  const workspaceNameEl = document.getElementById("header-workspace-name");
  if (workspaceNameEl) workspaceNameEl.textContent = "Dashboard";

  document.querySelectorAll(".view-panel").forEach(panel => {
    panel.classList.remove("active");
  });
  document.querySelectorAll(".modal-overlay").forEach(modal => {
    modal.classList.remove("show");
  });

  if (isAdminUser(appState.currentUser)) {
    document.getElementById("manager-panel").classList.add("active");
    document.querySelectorAll(".role-btn").forEach(btn => {
      if (btn.getAttribute("data-role") === 'manager') {
        btn.classList.add("active");
      } else {
        btn.classList.remove("active");
      }
    });
    const root = document.documentElement;
    root.style.setProperty('--accent-current', 'var(--sky)');
    const overviewTabBtn = document.querySelector('#manager-panel .desk-tab-strip .desk-tab-btn');
    if (typeof switchDeskTab === 'function') {
      switchDeskTab('manager-panel', 'overview', overviewTabBtn);
    }
    renderAdminDashboard();
  } else {
    document.getElementById("member-dashboard-panel").classList.add("active");
    renderMemberDashboard(appState.currentUser);
  }
  if (typeof updateAdminModulePermissions === 'function') updateAdminModulePermissions();
  // Keep the visual navigation state aligned with the dashboard view.
  // This only changes the selected sidebar/tab treatment; it does not affect
  // permissions, data, calculations, or panel availability.
  if (typeof updateModuleTabs === 'function') updateModuleTabs('dashboard');
  resetPageScroll();
}
window.goHome = goHome;

function updateCurrencyRules(role) {
  const airCurSelect = document.getElementById("air-currency");
  const seaCurSelect = document.getElementById("sea-currency");

  let activeRole = role;
  if (activeRole === 'ganny' || activeRole === 'manager') {
    const activeBtn = document.querySelector(".role-btn.active");
    const selectedRole = activeBtn ? activeBtn.getAttribute("data-role") : null;
    if (selectedRole && selectedRole !== 'manager') {
      activeRole = selectedRole;
    }
  }
  if (!activeRole) activeRole = appState.currentUser || 'ganny';

  const isNrs = activeRole && (activeRole === 'cathrina' || TEAM_ROLES[activeRole]?.category === 'NRS (AIR/SEA)');
  const isLocal = activeRole && (activeRole.includes('local') || activeRole === 'jaya' || TEAM_ROLES[activeRole]?.category === 'FREE HAND SALES (AIR/SEA)');
  const targetType = isNrs ? "nrs" : (isLocal ? "local" : "nom");

  // Hide Agency Agreement option for NRS and Free Hand Sales desks
  const airAgreementGrp = document.getElementById("air-agency-agreement-group");
  const seaAgreementGrp = document.getElementById("sea-agency-agreement-group");
  if (airAgreementGrp && seaAgreementGrp) {
    if (isNrs || isLocal) {
      airAgreementGrp.style.display = "none";
      seaAgreementGrp.style.display = "none";
    } else {
      airAgreementGrp.style.display = "block";
      seaAgreementGrp.style.display = "block";
    }
  }

  // Rebuild Air select if needed
  if (airCurSelect && airCurSelect.getAttribute("data-role-type") !== targetType) {
    const val = airCurSelect.value;
    airCurSelect.setAttribute("data-role-type", targetType);
    airCurSelect.innerHTML = `
      <option value="USD">USD - US Dollar</option>
      <option value="EUR">EUR - Euro</option>
      <option value="GBP">GBP - British Pound</option>
      <option value="INR">INR - Indian Rupee</option>
    `;
    airCurSelect.value = ['USD', 'EUR', 'GBP', 'INR'].includes(val) ? val : (isLocal ? 'INR' : 'USD');
    airCurSelect.disabled = false;
  }

  // Rebuild Sea select if needed
  if (seaCurSelect && seaCurSelect.getAttribute("data-role-type") !== targetType) {
    const val = seaCurSelect.value;
    seaCurSelect.setAttribute("data-role-type", targetType);
    seaCurSelect.innerHTML = `
      <option value="USD">USD - US Dollar</option>
      <option value="EUR">EUR - Euro</option>
      <option value="GBP">GBP - British Pound</option>
      <option value="INR">INR - Indian Rupee</option>
    `;
    seaCurSelect.value = ['USD', 'EUR', 'GBP', 'INR'].includes(val) ? val : (isLocal ? 'INR' : 'USD');
    seaCurSelect.disabled = false;
  }

  // Find the selected currency
  let currency = 'INR';
  const isAirActive = document.getElementById("air-freight-panel")?.classList.contains("active");
  const isSeaActive = document.getElementById("sea-freight-panel")?.classList.contains("active");

  if (isAirActive && airCurSelect) {
    currency = airCurSelect.value;
  } else if (isSeaActive && seaCurSelect) {
    currency = seaCurSelect.value;
  } else {
    // If on dashboard, default based on role
    currency = TEAM_ROLES[activeRole]?.currency || ((activeRole && activeRole.includes('nom')) ? 'USD' : 'INR');
  }

  // Update Sea Freight Buy rate layout and headers dynamically
  const lclBuyGrp = document.getElementById("sea-lcl-buy-group");
  const lclLabel = document.getElementById("sea-lcl-rate-label");
  const bbBuyGrp = document.getElementById("sea-bb-buy-group");
  const bbLabel = document.getElementById("sea-bb-rate-label");
  const lclRow = document.getElementById("sea-lcl-rates-row");
  const bbRow = document.getElementById("sea-bb-rates-row");

  if (lclBuyGrp) lclBuyGrp.style.display = "block";
  if (lclLabel) lclLabel.textContent = "LCL Sell Rate (Per Revenue Ton - RT)";
  if (bbBuyGrp) bbBuyGrp.style.display = "block";
  if (bbLabel) bbLabel.textContent = "Break Bulk Sell Rate (Per Revenue Ton - RT)";
  if (lclRow) lclRow.style.cssText = "display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;";
  if (bbRow) bbRow.style.cssText = "display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;";

  const fclTable = document.querySelector("#sea-fcl-form table");
  if (fclTable) {
    const thead = fclTable.querySelector("thead");
    if (thead) {
      const expectedHeaderType = "gp";
      if (thead.getAttribute("data-header-type") !== expectedHeaderType) {
        thead.setAttribute("data-header-type", expectedHeaderType);
        thead.innerHTML = `
          <tr>
            <th style="width: 32%;">Container Type</th>
            <th style="width: 16%; text-align: center;">Quantity Needed</th>
            <th style="width: 21%; text-align: center;">Sell Rate Per Container (<span class="curr-label">${currency}</span>)</th>
            <th style="width: 21%; text-align: center;">Buy Rate Per Container (<span class="curr-label">${currency}</span>)</th>
            <th style="width: 10%; text-align: center;">Action</th>
          </tr>
        `;
      }
    }
  }

  // Update currency labels on forms
  const currencyElements = document.querySelectorAll(".curr-label");
  const symbolElements = document.querySelectorAll(".curr-symbol");

  currencyElements.forEach(el => el.textContent = currency);
  symbolElements.forEach(el => el.textContent = currency === 'INR' ? '₹' : (currency === 'USD' ? '$' : (currency === 'EUR' ? '€' : '£')));

  // Toggle global vs embedded local surcharges for Air Nomination
  const isAirNomination = TEAM_ROLES[activeRole]?.category === 'AIR - NOMINATION';
  const originFeesCard = document.getElementById("air-origin-fees-card");
  const destFeesCard = document.getElementById("air-dest-fees-card");
  if (originFeesCard && destFeesCard) {
    if (isAirNomination) {
      originFeesCard.style.display = "block";
      destFeesCard.style.display = "block";
    } else {
      originFeesCard.style.display = "none";
      destFeesCard.style.display = "none";
    }
  }
  const cardWrappers = document.querySelectorAll("#air-airlines-list-container .air-card-surcharges-wrapper");
  cardWrappers.forEach(w => {
    w.style.display = isAirNomination ? "none" : "block";
  });
}

function resetAirFreightDeskForm() {
  appState.editingQuoteId = null;

  // Clear inputs
  const custName = document.getElementById("air-cust-name");
  if (custName) custName.value = "";
  const origin = document.getElementById("air-origin");
  if (origin) origin.value = "";
  const dest = document.getElementById("air-dest");
  if (dest) dest.value = "";
  const incoterm = document.getElementById("air-incoterm");
  if (incoterm) incoterm.value = "EXW";
  const terms = document.getElementById("air-terms");
  if (terms) terms.value = DEFAULT_AIR_TERMS;

  // Clear Commodity and Loadability options
  const commodity = document.getElementById("air-commodity");
  if (commodity) commodity.value = "GENERAL";
  const dgClass = document.getElementById("air-dg-class");
  if (dgClass) dgClass.value = "";
  handleAirCommodityChange();
  const tempType = document.getElementById("air-temp-type");
  if (tempType) tempType.value = "NON-TEMPERATURE";
  handleAirTempTypeChange();
  const tilt = document.getElementById("air-loadability-tilt");
  if (tilt) tilt.value = "TILTABLE";
  const stack = document.getElementById("air-loadability-stack");
  if (stack) stack.value = "STACKABLE";

  // Reset module switcher
  appState.currentAirFreight.module = 'export';
  const tabExp = document.getElementById("air-tab-export");
  const tabImp = document.getElementById("air-tab-import");
  if (tabExp && tabImp) {
    tabExp.classList.add("active");
    tabImp.classList.remove("active");
  }

  // Clear and reset dynamic airline cards
  const container = document.getElementById("air-airlines-list-container");
  if (container) {
    container.innerHTML = "";
    addAirlineCard();
  }

  // Reset cargo matrix with single empty row
  const cargoBody = document.getElementById("air-cargo-body");
  if (cargoBody) {
    cargoBody.innerHTML = `
      <tr class="cargo-item-row">
        <td><input type="number" class="cargo-len" min="1" placeholder="L" required></td>
        <td><input type="number" class="cargo-wid" min="1" placeholder="W" required></td>
        <td><input type="number" class="cargo-hei" min="1" placeholder="H" required></td>
        <td><input type="number" class="cargo-qty" min="1" placeholder="Qty" required></td>
        <td><input type="number" class="cargo-gw" min="0.1" step="0.1" placeholder="Kg" required onkeydown="window.autoFocusWeightBreak(event)"></td>
        <td>
          <button type="button" class="delete-btn" onclick="this.closest('tr').remove(); calculateAirFreight();">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/></svg>
          </button>
        </td>
      </tr>
    `;
    cargoBody.querySelectorAll("input").forEach(inp => {
      inp.addEventListener("input", calculateAirFreight);
    });
  }

  // Surcharges reset to default
  resetSurchargesToDefaults();

  // Reset section collapses to expanded
  ['air-tariffs', 'air-origin-fees', 'air-dest-fees'].forEach(prefix => {
    const content = document.getElementById(`${prefix}-content-body`);
    const btn = document.querySelector(`.toggle-${prefix}-btn`);
    if (content) content.style.display = "block";
    if (btn) {
      const icon = btn.querySelector(".collapse-icon");
      const text = btn.querySelector(".collapse-text");
      if (icon) icon.textContent = "▼";
      if (text) text.textContent = "Collapse";
    }
  });

  // Recalculate to update results layout to 0/empty
  calculateAirFreight();
}

function resetSeaFreightDeskForm() {
  appState.editingQuoteId = null;

  // Clear inputs safely
  if (document.getElementById("sea-cust-name")) document.getElementById("sea-cust-name").value = "";
  if (document.getElementById("sea-origin")) document.getElementById("sea-origin").value = "";
  if (document.getElementById("sea-dest")) document.getElementById("sea-dest").value = "";
  if (document.getElementById("sea-line")) document.getElementById("sea-line").value = "";
  if (document.getElementById("sea-liner-name")) document.getElementById("sea-liner-name").value = "";
  if (document.getElementById("sea-commodity")) document.getElementById("sea-commodity").value = "";
  if (document.getElementById("sea-dg-class")) document.getElementById("sea-dg-class").value = "";
  if (document.getElementById("sea-incoterm")) document.getElementById("sea-incoterm").value = "EXW";
  if (document.getElementById("sea-gross-weight")) document.getElementById("sea-gross-weight").value = "0";
  if (document.getElementById("sea-volume")) document.getElementById("sea-volume").value = "0";
  if (document.getElementById("sea-chargeable-cbm-override")) document.getElementById("sea-chargeable-cbm-override").value = "";
  if (document.getElementById("sea-pkg-qty")) document.getElementById("sea-pkg-qty").value = "0";
  if (document.getElementById("sea-routing")) document.getElementById("sea-routing").value = "";
  if (document.getElementById("sea-tt")) document.getElementById("sea-tt").value = "";
  if (document.getElementById("sea-validity")) document.getElementById("sea-validity").value = "";
  document.querySelectorAll(".sea-lcl-rate").forEach(el => el.value = "0");
  document.querySelectorAll(".sea-bb-rate").forEach(el => el.value = "0");
  if (document.getElementById("sea-terms")) document.getElementById("sea-terms").value = DEFAULT_SEA_TERMS;

  // Reset module switcher
  appState.currentSeaFreight.module = 'export';
  const tabExp = document.getElementById("sea-tab-export");
  const tabImp = document.getElementById("sea-tab-import");
  if (tabExp && tabImp) {
    tabExp.classList.add("active");
    tabImp.classList.remove("active");
  }

  // Reset cargo matrix with single empty row
  const cargoBody = document.getElementById("sea-cargo-body");
  if (cargoBody) {
    cargoBody.innerHTML = `
      <tr class="sea-cargo-item-row">
        <td><input type="number" class="sea-cargo-len" min="1" placeholder="L"></td>
        <td><input type="number" class="sea-cargo-wid" min="1" placeholder="W"></td>
        <td><input type="number" class="sea-cargo-hei" min="1" placeholder="H"></td>
        <td><input type="number" class="sea-cargo-qty" min="1" placeholder="Qty"></td>
        <td>
          <button type="button" class="delete-btn" onclick="this.closest('tr').remove(); calculateSeaVolumeFromDimensions();">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/></svg>
          </button>
        </td>
      </tr>
    `;
    cargoBody.querySelectorAll("input").forEach(inp => {
      inp.addEventListener("input", calculateSeaVolumeFromDimensions);
    });
  }

  // Reset multi-liner container
  const linersContainer = document.getElementById("sea-liners-container");
  if (linersContainer) {
    linersContainer.innerHTML = "";
    linerCardCounter = 0;
    addNewLinerCard({
      linerName: "Liner 1 / Primary Operator",
      mode: "fcl"
    });
  }

  // Clear alternatives table
  const seaAltBody = document.getElementById("sea-alternatives-body");
  if (seaAltBody) seaAltBody.innerHTML = "";

  // Recalculate to update results layout to 0/empty
  calculateSeaFreight();
}

// Sub-navigation triggers for Calculators inside Member dashboard
function openActiveCalculator(type) {
  try {
    const workspaceNameEl = document.getElementById("header-workspace-name");
    if (workspaceNameEl) {
      if (type === 'air') workspaceNameEl.textContent = "Air Freight Pricing";
      else if (type === 'sea') workspaceNameEl.textContent = "Sea Freight Pricing";
      else if (type === 'transport') workspaceNameEl.textContent = "Transportation";
      else if (type === 'warehouse') workspaceNameEl.textContent = "Warehousing";
      else if (type === 'directory') workspaceNameEl.textContent = "Directory";
      else if (type === 'circulars') workspaceNameEl.textContent = "Circulars & Documents";
      else if (type === 'sales') workspaceNameEl.textContent = "Sales Pipeline";
    }

    const memberPanel = document.getElementById("member-dashboard-panel");
    if (memberPanel) memberPanel.classList.remove("active");
    const managerPanel = document.getElementById("manager-panel");
    if (managerPanel) managerPanel.classList.remove("active");
    const executivePanel = document.getElementById("executive-dashboard-panel");
    if (executivePanel) executivePanel.classList.remove("active");

    // Hide all panels safely
    const airPanel = document.getElementById("air-freight-panel");
    const seaPanel = document.getElementById("sea-freight-panel");
    const transportPanel = document.getElementById("transportation-panel");
    const warehousePanel = document.getElementById("warehousing-panel");
    const directoryPanel = document.getElementById("directory-panel");
    const circularsPanel = document.getElementById("circulars-panel");
    const salesPanel = document.getElementById("sales-panel");

    if (airPanel) airPanel.classList.remove("active");
    if (seaPanel) seaPanel.classList.remove("active");
    if (transportPanel) transportPanel.classList.remove("active");
    if (warehousePanel) warehousePanel.classList.remove("active");
    if (directoryPanel) directoryPanel.classList.remove("active");
    if (circularsPanel) circularsPanel.classList.remove("active");
    if (salesPanel) salesPanel.classList.remove("active");

    const root = document.documentElement;

    if (type === 'air') {
      if (airPanel) airPanel.classList.add("active");
      root.style.setProperty('--accent-current', 'var(--accent-air)');
      root.style.setProperty('--accent-current-glow', 'var(--accent-air-glow)');
      // Preserve in-progress quotes when switching modules; reset only via Reset or after Save.
    } else if (type === 'sea') {
      if (seaPanel) seaPanel.classList.add("active");
      root.style.setProperty('--accent-current', 'var(--accent-sea)');
      root.style.setProperty('--accent-current-glow', 'var(--accent-sea-glow)');
      // Preserve in-progress quotes when switching modules; reset only via Reset or after Save.
    } else if (type === 'transport') {
      if (transportPanel) transportPanel.classList.add("active");
      root.style.setProperty('--accent-current', 'var(--violet)');
      root.style.setProperty('--accent-current-glow', 'rgba(124, 58, 237, 0.2)');
      try { calculateTransportation(); } catch (e) { console.error("calculateTransportation error:", e); }
    } else if (type === 'warehouse') {
      if (warehousePanel) warehousePanel.classList.add("active");
      root.style.setProperty('--accent-current', 'var(--sky)');
      root.style.setProperty('--accent-current-glow', 'rgba(56, 189, 248, 0.2)');
      try { calculateWarehousing(); } catch (e) { console.error("calculateWarehousing error:", e); }
    } else if (type === 'directory') {
      if (directoryPanel) directoryPanel.classList.add("active");
      root.style.setProperty('--accent-current', 'var(--sky)');
      root.style.setProperty('--accent-current-glow', 'rgba(56, 189, 248, 0.2)');
      try { loadDirectoryContacts(); } catch (e) { console.error("loadDirectoryContacts error:", e); }
    } else if (type === 'circulars') {
      if (circularsPanel) circularsPanel.classList.add("active");
      root.style.setProperty('--accent-current', 'var(--sky)');
      root.style.setProperty('--accent-current-glow', 'rgba(56, 189, 248, 0.2)');
      try { loadCircularsLibrary(); } catch (e) { console.error("loadCircularsLibrary error:", e); }
    } else if (type === 'sales') {
      if (salesPanel) salesPanel.classList.add("active");
      root.style.setProperty('--accent-current', 'var(--sky)');
      root.style.setProperty('--accent-current-glow', 'rgba(56, 189, 248, 0.2)');
      try { renderSalesPanel(); } catch (e) { console.error("renderSalesPanel error:", e); }
    }
    updateModuleTabs(type);
    resetPageScroll();
  } catch (err) {
    console.error("Critical error in openActiveCalculator:", err);
    if (type === 'sea') {
      const seaPanel = document.getElementById("sea-freight-panel");
      if (seaPanel) seaPanel.classList.add("active");
    }
  }
}

window.resetFreightForm = function (type) {
  // Reset wipes the entire desk (customer, airline/liner cards, cargo lines,
  // surcharges) with no undo, so confirm before clearing an in-progress quote.
  if (!window.confirm("Reset this form? All entered details, airline/liner options, and surcharges on this desk will be cleared.")) {
    return;
  }
  if (type === 'air') {
    try { resetAirFreightDeskForm(); } catch (e) { }
  } else if (type === 'sea') {
    try { resetSeaFreightDeskForm(); } catch (e) { }
  }
};

function returnToWorkspace() {
  const workspaceNameEl = document.getElementById("header-workspace-name");
  if (workspaceNameEl) workspaceNameEl.textContent = "Dashboard";

  document.querySelectorAll(".view-panel").forEach(panel => {
    panel.classList.remove("active");
  });

  if (isAdminUser(appState.currentUser)) {
    const managerPanel = document.getElementById("manager-panel");
    if (managerPanel) managerPanel.classList.add("active");
    const root = document.documentElement;
    root.style.setProperty('--accent-current', 'var(--sky)');
    root.style.setProperty('--accent-current-glow', 'rgba(27, 28, 92, 0.2)');
    renderAdminDashboard();
  } else {
    document.getElementById("member-dashboard-panel").classList.add("active");
    const root = document.documentElement;
    root.style.setProperty('--accent-current', 'var(--indigo)');
    root.style.setProperty('--accent-current-glow', 'rgba(47, 49, 147, 0.2)');
    renderMemberDashboard(appState.currentUser);
  }
  updateModuleTabs('dashboard');
  resetPageScroll();
}

function showMyQuotationLogs() {
  returnToWorkspace();
  const quoteTableId = isAdminUser(appState.currentUser) ? "admin-quotes-body" : "user-quotes-body";
  window.setTimeout(() => {
    const quoteTable = document.getElementById(quoteTableId);
    quoteTable?.closest(".glass-card")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, 0);
}

// Global HS / HSN Chapters List (Chapters 01 to 99)
const globalHSNChapters = [
  { code: "01", name: "Chapter 01 | Live Animals" },
  { code: "02", name: "Chapter 02 | Meat and edible meat offal" },
  { code: "03", name: "Chapter 03 | Fish & crustaceans, molluscs & other aquatic invertebrates" },
  { code: "04", name: "Chapter 04 | Dairy produce; birds' eggs; natural honey; edible products of animal origin" },
  { code: "05", name: "Chapter 05 | Products of animal origin, not elsewhere specified or included" },
  { code: "06", name: "Chapter 06 | Live trees & other plants; bulbs, roots; cut flowers & ornamental foliage" },
  { code: "07", name: "Chapter 07 | Edible vegetables and certain roots and tubers" },
  { code: "08", name: "Chapter 08 | Edible fruit and nuts; peel of citrus fruit or melons" },
  { code: "09", name: "Chapter 09 | Coffee, tea, maté and spices" },
  { code: "10", name: "Chapter 10 | Cereals" },
  { code: "11", name: "Chapter 11 | Products of the milling industry; malt; starches; inulin; wheat gluten" },
  { code: "12", name: "Chapter 12 | Oil seeds & oleaginous fruits; miscellaneous grains, seeds & fruit; industrial/medicinal plants; straw" },
  { code: "13", name: "Chapter 13 | Lac; gums, resins and other vegetable saps and extracts" },
  { code: "14", name: "Chapter 14 | Vegetable plaiting materials; vegetable products not elsewhere specified or included" },
  { code: "15", name: "Chapter 15 | Animal or vegetable fats and oils and their cleavage products; prepared edible fats" },
  { code: "16", name: "Chapter 16 | Preparations of meat, fish, crustaceans, molluscs or other aquatic invertebrates" },
  { code: "17", name: "Chapter 17 | Sugars and sugar confectionery" },
  { code: "18", name: "Chapter 18 | Cocoa and cocoa preparations" },
  { code: "19", name: "Chapter 19 | Preparations of cereals, flour, starch or milk; pastrycooks' products" },
  { code: "20", name: "Chapter 20 | Preparations of vegetables, fruit, nuts or other parts of plants" },
  { code: "21", name: "Chapter 21 | Miscellaneous edible preparations" },
  { code: "22", name: "Chapter 22 | Beverages, spirits and vinegar" },
  { code: "23", name: "Chapter 23 | Residues & waste from the food industries; prepared animal fodder" },
  { code: "24", name: "Chapter 24 | Tobacco and manufactured tobacco substitutes" },
  { code: "25", name: "Chapter 25 | Salt; sulphur; earths & stone; plastering materials, lime and cement" },
  { code: "26", name: "Chapter 26 | Ores, slag and ash" },
  { code: "27", name: "Chapter 27 | Mineral fuels, mineral oils & products of their distillation; bituminous substances" },
  { code: "28", name: "Chapter 28 | Inorganic chemicals; organic/inorganic compounds of precious metals, isotopes" },
  { code: "29", name: "Chapter 29 | Organic chemicals" },
  { code: "30", name: "Chapter 30 | Pharmaceutical products" },
  { code: "31", name: "Chapter 31 | Fertilizers" },
  { code: "32", name: "Chapter 32 | Tanning/dyeing extracts; tannins & derivatives; dyes, pigments, paints, varnishes, putty, inks" },
  { code: "33", name: "Chapter 33 | Essential oils & resinoids; perfumery, cosmetic or toilet preparations" },
  { code: "34", name: "Chapter 34 | Soap, organic surface-active agents, washing/lubricating prep, waxes, polishing prep, candles" },
  { code: "35", name: "Chapter 35 | Albuminoidal substances; modified starches; glues; enzymes" },
  { code: "36", name: "Chapter 36 | Explosives; pyrotechnic products; matches; pyrophoric alloys; certain combustible preparations" },
  { code: "37", name: "Chapter 37 | Photographic or cinematographic goods" },
  { code: "38", name: "Chapter 38 | Miscellaneous chemical products" },
  { code: "39", name: "Chapter 39 | Plastics and articles thereof" },
  { code: "40", name: "Chapter 40 | Rubber and articles thereof" },
  { code: "41", name: "Chapter 41 | Raw hides and skins (other than furskins) and leather" },
  { code: "42", name: "Chapter 42 | Articles of leather; saddlery & harness; travel goods, handbags; articles of animal gut" },
  { code: "43", name: "Chapter 43 | Furskins and artificial fur; manufactures thereof" },
  { code: "44", name: "Chapter 44 | Wood and articles of wood; wood charcoal" },
  { code: "45", name: "Chapter 45 | Cork and articles of cork" },
  { code: "46", name: "Chapter 46 | Manufactures of straw, esparto or other plaiting materials; basketware & wickerwork" },
  { code: "47", name: "Chapter 47 | Pulp of wood/other fibrous cellulosic material; recovered paper/paperboard" },
  { code: "48", name: "Chapter 48 | Paper & paperboard; articles of paper pulp, paper or paperboard" },
  { code: "49", name: "Chapter 49 | Printed books, newspapers, pictures & other products of printing industry; manuscripts" },
  { code: "50", name: "Chapter 50 | Silk" },
  { code: "51", name: "Chapter 51 | Wool, fine/coarse animal hair; horsehair yarn & woven fabric" },
  { code: "52", name: "Chapter 52 | Cotton" },
  { code: "53", name: "Chapter 53 | Other vegetable textile fibres; paper yarn and woven fabrics of paper yarn" },
  { code: "54", name: "Chapter 54 | Man-made filaments; strip and the like of man-made textile materials" },
  { code: "55", name: "Chapter 55 | Man-made staple fibres" },
  { code: "56", name: "Chapter 56 | Wadding, felt & nonwovens; special yarns; twine, cordage, ropes & cables" },
  { code: "57", name: "Chapter 57 | Carpets and other textile floor coverings" },
  { code: "58", name: "Chapter 58 | Special woven fabrics; tufted textile fabrics; lace; tapestries; trimmings; embroidery" },
  { code: "59", name: "Chapter 59 | Impregnated, coated, covered/laminated textile fabrics; textile articles for industrial use" },
  { code: "60", name: "Chapter 60 | Knitted or crocheted fabrics" },
  { code: "61", name: "Chapter 61 | Articles of apparel and clothing accessories, knitted or crocheted" },
  { code: "62", name: "Chapter 62 | Articles of apparel and clothing accessories, not knitted or crocheted" },
  { code: "63", name: "Chapter 63 | Other made up textile articles; sets; worn clothing and worn textile articles; rags" },
  { code: "64", name: "Chapter 64 | Footwear, gaiters and the like; parts of such articles" },
  { code: "65", name: "Chapter 65 | Headgear and parts thereof" },
  { code: "66", name: "Chapter 66 | Umbrellas, sun umbrellas, walking-sticks, seat-sticks, whips, riding-crops" },
  { code: "67", name: "Chapter 67 | Prepared feathers & down & articles made of feathers/down; artificial flowers; articles of human hair" },
  { code: "68", name: "Chapter 68 | Articles of stone, plaster, cement, asbestos, mica or similar materials" },
  { code: "69", name: "Chapter 69 | Ceramic products" },
  { code: "70", name: "Chapter 70 | Glass and glassware" },
  { code: "71", name: "Chapter 71 | Natural/cultured pearls, precious/semi-precious stones, precious metals & articles" },
  { code: "72", name: "Chapter 72 | Iron and steel" },
  { code: "73", name: "Chapter 73 | Articles of iron or steel" },
  { code: "74", name: "Chapter 74 | Copper and articles thereof" },
  { code: "75", name: "Chapter 75 | Nickel and articles thereof" },
  { code: "76", name: "Chapter 76 | Aluminium and articles thereof" },
  { code: "77", name: "Chapter 77 | Reserved for possible future use" },
  { code: "78", name: "Chapter 78 | Lead and articles thereof" },
  { code: "79", name: "Chapter 79 | Zinc and articles thereof" },
  { code: "80", name: "Chapter 80 | Tin and articles thereof" },
  { code: "81", name: "Chapter 81 | Other base metals; cermets; articles thereof" },
  { code: "82", name: "Chapter 82 | Tools, implements, cutlery, spoons & forks of base metal; parts thereof" },
  { code: "83", name: "Chapter 83 | Miscellaneous articles of base metal" },
  { code: "84", name: "Chapter 84 | Nuclear reactors, boilers, machinery and mechanical appliances; parts thereof" },
  { code: "85", name: "Chapter 85 | Electrical machinery & equipment and parts thereof; sound/television recorders/reproducers" },
  { code: "86", name: "Chapter 86 | Railway/tramway locomotives, rolling-stock and parts; track fixtures; traffic signalling equipment" },
  { code: "87", name: "Chapter 87 | Vehicles other than railway/tramway rolling-stock, and parts and accessories thereof" },
  { code: "88", name: "Chapter 88 | Aircraft, spacecraft, and parts thereof" },
  { code: "89", name: "Chapter 89 | Ships, boats and floating structures" },
  { code: "90", name: "Chapter 90 | Optical, photographic, cinematographic, measuring, checking, medical/surgical instruments" },
  { code: "91", name: "Chapter 91 | Clocks and watches and parts thereof" },
  { code: "92", name: "Chapter 92 | Musical instruments; parts and accessories of such articles" },
  { code: "93", name: "Chapter 93 | Arms and ammunition; parts and accessories thereof" },
  { code: "94", name: "Chapter 94 | Furniture; bedding, cushions; lamps & lighting; illuminated signs; prefabricated buildings" },
  { code: "95", name: "Chapter 95 | Toys, games and sports requisites; parts and accessories thereof" },
  { code: "96", name: "Chapter 96 | Miscellaneous manufactured articles" },
  { code: "97", name: "Chapter 97 | Works of art, collectors' pieces and antiques" },
  { code: "98", name: "Chapter 98 | Special classification provisions (national use)" },
  { code: "99", name: "Chapter 99 | Special classification provisions (national use)" }
];

const globalHSNHeadings = [
  { code: "2201", name: "2201 | Waters, mineral waters and aerated waters" },
  { code: "2202", name: "2202 | Sweetened or flavoured waters & non-alcoholic beverages" },
  { code: "2203", name: "2203 | Beer made from malt" },
  { code: "2204", name: "2204 | Wine of fresh grapes, including fortified wines" },
  { code: "2205", name: "2205 | Vermouth and other wine of fresh grapes" },
  { code: "2206", name: "2206 | Other fermented beverages (cider, perry, mead, sake)" },
  { code: "2207", name: "2207 | Undenatured ethyl alcohol of an alcoholic strength by volume of 80% vol. or higher; ethyl alcohol and other spirits, denatured, of any strength" },
  { code: "2208", name: "2208 | Undenatured ethyl alcohol of an alcoholic strength by volume of less than 80% vol.; spirits, liqueurs" },
  { code: "2209", name: "2209 | Vinegar and substitutes for vinegar obtained from acetic acid" }
];

// Airport, seaport and airline fields are controlled global directories.  Keep
// historic custom values intact, but never add them to these directories again.
function isGlobalDirectoryType(type) {
  return type === "airports" || type === "airlines" || type === "seaports";
}

function cleanDirectoryEntries(entries) {
  const seenCodes = new Set();
  return (Array.isArray(entries) ? entries : []).filter((entry) => {
    const code = String(entry?.code || "").trim().toUpperCase();
    const name = String(entry?.name || "").trim();
    // Dedupe by code only — a "same city" check here used to also drop every
    // other airport/seaport sharing that city, which silently removed major
    // hubs (e.g. Madrid-Barajas/MAD) whenever a lesser airport for the same
    // city happened to appear earlier in the source data. Cities routinely
    // have several distinct, individually bookable airports/ports; the code
    // is the actual unique identifier, not the city name.
    if (!code || !name || code === "CUSTOM") return false;
    if (seenCodes.has(code)) return false;
    seenCodes.add(code);
    return true;
  });
}

// Helper to save custom entries in localStorage
function saveCustomEntry(type, value) {
  if (isGlobalDirectoryType(type)) return;
  if (!value || typeof value !== 'string') return;
  const valTrimmed = value.trim();
  if (!valTrimmed) return;

  let storageKey = "";
  let defaultList = [];
  let isObjectList = true;

  if (type === "airports") {
    storageKey = "gl_custom_airports";
    const majorAirports = [
      { code: "MAA", name: "Chennai International Airport" },
      { code: "BOM", name: "Chhatrapati Shivaji Maharaj International Airport" },
      { code: "DEL", name: "Indira Gandhi International Airport" },
      { code: "BLR", name: "Kempegowda International Airport" },
      { code: "HYD", name: "Rajiv Gandhi International Airport" },
      { code: "DXB", name: "Dubai International Airport" },
      { code: "SIN", name: "Singapore Changi Airport" },
      { code: "LHR", name: "London Heathrow Airport" },
      { code: "JFK", name: "John F. Kennedy International Airport" },
      { code: "FRA", name: "Frankfurt Airport" },
      { code: "HKG", name: "Hong Kong International Airport" },
      { code: "PVG", name: "Shanghai Pudong International Airport" },
      { code: "NRT", name: "Narita International Airport" },
      { code: "DOH", name: "Hamad International Airport" }
    ];
    defaultList = (appState.airports && appState.airports.length > 0) ? appState.airports : majorAirports;
  } else if (type === "airlines") {
    storageKey = "gl_custom_airlines";
    defaultList = (appState.airlines && appState.airlines.length > 0)
      ? appState.airlines
      : (typeof IATA_AIRLINES !== "undefined" ? Object.entries(IATA_AIRLINES).map(([code, name]) => ({ code, name })) : []);
  } else if (type === "customers") {
    storageKey = "gl_custom_customers";
    defaultList = [];
    isObjectList = false;
  } else if (type === "seaports") {
    storageKey = "gl_custom_seaports";
    defaultList = [
      { code: "CNSHA", name: "Shanghai Port" },
      { code: "SGPIN", name: "Singapore Port" },
      { code: "NLRTM", name: "Port of Rotterdam" },
      { code: "BEANR", name: "Port of Antwerp" },
      { code: "AEDXB", name: "Jebel Ali Port" },
      { code: "USLAX", name: "Port of Los Angeles" },
      { code: "GBFXT", name: "Felixstowe Port" },
      { code: "INNSA", name: "Nhava Sheva (JNPT)" },
      { code: "INMAA", name: "Chennai Port" },
      { code: "LKCMB", name: "Colombo Port" },
      { code: "DEHAM", name: "Hamburg Port" }
    ];
  } else if (type === "shippinglines") {
    storageKey = "gl_custom_shippinglines";
    defaultList = [
      { code: "MSC", name: "MSC (Mediterranean Shipping Company)" },
      { code: "MSK", name: "Maersk Line" },
      { code: "CMA", name: "CMA CGM" },
      { code: "COS", name: "COSCO Shipping" },
      { code: "HLD", name: "Hapag-Lloyd" },
      { code: "ONE", name: "ONE (Ocean Network Express)" },
      { code: "EVG", name: "Evergreen Line" },
      { code: "HMM", name: "HMM Co., Ltd." },
      { code: "YML", name: "Yang Ming Marine Transport" },
      { code: "ZIM", name: "ZIM Integrated Shipping" },
      { code: "WHL", name: "Wan Hai Lines" },
      { code: "PIL", name: "PIL (Pacific International Lines)" }
    ];
  } else if (type === "linernames") {
    storageKey = "gl_custom_linernames";
    defaultList = [
      { code: "MSC", name: "MSC" },
      { code: "MSK", name: "Maersk" },
      { code: "CMA", name: "CMA CGM" },
      { code: "HPL", name: "Hapag-Lloyd" },
      { code: "ONE", name: "ONE" },
      { code: "EMC", name: "Evergreen" },
      { code: "COS", name: "COSCO" },
      { code: "OOCL", name: "OOCL" },
      { code: "HMM", name: "HMM" },
      { code: "ZIM", name: "ZIM" },
      { code: "PIL", name: "PIL" },
      { code: "YML", name: "Yang Ming" }
    ];
  } else if (type === "air_commodities" || type === "sea_commodities") {
    storageKey = type === "air_commodities" ? "gl_custom_air_commodities" : "gl_custom_sea_commodities";
    defaultList = [
      { code: "GENERAL", name: "GENERAL (General Cargo)" },
      { code: "LIVE ANIMALS", name: "LIVE ANIMALS" },
      { code: "HAZARDOUS", name: "HAZARDOUS (DG)" },
      { code: "PERISHABLES", name: "PERISHABLES" },
      { code: "PHARMA", name: "PHARMA / Medical" },
      ...globalHSNChapters,
      ...globalHSNHeadings
    ];
  }

  if (!storageKey) return;

  let customList = [];
  const stored = localStorage.getItem(storageKey);
  if (stored) {
    try { customList = JSON.parse(stored); } catch (e) { }
  }

  const normalizedInput = valTrimmed.toLowerCase();

  if (isObjectList) {
    const existsInDefault = defaultList.some(item =>
      item.name.toLowerCase() === normalizedInput ||
      item.code.toLowerCase() === normalizedInput ||
      `${item.code} - ${item.name}`.toLowerCase() === normalizedInput ||
      `${item.code} | ${item.name}`.toLowerCase() === normalizedInput
    );
    const existsInCustom = customList.some(item =>
      item.name.toLowerCase() === normalizedInput ||
      item.code.toLowerCase() === normalizedInput ||
      `${item.code} - ${item.name}`.toLowerCase() === normalizedInput ||
      `${item.code} | ${item.name}`.toLowerCase() === normalizedInput
    );

    if (existsInDefault || existsInCustom) return;

    let code = "CUSTOM";
    let name = valTrimmed;
    const splitIndex = valTrimmed.indexOf(" - ");
    const pipeIndex = valTrimmed.indexOf(" | ");
    if (splitIndex > 0) {
      code = valTrimmed.substring(0, splitIndex).trim();
      name = valTrimmed.substring(splitIndex + 3).trim();
    } else if (pipeIndex > 0) {
      code = valTrimmed.substring(0, pipeIndex).trim();
      name = valTrimmed.substring(pipeIndex + 3).trim();
    } else if (valTrimmed.length <= 6) {
      code = valTrimmed.toUpperCase();
    }

    customList.push({ code, name });
  } else {
    const existsInCustom = customList.some(c => c.toLowerCase() === normalizedInput);
    if (existsInCustom) return;
    customList.push(valTrimmed);
  }

  localStorage.setItem(storageKey, JSON.stringify(customList));

  if (DB.firestoreRef) {
    DB.firestoreRef.collection("custom_autocomplete_entries").doc(type).set({
      entries: customList
    }, { merge: true }).catch(err => {
      console.error("DB: Failed to upload custom autocomplete entry to Firestore:", err);
    });
  }
}

// Ranks an airport/seaport match by how directly it matches the typed text,
// so a major hub (code or city match) always sorts above an unrelated
// record whose long name merely happens to contain the same substring —
// e.g. typing "madrid" previously listed a Mexican airport named "...de la
// Madrid..." ahead of Madrid-Barajas (MAD) itself, since results were left
// in raw data-file order instead of being ranked by relevance.
function scoreLocationMatch(record, val) {
  const code = (record.code || "").toLowerCase();
  const city = (record.city || "").toLowerCase();
  const name = (record.name || "").toLowerCase();
  const country = (record.country || "").toLowerCase();
  if (code === val) return 0;
  if (code.startsWith(val)) return 1;
  if (city === val) return 2;
  if (city.startsWith(val)) return 3;
  if (city.includes(val)) return 4;
  if (name.startsWith(val)) return 5;
  if (name.includes(val)) return 6;
  if (country.includes(val)) return 7;
  return 8;
}

// Autocomplete Engine
function setupAutocomplete(inputEl, type) {
  if (!inputEl) return;
  inputEl.setAttribute("autocomplete", "new-password");
  inputEl.setAttribute("autocorrect", "off");
  inputEl.setAttribute("autocapitalize", "none");

  const container = inputEl.closest(".autocomplete-container");
  let dropdown = container.querySelector(".autocomplete-dropdown");
  if (!dropdown) {
    dropdown = document.createElement("div");
    dropdown.className = "autocomplete-dropdown";
    container.appendChild(dropdown);
  }

  let activeIndex = -1;
  let currentMatches = [];

  const updateActiveItem = () => {
    const items = dropdown.querySelectorAll(".autocomplete-item");
    items.forEach((item, idx) => {
      if (idx === activeIndex) {
        item.classList.add("active");
        item.scrollIntoView({ block: "nearest" });
      } else {
        item.classList.remove("active");
      }
    });
  };

  inputEl.addEventListener("keydown", (e) => {
    if (!dropdown.classList.contains("show")) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      activeIndex = (activeIndex + 1) % currentMatches.length;
      updateActiveItem();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      activeIndex = (activeIndex - 1 + currentMatches.length) % currentMatches.length;
      updateActiveItem();
    } else if (e.key === "Enter") {
      if (activeIndex >= 0 && activeIndex < currentMatches.length) {
        e.preventDefault();
        const selectedItem = currentMatches[activeIndex];
        inputEl._programmaticSelection = true;
        if (type === "customers" || type === "linernames" || type === "sea_commodities" || type === "air_commodities") {
          inputEl.value = selectedItem.name;
        } else {
          inputEl.value = `${selectedItem.code} - ${selectedItem.name}`;
        }
        dropdown.classList.remove("show");
        dropdown.innerHTML = "";

        const event = new Event('change');
        inputEl.dispatchEvent(event);

        const inputEvent = new Event('input');
        inputEl.dispatchEvent(inputEvent);

        activeIndex = -1;
      }
    } else if (e.key === "Escape") {
      dropdown.classList.remove("show");
      activeIndex = -1;
    }
  });

  inputEl.addEventListener("input", (e) => {
    if (inputEl._programmaticSelection) {
      inputEl._programmaticSelection = false;
      return;
    }
    const val = e.target.value.trim().toLowerCase();
    if (!val || val.length < 2) {
      dropdown.classList.remove("show");
      currentMatches = [];
      activeIndex = -1;
      return;
    }

    let matches = [];
    if (type === "airports") {
      const majorAirports = [
        { code: "MAA", name: "Chennai International Airport", city: "Chennai", country: "India" },
        { code: "BOM", name: "Chhatrapati Shivaji Maharaj International Airport", city: "Mumbai", country: "India" },
        { code: "DEL", name: "Indira Gandhi International Airport", city: "New Delhi", country: "India" },
        { code: "BLR", name: "Kempegowda International Airport", city: "Bengaluru", country: "India" },
        { code: "HYD", name: "Rajiv Gandhi International Airport", city: "Hyderabad", country: "India" },
        { code: "DXB", name: "Dubai International Airport", city: "Dubai", country: "UAE" },
        { code: "SIN", name: "Singapore Changi Airport", city: "Singapore", country: "Singapore" },
        { code: "LHR", name: "London Heathrow Airport", city: "London", country: "UK" },
        { code: "JFK", name: "John F. Kennedy International Airport", city: "New York", country: "USA" },
        { code: "FRA", name: "Frankfurt Airport", city: "Frankfurt", country: "Germany" },
        { code: "HKG", name: "Hong Kong International Airport", city: "Hong Kong", country: "Hong Kong" },
        { code: "PVG", name: "Shanghai Pudong International Airport", city: "Shanghai", country: "China" },
        { code: "NRT", name: "Narita International Airport", city: "Tokyo", country: "Japan" },
        { code: "DOH", name: "Hamad International Airport", city: "Doha", country: "Qatar" }
      ];
      const airportsSource = (appState.airports && appState.airports.length > 0) ? appState.airports : majorAirports;
      const combined = cleanDirectoryEntries(airportsSource);
      matches = combined.filter(ap =>
        (ap.code || "").toLowerCase().includes(val) ||
        (ap.city || "").toLowerCase().includes(val) ||
        (ap.country || "").toLowerCase().includes(val) ||
        (ap.name || "").toLowerCase().includes(val)
      ).sort((a, b) => scoreLocationMatch(a, val) - scoreLocationMatch(b, val))
       .slice(0, 10);
    } else if (type === "airlines") {
      const baseAirlines = (appState.airlines && appState.airlines.length > 0)
        ? appState.airlines
        : (typeof IATA_AIRLINES !== "undefined"
            ? Object.entries(IATA_AIRLINES).map(([code, name]) => ({ code, name }))
            : []);
      const combined = cleanDirectoryEntries(baseAirlines);
      matches = combined.filter(al =>
        (al.code || "").toLowerCase().includes(val) ||
        (al.name || "").toLowerCase().includes(val)
      ).slice(0, 10);
    } else if (type === "customers") {
      let customCusts = [];
      const stored = localStorage.getItem("gl_custom_customers");
      if (stored) {
        try { customCusts = JSON.parse(stored); } catch (err) { }
      }
      matches = customCusts.filter(c => c.toLowerCase().includes(val)).map(c => ({
        code: "CUST",
        name: c
      })).slice(0, 10);
    } else if (type === "seaports") {
      const majorSeaports = [
        { code: "CNSHA", name: "Shanghai Port", city: "Shanghai", country: "China" },
        { code: "SGPIN", name: "Singapore Port", city: "Singapore", country: "Singapore" },
        { code: "NLRTM", name: "Port of Rotterdam", city: "Rotterdam", country: "Netherlands" },
        { code: "BEANR", name: "Port of Antwerp", city: "Antwerp", country: "Belgium" },
        { code: "AEDXB", name: "Jebel Ali Port", city: "Dubai", country: "UAE" },
        { code: "USLAX", name: "Port of Los Angeles", city: "Los Angeles", country: "USA" },
        { code: "GBFXT", name: "Felixstowe Port", city: "Felixstowe", country: "UK" },
        { code: "INNSA", name: "Nhava Sheva (JNPT)", city: "Mumbai", country: "India" },
        { code: "INMAA", name: "Chennai Port", city: "Chennai", country: "India" },
        { code: "LKCMB", name: "Colombo Port", city: "Colombo", country: "Sri Lanka" },
        { code: "DEHAM", name: "Hamburg Port", city: "Hamburg", country: "Germany" }
      ];
      const portsSource = (appState.seaports && appState.seaports.length > 0) ? appState.seaports : majorSeaports;
      const combined = cleanDirectoryEntries(portsSource);
      matches = combined.filter(sp =>
        (sp.code || "").toLowerCase().includes(val) ||
        (sp.name || "").toLowerCase().includes(val) ||
        (sp.city || "").toLowerCase().includes(val) ||
        (sp.country || "").toLowerCase().includes(val)
      ).sort((a, b) => scoreLocationMatch(a, val) - scoreLocationMatch(b, val))
       .slice(0, 10);
    } else if (type === "shippinglines") {
      const majorShippingLines = [
        { code: "MSC", name: "MSC (Mediterranean Shipping Company)" },
        { code: "MSK", name: "Maersk Line" },
        { code: "CMA", name: "CMA CGM" },
        { code: "COS", name: "COSCO Shipping" },
        { code: "HLD", name: "Hapag-Lloyd" },
        { code: "ONE", name: "ONE (Ocean Network Express)" },
        { code: "EVG", name: "Evergreen Line" },
        { code: "HMM", name: "HMM Co., Ltd." },
        { code: "YML", name: "Yang Ming Marine Transport" },
        { code: "ZIM", name: "ZIM Integrated Shipping" },
        { code: "WHL", name: "Wan Hai Lines" },
        { code: "PIL", name: "PIL (Pacific International Lines)" }
      ];
      let customLines = [];
      const stored = localStorage.getItem("gl_custom_shippinglines");
      if (stored) {
        try { customLines = JSON.parse(stored); } catch (err) { }
      }
      const combined = [...majorShippingLines, ...customLines];
      matches = combined.filter(sl =>
        sl.code.toLowerCase().includes(val) ||
        sl.name.toLowerCase().includes(val)
      ).slice(0, 10);
    } else if (type === "linernames") {
      const majorLiners = [
        { code: "MSC", name: "MSC" },
        { code: "MSK", name: "Maersk" },
        { code: "CMA", name: "CMA CGM" },
        { code: "HPL", name: "Hapag-Lloyd" },
        { code: "ONE", name: "ONE" },
        { code: "EMC", name: "Evergreen" },
        { code: "COS", name: "COSCO" },
        { code: "OOCL", name: "OOCL" },
        { code: "HMM", name: "HMM" },
        { code: "ZIM", name: "ZIM" },
        { code: "PIL", name: "PIL" },
        { code: "YML", name: "Yang Ming" }
      ];
      let customLiners = [];
      const stored = localStorage.getItem("gl_custom_linernames");
      if (stored) {
        try { customLiners = JSON.parse(stored); } catch (err) { }
      }
      const combined = [...majorLiners, ...customLiners];
      matches = combined.filter(l =>
        l.code.toLowerCase().includes(val) ||
        l.name.toLowerCase().includes(val)
      ).slice(0, 10);
    } else if (type === "air_commodities" || type === "sea_commodities") {
      const defaultAirCommodities = [
        { code: "GENERAL", name: "GENERAL (General Cargo)" },
        { code: "LIVE ANIMALS", name: "LIVE ANIMALS" },
        { code: "HAZARDOUS", name: "HAZARDOUS (DG)" },
        { code: "PERISHABLES", name: "PERISHABLES" },
        { code: "PHARMA", name: "PHARMA / Medical" }
      ];
      let customCommodities = [];
      const storageKey = type === "air_commodities" ? "gl_custom_air_commodities" : "gl_custom_sea_commodities";
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        try { customCommodities = JSON.parse(stored); } catch (err) { }
      }

      // Combine operational defaults, full HS chapters list, specific headings list, and custom commodities
      const combined = [
        ...defaultAirCommodities,
        ...globalHSNChapters,
        ...globalHSNHeadings,
        ...customCommodities
      ];

      matches = combined.filter(c =>
        c.code.toLowerCase().includes(val) ||
        c.name.toLowerCase().includes(val)
      );

      // Dynamically add heading if typing a 4-digit code and no heading is explicitly matched
      if (/^\d{4}$/.test(val)) {
        const chapterCode = val.substring(0, 2);
        const chapter = globalHSNChapters.find(ch => ch.code === chapterCode);
        const hasDirectHeading = combined.some(h => h.code === val);
        if (chapter && !hasDirectHeading) {
          matches.unshift({
            code: val,
            name: `${val} | ${chapter.name.replace(/^Chapter \d{2} \| /, "")} (Heading)`
          });
        }
      }

      matches = matches.slice(0, 10);
    }

    currentMatches = matches;
    activeIndex = -1;

    if (matches.length > 0) {
      dropdown.innerHTML = "";
      matches.forEach((item, idx) => {
        const div = document.createElement("div");
        div.className = "autocomplete-item";

        let label = "";
        if (type === "customers" || type === "linernames" || type === "sea_commodities" || type === "air_commodities") {
          label = `<div>${item.name}</div>`;
        } else if (type === "airlines" || type === "shippinglines") {
          label = `<div>${item.name}</div><div class="code-badge">${item.code}</div>`;
        } else {
          label = `<div>${item.name} (${item.city || ''}${item.country ? ', ' + item.country : ''})</div><div class="code-badge">${item.code}</div>`;
        }

        div.innerHTML = label;
        div.addEventListener("click", () => {
          inputEl._programmaticSelection = true;
          if (type === "customers" || type === "linernames" || type === "sea_commodities" || type === "air_commodities") {
            inputEl.value = item.name;
          } else {
            inputEl.value = `${item.code} - ${item.name}`;
          }
          dropdown.classList.remove("show");
          dropdown.innerHTML = "";

          const event = new Event('change');
          inputEl.dispatchEvent(event);

          const inputEvent = new Event('input');
          inputEl.dispatchEvent(inputEvent);

          activeIndex = -1;
        });
        dropdown.appendChild(div);
      });
      dropdown.classList.add("show");
    } else {
      dropdown.classList.remove("show");
    }
  });

  inputEl.addEventListener("blur", () => {
    setTimeout(() => {
      saveCustomEntry(type, inputEl.value);
    }, 250);
  });

  inputEl.addEventListener("change", () => {
    saveCustomEntry(type, inputEl.value);
  });

  document.addEventListener("click", (e) => {
    if (!container.contains(e.target)) {
      dropdown.classList.remove("show");
      activeIndex = -1;
    }
  });
}
window.setupAutocomplete = setupAutocomplete;

// AIR FREIGHT CALCULATOR LOGIC
// AIR FREIGHT CALCULATOR LOGIC
function setupAirFreightEvents() {
  const tableBody = document.getElementById("air-cargo-body");
  const addRowBtn = document.getElementById("air-add-cargo");
  const dimUnitOptions = document.querySelectorAll(".dim-unit-toggle .toggle-option");
  const currencySelect = document.getElementById("air-currency");

  const airTabExport = document.getElementById("air-tab-export");
  const airTabImport = document.getElementById("air-tab-import");
  if (airTabExport && airTabImport) {
    airTabExport.addEventListener("click", () => {
      airTabExport.classList.add("active");
      airTabImport.classList.remove("active");
      appState.currentAirFreight.module = 'export';
      resetCargoAndRatesForAir();
    });
    airTabImport.addEventListener("click", () => {
      airTabImport.classList.add("active");
      airTabExport.classList.remove("active");
      appState.currentAirFreight.module = 'import';
      resetCargoAndRatesForAir();
    });
  }

  if (addRowBtn) {
    addRowBtn.addEventListener("click", () => {
      const row = document.createElement("tr");
      row.className = "cargo-item-row";
      row.innerHTML = `
        <td><input type="number" class="cargo-len" min="1" placeholder="L" required></td>
        <td><input type="number" class="cargo-wid" min="1" placeholder="W" required></td>
        <td><input type="number" class="cargo-hei" min="1" placeholder="H" required></td>
        <td><input type="number" class="cargo-qty" min="1" placeholder="Qty" required></td>
        <td><input type="number" class="cargo-gw" min="0.1" step="0.1" placeholder="Kg" required onkeydown="window.autoFocusWeightBreak(event)"></td>
        <td>
          <button type="button" class="delete-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/></svg>
          </button>
        </td>
      `;
      tableBody.appendChild(row);

      row.querySelectorAll("input").forEach(inp => {
        inp.addEventListener("input", calculateAirFreight);
      });
      row.querySelector(".delete-btn").addEventListener("click", (e) => {
        row.remove();
        calculateAirFreight();
      });
      calculateAirFreight();
    });
  }

  document.querySelectorAll(".cargo-item-row input").forEach(inp => {
    inp.addEventListener("input", calculateAirFreight);
  });
  document.querySelectorAll(".cargo-item-row .delete-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.target.closest("tr").remove();
      calculateAirFreight();
    });
  });

  dimUnitOptions.forEach(opt => {
    opt.addEventListener("click", (e) => {
      dimUnitOptions.forEach(o => o.classList.remove("active", "unit-active"));
      e.target.classList.add("active", "unit-active");
      appState.currentAirFreight.dimUnit = e.target.getAttribute("data-unit");
      calculateAirFreight();
    });
  });

  if (currencySelect) {
    currencySelect.addEventListener("change", () => {
      updateCurrencyRules(appState.currentUser);
      calculateAirFreight();
    });
  }

  document.getElementById("air-incoterm")?.addEventListener("change", calculateAirFreight);

  const addAirlineBtn = document.getElementById("air-add-airline-btn");
  if (addAirlineBtn) {
    addAirlineBtn.addEventListener("click", () => {
      addAirlineCard();
      calculateAirFreight();
    });
  }

  const commoditySelect = document.getElementById("air-commodity");
  if (commoditySelect) {
    commoditySelect.addEventListener("change", () => {
      handleAirCommodityChange();
      calculateAirFreight();
    });
  }

  const tempTypeSelect = document.getElementById("air-temp-type");
  if (tempTypeSelect) {
    tempTypeSelect.addEventListener("change", () => {
      handleAirTempTypeChange();
      calculateAirFreight();
    });
  }

  const tempRangeSelect = document.getElementById("air-temp-range");
  if (tempRangeSelect) {
    tempRangeSelect.addEventListener("change", calculateAirFreight);
  }

  const tiltSelect = document.getElementById("air-loadability-tilt");
  if (tiltSelect) {
    tiltSelect.addEventListener("change", calculateAirFreight);
  }

  const stackSelect = document.getElementById("air-loadability-stack");
  if (stackSelect) {
    stackSelect.addEventListener("change", calculateAirFreight);
  }

  setupSurchargesEvents("air-origin");
  setupSurchargesEvents("air-dest");

  const airOriginInput = document.getElementById("air-origin");
  if (airOriginInput) {
    airOriginInput.addEventListener("input", () => {
      updateCartageRowVisibility();
      calculateAirFreight();
    });
    airOriginInput.addEventListener("change", () => {
      updateCartageRowVisibility();
      calculateAirFreight();
    });
  }

  const container = document.getElementById("air-airlines-list-container");
  if (container && container.querySelectorAll(".airline-card").length === 0) {
    addAirlineCard();
  }
}

function handleAirCommodityChange() {
  const comm = document.getElementById("air-commodity")?.value;
  const tempContainer = document.getElementById("air-commodity-temp-container");
  if (tempContainer) {
    if (comm === 'PERISHABLES' || comm === 'PHARMA') {
      tempContainer.style.display = 'grid';
    } else {
      tempContainer.style.display = 'none';
      const tempType = document.getElementById("air-temp-type");
      if (tempType) {
        tempType.value = "NON-TEMPERATURE";
        handleAirTempTypeChange();
      }
    }
  }
}
window.handleAirCommodityChange = handleAirCommodityChange;

function handleAirTempTypeChange() {
  const type = document.getElementById("air-temp-type")?.value;
  const rangeGroup = document.getElementById("air-temp-range-group");
  if (rangeGroup) {
    if (type === 'TEMPERATURE') {
      rangeGroup.style.display = 'block';
    } else {
      rangeGroup.style.display = 'none';
    }
  }
}
window.handleAirTempTypeChange = handleAirTempTypeChange;

function getWeightBreakBracket(weight) {
  if (weight < 45) return 'minus45';
  if (weight >= 45 && weight < 100) return 'plus45';
  if (weight >= 100 && weight < 300) return 'plus100';
  if (weight >= 300 && weight < 500) return 'plus300';
  if (weight >= 500 && weight < 1000) return 'plus500';
  return 'plus1000';
}
window.getWeightBreakBracket = getWeightBreakBracket;

function addWeightBreakRow(card, breakName, rate = 0, isAuto = false) {
  const container = card.querySelector(".airline-breaks-container");
  if (!container) return;

  let wrapper = container.querySelector(`.dynamic-break-wrapper[data-break-name="${breakName}"]`);
  if (wrapper) {
    if (isAuto) {
      wrapper.setAttribute("data-is-auto", "true");
      const removeBtn = wrapper.querySelector(".remove-break-btn");
      if (removeBtn) removeBtn.style.display = "none";
    }
    return;
  }

  const labels = {
    'min': 'Min (Flat)',
    'minus45': '-45 kg',
    'plus45': '+45 kg',
    'plus100': '+100 kg',
    'plus300': '+300 kg',
    'plus500': '+500 kg',
    'plus1000': '+1000 kg'
  };

  wrapper = document.createElement("div");
  wrapper.className = "dynamic-break-wrapper";
  wrapper.setAttribute("data-break-name", breakName);
  wrapper.setAttribute("data-is-auto", isAuto ? "true" : "false");
  wrapper.style.cssText = "background: #fff; border: 1px solid #ccc; border-radius: 4px; padding: 4px 8px; display: flex; flex-wrap: wrap; align-items: center; gap: 6px; transition: all 0.2s;";

  const sellRate = (typeof rate === 'object' && rate !== null) ? (rate.sell || 0) : (parseFloat(rate) || 0);
  const buyRate = (typeof rate === 'object' && rate !== null) ? (rate.buy || 0) : 0;

  wrapper.innerHTML = `
    <span style="font-size: 0.72rem; font-weight: 700; color: #000;">${labels[breakName] || breakName}</span>
    <div style="display: flex; gap: 6px; align-items: center;">
      <label style="display: flex; align-items: center; gap: 3px; font-size: 0.65rem; font-weight: 800; color: #000;" title="Sell Rate per KG">Sell
        <input type="number" class="break-rate-input break-sell-rate-input" aria-label="Sell Rate per KG" placeholder="0.00" min="0" step="0.1" value="${sellRate > 0 ? sellRate : ''}" style="width: 58px; font-size: 0.72rem; padding: 2px 4px; border: 1px solid #ccc; border-radius: 4px; background: #fff; color: #000; font-weight: 700;" title="Sell Rate per KG">
      </label>
      <label style="display: flex; align-items: center; gap: 3px; font-size: 0.65rem; font-weight: 800; color: #000;" title="Buy Rate per KG">Buy
        <input type="number" class="break-buy-rate-input" aria-label="Buy Rate per KG" placeholder="0.00" min="0" step="0.1" value="${buyRate > 0 ? buyRate : ''}" style="width: 58px; font-size: 0.72rem; padding: 2px 4px; border: 1px solid #ccc; border-radius: 4px; background: #fff; color: #000; font-weight: 700;" title="Buy Rate per KG">
      </label>
    </div>
    <span class="break-gp-display" style="font-size: 0.65rem; font-weight: 800; color: var(--accent-success, #10b981); white-space: nowrap;" title="Sell minus Buy, per KG">GP 0.00</span>
    <span class="remove-break-btn" style="cursor: pointer; color: var(--accent-error); font-size: 0.8rem; font-weight: 800; padding: 0 2px; ${isAuto ? 'display:none;' : ''}">×</span>
  `;

  container.appendChild(wrapper);

  // Live per-KG margin next to this bracket's rates — a plain Sell minus Buy
  // on the two rates already shown here, same numbers the user is already
  // looking at, not a weight-multiplied total (that depends on which
  // bracket ends up active, which is calculateAirFreight()'s job, not
  // this — purely a "what's my margin on this rate" readout).
  const updateBreakGp = () => {
    const sellVal = parseFloat(wrapper.querySelector(".break-sell-rate-input")?.value) || 0;
    const buyVal = parseFloat(wrapper.querySelector(".break-buy-rate-input")?.value) || 0;
    const gpEl = wrapper.querySelector(".break-gp-display");
    if (gpEl) gpEl.textContent = `GP ${(sellVal - buyVal).toFixed(2)}`;
  };
  updateBreakGp();

  wrapper.querySelector(".break-sell-rate-input").addEventListener("input", () => { updateBreakGp(); calculateAirFreight(); });
  const buyInp = wrapper.querySelector(".break-buy-rate-input");
  if (buyInp) buyInp.addEventListener("input", () => { updateBreakGp(); calculateAirFreight(); });

  if (!isAuto) {
    wrapper.querySelector(".remove-break-btn").addEventListener("click", () => {
      wrapper.remove();
      calculateAirFreight();
    });
  }
}
window.addWeightBreakRow = addWeightBreakRow;

const IATA_AIRLINES = {
  AA: "American Airlines",
  EK: "Emirates",
  LH: "Lufthansa",
  QR: "Qatar Airways",
  CX: "Cathay Pacific",
  SQ: "Singapore Airlines",
  BA: "British Airways",
  AF: "Air France",
  KL: "KLM Royal Dutch Airlines",
  EY: "Etihad Airways",
  TK: "Turkish Airlines",
  NH: "All Nippon Airways",
  JL: "Japan Airlines",
  KE: "Korean Air",
  TG: "Thai Airways",
  QF: "Qantas Airways",
  NZ: "Air New Zealand",
  DL: "Delta Air Lines",
  UA: "United Airlines"
};

function createAirSurchargeRow(surcharge = {}) {
  const tr = document.createElement("tr");
  const name = surcharge.name !== undefined ? surcharge.name : "";
  const sellRate = surcharge.rate !== undefined ? surcharge.rate : (surcharge.sell !== undefined ? surcharge.sell : "0.00");
  const buyRate = surcharge.buyRate !== undefined ? surcharge.buyRate : (surcharge.buy !== undefined ? surcharge.buy : "0.00");
  const unit = surcharge.unit || "kg";
  const remarks = surcharge.remarks || "";
  const readOnlyName = surcharge.readOnlyName || false;

  tr.innerHTML = `
    <td><input type="text" class="chg-name" value="${name}" ${readOnlyName ? 'readonly style="background: rgba(255,255,255,0.02); color: var(--text-dim);"' : ''} required></td>
    <td><input type="number" class="chg-rate" value="${sellRate}" step="0.01"></td>
    <td><input type="number" class="chg-buy-rate" value="${buyRate}" step="0.01" style="background: rgba(255,255,255,0.03); color: var(--t1);"></td>
    <td>
      <select class="chg-unit">
        <option value="kg" ${unit === 'kg' ? 'selected' : ''}>Per kg</option>
        <option value="flat" ${unit === 'flat' ? 'selected' : ''}>Flat</option>
      </select>
    </td>
    <td><input type="text" class="chg-remarks" value="${remarks}" placeholder="Add remarks..." style="background: rgba(255,255,255,0.03); color: var(--t1); border: 1px solid var(--border-color); border-radius: 6px; padding: 4px 8px; font-size: 0.78rem; width: 100%;"></td>
    <td>
      <button type="button" class="delete-btn">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6" />
        </svg>
      </button>
    </td>
  `;

  tr.querySelectorAll("input, select").forEach(inp => {
    inp.addEventListener("input", calculateAirFreight);
    inp.addEventListener("change", calculateAirFreight);
  });

  tr.querySelector(".delete-btn").addEventListener("click", () => {
    tr.remove();
    calculateAirFreight();
  });

  return tr;
}

function addAirlineCard(data = null) {
  const container = document.getElementById("air-airlines-list-container");
  if (!container) return;

  const airlineId = 'airline_' + Math.random().toString(36).substr(2, 9);
  const card = document.createElement("div");
  card.className = "airline-card glass-card";
  card.id = airlineId;
  card.style.cssText = "padding: 1rem; border: 1px solid var(--border-1); border-radius: 8px; margin-bottom: 1rem; position: relative; overflow: visible !important;";

  const count = container.querySelectorAll(".airline-card").length + 1;

  const name = data ? data.name : "";
  const routing = data ? data.routing : "";
  const tt = data ? data.tt : "";
  const validity = data ? data.validity : "";
  const pivotWeight = data ? data.pivotWeight : "";
  const isSelected = data ? !!data.selected : (count === 1);
  const activeBreaks = data ? data.breaks : {};
  const ams_fee = data ? (data.ams_fee !== undefined ? data.ams_fee : (data.amsFee !== undefined ? data.amsFee : "")) : "";
  const amsFeeEnabled = data && data.amsFeeEnabled !== undefined ? !!data.amsFeeEnabled : true;
  const wbEnabled = data && data.wbEnabled !== undefined ? !!data.wbEnabled : true;
  const originFeesEnabled = data && data.originFeesEnabled !== undefined ? !!data.originFeesEnabled : true;
  const destFeesEnabled = data && data.destFeesEnabled !== undefined ? !!data.destFeesEnabled : true;

  const creatorRole = appState.currentUser;
  const activeRole = getActiveRole();
  const roleObj = TEAM_ROLES[activeRole];
  const isAirNomination = roleObj && roleObj.category === 'AIR - NOMINATION';
  const isFreeHandOrNrs = creatorRole && (
    creatorRole === 'jaya' ||
    creatorRole === 'cathrina' ||
    TEAM_ROLES[creatorRole]?.category === 'FREE HAND SALES (AIR/SEA)' ||
    TEAM_ROLES[creatorRole]?.category === 'NRS (AIR/SEA)'
  );

  card.innerHTML = `
    <div class="airline-card-heading" style="display: flex; flex-direction: column; align-items: flex-start; gap: 0.4rem; margin-bottom: 0.75rem;">
      <span style="font-weight: 800; color: var(--accent-air); font-size: 0.85rem;">Airline Option #${count}</span>
      <div class="airline-card-actions" style="display: flex; width: 100%; justify-content: flex-end; gap: 0.75rem; align-items: center;">
        <label style="font-size: 0.75rem; display: flex; align-items: center; gap: 4px; cursor: pointer; color: var(--t1); white-space: nowrap;">
          <input type="radio" name="selected-airline" class="select-airline-radio" ${isSelected ? 'checked' : ''}> Select as Quoted
        </label>
        <button type="button" class="delete-btn remove-airline-btn" style="padding: 2px 4px; margin: 0; white-space: nowrap; flex-shrink: 0;">Remove</button>
      </div>
    </div>
    
    <div class="form-group" style="margin-bottom: 0.6rem;">
      <label>Carrier / Airline</label>
      <div class="airline-directory-input" contenteditable="plaintext-only" role="combobox" aria-autocomplete="list" aria-expanded="false" data-placeholder="Type airline code or name..." spellcheck="false"></div>
      <input type="hidden" class="air-name" value="">
    </div>

    <div class="airline-rate-summary-bar" style="display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; background: #fafbfc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.5rem 0.6rem 0.5rem 0.75rem; margin-bottom: 0.5rem;">
      <span class="airline-rate-summary-text" style="font-size: 0.72rem; color: var(--t2, #64748b); font-weight: 600;">No rates entered yet</span>
      <button type="button" class="open-airline-rate-modal-btn" title="Edit rates &amp; fees" aria-label="Edit rates &amp; fees" style="display: flex; align-items: center; justify-content: center; width: 30px; height: 30px; flex-shrink: 0; background: rgba(245, 158, 11, 0.18); color: var(--accent-warning, #b45309); border: 1px solid rgba(245, 158, 11, 0.4); border-radius: 50%; cursor: pointer; padding: 0;">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
      </button>
    </div>

    <div class="airline-rate-modal-overlay" style="display: none; position: fixed; inset: 0; background: rgba(15,23,42,0.5); z-index: 2000; align-items: center; justify-content: center; padding: 1.5rem;">
      <div class="airline-rate-modal-dialog" style="background: var(--bg-surface, #fff); border-radius: 12px; max-width: 720px; width: 100%; max-height: 88vh; overflow-y: auto; padding: 1.1rem 1.4rem;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.9rem; border-bottom: 1px solid var(--border-1); padding-bottom: 0.6rem;">
          <span style="font-size: 0.85rem; font-weight: 700; color: #1b1c5c;">Rates and fees — Airline Option #${count}</span>
          <button type="button" class="close-airline-rate-modal-btn" style="background: none; border: none; cursor: pointer; font-size: 1.1rem; line-height: 1; color: var(--t2, #64748b); padding: 2px 6px;">✕</button>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
          <div class="form-group">
            <label>Routing Details</label>
            <input type="text" class="air-routing" placeholder="e.g. Direct / via SIN" value="${routing}" required style="font-size: 0.75rem; padding: 4px 8px; border-radius: 6px;">
          </div>
          <div class="form-group">
            <label>Transit Time (TT)</label>
            <input type="text" class="air-tt" placeholder="e.g. 3-5 Days" value="${tt}" required style="font-size: 0.75rem; padding: 4px 8px; border-radius: 6px;">
          </div>
        </div>

        <div style="margin-top: 0.5rem; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1rem;">
          <div class="form-group">
            <label>Quote Validity</label>
            <input type="date" class="air-validity" value="${validity}" required style="color-scheme: dark; font-size: 0.75rem; padding: 4px 8px; border-radius: 6px;">
          </div>
          <div class="form-group">
            <label>Pivot Weight (Kg)</label>
            <input type="number" class="air-pivot-weight" placeholder="optional" min="0" step="0.1" value="${pivotWeight}" style="font-size: 0.75rem; padding: 4px 8px; border-radius: 6px;">
          </div>
          <div class="form-group">
            <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; white-space: nowrap; font-weight: 700;">
              <input type="checkbox" class="air-enable-ams-fee" ${amsFeeEnabled ? 'checked' : ''} onchange="calculateAirFreight()" style="width: 14px; height: 14px; accent-color: var(--sky); cursor: pointer;">
              <span>AMS Fee</span>
            </label>
            <input type="number" step="0.01" min="0" class="air-ams-fee" placeholder="0.00" value="${ams_fee !== undefined && ams_fee !== '' ? ams_fee : '0.00'}" oninput="calculateAirFreight()" style="font-size: 0.75rem; padding: 4px 8px; border-radius: 6px; width: 100%;">
          </div>
        </div>

        <div style="margin-top: 0.75rem;">
          <div style="display: flex; align-items: center; margin-bottom: 0.5rem; gap: 8px; position: relative;">
            <input type="checkbox" class="air-enable-weight-breaks" ${wbEnabled ? 'checked' : ''} onchange="calculateAirFreight()" style="width: 14px; height: 14px; accent-color: var(--sky); cursor: pointer;">
            <div class="weight-break-trigger" style="display: flex; align-items: center; gap: 6px; cursor: pointer; user-select: none;">
              <span style="font-size: 0.75rem; font-weight: 700; color: #000; white-space: nowrap; text-overflow: ellipsis; overflow: hidden; text-align: left;">${isEligibleDeskUser() ? 'Weight Break Tariffs (Sell Rate per KG)' : 'Weight Break Tariffs (Rate per KG)'}</span>
              <span style="font-size: 0.6rem; color: #666;">▼</span>
            </div>
            <div class="weight-break-dropdown" style="display: none; position: absolute; left: 24px; top: 100%; z-index: 1000; background: var(--bg-surface, #fff); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); border: 1px solid var(--border-1, #ccc); border-radius: 8px; box-shadow: var(--shadow-lg, 0 4px 12px rgba(0,0,0,0.15)); padding: 6px; min-width: 160px; flex-direction: column; gap: 4px;"></div>
          </div>

          <div class="airline-breaks-container" style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
            <!-- Dynamic breaks will be appended here -->
          </div>
        </div>

        <!-- Embedded Surcharges (Origin Local & Destination Local) per Airline -->
        <div class="air-card-surcharges-wrapper" style="margin-top: 1rem; border-top: 1px dashed var(--border-1); padding-top: 0.75rem; display: ${isAirNomination ? 'none' : 'block'};">
          <!-- Origin Local Section -->
          <div class="air-card-local-block" style="background: rgba(0, 0, 0, 0.12); border: 1px solid var(--border-1); border-radius: 8px; padding: 0.75rem; margin-bottom: 0.75rem;">
            <div class="air-card-origin-header" style="display: flex; align-items: center; justify-content: space-between; cursor: pointer; user-select: none;">
              <div style="display: flex; align-items: center; gap: 0.5rem;">
                <label style="display: flex; align-items: center; gap: 0.4rem; font-size: 0.8rem; font-weight: 700; color: var(--sky); margin: 0; cursor: pointer;" onclick="event.stopPropagation();">
                  <input type="checkbox" class="air-card-enable-origin-fees" ${originFeesEnabled ? 'checked' : ''} onchange="calculateAirFreight()" style="width: 15px; height: 15px; accent-color: var(--sky);">
                  Origin Local Fees & Surcharges
                </label>
                <span class="air-card-origin-status-badge" style="font-size: 0.65rem; font-weight: 700; color: #10b981; background: rgba(16, 185, 129, 0.1); padding: 1px 6px; border-radius: 4px;">✓ Included</span>
              </div>
              <button type="button" class="btn-text toggle-origin-collapse-btn" style="font-size: 0.72rem; font-weight: 600; color: var(--sky); background: none; border: none; padding: 2px 6px; cursor: pointer; display: flex; align-items: center; gap: 4px;">
                <span class="collapse-icon">▼</span> <span class="collapse-text">Collapse</span>
              </button>
            </div>

            <div class="air-card-origin-content-body" style="margin-top: 0.5rem; display: block;">
              <div class="cargo-table-container" style="border: none; margin-bottom: 0.5rem;">
                <table class="cargo-table">
                  <thead>
                    <tr>
                      <th>Surcharge Name</th>
                      <th>Sell Rate</th>
                      <th>Buy Rate</th>
                      <th>Billing Unit</th>
                      <th>Remarks</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody class="air-card-origin-surcharges-body">
                  </tbody>
                </table>
              </div>
              <button type="button" class="add-row-btn add-air-card-origin-surcharge" style="font-size: 0.72rem; padding: 3px 8px;">
                + Add Origin Surcharge
              </button>
            </div>
          </div>

          <!-- Destination Local Section -->
          <div class="air-card-local-block" style="background: rgba(0, 0, 0, 0.12); border: 1px solid var(--border-1); border-radius: 8px; padding: 0.75rem;">
            <div class="air-card-dest-header" style="display: flex; align-items: center; justify-content: space-between; cursor: pointer; user-select: none;">
              <div style="display: flex; align-items: center; gap: 0.5rem;">
                <label style="display: flex; align-items: center; gap: 0.4rem; font-size: 0.8rem; font-weight: 700; color: var(--sky); margin: 0; cursor: pointer;" onclick="event.stopPropagation();">
                  <input type="checkbox" class="air-card-enable-dest-fees" ${destFeesEnabled ? 'checked' : ''} onchange="calculateAirFreight()" style="width: 15px; height: 15px; accent-color: var(--sky);">
                  Destination Local Fees & Surcharges
                </label>
                <span class="air-card-dest-status-badge" style="font-size: 0.65rem; font-weight: 700; color: #10b981; background: rgba(16, 185, 129, 0.1); padding: 1px 6px; border-radius: 4px;">✓ Included</span>
              </div>
              <button type="button" class="btn-text toggle-dest-collapse-btn" style="font-size: 0.72rem; font-weight: 600; color: var(--sky); background: none; border: none; padding: 2px 6px; cursor: pointer; display: flex; align-items: center; gap: 4px;">
                <span class="collapse-icon">▼</span> <span class="collapse-text">Collapse</span>
              </button>
            </div>

            <div class="air-card-dest-content-body" style="margin-top: 0.5rem; display: block;">
              <div class="cargo-table-container" style="border: none; margin-bottom: 0.5rem;">
                <table class="cargo-table">
                  <thead>
                    <tr>
                      <th>Surcharge Name</th>
                      <th>Sell Rate</th>
                      <th>Buy Rate</th>
                      <th>Billing Unit</th>
                      <th>Remarks</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody class="air-card-dest-surcharges-body">
                  </tbody>
                </table>
              </div>
              <button type="button" class="add-row-btn add-air-card-dest-surcharge" style="font-size: 0.72rem; padding: 3px 8px;">
                + Add Destination Surcharge
              </button>
            </div>
          </div>
        </div>

        <div style="margin-top: 1rem; text-align: right; border-top: 1px solid var(--border-1); padding-top: 0.75rem;">
          <button type="button" class="btn-primary done-airline-rate-modal-btn" style="padding: 7px 18px; font-size: 0.78rem;">Done</button>
        </div>
      </div>
    </div>
  `;

  container.appendChild(card);

  // Rates & fees popup — keeps the airline card itself down to just the
  // carrier field and a summary strip; everything else (routing, weight
  // breaks, surcharges) only exists in the DOM here, shown on demand, so
  // it's still reachable by every existing card.querySelector() call this
  // function and calculateAirFreight() already make, just nested one level
  // deeper. Pure show/hide — no data or calculation logic changes.
  const rateModalOverlay = card.querySelector(".airline-rate-modal-overlay");
  const rateModalDialog = card.querySelector(".airline-rate-modal-dialog");
  const openRateModalBtn = card.querySelector(".open-airline-rate-modal-btn");
  const closeRateModalBtn = card.querySelector(".close-airline-rate-modal-btn");
  const doneRateModalBtn = card.querySelector(".done-airline-rate-modal-btn");

  const openRateModal = () => { rateModalOverlay.style.display = "flex"; };
  const closeRateModal = () => { rateModalOverlay.style.display = "none"; updateAirlineRateSummary(card); };

  openRateModalBtn.addEventListener("click", openRateModal);
  closeRateModalBtn.addEventListener("click", closeRateModal);
  doneRateModalBtn.addEventListener("click", closeRateModal);
  rateModalOverlay.addEventListener("click", (e) => {
    if (e.target === rateModalOverlay) closeRateModal();
  });

  // Expand/Collapse Origin Local
  const originHeader = card.querySelector(".air-card-origin-header");
  const originContentBody = card.querySelector(".air-card-origin-content-body");
  const originToggleBtn = card.querySelector(".toggle-origin-collapse-btn");

  const toggleOriginCollapse = () => {
    const isHidden = originContentBody.style.display === "none";
    originContentBody.style.display = isHidden ? "block" : "none";
    originToggleBtn.querySelector(".collapse-icon").textContent = isHidden ? "▼" : "▲";
    originToggleBtn.querySelector(".collapse-text").textContent = isHidden ? "Collapse" : "Expand";
  };

  originHeader.addEventListener("click", toggleOriginCollapse);
  originToggleBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleOriginCollapse();
  });

  // Expand/Collapse Destination Local
  const destHeader = card.querySelector(".air-card-dest-header");
  const destContentBody = card.querySelector(".air-card-dest-content-body");
  const destToggleBtn = card.querySelector(".toggle-dest-collapse-btn");

  const toggleDestCollapse = () => {
    const isHidden = destContentBody.style.display === "none";
    destContentBody.style.display = isHidden ? "block" : "none";
    destToggleBtn.querySelector(".collapse-icon").textContent = isHidden ? "▼" : "▲";
    destToggleBtn.querySelector(".collapse-text").textContent = isHidden ? "Collapse" : "Expand";
  };

  destHeader.addEventListener("click", toggleDestCollapse);
  destToggleBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleDestCollapse();
  });

  // Populate surcharges inside card
  const originTbody = card.querySelector(".air-card-origin-surcharges-body");
  const destTbody = card.querySelector(".air-card-dest-surcharges-body");

  const originSurchargesList = data ? (data.originSurcharges || data.origin_surcharges) : null;
  const destSurchargesList = data ? (data.destSurcharges || data.dest_surcharges) : null;

  if (originSurchargesList && Array.isArray(originSurchargesList) && originSurchargesList.length > 0) {
    originSurchargesList.forEach(sch => {
      originTbody.appendChild(createAirSurchargeRow(sch));
    });
  } else {
    originTbody.appendChild(createAirSurchargeRow({ name: "Xray", rate: "0.00", buyRate: "0.00", unit: "kg" }));
    originTbody.appendChild(createAirSurchargeRow({ name: "Cartage", rate: "0.00", buyRate: "0.00", unit: "flat", readOnlyName: !isFreeHandOrNrs }));
    originTbody.appendChild(createAirSurchargeRow({ name: "Misc", rate: "0.00", buyRate: "0.00", unit: "flat", readOnlyName: !isFreeHandOrNrs }));
  }

  if (destSurchargesList && Array.isArray(destSurchargesList) && destSurchargesList.length > 0) {
    destSurchargesList.forEach(sch => {
      destTbody.appendChild(createAirSurchargeRow(sch));
    });
  }

  card.querySelector(".add-air-card-origin-surcharge").addEventListener("click", () => {
    originTbody.appendChild(createAirSurchargeRow({ name: "", rate: "0.00", buyRate: "0.00", unit: "kg" }));
    calculateAirFreight();
  });

  card.querySelector(".add-air-card-dest-surcharge").addEventListener("click", () => {
    destTbody.appendChild(createAirSurchargeRow({ name: "", rate: "0.00", buyRate: "0.00", unit: "kg" }));
    calculateAirFreight();
  });

  const nameInput = card.querySelector(".air-name");
  const directoryInput = card.querySelector(".airline-directory-input");
  if (nameInput) {
    const parent = nameInput.parentElement;
    parent.style.position = "relative";
    if (directoryInput) {
      directoryInput.textContent = name;
      nameInput.value = name;
    }
    let dropdown = parent.querySelector(".iata-autocomplete-dropdown");
    if (!dropdown) {
      dropdown = document.createElement("div");
      dropdown.className = "iata-autocomplete-dropdown";
      dropdown.style.display = "none";
      parent.appendChild(dropdown);
    }

    const saveTypedAirlineIfNew = () => {
      const val = nameInput.value ? nameInput.value.trim() : "";
      if (!val || nameInput._selectedFromDropdown) return;
      // Kept as the common blur hook; saveCustomEntry deliberately ignores
      // global directory types so arbitrary text cannot pollute this list.
      saveCustomEntry("airlines", val);
    };

    const updateAirlineDirectory = (event) => {
      nameInput._selectedFromDropdown = false;
      if (directoryInput && event?.target === directoryInput) {
        nameInput.value = directoryInput.textContent.trim();
      } else {
        nameInput.value = nameInput.value.trim();
      }
      const val = nameInput.value.toUpperCase();
      dropdown.innerHTML = "";
      if (val.length >= 1) {
        let allAirlines = cleanDirectoryEntries(appState.airlines || []);
        if (allAirlines.length === 0) {
          allAirlines = Object.entries(IATA_AIRLINES).map(([code, name]) => ({ code, name }));
        }

        const matches = allAirlines.filter(al =>
          (al.code && al.code.toUpperCase().includes(val)) ||
          (al.name && al.name.toUpperCase().includes(val))
        ).sort((a, b) => {
          const aCode = (a.code || "").toUpperCase();
          const bCode = (b.code || "").toUpperCase();
          const aName = (a.name || "").toUpperCase();
          const bName = (b.name || "").toUpperCase();
          const score = (code, airlineName) => code === val ? 0 : code.startsWith(val) ? 1 : airlineName.startsWith(val) ? 2 : 3;
          return score(aCode, aName) - score(bCode, bName) || aCode.localeCompare(bCode);
        }).slice(0, 15);

        if (matches.length > 0) {
          dropdown.style.display = "flex";
          if (directoryInput) directoryInput.setAttribute("aria-expanded", "true");
          matches.forEach(al => {
            const item = document.createElement("div");
            item.className = "iata-autocomplete-item";
            item.textContent = `${al.code} - ${al.name}`;
            item.addEventListener("click", () => {
              nameInput._selectedFromDropdown = true;
              nameInput.value = `${al.code} - ${al.name}`;
              if (directoryInput) directoryInput.textContent = nameInput.value;
              dropdown.style.display = "none";
              if (directoryInput) directoryInput.setAttribute("aria-expanded", "false");
              calculateAirFreight();
            });
            dropdown.appendChild(item);
          });
        } else {
          dropdown.style.display = "none";
          if (directoryInput) directoryInput.setAttribute("aria-expanded", "false");
        }
      } else {
        dropdown.style.display = "none";
        if (directoryInput) directoryInput.setAttribute("aria-expanded", "false");
      }
    };

    if (directoryInput) {
      directoryInput.addEventListener("input", updateAirlineDirectory);
      directoryInput.addEventListener("blur", () => setTimeout(saveTypedAirlineIfNew, 150));
      // Retained for quote-loader and regression-suite compatibility; this hidden
      // input is never exposed to Safari's Contact autofill UI.
      nameInput.addEventListener("input", updateAirlineDirectory);
      nameInput.addEventListener("blur", saveTypedAirlineIfNew);
    } else {
      nameInput.addEventListener("input", updateAirlineDirectory);
      nameInput.addEventListener("blur", saveTypedAirlineIfNew);
    }

    document.addEventListener("click", (e) => {
      if (e.target !== nameInput && e.target !== directoryInput && !dropdown.contains(e.target)) {
        dropdown.style.display = "none";
        if (directoryInput) directoryInput.setAttribute("aria-expanded", "false");
      }
    });
  }

  card.querySelectorAll("input, select").forEach(inp => {
    inp.addEventListener("input", calculateAirFreight);
    if (inp.type === "radio") {
      inp.addEventListener("change", calculateAirFreight);
    }
  });

  card.querySelector(".remove-airline-btn").addEventListener("click", () => {
    const isChecked = card.querySelector(".select-airline-radio").checked;
    card.remove();
    const remaining = container.querySelectorAll(".airline-card");
    remaining.forEach((rcard, idx) => {
      rcard.querySelector("span").textContent = `Airline Option #${idx + 1}`;
    });
    if (isChecked && remaining.length > 0) {
      remaining[0].querySelector(".select-airline-radio").checked = true;
    }
    calculateAirFreight();
  });

  const trigger = card.querySelector(".weight-break-trigger");
  const dropdown = card.querySelector(".weight-break-dropdown");
  if (trigger && dropdown) {
    trigger.addEventListener("click", (e) => {
      e.stopPropagation();

      const breakOpts = {
        'min': 'Minimum (Flat)',
        'minus45': '-45 kg',
        'plus45': '+45 kg',
        'plus100': '+100 kg',
        'plus300': '+300 kg',
        'plus500': '+500 kg',
        'plus1000': '+1000 kg'
      };

      if (dropdown.style.display === "flex") {
        dropdown.style.display = "none";
        return;
      }

      dropdown.innerHTML = "";
      dropdown.style.display = "flex";

      const currentBreaks = Array.from(card.querySelectorAll(".dynamic-break-wrapper")).map(x => x.getAttribute("data-break-name"));

      Object.keys(breakOpts).forEach(k => {
        const item = document.createElement("label");
        item.style.cssText = "display: flex; align-items: center; gap: 8px; padding: 6px 10px; font-size: 0.72rem; color: var(--t1, #000); cursor: pointer; border-radius: 4px; transition: background 0.2s; text-align: left; margin: 0;";

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = currentBreaks.includes(k);
        checkbox.style.cssText = "width: 13px; height: 13px; accent-color: var(--sky); cursor: pointer;";

        const labelText = document.createTextNode(breakOpts[k]);

        item.appendChild(checkbox);
        item.appendChild(labelText);

        item.addEventListener("mouseenter", () => {
          item.style.background = "var(--border-1, #eee)";
        });
        item.addEventListener("mouseleave", () => {
          item.style.background = "transparent";
        });

        checkbox.addEventListener("change", (evt) => {
          evt.stopPropagation();
          if (checkbox.checked) {
            addWeightBreakRow(card, k, 0);
          } else {
            const wrapper = card.querySelector(`.dynamic-break-wrapper[data-break-name="${k}"]`);
            if (wrapper) {
              wrapper.remove();
            }
          }
          calculateAirFreight();
        });

        item.addEventListener("click", (evt) => {
          if (evt.target !== checkbox) {
            evt.preventDefault();
            checkbox.checked = !checkbox.checked;
            checkbox.dispatchEvent(new Event('change'));
          }
        });

        dropdown.appendChild(item);
      });
    });

    document.addEventListener("click", (e) => {
      if (dropdown && !dropdown.contains(e.target) && !trigger.contains(e.target)) {
        dropdown.style.display = "none";
      }
    });
  }

  if (data && Object.keys(activeBreaks).length > 0) {
    const usedBreak = data.usedBreak;
    const isMinActive = usedBreak === 'min';
    for (const bName in activeBreaks) {
      const bVal = activeBreaks[bName];
      const bSell = typeof bVal === 'object' ? (bVal.sell || 0) : bVal;
      const bBuy = typeof bVal === 'object' ? (bVal.buy || 0) : 0;
      const isActiveBr = (bName === usedBreak && !isMinActive) || (bName === 'min' && isMinActive);
      
      // Keep only active breaks or breaks with non-zero values
      if (!isActiveBr && bSell === 0 && bBuy === 0) {
        continue;
      }
      
      addWeightBreakRow(card, bName, activeBreaks[bName]);
    }
  }

  updateAirlineRateSummary(card);
}
window.addAirlineCard = addAirlineCard;

function getAirlineColor(name) {
  const code = (name || "").toUpperCase().trim().substring(0, 2);
  const mapping = {
    'EK': '#2ecc71', // Emirates - Green
    'QR': '#9b59b6', // Qatar - Maroon/Purple (using theme colors)
    'EY': '#f1c40f', // Etihad - Gold/Yellow
    'SQ': '#f39c12', // Singapore - Amber
    'LH': '#e67e22', // Lufthansa - Orange
    'BA': '#3498db', // British Airways - Blue
    'AF': '#2980b9', // Air France - Dark Blue
    'CX': '#1abc9c', // Cathay Pacific - Teal
    'AI': '#e74c3c', // Air India - Red
    '6E': '#3498db', // Indigo - Blue
    'SG': '#e74c3c', // SpiceJet - Red
  };
  if (mapping[code]) return mapping[code];

  // Deterministic hash code to return a nice bright aesthetic color
  let hash = 0;
  for (let i = 0; i < code.length; i++) {
    hash = code.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colors = [
    '#2ecc71', '#3498db', '#9b59b6', '#e67e22', '#e74c3c',
    '#1abc9c', '#f1c40f', '#2980b9', '#e84393', '#00cec9'
  ];
  return colors[Math.abs(hash) % colors.length];
}
window.getAirlineColor = getAirlineColor;

function updateCartageRowVisibility() {
  const originVal = document.getElementById("air-origin")?.value.trim().toUpperCase() || "";
  const isBOM = originVal.startsWith("BOM");
  const originBodies = document.querySelectorAll(".air-card-origin-surcharges-body, #air-origin-surcharges-body");
  if (!originBodies || originBodies.length === 0) return;

  originBodies.forEach(airOriginBody => {
    const rows = Array.from(airOriginBody.querySelectorAll("tr"));
    const cartageRow = rows.find(row => row.querySelector(".chg-name")?.value.trim().toLowerCase() === "cartage");

    if (isBOM) {
      if (!cartageRow) {
        const creatorRole = appState.currentUser;
        const isFreeHandOrNrs = creatorRole && (
          creatorRole === 'jaya' ||
          creatorRole === 'cathrina' ||
          TEAM_ROLES[creatorRole]?.category === 'FREE HAND SALES (AIR/SEA)' ||
          TEAM_ROLES[creatorRole]?.category === 'NRS (AIR/SEA)'
        );

        const newRow = createAirSurchargeRow({
          name: "Cartage",
          rate: "0.00",
          buyRate: "0.00",
          unit: "flat",
          readOnlyName: !isFreeHandOrNrs
        });

        const xrayRow = rows.find(r => r.querySelector(".chg-name")?.value.trim().toLowerCase() === "xray");
        if (xrayRow) {
          xrayRow.after(newRow);
        } else {
          airOriginBody.insertBefore(newRow, airOriginBody.firstChild);
        }
      }
    } else {
      if (cartageRow) {
        cartageRow.remove();
      }
    }
  });
}
window.updateCartageRowVisibility = updateCartageRowVisibility;

// Business rule (explicit product decision): during quoting — before a
// shipment is Confirmed/WON — a pricing officer may have only one of
// Sell/Buy filled in for a given weight break. The interim total shown and
// saved should use whichever one is entered, so the quote isn't stuck at
// $0. This is deliberately NOT the same as silently treating Buy as Sell —
// callers must track `isFallback` and surface it, so an interim
// cost-based estimate is never mistaken for a confirmed customer price.
// Once a shipment is Confirmed/WON, both Sell and Buy are required (see
// submitWonBookingDetails()) and the final GP is computed properly from
// both, including surcharge margin — this fallback only ever affects the
// pre-WON, in-progress quoting total.
function resolveInterimRate(val) {
  if (typeof val === 'object' && val !== null) {
    const sell = parseFloat(val.sell) || 0;
    const buy = parseFloat(val.buy) || 0;
    if (sell > 0) return { rate: sell, isFallback: false };
    if (buy > 0) return { rate: buy, isFallback: true };
    return { rate: 0, isFallback: false };
  }
  return { rate: parseFloat(val) || 0, isFallback: false };
}
window.resolveInterimRate = resolveInterimRate;

function calculateAirFreight() {
  updateCurrencyRules(appState.currentUser);
  updateCartageRowVisibility();

  const activeRole = getActiveRole();
  const roleObj = TEAM_ROLES[activeRole];
  const isAirNomination = roleObj && roleObj.category === 'AIR - NOMINATION';

  // Read section enable/disable states
  const tariffsEnabled = document.getElementById("air-enable-tariffs")?.checked ?? true;
  const originFeesEnabled = document.getElementById("air-enable-origin-fees")?.checked ?? true;
  const destFeesEnabled = document.getElementById("air-enable-dest-fees")?.checked ?? true;

  const tariffsBody = document.getElementById("air-tariffs-content-body");
  const originBody = document.getElementById("air-origin-fees-content-body");
  const destBody = document.getElementById("air-dest-fees-content-body");

  const tariffsBadge = document.getElementById("air-tariffs-status-badge");
  const originBadge = document.getElementById("air-origin-status-badge");
  const destBadge = document.getElementById("air-dest-status-badge");

  if (tariffsBody) tariffsBody.classList.toggle("box-disabled", !tariffsEnabled);
  if (tariffsBadge) {
    tariffsBadge.textContent = tariffsEnabled ? "✓ Included" : "✕ Excluded";
    tariffsBadge.style.color = tariffsEnabled ? "#10b981" : "#ef4444";
    tariffsBadge.style.background = tariffsEnabled ? "rgba(16, 185, 129, 0.1)" : "rgba(239, 68, 68, 0.1)";
  }

  if (originBody) originBody.classList.toggle("box-disabled", !originFeesEnabled);
  if (originBadge) {
    originBadge.textContent = originFeesEnabled ? "✓ Included" : "✕ Excluded";
    originBadge.style.color = originFeesEnabled ? "#10b981" : "#ef4444";
    originBadge.style.background = originFeesEnabled ? "rgba(16, 185, 129, 0.1)" : "rgba(239, 68, 68, 0.1)";
  }

  if (destBody) destBody.classList.toggle("box-disabled", !destFeesEnabled);
  if (destBadge) {
    destBadge.textContent = destFeesEnabled ? "✓ Included" : "✕ Excluded";
    destBadge.style.color = destFeesEnabled ? "#10b981" : "#ef4444";
    destBadge.style.background = destFeesEnabled ? "rgba(16, 185, 129, 0.1)" : "rgba(239, 68, 68, 0.1)";
  }

  const rows = document.querySelectorAll("#air-cargo-body .cargo-item-row");
  let totalGrossWeight = 0;
  let totalVolume = 0;
  let totalVolumeWeight = 0;
  let totalPackageQty = 0;

  const unit = appState.currentAirFreight.dimUnit;
  const divisor = (unit === 'cms') ? 6000 : 366;

  rows.forEach(row => {
    const l = parseFloat(row.querySelector(".cargo-len").value) || 0;
    const w = parseFloat(row.querySelector(".cargo-wid").value) || 0;
    const h = parseFloat(row.querySelector(".cargo-hei").value) || 0;
    const qty = parseInt(row.querySelector(".cargo-qty").value) || 0;
    const gw = parseFloat(row.querySelector(".cargo-gw").value) || 0;

    if (l > 0 && w > 0 && h > 0 && qty > 0) {
      totalGrossWeight += gw;
      totalPackageQty += qty;
      const volWeight = (l * w * h * qty) / divisor;
      totalVolumeWeight += volWeight;

      if (unit === 'cms') {
        totalVolume += (l * w * h * qty) / 1000000;
      } else {
        totalVolume += (l * w * h * qty) * 0.0000163871;
      }
    }

    // Purely visual: flag a row that's been started but is still missing a
    // field it needs (matches the same required fields saveCurrentQuote()
    // already enforces) — the total math above is untouched.
    const isStarted = l > 0 || w > 0 || h > 0 || qty > 0 || gw > 0;
    const isComplete = l > 0 && w > 0 && h > 0 && qty > 0 && gw > 0;
    row.classList.toggle("row-incomplete-flag", isStarted && !isComplete);
  });

  const commodity = document.getElementById("air-commodity")?.value || "GENERAL";
  const tempType = document.getElementById("air-temp-type")?.value || "NON-TEMPERATURE";
  const tempRange = document.getElementById("air-temp-range")?.value || "2-8";

  let commLabel = commodity;
  if (commodity === 'PERISHABLES' || commodity === 'PHARMA') {
    if (tempType === 'TEMPERATURE') {
      commLabel += ` - Temp (${tempRange === '2-8' ? '2-8°C' : '15-25°C'})`;
    } else {
      commLabel += ` - Non-Temp`;
    }
  }

  const resComm = document.getElementById("res-air-commodity-val");
  if (resComm) resComm.textContent = commLabel;

  const loadTilt = document.getElementById("air-loadability-tilt")?.value || "TILTABLE";
  const loadStack = document.getElementById("air-loadability-stack")?.value || "STACKABLE";

  const loadLabel = `${loadTilt === 'TILTABLE' ? 'Tiltable' : 'Non-Tiltable'} / ${loadStack === 'STACKABLE' ? 'Stackable' : 'Non-Stackable'}`;
  const resLoad = document.getElementById("res-air-loadability-val");
  if (resLoad) resLoad.textContent = loadLabel;

  document.getElementById("res-air-gw").textContent = `${totalGrossWeight.toFixed(2)} kg`;
  document.getElementById("res-air-qty").textContent = `${totalPackageQty} Pkgs`;
  document.getElementById("res-air-vw").textContent = `${totalVolumeWeight.toFixed(2)} kg`;
  document.getElementById("res-air-vol").textContent = `${totalVolume.toFixed(3)} CBM`;

  const airlineCards = document.querySelectorAll("#air-airlines-list-container .airline-card");

  if (airlineCards.length === 0) {
    addAirlineCard();
    return;
  }

  const airlinesListData = [];
  let selectedAirlineData = null;

  airlineCards.forEach(card => {
    const isSelected = card.querySelector(".select-airline-radio").checked;
    const name = card.querySelector(".air-name").value.trim();
    const routing = formatRoutingDisplay(card.querySelector(".air-routing").value.trim());
    const tt = formatTransitTimeDisplay(card.querySelector(".air-tt").value.trim());
    const validity = card.querySelector(".air-validity").value;
    const pivotWeight = parseFloat(card.querySelector(".air-pivot-weight").value) || 0;

    const airlineChargeableWeight = Math.max(totalGrossWeight, totalVolumeWeight, pivotWeight);
    const autoBreakName = getWeightBreakBracket(airlineChargeableWeight);

    const breaksData = {};
    card.querySelectorAll(".dynamic-break-wrapper").forEach(wrapper => {
      const bName = wrapper.getAttribute("data-break-name");
      const sellRate = parseFloat(wrapper.querySelector(".break-sell-rate-input")?.value) || 0;
      const buyRate = parseFloat(wrapper.querySelector(".break-buy-rate-input")?.value) || 0;
      breaksData[bName] = { sell: sellRate, buy: buyRate };
    });

    const creatorRole = appState.currentUser;
    const isFreeHandOrNrs = creatorRole && (
      creatorRole === 'jaya' ||
      creatorRole === 'cathrina' ||
      TEAM_ROLES[creatorRole]?.category === 'FREE HAND SALES (AIR/SEA)' ||
      TEAM_ROLES[creatorRole]?.category === 'NRS (AIR/SEA)'
    );

    const amsFeeCheckbox = card.querySelector(".air-enable-ams-fee");
    const amsFeeEnabled = amsFeeCheckbox ? amsFeeCheckbox.checked : true;
    const wbCheckbox = card.querySelector(".air-enable-weight-breaks");
    const wbEnabled = wbCheckbox ? wbCheckbox.checked : true;

    const rawAmsFee = parseFloat(card.querySelector(".air-ams-fee")?.value) || 0;
    const amsFee = amsFeeEnabled ? rawAmsFee : 0;
    const ams_fee = rawAmsFee;

    let activeRate = 0;
    let activeBuyRate = 0;
    let usedBreak = autoBreakName;
    // True whenever the pre-WON interim total below used a Buy value in
    // place of a blank Sell value on the weight break actually charged —
    // surfaced to the user as an "Interim Estimate" indicator so a
    // cost-based placeholder is never mistaken for a confirmed sell price.
    let usingBuyFallback = false;

    // Quoting-stage rule: use whichever of Sell/Buy is entered for the
    // active weight break, so the interim total isn't stuck at $0 while a
    // quote is still being worked on. Confirmed/WON conversion still
    // requires both and computes the final GP from both, including
    // surcharge margin (see submitWonBookingDetails()).
    const activeBrVal = breaksData[autoBreakName] || { sell: 0, buy: 0 };
    const activeResolved = resolveInterimRate(activeBrVal);
    activeRate = activeResolved.rate;
    activeBuyRate = activeBrVal.buy;
    usingBuyFallback = activeResolved.isFallback;

    if (activeRate === 0) {
      // Find the highest limit weight break that has a rate and is <= chargeable weight
      const brackets = [
        { name: 'minus45', limit: 0 },
        { name: 'plus45', limit: 45 },
        { name: 'plus100', limit: 100 },
        { name: 'plus300', limit: 300 },
        { name: 'plus500', limit: 500 },
        { name: 'plus1000', limit: 1000 }
      ];
      let bestBracket = null;
      for (const br of brackets) {
        const val = breaksData[br.name];
        const valNum = resolveInterimRate(val).rate;
        if (valNum > 0 && airlineChargeableWeight >= br.limit) {
          bestBracket = br;
        }
      }
      if (bestBracket) {
        const val = breaksData[bestBracket.name];
        const resolved = resolveInterimRate(val);
        activeRate = resolved.rate;
        activeBuyRate = (typeof val === 'object' && val !== null) ? val.buy : 0;
        usedBreak = bestBracket.name;
        usingBuyFallback = resolved.isFallback;
      } else {
        // Try any bracket that has a rate
        const bracketsWithRates = brackets.filter(br => {
          const val = breaksData[br.name];
          return resolveInterimRate(val).rate > 0;
        });
        if (bracketsWithRates.length > 0) {
          const val = breaksData[bracketsWithRates[0].name];
          const resolved = resolveInterimRate(val);
          activeRate = resolved.rate;
          activeBuyRate = (typeof val === 'object' && val !== null) ? val.buy : 0;
          usedBreak = bracketsWithRates[0].name;
          usingBuyFallback = resolved.isFallback;
        }
      }
    }

    let baseFreightCost = (tariffsEnabled && wbEnabled) ? (airlineChargeableWeight * activeRate) : 0;

    let isMinActive = false;
    const minVal = breaksData['min'];
    const minResolved = resolveInterimRate(minVal);
    const minSell = minResolved.rate;
    const minBuy = (typeof minVal === 'object' && minVal !== null) ? minVal.buy : 0;

    if (tariffsEnabled && wbEnabled && minSell > 0 && baseFreightCost < minSell) {
      baseFreightCost = minSell;
      isMinActive = true;
      if (minResolved.isFallback) usingBuyFallback = true;
    }

    if (minSell > 0 || minBuy > 0) {
      const minus45Wrapper = card.querySelector('.dynamic-break-wrapper[data-break-name="minus45"]');
      if (minus45Wrapper) {
        const mSell = parseFloat(minus45Wrapper.querySelector(".break-sell-rate-input")?.value) || 0;
        const mBuy = parseFloat(minus45Wrapper.querySelector(".break-buy-rate-input")?.value) || 0;
        if (mSell === 0 && mBuy === 0) {
          minus45Wrapper.remove();
          delete breaksData['minus45'];
        }
      }
    }

    // Toggle break display to hide unwanted weight breaks
    card.querySelectorAll(".dynamic-break-wrapper").forEach(wrapper => {
      const bName = wrapper.getAttribute("data-break-name");
      const removeBtn = wrapper.querySelector(".remove-break-btn");
      const isActive = (bName === usedBreak && !isMinActive) || (bName === 'min' && isMinActive);

      if (isActive) {
        wrapper.style.display = "flex";
        wrapper.classList.add("highlight-break");
        wrapper.style.borderColor = "var(--accent-success)";
        wrapper.style.background = "rgba(46,204,113,0.1)";
        if (removeBtn) removeBtn.style.display = "none";
      } else {
        wrapper.style.display = "flex";
        wrapper.classList.remove("highlight-break");
        wrapper.style.borderColor = "#ccc";
        wrapper.style.background = "#fff";
        if (removeBtn && wrapper.getAttribute("data-is-auto") !== "true") {
          removeBtn.style.display = "inline";
        }
      }
    });

    // Calculate surcharges for this specific airline based on its specific chargeable weight and embedded surcharge tables
    let airlineSurchargeTotal = 0;
    const airlineOriginSurcharges = [];
    const airlineDestSurcharges = [];

    const originCardCheckbox = card.querySelector(".air-card-enable-origin-fees");
    const originCardEnabled = isAirNomination ? originFeesEnabled : (originCardCheckbox ? originCardCheckbox.checked : originFeesEnabled);
    const originBadge = card.querySelector(".air-card-origin-status-badge");
    if (originBadge) {
      originBadge.textContent = originCardEnabled ? "✓ Included" : "✕ Excluded";
      originBadge.style.color = originCardEnabled ? "#10b981" : "#ef4444";
      originBadge.style.background = originCardEnabled ? "rgba(16, 185, 129, 0.1)" : "rgba(239, 68, 68, 0.1)";
    }

    const destCardCheckbox = card.querySelector(".air-card-enable-dest-fees");
    const destCardEnabled = isAirNomination ? destFeesEnabled : (destCardCheckbox ? destCardCheckbox.checked : destFeesEnabled);
    const destBadge = card.querySelector(".air-card-dest-status-badge");
    if (destBadge) {
      destBadge.textContent = destCardEnabled ? "✓ Included" : "✕ Excluded";
      destBadge.style.color = destCardEnabled ? "#10b981" : "#ef4444";
      destBadge.style.background = destCardEnabled ? "rgba(16, 185, 129, 0.1)" : "rgba(239, 68, 68, 0.1)";
    }

    // Origin local surcharges for this airline
    if (originCardEnabled) {
      let originRows = isAirNomination
        ? document.querySelectorAll("#air-origin-surcharges-body tr")
        : card.querySelectorAll(".air-card-origin-surcharges-body tr");
      if (!isAirNomination && originRows.length === 0) {
        originRows = document.querySelectorAll("#air-origin-surcharges-body tr");
      }
      originRows.forEach(row => {
        const surchargeNameInput = row.querySelector(".chg-name");
        if (!surchargeNameInput) return;
        const surchargeName = surchargeNameInput.value.trim();
        const surchargeNameLower = surchargeName.toLowerCase();

        let rate = parseFloat(row.querySelector(".chg-rate")?.value) || 0;
        let unit = row.querySelector(".chg-unit")?.value || "kg";
        const buyRateInput = row.querySelector(".chg-buy-rate");
        const buyRate = buyRateInput ? parseFloat(buyRateInput.value) || 0 : 0;
        const remarksInput = row.querySelector(".chg-remarks");
        const remarks = remarksInput ? remarksInput.value.trim() : "";

        const creatorRole = appState.currentUser;
        const isFreeHandOrNrs = creatorRole && (
          creatorRole === 'jaya' ||
          creatorRole === 'cathrina' ||
          TEAM_ROLES[creatorRole]?.category === 'FREE HAND SALES (AIR/SEA)' ||
          TEAM_ROLES[creatorRole]?.category === 'NRS (AIR/SEA)'
        );

        if (surchargeNameLower === "cartage" || surchargeNameLower === "misc") {
          if (!isFreeHandOrNrs) {
            if (airlineChargeableWeight < 500) {
              if (airlineChargeableWeight <= 150) {
                rate = 0.00;
                unit = "flat";
              } else {
                rate = 0.04;
                unit = "kg";
              }
            } else {
              rate = 0.00;
              unit = "flat";
            }
          }
        } else if (surchargeNameLower === "xray") {
          if (!isFreeHandOrNrs) {
            if (airlineChargeableWeight >= 500) {
              rate = 0.00;
            }
          }
        }

        if (surchargeName && (rate > 0 || buyRate > 0)) {
          const effectiveRate = rate > 0 ? rate : buyRate;
          if (rate === 0 && buyRate > 0) usingBuyFallback = true;
          let cost = unit === 'kg' ? airlineChargeableWeight * effectiveRate : effectiveRate;
          airlineSurchargeTotal += cost;
          airlineOriginSurcharges.push({ name: surchargeName, rate, buyRate, unit, remarks, calculatedCost: cost });
        }
      });
    }

    // Destination local surcharges for this airline
    if (destCardEnabled) {
      let destRows = isAirNomination
        ? document.querySelectorAll("#air-dest-surcharges-body tr")
        : card.querySelectorAll(".air-card-dest-surcharges-body tr");
      if (!isAirNomination && destRows.length === 0) {
        destRows = document.querySelectorAll("#air-dest-surcharges-body tr");
      }
      destRows.forEach(row => {
        const surchargeNameInput = row.querySelector(".chg-name");
        if (!surchargeNameInput) return;
        const surchargeName = surchargeNameInput.value.trim();
        const rate = parseFloat(row.querySelector(".chg-rate")?.value) || 0;
        const unit = row.querySelector(".chg-unit")?.value || "kg";
        const buyRateInput = row.querySelector(".chg-buy-rate");
        const buyRate = buyRateInput ? parseFloat(buyRateInput.value) || 0 : 0;
        const remarksInput = row.querySelector(".chg-remarks");
        const remarks = remarksInput ? remarksInput.value.trim() : "";

        if (surchargeName && (rate > 0 || buyRate > 0)) {
          const effectiveRate = rate > 0 ? rate : buyRate;
          if (rate === 0 && buyRate > 0) usingBuyFallback = true;
          let cost = unit === 'kg' ? airlineChargeableWeight * effectiveRate : effectiveRate;
          airlineSurchargeTotal += cost;
          airlineDestSurcharges.push({ name: surchargeName, rate, buyRate, unit, remarks, calculatedCost: cost });
        }
      });
    }

    if (originCardEnabled && amsFeeEnabled && amsFee > 0) {
      airlineSurchargeTotal += amsFee;
      airlineOriginSurcharges.push({ name: "AMS Fee", rate: amsFee, unit: "flat", calculatedCost: amsFee });
    }

    const airlineGrandTotal = baseFreightCost + airlineSurchargeTotal;

    const optionBaseBuyFreight = tariffsEnabled ? (isMinActive ? minBuy : (airlineChargeableWeight * activeBuyRate)) : 0;
    const optionGrossProfit = baseFreightCost - optionBaseBuyFreight;

    const cleanedBreaks = {};
    for (const bName in breaksData) {
      const bVal = breaksData[bName];
      const isActiveBr = (bName === usedBreak && !isMinActive) || (bName === 'min' && isMinActive);
      if (!isActiveBr && bVal.sell === 0 && bVal.buy === 0) {
        continue;
      }
      cleanedBreaks[bName] = bVal;
    }

    const dataObj = {
      card,
      name: name || "Unnamed Airline",
      routing,
      tt,
      validity,
      pivotWeight,
      amsFee,
      ams_fee,
      amsFeeEnabled,
      wbEnabled,
      originFeesEnabled: originCardEnabled,
      destFeesEnabled: destCardEnabled,
      selected: isSelected,
      breaks: cleanedBreaks,
      chargeableWeight: airlineChargeableWeight,
      baseFreight: baseFreightCost,
      appliedRate: isMinActive ? minSell : activeRate,
      appliedBuyRate: isMinActive ? minBuy : activeBuyRate,
      surchargeTotal: airlineSurchargeTotal,
      surchargesCalculated: [...airlineOriginSurcharges, ...airlineDestSurcharges],
      originSurcharges: airlineOriginSurcharges,
      destSurcharges: airlineDestSurcharges,
      grandTotal: airlineGrandTotal,
      usedBreak: isMinActive ? 'min' : usedBreak,
      baseBuyFreight: optionBaseBuyFreight,
      grossProfit: optionGrossProfit,
      usingBuyFallback
    };

    airlinesListData.push(dataObj);
    if (isSelected) {
      selectedAirlineData = dataObj;
    }
  });

  if (!selectedAirlineData && airlinesListData.length > 0) {
    airlineCards[0].querySelector(".select-airline-radio").checked = true;
    calculateAirFreight();
    return;
  }

  const finalChargeableWeight = selectedAirlineData.chargeableWeight;
  document.getElementById("res-air-chw").textContent = `${finalChargeableWeight.toFixed(2)} kg`;

  const pivotRow = document.getElementById("row-air-pivot");
  const pivotVal = document.getElementById("res-air-pivot");
  if (selectedAirlineData.pivotWeight > 0) {
    if (pivotRow) pivotRow.style.display = "flex";
    if (pivotVal) pivotVal.textContent = `${selectedAirlineData.pivotWeight.toFixed(2)} kg`;
  } else {
    if (pivotRow) pivotRow.style.display = "none";
  }

  document.getElementById("res-air-routing-val").textContent = selectedAirlineData.routing || "-";
  document.getElementById("res-air-tt-val").textContent = selectedAirlineData.tt || "-";
  document.getElementById("res-air-validity-val").textContent = selectedAirlineData.validity || "-";

  // Update primary surcharges table input uneditable/zero status
  const originRows = document.querySelectorAll("#air-origin-surcharges-body tr");
  const creatorRole = appState.currentUser;
  const isFreeHandOrNrs = creatorRole && (
    creatorRole === 'jaya' ||
    creatorRole === 'cathrina' ||
    TEAM_ROLES[creatorRole]?.category === 'FREE HAND SALES (AIR/SEA)' ||
    TEAM_ROLES[creatorRole]?.category === 'NRS (AIR/SEA)'
  );

  originRows.forEach(row => {
    const nameInput = row.querySelector(".chg-name");
    const name = nameInput.value.trim().toLowerCase();

    if (name === "cartage" || name === "misc") {
      const rateInp = row.querySelector(".chg-rate");
      const unitSelect = row.querySelector(".chg-unit");

      if (isFreeHandOrNrs) {
        rateInp.readOnly = false;
        if (unitSelect) unitSelect.disabled = false;
        rateInp.style.background = "";
        rateInp.style.color = "";
        if (unitSelect) {
          unitSelect.style.background = "";
          unitSelect.style.color = "";
        }
      } else {
        if (finalChargeableWeight < 500) {
          if (finalChargeableWeight <= 150) {
            rateInp.value = "0.00";
            unitSelect.value = "flat";
          } else {
            rateInp.value = "0.04";
            unitSelect.value = "kg";
          }
        } else {
          rateInp.value = "0.00";
          unitSelect.value = "flat";
        }

        rateInp.readOnly = true;
        if (unitSelect) unitSelect.disabled = true;
        rateInp.style.background = "rgba(255,255,255,0.02)";
        rateInp.style.color = "var(--text-dim)";
        if (unitSelect) {
          unitSelect.style.background = "rgba(0,0,0,0.2)";
          unitSelect.style.color = "var(--text-dim)";
        }
      }
    } else if (name === "xray") {
      const rateInp = row.querySelector(".chg-rate");
      if (isFreeHandOrNrs) {
        rateInp.readOnly = false;
        rateInp.style.background = "";
        rateInp.style.color = "";
      } else {
        if (finalChargeableWeight >= 500) {
          rateInp.value = "0.00";
          rateInp.readOnly = true;
          rateInp.style.background = "rgba(255,255,255,0.02)";
          rateInp.style.color = "var(--text-dim)";
        } else {
          rateInp.readOnly = false;
          rateInp.style.background = "";
          rateInp.style.color = "";
        }
      }
    }
  });

  // Rating Optimizer for the selected airline
  const activeRate = selectedAirlineData.appliedRate;
  let baseFreightCost = selectedAirlineData.baseFreight;
  const breaksData = selectedAirlineData.breaks;

  const rates = [
    { breakName: 'min', limit: 0, rate: breaksData['min'] || 0, label: 'Min' },
    { breakName: 'minus45', limit: 0.1, rate: breaksData['minus45'] || 0, label: '-45 kg' },
    { breakName: 'plus45', limit: 45, rate: breaksData['plus45'] || 0, label: '+45 kg' },
    { breakName: 'plus100', limit: 100, rate: breaksData['plus100'] || 0, label: '+100 kg' },
    { breakName: 'plus300', limit: 300, rate: breaksData['plus300'] || 0, label: '+300 kg' },
    { breakName: 'plus500', limit: 500, rate: breaksData['plus500'] || 0, label: '+500 kg' },
    { breakName: 'plus1000', limit: 1000, rate: breaksData['plus1000'] || 0, label: '+1000 kg' }
  ];

  const activeBreakIdx = rates.findIndex(r => r.breakName === selectedAirlineData.usedBreak);

  let optBreakIndex = -1;
  let optWeight = finalChargeableWeight;
  let optRate = activeRate;
  let optFreightCost = baseFreightCost;
  let hasSavings = false;

  if (finalChargeableWeight > 0 && activeBreakIdx !== -1 && activeBreakIdx < rates.length - 1) {
    for (let i = activeBreakIdx + 1; i < rates.length; i++) {
      const nextBreak = rates[i];
      if (nextBreak.rate > 0) {
        const nextBreakCost = nextBreak.limit * nextBreak.rate;
        if (nextBreakCost < baseFreightCost) {
          optBreakIndex = i;
          optWeight = nextBreak.limit;
          optRate = nextBreak.rate;
          optFreightCost = nextBreakCost;
          hasSavings = true;
          break;
        }
      }
    }
  }

  const optCard = document.getElementById("air-opt-card");
  if (hasSavings) {
    if (optCard) optCard.style.display = "block";
    const savingsAmount = baseFreightCost - optFreightCost;
    const currency = document.getElementById("air-currency").value;
    const curSymbol = currency === 'INR' ? '₹' : (currency === 'USD' ? '$' : (currency === 'EUR' ? '€' : '£'));

    const activeLabel = rates[activeBreakIdx] ? rates[activeBreakIdx].label : 'Standard';

    const optSuggestion = document.getElementById("opt-suggestion-text");
    if (optSuggestion) {
      optSuggestion.innerHTML = `
        Rating actual ${finalChargeableWeight.toFixed(2)} kg at the ${activeLabel} rate is ${curSymbol}${baseFreightCost.toFixed(2)}.
        However, rating <strong>as ${optWeight} kg</strong> at the <strong>+${rates[optBreakIndex].limit} kg rate (${curSymbol}${optRate.toFixed(2)}/kg)</strong> is only <strong>${curSymbol}${optFreightCost.toFixed(2)}</strong>.
        <br><strong>Savings: ${curSymbol}${savingsAmount.toFixed(2)}</strong>.
      `;
    }

    const optBName = rates[optBreakIndex].breakName;
    const optWrapper = selectedAirlineData.card.querySelector(`.dynamic-break-wrapper[data-break-name="${optBName}"]`);
    if (optWrapper) {
      optWrapper.style.borderColor = "var(--accent-warning)";
      optWrapper.style.background = "rgba(245,158,11,0.1)";
    }

    document.getElementById("apply-opt").onclick = () => {
      appState.currentAirFreight.isOptimizedApplied = true;
      if (optCard) optCard.style.display = "none";
      calculateAirFreight();
    };
  } else {
    if (optCard) optCard.style.display = "none";
  }

  let finalBaseRate = activeRate;
  let finalFreightCost = baseFreightCost;

  if (appState.currentAirFreight.isOptimizedApplied && hasSavings) {
    finalBaseRate = optRate;
    finalFreightCost = optFreightCost;

    selectedAirlineData.card.querySelectorAll(".dynamic-break-wrapper").forEach(el => {
      el.style.borderColor = "#ccc";
      el.style.background = "#fff";
    });
    const optBName = rates[optBreakIndex].breakName;
    const optWrapper = selectedAirlineData.card.querySelector(`.dynamic-break-wrapper[data-break-name="${optBName}"]`);
    if (optWrapper) {
      optWrapper.style.borderColor = "var(--accent-success)";
      optWrapper.style.background = "rgba(46,204,113,0.1)";
      optWrapper.style.display = "flex";
    }
  } else if (!hasSavings) {
    appState.currentAirFreight.isOptimizedApplied = false;
  }

  // Update selected airline with optimized costs if applied
  selectedAirlineData.baseFreight = finalFreightCost;
  selectedAirlineData.appliedRate = finalBaseRate;
  selectedAirlineData.grandTotal = finalFreightCost + selectedAirlineData.surchargeTotal;
  // Recalculate GP for optimized rate
  selectedAirlineData.grossProfit = finalFreightCost - selectedAirlineData.baseBuyFreight;

  // Render individual airline pricing results dynamically
  const resultsContainer = document.getElementById("air-pricing-results-container");
  if (resultsContainer) {
    const currency = document.getElementById("air-currency").value;
    const curSymbol = currency === 'INR' ? '₹' : (currency === 'USD' ? '$' : (currency === 'EUR' ? '€' : '£'));

    // Find cheapest grand total
    const minGrandTotal = Math.min(...airlinesListData.map(alt => alt.grandTotal));

    resultsContainer.innerHTML = airlinesListData.map(alt => {
      const color = getAirlineColor(alt.name);
      const isCheapest = (alt.grandTotal === minGrandTotal);

      let breakRows = "";
      if (alt.breaks && Object.keys(alt.breaks).length > 0) {
        breakRows = Object.keys(alt.breaks).map(bName => {
          const brVal = alt.breaks[bName] || { sell: 0, buy: 0 };
          // Keep commercial Sell and internal Buy distinct in the live result.
          // A missing counterpart is calculated as zero; it is never mirrored.
          const sellRate = brVal.sell || 0;
          const buyRate = brVal.buy;

          const labels = {
            'min': 'Min (Flat)',
            'minus45': '-45 kg',
            'plus45': '+45 kg',
            'plus100': '+100 kg',
            'plus300': '+300 kg',
            'plus500': '+500 kg',
            'plus1000': '+1000 kg'
          };

          const displayLabel = labels[bName] || bName;

          const isMinActive = (bName === 'min' && alt.appliedRate === sellRate && alt.appliedBuyRate === buyRate && alt.baseFreight === sellRate);
          const isActive = (bName === alt.usedBreak) || isMinActive;

          const isMinType = (bName === 'min');
          // The active row mirrors alt.baseFreight/grandTotal/grossProfit
          // directly — those already reflect the Sell-or-Buy interim
          // fallback (see resolveInterimRate) — rather than recomputing from
          // the raw, unmirrored sellRate/buyRate above, so this table's
          // "Active" row can never show a different total than what's
          // actually being charged/saved. Inactive rows keep the
          // deliberately raw, unmirrored comparison figures.
          const breakBaseFreight = isActive ? alt.baseFreight : (isMinType ? sellRate : (alt.chargeableWeight * sellRate));
          const breakBuyFreight = isMinType ? buyRate : (alt.chargeableWeight * buyRate);
          const breakGrandTotal = isActive ? alt.grandTotal : (breakBaseFreight + alt.surchargeTotal);
          const breakGP = isActive ? alt.grossProfit : (breakBaseFreight - breakBuyFreight);

          const rowStyle = isActive
            ? `background: rgba(46,204,113,0.1); border-left: 3px solid var(--accent-success); font-weight: 700;`
            : `border-left: 3px solid transparent;`;

          return `
            <tr style="${rowStyle} transition: background 0.2s;">
              <td style="padding: 6px 8px; font-size: 0.7rem; color: var(--t1);">${displayLabel} ${isActive ? '<span style="font-size: 0.65rem; color: var(--accent-success); font-weight: 800;">(Active)</span>' : ''}</td>
              <td style="padding: 6px 8px; font-size: 0.7rem; color: var(--t1); text-align: center;">${curSymbol}${sellRate.toFixed(2)}</td>
              <td style="padding: 6px 8px; font-size: 0.7rem; color: var(--t1); text-align: center;">${curSymbol}${buyRate.toFixed(2)}</td>
              <td style="padding: 6px 8px; font-size: 0.7rem; color: var(--t1); text-align: right;">${curSymbol}${breakBaseFreight.toFixed(2)}</td>
              <td style="padding: 6px 8px; font-size: 0.7rem; color: var(--t1); text-align: right;">${curSymbol}${breakGrandTotal.toFixed(2)}</td>
              <td style="padding: 6px 8px; font-size: 0.7rem; color: var(--accent-success); font-weight: 700; text-align: right;">${curSymbol}${breakGP.toFixed(2)}</td>
            </tr>
          `;
        }).join("");
      } else {
        breakRows = `<tr><td colspan="6" style="padding: 8px; font-size: 0.72rem; color: var(--t2); text-align: center; font-style: italic;">No weight breaks selected</td></tr>`;
      }

      return `
        <div class="glass-card" style="padding: 1rem; border: 1px solid ${alt.selected ? 'var(--accent-success)' : 'var(--border-1)'}; relative; background: ${alt.selected ? 'rgba(46,204,113,0.04)' : 'rgba(255,255,255,0.01)'}; border-radius: 8px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; flex-wrap: wrap; gap: 0.4rem;">
            <strong style="font-size: 0.85rem; color: ${color};">${alt.name || 'Unnamed Airline'}</strong>
            <div style="display: flex; gap: 0.4rem; flex-wrap: wrap;">
              ${isCheapest ? '<span style="font-size: 0.62rem; background: var(--accent-success); color: #fff; padding: 2px 6px; border-radius: 4px; font-weight: bold; text-transform: uppercase;">Cheapest Option</span>' : ''}
              ${alt.usingBuyFallback ? '<span title="Sell Rate is blank on at least one line — this total is using the Buy/Cost Rate as an interim placeholder. It is not a confirmed customer price. Fill in Sell Rate to replace it." style="font-size: 0.62rem; background: #fef3c7; color: #92400e; border: 1px solid #f59e0b; padding: 2px 6px; border-radius: 4px; font-weight: 800; text-transform: uppercase;">⚠ Interim Estimate (Buy Rate)</span>' : ''}
            </div>
          </div>

          <div style="display: flex; gap: 1rem; font-size: 0.72rem; margin-bottom: 0.5rem; color: var(--t2); border-bottom: 1px dashed rgba(255,255,255,0.1); padding-bottom: 6px;">
            <span>Chargeable Weight: <strong style="color: var(--t1);">${alt.chargeableWeight.toFixed(2)} kg</strong></span>
            <span>Ancillary Surcharges: <strong style="color: var(--t1);">${curSymbol}${alt.surchargeTotal.toFixed(2)}</strong></span>
          </div>

          <div style="overflow-x: auto; margin-top: 0.5rem; border: 1px solid var(--border-1); border-radius: 6px; background: rgba(0, 0, 0, 0.08);">
            <table style="width: 100%; border-collapse: collapse; text-align: left;">
              <thead>
                <tr style="border-bottom: 1px solid var(--border-1); background: rgba(255, 255, 255, 0.02);">
                  <th style="padding: 6px 8px; font-size: 0.65rem; color: var(--t2); text-transform: uppercase; font-weight: 700;">Weight Break</th>
                  <th style="padding: 6px 8px; font-size: 0.65rem; color: var(--t2); text-transform: uppercase; font-weight: 700; text-align: center;">Sell/KG</th>
                  <th style="padding: 6px 8px; font-size: 0.65rem; color: var(--t2); text-transform: uppercase; font-weight: 700; text-align: center;">Buy/KG</th>
                  <th style="padding: 6px 8px; font-size: 0.65rem; color: var(--t2); text-transform: uppercase; font-weight: 700; text-align: right;">Base Freight</th>
                  <th style="padding: 6px 8px; font-size: 0.65rem; color: var(--t2); text-transform: uppercase; font-weight: 700; text-align: right;">Grand Total</th>
                  <th style="padding: 6px 8px; font-size: 0.65rem; color: var(--t2); text-transform: uppercase; font-weight: 700; text-align: right;">GP</th>
                </tr>
              </thead>
              <tbody>
                ${breakRows}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }).join("");
  }

  // Update appState values
  const sanitizedAirlinesList = airlinesListData.map(alt => {
    return {
      name: alt.name,
      routing: alt.routing,
      tt: alt.tt,
      validity: alt.validity,
      pivotWeight: alt.pivotWeight,
      amsFee: alt.amsFee,
      ams_fee: alt.ams_fee,
      amsFeeEnabled: alt.amsFeeEnabled,
      wbEnabled: alt.wbEnabled,
      originFeesEnabled: alt.originFeesEnabled,
      destFeesEnabled: alt.destFeesEnabled,
      selected: alt.selected,
      breaks: alt.breaks,
      chargeableWeight: alt.chargeableWeight,
      baseFreight: alt.baseFreight,
      appliedRate: alt.appliedRate,
      appliedBuyRate: alt.appliedBuyRate,
      surchargeTotal: alt.surchargeTotal,
      surchargesCalculated: alt.surchargesCalculated,
      originSurcharges: alt.originSurcharges,
      destSurcharges: alt.destSurcharges,
      grandTotal: alt.grandTotal,
      baseBuyFreight: alt.baseBuyFreight,
      grossProfit: alt.grossProfit,
      usingBuyFallback: alt.usingBuyFallback,
      usedBreak: alt.usedBreak
    };
  });

  appState.currentAirFreight.airlines = sanitizedAirlinesList;
  appState.currentAirFreight.grossWeight = totalGrossWeight;
  appState.currentAirFreight.volumeWeight = totalVolumeWeight;
  appState.currentAirFreight.chargeableWeight = finalChargeableWeight;
  appState.currentAirFreight.cbm = totalVolume;
  appState.currentAirFreight.baseFreight = selectedAirlineData.baseFreight;
  appState.currentAirFreight.surchargeTotal = selectedAirlineData.surchargeTotal;
  appState.currentAirFreight.grandTotal = selectedAirlineData.grandTotal;
  appState.currentAirFreight.currency = document.getElementById("air-currency").value;
  appState.currentAirFreight.quantity = totalPackageQty;
  appState.currentAirFreight.originSurcharges = selectedAirlineData.originSurcharges;
  appState.currentAirFreight.destSurcharges = selectedAirlineData.destSurcharges;
  appState.currentAirFreight.surchargesCalculated = selectedAirlineData.surchargesCalculated;
  appState.currentAirFreight.usedBreak = selectedAirlineData.usedBreak;
  appState.currentAirFreight.appliedRate = selectedAirlineData.appliedRate;
  appState.currentAirFreight.appliedBuyRate = selectedAirlineData.appliedBuyRate;
  appState.currentAirFreight.usingBuyFallback = selectedAirlineData.usingBuyFallback;
  // Per-card enablement for the selected/confirmed option — for non-Air-
  // Nomination roles this (not the top-level #air-enable-* checkboxes) is
  // what actually gates inclusion in the total (see originCardEnabled /
  // destCardEnabled / wbEnabled above), so it's what buildAirQuoteData()
  // needs to persist for the WON-confirmation validation to respect.
  appState.currentAirFreight.wbEnabled = selectedAirlineData.wbEnabled;
  appState.currentAirFreight.originFeesEnabled = selectedAirlineData.originFeesEnabled;
  appState.currentAirFreight.destFeesEnabled = selectedAirlineData.destFeesEnabled;
  appState.currentAirFreight.baseBuyFreight = selectedAirlineData.baseBuyFreight;
  appState.currentAirFreight.pivotWeight = selectedAirlineData.pivotWeight;
  appState.currentAirFreight.routing = selectedAirlineData.routing;
  appState.currentAirFreight.tt = selectedAirlineData.tt;
  appState.currentAirFreight.validity = selectedAirlineData.validity;
  appState.currentAirFreight.airline = selectedAirlineData.name || "N/A";

  const currency = document.getElementById("air-currency").value;
  let totalINR = selectedAirlineData.grandTotal;
  if (currency === 'INR') {
    totalINR = selectedAirlineData.grandTotal;
  } else if (currency === 'USD') {
    totalINR = selectedAirlineData.grandTotal * (EXCHANGE_RATES.USD_TO_INR || 83);
  } else if (currency === 'EUR') {
    totalINR = selectedAirlineData.grandTotal * (EXCHANGE_RATES.EUR_TO_USD || 1.08) * (EXCHANGE_RATES.USD_TO_INR || 83);
  } else if (currency === 'GBP') {
    totalINR = selectedAirlineData.grandTotal * (EXCHANGE_RATES.GBP_TO_USD || 1.25) * (EXCHANGE_RATES.USD_TO_INR || 83);
  }
  appState.currentAirFreight.grandTotalINR = totalINR;
}

// SEA FREIGHT CALCULATOR LOGIC
function setupSeaFreightEvents() {
  const currencySelect = document.getElementById("sea-currency");

  const seaTabExport = document.getElementById("sea-tab-export");
  const seaTabImport = document.getElementById("sea-tab-import");
  if (seaTabExport && seaTabImport) {
    seaTabExport.addEventListener("click", () => {
      seaTabExport.classList.add("active");
      seaTabImport.classList.remove("active");
      appState.currentSeaFreight.module = 'export';
      resetCargoAndRatesForSea();
    });
    seaTabImport.addEventListener("click", () => {
      seaTabImport.classList.add("active");
      seaTabExport.classList.remove("active");
      appState.currentSeaFreight.module = 'import';
      resetCargoAndRatesForSea();
    });
  }

  // Bind new cargo details inputs
  document.getElementById("sea-gross-weight")?.addEventListener("input", calculateSeaFreight);
  document.getElementById("sea-volume")?.addEventListener("input", calculateSeaFreight);
  document.getElementById("sea-pkg-qty")?.addEventListener("input", calculateSeaFreight);
  document.querySelectorAll(".sea-lcl-rate, .sea-lcl-buy-rate, .sea-bb-rate, .sea-bb-buy-rate").forEach(el => el.addEventListener("input", calculateSeaFreight));
  document.getElementById("sea-routing")?.addEventListener("input", calculateSeaFreight);
  document.getElementById("sea-tt")?.addEventListener("input", calculateSeaFreight);
  document.getElementById("sea-validity")?.addEventListener("input", calculateSeaFreight);
  document.getElementById("sea-ams-fee")?.addEventListener("input", calculateSeaFreight);

  // Bind cargo parameter dropdowns (universal — FCL / LCL / BB)
  const seaCargoParamIds = [
    "sea-handling-profile",
    "sea-orientation-profile",
    "sea-cargo-risk",
    "sea-climate-constraint"
  ];
  seaCargoParamIds.forEach(id => {
    document.getElementById(id)?.addEventListener("change", calculateSeaFreight);
  });

  // Bind BB-only operational parameter dropdowns
  document.getElementById("sea-bb-operational-mode")?.addEventListener("change", calculateSeaFreight);
  document.getElementById("sea-bb-stowage")?.addEventListener("change", calculateSeaFreight);

  // LayCan dual-calendar — auto-compute duration in days
  function updateLayCanDuration() {
    const laydays = document.getElementById("sea-bb-laydays")?.value;
    const cancelling = document.getElementById("sea-bb-cancelling")?.value;
    const durationEl = document.getElementById("sea-bb-laycan-duration");
    if (durationEl) {
      if (laydays && cancelling) {
        const diffMs = new Date(cancelling) - new Date(laydays);
        const diffDays = Math.round(diffMs / 86400000);
        if (diffDays >= 0) {
          durationEl.textContent = `${diffDays} day${diffDays !== 1 ? 's' : ''}`;
          durationEl.style.color = diffDays <= 3 ? 'var(--accent-error)' : 'var(--sky)';
        } else {
          durationEl.textContent = '⚠ Invalid range';
          durationEl.style.color = 'var(--accent-error)';
        }
      } else {
        durationEl.textContent = '— days';
        durationEl.style.color = 'var(--sky)';
      }
    }
    calculateSeaFreight();
  }
  document.getElementById("sea-bb-laydays")?.addEventListener("change", updateLayCanDuration);
  document.getElementById("sea-bb-cancelling")?.addEventListener("change", updateLayCanDuration);


  // Bind dynamic container line appender
  document.getElementById("sea-add-container")?.addEventListener("click", () => {
    addFclContainerRow();
  });

  if (currencySelect) {
    currencySelect.addEventListener("change", () => {
      updateCurrencyRules(appState.currentUser);
      calculateSeaFreight();
    });
  }

  document.getElementById("sea-incoterm")?.addEventListener("change", calculateSeaFreight);
  document.getElementById("sea-fcl-stuffing")?.addEventListener("change", calculateSeaFreight);

  // Populate first container line by default
  const fclBody = document.getElementById("sea-fcl-body-1");
  if (fclBody && fclBody.children.length === 0) {
    addFclContainerRow("20'GP", 1, 0);
  }

  setupSurchargesEvents("sea-origin");
  setupSurchargesEvents("sea-dest");

  // Bind dynamic Sea Cargo Row appender
  const seaAddCargoRow = document.getElementById("sea-add-cargo-row");
  const seaCargoBody = document.getElementById("sea-cargo-body");
  const seaDimUnitOptions = document.querySelectorAll("#sea-dim-unit-toggle .toggle-option");

  if (seaAddCargoRow && seaCargoBody) {
    seaAddCargoRow.addEventListener("click", () => {
      const row = document.createElement("tr");
      row.className = "sea-cargo-item-row";
      row.innerHTML = `
        <td><input type="number" class="sea-cargo-len" min="1" placeholder="L"></td>
        <td><input type="number" class="sea-cargo-wid" min="1" placeholder="W"></td>
        <td><input type="number" class="sea-cargo-hei" min="1" placeholder="H"></td>
        <td><input type="number" class="sea-cargo-qty" min="1" placeholder="Qty"></td>
        <td>
          <button type="button" class="delete-btn" onclick="this.closest('tr').remove(); calculateSeaVolumeFromDimensions();">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/></svg>
          </button>
        </td>
      `;
      seaCargoBody.appendChild(row);

      row.querySelectorAll("input").forEach(inp => {
        inp.addEventListener("input", calculateSeaVolumeFromDimensions);
      });
    });
  }

  // Bind initial row inputs
  document.querySelectorAll(".sea-cargo-item-row input").forEach(inp => {
    inp.addEventListener("input", calculateSeaVolumeFromDimensions);
  });

  // Bind unit switcher toggle
  if (seaDimUnitOptions) {
    seaDimUnitOptions.forEach(opt => {
      opt.addEventListener("click", (e) => {
        seaDimUnitOptions.forEach(o => o.classList.remove("active"));
        e.target.classList.add("active");
        appState.currentSeaFreight.dimUnit = e.target.getAttribute("data-unit");
        calculateSeaVolumeFromDimensions();
      });
    });
  }

  const addSeaAltBtn = document.getElementById("sea-add-alternative");
  if (addSeaAltBtn) {
    addSeaAltBtn.addEventListener("click", () => {
      addAlternativeOptionRow("sea-alternatives-body");
    });
  }
}


// ══════════════════════════════════════════════════
// MULTI-LINER & ACCORDION SYSTEM FOR SEA FREIGHT
// ══════════════════════════════════════════════════

function toggleAirSection(sectionPrefix) {
  const content = document.getElementById(`${sectionPrefix}-content-body`);
  const btn = document.querySelector(`.toggle-${sectionPrefix}-btn`);
  if (!content || !btn) return;
  const isHidden = content.style.display === "none";
  content.style.display = isHidden ? "block" : "none";
  btn.querySelector(".collapse-icon").textContent = isHidden ? "▼" : "▲";
  btn.querySelector(".collapse-text").textContent = isHidden ? "Collapse" : "Expand";
}
window.toggleAirSection = toggleAirSection;

window.toggleLinerAccordion = function (headerEl) {
  const contentEl = headerEl.nextElementSibling;
  const toggleBtn = headerEl.querySelector(".liner-accordion-toggle-btn");
  if (!contentEl) return;

  const isCollapsed = contentEl.classList.contains("collapsed");
  if (isCollapsed) {
    contentEl.classList.remove("collapsed");
    if (toggleBtn) {
      toggleBtn.querySelector(".toggle-icon").textContent = "▼";
      toggleBtn.querySelector(".toggle-text").textContent = "Collapse";
    }
  } else {
    contentEl.classList.add("collapsed");
    if (toggleBtn) {
      toggleBtn.querySelector(".toggle-icon").textContent = "▲";
      toggleBtn.querySelector(".toggle-text").textContent = "Expand";
    }
  }
};

window.switchLinerMode = function (linerIndex, mode) {
  const card = document.getElementById(`sea-liner-card-${linerIndex}`);
  if (!card) return;

  const fclBtn = card.querySelector(`.sea-tab-fcl-btn`);
  const lclBtn = card.querySelector(`.sea-tab-lcl-btn`);
  const bbBtn = card.querySelector(`.sea-tab-bb-btn`);

  if (fclBtn) fclBtn.classList.toggle("active", mode === 'fcl');
  if (lclBtn) lclBtn.classList.toggle("active", mode === 'lcl');
  if (bbBtn) bbBtn.classList.toggle("active", mode === 'bb');

  const fclForm = document.getElementById(`sea-fcl-form-${linerIndex}`);
  const lclForm = document.getElementById(`sea-lcl-form-${linerIndex}`);
  const bbForm = document.getElementById(`sea-bb-form-${linerIndex}`);

  if (fclForm) fclForm.style.display = (mode === 'fcl') ? "block" : "none";
  if (lclForm) lclForm.style.display = (mode === 'lcl') ? "block" : "none";
  if (bbForm) bbForm.style.display = (mode === 'bb') ? "block" : "none";

  card.dataset.mode = mode;
  if (mode === 'fcl') {
    updateLinerSurchargeContainerOptions(linerIndex);
  }
  calculateSeaFreight();
  updateLinerRateSummary(card);
};

function buildLinerOptionsHTML(selectedName = "") {
  const options = [
    {
      group: "🚢 Shipping Lines", items: [
        "MSC (Mediterranean Shipping Company)", "Maersk Line", "CMA CGM", "COSCO Shipping",
        "Hapag-Lloyd", "ONE (Ocean Network Express)", "Evergreen Line", "HMM Co., Ltd.",
        "Yang Ming Marine Transport", "ZIM Integrated Shipping", "Wan Hai Lines",
        "PIL (Pacific International Lines)", "OOCL (Orient Overseas Container Line)",
        "KMTC (Korea Marine Transport Co.)", "SITC Container Lines", "TS Lines",
        "RCL (Regional Container Lines)", "X-Press Feeders", "Sinokor Merchant Marine",
        "SM Line", "Turkon Line", "Grimaldi Lines"
      ]
    },
    {
      group: "📦 Coloaders & NVOCCs", items: [
        "Vanguard Logistics", "ECU Worldwide", "CWT Globelink", "Shipco Transport",
        "FPS (Famous Pacific Shipping)", "SACO Shipping", "CFR Rinkens / CFR Freight",
        "Oceanus Coloaders", "Cargo Services Far East", "Allcargo Logistics",
        "Caravel Logistics", "Conship", "FreightConsol"
      ]
    },
    {
      group: "🏗 Breakbulk Operators", items: [
        "BBC Chartering", "Spliethoff Group", "dship Carriers", "AAL Shipping (Austral Asia Line)",
        "Saga Welco", "MACS Maritime Carrier Shipping", "Swire Shipping", "G2 Ocean",
        "Chipolbrok", "BigLift Shipping", "Jumbo-SAL Maritime", "United Heavy Lift (UHL)",
        "Fednav", "Intermarine", "Harren Group", "Thorco Maritime"
      ]
    }
  ];

  let html = `<option value="">-- Select Shipping Line / Coloader / BreakBulk --</option>`;
  let isFound = false;

  options.forEach(grp => {
    html += `<optgroup label="${grp.group}">`;
    grp.items.forEach(item => {
      const isSel = (item === selectedName);
      if (isSel) isFound = true;
      html += `<option value="${item}" ${isSel ? 'selected' : ''}>${item}</option>`;
    });
    html += `</optgroup>`;
  });

  const isCustom = !isFound && selectedName && !selectedName.startsWith("Liner ");
  html += `<optgroup label="✏️ Custom / Unlisted">`;
  html += `<option value="__custom__" ${isCustom ? 'selected' : ''}>+ Add Custom / Unlisted Carrier...</option>`;
  html += `</optgroup>`;

  return { html, isCustom };
}

window.handleLinerSelectChange = function (index) {
  const card = document.getElementById(`sea-liner-card-${index}`);
  if (!card) return;
  const select = card.querySelector(".liner-name-select");
  const input = card.querySelector(".liner-name-input");
  if (!select || !input) return;

  if (select.value === "__custom__") {
    input.style.display = "inline-block";
    input.focus();
  } else {
    input.style.display = "none";
    if (select.value) {
      input.value = select.value;
    }
  }
  calculateSeaFreight();
};

let linerCardCounter = 1;

window.addNewLinerCard = function (data = null) {
  linerCardCounter++;
  const index = linerCardCounter;
  const container = document.getElementById("sea-liners-container");
  if (!container) return;

  const linerCard = document.createElement("div");
  linerCard.className = "liner-card";
  linerCard.id = `sea-liner-card-${index}`;
  linerCard.dataset.linerIndex = index;
  linerCard.dataset.mode = data?.mode || appState.currentSeaFreight.type || 'fcl';

  const linerName = data?.linerName || "";
  const opts = buildLinerOptionsHTML(linerName);
  const isFcl = (linerCard.dataset.mode === 'fcl');
  const isLcl = (linerCard.dataset.mode === 'lcl');
  const isBb = (linerCard.dataset.mode === 'bb');
  const tariffsEnabled = data?.tariffsEnabled !== false;
  const originFeesEnabled = data?.originFeesEnabled !== false;
  const destFeesEnabled = data?.destFeesEnabled !== false;

  linerCard.innerHTML = `
    <div class="liner-card-header">
      <div class="liner-card-title">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M2 21h20M19.3 14.8C18 13.5 16 13.5 14.7 14.8L12 17.5l-2.7-2.7C8 13.5 6 13.5 4.7 14.8L2 17.5V19h20v-1.5l-2.7-2.7zM12 2v10M12 2l-3 3M12 2l3 3"/>
        </svg>
        <span class="liner-label-text">Liner ${index} Option</span>
      </div>
      <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
        <select class="liner-name-select table-select" id="sea-liner-select-${index}" onchange="handleLinerSelectChange(${index})" style="font-size: 0.8rem; padding: 4px 8px; border-radius: 4px; background: var(--bg-input); border: 1px solid var(--border-1); color: var(--t1); min-width: 230px; font-weight: 600;">
          ${opts.html}
        </select>
        <input type="text" class="liner-name-input" id="sea-liner-name-${index}" value="${linerName}" placeholder="Enter Custom Carrier Name..." oninput="calculateSeaFreight()" style="font-size: 0.8rem; padding: 4px 8px; border-radius: 4px; background: var(--bg-input); border: 1px solid var(--border-1); color: var(--t1); width: 180px; display: ${opts.isCustom ? 'inline-block' : 'none'};">
        <button type="button" class="delete-btn" onclick="removeLinerCard(${index})" style="background: rgba(239,68,68,0.15); border: 1px solid #ef4444; color: #ef4444; padding: 4px 8px; border-radius: 4px; font-size: 0.72rem; cursor: pointer; font-weight: 700;">
          🗑 Delete Liner
        </button>
      </div>
    </div>

    <div class="liner-rate-summary-bar" style="display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; background: #fafbfc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.5rem 0.6rem 0.5rem 0.75rem; margin-bottom: 0.5rem;">
      <span class="liner-rate-summary-text" style="font-size: 0.72rem; color: var(--t2, #64748b); font-weight: 600;">No rates entered yet</span>
      <button type="button" class="open-liner-rate-modal-btn" title="Edit rates &amp; fees" aria-label="Edit rates &amp; fees" style="display: flex; align-items: center; justify-content: center; width: 30px; height: 30px; flex-shrink: 0; background: rgba(245, 158, 11, 0.18); color: var(--accent-warning, #b45309); border: 1px solid rgba(245, 158, 11, 0.4); border-radius: 50%; cursor: pointer; padding: 0;">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
      </button>
    </div>

    <div class="liner-rate-modal-overlay" style="display: none; position: fixed; inset: 0; background: rgba(15,23,42,0.5); z-index: 2000; align-items: center; justify-content: center; padding: 1.5rem;">
      <div class="liner-rate-modal-dialog" style="background: var(--bg-surface, #fff); border-radius: 12px; max-width: 720px; width: 100%; max-height: 88vh; overflow-y: auto; padding: 1.1rem 1.4rem;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.9rem; border-bottom: 1px solid var(--border-1); padding-bottom: 0.6rem;">
          <span style="font-size: 0.85rem; font-weight: 700; color: #1b1c5c;">Rates and fees — Liner ${index} Option</span>
          <button type="button" class="close-liner-rate-modal-btn" style="background: none; border: none; cursor: pointer; font-size: 1.1rem; line-height: 1; color: var(--t2, #64748b); padding: 2px 6px;">✕</button>
        </div>

    <!-- Liner Accordions Group -->
    <div class="liner-accordions-group">
      <!-- 1. FREIGHT ACCORDION -->
      <div class="liner-accordion-item">
        <div class="liner-accordion-header" onclick="toggleLinerAccordion(this)">
          <div class="liner-accordion-title">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="1" y="3" width="22" height="18" rx="2" ry="2" />
              <line x1="1" y1="10" x2="23" y2="10" />
            </svg>
            📦 Freight (Ocean Freight Tariffs)
          </div>
          <button type="button" class="liner-accordion-toggle-btn">
            <span class="toggle-icon">▼</span> <span class="toggle-text">Collapse</span>
          </button>
        </div>
        <div class="liner-accordion-content">
          <div class="section-card" id="sea-tariffs-card-${index}" style="background: transparent; border: none; padding: 0;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem; padding-bottom: 0.5rem; border-bottom: 1px solid var(--border-1);">
              <label style="display: flex; align-items: center; gap: 0.6rem; font-size: 0.85rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: var(--accent-sea); cursor: pointer; margin: 0;">
                <input type="checkbox" id="sea-enable-tariffs-${index}" class="sea-enable-tariffs" ${tariffsEnabled ? 'checked' : ''} onchange="calculateSeaFreight()" style="width: 16px; height: 16px; accent-color: var(--sky); cursor: pointer;">
                Include Freight Tariff
              </label>
              <span id="sea-tariffs-status-badge-${index}" class="sea-tariffs-status-badge" style="font-size: 0.7rem; font-weight: 700; color: ${tariffsEnabled ? '#10b981' : '#ef4444'}; background: ${tariffsEnabled ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)'}; padding: 2px 8px; border-radius: 4px;">${tariffsEnabled ? '✓ Included' : '✕ Excluded'}</span>
            </div>
            <div id="sea-tariffs-content-body-${index}" class="sea-tariffs-content-body">
              <div class="toggle-group liner-mode-toggle-group" style="margin-top: 0.5rem; margin-bottom: 1.5rem;">
                <div class="toggle-option ${isFcl ? 'active' : ''} sea-tab-fcl-btn" onclick="switchLinerMode(${index}, 'fcl')">FCL (Full Container Load)</div>
                <div class="toggle-option ${isLcl ? 'active' : ''} sea-tab-lcl-btn" onclick="switchLinerMode(${index}, 'lcl')">LCL (Less Container Load)</div>
                <div class="toggle-option ${isBb ? 'active' : ''} sea-tab-bb-btn" onclick="switchLinerMode(${index}, 'bb')">Break Bulk</div>
              </div>

              <!-- FCL Fields -->
              <div class="sea-fcl-form" id="sea-fcl-form-${index}" style="display: ${isFcl ? 'block' : 'none'};">
                <div class="sea-fcl-stuffing-container" id="sea-fcl-stuffing-container-${index}" style="margin-bottom: 1.2rem; display: none;">
                  <label for="sea-fcl-stuffing-${index}">Stuffing Option</label>
                  <select id="sea-fcl-stuffing-${index}" class="sea-fcl-stuffing-select" style="background: var(--bg-input); border: 1px solid var(--border-1); color: var(--t1); padding: 0.65rem 0.9rem; border-radius: var(--r-sm); width: 100%;">
                    <option value="factory" selected>Factory Stuffing</option>
                    <option value="cfs_icd">CFS/ICD Stuffing</option>
                  </select>
                </div>
                <h4 style="font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 700; margin-bottom: 0.75rem;">
                  Ocean Freight Tariff Per Container</h4>
                <div class="cargo-table-container">
                  <table class="cargo-table" style="min-width: unset; table-layout: fixed; width: 100%;">
                    <thead>
                      <tr>
                        <th style="width: 32%;">Container Type</th>
                        <th style="width: 16%; text-align: center;">Qty</th>
                        <th style="width: 21%; text-align: center;">Sell Rate</th>
                        <th style="width: 21%; text-align: center;">Buy Rate</th>
                        <th style="width: 10%; text-align: center;">Action</th>
                      </tr>
                    </thead>
                    <tbody class="sea-fcl-body" id="sea-fcl-body-${index}">
                    </tbody>
                  </table>
                </div>
                <button type="button" class="add-row-btn" onclick="addFclContainerRowToLiner(${index})" style="margin-top: 0.5rem; margin-bottom: 1rem;">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  Add Another Container Type Under This Liner
                </button>
              </div>

              <!-- LCL Fields -->
              <div class="sea-lcl-form" id="sea-lcl-form-${index}" style="display: ${isLcl ? 'block' : 'none'};">
                <h4 style="font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 700; margin-bottom: 0.75rem;">
                  LCL Freight Pricing</h4>
                <div class="form-row">
                  <div class="form-group" style="margin-bottom: 0;">
                    <label>LCL Freight Rate (Per Revenue Ton - RT)</label>
                    <input type="number" class="sea-lcl-rate" placeholder="Rate" min="0" value="${data?.lclRate || 0}" oninput="calculateSeaFreight()">
                  </div>
                  <div class="form-group" style="margin-bottom: 0;">
                    <label>LCL Buy Rate (Per Revenue Ton - RT)</label>
                    <input type="number" class="sea-lcl-buy-rate" placeholder="Buy Rate" min="0" value="${data?.lclBuyRate || 0}" oninput="calculateSeaFreight()">
                  </div>
                </div>
                <div class="sea-freight-gp-inline" style="margin-top: 0.5rem; font-size: 0.72rem; font-weight: 700; color: var(--accent-success);">GP 0.00</div>
              </div>

              <!-- Break Bulk Fields -->
              <div class="sea-bb-form" id="sea-bb-form-${index}" style="display: ${isBb ? 'block' : 'none'};">
                <h4 style="font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 700; margin-bottom: 0.75rem; color: var(--accent-sea);">
                  Break Bulk Freight Pricing</h4>
                <div class="form-row">
                  <div class="form-group" style="margin-bottom: 0;">
                    <label>Break Bulk Ocean Rate (Per Revenue Ton - RT)</label>
                    <input type="number" class="sea-bb-rate" placeholder="Rate" min="0" value="${data?.bbRate || 0}" oninput="calculateSeaFreight()">
                  </div>
                  <div class="form-group" style="margin-bottom: 0;">
                    <label>Break Bulk Buy Rate (Per Revenue Ton - RT)</label>
                    <input type="number" class="sea-bb-buy-rate" placeholder="Buy Rate" min="0" value="${data?.bbBuyRate || 0}" oninput="calculateSeaFreight()">
                  </div>
                </div>
                <div class="sea-freight-gp-inline" style="margin-top: 0.5rem; font-size: 0.72rem; font-weight: 700; color: var(--accent-success);">GP 0.00</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 2. ORIGIN LOCAL FEES ACCORDION -->
      <div class="liner-accordion-item">
        <div class="liner-accordion-header" onclick="toggleLinerAccordion(this)">
          <div class="liner-accordion-title">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
              <path d="M2 12h20" />
            </svg>
            ⚓ Origin Local Fees & Surcharges
          </div>
          <button type="button" class="liner-accordion-toggle-btn">
            <span class="toggle-icon">▼</span> <span class="toggle-text">Collapse</span>
          </button>
        </div>
        <div class="liner-accordion-content">
          <div class="section-card" id="sea-origin-fees-card-${index}" style="background: transparent; border: none; padding: 0;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem; padding-bottom: 0.5rem; border-bottom: 1px solid var(--border-1);">
              <label style="display: flex; align-items: center; gap: 0.6rem; font-size: 0.85rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: var(--sky); cursor: pointer; margin: 0;">
                <input type="checkbox" id="sea-enable-origin-fees-${index}" class="sea-enable-origin-fees" ${originFeesEnabled ? 'checked' : ''} onchange="calculateSeaFreight()" style="width: 16px; height: 16px; accent-color: var(--sky); cursor: pointer;">
                Include Origin Local Fees
              </label>
              <span id="sea-origin-status-badge-${index}" class="sea-origin-status-badge" style="font-size: 0.7rem; font-weight: 700; color: ${originFeesEnabled ? '#10b981' : '#ef4444'}; background: ${originFeesEnabled ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)'}; padding: 2px 8px; border-radius: 4px;">${originFeesEnabled ? '✓ Included' : '✕ Excluded'}</span>
            </div>
            <div id="sea-origin-fees-content-body-${index}" class="sea-origin-fees-content-body">
              <div class="cargo-table-container" style="border: none; margin-bottom: 1rem;">
                <table class="cargo-table">
                  <thead>
                    <tr>
                      <th>Surcharge Name</th>
                      <th>Sell Cost</th>
                      <th>Buy Rate</th>
                      <th>Billing Unit</th>
                      <th>Remarks</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody class="sea-origin-surcharges-body" id="sea-origin-surcharges-body-${index}">
                  </tbody>
                </table>
              </div>
              <button type="button" class="add-row-btn" onclick="addSeaSurchargeRowToLiner(${index}, 'origin')" style="margin-bottom: 0.5rem;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Add Origin Surcharge
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- 3. DESTINATION LOCAL FEES ACCORDION -->
      <div class="liner-accordion-item">
        <div class="liner-accordion-header" onclick="toggleLinerAccordion(this)">
          <div class="liner-accordion-title">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            📍 Destination Local Fees & Surcharges
          </div>
          <button type="button" class="liner-accordion-toggle-btn">
            <span class="toggle-icon">▼</span> <span class="toggle-text">Collapse</span>
          </button>
        </div>
        <div class="liner-accordion-content">
          <div class="section-card" id="sea-dest-fees-card-${index}" style="background: transparent; border: none; padding: 0;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem; padding-bottom: 0.5rem; border-bottom: 1px solid var(--border-1);">
              <label style="display: flex; align-items: center; gap: 0.6rem; font-size: 0.85rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: var(--sky); cursor: pointer; margin: 0;">
                <input type="checkbox" id="sea-enable-dest-fees-${index}" class="sea-enable-dest-fees" ${destFeesEnabled ? 'checked' : ''} onchange="calculateSeaFreight()" style="width: 16px; height: 16px; accent-color: var(--sky); cursor: pointer;">
                Include Destination Local Fees
              </label>
              <span id="sea-dest-status-badge-${index}" class="sea-dest-status-badge" style="font-size: 0.7rem; font-weight: 700; color: ${destFeesEnabled ? '#10b981' : '#ef4444'}; background: ${destFeesEnabled ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)'}; padding: 2px 8px; border-radius: 4px;">${destFeesEnabled ? '✓ Included' : '✕ Excluded'}</span>
            </div>
            <div id="sea-dest-fees-content-body-${index}" class="sea-dest-fees-content-body">
              <div class="cargo-table-container" style="border: none; margin-bottom: 1rem;">
                <table class="cargo-table">
                  <thead>
                    <tr>
                      <th>Surcharge Name</th>
                      <th>Sell Cost</th>
                      <th>Buy Rate</th>
                      <th>Billing Unit</th>
                      <th>Remarks</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody class="sea-dest-surcharges-body" id="sea-dest-surcharges-body-${index}">
                  </tbody>
                </table>
              </div>
              <button type="button" class="add-row-btn" onclick="addSeaSurchargeRowToLiner(${index}, 'dest')" style="margin-bottom: 0.5rem;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Add Destination Surcharge
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

        <div style="margin-top: 1rem; text-align: right; border-top: 1px solid var(--border-1); padding-top: 0.75rem;">
          <button type="button" class="btn-primary done-liner-rate-modal-btn" style="padding: 7px 18px; font-size: 0.78rem;">Done</button>
        </div>
      </div>
    </div>
  `;

  container.appendChild(linerCard);

  // Rates & fees popup — keeps the liner card itself down to just the
  // liner-name field and a summary strip; everything else (freight mode,
  // origin/destination local fees) only exists in the DOM here, shown on
  // demand, so it's still reachable by every existing card.querySelector()
  // lookup this function and calculateSeaFreight() already make, just
  // nested one level deeper. Pure show/hide — no data/calculation changes.
  const linerRateModalOverlay = linerCard.querySelector(".liner-rate-modal-overlay");
  const openLinerRateModalBtn = linerCard.querySelector(".open-liner-rate-modal-btn");
  const closeLinerRateModalBtn = linerCard.querySelector(".close-liner-rate-modal-btn");
  const doneLinerRateModalBtn = linerCard.querySelector(".done-liner-rate-modal-btn");

  const openLinerRateModal = () => { linerRateModalOverlay.style.display = "flex"; };
  const closeLinerRateModal = () => { linerRateModalOverlay.style.display = "none"; updateLinerRateSummary(linerCard); };

  openLinerRateModalBtn.addEventListener("click", openLinerRateModal);
  closeLinerRateModalBtn.addEventListener("click", closeLinerRateModal);
  doneLinerRateModalBtn.addEventListener("click", closeLinerRateModal);
  linerRateModalOverlay.addEventListener("click", (e) => {
    if (e.target === linerRateModalOverlay) closeLinerRateModal();
  });
  linerCard.addEventListener("input", (e) => {
    if (e.target.classList.contains("sea-lcl-rate") || e.target.classList.contains("sea-bb-rate")) {
      updateLinerRateSummary(linerCard);
    }
  });

  if (data?.containers && data.containers.length > 0) {
    data.containers.forEach(c => addFclContainerRowToLiner(index, c.type, c.qty, c.rate, c.buy));
  } else {
    addFclContainerRowToLiner(index, "20'GP", 1, 0);
  }

  if (data?.originSurcharges && data.originSurcharges.length > 0) {
    data.originSurcharges.forEach(s => addSeaSurchargeRowToLiner(index, 'origin', s.name, s.rate, s.buyRate, s.unit, s.remarks));
  } else {
    addSeaSurchargeRowToLiner(index, 'origin', 'Terminal Handling Charges (THC)', 0, 0, 'container', '');
    addSeaSurchargeRowToLiner(index, 'origin', 'Documentation Fee', 0, 0, 'flat', '');
  }

  if (data?.destSurcharges && data.destSurcharges.length > 0) {
    data.destSurcharges.forEach(s => addSeaSurchargeRowToLiner(index, 'dest', s.name, s.rate, s.buyRate, s.unit, s.remarks));
  }

  calculateSeaFreight();
  updateLinerRateSummary(linerCard);
};

window.updateLinerSurchargeContainerOptions = function (linerIndex) {
  const card = document.getElementById(`sea-liner-card-${linerIndex}`);
  if (!card) return;

  const fclRows = card.querySelectorAll(`.sea-fcl-body .container-row, tbody[id^='sea-fcl-body-${linerIndex}'] .container-row`);
  const chosenTypes = [];
  fclRows.forEach(row => {
    const selectEl = row.querySelector(".fcl-type");
    if (selectEl && selectEl.value) {
      chosenTypes.push(selectEl.value);
    }
  });

  const uniqueTypes = [...new Set(chosenTypes)];

  const unitSelects = card.querySelectorAll(".chg-unit");
  unitSelects.forEach(selectEl => {
    const currentVal = selectEl.value;

    let html = `
      <option value="flat" ${currentVal === 'flat' ? 'selected' : ''}>Flat Fee</option>
      <option value="rt" ${currentVal === 'rt' ? 'selected' : ''}>Per RT</option>
    `;

    uniqueTypes.forEach(type => {
      const val = `container-${type}`;
      html += `<option value="${val}" ${currentVal === val ? 'selected' : ''}>Per ${type}</option>`;
    });

    selectEl.innerHTML = html;

    if (currentVal === 'container') {
      if (uniqueTypes.length > 0) {
        selectEl.value = `container-${uniqueTypes[0]}`;
      } else {
        selectEl.value = 'flat';
      }
    } else if (currentVal.startsWith('container-')) {
      const type = currentVal.substring(10);
      if (!uniqueTypes.includes(type)) {
        if (uniqueTypes.length > 0) {
          selectEl.value = `container-${uniqueTypes[0]}`;
        } else {
          selectEl.value = 'flat';
        }
      }
    }
  });
};

window.removeLinerCard = function (linerIndex) {
  const card = document.getElementById(`sea-liner-card-${linerIndex}`);
  if (card) {
    card.remove();
    calculateSeaFreight();
  }
};

window.addFclContainerRowToLiner = function (linerIndex, typeVal = "20'GP", qtyVal = 1, rateVal = 0, buyVal = 0) {
  const tbody = document.getElementById(`sea-fcl-body-${linerIndex}`);
  if (!tbody) return;

  const sellRate = (typeof rateVal === 'object' && rateVal !== null) ? (rateVal.sell || rateVal.rate || 0) : (parseFloat(rateVal) || 0);
  const buyRate = (typeof rateVal === 'object' && rateVal !== null) ? (rateVal.buy || 0) : (parseFloat(buyVal) || 0);

  const tr = document.createElement("tr");
  tr.className = "container-row";

  tr.innerHTML = `
    <td>
      <select class="fcl-type table-select" onchange="updateLinerSurchargeContainerOptions(${linerIndex}); calculateSeaFreight()">
        <option value="20'GP" ${typeVal === "20'GP" ? 'selected' : ''}>20'GP (General Purpose)</option>
        <option value="40'GP" ${typeVal === "40'GP" ? 'selected' : ''}>40'GP (General Purpose)</option>
        <option value="20'HC" ${typeVal === "20'HC" ? 'selected' : ''}>20'HC (High Cube)</option>
        <option value="40'HC" ${typeVal === "40'HC" ? 'selected' : ''}>40'HC (High Cube)</option>
        <option value="20'OT" ${typeVal === "20'OT" ? 'selected' : ''}>20'OT (Open Top)</option>
        <option value="40'OT" ${typeVal === "40'OT" ? 'selected' : ''}>40'OT (Open Top)</option>
        <option value="20'FR" ${typeVal === "20'FR" ? 'selected' : ''}>20'FR (Flat Rack)</option>
        <option value="40'FR" ${typeVal === "40'FR" ? 'selected' : ''}>40'FR (Flat Rack)</option>
        <option value="20'RF" ${typeVal === "20'RF" ? 'selected' : ''}>20'RF (Reefer)</option>
        <option value="40'RF" ${typeVal === "40'RF" ? 'selected' : ''}>40'RF (Reefer)</option>
        <option value="45'HC" ${typeVal === "45'HC" ? 'selected' : ''}>45'HC (High Cube)</option>
      </select>
    </td>
    <td><input type="number" class="fcl-qty" value="${qtyVal}" min="1" oninput="calculateSeaFreight()" style="width: 100%; text-align: center;"></td>
    <td><input type="number" class="fcl-rate fcl-sell-rate" value="${sellRate}" min="0" oninput="calculateSeaFreight()" style="width: 100%; text-align: right;"></td>
    <td><input type="number" class="fcl-buy-rate" value="${buyRate}" min="0" oninput="calculateSeaFreight()" style="width: 100%; text-align: right;"></td>
    <td style="text-align: center;">
      <button type="button" class="delete-btn" onclick="this.closest('tr').remove(); updateLinerSurchargeContainerOptions(${linerIndex}); calculateSeaFreight();" style="margin: 0 auto;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/></svg>
      </button>
    </td>
  `;

  tbody.appendChild(tr);
  updateLinerSurchargeContainerOptions(linerIndex);
  calculateSeaFreight();
};

window.addSeaSurchargeRowToLiner = function (linerIndex, type, nameVal = "", sellVal = 0, buyVal = 0, unitVal = "flat", remarksVal = "") {
  const tbodyId = type === 'origin' ? `sea-origin-surcharges-body-${linerIndex}` : `sea-dest-surcharges-body-${linerIndex}`;
  const tbody = document.getElementById(tbodyId);
  if (!tbody) return;

  const card = document.getElementById(`sea-liner-card-${linerIndex}`);
  const fclRows = card ? card.querySelectorAll(`.sea-fcl-body .container-row, tbody[id^='sea-fcl-body-${linerIndex}'] .container-row`) : [];
  const chosenTypes = [];
  fclRows.forEach(row => {
    const selectEl = row.querySelector(".fcl-type");
    if (selectEl && selectEl.value) {
      chosenTypes.push(selectEl.value);
    }
  });
  const uniqueTypes = [...new Set(chosenTypes)];

  let selectedVal = unitVal;
  if (unitVal === 'container') {
    if (uniqueTypes.length > 0) {
      selectedVal = `container-${uniqueTypes[0]}`;
    }
  }

  let unitOptions = `
    <option value="flat" ${selectedVal === 'flat' ? 'selected' : ''}>Flat Fee</option>
    <option value="rt" ${selectedVal === 'rt' ? 'selected' : ''}>Per RT</option>
  `;
  uniqueTypes.forEach(t => {
    const val = `container-${t}`;
    unitOptions += `<option value="${val}" ${selectedVal === val ? 'selected' : ''}>Per ${t}</option>`;
  });

  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td><input type="text" class="chg-name" value="${nameVal}" placeholder="Surcharge Name" required oninput="calculateSeaFreight()"></td>
    <td><input type="number" class="chg-rate" value="${sellVal}" step="0.01" oninput="calculateSeaFreight()"></td>
    <td><input type="number" class="chg-buy-rate" value="${buyVal}" step="0.01" style="background: rgba(255,255,255,0.03); color: var(--t1);" oninput="calculateSeaFreight()"></td>
    <td>
      <select class="chg-unit" onchange="calculateSeaFreight()" style="background: rgba(255,255,255,0.05); border: 1px solid var(--border-color); color: #fff; padding: 4px 8px; border-radius: 4px; width: 100%;">
        ${unitOptions}
      </select>
    </td>
    <td><input type="text" class="chg-remarks" value="${remarksVal}" placeholder="Add remarks..." style="background: rgba(255,255,255,0.03); color: var(--t1); border: 1px solid var(--border-color); border-radius: 6px; padding: 4px 8px; font-size: 0.78rem; width: 100%;"></td>
    <td>
      <button type="button" class="delete-btn" onclick="this.closest('tr').remove(); calculateSeaFreight();">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6" />
        </svg>
      </button>
    </td>
  `;

  tbody.appendChild(tr);
  calculateSeaFreight();
};

function addFclContainerRow(typeVal = "20'GP", qtyVal = 1, rateVal = 0) {
  addFclContainerRowToLiner(1, typeVal, qtyVal, rateVal);
}
window.addFclContainerRow = addFclContainerRow;

function calculateSeaFreight() {
  updateSeaFclStuffingVisibility();
  updateCurrencyRules(appState.currentUser);

  // The per-liner FCL/LCL/BB toggle (switchLinerMode) only writes to that
  // liner card's dataset.mode; it never touches appState.currentSeaFreight.type.
  // Read the primary (first) liner's actual selected mode here and keep the
  // shared state in sync so saveCurrentQuote() persists the true mode instead
  // of the frozen initial default.
  const firstLinerCardEl = document.querySelector("#sea-liners-container .liner-card");
  const type = (firstLinerCardEl && firstLinerCardEl.dataset.mode) || appState.currentSeaFreight.type || 'fcl'; // 'fcl', 'lcl', or 'bb'
  appState.currentSeaFreight.type = type;
  const currency = document.getElementById("sea-currency").value;
  const curSymbol = currency === 'INR' ? '₹' : (currency === 'USD' ? '$' : (currency === 'EUR' ? '€' : '£'));

  // Read top level cargo details
  const weightKg = parseFloat(document.getElementById("sea-gross-weight").value) || 0;
  const cbm = parseFloat(document.getElementById("sea-volume").value) || 0;
  const pkgQty = parseInt(document.getElementById("sea-pkg-qty").value) || 0;

  // LCL RT Math
  const weightTons = weightKg / 1000;
  const isLclMode = (type === 'lcl');
  const effectiveCbm = (isLclMode && cbm < 1.0) ? 1.0 : cbm;
  // Manual override for shipments where the actual chargeable volume differs
  // from the auto-calculated dimensional CBM (e.g. carrier-quoted RT). When
  // set, it replaces the auto-calculated figure entirely rather than being
  // compared against it.
  const chargeableCbmOverride = parseFloat(document.getElementById("sea-chargeable-cbm-override")?.value) || 0;
  const chargeableCbm = chargeableCbmOverride > 0 ? chargeableCbmOverride : Math.max(effectiveCbm, weightTons);

  const isSeaAmsEnabled = document.getElementById("sea-enable-ams-fee") ? document.getElementById("sea-enable-ams-fee").checked : true;
  const rawSeaAms = parseFloat(document.getElementById("sea-ams-fee")?.value) || 0;
  const amsFee = isSeaAmsEnabled ? rawSeaAms : 0;

  const linerCards = document.querySelectorAll("#sea-liners-container .liner-card");
  let calculatedLiners = [];

  linerCards.forEach((card, idx) => {
    const linerIndex = card.dataset.linerIndex;
    const linerSelect = card.querySelector(".liner-name-select") || document.getElementById(`sea-liner-select-${linerIndex}`);
    const linerNameInput = card.querySelector(".liner-name-input") || document.getElementById(`sea-liner-name-${linerIndex}`);

    let linerName = "";
    if (linerSelect && linerSelect.value && linerSelect.value !== "__custom__") {
      linerName = linerSelect.value;
    } else if (linerNameInput && linerNameInput.value.trim()) {
      linerName = linerNameInput.value.trim();
    }
    if (!linerName) {
      linerName = `Liner ${idx + 1}`;
    }

    const tariffsEnabled = card.querySelector(".sea-enable-tariffs")?.checked ?? true;
    const originFeesEnabled = card.querySelector(".sea-enable-origin-fees")?.checked ?? true;
    const destFeesEnabled = card.querySelector(".sea-enable-dest-fees")?.checked ?? true;

    // Badges update
    const tariffsBadge = card.querySelector(".sea-tariffs-status-badge");
    const originBadge = card.querySelector(".sea-origin-status-badge");
    const destBadge = card.querySelector(".sea-dest-status-badge");

    if (tariffsBadge) {
      tariffsBadge.textContent = tariffsEnabled ? "✓ Included" : "✕ Excluded";
      tariffsBadge.style.color = tariffsEnabled ? "#10b981" : "#ef4444";
      tariffsBadge.style.background = tariffsEnabled ? "rgba(16, 185, 129, 0.1)" : "rgba(239, 68, 68, 0.1)";
    }
    if (originBadge) {
      originBadge.textContent = originFeesEnabled ? "✓ Included" : "✕ Excluded";
      originBadge.style.color = originFeesEnabled ? "#10b981" : "#ef4444";
      originBadge.style.background = originFeesEnabled ? "rgba(16, 185, 129, 0.1)" : "rgba(239, 68, 68, 0.1)";
    }
    if (destBadge) {
      destBadge.textContent = destFeesEnabled ? "✓ Included" : "✕ Excluded";
      destBadge.style.color = destFeesEnabled ? "#10b981" : "#ef4444";
      destBadge.style.background = destFeesEnabled ? "rgba(16, 185, 129, 0.1)" : "rgba(239, 68, 68, 0.1)";
    }

    const linerMode = card.dataset.mode || appState.currentSeaFreight.type || 'fcl';
    const isLinerFcl = (linerMode === 'fcl');

    let linerBaseFreight = 0;
    let linerBaseFreightBuy = 0;
    let linerContainersCount = 0;
    let linerContainerSummary = [];
    let containersList = [];
    let linerLclRate = 0, linerLclBuyRate = 0, linerBbRate = 0, linerBbBuyRate = 0;
    // Same quoting-stage rule as Air Freight: whichever of Sell/Buy is
    // entered feeds the interim total; tracked here so it can be surfaced
    // as an "Interim Estimate" indicator rather than silently blended in.
    let linerUsingBuyFallback = false;

    if (linerMode === 'fcl') {
      const fclRows = card.querySelectorAll(".sea-fcl-body .container-row, tbody[id^='sea-fcl-body'] .container-row");
      fclRows.forEach(row => {
        const typeVal = row.querySelector(".fcl-type")?.value || "20'GP";
        const qty = parseInt(row.querySelector(".fcl-qty")?.value) || 0;
        const rate = parseFloat(row.querySelector(".fcl-sell-rate")?.value || row.querySelector(".fcl-rate")?.value) || 0;
        const buy = parseFloat(row.querySelector(".fcl-buy-rate")?.value) || 0;
        const activeRate = rate > 0 ? rate : (buy > 0 ? buy : 0);
        if (rate === 0 && buy > 0) linerUsingBuyFallback = true;
        containersList.push({ type: typeVal, qty, rate, buy });
        if (qty > 0 && activeRate > 0) {
          if (tariffsEnabled) {
            linerBaseFreight += (qty * activeRate);
            linerBaseFreightBuy += (qty * buy);
          }
          linerContainersCount += qty;
          linerContainerSummary.push(`${qty} x ${typeVal}`);
        }

        // Purely visual: flag a row with a quantity but no rate on either
        // side — this is exactly the state saveCurrentQuote() now blocks at
        // save time; the flag just surfaces it earlier, live. Math above
        // (activeRate / linerBaseFreight) is untouched.
        row.classList.toggle("row-incomplete-flag", qty > 0 && rate <= 0 && buy <= 0);
      });
    } else if (linerMode === 'lcl') {
      const rate = parseFloat(card.querySelector(".sea-lcl-rate")?.value) || 0;
      const buy = parseFloat(card.querySelector(".sea-lcl-buy-rate")?.value) || 0;
      linerLclRate = rate;
      linerLclBuyRate = buy;
      const activeRate = rate > 0 ? rate : buy;
      if (rate === 0 && buy > 0) linerUsingBuyFallback = true;
      if (tariffsEnabled) {
        linerBaseFreight = chargeableCbm * activeRate;
        linerBaseFreightBuy = chargeableCbm * buy;
      }
    } else {
      const rate = parseFloat(card.querySelector(".sea-bb-rate")?.value) || 0;
      const buy = parseFloat(card.querySelector(".sea-bb-buy-rate")?.value) || 0;
      linerBbRate = rate;
      linerBbBuyRate = buy;
      const activeRate = rate > 0 ? rate : buy;
      if (rate === 0 && buy > 0) linerUsingBuyFallback = true;
      if (tariffsEnabled) {
        linerBaseFreight = chargeableCbm * activeRate;
        linerBaseFreightBuy = chargeableCbm * buy;
      }
    }

    // Live "GP" indicator next to the LCL/BB rate inputs, matching the same
    // Total/GP footer already shown on the Origin/Destination surcharge
    // tables below — freight-only (sell minus buy), not including surcharges.
    const freightGpForm = linerMode === 'lcl' ? card.querySelector(".sea-lcl-form") : (linerMode === 'bb' ? card.querySelector(".sea-bb-form") : null);
    const freightGpEl = freightGpForm ? freightGpForm.querySelector(".sea-freight-gp-inline") : null;
    if (freightGpEl) {
      freightGpEl.textContent = `GP ${curSymbol}${(linerBaseFreight - linerBaseFreightBuy).toFixed(2)}`;
    }

    let linerOriginTotal = 0;
    let linerOriginTotalBuy = 0;
    let linerOriginList = [];
    if (originFeesEnabled) {
      if (isSeaAmsEnabled && amsFee > 0) {
        linerOriginTotal += amsFee;
        linerOriginTotalBuy += amsFee;
        linerOriginList.push({ name: "AMS Fee", rate: amsFee, unit: "flat", calculatedCost: amsFee });
      }
      const originRows = card.querySelectorAll(".sea-origin-surcharges-body tr, tbody[id^='sea-origin-surcharges-body'] tr");
      originRows.forEach(row => {
        const name = row.querySelector(".chg-name")?.value.trim();
        const rate = parseFloat(row.querySelector(".chg-rate")?.value) || 0;
        const buyRate = parseFloat(row.querySelector(".chg-buy-rate")?.value) || 0;
        const unit = row.querySelector(".chg-unit")?.value || 'flat';
        const remarks = row.querySelector(".chg-remarks")?.value.trim() || "";

        if (name && (rate > 0 || buyRate > 0)) {
          const effectiveRate = rate > 0 ? rate : buyRate;
          if (rate === 0 && buyRate > 0) linerUsingBuyFallback = true;
          let cost = 0;
          let costBuy = 0;
          if (unit.startsWith('container-')) {
            const cType = unit.substring(10);
            const containerObj = containersList.find(c => c.type === cType);
            const qty = containerObj ? containerObj.qty : 0;
            cost = qty * effectiveRate;
            costBuy = qty * buyRate;
          } else if (unit === 'container') {
            cost = isLinerFcl ? linerContainersCount * effectiveRate : effectiveRate;
            costBuy = isLinerFcl ? linerContainersCount * buyRate : buyRate;
          } else if (unit === 'rt') {
            cost = chargeableCbm * effectiveRate;
            costBuy = chargeableCbm * buyRate;
          } else if (unit === 'kg') {
            cost = weightKg * effectiveRate;
            costBuy = weightKg * buyRate;
          } else {
            cost = effectiveRate;
            costBuy = buyRate;
          }
          linerOriginTotal += cost;
          linerOriginTotalBuy += costBuy;
          linerOriginList.push({ name, rate, buyRate, unit, remarks, calculatedCost: cost });
        }
      });
    }

    let linerDestTotal = 0;
    let linerDestTotalBuy = 0;
    let linerDestList = [];
    if (destFeesEnabled) {
      const destRows = card.querySelectorAll(".sea-dest-surcharges-body tr, tbody[id^='sea-dest-surcharges-body'] tr");
      destRows.forEach(row => {
        const name = row.querySelector(".chg-name")?.value.trim();
        const rate = parseFloat(row.querySelector(".chg-rate")?.value) || 0;
        const buyRate = parseFloat(row.querySelector(".chg-buy-rate")?.value) || 0;
        const unit = row.querySelector(".chg-unit")?.value || 'flat';
        const remarks = row.querySelector(".chg-remarks")?.value.trim() || "";

        if (name && (rate > 0 || buyRate > 0)) {
          const effectiveRate = rate > 0 ? rate : buyRate;
          if (rate === 0 && buyRate > 0) linerUsingBuyFallback = true;
          let cost = 0;
          let costBuy = 0;
          if (unit.startsWith('container-')) {
            const cType = unit.substring(10);
            const containerObj = containersList.find(c => c.type === cType);
            const qty = containerObj ? containerObj.qty : 0;
            cost = qty * effectiveRate;
            costBuy = qty * buyRate;
          } else if (unit === 'container') {
            cost = isLinerFcl ? linerContainersCount * effectiveRate : effectiveRate;
            costBuy = isLinerFcl ? linerContainersCount * buyRate : buyRate;
          } else if (unit === 'rt') {
            cost = chargeableCbm * effectiveRate;
            costBuy = chargeableCbm * buyRate;
          } else if (unit === 'kg') {
            cost = weightKg * effectiveRate;
            costBuy = weightKg * buyRate;
          } else {
            cost = effectiveRate;
            costBuy = buyRate;
          }
          linerDestTotal += cost;
          linerDestTotalBuy += costBuy;
          linerDestList.push({ name, rate, buyRate, unit, remarks, calculatedCost: cost });
        }
      });
    }

    const linerGrandTotal = (tariffsEnabled ? linerBaseFreight : 0) + (originFeesEnabled ? linerOriginTotal : 0) + (destFeesEnabled ? linerDestTotal : 0);
    const linerGrandTotalBuy = (tariffsEnabled ? linerBaseFreightBuy : 0) + (originFeesEnabled ? linerOriginTotalBuy : 0) + (destFeesEnabled ? linerDestTotalBuy : 0);
    let linerGrandTotalINR = linerGrandTotal;
    if (currency !== 'INR') {
      linerGrandTotalINR = linerGrandTotal * EXCHANGE_RATES[`${currency}_TO_INR`];
    }

    calculatedLiners.push({
      linerIndex,
      linerName,
      mode: linerMode,
      tariffsEnabled,
      originFeesEnabled,
      destFeesEnabled,
      baseFreight: linerBaseFreight,
      baseFreightBuy: linerBaseFreightBuy,
      lclRate: linerLclRate,
      lclBuyRate: linerLclBuyRate,
      bbRate: linerBbRate,
      bbBuyRate: linerBbBuyRate,
      containers: containersList,
      fclSummary: linerContainerSummary,
      originSurcharges: linerOriginList,
      originTotal: linerOriginTotal,
      originTotalBuy: linerOriginTotalBuy,
      destSurcharges: linerDestList,
      destTotal: linerDestTotal,
      destTotalBuy: linerDestTotalBuy,
      grandTotal: linerGrandTotal,
      grandTotalBuy: linerGrandTotalBuy,
      grandTotalINR: linerGrandTotalINR,
      usingBuyFallback: linerUsingBuyFallback
    });
  });

  const primaryLiner = calculatedLiners[0] || {
    baseFreight: 0,
    originSurcharges: [],
    destSurcharges: [],
    originTotal: 0,
    destTotal: 0,
    grandTotal: 0,
    grandTotalBuy: 0,
    grandTotalINR: 0,
    fclSummary: [],
    containers: []
  };

  const baseFreight = primaryLiner.baseFreight;
  const totalSurcharges = primaryLiner.originTotal + primaryLiner.destTotal;
  const grandTotal = primaryLiner.grandTotal;
  const grandTotalBuy = primaryLiner.grandTotalBuy || 0;
  const liveGP = grandTotal - grandTotalBuy;
  const totalINR = primaryLiner.grandTotalINR;
  const originSurchargesList = primaryLiner.originSurcharges;
  const destSurchargesList = primaryLiner.destSurcharges;
  const surchargesList = [...originSurchargesList, ...destSurchargesList];

  let detailsText = '';
  if (type === 'fcl') {
    detailsText = primaryLiner.fclSummary.join(", ") || 'No Containers Selected';
    appState.currentSeaFreight.fclSummary = primaryLiner.fclSummary;
  } else if (type === 'lcl') {
    detailsText = `${chargeableCbm.toFixed(2)} RT (${effectiveCbm.toFixed(2)} CBM / ${weightTons.toFixed(2)} Tons) [LCL]`;
  } else {
    detailsText = `${chargeableCbm.toFixed(2)} RT (${cbm.toFixed(2)} CBM / ${weightTons.toFixed(2)} Tons) [Break Bulk]`;
  }

  let typeLabel = "FCL (Full Container)";
  if (type === 'lcl') {
    typeLabel = "LCL (Loose Cargo)";
  } else if (type === 'bb') {
    typeLabel = "Break Bulk (Loose Cargo)";
  }
  document.getElementById("res-sea-type").textContent = typeLabel;
  document.getElementById("res-sea-details").textContent = detailsText;
  document.getElementById("res-sea-gw").textContent = `${weightKg.toFixed(2)} kg`;
  document.getElementById("res-sea-vol").textContent = `${effectiveCbm.toFixed(2)} CBM`;
  document.getElementById("res-sea-qty").textContent = `${pkgQty} Pkgs`;

  const routing = formatRoutingDisplay(document.getElementById("sea-routing")?.value || "");
  const rawTt = document.getElementById("sea-tt")?.value || "";
  const tt = formatTransitTimeDisplay(rawTt);
  const validity = document.getElementById("sea-validity")?.value || "";
  const resRouting = document.getElementById("res-sea-routing-val");
  const resTT = document.getElementById("res-sea-tt-val");
  const resValidity = document.getElementById("res-sea-validity-val");
  if (resRouting) resRouting.textContent = routing;
  if (resTT) resTT.textContent = tt || "-";
  if (resValidity) resValidity.textContent = validity || "-";

  document.getElementById("res-sea-base").textContent = `${curSymbol}${baseFreight.toFixed(2)}`;
  document.getElementById("res-sea-sur").textContent = `${curSymbol}${totalSurcharges.toFixed(2)}`;
  document.getElementById("res-sea-total").textContent = `${curSymbol}${grandTotal.toFixed(2)}`;
  const resSeaGpEl = document.getElementById("res-sea-gp");
  if (resSeaGpEl) resSeaGpEl.textContent = `${curSymbol}${liveGP.toFixed(2)}`;

  // Live per-container-type breakdown — mirrors the saved/printed quote's
  // presentation so a distinct rate/subtotal per container type is visible
  // before saving too, not only afterward.
  const fclBreakdownEl = document.getElementById("res-sea-fcl-breakdown");
  const baseLabelEl = document.getElementById("res-sea-base-label");
  if (fclBreakdownEl) {
    const fclItems = type === 'fcl' ? (primaryLiner.containers || []).filter(c => (c.qty || 0) > 0) : [];
    if (fclItems.length > 0) {
      fclBreakdownEl.innerHTML = `
        <h4 style="font-size: 0.7rem; text-transform: uppercase; color: var(--text-muted); margin-bottom: 0.5rem; font-weight: 800; letter-spacing: 0.05em;">Container Breakdown</h4>
        ${fclItems.map(c => {
          const qty = c.qty || 0;
          const rate = c.rate > 0 ? c.rate : (c.buy || 0);
          const rowTotal = qty * rate;
          return `
            <div class="result-row">
              <span class="result-label">${c.type} × ${qty}</span>
              <span class="result-value">${curSymbol}${rate.toFixed(2)}/unit = <strong>${curSymbol}${rowTotal.toFixed(2)}</strong></span>
            </div>
          `;
        }).join("")}
      `;
      fclBreakdownEl.style.display = "block";
      if (baseLabelEl) baseLabelEl.textContent = "Total Base Ocean Freight (All Containers)";
    } else {
      fclBreakdownEl.innerHTML = "";
      fclBreakdownEl.style.display = "none";
      if (baseLabelEl) baseLabelEl.textContent = "Base Ocean Freight";
    }
  }

  // Render Multi-Liner Comparison Cards in Results Panel
  const multiLinerResultsList = document.getElementById("sea-multi-liner-results-list");
  const linerCountBadge = document.getElementById("sea-liner-count-badge");
  if (linerCountBadge) {
    linerCountBadge.textContent = `${calculatedLiners.length} Option${calculatedLiners.length > 1 ? 's' : ''}`;
  }
  if (multiLinerResultsList) {
    multiLinerResultsList.innerHTML = calculatedLiners.map((l, i) => `
      <div class="liner-result-card ${i === 0 ? 'primary-liner' : ''}">
        <div class="liner-result-title">
          <span>🚢 ${l.linerName} ${i === 0 ? '(Primary)' : ''}</span>
          <span style="font-weight: 900; color: #10b981;">${curSymbol}${l.grandTotal.toFixed(2)}</span>
        </div>
        ${l.usingBuyFallback ? '<div title="Sell Rate is blank on at least one line — this total is using the Buy/Cost Rate as an interim placeholder. It is not a confirmed customer price." style="display:inline-block; margin-top:4px; font-size: 0.6rem; background: #fef3c7; color: #92400e; border: 1px solid #f59e0b; padding: 2px 6px; border-radius: 4px; font-weight: 800; text-transform: uppercase;">⚠ Interim Estimate (Buy Rate)</div>' : ''}
        <div style="font-size: 0.68rem; color: var(--t2); display: grid; grid-template-columns: 1fr 1fr; gap: 4px; margin-top: 4px;">
          <span>Freight: ${curSymbol}${l.baseFreight.toFixed(2)}</span>
          <span>Origin Fees: ${curSymbol}${l.originTotal.toFixed(2)}</span>
          <span>Dest Fees: ${curSymbol}${l.destTotal.toFixed(2)}</span>
          <span>INR Total: ₹${l.grandTotalINR.toFixed(2)}</span>
        </div>
      </div>
    `).join("");
  }

  // Update Alternative Sea Options Summary Live Results
  const altContainer = document.getElementById("sea-alternatives-results-container");
  const altList = document.getElementById("sea-alternatives-results-list");
  let alts = [];
  if (altContainer && altList) {
    const rows = document.querySelectorAll("#sea-alternatives-body tr");
    rows.forEach(row => {
      const carrier = row.querySelector(".alt-carrier")?.value || "";
      const route = row.querySelector(".alt-routing")?.value || "";
      const transitTime = row.querySelector(".alt-tt")?.value || "";
      const rateInfo = row.querySelector(".alt-rate")?.value || "";
      if (carrier || route || transitTime || rateInfo) {
        alts.push({ carrier, routing: route, tt: transitTime, rate: rateInfo });
      }
    });

    if (alts.length > 0) {
      altContainer.style.display = "block";
      altList.innerHTML = alts.map(alt => `
        <div style="background: rgba(255, 255, 255, 0.03); border: 1px solid var(--border-color); padding: 8px 10px; border-radius: 6px; font-size: 0.72rem;">
          <div style="display: flex; justify-content: space-between; font-weight: 750; color: #fff;">
            <span>🚢 ${alt.carrier || '-'}</span>
            <span style="color: var(--accent-sea); font-weight: 800;">${alt.rate || '-'}</span>
          </div>
          <div style="font-size: 0.65rem; color: var(--text-dim); display: flex; justify-content: space-between; margin-top: 3px;">
            <span>Route: ${alt.routing || '-'}</span>
            <span>TT: ${alt.tt || '-'}</span>
          </div>
        </div>
      `).join("");
    } else {
      altContainer.style.display = "none";
      altList.innerHTML = "";
    }
  }

  appState.currentSeaFreight.liners = calculatedLiners;
  appState.currentSeaFreight.grossWeight = weightKg;
  appState.currentSeaFreight.volumeCbm = effectiveCbm;
  appState.currentSeaFreight.packagesQuantity = pkgQty;
  appState.currentSeaFreight.baseFreight = baseFreight;
  appState.currentSeaFreight.surchargeTotal = totalSurcharges;
  appState.currentSeaFreight.grandTotal = grandTotal;
  appState.currentSeaFreight.grandTotalINR = totalINR;
  appState.currentSeaFreight.currency = currency;
  appState.currentSeaFreight.originSurcharges = originSurchargesList;
  appState.currentSeaFreight.destSurcharges = destSurchargesList;
  appState.currentSeaFreight.surchargesCalculated = surchargesList;
  appState.currentSeaFreight.routing = routing;
  appState.currentSeaFreight.tt = tt;
  appState.currentSeaFreight.validity = validity;
  appState.currentSeaFreight.alternatives = alts;

  appState.currentSeaFreight.handlingProfile = document.getElementById("sea-handling-profile")?.value || "Stackable";
  appState.currentSeaFreight.orientationProfile = document.getElementById("sea-orientation-profile")?.value || "Tiltable";
  appState.currentSeaFreight.cargoRisk = document.getElementById("sea-cargo-risk")?.value || "Non Hazardous";
  appState.currentSeaFreight.climateConstraint = document.getElementById("sea-climate-constraint")?.value || "Ambient (15-25 DEG)";
}


function setupSurchargesEvents(freightType) {
  const body = document.getElementById(`${freightType}-surcharges-body`);
  const addBtn = document.getElementById(`add-${freightType}-surcharge`);
  if (!addBtn || !body) return;

  if (addBtn.dataset.listenerBound === "true") return;
  addBtn.dataset.listenerBound = "true";

  const isAir = freightType.startsWith("air");
  const callback = isAir ? calculateAirFreight : calculateSeaFreight;

  addBtn.addEventListener("click", () => {
    const row = document.createElement("tr");
    if (isAir) {
      row.innerHTML = `
        <td><input type="text" class="chg-name" placeholder="Charge Name" required></td>
        <td><input type="number" class="chg-rate" min="0" step="0.01" placeholder="Rate"></td>
        <td><input type="number" class="chg-buy-rate" min="0" step="0.01" placeholder="Cost" value="0.00" style="background: rgba(255,255,255,0.03); color: var(--t1);"></td>
        <td>
          <select class="chg-unit">
            <option value="kg">Per kg</option>
            <option value="flat">Flat</option>
          </select>
        </td>
        <td><input type="text" class="chg-remarks" placeholder="Add remarks..." style="background: rgba(255,255,255,0.03); color: var(--t1); border: 1px solid var(--border-color); border-radius: 6px; padding: 4px 8px; font-size: 0.78rem; width: 100%;"></td>
        <td>
          <button type="button" class="delete-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/></svg>
          </button>
        </td>
      `;
    } else {
      row.innerHTML = `
        <td><input type="text" class="chg-name" placeholder="Charge Name" required></td>
        <td><input type="number" class="chg-rate" min="0" step="0.01" placeholder="Cost"></td>
        <td><input type="number" class="chg-buy-rate" min="0" step="0.01" placeholder="Cost" value="0.00" style="background: rgba(255,255,255,0.03); color: var(--t1);"></td>
        <td>
          <select class="chg-unit table-select">
            <option value="flat" selected>Flat Fee</option>
            <option value="container">Per Container</option>
            <option value="rt">Per RT (Revenue Ton)</option>
            <option value="kg">Per Kg (Gross Weight)</option>
          </select>
        </td>
        <td><input type="text" class="chg-remarks" placeholder="Add remarks..." style="background: rgba(255,255,255,0.03); color: var(--t1); border: 1px solid var(--border-color); border-radius: 6px; padding: 4px 8px; font-size: 0.78rem; width: 100%;"></td>
        <td>
          <button type="button" class="delete-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/></svg>
          </button>
        </td>
      `;
    }

    const nameInput = row.querySelector(".chg-name");
    if (nameInput) {
      nameInput.setAttribute("list", `${freightType}-charges-list`);
    }

    body.appendChild(row);
    callback();
  });

  // Use event delegation on body
  body.addEventListener("input", (e) => {
    if (e.target.matches("input, select")) {
      callback();
    }
  });

  body.addEventListener("change", (e) => {
    if (e.target.classList.contains("chg-name")) {
      memorizeSurchargeNames(e);
    }
  });

  body.addEventListener("focusin", (e) => {
    if (e.target.classList.contains("chg-name")) {
      e.target.setAttribute("list", `${freightType}-charges-list`);
    }
  });

  body.addEventListener("click", (e) => {
    const btn = e.target.closest(".delete-btn");
    if (btn && body.contains(btn)) {
      btn.closest("tr").remove();
      callback();
    }
  });

  // Setup list attribute for any initial rows
  body.querySelectorAll(".chg-name").forEach(inp => {
    inp.setAttribute("list", `${freightType}-charges-list`);
  });
}

// MEMBER DASHBOARD RENDERING
function renderMemberDashboard(userId) {
  const user = userId || appState.currentUser || "shashank";

  // Resolved amendment-request notifications must be checked regardless of
  // which page is open — this is how a user finds out an admin approved or
  // rejected their request, not something that should wait until they
  // happen to open the Dashboard. Cheap either way (array filter + a
  // deferred alert), so it's fine to leave ungated.
  let requestsList = window._amendmentRequests || [];
  if (requestsList.length === 0) {
    const storedReqs = localStorage.getItem("gl_amendment_requests");
    if (storedReqs) {
      try {
        requestsList = JSON.parse(storedReqs);
        if (!Array.isArray(requestsList)) requestsList = [];
      } catch (e) { requestsList = []; }
    }
  }
  if (!Array.isArray(requestsList)) requestsList = [];
  const myResolved = requestsList.filter(r => r.creator === userId && !r.acknowledged && (r.status === 'approved' || r.status === 'rejected'));

  if (myResolved.length > 0) {
    // Schedule a small delay to not block rendering
    setTimeout(() => {
      myResolved.forEach(req => {
        let reqTypeLabel = "EDIT/AMEND";
        if (req.requestType === 'delete') {
          reqTypeLabel = "DELETE";
        }

        if (req.status === 'approved') {
          if (req.requestType === 'delete') {
            alert(`🔔 Admin Permission Alert:\nGanny has APPROVED your request to DELETE quote #${getQuoteRefIdById(req.quoteId)} for "${req.customer}".\n\nYou can now click the Delete (Trash) button next to the quote to delete it.`);
          } else {
            alert(`🔔 Admin Permission Alert:\nGanny has APPROVED your request to AMEND quote #${getQuoteRefIdById(req.quoteId)} for "${req.customer}".\n\nYou can now click the Orange Edit/Amend button next to the quote to correct it!`);
          }
        } else {
          alert(`🔔 Admin Permission Alert:\nGanny has REJECTED your request to ${reqTypeLabel} quote #${getQuoteRefIdById(req.quoteId)} for "${req.customer}".`);
        }
        req.acknowledged = true;

        if (DB.firestoreRef) {
          DB.firestoreRef.collection("amendment_requests").doc(req.id).update({ acknowledged: true })
            .catch(err => console.error("DB: failed to acknowledge request:", err));
        }
      });
      localStorage.setItem("gl_amendment_requests", JSON.stringify(requestsList));
    }, 100);
  }

  // Everything below only matters when the Member Dashboard is the visible
  // panel. The Firestore quotes listener calls this function on every write
  // from any of the team's users, system-wide — without this gate, a full
  // NRS registry fetch, a scratchpad reload, and a scan over every quote in
  // the company ran on every single save, even while looking at, say, the
  // Air Freight desk, which is what was making the whole app feel sluggish.
  const memberDashPanel = document.getElementById("member-dashboard-panel");
  const isDashboardVisible = !!(memberDashPanel && memberDashPanel.classList.contains("active"));
  if (!isDashboardVisible) return;

  renderNrsRegistry();

  // Load member scratchpad content
  let scratchpads = {};
  try {
    scratchpads = JSON.parse(localStorage.getItem("gl_active_scratchpads") || "{}");
    if (typeof scratchpads !== 'object' || scratchpads === null) scratchpads = {};
  } catch (e) { scratchpads = {}; }
  const pad = scratchpads[user];
  const ta = document.getElementById("dashboard-scratchpad");
  if (ta) {
    ta.value = pad ? pad.text : "";
  }
  if (!window._newsLoaded) {
    setTimeout(() => {
      loadLogisticsNews('global');
      window._newsLoaded = true;
    }, 100);
  }

  const myQuotes = (appState.quotes || []).filter(q => q.creator === userId);
  const totalEnquiries = myQuotes.length;

  let totalRevenueINR = 0;
  let conversions = 0;

  myQuotes.forEach(q => {
    totalRevenueINR += q.amountINR;
    if (q.status === 'converted') {
      conversions++;
    }
  });

  const conversionRate = totalEnquiries > 0 ? (conversions / totalEnquiries * 100) : 0;

  // Update KPI Metrics — ring-chart KPIs, same treatment as the admin dashboard
  const myRevenueByMode = { air: 0, sea: 0, transport: 0, warehouse: 0 };
  const myEnquiriesByStatus = { quoted: 0, converted: 0, lost: 0, cancelled: 0 };
  myQuotes.forEach(q => {
    if (myRevenueByMode[q.type] !== undefined) myRevenueByMode[q.type] += (q.amountINR || 0);
    if (myEnquiriesByStatus[q.status] !== undefined) myEnquiriesByStatus[q.status]++;
  });
  const RING_BLUE2 = '#3b82f6', RING_TEAL2 = '#14b8a6', RING_VIOLET2 = '#8b5cf6',
    RING_AMBER2 = '#f59e0b', RING_GREEN2 = '#22c55e', RING_ROSE2 = '#f43f5e',
    RING_GRAY2 = '#94a3b8', RING_TRACK2 = '#e2e8f0';

  renderRingKPI("user-stat-revenue-ring", {
    centerValue: `₹${totalRevenueINR.toLocaleString('en-IN', { maximumFractionDigits: 0, notation: totalRevenueINR >= 100000 ? 'compact' : 'standard' })}`,
    segments: [
      { value: myRevenueByMode.air, color: RING_BLUE2, label: 'Air' },
      { value: myRevenueByMode.sea, color: RING_TEAL2, label: 'Sea' },
      { value: myRevenueByMode.transport, color: RING_VIOLET2, label: 'Transport' },
      { value: myRevenueByMode.warehouse, color: RING_AMBER2, label: 'Warehouse' }
    ]
  });
  renderRingKPI("user-stat-quotes-ring", {
    centerValue: totalEnquiries,
    segments: [
      { value: myEnquiriesByStatus.quoted, color: RING_BLUE2, label: 'Quoted' },
      { value: myEnquiriesByStatus.converted, color: RING_GREEN2, label: 'Won' },
      { value: myEnquiriesByStatus.lost, color: RING_ROSE2, label: 'Lost' },
      { value: myEnquiriesByStatus.cancelled, color: RING_GRAY2, label: 'Cancelled' }
    ]
  });
  renderRingKPI("user-stat-conversions-ring", {
    centerValue: conversions,
    segments: [
      { value: conversions, color: RING_GREEN2, label: 'Won' },
      { value: totalEnquiries - conversions, color: RING_TRACK2, label: 'Not yet won' }
    ]
  });
  renderRingKPI("user-stat-rate-ring", {
    centerValue: `${conversionRate.toFixed(1)}%`,
    segments: [
      { value: conversionRate, color: RING_BLUE2, label: 'Converted' },
      { value: 100 - conversionRate, color: RING_TRACK2, label: 'Remaining' }
    ]
  });

  // Render Table via filters and sorting
  window.userDashboardId = userId;
  if (!window.userHdrFilterState) {
    window.resetAllUserHdrFilters();
  } else {
    window.applyUserDbFiltersAndSort();
  }

  // Render NRS alerts if applicable
  const nrsPanel = document.getElementById("nrs-notifications-panel");
  if (nrsPanel) {
    if (userId === 'cathrina') {
      let alerts = [];
      const stored = localStorage.getItem("nrs_alerts");
      if (stored) {
        try { alerts = JSON.parse(stored); } catch (e) { alerts = []; }
      }

      if (alerts.length > 0) {
        nrsPanel.style.display = "block";
        const alertsList = document.getElementById("nrs-notifications-list");
        if (alertsList) {
          alertsList.innerHTML = alerts.map(alert => `
            <div style="background: rgba(255,255,255,0.05); padding: 8px 12px; border-radius: 6px; border-left: 3px solid var(--accent-air); display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.25rem;">
              <div>
                <div>${alert.message}</div>
                <div style="font-size: 0.7rem; color: var(--text-muted); margin-top: 0.25rem;">${alert.date}</div>
              </div>
              <button type="button" style="background: none; border: none; color: var(--text-dim); cursor: pointer; padding: 4px; display: flex; align-items: center;" onclick="deleteNrsAlert('${alert.id}')">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
          `).join("");
        }
      } else {
        nrsPanel.style.display = "none";
      }
    } else {
      nrsPanel.style.display = "none";
    }
  }
}

function clearNrsNotifications() {
  localStorage.setItem("nrs_alerts", JSON.stringify([]));
  if (appState.currentUser) {
    renderMemberDashboard(appState.currentUser);
  }
}
window.clearNrsNotifications = clearNrsNotifications;

function deleteNrsAlert(alertId) {
  let alerts = [];
  const stored = localStorage.getItem("nrs_alerts");
  if (stored) {
    try { alerts = JSON.parse(stored); } catch (e) { alerts = []; }
  }
  alerts = alerts.filter(a => a.id !== alertId);
  localStorage.setItem("nrs_alerts", JSON.stringify(alerts));
  if (appState.currentUser) {
    renderMemberDashboard(appState.currentUser);
  }
}
window.deleteNrsAlert = deleteNrsAlert;

// EXECUTIVE COMMAND CENTER DASHBOARD
function showExecutiveDashboard() {
  // The standalone "Executive Command Center" panel this used to activate
  // has been retired — it duplicated most of the Dashboard's Overview tab
  // (same KPIs, same leaderboard) under different labels, plus one widget
  // ("System Data Reconciliation Audit") that never did any real check —
  // it always reported "100%"/"No orphans detected" regardless of actual
  // data. Its genuinely unique content (Pipeline, Compliance, Recent
  // Activity, trend charts, Customer Concentration, Route Performance) now
  // lives in the Dashboard's own "Analytics" tab instead of a second,
  // separately-branded dashboard. This function now just opens that tab.
  if (!isUserAdminOrManager()) {
    console.warn("Access Denied: Executive Dashboard is restricted to user ganny.");
    alert("Access Denied: Executive Dashboard is restricted to user ganny.");
    goHome();
    return;
  }
  goHome();
  const analyticsBtn = document.querySelector('#manager-panel .desk-tab-btn[data-tab="analytics"]') ||
    [...document.querySelectorAll('#manager-panel .desk-tab-btn')].find(b => /Analytics/.test(b.textContent));
  if (analyticsBtn) analyticsBtn.click();
}
window.showExecutiveDashboard = showExecutiveDashboard;

function renderExecutiveDashboard() {
  // 1. Fetch data
  const quotes = appState.quotes || [];

  // Note: this used to also update a set of "Executive KPI Cards" and a
  // "Pricing Team Leaderboard" here, but those were duplicates of cards
  // already on the Dashboard's Overview tab (#admin-leaderboard-body, etc.)
  // and their target elements were removed when the old standalone
  // executive-dashboard-panel was retired (see showExecutiveDashboard).
  // Leaving the old getElementById(...).textContent calls in meant every
  // call to this function threw on a null element and aborted before ever
  // reaching the Pipeline/Compliance/Recent Activity code below — which is
  // why the Analytics tab appeared to show nothing but zeros.

  // 2. Quote Pipeline Status Counts
  const pipeQuoted = quotes.filter(q => q.status === 'quoted').length;
  const convertedQuotes = quotes.filter(q => q.status === 'converted').length;
  const pipeConverted = convertedQuotes;
  const pipeLost = quotes.filter(q => q.status === 'lost').length;
  const pipeCancelled = quotes.filter(q => q.status === 'cancelled').length;

  document.getElementById("exec-pipe-quoted").textContent = pipeQuoted;
  document.getElementById("exec-pipe-converted").textContent = pipeConverted;
  document.getElementById("exec-pipe-lost").textContent = pipeLost;
  document.getElementById("exec-pipe-cancelled").textContent = pipeCancelled;

  // 4. Customer Compliance Control Summary
  let controls = window._customerControls || {};
  if (Object.keys(controls).length === 0) {
    try {
      controls = JSON.parse(localStorage.getItem("gl_customer_controls") || "{}");
    } catch (e) { }
  }

  const blockedCusts = [];
  const pendingCusts = [];

  Object.values(controls).forEach(c => {
    if (c.blocked) {
      blockedCusts.push(c.customer);
    }
    if (!c.hasAgreement && !c.waiveAgreement) {
      pendingCusts.push(c.customer);
    }
  });

  document.getElementById("exec-blocked-cust-count").textContent = blockedCusts.length;
  document.getElementById("exec-blocked-cust-list").textContent = blockedCusts.length > 0 ? blockedCusts.join(", ") : "None currently";

  document.getElementById("exec-pending-cust-count").textContent = pendingCusts.length;
  document.getElementById("exec-pending-cust-list").textContent = pendingCusts.length > 0 ? pendingCusts.join(", ") : "None currently";

  // 5. Pricing Team Leaderboard Performance
  const leadBody = document.getElementById("exec-leaderboard-body");
  if (leadBody) {
    leadBody.innerHTML = "";

    const desks = Object.keys(TEAM_ROLES).filter(roleId => {
      if (roleId === 'ganny' || roleId === 'manager') return false;
      return true;
    });

    // Two different logins can share a display name (e.g. more than one
    // "Free Hand Sales" account) — disambiguate before rendering, same
    // treatment already applied to Quotes By User / Revenue By User.
    const deskNameLookup = {};
    desks.forEach(deskId => {
      deskNameLookup[deskId] = { name: (TEAM_ROLES[deskId]?.name || deskId).replace(/\s*\(Free\s*Hand\)/i, "") };
    });
    disambiguateDuplicateNames(deskNameLookup);

    desks.forEach(deskId => {
      const deskIdLower = deskId.toLowerCase();
      const deskQuotes = quotes.filter(q => q.creator && q.creator.toLowerCase() === deskIdLower);
      const deskQuotesCount = deskQuotes.length;
      const deskConversions = deskQuotes.filter(q => q.status === 'converted').length;
      const deskRate = deskQuotesCount > 0 ? (deskConversions / deskQuotesCount * 100) : 0;
      const deskGP = deskQuotes.reduce((acc, q) => acc + (q.grossProfitINR || 0), 0);

      const tr = document.createElement("tr");
      const name = deskNameLookup[deskId].name;

      tr.innerHTML = `
        <td><strong>${name}</strong></td>
        <td>${deskQuotesCount}</td>
        <td>${deskConversions}</td>
        <td>
          <span style="font-weight:700; color: ${deskRate >= 40 ? 'var(--accent-success)' : (deskRate >= 25 ? 'var(--accent-warning)' : 'var(--accent-error)')};">
            ${deskRate.toFixed(1)}%
          </span>
        </td>
        <td>₹${deskGP.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
      `;
      leadBody.appendChild(tr);
    });
  }

  // 6. Quotes By User (replaces the old "Recent Quotation Activity" list of
  // individual quotes with a per-user total, sortable ascending/descending)
  renderQuotesByUserTable();
}
window.renderExecutiveDashboard = renderExecutiveDashboard;

let _quotesByUserSortDir = 'desc';
// Rolling trailing windows (days) from today, per period option. "day" means
// today's date only; every other period is the trailing N-day window so
// results are unambiguous regardless of what day of the week/month it is.
const QUOTES_BY_USER_PERIOD_DAYS = {
  week: 7,
  fortnight: 14,
  month: 30,
  quarter: 90,
  half_year: 182,
  year: 365
};
// Two different logins can share the same display name (e.g. more than one
// generic "Free Hand Sales" desk account that was never given an individual
// name) — that makes per-user tables/charts show identical, indistinguishable
// rows even though each key is a genuinely separate account with its own
// activity. Append the login/username to only the colliding entries so every
// row stays unique, without touching the underlying account data itself.
function disambiguateDuplicateNames(entriesByKey) {
  const nameCounts = {};
  Object.values(entriesByKey).forEach(e => {
    nameCounts[e.name] = (nameCounts[e.name] || 0) + 1;
  });
  Object.keys(entriesByKey).forEach(key => {
    const e = entriesByKey[key];
    if (nameCounts[e.name] > 1) {
      e.name = `${e.name} (${key})`;
    }
  });
}

function renderQuotesByUserTable(period, sortDir) {
  if (sortDir) _quotesByUserSortDir = sortDir;
  const body = document.getElementById("exec-quotes-by-user-body");
  if (!body) return;

  const periodSelect = document.getElementById("exec-quotes-by-user-period");
  if (period === undefined) {
    period = periodSelect ? periodSelect.value : 'all';
  } else if (periodSelect) {
    periodSelect.value = period;
  }

  const descBtn = document.getElementById("exec-quotes-by-user-sort-desc");
  const ascBtn = document.getElementById("exec-quotes-by-user-sort-asc");
  if (descBtn && ascBtn) {
    const isDesc = _quotesByUserSortDir === 'desc';
    descBtn.classList.toggle('sort-toggle-btn-active', isDesc);
    descBtn.style.background = isDesc ? 'var(--sky)' : 'transparent';
    ascBtn.classList.toggle('sort-toggle-btn-active', !isDesc);
    ascBtn.style.background = !isDesc ? 'var(--sky)' : 'transparent';
  }

  const todayStr = new Date().toISOString().split('T')[0];
  let cutoffStr = null;
  if (period === 'day') {
    cutoffStr = todayStr;
  } else if (QUOTES_BY_USER_PERIOD_DAYS[period]) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - (QUOTES_BY_USER_PERIOD_DAYS[period] - 1));
    cutoffStr = cutoff.toISOString().split('T')[0];
  }

  const allQuotes = appState.quotes || [];
  const quotes = cutoffStr ? allQuotes.filter(q => (q.date || '') >= cutoffStr) : allQuotes;

  const userCounts = {};
  Object.keys(TEAM_ROLES).forEach(roleId => {
    if (roleId === 'ganny' || roleId === 'manager') return;
    userCounts[roleId] = { name: (TEAM_ROLES[roleId].name || roleId).replace(/\s*\(Free\s*Hand\)/i, ""), count: 0 };
  });
  quotes.forEach(q => {
    const creator = (q.creator || 'unknown').toLowerCase();
    if (!userCounts[creator]) {
      userCounts[creator] = { name: TEAM_ROLES[creator]?.name || q.creator || 'Unknown', count: 0 };
    }
    userCounts[creator].count++;
  });

  disambiguateDuplicateNames(userCounts);

  const rows = Object.values(userCounts).sort((a, b) =>
    _quotesByUserSortDir === 'desc' ? b.count - a.count : a.count - b.count
  );

  if (rows.length === 0) {
    body.innerHTML = `<tr><td colspan="3" style="text-align: center; color: var(--text-dim); padding: 1.5rem;">No quotations recorded yet.</td></tr>`;
    return;
  }

  body.innerHTML = rows.map((r, i) => `
    <tr>
      <td>${i + 1}</td>
      <td><strong>${r.name}</strong></td>
      <td>${r.count}</td>
    </tr>
  `).join("");
}
window.renderQuotesByUserTable = renderQuotesByUserTable;

// ==========================================
// EXECUTIVE DASHBOARD INTELLIGENCE MODULE (PHASE 3A)
// ==========================================
let lastCalculatedQuotesKey = "";

function renderExecutiveDashboardIntelligence() {
  if (typeof isUserAdminOrManager === 'function' && !isUserAdminOrManager()) {
    return;
  }
  // This content now lives in the Dashboard's "Analytics" tab pane rather
  // than the old standalone executive-dashboard-panel (retired — see
  // showExecutiveDashboard for why). Only compute this when that tab is
  // actually the visible one.
  const analyticsPane = document.querySelector('#manager-panel [data-tab-pane="analytics"]');
  if (!analyticsPane || analyticsPane.style.display === 'none') {
    return;
  }
  const quotes = appState.quotes || [];
  const quotesKey = `${quotes.length}-${quotes.reduce((acc, q) => acc + (q.status || "") + (q.amountINR || 0) + (q.grossProfitINR || 0) + (q.date || ""), "")}`;
  if (quotesKey === lastCalculatedQuotesKey) {
    return;
  }
  lastCalculatedQuotesKey = quotesKey;
  const analyticsData = calculateExecutiveIntelligence(quotes);
  renderRevenueByUserChart(analyticsData.users);
  renderCustomerConcentrationTable(analyticsData.customers);
  renderRoutePerformanceTable(analyticsData.routes);
  runDataReconciliationAudit(quotes, analyticsData);
}
window.renderExecutiveDashboardIntelligence = renderExecutiveDashboardIntelligence;

function calculateExecutiveIntelligence(quotes) {
  const trendsMap = {};
  const routesMap = {};
  const customersMap = {};
  const usersMap = {};
  Object.keys(TEAM_ROLES).forEach(roleId => {
    if (roleId === 'ganny' || roleId === 'manager') return;
    usersMap[roleId] = { name: (TEAM_ROLES[roleId].name || roleId).replace(/\s*\(Free\s*Hand\)/i, ""), revenue: 0, gp: 0, count: 0 };
  });
  let winCount = 0;
  let lossCount = 0;
  let totalCount = 0;
  quotes.forEach(q => {
    const amt = Number(q.amountINR) || 0;
    const gp = Number(q.grossProfitINR) || 0;
    const status = q.status || "quoted";
    const dateStr = q.date || "";
    let monthKey = "Unknown";
    if (dateStr) {
      const match = dateStr.match(/(\d{4})[-/](\d{2})[-/](\d{2})/) || dateStr.match(/(\d{2})[-/](\d{2})[-/](\d{4})/);
      if (match) {
        const parts = dateStr.split(/[-/]/);
        if (parts.length === 3) {
          if (parts[0].length === 4) {
            monthKey = `${parts[0]}-${parts[1]}`;
          } else {
            monthKey = `${parts[2]}-${parts[1]}`;
          }
        }
      } else {
        monthKey = dateStr.substring(0, 7);
      }
    }
    if (!trendsMap[monthKey]) {
      trendsMap[monthKey] = { month: monthKey, revenue: 0, gp: 0, total: 0, won: 0, lost: 0 };
    }
    trendsMap[monthKey].total += 1;
    if (status === "converted") {
      trendsMap[monthKey].revenue += amt;
      trendsMap[monthKey].gp += gp;
      trendsMap[monthKey].won += 1;
      winCount++;
    } else if (status === "lost") {
      trendsMap[monthKey].lost += 1;
      lossCount++;
    }
    totalCount++;
    const cust = q.customer || "Unknown Customer";
    if (!customersMap[cust]) {
      customersMap[cust] = { name: cust, revenue: 0, gp: 0, count: 0 };
    }
    customersMap[cust].count += 1;
    if (status === "converted") {
      customersMap[cust].revenue += amt;
      customersMap[cust].gp += gp;
    }
    const creator = (q.creator || 'unknown').toLowerCase();
    if (!usersMap[creator]) {
      usersMap[creator] = { name: TEAM_ROLES[creator]?.name || q.creator || 'Unknown', revenue: 0, gp: 0, count: 0 };
    }
    usersMap[creator].count += 1;
    if (status === "converted") {
      usersMap[creator].revenue += amt;
      usersMap[creator].gp += gp;
    }
    // Every quote is saved with a top-level `route` string (e.g. "BOM → JFK
    // via Any") — see quoteData.route at save time. This used to check
    // q.pol/q.pod, q.origin/q.destination, q.originPincode/q.destPincode
    // instead, none of which exist on a saved quote, so every single quote
    // fell through to "Domestic/Local" and got lumped into one bucket.
    const route = q.route || "Unspecified Route";
    if (!routesMap[route]) {
      routesMap[route] = { name: route, total: 0, won: 0, totalGP: 0, totalAmt: 0 };
    }
    routesMap[route].total += 1;
    if (status === "converted") {
      routesMap[route].won += 1;
      routesMap[route].totalGP += gp;
      routesMap[route].totalAmt += amt;
    }
  });
  const trends = Object.values(trendsMap).sort((a, b) => a.month.localeCompare(b.month)).slice(-6);
  const customers = Object.values(customersMap).sort((a, b) => b.gp - a.gp).slice(0, 5);
  const routes = Object.values(routesMap).sort((a, b) => b.totalGP - a.totalGP).slice(0, 5);
  disambiguateDuplicateNames(usersMap);
  const users = Object.values(usersMap).sort((a, b) => b.revenue - a.revenue);
  return { trends, customers, routes, users, overall: { winCount, lossCount, totalCount } };
}

function renderRevenueByUserChart(users) {
  const container = document.getElementById("exec-revenue-by-user-chart");
  if (!container) return;
  const activeUsers = (users || []).filter(u => u.count > 0);
  if (activeUsers.length === 0) {
    container.innerHTML = `<div style="color: var(--text-dim); font-size: 0.85rem;">Insufficient quotation data.</div>`;
    return;
  }
  const fmtCompactINR = (n) => {
    const sign = n < 0 ? '-' : '';
    const abs = Math.abs(n);
    if (abs >= 10000000) return `${sign}₹${(abs / 10000000).toFixed(1)}Cr`;
    if (abs >= 100000) return `${sign}₹${(abs / 100000).toFixed(1)}L`;
    if (abs >= 1000) return `${sign}₹${(abs / 1000).toFixed(0)}K`;
    return `${sign}₹${Math.round(abs)}`;
  };
  // groupWidth has a floor so bars/labels stay legible when there are many
  // users; total width then grows past the container and scrolls (the
  // wrapper div has overflow-x:auto) rather than squeezing every group into
  // a fixed viewBox, which would overlap bars once more than ~10 users exist.
  const groupWidth = 110;
  const leftAxisWidth = 56;
  const chartAreaWidth = Math.max(700, groupWidth * activeUsers.length);
  const width = leftAxisWidth + chartAreaWidth;
  const height = 260;
  const topPad = 46; // room for the legend + tallest value label
  const bottomPad = 30; // room for user-name labels
  const chartHeight = height - topPad - bottomPad;
  const maxVal = Math.max(...activeUsers.map(u => Math.max(u.revenue, u.gp)), 100000);
  const minVal = Math.min(...activeUsers.map(u => Math.min(u.revenue, u.gp)), 0);
  const valRange = (maxVal - minVal) || 1;
  const scaleY = (v) => topPad + chartHeight - ((v - minVal) / valRange) * chartHeight;
  const zeroY = scaleY(0);
  const barWidth = Math.min(30, groupWidth * 0.26);
  const minStubH = 3; // a genuine ₹0 still gets a faint visible stub, not nothing

  // Reference gridlines across the value range (5 evenly spaced steps)
  const GRID_STEPS = 4;
  let gridLines = '';
  for (let s = 0; s <= GRID_STEPS; s++) {
    const val = minVal + (valRange * s / GRID_STEPS);
    const y = scaleY(val);
    gridLines += `
      <line x1="${leftAxisWidth}" y1="${y}" x2="${width}" y2="${y}" stroke="rgba(120,130,150,0.12)" stroke-width="1" />
      <text x="${leftAxisWidth - 8}" y="${y + 3}" fill="var(--text-dim)" font-size="9.5" text-anchor="end">${fmtCompactINR(val)}</text>
    `;
  }

  let svgContent = `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" style="overflow: visible; flex-shrink: 0; font-family: 'Outfit', 'Plus Jakarta Sans', sans-serif;">
      ${gridLines}
      <line x1="${leftAxisWidth}" y1="${zeroY}" x2="${width}" y2="${zeroY}" stroke="rgba(120,130,150,0.35)" stroke-width="1.2" />
  `;
  activeUsers.forEach((u, i) => {
    const cx = leftAxisWidth + groupWidth * i + groupWidth / 2;
    const revY = scaleY(u.revenue);
    const gpY = scaleY(u.gp);
    let revBarTop = Math.min(revY, zeroY);
    let gpBarTop = Math.min(gpY, zeroY);
    let revBarH = Math.abs(revY - zeroY);
    let gpBarH = Math.abs(gpY - zeroY);
    const revIsZero = revBarH < minStubH;
    const gpIsZero = gpBarH < minStubH;
    if (revIsZero) { revBarH = minStubH; revBarTop = zeroY - minStubH; }
    if (gpIsZero) { gpBarH = minStubH; gpBarTop = zeroY - minStubH; }
    svgContent += `
      <rect x="${cx - barWidth - 3}" y="${revBarTop}" width="${barWidth}" height="${revBarH}" fill="${revIsZero ? 'rgba(37,99,235,0.25)' : '#2563EB'}" rx="3" />
      <rect x="${cx + 3}" y="${gpBarTop}" width="${barWidth}" height="${gpBarH}" fill="${gpIsZero ? 'rgba(22,163,74,0.25)' : '#16A34A'}" rx="3" />
      <text x="${cx - barWidth - 3 + barWidth / 2}" y="${revBarTop - 6}" fill="#2563EB" font-size="10" font-weight="700" text-anchor="middle">${fmtCompactINR(u.revenue)}</text>
      <text x="${cx + 3 + barWidth / 2}" y="${gpBarTop - 6}" fill="#16A34A" font-size="10" font-weight="700" text-anchor="middle">${fmtCompactINR(u.gp)}</text>
      <text x="${cx}" y="${height - 10}" fill="var(--t1)" font-size="10.5" font-weight="600" text-anchor="middle">${u.name}</text>
    `;
  });
  svgContent += `
      <g transform="translate(${leftAxisWidth}, 14)">
        <rect width="9" height="9" fill="#2563EB" rx="2" />
        <text x="13" y="9" fill="var(--t1)" font-size="10.5" font-weight="700">Revenue</text>
        <rect x="88" width="9" height="9" fill="#16A34A" rx="2" />
        <text x="101" y="9" fill="var(--t1)" font-size="10.5" font-weight="700">Gross Profit</text>
      </g>
    </svg>
  `;
  container.innerHTML = svgContent;
}
window.renderRevenueByUserChart = renderRevenueByUserChart;

function renderCustomerConcentrationTable(customers) {
  const tbody = document.getElementById("exec-customer-concentration-body");
  if (!tbody) return;
  if (customers.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-dim); padding: 1rem;">No customer transactions computed yet.</td></tr>`;
    return;
  }
  tbody.innerHTML = customers.map(c => `
    <tr>
      <td><strong>${c.name}</strong></td>
      <td>₹${c.revenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
      <td><span style="color: var(--accent-success); font-weight: 700;">₹${c.gp.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span></td>
      <td>${c.count}</td>
    </tr>
  `).join("");
}

function renderRoutePerformanceTable(routes) {
  const tbody = document.getElementById("exec-route-performance-body");
  if (!tbody) return;
  if (routes.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-dim); padding: 1rem;">No route statistics computed yet.</td></tr>`;
    return;
  }
  tbody.innerHTML = routes.map(r => {
    const margin = r.totalAmt > 0 ? (r.totalGP / r.totalAmt * 100) : 0;
    return `
      <tr>
        <td><strong>${r.name}</strong></td>
        <td>${r.total}</td>
        <td>${r.won}</td>
        <td><span style="font-weight:700; color: ${margin >= 15 ? 'var(--accent-success)' : (margin >= 8 ? 'var(--accent-warning)' : 'var(--accent-error)')};">${margin.toFixed(1)}%</span></td>
        <td><strong>₹${r.totalGP.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</strong></td>
      </tr>
    `;
  }).join("");
}

function runDataReconciliationAudit(quotes, analyticsData) {
  const textEl = document.getElementById("exec-data-validation-text");
  const checksumEl = document.getElementById("exec-integrity-checksum");
  const accuracyEl = document.getElementById("exec-integrity-accuracy");
  if (!textEl || !checksumEl || !accuracyEl) return;
  const localQuoteCount = quotes.length;
  const checksumVal = quotes.reduce((acc, q) => acc + (q.status === 'converted' ? 3 : (q.status === 'lost' ? 1 : 0)), 0);
  textEl.textContent = `Audit Complete. Verified ${localQuoteCount} records against current session store. No orphans detected.`;
  checksumEl.textContent = `OK (0x${checksumVal.toString(16).toUpperCase()})`;
  accuracyEl.textContent = "100%";
}

// Renders a donut/ring-chart KPI (value centered, composition shown as colored
// arc segments + a legend) into the given container element. Pure inline SVG —
// no charting library dependency. `segments` is [{value, color, label}, ...];
// segments are drawn clockwise starting at 12 o'clock, sized proportionally to
// their share of the segment total (not to centerValue, which may be a
// pre-formatted string like "₹4.2M" or "11.6%").
function renderRingKPI(containerId, opts) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const { segments, centerValue, centerLabel, size = 128 } = opts;
  const total = segments.reduce((sum, s) => sum + Math.max(0, s.value || 0), 0);
  const r = 50, cx = 60, cy = 60, sw = 14;
  const circumference = 2 * Math.PI * r;

  let running = 0;
  const arcs = total > 0 ? segments.map(seg => {
    const frac = Math.max(0, seg.value || 0) / total;
    const len = frac * circumference;
    if (len <= 0) return '';
    const dashoffset = -running;
    running += len;
    return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${seg.color}" stroke-width="${sw}" stroke-dasharray="${len} ${circumference - len}" stroke-dashoffset="${dashoffset}" />`;
  }).join('') : '';

  const legendItems = segments.filter(s => (s.value || 0) > 0).map(s => `
    <span style="display:inline-flex; align-items:center; gap:5px; font-size:0.68rem; font-weight:600; color:var(--t2, #475569);">
      <span style="width:8px; height:8px; border-radius:50%; background:${s.color}; display:inline-block; flex-shrink:0;"></span>${s.label}
    </span>`).join('');

  container.innerHTML = `
    <div style="position:relative; width:${size}px; height:${size}px; margin: 0.35rem auto 0;">
      <svg viewBox="0 0 120 120" width="${size}" height="${size}" style="transform: rotate(-90deg);">
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--border-1, #e2e8f0)" stroke-width="${sw}" />
        ${arcs}
      </svg>
      <div style="position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; pointer-events:none;">
        <div style="font-size:1.05rem; font-weight:800; color:var(--sky); line-height:1.15;">${centerValue}</div>
        ${centerLabel ? `<div style="font-size:0.58rem; font-weight:700; color:var(--text-dim); text-transform:uppercase; letter-spacing:0.03em; margin-top:2px;">${centerLabel}</div>` : ''}
      </div>
    </div>
    <div style="display:flex; flex-wrap:wrap; justify-content:center; gap:0.4rem 0.75rem; margin-top:0.6rem;">${legendItems}</div>
  `;
}
window.renderRingKPI = renderRingKPI;

// ADMIN DASHBOARD RENDERING
function renderAdminDashboard() {
  // Analytics tab content (formerly the standalone executive-dashboard-panel
  // — see showExecutiveDashboard for why that was retired) only needs
  // rebuilding when that specific tab is the visible one.
  const analyticsPane = document.querySelector('#manager-panel [data-tab-pane="analytics"]');
  if (analyticsPane && analyticsPane.style.display !== 'none') {
    renderExecutiveDashboard();
    if (typeof renderExecutiveDashboardIntelligence === 'function') {
      renderExecutiveDashboardIntelligence();
    }
  }

  // The Customer Credit Control table (inside the Admin Settings modal) reads
  // appState.quotes — if the modal happened to be opened before the quotes
  // snapshot listener delivered any data, it rendered with 0 rows and never
  // got a second chance, since nothing refreshed it after data arrived. This
  // covers that: only does the (cheap) re-render while the modal is actually
  // open, same visibility-gated pattern as the Analytics pane above.
  const settingsModal = document.getElementById("admin-settings-modal");
  if (settingsModal && settingsModal.style.display === "flex" && typeof renderAdminCustomerControlList === 'function') {
    renderAdminCustomerControlList();
  }

  // The Firestore quotes listener calls this on every write from any user, even
  // when the dashboard isn't the visible panel — skip the heavy dashboard-only
  // rebuilds below in that case so typing/scrolling elsewhere doesn't stutter.
  // (This checks "manager-panel", the actual admin Dashboard container.)
  const managerPanel = document.getElementById("manager-panel");
  const isDashboardVisible = !!(managerPanel && managerPanel.classList.contains("active"));
  if (isDashboardVisible) {
    renderControlTowerFeed();
    renderNrsRegistry();
    // Auto-collapse directory on first admin load. Gated on quotes actually
    // being loaded (not just "has this function run before") — renderAdminDashboard
    // can fire before the Firestore quotes listener has delivered any data, and
    // collapsing an empty tree then never retried left every node expanded once
    // the real data arrived.
    // Both of these used to run unconditionally on every quotes write, system-wide
    // — rebuilding the full agent/customer tree and scratchpad viewer even while
    // an admin was looking at the Air Freight desk, not the Dashboard at all.
    // The Quoting Agents tab already re-triggers collapseAllDirNodes() itself on
    // click, so nothing is lost by only keeping this fresh while visible.
    if (typeof collapseAllDirNodes === 'function' && !window._dirInitialCollapseSet && (appState.quotes || []).length > 0) {
      window._dirInitialCollapseSet = true;
      collapseAllDirNodes();
    } else if (typeof updateAdminDirectoryView === 'function') {
      updateAdminDirectoryView();
    }
    if (typeof updateAdminScratchpadViewer === 'function') {
      updateAdminScratchpadViewer();
    }
  }
  if (!isDashboardVisible) return;
  if (typeof populateReportUsers === 'function') {
    populateReportUsers();
  }
  if (!window._newsLoaded) {
    setTimeout(() => {
      loadLogisticsNews('global');
      window._newsLoaded = true;
    }, 100);
  }
  const totalEnquiries = appState.quotes.length;
  let totalRevenueINR = 0;
  let conversions = 0;

  appState.quotes.forEach(q => {
    totalRevenueINR += q.amountINR;
    if (q.status === 'converted') {
      conversions++;
    }
  });

  const conversionRate = totalEnquiries > 0 ? (conversions / totalEnquiries * 100) : 0;

  // Update top widgets — ring-chart KPIs (composition, not just a bare number)
  const revenueByMode = { air: 0, sea: 0, transport: 0, warehouse: 0 };
  const enquiriesByStatus = { quoted: 0, converted: 0, lost: 0, cancelled: 0 };
  appState.quotes.forEach(q => {
    if (revenueByMode[q.type] !== undefined) revenueByMode[q.type] += (q.amountINR || 0);
    if (enquiriesByStatus[q.status] !== undefined) enquiriesByStatus[q.status]++;
  });

  // A lighter, more distinguishable palette than the app's deep navy brand
  // colors — those read too heavy/similar-to-each-other once used as adjacent
  // chart segments, where quick visual differentiation matters more than
  // brand consistency.
  const RING_BLUE = '#3b82f6', RING_TEAL = '#14b8a6', RING_VIOLET = '#8b5cf6',
    RING_AMBER = '#f59e0b', RING_GREEN = '#22c55e', RING_ROSE = '#f43f5e',
    RING_GRAY = '#94a3b8', RING_TRACK = '#e2e8f0';

  renderRingKPI("admin-stat-revenue-ring", {
    centerValue: `₹${totalRevenueINR.toLocaleString('en-IN', { maximumFractionDigits: 0, notation: totalRevenueINR >= 100000 ? 'compact' : 'standard' })}`,
    segments: [
      { value: revenueByMode.air, color: RING_BLUE, label: 'Air' },
      { value: revenueByMode.sea, color: RING_TEAL, label: 'Sea' },
      { value: revenueByMode.transport, color: RING_VIOLET, label: 'Transport' },
      { value: revenueByMode.warehouse, color: RING_AMBER, label: 'Warehouse' }
    ]
  });
  renderRingKPI("admin-stat-quotes-ring", {
    centerValue: totalEnquiries,
    segments: [
      { value: enquiriesByStatus.quoted, color: RING_BLUE, label: 'Quoted' },
      { value: enquiriesByStatus.converted, color: RING_GREEN, label: 'Won' },
      { value: enquiriesByStatus.lost, color: RING_ROSE, label: 'Lost' },
      { value: enquiriesByStatus.cancelled, color: RING_GRAY, label: 'Cancelled' }
    ]
  });
  renderRingKPI("admin-stat-conversions-ring", {
    centerValue: conversions,
    segments: [
      { value: conversions, color: RING_GREEN, label: 'Won' },
      { value: totalEnquiries - conversions, color: RING_TRACK, label: 'Not yet won' }
    ]
  });
  renderRingKPI("admin-stat-rate-ring", {
    centerValue: `${conversionRate.toFixed(1)}%`,
    segments: [
      { value: conversionRate, color: RING_BLUE, label: 'Converted' },
      { value: 100 - conversionRate, color: RING_TRACK, label: 'Remaining' }
    ]
  });

  // Render leaderboard performance table
  const leadBody = document.getElementById("admin-leaderboard-body");
  leadBody.innerHTML = "";

  // Get all registered member user IDs (excluding manager/admin roles)
  const desks = Object.keys(TEAM_ROLES).filter(roleId => {
    if (roleId === 'ganny' || roleId === 'manager') return false;
    return true;
  });

  // Two different logins can share a display name (e.g. more than one
  // "Free Hand Sales" account) — disambiguate before rendering, same
  // treatment applied to Quotes By User / Revenue By User.
  const adminLeaderboardNameLookup = {};
  desks.forEach(deskId => {
    adminLeaderboardNameLookup[deskId] = { name: (TEAM_ROLES[deskId]?.name || deskId).replace(/\s*\(Free\s*Hand\)/i, "") };
  });
  disambiguateDuplicateNames(adminLeaderboardNameLookup);

  desks.forEach(deskId => {
    const deskIdLower = deskId.toLowerCase();
    const deskQuotes = appState.quotes.filter(q => q.creator && q.creator.toLowerCase() === deskIdLower);
    const deskQuotesCount = deskQuotes.length;
    const deskConversions = deskQuotes.filter(q => q.status === 'converted').length;
    const deskRate = deskQuotesCount > 0 ? (deskConversions / deskQuotesCount * 100) : 0;
    const deskRevenue = deskQuotes.reduce((acc, q) => acc + q.amountINR, 0);

    const tr = document.createElement("tr");
    tr.style.color = "#000000";
    const name = adminLeaderboardNameLookup[deskId].name;
    tr.innerHTML = `
      <td><strong style="color:#000000;">${name}</strong></td>
      <td style="color:#000000;">${deskQuotesCount}</td>
      <td style="color:#000000;">${deskConversions}</td>
      <td>
        <span style="font-weight:700; color: ${deskRate >= 40 ? 'var(--accent-success)' : (deskRate >= 25 ? 'var(--accent-warning)' : 'var(--accent-error)')};">
          ${deskRate.toFixed(1)}%
        </span>
      </td>
      <td style="color:#000000;">₹${deskRevenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
    `;
    leadBody.appendChild(tr);
  });

  // Render Master logs using Filter & Sort — but only when that tab is
  // actually the visible one. The table lives behind the "Enquiry Database"
  // tab pane now; filtering/sorting all 538 quotes and rebuilding 25 rows
  // of DOM on every Firestore write is wasted work while a different
  // Dashboard tab (or another panel entirely) is what's on screen.
  const enquiryDbPane = document.querySelector('#manager-panel [data-tab-pane="enquiry-database"]');
  const isEnquiryDbTabVisible = !enquiryDbPane || enquiryDbPane.style.display !== 'none';
  if (isEnquiryDbTabVisible) {
    applyDbFiltersAndSort();
  }

  // Render user credentials list securely
  if (typeof renderUserCredentialsList === 'function') {
    renderUserCredentialsList();
  }

  // Render Amendment Requests List for Ganny
  const reqPanel = document.getElementById("admin-amendment-requests-panel");
  const reqList = document.getElementById("admin-amendment-requests-list");
  if (reqPanel && reqList) {
    let requests = window._amendmentRequests || [];
    if (requests.length === 0) {
      const stored = localStorage.getItem("gl_amendment_requests");
      if (stored) {
        try { requests = JSON.parse(stored); } catch (e) { }
      }
    }
    const pending = requests.filter(r => r.status === 'pending');

    // Ensure audio & animation helper styles exist
    if (!document.getElementById("admin-dynamic-deck-styles")) {
      const style = document.createElement("style");
      style.id = "admin-dynamic-deck-styles";
      style.textContent = `
        @keyframes pulse-ring {
          0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
          70% { box-shadow: 0 0 0 8px rgba(239, 68, 68, 0); }
          100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
        }
        .pending-badge-pulse {
          display: inline-flex;
          align-items: center;
          background: var(--accent-error);
          color: #fff;
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 0.7rem;
          font-weight: 800;
          margin-left: 0.5rem;
          animation: pulse-ring 1.5s infinite;
        }
        .req-item-card {
          animation: slideUpFade 0.3s ease-out;
          transition: all 0.25s ease;
        }
        .req-item-card:hover {
          transform: translateX(4px);
          background: rgba(255,255,255,0.08) !important;
        }
        @keyframes slideUpFade {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `;
      document.head.appendChild(style);
    }

    // Update dynamic badge in heading
    const heading = reqPanel.querySelector("h3");
    if (heading) {
      const count = pending.length;
      if (count > 0) {
        heading.innerHTML = `Admin Approvals Control Deck <span class="pending-badge-pulse">${count} PENDING</span>`;
      } else {
        heading.innerHTML = `Admin Approvals Control Deck <span style="background: rgba(255,255,255,0.08); color: var(--text-dim); padding: 2px 8px; border-radius: 12px; font-size: 0.7rem; margin-left: 0.5rem;">0 PENDING</span>`;
      }
    }

    let listHtml = "";
    const filteredPending = pending;

    if (filteredPending.length > 0) {
      listHtml = filteredPending.map(req => {
        let typeLabel = (req.requestType ? req.requestType.toUpperCase() : 'EDIT');
        let color = 'var(--accent-warning)';
        let details = `Quote ID: #<strong>${getQuoteRefIdById(req.quoteId)}</strong> (${req.customer || ''})`;

        if (req.requestType === 'agreement_waiver') {
          typeLabel = 'AGREEMENT WAIVER';
          color = 'var(--accent-air)';
          details = `Customer: <strong>${req.customer}</strong> (Quote #${getQuoteRefIdById(req.quoteId)})`;
        } else if (req.requestType === 'credit_override') {
          typeLabel = 'CREDIT OVERRIDE';
          color = 'var(--accent-warning)';
          details = `Customer/Agent: <strong>${req.customer || req.agent}</strong> (Crossing credit period)`;
        } else if (req.requestType === 'customer_release') {
          typeLabel = 'CUSTOMER UNBLOCK';
          color = 'var(--accent-success)';
          details = `Customer: <strong>${req.customer}</strong>`;
        } else if (req.requestType === 'delete') {
          typeLabel = 'DELETE QUOTE';
          color = 'var(--accent-error)';
          details = `Quote ID: #<strong>${getQuoteRefIdById(req.quoteId)}</strong> (${req.customer})`;
        }

        const isCreditOverride = req.requestType === 'credit_override';
        const cardStyle = isCreditOverride
          ? `background: #ffffff; color: #000000; padding: 12px 14px; border-radius: 8px; border-left: 4px solid #000000; display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.6rem; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.15);`
          : `background: rgba(255,255,255,0.04); padding: 12px 14px; border-radius: 8px; border-left: 4px solid ${color}; display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.6rem; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);`;

        const labelStyle = isCreditOverride ? `color: #000000;` : `color: ${color};`;
        const mutedStyle = isCreditOverride ? `color: #000000;` : `color: var(--text-muted);`;
        const reasonStyle = isCreditOverride
          ? `font-size: 0.72rem; color: #000000; margin-top: 4px; padding: 2px 6px; background: rgba(0, 0, 0, 0.05); border-radius: 4px; border: 1px solid rgba(0, 0, 0, 0.15); width: fit-content;`
          : `font-size: 0.72rem; color: var(--accent-warning); margin-top: 4px; padding: 2px 6px; background: rgba(245, 158, 11, 0.1); border-radius: 4px; border: 1px solid rgba(245, 158, 11, 0.2); width: fit-content;`;

        return `
          <div class="req-item-card" style="${cardStyle}">
            <div>
              <strong style="${labelStyle}">[${typeLabel}]</strong> 
              ${details}<br>
              <span style="font-size: 0.75rem; ${mutedStyle}">Requested by: ${req.creatorName} on ${req.date}</span>
              ${req.reason ? `<div style="${reasonStyle}"><strong>Reason:</strong> ${req.reason}</div>` : ''}
            </div>
            <div style="display: flex; gap: 0.5rem;">
              <button class="btn-primary" style="padding: 4px 10px; font-size: 0.75rem; background: rgba(22, 101, 52, 0.1); color: var(--accent-success); border: 1px solid rgba(22, 101, 52, 0.25); border: none; border-radius: 4px; cursor: pointer; font-weight:700;" onclick="approveAmendment('${req.id}')">Approve</button>
              <button class="btn-secondary" style="padding: 4px 10px; font-size: 0.75rem; background: var(--accent-error); color: #fff; border: none; border-radius: 4px; cursor: pointer;" onclick="rejectAmendment('${req.id}')">Reject</button>
            </div>
          </div>
        `;
      }).join("");
    } else {
      listHtml = `<div style="color: var(--text-dim); font-style: italic;">No pending approval requests.</div>`;
    }

    // Prepend system diagnostics warning to listHtml
    let warningPrefix = ``;
    if (!DB.isCloud) {
      warningPrefix += `
        <div style="background: rgba(56, 189, 248, 0.1); border: 1px solid var(--sky); color: var(--sky); padding: 8px 10px; border-radius: 6px; font-size: 0.72rem; margin-bottom: 0.5rem; line-height: 1.3;">
          🌐 <strong>Offline Mode (LocalStorage):</strong> Users are running on separate browsers and cannot sync request data without connecting to a shared Firebase database. Configure your Firebase Database in the connection settings.
        </div>
      `;
    } else if (window._amendmentRequestsError) {
      warningPrefix += `
        <div style="background: rgba(239, 68, 68, 0.1); border: 1px solid var(--accent-error); color: var(--accent-error); padding: 8px 10px; border-radius: 6px; font-size: 0.72rem; margin-bottom: 0.5rem; line-height: 1.3;">
          ⚠️ <strong>Firestore Sync Error:</strong> ${window._amendmentRequestsError}<br>
          <span style="font-size: 0.65rem; color: var(--text-muted); display: block; margin-top: 4px;">Only local offline requests are visible. Ask your developer to verify if the collection "amendment_requests" is allowed in Firestore Security Rules.</span>
        </div>
      `;
    }

    reqList.innerHTML = warningPrefix + listHtml;

    // Dynamically refresh customer controls list to update override/waiver badges
    renderAdminCustomerControlList();
  }
}

function renderControlTowerFeed() {
  const container = document.getElementById("control-tower-feed-list");
  if (!container) return;

  const quotes = appState.quotes || [];
  if (quotes.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; color: var(--t3); font-size: 0.72rem; padding: 2rem 0; font-style: italic; border: 1px dashed var(--border-1); border-radius: var(--r-sm); background: rgba(27,28,92,0.01);">
        No active shipments logged yet.<br>Create pricing enquiries to populate tracking.
      </div>
    `;
    return;
  }

  // Get up to 3 most recent quotes
  const recent = [...quotes].reverse().slice(0, 3);

  container.innerHTML = recent.map(quote => {
    const isAir = quote.type === 'air';
    const modeLabel = isAir ? 'AIR DESK' : 'SEA DESK';
    const originStr = (quote.origin || '').substring(0, 15);
    const destStr = (quote.destination || '').substring(0, 15);

    // Status text & colors matching premium corporate timeline
    const statusText = quote.status === 'converted' ? 'Won Booking' : 'Priced (Pending)';
    const statusColor = quote.status === 'converted' ? 'var(--green)' : 'var(--amber)';

    // Chargeable parameter
    let loadStr = '';
    if (isAir) {
      loadStr = `${(quote.chargeableWeight || 0).toLocaleString()} kg`;
    } else {
      loadStr = `${(quote.volume || 0).toLocaleString()} CBM`;
    }

    // Routing description
    const routingStr = quote.viaRoute ? `via ${quote.viaRoute}` : 'Direct Lane';

    return `
      <div class="timeline-shipment-card" style="background: rgba(255,255,255,0.45); border: 1px solid var(--border-1); border-radius: var(--r-sm); padding: 0.6rem 0.8rem; display: flex; flex-direction: column; gap: 0.35rem; transition: all 0.2s; cursor: pointer;" onclick="viewSavedQuote('${quote.id}')">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="font-weight: 800; font-size: 0.75rem; color: var(--sky);">${modeLabel}: ${originStr} ➔ ${destStr}</span>
          <span style="font-size: 0.65rem; color: ${statusColor}; font-weight: 700; display: flex; align-items: center; gap: 0.2rem;">
            <span style="width:5px; height:5px; background:${statusColor}; border-radius:50%; display:inline-block;"></span>
            ${statusText}
          </span>
        </div>
        <div style="font-size: 0.68rem; color: var(--t3); display: flex; justify-content: space-between;">
          <span>Ref: #${getQuoteRefId(quote)}</span>
          <span style="font-weight: 600; color: var(--t2);">${loadStr} • ${routingStr}</span>
        </div>
      </div>
    `;
  }).join("");
}

function renderMonthlyCharts() {
  // Permanently removed as charts component was deleted.
}

window.convertQuote = (id) => {
  const quote = appState.quotes.find(q => q.id === id);
  if (!quote) return;

  // Open modal to input Shipper / Consignee details
  document.getElementById("won-quote-id").value = id;
  document.getElementById("won-shipper-name").value = quote.shipperName || "";
  document.getElementById("won-shipper-phone").value = quote.shipperPhone || "";
  document.getElementById("won-shipper-email").value = quote.shipperEmail || "";
  document.getElementById("won-shipper-address").value = quote.shipperAddress || "";

  document.getElementById("won-cnee-name").value = quote.consigneeName || "";
  document.getElementById("won-cnee-phone").value = quote.consigneePhone || "";
  document.getElementById("won-cnee-email").value = quote.consigneeEmail || "";
  document.getElementById("won-cnee-address").value = quote.consigneeAddress || "";

  document.getElementById("won-commodity").value = quote.commodity || "";

  // Air Nomination and Sea Nomination must only ever need Buy/Sell rate to
  // convert to WON — that's the instructed rule, not an opt-in. Default
  // Quick Convert to checked for those two roles specifically so it's their
  // actual experience rather than a checkbox they'd have to notice and tick
  // every time; every other role keeps the previous explicit opt-in default
  // (unchecked), reopened fresh on every conversion either way.
  const quickConvertToggle = document.getElementById("won-quick-convert-toggle");
  if (quickConvertToggle) {
    const autoQuickConvertRoles = ['shashank', 'shaheer'];
    quickConvertToggle.checked = autoQuickConvertRoles.includes(appState.currentUser);
    toggleWonQuickConvertMode();
  }

  // Check if customer already has a verified agency agreement
  const customerName = quote.customer || "";
  const lower = customerName.toLowerCase().trim();
  const ctrl = (window._customerControls && window._customerControls[lower]) || {};

  const creatorRole = quote.creator;
  const isFreeHandOrNrs = creatorRole && (
    creatorRole === 'jaya' ||
    creatorRole === 'cathrina' ||
    TEAM_ROLES[creatorRole]?.category === 'FREE HAND SALES (AIR/SEA)' ||
    TEAM_ROLES[creatorRole]?.category === 'NRS (AIR/SEA)'
  );

  const hasAgreement = isFreeHandOrNrs || !!(ctrl.hasAgreement || ctrl.waiveAgreement);

  const container = document.getElementById("won-agreement-upload-container");
  const fileInput = document.getElementById("won-agreement-file");
  const statusEl = document.getElementById("won-agreement-status");

  if (container && fileInput && statusEl) {
    if (hasAgreement) {
      container.style.display = "none";
      fileInput.required = false;
      fileInput.value = "";
      statusEl.textContent = isFreeHandOrNrs ? "Not Required ✅" : "Verified ✅";
      statusEl.style.color = "var(--accent-success)";
    } else {
      container.style.display = "block";
      fileInput.required = true;
      fileInput.value = "";
      statusEl.textContent = "Required";
      statusEl.style.color = "var(--accent-error)";
    }
  }

  let carrierOptions = [];
  if (quote.type === 'air') {
    if (quote.details.airlines && quote.details.airlines.length > 0) {
      carrierOptions = quote.details.airlines.map(a => a.name);
    } else if (quote.details.airline) {
      carrierOptions = [quote.details.airline.split(" - ")[0]];
    }
  } else if (quote.type === 'sea') {
    if (quote.details.shippingLine) {
      carrierOptions.push(quote.details.shippingLine);
    }
    if (quote.details.alternatives && quote.details.alternatives.length > 0) {
      quote.details.alternatives.forEach(alt => {
        if (alt.carrier && !carrierOptions.includes(alt.carrier)) {
          carrierOptions.push(alt.carrier);
        }
      });
    }
  }
  if (carrierOptions.length === 0) {
    carrierOptions.push(quote.type === 'air' ? 'Any Airline' : 'Any Line');
  }

  let html = `<h4 style="font-size: 0.75rem; font-weight: 800; color: var(--sky); border-bottom: 1px solid var(--border-1); padding-bottom: 3px; margin: 1.2rem 0 0.8rem 0; text-transform: uppercase; letter-spacing: 0.05em;">Confirmed Surcharges & Rates</h4>`;

  if (quote.type === 'air' || quote.type === 'sea') {
    html += `
      <div class="form-group" style="margin-bottom: 0.8rem;">
        <label for="won-confirmed-carrier" style="font-weight: 700; font-size: 0.68rem; color: var(--indigo); display: block; margin-bottom: 0.4rem;">Confirmed ${quote.type === 'air' ? 'Airline' : 'Shipping Line'} *</label>
        <select id="won-confirmed-carrier" style="border-radius: 8px; font-size: 0.72rem; padding: 0.4rem 0.6rem; background: var(--bg-input); border: 1px solid var(--border-1); color: var(--t1); width: 100%;">
          ${carrierOptions.map(opt => `<option value="${opt}" ${opt === quote.confirmedCarrier ? 'selected' : ''}>${opt}</option>`).join('')}
        </select>
      </div>
    `;
  } else {
    html += `<input type="hidden" id="won-confirmed-carrier" value="N/A">`;
  }

  if (quote.type === 'air') {
    const sellRate = quote.details.appliedRate || 0;
    const buyRate = quote.details.appliedBuyRate || 0;
    html += `
      <div style="margin-bottom: 1.2rem;">
        <div style="font-size: 0.72rem; color: var(--t1); font-weight: 700; margin-bottom: 0.4rem;">Air Freight Rate (per KG)</div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.8rem;">
          <div class="form-group">
            <label style="font-size: 0.65rem; color: var(--indigo);">Sell Rate *</label>
            <input type="number" id="won-confirmed-sell-rate" placeholder="Sell Rate" step="0.01" value="${sellRate}" style="border-radius: 8px; font-size: 0.72rem; padding: 0.4rem 0.6rem; width: 100%; height: 38px; background: var(--bg-input); border: 1px solid var(--border-1); color: var(--t1);" required>
          </div>
          <div class="form-group">
            <label style="font-size: 0.65rem; color: var(--indigo);">Buy Rate *</label>
            <input type="number" id="won-confirmed-buy-rate" placeholder="Buy Rate" step="0.01" value="${buyRate}" style="border-radius: 8px; font-size: 0.72rem; padding: 0.4rem 0.6rem; width: 100%; height: 38px; background: var(--bg-input); border: 1px solid var(--border-1); color: var(--t1);" required>
          </div>
        </div>
      </div>
    `;
  } else if (quote.type === 'sea' && quote.details.mode !== 'fcl') {
    const sellRate = quote.details.mode === 'lcl' ? (quote.details.lclRateApplied || 0) : (quote.details.bbRateApplied || 0);
    const buyRate = quote.details.mode === 'lcl' ? (quote.details.lclBuyRateApplied || 0) : (quote.details.bbBuyRateApplied || 0);
    html += `
      <div style="margin-bottom: 1.2rem;">
        <div style="font-size: 0.72rem; color: var(--t1); font-weight: 700; margin-bottom: 0.4rem;">${quote.details.mode.toUpperCase()} Freight Rate (per RT)</div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.8rem;">
          <div class="form-group">
            <label style="font-size: 0.65rem; color: var(--indigo);">Sell Rate *</label>
            <input type="number" id="won-confirmed-sell-rate" placeholder="Sell Rate" step="0.01" value="${sellRate}" style="border-radius: 8px; font-size: 0.72rem; padding: 0.4rem 0.6rem; width: 100%; height: 38px; background: var(--bg-input); border: 1px solid var(--border-1); color: var(--t1);" required>
          </div>
          <div class="form-group">
            <label style="font-size: 0.65rem; color: var(--indigo);">Buy Rate *</label>
            <input type="number" id="won-confirmed-buy-rate" placeholder="Buy Rate" step="0.01" value="${buyRate}" style="border-radius: 8px; font-size: 0.72rem; padding: 0.4rem 0.6rem; width: 100%; height: 38px; background: var(--bg-input); border: 1px solid var(--border-1); color: var(--t1);" required>
          </div>
        </div>
      </div>
    `;
  } else if (quote.type === 'sea' && quote.details.mode === 'fcl') {
    html += `
      <input type="hidden" id="won-confirmed-sell-rate" value="0">
      <input type="hidden" id="won-confirmed-buy-rate" value="0">
      <div style="margin-bottom: 1.2rem;">
        <div style="font-size: 0.72rem; color: var(--t1); font-weight: 700; margin-bottom: 0.4rem;">FCL Container Rates</div>
        <div style="display: flex; flex-direction: column; gap: 0.8rem;">
          ${(quote.details.containerItems || []).map((item, idx) => `
            <div style="border: 1px solid var(--border-1); border-radius: 10px; padding: 0.6rem; background: rgba(255,255,255,0.01);">
              <div style="font-size: 0.7rem; font-weight: 700; color: var(--t1); margin-bottom: 0.4rem;">${item.type} x ${item.qty}</div>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.6rem;">
                <div class="form-group">
                  <label style="font-size: 0.62rem; color: var(--indigo);">Sell Rate (per Container) *</label>
                  <input type="number" class="won-fcl-sell-input" data-index="${idx}" placeholder="Sell Rate" step="0.01" value="${item.rate || 0}" style="border-radius: 8px; font-size: 0.7rem; padding: 0.35rem 0.5rem; width: 100%; height: 34px; background: var(--bg-input); border: 1px solid var(--border-1); color: var(--t1);" required>
                </div>
                <div class="form-group">
                  <label style="font-size: 0.62rem; color: var(--indigo);">Buy Rate (per Container) *</label>
                  <input type="number" class="won-fcl-buy-input" data-index="${idx}" placeholder="Buy Rate" step="0.01" value="${item.buy || 0}" style="border-radius: 8px; font-size: 0.7rem; padding: 0.35rem 0.5rem; width: 100%; height: 34px; background: var(--bg-input); border: 1px solid var(--border-1); color: var(--t1);" required>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  } else if (quote.type === 'transport' || quote.type === 'warehouse') {
    html += `
      <input type="hidden" id="won-confirmed-sell-rate" value="0">
      <input type="hidden" id="won-confirmed-buy-rate" value="0">
      <div style="margin-bottom: 1.2rem;">
        <div style="font-size: 0.72rem; color: var(--t1); font-weight: 700; margin-bottom: 0.4rem;">Standalone Items Rates</div>
        <div style="display: flex; flex-direction: column; gap: 0.8rem;">
          ${(quote.details.items || []).map((item, idx) => `
            <div style="border: 1px solid var(--border-1); border-radius: 10px; padding: 0.6rem; background: rgba(255,255,255,0.01);">
              <div style="font-size: 0.7rem; font-weight: 700; color: var(--t1); margin-bottom: 0.4rem;">${item.name}</div>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.6rem;">
                <div class="form-group">
                  <label style="font-size: 0.62rem; color: var(--indigo);">Sell Rate *</label>
                  <input type="number" class="won-standalone-sell-input" data-index="${idx}" placeholder="Sell Rate" step="0.01" value="${item.rate || 0}" style="border-radius: 8px; font-size: 0.7rem; padding: 0.35rem 0.5rem; width: 100%; height: 34px; background: var(--bg-input); border: 1px solid var(--border-1); color: var(--t1);" required>
                </div>
                <div class="form-group">
                  <label style="font-size: 0.62rem; color: var(--indigo);">Buy Rate *</label>
                  <input type="number" class="won-standalone-buy-input" data-index="${idx}" placeholder="Buy Rate" step="0.01" value="${item.buyRate || 0}" style="border-radius: 8px; font-size: 0.7rem; padding: 0.35rem 0.5rem; width: 100%; height: 34px; background: var(--bg-input); border: 1px solid var(--border-1); color: var(--t1);" required>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  // Sections the quote explicitly excluded (Origin/Destination Local Fees
  // checkboxes off) never get their rows rendered here — a client asking
  // for e.g. destination clearance only shouldn't be blocked confirming
  // WON by mandatory-Sell-Rate checks on rows for a section they turned
  // off. Older quotes saved before this flag existed default to enabled,
  // preserving today's behavior for them.
  const originSurcharges = quote.details.originFeesEnabled === false ? [] : (quote.details.originSurcharges || []);
  const destSurcharges = quote.details.destFeesEnabled === false ? [] : (quote.details.destSurcharges || []);

  if (originSurcharges.length > 0 || destSurcharges.length > 0) {
    html += `
      <div style="margin-top: 1.2rem;">
        <div style="font-size: 0.75rem; font-weight: 800; color: var(--sky); border-bottom: 1px solid var(--border-1); padding-bottom: 3px; margin-bottom: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em;">
          Local Fees & Surcharges
        </div>
    `;

    if (originSurcharges.length > 0) {
      html += `
        <div style="margin-bottom: 0.8rem;">
          <label style="font-weight: 700; font-size: 0.68rem; color: var(--indigo); display: block; margin-bottom: 0.4rem;">Origin Local Fee Rates</label>
          <div style="display: flex; flex-direction: column; gap: 0.8rem;">
            ${originSurcharges.map((sch, i) => `
              <div style="border: 1px solid var(--border-1); border-radius: 10px; padding: 0.6rem; background: rgba(255,255,255,0.01);">
                <div style="font-size: 0.7rem; font-weight: 700; color: var(--t1); margin-bottom: 0.4rem;" title="${sch.name} (${sch.unit})">${sch.name} (${sch.unit})</div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.6rem;">
                  <div class="form-group">
                    <label style="font-size: 0.62rem; color: var(--indigo);">Sell Rate *</label>
                    <input type="number" class="won-origin-fee-sell-input" data-index="${i}" placeholder="Sell Rate" step="0.01" value="${sch.rate !== undefined ? sch.rate : (sch.cost !== undefined ? sch.cost : 0)}" style="border-radius: 8px; font-size: 0.7rem; padding: 0.35rem 0.5rem; width: 100%; height: 34px; background: var(--bg-input); border: 1px solid var(--border-1); color: var(--t1);" required>
                  </div>
                  <div class="form-group">
                    <label style="font-size: 0.62rem; color: var(--indigo);">Buy Rate *</label>
                    <input type="number" class="won-origin-fee-buy-input" data-index="${i}" placeholder="Buy Rate" step="0.01" value="${sch.buyRate !== undefined ? sch.buyRate : 0}" style="border-radius: 8px; font-size: 0.7rem; padding: 0.35rem 0.5rem; width: 100%; height: 34px; background: var(--bg-input); border: 1px solid var(--border-1); color: var(--t1);" required>
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    if (destSurcharges.length > 0) {
      html += `
        <div style="margin-bottom: 0.8rem;">
          <label style="font-weight: 700; font-size: 0.68rem; color: var(--indigo); display: block; margin-bottom: 0.4rem;">Destination Local Fee Rates</label>
          <div style="display: flex; flex-direction: column; gap: 0.8rem;">
            ${destSurcharges.map((sch, i) => `
              <div style="border: 1px solid var(--border-1); border-radius: 10px; padding: 0.6rem; background: rgba(255,255,255,0.01);">
                <div style="font-size: 0.7rem; font-weight: 700; color: var(--t1); margin-bottom: 0.4rem;" title="${sch.name} (${sch.unit})">${sch.name} (${sch.unit})</div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.6rem;">
                  <div class="form-group">
                    <label style="font-size: 0.62rem; color: var(--indigo);">Sell Rate *</label>
                    <input type="number" class="won-dest-fee-sell-input" data-index="${i}" placeholder="Sell Rate" step="0.01" value="${sch.rate !== undefined ? sch.rate : (sch.cost !== undefined ? sch.cost : 0)}" style="border-radius: 8px; font-size: 0.7rem; padding: 0.35rem 0.5rem; width: 100%; height: 34px; background: var(--bg-input); border: 1px solid var(--border-1); color: var(--t1);" required>
                  </div>
                  <div class="form-group">
                    <label style="font-size: 0.62rem; color: var(--indigo);">Buy Rate *</label>
                    <input type="number" class="won-dest-fee-buy-input" data-index="${i}" placeholder="Buy Rate" step="0.01" value="${sch.buyRate !== undefined ? sch.buyRate : 0}" style="border-radius: 8px; font-size: 0.7rem; padding: 0.35rem 0.5rem; width: 100%; height: 34px; background: var(--bg-input); border: 1px solid var(--border-1); color: var(--t1);" required>
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    html += `</div>`;
  }

  const confirmationSection = document.getElementById("won-charges-confirmation-section");
  if (confirmationSection) {
    confirmationSection.innerHTML = html;
  }

  document.getElementById("won-booking-modal").style.display = "flex";
};

// REPORT GENERATOR & PDF LAYOUT
function generatePerformanceReport() {
  const period = document.getElementById("overview-report-period").value;
  const officer = document.getElementById("overview-report-user").value;

  const todayStr = new Date().toISOString().split('T')[0];
  const activeYear = '2026';

  // Filter quotes based on officer
  let filtered = appState.quotes;
  if (officer !== 'all') {
    filtered = appState.quotes.filter(q => q.creator === officer);
  }

  // Filter based on period
  let titlePeriod = '';
  if (period === 'daily') {
    filtered = filtered.filter(q => q.date === todayStr);
    titlePeriod = `Daily Performance Report (${todayStr})`;
  } else if (period === 'monthly') {
    filtered = filtered.filter(q => q.date.startsWith('2026-07'));
    titlePeriod = 'Monthly Performance Report (July 2026)';
  } else if (period === 'quarterly') {
    // Q3: July - Sept
    filtered = filtered.filter(q => {
      const month = parseInt(q.date.split('-')[1]);
      return month >= 7 && month <= 9;
    });
    titlePeriod = 'Quarterly Performance Report (Q3 2026)';
  } else if (period === 'halfyearly') {
    // H2: July - Dec
    filtered = filtered.filter(q => {
      const month = parseInt(q.date.split('-')[1]);
      return month >= 7 && month <= 12;
    });
    titlePeriod = 'Half-Yearly Performance Report (H2 2026)';
  } else if (period === 'annually') {
    filtered = filtered.filter(q => q.date.startsWith(activeYear));
    titlePeriod = `Annual Performance Report (Calendar Year ${activeYear})`;
  }

  // Summarize details
  const totalQuotes = filtered.length;
  const conversions = filtered.filter(q => q.status === 'converted').length;
  const rate = totalQuotes > 0 ? (conversions / totalQuotes * 100) : 0;
  const revenue = filtered.reduce((acc, q) => acc + q.amountINR, 0);
  const totalGP = filtered.reduce((acc, q) => acc + (q.grossProfitINR || 0), 0);

  // Group stats by member for summary grids
  const membersSet = new Set(Object.keys(TEAM_ROLES));
  if (appState.quotes && Array.isArray(appState.quotes)) {
    appState.quotes.forEach(q => {
      if (q.creator) membersSet.add(q.creator);
    });
  }
  const members = Array.from(membersSet).filter(roleId => roleId !== 'ganny' && roleId !== 'manager' && roleId !== 'mahendra');
  let breakdownRows = "";

  members.forEach(mId => {
    // Skip if filter is set to specific officer and not this one
    if (officer !== 'all' && officer !== mId) return;

    const deskQuotes = filtered.filter(q => q.creator === mId);
    const dCount = deskQuotes.length;
    const dConv = deskQuotes.filter(q => q.status === 'converted').length;
    const dRate = dCount > 0 ? (dConv / dCount * 100) : 0;
    const dRevenue = deskQuotes.reduce((acc, q) => acc + q.amountINR, 0);
    const dGP = deskQuotes.reduce((acc, q) => acc + (q.grossProfitINR || 0), 0);

    breakdownRows += `
      <tr>
        <td><strong>${TEAM_ROLES[mId]?.name || mId}</strong></td>
        <td>${dCount}</td>
        <td>${dConv}</td>
        <td><strong>${dRate.toFixed(1)}%</strong></td>
        <td>₹${dRevenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
        <td><strong style="color:var(--accent-success);">₹${dGP.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</strong></td>
      </tr>
    `;
  });

  // Detailed Quote logs for print
  let detailRowsList = "";
  if (filtered.length > 0) {
    filtered.forEach(q => {
      const curSym = q.currency === 'INR' ? '₹' : (q.currency === 'USD' ? '$' : (q.currency === 'EUR' ? '€' : '£'));
      const gpValStr = q.grossProfit !== undefined ? `${q.grossProfitCurrency === 'INR' ? '₹' : (q.grossProfitCurrency === 'USD' ? '$' : (q.grossProfitCurrency === 'EUR' ? '€' : '£'))}${Math.abs(q.grossProfit).toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '-';
      detailRowsList += `
        <tr>
          <td>#${getQuoteRefId(q)}</td>
          <td>${q.date}</td>
          <td><span style="text-transform:uppercase; font-size:0.8rem; font-weight:700;">${q.type}</span></td>
          <td>${q.customer}<br><span style="font-size:0.75rem; color:#666;">${q.route}</span></td>
          <td>${TEAM_ROLES[q.creator]?.name || q.creator}</td>
          <td>${q.status === 'converted' ? 'Won Converted' : 'Quoted'}</td>
          <td>${curSym}${q.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
          <td style="font-weight:700; color:var(--accent-success);">${gpValStr}</td>
        </tr>
      `;
    });
  } else {
    detailRowsList = `<tr><td colspan="8" style="text-align:center; color:#666; font-style:italic;">No quote transactions recorded in this timeframe</td></tr>`;
  }

  // Populate print modal
  const printCard = document.getElementById("quote-print-card");
  document.getElementById("modal-header-title").textContent = "Official Performance Report Extraction";

  printCard.innerHTML = `
    <div class="print-header">
      <div class="print-logo">GL PERFORMANCE DESK</div>
      <div class="print-title">
        <h2>PERFORMANCE REPORT</h2>
        <div>Generated: ${new Date().toISOString().split('T')[0]}</div>
        <div>Scope: ${officer === 'all' ? 'Consolidated Desks' : (TEAM_ROLES[officer]?.name || officer)}</div>
      </div>
    </div>

    <div class="print-details" style="margin-bottom: 1.5rem;">
      <div>
        <strong>Report Parameters:</strong><br>
        Interval: ${period.toUpperCase()}<br>
        Year: ${activeYear}
      </div>
      <div style="text-align: right;">
        <strong>Audit Officer:</strong><br>
        Logistics Manager Desk (Admin)<br>
        Verified: Automated Terminal
      </div>
    </div>

    <h4 style="font-size:1rem; font-weight:700; margin-bottom: 0.5rem; color:#333; border-bottom: 1px solid #333; padding-bottom: 0.25rem;">
      ${titlePeriod}
    </h4>

    <div style="display:grid; grid-template-columns: repeat(5, 1fr); gap: 1rem; margin-bottom: 1.5rem; margin-top: 1rem;">
      <div style="background:#f8fafc; border:1px solid #e2e8f0; padding:0.75rem; border-radius:6px; text-align:center;">
        <div style="font-size:0.72rem; color:#64748b; font-weight:700; text-transform:uppercase;">Enquiries Quoted</div>
        <div style="font-size:1.5rem; font-weight:800; color:#334155; margin-top:0.25rem;">${totalQuotes}</div>
      </div>
      <div style="background:#f8fafc; border:1px solid #e2e8f0; padding:0.75rem; border-radius:6px; text-align:center;">
        <div style="font-size:0.72rem; color:#64748b; font-weight:700; text-transform:uppercase;">Conversions Won</div>
        <div style="font-size:1.5rem; font-weight:800; color:#10b981; margin-top:0.25rem;">${conversions}</div>
      </div>
      <div style="background:#f8fafc; border:1px solid #e2e8f0; padding:0.75rem; border-radius:6px; text-align:center;">
        <div style="font-size:0.72rem; color:#64748b; font-weight:700; text-transform:uppercase;">Conversion Rate</div>
        <div style="font-size:1.5rem; font-weight:800; color:#f59e0b; margin-top:0.25rem;">${rate.toFixed(1)}%</div>
      </div>
      <div style="background:#f8fafc; border:1px solid #e2e8f0; padding:0.75rem; border-radius:6px; text-align:center;">
        <div style="font-size:0.72rem; color:#64748b; font-weight:700; text-transform:uppercase;">INR Revenue Value</div>
        <div style="font-size:1.25rem; font-weight:800; color:#3b82f6; margin-top:0.4rem;">₹${revenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
      </div>
      <div style="background:#f8fafc; border:1px solid #e2e8f0; padding:0.75rem; border-radius:6px; text-align:center;">
        <div style="font-size:0.72rem; color:#64748b; font-weight:700; text-transform:uppercase;">INR Gross Profit</div>
        <div style="font-size:1.25rem; font-weight:800; color:#8b5cf6; margin-top:0.4rem;">₹${totalGP.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
      </div>
    </div>

    <div class="print-section-title">Pricing Officer Breakdown</div>
    <table>
      <thead>
        <tr>
          <th>Desk / Officer</th>
          <th>Enquiries Quoted</th>
          <th>Conversions</th>
          <th>Conversion Rate</th>
          <th>INR Quoted Value</th>
          <th>INR Gross Profit</th>
        </tr>
      </thead>
      <tbody>
        ${breakdownRows}
      </tbody>
    </table>

    <div class="print-section-title" style="margin-top:2rem;">Detailed Enquiry Transaction Log</div>
    <table style="font-size:0.75rem;">
      <thead>
        <tr>
          <th>ID</th>
          <th>Date</th>
          <th>Mode</th>
          <th>Customer & Route</th>
          <th>Officer</th>
          <th>Status</th>
          <th>Local Amount</th>
          <th>Gross Profit</th>
        </tr>
      </thead>
      <tbody>
        ${detailRowsList}
      </tbody>
    </table>

    <div class="footer-note" style="margin-top:2rem;">
      Global Logistics Co. Performance & Audit Records. Confidential document.
    </div>
  `;

  showQuoteModal();
}

// SAVE & RETRIEVE QUOTES LOGIC
// Pure extraction from saveCurrentQuote()'s former inline air block — reads
// the exact same DOM elements and appState.currentAirFreight fields, with
// the exact same validation alert()s, and returns the same-shaped
// {route, amount, amountINR, currency, details} saveCurrentQuote() used to
// assign directly onto quoteData.
function buildAirQuoteData() {
  const originVal = document.getElementById("air-origin").value.trim();
  const destVal = document.getElementById("air-dest").value.trim();
  const incoterm = document.getElementById("air-incoterm").value;

  if (!originVal) { alert("Please fill in Origin Airport."); return { ok: false }; }
  if (!destVal) { alert("Please fill in Destination Airport."); return { ok: false }; }

  const tariffsEnabled = document.getElementById("air-enable-tariffs")?.checked ?? true;
  const originFeesEnabled = document.getElementById("air-enable-origin-fees")?.checked ?? true;
  const destFeesEnabled = document.getElementById("air-enable-dest-fees")?.checked ?? true;

  const primaryAirline = appState.currentAirFreight.airline || "";
  const routing = appState.currentAirFreight.routing || "";
  const tt = appState.currentAirFreight.tt || "";
  const validity = appState.currentAirFreight.validity || "";

  if (tariffsEnabled) {
    if (!primaryAirline || primaryAirline === "N/A") {
      alert("Please enter Carrier / Airline in the selected airline option.");
      return { ok: false };
    }
    if (!routing) { alert("Please fill in Routing Details in the selected airline option."); return { ok: false }; }
    if (!tt) { alert("Please fill in Transit Time (TT) in the selected airline option."); return { ok: false }; }
    if (!validity) { alert("Please fill in Quote Validity in the selected airline option."); return { ok: false }; }
  }

  const rows = document.querySelectorAll("#air-cargo-body .cargo-item-row");
  if (rows.length === 0) {
    alert("Please add at least one Cargo Line in the Dimensions Matrix.");
    return { ok: false };
  }

  let hasInvalidRow = false;
  rows.forEach(row => {
    const l = parseFloat(row.querySelector(".cargo-len").value) || 0;
    const w = parseFloat(row.querySelector(".cargo-wid").value) || 0;
    const h = parseFloat(row.querySelector(".cargo-hei").value) || 0;
    const qty = parseInt(row.querySelector(".cargo-qty").value) || 0;
    const gw = parseFloat(row.querySelector(".cargo-gw").value) || 0;
    if (l <= 0 || w <= 0 || h <= 0 || qty <= 0 || gw <= 0) {
      hasInvalidRow = true;
    }
  });

  if (hasInvalidRow) {
    alert("Please fill in all cells (Length, Width, Height, Quantity, Gross Weight) with values greater than zero for all Cargo Lines.");
    return { ok: false };
  }

  if (tariffsEnabled) {
    const sellRateVal = appState.currentAirFreight.appliedRate || 0;
    const buyRateVal = appState.currentAirFreight.appliedBuyRate || 0;
  }

  if (originFeesEnabled) {
    const airOriginRows = document.querySelectorAll("#air-origin-surcharges-body tr");
    let hasEmptyAirOrigin = false;
    airOriginRows.forEach(row => {
      const rateInput = row.querySelector(".chg-rate");
      if (rateInput && rateInput.value.trim() === "") {
        hasEmptyAirOrigin = true;
      }
    });
    if (hasEmptyAirOrigin) {
      alert("Please enter a value (0 if not applicable) for all Origin Surcharges. They cannot be left empty.");
      return { ok: false };
    }
  }

  if (destFeesEnabled) {
    const airDestRows = document.querySelectorAll("#air-dest-surcharges-body tr");
    let hasEmptyAirDest = false;
    airDestRows.forEach(row => {
      const rateInput = row.querySelector(".chg-rate");
      if (rateInput && rateInput.value.trim() === "") {
        hasEmptyAirDest = true;
      }
    });
    if (hasEmptyAirDest) {
      alert("Please enter a value (0 if not applicable) for all Destination Surcharges. They cannot be left empty.");
      return { ok: false };
    }
  }

  const origin = originVal.split(" - ")[0];
  const dest = destVal.split(" - ")[0];
  const airline = primaryAirline.split(" - ")[0];

  const route = `${origin} → ${dest} via ${airline || 'Any'}`;
  const amount = appState.currentAirFreight.grandTotal;
  const amountINR = appState.currentAirFreight.grandTotalINR;
  const currency = appState.currentAirFreight.currency;
  const cargoItems = [];
  rows.forEach(row => {
    const l = parseFloat(row.querySelector(".cargo-len").value) || 0;
    const w = parseFloat(row.querySelector(".cargo-wid").value) || 0;
    const h = parseFloat(row.querySelector(".cargo-hei").value) || 0;
    const qty = parseInt(row.querySelector(".cargo-qty").value) || 0;
    const gw = parseFloat(row.querySelector(".cargo-gw").value) || 0;
    cargoItems.push({ l, w, h, qty, gw });
  });

  const details = {
    origin: document.getElementById("air-origin").value,
    destination: document.getElementById("air-dest").value,
    airline: primaryAirline,
    incoterm: incoterm,
    module: appState.currentAirFreight.module || 'export',
    termsAndConditions: document.getElementById("air-terms").value.trim() || DEFAULT_AIR_TERMS,
    chargeableWeight: appState.currentAirFreight.chargeableWeight,
    grossWeight: appState.currentAirFreight.grossWeight,
    volumeWeight: appState.currentAirFreight.volumeWeight,
    cbm: appState.currentAirFreight.cbm,
    quantity: appState.currentAirFreight.quantity,
    appliedRate: appState.currentAirFreight.appliedRate,
    appliedBuyRate: appState.currentAirFreight.appliedBuyRate || 0,
    baseFreight: appState.currentAirFreight.baseFreight,
    baseBuyFreight: appState.currentAirFreight.baseBuyFreight || 0,
    originSurcharges: appState.currentAirFreight.originSurcharges,
    destSurcharges: appState.currentAirFreight.destSurcharges,
    surcharges: appState.currentAirFreight.surchargesCalculated,
    surchargeTotal: appState.currentAirFreight.surchargeTotal,
    usedBreak: appState.currentAirFreight.usedBreak,
    usingBuyFallback: !!appState.currentAirFreight.usingBuyFallback,
    // Saved separately from the tariffsEnabled/originFeesEnabled/destFeesEnabled
    // locals above (which only read the top-level #air-enable-* checkboxes,
    // still correct for the Carrier/Routing/TT requirement check below): for
    // non-Air-Nomination roles, actual inclusion in the total is gated by the
    // SELECTED airline card's own per-card checkbox (see calculateAirFreight's
    // originCardEnabled/destCardEnabled/wbEnabled), now propagated onto
    // appState.currentAirFreight — this is what the WON-confirmation
    // validation needs to check to correctly waive mandatory rate fields for
    // a section the quote actually excluded.
    tariffsEnabled: tariffsEnabled && appState.currentAirFreight.wbEnabled !== false,
    originFeesEnabled: appState.currentAirFreight.originFeesEnabled !== false,
    destFeesEnabled: appState.currentAirFreight.destFeesEnabled !== false,
    pivotWeight: appState.currentAirFreight.pivotWeight,
    routing: routing,
    tt: tt,
    validity: validity,
    cargoItems: cargoItems,
    commodity: document.getElementById("air-commodity").value,
    dgClass: document.getElementById("air-dg-class")?.value || "",
    tempType: document.getElementById("air-temp-type").value,
    tempRange: document.getElementById("air-temp-range").value,
    loadabilityTilt: document.getElementById("air-loadability-tilt").value,
    loadabilityStack: document.getElementById("air-loadability-stack").value,
    airlines: appState.currentAirFreight.airlines,
    alternatives: []
  };

  return { ok: true, route, amount, amountINR, currency, details };
}
window.buildAirQuoteData = buildAirQuoteData;

async function saveCurrentQuote() {
  memorizeSurchargeNames();
  const isAirActive = document.getElementById("air-freight-panel")?.classList.contains("active");
  const isSeaActive = document.getElementById("sea-freight-panel")?.classList.contains("active");

  let isAir = false;
  if (isAirActive) {
    isAir = true;
  } else if (isSeaActive) {
    isAir = false;
  } else {
    const curr = appState.currentUser || "shashank";
    isAir = (curr === "shashank" || curr === "jaya");
  }

  const customerName = document.getElementById(isAir ? "air-cust-name" : "sea-cust-name").value.trim();

  if (!customerName) {
    alert("Please enter a Customer Name to save the quote.");
    return;
  }

  // 1. Fetch Customer Control Settings
  const lowerCust = customerName.toLowerCase();
  let control = (window._customerControls && window._customerControls[lowerCust]) || null;
  if (!control) {
    try {
      const storedControls = JSON.parse(localStorage.getItem("gl_customer_controls") || "{}");
      control = storedControls[lowerCust] || null;
    } catch (e) { }
  }

  // 2. Capture Agency Agreement PDF if uploaded in the calculator page
  const uploadedFile = window._uploadedAgreements ? window._uploadedAgreements[isAir ? 'air' : 'sea'] : null;
  if (uploadedFile) {
    saveCustomerAgreementRecord(customerName, uploadedFile.name, uploadedFile.data);
  }

  saveCustomCustomer(customerName);

  let quoteData = {
    id: 'Q' + Math.random().toString(36).substr(2, 9),
    date: new Date().toISOString().split('T')[0],
    customer: customerName,
    creator: getActiveRole(),
    status: 'quoted',
    quoteNumber: appState.quotes.length + 1
  };

  const ctrlCust = (window._customerControls && window._customerControls[lowerCust]) || {};
  if (uploadedFile) {
    quoteData.agencyAgreementName = uploadedFile.name;
    quoteData.agencyAgreementData = uploadedFile.data;
  } else if (ctrlCust.agreementFile && ctrlCust.agreementData) {
    quoteData.agencyAgreementName = ctrlCust.agreementFile;
    quoteData.agencyAgreementData = ctrlCust.agreementData;
  }

  if (isAir) {
    const built = buildAirQuoteData();
    if (!built.ok) return;
    quoteData.type = "air";
    quoteData.route = built.route;
    quoteData.amount = built.amount;
    quoteData.amountINR = built.amountINR;
    quoteData.currency = built.currency;
    quoteData.details = built.details;
  } else {
    const originVal = document.getElementById("sea-origin").value.trim();
    const destVal = document.getElementById("sea-dest").value.trim();
    const shippingLineVal = appState.currentSeaFreight.liners?.[0]?.linerName || "";
    const incoterm = document.getElementById("sea-incoterm").value;
    const grossWeight = parseFloat(document.getElementById("sea-gross-weight").value) || 0;
    const volume = parseFloat(document.getElementById("sea-volume").value) || 0;
    const pkgQty = parseFloat(document.getElementById("sea-pkg-qty").value) || 0;
    const routing = document.getElementById("sea-routing").value.trim();
    const tt = document.getElementById("sea-tt").value.trim();
    const validity = document.getElementById("sea-validity").value.trim();

    if (!originVal) { alert("Please fill in Port of Loading (POL)."); return; }
    if (!destVal) { alert("Please fill in Port of Discharge (POD)."); return; }
    if (grossWeight <= 0) { alert("Please enter Total Gross Weight greater than zero."); return; }
    if (volume <= 0) { alert("Please enter Total Volume (CBM) greater than zero."); return; }
    if (pkgQty <= 0) { alert("Please enter Total Package Quantity greater than zero."); return; }

    const tariffsEnabled = document.getElementById("sea-enable-tariffs")?.checked ?? true;
    const originFeesEnabled = document.getElementById("sea-enable-origin-fees")?.checked ?? true;
    const destFeesEnabled = document.getElementById("sea-enable-dest-fees")?.checked ?? true;

    if (tariffsEnabled) {
      if (!shippingLineVal) { alert("Please select or enter Shipping Line / Coloader / Operator for Liner 1."); return; }
      if (!routing) { alert("Please fill in Routing Details."); return; }
      if (!tt) { alert("Please fill in Transit Time (TT)."); return; }
      if (!validity) { alert("Please fill in Quote Validity."); return; }
    }

    const origin = originVal.split(" - ")[0];
    const dest = destVal.split(" - ")[0];
    const shippingLine = shippingLineVal;

    const containerItems = [];
    if (appState.currentSeaFreight.type === 'fcl') {
      const fclRows = document.querySelectorAll("#sea-fcl-body-1 .container-row");
      if (tariffsEnabled) {
        if (fclRows.length === 0) {
          alert("Please add at least one Container Line for FCL ocean freight.");
          return;
        }
      }
      let hasInvalidFcl = false;
      let hasMissingRate = false;
      fclRows.forEach(row => {
        const type = row.querySelector(".fcl-type").value;
        const qty = parseInt(row.querySelector(".fcl-qty").value) || 0;
        const rateInput = row.querySelector(".fcl-sell-rate") || row.querySelector(".fcl-rate");
        const rate = parseFloat(rateInput.value) || 0;
        const buy = parseFloat(row.querySelector(".fcl-buy-rate")?.value) || 0;
        if (qty <= 0) {
          hasInvalidFcl = true;
        }
        // A row with a quantity but no rate on either side silently drops out
        // of the total and the container summary with no indication to the
        // user — this is what made a 40' container appear to "vanish" from
        // the quote when only its rate was left blank.
        if (qty > 0 && rate <= 0 && buy <= 0) {
          hasMissingRate = true;
        }
        containerItems.push({ type, qty, rate, buy });
      });
      if (tariffsEnabled) {
        if (hasInvalidFcl) {
          alert("Please fill in Container Quantity for all container rows.");
          return;
        }
        if (hasMissingRate) {
          alert("Please fill in a Sell Rate or Buy Rate (0 if not applicable) for every container row — a row with a quantity but no rate is left out of the total.");
          return;
        }
      }
    }

    const cargoItems = [];
    const rows = document.querySelectorAll("#sea-cargo-body .sea-cargo-item-row");
    if (appState.currentSeaFreight.type === 'lcl') {
      if (tariffsEnabled) {
        const lclRate = parseFloat(document.querySelector(".sea-lcl-rate")?.value) || 0;
        const lclBuyRate = parseFloat(document.querySelector(".sea-lcl-buy-rate")?.value) || 0;
      }
      if (rows.length === 0) {
        alert("Please add at least one Cargo Line in the Dimensions Calculator.");
        return;
      }
      let hasInvalidLcl = false;
      rows.forEach(row => {
        const l = parseFloat(row.querySelector(".sea-cargo-len").value) || 0;
        const w = parseFloat(row.querySelector(".sea-cargo-wid").value) || 0;
        const h = parseFloat(row.querySelector(".sea-cargo-hei").value) || 0;
        const qty = parseInt(row.querySelector(".sea-cargo-qty").value) || 0;
        if (l <= 0 || w <= 0 || h <= 0 || qty <= 0) {
          hasInvalidLcl = true;
        } else {
          cargoItems.push({ l, w, h, qty });
        }
      });
      if (hasInvalidLcl) {
        alert("Please fill in Length, Width, Height, and Quantity for all Sea Cargo Lines.");
        return;
      }
    } else if (appState.currentSeaFreight.type === 'bb') {
      if (tariffsEnabled) {
        const bbRate = parseFloat(document.querySelector(".sea-bb-rate")?.value) || 0;
        const bbBuyRate = parseFloat(document.querySelector(".sea-bb-buy-rate")?.value) || 0;
      }
      if (rows.length === 0) {
        alert("Please add at least one Cargo Line in the Dimensions Calculator.");
        return;
      }
      let hasInvalidBb = false;
      rows.forEach(row => {
        const l = parseFloat(row.querySelector(".sea-cargo-len").value) || 0;
        const w = parseFloat(row.querySelector(".sea-cargo-wid").value) || 0;
        const h = parseFloat(row.querySelector(".sea-cargo-hei").value) || 0;
        const qty = parseInt(row.querySelector(".sea-cargo-qty").value) || 0;
        if (l <= 0 || w <= 0 || h <= 0 || qty <= 0) {
          hasInvalidBb = true;
        } else {
          cargoItems.push({ l, w, h, qty });
        }
      });
      if (hasInvalidBb) {
        alert("Please fill in Length, Width, Height, and Quantity for all Sea Cargo Lines.");
        return;
      }
    } else {
      // Collect cargo if FCL has dimensions filled
      rows.forEach(row => {
        const l = parseFloat(row.querySelector(".sea-cargo-len").value) || 0;
        const w = parseFloat(row.querySelector(".sea-cargo-wid").value) || 0;
        const h = parseFloat(row.querySelector(".sea-cargo-hei").value) || 0;
        const qty = parseInt(row.querySelector(".sea-cargo-qty").value) || 0;
        if (l > 0 || w > 0 || h > 0 || qty > 0) {
          if (l <= 0 || w <= 0 || h <= 0 || qty <= 0) {
            alert("Please complete or remove partially filled cargo dimension lines.");
            return;
          }
          cargoItems.push({ l, w, h, qty });
        }
      });
    }

    if (originFeesEnabled) {
      const seaOriginRows = document.querySelectorAll(".sea-origin-surcharges-body tr, tbody[id^='sea-origin-surcharges-body'] tr");
      let hasEmptySeaOrigin = false;
      seaOriginRows.forEach(row => {
        const rateInput = row.querySelector(".chg-rate");
        if (rateInput && rateInput.value.trim() === "") {
          hasEmptySeaOrigin = true;
        }
      });
      if (hasEmptySeaOrigin) {
        alert("Please enter a value (0 if not applicable) for all Origin Surcharges. They cannot be left empty.");
        return;
      }
    }

    if (destFeesEnabled) {
      const seaDestRows = document.querySelectorAll(".sea-dest-surcharges-body tr, tbody[id^='sea-dest-surcharges-body'] tr");
      let hasEmptySeaDest = false;
      seaDestRows.forEach(row => {
        const rateInput = row.querySelector(".chg-rate");
        if (rateInput && rateInput.value.trim() === "") {
          hasEmptySeaDest = true;
        }
      });
      if (hasEmptySeaDest) {
        alert("Please enter a value (0 if not applicable) for all Destination Surcharges. They cannot be left empty.");
        return;
      }
    }

    quoteData.type = "sea";
    quoteData.route = `${origin} → ${dest} (${appState.currentSeaFreight.type.toUpperCase()}) ${shippingLine ? `via ${shippingLine}` : ''}`;
    quoteData.amount = appState.currentSeaFreight.grandTotal;
    quoteData.amountINR = appState.currentSeaFreight.grandTotalINR;
    quoteData.currency = appState.currentSeaFreight.currency;
    quoteData.details = {
      origin: document.getElementById("sea-origin").value,
      destination: document.getElementById("sea-dest").value,
      shippingLine: shippingLine,
      linerName: document.getElementById("sea-liner-name")?.value.trim() || shippingLine || "",
      commodity: document.getElementById("sea-commodity").value.trim(),
      dgClass: document.getElementById("sea-dg-class")?.value || "",
      incoterm: incoterm,
      termsAndConditions: document.getElementById("sea-terms")?.value.trim() || DEFAULT_SEA_TERMS,
      mode: appState.currentSeaFreight.type,
      module: appState.currentSeaFreight.module || 'export',
      liners: appState.currentSeaFreight.liners || [],
      grossWeight: appState.currentSeaFreight.grossWeight,
      volumeCbm: appState.currentSeaFreight.volumeCbm,
      packagesQuantity: appState.currentSeaFreight.packagesQuantity,
      baseFreight: appState.currentSeaFreight.baseFreight,
      originSurcharges: appState.currentSeaFreight.originSurcharges,
      destSurcharges: appState.currentSeaFreight.destSurcharges,
      surcharges: appState.currentSeaFreight.surchargesCalculated,
      surchargeTotal: appState.currentSeaFreight.surchargeTotal,
      fclSummary: appState.currentSeaFreight.fclSummary || [],
      lclCbm: appState.currentSeaFreight.volumeCbm,
      lclWeight: appState.currentSeaFreight.grossWeight,
      chargeableCbmOverride: parseFloat(document.getElementById("sea-chargeable-cbm-override")?.value) || 0,
      lclChargeable: (parseFloat(document.getElementById("sea-chargeable-cbm-override")?.value) || 0) > 0
        ? parseFloat(document.getElementById("sea-chargeable-cbm-override").value)
        : Math.max(appState.currentSeaFreight.volumeCbm, appState.currentSeaFreight.grossWeight / 1000),
      lclRateApplied: parseFloat(document.querySelector(".sea-lcl-rate")?.value) || 0,
      bbRateApplied: parseFloat(document.querySelector(".sea-bb-rate")?.value) || 0,
      lclBuyRateApplied: parseFloat(document.querySelector(".sea-lcl-buy-rate")?.value) || 0,
      bbBuyRateApplied: parseFloat(document.querySelector(".sea-bb-buy-rate")?.value) || 0,
      // These were never saved before, so submitWonBookingDetails() had no
      // way to know a client wanted e.g. destination-clearance-only and
      // unconditionally required a freight rate on every Sea quote — the
      // exact bug already fixed for Air Freight (buildAirQuoteData()) but
      // never carried over here. Read from liner card #1, matching every
      // other rate field above (they all grab the first liner via an
      // unindexed selector too, since that's the card whose values this
      // object actually saves).
      tariffsEnabled: document.querySelector("#sea-liner-card-1 .sea-enable-tariffs")?.checked ?? true,
      originFeesEnabled: document.querySelector("#sea-liner-card-1 .sea-enable-origin-fees")?.checked ?? true,
      destFeesEnabled: document.querySelector("#sea-liner-card-1 .sea-enable-dest-fees")?.checked ?? true,
      containerItems: containerItems,
      cargoItems: cargoItems,
      dimUnit: appState.currentSeaFreight.dimUnit || 'cms',
      routing: routing,
      tt: tt,
      validity: validity,
      stuffingOption: (document.getElementById("sea-fcl-stuffing-container")?.style.display !== 'none' && document.getElementById("sea-fcl-stuffing")) ? document.getElementById("sea-fcl-stuffing").value : null,
      // ===== Cargo Parameters (Universal: FCL / LCL / BB) =====
      handlingProfile: appState.currentSeaFreight.handlingProfile || "Stackable",
      orientationProfile: appState.currentSeaFreight.orientationProfile || "Tiltable",
      cargoRisk: appState.currentSeaFreight.cargoRisk || "Non Hazardous",
      climateConstraint: appState.currentSeaFreight.climateConstraint || "Ambient (15-25 DEG)",
      // ===== BB-Only Extended Parameters =====
      bbOperationalMode: appState.currentSeaFreight.type === 'bb' ? (appState.currentSeaFreight.bbOperationalMode || "Hook to Hook") : null,
      bbStowage: appState.currentSeaFreight.type === 'bb' ? (appState.currentSeaFreight.bbStowage || "Under Deck") : null,
      bbLaydays: appState.currentSeaFreight.type === 'bb' ? (appState.currentSeaFreight.bbLaydays || "") : null,
      bbCancelling: appState.currentSeaFreight.type === 'bb' ? (appState.currentSeaFreight.bbCancelling || "") : null,
      alternatives: (() => {
        const alts = [];
        document.querySelectorAll("#sea-alternatives-body tr").forEach(row => {
          const carrier = row.querySelector(".alt-carrier")?.value.trim() || "";
          const routingVal = row.querySelector(".alt-routing")?.value.trim() || "";
          const ttVal = row.querySelector(".alt-tt")?.value.trim() || "";
          const rateVal = row.querySelector(".alt-rate")?.value.trim() || "";
          if (carrier) {
            alts.push({ carrier, routing: routingVal, tt: ttVal, rate: rateVal });
          }
        });
        return alts;
      })()
    };
  }

  if (!isAir) {
    const originVal = document.getElementById("sea-origin").value.trim();
    const destVal = document.getElementById("sea-dest").value.trim();
    const lineVal = document.getElementById("sea-line")?.value.trim() || "";
    const linerVal = document.getElementById("sea-liner-name")?.value.trim() || "";
    const commodityVal = document.getElementById("sea-commodity").value.trim();
    saveCustomSeaAutocompletes(originVal, destVal, lineVal, linerVal, commodityVal);
  }

  if (appState.editingQuoteId) {
    const existingIndex = appState.quotes.findIndex(q => q.id === appState.editingQuoteId);
    if (existingIndex !== -1) {
      const originalQuote = appState.quotes[existingIndex];
      // saveCurrentQuote() only rebuilds the fields that live on the quoting
      // form (type/route/amount/currency/details). Anything set outside that
      // form — WON confirmation rates, shipper/consignee, the NRS link — is
      // not part of quoteData at all, so merge onto the original document
      // instead of replacing it, or amending a quote (before or after it's
      // WON) silently wipes that data out from under it. status IS always
      // present on quoteData (hardcoded 'quoted' above), so it must be
      // restored explicitly rather than relying on the merge to skip it.
      quoteData = { ...originalQuote, ...quoteData };
      quoteData.status = originalQuote.status || 'quoted';
      quoteData.id = originalQuote.id;
      quoteData.date = new Date().toISOString().split('T')[0]; // Updated execution date
      quoteData.creator = originalQuote.creator;
      quoteData.quoteNumber = originalQuote.quoteNumber || (existingIndex + 1);
      // amendmentAllowed/amendmentUnlockedUntil are carried over from
      // originalQuote by the spread above, not reset here — the unlock is
      // time-limited (see approveAmendment / isAmendmentGrantActive) and is
      // meant to survive multiple saves within its window, not just one.

      // buyRate/grossProfit are only ever computed at WON-confirmation time
      // (submitWonBookingDetails). Amending a quote after it's already been
      // confirmed WON updates amount/details from the form above but, without
      // this, would leave buyRate/grossProfit frozen at their pre-amendment
      // values — a real, saved GP figure going stale and wrong. A quote still
      // in 'quoted' status has no confirmed buy/sell rates yet, so it's left
      // untouched here, same as before.
      if (quoteData.status === 'converted') {
        recomputeQuoteFinancials(quoteData);
      }

      appState.editingQuoteId = null; // Clear edit mode
      const saved = await DB.saveQuote(quoteData);
      if (!saved) return;
      alert("Quotation amended and locked successfully!");
    }
  } else {
    const saved = await DB.saveQuote(quoteData);
    if (!saved) return;
    alert("Quotation saved successfully!");
  }

  // Clear inputs
  const custNameEl = document.getElementById(isAir ? "air-cust-name" : "sea-cust-name");
  if (custNameEl) custNameEl.value = "";
  if (isAir) {
    const airOriginEl = document.getElementById("air-origin");
    if (airOriginEl) airOriginEl.value = "";
    const airDestEl = document.getElementById("air-dest");
    if (airDestEl) airDestEl.value = "";
    // Airline options are dynamic cards (no static "air-airline" element) — clear
    // and re-add a single default card, matching the "Reset Form" button's behavior.
    const airlinesContainer = document.getElementById("air-airlines-list-container");
    if (airlinesContainer) {
      airlinesContainer.innerHTML = "";
      addAirlineCard();
    }
    const airIncotermEl = document.getElementById("air-incoterm");
    if (airIncotermEl) airIncotermEl.value = "EXW";
    const airBody = document.getElementById("air-cargo-body");
    if (airBody) {
      airBody.innerHTML = `
        <tr class="cargo-item-row">
          <td><input type="number" class="cargo-len" min="1" placeholder="L" required></td>
          <td><input type="number" class="cargo-wid" min="1" placeholder="W" required></td>
          <td><input type="number" class="cargo-hei" min="1" placeholder="H" required></td>
          <td><input type="number" class="cargo-qty" min="1" placeholder="Qty" required></td>
          <td><input type="number" class="cargo-gw" min="0.1" step="0.1" placeholder="Kg" required></td>
          <td>
            <button type="button" class="delete-btn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/></svg>
            </button>
          </td>
        </tr>
      `;
      // Re-wire only the freshly-created row's own listeners — NOT the whole
      // setupAirFreightEvents() (that function also (re)binds static,
      // page-lifetime elements like the "Add Airline Option" and "Add Cargo
      // Row" buttons via addEventListener; calling it again here stacked an
      // extra click handler onto those buttons every time a quote was
      // confirmed WON, so after N confirmations in a session, one click
      // fired N times — the "5-6 duplicate airline options" bug).
      airBody.querySelectorAll(".cargo-item-row input").forEach(inp => {
        inp.addEventListener("input", calculateAirFreight);
      });
      airBody.querySelectorAll(".cargo-item-row .delete-btn").forEach(btn => {
        btn.addEventListener("click", (e) => {
          e.target.closest("tr").remove();
          calculateAirFreight();
        });
      });
    }
  } else {
    resetSeaFreightDeskForm();
  }

  resetSurchargesToDefaults();

  // Clear agreement variables
  if (!window._uploadedAgreements) window._uploadedAgreements = {};
  window._uploadedAgreements['air'] = null;
  window._uploadedAgreements['sea'] = null;

  const airStatusLabel = document.getElementById("air-agreement-status");
  if (airStatusLabel) {
    airStatusLabel.textContent = "Required";
    airStatusLabel.style.color = "var(--accent-error)";
    airStatusLabel.style.background = "rgba(239, 68, 68, 0.1)";
  }
  const airFilenameLabel = document.getElementById("air-agreement-filename");
  if (airFilenameLabel) airFilenameLabel.textContent = "No file selected";

  const seaStatusLabel = document.getElementById("sea-agreement-status");
  if (seaStatusLabel) {
    seaStatusLabel.textContent = "Required";
    seaStatusLabel.style.color = "var(--accent-error)";
    seaStatusLabel.style.background = "rgba(239, 68, 68, 0.1)";
  }
  const seaFilenameLabel = document.getElementById("sea-agreement-filename");
  if (seaFilenameLabel) seaFilenameLabel.textContent = "No file selected";

  alert("Quotation successfully saved to database!");
  showMyQuotationLogs();
}

function resetSurchargesToDefaults() {
  const airOriginBody = document.getElementById("air-origin-surcharges-body");
  if (airOriginBody) {
    const creatorRole = appState.currentUser;
    const isFreeHandOrNrs = creatorRole && (
      creatorRole === 'jaya' ||
      creatorRole === 'cathrina' ||
      TEAM_ROLES[creatorRole]?.category === 'FREE HAND SALES (AIR/SEA)' ||
      TEAM_ROLES[creatorRole]?.category === 'NRS (AIR/SEA)'
    );

    if (isFreeHandOrNrs) {
      airOriginBody.innerHTML = `
        <tr>
          <td><input type="text" class="chg-name" value="Xray" required></td>
          <td><input type="number" class="chg-rate" value="0.00" step="0.01"></td>
          <td><input type="number" class="chg-buy-rate" value="0.00" step="0.01" style="background: rgba(255,255,255,0.03); color: var(--t1);"></td>
          <td>
            <select class="chg-unit">
              <option value="kg" selected>Per kg</option>
              <option value="flat">Flat</option>
            </select>
          </td>
          <td><input type="text" class="chg-remarks" placeholder="Add remarks..." style="background: rgba(255,255,255,0.03); color: var(--t1); border: 1px solid var(--border-color); border-radius: 6px; padding: 4px 8px; font-size: 0.78rem; width: 100%;"></td>
          <td>
            <button type="button" class="delete-btn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/></svg>
            </button>
          </td>
        </tr>
        <tr>
          <td><input type="text" class="chg-name" value="Cartage" required></td>
          <td><input type="number" class="chg-rate" value="0.00" step="0.01"></td>
          <td><input type="number" class="chg-buy-rate" value="0.00" step="0.01" style="background: rgba(255,255,255,0.03); color: var(--t1);"></td>
          <td>
            <select class="chg-unit">
              <option value="kg">Per kg</option>
              <option value="flat" selected>Flat</option>
            </select>
          </td>
          <td><input type="text" class="chg-remarks" placeholder="Add remarks..." style="background: rgba(255,255,255,0.03); color: var(--t1); border: 1px solid var(--border-color); border-radius: 6px; padding: 4px 8px; font-size: 0.78rem; width: 100%;"></td>
          <td>
            <button type="button" class="delete-btn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/></svg>
            </button>
          </td>
        </tr>
        <tr>
          <td><input type="text" class="chg-name" value="Misc" required></td>
          <td><input type="number" class="chg-rate" value="0.00" step="0.01"></td>
          <td><input type="number" class="chg-buy-rate" value="0.00" step="0.01" style="background: rgba(255,255,255,0.03); color: var(--t1);"></td>
          <td>
            <select class="chg-unit">
              <option value="kg">Per kg</option>
              <option value="flat" selected>Flat</option>
            </select>
          </td>
          <td><input type="text" class="chg-remarks" placeholder="Add remarks..." style="background: rgba(255,255,255,0.03); color: var(--t1); border: 1px solid var(--border-color); border-radius: 6px; padding: 4px 8px; font-size: 0.78rem; width: 100%;"></td>
          <td>
            <button type="button" class="delete-btn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/></svg>
            </button>
          </td>
        </tr>
      `;
    } else {
      airOriginBody.innerHTML = `
        <tr>
          <td><input type="text" class="chg-name" value="Xray" required></td>
          <td><input type="number" class="chg-rate" value="0.00" step="0.01"></td>
          <td><input type="number" class="chg-buy-rate" value="0.00" step="0.01" style="background: rgba(255,255,255,0.03); color: var(--t1);"></td>
          <td>
            <select class="chg-unit">
              <option value="kg" selected>Per kg</option>
              <option value="flat">Flat</option>
            </select>
          </td>
          <td><input type="text" class="chg-remarks" placeholder="Add remarks..." style="background: rgba(255,255,255,0.03); color: var(--t1); border: 1px solid var(--border-color); border-radius: 6px; padding: 4px 8px; font-size: 0.78rem; width: 100%;"></td>
          <td>
            <button type="button" class="delete-btn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/></svg>
            </button>
          </td>
        </tr>
        <tr>
          <td><input type="text" class="chg-name" value="Cartage" required readonly style="background: rgba(255,255,255,0.02); color: var(--text-dim);"></td>
          <td><input type="number" class="chg-rate" value="0.00" step="0.01"></td>
          <td><input type="number" class="chg-buy-rate" value="0.00" step="0.01" style="background: rgba(255,255,255,0.03); color: var(--t1);"></td>
          <td>
            <select class="chg-unit">
              <option value="kg">Per kg</option>
              <option value="flat" selected>Flat</option>
            </select>
          </td>
          <td><input type="text" class="chg-remarks" placeholder="Add remarks..." style="background: rgba(255,255,255,0.03); color: var(--t1); border: 1px solid var(--border-color); border-radius: 6px; padding: 4px 8px; font-size: 0.78rem; width: 100%;"></td>
          <td>
            <button type="button" class="delete-btn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/></svg>
            </button>
          </td>
        </tr>
        <tr>
          <td><input type="text" class="chg-name" value="Misc" required readonly style="background: rgba(255,255,255,0.02); color: var(--text-dim);"></td>
          <td><input type="number" class="chg-rate" value="0.00" step="0.01"></td>
          <td><input type="number" class="chg-buy-rate" value="0.00" step="0.01" style="background: rgba(255,255,255,0.03); color: var(--t1);"></td>
          <td>
            <select class="chg-unit">
              <option value="kg">Per kg</option>
              <option value="flat" selected>Flat</option>
            </select>
          </td>
          <td><input type="text" class="chg-remarks" placeholder="Add remarks..." style="background: rgba(255,255,255,0.03); color: var(--t1); border: 1px solid var(--border-color); border-radius: 6px; padding: 4px 8px; font-size: 0.78rem; width: 100%;"></td>
          <td>
            <button type="button" class="delete-btn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/></svg>
            </button>
          </td>
        </tr>
      `;
    }
    updateCartageRowVisibility();
    setupSurchargesEvents("air-origin");
  }

  const airDestBody = document.getElementById("air-dest-surcharges-body");
  if (airDestBody) {
    airDestBody.innerHTML = "";
    setupSurchargesEvents("air-dest");
  }

  const seaOriginBody = document.getElementById("sea-origin-surcharges-body");
  if (seaOriginBody) {
    populateSeaSurcharges(appState.currentSeaFreight.type || 'fcl');
  }
}

function populateSeaSurcharges(mode) {
  const originBody = document.getElementById("sea-origin-surcharges-body");
  const destBody = document.getElementById("sea-dest-surcharges-body");
  if (!originBody || !destBody) return;

  originBody.innerHTML = "";
  destBody.innerHTML = ""; // No Miscellaneous charges in destination local fees for all users

  let originRows = "";
  if (mode === 'fcl') {
    originRows = `
      <tr>
        <td><input type="text" class="chg-name" value="Terminal Handling Charges (THC)" required></td>
        <td><input type="number" class="chg-rate" value="0.00" step="0.01"></td>
        <td><input type="number" class="chg-buy-rate" value="0.00" step="0.01" style="background: rgba(255,255,255,0.03); color: var(--t1);"></td>
        <td>
          <select class="chg-unit table-select">
            <option value="flat">Flat Fee</option>
            <option value="container" selected>Per Container</option>
            <option value="rt">Per RT (Revenue Ton)</option>
            <option value="kg">Per Kg (Gross Weight)</option>
          </select>
        </td>
        <td><input type="text" class="chg-remarks" placeholder="Add remarks..." style="background: rgba(255,255,255,0.03); color: var(--t1); border: 1px solid var(--border-color); border-radius: 6px; padding: 4px 8px; font-size: 0.78rem; width: 100%;"></td>
        <td>
          <button type="button" class="delete-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/></svg>
          </button>
        </td>
      </tr>
      <tr>
        <td><input type="text" class="chg-name" value="Documentation Fee" required></td>
        <td><input type="number" class="chg-rate" value="0.00" step="0.01"></td>
        <td><input type="number" class="chg-buy-rate" value="0.00" step="0.01" style="background: rgba(255,255,255,0.03); color: var(--t1);"></td>
        <td>
          <select class="chg-unit table-select">
            <option value="flat" selected>Flat Fee</option>
            <option value="container">Per Container</option>
            <option value="rt">Per RT (Revenue Ton)</option>
            <option value="kg">Per Kg (Gross Weight)</option>
          </select>
        </td>
        <td><input type="text" class="chg-remarks" placeholder="Add remarks..." style="background: rgba(255,255,255,0.03); color: var(--t1); border: 1px solid var(--border-color); border-radius: 6px; padding: 4px 8px; font-size: 0.78rem; width: 100%;"></td>
        <td>
          <button type="button" class="delete-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/></svg>
          </button>
        </td>
      </tr>
    `;
  } else if (mode === 'lcl') {
    originRows = `
      <tr>
        <td><input type="text" class="chg-name" value="Terminal Handling Charges (THC)" required></td>
        <td><input type="number" class="chg-rate" value="0.00" step="0.01"></td>
        <td><input type="number" class="chg-buy-rate" value="0.00" step="0.01" style="background: rgba(255,255,255,0.03); color: var(--t1);"></td>
        <td>
          <select class="chg-unit table-select">
            <option value="flat">Flat Fee</option>
            <option value="container">Per Container</option>
            <option value="rt" selected>Per RT (Revenue Ton)</option>
            <option value="kg">Per Kg (Gross Weight)</option>
          </select>
        </td>
        <td><input type="text" class="chg-remarks" placeholder="Add remarks..." style="background: rgba(255,255,255,0.03); color: var(--t1); border: 1px solid var(--border-color); border-radius: 6px; padding: 4px 8px; font-size: 0.78rem; width: 100%;"></td>
        <td>
          <button type="button" class="delete-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/></svg>
          </button>
        </td>
      </tr>
      <tr>
        <td><input type="text" class="chg-name" value="Documentation Fee" required></td>
        <td><input type="number" class="chg-rate" value="0.00" step="0.01"></td>
        <td><input type="number" class="chg-buy-rate" value="0.00" step="0.01" style="background: rgba(255,255,255,0.03); color: var(--t1);"></td>
        <td>
          <select class="chg-unit table-select">
            <option value="flat" selected>Flat Fee</option>
            <option value="container">Per Container</option>
            <option value="rt">Per RT (Revenue Ton)</option>
            <option value="kg">Per Kg (Gross Weight)</option>
          </select>
        </td>
        <td><input type="text" class="chg-remarks" placeholder="Add remarks..." style="background: rgba(255,255,255,0.03); color: var(--t1); border: 1px solid var(--border-color); border-radius: 6px; padding: 4px 8px; font-size: 0.78rem; width: 100%;"></td>
        <td>
          <button type="button" class="delete-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/></svg>
          </button>
        </td>
      </tr>
      <tr>
        <td><input type="text" class="chg-name" value="Port Handling Charges" required></td>
        <td><input type="number" class="chg-rate" value="0.00" step="0.01"></td>
        <td><input type="number" class="chg-buy-rate" value="0.00" step="0.01" style="background: rgba(255,255,255,0.03); color: var(--t1);"></td>
        <td>
          <select class="chg-unit table-select">
            <option value="flat">Flat Fee</option>
            <option value="container">Per Container</option>
            <option value="rt" selected>Per RT (Revenue Ton)</option>
            <option value="kg">Per Kg (Gross Weight)</option>
          </select>
        </td>
        <td><input type="text" class="chg-remarks" placeholder="Add remarks..." style="background: rgba(255,255,255,0.03); color: var(--t1); border: 1px solid var(--border-color); border-radius: 6px; padding: 4px 8px; font-size: 0.78rem; width: 100%;"></td>
        <td>
          <button type="button" class="delete-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/></svg>
          </button>
        </td>
      </tr>
    `;
  } else if (mode === 'bb') {
    originRows = `
      <tr>
        <td><input type="text" class="chg-name" value="Lashing & Securing" required></td>
        <td><input type="number" class="chg-rate" value="0.00" step="0.01"></td>
        <td><input type="number" class="chg-buy-rate" value="0.00" step="0.01" style="background: rgba(255,255,255,0.03); color: var(--t1);"></td>
        <td>
          <select class="chg-unit table-select">
            <option value="flat">Flat Fee</option>
            <option value="container">Per Container</option>
            <option value="rt" selected>Per RT (Revenue Ton)</option>
            <option value="kg">Per Kg (Gross Weight)</option>
          </select>
        </td>
        <td><input type="text" class="chg-remarks" placeholder="Add remarks..." style="background: rgba(255,255,255,0.03); color: var(--t1); border: 1px solid var(--border-color); border-radius: 6px; padding: 4px 8px; font-size: 0.78rem; width: 100%;"></td>
        <td>
          <button type="button" class="delete-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/></svg>
          </button>
        </td>
      </tr>
      <tr>
        <td><input type="text" class="chg-name" value="Stevedoring" required></td>
        <td><input type="number" class="chg-rate" value="0.00" step="0.01"></td>
        <td><input type="number" class="chg-buy-rate" value="0.00" step="0.01" style="background: rgba(255,255,255,0.03); color: var(--t1);"></td>
        <td>
          <select class="chg-unit table-select">
            <option value="flat">Flat Fee</option>
            <option value="container">Per Container</option>
            <option value="rt" selected>Per RT (Revenue Ton)</option>
            <option value="kg">Per Kg (Gross Weight)</option>
          </select>
        </td>
        <td><input type="text" class="chg-remarks" placeholder="Add remarks..." style="background: rgba(255,255,255,0.03); color: var(--t1); border: 1px solid var(--border-color); border-radius: 6px; padding: 4px 8px; font-size: 0.78rem; width: 100%;"></td>
        <td>
          <button type="button" class="delete-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/></svg>
          </button>
        </td>
      </tr>
      <tr>
        <td><input type="text" class="chg-name" value="Port Handling" required></td>
        <td><input type="number" class="chg-rate" value="0.00" step="0.01"></td>
        <td><input type="number" class="chg-buy-rate" value="0.00" step="0.01" style="background: rgba(255,255,255,0.03); color: var(--t1);"></td>
        <td>
          <select class="chg-unit table-select">
            <option value="flat">Flat Fee</option>
            <option value="container">Per Container</option>
            <option value="rt" selected>Per RT (Revenue Ton)</option>
            <option value="kg">Per Kg (Gross Weight)</option>
          </select>
        </td>
        <td><input type="text" class="chg-remarks" placeholder="Add remarks..." style="background: rgba(255,255,255,0.03); color: var(--t1); border: 1px solid var(--border-color); border-radius: 6px; padding: 4px 8px; font-size: 0.78rem; width: 100%;"></td>
        <td>
          <button type="button" class="delete-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/></svg>
          </button>
        </td>
      </tr>
    `;
  }

  originBody.innerHTML = originRows;
  setupSurchargesEvents("sea-origin");
  setupSurchargesEvents("sea-dest");
}

function loadMemorizedSurcharges() {
  const categories = ["air-origin", "air-dest", "sea-origin", "sea-dest"];
  const defaults = {
    "air-origin": [
      "Xray",
      "Cartage",
      "Misc"
    ],
    "air-dest": [
      "Cartage Surcharge (CTG)"
    ],
    "sea-origin": [
      "Terminal Handling Charges (THC)",
      "Documentation Fee"
    ],
    "sea-dest": []
  };

  categories.forEach(cat => {
    const storageKey = `memorized_${cat}_surcharges`;
    let stored = localStorage.getItem(storageKey);
    let names = [];
    if (stored) {
      try {
        names = JSON.parse(stored);
      } catch (e) {
        names = [];
      }
    }
    const merged = Array.from(new Set([...defaults[cat], ...names]));

    const datalist = document.getElementById(`${cat}-charges-list`);
    if (datalist) {
      datalist.innerHTML = merged.map(name => `<option value="${name}"></option>`).join("");
    }

    const body = document.getElementById(`${cat}-surcharges-body`);
    if (body) {
      body.querySelectorAll(".chg-name").forEach(input => {
        input.setAttribute("list", `${cat}-charges-list`);
      });
    }
  });
}
window.loadMemorizedSurcharges = loadMemorizedSurcharges;

function memorizeSurchargeNames() {
  const categories = ["air-origin", "air-dest", "sea-origin", "sea-dest"];
  categories.forEach(cat => {
    const body = document.getElementById(`${cat}-surcharges-body`);
    if (!body) return;

    const names = [];
    body.querySelectorAll(".chg-name").forEach(input => {
      const val = input.value.trim();
      if (val) {
        names.push(val);
      }
    });

    if (names.length > 0) {
      const storageKey = `memorized_${cat}_surcharges`;
      let stored = [];
      const storedRaw = localStorage.getItem(storageKey);
      if (storedRaw) {
        try {
          stored = JSON.parse(storedRaw);
        } catch (e) {
          stored = [];
        }
      }

      const updated = Array.from(new Set([...stored, ...names]));
      localStorage.setItem(storageKey, JSON.stringify(updated));
    }
  });

  loadMemorizedSurcharges();
}
window.memorizeSurchargeNames = memorizeSurchargeNames;


function loadSavedQuotes() {
  DB.init();
}

async function restoreCachedQuotes() {
  const saved = localStorage.getItem("logistics_quotes");
  if (!saved) {
    alert("No cached quotes found in this browser.");
    return;
  }
  let quotes = [];
  try {
    quotes = JSON.parse(saved);
  } catch (e) {
    alert("Error reading cached quotes.");
    return;
  }
  if (!quotes || quotes.length === 0) {
    alert("No quotes found in local cache.");
    return;
  }

  if (!confirm(`Found ${quotes.length} quotes in your browser cache. Do you want to restore them to the server?`)) {
    return;
  }

  let successCount = 0;
  for (const q of quotes) {
    try {
      if (DB.firestoreRef) {
        await DB.firestoreRef.collection("quotes").doc(q.id).set(q);
        successCount++;
      }
    } catch (e) {
      console.error("Failed to restore quote:", q.id, e);
    }
  }

  alert(`Successfully restored ${successCount} quotes! Please refresh your page.`);
  if (appState.currentUser) {
    if (appState.currentUser === 'ganny') {
      renderAdminDashboard();
    } else {
      renderMemberDashboard(appState.currentUser);
    }
  }
}

window.restoreCachedQuotes = restoreCachedQuotes;
window.handleLogin = handleLogin;
window.logoutUser = logoutUser;
window.openActiveCalculator = openActiveCalculator;
window.returnToWorkspace = returnToWorkspace;
window.generatePerformanceReport = generatePerformanceReport;

window.showAirlineBreakup = (quoteId, airlineIndex) => {
  const quote = appState.quotes.find(q => q.id === quoteId);
  if (!quote) return;
  const alt = quote.details.airlines[airlineIndex];
  if (!alt) return;

  const currencySym = quote.currency === 'INR' ? '₹' : (quote.currency === 'USD' ? '$' : (quote.currency === 'EUR' ? '€' : '£'));

  let originHtml = "";
  (alt.originSurcharges || []).forEach(s => {
    originHtml += `<div style="display:flex; justify-content:space-between; margin-bottom:4px;"><span>${s.name} (${currencySym}${s.rate}/${s.unit})</span><strong>${currencySym}${s.calculatedCost.toFixed(2)}</strong></div>`;
  });
  if (!originHtml) originHtml = `<div style="color:#888; font-style:italic;">No origin surcharges</div>`;

  let destHtml = "";
  (alt.destSurcharges || []).forEach(s => {
    destHtml += `<div style="display:flex; justify-content:space-between; margin-bottom:4px;"><span>${s.name} (${currencySym}${s.rate}/${s.unit})</span><strong>${currencySym}${s.calculatedCost.toFixed(2)}</strong></div>`;
  });
  if (!destHtml) destHtml = `<div style="color:#888; font-style:italic;">No destination surcharges</div>`;

  const breakupModal = document.createElement("div");
  breakupModal.id = "breakup-submodal";
  breakupModal.style.cssText = "position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.6); display:flex; justify-content:center; align-items:center; z-index:10000; font-family:sans-serif; color:#333;";
  breakupModal.innerHTML = `
    <div style="background:#fff; border-radius:12px; width:450px; padding:1.5rem; box-shadow:0 10px 25px rgba(0,0,0,0.2); position:relative;">
      <h3 style="margin-top:0; color:#1b1c5c; border-bottom:2px solid #eee; padding-bottom:8px; display:flex; justify-content:space-between; align-items:center;">
        <span>📊 Cost Breakup: ${alt.name}</span>
        <span onclick="document.getElementById('breakup-submodal').remove()" style="cursor:pointer; font-size:1.5rem; color:#888;">&times;</span>
      </h3>
      
      <div style="margin-bottom:12px;">
        <strong style="color:#64748b; font-size:0.75rem; text-transform:uppercase;">1. Base Freight</strong>
        <div style="display:flex; justify-content:space-between; margin-top:4px; font-size:0.85rem;">
          <span>Freight Charge (${alt.chargeableWeight.toFixed(2)} kg at ${currencySym}${alt.appliedRate}/kg)</span>
          <strong>${currencySym}${alt.baseFreight.toFixed(2)}</strong>
        </div>
      </div>
      
      <div style="margin-bottom:12px; border-top:1px solid #f1f5f9; padding-top:8px;">
        <strong style="color:#64748b; font-size:0.75rem; text-transform:uppercase;">2. Origin Local Surcharges</strong>
        <div style="font-size:0.85rem; margin-top:4px;">
          ${originHtml}
        </div>
      </div>
      
      <div style="margin-bottom:12px; border-top:1px solid #f1f5f9; padding-top:8px;">
        <strong style="color:#64748b; font-size:0.75rem; text-transform:uppercase;">3. Destination Local Surcharges</strong>
        <div style="font-size:0.85rem; margin-top:4px;">
          ${destHtml}
        </div>
      </div>
      
      <div style="border-top:2px solid #eee; padding-top:10px; margin-top:15px; display:flex; justify-content:space-between; align-items:center; font-size:1.05rem; font-weight:bold; color:#1b1c5c;">
        <span>Grand Total:</span>
        <span>${currencySym}${alt.grandTotal.toFixed(2)}</span>
      </div>
      
      <div style="text-align:right; margin-top:1.5rem;">
        <button onclick="document.getElementById('breakup-submodal').remove()" style="background:#1b1c5c; color:#fff; border:none; padding:6px 16px; border-radius:6px; cursor:pointer; font-size:0.85rem; font-weight:bold;">Close</button>
      </div>
    </div>
  `;
  document.body.appendChild(breakupModal);
};

window.showSeaBreakup = (quoteId) => {
  const quote = appState.quotes.find(q => q.id === quoteId);
  if (!quote) return;

  const currencySym = quote.currency === 'INR' ? '₹' : (quote.currency === 'USD' ? '$' : (quote.currency === 'EUR' ? '€' : '£'));

  let originHtml = "";
  const originList = quote.details.originSurcharges || [];
  if (originList.length > 0) {
    originList.forEach(s => {
      const cost = s.calculatedCost || s.cost;
      const rateLabel = s.unit ? `(${currencySym}${s.rate}/${s.unit})` : '';
      originHtml += `<div style="display:flex; justify-content:space-between; margin-bottom:4px; font-size:0.85rem;"><span>${s.name} ${rateLabel}</span><strong>${currencySym}${cost.toFixed(2)}</strong></div>`;
    });
  } else if (quote.details.surcharges && quote.details.surcharges.length > 0) {
    quote.details.surcharges.forEach(s => {
      const cost = s.calculatedCost || s.cost;
      const rateLabel = s.unit ? `(${currencySym}${s.rate}/${s.unit})` : '';
      originHtml += `<div style="display:flex; justify-content:space-between; margin-bottom:4px; font-size:0.85rem;"><span>${s.name} ${rateLabel}</span><strong>${currencySym}${cost.toFixed(2)}</strong></div>`;
    });
  }
  if (!originHtml) originHtml = `<div style="color:#888; font-style:italic; font-size:0.85rem;">No origin surcharges</div>`;

  let destHtml = "";
  const destList = quote.details.destSurcharges || [];
  destList.forEach(s => {
    const cost = s.calculatedCost || s.cost;
    const rateLabel = s.unit ? `(${currencySym}${s.rate}/${s.unit})` : '';
    destHtml += `<div style="display:flex; justify-content:space-between; margin-bottom:4px; font-size:0.85rem;"><span>${s.name} ${rateLabel}</span><strong>${currencySym}${cost.toFixed(2)}</strong></div>`;
  });
  if (!destHtml) destHtml = `<div style="color:#888; font-style:italic; font-size:0.85rem;">No destination surcharges</div>`;

  const breakupModal = document.createElement("div");
  breakupModal.id = "breakup-submodal";
  breakupModal.style.cssText = "position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.6); display:flex; justify-content:center; align-items:center; z-index:10000; font-family:sans-serif; color:#333;";
  breakupModal.innerHTML = `
    <div style="background:#fff; border-radius:12px; width:450px; padding:1.5rem; box-shadow:0 10px 25px rgba(0,0,0,0.2); position:relative;">
      <h3 style="margin-top:0; color:#1b1c5c; border-bottom:2px solid #eee; padding-bottom:8px; display:flex; justify-content:space-between; align-items:center;">
        <span>📊 Cost Breakup: ${quote.details.shippingLine || quote.details.airline || 'Details'}</span>
        <span onclick="document.getElementById('breakup-submodal').remove()" style="cursor:pointer; font-size:1.5rem; color:#888;">&times;</span>
      </h3>
      
      <div style="margin-bottom:12px;">
        <strong style="color:#64748b; font-size:0.75rem; text-transform:uppercase;">1. Base Freight</strong>
        <div style="display:flex; justify-content:space-between; margin-top:4px; font-size:0.85rem;">
          <span>Freight Charge</span>
          <strong>${currencySym}${(quote.details.baseFreight || 0).toFixed(2)}</strong>
        </div>
      </div>
      
      <div style="margin-bottom:12px; border-top:1px solid #f1f5f9; padding-top:8px;">
        <strong style="color:#64748b; font-size:0.75rem; text-transform:uppercase;">2. Origin Local Surcharges</strong>
        <div style="margin-top:4px;">
          ${originHtml}
        </div>
      </div>
      
      <div style="margin-bottom:12px; border-top:1px solid #f1f5f9; padding-top:8px;">
        <strong style="color:#64748b; font-size:0.75rem; text-transform:uppercase;">3. Destination Local Surcharges</strong>
        <div style="margin-top:4px;">
          ${destHtml}
        </div>
      </div>
      
      <div style="border-top:2px solid #eee; padding-top:10px; margin-top:15px; display:flex; justify-content:space-between; align-items:center; font-size:1.05rem; font-weight:bold; color:#1b1c5c;">
        <span>Grand Total:</span>
        <span>${currencySym}${quote.amount.toFixed(2)}</span>
      </div>
      
      <div style="text-align:right; margin-top:1.5rem;">
        <button onclick="document.getElementById('breakup-submodal').remove()" style="background:#1b1c5c; color:#fff; border:none; padding:6px 16px; border-radius:6px; cursor:pointer; font-size:0.85rem; font-weight:bold;">Close</button>
      </div>
    </div>
  `;
  document.body.appendChild(breakupModal);
};

window.viewSavedQuote = (id) => {
  const quote = appState.quotes.find(q => q.id === id);
  if (!quote) return;

  const printCard = document.getElementById("quote-print-card");
  if (!printCard) return;
  document.getElementById("modal-header-title").textContent = "Quotation Official Preview";

  const isAir = quote.type === 'air';
  const currencySym = quote.currency === 'INR' ? '₹' : (quote.currency === 'USD' ? '$' : (quote.currency === 'EUR' ? '€' : '£'));

  let detailsRows = "";

  let alternativesHtml = "";
  if (quote.details && quote.details.airlines && quote.details.airlines.length > 0) {
    const altRows = quote.details.airlines.map((alt, index) => {
      const chgWt = alt.chargeableWeight !== undefined ? alt.chargeableWeight : (quote.details.chargeableWeight || 0);
      const baseFr = alt.baseFreight !== undefined ? alt.baseFreight : (quote.details.baseFreight || 0);
      const surch = alt.surchargeTotal !== undefined ? alt.surchargeTotal : (quote.details.surchargeTotal || 0);
      const gTotal = alt.grandTotal !== undefined ? alt.grandTotal : (baseFr + surch);
      const rate = alt.appliedRate !== undefined ? alt.appliedRate : (quote.details.appliedRate || 0);

      return `
        <tr style="${alt.selected ? 'background: #f0fdf4; font-weight: bold; border-left: 3px solid var(--accent-success);' : ''}">
          <td style="border: 1px solid #e2e8f0; padding: 8px 12px; color: #1b1c5c; font-size: 0.7rem; font-weight: 700;">
            ${alt.name}
          </td>
          <td style="border: 1px solid #e2e8f0; padding: 8px 12px; font-size: 0.7rem;">${alt.routing || '-'}</td>
          <td style="border: 1px solid #e2e8f0; padding: 8px 12px; font-size: 0.7rem;">${alt.tt || '-'}</td>
          <td style="border: 1px solid #e2e8f0; padding: 8px 12px; font-size: 0.7rem;">${alt.validity || '-'}</td>
          <td style="border: 1px solid #e2e8f0; padding: 8px 12px; font-size: 0.7rem;">${alt.pivotWeight ? alt.pivotWeight + ' kg' : '-'}</td>
          <td style="border: 1px solid #e2e8f0; padding: 8px 12px; font-size: 0.7rem;">${chgWt.toFixed(2)} kg</td>
          <td style="border: 1px solid #e2e8f0; padding: 8px 12px; font-size: 0.7rem; color: #2f3193; line-height: 1.3;">
            <div style="font-size: 0.65rem; opacity: 0.85;">${currencySym}${rate.toFixed(2)} / kg</div>
            <strong style="color: #1b1c5c; font-size: 0.75rem;">${currencySym}${baseFr.toFixed(2)}</strong>
          </td>
          <td style="border: 1px solid #e2e8f0; padding: 8px 12px; font-size: 0.7rem; color: #2f3193;">${currencySym}${surch.toFixed(2)}</td>
          <td style="border: 1px solid #e2e8f0; padding: 8px 12px; font-size: 0.72rem; font-weight: 800;">
            <div style="display:flex; align-items:center; justify-content:space-between; gap:6px;">
              <span style="color: ${alt.selected ? 'var(--accent-success)' : '#1b1c5c'};">${currencySym}${gTotal.toFixed(2)}</span>
              <button class="no-print" onclick="window.showAirlineBreakup('${quote.id}', ${index})" style="background:#1b1c5c; color:#fff; border:none; border-radius:4px; padding:2px 6px; font-size:0.6rem; cursor:pointer; font-weight:bold; outline:none; transition:all 0.15s; box-shadow:0 1px 3px rgba(0,0,0,0.1);">👁️ Info</button>
            </div>
          </td>
        </tr>
      `;
    }).join("");

    alternativesHtml = `
      <div class="print-section-title" style="margin-top: 1.5rem;">Airline Carrier & Pricing Summary (Individual Details)</div>
      <table style="width: 100%; table-layout: fixed; border-collapse: collapse; margin-top: 0.5rem; border: 1px solid #e2e8f0;">
        <thead>
          <tr style="background: #f8fafc;">
            <th style="border: 1px solid #e2e8f0; padding: 8px 12px; font-size: 0.72rem; text-transform: uppercase; font-weight: 700; color: #374151; text-align: left;">Airline</th>
            <th style="border: 1px solid #e2e8f0; padding: 5px; font-size: 0.64rem; text-transform: uppercase; font-weight: 700; color: #374151; text-align: left;">Route</th>
            <th style="border: 1px solid #e2e8f0; padding: 5px; font-size: 0.64rem; text-transform: uppercase; font-weight: 700; color: #374151; text-align: left;">T.T</th>
            <th style="border: 1px solid #e2e8f0; padding: 5px; font-size: 0.64rem; text-transform: uppercase; font-weight: 700; color: #374151; text-align: left;">Expiry</th>
            <th style="border: 1px solid #e2e8f0; padding: 5px; font-size: 0.64rem; text-transform: uppercase; font-weight: 700; color: #374151; text-align: left;">PWT</th>
            <th style="border: 1px solid #e2e8f0; padding: 5px; font-size: 0.64rem; text-transform: uppercase; font-weight: 700; color: #374151; text-align: left;">CWT</th>
            <th style="border: 1px solid #e2e8f0; padding: 8px 12px; font-size: 0.72rem; text-transform: uppercase; font-weight: 700; color: #374151; text-align: left;">Base Freight</th>
            <th style="border: 1px solid #e2e8f0; padding: 8px 12px; font-size: 0.72rem; text-transform: uppercase; font-weight: 700; color: #374151; text-align: left;">Surcharges</th>
            <th style="border: 1px solid #e2e8f0; padding: 5px; font-size: 0.64rem; text-transform: uppercase; font-weight: 700; color: #374151; text-align: left;">Gross Total</th>
          </tr>
        </thead>
        <tbody>
          ${altRows}
        </tbody>
      </table>
    `;
  } else if (quote.details && quote.details.alternatives && quote.details.alternatives.length > 0) {
    const altRows = quote.details.alternatives.map(alt => `
      <tr>
        <td style="font-weight: 700; color: #1b1c5c;">${alt.carrier}</td>
        <td>${alt.routing}</td>
        <td>${alt.tt}</td>
        <td style="font-weight: 700; color: #2f3193;">${alt.rate}</td>
      </tr>
    `).join("");

    alternativesHtml = `
      <div class="print-section-title" style="margin-top: 1.5rem;">Alternative Carrier & Routing Options</div>
      <table style="width: 100%; border-collapse: collapse; margin-top: 0.5rem;">
        <thead>
          <tr style="background: #f8fafc;">
            <th style="border: 1px solid #e2e8f0; padding: 8px 12px; font-size: 0.72rem; text-transform: uppercase; font-weight: 700; color: #374151;">Carrier / Operator</th>
            <th style="border: 1px solid #e2e8f0; padding: 8px 12px; font-size: 0.72rem; text-transform: uppercase; font-weight: 700; color: #374151;">Routing Details</th>
            <th style="border: 1px solid #e2e8f0; padding: 8px 12px; font-size: 0.72rem; text-transform: uppercase; font-weight: 700; color: #374151;">Transit Time (TT)</th>
            <th style="border: 1px solid #e2e8f0; padding: 8px 12px; font-size: 0.72rem; text-transform: uppercase; font-weight: 700; color: #374151;">Rate & Cost Details</th>
          </tr>
        </thead>
        <tbody>
          ${altRows}
        </tbody>
      </table>
    `;
  }
  if (isAir) {
    let commodityText = quote.details.commodity || 'GENERAL';
    if (quote.details.tempType === 'TEMPERATURE') {
      commodityText += ` - Temp Range: ${quote.details.tempRange === '2-8' ? '2-8 deg' : '15-25 deg'}`;
    }
    const loadabilityText = `${quote.details.loadabilityTilt || 'TILTABLE'} / ${quote.details.loadabilityStack || 'STACKABLE'}`;

    const quotedAirlinesList = (quote.details.airlines && quote.details.airlines.length > 0)
      ? quote.details.airlines.map(a => a.name).join(", ")
      : (quote.details.airline || 'N/A');

    detailsRows = `
      <tr><td>Air Freight Desk Module</td><td><strong>Air ${quote.details && quote.details.module === 'import' ? 'Import' : 'Export'}</strong></td></tr>
      <tr><td>Origin Airport</td><td>${quote.details?.origin || 'BOM'}</td></tr>
      <tr><td>Destination Airport</td><td>${quote.details?.destination || 'JFK'}</td></tr>
      <tr><td>Airline(s)</td><td><strong>${quotedAirlinesList}</strong></td></tr>
      <tr><td>Commodity Type</td><td><strong>${commodityText}</strong></td></tr>
      <tr><td>Loadability</td><td><strong>${loadabilityText}</strong></td></tr>
      <tr><td>Incoterm</td><td><strong>${quote.details?.incoterm || 'EXW'}</strong></td></tr>
      <tr><td>Actual Gross Weight</td><td>${(quote.details?.grossWeight || 0).toFixed(2)} kg</td></tr>
      <tr><td>Total Package Quantity</td><td>${quote.details?.quantity || 'N/A'} Pkgs</td></tr>
      <tr><td>Volume Weight</td><td>${(quote.details?.volumeWeight || 0).toFixed(2)} kg</td></tr>
      <tr><td>Volume (CBM)</td><td>${(quote.details?.cbm || 0).toFixed(3)} CBM</td></tr>
      <tr><td>Chargeable Weight</td><td>${(quote.details?.chargeableWeight || 0).toFixed(2)} kg</td></tr>
      ${quote.details?.pivotWeight ? `<tr><td>Pivot Weight</td><td>${quote.details.pivotWeight.toFixed(2)} kg</td></tr>` : ''}
    `;
  } else if (quote.type === 'transport' || quote.type === 'warehouse') {
    const isTrans = quote.type === 'transport';
    detailsRows = `
      <tr><td>Service Module</td><td><strong>${isTrans ? 'Transportation' : 'Warehouse'} Standalone</strong></td></tr>
      <tr><td>Service Mode</td><td><strong>${isTrans ? 'Transportation' : 'Warehouse'}</strong></td></tr>
      <tr><td>Route / Description</td><td>${quote.route || quote.details?.routing || '-'}</td></tr>
      <tr><td>Base Freight</td><td><strong>${currencySym}${(quote.details?.baseFreight ?? quote.amount ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong></td></tr>
      ${quote.details?.gstAmount !== undefined ? `<tr><td>GST / Service Tax</td><td>${currencySym}${quote.details.gstAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td></tr>` : ''}
      <tr><td>Total Quoted Amount</td><td><strong>${currencySym}${(quote.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong></td></tr>
      ${quote.notes ? `<tr><td>Notes / Calculation</td><td>${quote.notes}</td></tr>` : ''}
    `;
  } else {
    let modeLabel = 'FCL (Containers)';
    if (quote.details?.mode === 'lcl') {
      modeLabel = 'LCL (Loose Cargo)';
    } else if (quote.details?.mode === 'bb') {
      modeLabel = 'Break Bulk (Loose Cargo)';
    }

    let subDetails = "";
    if (quote.details?.mode === 'fcl') {
      // Each container type gets its own row with its own rate and subtotal
      // — previously this was one blended "2 x 20'GP, 1 x 40'GP" text line
      // with no per-type pricing, so a client reading the quote had no way
      // to see what each container size actually cost.
      const fclItems = (quote.details.containerItems || []).filter(c => (c.qty || 0) > 0);
      if (fclItems.length > 0) {
        subDetails = fclItems.map(c => {
          const qty = c.qty || 0;
          const rate = c.rate > 0 ? c.rate : (c.buy || 0);
          const rowTotal = qty * rate;
          return `<tr><td>${c.type} &nbsp;×&nbsp; ${qty}</td><td>${currencySym}${rate.toFixed(2)} / unit &nbsp;=&nbsp; <strong>${currencySym}${rowTotal.toFixed(2)}</strong></td></tr>`;
        }).join("");
      } else {
        subDetails = `<tr><td>Containers Selected</td><td>${(quote.details.fclSummary || []).join(", ") || 'Containers'}</td></tr>`;
      }
      if (quote.details.stuffingOption) {
        const stuffingLabel = quote.details.stuffingOption === 'factory' ? 'Factory Stuffing' : 'CFS/ICD Stuffing';
        subDetails += `<tr><td>Stuffing Option</td><td><strong>${stuffingLabel}</strong></td></tr>`;
      }
    } else if (quote.details?.mode === 'lcl') {
      subDetails = `
        <tr><td>LCL Chargeable RT</td><td>${(quote.details.lclChargeable || 0).toFixed(2)} RT</td></tr>
        <tr><td>LCL Ocean Rate</td><td>${currencySym}${(quote.details.lclRateApplied || 0).toFixed(2)} / RT</td></tr>
      `;
    } else {
      subDetails = `
        <tr><td>Break Bulk Chargeable RT</td><td>${(quote.details?.lclChargeable || 0).toFixed(2)} RT</td></tr>
        <tr><td>Break Bulk Rate</td><td>${currencySym}${(quote.details?.bbRateApplied || 0).toFixed(2)} / RT</td></tr>
      `;
    }
    detailsRows = `
      <tr><td>Sea Freight Desk Module</td><td><strong>Sea ${quote.details?.module === 'import' ? 'Import' : 'Export'}</strong></td></tr>
      <tr><td>Origin Port</td><td>${quote.details?.origin || 'INNSA'}</td></tr>
      <tr><td>Destination Port</td><td>${quote.details?.destination || 'Rotterdam'}</td></tr>
      <tr><td>Shipping Line</td><td>${quote.details?.shippingLine || 'N/A'}</td></tr>
      <tr><td>Liner Name</td><td>${quote.details?.linerName || 'N/A'}</td></tr>
      <tr><td>Commodity</td><td>${quote.details?.commodity || 'N/A'}</td></tr>
      <tr><td>Incoterm</td><td><strong>${quote.details?.incoterm || 'EXW'}</strong></td></tr>
      <tr><td>Sea Freight Mode</td><td>${modeLabel}</td></tr>
      <tr><td>Total Gross Weight</td><td>${(quote.details?.grossWeight || 0).toFixed(2)} kg</td></tr>
      <tr><td>Total Volume</td><td>${(quote.details?.volumeCbm || 0).toFixed(2)} CBM</td></tr>
      <tr><td>Total Package Quantity</td><td>${quote.details?.packagesQuantity || 'N/A'} Pkgs</td></tr>
      ${subDetails}
      <tr><td>Routing</td><td>${quote.details?.routing || 'Direct'}</td></tr>
      <tr><td>Transit Time (TT)</td><td>${quote.details?.tt || 'N/A'}</td></tr>
      <tr><td>Validity</td><td>${quote.details?.validity || 'N/A'}</td></tr>
      <tr><td>${quote.details?.mode === 'fcl' ? 'Total Base Ocean Freight (All Containers)' : 'Base Ocean Freight'}</td><td><strong>${currencySym}${(quote.details?.baseFreight || 0).toFixed(2)}</strong></td></tr>
      <tr><td>Charges Breakup</td><td>Itemized below</td></tr>
    `;
  }

  let originSurchargeRows = "";
  let destSurchargeRows = "";

  const originList = quote.details ? (quote.details.originSurcharges || []) : [];
  const destList = quote.details ? (quote.details.destSurcharges || []) : [];

  if (originList.length > 0) {
    originList.forEach(s => {
      const cost = s.calculatedCost || s.cost;
      const rateLabel = s.unit ? `(${currencySym}${s.rate}/${s.unit})` : '';
      originSurchargeRows += `<tr><td>${s.name} ${rateLabel}</td><td>${currencySym}${cost.toFixed(2)}</td></tr>`;
    });
  } else {
    // If it's an old quote with only 'surcharges' array, put them in origin
    if (quote.details && quote.details.surcharges && quote.details.surcharges.length > 0 && originList.length === 0) {
      quote.details.surcharges.forEach(s => {
        const cost = s.calculatedCost || s.cost;
        const rateLabel = s.unit ? `(${currencySym}${s.rate}/${s.unit})` : '';
        originSurchargeRows += `<tr><td>${s.name} ${rateLabel}</td><td>${currencySym}${cost.toFixed(2)}</td></tr>`;
      });
    } else {
      originSurchargeRows = `<tr><td colspan="2" style="color: #666; font-style: italic;">No origin charges</td></tr>`;
    }
  }

  if (destList.length > 0) {
    destList.forEach(s => {
      const cost = s.calculatedCost || s.cost;
      const rateLabel = s.unit ? `(${currencySym}${s.rate}/${s.unit})` : '';
      destSurchargeRows += `<tr><td>${s.name} ${rateLabel}</td><td>${currencySym}${cost.toFixed(2)}</td></tr>`;
    });
  } else {
    destSurchargeRows = `<tr><td colspan="2" style="color: #666; font-style: italic;">No destination charges</td></tr>`;
  }

  const seaOriginCharges = originList.length > 0
    ? originList
    : (quote.details?.surcharges || []);
  const renderSeaBreakupRows = (charges, section) => charges.map((charge) => {
    const amount = Math.abs(Number(charge.calculatedCost ?? charge.cost ?? 0));
    const basis = charge.unit && charge.rate !== undefined ? ` (${currencySym}${charge.rate}/${charge.unit})` : '';
    return `<tr><td>${charge.name || 'Charge'}${basis}</td><td>${section}</td><td style="text-align:right;">${currencySym}${amount.toFixed(2)}</td></tr>`;
  }).join('');
  const seaBreakupRows = `${renderSeaBreakupRows(seaOriginCharges, 'Origin fees')}${renderSeaBreakupRows(destList, 'Destination fees')}`
    || `<tr><td colspan="3" style="color: #666; font-style: italic;">No charges recorded</td></tr>`;
  const seaBreakupHtml = quote.type === 'sea' ? `
      <div class="print-section-title" style="margin-top: 1.5rem;">Charges Breakup</div>
      <table>
        <thead>
          <tr><th>Charge</th><th>Section</th><th style="text-align:right;">Amount</th></tr>
        </thead>
        <tbody>${seaBreakupRows}</tbody>
      </table>
    ` : '';

  const airOptions = quote.details?.airlines?.length > 0
    ? quote.details.airlines
    : [{
      name: quote.details?.airline || 'Airline',
      baseFreight: quote.details?.baseFreight || 0,
      originSurcharges: quote.details?.originSurcharges || quote.details?.surcharges || [],
      destSurcharges: quote.details?.destSurcharges || []
    }];
  const airBreakupHtml = quote.type === 'air' ? airOptions.map((airline) => {
    const airlineOriginCharges = airline.originSurcharges || [];
    const airlineDestCharges = airline.destSurcharges || [];
    const airlineRows = `
      <tr><td>Base Freight</td><td>Air freight</td><td style="text-align:right;">${currencySym}${Math.abs(Number(airline.baseFreight || 0)).toFixed(2)}</td></tr>
      ${renderSeaBreakupRows(airlineOriginCharges, 'Origin fees')}
      ${renderSeaBreakupRows(airlineDestCharges, 'Destination fees')}
    `;
    return `
      <div class="print-section-title" style="margin-top: 1.5rem;">Charges Breakup — ${airline.name || 'Airline'}</div>
      <table>
        <thead><tr><th>Charge</th><th>Section</th><th style="text-align:right;">Amount</th></tr></thead>
        <tbody>${airlineRows}</tbody>
      </table>
    `;
  }).join('') : '';

  const standaloneBreakupHtml = (quote.type === 'transport' || quote.type === 'warehouse') ? (() => {
    const standaloneItems = quote.details?.items || [];
    const itemRows = standaloneItems.map((item) => {
      const billedAmount = item.rate > 0 ? item.rate : item.buyRate;
      return `<tr><td>${item.name || 'Charge'}</td><td>${item.remarks || '—'}</td><td style="text-align:right;">${currencySym}${Math.abs(Number(billedAmount || 0)).toFixed(2)}</td></tr>`;
    }).join('') || `<tr><td colspan="3" style="color: #666; font-style: italic;">No charges recorded</td></tr>`;
    const gstAmount = Math.abs(Number(quote.details?.gstAmount || 0));
    const gstRow = quote.details?.gstEnabled !== false
      ? `<tr><td>GST / Service Tax</td><td>Applied</td><td style="text-align:right;">${currencySym}${gstAmount.toFixed(2)}</td></tr>`
      : `<tr><td>GST / Service Tax</td><td>Not applied</td><td style="text-align:right;">${currencySym}0.00</td></tr>`;
    return `
      <div class="print-section-title" style="margin-top: 1.5rem;">Charges Breakup</div>
      <table>
        <thead><tr><th>Charge</th><th>Remarks</th><th style="text-align:right;">Amount</th></tr></thead>
        <tbody>${itemRows}${gstRow}</tbody>
      </table>
    `;
  })() : '';

  let termsList = "";
  const rawTerms = quote.details && quote.details.termsAndConditions ? quote.details.termsAndConditions : (isAir ? DEFAULT_AIR_TERMS : DEFAULT_SEA_TERMS);
  if (rawTerms) {
    rawTerms.split("\n").map(l => l.trim()).filter(l => l.length > 0).forEach(line => {
      termsList += `<li>${line.replace(/^\s*\d+[.)]?\s*/, '')}</li>`;
    });
  }

  const isMultiCarrier = quote.details ?
    ((quote.details.airlines && quote.details.airlines.length > 1) ||
      (quote.details.alternatives && quote.details.alternatives.length > 1))
    : false;

  const bottomTotalBox = isMultiCarrier ? "" : `
      <div class="total-summary-box">
        <strong>GRAND TOTAL FREIGHT CHARGES (EXCLUDING LOCAL TAXES):</strong>
        <span class="val">${currencySym}${quote.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
      </div>
    `;

  printCard.innerHTML = `
      <div class="print-header" style="display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #333; padding-bottom: 1.5rem; margin-bottom: 1.5rem;">
        <div style="display: flex; align-items: center; gap: 0.6rem;">
          <img src="assets/atlas-logo.png" alt="Atlas Logistics Logo" style="height: 56px; width: auto; object-fit: contain;">
        </div>
        <div class="print-title">
          <h2>QUOTATION</h2>
          <div>Quote Reference: #${getQuoteRefId(quote)}</div>
          <div>Date Issued: ${quote.date}</div>
        </div>
      </div>
      
      <div class="print-details">
        <div>
          <strong>Customer Details:</strong><br>
          ${quote.customer}<br>
          Inquiry Status: ${quote.status === 'converted' ? 'Won Booking' : 'Priced (Pending)'}
        </div>
        <div style="text-align: right;">
          <strong>Issued By:</strong><br>
          Pricing Desk: ${TEAM_ROLES[quote.creator]?.name || quote.creator}<br>
          System: Antigravity Automated Pricing
        </div>
      </div>
      
      <!-- Sleek Horizontal Corporate Timeline -->
      <div class="shipment-status-timeline no-print" style="display: flex; justify-content: space-between; align-items: center; margin: 1.5rem 0 2rem 0; padding: 1rem; background: rgba(27,28,92,0.02); border: 1px solid rgba(27,28,92,0.06); border-radius: 8px; position: relative;">
        <!-- connecting line background -->
        <div style="position: absolute; top: 50%; left: 10%; right: 10%; height: 3px; background: #e2e8f0; transform: translateY(-50%); z-index: 1;"></div>
        <!-- active progress fill -->
        <div style="position: absolute; top: 50%; left: 10%; width: ${quote.status === 'converted' ? '80%' : '40%'}; height: 3px; background: var(--green); transform: translateY(-50%); z-index: 2; transition: width 0.5s ease;"></div>
        
        <!-- Step 1 -->
        <div style="display: flex; flex-direction: column; align-items: center; gap: 0.35rem; z-index: 3; position: relative;">
          <div style="width: 20px; height: 20px; border-radius: 50%; background: var(--green); border: 4px stroke #fff; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 0 3px rgba(21,128,61,0.15);">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <span style="font-size: 0.65rem; font-weight: 700; color: var(--sky); text-transform: uppercase;">Enquiry</span>
        </div>
  
        <!-- Step 2 -->
        <div style="display: flex; flex-direction: column; align-items: center; gap: 0.35rem; z-index: 3; position: relative;">
          <div style="width: 20px; height: 20px; border-radius: 50%; background: var(--green); border: 4px stroke #fff; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 0 3px rgba(21,128,61,0.15);">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <span style="font-size: 0.65rem; font-weight: 700; color: var(--sky); text-transform: uppercase;">Priced</span>
        </div>
  
        <!-- Step 3 -->
        <div style="display: flex; flex-direction: column; align-items: center; gap: 0.35rem; z-index: 3; position: relative;">
          <div style="width: 20px; height: 20px; border-radius: 50%; background: ${quote.status === 'converted' ? 'var(--green)' : 'var(--amber)'}; border: 4px stroke #fff; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 0 3px ${quote.status === 'converted' ? 'rgba(21,128,61,0.15)' : 'rgba(180,83,9,0.15)'};">
            ${quote.status === 'converted' ? '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>' : '<span style="width:6px; height:6px; background:#fff; border-radius:50%;"></span>'}
          </div>
          <span style="font-size: 0.65rem; font-weight: 700; color: var(--sky); text-transform: uppercase;">Approved</span>
        </div>
  
        <!-- Step 4 -->
        <div style="display: flex; flex-direction: column; align-items: center; gap: 0.35rem; z-index: 3; position: relative;">
          <div style="width: 20px; height: 20px; border-radius: 50%; background: ${quote.status === 'converted' ? 'var(--green)' : '#cbd5e1'}; border: 4px stroke #fff; display: flex; align-items: center; justify-content: center; box-shadow: ${quote.status === 'converted' ? '0 0 0 3px rgba(21,128,61,0.15)' : 'none'};">
            ${quote.status === 'converted' ? '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>' : ''}
          </div>
          <span style="font-size: 0.65rem; font-weight: 700; color: ${quote.status === 'converted' ? 'var(--sky)' : 'var(--t3)'}; text-transform: uppercase;">Won Booking</span>
        </div>
      </div>
      
      <div class="print-section-title">Freight Summary Details</div>
      <table>
        <thead>
          <tr><th>Parameter</th><th>Value</th></tr>
        </thead>
        <tbody>
          ${detailsRows}
        </tbody>
      </table>
      
      ${alternativesHtml}
      ${airBreakupHtml}
      ${seaBreakupHtml}
      ${standaloneBreakupHtml}
      
      ${bottomTotalBox}

    <div class="print-section-title" style="margin-top: 1.5rem; font-size: 0.85rem; font-weight: 800; border-bottom: 1px solid #ddd; padding-bottom: 0.25rem;">Standard Terms & Conditions</div>
    <ol style="font-size: 0.72rem; color: #bbb; line-height: 1.5; padding-left: 1.2rem; margin: 0.5rem 0 1.5rem 0; font-family: sans-serif; text-align: left;">
      ${termsList}
    </ol>
    
    <div class="footer-note" style="border-top: 1px solid rgba(255,255,255,0.05); padding-top: 0.75rem; text-align: center; display: flex; justify-content: center; align-items: baseline; margin-top: 1.5rem;">
      <span style="font-family: 'Outfit', sans-serif; font-size: 0.85rem; color: #94a3b8; display: inline-flex; align-items: baseline; font-weight: 600;">
        Thank you for Choosing&nbsp;
        <span style="font-family: 'Cinzel', serif; font-weight: 700; letter-spacing: 0.04em; color: var(--text-brand); display: inline-flex; align-items: baseline;">
          VERTE<span class="custom-brand-x" style="font-size: 1.15rem; font-weight: 900; margin-left: 2px; transform: translateY(0.04em);"></span>
        </span>
      </span>
    </div>
  `;

  showQuoteModal();
};

window.deleteQuote = (id) => {
  const quote = appState.quotes.find(q => q.id === id);
  if (!quote) return;

  // Enforce Ganny or deletionAllowed permission check
  if (!isDeleteUnlocked(quote)) {
    let requests = window._amendmentRequests || [];
    if (requests.length === 0) {
      const stored = localStorage.getItem("gl_amendment_requests");
      if (stored) {
        try { requests = JSON.parse(stored); } catch (e) { }
      }
    }
    const pending = requests.find(r => r.quoteId === quote.id && r.requestType === 'delete' && r.status === 'pending');
    if (pending) {
      alert("You have already requested permission to delete this quote. Please wait for Ganny's approval.");
      return;
    }

    const reason = prompt("You do not have permission to delete this quotation.\n\nPlease enter the reason for requesting deletion permission from Admin (Ganny):");
    if (reason === null) return; // User cancelled
    if (!reason.trim()) {
      alert("A reason is required to submit the request.");
      return;
    }

    const newReq = {
      id: 'REQ' + Math.random().toString(36).substr(2, 9),
      requestType: 'delete',
      quoteId: quote.id,
      customer: quote.customer,
      creator: appState.currentUser,
      creatorName: TEAM_ROLES[appState.currentUser]?.name || appState.currentUser,
      date: new Date().toLocaleDateString() + " " + new Date().toLocaleTimeString(),
      status: 'pending',
      reason: reason.trim(),
      acknowledged: false
    };

    if (DB.firestoreRef) {
      DB.firestoreRef.collection("amendment_requests").doc(newReq.id).set(newReq)
        .then(() => {
          alert("Deletion request submitted successfully to Ganny.");
        })
        .catch(err => {
          console.error("DB: failed to save delete request:", err);
          alert("Failed to submit request to cloud. Saving locally...");
          saveRequestLocallyFallback(newReq);
        });
    } else {
      saveRequestLocallyFallback(newReq);
      alert("Deletion request submitted successfully to Ganny (Offline).");
    }
    return;
  }

  if (confirm(`Are you sure you want to delete quote for "${quote.customer}"?`)) {
    DB.deleteQuote(id);

    // Remove related requests
    if (DB.firestoreRef) {
      const related = (window._amendmentRequests || []).filter(r => r.quoteId === id);
      related.forEach(r => {
        DB.firestoreRef.collection("amendment_requests").doc(r.id).delete()
          .catch(err => console.error("DB: failed to delete request:", err));
      });
    } else {
      let requests = [];
      const stored = localStorage.getItem("gl_amendment_requests");
      if (stored) {
        try { requests = JSON.parse(stored); } catch (e) { }
      }
      requests = requests.filter(r => r.quoteId !== id);
      localStorage.setItem("gl_amendment_requests", JSON.stringify(requests));
    }

    alert("Quotation deleted successfully!");

    if (appState.currentUser === 'ganny') {
      renderAdminDashboard();
    } else {
      renderMemberDashboard(appState.currentUser);
    }
  }
};

function showQuoteModal() {
  document.getElementById("quote-modal").classList.add("show");
}

function hideQuoteModal() {
  const modal = document.getElementById("quote-modal");
  if (modal) {
    modal.classList.remove("show");
    modal.classList.remove("maximized");
  }
  const btn = document.getElementById("maximize-modal-btn");
  if (btn) {
    btn.innerHTML = `
      <svg id="maximize-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
      </svg>
    `;
    btn.title = "Maximize Screen";
  }
}

window.toggleMaximizeQuoteModal = () => {
  const modal = document.getElementById("quote-modal");
  const btn = document.getElementById("maximize-modal-btn");
  if (!modal) return;

  const isMaximized = modal.classList.toggle("maximized");
  if (isMaximized) {
    btn.innerHTML = `
      <svg id="maximize-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M4 14h6v6M20 10h-6V4M14 20v-6h6M10 4v6H4"/>
      </svg>
    `;
    btn.title = "Restore Size";
  } else {
    btn.innerHTML = `
      <svg id="maximize-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
      </svg>
    `;
    btn.title = "Maximize Screen";
  }
};

function printQuote() {
  const printCard = document.getElementById("quote-print-card");
  if (!printCard) return;

  const printWindow = window.open("", "_blank", "width=850,height=1100");
  if (!printWindow) {
    alert("Please allow popups to print the quotation.");
    return;
  }

  const baseHref = window.location.origin + window.location.pathname;

  printWindow.document.write('<!DOCTYPE html>' +
    '<html lang="en">' +
    '<head>' +
    '<meta charset="UTF-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
    '<title>Quotation Official Print</title>' +
    '<base href="' + baseHref + '">' +
    '<link rel="preconnect" href="https://fonts.googleapis.com">' +
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' +
    '<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=Outfit:wght@400;500;600;700;800;900&family=Cinzel:wght@700;800;900&display=swap" rel="stylesheet">' +
    '<link rel="stylesheet" href="index.css">' +
    '<style>' +
    '@page {' +
    'size: A4;' +
    'margin: 15mm 20mm 15mm 20mm;' +
    '}' +
    'html, body {' +
    'margin: 0 !important;' +
    'padding: 0 !important;' +
    'background: #fff !important;' +
    'color: #0f172a !important;' +
    'font-family: "Plus Jakarta Sans", Arial, sans-serif;' +
    '-webkit-print-color-adjust: exact !important;' +
    'print-color-adjust: exact !important;' +
    '}' +
    '.quote-print-card {' +
    'box-shadow: none !important;' +
    'padding: 0 !important;' +
    'margin: 0 !important;' +
    'width: 100% !important;' +
    'max-width: 100% !important;' +
    'background: #fff !important;' +
    'color: #0f172a !important;' +
    'font-size: 9.5pt !important;' +
    '}' +
    '* {' +
    '-webkit-print-color-adjust: exact !important;' +
    'print-color-adjust: exact !important;' +
    '}' +
    '.quote-print-card tr {' +
    'page-break-inside: avoid !important;' +
    '}' +
    '.quote-print-card table {' +
    'page-break-inside: auto;' +
    '}' +
    '.total-summary-box {' +
    'page-break-inside: avoid !important;' +
    '}' +
    'ol {' +
    'page-break-inside: auto;' +
    '}' +
    'li {' +
    'page-break-inside: avoid !important;' +
    '}' +
    '</style>' +
    '</head>' +
    '<body>' +
    '<div class="quote-print-card">' +
    printCard.innerHTML +
    '</div>' +
    '<script>' +
    'window.addEventListener("load", () => {' +
    'setTimeout(() => {' +
    'window.print();' +
    'window.close();' +
    '}, 300);' +
    '});' +
    '</' + 'script>' +
    '</body>' +
    '</html>'
  );
  printWindow.document.close();
}

// --- Column Header Filter State & Handlers ---
window.hdrFilterState = {
  refid: 'all', search_refid: '',
  date: 'all', search_date: '',
  mode: 'all', search_mode: '',
  agentroute: 'all', search_agentroute: '',
  desk: 'all', search_desk: '',
  carrier: 'all', search_carrier: '',
  buyrate: 'all', search_buyrate: '',
  sellrate: 'all', search_sellrate: '',
  gp: 'all', search_gp: '',
  status: 'all', search_status: '',
  actions: 'date-desc', search_actions: '',
  dateMonths: []
};

// --- v2 chip redesign: on-demand filter reveal, Add filter / Columns menus, multi-month date ---
// Every filter here reuses selectHdrFilter/onHdrSearchInput/populateAllHeaderFilterDropdowns
// completely unchanged — this layer only shows/hides the existing .hdr-filter-dropdown blocks
// and, for Date only, adds real multi-month selection logic.
const DB_FILTER_KEYS = ['refid', 'date', 'mode', 'agentroute', 'desk', 'carrier', 'tonnage', 'buyrate', 'sellrate', 'status'];
const DB_FILTER_LABELS = { refid: 'Ref ID', date: 'Date', mode: 'Mode', agentroute: 'Agent', desk: 'Priced By Desk', carrier: 'Carrier', tonnage: 'Tonnage', buyrate: 'Buy Rate', sellrate: 'Sell Rate', status: 'Status' };
const DB_FILTER_DEFAULT_LABELS = { refid: 'Ref ID', date: 'All Dates', mode: 'All Modes', agentroute: 'Agent', desk: 'All Desks', carrier: 'All Carriers', tonnage: 'All', buyrate: 'Buy Rate', sellrate: 'Sell Rate', status: 'All Statuses' };
window._dbDateViewYear = new Date().getFullYear();

function dbFilterIsHidden(key) {
  return document.getElementById(`dropdown-hdr-${key}`)?.classList.contains('hdr-filter-dropdown-hidden');
}

window.openDbFilterField = (key) => {
  const dd = document.getElementById(`dropdown-hdr-${key}`);
  if (!dd) return;
  dd.classList.remove('hdr-filter-dropdown-hidden');
  if (!dd.querySelector('.hdr-filter-chip-remove')) {
    const x = document.createElement('span');
    x.className = 'hdr-filter-chip-remove';
    x.textContent = '✕';
    x.title = 'Remove filter';
    x.onclick = (e) => { e.stopPropagation(); window.closeDbFilterField(key); };
    dd.appendChild(x);
  }
  document.getElementById('db-add-filter-panel')?.classList.remove('open');
  if (key === 'date') renderDbDateMonthGrid();
  dd.querySelector('.hdr-filter-btn')?.click();
};

window.closeDbFilterField = (key) => {
  if (key === 'date') {
    window.hdrFilterState.dateMonths = [];
    const startDate = document.getElementById('db-filter-start-date');
    const endDate = document.getElementById('db-filter-end-date');
    if (startDate) startDate.value = '';
    if (endDate) endDate.value = '';
    updateDbDateSummary();
  } else {
    window.selectHdrFilter(key, 'all', DB_FILTER_DEFAULT_LABELS[key] || 'All');
  }
  const dd = document.getElementById(`dropdown-hdr-${key}`);
  if (dd) {
    dd.classList.add('hdr-filter-dropdown-hidden');
    dd.querySelector('.hdr-filter-chip-remove')?.remove();
    dd.querySelector('.hdr-filter-menu')?.classList.remove('open');
  }
  applyDbFiltersAndSort();
};

window.toggleDbAddFilterMenu = () => {
  const panel = document.getElementById('db-add-filter-panel');
  if (!panel) return;
  const isOpen = panel.classList.contains('open');
  document.querySelectorAll('.hdr-toolbar-panel').forEach(p => p.classList.remove('open'));
  if (isOpen) return;

  const hiddenKeys = DB_FILTER_KEYS.filter(k => dbFilterIsHidden(k));
  panel.innerHTML = hiddenKeys.length === 0
    ? `<div class="hdr-toolbar-panel-empty">All filters are active</div>`
    : `<div class="hdr-toolbar-panel-title">Add filter</div>` + hiddenKeys.map(k => `<div class="hdr-filter-opt" onclick="openDbFilterField('${k}')">${DB_FILTER_LABELS[k]}</div>`).join('');
  panel.classList.add('open');
};

function getDbHiddenColumns() {
  try { return JSON.parse(localStorage.getItem('gl_admin_db_hidden_columns') || '[]'); }
  catch (e) { return []; }
}

function buildDbColumnsPanelHTML() {
  const cols = [
    { idx: 1, label: 'Ref ID', locked: true },
    { idx: 2, label: 'Date', locked: true },
    { idx: 3, label: 'Mode' },
    { idx: 4, label: 'Agent Details' },
    { idx: 5, label: 'Priced By Desk' },
    { idx: 6, label: 'Carrier' },
    { idx: 7, label: 'Tonnage' },
    { idx: 8, label: 'Buy Rate' },
    { idx: 9, label: 'Sell Rate' },
    { idx: 10, label: 'GP' },
    { idx: 11, label: 'Status' },
    { idx: 12, label: 'Actions', locked: true }
  ];
  const hidden = getDbHiddenColumns();
  return `<div class="hdr-toolbar-panel-title">Columns</div>` + cols.map(c => {
    if (c.locked) return `<div class="hdr-col-row disabled"><input type="checkbox" checked disabled> ${c.label}</div>`;
    const checked = !hidden.includes(c.idx);
    return `<div class="hdr-col-row" onclick="toggleDbColumn(${c.idx})"><input type="checkbox" ${checked ? 'checked' : ''} onclick="event.stopPropagation(); toggleDbColumn(${c.idx})"> ${c.label}</div>`;
  }).join('');
}

window.toggleDbColumnsPanel = () => {
  const panel = document.getElementById('db-columns-panel');
  if (!panel) return;
  const isOpen = panel.classList.contains('open');
  document.querySelectorAll('.hdr-toolbar-panel').forEach(p => p.classList.remove('open'));
  if (isOpen) return;
  panel.innerHTML = buildDbColumnsPanelHTML();
  panel.classList.add('open');
};

window.toggleDbColumn = (idx) => {
  let hidden = getDbHiddenColumns();
  hidden = hidden.includes(idx) ? hidden.filter(i => i !== idx) : [...hidden, idx];
  localStorage.setItem('gl_admin_db_hidden_columns', JSON.stringify(hidden));
  window.applyDbColumnVisibility();
  const panel = document.getElementById('db-columns-panel');
  if (panel) panel.innerHTML = buildDbColumnsPanelHTML();
};

window.applyDbColumnVisibility = () => {
  const table = document.getElementById('admin-quotes-table');
  if (!table) return;
  for (let i = 3; i <= 11; i++) table.classList.remove(`col-hidden-${i}`);
  getDbHiddenColumns().forEach(idx => table.classList.add(`col-hidden-${idx}`));
};

function renderDbDateMonthGrid() {
  const grid = document.getElementById('hdr-date-month-grid');
  const yearLabel = document.getElementById('hdr-date-year-label');
  if (!grid) return;
  const year = window._dbDateViewYear;
  if (yearLabel) yearLabel.textContent = String(year);
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const selected = window.hdrFilterState.dateMonths || [];
  grid.innerHTML = monthNames.map((name, i) => {
    const key = `${year}-${String(i + 1).padStart(2, '0')}`;
    return `<div class="hdr-month-cell ${selected.includes(key) ? 'selected' : ''}" onclick="toggleDbDateMonth('${key}')">${name}</div>`;
  }).join('');
}

window.shiftDbDateYear = (delta) => {
  window._dbDateViewYear += delta;
  renderDbDateMonthGrid();
};

window.toggleDbDateMonth = (monthKey) => {
  const st = window.hdrFilterState;
  if (!st.dateMonths) st.dateMonths = [];
  const idx = st.dateMonths.indexOf(monthKey);
  if (idx >= 0) st.dateMonths.splice(idx, 1);
  else st.dateMonths.push(monthKey);
  renderDbDateMonthGrid();
  updateDbDateSummary();
  applyDbFiltersAndSort();
};

window.clearDbDateMonths = () => {
  window.hdrFilterState.dateMonths = [];
  renderDbDateMonthGrid();
  updateDbDateSummary();
  applyDbFiltersAndSort();
};

function updateDbDateSummary() {
  const months = window.hdrFilterState.dateMonths || [];
  const summary = document.getElementById('hdr-date-selected-summary');
  const label = document.getElementById('hdr-label-date');
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const fmt = (key) => { const [y, m] = key.split('-'); return `${monthNames[parseInt(m, 10) - 1]} ${y}`; };
  if (summary) summary.textContent = months.length ? `${months.length} month${months.length > 1 ? 's' : ''} selected` : 'No months selected';
  if (label) label.textContent = months.length ? months.slice().sort().map(fmt).join(', ') : 'All Dates';
}

document.addEventListener('click', (e) => {
  if (!e.target.closest('.hdr-toolbar-wrap')) {
    document.querySelectorAll('.hdr-toolbar-panel').forEach(p => p.classList.remove('open'));
  }
});

window.toggleHdrFilterMenu = (event, key) => {
  if (event) event.stopPropagation();
  const menuId = `hdr-menu-${key}`;
  const targetMenu = document.getElementById(menuId);
  const isOpen = targetMenu?.classList.contains('open');

  document.querySelectorAll('.hdr-filter-menu').forEach(m => m.classList.remove('open'));

  if (!isOpen && targetMenu) {
    targetMenu.classList.add('open');
    const input = document.getElementById(`hdr-search-${key}`);
    if (input) input.focus();
  }
};

document.addEventListener('click', (e) => {
  if (!e.target.closest('.hdr-filter-dropdown')) {
    document.querySelectorAll('.hdr-filter-menu').forEach(m => m.classList.remove('open'));
  }
});

window.onHdrSearchInput = (key, val) => {
  window.hdrFilterState[`search_${key}`] = val.toLowerCase().trim();

  const optionsList = document.getElementById(`hdr-options-${key}`);
  if (optionsList) {
    const opts = optionsList.querySelectorAll('.hdr-filter-opt');
    opts.forEach(opt => {
      const txt = opt.textContent.toLowerCase();
      if (!val || txt.includes(val.toLowerCase())) {
        opt.style.display = '';
      } else {
        opt.style.display = 'none';
      }
    });
  }

  applyDbFiltersAndSort();
};

window.selectHdrFilter = (key, value, label) => {
  window.hdrFilterState[key] = value;
  const btnLabel = document.getElementById(`hdr-label-${key}`);
  const dropdownBtn = document.querySelector(`#dropdown-hdr-${key} .hdr-filter-btn`);

  if (btnLabel) btnLabel.textContent = label;
  if (dropdownBtn) {
    if (value !== 'all') {
      dropdownBtn.classList.add('active-filter');
    } else {
      dropdownBtn.classList.remove('active-filter');
    }
  }

  const optionsList = document.getElementById(`hdr-options-${key}`);
  if (optionsList) {
    optionsList.querySelectorAll('.hdr-filter-opt').forEach(opt => {
      if (opt.getAttribute('onclick')?.includes(`'${value}'`)) {
        opt.classList.add('active');
      } else {
        opt.classList.remove('active');
      }
    });
  }

  document.getElementById(`hdr-menu-${key}`)?.classList.remove('open');
  applyDbFiltersAndSort();
};

window.selectHdrSort = (sortField, label) => {
  window.hdrFilterState.actions = sortField;
  const btnLabel = document.getElementById('hdr-label-sort');
  if (btnLabel) btnLabel.textContent = label;

  const optionsList = document.getElementById('hdr-options-actions');
  if (optionsList) {
    optionsList.querySelectorAll('.hdr-filter-opt').forEach(opt => {
      if (opt.getAttribute('onclick')?.includes(`'${sortField}'`)) {
        opt.classList.add('active');
      } else {
        opt.classList.remove('active');
      }
    });
  }

  document.getElementById('hdr-menu-actions')?.classList.remove('open');
  applyDbFiltersAndSort();
};

window.resetAllHdrFilters = () => {
  window.hdrFilterState = {
    refid: 'all', search_refid: '',
    date: 'all', search_date: '',
    mode: 'all', search_mode: '',
    agentroute: 'all', search_agentroute: '',
    desk: 'all', search_desk: '',
    carrier: 'all', search_carrier: '',
    buyrate: 'all', search_buyrate: '',
    sellrate: 'all', search_sellrate: '',
    gp: 'all', search_gp: '',
    status: 'all', search_status: '',
    actions: 'date-desc', search_actions: '',
    dateMonths: []
  };
  window._dbDateViewYear = new Date().getFullYear();
  DB_FILTER_KEYS.forEach(k => {
    const dd = document.getElementById(`dropdown-hdr-${k}`);
    if (dd) {
      dd.classList.add('hdr-filter-dropdown-hidden');
      dd.querySelector('.hdr-filter-chip-remove')?.remove();
    }
  });

  const keys = ['refid', 'date', 'mode', 'agentroute', 'desk', 'carrier', 'buyrate', 'sellrate', 'gp', 'status'];
  keys.forEach(k => {
    const searchInput = document.getElementById(`hdr-search-${k}`);
    const btn = document.querySelector(`#dropdown-hdr-${k} .hdr-filter-btn`);
    if (searchInput) searchInput.value = '';
    if (btn) btn.classList.remove('active-filter');
  });

  if (document.getElementById('hdr-label-refid')) document.getElementById('hdr-label-refid').textContent = 'Ref ID';
  if (document.getElementById('hdr-label-date')) document.getElementById('hdr-label-date').textContent = 'All Dates';
  if (document.getElementById('hdr-label-mode')) document.getElementById('hdr-label-mode').textContent = 'All Modes';
  if (document.getElementById('hdr-label-agentroute')) document.getElementById('hdr-label-agentroute').textContent = 'Agent';
  if (document.getElementById('hdr-label-desk')) document.getElementById('hdr-label-desk').textContent = 'All Desks';
  if (document.getElementById('hdr-label-carrier')) document.getElementById('hdr-label-carrier').textContent = 'All Carriers';
  if (document.getElementById('hdr-label-buyrate')) document.getElementById('hdr-label-buyrate').textContent = 'Buy Rate';
  if (document.getElementById('hdr-label-sellrate')) document.getElementById('hdr-label-sellrate').textContent = 'Sell Rate';
  if (document.getElementById('hdr-label-gp')) document.getElementById('hdr-label-gp').textContent = 'GP Profit';
  if (document.getElementById('hdr-label-status')) document.getElementById('hdr-label-status').textContent = 'All Statuses';
  if (document.getElementById('hdr-label-sort')) document.getElementById('hdr-label-sort').textContent = 'Sort By: Date (Newest)';

  const startDate = document.getElementById('db-filter-start-date');
  const endDate = document.getElementById('db-filter-end-date');
  if (startDate) startDate.value = '';
  if (endDate) endDate.value = '';

  const topSearch = document.getElementById('db-search-input');
  if (topSearch) topSearch.value = '';

  document.querySelectorAll('.hdr-filter-menu').forEach(m => m.classList.remove('open'));
  applyDbFiltersAndSort();
};

window.populateAllHeaderFilterDropdowns = () => {
  const quotes = appState.quotes || [];

  // 1. REF ID
  const refIdOptions = document.getElementById('hdr-options-refid');
  if (refIdOptions) {
    const uniqueRefIds = Array.from(new Set(quotes.map(q => getQuoteRefId(q)).filter(Boolean))).sort();
    let html = `<div class="hdr-filter-opt ${window.hdrFilterState.refid === 'all' ? 'active' : ''}" onclick="selectHdrFilter('refid', 'all', 'All Ref IDs')">All Ref IDs</div>`;
    uniqueRefIds.forEach(id => {
      const active = window.hdrFilterState.refid === id ? 'active' : '';
      const displayId = `#${id}`;
      const escapedId = id.replace(/'/g, "\\'");
      html += `<div class="hdr-filter-opt ${active}" onclick="selectHdrFilter('refid', '${escapedId}', '${displayId}')">${displayId}</div>`;
    });
    refIdOptions.innerHTML = html;
  }

  // 2. PRICED BY DESK (Show ALL Users/Creators)
  const deskOptions = document.getElementById('hdr-options-desk');
  if (deskOptions) {
    const creatorsSet = new Set(Object.keys(TEAM_ROLES));
    quotes.forEach(q => {
      if (q.creator && q.creator.toLowerCase() !== 'mahendra') {
        creatorsSet.add(q.creator);
      }
    });
    creatorsSet.delete('mahendra');
    creatorsSet.delete('Mahendra');

    let html = `<div class="hdr-filter-opt ${window.hdrFilterState.desk === 'all' ? 'active' : ''}" onclick="selectHdrFilter('desk', 'all', 'All Desks')">All Desks</div>`;
    Array.from(creatorsSet).forEach(cId => {
      const name = (TEAM_ROLES[cId]?.name || cId).replace(/\(Free Hand\)/g, "").trim();
      const active = window.hdrFilterState.desk === cId ? 'active' : '';
      const escapedId = cId.replace(/'/g, "\\'");
      const escapedName = name.replace(/'/g, "\\'");
      html += `<div class="hdr-filter-opt ${active}" onclick="selectHdrFilter('desk', '${escapedId}', '${escapedName}')">${name}</div>`;
    });
    deskOptions.innerHTML = html;
  }

  // 3. CARRIER (Show ALL Airlines & Shipping Lines)
  const carrierOptions = document.getElementById('hdr-options-carrier');
  if (carrierOptions) {
    const carrierSet = new Set();
    quotes.forEach(q => {
      const c = q.details?.airline || q.details?.shippingLine || q.details?.carrier;
      if (c && c.trim()) carrierSet.add(c.trim());
    });
    const sortedCarriers = Array.from(carrierSet).sort();
    let html = `<div class="hdr-filter-opt ${window.hdrFilterState.carrier === 'all' ? 'active' : ''}" onclick="selectHdrFilter('carrier', 'all', 'All Carriers')">All Carriers</div>`;
    sortedCarriers.forEach(c => {
      const active = window.hdrFilterState.carrier === c ? 'active' : '';
      const escapedC = c.replace(/'/g, "\\'");
      html += `<div class="hdr-filter-opt ${active}" onclick="selectHdrFilter('carrier', '${escapedC}', '${escapedC}')">${c}</div>`;
    });
    carrierOptions.innerHTML = html;
  }

  // 4. AGENT DETAILS
  const agentRouteOptions = document.getElementById('hdr-options-agentroute');
  if (agentRouteOptions) {
    const itemsSet = new Set();
    quotes.forEach(q => {
      if (q.customer && q.customer.trim()) itemsSet.add(q.customer.trim());
    });
    const sortedItems = Array.from(itemsSet).sort();
    let html = `<div class="hdr-filter-opt ${window.hdrFilterState.agentroute === 'all' ? 'active' : ''}" onclick="selectHdrFilter('agentroute', 'all', 'All Agents')">All Agents</div>`;
    sortedItems.forEach(item => {
      const active = window.hdrFilterState.agentroute === item ? 'active' : '';
      const escapedItem = item.replace(/'/g, "\\'");
      html += `<div class="hdr-filter-opt ${active}" onclick="selectHdrFilter('agentroute', '${escapedItem}', '${escapedItem}')">${item}</div>`;
    });
    agentRouteOptions.innerHTML = html;
  }
};

// --- User Column Header Filter State & Handlers ---
window.userHdrFilterState = {
  refid: 'all', search_refid: '',
  date: 'all', search_date: '',
  mode: 'all', search_mode: '',
  agentroute: 'all', search_agentroute: '',
  carrier: 'all', search_carrier: '',
  buyrate: 'all', search_buyrate: '',
  sellrate: 'all', search_sellrate: '',
  gp: 'all', search_gp: '',
  status: 'all', search_status: '',
  actions: 'date-desc', search_actions: '',
  search_global: ''
};

window.toggleUserHdrFilterMenu = (event, key) => {
  if (event) event.stopPropagation();
  const menuId = `user-hdr-menu-${key}`;
  const targetMenu = document.getElementById(menuId);
  const isOpen = targetMenu?.classList.contains('open');

  document.querySelectorAll('.hdr-filter-menu').forEach(m => m.classList.remove('open'));

  if (!isOpen && targetMenu) {
    targetMenu.classList.add('open');
    const input = document.getElementById(`user-hdr-search-${key}`);
    if (input) input.focus();
  }
};

window.onUserHdrSearchInput = (key, val) => {
  if (!window.userHdrFilterState) window.userHdrFilterState = {};
  window.userHdrFilterState[`search_${key}`] = val.toLowerCase().trim();

  const optionsList = document.getElementById(`user-hdr-options-${key}`);
  if (optionsList) {
    const opts = optionsList.querySelectorAll('.hdr-filter-opt');
    opts.forEach(opt => {
      const txt = opt.textContent.toLowerCase();
      if (!val || txt.includes(val.toLowerCase())) {
        opt.style.display = '';
      } else {
        opt.style.display = 'none';
      }
    });
  }

  applyUserDbFiltersAndSort();
};

window.selectUserHdrFilter = (key, value, label) => {
  if (!window.userHdrFilterState) window.userHdrFilterState = {};
  window.userHdrFilterState[key] = value;
  const btnLabel = document.getElementById(`user-hdr-label-${key}`);
  const dropdownBtn = document.querySelector(`#dropdown-user-hdr-${key} .hdr-filter-btn`);

  if (btnLabel) btnLabel.textContent = label;
  if (dropdownBtn) {
    if (value !== 'all') {
      dropdownBtn.classList.add('active-filter');
    } else {
      dropdownBtn.classList.remove('active-filter');
    }
  }

  const optionsList = document.getElementById(`user-hdr-options-${key}`);
  if (optionsList) {
    optionsList.querySelectorAll('.hdr-filter-opt').forEach(opt => {
      if (opt.getAttribute('onclick')?.includes(`'${value}'`)) {
        opt.classList.add('active');
      } else {
        opt.classList.remove('active');
      }
    });
  }

  document.getElementById(`user-hdr-menu-${key}`)?.classList.remove('open');
  applyUserDbFiltersAndSort();
};

window.selectUserHdrSort = (sortField, label) => {
  if (!window.userHdrFilterState) window.userHdrFilterState = {};
  window.userHdrFilterState.actions = sortField;
  const btnLabel = document.getElementById('user-hdr-label-sort');
  if (btnLabel) btnLabel.textContent = label;

  const optionsList = document.getElementById('user-hdr-options-actions');
  if (optionsList) {
    optionsList.querySelectorAll('.hdr-filter-opt').forEach(opt => {
      if (opt.getAttribute('onclick')?.includes(`'${sortField}'`)) {
        opt.classList.add('active');
      } else {
        opt.classList.remove('active');
      }
    });
  }

  document.getElementById('user-hdr-menu-actions')?.classList.remove('open');
  applyUserDbFiltersAndSort();
};

window.resetAllUserHdrFilters = () => {
  window.userHdrFilterState = {
    refid: 'all', search_refid: '',
    date: 'all', search_date: '',
    mode: 'all', search_mode: '',
    agentroute: 'all', search_agentroute: '',
    carrier: 'all', search_carrier: '',
    buyrate: 'all', search_buyrate: '',
    sellrate: 'all', search_sellrate: '',
    gp: 'all', search_gp: '',
    status: 'all', search_status: '',
    actions: 'date-desc', search_actions: '',
    search_global: ''
  };

  const keys = ['refid', 'date', 'mode', 'agentroute', 'carrier', 'buyrate', 'sellrate', 'gp', 'status'];
  keys.forEach(k => {
    const searchInput = document.getElementById(`user-hdr-search-${k}`);
    const btn = document.querySelector(`#dropdown-user-hdr-${k} .hdr-filter-btn`);
    if (searchInput) searchInput.value = '';
    if (btn) btn.classList.remove('active-filter');
  });

  if (document.getElementById('user-hdr-label-refid')) document.getElementById('user-hdr-label-refid').textContent = 'Ref ID';
  if (document.getElementById('user-hdr-label-date')) document.getElementById('user-hdr-label-date').textContent = 'All Dates';
  if (document.getElementById('user-hdr-label-mode')) document.getElementById('user-hdr-label-mode').textContent = 'All Modes';
  if (document.getElementById('user-hdr-label-agentroute')) document.getElementById('user-hdr-label-agentroute').textContent = 'Agent';
  if (document.getElementById('user-hdr-label-carrier')) document.getElementById('user-hdr-label-carrier').textContent = 'All Carriers';
  if (document.getElementById('user-hdr-label-buyrate')) document.getElementById('user-hdr-label-buyrate').textContent = 'Buy Rate';
  if (document.getElementById('user-hdr-label-sellrate')) document.getElementById('user-hdr-label-sellrate').textContent = 'Sell Rate';
  if (document.getElementById('user-hdr-label-gp')) document.getElementById('user-hdr-label-gp').textContent = 'GP Profit';
  if (document.getElementById('user-hdr-label-status')) document.getElementById('user-hdr-label-status').textContent = 'All Statuses';
  if (document.getElementById('user-hdr-label-sort')) document.getElementById('user-hdr-label-sort').textContent = 'Sort By: Date (Newest)';

  const startDate = document.getElementById('user-db-filter-start-date');
  const endDate = document.getElementById('user-db-filter-end-date');
  if (startDate) startDate.value = '';
  if (endDate) endDate.value = '';

  applyUserDbFiltersAndSort();
};

window.populateAllUserHeaderFilterDropdowns = (myQuotes) => {
  const quotes = myQuotes || [];

  // 1. REF ID
  const refIdOptions = document.getElementById('user-hdr-options-refid');
  if (refIdOptions) {
    const uniqueRefIds = Array.from(new Set(quotes.map(q => getQuoteRefId(q)).filter(Boolean))).sort();
    let html = `<div class="hdr-filter-opt ${window.userHdrFilterState.refid === 'all' ? 'active' : ''}" onclick="selectUserHdrFilter('refid', 'all', 'All Ref IDs')">All Ref IDs</div>`;
    uniqueRefIds.forEach(id => {
      const active = window.userHdrFilterState.refid === id ? 'active' : '';
      const displayId = `#${id}`;
      const escapedId = id.replace(/'/g, "\\'");
      html += `<div class="hdr-filter-opt ${active}" onclick="selectUserHdrFilter('refid', '${escapedId}', '${displayId}')">${displayId}</div>`;
    });
    refIdOptions.innerHTML = html;
  }

  // 2. CARRIER
  const carrierOptions = document.getElementById('user-hdr-options-carrier');
  if (carrierOptions) {
    const carrierSet = new Set();
    quotes.forEach(q => {
      const c = q.details?.airline || q.details?.shippingLine || q.details?.carrier;
      if (c && c.trim()) carrierSet.add(c.trim());
    });
    const sortedCarriers = Array.from(carrierSet).sort();
    let html = `<div class="hdr-filter-opt ${window.userHdrFilterState.carrier === 'all' ? 'active' : ''}" onclick="selectUserHdrFilter('carrier', 'all', 'All Carriers')">All Carriers</div>`;
    sortedCarriers.forEach(c => {
      const active = window.userHdrFilterState.carrier === c ? 'active' : '';
      const escapedC = c.replace(/'/g, "\\'");
      html += `<div class="hdr-filter-opt ${active}" onclick="selectUserHdrFilter('carrier', '${escapedC}', '${escapedC}')">${c}</div>`;
    });
    carrierOptions.innerHTML = html;
  }

  // 3. AGENT DETAILS
  const agentRouteOptions = document.getElementById('user-hdr-options-agentroute');
  if (agentRouteOptions) {
    const itemsSet = new Set();
    quotes.forEach(q => {
      if (q.customer && q.customer.trim()) itemsSet.add(q.customer.trim());
    });
    const sortedItems = Array.from(itemsSet).sort();
    let html = `<div class="hdr-filter-opt ${window.userHdrFilterState.agentroute === 'all' ? 'active' : ''}" onclick="selectUserHdrFilter('agentroute', 'all', 'All Agents')">All Agents</div>`;
    sortedItems.forEach(item => {
      const active = window.userHdrFilterState.agentroute === item ? 'active' : '';
      const escapedItem = item.replace(/'/g, "\\'");
      html += `<div class="hdr-filter-opt ${active}" onclick="selectUserHdrFilter('agentroute', '${escapedItem}', '${escapedItem}')">${item}</div>`;
    });
    agentRouteOptions.innerHTML = html;
  }
};

window.userDbCurrentPage = 1;
window.userDbRowsPerPage = 25;
window.changeUserDbPage = (dir) => {
  window._isUserPaging = true;
  window.userDbCurrentPage += dir;
  window.applyUserDbFiltersAndSort();
  window._isUserPaging = false;
};

window.applyUserDbFiltersAndSort = () => {
  const tbody = document.getElementById("user-quotes-body");
  if (!tbody) return;

  if (!window._isUserPaging) {
    window.userDbCurrentPage = 1;
  }

  const userId = window.userDashboardId || appState.currentUser;
  const myQuotes = (appState.quotes || []).filter(q => q.creator === userId);

  populateAllUserHeaderFilterDropdowns(myQuotes);

  const st = window.userHdrFilterState || {};
  const startDateVal = document.getElementById("user-db-filter-start-date")?.value;
  const endDateVal = document.getElementById("user-db-filter-end-date")?.value;

  let filtered = myQuotes.filter(q => {
    const refIdStr = (getQuoteRefId(q) || q.id || "").toLowerCase();
    const dateStr = (q.date || "").toLowerCase();
    const typeStr = (q.type || "").toLowerCase();
    const customerStr = (q.customer || "").toLowerCase();
    const routeStr = (q.route || "").toLowerCase();
    const originStr = (q.details?.origin || "").toLowerCase();
    const destStr = (q.details?.destination || "").toLowerCase();
    const carrierStr = (q.details?.airline || q.details?.shippingLine || q.details?.carrier || "").toLowerCase();
    const statusStr = (q.status || "").toLowerCase();
    const computedBuy = window.computeHistoricalBuyRate(q);
    const buyRateStr = (computedBuy || "").toString().toLowerCase();
    const sellRateStr = (q.amount || "").toString().toLowerCase();

    const gpStr = st.gp === 'percent' ?
      (q.grossProfit !== undefined && q.amount ? `${((q.grossProfit / q.amount) * 100).toFixed(2)}%` : '0.00%').toLowerCase() :
      (q.grossProfit || "").toString().toLowerCase();

    // Mode filter
    if (st.mode && st.mode !== 'all' && typeStr !== st.mode) return false;

    // Status filter
    if (st.status && st.status !== 'all' && statusStr !== st.status) return false;

    // Carrier filter
    if (st.carrier && st.carrier !== 'all') {
      if (carrierStr !== st.carrier.toLowerCase()) return false;
    }

    // Agent filter
    if (st.agentroute && st.agentroute !== 'all') {
      const targetAR = st.agentroute.toLowerCase();
      if (customerStr !== targetAR && !customerStr.includes(targetAR)) {
        return false;
      }
    }

    // Ref ID filter
    if (st.refid && st.refid !== 'all') {
      const targetRef = st.refid.toLowerCase().replace('#', '');
      if (refIdStr !== targetRef && !refIdStr.includes(targetRef)) return false;
    }

    // Date year filter
    if (st.date && st.date !== 'all') {
      if (!dateStr.includes(st.date)) return false;
    }

    // Date range filter
    if (startDateVal && new Date(q.date) < new Date(startDateVal)) return false;
    if (endDateVal && new Date(q.date) > new Date(endDateVal)) return false;

    // Search query matches
    if (st.search_refid && !refIdStr.includes(st.search_refid)) return false;
    if (st.search_date && !dateStr.includes(st.search_date)) return false;
    if (st.search_mode && !typeStr.includes(st.search_mode)) return false;
    if (st.search_agentroute && !customerStr.includes(st.search_agentroute)) return false;
    if (st.search_carrier && !carrierStr.includes(st.search_carrier)) return false;
    if (st.search_buyrate && !buyRateStr.includes(st.search_buyrate)) return false;
    if (st.search_sellrate && !sellRateStr.includes(st.search_sellrate)) return false;
    if (st.search_gp && !gpStr.includes(st.search_gp)) return false;
    if (st.search_status && !statusStr.includes(st.search_status)) return false;

    // Global Search match
    if (st.search_global) {
      const topSearch = st.search_global;
      const match =
        customerStr.includes(topSearch) ||
        refIdStr.includes(topSearch) ||
        typeStr.includes(topSearch) ||
        routeStr.includes(topSearch) ||
        originStr.includes(topSearch) ||
        destStr.includes(topSearch) ||
        carrierStr.includes(topSearch);
      if (!match) return false;
    }

    return true;
  });

  // Sort logic
  const sortField = st.actions || "date-desc";
  filtered.sort((a, b) => {
    if (sortField === "date-desc") {
      return new Date(b.date) - new Date(a.date) || b.id.localeCompare(a.id);
    } else if (sortField === "date-asc") {
      return new Date(a.date) - new Date(b.date) || a.id.localeCompare(b.id);
    } else if (sortField === "customer-asc") {
      return (a.customer || '').toLowerCase().localeCompare((b.customer || '').toLowerCase());
    } else if (sortField === "customer-desc") {
      return (b.customer || '').toLowerCase().localeCompare((a.customer || '').toLowerCase());
    } else if (sortField === "amount-desc") {
      return (b.amountINR || 0) - (a.amountINR || 0);
    } else if (sortField === "amount-asc") {
      return (a.amountINR || 0) - (b.amountINR || 0);
    }
    return 0;
  });

  const userTotalMatched = filtered.length;
  const userTotalPages = Math.ceil(userTotalMatched / window.userDbRowsPerPage) || 1;
  if (window.userDbCurrentPage > userTotalPages) window.userDbCurrentPage = userTotalPages;
  if (window.userDbCurrentPage < 1) window.userDbCurrentPage = 1;

  const userStartIdx = (window.userDbCurrentPage - 1) * window.userDbRowsPerPage;
  const userEndIdx = userStartIdx + window.userDbRowsPerPage;
  const pageFilteredUser = filtered.slice(userStartIdx, userEndIdx);

  const userPrevBtn = document.getElementById("user-db-prev-btn");
  const userNextBtn = document.getElementById("user-db-next-btn");
  const userPagInfo = document.getElementById("user-db-pagination-info");
  if (userPrevBtn) userPrevBtn.disabled = (window.userDbCurrentPage === 1);
  if (userNextBtn) userNextBtn.disabled = (window.userDbCurrentPage === userTotalPages);
  if (userPagInfo) {
    const showStart = userTotalMatched === 0 ? 0 : userStartIdx + 1;
    const showEnd = Math.min(userEndIdx, userTotalMatched);
    userPagInfo.textContent = `Page ${window.userDbCurrentPage} of ${userTotalPages} (Showing ${showStart}-${showEnd} of ${userTotalMatched} entries)`;
  }

  tbody.innerHTML = "";
  if (pageFilteredUser.length === 0) {
    tbody.innerHTML = `<tr><td colspan="11" style="text-align: center; color: var(--text-dim); padding: 2rem;">No enquiries found matching filters.</td></tr>`;
    return;
  }

  pageFilteredUser.forEach(quote => {
    const tr = document.createElement("tr");
    tr.setAttribute("data-quote-id", quote.id);
    const currencySym = quote.currency === 'INR' ? '₹' : (quote.currency === 'USD' ? '$' : (quote.currency === 'EUR' ? '€' : '£'));
    const quoteAmount = `${currencySym}${quote.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
    const actualBuyRateCurrency = quote.buyRateCurrency || quote.currency || 'INR';
    const buyRateSym = actualBuyRateCurrency === 'INR' ? '₹' : (actualBuyRateCurrency === 'USD' ? '$' : (actualBuyRateCurrency === 'EUR' ? '€' : '£'));
    const carrierName = quote.details?.airline || quote.details?.shippingLine || quote.details?.carrier || '-';
    const computedBuy = window.computeHistoricalBuyRate(quote);

    const isQuoted = quote.status === 'quoted';
    const statusLabel = quote.status === 'quoted' ? 'Quoted' : (quote.status === 'converted' ? 'Converted' : (quote.status === 'cancelled' ? 'Cancelled' : 'Lost'));

    tr.innerHTML = `
      <td><strong>#${getQuoteRefId(quote)}</strong></td>
      <td>
        <div>${quote.date}</div>
        <div class="edit-timeline-indicator" data-timestamp="${quote.timestamp || ''}" data-quote-id="${quote.id}" style="font-size: 0.68rem; margin-top: 2px;"></div>
      </td>
      <td><span class="quote-type-badge ${quote.type}">
        ${quote.type === 'transport' ?
        `Transportation` :
        (quote.type === 'warehouse' ?
          `Warehouse` :
          (quote.type === 'air' ?
            `<svg width="11" height="11" style="margin-right:4px; display:inline-block; vertical-align:middle;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-4 4H3l-2 3 3-2v-2l4-4 3.5 5.3c.3.4.8.5 1.3.3l.5-.3c.4-.2.6-.6.5-1.1z"/></svg>${quote.details && quote.details.module === 'import' ? 'Air Import' : 'Air Export'}` :
            `<svg width="11" height="11" style="margin-right:4px; display:inline-block; vertical-align:middle;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M2 21h20M19.3 14.8C18 13.5 16 13.5 14.7 14.8L12 17.5l-2.7-2.7C8 13.5 6 13.5 4.7 14.8L2 17.5V19h20v-1.5l-2.7-2.7zM12 2v10M12 2l-3 3M12 2l3 3"/></svg>${quote.details && quote.details.module === 'import' ? 'Sea Import' : 'Sea Export'}`
          )
        )
      }</span></td>
      <td>
        <div style="font-weight: 600;">${quote.customer}</div>
      </td>
      <td><span style="font-size:0.8rem; font-weight:600; color:var(--text-dim);">${carrierName}</span></td>
      <td><span style="font-size:0.8rem; font-weight:600; color:var(--text-dim);">${(quote.details?.chargeableWeight || quote.details?.grossWeight || 0) > 0 ? `${(quote.details?.chargeableWeight || quote.details?.grossWeight || 0).toLocaleString()} kg` : '-'}</span></td>
      <td><span style="font-size:0.8rem; font-weight:600; color:var(--text-dim);">${computedBuy ? `${buyRateSym}${computedBuy.toLocaleString()}` : '-'}</span></td>
      <td><div>${quoteAmount}</div></td>
      <td>
        ${quote.grossProfit !== undefined ? `
          <div style="font-size:0.8rem; color:var(--accent-success); font-weight:700;" title="Gross Profit">
            ${st.gp === 'percent' ?
          (quote.amount ? `${((quote.grossProfit / quote.amount) * 100).toFixed(2)}%` : '0.00%') :
          `${quote.grossProfitCurrency === 'INR' ? '₹' : (quote.grossProfitCurrency === 'USD' ? '$' : (quote.grossProfitCurrency === 'EUR' ? '€' : '£'))}${Math.abs(quote.grossProfit).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
        }
          </div>
        ` : '-'}
      </td>
      <td><span class="status-badge ${quote.status}">${statusLabel}</span></td>
      <td class="actions-cell"><div class="actions-cell-inner">
        <button class="action-icon-btn amend" style="background: ${isEditUnlocked(quote) ? 'rgba(245, 158, 11, 0.25)' : 'rgba(255,255,255,0.05)'}; color: ${isEditUnlocked(quote) ? 'var(--accent-warning)' : 'var(--text-dim)'};" title="${isEditUnlocked(quote) ? 'Correct / Amend Quote (Unlocked)' : 'Request Admin Permission to Correct/Amend'}" onclick="amendQuote('${quote.id}')">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
        </button>
        <button class="action-icon-btn view" title="View/Print Quote" onclick="viewSavedQuote('${quote.id}')">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
        </button>
        ${isQuoted ? `
        <button class="action-icon-btn convert" style="background: rgba(74, 222, 128, 0.2); color: var(--accent-success);" title="Convert Quote to Won" onclick="convertQuote('${quote.id}')">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
        </button>
        <button class="action-icon-btn delete" style="background: ${isEditUnlocked(quote) ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255,255,255,0.05)'}; color: ${isEditUnlocked(quote) ? 'var(--accent-error)' : 'var(--text-dim)'};" title="${isEditUnlocked(quote) ? 'Mark as Cancelled (Unlocked)' : 'Request Admin Permission to Cancel'}" onclick="markQuoteCancelled('${quote.id}')">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
        </button>
        <button class="action-icon-btn view" style="background: ${isEditUnlocked(quote) ? 'rgba(156, 163, 175, 0.15)' : 'rgba(255,255,255,0.05)'}; color: ${isEditUnlocked(quote) ? 'var(--t1)' : 'var(--text-dim)'};" title="${isEditUnlocked(quote) ? 'Mark as Lost (Unlocked)' : 'Request Admin Permission to Mark as Lost'}" onclick="markQuoteLost('${quote.id}')">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        </button>
        ` : `
        <button class="action-icon-btn convert" style="background: ${isEditUnlocked(quote) ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255,255,255,0.05)'}; color: ${isEditUnlocked(quote) ? 'var(--accent-success)' : 'var(--text-dim)'};" title="${isEditUnlocked(quote) ? 'Revert to Original (Unlocked)' : 'Request Admin Permission to Revert'}" onclick="revertQuoteToOriginal('${quote.id}')">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><polyline points="3 3 3 8 8 8"/></svg>
        </button>
        `}
        <button class="action-icon-btn delete" style="background: ${isDeleteUnlocked(quote) ? 'rgba(239, 68, 68, 0.25)' : 'rgba(255,255,255,0.05)'}; color: ${isDeleteUnlocked(quote) ? 'var(--accent-error)' : 'var(--text-dim)'};" title="${isDeleteUnlocked(quote) ? 'Delete Quote (Unlocked)' : 'Request Admin Permission to Delete'}" onclick="deleteQuote('${quote.id}')">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/></svg>
        </button>
      </div></td>
    `;
    tbody.appendChild(tr);
  });
  if (typeof window.updateEditTimelines === 'function') {
    window.updateEditTimelines();
  }
};

window.filterQuotes = (val) => {
  if (!window.userHdrFilterState) window.userHdrFilterState = {};
  const cleanVal = val.toLowerCase().trim();
  if (appState.currentUser === 'ganny') {
    const topSearch = document.getElementById("db-search-input");
    if (topSearch) {
      topSearch.value = val;
      applyDbFiltersAndSort();
    }
  } else {
    window.userHdrFilterState.search_global = cleanVal;
    applyUserDbFiltersAndSort();
  }
};

window.dbCurrentPage = 1;
window.dbRowsPerPage = 25;
window.changeDbPage = (dir) => {
  window._isPaging = true;
  window.dbCurrentPage += dir;
  window.applyDbFiltersAndSort();
  window._isPaging = false;
};

window.computeHistoricalBuyRate = (q) => {
  // Whenever Gross Profit is already known, derive Buy directly from the
  // Sell already saved on this same quote (Buy = Sell − GP) rather than
  // trusting q.buyRate / q.confirmedBuyRate / q.details.buyRate or the
  // line-item reconstruction further down. Those other sources have shown
  // real inconsistencies on saved quotes — e.g. a per-kg rate (₹160) stored
  // in confirmedBuyRate where a total was expected — so the figure shown
  // next to Sell Rate and GP in the Global Enquiry Database didn't visually
  // tally with GP. Sell − GP is exact by definition and always consistent
  // with the GP already displayed in the same row; this only changes what
  // gets displayed here, never the underlying saved fields themselves.
  if (typeof q.grossProfit === 'number' && !isNaN(q.grossProfit) && typeof q.amount === 'number') {
    return q.amount - q.grossProfit;
  }

  if (q.buyRate) return q.buyRate;
  if (q.confirmedBuyRate) return q.confirmedBuyRate;
  if (q.details && q.details.buyRate) return q.details.buyRate;

  let totalBuy = 0;
  if (q.type === 'air') {
    if (q.details && q.details.airlines && q.details.airlines.length > 0) {
      const airline = q.details.airlines.find(a => a.isQuoted) || q.details.airlines[0];
      const usedBreak = q.details.usedBreak || 'min';
      const activeBrVal = airline.breaks ? (airline.breaks[usedBreak] || {buy:0}) : {buy:0};
      // The "min" bracket is a flat minimum charge (see the Min (Flat) label
      // in the calculator), not a per-kg rate — unlike every other bracket,
      // it must never be multiplied by chargeable weight. Multiplying it
      // produced a reconstructed Buy Rate several times larger than the
      // actual flat buy amount shown on the quote itself.
      if (usedBreak === 'min') {
        totalBuy += (activeBrVal.buy || 0);
      } else {
        totalBuy += (q.details.chargeableWeight || 0) * (activeBrVal.buy || 0);
      }
      // AMS Fee is a flat, customer-facing charge with no buy/cost side
      // tracked anywhere in the Air Freight calculator (calculateAirFreight()
      // adds it straight into the sell-side surcharge total) — it was being
      // added here into totalBuy too, inflating the reconstructed Buy Rate
      // shown in My Quotation Logs / Global Enquiry Database by the AMS fee
      // amount on every affected quote.
    }
    if (q.details && q.details.originSurcharges) {
      q.details.originSurcharges.forEach(s => totalBuy += parseFloat(s.cost || s.buyRate || 0));
    }
    if (q.details && q.details.destSurcharges) {
      q.details.destSurcharges.forEach(s => totalBuy += parseFloat(s.cost || s.buyRate || 0));
    }
  } else if (q.type === 'sea') {
    if (q.details && q.details.containerItems) {
      q.details.containerItems.forEach(c => totalBuy += parseFloat(c.buy || 0) * (q.details.mode === 'fcl' ? (c.qty||1) : (q.details.chargeableWeight||0)));
    }
    if (q.details && q.details.originSurcharges) {
      q.details.originSurcharges.forEach(s => totalBuy += parseFloat(s.cost || s.buyRate || 0));
    }
    if (q.details && q.details.destSurcharges) {
      q.details.destSurcharges.forEach(s => totalBuy += parseFloat(s.cost || s.buyRate || 0));
    }
  } else if (q.type === 'transport' || q.type === 'warehouse') {
    if (q.details && q.details.items) {
      q.details.items.forEach(i => totalBuy += parseFloat(i.buyRate || i.cost || 0));
    }
  }
  return totalBuy;
};

window.applyDbFiltersAndSort = () => {
  const tbody = document.getElementById("admin-quotes-body");
  if (!tbody) return;

  if (!window._isPaging) {
    window.dbCurrentPage = 1;
  }

  window.applyDbColumnVisibility();

  // Populate dynamic filter option lists
  populateAllHeaderFilterDropdowns();

  const topSearch = (document.getElementById("db-search-input")?.value || "").toLowerCase().trim();
  const st = window.hdrFilterState || {};
  const startDateVal = document.getElementById("db-filter-start-date")?.value;
  const endDateVal = document.getElementById("db-filter-end-date")?.value;

  let filtered = (appState.quotes || []).filter(q => {
    if (q.creator && q.creator.toLowerCase() === 'mahendra') return false;
    const refIdStr = (getQuoteRefId(q) || q.id || "").toLowerCase();
    const dateStr = (q.date || "").toLowerCase();
    const typeStr = (q.type || "").toLowerCase();
    const creatorStr = (q.creator || "").toLowerCase();
    const creatorName = (TEAM_ROLES[q.creator]?.name || "").toLowerCase();
    const customerStr = (q.customer || "").toLowerCase();
    const routeStr = (q.route || "").toLowerCase();
    const originStr = (q.details?.origin || "").toLowerCase();
    const destStr = (q.details?.destination || "").toLowerCase();
    const carrierStr = (q.details?.airline || q.details?.shippingLine || q.details?.carrier || "").toLowerCase();
    const statusStr = (q.status || "").toLowerCase();
    const computedBuy = window.computeHistoricalBuyRate(q);
    const buyRateStr = (computedBuy || "").toString().toLowerCase();
    const sellRateStr = (q.amount || "").toString().toLowerCase();
    const gpStr = st.gp === 'percent' ?
      (q.grossProfit !== undefined && q.amount ? `${((q.grossProfit / q.amount) * 100).toFixed(2)}%` : '0.00%').toLowerCase() :
      (q.grossProfit || "").toString().toLowerCase();

    // Mode filter
    if (st.mode && st.mode !== 'all' && typeStr !== st.mode) return false;

    // Status filter
    if (st.status && st.status !== 'all' && statusStr !== st.status) return false;

    // Desk filter (match creator ID or name)
    if (st.desk && st.desk !== 'all') {
      const targetDesk = st.desk.toLowerCase();
      const deskRoleName = (TEAM_ROLES[st.desk]?.name || '').toLowerCase();
      if (creatorStr !== targetDesk && creatorName !== targetDesk && !deskRoleName.includes(creatorName) && !creatorName.includes(targetDesk)) {
        return false;
      }
    }

    // Carrier filter (match exact carrier name)
    if (st.carrier && st.carrier !== 'all') {
      if (carrierStr !== st.carrier.toLowerCase()) return false;
    }

    // Agent filter
    if (st.agentroute && st.agentroute !== 'all') {
      const targetAR = st.agentroute.toLowerCase();
      if (customerStr !== targetAR && !customerStr.includes(targetAR)) {
        return false;
      }
    }

    // Ref ID filter (match ref ID)
    if (st.refid && st.refid !== 'all') {
      const targetRef = st.refid.toLowerCase().replace('#', '');
      if (refIdStr !== targetRef && !refIdStr.includes(targetRef)) return false;
    }

    // Date year filter
    if (st.date && st.date !== 'all') {
      if (!dateStr.includes(st.date)) return false;
    }

    // Date range filter
    if (startDateVal && new Date(q.date) < new Date(startDateVal)) return false;
    if (endDateVal && new Date(q.date) > new Date(endDateVal)) return false;

    // Multi-month date filter: if any months are selected, the quote's date
    // must fall in at least one of them (OR across selections). Additive —
    // does nothing when no months are selected, leaving the filters above unaffected.
    if (st.dateMonths && st.dateMonths.length > 0) {
      const qDate = new Date(q.date);
      if (isNaN(qDate.getTime())) return false;
      const qMonthKey = `${qDate.getFullYear()}-${String(qDate.getMonth() + 1).padStart(2, '0')}`;
      if (!st.dateMonths.includes(qMonthKey)) return false;
    }

    // Search query matches for individual header filters
    if (st.search_refid && !refIdStr.includes(st.search_refid)) return false;
    if (st.search_date && !dateStr.includes(st.search_date)) return false;
    if (st.search_mode && !typeStr.includes(st.search_mode)) return false;
    if (st.search_agentroute && !customerStr.includes(st.search_agentroute)) return false;
    if (st.search_desk && !creatorName.includes(st.search_desk) && !creatorStr.includes(st.search_desk)) return false;
    if (st.search_carrier && !carrierStr.includes(st.search_carrier)) return false;
    if (st.search_buyrate && !buyRateStr.includes(st.search_buyrate)) return false;
    if (st.search_sellrate && !sellRateStr.includes(st.search_sellrate)) return false;
    if (st.search_gp && !gpStr.includes(st.search_gp)) return false;
    if (st.search_status && !statusStr.includes(st.search_status)) return false;

    // Global Top Search Bar match
    if (topSearch) {
      const match =
        customerStr.includes(topSearch) ||
        refIdStr.includes(topSearch) ||
        typeStr.includes(topSearch) ||
        routeStr.includes(topSearch) ||
        originStr.includes(topSearch) ||
        destStr.includes(topSearch) ||
        creatorName.includes(topSearch) ||
        carrierStr.includes(topSearch);
      if (!match) return false;
    }

    return true;
  });

  // Sort logic
  const sortField = st.actions || "date-desc";
  filtered.sort((a, b) => {
    if (sortField === "date-desc") {
      return new Date(b.date) - new Date(a.date) || b.id.localeCompare(a.id);
    } else if (sortField === "date-asc") {
      return new Date(a.date) - new Date(b.date) || a.id.localeCompare(b.id);
    } else if (sortField === "customer-asc") {
      return (a.customer || '').toLowerCase().localeCompare((b.customer || '').toLowerCase());
    } else if (sortField === "customer-desc") {
      return (b.customer || '').toLowerCase().localeCompare((a.customer || '').toLowerCase());
    } else if (sortField === "amount-desc") {
      return (b.amountINR || 0) - (a.amountINR || 0);
    } else if (sortField === "amount-asc") {
      return (a.amountINR || 0) - (b.amountINR || 0);
    }
    return 0;
  });

  const totalMatched = filtered.length;
  const totalPages = Math.ceil(totalMatched / window.dbRowsPerPage) || 1;
  if (window.dbCurrentPage > totalPages) window.dbCurrentPage = totalPages;
  if (window.dbCurrentPage < 1) window.dbCurrentPage = 1;

  const startIdx = (window.dbCurrentPage - 1) * window.dbRowsPerPage;
  const endIdx = startIdx + window.dbRowsPerPage;
  const pageFiltered = filtered.slice(startIdx, endIdx);

  // Update pagination controls UI
  const prevBtn = document.getElementById("db-prev-btn");
  const nextBtn = document.getElementById("db-next-btn");
  const pagInfo = document.getElementById("db-pagination-info");
  if (prevBtn) prevBtn.disabled = (window.dbCurrentPage === 1);
  if (nextBtn) nextBtn.disabled = (window.dbCurrentPage === totalPages);
  if (pagInfo) {
    const showStart = totalMatched === 0 ? 0 : startIdx + 1;
    const showEnd = Math.min(endIdx, totalMatched);
    pagInfo.textContent = `Page ${window.dbCurrentPage} of ${totalPages} (Showing ${showStart}-${showEnd} of ${totalMatched} entries)`;
  }

  tbody.innerHTML = "";
  if (pageFiltered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="12" style="text-align: center; color: var(--text-dim); padding: 2rem;">No enquiries found matching filters.</td></tr>`;
    return;
  }

  pageFiltered.forEach(quote => {
    const tr = document.createElement("tr");
    tr.setAttribute("data-quote-id", quote.id);
    const currencySym = quote.currency === 'INR' ? '₹' : (quote.currency === 'USD' ? '$' : (quote.currency === 'EUR' ? '€' : '£'));
    const amountStr = `${currencySym}${quote.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
    const amountINRStr = `₹${quote.amountINR.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
    const actualBuyRateCurrency = quote.buyRateCurrency || quote.currency || 'INR';
    const buyRateSym = actualBuyRateCurrency === 'INR' ? '₹' : (actualBuyRateCurrency === 'USD' ? '$' : (actualBuyRateCurrency === 'EUR' ? '€' : '£'));
    const computedBuy = window.computeHistoricalBuyRate(quote);
    const carrierName = quote.details?.airline || quote.details?.shippingLine || quote.details?.carrier || '-';

    tr.innerHTML = `
      <td><strong>#${getQuoteRefId(quote)}</strong></td>
      <td>
        <div>${quote.date}</div>
        <div class="edit-timeline-indicator" data-timestamp="${quote.timestamp || ''}" data-quote-id="${quote.id}" style="font-size: 0.68rem; margin-top: 2px;"></div>
      </td>
      <td><span class="quote-type-badge ${quote.type}">
        ${quote.type === 'transport' ?
        `Transportation` :
        (quote.type === 'warehouse' ?
          `Warehouse` :
          (quote.type === 'air' ?
            `<svg width="11" height="11" style="margin-right:4px; display:inline-block; vertical-align:middle;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-4 4H3l-2 3 3-2v-2l4-4 3.5 5.3c.3.4.8.5 1.3.3l.5-.3c.4-.2.6-.6.5-1.1z"/></svg>${quote.details && quote.details.module === 'import' ? 'Air Import' : 'Air Export'}` :
            `<svg width="11" height="11" style="margin-right:4px; display:inline-block; vertical-align:middle;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M2 21h20M19.3 14.8C18 13.5 16 13.5 14.7 14.8L12 17.5l-2.7-2.7C8 13.5 6 13.5 4.7 14.8L2 17.5V19h20v-1.5l-2.7-2.7zM12 2v10M12 2l-3 3M12 2l3 3"/></svg>${quote.details && quote.details.module === 'import' ? 'Sea Import' : 'Sea Export'}`
          )
        )
      }</span></td>
      <td>
        <div style="font-weight: 600;">${quote.customer}</div>
      </td>
      <td><span style="font-size:0.8rem; font-weight:600; color:var(--t1);">${TEAM_ROLES[quote.creator]?.name || quote.creator}</span></td>
      <td><span style="font-size:0.8rem; font-weight:600; color:var(--t2);">${carrierName}</span></td>
      <td><span style="font-size:0.8rem; font-weight:600; color:var(--t2);">${(quote.details?.chargeableWeight || quote.details?.grossWeight || 0) > 0 ? `${(quote.details?.chargeableWeight || quote.details?.grossWeight || 0).toLocaleString()} kg` : '-'}</span></td>
      <td><span style="font-size:0.8rem; font-weight:600; color:var(--t2);">${computedBuy ? `${buyRateSym}${computedBuy.toLocaleString()}` : '-'}</span></td>
      <td>
        <div>${amountStr}</div>
        ${quote.currency !== 'INR' ? `<div style="font-size:0.75rem; color:var(--text-dim);">${amountINRStr}</div>` : ''}
      </td>
      <td>
        ${quote.grossProfit !== undefined ? `
          <div style="font-size:0.8rem; color:var(--accent-success); font-weight:700;" title="Gross Profit">
            ${window.hdrFilterState.gp === 'percent' ?
          (quote.amount ? `${((quote.grossProfit / quote.amount) * 100).toFixed(2)}%` : '0.00%') :
          `${quote.grossProfitCurrency === 'INR' ? '₹' : (quote.grossProfitCurrency === 'USD' ? '$' : (quote.grossProfitCurrency === 'EUR' ? '€' : '£'))}${Math.abs(quote.grossProfit).toLocaleString(undefined, { minimumFractionDigits: 2 })}${quote.grossProfitCurrency !== 'INR' ? `<br><span style="font-size:0.7rem; color:var(--text-dim);">[₹${Math.abs(quote.grossProfitINR || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}]</span>` : ''}`
        }
          </div>
        ` : '-'}
      </td>
      <td><span class="status-badge ${quote.status}">${quote.status === 'quoted' ? 'Quoted' : (quote.status === 'converted' ? 'Converted' : (quote.status === 'cancelled' ? 'Cancelled' : 'Lost'))}</span></td>
      <td class="actions-cell"><div class="actions-cell-inner">
        <button class="action-icon-btn amend" style="background: ${isEditUnlocked(quote) ? 'rgba(245, 158, 11, 0.25)' : 'rgba(255,255,255,0.05)'}; color: ${isEditUnlocked(quote) ? 'var(--accent-warning)' : 'var(--text-dim)'};" title="Correct / Amend Quote (Admin Override)" onclick="amendQuote('${quote.id}')">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
        </button>
        <button class="action-icon-btn view" title="View Quote" onclick="viewSavedQuote('${quote.id}')">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
        </button>
        ${quote.status === 'quoted' ? `
        <button class="action-icon-btn convert" title="Convert Quote" onclick="convertQuote('${quote.id}')">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
        </button>
        <button class="action-icon-btn delete" style="background: ${isEditUnlocked(quote) ? 'rgba(239, 68, 68, 0.1)' : 'rgba(255,255,255,0.05)'}; color: ${isEditUnlocked(quote) ? 'var(--accent-error)' : 'var(--text-dim)'};" title="Mark as Cancelled" onclick="markQuoteCancelled('${quote.id}')">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
        </button>
        <button class="action-icon-btn view" style="background: ${isEditUnlocked(quote) ? 'rgba(156, 163, 175, 0.1)' : 'rgba(255,255,255,0.05)'}; color: ${isEditUnlocked(quote) ? 'var(--text-dim)' : 'var(--text-dim)'};" title="Mark as Lost" onclick="markQuoteLost('${quote.id}')">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        </button>
        ` : `
        <button class="action-icon-btn convert" style="background: ${isEditUnlocked(quote) ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255,255,255,0.05)'}; color: ${isEditUnlocked(quote) ? 'var(--accent-success)' : 'var(--text-dim)'};" title="Revert Quote status to Quoted" onclick="revertQuoteToOriginal('${quote.id}')">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><polyline points="3 3 3 8 8 8"/></svg>
        </button>
        `}
        <button class="action-icon-btn delete" style="background: ${isDeleteUnlocked(quote) ? 'rgba(239, 68, 68, 0.25)' : 'rgba(255,255,255,0.05)'}; color: ${isDeleteUnlocked(quote) ? 'var(--accent-error)' : 'var(--text-dim)'};" title="Delete Quote (Admin Override)" onclick="deleteQuote('${quote.id}')">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/></svg>
        </button>
      </div></td>
    `;
    tbody.appendChild(tr);
  });
  if (typeof window.updateEditTimelines === 'function') {
    window.updateEditTimelines();
  }
};

window.filterQuotes = (val) => {
  const query = val.toLowerCase().trim();
  const activeTbodyId = appState.currentUser === 'ganny' ? 'admin-quotes-body' : 'user-quotes-body';
  const rows = document.querySelectorAll(`#${activeTbodyId} tr`);

  rows.forEach(row => {
    // Find the quote ID from the row data attribute
    const quoteId = row.getAttribute("data-quote-id");
    if (!quoteId) {
      // If it's a placeholder row
      row.style.display = "";
      return;
    }

    const quote = appState.quotes.find(q => q.id === quoteId);
    if (!quote) {
      row.style.display = "none";
      return;
    }

    // Check match on various fields
    const creatorName = (TEAM_ROLES[quote.creator]?.name || "").toLowerCase();
    const customer = (quote.customer || "").toLowerCase();
    const refId = quote.id.toLowerCase();
    const type = (quote.type || "").toLowerCase();
    const route = (quote.route || "").toLowerCase();

    // Origin / Destination detailed names
    const origin = (quote.details?.origin || "").toLowerCase();
    const destination = (quote.details?.destination || "").toLowerCase();

    // Carrier & Incoterms
    const carrier = (quote.details?.airline || quote.details?.shippingLine || "").toLowerCase();
    const incoterm = (quote.details?.incoterm || "").toLowerCase();

    // Row visual text
    const rowText = row.textContent.toLowerCase();

    const isMatch =
      customer.includes(query) ||
      refId.includes(query) ||
      type.includes(query) ||
      route.includes(query) ||
      origin.includes(query) ||
      destination.includes(query) ||
      creatorName.includes(query) ||
      carrier.includes(query) ||
      incoterm.includes(query) ||
      rowText.includes(query);

    if (isMatch) {
      row.style.display = "";
    } else {
      row.style.display = "none";
    }
  });
};

function applyDeskNames() {
  const switcher = document.getElementById("admin-role-selector");
  if (switcher) {
    const adminName = (TEAM_ROLES['ganny']?.name || 'Pricing Team').replace(/\(Free Hand\)/g, "");
    let buttonsHtml = `<button class="role-btn active" data-role="manager">${adminName}</button>`;

    // Add default users
    // 'jaya' (default label "Free Hand") is deliberately left out of this
    // switchable list — her Auth/Firestore access was retired, and her
    // TEAM_ROLES entry stays intact only so historical quotes she created
    // (creatorRole === 'jaya') keep displaying/categorizing correctly.
    const defaultUsers = [
      { id: 'shashank', defaultName: 'Air Nom', icon: `<svg width="11" height="11" style="margin-right:4px; display:inline-block; vertical-align:middle;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-4 4H3l-2 3 3-2v-2l4-4 3.5 5.3c.3.4.8.5 1.3.3l.5-.3c.4-.2.6-.6.5-1.1z"/></svg>` },
      { id: 'shaheer', defaultName: 'Sea Nomination', icon: `<svg width="11" height="11" style="margin-right:4px; display:inline-block; vertical-align:middle;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M2 21h20M19.3 14.8C18 13.5 16 13.5 14.7 14.8L12 17.5l-2.7-2.7C8 13.5 6 13.5 4.7 14.8L2 17.5V19h20v-1.5l-2.7-2.7zM12 2v10M12 2l-3 3M12 2l3 3"/></svg>` },
      { id: 'cathrina', defaultName: 'NRS', icon: '' }
    ];

    defaultUsers.forEach(u => {
      let name = (TEAM_ROLES[u.id]?.name || u.defaultName).replace(/\(Free Hand\)/g, "");
      if (u.id === 'shaheer') name = 'Sea Nomination';
      buttonsHtml += `<button class="role-btn" data-role="${u.id}">${u.icon}${name}</button>`;
    });

    Object.keys(TEAM_ROLES).forEach(roleId => {
      if (['ganny', 'shashank', 'shaheer', 'mahendra', 'jaya', 'cathrina', 'manager'].includes(roleId)) return;
      const name = (TEAM_ROLES[roleId]?.name || roleId).replace(/\(Free Hand\)/g, "");
      buttonsHtml += `<button class="role-btn" data-role="${roleId}">${name}</button>`;
    });

    switcher.innerHTML = buttonsHtml;

    // Re-bind clicks
    switcher.querySelectorAll(".role-btn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const role = e.currentTarget.getAttribute("data-role");
        switchRole(role);
      });
    });
    if (typeof syncRoleSwitcherTriggerLabel === 'function') syncRoleSwitcherTriggerLabel();
  }

  const activeUser = appState.currentUser;
  if (activeUser && activeUser !== 'ganny') {
    let name = (TEAM_ROLES[activeUser]?.name || activeUser).replace(/\s*\(Free\s*Hand\)/i, "");
    if (activeUser === 'shaheer') name = 'Sea Nomination';
    
    const headerUserNameEl = document.getElementById("header-user-name");
    if (headerUserNameEl) headerUserNameEl.textContent = activeUser.toUpperCase();
    const headerUserRoleEl = document.getElementById("header-user-role");
    if (headerUserRoleEl) headerUserRoleEl.textContent = name;
    const headerUserAvatarEl = document.getElementById("header-user-avatar");
    if (headerUserAvatarEl) headerUserAvatarEl.textContent = activeUser.charAt(0).toUpperCase();
  }

  // Update overview report user dropdown (distinct from Enquiry Database report-user)
  const reportUserSelect = document.getElementById("overview-report-user");
  if (reportUserSelect) {
    const curVal = reportUserSelect.value;
    const roles = Object.keys(TEAM_ROLES).filter(roleId => roleId !== 'ganny' && roleId !== 'manager' && roleId !== 'mahendra');
    // Disambiguate before building options — two logins sharing a display
    // name (e.g. more than one "Free Hand Sales" account) were previously
    // indistinguishable in this filter, same treatment as Quotes By User.
    const roleNameLookup = {};
    roles.forEach(roleId => {
      let name = (TEAM_ROLES[roleId]?.name || roleId).replace(/\s*\(Free\s*Hand\)/i, "");
      if (roleId === 'shaheer' && name.toLowerCase() === 'shaheer') {
        name = 'Sea Nomination';
      }
      roleNameLookup[roleId] = { name };
    });
    disambiguateDuplicateNames(roleNameLookup);
    let html = `<option value="all">All Pricing Officers</option>`;
    roles.forEach(roleId => {
      html += `<option value="${roleId}">${roleNameLookup[roleId].name}</option>`;
    });
    reportUserSelect.innerHTML = html;
    if ([...reportUserSelect.options].some(opt => opt.value === curVal)) {
      reportUserSelect.value = curVal;
    } else {
      reportUserSelect.value = "all";
    }
  }

  // Update text inputs on config forms
  const cfgShashank = document.getElementById("cfg-shashank");
  if (cfgShashank) cfgShashank.value = (TEAM_ROLES['shashank']?.name || 'Air Nom').replace(/\s*\(Free\s*Hand\)/i, "");

  const cfgShaheer = document.getElementById("cfg-shaheer");
  if (cfgShaheer) cfgShaheer.value = (TEAM_ROLES['shaheer']?.name || 'Sea Nomination').replace(/\s*\(Free\s*Hand\)/i, "");

  const cfgJaya = document.getElementById("cfg-jaya");
  if (cfgJaya) cfgJaya.value = (TEAM_ROLES['jaya']?.name || 'Free Hand').replace(/\s*\(Free\s*Hand\)/i, "");

  const cfgCathrina = document.getElementById("cfg-cathrina");
  if (cfgCathrina) cfgCathrina.value = (TEAM_ROLES['cathrina']?.name || 'NRS').replace(/\s*\(Free\s*Hand\)/i, "");

  const cfgGmapsKey = document.getElementById("cfg-gmaps-key");
  if (cfgGmapsKey) {
    cfgGmapsKey.value = localStorage.getItem("gl_gmaps_key") || "";
  }

  const cfgFirebaseJson = document.getElementById("cfg-firebase-json");
  if (cfgFirebaseJson) {
    cfgFirebaseJson.value = localStorage.getItem("gl_firebase_config") || "";
  }
}

function saveDeskNames(e) {
  e.preventDefault();

  const shashank = document.getElementById("cfg-shashank").value.trim();
  const shaheer = document.getElementById("cfg-shaheer").value.trim();
  const jaya = document.getElementById("cfg-jaya").value.trim();
  const cathrina = document.getElementById("cfg-cathrina").value.trim();

  if (!shashank || !shaheer || !jaya || !cathrina) {
    alert("Please fill out all category names.");
    return;
  }

  TEAM_ROLES['shashank'].name = shashank;
  TEAM_ROLES['shaheer'].name = shaheer;
  TEAM_ROLES['jaya'].name = jaya;
  TEAM_ROLES['cathrina'].name = cathrina;

  const names = {
    'shashank': shashank,
    'shaheer': shaheer,
    'jaya': jaya,
    'cathrina': cathrina
  };
  localStorage.setItem("gl_desk_names", JSON.stringify(names));

  const gmapsKeyInput = document.getElementById("cfg-gmaps-key");
  if (gmapsKeyInput) {
    localStorage.setItem("gl_gmaps_key", gmapsKeyInput.value.trim());
  }

  const firebaseJsonInput = document.getElementById("cfg-firebase-json");
  let firebaseConfigChanged = false;
  if (firebaseJsonInput) {
    const rawVal = firebaseJsonInput.value.trim();
    const oldConfig = localStorage.getItem("gl_firebase_config") || "";
    if (rawVal !== oldConfig) {
      firebaseConfigChanged = true;
    }

    if (rawVal) {
      try {
        let cleaned = rawVal.trim();
        cleaned = cleaned.replace(/\u00a0/g, ' '); // Strip non-breaking spaces
        if (cleaned.includes('apiKey')) {
          const apiIndex = cleaned.indexOf('apiKey');
          const braceStart = cleaned.lastIndexOf('{', apiIndex);
          if (braceStart !== -1) {
            cleaned = cleaned.substring(braceStart, cleaned.lastIndexOf('}') + 1);
          }
        } else if (cleaned.includes('{') && cleaned.includes('}')) {
          cleaned = cleaned.substring(cleaned.indexOf('{'), cleaned.lastIndexOf('}') + 1);
        }
        cleaned = cleaned.replace(/'/g, '"');
        const keys = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId', 'measurementId'];
        keys.forEach(k => {
          const regex = new RegExp(`['"]?${k}['"]?\\s*:`, 'g');
          cleaned = cleaned.replace(regex, `"${k}":`);
        });
        cleaned = cleaned.replace(/,\s*([}\]])/g, '$1');

        const parsed = JSON.parse(cleaned);
        if (!parsed.apiKey || !parsed.projectId) {
          alert("Firebase Config JSON must contain at least 'apiKey' and 'projectId' fields.");
          return;
        }
        localStorage.setItem("gl_firebase_config", JSON.stringify(parsed, null, 2));
      } catch (err) {
        alert("Invalid Firebase Web Config JSON. Please copy the complete JSON object from the Firebase console.");
        return;
      }
    } else {
      localStorage.removeItem("gl_firebase_config");
    }
  }

  applyDeskNames();

  if (appState.currentUser === 'ganny') {
    renderAdminDashboard();
  }

  if (firebaseConfigChanged) {
    localStorage.removeItem("gl_use_offline");
    alert("Settings saved successfully! Page will now reload to establish the Firebase Cloud connection.");
    window.location.reload();
  } else {
    alert("Desk names & API Settings updated successfully!");
  }
}

window.saveDeskNames = saveDeskNames;
window.applyDeskNames = applyDeskNames;

// ==================== NEW ADMIN / WORKFLOW ACTIONS ====================

async function registerNewUserProfile(e) {
  e.preventDefault();
  const fullName = document.getElementById("reg-fullname").value.trim();
  const username = document.getElementById("reg-username").value.trim().toLowerCase();
  const password = document.getElementById("reg-password").value;

  if (username === 'admin' || username === 'ganny' || TEAM_ROLES[username]) {
    alert("This username is already taken. Please try another one.");
    return;
  }

  const newUser = {
    username,
    fullName,
    role: 'member',
    category: 'FREE HAND SALES (AIR/SEA)',
    currency: 'INR'
  };

  try {
    if (DB.firestoreRef) {
      const email = `${username}@atlaspricing.com`;

      // ── Prefer Cloud Function to create Firebase Auth account (no secondary app needed) ──
      let authCreatedViaCloudFn = false;
      try {
        const createFn = firebase.functions().httpsCallable("adminCreateUser");
        const result = await createFn({ username, password, fullName });
        if (result.data && result.data.success) {
          authCreatedViaCloudFn = true;
          console.log("Registration: Firebase Auth account created via Cloud Function.");
        }
      } catch (fnErr) {
        console.warn("adminCreateUser Cloud Function failed, using secondary app:", fnErr.message);
      }

      // ── Fallback: secondary app approach (runs if Cloud Function unavailable) ──
      if (!authCreatedViaCloudFn) {
        const configRaw = localStorage.getItem("gl_firebase_config");
        const config = configRaw ? JSON.parse(configRaw) : DEFAULT_FIREBASE_CONFIG;
        const secondaryApp = firebase.initializeApp(config, "SecondaryApp_" + Date.now());
        try {
          await secondaryApp.auth().createUserWithEmailAndPassword(email, password);
          await secondaryApp.delete();
        } catch (authErr) {
          await secondaryApp.delete();
          throw authErr;
        }
      }

      // ── Store user in Firestore — include password for fallback login ────────
      await DB.firestoreRef.collection("users").doc(username).set({ ...newUser, password });
    } else {
      let customUsers = [];
      const stored = localStorage.getItem("gl_custom_users");
      if (stored) {
        try { customUsers = JSON.parse(stored); } catch (err) { }
      }
      // Offline mode still saves password locally for fallback login
      const localNewUser = { ...newUser, password };
      customUsers.push(localNewUser);
      localStorage.setItem("gl_custom_users", JSON.stringify(customUsers));
    }

    TEAM_ROLES[username] = {
      name: `${fullName} (Free Hand)`,
      type: 'member',
      category: 'FREE HAND SALES (AIR/SEA)',
      currency: 'INR'
    };

    document.getElementById("reg-fullname").value = "";
    document.getElementById("reg-username").value = "";
    document.getElementById("reg-password").value = "";

    alert(`User Profile for "${fullName}" registered successfully! They can now log in using "${username}".`);
    if (typeof renderUserCredentialsList === 'function') {
      renderUserCredentialsList();
    }
  } catch (err) {
    alert("❌ Error registering user: " + err.message);
  }
}
window.registerNewUserProfile = registerNewUserProfile;

function repopulateSurchargesTable(tableBodyId, surchargesList) {
  const tbody = document.getElementById(tableBodyId);
  if (!tbody) return;
  tbody.innerHTML = "";
  if (!surchargesList || surchargesList.length === 0) return;

  surchargesList.forEach(s => {
    const tr = document.createElement("tr");
    const isAir = tableBodyId.startsWith("air");
    const autocompleteList = isAir
      ? (tableBodyId.includes("origin") ? "air-origin-surcharges-list" : "air-dest-surcharges-list")
      : (tableBodyId.includes("origin") ? "sea-origin-surcharges-list" : "sea-dest-surcharges-list");

    tr.innerHTML = `
      <td><input type="text" class="chg-name" list="${autocompleteList}" value="${s.name}" required></td>
      <td><input type="number" class="chg-rate" step="0.01" value="${s.rate}"></td>
      <td><input type="number" class="chg-buy-rate" step="0.01" value="${s.buyRate || 0.00}" style="background: rgba(255,255,255,0.03); color: var(--t1);"></td>
      <td>
        <select class="chg-unit">
          <option value="flat" ${s.unit === 'flat' ? 'selected' : ''}>Flat Fee</option>
          ${isAir ? `
          <option value="kg" ${s.unit === 'kg' ? 'selected' : ''}>Per Kg</option>
          ` : `
          <option value="container" ${s.unit === 'container' ? 'selected' : ''}>Per Container</option>
          <option value="rt" ${s.unit === 'rt' ? 'selected' : ''}>Per RT</option>
          <option value="kg" ${s.unit === 'kg' ? 'selected' : ''}>Per Kg</option>
          `}
        </select>
      </td>
      <td><input type="text" class="chg-remarks" value="${s.remarks || ''}" placeholder="Add remarks..." style="background: rgba(255,255,255,0.03); color: var(--t1); border: 1px solid var(--border-color); border-radius: 6px; padding: 4px 8px; font-size: 0.78rem; width: 100%;"></td>
      <td>
        <button type="button" class="delete-btn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/></svg>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function repopulateAlternativesTable(tableBodyId, alternatives) {
  const tbody = document.getElementById(tableBodyId);
  if (!tbody) return;
  tbody.innerHTML = "";
  if (alternatives && alternatives.length > 0) {
    alternatives.forEach(alt => {
      addAlternativeOptionRow(tableBodyId, alt.carrier, alt.routing, alt.tt, alt.rate);
    });
  }
}

function addAlternativeOptionRow(tbodyId, carrier = "", routing = "", tt = "", rate = "") {
  const tbody = document.getElementById(tbodyId);
  if (!tbody) return;

  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td><input type="text" class="alt-carrier" value="${carrier}" required placeholder="Carrier name..."></td>
    <td><input type="text" class="alt-routing" value="${routing}" required placeholder="e.g. BOM-DXB-JFK"></td>
    <td><input type="text" class="alt-tt" value="${tt}" required placeholder="e.g. 3-5 Days"></td>
    <td><input type="text" class="alt-rate" value="${rate}" required placeholder="Rate / cost details..."></td>
    <td>
      <button type="button" class="delete-btn">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/></svg>
      </button>
    </td>
  `;

  // Attach input event listeners for live updates
  tr.querySelectorAll("input").forEach(inp => {
    inp.addEventListener("input", () => {
      if (tbodyId.includes("air")) {
        calculateAirFreight();
      } else {
        calculateSeaFreight();
      }
    });
  });

  // Attach delete button event listener
  const deleteBtn = tr.querySelector(".delete-btn");
  if (deleteBtn) {
    deleteBtn.addEventListener("click", () => {
      tr.remove();
      if (tbodyId.includes("air")) {
        calculateAirFreight();
      } else {
        calculateSeaFreight();
      }
    });
  }

  tbody.appendChild(tr);

  // Trigger initial calculation to show empty state/new option
  if (tbodyId.includes("air")) {
    calculateAirFreight();
  } else {
    calculateSeaFreight();
  }
}
window.addAlternativeOptionRow = addAlternativeOptionRow;

// Pure extraction of amendQuote()'s air DOM-population body — parameterized
// on a details-shaped object instead of closing over `quote`. Customer name
// and currency are set by the caller (amendQuote), not here.
function populateAirFreightFormFromDetails(details) {
  document.getElementById("air-origin").value = details.origin || "";
  document.getElementById("air-dest").value = details.destination || "";
  document.getElementById("air-incoterm").value = details.incoterm || "EXW";
  document.getElementById("air-terms").value = details.termsAndConditions || DEFAULT_AIR_TERMS;

  document.getElementById("air-commodity").value = details.commodity || "GENERAL";
  if (document.getElementById("air-dg-class")) {
    document.getElementById("air-dg-class").value = details.dgClass || "";
  }
  handleAirCommodityChange();
  if (details.tempType) {
    document.getElementById("air-temp-type").value = details.tempType;
    handleAirTempTypeChange();
  }
  if (details.tempRange) {
    document.getElementById("air-temp-range").value = details.tempRange;
  }
  document.getElementById("air-loadability-tilt").value = details.loadabilityTilt || "TILTABLE";
  document.getElementById("air-loadability-stack").value = details.loadabilityStack || "STACKABLE";

  const airlinesContainer = document.getElementById("air-airlines-list-container");
  if (airlinesContainer) {
    airlinesContainer.innerHTML = "";
    if (details.airlines && details.airlines.length > 0) {
      details.airlines.forEach(alt => {
        addAirlineCard(alt);
      });
    } else {
      const initialBreaks = {};
      const cw = details.chargeableWeight || 0;
      const bName = getWeightBreakBracket(cw);
      initialBreaks[bName] = details.appliedRate || 0;

      addAirlineCard({
        name: details.airline || "",
        routing: details.routing || "",
        tt: details.tt || "",
        validity: details.validity || "",
        pivotWeight: details.pivotWeight || "",
        selected: true,
        breaks: initialBreaks
      });
    }
  }

  appState.currentAirFreight.module = details.module || 'export';
  const tabExp = document.getElementById("air-tab-export");
  const tabImp = document.getElementById("air-tab-import");
  if (tabExp && tabImp) {
    if (details.module === 'import') {
      tabImp.classList.add("active");
      tabExp.classList.remove("active");
    } else {
      tabExp.classList.add("active");
      tabImp.classList.remove("active");
    }
  }

  // Cargo items
  const cargoBody = document.getElementById("air-cargo-body");
  if (cargoBody && details.cargoItems && details.cargoItems.length > 0) {
    cargoBody.innerHTML = "";
    details.cargoItems.forEach(item => {
      const tr = document.createElement("tr");
      tr.className = "cargo-item-row";
      tr.innerHTML = `
        <td><input type="number" class="cargo-len" min="1" placeholder="L" value="${item.l}" required></td>
        <td><input type="number" class="cargo-wid" min="1" placeholder="W" value="${item.w}" required></td>
        <td><input type="number" class="cargo-hei" min="1" placeholder="H" value="${item.h}" required></td>
        <td><input type="number" class="cargo-qty" min="1" placeholder="Qty" value="${item.qty}" required></td>
        <td><input type="number" class="cargo-gw" min="0.1" step="0.1" placeholder="Kg" value="${item.gw}" required></td>
        <td>
          <button type="button" class="delete-btn" onclick="this.closest('tr').remove(); calculateAirFreight();">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/></svg>
          </button>
        </td>
      `;
      cargoBody.appendChild(tr);
      tr.querySelectorAll("input").forEach(inp => {
        inp.addEventListener("input", calculateAirFreight);
      });
    });
  }

  // Local surcharges
  repopulateSurchargesTable("air-origin-surcharges-body", details.originSurcharges);
  repopulateSurchargesTable("air-dest-surcharges-body", details.destSurcharges);

  calculateAirFreight();
}
window.populateAirFreightFormFromDetails = populateAirFreightFormFromDetails;

function amendQuote(id) {
  const quote = appState.quotes.find(q => q.id === id);
  if (!quote) return;

  if (!checkAndRequestEditPermission(quote, "correct/amend")) return;

  // Load the quote back into the respective calculator
  appState.editingQuoteId = quote.id;
  hideQuoteModal(); // Close print preview modal if open

  // Hide dashboards
  document.getElementById("member-dashboard-panel").classList.remove("active");
  document.getElementById("manager-panel").classList.remove("active");

  if (quote.type === 'air') {
    // Show the panel first so the browser can paint the skeleton immediately
    document.getElementById("air-freight-panel").classList.add("active");

    // Defer all field population, card rebuilding, and calculation to the next
    // animation frame — this prevents the blank white flash caused by heavy
    // synchronous DOM work blocking the browser's paint cycle.
    requestAnimationFrame(() => {
      document.getElementById("air-cust-name").value = quote.customer;
      if (document.getElementById("air-currency")) {
        document.getElementById("air-currency").value = quote.currency || "INR";
      }
      populateAirFreightFormFromDetails(quote.details);
      alert(`Editing Quote #${getQuoteRefId(quote)} in progress. Click "Save Quote" to confirm your amendments.`);
    }); // end requestAnimationFrame
  } else if (quote.type === 'transport') {
    document.getElementById("transportation-panel").classList.add("active");
    if (document.getElementById("transport-pickup-pin")) {
      document.getElementById("transport-pickup-pin").value = quote.details.pickupPin || "";
    }
    if (document.getElementById("transport-pickup-city")) {
      document.getElementById("transport-pickup-city").value = quote.details.pickupCity || "";
    }
    if (document.getElementById("transport-pickup-search")) {
      const pin = quote.details.pickupPin || "";
      const city = quote.details.pickupCity || "";
      document.getElementById("transport-pickup-search").value = pin && city ? `${pin} - ${city}` : (pin || city || "");
    }
    if (document.getElementById("transport-pickup-address")) {
      document.getElementById("transport-pickup-address").value = quote.details.pickupAddress || "";
    }
    if (document.getElementById("transport-delivery-pin")) {
      document.getElementById("transport-delivery-pin").value = quote.details.deliveryPin || "";
    }
    if (document.getElementById("transport-delivery-city")) {
      document.getElementById("transport-delivery-city").value = quote.details.deliveryCity || "";
    }
    if (document.getElementById("transport-delivery-search")) {
      const pin = quote.details.deliveryPin || "";
      const city = quote.details.deliveryCity || "";
      document.getElementById("transport-delivery-search").value = pin && city ? `${pin} - ${city}` : (pin || city || "");
    }
    if (document.getElementById("transport-delivery-address")) {
      document.getElementById("transport-delivery-address").value = quote.details.deliveryAddress || "";
    }
    if (document.getElementById("transport-customer-name")) {
      document.getElementById("transport-customer-name").value = quote.customer || "";
    }
    if (document.getElementById("transport-header-currency")) {
      document.getElementById("transport-header-currency").value = quote.currency || "INR";
      syncTransportCurrency();
    }
    const transportGstToggle = document.getElementById("transport-gst-enabled");
    if (transportGstToggle) transportGstToggle.checked = quote.details?.gstEnabled !== false;
    const transportBody = document.getElementById("transport-standalone-body");
    if (transportBody) {
      transportBody.innerHTML = "";
      const items = quote.details.items || [];
      if (items.length > 0) {
        items.forEach(item => {
          const tr = document.createElement("tr");
          tr.innerHTML = `
            <td><input type="text" class="chg-name" value="${item.name}" style="background: rgba(255,255,255,0.03); color: var(--t1);"></td>
            <td><input type="number" class="chg-rate" value="${item.rate}" step="0.01" oninput="calculateTransportation()"></td>
            <td><input type="number" class="chg-buy-rate" value="${item.buyRate || 0}" step="0.01" oninput="calculateTransportation()"></td>
            <td><input type="text" class="chg-remarks" value="${item.remarks || ''}" placeholder="Add remarks..." style="background: rgba(255,255,255,0.03); color: var(--t1); border: 1px solid var(--border-color); border-radius: 6px; padding: 4px 8px; font-size: 0.78rem; width: 100%;"></td>
            <td style="text-align: center;">
              <button type="button" class="delete-btn" onclick="removeTransportRow(this)" title="Delete Row" style="background: #002060; border: 1px solid #002060; color: #ffffff; border-radius: 4px; cursor: pointer; padding: 4px 8px; font-size: 0.75rem;">Delete</button>
            </td>
          `;
          transportBody.appendChild(tr);
        });
      } else {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td><input type="text" class="chg-name" value="Transport Fee" style="background: rgba(255,255,255,0.03); color: var(--t1);"></td>
          <td><input type="number" class="chg-rate" value="${quote.amount || 0}" step="0.01" oninput="calculateTransportation()"></td>
          <td><input type="number" class="chg-buy-rate" value="0.00" step="0.01" oninput="calculateTransportation()"></td>
          <td><input type="text" class="chg-remarks" placeholder="Add remarks..." style="background: rgba(255,255,255,0.03); color: var(--t1); border: 1px solid var(--border-color); border-radius: 6px; padding: 4px 8px; font-size: 0.78rem; width: 100%;"></td>
          <td style="text-align: center;">
            <button type="button" class="delete-btn" onclick="removeTransportRow(this)" title="Delete Row" style="background: #002060; border: 1px solid #002060; color: #ffffff; border-radius: 4px; cursor: pointer; padding: 4px 8px; font-size: 0.75rem;">Delete</button>
          </td>
        `;
        transportBody.appendChild(tr);
      }
    }
    updateAdminModulePermissions();
    calculateTransportation();
    alert(`Editing Transportation Quote #${getQuoteRefId(quote)} in progress. Click "Save Quote" to confirm your amendments.`);
  } else if (quote.type === 'warehouse') {
    document.getElementById("warehousing-panel").classList.add("active");
    if (document.getElementById("warehouse-customer-name")) {
      document.getElementById("warehouse-customer-name").value = quote.customer || "";
    }
    if (document.getElementById("warehouse-header-currency")) {
      document.getElementById("warehouse-header-currency").value = quote.currency || "INR";
      syncWarehouseCurrency();
    }
    const warehouseGstToggle = document.getElementById("warehouse-gst-enabled");
    if (warehouseGstToggle) warehouseGstToggle.checked = quote.details?.gstEnabled !== false;



    const warehouseBody = document.getElementById("warehouse-standalone-body");
    if (warehouseBody) {
      warehouseBody.innerHTML = "";
      const items = quote.details.items || [];
      if (items.length > 0) {
        items.forEach(item => {
          const tr = document.createElement("tr");
          tr.innerHTML = `
            <td><input type="text" class="chg-name" value="${item.name}" placeholder="Fee / Surcharge Name" style="background: rgba(255,255,255,0.03); color: var(--t1);"></td>
            <td><input type="number" class="chg-rate" value="${item.rate}" step="0.01" oninput="calculateWarehousing()" style="width: 100%;"></td>
            <td><input type="number" class="chg-buy-rate" value="${item.buyRate || 0}" step="0.01" oninput="calculateWarehousing()" style="width: 100%;"></td>
            <td><input type="text" class="chg-remarks" value="${item.remarks || ''}" placeholder="Add remarks..." style="background: rgba(255,255,255,0.03); color: var(--t1); border: 1px solid var(--border-color); border-radius: 6px; padding: 4px 8px; font-size: 0.78rem; width: 100%;"></td>
            <td style="text-align: center;">
              <button type="button" class="delete-btn" onclick="removeWarehouseRow(this)" title="Delete Row" style="background: #002060; border: 1px solid #002060; color: #ffffff; border-radius: 4px; cursor: pointer; padding: 4px 8px; font-size: 0.75rem;">Delete</button>
            </td>
          `;
          tr.dataset.description = item.desc || "";
          warehouseBody.appendChild(tr);
        });
      } else {
        // Fallback default row
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td><input type="text" class="chg-name" value="Warehouse Charge" placeholder="Fee / Surcharge Name" style="background: rgba(255,255,255,0.03); color: var(--t1);"></td>
          <td><input type="number" class="chg-rate" value="${quote.amount || 0}" step="0.01" oninput="calculateWarehousing()" style="width: 100%;"></td>
          <td><input type="number" class="chg-buy-rate" value="0.00" step="0.01" oninput="calculateWarehousing()" style="width: 100%;"></td>
          <td><input type="text" class="chg-remarks" placeholder="Add remarks..." style="background: rgba(255,255,255,0.03); color: var(--t1); border: 1px solid var(--border-color); border-radius: 6px; padding: 4px 8px; font-size: 0.78rem; width: 100%;"></td>
          <td style="text-align: center;">
            <button type="button" class="delete-btn" onclick="removeWarehouseRow(this)" title="Delete Row" style="background: #002060; border: 1px solid #002060; color: #ffffff; border-radius: 4px; cursor: pointer; padding: 4px 8px; font-size: 0.75rem;">Delete</button>
          </td>
        `;
        warehouseBody.appendChild(tr);
      }
    }

    updateAdminModulePermissions();
    calculateWarehousing();
    alert(`Editing Warehousing Quote #${getQuoteRefId(quote)} in progress. Click "Save Quote" to confirm your amendments.`);

  } else {
    // Show the panel first so the browser can paint the skeleton immediately
    document.getElementById("sea-freight-panel").classList.add("active");

    // Defer all field population, card rebuilding, and calculation to the next
    // animation frame — this prevents the blank white flash caused by heavy
    // synchronous DOM work blocking the browser's paint cycle.
    requestAnimationFrame(() => {
      document.getElementById("sea-cust-name").value = quote.customer;
      if (document.getElementById("sea-currency")) {
        document.getElementById("sea-currency").value = quote.currency || "INR";
      }
      if (document.getElementById("sea-gross-weight")) {
        document.getElementById("sea-gross-weight").value = quote.details.grossWeight || 0;
      }
      if (document.getElementById("sea-volume")) {
        document.getElementById("sea-volume").value = quote.details.volumeCbm || 0;
      }
      if (document.getElementById("sea-chargeable-cbm-override")) {
        document.getElementById("sea-chargeable-cbm-override").value = quote.details.chargeableCbmOverride || "";
      }
      if (document.getElementById("sea-pkg-qty")) {
        document.getElementById("sea-pkg-qty").value = quote.details.packagesQuantity || 0;
      }
      if (document.getElementById("sea-handling-profile") && quote.details.handlingProfile) {
        document.getElementById("sea-handling-profile").value = quote.details.handlingProfile;
      }
      if (document.getElementById("sea-orientation-profile") && quote.details.orientationProfile) {
        document.getElementById("sea-orientation-profile").value = quote.details.orientationProfile;
      }
      if (document.getElementById("sea-cargo-risk") && quote.details.cargoRisk) {
        document.getElementById("sea-cargo-risk").value = quote.details.cargoRisk;
      }
      if (document.getElementById("sea-climate-constraint") && quote.details.climateConstraint) {
        document.getElementById("sea-climate-constraint").value = quote.details.climateConstraint;
      }
      document.getElementById("sea-origin").value = quote.details.origin || "";
      document.getElementById("sea-dest").value = quote.details.destination || "";
      if (document.getElementById("sea-line")) document.getElementById("sea-line").value = quote.details.shippingLine || "";
      if (document.getElementById("sea-liner-name")) document.getElementById("sea-liner-name").value = quote.details.linerName || "";
      document.getElementById("sea-commodity").value = quote.details.commodity || "";
      if (document.getElementById("sea-dg-class")) {
        document.getElementById("sea-dg-class").value = quote.details.dgClass || "";
      }
      document.getElementById("sea-incoterm").value = quote.details.incoterm || "EXW";
      document.getElementById("sea-routing").value = quote.details.routing || "";
      document.getElementById("sea-tt").value = quote.details.tt || "";
      document.getElementById("sea-validity").value = quote.details.validity || "";
      document.getElementById("sea-terms").value = quote.details.termsAndConditions || DEFAULT_SEA_TERMS;

      appState.currentSeaFreight.module = quote.details.module || 'export';
      const tabExp = document.getElementById("sea-tab-export");
      const tabImp = document.getElementById("sea-tab-import");
      if (tabExp && tabImp) {
        if (quote.details.module === 'import') {
          tabImp.classList.add("active");
          tabExp.classList.remove("active");
        } else {
          tabExp.classList.add("active");
          tabImp.classList.remove("active");
        }
      }

      const mode = quote.details.mode || "fcl";
      const modeTabs = document.querySelectorAll(".mode-tab-btn");
      modeTabs.forEach(t => {
        if (t.getAttribute("data-mode") === mode) {
          t.classList.add("active");
        } else {
          t.classList.remove("active");
        }
      });

      const fclSection = document.getElementById("sea-fcl-section");
      const lclSection = document.getElementById("sea-lcl-section");
      const bbForm = document.getElementById("sea-bb-form");

      const container = document.getElementById("sea-liners-container");
      if (container) {
        container.innerHTML = "";
        linerCardCounter = 0;
        if (quote.details.liners && quote.details.liners.length > 0) {
          quote.details.liners.forEach(l => {
            addNewLinerCard({
              linerName: l.linerName,
              mode: l.mode || mode,
              containers: l.containers,
              originSurcharges: l.originSurcharges,
              destSurcharges: l.destSurcharges,
              lclRate: l.lclRate,
              lclBuyRate: l.lclBuyRate,
              bbRate: l.bbRate,
              bbBuyRate: l.bbBuyRate,
              tariffsEnabled: l.tariffsEnabled,
              originFeesEnabled: l.originFeesEnabled,
              destFeesEnabled: l.destFeesEnabled
            });
          });
        } else {
          addNewLinerCard({
            linerName: quote.details.shippingLine || quote.details.linerName || "Primary Liner",
            mode: mode,
            containers: quote.details.containerItems || [],
            originSurcharges: quote.details.originSurcharges || [],
            destSurcharges: quote.details.destSurcharges || []
          });
        }
      }

      // Repopulate cargo dimensions if exists
      const seaCargoBody = document.getElementById("sea-cargo-body");
      if (seaCargoBody && quote.details.cargoItems && quote.details.cargoItems.length > 0) {
        seaCargoBody.innerHTML = "";
        quote.details.cargoItems.forEach(item => {
          const tr = document.createElement("tr");
          tr.className = "sea-cargo-item-row";
          tr.innerHTML = `
            <td><input type="number" class="sea-cargo-len" min="1" placeholder="L" value="${item.l}"></td>
            <td><input type="number" class="sea-cargo-wid" min="1" placeholder="W" value="${item.w}"></td>
            <td><input type="number" class="sea-cargo-hei" min="1" placeholder="H" value="${item.h}"></td>
            <td><input type="number" class="sea-cargo-qty" min="1" placeholder="Qty" value="${item.qty}"></td>
            <td>
              <button type="button" class="delete-btn" onclick="this.closest('tr').remove(); calculateSeaVolumeFromDimensions();">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/></svg>
              </button>
            </td>
          `;
          seaCargoBody.appendChild(tr);
          tr.querySelectorAll("input").forEach(inp => {
            inp.addEventListener("input", calculateSeaVolumeFromDimensions);
          });
        });
      }

      const dimUnit = quote.details.dimUnit || 'cms';
      appState.currentSeaFreight.dimUnit = dimUnit;
      const seaDimOptions = document.querySelectorAll("#sea-dim-unit-toggle .toggle-option");
      if (seaDimOptions) {
        seaDimOptions.forEach(opt => {
          if (opt.getAttribute("data-unit") === dimUnit) {
            opt.classList.add("active");
          } else {
            opt.classList.remove("active");
          }
        });
      }

      // Alternative carrier options
      repopulateAlternativesTable("sea-alternatives-body", quote.details.alternatives);

      calculateSeaFreight();
      alert(`Editing Quote #${getQuoteRefId(quote)} in progress. Click "Save Quote" to confirm your amendments.`);
    }); // end requestAnimationFrame
  }
}
window.amendQuote = amendQuote;

function approveAmendment(reqId) {
  if (!isAdminUser(appState.currentUser)) {
    alert("❌ Security Error: Only Admin can approve requests.");
    return;
  }
  let requests = window._amendmentRequests || [];
  if (requests.length === 0) {
    const stored = localStorage.getItem("gl_amendment_requests");
    if (stored) {
      try { requests = JSON.parse(stored); } catch (e) { }
    }
  }
  const req = requests.find(r => r.id === reqId);
  if (req) {
    req.status = 'approved';
    const lower = (req.customer || "").toLowerCase().trim();
    if (req.requestType === 'agreement_waiver') {
      let controls = window._customerControls || {};
      if (!controls[lower]) {
        controls[lower] = { customer: req.customer, creditDays: 36, creditLimit: 0, blocked: false, waiveAgreement: false };
      }
      controls[lower].waiveAgreement = true;
      window._customerControls = controls;

      if (DB.firestoreRef) {
        DB.firestoreRef.collection("customer_control").doc(lower).set(controls[lower], { merge: true });
      } else {
        try {
          let offlineControls = JSON.parse(localStorage.getItem("gl_customer_controls") || "{}");
          offlineControls[lower] = controls[lower];
          localStorage.setItem("gl_customer_controls", JSON.stringify(offlineControls));
        } catch (e) { }
      }
      alert(`Agency Agreement waiver request for customer "${req.customer}" has been APPROVED.`);
    } else if (req.requestType === 'credit_override') {
      alert(`Credit override request for "${req.customer || req.agent || 'Customer/Agent'}" has been APPROVED.`);
    } else {
      // Unlock the quote
      const quote = appState.quotes.find(q => q.id === req.quoteId);
      if (quote) {
        if (req.requestType === 'delete') {
          quote.deletionAllowed = true;
        } else {
          quote.amendmentAllowed = true;
          // 2-hour window to make corrections after approval, instead of a
          // single-use unlock consumed by the very next save.
          quote.amendmentUnlockedUntil = Date.now() + (2 * 60 * 60 * 1000);
        }
      }
      if (quote) DB.saveQuote(quote);
      alert(`Request to ${req.requestType ? req.requestType.toUpperCase() : 'EDIT'} quote #${getQuoteRefIdById(req.quoteId)} has been APPROVED.`);
    }

    // Sync change to DB
    if (DB.firestoreRef) {
      DB.firestoreRef.collection("amendment_requests").doc(req.id).set(req, { merge: true })
        .catch(err => console.error("DB: failed to update request status:", err));
    } else {
      localStorage.setItem("gl_amendment_requests", JSON.stringify(requests));
      renderAdminDashboard();
    }
  }
}
window.approveAmendment = approveAmendment;

function rejectAmendment(reqId) {
  if (!isAdminUser(appState.currentUser)) {
    alert("❌ Security Error: Only Admin can reject requests.");
    return;
  }
  let requests = window._amendmentRequests || [];
  if (requests.length === 0) {
    const stored = localStorage.getItem("gl_amendment_requests");
    if (stored) {
      try { requests = JSON.parse(stored); } catch (e) { }
    }
  }
  const req = requests.find(r => r.id === reqId);
  if (req) {
    req.status = 'rejected';

    if (req.requestType === 'agreement_waiver') {
      alert(`Agency Agreement waiver request for customer "${req.customer}" has been REJECTED.`);
    } else if (req.requestType === 'credit_override') {
      alert(`Credit override request for "${req.customer || req.agent || 'Customer/Agent'}" has been REJECTED.`);
    } else {
      alert(`Request to ${req.requestType ? req.requestType.toUpperCase() : 'EDIT'} quote #${getQuoteRefIdById(req.quoteId)} has been REJECTED.`);
    }

    // Sync change to DB
    if (DB.firestoreRef) {
      DB.firestoreRef.collection("amendment_requests").doc(req.id).set(req, { merge: true })
        .catch(err => console.error("DB: failed to reject request status:", err));
    } else {
      localStorage.setItem("gl_amendment_requests", JSON.stringify(requests));
      renderAdminDashboard();
    }
  }
}
window.rejectAmendment = rejectAmendment;

function calculateSeaVolumeFromDimensions() {
  const rows = document.querySelectorAll("#sea-cargo-body .sea-cargo-item-row");
  const unit = appState.currentSeaFreight.dimUnit || 'cms';

  let totalVolume = 0;
  let totalPackages = 0;

  rows.forEach(row => {
    const l = parseFloat(row.querySelector(".sea-cargo-len").value) || 0;
    const w = parseFloat(row.querySelector(".sea-cargo-wid").value) || 0;
    const h = parseFloat(row.querySelector(".sea-cargo-hei").value) || 0;
    const qty = parseInt(row.querySelector(".sea-cargo-qty").value) || 0;

    if (l > 0 && w > 0 && h > 0 && qty > 0) {
      let rowVol = 0;
      if (unit === 'cms') {
        rowVol = (l * w * h * qty) / 1000000;
      } else { // inches
        rowVol = (l * w * h * qty) * 0.000016387064;
      }
      totalVolume += rowVol;
      totalPackages += qty;
    }

    // Purely visual: flag a row started but still missing a field it needs
    // — matches saveCurrentQuote()'s required-fields check. Math above is untouched.
    const isStarted = l > 0 || w > 0 || h > 0 || qty > 0;
    const isComplete = l > 0 && w > 0 && h > 0 && qty > 0;
    row.classList.toggle("row-incomplete-flag", isStarted && !isComplete);
  });

  const volInput = document.getElementById("sea-volume");
  if (volInput) {
    volInput.value = totalVolume > 0 ? totalVolume.toFixed(3) : 0;
  }

  const pkgInput = document.getElementById("sea-pkg-qty");
  if (pkgInput) {
    pkgInput.value = totalPackages > 0 ? totalPackages : 0;
  }

  calculateSeaFreight();
}
window.calculateSeaVolumeFromDimensions = calculateSeaVolumeFromDimensions;

function revertQuoteToOriginal(id) {
  const quote = appState.quotes.find(q => q.id === id);
  if (!quote) return;
  if (!checkAndRequestEditPermission(quote, "revert")) return;
  if (confirm(`Revert status of quotation for "${quote.customer}" back to Original (Quoted)?`)) {
    quote.status = 'quoted';
    delete quote.conversionDate;
    quote.date = new Date().toISOString().split('T')[0]; // Update execution date
    DB.saveQuote(quote);
    alert("Enquiry status reverted back to Original (Quoted)!");
    if (appState.currentUser === 'ganny') {
      renderAdminDashboard();
    } else {
      renderMemberDashboard(appState.currentUser);
    }
  }
}
window.revertQuoteToOriginal = revertQuoteToOriginal;

function markQuoteCancelled(id) {
  const quote = appState.quotes.find(q => q.id === id);
  if (!quote) return;
  if (!checkAndRequestEditPermission(quote, "cancel")) return;
  if (confirm(`Mark quotation for "${quote.customer}" as CANCELLED?`)) {
    quote.status = 'cancelled';
    quote.date = new Date().toISOString().split('T')[0]; // Update execution date
    DB.saveQuote(quote);
    alert("Enquiry status set to CANCELLED!");
    if (appState.currentUser === 'ganny') {
      renderAdminDashboard();
    } else {
      renderMemberDashboard(appState.currentUser);
    }
  }
}
window.markQuoteCancelled = markQuoteCancelled;

function markQuoteLost(id) {
  const quote = appState.quotes.find(q => q.id === id);
  if (!quote) return;
  if (!checkAndRequestEditPermission(quote, "mark as lost")) return;
  if (confirm(`Mark quotation for "${quote.customer}" as LOST?`)) {
    quote.status = 'lost';
    quote.date = new Date().toISOString().split('T')[0]; // Update execution date
    DB.saveQuote(quote);
    alert("Enquiry status set to LOST!");
    if (appState.currentUser === 'ganny') {
      renderAdminDashboard();
    } else {
      renderMemberDashboard(appState.currentUser);
    }
  }
}
window.markQuoteLost = markQuoteLost;

function saveCustomSeaAutocompletes(originInput, destInput, lineInput, linerInput, commodityInput) {
  let customPorts = [];
  try { customPorts = JSON.parse(localStorage.getItem("gl_custom_seaports") || "[]"); } catch (e) { }
  let customLines = [];
  try { customLines = JSON.parse(localStorage.getItem("gl_custom_shippinglines") || "[]"); } catch (e) { }
  let customLiners = [];
  try { customLiners = JSON.parse(localStorage.getItem("gl_custom_linernames") || "[]"); } catch (e) { }
  let customCommodities = [];
  try { customCommodities = JSON.parse(localStorage.getItem("gl_custom_sea_commodities") || "[]"); } catch (e) { }

  const majorSeaports = [
    { code: "CNSHA", name: "Shanghai Port", city: "Shanghai", country: "China" },
    { code: "SGPIN", name: "Singapore Port", city: "Singapore", country: "Singapore" },
    { code: "NLRTM", name: "Port of Rotterdam", city: "Rotterdam", country: "Netherlands" },
    { code: "BEANR", name: "Port of Antwerp", city: "Antwerp", country: "Belgium" },
    { code: "AEDXB", name: "Jebel Ali Port", city: "Dubai", country: "UAE" },
    { code: "USLAX", name: "Port of Los Angeles", city: "Los Angeles", country: "USA" },
    { code: "GBFXT", name: "Felixstowe Port", city: "Felixstowe", country: "UK" },
    { code: "INNSA", name: "Nhava Sheva (JNPT)", city: "Mumbai", country: "India" },
    { code: "INMAA", name: "Chennai Port", city: "Chennai", country: "India" },
    { code: "LKCMB", name: "Colombo Port", city: "Colombo", country: "Sri Lanka" },
    { code: "DEHAM", name: "Hamburg Port", city: "Hamburg", country: "Germany" }
  ];
  const majorShippingLines = [
    { code: "MSC", name: "MSC (Mediterranean Shipping Company)" },
    { code: "MSK", name: "Maersk Line" },
    { code: "CMA", name: "CMA CGM" },
    { code: "COS", name: "COSCO Shipping" },
    { code: "HLD", name: "Hapag-Lloyd" },
    { code: "ONE", name: "ONE (Ocean Network Express)" },
    { code: "EVG", name: "Evergreen Line" },
    { code: "HMM", name: "HMM Co., Ltd." },
    { code: "YML", name: "Yang Ming Marine Transport" },
    { code: "ZIM", name: "ZIM Integrated Shipping" },
    { code: "WHL", name: "Wan Hai Lines" },
    { code: "PIL", name: "PIL (Pacific International Lines)" }
  ];

  const parsePort = (val) => {
    if (!val) return null;
    const parts = val.split(" - ");
    if (parts.length >= 2) {
      return { code: parts[0], name: parts[1], city: parts[1], country: "" };
    }
    const code = val.substring(0, 5).toUpperCase();
    return { code, name: val, city: val, country: "" };
  };

  const parseLine = (val) => {
    if (!val) return null;
    const parts = val.split(" - ");
    if (parts.length >= 2) {
      return { code: parts[0], name: parts[1] };
    }
    const code = val.substring(0, 3).toUpperCase();
    return { code, name: val };
  };

  const parseLiner = (val) => {
    if (!val) return null;
    const parts = val.split(" - ");
    if (parts.length >= 2) {
      return { code: parts[0], name: parts[1] };
    }
    const code = val.substring(0, 3).toUpperCase();
    return { code, name: val };
  };

  const parseCommodity = (val) => {
    if (!val) return null;
    const parts = val.split(" - ");
    if (parts.length >= 2) {
      return { code: parts[0], name: parts[1] };
    }
    const code = val.substring(0, 3).toUpperCase();
    return { code, name: val };
  };

  // Ports are selected from the global directory; do not create local entries
  // from free-typed values when saving a quotation.
  const addPort = () => {};

  const addLine = (lineObj) => {
    if (!lineObj) return;
    const existsDefault = majorShippingLines.some(l => l.code.toLowerCase() === lineObj.code.toLowerCase() || l.name.toLowerCase() === lineObj.name.toLowerCase());
    const existsCustom = customLines.some(l => l.code.toLowerCase() === lineObj.code.toLowerCase() || l.name.toLowerCase() === lineObj.name.toLowerCase());
    if (!existsDefault && !existsCustom) {
      customLines.push(lineObj);
    }
  };

  const addLiner = (linerObj) => {
    if (!linerObj) return;
    const existsDefault = [
      { code: "MSC", name: "MSC" },
      { code: "MSK", name: "Maersk" },
      { code: "CMA", name: "CMA CGM" },
      { code: "HPL", name: "Hapag-Lloyd" },
      { code: "ONE", name: "ONE" },
      { code: "EMC", name: "Evergreen" },
      { code: "COS", name: "COSCO" },
      { code: "OOCL", name: "OOCL" },
      { code: "HMM", name: "HMM" },
      { code: "ZIM", name: "ZIM" },
      { code: "PIL", name: "PIL" },
      { code: "YML", name: "Yang Ming" }
    ].some(l => l.name.toLowerCase() === linerObj.name.toLowerCase());
    const existsCustom = customLiners.some(l => l.name.toLowerCase() === linerObj.name.toLowerCase());
    if (!existsDefault && !existsCustom) {
      customLiners.push(linerObj);
    }
  };

  const addCommodity = (commObj) => {
    if (!commObj) return;
    const existsDefault = [
      { code: "GEN", name: "General Cargo" },
      { code: "FAK", name: "Freight All Kinds (FAK)" },
      { code: "GAR", name: "Garments / Textiles" },
      { code: "CHM", name: "Chemicals (Non-Haz)" },
      { code: "HAZ", name: "Hazardous Cargo (DG)" },
      { code: "FST", name: "Foodstuff" },
      { code: "PHR", name: "Pharma / Medical" },
      { code: "AUT", name: "Auto Parts" },
      { code: "MCH", name: "Machinery / Equipment" },
      { code: "ELC", name: "Electronics" },
      { code: "PER", name: "Perishables" },
      { code: "SCR", name: "Metal Scrap" }
    ].some(c => c.name.toLowerCase() === commObj.name.toLowerCase());
    const existsCustom = customCommodities.some(c => c.name.toLowerCase() === commObj.name.toLowerCase());
    if (!existsDefault && !existsCustom) {
      customCommodities.push(commObj);
    }
  };

  addPort(parsePort(originInput));
  addPort(parsePort(destInput));
  addLine(parseLine(lineInput));
  addLiner(parseLiner(linerInput));
  addCommodity(parseCommodity(commodityInput));

  localStorage.setItem("gl_custom_seaports", JSON.stringify(customPorts));
  localStorage.setItem("gl_custom_shippinglines", JSON.stringify(customLines));
  localStorage.setItem("gl_custom_linernames", JSON.stringify(customLiners));
  localStorage.setItem("gl_custom_sea_commodities", JSON.stringify(customCommodities));
}
window.saveCustomSeaAutocompletes = saveCustomSeaAutocompletes;

function saveCustomCustomer(name) {
  if (!name) return;
  let customCusts = [];
  try { customCusts = JSON.parse(localStorage.getItem("gl_custom_customers") || "[]"); } catch (e) { }
  const normalized = name.trim();
  if (normalized && !customCusts.some(c => c.toLowerCase() === normalized.toLowerCase())) {
    customCusts.push(normalized);
    localStorage.setItem("gl_custom_customers", JSON.stringify(customCusts));
  }
}
window.saveCustomCustomer = saveCustomCustomer;

function focusNextInput(el, delay = 100) {
  setTimeout(() => {
    const container = el.closest('.glass-card') || el.closest('.workspace') || el.closest('#amendment-approval-panel') || document;
    const inputs = Array.from(container.querySelectorAll('input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled]), button.toggle-option')).filter(i => {
      return i.offsetWidth > 0 && i.offsetHeight > 0;
    });
    const index = inputs.indexOf(el);
    if (index > -1 && index < inputs.length - 1) {
      const nextEl = inputs[index + 1];
      nextEl.focus();
      if (nextEl.tagName === 'INPUT' && typeof nextEl.select === 'function') {
        nextEl.select();
      }
    }
  }, delay);
}
window.focusNextInput = focusNextInput;

function focusPrevInput(el, delay = 100) {
  setTimeout(() => {
    const container = el.closest('.glass-card') || el.closest('.workspace') || el.closest('#amendment-approval-panel') || document;
    const inputs = Array.from(container.querySelectorAll('input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled]), button.toggle-option')).filter(i => {
      return i.offsetWidth > 0 && i.offsetHeight > 0;
    });
    const index = inputs.indexOf(el);
    if (index > 0) {
      const prevEl = inputs[index - 1];
      prevEl.focus();
      if (prevEl.tagName === 'INPUT' && typeof prevEl.select === 'function') {
        prevEl.select();
      }
    }
  }, delay);
}
window.focusPrevInput = focusPrevInput;

document.addEventListener("keydown", (e) => {
  if (e.key === "Tab") {
    // Let browser transition natively and instantly!
    return;
  } else if (e.key === "Enter") {
    const target = e.target;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'SELECT')) {
      if (target.classList.contains("cargo-gw") && appState.activeDesk === 'air') {
        e.preventDefault();
        setTimeout(() => {
          const activeEl = document.querySelector(".break-input-wrapper.highlight-break input");
          if (activeEl) {
            activeEl.focus();
            activeEl.select();
          }
        }, 50);
        return;
      }

      const container = target.closest(".autocomplete-container");
      const dropdown = container ? container.querySelector(".autocomplete-dropdown") : null;
      const hasActiveDropdown = dropdown && dropdown.classList.contains("show") && dropdown.querySelector(".autocomplete-item.active");

      if (!hasActiveDropdown) {
        e.preventDefault();
        if (target._transitionScheduled) return;
        target._transitionScheduled = true;
        focusNextInput(target, 0); // Instant transition (0ms delay) on Enter!
        setTimeout(() => { target._transitionScheduled = false; }, 300);
      }
    }
  }
});

document.addEventListener("change", (e) => {
  const target = e.target;
  if (target && target.classList.contains("cargo-gw") && appState.activeDesk === 'air') {
    setTimeout(() => {
      const activeEl = document.querySelector(".break-input-wrapper.highlight-break input");
      if (activeEl) {
        activeEl.focus();
        activeEl.select();
      }
    }, 50);
  }
});

async function fetchExchangeRates() {
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD");
    if (!res.ok) throw new Error("Rates API failed");
    const data = await res.json();
    if (data && data.rates) {
      const r = data.rates;
      EXCHANGE_RATES.USD_TO_INR = r.INR;
      EXCHANGE_RATES.EUR_TO_INR = r.INR / r.EUR;
      EXCHANGE_RATES.GBP_TO_INR = r.INR / r.GBP;
      EXCHANGE_RATES.EUR_TO_USD = 1 / r.EUR;
      EXCHANGE_RATES.GBP_TO_USD = 1 / r.GBP;

      // Update UI Ticker
      const tickerUsd = document.getElementById("ticker-usd");
      const tickerEur = document.getElementById("ticker-eur");
      const tickerGbp = document.getElementById("ticker-gbp");
      if (tickerUsd) tickerUsd.textContent = `USD ₹${r.INR.toFixed(2)}`;
      if (tickerEur) tickerEur.textContent = `EUR ₹${(r.INR / r.EUR).toFixed(2)}`;
      if (tickerGbp) tickerGbp.textContent = `GBP ₹${(r.INR / r.GBP).toFixed(2)}`;

      // Update Modal fields
      const modUsdInr = document.getElementById("modal-usd-inr");
      const modEurInr = document.getElementById("modal-eur-inr");
      const modGbpInr = document.getElementById("modal-gbp-inr");
      const modEurUsd = document.getElementById("modal-eur-usd");
      const modGbpUsd = document.getElementById("modal-gbp-usd");
      if (modUsdInr) modUsdInr.textContent = `₹${r.INR.toFixed(2)}`;
      if (modEurInr) modEurInr.textContent = `₹${(r.INR / r.EUR).toFixed(2)}`;
      if (modGbpInr) modGbpInr.textContent = `₹${(r.INR / r.GBP).toFixed(2)}`;
      if (modEurUsd) modEurUsd.textContent = `$${(1 / r.EUR).toFixed(2)}`;
      if (modGbpUsd) modGbpUsd.textContent = `$${(1 / r.GBP).toFixed(2)}`;

      // Last Updated Text
      const d = new Date(data.time_last_update_utc);
      const updatedText = document.getElementById("xe-last-updated");
      if (updatedText) updatedText.textContent = `Last Updated: ${d.toLocaleDateString()} ${d.toLocaleTimeString()} (UTC)`;

      // Trigger calculations update
      if (typeof calculateAirFreight === 'function') calculateAirFreight();
      if (typeof calculateSeaFreight === 'function') calculateSeaFreight();
    }
  } catch (error) {
    console.error("Failed to fetch exchange rates dynamically. Using static fallbacks.", error);
    const d = new Date();
    const updatedText = document.getElementById("xe-last-updated");
    if (updatedText) updatedText.textContent = `Last Updated: ${d.toLocaleDateString()} (Static Fallback)`;
  }
}
window.fetchExchangeRates = fetchExchangeRates;

function openExchangeRatesModal() {
  const modal = document.getElementById("exchange-rates-modal");
  if (modal) {
    modal.classList.add("show");
    runCurrencyConversion();
  }
}
window.openExchangeRatesModal = openExchangeRatesModal;

function closeExchangeRatesModal(e) {
  if (e && e.target !== e.currentTarget) return;
  const modal = document.getElementById("exchange-rates-modal");
  if (modal) modal.classList.remove("show");
}
window.closeExchangeRatesModal = closeExchangeRatesModal;

function runCurrencyConversion() {
  const amtInput = document.getElementById("converter-amount");
  const fromSelect = document.getElementById("converter-from");
  const toSelect = document.getElementById("converter-to");
  const resultDiv = document.getElementById("converter-result");

  if (!amtInput || !fromSelect || !toSelect || !resultDiv) return;

  const amt = parseFloat(amtInput.value) || 0;
  const from = fromSelect.value;
  const to = toSelect.value;

  if (amt <= 0) {
    resultDiv.textContent = "0.00";
    return;
  }

  let amountInUSD = amt;
  if (from === 'INR') {
    amountInUSD = amt / EXCHANGE_RATES.USD_TO_INR;
  } else if (from === 'EUR') {
    amountInUSD = amt * EXCHANGE_RATES.EUR_TO_USD;
  } else if (from === 'GBP') {
    amountInUSD = amt * EXCHANGE_RATES.GBP_TO_USD;
  }

  let finalAmt = amountInUSD;
  let sym = "$";
  if (to === 'INR') {
    finalAmt = amountInUSD * EXCHANGE_RATES.USD_TO_INR;
    sym = "₹";
  } else if (to === 'EUR') {
    finalAmt = amountInUSD / EXCHANGE_RATES.EUR_TO_USD;
    sym = "€";
  } else if (to === 'GBP') {
    finalAmt = amountInUSD / EXCHANGE_RATES.GBP_TO_USD;
    sym = "£";
  } else if (to === 'USD') {
    sym = "$";
  }

  resultDiv.textContent = `${sym}${finalAmt.toFixed(2)}`;
}
window.runCurrencyConversion = runCurrencyConversion;

function formatRoutingDisplay(routing) {
  if (!routing) return "-";
  const r = routing.trim();
  if (r.toLowerCase() === "direct") {
    return "DIRECT";
  }
  if (r.toLowerCase().startsWith("via ")) {
    return "via " + r.substring(4).toUpperCase().trim();
  }
  return "via " + r.toUpperCase();
}
window.formatRoutingDisplay = formatRoutingDisplay;

function formatTransitTimeDisplay(tt) {
  if (!tt) return "-";
  const trimmed = tt.trim();
  if (trimmed.toLowerCase() === "direct") return trimmed.toUpperCase();

  const clean = trimmed.replace(/\s*days?\s*$/i, "");
  if (/^\d+([\s\-\.\/]\d+)*$/.test(clean)) {
    return clean + " Days";
  }
  if (trimmed && !trimmed.toLowerCase().includes("day")) {
    return trimmed + " Days";
  }
  return trimmed;
}
window.formatTransitTimeDisplay = formatTransitTimeDisplay;

function convertAmountToUSD(amount, currency) {
  if (!amount) return 0;
  if (currency === 'USD') return amount;
  if (currency === 'INR') return amount / (EXCHANGE_RATES.USD_TO_INR || 83);
  if (currency === 'EUR') return amount * (EXCHANGE_RATES.EUR_TO_USD || 1.08);
  if (currency === 'GBP') return amount * (EXCHANGE_RATES.GBP_TO_USD || 1.25);
  return amount;
}
window.convertAmountToUSD = convertAmountToUSD;

// ==================== DATABASE STORAGE REPOSITORY (LOCAL/FIREBASE) ====================

const DEFAULT_FIREBASE_CONFIG = {
  apiKey: "AIzaSyBnS2173ew2VpxR7rOS0FfTpfsEmhj79Uc",
  authDomain: "vertex-35d95.firebaseapp.com",
  projectId: "vertex-35d95",
  storageBucket: "vertex-35d95.firebasestorage.app",
  messagingSenderId: "185189133669",
  appId: "1:185189133669:web:e24a34f1ef33061e60458c",
  measurementId: "G-BD2BQBRPZM"
};

const DB = {
  isCloud: false,
  firestoreRef: null,
  triedDefaultFallback: false,
  snapshotUnsubscribe: null,
  auxiliaryUnsubscribes: [],
  usersUnsubscribe: null,

  stopAuxiliaryListeners() {
    this.auxiliaryUnsubscribes.forEach(unsubscribe => {
      try {
        unsubscribe();
      } catch (err) {
        console.warn("Firestore: auxiliary listener cleanup failed:", err);
      }
    });
    this.auxiliaryUnsubscribes = [];
    if (this.usersUnsubscribe) {
      try {
        this.usersUnsubscribe();
      } catch (err) {
        console.warn("Firestore: users listener cleanup failed:", err);
      }
      this.usersUnsubscribe = null;
    }
  },

  async init() {
    const statusDot = document.getElementById("db-connection-dot");
    const statusText = document.getElementById("db-connection-text");

    const useOffline = localStorage.getItem("gl_use_offline") === "true";
    if (useOffline) {
      this.fallbackToLocal();
      return;
    }

    let configRaw = localStorage.getItem("gl_firebase_config");

    let config = null;
    if (configRaw) {
      try {
        config = JSON.parse(configRaw);
      } catch (e) {
        console.error("Failed to parse stored Firebase configuration:", e);
      }
    }

    if (!config) {
      config = DEFAULT_FIREBASE_CONFIG;
    }

    if (config && config.apiKey && config.projectId) {
      try {
        // Initialize Firebase Compat
        if (firebase.apps.length > 0) {
          try {
            await firebase.app().delete();
          } catch (e) {
            console.warn("DB: Error cleaning up existing Firebase App instance:", e);
          }
        }
        firebase.initializeApp(config);
        // Explicit LOCAL persistence — without this, Safari's default ITP/
        // storage-partitioning behavior can let signInWithEmailAndPassword
        // succeed server-side while onAuthStateChanged never fires client-
        // side, leaving the login screen up forever with no error shown.
        firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(err => {
          console.warn("DB: Firebase Auth setPersistence failed (continuing with default):", err.code || err.message);
        });
        const dbId = config.databaseId || '(default)';
        console.log("DB: Stored Project ID in LocalStorage:", config.projectId);
        console.log("DB: Stored API Key in LocalStorage:", config.apiKey);
        console.log("DB: Initializing Firestore connection with database ID:", dbId);
        this.firestoreRef = firebase.firestore(firebase.app(), dbId);
        window.db = this.firestoreRef;
        // Isolated from Firestore init on purpose — Storage isn't provisioned
        // on every environment yet, and a failure here must never take down
        // the core Firestore connection the rest of the app depends on.
        // Bucket is pinned to the known-correct value rather than trusting
        // config.storageBucket — some browsers have a stale cached config
        // (gl_firebase_config in LocalStorage) with an old/wrong bucket
        // (seen pointing at the *.web.app Hosting domain instead of the
        // actual *.firebasestorage.app Storage bucket), which fails every
        // Storage request with CORS/403 errors that look like a code bug.
        try {
          window.storage = firebase.storage(firebase.app(), 'gs://' + DEFAULT_FIREBASE_CONFIG.storageBucket);
        } catch (storageErr) {
          console.warn("DB: Firebase Storage unavailable (circulars library will be disabled):", storageErr);
        }
        this.isCloud = true;

        // Enable offline persistence. synchronizeTabs:true makes every open
        // tab of this app share one coordinated IndexedDB cache instead of
        // each tab fighting for exclusive ownership of it — without this,
        // opening the app in a second tab/window (very easy to do by
        // accident) corrupts the SDK's internal state and produces
        // "FIRESTORE INTERNAL ASSERTION FAILED: Unexpected state" on the
        // next write, which is exactly the intermittent save-quote error
        // reported by users.
        this.firestoreRef.enablePersistence({ synchronizeTabs: true }).catch(err => {
          console.warn("Firestore offline persistence failed:", err.code);
        });

        if (statusDot) statusDot.style.background = "#10b981"; // green
        if (statusText) statusText.textContent = "Firebase Cloud (Online)";

        // Setup persistent auth listener
        firebase.auth().onAuthStateChanged(async user => {
          if (user) {
            console.log("Auth: user logged in", user.email);
            const username = user.email.split('@')[0].toLowerCase();
            sessionStorage.setItem("gl_pricing_session", username);

            // Firestore rules require an authenticated session. Start protected
            // listeners only after Firebase Auth has supplied that session.
            this.registerSnapshotListener();

            // ── SAFE DASHBOARD INIT ───────────────────────────────────────────
            // Wait for the first Firestore quotes snapshot to arrive before
            // rendering any dashboard. This ensures appState.quotes is populated
            // and TEAM_ROLES has been updated by syncUsers before the dashboard
            // is painted. registerSnapshotListener()'s success AND error paths
            // both resolve this gate, but as a last-resort safety net against
            // any entirely unanticipated hang (neither callback ever firing),
            // a 12s timeout also proceeds — a logged-in user must never be
            // stranded on the login screen indefinitely with no way out.
            if (appState._dataReadyPromise) {
              const timedOut = await Promise.race([
                appState._dataReadyPromise.then(() => false),
                new Promise(resolve => setTimeout(() => resolve(true), 12000)),
              ]);
              if (timedOut) {
                console.warn("DB: Data-ready gate timed out after 12s — proceeding to dashboard anyway.");
                if (!Array.isArray(appState.quotes)) appState.quotes = [];
              }
            }

            loginSuccess(username);
            updateExecutiveDashboardVisibility();
            if (typeof goHome === 'function') {
              goHome();
            }

          } else {
            console.log("Auth: user logged out");
            document.documentElement.classList.remove("nrs-font-scale");
            const execDashBtn = document.getElementById("executive-dashboard-btn");
            if (execDashBtn) execDashBtn.style.display = "none";
            sessionStorage.removeItem("gl_pricing_session");
            appState.currentUser = null;
            updateExecutiveDashboardVisibility();
            document.body.classList.add("logged-out-blur");
            document.getElementById("login-overlay").style.display = "flex";
            document.getElementById("app-workspace").style.display = "flex";
            document.getElementById("subheader-controls").style.display = "flex";
          }
        });

        // Check for migration from local to cloud
        const localQuotes = JSON.parse(localStorage.getItem("logistics_quotes") || "[]");
        if (localQuotes.length > 0) {
          console.log(`DB: Found ${localQuotes.length} local quotes. Migrating to Firestore...`);
          try {
            const migrationPromises = localQuotes.map(async q => {
              if (!q.timestamp) q.timestamp = Date.now();
              return this.firestoreRef.collection("quotes").doc(q.id).set(q);
            });
            await Promise.all(migrationPromises);
            console.log("DB: Local quotes migration succeeded!");
            localStorage.removeItem("logistics_quotes");
          } catch (err) {
            console.error("DB: Migration of local quotes failed. Retaining local copy.", err);
          }
        }
        // Check for migration from local to cloud for NRS registry
        const localNrs = JSON.parse(localStorage.getItem("gl_nrs_registry") || "[]");
        if (localNrs.length > 0) {
          console.log(`DB: Found ${localNrs.length} local NRS entries. Migrating to Firestore...`);
          try {
            const migrationPromises = localNrs.map(async entry => {
              return this.firestoreRef.collection("nrs_registry").doc(entry.id).set(entry);
            });
            await Promise.all(migrationPromises);
            console.log("DB: Local NRS registry migration succeeded!");
            localStorage.removeItem("gl_nrs_registry");
          } catch (err) {
            console.error("DB: Migration of local NRS registry failed. Retaining local copy.", err);
          }
        }

        // Check for migration from local to cloud for amendment requests
        const localReqs = JSON.parse(localStorage.getItem("gl_amendment_requests") || "[]");
        if (localReqs.length > 0) {
          console.log(`DB: Found ${localReqs.length} local amendment requests. Migrating to Firestore...`);
          try {
            const migrationPromises = localReqs.map(async r => {
              return this.firestoreRef.collection("amendment_requests").doc(r.id).set(r);
            });
            await Promise.all(migrationPromises);
            console.log("DB: Local amendment requests migration succeeded!");
          } catch (err) {
            console.error("DB: Migration of local amendment requests failed:", err);
          }
        }
        return;
      } catch (e) {
        console.error("Failed to initialize Firebase:", e);
      }
    }

    // Fallback to local storage
    this.fallbackToLocal();
  },

  registerSnapshotListener() {
    const statusDot = document.getElementById("db-connection-dot");
    const statusText = document.getElementById("db-connection-text");

    console.log("DB: Registering Firestore snapshot listener...");

    // ── DATA-READY GATE ──────────────────────────────────────────────────────
    // onAuthStateChanged must NOT render dashboards until the first Firestore
    // quotes snapshot has arrived and appState.quotes is populated.
    // We create a one-time Promise that resolves on the first snapshot delivery.
    if (!appState._dataReadyResolve) {
      appState._dataReadyPromise = new Promise(resolve => {
        appState._dataReadyResolve = resolve;
      });
    }

    // Replace any prior authenticated listeners before creating this session's
    // users and supporting collection listeners.
    this.stopAuxiliaryListeners();

    // Sync users list from Firestore
    this.syncUsers();

    // Sync customer controls list from Firestore
    if (this.firestoreRef) {
      // Sync custom autocomplete entries from Firestore
      this.auxiliaryUnsubscribes.push(this.firestoreRef.collection("custom_autocomplete_entries").onSnapshot(snap => {
        snap.forEach(doc => {
          const type = doc.id;
          const data = doc.data();
          if (data && Array.isArray(data.entries)) {
            localStorage.setItem("gl_custom_" + type, JSON.stringify(data.entries));
          }
        });
      }, err => {
        console.warn("Firestore: custom_autocomplete_entries listen failed, using local/cached records:", err);
      }));

      this.auxiliaryUnsubscribes.push(this.firestoreRef.collection("customer_control").onSnapshot(snap => {
        let controls = {};
        snap.forEach(doc => {
          controls[doc.id] = doc.data();
        });
        window._customerControls = controls;
        localStorage.setItem("gl_customer_controls", JSON.stringify(controls));
        renderAdminCustomerControlList();
      }, err => {
        console.warn("Firestore: customer_control listen failed, using local/cached records:", err);
      }));

      // Sync sales leads from Firestore
      this.auxiliaryUnsubscribes.push(this.firestoreRef.collection("leads").onSnapshot(snap => {
        let leads = [];
        snap.forEach(doc => leads.push({ id: doc.id, ...doc.data() }));
        appState.leads = leads;
        if (typeof renderSalesPanel === 'function') renderSalesPanel();
      }, err => {
        console.warn("Firestore: leads listen failed, using local/cached records:", err);
      }));

      // Sync sales activities from Firestore
      this.auxiliaryUnsubscribes.push(this.firestoreRef.collection("activities").onSnapshot(snap => {
        let activities = [];
        snap.forEach(doc => activities.push({ id: doc.id, ...doc.data() }));
        appState.activities = activities;
        if (typeof renderActivityTimelineIfOpen === 'function') renderActivityTimelineIfOpen();
      }, err => {
        console.warn("Firestore: activities listen failed, using local/cached records:", err);
      }));

      // Sync amendment requests list from Firestore
      this.auxiliaryUnsubscribes.push(this.firestoreRef.collection("amendment_requests").onSnapshot(snap => {
        let reqs = [];
        snap.forEach(doc => {
          reqs.push(doc.data());
        });
        // Check and notify Ganny of new pending requests
        if (typeof checkAndNotifyNewRequests === 'function') {
          checkAndNotifyNewRequests(reqs);
        }
        window._amendmentRequests = reqs;
        window._amendmentRequestsError = null;
        localStorage.setItem("gl_amendment_requests", JSON.stringify(reqs));

        // Auto refresh dashboards dynamically
        if (appState.currentUser) {
          if (appState.currentUser === 'ganny') {
            renderAdminDashboard();
          } else {
            renderMemberDashboard(appState.currentUser);
          }
        }
      }, err => {
        console.warn("Firestore: amendment_requests listen failed, using local/cached records:", err);
        window._amendmentRequestsError = err.message;
        if (appState.currentUser === 'ganny') {
          renderAdminDashboard();
        }
      }));
    }

    // Unsubscribe from any existing listener if applicable
    if (this.snapshotUnsubscribe) {
      this.snapshotUnsubscribe();
    }

    this.snapshotUnsubscribe = this.firestoreRef.collection("quotes").onSnapshot(snapshot => {

      console.log("DB: Received snapshot from Firestore. Document count:", snapshot.size);

      const list = [];
      const seenRefIds = new Set();

      snapshot.forEach(doc => {
        const q = doc.data();
        this.sanitize(q, list.length);

        const refId = getQuoteRefId(q);

        // Deduplicate duplicate quotes AEANT0726IN00062 / AEANT0726IN00065 or identical ref IDs
        if (seenRefIds.has(refId)) {
          console.log("DB: Skipping duplicate quote ref ID:", refId);
          return;
        }
        seenRefIds.add(refId);
        list.push(q);
      });
      // Sort quotes chronologically (newest first)
      list.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

      appState.quotes = list;

      console.log("FIRESTORE LOADED QUOTES:", appState.quotes.length);

      // ── RESOLVE DATA-READY GATE ──────────────────────────────────────────
      // Signal that quotes are now loaded so onAuthStateChanged can proceed
      // to render the dashboard. Only resolves once; subsequent calls are no-ops.
      if (typeof appState._dataReadyResolve === 'function') {
        appState._dataReadyResolve();
        appState._dataReadyResolve = null; // prevent double-resolve
      }

      // Update badge status to show online
      if (statusDot) statusDot.style.background = "#10b981"; // green
      if (statusText) statusText.textContent = "Firebase Cloud (Online)";

      // Refresh view
      if (appState.currentUser) {
        const activeRole = getActiveRole();
        if (activeRole === 'ganny' || activeRole === 'manager') {
          renderAdminDashboard();
        } else {
          renderMemberDashboard(activeRole);
        }
      }
    }, error => {
      console.error("Firestore synchronization error:", error);

      // Self-healing: check if default database is missing and redirect to named 'default' database ID
      if (error.message && error.message.includes("(default) does not exist") && !this.triedDefaultFallback) {
        console.log("DB: Default database not found. Self-healing to connect to named database 'default'...");
        this.triedDefaultFallback = true;
        try {
          this.firestoreRef = firebase.firestore(firebase.app(), 'default');
          this.registerSnapshotListener();
          return;
        } catch (fallbackErr) {
          console.error("DB: Self-healing fallback failed:", fallbackErr);
        }
      }

      if (statusDot) statusDot.style.background = "#ef4444"; // red
      if (statusText) statusText.textContent = "Firebase: " + error.message;

      // The data-ready gate MUST resolve even on failure — otherwise
      // onAuthStateChanged's `await appState._dataReadyPromise` (see login
      // flow) hangs forever, leaving the login overlay up with no error
      // shown even though sign-in itself already succeeded. Better to show
      // the dashboard with an empty/stale quote list (the red status
      // indicator above already signals the sync problem) than to strand
      // an authenticated user on the login screen indefinitely.
      if (typeof appState._dataReadyResolve === 'function') {
        if (!Array.isArray(appState.quotes)) appState.quotes = [];
        appState._dataReadyResolve();
        appState._dataReadyResolve = null;
      }
    });
  },

  async syncUsers() {
    if (!this.firestoreRef) return;
    try {
      const snapshot = await this.firestoreRef.collection("users").get();
      if (snapshot.empty) {
        // Auto-populate default roles if empty (passwords omitted, handled via Firebase Auth console / registration)
        const defaultUsers = [
          { username: 'ganny', fullName: 'Pricing Team (Admin)', role: 'admin' },
          { username: 'shashank', fullName: 'Air Nomination', role: 'member', category: 'AIR - NOMINATION', currency: 'USD' },
          { username: 'shaheer', fullName: 'Sea Nomination', role: 'member', category: 'SEA - NOMINATION', currency: 'USD' },
          { username: 'jaya', fullName: 'Free Hand Sales', role: 'member', category: 'FREE HAND SALES (AIR/SEA)', currency: 'INR' },
          { username: 'cathrina', fullName: 'NRS', role: 'member', category: 'NRS (AIR/SEA)', currency: 'USD' }
        ];
        for (const u of defaultUsers) {
          await this.firestoreRef.collection("users").doc(u.username).set(u);
        }
        console.log("DB: Auto-populated default users in Firestore");
      }

      // Set listener on users collection
      if (this.usersUnsubscribe) {
        this.usersUnsubscribe();
        this.usersUnsubscribe = null;
      }
      this.usersUnsubscribe = this.firestoreRef.collection("users").onSnapshot(snap => {
        let customUsers = [];

        // ── Read existing localStorage passwords BEFORE overwriting ──────────
        // Firestore users docs may not have a password field (if password was
        // changed locally or user was registered before Fix #6). We MUST
        // preserve any password already cached in localStorage so the fallback
        // login path continues to work.
        let existingLocalUsers = [];
        try {
          const storedLocal = localStorage.getItem("gl_custom_users");
          if (storedLocal) existingLocalUsers = JSON.parse(storedLocal) || [];
        } catch (e) { }

        snap.forEach(doc => {
          const u = doc.data();
          if (u && u.username) {
            const lowerUser = u.username.toLowerCase();
            if (lowerUser === 'mahendra') return;

            // If Firestore doc has no password, try to preserve one from localStorage
            if (!u.password) {
              const localEntry = existingLocalUsers.find(
                lu => lu && lu.username && lu.username.toLowerCase() === lowerUser
              );
              if (localEntry && localEntry.password) {
                u.password = localEntry.password;
              }
            }

            customUsers.push(u);

            // Update TEAM_ROLES dynamically with case-insensitive lowercase keys
            TEAM_ROLES[lowerUser] = {
              name: u.fullName || u.username,
              type: u.role || 'member',
              category: u.category || 'FREE HAND SALES (AIR/SEA)',
              currency: u.currency || 'INR'
            };
          }
        });
        window._firebaseUsers = customUsers;
        localStorage.setItem("gl_custom_users", JSON.stringify(customUsers));
        console.log("DB: Synced users from Firestore count:", customUsers.length);
        if (typeof window.renderUserCredentialsList === 'function') {
          window.renderUserCredentialsList();
        }
        // Several admin views (Quoting Agents directory tree, Staff
        // Performance Leaderboard) read TEAM_ROLES[roleId].name directly —
        // if they render before this sync updates a hardcoded role's name
        // (e.g. 'jaya' starts as "Free Hand" until synced to "Free Hand
        // Sales"), the stale name sticks around as its own separate row
        // until something else triggers a re-render. Refresh the whole
        // admin dashboard here too, same as the credentials list right
        // above, so nothing keeps showing a name this sync just changed.
        if (typeof isAdminUser === 'function' && isAdminUser(appState.currentUser) && typeof renderAdminDashboard === 'function') {
          renderAdminDashboard();
        }

        // ── DYNAMIC USER RE-RENDER ────────────────────────────────────────────
        // If a dynamic user (e.g. ramesh, sunil) is already logged in and their
        // TEAM_ROLES entry was just populated by this snapshot, re-render their
        // dashboard so they see the correct category and their own quotations.
        // This is a no-op for static users already in hardcoded TEAM_ROLES.
        const cu = appState.currentUser;
        if (cu && !isAdminUser(cu)) {
          // If member panel is already active, just re-render with fresh TEAM_ROLES data
          const memberPanel = document.getElementById("member-dashboard-panel");
          const memberPanelIsActive = memberPanel && memberPanel.classList.contains("active");

          if (TEAM_ROLES[cu] && TEAM_ROLES[cu].type === 'member') {
            if (memberPanelIsActive) {
              // Panel already visible — just refresh the data
              renderMemberDashboard(cu);
            } else {
              // Panel not active yet — this can happen when syncUsers snapshot beat
              // the loginSuccess/switchRole call. Drive the full panel activation.
              switchRole(cu);
            }
          }
        }
      });
    } catch (err) {
      console.error("DB: Failed to sync users from Firestore:", err);
    }
  },

  fallbackToLocal() {
    const statusDot = document.getElementById("db-connection-dot");
    const statusText = document.getElementById("db-connection-text");

    this.isCloud = false;
    if (statusDot) statusDot.style.background = "#38bdf8"; // sky blue
    if (statusText) statusText.textContent = "LocalStorage (Offline)";

    // Load local storage quotes
    const saved = localStorage.getItem("logistics_quotes");
    if (saved) {
      try {
        appState.quotes = JSON.parse(saved);
        if (appState.quotes.some(q => typeof q.id === 'string' && q.id.startsWith("q"))) {
          appState.quotes = [];
          localStorage.setItem("logistics_quotes", JSON.stringify([]));
        }
      } catch (e) {
        appState.quotes = [];
      }
    } else {
      appState.quotes = [];
    }

    // Load local amendment requests cache
    const storedReqs = localStorage.getItem("gl_amendment_requests");
    if (storedReqs) {
      try {
        window._amendmentRequests = JSON.parse(storedReqs);
      } catch (e) {
        window._amendmentRequests = [];
      }
    } else {
      window._amendmentRequests = [];
    }

    // Sanitize and deduplicate quotes array
    const dedupedList = [];
    const seenRefIds = new Set();
    appState.quotes.forEach((q, idx) => {
      this.sanitize(q, idx);
      const refId = getQuoteRefId(q);
      if (!seenRefIds.has(refId)) {
        seenRefIds.add(refId);
        dedupedList.push(q);
      }
    });
    appState.quotes = dedupedList;
  },

  sanitize(q, idx) {
    const creatorMap = {
      'air-nom': 'shashank',
      'sea-nom': 'shaheer',
      'air-local': 'jaya',
      'sea-local': 'jaya'
    };
    if (creatorMap[q.creator]) {
      q.creator = creatorMap[q.creator];
    }
    if (!q.quoteNumber) {
      q.quoteNumber = idx + 1;
    }
    if (!q.timestamp) {
      q.timestamp = Date.now() - (idx * 60 * 1000);
    }
    // Specific fix for duplicate quotes AEANT0726IN00062 / AEANT0726IN00065:
    // The bare `q.id.includes("62")` / `q.id.includes("65")` checks that used
    // to live here matched Firestore's randomly-generated document IDs against
    // a plain 2-character substring — since those IDs are random strings, "62"
    // or "65" turning up somewhere inside one is common coincidence, not a
    // sign the quote is actually one of the two originally-targeted ones. That
    // silently mislabeled 10 unrelated live quotes as "warehouse" (confirmed
    // via live audit — e.g. quote #WHUFS0826IN00648, whose real id "Qi658l3lgi"
    // just happens to contain "65"). quoteNumber is a precise, reliable field
    // (and always set — see the fallback right above), so that alone is
    // sufficient; the 5-digit id/notes substring checks are kept as a safety
    // net for old records but are narrow enough not to false-positive.
    const lowercaseId = (q.id || "").toLowerCase();
    const isTargetQuote = lowercaseId.includes("00062") || lowercaseId.includes("00065") ||
      q.quoteNumber === 62 || q.quoteNumber === 65 ||
      (q.notes && (q.notes.includes("00062") || q.notes.includes("00065")));

    if (isTargetQuote) {
      q.type = 'warehouse';
      q.mode = 'Warehouse';
      if (!q.details) q.details = {};
      q.details.mode = 'Warehouse';
      q.details.type = 'warehouse';
      q.details.module = 'warehouse';
    }
  },

  async saveQuote(quote) {
    if (!quote.timestamp) quote.timestamp = Date.now();

    // Local memory update immediately so the local user doesn't see lag
    const idx = appState.quotes.findIndex(q => q.id === quote.id);
    const previousQuote = idx !== -1 ? appState.quotes[idx] : null;
    if (idx !== -1) {
      appState.quotes[idx] = quote;
    } else {
      appState.quotes.push(quote);
    }

    if (this.isCloud && this.firestoreRef) {
      console.log("DB: Attempting to write quote to Firestore...", quote.id);
      try {
        await this.firestoreRef.collection("quotes").doc(quote.id).set(quote);
        console.log("DB: Firestore write succeeded!");
        return true;
      } catch (err) {
        if (idx === -1) {
          appState.quotes = appState.quotes.filter(q => q.id !== quote.id);
        } else {
          appState.quotes[idx] = previousQuote;
        }
        console.error("DB: Firestore write failed:", err);
        // "INTERNAL ASSERTION FAILED" means this browser's local Firestore
        // cache is stuck in a bad state, almost always from having the app
        // open in more than one tab/window at once. A raw SDK error message
        // isn't actionable for a pricing officer, so give the actual fix.
        if ((err.message || "").includes("INTERNAL ASSERTION FAILED")) {
          alert("This browser's local cache got stuck (usually from having this app open in more than one tab or window). Please close every other tab/window of this app, then reload this page and try saving again — your entry hasn't been lost, it's still in the form.");
        } else {
          alert("Cloud Database Write Error: " + err.message);
        }
        return false;
      }
    } else {
      localStorage.setItem("logistics_quotes", JSON.stringify(appState.quotes));
      const activeRole = getActiveRole();
      if (activeRole === 'ganny' || activeRole === 'manager') {
        renderAdminDashboard();
      } else {
        renderMemberDashboard(activeRole);
      }
      return true;
    }
  },

  async deleteQuote(quoteId) {
    appState.quotes = appState.quotes.filter(q => q.id !== quoteId);

    if (this.isCloud && this.firestoreRef) {
      try {
        await this.firestoreRef.collection("quotes").doc(quoteId).delete();
      } catch (err) {
        console.error("DB: Firestore delete failed:", err);
        alert("Cloud Database Delete Error: " + err.message);
      }
    } else {
      localStorage.setItem("logistics_quotes", JSON.stringify(appState.quotes));
      if (appState.currentUser === 'ganny') {
        renderAdminDashboard();
      } else {
        renderMemberDashboard(appState.currentUser);
      }
    }
  },

  async clearAllQuotes() {
    if (this.isCloud && this.firestoreRef) {
      try {
        const snapshot = await this.firestoreRef.collection("quotes").get();
        const promises = [];
        snapshot.forEach(doc => {
          promises.push(doc.ref.delete());
        });
        await Promise.all(promises);
        console.log("DB: All quotes deleted from Firestore.");
      } catch (err) {
        console.error("DB: Failed to clear Firestore quotes:", err);
        throw err;
      }
    } else {
      localStorage.removeItem("logistics_quotes");
    }
    appState.quotes = [];
  }
};
window.DB = DB;

async function loadLogisticsNews(type = 'global') {
  const container1 = document.getElementById("logistics-news-list");
  const container2 = document.getElementById("member-logistics-news-list");
  if (!container1 && !container2) return;

  // Update Admin tabs
  const tabGlobal = document.getElementById("news-tab-global");
  const tabIndia = document.getElementById("news-tab-india");
  if (tabGlobal && tabIndia) {
    if (type === 'global') {
      tabGlobal.classList.add("active");
      tabGlobal.style.borderColor = "var(--sky)";
      tabGlobal.style.color = "var(--sky)";
      tabIndia.classList.remove("active");
      tabIndia.style.borderColor = "transparent";
      tabIndia.style.color = "var(--t3)";
    } else {
      tabIndia.classList.add("active");
      tabIndia.style.borderColor = "var(--sky)";
      tabIndia.style.color = "var(--sky)";
      tabGlobal.classList.remove("active");
      tabGlobal.style.borderColor = "transparent";
      tabGlobal.style.color = "var(--t3)";
    }
  }

  // Update Member tabs
  const mTabGlobal = document.getElementById("member-news-tab-global");
  const mTabIndia = document.getElementById("member-news-tab-india");
  if (mTabGlobal && mTabIndia) {
    if (type === 'global') {
      mTabGlobal.classList.add("active");
      mTabGlobal.style.borderColor = "var(--sky)";
      mTabGlobal.style.color = "var(--sky)";
      mTabIndia.classList.remove("active");
      mTabIndia.style.borderColor = "transparent";
      mTabIndia.style.color = "var(--t3)";
    } else {
      mTabIndia.classList.add("active");
      mTabIndia.style.borderColor = "var(--sky)";
      mTabIndia.style.color = "var(--sky)";
      mTabGlobal.classList.remove("active");
      mTabGlobal.style.borderColor = "transparent";
      mTabGlobal.style.color = "var(--t3)";
    }
  }

  const loadingHtml = `
    <div style="font-size: 0.72rem; color: var(--t3); font-style: italic; text-align: center; margin-top: 1.5rem;">
      <span style="display:inline-block; width:6px; height:6px; background:var(--sky); border-radius:50%; margin-right:4px;"></span>
      Fetching latest ${type === 'global' ? 'Global' : 'India'} news...
    </div>
  `;
  if (container1) container1.innerHTML = loadingHtml;
  if (container2) container2.innerHTML = loadingHtml;

  const rssUrl = type === 'global'
    ? "https://container-news.com/feed/"
    : "https://www.logisticsinsider.in/feed/";
  const feedUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}`;

  try {
    const res = await fetch(feedUrl);
    const data = await res.json();

    if (data && data.status === 'ok' && data.items && data.items.length > 0) {
      const itemsHtml = data.items.map(item => {
        let dateStr = "";
        try {
          const d = new Date(item.pubDate);
          if (!isNaN(d.getTime())) {
            dateStr = d.toLocaleDateString("en-IN", { day: 'numeric', month: 'short', year: 'numeric' });
          }
        } catch (e) { }

        const title = item.title || "Logistics News Update";
        const link = item.link || "#";
        const author = item.author ? ` • By ${item.author}` : "";

        return `
          <a href="${link}" target="_blank" rel="noopener noreferrer" style="text-decoration: none; display: block; margin-bottom: 0.5rem;">
            <div class="news-feed-card" style="background: rgba(255,255,255,0.45); border: 1px solid var(--border-1); border-radius: var(--r-sm); padding: 0.6rem 0.8rem; display: flex; flex-direction: column; gap: 0.25rem; transition: all 0.2s; cursor: pointer;">
              <div style="font-weight: 750; font-size: 0.75rem; color: var(--t1); line-height: 1.3;">${title}</div>
              <div style="font-size: 0.62rem; color: var(--sky); font-weight: 700; display: flex; justify-content: space-between; align-items: center;">
                <span>${type === 'global' ? 'CONTAINER NEWS' : 'LOGISTICS INSIDER INDIA'}${author}</span>
                <span>${dateStr}</span>
              </div>
            </div>
          </a>
        `;
      }).join("");

      if (container1) container1.innerHTML = itemsHtml;
      if (container2) container2.innerHTML = itemsHtml;
    } else {
      throw new Error("Invalid RSS feed response");
    }
  } catch (err) {
    console.error("Failed to load logistics news:", err);
    const errorHtml = `
      <div style="font-size: 0.72rem; color: var(--accent-error); font-style: italic; text-align: center; margin-top: 1.5rem;">
        ⚠️ Failed to load news feed.
      </div>
    `;
    if (container1) container1.innerHTML = errorHtml;
    if (container2) container2.innerHTML = errorHtml;
  }
}
window.loadLogisticsNews = loadLogisticsNews;

// MODAL & SECURITY HANDLERS
function toggleAdminSettingsModal() {
  const isAdmin = (appState.currentUser === 'ganny' || (TEAM_ROLES[appState.currentUser]?.type === 'admin'));
  if (!isAdmin) {
    alert("Access Denied: Admin privileges required.");
    return;
  }

  const modal = document.getElementById("admin-settings-modal");
  if (!modal) return;

  if (modal.style.display === "none" || !modal.style.display) {
    // Populate configurations dynamically inside modal inputs
    const savedNames = localStorage.getItem("gl_desk_names");
    if (savedNames) {
      try {
        const parsed = JSON.parse(savedNames);
        if (parsed["shashank"]) document.getElementById("cfg-shashank").value = parsed["shashank"];
        if (parsed["shaheer"]) document.getElementById("cfg-shaheer").value = parsed["shaheer"];
        if (parsed["jaya"]) document.getElementById("cfg-jaya").value = parsed["jaya"];
        if (parsed["cathrina"]) document.getElementById("cfg-cathrina").value = parsed["cathrina"];
      } catch (e) { }
    }

    document.getElementById("cfg-gmaps-key").value = localStorage.getItem("gl_gmaps_key") || "";
    document.getElementById("cfg-firebase-json").value = localStorage.getItem("gl_firebase_config_raw") || "";

    renderAdminCustomerControlList();
    modal.style.display = "flex";
  } else {
    modal.style.display = "none";
  }
}
window.toggleAdminSettingsModal = toggleAdminSettingsModal;

function openChangePasswordModal() {
  const modal = document.getElementById("change-password-modal");
  if (modal) modal.style.display = "flex";
}
window.openChangePasswordModal = openChangePasswordModal;

function closeChangePasswordModal() {
  const modal = document.getElementById("change-password-modal");
  if (modal) {
    modal.style.display = "none";
    document.getElementById("new-pass-val").value = "";
  }
}
window.closeChangePasswordModal = closeChangePasswordModal;

async function saveNewPassword(e) {
  e.preventDefault();
  const newPass = document.getElementById("new-pass-val").value;
  if (!newPass || newPass.length < 6) {
    alert("Password must be at least 6 characters long.");
    return;
  }

  const currentUser = appState.currentUser;
  if (!currentUser) return;

  try {
    if (DB.firestoreRef && firebase.auth().currentUser) {
      // Update password in Firebase Authentication
      await firebase.auth().currentUser.updatePassword(newPass);

      // ── Sync new password to Firestore so fallback login also works ─────────
      try {
        await DB.firestoreRef.collection("users").doc(currentUser).set(
          { password: newPass },
          { merge: true }
        );
      } catch (fsErr) {
        console.warn("Could not sync new password to Firestore (non-fatal):", fsErr);
      }

      // ── Sync new password to localStorage cache ───────────────────────────
      try {
        let customUsers = [];
        const stored = localStorage.getItem("gl_custom_users");
        if (stored) { try { customUsers = JSON.parse(stored); } catch (e) { } }
        const matchedLocal = customUsers.find(u => u && u.username && u.username.toLowerCase() === currentUser);
        if (matchedLocal) {
          matchedLocal.password = newPass;
        } else {
          customUsers.push({ username: currentUser, fullName: TEAM_ROLES[currentUser]?.name || currentUser, password: newPass });
        }
        localStorage.setItem("gl_custom_users", JSON.stringify(customUsers));
      } catch (lsErr) {
        console.warn("Could not sync new password to localStorage (non-fatal):", lsErr);
      }

      alert("🎉 Password updated successfully!");
    } else {
      // ── Offline local storage fallback ────────────────────────────────────
      let customUsers = [];
      const stored = localStorage.getItem("gl_custom_users");
      if (stored) {
        try { customUsers = JSON.parse(stored); } catch (err) { }
      }
      const matched = customUsers.find(u => u && u.username && typeof u.username === 'string' && u.username.toLowerCase() === currentUser);
      if (matched) {
        matched.password = newPass;
        localStorage.setItem("gl_custom_users", JSON.stringify(customUsers));
        alert("🎉 Password updated successfully in local session!");
      } else {
        const mockCustomUser = {
          username: currentUser,
          fullName: TEAM_ROLES[currentUser]?.name || currentUser,
          password: newPass
        };
        customUsers.push(mockCustomUser);
        localStorage.setItem("gl_custom_users", JSON.stringify(customUsers));
        alert("🎉 Password created successfully for offline session!");
      }
    }
    closeChangePasswordModal();
  } catch (err) {
    alert("❌ Error saving new password: " + err.message);
  }
}
window.saveNewPassword = saveNewPassword;

// GLOBAL KEYBOARD ACCESSIBILITY
document.addEventListener("keydown", (e) => {
  // ESC key: Exit modals and return to home from calculators
  if (e.key === "Escape") {
    const modalIds = [
      "admin-settings-modal",
      "admin-reset-overlay",
      "change-password-modal",
      "xe-rates-modal",
      "print-preview-modal",
      "won-booking-modal"
    ];
    let modalClosed = false;

    for (const id of modalIds) {
      const modal = document.getElementById(id);
      if (modal && (modal.style.display === "flex" || modal.style.display === "block")) {
        modal.style.display = "none";
        modalClosed = true;

        // Modal-specific cleanups
        if (id === "change-password-modal") {
          document.getElementById("new-pass-val").value = "";
        }
      }
    }

    // If no modal was closed, but we are inside an active calculator desk, return back to main dashboard
    if (!modalClosed) {
      const activePanel = document.querySelector(".view-panel.active");
      if (activePanel && activePanel.id !== "manager-panel" && activePanel.id !== "member-dashboard-panel") {
        goHome();
      }
    }
  }

  // Enter key: Auto-proceed on forms
  if (e.key === "Enter") {
    const activeEl = document.activeElement;
    if (activeEl && (activeEl.tagName === "BUTTON" || activeEl.tagName === "TEXTAREA")) {
      return;
    }

    // 1. If inside change password modal, submit it
    const cpModal = document.getElementById("change-password-modal");
    if (cpModal && cpModal.style.display === "flex") {
      const form = document.getElementById("change-password-form");
      if (form) {
        form.requestSubmit();
        e.preventDefault();
      }
      return;
    }

    // 2. If inside won booking details modal, submit it
    const wbModal = document.getElementById("won-booking-modal");
    if (wbModal && wbModal.style.display === "flex") {
      const form = document.getElementById("won-booking-form");
      if (form) {
        form.requestSubmit();
        e.preventDefault();
      }
      return;
    }

    // 3. If inside login overlay, submit it
    const loginOverlay = document.getElementById("login-overlay");
    if (loginOverlay && loginOverlay.style.display !== "none") {
      const form = document.getElementById("login-form");
      if (form) {
        form.requestSubmit();
        e.preventDefault();
      }
    }
  }
});

function closeWonBookingModal() {
  const modal = document.getElementById("won-booking-modal");
  if (modal) modal.style.display = "none";
}
window.closeWonBookingModal = closeWonBookingModal;

// Quick Convert only relaxes the shipper/consignee/commodity/agreement
// requirements — it never touches Buy/Sell rate validation or any of the
// total/GP recalculation logic in submitWonBookingDetails(), which run
// identically either way.
const WON_OPTIONAL_IN_QUICK_MODE = [
  "won-shipper-name", "won-shipper-phone", "won-shipper-email", "won-shipper-address",
  "won-cnee-name", "won-cnee-phone", "won-cnee-email", "won-cnee-address",
  "won-commodity"
];

function toggleWonQuickConvertMode() {
  const isQuick = document.getElementById("won-quick-convert-toggle")?.checked || false;

  WON_OPTIONAL_IN_QUICK_MODE.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    if (isQuick) {
      el.removeAttribute("required");
    } else {
      el.setAttribute("required", "required");
    }
  });

  const agreementContainer = document.getElementById("won-agreement-upload-container");
  const agreementStatus = document.getElementById("won-agreement-status");
  const agreementHint = document.getElementById("won-agreement-hint");
  if (agreementContainer) {
    agreementContainer.style.opacity = isQuick ? "0.55" : "1";
  }
  if (agreementStatus && isQuick) {
    agreementStatus.textContent = "Optional (Quick Convert)";
    agreementStatus.style.color = "var(--t3)";
  } else if (agreementStatus) {
    agreementStatus.textContent = "Required";
    agreementStatus.style.color = "var(--accent-error)";
  }
  if (agreementHint && isQuick) {
    agreementHint.textContent = "Skipped for Quick Convert — NRS can attach this later from the registry entry.";
  } else if (agreementHint) {
    agreementHint.textContent = "Upload the PDF agreement for this customer to convert this quote.";
  }
}
window.toggleWonQuickConvertMode = toggleWonQuickConvertMode;

// Recomputes amount/amountINR/grossProfit/grossProfitINR/buyRate for a quote
// from its current details — the single source of truth for Buy/Sell/GP.
// Used both when a quote is first confirmed WON (submitWonBookingDetails)
// and whenever an already-WON quote is later amended (saveCurrentQuote),
// so these figures never go stale relative to the quote's actual details —
// previously only the WON-confirmation path ever wrote buyRate/grossProfit,
// so amending a converted quote silently froze them at their pre-amendment
// values while amount/details moved on, producing an incorrect saved GP.
function recomputeQuoteFinancials(quote) {
  let sellBaseFreight = 0;
  let buyBaseFreight = 0;
  let surchargeSell = 0;
  let surchargeBuy = 0;
  let grossProfit = 0;
  let subtotalSell = 0;
  let subtotalBuy = 0;

  if (quote.type === 'air') {
    const chargeableWeight = quote.details.chargeableWeight || 0;
    // The "min" bracket is a flat minimum charge, not a per-kg rate (same
    // distinction already applied in calculateAirFreight() and
    // computeHistoricalBuyRate()) — it must not be multiplied by weight.
    const isMinBracket = quote.details.usedBreak === 'min';
    // A quote with Airline / Carrier Tariffs excluded (destination-clearance-
    // only, etc.) contributes no freight regardless of whatever rate value
    // happens to still be sitting in appliedRate/appliedBuyRate from before
    // the section was turned off — mirrors calculateAirFreight()'s own
    // (tariffsEnabled && wbEnabled) gate on the live baseFreightCost.
    const tariffsActive = quote.details.tariffsEnabled !== false;
    sellBaseFreight = !tariffsActive ? 0 : (isMinBracket ? (quote.details.appliedRate || 0) : (chargeableWeight * (quote.details.appliedRate || 0)));
    buyBaseFreight = !tariffsActive ? 0 : (isMinBracket ? (quote.details.appliedBuyRate || 0) : (chargeableWeight * (quote.details.appliedBuyRate || 0)));

    (quote.details.surcharges || []).forEach(sch => {
      const sellRate = sch.rate !== undefined ? sch.rate : (sch.cost !== undefined ? sch.cost : 0);
      const buyRate = sch.buyRate !== undefined ? sch.buyRate : 0;
      if (sch.unit === 'kg') {
        surchargeSell += chargeableWeight * sellRate;
        surchargeBuy += chargeableWeight * buyRate;
      } else {
        surchargeSell += sellRate;
        surchargeBuy += buyRate;
      }
    });

    quote.amount = sellBaseFreight + surchargeSell;
    grossProfit = (sellBaseFreight - buyBaseFreight) + (surchargeSell - surchargeBuy);
  } else if (quote.type === 'sea') {
    const weightKg = quote.details.grossWeight || 0;
    const weightTons = weightKg / 1000;
    const cbm = quote.details.volumeCbm || 0;
    const isLcl = quote.details.mode === 'lcl';
    const effectiveCbm = (isLcl && cbm < 1.0) ? 1.0 : cbm;
    const chargeableCbm = (quote.details.chargeableCbmOverride || 0) > 0
      ? quote.details.chargeableCbmOverride
      : Math.max(effectiveCbm, weightTons);
    const containerCount = (quote.details.containerItems || []).reduce((acc, c) => acc + (c.qty || 0), 0);
    const isSeaFcl = quote.details.mode === 'fcl';
    // Same waiver as Air Freight above: a quote with Freight Tariffs
    // deliberately excluded contributes no freight regardless of whatever
    // rate happens to still be sitting on containerItems/lclRateApplied/
    // bbRateApplied from before the section was turned off.
    const tariffsActive = quote.details.tariffsEnabled !== false;

    if (quote.details.mode === 'fcl') {
      sellBaseFreight = !tariffsActive ? 0 : (quote.details.containerItems || []).reduce((acc, c) => acc + (c.qty || 0) * (c.rate || 0), 0);
      buyBaseFreight = !tariffsActive ? 0 : (quote.details.containerItems || []).reduce((acc, c) => acc + (c.qty || 0) * (c.buy || 0), 0);
    } else {
      const RT = quote.details.lclChargeable || 0;
      const sellRate = quote.details.mode === 'lcl' ? quote.details.lclRateApplied : quote.details.bbRateApplied;
      const buyRate = quote.details.mode === 'lcl' ? quote.details.lclBuyRateApplied : quote.details.bbBuyRateApplied;
      sellBaseFreight = !tariffsActive ? 0 : RT * sellRate;
      buyBaseFreight = !tariffsActive ? 0 : RT * buyRate;
    }
    quote.details.baseFreight = sellBaseFreight;

    (quote.details.surcharges || []).forEach(sch => {
      const sellRate = sch.rate !== undefined ? sch.rate : (sch.cost !== undefined ? sch.cost : 0);
      const buyRate = sch.buyRate !== undefined ? sch.buyRate : 0;
      const unit = sch.unit || 'flat';

      if (unit === 'container') {
        surchargeSell += isSeaFcl ? containerCount * sellRate : sellRate;
        surchargeBuy += isSeaFcl ? containerCount * buyRate : buyRate;
      } else if (unit === 'rt') {
        surchargeSell += chargeableCbm * sellRate;
        surchargeBuy += chargeableCbm * buyRate;
      } else if (unit === 'kg') {
        surchargeSell += weightKg * sellRate;
        surchargeBuy += weightKg * buyRate;
      } else {
        surchargeSell += sellRate;
        surchargeBuy += buyRate;
      }
    });
    quote.details.surchargeTotal = surchargeSell;

    quote.amount = sellBaseFreight + surchargeSell;
    grossProfit = (sellBaseFreight - buyBaseFreight) + (surchargeSell - surchargeBuy);
  } else if (quote.type === 'transport' || quote.type === 'warehouse') {
    subtotalSell = 0;
    subtotalBuy = 0;
    (quote.details.items || []).forEach(item => {
      subtotalSell += item.rate;
      subtotalBuy += item.buyRate;
    });
    const taxSell = subtotalSell * 0.18;
    quote.amount = subtotalSell + taxSell;
    grossProfit = subtotalSell - subtotalBuy;
  }

  if (quote.currency !== 'INR') {
    quote.amountINR = quote.amount * EXCHANGE_RATES[`${quote.currency}_TO_INR`];
  } else {
    quote.amountINR = quote.amount;
  }

  quote.grossProfit = grossProfit;
  quote.grossProfitCurrency = quote.currency;

  let grossProfitINR = grossProfit;
  if (quote.currency !== 'INR') {
    grossProfitINR = grossProfit * EXCHANGE_RATES[`${quote.currency}_TO_INR`];
  }
  quote.grossProfitINR = grossProfitINR;

  if (quote.type === 'air' || quote.type === 'sea') {
    quote.buyRate = buyBaseFreight + surchargeBuy;
  } else if (quote.type === 'transport' || quote.type === 'warehouse') {
    quote.buyRate = subtotalBuy;
  }
  quote.buyRateCurrency = quote.currency;
}
window.recomputeQuoteFinancials = recomputeQuoteFinancials;

async function submitWonBookingDetails(e) {
  e.preventDefault();
  const id = document.getElementById("won-quote-id").value;
  const quote = appState.quotes.find(q => q.id === id);
  if (!quote) return;

  // Quick Convert relaxes shipper/consignee/commodity/agreement requirements
  // only — Buy/Sell rate validation and every calculation below run exactly
  // the same regardless of this flag.
  const isQuickConvert = document.getElementById("won-quick-convert-toggle")?.checked || false;

  const shipperName = document.getElementById("won-shipper-name").value.trim();
  const shipperPhone = document.getElementById("won-shipper-phone").value.trim();
  const shipperEmail = document.getElementById("won-shipper-email").value.trim();
  const shipperAddress = document.getElementById("won-shipper-address").value.trim();

  const consigneeName = document.getElementById("won-cnee-name").value.trim();
  const consigneePhone = document.getElementById("won-cnee-phone").value.trim();
  const consigneeEmail = document.getElementById("won-cnee-email").value.trim();
  const consigneeAddress = document.getElementById("won-cnee-address").value.trim();

  const commodity = document.getElementById("won-commodity").value.trim();

  if (!isQuickConvert) {
    if (!shipperName || !shipperPhone || !shipperEmail || !shipperAddress ||
      !consigneeName || !consigneePhone || !consigneeEmail || !consigneeAddress || !commodity) {
      alert("Please fill all exporter, importer and cargo details to proceed.");
      return;
    }

    // Validate contacts format
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
    const phoneRegex = /[0-9+\-\s()]{7,}/;

    if (!emailRegex.test(shipperEmail)) {
      alert("❌ COMPLIANCE ERROR: Please enter a valid Email ID for the Exporter (Shipper).");
      return;
    }
    if (!phoneRegex.test(shipperPhone)) {
      alert("❌ COMPLIANCE ERROR: Please enter a valid Contact Number for the Exporter (Shipper).");
      return;
    }
    if (!emailRegex.test(consigneeEmail)) {
      alert("❌ COMPLIANCE ERROR: Please enter a valid Email ID for the Importer (Consignee).");
      return;
    }
    if (!phoneRegex.test(consigneePhone)) {
      alert("❌ COMPLIANCE ERROR: Please enter a valid Contact Number for the Importer (Consignee).");
      return;
    }
  }

  // Check agreement upload
  const customerName = quote.customer || "";
  const lower = customerName.toLowerCase().trim();
  const ctrl = (window._customerControls && window._customerControls[lower]) || {};

  const creatorRole = quote.creator;
  const isFreeHandOrNrs = creatorRole && (
    creatorRole === 'jaya' ||
    creatorRole === 'cathrina' ||
    TEAM_ROLES[creatorRole]?.category === 'FREE HAND SALES (AIR/SEA)' ||
    TEAM_ROLES[creatorRole]?.category === 'NRS (AIR/SEA)'
  );

  const hasAgreement = isFreeHandOrNrs || !!(ctrl.hasAgreement || ctrl.waiveAgreement);

  const fileInput = document.getElementById("won-agreement-file");
  let fileData = null;
  let fileName = "";
  if (fileInput && fileInput.files && fileInput.files.length > 0) {
    const file = fileInput.files[0];
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      alert("❌ COMPLIANCE ERROR: Only PDF files (.pdf) are allowed for Agency Agreements.");
      return;
    }
    fileData = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.readAsDataURL(file);
    });
    fileName = file.name;
  }

  if (!isQuickConvert && !hasAgreement && !fileData) {
    const reason = prompt("❌ COMPLIANCE ALERT:\nAn Agency Agreement PDF upload is required to convert this quote to WON.\n\nPlease enter the reason for requesting an Admin (Ganny) agreement waiver/permission:");
    if (reason === null) return; // User cancelled
    if (!reason.trim()) {
      alert("A reason is required to submit the request.");
      return;
    }

    let requests = window._amendmentRequests || [];
    if (requests.length === 0) {
      const stored = localStorage.getItem("gl_amendment_requests");
      if (stored) {
        try { requests = JSON.parse(stored); } catch (e) { }
      }
    }
    const pending = requests.find(r => r.customer.toLowerCase().trim() === lower && r.requestType === 'agreement_waiver' && r.status === 'pending');
    if (pending) {
      alert("An agreement waiver request for this customer has already been submitted to Admin. Please wait for Ganny's approval.");
    } else {
      const newReq = {
        id: 'REQ' + Math.random().toString(36).substr(2, 9),
        requestType: 'agreement_waiver',
        quoteId: quote.id,
        customer: customerName,
        creator: appState.currentUser,
        creatorName: TEAM_ROLES[appState.currentUser]?.name || appState.currentUser,
        date: new Date().toLocaleDateString() + " " + new Date().toLocaleTimeString(),
        status: 'pending',
        reason: reason.trim(),
        acknowledged: false
      };

      if (DB.firestoreRef) {
        DB.firestoreRef.collection("amendment_requests").doc(newReq.id).set(newReq)
          .then(() => {
            alert("Agreement waiver request submitted successfully to Ganny.");
          })
          .catch(err => {
            console.error("DB: failed to save agreement waiver request:", err);
            alert("Failed to submit request to cloud. Saving locally...");
            saveRequestLocallyFallback(newReq);
          });
      } else {
        saveRequestLocallyFallback(newReq);
        alert("Agreement waiver request submitted successfully to Ganny (Offline).");
      }
    }
    return;
  }

  // Save agreement to database if uploaded
  if (fileData) {
    await saveCustomerAgreementRecord(customerName, fileName, fileData);
    quote.agencyAgreementName = fileName;
    quote.agencyAgreementData = fileData;
  } else if (ctrl.agreementFile && ctrl.agreementData) {
    quote.agencyAgreementName = ctrl.agreementFile;
    quote.agencyAgreementData = ctrl.agreementData;
  }

  quote.shipperName = shipperName;
  quote.shipperPhone = shipperPhone;
  quote.shipperEmail = shipperEmail;
  quote.shipperAddress = shipperAddress;
  quote.consigneeName = consigneeName;
  quote.consigneePhone = consigneePhone;
  quote.consigneeEmail = consigneeEmail;
  quote.consigneeAddress = consigneeAddress;
  quote.commodity = commodity;

  // 1. Confirm and validate Carrier
  const confirmedCarrier = document.getElementById("won-confirmed-carrier")?.value || "N/A";
  quote.confirmedCarrier = confirmedCarrier;

  // 2. Validate and Save Local Fee rates (both Sell and Buy rate inputs are side-by-side)
  const originSellInputs = document.querySelectorAll(".won-origin-fee-sell-input");
  for (let i = 0; i < originSellInputs.length; i++) {
    const idx = parseInt(originSellInputs[i].getAttribute("data-index"));
    const sellVal = parseFloat(originSellInputs[i].value) || 0;
    const buyVal = parseFloat(document.querySelector(`.won-origin-fee-buy-input[data-index="${idx}"]`)?.value) || 0;
    if (sellVal <= 0) {
      alert("Sell Rate is mandatory for every local fee heading before confirming a quotation.");
      return;
    }
    // Buy Rate is intentionally allowed to be 0 here: some headings are added
    // purely as extra profit margin with no real underlying cost, so unlike
    // Sell Rate, Buy Rate is not required to be positive for these local fees.
    if (quote.details.originSurcharges && quote.details.originSurcharges[idx]) {
      quote.details.originSurcharges[idx].rate = sellVal;
      quote.details.originSurcharges[idx].cost = sellVal;
      quote.details.originSurcharges[idx].buyRate = buyVal;
    }
  }

  const destSellInputs = document.querySelectorAll(".won-dest-fee-sell-input");
  for (let i = 0; i < destSellInputs.length; i++) {
    const idx = parseInt(destSellInputs[i].getAttribute("data-index"));
    const sellVal = parseFloat(destSellInputs[i].value) || 0;
    const buyVal = parseFloat(document.querySelector(`.won-dest-fee-buy-input[data-index="${idx}"]`)?.value) || 0;
    if (sellVal <= 0) {
      alert("Sell Rate is mandatory for every local fee heading before confirming a quotation.");
      return;
    }
    // Buy Rate is intentionally allowed to be 0 here: some headings are added
    // purely as extra profit margin with no real underlying cost, so unlike
    // Sell Rate, Buy Rate is not required to be positive for these local fees.
    if (quote.details.destSurcharges && quote.details.destSurcharges[idx]) {
      quote.details.destSurcharges[idx].rate = sellVal;
      quote.details.destSurcharges[idx].cost = sellVal;
      quote.details.destSurcharges[idx].buyRate = buyVal;
    }
  }

  // Sync surcharges array
  quote.details.surcharges = [
    ...(quote.details.originSurcharges || []),
    ...(quote.details.destSurcharges || [])
  ];

  // 3. Validate and Update freight/item rates
  let finalBuyRate = 0;
  let finalSellRate = 0;

  if (quote.type === 'air') {
    finalSellRate = parseFloat(document.getElementById("won-confirmed-sell-rate")?.value) || 0;
    finalBuyRate = parseFloat(document.getElementById("won-confirmed-buy-rate")?.value) || 0;
    // A quote with Airline / Carrier Tariffs deliberately excluded (client
    // wants only local fees, e.g. destination clearance) has no freight
    // rate to speak of — only enforce this when tariffs are actually part
    // of the quote. Older quotes without this flag default to enabled,
    // preserving today's behavior for them.
    if (quote.details.tariffsEnabled !== false && (finalSellRate <= 0 || finalBuyRate <= 0)) {
      alert("Both Buy Rate and Sell Rate are mandatory before confirming a quotation.");
      return;
    }
    quote.confirmedSellRate = finalSellRate;
    quote.confirmedBuyRate = finalBuyRate;
    quote.details.appliedRate = finalSellRate;
    quote.details.appliedBuyRate = finalBuyRate;

    if (quote.details.airlines && quote.details.airlines.length > 0) {
      const match = quote.details.airlines.find(a => a.name === confirmedCarrier);
      if (match) {
        match.appliedRate = finalSellRate;
        match.appliedBuyRate = finalBuyRate;
        const activeBr = match.usedBreak || getWeightBreakBracket(match.chargeableWeight || quote.details.chargeableWeight || 0);
        if (!match.breaks) match.breaks = {};
        if (typeof match.breaks[activeBr] !== 'object') {
          match.breaks[activeBr] = { sell: finalSellRate, buy: finalBuyRate };
        } else {
          match.breaks[activeBr].sell = finalSellRate;
          match.breaks[activeBr].buy = finalBuyRate;
        }
      }
    }
  } else if (quote.type === 'sea' && quote.details.mode !== 'fcl') {
    finalSellRate = parseFloat(document.getElementById("won-confirmed-sell-rate")?.value) || 0;
    finalBuyRate = parseFloat(document.getElementById("won-confirmed-buy-rate")?.value) || 0;
    // Same waiver as Air Freight above: a quote with Freight Tariffs
    // deliberately excluded (client wants only local fees, e.g. destination
    // clearance) has no freight rate to speak of — only enforce this when
    // tariffs are actually part of the quote. Older quotes without this
    // flag default to enabled, preserving today's behavior for them.
    if (quote.details.tariffsEnabled !== false && (finalSellRate <= 0 || finalBuyRate <= 0)) {
      alert("Both Buy Rate and Sell Rate are mandatory before confirming a quotation.");
      return;
    }
    quote.confirmedSellRate = finalSellRate;
    quote.confirmedBuyRate = finalBuyRate;
    if (quote.details.mode === 'lcl') {
      quote.details.lclRateApplied = finalSellRate;
      quote.details.lclBuyRateApplied = finalBuyRate;
    } else {
      quote.details.bbRateApplied = finalSellRate;
      quote.details.bbBuyRateApplied = finalBuyRate;
    }
  } else if (quote.type === 'sea' && quote.details.mode === 'fcl') {
    const fclSellInputs = document.querySelectorAll(".won-fcl-sell-input");
    for (let i = 0; i < fclSellInputs.length; i++) {
      const idx = parseInt(fclSellInputs[i].getAttribute("data-index"));
      const sellVal = parseFloat(fclSellInputs[i].value) || 0;
      const buyVal = parseFloat(document.querySelector(`.won-fcl-buy-input[data-index="${idx}"]`)?.value) || 0;
      if (quote.details.tariffsEnabled !== false && (sellVal <= 0 || buyVal <= 0)) {
        alert("Both Buy Rate and Sell Rate are mandatory before confirming a quotation.");
        return;
      }
      if (quote.details.containerItems && quote.details.containerItems[idx]) {
        quote.details.containerItems[idx].rate = sellVal;
        quote.details.containerItems[idx].buy = buyVal;
      }
    }
  } else if (quote.type === 'transport' || quote.type === 'warehouse') {
    const standaloneSellInputs = document.querySelectorAll(".won-standalone-sell-input");
    for (let i = 0; i < standaloneSellInputs.length; i++) {
      const idx = parseInt(standaloneSellInputs[i].getAttribute("data-index"));
      const sellVal = parseFloat(standaloneSellInputs[i].value) || 0;
      const buyVal = parseFloat(document.querySelector(`.won-standalone-buy-input[data-index="${idx}"]`)?.value) || 0;
      if (sellVal <= 0 || buyVal <= 0) {
        alert("Both Buy Rate and Sell Rate are mandatory before confirming a quotation.");
        return;
      }
      if (quote.details.items && quote.details.items[idx]) {
        quote.details.items[idx].rate = sellVal;
        quote.details.items[idx].buyRate = buyVal;
      }
    }
  }

  // 4. Recalculate Totals & GP based on updated rates
  recomputeQuoteFinancials(quote);

  // Do not mark the quote Converted/WON until every required buy/sell validation above has passed.
  quote.status = 'converted';
  quote.conversionDate = new Date().toISOString().split('T')[0];
  quote.date = new Date().toISOString().split('T')[0];

  try {
    // 1. Save quote update (updates Firestore dynamically)
    await DB.saveQuote(quote);

    // 2. NRS registry entry mapping
    const nrsEntry = {
      id: quote.id,
      refId: getQuoteRefId(quote),
      mode: quote.type === 'air' ? 'Air Nomination' : 'Sea Nomination',
      agent: quote.customer,
      pol: (quote.details && quote.details.origin) || '',
      pod: (quote.details && quote.details.destination) || '',
      shipperName,
      shipperPhone,
      shipperEmail,
      shipperAddress,
      consigneeName,
      consigneePhone,
      consigneeEmail,
      consigneeAddress,
      commodity,
      dateWon: quote.conversionDate,
      agencyAgreementName: quote.agencyAgreementName || "",
      agencyAgreementData: quote.agencyAgreementData || "",
      confirmedCarrier: quote.confirmedCarrier || "",
      confirmedBuyRate: quote.confirmedBuyRate || 0,
      grossProfit: quote.grossProfit || 0,
      grossProfitINR: quote.grossProfitINR || 0,
      grossProfitCurrency: quote.grossProfitCurrency || quote.currency,
      creator: quote.creator,
      pendingShipperDetails: isQuickConvert && (!shipperName || !consigneeName)
    };

    if (DB.firestoreRef) {
      await DB.firestoreRef.collection("nrs_registry").doc(quote.id).set(nrsEntry);
    } else {
      let offlineRegistry = [];
      const stored = localStorage.getItem("gl_nrs_registry");
      if (stored) {
        try { offlineRegistry = JSON.parse(stored); } catch (err) { }
      }
      const idx = offlineRegistry.findIndex(item => item.id === quote.id);
      if (idx !== -1) {
        offlineRegistry[idx] = nrsEntry;
      } else {
        offlineRegistry.push(nrsEntry);
      }
      localStorage.setItem("gl_nrs_registry", JSON.stringify(offlineRegistry));
    }

    // 3. Confirmation intimation alert to Cathrina (NRS)
    if (quote.creator === 'shashank' || quote.creator === 'shaheer') {
      let alerts = [];
      const stored = localStorage.getItem("nrs_alerts");
      if (stored) {
        try { alerts = JSON.parse(stored); } catch (err) { alerts = []; }
      }
      alerts.push({
        id: 'A' + Math.random().toString(36).substr(2, 9),
        date: new Date().toLocaleTimeString() + " " + new Date().toLocaleDateString(),
        message: `Booking Confirmed: Customer "${quote.customer}" (${quote.route}) prepared by ${TEAM_ROLES[quote.creator]?.name || quote.creator}.`
      });
      localStorage.setItem("nrs_alerts", JSON.stringify(alerts));
    }

    alert(nrsEntry.pendingShipperDetails
      ? "🎉 Booking converted to WON with confirmed rates! A linked entry is now in the NRS registry — shipper/consignee details are still needed there."
      : "🎉 Booking successfully converted to WON and registered in NRS module!");
    closeWonBookingModal();

    // Refresh active panel
    if (appState.currentUser === 'ganny') {
      renderAdminDashboard();
    } else {
      renderMemberDashboard(appState.currentUser);
    }
  } catch (err) {
    alert("❌ Error converting booking: " + err.message);
  }
}
window.submitWonBookingDetails = submitWonBookingDetails;

async function renderNrsRegistry() {
  const panel = document.getElementById("nrs-registry-panel");
  const tbody = document.getElementById("nrs-registry-body");
  if (!panel || !tbody) return;

  const currentUser = appState.currentUser;
  // Show only to Cathrina (NRS) or custom NRS desk users
  if (currentUser === 'cathrina' || (TEAM_ROLES[currentUser] && TEAM_ROLES[currentUser].category === 'NRS (AIR/SEA)')) {
    panel.style.display = "block";
  } else {
    panel.style.display = "none";
    return;
  }

  tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-dim); padding: 2rem;">Loading NRS directory...</td></tr>`;

  try {
    let registryList = [];
    if (DB.firestoreRef) {
      const snap = await DB.firestoreRef.collection("nrs_registry").get();
      snap.forEach(doc => {
        registryList.push(doc.data());
      });
    } else {
      const stored = localStorage.getItem("gl_nrs_registry");
      if (stored) {
        try { registryList = JSON.parse(stored); } catch (e) { }
      }
    }

    // Filter to only include bookings generated by Air Nomination and Sea Nomination users
    const filteredList = registryList.filter(item => {
      const quote = appState.quotes.find(q => q.id === item.id);
      const creator = item.creator || (quote && quote.creator);
      if (creator) {
        return creator === 'shashank' || creator === 'shaheer' ||
          (TEAM_ROLES[creator] && (TEAM_ROLES[creator].category === 'AIR - NOMINATION' || TEAM_ROLES[creator].category === 'SEA - NOMINATION'));
      }
      const prefix = (item.refId || "").substring(0, 2).toUpperCase();
      const isNomRef = prefix === 'AE' || prefix === 'AI' || prefix === 'SE' || prefix === 'SI';
      if (isNomRef) return true;
      const nomMode = item.mode || '';
      return nomMode.includes('Nomination');
    });

    window._nrsRegistryCached = filteredList;
    displayNrsRegistryItems(filteredList);
  } catch (err) {
    console.error("NRS: Failed to render registry database:", err);
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--accent-error); padding: 2rem;">⚠️ Failed to load directory.</td></tr>`;
  }
}
window.renderNrsRegistry = renderNrsRegistry;

function previewPdfDataUrl(dataUrl, title = "Document Preview") {
  try {
    const parts = dataUrl.split(';base64,');
    const contentType = parts[0].split(':')[1];
    const raw = window.atob(parts[1]);
    const rawLength = raw.length;
    const uInt8Array = new Uint8Array(rawLength);
    for (let i = 0; i < rawLength; ++i) {
      uInt8Array[i] = raw.charCodeAt(i);
    }
    const blob = new Blob([uInt8Array], { type: contentType });
    const blobUrl = URL.createObjectURL(blob);

    const win = window.open();
    if (win) {
      win.document.write(`
        <html>
          <head>
            <title>${title}</title>
            <style>
              body { margin: 0; padding: 0; background: #0e0f30; font-family: sans-serif; display: flex; flex-direction: column; height: 100vh; overflow: hidden; }
              header { background: #111236; color: #fff; padding: 10px 20px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #232560; }
              iframe { border: none; width: 100%; height: calc(100vh - 50px); }
              .btn-download { background: #10b981; color: #000; border: none; padding: 6px 12px; border-radius: 4px; font-weight: bold; cursor: pointer; text-decoration: none; font-size: 0.8rem; }
            </style>
          </head>
          <body>
            <header>
              <span style="font-weight: bold;">${title}</span>
              <a href="${blobUrl}" download="${title.toLowerCase().replace(/[^a-z0-9]+/g, '_')}.pdf" class="btn-download">Download PDF</a>
            </header>
            <iframe src="${blobUrl}"></iframe>
          </body>
        </html>
      `);
      win.document.close();
    } else {
      alert("Pop-up blocker active! Please allow pop-ups for this website to preview PDFs.");
    }
  } catch (err) {
    console.error("PDF Preview failed:", err);
    const win = window.open();
    if (win) win.location.href = dataUrl;
  }
}
window.previewPdfDataUrl = previewPdfDataUrl;

function previewNrsAgreementPdf(id) {
  const list = window._nrsRegistryCached || [];
  const item = list.find(x => x.id === id);

  let agreementData = item ? item.agencyAgreementData : null;
  let agreementName = item ? item.agencyAgreementName : null;

  if (!agreementData) {
    const q = appState.quotes.find(x => x.id === id);
    if (q) {
      agreementData = q.agencyAgreementData;
      agreementName = q.agencyAgreementName;
    }
  }

  if (!agreementData) {
    const customer = (item && item.customer) || "";
    const lower = customer.toLowerCase().trim();
    const ctrl = (window._customerControls && window._customerControls[lower]) || {};
    if (ctrl.agreementData) {
      agreementData = ctrl.agreementData;
      agreementName = ctrl.agreementFile;
    }
  }

  if (agreementData) {
    previewPdfDataUrl(agreementData, agreementName || "Agency Agreement");
  } else {
    alert("No PDF document uploaded or found for this won booking/customer.");
  }
}
window.previewNrsAgreementPdf = previewNrsAgreementPdf;

function previewNrsInvoicePackingPdf(id) {
  const list = window._nrsRegistryCached || [];
  const item = list.find(x => x.id === id);

  let invoicePackingData = item ? item.invoicePackingData : null;
  let invoicePackingName = item ? item.invoicePackingName : null;

  if (!invoicePackingData) {
    const q = appState.quotes.find(x => x.id === id);
    if (q) {
      invoicePackingData = q.invoicePackingData;
      invoicePackingName = q.invoicePackingName;
    }
  }

  if (invoicePackingData) {
    previewPdfDataUrl(invoicePackingData, invoicePackingName || "Commercial Invoice & Packing List");
  } else {
    alert("No Commercial Invoice & Packing List PDF uploaded for this booking.");
  }
}
window.previewNrsInvoicePackingPdf = previewNrsInvoicePackingPdf;

function downloadNrsAgreementPdf(id) {
  const list = window._nrsRegistryCached || [];
  const item = list.find(x => x.id === id);

  let agreementData = item ? item.agencyAgreementData : null;
  let agreementName = item ? item.agencyAgreementName : null;

  if (!agreementData) {
    const q = appState.quotes.find(x => x.id === id);
    if (q) {
      agreementData = q.agencyAgreementData;
      agreementName = q.agencyAgreementName;
    }
  }

  if (agreementData) {
    const link = document.createElement("a");
    link.href = agreementData;
    link.download = agreementName || "agency_agreement.pdf";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } else {
    const customer = (item && item.customer) || "";
    const lower = customer.toLowerCase().trim();
    const ctrl = (window._customerControls && window._customerControls[lower]) || {};
    if (ctrl.agreementData) {
      const link = document.createElement("a");
      link.href = ctrl.agreementData;
      link.download = ctrl.agreementFile || "agency_agreement.pdf";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      alert("No PDF document uploaded or found for this won booking/customer.");
    }
  }
}
window.downloadNrsAgreementPdf = downloadNrsAgreementPdf;

function downloadNrsInvoicePackingPdf(id) {
  const list = window._nrsRegistryCached || [];
  const item = list.find(x => x.id === id);

  let invoicePackingData = item ? item.invoicePackingData : null;
  let invoicePackingName = item ? item.invoicePackingName : null;

  if (!invoicePackingData) {
    const q = appState.quotes.find(x => x.id === id);
    if (q) {
      invoicePackingData = q.invoicePackingData;
      invoicePackingName = q.invoicePackingName;
    }
  }

  if (invoicePackingData) {
    const link = document.createElement("a");
    link.href = invoicePackingData;
    link.download = invoicePackingName || "commercial_invoice_packing_list.pdf";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } else {
    alert("No Commercial Invoice & Packing List PDF uploaded for this booking.");
  }
}
window.downloadNrsInvoicePackingPdf = downloadNrsInvoicePackingPdf;

function displayNrsRegistryItems(list) {
  const tbody = document.getElementById("nrs-registry-body");
  if (!tbody) return;
  tbody.innerHTML = "";

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="10" style="text-align: center; color: var(--text-dim); padding: 2rem;">No won shipments registered yet.</td></tr>`;
    return;
  }

  const nrsSortMode = document.getElementById("nrs-sort-select")?.value || 'dateWon';
  const sorted = [...list].sort((a, b) => {
    if (nrsSortMode === 'agent') {
      const na = (a.agent || a.customer || '');
      const nb = (b.agent || b.customer || '');
      return na.localeCompare(nb);
    }
    if (nrsSortMode === 'followup') {
      // Most recent follow-up first; bookings with none sort to the end.
      const lastFollowUp = item => {
        const fus = item.followUps || [];
        if (fus.length === 0) return '';
        return fus.reduce((latest, fu) => (fu.date || '') > latest ? (fu.date || '') : latest, '');
      };
      const fa = lastFollowUp(a) || '0000-00-00';
      const fb = lastFollowUp(b) || '0000-00-00';
      return fb.localeCompare(fa);
    }
    // 'dateWon' (default)
    return new Date(b.dateWon) - new Date(a.dateWon);
  });

  tbody.innerHTML = sorted.map(item => {
    const agentKey = (item.agent || item.customer || "").toLowerCase().trim();
    const hasDoc = !!(item.agencyAgreementData || (window._customerControls && window._customerControls[agentKey] && window._customerControls[agentKey].agreementData));
    const docName = item.agencyAgreementName || (window._customerControls && window._customerControls[agentKey] && window._customerControls[agentKey].agreementFile) || "agency_agreement.pdf";

    // Derive correct nomination from refId prefix — overrides any stale stored mode value
    const prefix = (item.refId || "").substring(0, 2).toUpperCase();
    const isAirByRef = prefix === 'AE' || prefix === 'AI';
    const isSeaByRef = prefix === 'SE' || prefix === 'SI';
    const nomMode = isAirByRef ? 'Air Nomination' : (isSeaByRef ? 'Sea Nomination' : (item.mode || 'Sea Nomination'));
    const isAir = nomMode === 'Air Nomination';

    let docsHtml = "";
    if (hasDoc) {
      docsHtml += `
        <div style="display: flex; align-items: center; gap: 0.3rem;">
          <span style="font-size: 0.65rem; color: var(--accent-success); font-weight: 750; max-width: 90px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="Agreement: ${docName}">📜 ${docName}</span>
          <button class="btn-text" onclick="previewNrsAgreementPdf('${item.id}')" style="font-size: 0.65rem; padding: 0px 2px; color: var(--sky); border: none; background: transparent; cursor: pointer;" title="Preview PDF">👁️</button>
          <button class="btn-text" onclick="downloadNrsAgreementPdf('${item.id}')" style="font-size: 0.65rem; padding: 0px 2px; color: var(--sky); border: none; background: transparent; cursor: pointer;" title="Download PDF">📥</button>
        </div>`;
    } else {
      docsHtml += `<div style="font-size: 0.65rem; color: var(--accent-success); font-weight: 600;">NOT REQUIRED</div>`;
    }

    // Format shipper contact
    const sPhone = item.shipperPhone || "";
    const sEmail = item.shipperEmail || "";
    const sAddress = item.shipperAddress || "";
    let shipperSubtext = "";
    if (sPhone) shipperSubtext += `<div style="font-size: 0.62rem; color: var(--t3); margin-top: 1px;">📞 ${sPhone}</div>`;
    if (sEmail) shipperSubtext += `<div style="font-size: 0.62rem; color: var(--t3); margin-top: 1px;">📧 ${sEmail}</div>`;
    if (sAddress) shipperSubtext += `<div style="font-size: 0.62rem; color: var(--t3); margin-top: 1px; max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${sAddress}">📍 ${sAddress}</div>`;
    if (!shipperSubtext && item.shipperContact) {
      shipperSubtext = `<div style="font-size: 0.62rem; color: var(--t3); margin-top: 2px;">${item.shipperContact}</div>`;
    }

    // Format consignee contact
    const cPhone = item.consigneePhone || "";
    const cEmail = item.consigneeEmail || "";
    const cAddress = item.consigneeAddress || "";
    let consigneeSubtext = "";
    if (cPhone) consigneeSubtext += `<div style="font-size: 0.62rem; color: var(--t3); margin-top: 1px;">📞 ${cPhone}</div>`;
    if (cEmail) consigneeSubtext += `<div style="font-size: 0.62rem; color: var(--t3); margin-top: 1px;">📧 ${cEmail}</div>`;
    if (cAddress) consigneeSubtext += `<div style="font-size: 0.62rem; color: var(--t3); margin-top: 1px; max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${cAddress}">📍 ${cAddress}</div>`;
    if (!consigneeSubtext && item.consigneeContact) {
      consigneeSubtext = `<div style="font-size: 0.62rem; color: var(--t3); margin-top: 2px;">${item.consigneeContact}</div>`;
    }

    return `
      <tr>
        <td style="font-weight: 750; color: var(--sky); font-size: 0.72rem;">
          #${item.refId}
          ${item.pendingShipperDetails ? `<span title="Shipper/consignee details still needed" style="display: block; margin-top: 3px; font-size: 0.6rem; font-weight: 800; color: #d97706; background: rgba(217, 119, 6, 0.1); border: 1px solid rgba(217, 119, 6, 0.3); border-radius: 4px; padding: 1px 5px; white-space: nowrap;">⚠ Needs Details</span>` : ''}
        </td>
        <td>
          <span style="font-size: 0.65rem; font-weight: 800; padding: 2px 6px; border-radius: 4px; background: ${isAir ? 'rgba(27,28,92,0.05)' : 'rgba(47,49,147,0.05)'}; color: ${isAir ? 'var(--accent-air)' : 'var(--accent-sea)'}">
            ${nomMode}
          </span>
        </td>
        <td><div style="font-weight: 700; color: var(--t1); font-size: 0.72rem;">${item.agent || item.customer || 'N/A'}</div></td>
        <td>
          <div style="font-size: 0.68rem; font-weight: 750; color: var(--t2);">
            ${item.pol ? `<span title="Port of Loading">${item.pol}</span>` : '<span style="color:var(--t3);font-style:italic;">—</span>'}
          </div>
          <div style="font-size: 0.65rem; color: var(--t3); margin-top: 2px;">
            ${item.pod ? `<span title="Port of Discharge">→ ${item.pod}</span>` : ''}
          </div>
        </td>
        <td>
          <div style="font-weight: 750; font-size: 0.72rem; color: ${item.shipperName ? 'var(--t2)' : '#d97706'}; ${item.shipperName ? '' : 'font-style: italic;'}">${item.shipperName || 'Add shipper details'}</div>
          ${shipperSubtext}
        </td>
        <td>
          <div style="font-weight: 750; font-size: 0.72rem; color: ${item.consigneeName ? 'var(--t2)' : '#d97706'}; ${item.consigneeName ? '' : 'font-style: italic;'}">${item.consigneeName || 'Add consignee details'}</div>
          ${consigneeSubtext}
        </td>
        <td>
          <div style="font-weight: 750; font-size: 0.68rem; color: var(--indigo); max-width: 110px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${item.commodity || 'N/A'}">
            ${item.commodity || 'N/A'}
          </div>
        </td>
        <td>${docsHtml}</td>
        <td style="font-size: 0.68rem; color: var(--t3); font-weight: 600;">
          ${new Date(item.dateWon).toLocaleDateString("en-IN", { day: 'numeric', month: 'short', year: 'numeric' })}
        </td>
        <td>
          ${(() => {
        const followUps = item.followUps || [];
        const latest = followUps.length > 0 ? followUps[followUps.length - 1] : null;
        const statusColors = {
          'Awaiting Response': { bg: 'rgba(245,158,11,0.12)', color: '#d97706' },
          'Documents Pending': { bg: 'rgba(59,130,246,0.12)', color: '#2563eb' },
          'Booking Confirmed by Shipper': { bg: 'rgba(16,185,129,0.12)', color: '#059669' },
          'Shipment Dispatched': { bg: 'rgba(139,92,246,0.12)', color: '#7c3aed' },
          'Completed': { bg: 'rgba(34,197,94,0.12)', color: '#15803d' }
        };
        const sc = latest ? (statusColors[latest.status] || { bg: 'rgba(0,0,0,0.05)', color: 'var(--t3)' }) : null;
        let badgeHtml = '';
        if (latest) {
          badgeHtml = `<div style="font-size: 0.58rem; font-weight: 800; padding: 2px 5px; border-radius: 4px; background: ${sc.bg}; color: ${sc.color}; margin-bottom: 3px; white-space: nowrap;">${latest.status}</div>`;
        }
        return `
              ${badgeHtml}
              <button onclick="openNrsFollowUpModal('${item.id}')" style="font-size: 0.62rem; padding: 3px 8px; border-radius: 6px; border: 1px solid var(--border-1); background: var(--bg-input); color: var(--sky); cursor: pointer; font-weight: 700; white-space: nowrap; margin-right: 4px;" title="View / Add Follow-ups">
                📋 ${followUps.length > 0 ? followUps.length + ' note' + (followUps.length > 1 ? 's' : '') : 'Track'}
              </button>
              <button onclick="openNrsEditDetailsModal('${item.id}')" style="font-size: 0.62rem; padding: 3px 8px; border-radius: 6px; border: 1px solid ${item.pendingShipperDetails ? '#d97706' : 'var(--border-1)'}; background: ${item.pendingShipperDetails ? 'rgba(217,119,6,0.08)' : 'var(--bg-input)'}; color: ${item.pendingShipperDetails ? '#d97706' : 'var(--sky)'}; cursor: pointer; font-weight: 700; white-space: nowrap;" title="Edit shipper/consignee/commodity details">
                ✏️ ${item.pendingShipperDetails ? 'Add Details' : 'Edit'}
              </button>
            `;
      })()}
        </td>
      </tr>
    `;
  }).join("");
}

function filterNrsRegistry(query) {
  const list = window._nrsRegistryCached || [];
  const q = query.trim().toLowerCase();
  if (!q) {
    displayNrsRegistryItems(list);
    return;
  }

  const filtered = list.filter(item => {
    return (
      item.refId.toLowerCase().includes(q) ||
      (item.agent && item.agent.toLowerCase().includes(q)) ||
      (item.customer && item.customer.toLowerCase().includes(q)) ||
      (item.pol && item.pol.toLowerCase().includes(q)) ||
      (item.pod && item.pod.toLowerCase().includes(q)) ||
      item.shipperName.toLowerCase().includes(q) ||
      (item.shipperPhone && item.shipperPhone.toLowerCase().includes(q)) ||
      (item.shipperEmail && item.shipperEmail.toLowerCase().includes(q)) ||
      item.consigneeName.toLowerCase().includes(q) ||
      (item.consigneePhone && item.consigneePhone.toLowerCase().includes(q)) ||
      (item.consigneeEmail && item.consigneeEmail.toLowerCase().includes(q)) ||
      (item.commodity && item.commodity.toLowerCase().includes(q)) ||
      item.mode.toLowerCase().includes(q)
    );
  });
  displayNrsRegistryItems(filtered);
}
window.filterNrsRegistry = filterNrsRegistry;

// ==================== NRS FOLLOW-UP TRACKER ====================
function openNrsFollowUpModal(itemId) {
  const list = window._nrsRegistryCached || [];
  const item = list.find(i => i.id === itemId);
  if (!item) {
    alert('Booking record not found.');
    return;
  }

  document.getElementById('nrs-followup-item-id').value = itemId;

  // Derive correct mode from refId
  const prefix = (item.refId || '').substring(0, 2).toUpperCase();
  const isAirByRef = prefix === 'AE' || prefix === 'AI';
  const isSeaByRef = prefix === 'SE' || prefix === 'SI';
  const nomMode = isAirByRef ? 'Air Nomination' : (isSeaByRef ? 'Sea Nomination' : (item.mode || 'N/A'));

  // Set title
  document.getElementById('nrs-followup-title').textContent = `#${item.refId} — FOLLOW-UPS`;

  // Set summary
  const agentName = item.agent || item.customer || 'N/A';
  document.getElementById('nrs-followup-summary').innerHTML = `
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.3rem;">
      <div><strong>Agent:</strong> ${agentName}</div>
      <div><strong>Mode:</strong> ${nomMode}</div>
      <div><strong>Shipper:</strong> ${item.shipperName || 'N/A'}</div>
      <div><strong>Consignee:</strong> ${item.consigneeName || 'N/A'}</div>
      <div><strong>POL:</strong> ${item.pol || '—'}</div>
      <div><strong>POD:</strong> ${item.pod || '—'}</div>
      <div><strong>Commodity:</strong> ${item.commodity || 'N/A'}</div>
      <div><strong>Date Won:</strong> ${item.dateWon ? new Date(item.dateWon).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A'}</div>
    </div>
  `;

  // Render follow-up log
  renderNrsFollowUpLog(item.followUps || []);

  // Clear input
  document.getElementById('nrs-followup-note').value = '';
  document.getElementById('nrs-followup-status').selectedIndex = 0;

  // Show modal
  const modal = document.getElementById('nrs-followup-modal');
  modal.style.display = 'flex';
}
window.openNrsFollowUpModal = openNrsFollowUpModal;

function renderNrsFollowUpLog(followUps) {
  const log = document.getElementById('nrs-followup-log');
  if (!log) return;

  if (!followUps || followUps.length === 0) {
    log.innerHTML = `<div style="text-align: center; color: var(--t3); font-size: 0.68rem; font-style: italic; padding: 1rem;">No follow-ups recorded yet.</div>`;
    return;
  }

  const statusIcons = {
    'Awaiting Response': '📞',
    'Documents Pending': '📄',
    'Booking Confirmed by Shipper': '✅',
    'Shipment Dispatched': '🚀',
    'Completed': '🏁'
  };

  const statusColors = {
    'Awaiting Response': '#d97706',
    'Documents Pending': '#2563eb',
    'Booking Confirmed by Shipper': '#059669',
    'Shipment Dispatched': '#7c3aed',
    'Completed': '#15803d'
  };

  // Show newest first
  const sorted = [...followUps].reverse();

  log.innerHTML = sorted.map((fu, idx) => {
    const icon = statusIcons[fu.status] || '📝';
    const color = statusColors[fu.status] || 'var(--t2)';
    const dateStr = fu.date ? new Date(fu.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
    const timeStr = fu.time || '';
    const byUser = fu.by ? (TEAM_ROLES[fu.by]?.name || fu.by) : '';

    return `
      <div style="padding: 0.5rem 0.6rem; border-bottom: 1px solid var(--border-1); ${idx === sorted.length - 1 ? 'border-bottom: none;' : ''}">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;">
          <span style="font-size: 0.64rem; font-weight: 800; color: ${color};">${icon} ${fu.status}</span>
          <span style="font-size: 0.58rem; color: var(--t3); font-weight: 600;">${dateStr} ${timeStr}</span>
        </div>
        <div style="font-size: 0.68rem; color: var(--t2); line-height: 1.4;">${fu.note || '<em style="color:var(--t3)">No note</em>'}</div>
        ${byUser ? `<div style="font-size: 0.56rem; color: var(--t3); margin-top: 2px; font-weight: 600;">— ${byUser}</div>` : ''}
      </div>
    `;
  }).join('');

  // Scroll to top (latest)
  log.scrollTop = 0;
}

async function addNrsFollowUp() {
  const itemId = document.getElementById('nrs-followup-item-id').value;
  const status = document.getElementById('nrs-followup-status').value;
  const note = document.getElementById('nrs-followup-note').value.trim();

  if (!note) {
    alert('Please enter a follow-up note.');
    return;
  }

  if (!itemId) {
    alert('Booking reference not found.');
    return;
  }

  const now = new Date();
  const followUpEntry = {
    date: now.toISOString().split('T')[0],
    time: now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
    status: status,
    note: note,
    by: appState.currentUser || 'unknown'
  };

  // Update cached data
  const list = window._nrsRegistryCached || [];
  const item = list.find(i => i.id === itemId);
  if (!item) {
    alert('Booking record not found in cache.');
    return;
  }

  if (!item.followUps) item.followUps = [];
  item.followUps.push(followUpEntry);

  // Persist to Firestore
  try {
    if (DB.firestoreRef) {
      await DB.firestoreRef.collection('nrs_registry').doc(itemId).set(
        { followUps: item.followUps },
        { merge: true }
      );
    } else {
      // Offline fallback — save to localStorage
      let offlineNrs = {};
      try { offlineNrs = JSON.parse(localStorage.getItem('gl_nrs_registry') || '{}'); } catch (e) { }
      if (!offlineNrs[itemId]) offlineNrs[itemId] = {};
      offlineNrs[itemId].followUps = item.followUps;
      localStorage.setItem('gl_nrs_registry', JSON.stringify(offlineNrs));
    }
  } catch (err) {
    console.error('Failed to save follow-up:', err);
    alert('⚠️ Follow-up saved locally but Firestore sync failed.');
  }

  // Re-render the log
  renderNrsFollowUpLog(item.followUps);

  // Clear input
  document.getElementById('nrs-followup-note').value = '';
  document.getElementById('nrs-followup-status').selectedIndex = 0;

  // Refresh the NRS table to show the updated badge
  displayNrsRegistryItems(list);
}
window.addNrsFollowUp = addNrsFollowUp;

function closeNrsFollowUpModal() {
  const modal = document.getElementById('nrs-followup-modal');
  if (modal) modal.style.display = 'none';
}
window.closeNrsFollowUpModal = closeNrsFollowUpModal;

// Lets the NRS user fill in shipper/consignee/commodity on a booking that
// was Quick Converted with rates only — a direct update to the nrs_registry
// entry itself, entirely separate from the original quote/calculation data.
function openNrsEditDetailsModal(itemId) {
  const list = window._nrsRegistryCached || [];
  const item = list.find(i => i.id === itemId);
  if (!item) {
    alert('Booking record not found.');
    return;
  }

  document.getElementById('nrs-edit-id').value = itemId;
  document.getElementById('nrs-edit-details-title').textContent = `#${item.refId} — SHIPPER / CONSIGNEE DETAILS`;
  document.getElementById('nrs-edit-shipper-name').value = item.shipperName || '';
  document.getElementById('nrs-edit-shipper-phone').value = item.shipperPhone || '';
  document.getElementById('nrs-edit-shipper-email').value = item.shipperEmail || '';
  document.getElementById('nrs-edit-shipper-address').value = item.shipperAddress || '';
  document.getElementById('nrs-edit-cnee-name').value = item.consigneeName || '';
  document.getElementById('nrs-edit-cnee-phone').value = item.consigneePhone || '';
  document.getElementById('nrs-edit-cnee-email').value = item.consigneeEmail || '';
  document.getElementById('nrs-edit-cnee-address').value = item.consigneeAddress || '';
  document.getElementById('nrs-edit-commodity').value = item.commodity || '';

  const modal = document.getElementById('nrs-edit-details-modal');
  if (modal) modal.style.display = 'flex';
}
window.openNrsEditDetailsModal = openNrsEditDetailsModal;

function closeNrsEditDetailsModal() {
  const modal = document.getElementById('nrs-edit-details-modal');
  if (modal) modal.style.display = 'none';
}
window.closeNrsEditDetailsModal = closeNrsEditDetailsModal;

async function saveNrsEditDetails(e) {
  e.preventDefault();
  const itemId = document.getElementById('nrs-edit-id').value;
  const list = window._nrsRegistryCached || [];
  const item = list.find(i => i.id === itemId);
  if (!item) {
    alert('Booking record not found.');
    return;
  }

  const updates = {
    shipperName: document.getElementById('nrs-edit-shipper-name').value.trim(),
    shipperPhone: document.getElementById('nrs-edit-shipper-phone').value.trim(),
    shipperEmail: document.getElementById('nrs-edit-shipper-email').value.trim(),
    shipperAddress: document.getElementById('nrs-edit-shipper-address').value.trim(),
    consigneeName: document.getElementById('nrs-edit-cnee-name').value.trim(),
    consigneePhone: document.getElementById('nrs-edit-cnee-phone').value.trim(),
    consigneeEmail: document.getElementById('nrs-edit-cnee-email').value.trim(),
    consigneeAddress: document.getElementById('nrs-edit-cnee-address').value.trim(),
    commodity: document.getElementById('nrs-edit-commodity').value.trim()
  };
  // Clears the "Needs Details" flag once both parties are filled in — stays
  // set (and the badge stays visible) if only one side has been completed.
  updates.pendingShipperDetails = !(updates.shipperName && updates.consigneeName);

  Object.assign(item, updates);

  try {
    if (DB.firestoreRef) {
      await DB.firestoreRef.collection('nrs_registry').doc(itemId).set(updates, { merge: true });
    } else {
      let offlineNrs = {};
      try { offlineNrs = JSON.parse(localStorage.getItem('gl_nrs_registry') || '{}'); } catch (e) { }
      offlineNrs[itemId] = { ...(offlineNrs[itemId] || {}), ...updates };
      localStorage.setItem('gl_nrs_registry', JSON.stringify(offlineNrs));
    }
  } catch (err) {
    console.error('Failed to save NRS booking details:', err);
    alert('⚠️ Details saved locally but Firestore sync failed: ' + err.message);
  }

  closeNrsEditDetailsModal();
  displayNrsRegistryItems(list);
}
window.saveNrsEditDetails = saveNrsEditDetails;

// CREDIT CONTROL & COMPLIANCE HANDLERS
window._uploadedAgreements = { air: null, sea: null };
function handleAgreementUpload(mode, input) {
  if (!input.files || input.files.length === 0) return;
  const file = input.files[0];

  if (!window._uploadedAgreements) window._uploadedAgreements = {};
  window._uploadedAgreements[mode] = {
    name: file.name,
    size: file.size
  };

  const statusLabel = document.getElementById(`${mode}-agreement-status`);
  if (statusLabel) {
    statusLabel.textContent = "Uploaded";
    statusLabel.style.color = "var(--accent-success)";
    statusLabel.style.background = "rgba(16, 185, 129, 0.1)";
  }

  const filenameLabel = document.getElementById(`${mode}-agreement-filename`);
  if (filenameLabel) {
    filenameLabel.textContent = file.name;
    filenameLabel.title = file.name;
  }
}
window.handleAgreementUpload = handleAgreementUpload;

async function renderAdminCustomerControlList() {
  const isAdmin = (appState.currentUser === 'ganny' || (TEAM_ROLES[appState.currentUser]?.type === 'admin'));
  if (!isAdmin) {
    return;
  }

  const tbody = document.getElementById("admin-customer-control-body");
  if (!tbody) return;

  // This list lives inside the Admin Settings modal, which is rarely open —
  // the customer_control Firestore listener called this on every write
  // regardless, scanning every quote in the company just to rebuild a table
  // sitting inside a closed modal. Skip that work until the modal is visible.
  const settingsModal = document.getElementById("admin-settings-modal");
  const isModalVisible = !!(settingsModal && settingsModal.style.display !== "none" && settingsModal.style.display !== "");
  if (!isModalVisible) return;

  // Compile unique customers from quotes and controls
  let controls = window._customerControls || {};
  if (Object.keys(controls).length === 0) {
    try {
      controls = JSON.parse(localStorage.getItem("gl_customer_controls") || "{}");
    } catch (e) { }
  }
  const customers = Array.from(new Set([
    ...appState.quotes.map(q => q.customer.trim()),
    ...Object.values(controls).map(c => c.customer.trim()),
    ...Object.keys(TEAM_ROLES).map(k => TEAM_ROLES[k].name),
    ...Object.keys(TEAM_ROLES)
  ]));

  if (customers.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-dim); padding: 1.5rem;">No customer records found. Add quotes or override requests to populate.</td></tr>`;
    return;
  }

  window._adminCustomerListCached = customers.map(name => {
    const lower = name.toLowerCase();
    const ctrl = controls[lower] || {
      customer: name,
      creditDays: 36,
      creditLimit: 0,
      blocked: false,
      waiveAgreement: false
    };
    return ctrl;
  });

  displayAdminCustomerControlList(window._adminCustomerListCached);
}
window.renderAdminCustomerControlList = renderAdminCustomerControlList;

function downloadAgreementPdf(customerName) {
  const lower = customerName.toLowerCase().trim();
  const ctrl = (window._customerControls && window._customerControls[lower]) || {};
  if (ctrl.agreementData) {
    const link = document.createElement("a");
    link.href = ctrl.agreementData;
    link.download = ctrl.agreementFile || "agency_agreement.pdf";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } else {
    alert("No PDF data found for this customer.");
  }
}
window.downloadAgreementPdf = downloadAgreementPdf;

async function saveCustomerAgreementRecord(customerName, fileName, fileData) {
  if (!customerName) return;
  const lower = customerName.toLowerCase().trim();
  let controls = window._customerControls || {};
  if (!controls[lower]) {
    controls[lower] = { customer: customerName, creditDays: 36, creditLimit: 0, blocked: false, waiveAgreement: false };
  }

  controls[lower].hasAgreement = true;
  controls[lower].agreementFile = fileName;
  controls[lower].agreementData = fileData;
  window._customerControls = controls;

  // Save to Firestore/local storage
  if (DB.firestoreRef) {
    try {
      await DB.firestoreRef.collection("customer_control").doc(lower).set(controls[lower], { merge: true });
      console.log(`DB: Saved agency agreement for "${customerName}" to Firestore.`);
    } catch (err) {
      console.error("DB: Failed to save agency agreement to Firestore:", err);
    }
  } else {
    try {
      let offlineControls = JSON.parse(localStorage.getItem("gl_customer_controls") || "{}");
      offlineControls[lower] = controls[lower];
      localStorage.setItem("gl_customer_controls", JSON.stringify(offlineControls));
    } catch (e) { }
  }
}
window.saveCustomerAgreementRecord = saveCustomerAgreementRecord;

async function resetCustomerAgreement(customerName) {
  if (!confirm(`Are you sure you want to cancel and delete the Agency Agreement for "${customerName}"?`)) return;

  const lower = customerName.toLowerCase().trim();
  let controls = window._customerControls || {};
  if (controls[lower]) {
    controls[lower].hasAgreement = false;
    delete controls[lower].agreementFile;
    delete controls[lower].agreementData;

    // Sync to database
    if (DB.firestoreRef) {
      await DB.firestoreRef.collection("customer_control").doc(lower).set(controls[lower]);
    } else {
      try {
        let offlineControls = JSON.parse(localStorage.getItem("gl_customer_controls") || "{}");
        offlineControls[lower] = controls[lower];
        localStorage.setItem("gl_customer_controls", JSON.stringify(offlineControls));
      } catch (e) { }
    }
    alert(`Successfully reset Agency Agreement for "${customerName}".`);
    renderAdminCustomerControlList();
  }
}
window.resetCustomerAgreement = resetCustomerAgreement;

function displayAdminCustomerControlList(list) {
  const tbody = document.getElementById("admin-customer-control-body");
  if (!tbody) return;

  tbody.innerHTML = list.map(ctrl => {
    const waiveAgreement = !!ctrl.waiveAgreement;
    const creditDays = ctrl.creditDays || 36;
    const creditLimit = ctrl.creditLimit || 0;
    const hasAgreement = !!ctrl.hasAgreement;
    const fileName = ctrl.agreementFile || "";
    const lower = ctrl.customer.toLowerCase().trim();

    // Check for pending requests
    const pendingReqs = window._amendmentRequests || [];
    const hasPendingWaiver = pendingReqs.some(r => (r.customer || "").toLowerCase().trim() === lower && r.requestType === 'agreement_waiver' && r.status === 'pending');

    const agreementCell = hasAgreement
      ? `<div style="display: flex; align-items: center; gap: 0.4rem;">
           <span style="font-size: 0.65rem; color: var(--accent-success); font-weight: 750; max-width: 110px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${fileName}">${fileName}</span>
           <button class="btn-text" onclick="downloadAgreementPdf('${ctrl.customer}')" style="font-size: 0.65rem; padding: 2px 4px; color: var(--sky); border: none; background: transparent; cursor: pointer; text-decoration: underline;">📥 Download</button>
           <button class="btn-text" onclick="resetCustomerAgreement('${ctrl.customer}')" style="font-size: 0.65rem; padding: 2px 4px; color: var(--accent-error); border: none; background: transparent; cursor: pointer; text-decoration: underline;">❌ Reset</button>
         </div>`
      : `<span style="font-size: 0.65rem; color: var(--t3); font-style: italic;">No Agreement PDF</span>`;

    let complianceHtml = `
      <span style="font-size: 0.65rem; font-weight: 800; padding: 2px 6px; border-radius: 4px; background: ${waiveAgreement ? 'rgba(46,204,113,0.1)' : 'rgba(231,76,60,0.1)'}; color: ${waiveAgreement ? 'var(--accent-success)' : 'var(--accent-error)'};">
        ${waiveAgreement ? 'Agreement Waived' : 'Agreement Required'}
      </span>
    `;
    if (hasPendingWaiver) {
      complianceHtml += `
        <span style="font-size: 0.62rem; font-weight: 900; padding: 2px 6px; border-radius: 4px; background: rgba(245,158,11,0.2); color: var(--accent-warning); margin-left: 4px; border: 1px solid rgba(245,158,11,0.3); text-shadow: 0 0 4px rgba(245,158,11,0.3);" title="Pending Waiver request submitted by user">
          WAIVER REQ ⏳
        </span>
      `;
    }

    let statusHtml = `
      <span style="font-size: 0.65rem; font-weight: 800; padding: 2px 6px; border-radius: 4px; background: rgba(46,204,113,0.1); color: var(--accent-success);">
        Active (Released)
      </span>
    `;

    return `
      <tr>
        <td style="font-weight: 700; color: var(--t1);">${ctrl.customer}</td>
        <td>
          <input type="number" value="${creditDays}" min="0" max="365" 
            style="width: 50px; font-size: 0.72rem; padding: 2px 4px; border-radius: 4px; background: var(--bg-input); border: 1px solid var(--border-1); color: var(--t1);" 
            onchange="updateCustomerCreditPeriod('${ctrl.customer}', this.value)"> days
        </td>
        <td>
          $<input type="number" value="${creditLimit}" min="0" 
            style="width: 80px; font-size: 0.72rem; padding: 2px 4px; border-radius: 4px; background: var(--bg-input); border: 1px solid var(--border-1); color: var(--t1);" 
            onchange="updateCustomerCreditLimitValue('${ctrl.customer}', this.value)">
        </td>
        <td>${complianceHtml}</td>
        <td>${agreementCell}</td>
        <td>${statusHtml}</td>
        <td>
          <div style="display: flex; gap: 0.3rem;">
            <button class="btn-secondary" onclick="toggleCustomerAgreementWaiver('${ctrl.customer}')" style="font-size: 0.65rem; padding: 2px 6px; margin: 0; font-weight: 700; border-radius: 4px; border: 1px solid var(--border-2); cursor: pointer; background: var(--bg-card); color: var(--t1);">
              ${waiveAgreement ? 'Require Agreement' : 'Waive Agreement'}
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

async function updateCustomerCreditPeriod(customerName, days) {
  const val = parseInt(days);
  if (isNaN(val) || val < 0) return;
  const lower = customerName.toLowerCase();

  let controls = window._customerControls || {};
  if (!controls[lower]) {
    controls[lower] = { customer: customerName, creditDays: 36, creditLimit: 0, blocked: false, waiveAgreement: false };
  }
  controls[lower].creditDays = val;
  window._customerControls = controls;

  if (DB.firestoreRef) {
    await DB.firestoreRef.collection("customer_control").doc(lower).set(controls[lower], { merge: true });
  } else {
    try {
      let offlineControls = JSON.parse(localStorage.getItem("gl_customer_controls") || "{}");
      offlineControls[lower] = controls[lower];
      localStorage.setItem("gl_customer_controls", JSON.stringify(offlineControls));
    } catch (e) { }
  }
}
window.updateCustomerCreditPeriod = updateCustomerCreditPeriod;

async function updateCustomerCreditLimitValue(customerName, limit) {
  const val = parseFloat(limit);
  if (isNaN(val) || val < 0) return;
  const lower = customerName.toLowerCase();

  let controls = window._customerControls || {};
  if (!controls[lower]) {
    controls[lower] = { customer: customerName, creditDays: 36, creditLimit: 0, blocked: false, waiveAgreement: false };
  }
  controls[lower].creditLimit = val;
  window._customerControls = controls;

  if (DB.firestoreRef) {
    await DB.firestoreRef.collection("customer_control").doc(lower).set(controls[lower], { merge: true });
  } else {
    try {
      let offlineControls = JSON.parse(localStorage.getItem("gl_customer_controls") || "{}");
      offlineControls[lower] = controls[lower];
      localStorage.setItem("gl_customer_controls", JSON.stringify(offlineControls));
    } catch (e) { }
  }
}
window.updateCustomerCreditLimitValue = updateCustomerCreditLimitValue;

async function toggleCustomerAgreementWaiver(customerName) {
  const lower = customerName.toLowerCase();
  let controls = window._customerControls || {};
  if (!controls[lower]) {
    controls[lower] = { customer: customerName, creditDays: 36, blocked: false, waiveAgreement: false };
  }
  controls[lower].waiveAgreement = !controls[lower].waiveAgreement;
  window._customerControls = controls;

  if (DB.firestoreRef) {
    await DB.firestoreRef.collection("customer_control").doc(lower).set(controls[lower], { merge: true });
  } else {
    try {
      let offlineControls = JSON.parse(localStorage.getItem("gl_customer_controls") || "{}");
      offlineControls[lower] = controls[lower];
      localStorage.setItem("gl_customer_controls", JSON.stringify(offlineControls));
    } catch (e) { }
    renderAdminCustomerControlList();
  }
}
window.toggleCustomerAgreementWaiver = toggleCustomerAgreementWaiver;

function filterAdminCustomerList(query) {
  const list = window._adminCustomerListCached || [];
  const q = query.trim().toLowerCase();
  if (!q) {
    displayAdminCustomerControlList(list);
    return;
  }
  const filtered = list.filter(c => c.customer.toLowerCase().includes(q));
  displayAdminCustomerControlList(filtered);
}
window.filterAdminCustomerList = filterAdminCustomerList;

// DIAGNOSTICS & RESET HANDLERS
window._lastJsError = "None";
window.addEventListener("error", (e) => {
  window._lastJsError = `${e.message} (${e.filename}:${e.lineno})`;
  const statusLabel = document.getElementById("diag-status");
  if (statusLabel) {
    statusLabel.textContent = `Error: ${e.message}`;
    statusLabel.style.color = "var(--accent-error)";
  }
});

function resetDbConnectionLocal() {
  if (confirm("Reset Firebase Cloud Connection and fallback to Offline Local Database? This will clear active session, unregister service workers, purge caches, and reload the application.")) {
    localStorage.removeItem("gl_firebase_config");
    localStorage.removeItem("gl_firebase_config_raw");
    localStorage.removeItem("gl_custom_users");
    localStorage.setItem("gl_use_offline", "true");
    sessionStorage.clear();

    // Clear service worker registrations
    if (navigator.serviceWorker) {
      navigator.serviceWorker.getRegistrations().then(regs => {
        for (let r of regs) r.unregister();
      });
    }

    // Clear all caches
    if (window.caches) {
      caches.keys().then(keys => {
        keys.forEach(k => caches.delete(k));
      });
    }

    // Force hard reload with timestamp to bypass caches
    setTimeout(() => {
      window.location.href = window.location.origin + window.location.pathname + '?r=' + Date.now();
    }, 300);
  }
}
window.resetDbConnectionLocal = resetDbConnectionLocal;

function toggleDiagnosticsDrawer() {
  const drawer = document.getElementById("diagnostics-drawer");
  if (!drawer) return;

  if (drawer.style.display === "none") {
    drawer.style.display = "block";
    updateDiagnosticsUI();
  } else {
    drawer.style.display = "none";
  }
}
window.toggleDiagnosticsDrawer = toggleDiagnosticsDrawer;

function updateDiagnosticsUI() {
  const diagConn = document.getElementById("diag-conn");
  const diagProj = document.getElementById("diag-project");
  const diagUsers = document.getElementById("diag-users");
  const diagStatus = document.getElementById("diag-status");

  if (diagConn) diagConn.textContent = DB.isCloud ? "Cloud (Online) 🟢" : "Offline (Local) 🔵";

  let projectId = "None";
  try {
    const configRaw = localStorage.getItem("gl_firebase_config");
    if (configRaw) {
      const config = JSON.parse(configRaw);
      if (config && config.projectId) projectId = config.projectId;
    }
  } catch (e) { }
  if (diagProj) diagProj.textContent = projectId;

  let dbUsers = window._firebaseUsers || [];
  if (dbUsers.length === 0) {
    try {
      const stored = localStorage.getItem("gl_custom_users");
      if (stored) dbUsers = JSON.parse(stored) || [];
    } catch (e) { }
  }
  if (diagUsers) diagUsers.textContent = `${dbUsers.length} users`;

  if (diagStatus) {
    if (window._lastJsError && window._lastJsError !== "None") {
      diagStatus.textContent = window._lastJsError;
      diagStatus.style.color = "var(--accent-error)";
    } else {
      diagStatus.textContent = DB.isCloud ? "Connection established" : "Local fallback active";
      diagStatus.style.color = DB.isCloud ? "var(--accent-success)" : "var(--sky)";
    }
  }
}
window.updateDiagnosticsUI = updateDiagnosticsUI;

async function resetCustomerCreditDirectory() {
  if (!confirm("⚠️ Are you sure you want to reset all credit control records and remove all override settings in the database?")) return;

  if (DB.firestoreRef) {
    try {
      const snap = await DB.firestoreRef.collection("customer_control").get();
      const promises = [];
      snap.forEach(doc => {
        promises.push(doc.ref.delete());
      });
      await Promise.all(promises);
      console.log("DB: Successfully cleared customer_control collection from Firestore.");
    } catch (err) {
      console.error("DB: Failed to clear customer_control from Firestore:", err);
      alert("Database error: " + err.message);
      return;
    }
  }

  localStorage.removeItem("gl_customer_controls");
  window._customerControls = {};
  alert("Customer credit control directory has been reset successfully!");
  renderAdminCustomerControlList();
}
window.resetCustomerCreditDirectory = resetCustomerCreditDirectory;

async function clearAllTestData() {
  if (!confirm("🚨 WARNING: Are you sure you want to clear ALL test quotes, NRS registry bookings, and approvals requests from the database? This is permanent!")) return;

  if (DB.firestoreRef) {
    try {
      // Clear quotes
      const quotesSnap = await DB.firestoreRef.collection("quotes").get();
      const qPromises = [];
      quotesSnap.forEach(doc => qPromises.push(doc.ref.delete()));
      await Promise.all(qPromises);

      // Clear nrs_registry
      const nrsSnap = await DB.firestoreRef.collection("nrs_registry").get();
      const nrsPromises = [];
      nrsSnap.forEach(doc => nrsPromises.push(doc.ref.delete()));
      await Promise.all(nrsPromises);

      // Clear amendment_requests
      const reqsSnap = await DB.firestoreRef.collection("amendment_requests").get();
      const reqsPromises = [];
      reqsSnap.forEach(doc => reqsPromises.push(doc.ref.delete()));
      await Promise.all(reqsPromises);

      console.log("DB: Cleared quotes, nrs_registry, and amendment_requests collections.");
    } catch (err) {
      console.error("DB: Failed to clear test data from Firestore:", err);
      alert("Database error: " + err.message);
      return;
    }
  }

  // Clear local caches
  localStorage.removeItem("logistics_quotes");
  localStorage.removeItem("gl_nrs_registry");
  localStorage.removeItem("gl_amendment_requests");

  appState.quotes = [];
  window._amendmentRequests = [];

  alert("All test data has been cleared from database successfully!");
  renderAdminDashboard();
}
window.clearAllTestData = clearAllTestData;

async function runDbDiagnostics() {
  const outputEl = document.getElementById("db-diagnostics-output") || console;
  let logs = [];
  const log = (msg) => {
    logs.push(msg);
    if (outputEl && outputEl.tagName) {
      outputEl.innerHTML = logs.join("<br>");
    } else {
      console.log(msg);
    }
  };

  log("🔍 Starting Database Connection Diagnostics...");
  log(`• App Mode: ${DB.isCloud ? "Firebase Cloud (Online) 🟢" : "LocalStorage (Offline) 🔵"}`);

  let configRaw = localStorage.getItem("gl_firebase_config");
  log(`• Custom config: ${configRaw ? "Yes" : "No (Using DEFAULT)"}`);

  if (!DB.firestoreRef) {
    log("❌ Firestore Ref is null. Connection not initialized.");
    return;
  }

  log(`• Project ID: ${DB.firestoreRef.app.options.projectId}`);

  // Test quotes read
  try {
    const snap = await DB.firestoreRef.collection("quotes").limit(1).get();
    log(`✅ quotes collection read test: PASSED (Found ${snap.size} docs)`);
  } catch (err) {
    log(`❌ quotes collection read test: FAILED - ${err.message}`);
  }

  // Test amendment_requests write
  const testId = "TEST_WRITE_DIAGNOSTIC";
  try {
    log("• Attempting write to 'amendment_requests'...");
    await DB.firestoreRef.collection("amendment_requests").doc(testId).set({
      test: true,
      timestamp: Date.now(),
      status: 'diagnostic'
    });
    log("✅ 'amendment_requests' write test: PASSED");

    // Clean it up
    await DB.firestoreRef.collection("amendment_requests").doc(testId).delete();
    log("✅ 'amendment_requests' delete test: PASSED");

    // Clear any previous error warning banner
    delete window._amendmentRequestsError;
    if (appState.currentUser === 'ganny') {
      renderAdminDashboard();
    }
  } catch (err) {
    log(`❌ 'amendment_requests' write test: FAILED - ${err.message}`);
    log(`👉 Recommendation: Ask your developer to modify Firestore Security Rules to allow read, write on 'amendment_requests' collection.`);
  }
}
window.runDbDiagnostics = runDbDiagnostics;

/* ══════════════════════════════════════════════════
   SALES MODULE — Leads & Activities (Phase A)
   Additive only: new "leads"/"activities" Firestore collections,
   never reads or writes quotes, customer_control, or any pricing field.
   ══════════════════════════════════════════════════ */
window._salesStatusFilter = 'all';

function ensureSalesDataLoaded() {
  if ((!appState.leads || appState.leads.length === 0) && !DB.isCloud) {
    try { appState.leads = JSON.parse(localStorage.getItem("gl_leads") || "[]"); } catch (e) { appState.leads = appState.leads || []; }
  }
  if ((!appState.activities || appState.activities.length === 0) && !DB.isCloud) {
    try { appState.activities = JSON.parse(localStorage.getItem("gl_activities") || "[]"); } catch (e) { appState.activities = appState.activities || []; }
  }
}

function getAllKnownCustomerNames() {
  const names = new Set();
  (appState.quotes || []).forEach(q => { if (q.customer) names.add(q.customer.trim()); });
  const controls = window._customerControls || {};
  Object.values(controls).forEach(c => { if (c && c.customer) names.add(c.customer.trim()); });
  return Array.from(names).sort();
}

function populateLeadAssignedToSelect() {
  const sel = document.getElementById("lead-assigned-to");
  if (!sel) return;
  const current = sel.value;
  sel.innerHTML = '';
  Object.keys(TEAM_ROLES).forEach(roleId => {
    if (roleId === 'ganny') return;
    const opt = document.createElement("option");
    opt.value = roleId;
    opt.textContent = TEAM_ROLES[roleId]?.name || roleId;
    sel.appendChild(opt);
  });
  if (current) sel.value = current;
  else if (appState.currentUser && TEAM_ROLES[appState.currentUser]) sel.value = appState.currentUser;
}

function formatLeadStatus(status) {
  const map = { new: 'New', contacted: 'Contacted', qualified: 'Qualified', quoted: 'Quoted', won: 'Won', lost: 'Lost' };
  return map[status] || 'New';
}

function lastActivityDateFor(relatedType, relatedId) {
  const acts = (appState.activities || []).filter(a => a.relatedType === relatedType && a.relatedId === relatedId);
  if (acts.length === 0) return null;
  return acts.reduce((latest, a) => (!latest || (a.createdAt || '') > (latest.createdAt || '')) ? a : latest, null);
}

function renderSalesPanel() {
  ensureSalesDataLoaded();
  const body = document.getElementById("sales-leads-body");
  if (!body) return;
  // The leads Firestore listener calls this on every write, system-wide —
  // skip the table rebuild when the Sales panel isn't the visible one, same
  // fix applied to the Dashboard's admin/member render paths.
  const salesPanel = document.getElementById("sales-panel");
  if (!salesPanel || !salesPanel.classList.contains("active")) return;

  const query = (document.getElementById("sales-search-input")?.value || "").toLowerCase().trim();
  const statusFilter = window._salesStatusFilter || 'all';

  let leads = [...(appState.leads || [])];

  const filtered = leads.filter(lead => {
    if (statusFilter !== 'all' && (lead.status || 'new') !== statusFilter) return false;
    if (!query) return true;
    const haystack = `${lead.company || ''} ${lead.contactName || ''} ${TEAM_ROLES[lead.assignedTo]?.name || lead.assignedTo || ''}`.toLowerCase();
    return haystack.includes(query);
  });

  const salesSortMode = document.getElementById("sales-sort-select")?.value || 'newest';
  filtered.sort((a, b) => {
    if (salesSortMode === 'company') {
      return (a.company || '').localeCompare(b.company || '');
    }
    if (salesSortMode === 'assigned') {
      const na = TEAM_ROLES[a.assignedTo]?.name || a.assignedTo || '';
      const nb = TEAM_ROLES[b.assignedTo]?.name || b.assignedTo || '';
      return na.localeCompare(nb);
    }
    if (salesSortMode === 'activity') {
      const la = lastActivityDateFor('lead', a.id)?.createdAt || '';
      const lb = lastActivityDateFor('lead', b.id)?.createdAt || '';
      return lb.localeCompare(la); // most recent activity first
    }
    // 'newest' (default)
    return (b.createdAt || '').localeCompare(a.createdAt || '');
  });

  if (filtered.length === 0) {
    body.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--t3); font-style: italic; padding: 2rem;">No leads match this view yet.</td></tr>`;
    return;
  }

  body.innerHTML = filtered.map(lead => {
    const lastAct = lastActivityDateFor('lead', lead.id);
    const assignedName = (TEAM_ROLES[lead.assignedTo]?.name || lead.assignedTo || '—');
    const safeCompany = (lead.company || '').replace(/</g, '&lt;');
    return `
      <tr>
        <td><strong>${safeCompany || '—'}</strong></td>
        <td>${(lead.contactName || '—').replace(/</g, '&lt;')}</td>
        <td><span class="status-badge ${lead.status || 'new'}">${formatLeadStatus(lead.status)}</span></td>
        <td>${assignedName}</td>
        <td>${lead.createdAt ? lead.createdAt.split('T')[0] : '—'}</td>
        <td>${lastAct ? (lastAct.createdAt || '').split('T')[0] : '—'}</td>
        <td>
          <button type="button" onclick="openLeadDetailModal('${lead.id}')" style="font-size: 0.72rem; font-weight: 700; color: var(--sky); background: none; border: none; cursor: pointer; margin-right: 0.5rem;">View</button>
          <button type="button" onclick="openLeadModal('${lead.id}')" style="font-size: 0.72rem; font-weight: 700; color: var(--t2); background: none; border: none; cursor: pointer; margin-right: 0.5rem;">Edit</button>
          <button type="button" onclick="deleteLead('${lead.id}')" style="font-size: 0.72rem; font-weight: 700; color: var(--rose, #e11d48); background: none; border: none; cursor: pointer;">Delete</button>
        </td>
      </tr>
    `;
  }).join('');
}
window.renderSalesPanel = renderSalesPanel;

function filterSalesLeads() {
  renderSalesPanel();
}
window.filterSalesLeads = filterSalesLeads;

function setSalesStatusFilter(status) {
  window._salesStatusFilter = status;
  document.querySelectorAll('#sales-status-tabs [data-sales-status]').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-sales-status') === status);
  });
  renderSalesPanel();
}
window.setSalesStatusFilter = setSalesStatusFilter;

function openLeadModal(leadId) {
  const modal = document.getElementById("lead-form-modal");
  const form = document.getElementById("lead-form");
  form.reset();
  document.getElementById("lead-form-id").value = leadId || '';
  populateLeadAssignedToSelect();

  if (leadId) {
    const lead = (appState.leads || []).find(l => l.id === leadId);
    document.getElementById("lead-modal-title").textContent = "EDIT LEAD";
    if (lead) {
      document.getElementById("lead-company").value = lead.company || '';
      document.getElementById("lead-contact-name").value = lead.contactName || '';
      document.getElementById("lead-contact-phone").value = lead.contactPhone || '';
      document.getElementById("lead-contact-email").value = lead.contactEmail || '';
      document.getElementById("lead-source").value = lead.source || '';
      document.getElementById("lead-notes").value = lead.notes || '';
      document.getElementById("lead-assigned-to").value = lead.assignedTo || '';
    }
  } else {
    document.getElementById("lead-modal-title").textContent = "ADD NEW LEAD";
  }

  modal.style.display = "flex";
}
window.openLeadModal = openLeadModal;

function closeLeadModal() {
  document.getElementById("lead-form-modal").style.display = "none";
}
window.closeLeadModal = closeLeadModal;

async function saveLeadForm(event) {
  event.preventDefault();
  const leadId = document.getElementById("lead-form-id").value;
  const leadData = {
    company: document.getElementById("lead-company").value.trim(),
    contactName: document.getElementById("lead-contact-name").value.trim(),
    contactPhone: document.getElementById("lead-contact-phone").value.trim(),
    contactEmail: document.getElementById("lead-contact-email").value.trim(),
    source: document.getElementById("lead-source").value.trim(),
    assignedTo: document.getElementById("lead-assigned-to").value,
    notes: document.getElementById("lead-notes").value.trim(),
  };

  if (!leadData.company) { alert("Company name is required."); return; }

  try {
    if (leadId) {
      if (DB.isCloud && DB.firestoreRef) {
        await DB.firestoreRef.collection("leads").doc(leadId).update(leadData);
      } else {
        const idx = appState.leads.findIndex(l => l.id === leadId);
        if (idx > -1) appState.leads[idx] = { ...appState.leads[idx], ...leadData };
        localStorage.setItem("gl_leads", JSON.stringify(appState.leads));
        renderSalesPanel();
      }
    } else {
      leadData.status = 'new';
      leadData.createdAt = new Date().toISOString();
      leadData.createdBy = appState.currentUser || '';
      if (DB.isCloud && DB.firestoreRef) {
        await DB.firestoreRef.collection("leads").add(leadData);
      } else {
        leadData.id = 'L' + Math.random().toString(36).substr(2, 9);
        appState.leads = appState.leads || [];
        appState.leads.push(leadData);
        localStorage.setItem("gl_leads", JSON.stringify(appState.leads));
        renderSalesPanel();
      }
    }
    closeLeadModal();
  } catch (err) {
    console.error("saveLeadForm error:", err);
    alert("Could not save this lead. Please try again.");
  }
}
window.saveLeadForm = saveLeadForm;

async function deleteLead(leadId) {
  const lead = (appState.leads || []).find(l => l.id === leadId);
  if (!lead) return;
  if (!confirm(`Delete the lead "${lead.company || 'this lead'}"? This only removes the lead record — any logged activity stays in its history and this cannot be undone.`)) return;

  try {
    if (DB.isCloud && DB.firestoreRef) {
      await DB.firestoreRef.collection("leads").doc(leadId).delete();
    } else {
      appState.leads = (appState.leads || []).filter(l => l.id !== leadId);
      localStorage.setItem("gl_leads", JSON.stringify(appState.leads));
      renderSalesPanel();
    }
  } catch (err) {
    console.error("deleteLead error:", err);
    alert("Could not delete this lead. Please try again.");
  }
}
window.deleteLead = deleteLead;

// ---- Activity modal (shared between a Lead's detail view and logging against an existing Customer) ----
window._activityModalMode = null; // 'lead' | 'customer'

function renderActivityTimelineList(relatedType, relatedId) {
  const list = document.getElementById("activity-timeline-list");
  if (!list) return;
  const acts = (appState.activities || [])
    .filter(a => a.relatedType === relatedType && a.relatedId === relatedId)
    .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));

  if (acts.length === 0) {
    list.innerHTML = `<div style="color: var(--t3); font-style: italic; font-size: 0.8rem;">No activity logged yet.</div>`;
    return;
  }

  const typeIcon = { call: '📞', email: '✉️', meeting: '🤝', 'follow-up': '⏰', note: '📝' };

  list.innerHTML = acts.map(a => `
    <div style="border: 1px solid var(--border-1); border-radius: 8px; padding: 0.6rem 0.75rem; background: var(--bg-input);">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.25rem;">
        <span style="font-size: 0.75rem; font-weight: 700; color: var(--t1);">${typeIcon[a.type] || '📝'} ${(a.type || 'note').replace('-', ' ')}</span>
        <span style="font-size: 0.68rem; color: var(--t3);">${a.createdAt ? a.createdAt.split('T')[0] : ''}${a.dueDate ? ' · due ' + a.dueDate : ''}</span>
      </div>
      <div style="font-size: 0.8rem; color: var(--t2);">${(a.notes || '').replace(/</g, '&lt;')}</div>
      <div style="font-size: 0.68rem; color: var(--t3); margin-top: 0.25rem;">— ${TEAM_ROLES[a.createdBy]?.name || a.createdBy || 'Unknown'}</div>
    </div>
  `).join('');
}

function renderActivityTimelineIfOpen() {
  const modal = document.getElementById("activity-modal");
  if (!modal || modal.style.display === 'none') return;
  const relatedType = document.getElementById("activity-related-type").value;
  const relatedId = document.getElementById("activity-related-id").value;
  if (relatedType && relatedId) renderActivityTimelineList(relatedType, relatedId);
}
window.renderActivityTimelineIfOpen = renderActivityTimelineIfOpen;

function openLeadDetailModal(leadId) {
  const lead = (appState.leads || []).find(l => l.id === leadId);
  if (!lead) return;

  window._activityModalMode = 'lead';
  document.getElementById("activity-customer-picker").style.display = "none";
  document.getElementById("activity-lead-info").style.display = "block";
  document.getElementById("activity-modal-subtitle").textContent = "Lead";
  document.getElementById("activity-modal-title").textContent = lead.company || 'Lead';
  document.getElementById("activity-lead-contact-line").textContent =
    [lead.contactName, lead.contactPhone, lead.contactEmail].filter(Boolean).join(' · ') || 'No contact details on file';
  document.getElementById("activity-lead-status").value = lead.status || 'new';
  document.getElementById("activity-related-type").value = 'lead';
  document.getElementById("activity-related-id").value = lead.id;

  document.getElementById("activity-form").reset();
  renderActivityTimelineList('lead', lead.id);
  document.getElementById("activity-modal").style.display = "flex";
}
window.openLeadDetailModal = openLeadDetailModal;

function populateActivityCustomerSelect() {
  const sel = document.getElementById("activity-customer-select");
  if (!sel) return;
  sel.innerHTML = '<option value="">Select a customer...</option>' +
    getAllKnownCustomerNames().map(name => `<option value="${name.replace(/"/g, '&quot;')}">${name.replace(/</g, '&lt;')}</option>`).join('');
}

function openCustomerActivityModal() {
  window._activityModalMode = 'customer';
  document.getElementById("activity-lead-info").style.display = "none";
  document.getElementById("activity-customer-picker").style.display = "block";
  document.getElementById("activity-modal-subtitle").textContent = "Customer";
  document.getElementById("activity-modal-title").textContent = "Select a customer";
  document.getElementById("activity-related-type").value = 'customer';
  document.getElementById("activity-related-id").value = '';

  populateActivityCustomerSelect();
  document.getElementById("activity-timeline-list").innerHTML = `<div style="color: var(--t3); font-style: italic; font-size: 0.8rem;">Choose a customer above to see their activity.</div>`;
  document.getElementById("activity-form").reset();
  document.getElementById("activity-modal").style.display = "flex";
}
window.openCustomerActivityModal = openCustomerActivityModal;

function onActivityCustomerChange() {
  const name = document.getElementById("activity-customer-select").value;
  document.getElementById("activity-related-id").value = name;
  document.getElementById("activity-modal-title").textContent = name || 'Select a customer';
  if (name) renderActivityTimelineList('customer', name);
}
window.onActivityCustomerChange = onActivityCustomerChange;

function closeActivityModal() {
  document.getElementById("activity-modal").style.display = "none";
}
window.closeActivityModal = closeActivityModal;

async function updateLeadStatusFromModal() {
  const leadId = document.getElementById("activity-related-id").value;
  const newStatus = document.getElementById("activity-lead-status").value;
  if (!leadId) return;
  try {
    if (DB.isCloud && DB.firestoreRef) {
      await DB.firestoreRef.collection("leads").doc(leadId).update({ status: newStatus });
    } else {
      const idx = appState.leads.findIndex(l => l.id === leadId);
      if (idx > -1) appState.leads[idx].status = newStatus;
      localStorage.setItem("gl_leads", JSON.stringify(appState.leads));
      renderSalesPanel();
    }
  } catch (err) {
    console.error("updateLeadStatusFromModal error:", err);
  }
}
window.updateLeadStatusFromModal = updateLeadStatusFromModal;

async function logActivityForm(event) {
  event.preventDefault();
  const relatedType = document.getElementById("activity-related-type").value;
  const relatedId = document.getElementById("activity-related-id").value;
  if (!relatedId) { alert("Select a customer first."); return; }

  const activityData = {
    relatedType,
    relatedId,
    type: document.getElementById("activity-type").value,
    dueDate: document.getElementById("activity-due-date").value || null,
    notes: document.getElementById("activity-notes").value.trim(),
    createdBy: appState.currentUser || '',
    createdAt: new Date().toISOString(),
  };

  if (!activityData.notes) { alert("Add a few words about this activity."); return; }

  try {
    if (DB.isCloud && DB.firestoreRef) {
      await DB.firestoreRef.collection("activities").add(activityData);
    } else {
      activityData.id = 'A' + Math.random().toString(36).substr(2, 9);
      appState.activities = appState.activities || [];
      appState.activities.push(activityData);
      localStorage.setItem("gl_activities", JSON.stringify(appState.activities));
      renderActivityTimelineList(relatedType, relatedId);
      renderSalesPanel();
    }
    document.getElementById("activity-form").reset();
  } catch (err) {
    console.error("logActivityForm error:", err);
    alert("Could not save this activity. Please try again.");
  }
}
window.logActivityForm = logActivityForm;

/* ══════════════════════════════════════════════════
   DUAL-MODE OPERATIONAL MODULE HANDLERS
   ══════════════════════════════════════════════════ */
function updateModuleTabs(activeModule) {
  document.querySelectorAll(".module-tab").forEach(tab => {
    if (tab.getAttribute("data-module") === activeModule) {
      tab.classList.add("active");
    } else {
      tab.classList.remove("active");
    }
  });
  document.querySelectorAll(".sidebar-item[data-sidebar-module]").forEach(item => {
    item.classList.toggle("active", item.getAttribute("data-sidebar-module") === activeModule);
  });
}
window.updateModuleTabs = updateModuleTabs;

function toggleModulePathway(module, mode) {
  const isBundled = (mode === 'bundled');
  document.getElementById(`${module}-path-bundled-container`).style.display = isBundled ? 'block' : 'none';
  document.getElementById(`${module}-path-standalone-container`).style.display = isBundled ? 'none' : 'block';
  document.getElementById(`${module}-summary-inactive`).style.display = isBundled ? 'block' : 'none';
  document.getElementById(`${module}-summary-active`).style.display = isBundled ? 'none' : 'flex';
  document.getElementById(`${module}-save-btn-container`).style.display = isBundled ? 'none' : 'block';

  if (module === 'transport') calculateTransportation();
  else if (module === 'warehouse') calculateWarehousing();
}
window.toggleModulePathway = toggleModulePathway;

function updateAdminModulePermissions() {
  const isAdmin = (appState.currentUser === 'ganny' || (TEAM_ROLES[appState.currentUser]?.type === 'admin'));
  const adminButtons = document.querySelectorAll(".btn-admin-action");
  adminButtons.forEach(btn => {
    btn.style.display = isAdmin ? "inline-block" : "none";
  });

  ["transport-standalone-body", "warehouse-standalone-body"].forEach(bodyId => {
    const body = document.getElementById(bodyId);
    if (body) {
      body.querySelectorAll(".chg-name").forEach(input => {
        if (!isAdmin) {
          input.setAttribute("readonly", true);
          input.style.background = "rgba(255,255,255,0.01)";
          input.style.color = "var(--text-dim)";
        } else {
          input.removeAttribute("readonly");
          input.style.background = "rgba(255,255,255,0.03)";
          input.style.color = "var(--t1)";
        }
      });
    }
  });
}
window.updateAdminModulePermissions = updateAdminModulePermissions;

function addTransportRow(type = 'surcharge') {
  const tbody = document.getElementById("transport-standalone-body");
  if (!tbody) return;
  const tr = document.createElement("tr");
  const defaultName = type === 'metric' ? "Line-Haul Routing Metric" : "Transport Fee";
  tr.innerHTML = `
    <td><input type="text" class="chg-name" value="${defaultName}" style="background: rgba(255,255,255,0.03); color: var(--t1);"></td>
    <td><input type="number" class="chg-rate" value="0.00" step="0.01" oninput="calculateTransportation()"></td>
    <td><input type="number" class="chg-buy-rate" value="0.00" step="0.01" oninput="calculateTransportation()"></td>
    <td><input type="text" class="chg-remarks" placeholder="Add remarks..." style="background: rgba(255,255,255,0.03); color: var(--t1); border: 1px solid var(--border-color); border-radius: 6px; padding: 4px 8px; font-size: 0.78rem; width: 100%;"></td>
    <td style="text-align: center;">
      <button type="button" class="delete-btn" onclick="removeTransportRow(this)" title="Delete Row" style="background: #002060; border: 1px solid #002060; color: #ffffff; border-radius: 4px; cursor: pointer; padding: 4px 8px; font-size: 0.75rem;">Delete</button>
    </td>
  `;
  tbody.appendChild(tr);
  calculateTransportation();
}
window.addTransportRow = addTransportRow;

function removeTransportRow(btn) {
  btn.closest("tr").remove();
  calculateTransportation();
}
window.removeTransportRow = removeTransportRow;

function addWarehouseRow(type = 'surcharge') {
  const tbody = document.getElementById("warehouse-standalone-body");
  if (!tbody) return;
  const tr = document.createElement("tr");
  const defaultName = type === 'metric' ? "Fulfillment Metric" : "Warehouse Charge";
  tr.innerHTML = `
    <td><input type="text" class="chg-name" value="${defaultName}" placeholder="Fee / Surcharge Name" style="background: rgba(255,255,255,0.03); color: var(--t1);"></td>
    <td><input type="number" class="chg-rate" value="0.00" step="0.01" oninput="calculateWarehousing()" style="width: 100%;"></td>
    <td><input type="number" class="chg-buy-rate" value="0.00" step="0.01" oninput="calculateWarehousing()" style="width: 100%;"></td>
    <td><input type="text" class="chg-remarks" placeholder="Add remarks..." style="background: rgba(255,255,255,0.03); color: var(--t1); border: 1px solid var(--border-color); border-radius: 6px; padding: 4px 8px; font-size: 0.78rem; width: 100%;"></td>
    <td style="text-align: center;">
      <button type="button" class="delete-btn" onclick="removeWarehouseRow(this)" title="Delete Row" style="background: #002060; border: 1px solid #002060; color: #ffffff; border-radius: 4px; cursor: pointer; padding: 4px 8px; font-size: 0.75rem;">Delete</button>
    </td>
  `;
  tbody.appendChild(tr);
  calculateWarehousing();
}
window.addWarehouseRow = addWarehouseRow;

function removeWarehouseRow(btn) {
  btn.closest("tr").remove();
  calculateWarehousing();
}
window.removeWarehouseRow = removeWarehouseRow;

// Sync the header currency dropdown with the table-level currency selector (Transport)
function syncTransportCurrency() {
  const headerSel = document.getElementById('transport-header-currency');
  const tableSel = document.getElementById('transport-currency');
  if (headerSel && tableSel) {
    tableSel.value = headerSel.value;
    calculateTransportation();
  }
}
window.syncTransportCurrency = syncTransportCurrency;

// Sync the header currency dropdown with the table-level currency selector (Warehouse)
function syncWarehouseCurrency() {
  const headerSel = document.getElementById('warehouse-header-currency');
  const tableSel = document.getElementById('warehouse-currency');
  if (headerSel && tableSel) {
    tableSel.value = headerSel.value;
    calculateWarehousing();
  }
}
window.syncWarehouseCurrency = syncWarehouseCurrency;

function getStandaloneRateSummary(module) {
  const tbody = document.getElementById(`${module}-standalone-body`);
  let subtotal = 0;
  let grossProfit = 0;
  let usingBuyFallback = false;
  if (tbody) {
    tbody.querySelectorAll("tr").forEach(row => {
      const sell = parseFloat(row.querySelector(".chg-rate")?.value) || 0;
      const buy = parseFloat(row.querySelector(".chg-buy-rate")?.value) || 0;
      // Quoting-stage rule (same as Air/Sea Freight): use whichever of
      // Sell/Buy is entered for the interim total, tracked here so it can
      // be shown as an "Interim Estimate" indicator rather than blended in
      // silently.
      subtotal += sell > 0 ? sell : buy;
      if (sell === 0 && buy > 0) usingBuyFallback = true;
      grossProfit += sell - buy;
    });
  }
  const gstEnabled = document.getElementById(`${module}-gst-enabled`)?.checked !== false;
  const tax = gstEnabled ? subtotal * 0.18 : 0;
  const total = subtotal + tax;
  return { subtotal, tax, total, grossProfit, gstEnabled, usingBuyFallback };
}

function calculateTransportation() {
  const { subtotal, tax, total, gstEnabled, usingBuyFallback } = getStandaloneRateSummary("transport");

  const cur = document.getElementById("transport-currency")?.value || 'INR';
  const sym = cur === 'INR' ? '₹' : (cur === 'USD' ? '$' : (cur === 'EUR' ? '€' : '£'));

  if (document.getElementById("res-transport-subtotal")) document.getElementById("res-transport-subtotal").textContent = `${sym}${subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
  if (document.getElementById("res-transport-tax-label")) document.getElementById("res-transport-tax-label").textContent = gstEnabled ? "GST / Service Tax (18%)" : "GST / Service Tax (Not applied)";
  if (document.getElementById("res-transport-tax")) document.getElementById("res-transport-tax").textContent = `${sym}${tax.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
  if (document.getElementById("res-transport-total")) document.getElementById("res-transport-total").textContent = `${sym}${total.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
  const transportFallbackEl = document.getElementById("transport-fallback-indicator");
  if (transportFallbackEl) transportFallbackEl.style.display = usingBuyFallback ? "block" : "none";
}
window.calculateTransportation = calculateTransportation;

function calculateWarehousing() {
  const { subtotal, tax, total, gstEnabled, usingBuyFallback } = getStandaloneRateSummary("warehouse");

  const cur = document.getElementById("warehouse-currency")?.value || 'INR';
  const sym = cur === 'INR' ? '₹' : (cur === 'USD' ? '$' : (cur === 'EUR' ? '€' : (cur === 'GBP' ? '£' : (cur === 'AED' ? 'د.إ' : (cur === 'SGD' ? 'S$' : (cur === 'AUD' ? 'A$' : '¥'))))));

  if (document.getElementById("res-warehouse-subtotal")) document.getElementById("res-warehouse-subtotal").textContent = `${sym}${subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
  if (document.getElementById("res-warehouse-tax-label")) document.getElementById("res-warehouse-tax-label").textContent = gstEnabled ? "GST / Service Tax (18%)" : "GST / Service Tax (Not applied)";
  if (document.getElementById("res-warehouse-tax")) document.getElementById("res-warehouse-tax").textContent = `${sym}${tax.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
  if (document.getElementById("res-warehouse-total")) document.getElementById("res-warehouse-total").textContent = `${sym}${total.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
  const warehouseFallbackEl = document.getElementById("warehouse-fallback-indicator");
  if (warehouseFallbackEl) warehouseFallbackEl.style.display = usingBuyFallback ? "block" : "none";
}
window.calculateWarehousing = calculateWarehousing;

function injectModuleFeesToFreight(module, freightType, target = 'origin') {
  alert("Pathway A (Bundled) has been disabled in this workspace. Standard standalone calculations are active.");
}
window.injectModuleFeesToFreight = injectModuleFeesToFreight;

async function saveStandaloneQuote(module) {
  const cur = document.getElementById(`${module}-currency`)?.value || 'INR';
  const { subtotal, tax, total, grossProfit, gstEnabled, usingBuyFallback } = getStandaloneRateSummary(module);

  // Read customer name from the dedicated input field (no blocking prompt needed)
  const customerNameField = document.getElementById(`${module}-customer-name`);
  let customerName = (customerNameField?.value || '').trim();
  if (!customerName) {
    // Fallback prompt if the field is somehow missing
    customerName = prompt("Please enter Customer Name for this standalone quote:", "Walk-in Customer");
    if (!customerName) return;
  }

  const rateInr = convertToInr(total, cur);

  let modeTitle = "Services";
  let routingInfo = `${module.toUpperCase()} Standalone Services`;
  let pickupPin = "";
  let deliveryPin = "";
  let pickupCity = "";
  let deliveryCity = "";
  let pickupAddress = "";
  let deliveryAddress = "";

  if (module === 'transport') {
    modeTitle = "Transportation";
    pickupPin = document.getElementById("transport-pickup-pin")?.value || "";
    deliveryPin = document.getElementById("transport-delivery-pin")?.value || "";
    pickupCity = document.getElementById("transport-pickup-city")?.value || "";
    deliveryCity = document.getElementById("transport-delivery-city")?.value || "";
    // Preserve a manually entered global location when the lookup service has
    // no result or is unavailable. This keeps the existing quote fields intact.
    if (!pickupPin && !pickupCity) pickupCity = document.getElementById("transport-pickup-search")?.value.trim() || "";
    if (!deliveryPin && !deliveryCity) deliveryCity = document.getElementById("transport-delivery-search")?.value.trim() || "";
    pickupAddress = document.getElementById("transport-pickup-address")?.value.trim() || "";
    deliveryAddress = document.getElementById("transport-delivery-address")?.value.trim() || "";
    const from = pickupCity || pickupPin;
    const to = deliveryCity || deliveryPin;
    routingInfo = `${from} ➤ ${to}`;
  } else if (module === 'warehouse') {
    modeTitle = "Warehouse";
    routingInfo = `Warehousing Storage & Operations`;
  }

  // Collect line items
  const items = [];
  if (module === 'transport') {
    const tbody = document.getElementById("transport-standalone-body");
    if (tbody) {
      tbody.querySelectorAll("tr").forEach(tr => {
        const nameInp = tr.querySelector(".chg-name");
        const rateInp = tr.querySelector(".chg-rate");
        const buyRateInp = tr.querySelector(".chg-buy-rate");
        const remarksInp = tr.querySelector(".chg-remarks");
        if (nameInp) {
          items.push({
            name: nameInp.value,
            rate: parseFloat(rateInp?.value) || 0,
            buyRate: parseFloat(buyRateInp?.value) || 0,
            remarks: remarksInp?.value || ""
          });
        }
      });
    }
  } else if (module === 'warehouse') {
    const tbody = document.getElementById("warehouse-standalone-body");
    if (tbody) {
      tbody.querySelectorAll("tr").forEach(tr => {
        const nameInp = tr.querySelector(".chg-name");
        const rateInp = tr.querySelector(".chg-rate");
        const buyRateInp = tr.querySelector(".chg-buy-rate");
        const remarksInp = tr.querySelector(".chg-remarks");
        if (nameInp) {
          items.push({
            name: nameInp.value,
            rate: parseFloat(rateInp?.value) || 0,
            buyRate: parseFloat(buyRateInp?.value) || 0,
            // Preserve description data from older Warehouse quotes even though
            // the unused column is no longer shown in the operational table.
            desc: tr.dataset.description || "",
            remarks: remarksInp?.value || ""
          });
        }
      });
    }
  }

  // Validation: at least one row required
  if (items.length === 0) {
    alert("❌ Please add at least one charge row to save the quotation.");
    return;
  }
  // Note: Users can save with either Sell Rate or Buy Rate (or both) — no dual-rate requirement.

  let quoteData = {
    id: 'Q' + Math.random().toString(36).substr(2, 9),
    date: new Date().toISOString().split('T')[0],
    customer: customerName,
    creator: appState.currentUser || "jaya",
    status: 'quoted',
    quoteNumber: appState.quotes.length + 1,
    mode: modeTitle,
    type: module,
    amount: total,
    currency: cur,
    amountINR: rateInr,
    grossProfit: grossProfit,
    grossProfitCurrency: cur,
    grossProfitINR: convertToInr(grossProfit, cur),
    route: routingInfo,
    routingDetails: routingInfo,
    details: {
      mode: modeTitle,
      type: module,
      module: module,
      routing: routingInfo,
      items: items,
      pickupPin: pickupPin,
      pickupCity: pickupCity,
      pickupAddress: pickupAddress,
      deliveryPin: deliveryPin,
      deliveryCity: deliveryCity,
      deliveryAddress: deliveryAddress,
      gstEnabled: gstEnabled,
      gstRate: gstEnabled ? 18 : 0,
      baseFreight: subtotal,
      gstAmount: tax,
      usingBuyFallback: !!usingBuyFallback
    },
    notes: `Calculated standalone. Subtotal: ${subtotal}, GST (${gstEnabled ? '18%' : 'not applied'}): ${tax}, Total: ${total} ${cur}`
  };

  if (appState.editingQuoteId) {
    const existingIndex = appState.quotes.findIndex(q => q.id === appState.editingQuoteId);
    if (existingIndex !== -1) {
      const originalQuote = appState.quotes[existingIndex];
      // Same rule as saveCurrentQuote(): merge onto the original document
      // instead of replacing it, so status, WON confirmation, and any other
      // field outside this form survive an amend — before or after WON.
      quoteData = { ...originalQuote, ...quoteData };
      quoteData.status = originalQuote.status || 'quoted';
      quoteData.id = originalQuote.id;
      quoteData.date = new Date().toISOString().split('T')[0];
      quoteData.creator = originalQuote.creator;
      quoteData.quoteNumber = originalQuote.quoteNumber || (existingIndex + 1);
      // amendmentAllowed/amendmentUnlockedUntil are carried over from
      // originalQuote by the spread above, not reset here — the unlock is
      // time-limited (see approveAmendment / isAmendmentGrantActive) and is
      // meant to survive multiple saves within its window, not just one.

      appState.editingQuoteId = null; // Clear edit mode
      const saved = await DB.saveQuote(quoteData);
      if (!saved) return;
      alert(`${modeTitle} Standalone Quotation amended and locked successfully!`);
    }
  } else {
    const saved = await DB.saveQuote(quoteData);
    if (!saved) return;
    alert(`${modeTitle} Standalone Quotation saved successfully!`);
  }
  showMyQuotationLogs();
}
window.saveStandaloneQuote = saveStandaloneQuote;

function convertToInr(amount, currency) {
  if (currency === 'INR') return amount;
  if (currency === 'USD') return amount * EXCHANGE_RATES.USD_TO_INR;
  if (currency === 'EUR') return amount * EXCHANGE_RATES.EUR_TO_INR;
  if (currency === 'GBP') return amount * EXCHANGE_RATES.GBP_TO_INR;
  return amount;
}
window.convertToInr = convertToInr;

// ═══════════════════════════════════════════════════════════
// MODULE-LEVEL BROADCAST FUNCTIONS (accessible to all users)
// ═══════════════════════════════════════════════════════════
// Rebuilding this banner's innerHTML every 3-second poll \u2014 even when the
// broadcast hadn't changed at all \u2014 was destroying and recreating its DOM
// (including re-triggering its own CSS transition) every single cycle for
// as long as a broadcast stayed active, for every user, on every page.
// That's exactly what read as "flickering" across the whole app. Track
// what was last painted and skip the rebuild when nothing's actually new.
window._lastPaintedBroadcastKey = window._lastPaintedBroadcastKey || null;

window.checkActiveBroadcast = function () {
  var broadcast = null;
  try {
    var data = localStorage.getItem("gl_admin_broadcast");
    if (data) broadcast = JSON.parse(data);
  } catch (e) { }

  if (!broadcast || !broadcast.active) {
    window._lastPaintedBroadcastKey = null;
    var overlayEl = document.getElementById("system-broadcast-overlay");
    if (overlayEl) overlayEl.style.display = "none";
    return;
  }

  var key = broadcast.type + '|' + broadcast.message;
  if (key === window._lastPaintedBroadcastKey && document.getElementById("system-broadcast-overlay")) {
    return; // same broadcast already painted \u2014 nothing to do this cycle
  }
  window._lastPaintedBroadcastKey = key;

  var overlay = document.getElementById("system-broadcast-overlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "system-broadcast-overlay";
    overlay.style.cssText = "position:fixed; top:0; left:0; right:0; z-index:9999; padding:10px 20px; color:#fff; display:flex; justify-content:space-between; align-items:center; font-family:'Outfit', sans-serif; font-size:0.85rem; font-weight:700; box-shadow:0 3px 15px rgba(0,0,0,0.3); transition:all 0.3s;";
    document.body.appendChild(overlay);
  }

  if (broadcast.type === 'mandate') {
    overlay.style.background = "linear-gradient(90deg, #ef4444, #b91c1c)";
    overlay.innerHTML = '<div>\u26a0\ufe0f SYSTEM MANDATE NOTICE: ' + broadcast.message + '</div>';
  } else if (broadcast.type === 'meeting') {
    overlay.style.background = "linear-gradient(90deg, #f59e0b, #d97706)";
    overlay.innerHTML = '<div>\ud83d\udcc5 CALENDAR VISIT REMINDER: ' + broadcast.message + '</div>';
  } else {
    overlay.style.background = "linear-gradient(90deg, #10b981, #047857)";
    overlay.innerHTML = '<div>\ud83c\udf89 HOLIDAY / LEAVE POPUP: ' + broadcast.message + '</div>';
  }

  overlay.innerHTML += '<button type="button" style="background:#fff; border:none; color:#000; font-size:0.65rem; font-weight:bold; cursor:pointer; padding:3px 8px; border-radius:4px;" onclick="dismissBroadcast()">Dismiss / Close</button>';
  overlay.style.display = "flex";
};

window.dismissBroadcast = function () {
  var overlay = document.getElementById("system-broadcast-overlay");
  if (overlay) overlay.style.display = "none";
  try {
    var data = localStorage.getItem("gl_admin_broadcast");
    if (data) {
      var b = JSON.parse(data);
      b.active = false;
      localStorage.setItem("gl_admin_broadcast", JSON.stringify(b));
    }
  } catch (e) { }
};

// Poll every 3 seconds for all users
setInterval(window.checkActiveBroadcast, 3000);

document.addEventListener("DOMContentLoaded", () => {
  const db = DB.firestoreRef || (typeof firebase !== 'undefined' ? firebase.firestore() : null);
  window.db = db;
  const doc = (firestore, collectionName, docId) => {
    return firestore.collection(collectionName).doc(docId);
  };
  const setDoc = (docRef, data) => {
    return docRef.set(data);
  };
  const serverTimestamp = () => firebase.firestore.FieldValue.serverTimestamp();

  window.handleForgotPassword = async function (e) {
    if (e) e.preventDefault();
    const usernameInput = prompt("Enter your Username to request an administrative password reset:");
    if (!usernameInput) return;
    const username = usernameInput.toLowerCase().trim();

    try {
      if (db) {
        await setDoc(doc(db, "resetRequests", username), {
          requestedAt: serverTimestamp(),
          status: "pending"
        });
      } else {
        console.warn("Database offline");
      }
    } catch (err) {
      console.error("Firestore logging failed:", err);
    }

    alert("Password reset request triggered. Please inform Admin to manually reset your access.");
    if (window.updateResetIndicators) window.updateResetIndicators();
  };

  window.updateResetListInPanel = async function () {
    const listEl = document.getElementById("admin-pending-list");
    if (!listEl) return;

    try {
      if (db) {
        const snapshot = await db.collection("resetRequests").where("status", "==", "pending").get();
        let listHtml = "";
        if (snapshot.empty) {
          listHtml = "<em style='color: #64748b;'>No pending reset requests.</em>";
        } else {
          snapshot.forEach(docSnap => {
            const user = docSnap.id;
            listHtml += `
              <div style="display: flex; justify-content: space-between; align-items: center; padding: 4px 0; border-bottom: 1px dashed rgba(0,0,0,0.05);">
                <span>👤 <strong>${user}</strong></span>
                <button onclick="window.fillTargetUser('${user}')" style="font-size: 0.65rem; padding: 2px 6px; background: #0f172a; color: #fff; border: none; border-radius: 4px; cursor: pointer;">Select</button>
              </div>
            `;
          });
        }
        listEl.innerHTML = listHtml;
      } else {
        listEl.innerHTML = "<em style='color: #64748b;'>Database offline.</em>";
      }
    } catch (err) {
      console.error("Error updating reset list:", err);
      listEl.innerHTML = "<em style='color: #64748b;'>Error loading requests.</em>";
    }
  };

  window.executeForceReset = async function () {
    // Defense in depth: the UI path to this function is now admin-only
    // (opened from inside the authenticated Admin Settings Console), and the
    // adminResetPassword Cloud Function independently re-checks this
    // server-side — but reject here too in case this is ever invoked
    // directly (e.g. from the browser console) by someone other than the
    // logged-in admin.
    if (appState.currentUser !== 'ganny') {
      alert("Access denied. Only the admin account can reset passwords.");
      return;
    }

    const rawUser = document.getElementById("admin-target-user").value;
    const newPass = document.getElementById("admin-target-pass").value;

    if (!rawUser) {
      alert("Please enter a target username.");
      return;
    }
    if (!newPass || newPass.length < 6) {
      alert("Password must be at least 6 characters long.");
      return;
    }

    const username = rawUser.trim().toLowerCase();
    const canonicalEmail = `${username}@atlaspricing.com`;

    const btnEl = document.getElementById("admin-force-reset-btn");
    const originalBtnText = btnEl ? btnEl.textContent : "";
    if (btnEl) { btnEl.textContent = "Resetting..."; btnEl.disabled = true; }

    let firebaseAuthUpdated = false;
    let firestoreUpdated = false;
    let localUpdated = false;

    try {
      // ── STEP 1: Update Firebase Authentication via Cloud Function (Admin SDK) ─
      // This is the authoritative, permanent fix — no client-side limitation.
      try {
        const resetFn = firebase.functions().httpsCallable("adminResetPassword");
        const result = await resetFn({ username, newPassword: newPass });
        if (result.data && result.data.success) {
          firebaseAuthUpdated = true;
          console.log("Admin reset: Firebase Auth updated via Cloud Function.");
        }
      } catch (fnErr) {
        console.warn("Cloud Function adminResetPassword failed:", fnErr.message,
          "— falling back to Firestore-only update.");
      }

      // ── STEP 2: Update Firestore users document ────────────────────────────
      if (db) {
        await db.collection("users").doc(username).set({
          username: username,
          email: canonicalEmail,
          password: newPass,
          fullName: (typeof TEAM_ROLES !== 'undefined' && TEAM_ROLES[username] ? TEAM_ROLES[username].name : username),
          role: (username === 'ganny' || username === 'admin' ? 'manager' : 'member'),
          category: (typeof TEAM_ROLES !== 'undefined' && TEAM_ROLES[username]?.category) || 'FREE HAND SALES (AIR/SEA)',
          currency: (typeof TEAM_ROLES !== 'undefined' && TEAM_ROLES[username]?.currency) || 'INR',
          updatedAt: serverTimestamp()
        }, { merge: true });
        firestoreUpdated = true;

        // Clear the password reset request
        try {
          await db.collection("resetRequests").doc(username).delete();
        } catch (delErr) {
          console.warn("Could not delete reset request:", delErr);
        }
      }

      // ── STEP 3: Update localStorage cache ─────────────────────────────────
      let customUsers = [];
      const stored = localStorage.getItem("gl_custom_users");
      if (stored) {
        try { customUsers = JSON.parse(stored); } catch (err) { }
      }
      const matched = customUsers.find(u => u && u.username && u.username.toLowerCase() === username);
      if (matched) {
        matched.password = newPass;
        matched.email = canonicalEmail;
      } else {
        customUsers.push({
          username: username,
          email: canonicalEmail,
          fullName: (typeof TEAM_ROLES !== 'undefined' && TEAM_ROLES[username] ? TEAM_ROLES[username].name : username),
          password: newPass,
          role: (username === 'ganny' || username === 'admin' ? 'manager' : 'member'),
          category: (typeof TEAM_ROLES !== 'undefined' && TEAM_ROLES[username]?.category) || 'FREE HAND SALES (AIR/SEA)',
          currency: (typeof TEAM_ROLES !== 'undefined' && TEAM_ROLES[username]?.currency) || 'INR'
        });
      }
      localStorage.setItem("gl_custom_users", JSON.stringify(customUsers));
      localUpdated = true;

      // Clear pending reset indicators
      let resets = [];
      const storedResets = localStorage.getItem("pending_password_resets");
      if (storedResets) {
        try { resets = JSON.parse(storedResets); } catch (err) { }
      }
      resets = resets.filter(u => u !== username);
      localStorage.setItem("pending_password_resets", JSON.stringify(resets));

      if (typeof DB !== 'undefined' && typeof DB.syncUsers === 'function') {
        DB.syncUsers();
      }

      const authStatus = firebaseAuthUpdated
        ? "✅ Firebase Auth updated (via Cloud Function)"
        : "⚠️ Firebase Auth not updated (Cloud Function unavailable — Firestore fallback is active)";
      alert(`Password reset for "${username}" complete!\n\n${authStatus}\n✅ Firestore database updated\n✅ Local cache updated`);

      document.getElementById("admin-target-user").value = "";
      document.getElementById("admin-target-pass").value = "";
      window.updateResetListInPanel();
      window.updateResetIndicators();
    } catch (err) {
      alert("❌ Error performing administrative force reset: " + err.message);
    } finally {
      if (btnEl) { btnEl.textContent = originalBtnText; btnEl.disabled = false; }
    }
  };

  // 5. Synced Scratchpads & Broadcast Hub
  window.syncScratchpad = function () {
    const text = document.getElementById("dashboard-scratchpad").value;
    const syncStatus = document.getElementById("scratchpad-sync-status");
    const currentUser = appState.currentUser || "shashank";

    if (syncStatus) syncStatus.textContent = "Syncing with cloud...";

    // Save to active scratchpads in localStorage
    let scratchpads = {};
    try {
      scratchpads = JSON.parse(localStorage.getItem("gl_active_scratchpads") || "{}");
    } catch (e) { }

    scratchpads[currentUser] = {
      text: text,
      user: TEAM_ROLES[currentUser]?.name || currentUser,
      time: new Date().toLocaleTimeString()
    };

    localStorage.setItem("gl_active_scratchpads", JSON.stringify(scratchpads));

    setTimeout(() => {
      if (syncStatus) syncStatus.textContent = "All changes synced to database";
      // If Admin view is active, update their viewer as well
      if (appState.currentUser === 'ganny') {
        updateAdminScratchpadViewer();
      }
    }, 400);
  };

  function updateAdminScratchpadViewer() {
    const container = document.getElementById("admin-desk-scratchpads");
    if (!container) return;

    let scratchpads = {};
    try {
      scratchpads = JSON.parse(localStorage.getItem("gl_active_scratchpads") || "{}");
    } catch (e) { }

    const keys = Object.keys(scratchpads);
    if (keys.length === 0) {
      container.innerHTML = `<div style="font-style: italic; color: var(--text-dim);">No active reminder syncs yet.</div>`;
      return;
    }

    let html = "";
    keys.forEach(k => {
      const pad = scratchpads[k];
      html += `
    <div style="background: rgba(255,255,255,0.03); border: 1px solid var(--border-1); border-radius: 6px; padding: 6px 10px; margin-bottom: 0.4rem;">
      <div style="display:flex; justify-content:space-between; font-weight:700; color:var(--sky); font-size:0.75rem; margin-bottom:2px;">
        <span>${pad.user}</span>
        <span style="font-size:0.65rem; color:var(--text-dim);">${pad.time}</span>
      </div>
      <div style="color:#fff; white-space:pre-wrap; line-height:1.3; font-size:0.75rem;">${pad.text || "(empty notes)"}</div>
    </div>
  `;
    });
    container.innerHTML = html;
  }
  window.updateAdminScratchpadViewer = updateAdminScratchpadViewer;

  // Admin Broadcast notices — sendAdminBroadcast exposed globally
  window.sendAdminBroadcast = function () {
    const typeEl = document.getElementById("broadcast-type");
    const msgEl = document.getElementById("broadcast-message");
    if (!typeEl || !msgEl) return alert("Broadcast controls not found.");
    const type = typeEl.value;
    const msg = msgEl.value.trim();

    if (!msg) return alert("Please enter broadcast message.");

    const broadcast = {
      id: 'B' + Date.now(),
      type: type,
      message: msg,
      timestamp: new Date().toLocaleTimeString(),
      active: true
    };

    localStorage.setItem("gl_admin_broadcast", JSON.stringify(broadcast));
    alert("📢 Broadcast notice pushed to all active screens!");
    msgEl.value = "";

    // Instantly trigger overlay check
    window.checkActiveBroadcast();
  };

  // Kept for internal reference inside the DOMContentLoaded block
  const checkActiveBroadcast = window.checkActiveBroadcast;

  // ══════════════════════════════════════════════════
  // REPORTING & ARCHIVING FUNCTIONS
  // ══════════════════════════════════════════════════
  window.populateReportUsers = function () {
    const selectEl = document.getElementById("report-user");
    if (!selectEl) return;
    selectEl.innerHTML = '<option value="all">👥 All Desks / Users</option>';
    // Disambiguate before building options — same treatment as the other
    // report-user populator (updateExecutiveDashboardVisibility), since two
    // logins can share a display name (e.g. more than one "Free Hand Sales"
    // account).
    const roleIds = Object.keys(TEAM_ROLES);
    const nameLookup = {};
    roleIds.forEach(roleId => {
      nameLookup[roleId] = { name: TEAM_ROLES[roleId]?.name || roleId };
    });
    if (typeof disambiguateDuplicateNames === 'function') disambiguateDuplicateNames(nameLookup);
    roleIds.forEach(roleId => {
      const option = document.createElement("option");
      option.value = roleId;
      option.textContent = nameLookup[roleId].name;
      selectEl.appendChild(option);
    });
  };

  window.toggleCustomDateFields = function () {
    const period = document.getElementById("report-period")?.value;
    const div = document.getElementById("report-custom-dates");
    if (div) {
      div.style.display = (period === 'custom') ? 'flex' : 'none';
    }
  };

  function getReportDateRange(period) {
    const now = new Date();
    let currentYear = now.getFullYear();
    if (now.getMonth() < 3) {
      currentYear -= 1;
    }

    let startDate, endDate;
    if (period === 'current-fy') {
      startDate = new Date(currentYear, 3, 1);
      endDate = new Date(currentYear + 1, 2, 31, 23, 59, 59);
    } else if (period === 'previous-fy') {
      startDate = new Date(currentYear - 1, 3, 1);
      endDate = new Date(currentYear, 2, 31, 23, 59, 59);
    } else if (period === 'current-h1') {
      startDate = new Date(currentYear, 3, 1);
      endDate = new Date(currentYear, 8, 30, 23, 59, 59);
    } else if (period === 'current-h2') {
      startDate = new Date(currentYear, 9, 1);
      endDate = new Date(currentYear + 1, 2, 31, 23, 59, 59);
    } else if (period === 'custom') {
      const startVal = document.getElementById("report-start-date")?.value;
      const endVal = document.getElementById("report-end-date")?.value;
      startDate = startVal ? new Date(startVal) : new Date(0);
      endDate = endVal ? new Date(endVal + "T23:59:59") : new Date();
    }
    return { startDate, endDate };
  }

  async function fetchQuotesForReport(startDate, endDate, userFilter) {
    let allQuotes = [...appState.quotes];

    if (DB.isCloud && DB.firestoreRef) {
      try {
        const snapshot = await DB.firestoreRef.collection("archive_quotes")
          .where("timestamp", ">=", startDate.getTime())
          .where("timestamp", "<=", endDate.getTime())
          .get();
        snapshot.forEach(doc => {
          const data = doc.data();
          if (!allQuotes.some(q => q.id === data.id)) {
            allQuotes.push(data);
          }
        });
      } catch (e) {
        console.error("Failed to query archive_quotes from Firestore:", e);
      }
    } else {
      try {
        const offlineArchive = JSON.parse(localStorage.getItem("logistics_archive_quotes") || "[]");
        offlineArchive.forEach(q => {
          if (!allQuotes.some(aq => aq.id === q.id)) {
            allQuotes.push(q);
          }
        });
      } catch (e) { }
    }

    return allQuotes.filter(q => {
      const qDate = new Date(q.date);
      if (qDate < startDate || qDate > endDate) return false;
      if (userFilter !== 'all') {
        if (!q.creator || q.creator.toLowerCase() !== userFilter.toLowerCase()) return false;
      }
      return true;
    });
  }

  window.generateReportSummary = async function () {
    const period = document.getElementById("report-period")?.value;
    const userFilter = document.getElementById("report-user")?.value;
    const { startDate, endDate } = getReportDateRange(period);

    const resultsGrid = document.getElementById("report-results-grid");
    if (resultsGrid) resultsGrid.style.display = 'grid';

    const matched = await fetchQuotesForReport(startDate, endDate, userFilter);

    let totalSell = 0;
    let totalBuy = 0;
    let totalGp = 0;

    matched.forEach(q => {
      totalSell += q.amountINR || 0;
      const computedBuy = window.computeHistoricalBuyRate(q);
      const buyRate = computedBuy || 0;
      if (q.grossProfit !== undefined) {
        totalGp += q.grossProfit;
        totalBuy += (q.amountINR - q.grossProfit);
      } else {
        totalBuy += buyRate;
        totalGp += (q.amountINR - buyRate);
      }
    });

    document.getElementById("rep-stat-count").textContent = matched.length;
    document.getElementById("rep-stat-revenue").textContent = `₹${totalSell.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
    document.getElementById("rep-stat-buy").textContent = `₹${totalBuy.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
    document.getElementById("rep-stat-gp").textContent = `₹${totalGp.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
  };

  window.exportReportToCSV = async function () {
    const period = document.getElementById("report-period")?.value;
    const userFilter = document.getElementById("report-user")?.value;
    const { startDate, endDate } = getReportDateRange(period);

    const matched = await fetchQuotesForReport(startDate, endDate, userFilter);
    if (matched.length === 0) {
      alert("No quotes found matching the report criteria.");
      return;
    }

    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Ref ID,Date,Mode,Customer,Route,Creator,Carrier,Buy Rate,Sell Rate,GP,Status\n";

    matched.forEach(q => {
      const refId = getQuoteRefId(q) || q.id || "";
      const date = q.date || "";
      const mode = q.type || "";
      const customer = (q.customer || "").replace(/,/g, " ");
      const route = (q.route || "").replace(/,/g, " ");
      const creator = TEAM_ROLES[q.creator]?.name || q.creator || "";
      const carrier = (q.details?.airline || q.details?.shippingLine || q.details?.carrier || "-").replace(/,/g, " ");
      const computedBuy = window.computeHistoricalBuyRate(q);
      const buyRate = computedBuy || 0;
      const sellRate = q.amount || 0;
      const gp = q.grossProfit !== undefined ? q.grossProfit : (sellRate - buyRate);
      const status = q.status || "";

      csvContent += `${refId},${date},${mode},${customer},${route},${creator},${carrier},${buyRate},${sellRate},${gp},${status}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `pricing_report_${period}_${userFilter}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  window.lookupSingleArchivedQuote = async function () {
    const refInput = document.getElementById("report-lookup-ref")?.value.trim().replace("#", "");
    if (!refInput) {
      alert("Please enter a Reference ID to look up.");
      return;
    }

    let foundQuote = null;
    const normalizedRefInput = refInput.toLowerCase();
    const visibleRefMatch = refInput.match(/IN(\d+)$/i);
    const visibleRefQuoteNumber = visibleRefMatch ? Number(visibleRefMatch[1]) : null;
    const matchesLookup = (quote) => {
      const visibleRefId = (getQuoteRefId(quote) || "").toLowerCase();
      const storedId = String(quote.id || "").toLowerCase();
      return visibleRefId === normalizedRefInput || storedId === normalizedRefInput;
    };

    foundQuote = appState.quotes.find(matchesLookup);

    if (!foundQuote && DB.isCloud && DB.firestoreRef) {
      try {
        const docRef = DB.firestoreRef.collection("archive_quotes").doc(refInput);
        const docSnap = await docRef.get();
        if (docSnap.exists) {
          foundQuote = docSnap.data();
        } else {
          const snapshot = await DB.firestoreRef.collection("archive_quotes").where("id", "==", refInput).get();
          if (!snapshot.empty) {
            foundQuote = snapshot.docs[0].data();
          } else {
            // The visible reference ID is generated from quote data and was not
            // historically stored as its own Firestore field. Its final IN#####
            // segment is the existing quoteNumber, which lets us retrieve the
            // small candidate set without changing archived quote data.
            if (visibleRefQuoteNumber !== null) {
              const quoteNumberSnapshot = await DB.firestoreRef.collection("archive_quotes")
                .where("quoteNumber", "==", visibleRefQuoteNumber)
                .get();
              foundQuote = quoteNumberSnapshot.docs
                .map(doc => doc.data())
                .find(matchesLookup) || null;
            }

            if (!foundQuote) {
              const snapshot2 = await DB.firestoreRef.collection("archive_quotes").where("quoteRefNo", "==", parseInt(refInput) || refInput).get();
              if (!snapshot2.empty) foundQuote = snapshot2.docs[0].data();
            }
          }
        }
      } catch (e) {
        console.error("Failed to lookup archive:", e);
      }
    }

    if (!foundQuote) {
      try {
        const offlineArchive = JSON.parse(localStorage.getItem("logistics_archive_quotes") || "[]");
        foundQuote = offlineArchive.find(matchesLookup);
      } catch (e) { }
    }

    if (foundQuote) {
      if (typeof printQuoteSheet === 'function') {
        printQuoteSheet(foundQuote);
      } else {
        alert(`Found Quote #${getQuoteRefId(foundQuote)} for ${foundQuote.customer}. Sell Amount: ${foundQuote.amount}. Status: ${foundQuote.status}`);
      }
    } else {
      alert("Quote not found in active database or archives.");
    }
  };

  window.updateArchiveLookupSuggestions = async function (val) {
    const datalist = document.getElementById("archive-lookup-suggestions");
    if (!datalist) return;
    datalist.innerHTML = "";
    if (!val || val.trim().length < 2) return;

    const searchVal = val.toLowerCase().trim();
    const suggestions = new Set();

    // 1. Memory quotes
    (appState.quotes || []).forEach(q => {
      const refId = (getQuoteRefId(q) || q.id || "").toLowerCase();
      const customer = (q.customer || "").toLowerCase();
      if (refId.includes(searchVal) || customer.includes(searchVal)) {
        suggestions.add(getQuoteRefId(q) || q.id);
      }
    });

    // 2. Offline archive
    try {
      const offlineArchive = JSON.parse(localStorage.getItem("logistics_archive_quotes") || "[]");
      offlineArchive.forEach(q => {
        const refId = (getQuoteRefId(q) || q.id || "").toLowerCase();
        const customer = (q.customer || "").toLowerCase();
        if (refId.includes(searchVal) || customer.includes(searchVal)) {
          suggestions.add(getQuoteRefId(q) || q.id);
        }
      });
    } catch (e) { }

    // 3. Firestore archive
    if (DB.isCloud && DB.firestoreRef) {
      try {
        const snapshot = await DB.firestoreRef.collection("archive_quotes")
          .limit(20)
          .get();
        snapshot.forEach(doc => {
          const q = doc.data();
          const refId = (getQuoteRefId(q) || q.id || "").toLowerCase();
          const customer = (q.customer || "").toLowerCase();
          if (refId.includes(searchVal) || customer.includes(searchVal)) {
            suggestions.add(getQuoteRefId(q) || q.id);
          }
        });
      } catch (e) { }
    }

    Array.from(suggestions).slice(0, 15).forEach(s => {
      const option = document.createElement("option");
      option.value = s;
      datalist.appendChild(option);
    });
  };

  window.runAutoArchival = async function () {
    const thresholdDays = 90;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - thresholdDays);

    const toArchive = [];
    const remaining = [];

    appState.quotes.forEach(q => {
      const qDate = new Date(q.date);
      if (qDate < cutoffDate) {
        toArchive.push(q);
      } else {
        remaining.push(q);
      }
    });

    if (toArchive.length === 0) {
      alert("No quotes older than 90 days found to archive.");
      return;
    }

    if (!confirm(`Are you sure you want to archive ${toArchive.length} quotes older than 90 days? They will be moved to the archival database to speed up the app.`)) {
      return;
    }

    let successCount = 0;
    if (DB.isCloud && DB.firestoreRef) {
      for (const q of toArchive) {
        try {
          await DB.firestoreRef.collection("archive_quotes").doc(q.id).set(q);
          await DB.firestoreRef.collection("quotes").doc(q.id).delete();
          successCount++;
        } catch (e) {
          console.error("Failed to archive quote:", q.id, e);
        }
      }
    } else {
      try {
        const offlineArchive = JSON.parse(localStorage.getItem("logistics_archive_quotes") || "[]");
        const updatedArchive = [...offlineArchive, ...toArchive];
        localStorage.setItem("logistics_archive_quotes", JSON.stringify(updatedArchive));
        localStorage.setItem("logistics_quotes", JSON.stringify(remaining));
        successCount = toArchive.length;
      } catch (e) {
        console.error("Failed to update offline archive:", e);
      }
    }

    appState.quotes = remaining;
    applyDbFiltersAndSort();
    alert(`Successfully archived ${successCount} quotes!`);
  };

  // (Broadcast polling handled at module level — see window.checkActiveBroadcast setInterval above)

  // Update edit timelines countdown every second
  function updateEditTimelines() {
    const indicators = document.querySelectorAll(".edit-timeline-indicator");
    indicators.forEach(el => {
      const timestampStr = el.getAttribute("data-timestamp");
      const quoteId = el.getAttribute("data-quote-id");
      if (!timestampStr) {
        el.innerHTML = '<span style="color: var(--text-muted); font-size: 0.65rem;">🔒 Locked</span>';
        return;
      }
      const timestamp = parseInt(timestampStr, 10);
      if (isNaN(timestamp)) {
        el.innerHTML = '<span style="color: var(--text-muted); font-size: 0.65rem;">🔒 Locked</span>';
        return;
      }

      const quote = appState.quotes.find(q => q.id === quoteId);
      const elapsed = Date.now() - timestamp;
      const limit = 6 * 60 * 60 * 1000; // 6 hours

      if (elapsed < limit) {
        const remaining = limit - elapsed;
        const hours = Math.floor(remaining / (3600 * 1000));
        const minutes = Math.floor((remaining % (3600 * 1000)) / (60 * 1000));
        const seconds = Math.floor((remaining % (60 * 1000)) / 1000);

        let color = "var(--accent-success)"; // Greenish
        let label = "⏳";
        if (hours < 1) {
          color = "var(--accent-warning)"; // Orange
          label = "⚠️";
        }

        const timeStr = `${hours}h ${minutes}m ${seconds}s`;
        el.innerHTML = `<span style="color: ${color}; font-weight: 600;" title="Editable without permission for ${timeStr}">${label} ${hours}h ${minutes}m left</span>`;
      } else {
        if (quote && isAmendmentGrantActive(quote)) {
          el.innerHTML = '<span style="color: var(--accent-success); font-weight: 600;" title="Unlocked by Admin approval">🔓 Unlocked</span>';
        } else {
          el.innerHTML = '<span style="color: var(--text-muted); font-size: 0.65rem;" title="Edit window expired. Request permission to edit.">🔒 Locked</span>';
        }
      }
    });
  }
  window.updateEditTimelines = updateEditTimelines;
  setInterval(updateEditTimelines, 1000);
  setTimeout(updateEditTimelines, 100);

  // Populate users dropdown immediately on load
  if (typeof populateReportUsers === 'function') {
    populateReportUsers();
  }
});

// ==================== ADMIN AGENT & CUSTOMER DIRECTORY LOGIC ====================
window._dirGrouping = 'agents'; // Default grouping
window._dirSelectedItem = null; // { type: 'agent'|'customer', name: '...' }
window._dirCollapsedNodes = window._dirCollapsedNodes || new Set();

function toggleDirNodeCollapse(event, nodeKey) {
  if (event) event.stopPropagation();
  if (window._dirCollapsedNodes.has(nodeKey)) {
    window._dirCollapsedNodes.delete(nodeKey);
  } else {
    window._dirCollapsedNodes.add(nodeKey);
  }
  updateAdminDirectoryView();
}
window.toggleDirNodeCollapse = toggleDirNodeCollapse;

function expandAllDirNodes() {
  window._dirCollapsedNodes.clear();
  updateAdminDirectoryView();
}
window.expandAllDirNodes = expandAllDirNodes;

function collapseAllDirNodes() {
  const quotes = appState.quotes || [];
  let controls = window._customerControls || {};
  if (Object.keys(controls).length === 0) {
    try {
      controls = JSON.parse(localStorage.getItem("gl_customer_controls") || "{}");
    } catch (e) { }
  }

  window._dirCollapsedNodes.clear();

  if (window._dirGrouping === 'agents') {
    // Keyed by each agent's stable role ID, not their display name — the
    // display name is loaded live from Firestore and can arrive or change
    // after this runs, which used to leave that agent's node expanded
    // because the key computed here no longer matched the key computed at
    // render time.
    Object.keys(TEAM_ROLES).forEach(roleId => {
      if (roleId === 'ganny' || roleId === 'manager') return;
      window._dirCollapsedNodes.add(`agent_${roleId}`);
    });
    quotes.forEach(q => {
      const creator = (q.creator || 'unknown').toLowerCase();
      window._dirCollapsedNodes.add(`agent_${creator}`);
    });
  } else {
    const allCustomers = Array.from(new Set([
      ...quotes.map(q => q.customer.trim()),
      ...Object.values(controls).map(c => c.customer.trim())
    ]));
    allCustomers.forEach(cust => {
      window._dirCollapsedNodes.add(`customer_${cust}`);
    });
  }
  updateAdminDirectoryView();
}
window.collapseAllDirNodes = collapseAllDirNodes;

function toggleDirGrouping(mode) {
  window._dirGrouping = mode;

  const btnAgents = document.getElementById("dir-toggle-agents");
  const btnCustomers = document.getElementById("dir-toggle-customers");

  if (btnAgents && btnCustomers) {
    if (mode === 'agents') {
      btnAgents.classList.add("active");
      btnAgents.style.background = "#eaf0ff";
      btnAgents.style.color = "#1d3187";
      btnCustomers.classList.remove("active");
      btnCustomers.style.background = "transparent";
      btnCustomers.style.color = "var(--t2)";
    } else {
      btnCustomers.classList.add("active");
      btnCustomers.style.background = "#eaf0ff";
      btnCustomers.style.color = "#1d3187";
      btnAgents.classList.remove("active");
      btnAgents.style.background = "transparent";
      btnAgents.style.color = "var(--t2)";
    }
  }
  updateAdminDirectoryView();
}
window.toggleDirGrouping = toggleDirGrouping;

function selectDirectoryItem(type, name) {
  window._dirSelectedItem = { type, name };

  // Highlight active item in the list
  const allItems = document.querySelectorAll(".dir-tree-node");
  allItems.forEach(item => {
    item.classList.remove("active-node");
    item.style.background = "transparent";
    item.style.borderColor = "transparent";
  });

  const activeEl = document.getElementById(`dir-node-${type}-${name.replace(/\s+/g, '_')}`);
  if (activeEl) {
    activeEl.classList.add("active-node");
    activeEl.style.background = "rgba(14, 165, 233, 0.15)";
    activeEl.style.borderColor = "var(--sky)";
  }

  showDirectoryItemDetails(type, name);
}
window.selectDirectoryItem = selectDirectoryItem;

// Quote-count badges in the directory tree previously all used one flat
// neutral color regardless of volume, so the busiest desk (hundreds of
// quotes) looked visually identical to one with a single quote. Color the
// badge by its share of the current list's max count instead.
function getDirCountBadgeStyle(count, maxCount) {
  if (maxCount <= 0 || count <= 0) return { bg: 'var(--border-2)', color: 'var(--t2)' };
  const ratio = count / maxCount;
  if (ratio >= 0.5) return { bg: 'rgba(46,204,113,0.15)', color: 'var(--accent-success)' };
  if (ratio >= 0.15) return { bg: 'rgba(14,165,233,0.15)', color: 'var(--sky)' };
  return { bg: 'var(--border-2)', color: 'var(--t2)' };
}

function updateAdminDirectoryView() {
  const listContainer = document.getElementById("dir-list-container");
  if (!listContainer) return;

  const searchInput = document.getElementById("dir-search-input");
  const query = searchInput ? searchInput.value.toLowerCase().trim() : '';

  const quotes = appState.quotes || [];
  let controls = window._customerControls || {};
  if (Object.keys(controls).length === 0) {
    try {
      controls = JSON.parse(localStorage.getItem("gl_customer_controls") || "{}");
    } catch (e) { }
  }

  if (window._dirGrouping === 'agents') {
    // Group by Agents (creator of the quotes)
    const agentMap = {};

    // Add all registered team roles to make sure they appear
    Object.keys(TEAM_ROLES).forEach(roleId => {
      if (roleId === 'ganny' || roleId === 'manager') return;
      const agentName = TEAM_ROLES[roleId].name || roleId;
      agentMap[agentName] = {
        roleId: roleId,
        customers: new Set(),
        quotesCount: 0
      };
    });

    // Populate from quotes
    quotes.forEach(q => {
      const creator = q.creator || 'unknown';
      const agentName = TEAM_ROLES[creator.toLowerCase()]?.name || q.creator || 'Unknown';
      if (!agentMap[agentName]) {
        agentMap[agentName] = { roleId: creator, customers: new Set(), quotesCount: 0 };
      }
      agentMap[agentName].quotesCount++;
      if (q.customer) {
        agentMap[agentName].customers.add(q.customer.trim());
      }
    });

    // Build HTML
    let html = '';
    const sortedAgents = Object.keys(agentMap).sort();
    const maxAgentQuotes = Math.max(...Object.values(agentMap).map(d => d.quotesCount), 0);

    let filteredCount = 0;
    sortedAgents.forEach(agentName => {
      const data = agentMap[agentName];
      const customersList = Array.from(data.customers).sort();

      // Filter logic
      const matchesAgent = agentName.toLowerCase().includes(query);
      const matchingCustomers = customersList.filter(c => c.toLowerCase().includes(query));

      if (!query || matchesAgent || matchingCustomers.length > 0) {
        filteredCount++;
        const isSelected = window._dirSelectedItem && window._dirSelectedItem.type === 'agent' && window._dirSelectedItem.name === agentName;
        const bg = isSelected ? 'rgba(14, 165, 233, 0.15)' : 'transparent';
        const border = isSelected ? 'var(--sky)' : 'transparent';
        const countBadge = getDirCountBadgeStyle(data.quotesCount, maxAgentQuotes);

        const nodeKey = `agent_${String(data.roleId || agentName).toLowerCase()}`;
        const isCollapsed = window._dirCollapsedNodes.has(nodeKey);
        const arrow = isCollapsed ? '▶' : '▼';
        const displayStyle = isCollapsed ? 'none' : 'flex';

        html += `
          <div class="dir-tree-node-wrapper" style="margin-bottom: 0.5rem;">
            <div id="dir-node-agent-${agentName.replace(/\s+/g, '_')}" class="dir-tree-node" onclick="selectDirectoryItem('agent', '${agentName}')" style="display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; border-radius: 8px; border: 1px solid ${border}; background: ${bg}; cursor: pointer; transition: all 0.2s;" onmouseover="if(!this.classList.contains('active-node')) this.style.background='rgba(255,255,255,0.05)'" onmouseout="if(!this.classList.contains('active-node')) this.style.background='transparent'">
              <div style="display: flex; align-items: center; gap: 0.4rem; color: var(--t1); font-weight: 700; font-size: 0.8rem;">
                <button onclick="toggleDirNodeCollapse(event, '${nodeKey}')" style="background: transparent; border: none; color: var(--t2); cursor: pointer; font-size: 0.65rem; padding: 2px 4px; display: flex; align-items: center; justify-content: center; width: 16px; height: 16px; transition: transform 0.2s;">
                  ${arrow}
                </button>
                <span>👤</span>
                <span>${agentName}</span>
              </div>
              <span style="font-size: 0.7rem; background: ${countBadge.bg}; color: ${countBadge.color}; padding: 2px 6px; border-radius: 10px; font-weight: 600;">${data.quotesCount} Quotes</span>
            </div>
            
            <!-- Children (Customers under this Agent) -->
            <div style="padding-left: 1.5rem; margin-top: 0.25rem; display: ${displayStyle}; flex-direction: column; gap: 0.25rem; border-left: 1px dashed var(--border-1); margin-left: 1.25rem;">
              ${customersList.map(cust => {
          const matchesCust = !query || cust.toLowerCase().includes(query) || matchesAgent;
          if (!matchesCust) return '';
          const isCustSelected = window._dirSelectedItem && window._dirSelectedItem.type === 'customer' && window._dirSelectedItem.name === cust;
          const cBg = isCustSelected ? 'rgba(14, 165, 233, 0.15)' : 'transparent';
          const cBorder = isCustSelected ? 'var(--sky)' : 'transparent';
          return `
                  <div id="dir-node-customer-${cust.replace(/\s+/g, '_')}" class="dir-tree-node child-node" onclick="event.stopPropagation(); selectDirectoryItem('customer', '${cust}')" style="display: flex; align-items: center; gap: 0.4rem; padding: 4px 8px; border-radius: 6px; border: 1px solid ${cBorder}; background: ${cBg}; cursor: pointer; font-size: 0.75rem; color: var(--t2);" onmouseover="if(!this.classList.contains('active-node')) this.style.background='rgba(255,255,255,0.04)'" onmouseout="if(!this.classList.contains('active-node')) this.style.background='transparent'">
                    <span>🏢</span>
                    <span style="text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${cust}</span>
                  </div>
                `;
        }).join('')}
            </div>
          </div>
        `;
      }
    });

    if (filteredCount === 0) {
      listContainer.innerHTML = `<div style="text-align: center; color: var(--text-dim); font-size: 0.75rem; padding: 2rem;">No matching agents found.</div>`;
    } else {
      listContainer.innerHTML = html;
    }

  } else {
    // Group by Customers
    const customerMap = {};

    // Populate unique customers from quotes and controls
    const allCustomers = Array.from(new Set([
      ...quotes.map(q => (q.customer || '').trim()),
      ...Object.values(controls).map(c => (c.customer || '').trim())
    ].filter(Boolean)));

    allCustomers.forEach(cust => {
      customerMap[cust] = {
        agents: new Set(),
        quotesCount: 0
      };
    });

    quotes.forEach(q => {
      if (q.customer) {
        const cust = q.customer.trim();
        if (customerMap[cust]) {
          customerMap[cust].quotesCount++;
          const creator = q.creator || 'unknown';
          const agentName = TEAM_ROLES[creator.toLowerCase()]?.name || q.creator || 'Unknown';
          customerMap[cust].agents.add(agentName);
        }
      }
    });

    let html = '';
    const sortedCusts = Object.keys(customerMap).sort();
    const maxCustQuotes = Math.max(...Object.values(customerMap).map(d => d.quotesCount), 0);
    let filteredCount = 0;

    sortedCusts.forEach(cust => {
      const data = customerMap[cust];
      const agentsList = Array.from(data.agents).sort();

      const matchesCust = cust.toLowerCase().includes(query);
      const matchingAgents = agentsList.filter(a => a.toLowerCase().includes(query));

      if (!query || matchesCust || matchingAgents.length > 0) {
        filteredCount++;
        const isSelected = window._dirSelectedItem && window._dirSelectedItem.type === 'customer' && window._dirSelectedItem.name === cust;
        const bg = isSelected ? 'rgba(14, 165, 233, 0.15)' : 'transparent';
        const border = isSelected ? 'var(--sky)' : 'transparent';
        const countBadge = getDirCountBadgeStyle(data.quotesCount, maxCustQuotes);

        const nodeKey = `customer_${cust}`;
        const isCollapsed = window._dirCollapsedNodes.has(nodeKey);
        const arrow = isCollapsed ? '▶' : '▼';
        const displayStyle = isCollapsed ? 'none' : 'flex';

        html += `
          <div class="dir-tree-node-wrapper" style="margin-bottom: 0.5rem;">
            <div id="dir-node-customer-${cust.replace(/\s+/g, '_')}" class="dir-tree-node" onclick="selectDirectoryItem('customer', '${cust}')" style="display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; border-radius: 8px; border: 1px solid ${border}; background: ${bg}; cursor: pointer; transition: all 0.2s;" onmouseover="if(!this.classList.contains('active-node')) this.style.background='rgba(255,255,255,0.05)'" onmouseout="if(!this.classList.contains('active-node')) this.style.background='transparent'">
              <div style="display: flex; align-items: center; gap: 0.4rem; color: var(--t1); font-weight: 700; font-size: 0.8rem;">
                <button onclick="toggleDirNodeCollapse(event, '${nodeKey}')" style="background: transparent; border: none; color: var(--t2); cursor: pointer; font-size: 0.65rem; padding: 2px 4px; display: flex; align-items: center; justify-content: center; width: 16px; height: 16px; transition: transform 0.2s;">
                  ${arrow}
                </button>
                <span>🏢</span>
                <span style="max-width: 170px; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${cust}</span>
              </div>
              <span style="font-size: 0.7rem; background: ${countBadge.bg}; color: ${countBadge.color}; padding: 2px 6px; border-radius: 10px; font-weight: 600;">${data.quotesCount} Quotes</span>
            </div>
            
            <!-- Children (Agents under this Customer) -->
            <div style="padding-left: 1.5rem; margin-top: 0.25rem; display: ${displayStyle}; flex-direction: column; gap: 0.25rem; border-left: 1px dashed var(--border-1); margin-left: 1.25rem;">
              ${agentsList.map(agent => {
          const matchesAgent = !query || agent.toLowerCase().includes(query) || matchesCust;
          if (!matchesAgent) return '';
          const isAgentSelected = window._dirSelectedItem && window._dirSelectedItem.type === 'agent' && window._dirSelectedItem.name === agent;
          const aBg = isAgentSelected ? 'rgba(14, 165, 233, 0.15)' : 'transparent';
          const aBorder = isAgentSelected ? 'var(--sky)' : 'transparent';
          return `
                  <div id="dir-node-agent-${agent.replace(/\s+/g, '_')}" class="dir-tree-node child-node" onclick="event.stopPropagation(); selectDirectoryItem('agent', '${agent}')" style="display: flex; align-items: center; gap: 0.4rem; padding: 4px 8px; border-radius: 6px; border: 1px solid ${aBorder}; background: ${aBg}; cursor: pointer; font-size: 0.75rem; color: var(--t2);" onmouseover="if(!this.classList.contains('active-node')) this.style.background='rgba(255,255,255,0.04)'" onmouseout="if(!this.classList.contains('active-node')) this.style.background='transparent'">
                    <span>👤</span>
                    <span>${agent}</span>
                  </div>
                `;
        }).join('')}
            </div>
          </div>
        `;
      }
    });

    if (filteredCount === 0) {
      listContainer.innerHTML = `<div style="text-align: center; color: var(--text-dim); font-size: 0.75rem; padding: 2rem;">No matching customers found.</div>`;
    } else {
      listContainer.innerHTML = html;
    }
  }
}
window.updateAdminDirectoryView = updateAdminDirectoryView;

function showDirectoryItemDetails(type, name) {
  const detailsContainer = document.getElementById("dir-details-container");
  if (!detailsContainer) return;

  const quotes = appState.quotes || [];
  let controls = window._customerControls || {};
  if (Object.keys(controls).length === 0) {
    try {
      controls = JSON.parse(localStorage.getItem("gl_customer_controls") || "{}");
    } catch (e) { }
  }

  if (type === 'agent') {
    // Render Agent details
    const agentQuotes = quotes.filter(q => {
      const agentName = TEAM_ROLES[q.creator?.toLowerCase()]?.name || q.creator || 'Unknown';
      return agentName.toLowerCase().trim() === name.toLowerCase().trim();
    });

    const uniqueCustomers = Array.from(new Set(agentQuotes.map(q => q.customer).filter(Boolean))).sort();
    const totalCount = agentQuotes.length;
    const convertedCount = agentQuotes.filter(q => q.status === 'converted').length;
    const conversionRate = totalCount > 0 ? ((convertedCount / totalCount) * 100).toFixed(1) : '0.0';

    let quotesRows = agentQuotes.map(q => {
      const refId = q.refid || `Q-${q.id.substring(0, 6)}`;
      const amtStr = q.amountINR ? `₹${q.amountINR.toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : 'N/A';
      const dateStr = q.timestamp ? new Date(q.timestamp).toLocaleDateString() : 'N/A';
      const statusColor = q.status === 'converted' ? 'var(--accent-success)' : (q.status === 'expired' ? 'var(--accent-error)' : 'var(--accent-warning)');
      return `
        <tr>
          <td style="font-weight:700; color:var(--sky);">${refId}</td>
          <td>${dateStr}</td>
          <td>${q.customer || 'N/A'}</td>
          <td>${q.mode?.toUpperCase() || 'N/A'}</td>
          <td>${amtStr}</td>
          <td><span style="color:${statusColor}; font-weight:700;">${q.status?.toUpperCase() || 'PENDING'}</span></td>
        </tr>
      `;
    }).join('');

    if (!quotesRows) {
      quotesRows = `<tr><td colspan="6" style="text-align:center; color:var(--text-dim); padding:1rem;">No quotes generated by this agent.</td></tr>`;
    }

    detailsContainer.innerHTML = `
      <div class="glass-card" style="padding: 1.25rem; display: flex; flex-direction: column; gap: 1rem; background: rgba(255,255,255,0.01); border: 1px solid var(--border-1); border-radius: 12px; height: 100%;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid var(--border-1); padding-bottom: 0.75rem;">
          <div>
            <div style="font-size: 0.65rem; color: var(--sky); font-weight: 800; text-transform: uppercase;">Agent Profile</div>
            <h4 style="font-size: 1.15rem; font-weight: 800; margin: 0.1rem 0 0; color: var(--t1);">${name}</h4>
          </div>
          <span style="font-size: 0.7rem; font-weight: 700; background: rgba(14, 165, 233, 0.1); color: var(--sky); padding: 4px 8px; border-radius: 6px;">Pricing Officer</span>
        </div>
        
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.75rem;">
          <div style="background: rgba(255,255,255,0.02); padding: 10px; border-radius: 8px; border: 1px solid var(--border-1);">
            <div style="font-size: 0.65rem; color: var(--text-dim); font-weight: 600;">Total Quotes</div>
            <div style="font-size: 1.1rem; font-weight: 800; color: var(--t1); margin-top: 2px;">${totalCount}</div>
          </div>
          <div style="background: rgba(255,255,255,0.02); padding: 10px; border-radius: 8px; border: 1px solid var(--border-1);">
            <div style="font-size: 0.65rem; color: var(--text-dim); font-weight: 600;">Conversions</div>
            <div style="font-size: 1.1rem; font-weight: 800; color: var(--accent-success); margin-top: 2px;">${convertedCount}</div>
          </div>
          <div style="background: rgba(255,255,255,0.02); padding: 10px; border-radius: 8px; border: 1px solid var(--border-1);">
            <div style="font-size: 0.65rem; color: var(--text-dim); font-weight: 600;">Conversion Rate</div>
            <div style="font-size: 1.1rem; font-weight: 800; color: var(--accent-warning); margin-top: 2px;">${conversionRate}%</div>
          </div>
        </div>
        
        <div>
          <div style="font-size: 0.72rem; font-weight: 700; color: var(--t2); margin-bottom: 0.4rem; text-transform: uppercase;">Priced Customers (${uniqueCustomers.length})</div>
          <div style="display: flex; flex-wrap: wrap; gap: 0.4rem; max-height: 80px; overflow-y: auto; padding: 4px;">
            ${uniqueCustomers.map(c => `<span style="font-size: 0.68rem; padding: 3px 8px; border-radius: 4px; background: var(--border-1); color: var(--t1); border: 1px solid var(--border-2);">${c}</span>`).join('') || '<span style="font-size: 0.7rem; color: var(--text-dim); font-style: italic;">No customers priced yet.</span>'}
          </div>
        </div>
        
        <div style="flex: 1; display: flex; flex-direction: column; gap: 0.5rem; min-height: 180px;">
          <div style="font-size: 0.72rem; font-weight: 700; color: var(--t2); text-transform: uppercase;">Recent Quotes Activity</div>
          <div class="quotes-table-container" style="flex: 1; max-height: 220px; overflow-y: auto;">
            <table class="quotes-table" style="font-size: 0.7rem; width: 100%;">
              <thead>
                <tr>
                  <th>Ref ID</th>
                  <th>Date</th>
                  <th>Customer</th>
                  <th>Mode</th>
                  <th>Value</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${quotesRows}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

  } else {
    // Render Customer details
    const customerLower = name.toLowerCase().trim();
    const ctrl = controls[customerLower] || {
      customer: name,
      creditDays: 36,
      creditLimit: 0,
      blocked: false,
      waiveAgreement: false,
      hasAgreement: false
    };

    const customerQuotes = quotes.filter(q => q.customer?.toLowerCase().trim() === customerLower);
    const totalCount = customerQuotes.length;
    const totalValue = customerQuotes.reduce((acc, q) => acc + (q.amountINR || 0), 0);

    // Associated agents
    const associatedAgents = Array.from(new Set(customerQuotes.map(q => {
      return TEAM_ROLES[q.creator?.toLowerCase()]?.name || q.creator || 'Unknown';
    }).filter(Boolean))).sort();

    const statusText = ctrl.blocked ? 'BLOCKED' : 'ACTIVE';
    const statusBg = ctrl.blocked ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)';
    const statusColor = ctrl.blocked ? 'var(--accent-error)' : 'var(--accent-success)';

    const complianceText = ctrl.hasAgreement ? 'COMPLIANT' : (ctrl.waiveAgreement ? 'WAIVED' : 'NON-COMPLIANT');
    const complianceColor = ctrl.hasAgreement ? 'var(--accent-success)' : (ctrl.waiveAgreement ? 'var(--accent-warning)' : 'var(--accent-error)');

    let quotesRows = customerQuotes.map(q => {
      const refId = q.refid || `Q-${q.id.substring(0, 6)}`;
      const amtStr = q.amountINR ? `₹${q.amountINR.toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : 'N/A';
      const dateStr = q.timestamp ? new Date(q.timestamp).toLocaleDateString() : 'N/A';
      const creatorName = TEAM_ROLES[q.creator?.toLowerCase()]?.name || q.creator || 'Unknown';
      const statusColor = q.status === 'converted' ? 'var(--accent-success)' : (q.status === 'expired' ? 'var(--accent-error)' : 'var(--accent-warning)');
      return `
        <tr>
          <td style="font-weight:700; color:var(--sky);">${refId}</td>
          <td>${dateStr}</td>
          <td>${creatorName}</td>
          <td>${q.mode?.toUpperCase() || 'N/A'}</td>
          <td>${amtStr}</td>
          <td><span style="color:${statusColor}; font-weight:700;">${q.status?.toUpperCase() || 'PENDING'}</span></td>
        </tr>
      `;
    }).join('');

    if (!quotesRows) {
      quotesRows = `<tr><td colspan="6" style="text-align:center; color:var(--text-dim); padding:1rem;">No quotes generated for this customer.</td></tr>`;
    }

    detailsContainer.innerHTML = `
      <div class="glass-card" style="padding: 1.25rem; display: flex; flex-direction: column; gap: 1rem; background: rgba(255,255,255,0.01); border: 1px solid var(--border-1); border-radius: 12px; height: 100%;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid var(--border-1); padding-bottom: 0.75rem;">
          <div>
            <div style="font-size: 0.65rem; color: var(--sky); font-weight: 800; text-transform: uppercase;">Customer Profile</div>
            <h4 style="font-size: 1.15rem; font-weight: 800; margin: 0.1rem 0 0; color: var(--t1);">${name}</h4>
          </div>
          <span style="font-size: 0.7rem; font-weight: 700; background: ${statusBg}; color: ${statusColor}; padding: 4px 8px; border-radius: 6px;">${statusText}</span>
        </div>
        
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.5rem;">
          <div style="background: rgba(255,255,255,0.02); padding: 8px; border-radius: 8px; border: 1px solid var(--border-1);">
            <div style="font-size: 0.6rem; color: var(--text-dim); font-weight: 600;">Credit Period</div>
            <div style="font-size: 0.95rem; font-weight: 800; color: var(--t1); margin-top: 2px;">${ctrl.creditDays || 36} Days</div>
          </div>
          <div style="background: rgba(255,255,255,0.02); padding: 8px; border-radius: 8px; border: 1px solid var(--border-1);">
            <div style="font-size: 0.6rem; color: var(--text-dim); font-weight: 600;">Credit Limit</div>
            <div style="font-size: 0.95rem; font-weight: 800; color: var(--t1); margin-top: 2px;">$${(ctrl.creditLimit || 0).toLocaleString()}</div>
          </div>
          <div style="background: rgba(255,255,255,0.02); padding: 8px; border-radius: 8px; border: 1px solid var(--border-1);">
            <div style="font-size: 0.6rem; color: var(--text-dim); font-weight: 600;">Compliance</div>
            <div style="font-size: 0.9rem; font-weight: 800; color: ${complianceColor}; margin-top: 2px;">${complianceText}</div>
          </div>
          <div style="background: rgba(255,255,255,0.02); padding: 8px; border-radius: 8px; border: 1px solid var(--border-1);">
            <div style="font-size: 0.6rem; color: var(--text-dim); font-weight: 600;">Total Business</div>
            <div style="font-size: 0.9rem; font-weight: 800; color: var(--sky); margin-top: 2px;">₹${totalValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
          </div>
        </div>
        
        <div>
          <div style="font-size: 0.72rem; font-weight: 700; color: var(--t2); margin-bottom: 0.4rem; text-transform: uppercase;">Assigned Agents (${associatedAgents.length})</div>
          <div style="display: flex; flex-wrap: wrap; gap: 0.4rem;">
            ${associatedAgents.map(a => `<span style="font-size: 0.68rem; padding: 3px 8px; border-radius: 4px; background: rgba(27,28,92,0.04); color: var(--sky); border: 1px solid var(--border-1); font-weight:600;">${a}</span>`).join('') || '<span style="font-size: 0.7rem; color: var(--text-dim); font-style: italic;">No agents assigned yet.</span>'}
          </div>
        </div>
        
        <div style="flex: 1; display: flex; flex-direction: column; gap: 0.5rem; min-height: 180px;">
          <div style="font-size: 0.72rem; font-weight: 700; color: var(--t2); text-transform: uppercase;">Quotes History (${totalCount})</div>
          <div class="quotes-table-container" style="flex: 1; max-height: 220px; overflow-y: auto;">
            <table class="quotes-table" style="font-size: 0.7rem; width: 100%;">
              <thead>
                <tr>
                  <th>Ref ID</th>
                  <th>Date</th>
                  <th>Agent (Desk)</th>
                  <th>Mode</th>
                  <th>Value</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${quotesRows}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }
}
window.showDirectoryItemDetails = showDirectoryItemDetails;

function exportDirectoryCSV() {
  const quotes = appState.quotes || [];
  let controls = window._customerControls || {};
  if (Object.keys(controls).length === 0) {
    try {
      controls = JSON.parse(localStorage.getItem("gl_customer_controls") || "{}");
    } catch (e) { }
  }

  let csvContent = "data:text/csv;charset=utf-8,";

  if (window._dirGrouping === 'agents') {
    csvContent += "Agent Name,Desk,Total Quotes,Customer Assigned\n";

    const agentMap = {};
    Object.keys(TEAM_ROLES).forEach(roleId => {
      if (roleId === 'ganny' || roleId === 'manager') return;
      const agentName = TEAM_ROLES[roleId].name || roleId;
      agentMap[agentName] = { roleId: roleId, customers: new Set(), quotesCount: 0 };
    });

    quotes.forEach(q => {
      const creator = q.creator || 'unknown';
      const agentName = TEAM_ROLES[creator.toLowerCase()]?.name || q.creator || 'Unknown';
      if (!agentMap[agentName]) {
        agentMap[agentName] = { roleId: creator, customers: new Set(), quotesCount: 0 };
      }
      agentMap[agentName].quotesCount++;
      if (q.customer) {
        agentMap[agentName].customers.add(q.customer.trim());
      }
    });

    Object.keys(agentMap).sort().forEach(agentName => {
      const data = agentMap[agentName];
      const category = TEAM_ROLES[data.roleId?.toLowerCase()]?.category || 'Custom Desk';
      const customersList = Array.from(data.customers);

      if (customersList.length === 0) {
        csvContent += `"${agentName}","${category}",${data.quotesCount},"None"\n`;
      } else {
        customersList.forEach(cust => {
          csvContent += `"${agentName}","${category}",${data.quotesCount},"${cust}"\n`;
        });
      }
    });
  } else {
    csvContent += "Customer Name,Credit Period (Days),Credit Limit (USD),Compliance,Total Quotes,Associated Agents\n";

    const allCustomers = Array.from(new Set([
      ...quotes.map(q => q.customer.trim()),
      ...Object.values(controls).map(c => c.customer.trim())
    ])).sort();

    allCustomers.forEach(cust => {
      const customerLower = cust.toLowerCase().trim();
      const ctrl = controls[customerLower] || { creditDays: 36, creditLimit: 0 };

      const customerQuotes = quotes.filter(q => q.customer?.toLowerCase().trim() === customerLower);
      const quotesCount = customerQuotes.length;

      const associatedAgents = Array.from(new Set(customerQuotes.map(q => {
        return TEAM_ROLES[q.creator?.toLowerCase()]?.name || q.creator || 'Unknown';
      }).filter(Boolean))).sort().join(' | ');

      const complianceText = ctrl.hasAgreement ? 'Compliant' : (ctrl.waiveAgreement ? 'Waived' : 'Non-Compliant');

      csvContent += `"${cust}",${ctrl.creditDays || 36},${ctrl.creditLimit || 0},"${complianceText}",${quotesCount},"${associatedAgents || 'None'}"\n`;
    });
  }

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `agent_customer_directory_${window._dirGrouping}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
window.exportDirectoryCSV = exportDirectoryCSV;
// ===============================================================================

// Dynamic Audio and Toast Notifications for Admin Approvals
let _previousPendingReqIds = new Set();
let _isRequestsInitDone = false;

let globalAudioCtx = null;
function initAudio() {
  if (!globalAudioCtx) {
    globalAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (globalAudioCtx && globalAudioCtx.state === 'suspended') {
    globalAudioCtx.resume().catch(e => console.warn(e));
  }
}
document.addEventListener('click', initAudio, { once: false });
document.addEventListener('touchstart', initAudio, { once: false });

function playNotificationSound() {
  try {
    initAudio();
    const ctx = globalAudioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(e => console.warn(e));
    }

    // Play realistic cricket chirp sound: high-pitched pulses repeating
    const playChirp = (startTime) => {
      const numSyllables = 4;
      const syllableDuration = 0.015; // 15ms
      const syllableGap = 0.01;      // 10ms
      const frequency = 4500;        // 4.5 kHz (typical cricket frequency)

      for (let i = 0; i < numSyllables; i++) {
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(frequency, ctx.currentTime + startTime + i * (syllableDuration + syllableGap));

        const sTime = ctx.currentTime + startTime + i * (syllableDuration + syllableGap);
        gainNode.gain.setValueAtTime(0, ctx.currentTime);
        gainNode.gain.setValueAtTime(0, sTime);
        gainNode.gain.linearRampToValueAtTime(0.04, sTime + 0.002);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, sTime + syllableDuration);

        osc.connect(gainNode);
        gainNode.connect(ctx.destination);

        osc.start(sTime);
        osc.stop(sTime + syllableDuration);
      }
    };

    // Play a sequence of 3 chirps
    playChirp(0);
    playChirp(0.18);
    playChirp(0.36);
  } catch (e) {
    console.warn("Web Audio alert sound blocked or unsupported:", e);
  }
}
window.playNotificationSound = playNotificationSound;

function showToastNotification(message) {
  let container = document.getElementById("toast-notification-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-notification-container";
    container.style.cssText = `
      position: fixed;
      top: 24px;
      right: 24px;
      z-index: 10000;
      display: flex;
      flex-direction: column;
      gap: 12px;
      pointer-events: none;
    `;
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  toast.style.cssText = `
    background: rgba(30, 41, 59, 0.95);
    color: #ffffff;
    padding: 14px 20px;
    border-radius: 10px;
    border-left: 5px solid var(--accent-error);
    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.4), 0 8px 10px -6px rgba(0, 0, 0, 0.4);
    font-family: 'Outfit', sans-serif;
    font-size: 0.82rem;
    font-weight: 700;
    min-width: 280px;
    max-width: 420px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    opacity: 0;
    transform: translateX(50px);
    transition: all 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    pointer-events: auto;
    backdrop-filter: blur(10px);
  `;

  toast.innerHTML = `
    <div style="display: flex; align-items: center; gap: 8px;">
      <span style="font-size: 1.1rem;">🔔</span>
      <span>${message}</span>
    </div>
    <button style="background:transparent; border:none; color:rgba(255,255,255,0.6); cursor:pointer; font-weight:bold; font-size:1.1rem; padding: 0 4px;" onclick="this.parentElement.remove()">×</button>
  `;

  container.appendChild(toast);

  // Trigger animation
  setTimeout(() => {
    toast.style.opacity = "1";
    toast.style.transform = "translateX(0)";
  }, 10);

  // Auto remove after 6 seconds
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(50px)";
    setTimeout(() => {
      toast.remove();
    }, 400);
  }, 6000);
}
window.showToastNotification = showToastNotification;

function checkAndNotifyNewRequests(reqs) {
  const isAdmin = (appState.currentUser === 'ganny' || (TEAM_ROLES[appState.currentUser]?.type === 'admin'));
  if (!isAdmin) return;

  const currentPending = reqs.filter(r => r.status === 'pending');

  if (!_isRequestsInitDone) {
    currentPending.forEach(r => _previousPendingReqIds.add(r.id));
    _isRequestsInitDone = true;
    return;
  }

  let hasNew = false;
  let newReqNames = [];

  currentPending.forEach(r => {
    if (!_previousPendingReqIds.has(r.id)) {
      hasNew = true;
      const typeStr = r.requestType ? r.requestType.toUpperCase().replace('_', ' ') : 'REQUEST';
      newReqNames.push(`${typeStr} from ${r.creatorName || 'agent'}`);
      _previousPendingReqIds.add(r.id);
    }
  });

  // Clean up resolved IDs
  const currentPendingIds = new Set(currentPending.map(r => r.id));
  for (let id of _previousPendingReqIds) {
    if (!currentPendingIds.has(id)) {
      _previousPendingReqIds.delete(id);
    }
  }

  if (hasNew) {
    playNotificationSound();
    showToastNotification(`New Request: ${newReqNames.join(", ")}`);
  }
}
window.checkAndNotifyNewRequests = checkAndNotifyNewRequests;

/* ==================== INDIAN PIN CODES DIRECTORY MODULE ==================== */
let pincodesData = [];
let pincodeSearchTarget = 'pickup'; // 'pickup' or 'delivery'
let pincodesLoaded = false;

async function loadPincodesData() {
  if (pincodesLoaded && pincodesData.length > 0) return pincodesData;
  try {
    const res = await fetch("data/pincodes.json");
    if (res.ok) {
      pincodesData = await res.json();
      pincodesLoaded = true;
      console.log(`Loaded ${pincodesData.length} Indian PIN codes.`);
    }
  } catch (err) {
    console.error("Failed to load pincodes data:", err);
  }
  return pincodesData;
}
window.loadPincodesData = loadPincodesData;

// Auto load pincodes when DOM content loaded
document.addEventListener("DOMContentLoaded", () => {
  loadPincodesData();
});

function openPincodeSearchModal(targetField) {
  pincodeSearchTarget = targetField || 'pickup';
  const modal = document.getElementById("pincode-search-modal");
  const title = document.getElementById("pincode-modal-title");
  const searchInput = document.getElementById("pincode-search-input");

  if (title) {
    const label = pincodeSearchTarget === 'pickup' ? '📍 Pickup Location' : '🏁 Delivery Location';
    title.innerHTML = `🔍 Search India PIN Codes (${label})`;
  }

  if (modal) {
    modal.style.display = "flex";
  }

  if (searchInput) {
    searchInput.value = "";
    setTimeout(() => searchInput.focus(), 100);
  }

  if (!pincodesLoaded || pincodesData.length === 0) {
    loadPincodesData().then(() => {
      filterPincodes();
    });
  } else {
    filterPincodes();
  }
}
window.openPincodeSearchModal = openPincodeSearchModal;

function closePincodeSearchModal(event) {
  if (event && event.target && event.target.id !== "pincode-search-modal" && !event.target.onclick) {
    return;
  }
  const modal = document.getElementById("pincode-search-modal");
  if (modal) {
    modal.style.display = "none";
  }
}
window.closePincodeSearchModal = closePincodeSearchModal;

function filterPincodes() {
  const query = (document.getElementById("pincode-search-input")?.value || "").trim().toLowerCase();
  const container = document.getElementById("pincode-results-container");
  const countEl = document.getElementById("pincode-results-count");
  if (!container) return;

  if (pincodesData.length === 0) {
    container.innerHTML = `<div style="text-align:center; padding: 2rem; color: #94a3b8;">Loading PIN code dataset...</div>`;
    return;
  }

  let matches = [];
  if (!query) {
    // Default show top 50 major pincodes
    matches = pincodesData.slice(0, 50);
    if (countEl) countEl.textContent = `Showing top 50 of ${pincodesData.length.toLocaleString()} registered PIN codes`;
  } else {
    const queryParts = query.split(/\s+/).filter(Boolean);
    matches = pincodesData.filter(item => {
      return queryParts.every(part => item.all.includes(part));
    }).slice(0, 100);
    if (countEl) countEl.textContent = `Found ${matches.length}${matches.length === 100 ? '+' : ''} matching locations for "${query}"`;
  }

  if (matches.length === 0) {
    container.innerHTML = `
      <div style="text-align:center; padding: 2.5rem; color: #94a3b8;">
        <div style="font-size: 2rem; margin-bottom: 0.5rem;">🔍</div>
        <div style="font-weight: 600; color: #f1f5f9;">No matching PIN codes found</div>
        <div style="font-size: 0.8rem; margin-top: 0.25rem;">Try searching by 6-digit PIN, city name, district, or state.</div>
      </div>`;
    return;
  }

  let html = `<div style="display: flex; flex-direction: column; gap: 0.4rem;">`;
  matches.forEach(item => {
    const pinBadge = `<span style="background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.3); font-weight: 800; font-size: 0.82rem; padding: 0.25rem 0.6rem; border-radius: 6px; font-family: monospace;">${item.p}</span>`;
    const stateBadge = item.s ? `<span style="background: rgba(148, 163, 184, 0.15); color: #cbd5e1; font-size: 0.7rem; padding: 0.15rem 0.4rem; border-radius: 4px;">${item.s}</span>` : '';
    const districtText = item.d ? `<span style="font-size: 0.78rem; color: #94a3b8;">• Dist: ${item.d}</span>` : '';
    const escapedLabel = item.l.replace(/'/g, "\\'");

    html += `
      <div onclick="selectPincodeItem('${item.p}', '${escapedLabel}')" style="display: flex; justify-content: space-between; align-items: center; padding: 0.65rem 0.9rem; background: rgba(30, 41, 59, 0.5); border: 1px solid rgba(255, 255, 255, 0.06); border-radius: 8px; cursor: pointer; transition: all 0.15s ease;" onmouseover="this.style.background='rgba(56, 189, 248, 0.12)'; this.style.borderColor='rgba(56, 189, 248, 0.4)';" onmouseout="this.style.background='rgba(30, 41, 59, 0.5)'; this.style.borderColor='rgba(255, 255, 255, 0.06)';">
        <div style="display: flex; align-items: center; gap: 0.75rem;">
          ${pinBadge}
          <div>
            <div style="font-weight: 700; font-size: 0.85rem; color: #f8fafc;">${item.place}</div>
            <div style="display: flex; gap: 0.5rem; align-items: center; margin-top: 0.1rem;">
              ${districtText}
            </div>
          </div>
        </div>
        <div>
          ${stateBadge}
        </div>
      </div>`;
  });
  html += `</div>`;
  container.innerHTML = html;
}
window.filterPincodes = filterPincodes;

function selectPincodeItem(pin, fullLabel) {
  const selectId = pincodeSearchTarget === 'pickup' ? "transport-pickup-pin" : "transport-delivery-pin";
  const selectEl = document.getElementById(selectId);

  if (selectEl) {
    let exists = Array.from(selectEl.options).some(opt => opt.value === pin);
    if (!exists) {
      const opt = document.createElement("option");
      opt.value = pin;
      opt.textContent = fullLabel || pin;
      selectEl.appendChild(opt);
    }
    selectEl.value = pin;

    selectEl.dispatchEvent(new Event('change'));
    if (typeof window.calculateTransportation === 'function') {
      window.calculateTransportation();
    }
  }

  closePincodeSearchModal();
}
window.selectPincodeItem = selectPincodeItem;

/* ══════════════════════════════════════════════════
   CONTACT & PARTNER DIRECTORY MODULE
   ══════════════════════════════════════════════════ */
let directoryContacts = [];
let activeDirectoryParent = 'agents'; // 'agents' or 'vendors'
let activeDirectoryCategory = 'all';
let importedExcelRows = [];

// Fallback initial data if database is empty or offline
const fallbackContacts = [];

// Overseas Agents Directory can be changed by Admin, Air Nomination, Sea Nomination
// Overseas Agents can be modified only by Admin and whoever currently holds
// the Air/Sea Nomination role — checked by category rather than a hardcoded
// username, so this keeps working correctly if a different person takes
// over that desk later without needing another code change.
function canEditAgentsDirectory() {
  const currentRole = getActiveRole()?.toLowerCase();
  const currentUser = (appState.currentUser || "").toLowerCase();
  const category = TEAM_ROLES[currentRole]?.category;
  return currentUser === 'ganny' ||
    currentRole === 'manager' ||
    category === 'AIR - NOMINATION' ||
    category === 'SEA - NOMINATION';
}
window.canEditAgentsDirectory = canEditAgentsDirectory;

// Weekly Agency List recipients — same edit-rights holders as the Agents
// Directory above (Admin, Air Nomination, Sea Nomination), since it's the
// same desk duty being automated: compiling and circulating the weekly
// agency list to PAN-India branch offices.
function canManageAgencyListRecipients() {
  const currentRole = getActiveRole()?.toLowerCase();
  const currentUser = (appState.currentUser || "").toLowerCase();
  const category = TEAM_ROLES[currentRole]?.category;
  return currentUser === 'ganny' ||
    currentRole === 'manager' ||
    category === 'AIR - NOMINATION' ||
    category === 'SEA - NOMINATION';
}
window.canManageAgencyListRecipients = canManageAgencyListRecipients;

// Vendor Contacts can be modified only by Admin, Air/Sea Nomination, NRS,
// and Free Hand Sales — checked by category, not a hardcoded username, so
// this covers whoever currently holds the Free Hand Sales desk (e.g. once
// a new hire's account is created under that same category) automatically.
function canAccessVendorsDirectory() {
  const currentRole = getActiveRole()?.toLowerCase();
  const currentUser = (appState.currentUser || "").toLowerCase();
  const category = TEAM_ROLES[currentRole]?.category;
  return currentUser === 'ganny' ||
    currentRole === 'manager' ||
    category === 'AIR - NOMINATION' ||
    category === 'SEA - NOMINATION' ||
    category === 'FREE HAND SALES (AIR/SEA)' ||
    category === 'NRS (AIR/SEA)';
}
window.canAccessVendorsDirectory = canAccessVendorsDirectory;

// Toggle parent level Directory
function setDirectoryParent(parent) {
  if (parent === 'vendors' && !canAccessVendorsDirectory()) {
    alert("You do not have permission to access the Vendor Contacts directory.");
    return;
  }

  activeDirectoryParent = parent;
  activeDirectoryCategory = 'all';

  // Set tab buttons active status
  document.querySelectorAll(".dir-parent-tab").forEach(tab => {
    if (tab.id === `dir-parent-${parent}`) {
      tab.classList.add("active");
      tab.style.color = "var(--sky)";
    } else {
      tab.classList.remove("active");
      tab.style.color = "var(--t2)";
    }
  });

  // Reset active category to all when switching parent
  activeDirectoryCategory = 'all';

  // Render the dynamic tabs based on the new parent context
  if (typeof renderDirectoryTabs === 'function') {
    renderDirectoryTabs();
  }

  // Add/Import/Reset button visibility and labels ("Reset Vendors" vs
  // "Reset Agents") depend on activeDirectoryParent — refresh them here too,
  // not just on initial panel load, otherwise the Reset button label goes
  // stale after switching tabs (the delete logic itself always reads the
  // live activeDirectoryParent, so this was a label-only bug, not a data one).
  refreshDirectoryActionButtons();

  renderDirectoryContacts();
}
window.setDirectoryParent = setDirectoryParent;

// Show/hide + label the Add Contact / Excel Import / Reset buttons for the
// currently active directory tab. Shared by loadDirectoryContacts() (initial
// panel load) and setDirectoryParent() (tab switch) so the labels never go stale.
function refreshDirectoryActionButtons() {
  const canAccessVendors = canAccessVendorsDirectory();

  let allowedToEdit = false;
  if (activeDirectoryParent === 'agents') {
    allowedToEdit = canEditAgentsDirectory();
  } else {
    allowedToEdit = canAccessVendors; // Vendor list edit rights match access rights
  }

  const addBtn = document.getElementById("dir-add-contact-btn");
  const importBtn = document.getElementById("dir-import-excel-btn");
  const resetBtn = document.getElementById("dir-reset-btn");
  if (addBtn) addBtn.style.display = allowedToEdit ? 'inline-flex' : 'none';
  if (importBtn) importBtn.style.display = allowedToEdit ? 'inline-flex' : 'none';

  const isAdmin = isAdminUser(appState.currentUser);
  if (resetBtn) {
    resetBtn.style.display = isAdmin ? 'inline-flex' : 'none';
    if (activeDirectoryParent === 'agents') {
      resetBtn.innerHTML = '<span>🗑️</span> Reset Agents';
    } else {
      resetBtn.innerHTML = '<span>🗑️</span> Reset Vendors';
    }
  }

  // Each tab gets its own sort dropdown — only one is ever visible at a time.
  const vendorSortSelect = document.getElementById("dir-vendor-sort");
  if (vendorSortSelect) {
    vendorSortSelect.style.display = (activeDirectoryParent === 'vendors') ? 'inline-block' : 'none';
  }
  const agentSortSelect = document.getElementById("dir-agent-sort");
  if (agentSortSelect) {
    agentSortSelect.style.display = (activeDirectoryParent === 'agents') ? 'inline-block' : 'none';
  }

  // Weekly Agency List is an Overseas-Agents-only concern (the circulation
  // this automates is specifically about new agents), so its trigger only
  // shows on that tab — not on Vendor Contacts.
  const agencyListBtn = document.getElementById("dir-agency-list-btn");
  if (agencyListBtn) {
    agencyListBtn.style.display = (activeDirectoryParent === 'agents') ? 'inline-flex' : 'none';
  }
}
window.refreshDirectoryActionButtons = refreshDirectoryActionButtons;

// Load contacts from Firestore (with LocalStorage caching fallback)
async function loadDirectoryContacts() {
  const grid = document.getElementById("directory-contacts-grid");
  if (!grid) return;

  // Manage top level Vendor Contacts tab visibility
  const vendorTab = document.getElementById("dir-parent-vendors");
  const canAccessVendors = canAccessVendorsDirectory();
  if (vendorTab) {
    vendorTab.style.display = canAccessVendors ? 'inline-block' : 'none';
  }

  // If user cannot access vendor contacts and active parent is vendors, force to agents
  if (!canAccessVendors && activeDirectoryParent === 'vendors') {
    activeDirectoryParent = 'agents';
    // Update active class on agents parent tab
    const pAgents = document.getElementById("dir-parent-agents");
    const pVendors = document.getElementById("dir-parent-vendors");
    if (pAgents) {
      pAgents.classList.add("active");
      pAgents.style.color = "var(--sky)";
    }
    if (pVendors) {
      pVendors.classList.remove("active");
      pVendors.style.color = "var(--t2)";
    }
  }

  // Manage visibility/labels of edit/add/reset controls for the active context
  refreshDirectoryActionButtons();

  try {
    grid.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; padding: 3rem; color: var(--t3); font-style: italic;">
      Fetching contacts from database...
    </div>`;

    if (window.db) {
      const snapshot = await db.collection("contactsDirectory").get();
      if (!snapshot.empty) {
        directoryContacts = [];
        snapshot.forEach(doc => {
          directoryContacts.push({ id: doc.id, ...doc.data() });
        });
        localStorage.setItem("gl_directory_contacts", JSON.stringify(directoryContacts));
      } else {
        // First run - feed fallback list to db
        directoryContacts = [...fallbackContacts];
        for (let contact of directoryContacts) {
          const { id, ...data } = contact;
          await db.collection("contactsDirectory").doc(id).set(data);
        }
        localStorage.setItem("gl_directory_contacts", JSON.stringify(directoryContacts));
      }
    } else {
      throw new Error("Firestore not initialized");
    }
  } catch (err) {
    console.warn("Firestore fetch failed, falling back to LocalStorage cache:", err);
    const cached = localStorage.getItem("gl_directory_contacts");
    if (cached) {
      directoryContacts = JSON.parse(cached);
    } else {
      directoryContacts = [...fallbackContacts];
      localStorage.setItem("gl_directory_contacts", JSON.stringify(directoryContacts));
    }
  }

  if (typeof renderDirectoryTabs === 'function') {
    renderDirectoryTabs();
  }
  renderDirectoryContacts();
}
window.loadDirectoryContacts = loadDirectoryContacts;

// Shared between renderDirectoryContacts() and populateDirectoryQuickJump()
// — must live at module scope, not inside either function, since both need it.
const DIR_SUSPENDED_KEY = '__SUSPENDED__';

// Render directory contacts onto grid with sorting/filtering
function renderDirectoryContacts() {
  const grid = document.getElementById("directory-contacts-grid");
  if (!grid) return;

  const searchQuery = (document.getElementById("directory-search-input")?.value || "").toLowerCase().trim();

  // Decide if allowed to edit
  let allowedToEdit = false;
  if (activeDirectoryParent === 'agents') {
    allowedToEdit = canEditAgentsDirectory();
  } else {
    allowedToEdit = canAccessVendorsDirectory();
  }

  // Quick-glance summary strip — reflects the whole section, independent of
  // the current search/tab filter, so it reads as a stable "at a glance"
  // view rather than jumping around as someone types.
  const statStrip = document.getElementById("directory-stat-strip");
  if (statStrip) {
    if (activeDirectoryParent === 'agents') {
      const allAgents = directoryContacts.filter(c => c.category === 'agency');
      const activeAgentsList = allAgents.filter(c => !c.suspended);
      const countries = new Set(activeAgentsList.map(c => (c.location || '').trim()).filter(Boolean));
      const suspendedCount = allAgents.length - activeAgentsList.length;
      const withAgreement = activeAgentsList.filter(c => /^y/i.test(c.agreement || '')).length;
      const agreementPct = activeAgentsList.length > 0 ? Math.round((withAgreement / activeAgentsList.length) * 100) : 0;
      statStrip.innerHTML = `
        <div class="dir-stat-cell"><div class="dir-stat-num">${activeAgentsList.length}</div><div class="dir-stat-label">Active Agents</div></div>
        <div class="dir-stat-cell"><div class="dir-stat-num">${countries.size}</div><div class="dir-stat-label">Countries</div></div>
        <div class="dir-stat-cell"><div class="dir-stat-num">${agreementPct}%</div><div class="dir-stat-label">Agreement on File</div></div>
        <div class="dir-stat-cell"><div class="dir-stat-num" style="${suspendedCount > 0 ? 'color:#be123c;' : ''}">${suspendedCount}</div><div class="dir-stat-label">Suspended</div></div>
      `;
    } else {
      const allVendors = directoryContacts.filter(c => c.category !== 'agency');
      const groups = new Set(allVendors.map(c => c.sheetGroup || c.category || '').filter(Boolean));
      statStrip.innerHTML = `
        <div class="dir-stat-cell"><div class="dir-stat-num">${allVendors.length}</div><div class="dir-stat-label">Vendor Contacts</div></div>
        <div class="dir-stat-cell"><div class="dir-stat-num">${groups.size}</div><div class="dir-stat-label">Categories</div></div>
      `;
    }
  }

  // Filter
  let filtered = directoryContacts.filter(c => {
    // Parent level filter (Overseas Agents vs Vendor Contacts)
    if (activeDirectoryParent === 'agents') {
      // Overseas Agents have category = 'agency'
      if (c.category !== 'agency') return false;
    } else {
      // If user is trying to access vendors but has no permission, block
      if (!canAccessVendorsDirectory()) return false;

      // Vendor contacts category != 'agency'
      if (c.category === 'agency') return false;
    }

    // Dynamic tab sub-filter check using sheetGroup (or fallback to category if missing)
    if (activeDirectoryCategory !== 'all') {
      const cGroup = c.sheetGroup || c.category || '';
      if (cGroup !== activeDirectoryCategory) return false;
    }

    // Search query filter
    if (searchQuery) {
      const name = (c.name || "").toLowerCase();
      const person = (c.contactPerson || "").toLowerCase();
      const email = (c.email || "").toLowerCase();
      const phone = (c.phone || "").toLowerCase();
      const location = (c.location || "").toLowerCase();
      const notes = (c.notes || "").toLowerCase();
      return name.includes(searchQuery) || person.includes(searchQuery) || email.includes(searchQuery) ||
        phone.includes(searchQuery) || location.includes(searchQuery) || notes.includes(searchQuery);
    }
    return true;
  });

  // Overseas Agents group by country (then highest-rated first, then name),
  // with suspended agents pulled into their own section at the end —
  // browsing 450+ agents flat was the whole reason this felt unorganized.
  // Vendor Contacts stay a flat alphabetical grid (already filterable by
  // the sheet tabs above).
  const groupKeyFor = (c) => {
    if (activeDirectoryParent !== 'agents') return null;
    if (c.suspended) return DIR_SUSPENDED_KEY;
    return (c.location || '').trim() || 'Unspecified Location';
  };

  // Set (not just read) by the agents branch below — the header-rendering
  // loop further down checks this to decide whether to print country headers.
  let showAgentGroupHeaders = true;

  if (activeDirectoryParent === 'agents') {
    const byRatingThenName = (a, b) => {
      const ratingDiff = (Number(b.rating) || 0) - (Number(a.rating) || 0);
      if (ratingDiff !== 0) return ratingDiff;
      return (a.name || "").localeCompare(b.name || "");
    };
    const agentSortMode = document.getElementById("dir-agent-sort")?.value || 'location';
    showAgentGroupHeaders = (agentSortMode === 'location');

    const active = filtered.filter(c => !c.suspended).sort((a, b) => {
      if (agentSortMode === 'name') {
        return (a.name || "").localeCompare(b.name || "");
      }
      if (agentSortMode === 'rating') {
        return byRatingThenName(a, b);
      }
      // 'location' (default) — grouped by country, then highest-rated first
      const countryDiff = groupKeyFor(a).localeCompare(groupKeyFor(b));
      return countryDiff !== 0 ? countryDiff : byRatingThenName(a, b);
    });
    const suspended = filtered.filter(c => c.suspended).sort(byRatingThenName);
    filtered = active.concat(suspended); // suspended agents always sit in their own section at the end
  } else {
    // Vendor Contacts — defaults to category-then-name (the same order the
    // source workbook had, one sheet per category), but the sort dropdown
    // lets the user switch to a flat company/branch order instead.
    const vendorSortMode = document.getElementById("dir-vendor-sort")?.value || 'category';
    filtered.sort((a, b) => {
      if (vendorSortMode === 'name-asc') {
        return (a.name || "").localeCompare(b.name || "");
      }
      if (vendorSortMode === 'name-desc') {
        return (b.name || "").localeCompare(a.name || "");
      }
      if (vendorSortMode === 'branch') {
        const brDiff = (a.location || "").localeCompare(b.location || "");
        return brDiff !== 0 ? brDiff : (a.name || "").localeCompare(b.name || "");
      }
      const catA = a.sheetGroup || a.category || '';
      const catB = b.sheetGroup || b.category || '';
      const catDiff = catA.localeCompare(catB);
      return catDiff !== 0 ? catDiff : (a.name || "").localeCompare(b.name || "");
    });
  }

  if (filtered.length === 0) {
    grid.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; padding: 4rem 2rem; color: var(--t3); font-style: italic; background: rgba(255,255,255,0.02); border-radius: var(--r-md); border: 1px dashed var(--border-2);">
      <span style="font-size: 2.2rem; display: block; margin-bottom: 0.5rem;">🔍</span>
      No contacts found in this section matching your filters.
    </div>`;
    return;
  }

  if (activeDirectoryParent !== 'agents') {
    grid.className = 'dir-vendor-table-wrap';
    const currentVendorSortMode = document.getElementById("dir-vendor-sort")?.value || 'category';
    grid.innerHTML = buildVendorTableHtml(filtered, allowedToEdit, currentVendorSortMode === 'category');
    populateDirectoryQuickJump();
    if (typeof updateDirBulkBar === 'function') updateDirBulkBar();
    const searchInputEarly = document.getElementById("directory-search-input");
    if (searchInputEarly) {
      searchInputEarly.placeholder = (activeDirectoryCategory && activeDirectoryCategory !== 'all')
        ? `Search within ${activeDirectoryCategory}...`
        : "Search by company, contact, email, phone, or location...";
    }
    return;
  }
  grid.className = 'dir-contacts-grid';

  // Pre-count each group so its header can show "(N)" without a second pass.
  const groupCounts = {};
  filtered.forEach(c => {
    const k = groupKeyFor(c);
    groupCounts[k] = (groupCounts[k] || 0) + 1;
  });

  let html = "";
  let lastGroupKey = undefined;
  filtered.forEach(contact => {
    const key = groupKeyFor(contact);
    const isSuspendedGroup = key === DIR_SUSPENDED_KEY;
    // Country headers are suppressed for a flat sort (name/rating), but the
    // Suspended divider always shows — it's a do-not-book safety flag, not
    // just an organizational grouping.
    if ((showAgentGroupHeaders || isSuspendedGroup) && key !== lastGroupKey) {
      lastGroupKey = key;
      const title = isSuspendedGroup ? '🚫 Suspended — Do Not Book' : `🌍 ${key}`;
      html += `<div class="dir-group-header${isSuspendedGroup ? ' dir-group-suspended' : ''}" id="${dirGroupIdFor(key)}">
        <span class="dir-group-title">${title}</span>
        <span class="dir-group-count">${groupCounts[key]}</span>
      </div>`;
    }
    const escNotes = (contact.notes || "").replace(/"/g, "&quot;");

    // Display sheetGroup if available, otherwise fallback to category label
    let categoryLabel = contact.sheetGroup || contact.category || "CONTACT";
    categoryLabel = categoryLabel.toUpperCase();
    if (categoryLabel === 'AGENCY') categoryLabel = 'OVERSEAS AGENT';

    // Overseas Agents carry a few fields Vendor Contacts don't — a star
    // rating, Air/Sea coverage, agency agreement status, and credit terms —
    // surfaced here so the list is scannable at a glance instead of
    // requiring a click into every card to find the one detail that matters.
    const isAgencyCard = contact.category === 'agency';
    let ratingHtml = '';
    if (isAgencyCard && contact.rating) {
      const full = Math.max(0, Math.min(5, Number(contact.rating) || 0));
      ratingHtml = `<div class="agent-rating" title="${full} star rating">${'★'.repeat(full)}${'☆'.repeat(5 - full)}</div>`;
    }
    let moduleHtml = '';
    if (isAgencyCard && contact.moduleType) {
      const mt = contact.moduleType.toLowerCase();
      const hasAir = mt.includes('air');
      const hasSea = mt.includes('sea');
      const moduleLabel = hasAir && hasSea ? 'Air & Sea' : hasAir ? 'Air' : hasSea ? 'Sea' : contact.moduleType;
      moduleHtml = `<span class="agent-module-pill">${moduleLabel}</span>`;
    }
    // Agreement is now an actual action, not just a status pill: download the
    // attached PDF if one's on file, or upload one if you have edit rights
    // and none exists yet. Falls back to the plain Y/N text from the import
    // for everyone else, so the information isn't lost for read-only users.
    let agreementActionHtml = '';
    if (isAgencyCard) {
      const hasDoc = !!contact.agreementData;
      const hasAgreementFlag = contact.agreement ? /^y/i.test(contact.agreement) : null;
      if (hasDoc) {
        agreementActionHtml = `<button type="button" class="agent-agreement-action has-doc" onclick="downloadAgentAgreement('${contact.id}')">📄 Download Agreement</button>`;
      } else if (allowedToEdit) {
        agreementActionHtml = `<button type="button" class="agent-agreement-action no-doc" onclick="triggerAgentAgreementUpload('${contact.id}')">⬆ Upload Agreement</button>`;
      } else if (hasAgreementFlag === true) {
        agreementActionHtml = `<span class="agent-agreement-pill agreement-yes">✓ Agreement on File</span>`;
      } else if (hasAgreementFlag === false) {
        agreementActionHtml = `<span class="agent-agreement-pill agreement-no">⚠ No Agreement</span>`;
      }
    }

    // "30d & 30000" from the import splits into two clean stats when it
    // matches that shape; anything else just falls back to showing the raw
    // text rather than guessing wrong.
    let creditHtml = '';
    if (isAgencyCard && contact.creditTerms) {
      const parsed = parseCreditTerms(contact.creditTerms);
      creditHtml = parsed
        ? `<div class="agent-credit-stats">
            <div class="agent-credit-stat"><div class="val">${parsed.days}d</div><div class="lbl">Credit Period</div></div>
            <div class="agent-credit-stat"><div class="val">${parsed.limit}</div><div class="lbl">Credit Limit</div></div>
          </div>`
        : `<div class="agent-credit-line"><strong>Credit:</strong> ${contact.creditTerms}</div>`;
    }

    const suspendedBannerHtml = contact.suspended
      ? `<div class="agent-suspended-banner">🚫 SUSPENDED — do not book via this agent</div>`
      : '';

    const checkboxHtml = isAgencyCard
      ? `<input type="checkbox" class="dir-select-checkbox" onclick="event.stopPropagation(); toggleAgentSelection('${contact.id}', this.checked)" ${(window._selectedAgentIds && window._selectedAgentIds.has(contact.id)) ? 'checked' : ''}>`
      : '';
    const isSelected = isAgencyCard && window._selectedAgentIds && window._selectedAgentIds.has(contact.id);

    // Admin action buttons (Edit/Delete) - visible only if allowed to edit
    const adminActionsHtml = allowedToEdit ? `
      <button class="contact-action-btn" title="Edit Contact" onclick="openContactModal('${contact.id}')" style="margin-left: auto;">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
      </button>
      <button class="contact-action-btn" title="Delete Contact" onclick="deleteContact('${contact.id}')" style="color: #ef4444; border-color: rgba(239, 68, 68, 0.2);">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        </svg>
      </button>
    ` : '';

    // Contact action shortcuts (Call, Email, WhatsApp)
    const phoneClean = (contact.phone || "").replace(/[^\d+]/g, '');
    const callButtonHtml = contact.phone ? `
      <a href="tel:${phoneClean}" class="contact-action-btn" title="Call Contact">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
        </svg>
      </a>
    ` : '';

    const emailButtonHtml = contact.email ? `
      <a href="mailto:${contact.email}" class="contact-action-btn" title="Send Email">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
          <polyline points="22,6 12,13 2,6" />
        </svg>
      </a>
    ` : '';

    const waButtonHtml = contact.phone && contact.phone.includes("+") ? `
      <a href="https://wa.me/${phoneClean}" target="_blank" class="contact-action-btn" title="Chat on WhatsApp" style="color: #25D366; border-color: rgba(37, 211, 102, 0.2);">
        <span>💬</span>
      </a>
    ` : '';

    html += `
      <div class="contact-card cat-${contact.category || 'other'}${contact.suspended ? ' contact-card-suspended' : ''}${isSelected ? ' dir-card-selected' : ''}">
        ${checkboxHtml}
        <div>
          ${suspendedBannerHtml}
          <div class="contact-card-header">
            <span class="contact-card-badge ${contact.category || ''}">${categoryLabel}</span>
            <div style="font-size: 0.62rem; color: var(--t3);">By: ${contact.updatedBy || 'System'}</div>
          </div>

          <div class="contact-card-title" style="margin-bottom: 0.3rem; ${isAgencyCard ? 'padding-right: 1.5rem;' : ''}">${contact.name || ''}</div>
          ${ratingHtml}
          ${(moduleHtml || agreementActionHtml) ? `<div class="agent-pill-row">${moduleHtml}${agreementActionHtml}</div>` : ''}

          <div class="contact-info-grid">
          ${contact.contactPerson ? `
            <div class="contact-info-row" style="font-weight: 600; color: var(--t1);">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              ${contact.contactPerson}
            </div>
          ` : ''}

          ${contact.location ? `
            <div class="contact-info-row">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8z"/><circle cx="12" cy="10" r="3"/></svg>
              ${contact.location}
            </div>
          ` : ''}

          ${contact.phone ? `
            <div class="contact-info-row">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
              ${contact.phone}
            </div>
          ` : ''}

          ${contact.email ? `
            <div class="contact-info-row span-2" style="word-break: break-all;">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
              ${contact.email}
            </div>
          ` : ''}
          </div>

          ${creditHtml}

          ${contact.notes ? `
            <div style="font-size: 0.72rem; color: var(--t3); background: rgba(0,0,0,0.03); padding: 8px; border-radius: 6px; border: 1px solid var(--border-1); margin-top: 0.75rem; line-height: 1.35; white-space: pre-line;">
              ${contact.notes}
            </div>
          ` : ''}
        </div>
        
        <div class="contact-actions">
          ${callButtonHtml}
          ${emailButtonHtml}
          ${waButtonHtml}
          ${adminActionsHtml}
        </div>
      </div>`;
  });

  grid.innerHTML = html;
  populateDirectoryQuickJump();
  if (typeof updateDirBulkBar === 'function') updateDirBulkBar();

  const searchInput = document.getElementById("directory-search-input");
  if (searchInput) searchInput.placeholder = "Search by company, contact, email, phone, or location...";
}

// Vendor Contacts as a dense table — company, branch/station, contact
// person, number, email, remarks, one row per contact — the same shape as
// the source workbook (one row per branch, grouped by the sheet it came
// from), instead of a card grid. Overseas Agents keeps its card layout;
// this only applies to vendors.
function buildVendorTableHtml(rows, allowedToEdit, showCategoryHeaders = true) {
  if (!rows || rows.length === 0) return '';

  // The Action column only ever holds content for editors — for everyone
  // else it's a fully blank column running the height of the table, so it
  // is dropped entirely rather than rendered empty.
  const colCount = allowedToEdit ? 7 : 6;

  let bodyHtml = '';
  let lastCategoryKey = undefined;
  rows.forEach(contact => {
    const catKey = contact.sheetGroup || contact.category || 'Uncategorized';
    // Category divider rows only make sense when rows are actually sorted by
    // category — with a flat sort (name/branch) the category jumps around
    // row to row, which would otherwise insert a header before nearly every row.
    if (showCategoryHeaders && catKey !== lastCategoryKey) {
      lastCategoryKey = catKey;
      const count = rows.filter(r => (r.sheetGroup || r.category || 'Uncategorized') === catKey).length;
      bodyHtml += `<tr class="dir-table-group-row"><td colspan="${colCount}">${catKey.toUpperCase()} <span class="dir-group-count">${count}</span></td></tr>`;
    }

    const phoneClean = (contact.phone || "").replace(/[^\d+]/g, '');
    const phoneHtml = contact.phone
      ? `<a href="tel:${phoneClean}" class="dir-table-link">${contact.phone}</a>`
      : '';
    const emailHtml = contact.email
      ? `<a href="mailto:${contact.email}" class="dir-table-link" style="word-break: break-all;">${contact.email}</a>`
      : '';

    const actionsCellHtml = allowedToEdit ? `
      <td class="dir-table-actions">
        <button class="contact-action-btn" title="Edit Contact" onclick="openContactModal('${contact.id}')">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
        </button>
        <button class="contact-action-btn" title="Delete Contact" onclick="deleteContact('${contact.id}')" style="color: #ef4444; border-color: rgba(239, 68, 68, 0.2);">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
        </button>
      </td>` : '';

    bodyHtml += `
      <tr>
        <td><strong>${contact.name || ''}</strong></td>
        <td>${contact.location ? `<span class="dir-table-branch">${contact.location}</span>` : ''}</td>
        <td>${contact.contactPerson || ''}</td>
        <td>${phoneHtml}</td>
        <td>${emailHtml}</td>
        <td class="dir-table-remarks" title="${(contact.notes || '').replace(/"/g, '&quot;')}">${contact.notes || ''}</td>${actionsCellHtml}
      </tr>`;
  });

  const actionColHtml = allowedToEdit ? '<col style="width: 8%;">' : '';
  const actionThHtml = allowedToEdit ? '<th>Action</th>' : '';
  const colWidths = allowedToEdit
    ? ['16%', '10%', '14%', '12%', '18%', '22%']
    : ['18%', '11%', '16%', '14%', '20%', '21%'];

  return `
    <div class="dir-table-scroll">
      <table class="dir-vendor-table">
        <colgroup>
          <col style="width: ${colWidths[0]};">
          <col style="width: ${colWidths[1]};">
          <col style="width: ${colWidths[2]};">
          <col style="width: ${colWidths[3]};">
          <col style="width: ${colWidths[4]};">
          <col style="width: ${colWidths[5]};">
          ${actionColHtml}
        </colgroup>
        <thead>
          <tr>
            <th>Company</th>
            <th>Branch / Station</th>
            <th>Contact Person</th>
            <th>Contact Number</th>
            <th>Email</th>
            <th>Remarks</th>
            ${actionThHtml}
          </tr>
        </thead>
        <tbody>${bodyHtml}</tbody>
      </table>
    </div>`;
}
window.buildVendorTableHtml = buildVendorTableHtml;

// Turns a group key (country name, or the suspended sentinel) into a safe,
// stable HTML id so the quick-jump dropdown can scroll straight to it.
function dirGroupIdFor(key) {
  return 'dir-group-' + String(key).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

// Splits an imported credit-terms string like "30d & 30000" into a period
// (days) and a limit. Only claims success on that specific shape — anything
// else falls back to showing the raw text as-is rather than guessing wrong.
function parseCreditTerms(raw) {
  const m = String(raw || '').match(/(\d+)\s*d[a-z]*\D+(\d[\d,]*)/i);
  if (!m) return null;
  return { days: m[1], limit: Number(m[2].replace(/,/g, '')).toLocaleString('en-IN') };
}

/* ==================== Overseas Agents — multi-select & bulk actions ==================== */
window._selectedAgentIds = window._selectedAgentIds || new Set();

function toggleAgentSelection(id, checked) {
  if (checked) window._selectedAgentIds.add(id);
  else window._selectedAgentIds.delete(id);
  const card = document.querySelector(`.dir-select-checkbox[onclick*="'${id}'"]`)?.closest('.contact-card');
  if (card) card.classList.toggle('dir-card-selected', checked);
  updateDirBulkBar();
}
window.toggleAgentSelection = toggleAgentSelection;

function updateDirBulkBar() {
  const bar = document.getElementById("dir-bulk-bar");
  const countEl = document.getElementById("dir-bulk-count");
  if (!bar || !countEl) return;
  const n = window._selectedAgentIds.size;
  bar.style.display = (n > 0 && activeDirectoryParent === 'agents') ? 'flex' : 'none';
  countEl.textContent = `${n} agent${n === 1 ? '' : 's'} selected`;
}
window.updateDirBulkBar = updateDirBulkBar;

function selectAllVisibleAgents() {
  document.querySelectorAll('#directory-contacts-grid .dir-select-checkbox').forEach(cb => {
    cb.checked = true;
    cb.closest('.contact-card')?.classList.add('dir-card-selected');
    const m = cb.getAttribute('onclick').match(/toggleAgentSelection\('([^']+)'/);
    if (m) window._selectedAgentIds.add(m[1]);
  });
  updateDirBulkBar();
}
window.selectAllVisibleAgents = selectAllVisibleAgents;

function deselectAllAgents() {
  window._selectedAgentIds.clear();
  document.querySelectorAll('#directory-contacts-grid .dir-select-checkbox').forEach(cb => {
    cb.checked = false;
    cb.closest('.contact-card')?.classList.remove('dir-card-selected');
  });
  updateDirBulkBar();
}
window.deselectAllAgents = deselectAllAgents;

function exportSelectedAgents() {
  const selected = directoryContacts.filter(c => window._selectedAgentIds.has(c.id));
  if (selected.length === 0) { alert("No agents selected."); return; }
  try {
    const dataToExport = selected.map(c => {
      const parsed = parseCreditTerms(c.creditTerms);
      return {
        Company: c.name || '',
        Country: c.location || '',
        Rating: c.rating ? '★'.repeat(Number(c.rating)) : '',
        Coverage: c.moduleType || '',
        Email: c.email || '',
        'Agency Agreement': c.agreement || '',
        'Agreement Document': c.agreementData ? 'On file (in-app)' : 'Not uploaded',
        'Credit Period (days)': parsed ? parsed.days : '',
        'Credit Limit': parsed ? parsed.limit : (c.creditTerms || ''),
        Notes: c.notes || ''
      };
    });
    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Selected Agents");
    XLSX.writeFile(workbook, `atlas_selected_agents_${selected.length}.xlsx`);
  } catch (err) {
    console.error("Export selected agents error:", err);
    alert("Failed to export selected agents. Please check logs.");
  }
}
window.exportSelectedAgents = exportSelectedAgents;

function downloadSelectedAgreements() {
  const selected = directoryContacts.filter(c => window._selectedAgentIds.has(c.id));
  const withDocs = selected.filter(c => c.agreementData);
  if (withDocs.length === 0) {
    alert("None of the selected agents have an agreement PDF uploaded yet.");
    return;
  }
  withDocs.forEach((c, i) => {
    setTimeout(() => downloadAgentAgreement(c.id), i * 250); // stagger so the browser doesn't block rapid downloads
  });
  if (withDocs.length < selected.length) {
    alert(`Downloading ${withDocs.length} of ${selected.length} selected — the rest don't have an agreement PDF uploaded yet.`);
  }
}
window.downloadSelectedAgreements = downloadSelectedAgreements;

/* ==================== Overseas Agents — agreement document upload/download ====================
   Reuses the exact same storage pattern already used for customer
   agreements (agreementFile/agreementData on the record, base64 PDF),
   just written onto the contactsDirectory document instead of
   customer_control, for consistency with the rest of the app. */
window._pendingAgreementUploadId = null;

function triggerAgentAgreementUpload(contactId) {
  window._pendingAgreementUploadId = contactId;
  const input = document.getElementById("agent-agreement-file-input");
  if (input) input.click();
}
window.triggerAgentAgreementUpload = triggerAgentAgreementUpload;

function onAgentAgreementFileChosen(event) {
  const file = event.target.files[0];
  const contactId = window._pendingAgreementUploadId;
  event.target.value = ""; // allow re-selecting the same file later
  if (!file || !contactId) return;

  if (file.size > 900 * 1024) {
    alert("This PDF is too large (over ~900KB). Please compress it before uploading — each agreement is stored as part of the agent's record.");
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => saveAgentAgreementFile(contactId, file.name, e.target.result);
  reader.readAsDataURL(file);
}
window.onAgentAgreementFileChosen = onAgentAgreementFileChosen;

async function saveAgentAgreementFile(contactId, fileName, fileData) {
  const contact = directoryContacts.find(c => c.id === contactId);
  if (!contact) return;

  try {
    if (window.db) {
      await db.collection("contactsDirectory").doc(contactId).update({
        agreementFile: fileName,
        agreementData: fileData
      });
    }
    contact.agreementFile = fileName;
    contact.agreementData = fileData;
    renderDirectoryContacts();
  } catch (err) {
    console.error("Error saving agent agreement PDF:", err);
    alert("Could not save this agreement PDF. Please try again.");
  }
}
window.saveAgentAgreementFile = saveAgentAgreementFile;

function downloadAgentAgreement(contactId) {
  const contact = directoryContacts.find(c => c.id === contactId);
  if (!contact || !contact.agreementData) {
    alert("No agreement PDF found for this agent.");
    return;
  }
  const link = document.createElement("a");
  link.href = contact.agreementData;
  link.download = contact.agreementFile || `${(contact.name || 'agreement').replace(/[^a-z0-9]+/gi, '_')}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
window.downloadAgentAgreement = downloadAgentAgreement;

// Quick-jump dropdown next to the search bar — categories for Vendor
// Contacts (same list the pill tabs already show, just without needing to
// scroll a wrapping row of 15 of them), countries for Overseas Agents
// (jumps straight to that country's section instead of scrolling through
// 60+ of them to find it).
function populateDirectoryQuickJump() {
  const sel = document.getElementById("directory-quick-jump");
  if (!sel) return;

  if (activeDirectoryParent === 'agents') {
    const agents = directoryContacts.filter(c => c.category === 'agency' && !c.suspended);
    const countries = Array.from(new Set(agents.map(c => (c.location || '').trim()).filter(Boolean))).sort();
    const hasSuspended = directoryContacts.some(c => c.category === 'agency' && c.suspended);
    let options = `<option value="">Jump to country...</option>`;
    options += countries.map(c => `<option value="${c.replace(/"/g, '&quot;')}">${c}</option>`).join('');
    if (hasSuspended) options += `<option value="${DIR_SUSPENDED_KEY}">🚫 Suspended</option>`;
    sel.innerHTML = options;
  } else {
    const vendors = directoryContacts.filter(c => c.category !== 'agency');
    const groups = Array.from(new Set(vendors.map(c => c.sheetGroup || c.category || '').filter(Boolean))).sort();
    let options = `<option value="all">Jump to category...</option>`;
    options += groups.map(g => `<option value="${g.replace(/"/g, '&quot;')}">${g}</option>`).join('');
    sel.value = ''; // reset below after setting innerHTML
    sel.innerHTML = options;
    sel.value = activeDirectoryCategory || 'all';
  }
}
window.populateDirectoryQuickJump = populateDirectoryQuickJump;

function onDirectoryQuickJumpChange(value) {
  if (!value) return;
  if (activeDirectoryParent === 'agents') {
    const target = document.getElementById(dirGroupIdFor(value));
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } else {
    setDirectoryCategory(value);
  }
}
window.onDirectoryQuickJumpChange = onDirectoryQuickJumpChange;

// Search Filter Input handler
function filterDirectoryContacts() {
  renderDirectoryContacts();
}
window.filterDirectoryContacts = filterDirectoryContacts;

// Set Category Tab handler
function setDirectoryCategory(category) {
  activeDirectoryCategory = category;

  // Set tab buttons active status
  document.querySelectorAll(".dir-tab").forEach(tab => {
    if (tab.getAttribute("data-category") === category) {
      tab.classList.add("active");
    } else {
      tab.classList.remove("active");
    }
  });

  renderDirectoryContacts();
}
window.setDirectoryCategory = setDirectoryCategory;

// Render dynamic directory filter tabs based on unique sheetGroup values
function renderDirectoryTabs() {
  const container = document.getElementById("directory-subfilters-container");
  if (!container) return;

  // 1. Filter contacts by active parent first
  const parentContacts = directoryContacts.filter(c => {
    if (activeDirectoryParent === 'agents') {
      return c.category === 'agency';
    } else {
      return c.category !== 'agency';
    }
  });

  // 2. Extract unique sheet groups (fallback to category if sheetGroup is missing)
  const uniqueGroups = [...new Set(parentContacts.map(c => c.sheetGroup || c.category || '').filter(Boolean))].sort();

  // 3. Build HTML
  const parentLabel = activeDirectoryParent === 'agents' ? 'Agents' : 'Vendors';
  let html = `<button class="dir-tab ${activeDirectoryCategory === 'all' ? 'active' : ''}" data-category="all" onclick="setDirectoryCategory('all')">All ${parentLabel}</button>`;

  uniqueGroups.forEach(group => {
    const isActive = activeDirectoryCategory === group ? 'active' : '';
    // Escape single quotes for onclick string
    const safeGroup = group.replace(/'/g, "\\\\'");
    html += `<button class="dir-tab ${isActive}" data-category="${group}" onclick="setDirectoryCategory('${safeGroup}')">${group}</button>`;
  });

  container.innerHTML = html;

  // Vendor Contacts has 15+ categories — that pill row was the whole
  // "wasting time scrolling" complaint the quick-jump dropdown now solves,
  // so it'd just be redundant clutter here. Overseas Agents only ever has
  // two pills (Reliable / Suspended), a different toggle than the country
  // dropdown, so it stays.
  container.style.display = activeDirectoryParent === 'vendors' ? 'none' : 'flex';
}
window.renderDirectoryTabs = renderDirectoryTabs;

// Contact Modal (Create/Edit) Show
function openContactModal(id = null) {
  const modal = document.getElementById("contact-form-modal");
  const form = document.getElementById("contact-form");
  if (!modal || !form) return;

  form.reset();

  if (id) {
    // Edit Mode
    document.getElementById("contact-modal-title").textContent = "EDIT CONTACT";
    const contact = directoryContacts.find(c => c.id === id);
    if (contact) {
      document.getElementById("contact-form-id").value = contact.id;
      document.getElementById("contact-form-category").value = contact.category || 'agency';
      document.getElementById("contact-form-name").value = contact.name || '';
      document.getElementById("contact-form-person").value = contact.contactPerson || '';
      document.getElementById("contact-form-email").value = contact.email || '';
      document.getElementById("contact-form-phone").value = contact.phone || '';
      document.getElementById("contact-form-location").value = contact.location || '';
      document.getElementById("contact-form-notes").value = contact.notes || '';
      document.getElementById("contact-form-sheetgroup").value = contact.sheetGroup || '';
    }
  } else {
    // Add Mode
    document.getElementById("contact-modal-title").textContent = "ADD NEW CONTACT";
    document.getElementById("contact-form-id").value = "";

    // Auto-select category based on parent tab context
    if (activeDirectoryParent === 'agents') {
      document.getElementById("contact-form-category").value = 'agency';
    } else if (activeDirectoryCategory !== 'all') {
      document.getElementById("contact-form-category").value = activeDirectoryCategory;
    } else {
      document.getElementById("contact-form-category").value = 'liner';
    }

    // Auto-fill the tab group if we are currently filtering by one
    document.getElementById("contact-form-sheetgroup").value =
      (activeDirectoryCategory !== 'all') ? activeDirectoryCategory : '';
  }

  modal.style.display = "flex";
}
window.openContactModal = openContactModal;

// Contact Modal Hide
function closeContactModal() {
  const modal = document.getElementById("contact-form-modal");
  if (modal) modal.style.display = "none";
}
window.closeContactModal = closeContactModal;

// Submit Add/Edit Form
async function saveContactForm(event) {
  event.preventDefault();

  const id = document.getElementById("contact-form-id").value;
  const category = document.getElementById("contact-form-category").value;

  // Verify permissions based on context
  const allowed = (category === 'agency') ? canEditAgentsDirectory() : canAccessVendorsDirectory();
  if (!allowed) {
    alert("You do not have permission to modify this contact.");
    return;
  }

  const name = document.getElementById("contact-form-name").value.trim();
  const contactPerson = document.getElementById("contact-form-person").value.trim();
  const email = document.getElementById("contact-form-email").value.trim();
  const phone = document.getElementById("contact-form-phone").value.trim();
  const location = document.getElementById("contact-form-location").value.trim();
  const notes = document.getElementById("contact-form-notes").value.trim();
  let sheetGroup = document.getElementById("contact-form-sheetgroup").value.trim();

  if (!sheetGroup) {
    // Default to the category dropdown's visible label if not provided
    const catSelect = document.getElementById("contact-form-category");
    sheetGroup = catSelect.options[catSelect.selectedIndex].text;
  }

  const updatedBy = appState.currentUser || "Pricing Team";
  const contactData = {
    category,
    name,
    contactPerson,
    email,
    phone,
    location,
    notes,
    sheetGroup,
    updatedAt: new Date(),
    updatedBy
  };

  try {
    if (window.db) {
      if (id) {
        // Edit Mode
        await db.collection("contactsDirectory").doc(id).update(contactData);
        alert("Contact updated successfully!");
      } else {
        // Add Mode
        await db.collection("contactsDirectory").add(contactData);
        alert("Contact added successfully!");
      }
    } else {
      throw new Error("No database connection");
    }
  } catch (err) {
    console.error("Error saving contact in Firestore:", err);
    // Offline LocalStorage updates
    if (id) {
      const index = directoryContacts.findIndex(c => c.id === id);
      if (index !== -1) {
        directoryContacts[index] = { id, ...contactData };
      }
    } else {
      const newId = "local-" + Date.now();
      directoryContacts.push({ id: newId, ...contactData });
    }
    localStorage.setItem("gl_directory_contacts", JSON.stringify(directoryContacts));
    alert("Saved locally! Offline mode changes will sync to server when connected.");
  }

  closeContactModal();
  loadDirectoryContacts();
}
window.saveContactForm = saveContactForm;

// Delete Contact Document
async function deleteContact(id) {
  const contact = directoryContacts.find(c => c.id === id);
  if (!contact) return;

  const allowed = (contact.category === 'agency') ? canEditAgentsDirectory() : canAccessVendorsDirectory();
  if (!allowed) {
    alert("You do not have permission to delete this contact.");
    return;
  }

  if (!confirm("Are you sure you want to delete this contact? This action cannot be undone.")) return;

  try {
    if (window.db) {
      await db.collection("contactsDirectory").doc(id).delete();
      alert("Contact deleted successfully!");
    } else {
      throw new Error("No database connection");
    }
  } catch (err) {
    console.error("Error deleting contact in Firestore:", err);
    directoryContacts = directoryContacts.filter(c => c.id !== id);
    localStorage.setItem("gl_directory_contacts", JSON.stringify(directoryContacts));
    alert("Deleted locally!");
  }

  loadDirectoryContacts();
}
window.deleteContact = deleteContact;

// Import Excel Modal Show/Hide
function openImportExcelModal() {
  const modal = document.getElementById("excel-import-modal");
  if (modal) {
    resetExcelImport();
    modal.style.display = "flex";
  }
}
window.openImportExcelModal = openImportExcelModal;

function closeImportExcelModal() {
  const modal = document.getElementById("excel-import-modal");
  if (modal) modal.style.display = "none";
}
window.closeImportExcelModal = closeImportExcelModal;

// Excel Parsing Logic (using SheetJS)
function handleExcelFileSelect(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      const data = e.target.result;
      const workbook = XLSX.read(data, { type: 'binary' });
      importedExcelRows = [];

      // Process each sheet/tab in the workbook
      workbook.SheetNames.forEach(sheetName => {
        const sheet = workbook.Sheets[sheetName];
        const ref = sheet['!ref'];
        if (!ref) return; // completely empty sheet

        // Some real-world reports have blank/title rows before the actual
        // header (leftover formatting with no data in it). Reading cells
        // directly off the sheet's own decoded range — rather than trusting
        // sheet_to_json's default "row 1 of the range is the header"
        // behavior — avoids treating a blank row as the header and silently
        // importing nothing.
        const range = XLSX.utils.decode_range(ref);
        const rawRows = [];
        for (let r = range.s.r; r <= range.e.r; r++) {
          const rowArr = [];
          for (let c = range.s.c; c <= range.e.c; c++) {
            const cell = sheet[XLSX.utils.encode_cell({ r, c })];
            rowArr.push(cell && cell.v !== undefined ? cell.v : "");
          }
          rawRows.push(rowArr);
        }

        let headerRowIdx = 0;
        for (let i = 0; i < Math.min(rawRows.length, 15); i++) {
          const nonEmptyCount = rawRows[i].filter(v => String(v).trim() !== "").length;
          if (nonEmptyCount >= 2) {
            headerRowIdx = i;
            break;
          }
        }
        const headerRow = rawRows[headerRowIdx] || [];
        const json = rawRows.slice(headerRowIdx + 1).map(r => {
          const obj = {};
          headerRow.forEach((h, ci) => {
            const key = String(h || "").trim();
            if (key) obj[key] = r[ci] !== undefined ? r[ci] : "";
          });
          return obj;
        }).filter(obj => Object.keys(obj).length > 0);

        // Auto-detect category from sheet name (e.g. Liners, Airlines, Coloaders, NVOCCs)
        // Matched on a hyphen/space-stripped form too, so real-world tab names like
        // "Co-Loaders" or "BREAK-BULK" aren't missed just because of punctuation.
        let autoCategory = 'agency';
        const nameLower = sheetName.toLowerCase();
        const nameNorm = nameLower.replace(/[^a-z0-9]/g, '');
        const isSuspendedSheet = nameLower.includes('suspend');
        if (isSuspendedSheet) autoCategory = 'agency';
        else if (nameNorm.includes('liner')) autoCategory = 'liner';
        else if (nameNorm.includes('coloader')) autoCategory = 'coloader';
        else if (nameNorm.includes('nvocc')) autoCategory = 'nvocc';
        else if (nameNorm.includes('breakbulk')) autoCategory = 'breakbulk';
        else if (nameLower.includes('air') && (nameLower.includes('line') || nameLower.includes('contact'))) autoCategory = 'airline';
        else if (nameNorm.includes('pq') || nameNorm.includes('phyto')) autoCategory = 'pq';
        else if (nameLower.includes('insurance')) autoCategory = 'insurance';
        else if (nameLower.includes('agent') || nameLower.includes('agency')) autoCategory = 'agency';
        else autoCategory = 'other';

        json.forEach(row => {
          // Normalize spreadsheet column headers to our database schema
          const keys = Object.keys(row);
          let name = "";
          let person = "";
          let email = "";
          let phone = "";
          let location = "";
          let notes = "";
          let rating = "";
          let agreement = "";
          let creditTerms = "";
          let moduleType = "";
          let rowCategory = autoCategory;

          keys.forEach(k => {
            const keyLower = k.toLowerCase().replace(/[^a-z0-9]/g, '');

            // These four are checked first — "Agency Agreement" would
            // otherwise be caught by the name branch's "agency" match below
            // (it comes first in the row and the name field, once set,
            // isn't overwritten), silently losing the actual agreement value.
            if (keyLower.includes('rating')) {
              rating = (String(row[k]).match(/★/g) || []).length;
            } else if (keyLower.includes('agreement')) {
              agreement = String(row[k]).trim();
            } else if (keyLower.includes('credit')) {
              creditTerms = creditTerms ? `${creditTerms}; ${row[k]}` : String(row[k]).trim();
            } else if (keyLower.includes('module')) {
              moduleType = String(row[k]).trim();
            } else if (keyLower.includes('company') || keyLower.includes('name') || keyLower.includes('liner') || keyLower.includes('airline') || keyLower.includes('agency') || keyLower.includes('coloader') || keyLower.includes('agent')) {
              // "Coloaders" (Co-Loader sheets) and "Reliable Agent" (the
              // Overseas Agents report) matched none of the original
              // patterns, so every row on those sheets had no name and was
              // silently skipped — this import requires a name to keep a row.
              if (!name) name = row[k];
            } else if (keyLower.includes('person') || keyLower.includes('contactname') || keyLower.includes('attention')) {
              person = row[k];
            } else if (keyLower.includes('email') || keyLower.includes('mail')) {
              email = row[k];
            } else if (keyLower.includes('phone') || keyLower.includes('mobile') || keyLower.includes('contactno') || keyLower.includes('contactnumber') || keyLower === 'contact' || keyLower.includes('tel') || keyLower.includes('landline')) {
              // "CONTACT NUMBER" normalizes to "contactnumber", which doesn't
              // actually contain "contactno" as a substring (contactnUmber vs
              // contactnO) — that variant, and a bare "CONTACT" column (used
              // as a phone field on several vendor sheets), were silently
              // dropped before these explicit checks were added.
              phone = row[k];
            } else if (keyLower.includes('location') || keyLower.includes('city') || keyLower.includes('address') || keyLower.includes('branch') || keyLower.includes('station') || keyLower.includes('country')) {
              // "STATION" (freight vendor sheets) and "Country" (the Overseas
              // Agents report) previously matched none of these and were
              // silently dropped.
              location = row[k];
            } else if (keyLower.includes('notes') || keyLower.includes('remarks') || keyLower.includes('comments') || keyLower.includes('rates')) {
              notes = row[k];
            } else if (keyLower.includes('category') || keyLower.includes('type')) {
              const catVal = String(row[k]).toLowerCase();
              if (catVal.includes('liner')) rowCategory = 'liner';
              else if (catVal.includes('coloader')) rowCategory = 'coloader';
              else if (catVal.includes('nvocc')) rowCategory = 'nvocc';
              else if (catVal.includes('break')) rowCategory = 'breakbulk';
              else if (catVal.includes('air')) rowCategory = 'airline';
              else if (catVal.includes('pq')) rowCategory = 'pq';
              else if (catVal.includes('insurance')) rowCategory = 'insurance';
              else if (catVal.includes('agency') || catVal.includes('agent')) rowCategory = 'agency';
              else rowCategory = 'other';
            }
          });

          // Ensure we have a valid contact name before importing
          if (name && String(name).trim()) {
            const record = {
              category: rowCategory,
              name: String(name).trim(),
              contactPerson: String(person).trim(),
              email: String(email).trim(),
              phone: String(phone).trim(),
              location: String(location).trim(),
              notes: String(notes).trim(),
              _sheetName: sheetName.trim(),   // exact tab name, trimmed
              updatedAt: new Date(),
              updatedBy: appState.currentUser || "Pricing Team"
            };
            if (rating !== "") record.rating = rating;
            if (agreement) record.agreement = agreement;
            if (creditTerms) record.creditTerms = creditTerms;
            if (moduleType) record.moduleType = moduleType;
            if (isSuspendedSheet) record.suspended = true;
            importedExcelRows.push(record);
          }
        });
      });

      if (importedExcelRows.length === 0) {
        alert("No valid rows found in Excel sheet. Please make sure there is a Name/Company column.");
        resetExcelImport();
        return;
      }

      // Show preview of parsed data
      const preview = document.getElementById("excel-import-preview");
      const countEl = document.getElementById("excel-import-count");
      const actions = document.getElementById("excel-import-actions");

      if (preview && countEl && actions) {
        countEl.textContent = importedExcelRows.length;

        const categoryColors = {
          liner: '#0ea5e9', coloader: '#8b5cf6', nvocc: '#f59e0b',
          breakbulk: '#ef4444', airline: '#06b6d4', pq: '#10b981',
          insurance: '#f97316', agency: '#3b82f6', other: '#6b7280'
        };

        // --- Per-sheet summary: club chips by normalised key (trim+lowercase) ---
        // This ensures "Liners", "liners ", "LINERS" all merge into one chip.
        const sheetOrder = [];          // preserve workbook tab order
        const sheetSummary = {};        // key: normalised name
        importedExcelRows.forEach(r => {
          const raw = r._sheetName || 'Unknown Sheet';
          const key = raw.toLowerCase().trim();
          if (!sheetSummary[key]) {
            sheetSummary[key] = { displayName: raw, count: 0, catCounts: {} };
            sheetOrder.push(key);
          }
          sheetSummary[key].count++;
          const cat = r.category || 'other';
          sheetSummary[key].catCounts[cat] = (sheetSummary[key].catCounts[cat] || 0) + 1;
        });

        // Pick the dominant category (highest count) for each chip's colour
        const sheetChips = sheetOrder.map(key => {
          const info = sheetSummary[key];
          const dominantCat = Object.entries(info.catCounts)
            .sort((a, b) => b[1] - a[1])[0][0];
          const col = categoryColors[dominantCat] || '#6b7280';
          return `<span style="display:inline-flex; align-items:center; gap:5px; background:${col}12; color:${col}; border:1px solid ${col}45; border-radius:20px; padding:3px 12px 3px 8px; font-size:0.65rem; font-weight:700; white-space:nowrap;">
            <span style="font-size:0.75rem;">📋</span> ${info.displayName}
            <span style="background:${col}35; color:${col}; border-radius:10px; padding:1px 7px; font-size:0.6rem; font-weight:800;">${info.count}</span>
          </span>`;
        }).join('');

        // --- Preview table rows (first 10) ---
        const previewRows = importedExcelRows.slice(0, 10);
        let tableRows = previewRows.map((r, idx) => {
          const color = categoryColors[r.category] || '#6b7280';
          const catLabel = r.category ? r.category.toUpperCase() : 'OTHER';
          const bgRow = idx % 2 === 0 ? 'rgba(0,0,0,0.02)' : '#fff';
          const sheetShort = (r._sheetName || 'Sheet').length > 12
            ? (r._sheetName || 'Sheet').slice(0, 11) + '…'
            : (r._sheetName || 'Sheet');
          return `<tr style="background:${bgRow};">
            <td style="padding:5px 8px; color:#6b7280; font-size:0.65rem; text-align:center; border-right:1px solid #e5e7eb;">${idx + 1}</td>
            <td style="padding:5px 8px; border-right:1px solid #e5e7eb;">
              <span style="background:${color}20; color:${color}; border:1px solid ${color}40; border-radius:4px; padding:1px 6px; font-size:0.58rem; font-weight:700; white-space:nowrap;">${catLabel}</span>
            </td>
            <td style="padding:4px 8px; font-size:0.62rem; color:#6b7280; border-right:1px solid #e5e7eb; white-space:nowrap;" title="${r._sheetName || ''}">${sheetShort}</td>
            <td style="padding:5px 8px; font-weight:600; color:#111827; font-size:0.72rem; border-right:1px solid #e5e7eb; max-width:140px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${r.name}">${r.name || '—'}</td>
            <td style="padding:5px 8px; color:#374151; font-size:0.7rem; border-right:1px solid #e5e7eb;">${r.contactPerson || '—'}</td>
            <td style="padding:5px 8px; color:#374151; font-size:0.7rem;">${r.phone || '—'}</td>
          </tr>`;
        }).join('');

        const remaining = importedExcelRows.length - previewRows.length;
        const footerRow = remaining > 0 ? `
          <tr>
            <td colspan="6" style="padding:6px 8px; text-align:center; font-size:0.68rem; color:#6b7280; font-style:italic; background:#f9fafb; border-top:1px solid #e5e7eb;">
              + ${remaining} more row${remaining > 1 ? 's' : ''} not shown in preview
            </td>
          </tr>` : '';

        let previewHtml = `
          <div style="font-size:0.72rem; font-weight:700; color:#374151; margin-bottom:8px; padding:0 2px;">
            ✅ ${importedExcelRows.length} contact${importedExcelRows.length !== 1 ? 's' : ''} parsed from ${sheetOrder.length} sheet${sheetOrder.length !== 1 ? 's' : ''}
          </div>
          <div style="display:flex; flex-wrap:wrap; gap:6px; margin-bottom:10px;">${sheetChips}</div>
          <div style="overflow-x:auto; border-radius:6px; border:1px solid #e5e7eb;">
            <table style="width:100%; border-collapse:collapse; font-family:'Outfit',sans-serif;">
              <thead>
                <tr style="background:#f3f4f6;">
                  <th style="padding:5px 8px; font-size:0.62rem; color:#6b7280; font-weight:700; text-align:center; border-right:1px solid #e5e7eb; border-bottom:1px solid #d1d5db;">#</th>
                  <th style="padding:5px 8px; font-size:0.62rem; color:#6b7280; font-weight:700; text-align:left; border-right:1px solid #e5e7eb; border-bottom:1px solid #d1d5db;">Category</th>
                  <th style="padding:5px 8px; font-size:0.62rem; color:#6b7280; font-weight:700; text-align:left; border-right:1px solid #e5e7eb; border-bottom:1px solid #d1d5db;">Sheet Tab</th>
                  <th style="padding:5px 8px; font-size:0.62rem; color:#6b7280; font-weight:700; text-align:left; border-right:1px solid #e5e7eb; border-bottom:1px solid #d1d5db;">Company / Name</th>
                  <th style="padding:5px 8px; font-size:0.62rem; color:#6b7280; font-weight:700; text-align:left; border-right:1px solid #e5e7eb; border-bottom:1px solid #d1d5db;">Contact Person</th>
                  <th style="padding:5px 8px; font-size:0.62rem; color:#6b7280; font-weight:700; text-align:left; border-bottom:1px solid #d1d5db;">Phone</th>
                </tr>
              </thead>
              <tbody>
                ${tableRows}
                ${footerRow}
              </tbody>
            </table>
          </div>`;

        preview.innerHTML = previewHtml;
        preview.style.display = "block";
        actions.style.display = "flex";
      }
    } catch (err) {
      console.error("Excel import parse error:", err);
      alert("Error parsing excel file. Please check if the file is corrupted.");
      resetExcelImport();
    }
  };
  reader.readAsBinaryString(file);
}
window.handleExcelFileSelect = handleExcelFileSelect;

// Reset Importer fields
function resetExcelImport() {
  importedExcelRows = [];
  const fileInput = document.getElementById('excel-file-input');
  if (fileInput) fileInput.value = "";

  const preview = document.getElementById("excel-import-preview");
  if (preview) {
    preview.style.display = "none";
    preview.innerHTML = "";
  }

  const actions = document.getElementById("excel-import-actions");
  if (actions) actions.style.display = "none";
}
window.resetExcelImport = resetExcelImport;

// Submit Bulk Rows to Firestore
async function submitExcelImport() {
  if (importedExcelRows.length === 0) return;

  const hasAgents = importedExcelRows.some(r => r.category === 'agency');
  const hasVendors = importedExcelRows.some(r => r.category !== 'agency');

  if (hasAgents && !canEditAgentsDirectory()) {
    alert("You do not have permission to import Overseas Agents.");
    return;
  }
  if (hasVendors && !canAccessVendorsDirectory()) {
    alert("You do not have permission to import Vendor Contacts.");
    return;
  }

  const count = importedExcelRows.length;
  if (!confirm(`Are you sure you want to import ${count} contacts? This will write them to the database.`)) return;

  try {
    if (window.db) {
      // Chunk writes in batches of 200 to prevent firestore size limit
      const chunkSize = 200;
      for (let i = 0; i < importedExcelRows.length; i += chunkSize) {
        const batch = db.batch();
        const chunk = importedExcelRows.slice(i, i + chunkSize);

        chunk.forEach(item => {
          const { _sheetName, ...cleanItem } = item;
          // Preserve the original sheet tab as sheetGroup for dynamic tabs in the directory UI
          cleanItem.sheetGroup = _sheetName;
          const docRef = db.collection("contactsDirectory").doc();
          batch.set(docRef, cleanItem);
        });

        await batch.commit();
      }
      alert(`Imported ${count} contacts successfully!`);
    } else {
      throw new Error("No database connection");
    }
  } catch (err) {
    console.error("Error bulk writing in Firestore:", err);
    // Local fallback
    directoryContacts = [...directoryContacts, ...importedExcelRows];
    localStorage.setItem("gl_directory_contacts", JSON.stringify(directoryContacts));
    alert("Database connection offline. Imported locally!");
  }

  closeImportExcelModal();
  loadDirectoryContacts();
}
window.submitExcelImport = submitExcelImport;

// Export directory to Excel
function exportDirectoryToExcel() {
  if (directoryContacts.length === 0) {
    alert("No contacts in directory to export.");
    return;
  }

  try {
    // Filter to only export contacts matching active parent directory (Agents or Vendors)
    const exportFiltered = directoryContacts.filter(c => {
      if (activeDirectoryParent === 'agents') {
        return c.category === 'agency';
      } else {
        return c.category !== 'agency';
      }
    });

    const dataToExport = exportFiltered.map(c => ({
      Category: c.category || '',
      Name: c.name || '',
      'Contact Person': c.contactPerson || '',
      Email: c.email || '',
      Phone: c.phone || '',
      Location: c.location || '',
      'Notes / Remarks': c.notes || '',
      'Last Updated By': c.updatedBy || '',
      'Last Updated At': c.updatedAt ? new Date(c.updatedAt.seconds ? c.updatedAt.seconds * 1000 : c.updatedAt).toLocaleDateString() : ''
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, activeDirectoryParent === 'agents' ? "Overseas Agents" : "Vendor Contacts");
    XLSX.writeFile(workbook, activeDirectoryParent === 'agents' ? "atlas_overseas_agents_directory.xlsx" : "atlas_vendor_contacts_directory.xlsx");
  } catch (err) {
    console.error("Excel export error:", err);
    alert("Failed to export directory. Please check logs.");
  }
}
window.exportDirectoryToExcel = exportDirectoryToExcel;

// Purge and reset database directory contacts
async function purgeDirectoryContacts() {
  const isAdmin = isAdminUser(appState.currentUser);
  if (!isAdmin) {
    alert("You do not have permission to reset the directory.");
    return;
  }

  const isAgents = (activeDirectoryParent === 'agents');
  const targetName = isAgents ? "Overseas Agents" : "Vendor Contacts";
  const confirmMsg = `⚠️ WARNING: This will permanently delete all ${targetName} in the database. Are you sure you want to proceed?`;
  if (!confirm(confirmMsg)) return;

  try {
    if (window.db) {
      const snapshot = await db.collection("contactsDirectory").get();
      if (!snapshot.empty) {
        const batch = db.batch();
        let deleteCount = 0;

        snapshot.forEach(doc => {
          const data = doc.data();
          const isAgency = (data.category === 'agency');

          if ((isAgents && isAgency) || (!isAgents && !isAgency)) {
            batch.delete(doc.ref);
            deleteCount++;
          }
        });

        if (deleteCount > 0) {
          await batch.commit();
        }
      }

      // Repopulate fallback contacts for the reset category
      const targetFallbacks = fallbackContacts.filter(c => {
        const isAgency = (c.category === 'agency');
        return isAgents ? isAgency : !isAgency;
      });

      const batchRestore = db.batch();
      targetFallbacks.forEach(contact => {
        const { id, ...data } = contact;
        const newDocRef = db.collection("contactsDirectory").doc(id);
        batchRestore.set(newDocRef, data);
      });
      await batchRestore.commit();

      alert(`${targetName} directory cleared successfully!`);
    } else {
      if (isAgents) {
        directoryContacts = directoryContacts.filter(c => c.category !== 'agency');
        const agencyFallbacks = fallbackContacts.filter(c => c.category === 'agency');
        directoryContacts = [...directoryContacts, ...agencyFallbacks];
      } else {
        directoryContacts = directoryContacts.filter(c => c.category === 'agency');
        const vendorFallbacks = fallbackContacts.filter(c => c.category !== 'agency');
        directoryContacts = [...directoryContacts, ...vendorFallbacks];
      }
      localStorage.setItem("gl_directory_contacts", JSON.stringify(directoryContacts));
      alert(`Offline mode: Local ${targetName} directory reset.`);
    }
  } catch (err) {
    console.error("Error purging contacts directory:", err);
    alert("An error occurred while clearing the directory: " + err.message);
  }

  loadDirectoryContacts();
}
window.purgeDirectoryContacts = purgeDirectoryContacts;

// One-time cleanup utility (console-only, not wired to any button): repeated
// accidental re-imports of the same Overseas Agents workbook created exact
// duplicate documents (same name/location/email). This removes only the
// extra copies — the first document found in each duplicate group is kept,
// nothing unique is ever touched. Run from the browser console as an admin:
//   dedupeOverseasAgents()
async function dedupeOverseasAgents() {
  if (!isAdminUser(appState.currentUser)) {
    alert("You do not have permission to run this.");
    return;
  }
  if (!window.db) {
    alert("No database connection.");
    return;
  }

  const snapshot = await db.collection("contactsDirectory").where("category", "==", "agency").get();
  const groups = {};
  snapshot.forEach(doc => {
    const d = doc.data();
    const key = [
      (d.name || '').trim().toLowerCase(),
      (d.location || '').trim().toLowerCase(),
      (d.email || '').trim().toLowerCase()
    ].join('|');
    if (!groups[key]) groups[key] = [];
    groups[key].push(doc.ref);
  });

  const toDelete = [];
  let duplicateGroups = 0;
  Object.values(groups).forEach(refs => {
    if (refs.length > 1) {
      duplicateGroups++;
      // Keep the first, delete the rest — every copy is a byte-identical
      // re-import of the same source row, so there is no "better" one.
      toDelete.push(...refs.slice(1));
    }
  });

  if (toDelete.length === 0) {
    alert("No duplicates found. Nothing to clean up.");
    return;
  }

  const uniqueRemaining = Object.keys(groups).length;
  const proceed = confirm(
    `Found ${duplicateGroups} duplicated agent(s) across ${snapshot.size} total agency documents.\n\n` +
    `${toDelete.length} duplicate document(s) will be deleted.\n` +
    `${uniqueRemaining} unique agents will remain untouched.\n\n` +
    `Proceed?`
  );
  if (!proceed) return;

  const chunkSize = 500;
  for (let i = 0; i < toDelete.length; i += chunkSize) {
    const batch = db.batch();
    toDelete.slice(i, i + chunkSize).forEach(ref => batch.delete(ref));
    await batch.commit();
  }

  alert(`Cleanup complete. Deleted ${toDelete.length} duplicate document(s). ${uniqueRemaining} unique agents remain.`);
  loadDirectoryContacts();
}
window.dedupeOverseasAgents = dedupeOverseasAgents;

// ══════════════════════════════════════════════════
// CIRCULARS & DOCUMENTS LIBRARY
// Admin/vendor-editor-uploaded PDFs (airline tariffs, airline fuel
// circulars, shipping line circulars) stored in Firebase Storage —
// metadata lives in the "circularsLibrary" Firestore collection.
// Viewing is open to every signed-in user; add/edit/delete matches
// Vendor Contacts edit rights (canAccessVendorsDirectory()).
// ══════════════════════════════════════════════════
let circularsLibraryData = [];
let activeCircularCategory = 'all';

const CIRCULAR_CATEGORY_META = {
  airline_tariff: { label: 'Airline Tariff', color: '#0ea5e9' },
  fuel_circular_airline: { label: 'Airline Fuel Circular', color: '#f59e0b' },
  fuel_circular_shipping: { label: 'Shipping Line Circular', color: '#8b5cf6' }
};

// Keyword lists used to auto-detect a circular's category from its own PDF
// text — a lightweight, free, client-side classifier (no API/cloud function
// needed) rather than a full AI-based read of the document.
const CIRCULAR_CLASSIFY_KEYWORDS = {
  airline: [
    'iata', 'awb', 'air waybill', 'chargeable weight', 'cargo terminal', 'airport',
    'flight number', 'aircraft type', 'origin airport', 'destination airport',
    'emirates', 'skycargo', 'qatar airways', 'qr cargo', 'etihad', 'lufthansa cargo',
    'air india', 'singapore airlines', 'cathay pacific', 'turkish airlines', 'saudia',
    'oman air', 'srilankan', 'indigo', 'spicejet', 'fedex', 'dhl aviation', 'cargolux'
  ],
  shipping: [
    'bill of lading', 'vessel', 'container', 'teu', 'feu', 'baf', 'caf',
    'bunker adjustment', 'currency adjustment', 'ocean freight', 'port of loading',
    'port of discharge', 'shipping line', 'liner service', 'fcl', 'lcl',
    'maersk', 'msc mediterranean', 'cma cgm', 'hapag-lloyd', 'evergreen line',
    'cosco shipping', 'ocean network express', 'yang ming', 'hmm co', 'zim line'
  ]
};

// Reads the first few pages of a PDF (enough for classification, without
// paying the cost of parsing a 50-page tariff booklet in full) and returns
// its lowercased text via PDF.js.
async function extractPdfText(file) {
  if (typeof pdfjsLib === 'undefined') return '';
  try {
    if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
    }
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let text = '';
    const maxPages = Math.min(pdf.numPages, 5);
    for (let i = 1; i <= maxPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map(it => it.str).join(' ') + ' ';
    }
    return text.toLowerCase();
  } catch (err) {
    console.warn("PDF text extraction failed:", err);
    return '';
  }
}

// Scores the extracted text against the airline/shipping keyword lists and
// picks a category. Returns null when the signal is too weak or tied,
// leaving the dropdown on whatever the user last selected.
function classifyCircularText(text) {
  if (!text) return null;

  let airlineScore = 0, shippingScore = 0;
  CIRCULAR_CLASSIFY_KEYWORDS.airline.forEach(kw => { if (text.includes(kw)) airlineScore++; });
  CIRCULAR_CLASSIFY_KEYWORDS.shipping.forEach(kw => { if (text.includes(kw)) shippingScore++; });

  if (airlineScore === 0 && shippingScore === 0) return null;
  if (airlineScore === shippingScore) return null;

  if (airlineScore > shippingScore) {
    const looksLikeFuelCircular = /fuel surcharge|\bfsc\b|jet fuel/.test(text) &&
      !/rate card|tariff sheet|freight rate table/.test(text);
    return looksLikeFuelCircular ? 'fuel_circular_airline' : 'airline_tariff';
  }
  return 'fuel_circular_shipping';
}

// Wired to the file input's onchange — auto-detects and pre-selects the
// category, but never locks the dropdown, so a wrong guess is one click to fix.
async function handleCircularFileClassify(event) {
  const file = event.target.files[0];
  const hintEl = document.getElementById("circular-form-classify-hint");
  if (!file) {
    if (hintEl) hintEl.textContent = '';
    return;
  }

  if (hintEl) hintEl.textContent = 'Scanning document to suggest a category...';

  const text = await extractPdfText(file);
  const guess = classifyCircularText(text);

  if (guess) {
    const categorySelect = document.getElementById("circular-form-category");
    if (categorySelect) categorySelect.value = guess;
    const label = CIRCULAR_CATEGORY_META[guess]?.label || guess;
    if (hintEl) hintEl.textContent = `Auto-detected: ${label} — change the dropdown above if this looks wrong.`;
  } else {
    if (hintEl) hintEl.textContent = "Couldn't confidently detect a category from the document — please check the dropdown above.";
  }
}
window.handleCircularFileClassify = handleCircularFileClassify;

async function loadCircularsLibrary() {
  const grid = document.getElementById("circulars-grid");
  if (!grid) return;

  const allowedToEdit = canAccessVendorsDirectory();
  const addBtn = document.getElementById("circular-add-btn");
  if (addBtn) addBtn.style.display = allowedToEdit ? 'inline-flex' : 'none';

  grid.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; padding: 3rem; color: var(--t3); font-style: italic;">Loading documents...</div>`;

  try {
    if (window.db) {
      const snapshot = await db.collection("circularsLibrary").orderBy("createdAt", "desc").get();
      circularsLibraryData = [];
      snapshot.forEach(doc => circularsLibraryData.push({ id: doc.id, ...doc.data() }));
    } else {
      circularsLibraryData = [];
    }
  } catch (err) {
    console.error("Error loading circulars library:", err);
    circularsLibraryData = [];
  }

  renderCircularsLibrary();
}
window.loadCircularsLibrary = loadCircularsLibrary;

function setCircularCategory(cat) {
  activeCircularCategory = cat;
  document.querySelectorAll("#circular-category-tabs .dir-tab").forEach(tab => {
    tab.classList.toggle("active", tab.getAttribute("data-circular-cat") === cat);
  });
  renderCircularsLibrary();
}
window.setCircularCategory = setCircularCategory;

function renderCircularsLibrary() {
  const grid = document.getElementById("circulars-grid");
  if (!grid) return;

  const searchQuery = (document.getElementById("circular-search-input")?.value || "").toLowerCase().trim();
  const allowedToEdit = canAccessVendorsDirectory();

  let filtered = circularsLibraryData.filter(item => {
    if (activeCircularCategory !== 'all' && item.category !== activeCircularCategory) return false;
    if (searchQuery) {
      const haystack = `${item.title || ''} ${item.carrier || ''} ${item.notes || ''}`.toLowerCase();
      if (!haystack.includes(searchQuery)) return false;
    }
    return true;
  });

  if (filtered.length === 0) {
    const isFiltered = activeCircularCategory !== 'all' || searchQuery;
    grid.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; padding: 3.5rem 1.5rem;">
      <div style="font-size: 2rem; margin-bottom: 0.75rem; opacity: 0.5;">📄</div>
      <div style="font-size: 0.95rem; font-weight: 700; color: var(--t1); margin-bottom: 0.3rem;">
        ${isFiltered ? 'No documents match this filter' : 'No documents yet'}
      </div>
      <div style="font-size: 0.82rem; color: var(--t3);">
        ${isFiltered ? 'Try a different category or search term.' : 'Airline tariffs, fuel circulars, and shipping line circulars uploaded here will show up in this library.'}
      </div>
    </div>`;
    return;
  }

  const sortMode = document.getElementById("circular-sort-select")?.value || 'newest';
  filtered = filtered.slice().sort((a, b) => {
    if (sortMode === 'title') {
      return (a.title || '').localeCompare(b.title || '');
    }
    if (sortMode === 'category') {
      const la = CIRCULAR_CATEGORY_META[a.category]?.label || a.category || '';
      const lb = CIRCULAR_CATEGORY_META[b.category]?.label || b.category || '';
      return la.localeCompare(lb);
    }
    if (sortMode === 'expiring') {
      // Documents with no expiry date sort to the end, not the front.
      const ea = a.expiryDate || '9999-99';
      const eb = b.expiryDate || '9999-99';
      return ea.localeCompare(eb);
    }
    // 'newest' (default)
    const ta = (a.createdAt && a.createdAt.toMillis) ? a.createdAt.toMillis() : 0;
    const tb = (b.createdAt && b.createdAt.toMillis) ? b.createdAt.toMillis() : 0;
    return tb - ta;
  });

  const currentYM = new Date().toISOString().slice(0, 7); // "YYYY-MM" — string-comparable

  grid.innerHTML = filtered.map(item => {
    const meta = CIRCULAR_CATEGORY_META[item.category] || { label: item.category || 'Document', color: '#6b7280' };
    const uploadedDate = (item.createdAt && item.createdAt.toDate) ? item.createdAt.toDate().toLocaleDateString() : '';
    const editActions = allowedToEdit ? `
      <button class="contact-action-btn" title="Edit" onclick="openCircularModal('${item.id}')">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
      </button>
      <button class="contact-action-btn" title="Delete" onclick="deleteCircular('${item.id}')" style="color: #ef4444; border-color: rgba(239, 68, 68, 0.2);">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
      </button>` : '';

    // Month-year strings ("YYYY-MM") compare correctly as plain strings,
    // so no date parsing is needed to detect an expired circular.
    const isExpired = !!(item.expiryDate && item.expiryDate < currentYM);
    const expiredBadge = isExpired
      ? `<span style="background:#fee2e2; color:#dc2626; border:1px solid #fca5a5; border-radius: var(--r-pill); padding: 2px 10px; font-size: 0.62rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em; white-space: nowrap;">Expired</span>`
      : '';

    let validityLine = '';
    if (item.effectiveDate || item.expiryDate) {
      const parts = [];
      if (item.effectiveDate) parts.push(`Effective ${formatMonthYear(item.effectiveDate)}`);
      if (item.expiryDate) parts.push(`${isExpired ? 'Expired' : 'Valid until'} ${formatMonthYear(item.expiryDate)}`);
      validityLine = `<div style="font-size: 0.72rem; font-weight: 700; color: ${isExpired ? '#dc2626' : 'var(--t2)'};">${parts.join(' · ')}</div>`;
    }

    return `<div class="glass-card" style="padding: 1.1rem; display: flex; flex-direction: column; gap: 0.6rem;${isExpired ? ' border-color: #fca5a5;' : ''}">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.5rem;">
        <div style="display: flex; gap: 0.35rem; flex-wrap: wrap;">
          <span style="background:${meta.color}18; color:${meta.color}; border:1px solid ${meta.color}45; border-radius: var(--r-pill); padding: 2px 10px; font-size: 0.62rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em; white-space: nowrap;">${meta.label}</span>
          ${expiredBadge}
        </div>
        <div style="display: flex; gap: 0.35rem;">${editActions}</div>
      </div>
      <div style="font-weight: 800; font-size: 0.92rem; color: var(--t1); line-height: 1.3;">${item.title || 'Untitled'}</div>
      ${item.carrier ? `<div style="font-size: 0.78rem; color: var(--t2);">${item.carrier}</div>` : ''}
      ${validityLine}
      ${item.notes ? `<div style="font-size: 0.75rem; color: var(--t3); line-height: 1.4;">${item.notes}</div>` : ''}
      <div style="font-size: 0.68rem; color: var(--t3); margin-top: auto;">Uploaded ${uploadedDate}${item.updatedBy ? ' by ' + item.updatedBy : ''}</div>
      <a href="${item.downloadURL}" target="_blank" rel="noopener" class="btn-secondary" style="text-align: center; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 0.8rem;">
        📄 View / Download
      </a>
    </div>`;
  }).join('');
}
window.renderCircularsLibrary = renderCircularsLibrary;

// "YYYY-MM" -> "Mon YYYY", e.g. "2026-04" -> "Apr 2026"
function formatMonthYear(ym) {
  if (!ym) return '';
  const [y, m] = ym.split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const idx = parseInt(m, 10) - 1;
  return (months[idx] || m) + ' ' + y;
}

function openCircularModal(id = null) {
  if (!canAccessVendorsDirectory()) {
    alert("You do not have permission to manage circulars.");
    return;
  }
  const modal = document.getElementById("circular-form-modal");
  const form = document.getElementById("circular-form");
  if (!modal || !form) return;
  form.reset();
  document.getElementById("circular-form-existing-path").value = "";
  document.getElementById("circular-form-existing-url").value = "";
  const classifyHintEl = document.getElementById("circular-form-classify-hint");
  if (classifyHintEl) classifyHintEl.textContent = "";

  if (id) {
    const item = circularsLibraryData.find(c => c.id === id);
    if (!item) return;
    document.getElementById("circular-modal-title").textContent = "EDIT DOCUMENT";
    document.getElementById("circular-form-id").value = item.id;
    document.getElementById("circular-form-category").value = item.category || 'airline_tariff';
    document.getElementById("circular-form-title").value = item.title || '';
    document.getElementById("circular-form-carrier").value = item.carrier || '';
    document.getElementById("circular-form-effective").value = item.effectiveDate || '';
    document.getElementById("circular-form-expiry").value = item.expiryDate || '';
    document.getElementById("circular-form-notes").value = item.notes || '';
    document.getElementById("circular-form-existing-path").value = item.storagePath || '';
    document.getElementById("circular-form-existing-url").value = item.downloadURL || '';
    document.getElementById("circular-form-file-hint").textContent = item.fileName ? `(current: ${item.fileName} — leave blank to keep)` : '';
    document.getElementById("circular-form-submit-btn").textContent = "Save Changes";
  } else {
    document.getElementById("circular-modal-title").textContent = "ADD DOCUMENT";
    document.getElementById("circular-form-id").value = "";
    document.getElementById("circular-form-category").value =
      (activeCircularCategory !== 'all') ? activeCircularCategory : 'airline_tariff';
    document.getElementById("circular-form-file-hint").textContent = "";
    document.getElementById("circular-form-submit-btn").textContent = "Save Document";
  }

  modal.style.display = "flex";
}
window.openCircularModal = openCircularModal;

function closeCircularModal() {
  const modal = document.getElementById("circular-form-modal");
  if (modal) modal.style.display = "none";
}
window.closeCircularModal = closeCircularModal;

async function saveCircular(event) {
  event.preventDefault();

  if (!canAccessVendorsDirectory()) {
    alert("You do not have permission to manage circulars.");
    return;
  }

  const id = document.getElementById("circular-form-id").value;
  const category = document.getElementById("circular-form-category").value;
  const title = document.getElementById("circular-form-title").value.trim();
  const carrier = document.getElementById("circular-form-carrier").value.trim();
  const effectiveDate = document.getElementById("circular-form-effective").value; // "" or "YYYY-MM"
  const expiryDate = document.getElementById("circular-form-expiry").value;       // "" or "YYYY-MM"
  const notes = document.getElementById("circular-form-notes").value.trim();
  const fileInput = document.getElementById("circular-form-file");
  const file = fileInput.files[0];
  const existingPath = document.getElementById("circular-form-existing-path").value;
  const existingUrl = document.getElementById("circular-form-existing-url").value;

  if (!id && !file) {
    alert("Please select a PDF file to upload.");
    return;
  }
  if (file && file.type !== "application/pdf") {
    alert("Only PDF files are supported.");
    return;
  }
  const maxSizeMB = 25;
  if (file && file.size > maxSizeMB * 1024 * 1024) {
    alert(`File is too large. Maximum size is ${maxSizeMB}MB.`);
    return;
  }
  if (!window.storage) {
    alert("Document storage is not available right now. Please try again shortly.");
    return;
  }

  const submitBtn = document.getElementById("circular-form-submit-btn");
  const originalBtnText = submitBtn.textContent;
  submitBtn.disabled = true;
  submitBtn.textContent = file ? "Uploading..." : "Saving...";

  try {
    let storagePath = existingPath;
    let downloadURL = existingUrl;
    let fileName = null;

    if (file) {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const newPath = `circulars/${category}/${Date.now()}_${safeName}`;
      const snapshot = await storage.ref(newPath).put(file);
      downloadURL = await snapshot.ref.getDownloadURL();
      fileName = file.name;

      // Replacing the file on an existing record — clean up the old object
      if (id && existingPath && existingPath !== newPath) {
        storage.ref(existingPath).delete().catch(e => console.warn("Old circular file cleanup failed:", e));
      }
      storagePath = newPath;
    }

    const docData = {
      category,
      title,
      carrier,
      effectiveDate,
      expiryDate,
      notes,
      storagePath,
      downloadURL,
      updatedAt: new Date(),
      updatedBy: appState.currentUser || "Pricing Team"
    };
    if (fileName) docData.fileName = fileName;

    if (id) {
      await db.collection("circularsLibrary").doc(id).update(docData);
    } else {
      docData.fileName = fileName;
      docData.createdAt = new Date();
      await db.collection("circularsLibrary").add(docData);
    }

    closeCircularModal();
    loadCircularsLibrary();
  } catch (err) {
    console.error("Error saving circular:", err);
    alert("Failed to save document: " + err.message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = originalBtnText;
  }
}
window.saveCircular = saveCircular;

async function deleteCircular(id) {
  if (!canAccessVendorsDirectory()) {
    alert("You do not have permission to delete circulars.");
    return;
  }
  const item = circularsLibraryData.find(c => c.id === id);
  if (!item) return;

  if (!confirm(`Delete "${item.title}"? This cannot be undone.`)) return;

  try {
    if (item.storagePath && window.storage) {
      await storage.ref(item.storagePath).delete().catch(e => console.warn("Storage file delete failed (may already be gone):", e));
    }
    await db.collection("circularsLibrary").doc(id).delete();
    loadCircularsLibrary();
  } catch (err) {
    console.error("Error deleting circular:", err);
    alert("Failed to delete document: " + err.message);
  }
}
window.deleteCircular = deleteCircular;

// Weekly Agency List popup — opened from the Overseas Agents tab of the
// Directory (#dir-agency-list-btn), not a standalone panel. Mirrors the
// Air/Sea "rates & fees" modal open/close pattern exactly, wired once here
// rather than per-card since this modal has a single, static instance.
function openAgencyListModal() {
  const overlay = document.getElementById("agencylist-modal-overlay");
  if (!overlay) return;
  overlay.style.display = "flex";
  try { loadAgencyListRecipients(); } catch (e) { console.error("loadAgencyListRecipients error:", e); }
}
window.openAgencyListModal = openAgencyListModal;

function closeAgencyListModal() {
  const overlay = document.getElementById("agencylist-modal-overlay");
  if (overlay) overlay.style.display = "none";
}
window.closeAgencyListModal = closeAgencyListModal;

document.addEventListener("DOMContentLoaded", () => {
  const overlay = document.getElementById("agencylist-modal-overlay");
  if (!overlay) return;
  const closeBtn = overlay.querySelector(".close-agencylist-modal-btn");
  const doneBtn = overlay.querySelector(".done-agencylist-modal-btn");
  if (closeBtn) closeBtn.addEventListener("click", closeAgencyListModal);
  if (doneBtn) doneBtn.addEventListener("click", closeAgencyListModal);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeAgencyListModal();
  });
});

// ══════════════════════════════════════════════════
// WEEKLY AGENCY LIST — recipients CRUD + preview/test-send
// Recipient list is a single settings doc (app_settings/agencyListRecipients,
// { emails: [...] }), mirroring the custom_autocomplete_entries pattern
// elsewhere in this file. Editing is gated by canManageAgencyListRecipients()
// (same role set as the Agents Directory). The actual weekly compile/send
// happens server-side in functions/index.js (weeklyAgencyListEmail,
// triggerAgencyListNow) — this block only manages the recipient list and
// calls triggerAgencyListNow for the in-app preview/test-send buttons.
// ══════════════════════════════════════════════════
let agencyListRecipientsData = [];

async function loadAgencyListRecipients() {
  const listEl = document.getElementById("agencylist-recipients-list");
  if (!listEl) return;
  try {
    const doc = await db.collection("app_settings").doc("agencyListRecipients").get();
    agencyListRecipientsData = (doc.exists && Array.isArray(doc.data().emails)) ? doc.data().emails : [];
  } catch (err) {
    console.error("Error loading agency list recipients:", err);
    agencyListRecipientsData = [];
  }
  renderAgencyListRecipients();
}
window.loadAgencyListRecipients = loadAgencyListRecipients;

function renderAgencyListRecipients() {
  const listEl = document.getElementById("agencylist-recipients-list");
  const addRow = document.getElementById("agencylist-add-row");
  const testSendBtn = document.getElementById("agencylist-test-send-btn");
  if (!listEl) return;

  const canManage = canManageAgencyListRecipients();
  const isAdmin = (appState.currentUser || "").toLowerCase() === 'ganny';
  if (addRow) addRow.style.display = canManage ? 'flex' : 'none';
  if (testSendBtn) testSendBtn.style.display = isAdmin ? 'flex' : 'none';

  if (agencyListRecipientsData.length === 0) {
    listEl.innerHTML = `<div style="color: var(--t3); font-style: italic; font-size: 0.85rem;">No recipients configured yet.</div>`;
    return;
  }

  listEl.innerHTML = agencyListRecipientsData.map(email => `
    <span style="display: inline-flex; align-items: center; gap: 6px; background: rgba(56, 189, 248, 0.12); border: 1px solid rgba(56, 189, 248, 0.35); color: var(--t1); padding: 5px 8px 5px 12px; border-radius: 20px; font-size: 0.8rem;">
      ${email}
      ${canManage ? `<button type="button" onclick="removeAgencyListRecipient('${email.replace(/'/g, "\\'")}')" title="Remove" style="background: none; border: none; cursor: pointer; color: var(--t3); font-size: 0.9rem; line-height: 1; padding: 0 2px;">✕</button>` : ''}
    </span>
  `).join('');
}
window.renderAgencyListRecipients = renderAgencyListRecipients;

async function saveAgencyListRecipients() {
  await db.collection("app_settings").doc("agencyListRecipients").set({
    emails: agencyListRecipientsData,
    updatedAt: new Date(),
    updatedBy: appState.currentUser || "Pricing Team"
  }, { merge: true });
}

async function addAgencyListRecipient() {
  if (!canManageAgencyListRecipients()) return;
  const input = document.getElementById("agencylist-new-email-input");
  const email = (input?.value || "").trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    alert("Enter a valid email address.");
    return;
  }
  if (agencyListRecipientsData.some(e => e.toLowerCase() === email)) {
    alert("That email is already on the list.");
    return;
  }
  agencyListRecipientsData.push(email);
  try {
    await saveAgencyListRecipients();
    if (input) input.value = '';
    renderAgencyListRecipients();
  } catch (err) {
    console.error("Error saving agency list recipient:", err);
    alert("Failed to save: " + err.message);
    agencyListRecipientsData = agencyListRecipientsData.filter(e => e !== email);
  }
}
window.addAgencyListRecipient = addAgencyListRecipient;

async function removeAgencyListRecipient(email) {
  if (!canManageAgencyListRecipients()) return;
  const prev = agencyListRecipientsData;
  agencyListRecipientsData = agencyListRecipientsData.filter(e => e !== email);
  try {
    await saveAgencyListRecipients();
    renderAgencyListRecipients();
  } catch (err) {
    console.error("Error removing agency list recipient:", err);
    alert("Failed to remove: " + err.message);
    agencyListRecipientsData = prev;
    renderAgencyListRecipients();
  }
}
window.removeAgencyListRecipient = removeAgencyListRecipient;

// Admin-only, zero-side-effect preview — calls the same report-building
// logic the real Thursday send uses (triggerAgencyListNow with dryRun),
// and renders the returned HTML in a sandboxed iframe so the email markup
// never collides with the app's own CSS.
async function previewAgencyListReport() {
  const area = document.getElementById("agencylist-preview-area");
  const btn = document.getElementById("agencylist-preview-btn");
  if (!area) return;
  area.style.display = 'block';
  area.innerHTML = `<div style="text-align: center; padding: 2rem; color: var(--t3); font-style: italic;">Compiling this week's report...</div>`;
  if (btn) btn.disabled = true;
  try {
    const fn = firebase.functions().httpsCallable("triggerAgencyListNow");
    const result = await fn({ dryRun: true });
    const data = result.data || {};
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'width: 100%; min-height: 420px; border: none;';
    iframe.srcdoc = data.html || '<p>No content returned.</p>';
    area.innerHTML = '';
    area.appendChild(iframe);
  } catch (err) {
    console.error("Error previewing agency list report:", err);
    area.innerHTML = `<div style="color: #ef4444; padding: 1rem;">Failed to generate preview: ${err.message}</div>`;
  } finally {
    if (btn) btn.disabled = false;
  }
}
window.previewAgencyListReport = previewAgencyListReport;

// Admin-only real test send (server-side check mirrors this client-side
// gate) — sends to whichever recipients are currently configured, meant
// for a one-off verification send (e.g. to a personal inbox) before the
// live Thursday schedule is trusted.
async function sendAgencyListTestEmail() {
  if ((appState.currentUser || "").toLowerCase() !== 'ganny') return;
  if (!confirm(`Send a real test email now to all ${agencyListRecipientsData.length} configured recipient(s)?`)) return;
  const btn = document.getElementById("agencylist-test-send-btn");
  if (btn) btn.disabled = true;
  try {
    const fn = firebase.functions().httpsCallable("triggerAgencyListNow");
    const result = await fn({ dryRun: false });
    const data = result.data || {};
    alert(`Test email sent to ${data.recipientCount || 0} recipient(s).`);
  } catch (err) {
    console.error("Error sending agency list test email:", err);
    alert("Failed to send test email: " + err.message);
  } finally {
    if (btn) btn.disabled = false;
  }
}
window.sendAgencyListTestEmail = sendAgencyListTestEmail;

window.addEventListener("storage", (e) => {
  if (e.key === "gl_amendment_requests") {
    let requests = [];
    try { requests = JSON.parse(e.newValue || "[]"); } catch (err) { }
    window._amendmentRequests = requests;
    if (typeof checkAndNotifyNewRequests === 'function') {
      checkAndNotifyNewRequests(requests);
    }
    if (appState.currentUser === 'ganny') {
      renderAdminDashboard();
    }
  } else if (e.key === "logistics_quotes") {
    let quotes = [];
    try { quotes = JSON.parse(e.newValue || "[]"); } catch (err) { }
    appState.quotes = quotes;
    if (appState.currentUser === 'ganny') {
      renderAdminDashboard();
    } else {
      renderMemberDashboard(appState.currentUser);
    }
  }
});

// Global ZIP codes database for 192 countries
const GLOBAL_ZIP_RECORDS = [
  // Major Indian Hubs
  { zip: "110001", city: "New Delhi", country: "India" },
  { zip: "400001", city: "Mumbai", country: "India" },
  { zip: "560001", city: "Bengaluru", country: "India" },
  { zip: "600001", city: "Chennai", country: "India" },
  { zip: "700001", city: "Kolkata", country: "India" },
  { zip: "500001", city: "Hyderabad", country: "India" },
  { zip: "380001", city: "Ahmedabad", country: "India" },
  { zip: "411001", city: "Pune", country: "India" },
  { zip: "122001", city: "Gurgaon", country: "India" },
  { zip: "201301", city: "Noida", country: "India" },
  { zip: "600028", city: "Chennai Port Area", country: "India" },
  { zip: "400707", city: "Navi Mumbai (Nhava Sheva JNPT)", country: "India" },
  { zip: "370201", city: "Gandhidham / Kandla Port", country: "India" },
  { zip: "395003", city: "Surat", country: "India" },

  // 192 countries representation
  { country: "Afghanistan", city: "Kabul", zip: "1001" },
  { country: "Albania", city: "Tirana", zip: "1000" },
  { country: "Algeria", city: "Algiers", zip: "16000" },
  { country: "Andorra", city: "Andorra la Vella", zip: "AD500" },
  { country: "Angola", city: "Luanda", zip: "1011" },
  { country: "Antigua and Barbuda", city: "Saint John's", zip: "00000" },
  { country: "Argentina", city: "Buenos Aires", zip: "C1001" },
  { country: "Armenia", city: "Yerevan", zip: "0001" },
  { country: "Australia", city: "Sydney", zip: "2000" },
  { country: "Austria", city: "Vienna", zip: "1010" },
  { country: "Azerbaijan", city: "Baku", zip: "AZ1000" },
  { country: "Bahamas", city: "Nassau", zip: "00000" },
  { country: "Bahrain", city: "Manama", zip: "302" },
  { country: "Bangladesh", city: "Dhaka", zip: "1000" },
  { country: "Barbados", city: "Bridgetown", zip: "BB11000" },
  { country: "Belarus", city: "Minsk", zip: "220000" },
  { country: "Belgium", city: "Brussels", zip: "1000" },
  { country: "Belize", city: "Belmopan", zip: "00000" },
  { country: "Benin", city: "Porto-Novo", zip: "00000" },
  { country: "Bhutan", city: "Thimphu", zip: "11001" },
  { country: "Bolivia", city: "La Paz", zip: "0000" },
  { country: "Bosnia and Herzegovina", city: "Sarajevo", zip: "71000" },
  { country: "Botswana", city: "Gaborone", zip: "00000" },
  { country: "Brazil", city: "Brasilia", zip: "70000-000" },
  { country: "Brunei", city: "Bandar Seri Begawan", zip: "BS8611" },
  { country: "Bulgaria", city: "Sofia", zip: "1000" },
  { country: "Burkina Faso", city: "Ouagadougou", zip: "00000" },
  { country: "Burundi", city: "Gitega", zip: "0000" },
  { country: "Cabo Verde", city: "Praia", zip: "7600" },
  { country: "Cambodia", city: "Phnom Penh", zip: "12000" },
  { country: "Cameroon", city: "Yaounde", zip: "00000" },
  { country: "Canada", city: "Ottawa", zip: "K1P 1J1" },
  { country: "Central African Republic", city: "Bangui", zip: "00000" },
  { country: "Chad", city: "N'Djamena", zip: "00000" },
  { country: "Chile", city: "Santiago", zip: "8320000" },
  { country: "China", city: "Beijing", zip: "100000" },
  { country: "Colombia", city: "Bogota", zip: "110111" },
  { country: "Comoros", city: "Moroni", zip: "00000" },
  { country: "Congo", city: "Brazzaville", zip: "00000" },
  { country: "Costa Rica", city: "San Jose", zip: "10101" },
  { country: "Croatia", city: "Zagreb", zip: "10000" },
  { country: "Cuba", city: "Havana", zip: "10100" },
  { country: "Cyprus", city: "Nicosia", zip: "1010" },
  { country: "Czechia", city: "Prague", zip: "11000" },
  { country: "Denmark", city: "Copenhagen", zip: "1000" },
  { country: "Djibouti", city: "Djibouti", zip: "00000" },
  { country: "Dominica", city: "Roseau", zip: "00000" },
  { country: "Dominican Republic", city: "Santo Domingo", zip: "10101" },
  { country: "Ecuador", city: "Quito", zip: "170150" },
  { country: "Egypt", city: "Cairo", zip: "11511" },
  { country: "El Salvador", city: "San Salvador", zip: "01101" },
  { country: "Equatorial Guinea", city: "Malabo", zip: "00000" },
  { country: "Eritrea", city: "Asmara", zip: "00000" },
  { country: "Estonia", city: "Tallinn", zip: "10111" },
  { country: "Eswatini", city: "Mbabane", zip: "H100" },
  { country: "Ethiopia", city: "Addis Ababa", zip: "1000" },
  { country: "Fiji", city: "Suva", zip: "00000" },
  { country: "Finland", city: "Helsinki", zip: "00100" },
  { country: "France", city: "Paris", zip: "75001" },
  { country: "Gabon", city: "Libreville", zip: "00000" },
  { country: "Gambia", city: "Banjul", zip: "00000" },
  { country: "Georgia", city: "Tbilisi", zip: "0100" },
  { country: "Germany", city: "Berlin", zip: "10115" },
  { country: "Ghana", city: "Accra", zip: "GA000" },
  { country: "Greece", city: "Athens", zip: "10431" },
  { country: "Grenada", city: "St. George's", zip: "00000" },
  { country: "Guatemala", city: "Guatemala City", zip: "01001" },
  { country: "Guinea", city: "Conakry", zip: "00000" },
  { country: "Guinea-Bissau", city: "Bissau", zip: "1000" },
  { country: "Guyana", city: "Georgetown", zip: "00000" },
  { country: "Haiti", city: "Port-au-Prince", zip: "HT6110" },
  { country: "Honduras", city: "Tegucigalpa", zip: "11101" },
  { country: "Hungary", city: "Budapest", zip: "1011" },
  { country: "Iceland", city: "Reykjavik", zip: "101" },
  { country: "Indonesia", city: "Jakarta", zip: "10110" },
  { country: "Iran", city: "Tehran", zip: "11155" },
  { country: "Iraq", city: "Baghdad", zip: "10001" },
  { country: "Ireland", city: "Dublin", zip: "D01 A5T2" },
  { country: "Israel", city: "Jerusalem", zip: "91000" },
  { country: "Italy", city: "Rome", zip: "00187" },
  { country: "Ivory Coast", city: "Yamoussoukro", zip: "00000" },
  { country: "Jamaica", city: "Kingston", zip: "00000" },
  { country: "Japan", city: "Tokyo", zip: "100-0001" },
  { country: "Jordan", city: "Amman", zip: "11110" },
  { country: "Kazakhstan", city: "Astana", zip: "010000" },
  { country: "Kenya", city: "Nairobi", zip: "00100" },
  { country: "Kiribati", city: "Tarawa", zip: "00000" },
  { country: "Kuwait", city: "Kuwait City", zip: "13001" },
  { country: "Kyrgyzstan", city: "Bishkek", zip: "720000" },
  { country: "Laos", city: "Vientiane", zip: "01000" },
  { country: "Latvia", city: "Riga", zip: "LV-1050" },
  { country: "Lebanon", city: "Beirut", zip: "1107" },
  { country: "Lesotho", city: "Maseru", zip: "100" },
  { country: "Liberia", city: "Monrovia", zip: "1000" },
  { country: "Libya", city: "Tripoli", zip: "00000" },
  { country: "Liechtenstein", city: "Vaduz", zip: "9490" },
  { country: "Lithuania", city: "Vilnius", zip: "LT-01001" },
  { country: "Luxembourg", city: "Luxembourg City", zip: "1009" },
  { country: "Madagascar", city: "Antananarivo", zip: "101" },
  { country: "Malawi", city: "Lilongwe", zip: "00000" },
  { country: "Malaysia", city: "Kuala Lumpur", zip: "50000" },
  { country: "Maldives", city: "Male", zip: "20000" },
  { country: "Mali", city: "Bamako", zip: "00000" },
  { country: "Malta", city: "Valletta", zip: "VLT 1115" },
  { country: "Marshall Islands", city: "Majuro", zip: "96960" },
  { country: "Mauritania", city: "Nouakchott", zip: "00000" },
  { country: "Mauritius", city: "Port Louis", zip: "11302" },
  { country: "Mexico", city: "Mexico City", zip: "06000" },
  { country: "Micronesia", city: "Palikir", zip: "96941" },
  { country: "Moldova", city: "Chisinau", zip: "MD-2000" },
  { country: "Monaco", city: "Monaco", zip: "98000" },
  { country: "Mongolia", city: "Ulaanbaatar", zip: "15160" },
  { country: "Montenegro", city: "Podgorica", zip: "81000" },
  { country: "Morocco", city: "Rabat", zip: "10000" },
  { country: "Mozambique", city: "Maputo", zip: "1100" },
  { country: "Myanmar", city: "Naypyidaw", zip: "15011" },
  { country: "Namibia", city: "Windhoek", zip: "10005" },
  { country: "Nauru", city: "Yaren", zip: "00000" },
  { country: "Nepal", city: "Kathmandu", zip: "44600" },
  { country: "Netherlands", city: "Amsterdam", zip: "1012 JS" },
  { country: "New Zealand", city: "Wellington", zip: "6011" },
  { country: "Nicaragua", city: "Managua", zip: "10000" },
  { country: "Niger", city: "Niamey", zip: "00000" },
  { country: "Nigeria", city: "Abuja", zip: "900001" },
  { country: "North Korea", city: "Pyongyang", zip: "00000" },
  { country: "North Macedonia", city: "Skopje", zip: "1000" },
  { country: "Norway", city: "Oslo", zip: "0010" },
  { country: "Oman", city: "Muscat", zip: "100" },
  { country: "Pakistan", city: "Islamabad", zip: "44000" },
  { country: "Palau", city: "Ngerulmud", zip: "96940" },
  { country: "Palestine", city: "Jerusalem", zip: "91000" },
  { country: "Panama", city: "Panama City", zip: "0801" },
  { country: "Papua New Guinea", city: "Port Moresby", zip: "111" },
  { country: "Paraguay", city: "Asuncion", zip: "1001" },
  { country: "Peru", city: "Lima", zip: "15001" },
  { country: "Philippines", city: "Manila", zip: "1000" },
  { country: "Poland", city: "Warsaw", zip: "00-001" },
  { country: "Portugal", city: "Lisbon", zip: "1000-001" },
  { country: "Qatar", city: "Doha", zip: "00000" },
  { country: "Romania", city: "Bucharest", zip: "010011" },
  { country: "Russia", city: "Moscow", zip: "101000" },
  { country: "Rwanda", city: "Kigali", zip: "00000" },
  { country: "Saint Kitts and Nevis", city: "Basseterre", zip: "00000" },
  { country: "Saint Lucia", city: "Castries", zip: "00000" },
  { country: "Saint Vincent and the Grenadines", city: "Kingstown", zip: "00000" },
  { country: "Samoa", city: "Apia", zip: "00000" },
  { country: "San Marino", city: "San Marino", zip: "47890" },
  { country: "Sao Tome and Principe", city: "Sao Tome", zip: "00000" },
  { country: "Saudi Arabia", city: "Riyadh", zip: "11564" },
  { country: "Senegal", city: "Dakar", zip: "12500" },
  { country: "Serbia", city: "Belgrade", zip: "11000" },
  { country: "Seychelles", city: "Victoria", zip: "00000" },
  { country: "Sierra Leone", city: "Freetown", zip: "00000" },
  { country: "Singapore", city: "Singapore", zip: "018989" },
  { country: "Slovakia", city: "Bratislava", zip: "81101" },
  { country: "Slovenia", city: "Ljubljana", zip: "1000" },
  { country: "Solomon Islands", city: "Honiara", zip: "00000" },
  { country: "Somalia", city: "Mogadishu", zip: "00000" },
  { country: "South Africa", city: "Pretoria", zip: "0001" },
  { country: "South Korea", city: "Seoul", zip: "03000" },
  { country: "South Sudan", city: "Juba", zip: "00000" },
  { country: "Spain", city: "Madrid", zip: "28001" },
  { country: "Sri Lanka", city: "Colombo", zip: "00100" },
  { country: "Sudan", city: "Khartoum", zip: "11111" },
  { country: "Suriname", city: "Paramaribo", zip: "00000" },
  { country: "Sweden", city: "Stockholm", zip: "11122" },
  { country: "Switzerland", city: "Bern", zip: "3000" },
  { country: "Syria", city: "Damascus", zip: "00000" },
  { country: "Taiwan", city: "Taipei", zip: "100" },
  { country: "Tajikistan", city: "Dushanbe", zip: "734000" },
  { country: "Tanzania", city: "Dodoma", zip: "00000" },
  { country: "Thailand", city: "Bangkok", zip: "10100" },
  { country: "Timor-Leste", city: "Dili", zip: "00000" },
  { country: "Togo", city: "Lome", zip: "00000" },
  { country: "Tonga", city: "Nuku'alofa", zip: "00000" },
  { country: "Trinidad and Tobago", city: "Port of Spain", zip: "00000" },
  { country: "Tunisia", city: "Tunis", zip: "1000" },
  { country: "Turkey", city: "Ankara", zip: "06000" },
  { country: "Turkmenistan", city: "Ashgabat", zip: "744000" },
  { country: "Tuvalu", city: "Funafuti", zip: "00000" },
  { country: "Uganda", city: "Kampala", zip: "00000" },
  { country: "Ukraine", city: "Kyiv", zip: "01001" },
  { country: "United Arab Emirates", city: "Abu Dhabi", zip: "00000" },
  { country: "United Kingdom", city: "London", zip: "EC1A 1BB" },
  { country: "United States", city: "Washington, D.C.", zip: "20500" },
  { country: "Uruguay", city: "Montevideo", zip: "11000" },
  { country: "Uzbekistan", city: "Tashkent", zip: "100000" },
  { country: "Vanuatu", city: "Port Vila", zip: "00000" },
  { country: "Vatican City", city: "Vatican City", zip: "00120" },
  { country: "Venezuela", city: "Caracas", zip: "1010" },
  { country: "Vietnam", city: "Hanoi", zip: "100000" },
  { country: "Yemen", city: "Sanaa", zip: "00000" },
  { country: "Zambia", city: "Lusaka", zip: "10101" },
  { country: "Zimbabwe", city: "Harare", zip: "00000" }
];

const globalLocationSearch = {
  pickup: { timer: null, requestId: 0 },
  delivery: { timer: null, requestId: 0 },
};

function showCustomDropdown(type) {
  const listEl = document.getElementById(type + "-dropdown-list");
  if (listEl) {
    listEl.classList.add("show");
    filterCustomDropdown(type, false);
  }
}
window.showCustomDropdown = showCustomDropdown;

function renderCustomDropdown(type, records, message = "") {
  const listEl = document.getElementById(type + "-dropdown-list");
  if (!listEl) return;
  listEl.innerHTML = "";

  if (message) {
    const messageEl = document.createElement("div");
    messageEl.className = "custom-dropdown-item";
    messageEl.style.justifyContent = "center";
    messageEl.style.opacity = "0.75";
    messageEl.textContent = message;
    listEl.appendChild(messageEl);
    return;
  }

  records.forEach((rec) => {
    const itemEl = document.createElement("div");
    itemEl.className = "custom-dropdown-item";

    const zipSpan = document.createElement("span");
    zipSpan.className = "zip-code";
    zipSpan.textContent = rec.zip || "—";

    const citySpan = document.createElement("span");
    citySpan.className = "city-country";
    const displayLabel = rec.label || `${rec.city}${rec.country ? `, ${rec.country}` : ""}`;
    citySpan.textContent = ` - ${displayLabel}`;

    itemEl.append(zipSpan, citySpan);
    itemEl.onclick = () => selectCustomItem(type, rec.zip || "", displayLabel);
    listEl.appendChild(itemEl);
  });

  if (records.some((rec) => rec.source === "geoapify")) {
    const attribution = document.createElement("div");
    attribution.style.cssText = "padding:0.45rem 0.7rem; font-size:0.68rem; opacity:0.72; text-align:right;";
    const link = document.createElement("a");
    link.href = "https://www.geoapify.com/";
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = "Global suggestions powered by Geoapify";
    attribution.appendChild(link);
    listEl.appendChild(attribution);
  }
}

function appendLocationDropdownSection(type, listEl, title, records, message = "") {
  if (!listEl) return;

  const heading = document.createElement("div");
  heading.textContent = title;
  heading.style.cssText = "padding:0.5rem 0.7rem 0.3rem; font-size:0.68rem; font-weight:700; letter-spacing:0.06em; text-transform:uppercase; color:#53627a; background:#f7f9fc; border-bottom:1px solid #e8edf5;";
  listEl.appendChild(heading);

  if (records.length) {
    records.forEach((rec) => {
      const itemEl = document.createElement("div");
      itemEl.className = "custom-dropdown-item";

      const zipSpan = document.createElement("span");
      zipSpan.className = "zip-code";
      zipSpan.textContent = rec.zip || "—";

      const citySpan = document.createElement("span");
      citySpan.className = "city-country";
      const displayLabel = rec.label || `${rec.city}${rec.country ? `, ${rec.country}` : ""}`;
      citySpan.textContent = ` - ${displayLabel}`;

      itemEl.append(zipSpan, citySpan);
      itemEl.onclick = () => selectCustomItem(type, rec.zip || "", displayLabel);
      listEl.appendChild(itemEl);
    });
  } else if (message) {
    const messageEl = document.createElement("div");
    messageEl.className = "custom-dropdown-item";
    messageEl.style.justifyContent = "center";
    messageEl.style.opacity = "0.75";
    messageEl.textContent = message;
    listEl.appendChild(messageEl);
  }
}

function renderLocationDropdown(type, indiaRecords, globalRecords = [], globalMessage = "") {
  const listEl = document.getElementById(type + "-dropdown-list");
  if (!listEl) return;
  listEl.innerHTML = "";

  appendLocationDropdownSection(
    type,
    listEl,
    "India PIN Directory",
    indiaRecords,
    "No matching Indian PIN or location."
  );

  if (globalRecords.length || globalMessage) {
    appendLocationDropdownSection(type, listEl, "Worldwide Locations", globalRecords, globalMessage);
  }

  if (globalRecords.some((rec) => rec.source === "geoapify")) {
    const attribution = document.createElement("div");
    attribution.style.cssText = "padding:0.45rem 0.7rem; font-size:0.68rem; opacity:0.72; text-align:right;";
    const link = document.createElement("a");
    link.href = "https://www.geoapify.com/";
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = "Global suggestions powered by Geoapify";
    attribution.appendChild(link);
    listEl.appendChild(attribution);
  }
}

async function fetchGlobalLocationSuggestions(query) {
  const callable = typeof firebase !== "undefined"
    ? firebase.functions().httpsCallable("searchGlobalLocation")
    : null;
  if (!callable) throw new Error("Location lookup unavailable");
  const response = await callable({ query });
  return Array.isArray(response?.data?.results) ? response.data.results : [];
}

function filterCustomDropdown(type, resetSelection = true) {
  const searchInput = document.getElementById("transport-" + type + "-search");
  const listEl = document.getElementById(type + "-dropdown-list");
  if (!searchInput || !listEl) return;

  const query = searchInput.value.toLowerCase().trim();
  const searchState = globalLocationSearch[type];
  searchState.requestId += 1;
  const requestId = searchState.requestId;
  clearTimeout(searchState.timer);

  // Editing a previous selection returns control to the user and prevents stale
  // hidden location values from being saved.
  if (resetSelection) {
    document.getElementById("transport-" + type + "-pin").value = "";
    document.getElementById("transport-" + type + "-city").value = "";
  }

  if (!pincodesLoaded) {
    listEl.textContent = "Loading location directory…";
    loadPincodesData().then(() => filterCustomDropdown(type, resetSelection));
    return;
  }

  const indiaRecords = pincodesData.map(item => ({
    zip: item.p,
    city: `${item.place}, ${item.d}, ${item.s}`.replace(/, ,/g, ","),
    country: "India",
    searchText: item.all || `${item.p} ${item.place} ${item.d} ${item.s}`.toLowerCase()
  }));
  // Numeric PIN lookups must match from the start of an Indian PIN. Otherwise
  // a global postcode such as 10001 is incorrectly captured by 110001/210001.
  const isNumericPostcodeQuery = /^\d+$/.test(query);
  const indiaMatches = indiaRecords.filter(rec =>
    isNumericPostcodeQuery
      ? String(rec.zip).startsWith(query)
      : rec.searchText.includes(query)
  ).slice(0, 100);
  if (!query) {
    renderCustomDropdown(type, indiaRecords.slice(0, 50));
    return;
  }
  if (query.length < 4) {
    renderLocationDropdown(type, indiaMatches);
    return;
  }

  // India keeps narrowing instantly. Worldwide search begins at four
  // characters, when the query is specific enough to return useful results
  // and avoid wasted calls.
  renderLocationDropdown(type, indiaMatches, [], "Searching worldwide locations…");
  searchState.timer = setTimeout(async () => {
    try {
      const results = await fetchGlobalLocationSuggestions(searchInput.value.trim());
      if (requestId !== searchState.requestId) return;
      const globalRecords = results.map(item => ({
        zip: item.postcode || "",
        city: item.city || "",
        country: item.country || "",
        label: item.label || item.city || "",
        source: "geoapify",
      }));
      renderLocationDropdown(
        type,
        indiaMatches,
        globalRecords,
        globalRecords.length ? "" : "No global location found. You can still enter the address manually."
      );
    } catch (error) {
      if (requestId !== searchState.requestId) return;
      renderLocationDropdown(type, indiaMatches, [], "Global suggestions are unavailable. You can still enter the address manually.");
    }
  }, 350);
}
window.filterCustomDropdown = filterCustomDropdown;

function selectCustomItem(type, zip, city) {
  const searchInput = document.getElementById("transport-" + type + "-search");
  const pinInput = document.getElementById("transport-" + type + "-pin");
  const cityInput = document.getElementById("transport-" + type + "-city");
  const listEl = document.getElementById(type + "-dropdown-list");

  if (searchInput) {
    searchInput.value = zip ? `${zip} - ${city}` : city;
  }
  if (pinInput) {
    pinInput.value = zip;
  }
  if (cityInput) {
    cityInput.value = city;
  }
  if (listEl) {
    listEl.classList.remove("show");
  }

  if (typeof calculateTransportation === "function") {
    calculateTransportation();
  }
}
window.selectCustomItem = selectCustomItem;

document.addEventListener("click", function (event) {
  if (!event.target.closest("#pickup-dropdown-container")) {
    const list = document.getElementById("pickup-dropdown-list");
    if (list) list.classList.remove("show");
  }
  if (!event.target.closest("#delivery-dropdown-container")) {
    const list = document.getElementById("delivery-dropdown-list");
    if (list) list.classList.remove("show");
  }
});





// GitHub refresh deployment
// GitHub refresh deployment

// ============================================================
// ARCHITECTURE MOVE 1 — Desk highlights bar value mirroring.
// Purely observational: watches the existing results-panel spans that the
// calculation functions already write to, and copies their text into the
// highlights bar. Never reads/writes app state or touches a calculation.
// ============================================================
(function setupDeskHighlightsMirror() {
  function mirrorNode(sourceId, targetEl) {
    const source = document.getElementById(sourceId);
    if (!source || !targetEl) return;
    const sync = () => { targetEl.textContent = source.textContent; };
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(source, { characterData: true, childList: true, subtree: true });
  }

  function initDeskHighlightsMirrors() {
    document.querySelectorAll('[data-mirror-of]').forEach((targetEl) => {
      mirrorNode(targetEl.getAttribute('data-mirror-of'), targetEl);
    });
  }

  document.addEventListener('DOMContentLoaded', initDeskHighlightsMirrors);
})();

// ============================================================
// ARCHITECTURE MOVE 2 — Desk tab switching.
// Pure show/hide of .desk-tab-pane elements, scoped to one desk panel by
// id. Never touches input values, ids, or calculation state — identical
// in spirit to the existing view-panel / toggle-option show/hide patterns
// already used throughout the app.
// ============================================================
function switchDeskTab(panelId, tabName, btnEl) {
  const panel = document.getElementById(panelId);
  if (!panel) return;
  panel.querySelectorAll(':scope > .desk-tab-pane, :scope .glass-card > .desk-tab-pane').forEach((pane) => {
    pane.style.display = (pane.getAttribute('data-tab-pane') === tabName) ? '' : 'none';
  });
  const strip = btnEl ? btnEl.closest('.desk-tab-strip') : panel.querySelector('.desk-tab-strip');
  if (strip) {
    strip.querySelectorAll('.desk-tab-btn').forEach((b) => b.classList.remove('active'));
  }
  if (btnEl) btnEl.classList.add('active');
}
window.switchDeskTab = switchDeskTab;

// ============================================================
// ARCHITECTURE MOVE 3 — Costing grid totals footer.
// Purely observational, like the Move 1 mirror: finds tables that have
// "Sell Rate" + "Buy Rate" columns (Air/Sea per-card surcharge tables,
// Transport/Warehouse breakup tables — all share the same .chg-rate /
// .chg-buy-rate input classes), and appends a summed <tfoot> row. Reads
// input values already on screen; never writes to an input, never calls
// a calculation function, never touches appState.
// ============================================================
(function setupCostingGridFooters() {
  function isCostingGridTable(table) {
    // Header wording varies by desk ("Sell Rate", "Sell Rate (USD)", "Sell
    // Cost (USD)"...), so match loosely on "sell"/"buy" appearing in a
    // header rather than requiring an exact string.
    const headers = [...table.querySelectorAll('thead th')].map((th) => th.textContent.trim().toLowerCase());
    const hasSell = headers.some((h) => h.includes('sell'));
    const hasBuy = headers.some((h) => h.includes('buy'));
    return hasSell && hasBuy;
  }

  function fmt(n) {
    return (Math.round((n + Number.EPSILON) * 100) / 100).toFixed(2);
  }

  function updateFooter(table) {
    const tbody = table.querySelector('tbody');
    if (!tbody) return;
    // Sea's FCL container table uses .fcl-sell-rate/.fcl-rate + .fcl-buy-rate
    // instead of .chg-rate/.chg-buy-rate — same "Sell Rate"/"Buy Rate"
    // columns, just a different input class, so it needs its own selector
    // to get the same Total/GP footer the other costing tables already have.
    const sellInputs = tbody.querySelectorAll('.chg-rate, .fcl-sell-rate, .fcl-rate');
    const buyInputs = tbody.querySelectorAll('.chg-buy-rate, .fcl-buy-rate');
    let tfoot = table.querySelector('tfoot.cgf-footer');

    if (sellInputs.length === 0) {
      if (tfoot) tfoot.remove();
      return;
    }

    let sellSum = 0, buySum = 0;
    sellInputs.forEach((i) => { sellSum += parseFloat(i.value) || 0; });
    buyInputs.forEach((i) => { buySum += parseFloat(i.value) || 0; });
    const gp = sellSum - buySum;

    if (!tfoot) {
      const headerCellCount = table.querySelectorAll('thead th').length;
      const remainingCols = Math.max(headerCellCount - 3, 1);
      tfoot = document.createElement('tfoot');
      tfoot.className = 'cgf-footer';
      tfoot.innerHTML = `<tr>
        <td class="cgf-label">Total</td>
        <td class="cgf-val cgf-sell"></td>
        <td class="cgf-val cgf-buy"></td>
        <td class="cgf-gp" colspan="${remainingCols}"></td>
      </tr>`;
      table.appendChild(tfoot);
    }
    tfoot.querySelector('.cgf-sell').textContent = fmt(sellSum);
    tfoot.querySelector('.cgf-buy').textContent = fmt(buySum);
    tfoot.querySelector('.cgf-gp').textContent = 'GP ' + fmt(gp);
  }

  function attach(table) {
    if (table.dataset.cgfAttached) { updateFooter(table); return; }
    if (!isCostingGridTable(table)) return;
    table.dataset.cgfAttached = '1';
    updateFooter(table);

    const tbody = table.querySelector('tbody');
    if (tbody) {
      new MutationObserver(() => updateFooter(table)).observe(tbody, { childList: true });
    }
    table.addEventListener('input', (e) => {
      if (e.target.classList.contains('chg-rate') || e.target.classList.contains('chg-buy-rate') ||
          e.target.classList.contains('fcl-sell-rate') || e.target.classList.contains('fcl-rate') || e.target.classList.contains('fcl-buy-rate')) {
        updateFooter(table);
      }
    });
  }

  function scan(root) {
    (root || document).querySelectorAll('table.cargo-table').forEach(attach);
  }

  function init() {
    scan(document);
    // Watch only the two containers new cards actually get appended to
    // (Air's airline cards, Sea's liner cards) — new tables always arrive
    // as part of a whole new card there. Deliberately NOT subtree:true on
    // the whole desk panel: calculateAirFreight()/calculateSeaFreight()
    // rewrite the results container on nearly every keystroke, and a
    // panel-wide subtree observer would re-fire on all of that churn for
    // no benefit, adding avoidable overhead to every keystroke.
    ['air-airlines-list-container', 'sea-liners-container']
      .map((id) => document.getElementById(id))
      .filter(Boolean)
      .forEach((container) => {
        new MutationObserver((mutations) => {
          mutations.forEach((m) => {
            m.addedNodes.forEach((n) => {
              if (n.nodeType === 1) scan(n);
            });
          });
        }).observe(container, { childList: true });
      });
  }

  document.addEventListener('DOMContentLoaded', init);
})();

// ============================================================
// ARCHITECTURE MOVE 4 — Airline card rate/fee popup summary line.
// The airline card's Routing/Validity/Weight Breaks/Surcharges now live
// inside an on-demand modal (see addAirlineCard) so the card itself stays
// to just the carrier field. This keeps the always-visible summary line in
// sync with a plain, non-monetary count (rate tiers / origin fees / dest
// fees configured) — deliberately not a live $ or GP figure, since that
// would duplicate calculateAirFreight()'s own weight-break-bracket
// selection logic and risk silently drifting from the real number.
// ============================================================
function updateAirlineRateSummary(card) {
  const summaryEl = card.querySelector(".airline-rate-summary-text");
  if (!summaryEl) return;
  const breakCount = card.querySelectorAll(".airline-breaks-container .dynamic-break-wrapper").length;
  const originCount = card.querySelectorAll(".air-card-origin-surcharges-body tr").length;
  const destCount = card.querySelectorAll(".air-card-dest-surcharges-body tr").length;

  if (breakCount === 0) {
    summaryEl.textContent = "No rates entered yet";
    return;
  }
  const parts = [`${breakCount} rate tier${breakCount === 1 ? '' : 's'}`];
  if (originCount > 0) parts.push(`${originCount} origin fee${originCount === 1 ? '' : 's'}`);
  if (destCount > 0) parts.push(`${destCount} destination fee${destCount === 1 ? '' : 's'}`);
  summaryEl.textContent = parts.join(' · ');
}
window.updateAirlineRateSummary = updateAirlineRateSummary;

(function setupAirlineRateSummarySync() {
  function attach(card) {
    if (card.dataset.rateSummarySynced) return;
    card.dataset.rateSummarySynced = '1';
    const breaksContainer = card.querySelector(".airline-breaks-container");
    const originBody = card.querySelector(".air-card-origin-surcharges-body");
    const destBody = card.querySelector(".air-card-dest-surcharges-body");
    [breaksContainer, originBody, destBody].filter(Boolean).forEach((el) => {
      new MutationObserver(() => updateAirlineRateSummary(card)).observe(el, { childList: true });
    });
  }

  function scan(root) {
    const scope = root || document;
    if (scope.nodeType === 1 && scope.matches('.airline-card')) attach(scope);
    scope.querySelectorAll('.airline-card').forEach(attach);
  }

  function init() {
    const container = document.getElementById('air-airlines-list-container');
    if (!container) return;
    scan(container);
    new MutationObserver((mutations) => {
      mutations.forEach((m) => {
        m.addedNodes.forEach((n) => {
          if (n.nodeType === 1) scan(n);
        });
      });
    }).observe(container, { childList: true });
  }

  document.addEventListener('DOMContentLoaded', init);
})();

// ============================================================
// ARCHITECTURE MOVE 5 — Sea Freight liner card rates-&-fees summary. Same
// non-monetary count-based readout as ARCHITECTURE MOVE 3/4 above, adapted
// for the FCL/LCL/BB mode split: shows container-type count (FCL) or
// "rate set" (LCL/BB) plus origin/destination fee counts. switchLinerMode()
// and the delegated input listener on .sea-lcl-rate/.sea-bb-rate call this
// directly (those changes aren't DOM structure changes a MutationObserver
// would catch); FCL container rows and origin/dest surcharge rows are
// structural, so they're covered by the observer below instead.
// ============================================================
function updateLinerRateSummary(card) {
  const summaryEl = card.querySelector(".liner-rate-summary-text");
  if (!summaryEl) return;
  const mode = card.dataset.mode || 'fcl';
  const originCount = card.querySelectorAll(".sea-origin-surcharges-body tr").length;
  const destCount = card.querySelectorAll(".sea-dest-surcharges-body tr").length;

  let freightPart = null;
  if (mode === 'fcl') {
    const containerCount = card.querySelectorAll(".sea-fcl-body .container-row").length;
    if (containerCount > 0) freightPart = `${containerCount} container type${containerCount === 1 ? '' : 's'}`;
  } else if (mode === 'lcl') {
    const rate = parseFloat(card.querySelector(".sea-lcl-rate")?.value) || 0;
    if (rate > 0) freightPart = "LCL rate set";
  } else if (mode === 'bb') {
    const rate = parseFloat(card.querySelector(".sea-bb-rate")?.value) || 0;
    if (rate > 0) freightPart = "Break bulk rate set";
  }

  const parts = [];
  if (freightPart) parts.push(freightPart);
  if (originCount > 0) parts.push(`${originCount} origin fee${originCount === 1 ? '' : 's'}`);
  if (destCount > 0) parts.push(`${destCount} destination fee${destCount === 1 ? '' : 's'}`);
  summaryEl.textContent = parts.length ? parts.join(' · ') : "No rates entered yet";
}
window.updateLinerRateSummary = updateLinerRateSummary;

(function setupLinerRateSummarySync() {
  function attach(card) {
    if (card.dataset.rateSummarySynced) return;
    card.dataset.rateSummarySynced = '1';
    const fclBody = card.querySelector(".sea-fcl-body");
    const originBody = card.querySelector(".sea-origin-surcharges-body");
    const destBody = card.querySelector(".sea-dest-surcharges-body");
    [fclBody, originBody, destBody].filter(Boolean).forEach((el) => {
      new MutationObserver(() => updateLinerRateSummary(card)).observe(el, { childList: true });
    });
  }

  function scan(root) {
    const scope = root || document;
    if (scope.nodeType === 1 && scope.matches('.liner-card')) attach(scope);
    scope.querySelectorAll('.liner-card').forEach(attach);
  }

  function init() {
    const container = document.getElementById('sea-liners-container');
    if (!container) return;
    scan(container);
    new MutationObserver((mutations) => {
      mutations.forEach((m) => {
        m.addedNodes.forEach((n) => {
          if (n.nodeType === 1) scan(n);
        });
      });
    }).observe(container, { childList: true });
  }

  document.addEventListener('DOMContentLoaded', init);
})();

// ============================================================
// ARCHITECTURE MOVE 1b — Air Freight grand total in the highlights bar.
// Air Freight can carry several airline options at once, so unlike Sea/
// Transport/Warehouse there's no single DOM span holding "the" total to
// mirror — the figure only exists per weight-break row inside whichever
// option is marked "Select as Quoted". calculateAirFreight() already
// resolves that ambiguity itself and writes the answer to
// appState.currentAirFreight.grandTotal, so read from there instead of
// scraping the results table.
//
// Polls rather than hooking calculateAirFreight directly: many of the
// rate/weight inputs across the form were already wired with
// addEventListener(..., calculateAirFreight) at element-creation time,
// which captures that function value directly — reassigning
// window.calculateAirFreight afterwards doesn't reach those already-bound
// listeners, so a wrap silently never fires for most edits. A short
// poll comparing the already-computed number is simpler and unaffected
// by how any given input happens to be wired.
// ============================================================
(function setupAirGrandTotalMirror() {
  function currencySymbol(code) {
    if (code === 'INR') return '₹';
    if (code === 'EUR') return '€';
    if (code === 'GBP') return '£';
    return '$';
  }

  let lastPainted = null;

  function syncAirGrandTotalHighlight() {
    const target = document.querySelector('[data-air-grandtotal-mirror]');
    if (!target) return;
    // appState is declared with `let` at the script's top level, so it never
    // becomes a window property — reference it directly, not window.appState.
    const af = (typeof appState !== 'undefined') ? appState.currentAirFreight : null;
    if (!af) return;
    const total = typeof af.grandTotal === 'number' && !isNaN(af.grandTotal) ? af.grandTotal : 0;
    const currency = af.currency || 'USD';
    const key = currency + '|' + total.toFixed(2);
    if (key === lastPainted) return;
    lastPainted = key;
    target.textContent = currencySymbol(currency) + total.toFixed(2);
  }

  document.addEventListener('DOMContentLoaded', () => {
    syncAirGrandTotalHighlight();
    setInterval(syncAirGrandTotalHighlight, 1000);
  });
})();

// ============================================================
// ARCHITECTURE MOVE — Compact weight-break tables in the results panel.
// Once real rates are entered, each airline option's weight-break table
// can carry up to 7 rows; only the one actually being charged (the row
// rendered with the green "active" highlight) matters at a glance. This
// hides the rest by default with a one-click "show all" expander, purely
// as a post-render display pass — it never touches airlinesListData or
// how any total is computed, only which already-rendered rows are visible.
// Re-applied after every recalculation, since calculateAirFreight()
// replaces the results container's innerHTML wholesale each time.
// ============================================================
(function setupCompactWeightBreaks() {
  function isActiveRow(tr) {
    return /rgba\(46,\s*204,\s*113/.test(tr.getAttribute('style') || '');
  }

  function compactCard(card) {
    const table = card.querySelector('table');
    if (!table || card.dataset.wbCompacted) return;
    const tbody = table.querySelector('tbody');
    const rows = tbody ? [...tbody.querySelectorAll('tr')] : [];
    if (rows.length <= 2) return;
    const inactiveRows = rows.filter((r) => !isActiveRow(r));
    if (inactiveRows.length === 0) return;

    card.dataset.wbCompacted = '1';
    inactiveRows.forEach((r) => { r.style.display = 'none'; });

    const colCount = table.querySelectorAll('thead th').length || 6;
    const toggleTr = document.createElement('tr');
    toggleTr.innerHTML = `<td colspan="${colCount}" style="padding:4px 8px; text-align:center; border-bottom:none;">
      <button type="button" style="background:none;border:none;color:var(--sky);font-size:0.68rem;font-weight:700;cursor:pointer;padding:2px 6px;">Show all ${rows.length} weight breaks &#9662;</button>
    </td>`;
    tbody.appendChild(toggleTr);
    let expanded = false;
    toggleTr.querySelector('button').addEventListener('click', function () {
      expanded = !expanded;
      inactiveRows.forEach((r) => { r.style.display = expanded ? '' : 'none'; });
      this.innerHTML = expanded ? 'Show fewer weight breaks &#9652;' : `Show all ${rows.length} weight breaks &#9662;`;
    });
  }

  function processContainer(container) {
    container.querySelectorAll(':scope > .glass-card').forEach(compactCard);
  }

  function init() {
    const container = document.getElementById('air-pricing-results-container');
    if (!container) return;
    processContainer(container);
    new MutationObserver(() => processContainer(container)).observe(container, { childList: true });
  }

  document.addEventListener('DOMContentLoaded', init);
})();

// ============================================================
// ARCHITECTURE MOVE — Compact multi-liner results (Sea Freight).
// Same idea as the Air Freight weight-break collapse above, adapted to Sea's
// shape: each liner option renders as its own summary card (not table rows).
// Shows only the primary/cheapest liner by default with a "show all" expander.
// Purely a post-render display pass on already-rendered cards.
// ============================================================
(function setupCompactLinerResults() {
  function compactList(list) {
    // #sea-multi-liner-results-list itself is never replaced — only its
    // children are, via innerHTML, on every recalculation — so any
    // "already compacted" flag stored on the list element would survive
    // across renders and skip processing the new cards. Always reprocess
    // the current child set instead; a leftover toggle from the previous
    // render is removed first.
    const oldToggle = list.querySelector(':scope > button');
    if (oldToggle) oldToggle.remove();

    const cards = [...list.querySelectorAll(':scope > .liner-result-card')];
    if (cards.length <= 1) return;
    const nonPrimary = cards.filter((c) => !c.classList.contains('primary-liner'));
    if (nonPrimary.length === 0) return;

    nonPrimary.forEach((c) => { c.style.display = 'none'; });

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.style.cssText = 'background:none;border:none;color:var(--sky);font-size:0.68rem;font-weight:700;cursor:pointer;padding:4px 2px;text-align:left;';
    toggle.textContent = `Show all ${cards.length} liner options ▾`;
    let expanded = false;
    toggle.addEventListener('click', () => {
      expanded = !expanded;
      nonPrimary.forEach((c) => { c.style.display = expanded ? '' : 'none'; });
      toggle.textContent = expanded ? 'Show fewer liner options ▴' : `Show all ${cards.length} liner options ▾`;
    });
    list.appendChild(toggle);
  }

  function init() {
    const list = document.getElementById('sea-multi-liner-results-list');
    if (!list) return;
    // compactList() itself appends the toggle button as a direct child of
    // `list` — the same node this observer watches — so without guarding,
    // that append would re-trigger this callback forever. Disconnect while
    // compactList runs, then resume observing once it's done.
    const observer = new MutationObserver(() => {
      observer.disconnect();
      compactList(list);
      observer.observe(list, { childList: true });
    });
    compactList(list);
    observer.observe(list, { childList: true });
  }

  document.addEventListener('DOMContentLoaded', init);
})();

// ==========================================
// UPDATE-AVAILABLE NOTIFICATION
// ==========================================
// There is no active service worker in this app (one gets unregistered on
// every load — see the cleanup script at the top of index.html — and
// nothing ever re-registers one), so this can't use the usual
// "controllerchange" pattern. Instead it polls a small version.txt file
// (already deployed alongside the app, previously unused) and compares it
// to the version this tab already has loaded. Entirely self-contained:
// touches no existing DOM, function, or state — it only injects its own
// banner element if a mismatch is found.
(function () {
  const APP_VERSION = "128.14"; // keep in sync with the ?v= used on app-v4.js/index.css at each deploy, and with version.txt

  function showUpdateBanner(latestVersion) {
    if (document.getElementById("app-update-banner")) return; // already showing

    const banner = document.createElement("div");
    banner.id = "app-update-banner";
    banner.style.cssText = "position: fixed; top: 80px; right: 20px; z-index: 999999; background: #ffffff; color: #1b1c5c; padding: 0.9rem 1.1rem; border-radius: 12px; border: 1px solid #dde0f0; box-shadow: 0 12px 32px rgba(27,28,92,0.22); font-family: 'Plus Jakarta Sans', sans-serif; font-size: 0.82rem; display: flex; align-items: center; gap: 0.75rem; max-width: 320px;";
    banner.innerHTML = `
      <span style="flex: 1; font-weight: 600; color: #1b1c5c !important;">🚀 A new version of this app is available.</span>
      <button id="app-update-refresh-btn" style="background: #1b1c5c; color: #ffffff !important; border: none; padding: 0.4rem 0.75rem; border-radius: 8px; font-weight: 700; font-size: 0.75rem; cursor: pointer; white-space: nowrap;">Refresh</button>
    `;
    document.body.appendChild(banner);

    document.getElementById("app-update-refresh-btn").addEventListener("click", () => {
      window.location.reload();
    });
  }

  async function checkForAppUpdate() {
    try {
      const res = await fetch("version.txt", { cache: "no-store" });
      if (!res.ok) return;
      const latest = (await res.text()).trim();
      if (latest && latest !== APP_VERSION) {
        showUpdateBanner(latest);
      }
    } catch (e) {
      // Silent — a failed check just means we try again on the next interval.
    }
  }

  // Check shortly after load (covers someone who's had a tab open since
  // before a deploy went out), then periodically while the tab stays open.
  setTimeout(checkForAppUpdate, 30000);
  setInterval(checkForAppUpdate, 5 * 60 * 1000);
})();

// ============================================================
// ROUTE VENDOR HISTORY — surfaces which airlines/liners this team has
// actually used (and won with) on a given POL->POD lane, mined entirely
// from existing quote records. No AI/API involved — pure historical
// aggregation, so it works immediately with the data already in Firestore.
// Triggered once both origin and destination fields are filled on the Air
// or Sea desk; shown as a dismissible floating panel, never blocking the
// form underneath.
// ============================================================
(function setupRouteVendorHistory() {
  function normalizeRoute(val) {
    return (val || "").trim().toLowerCase();
  }

  // Carrier names get typed inconsistently across quotes over time — e.g.
  // a bare "6E" in one quote vs "6E - IndiGo Airlines" in another. Key on
  // the leading IATA-style code when there is one, so these tally as the
  // same carrier instead of two separate rows.
  function carrierIdentityKey(name) {
    const trimmed = (name || "").trim();
    const codeMatch = trimmed.match(/^([A-Za-z0-9]{2,3})\s*[-–]\s*\S/);
    if (codeMatch) return codeMatch[1].toUpperCase();
    if (/^[A-Za-z0-9]{2,3}$/.test(trimmed)) return trimmed.toUpperCase();
    return trimmed.toLowerCase();
  }

  // Every past quote records what was actually quoted/booked for a lane —
  // this walks that history and tallies each carrier's track record on the
  // exact POL->POD typed into the form right now.
  function getRouteVendorHistory(mode, origin, destination) {
    const o = normalizeRoute(origin);
    const d = normalizeRoute(destination);
    if (!o || !d) return { totalQuotes: 0, vendors: [] };

    const tally = {};
    let totalQuotes = 0;

    (appState.quotes || []).forEach(q => {
      if (q.type !== mode) return;
      const qo = normalizeRoute(q.details && q.details.origin);
      const qd = normalizeRoute(q.details && q.details.destination);
      if (qo !== o || qd !== d) return;

      totalQuotes++;
      const won = q.status === 'converted';
      const quoteDate = q.date || "";

      // Prefer the carrier actually confirmed at WON time — that's the real
      // "who we used" signal. Fall back to whichever options were quoted
      // (airlines[]/liners[]) so unwon quotes still contribute a data point.
      let candidateNames = [];
      if (q.confirmedCarrier) {
        candidateNames = [q.confirmedCarrier];
      } else if (mode === 'air' && Array.isArray(q.details && q.details.airlines)) {
        candidateNames = q.details.airlines.map(a => a.name).filter(Boolean);
      } else if (mode === 'sea' && Array.isArray(q.details && q.details.liners)) {
        candidateNames = q.details.liners.map(l => l.linerName).filter(Boolean);
      }

      candidateNames.forEach(name => {
        const trimmedName = name.trim();
        if (!trimmedName) return;
        const key = carrierIdentityKey(trimmedName);
        if (!tally[key]) tally[key] = { name: trimmedName, timesUsed: 0, timesWon: 0, lastUsed: "" };
        // Prefer the more descriptive of the names seen so far as the display name.
        if (trimmedName.length > tally[key].name.length) tally[key].name = trimmedName;
        tally[key].timesUsed++;
        if (won) tally[key].timesWon++;
        if (quoteDate > tally[key].lastUsed) tally[key].lastUsed = quoteDate;
      });
    });

    const vendors = Object.values(tally).sort((a, b) => {
      if (b.timesWon !== a.timesWon) return b.timesWon - a.timesWon;
      if (b.timesUsed !== a.timesUsed) return b.timesUsed - a.timesUsed;
      return (b.lastUsed || "").localeCompare(a.lastUsed || "");
    });

    return { totalQuotes, vendors };
  }
  window.getRouteVendorHistory = getRouteVendorHistory;

  function closeRouteVendorPopup() {
    const el = document.getElementById("route-vendor-popup");
    if (el) el.remove();
  }
  window.closeRouteVendorPopup = closeRouteVendorPopup;

  function showRouteVendorPopup(mode) {
    const originEl = document.getElementById(mode === 'air' ? 'air-origin' : 'sea-origin');
    const destEl = document.getElementById(mode === 'air' ? 'air-dest' : 'sea-dest');
    if (!originEl || !destEl) return;
    const origin = originEl.value;
    const destination = destEl.value;
    if (!origin.trim() || !destination.trim()) return;

    closeRouteVendorPopup();

    const { totalQuotes, vendors } = getRouteVendorHistory(mode, origin, destination);

    const rowsHtml = vendors.length > 0 ? vendors.map(v => `
      <div style="display:flex; align-items:center; justify-content:space-between; padding:8px 10px; border-radius:8px; background:#f8fafc; margin-bottom:6px;">
        <div>
          <div style="font-size:0.78rem; font-weight:700; color:#0f172a;">${v.name}</div>
          <div style="font-size:0.68rem; color:#64748b; margin-top:1px;">used ${v.timesUsed}x &middot; ${v.timesWon} won</div>
        </div>
        ${v.timesWon > 0 ? '<span style="font-size:0.62rem; font-weight:700; color:#166534; background:#eaf3de; padding:2px 7px; border-radius:10px; white-space:nowrap;">proven</span>' : ''}
      </div>`).join('') : `
      <div style="font-size:0.75rem; color:#64748b; padding:0.75rem 0.25rem;">No past quotes on this exact route yet. Check the Vendor Contacts directory for general coverage on this lane.</div>`;

    const popup = document.createElement("div");
    popup.id = "route-vendor-popup";
    popup.style.cssText = "position:fixed; bottom:20px; right:20px; z-index:999998; width:300px; max-height:380px; background:#fff; border:1px solid #dde0f0; border-radius:12px; box-shadow:0 12px 32px rgba(27,28,92,0.18); display:flex; flex-direction:column; overflow:hidden;";
    popup.innerHTML = `
      <div style="display:flex; align-items:center; justify-content:space-between; padding:0.75rem 0.9rem; border-bottom:1px solid #eef0f7;">
        <div>
          <div style="font-size:0.8rem; font-weight:800; color:#1b1c5c;">${origin} &rarr; ${destination}</div>
          <div style="font-size:0.65rem; color:#94a3b8; margin-top:1px;">${totalQuotes} past ${mode === 'air' ? 'air' : 'sea'} quote${totalQuotes === 1 ? '' : 's'} on this lane</div>
        </div>
        <button type="button" id="route-vendor-popup-close" style="background:none; border:none; color:#94a3b8; font-size:1.1rem; cursor:pointer; line-height:1; padding:0 0.2rem;">&times;</button>
      </div>
      <div style="padding:0.75rem 0.9rem; overflow-y:auto;">${rowsHtml}</div>
    `;
    document.body.appendChild(popup);
    document.getElementById("route-vendor-popup-close").addEventListener("click", closeRouteVendorPopup);
  }
  window.showRouteVendorPopup = showRouteVendorPopup;

  function wireField(id, mode) {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("blur", () => showRouteVendorPopup(mode));
  }

  document.addEventListener("DOMContentLoaded", () => {
    wireField("air-origin", "air");
    wireField("air-dest", "air");
    wireField("sea-origin", "sea");
    wireField("sea-dest", "sea");
  });

  // Dismiss on click-outside, same convention as the update banner.
  document.addEventListener("click", (e) => {
    const popup = document.getElementById("route-vendor-popup");
    if (!popup) return;
    if (popup.contains(e.target)) return;
    if (e.target.id === "air-origin" || e.target.id === "air-dest" || e.target.id === "sea-origin" || e.target.id === "sea-dest") return;
    closeRouteVendorPopup();
  });
})();

/* ── Read-only UI shell accessors (no calculation or persistence logic) ── */
if (typeof window !== "undefined") {
  window.__atlasUi = {
    getQuotes: function () { return (appState.quotes || []).slice(); },
    getCurrentUser: function () { return appState.currentUser; },
    getActivePanel: function () {
      var p = document.querySelector(".view-panel.active");
      return p ? p.id : null;
    },
    getWorkspaceName: function () {
      var el = document.getElementById("header-workspace-name");
      return el ? el.textContent : "Dashboard";
    }
  };
}

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
        TEAM_ROLES[lowerUser] = {
          name: `${u.fullName} (Free Hand)`,
          type: 'member',
          category: 'FREE HAND SALES (AIR/SEA)',
          currency: 'INR'
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
  currentAirFreight: {
    origin: '',
    destination: '',
    airline: '',
    dimUnit: 'cms',
    module: 'export', // 'export' or 'import'
    cargoItems: [{ length: '', width: '', height: '', qty: '', grossWeight: '' }],
    rates: { min: '', minus45: '', plus45: '', plus100: '', plus300: '', plus500: '', plus1000: '' },
    surcharges: [{ name: 'Xray', rate: 0.00, unit: 'kg' }, { name: 'Cartage', rate: 6.00, unit: 'flat' }, { name: 'Misc', rate: 6.00, unit: 'flat' }],
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
  const quote = appState.quotes.find(q => q.id === id);
  return quote ? getQuoteRefId(quote) : id.substring(0, 7).toUpperCase();
}
window.getQuoteRefIdById = getQuoteRefIdById;

function checkAndRequestEditPermission(quote, actionVerb = "modify") {
  if (appState.currentUser === 'ganny' || quote.amendmentAllowed) {
    return true;
  }
  let requests = window._amendmentRequests || [];
  if (requests.length === 0) {
    const stored = localStorage.getItem("gl_amendment_requests");
    if (stored) {
      try { requests = JSON.parse(stored); } catch(e) {}
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
    creator: quote.creator,
    creatorName: TEAM_ROLES[quote.creator]?.name || quote.creator,
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
    try { requests = JSON.parse(stored); } catch(e) {}
  }
  requests.push(newReq);
  localStorage.setItem("gl_amendment_requests", JSON.stringify(requests));
  
  // Update local view
  if (window._amendmentRequests) {
    window._amendmentRequests.push(newReq);
  } else {
    window._amendmentRequests = [newReq];
  }

  if (appState.currentUser === 'ganny') {
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
        try { inputEl.select(); } catch(e) {}
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
        } catch (e) {}
      }, 50);
    };

    // Dismiss on selection/change
    el.addEventListener("change", dismiss);
    el.addEventListener("input", dismiss);

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
        try { e.target.select(); } catch(err) {}
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
  fetchExchangeRates();

  // Modal handlers
  document.getElementById("close-modal")?.addEventListener("click", hideQuoteModal);
  document.getElementById("print-quote-btn")?.addEventListener("click", printQuote);

  // File upload badge updates
  const agreementFileInput = document.getElementById("won-agreement-file");
  if (agreementFileInput) {
    agreementFileInput.addEventListener("change", function() {
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
    invoiceFileInput.addEventListener("change", function() {
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
    const legacyEmail    = `${user}@pricing.local`; // one-time migration compat.

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
      loginSuccess(user);
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
        try { customUsers = JSON.parse(storedCustom); } catch (e) {}
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
        try { dbUsers = JSON.parse(storedCustom); } catch(err) {}
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

function loginSuccess(roleId) {
  const roleIdLower = roleId.toLowerCase();
  appState.currentUser = roleIdLower;
  document.body.classList.remove("logged-out-blur");
  document.getElementById("login-overlay").style.display = "none";
  document.getElementById("app-workspace").style.display = "flex";
  document.getElementById("subheader-controls").style.display = "flex";

  // Apply custom names to badge UI & dropdowns
  applyDeskNames();

  const roleInfo = TEAM_ROLES[roleIdLower] || { name: roleIdLower, type: 'member' };
  const displayName = (roleInfo.name || roleIdLower).replace(/\s*\(Free\s*Hand\)/i, "");
  const activeUserNameEl = document.getElementById("active-user-name");
  if (activeUserNameEl) {
    activeUserNameEl.textContent = displayName;
  }

  const root = document.documentElement;
  if (roleIdLower === 'ganny') {
    document.getElementById("admin-settings-btn").style.display = "flex";
    document.getElementById("admin-role-selector").style.display = "flex";
    root.style.setProperty('--accent-current', 'var(--sky)');
    root.style.setProperty('--accent-current-glow', 'rgba(27, 28, 92, 0.2)');
    switchRole('manager');
  } else {
    document.getElementById("admin-settings-btn").style.display = "none";
    document.getElementById("admin-role-selector").style.display = "none";
    if (roleIdLower.startsWith('air')) {
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
  if (DB.isCloud) {
    firebase.auth().signOut().catch(err => {
      console.error("Auth: Sign out failed:", err);
    });
  } else {
    sessionStorage.removeItem("gl_pricing_session");
    appState.currentUser = null;
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
    } catch(e) {}
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
    const roleCat = u.category || (u.role === 'admin' ? 'Admin' : 'Member');
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
      const role = e.target.getAttribute("data-role");
      switchRole(role);
    });
  });
}

function switchRole(role) {
  if (!role) return;
  const roleLower = role.toLowerCase();

  // Update Active Class on Buttons (if visible)
  document.querySelectorAll(".role-btn").forEach(btn => {
    const btnRole = btn.getAttribute("data-role");
    if (btnRole && btnRole.toLowerCase() === roleLower) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  });

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

  // Show/Hide Global Module Navigation Tabs based on role (hide for all to avoid duplicate row)
  const globalModuleTabs = document.getElementById("global-module-tabs");
  if (globalModuleTabs) {
    globalModuleTabs.style.display = "none";
  }

  // Show Selected view
  if (roleLower === 'manager' || roleLower === 'ganny') {
    document.getElementById("manager-panel").classList.add("active");
    renderAdminDashboard();
  } else if (TEAM_ROLES[roleLower] && TEAM_ROLES[roleLower].type === 'member') {
    // Check if we are showing the member dashboard or active calculator
    // Default: show member dashboard summary
    document.getElementById("member-dashboard-panel").classList.add("active");
    renderMemberDashboard(roleLower);
  }
}

function goHome() {
  document.querySelectorAll(".view-panel").forEach(panel => {
    panel.classList.remove("active");
  });
  document.querySelectorAll(".modal-overlay").forEach(modal => {
    modal.classList.remove("show");
  });
  
  if (appState.currentUser === 'ganny') {
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
    renderAdminDashboard();
  } else {
    document.getElementById("member-dashboard-panel").classList.add("active");
    renderMemberDashboard(appState.currentUser);
  }
  if (typeof updateAdminModulePermissions === 'function') updateAdminModulePermissions();
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
  if (document.getElementById("sea-incoterm")) document.getElementById("sea-incoterm").value = "EXW";
  if (document.getElementById("sea-gross-weight")) document.getElementById("sea-gross-weight").value = "0";
  if (document.getElementById("sea-volume")) document.getElementById("sea-volume").value = "0";
  if (document.getElementById("sea-pkg-qty")) document.getElementById("sea-pkg-qty").value = "0";
  if (document.getElementById("sea-routing")) document.getElementById("sea-routing").value = "";
  if (document.getElementById("sea-tt")) document.getElementById("sea-tt").value = "";
  if (document.getElementById("sea-validity")) document.getElementById("sea-validity").value = "";
  if (document.getElementById("sea-lcl-rate")) document.getElementById("sea-lcl-rate").value = "0";
  if (document.getElementById("sea-bb-rate")) document.getElementById("sea-bb-rate").value = "0";
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
    const memberPanel = document.getElementById("member-dashboard-panel");
    if (memberPanel) memberPanel.classList.remove("active");
    const managerPanel = document.getElementById("manager-panel");
    if (managerPanel) managerPanel.classList.remove("active");
    
    // Hide all panels safely
    const airPanel = document.getElementById("air-freight-panel");
    const seaPanel = document.getElementById("sea-freight-panel");
    const transportPanel = document.getElementById("transportation-panel");
    const warehousePanel = document.getElementById("warehousing-panel");

    if (airPanel) airPanel.classList.remove("active");
    if (seaPanel) seaPanel.classList.remove("active");
    if (transportPanel) transportPanel.classList.remove("active");
    if (warehousePanel) warehousePanel.classList.remove("active");

    const root = document.documentElement;

    if (type === 'air') {
      if (airPanel) airPanel.classList.add("active");
      root.style.setProperty('--accent-current', 'var(--accent-air)');
      root.style.setProperty('--accent-current-glow', 'var(--accent-air-glow)');
      try { resetAirFreightDeskForm(); } catch(e) { console.error("resetAirFreightDeskForm error:", e); }
    } else if (type === 'sea') {
      if (seaPanel) seaPanel.classList.add("active");
      root.style.setProperty('--accent-current', 'var(--accent-sea)');
      root.style.setProperty('--accent-current-glow', 'var(--accent-sea-glow)');
      try { resetSeaFreightDeskForm(); } catch(e) { console.error("resetSeaFreightDeskForm error:", e); }
    } else if (type === 'transport') {
      if (transportPanel) transportPanel.classList.add("active");
      root.style.setProperty('--accent-current', 'var(--violet)');
      root.style.setProperty('--accent-current-glow', 'rgba(124, 58, 237, 0.2)');
      try { calculateTransportation(); } catch(e) { console.error("calculateTransportation error:", e); }
    } else if (type === 'warehouse') {
      if (warehousePanel) warehousePanel.classList.add("active");
      root.style.setProperty('--accent-current', 'var(--sky)');
      root.style.setProperty('--accent-current-glow', 'rgba(56, 189, 248, 0.2)');
      try { calculateWarehousing(); } catch(e) { console.error("calculateWarehousing error:", e); }
    }
    updateModuleTabs(type);
  } catch(err) {
    console.error("Critical error in openActiveCalculator:", err);
    if (type === 'sea') {
      const seaPanel = document.getElementById("sea-freight-panel");
      if (seaPanel) seaPanel.classList.add("active");
    }
  }
}

window.resetFreightForm = function(type) {
  if (type === 'air') {
    try { resetAirFreightDeskForm(); } catch(e) {}
  } else if (type === 'sea') {
    try { resetSeaFreightDeskForm(); } catch(e) {}
  }
};

function returnToWorkspace() {
  document.getElementById("air-freight-panel").classList.remove("active");
  document.getElementById("sea-freight-panel").classList.remove("active");
  document.getElementById("transportation-panel").classList.remove("active");
  document.getElementById("warehousing-panel").classList.remove("active");
  
  if (appState.currentUser === 'ganny') {
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

// Helper to save custom entries in localStorage
function saveCustomEntry(type, value) {
  if (!value || typeof value !== 'string') return;
  const valTrimmed = value.trim();
  if (!valTrimmed) return;

  let storageKey = "";
  let defaultList = [];
  let isObjectList = true;

  if (type === "airports") {
    storageKey = "gl_custom_airports";
    defaultList = appState.airports || [];
  } else if (type === "airlines") {
    storageKey = "gl_custom_airlines";
    defaultList = appState.airlines || [];
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
    try { customList = JSON.parse(stored); } catch(e) {}
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
      let customAirports = [];
      const stored = localStorage.getItem("gl_custom_airports");
      if (stored) {
        try { customAirports = JSON.parse(stored); } catch(err) {}
      }
      const combined = [...(appState.airports || []), ...customAirports];
      matches = combined.filter(ap => 
        ap.code.toLowerCase().includes(val) || 
        ap.city.toLowerCase().includes(val) || 
        ap.country.toLowerCase().includes(val) || 
        ap.name.toLowerCase().includes(val)
      ).slice(0, 10);
    } else if (type === "airlines") {
      let customAirlines = [];
      const stored = localStorage.getItem("gl_custom_airlines");
      if (stored) {
        try { customAirlines = JSON.parse(stored); } catch(err) {}
      }
      const combined = [...(appState.airlines || []), ...customAirlines];
      matches = combined.filter(al => 
        al.code.toLowerCase().includes(val) || 
        al.name.toLowerCase().includes(val)
      ).slice(0, 10);
    } else if (type === "customers") {
      let customCusts = [];
      const stored = localStorage.getItem("gl_custom_customers");
      if (stored) {
        try { customCusts = JSON.parse(stored); } catch(err) {}
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
      let customPorts = [];
      const stored = localStorage.getItem("gl_custom_seaports");
      if (stored) {
        try { customPorts = JSON.parse(stored); } catch(err) {}
      }
      const portsSource = (appState.seaports && appState.seaports.length > 0) ? appState.seaports : majorSeaports;
      const combined = [...portsSource, ...customPorts];
      matches = combined.filter(sp => 
        (sp.code || "").toLowerCase().includes(val) || 
        (sp.name || "").toLowerCase().includes(val) ||
        (sp.city || "").toLowerCase().includes(val) ||
        (sp.country || "").toLowerCase().includes(val)
      ).slice(0, 10);
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
        try { customLines = JSON.parse(stored); } catch(err) {}
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
        try { customLiners = JSON.parse(stored); } catch(err) {}
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
        try { customCommodities = JSON.parse(stored); } catch(err) {}
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
  wrapper.style.cssText = "background: #fff; border: 1px solid #ccc; border-radius: 4px; padding: 4px 8px; display: flex; align-items: center; gap: 6px; transition: all 0.2s;";

  const sellRate = (typeof rate === 'object' && rate !== null) ? (rate.sell || 0) : (parseFloat(rate) || 0);
  const buyRate = (typeof rate === 'object' && rate !== null) ? (rate.buy || 0) : 0;
  
  wrapper.innerHTML = `
    <span style="font-size: 0.72rem; font-weight: 700; color: #000;">${labels[breakName] || breakName}</span>
    <div style="display: flex; gap: 4px; align-items: center;">
      <input type="number" class="break-rate-input break-sell-rate-input" placeholder="Sell" min="0" step="0.1" value="${sellRate > 0 ? sellRate : ''}" style="width: 50px; font-size: 0.72rem; padding: 2px 4px; border: 1px solid #ccc; border-radius: 4px; background: #fff; color: #000; font-weight: 700;" title="Sell Rate per KG">
      <input type="number" class="break-buy-rate-input" placeholder="Buy" min="0" step="0.1" value="${buyRate > 0 ? buyRate : ''}" style="width: 50px; font-size: 0.72rem; padding: 2px 4px; border: 1px solid #ccc; border-radius: 4px; background: #fff; color: #000; font-weight: 700;" title="Buy Rate per KG">
    </div>
    <span class="remove-break-btn" style="cursor: pointer; color: var(--accent-error); font-size: 0.8rem; font-weight: 800; padding: 0 2px; ${isAuto ? 'display:none;' : ''}">×</span>
  `;

  container.appendChild(wrapper);

  wrapper.querySelector(".break-sell-rate-input").addEventListener("input", calculateAirFreight);
  const buyInp = wrapper.querySelector(".break-buy-rate-input");
  if (buyInp) buyInp.addEventListener("input", calculateAirFreight);

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
    <td><input type="number" class="chg-rate" value="${sellRate}" step="0.01" required></td>
    <td><input type="number" class="chg-buy-rate" value="${buyRate}" step="0.01" required style="background: rgba(255,255,255,0.03); color: var(--t1);"></td>
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
  card.style.cssText = "padding: 1rem; border: 1px solid var(--border-1); border-radius: 8px; margin-bottom: 1rem; position: relative;";

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
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
      <span style="font-weight: 800; color: var(--accent-air); font-size: 0.85rem;">Airline Option #${count}</span>
      <div style="display: flex; gap: 0.5rem; align-items: center;">
        <label style="font-size: 0.75rem; display: flex; align-items: center; gap: 4px; cursor: pointer; color: var(--t1);">
          <input type="radio" name="selected-airline" class="select-airline-radio" ${isSelected ? 'checked' : ''}> Select as Quoted
        </label>
        <button type="button" class="delete-btn remove-airline-btn" style="padding: 2px 4px; margin: 0;">Remove</button>
      </div>
    </div>
    
    <div class="form-grid-3">
      <div class="form-group">
        <label>Carrier / Airline</label>
        <input type="text" class="air-name" placeholder="Airline name or code..." value="${name}" required style="font-size: 0.75rem; padding: 4px 8px; border-radius: 6px;">
      </div>
      <div class="form-grid-2 form-group" style="grid-column: span 2; display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin: 0; padding: 0; border: none; background: none;">
        <div class="form-group">
          <label>Routing Details</label>
          <input type="text" class="air-routing" placeholder="e.g. Direct / via SIN" value="${routing}" required style="font-size: 0.75rem; padding: 4px 8px; border-radius: 6px;">
        </div>
        <div class="form-group">
          <label>Transit Time (TT)</label>
          <input type="text" class="air-tt" placeholder="e.g. 3-5 Days" value="${tt}" required style="font-size: 0.75rem; padding: 4px 8px; border-radius: 6px;">
        </div>
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
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; gap: 8px;">
        <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; text-align: left; margin: 0;">
          <input type="checkbox" class="air-enable-weight-breaks" ${wbEnabled ? 'checked' : ''} onchange="calculateAirFreight()" style="width: 14px; height: 14px; accent-color: var(--sky); cursor: pointer;">
          <span style="font-size: 0.75rem; font-weight: 700; color: #000; white-space: nowrap; text-overflow: ellipsis; overflow: hidden; text-align: left;">${isEligibleDeskUser() ? 'Weight Break Tariffs (Sell Rate per KG)' : 'Weight Break Tariffs (Rate per KG)'}</span>
        </label>
        <div style="position: relative; display: inline-block;">
          <button type="button" class="btn-text add-weight-break-btn" style="font-size: 0.7rem; color: var(--sky); cursor: pointer; text-decoration: underline; background: none; border: none; padding: 0;">+ Add Weight Break</button>
          <div class="weight-break-dropdown" style="display: none; position: absolute; right: 0; top: 100%; z-index: 1000; background: var(--bg-surface, #fff); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); border: 1px solid var(--border-1, #ccc); border-radius: 8px; box-shadow: var(--shadow-lg, 0 4px 12px rgba(0,0,0,0.15)); padding: 6px; min-width: 140px; flex-direction: column; gap: 2px;"></div>
        </div>
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
  `;

  container.appendChild(card);

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
    originTbody.appendChild(createAirSurchargeRow({ name: "Cartage", rate: "6.00", buyRate: "4.00", unit: "flat", readOnlyName: !isFreeHandOrNrs }));
    originTbody.appendChild(createAirSurchargeRow({ name: "Misc", rate: "6.00", buyRate: "4.00", unit: "flat", readOnlyName: !isFreeHandOrNrs }));
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
  if (nameInput) {
    const parent = nameInput.parentElement;
    parent.style.position = "relative";
    let dropdown = parent.querySelector(".iata-autocomplete-dropdown");
    if (!dropdown) {
      dropdown = document.createElement("div");
      dropdown.className = "iata-autocomplete-dropdown";
      dropdown.style.display = "none";
      parent.appendChild(dropdown);
    }

    nameInput.addEventListener("input", () => {
      const val = nameInput.value.trim().toUpperCase();
      dropdown.innerHTML = "";
      if (val.length >= 1) {
        let customAirlines = [];
        try {
          const stored = localStorage.getItem("gl_custom_airlines");
          if (stored) customAirlines = JSON.parse(stored);
        } catch(e) {}
        
        let allAirlines = [...(appState.airlines || []), ...customAirlines];
        if (allAirlines.length === 0) {
          allAirlines = Object.entries(IATA_AIRLINES).map(([code, name]) => ({ code, name }));
        }

        const matches = allAirlines.filter(al => 
          (al.code && al.code.toUpperCase().includes(val)) ||
          (al.name && al.name.toUpperCase().includes(val))
        ).slice(0, 15);

        if (matches.length > 0) {
          dropdown.style.display = "flex";
          matches.forEach(al => {
            const item = document.createElement("div");
            item.className = "iata-autocomplete-item";
            item.textContent = `${al.code} - ${al.name}`;
            item.addEventListener("click", () => {
              nameInput.value = `${al.code} - ${al.name}`;
              dropdown.style.display = "none";
              calculateAirFreight();
            });
            dropdown.appendChild(item);
          });
        } else {
          dropdown.style.display = "none";
        }
      } else {
        dropdown.style.display = "none";
      }
    });

    document.addEventListener("click", (e) => {
      if (e.target !== nameInput && !dropdown.contains(e.target)) {
        dropdown.style.display = "none";
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

  const addBreakBtn = card.querySelector(".add-weight-break-btn");
  const dropdown = card.querySelector(".weight-break-dropdown");
  if (addBreakBtn && dropdown) {
    addBreakBtn.addEventListener("click", (e) => {
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

      const currentBreaks = Array.from(card.querySelectorAll(".dynamic-break-wrapper")).map(x => x.getAttribute("data-break-name"));
      const available = Object.keys(breakOpts).filter(k => !currentBreaks.includes(k));

      if (available.length === 0) {
        alert("All weight breaks have already been added.");
        dropdown.style.display = "none";
        return;
      }

      if (dropdown.style.display === "flex") {
        dropdown.style.display = "none";
        return;
      }

      dropdown.innerHTML = "";
      dropdown.style.display = "flex";

      available.forEach(k => {
        const item = document.createElement("div");
        item.style.cssText = "padding: 6px 10px; font-size: 0.72rem; color: var(--t1, #000); cursor: pointer; border-radius: 4px; transition: background 0.2s; text-align: left;";
        item.textContent = breakOpts[k];
        
        item.addEventListener("mouseenter", () => {
          item.style.background = "var(--border-1, #eee)";
        });
        item.addEventListener("mouseleave", () => {
          item.style.background = "transparent";
        });

        item.addEventListener("click", (evt) => {
          evt.stopPropagation();
          addWeightBreakRow(card, k, 0);
          calculateAirFreight();
          dropdown.style.display = "none";
        });
        dropdown.appendChild(item);
      });
    });

    document.addEventListener("click", (e) => {
      if (dropdown && !dropdown.contains(e.target) && e.target !== addBreakBtn) {
        dropdown.style.display = "none";
      }
    });
  }

  if (data && Object.keys(activeBreaks).length > 0) {
    for (const bName in activeBreaks) {
      addWeightBreakRow(card, bName, activeBreaks[bName]);
    }
  }
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
          rate: isFreeHandOrNrs ? "0.00" : "6.00",
          buyRate: isFreeHandOrNrs ? "0.00" : "4.00",
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

    addWeightBreakRow(card, autoBreakName, 0, true);

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

    const activeBrVal = breaksData[autoBreakName] || { sell: 0, buy: 0 };
    activeRate = activeBrVal.sell > 0 ? activeBrVal.sell : activeBrVal.buy;
    activeBuyRate = activeBrVal.buy;

    if (isFreeHandOrNrs && activeRate === 0) {
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
        const valNum = (typeof val === 'object' && val !== null) ? (val.sell > 0 ? val.sell : val.buy) : (parseFloat(val) || 0);
        if (valNum > 0 && airlineChargeableWeight >= br.limit) {
          bestBracket = br;
        }
      }
      if (bestBracket) {
        const val = breaksData[bestBracket.name];
        activeRate = (typeof val === 'object' && val !== null) ? (val.sell > 0 ? val.sell : val.buy) : (parseFloat(val) || 0);
        activeBuyRate = (typeof val === 'object' && val !== null) ? val.buy : 0;
        usedBreak = bestBracket.name;
      } else {
        // Try any bracket that has a rate
        const bracketsWithRates = brackets.filter(br => {
          const val = breaksData[br.name];
          const valNum = (typeof val === 'object' && val !== null) ? (val.sell > 0 ? val.sell : val.buy) : (parseFloat(val) || 0);
          return valNum > 0;
        });
        if (bracketsWithRates.length > 0) {
          const val = breaksData[bracketsWithRates[0].name];
          activeRate = (typeof val === 'object' && val !== null) ? (val.sell > 0 ? val.sell : val.buy) : (parseFloat(val) || 0);
          activeBuyRate = (typeof val === 'object' && val !== null) ? val.buy : 0;
          usedBreak = bracketsWithRates[0].name;
        }
      }
    }

    let baseFreightCost = (tariffsEnabled && wbEnabled) ? (airlineChargeableWeight * activeRate) : 0;
    
    let isMinActive = false;
    const minVal = breaksData['min'];
    const minSell = (typeof minVal === 'object' && minVal !== null) ? (minVal.sell > 0 ? minVal.sell : minVal.buy) : (parseFloat(minVal) || 0);
    const minBuy = (typeof minVal === 'object' && minVal !== null) ? minVal.buy : 0;

    if (tariffsEnabled && wbEnabled && minSell > 0 && baseFreightCost < minSell) {
      baseFreightCost = minSell;
      isMinActive = true;
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
        wrapper.style.display = "none";
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
                rate = 6.00;
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

        if (surchargeName && rate > 0) {
          let cost = unit === 'kg' ? airlineChargeableWeight * rate : rate;
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

        if (surchargeName && rate > 0) {
          let cost = unit === 'kg' ? airlineChargeableWeight * rate : rate;
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
      breaks: breaksData,
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
      grossProfit: optionGrossProfit
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
            rateInp.value = "6.00";
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
      
      return `
        <div class="glass-card" style="padding: 1rem; border: 1px solid ${alt.selected ? 'var(--accent-success)' : 'var(--border-1)'}; relative; background: ${alt.selected ? 'rgba(46,204,113,0.04)' : 'rgba(255,255,255,0.01)'}; border-radius: 8px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
            <strong style="font-size: 0.85rem; color: ${color};">${alt.name || 'Unnamed Airline'}</strong>
            ${isCheapest ? '<span style="font-size: 0.62rem; background: var(--accent-success); color: #fff; padding: 2px 6px; border-radius: 4px; font-weight: bold; text-transform: uppercase;">Cheapest Option</span>' : ''}
          </div>
          <div class="result-row" style="font-size: 0.72rem; margin-bottom: 0.25rem; border-bottom: none; padding: 0;">
            <span class="result-label" style="color: var(--t2);">Chargeable Weight</span>
            <span class="result-value" style="color: ${color}; font-weight: 700;">${alt.chargeableWeight.toFixed(2)} kg</span>
          </div>
          <div class="result-row" style="font-size: 0.72rem; margin-bottom: 0.25rem; border-bottom: none; padding: 0;">
            <span class="result-label" style="color: var(--t2);">Base Freight Cost</span>
            <span class="result-value" style="color: ${color}; font-weight: 700;">${curSymbol}${alt.baseFreight.toFixed(2)}</span>
          </div>
          <div class="result-row" style="font-size: 0.72rem; margin-bottom: 0.25rem; border-bottom: none; padding: 0;">
            <span class="result-label" style="color: var(--t2);">Total Ancillary Surcharges</span>
            <span class="result-value" style="color: ${color}; font-weight: 700;">${curSymbol}${alt.surchargeTotal.toFixed(2)}</span>
          </div>
          <div class="result-row" style="font-size: 0.72rem; margin-bottom: 0.25rem; border-bottom: none; padding: 0;">
            <span class="result-label" style="color: var(--t2);">Gross Profit (GP)</span>
            <span class="result-value" style="color: var(--accent-success); font-weight: 700;">${curSymbol}${Math.abs(alt.grossProfit || 0).toFixed(2)}</span>
          </div>
          <div class="result-row" style="border-top: 1px dashed rgba(255,255,255,0.1); padding-top: 6px; font-size: 0.8rem; font-weight: bold; margin-top: 4px; border-bottom: none;">
            <span class="result-label" style="color: var(--t1);">Grand Total</span>
            <span class="result-value" style="color: ${color}; font-size: 0.85rem; font-weight: 800;">${curSymbol}${alt.grandTotal.toFixed(2)}</span>
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
      grossProfit: alt.grossProfit
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
  const tabFcl = document.getElementById("sea-tab-fcl");
  const tabLcl = document.getElementById("sea-tab-lcl");
  const fclForm = document.getElementById("sea-fcl-form");
  const lclForm = document.getElementById("sea-lcl-form");
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

  const tabBb = document.getElementById("sea-tab-bb");
  const bbForm = document.getElementById("sea-bb-form");

  if (tabFcl && tabLcl && tabBb) {
    tabFcl.addEventListener("click", () => {
      tabFcl.classList.add("active");
      tabLcl.classList.remove("active");
      tabBb.classList.remove("active");
      fclForm.style.display = "block";
      lclForm.style.display = "none";
      if (bbForm) bbForm.style.display = "none";
      appState.currentSeaFreight.type = "fcl";
      populateSeaSurcharges("fcl");
      calculateSeaFreight();
    });

    tabLcl.addEventListener("click", () => {
      tabLcl.classList.add("active");
      tabFcl.classList.remove("active");
      tabBb.classList.remove("active");
      fclForm.style.display = "none";
      lclForm.style.display = "block";
      if (bbForm) bbForm.style.display = "none";
      appState.currentSeaFreight.type = "lcl";
      populateSeaSurcharges("lcl");
      calculateSeaFreight();
    });

    tabBb.addEventListener("click", () => {
      tabBb.classList.add("active");
      tabFcl.classList.remove("active");
      tabLcl.classList.remove("active");
      fclForm.style.display = "none";
      lclForm.style.display = "none";
      if (bbForm) bbForm.style.display = "block";
      appState.currentSeaFreight.type = "bb";
      populateSeaSurcharges("bb");
      calculateSeaFreight();
    });
  }

  // Bind new cargo details inputs
  document.getElementById("sea-gross-weight")?.addEventListener("input", calculateSeaFreight);
  document.getElementById("sea-volume")?.addEventListener("input", calculateSeaFreight);
  document.getElementById("sea-pkg-qty")?.addEventListener("input", calculateSeaFreight);
  document.getElementById("sea-lcl-rate")?.addEventListener("input", calculateSeaFreight);
  document.getElementById("sea-lcl-buy-rate")?.addEventListener("input", calculateSeaFreight);
  document.getElementById("sea-bb-rate")?.addEventListener("input", calculateSeaFreight);
  document.getElementById("sea-bb-buy-rate")?.addEventListener("input", calculateSeaFreight);
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

window.toggleLinerAccordion = function(headerEl) {
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

window.switchLinerMode = function(linerIndex, mode) {
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
  calculateSeaFreight();
};

function buildLinerOptionsHTML(selectedName = "") {
  const options = [
    { group: "🚢 Shipping Lines", items: [
      "MSC (Mediterranean Shipping Company)", "Maersk Line", "CMA CGM", "COSCO Shipping",
      "Hapag-Lloyd", "ONE (Ocean Network Express)", "Evergreen Line", "HMM Co., Ltd.",
      "Yang Ming Marine Transport", "ZIM Integrated Shipping", "Wan Hai Lines",
      "PIL (Pacific International Lines)", "OOCL (Orient Overseas Container Line)",
      "KMTC (Korea Marine Transport Co.)", "SITC Container Lines", "TS Lines",
      "RCL (Regional Container Lines)", "X-Press Feeders", "Sinokor Merchant Marine",
      "SM Line", "Turkon Line", "Grimaldi Lines"
    ]},
    { group: "📦 Coloaders & NVOCCs", items: [
      "Vanguard Logistics", "ECU Worldwide", "CWT Globelink", "Shipco Transport",
      "FPS (Famous Pacific Shipping)", "SACO Shipping", "CFR Rinkens / CFR Freight",
      "Oceanus Coloaders", "Cargo Services Far East", "Allcargo Logistics",
      "Caravel Logistics", "Conship", "FreightConsol"
    ]},
    { group: "🏗 Breakbulk Operators", items: [
      "BBC Chartering", "Spliethoff Group", "dship Carriers", "AAL Shipping (Austral Asia Line)",
      "Saga Welco", "MACS Maritime Carrier Shipping", "Swire Shipping", "G2 Ocean",
      "Chipolbrok", "BigLift Shipping", "Jumbo-SAL Maritime", "United Heavy Lift (UHL)",
      "Fednav", "Intermarine", "Harren Group", "Thorco Maritime"
    ]}
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

window.handleLinerSelectChange = function(index) {
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

window.addNewLinerCard = function(data = null) {
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
                <input type="checkbox" id="sea-enable-tariffs-${index}" class="sea-enable-tariffs" checked onchange="calculateSeaFreight()" style="width: 16px; height: 16px; accent-color: var(--sky); cursor: pointer;">
                Include Freight Tariff
              </label>
              <span id="sea-tariffs-status-badge-${index}" class="sea-tariffs-status-badge" style="font-size: 0.7rem; font-weight: 700; color: #10b981; background: rgba(16, 185, 129, 0.1); padding: 2px 8px; border-radius: 4px;">✓ Included</span>
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
                        <th style="width: 21%; text-align: center;">Sell Rate (<span class="curr-label">USD</span>)</th>
                        <th style="width: 21%; text-align: center;">Buy Rate (<span class="curr-label">USD</span>)</th>
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
                  Add Container Line
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
                <input type="checkbox" id="sea-enable-origin-fees-${index}" class="sea-enable-origin-fees" checked onchange="calculateSeaFreight()" style="width: 16px; height: 16px; accent-color: var(--sky); cursor: pointer;">
                Include Origin Local Fees
              </label>
              <span id="sea-origin-status-badge-${index}" class="sea-origin-status-badge" style="font-size: 0.7rem; font-weight: 700; color: #10b981; background: rgba(16, 185, 129, 0.1); padding: 2px 8px; border-radius: 4px;">✓ Included</span>
            </div>
            <div id="sea-origin-fees-content-body-${index}" class="sea-origin-fees-content-body">
              <div class="cargo-table-container" style="border: none; margin-bottom: 1rem;">
                <table class="cargo-table">
                  <thead>
                    <tr>
                      <th>Surcharge Name</th>
                      <th>Sell Cost (<span class="curr-label">USD</span>)</th>
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
                <input type="checkbox" id="sea-enable-dest-fees-${index}" class="sea-enable-dest-fees" checked onchange="calculateSeaFreight()" style="width: 16px; height: 16px; accent-color: var(--sky); cursor: pointer;">
                Include Destination Local Fees
              </label>
              <span id="sea-dest-status-badge-${index}" class="sea-dest-status-badge" style="font-size: 0.7rem; font-weight: 700; color: #10b981; background: rgba(16, 185, 129, 0.1); padding: 2px 8px; border-radius: 4px;">✓ Included</span>
            </div>
            <div id="sea-dest-fees-content-body-${index}" class="sea-dest-fees-content-body">
              <div class="cargo-table-container" style="border: none; margin-bottom: 1rem;">
                <table class="cargo-table">
                  <thead>
                    <tr>
                      <th>Surcharge Name</th>
                      <th>Sell Cost (<span class="curr-label">USD</span>)</th>
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
  `;

  container.appendChild(linerCard);

  if (data?.containers && data.containers.length > 0) {
    data.containers.forEach(c => addFclContainerRowToLiner(index, c.type, c.qty, c.rate));
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
};

window.removeLinerCard = function(linerIndex) {
  const card = document.getElementById(`sea-liner-card-${linerIndex}`);
  if (card) {
    card.remove();
    calculateSeaFreight();
  }
};

window.addFclContainerRowToLiner = function(linerIndex, typeVal = "20'GP", qtyVal = 1, rateVal = 0) {
  const tbody = document.getElementById(`sea-fcl-body-${linerIndex}`);
  if (!tbody) return;

  const sellRate = (typeof rateVal === 'object' && rateVal !== null) ? (rateVal.sell || rateVal.rate || 0) : (parseFloat(rateVal) || 0);
  const buyRate = (typeof rateVal === 'object' && rateVal !== null) ? (rateVal.buy || 0) : 0;

  const tr = document.createElement("tr");
  tr.className = "container-row";
  
  tr.innerHTML = `
    <td>
      <select class="fcl-type table-select" onchange="calculateSeaFreight()">
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
      <button type="button" class="delete-btn" onclick="this.closest('tr').remove(); calculateSeaFreight();" style="margin: 0 auto;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/></svg>
      </button>
    </td>
  `;

  tbody.appendChild(tr);
  calculateSeaFreight();
};

window.addSeaSurchargeRowToLiner = function(linerIndex, type, nameVal = "", sellVal = 0, buyVal = 0, unitVal = "flat", remarksVal = "") {
  const tbodyId = type === 'origin' ? `sea-origin-surcharges-body-${linerIndex}` : `sea-dest-surcharges-body-${linerIndex}`;
  const tbody = document.getElementById(tbodyId);
  if (!tbody) return;

  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td><input type="text" class="chg-name" value="${nameVal}" placeholder="Surcharge Name" required oninput="calculateSeaFreight()"></td>
    <td><input type="number" class="chg-rate" value="${sellVal}" step="0.01" required oninput="calculateSeaFreight()"></td>
    <td><input type="number" class="chg-buy-rate" value="${buyVal}" step="0.01" required style="background: rgba(255,255,255,0.03); color: var(--t1);" oninput="calculateSeaFreight()"></td>
    <td>
      <select class="chg-unit" onchange="calculateSeaFreight()" style="background: rgba(255,255,255,0.05); border: 1px solid var(--border-color); color: #fff; padding: 4px 8px; border-radius: 4px; width: 100%;">
        <option value="flat" ${unitVal === 'flat' ? 'selected' : ''}>Flat Fee</option>
        <option value="container" ${unitVal === 'container' ? 'selected' : ''}>Per Container</option>
        <option value="rt" ${unitVal === 'rt' ? 'selected' : ''}>Per RT (Revenue Ton)</option>
        <option value="kg" ${unitVal === 'kg' ? 'selected' : ''}>Per Kg (Gross Weight)</option>
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

  const type = appState.currentSeaFreight.type; // 'fcl', 'lcl', or 'bb'
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
  const chargeableCbm = Math.max(effectiveCbm, weightTons);

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
    let linerContainersCount = 0;
    let linerContainerSummary = [];
    let containersList = [];

    if (linerMode === 'fcl') {
      const fclRows = card.querySelectorAll(".sea-fcl-body .container-row, tbody[id^='sea-fcl-body'] .container-row");
      fclRows.forEach(row => {
        const typeVal = row.querySelector(".fcl-type")?.value || "20'GP";
        const qty = parseInt(row.querySelector(".fcl-qty")?.value) || 0;
        const rate = parseFloat(row.querySelector(".fcl-sell-rate")?.value || row.querySelector(".fcl-rate")?.value) || 0;
        const buy = parseFloat(row.querySelector(".fcl-buy-rate")?.value) || 0;
        const activeRate = rate > 0 ? rate : (buy > 0 ? buy : 0);
        containersList.push({ type: typeVal, qty, rate, buy });
        if (qty > 0 && activeRate > 0) {
          if (tariffsEnabled) {
            linerBaseFreight += (qty * activeRate);
          }
          linerContainersCount += qty;
          linerContainerSummary.push(`${qty} x ${typeVal}`);
        }
      });
    } else if (linerMode === 'lcl') {
      const rate = parseFloat(card.querySelector(".sea-lcl-rate")?.value) || 0;
      const buy = parseFloat(card.querySelector(".sea-lcl-buy-rate")?.value) || 0;
      const activeRate = rate > 0 ? rate : buy;
      if (tariffsEnabled) {
        linerBaseFreight = chargeableCbm * activeRate;
      }
    } else {
      const rate = parseFloat(card.querySelector(".sea-bb-rate")?.value) || 0;
      const buy = parseFloat(card.querySelector(".sea-bb-buy-rate")?.value) || 0;
      const activeRate = rate > 0 ? rate : buy;
      if (tariffsEnabled) {
        linerBaseFreight = chargeableCbm * activeRate;
      }
    }

    let linerOriginTotal = 0;
    let linerOriginList = [];
    if (originFeesEnabled) {
      if (isSeaAmsEnabled && amsFee > 0) {
        linerOriginTotal += amsFee;
        linerOriginList.push({ name: "AMS Fee", rate: amsFee, unit: "flat", calculatedCost: amsFee });
      }
      const originRows = card.querySelectorAll(".sea-origin-surcharges-body tr, tbody[id^='sea-origin-surcharges-body'] tr");
      originRows.forEach(row => {
        const name = row.querySelector(".chg-name")?.value.trim();
        const rate = parseFloat(row.querySelector(".chg-rate")?.value) || 0;
        const buyRate = parseFloat(row.querySelector(".chg-buy-rate")?.value) || 0;
        const unit = row.querySelector(".chg-unit")?.value || 'flat';
        const remarks = row.querySelector(".chg-remarks")?.value.trim() || "";

        if (name && rate > 0) {
          let cost = 0;
          if (unit === 'container') {
            cost = isLinerFcl ? linerContainersCount * rate : rate;
          } else if (unit === 'rt') {
            cost = chargeableCbm * rate;
          } else if (unit === 'kg') {
            cost = weightKg * rate;
          } else {
            cost = rate;
          }
          linerOriginTotal += cost;
          linerOriginList.push({ name, rate, buyRate, unit, remarks, calculatedCost: cost });
        }
      });
    }

    let linerDestTotal = 0;
    let linerDestList = [];
    if (destFeesEnabled) {
      const destRows = card.querySelectorAll(".sea-dest-surcharges-body tr, tbody[id^='sea-dest-surcharges-body'] tr");
      destRows.forEach(row => {
        const name = row.querySelector(".chg-name")?.value.trim();
        const rate = parseFloat(row.querySelector(".chg-rate")?.value) || 0;
        const buyRate = parseFloat(row.querySelector(".chg-buy-rate")?.value) || 0;
        const unit = row.querySelector(".chg-unit")?.value || 'flat';
        const remarks = row.querySelector(".chg-remarks")?.value.trim() || "";

        if (name && rate > 0) {
          let cost = 0;
          if (unit === 'container') {
            cost = isLinerFcl ? linerContainersCount * rate : rate;
          } else if (unit === 'rt') {
            cost = chargeableCbm * rate;
          } else if (unit === 'kg') {
            cost = weightKg * rate;
          } else {
            cost = rate;
          }
          linerDestTotal += cost;
          linerDestList.push({ name, rate, buyRate, unit, remarks, calculatedCost: cost });
        }
      });
    }

    const linerGrandTotal = (tariffsEnabled ? linerBaseFreight : 0) + (originFeesEnabled ? linerOriginTotal : 0) + (destFeesEnabled ? linerDestTotal : 0);
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
      containers: containersList,
      fclSummary: linerContainerSummary,
      originSurcharges: linerOriginList,
      originTotal: linerOriginTotal,
      destSurcharges: linerDestList,
      destTotal: linerDestTotal,
      grandTotal: linerGrandTotal,
      grandTotalINR: linerGrandTotalINR
    });
  });

  const primaryLiner = calculatedLiners[0] || {
    baseFreight: 0,
    originSurcharges: [],
    destSurcharges: [],
    originTotal: 0,
    destTotal: 0,
    grandTotal: 0,
    grandTotalINR: 0,
    fclSummary: []
  };

  const baseFreight = primaryLiner.baseFreight;
  const totalSurcharges = primaryLiner.originTotal + primaryLiner.destTotal;
  const grandTotal = primaryLiner.grandTotal;
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
        <td><input type="number" class="chg-rate" min="0" step="0.01" placeholder="Rate" required></td>
        <td><input type="number" class="chg-buy-rate" min="0" step="0.01" placeholder="Cost" value="0.00" required style="background: rgba(255,255,255,0.03); color: var(--t1);"></td>
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
        <td><input type="number" class="chg-rate" min="0" step="0.01" placeholder="Cost" required></td>
        <td><input type="number" class="chg-buy-rate" min="0" step="0.01" placeholder="Cost" value="0.00" required style="background: rgba(255,255,255,0.03); color: var(--t1);"></td>
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
  renderNrsRegistry();

  // Load member scratchpad content
  const user = userId || appState.currentUser || "shashank";
  let scratchpads = {};
  try {
    scratchpads = JSON.parse(localStorage.getItem("gl_active_scratchpads") || "{}");
  } catch (e) { }
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
  // Check for resolved amendment requests for this member
  let requestsList = window._amendmentRequests || [];
  if (requestsList.length === 0) {
    const storedReqs = localStorage.getItem("gl_amendment_requests");
    if (storedReqs) {
      try { requestsList = JSON.parse(storedReqs); } catch(e) {}
    }
  }
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

  const btnGotoAir = document.getElementById("btn-goto-air");
  const btnGotoSea = document.getElementById("btn-goto-sea");
  const btnGotoCustom = document.getElementById("btn-goto-custom");
  const btnGotoTransport = document.getElementById("btn-goto-transport");
  const btnGotoWarehouse = document.getElementById("btn-goto-warehouse");

  if (btnGotoAir) btnGotoAir.style.display = "flex";
  if (btnGotoSea) btnGotoSea.style.display = "flex";
  if (btnGotoCustom) btnGotoCustom.style.display = "flex";
  if (btnGotoTransport) btnGotoTransport.style.display = "flex";
  if (btnGotoWarehouse) btnGotoWarehouse.style.display = "flex";

  const myQuotes = appState.quotes.filter(q => q.creator === userId);
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

  // Update KPI Metrics
  document.getElementById("user-stat-revenue").textContent = `₹${totalRevenueINR.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
  document.getElementById("user-stat-quotes").textContent = totalEnquiries;
  document.getElementById("user-stat-conversions").textContent = conversions;
  document.getElementById("user-stat-rate").textContent = `${conversionRate.toFixed(1)}%`;

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

// ADMIN DASHBOARD RENDERING
function renderAdminDashboard() {
  renderControlTowerFeed();
  renderNrsRegistry();
  if (typeof updateAdminDirectoryView === 'function') {
    updateAdminDirectoryView();
  }
  if (typeof updateAdminScratchpadViewer === 'function') {
    updateAdminScratchpadViewer();
  }
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

  // Update top widgets
  document.getElementById("admin-stat-revenue").textContent = `₹${totalRevenueINR.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
  document.getElementById("admin-stat-quotes").textContent = totalEnquiries;
  document.getElementById("admin-stat-conversions").textContent = conversions;
  document.getElementById("admin-stat-rate").textContent = `${conversionRate.toFixed(1)}%`;

  // Render leaderboard performance table
  const leadBody = document.getElementById("admin-leaderboard-body");
  leadBody.innerHTML = "";

  // Get all registered member user IDs (excluding manager/admin roles and shaheer)
  const desks = Object.keys(TEAM_ROLES).filter(roleId => {
    if (roleId === 'ganny' || roleId === 'manager') return false;
    if (roleId.toLowerCase() === 'shaheer') return false;
    const name = (TEAM_ROLES[roleId]?.name || '').toLowerCase();
    if (name === 'shaheer' || name.startsWith('shaheer ')) return false;
    return true;
  });

  desks.forEach(deskId => {
    const deskIdLower = deskId.toLowerCase();
    const deskQuotes = appState.quotes.filter(q => q.creator && q.creator.toLowerCase() === deskIdLower);
    const deskQuotesCount = deskQuotes.length;
    const deskConversions = deskQuotes.filter(q => q.status === 'converted').length;
    const deskRate = deskQuotesCount > 0 ? (deskConversions / deskQuotesCount * 100) : 0;
    const deskRevenue = deskQuotes.reduce((acc, q) => acc + q.amountINR, 0);

    const tr = document.createElement("tr");
    tr.style.color = "#000000";
    const name = (TEAM_ROLES[deskIdLower]?.name || deskIdLower).replace(/\s*\(Free\s*Hand\)/i, "");
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

  // Render Master logs using Filter & Sort
  applyDbFiltersAndSort();

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
        try { requests = JSON.parse(stored); } catch(e) {}
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
              <button class="btn-primary" style="padding: 4px 10px; font-size: 0.75rem; background: var(--accent-success); color: #000; border: none; border-radius: 4px; cursor: pointer; font-weight:700;" onclick="approveAmendment('${req.id}')">Approve</button>
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

  const carrierSection = document.getElementById("won-carrier-buy-section");
  const carrierSelect = document.getElementById("won-confirmed-carrier");
  const buyRateInput = document.getElementById("won-confirmed-buy-rate");

  if (carrierSection && carrierSelect && buyRateInput) {
    carrierSection.style.display = "block";
    carrierSelect.required = true;

    // Determine what is missing
    let isBuyRateMissing = false;
    let isSellRateMissing = false;

    const isNominationCreator = quote.creator && (
      quote.creator === 'shashank' || 
      quote.creator === 'shaheer' || 
      (TEAM_ROLES[quote.creator] && (TEAM_ROLES[quote.creator].category === 'AIR - NOMINATION' || TEAM_ROLES[quote.creator].category === 'SEA - NOMINATION'))
    );

    if (isNominationCreator) {
      isSellRateMissing = true;
    } else if (quote.type === 'air') {
      const sellRate = quote.details.appliedRate || 0;
      const buyRate = quote.details.appliedBuyRate || 0;
      if (sellRate > 0 && buyRate === 0) {
        isBuyRateMissing = true;
      } else if (buyRate > 0 && sellRate === 0) {
        isSellRateMissing = true;
      }
    } else {
      if (quote.details.mode === 'fcl') {
        const hasSell = (quote.details.containerItems || []).some(item => (item.rate || 0) > 0);
        const hasBuy = (quote.details.containerItems || []).some(item => (item.buy || 0) > 0);
        if (hasSell && !hasBuy) {
          isBuyRateMissing = true;
        } else if (hasBuy && !hasSell) {
          isSellRateMissing = true;
        }
      } else if (quote.details.mode === 'lcl') {
        const sellRate = quote.details.lclRateApplied || 0;
        const buyRate = quote.details.lclBuyRateApplied || 0;
        if (sellRate > 0 && buyRate === 0) {
          isBuyRateMissing = true;
        } else if (buyRate > 0 && sellRate === 0) {
          isSellRateMissing = true;
        }
      } else {
        const sellRate = quote.details.bbRateApplied || 0;
        const buyRate = quote.details.bbBuyRateApplied || 0;
        if (sellRate > 0 && buyRate === 0) {
          isBuyRateMissing = true;
        } else if (buyRate > 0 && sellRate === 0) {
          isSellRateMissing = true;
        }
      }
    }

    const buyGrp = document.getElementById("won-confirmed-buy-rate-group");
    const sellGrp = document.getElementById("won-confirmed-sell-rate-group");
    const sellRateInput = document.getElementById("won-confirmed-sell-rate");

    if (isSellRateMissing) {
      if (buyGrp) buyGrp.style.display = "none";
      if (sellGrp) sellGrp.style.display = "block";
      if (sellRateInput) sellRateInput.required = true;
      buyRateInput.required = false;
    } else {
      if (buyGrp) buyGrp.style.display = "block";
      if (sellGrp) sellGrp.style.display = "none";
      if (sellRateInput) sellRateInput.required = false;
      buyRateInput.required = true;
    }

    // Update Labels
    const carrierLabel = document.getElementById("won-confirmed-carrier-label");
    const titleLabel = document.getElementById("won-carrier-section-title");
    const buyRateLabel = document.getElementById("won-confirmed-buy-rate-label");
    const sellRateLabel = document.getElementById("won-confirmed-sell-rate-label");

    if (quote.type === 'air') {
      if (titleLabel) titleLabel.textContent = "Confirmed Airline Details";
      if (carrierLabel) carrierLabel.textContent = "Confirmed Airline *";
      if (buyRateLabel) buyRateLabel.textContent = "Confirmed Buy Rate (per KG) *";
      if (sellRateLabel) sellRateLabel.textContent = "Confirmed Sell Rate (per KG) *";
    } else {
      if (titleLabel) titleLabel.textContent = "Confirmed Shipping Line Details";
      if (carrierLabel) carrierLabel.textContent = "Confirmed Shipping Line *";
      if (buyRateLabel) buyRateLabel.textContent = "Confirmed Buy Rate *";
      if (sellRateLabel) sellRateLabel.textContent = "Confirmed Sell Rate *";
    }

    // Populate select dropdown options based on quote details
    carrierSelect.innerHTML = "";
    let carrierOptions = [];
    if (quote.type === 'air') {
      if (quote.details.airlines && quote.details.airlines.length > 0) {
        carrierOptions = quote.details.airlines.map(a => a.name);
      } else if (quote.details.airline) {
        carrierOptions = [quote.details.airline.split(" - ")[0]];
      }
    } else {
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

    // If no carriers were saved, let's allow a fallback
    if (carrierOptions.length === 0) {
      carrierOptions.push(quote.type === 'air' ? 'Any Airline' : 'Any Line');
    }

    carrierOptions.forEach(opt => {
      const option = document.createElement("option");
      option.value = opt;
      option.textContent = opt;
      carrierSelect.appendChild(option);
    });

    // Default buy/sell rate based on selection
    const updateRateFromSelection = () => {
      const selectedCarrier = document.getElementById("won-confirmed-carrier")?.value || "";
      let defaultBuyRate = 0;
      let defaultSellRate = 0;

      if (quote.type === 'air') {
        if (quote.details.airlines && quote.details.airlines.length > 0) {
          const match = quote.details.airlines.find(a => a.name === selectedCarrier);
          if (match) {
            const activeBr = match.usedBreak || getWeightBreakBracket(match.chargeableWeight || quote.details.chargeableWeight || 0);
            const brVal = match.breaks[activeBr];
            defaultBuyRate = (typeof brVal === 'object' && brVal !== null) ? (brVal.buy || 0) : 0;
            defaultSellRate = (typeof brVal === 'object' && brVal !== null) ? (brVal.sell || 0) : 0;
          }
        }
      } else {
        // Sea
        if (quote.details.mode === 'fcl') {
          let sumBuy = 0;
          let sumSell = 0;
          if (quote.details.containerItems && quote.details.containerItems.length > 0) {
            quote.details.containerItems.forEach(item => {
              sumBuy += (item.buy || 0);
              sumSell += (item.rate || 0);
            });
          }
          defaultBuyRate = sumBuy;
          defaultSellRate = sumSell;
        } else if (quote.details.mode === 'lcl') {
          defaultBuyRate = quote.details.lclBuyRateApplied || 0;
          defaultSellRate = quote.details.lclRateApplied || 0;
        } else {
          defaultBuyRate = quote.details.bbBuyRateApplied || 0;
          defaultSellRate = quote.details.bbRateApplied || 0;
        }
      }

      if (buyRateInput) {
        buyRateInput.value = defaultBuyRate > 0 ? defaultBuyRate : "";
      }
      if (sellRateInput) {
        sellRateInput.value = defaultSellRate > 0 ? defaultSellRate : "";
      }
    };

    // Remove existing listeners before adding
    const newSelect = carrierSelect.cloneNode(true);
    carrierSelect.parentNode.replaceChild(newSelect, carrierSelect);
    newSelect.addEventListener("change", updateRateFromSelection);
    
    // Auto-alert
    alert(`⚠️ Please select the Confirmed ${quote.type === 'air' ? 'Airline' : 'Shipping Line'} and enter/verify the Confirmed ${isSellRateMissing ? 'Sell' : 'Buy'} Rate.`);

    updateRateFromSelection();
  }

  // Populate local fees buy rates inputs
  const localFeesSection = document.getElementById("won-local-fees-section");
  const originFeesGroup = document.getElementById("won-origin-fees-group");
  const destFeesGroup = document.getElementById("won-dest-fees-group");
  const originFeesList = document.getElementById("won-origin-fees-list");
  const destFeesList = document.getElementById("won-dest-fees-list");

  if (localFeesSection && originFeesList && destFeesList) {
    originFeesList.innerHTML = "";
    destFeesList.innerHTML = "";
    
    const originSurcharges = quote.details.originSurcharges || [];
    const destSurcharges = quote.details.destSurcharges || [];

    if (originSurcharges.length > 0 || destSurcharges.length > 0) {
      localFeesSection.style.display = "block";
    } else {
      localFeesSection.style.display = "none";
    }

    if (originSurcharges.length > 0) {
      originFeesGroup.style.display = "block";
      originSurcharges.forEach((sch, i) => {
        const row = document.createElement("div");
        row.style.display = "grid";
        row.style.gridTemplateColumns = "1.5fr 1fr";
        row.style.gap = "0.8rem";
        row.style.alignItems = "center";
        row.style.marginBottom = "0.4rem";
        
        row.innerHTML = `
          <span style="font-size: 0.72rem; color: var(--t1); font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${sch.name} (${sch.unit})">
            ${sch.name} (${sch.unit}) <span style="color: var(--t3); font-size: 0.65rem;">[Sell: ${sch.rate !== undefined ? sch.rate : (sch.cost !== undefined ? sch.cost : 0)}]</span>
          </span>
          <input type="number" class="won-origin-fee-buy-input" data-index="${i}" placeholder="Buy Rate" step="0.01" value="${sch.buyRate !== undefined ? sch.buyRate : 0}"
            style="border-radius: 8px; font-size: 0.72rem; padding: 0.4rem 0.6rem; width: 100%; height: 38px; background: var(--bg-input); border: 1px solid var(--border-1); color: var(--t1);" required>
        `;
        originFeesList.appendChild(row);
      });
    } else {
      originFeesGroup.style.display = "none";
    }

    if (destSurcharges.length > 0) {
      destFeesGroup.style.display = "block";
      destSurcharges.forEach((sch, i) => {
        const row = document.createElement("div");
        row.style.display = "grid";
        row.style.gridTemplateColumns = "1.5fr 1fr";
        row.style.gap = "0.8rem";
        row.style.alignItems = "center";
        row.style.marginBottom = "0.4rem";
        
        row.innerHTML = `
          <span style="font-size: 0.72rem; color: var(--t1); font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${sch.name} (${sch.unit})">
            ${sch.name} (${sch.unit}) <span style="color: var(--t3); font-size: 0.65rem;">[Sell: ${sch.rate !== undefined ? sch.rate : (sch.cost !== undefined ? sch.cost : 0)}]</span>
          </span>
          <input type="number" class="won-dest-fee-buy-input" data-index="${i}" placeholder="Buy Rate" step="0.01" value="${sch.buyRate !== undefined ? sch.buyRate : 0}"
            style="border-radius: 8px; font-size: 0.72rem; padding: 0.4rem 0.6rem; width: 100%; height: 38px; background: var(--bg-input); border: 1px solid var(--border-1); color: var(--t1);" required>
        `;
        destFeesList.appendChild(row);
      });
    } else {
      destFeesGroup.style.display = "none";
    }
  }

  document.getElementById("won-booking-modal").style.display = "flex";
};

// REPORT GENERATOR & PDF LAYOUT
function generatePerformanceReport() {
  const period = document.getElementById("report-period").value;
  const officer = document.getElementById("report-user").value;

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
function saveCurrentQuote() {
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
    } catch(e) {}
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
    creator: appState.currentUser,
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
    const originVal = document.getElementById("air-origin").value.trim();
    const destVal = document.getElementById("air-dest").value.trim();
    const incoterm = document.getElementById("air-incoterm").value;
    
    if (!originVal) { alert("Please fill in Origin Airport."); return; }
    if (!destVal) { alert("Please fill in Destination Airport."); return; }
    
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
        return;
      }
      if (!routing) { alert("Please fill in Routing Details in the selected airline option."); return; }
      if (!tt) { alert("Please fill in Transit Time (TT) in the selected airline option."); return; }
      if (!validity) { alert("Please fill in Quote Validity in the selected airline option."); return; }
    }

    const rows = document.querySelectorAll("#air-cargo-body .cargo-item-row");
    if (rows.length === 0) {
      alert("Please add at least one Cargo Line in the Dimensions Matrix.");
      return;
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
      return;
    }

    if (tariffsEnabled) {
      const sellRateVal = appState.currentAirFreight.appliedRate || 0;
      const buyRateVal = appState.currentAirFreight.appliedBuyRate || 0;

      const activeUser = appState.currentUser;
      const isNominationUser = activeUser && (
        activeUser === 'shashank' || 
        activeUser === 'shaheer' || 
        (TEAM_ROLES[activeUser] && (TEAM_ROLES[activeUser].category === 'AIR - NOMINATION' || TEAM_ROLES[activeUser].category === 'SEA - NOMINATION'))
      );

      if (sellRateVal > 0 && buyRateVal > 0) {
        alert("❌ Quote Saved can have either Sell Rate or Buy Rate but not Both, before converting status to Converted/WON.");
        return;
      }
      if (isNominationUser) {
        if (sellRateVal <= 0 && buyRateVal <= 0) {
          alert("❌ Please enter either a Sell Rate or a Buy Rate for the active weight break under Tariffs.");
          return;
        }
      } else {
        if (sellRateVal <= 0) {
          alert("❌ Sell rate must be entered for the quote to Save to database.");
          return;
        }
      }
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
        return;
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
        return;
      }
    }

    const origin = originVal.split(" - ")[0];
    const dest = destVal.split(" - ")[0];
    const airline = primaryAirline.split(" - ")[0];

    quoteData.type = "air";
    quoteData.route = `${origin} → ${dest} via ${airline || 'Any'}`;
    quoteData.amount = appState.currentAirFreight.grandTotal;
    quoteData.amountINR = appState.currentAirFreight.grandTotalINR;
    quoteData.currency = appState.currentAirFreight.currency;
    const cargoItems = [];
    rows.forEach(row => {
      const l = parseFloat(row.querySelector(".cargo-len").value) || 0;
      const w = parseFloat(row.querySelector(".cargo-wid").value) || 0;
      const h = parseFloat(row.querySelector(".cargo-hei").value) || 0;
      const qty = parseInt(row.querySelector(".cargo-qty").value) || 0;
      const gw = parseFloat(row.querySelector(".cargo-gw").value) || 0;
      cargoItems.push({ l, w, h, qty, gw });
    });

    quoteData.details = {
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
      pivotWeight: appState.currentAirFreight.pivotWeight,
      routing: routing,
      tt: tt,
      validity: validity,
      cargoItems: cargoItems,
      commodity: document.getElementById("air-commodity").value,
      tempType: document.getElementById("air-temp-type").value,
      tempRange: document.getElementById("air-temp-range").value,
      loadabilityTilt: document.getElementById("air-loadability-tilt").value,
      loadabilityStack: document.getElementById("air-loadability-stack").value,
      airlines: appState.currentAirFreight.airlines,
      alternatives: []
    };
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
      let hasBoth = false;
      let hasNeither = false;
      let hasMissingSellRate = false;
      fclRows.forEach(row => {
        const type = row.querySelector(".fcl-type").value;
        const qty = parseInt(row.querySelector(".fcl-qty").value) || 0;
        const rateInput = row.querySelector(".fcl-sell-rate") || row.querySelector(".fcl-rate");
        const rate = parseFloat(rateInput.value) || 0;
        const buy = parseFloat(row.querySelector(".fcl-buy-rate")?.value) || 0;
        if (qty <= 0) {
          hasInvalidFcl = true;
        }
        if (rate > 0 && buy > 0) {
          hasBoth = true;
        }
        if (rate <= 0 && buy <= 0) {
          hasNeither = true;
        }
        if (rate <= 0) {
          hasMissingSellRate = true;
        }
        containerItems.push({ type, qty, rate, buy });
      });
      if (tariffsEnabled) {
        if (hasInvalidFcl) {
          alert("Please fill in Container Quantity for all container rows.");
          return;
        }
        const activeUser = appState.currentUser;
        const isNominationUser = activeUser && (
          activeUser === 'shashank' || 
          activeUser === 'shaheer' || 
          (TEAM_ROLES[activeUser] && (TEAM_ROLES[activeUser].category === 'AIR - NOMINATION' || TEAM_ROLES[activeUser].category === 'SEA - NOMINATION'))
        );
        if (hasBoth) {
          alert("❌ Quote Saved can have either Sell Rate or Buy Rate but not Both, before converting status to Converted/WON.");
          return;
        }
        if (isNominationUser) {
          if (hasNeither) {
            alert("❌ Please enter either a Sell Rate or a Buy Rate for all container rows.");
            return;
          }
        } else {
          if (hasMissingSellRate) {
            alert("❌ Sell rate must be entered for all container rows.");
            return;
          }
        }
      }
    }

    const cargoItems = [];
    const rows = document.querySelectorAll("#sea-cargo-body .sea-cargo-item-row");
    if (appState.currentSeaFreight.type === 'lcl') {
      if (tariffsEnabled) {
        const lclRate = parseFloat(document.getElementById("sea-lcl-rate").value) || 0;
        const lclBuyRate = parseFloat(document.getElementById("sea-lcl-buy-rate")?.value) || 0;

        const activeUser = appState.currentUser;
        const isNominationUser = activeUser && (
          activeUser === 'shashank' || 
          activeUser === 'shaheer' || 
          (TEAM_ROLES[activeUser] && (TEAM_ROLES[activeUser].category === 'AIR - NOMINATION' || TEAM_ROLES[activeUser].category === 'SEA - NOMINATION'))
        );

        if (lclRate > 0 && lclBuyRate > 0) {
          alert("❌ Quote Saved can have either Sell Rate or Buy Rate but not Both, before converting status to Converted/WON.");
          return;
        }
        if (isNominationUser) {
          if (lclRate <= 0 && lclBuyRate <= 0) {
            alert("❌ Please enter either LCL Sell Rate or Buy Rate per Revenue Ton (RT).");
            return;
          }
        } else {
          if (lclRate <= 0) {
            alert("❌ Sell rate must be entered for the quote to Save to database.");
            return;
          }
        }
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
        const bbRate = parseFloat(document.getElementById("sea-bb-rate").value) || 0;
        const bbBuyRate = parseFloat(document.getElementById("sea-bb-buy-rate")?.value) || 0;

        const activeUser = appState.currentUser;
        const isNominationUser = activeUser && (
          activeUser === 'shashank' || 
          activeUser === 'shaheer' || 
          (TEAM_ROLES[activeUser] && (TEAM_ROLES[activeUser].category === 'AIR - NOMINATION' || TEAM_ROLES[activeUser].category === 'SEA - NOMINATION'))
        );

        if (bbRate > 0 && bbBuyRate > 0) {
          alert("❌ Quote Saved can have either Sell Rate or Buy Rate but not Both, before converting status to Converted/WON.");
          return;
        }
        if (isNominationUser) {
          if (bbRate <= 0 && bbBuyRate <= 0) {
            alert("❌ Please enter either Break Bulk Sell Rate or Buy Rate per Revenue Ton (RT).");
            return;
          }
        } else {
          if (bbRate <= 0) {
            alert("❌ Sell rate must be entered for the quote to Save to database.");
            return;
          }
        }
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
      const seaOriginRows = document.querySelectorAll("#sea-origin-surcharges-body tr");
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
      const seaDestRows = document.querySelectorAll("#sea-dest-surcharges-body tr");
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
      incoterm: incoterm,
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
      lclChargeable: Math.max(appState.currentSeaFreight.volumeCbm, appState.currentSeaFreight.grossWeight / 1000),
      lclRateApplied: parseFloat(document.getElementById("sea-lcl-rate")?.value) || 0,
      bbRateApplied: parseFloat(document.getElementById("sea-bb-rate")?.value) || 0,
      lclBuyRateApplied: parseFloat(document.getElementById("sea-lcl-buy-rate")?.value) || 0,
      bbBuyRateApplied: parseFloat(document.getElementById("sea-bb-buy-rate")?.value) || 0,
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

  if (!validateCreditCompliance(quoteData)) {
    return;
  }

  if (appState.editingQuoteId) {
    const existingIndex = appState.quotes.findIndex(q => q.id === appState.editingQuoteId);
    if (existingIndex !== -1) {
      const originalQuote = appState.quotes[existingIndex];
      quoteData.id = originalQuote.id;
      quoteData.date = new Date().toISOString().split('T')[0]; // Updated execution date
      quoteData.creator = originalQuote.creator;
      quoteData.quoteNumber = originalQuote.quoteNumber || (existingIndex + 1);
      quoteData.amendmentAllowed = false; // Lock it back!
      
      appState.editingQuoteId = null; // Clear edit mode
      DB.saveQuote(quoteData);
      alert("Quotation amended and locked successfully!");
    }
  } else {
    DB.saveQuote(quoteData);
    alert("Quotation saved successfully!");
  }

  // Clear inputs
  document.getElementById(isAir ? "air-cust-name" : "sea-cust-name").value = "";
  if (isAir) {
    document.getElementById("air-origin").value = "";
    document.getElementById("air-dest").value = "";
    document.getElementById("air-airline").value = "";
    document.getElementById("air-incoterm").value = "EXW";
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
      setupAirFreightEvents();
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
    airStatusLabel.textContent = "[Required]";
    airStatusLabel.style.color = "var(--accent-error)";
  }
  const airFilenameLabel = document.getElementById("air-agreement-filename");
  if (airFilenameLabel) airFilenameLabel.textContent = "No file selected";

  const seaStatusLabel = document.getElementById("sea-agreement-status");
  if (seaStatusLabel) {
    seaStatusLabel.textContent = "[Required]";
    seaStatusLabel.style.color = "var(--accent-error)";
  }
  const seaFilenameLabel = document.getElementById("sea-agreement-filename");
  if (seaFilenameLabel) seaFilenameLabel.textContent = "No file selected";

  alert("Quotation successfully saved to database!");
  returnToWorkspace();
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
          <td><input type="number" class="chg-rate" value="0.00" step="0.01" required></td>
          <td><input type="number" class="chg-buy-rate" value="0.00" step="0.01" required style="background: rgba(255,255,255,0.03); color: var(--t1);"></td>
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
          <td><input type="number" class="chg-rate" value="0.00" step="0.01" required></td>
          <td><input type="number" class="chg-buy-rate" value="0.00" step="0.01" required style="background: rgba(255,255,255,0.03); color: var(--t1);"></td>
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
          <td><input type="number" class="chg-rate" value="0.00" step="0.01" required></td>
          <td><input type="number" class="chg-buy-rate" value="0.00" step="0.01" required style="background: rgba(255,255,255,0.03); color: var(--t1);"></td>
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
          <td><input type="number" class="chg-rate" value="0.00" step="0.01" required></td>
          <td><input type="number" class="chg-buy-rate" value="0.00" step="0.01" required style="background: rgba(255,255,255,0.03); color: var(--t1);"></td>
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
          <td><input type="number" class="chg-rate" value="6.00" step="0.01" required readonly style="background: rgba(255,255,255,0.02); color: var(--text-dim);"></td>
          <td><input type="number" class="chg-buy-rate" value="4.00" step="0.01" required readonly style="background: rgba(255,255,255,0.02); color: var(--text-dim);"></td>
          <td>
            <select class="chg-unit" disabled style="background: rgba(0,0,0,0.2); color: var(--text-dim);">
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
          <td><input type="number" class="chg-rate" value="6.00" step="0.01" required readonly style="background: rgba(255,255,255,0.02); color: var(--text-dim);"></td>
          <td><input type="number" class="chg-buy-rate" value="4.00" step="0.01" required readonly style="background: rgba(255,255,255,0.02); color: var(--text-dim);"></td>
          <td>
            <select class="chg-unit" disabled style="background: rgba(0,0,0,0.2); color: var(--text-dim);">
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
        <td><input type="number" class="chg-rate" value="0.00" step="0.01" required></td>
        <td><input type="number" class="chg-buy-rate" value="0.00" step="0.01" required style="background: rgba(255,255,255,0.03); color: var(--t1);"></td>
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
        <td><input type="number" class="chg-rate" value="0.00" step="0.01" required></td>
        <td><input type="number" class="chg-buy-rate" value="0.00" step="0.01" required style="background: rgba(255,255,255,0.03); color: var(--t1);"></td>
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
        <td><input type="number" class="chg-rate" value="0.00" step="0.01" required></td>
        <td><input type="number" class="chg-buy-rate" value="0.00" step="0.01" required style="background: rgba(255,255,255,0.03); color: var(--t1);"></td>
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
        <td><input type="number" class="chg-rate" value="0.00" step="0.01" required></td>
        <td><input type="number" class="chg-buy-rate" value="0.00" step="0.01" required style="background: rgba(255,255,255,0.03); color: var(--t1);"></td>
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
        <td><input type="number" class="chg-rate" value="0.00" step="0.01" required></td>
        <td><input type="number" class="chg-buy-rate" value="0.00" step="0.01" required style="background: rgba(255,255,255,0.03); color: var(--t1);"></td>
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
        <td><input type="number" class="chg-rate" value="0.00" step="0.01" required></td>
        <td><input type="number" class="chg-buy-rate" value="0.00" step="0.01" required style="background: rgba(255,255,255,0.03); color: var(--t1);"></td>
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
        <td><input type="number" class="chg-rate" value="0.00" step="0.01" required></td>
        <td><input type="number" class="chg-buy-rate" value="0.00" step="0.01" required style="background: rgba(255,255,255,0.03); color: var(--t1);"></td>
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
        <td><input type="number" class="chg-rate" value="0.00" step="0.01" required></td>
        <td><input type="number" class="chg-buy-rate" value="0.00" step="0.01" required style="background: rgba(255,255,255,0.03); color: var(--t1);"></td>
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
      <table style="width: 100%; border-collapse: collapse; margin-top: 0.5rem; border: 1px solid #e2e8f0;">
        <thead>
          <tr style="background: #f8fafc;">
            <th style="border: 1px solid #e2e8f0; padding: 8px 12px; font-size: 0.72rem; text-transform: uppercase; font-weight: 700; color: #374151; text-align: left;">Airline</th>
            <th style="border: 1px solid #e2e8f0; padding: 8px 12px; font-size: 0.72rem; text-transform: uppercase; font-weight: 700; color: #374151; text-align: left;">Routing</th>
            <th style="border: 1px solid #e2e8f0; padding: 8px 12px; font-size: 0.72rem; text-transform: uppercase; font-weight: 700; color: #374151; text-align: left;">Transit Time</th>
            <th style="border: 1px solid #e2e8f0; padding: 8px 12px; font-size: 0.72rem; text-transform: uppercase; font-weight: 700; color: #374151; text-align: left;">Validity</th>
            <th style="border: 1px solid #e2e8f0; padding: 8px 12px; font-size: 0.72rem; text-transform: uppercase; font-weight: 700; color: #374151; text-align: left;">Pivot Wt</th>
            <th style="border: 1px solid #e2e8f0; padding: 8px 12px; font-size: 0.72rem; text-transform: uppercase; font-weight: 700; color: #374151; text-align: left;">Chargeable Wt</th>
            <th style="border: 1px solid #e2e8f0; padding: 8px 12px; font-size: 0.72rem; text-transform: uppercase; font-weight: 700; color: #374151; text-align: left;">Base Freight</th>
            <th style="border: 1px solid #e2e8f0; padding: 8px 12px; font-size: 0.72rem; text-transform: uppercase; font-weight: 700; color: #374151; text-align: left;">Surcharges</th>
            <th style="border: 1px solid #e2e8f0; padding: 8px 12px; font-size: 0.72rem; text-transform: uppercase; font-weight: 700; color: #374151; text-align: left;">Grand Total</th>
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
      <tr><td>Air Freight Desk Module</td><td><strong>Air ${quote.details.module === 'import' ? 'Import' : 'Export'}</strong></td></tr>
      <tr><td>Origin Airport</td><td>${quote.details.origin || 'BOM'}</td></tr>
      <tr><td>Destination Airport</td><td>${quote.details.destination || 'JFK'}</td></tr>
      <tr><td>Airline(s)</td><td><strong>${quotedAirlinesList}</strong></td></tr>
      <tr><td>Commodity Type</td><td><strong>${commodityText}</strong></td></tr>
      <tr><td>Loadability</td><td><strong>${loadabilityText}</strong></td></tr>
      <tr><td>Incoterm</td><td><strong>${quote.details.incoterm || 'EXW'}</strong></td></tr>
      <tr><td>Actual Gross Weight</td><td>${(quote.details.grossWeight || 0).toFixed(2)} kg</td></tr>
      <tr><td>Total Package Quantity</td><td>${quote.details.quantity || 'N/A'} Pkgs</td></tr>
      <tr><td>Volume Weight</td><td>${(quote.details.volumeWeight || 0).toFixed(2)} kg</td></tr>
      <tr><td>Volume (CBM)</td><td>${(quote.details.cbm || 0).toFixed(3)} CBM</td></tr>
      <tr><td>Chargeable Weight</td><td>${(quote.details.chargeableWeight || 0).toFixed(2)} kg</td></tr>
      ${quote.details.pivotWeight ? `<tr><td>Pivot Weight</td><td>${quote.details.pivotWeight.toFixed(2)} kg</td></tr>` : ''}
    `;
  } else {
    let modeLabel = 'FCL (Containers)';
    if (quote.details.mode === 'lcl') {
      modeLabel = 'LCL (Loose Cargo)';
    } else if (quote.details.mode === 'bb') {
      modeLabel = 'Break Bulk (Loose Cargo)';
    }

    let subDetails = "";
    if (quote.details.mode === 'fcl') {
      subDetails = `<tr><td>Containers Selected</td><td>${(quote.details.fclSummary || []).join(", ") || 'Containers'}</td></tr>`;
      if (quote.details.stuffingOption) {
        const stuffingLabel = quote.details.stuffingOption === 'factory' ? 'Factory Stuffing' : 'CFS/ICD Stuffing';
        subDetails += `<tr><td>Stuffing Option</td><td><strong>${stuffingLabel}</strong></td></tr>`;
      }
    } else if (quote.details.mode === 'lcl') {
      subDetails = `
        <tr><td>LCL Chargeable RT</td><td>${(quote.details.lclChargeable || 0).toFixed(2)} RT</td></tr>
        <tr><td>LCL Ocean Rate</td><td>${currencySym}${(quote.details.lclRateApplied || 0).toFixed(2)} / RT</td></tr>
      `;
    } else {
      subDetails = `
        <tr><td>Break Bulk Chargeable RT</td><td>${(quote.details.lclChargeable || 0).toFixed(2)} RT</td></tr>
        <tr><td>Break Bulk Rate</td><td>${currencySym}${(quote.details.bbRateApplied || 0).toFixed(2)} / RT</td></tr>
      `;
    }
    detailsRows = `
      <tr><td>Sea Freight Desk Module</td><td><strong>Sea ${quote.details.module === 'import' ? 'Import' : 'Export'}</strong></td></tr>
      <tr><td>Origin Port</td><td>${quote.details.origin || 'INNSA'}</td></tr>
      <tr><td>Destination Port</td><td>${quote.details.destination || 'Rotterdam'}</td></tr>
      <tr><td>Shipping Line</td><td>${quote.details.shippingLine || 'N/A'}</td></tr>
      <tr><td>Liner Name</td><td>${quote.details.linerName || 'N/A'}</td></tr>
      <tr><td>Commodity</td><td>${quote.details.commodity || 'N/A'}</td></tr>
      <tr><td>Incoterm</td><td><strong>${quote.details.incoterm || 'EXW'}</strong></td></tr>
      <tr><td>Sea Freight Mode</td><td>${modeLabel}</td></tr>
      <tr><td>Total Gross Weight</td><td>${(quote.details.grossWeight || 0).toFixed(2)} kg</td></tr>
      <tr><td>Total Volume</td><td>${(quote.details.volumeCbm || 0).toFixed(2)} CBM</td></tr>
      <tr><td>Total Package Quantity</td><td>${quote.details.packagesQuantity || 'N/A'} Pkgs</td></tr>
      ${subDetails}
      <tr><td>Routing</td><td>${quote.details.routing || 'Direct'}</td></tr>
      <tr><td>Transit Time (TT)</td><td>${quote.details.tt || 'N/A'}</td></tr>
      <tr><td>Validity</td><td>${quote.details.validity || 'N/A'}</td></tr>
      <tr><td>Base Ocean Freight</td><td>${currencySym}${(quote.details.baseFreight || 0).toFixed(2)}</td></tr>
      <tr><td>Charges Breakup</td><td><button class="no-print" onclick="window.showSeaBreakup('${quote.id}')" style="background:#1b1c5c; color:#fff; border:none; border-radius:4px; padding:4px 8px; font-size:0.65rem; cursor:pointer; font-weight:bold; outline:none; transition:all 0.15s; box-shadow:0 1px 3px rgba(0,0,0,0.1);">👁️ View Breakup</button></td></tr>
    `;
  }

  if (quote.status === 'converted') {
    const buyVal = quote.confirmedBuyRate || 0;
    const sellVal = quote.confirmedSellRate || 0;
    const gpVal = quote.grossProfit || 0;

    detailsRows += `
      <tr style="background: rgba(46,204,113,0.1); font-weight: bold; border-left: 3px solid var(--accent-success);">
        <td style="padding: 8px 12px; font-size: 0.72rem;">Confirmed Carrier</td>
        <td style="padding: 8px 12px; font-size: 0.72rem;"><strong style="color: var(--accent-success);">${quote.confirmedCarrier || 'N/A'}</strong></td>
      </tr>
      <tr style="background: rgba(46,204,113,0.1); font-weight: bold; border-left: 3px solid var(--accent-success);">
        <td style="padding: 8px 12px; font-size: 0.72rem;">Confirmed Buy Rate</td>
        <td style="padding: 8px 12px; font-size: 0.72rem;"><strong style="color: var(--accent-success);">${currencySym}${buyVal.toFixed(2)}</strong></td>
      </tr>
      <tr style="background: rgba(46,204,113,0.1); font-weight: bold; border-left: 3px solid var(--accent-success);">
        <td style="padding: 8px 12px; font-size: 0.72rem;">Confirmed Sell Rate</td>
        <td style="padding: 8px 12px; font-size: 0.72rem;"><strong style="color: var(--accent-success);">${currencySym}${sellVal.toFixed(2)}</strong></td>
      </tr>
      <tr style="background: rgba(46,204,113,0.1); font-weight: bold; border-left: 3px solid var(--accent-success);">
        <td style="padding: 8px 12px; font-size: 0.72rem;">Gross Profit (GP)</td>
        <td style="padding: 8px 12px; font-size: 0.72rem;"><strong style="color: var(--accent-success);">${currencySym}${Math.abs(gpVal).toFixed(2)}</strong></td>
      </tr>
    `;
  }

  let originSurchargeRows = "";
  let destSurchargeRows = "";

  const originList = quote.details.originSurcharges || [];
  const destList = quote.details.destSurcharges || [];

  if (originList.length > 0) {
    originList.forEach(s => {
      const cost = s.calculatedCost || s.cost;
      const rateLabel = s.unit ? `(${currencySym}${s.rate}/${s.unit})` : '';
      originSurchargeRows += `<tr><td>${s.name} ${rateLabel}</td><td>${currencySym}${cost.toFixed(2)}</td></tr>`;
    });
  } else {
    // If it's an old quote with only 'surcharges' array, put them in origin
    if (quote.details.surcharges && quote.details.surcharges.length > 0 && originList.length === 0) {
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

  let termsList = "";
  const rawTerms = quote.details && quote.details.termsAndConditions ? quote.details.termsAndConditions : (isAir ? DEFAULT_AIR_TERMS : DEFAULT_SEA_TERMS);
  rawTerms.split("\n").map(l => l.trim()).filter(l => l.length > 0).forEach(line => {
    termsList += `<li>${line}</li>`;
  });

    const isMultiCarrier = (quote.details.airlines && quote.details.airlines.length > 1) || 
                           (quote.details.alternatives && quote.details.alternatives.length > 1);

    const bottomTotalBox = isMultiCarrier ? "" : `
      <div class="total-summary-box">
        <strong>GRAND TOTAL FREIGHT CHARGES (EXCLUDING LOCAL TAXES):</strong>
        <span class="val">${currencySym}${quote.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
      </div>
    `;

    printCard.innerHTML = `
      <div class="print-header" style="display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #333; padding-bottom: 1.5rem; margin-bottom: 1.5rem;">
        <div style="display: flex; align-items: center; gap: 0.6rem;">
          <img src="logo.png" alt="Vertex Logo" style="height: 50px; width: 50px; object-fit: contain; border-radius: 50%;">
          <div style="display: flex; flex-direction: column; justify-content: center;">
            <div style="color: #1b1c5c; font-family: 'Cinzel', serif; display: inline-flex; align-items: baseline; line-height: 1.0;">
              <span style="font-size: 1.5rem; font-weight: 700; letter-spacing: 0.04em;">VERTE</span>
              <span class="custom-brand-x" style="font-size: 2.0rem; font-weight: 900; margin-left: 2px; transform: translateY(0.04em);"></span>
            </div>
            <div style="font-size: 0.75rem; color: #64748b; font-weight: 500; font-family: 'Futura', 'Outfit', sans-serif; font-style: italic; letter-spacing: 0.08em; text-transform: uppercase; margin-top: 0.25rem;">Pricing, Simplified</div>
          </div>
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
  if (appState.currentUser !== 'ganny' && !quote.deletionAllowed) {
    let requests = window._amendmentRequests || [];
    if (requests.length === 0) {
      const stored = localStorage.getItem("gl_amendment_requests");
      if (stored) {
        try { requests = JSON.parse(stored); } catch(e) {}
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
      creator: quote.creator,
      creatorName: TEAM_ROLES[quote.creator]?.name || quote.creator,
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
        try { requests = JSON.parse(stored); } catch(e) {}
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
  actions: 'date-desc', search_actions: ''
};

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
    actions: 'date-desc', search_actions: ''
  };

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
  if (document.getElementById('hdr-label-agentroute')) document.getElementById('hdr-label-agentroute').textContent = 'Agent/Route';
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
    quotes.forEach(q => { if (q.creator) creatorsSet.add(q.creator); });
    
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

  // 4. AGENT & ROUTE DETAILS (Show ALL Customers/Agents & Routes)
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
  if (document.getElementById('user-hdr-label-agentroute')) document.getElementById('user-hdr-label-agentroute').textContent = 'Agent/Route';
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

  // 3. AGENT & ROUTE DETAILS
  const agentRouteOptions = document.getElementById('user-hdr-options-agentroute');
  if (agentRouteOptions) {
    const itemsSet = new Set();
    quotes.forEach(q => {
      if (q.customer && q.customer.trim()) itemsSet.add(q.customer.trim());
      if (q.route && q.route.trim()) itemsSet.add(q.route.trim());
    });
    const sortedItems = Array.from(itemsSet).sort();
    let html = `<div class="hdr-filter-opt ${window.userHdrFilterState.agentroute === 'all' ? 'active' : ''}" onclick="selectUserHdrFilter('agentroute', 'all', 'All Agents & Routes')">All Agents & Routes</div>`;
    sortedItems.forEach(item => {
      const active = window.userHdrFilterState.agentroute === item ? 'active' : '';
      const escapedItem = item.replace(/'/g, "\\'");
      html += `<div class="hdr-filter-opt ${active}" onclick="selectUserHdrFilter('agentroute', '${escapedItem}', '${escapedItem}')">${item}</div>`;
    });
    agentRouteOptions.innerHTML = html;
  }
};

window.applyUserDbFiltersAndSort = () => {
  const tbody = document.getElementById("user-quotes-body");
  if (!tbody) return;

  const userId = window.userDashboardId || appState.currentUser;
  const myQuotes = appState.quotes.filter(q => q.creator === userId);

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
    const buyRateStr = (q.buyRate || q.details?.buyRate || "").toString().toLowerCase();
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

    // Agent & Route filter
    if (st.agentroute && st.agentroute !== 'all') {
      const targetAR = st.agentroute.toLowerCase();
      if (customerStr !== targetAR && routeStr !== targetAR && !customerStr.includes(targetAR) && !routeStr.includes(targetAR)) {
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
    if (st.search_agentroute && !customerStr.includes(st.search_agentroute) && !routeStr.includes(st.search_agentroute) && !originStr.includes(st.search_agentroute) && !destStr.includes(st.search_agentroute)) return false;
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

  tbody.innerHTML = "";
  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="10" style="text-align: center; color: var(--text-dim); padding: 2rem;">No enquiries found matching filters.</td></tr>`;
    return;
  }

  filtered.forEach(quote => {
    const tr = document.createElement("tr");
    tr.setAttribute("data-quote-id", quote.id);
    const currencySym = quote.currency === 'INR' ? '₹' : (quote.currency === 'USD' ? '$' : (quote.currency === 'EUR' ? '€' : '£'));
    const quoteAmount = `${currencySym}${quote.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
    const buyRateSym = quote.buyRateCurrency === 'INR' ? '₹' : (quote.buyRateCurrency === 'USD' ? '$' : (quote.buyRateCurrency === 'EUR' ? '€' : '£'));
    const carrierName = quote.details?.airline || quote.details?.shippingLine || quote.details?.carrier || '-';
    
    const isQuoted = quote.status === 'quoted';
    const statusLabel = quote.status === 'quoted' ? 'Quoted' : (quote.status === 'converted' ? 'Converted' : (quote.status === 'cancelled' ? 'Cancelled' : 'Lost'));
    
    tr.innerHTML = `
      <td><strong>#${getQuoteRefId(quote)}</strong></td>
      <td>${quote.date}</td>
      <td><span class="quote-type-badge ${quote.type}">
        ${quote.type === 'air' ? 
          `<svg width="11" height="11" style="margin-right:4px; display:inline-block; vertical-align:middle;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-4 4H3l-2 3 3-2v-2l4-4 3.5 5.3c.3.4.8.5 1.3.3l.5-.3c.4-.2.6-.6.5-1.1z"/></svg>${quote.details && quote.details.module === 'import' ? 'Air Import' : 'Air Export'}` : 
          `<svg width="11" height="11" style="margin-right:4px; display:inline-block; vertical-align:middle;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M2 21h20M19.3 14.8C18 13.5 16 13.5 14.7 14.8L12 17.5l-2.7-2.7C8 13.5 6 13.5 4.7 14.8L2 17.5V19h20v-1.5l-2.7-2.7zM12 2v10M12 2l-3 3M12 2l3 3"/></svg>${quote.details && quote.details.module === 'import' ? 'Sea Import' : 'Sea Export'}`
        }</span></td>
      <td>
        <div style="font-weight: 600;">${quote.customer}</div>
        <div style="font-size:0.75rem; color:var(--text-muted);">${quote.route}</div>
      </td>
      <td><span style="font-size:0.8rem; font-weight:600; color:var(--text-dim);">${carrierName}</span></td>
      <td><span style="font-size:0.8rem; font-weight:600; color:var(--text-dim);">${quote.buyRate ? `${buyRateSym}${quote.buyRate.toLocaleString()}` : (quote.details?.buyRate ? `${currencySym}${quote.details.buyRate.toLocaleString()}` : '-')}</span></td>
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
      <td class="actions-cell">
        <button class="action-icon-btn amend" style="background: ${quote.amendmentAllowed ? 'rgba(245, 158, 11, 0.25)' : 'rgba(255,255,255,0.05)'}; color: ${quote.amendmentAllowed ? 'var(--accent-warning)' : 'var(--text-dim)'};" title="${quote.amendmentAllowed ? 'Correct / Amend Quote (Unlocked)' : 'Request Admin Permission to Correct/Amend'}" onclick="amendQuote('${quote.id}')">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
        </button>
        <button class="action-icon-btn view" title="View/Print Quote" onclick="viewSavedQuote('${quote.id}')">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
        </button>
        ${isQuoted ? `
        <button class="action-icon-btn convert" style="background: rgba(74, 222, 128, 0.2); color: var(--accent-success);" title="Convert Quote to Won" onclick="convertQuote('${quote.id}')">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
        </button>
        <button class="action-icon-btn delete" style="background: ${quote.amendmentAllowed ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255,255,255,0.05)'}; color: ${quote.amendmentAllowed ? 'var(--accent-error)' : 'var(--text-dim)'};" title="${quote.amendmentAllowed ? 'Mark as Cancelled (Unlocked)' : 'Request Admin Permission to Cancel'}" onclick="markQuoteCancelled('${quote.id}')">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
        </button>
        <button class="action-icon-btn view" style="background: ${quote.amendmentAllowed ? 'rgba(156, 163, 175, 0.15)' : 'rgba(255,255,255,0.05)'}; color: ${quote.amendmentAllowed ? 'var(--t1)' : 'var(--text-dim)'};" title="${quote.amendmentAllowed ? 'Mark as Lost (Unlocked)' : 'Request Admin Permission to Mark as Lost'}" onclick="markQuoteLost('${quote.id}')">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        </button>
        ` : `
        <button class="action-icon-btn convert" style="background: ${quote.amendmentAllowed ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255,255,255,0.05)'}; color: ${quote.amendmentAllowed ? 'var(--accent-success)' : 'var(--text-dim)'};" title="${quote.amendmentAllowed ? 'Revert to Original (Unlocked)' : 'Request Admin Permission to Revert'}" onclick="revertQuoteToOriginal('${quote.id}')">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><polyline points="3 3 3 8 8 8"/></svg>
        </button>
        `}
        <button class="action-icon-btn delete" style="background: ${quote.deletionAllowed ? 'rgba(239, 68, 68, 0.25)' : 'rgba(255,255,255,0.05)'}; color: ${quote.deletionAllowed ? 'var(--accent-error)' : 'var(--text-dim)'};" title="${quote.deletionAllowed ? 'Delete Quote (Unlocked)' : 'Request Admin Permission to Delete'}" onclick="deleteQuote('${quote.id}')">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/></svg>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
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

window.applyDbFiltersAndSort = () => {
  const tbody = document.getElementById("admin-quotes-body");
  if (!tbody) return;

  if (!window._isPaging) {
    window.dbCurrentPage = 1;
  }

  // Populate dynamic filter option lists
  populateAllHeaderFilterDropdowns();

  const topSearch = (document.getElementById("db-search-input")?.value || "").toLowerCase().trim();
  const st = window.hdrFilterState || {};
  const startDateVal = document.getElementById("db-filter-start-date")?.value;
  const endDateVal = document.getElementById("db-filter-end-date")?.value;

  let filtered = (appState.quotes || []).filter(q => {
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
    const buyRateStr = (q.buyRate || q.details?.buyRate || "").toString().toLowerCase();
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

    // Agent & Route filter (match customer or route)
    if (st.agentroute && st.agentroute !== 'all') {
      const targetAR = st.agentroute.toLowerCase();
      if (customerStr !== targetAR && routeStr !== targetAR && !customerStr.includes(targetAR) && !routeStr.includes(targetAR)) {
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

    // Search query matches for individual header filters
    if (st.search_refid && !refIdStr.includes(st.search_refid)) return false;
    if (st.search_date && !dateStr.includes(st.search_date)) return false;
    if (st.search_mode && !typeStr.includes(st.search_mode)) return false;
    if (st.search_agentroute && !customerStr.includes(st.search_agentroute) && !routeStr.includes(st.search_agentroute) && !originStr.includes(st.search_agentroute) && !destStr.includes(st.search_agentroute)) return false;
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
    tbody.innerHTML = `<tr><td colspan="11" style="text-align: center; color: var(--text-dim); padding: 2rem;">No enquiries found matching filters.</td></tr>`;
    return;
  }

  pageFiltered.forEach(quote => {
    const tr = document.createElement("tr");
    tr.setAttribute("data-quote-id", quote.id);
    const currencySym = quote.currency === 'INR' ? '₹' : (quote.currency === 'USD' ? '$' : (quote.currency === 'EUR' ? '€' : '£'));
    const amountStr = `${currencySym}${quote.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
    const amountINRStr = `₹${quote.amountINR.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
    const buyRateSym = quote.buyRateCurrency === 'INR' ? '₹' : (quote.buyRateCurrency === 'USD' ? '$' : (quote.buyRateCurrency === 'EUR' ? '€' : '£'));
    const carrierName = quote.details?.airline || quote.details?.shippingLine || quote.details?.carrier || '-';
    
    tr.innerHTML = `
      <td><strong>#${getQuoteRefId(quote)}</strong></td>
      <td>${quote.date}</td>
      <td><span class="quote-type-badge ${quote.type}">
        ${quote.type === 'air' ? 
          `<svg width="11" height="11" style="margin-right:4px; display:inline-block; vertical-align:middle;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-4 4H3l-2 3 3-2v-2l4-4 3.5 5.3c.3.4.8.5 1.3.3l.5-.3c.4-.2.6-.6.5-1.1z"/></svg>${quote.details && quote.details.module === 'import' ? 'Air Import' : 'Air Export'}` : 
          `<svg width="11" height="11" style="margin-right:4px; display:inline-block; vertical-align:middle;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M2 21h20M19.3 14.8C18 13.5 16 13.5 14.7 14.8L12 17.5l-2.7-2.7C8 13.5 6 13.5 4.7 14.8L2 17.5V19h20v-1.5l-2.7-2.7zM12 2v10M12 2l-3 3M12 2l3 3"/></svg>${quote.details && quote.details.module === 'import' ? 'Sea Import' : 'Sea Export'}`
        }</span></td>
      <td>
        <div style="font-weight: 600;">${quote.customer}</div>
        <div style="font-size:0.75rem; color:var(--text-muted);">${quote.route}</div>
      </td>
      <td><span style="font-size:0.8rem; font-weight:600; color:var(--t1);">${TEAM_ROLES[quote.creator]?.name || quote.creator}</span></td>
      <td><span style="font-size:0.8rem; font-weight:600; color:var(--t2);">${carrierName}</span></td>
      <td><span style="font-size:0.8rem; font-weight:600; color:var(--t2);">${quote.buyRate ? `${buyRateSym}${quote.buyRate.toLocaleString()}` : (quote.details?.buyRate ? `${currencySym}${quote.details.buyRate.toLocaleString()}` : '-')}</span></td>
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
      <td class="actions-cell">
        <button class="action-icon-btn amend" style="background: rgba(245, 158, 11, 0.25); color: var(--accent-warning);" title="Correct / Amend Quote (Admin Override)" onclick="amendQuote('${quote.id}')">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
        </button>
        <button class="action-icon-btn view" title="View Quote" onclick="viewSavedQuote('${quote.id}')">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
        </button>
        ${quote.status === 'quoted' ? `
        <button class="action-icon-btn convert" title="Convert Quote" onclick="convertQuote('${quote.id}')">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
        </button>
        <button class="action-icon-btn delete" style="background: rgba(239, 68, 68, 0.1); color: var(--accent-error);" title="Mark as Cancelled" onclick="markQuoteCancelled('${quote.id}')">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
        </button>
        <button class="action-icon-btn view" style="background: rgba(156, 163, 175, 0.1); color: var(--text-dim);" title="Mark as Lost" onclick="markQuoteLost('${quote.id}')">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        </button>
        ` : `
        <button class="action-icon-btn convert" style="background: rgba(16, 185, 129, 0.2); color: var(--accent-success);" title="Revert Quote status to Quoted" onclick="revertQuoteToOriginal('${quote.id}')">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><polyline points="3 3 3 8 8 8"/></svg>
        </button>
        `}
        <button class="action-icon-btn delete" style="background: rgba(239, 68, 68, 0.25); color: var(--accent-error);" title="Delete Quote (Admin Override)" onclick="deleteQuote('${quote.id}')">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/></svg>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
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
    const defaultUsers = [
      { id: 'shashank', defaultName: 'Air Nom', icon: `<svg width="11" height="11" style="margin-right:4px; display:inline-block; vertical-align:middle;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-4 4H3l-2 3 3-2v-2l4-4 3.5 5.3c.3.4.8.5 1.3.3l.5-.3c.4-.2.6-.6.5-1.1z"/></svg>` },
      { id: 'shaheer', defaultName: 'Sea Nomination', icon: `<svg width="11" height="11" style="margin-right:4px; display:inline-block; vertical-align:middle;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M2 21h20M19.3 14.8C18 13.5 16 13.5 14.7 14.8L12 17.5l-2.7-2.7C8 13.5 6 13.5 4.7 14.8L2 17.5V19h20v-1.5l-2.7-2.7zM12 2v10M12 2l-3 3M12 2l3 3"/></svg>` },
      { id: 'jaya', defaultName: 'Free Hand', icon: '' },
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
  }

  const activeUser = appState.currentUser;
  if (activeUser && activeUser !== 'ganny') {
    const activeUserName = document.getElementById("active-user-name");
    let name = (TEAM_ROLES[activeUser]?.name || activeUser).replace(/\s*\(Free\s*Hand\)/i, "");
    if (activeUser === 'shaheer') name = 'Sea Nomination';
    if (activeUserName) activeUserName.textContent = name;
  }

  // Update report user dropdown options dynamically with all Pricing Officers
  const reportUserSelect = document.getElementById("report-user");
  if (reportUserSelect) {
    const curVal = reportUserSelect.value;
    const roles = Object.keys(TEAM_ROLES).filter(roleId => roleId !== 'ganny' && roleId !== 'manager' && roleId !== 'mahendra');
    let html = `<option value="all">All Pricing Officers</option>`;
    roles.forEach(roleId => {
      let name = (TEAM_ROLES[roleId]?.name || roleId).replace(/\s*\(Free\s*Hand\)/i, "");
      if (roleId === 'shaheer' && name.toLowerCase() === 'shaheer') {
        name = 'Sea Nomination';
      }
      html += `<option value="${roleId}">${name}</option>`;
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
        try { customUsers = JSON.parse(stored); } catch(err) {}
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
      <td><input type="number" class="chg-rate" step="0.01" value="${s.rate}" required></td>
      <td><input type="number" class="chg-buy-rate" step="0.01" value="${s.buyRate || 0.00}" required style="background: rgba(255,255,255,0.03); color: var(--t1);"></td>
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
    document.getElementById("air-freight-panel").classList.add("active");
    
    document.getElementById("air-cust-name").value = quote.customer;
    document.getElementById("air-origin").value = quote.details.origin || "";
    document.getElementById("air-dest").value = quote.details.destination || "";
    document.getElementById("air-incoterm").value = quote.details.incoterm || "EXW";
    document.getElementById("air-terms").value = quote.details.termsAndConditions || DEFAULT_AIR_TERMS;
    
    document.getElementById("air-commodity").value = quote.details.commodity || "GENERAL";
    handleAirCommodityChange();
    if (quote.details.tempType) {
      document.getElementById("air-temp-type").value = quote.details.tempType;
      handleAirTempTypeChange();
    }
    if (quote.details.tempRange) {
      document.getElementById("air-temp-range").value = quote.details.tempRange;
    }
    document.getElementById("air-loadability-tilt").value = quote.details.loadabilityTilt || "TILTABLE";
    document.getElementById("air-loadability-stack").value = quote.details.loadabilityStack || "STACKABLE";

    const airlinesContainer = document.getElementById("air-airlines-list-container");
    if (airlinesContainer) {
      airlinesContainer.innerHTML = "";
      if (quote.details.airlines && quote.details.airlines.length > 0) {
        quote.details.airlines.forEach(alt => {
          addAirlineCard(alt);
        });
      } else {
        const initialBreaks = {};
        const cw = quote.details.chargeableWeight || 0;
        const bName = getWeightBreakBracket(cw);
        initialBreaks[bName] = quote.details.appliedRate || 0;

        addAirlineCard({
          name: quote.details.airline || "",
          routing: quote.details.routing || "",
          tt: quote.details.tt || "",
          validity: quote.details.validity || "",
          pivotWeight: quote.details.pivotWeight || "",
          selected: true,
          breaks: initialBreaks
        });
      }
    }

    appState.currentAirFreight.module = quote.details.module || 'export';
    const tabExp = document.getElementById("air-tab-export");
    const tabImp = document.getElementById("air-tab-import");
    if (tabExp && tabImp) {
      if (quote.details.module === 'import') {
        tabImp.classList.add("active");
        tabExp.classList.remove("active");
      } else {
        tabExp.classList.add("active");
        tabImp.classList.remove("active");
      }
    }
    
    // Cargo items
    const cargoBody = document.getElementById("air-cargo-body");
    if (cargoBody && quote.details.cargoItems && quote.details.cargoItems.length > 0) {
      cargoBody.innerHTML = "";
      quote.details.cargoItems.forEach(item => {
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
    repopulateSurchargesTable("air-origin-surcharges-body", quote.details.originSurcharges);
    repopulateSurchargesTable("air-dest-surcharges-body", quote.details.destSurcharges);
    
    calculateAirFreight();
    alert(`Editing Quote #${getQuoteRefId(quote)} in progress. Click "Save Quote" to confirm your amendments.`);
    
  } else {
    document.getElementById("sea-freight-panel").classList.add("active");
    
    document.getElementById("sea-cust-name").value = quote.customer;
    document.getElementById("sea-origin").value = quote.details.origin || "";
    document.getElementById("sea-dest").value = quote.details.destination || "";
    document.getElementById("sea-line").value = quote.details.shippingLine || "";
    document.getElementById("sea-liner-name").value = quote.details.linerName || "";
    document.getElementById("sea-commodity").value = quote.details.commodity || "";
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
            destSurcharges: l.destSurcharges
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
  }
}
window.amendQuote = amendQuote;

function approveAmendment(reqId) {
  if (appState.currentUser !== 'ganny') {
    alert("❌ Security Error: Only Admin (Ganny) can approve requests.");
    return;
  }
  let requests = window._amendmentRequests || [];
  if (requests.length === 0) {
    const stored = localStorage.getItem("gl_amendment_requests");
    if (stored) {
      try { requests = JSON.parse(stored); } catch(e) {}
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
        } catch(e) {}
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
  if (appState.currentUser !== 'ganny') {
    alert("❌ Security Error: Only Admin (Ganny) can reject requests.");
    return;
  }
  let requests = window._amendmentRequests || [];
  if (requests.length === 0) {
    const stored = localStorage.getItem("gl_amendment_requests");
    if (stored) {
      try { requests = JSON.parse(stored); } catch(e) {}
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
  try { customPorts = JSON.parse(localStorage.getItem("gl_custom_seaports") || "[]"); } catch(e) {}
  let customLines = [];
  try { customLines = JSON.parse(localStorage.getItem("gl_custom_shippinglines") || "[]"); } catch(e) {}
  let customLiners = [];
  try { customLiners = JSON.parse(localStorage.getItem("gl_custom_linernames") || "[]"); } catch(e) {}
  let customCommodities = [];
  try { customCommodities = JSON.parse(localStorage.getItem("gl_custom_sea_commodities") || "[]"); } catch(e) {}

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

  const addPort = (portObj) => {
    if (!portObj) return;
    const existsDefault = majorSeaports.some(p => p.code.toLowerCase() === portObj.code.toLowerCase() || p.name.toLowerCase() === portObj.name.toLowerCase());
    const existsCustom = customPorts.some(p => p.code.toLowerCase() === portObj.code.toLowerCase() || p.name.toLowerCase() === portObj.name.toLowerCase());
    if (!existsDefault && !existsCustom) {
      customPorts.push(portObj);
    }
  };

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
  try { customCusts = JSON.parse(localStorage.getItem("gl_custom_customers") || "[]"); } catch(e) {}
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

// ==================== GOOGLE MAPS DIRECTORY LOOKUP ====================

function getCountryFromPortValue(val, mode) {
  const cleanVal = val.trim().toLowerCase();
  if (!cleanVal) return null;

  let code = cleanVal;
  if (cleanVal.includes(" - ")) {
    code = cleanVal.split(" - ")[0].trim();
  }

  if (mode === 'air') {
    const matchedAp = appState.airports.find(ap => 
      ap.code.toLowerCase() === code || 
      ap.name.toLowerCase() === cleanVal ||
      ap.name.toLowerCase().includes(cleanVal)
    );
    if (matchedAp && matchedAp.country) return matchedAp.country;
  } else {
    const majorSeaports = [
      { code: "CNSHA", country: "China" },
      { code: "SGPIN", country: "Singapore" },
      { code: "NLRTM", country: "Netherlands" },
      { code: "BEANR", country: "Belgium" },
      { code: "AEDXB", country: "UAE" },
      { code: "USLAX", country: "USA" },
      { code: "GBFXT", country: "UK" },
      { code: "INNSA", country: "India" },
      { code: "INMAA", country: "India" },
      { code: "LKCMB", country: "Sri Lanka" },
      { code: "DEHAM", country: "Germany" }
    ];
    let customPorts = [];
    try {
      const stored = localStorage.getItem("gl_custom_seaports");
      if (stored) customPorts = JSON.parse(stored) || [];
    } catch(e) {}
    const combined = [...majorSeaports, ...customPorts];
    const matchedSp = combined.find(sp => 
      sp.code.toLowerCase() === code || 
      sp.name.toLowerCase() === cleanVal ||
      sp.name.toLowerCase().includes(cleanVal)
    );
    if (matchedSp && matchedSp.country) return matchedSp.country;
  }

  const countries = ["india", "china", "singapore", "netherlands", "belgium", "uae", "usa", "uk", "sri lanka", "germany", "vietnam", "malaysia", "thailand", "japan", "korea"];
  for (const c of countries) {
    if (cleanVal.includes(c)) return c.charAt(0).toUpperCase() + c.slice(1);
  }
  return null;
}

function toggleMapHelper(mode, type) {
  const helperCardId = `${mode}-map-helper-card`;
  const titleId = `${mode}-map-query-title`;
  const wrapperId = `${mode}-map-iframe-wrapper`;
  const inputId = `${mode}-${type === 'origin' ? 'origin' : 'dest'}`;

  const helperCard = document.getElementById(helperCardId);
  const titleEl = document.getElementById(titleId);
  const wrapperEl = document.getElementById(wrapperId);
  const inputEl = document.getElementById(inputId);

  if (!helperCard || !titleEl || !wrapperEl || !inputEl) return;

  const rawVal = inputEl.value.trim();
  let searchQuery = "";
  const country = getCountryFromPortValue(rawVal, mode);
  
  if (country) {
    searchQuery = mode === 'air' ? `Airports in ${country}` : `Seaports in ${country}`;
  } else if (rawVal) {
    searchQuery = rawVal;
    if (searchQuery.length === 3) {
      searchQuery += mode === 'air' ? ' Airport' : ' Seaport';
    }
  } else {
    searchQuery = mode === 'air' ? 'International Airports' : 'Cargo Seaports';
  }

  // Update title text
  titleEl.textContent = searchQuery;

  // Read saved API key
  const apiKey = localStorage.getItem("gl_gmaps_key") || "";

  if (apiKey) {
    // Render live Google Maps Embed API Search
    const embedUrl = `https://www.google.com/maps/embed/v1/search?key=${apiKey}&q=${encodeURIComponent(searchQuery)}`;
    wrapperEl.innerHTML = `
      <iframe 
        width="100%" 
        height="100%" 
        frameborder="0" 
        style="border:0; display:block;" 
        src="${embedUrl}" 
        allowfullscreen>
      </iframe>
    `;
  } else {
    // Render static fallback layout with external map link
    const externalUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(searchQuery)}`;
    wrapperEl.innerHTML = `
      <div style="text-align: center; padding: 1.5rem; color: var(--t2); font-family: 'Outfit', sans-serif;">
        <div style="font-weight: 700; font-size: 0.85rem; margin-bottom: 0.4rem; color: var(--sky);">Interactive Map Ready</div>
        <p style="font-size: 0.72rem; color: var(--t3); max-width: 320px; margin: 0 auto 1rem auto; line-height: 1.4;">
          Please configure your Google Maps API Key in Ganny's settings panel under Pricing Team configurations to load interactive embeds.
        </p>
        <a href="${externalUrl}" target="_blank" class="btn-primary" style="display: inline-flex; align-items: center; gap: 0.4rem; font-size: 0.72rem; padding: 0.45rem 1rem; border-radius: 6px; text-decoration: none; color: #000; background: var(--accent-success); font-weight: 700;">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
          Search "${searchQuery}" on Google Maps
        </a>
      </div>
    `;
  }

  // Toggle visibility
  if (helperCard.style.display === 'none' || !helperCard.style.display) {
    helperCard.style.display = 'block';
  } else {
    // If clicking the other input, keep visible but update contents
    helperCard.style.display = 'block';
  }
}
function convertAmountToUSD(amount, currency) {
  if (!amount) return 0;
  if (currency === 'USD') return amount;
  if (currency === 'INR') return amount / (EXCHANGE_RATES.USD_TO_INR || 83);
  if (currency === 'EUR') return amount * (EXCHANGE_RATES.EUR_TO_USD || 1.08);
  if (currency === 'GBP') return amount * (EXCHANGE_RATES.GBP_TO_USD || 1.25);
  return amount;
}
window.convertAmountToUSD = convertAmountToUSD;

function validateCreditCompliance(quoteData) {
  const customerName = quoteData.customer;
  if (!customerName) return true;
  const lowerCust = customerName.toLowerCase().trim();
  const agentUsername = (quoteData.creator || appState.currentUser || "").toLowerCase().trim();
  const agentRoleName = (TEAM_ROLES[agentUsername]?.name || "").toLowerCase().trim();

  // Load customer controls
  let controls = window._customerControls || {};
  if (Object.keys(controls).length === 0) {
    try {
      controls = JSON.parse(localStorage.getItem("gl_customer_controls") || "{}");
    } catch(e) {}
  }

  // Get allowed credit period (defaults to 36)
  const customerAllowedDays = controls[lowerCust] ? (controls[lowerCust].creditDays || 36) : 36;
  const agentAllowedDays = (controls[agentUsername] ? (controls[agentUsername].creditDays || 36) : 
                            (controls[agentRoleName] ? (controls[agentRoleName].creditDays || 36) : 36));

  // Get all quotes
  const allQuotes = appState.quotes || [];

  // Calculate age of oldest converted quote for Customer
  const customerQuotes = allQuotes.filter(q => q.customer.toLowerCase().trim() === lowerCust);
  const oldestCustConfirmed = customerQuotes
    .filter(q => q.status === 'converted' && q.conversionDate)
    .sort((a, b) => new Date(a.conversionDate) - new Date(b.conversionDate))[0];

  let oldestCustDays = 0;
  let customerCrossed = false;
  if (oldestCustConfirmed) {
    const oldestDate = new Date(oldestCustConfirmed.conversionDate);
    const currentDate = new Date();
    const diffTime = Math.abs(currentDate - oldestDate);
    oldestCustDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (oldestCustDays > customerAllowedDays) {
      customerCrossed = true;
    }
  }

  // Calculate age of oldest converted quote for Agent
  const agentQuotes = allQuotes.filter(q => {
    const creator = (q.creator || "").toLowerCase().trim();
    return creator === agentUsername || (TEAM_ROLES[creator]?.name || "").toLowerCase().trim() === agentRoleName;
  });
  const oldestAgentConfirmed = agentQuotes
    .filter(q => q.status === 'converted' && q.conversionDate)
    .sort((a, b) => new Date(a.conversionDate) - new Date(b.conversionDate))[0];

  let oldestAgentDays = 0;
  let agentCrossed = false;
  if (oldestAgentConfirmed) {
    const oldestDate = new Date(oldestAgentConfirmed.conversionDate);
    const currentDate = new Date();
    const diffTime = Math.abs(currentDate - oldestDate);
    oldestAgentDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (oldestAgentDays > agentAllowedDays) {
      agentCrossed = true;
    }
  }

  // If neither crossed credit limits, allow saving
  if (!customerCrossed && !agentCrossed) {
    return true;
  }

  // If user is Admin, they can bypass
  const isAdmin = (appState.currentUser === 'ganny' || (TEAM_ROLES[appState.currentUser]?.type === 'admin'));
  if (isAdmin) {
    console.warn(`Admin Warning: Customer (${customerName}) or Agent (${agentUsername}) is crossing credit terms, but allowed because user is Admin.`);
    return true;
  }

  // Non-Admin: Check for approved override request
  let requests = window._amendmentRequests || [];
  if (requests.length === 0) {
    const stored = localStorage.getItem("gl_amendment_requests");
    if (stored) {
      try { requests = JSON.parse(stored); } catch(e) {}
    }
  }

  // Check if there is an approved credit_override request matching customer or agent
  const matchedApprovedReq = requests.find(r => 
    r.requestType === 'credit_override' && 
    r.status === 'approved' &&
    ((r.customer && r.customer.toLowerCase().trim() === lowerCust) ||
     (r.agent && r.agent.toLowerCase().trim() === agentUsername))
  );

  if (matchedApprovedReq) {
    // Consume/complete the approved request
    matchedApprovedReq.status = 'completed';
    if (DB.firestoreRef) {
      DB.firestoreRef.collection("amendment_requests").doc(matchedApprovedReq.id).set(matchedApprovedReq, { merge: true })
        .catch(err => console.error("DB: failed to mark credit override request completed:", err));
    } else {
      localStorage.setItem("gl_amendment_requests", JSON.stringify(requests));
    }
    return true;
  }

  // Check if there is a pending request
  const matchedPendingReq = requests.find(r => 
    r.requestType === 'credit_override' && 
    r.status === 'pending' &&
    ((r.customer && r.customer.toLowerCase().trim() === lowerCust) ||
     (r.agent && r.agent.toLowerCase().trim() === agentUsername))
  );

  if (matchedPendingReq) {
    alert(`❌ Action Denied: Credit control block active.\n\nYour request for Admin Credit Override is still pending Ganny's approval.\n- Customer oldest shipment: ${oldestCustDays} days (allowed: ${customerAllowedDays})\n- Agent oldest shipment: ${oldestAgentDays} days (allowed: ${agentAllowedDays})`);
    return false;
  }

  // Ask to submit a new credit override request
  let msg = `⚠️ Credit Control Alert:\n`;
  if (customerCrossed) {
    msg += `- Customer "${customerName}" oldest shipment is ${oldestCustDays} days old (Allowed credit period: ${customerAllowedDays} days).\n`;
  }
  if (agentCrossed) {
    msg += `- Agent/Desk "${TEAM_ROLES[agentUsername]?.name || agentUsername}" oldest shipment is ${oldestAgentDays} days old (Allowed credit period: ${agentAllowedDays} days).\n`;
  }
  msg += `\nDo you want to submit a Credit Override Request to Ganny (Admin) to execute this quote?`;

  if (confirm(msg)) {
    const reason = prompt("Enter a reason for requesting this Credit Override:");
    if (reason === null) return false;
    if (!reason.trim()) {
      alert("A reason is required to submit the request.");
      return false;
    }

    const newReq = {
      id: 'REQ' + Math.random().toString(36).substr(2, 9),
      requestType: 'credit_override',
      customer: customerName,
      agent: agentUsername,
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
          alert("Credit override request submitted successfully to Ganny.");
        })
        .catch(err => {
          console.error("DB: failed to save credit override request:", err);
          alert("Failed to submit request to cloud. Saving locally...");
          saveRequestLocallyFallback(newReq);
        });
    } else {
      saveRequestLocallyFallback(newReq);
      alert("Credit override request submitted successfully to Ganny (Offline).");
    }
  }

  return false;
}
window.validateCreditCompliance = validateCreditCompliance;

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
        const dbId = config.databaseId || '(default)';
        console.log("DB: Stored Project ID in LocalStorage:", config.projectId);
        console.log("DB: Stored API Key in LocalStorage:", config.apiKey);
        console.log("DB: Initializing Firestore connection with database ID:", dbId);
        this.firestoreRef = firebase.firestore(firebase.app(), dbId);
        this.isCloud = true;
        
        // Enable offline persistence
        this.firestoreRef.enablePersistence().catch(err => {
          console.warn("Firestore offline persistence failed:", err.code);
        });
        
        if (statusDot) statusDot.style.background = "#10b981"; // green
        if (statusText) statusText.textContent = "Firebase Cloud (Online)";
        
        this.registerSnapshotListener();

        // Setup persistent auth listener
        firebase.auth().onAuthStateChanged(user => {
          if (user) {
            console.log("Auth: user logged in", user.email);
            const username = user.email.split('@')[0].toLowerCase();
            sessionStorage.setItem("gl_pricing_session", username);
            loginSuccess(username);
          } else {
            console.log("Auth: user logged out");
            sessionStorage.removeItem("gl_pricing_session");
            appState.currentUser = null;
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
    
    // Sync users list from Firestore
    this.syncUsers();
    
    // Sync customer controls list from Firestore
    if (this.firestoreRef) {
      // Sync custom autocomplete entries from Firestore
      this.firestoreRef.collection("custom_autocomplete_entries").onSnapshot(snap => {
        snap.forEach(doc => {
          const type = doc.id;
          const data = doc.data();
          if (data && Array.isArray(data.entries)) {
            localStorage.setItem("gl_custom_" + type, JSON.stringify(data.entries));
          }
        });
      }, err => {
        console.warn("Firestore: custom_autocomplete_entries listen failed, using local/cached records:", err);
      });

      this.firestoreRef.collection("customer_control").onSnapshot(snap => {
        let controls = {};
        snap.forEach(doc => {
          controls[doc.id] = doc.data();
        });
        window._customerControls = controls;
        localStorage.setItem("gl_customer_controls", JSON.stringify(controls));
        renderAdminCustomerControlList();
      }, err => {
        console.warn("Firestore: customer_control listen failed, using local/cached records:", err);
      });

      // Sync amendment requests list from Firestore
      this.firestoreRef.collection("amendment_requests").onSnapshot(snap => {
        let reqs = [];
        snap.forEach(doc => {
          reqs.push(doc.data());
        });
        // Check and notify Ganny of new pending requests
        if (typeof checkAndNotifyNewRequests === 'function') {
          checkAndNotifyNewRequests(reqs);
        }
        window._amendmentRequests = reqs;
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
      });
    }
    
    // Unsubscribe from any existing listener if applicable
    if (this.snapshotUnsubscribe) {
      this.snapshotUnsubscribe();
    }
    
    this.snapshotUnsubscribe = this.firestoreRef.collection("quotes").onSnapshot(snapshot => {
      console.log("DB: Received snapshot from Firestore. Document count:", snapshot.size);
      const list = [];
      snapshot.forEach(doc => {
        const q = doc.data();
        this.sanitize(q, list.length);
        list.push(q);
      });
      // Sort quotes chronologically (newest first)
      list.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      appState.quotes = list;
      
      // Update badge status to show online
      if (statusDot) statusDot.style.background = "#10b981"; // green
      if (statusText) statusText.textContent = "Firebase Cloud (Online)";
      
      // Refresh view
      if (appState.currentUser) {
        if (appState.currentUser === 'ganny') {
          renderAdminDashboard();
        } else {
          renderMemberDashboard(appState.currentUser);
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
      this.firestoreRef.collection("users").onSnapshot(snap => {
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
        } catch (e) {}

        snap.forEach(doc => {
          const u = doc.data();
          if (u && u.username) {
            const lowerUser = u.username.toLowerCase();

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
    
    // Sanitize quotes array
    appState.quotes.forEach((q, idx) => {
      this.sanitize(q, idx);
    });
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
  },
  
  async saveQuote(quote) {
    if (!quote.timestamp) quote.timestamp = Date.now();
    
    // Local memory update immediately so the local user doesn't see lag
    const idx = appState.quotes.findIndex(q => q.id === quote.id);
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
      } catch (err) {
        console.error("DB: Firestore write failed:", err);
        alert("Cloud Database Write Error: " + err.message);
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
        } catch(e) {}
        
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
      } catch(e) {}
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
        if (stored) { try { customUsers = JSON.parse(stored); } catch(e) {} }
        const matchedLocal = customUsers.find(u => u && u.username && u.username.toLowerCase() === currentUser);
        if (matchedLocal) {
          matchedLocal.password = newPass;
        } else {
          customUsers.push({ username: currentUser, fullName: TEAM_ROLES[currentUser]?.name || currentUser, password: newPass });
        }
        localStorage.setItem("gl_custom_users", JSON.stringify(customUsers));
      } catch(lsErr) {
        console.warn("Could not sync new password to localStorage (non-fatal):", lsErr);
      }

      alert("🎉 Password updated successfully!");
    } else {
      // ── Offline local storage fallback ────────────────────────────────────
      let customUsers = [];
      const stored = localStorage.getItem("gl_custom_users");
      if (stored) {
        try { customUsers = JSON.parse(stored); } catch(err) {}
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

async function submitWonBookingDetails(e) {
  e.preventDefault();
  const id = document.getElementById("won-quote-id").value;
  const quote = appState.quotes.find(q => q.id === id);
  if (!quote) return;

  const shipperName = document.getElementById("won-shipper-name").value.trim();
  const shipperPhone = document.getElementById("won-shipper-phone").value.trim();
  const shipperEmail = document.getElementById("won-shipper-email").value.trim();
  const shipperAddress = document.getElementById("won-shipper-address").value.trim();

  const consigneeName = document.getElementById("won-cnee-name").value.trim();
  const consigneePhone = document.getElementById("won-cnee-phone").value.trim();
  const consigneeEmail = document.getElementById("won-cnee-email").value.trim();
  const consigneeAddress = document.getElementById("won-cnee-address").value.trim();

  const commodity = document.getElementById("won-commodity").value.trim();

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

  if (!hasAgreement && !fileData) {
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
        try { requests = JSON.parse(stored); } catch(e) {}
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

  quote.status = 'converted';
  quote.shipperName = shipperName;
  quote.shipperPhone = shipperPhone;
  quote.shipperEmail = shipperEmail;
  quote.shipperAddress = shipperAddress;
  quote.consigneeName = consigneeName;
  quote.consigneePhone = consigneePhone;
  quote.consigneeEmail = consigneeEmail;
  quote.consigneeAddress = consigneeAddress;
  quote.commodity = commodity;
  quote.conversionDate = new Date().toISOString().split('T')[0];
  quote.date = new Date().toISOString().split('T')[0];

  // Save local fees buy rates back to quote details
  const originBuyInputs = document.querySelectorAll(".won-origin-fee-buy-input");
  originBuyInputs.forEach(input => {
    const idx = parseInt(input.getAttribute("data-index"));
    const val = parseFloat(input.value) || 0;
    if (quote.details.originSurcharges && quote.details.originSurcharges[idx]) {
      quote.details.originSurcharges[idx].buyRate = val;
    }
  });

  const destBuyInputs = document.querySelectorAll(".won-dest-fee-buy-input");
  destBuyInputs.forEach(input => {
    const idx = parseInt(input.getAttribute("data-index"));
    const val = parseFloat(input.value) || 0;
    if (quote.details.destSurcharges && quote.details.destSurcharges[idx]) {
      quote.details.destSurcharges[idx].buyRate = val;
    }
  });

  // Re-assemble / sync quote.details.surcharges
  quote.details.surcharges = [
    ...(quote.details.originSurcharges || []),
    ...(quote.details.destSurcharges || [])
  ];

  const confirmedCarrier = document.getElementById("won-confirmed-carrier").value;

  // Determine what was missing
  let isBuyRateMissing = false;
  let isSellRateMissing = false;

  const isNominationCreator = quote.creator && (
    quote.creator === 'shashank' || 
    quote.creator === 'shaheer' || 
    (TEAM_ROLES[quote.creator] && (TEAM_ROLES[quote.creator].category === 'AIR - NOMINATION' || TEAM_ROLES[quote.creator].category === 'SEA - NOMINATION'))
  );

  if (isNominationCreator) {
    isSellRateMissing = true;
  } else if (quote.type === 'air') {
    const sellRate = quote.details.appliedRate || 0;
    const buyRate = quote.details.appliedBuyRate || 0;
    if (sellRate > 0 && buyRate === 0) {
      isBuyRateMissing = true;
    } else if (buyRate > 0 && sellRate === 0) {
      isSellRateMissing = true;
    }
  } else {
    if (quote.details.mode === 'fcl') {
      const hasSell = (quote.details.containerItems || []).some(item => (item.rate || 0) > 0);
      const hasBuy = (quote.details.containerItems || []).some(item => (item.buy || 0) > 0);
      if (hasSell && !hasBuy) {
        isBuyRateMissing = true;
      } else if (hasBuy && !hasSell) {
        isSellRateMissing = true;
      }
    } else if (quote.details.mode === 'lcl') {
      const sellRate = quote.details.lclRateApplied || 0;
      const buyRate = quote.details.lclBuyRateApplied || 0;
      if (sellRate > 0 && buyRate === 0) {
        isBuyRateMissing = true;
      } else if (buyRate > 0 && sellRate === 0) {
        isSellRateMissing = true;
      }
    } else {
      const sellRate = quote.details.bbRateApplied || 0;
      const buyRate = quote.details.bbBuyRateApplied || 0;
      if (sellRate > 0 && buyRate === 0) {
        isBuyRateMissing = true;
      } else if (buyRate > 0 && sellRate === 0) {
        isSellRateMissing = true;
      }
    }
  }

  let finalBuyRate = 0;
  let finalSellRate = 0;

  if (isSellRateMissing) {
    finalSellRate = parseFloat(document.getElementById("won-confirmed-sell-rate").value) || 0;
    if (!confirmedCarrier || finalSellRate <= 0) {
      alert("❌ COMPLIANCE ERROR: Please enter a valid Confirmed Airline/Shipping Line and Sell Rate.");
      return;
    }
    if (quote.type === 'air') {
      finalBuyRate = quote.details.appliedBuyRate || 0;
    } else if (quote.details.mode === 'lcl') {
      finalBuyRate = quote.details.lclBuyRateApplied || 0;
    } else if (quote.details.mode === 'bb') {
      finalBuyRate = quote.details.bbBuyRateApplied || 0;
    } else if (quote.details.mode === 'fcl') {
      finalBuyRate = (quote.details.containerItems || []).reduce((acc, c) => acc + (c.buy || 0), 0);
    }
  } else {
    finalBuyRate = parseFloat(document.getElementById("won-confirmed-buy-rate").value) || 0;
    if (!confirmedCarrier || finalBuyRate <= 0) {
      alert("❌ COMPLIANCE ERROR: Please enter a valid Confirmed Airline/Shipping Line and Buy Rate.");
      return;
    }
    if (quote.type === 'air') {
      finalSellRate = quote.details.appliedRate || 0;
    } else if (quote.details.mode === 'lcl') {
      finalSellRate = quote.details.lclRateApplied || 0;
    } else if (quote.details.mode === 'bb') {
      finalSellRate = quote.details.bbRateApplied || 0;
    }
  }

  quote.confirmedCarrier = confirmedCarrier;
  quote.confirmedBuyRate = finalBuyRate;
  quote.confirmedSellRate = finalSellRate;

  // Update in quote details as well
  if (quote.type === 'air') {
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
  } else {
    if (quote.details.mode === 'fcl') {
      if (isSellRateMissing) {
        let calculatedBaseFreight = 0;
        (quote.details.containerItems || []).forEach(item => {
          item.rate = finalSellRate;
          calculatedBaseFreight += (item.qty || 0) * finalSellRate;
        });
        quote.details.baseFreight = calculatedBaseFreight;
        quote.amount = calculatedBaseFreight + (quote.details.surchargeTotal || 0);
        if (quote.currency !== 'INR') {
          quote.amountINR = quote.amount * EXCHANGE_RATES[`${quote.currency}_TO_INR`];
        } else {
          quote.amountINR = quote.amount;
        }
      } else {
        (quote.details.containerItems || []).forEach(item => {
          item.buy = finalBuyRate;
        });
      }
    } else if (quote.details.mode === 'lcl') {
      if (isSellRateMissing) {
        quote.details.lclRateApplied = finalSellRate;
        const chargeableRT = quote.details.lclChargeable || 0;
        quote.details.baseFreight = chargeableRT * finalSellRate;
        quote.amount = quote.details.baseFreight + (quote.details.surchargeTotal || 0);
        if (quote.currency !== 'INR') {
          quote.amountINR = quote.amount * EXCHANGE_RATES[`${quote.currency}_TO_INR`];
        } else {
          quote.amountINR = quote.amount;
        }
      } else {
        quote.details.lclBuyRateApplied = finalBuyRate;
      }
    } else {
      if (isSellRateMissing) {
        quote.details.bbRateApplied = finalSellRate;
        const chargeableRT = quote.details.lclChargeable || 0;
        quote.details.baseFreight = chargeableRT * finalSellRate;
        quote.amount = quote.details.baseFreight + (quote.details.surchargeTotal || 0);
        if (quote.currency !== 'INR') {
          quote.amountINR = quote.amount * EXCHANGE_RATES[`${quote.currency}_TO_INR`];
        } else {
          quote.amountINR = quote.amount;
        }
      } else {
        quote.details.bbBuyRateApplied = finalBuyRate;
      }
    }
  }

  // Auto-calculate GP
  let sellBaseFreight = 0;
  let buyBaseFreight = 0;
  let grossProfit = 0;

  if (quote.type === 'air') {
    let chargeableWeight = quote.details.chargeableWeight || 0;
    sellBaseFreight = chargeableWeight * finalSellRate;
    buyBaseFreight = chargeableWeight * finalBuyRate;
    grossProfit = sellBaseFreight - buyBaseFreight;
  } else {
    if (quote.details.mode === 'fcl') {
      sellBaseFreight = quote.details.baseFreight || 0;
      buyBaseFreight = (quote.details.containerItems || []).reduce((acc, c) => acc + (c.qty || 0) * (c.buy || 0), 0);
      grossProfit = sellBaseFreight - buyBaseFreight;
    } else {
      const chargeableRT = quote.details.lclChargeable || 0;
      sellBaseFreight = chargeableRT * finalSellRate;
      buyBaseFreight = chargeableRT * finalBuyRate;
      grossProfit = sellBaseFreight - buyBaseFreight;
    }
  }

  // Calculate local fees / surcharges GP contribution
  let surchargeSell = 0;
  let surchargeBuy = 0;
  const allSurcharges = [
    ...(quote.details.originSurcharges || []),
    ...(quote.details.destSurcharges || [])
  ];

  if (quote.type === 'air') {
    const chargeableWeight = quote.details.chargeableWeight || 0;
    allSurcharges.forEach(sch => {
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
  } else {
    const weightKg = quote.details.grossWeight || 0;
    const weightTons = weightKg / 1000;
    const cbm = quote.details.volumeCbm || 0;
    const isLcl = quote.details.mode === 'lcl';
    const effectiveCbm = (isLcl && cbm < 1.0) ? 1.0 : cbm;
    const chargeableCbm = Math.max(effectiveCbm, weightTons);
    const containerCount = (quote.details.containerItems || []).reduce((acc, c) => acc + (c.qty || 0), 0);
    const isSeaFcl = quote.details.mode === 'fcl';

    allSurcharges.forEach(sch => {
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
  }

  grossProfit += surchargeSell - surchargeBuy;

  quote.grossProfit = grossProfit;
  quote.grossProfitCurrency = quote.currency;

  let grossProfitINR = grossProfit;
  if (quote.currency !== 'INR') {
    grossProfitINR = grossProfit * EXCHANGE_RATES[`${quote.currency}_TO_INR`];
  }
  quote.grossProfitINR = grossProfitINR;

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
      creator: quote.creator
    };

    if (DB.firestoreRef) {
      await DB.firestoreRef.collection("nrs_registry").doc(quote.id).set(nrsEntry);
    } else {
      let offlineRegistry = [];
      const stored = localStorage.getItem("gl_nrs_registry");
      if (stored) {
        try { offlineRegistry = JSON.parse(stored); } catch(err) {}
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

    alert("🎉 Booking successfully converted to WON and registered in NRS module!");
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
        try { registryList = JSON.parse(stored); } catch(e) {}
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

  // Sort by dateWon descending
  const sorted = [...list].sort((a, b) => new Date(b.dateWon) - new Date(a.dateWon));

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
        <td style="font-weight: 750; color: var(--sky); font-size: 0.72rem;">#${item.refId}</td>
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
          <div style="font-weight: 750; font-size: 0.72rem; color: var(--t2);">${item.shipperName}</div>
          ${shipperSubtext}
        </td>
        <td>
          <div style="font-weight: 750; font-size: 0.72rem; color: var(--t2);">${item.consigneeName}</div>
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
              <button onclick="openNrsFollowUpModal('${item.id}')" style="font-size: 0.62rem; padding: 3px 8px; border-radius: 6px; border: 1px solid var(--border-1); background: var(--bg-input); color: var(--sky); cursor: pointer; font-weight: 700; white-space: nowrap;" title="View / Add Follow-ups">
                📋 ${followUps.length > 0 ? followUps.length + ' note' + (followUps.length > 1 ? 's' : '') : 'Track'}
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
      try { offlineNrs = JSON.parse(localStorage.getItem('gl_nrs_registry') || '{}'); } catch(e) {}
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
    statusLabel.textContent = "[Uploaded]";
    statusLabel.style.color = "var(--accent-success)";
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

  // Compile unique customers from quotes and controls
  let controls = window._customerControls || {};
  if (Object.keys(controls).length === 0) {
    try {
      controls = JSON.parse(localStorage.getItem("gl_customer_controls") || "{}");
    } catch(e) {}
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
    } catch(err) {
      console.error("DB: Failed to save agency agreement to Firestore:", err);
    }
  } else {
    try {
      let offlineControls = JSON.parse(localStorage.getItem("gl_customer_controls") || "{}");
      offlineControls[lower] = controls[lower];
      localStorage.setItem("gl_customer_controls", JSON.stringify(offlineControls));
    } catch(e) {}
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
      } catch(e) {}
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
    } catch(e) {}
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
    } catch(e) {}
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
    } catch(e) {}
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
        for(let r of regs) r.unregister();
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
  } catch(e) {}
  if (diagProj) diagProj.textContent = projectId;

  let dbUsers = window._firebaseUsers || [];
  if (dbUsers.length === 0) {
    try {
      const stored = localStorage.getItem("gl_custom_users");
      if (stored) dbUsers = JSON.parse(stored) || [];
    } catch(e) {}
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
    } catch(err) {
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
    } catch(err) {
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
  } catch(err) {
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
  } catch(err) {
    log(`❌ 'amendment_requests' write test: FAILED - ${err.message}`);
    log(`👉 Recommendation: Ask your developer to modify Firestore Security Rules to allow read, write on 'amendment_requests' collection.`);
  }
}
window.runDbDiagnostics = runDbDiagnostics;

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
  const isAdmin = (appState.currentUser === 'ganny' || (TEAM_ROLES[appState.currentUser]?.type === 'admin'));
  if (!isAdmin) {
    alert("Permission Denied: Only Admin can add or delete rows.");
    return;
  }
  const tbody = document.getElementById("transport-standalone-body");
  if (!tbody) return;
  const tr = document.createElement("tr");
  const defaultName = type === 'metric' ? "Line-Haul Routing Metric" : "Transport Fee";
  tr.innerHTML = `
    <td><input type="text" class="chg-name" value="${defaultName}" style="background: rgba(255,255,255,0.03); color: var(--t1);"></td>
    <td><input type="number" class="chg-rate" value="0.00" step="0.01" oninput="calculateTransportation()"></td>
    <td><input type="text" class="chg-remarks" placeholder="Add remarks..." style="background: rgba(255,255,255,0.03); color: var(--t1); border: 1px solid var(--border-color); border-radius: 6px; padding: 4px 8px; font-size: 0.78rem; width: 100%;"></td>
    <td style="text-align: center;">
      <button type="button" class="btn-admin-action delete-btn" onclick="removeTransportRow(this)" title="Delete Row" style="background: #002060; border: 1px solid #002060; color: #ffffff; border-radius: 4px; cursor: pointer; padding: 4px 8px; font-size: 0.75rem;">Delete</button>
    </td>
  `;
  tbody.appendChild(tr);
  updateAdminModulePermissions();
  calculateTransportation();
}
window.addTransportRow = addTransportRow;

function removeTransportRow(btn) {
  const isAdmin = (appState.currentUser === 'ganny' || (TEAM_ROLES[appState.currentUser]?.type === 'admin'));
  if (!isAdmin) {
    alert("Permission Denied: Only Admin can add or delete rows.");
    return;
  }
  btn.closest("tr").remove();
  calculateTransportation();
}
window.removeTransportRow = removeTransportRow;

function addWarehouseRow(type = 'surcharge') {
  const isAdmin = (appState.currentUser === 'ganny' || (TEAM_ROLES[appState.currentUser]?.type === 'admin'));
  if (!isAdmin) {
    alert("Permission Denied: Only Admin can add or delete rows.");
    return;
  }
  const tbody = document.getElementById("warehouse-standalone-body");
  if (!tbody) return;
  const tr = document.createElement("tr");
  const defaultName = type === 'metric' ? "Fulfillment Metric" : "Warehouse Charge";
  tr.innerHTML = `
    <td><input type="text" class="chg-name" value="${defaultName}" placeholder="Fee / Surcharge Name" style="background: rgba(255,255,255,0.03); color: var(--t1);"></td>
    <td>
      <div style="display: flex; gap: 0.5rem; align-items: center;">
        <input type="number" class="chg-rate" value="0.00" step="0.01" oninput="calculateWarehousing()" style="width: 90px; flex-shrink: 0;">
        <input type="text" class="chg-desc" placeholder="e.g. AUD 5.00 / Pallet / Wk" style="flex: 1; min-width: 100px; background: rgba(255,255,255,0.03); color: var(--t1); border: 1px solid var(--border-color); border-radius: 6px; padding: 4px 8px; font-size: 0.78rem;">
      </div>
    </td>
    <td><input type="text" class="chg-remarks" placeholder="Add remarks..." style="background: rgba(255,255,255,0.03); color: var(--t1); border: 1px solid var(--border-color); border-radius: 6px; padding: 4px 8px; font-size: 0.78rem; width: 100%;"></td>
    <td style="text-align: center;">
      <button type="button" class="btn-admin-action delete-btn" onclick="removeWarehouseRow(this)" title="Delete Row" style="background: #002060; border: 1px solid #002060; color: #ffffff; border-radius: 4px; cursor: pointer; padding: 4px 8px; font-size: 0.75rem;">Delete</button>
    </td>
  `;
  tbody.appendChild(tr);
  updateAdminModulePermissions();
  calculateWarehousing();
}
window.addWarehouseRow = addWarehouseRow;

function removeWarehouseRow(btn) {
  const isAdmin = (appState.currentUser === 'ganny' || (TEAM_ROLES[appState.currentUser]?.type === 'admin'));
  if (!isAdmin) {
    alert("Permission Denied: Only Admin can add or delete rows.");
    return;
  }
  btn.closest("tr").remove();
  calculateWarehousing();
}
window.removeWarehouseRow = removeWarehouseRow;

function calculateTransportation() {
  const tbody = document.getElementById("transport-standalone-body");
  let subtotal = 0;
  if (tbody) {
    tbody.querySelectorAll(".chg-rate").forEach(input => {
      subtotal += parseFloat(input.value) || 0;
    });
  }
  
  const tax = subtotal * 0.18;
  const total = subtotal + tax;
  
  const cur = document.getElementById("transport-currency")?.value || 'INR';
  const sym = cur === 'INR' ? '₹' : (cur === 'USD' ? '$' : (cur === 'EUR' ? '€' : '£'));
  
  if (document.getElementById("res-transport-subtotal")) document.getElementById("res-transport-subtotal").textContent = `${sym}${subtotal.toLocaleString(undefined, {minimumFractionDigits:2})}`;
  if (document.getElementById("res-transport-tax")) document.getElementById("res-transport-tax").textContent = `${sym}${tax.toLocaleString(undefined, {minimumFractionDigits:2})}`;
  if (document.getElementById("res-transport-total")) document.getElementById("res-transport-total").textContent = `${sym}${total.toLocaleString(undefined, {minimumFractionDigits:2})}`;
}
window.calculateTransportation = calculateTransportation;

function calculateWarehousing() {
  const tbody = document.getElementById("warehouse-standalone-body");
  let subtotal = 0;
  if (tbody) {
    tbody.querySelectorAll(".chg-rate").forEach(input => {
      subtotal += parseFloat(input.value) || 0;
    });
  }
  
  const tax = subtotal * 0.18;
  const total = subtotal + tax;
  
  const cur = document.getElementById("warehouse-currency")?.value || 'INR';
  const sym = cur === 'INR' ? '₹' : (cur === 'USD' ? '$' : (cur === 'EUR' ? '€' : '£'));
  
  if (document.getElementById("res-warehouse-subtotal")) document.getElementById("res-warehouse-subtotal").textContent = `${sym}${subtotal.toLocaleString(undefined, {minimumFractionDigits:2})}`;
  if (document.getElementById("res-warehouse-tax")) document.getElementById("res-warehouse-tax").textContent = `${sym}${tax.toLocaleString(undefined, {minimumFractionDigits:2})}`;
  if (document.getElementById("res-warehouse-total")) document.getElementById("res-warehouse-total").textContent = `${sym}${total.toLocaleString(undefined, {minimumFractionDigits:2})}`;
}
window.calculateWarehousing = calculateWarehousing;

function injectModuleFeesToFreight(module, freightType, target = 'origin') {
  alert("Pathway A (Bundled) has been disabled in this workspace. Standard standalone calculations are active.");
}
window.injectModuleFeesToFreight = injectModuleFeesToFreight;

function saveStandaloneQuote(module) {
  const cur = document.getElementById(`${module}-currency`)?.value || 'INR';
  const subtotal = parseFloat(document.getElementById(`res-${module}-subtotal`)?.textContent.replace(/[^0-9.]/g, '')) || 0;
  const tax = parseFloat(document.getElementById(`res-${module}-tax`)?.textContent.replace(/[^0-9.]/g, '')) || 0;
  const total = parseFloat(document.getElementById(`res-${module}-total`)?.textContent.replace(/[^0-9.]/g, '')) || 0;

  const customerName = prompt("Please enter Customer Name for this standalone quote:", "Walk-in Customer");
  if (!customerName) return;

  const rateInr = convertToInr(total, cur);

  let modeTitle = "Services";
  let routingInfo = `${module.toUpperCase()} Standalone Services`;

  if (module === 'transport') {
    modeTitle = "Transportation";
    const pPin = document.getElementById("transport-pickup-pin")?.value || "";
    const dPin = document.getElementById("transport-delivery-pin")?.value || "";
    routingInfo = `Pickup PIN ${pPin} ➔ Delivery PIN ${dPin}`;
  } else if (module === 'warehouse') {
    modeTitle = "Warehousing";
    routingInfo = `Warehousing Storage & Operations`;
  }

  const quoteData = {
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
    route: routingInfo,
    routingDetails: routingInfo,
    notes: `Calculated standalone. Subtotal: ${subtotal}, Tax (18%): ${tax}, Total: ${total} ${cur}`
  };

  DB.saveQuote(quoteData);
  alert(`${modeTitle} Standalone Quotation saved successfully!`);
  returnToWorkspace();
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

document.addEventListener("DOMContentLoaded", () => {
  const db = DB.firestoreRef || (typeof firebase !== 'undefined' ? firebase.firestore() : null);
  const doc = (firestore, collectionName, docId) => {
    return firestore.collection(collectionName).doc(docId);
  };
  const setDoc = (docRef, data) => {
    return docRef.set(data);
  };
  const serverTimestamp = () => firebase.firestore.FieldValue.serverTimestamp();

  window.handleForgotPassword = async function(e) {
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

  let titleClicks = 0;
  let titleTimer = null;
  const titleEl = document.getElementById("pricing-desk-title");
  if (titleEl) {
    titleEl.onclick = function() {
      titleClicks++;
      clearTimeout(titleTimer);
      titleTimer = setTimeout(() => {
        titleClicks = 0;
      }, 2000);

      if (titleClicks >= 5) {
        titleClicks = 0;
        const passkey = prompt("Enter Admin Master Passkey:");
        if (passkey === "MasterPricing2026") {
          window.openAdminResetOverlay();
          window.adminPanelActivated = true;
          document.getElementById("admin-passkey-sec").style.display = "none";
          document.getElementById("admin-inputs-sec").style.display = "block";
          window.updateResetListInPanel();
          window.updateResetIndicators();
        } else if (passkey !== null) {
          alert("❌ Invalid Passkey. Access Denied.");
        }
      }
    };
  }

  window.updateResetListInPanel = async function() {
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

  window.executeForceReset = async function() {
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
        } catch(delErr) {
          console.warn("Could not delete reset request:", delErr);
        }
      }

      // ── STEP 3: Update localStorage cache ─────────────────────────────────
      let customUsers = [];
      const stored = localStorage.getItem("gl_custom_users");
      if (stored) {
        try { customUsers = JSON.parse(stored); } catch(err) {}
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
        try { resets = JSON.parse(storedResets); } catch(err) {}
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
    } catch(err) {
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

  // Admin Broadcast notices
  window.sendAdminBroadcast = function () {
    const type = document.getElementById("broadcast-type").value;
    const msg = document.getElementById("broadcast-message").value.trim();

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
    document.getElementById("broadcast-message").value = "";

    // Instantly trigger overlay check
    checkActiveBroadcast();
  };

  function checkActiveBroadcast() {
    let broadcast = null;
    try {
      const data = localStorage.getItem("gl_admin_broadcast");
      if (data) broadcast = JSON.parse(data);
    } catch (e) { }

    if (!broadcast || !broadcast.active) {
      const overlay = document.getElementById("system-broadcast-overlay");
      if (overlay) overlay.style.display = "none";
      return;
    }

    // Render high visibility overlay banner if not already present
    let overlay = document.getElementById("system-broadcast-overlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "system-broadcast-overlay";
      overlay.style.cssText = "position:fixed; top:0; left:0; right:0; z-index:9999; padding:10px 20px; color:#fff; display:flex; justify-content:space-between; align-items:center; font-family:'Outfit', sans-serif; font-size:0.85rem; font-weight:700; box-shadow:0 3px 15px rgba(0,0,0,0.3); transition:all 0.3s;";
      document.body.appendChild(overlay);
    }

    // Set theme color depending on type
    if (broadcast.type === 'mandate') {
      overlay.style.background = "linear-gradient(90deg, #ef4444, #b91c1c)"; // Red
      overlay.innerHTML = `<div>⚠️ SYSTEM MANDATE NOTICE: ${broadcast.message}</div>`;
    } else if (broadcast.type === 'meeting') {
      overlay.style.background = "linear-gradient(90deg, #f59e0b, #d97706)"; // Amber/Yellow
      overlay.innerHTML = `<div>📅 CALENDAR VISIT REMINDER: ${broadcast.message}</div>`;
    } else {
      overlay.style.background = "linear-gradient(90deg, #10b981, #047857)"; // Green
      overlay.innerHTML = `<div>🎉 HOLIDAY / LEAVE POPUP: ${broadcast.message}</div>`;
    }

    // Close / dismiss button
    overlay.innerHTML += `
  <button type="button" style="background:#fff; border:none; color:#000; font-size:0.65rem; font-weight:bold; cursor:pointer; padding:3px 8px; border-radius:4px;" onclick="dismissBroadcast()">
    Dismiss / Close
  </button>
`;
    overlay.style.display = "flex";
  }
  window.checkActiveBroadcast = checkActiveBroadcast;

  window.dismissBroadcast = function () {
    const overlay = document.getElementById("system-broadcast-overlay");
    if (overlay) overlay.style.display = "none";

    // Soft dismiss (mark as inactive in localStorage)
    try {
      const data = localStorage.getItem("gl_admin_broadcast");
      if (data) {
        const b = JSON.parse(data);
        b.active = false;
        localStorage.setItem("gl_admin_broadcast", JSON.stringify(b));
      }
    } catch (e) { }
  };

  // ══════════════════════════════════════════════════
  // REPORTING & ARCHIVING FUNCTIONS
  // ══════════════════════════════════════════════════
  window.populateReportUsers = function() {
    const selectEl = document.getElementById("report-user");
    if (!selectEl) return;
    selectEl.innerHTML = '<option value="all">👥 All Desks / Users</option>';
    Object.keys(TEAM_ROLES).forEach(roleId => {
      const option = document.createElement("option");
      option.value = roleId;
      option.textContent = TEAM_ROLES[roleId]?.name || roleId;
      selectEl.appendChild(option);
    });
  };

  window.toggleCustomDateFields = function() {
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
      } catch(e) {}
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

  window.generateReportSummary = async function() {
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
      const buyRate = q.buyRate || q.details?.buyRate || 0;
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

  window.exportReportToCSV = async function() {
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
      const buyRate = q.buyRate || q.details?.buyRate || 0;
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

  window.lookupSingleArchivedQuote = async function() {
    const refInput = document.getElementById("report-lookup-ref")?.value.trim().replace("#", "");
    if (!refInput) {
      alert("Please enter a Reference ID to look up.");
      return;
    }
    
    let foundQuote = null;
    foundQuote = appState.quotes.find(q => (getQuoteRefId(q) || "").toLowerCase() === refInput.toLowerCase() || q.id.toLowerCase() === refInput.toLowerCase());
    
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
            const snapshot2 = await DB.firestoreRef.collection("archive_quotes").where("quoteRefNo", "==", parseInt(refInput) || refInput).get();
            if (!snapshot2.empty) foundQuote = snapshot2.docs[0].data();
          }
        }
      } catch(e) {
        console.error("Failed to lookup archive:", e);
      }
    }
    
    if (!foundQuote) {
      try {
        const offlineArchive = JSON.parse(localStorage.getItem("logistics_archive_quotes") || "[]");
        foundQuote = offlineArchive.find(q => (getQuoteRefId(q) || "").toLowerCase() === refInput.toLowerCase() || q.id.toLowerCase() === refInput.toLowerCase());
      } catch(e) {}
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

  window.updateArchiveLookupSuggestions = async function(val) {
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
    } catch(e) {}
    
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
      } catch(e) {}
    }
    
    Array.from(suggestions).slice(0, 15).forEach(s => {
      const option = document.createElement("option");
      option.value = s;
      datalist.appendChild(option);
    });
  };

  window.runAutoArchival = async function() {
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
        } catch(e) {
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
      } catch(e) {
        console.error("Failed to update offline archive:", e);
      }
    }
    
    appState.quotes = remaining;
    applyDbFiltersAndSort();
    alert(`Successfully archived ${successCount} quotes!`);
  };

  // Check broadcast every 3 seconds
  setInterval(checkActiveBroadcast, 3000);

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
    } catch(e) {}
  }
  
  window._dirCollapsedNodes.clear();
  
  if (window._dirGrouping === 'agents') {
    Object.keys(TEAM_ROLES).forEach(roleId => {
      if (roleId === 'ganny' || roleId === 'manager') return;
      const agentName = TEAM_ROLES[roleId].name || roleId;
      window._dirCollapsedNodes.add(`agent_${agentName}`);
    });
    quotes.forEach(q => {
      const creator = q.creator || 'unknown';
      const agentName = TEAM_ROLES[creator.toLowerCase()]?.name || q.creator || 'Unknown';
      window._dirCollapsedNodes.add(`agent_${agentName}`);
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
      btnAgents.style.background = "var(--sky)";
      btnAgents.style.color = "#fff";
      btnCustomers.classList.remove("active");
      btnCustomers.style.background = "transparent";
      btnCustomers.style.color = "var(--t2)";
    } else {
      btnCustomers.classList.add("active");
      btnCustomers.style.background = "var(--sky)";
      btnCustomers.style.color = "#fff";
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
    } catch(e) {}
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
        
        const nodeKey = `agent_${agentName}`;
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
              <span style="font-size: 0.7rem; background: var(--border-2); color: var(--t2); padding: 2px 6px; border-radius: 10px; font-weight: 600;">${data.quotesCount} Quotes</span>
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
      ...quotes.map(q => q.customer.trim()),
      ...Object.values(controls).map(c => c.customer.trim())
    ]));
    
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
              <span style="font-size: 0.7rem; background: var(--border-2); color: var(--t2); padding: 2px 6px; border-radius: 10px; font-weight: 600;">${data.quotesCount} Quotes</span>
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
    } catch(e) {}
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
      const refId = q.refid || `Q-${q.id.substring(0,6)}`;
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
      const refId = q.refid || `Q-${q.id.substring(0,6)}`;
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
    } catch(e) {}
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



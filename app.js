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
  'mahendra': { name: 'Sea Nom', type: 'member', category: 'SEA - NOMINATION', currency: 'USD' },
  'jaya': { name: 'Free Hand', type: 'member', category: 'FREE HAND SALES (AIR/SEA)', currency: 'INR' },
  'cathrina': { name: 'NRS', type: 'member', category: 'NRS (AIR/SEA)', currency: 'USD' }
};

// Apply saved desk names from localStorage
const savedNames = localStorage.getItem("gl_desk_names");
if (savedNames) {
  try {
    const parsed = JSON.parse(savedNames);
    if (parsed["shashank"]) TEAM_ROLES["shashank"].name = parsed["shashank"];
    if (parsed["mahendra"]) TEAM_ROLES["mahendra"].name = parsed["mahendra"];
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

// Global App State
let appState = {
  currentUser: null, // User Role Object
  airports: [],
  airlines: [],
  quotes: [],
  currentAirFreight: {
    origin: '',
    destination: '',
    airline: '',
    dimUnit: 'cms',
    module: 'export', // 'export' or 'import'
    cargoItems: [{ length: '', width: '', height: '', qty: '', grossWeight: '' }],
    rates: { min: '', minus45: '', plus45: '', plus100: '', plus300: '', plus500: '', plus1000: '' },
    surcharges: [{ name: 'Fuel Surcharge (MYC)', rate: 1.20, unit: 'kg' }, { name: 'Security Surcharge (SCC)', rate: 0.15, unit: 'kg' }, { name: 'Handling Charges', rate: 45.00, unit: 'flat' }],
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
  return `${moduleCode}${custPart}${datePart}${seqNum}`;
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
  let requests = [];
  const stored = localStorage.getItem("gl_amendment_requests");
  if (stored) {
    try { requests = JSON.parse(stored); } catch(e) {}
  }
  const pending = requests.find(r => r.quoteId === quote.id && r.requestType === 'edit' && r.status === 'pending');
  if (pending) {
    alert(`You have already requested permission to edit/amend this quote. Please wait for Ganny's approval.`);
    return false;
  }
  
  if (confirm(`You do not have permission to ${actionVerb} this quotation. Request edit permission from Admin (Ganny)?`)) {
    requests.push({
      id: 'REQ' + Math.random().toString(36).substr(2, 9),
      requestType: 'edit',
      quoteId: quote.id,
      customer: quote.customer,
      creator: quote.creator,
      creatorName: TEAM_ROLES[quote.creator]?.name || quote.creator,
      date: new Date().toLocaleDateString() + " " + new Date().toLocaleTimeString(),
      status: 'pending',
      acknowledged: false
    });
    localStorage.setItem("gl_amendment_requests", JSON.stringify(requests));
    alert("Edit/Amendment request submitted successfully to Ganny.");
    
    if (appState.currentUser === 'ganny') {
      renderAdminDashboard();
    } else {
      renderMemberDashboard(appState.currentUser);
    }
  }
  return false;
}
window.checkAndRequestEditPermission = checkAndRequestEditPermission;

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

// Initialize Application
document.addEventListener("DOMContentLoaded", () => {
  loadData();
  applyDeskNames();
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
});

// Authentication System
function checkSession() {
  const session = sessionStorage.getItem("gl_pricing_session");
  if (session && TEAM_ROLES[session]) {
    loginSuccess(session);
  } else {
    // Show login overlay
    document.getElementById("login-overlay").style.display = "flex";
    document.getElementById("app-workspace").style.display = "none";
  }
}

function handleLogin(e) {
  e.preventDefault();
  const user = document.getElementById("login-username").value.trim().toLowerCase();
  const pass = document.getElementById("login-password").value;

  let customUsersList = [];
  const storedCustom = localStorage.getItem("gl_custom_users");
  if (storedCustom) {
    try {
      const parsed = JSON.parse(storedCustom);
      customUsersList = parsed;
    } catch(e) {}
  }

  const customUsernames = customUsersList.map(u => u.username.toLowerCase());
  const validUsers = ["ganny", "shashank", "mahendra", "jaya", "cathrina", ...customUsernames];

  let expectedPassword = "password";
  if (customUsernames.includes(user)) {
    const match = customUsersList.find(u => u.username.toLowerCase() === user);
    if (match) expectedPassword = match.password;
  }

  if (validUsers.includes(user) && pass === expectedPassword) {
    sessionStorage.setItem("gl_pricing_session", user);
    
    // Reset login inputs
    document.getElementById("login-username").value = "";
    document.getElementById("login-password").value = "";
    
    loginSuccess(user);
  } else {
    alert("Invalid login credentials. Please check your username/password.");
  }
}

function loginSuccess(roleId) {
  appState.currentUser = roleId;
  document.getElementById("login-overlay").style.display = "none";
  document.getElementById("app-workspace").style.display = "flex";
  document.getElementById("subheader-controls").style.display = "flex";

  // Apply custom names to badge UI & dropdowns
  applyDeskNames();

  const roleInfo = TEAM_ROLES[roleId];
  document.getElementById("active-user-name").textContent = roleInfo.name;

  const root = document.documentElement;
  if (roleId === 'ganny') {
    document.getElementById("admin-role-selector").style.display = "flex";
    root.style.setProperty('--accent-current', 'var(--sky)');
    root.style.setProperty('--accent-current-glow', 'rgba(27, 28, 92, 0.2)');
    switchRole('manager');
  } else {
    document.getElementById("admin-role-selector").style.display = "none";
    if (roleId.startsWith('air')) {
      root.style.setProperty('--accent-current', 'var(--accent-air)');
      root.style.setProperty('--accent-current-glow', 'var(--accent-air-glow)');
    } else {
      root.style.setProperty('--accent-current', 'var(--accent-sea)');
      root.style.setProperty('--accent-current-glow', 'var(--accent-sea-glow)');
    }
    switchRole(roleId);
  }
}

function logoutUser() {
  sessionStorage.removeItem("gl_pricing_session");
  appState.currentUser = null;
  document.getElementById("login-overlay").style.display = "flex";
  document.getElementById("app-workspace").style.display = "none";
  document.getElementById("subheader-controls").style.display = "none";
}

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

  // Setup Autocomplete inputs
  setupAutocomplete(document.getElementById("air-cust-name"), "customers");
  setupAutocomplete(document.getElementById("air-origin"), "airports");
  setupAutocomplete(document.getElementById("air-dest"), "airports");
  setupAutocomplete(document.getElementById("air-airline"), "airlines");
  
  setupAutocomplete(document.getElementById("sea-cust-name"), "customers");
  setupAutocomplete(document.getElementById("sea-origin"), "seaports");
  setupAutocomplete(document.getElementById("sea-dest"), "seaports");
  setupAutocomplete(document.getElementById("sea-line"), "shippinglines");
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
  // Update Active Class on Buttons (if visible)
  document.querySelectorAll(".role-btn").forEach(btn => {
    if (btn.getAttribute("data-role") === role) {
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
  if (role.startsWith('air') || role === 'shashank') {
    root.style.setProperty('--accent-current', 'var(--accent-air)');
    root.style.setProperty('--accent-current-glow', 'var(--accent-air-glow)');
  } else if (role.startsWith('sea') || role === 'mahendra') {
    root.style.setProperty('--accent-current', 'var(--accent-sea)');
    root.style.setProperty('--accent-current-glow', 'var(--accent-sea-glow)');
  } else if (role === 'manager') {
    root.style.setProperty('--accent-current', 'var(--sky)');
    root.style.setProperty('--accent-current-glow', 'rgba(27, 28, 92, 0.2)');
  } else {
    root.style.setProperty('--accent-current', 'var(--indigo)');
    root.style.setProperty('--accent-current-glow', 'rgba(47, 49, 147, 0.2)');
  }

  // Currency Indicator rules based on Role
  updateCurrencyRules(role);

  // Show Selected view
  if (role === 'manager') {
    document.getElementById("manager-panel").classList.add("active");
    renderAdminDashboard();
  } else if (TEAM_ROLES[role] && TEAM_ROLES[role].type === 'member') {
    // Check if we are showing the member dashboard or active calculator
    // Default: show member dashboard summary
    document.getElementById("member-dashboard-panel").classList.add("active");
    renderMemberDashboard(role);
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
}
window.goHome = goHome;

function updateCurrencyRules(role) {
  const airCurSelect = document.getElementById("air-currency");
  const seaCurSelect = document.getElementById("sea-currency");
  
  const isLocal = role && (role.includes('local') || role === 'jaya' || TEAM_ROLES[role]?.category === 'FREE HAND SALES (AIR/SEA)');
  const targetType = isLocal ? "local" : "nom";
  
  // Rebuild Air select if needed
  if (airCurSelect && airCurSelect.getAttribute("data-role-type") !== targetType) {
    const val = airCurSelect.value;
    airCurSelect.setAttribute("data-role-type", targetType);
    if (isLocal) {
      airCurSelect.innerHTML = `
        <option value="INR">INR - Indian Rupee</option>
        <option value="USD">USD - US Dollar</option>
      `;
      airCurSelect.value = (val === 'USD' || val === 'INR') ? val : 'INR';
    } else {
      airCurSelect.innerHTML = `
        <option value="USD">USD - US Dollar</option>
        <option value="EUR">EUR - Euro</option>
        <option value="GBP">GBP - British Pound</option>
      `;
      airCurSelect.value = (val === 'USD' || val === 'EUR' || val === 'GBP') ? val : 'USD';
    }
    airCurSelect.disabled = false;
  }

  // Rebuild Sea select if needed
  if (seaCurSelect && seaCurSelect.getAttribute("data-role-type") !== targetType) {
    const val = seaCurSelect.value;
    seaCurSelect.setAttribute("data-role-type", targetType);
    if (isLocal) {
      seaCurSelect.innerHTML = `
        <option value="INR">INR - Indian Rupee</option>
        <option value="USD">USD - US Dollar</option>
      `;
      seaCurSelect.value = (val === 'USD' || val === 'INR') ? val : 'INR';
    } else {
      seaCurSelect.innerHTML = `
        <option value="USD">USD - US Dollar</option>
        <option value="EUR">EUR - Euro</option>
        <option value="GBP">GBP - British Pound</option>
      `;
      seaCurSelect.value = (val === 'USD' || val === 'EUR' || val === 'GBP') ? val : 'USD';
    }
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
    currency = (role && role.includes('nom')) ? 'USD' : 'INR';
  }

  // Update currency labels on forms
  const currencyElements = document.querySelectorAll(".curr-label");
  const symbolElements = document.querySelectorAll(".curr-symbol");

  currencyElements.forEach(el => el.textContent = currency);
  symbolElements.forEach(el => el.textContent = currency === 'INR' ? '₹' : (currency === 'USD' ? '$' : (currency === 'EUR' ? '€' : '£')));
}

function resetAirFreightDeskForm() {
  appState.editingQuoteId = null;

  // Clear inputs
  document.getElementById("air-cust-name").value = "";
  document.getElementById("air-origin").value = "";
  document.getElementById("air-dest").value = "";
  document.getElementById("air-airline").value = "";
  document.getElementById("air-incoterm").value = "EXW";
  document.getElementById("air-pivot-weight").value = "";
  document.getElementById("air-routing").value = "";
  document.getElementById("air-tt").value = "";
  document.getElementById("air-validity").value = "";
  document.getElementById("air-terms").value = DEFAULT_AIR_TERMS;

  // Reset module switcher
  appState.currentAirFreight.module = 'export';
  const tabExp = document.getElementById("air-tab-export");
  const tabImp = document.getElementById("air-tab-import");
  if (tabExp && tabImp) {
    tabExp.classList.add("active");
    tabImp.classList.remove("active");
  }

  // Clear weight break rates
  const breaks = ["min", "n", "p45", "p100", "p250", "p300", "p500", "p1000"];
  breaks.forEach(b => {
    const el = document.getElementById(`rate-${b}`);
    if (el) el.value = "";
  });

  // Reset cargo matrix with single empty row
  const cargoBody = document.getElementById("air-cargo-body");
  if (cargoBody) {
    cargoBody.innerHTML = `
      <tr class="cargo-item-row">
        <td><input type="number" class="cargo-len" min="1" placeholder="L" required></td>
        <td><input type="number" class="cargo-wid" min="1" placeholder="W" required></td>
        <td><input type="number" class="cargo-hei" min="1" placeholder="H" required></td>
        <td><input type="number" class="cargo-qty" min="1" placeholder="Qty" required></td>
        <td><input type="number" class="cargo-gw" min="0.1" step="0.1" placeholder="Kg" required></td>
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

  // Clear inputs
  document.getElementById("sea-cust-name").value = "";
  document.getElementById("sea-origin").value = "";
  document.getElementById("sea-dest").value = "";
  document.getElementById("sea-line").value = "";
  document.getElementById("sea-incoterm").value = "EXW";
  document.getElementById("sea-gross-weight").value = "0";
  document.getElementById("sea-volume").value = "0";
  document.getElementById("sea-pkg-qty").value = "0";
  document.getElementById("sea-routing").value = "";
  document.getElementById("sea-tt").value = "";
  document.getElementById("sea-validity").value = "";
  document.getElementById("sea-lcl-rate").value = "0";
  document.getElementById("sea-bb-rate").value = "0";
  document.getElementById("sea-terms").value = DEFAULT_SEA_TERMS;

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

  // Clear FCL container matrix and load default 20'GP
  const fclBody = document.getElementById("sea-fcl-body");
  if (fclBody) {
    fclBody.innerHTML = "";
    addFclContainerRow("20'GP", 1, 0);
  }

  // Reset tab to default FCL
  const tabFcl = document.getElementById("sea-tab-fcl");
  const tabLcl = document.getElementById("sea-tab-lcl");
  const fclForm = document.getElementById("sea-fcl-form");
  const lclForm = document.getElementById("sea-lcl-form");
  if (tabFcl && tabLcl && fclForm && lclForm) {
    tabFcl.classList.add("active");
    tabLcl.classList.remove("active");
    fclForm.style.display = "block";
    lclForm.style.display = "none";
    appState.currentSeaFreight.type = "fcl";
  }

  // Surcharges reset to default
  resetSurchargesToDefaults();

  // Recalculate to update results layout to 0/empty
  calculateSeaFreight();
}

// Sub-navigation triggers for Calculators inside Member dashboard
function openActiveCalculator(type) {
  document.getElementById("member-dashboard-panel").classList.remove("active");
  const managerPanel = document.getElementById("manager-panel");
  if (managerPanel) managerPanel.classList.remove("active");
  
  if (type === 'air') {
    resetAirFreightDeskForm();
    document.getElementById("air-freight-panel").classList.add("active");
  } else {
    resetSeaFreightDeskForm();
    document.getElementById("sea-freight-panel").classList.add("active");
  }
}

function returnToWorkspace() {
  document.getElementById("air-freight-panel").classList.remove("active");
  document.getElementById("sea-freight-panel").classList.remove("active");
  if (appState.currentUser === 'ganny') {
    const managerPanel = document.getElementById("manager-panel");
    if (managerPanel) managerPanel.classList.add("active");
    renderAdminDashboard();
  } else {
    document.getElementById("member-dashboard-panel").classList.add("active");
    renderMemberDashboard(appState.currentUser);
  }
}

// Autocomplete Engine
function setupAutocomplete(inputEl, type) {
  if (!inputEl) return;
  
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
        if (type === "customers") {
          inputEl.value = selectedItem.name;
        } else {
          inputEl.value = `${selectedItem.code} - ${selectedItem.name}`;
        }
        dropdown.classList.remove("show");
        dropdown.innerHTML = "";
        
        const event = new Event('change');
        inputEl.dispatchEvent(event);
        
        // Also trigger input event for live calculations if applicable
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
      matches = appState.airports.filter(ap => 
        ap.code.toLowerCase().includes(val) || 
        ap.city.toLowerCase().includes(val) || 
        ap.country.toLowerCase().includes(val) || 
        ap.name.toLowerCase().includes(val)
      ).slice(0, 10);
    } else if (type === "airlines") {
      matches = appState.airlines.filter(al => 
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
      // Load custom seaports
      let customPorts = [];
      const stored = localStorage.getItem("gl_custom_seaports");
      if (stored) {
        try { customPorts = JSON.parse(stored); } catch(err) {}
      }
      const combined = [...majorSeaports, ...customPorts];
      matches = combined.filter(sp => 
        sp.code.toLowerCase().includes(val) || 
        sp.name.toLowerCase().includes(val) ||
        sp.city.toLowerCase().includes(val) ||
        sp.country.toLowerCase().includes(val)
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
      // Load custom shipping lines
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
    }

    currentMatches = matches;
    activeIndex = -1;

    if (matches.length > 0) {
      dropdown.innerHTML = "";
      matches.forEach((item, idx) => {
        const div = document.createElement("div");
        div.className = "autocomplete-item";
        
        let label = "";
        if (type === "customers") {
          label = `<div>${item.name}</div>`;
        } else if (type === "airlines" || type === "shippinglines") {
          label = `<div>${item.name}</div><div class="code-badge">${item.code}</div>`;
        } else {
          label = `<div>${item.name} (${item.city || ''}${item.country ? ', ' + item.country : ''})</div><div class="code-badge">${item.code}</div>`;
        }
        
        div.innerHTML = label;
        div.addEventListener("click", () => {
          inputEl._programmaticSelection = true;
          if (type === "customers") {
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

  document.addEventListener("click", (e) => {
    if (!container.contains(e.target)) {
      dropdown.classList.remove("show");
      activeIndex = -1;
    }
  });
}

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
      calculateAirFreight();
    });
    airTabImport.addEventListener("click", () => {
      airTabImport.classList.add("active");
      airTabExport.classList.remove("active");
      appState.currentAirFreight.module = 'import';
      calculateAirFreight();
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
        <td><input type="number" class="cargo-gw" min="0.1" step="0.1" placeholder="Kg" required></td>
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

  const rateInputs = document.querySelectorAll(".breaks-grid input");
  rateInputs.forEach(inp => {
    inp.addEventListener("input", calculateAirFreight);
  });

  if (currencySelect) {
    currencySelect.addEventListener("change", () => {
      updateCurrencyRules(appState.currentUser);
      calculateAirFreight();
    });
  }

  document.getElementById("air-incoterm")?.addEventListener("change", calculateAirFreight);
  document.getElementById("air-pivot-weight")?.addEventListener("input", calculateAirFreight);
  document.getElementById("air-routing")?.addEventListener("input", calculateAirFreight);
  document.getElementById("air-tt")?.addEventListener("input", calculateAirFreight);
  document.getElementById("air-validity")?.addEventListener("input", calculateAirFreight);

  setupSurchargesEvents("air-origin");
  setupSurchargesEvents("air-dest");
}

function calculateAirFreight() {
  // Sync page currency labels and units
  updateCurrencyRules(appState.currentUser);

  const rows = document.querySelectorAll("#air-cargo-body .cargo-item-row");
  let totalGrossWeight = 0;
  let totalVolume = 0;
  let totalVolumeWeight = 0;
  let totalPackageQty = 0;
  
  const unit = appState.currentAirFreight.dimUnit;
  const divisor = (unit === 'cms') ? 6000 : 360;

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

  const pivotWeight = parseFloat(document.getElementById("air-pivot-weight")?.value) || 0;
  let chargeableWeight = Math.max(totalGrossWeight, totalVolumeWeight);
  if (pivotWeight > totalGrossWeight || pivotWeight > totalVolumeWeight) {
    chargeableWeight = pivotWeight;
  }

  const rateMin = parseFloat(document.getElementById("rate-min").value) || 0;
  const rateM45 = parseFloat(document.getElementById("rate-m45").value) || 0;
  const rateP45 = parseFloat(document.getElementById("rate-p45").value) || 0;
  const rateP100 = parseFloat(document.getElementById("rate-p100").value) || 0;
  const rateP300 = parseFloat(document.getElementById("rate-p300").value) || 0;
  const rateP500 = parseFloat(document.getElementById("rate-p500").value) || 0;
  const rateP1000 = parseFloat(document.getElementById("rate-p1000").value) || 0;

  const rates = [
    { breakName: 'min', limit: 0, rate: rateMin, label: 'Min' },
    { breakName: 'minus45', limit: 0.1, rate: rateM45, label: '-45 kg' },
    { breakName: 'plus45', limit: 45, rate: rateP45, label: '+45 kg' },
    { breakName: 'plus100', limit: 100, rate: rateP100, label: '+100 kg' },
    { breakName: 'plus300', limit: 300, rate: rateP300, label: '+300 kg' },
    { breakName: 'plus500', limit: 500, rate: rateP500, label: '+500 kg' },
    { breakName: 'plus1000', limit: 1000, rate: rateP1000, label: '+1000 kg' }
  ];

  let activeBreakIndex = -1;
  let activeRate = 0;

  if (chargeableWeight > 0) {
    if (chargeableWeight < 45) {
      activeBreakIndex = 1;
      activeRate = rateM45;
    } else if (chargeableWeight >= 45 && chargeableWeight < 100) {
      activeBreakIndex = 2;
      activeRate = rateP45;
    } else if (chargeableWeight >= 100 && chargeableWeight < 300) {
      activeBreakIndex = 3;
      activeRate = rateP100;
    } else if (chargeableWeight >= 300 && chargeableWeight < 500) {
      activeBreakIndex = 4;
      activeRate = rateP300;
    } else if (chargeableWeight >= 500 && chargeableWeight < 1000) {
      activeBreakIndex = 5;
      activeRate = rateP500;
    } else if (chargeableWeight >= 1000) {
      activeBreakIndex = 6;
      activeRate = rateP1000;
    }
  }

  document.querySelectorAll(".break-input-wrapper").forEach(el => {
    el.classList.remove("highlight-break", "suggested-break");
  });

  if (activeBreakIndex !== -1) {
    const activeEl = document.querySelectorAll(".break-input-wrapper")[activeBreakIndex];
    if (activeEl) activeEl.classList.add("highlight-break");
  }

  let baseFreightCost = chargeableWeight * activeRate;
  if (activeBreakIndex === 1 && rateMin > 0 && baseFreightCost < rateMin) {
    baseFreightCost = rateMin;
    document.querySelectorAll(".break-input-wrapper")[0].classList.add("highlight-break");
  }

  let optBreakIndex = -1;
  let optWeight = chargeableWeight;
  let optRate = activeRate;
  let optFreightCost = baseFreightCost;
  let hasSavings = false;

  if (chargeableWeight > 0 && activeBreakIndex !== -1 && activeBreakIndex < rates.length - 1) {
    for (let i = activeBreakIndex + 1; i < rates.length; i++) {
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
    optCard.style.display = "block";
    const savingsAmount = baseFreightCost - optFreightCost;
    const currency = document.getElementById("air-currency").value;
    const curSymbol = currency === 'INR' ? '₹' : (currency === 'USD' ? '$' : (currency === 'EUR' ? '€' : '£'));
    
    document.getElementById("opt-suggestion-text").innerHTML = `
      Rating actual ${chargeableWeight.toFixed(2)} kg at the ${rates[activeBreakIndex].label} rate is ${curSymbol}${baseFreightCost.toFixed(2)}.
      However, rating <strong>as ${optWeight} kg</strong> at the <strong>+${rates[optBreakIndex].limit} kg rate (${curSymbol}${optRate.toFixed(2)}/kg)</strong> is only <strong>${curSymbol}${optFreightCost.toFixed(2)}</strong>.
      <br><strong>Savings: ${curSymbol}${savingsAmount.toFixed(2)}</strong>.
    `;
    
    const optEl = document.querySelectorAll(".break-input-wrapper")[optBreakIndex];
    if (optEl) optEl.classList.add("suggested-break");

    document.getElementById("apply-opt").onclick = () => {
      appState.currentAirFreight.isOptimizedApplied = true;
      optCard.style.display = "none";
      calculateAirFreight();
    };
  } else {
    optCard.style.display = "none";
  }

  let finalChargeableWeight = chargeableWeight;
  let finalBaseRate = activeRate;
  let finalFreightCost = baseFreightCost;
  let usedBreakLabel = activeBreakIndex !== -1 ? rates[activeBreakIndex].label : '';

  if (appState.currentAirFreight.isOptimizedApplied && hasSavings) {
    finalChargeableWeight = optWeight;
    finalBaseRate = optRate;
    finalFreightCost = optFreightCost;
    usedBreakLabel = `As For ${rates[optBreakIndex].label}`;
    
    document.querySelectorAll(".break-input-wrapper").forEach(el => el.classList.remove("highlight-break"));
    const optEl = document.querySelectorAll(".break-input-wrapper")[optBreakIndex];
    if (optEl) optEl.classList.add("highlight-break");
  } else if (!hasSavings) {
    appState.currentAirFreight.isOptimizedApplied = false;
  }

  let totalSurcharges = 0;
  let originSurchargesList = [];
  let destSurchargesList = [];

  const originRows = document.querySelectorAll("#air-origin-surcharges-body tr");
  originRows.forEach(row => {
    const name = row.querySelector(".chg-name").value.trim();
    const rate = parseFloat(row.querySelector(".chg-rate").value) || 0;
    const unit = row.querySelector(".chg-unit").value;

    if (name && rate > 0) {
      let cost = unit === 'kg' ? finalChargeableWeight * rate : rate;
      totalSurcharges += cost;
      originSurchargesList.push({ name, rate, unit, calculatedCost: cost });
    }
  });

  const destRows = document.querySelectorAll("#air-dest-surcharges-body tr");
  destRows.forEach(row => {
    const name = row.querySelector(".chg-name").value.trim();
    const rate = parseFloat(row.querySelector(".chg-rate").value) || 0;
    const unit = row.querySelector(".chg-unit").value;

    if (name && rate > 0) {
      let cost = unit === 'kg' ? finalChargeableWeight * rate : rate;
      totalSurcharges += cost;
      destSurchargesList.push({ name, rate, unit, calculatedCost: cost });
    }
  });

  const surchargesList = [...originSurchargesList, ...destSurchargesList];

  const grandTotal = finalFreightCost + totalSurcharges;
  const currency = document.getElementById("air-currency").value;
  const curSymbol = currency === 'INR' ? '₹' : (currency === 'USD' ? '$' : (currency === 'EUR' ? '€' : '£'));

  let totalINR = grandTotal;
  if (currency !== 'INR') {
    totalINR = grandTotal * EXCHANGE_RATES[`${currency}_TO_INR`];
  }

  document.getElementById("res-air-gw").textContent = `${totalGrossWeight.toFixed(2)} kg`;
  document.getElementById("res-air-qty").textContent = `${totalPackageQty} Pkgs`;
  document.getElementById("res-air-vw").textContent = `${totalVolumeWeight.toFixed(2)} kg`;
  document.getElementById("res-air-chw").textContent = `${finalChargeableWeight.toFixed(2)} kg ${usedBreakLabel ? `(${usedBreakLabel})` : ''}`;
  
  const rowPivot = document.getElementById("row-air-pivot");
  const resPivot = document.getElementById("res-air-pivot");
  if (rowPivot && resPivot) {
    if (pivotWeight > 0) {
      rowPivot.style.display = "flex";
      resPivot.textContent = `${pivotWeight.toFixed(2)} kg`;
    } else {
      rowPivot.style.display = "none";
    }
  }

  document.getElementById("res-air-vol").textContent = `${totalVolume.toFixed(3)} CBM`;
  
  const routing = document.getElementById("air-routing")?.value || "";
  const rawTt = document.getElementById("air-tt")?.value || "";
  let tt = rawTt.trim();
  if (tt && !tt.toLowerCase().includes("day")) {
    tt = `${tt} Days`;
  }
  const validity = document.getElementById("air-validity")?.value || "";
  const resRouting = document.getElementById("res-air-routing-val");
  const resTT = document.getElementById("res-air-tt-val");
  const resValidity = document.getElementById("res-air-validity-val");
  if (resRouting) resRouting.textContent = routing ? (routing.toLowerCase().startsWith('via') ? routing : 'via ' + routing) : "-";
  if (resTT) resTT.textContent = tt || "-";
  if (resValidity) resValidity.textContent = validity || "-";

  document.getElementById("res-air-base").textContent = `${curSymbol}${finalFreightCost.toFixed(2)}`;
  document.getElementById("res-air-sur").textContent = `${curSymbol}${totalSurcharges.toFixed(2)}`;
  document.getElementById("res-air-total").textContent = `${curSymbol}${grandTotal.toFixed(2)}`;

  appState.currentAirFreight.grossWeight = totalGrossWeight;
  appState.currentAirFreight.volumeWeight = totalVolumeWeight;
  appState.currentAirFreight.chargeableWeight = finalChargeableWeight;
  appState.currentAirFreight.cbm = totalVolume;
  appState.currentAirFreight.baseFreight = finalFreightCost;
  appState.currentAirFreight.surchargeTotal = totalSurcharges;
  appState.currentAirFreight.grandTotal = grandTotal;
  appState.currentAirFreight.grandTotalINR = totalINR;
  appState.currentAirFreight.currency = currency;
  appState.currentAirFreight.quantity = totalPackageQty;
  appState.currentAirFreight.originSurcharges = originSurchargesList;
  appState.currentAirFreight.destSurcharges = destSurchargesList;
  appState.currentAirFreight.surchargesCalculated = surchargesList;
  appState.currentAirFreight.usedBreak = usedBreakLabel;
  appState.currentAirFreight.appliedRate = finalBaseRate;
  appState.currentAirFreight.pivotWeight = pivotWeight;
  appState.currentAirFreight.routing = routing;
  appState.currentAirFreight.tt = tt;
  appState.currentAirFreight.validity = validity;
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
      calculateSeaFreight();
    });
    seaTabImport.addEventListener("click", () => {
      seaTabImport.classList.add("active");
      seaTabExport.classList.remove("active");
      appState.currentSeaFreight.module = 'import';
      calculateSeaFreight();
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
  document.getElementById("sea-bb-rate")?.addEventListener("input", calculateSeaFreight);
  document.getElementById("sea-routing")?.addEventListener("input", calculateSeaFreight);
  document.getElementById("sea-tt")?.addEventListener("input", calculateSeaFreight);
  document.getElementById("sea-validity")?.addEventListener("input", calculateSeaFreight);

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
  const fclBody = document.getElementById("sea-fcl-body");
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
}

function addFclContainerRow(typeVal = "20'GP", qtyVal = 1, rateVal = 0) {
  const tbody = document.getElementById("sea-fcl-body");
  if (!tbody) return;

  const tr = document.createElement("tr");
  tr.className = "container-row";
  tr.innerHTML = `
    <td>
      <select class="fcl-type" style="background: rgba(255,255,255,0.05); border: 1px solid var(--border-color); color: #fff; padding: 4px 8px; border-radius: 4px; width: 100%;">
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
    <td><input type="number" class="fcl-qty" value="${qtyVal}" min="1" style="width: 100%;"></td>
    <td><input type="number" class="fcl-rate" value="${rateVal}" min="0" style="width: 100%;"></td>
    <td>
      <button type="button" class="delete-btn">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/></svg>
      </button>
    </td>
  `;

  tr.querySelector(".fcl-type").addEventListener("change", calculateSeaFreight);
  tr.querySelector(".fcl-qty").addEventListener("input", calculateSeaFreight);
  tr.querySelector(".fcl-rate").addEventListener("input", calculateSeaFreight);

  tr.querySelector(".delete-btn").addEventListener("click", () => {
    tr.remove();
    calculateSeaFreight();
  });

  tbody.appendChild(tr);
  calculateSeaFreight();
}

window.addFclContainerRow = addFclContainerRow;

function calculateSeaFreight() {
  updateSeaFclStuffingVisibility();
  // Sync page currency labels and units
  updateCurrencyRules(appState.currentUser);

  const type = appState.currentSeaFreight.type; // 'fcl', 'lcl', or 'bb'
  const isFcl = (type === 'fcl');
  const currency = document.getElementById("sea-currency").value;
  const curSymbol = currency === 'INR' ? '₹' : (currency === 'USD' ? '$' : (currency === 'EUR' ? '€' : '£'));
  
  // Read top level cargo details
  const weightKg = parseFloat(document.getElementById("sea-gross-weight").value) || 0;
  const cbm = parseFloat(document.getElementById("sea-volume").value) || 0;
  const pkgQty = parseInt(document.getElementById("sea-pkg-qty").value) || 0;

  // LCL RT Math
  const weightTons = weightKg / 1000;
  const chargeableCbm = Math.max(cbm, weightTons);

  let baseFreight = 0;
  let detailsText = '';
  let totalContainersCount = 0;

  if (type === 'fcl') {
    const fclRows = document.querySelectorAll("#sea-fcl-body .container-row");
    let containerSummary = [];
    fclRows.forEach(row => {
      const typeVal = row.querySelector(".fcl-type").value;
      const qty = parseInt(row.querySelector(".fcl-qty").value) || 0;
      const rate = parseFloat(row.querySelector(".fcl-rate").value) || 0;
      if (qty > 0 && rate > 0) {
        baseFreight += (qty * rate);
        totalContainersCount += qty;
        containerSummary.push(`${qty} x ${typeVal}`);
      }
    });
    detailsText = containerSummary.join(", ") || 'No Containers Selected';
    appState.currentSeaFreight.fclSummary = containerSummary;
  } else if (type === 'lcl') {
    const rate = parseFloat(document.getElementById("sea-lcl-rate").value) || 0;
    baseFreight = chargeableCbm * rate;
    detailsText = `${chargeableCbm.toFixed(2)} RT (${cbm.toFixed(2)} CBM / ${weightTons.toFixed(2)} Tons) [LCL]`;
  } else {
    const rate = parseFloat(document.getElementById("sea-bb-rate").value) || 0;
    baseFreight = chargeableCbm * rate;
    detailsText = `${chargeableCbm.toFixed(2)} RT (${cbm.toFixed(2)} CBM / ${weightTons.toFixed(2)} Tons) [Break Bulk]`;
  }

  let totalSurcharges = 0;
  let originSurchargesList = [];
  let destSurchargesList = [];

  const originRows = document.querySelectorAll("#sea-origin-surcharges-body tr");
  originRows.forEach(row => {
    const name = row.querySelector(".chg-name").value.trim();
    const rate = parseFloat(row.querySelector(".chg-rate").value) || 0;
    const unit = row.querySelector(".chg-unit")?.value || 'flat';
    
    if (name && rate > 0) {
      let cost = 0;
      if (unit === 'container') {
        cost = isFcl ? totalContainersCount * rate : rate; // default LCL to 1 unit
      } else if (unit === 'rt') {
        cost = isFcl ? cbm * rate : chargeableCbm * rate;
      } else if (unit === 'kg') {
        cost = weightKg * rate;
      } else {
        cost = rate;
      }
      totalSurcharges += cost;
      originSurchargesList.push({ name, rate, unit, calculatedCost: cost });
    }
  });

  const destRows = document.querySelectorAll("#sea-dest-surcharges-body tr");
  destRows.forEach(row => {
    const name = row.querySelector(".chg-name").value.trim();
    const rate = parseFloat(row.querySelector(".chg-rate").value) || 0;
    const unit = row.querySelector(".chg-unit")?.value || 'flat';
    
    if (name && rate > 0) {
      let cost = 0;
      if (unit === 'container') {
        cost = isFcl ? totalContainersCount * rate : rate; // default LCL to 1 unit
      } else if (unit === 'rt') {
        cost = isFcl ? cbm * rate : chargeableCbm * rate;
      } else if (unit === 'kg') {
        cost = weightKg * rate;
      } else {
        cost = rate;
      }
      totalSurcharges += cost;
      destSurchargesList.push({ name, rate, unit, calculatedCost: cost });
    }
  });

  const surchargesList = [...originSurchargesList, ...destSurchargesList];

  const grandTotal = baseFreight + totalSurcharges;
  
  let totalINR = grandTotal;
  if (currency !== 'INR') {
    totalINR = grandTotal * EXCHANGE_RATES[`${currency}_TO_INR`];
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
  document.getElementById("res-sea-vol").textContent = `${cbm.toFixed(2)} CBM`;
  document.getElementById("res-sea-qty").textContent = `${pkgQty} Pkgs`;

  const routing = document.getElementById("sea-routing")?.value || "";
  const rawTt = document.getElementById("sea-tt")?.value || "";
  let tt = rawTt.trim();
  if (tt && !tt.toLowerCase().includes("day")) {
    tt = `${tt} Days`;
  }
  const validity = document.getElementById("sea-validity")?.value || "";
  const resRouting = document.getElementById("res-sea-routing-val");
  const resTT = document.getElementById("res-sea-tt-val");
  const resValidity = document.getElementById("res-sea-validity-val");
  if (resRouting) resRouting.textContent = routing ? (routing.toLowerCase().startsWith('via') ? routing : 'via ' + routing) : "-";
  if (resTT) resTT.textContent = tt || "-";
  if (resValidity) resValidity.textContent = validity || "-";

  document.getElementById("res-sea-base").textContent = `${curSymbol}${baseFreight.toFixed(2)}`;
  document.getElementById("res-sea-sur").textContent = `${curSymbol}${totalSurcharges.toFixed(2)}`;
  document.getElementById("res-sea-total").textContent = `${curSymbol}${grandTotal.toFixed(2)}`;

  appState.currentSeaFreight.grossWeight = weightKg;
  appState.currentSeaFreight.volumeCbm = cbm;
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
}

function setupSurchargesEvents(freightType) {
  const body = document.getElementById(`${freightType}-surcharges-body`);
  const addBtn = document.getElementById(`add-${freightType}-surcharge`);
  const isAir = freightType.startsWith("air");
  const callback = isAir ? calculateAirFreight : calculateSeaFreight;

  if (addBtn && body) {
    addBtn.addEventListener("click", () => {
      const row = document.createElement("tr");
      if (isAir) {
        row.innerHTML = `
          <td><input type="text" class="chg-name" placeholder="Charge Name" required></td>
          <td><input type="number" class="chg-rate" min="0" step="0.01" placeholder="Rate" required></td>
          <td>
            <select class="chg-unit">
              <option value="kg">Per kg</option>
              <option value="flat">Flat</option>
            </select>
          </td>
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
          <td>
            <select class="chg-unit" style="background: rgba(255,255,255,0.05); border: 1px solid var(--border-color); color: #fff; padding: 4px 8px; border-radius: 4px; width: 100%;">
              <option value="flat" selected>Flat Fee</option>
              <option value="container">Per Container</option>
              <option value="rt">Per RT (Revenue Ton)</option>
              <option value="kg">Per Kg (Gross Weight)</option>
            </select>
          </td>
          <td>
            <button type="button" class="delete-btn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/></svg>
            </button>
          </td>
        `;
      }

      // Link newly added input to datalist and bind change event
      const nameInput = row.querySelector(".chg-name");
      if (nameInput) {
        nameInput.setAttribute("list", `${freightType}-charges-list`);
        nameInput.addEventListener("change", memorizeSurchargeNames);
      }

      row.querySelectorAll("input, select").forEach(inp => inp.addEventListener("input", callback));

      body.appendChild(row);
      
      row.querySelector(".delete-btn").addEventListener("click", () => {
        row.remove();
        callback();
      });
      
      callback();
    });
  }

  // Bind existing rows
  body.querySelectorAll("input, select").forEach(inp => {
    inp.addEventListener("input", callback);
  });
  body.querySelectorAll(".chg-name").forEach(inp => {
    inp.setAttribute("list", `${freightType}-charges-list`);
    inp.addEventListener("change", memorizeSurchargeNames);
  });

  body.querySelectorAll(".delete-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.target.closest("tr").remove();
      callback();
    });
  });
}

// MEMBER DASHBOARD RENDERING
function renderMemberDashboard(userId) {
  // Check for resolved amendment requests for this member
  let requestsList = [];
  const storedReqs = localStorage.getItem("gl_amendment_requests");
  if (storedReqs) {
    try { requestsList = JSON.parse(storedReqs); } catch(e) {}
  }
  const myResolved = requestsList.filter(r => r.creator === userId && !r.acknowledged && (r.status === 'approved' || r.status === 'rejected'));
  
  if (myResolved.length > 0) {
    // Schedule a small delay to not block rendering
    setTimeout(() => {
      myResolved.forEach(req => {
        const reqTypeLabel = req.requestType === 'delete' ? 'DELETE' : 'AMEND/EDIT';
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
      });
      localStorage.setItem("gl_amendment_requests", JSON.stringify(requestsList));
    }, 100);
  }

  const btnGotoAir = document.getElementById("btn-goto-air");
  const btnGotoSea = document.getElementById("btn-goto-sea");

  if (btnGotoAir && btnGotoSea) {
    btnGotoAir.style.display = "flex";
    btnGotoSea.style.display = "flex";
  }

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

  // Render Table
  const tbody = document.getElementById("user-quotes-body");
  if (!tbody) return;
  tbody.innerHTML = "";

  if (myQuotes.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-dim); padding: 2rem;">No enquiries priced yet. Click a button above to start pricing.</td></tr>`;
    return;
  }

  // Newest first
  const sortedQuotes = [...myQuotes].reverse();

  sortedQuotes.forEach(quote => {
    const tr = document.createElement("tr");
    tr.setAttribute("data-quote-id", quote.id);
    const currencySym = quote.currency === 'INR' ? '₹' : (quote.currency === 'USD' ? '$' : (quote.currency === 'EUR' ? '€' : '£'));
    const quoteAmount = `${currencySym}${quote.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
    
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
      <td>${quoteAmount}</td>
      <td><span class="status-badge ${quote.status}">${statusLabel}</span></td>
      <td class="actions-cell">
        <button class="action-icon-btn amend" style="background: ${quote.amendmentAllowed ? 'rgba(245, 158, 11, 0.25)' : 'rgba(255,255,255,0.05)'}; color: ${quote.amendmentAllowed ? 'var(--accent-warning)' : 'var(--text-dim)'};" title="${quote.amendmentAllowed ? 'Correct / Amend Quote (Unlocked)' : 'Request Admin Permission to Correct/Amend'}" onclick="amendQuote('${quote.id}')">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
        </button>
        <button class="action-icon-btn view" title="View/Print Quote" onclick="viewSavedQuote('${quote.id}')">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
        </button>
        ${isQuoted ? `
        <button class="action-icon-btn convert" style="background: ${quote.amendmentAllowed ? 'rgba(74, 222, 128, 0.2)' : 'rgba(255,255,255,0.05)'}; color: ${quote.amendmentAllowed ? 'var(--accent-success)' : 'var(--text-dim)'};" title="${quote.amendmentAllowed ? 'Mark as Converted/Won (Unlocked)' : 'Request Admin Permission to Convert/Won'}" onclick="convertQuote('${quote.id}')">
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

  const desks = ['shashank', 'mahendra', 'jaya', 'cathrina'];

  desks.forEach(deskId => {
    const deskQuotes = appState.quotes.filter(q => q.creator === deskId);
    const deskQuotesCount = deskQuotes.length;
    const deskConversions = deskQuotes.filter(q => q.status === 'converted').length;
    const deskRate = deskQuotesCount > 0 ? (deskConversions / deskQuotesCount * 100) : 0;
    const deskRevenue = deskQuotes.reduce((acc, q) => acc + q.amountINR, 0);

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><strong style="color:#fff;">${TEAM_ROLES[deskId].name}</strong></td>
      <td>${deskQuotesCount}</td>
      <td>${deskConversions}</td>
      <td>
        <span style="font-weight:700; color: ${deskRate >= 40 ? 'var(--accent-success)' : (deskRate >= 25 ? 'var(--accent-warning)' : 'var(--accent-error)')};">
          ${deskRate.toFixed(1)}%
        </span>
      </td>
      <td>₹${deskRevenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
    `;
    leadBody.appendChild(tr);
  });

  // Render Monthly CSS charts
  renderMonthlyCharts();

  // Render Master logs
  const tbody = document.getElementById("admin-quotes-body");
  tbody.innerHTML = "";

  if (appState.quotes.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-dim); padding: 2rem;">No enquiries loaded.</td></tr>`;
    return;
  }

  const sortedQuotes = [...appState.quotes].reverse();
  sortedQuotes.forEach(quote => {
    const tr = document.createElement("tr");
    tr.setAttribute("data-quote-id", quote.id);
    const currencySym = quote.currency === 'INR' ? '₹' : (quote.currency === 'USD' ? '$' : (quote.currency === 'EUR' ? '€' : '£'));
    const amountStr = `${currencySym}${quote.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
    const amountINRStr = `₹${quote.amountINR.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
    
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
      <td>
        <div>${amountStr}</div>
        ${quote.currency !== 'INR' ? `<div style="font-size:0.75rem; color:var(--text-dim);">${amountINRStr}</div>` : ''}
      </td>
      <td><span style="font-size:0.8rem; font-weight:600; color:var(--text-muted);">${TEAM_ROLES[quote.creator]?.name || quote.creator}</span></td>
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
        <button class="action-icon-btn convert" style="background: rgba(16, 185, 129, 0.2); color: var(--accent-success);" title="Revert to Original (Quoted)" onclick="revertQuoteToOriginal('${quote.id}')">
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

  // Render Amendment Requests List for Ganny
  const reqPanel = document.getElementById("admin-amendment-requests-panel");
  const reqList = document.getElementById("admin-amendment-requests-list");
  if (reqPanel && reqList) {
    let requests = [];
    const stored = localStorage.getItem("gl_amendment_requests");
    if (stored) {
      try { requests = JSON.parse(stored); } catch(e) {}
    }
    const pending = requests.filter(r => r.status === 'pending');
    
    if (pending.length > 0) {
      reqList.innerHTML = pending.map(req => `
        <div style="background: rgba(255,255,255,0.05); padding: 10px 12px; border-radius: 6px; border-left: 3px solid ${req.requestType === 'delete' ? 'var(--accent-error)' : 'var(--accent-warning)'}; display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
          <div>
            <strong style="color: ${req.requestType === 'delete' ? 'var(--accent-error)' : 'var(--accent-warning)'};">[${req.requestType ? req.requestType.toUpperCase() : 'EDIT'}]</strong> 
            <strong>Quote ID: #${getQuoteRefIdById(req.quoteId)}</strong> (${req.customer})<br>
            <span style="font-size: 0.75rem; color: var(--text-muted);">Requested by: ${req.creatorName} on ${req.date}</span>
          </div>
          <div style="display: flex; gap: 0.5rem;">
            <button class="btn-primary" style="padding: 4px 10px; font-size: 0.75rem; background: var(--accent-success); color: #000; border: none; border-radius: 4px; cursor: pointer; font-weight:700;" onclick="approveAmendment('${req.id}')">Approve</button>
            <button class="btn-secondary" style="padding: 4px 10px; font-size: 0.75rem; background: var(--accent-error); color: #fff; border: none; border-radius: 4px; cursor: pointer;" onclick="rejectAmendment('${req.id}')">Reject</button>
          </div>
        </div>
      `).join("");
    } else {
      reqList.innerHTML = `<div style="color: var(--text-dim); font-style: italic;">No pending approval requests.</div>`;
    }
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
    const isAir = quote.mode === 'air';
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
  const container = document.getElementById("admin-charts-container");
  container.innerHTML = "";

  // Group quotes by Month (for Jan - July 2026)
  const months = [
    { name: 'Jan 26', key: '2026-01' },
    { name: 'Feb 26', key: '2026-02' },
    { name: 'Mar 26', key: '2026-03' },
    { name: 'Apr 26', key: '2026-04' },
    { name: 'May 26', key: '2026-05' },
    { name: 'Jun 26', key: '2026-06' },
    { name: 'Jul 26', key: '2026-07' }
  ];

  // Find max quotes to scale CSS heights
  let maxQuotes = 5;
  months.forEach(m => {
    const count = appState.quotes.filter(q => q.date.startsWith(m.key)).length;
    if (count > maxQuotes) maxQuotes = count;
  });

  months.forEach(m => {
    const monthlyQuotes = appState.quotes.filter(q => q.date.startsWith(m.key));
    const quotesCount = monthlyQuotes.length;
    const conversionsCount = monthlyQuotes.filter(q => q.status === 'converted').length;

    const fillQuoteWidth = quotesCount > 0 ? (quotesCount / maxQuotes * 100) : 0;
    const fillConvWidth = quotesCount > 0 ? (conversionsCount / maxQuotes * 100) : 0;

    const row = document.createElement("div");
    row.className = "chart-bar-row";
    row.innerHTML = `
      <div class="chart-bar-labels">
        <span>${m.name}</span>
        <span style="color:var(--text-muted);">${quotesCount} Enquiries / ${conversionsCount} Won</span>
      </div>
      <div class="chart-bar-wrapper">
        <div class="chart-bar-fill" style="width: ${fillQuoteWidth}%; position: absolute; left:0; top:0; z-index:1;"></div>
        <div class="chart-bar-fill conversions" style="width: ${fillConvWidth}%; position: absolute; left:0; top:0; z-index:2; height: 100%;"></div>
      </div>
    `;
    container.appendChild(row);
  });
}

// CONVERT QUOTE ACTION
window.convertQuote = (id) => {
  const quote = appState.quotes.find(q => q.id === id);
  if (!quote) return;

  if (!checkAndRequestEditPermission(quote, "convert")) return;

  if (confirm(`Mark quotation for "${quote.customer}" as CONVERTED (Won Booking)?`)) {
    quote.status = 'converted';
    quote.conversionDate = new Date().toISOString().split('T')[0];
    quote.date = new Date().toISOString().split('T')[0]; // Update execution date
    DB.saveQuote(quote);
    
    // Confirmation intimation alert to Cathrina (NRS)
    if (quote.creator === 'shashank' || quote.creator === 'mahendra') {
      let alerts = [];
      const stored = localStorage.getItem("nrs_alerts");
      if (stored) {
        try { alerts = JSON.parse(stored); } catch (e) { alerts = []; }
      }
      alerts.push({
        id: 'A' + Math.random().toString(36).substr(2, 9),
        date: new Date().toLocaleTimeString() + " " + new Date().toLocaleDateString(),
        message: `Booking Confirmed: Customer "${quote.customer}" (${quote.route}) prepared by ${TEAM_ROLES[quote.creator]?.name || quote.creator}.`
      });
      localStorage.setItem("nrs_alerts", JSON.stringify(alerts));
    }
    
    alert("Enquiry status updated successfully!");
    
    // Refresh active panel
    if (appState.currentUser === 'ganny') {
      renderAdminDashboard();
    } else {
      renderMemberDashboard(appState.currentUser);
    }
  }
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

  // Group stats by member for summary grids
  const members = ['shashank', 'mahendra', 'jaya', 'cathrina'];
  let breakdownRows = "";

  members.forEach(mId => {
    // Skip if filter is set to specific officer and not this one
    if (officer !== 'all' && officer !== mId) return;

    const deskQuotes = filtered.filter(q => q.creator === mId);
    const dCount = deskQuotes.length;
    const dConv = deskQuotes.filter(q => q.status === 'converted').length;
    const dRate = dCount > 0 ? (dConv / dCount * 100) : 0;
    const dRevenue = deskQuotes.reduce((acc, q) => acc + q.amountINR, 0);

    breakdownRows += `
      <tr>
        <td><strong>${TEAM_ROLES[mId].name}</strong></td>
        <td>${dCount}</td>
        <td>${dConv}</td>
        <td><strong>${dRate.toFixed(1)}%</strong></td>
        <td>₹${dRevenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
      </tr>
    `;
  });

  // Detailed Quote logs for print
  let detailRowsList = "";
  if (filtered.length > 0) {
    filtered.forEach(q => {
      const curSym = q.currency === 'INR' ? '₹' : (q.currency === 'USD' ? '$' : (q.currency === 'EUR' ? '€' : '£'));
      detailRowsList += `
        <tr>
          <td>#${getQuoteRefId(q)}</td>
          <td>${q.date}</td>
          <td><span style="text-transform:uppercase; font-size:0.8rem; font-weight:700;">${q.type}</span></td>
          <td>${q.customer}<br><span style="font-size:0.75rem; color:#666;">${q.route}</span></td>
          <td>${TEAM_ROLES[q.creator]?.name || q.creator}</td>
          <td>${q.status === 'converted' ? 'Won Converted' : 'Quoted'}</td>
          <td>${curSym}${q.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
        </tr>
      `;
    });
  } else {
    detailRowsList = `<tr><td colspan="7" style="text-align:center; color:#666; font-style:italic;">No quote transactions recorded in this timeframe</td></tr>`;
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
        <div>Scope: ${officer === 'all' ? 'Consolidated Desks' : TEAM_ROLES[officer].name}</div>
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

    <div style="display:grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 1.5rem; margin-top: 1rem;">
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

  saveCustomCustomer(customerName);

  let quoteData = {
    id: 'Q' + Math.random().toString(36).substr(2, 9),
    date: new Date().toISOString().split('T')[0],
    customer: customerName,
    creator: appState.currentUser, // Logged in team member
    status: 'quoted',
    quoteNumber: appState.quotes.length + 1
  };

  if (isAir) {
    const originVal = document.getElementById("air-origin").value.trim();
    const destVal = document.getElementById("air-dest").value.trim();
    const airlineVal = document.getElementById("air-airline").value.trim();
    const incoterm = document.getElementById("air-incoterm").value;
    const routing = document.getElementById("air-routing").value.trim();
    const tt = document.getElementById("air-tt").value.trim();
    const validity = document.getElementById("air-validity").value.trim();
    
    if (!originVal) { alert("Please fill in Origin Airport."); return; }
    if (!destVal) { alert("Please fill in Destination Airport."); return; }
    if (!airlineVal) { alert("Please fill in Carrier / Airline."); return; }
    if (!routing) { alert("Please fill in Routing Details."); return; }
    if (!tt) { alert("Please fill in Transit Time (TT)."); return; }
    if (!validity) { alert("Please fill in Quote Validity."); return; }

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

    if (appState.currentAirFreight.appliedRate <= 0) {
      alert("Please enter a valid rate for the active weight break under Tariffs.");
      return;
    }

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

    const origin = originVal.split(" - ")[0];
    const dest = destVal.split(" - ")[0];
    const airline = airlineVal.split(" - ")[0];

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
      airline: document.getElementById("air-airline").value,
      incoterm: incoterm,
      module: appState.currentAirFreight.module || 'export',
      termsAndConditions: document.getElementById("air-terms").value.trim() || DEFAULT_AIR_TERMS,
      chargeableWeight: appState.currentAirFreight.chargeableWeight,
      grossWeight: appState.currentAirFreight.grossWeight,
      volumeWeight: appState.currentAirFreight.volumeWeight,
      cbm: appState.currentAirFreight.cbm,
      quantity: appState.currentAirFreight.quantity,
      appliedRate: appState.currentAirFreight.appliedRate,
      baseFreight: appState.currentAirFreight.baseFreight,
      originSurcharges: appState.currentAirFreight.originSurcharges,
      destSurcharges: appState.currentAirFreight.destSurcharges,
      surcharges: appState.currentAirFreight.surchargesCalculated,
      surchargeTotal: appState.currentAirFreight.surchargeTotal,
      pivotWeight: appState.currentAirFreight.pivotWeight,
      routing: routing,
      tt: tt,
      validity: validity,
      cargoItems: cargoItems
    };
  } else {
    const originVal = document.getElementById("sea-origin").value.trim();
    const destVal = document.getElementById("sea-dest").value.trim();
    const shippingLineVal = document.getElementById("sea-line").value.trim();
    const incoterm = document.getElementById("sea-incoterm").value;
    const grossWeight = parseFloat(document.getElementById("sea-gross-weight").value) || 0;
    const volume = parseFloat(document.getElementById("sea-volume").value) || 0;
    const pkgQty = parseFloat(document.getElementById("sea-pkg-qty").value) || 0;
    const routing = document.getElementById("sea-routing").value.trim();
    const tt = document.getElementById("sea-tt").value.trim();
    const validity = document.getElementById("sea-validity").value.trim();

    if (!originVal) { alert("Please fill in Port of Loading (POL)."); return; }
    if (!destVal) { alert("Please fill in Port of Discharge (POD)."); return; }
    if (!shippingLineVal) { alert("Please fill in Shipping Carrier (Line)."); return; }
    if (grossWeight <= 0) { alert("Please enter Total Gross Weight greater than zero."); return; }
    if (volume <= 0) { alert("Please enter Total Volume (CBM) greater than zero."); return; }
    if (pkgQty <= 0) { alert("Please enter Total Package Quantity greater than zero."); return; }
    if (!routing) { alert("Please fill in Routing Details."); return; }
    if (!tt) { alert("Please fill in Transit Time (TT)."); return; }
    if (!validity) { alert("Please fill in Quote Validity."); return; }

    const origin = originVal.split(" - ")[0];
    const dest = destVal.split(" - ")[0];
    const shippingLine = shippingLineVal;

    const containerItems = [];
    if (appState.currentSeaFreight.type === 'fcl') {
      const fclRows = document.querySelectorAll("#sea-fcl-body .container-row");
      if (fclRows.length === 0) {
        alert("Please add at least one Container Line for FCL ocean freight.");
        return;
      }
      let hasInvalidFcl = false;
      fclRows.forEach(row => {
        const type = row.querySelector(".fcl-type").value;
        const qty = parseInt(row.querySelector(".fcl-qty").value) || 0;
        const rate = parseFloat(row.querySelector(".fcl-rate").value) || 0;
        if (qty <= 0 || rate <= 0) {
          hasInvalidFcl = true;
        } else {
          containerItems.push({ type, qty, rate });
        }
      });
      if (hasInvalidFcl) {
        alert("Please fill in Container Quantity and Rate per Container for all container rows.");
        return;
      }
    }

    const cargoItems = [];
    const rows = document.querySelectorAll("#sea-cargo-body .sea-cargo-item-row");
    if (appState.currentSeaFreight.type === 'lcl') {
      const lclRate = parseFloat(document.getElementById("sea-lcl-rate").value) || 0;
      if (lclRate <= 0) {
        alert("Please enter LCL Freight Rate per Revenue Ton (RT) greater than zero.");
        return;
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
      const bbRate = parseFloat(document.getElementById("sea-bb-rate").value) || 0;
      if (bbRate <= 0) {
        alert("Please enter Break Bulk Ocean Rate per Revenue Ton (RT) greater than zero.");
        return;
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

    quoteData.type = "sea";
    quoteData.route = `${origin} → ${dest} (${appState.currentSeaFreight.type.toUpperCase()}) ${shippingLine ? `via ${shippingLine}` : ''}`;
    quoteData.amount = appState.currentSeaFreight.grandTotal;
    quoteData.amountINR = appState.currentSeaFreight.grandTotalINR;
    quoteData.currency = appState.currentSeaFreight.currency;
    quoteData.details = {
      origin: document.getElementById("sea-origin").value,
      destination: document.getElementById("sea-dest").value,
      shippingLine: shippingLine,
      incoterm: incoterm,
      mode: appState.currentSeaFreight.type,
      module: appState.currentSeaFreight.module || 'export',
      termsAndConditions: document.getElementById("sea-terms").value.trim() || DEFAULT_SEA_TERMS,
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
      lclRateApplied: parseFloat(document.getElementById("sea-lcl-rate").value) || 0,
      bbRateApplied: parseFloat(document.getElementById("sea-bb-rate").value) || 0,
      containerItems: containerItems,
      cargoItems: cargoItems,
      dimUnit: appState.currentSeaFreight.dimUnit || 'cms',
      routing: routing,
      tt: tt,
      validity: validity,
      stuffingOption: (document.getElementById("sea-fcl-stuffing-container")?.style.display !== 'none' && document.getElementById("sea-fcl-stuffing")) ? document.getElementById("sea-fcl-stuffing").value : null
    };
  }

  if (!isAir) {
    const originVal = document.getElementById("sea-origin").value.trim();
    const destVal = document.getElementById("sea-dest").value.trim();
    const lineVal = document.getElementById("sea-line").value.trim();
    saveCustomSeaAutocompletes(originVal, destVal, lineVal);
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
    document.getElementById("sea-origin").value = "";
    document.getElementById("sea-dest").value = "";
    document.getElementById("sea-line").value = "";
    document.getElementById("sea-incoterm").value = "EXW";
    document.getElementById("sea-gross-weight").value = "0";
    document.getElementById("sea-volume").value = "0";
    document.getElementById("sea-pkg-qty").value = "0";
    document.getElementById("sea-lcl-rate").value = "0";
    document.getElementById("sea-bb-rate").value = "0";
    const fclBody = document.getElementById("sea-fcl-body");
    if (fclBody) {
      fclBody.innerHTML = "";
      addFclContainerRow("20'GP", 1, 0);
    }
  }
  
  resetSurchargesToDefaults();
  
  alert("Quotation successfully saved to database!");
  returnToWorkspace();
}

function resetSurchargesToDefaults() {
  const airOriginBody = document.getElementById("air-origin-surcharges-body");
  if (airOriginBody) {
    airOriginBody.innerHTML = `
      <tr>
        <td><input type="text" class="chg-name" value="Fuel Surcharge (MYC)" required></td>
        <td><input type="number" class="chg-rate" value="0.00" step="0.01" required></td>
        <td>
          <select class="chg-unit">
            <option value="kg" selected>Per kg</option>
            <option value="flat">Flat</option>
          </select>
        </td>
        <td>
          <button type="button" class="delete-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/></svg>
          </button>
        </td>
      </tr>
      <tr>
        <td><input type="text" class="chg-name" value="Security Surcharge (SCC)" required></td>
        <td><input type="number" class="chg-rate" value="0.00" step="0.01" required></td>
        <td>
          <select class="chg-unit">
            <option value="kg" selected>Per kg</option>
            <option value="flat">Flat</option>
          </select>
        </td>
        <td>
          <button type="button" class="delete-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/></svg>
          </button>
        </td>
      </tr>
      <tr>
        <td><input type="text" class="chg-name" value="XRAY Surcharge (XRAY)" required></td>
        <td><input type="number" class="chg-rate" value="0.00" step="0.01" required></td>
        <td>
          <select class="chg-unit">
            <option value="kg" selected>Per kg</option>
            <option value="flat">Flat</option>
          </select>
        </td>
        <td>
          <button type="button" class="delete-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/></svg>
          </button>
        </td>
      </tr>
      <tr>
        <td><input type="text" class="chg-name" value="AMS fee (Per MAWB)" required></td>
        <td><input type="number" class="chg-rate" value="0.00" step="0.01" required></td>
        <td>
          <select class="chg-unit">
            <option value="flat" selected>Flat</option>
            <option value="kg">Per kg</option>
          </select>
        </td>
        <td>
          <button type="button" class="delete-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/></svg>
          </button>
        </td>
      </tr>
      <tr>
        <td><input type="text" class="chg-name" value="AWB fee (AWB)" required></td>
        <td><input type="number" class="chg-rate" value="0.00" step="0.01" required></td>
        <td>
          <select class="chg-unit">
            <option value="flat" selected>Flat</option>
            <option value="kg">Per kg</option>
          </select>
        </td>
        <td>
          <button type="button" class="delete-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/></svg>
          </button>
        </td>
      </tr>
    `;
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
        <td>
          <select class="chg-unit" style="background: rgba(255,255,255,0.05); border: 1px solid var(--border-color); color: #fff; padding: 4px 8px; border-radius: 4px; width: 100%;">
            <option value="flat">Flat Fee</option>
            <option value="container" selected>Per Container</option>
            <option value="rt">Per RT (Revenue Ton)</option>
            <option value="kg">Per Kg (Gross Weight)</option>
          </select>
        </td>
        <td>
          <button type="button" class="delete-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/></svg>
          </button>
        </td>
      </tr>
      <tr>
        <td><input type="text" class="chg-name" value="Documentation Fee" required></td>
        <td><input type="number" class="chg-rate" value="0.00" step="0.01" required></td>
        <td>
          <select class="chg-unit" style="background: rgba(255,255,255,0.05); border: 1px solid var(--border-color); color: #fff; padding: 4px 8px; border-radius: 4px; width: 100%;">
            <option value="flat" selected>Flat Fee</option>
            <option value="container">Per Container</option>
            <option value="rt">Per RT (Revenue Ton)</option>
            <option value="kg">Per Kg (Gross Weight)</option>
          </select>
        </td>
        <td>
          <button type="button" class="delete-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/></svg>
          </button>
        </td>
      </tr>
    `;
  } else if (mode === 'lcl') {
    originRows = `
      <tr>
        <td><input type="text" class="chg-name" value="Terminal Handling Charges (THC)" required></td>
        <td><input type="number" class="chg-rate" value="0.00" step="0.01" required></td>
        <td>
          <select class="chg-unit" style="background: rgba(255,255,255,0.05); border: 1px solid var(--border-color); color: #fff; padding: 4px 8px; border-radius: 4px; width: 100%;">
            <option value="flat">Flat Fee</option>
            <option value="container">Per Container</option>
            <option value="rt" selected>Per RT (Revenue Ton)</option>
            <option value="kg">Per Kg (Gross Weight)</option>
          </select>
        </td>
        <td>
          <button type="button" class="delete-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/></svg>
          </button>
        </td>
      </tr>
      <tr>
        <td><input type="text" class="chg-name" value="Documentation Fee" required></td>
        <td><input type="number" class="chg-rate" value="0.00" step="0.01" required></td>
        <td>
          <select class="chg-unit" style="background: rgba(255,255,255,0.05); border: 1px solid var(--border-color); color: #fff; padding: 4px 8px; border-radius: 4px; width: 100%;">
            <option value="flat" selected>Flat Fee</option>
            <option value="container">Per Container</option>
            <option value="rt">Per RT (Revenue Ton)</option>
            <option value="kg">Per Kg (Gross Weight)</option>
          </select>
        </td>
        <td>
          <button type="button" class="delete-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/></svg>
          </button>
        </td>
      </tr>
      <tr>
        <td><input type="text" class="chg-name" value="Port Handling Charges" required></td>
        <td><input type="number" class="chg-rate" value="0.00" step="0.01" required></td>
        <td>
          <select class="chg-unit" style="background: rgba(255,255,255,0.05); border: 1px solid var(--border-color); color: #fff; padding: 4px 8px; border-radius: 4px; width: 100%;">
            <option value="flat">Flat Fee</option>
            <option value="container">Per Container</option>
            <option value="rt" selected>Per RT (Revenue Ton)</option>
            <option value="kg">Per Kg (Gross Weight)</option>
          </select>
        </td>
        <td>
          <button type="button" class="delete-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/></svg>
          </button>
        </td>
      </tr>
    `;
  } else if (mode === 'bb') {
    originRows = `
      <tr>
        <td><input type="text" class="chg-name" value="Lashing & Securing" required></td>
        <td><input type="number" class="chg-rate" value="0.00" step="0.01" required></td>
        <td>
          <select class="chg-unit" style="background: rgba(255,255,255,0.05); border: 1px solid var(--border-color); color: #fff; padding: 4px 8px; border-radius: 4px; width: 100%;">
            <option value="flat">Flat Fee</option>
            <option value="container">Per Container</option>
            <option value="rt" selected>Per RT (Revenue Ton)</option>
            <option value="kg">Per Kg (Gross Weight)</option>
          </select>
        </td>
        <td>
          <button type="button" class="delete-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/></svg>
          </button>
        </td>
      </tr>
      <tr>
        <td><input type="text" class="chg-name" value="Stevedoring" required></td>
        <td><input type="number" class="chg-rate" value="0.00" step="0.01" required></td>
        <td>
          <select class="chg-unit" style="background: rgba(255,255,255,0.05); border: 1px solid var(--border-color); color: #fff; padding: 4px 8px; border-radius: 4px; width: 100%;">
            <option value="flat">Flat Fee</option>
            <option value="container">Per Container</option>
            <option value="rt" selected>Per RT (Revenue Ton)</option>
            <option value="kg">Per Kg (Gross Weight)</option>
          </select>
        </td>
        <td>
          <button type="button" class="delete-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/></svg>
          </button>
        </td>
      </tr>
      <tr>
        <td><input type="text" class="chg-name" value="Port Handling" required></td>
        <td><input type="number" class="chg-rate" value="0.00" step="0.01" required></td>
        <td>
          <select class="chg-unit" style="background: rgba(255,255,255,0.05); border: 1px solid var(--border-color); color: #fff; padding: 4px 8px; border-radius: 4px; width: 100%;">
            <option value="flat">Flat Fee</option>
            <option value="container">Per Container</option>
            <option value="rt" selected>Per RT (Revenue Ton)</option>
            <option value="kg">Per Kg (Gross Weight)</option>
          </select>
        </td>
        <td>
          <button type="button" class="delete-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/></svg>
          </button>
        </td>
      <tr>
        <td><input type="text" class="chg-name" value="Wharfage" required></td>
        <td><input type="number" class="chg-rate" value="0.00" step="0.01" required></td>
        <td>
          <select class="chg-unit" style="background: rgba(255,255,255,0.05); border: 1px solid var(--border-color); color: #fff; padding: 4px 8px; border-radius: 4px; width: 100%;">
            <option value="flat">Flat Fee</option>
            <option value="container">Per Container</option>
            <option value="rt" selected>Per RT (Revenue Ton)</option>
            <option value="kg">Per Kg (Gross Weight)</option>
          </select>
        </td>
        <td>
          <button type="button" class="delete-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/></svg>
          </button>
        </td>
      </tr>
      <tr>
        <td><input type="text" class="chg-name" value="Craneage" required></td>
        <td><input type="number" class="chg-rate" value="0.00" step="0.01" required></td>
        <td>
          <select class="chg-unit" style="background: rgba(255,255,255,0.05); border: 1px solid var(--border-color); color: #fff; padding: 4px 8px; border-radius: 4px; width: 100%;">
            <option value="flat">Flat Fee</option>
            <option value="container">Per Container</option>
            <option value="rt" selected>Per RT (Revenue Ton)</option>
            <option value="kg">Per Kg (Gross Weight)</option>
          </select>
        </td>
        <td>
          <button type="button" class="delete-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/></svg>
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
      "Fuel Surcharge (MYC)",
      "Security Surcharge (SCC)",
      "XRAY Surcharge (XRAY)",
      "AMS fee (Per MAWB)",
      "AWB fee (AWB)"
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

window.handleLogin = handleLogin;
window.logoutUser = logoutUser;
window.openActiveCalculator = openActiveCalculator;
window.returnToWorkspace = returnToWorkspace;
window.generatePerformanceReport = generatePerformanceReport;

window.viewSavedQuote = (id) => {
  const quote = appState.quotes.find(q => q.id === id);
  if (!quote) return;

  const isAir = quote.type === 'air';
  const currencySym = quote.currency === 'INR' ? '₹' : (quote.currency === 'USD' ? '$' : (quote.currency === 'EUR' ? '€' : '£'));
  
  let detailsRows = "";
  if (isAir) {
    detailsRows = `
      <tr><td>Air Freight Desk Module</td><td><strong>Air ${quote.details.module === 'import' ? 'Import' : 'Export'}</strong></td></tr>
      <tr><td>Origin Airport</td><td>${quote.details.origin || 'BOM'}</td></tr>
      <tr><td>Destination Airport</td><td>${quote.details.destination || 'JFK'}</td></tr>
      <tr><td>Airline</td><td>${quote.details.airline || 'N/A'}</td></tr>
      <tr><td>Incoterm</td><td><strong>${quote.details.incoterm || 'EXW'}</strong></td></tr>
      <tr><td>Actual Gross Weight</td><td>${(quote.details.grossWeight || 0).toFixed(2)} kg</td></tr>
      <tr><td>Total Package Quantity</td><td>${quote.details.quantity || 'N/A'} Pkgs</td></tr>
      <tr><td>Volume Weight</td><td>${(quote.details.volumeWeight || 0).toFixed(2)} kg</td></tr>
      <tr><td>Volume (CBM)</td><td>${(quote.details.cbm || 0).toFixed(3)} CBM</td></tr>
      <tr><td>Chargeable Weight</td><td>${(quote.details.chargeableWeight || 0).toFixed(2)} kg</td></tr>
      ${quote.details.pivotWeight ? `<tr><td>Pivot Weight</td><td>${quote.details.pivotWeight.toFixed(2)} kg</td></tr>` : ''}
      <tr><td>Routing</td><td>${quote.details.routing || 'Direct'}</td></tr>
      <tr><td>Transit Time (TT)</td><td>${quote.details.tt || 'N/A'}</td></tr>
      <tr><td>Validity</td><td>${quote.details.validity || 'N/A'}</td></tr>
      <tr><td>Base Freight Rate</td><td>${currencySym}${(quote.details.appliedRate || 0).toFixed(2)} / kg</td></tr>
      <tr><td>Base Ocean/Air Freight</td><td>${currencySym}${(quote.details.baseFreight || 0).toFixed(2)}</td></tr>
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

  const printCard = document.getElementById("quote-print-card");
  document.getElementById("modal-header-title").textContent = "Quotation Official Preview";
  
  printCard.innerHTML = `
    <div class="print-header" style="display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #333; padding-bottom: 1.5rem; margin-bottom: 1.5rem;">
      <div style="display: flex; align-items: center; gap: 0.6rem;">
        <img src="logo.png" alt="Vertex Logo" style="height: 50px; width: 50px; object-fit: contain; border-radius: 50%;">
        <div>
          <div class="print-logo" style="font-size: 1.5rem; font-weight: 800; color: #2f3193; line-height: 1.1;">Vertex</div>
          <div style="font-size: 0.75rem; color: #64748b; font-weight: 600;">Atlas Pricing</div>
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
    
    <div class="print-section-title">Origin Local Surcharges & Fees</div>
    <table>
      <thead>
        <tr><th>Charge Element</th><th>Chargeable Amount</th></tr>
      </thead>
      <tbody>
        ${originSurchargeRows}
      </tbody>
    </table>
    
    <div class="print-section-title">Destination Local Surcharges & Fees</div>
    <table>
      <thead>
        <tr><th>Charge Element</th><th>Chargeable Amount</th></tr>
      </thead>
      <tbody>
        ${destSurchargeRows}
      </tbody>
    </table>
    
    <div class="total-summary-box">
      <strong>GRAND TOTAL FREIGHT CHARGES (EXCLUDING LOCAL TAXES):</strong>
      <span class="val">${currencySym}${quote.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
    </div>

    <div class="print-section-title" style="margin-top: 1.5rem; font-size: 0.85rem; font-weight: 800; border-bottom: 1px solid #ddd; padding-bottom: 0.25rem;">Standard Terms & Conditions</div>
    <ol style="font-size: 0.72rem; color: #bbb; line-height: 1.5; padding-left: 1.2rem; margin: 0.5rem 0 1.5rem 0; font-family: sans-serif; text-align: left;">
      ${termsList}
    </ol>
    
    <div class="footer-note" style="border-top: 1px solid rgba(255,255,255,0.05); padding-top: 0.5rem; font-size: 0.65rem; color: var(--text-dim); text-align: center;">
      This quote is valid for 15 days from the date of issue and is subject to space and equipment availability.
      Thank you for choosing Global Logistics!
    </div>
  `;

  showQuoteModal();
};

window.deleteQuote = (id) => {
  const quote = appState.quotes.find(q => q.id === id);
  if (!quote) return;

  // Enforce Ganny or deletionAllowed permission check
  if (appState.currentUser !== 'ganny' && !quote.deletionAllowed) {
    let requests = [];
    const stored = localStorage.getItem("gl_amendment_requests");
    if (stored) {
      try { requests = JSON.parse(stored); } catch(e) {}
    }
    const pending = requests.find(r => r.quoteId === quote.id && r.requestType === 'delete' && r.status === 'pending');
    if (pending) {
      alert("You have already requested permission to delete this quote. Please wait for Ganny's approval.");
      return;
    }
    
    if (confirm("You do not have permission to delete this quotation. Request deletion permission from Admin (Ganny)?")) {
      requests.push({
        id: 'REQ' + Math.random().toString(36).substr(2, 9),
        requestType: 'delete',
        quoteId: quote.id,
        customer: quote.customer,
        creator: quote.creator,
        creatorName: TEAM_ROLES[quote.creator]?.name || quote.creator,
        date: new Date().toLocaleDateString() + " " + new Date().toLocaleTimeString(),
        status: 'pending',
        acknowledged: false
      });
      localStorage.setItem("gl_amendment_requests", JSON.stringify(requests));
      alert("Deletion request submitted successfully to Ganny.");
      
      renderMemberDashboard(appState.currentUser);
    }
    return;
  }

  if (confirm(`Are you sure you want to delete quote for "${quote.customer}"?`)) {
    DB.deleteQuote(id);
    
    // Remove related requests
    let requests = [];
    const stored = localStorage.getItem("gl_amendment_requests");
    if (stored) {
      try { requests = JSON.parse(stored); } catch(e) {}
    }
    requests = requests.filter(r => r.quoteId !== id);
    localStorage.setItem("gl_amendment_requests", JSON.stringify(requests));

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
  document.getElementById("quote-modal").classList.remove("show");
}

function printQuote() {
  window.print();
}

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
    let buttonsHtml = `<button class="role-btn active" data-role="manager">${TEAM_ROLES['ganny'].name}</button>`;
    buttonsHtml += `<button class="role-btn" data-role="shashank"><svg width="11" height="11" style="margin-right:4px; display:inline-block; vertical-align:middle;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-4 4H3l-2 3 3-2v-2l4-4 3.5 5.3c.3.4.8.5 1.3.3l.5-.3c.4-.2.6-.6.5-1.1z"/></svg>${TEAM_ROLES['shashank'].name}</button>`;
    buttonsHtml += `<button class="role-btn" data-role="mahendra"><svg width="11" height="11" style="margin-right:4px; display:inline-block; vertical-align:middle;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M2 21h20M19.3 14.8C18 13.5 16 13.5 14.7 14.8L12 17.5l-2.7-2.7C8 13.5 6 13.5 4.7 14.8L2 17.5V19h20v-1.5l-2.7-2.7zM12 2v10M12 2l-3 3M12 2l3 3"/></svg>${TEAM_ROLES['mahendra'].name}</button>`;
    buttonsHtml += `<button class="role-btn" data-role="jaya">${TEAM_ROLES['jaya'].name}</button>`;
    buttonsHtml += `<button class="role-btn" data-role="cathrina">${TEAM_ROLES['cathrina'].name}</button>`;
    
    // Add custom registered users
    let customUsers = [];
    const stored = localStorage.getItem("gl_custom_users");
    if (stored) {
      try { customUsers = JSON.parse(stored); } catch(e) {}
    }
    customUsers.forEach(u => {
      const lower = u.username.toLowerCase();
      buttonsHtml += `<button class="role-btn" data-role="${lower}">${u.fullName.split(" ")[0]} (Free Hand)</button>`;
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
    if (activeUserName) activeUserName.textContent = TEAM_ROLES[activeUser]?.name || activeUser;
  }

  // Update report user dropdown options
  const optShashank = document.getElementById("opt-shashank");
  if (optShashank) optShashank.textContent = TEAM_ROLES['shashank'].name;

  const optMahendra = document.getElementById("opt-mahendra");
  if (optMahendra) optMahendra.textContent = TEAM_ROLES['mahendra'].name;

  const optJaya = document.getElementById("opt-jaya");
  if (optJaya) optJaya.textContent = TEAM_ROLES['jaya'].name;

  const optCathrina = document.getElementById("opt-cathrina");
  if (optCathrina) optCathrina.textContent = TEAM_ROLES['cathrina'].name;

  // Update text inputs on config forms
  const cfgShashank = document.getElementById("cfg-shashank");
  if (cfgShashank) cfgShashank.value = TEAM_ROLES['shashank'].name;

  const cfgMahendra = document.getElementById("cfg-mahendra");
  if (cfgMahendra) cfgMahendra.value = TEAM_ROLES['mahendra'].name;

  const cfgJaya = document.getElementById("cfg-jaya");
  if (cfgJaya) cfgJaya.value = TEAM_ROLES['jaya'].name;

  const cfgCathrina = document.getElementById("cfg-cathrina");
  if (cfgCathrina) cfgCathrina.value = TEAM_ROLES['cathrina'].name;

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
  const mahendra = document.getElementById("cfg-mahendra").value.trim();
  const jaya = document.getElementById("cfg-jaya").value.trim();
  const cathrina = document.getElementById("cfg-cathrina").value.trim();

  if (!shashank || !mahendra || !jaya || !cathrina) {
    alert("Please fill out all category names.");
    return;
  }

  TEAM_ROLES['shashank'].name = shashank;
  TEAM_ROLES['mahendra'].name = mahendra;
  TEAM_ROLES['jaya'].name = jaya;
  TEAM_ROLES['cathrina'].name = cathrina;

  const names = {
    'shashank': shashank,
    'mahendra': mahendra,
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
        const parsed = JSON.parse(rawVal);
        if (!parsed.apiKey || !parsed.projectId) {
          alert("Firebase Config JSON must contain at least 'apiKey' and 'projectId' fields.");
          return;
        }
        localStorage.setItem("gl_firebase_config", rawVal);
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
    alert("Settings saved successfully! Page will now reload to establish the Firebase Cloud connection.");
    window.location.reload();
  } else {
    alert("Desk names & API Settings updated successfully!");
  }
}

window.saveDeskNames = saveDeskNames;
window.applyDeskNames = applyDeskNames;

// ==================== NEW ADMIN / WORKFLOW ACTIONS ====================

function registerNewUserProfile(e) {
  e.preventDefault();
  const fullName = document.getElementById("reg-fullname").value.trim();
  const username = document.getElementById("reg-username").value.trim().toLowerCase();
  const password = document.getElementById("reg-password").value;
  
  if (username === 'admin' || username === 'ganny' || TEAM_ROLES[username]) {
    alert("This username is already taken. Please try another one.");
    return;
  }
  
  let customUsers = [];
  const stored = localStorage.getItem("gl_custom_users");
  if (stored) {
    try { customUsers = JSON.parse(stored); } catch(e) {}
  }
  
  customUsers.push({ fullName, username, password });
  localStorage.setItem("gl_custom_users", JSON.stringify(customUsers));
  
  // Register in current session roles
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
      <td>
        <button type="button" class="delete-btn" onclick="this.closest('tr').remove(); ${isAir ? 'calculateAirFreight()' : 'calculateSeaFreight()'};">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/></svg>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
    tr.querySelectorAll("input, select").forEach(inp => {
      inp.addEventListener("input", isAir ? calculateAirFreight : calculateSeaFreight);
    });
  });
}

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
    document.getElementById("air-airline").value = quote.details.airline || "";
    document.getElementById("air-incoterm").value = quote.details.incoterm || "EXW";
    document.getElementById("air-pivot-weight").value = quote.details.pivotWeight || "";
    document.getElementById("air-routing").value = quote.details.routing || "";
    document.getElementById("air-tt").value = quote.details.tt || "";
    document.getElementById("air-validity").value = quote.details.validity || "";
    document.getElementById("air-terms").value = quote.details.termsAndConditions || DEFAULT_AIR_TERMS;
    
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
    
    if (mode === 'fcl') {
      if (fclSection) fclSection.style.display = "block";
      if (lclSection) lclSection.style.display = "none";
      if (bbForm) bbForm.style.display = "none";
      appState.currentSeaFreight.type = "fcl";
      
      const fclBody = document.getElementById("sea-fcl-body");
      if (fclBody && quote.details.containerItems && quote.details.containerItems.length > 0) {
        fclBody.innerHTML = "";
        quote.details.containerItems.forEach(item => {
          const tr = document.createElement("tr");
          tr.className = "container-row";
          tr.innerHTML = `
            <td>
              <select class="fcl-type" style="padding: 0.25rem;">
                <option value="20' GP" ${item.type === "20' GP" ? 'selected' : ''}>20' GP Container</option>
                <option value="40' GP" ${item.type === "40' GP" ? 'selected' : ''}>40' GP Container</option>
                <option value="40' HC" ${item.type === "40' HC" ? 'selected' : ''}>40' HC Container</option>
                <option value="20' RF" ${item.type === "20' RF" ? 'selected' : ''}>20' RF Container (Reefer)</option>
                <option value="40' RF" ${item.type === "40' RF" ? 'selected' : ''}>40' RF Container (Reefer)</option>
                <option value="20' OT" ${item.type === "20' OT" ? 'selected' : ''}>20' OT Container (Open Top)</option>
                <option value="40' OT" ${item.type === "40' OT" ? 'selected' : ''}>40' OT Container (Open Top)</option>
                <option value="20' FR" ${item.type === "20' FR" ? 'selected' : ''}>20' FR Container (Flat Rack)</option>
                <option value="40' FR" ${item.type === "40' FR" ? 'selected' : ''}>40' FR Container (Flat Rack)</option>
              </select>
            </td>
            <td><input type="number" class="fcl-qty" min="1" placeholder="Qty" value="${item.qty}" style="width: 70px;"></td>
            <td><input type="number" class="fcl-rate" min="1" placeholder="Rate" value="${item.rate}" style="width: 100px;"></td>
            <td>
              <button type="button" class="delete-btn" onclick="this.closest('tr').remove(); calculateSeaFreight();">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/></svg>
              </button>
            </td>
          `;
          fclBody.appendChild(tr);
          tr.querySelectorAll("input, select").forEach(inp => {
            inp.addEventListener("input", calculateSeaFreight);
          });
        });
      }
    } else if (mode === 'lcl') {
      if (fclSection) fclSection.style.display = "none";
      if (lclSection) lclSection.style.display = "block";
      if (bbForm) bbForm.style.display = "none";
      appState.currentSeaFreight.type = "lcl";
      
      document.getElementById("sea-lcl-rate").value = quote.details.lclRateApplied || "";
    } else {
      if (fclSection) fclSection.style.display = "none";
      if (lclSection) lclSection.style.display = "none";
      if (bbForm) bbForm.style.display = "block";
      appState.currentSeaFreight.type = "bb";
      
      document.getElementById("sea-bb-rate").value = quote.details.bbRateApplied || "";
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

    repopulateSurchargesTable("sea-origin-surcharges-body", quote.details.originSurcharges);
    repopulateSurchargesTable("sea-dest-surcharges-body", quote.details.destSurcharges);
    
    calculateSeaFreight();
    alert(`Editing Quote #${getQuoteRefId(quote)} in progress. Click "Save Quote" to confirm your amendments.`);
  }
}
window.amendQuote = amendQuote;

function approveAmendment(reqId) {
  let requests = [];
  const stored = localStorage.getItem("gl_amendment_requests");
  if (stored) {
    try { requests = JSON.parse(stored); } catch(e) {}
  }
  const req = requests.find(r => r.id === reqId);
  if (req) {
    req.status = 'approved';
    
    // Unlock the quote
    const quote = appState.quotes.find(q => q.id === req.quoteId);
    if (quote) {
      if (req.requestType === 'delete') {
        quote.deletionAllowed = true;
      } else {
        quote.amendmentAllowed = true;
      }
    }
    
    localStorage.setItem("gl_amendment_requests", JSON.stringify(requests));
    if (quote) DB.saveQuote(quote);
    alert(`Request to ${req.requestType ? req.requestType.toUpperCase() : 'EDIT'} quote #${getQuoteRefIdById(req.quoteId)} has been APPROVED.`);
    renderAdminDashboard();
  }
}
window.approveAmendment = approveAmendment;

function rejectAmendment(reqId) {
  let requests = [];
  const stored = localStorage.getItem("gl_amendment_requests");
  if (stored) {
    try { requests = JSON.parse(stored); } catch(e) {}
  }
  const req = requests.find(r => r.id === reqId);
  if (req) {
    req.status = 'rejected';
    localStorage.setItem("gl_amendment_requests", JSON.stringify(requests));
    alert(`Request to ${req.requestType ? req.requestType.toUpperCase() : 'EDIT'} quote #${getQuoteRefIdById(req.quoteId)} has been REJECTED.`);
    renderAdminDashboard();
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

function saveCustomSeaAutocompletes(originInput, destInput, lineInput) {
  let customPorts = [];
  try { customPorts = JSON.parse(localStorage.getItem("gl_custom_seaports") || "[]"); } catch(e) {}
  let customLines = [];
  try { customLines = JSON.parse(localStorage.getItem("gl_custom_shippinglines") || "[]"); } catch(e) {}

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

  addPort(parsePort(originInput));
  addPort(parsePort(destInput));
  addLine(parseLine(lineInput));

  localStorage.setItem("gl_custom_seaports", JSON.stringify(customPorts));
  localStorage.setItem("gl_custom_shippinglines", JSON.stringify(customLines));
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

// ==================== GOOGLE MAPS DIRECTORY LOOKUP ====================

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
  let searchQuery = rawVal;
  if (!searchQuery) {
    searchQuery = mode === 'air' ? 'International Airports' : 'Cargo Seaports';
  } else {
    // If it's a 3-letter IATA code or short code, expand it
    if (searchQuery.length === 3) {
      searchQuery += mode === 'air' ? ' Airport' : ' Seaport';
    }
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
window.toggleMapHelper = toggleMapHelper;

// ==================== DATABASE STORAGE REPOSITORY (LOCAL/FIREBASE) ====================

const DB = {
  isCloud: false,
  firestoreRef: null,
  
  init() {
    const configRaw = localStorage.getItem("gl_firebase_config");
    const statusDot = document.getElementById("db-connection-dot");
    const statusText = document.getElementById("db-connection-text");
    
    if (configRaw) {
      try {
        const config = JSON.parse(configRaw);
        if (config && config.apiKey && config.projectId) {
          // Initialize Firebase Compat
          if (firebase.apps.length === 0) {
            firebase.initializeApp(config);
          }
          this.firestoreRef = firebase.firestore();
          this.isCloud = true;
          
          // Enable offline persistence
          this.firestoreRef.enablePersistence().catch(err => {
            console.warn("Firestore offline persistence failed:", err.code);
          });
          
          if (statusDot) statusDot.style.background = "#10b981"; // green
          if (statusText) statusText.textContent = "Firebase Cloud (Online)";
          
          // Listen to changes in real-time
          this.firestoreRef.collection("quotes").onSnapshot(snapshot => {
            const list = [];
            snapshot.forEach(doc => {
              const q = doc.data();
              this.sanitize(q, list.length);
              list.push(q);
            });
            // Sort quotes chronologically (newest first)
            list.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
            appState.quotes = list;
            
            // Refresh view
            if (appState.currentUser) {
              if (appState.currentUser === 'ganny') {
                renderAdminDashboard();
              } else {
                renderWorkspace();
              }
            }
          }, error => {
            console.error("Firestore synchronization error:", error);
            if (statusDot) statusDot.style.background = "#ef4444"; // red
            if (statusText) statusText.textContent = "Firebase Error";
          });
          
          // Check for migration from local to cloud
          const localQuotes = JSON.parse(localStorage.getItem("logistics_quotes") || "[]");
          if (localQuotes.length > 0) {
            localQuotes.forEach(q => {
              if (!q.timestamp) q.timestamp = Date.now();
              this.firestoreRef.collection("quotes").doc(q.id).set(q);
            });
            localStorage.removeItem("logistics_quotes");
          }
          return;
        }
      } catch (e) {
        console.error("Failed to parse Firebase configuration:", e);
      }
    }
    
    // Fallback to local storage
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
    
    // Sanitize quotes array
    appState.quotes.forEach((q, idx) => {
      this.sanitize(q, idx);
    });
  },
  
  sanitize(q, idx) {
    const creatorMap = {
      'air-nom': 'shashank',
      'sea-nom': 'mahendra',
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
      await this.firestoreRef.collection("quotes").doc(quote.id).set(quote);
    } else {
      localStorage.setItem("logistics_quotes", JSON.stringify(appState.quotes));
      if (appState.currentUser === 'ganny') {
        renderAdminDashboard();
      } else {
        renderWorkspace();
      }
    }
  },
  
  async deleteQuote(quoteId) {
    appState.quotes = appState.quotes.filter(q => q.id !== quoteId);
    
    if (this.isCloud && this.firestoreRef) {
      await this.firestoreRef.collection("quotes").doc(quoteId).delete();
    } else {
      localStorage.setItem("logistics_quotes", JSON.stringify(appState.quotes));
      if (appState.currentUser === 'ganny') {
        renderAdminDashboard();
      } else {
        renderWorkspace();
      }
    }
  }
};
window.DB = DB;



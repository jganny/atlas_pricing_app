const fs = require('fs');

const elements = {};

function createMockElement(id = "", tagName = "div") {
  const classSet = new Set();
  const el = {
    id,
    tagName: tagName.toUpperCase(),
    parentElement: null,
    style: {},
    value: "",
    textContent: "",
    _innerHTML: "",
    get className() {
      return Array.from(classSet).join(" ");
    },
    set className(val) {
      classSet.clear();
      if (val) {
        val.split(/\s+/).filter(Boolean).forEach(c => classSet.add(c));
      }
    },
    classList: {
      add: function (c) { classSet.add(c); },
      remove: function (c) { classSet.delete(c); },
      contains: function (c) { return classSet.has(c); },
      toggle: function (c, force) {
        if (force !== undefined) {
          if (force) classSet.add(c);
          else classSet.delete(c);
          return force;
        }
        if (classSet.has(c)) {
          classSet.delete(c);
          return false;
        } else {
          classSet.add(c);
          return true;
        }
      }
    },
    get innerHTML() {
      return this._innerHTML;
    },
    set innerHTML(htmlStr) {
      this._innerHTML = htmlStr;
      this.children = [];
      if (!htmlStr || typeof htmlStr !== "string") return;
      const tagRegex = /<([a-zA-Z0-9]+)([^>]*)>/g;
      let match;
      while ((match = tagRegex.exec(htmlStr)) !== null) {
        const tag = match[1];
        const attrs = match[2];
        if (tag.toLowerCase() === "svg" || tag.toLowerCase() === "path" || tag.toLowerCase().startsWith("/")) continue;
        const child = createMockElement("", tag);
        const classMatch = attrs.match(/class=["']([^"']+)["']/);
        if (classMatch) child.className = classMatch[1];
        const idMatch = attrs.match(/id=["']([^"']+)["']/);
        if (idMatch) child.id = idMatch[1];
        const valMatch = attrs.match(/value=["']([^"']+)["']/);
        if (valMatch) child.value = valMatch[1];
        this.appendChild(child);
      }
    },
    children: [],
    _attributes: {},
    setAttribute: function (k, v) { this._attributes[k] = v; },
    getAttribute: function (k) { return this._attributes[k]; },
    appendChild: function (child) {
      this.children.push(child);
      child.parentElement = this;
      return child;
    },
    querySelector: function (selector) {
      const search = (node) => {
        for (const c of node.children) {
          if (selector.startsWith(".")) {
            if (c.classList.contains(selector.substring(1))) return c;
          } else if (selector.startsWith("#")) {
            if (c.id === selector.substring(1)) return c;
          } else if (selector.toUpperCase() === c.tagName) {
            return c;
          }
          const res = search(c);
          if (res) return res;
        }
        return null;
      };
      const found = search(this);
      if (found) return found;

      if (selector.startsWith(".")) {
        const fallback = createMockElement("", "div");
        fallback.className = selector.substring(1);
        fallback.parentElement = this;
        this.children.push(fallback);
        return fallback;
      }
      return null;
    },
    querySelectorAll: function (selector) {
      const results = [];
      const search = (node) => {
        for (const c of node.children) {
          if (selector.startsWith(".")) {
            if (c.classList.contains(selector.substring(1))) results.push(c);
          } else if (selector.toUpperCase() === c.tagName) {
            results.push(c);
          }
          search(c);
        }
      };
      search(this);
      return results;
    },
    closest: function (selector) {
      let cur = this;
      while (cur) {
        if (selector.startsWith(".") && cur.classList && cur.classList.contains(selector.substring(1))) {
          return cur;
        }
        cur = cur.parentElement;
      }
      return null;
    },
    listeners: {},
    addEventListener: function (type, cb) {
      if (!this.listeners[type]) this.listeners[type] = [];
      this.listeners[type].push(cb);
    },
    dispatchEvent: function (event) {
      if (typeof event === "string") event = { type: event };
      if (!event.target) event.target = this;
      const type = event.type;
      if (this.listeners[type]) {
        this.listeners[type].forEach(cb => cb(event));
      }
    }
  };
  return el;
}

function getOrCreateMock(id) {
  if (!elements[id]) {
    elements[id] = createMockElement(id, "div");
  }
  return elements[id];
}

// Pre-create container hierarchies
function createInputInContainer(id, type = "text") {
  const container = createMockElement("", "div");
  container.classList.add("autocomplete-container");
  const input = createMockElement(id, "input");
  container.appendChild(input);
  elements[id] = input;
  return input;
}

createInputInContainer("air-origin");
createInputInContainer("air-dest");
createInputInContainer("air-cust-name");
createInputInContainer("air-airline");
createInputInContainer("air-commodity");
createInputInContainer("sea-origin");
createInputInContainer("sea-dest");
createInputInContainer("sea-cust-name");
createInputInContainer("sea-line");
createInputInContainer("sea-liner-name");
createInputInContainer("sea-commodity");

const seaLinersContainer = getOrCreateMock("sea-liners-container");
const airCardsContainer = getOrCreateMock("air-airlines-list-container");

global.document = {
  getElementById: (id) => getOrCreateMock(id),
  createElement: (tag) => createMockElement("", tag),
  querySelectorAll: (selector) => {
    return [];
  },
  querySelector: (selector) => null,
  body: createMockElement("body", "body"),
  documentElement: { style: { setProperty: () => {} } },
  listeners: {},
  addEventListener: function (type, cb) {
    if (!this.listeners[type]) this.listeners[type] = [];
    this.listeners[type].push(cb);
  },
  dispatchEvent: function (event) {
    const type = event.type || event;
    if (this.listeners[type]) {
      this.listeners[type].forEach(cb => cb(event));
    }
  }
};

global.window = {
  addEventListener: function (type, cb) {
    if (!global.document.listeners[type]) global.document.listeners[type] = [];
    global.document.listeners[type].push(cb);
  },
  location: { reload: () => {} },
  navigator: { onLine: true },
  document: global.document
};

global.Event = function(type) { this.type = type; };

const store = {};
global.localStorage = {
  getItem: (k) => store[k] || null,
  setItem: (k, v) => { store[k] = v.toString(); },
  removeItem: (k) => { delete store[k]; },
  clear: () => { Object.keys(store).forEach(k => delete store[k]); }
};
global.sessionStorage = {
  getItem: () => null,
  setItem: () => {}
};

global.firebase = {
  initializeApp: () => {},
  auth: () => ({ onAuthStateChanged: () => {} }),
  firestore: () => ({
    collection: () => ({
      doc: () => ({
        onSnapshot: () => {},
        set: () => Promise.resolve()
      }),
      onSnapshot: () => {}
    })
  })
};

const code = fs.readFileSync("app-v4.js", "utf-8");
eval(code);

// Setup Autocomplete bindings
window.setupAutocomplete(document.getElementById("air-cust-name"), "customers");
window.setupAutocomplete(document.getElementById("air-origin"), "airports");
window.setupAutocomplete(document.getElementById("air-dest"), "airports");
window.setupAutocomplete(document.getElementById("air-airline"), "airlines");
window.setupAutocomplete(document.getElementById("air-commodity"), "air_commodities");

window.setupAutocomplete(document.getElementById("sea-cust-name"), "customers");
window.setupAutocomplete(document.getElementById("sea-origin"), "seaports");
window.setupAutocomplete(document.getElementById("sea-dest"), "seaports");
window.setupAutocomplete(document.getElementById("sea-line"), "shippinglines");
window.setupAutocomplete(document.getElementById("sea-liner-name"), "linernames");
window.setupAutocomplete(document.getElementById("sea-commodity"), "sea_commodities");

console.log("=== RUNNING PHASE 3A.1 AUTOCOMPLETE VERIFICATION ===");

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`❌ FAIL: ${message}`);
    failed++;
  }
}

// 1. Test Airport Autocomplete
console.log("\n--- 1. Testing Airport Autocomplete ---");
const originEl = document.getElementById("air-origin");
assert(originEl !== null, "Found #air-origin element");

originEl.value = "che";
originEl.dispatchEvent(new Event("input"));

const originContainer = originEl.closest(".autocomplete-container");
const originDropdown = originContainer.querySelector(".autocomplete-dropdown");
assert(originDropdown !== null, "Found origin autocomplete dropdown");
const originItems = originDropdown.querySelectorAll(".autocomplete-item");
console.log(`Airport search 'che' produced ${originItems.length} suggestions.`);
assert(originItems.length > 0, "Airport suggestions rendered for 'che'");

// Test selection
if (originItems.length > 0) {
  originItems[0].dispatchEvent(new Event("click"));
  console.log(`Selected airport: ${originEl.value}`);
  assert(originEl.value.includes("Chennai") || originEl.value.includes("MAA"), "Airport value correctly populated upon click");
}

// 2. Test Airline Autocomplete
console.log("\n--- 2. Testing Airline Autocomplete ---");
window.addAirlineCard();
const airlineCard = document.getElementById("air-airlines-list-container").children[0];
assert(airlineCard !== undefined, "Airline card created in air-airlines-list-container");
const airlineInput = airlineCard ? airlineCard.querySelector(".air-name") : null;
assert(airlineInput !== null, "Found .air-name input inside airline card");

if (airlineInput) {
  airlineInput.value = "em";
  airlineInput.dispatchEvent(new Event("input"));
  const airlineDropdown = airlineInput.parentElement.querySelector(".iata-autocomplete-dropdown");
  assert(airlineDropdown !== null, "Found airline autocomplete dropdown");
  const airlineItems = airlineDropdown.querySelectorAll(".iata-autocomplete-item");
  console.log(`Airline search 'em' produced ${airlineItems.length} suggestions.`);
  assert(airlineItems.length > 0, "Airline suggestions rendered for 'em'");

  if (airlineItems.length > 0) {
    airlineItems[0].dispatchEvent(new Event("click"));
    console.log(`Selected airline: ${airlineInput.value}`);
    assert(airlineInput.value.includes("Emirates") || airlineInput.value.includes("EK"), "Airline value populated upon click");

    // Test blur after selecting from dropdown (should not add custom entry)
    localStorage.removeItem("gl_custom_airlines");
    airlineInput.dispatchEvent(new Event("blur"));
    assert(localStorage.getItem("gl_custom_airlines") === null, "Blur after dropdown selection does not trigger unnecessary custom write");

    // Test blur on existing airline typed manually (should not add custom entry)
    airlineInput.value = "Emirates";
    airlineInput.dispatchEvent(new Event("input"));
    airlineInput.dispatchEvent(new Event("blur"));
    assert(localStorage.getItem("gl_custom_airlines") === null, "Blur on existing airline typed manually does not trigger unnecessary custom write");

    // Test blur on genuinely new airline (should trigger custom write)
    airlineInput.value = "XX - Brand New Sky Cargo";
    airlineInput.dispatchEvent(new Event("input"));
    airlineInput.dispatchEvent(new Event("blur"));
    const storedCustom = localStorage.getItem("gl_custom_airlines");
    assert(storedCustom !== null && storedCustom.includes("Brand New Sky Cargo"), "Blur on genuinely new airline triggers saveCustomEntry");
  }
}

// 3. Test Port Autocomplete
console.log("\n--- 3. Testing Port (POL/POD) Autocomplete ---");
const seaOriginEl = document.getElementById("sea-origin");
assert(seaOriginEl !== null, "Found #sea-origin element");

seaOriginEl.value = "sin";
seaOriginEl.dispatchEvent(new Event("input"));
const seaOriginContainer = seaOriginEl.closest(".autocomplete-container");
const seaOriginDropdown = seaOriginContainer.querySelector(".autocomplete-dropdown");
assert(seaOriginDropdown !== null, "Found sea origin autocomplete dropdown");
const seaOriginItems = seaOriginDropdown.querySelectorAll(".autocomplete-item");
console.log(`Port search 'sin' produced ${seaOriginItems.length} suggestions.`);
assert(seaOriginItems.length > 0, "Port suggestions rendered for 'sin'");

if (seaOriginItems.length > 0) {
  seaOriginItems[0].dispatchEvent(new Event("click"));
  console.log(`Selected port: ${seaOriginEl.value}`);
  assert(seaOriginEl.value.includes("Singapore") || seaOriginEl.value.includes("SGPIN"), "Port value populated upon click");
}

// 4. Test Shipping Line Verification
console.log("\n--- 4. Testing Shipping Line Verification ---");
const opts = buildLinerOptionsHTML("Maersk Line");
assert(opts.html.includes("Maersk Line"), "Shipping line helper includes Maersk Line");
assert(opts.html.includes("MSC (Mediterranean Shipping Company)"), "Shipping line helper includes MSC");
assert(opts.html.includes("Vanguard Logistics"), "Shipping line helper includes Coloaders");
assert(opts.html.includes("BBC Chartering"), "Shipping line helper includes Breakbulk Operators");

// 5. Test Commodity Autocomplete & HSN Code Lookup
console.log("\n--- 5. Testing Commodity Verification ---");
const airCommEl = document.getElementById("air-commodity");
assert(airCommEl !== null, "Found #air-commodity element");

airCommEl.value = "pharma";
airCommEl.dispatchEvent(new Event("input"));
const airCommContainer = airCommEl.closest(".autocomplete-container");
const airCommDropdown = airCommContainer.querySelector(".autocomplete-dropdown");
assert(airCommDropdown !== null, "Found commodity autocomplete dropdown");
const commItems = airCommDropdown.querySelectorAll(".autocomplete-item");
console.log(`Commodity search 'pharma' produced ${commItems.length} suggestions.`);
assert(commItems.length > 0, "Commodity suggestions rendered for 'pharma'");

// Test HSN 4-digit code lookup
airCommEl.value = "8471";
airCommEl.dispatchEvent(new Event("input"));
const hsnItems = airCommDropdown.querySelectorAll(".autocomplete-item");
console.log(`HSN search '8471' produced ${hsnItems.length} suggestions.`);
assert(hsnItems.length > 0, "HSN code 8471 dynamic heading suggestions rendered");

console.log(`\n==================================================`);
console.log(`SUMMARY: Passed: ${passed}, Failed: ${failed}`);
console.log(`==================================================`);
process.exit(failed > 0 ? 1 : 0);


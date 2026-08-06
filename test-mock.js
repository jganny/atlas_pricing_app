const fs = require('fs');

const elements = {};
function getOrCreateMock(id) {
  if (!elements[id]) {
    elements[id] = {
      id,
      classList: {
        add: () => {},
        remove: () => {},
        contains: () => false
      },
      style: {},
      value: "",
      textContent: "",
      innerHTML: "",
      appendChild: () => {},
      setAttribute: () => {}
    };
  }
  return elements[id];
}

global.document = {
  getElementById: (id) => getOrCreateMock(id),
  createElement: (tag) => ({
    tagName: tag,
    setAttribute: () => {},
    appendChild: () => {},
    innerHTML: ""
  }),
  querySelectorAll: () => [],
  querySelector: () => null,
  body: { classList: { remove: () => {}, add: () => {} } },
  documentElement: { style: { setProperty: () => {} } },
  addEventListener: () => {}
};

global.window = global;
global.localStorage = { getItem: () => null, setItem: () => {} };
global.sessionStorage = { getItem: () => null, setItem: () => {} };

// Provide minimal implementations for anything that throws
global.firebase = { initializeApp: () => {}, auth: () => ({ onAuthStateChanged: () => {} }), firestore: () => ({ collection: () => ({ doc: () => ({ onSnapshot: () => {} }) }) }) };

const code = fs.readFileSync("app-v4.js", "utf-8");
try {
  eval(code);
} catch (e) {
  console.log("Error loading app-v4.js:", e.message);
  console.log(e.stack);
}

global.appState = {
  currentUser: 'shashank',
  quotes: [{
    id: "Q123",
    creator: "shashank",
    date: "2026-08-04",
    customer: "Test",
    amount: 100,
    amountINR: 100,
    currency: "USD",
    status: "quoted",
    type: "air"
  }]
};

console.log("Executing renderMemberDashboard...");
try {
  global.renderMemberDashboard('shashank');
  console.log("Success! user-stat-revenue:", document.getElementById("user-stat-revenue").textContent);
  console.log("tbody HTML:", document.getElementById("user-quotes-body").innerHTML);
} catch (e) {
  console.error("EXCEPTION CAUGHT:", e);
}

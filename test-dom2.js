const fs = require('fs');
const jsdom = require("jsdom");
const { JSDOM } = jsdom;

const html = fs.readFileSync("index.html", "utf-8");
const dom = new JSDOM(html, {
  url: "http://localhost",
  runScripts: "dangerously",
  resources: "usable"
});

const window = dom.window;
const document = window.document;

window.localStorage = { getItem: () => null, setItem: () => {} };
window.sessionStorage = { getItem: () => null, setItem: () => {} };

const scriptEl = document.createElement("script");
scriptEl.textContent = fs.readFileSync("app-v4.js", "utf-8");
document.body.appendChild(scriptEl);

setTimeout(() => {
  try {
    window.appState = {
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
    console.log("Running switchRole('shashank')...");
    window.switchRole('shashank');
    console.log("member-dashboard-panel classList:", document.getElementById("member-dashboard-panel").className);
    console.log("tbody innerHTML length:", document.getElementById("user-quotes-body").innerHTML.length);
  } catch (e) {
    console.error("ERROR CAUGHT:", e);
  }
}, 1000);

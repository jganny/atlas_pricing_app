const fs = require('fs');
const jsdom = require('jsdom');
const html = fs.readFileSync('index.html', 'utf8');
const dom = new jsdom.JSDOM(html);
const window = dom.window;
const document = window.document;

// Mock dependencies
window.appState = {
  currentUser: 'shashank',
  quotes: []
};
window.TEAM_ROLES = {
  'shashank': {
    type: 'member',
    category: 'AIR - NOMINATION'
  }
};
window.isAdminUser = () => false;
window.isUserAdminOrManager = () => false;

// Mock some global functions used in switchRole and renderMemberDashboard
window.updateCurrencyRules = () => {};
window.updateExecutiveDashboardVisibility = () => {};

// Just copy switchRole and renderMemberDashboard and test if they throw
// Actually, it's easier to load app-v4.js in the JSDOM
// Let's run app-v4.js inside jsdom
const scriptCode = fs.readFileSync('app-v4.js', 'utf8');

try {
  window.eval(scriptCode);
  window.appState.currentUser = 'shashank';
  window.switchRole('shashank');
  
  const panel = document.getElementById('member-dashboard-panel');
  console.log("Panel classList:", panel.className);
  console.log("Panel HTML length:", panel.innerHTML.length);
  
} catch (e) {
  console.error("Exception thrown!", e);
}

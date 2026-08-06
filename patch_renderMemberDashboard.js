const fs = require('fs');
const file = 'app-v4.js';
let content = fs.readFileSync(file, 'utf8');

const targetFunctionStart = "window.renderMemberDashboard = (userId) => {";
const replacementStart = `window.renderMemberDashboard = (userId) => {
  try {`;

content = content.replace(targetFunctionStart, replacementStart);

const targetFunctionEnd = `  if (typeof window.updateEditTimelines === 'function') {
    window.updateEditTimelines();
  }
};`;

const replacementEnd = `  if (typeof window.updateEditTimelines === 'function') {
    window.updateEditTimelines();
  }
  } catch (err) {
    const p = document.getElementById("member-dashboard-panel");
    if (p) p.innerHTML = '<div style="color:red; padding:20px; font-size:18px;">ERROR IN RENDERMEMBERDASHBOARD: ' + (err.stack || err) + '</div>';
    console.error("renderMemberDashboard crash:", err);
  }
};`;

content = content.replace(targetFunctionEnd, replacementEnd);
fs.writeFileSync(file, content);

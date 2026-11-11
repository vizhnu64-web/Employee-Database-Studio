const fs = require('fs');
const path = require('path');

const buildDir = path.join(__dirname, '../build');
if (!fs.existsSync(buildDir)) {
  fs.mkdirSync(buildDir, { recursive: true });
}

// Generate an SVG icon
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#3b82f6"/>
      <stop offset="100%" stop-color="#1d4ed8"/>
    </linearGradient>
    <linearGradient id="sheet" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="100%" stop-color="#f1f5f9"/>
    </linearGradient>
  </defs>
  <rect width="256" height="256" rx="48" fill="url(#bg)"/>
  <!-- Payslip Document -->
  <rect x="56" y="44" width="144" height="168" rx="8" fill="url(#sheet)" filter="drop-shadow(0 8px 16px rgba(0,0,0,0.2))"/>
  <!-- Top header accent -->
  <rect x="56" y="44" width="144" height="28" rx="8" fill="#1e293b"/>
  <!-- Document Lines -->
  <rect x="74" y="88" width="54" height="8" rx="4" fill="#3b82f6"/>
  <rect x="136" y="88" width="46" height="8" rx="4" fill="#94a3b8"/>
  <line x1="74" y1="112" x2="182" y2="112" stroke="#e2e8f0" stroke-width="2"/>
  <rect x="74" y="124" width="60" height="6" rx="3" fill="#64748b"/>
  <rect x="146" y="124" width="36" height="6" rx="3" fill="#10b981"/>
  <rect x="74" y="138" width="50" height="6" rx="3" fill="#64748b"/>
  <rect x="146" y="138" width="36" height="6" rx="3" fill="#ef4444"/>
  <line x1="74" y1="156" x2="182" y2="156" stroke="#e2e8f0" stroke-width="2"/>
  <!-- Net pay banner -->
  <rect x="70" y="166" width="116" height="26" rx="4" fill="#dbeafe"/>
  <circle cx="86" cy="179" r="6" fill="#2563eb"/>
  <rect x="98" y="176" width="76" height="6" rx="3" fill="#1e40af"/>
</svg>`;

fs.writeFileSync(path.join(buildDir, 'icon.svg'), svg);

// Also write a minimal valid 1x1 or raw icon file if needed, or let electron-builder use png/ico
console.log('Icon SVG written to build/icon.svg');

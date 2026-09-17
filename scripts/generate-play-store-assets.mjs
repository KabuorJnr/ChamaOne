import sharp from 'sharp';
import { readFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

if (!existsSync('release')) {
  mkdirSync('release', { recursive: true });
}

// 1. Copy or ensure 512x512 store icon
const iconSvg = readFileSync('public/favicon.svg');
await sharp(iconSvg)
  .resize(512, 512)
  .png()
  .toFile('release/app-icon-512x512.png');
console.log('Created release/app-icon-512x512.png (512x512)');

// 2. Create 1024x500 Feature Graphic for Google Play Store
const featureGraphicSvg = `
<svg width="1024" height="500" viewBox="0 0 1024 500" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0F172A"/>
      <stop offset="50%" stop-color="#1E293B"/>
      <stop offset="100%" stop-color="#0B1120"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.25" cy="0.5" r="0.5">
      <stop offset="0%" stop-color="#2563EB" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="#2563EB" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="coinGlow" cx="0.85" cy="0.5" r="0.4">
      <stop offset="0%" stop-color="#F59E0B" stop-opacity="0.15"/>
      <stop offset="100%" stop-color="#F59E0B" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="textGrad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#FFFFFF"/>
      <stop offset="100%" stop-color="#93C5FD"/>
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="1024" height="500" fill="url(#bg)"/>
  <rect width="1024" height="500" fill="url(#glow)"/>
  <rect width="1024" height="500" fill="url(#coinGlow)"/>

  <!-- Decorative grid lines / circuit accents -->
  <path d="M0 250 L1024 250" stroke="#334155" stroke-opacity="0.2" stroke-width="1"/>
  <path d="M0 125 L1024 125" stroke="#334155" stroke-opacity="0.15" stroke-width="1"/>
  <path d="M0 375 L1024 375" stroke="#334155" stroke-opacity="0.15" stroke-width="1"/>
  <circle cx="200" cy="250" r="160" fill="none" stroke="#38BDF8" stroke-opacity="0.1" stroke-width="2"/>
  <circle cx="200" cy="250" r="220" fill="none" stroke="#2563EB" stroke-opacity="0.08" stroke-width="2" stroke-dasharray="8 8"/>

  <!-- ChamaOne Logo on Left (scaled to 220x220 at x=90, y=140) -->
  <g transform="translate(90, 140) scale(0.43)">
    <rect x="24" y="24" width="464" height="464" rx="112" fill="#18294A" stroke="#3B82F6" stroke-width="6" stroke-opacity="0.5"/>
    <path d="M256 120 L138 322 L374 322 Z" fill="none" stroke="#2563EB" stroke-opacity="0.45" stroke-width="14" stroke-linejoin="round"/>
    <g fill="#60A5FA"><circle cx="256" cy="118" r="34"/><rect x="216" y="130" width="80" height="46" rx="25"/></g>
    <g fill="#3B82F6"><circle cx="138" cy="322" r="30"/><rect x="102" y="333" width="72" height="41" rx="22"/></g>
    <g fill="#2563EB"><circle cx="374" cy="322" r="30"/><rect x="338" y="333" width="72" height="41" rx="22"/></g>
    <circle cx="256" cy="300" r="74" fill="#0B1120"/>
    <circle cx="256" cy="300" r="60" fill="#F59E0B"/>
    <circle cx="256" cy="300" r="60" fill="none" stroke="#FDE68A" stroke-opacity="0.55" stroke-width="3"/>
    <circle cx="256" cy="300" r="38" fill="none" stroke="#9A5B08" stroke-opacity="0.5" stroke-width="6"/>
  </g>

  <!-- Typography on Right (x=340) -->
  <!-- Pill Badge -->
  <g transform="translate(340, 120)">
    <rect width="180" height="32" rx="16" fill="#1E3A8A" fill-opacity="0.5" stroke="#3B82F6" stroke-opacity="0.4"/>
    <text x="90" y="20" font-family="-apple-system, system-ui, Segoe UI, Roboto, sans-serif" font-size="12" font-weight="700" fill="#60A5FA" text-anchor="middle" letter-spacing="1.5">KENYA CHAMA APP</text>
  </g>

  <!-- App Title -->
  <text x="340" y="215" font-family="-apple-system, system-ui, Segoe UI, Roboto, sans-serif" font-size="56" font-weight="900" fill="url(#textGrad)" letter-spacing="-1">ChamaOne</text>

  <!-- Tagline -->
  <text x="340" y="260" font-family="-apple-system, system-ui, Segoe UI, Roboto, sans-serif" font-size="22" font-weight="600" fill="#E2E8F0">Run your Chama with confidence &amp; clarity</text>

  <!-- Feature bullets -->
  <g transform="translate(340, 310)">
    <!-- Pill 1: Transparent Contributions -->
    <rect x="0" y="0" width="180" height="38" rx="10" fill="#1E293B" stroke="#475569" stroke-width="1"/>
    <circle cx="16" cy="19" r="5" fill="#10B981"/>
    <text x="30" y="24" font-family="-apple-system, system-ui, Segoe UI, Roboto, sans-serif" font-size="13" font-weight="600" fill="#CBD5E1">Contributions Ledger</text>

    <!-- Pill 2: Loan Tracking -->
    <rect x="195" y="0" width="165" height="38" rx="10" fill="#1E293B" stroke="#475569" stroke-width="1"/>
    <circle cx="211" cy="19" r="5" fill="#3B82F6"/>
    <text x="225" y="24" font-family="-apple-system, system-ui, Segoe UI, Roboto, sans-serif" font-size="13" font-weight="600" fill="#CBD5E1">Loan Voting &amp; Int.</text>

    <!-- Pill 3: Real-Time Sync -->
    <rect x="375" y="0" width="165" height="38" rx="10" fill="#1E293B" stroke="#475569" stroke-width="1"/>
    <circle cx="391" cy="19" r="5" fill="#F59E0B"/>
    <text x="405" y="24" font-family="-apple-system, system-ui, Segoe UI, Roboto, sans-serif" font-size="13" font-weight="600" fill="#CBD5E1">Live Sync &amp; Voting</text>
  </g>

  <!-- Footer hint -->
  <text x="340" y="385" font-family="-apple-system, system-ui, Segoe UI, Roboto, sans-serif" font-size="14" font-weight="500" fill="#94A3B8">Built for Kenyan Chamas • KES Currency • Shared Books</text>
</svg>
`;

await sharp(Buffer.from(featureGraphicSvg))
  .resize(1024, 500)
  .png()
  .toFile('release/feature-graphic-1024x500.png');
console.log('Created release/feature-graphic-1024x500.png (1024x500)');

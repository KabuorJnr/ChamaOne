import sharp from 'sharp';
import { writeFileSync } from 'node:fs';

const fgSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <defs>
    <radialGradient id="coin" cx="0.5" cy="0.38" r="0.75">
      <stop offset="0%" stop-color="#FCD34D"/>
      <stop offset="55%" stop-color="#F59E0B"/>
      <stop offset="100%" stop-color="#C2740A"/>
    </radialGradient>
    <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="10" stdDeviation="16" flood-color="#000000" flood-opacity="0.55"/>
    </filter>
  </defs>
  <!-- Perfectly centered logo mark.
       Mark bounds: X: 102..410 (width 308, mid 256), Y: 84..374 (height 290, mid 229)
       We scale by 1.80 so the total mark is ~554 x 522 px inside the 1024x1024 canvas.
       This is precisely in the Android 66% Adaptive Icon safe zone (center 676px).
  -->
  <g transform="translate(512, 512) scale(1.80) translate(-256, -229)" filter="url(#shadow)">
    <!-- Connecting triangle structure -->
    <path d="M256 120 L138 322 L374 322 Z" fill="none" stroke="#3B82F6" stroke-opacity="0.8" stroke-width="16" stroke-linejoin="round"/>
    
    <!-- Top member -->
    <g fill="#60A5FA">
      <circle cx="256" cy="118" r="34"/>
      <rect x="216" y="130" width="80" height="46" rx="23"/>
    </g>
    
    <!-- Left member -->
    <g fill="#3B82F6">
      <circle cx="138" cy="322" r="30"/>
      <rect x="102" y="333" width="72" height="41" rx="20"/>
    </g>
    
    <!-- Right member -->
    <g fill="#2563EB">
      <circle cx="374" cy="322" r="30"/>
      <rect x="338" y="333" width="72" height="41" rx="20"/>
    </g>
    
    <!-- Central Chama Gold Pot / Coin -->
    <circle cx="256" cy="300" r="74" fill="#0B1120"/>
    <circle cx="256" cy="300" r="62" fill="url(#coin)"/>
    <circle cx="256" cy="300" r="62" fill="none" stroke="#FDE68A" stroke-opacity="0.8" stroke-width="4"/>
    <circle cx="256" cy="300" r="40" fill="none" stroke="#9A5B08" stroke-opacity="0.6" stroke-width="7"/>
  </g>
</svg>
`;

const bgSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <defs>
    <linearGradient id="bgGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#1E293B"/>
      <stop offset="45%" stop-color="#0F172A"/>
      <stop offset="100%" stop-color="#070B14"/>
    </linearGradient>
  </defs>
  <rect width="1024" height="1024" fill="url(#bgGrad)"/>
</svg>
`;

const fullIconSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <defs>
    <linearGradient id="bgGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#1E293B"/>
      <stop offset="45%" stop-color="#0F172A"/>
      <stop offset="100%" stop-color="#070B14"/>
    </linearGradient>
    <radialGradient id="coin" cx="0.5" cy="0.38" r="0.75">
      <stop offset="0%" stop-color="#FCD34D"/>
      <stop offset="55%" stop-color="#F59E0B"/>
      <stop offset="100%" stop-color="#C2740A"/>
    </radialGradient>
    <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="12" stdDeviation="18" flood-color="#000000" flood-opacity="0.6"/>
    </filter>
  </defs>
  <rect width="1024" height="1024" fill="url(#bgGrad)"/>
  <g transform="translate(512, 512) scale(1.80) translate(-256, -229)" filter="url(#shadow)">
    <path d="M256 120 L138 322 L374 322 Z" fill="none" stroke="#3B82F6" stroke-opacity="0.8" stroke-width="16" stroke-linejoin="round"/>
    <g fill="#60A5FA">
      <circle cx="256" cy="118" r="34"/>
      <rect x="216" y="130" width="80" height="46" rx="23"/>
    </g>
    <g fill="#3B82F6">
      <circle cx="138" cy="322" r="30"/>
      <rect x="102" y="333" width="72" height="41" rx="20"/>
    </g>
    <g fill="#2563EB">
      <circle cx="374" cy="322" r="30"/>
      <rect x="338" y="333" width="72" height="41" rx="20"/>
    </g>
    <circle cx="256" cy="300" r="74" fill="#0B1120"/>
    <circle cx="256" cy="300" r="62" fill="url(#coin)"/>
    <circle cx="256" cy="300" r="62" fill="none" stroke="#FDE68A" stroke-opacity="0.8" stroke-width="4"/>
    <circle cx="256" cy="300" r="40" fill="none" stroke="#9A5B08" stroke-opacity="0.6" stroke-width="7"/>
  </g>
</svg>
`;

async function main() {
  console.log('Generating high-resolution centered assets...');
  
  // 1. Android Adaptive icon foreground (1024x1024, transparent background)
  await sharp(Buffer.from(fgSvg))
    .png()
    .toFile('assets/icon-foreground.png');

  // 2. Android Adaptive icon background (1024x1024, rich dark navy gradient)
  await sharp(Buffer.from(bgSvg))
    .png()
    .toFile('assets/icon-background.png');

  // 3. Fallback / Standard icon (1024x1024)
  await sharp(Buffer.from(fullIconSvg))
    .png()
    .toFile('assets/icon.png');

  // 4. PWA Icons in public/icons/
  await sharp(Buffer.from(fullIconSvg))
    .resize(512, 512)
    .png()
    .toFile('public/icons/icon-512.png');

  await sharp(Buffer.from(fullIconSvg))
    .resize(512, 512)
    .png()
    .toFile('public/icons/maskable-512.png');

  await sharp(Buffer.from(fullIconSvg))
    .resize(192, 192)
    .png()
    .toFile('public/icons/icon-192.png');

  // 5. Splashes (2732x2732)
  const splashSvg = `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2732 2732" width="2732" height="2732">
    <defs>
      <linearGradient id="bgGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#1E293B"/>
        <stop offset="45%" stop-color="#0F172A"/>
        <stop offset="100%" stop-color="#070B14"/>
      </linearGradient>
      <radialGradient id="coin" cx="0.5" cy="0.38" r="0.75">
        <stop offset="0%" stop-color="#FCD34D"/>
        <stop offset="55%" stop-color="#F59E0B"/>
        <stop offset="100%" stop-color="#C2740A"/>
      </radialGradient>
      <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%">
        <feDropShadow dx="0" dy="18" stdDeviation="24" flood-color="#000000" flood-opacity="0.6"/>
      </filter>
    </defs>
    <rect width="2732" height="2732" fill="url(#bgGrad)"/>
    <g transform="translate(1366, 1366) scale(2.6) translate(-256, -229)" filter="url(#shadow)">
      <path d="M256 120 L138 322 L374 322 Z" fill="none" stroke="#3B82F6" stroke-opacity="0.8" stroke-width="16" stroke-linejoin="round"/>
      <g fill="#60A5FA">
        <circle cx="256" cy="118" r="34"/>
        <rect x="216" y="130" width="80" height="46" rx="23"/>
      </g>
      <g fill="#3B82F6">
        <circle cx="138" cy="322" r="30"/>
        <rect x="102" y="333" width="72" height="41" rx="20"/>
      </g>
      <g fill="#2563EB">
        <circle cx="374" cy="322" r="30"/>
        <rect x="338" y="333" width="72" height="41" rx="20"/>
      </g>
      <circle cx="256" cy="300" r="74" fill="#0B1120"/>
      <circle cx="256" cy="300" r="62" fill="url(#coin)"/>
      <circle cx="256" cy="300" r="62" fill="none" stroke="#FDE68A" stroke-opacity="0.8" stroke-width="4"/>
      <circle cx="256" cy="300" r="40" fill="none" stroke="#9A5B08" stroke-opacity="0.6" stroke-width="7"/>
    </g>
  </svg>
  `;

  await sharp(Buffer.from(splashSvg)).png().toFile('assets/splash.png');
  await sharp(Buffer.from(splashSvg)).png().toFile('assets/splash-dark.png');

  console.log('Finished generating all centered, crystal-clear icons & splashes!');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

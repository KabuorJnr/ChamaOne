/**
 * Stamp the app version from package.json into the generated Android project.
 * `android/` is created by `npx cap add android` and is git-ignored, so the
 * version has to be applied after each sync rather than committed.
 *
 *   versionName = package.json version        (e.g. "1.1.0")
 *   versionCode = major*10000 + minor*100 + patch  (e.g. 10100) — always
 *                 increases, which Play Store requires.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url)));
const [maj = 0, min = 0, pat = 0] = String(pkg.version).split('.').map((n) => parseInt(n, 10) || 0);
const versionName = pkg.version;
const versionCode = maj * 10000 + min * 100 + pat;

const gradle = 'android/app/build.gradle';
if (!existsSync(gradle)) {
  console.log(`[version] ${gradle} not found — run "npx cap add android" first. Skipping.`);
  process.exit(0);
}

let s = readFileSync(gradle, 'utf8');
const before = s;
s = s.replace(/versionCode\s+\d+/, `versionCode ${versionCode}`);
s = s.replace(/versionName\s+"[^"]*"/, `versionName "${versionName}"`);

if (s === before) {
  console.warn('[version] could not find versionCode/versionName in build.gradle — left unchanged.');
  process.exit(0);
}
writeFileSync(gradle, s);
console.log(`[version] Android set to ${versionName} (versionCode ${versionCode})`);

/**
 * Wire release signing into the generated Android project so `bundleRelease`
 * produces a Play-Store-uploadable, signed .aab.
 *
 * `android/` is created by `npx cap add android` and is git-ignored, so — like
 * the version stamp — this is applied after each sync rather than committed.
 *
 * Credentials live in `keystore.properties` at the repo root (git-ignored):
 *
 *   storeFile=C:\\Users\\USER\\keys\\chamaone-release.keystore
 *   storePassword=********
 *   keyAlias=chamaone
 *   keyPassword=********
 *
 * If that file is absent the script does nothing, so debug builds still work
 * for anyone without the signing key. Use an ABSOLUTE storeFile path so it
 * resolves regardless of the working directory.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const gradle = 'android/app/build.gradle';
const propsFile = 'keystore.properties';
const MARKER = '// chamaone-release-signing';

if (!existsSync(gradle)) {
  console.log(`[release] ${gradle} not found — run "npx cap add android" first. Skipping.`);
  process.exit(0);
}
if (!existsSync(propsFile)) {
  console.log('[release] keystore.properties not found — skipping release signing.');
  console.log('          (Debug builds are unaffected. See docs/PLAY_STORE.md to set it up.)');
  process.exit(0);
}

let s = readFileSync(gradle, 'utf8');
if (s.includes(MARKER)) {
  console.log('[release] signing already configured — nothing to do.');
  process.exit(0);
}

// 1) Load keystore.properties above the android { } block, and open a
//    signingConfigs.release block immediately inside android { }.
const header = `${MARKER}
def keystorePropsFile = rootProject.file("../keystore.properties")
def keystoreProps = new Properties()
if (keystorePropsFile.exists()) { keystoreProps.load(new FileInputStream(keystorePropsFile)) }

android {
    signingConfigs {
        release {
            if (keystoreProps.containsKey('storeFile')) {
                storeFile file(keystoreProps['storeFile'])
                storePassword keystoreProps['storePassword']
                keyAlias keystoreProps['keyAlias']
                keyPassword keystoreProps['keyPassword']
            }
        }
    }`;

if (!/\nandroid\s*\{/.test(s)) {
  console.error('[release] could not find the android { } block — aborting, build.gradle unchanged.');
  process.exit(1);
}
s = s.replace(/\nandroid\s*\{/, `\n${header}`);

// 2) Point the release build type at the signing config.
if (/buildTypes\s*\{\s*release\s*\{/.test(s)) {
  s = s.replace(/(buildTypes\s*\{\s*release\s*\{)/, `$1\n            signingConfig signingConfigs.release`);
} else {
  console.warn('[release] buildTypes.release not found — add "signingConfig signingConfigs.release" by hand.');
}

writeFileSync(gradle, s);
console.log('[release] release signing configured from keystore.properties.');

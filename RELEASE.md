# ChamaOne — release & signing

## Artifacts (in the project root, after a release build)
- **`ChamaOne-release.apk`** — signed release APK. Install/distribute directly (sideload, website, WhatsApp). Smaller & optimized vs. the debug APK.
- **`ChamaOne-release.aab`** — signed **Android App Bundle** for the **Google Play Console** (Play requires an `.aab` for new apps).

Both are signed with the upload key below. App id `com.chamaone.app`, versionCode `1`, versionName `1.0`.

## 🔐 Signing key — BACK THIS UP
The release is signed with a keystore created for this app:

- Keystore: **`android/chamaone-release.keystore`**
- Alias: **`chamaone`**
- Config: **`android/keystore.properties`** (holds the passwords; **git-ignored**)
- Cert SHA-256: `c6:79:90:4a:03:f6:91:f5:b7:04:70:4a:51:5f:60:2b:6c:54:46:eb:44:71:36:c5:60:6d:bc:d2:a2:f4:f4:4d`

> ⚠️ **Keep the keystore file AND its password safe and backed up.** Every future
> update you publish to Google Play must be signed with this **same** key. If you
> lose it, you can no longer update the app under this listing. Copy
> `chamaone-release.keystore` + `keystore.properties` somewhere secure (password
> manager / offline backup). They are intentionally excluded from git.

(If you enrol in Google **Play App Signing**, Google holds the final app-signing key
and this becomes your *upload* key — losing it is then recoverable via Play support.)

## Rebuild the release
```bash
cd ChamaOne
npm run build && npx cap sync android
cd android
JAVA_HOME="/c/Program Files/Android/Android Studio/jbr" ./gradlew :app:assembleRelease :app:bundleRelease --no-daemon
```
Outputs:
- `android/app/build/outputs/apk/release/app-release.apk`
- `android/app/build/outputs/bundle/release/app-release.aab`

Bump `versionCode` (and `versionName`) in `android/app/build.gradle` for each Play update.

## Publish to Google Play (outline)
1. Create the app in the [Play Console](https://play.google.com/console) (one-time $25 developer account).
2. Upload `ChamaOne-release.aab` to a track (Internal testing → Production).
3. Complete the store listing, content rating, data-safety, and privacy policy.
4. Recommended: opt into **Play App Signing** on first upload.

## Notes
- This build is **local-first** (data on device; M-Pesa in simulation mode). Before a
  public launch, wire the live Daraja backend and Supabase sync (see `README.md`).
- Notifications use `@capacitor/local-notifications` (POST_NOTIFICATIONS permission is in the manifest).

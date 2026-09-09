# ChamaOne — release artifact

`ChamaOne-release.apk` is the signed Android release build (`com.chamaone.app`,
Capacitor + React/Vite) captured before the source was imported.

It's kept here only as a **downloadable reference build**. The full, editable
source now lives in this repo (`src/`, `package.json`, etc.), so build a fresh
APK from source with:

```bash
npm install
npm run android:sync   # vite build + cap sync android
# then assemble in android/ (see the root README "Build the Android APK")
```

New builds should **not** be committed — `*.apk` and `*.aab` are gitignored.

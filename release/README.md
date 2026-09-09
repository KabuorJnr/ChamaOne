# ChamaOne — pre-built release artifacts

This folder holds the **already-built** ChamaOne app that existed before this
repository was set up. It was recovered from the signed Android release APK.

## Contents

| Path | What it is |
|---|---|
| `ChamaOne-release.apk` | Signed Android release build (`com.chamaone.app`, Capacitor). |
| `web/` | The **compiled, minified** web bundle extracted from the APK (`assets/public/`). This is the Vite production build, not source. |
| `capacitor.config.json` | Capacitor config from the build (`appId: com.chamaone.app`, `webDir: dist`). |
| `capacitor.plugins.json` | Capacitor plugins bundled in the build. |

## ⚠️ Important: this is build output, not source

The APK contains only the **compiled/minified** web bundle. The original,
editable React source (`.jsx` components, hooks, etc.) **cannot be recovered**
from it. The maintainable source still lives in the separate
"Chama savings group platform" Claude session and needs to be pushed here to
continue development.

These artifacts are committed as:
- a runnable baseline (you can install the APK, or serve `web/`), and
- a reference for **what was already built**, to guide reconstruction.

## What the build already includes

From the bundle and manifest, the built app is a Capacitor + React (Vite) app
using client-side `localStorage`, tagline *"Run your Chama with confidence:
transparent contributions, M-Pesa collection, loan voting, meetings and books
everyone can trust."* Observed features:

- Members & officer roles (chairperson, treasurer, secretary)
- Contributions (cycles, amounts, trends)
- Loans with **voting**, interest, guarantors, totals
- Meetings (with links/IDs) and attendance
- Fines
- M-Pesa references

## Serving the built web app locally

```bash
cd release/web
python3 -m http.server 8080   # then open http://localhost:8080
```

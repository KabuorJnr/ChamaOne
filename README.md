# ChamaOne 🔵

**A Chama / savings-group manager built in the exact style of the EduOne mobile app** —
React + Vite + Capacitor, the same self-contained phone-native shell (an in-app screen
stack, deep-blue brand, bottom-nav tabs, role-adaptive home), packaged as an Android APK
via the same toolchain.

Transparent contributions, M-Pesa collection, in-app loan voting, meetings & digital
voting, and a tamper-evident ledger — because money disputes are the #1 reason Chamas
collapse.

---

## Same DNA as EduOne

| EduOne pattern | ChamaOne equivalent |
|---|---|
| `src/mobile/MobileShell.jsx` in-app screen stack (no router) | identical shell, screen stack, top-bar/back/bottom-nav |
| `src/mobile/mobile.css` `.eom-*` design system | `src/mobile/mobile.css` `.cha-*` design system (same visual language) |
| `screens/registry.jsx` name → screen map | same registry pattern |
| `screens/kit.jsx` shared components | same — plus finance widgets (ring, tally, ledger) |
| role-adaptive `MobileHome` | dashboard home (pool, cycle ring, votes, trend) |
| Capacitor 8, `capacitor.config.json`, JBR-21 APK build | identical build path, appId `com.chamaone.app` |

---

## Features

- **Dashboard** — pool balance, contribution progress ring, active loans, next meeting, trend chart, quick actions
- **Members** — roster with roles & per-cycle paid/unpaid status; member profiles
- **Contributions** — record cash or trigger an **M-Pesa STK push**, auto-reconciled
- **Loans** — apply → group **votes in-app** → interest auto-calculated → disburse from pool → track repayments
- **Meetings & Voting** — agenda, minutes, **digital motions** with a live Yes/No/Abstain tally
- **Online meetings** — schedule a meeting as *Online* and the app generates a **Jitsi join link** (no account needed; paste a Zoom/Meet link to use your own). Members tap **Join meeting**, or copy/open the link.
- **Phone notifications** — the app asks for permission (Settings → *Phone notifications*), then mirrors important events (contributions, loan votes, meetings) to the system tray and **schedules meeting reminders** (1 h before + at start). Uses `@capacitor/local-notifications` — fully offline, no push server.
- **Reports** — statement of accounts, contributions-by-cycle chart, CSV export, print
- **Ledger** — tamper-evident audit trail; every member sees the same numbers
- **60-second setup wizard** to create a real group; notifications centre

---

## Run in the browser (dev)

```bash
cd ChamaOne
npm install
npm run dev
```

Open the printed `localhost` URL. The app loads a realistic demo Chama; **More → Create a
new group** starts your own, **More → Settings → Reset** clears it.

---

## Build the Android APK

Uses the **same toolchain as EduOne** (this machine's proven setup).

1. Build the web bundle and add the Android platform (first time only):
   ```bash
   npm run build
   npx cap add android
   ```
2. Create `android/local.properties` with **forward slashes** (git-ignored, machine-specific):
   ```
   sdk.dir=C:/Users/USER/AppData/Local/Android/Sdk
   ```
3. Assemble the debug APK using the **Android Studio JBR (JDK 21)** — system Java (25) is too new for the Gradle wrapper:
   ```bash
   npm run android:sync
   cd android
   JAVA_HOME="/c/Program Files/Android/Android Studio/jbr" ./gradlew :app:assembleDebug --no-daemon
   ```
   Output: `android/app/build/outputs/apk/debug/app-debug.apk` (appId `com.chamaone.app`).

Or open it in Android Studio: `npm run android:open`. iOS needs a Mac (`npx cap add ios`).

---

## Architecture

```
src/
  main.jsx              boot + initNative()
  App.jsx               splash → MobileShell (local-first; officer = Chairperson)
  store/chama.js        single source of truth — state, logic, persistence + useChama() hook
  lib/mpesa.js          Daraja STK (simulation + live-backend paths)
  lib/native.js         Capacitor status bar / back button / splash
  mobile/
    mobile.css          .cha-* design system (EduOne visual language, blue brand)
    MobileShell.jsx     top bar, screen stack, bottom nav, notifications
    MobileHome.jsx      dashboard
    screens/
      registry.jsx      name → screen map + tabs
      kit.jsx           shared components + UI (sheets/toasts) context
      forms.jsx         bottom-sheet forms (collect, loan, meeting, create-group…)
      actions.js        non-UI shared actions (reminders)
      MembersScreens.jsx  LoansScreen.jsx  MeetingsScreen.jsx  MoreScreens.jsx
```

- **Data layer is isolated.** Screens only read state + call actions from `useChama()`.
  Persistence is `localStorage` today; moving to **Supabase + RLS** (per-group isolation)
  touches only `save()/load()` in `store/chama.js`.

---

## Wiring real M-Pesa (Daraja)

Ships in **Simulation mode** (Settings → *Simulate M-Pesa*). To go live, deploy a thin
backend (Node/Express or a Supabase Edge Function) holding your Daraja credentials and
exposing:

```
POST /stk-push        { phone, amount, accountRef } -> { checkoutRequestId }
GET  /stk-status/:id                                -> { status, receipt? }
POST /callback        (Daraja C2B confirmation; updates status + receipt)
```

Set `API_BASE` in `src/lib/mpesa.js`, turn Simulation off in Settings. The same
`recordContribution()` reconciliation runs on the real receipt.

> ⚠️ Never put Consumer Secret / Passkey in front-end code — the app only ever calls your backend.

---

Built for Kenyan Chamas. KES throughout. 🇰🇪

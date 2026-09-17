# Publishing ChamaOne to Google Play

This is the end-to-end checklist to get ChamaOne onto the Play Store. The code
and build tooling are ready; the steps below are the parts that must be done on
your machine and in the Play Console.

> **Debug APK vs. release bundle.** The sideload APK you’ve been testing
> (`app-debug.apk`) is **not** accepted by Play. Play needs a **signed release
> Android App Bundle** (`.aab`). Everything below produces that.

---

## 1. Create your signing key (once, and keep it forever)

Your app is signed with an **upload key** you generate. If you lose it you can’t
push updates, so back it up somewhere safe (password manager / cloud drive).

In a terminal (the `keytool` below ships with the Android Studio JDK):

```cmd
set "JAVA_HOME=C:\Program Files\Android\Android Studio\jbr"
"%JAVA_HOME%\bin\keytool" -genkeypair -v -keystore chamaone-release.keystore -alias chamaone -keyalg RSA -keysize 2048 -validity 10000
```

It asks for a password and your name/organisation. Move the resulting
`chamaone-release.keystore` somewhere outside the repo, e.g. `C:\Users\USER\keys\`.

## 2. Point the build at your key

Create a file named **`keystore.properties`** in the repo root (it is
git-ignored — never commit it):

```
storeFile=C:\\Users\\USER\\keys\\chamaone-release.keystore
storePassword=your-store-password
keyAlias=chamaone
keyPassword=your-key-password
```

(Use double backslashes in the path, as shown.)

## 3. Build the signed bundle

```cmd
npm run android:prep
cd android
gradlew.bat bundleRelease
```

Output: **`android\app\build\outputs\bundle\release\app-release.aab`** — this is
what you upload to Play. (`npm run android:prep` builds the web app, syncs
Capacitor, generates icons, stamps the version, and wires in your signing key.)

Bump `version` in `package.json` before each new release — Play refuses a
duplicate `versionCode`. The version stamp turns `1.2.0` into versionCode
`10200`, `1.2.1` into `10201`, etc.

---

## 4. Play Console account

- Go to <https://play.google.com/console>, pay the **one-time $25** fee.
- Complete Google’s **identity verification** (for personal accounts this can
  take a few days and may ask for ID — start it early).

## 5. Create the app & store listing

Create the app, then fill **Main store listing**. Suggested copy:

- **App name:** `ChamaOne — Chama Manager`
- **Short description (≤80 chars):**
  `Run your Chama with confidence: contributions, loans, meetings & books you trust.`
- **Full description:**

  > ChamaOne is the simplest way to run a Kenyan chama or savings group.
  >
  > • Transparent contributions — record every shilling, who paid and when, in a
  >   shared ledger the whole group can trust.
  > • Loans with group voting — members apply, the group votes in-app, interest
  >   and repayments track themselves.
  > • Meetings & motions — agendas, minutes and live Yes/No/Abstain voting, even
  >   for members who can’t attend in person.
  > • Everyone on the same page — one shared record, synced across every member’s
  >   phone in real time.
  > • Role-aware — chairperson, treasurer and secretary each get the tools they
  >   need; members see their own history.
  >
  > Built for Kenyan chamas. Amounts in KES throughout.

- **App icon:** upload `resources/` 512×512 icon (or export from
  `assets/icon.png`).
- **Feature graphic:** 1024×500 PNG (required). Ask and I’ll generate one.
- **Screenshots:** at least 2 phone screenshots (take them from the app —
  Home, Members, Loans, a meeting).

## 6. Privacy policy (required)

Set the **Privacy policy URL** to:

```
https://chama-one-ten.vercel.app/privacy
```

(That page ships with the app — `public/privacy.html`. Update the contact email
in it to a real inbox you check, and replace the `privacy@chamaone.app`
placeholder if you don’t own that address.)

## 7. Data safety form

Declare, truthfully, what the app collects (matches the privacy policy):

- **Personal info:** Name, Email address, Phone number — collected, not shared,
  processed to run the app; account required.
- **Financial info:** the contribution/loan records members enter. Collected,
  not shared, used only in-app. **No payment card or bank details are
  collected.**
- **Encryption in transit:** Yes.
- **Users can request deletion:** Yes (via the contact email).

## 8. Content rating

Complete the rating questionnaire. ChamaOne has no objectionable content; it will
rate **Everyone**. Don’t describe it as a real-money gambling or lending
institution — it’s a record-keeping tool.

## 9. Testing track first (Google requires this for new accounts)

New **personal** developer accounts must run a **closed test with at least 12
testers for 14 days** before you can promote to production. Plan for this:

1. Create a **Closed testing** release, upload the `.aab`.
2. Add 12+ testers (their Google emails) — your real chama members are perfect.
3. After 14 days of active testing, apply for **production access**.

(Organisation/business accounts may not need the 14-day period, but personal
ones do — build it into your launch timeline.)

## 10. Ship

Once production access is granted: create a **Production** release, upload the
signed `.aab`, complete the release notes, and roll out.

---

### Quick reference

| Task | Command / value |
| --- | --- |
| Build signed bundle | `npm run android:prep` → `cd android` → `gradlew.bat bundleRelease` |
| Output file | `android\app\build\outputs\bundle\release\app-release.aab` |
| Privacy URL | `https://chama-one-ten.vercel.app/privacy` |
| App ID | `com.chamaone.app` |
| Bump version | edit `version` in `package.json` before each release |

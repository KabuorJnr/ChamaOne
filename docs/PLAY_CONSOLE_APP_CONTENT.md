# ChamaOne — Play Console "App content" answers (v1.6.0)

Copy these into **Play Console → your app → Policy → App content**. Every
answer below matches what the app actually does, which is what Google checks.

| Item | Answer in one line |
| --- | --- |
| Privacy policy | `https://chama-one-ten.vercel.app/privacy` |
| Sign-in details | Restricted → give a reviewer account (below) |
| Ads | **No**, the app has no ads |
| Content rating | Questionnaire below → expected **Everyone / PEGI 3**, "Users Interact" |
| Target audience | **18 and over** only |
| Data safety | Table below. Delete-account URL: `https://chama-one-ten.vercel.app/delete-account` |
| Government apps | **No** |
| Financial features | **Support services → Other** (text below) |
| Health | Already done ✓ |

---

## 0. Do these first (or review will fail)

1. **Run the database update.** Supabase Dashboard → SQL Editor → paste all of
   `supabase/migrations/0006_join_approval_projects.sql` → **Run**. It is safe
   to run twice. Without it, projects only save on the phone that created them,
   join approval isn't enforced by the server, and **Delete account** shows an
   error. It also fixes a live security hole (see the commit message).
2. **Contact email** — `public/privacy.html` and `public/delete-account.html`
   list `rooneyodhiambo2004@gmail.com`. Use the same address as the
   **developer contact email** on the store listing.
3. **Deploy the website** (push to the branch Vercel builds) so these open in a
   browser:
   - `https://chama-one-ten.vercel.app/privacy`
   - `https://chama-one-ten.vercel.app/delete-account`

---

## 1. Privacy policy

**URL:** `https://chama-one-ten.vercel.app/privacy`

## 2. Sign-in details (App access)

Choose **"All or some functionality in my app is restricted"** → **Add instructions**.

Create a reviewer account first (in the app: *Create an account*). Confirm its
email if Supabase sends a link, then create a chama with a few members, one
contribution and one project, so the reviewer sees real screens.

- **Name:** Reviewer account
- **Username / email:** *(the reviewer email you created)*
- **Password:** *(its password)*
- **Any other information:**
  > Sign in with the email and password above. This account is the Chairperson
  > of the chama "Demo Chama", so all features are visible: Members (invite link,
  > join requests), Contributions, Loans records, Meetings & voting, and
  > More → Projects. No OTP, 2-step verification or location is needed. The
  > app doesn't process payments: contributions are recorded by group officers.

Tick **"No other information is required to access my app"** only if the steps
above are enough, which they are.

## 3. Ads

**Does your app contain ads?** → **No, my app does not contain ads.**
(The app has no ad SDK. Dependencies are React, Capacitor and Supabase only.)

## 4. Content rating

Start the questionnaire. Enter your email and choose the category
**"All Other App Types"**.

| Question | Answer |
| --- | --- |
| Violence, blood, gore | No |
| Sexuality / nudity | No |
| Offensive language | No |
| Controlled substances (drugs, alcohol, tobacco) | No |
| Gambling: simulated or real-money | **No** (a merry-go-round is a savings rotation, not a game of chance) |
| Users can interact or exchange content (text, images, audio) | **Yes** (members of a chama see each other's names, records, meeting minutes and motions) |
| Shares the user's current location with others | No |
| Users can purchase digital goods | No |
| Unrestricted internet access / web browser | No |
| Is it a "Miscellaneous" item like a web browser or search engine | No |

Expected result: **Everyone / PEGI 3 / IARC 3+**, with the note "Users Interact".

## 5. Target audience and content

- **Target age groups:** tick **18 and over** only.
- **Could your app unintentionally appeal to children?** → **No**
- The store listing has no child-directed imagery. ✓

## 6. Data safety

**Overview questions**

| Question | Answer |
| --- | --- |
| Does your app collect or share any of the required user data types? | **Yes** |
| Is all of the user data collected by your app encrypted in transit? | **Yes** (HTTPS to Supabase) |
| Which of the following methods of account creation does your app support? | **Username and password** (email + password) |
| Delete account URL | `https://chama-one-ten.vercel.app/delete-account` |
| Do you provide a way for users to request that some or all of their data is deleted, without requiring them to delete their account? | **No** (deletion is whole-account: in the app, or by email) |

**Data types.** Tick exactly these. For each one: **Collected = Yes, Shared = No,
Processed ephemerally = No**.

| Category → type | Required or optional | Purposes |
| --- | --- | --- |
| Personal info → **Name** | Required | App functionality, Account management |
| Personal info → **Email address** | Required | App functionality, Account management |
| Personal info → **User IDs** | Required | App functionality, Account management |
| Personal info → **Phone number** | Optional | App functionality |
| Financial info → **Other financial info** (contributions, loans, repayments members record) | Optional (users choose to enter it) | App functionality |
| App activity → **Other user-generated content** (meeting minutes, motions, votes) | Optional | App functionality |

**Do not tick:** Location, Contacts, Photos/Videos, Audio, Files, Calendar,
Messages (SMS), Health, Web browsing, App activity → *App interactions*,
Crash logs, Diagnostics, Device or other IDs, or Financial info → *Payment
info / Credit score / Purchase history*. The app collects none of these. It
has no analytics or crash SDK, and the M-Pesa SMS parser reads only text the
user pastes; it has no SMS permission.

"Shared = No" is correct because Supabase is a **service provider** that
processes data on your behalf, which Play's definition doesn't count as sharing.

## 7. Government apps

**Is your app developed by or on behalf of a government?** → **No**

## 8. Financial features

Choose **Support services → Other**, and describe it:

> ChamaOne is a record-keeping tool for informal savings groups (chamas). Group
> officers record contributions, loans between the group and its members,
> meeting decisions and projects in a shared ledger. The app does NOT hold,
> transfer, lend or invest money, does not connect to bank or M-Pesa accounts,
> does not offer credit, and does not process payments. All money moves outside
> the app; ChamaOne only records it.

Why not the other options: chamas resemble **"Crowdfunding and chit funds"**,
and group loans resemble **"Loan facilitator"**, but both categories cover apps
that *move or lend money*. ChamaOne doesn't, and choosing them can trigger
licence-document requirements (for example Central Bank of Kenya digital credit
rules). If a reviewer asks, send them the description above.

## 9. Health

Already completed ✓

---

## Store listing: recommended wording change

Loan apps get extra scrutiny in Kenya. Describe loans as **records**, not an
offer of credit. Replace the "Loans with group voting" bullet in the full
description with:

> • Loan records with group voting — members request a loan from their own
>   group, everyone votes in-app, and interest and repayments are tracked
>   automatically. ChamaOne keeps the records; it does not lend money.

And add this line at the end:

> ChamaOne is a record-keeping tool. It does not hold, move or lend money.

---

## Release notes for 1.6.0 (paste into the open-testing release)

```
<en-US>
• New: Chama officers approve people who join with the invite link before they can see the group. The Chairperson can switch this off.
• Fixed: Projects & investments now save and sync to every member's phone (they used to disappear).
• The Merry-go-round roster now syncs across phones.
• New: Delete your account from More → Delete account.
• Security and reliability fixes.
</en-US>
```

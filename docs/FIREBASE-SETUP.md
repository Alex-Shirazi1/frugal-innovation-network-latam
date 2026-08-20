# Firebase: what is set up, and how to move it to production

Companion to [DEPLOYMENT.md](DEPLOYMENT.md), which is the step-by-step guide, and
to [NEXT-STEPS.md](NEXT-STEPS.md), which is what is still outstanding and how to
get access to do it.
This is the **state of the world** — what exists today on `relif-s-website`, who
can change it, and what is not encoded anywhere in this repository and would
therefore have to be redone by hand on a replacement project.

Live project state last verified: **2026-08-20**, when the site moved off
`raif-af800` onto the network's own project. The old project still exists and its
credentials still work; nothing here depends on it any more.

## The project

| | |
|---|---|
| Project ID | `relif-s-website` |
| Display name | RELIF's Website |
| Project number | `4139696496` |
| Plan | **Spark (free)** — no billing account, deliberately |
| Owners | `fihcloudservices@gmail.com`, `ashirazi@scu.edu` (`roles/owner`) |
| Editors | `danguyen@scu.edu` |
| Firestore | `(default)`, **nam5** (US multi-region), Native mode, free tier |
| Hosting | `relif-s-website.web.app` · `relif-s-website.firebaseapp.com` |

Predecessor: `raif-af800` (display name RAIF, number 278114521173), which sat
under a personal gmail account. It is no longer deployed to.

**The Firestore location is permanent.** nam5 cannot be changed — moving means
exporting and re-importing into a different project.

Note the role boundary, because it costs a day if rediscovered the hard way:
`roles/editor` cannot create a Firestore database (`datastore.databases.create`
is excluded from that role) and cannot grant roles (`setIamPolicy`). The Firebase
console reports this only as "ask a project owner for the necessary
permissions". Anyone expected to administer the backend needs Owner.

### The Spark plan is a constraint, not a default

A Mexican university pays for the current hosting and costs must not rise
without asking. That single fact drives the architecture: no Cloud Functions
(they force Blaze), approval is a client-side copy authorised by
`firestore.rules`, and site content lives in the repo rather than the database.

There is no card on file, so nothing here *can* generate a bill.

**If the console offers to "upgrade to Identity Platform", decline it.** That is
the paid tier. Plain Firebase Authentication is free and is what this site uses.
The distinction is easy to miss because the APIs share a hostname: enabling
Identity Platform programmatically fails with `BILLING_NOT_ENABLED`, which reads
like Firebase Auth needs billing. It does not.

## Current state

| Thing | State |
|---|---|
| Firestore database | created (nam5, Native, free tier) |
| Rules and indexes | deployed by CI, 47 emulator tests gating |
| Hosting | live, auto-deploys from `main` |
| `members` | **3 real profiles**, imported from the bundle |
| Authentication | **NOT set up** — `CONFIGURATION_NOT_FOUND` |
| Admin account | **none** — blocked on Authentication |
| `initiatives` / `bibliography` | **empty** — Import not yet pressed |
| App Check | **not enabled** |

Verified against the live project on 2026-08-20 by unauthenticated REST read:
`members` and `initiatives` are readable, `submissions` and `formResponses` both
refuse with `PERMISSION_DENIED`.

**Authentication is the blocking gap.** It has never been initialized here, so
nobody can sign in to `/admin`, which is why `initiatives` and `bibliography` are
still empty and the site serves the bundled copies of both. Open Firebase console
→ Authentication → Get started → enable Email/Password. Do this in the console
rather than through the Identity Toolkit API: creating the config programmatically
goes down the Identity Platform path, which is the paid tier (see "The Spark plan
is a constraint" above).

### Collections

| Collection | Public read? | Written by |
|---|---|---|
| `submissions` | **no** — holds personal data | the join form (create only) |
| `formResponses` | **no** — holds personal data | the Apps Script transport, via the `importer` claim |
| `members` | yes | a moderator, from the panel |
| `initiatives` | yes | the admin panel |
| `bibliography` | yes | the admin panel |
| `resources` | yes | nothing any more — editor removed |
| `siteContent/congress` | yes | the admin panel |

An **empty** collection makes the site fall back to the seed compiled into the
bundle. That is why the panel has an explicit Import step, and why deleting
every card from a section restores the original rather than blanking the page.
An empty `members` collection used to publish 54 fabricated profiles. It no
longer does: the bundled seed is now three real, consenting people, and they are
also written into Firestore, so the fallback and the database agree.

`formResponses` is the most sensitive collection here: it holds a vetted
applicant's contact address alongside every answer they gave, it is retained
after publication because `members` deliberately stores no address, and it has no
update rule at all — a response records what somebody actually submitted.

## Logins and credentials

| What | Used for | How to get it |
|---|---|---|
| `gcloud auth login` | CLI access | `alexxshirazi@gmail.com` |
| `gcloud auth application-default login` | **`grant-admin` only** | separate command; ADC is its own credential |
| `npx firebase login` | emulators, manual deploys | same account |
| `gh auth login` | pushing | GitHub |

The two `gcloud` commands are **not interchangeable**. The Firebase Admin SDK
reads Application Default Credentials specifically, and skipping the second is
the usual reason `grant-admin` fails. ADC also expires — a stale
`~/.config/gcloud/application_default_credentials.json` fails with
`invalid_grant: Bad Request`, and re-running the login overwrites it.

### Moderators

Two things must be true, and they are separate on purpose:

- **Authentication** — email and password, held hashed by Firebase Auth.
- **Authorisation** — the `admin` custom claim, which is what
  `firestore.rules` actually checks.

Signing in without the claim signs you straight back out. That split is what
lets a password be rotated, or an account disabled, from the console without
touching the rules or redeploying.

```bash
gcloud auth application-default login
npm run grant-admin -- someone@example.com --create   # new moderator
npm run grant-admin -- someone@example.com            # existing account
npm run grant-admin -- someone@example.com --revoke   # remove the claim
npm run grant-admin -- someone@example.com --revoke --revoke-sessions   # offboard
```

`--revoke-sessions` invalidates the account's refresh tokens. Without it a
signed-in session renews itself forever, so a lost laptop or a phished password
stays live and changing the password does not end it. Neither flag takes effect
the instant it runs: both the `admin` claim and the session are read from an ID
token that Firebase issues for up to an hour, so an hour is the floor either way.
The flag is what stops the hour from being forever.

`--create` makes the account and prints a **password-reset link** rather than
setting a password, so the password never enters a terminal, a shell history or
a chat log.

**There is no console UI for custom claims.** This script is the only way, which
is why ADC is unavoidable.

## Secrets — only one of them is a secret

`VITE_*` values are inlined into the JavaScript by Vite, so every one of them is
readable by anyone who opens the site and views source. They live in GitHub
Actions secrets for two reasons that are **not** confidentiality:

- this repository is public, so a committed value is in the history of every
  clone and fork for good;
- a secret can be rotated without a code change.

Moving them to Secret Manager, Firestore or Remote Config would change where CI
reads them and nothing else — they still end up in the bundle. A browser
application cannot hold a secret. Anything that genuinely must stay private
needs a server, which this project deliberately does not have.

| Secret | Purpose | Actually secret? |
|---|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | CI deploy credentials | **yes** |
| `VITE_FIREBASE_API_KEY` · `_PROJECT_ID` · `_APP_ID` | web config | no — publishable |
| `VITE_NOTIFY_TARGET` | FormSubmit alias | no — an opaque alias |
| `VITE_POSTHOG_KEY` | analytics | no — write-only |

The MyMemory translation contact is **not** on this list. It is the network's
own address, read from `networkEmails.general` in the code, because the site
already prints it on the contact page — a secret would have been protecting
something already published.

The one worthwhile improvement is **Workload Identity Federation** for
`FIREBASE_SERVICE_ACCOUNT`: GitHub mints a short-lived token per run and no
long-lived JSON key exists anywhere. That is a better answer than a different
vault.

## Moving to a production project

None of the console configuration is in the repo. All of it has to be redone,
and the order below is deliberate.

### Read this before anything else

**Whatever is compiled into `src/data/members.ts` is what the public sees until
Firestore has profiles of its own.**

An empty collection makes the site fall back to the bundled seed. That seed used
to be 54 invented people with dead `scholar.example.org` links, and pointing a
domain at a fresh project published all 54 with nothing erroring and nothing
looking broken. It was the single most likely way a launch went wrong.

It is now three real, consenting members, so the fallback is safe — but the rule
still holds: check what the bundle contains before pointing a domain anywhere.

### Never do these on a production project

- **`npm run seed:members` without exporting first.** It CLEARS the members
  collection before writing the bundle, so any profile published through the
  panel and absent from the repo is destroyed — and published profiles are
  exactly what the repo cannot give back. Run `npm run export` first.
- **Reusing the preproduction transport or moderator passwords.** Generate new
  ones; the old project stays alive and its credentials keep working.
- **Hand-editing `firestore.rules`.** It is generated. Edit
  `server/scripts/generate-firestore-rules.ts` and run `npm run rules`.

### The checklist

0. **Get Owner on the project.** `roles/editor` cannot create the database or
   grant roles. Budget for a wait here if the Owner is someone else.
1. **Create the project.** Keep it on Spark. Update the id in **six** places:
   `.firebaserc`, the `emulators` script in `package.json`, the `projectId` in
   `.github/workflows/firebase-hosting-deploy.yml`, and the defaults in
   `server/scripts/seed-emulator.ts`, `grant-admin.ts`, `seed-members.ts` and
   `export-firestore.ts`.
2. **Create the Firestore database. The location is permanent** — there is no
   move later, only an export and re-import into a new project.
3. **Enable Email/Password** under Authentication, and add the hosting domains
   plus the eventual custom domain to **Authorized domains**. Sign-in fails
   *silently* from an unlisted domain, with no console error worth reading.
4. **Re-grant the `admin` claim** to every moderator:
   `npm run grant-admin -- someone@example.org --create`. Custom claims live on
   the Auth user record and **do not come across in a data export** — the step
   most likely to be forgotten, and the symptom is a moderator who can sign in
   but whose every write is refused.
5. **Create the incorporation-form transport account:**
   `npm run grant-admin -- transport@example.org --create --importer`. The
   `importer` claim is narrower than `admin` by design — it may only deposit form
   responses, not read them or publish anybody.
6. **Grant the CI service account** its three roles (below).
7. **Set the Actions secrets** for the new project: `VITE_FIREBASE_API_KEY`,
   `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID`, `FIREBASE_SERVICE_ACCOUNT`,
   plus `VITE_NOTIFY_TARGET` and `VITE_POSTHOG_KEY` if those are wanted.
8. **Push to `main`.** CI deploys rules, indexes and hosting. Rules bring every
   collection's permissions with them, so nothing about `formResponses`,
   `members` or the claims needs configuring by hand.
9. **Press Import** in the panel for Iniciativas and Bibliografía. Until then the
   editors are inert while the site serves the bundled seed.
10. **Re-install the Apps Script transport** on the incorporation form, pointing
    its `FIREBASE_PROJECT_ID` and `FIREBASE_API_KEY` script properties at the new
    project and its `IMPORTER_EMAIL` / `IMPORTER_PASSWORD` at the account from
    step 5. Run `testTransport` once; discard the `PRUEBA / DESCARTAR` row it
    deposits. See DEPLOYMENT.md, "Wiring the incorporation form".
11. **Turn on App Check** (free) and add `request.app != null` to the
    `submissions` create rule. Until this is done, anyone can post to the intake
    queue with `curl` — the public join form relies on unauthenticated create.
12. **Decide about MFA** for moderator accounts. This is a cost decision, not a
    technical one: multi-factor authentication requires the Identity Platform
    upgrade, which is the paid tier this project deliberately declines (see "The
    Spark plan is a constraint" above). Credential theft is the realistic route
    into the panel, so it is worth putting to Allan — but it cannot be switched on
    without changing the billing posture. Until then, the mitigations are a
    unique password in a password manager, the 30-minute idle timeout, and
    `grant-admin --revoke --revoke-sessions` to cut an account off — within the
    hour an already-issued ID token stays valid, not instantly.
13. **Set a budget or quota alert**, so a traffic spike or an abuse run is
    noticed rather than silently exhausting the day's Firestore reads or the
    Hosting transfer allowance.
14. **Point the domain.** The existing site's DNS is managed in cPanel; the
    redirect is the last step, after the checks below pass.

### Before pointing the domain at it

- The directory shows real people, not the 54 mocks (see above).
- A moderator can sign in at `/admin` and edit all four tabs.
- A test submission through the public join form arrives as a FormSubmit email.
- `testTransport` deposited a row and it appeared in the Members tab.
- The browser console on the deployed site is clean — CSP problems only appear
  once the site is live with analytics configured, never in a local build.

### What you do NOT need to do

Collections are created implicitly by their first write, so there is nothing to
provision. Rules and indexes deploy from the repo. There is no schema and no
migration.

### The CI service account roles

`firebase-adminsdk-fbsvc@<project>.iam.gserviceaccount.com` needs:

- `roles/serviceusage.serviceUsageViewer`
- `roles/datastore.indexAdmin`
- `roles/firebaserules.admin`

Twelve consecutive deploys once failed because these were missing. The failure
is confusing: the rules step fails first and the hosting step is *skipped*, so
the site simply stops updating with no obvious cause. **Check these bindings
first when a deploy misbehaves.**

## Known issues

- **App Check is not enabled**, so `submissions` still accepts unauthenticated
  creates — that is how the public join form works, and it means anyone can post
  to the intake queue with `curl`. Step 11 of the production checklist. It is
  also the cheapest protection against a Firestore quota exhaustion run.
- **Backups are manual.** `npm run export` dumps every collection to timestamped
  JSON under `firestore-backups/` (gitignored, and it must stay that way — the
  file carries `submissions` and `formResponses`, including the email addresses
  the rules keep out of the world-readable `members`). Nothing runs it on a
  schedule: scheduled exports need Blaze, so somebody has to remember, and the
  honest expectation is "whatever the last person exported". Run it before any
  bulk edit or import. Note it captures documents only — custom claims live on
  the Auth user record and are not covered, so a restore also means re-running
  `grant-admin` for each moderator.
- **Hosting transfer is the tightest quota.** `public/` is roughly 45 MB, mostly
  bibliography PDFs, and Spark's daily transfer allowance is small enough that a
  scripted download loop could exhaust it. Compressing the PDFs is the cheapest
  mitigation; there is no fallback for Hosting being out of quota, unlike
  Firestore.
- **`singleProjectMode` is on** in the emulator config, so `npm test` writes its
  fixtures into a running emulator regardless of project id. Stray "Ada
  Lovelace" rows come from that, not from real data.
- **The FormSubmit email is the only handoff** for the join form now that the
  admin requests queue is gone. Submissions are still stored and still readable
  by an admin through `adminApi.listPending`, but nothing surfaces them. Worth
  sending a real test submission through the live form to confirm delivery.
- **macOS TCC**: keeping the working copy under `~/Desktop` (or Documents or
  Downloads) can have tooling lose file access mid-session. A plain path such as
  `~/dev` avoids it.

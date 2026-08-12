# Firebase: what is set up, and how to move it to production

Companion to [DEPLOYMENT.md](DEPLOYMENT.md), which is the step-by-step guide.
This is the **state of the world** — what exists today on `raif-af800`, who can
change it, and what is not encoded anywhere in this repository and would
therefore have to be redone by hand on a replacement project.

Live project state last verified: **2026-08-10**. The collections table, the
production checklist and the known issues were updated **2026-08-12** when the
incorporation-form pipeline landed — those additions describe the code as
committed, not a re-inspection of the console.

## The project

| | |
|---|---|
| Project ID | `raif-af800` |
| Display name | RAIF |
| Project number | `278114521173` |
| Plan | **Spark (free)** — no billing account, deliberately |
| Owner | `alexxshirazi@gmail.com` (`roles/owner`) |
| Hosting | `raif-af800.web.app` · `raif-af800.firebaseapp.com` |

The project sits under a personal Google account. The network should not depend
on that long term — transferring means adding Allan as an Owner under **Project
settings > Users and permissions**, which is free and takes a minute.

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

## Current state — all green

| Thing | State |
|---|---|
| Firestore database | created, rules and indexes deployed by CI |
| Authentication | **Email/Password enabled** |
| Admin account | `contacto@redinnovacionfrugal.lat`, holds the `admin` claim |
| Seed import | **done** — 7 initiatives, 43 bibliography entries |
| Hosting | live, auto-deploys from `main` |

Verified by reading the live project: `initiatives` and `bibliography` return
real documents, and `submissions` correctly refuses an anonymous reader with
`PERMISSION_DENIED`.

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
It also means an empty `members` collection publishes 54 fabricated profiles —
see "Moving to a production project" below.

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
npm run grant-admin -- someone@example.com --revoke   # remove
```

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

**A fresh project will publish 54 fabricated academics.**

The `members` collection is empty on a new project, and an empty collection makes
the site fall back to the seed compiled into the bundle — which is 54 invented
people with invented job titles, biographies and dead `scholar.example.org`
links. Point a real domain at a fresh project and that is what the public sees.

There are two ways out and you must pick one before launch:

- Publish real profiles first. The first stored record replaces the mock set
  outright, so one real member is enough to clear all 54.
- Or strip the mock seed from `src/data/members.ts`, which leaves the directory
  genuinely empty until real profiles exist.

This is the single most likely way a production launch goes wrong, because
nothing errors and nothing looks broken.

### Never do these on a production project

- **`npm run seed:members`** — writes those 54 fabricated profiles into
  Firestore on purpose. It is a preproduction tool. It prints the project id and
  demands `--confirm` for exactly this reason.
- **Reusing the preproduction transport or moderator passwords.** Generate new
  ones; the old project stays alive and its credentials keep working.
- **Hand-editing `firestore.rules`.** It is generated. Edit
  `server/scripts/generate-firestore-rules.ts` and run `npm run rules`.

### The checklist

1. **Create the project.** Keep it on Spark. Update the id in **five** places:
   `.firebaserc`, the `emulators` script in `package.json`, and the defaults in
   `server/scripts/seed-emulator.ts`, `grant-admin.ts` and `seed-members.ts`.
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
    `grant-admin --revoke` to disable an account immediately.
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
- **No backups exist.** Nothing dumps Firestore anywhere. If content is deleted,
  the only recovery is the repo seed, which loses every real edit. Managed
  backups need Blaze; a local export script does not.
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

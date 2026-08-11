# Firebase: what is set up, and what a new project would need

Companion to [DEPLOYMENT.md](DEPLOYMENT.md), which is the step-by-step guide.
This is the **state of the world** — what exists today on `raif-af800`, who can
change it, and what is not encoded anywhere in this repository and would
therefore have to be redone by hand on a replacement project.

Last verified against the live project: **2026-08-10**.

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
| `members` | yes | a moderator, publishing a submission |
| `initiatives` | yes | the admin panel |
| `bibliography` | yes | the admin panel |
| `resources` | yes | nothing any more — editor removed |
| `siteContent/congress` | yes | the admin panel |

An **empty** collection makes the site fall back to the seed compiled into the
bundle. That is why the panel has an explicit Import step, and why deleting
every card from a section restores the original rather than blanking the page.

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

## What a new Firebase project would need

None of this is in the repo. All of it has to be redone.

1. **Create the project**, keep it on Spark. Update the id in `.firebaserc`, in
   the `emulators` script in `package.json`, and in `server/scripts/`
   (`seed-emulator.ts` and `grant-admin.ts` default to `raif-af800`).
2. **Create the Firestore database.** Location is permanent. CI deploys rules
   and indexes on the next push.
3. **Enable Email/Password** under Authentication, and add the hosting domains
   to Authorized domains — sign-in fails *silently* from unlisted domains.
4. **Re-grant the `admin` claim** to every moderator. It lives on the Auth user
   record and **does not come across in a data export** — this is the step most
   likely to be forgotten.
5. **Grant the CI service account** its roles (below).
6. **Set the Actions secrets** for the new project.
7. **Press Import** in the panel for Iniciativas and Bibliografía, or the
   editors stay inert while the site serves the bundled seed.

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

- **`firebase.json` has no `headers` block**, so `index.html` is served with
  `cache-control: max-age=3600`. A returning visitor can see a stale build for
  up to an hour. Fix: `no-cache` on `index.html`, long-lived immutable caching
  on the hashed `/assets/*`. Until then, verify a deploy with a hard refresh or
  a cache-busting query string.
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

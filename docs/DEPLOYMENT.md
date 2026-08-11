# Deploying the members backend

Everything in the repo is done. What remains is console work that needs your
Firebase login — I cannot create projects, enable services, or grant admin
claims from here.

Budget for it: **about 40 minutes**, mostly waiting on Firestore provisioning.

## Why this shape

Allan was explicit in the kickoff that a university in Mexico pays for the
current hosting and that costs must not rise without asking first. That
constraint drove the design:

- **Firestore, not a container.** ~50 member records on the Spark (free) plan
  uses a rounding error of the 50k reads / 20k writes per day allowance. A
  Cloud Run or Render container for 50 rows would force a managed database and
  a real bill.
- **No Cloud Functions anywhere.** Functions requires the Blaze plan and a
  linked billing account. Approval is therefore a client-side copy performed by
  a moderator, authorised by `firestore.rules`. Nothing here can generate a
  charge.
- **Site content stays in the repo.** Institutions, resources, conference data
  and form options are versioned code, served from the bundle. Firestore holds
  only what users generate, which keeps reads near zero.

The cPanel host and the live `redinnovacionfrugal.lat` database are never
touched. This is a parallel backend.

## What you must do

### 1. Confirm who owns the Firebase project

The deploy workflow targets project `raif-af800`. Check whose account that sits
under:

```bash
npx firebase login
npx firebase projects:list
```

If it is your personal account, tell Allan — the network should not depend on a
student's account long term. Transferring later means adding him as an Owner in
**Project settings > Users and permissions**, which is free.

### 2. Create the Firestore database

Console > **Firestore Database** > *Create database*.

- Mode: **Production mode** (locked by default; our rules then open exactly
  what is needed)
- Location: `nam5` (US multi-region) or `southamerica-east1` (São Paulo) if you
  prefer data closer to the network. **This is permanent** — it cannot be
  changed later without recreating the database.

### 3. Enable Email/Password sign-in

Console > **Authentication** > *Get started* > **Email/Password** > enable >
Save. Leave "Email link (passwordless sign-in)" off.

Then under **Authentication > Settings > Authorized domains**, confirm your
hosting domain is listed (`raif-af800.web.app` and any custom domain). Sign-in
silently fails from unlisted domains.

Not Google sign-in. The network has one shared mailbox rather than a set of
named moderators, so identity through a personal Google account modelled a
distinction that does not exist — and it required whoever holds the panel to
have a Google account at all. Email/password keeps the same security boundary:
the password is hashed on Firebase's side and never enters the bundle, and the
`admin` claim is still what authorises.

### 4. Deploy the security rules

**CI does this for you** once step 6 is done. The workflow deploys
`firestore.rules` and `firestore.indexes.json` on every push to `main`, right
before the hosting deploy, gated behind the 47 emulator tests.

That matters because the rules are *generated* from
`src/data/onboardingOptions.ts`. Without automatic deployment the enforced rules
silently lag the code — add a country, and every signup from it gets rejected by
stale rules with an error that gives no clue why.

The service account in `FIREBASE_SERVICE_ACCOUNT` was created for Hosting only,
so it likely needs one more role. In the Google Cloud console →
**IAM & Admin → IAM**, find the service account and add **Firebase Rules Admin**
(`roles/firebaserules.admin`). Without it the deploy step fails with a
permissions error.

To deploy by hand — for the very first time, or to check something ad hoc:

```bash
npm run rules          # regenerate from the canonical data
npm test               # includes the drift guard
npm run test:rules     # behavioural tests against the emulator (needs Java)
npx firebase deploy --only firestore:rules,firestore:indexes
```

Do not hand-edit `firestore.rules` — it is generated, and the drift test will
fail the build. Change `src/data/onboardingOptions.ts` and run `npm run rules`.

### 5. Create the account and grant the admin claim

This is the only step with no console UI. Moderation is gated on a custom claim,
not merely on being signed in, so someone has to set it once per moderator.

Authenticate once, then run the script — no service-account key is downloaded,
so there is no long-lived secret to leak or remember to delete:

```bash
gcloud auth application-default login
npm run grant-admin -- contacto@redinnovacionfrugal.lat --create
```

`--create` makes the account when it does not exist yet and prints a
**password-reset link**. Open that link to choose the password. Doing it this
way means the password is never typed into a terminal, a chat window or a
shell history — the only place it ends up is Firebase Auth's hash and whatever
password manager you paste it into.

For an account that already exists, drop `--create`. To remove a moderator:

```bash
npm run grant-admin -- someone@example.com --revoke
```

Signing in is not enough on its own: an account without the claim is signed
straight back out and sees "this account has no moderation permissions", which
is the intended refusal. After the claim is granted the account must sign out
and back in, because the claim rides in the ID token.

### 6. Point the site at Firestore

Add these as GitHub Actions repository secrets (**Settings > Secrets and
variables > Actions**):

| Secret | Where to find it |
| --- | --- |
| `VITE_FIREBASE_API_KEY` | Project settings > Your apps > SDK setup |
| `VITE_FIREBASE_PROJECT_ID` | same |
| `VITE_FIREBASE_APP_ID` | same |

These are publishable client identifiers, not secrets in the cryptographic
sense — the rules are the security boundary — but keeping them out of the
repo avoids them being scraped and abused for quota.

Then add them to the build step in
`.github/workflows/firebase-hosting-deploy.yml`, alongside the existing
`VITE_POSTHOG_KEY`:

```yaml
      - name: Build project
        run: npm run build
        env:
          VITE_POSTHOG_KEY: ${{ secrets.VITE_POSTHOG_KEY }}
          VITE_FIREBASE_API_KEY: ${{ secrets.VITE_FIREBASE_API_KEY }}
          VITE_FIREBASE_PROJECT_ID: ${{ secrets.VITE_FIREBASE_PROJECT_ID }}
          VITE_FIREBASE_APP_ID: ${{ secrets.VITE_FIREBASE_APP_ID }}
```

With those present the site auto-selects the Firestore adapter. No code change
is needed — `VITE_DATA_SOURCE` only exists to override the default.

`VITE_FIREBASE_PROJECT_ID` also acts as the switch that turns on the Firestore
steps in CI: until it is set, the rules tests and rules deploy skip themselves
and the workflow behaves exactly as it does today. Setting it is what activates
the backend half of the pipeline, so add all three at once and push.

### 7. Turn on App Check (recommended, free)

Intake writes are unauthenticated by design — requiring accounts would kill
adoption among 40-60 academics. The rules constrain *what* can be written but
cannot stop a script from writing valid-looking junk repeatedly.

Console > **App Check** > register the web app with **reCAPTCHA v3**, then set
Firestore to *Enforced*. Add the site key as `VITE_FIREBASE_RECAPTCHA_KEY` and
tell me — wiring it needs a small code change in `src/lib/firebase.ts` that I
deliberately left out rather than guess at your key setup.

Until then the honeypot field catches naive bots and nothing else does.

## Verify it worked

1. Open the deployed site, submit the join form. It should say *"Solicitud
   recibida"* — request received, pending review.
2. Console > Firestore > `submissions` should show one document with
   `status: "pending"`.
3. Open `/admin` as Allan, approve it.
4. The document moves to `members`; the profile appears in the public
   directory.
5. In a private window, confirm the directory shows the new member and that
   `submissions` is unreadable.

If step 1 shows *"No pudimos guardar tu solicitud"* the site could not reach
Firestore — check the browser console, the env vars, and that rules are
deployed. That message is deliberate: the form refuses to claim success for a
submission it did not store.

## Local development is unaffected

None of this is needed to work on the site:

```bash
npm run dev:all   # Vite + the local Express API on :3001
```

The Express server in `server/` is the local backend. It shares the same
validator as production (`src/domain/intake.ts`) and the same request contract,
so behaviour matches. It is never deployed.

## Ongoing costs

Zero, on current numbers. Spark plan limits are 50k document reads and 20k
writes per day, 1 GiB stored. A 60-member directory with normal traffic uses a
fraction of one percent. Hosting for a static site is likewise free.

The only way this generates a bill is enabling Blaze, which nothing in this
design requires. If someone later proposes Cloud Functions, scheduled jobs, or
server-side rendering, that is the moment to talk to Allan about cost.

## Where secrets live, and why GitHub is the right place

Worth being precise, because "secrets" here covers two different things.

**The `VITE_*` values are not secrets.** Vite inlines them into the JavaScript
at build time, so every one of them is readable by anyone who opens the
deployed site and views source. That is not a leak — it is how a static site
works, and `firestore.rules` is the actual security boundary. They live in
GitHub Actions secrets for two reasons that have nothing to do with
confidentiality:

- the repository is public, so a value committed to it is in the history of
  every clone and fork permanently;
- a secret can be rotated by changing one field, without a code change.

Moving them to Google Secret Manager or Firebase would change where CI reads
them from and nothing else — they would still end up inlined in the bundle. A
browser application cannot hold a secret. If something genuinely must stay
private, it cannot go in the client at all; it needs a server, which this
project deliberately does not have.

**`FIREBASE_SERVICE_ACCOUNT` is a real secret.** It grants administrative
access to the whole project. A GitHub Actions secret is a reasonable home, but
the stronger option is **Workload Identity Federation**: GitHub mints a
short-lived token per run and no long-lived JSON key exists anywhere. That is
the one secrets change actually worth making here. Firebase offers nothing that
improves on it.

## Migrating to a different Firebase project

Everything below was configured by hand on `raif-af800` and has to be
reproduced on any replacement. The repository does not encode it.

**Project**

- Project id `raif-af800` (display name RAIF, number 278114521173), on the
  **Spark** plan. Deliberately no billing account — see "Ongoing costs".
- Set the new id in `.firebaserc`, in `npm run emulators`, and in
  `server/scripts/seed-emulator.ts` / `grant-admin.ts`, which default to it.

**Hosting** — serves `dist`, with every path rewritten to `/index.html` for the
SPA. Config is committed in `firebase.json`; nothing to do by hand.

**Firestore** — create the database, then let CI deploy rules and indexes.
Collections used: `submissions`, `members`, `initiatives`, `bibliography`,
`resources`, and `siteContent/congress`. `firestore.rules` is **generated** from
`src/data/onboardingOptions.ts` by `npm run rules`; edit the generator, not the
output.

**Authentication** — enable the **Email/Password** provider, add the hosting
domains under Authorized domains, then create each moderator and grant the
`admin` claim (step 5). The claim is not stored in Firestore and does not
migrate with a data export — it lives on the Auth user record and must be
re-granted per project.

**Service account for CI** — the deploy uses
`firebase-adminsdk-fbsvc@<project>.iam.gserviceaccount.com`. Twelve consecutive
deploys once failed because it lacked permissions; the rules step failed first
and the hosting step was skipped. It needs:

- `roles/serviceusage.serviceUsageViewer` (`serviceusage.services.get`)
- `roles/datastore.indexAdmin` (`datastore.indexes.*`)
- `roles/firebaserules.admin` (`firebaserules.rulesets.test`)

If deploys start failing after a migration, check these bindings first.

**GitHub Actions secrets** the workflow reads:

| Secret | Purpose | Real secret? |
|---|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | CI deploy credentials | **Yes** |
| `VITE_FIREBASE_API_KEY` · `_PROJECT_ID` · `_APP_ID` | web config | No — publishable |
| `VITE_NOTIFY_TARGET` | FormSubmit alias for join notifications | No |
| `VITE_POSTHOG_KEY` | analytics project key | No — write-only |

The MyMemory translation contact is **not** in this list: it is the network's
own address, read from `networkEmails.general` in the code. Nothing to set.

**Emulator** — ports and `singleProjectMode` are committed in `firebase.json`.
Note that `singleProjectMode` means `npm test` writes its fixtures into a
running emulator regardless of project id.

## Response headers

`firebase.json` carries a `headers` block. JSON cannot hold comments, so the
reasoning lives here.

**Caching.** `no-cache, must-revalidate` is the default on `**`, with hashed
`/assets/*` overridden to `immutable` for a year and PDFs and images to 30 days.
Later, more specific entries win — verified against the hosting emulator, not
assumed.

The default deliberately sits on `**` rather than on `/index.html`. **Hosting
matches header rules against the request path, not against the rewrite
destination.** Every route on this site is rewritten to `/index.html`, so a rule
scoped to `/index.html` matches nothing a visitor actually requests: `/` and
`/admin` kept inheriting `max-age=3600` and a returning visitor could still see
an hour-old build. This was live for one deploy before being caught.

The caching is not only a freshness fix. Hosting transfer is the tightest quota
on the Spark plan and `public/` is ~45 MB of bibliography PDFs, so a repeat
visitor served from cache is quota not spent.

**CSP.** Enumerated from what the code actually requests, not from a template.
Anything added to this list should be traceable to a real call site:

| Directive | Why |
| --- | --- |
| `script-src` | `'self'` plus `us-assets.i.posthog.com`. The `posthog-js` module itself is a bundled dynamic import (`src/lib/analytics.tsx`), but at runtime it fetches its own extensions from that asset host — `config.js`, `web-vitals.js`, `posthog-recorder.js`, `dead-clicks-autocapture.js`. No `unsafe-inline` is needed. |
| `style-src` + `unsafe-inline` | The Google Fonts stylesheet, plus ~10 components using React `style={{...}}` props, which emit inline style attributes. |
| `font-src` | `fonts.gstatic.com`, per the `preconnect` in `index.html`. |
| `connect-src` | Firestore, Identity Toolkit and Secure Token (Firebase SDK); MyMemory (`src/lib/translate.ts`); FormSubmit (`src/lib/notifyNewMember.ts`); PostHog ingestion. |
| `img-src 'self' data:` | No hotlinked images anywhere — institution entries carry links, not logos. |
| `frame-src`/`frame-ancestors 'none'` | The site embeds nothing and must not be embedded. Spotify is a link, not an iframe. |

If `VITE_POSTHOG_HOST` is ever repointed at the EU cloud or a self-hosted
instance, both `connect-src` and `script-src` need the matching origins — the
EU asset host is `eu-assets.i.posthog.com`.

**Check the console on the live site after changing any of this, not just
locally.** A local build without `VITE_POSTHOG_KEY` never loads PostHog at all,
so the entire analytics half of this policy is untested until it is deployed.
That is how the missing asset host reached production: clean locally, four
blocked scripts live.

`Strict-Transport-Security` here omits `preload`, because preloading is a
practical one-way door for an apex domain and every subdomain under it. Note
that on `*.web.app` and `*.firebaseapp.com` Hosting substitutes its own HSTS
header with `preload` regardless, since Google already has those domains on the
preload list. The value set here is what a custom domain would receive.

## Things deliberately not done

- **CV upload.** Allan never asked for it, and the old form only stored a
  filename — no file was ever transmitted. Removing it deleted a file-upload,
  malware-scanning and PII-retention surface, since CVs routinely carry home
  addresses and phone numbers.
- **Member accounts.** Nobody signs in except moderators.
- **Email notifications** on new submissions. That needs either Functions
  (Blaze) or a third-party mailer. For now a moderator checks `/admin`. Worth
  raising with Allan if the queue gets busy.
- **Rate limiting on intake.** Firestore rules cannot express it. App Check is
  the free mitigation; at this scale manual cleanup beats building a counter.

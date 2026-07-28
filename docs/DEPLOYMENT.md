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

### 3. Enable Google sign-in

Console > **Authentication** > *Get started* > **Google** > enable > Save.

Then under **Authentication > Settings > Authorized domains**, confirm your
hosting domain is listed (`raif-af800.web.app` and any custom domain). Sign-in
silently fails from unlisted domains.

### 4. Deploy the security rules

The rules are generated from the canonical option data, so regenerate before
deploying in case the data changed:

```bash
npm run rules          # regenerates firestore.rules
npm test               # includes the drift guard
npm run test:rules     # 26 behavioural tests against the emulator
npx firebase deploy --only firestore:rules,firestore:indexes
```

Do not hand-edit `firestore.rules` — it is generated and the drift test will
fail the build.

### 5. Grant Allan the admin claim

This is the only step with no console UI. Moderation is gated on a custom claim,
not merely on being signed in, so someone has to set it once per moderator.

Have Allan sign in to `/admin` once first so his account exists. Then, from
**Project settings > Service accounts**, click *Generate new private key* and
run this locally — **never commit the key**:

```bash
npm i -g firebase-admin   # or run in a scratch folder
GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json node -e "
const admin = require('firebase-admin');
admin.initializeApp();
admin.auth().getUserByEmail('allan@example.com')
  .then(u => admin.auth().setCustomUserClaims(u.uid, { admin: true }))
  .then(() => console.log('admin claim granted'))
  .catch(e => { console.error(e.message); process.exit(1); });
"
```

Replace the email with Allan's real Google account. Delete the key file
afterwards; `.gitignore` already blocks `serviceAccountKey*.json`, but the safe
move is to remove it and revoke it in the console.

He then reloads `/admin` and gets the queue. Without the claim he sees
"this account has no moderation permissions", which is the intended refusal.

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

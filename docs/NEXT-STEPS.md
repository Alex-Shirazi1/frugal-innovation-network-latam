# Pick up here

Written 2026-08-20, at the point the site finished moving from `raif-af800` to
the network's own Firebase project. Everything that could be done without a
console click is done; what remains is listed in the order it has to happen,
because most of it is blocked on the same one step.

Companions: [FIREBASE-SETUP.md](FIREBASE-SETUP.md) is the state of the project,
[DEPLOYMENT.md](DEPLOYMENT.md) is the step-by-step guide,
[MEMBER-FORM-OPEN-QUESTIONS.md](MEMBER-FORM-OPEN-QUESTIONS.md) is the decisions
still owed on the membership form.

---

## Where things stand

Live at **https://relif-s-website.web.app** — zero console errors, serving three
real members out of Firestore, auto-deploying from `main`.

| | |
|---|---|
| Project | `relif-s-website` (number `4139696496`) |
| Firestore | `(default)`, **nam5**, Native mode, free tier — **location is permanent** |
| Plan | Spark. No billing account. |
| Owners | `ashirazi@scu.edu`, `fihcloudservices@gmail.com` |
| Editors | `danguyen@scu.edu` |
| Repo | `Alex-Shirazi1/frugal-innovation-network-latam` — **public** |
| CI | `.github/workflows/firebase-hosting-deploy.yml`, runs on push to `main` |

Working: hosting, Firestore rules and indexes (deployed by CI, gated on 47
emulator tests), the `members` collection, the public directory, the security
boundary (`submissions` and `formResponses` refuse anonymous reads).

Not working: **anything requiring a login.** See "The one blocking step".

---

## How to get access

### Accounts and what each one is for

| Credential | Used for | Command |
|---|---|---|
| `gcloud` login | IAM, project inspection | `gcloud auth login` |
| `gcloud` ADC | **`grant-admin` and `seed-members` only** | `gcloud auth application-default login` |
| `firebase` login | manual deploys, emulators | `firebase login:add` then `firebase login:use ashirazi@scu.edu` |
| `gh` login | Actions secrets, pushing | `gh auth login` |

**The two `gcloud` commands are not interchangeable.** The Firebase Admin SDK
reads Application Default Credentials specifically, and skipping the second is
the usual reason `grant-admin` and `seed-members` fail. Both expire; re-run them.

At the time of writing the `gcloud` and `firebase` user tokens had both expired
mid-session while ADC was still valid, so expect to re-authenticate before
anything else. Check with:

```bash
gcloud auth print-access-token >/dev/null && echo "gcloud ok"
gcloud auth application-default print-access-token >/dev/null && echo "ADC ok"
firebase projects:list >/dev/null && echo "firebase ok"
gh auth status
```

### Consoles

- Firebase: https://console.firebase.google.com/project/relif-s-website
- IAM: https://console.cloud.google.com/iam-admin/iam?project=relif-s-website
- Actions: https://github.com/Alex-Shirazi1/frugal-innovation-network-latam/actions

### Two traps that will cost you an hour each

**1. ADC latches onto the wrong quota project.** It silently attached to
`magi-f7f13` (an unrelated project) and then failed with "API not enabled"
errors that point nowhere useful. Fix and verify:

```bash
gcloud config set project relif-s-website
gcloud auth application-default set-quota-project relif-s-website
gcloud config list
```

**2. Use Node 22, not 26.** CI pins Node 22. Under Node 26 jsdom leaves
`window.localStorage` undefined and **53 tests fail for no real reason** — which
is bad enough on its own, but worse because a genuine regression can hide inside
that noise. It did: a broken test got pushed and CI caught it, because locally
the file was already "failing".

```bash
export PATH="/opt/homebrew/opt/node@22/bin:$PATH"
node -v          # expect v22.x
npm test         # expect 30 files / 341 passed
```

### Getting the Firebase web config

Deliberately not written here. The `VITE_*` values are publishable, but this
repository is public and a committed value is in the history of every clone and
fork permanently — which is exactly why they live in Actions secrets. Fetch them:

```bash
firebase apps:list --project relif-s-website                  # get the app id
firebase apps:sdkconfig WEB <app-id> --project relif-s-website
```

That prints a couple of progress lines before the JSON, so read it rather than
piping it into a parser.

Currently set as Actions secrets: `FIREBASE_SERVICE_ACCOUNT`,
`VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID`,
`VITE_NOTIFY_TARGET`, `VITE_POSTHOG_KEY`. Check with `gh secret list`.

---

## The one blocking step

**Firebase Authentication has never been initialized on this project.** Its
config returns `CONFIGURATION_NOT_FOUND`.

> **Firebase console → Authentication → Get started → enable Email/Password**

Do this **in the console, not through the API.** Creating the config
programmatically goes down the Identity Platform path, which is the paid tier.
**If the console offers to upgrade to Identity Platform, decline it.** Plain
Firebase Authentication is free and is what this site uses. The distinction is
easy to miss because the APIs share a hostname, and the programmatic failure is
`BILLING_NOT_ENABLED`, which reads like Firebase Auth needs billing. It does not.

Until this is done, all of the following are impossible: signing in to `/admin`,
granting anyone the `admin` claim, creating the form's transport account, and
pressing Import — which is why `initiatives` and `bibliography` are still empty
and both sections render from the bundled copy.

---

## Then, in this order

### 1. Authorized domains

Authentication → Settings → Authorized domains. Confirm
`relif-s-website.web.app` and `relif-s-website.firebaseapp.com` are listed, and
add the custom domain when it exists. **Sign-in fails silently from an unlisted
domain** — no console error worth reading.

### 2. Make yourself a moderator

Needs a decision: **which email addresses should be able to edit the site.**
Custom claims live on the Auth user record, there is no console UI for them, and
they do not come across in a data export.

```bash
gcloud auth application-default login          # ADC, not the plain login
export PATH="/opt/homebrew/opt/node@22/bin:$PATH"
npm run grant-admin -- someone@example.org --create
```

`--create` prints a password-reset link rather than setting a password, so the
password never enters a terminal, a shell history, or a chat log.

Offboarding later: `npm run grant-admin -- someone@example.org --revoke
--revoke-sessions`. Without `--revoke-sessions` a signed-in session renews itself
forever, so a lost laptop stays live and changing the password does not end it.
Neither flag is instant — claims and sessions are read from an ID token valid for
up to an hour. That hour is the floor; the flag is what stops it being forever.

### 3. Import the site content

Sign in at `/admin` and press **Import** on Iniciativas and Bibliografía. Both
collections are empty, so the site currently serves the copies compiled into the
bundle and the editors are inert until the first import.

### 4. Create the form transport account

Needs a decision: **one email address for the transport.**

```bash
npm run grant-admin -- transport@example.org --create --importer
```

The `importer` claim is deliberately narrower than `admin` — it may only deposit
form responses, not read them or publish anybody.

Then re-install the Apps Script transport on the incorporation form, pointing its
`FIREBASE_PROJECT_ID` and `FIREBASE_API_KEY` script properties at this project
and its `IMPORTER_EMAIL` / `IMPORTER_PASSWORD` at the account above. Run
`testTransport` once and discard the `PRUEBA / DESCARTAR` row it deposits. See
DEPLOYMENT.md, "Wiring the incorporation form".

### 5. Turn on App Check

Free. Until it is on, `submissions` accepts unauthenticated creates — that is how
the public join form works, and it means anyone can post to the intake queue with
`curl`. It is also the cheapest protection against a Firestore quota exhaustion
run. Add `request.app != null` to the `submissions` create rule afterwards, by
editing `server/scripts/generate-firestore-rules.ts` and running `npm run rules`
— **never** by hand-editing `firestore.rules`, which is generated.

### 6. Set a budget or quota alert

So a traffic spike or an abuse run is noticed rather than silently exhausting the
day's Firestore reads or the Hosting transfer allowance.

### 7. Fix the membership form

The Google Form does not ask for research interests, general areas, languages, or
publication consent — all four are required to publish a profile. For the first
three members those were derived by hand from their free-text answers about which
commission they wanted to join and what projects they wanted to work on. **Every
new member needs that same manual derivation until the form is fixed.**

`docs/GOOGLE-FORM-EDIT-SPEC.md` already specifies exactly what to add.

### 8. Point the domain

Last step, after the checks below pass. DNS is managed in cPanel, not Firebase.

---

## Verifying it works

Are the rules enforced? Paste the `apiKey` from the command above as `K`:

```bash
K=<apiKey>
B="https://firestore.googleapis.com/v1/projects/relif-s-website/databases/(default)/documents"
for c in members initiatives submissions formResponses; do
  printf '%-14s ' "$c"
  curl -s "$B/$c?key=$K&pageSize=1" | grep -q '"error"' && echo DENIED || echo readable
done
```

Expect `members` and `initiatives` readable, `submissions` and `formResponses`
DENIED. Anything else means the deployed rules are not what the repo says.

Who is actually in the directory:

```bash
T=$(gcloud auth application-default print-access-token)
curl -s "https://firestore.googleapis.com/v1/projects/relif-s-website/databases/(default)/documents/members" \
  -H "Authorization: Bearer $T" \
  | python3 -c 'import json,sys;[print(" -",d["fields"]["fullName"]["stringValue"]) for d in json.load(sys.stdin).get("documents",[])]'
```

Before pointing a domain at it:

- The directory shows real people. Check what is compiled into
  `src/data/members.ts` — an empty collection publishes whatever is in there.
- A moderator can sign in at `/admin` and edit all four tabs.
- A test submission through the public join form arrives as a FormSubmit email.
- `testTransport` deposited a row and it appeared in the Members tab.
- The browser console on the deployed site is clean. CSP problems only appear
  once the site is live with analytics configured, never in a local build.

---

## Things not to do

- **`npm run seed:members` without exporting first.** It clears the members
  collection before writing the bundle, so any profile published through the
  panel and absent from the repo is destroyed, and published profiles are exactly
  what the repo cannot give back. Run `npm run export` first.
- **Hand-editing `firestore.rules`.** Generated. Edit
  `server/scripts/generate-firestore-rules.ts` and run `npm run rules`.
- **Committing a service-account key.** Needed one for CI; it went straight into
  the Actions secret and the local copy was deleted. Never into the repo.
- **Accepting an Identity Platform upgrade.** Paid tier. See above.
- **Assuming a failing local test suite is pre-existing noise.** Under Node 26 it
  always looks that way. Check under Node 22 before believing it.

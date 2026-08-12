# Red Latinoamericana de Innovación Frugal — Redesign

🚀 **Live Demo:** [https://raif-af800.firebaseapp.com/](https://raif-af800.firebaseapp.com/)

Modern React redesign of [redinnovacionfrugal.lat](https://redinnovacionfrugal.lat/), built fully **local-first** as an isolated dev environment, now with a **modular API layer** and an in-repo **prototype backend**.

> ⚠️ **Guardrail:** this project never touches the live production site, its cPanel, or its APIs. All data is local mock data or content transcribed from public pages. Nothing here reads from or writes to the production backend.

## Stack

- React 19 + TypeScript + Vite + React Router
- Tailwind CSS v4 (design tokens via `@theme` in `src/styles/global.css`)
- Production backend: Firestore (free Spark plan, no Cloud Functions) — setup guide in [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md), current state and migration notes in [docs/FIREBASE-SETUP.md](docs/FIREBASE-SETUP.md)
- Local dev backend: Express 5 + SQLite (`node:sqlite`, zero native deps) in `server/`
- Tests: Vitest + Supertest + Firestore emulator (rules)

## Run it

```bash
npm install
npm run dev:all    # frontend (:5173) + prototype API (:3001) together
npm run dev        # frontend only (falls back to bundled data if no API)
npm run dev:server # prototype API only
npm run test       # unit, integration, adapter and drift suites
npm run test:rules # firestore.rules against the emulator (needs Java)
npm run rules      # regenerate firestore.rules from canonical data
npm run relock     # REQUIRED after adding/removing any dependency
npm run build      # type-check + production build
npm run seed       # regenerate server/data/*.json from src/data (source of truth)
```

## Architecture: the swappable data layer

Every component reads data through one seam — the `RelifDataSource` interface (`src/api/dataSource.ts`):

```
components → useApiData() → RelifDataSource ──▶ http adapter ──▶ any backend at VITE_API_BASE_URL
                                    │                                  (today: server/ prototype)
                                    └──────────▶ bundled adapter ──▶ data compiled into the app
                                                 (offline / static / automatic fallback)
```

- **Swap the backend** by changing `VITE_API_BASE_URL` (default `/api`, proxied to `:3001` in dev) — or implement `RelifDataSource` against anything else (Supabase, a CMS…) and swap it in `src/api/index.ts`. No component changes.
- **No backend at all?** Set `VITE_DATA_SOURCE=bundled` (or just let the http adapter fail — it silently falls back to bundled data, so a static deploy keeps working).
- Copy `.env.example` to `.env` to configure; set a real `ADMIN_KEY` anywhere public.

### Prototype API (`server/`)

All responses use the `{ success, data, error }` envelope.

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/health` | liveness |
| GET | `/api/institutions` · `/api/members` · `/api/resources` · `/api/conference` · `/api/onboarding-options` | site content |
| POST | `/api/members/intake` | onboarding submissions → SQLite as `pending` (validated, honeypot, rate-limited) |
| POST | `/api/admin/login` | admin key check |
| GET | `/api/admin/pending` | approval queue (requires `x-admin-key`) |
| POST | `/api/admin/members/:id/approve` / `.../reject` | moderation |

### Intake pipeline & moderation

Form submission → server-side validation → stored `pending` in SQLite → reviewed at **`/admin`** (unlinked route; auth enforced server-side by `ADMIN_KEY`, rate-limited, constant-time compared) → on approve, the member appears in the public directory served by `GET /api/members`. Pending entries are never exposed publicly.

### Admin access

One shared account: the network's own address, plus a password. There is no
"sign in with Google" — the network has a single mailbox rather than a set of
named moderators, so a personal Google account modelled a distinction that does
not exist, and it required whoever held the panel to have a Google account at
all.

Two things have to be true to get in, and they are separate on purpose:

| | What it is | Where it lives |
|---|---|---|
| **Authentication** | email + password | Firebase Auth, hashed. Never in this repo, never in the bundle, never in an env var. |
| **Authorisation** | the `admin` custom claim | Set with `npm run grant-admin`. `firestore.rules` checks this, not the fact of being signed in. |

Signing in is not enough: an account without the claim is signed straight back
out, and `firestore.rules` would reject its token regardless. That split is what
lets the password be rotated, or the account disabled, from the Firebase console
without touching the rules or redeploying.

**Creating the production account** (once):

1. Firebase console → Authentication → Sign-in method → enable **Email/Password**.
2. `gcloud auth application-default login` (once per machine), then
   `npm run grant-admin -- contacto@redinnovacionfrugal.lat --create`.
3. Open the password-reset link it prints and choose the password, storing it in
   a password manager. The password is never typed into a terminal or a chat
   window, so the only copies are Firebase Auth's hash and the manager.
4. Open `/admin` and sign in.

To rotate: change the password in the console, or send another reset. To revoke
someone entirely: `npm run grant-admin -- <address> --revoke --revoke-sessions`.
The second flag matters — a password change alone leaves their existing session
signed in, because Firebase renews it indefinitely.

**Language.** The panel carries the same es/en/pt switch as the public site and
shares its `relif-lang` preference, so a language chosen on either is the one
the other opens in. Spanish stays the default — the people who run the network
read it — and the switch exists because the panel is also maintained by people
who do not.

The whole panel follows the switch — sign-in, the header, the tabs and all
three editors (`t.admin.*` in `src/i18n/translations.ts`).

Applicants' own words are never translated: biographies and job titles render
as submitted. Only the interface and the controlled vocabularies (position,
interests, areas, languages, place names) follow the switch — those already
carried all three languages and were being read as `.es` regardless.

### Machine translation in the editors

Every editable field has three boxes (es / en / pt). Write in **any one** of
them, press **"Fill in the missing languages"**, and the other two are filled —
English in, Spanish and Portuguese out, and so on. The button is disabled until
something is written, and again once nothing is left to fill, so its state says
whether there is anything for it to do.

Three rules it never breaks:

- **Nothing happens until you press it.** An earlier version also translated on
  blur behind a preference. That fired network requests from tabbing through a
  form, and raced the button for the same text — the two paths were requesting
  and paying for the same translation twice. One explicit trigger is the whole
  feature now.
- **It only ever writes into empty boxes.** Overwriting a translation somebody
  typed would be silent data loss.
- **It fills the form; it never saves.** Machine-filled boxes are marked
  "review it before saving" and nothing reaches the public site until a person
  presses Save. The output is good but not right — a test run turned "Community
  water lab" into "Agua Comunitaria", dropping the lab. Assume every suggestion
  needs a read.

Identical translations requested at the same moment share one request, so a
double-click cannot be charged twice against the quota.

**Two providers, tried in order** (`src/lib/translate.ts`):

1. **Chrome's built-in Translator** — a model on the machine. No key, no
   account, **no quota at all**, nothing leaves the device, and better output
   than the fallback. Chrome and Edge only, which is why it is preferred rather
   than exclusive. The first use of a language pair downloads a model; that one
   request falls through to the network and later ones are instant.
2. **MyMemory** — keyless HTTP, for every other browser. ~5k words/day
   anonymous.

So on Chrome there is effectively no limit; elsewhere the daily cap applies and
is reported plainly when hit.

**The MyMemory quota**, for the fallback path only:

| | Chars/day | What that buys |
|---|---|---|
| Anonymous | 5,000 | ~29 initiative cards, or 3x the whole site's content |
| With a contact address | 50,000 | ~290 cards a day |

Characters, not words, and the source is charged once per target language - so a
100-character description costs 200. An average initiative card (title plus
description, into both languages) is 171 characters.

The higher figure applies, because every request sends the network's own
address as MyMemory's `de=` parameter. It is read from `networkEmails.general`
in `src/data/network.ts` - the same constant the contact section renders - and
is deliberately **not** a deployment secret. It was one briefly, on the
reasoning that Vite inlines the value so a committed address is publicly
readable; but the site already prints this address on its contact page, so the
secret was protecting something already published, and every environment the
project moves to would have had to set it. Firestore or Remote Config would be
no different: both are client-readable, and both would add a round-trip to hide
a value that is on the page.

MyMemory asks for an address they can reach if traffic looks wrong, and blocks
addresses that bounce, so this has to stay a real monitored inbox rather than a
convenient fiction.

Unofficial Google endpoints and public Lingva proxies are keyless and good, and
are deliberately not used: they are undocumented, break without notice, and are
outside Google's terms — not a dependency to put under a client's site.

Deliberately called anonymously. MyMemory accepts a `de=` contact address that
raises the daily quota and we do not send one, for the same reason
`VITE_NOTIFY_TARGET` holds an alias: Vite would bake a plain address into the
bundle. The lower anonymous quota is the price of not publishing an inbox.

Quota exhaustion arrives as prose inside a 200 response rather than as an
error, so it is detected explicitly — otherwise "MYMEMORY WARNING: YOU USED ALL
AVAILABLE FREE TRANSLATIONS FOR TODAY" would be pasted into a title and
published. The length limit is measured in **bytes**, not characters, because
this site's copy is full of accented characters that cost two apiece.

If a Content-Security-Policy is ever added, `connect-src` needs
`https://api.mymemory.translated.net`.

**Running the panel locally.** Against the Firebase **emulator**, so the panel
runs the real production path — Firebase Auth, the claim, and `firestore.rules`
— against a throwaway database that is discarded when the process stops. There
is deliberately no "skip auth in development" flag: that would be live code in
the production bundle guarding the admin panel on a build variable.

```bash
npm run emulators       # terminal 1 — firestore :8080, auth :9099
npm run seed:emulator   # terminal 2 — creates the dev account + 3 submissions
npm run dev             # terminal 3 — then open /admin
```

Sign in with `admin@relif.test` / `admin123`. (Firebase enforces a six-character
minimum, hence `admin123` rather than `admin`.) The seed also creates the real
address with the same dev password, so local sign-in rehearses the production
one. These credentials are in the repository on purpose — they only ever exist
inside the emulator's in-memory user store, which is unreachable from anywhere
but the machine running it.

`npm run seed:emulator` is re-runnable: it updates the accounts in place and
leaves existing submissions alone. Restart the emulator for a clean slate — the
store is in-memory, so stopping it discards everything.

One footgun: `firebase.json` sets `singleProjectMode: true`, so running
`npm test` while the emulator is up writes the adapter suite's fixtures into the
same store despite its different project id — stray "Ada Lovelace" rows in the
queue are that, not real data. Restart the emulator to clear them.

`.env.development.local` carries the `VITE_FIREBASE_*` and
`VITE_FIREBASE_EMULATOR` values this needs — **not** `.env.local`, which Vite
loads in every mode including production and would bake the placeholder
identifiers into `npm run build` output.

`useEmulator()` in `src/lib/firebase.ts` is gated on `import.meta.env.DEV` as
well as the flag. Vite replaces `DEV` with a literal, so in a production build
the function folds to `return false` and every `connect*Emulator` call sits
behind a dead branch — setting the variable in a deploy environment cannot aim
the live site at a laptop.

### New-member email notification

Once a submission is durably stored, the browser pings
[FormSubmit](https://formsubmit.co), a form-to-email relay, so the network hears
about it (`src/lib/notifyNewMember.ts`).

```
join form → submissions/{id}          ← the record of truth
                 └→ FormSubmit → VITE_NOTIFY_EMAIL
                                 Subject: Solicitud de nueva membresía
```

There is no Cloud Function and no server: production is Hosting plus Firestore
straight from the browser, and Functions would mean putting the project on a
billing plan for a few dozen emails a month. FormSubmit needs no account, and
free tiers cannot bill you — there is no card on file to charge.

The call lives in `ApiDataContext`, not in an adapter, so it fires against the
local Express backend too — otherwise the only way to test that mail arrives
would be to deploy. It is gated on `persisted`, so the bundled fallback (which
validates happily and stores nothing) never mails about an application that was
not kept.

Nothing here is load-bearing. The submission is written first and stays visible
at `/admin` whether or not the mail goes out, which is why every failure is
swallowed — telling someone their application failed when it did not would be
worse than a missed email.

**Setup.** `VITE_NOTIFY_TARGET` holds a FormSubmit **alias** — an opaque string
like `00900405adc1d43ac0671143cd984aed` that resolves to an inbox on their side.
Set it in `.env.local` for development and as a GitHub Actions secret of the
same name for deploys. Unset means no mail and no request at all, the same
contract PostHog follows here.

Use the alias, not the address. Vite bakes this value into the bundle, so a
plain address is readable by anyone who views source on the live site. The alias
reveals nothing and is designed to be public.

### Changing the destination

The alias is bound to one inbox, so a new inbox needs a new alias. Four steps,
no code change:

1. Temporarily set `VITE_NOTIFY_TARGET` to the **new plain address** and deploy.
2. Submit the join form once. FormSubmit mails that address an activation link
   *and* the alias to use in its place.
3. Click **Activate Form** in that email. Nothing is delivered until you do.
4. Set `VITE_NOTIFY_TARGET` to the alias from step 2 and redeploy.

Between steps 1 and 4 the address is briefly in the deployed bundle. Redeploying
replaces it, unlike a commit, which would keep it forever.

Two things worth knowing. Activation is scoped to the **site URL** the
submission came from, so moving the site to its real domain will prompt a fresh
activation email — one click, same as the first time. And an unactivated target
returns HTTP 200 with `{"success":"false"}`, not an error status; the send check
inspects the body for exactly this reason, or every undelivered mail would be
logged as a success.

### What the join form does not do

It does not add anyone to the directory. The form is an expression of interest:
the network replies, meets the person, collects their organization's logo and
letter, and only then sends the official form that creates a profile. Pending
submissions live in `submissions/`, which is never publicly readable, and the
directory renders approved records only.

## Modules (per spec)

| # | Module | Where |
|---|--------|-------|
| 1 | Conference archive card — "Mundos de Transformación" (agenda, speakers, gallery, videos, Chile 2027 banner), placed between Origin and Frugal Innovation | `src/components/conference/` |
| 2 | Interactive Frugal Innovation Map — custom SVG canvas, zoom-to-node, drag pan, category filter sidebar, styled tooltips | `src/components/map/` |
| 3 | Digital Resource Library — native table UI (Title / Language / Author / Year / Type), inline preview modal, download action | `src/components/library/` |
| 4 | Individual Member Directory — 54 mock profiles + approved intake members, search + position filters, performance-optimized grid | `src/components/directory/` |
| 5 | Onboarding pipeline — 3-step form, strict cascading country→region selects, multi-select interests, real intake API with moderation queue | `src/components/onboarding/` + `server/` + `/admin` |
| 6 | i18n engine — site-wide ES/EN/PT switcher covering nav, cards, forms, and library metadata | `src/i18n/` |

## Data

`src/data/` is the **canonical source**; `npm run seed` generates `server/data/*.json` for the backend (a drift test keeps them in lockstep):

- `institutions.ts` — the real member institutions (from the public site) with geo coordinates for the map
- `members.ts` — **fictional** individual-member profiles (no real member data exists yet)
- `resources.ts` — resource catalog replacing the raw Google Drive link (drop real PDFs into `public/docs/`)
- `conference.ts` — the archived conference agenda, speakers, and video embeds
- `onboardingOptions.ts` — countries/regions and research-interest taxonomies

Runtime intake submissions live in SQLite (`server/relif.db`, gitignored) — not in the JSON.

## Brand

- Palette and typography (`#168599` teal, `#203236` slate, `#f6a620` / `#e94824` / `#8ebc41` accents; Oswald + Open Sans) were extracted read-only from the production stylesheet so the redesign stays visually faithful to the network's identity.
- The official logo lockup lives locally at `public/logo-relif.png`; the favicon is a simplified ring-of-people mark in the same palette.
- The map renders real Natural Earth country geometry (`src/data/countries-110m.json`, bundled locally) with d3-geo — no external tiles or Google Maps dependency.

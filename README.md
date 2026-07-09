# Red Latinoamericana de Innovación Frugal — Redesign

🚀 **Live Demo:** [https://raif-af800.firebaseapp.com/](https://raif-af800.firebaseapp.com/)

Modern React redesign of [redinnovacionfrugal.lat](https://redinnovacionfrugal.lat/), built fully **local-first** as an isolated dev environment, now with a **modular API layer** and an in-repo **prototype backend**.

> ⚠️ **Guardrail:** this project never touches the live production site, its cPanel, or its APIs. All data is local mock data or content transcribed from public pages. Nothing here reads from or writes to the production backend.

## Stack

- React 19 + TypeScript + Vite + React Router
- Tailwind CSS v4 (design tokens via `@theme` in `src/styles/global.css`)
- Prototype backend: Express 5 + SQLite (`node:sqlite`, zero native deps) in `server/`
- Tests: Vitest + Supertest

## Run it

```bash
npm install
npm run dev:all    # frontend (:5173) + prototype API (:3001) together
npm run dev        # frontend only (falls back to bundled data if no API)
npm run dev:server # prototype API only
npm run test       # backend + adapter test suite
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

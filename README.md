# Red Latinoamericana de Innovación Frugal — Redesign

Modern React redesign of [redinnovacionfrugal.lat](https://redinnovacionfrugal.lat/), built fully **local-first** as an isolated dev environment.

> ⚠️ **Guardrail:** this project never touches the live production site, its cPanel, or its APIs. All data is local mock data or content transcribed from public pages. Nothing here reads from or writes to the production backend.

## Stack

- React 19 + TypeScript + Vite
- Tailwind CSS v4 (design tokens via `@theme` in `src/styles/global.css`)
- No backend required — mock intake pipeline in `src/lib/intake.ts`

## Run it

```bash
npm install
npm run dev      # local dev server
npm run build    # production build
npm run preview  # preview the production build
```

## Modules (per spec)

| # | Module | Where |
|---|--------|-------|
| 1 | Conference archive card — "Mundos de Transformación" (agenda, speakers, gallery, videos, Chile 2027 banner), placed between Origin and Frugal Innovation | `src/components/conference/` |
| 2 | Interactive Frugal Innovation Map — custom SVG canvas, zoom-to-node, drag pan, category filter sidebar, styled tooltips | `src/components/map/` |
| 3 | Digital Resource Library — native table UI (Title / Language / Author / Year / Type), inline preview modal, download action | `src/components/library/` |
| 4 | Individual Member Directory — 54 mock profiles, search + position filters, performance-optimized grid | `src/components/directory/` |
| 5 | Onboarding pipeline — 3-step form, strict cascading country→region selects, multi-select interests, mock intake API that appends straight into the directory state | `src/components/onboarding/` + `src/lib/intake.ts` |
| 6 | i18n engine — site-wide ES/EN switcher covering nav, cards, forms, and library metadata | `src/i18n/` |

## Data

All structured content lives in `src/data/`:

- `institutions.ts` — the real member institutions (from the public site) with geo coordinates for the map
- `members.ts` — **fictional** individual-member profiles (no real member data exists yet)
- `resources.ts` — resource catalog replacing the raw Google Drive link (drop real PDFs into `public/docs/`)
- `conference.ts` — the archived conference agenda, speakers, and video embeds
- `latamOutline.ts` — stylized SVG outline of Latin America
- `onboardingOptions.ts` — countries/regions and research-interest taxonomies

## Assets

The logo is a new local SVG (`public/relif-mark.svg`) — deliberately not pulled from the live site, which uses an outdated mark.

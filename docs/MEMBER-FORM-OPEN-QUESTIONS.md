# Member form — what is still needed

Written 2026-08-12, after reading the live "Formulario de Membresía" (19 questions,
5 pages) and running `src/domain/memberImport.ts` against its exact question
titles.

This file exists so the open questions survive the session. Everything below is
either a decision only Allan can make, data somebody has to hand over, or a
credential nobody but the account owner can produce.

---

## 0. Where things actually stand

The transport pipeline is built and deployed. What is *not* done is the form.

Measured, not estimated — the importer run against the live titles:

```
mapped:  7 questions
ignored: 11 questions
verdict: ok=false, error=missing-required
```

**No response to the current form can become a directory profile**, and adding a
consent checkbox alone does not change that: four other required fields have no
question at all.

### What maps today

| Question title | Field it lands in |
| --- | --- |
| `Nombre de la organización:` | `firstName` — wrong, see defect below |
| `País donde se encuentra la organización:` | `country` |
| `Ciudad donde se encuentra la organización:` | `region` |
| `Nombre y apellidos completos:` | `firstName` (overwrites the org name) |
| `Cargo dentro la organización:` | `position` |
| `Correo electrónico institucional:` | `email` |
| `Perfil de LinkedIn (opcional):` | `socialUrl` |

The other 11 questions — afiliación personal/institucional, página web, unidad,
the five `¿por qué…` questions, comisiones, and both WhatsApp questions — are
ignored. That is correct behaviour: they are application data, not profile data.

### Missing entirely

`lastName`, `interestIds`, `generalAreaIds`, `languages`, `consentToPublish`.

`position` also needs to become a picklist — free text `Investigadora` does not
resolve; `Investigador/a` does.

### Defect found (independent of which form is used)

`Nombre de la organización:` prefix-matches the `nombre` alias for **firstName**
before reaching the `nombre de la organizacion` alias for **affiliation**
(`src/domain/memberImport.ts:212`). The organisation name is then overwritten by
`Nombre y apellidos completos:` and **silently discarded** — `affiliationId`
comes out `null` and nothing appears in the `unresolved` list to warn a moderator.

Fix: match the longest alias first rather than the first registered. Small, and
worth doing regardless, because silent data loss is the failure mode this module
was written to prevent.

---

## 1. Decisions for Allan — blocking

**1.1 One form or two?**

This form is a membership *application* (organisation, motivation, commission,
WhatsApp). The directory publishes *people*. Two different jobs.

- **A — extend this form.** Add ~6 questions to the representatives section. One
  form to maintain, but it mixes application with profile, and the 58 existing
  responses still cannot import because they predate the new questions.
- **B — a second short form (~9 questions) sent after vetting.** Matches the flow
  Allan described on the call: conversation → logo → letter → *then* the profile
  form. Leaves this application form and its 58 responses untouched.

Recommendation: **B**.

**1.2 One profile per organisation, or one per representative?**

The form says a separate submission per member, and the link is shared inside the
institution. So one organisation can yield several profiles. Confirm that is
intended — it changes what the directory looks like.

**1.3 What happens to the 58 existing responses?**

None can import. Options: leave them as application records only; or have Allan
re-send the new profile form to the ones already vetted. Somebody has to decide,
because these are real people who filled in a form.

**1.4 Exact consent wording.**

Needed: the sentence that goes in the question *description* (the legal text) —
what is published, where, and how to withdraw. The option **label** must stay
short (`Acepto`), because the label is what gets exported as the answer.

**1.5 Retention of `formResponses`.**

Still open from `docs/DEPLOYMENT.md`. Responses are kept after publication because
the network emails people later and `members` holds no address. Whether they
should be pruned after some period is Allan's call.

---

## 2. Data needed before the spec can be written

**2.1 The responses CSV** — Responses tab → ⋮ → *Download responses (.csv)*.

This is the single highest-value item. With it, the following can be answered by
running the real importer instead of guessing:

- which of the 38 whitelisted institutions the applicants actually belong to, and
  which organisations are missing from `src/data/institutions.ts`
- whether the 21 countries in `src/data/onboardingOptions.ts` cover the applicants
- which cities appear, and whether `cityToRegion` (39 entries) resolves them

Without it, the institution and country lists are being extended blind.

**2.2 Whether the vocabularies are complete.**

Current sizes: 12 research interests, 10 general areas, 6 languages, 21 countries,
85 regions, 38 institutions. Allan should confirm these are the right lists before
they are frozen into a form — changing an option later means editing the form,
`onboardingOptions.ts`, and regenerating `firestore.rules`.

**2.3 A structural problem with región — needs a decision.**

`validateIntake` only accepts a region that belongs to the stated country
(`src/domain/intake.ts:174`). Google Forms has no dependent dropdowns. So:

- one flat dropdown of all 85 regions (works, ugly, allows mismatched pairs that
  fail validation at import time), **or**
- one section per country with go-to-section branching (21 sections, correct by
  construction, tedious to build), **or**
- free-text city and lean on `cityToRegion` — but that table has only 39 entries,
  so most cities would land as unresolved for a moderator.

No option is clean. Pick one.

---

## 3. Access and credentials — nobody else can supply these

**3.1 ~~ADC as the project owner~~ — RESOLVED 2026-08-20.** `ashirazi@scu.edu`
now holds `roles/owner` on `relif-s-website`, and `npm run seed:members --
--confirm` has run: the three real members are in Firestore. Creating the
transport account is still blocked, but on Authentication rather than on
credentials — see 3.5.

**3.2 Who owns the Apps Script.** It has to be installed by an account that can
edit the form — Allan's, or an account he shares edit access with. If Allan owns
it, someone has to walk him through it, because the failure notifications go to
the script owner.

**3.3 The transport account address.** `npm run grant-admin -- <email> --create
--importer` needs a chosen address, and its password goes into Script properties
and a password manager — nowhere else.

**3.4 ~~Confirm the target project~~ — RESOLVED 2026-08-20.** The target is
`relif-s-website` (Firestore in nam5, permanent). The production domain is still
unconfirmed; DNS is managed in cPanel.

**3.5 Firebase Authentication has never been initialized on the new project.**
The Identity Toolkit config returns `CONFIGURATION_NOT_FOUND`, so nobody can sign
in to `/admin`, no `admin` claim can be granted, and the transport account in 3.3
cannot be created. Enable it in the **console** — Authentication → Get started →
Email/Password. Not via the API: creating the config programmatically goes down
the Identity Platform path, which is the paid tier.

---

## 4. Production hazard to keep in view

The bundled seed is a *fallback*. An empty `members` collection makes the public
site publish 54 fabricated academics, silently, with no error. One real profile
clears all 54. Do not point the site at a fresh project and walk away.

---

## 5. What can proceed with no further input

- Fixing the longest-alias defect in `memberImport.ts`, with a regression test.
- Writing the full question spec for Option B — every title and option label in
  Spanish, in order — which only needs decision **1.1** and the región choice in
  **2.3**.

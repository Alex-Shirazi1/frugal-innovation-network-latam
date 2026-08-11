/**
 * Guards against drift between the canonical option data and the committed
 * firestore.rules.
 *
 * Rules are their own language and cannot import the TypeScript validator, so
 * the whitelists are generated. Without this test, adding a country to
 * src/data/onboardingOptions.ts would silently leave the hosted backend
 * rejecting every member from that country — exactly the class of bug that
 * already bit the France/Finland/Switzerland institutions.
 *
 * If this fails, run: npm run rules
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { buildRules } from './scripts/generate-firestore-rules'
import { countries, generalAreas, languageOptions, researchInterests } from '../src/data/onboardingOptions'
import { institutions } from '../src/data/institutions'

const committed = readFileSync('firestore.rules', 'utf8')

describe('firestore.rules is in sync with the canonical data (run `npm run rules` if not)', () => {
  it('matches byte for byte what the generator produces', () => {
    expect(committed).toBe(buildRules())
  })

  it('carries every country and region', () => {
    for (const country of countries) {
      expect(committed).toContain(`'${country.name}'`)
      for (const region of country.regions) {
        expect(committed).toContain(`'${region}'`)
      }
    }
  })

  it('carries every interest, area, language, and institution id', () => {
    for (const id of [
      ...researchInterests.map((i) => i.id),
      ...generalAreas.map((a) => a.id),
      ...languageOptions.map((l) => l.id),
      ...institutions.map((i) => i.id),
    ]) {
      expect(committed).toContain(`'${id}'`)
    }
  })

  /** The invariants that make the two-collection model safe. */
  it('keeps the security posture the deployment depends on', () => {
    // Moderation requires the custom claim, not just any signed-in user.
    expect(committed).toContain('request.auth.token.admin == true')
    // Consent is enforced in the rules, not only in the UI.
    expect(committed).toContain('data.consentToPublish == true')
    // A submitter cannot self-approve.
    expect(committed).toContain("data.status == 'pending'")
    // Pending personal data is never world-readable.
    expect(committed).toContain('allow read, update, delete: if isAdmin();')
    // The world-readable directory is shape-checked, not merely admin-gated.
    expect(committed).toContain('allow create, update: if isAdmin() && validMember(')
    /*
     * `members` is world-readable, so the published shape must not admit an
     * email key. Asserted against the generated hasOnly list rather than the
     * whole file, because 'email' legitimately appears in validSubmission.
     */
    const publishedFields = committed.match(/function validMember\(data\) \{\s*return data\.keys\(\)\.hasOnly\(\[([^\]]*)\]\)/)
    expect(publishedFields).not.toBeNull()
    expect(publishedFields![1]).not.toContain('email')
    // Anything not explicitly matched is denied.
    expect(committed).toContain('allow read, write: if false;')
  })
})

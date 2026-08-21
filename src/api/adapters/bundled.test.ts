import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { processIntakeLocally as processIntake } from './bundled'
import type { IntakeSubmission } from '../types'
import { makeSubmission } from '../../test/fixtures'
import { countries, researchInterests } from '../../data/onboardingOptions'

// A submission that passes every validation gate. Individual tests clone and
// mutate this to exercise one failure mode at a time.
function validSubmission(overrides: Partial<IntakeSubmission> = {}): IntakeSubmission {
  const country = countries[0]
  return makeSubmission({
    fullName: 'Ada Lovelace',
    affiliationId: null,
    country: country.name,
    region: country.regions[0],
    interestIds: [researchInterests[0].id],
    socialUrl: '',
    ...overrides,
  })
}

describe('processIntake', () => {
  beforeEach(() => {
    // The bundled adapter awaits a simulated-latency setTimeout; fake timers keep tests instant.
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // Runs processIntake to completion while flushing the simulated latency.
  async function run(submission: IntakeSubmission) {
    const promise = processIntake(submission)
    await vi.runAllTimersAsync()
    return promise
  }

  it('accepts a fully valid submission and maps it to a Member', async () => {
    const result = await run(validSubmission())
    expect(result.success).toBe(true)
    expect(result.error).toBeUndefined()
    expect(result.data).toBeDefined()
    expect(result.data?.fullName).toBe('Ada Lovelace')
    expect(result.data?.position).toBe('researcher')
    // researcher position maps to a localized title.
    expect(result.data?.title.en).toBe('Researcher')
    expect(result.data?.id).toMatch(/^local-/)
  })

  it('trims whitespace from the full name', async () => {
    const result = await run(validSubmission({ fullName: '  Grace  Hopper  ' }))
    expect(result.success).toBe(true)
    expect(result.data?.fullName).toBe('Grace Hopper')
  })

  it('rejects a blank first name', async () => {
    const result = await run(validSubmission({ fullName: '   ' }))
    expect(result.success).toBe(false)
    expect(result.error).toBe('missing-required')
  })

  it('rejects a missing position', async () => {
    const result = await run(validSubmission({ position: '' }))
    expect(result.success).toBe(false)
    expect(result.error).toBe('missing-required')
  })


  it('rejects a submission with no valid research interests', async () => {
    const result = await run(validSubmission({ interestIds: ['not-a-real-interest'] }))
    expect(result.success).toBe(false)
    expect(result.error).toBe('missing-interests')
  })

  it('filters out unknown interest ids but keeps the valid ones', async () => {
    const valid = researchInterests[0].id
    const result = await run(
      validSubmission({ interestIds: [valid, 'bogus', researchInterests[1].id] }),
    )
    expect(result.success).toBe(true)
    expect(result.data?.interestIds).toEqual([valid, researchInterests[1].id])
  })

  it('rejects a malformed social URL', async () => {
    const result = await run(validSubmission({ socialUrl: 'not a url' }))
    expect(result.success).toBe(false)
    expect(result.error).toBe('invalid-url')
  })

  it('accepts an https social URL and stores it', async () => {
    const url = 'https://linkedin.com/in/ada'
    const result = await run(validSubmission({ socialUrl: url }))
    expect(result.success).toBe(true)
    expect(result.data?.socialUrl).toBe(url)
  })

  it('leaves socialUrl undefined when the field is empty', async () => {
    const result = await run(validSubmission({ socialUrl: '' }))
    expect(result.success).toBe(true)
    expect(result.data?.socialUrl).toBeUndefined()
  })

  it('rejects a blank last name', async () => {
    const result = await run(validSubmission({ fullName: '  ' }))
    expect(result.success).toBe(false)
    expect(result.error).toBe('missing-required')
  })

  it('requires at least one general area', async () => {
    const result = await run(validSubmission({ generalAreaIds: [] }))
    expect(result.error).toBe('missing-areas')
  })

  it('requires at least one language', async () => {
    const result = await run(validSubmission({ languages: [] }))
    expect(result.error).toBe('missing-languages')
  })

  it('requires explicit consent to publish', async () => {
    const result = await run(validSubmission({ consentToPublish: false }))
    expect(result.error).toBe('consent-required')
  })

  it('rejects an overlong biography', async () => {
    const result = await run(validSubmission({ biography: 'x'.repeat(801) }))
    expect(result.error).toBe('too-long')
  })

  it('splits and echoes the name parts it was given', async () => {
    const result = await run(validSubmission({ fullName: 'Grace Hopper' }))
    expect(result.data?.fullName).toBe('Grace Hopper')
    expect(result.data?.fullName).toBe('Grace Hopper')
  })

  /**
   * The whole point of the flag: this adapter validates but stores nothing, so
   * the UI must never report a saved submission on its word alone.
   */
  it('always reports persisted: false, even on success', async () => {
    const ok = await run(validSubmission())
    expect(ok.success).toBe(true)
    expect(ok.persisted).toBe(false)

    const bad = await run(validSubmission({ consentToPublish: false }))
    expect(bad.persisted).toBe(false)
  })

  it('derives a deterministic avatarHue in the 0-359 range from the name', async () => {
    const a = await run(validSubmission({ fullName: 'Ada Lovelace' }))
    const b = await run(validSubmission({ fullName: 'Ada Lovelace' }))
    expect(a.data?.avatarHue).toBe(b.data?.avatarHue)
    expect(a.data?.avatarHue).toBeGreaterThanOrEqual(0)
    expect(a.data?.avatarHue).toBeLessThan(360)
  })
})

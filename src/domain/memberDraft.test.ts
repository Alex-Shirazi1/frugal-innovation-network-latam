/**
 * The manual path must not be a weaker way in than the public form, and the
 * placeholder address it borrows from the intake validator must never reach a
 * record — `members` is world-readable. Both are asserted here.
 */
import { describe, expect, it } from 'vitest'
import { toDraft, validateMemberDraft, type MemberDraft } from './memberDraft'

const draft = (overrides: Partial<MemberDraft> = {}): Partial<MemberDraft> => ({
  fullName: 'Ada Lovelace',
  position: 'researcher',
  jobPositionName: 'Investigadora Asociada',
  biography: 'Trabaja en innovación frugal.',
  affiliationId: 'iteso',
  country: 'México',
  region: 'Jalisco',
  interestIds: ['salud'],
  generalAreaIds: ['ingenieria'],
  languages: ['es'],
  socialUrl: 'https://linkedin.com/in/ada',
  ...overrides,
})

describe('validateMemberDraft', () => {
  it('accepts a complete draft and derives the display fields', () => {
    const result = validateMemberDraft(draft())
    expect(result.ok).toBe(true)
    expect(result.member?.fullName).toBe('Ada Lovelace')
    expect(result.member?.title.es).toBeTruthy()
    expect(result.member?.avatarHue).toBeGreaterThanOrEqual(0)
    expect(result.member?.avatarHue).toBeLessThan(360)
  })

  /*
   * The whole reason this module borrows the intake validator rather than
   * reimplementing it. `members` is world-readable, so a leaked placeholder would
   * be a published address.
   */
  it('never carries the placeholder address onto the record', () => {
    const result = validateMemberDraft(draft())
    expect(result.member).not.toHaveProperty('email')
    expect(JSON.stringify(result.member)).not.toContain('relif.invalid')
  })

  /*
   * fullName is deliberately NOT on this list. It used to be derived from a
   * first/last pair, so a caller-supplied value was ignored; the name is now
   * stored exactly as typed, which makes it an input like any other. What must
   * still be impossible is forging the *display* fields — the localized title
   * comes from the position whitelist and the avatar hue from the name — since
   * those are what a reader takes as the record speaking for itself.
   */
  it('does not accept derived fields from the caller', () => {
    const result = validateMemberDraft({
      ...draft(),
      title: { es: 'Forjado', en: 'Forged', pt: 'Forjado' },
      avatarHue: 999,
    } as Partial<MemberDraft>)
    expect(result.member?.title).not.toEqual({ es: 'Forjado', en: 'Forged', pt: 'Forjado' })
    expect(result.member?.avatarHue).not.toBe(999)
  })

  it('stores the name exactly as it was typed', () => {
    expect(validateMemberDraft(draft({ fullName: 'María Fernanda Gómez Ruiz' })).member?.fullName).toBe(
      'María Fernanda Gómez Ruiz',
    )
  })

  it('enforces the same whitelists as the public form', () => {
    expect(validateMemberDraft(draft({ position: 'director' })).error).toBe('missing-required')
    expect(validateMemberDraft(draft({ region: 'Atlantis' })).error).toBe('invalid-location')
    expect(validateMemberDraft(draft({ affiliationId: 'not-real' })).error).toBe(
      'invalid-affiliation',
    )
    expect(validateMemberDraft(draft({ interestIds: [] })).error).toBe('missing-interests')
    expect(validateMemberDraft(draft({ generalAreaIds: [] })).error).toBe('missing-areas')
    expect(validateMemberDraft(draft({ languages: [] })).error).toBe('missing-languages')
    expect(validateMemberDraft(draft({ socialUrl: 'not-a-url' })).error).toBe('invalid-url')
    expect(validateMemberDraft(draft({ fullName: '' })).error).toBe('missing-required')
  })

  it('silently discards unknown ids rather than storing them', () => {
    const result = validateMemberDraft(draft({ interestIds: ['salud', 'not-a-real-interest'] }))
    expect(result.member?.interestIds).toEqual(['salud'])
  })

  it('treats an absent social link as absent, not as an empty string', () => {
    const result = validateMemberDraft(draft({ socialUrl: '' }))
    expect(result.ok).toBe(true)
    expect(result.member?.socialUrl).toBeUndefined()
  })
})

describe('toDraft', () => {
  it('round-trips a stored profile back through validation unchanged', () => {
    const first = validateMemberDraft(draft())
    expect(first.ok).toBe(true)

    const second = validateMemberDraft(toDraft(first.member!))
    expect(second.ok).toBe(true)
    expect(second.member).toEqual(first.member)
  })

  it('represents a missing social link as an empty field for the form', () => {
    const stored = validateMemberDraft(draft({ socialUrl: '' })).member!
    expect(toDraft(stored).socialUrl).toBe('')
  })
})

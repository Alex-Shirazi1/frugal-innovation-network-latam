import { describe, expect, it } from 'vitest'
import { isValidEmail, validateIntake } from './intake'
import { makeSubmission } from '../test/fixtures'

/**
 * Email is the field the whole form exists to collect — Allan's first move on
 * any application is to write to the person — so it gets its own coverage
 * rather than riding along with the rest of the payload.
 */
describe('validateIntake — email', () => {
  it('accepts and normalizes a valid address', () => {
    const result = validateIntake(makeSubmission({ email: '  Ana.Prueba@Example.ORG  ' }))
    expect(result.ok).toBe(true)
    // Lower-cased and trimmed, so the same person submitting twice does not
    // produce two addresses that only differ by shift key.
    expect(result.member?.email).toBe('ana.prueba@example.org')
  })

  it('rejects a submission with no address', () => {
    const result = validateIntake(makeSubmission({ email: '' }))
    expect(result.ok).toBe(false)
    expect(result.error).toBe('missing-required')
  })

  it('rejects whitespace masquerading as an address', () => {
    expect(validateIntake(makeSubmission({ email: '   ' })).error).toBe('missing-required')
  })

  it.each([
    ['no at sign', 'ana.example.org'],
    ['no domain dot', 'ana@example'],
    ['nothing before the at', '@example.org'],
    ['nothing after the at', 'ana@'],
    ['embedded space', 'ana prueba@example.org'],
    ['two at signs', 'ana@@example.org'],
  ])('rejects %s', (_label, email) => {
    const result = validateIntake(makeSubmission({ email }))
    expect(result.ok).toBe(false)
    expect(result.error).toBe('invalid-email')
  })

  it('rejects an address past the RFC length limit', () => {
    const email = `${'a'.repeat(250)}@example.org`
    expect(validateIntake(makeSubmission({ email })).error).toBe('invalid-email')
  })

  it.each([
    ['plus tagging', 'ana+relif@example.org'],
    ['subdomain', 'ana@mail.universidad.edu.mx'],
    ['long modern TLD', 'ana@universidad.education'],
    ['digits and dashes', 'ana-2@mi-universidad.org'],
  ])('accepts %s, which stricter patterns wrongly reject', (_label, email) => {
    expect(validateIntake(makeSubmission({ email })).ok).toBe(true)
  })
})

describe('isValidEmail', () => {
  it('is permissive by design — it catches typos, it does not adjudicate RFC 5322', () => {
    expect(isValidEmail('a@b.co')).toBe(true)
    expect(isValidEmail('a@b')).toBe(false)
    expect(isValidEmail('')).toBe(false)
  })
})

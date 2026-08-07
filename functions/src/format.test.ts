import { describe, expect, it } from 'vitest'
import { buildMessage, fullNameOf, SUBJECT, type SubmissionDocument } from './format.js'

const ADMIN_URL = 'https://redinnovacionfrugal.lat/admin'

function makeSubmission(overrides: SubmissionDocument = {}): SubmissionDocument {
  return {
    firstName: 'Ada',
    lastName: 'Lovelace',
    position: 'researcher',
    jobPositionName: 'Investigadora Asociada',
    biography: 'Trabaja en soluciones de bajo costo con comunidades rurales.',
    affiliationId: 'iteso',
    country: 'México',
    region: 'Jalisco',
    interestIds: ['salud', 'agua'],
    generalAreaIds: ['ingenieria'],
    languages: ['es', 'en'],
    socialUrl: 'https://linkedin.com/in/ada',
    consentToPublish: true,
    createdAt: '2026-08-07T12:00:00.000Z',
    ...overrides,
  }
}

describe('buildMessage', () => {
  it('uses the subject Allan asked for, so his inbox filter can key on it', () => {
    expect(buildMessage(makeSubmission(), ADMIN_URL).subject).toBe('Solicitud de nueva membresía')
    expect(SUBJECT).toBe('Solicitud de nueva membresía')
  })

  it('carries every submitted field into the plain-text body', () => {
    const { text } = buildMessage(makeSubmission(), ADMIN_URL)
    expect(text).toContain('Ada Lovelace')
    expect(text).toContain('Investigador/a')
    expect(text).toContain('Investigadora Asociada')
    expect(text).toContain('iteso')
    expect(text).toContain('México')
    expect(text).toContain('Jalisco')
    expect(text).toContain('salud, agua')
    expect(text).toContain('https://linkedin.com/in/ada')
    expect(text).toContain('Trabaja en soluciones de bajo costo')
    expect(text).toContain(ADMIN_URL)
  })

  it('translates the position id to its Spanish label', () => {
    const { text } = buildMessage(makeSubmission({ position: 'faculty' }), ADMIN_URL)
    expect(text).toContain('Tipo de posición: Docente')
  })

  it('falls back to the raw id if a new position type is ever added', () => {
    const { text } = buildMessage(makeSubmission({ position: 'emeritus' }), ADMIN_URL)
    expect(text).toContain('Tipo de posición: emeritus')
  })

  it('records a withheld publication consent as No', () => {
    const { text } = buildMessage(makeSubmission({ consentToPublish: false }), ADMIN_URL)
    expect(text).toContain('Consentimiento de publicación: No')
  })

  /**
   * The trigger must not throw on a malformed document: a crash here loses the
   * notification entirely, and the submission itself is already stored.
   */
  it('still produces a sendable message from an empty document', () => {
    const message = buildMessage({}, ADMIN_URL)
    expect(message.subject).toBe(SUBJECT)
    expect(message.text).toContain('Solicitante sin nombre')
    expect(message.html).toContain('Solicitante sin nombre')
  })

  it('marks absent optional fields rather than printing "undefined"', () => {
    const { text } = buildMessage(makeSubmission({ socialUrl: null }), ADMIN_URL)
    expect(text).toContain('Enlace profesional: —')
    expect(text).not.toContain('undefined')
    expect(text).not.toContain('null')
  })

  it('escapes HTML so a submitted name cannot inject markup into the email', () => {
    const { html } = buildMessage(
      makeSubmission({ firstName: '<script>alert(1)</script>', lastName: 'X' }),
      ADMIN_URL,
    )
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('escapes the biography too, since it is free text', () => {
    const { html } = buildMessage(
      makeSubmission({ biography: 'a "quoted" <b>bold</b> & more' }),
      ADMIN_URL,
    )
    expect(html).toContain('&lt;b&gt;')
    expect(html).toContain('&amp;')
  })
})

describe('fullNameOf', () => {
  it('joins the name parts', () => {
    expect(fullNameOf({ firstName: 'Ada', lastName: 'Lovelace' })).toBe('Ada Lovelace')
  })

  it('tolerates a missing half', () => {
    expect(fullNameOf({ firstName: 'Ada' })).toBe('Ada')
  })

  it('reports a placeholder rather than an empty string when both are missing', () => {
    expect(fullNameOf({})).toBe('Solicitante sin nombre')
    expect(fullNameOf({ firstName: '   ', lastName: '' })).toBe('Solicitante sin nombre')
  })
})

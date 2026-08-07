import { describe, expect, it, vi } from 'vitest'
import {
  NOTIFICATION_SUBJECT,
  notificationFields,
  notifyNewMember,
} from './notifyNewMember'
import type { IntakeSubmission } from '../api/types'

function makeSubmission(overrides: Partial<IntakeSubmission> = {}): IntakeSubmission {
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
    ...overrides,
  } as IntakeSubmission
}

/** FormSubmit answers a delivered message with `{ success: true }`. */
function okFetch() {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ success: true }),
  } as unknown as Response)
}

describe('notificationFields', () => {
  it('labels every field in Spanish, since this is internal mail to the network', () => {
    const fields = notificationFields(makeSubmission(), 'ITESO')
    expect(fields['Nombre']).toBe('Ada Lovelace')
    expect(fields['Tipo de posición']).toBe('Investigador/a')
    expect(fields['Afiliación']).toBe('ITESO')
    expect(fields['País']).toBe('México')
    expect(fields['Intereses']).toBe('salud, agua')
    expect(fields['Consentimiento de publicación']).toBe('Sí')
  })

  it('names an unaffiliated applicant as independent rather than blank', () => {
    const fields = notificationFields(makeSubmission({ affiliationId: null }), null)
    expect(fields['Afiliación']).toBe('Independiente')
  })

  it('marks absent optional fields rather than printing undefined', () => {
    const fields = notificationFields(makeSubmission({ socialUrl: '' }), 'ITESO')
    expect(fields['Enlace profesional']).toBe('—')
    expect(Object.values(fields).join(' ')).not.toContain('undefined')
  })

  it('records a withheld publication consent', () => {
    const fields = notificationFields(makeSubmission({ consentToPublish: false }), 'ITESO')
    expect(fields['Consentimiento de publicación']).toBe('No')
  })
})

describe('notifyNewMember', () => {
  it('posts the exact subject Allan filters his inbox on', async () => {
    const fetchImpl = okFetch()
    await notifyNewMember({
      submission: makeSubmission(),
      institutionName: 'ITESO',
      to: 'destino@example.org',
      fetchImpl,
    })

    const [url, init] = fetchImpl.mock.calls[0]
    const body = JSON.parse(init.body)
    expect(body._subject).toBe('Solicitud de nueva membresía')
    expect(NOTIFICATION_SUBJECT).toBe('Solicitud de nueva membresía')
    // The recipient is addressed in the URL, so it must be escaped: an
    // unencoded '+' in an address would silently become a space.
    expect(url).toBe('https://formsubmit.co/ajax/destino%40example.org')
  })

  it('reports the send', async () => {
    const result = await notifyNewMember({
      submission: makeSubmission(),
      institutionName: 'ITESO',
      to: 'destino@example.org',
      fetchImpl: okFetch(),
    })
    expect(result).toEqual({ sent: true })
  })

  /**
   * The submission is already in Firestore by the time this runs. Throwing here
   * would surface as "your application failed" to someone whose application
   * actually succeeded.
   */
  it('swallows a network failure instead of rejecting', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('offline'))
    await expect(
      notifyNewMember({
        submission: makeSubmission(),
        institutionName: null,
        to: 'destino@example.org',
        fetchImpl,
      }),
    ).resolves.toEqual({ sent: false })
  })

  /**
   * The failure mode nobody would notice: FormSubmit answers an unactivated
   * address with a 200 whose body says the mail was not sent. Trusting the
   * status code alone reported every one of those as delivered.
   */
  it('treats a 200 carrying success:"false" as unsent, not as delivered', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: 'false',
        message: "This form needs Activation. We've sent you an email...",
      }),
    } as unknown as Response)

    const result = await notifyNewMember({
      submission: makeSubmission(),
      institutionName: null,
      to: 'destino@example.org',
      fetchImpl,
    })

    expect(result.sent).toBe(false)
    expect(result.reason).toContain('Activation')
  })

  it('also handles a boolean false, in case the provider stops stringifying it', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: false }),
    } as unknown as Response)

    await expect(
      notifyNewMember({
        submission: makeSubmission(),
        institutionName: null,
        to: 'destino@example.org',
        fetchImpl,
      }),
    ).resolves.toMatchObject({ sent: false })
  })

  it('does not choke on a body that is not JSON', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => {
        throw new Error('not json')
      },
    } as unknown as Response)

    await expect(
      notifyNewMember({
        submission: makeSubmission(),
        institutionName: null,
        to: 'destino@example.org',
        fetchImpl,
      }),
    ).resolves.toEqual({ sent: true })
  })

  it('reports a rejected request as unsent without throwing', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false } as Response)
    await expect(
      notifyNewMember({
        submission: makeSubmission(),
        institutionName: null,
        to: 'destino@example.org',
        fetchImpl,
      }),
    ).resolves.toEqual({ sent: false })
  })

  it('makes no network call at all when no destination is configured', async () => {
    const fetchImpl = okFetch()
    const result = await notifyNewMember({
      submission: makeSubmission(),
      institutionName: null,
      to: '',
      fetchImpl,
    })
    // Same contract PostHog follows in this repo: unset key means no requests,
    // so a fork of the site never mails a stranger's inbox.
    expect(fetchImpl).not.toHaveBeenCalled()
    expect(result).toEqual({ sent: false })
  })
})

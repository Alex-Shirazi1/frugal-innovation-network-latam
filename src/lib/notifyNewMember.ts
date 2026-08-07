/**
 * Tells the network that someone filled in the join form.
 *
 * Allan's process starts with an email: the form is an expression of interest,
 * and his team replies to arrange a conversation. The subject line is fixed
 * because he filters his inbox on it.
 *
 * Delivery goes through FormSubmit, a form-to-email relay, rather than a server
 * of our own — production is Firebase Hosting plus Firestore straight from the
 * browser, so there is no backend to send from, and a Cloud Function would mean
 * putting the project on a billing plan for a few dozen emails a month.
 *
 * FormSubmit addresses the recipient directly in the endpoint, which is why the
 * destination is configuration rather than a vendor-side setting: pointing this
 * at a different inbox is an env var, not a new account. It needs no signup —
 * the first submission to a new address triggers a one-time confirmation email
 * to that address, and nothing is delivered until someone clicks it.
 *
 * The address is NOT hardcoded, deliberately: this repository is public, and a
 * mail address committed to it is a mail address in every scraper's list.
 *
 * Nothing here is load-bearing for the application itself. The submission is
 * stored before this runs and stays visible at /admin whether or not the mail
 * goes out, which is why every failure below is swallowed.
 */
import type { IntakeSubmission } from '../api/types'

/** Fixed: Allan filters his inbox on this exact string. */
export const NOTIFICATION_SUBJECT = 'Solicitud de nueva membresía'

/** AJAX variant: returns JSON and sends CORS headers, unlike the plain POST
 *  endpoint, which expects a browser form navigation. */
const ENDPOINT_BASE = 'https://formsubmit.co/ajax/'

const POSITION_LABELS: Record<string, string> = {
  staff: 'Personal administrativo',
  faculty: 'Docente',
  researcher: 'Investigador/a',
  administrator: 'Directivo/a',
  independent: 'Independiente',
}

const NOT_PROVIDED = '—'

function text(value: string | null | undefined): string {
  return value != null && value.trim() !== '' ? value.trim() : NOT_PROVIDED
}

function list(values: readonly string[] | undefined): string {
  return values && values.length > 0 ? values.join(', ') : NOT_PROVIDED
}

/**
 * FormSubmit renders every non-reserved key as a row in the email, so the field
 * names here are what Allan actually reads. They are Spanish for that reason —
 * this is internal mail to the network, not UI, so it does not follow the
 * visitor's chosen language.
 */
export function notificationFields(
  submission: IntakeSubmission,
  institutionName: string | null,
): Record<string, string> {
  return {
    Nombre: `${submission.firstName} ${submission.lastName}`.trim() || NOT_PROVIDED,
    'Tipo de posición': POSITION_LABELS[submission.position] ?? text(submission.position),
    Puesto: text(submission.jobPositionName),
    Afiliación: institutionName ?? 'Independiente',
    País: text(submission.country),
    Región: text(submission.region),
    Intereses: list(submission.interestIds),
    'Áreas generales': list(submission.generalAreaIds),
    Idiomas: list(submission.languages),
    'Enlace profesional': text(submission.socialUrl),
    'Consentimiento de publicación': submission.consentToPublish ? 'Sí' : 'No',
    Biografía: text(submission.biography),
  }
}

export interface NotifyResult {
  sent: boolean
  /** Provider-supplied explanation when a request succeeded but no mail went
   *  out — most often "this form needs activation". */
  reason?: string
}

export interface NotifyOptions {
  submission: IntakeSubmission
  institutionName: string | null
  /** Destination inbox. Defaults to `VITE_NOTIFY_EMAIL`; injectable for tests. */
  to?: string
  /** Injectable for tests; defaults to the platform fetch. */
  fetchImpl?: typeof fetch
}

/**
 * Never throws and never rejects.
 *
 * This runs *after* the submission is durably stored. Surfacing a mail failure
 * to the person who just filled in the form would tell them their application
 * did not go through, which would be false — so a failure here is swallowed and
 * reported only in the return value, for callers that want to log it.
 */
export async function notifyNewMember({
  submission,
  institutionName,
  to = import.meta.env.VITE_NOTIFY_EMAIL ?? '',
  fetchImpl = fetch,
}: NotifyOptions): Promise<NotifyResult> {
  // No address configured means no request at all — the same contract analytics
  // follows here, so a fork of this site never mails a stranger's inbox.
  if (!to) return { sent: false }

  try {
    const response = await fetchImpl(`${ENDPOINT_BASE}${encodeURIComponent(to)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        _subject: NOTIFICATION_SUBJECT,
        // Suppresses FormSubmit's interstitial captcha page. Harmless for a
        // JSON call, and the form already carries its own honeypot.
        _captcha: 'false',
        _template: 'table',
        ...notificationFields(submission, institutionName),
      }),
    })
    if (!response.ok) return { sent: false }

    /*
     * A 200 is not proof of delivery. FormSubmit answers an unactivated
     * address with HTTP 200 and `{"success":"false","message":"This form needs
     * Activation..."}` — so checking `response.ok` alone reports a send that
     * never happened, which is the one failure mode nobody would notice.
     *
     * `success` comes back as the STRING "false" here, not a boolean, so a
     * truthiness check would read it as success. Compare against both forms.
     */
    const body: unknown = await response.json().catch(() => null)
    const success = (body as { success?: unknown } | null)?.success
    if (success === false || success === 'false') {
      return { sent: false, reason: (body as { message?: string })?.message }
    }
    return { sent: true }
  } catch {
    return { sent: false }
  }
}

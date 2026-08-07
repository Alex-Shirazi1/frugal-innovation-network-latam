/**
 * Tells the network that someone filled in the join form.
 *
 * Allan's process starts with an email: the form is an expression of interest,
 * and his team replies to arrange a conversation. The subject line is fixed
 * because he filters his inbox on it.
 *
 * Delivery goes through Web3Forms, a form-to-email relay, rather than a server
 * of our own — production is Firebase Hosting plus Firestore straight from the
 * browser, so there is no backend to send from, and a Cloud Function would mean
 * putting the project on a billing plan for a few dozen emails a month.
 *
 * The access key is public by design and ships in the bundle. That is safe here
 * because the destination address is bound to the key on Web3Forms' side, so
 * the worst an abuser can do is flood the network's own inbox — not relay mail
 * to arbitrary recipients. The free tier is capped monthly, and if that cap is
 * ever burned the consequence is a missed notification, never a lost
 * application: the submission is written to Firestore first and is visible at
 * /admin regardless of whether this call succeeds.
 */
import type { IntakeSubmission } from '../api/types'

/** Fixed: Allan filters his inbox on this exact string. */
export const NOTIFICATION_SUBJECT = 'Solicitud de nueva membresía'

const ENDPOINT = 'https://api.web3forms.com/submit'

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
 * Web3Forms renders every non-reserved key as a row in the email, so the field
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

export interface NotifyOptions {
  accessKey: string
  submission: IntakeSubmission
  institutionName: string | null
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
  accessKey,
  submission,
  institutionName,
  fetchImpl = fetch,
}: NotifyOptions): Promise<{ sent: boolean }> {
  if (!accessKey) return { sent: false }

  try {
    const response = await fetchImpl(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        access_key: accessKey,
        subject: NOTIFICATION_SUBJECT,
        from_name: 'Sitio RELIF',
        ...notificationFields(submission, institutionName),
      }),
    })
    return { sent: response.ok }
  } catch {
    return { sent: false }
  }
}

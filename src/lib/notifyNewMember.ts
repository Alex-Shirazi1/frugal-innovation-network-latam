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
 * FormSubmit addresses the destination in the endpoint, so pointing this at a
 * different inbox is a config change, not a new account. It needs no signup —
 * the first submission to a new address triggers a one-time activation email to
 * that address, and NOTHING is delivered until someone clicks the link in it.
 *
 * The target should be the opaque alias FormSubmit issues in that activation
 * email, not the address itself. Vite bakes this value into the bundle, so a
 * naked address would be readable by anyone who views source on the live site;
 * the alias resolves to the inbox on FormSubmit's side and reveals nothing. A
 * plain address still works, which is what makes first-time setup possible —
 * see README for the swap.
 *
 * Nothing here is load-bearing for the application itself. The submission is
 * stored before this runs and stays visible at /admin whether or not the mail
 * goes out, which is why every failure below is swallowed.
 */
import {
  generalAreas,
  languageOptions,
  researchInterests,
} from '../data/onboardingOptions'
import type { IntakeSubmission } from '../api/types'

/** Fixed: Allan filters his inbox on this exact string. */
export const NOTIFICATION_SUBJECT = 'Solicitud de nueva membresía'

/** AJAX variant: returns JSON and sends CORS headers, unlike the plain POST
 *  endpoint, which expects a browser form navigation. */
const ENDPOINT_BASE = 'https://formsubmit.co/ajax/'

/**
 * Position labels are spelled out here rather than read from a data file
 * because `positionTypes` is a bare list of ids — the display strings live in
 * the i18n bundle, keyed for the UI's chosen language, and this mail is always
 * Spanish regardless of what language the applicant filled the form in.
 */
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

/**
 * Renders selected ids as the Spanish labels a reader recognises.
 *
 * The first version of this mail printed the raw ids — "salud, agua",
 * "ingenieria", "es" — because it lived in a separate Cloud Functions bundle
 * that could not import the app's data without dragging the whole module graph
 * into the deploy. Now that it runs in the browser alongside everything else,
 * that constraint is gone and there is no reason to make Allan decode ids.
 *
 * An id with no matching option falls back to the id rather than vanishing: a
 * value we cannot label is still information, and silently dropping it would
 * understate what the applicant selected.
 */
function labelled(
  ids: readonly string[] | undefined,
  options: readonly { id: string; es: string }[],
): string {
  if (!ids || ids.length === 0) return NOT_PROVIDED
  return ids.map((id) => options.find((option) => option.id === id)?.es ?? id).join(', ')
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
    Nombre: submission.fullName.trim() || NOT_PROVIDED,
    // Second row on purpose: replying is the next action after reading the name.
    Correo: text(submission.email),
    'Tipo de posición': POSITION_LABELS[submission.position] ?? text(submission.position),
    Puesto: text(submission.jobPositionName),
    Afiliación: institutionName ?? 'Independiente',
    País: text(submission.country),
    Región: text(submission.region),
    Intereses: labelled(submission.interestIds, researchInterests),
    'Áreas generales': labelled(submission.generalAreaIds, generalAreas),
    Idiomas: labelled(submission.languages, languageOptions),
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
  /** FormSubmit alias, or an address during first-time setup. Defaults to
   *  `VITE_NOTIFY_TARGET`; injectable for tests. */
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
  to = import.meta.env.VITE_NOTIFY_TARGET ?? '',
  fetchImpl = fetch,
}: NotifyOptions): Promise<NotifyResult> {
  // Nothing configured means no request at all — the same contract analytics
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

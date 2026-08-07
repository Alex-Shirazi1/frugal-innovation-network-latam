/**
 * Turns a `submissions` document into the body of the notification email.
 *
 * Kept free of any firebase-admin import so it can be unit-tested directly —
 * the trigger in index.ts is then thin enough to read at a glance.
 */

/** The subject Allan asked for on the call, verbatim. */
export const SUBJECT = 'Solicitud de nueva membresía'

/**
 * Shape written by `toSubmissionDocument` in src/api/adapters/firestore.ts.
 * Every field is optional here because this reads a document off the wire:
 * a malformed or partial write should still produce a sendable email rather
 * than crash the trigger and lose the notification entirely.
 */
export interface SubmissionDocument {
  firstName?: unknown
  lastName?: unknown
  position?: unknown
  jobPositionName?: unknown
  biography?: unknown
  affiliationId?: unknown
  country?: unknown
  region?: unknown
  interestIds?: unknown
  generalAreaIds?: unknown
  languages?: unknown
  socialUrl?: unknown
  consentToPublish?: unknown
  createdAt?: unknown
}

/**
 * Spanish labels for the five position types.
 *
 * Duplicated from src/i18n/translations.ts rather than imported: the functions
 * codebase compiles and deploys on its own, and reaching up into the Vite app's
 * source would drag its whole module graph into the deploy bundle. Five strings
 * that change roughly never is the cheaper trade. If a sixth position type is
 * ever added, the fallback below prints the raw id rather than dropping it.
 */
const POSITION_LABELS: Record<string, string> = {
  staff: 'Personal administrativo',
  faculty: 'Docente',
  researcher: 'Investigador/a',
  administrator: 'Directivo/a',
  independent: 'Independiente',
}

const NOT_PROVIDED = '—'

function text(value: unknown): string {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : NOT_PROVIDED
}

function list(value: unknown): string {
  return Array.isArray(value) && value.length > 0
    ? value.filter((entry) => typeof entry === 'string').join(', ')
    : NOT_PROVIDED
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function fullNameOf(submission: SubmissionDocument): string {
  const parts = [submission.firstName, submission.lastName]
    .filter((part): part is string => typeof part === 'string' && part.trim() !== '')
    .map((part) => part.trim())
  return parts.length > 0 ? parts.join(' ') : 'Solicitante sin nombre'
}

interface Field {
  label: string
  value: string
}

/**
 * Interests and areas are listed by id (`salud`, `agua`, …) rather than by
 * translated label, for the same bundle-size reason as the position labels.
 * The ids are legible, and the admin panel shows the full record anyway.
 */
function fieldsOf(submission: SubmissionDocument): Field[] {
  const position = typeof submission.position === 'string' ? submission.position : ''
  return [
    { label: 'Nombre', value: fullNameOf(submission) },
    { label: 'Tipo de posición', value: POSITION_LABELS[position] ?? text(submission.position) },
    { label: 'Puesto', value: text(submission.jobPositionName) },
    { label: 'Afiliación', value: text(submission.affiliationId) },
    { label: 'País', value: text(submission.country) },
    { label: 'Región', value: text(submission.region) },
    { label: 'Intereses', value: list(submission.interestIds) },
    { label: 'Áreas generales', value: list(submission.generalAreaIds) },
    { label: 'Idiomas', value: list(submission.languages) },
    { label: 'Enlace profesional', value: text(submission.socialUrl) },
    {
      label: 'Consentimiento de publicación',
      value: submission.consentToPublish === true ? 'Sí' : 'No',
    },
    { label: 'Recibida', value: text(submission.createdAt) },
  ]
}

export interface MailMessage {
  subject: string
  text: string
  html: string
}

export function buildMessage(submission: SubmissionDocument, adminUrl: string): MailMessage {
  const fields = fieldsOf(submission)
  const biography = text(submission.biography)
  const name = fullNameOf(submission)

  const plain = [
    `${name} completó el formulario de nuevos miembros en el sitio de la red.`,
    '',
    ...fields.map((field) => `${field.label}: ${field.value}`),
    '',
    'Biografía:',
    biography,
    '',
    `Revisar en el panel: ${adminUrl}`,
    '',
    'Este es el primer paso del proceso: la persona expresó interés, todavía no es miembro.',
  ].join('\n')

  const rows = fields
    .map(
      (field) =>
        `<tr><th align="left" style="padding:4px 16px 4px 0;color:#4d6a79;font-weight:600;vertical-align:top">${escapeHtml(field.label)}</th>` +
        `<td style="padding:4px 0;color:#203236">${escapeHtml(field.value)}</td></tr>`,
    )
    .join('')

  const html = [
    '<div style="font-family:system-ui,sans-serif;font-size:14px;line-height:1.5;color:#203236">',
    `<p><strong>${escapeHtml(name)}</strong> completó el formulario de nuevos miembros en el sitio de la red.</p>`,
    `<table style="border-collapse:collapse;margin:16px 0">${rows}</table>`,
    `<p style="color:#4d6a79;font-weight:600;margin-bottom:4px">Biografía</p>`,
    `<p style="margin-top:0">${escapeHtml(biography)}</p>`,
    `<p><a href="${escapeHtml(adminUrl)}" style="color:#168599">Revisar en el panel de administración</a></p>`,
    '<p style="color:#4d6a79;font-size:12px">Este es el primer paso del proceso: la persona expresó interés, todavía no es miembro.</p>',
    '</div>',
  ].join('')

  return { subject: SUBJECT, text: plain, html }
}

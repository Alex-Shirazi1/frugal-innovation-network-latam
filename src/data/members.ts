import { institutions } from './institutions'
import { type PositionType } from './onboardingOptions'
import { positionTitles } from '../domain/intake'
import type { Localized } from './conference'

export interface Member {
  id: string
  /**
   * The member's whole name, exactly as they typed it.
   *
   * Deliberately NOT split into given name and surname. Spanish naming makes
   * the boundary unknowable — "María Fernanda Gómez Ruiz" could surname at
   * "Gómez" or at "Fernanda" — so any split is a guess, and a guess made once
   * at intake is a guess nobody can see or correct later. Storing the whole
   * string keeps the record faithful to what the person actually wrote.
   */
  fullName: string
  /**
   * Curated, translated descriptor used for the card subtitle. Derived from
   * `position` — NOT user-authored, which is why it can be localized.
   */
  title: Localized
  position: string
  /** Free-text job title the member types themselves, in their own language. */
  jobPositionName: string
  /** Short self-authored bio. Single language; rendered as plain text. */
  biography: string
  /** Institution id, or null for independent members */
  affiliationId: string | null
  country: string
  region: string
  /** Narrow technical research interests (ids from researchInterests). */
  interestIds: string[]
  /** Broad disciplinary areas (ids from generalAreas). */
  generalAreaIds: string[]
  /** ISO 639-1 codes from languageOptions. */
  languages: string[]
  socialUrl?: string
  /** Deterministic hue used for the avatar placeholder */
  avatarHue: number
  /**
   * ISO instant the profile was published, set once at publish time.
   *
   * Optional because the bundled seed profiles have no such moment — they are
   * compiled into the repo rather than published through the pipeline. Distinct
   * from the submission's `createdAt`, which is queue bookkeeping and is
   * deliberately not carried onto a published record: this is when the person
   * became visible, not when they first wrote in.
   */
  publishedAt?: string
}

/**
 * The bundled member directory — REAL PEOPLE, admitted through the membership
 * form and confirmed by Allan as consenting to publication.
 *
 * This replaced 54 deterministically generated fictional profiles. That seed
 * existed so the directory could be designed and demoed at 50+ cards, but an
 * empty `members` collection makes the site fall back to whatever is compiled in
 * here — so on a production project those mocks published 54 invented academics
 * with dead `scholar.example.org` links, and nothing about it looked broken.
 *
 * Every field below is derived from what the person actually wrote on the form.
 * Interests and areas come from their own answers about which commission they
 * want to join and what projects they want to work on; biographies are condensed
 * from their own words. Nothing here is inferred about a person beyond what they
 * stated, which is the whole reason the mock set had to go rather than shrink.
 *
 * Names are stored whole, as typed — see the note on `fullName` above. All three
 * happen to be four- or two-word Spanish names, which is exactly the case a
 * given-name/surname split would have guessed at.
 *
 * Deliberately absent: email and telephone. `members` is world-readable and the
 * Member record has no field for either — contact details stay in
 * `formResponses`, which the rules keep private.
 */
const seed: Array<Omit<Member, 'title'>> = [
  {
    id: 'david-enriquez',
    fullName: 'David Enriquez',
    position: 'staff',
    jobPositionName: 'Coordinador de Eje, Eje de Economías Transformadoras',
    biography:
      'Trabaja con comunidades rurales, campesinas, indígenas y afrodescendientes en el sur de Colombia, ' +
      'en circuitos económicos solidarios, grupos autogestionados de ahorro y crédito y circuitos cortos ' +
      'de comercialización.',
    affiliationId: 'suyusama',
    country: 'Colombia',
    region: 'Nariño',
    interestIds: ['educacion', 'agro', 'emprendimiento', 'diseno'],
    generalAreaIds: ['ciencias-sociales', 'educacion-area', 'agronomia'],
    languages: ['es'],
    // The form's LinkedIn field held an organisation name rather than a URL, so
    // there is nothing to link to. Better absent than pointing somewhere wrong.
    avatarHue: 190,
  },
  {
    id: 'angela-gomez-duque',
    fullName: 'Ángela María Gómez Duque',
    position: 'independent',
    jobPositionName: 'Fundadora, The Other Narrative',
    biography:
      'Desde la comunicación, apalanca iniciativas de desarrollo comunitario. Produce el podcast ' +
      'The Other Narrative y revistas digitales.',
    // Stated her affiliation as personal rather than institutional, so the
    // profile carries no organisation.
    affiliationId: null,
    country: 'Colombia',
    region: 'Bogotá D.C.',
    interestIds: ['educacion', 'tecnologias', 'diseno'],
    generalAreaIds: ['diseno-arte', 'ciencias-sociales', 'educacion-area'],
    languages: ['es'],
    socialUrl: 'https://www.linkedin.com/in/angelamgomezd/',
    avatarHue: 340,
  },
  {
    id: 'francisco-alvarez-torres',
    fullName: 'Francisco Javier Álvarez Torres',
    position: 'faculty',
    jobPositionName: 'Profesor-Investigador, División de Ciencias Naturales y Exactas',
    biography:
      'Trabaja en innovaciones simples que integran materiales que otras áreas consideran desecho, ' +
      'e incorpora el arte y la sustentabilidad a los procesos de innovación frugal. Actualmente ' +
      'desarrolla proyectos de inteligencia artificial aplicada a la educación.',
    affiliationId: 'ugto',
    country: 'México',
    region: 'Guanajuato',
    interestIds: ['economia-circular', 'metodologias', 'tecnologias', 'educacion'],
    generalAreaIds: ['ciencias-naturales', 'computacion', 'educacion-area'],
    languages: ['es'],
    socialUrl: 'https://www.linkedin.com/in/innovatuber/',
    avatarHue: 40,
  },
]

/**
 * `title` is derived rather than stored by hand: it is a curated translated
 * descriptor of `position`, not something a member authors, which is what makes
 * it localizable at all.
 */
export const seedMembers: Member[] = seed.map((member) => ({
  ...member,
  title: positionTitles[member.position as PositionType] || {
    es: member.position,
    en: member.position,
    pt: member.position,
  },
}))

export function institutionName(affiliationId: string | null): string | null {
  if (!affiliationId) return null
  return institutions.find((i) => i.id === affiliationId)?.name ?? null
}

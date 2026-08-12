/**
 * The congress card.
 *
 * A single editable block rather than a collection: there is one congress, and
 * Allan asked to be able to update its copy and dates himself each year without
 * a deploy. This is the seed the site renders until Firestore holds a
 * `siteContent/congress` document.
 *
 * The strings were lifted from the three dictionaries rather than retyped.
 */
import type { EditableText } from './initiatives'

/**
 * One photo on the congress card.
 *
 * A URL rather than an uploaded file, and that is a deliberate trade rather than
 * a shortcut. Accepting an upload means Cloud Storage, which on projects created
 * now requires billing to be enabled — and this site is built to keep running on
 * the free plan without a billing account attached to anyone. A URL costs a
 * paste from wherever the photos already live (Drive, the congress microsite,
 * the university's own site) and keeps the network's ability to update the card
 * without a developer, which is what Allan actually asked for.
 *
 * The cost is real and worth stating: nothing here verifies the link still
 * resolves, so a photo can quietly disappear when somebody tidies up the folder
 * it came from. Revisit this if the project ever moves to Blaze.
 */
export interface CongressImage {
  /** Absolute https URL. Rejected by the rules if it is anything else. */
  url: string
  /**
   * Localized, because it is read aloud in whichever language the visitor chose
   * and a Spanish description helps nobody using the site in Portuguese.
   */
  alt: EditableText
}

/**
 * How many photos the card accepts.
 *
 * Low, and not arbitrarily so. Firestore rules cannot loop, so the generator
 * unrolls one validation clause per index, and a rules request is capped at
 * 1,000 evaluated expressions in total. Validating a localized `alt` on each
 * photo is what makes each clause expensive: measured against the emulator,
 * five photos pass and six exceed the cap, failing the write with
 * `PERMISSION_DENIED` and a message about expressions rather than anything
 * resembling "too many photos".
 *
 * Four leaves a slot of headroom, because that budget is shared with every
 * other clause in the request — adding one more field to the congress document
 * spends it too. Raising this number is fine, but it is not a one-line change:
 * `npm run test:rules` is what proves the ladder still fits, and the ceiling
 * test in server/firestore-rules.test.ts writes exactly this many on purpose.
 *
 * Trading the localized alt for a plain string would buy several more slots, if
 * a future congress needs a gallery more than it needs screen readers to work
 * in all three languages.
 */
export const MAX_CONGRESS_IMAGES = 4

export interface Congress {
  kicker: EditableText
  title: EditableText
  subtitle: EditableText
  /** Dates and place, as one line — the format varies by year and language. */
  details: EditableText
  siteCta: EditableText
  /** The network's own microsite for the event. */
  siteUrl: string
  /**
   * Optional, and optional on purpose: the document already in Firestore
   * predates this field, and requiring it would make the next save of an
   * untouched card fail validation.
   */
  images?: CongressImage[]
}

export const congress: Congress = {
  kicker: {
    es: "El congreso",
    en: "The congress",
    pt: "O congresso"
  },
  title: {
    es: "Mundos de Transformación",
    en: "Worlds of Transformation",
    pt: "Mundos de Transformação"
  },
  subtitle: {
    es: "Primer Congreso de Innovación Frugal, Tecnologías Sociales y Ciencia Ciudadana en América Latina.",
    en: "First Congress of Frugal Innovation, Social Technologies and Citizen Science in Latin America.",
    pt: "Primeiro Congresso de Inovação Frugal, Tecnologias Sociais e Ciência Cidadã na América Latina."
  },
  details: {
    es: "27–29 de mayo de 2026 · Bogotá, Colombia",
    en: "27–29 May 2026 · Bogotá, Colombia",
    pt: "27–29 de maio de 2026 · Bogotá, Colômbia"
  },
  siteCta: {
    es: "Sitio del congreso",
    en: "Conference site",
    pt: "Site do congresso"
  },
  siteUrl: 'https://redinnovacionfrugal.lat/congreso/index.php',
}

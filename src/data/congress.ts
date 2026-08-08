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

export interface Congress {
  kicker: EditableText
  title: EditableText
  subtitle: EditableText
  /** Dates and place, as one line — the format varies by year and language. */
  details: EditableText
  siteCta: EditableText
  /** The network's own microsite for the event. */
  siteUrl: string
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

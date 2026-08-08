/**
 * The Iniciativas cards.
 *
 * Allan asked for these to be editable without a deploy: "a title, a short
 * description, and a link", added, edited and deleted from the admin panel. So
 * the content lives here as data rather than in the i18n dictionary, and this
 * array is the fallback the site renders when Firestore holds nothing — the
 * seed, not the source of truth.
 *
 * The strings were lifted verbatim from the three dictionaries rather than
 * retyped, so nothing drifted in the move.
 */
import type { Localized } from './conference'

/**
 * Content the network edits itself.
 *
 * Spanish is required; the other two are optional and fall back to it. Asking
 * Allan to supply three translations before a card can go live would mean
 * either a blank card or an English-only one on the Portuguese site, and the
 * network works in Spanish first.
 */
export interface EditableText {
  es: string
  en?: string
  pt?: string
}

export interface Initiative {
  id: string
  /** Ascending display order. Gaps are fine; only the sort matters. */
  order: number
  title: EditableText
  text: EditableText
  /** Null when an initiative has nowhere to point yet. */
  url: string | null
  /** Link label. Null whenever `url` is null. */
  cta: EditableText | null
}

/** Resolves an editable string for a language, falling back to Spanish. */
export function localizeText(value: EditableText, lang: keyof Localized): string {
  return value[lang]?.trim() || value.es
}

export const initiatives: Initiative[] = [
  {
    id: "encuentros",
    order: 0,
    title: {
      es: "Encuentros anuales",
      en: "Annual gatherings",
      pt: "Encontros anuais"
    },
    text: {
      es: "Congresos y encuentros que reúnen a la comunidad frugal de la región.",
      en: "Conferences and meetings that bring together the region’s frugal community.",
      pt: "Congressos e encontros que reúnem a comunidade frugal da região."
    },
    url: null,
    cta: null,
  },
  {
    id: "podcast",
    order: 1,
    title: {
      es: "Podcast Onda Frugal",
      en: "Onda Frugal podcast",
      pt: "Podcast Onda Frugal"
    },
    text: {
      es: "Conversaciones con innovadoras e innovadores frugales de América Latina.",
      en: "Conversations with frugal innovators from across Latin America.",
      pt: "Conversas com inovadoras e inovadores frugais da América Latina."
    },
    url: "https://open.spotify.com/show/6UgcfOT7HTt8OX5vIxQw0U",
    cta: {
      es: "Escuchar en Spotify",
      en: "Listen on Spotify",
      pt: "Ouvir no Spotify"
    },
  },
  {
    id: "casos",
    order: 2,
    title: {
      es: "Casos de innovación",
      en: "Innovation cases",
      pt: "Casos de inovação"
    },
    text: {
      es: "Documentación de casos reales de innovación frugal en la región.",
      en: "Documentation of real frugal innovation cases in the region.",
      pt: "Documentação de casos reais de inovação frugal na região."
    },
    url: "https://www.youtube.com/@redlatinoamericanadeinnova2173",
    cta: {
      es: "Ver los casos",
      en: "Watch the cases",
      pt: "Ver os casos"
    },
  },
  {
    id: "mooc",
    order: 3,
    title: {
      es: "MOOC en edX",
      en: "MOOC on edX",
      pt: "MOOC no edX"
    },
    text: {
      es: "Curso en línea: cómo innovar con escasos recursos.",
      en: "Online course: how to innovate with scarce resources.",
      pt: "Curso on-line: como inovar com poucos recursos."
    },
    url: "https://www.edx.org/es/learn/sustainability/pontificia-universidad-javeriana-innovacion-frugal-soluciones-sostenibles-con-los-recursos-a-tu-alcance",
    cta: {
      es: "Ver el curso en edX",
      en: "View the course on edX",
      pt: "Ver o curso no edX"
    },
  },
  {
    id: "investigacion",
    order: 4,
    title: {
      es: "Investigación",
      en: "Research",
      pt: "Pesquisa"
    },
    text: {
      es: "Proyectos académicos que estudian la frugalidad desde múltiples disciplinas.",
      en: "Academic projects studying frugality across multiple disciplines.",
      pt: "Projetos acadêmicos que estudam a frugalidade a partir de múltiplas disciplinas."
    },
    url: null,
    cta: null,
  },
  {
    id: "herramientas",
    order: 5,
    title: {
      es: "Diseño de herramientas",
      en: "Tool design",
      pt: "Design de ferramentas"
    },
    text: {
      es: "Metodologías y marcos de trabajo abiertos, como el Marco RELIF.",
      en: "Open methodologies and frameworks, such as the RELIF Framework.",
      pt: "Metodologias e marcos de trabalho abertos, como o Marco RELIF."
    },
    url: null,
    cta: null,
  },
  {
    id: "encuentro-anual",
    order: 6,
    title: {
      es: "Encuentro Anual RELIF",
      en: "RELIF Annual Meeting",
      pt: "Encontro Anual RELIF"
    },
    text: {
      es: "Grabaciones del encuentro virtual anual de la red, 18 y 19 de noviembre de 2021.",
      en: "Recordings of the network\u2019s virtual annual meeting, 18\u201319 November 2021.",
      pt: "Grava\u00e7\u00f5es do encontro virtual anual da rede, 18 e 19 de novembro de 2021."
    },
    url: "https://www.youtube.com/watch?v=zcUO-IOQDz4",
    cta: {
      es: "Ver las grabaciones",
      en: "Watch the recordings",
      pt: "Ver as grava\u00e7\u00f5es"
    },
  },
]

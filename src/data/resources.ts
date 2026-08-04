import type { Localized } from './conference'

export type ResourceLang = 'ES' | 'EN' | 'PT'
export type ResourceType = 'PDF' | 'Guía' | 'Artículo' | 'Bibliografía'

export interface Resource {
  id: string
  title: Localized
  language: ResourceLang
  author: string
  year: number
  type: ResourceType
  /**
   * Path under public/docs. Four of these are the real documents migrated from
   * the production site; the rest are generated placeholders until Allan
   * supplies the originals. Dropping a real PDF in with the same filename needs
   * no code change — see scripts/generate-placeholder-pdfs.mjs, which refuses to
   * overwrite anything that is not one of its own placeholders.
   */
  file: string
  summary: Localized
}

/**
 * The network's own documents, as actually published.
 *
 * This deliberately holds only documents that exist. An earlier version listed
 * nine entries including a MOOC guide, a 2024 meeting agenda and an English
 * edition of the framework — none of which the network publishes anywhere, on
 * the site or in its Drive folder. They were design fixtures, and showing them
 * would have implied documents that do not exist.
 *
 * One entry was cut on that basis in error: the standalone references PDF is
 * real. The production site publishes img/Referencias-RELIF-0519.pdf (230 KB)
 * and links it from the home page. It is not served here yet only because we do
 * not hold a copy — it is on the ask list, not absent by design.
 *
 * Separately, the academic references that "REFERENCIAS" used to point at are
 * also carried as the 43-paper bibliography (src/data/bibliography.ts).
 */
export const resources: Resource[] = [
  {
    id: 'marco-relif',
    title: {
      es: 'Marco RELIF de Innovación Frugal',
      en: 'RELIF Frugal Innovation Framework',
      pt: 'Marco RELIF de Inovação Frugal',
    },
    language: 'ES',
    author: 'RELIF',
    year: 2020,
    type: 'PDF',
    file: '/docs/marco-relif.pdf',
    summary: {
      es: 'El marco de trabajo de la red: principios, dimensiones y criterios de la innovación frugal en América Latina.',
      en: 'The network’s framework: principles, dimensions, and criteria for frugal innovation in Latin America.',
      pt: 'O marco de trabalho da rede: princípios, dimensões e critérios da inovação frugal na América Latina.',
    },
  },
  {
    id: 'mundos-announcement-es',
    title: {
      es: 'Mundos de Transformación — Convocatoria (ES)',
      en: 'Worlds of Transformation — Announcement (ES)',
      pt: 'Mundos de Transformação — Chamada (ES)',
    },
    language: 'ES',
    author: 'Comité organizador',
    year: 2025,
    type: 'PDF',
    file: '/docs/mundos-convocatoria-es.pdf',
    summary: {
      es: 'Convocatoria oficial del congreso: motivación, temas, modalidades de participación y cronograma.',
      en: 'Official conference announcement: motivation, topics, participation formats, and timeline.',
      pt: 'Chamada oficial do congresso: motivação, temas, modalidades de participação e cronograma.',
    },
  },
  {
    id: 'mundos-announcement-en',
    title: {
      es: 'Mundos de Transformación — Convocatoria (EN)',
      en: 'Worlds of Transformation — Announcement (EN)',
      pt: 'Mundos de Transformação — Chamada (EN)',
    },
    language: 'EN',
    author: 'Comité organizador',
    year: 2025,
    type: 'PDF',
    file: '/docs/mundos-announcement-en.pdf',
    summary: {
      es: 'Versión en inglés de la convocatoria del congreso.',
      en: 'English edition of the conference announcement.',
      pt: 'Versão em inglês da chamada do congresso.',
    },
  },
  {
    id: 'mundos-announcement-pt',
    title: {
      es: 'Mundos de Transformación — Convocatoria (PT)',
      en: 'Worlds of Transformation — Announcement (PT)',
      pt: 'Mundos de Transformação — Chamada (PT)',
    },
    language: 'PT',
    author: 'Comité organizador · REBRIF',
    year: 2025,
    type: 'PDF',
    file: '/docs/mundos-convocatoria-pt.pdf',
    summary: {
      es: 'Versión en portugués de la convocatoria, en colaboración con REBRIF.',
      en: 'Portuguese edition of the announcement, in collaboration with REBRIF.',
      pt: 'Versão em português da chamada, em colaboração com a REBRIF.',
    },
  },
]

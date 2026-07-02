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
  /** Local mock path — real files migrate out of Google Drive later */
  file: string
  summary: Localized
}

/**
 * Catalog of the documents that today live in a raw Google Drive folder.
 * Files are referenced by local paths so the library works fully offline;
 * the real PDFs get dropped into /public/docs during content migration.
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
    id: 'relif-framework-en',
    title: {
      es: 'RELIF Framework (edición en inglés)',
      en: 'RELIF Framework (English edition)',
      pt: 'RELIF Framework (edição em inglês)',
    },
    language: 'EN',
    author: 'RELIF',
    year: 2021,
    type: 'PDF',
    file: '/docs/relif-framework-en.pdf',
    summary: {
      es: 'Versión en inglés del marco RELIF para audiencias internacionales.',
      en: 'English edition of the RELIF framework for international audiences.',
      pt: 'Versão em inglês do marco RELIF para públicos internacionais.',
    },
  },
  {
    id: 'referencias',
    title: {
      es: 'Referencias académicas RELIF',
      en: 'RELIF Academic References',
      pt: 'Referências acadêmicas RELIF',
    },
    language: 'ES',
    author: 'Comisión de Investigación',
    year: 2019,
    type: 'Bibliografía',
    file: '/docs/referencias-relif.pdf',
    summary: {
      es: 'Bibliografía comentada sobre innovación frugal: artículos, libros y casos fundacionales.',
      en: 'Annotated bibliography on frugal innovation: foundational articles, books, and cases.',
      pt: 'Bibliografia comentada sobre inovação frugal: artigos, livros e casos fundacionais.',
    },
  },
  {
    id: 'covid-frugal',
    title: {
      es: 'Innovación frugal en tiempos de COVID',
      en: 'Frugal Innovation in COVID Times',
      pt: 'Inovação frugal em tempos de COVID',
    },
    language: 'ES',
    author: 'Red RELIF',
    year: 2020,
    type: 'Artículo',
    file: '/docs/innovacion-frugal-covid.pdf',
    summary: {
      es: 'Cómo la pandemia aceleró soluciones frugales en salud, educación y economía local.',
      en: 'How the pandemic accelerated frugal solutions in health, education, and local economies.',
      pt: 'Como a pandemia acelerou soluções frugais em saúde, educação e economia local.',
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
  {
    id: 'guia-mooc',
    title: {
      es: 'Guía del MOOC: innovar con escasos recursos',
      en: 'MOOC Guide: Innovating with Scarce Resources',
      pt: 'Guia do MOOC: inovar com poucos recursos',
    },
    language: 'ES',
    author: 'Pontificia Universidad Javeriana',
    year: 2022,
    type: 'Guía',
    file: '/docs/guia-mooc.pdf',
    summary: {
      es: 'Guía de acompañamiento del curso en línea de innovación frugal disponible en edX.',
      en: 'Companion guide for the frugal innovation online course available on edX.',
      pt: 'Guia de acompanhamento do curso on-line de inovação frugal disponível no edX.',
    },
  },
  {
    id: 'agenda-encuentro-2024',
    title: {
      es: 'Agenda — Encuentro Anual RELIF 2024',
      en: 'Agenda — RELIF 2024 Annual Meeting',
      pt: 'Agenda — Encontro Anual RELIF 2024',
    },
    language: 'ES',
    author: 'Comisión de Eventos',
    year: 2024,
    type: 'PDF',
    file: '/docs/agenda-encuentro-2024.pdf',
    summary: {
      es: 'Programa completo del encuentro anual 2024 de la red.',
      en: 'Full program of the network’s 2024 annual meeting.',
      pt: 'Programa completo do encontro anual 2024 da rede.',
    },
  },
]

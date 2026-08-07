import type { Localized } from './conference'

/**
 * Network-level content transcribed from the public production site
 * (redinnovacionfrugal.lat). Names, emails and destinations are real; the
 * Spanish text is the network's own wording, with EN/PT translations added
 * because the redesign is trilingual and the original was Spanish-only.
 *
 * Nothing here reads from or writes to the production backend.
 */

export type SocialId =
  | 'linktree'
  | 'youtube'
  | 'facebook'
  | 'twitter'
  | 'instagram'
  | 'linkedin'
  | 'spotify'

export interface SocialLink {
  id: SocialId
  /** Shown as the accessible name; the handle is shown visually. */
  label: string
  handle: string
  url: string
}

/** Live destinations from the production site's Redes Sociales section. */
export const socialLinks: SocialLink[] = [
  {
    id: 'linkedin',
    label: 'LinkedIn',
    handle: 'redlatinnofrugal',
    url: 'https://www.linkedin.com/company/redlatinnofrugal/',
  },
  {
    id: 'youtube',
    label: 'YouTube',
    handle: '@redlatinoamericanadeinnova2173',
    url: 'https://www.youtube.com/@redlatinoamericanadeinnova2173',
  },
  {
    id: 'instagram',
    label: 'Instagram',
    handle: '@red_lat_innovacion_frugal',
    url: 'https://www.instagram.com/red_lat_innovacion_frugal/',
  },
  {
    id: 'facebook',
    label: 'Facebook',
    handle: 'Red.Latinoamericana.Innovacion.Frugal',
    url: 'https://www.facebook.com/Red.Latinoamericana.Innovacion.Frugal',
  },
  {
    id: 'twitter',
    label: 'X',
    handle: '@RedFrugal',
    url: 'https://twitter.com/RedFrugal',
  },
  {
    id: 'spotify',
    label: 'Spotify',
    handle: 'Onda Frugal',
    url: 'https://open.spotify.com/show/6UgcfOT7HTt8OX5vIxQw0U',
  },
  {
    id: 'linktree',
    label: 'Linktree',
    handle: 'redinnovacionfrugal',
    url: 'https://linktr.ee/redinnovacionfrugal',
  },
]

/** Both addresses the production site publishes. */
export const networkEmails = {
  general: 'contacto@redinnovacionfrugal.lat',
  alternate: 'redinnovacionfrugal@gmail.com',
} as const

export interface RegionalContact {
  id: string
  /** Region this person covers. */
  region: Localized
  name: string
  /** Role and institution, as the network states it. */
  role: Localized
  city: string
  email: string
}

/** The five regional leads listed under Contacto on the production site. */
export const regionalContacts: RegionalContact[] = [
  {
    id: 'sudamerica',
    region: {
      es: 'Sudamérica (excepto Brasil)',
      en: 'South America (except Brazil)',
      pt: 'América do Sul (exceto Brasil)',
    },
    name: 'Christian Briceño',
    role: {
      es: 'Fundador y consultor, Frugal Lab',
      en: 'Founder and consultant, Frugal Lab',
      pt: 'Fundador e consultor, Frugal Lab',
    },
    city: 'Lima, Perú',
    email: 'christianjbw@gmail.com',
  },
  {
    id: 'mexico-centroamerica',
    region: {
      es: 'México y Centroamérica',
      en: 'Mexico and Central America',
      pt: 'México e América Central',
    },
    name: 'María Guadalupe López',
    role: {
      es: 'Profesora de Ingeniería, Universidad Iberoamericana Puebla',
      en: 'Professor of Engineering, Universidad Iberoamericana Puebla',
      pt: 'Professora de Engenharia, Universidad Iberoamericana Puebla',
    },
    city: 'Puebla, México',
    email: 'musi.lopez@iberopuebla.mx',
  },
  {
    id: 'brasil-portugal',
    region: {
      es: 'Brasil y Portugal',
      en: 'Brazil and Portugal',
      pt: 'Brasil e Portugal',
    },
    name: 'Maria Barbosa Lima',
    role: {
      es: 'Directora y fundadora, INNODEVA',
      en: 'Director and founder, INNODEVA',
      pt: 'Diretora e fundadora, INNODEVA',
    },
    city: 'Belo Horizonte, Brasil',
    email: 'maria.limatoivanen@innodeva.com.br',
  },
  {
    id: 'norteamerica-europa',
    region: {
      es: 'Norteamérica y Europa',
      en: 'North America and Europe',
      pt: 'América do Norte e Europa',
    },
    name: 'Allan Báez',
    role: {
      es: 'Hub de Innovación Frugal, Santa Clara University',
      en: 'Frugal Innovation Hub, Santa Clara University',
      pt: 'Hub de Inovação Frugal, Santa Clara University',
    },
    city: 'Santa Clara, California',
    email: 'abaezmorales@scu.edu',
  },
  {
    id: 'cooperacion-internacional',
    region: {
      es: 'Cooperación internacional',
      en: 'International cooperation',
      pt: 'Cooperação internacional',
    },
    name: 'Leticia Gennes-Beltrán',
    role: {
      es: 'Directora y fundadora, World Entrepreneurs',
      en: 'Director and founder, World Entrepreneurs',
      pt: 'Diretora e fundadora, World Entrepreneurs',
    },
    city: 'Ginebra, Suiza',
    email: 'lgbprojects@gmail.com',
  },
]

export interface NetworkValue {
  id: string
  name: Localized
  text: Localized
}

/** The five values the network publishes under Acerca de RELIF. */
export const networkValues: NetworkValue[] = [
  {
    id: 'compromiso',
    name: { es: 'Compromiso', en: 'Commitment', pt: 'Compromisso' },
    text: {
      es: 'Ejecutar con disciplina, responsabilidad y respeto las acciones que consolidan a las comunidades que servimos y con ello a la Red.',
      en: 'Carrying out with discipline, responsibility and respect the actions that strengthen the communities we serve, and with them the Network.',
      pt: 'Executar com disciplina, responsabilidade e respeito as ações que consolidam as comunidades que servimos e, com elas, a Rede.',
    },
  },
  {
    id: 'colaboracion',
    name: { es: 'Colaboración', en: 'Collaboration', pt: 'Colaboração' },
    text: {
      es: 'Avanzar empatizando y cocreando junto a los grupos de interés a quienes servimos.',
      en: 'Moving forward by empathising and co-creating alongside the stakeholders we serve.',
      pt: 'Avançar com empatia e cocriação junto aos grupos de interesse que servimos.',
    },
  },
  {
    id: 'creatividad',
    name: { es: 'Creatividad', en: 'Creativity', pt: 'Criatividade' },
    text: {
      es: 'En la búsqueda y diseño de soluciones usando recursos locales de forma sostenible.',
      en: 'In seeking and designing solutions that use local resources sustainably.',
      pt: 'Na busca e no design de soluções usando recursos locais de forma sustentável.',
    },
  },
  {
    id: 'empoderamiento',
    name: { es: 'Empoderamiento', en: 'Empowerment', pt: 'Empoderamento' },
    text: {
      es: 'Facilitadores del cambio positivo e independencia de las comunidades en torno a soluciones cocreadas.',
      en: 'Enabling positive change and community independence around co-created solutions.',
      pt: 'Facilitadores da mudança positiva e da independência das comunidades em torno de soluções cocriadas.',
    },
  },
  {
    id: 'multiculturalidad',
    name: { es: 'Multiculturalidad', en: 'Multiculturalism', pt: 'Multiculturalidade' },
    text: {
      es: 'Respeto y adaptación de buenas prácticas locales y globales valiosas para diferentes proyectos y contextos.',
      en: 'Respecting and adapting valuable local and global good practices across different projects and contexts.',
      pt: 'Respeito e adaptação de boas práticas locais e globais valiosas para diferentes projetos e contextos.',
    },
  },
]

/** The four commissions that manage the network's strategic lines. */
export const commissions: Localized[] = [
  {
    es: 'Gestión de las líneas estratégicas de la Red.',
    en: "Management of the Network's strategic lines.",
    pt: 'Gestão das linhas estratégicas da Rede.',
  },
  {
    es: 'Diseño e implementación de proyectos.',
    en: 'Project design and implementation.',
    pt: 'Design e implementação de projetos.',
  },
  {
    es: 'Diseño y desarrollo de programas, talleres y metodologías de formación y capacitación.',
    en: 'Design and development of training programmes, workshops and methodologies.',
    pt: 'Design e desenvolvimento de programas, oficinas e metodologias de formação.',
  },
  {
    es: 'Desarrollo de eventos presenciales y virtuales al interior de la Red, así como la participación en eventos externos.',
    en: 'Running in-person and virtual events within the Network, and taking part in external ones.',
    pt: 'Realização de eventos presenciais e virtuais na Rede, além da participação em eventos externos.',
  },
]


import { institutions } from './institutions'
import {
  cityToRegion,
  generalAreas,
  languageOptions,
  researchInterests,
  type PositionType,
} from './onboardingOptions'
import type { Localized } from './conference'

export interface Member {
  id: string
  /** Allan asked for first and last name separately. */
  firstName: string
  lastName: string
  /** Derived from firstName + lastName. Kept on the record so search, sort,
   *  and display never have to re-join the parts inconsistently. */
  fullName: string
  /**
   * Curated, translated descriptor used for the card subtitle. Derived from
   * `position` — NOT user-authored, which is why it can be localized.
   */
  title: Localized
  position: PositionType
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
}

/**
 * MOCK DATA ONLY — no real individual-member data exists yet (per Allan).
 * All 54 profiles below are fictional and generated deterministically so the
 * directory can be designed, performance-tested, and demoed at 50+ cards.
 */
const firstNames = [
  'Valentina', 'Mateo', 'Camila', 'Santiago', 'Lucía', 'Sebastián', 'Isabella',
  'Diego', 'Mariana', 'Joaquín', 'Fernanda', 'Emiliano', 'Antonia', 'Tomás',
  'Renata', 'Gabriel', 'Ximena', 'Andrés', 'Paula', 'Rodrigo', 'Daniela',
  'Felipe', 'Carolina', 'Nicolás', 'Alejandra', 'Bruno', 'Julieta',
]

const lastNames = [
  'Restrepo', 'Fuentes', 'Salazar', 'Miranda', 'Cortés', 'Aguilar', 'Paredes',
  'Villanueva', 'Herrera', 'Navarro', 'Ríos', 'Campos', 'Delgado', 'Peña',
  'Sandoval', 'Quintero', 'Molina', 'Vergara', 'Cabrera', 'Ochoa', 'Ibarra',
  'Zamora', 'Escobar', 'Tapia', 'Bustos', 'Arriaga', 'Ferreira',
]

const titles: Localized[] = [
  { es: 'Dra. en Diseño e Innovación', en: 'PhD in Design & Innovation', pt: 'Dra. em Design e Inovação' },
  { es: 'Profesor de Ingeniería', en: 'Professor of Engineering', pt: 'Professor de Engenharia' },
  { es: 'Investigadora en Sostenibilidad', en: 'Sustainability Researcher', pt: 'Pesquisadora em Sustentabilidade' },
  { es: 'Consultor en Innovación Social', en: 'Social Innovation Consultant', pt: 'Consultor em Inovação Social' },
  { es: 'Coordinadora de Vinculación', en: 'Outreach Coordinator', pt: 'Coordenadora de Articulação' },
  { es: 'Estudiante de Doctorado', en: 'Doctoral Student', pt: 'Doutorando' },
  { es: 'Director de Emprendimiento', en: 'Director of Entrepreneurship', pt: 'Diretor de Empreendedorismo' },
  { es: 'Mtra. en Políticas Públicas', en: 'MA in Public Policy', pt: 'Mestra em Políticas Públicas' },
  { es: 'Ingeniero de Producto', en: 'Product Engineer', pt: 'Engenheiro de Produto' },
  { es: 'Gestora de Proyectos Sociales', en: 'Social Projects Manager', pt: 'Gestora de Projetos Sociais' },
]

/** Free-text job titles, as a real member would type them. */
const jobPositionNames = [
  'Profesora Titular, Departamento de Diseño',
  'Coordinador de Laboratorio de Innovación',
  'Investigadora Asociada',
  'Consultor Independiente',
  'Jefa de Vinculación Comunitaria',
  'Candidato a Doctor en Ingeniería',
  'Director del Centro de Emprendimiento',
  'Analista de Políticas Públicas',
  'Ingeniero de Producto Senior',
  'Gerente de Proyectos Sociales',
]

const biographyTemplates = [
  'Trabaja en el diseño de soluciones de bajo costo con comunidades rurales, con énfasis en procesos participativos y transferencia de tecnología.',
  'Coordina proyectos de innovación frugal aplicada a salud comunitaria y ha acompañado más de veinte iniciativas locales en la región.',
  'Su investigación conecta economía circular y manufactura local, buscando cadenas de valor cortas y reparables.',
  'Acompaña a emprendimientos sociales en etapas tempranas, con foco en modelos de negocio viables en contextos de recursos limitados.',
  'Enlaza universidad y territorio a través de programas de aprendizaje-servicio y vinculación con organizaciones de base.',
  'Estudia cómo las restricciones materiales moldean la creatividad técnica en contextos latinoamericanos.',
  'Dirige iniciativas de formación en innovación frugal para docentes y estudiantes de ingeniería.',
  'Analiza marcos regulatorios que habilitan o frenan la adopción de tecnologías apropiadas.',
  'Desarrolla prototipos de dispositivos asequibles para agua y energía en zonas periurbanas.',
  'Gestiona portafolios de proyectos sociales con métricas de impacto adaptadas a escalas pequeñas.',
]

const anchoredInstitutions = institutions.filter((i) => i.coords !== undefined)

const socialHosts = ['https://linkedin.com/in/', 'https://scholar.example.org/', '']

const TOTAL_MEMBERS = 54

/**
 * Resolves an institution's city to a region the validator accepts. Falls back
 * to the city itself only if it is unmapped, which the seed-drift and
 * validation tests will surface rather than hide.
 */
function regionForCity(city: string): string {
  return cityToRegion[city] ?? city
}

function buildMember(index: number): Member {
  /*
   * Both name pools hold 27 entries and TOTAL_MEMBERS is 54, so a plain
   * `index % length` on every part repeated the whole name on the second lap:
   * members 0-26 and 27-53 were the same 27 people twice over. Adding the lap
   * number to the surname indices offsets the second pass, so 54 members get 54
   * distinct names. Invisible in a paginated grid; glaring in a carousel.
   */
  const lap = Math.floor(index / firstNames.length)
  const first = firstNames[index % firstNames.length]
  const lastIndex = (index * 7 + 3 + lap) % lastNames.length
  let secondLastIndex = (index * 11 + 9 + lap * 2) % lastNames.length
  // Otherwise the two surnames collide and you get "Antonia Paredes Paredes".
  if (secondLastIndex === lastIndex) {
    secondLastIndex = (secondLastIndex + 1) % lastNames.length
  }
  const last = lastNames[lastIndex]
  const secondLast = lastNames[secondLastIndex]
  const isIndependent = index % 9 === 4
  const institution = isIndependent
    ? null
    : anchoredInstitutions[(index * 5) % anchoredInstitutions.length]

  const interestCount = 2 + (index % 3)
  const interestIds = Array.from(
    { length: interestCount },
    (_, i) => researchInterests[(index * 3 + i * 5) % researchInterests.length].id,
  )

  const areaCount = 1 + (index % 2)
  const generalAreaIds = Array.from(
    { length: areaCount },
    (_, i) => generalAreas[(index * 4 + i * 3) % generalAreas.length].id,
  )

  // Everyone reads at least one regional language; some also work in English.
  const languages = index % 3 === 0 ? ['es', 'en'] : index % 3 === 1 ? ['es'] : ['pt', 'es']

  const positions: PositionType[] = ['faculty', 'researcher', 'staff', 'administrator']
  const position: PositionType = isIndependent ? 'independent' : positions[index % positions.length]

  const socialHost = socialHosts[index % socialHosts.length]
  const slug = `${first}-${last}`.toLowerCase()
  const lastNameFull = `${last} ${secondLast}`

  return {
    id: `mock-${index}`,
    firstName: first,
    lastName: lastNameFull,
    fullName: `${first} ${lastNameFull}`,
    title: titles[index % titles.length],
    position,
    jobPositionName: jobPositionNames[index % jobPositionNames.length],
    biography: biographyTemplates[index % biographyTemplates.length],
    affiliationId: institution?.id ?? null,
    country: institution?.country ?? 'México',
    region: institution ? regionForCity(institution.city) : 'Ciudad de México',
    interestIds: [...new Set(interestIds)],
    generalAreaIds: [...new Set(generalAreaIds)],
    languages: languages.filter((id) => languageOptions.some((l) => l.id === id)),
    socialUrl: socialHost ? `${socialHost}${slug}` : undefined,
    avatarHue: (index * 47) % 360,
  }
}

export const mockMembers: Member[] = Array.from({ length: TOTAL_MEMBERS }, (_, i) =>
  buildMember(i),
)

export function institutionName(affiliationId: string | null): string | null {
  if (!affiliationId) return null
  return institutions.find((i) => i.id === affiliationId)?.name ?? null
}

import { institutions } from './institutions'
import { researchInterests, type PositionType } from './onboardingOptions'
import type { Localized } from './conference'

export interface Member {
  id: string
  fullName: string
  title: Localized
  position: PositionType
  /** Institution id, or null for independent members */
  affiliationId: string | null
  country: string
  region: string
  interestIds: string[]
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

const anchoredInstitutions = institutions.filter((i) => i.coords !== undefined)

const socialHosts = ['https://linkedin.com/in/', 'https://scholar.example.org/', '']

const TOTAL_MEMBERS = 54

function buildMember(index: number): Member {
  const first = firstNames[index % firstNames.length]
  const last = lastNames[(index * 7 + 3) % lastNames.length]
  const secondLast = lastNames[(index * 11 + 9) % lastNames.length]
  const isIndependent = index % 9 === 4
  const institution = isIndependent
    ? null
    : anchoredInstitutions[(index * 5) % anchoredInstitutions.length]

  const interestCount = 2 + (index % 3)
  const interestIds = Array.from(
    { length: interestCount },
    (_, i) => researchInterests[(index * 3 + i * 5) % researchInterests.length].id,
  )

  const positions: PositionType[] = ['faculty', 'researcher', 'staff', 'administrator']
  const position: PositionType = isIndependent ? 'independent' : positions[index % positions.length]

  const socialHost = socialHosts[index % socialHosts.length]
  const slug = `${first}-${last}`.toLowerCase()

  return {
    id: `mock-${index}`,
    fullName: `${first} ${last} ${secondLast}`,
    title: titles[index % titles.length],
    position,
    affiliationId: institution?.id ?? null,
    country: institution?.country ?? 'México',
    region: institution?.city ?? 'Ciudad de México',
    interestIds: [...new Set(interestIds)],
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

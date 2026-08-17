export type PositionType = 'staff' | 'faculty' | 'researcher' | 'administrator' | 'independent'

export const positionTypes: PositionType[] = [
  'staff',
  'faculty',
  'researcher',
  'administrator',
  'independent',
]

export interface CountryOption {
  name: string
  regions: string[]
}

/** Strict cascading country → region data. No free-text location input. */
export const countries: CountryOption[] = [
  { name: 'Argentina', regions: ['Buenos Aires', 'Córdoba', 'Mendoza', 'Santa Fe', 'Tucumán'] },
  { name: 'Bolivia', regions: ['La Paz', 'Cochabamba', 'Santa Cruz', 'Tarija'] },
  { name: 'Brasil', regions: ['São Paulo', 'Minas Gerais', 'Rio de Janeiro', 'Bahia', 'Paraná', 'Pernambuco'] },
  { name: 'Chile', regions: ['Región Metropolitana', 'Valparaíso', 'Biobío', 'Antofagasta', 'Los Lagos'] },
  { name: 'Colombia', regions: ['Bogotá D.C.', 'Antioquia', 'Valle del Cauca', 'Atlántico', 'Santander', 'Nariño'] },
  { name: 'Costa Rica', regions: ['San José', 'Alajuela', 'Cartago', 'Heredia', 'Guanacaste'] },
  { name: 'Ecuador', regions: ['Pichincha', 'Guayas', 'Azuay', 'Manabí'] },
  { name: 'El Salvador', regions: ['San Salvador', 'Santa Ana', 'San Miguel', 'La Libertad'] },
  { name: 'España', regions: ['Madrid', 'Cataluña', 'Andalucía', 'País Vasco'] },
  { name: 'Estados Unidos', regions: ['California', 'Texas', 'Nueva York', 'Florida'] },
  // Non-LatAm entries exist because the network has partner institutions there
  // (Aalto, UTT, World Entrepreneurs). Members can be affiliated with them, so
  // the country/region whitelist has to cover them or intake would reject.
  { name: 'Finlandia', regions: ['Uusimaa', 'Pirkanmaa'] },
  { name: 'Francia', regions: ['Grand Est', 'Isla de Francia', 'Occitania'] },
  { name: 'Guatemala', regions: ['Guatemala', 'Quetzaltenango', 'Sacatepéquez'] },
  { name: 'México', regions: ['Ciudad de México', 'Jalisco', 'Puebla', 'Guanajuato', 'Coahuila', 'Sinaloa', 'Baja California'] },
  { name: 'Nicaragua', regions: ['Managua', 'León', 'Granada'] },
  { name: 'Panamá', regions: ['Panamá', 'Colón', 'Chiriquí'] },
  { name: 'Paraguay', regions: ['Asunción', 'Central', 'Alto Paraná'] },
  { name: 'Perú', regions: ['Lima', 'Arequipa', 'Cusco', 'La Libertad', 'Piura'] },
  { name: 'Suiza', regions: ['Ginebra', 'Zúrich', 'Vaud'] },
  { name: 'Uruguay', regions: ['Montevideo', 'Canelones', 'Maldonado'] },
  { name: 'Venezuela', regions: ['Distrito Capital', 'Zulia', 'Miranda', 'Carabobo'] },
]

/**
 * Maps each country to the region that a city belongs to, so seed data derived
 * from an institution's city still lands on a region the validator accepts.
 * Only cities present in src/data/institutions.ts need an entry.
 */
export const cityToRegion: Record<string, string> = {
  Guadalajara: 'Jalisco',
  'Ciudad de México': 'Ciudad de México',
  León: 'Guanajuato',
  Guanajuato: 'Guanajuato',
  Puebla: 'Puebla',
  Torreón: 'Coahuila',
  Culiacán: 'Sinaloa',
  Tijuana: 'Baja California',
  Bogotá: 'Bogotá D.C.',
  Pasto: 'Nariño',
  Cali: 'Valle del Cauca',
  Medellín: 'Antioquia',
  Córdoba: 'Córdoba',
  'Buenos Aires': 'Buenos Aires',
  'San Salvador': 'San Salvador',
  Managua: 'Managua',
  'Santa Clara': 'California',
  Lima: 'Lima',
  Arequipa: 'Arequipa',
  Santiago: 'Región Metropolitana',
  Valparaíso: 'Valparaíso',
  Concepción: 'Biobío',
  Troyes: 'Grand Est',
  Espoo: 'Uusimaa',
  Ginebra: 'Ginebra',
  'São Paulo': 'São Paulo',
  'Belo Horizonte': 'Minas Gerais',
  'Rio de Janeiro': 'Rio de Janeiro',
  Quito: 'Pichincha',
  Guayaquil: 'Guayas',
  'San José': 'San José',
  'Ciudad de Guatemala': 'Guatemala',
  Guatemala: 'Guatemala',
  Montevideo: 'Montevideo',
  Asunción: 'Asunción',
  'La Paz': 'La Paz',
  Cochabamba: 'Cochabamba',
  Caracas: 'Distrito Capital',
  Panamá: 'Panamá',
  Madrid: 'Madrid',
  Barcelona: 'Cataluña',
}

/**
 * Display names for places.
 *
 * The Spanish `name` on each country stays the canonical value — it is the key
 * the validator whitelists, the rules whitelist, and every stored member record
 * uses. Translating it in place would invalidate existing data and three layers
 * of validation at once. So these are a presentation layer only, looked up by
 * canonical name.
 *
 * Regions are mostly proper nouns that read identically across languages;
 * entries exist only where a genuine translation differs, and `placeLabel`
 * falls back to the canonical string otherwise.
 */
type LocalizedText = { es: string; en: string; pt: string }

export const countryLabels: Record<string, LocalizedText> = {
  Argentina: { es: 'Argentina', en: 'Argentina', pt: 'Argentina' },
  Bolivia: { es: 'Bolivia', en: 'Bolivia', pt: 'Bolívia' },
  Brasil: { es: 'Brasil', en: 'Brazil', pt: 'Brasil' },
  Chile: { es: 'Chile', en: 'Chile', pt: 'Chile' },
  Colombia: { es: 'Colombia', en: 'Colombia', pt: 'Colômbia' },
  'Costa Rica': { es: 'Costa Rica', en: 'Costa Rica', pt: 'Costa Rica' },
  Ecuador: { es: 'Ecuador', en: 'Ecuador', pt: 'Equador' },
  'El Salvador': { es: 'El Salvador', en: 'El Salvador', pt: 'El Salvador' },
  España: { es: 'España', en: 'Spain', pt: 'Espanha' },
  'Estados Unidos': { es: 'Estados Unidos', en: 'United States', pt: 'Estados Unidos' },
  Finlandia: { es: 'Finlandia', en: 'Finland', pt: 'Finlândia' },
  Francia: { es: 'Francia', en: 'France', pt: 'França' },
  Guatemala: { es: 'Guatemala', en: 'Guatemala', pt: 'Guatemala' },
  México: { es: 'México', en: 'Mexico', pt: 'México' },
  Nicaragua: { es: 'Nicaragua', en: 'Nicaragua', pt: 'Nicarágua' },
  Panamá: { es: 'Panamá', en: 'Panama', pt: 'Panamá' },
  Paraguay: { es: 'Paraguay', en: 'Paraguay', pt: 'Paraguai' },
  Perú: { es: 'Perú', en: 'Peru', pt: 'Peru' },
  Suiza: { es: 'Suiza', en: 'Switzerland', pt: 'Suíça' },
  Uruguay: { es: 'Uruguay', en: 'Uruguay', pt: 'Uruguai' },
  Venezuela: { es: 'Venezuela', en: 'Venezuela', pt: 'Venezuela' },
}

export const regionLabels: Record<string, LocalizedText> = {
  'Ciudad de México': { es: 'Ciudad de México', en: 'Mexico City', pt: 'Cidade do México' },
  'Región Metropolitana': {
    es: 'Región Metropolitana',
    en: 'Metropolitan Region',
    pt: 'Região Metropolitana',
  },
  'Nueva York': { es: 'Nueva York', en: 'New York', pt: 'Nova York' },
  'Distrito Capital': { es: 'Distrito Capital', en: 'Capital District', pt: 'Distrito Capital' },
  Cataluña: { es: 'Cataluña', en: 'Catalonia', pt: 'Catalunha' },
  Andalucía: { es: 'Andalucía', en: 'Andalusia', pt: 'Andaluzia' },
  'País Vasco': { es: 'País Vasco', en: 'Basque Country', pt: 'País Basco' },
  'Isla de Francia': { es: 'Isla de Francia', en: 'Île-de-France', pt: 'Ilha de França' },
  Occitania: { es: 'Occitania', en: 'Occitania', pt: 'Occitânia' },
  Ginebra: { es: 'Ginebra', en: 'Geneva', pt: 'Genebra' },
  Zúrich: { es: 'Zúrich', en: 'Zurich', pt: 'Zurique' },
}

export type PlaceLang = 'es' | 'en' | 'pt'

/**
 * Localized display name for a stored country or region, falling back to the
 * canonical value when no translation exists (proper nouns like "Jalisco",
 * "São Paulo" or "Grand Est" are identical in all three languages).
 */
export function placeLabel(canonical: string, lang: PlaceLang): string {
  return (countryLabels[canonical] ?? regionLabels[canonical])?.[lang] ?? canonical
}

export interface ResearchInterest {
  id: string
  es: string
  en: string
  pt: string
}

export const researchInterests: ResearchInterest[] = [
  { id: 'metodologias', es: 'Metodologías frugales', en: 'Frugal methodologies', pt: 'Metodologias frugais' },
  { id: 'educacion', es: 'Educación y formación', en: 'Education & training', pt: 'Educação e formação' },
  { id: 'economia-circular', es: 'Economía circular', en: 'Circular economy', pt: 'Economia circular' },
  { id: 'emprendimiento', es: 'Emprendimiento social', en: 'Social entrepreneurship', pt: 'Empreendedorismo social' },
  { id: 'tecnologias', es: 'Tecnologías digitales', en: 'Digital technologies', pt: 'Tecnologias digitais' },
  { id: 'salud', es: 'Salud frugal', en: 'Frugal healthcare', pt: 'Saúde frugal' },
  { id: 'energia', es: 'Energía asequible', en: 'Affordable energy', pt: 'Energia acessível' },
  { id: 'agua', es: 'Agua y saneamiento', en: 'Water & sanitation', pt: 'Água e saneamento' },
  { id: 'agro', es: 'Agricultura sostenible', en: 'Sustainable agriculture', pt: 'Agricultura sustentável' },
  { id: 'politicas', es: 'Políticas públicas', en: 'Public policy', pt: 'Políticas públicas' },
  { id: 'diseno', es: 'Diseño centrado en comunidades', en: 'Community-centered design', pt: 'Design centrado em comunidades' },
  { id: 'manufactura', es: 'Manufactura local', en: 'Local manufacturing', pt: 'Manufatura local' },
]

/**
 * Broad disciplinary areas — Allan's "general area of interest", asked
 * separately from the narrower technical research interests above.
 */
export const generalAreas: ResearchInterest[] = [
  { id: 'ingenieria', es: 'Ingeniería', en: 'Engineering', pt: 'Engenharia' },
  { id: 'negocios', es: 'Negocios y administración', en: 'Business & management', pt: 'Negócios e administração' },
  { id: 'ciencias-sociales', es: 'Ciencias sociales', en: 'Social sciences', pt: 'Ciências sociais' },
  { id: 'salud-publica', es: 'Salud pública', en: 'Public health', pt: 'Saúde pública' },
  { id: 'diseno-arte', es: 'Diseño y artes', en: 'Design & arts', pt: 'Design e artes' },
  { id: 'ciencias-naturales', es: 'Ciencias naturales', en: 'Natural sciences', pt: 'Ciências naturais' },
  { id: 'educacion-area', es: 'Educación', en: 'Education', pt: 'Educação' },
  { id: 'computacion', es: 'Computación y datos', en: 'Computing & data', pt: 'Computação e dados' },
  { id: 'derecho', es: 'Derecho y políticas', en: 'Law & policy', pt: 'Direito e políticas' },
  { id: 'agronomia', es: 'Agronomía', en: 'Agronomy', pt: 'Agronomia' },
]

export interface LanguageOption {
  /** ISO 639-1 code — stored on the member record. */
  id: string
  es: string
  en: string
  pt: string
}

/** Languages a member can work in. Allan flagged this as a missing field. */
export const languageOptions: LanguageOption[] = [
  { id: 'es', es: 'Español', en: 'Spanish', pt: 'Espanhol' },
  { id: 'pt', es: 'Portugués', en: 'Portuguese', pt: 'Português' },
  { id: 'en', es: 'Inglés', en: 'English', pt: 'Inglês' },
  { id: 'fr', es: 'Francés', en: 'French', pt: 'Francês' },
  { id: 'it', es: 'Italiano', en: 'Italian', pt: 'Italiano' },
  { id: 'de', es: 'Alemán', en: 'German', pt: 'Alemão' },
]

/** Upper bounds shared by the form, the validator, and the Firestore rules. */
export const fieldLimits = {
  /*
   * One name field, not two. Spanish compound surnames make the boundary
   * genuinely ambiguous — nothing can tell whether "María Fernanda Gómez Ruiz"
   * surnames at "Gómez" or at "Fernanda" — so the network asks for the whole
   * name and stores exactly what the member typed. 141 is the old
   * firstName + space + lastName ceiling, kept so no existing record is
   * suddenly over the limit.
   */
  fullName: 141,
  /** RFC 5321's maximum for a whole address. */
  email: 254,
  jobPositionName: 120,
  biography: 800,
  socialUrl: 300,
  maxTechnicalInterests: 6,
  maxGeneralAreas: 3,
  maxLanguages: 6,
} as const

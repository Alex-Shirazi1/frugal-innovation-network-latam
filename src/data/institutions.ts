export type InstitutionCategory =
  | 'universidad'
  | 'consultora'
  | 'organizacion'
  | 'empresa'
  | 'centro'

export interface Institution {
  id: string
  name: string
  category: InstitutionCategory
  city: string
  country: string
  url: string
  /** [latitude, longitude] — omitted for nodes outside Latin America */
  coords?: [number, number]
}

export const institutions: Institution[] = [
  { id: 'iteso', name: 'ITESO, Universidad Jesuita de Guadalajara', category: 'universidad', city: 'Guadalajara', country: 'México', url: 'https://www.iteso.mx/', coords: [20.61, -103.42] },
  { id: 'javeriana', name: 'Pontificia Universidad Javeriana', category: 'universidad', city: 'Bogotá', country: 'Colombia', url: 'https://www.javeriana.edu.co/', coords: [4.63, -74.06] },
  { id: 'javeriana-cali', name: 'Pontificia Universidad Javeriana Cali', category: 'universidad', city: 'Cali', country: 'Colombia', url: 'https://www.javerianacali.edu.co/', coords: [3.35, -76.53] },
  { id: 'ucc', name: 'Universidad Católica de Córdoba', category: 'universidad', city: 'Córdoba', country: 'Argentina', url: 'https://www.uccor.edu.ar/', coords: [-31.42, -64.19] },
  { id: 'uca-sv', name: 'Universidad Centroamericana “José Simeón Cañas”', category: 'universidad', city: 'San Salvador', country: 'El Salvador', url: 'http://www.uca.edu.sv/', coords: [13.68, -89.24] },
  { id: 'uca-ni', name: 'Universidad Centroamericana', category: 'universidad', city: 'Managua', country: 'Nicaragua', url: 'https://www.uca.edu.ni/', coords: [12.13, -86.27] },
  { id: 'scu', name: 'Santa Clara University · Miller Center', category: 'universidad', city: 'Santa Clara', country: 'Estados Unidos', url: 'https://www.scu.edu/', coords: [37.35, -121.94] },
  { id: 'up-pe', name: 'Universidad del Pacífico', category: 'universidad', city: 'Lima', country: 'Perú', url: 'http://www.up.edu.pe/', coords: [-12.07, -77.08] },
  { id: 'esan', name: 'Universidad ESAN', category: 'universidad', city: 'Lima', country: 'Perú', url: 'https://www.ue.edu.pe/', coords: [-12.09, -76.97] },
  { id: 'ibero-cdmx', name: 'Universidad Iberoamericana Ciudad de México', category: 'universidad', city: 'Ciudad de México', country: 'México', url: 'https://ibero.mx/', coords: [19.37, -99.26] },
  { id: 'ibero-leon', name: 'Universidad Iberoamericana León', category: 'universidad', city: 'León', country: 'México', url: 'https://www.leon.uia.mx/', coords: [21.15, -101.68] },
  { id: 'ibero-puebla', name: 'Universidad Iberoamericana Puebla', category: 'universidad', city: 'Puebla', country: 'México', url: 'https://www.iberopuebla.mx/', coords: [19.03, -98.24] },
  { id: 'ibero-torreon', name: 'Universidad Iberoamericana Torreón', category: 'universidad', city: 'Torreón', country: 'México', url: 'http://www.lag.uia.mx/', coords: [25.55, -103.36] },
  { id: 'ibero-tijuana', name: 'Universidad Iberoamericana Tijuana', category: 'universidad', city: 'Tijuana', country: 'México', url: 'https://tijuana.ibero.mx/', coords: [32.47, -116.99] },
  { id: 'uas', name: 'Universidad Autónoma de Sinaloa', category: 'universidad', city: 'Culiacán', country: 'México', url: 'https://www.uas.edu.mx/', coords: [24.8, -107.39] },
  { id: 'uic', name: 'Universidad Intercontinental', category: 'universidad', city: 'Ciudad de México', country: 'México', url: 'https://www.uic.mx/', coords: [19.34, -99.14] },
  { id: 'ubiobio', name: 'Universidad del Bío-Bío', category: 'universidad', city: 'Concepción', country: 'Chile', url: 'https://www.ubiobio.cl/w/', coords: [-36.82, -73.03] },
  { id: 'usach', name: 'Universidad de Santiago de Chile', category: 'universidad', city: 'Santiago', country: 'Chile', url: 'https://www.usach.cl/', coords: [-33.45, -70.68] },
  { id: 'duoc', name: 'Instituto Profesional Duoc UC', category: 'universidad', city: 'Santiago', country: 'Chile', url: 'https://www.duoc.cl/', coords: [-33.44, -70.62] },
  { id: 'ufmg', name: 'Universidade Federal de Minas Gerais', category: 'universidad', city: 'Belo Horizonte', country: 'Brasil', url: 'https://ufmg.br/', coords: [-19.87, -43.96] },
  { id: 'uarm', name: 'Universidad Antonio Ruiz de Montoya', category: 'universidad', city: 'Lima', country: 'Perú', url: 'https://www.uarm.edu.pe/', coords: [-12.07, -77.04] },
  { id: 'uao', name: 'Universidad Autónoma de Occidente', category: 'universidad', city: 'Cali', country: 'Colombia', url: 'https://www.uao.edu.co', coords: [3.35, -76.52] },
  { id: 'unad', name: 'Universidad Nacional Abierta y a Distancia (UNAD)', category: 'universidad', city: 'Bogotá', country: 'Colombia', url: 'https://www.unad.edu.co/', coords: [4.58, -74.11] },
  { id: 'usb-cali', name: 'Universidad de San Buenaventura', category: 'universidad', city: 'Cali', country: 'Colombia', url: 'https://usbcali.edu.co/', coords: [3.37, -76.55] },
  { id: 'comillas', name: 'Universidad Pontificia de Comillas', category: 'universidad', city: 'Madrid', country: 'España', url: 'https://www.comillas.edu/' },
  { id: 'utt', name: 'University of Technology of Troyes', category: 'universidad', city: 'Troyes', country: 'Francia', url: 'https://www.utt.fr/study-at-utt' },
  { id: 'aalto', name: 'Aalto University', category: 'universidad', city: 'Espoo', country: 'Finlandia', url: 'https://www.aalto.fi/en' },

  { id: 'up-innovation', name: 'Up Innovation Consulting', category: 'consultora', city: 'Ciudad de México', country: 'México', url: 'https://www.upinnovation.mx/', coords: [19.43, -99.13] },
  { id: 'frugal-lab', name: 'Frugal Lab', category: 'consultora', city: 'Lima', country: 'Perú', url: 'https://www.linkedin.com/in/christianjbw/', coords: [-12.05, -77.03] },
  { id: 'innodeva', name: 'Innodeva', category: 'consultora', city: 'São Paulo', country: 'Brasil', url: 'https://innofrugal.org/', coords: [-23.55, -46.63] },

  { id: 'acpo', name: 'Fundación Acción Cultural Popular (ACPO)', category: 'organizacion', city: 'Bogotá', country: 'Colombia', url: 'https://fundacionacpo.org/', coords: [4.61, -74.08] },
  { id: 'camara-verde', name: 'Cámara Verde de Comercio', category: 'organizacion', city: 'Bogotá', country: 'Colombia', url: 'https://camaraverde.org/', coords: [4.65, -74.05] },
  { id: 'rebrif', name: 'REBRIF · Rede Brasileira de Inovação Frugal', category: 'organizacion', city: 'Belo Horizonte', country: 'Brasil', url: 'https://redinnovacionfrugal.lat/rebrif.php', coords: [-19.92, -43.93] },
  { id: 'world-entrepreneurs', name: 'World Entrepreneurs', category: 'organizacion', city: 'Ginebra', country: 'Suiza', url: 'https://worldentrepreneurs.org/' },

  { id: 'ecoins', name: 'Ecoins', category: 'empresa', city: 'San José', country: 'Costa Rica', url: 'https://ecoins.eco/', coords: [9.93, -84.08] },
  { id: 'captanda', name: 'Captanda', category: 'empresa', city: 'Santiago', country: 'Chile', url: 'https://captanda.com/', coords: [-33.46, -70.65] },

  { id: 'ctic-uni', name: 'CTIC-UNI', category: 'centro', city: 'Lima', country: 'Perú', url: 'https://www.ctic.uni.edu.pe/', coords: [-12.02, -77.05] },
]

export const mappedInstitutions = institutions.filter(
  (i): i is Institution & { coords: [number, number] } => i.coords !== undefined,
)

export const offMapInstitutions = institutions.filter((i) => i.coords === undefined)

export const memberCountries = [...new Set(institutions.map((i) => i.country))]

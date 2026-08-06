export interface Localized {
  es: string
  en: string
  pt: string
}

export interface Speaker {
  name: string
  role: Localized
  origin: string
  hue: number
}

export interface ConferenceVideo {
  youtubeId: string
  title: Localized
}

/**
 * The congress, as the network actually documents it.
 *
 * What this file used to hold was invented. There was a two-day agenda of
 * eleven timed sessions ("Jueves 18", "Viernes 19"), six captioned gallery
 * tiles, and a banner announcing a next gathering in Chile in 2027. The
 * network's own conference microsite contradicts all of it:
 * redinnovacionfrugal.lat/congreso publishes the event as 27–29 May 2026 in
 * Bogotá — three days, not two, and different dates — its programa.php still
 * reads "la página de programa estará disponible próximamente", so there was
 * never a programme to summarise, and nothing anywhere mentions Chile or 2027.
 * The Chile line was circular: its only source was the closing-plenary entry
 * of the invented agenda.
 *
 * So this now carries only what the microsite states. Real photography and a
 * real programme can be added when the network supplies them; they are absent,
 * not pending a design decision.
 */

/**
 * Deliberately empty until the network confirms a real speaker list.
 *
 * This previously held six entries. The names were real people lifted from the
 * production site's comunidad.php and assigned conference roles that do not
 * exist — two are students, one of them billed as the keynote, and the country
 * was wrong for at least two. Publishing invented job titles for identifiable
 * people is not a placeholder we can carry, so the data is gone rather than
 * "corrected": there is no source to correct it against.
 *
 * Filling this array back in restores the speaker grid (see ConferenceArchive).
 */
export const speakers: Speaker[] = []

/**
 * Recordings of the RELIF 2021 annual meeting — NOT the Bogotá congress.
 *
 * These three sat under a "Videos" tab inside the congress archive, retitled to
 * generic topic labels, which read as congress sessions. YouTube's own metadata
 * says otherwise: all three are published by the network as "Encuentro Anual
 * RELIF 2021", the virtual annual meeting of 18–19 November 2021. Their shared
 * thumbnail carries those dates, and 18–19 November 2021 fell on a Thursday and
 * a Friday — which is where the invented agenda's "Jueves 18 / Viernes 19" came
 * from. The titles below are the real ones, and they render under their own
 * heading rather than inside the congress card.
 */
export const annualMeetingVideos: ConferenceVideo[] = [
  {
    youtubeId: 'zcUO-IOQDz4',
    title: {
      es: 'RELIF 2021 A: Innovación frugal y economía circular',
      en: 'RELIF 2021 A: Frugal innovation and circular economy',
      pt: 'RELIF 2021 A: Inovação frugal e economia circular',
    },
  },
  {
    youtubeId: 'dxcd-KY-AIc',
    title: {
      es: 'RELIF 2021 B: Emprendimiento social y femenino, economía social',
      en: 'RELIF 2021 B: Social and women’s entrepreneurship, social economy',
      pt: 'RELIF 2021 B: Empreendedorismo social e feminino, economia social',
    },
  },
  {
    youtubeId: '6o8G2N2rP3A',
    title: {
      es: 'Venkata: Innovación frugal en América Latina (nov. 2021)',
      en: 'Venkata: Frugal innovation in Latin America (Nov 2021)',
      pt: 'Venkata: Inovação frugal na América Latina (nov. 2021)',
    },
  },
]

import { useState } from 'react'
import { useI18n } from '../../i18n/I18nContext'
import { useApiData } from '../../api/ApiDataContext'
import { SectionHeading } from '../ui/SectionHeading'

/** The network's own microsite for the congress — the source for everything here. */
const CONFERENCE_URL = 'https://redinnovacionfrugal.lat/congreso/index.php'

function SpeakerGrid() {
  const { lang } = useI18n()
  const { conference: { speakers } } = useApiData()
  return (
    <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
      {speakers.map((speaker) => (
        <li key={speaker.name} className="rounded-2xl bg-white/70 border border-carbon/10 p-4 text-center">
          <span
            aria-hidden="true"
            className="mx-auto flex h-16 w-16 items-center justify-center rounded-full font-display text-xl font-semibold text-blanco"
            style={{ background: ['#168599', '#8ebc41', '#f6a620', '#e94824', '#4d6a79'][speaker.hue % 5] }}
          >
            {speaker.name
              .split(' ')
              .slice(0, 2)
              .map((part) => part[0])
              .join('')}
          </span>
          <h4 className="mt-3 font-semibold leading-snug text-sm md:text-base">{speaker.name}</h4>
          <p className="mt-1 text-xs md:text-sm text-pizarra">{speaker.role[lang]}</p>
        </li>
      ))}
    </ul>
  )
}

function VideoWall() {
  const { lang, t } = useI18n()
  const { conference: { annualMeetingVideos } } = useApiData()
  const [activeId, setActiveId] = useState<string | null>(null)
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {annualMeetingVideos.map((video) => (
        <li key={video.youtubeId} className="overflow-hidden rounded-2xl border border-carbon/10 bg-white/70">
          <div className="relative aspect-video bg-carbon">
            {activeId === video.youtubeId ? (
              <iframe
                className="absolute inset-0 h-full w-full"
                src={`https://www.youtube-nocookie.com/embed/${video.youtubeId}?autoplay=1`}
                title={video.title[lang]}
                allow="accelerometer; autoplay; encrypted-media; picture-in-picture"
                allowFullScreen
              />
            ) : (
              <button
                type="button"
                onClick={() => setActiveId(video.youtubeId)}
                className="group absolute inset-0 flex w-full items-center justify-center"
                aria-label={`${t.conference.watchVideo}: ${video.title[lang]}`}
              >
                <img
                  src={`https://i.ytimg.com/vi/${video.youtubeId}/hqdefault.jpg`}
                  alt=""
                  loading="lazy"
                  width="480"
                  height="360"
                  className="absolute inset-0 h-full w-full object-cover opacity-70 transition-opacity group-hover:opacity-90"
                />
                <span className="relative flex h-14 w-14 items-center justify-center rounded-full bg-teal text-blanco shadow-lg transition-transform group-hover:scale-110">
                  <svg width="18" height="20" viewBox="0 0 18 20" aria-hidden="true">
                    <path d="M2 1.5v17l14-8.5z" fill="currentColor" />
                  </svg>
                </span>
              </button>
            )}
          </div>
          <h4 className="px-4 py-3 text-sm font-semibold leading-snug">{video.title[lang]}</h4>
        </li>
      ))}
    </ul>
  )
}

/**
 * The congress, limited to what the network publishes about it.
 *
 * This was a tabbed archive — Agenda, Gallery, Videos — and two of the three
 * tabs held invented content: an eleven-session timetable for a programme the
 * network never published, and six gradient tiles captioned as event
 * photographs (with `role="img"` and an alt text asserting they were
 * photographs, so assistive tech was told something false). A teal banner below
 * announced a next gathering in "Chile 2027", sourced from nothing but the
 * closing-plenary line of the invented agenda, and its "keep me posted" button
 * scrolled to the membership form.
 *
 * With those gone there is one panel left, so the tab strip goes too: a single
 * tab is just a heading that looks clickable. The facts in the header are from
 * the microsite, which is linked so a reader can check them.
 */
export function ConferenceArchive() {
  const { t } = useI18n()
  const { conference: { speakers } } = useApiData()

  return (
    <section id="congreso" aria-labelledby="congreso-heading" className="py-(--spacing-section)">
      <div className="mx-auto max-w-7xl px-4 md:px-8">
        <article className="overflow-hidden rounded-3xl border border-carbon/10 bg-niebla/70 shadow-xl shadow-carbon/5">
          <div className="border-b border-carbon/10 bg-white/50 px-5 py-8 md:px-10 md:py-10">
            <SectionHeading
              id="congreso-heading"
              kicker={t.conference.kicker}
              title={t.conference.title}
              subtitle={t.conference.subtitle}
            />

            <p className="text-sm font-semibold text-teal">{t.conference.details}</p>

            <a
              href={CONFERENCE_URL}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-block rounded-full border-2 border-carbon/15 px-5 py-2.5 text-sm font-bold text-carbon transition-colors hover:border-teal hover:text-teal"
            >
              {t.conference.siteCta} ↗
            </a>
          </div>

          <div className="px-5 py-8 md:px-10 md:py-10">
            {speakers.length > 0 ? (
              <>
                <h3 className="mb-4 font-display text-lg font-semibold text-carbon">
                  {t.conference.speakersTab}
                </h3>
                <SpeakerGrid />
              </>
            ) : null}

            <div className={speakers.length > 0 ? 'mt-10' : ''}>
              <h3 className="font-display text-lg font-semibold text-carbon">
                {t.conference.videosTitle}
              </h3>
              <p className="mt-1 mb-4 text-sm text-pizarra">{t.conference.videosNote}</p>
              <VideoWall />
            </div>
          </div>
        </article>
      </div>
    </section>
  )
}

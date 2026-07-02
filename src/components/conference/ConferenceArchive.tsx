import { useState } from 'react'
import { useI18n } from '../../i18n/I18nContext'
import { SectionHeading } from '../ui/SectionHeading'
import {
  agendaDay1,
  agendaDay2,
  speakers,
  conferenceVideos,
  galleryTiles,
  type AgendaItem,
} from '../../data/conference'

type Tab = 'agenda' | 'speakers' | 'gallery' | 'videos'

function AgendaColumn({ label, items }: { label: string; items: AgendaItem[] }) {
  const { lang } = useI18n()
  return (
    <div>
      <h4 className="font-display text-lg font-semibold text-terracota">{label}</h4>
      <ol className="mt-4 space-y-0">
        {items.map((item) => (
          <li
            key={item.time + item.title.es}
            className="relative border-l-2 border-tinta/10 pb-6 pl-5 last:pb-0"
          >
            <span
              className="absolute -left-[5px] top-1.5 h-2 w-2 rounded-full bg-terracota"
              aria-hidden="true"
            />
            <p className="text-xs font-semibold uppercase tracking-wider text-tinta-suave">
              {item.time}
            </p>
            <h5 className="mt-0.5 font-semibold">{item.title[lang]}</h5>
            <p className="mt-1 text-sm leading-relaxed text-tinta-suave">{item.detail[lang]}</p>
          </li>
        ))}
      </ol>
    </div>
  )
}

function SpeakerGrid() {
  const { lang } = useI18n()
  return (
    <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
      {speakers.map((speaker) => (
        <li key={speaker.name} className="rounded-2xl bg-white/70 border border-tinta/10 p-4 text-center">
          <span
            aria-hidden="true"
            className="mx-auto flex h-16 w-16 items-center justify-center rounded-full font-display text-xl font-semibold text-crema"
            style={{ background: `oklch(55% 0.11 ${speaker.hue})` }}
          >
            {speaker.name
              .split(' ')
              .slice(0, 2)
              .map((part) => part[0])
              .join('')}
          </span>
          <h4 className="mt-3 font-semibold leading-snug text-sm md:text-base">{speaker.name}</h4>
          <p className="mt-1 text-xs md:text-sm text-tinta-suave">{speaker.role[lang]}</p>
        </li>
      ))}
    </ul>
  )
}

function Gallery() {
  const { lang, t } = useI18n()
  const spanClass = { wide: 'sm:col-span-2', tall: 'sm:row-span-2', square: '' } as const
  return (
    <ul className="grid grid-cols-2 sm:grid-cols-3 gap-3 auto-rows-[minmax(7rem,1fr)]">
      {galleryTiles.map((tile) => (
        <li
          key={tile.id}
          className={`group relative overflow-hidden rounded-2xl ${spanClass[tile.span]}`}
        >
          {/* Placeholder tiles — real event photography drops in during content migration */}
          <div
            role="img"
            aria-label={`${t.conference.photoAlt}: ${tile.caption[lang]}`}
            className="h-full w-full transition-transform duration-500 group-hover:scale-105"
            style={{
              background: `linear-gradient(135deg, oklch(60% 0.1 ${tile.hueA}), oklch(42% 0.09 ${tile.hueB}))`,
            }}
          />
          <p className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-tinta/70 to-transparent px-3 pb-2 pt-6 text-xs font-medium text-crema">
            {tile.caption[lang]}
          </p>
        </li>
      ))}
    </ul>
  )
}

function VideoWall() {
  const { lang, t } = useI18n()
  const [activeId, setActiveId] = useState<string | null>(null)
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {conferenceVideos.map((video) => (
        <li key={video.youtubeId} className="overflow-hidden rounded-2xl border border-tinta/10 bg-white/70">
          <div className="relative aspect-video bg-tinta">
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
                <span className="relative flex h-14 w-14 items-center justify-center rounded-full bg-terracota text-crema shadow-lg transition-transform group-hover:scale-110">
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

export function ConferenceArchive() {
  const { t } = useI18n()
  const [tab, setTab] = useState<Tab>('agenda')

  const tabs: { id: Tab; label: string }[] = [
    { id: 'agenda', label: t.conference.agendaTab },
    { id: 'speakers', label: t.conference.speakersTab },
    { id: 'gallery', label: t.conference.galleryTab },
    { id: 'videos', label: t.conference.videosTab },
  ]

  return (
    <section id="congreso" aria-labelledby="congreso-heading" className="py-(--spacing-section)">
      <div className="mx-auto max-w-7xl px-4 md:px-8">
        <article className="overflow-hidden rounded-3xl border border-tinta/10 bg-arena/70 shadow-xl shadow-tinta/5">
          <div className="border-b border-tinta/10 bg-white/50 px-5 py-8 md:px-10 md:py-10">
            <SectionHeading
              id="congreso-heading"
              kicker={t.conference.kicker}
              title={t.conference.title}
              subtitle={t.conference.subtitle}
            />

            <div role="tablist" aria-label={t.conference.title} className="flex flex-wrap gap-2 -mb-2">
              {tabs.map((item) => (
                <button
                  key={item.id}
                  role="tab"
                  type="button"
                  aria-selected={tab === item.id}
                  onClick={() => setTab(item.id)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                    tab === item.id
                      ? 'bg-tinta text-crema'
                      : 'bg-transparent text-tinta-suave hover:bg-tinta/5'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="px-5 py-8 md:px-10 md:py-10">
            {tab === 'agenda' ? (
              <div className="grid gap-10 md:grid-cols-2">
                <AgendaColumn label={t.conference.day1} items={agendaDay1} />
                <AgendaColumn label={t.conference.day2} items={agendaDay2} />
              </div>
            ) : null}
            {tab === 'speakers' ? <SpeakerGrid /> : null}
            {tab === 'gallery' ? <Gallery /> : null}
            {tab === 'videos' ? <VideoWall /> : null}
          </div>

          {/* Future conference call-to-action */}
          <aside className="flex flex-col gap-4 bg-verde px-5 py-7 text-crema sm:flex-row sm:items-center sm:justify-between md:px-10">
            <div>
              <h3 className="font-display text-xl md:text-2xl font-semibold">{t.conference.nextTitle}</h3>
              <p className="mt-1 max-w-xl text-sm md:text-base text-crema/80">{t.conference.nextText}</p>
            </div>
            <a
              href="#unete"
              className="shrink-0 rounded-full bg-ambar px-5 py-2.5 text-center text-sm font-semibold text-tinta transition-transform hover:-translate-y-0.5"
            >
              {t.conference.nextCta}
            </a>
          </aside>
        </article>
      </div>
    </section>
  )
}

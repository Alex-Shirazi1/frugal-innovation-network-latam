import { useI18n } from '../../i18n/I18nContext'
import { useApiData } from '../../api/ApiDataContext'
import { SectionHeading } from '../ui/SectionHeading'
import { localizeText } from '../../data/initiatives'


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
  const { t, lang } = useI18n()
  const { conference: { speakers }, congress } = useApiData()

  return (
    <section id="congreso" aria-labelledby="congreso-heading" className="py-(--spacing-section)">
      <div className="mx-auto max-w-7xl px-4 md:px-8">
        <article className="overflow-hidden rounded-3xl border border-carbon/10 bg-niebla/70 shadow-xl shadow-carbon/5">
          <div className="border-b border-carbon/10 bg-white/50 px-5 py-8 md:px-10 md:py-10">
            <SectionHeading
              id="congreso-heading"
              kicker={localizeText(congress.kicker, lang)}
              title={localizeText(congress.title, lang)}
              subtitle={localizeText(congress.subtitle, lang)}
            />

            <p className="text-sm font-semibold text-teal">{localizeText(congress.details, lang)}</p>

            <a
              href={congress.siteUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-block rounded-full border-2 border-carbon/15 px-5 py-2.5 text-sm font-bold text-carbon transition-colors hover:border-teal hover:text-teal"
            >
              {localizeText(congress.siteCta, lang)} ↗
            </a>
          </div>

          {/*
            * Photos of the event, when the network has added any. The aspect
            * ratio is fixed rather than left to the file: these are arbitrary
            * URLs off other people's servers, so their real dimensions are not
            * known until they load, and a grid that resizes on arrival would
            * shove the page around underneath whoever is reading it.
            */}
          {congress.images && congress.images.length > 0 ? (
            <ul className="grid grid-cols-2 gap-3 border-b border-carbon/10 px-5 py-6 md:grid-cols-4 md:px-10">
              {congress.images.map((image, index) => (
                <li key={`${index}-${image.url}`}>
                  <img
                    src={image.url}
                    alt={localizeText(image.alt, lang)}
                    loading="lazy"
                    decoding="async"
                    className="aspect-4/3 w-full rounded-xl object-cover"
                  />
                </li>
              ))}
            </ul>
          ) : null}

          {speakers.length > 0 ? (
            <div className="px-5 py-8 md:px-10 md:py-10">
              <h3 className="mb-4 font-display text-lg font-semibold text-carbon">
                {t.conference.speakersTab}
              </h3>
              <SpeakerGrid />
            </div>
          ) : null}
        </article>
      </div>
    </section>
  )
}

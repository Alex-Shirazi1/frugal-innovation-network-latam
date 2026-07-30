import { useI18n } from '../../i18n/I18nContext'
import { SectionHeading } from '../ui/SectionHeading'

/**
 * The four universities whose professors founded the network in April 2018.
 * The names are proper nouns and stay as they are; only their locations are
 * localized, via `origin.founderPlaces` keyed by these ids.
 */
const FOUNDING_UNIVERSITIES = [
  { id: 'scu', name: 'Santa Clara University', accent: 'bg-teal' },
  { id: 'iteso', name: 'ITESO', accent: 'bg-verde' },
  { id: 'javeriana', name: 'Pontificia Universidad Javeriana', accent: 'bg-naranja' },
  { id: 'iberoPuebla', name: 'Universidad Iberoamericana Puebla', accent: 'bg-rojo' },
] as const

/**
 * The network's founding story, transcribed from the production site.
 *
 * This section used to carry a paraphrased history — wrong founding year, no
 * founders named — beside a mission/vision/values trio we had written
 * ourselves, which contradicted the network's real mission, vision and values
 * shown a few sections further down in About. The origin story is this
 * section's whole job, so the cards now carry the founders and the network's
 * own statement of purpose rather than a second, competing set of values.
 */
export function OriginSection() {
  const { t } = useI18n()

  return (
    <section id="origen" aria-labelledby="origen-heading" className="py-(--spacing-section)">
      <div className="mx-auto max-w-7xl px-4 md:px-8">
        <div className="grid gap-10 lg:grid-cols-[5fr_4fr] lg:gap-16">
          <div>
            <SectionHeading id="origen-heading" kicker={t.origin.kicker} title={t.origin.title} />
            <div className="space-y-5 text-base md:text-lg leading-relaxed text-pizarra max-w-2xl">
              <p className="first-letter:font-display first-letter:text-5xl first-letter:font-semibold first-letter:text-teal first-letter:float-left first-letter:mr-2 first-letter:leading-[0.85]">
                {t.origin.p1}
              </p>
              <p>{t.origin.p2}</p>
              <p>{t.origin.p3}</p>
            </div>

            <blockquote className="mt-8 max-w-2xl border-l-4 border-teal bg-teal-tint/40 py-4 pl-5 pr-4">
              <p className="font-display text-lg md:text-xl font-medium leading-snug text-carbon">
                {t.origin.pullQuote}
              </p>
            </blockquote>
          </div>

          <div className="flex flex-col gap-4 lg:pt-24">
            <article className="rounded-2xl border border-carbon/10 bg-white/60 p-5 md:p-6 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-pizarra">
                {t.origin.foundedLabel}
              </p>
              <p className="mt-1 font-display text-3xl font-semibold text-teal">
                {t.origin.foundedValue}
              </p>
            </article>

            <article className="rounded-2xl border border-carbon/10 bg-white/60 p-5 md:p-6 shadow-sm transition-transform hover:-translate-y-1">
              <h3 className="font-display text-xl font-semibold">{t.origin.foundersTitle}</h3>
              <ul className="mt-4 space-y-3">
                {FOUNDING_UNIVERSITIES.map((university) => (
                  <li key={university.name} className="relative pl-4">
                    <span
                      className={`absolute left-0 top-1.5 h-5 w-1 rounded-r ${university.accent}`}
                      aria-hidden="true"
                    />
                    <p className="font-semibold leading-snug text-carbon">{university.name}</p>
                    <p className="text-sm text-pizarra">
                      {t.origin.founderPlaces[university.id]}
                    </p>
                  </li>
                ))}
              </ul>
            </article>
          </div>
        </div>
      </div>
    </section>
  )
}

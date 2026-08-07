import { useI18n } from '../../i18n/I18nContext'
import { useApiData } from '../../api/ApiDataContext'
import { SectionHeading } from '../ui/SectionHeading'
import { localizeText } from '../../data/initiatives'

const initiativeIcons = ['◉', '◍', '◈', '◇', '◎', '◆'] as const

/**
 * Renders whatever the data source supplies — Firestore when the network has
 * populated it, the bundled seed otherwise.
 *
 * This used to read `t.initiatives.items` and join it positionally to a link
 * map, which meant a card could not exist without a code change and a
 * translation in all three dictionaries. Allan asked to add and remove these
 * himself, so the content moved to data and the join key became the record.
 */
export function InitiativesSection() {
  const { t, lang } = useI18n()
  const { initiatives } = useApiData()

  return (
    <section id="iniciativas" aria-labelledby="iniciativas-heading" className="py-(--spacing-section)">
      <div className="mx-auto max-w-7xl px-4 md:px-8">
        <SectionHeading
          id="iniciativas-heading"
          kicker={t.initiatives.kicker}
          title={t.initiatives.title}
        />

        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {initiatives.map((item, index) => {
            return (
              <li
                key={item.id}
                className={`group flex flex-col rounded-2xl border border-carbon/10 p-5 md:p-6 transition-all hover:-translate-y-1 hover:shadow-lg hover:shadow-carbon/5 ${
                  index % 4 === 0 ? 'bg-verde-suave/60' : index % 4 === 3 ? 'bg-niebla' : 'bg-white/60'
                }`}
              >
                <span
                  className="text-2xl text-teal transition-transform inline-block group-hover:scale-110"
                  aria-hidden="true"
                >
                  {initiativeIcons[index % initiativeIcons.length]}
                </span>
                <h3 className="mt-3 font-display text-lg md:text-xl font-semibold">
                  {localizeText(item.title, lang)}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-pizarra">
                  {localizeText(item.text, lang)}
                </p>

                {/* Only initiatives that actually have somewhere to go get a link —
                    naming a podcast with no way to listen is worse than omitting it. */}
                {item.url ? (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-auto self-start pt-4 text-xs font-bold text-teal hover:underline"
                  >
                    ↗ {item.cta ? localizeText(item.cta, lang) : item.url}
                  </a>
                ) : null}
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}

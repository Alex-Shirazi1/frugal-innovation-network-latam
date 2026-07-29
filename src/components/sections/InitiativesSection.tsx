import { useI18n } from '../../i18n/I18nContext'
import { SectionHeading } from '../ui/SectionHeading'
import { initiativeLinks } from '../../data/network'

const initiativeIcons = ['◉', '◍', '◈', '◇', '◎', '◆'] as const

/**
 * Maps each translated initiative to its destination, positionally — the
 * dictionaries store initiatives as parallel arrays, so order is the join key.
 * initiatives.test.ts asserts this stays aligned in all three languages.
 */
export const initiativeOrder = [
  'encuentros',
  'podcast',
  'casos',
  'mooc',
  'investigacion',
  'herramientas',
] as const

export function InitiativesSection() {
  const { t, lang } = useI18n()

  return (
    <section id="iniciativas" aria-labelledby="iniciativas-heading" className="py-(--spacing-section)">
      <div className="mx-auto max-w-7xl px-4 md:px-8">
        <SectionHeading
          id="iniciativas-heading"
          kicker={t.initiatives.kicker}
          title={t.initiatives.title}
        />

        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {t.initiatives.items.map((item, index) => {
            const link = initiativeLinks[initiativeOrder[index]]
            return (
              <li
                key={item.title}
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
                <h3 className="mt-3 font-display text-lg md:text-xl font-semibold">{item.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-pizarra">{item.text}</p>

                {/* Only initiatives that actually have somewhere to go get a link —
                    naming a podcast with no way to listen is worse than omitting it. */}
                {link ? (
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-auto self-start pt-4 text-xs font-bold text-teal hover:underline"
                  >
                    ↗ {link.cta[lang]}
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

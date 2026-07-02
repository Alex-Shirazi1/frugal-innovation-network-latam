import { useI18n } from '../../i18n/I18nContext'
import { SectionHeading } from '../ui/SectionHeading'

const initiativeIcons = ['◉', '◍', '◈', '◇', '◎', '◆'] as const

export function InitiativesSection() {
  const { t } = useI18n()

  return (
    <section id="iniciativas" aria-labelledby="iniciativas-heading" className="py-(--spacing-section)">
      <div className="mx-auto max-w-7xl px-4 md:px-8">
        <SectionHeading
          id="iniciativas-heading"
          kicker={t.initiatives.kicker}
          title={t.initiatives.title}
        />

        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {t.initiatives.items.map((item, index) => (
            <li
              key={item.title}
              className={`group rounded-2xl border border-carbon/10 p-5 md:p-6 transition-all hover:-translate-y-1 hover:shadow-lg hover:shadow-carbon/5 ${
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
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

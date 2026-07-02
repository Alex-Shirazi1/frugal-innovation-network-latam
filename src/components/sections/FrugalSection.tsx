import { useI18n } from '../../i18n/I18nContext'
import { SectionHeading } from '../ui/SectionHeading'

const pillarAccents = ['text-terracota', 'text-verde', 'text-ambar'] as const

export function FrugalSection() {
  const { t } = useI18n()

  return (
    <section
      id="innovacion-frugal"
      aria-labelledby="frugal-heading"
      className="bg-tinta py-(--spacing-section) text-crema"
    >
      <div className="mx-auto max-w-7xl px-4 md:px-8">
        <SectionHeading
          id="frugal-heading"
          kicker={t.frugal.kicker}
          title={t.frugal.title}
          tone="dark"
        />

        <div className="grid gap-10 lg:grid-cols-[4fr_5fr] lg:gap-16">
          <div className="space-y-5 text-base md:text-lg leading-relaxed text-crema/75">
            <p>{t.frugal.p1}</p>
            <p>{t.frugal.p2}</p>
          </div>

          <ol className="space-y-4">
            {t.frugal.pillars.map((pillar, index) => (
              <li
                key={pillar.title}
                className="group flex gap-5 rounded-2xl border border-crema/10 bg-crema/5 p-5 md:p-6 transition-colors hover:bg-crema/10"
              >
                <span
                  className={`font-display text-4xl md:text-5xl font-semibold leading-none ${pillarAccents[index % pillarAccents.length]}`}
                  aria-hidden="true"
                >
                  {String(index + 1).padStart(2, '0')}
                </span>
                <div>
                  <h3 className="font-display text-xl md:text-2xl font-semibold">{pillar.title}</h3>
                  <p className="mt-1.5 text-sm md:text-base leading-relaxed text-crema/70">
                    {pillar.text}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  )
}

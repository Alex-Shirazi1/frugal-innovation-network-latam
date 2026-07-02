import { useI18n } from '../../i18n/I18nContext'
import { SectionHeading } from '../ui/SectionHeading'

export function OriginSection() {
  const { t } = useI18n()

  const cards = [
    { title: t.origin.mission, text: t.origin.missionText, accent: 'bg-teal' },
    { title: t.origin.vision, text: t.origin.visionText, accent: 'bg-verde' },
    { title: t.origin.values, text: t.origin.valuesText, accent: 'bg-naranja' },
  ]

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
            </div>
          </div>

          <div className="flex flex-col gap-4 lg:pt-24">
            {cards.map((card, index) => (
              <article
                key={card.title}
                className={`relative rounded-2xl border border-carbon/10 bg-white/60 p-5 md:p-6 shadow-sm transition-transform hover:-translate-y-1 ${
                  index === 1 ? 'lg:translate-x-8' : ''
                }`}
              >
                <span className={`absolute left-0 top-5 h-8 w-1 rounded-r ${card.accent}`} aria-hidden="true" />
                <h3 className="font-display text-xl font-semibold">{card.title}</h3>
                <p className="mt-2 text-sm md:text-base leading-relaxed text-pizarra">{card.text}</p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

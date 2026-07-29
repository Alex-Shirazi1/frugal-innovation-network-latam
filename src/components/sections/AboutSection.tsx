import { useI18n } from '../../i18n/I18nContext'
import { SectionHeading } from '../ui/SectionHeading'
import { commissions, networkValues } from '../../data/network'

const valueAccents = ['#168599', '#8ebc41', '#f6a620', '#e94824', '#4d6a79']

/**
 * Mission, Vision, Values and Commissions, transcribed from the production
 * site. Allan confirmed in the kickoff that this content is still valid, so it
 * carries over rather than being rewritten.
 */
export function AboutSection() {
  const { t, lang } = useI18n()

  return (
    <section id="acerca" aria-labelledby="acerca-heading" className="py-(--spacing-section)">
      <div className="mx-auto max-w-7xl px-4 md:px-8">
        <SectionHeading
          id="acerca-heading"
          kicker={t.about.kicker}
          title={t.about.title}
        />

        {/* Mission and vision carry the most weight, so they get the scale. */}
        <div className="mt-10 grid gap-5 lg:grid-cols-2">
          <article className="relative overflow-hidden rounded-3xl bg-carbon p-8 text-blanco md:p-10">
            <span className="brand-stripe absolute inset-x-0 top-0 h-1.5" aria-hidden="true" />
            <h3 className="text-xs font-bold uppercase tracking-[0.22em] text-naranja">
              {t.about.missionTitle}
            </h3>
            <p className="mt-4 font-display text-xl font-medium leading-snug md:text-2xl">
              {t.about.mission}
            </p>
          </article>

          <article className="relative overflow-hidden rounded-3xl border border-carbon/12 bg-niebla/70 p-8 md:p-10">
            <h3 className="text-xs font-bold uppercase tracking-[0.22em] text-teal">
              {t.about.visionTitle}
            </h3>
            <p className="mt-4 font-display text-xl font-medium leading-snug text-carbon md:text-2xl">
              {t.about.vision}
            </p>
          </article>
        </div>

        <h3 className="mt-14 font-display text-2xl font-medium uppercase tracking-wide text-carbon">
          {t.about.valuesTitle}
        </h3>
        <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {networkValues.map((value, index) => (
            <li
              key={value.id}
              className="rounded-2xl border border-carbon/10 bg-white/70 p-5 transition-shadow hover:shadow-lg hover:shadow-carbon/5"
            >
              <span
                className="block h-1 w-10 rounded-full"
                style={{ background: valueAccents[index % valueAccents.length] }}
                aria-hidden="true"
              />
              <h4 className="mt-3 font-semibold text-carbon">{value.name[lang]}</h4>
              <p className="mt-1.5 text-sm leading-relaxed text-pizarra">{value.text[lang]}</p>
            </li>
          ))}
        </ul>

        <div className="mt-14 rounded-3xl border border-carbon/10 bg-white/60 p-8 md:p-10">
          <h3 className="font-display text-2xl font-medium uppercase tracking-wide text-carbon">
            {t.about.commissionsTitle}
          </h3>
          <p className="mt-2 text-sm text-pizarra">{t.about.commissionsIntro}</p>
          <ol className="mt-5 grid gap-3 sm:grid-cols-2">
            {commissions.map((commission, index) => (
              <li key={commission.es} className="flex gap-3 text-sm text-carbon">
                <span
                  className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-teal/12 text-[11px] font-bold text-teal-deep"
                  aria-hidden="true"
                >
                  {index + 1}
                </span>
                <span className="leading-relaxed">{commission[lang]}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  )
}

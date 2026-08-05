import { useI18n } from '../../i18n/I18nContext'
import { useApiData } from '../../api/ApiDataContext'

/** The network was founded in April 2018 — see the Origin section. */
const FOUNDING_YEAR = 2018

export function Hero() {
  const { t } = useI18n()
  const { institutions, memberCountries } = useApiData()
  const years = new Date().getFullYear() - FOUNDING_YEAR

  const stats = [
    { value: `${institutions.length}+`, label: t.hero.statMembers, color: 'border-teal' },
    { value: `${memberCountries.length}`, label: t.hero.statCountries, color: 'border-naranja' },
    { value: `${years}`, label: t.hero.statYears, color: 'border-verde' },
  ]

  return (
    /*
      No decorative mark in the hero. The one that used to sit on the right was
      a generated approximation of the logo — twelve flat dots in the brand
      palette — placed next to the real lockup in the navbar, which invited the
      comparison and lost it. `relative overflow-hidden` on the section and
      `relative` on the container existed only to position and clip it.
    */
    <section
      id="top"
      aria-labelledby="hero-heading"
      className="bg-blanco pt-28 md:pt-36 pb-14 md:pb-20"
    >
      <div className="mx-auto max-w-7xl px-4 md:px-8">
        <p className="rise-in mb-5 inline-block border-l-4 border-naranja pl-3 text-xs md:text-sm font-bold uppercase tracking-[0.18em] text-teal">
          {t.hero.kicker}
        </p>
        <h1
          id="hero-heading"
          className="rise-in max-w-4xl font-display font-medium uppercase leading-[1.04] text-(length:--text-hero) text-carbon"
          style={{ animationDelay: '80ms' }}
        >
          {t.hero.titleA} <span className="text-teal">{t.hero.titleB}</span>
          <br />
          {t.hero.titleC} <span className="text-naranja">{t.hero.titleD}</span>
        </h1>
        <p
          className="rise-in mt-6 max-w-2xl text-base md:text-xl leading-relaxed text-pizarra"
          style={{ animationDelay: '160ms' }}
        >
          {t.hero.lede}
        </p>

        <div className="rise-in mt-8 flex flex-wrap gap-3" style={{ animationDelay: '240ms' }}>
          <a
            href="#mapa"
            className="rounded-full bg-teal px-6 py-3 text-sm md:text-base font-bold text-blanco transition-colors hover:bg-teal-deep"
          >
            {t.hero.ctaPrimary}
          </a>
          <a
            href="#innovacion-frugal"
            className="rounded-full border-2 border-carbon/15 px-6 py-3 text-sm md:text-base font-bold text-carbon transition-colors hover:border-teal hover:text-teal"
          >
            {t.hero.ctaSecondary}
          </a>
        </div>

        <dl
          className="rise-in mt-14 grid max-w-xl grid-cols-3 gap-4"
          style={{ animationDelay: '320ms' }}
        >
          {stats.map((stat) => (
            <div key={stat.label} className={`border-l-4 pl-3 md:pl-4 ${stat.color}`}>
              <dd className="font-display text-3xl md:text-5xl font-medium text-carbon">{stat.value}</dd>
              <dt className="mt-1 text-xs md:text-sm leading-snug text-pizarra">{stat.label}</dt>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}

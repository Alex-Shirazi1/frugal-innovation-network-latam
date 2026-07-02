import { useI18n } from '../../i18n/I18nContext'
import { institutions, memberCountries } from '../../data/institutions'

const FOUNDING_YEAR = 2020

export function Hero() {
  const { t } = useI18n()
  const years = new Date().getFullYear() - FOUNDING_YEAR

  const stats = [
    { value: `${institutions.length}+`, label: t.hero.statMembers },
    { value: `${memberCountries.length}`, label: t.hero.statCountries },
    { value: `${years}`, label: t.hero.statYears },
  ]

  return (
    <section
      id="top"
      aria-labelledby="hero-heading"
      className="relative overflow-hidden pt-28 md:pt-36 pb-16 md:pb-24"
    >
      {/* layered atmosphere */}
      <div
        aria-hidden="true"
        className="absolute -top-32 -right-40 h-[28rem] w-[28rem] rounded-full bg-ambar/25 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="absolute top-64 -left-48 h-[24rem] w-[24rem] rounded-full bg-verde-claro/70 blur-3xl"
      />

      <div className="relative mx-auto max-w-7xl px-4 md:px-8">
        <p className="rise-in mb-5 inline-block rounded-full border border-tinta/15 bg-crema/80 px-3.5 py-1.5 text-xs md:text-sm font-semibold uppercase tracking-[0.18em] text-verde">
          {t.hero.kicker}
        </p>
        <h1
          id="hero-heading"
          className="rise-in font-display font-semibold leading-[0.98] text-(length:--text-hero) max-w-5xl"
          style={{ animationDelay: '80ms' }}
        >
          {t.hero.titleA}{' '}
          <em className="not-italic text-terracota">{t.hero.titleB}</em>
          <br />
          {t.hero.titleC}{' '}
          <em className="font-normal italic text-verde">{t.hero.titleD}</em>
        </h1>
        <p
          className="rise-in mt-6 max-w-2xl text-base md:text-xl leading-relaxed text-tinta-suave"
          style={{ animationDelay: '160ms' }}
        >
          {t.hero.lede}
        </p>

        <div className="rise-in mt-8 flex flex-wrap gap-3" style={{ animationDelay: '240ms' }}>
          <a
            href="#mapa"
            className="rounded-full bg-tinta px-6 py-3 text-sm md:text-base font-semibold text-crema transition-transform hover:-translate-y-0.5"
          >
            {t.hero.ctaPrimary}
          </a>
          <a
            href="#innovacion-frugal"
            className="rounded-full border border-tinta/20 px-6 py-3 text-sm md:text-base font-semibold transition-colors hover:border-terracota hover:text-terracota"
          >
            {t.hero.ctaSecondary}
          </a>
        </div>

        <dl
          className="rise-in mt-14 grid grid-cols-3 gap-4 max-w-xl"
          style={{ animationDelay: '320ms' }}
        >
          {stats.map((stat) => (
            <div key={stat.label} className="border-l-2 border-terracota/50 pl-3 md:pl-4">
              <dt className="order-2 text-xs md:text-sm text-tinta-suave leading-snug">
                {stat.label}
              </dt>
              <dd className="font-display text-3xl md:text-5xl font-semibold">{stat.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}

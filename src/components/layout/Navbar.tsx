import { useEffect, useState } from 'react'
import { useI18n, type Lang } from '../../i18n/I18nContext'

const sections = [
  { href: '#origen', key: 'origin' },
  { href: '#congreso', key: 'conference' },
  { href: '#innovacion-frugal', key: 'frugal' },
  { href: '#mapa', key: 'map' },
  { href: '#miembros', key: 'members' },
  { href: '#recursos', key: 'library' },
] as const

function LanguageToggle() {
  const { lang, setLang, t } = useI18n()
  const options: Lang[] = ['es', 'en', 'pt']
  return (
    <div
      role="group"
      aria-label={t.common.languageLabel}
      className="flex items-center rounded-full border border-carbon/15 bg-blanco/70 p-0.5 text-xs font-semibold"
    >
      {options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => setLang(option)}
          aria-pressed={lang === option}
          className={`rounded-full px-2.5 py-1 uppercase tracking-wide transition-colors ${
            lang === option
              ? 'bg-carbon text-blanco'
              : 'text-pizarra hover:text-carbon'
          }`}
        >
          {option}
        </button>
      ))}
    </div>
  )
}

export function Navbar() {
  const { t } = useI18n()
  const [menuOpen, setMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 bg-blanco transition-shadow duration-300 ${
        scrolled || menuOpen ? 'shadow-md shadow-carbon/10' : ''
      }`}
    >
      <nav
        aria-label="Main navigation"
        className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-2.5 md:px-8"
      >
        <a href="#top" className="shrink-0">
          <img
            src="/logo-relif.png"
            alt="Red Latinoamericana de Innovación Frugal"
            width="1997"
            height="503"
            className="h-10 w-auto md:h-12"
          />
        </a>

        <ul className="hidden lg:flex items-center gap-6 text-sm font-medium text-pizarra">
          {sections.map((section) => (
            <li key={section.href}>
              <a
                href={section.href}
                className="transition-colors hover:text-teal focus-visible:text-teal"
              >
                {t.nav[section.key]}
              </a>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-2.5">
          <LanguageToggle />
          <a
            href="#unete"
            className="hidden sm:inline-block rounded-full bg-rojo px-4 py-2 text-sm font-bold text-blanco transition-colors hover:bg-naranja hover:text-carbon"
          >
            {t.nav.join}
          </a>
          <button
            type="button"
            className="lg:hidden inline-flex h-10 w-10 items-center justify-center rounded-full border border-carbon/15"
            aria-expanded={menuOpen}
            aria-label="Menu"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
              {menuOpen ? (
                <path d="M3 3l12 12M15 3L3 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              ) : (
                <path d="M2 4.5h14M2 9h14M2 13.5h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              )}
            </svg>
          </button>
        </div>
      </nav>
      <span className="brand-stripe block h-1" aria-hidden="true" />

      {menuOpen ? (
        <div className="lg:hidden border-t border-carbon/10 bg-blanco/95 px-4 pb-6 pt-3 backdrop-blur-md">
          <ul className="flex flex-col gap-1 text-base font-medium">
            {sections.map((section) => (
              <li key={section.href}>
                <a
                  href={section.href}
                  onClick={() => setMenuOpen(false)}
                  className="block rounded-xl px-3 py-2.5 hover:bg-niebla"
                >
                  {t.nav[section.key]}
                </a>
              </li>
            ))}
            <li>
              <a
                href="#unete"
                onClick={() => setMenuOpen(false)}
                className="mt-2 block rounded-xl bg-teal px-3 py-2.5 text-center font-semibold text-blanco"
              >
                {t.nav.join}
              </a>
            </li>
          </ul>
        </div>
      ) : null}
    </header>
  )
}

import { useEffect, useState } from 'react'
import { useI18n } from '../../i18n/I18nContext'
import { LanguageToggle } from '../ui/LanguageToggle'

const sections = [
  { href: '#origen', key: 'origin' },
  { href: '#congreso', key: 'conference' },
  { href: '#innovacion-frugal', key: 'frugal' },
  { href: '#acerca', key: 'about' },
  { href: '#mapa', key: 'map' },
  { href: '#miembros', key: 'members' },
  { href: '#recursos', key: 'library' },
  { href: '#contacto', key: 'contact' },
] as const

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
      {/* Fixed height so switching languages never changes the bar's size */}
      <nav
        aria-label="Main navigation"
        className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-2 px-3 sm:gap-4 sm:px-4 md:h-18 md:px-8"
      >
        <a href="#top" className="shrink-0">
          <img
            src="/logo-relif.png"
            alt="Red Latinoamericana de Innovación Frugal"
            width="1997"
            height="503"
            /* The lockup is ~4:1, so h-10 alone is 159px — wider than a 320px
               bar can spare once the language toggle and menu button are in. */
            className="h-8 w-auto sm:h-10 md:h-12"
          />
        </a>

        {/*
          The row overflowed its own max-w-7xl container by ~140px and clipped
          the join button, at every width wide enough to show it. The fix was
          the labels, not the breakpoint: these used to repeat each section's
          full heading, and eight of those need more bar than the container has.
          Terse labels bring Spanish — the longest language — to ~650px against
          ~800px available, so xl is honest again. See `nav` in translations.ts.
        */}
        <ul className="hidden xl:flex items-center gap-5 text-sm font-medium text-pizarra">
          {sections.map((section) => (
            <li key={section.href}>
              <a
                href={section.href}
                className="whitespace-nowrap transition-colors hover:text-teal focus-visible:text-teal"
              >
                {t.nav[section.key]}
              </a>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-2 sm:gap-2.5">
          <LanguageToggle />
          <a
            href="#unete"
            className="hidden sm:inline-block whitespace-nowrap rounded-full bg-rojo px-4 py-2 text-sm font-bold text-blanco transition-colors hover:bg-naranja hover:text-carbon"
          >
            {t.nav.join}
          </a>
          <button
            type="button"
            className="xl:hidden inline-flex h-10 w-10 items-center justify-center rounded-full border border-carbon/15"
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
        <div className="xl:hidden border-t border-carbon/10 bg-blanco/95 px-4 pb-6 pt-3 backdrop-blur-md">
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

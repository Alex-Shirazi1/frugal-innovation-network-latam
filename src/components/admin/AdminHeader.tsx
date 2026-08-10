import { useI18n } from '../../i18n/I18nContext'
import { LanguageToggle } from '../ui/LanguageToggle'

/**
 * The panel's own header bar.
 *
 * Deliberately not the public `Navbar`. That component's links are all
 * `#anchors` into the single scrolling site — on /admin none of those targets
 * exist, so all eight would be dead — and it carries the "join the network"
 * call to action, which is a strange thing to offer someone moderating
 * membership requests. It is also `fixed`, which would sit on top of the
 * heading below.
 *
 * What is left is the part that was actually missing: somewhere to see you are
 * on RELIF, a way back to the site that is not buried at the foot of the page,
 * and the language switch.
 */
export function AdminHeader() {
  const { t } = useI18n()
  return (
    <header className="bg-blanco">
      <div className="mx-auto flex h-16 max-w-3xl items-center justify-between gap-3 px-4">
        <a href="/" className="shrink-0">
          <img
            src="/logo-relif.png"
            alt="Red Latinoamericana de Innovación Frugal"
            width="1997"
            height="503"
            className="h-8 w-auto sm:h-9"
          />
        </a>
        <div className="flex items-center gap-3">
          <a
            href="/"
            className="whitespace-nowrap text-xs font-semibold text-pizarra transition-colors hover:text-teal"
          >
            ← {t.admin.backToSite}
          </a>
          <LanguageToggle />
        </div>
      </div>
      {/* The brand stripe the public bar carries, so the two read as one site. */}
      <span className="brand-stripe block h-1" aria-hidden="true" />
    </header>
  )
}

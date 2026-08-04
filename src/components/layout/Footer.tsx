import { useI18n } from '../../i18n/I18nContext'

/**
 * A sign-off, not a second navigation layer: logo and copyright, one row.
 *
 * Everything a footer usually justifies its height with is already elsewhere
 * and better. The contact details, general inbox and all seven social channels
 * are in <ContactSection> (#contacto) with icons, handles and a caption. The
 * sitemap duplicated a navbar that is `fixed top-0` — permanently on screen —
 * so the usual argument for it (a reader at the bottom needs a way back) does
 * not apply here; it was also a subset, missing #innovacion-frugal and #acerca.
 * The tagline restated the wordmark in the logo directly above it.
 */
export function Footer() {
  const { t } = useI18n()

  return (
    <footer className="bg-carbon text-blanco">
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-5 px-4 py-8 text-center sm:flex-row sm:justify-between sm:gap-6 sm:text-left md:px-8">
        <div className="rounded-lg bg-blanco p-2">
          <img
            src="/logo-relif.png"
            alt="Red Latinoamericana de Innovación Frugal"
            width="1997"
            height="503"
            className="h-7 w-auto"
          />
        </div>

        <p className="text-xs text-blanco/50">
          © {new Date().getFullYear()} RELIF · {t.footer.rights}
        </p>
      </div>
    </footer>
  )
}

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
      {/*
        Sized to the lockup, not to a notion of how tall a footer should be:
        `h-8` logo + `py-3` is a ~56px bar, so the sign-off reads as a rule at
        the end of the page rather than a final section. The stacked mobile case
        keeps a little more room because the two lines need it.
      */}
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-3 px-4 py-4 text-center sm:flex-row sm:justify-between sm:gap-6 sm:py-3 sm:text-left md:px-8">
        {/*
          The reversed lockup: white wordmark, full-colour mark, transparent
          background. The light logo is opaque RGB with no alpha, so on the
          carbon it needed a white chip behind it, which read as a sticker
          stuck to the footer. This sits on the surface directly, and can run
          slightly larger now that it carries no box.
        */}
        <img
          src="/logo-relif-dark.png"
          alt="Red Latinoamericana de Innovación Frugal"
          width="640"
          height="161"
          className="h-8 w-auto"
        />

        <p className="text-xs text-blanco/50">
          © {new Date().getFullYear()} RELIF · {t.footer.rights}
        </p>
      </div>
    </footer>
  )
}

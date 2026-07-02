import { useI18n } from '../../i18n/I18nContext'

export function Footer() {
  const { t } = useI18n()

  return (
    <footer id="contacto" className="bg-tinta text-crema">
      <div className="mx-auto max-w-7xl px-4 py-14 md:px-8 md:py-20">
        <div className="grid gap-10 md:grid-cols-[2fr_1fr_1fr]">
          <div>
            <div className="flex items-center gap-2.5">
              <img src="/relif-mark.svg" alt="" width="40" height="40" className="rounded-xl" />
              <span className="font-display text-xl font-semibold">RELIF</span>
            </div>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-crema/70">{t.footer.tagline}</p>
          </div>

          <nav aria-label={t.footer.sitemap}>
            <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-ambar">
              {t.footer.sitemap}
            </h3>
            <ul className="mt-4 space-y-2 text-sm text-crema/80">
              <li><a className="hover:text-ambar" href="#origen">{t.nav.origin}</a></li>
              <li><a className="hover:text-ambar" href="#congreso">{t.nav.conference}</a></li>
              <li><a className="hover:text-ambar" href="#mapa">{t.nav.map}</a></li>
              <li><a className="hover:text-ambar" href="#miembros">{t.nav.members}</a></li>
              <li><a className="hover:text-ambar" href="#recursos">{t.nav.library}</a></li>
            </ul>
          </nav>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-ambar">
              {t.footer.contact}
            </h3>
            <ul className="mt-4 space-y-2 text-sm text-crema/80">
              <li>
                <a className="hover:text-ambar" href="mailto:contacto@redinnovacionfrugal.lat">
                  contacto@redinnovacionfrugal.lat
                </a>
              </li>
              <li>
                <a
                  className="hover:text-ambar"
                  href="https://linktr.ee/redinnovacionfrugal"
                  target="_blank"
                  rel="noreferrer"
                >
                  {t.footer.social}
                </a>
              </li>
            </ul>
          </div>
        </div>

        <p className="mt-12 border-t border-crema/15 pt-6 text-xs text-crema/50">
          © {new Date().getFullYear()} RELIF · {t.footer.rights}
        </p>
      </div>
    </footer>
  )
}

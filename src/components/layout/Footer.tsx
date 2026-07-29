import { useI18n } from '../../i18n/I18nContext'
import { networkEmails, socialLinks } from '../../data/network'

export function Footer() {
  const { t } = useI18n()

  return (
    <footer id="contacto" className="bg-carbon text-blanco">
      <div className="mx-auto max-w-7xl px-4 py-14 md:px-8 md:py-20">
        <div className="grid gap-10 md:grid-cols-[2fr_1fr_1fr]">
          <div>
            <div className="inline-block rounded-xl bg-blanco p-3">
              <img
                src="/logo-relif.png"
                alt="Red Latinoamericana de Innovación Frugal"
                width="1997"
                height="503"
                className="h-10 w-auto"
              />
            </div>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-blanco/70">{t.footer.tagline}</p>
          </div>

          <nav aria-label={t.footer.sitemap}>
            <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-naranja">
              {t.footer.sitemap}
            </h3>
            <ul className="mt-4 space-y-2 text-sm text-blanco/80">
              <li><a className="hover:text-naranja" href="#origen">{t.nav.origin}</a></li>
              <li><a className="hover:text-naranja" href="#congreso">{t.nav.conference}</a></li>
              <li><a className="hover:text-naranja" href="#mapa">{t.nav.map}</a></li>
              <li><a className="hover:text-naranja" href="#miembros">{t.nav.members}</a></li>
              <li><a className="hover:text-naranja" href="#recursos">{t.nav.library}</a></li>
            </ul>
          </nav>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-naranja">
              {t.footer.contact}
            </h3>
            <ul className="mt-4 space-y-2 text-sm text-blanco/80">
              <li>
                <a className="hover:text-naranja" href={`mailto:${networkEmails.general}`}>
                  {networkEmails.general}
                </a>
              </li>
              <li>
                <a className="hover:text-naranja" href="#contacto">
                  {t.nav.contact}
                </a>
              </li>
            </ul>
            {/* Every channel the network publishes, not just the Linktree. */}
            <h3 className="mt-6 text-xs font-semibold uppercase tracking-[0.2em] text-naranja">
              {t.footer.social}
            </h3>
            <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-blanco/80">
              {socialLinks.map((social) => (
                <li key={social.id}>
                  <a
                    className="hover:text-naranja"
                    href={social.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {social.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <p className="mt-12 border-t border-blanco/15 pt-6 text-xs text-blanco/50">
          © {new Date().getFullYear()} RELIF · {t.footer.rights}
        </p>
      </div>
    </footer>
  )
}

import { useI18n } from '../../i18n/I18nContext'
import { SectionHeading } from '../ui/SectionHeading'
import { networkEmails, regionalContacts, socialLinks, type SocialId } from '../../data/network'
import { socialIconPaths } from '../../data/socialIcons'

function SocialGlyph({ id }: { id: SocialId }) {
  const path = socialIconPaths[id]
  if (!path) return null
  return (
    <svg viewBox="0 0 24 24" className="size-5 shrink-0" fill="currentColor" aria-hidden="true">
      <path d={path} />
    </svg>
  )
}

/**
 * Contact and social presence, ported from the production site. The old site
 * published five regional leads and seven channels; the redesign had neither,
 * which left a network site with no way to reach anyone.
 */
export function ContactSection() {
  const { t, lang } = useI18n()

  return (
    <section
      id="contacto"
      aria-labelledby="contacto-heading"
      className="bg-niebla/60 py-(--spacing-section)"
    >
      <div className="mx-auto max-w-7xl px-4 md:px-8">
        <SectionHeading
          id="contacto-heading"
          kicker={t.contact.kicker}
          title={t.contact.title}
          subtitle={t.contact.subtitle}
        />

        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {regionalContacts.map((contact) => (
            <li
              key={contact.id}
              className="flex flex-col rounded-2xl border border-carbon/10 bg-blanco p-6 transition-shadow hover:shadow-lg hover:shadow-carbon/5"
            >
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-teal">
                {contact.region[lang]}
              </p>
              <h3 className="mt-2 font-display text-lg font-medium text-carbon">{contact.name}</h3>
              <p className="mt-1 text-sm leading-snug text-pizarra">{contact.role[lang]}</p>
              <p className="mt-1 text-xs text-pizarra/80">{contact.city}</p>
              <a
                href={`mailto:${contact.email}`}
                className="mt-auto break-all pt-4 text-xs font-semibold text-teal hover:underline"
              >
                ✉ {contact.email}
              </a>
            </li>
          ))}
        </ul>

        <div className="mt-12 grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          {/* General inbox */}
          <div className="min-w-0 rounded-3xl bg-carbon p-6 text-blanco sm:p-8">
            <h3 className="text-xs font-bold uppercase tracking-[0.22em] text-naranja">
              {t.contact.generalTitle}
            </h3>
            <ul className="mt-4 space-y-2 text-sm">
              {[networkEmails.general, networkEmails.alternate].map((email) => (
                <li key={email}>
                  <a href={`mailto:${email}`} className="break-all font-medium hover:text-naranja">
                    {email}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Social channels */}
          <div className="min-w-0 rounded-3xl border border-carbon/12 bg-blanco p-6 sm:p-8">
            <h3 className="font-display text-xl font-medium uppercase tracking-wide text-carbon">
              {t.contact.socialTitle}
            </h3>
            <p className="mt-2 text-sm text-pizarra">{t.contact.socialSubtitle}</p>
            <ul className="mt-5 grid gap-2 sm:grid-cols-2">
              {socialLinks.map((social) => (
                /* `min-w-0`: without it these grid items cannot shrink below
                   their longest handle (`Red.Latinoamericana.Innovacion.Frugal`),
                   which widened the whole contact grid past a 320px screen. */
                <li key={social.id} className="min-w-0">
                  <a
                    href={social.url}
                    target="_blank"
                    rel="noreferrer"
                    className="group flex items-center gap-3 rounded-xl border border-carbon/10 px-3.5 py-2.5 text-sm transition-colors hover:border-teal hover:bg-teal/5"
                  >
                    <span className="text-pizarra transition-colors group-hover:text-teal">
                      <SocialGlyph id={social.id} />
                    </span>
                    <span className="min-w-0">
                      <span className="block font-semibold text-carbon">{social.label}</span>
                      <span className="block truncate text-[11px] text-pizarra">
                        {social.handle}
                      </span>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
            <p className="mt-5 text-[11px] leading-relaxed text-pizarra/80">
              {t.contact.podcastNote}
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

import { useI18n } from '../../i18n/I18nContext'
import { SectionHeading } from '../ui/SectionHeading'
import { networkEmails, regionalContacts, socialLinks, type SocialId } from '../../data/network'

/**
 * Inline glyphs rather than an icon dependency — seven marks is not worth a
 * library, and these inherit currentColor so hover states come free.
 */
const socialGlyphs: Record<SocialId, string> = {
  linkedin: 'M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM2.4 21h5.16V9.75H2.4V21Zm7.74 0h5.16v-6.1c0-1.62.3-3.19 2.31-3.19 1.98 0 2.01 1.85 2.01 3.29V21h5.16v-6.9c0-4.48-.97-7.6-6.2-7.6-2.51 0-4.2 1.38-4.89 2.69h-.07V9.75h-4.95V21h1.47Z',
  youtube: 'M23 12s0-3.4-.44-5.03a2.62 2.62 0 0 0-1.84-1.85C19.09 4.68 12 4.68 12 4.68s-7.09 0-8.72.44a2.62 2.62 0 0 0-1.84 1.85C1 8.6 1 12 1 12s0 3.4.44 5.03c.24.9.94 1.6 1.84 1.85 1.63.44 8.72.44 8.72.44s7.09 0 8.72-.44a2.62 2.62 0 0 0 1.84-1.85C23 15.4 23 12 23 12ZM9.75 15.5v-7l6 3.5-6 3.5Z',
  instagram: 'M12 2.2c3.2 0 3.58.01 4.85.07 1.17.05 1.96.24 2.65.51.71.28 1.31.65 1.91 1.25.6.6.97 1.2 1.25 1.91.27.69.46 1.48.51 2.65.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.24 1.96-.51 2.65-.28.71-.65 1.31-1.25 1.91-.6.6-1.2.97-1.91 1.25-.69.27-1.48.46-2.65.51-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.96-.24-2.65-.51a5.15 5.15 0 0 1-1.91-1.25 5.15 5.15 0 0 1-1.25-1.91c-.27-.69-.46-1.48-.51-2.65C2.21 15.58 2.2 15.2 2.2 12s.01-3.58.07-4.85c.05-1.17.24-1.96.51-2.65.28-.71.65-1.31 1.25-1.91.6-.6 1.2-.97 1.91-1.25.69-.27 1.48-.46 2.65-.51C8.42 2.21 8.8 2.2 12 2.2Zm0 5.1a4.7 4.7 0 1 0 0 9.4 4.7 4.7 0 0 0 0-9.4Zm0 7.75a3.05 3.05 0 1 1 0-6.1 3.05 3.05 0 0 1 0 6.1Zm5.98-7.94a1.1 1.1 0 1 1-2.2 0 1.1 1.1 0 0 1 2.2 0Z',
  facebook: 'M13.5 21v-8.1h2.73l.41-3.17H13.5V7.7c0-.92.26-1.55 1.57-1.55h1.68V3.31c-.29-.04-1.29-.12-2.45-.12-2.43 0-4.09 1.48-4.09 4.2v2.34H7.47v3.17h2.74V21h3.29Z',
  twitter: 'M18.9 3h3.4l-7.43 8.49L23 21h-6.6l-4.6-6.02L6.5 21H3.1l7.72-8.82L2.6 3h6.77l4.3 5.69L18.9 3Zm-1.2 16h1.88L7.3 4.93H5.28L17.7 19Z',
  spotify: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm4.59 14.42a.75.75 0 0 1-1.03.25c-2.82-1.72-6.37-2.11-10.55-1.16a.75.75 0 1 1-.33-1.46c4.57-1.04 8.51-.59 11.66 1.33.36.22.47.68.25 1.04Zm1.22-2.72a.94.94 0 0 1-1.29.31c-3.23-1.98-8.15-2.56-11.96-1.4a.94.94 0 1 1-.55-1.8c4.36-1.32 9.78-.68 13.49 1.6.44.27.58.85.31 1.29Zm.1-2.83c-3.87-2.3-10.26-2.51-13.96-1.39a1.12 1.12 0 1 1-.65-2.15c4.24-1.29 11.29-1.04 15.75 1.6a1.13 1.13 0 0 1-1.14 1.94Z',
  linktree: 'M12 2.5 6.8 7.7l1.6 1.6L11 6.7v4.4H8.5v2.3H11V21h2v-7.6h2.5v-2.3H13V6.7l2.6 2.6 1.6-1.6L12 2.5Z',
}

function SocialGlyph({ id }: { id: SocialId }) {
  return (
    <svg viewBox="0 0 24 24" className="size-5 shrink-0" fill="currentColor" aria-hidden="true">
      <path d={socialGlyphs[id]} />
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
          <div className="rounded-3xl bg-carbon p-8 text-blanco">
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
          <div className="rounded-3xl border border-carbon/12 bg-blanco p-8">
            <h3 className="font-display text-xl font-medium uppercase tracking-wide text-carbon">
              {t.contact.socialTitle}
            </h3>
            <p className="mt-2 text-sm text-pizarra">{t.contact.socialSubtitle}</p>
            <ul className="mt-5 grid gap-2 sm:grid-cols-2">
              {socialLinks.map((social) => (
                <li key={social.id}>
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

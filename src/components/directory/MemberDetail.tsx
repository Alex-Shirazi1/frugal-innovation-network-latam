import { useI18n } from '../../i18n/I18nContext'
import { useApiData } from '../../api/ApiDataContext'
import { Modal } from '../ui/Modal'
import { placeLabel } from '../../data/onboardingOptions'
import type { Member, ResearchInterest } from '../../api/types'

interface MemberDetailProps {
  member: Member
  onClose: () => void
}

const avatarPalette = ['#168599', '#8ebc41', '#f6a620', '#e94824', '#4d6a79']

function initialsOf(firstName: string, lastName: string): string {
  return `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase()
}

/** Renders a labelled row, or nothing at all when the value is empty. */
function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 py-3 sm:flex-row sm:gap-4">
      <dt className="shrink-0 text-[11px] font-bold uppercase tracking-wider text-pizarra sm:w-40">
        {label}
      </dt>
      <dd className="min-w-0 text-sm text-carbon">{children}</dd>
    </div>
  )
}

function TagList({
  ids,
  options,
  lang,
  className,
}: {
  ids: string[]
  options: ResearchInterest[]
  lang: 'es' | 'en' | 'pt'
  className: string
}) {
  const labels = ids
    .map((id) => options.find((o) => o.id === id))
    .filter((o): o is ResearchInterest => o !== undefined)

  if (labels.length === 0) return null
  return (
    <ul className="flex flex-wrap gap-1.5">
      {labels.map((option) => (
        <li key={option.id} className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${className}`}>
          {option[lang]}
        </li>
      ))}
    </ul>
  )
}

/**
 * Full member profile. Allan asked for a clickable list where every field from
 * the intake form is visible on the individual record.
 */
export function MemberDetail({ member, onClose }: MemberDetailProps) {
  const { lang, t } = useI18n()
  const { institutionName, options } = useApiData()
  const affiliation = institutionName(member.affiliationId)
  const accent = avatarPalette[member.avatarHue % avatarPalette.length]

  const languageLabels = member.languages
    .map((id) => options.languageOptions.find((l) => l.id === id))
    .filter((l): l is (typeof options.languageOptions)[number] => l !== undefined)
    .map((l) => l[lang])

  return (
    <Modal open onClose={onClose} labelledBy="member-detail-title">
      <header className="relative overflow-hidden rounded-t-3xl px-6 pb-6 pt-8 md:px-10">
        <span className="absolute inset-0 opacity-12" style={{ background: accent }} aria-hidden="true" />
        <span className="brand-stripe absolute inset-x-0 top-0 h-1.5" aria-hidden="true" />
        <button
          type="button"
          onClick={onClose}
          aria-label={t.directory.close}
          className="absolute right-4 top-4 rounded-full px-2.5 py-1 text-lg text-pizarra transition-colors hover:bg-carbon/8 hover:text-carbon"
        >
          ✕
        </button>

        <div className="relative flex items-center gap-4">
          <span
            aria-hidden="true"
            className="flex size-16 shrink-0 items-center justify-center rounded-full font-display text-2xl font-semibold text-blanco"
            style={{ background: accent }}
          >
            {initialsOf(member.firstName, member.lastName)}
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-pizarra">
              {t.directory.profileOf}
            </p>
            <h2
              id="member-detail-title"
              className="mt-1 font-display text-2xl font-medium leading-tight text-carbon md:text-3xl"
            >
              {member.fullName}
            </h2>
            <p className="mt-1 text-sm text-pizarra">{member.title[lang]}</p>
          </div>
        </div>
      </header>

      <div className="px-6 pb-8 md:px-10">
        <dl className="divide-y divide-carbon/8 border-y border-carbon/8">
          {member.jobPositionName ? (
            <DetailRow label={t.directory.jobPosition}>{member.jobPositionName}</DetailRow>
          ) : null}

          <DetailRow label={t.directory.affiliation}>
            {affiliation ?? (
              <span className="inline-block rounded-full bg-verde/10 px-2.5 py-0.5 text-verde">
                {t.directory.independent}
              </span>
            )}
          </DetailRow>

          <DetailRow label={t.directory.location}>
            {placeLabel(member.region, lang)}, {placeLabel(member.country, lang)}
          </DetailRow>

          <DetailRow label={t.directory.biography}>
            {member.biography ? (
              <p className="leading-relaxed">{member.biography}</p>
            ) : (
              <span className="text-pizarra/70">{t.directory.noBiography}</span>
            )}
          </DetailRow>

          <DetailRow label={t.directory.interests}>
            <TagList
              ids={member.interestIds}
              options={options.researchInterests}
              lang={lang}
              className="bg-verde/12 text-[#5d8523]"
            />
          </DetailRow>

          <DetailRow label={t.directory.generalAreas}>
            <TagList
              ids={member.generalAreaIds}
              options={options.generalAreas}
              lang={lang}
              className="bg-teal/10 text-teal-deep"
            />
          </DetailRow>

          {languageLabels.length > 0 ? (
            <DetailRow label={t.directory.languages}>{languageLabels.join(' · ')}</DetailRow>
          ) : null}

          {member.socialUrl ? (
            <DetailRow label={t.directory.social}>
              <a
                href={member.socialUrl}
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-teal hover:underline"
              >
                ↗ {member.socialUrl.replace(/^https?:\/\//, '')}
              </a>
            </DetailRow>
          ) : null}
        </dl>

        <button
          type="button"
          onClick={onClose}
          className="mt-6 w-full rounded-full border border-carbon/15 px-6 py-3 text-sm font-bold text-carbon transition-colors hover:border-carbon/40 sm:w-auto sm:px-8"
        >
          {t.directory.close}
        </button>
      </div>
    </Modal>
  )
}

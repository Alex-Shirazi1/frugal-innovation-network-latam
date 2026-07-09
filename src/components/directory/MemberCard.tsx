import { memo } from 'react'
import { useI18n } from '../../i18n/I18nContext'
import { institutionName, type Member } from '../../data/members'
import { researchInterests } from '../../data/onboardingOptions'

interface MemberCardProps {
  member: Member
  highlighted?: boolean
}

function initialsOf(fullName: string): string {
  return fullName
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0] ?? '')
    .join('')
    .toUpperCase()
}

export const MemberCard = memo(function MemberCard({ member, highlighted }: MemberCardProps) {
  const { lang, t } = useI18n()
  const affiliation = institutionName(member.affiliationId)

  return (
    <li
      className={`flex flex-col rounded-2xl border p-5 transition-shadow hover:shadow-lg hover:shadow-carbon/5 ${
        highlighted
          ? 'border-teal bg-teal/5 shadow-lg shadow-teal/10'
          : 'border-carbon/10 bg-white/70'
      }`}
    >
      <div className="flex items-center gap-3.5">
        <span
          aria-hidden="true"
          className="flex h-13 w-13 shrink-0 items-center justify-center rounded-full font-display text-lg font-semibold text-blanco"
          style={{
            background: ['#168599', '#8ebc41', '#f6a620', '#e94824', '#4d6a79'][member.avatarHue % 5],
          }}
        >
          {initialsOf(member.fullName)}
        </span>
        <div className="min-w-0">
          <h3 className="truncate font-semibold leading-snug">{member.fullName}</h3>
          <p className="truncate text-xs text-pizarra">{member.title[lang]}</p>
        </div>
      </div>

      <p className="mt-3 text-xs font-medium leading-snug">
        {affiliation ?? (
          <span className="inline-block rounded-full bg-verde/10 px-2 py-0.5 text-verde">
            {t.directory.independent}
          </span>
        )}
        {affiliation ? (
          <span className="block mt-0.5 text-pizarra font-normal">
            {member.region}, {member.country}
          </span>
        ) : null}
      </p>

      <ul className="mt-3 flex flex-wrap gap-1.5" aria-label={t.directory.interests}>
        {member.interestIds.slice(0, 3).map((id) => {
          const interest = researchInterests.find((entry) => entry.id === id)
          if (!interest) return null
          return (
            <li
              key={id}
              className="rounded-full bg-niebla px-2.5 py-1 text-[11px] font-medium text-pizarra"
            >
              {interest[lang]}
            </li>
          )
        })}
      </ul>

      {member.socialUrl ? (
        <a
          href={member.socialUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-auto pt-3 text-xs font-semibold text-teal hover:underline"
        >
          ↗ {member.socialUrl.replace(/^https?:\/\//, '').split('/')[0]}
        </a>
      ) : null}
    </li>
  )
})

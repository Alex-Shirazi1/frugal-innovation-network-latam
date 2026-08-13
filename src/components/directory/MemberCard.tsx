import { memo } from 'react'
import { useI18n } from '../../i18n/I18nContext'
import { useApiData } from '../../api/ApiDataContext'
import { placeLabel } from '../../data/onboardingOptions'
import type { Member } from '../../api/types'
import { initialsOf } from '../../lib/initials'

interface MemberCardProps {
  member: Member
  onOpen?: (member: Member) => void
  /** Extra classes for the card shell. The carousel uses it to pin a width,
   *  since a flex row gives items no column to inherit one from. */
  className?: string
}


export const MemberCard = memo(function MemberCard({
  member,
  onOpen,
  className = '',
}: MemberCardProps) {
  const { lang, t } = useI18n()
  const { institutionName, options } = useApiData()
  const affiliation = institutionName(member.affiliationId)

  return (
    <li
      /* `min-w-0`: a grid item defaults to `min-width: auto`, so a long member
         name would push the card wider than its column and scroll the whole
         page sideways at 320px. Allowing it to shrink lets the `truncate`
         below actually do its job. */
      className={`group relative flex min-w-0 flex-col rounded-2xl border border-carbon/10 bg-white/70 p-5 transition-shadow hover:shadow-lg hover:shadow-carbon/5 ${className}`}
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
          <h3 className="truncate font-semibold leading-snug">
            {onOpen ? (
              /*
               * The heading is the trigger, so the control's accessible name is
               * the member's name. The `after` pseudo-element stretches the hit
               * area to the whole card without nesting interactive elements;
               * the social link below opts out via `relative z-1`.
               */
              <button
                type="button"
                onClick={() => onOpen(member)}
                /* `truncate` has to live on the element holding the text — the
                 * h3's own truncate cannot ellipsize a child element's text. */
                className="block w-full truncate text-left outline-none after:absolute after:inset-0 after:rounded-2xl after:content-[''] group-hover:underline focus-visible:after:ring-2 focus-visible:after:ring-teal"
              >
                {member.fullName}
              </button>
            ) : (
              member.fullName
            )}
          </h3>
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
            {placeLabel(member.region, lang)}, {placeLabel(member.country, lang)}
          </span>
        ) : null}
      </p>

      <ul className="mt-3 flex flex-wrap gap-1.5" aria-label={t.directory.interests}>
        {member.interestIds.slice(0, 3).map((id) => {
          const interest = options.researchInterests.find((entry) => entry.id === id)
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
          className="relative z-1 mt-auto self-start pt-3 text-xs font-semibold text-teal hover:underline"
        >
          ↗ {member.socialUrl.replace(/^https?:\/\//, '').split('/')[0]}
        </a>
      ) : null}
    </li>
  )
})

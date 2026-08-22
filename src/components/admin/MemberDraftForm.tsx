/**
 * The hand-editing surface for a directory profile — manual add, and correcting
 * an existing member or an arrived response the mapping could not resolve.
 *
 * Only the fields a person actually authors are here. fullName, the localized
 * title and avatarHue are derived by validateMemberDraft from the canonical
 * validator, so there is deliberately nothing to type for them: a form that let
 * someone set a display name independently of their real one would be a form for
 * misrepresenting people, which is the problem the fabricated speaker list was.
 */
import { useState } from 'react'
import { EditorField, editorInputClass } from './ContentEditorShell'
import { useI18n } from '../../i18n/I18nContext'
import {
  generalAreas,
  languageOptions,
  researchInterests,
  fieldLimits,
} from '../../data/onboardingOptions'
import { institutions } from '../../data/institutions'
import type { MemberDraft } from '../../domain/memberDraft'

const EMPTY: MemberDraft = {
  fullName: '',
  position: '',
  jobPositionName: '',
  biography: '',
  affiliationId: null,
  country: '',
  region: '',
  interestIds: [],
  generalAreaIds: [],
  languages: [],
  socialUrl: '',
}

interface ChipSelectProps {
  legend: string
  hint: string
  options: readonly { id: string; es: string; en: string; pt: string }[]
  selected: string[]
  max: number
  onChange: (next: string[]) => void
}

/**
 * Multi-select capped at the same limit the validator enforces.
 *
 * The cap blocks new selections but never blocks removing one, so a full group is
 * still editable rather than stuck — the same rule the public onboarding form
 * uses, which is where this control's behaviour comes from.
 */
function ChipSelect({ legend, hint, options, selected, max, onChange }: ChipSelectProps) {
  const { lang } = useI18n()
  return (
    <fieldset className="mt-4">
      <legend className="text-sm font-semibold text-carbon">{legend}</legend>
      <p className="mb-2 text-xs text-pizarra">{hint}</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => {
          const checked = selected.includes(option.id)
          const atCap = !checked && selected.length >= max
          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={checked}
              disabled={atCap}
              onClick={() =>
                onChange(
                  checked ? selected.filter((id) => id !== option.id) : [...selected, option.id],
                )
              }
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                checked
                  ? 'border-teal-deep bg-teal-deep text-white'
                  : atCap
                    ? 'border-carbon/10 text-carbon/30'
                    : 'border-carbon/15 text-pizarra hover:border-teal-deep hover:text-teal-deep'
              }`}
            >
              {option[lang]}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}

interface MemberDraftFormProps {
  initial?: MemberDraft
  error?: string | null
  busy?: boolean
  onSave: (draft: MemberDraft) => void
  onCancel: () => void
}

export function MemberDraftForm({
  initial,
  error,
  busy = false,
  onSave,
  onCancel,
}: MemberDraftFormProps) {
  const { t } = useI18n()
  const copy = t.admin.members
  const [draft, setDraft] = useState<MemberDraft>(initial ?? EMPTY)

  const update = <K extends keyof MemberDraft>(field: K, value: MemberDraft[K]) =>
    setDraft((current) => ({ ...current, [field]: value }))

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        onSave(draft)
      }}
      className="rounded-2xl border border-carbon/10 bg-white p-5"
    >

      <div className="grid gap-4 sm:grid-cols-2">
        <EditorField label={`${copy.fullName} *`}>
          <input
            className={editorInputClass}
            value={draft.fullName}
            maxLength={fieldLimits.fullName}
            onChange={(event) => update('fullName', event.target.value)}
          />
        </EditorField>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <EditorField label={`${copy.position} *`}>
          <input
            className={editorInputClass}
            value={draft.position}
            onChange={(event) => update('position', event.target.value)}
          />
        </EditorField>
        <EditorField label={copy.jobPositionName} hint={copy.jobPositionNameHint}>
          <input
            className={editorInputClass}
            value={draft.jobPositionName}
            maxLength={fieldLimits.jobPositionName}
            onChange={(event) => update('jobPositionName', event.target.value)}
          />
        </EditorField>
      </div>

      <EditorField label={copy.affiliation} hint={copy.affiliationHint}>
        <select
          className={editorInputClass}
          value={draft.affiliationId ?? ''}
          onChange={(event) => update('affiliationId', event.target.value || null)}
        >
          <option value="">{copy.noAffiliation}</option>
          {institutions.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.name}
            </option>
          ))}
        </select>
      </EditorField>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <EditorField label={`${copy.country} *`}>
          <input
            className={editorInputClass}
            value={draft.country}
            onChange={(event) => update('country', event.target.value)}
          />
        </EditorField>
        <EditorField label={`${copy.region} *`}>
          <input
            className={editorInputClass}
            value={draft.region}
            onChange={(event) => update('region', event.target.value)}
          />
        </EditorField>
      </div>

      <EditorField label={copy.biography} hint={copy.biographyHint}>
        <textarea
          className={`${editorInputClass} min-h-24`}
          value={draft.biography}
          maxLength={fieldLimits.biography}
          onChange={(event) => update('biography', event.target.value)}
        />
      </EditorField>

      <EditorField label={copy.socialUrl} hint={copy.socialUrlHint}>
        <input
          className={editorInputClass}
          value={draft.socialUrl}
          maxLength={fieldLimits.socialUrl}
          onChange={(event) => update('socialUrl', event.target.value)}
        />
      </EditorField>

      <ChipSelect
        legend={`${copy.interests} *`}
        hint={copy.max.replace('{n}', String(fieldLimits.maxTechnicalInterests))}
        options={researchInterests}
        selected={draft.interestIds}
        max={fieldLimits.maxTechnicalInterests}
        onChange={(next) => update('interestIds', next)}
      />
      <ChipSelect
        legend={`${copy.areas} *`}
        hint={copy.max.replace('{n}', String(fieldLimits.maxGeneralAreas))}
        options={generalAreas}
        selected={draft.generalAreaIds}
        max={fieldLimits.maxGeneralAreas}
        onChange={(next) => update('generalAreaIds', next)}
      />
      <ChipSelect
        legend={`${copy.languages} *`}
        hint={copy.max.replace('{n}', String(fieldLimits.maxLanguages))}
        options={languageOptions}
        selected={draft.languages}
        max={fieldLimits.maxLanguages}
        onChange={(next) => update('languages', next)}
      />

      {error ? (
        <p role="alert" className="mt-4 text-xs font-medium text-teal-deep">
          {error}
        </p>
      ) : null}

      <div className="mt-6 flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={busy}
          className="rounded-full bg-carbon px-5 py-2.5 text-xs font-semibold text-white disabled:opacity-50"
        >
          {busy ? copy.saving : copy.save}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full border border-carbon/15 px-5 py-2.5 text-xs font-semibold text-pizarra hover:border-teal-deep hover:text-teal-deep"
        >
          {copy.cancel}
        </button>
      </div>
    </form>
  )
}

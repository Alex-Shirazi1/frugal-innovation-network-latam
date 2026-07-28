import { useMemo, useState, type ReactNode } from 'react'
import { useCapture } from '../../lib/analytics'
import { useI18n } from '../../i18n/I18nContext'
import { useApiData } from '../../api/ApiDataContext'
import { SectionHeading } from '../ui/SectionHeading'
import { fieldLimits } from '../../data/onboardingOptions'
import type { IntakeSubmission, PositionType, ResearchInterest } from '../../api/types'

type ErrorKey =
  | 'firstName'
  | 'lastName'
  | 'position'
  | 'jobPositionName'
  | 'country'
  | 'region'
  | 'interests'
  | 'areas'
  | 'languages'
  | 'biography'
  | 'socialUrl'
  | 'consent'

type Errors = Partial<Record<ErrorKey, string>>

/** Submission status. `not-saved` means valid input that reached no backend. */
type Status = 'idle' | 'submitting' | 'done' | 'not-saved'

const TOTAL_STEPS = 4
const LAST_STEP = TOTAL_STEPS - 1

const emptyForm: IntakeSubmission = {
  firstName: '',
  lastName: '',
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
  consentToPublish: false,
}

const inputClass =
  'w-full rounded-xl border border-carbon/15 bg-white px-4 py-3 text-sm outline-none transition-colors focus:border-teal'

function Field({ label, error, hint, children }: {
  label: string
  error?: string
  hint?: string
  children: ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold">{label}</span>
      {hint ? <span className="mb-1.5 block text-xs text-pizarra">{hint}</span> : null}
      {children}
      {error ? (
        <span role="alert" className="mt-1 block text-xs font-medium text-teal-deep">
          {error}
        </span>
      ) : null}
    </label>
  )
}

interface ChipGroupProps {
  legend: string
  hint: string
  error?: string
  options: ResearchInterest[]
  selected: string[]
  max: number
  activeClass: string
  onToggle: (ids: string[]) => void
  labelFor: (option: ResearchInterest) => string
}

/** Multi-select pill group used for interests, areas, and languages. */
function ChipGroup({
  legend,
  hint,
  error,
  options,
  selected,
  max,
  activeClass,
  onToggle,
  labelFor,
}: ChipGroupProps) {
  return (
    <fieldset>
      <legend className="mb-1 text-sm font-semibold">{legend}</legend>
      <p className="mb-2.5 text-xs text-pizarra">{hint}</p>
      {error ? (
        <p role="alert" className="mb-2 text-xs font-medium text-teal-deep">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const checked = selected.includes(option.id)
          // Block new selections past the cap, but never block deselecting.
          const atCap = !checked && selected.length >= max
          return (
            <label
              key={option.id}
              className={`rounded-full px-3.5 py-2 text-xs font-semibold transition-colors ${
                checked
                  ? activeClass
                  : atCap
                    ? 'cursor-not-allowed border border-carbon/10 text-pizarra/40'
                    : 'cursor-pointer border border-carbon/15 text-pizarra hover:border-verde'
              }`}
            >
              <input
                type="checkbox"
                className="sr-only"
                checked={checked}
                disabled={atCap}
                onChange={() =>
                  onToggle(
                    checked ? selected.filter((id) => id !== option.id) : [...selected, option.id],
                  )
                }
              />
              {labelFor(option)}
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}

export function OnboardingForm() {
  const { t, lang } = useI18n()
  const { addMember, submitIntake, institutions, options } = useApiData()
  const capture = useCapture()
  const [step, setStep] = useState(0)
  const [form, setForm] = useState<IntakeSubmission>(emptyForm)
  const [errors, setErrors] = useState<Errors>({})
  const [status, setStatus] = useState<Status>('idle')

  const regions = useMemo(
    () => options.countries.find((c) => c.name === form.country)?.regions ?? [],
    [options.countries, form.country],
  )

  function update<K extends keyof IntakeSubmission>(key: K, value: IntakeSubmission[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  function validateStep(current: number): boolean {
    const next: Errors = {}
    if (current === 0) {
      if (!form.firstName.trim()) next.firstName = t.onboarding.errors.required
      else if (form.firstName.trim().length > fieldLimits.firstName)
        next.firstName = t.onboarding.errors.tooLong
      if (!form.lastName.trim()) next.lastName = t.onboarding.errors.required
      else if (form.lastName.trim().length > fieldLimits.lastName)
        next.lastName = t.onboarding.errors.tooLong
      if (!form.position) next.position = t.onboarding.errors.required
      if (form.jobPositionName.trim().length > fieldLimits.jobPositionName)
        next.jobPositionName = t.onboarding.errors.tooLong
    }
    if (current === 1) {
      if (!form.country) next.country = t.onboarding.errors.required
      if (!form.region) next.region = t.onboarding.errors.required
    }
    if (current === 2) {
      if (form.interestIds.length === 0) next.interests = t.onboarding.errors.interests
      if (form.generalAreaIds.length === 0) next.areas = t.onboarding.errors.areas
      if (form.languages.length === 0) next.languages = t.onboarding.errors.languages
    }
    if (current === LAST_STEP) {
      if (form.biography.trim().length > fieldLimits.biography)
        next.biography = t.onboarding.errors.tooLong
      if (form.socialUrl && !/^https?:\/\/.+\..+/.test(form.socialUrl)) {
        next.socialUrl = t.onboarding.errors.url
      }
      if (!form.consentToPublish) next.consent = t.onboarding.errors.consent
    }
    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function submit() {
    if (!validateStep(LAST_STEP)) return
    setStatus('submitting')
    const result = await submitIntake(form)

    if (!result.success || !result.data) {
      setStatus('idle')
      // Surface the server's reason on the field it belongs to.
      const code = result.error
      setErrors({
        interests: code === 'missing-interests' ? t.onboarding.errors.interests : undefined,
        areas: code === 'missing-areas' ? t.onboarding.errors.areas : undefined,
        languages: code === 'missing-languages' ? t.onboarding.errors.languages : undefined,
        socialUrl: code === 'invalid-url' ? t.onboarding.errors.url : undefined,
        consent: code === 'consent-required' ? t.onboarding.errors.consent : undefined,
        biography: code === 'too-long' ? t.onboarding.errors.tooLong : undefined,
        firstName: code === 'missing-required' ? t.onboarding.errors.required : undefined,
      })
      return
    }

    if (!result.persisted) {
      // Valid input, but no backend stored it. Saying "welcome to the network"
      // here would lose a real person's submission behind a success screen.
      capture('onboarding_not_persisted', { country: form.country })
      setStatus('not-saved')
      return
    }

    addMember(result.data)
    capture('onboarding_submitted', {
      country: form.country,
      region: form.region,
      position: form.position,
      interests: form.interestIds.length,
      areas: form.generalAreaIds.length,
      languages: form.languages.length,
    })
    setStatus('done')
  }

  if (status === 'done') {
    return (
      <section id="unete" className="py-(--spacing-section)">
        <div className="mx-auto max-w-2xl px-4 text-center">
          <div className="rounded-3xl border border-verde/25 bg-verde-suave/60 p-10 md:p-14 rise-in">
            <span className="text-5xl" aria-hidden="true">🌱</span>
            <h2 className="mt-4 font-display text-3xl font-semibold">{t.onboarding.successTitle}</h2>
            <p className="mt-3 text-pizarra">{t.onboarding.successText}</p>
            <a
              href="#miembros"
              className="mt-6 inline-block rounded-full bg-verde px-6 py-3 text-sm font-semibold text-blanco"
            >
              {t.onboarding.successCta}
            </a>
          </div>
        </div>
      </section>
    )
  }

  if (status === 'not-saved') {
    return (
      <section id="unete" className="py-(--spacing-section)">
        <div className="mx-auto max-w-2xl px-4 text-center">
          <div className="rounded-3xl border border-rojo/30 bg-rojo/5 p-10 md:p-14 rise-in">
            <span className="text-5xl" aria-hidden="true">⚠</span>
            <h2 className="mt-4 font-display text-3xl font-semibold">
              {t.onboarding.notSavedTitle}
            </h2>
            <p className="mt-3 text-pizarra">{t.onboarding.notSavedText}</p>
            <button
              type="button"
              onClick={() => setStatus('idle')}
              className="mt-6 inline-block rounded-full bg-carbon px-6 py-3 text-sm font-semibold text-blanco"
            >
              {t.onboarding.retry}
            </button>
          </div>
        </div>
      </section>
    )
  }

  const bioLeft = fieldLimits.biography - form.biography.length

  return (
    <section id="unete" aria-labelledby="unete-heading" className="bg-niebla/60 py-(--spacing-section)">
      <div className="mx-auto max-w-3xl px-4 md:px-8">
        <SectionHeading
          id="unete-heading"
          kicker={t.onboarding.kicker}
          title={t.onboarding.title}
          subtitle={t.onboarding.subtitle}
          align="center"
        />

        <div className="rounded-3xl border border-carbon/10 bg-blanco p-6 shadow-xl shadow-carbon/5 md:p-10">
          {/* Stepper */}
          <ol
            className="mb-8 flex items-center gap-2"
            aria-label={`${t.onboarding.step} ${step + 1} ${t.onboarding.of} ${TOTAL_STEPS}`}
          >
            {t.onboarding.steps.map((label, index) => (
              <li key={label} className="flex flex-1 flex-col gap-1.5">
                <span
                  className={`h-1.5 rounded-full transition-colors ${
                    index <= step ? 'bg-teal' : 'bg-carbon/10'
                  }`}
                />
                <span
                  className={`hidden sm:block text-xs font-semibold ${
                    index === step ? 'text-carbon' : 'text-pizarra/70'
                  }`}
                >
                  {index + 1}. {label}
                </span>
              </li>
            ))}
          </ol>

          <form
            noValidate
            onSubmit={(event) => {
              event.preventDefault()
              if (step < LAST_STEP) {
                if (validateStep(step)) setStep(step + 1)
              } else {
                void submit()
              }
            }}
            className="space-y-5"
          >
            {/* Honeypot — hidden from people, catches naive bots. */}
            <input
              type="text"
              name="phone"
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              className="pointer-events-none absolute -left-[9999px] h-0 w-0 opacity-0"
            />

            {step === 0 ? (
              <>
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label={t.onboarding.firstName} error={errors.firstName}>
                    <input
                      className={inputClass}
                      value={form.firstName}
                      onChange={(event) => update('firstName', event.target.value)}
                      placeholder={t.onboarding.firstNamePlaceholder}
                      autoComplete="given-name"
                      maxLength={fieldLimits.firstName}
                    />
                  </Field>
                  <Field label={t.onboarding.lastName} error={errors.lastName}>
                    <input
                      className={inputClass}
                      value={form.lastName}
                      onChange={(event) => update('lastName', event.target.value)}
                      placeholder={t.onboarding.lastNamePlaceholder}
                      autoComplete="family-name"
                      maxLength={fieldLimits.lastName}
                    />
                  </Field>
                </div>
                <Field label={t.onboarding.position} error={errors.position}>
                  <select
                    className={inputClass}
                    value={form.position}
                    onChange={(event) => update('position', event.target.value as PositionType)}
                  >
                    <option value="" disabled>—</option>
                    {options.positionTypes.map((type) => (
                      <option key={type} value={type}>{t.onboarding.positions[type]}</option>
                    ))}
                  </select>
                </Field>
                <Field label={t.onboarding.jobPositionName} error={errors.jobPositionName}>
                  <input
                    className={inputClass}
                    value={form.jobPositionName}
                    onChange={(event) => update('jobPositionName', event.target.value)}
                    placeholder={t.onboarding.jobPositionNamePlaceholder}
                    autoComplete="organization-title"
                    maxLength={fieldLimits.jobPositionName}
                  />
                </Field>
              </>
            ) : null}

            {step === 1 ? (
              <>
                <Field label={t.onboarding.affiliation}>
                  <select
                    className={inputClass}
                    value={form.affiliationId ?? ''}
                    onChange={(event) => update('affiliationId', event.target.value || null)}
                  >
                    <option value="">{t.onboarding.affiliationNone}</option>
                    {institutions.map((institution) => (
                      <option key={institution.id} value={institution.id}>{institution.name}</option>
                    ))}
                  </select>
                </Field>
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label={t.onboarding.country} error={errors.country}>
                    <select
                      className={inputClass}
                      value={form.country}
                      onChange={(event) => {
                        update('country', event.target.value)
                        update('region', '')
                      }}
                    >
                      <option value="" disabled>{t.onboarding.selectCountry}</option>
                      {options.countries.map((country) => (
                        <option key={country.name} value={country.name}>{country.name}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label={t.onboarding.region} error={errors.region}>
                    <select
                      className={inputClass}
                      value={form.region}
                      disabled={!form.country}
                      onChange={(event) => update('region', event.target.value)}
                    >
                      <option value="" disabled>{t.onboarding.selectRegion}</option>
                      {regions.map((region) => (
                        <option key={region} value={region}>{region}</option>
                      ))}
                    </select>
                  </Field>
                </div>
              </>
            ) : null}

            {step === 2 ? (
              <>
                <ChipGroup
                  legend={t.onboarding.interests}
                  hint={t.onboarding.interestsHint}
                  error={errors.interests}
                  options={options.researchInterests}
                  selected={form.interestIds}
                  max={fieldLimits.maxTechnicalInterests}
                  activeClass="bg-verde text-blanco"
                  onToggle={(ids) => update('interestIds', ids)}
                  labelFor={(option) => option[lang]}
                />
                <ChipGroup
                  legend={t.onboarding.generalAreas}
                  hint={t.onboarding.generalAreasHint}
                  error={errors.areas}
                  options={options.generalAreas}
                  selected={form.generalAreaIds}
                  max={fieldLimits.maxGeneralAreas}
                  activeClass="bg-teal text-blanco"
                  onToggle={(ids) => update('generalAreaIds', ids)}
                  labelFor={(option) => option[lang]}
                />
                <ChipGroup
                  legend={t.onboarding.languages}
                  hint={t.onboarding.languagesHint}
                  error={errors.languages}
                  options={options.languageOptions}
                  selected={form.languages}
                  max={fieldLimits.maxLanguages}
                  activeClass="bg-naranja text-carbon"
                  onToggle={(ids) => update('languages', ids)}
                  labelFor={(option) => option[lang]}
                />
              </>
            ) : null}

            {step === LAST_STEP ? (
              <>
                <Field
                  label={t.onboarding.biography}
                  hint={t.onboarding.biographyHint}
                  error={errors.biography}
                >
                  <textarea
                    className={`${inputClass} min-h-32 resize-y`}
                    value={form.biography}
                    onChange={(event) => update('biography', event.target.value)}
                    maxLength={fieldLimits.biography}
                  />
                  <span className="mt-1 block text-right text-xs text-pizarra/70">
                    {bioLeft} {t.onboarding.charsLeft}
                  </span>
                </Field>
                <Field label={t.onboarding.social} error={errors.socialUrl}>
                  <input
                    className={inputClass}
                    type="url"
                    value={form.socialUrl}
                    onChange={(event) => update('socialUrl', event.target.value)}
                    placeholder={t.onboarding.socialPlaceholder}
                    maxLength={fieldLimits.socialUrl}
                  />
                </Field>

                <fieldset className="rounded-2xl border border-carbon/12 bg-niebla/50 p-4">
                  <legend className="px-1 text-sm font-semibold">
                    {t.onboarding.consentTitle}
                  </legend>
                  <label className="flex cursor-pointer gap-3 text-xs leading-relaxed text-pizarra">
                    <input
                      type="checkbox"
                      className="mt-0.5 size-4 shrink-0 accent-teal"
                      checked={form.consentToPublish}
                      onChange={(event) => update('consentToPublish', event.target.checked)}
                    />
                    <span>{t.onboarding.consentLabel}</span>
                  </label>
                  {errors.consent ? (
                    <p role="alert" className="mt-2 text-xs font-medium text-teal-deep">
                      {errors.consent}
                    </p>
                  ) : null}
                </fieldset>
              </>
            ) : null}

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => setStep(Math.max(0, step - 1))}
                disabled={step === 0}
                className="rounded-full border border-carbon/20 px-5 py-2.5 text-sm font-semibold disabled:opacity-40"
              >
                ← {t.onboarding.back}
              </button>
              <button
                type="submit"
                disabled={status === 'submitting'}
                className="rounded-full bg-teal px-6 py-2.5 text-sm font-semibold text-blanco transition-colors hover:bg-teal-deep disabled:opacity-60"
              >
                {status === 'submitting'
                  ? t.onboarding.submitting
                  : step < LAST_STEP
                    ? `${t.onboarding.next} →`
                    : t.onboarding.submit}
              </button>
            </div>
          </form>
        </div>
      </div>
    </section>
  )
}

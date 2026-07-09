import { useMemo, useState, type ReactNode } from 'react'
import { useI18n } from '../../i18n/I18nContext'
import { useApiData } from '../../api/ApiDataContext'
import { SectionHeading } from '../ui/SectionHeading'
import type { IntakeSubmission, PositionType } from '../../api/types'

type Errors = Partial<Record<'fullName' | 'position' | 'country' | 'region' | 'interests' | 'socialUrl', string>>

const emptyForm: IntakeSubmission = {
  fullName: '',
  position: '',
  affiliationId: null,
  country: '',
  region: '',
  interestIds: [],
  socialUrl: '',
  cvFileName: null,
}

const inputClass =
  'w-full rounded-xl border border-carbon/15 bg-white px-4 py-3 text-sm outline-none transition-colors focus:border-teal'

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold">{label}</span>
      {children}
      {error ? (
        <span role="alert" className="mt-1 block text-xs font-medium text-teal-deep">
          {error}
        </span>
      ) : null}
    </label>
  )
}

export function OnboardingForm() {
  const { t, lang } = useI18n()
  const { addMember, submitIntake, institutions, options } = useApiData()
  const [step, setStep] = useState(0)
  const [form, setForm] = useState<IntakeSubmission>(emptyForm)
  const [errors, setErrors] = useState<Errors>({})
  const [status, setStatus] = useState<'idle' | 'submitting' | 'done'>('idle')

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
      if (!form.fullName.trim()) next.fullName = t.onboarding.errors.required
      if (!form.position) next.position = t.onboarding.errors.required
    }
    if (current === 1) {
      if (!form.country) next.country = t.onboarding.errors.required
      if (!form.region) next.region = t.onboarding.errors.required
    }
    if (current === 2) {
      if (form.interestIds.length === 0) next.interests = t.onboarding.errors.interests
      if (form.socialUrl && !/^https?:\/\/.+\..+/.test(form.socialUrl)) {
        next.socialUrl = t.onboarding.errors.url
      }
    }
    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function submit() {
    if (!validateStep(2)) return
    setStatus('submitting')
    const result = await submitIntake(form)
    if (result.success && result.data) {
      addMember(result.data)
      setStatus('done')
    } else {
      setStatus('idle')
      setErrors({ interests: t.onboarding.errors.required })
    }
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
          <ol className="mb-8 flex items-center gap-2" aria-label={`${t.onboarding.step} ${step + 1} ${t.onboarding.of} 3`}>
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
              if (step < 2) {
                if (validateStep(step)) setStep(step + 1)
              } else {
                void submit()
              }
            }}
            className="space-y-5"
          >
            {step === 0 ? (
              <>
                <Field label={t.onboarding.fullName} error={errors.fullName}>
                  <input
                    className={inputClass}
                    value={form.fullName}
                    onChange={(event) => update('fullName', event.target.value)}
                    placeholder={t.onboarding.fullNamePlaceholder}
                    autoComplete="name"
                  />
                </Field>
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
                <fieldset>
                  <legend className="mb-1 text-sm font-semibold">{t.onboarding.interests}</legend>
                  <p className="mb-2.5 text-xs text-pizarra">{t.onboarding.interestsHint}</p>
                  {errors.interests ? (
                    <p role="alert" className="mb-2 text-xs font-medium text-teal-deep">{errors.interests}</p>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    {options.researchInterests.map((interest) => {
                      const checked = form.interestIds.includes(interest.id)
                      return (
                        <label
                          key={interest.id}
                          className={`cursor-pointer rounded-full px-3.5 py-2 text-xs font-semibold transition-colors ${
                            checked ? 'bg-verde text-blanco' : 'border border-carbon/15 text-pizarra hover:border-verde'
                          }`}
                        >
                          <input
                            type="checkbox"
                            className="sr-only"
                            checked={checked}
                            onChange={() =>
                              update(
                                'interestIds',
                                checked
                                  ? form.interestIds.filter((id) => id !== interest.id)
                                  : [...form.interestIds, interest.id],
                              )
                            }
                          />
                          {interest[lang]}
                        </label>
                      )
                    })}
                  </div>
                </fieldset>
                <Field label={t.onboarding.social} error={errors.socialUrl}>
                  <input
                    className={inputClass}
                    type="url"
                    value={form.socialUrl}
                    onChange={(event) => update('socialUrl', event.target.value)}
                    placeholder={t.onboarding.socialPlaceholder}
                  />
                </Field>
                <Field label={`${t.onboarding.cv} · ${t.onboarding.cvHint}`}>
                  <input
                    className={`${inputClass} file:mr-3 file:rounded-full file:border-0 file:bg-carbon file:px-4 file:py-1.5 file:text-xs file:font-semibold file:text-blanco`}
                    type="file"
                    accept=".pdf"
                    onChange={(event) => update('cvFileName', event.target.files?.[0]?.name ?? null)}
                  />
                </Field>
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
                  : step < 2
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

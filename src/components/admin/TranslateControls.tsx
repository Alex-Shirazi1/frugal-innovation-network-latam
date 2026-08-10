import { useState } from 'react'
import { useI18n } from '../../i18n/I18nContext'
import {
  planCompletion,
  translateInto,
  type ContentLang,
  type LocalisedText,
  type TranslateFailure,
} from '../../lib/translate'

export interface CompleteLanguagesProps {
  /** All three boxes for this field, so the source can be whichever is filled. */
  value: LocalisedText
  /** Receives only the languages that came back. */
  onFilled: (values: LocalisedText) => void
}

/**
 * "Fill in the missing languages" for one field group.
 *
 * The only way translation happens. An earlier version also ran on blur behind
 * a preference, which meant network requests fired from tabbing through a form
 * and the two paths raced each other for the same text. Pressing a button is
 * the whole feature now: write one box, press, read what came back.
 *
 * Fills the inputs; it never saves. That separation is the point — a machine
 * translation reaching the public site without anyone reading it is a worse
 * outcome than a bit of typing, and this network's audience is academic.
 *
 * Disabled until a box has something in it, and again once nothing is left to
 * fill, so its state answers "is there anything for this to do" on sight.
 */
export function CompleteLanguagesButton({ value, onFilled }: CompleteLanguagesProps) {
  const { t } = useI18n()
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<TranslateFailure | null>(null)

  const plan = planCompletion(value)
  const nothingWritten = !Object.values(value).some((entry) => entry?.trim())

  async function run() {
    if (!plan) return
    setBusy(true)
    setFailure(null)
    try {
      const { values, failure: why } = await translateInto(
        value[plan.from] ?? '',
        plan.from,
        plan.targets,
      )
      if (Object.keys(values).length > 0) onFilled(values)
      setFailure(why)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-1.5">
      <button
        type="button"
        onClick={() => void run()}
        disabled={busy || !plan}
        className="rounded-full border border-teal/40 px-3 py-1 text-[11px] font-semibold text-teal transition-colors hover:bg-teal/10 disabled:opacity-40"
      >
        {busy ? t.admin.editor.translating : `↺ ${t.admin.editor.completeLanguages}`}
      </button>
      {/* Explains the disabled state rather than leaving it to be guessed. */}
      {nothingWritten ? (
        <span className="ml-2 text-[11px] text-pizarra">{t.admin.editor.translateNeedsText}</span>
      ) : null}
      {failure ? (
        <p role="alert" className="mt-1 text-[11px] font-medium text-rojo">
          {failure === 'quota'
            ? t.admin.editor.translateQuota
            : failure === 'too-long'
              ? t.admin.editor.translateTooLong
              : t.admin.editor.translateFailed}
        </p>
      ) : null}
    </div>
  )
}

/** The note under a field that a machine, not a person, wrote its contents. */
export function MachineTranslatedNote() {
  const { t } = useI18n()
  return (
    <p className="mt-1 text-[11px] font-medium text-naranja">
      {t.admin.editor.machineTranslated}
    </p>
  )
}

export type { ContentLang }

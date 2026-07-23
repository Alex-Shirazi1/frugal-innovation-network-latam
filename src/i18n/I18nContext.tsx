import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { usePostHog } from 'posthog-js/react'
import { es, en, pt, type Dictionary } from './translations'

export type Lang = 'es' | 'en' | 'pt'

interface I18nValue {
  lang: Lang
  setLang: (lang: Lang) => void
  t: Dictionary
}

const I18nContext = createContext<I18nValue | null>(null)

const dictionaries: Record<Lang, Dictionary> = { es, en, pt }
const STORAGE_KEY = 'relif-lang'

function getInitialLang(): Lang {
  const stored = window.localStorage.getItem(STORAGE_KEY)
  return stored === 'en' || stored === 'es' || stored === 'pt' ? stored : 'es'
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(getInitialLang)
  const posthog = usePostHog()

  const value = useMemo<I18nValue>(
    () => ({
      lang,
      setLang: (next: Lang) => {
        if (next !== lang) {
          posthog?.capture('language_switched', { from: lang, to: next })
        }
        setLangState(next)
        window.localStorage.setItem(STORAGE_KEY, next)
        document.documentElement.lang = next
      },
      t: dictionaries[lang],
    }),
    [lang, posthog],
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext)
  if (!ctx) {
    throw new Error('useI18n must be used within I18nProvider')
  }
  return ctx
}

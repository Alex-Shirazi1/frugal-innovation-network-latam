import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, act, renderHook } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nProvider, useI18n } from './I18nContext'

const STORAGE_KEY = 'relif-lang'

// Small consumer that surfaces the active language and its dictionary so tests
// can observe context changes through the rendered DOM.
function LangProbe() {
  const { lang, setLang, t } = useI18n()
  return (
    <div>
      <span data-testid="lang">{lang}</span>
      <span data-testid="join-label">{t.nav.join}</span>
      <button onClick={() => setLang('en')}>to-en</button>
      <button onClick={() => setLang('pt')}>to-pt</button>
    </div>
  )
}

describe('I18nProvider / useI18n', () => {
  beforeEach(() => {
    window.localStorage.clear()
    document.documentElement.lang = ''
  })

  it('defaults to Spanish when nothing is stored', () => {
    render(
      <I18nProvider>
        <LangProbe />
      </I18nProvider>,
    )
    expect(screen.getByTestId('lang')).toHaveTextContent('es')
    expect(screen.getByTestId('join-label')).toHaveTextContent('Únete a la Red')
  })

  it('hydrates the initial language from localStorage', () => {
    window.localStorage.setItem(STORAGE_KEY, 'pt')
    render(
      <I18nProvider>
        <LangProbe />
      </I18nProvider>,
    )
    expect(screen.getByTestId('lang')).toHaveTextContent('pt')
  })

  it('ignores an invalid stored language and falls back to Spanish', () => {
    window.localStorage.setItem(STORAGE_KEY, 'fr')
    render(
      <I18nProvider>
        <LangProbe />
      </I18nProvider>,
    )
    expect(screen.getByTestId('lang')).toHaveTextContent('es')
  })

  it('switches language, swaps the dictionary, and persists the choice', async () => {
    const user = userEvent.setup()
    render(
      <I18nProvider>
        <LangProbe />
      </I18nProvider>,
    )

    await user.click(screen.getByRole('button', { name: 'to-en' }))

    expect(screen.getByTestId('lang')).toHaveTextContent('en')
    expect(screen.getByTestId('join-label')).toHaveTextContent('Join the Network')
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('en')
    expect(document.documentElement.lang).toBe('en')
  })

  it('throws a helpful error when used outside the provider', () => {
    expect(() => renderHook(() => useI18n())).toThrow(
      'useI18n must be used within I18nProvider',
    )
  })

  it('provides a stable setLang across renders that still updates state', () => {
    const { result, rerender } = renderHook(() => useI18n(), {
      wrapper: I18nProvider,
    })
    const firstSetLang = result.current.setLang
    rerender()
    expect(result.current.setLang).toBe(firstSetLang)

    act(() => result.current.setLang('pt'))
    expect(result.current.lang).toBe('pt')
  })
})

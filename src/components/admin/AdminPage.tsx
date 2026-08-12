import { useCallback, useEffect, useState } from 'react'
import { adminApi, type AdminSession } from '../../api/adminApi'
import { AdminHeader } from './AdminHeader'
import { InitiativesEditor } from './InitiativesEditor'
import { BibliographyEditor } from './BibliographyEditor'
import { CongressEditor } from './CongressEditor'
import { MembersEditor } from './MembersEditor'
import { useI18n } from '../../i18n/I18nContext'
import { useIdleTimeout } from '../../hooks/useIdleTimeout'

const inputClass =
  'w-full rounded-xl border border-carbon/15 bg-white px-4 py-3 text-sm outline-none transition-colors focus:border-teal'

/**
 * Sign-in gate: one address and one password, for both backends.
 *
 * There is deliberately no "sign in with Google" here. The network has a single
 * shared mailbox rather than a set of named moderators, so identity through a
 * personal Google account modelled a distinction that does not exist — and it
 * meant whoever held the panel had to have a Google account at all. Firebase
 * Auth's email/password provider keeps the same security boundary: the password
 * is hashed on Firebase's side and never enters this bundle, and the `admin`
 * custom claim that firestore.rules actually checks is still what authorises.
 */
interface LoginGateProps {
  onSignedIn: (session: AdminSession) => void
  /** Set when the previous session ended on its own, so the gate can say why. */
  timedOut: boolean
}

function LoginGate({ onSignedIn, timedOut }: LoginGateProps) {
  const { t } = useI18n()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState<'idle' | 'checking' | 'failed' | 'denied'>('idle')

  async function attempt() {
    setStatus('checking')
    try {
      onSignedIn(await adminApi.signIn({ email, password }))
    } catch (error: unknown) {
      setStatus(error instanceof Error && error.message === 'unauthorized' ? 'denied' : 'failed')
    }
  }

  return (
    <div className="mx-auto max-w-sm px-4 pt-24">
      <h1 className="font-display text-2xl font-semibold text-carbon">{t.admin.signInTitle}</h1>
      <p className="mt-2 text-sm text-pizarra">{t.admin.signInLede}</p>

      {/* Shown before any attempt, so an automatic sign-out does not read as a
          fault. Suppressed once the person starts interacting with the form. */}
      {timedOut && status === 'idle' ? (
        <p role="status" className="mt-4 text-xs font-medium text-pizarra">
          {t.admin.signedOutIdle}
        </p>
      ) : null}

      <form
        onSubmit={(event) => {
          event.preventDefault()
          if (email && password) void attempt()
        }}
        className="mt-6 space-y-3"
      >
        <input
          type="email"
          className={inputClass}
          value={email}
          onChange={(event) => {
            setEmail(event.target.value)
            setStatus('idle')
          }}
          placeholder={t.admin.emailLabel}
          autoComplete="username"
          aria-label={t.admin.emailLabel}
        />
        <input
          type="password"
          className={inputClass}
          value={password}
          onChange={(event) => {
            setPassword(event.target.value)
            setStatus('idle')
          }}
          placeholder={t.admin.passwordLabel}
          autoComplete="current-password"
          aria-label={t.admin.passwordLabel}
        />
        <button
          type="submit"
          disabled={status === 'checking' || !email || !password}
          className="w-full rounded-full bg-teal px-6 py-3 text-sm font-bold text-blanco transition-colors hover:bg-teal-deep disabled:opacity-50"
        >
          {status === 'checking' ? t.admin.checking : t.admin.signIn}
        </button>
      </form>

      {status === 'denied' ? (
        <p role="alert" className="mt-4 text-xs font-medium text-teal-deep">
          {t.admin.signInDenied}
        </p>
      ) : null}
      {status === 'failed' ? (
        <p role="alert" className="mt-4 text-xs font-medium text-teal-deep">
          {t.admin.signInFailed}
        </p>
      ) : null}
    </div>
  )
}

/**
 * What the network maintains itself: three content sections, plus the directory.
 *
 * There is still deliberately no approve-or-deny screen, and the distinction
 * matters. Joining is a conversation, not a button: the public form's whole job
 * is to put an email in the network's inbox, after which someone writes back, has
 * a call, and — if it is a fit — sends the private incorporation form. Filling in
 * THAT form is what creates a profile.
 *
 * The members tab is the far end of that process, not a gate in front of it. It
 * publishes responses from the incorporation form, which by definition come from
 * people already vetted offline, and it can correct or remove a profile
 * afterwards. Admission is never the decision being taken on this screen.
 *
 * Site-form submissions remain stored and admin-readable (`listPending` in
 * adminApi, exercised by the adapter tests) and still have no screen of their
 * own — they are interest, not applications. That is the recovery path if a
 * notification email is ever missed.
 *
 * `labelKey` rather than a label: the ids are stable state, the words are not.
 */
const TABS = [
  { id: 'iniciativas', labelKey: 'initiatives' },
  { id: 'bibliografia', labelKey: 'bibliography' },
  { id: 'congreso', labelKey: 'congress' },
  { id: 'miembros', labelKey: 'members' },
] as const

type TabId = (typeof TABS)[number]['id']

export function AdminPage() {
  const { t } = useI18n()
  const [tab, setTab] = useState<TabId>('iniciativas')
  const [session, setSession] = useState<AdminSession | null>(null)
  const [restoring, setRestoring] = useState(true)
  const [timedOut, setTimedOut] = useState(false)

  /*
   * One sign-out path for the button and the idle timeout alike. Both clear the
   * Firebase session rather than only the local state: dropping `session` would
   * hide the panel while leaving a valid, self-refreshing token in the browser,
   * which is the appearance of signing out without the fact of it.
   */
  const endSession = useCallback(async (reason: 'user' | 'idle') => {
    await adminApi.signOut().catch(() => undefined)
    setTimedOut(reason === 'idle')
    setSession(null)
  }, [])

  // Only armed while signed in, so the listeners are absent on the login gate.
  useIdleTimeout(
    useCallback(() => void endSession('idle'), [endSession]),
    session !== null,
  )

  // Restore an existing session (Firebase auth state, or the dev key) on load.
  useEffect(() => {
    let cancelled = false
    void adminApi
      .restore()
      .then((restored) => {
        if (!cancelled) setSession(restored)
      })
      .catch(() => {
        if (!cancelled) setSession(null)
      })
      .finally(() => {
        if (!cancelled) setRestoring(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (restoring) {
    return (
      <main className="min-h-screen bg-niebla/60">
        <AdminHeader />
        <p className="pt-24 text-center text-sm text-pizarra">{t.admin.restoringSession}</p>
      </main>
    )
  }

  if (!session) {
    return (
      <main className="min-h-screen bg-niebla/60">
        <AdminHeader />
        <LoginGate
          onSignedIn={(next) => {
            setTimedOut(false)
            setSession(next)
          }}
          timedOut={timedOut}
        />
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-niebla/60 pb-20">
      <AdminHeader />
      <div className="mx-auto max-w-3xl px-4 pt-10">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-teal">
              {t.admin.kicker}
            </p>
            <h1 className="mt-1 font-display text-3xl font-semibold text-carbon">
              {t.admin.title}
            </h1>
            <p className="mt-1 text-xs text-pizarra">{session.label}</p>
          </div>
          <button
            type="button"
            onClick={() => void endSession('user')}
            className="rounded-full border border-carbon/15 px-4 py-2 text-xs font-semibold text-pizarra hover:border-teal-deep hover:text-teal-deep"
          >
            {t.admin.signOut}
          </button>
        </div>

        <div
          className="mt-6 flex flex-wrap gap-1.5"
          role="tablist"
          aria-label={t.admin.sectionsLabel}
        >
          {TABS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              role="tab"
              aria-selected={tab === entry.id}
              onClick={() => setTab(entry.id)}
              className={`rounded-full px-4 py-2 text-xs font-semibold transition-colors ${
                tab === entry.id
                  ? 'bg-carbon text-blanco'
                  : 'border border-carbon/15 text-pizarra hover:border-carbon/35'
              }`}
            >
              {t.admin.tabs[entry.labelKey]}
            </button>
          ))}
        </div>

        {/* Every section here writes through firestore.rules, which the Express
            prototype has no equivalent for. Reads still work on any adapter, so
            the public site is unaffected by which backend is configured. */}
        {session.backend !== 'firestore' ? (
          <p className="mt-8 rounded-2xl border border-dashed border-carbon/25 p-6 text-sm text-pizarra">
            {t.admin.contentNeedsFirebase}
          </p>
        ) : (
          <div className="mt-8">
            {tab === 'iniciativas' ? <InitiativesEditor /> : null}
            {tab === 'bibliografia' ? <BibliographyEditor /> : null}
            {tab === 'congreso' ? <CongressEditor /> : null}
            {tab === 'miembros' ? <MembersEditor /> : null}
          </div>
        )}

        <p className="mt-12 text-center text-xs text-pizarra/70">
          {t.admin.footerNote}{' '}
          <a href="/" className="font-semibold text-teal hover:underline">
            ← {t.admin.backToSite}
          </a>
        </p>
      </div>
    </main>
  )
}

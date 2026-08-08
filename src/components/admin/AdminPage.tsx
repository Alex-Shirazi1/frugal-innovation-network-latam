import { useCallback, useEffect, useState } from 'react'
import { adminApi, type AdminSession } from '../../api/adminApi'
import { InitiativesEditor } from './InitiativesEditor'
import { BibliographyEditor } from './BibliographyEditor'
import { ResourcesEditor } from './ResourcesEditor'
import { CongressEditor } from './CongressEditor'
import type { PendingMember } from '../../api/types'
import {
  generalAreas,
  languageOptions,
  placeLabel,
  researchInterests,
} from '../../data/onboardingOptions'
import { institutions } from '../../data/institutions'

const inputClass =
  'w-full rounded-xl border border-carbon/15 bg-white px-4 py-3 text-sm outline-none transition-colors focus:border-teal'

function labelFrom(list: { id: string; es: string }[], id: string): string {
  return list.find((entry) => entry.id === id)?.es ?? id
}

function institutionLabel(id: string | null): string {
  if (!id) return 'Miembro independiente'
  return institutions.find((i) => i.id === id)?.name ?? id
}

/**
 * Sign-in gate. On the hosted deployment this is Google sign-in gated by an
 * `admin` custom claim; a static site cannot hold a shared secret, so the key
 * form only appears when running against the local Express backend.
 */
function LoginGate({ onSignedIn }: { onSignedIn: (session: AdminSession) => void }) {
  const backend = adminApi.backend()
  const [key, setKey] = useState('')
  const [status, setStatus] = useState<'idle' | 'checking' | 'failed' | 'denied'>('idle')

  async function attempt(secret?: string) {
    setStatus('checking')
    try {
      onSignedIn(await adminApi.signIn(secret))
    } catch (error: unknown) {
      setStatus(error instanceof Error && error.message === 'unauthorized' ? 'denied' : 'failed')
    }
  }

  return (
    <div className="mx-auto max-w-sm pt-32 px-4">
      <h1 className="font-display text-2xl font-semibold text-carbon">Panel de administración</h1>

      {backend === 'firestore' ? (
        <>
          <p className="mt-2 text-sm text-pizarra">
            Acceso restringido a moderadores autorizados de la red.
          </p>
          <button
            type="button"
            onClick={() => void attempt()}
            disabled={status === 'checking'}
            className="mt-6 w-full rounded-full bg-teal px-6 py-3 text-sm font-bold text-blanco transition-colors hover:bg-teal-deep disabled:opacity-50"
          >
            {status === 'checking' ? 'Verificando…' : 'Entrar con Google'}
          </button>
        </>
      ) : (
        <>
          <p className="mt-2 text-sm text-pizarra">
            Backend local — ingresa la clave de administración.
          </p>
          <form
            onSubmit={(event) => {
              event.preventDefault()
              if (key) void attempt(key)
            }}
            className="mt-6 space-y-4"
          >
            <input
              type="password"
              className={inputClass}
              value={key}
              onChange={(event) => {
                setKey(event.target.value)
                setStatus('idle')
              }}
              placeholder="Clave de administración"
              autoComplete="current-password"
              aria-label="Clave de administración"
            />
            <button
              type="submit"
              disabled={status === 'checking' || !key}
              className="w-full rounded-full bg-teal px-6 py-3 text-sm font-bold text-blanco transition-colors hover:bg-teal-deep disabled:opacity-50"
            >
              {status === 'checking' ? 'Verificando…' : 'Entrar'}
            </button>
          </form>
        </>
      )}

      {status === 'denied' ? (
        <p role="alert" className="mt-4 text-xs font-medium text-teal-deep">
          Esta cuenta no tiene permisos de moderación.
        </p>
      ) : null}
      {status === 'failed' ? (
        <p role="alert" className="mt-4 text-xs font-medium text-teal-deep">
          No se pudo iniciar sesión. Revisa la configuración o intenta de nuevo.
        </p>
      ) : null}
    </div>
  )
}

/**
 * One received expression of interest.
 *
 * There is deliberately no approve button. The network does not admit members
 * from this screen — someone reads the notification email, writes to the
 * person, has a conversation, asks for their organisation's logo and letter,
 * and only then sends the official Google Form. Filling in that form is what
 * creates a profile. A publish button here would model a step nobody performs,
 * and would let one click put someone on the public site ahead of the process
 * that is supposed to vet them.
 *
 * Discarding is kept, because spam arrives and the list needs a way to stay
 * readable. It removes a record; it does not deny anyone membership.
 */
function PendingCard({
  entry,
  onDiscard,
}: {
  entry: PendingMember
  onDiscard: (id: string) => Promise<void>
}) {
  const [busy, setBusy] = useState(false)

  async function discard() {
    if (
      !window.confirm(
        `¿Descartar la solicitud de ${entry.fullName}? Se borra el registro; no afecta al sitio público.`,
      )
    ) {
      return
    }
    setBusy(true)
    try {
      await onDiscard(entry.id)
    } finally {
      setBusy(false)
    }
  }

  return (
    <li className="rounded-2xl border border-carbon/10 bg-white/80 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">{entry.fullName}</h3>
          <p className="text-xs text-pizarra">{entry.title.es}</p>
          {entry.jobPositionName ? (
            <p className="text-xs font-medium text-carbon">{entry.jobPositionName}</p>
          ) : null}
          {/* The queue's whole purpose is to start a conversation, so the
              address is a link rather than text to copy out by hand. */}
          {entry.email ? (
            <a
              href={`mailto:${entry.email}`}
              className="mt-1 block text-xs font-medium text-teal hover:underline"
            >
              {entry.email}
            </a>
          ) : null}
          <p className="mt-1 text-xs text-pizarra">
            {institutionLabel(entry.affiliationId)} · {placeLabel(entry.region, 'es')},{' '}
            {placeLabel(entry.country, 'es')}
          </p>
        </div>
        <time className="text-[11px] text-pizarra" dateTime={entry.createdAt}>
          {new Date(entry.createdAt).toLocaleString('es-MX')}
        </time>
      </div>

      {entry.biography ? (
        <p className="mt-3 text-xs leading-relaxed text-pizarra">{entry.biography}</p>
      ) : null}

      <ul className="mt-3 flex flex-wrap gap-1.5">
        {entry.interestIds.map((id) => (
          <li
            key={id}
            className="rounded-full bg-verde/12 px-2.5 py-1 text-[11px] font-medium text-[#5d8523]"
          >
            {labelFrom(researchInterests, id)}
          </li>
        ))}
        {entry.generalAreaIds.map((id) => (
          <li
            key={id}
            className="rounded-full bg-teal/10 px-2.5 py-1 text-[11px] font-medium text-teal-deep"
          >
            {labelFrom(generalAreas, id)}
          </li>
        ))}
      </ul>

      <div className="mt-3 flex flex-wrap items-center gap-4 text-xs">
        {entry.languages.length > 0 ? (
          <span className="text-pizarra">
            Idiomas: {entry.languages.map((id) => labelFrom(languageOptions, id)).join(' · ')}
          </span>
        ) : null}
        {entry.socialUrl ? (
          <a
            href={entry.socialUrl}
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-teal hover:underline"
          >
            ↗ {entry.socialUrl.replace(/^https?:\/\//, '')}
          </a>
        ) : null}
      </div>

      <div className="mt-4 flex gap-2">
        <a
          href={`mailto:${entry.email}?subject=${encodeURIComponent('Red Latinoamericana de Innovación Frugal')}`}
          className="rounded-full bg-teal px-5 py-2 text-xs font-bold text-blanco transition-colors hover:bg-teal-deep"
        >
          ✉ Escribir a esta persona
        </a>
        <button
          type="button"
          disabled={busy}
          onClick={() => void discard()}
          className="rounded-full border border-carbon/20 px-5 py-2 text-xs font-bold text-pizarra transition-colors hover:border-teal-deep hover:text-teal-deep disabled:opacity-50"
        >
          {busy ? 'Descartando…' : 'Descartar'}
        </button>
      </div>
    </li>
  )
}

/**
 * The panel's three jobs. Membership was the original one; the other two are
 * the sections Allan asked to maintain himself, and they only exist on the
 * Firestore backend — the Express prototype has no write path for content.
 */
const TABS = [
  { id: 'solicitudes', label: 'Solicitudes' },
  { id: 'iniciativas', label: 'Iniciativas' },
  { id: 'documentos', label: 'Documentos' },
  { id: 'bibliografia', label: 'Bibliografía' },
  { id: 'congreso', label: 'Congreso' },
] as const

type TabId = (typeof TABS)[number]['id']

export function AdminPage() {
  const [tab, setTab] = useState<TabId>('solicitudes')
  const [session, setSession] = useState<AdminSession | null>(null)
  const [restoring, setRestoring] = useState(true)
  const [pending, setPending] = useState<PendingMember[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      setPending(await adminApi.listPending())
      setError(null)
    } catch (err: unknown) {
      if (err instanceof Error && err.message === 'unauthorized') {
        await adminApi.signOut()
        setSession(null)
      } else {
        setError('No se pudo cargar la cola de solicitudes. Intenta de nuevo.')
      }
    }
  }, [])

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

  useEffect(() => {
    if (session) void refresh()
  }, [session, refresh])

  async function discard(id: string) {
    try {
      await adminApi.reject(id)
      setPending((prev) => prev?.filter((entry) => entry.id !== id) ?? null)
    } catch {
      setError('No se pudo descartar — recarga e intenta de nuevo.')
    }
  }

  if (restoring) {
    return (
      <main className="min-h-screen bg-niebla/60">
        <p className="pt-32 text-center text-sm text-pizarra">Verificando sesión…</p>
      </main>
    )
  }

  if (!session) {
    return (
      <main className="min-h-screen bg-niebla/60">
        <LoginGate onSignedIn={setSession} />
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-niebla/60 pb-20">
      <div className="mx-auto max-w-3xl px-4 pt-16">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-teal">
              RELIF · Administración
            </p>
            <h1 className="mt-1 font-display text-3xl font-semibold text-carbon">
              Administración del sitio
            </h1>
            <p className="mt-1 text-xs text-pizarra">{session.label}</p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void refresh()}
              className="rounded-full border border-carbon/15 px-4 py-2 text-xs font-semibold text-pizarra hover:border-teal hover:text-teal"
            >
              ⟳ Actualizar
            </button>
            <button
              type="button"
              onClick={() => {
                void adminApi.signOut().then(() => setSession(null))
              }}
              className="rounded-full border border-carbon/15 px-4 py-2 text-xs font-semibold text-pizarra hover:border-teal-deep hover:text-teal-deep"
            >
              Salir
            </button>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-1.5" role="tablist" aria-label="Secciones">
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
              {entry.label}
            </button>
          ))}
        </div>

        {tab !== 'solicitudes' && session.backend !== 'firestore' ? (
          <p className="mt-8 rounded-2xl border border-dashed border-carbon/25 p-6 text-sm text-pizarra">
            La edición de contenido requiere el backend de Firebase. Este panel está conectado al
            servidor local de desarrollo, que sólo administra solicitudes.
          </p>
        ) : null}

        {tab === 'iniciativas' && session.backend === 'firestore' ? (
          <div className="mt-8">
            <InitiativesEditor />
          </div>
        ) : null}

        {tab === 'documentos' && session.backend === 'firestore' ? (
          <div className="mt-8">
            <ResourcesEditor />
          </div>
        ) : null}

        {tab === 'congreso' && session.backend === 'firestore' ? (
          <div className="mt-8">
            <CongressEditor />
          </div>
        ) : null}

        {tab === 'bibliografia' && session.backend === 'firestore' ? (
          <div className="mt-8">
            <BibliographyEditor />
          </div>
        ) : null}

        {error && tab === 'solicitudes' ? (
          <p
            role="alert"
            className="mt-6 rounded-xl border border-naranja/40 bg-naranja/10 p-4 text-sm text-carbon"
          >
            {error}
          </p>
        ) : null}

        {tab === 'solicitudes' && pending === null && !error ? (
          <p className="mt-10 text-sm text-pizarra">Cargando solicitudes…</p>
        ) : null}

        {tab === 'solicitudes' && pending !== null && pending.length === 0 ? (
          <p className="mt-10 rounded-2xl border border-dashed border-carbon/20 p-10 text-center text-sm text-pizarra">
            No hay solicitudes pendientes.
          </p>
        ) : null}

        {tab === 'solicitudes' && pending !== null && pending.length > 0 ? (
          <>
            <p className="mt-6 text-sm text-pizarra" role="status">
              {pending.length} solicitud{pending.length === 1 ? '' : 'es'} recibida
              {pending.length === 1 ? '' : 's'}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-pizarra">
              Cada persona de esta lista escribió al sitio para presentarse. El siguiente paso es
              escribirle y conversar; el perfil público se crea después, con el formulario de
              incorporación.
            </p>
            <ul className="mt-4 space-y-4">
              {pending.map((entry) => (
                <PendingCard key={entry.id} entry={entry} onDiscard={discard} />
              ))}
            </ul>
          </>
        ) : null}

        <p className="mt-12 text-center text-xs text-pizarra/70">
          Los perfiles del directorio se crean con el formulario de incorporación, no desde aquí.{' '}
          <a href="/" className="font-semibold text-teal hover:underline">
            ← Volver al sitio
          </a>
        </p>
      </div>
    </main>
  )
}

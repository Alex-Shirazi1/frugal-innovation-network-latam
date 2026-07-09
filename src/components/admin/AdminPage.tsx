import { useCallback, useEffect, useState } from 'react'
import { adminApi, type PendingMember } from '../../api/adminApi'
import { researchInterests } from '../../data/onboardingOptions'
import { institutions } from '../../data/institutions'

const KEY_STORAGE = 'relif-admin-key'

const inputClass =
  'w-full rounded-xl border border-carbon/15 bg-white px-4 py-3 text-sm outline-none transition-colors focus:border-teal'

function interestLabel(id: string): string {
  return researchInterests.find((i) => i.id === id)?.es ?? id
}

function institutionLabel(id: string | null): string {
  if (!id) return 'Miembro independiente'
  return institutions.find((i) => i.id === id)?.name ?? id
}

function LoginGate({ onAuthenticated }: { onAuthenticated: (key: string) => void }) {
  const [key, setKey] = useState('')
  const [status, setStatus] = useState<'idle' | 'checking' | 'failed'>('idle')

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!key) return
    setStatus('checking')
    try {
      await adminApi.login(key)
      sessionStorage.setItem(KEY_STORAGE, key)
      onAuthenticated(key)
    } catch {
      setStatus('failed')
    }
  }

  return (
    <div className="mx-auto max-w-sm pt-32 px-4">
      <h1 className="font-display text-2xl font-semibold text-carbon">Panel de administración</h1>
      <p className="mt-2 text-sm text-pizarra">
        Acceso restringido — ingresa la clave de administración.
      </p>
      <form onSubmit={submit} className="mt-6 space-y-4">
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
        {status === 'failed' ? (
          <p role="alert" className="text-xs font-medium text-teal-deep">
            Clave incorrecta o servidor no disponible.
          </p>
        ) : null}
        <button
          type="submit"
          disabled={status === 'checking' || !key}
          className="w-full rounded-full bg-teal px-6 py-3 text-sm font-bold text-blanco transition-colors hover:bg-teal-deep disabled:opacity-50"
        >
          {status === 'checking' ? 'Verificando…' : 'Entrar'}
        </button>
      </form>
    </div>
  )
}

function PendingCard({
  entry,
  onResolve,
}: {
  entry: PendingMember
  onResolve: (id: string, action: 'approve' | 'reject') => Promise<void>
}) {
  const [busy, setBusy] = useState<'approve' | 'reject' | null>(null)

  async function act(action: 'approve' | 'reject') {
    setBusy(action)
    try {
      await onResolve(entry.id, action)
    } finally {
      setBusy(null)
    }
  }

  return (
    <li className="rounded-2xl border border-carbon/10 bg-white/80 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">{entry.fullName}</h3>
          <p className="text-xs text-pizarra">{entry.title}</p>
          <p className="mt-1 text-xs text-pizarra">
            {institutionLabel(entry.affiliationId)} · {entry.region}, {entry.country}
          </p>
        </div>
        <time className="text-[11px] text-pizarra" dateTime={entry.createdAt}>
          {new Date(entry.createdAt).toLocaleString('es-MX')}
        </time>
      </div>

      <ul className="mt-3 flex flex-wrap gap-1.5">
        {entry.interestIds.map((id) => (
          <li key={id} className="rounded-full bg-niebla px-2.5 py-1 text-[11px] font-medium text-pizarra">
            {interestLabel(id)}
          </li>
        ))}
      </ul>

      <div className="mt-3 flex flex-wrap items-center gap-4 text-xs">
        {entry.socialUrl ? (
          <a href={entry.socialUrl} target="_blank" rel="noreferrer" className="font-semibold text-teal hover:underline">
            ↗ {entry.socialUrl.replace(/^https?:\/\//, '')}
          </a>
        ) : null}
        {entry.cvFileName ? <span className="text-pizarra">CV: {entry.cvFileName}</span> : null}
      </div>

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => void act('approve')}
          className="rounded-full bg-verde px-5 py-2 text-xs font-bold text-blanco transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {busy === 'approve' ? 'Aprobando…' : '✓ Aprobar'}
        </button>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => void act('reject')}
          className="rounded-full border border-carbon/20 px-5 py-2 text-xs font-bold text-pizarra transition-colors hover:border-teal-deep hover:text-teal-deep disabled:opacity-50"
        >
          {busy === 'reject' ? 'Rechazando…' : '✕ Rechazar'}
        </button>
      </div>
    </li>
  )
}

export function AdminPage() {
  const [adminKey, setAdminKey] = useState<string | null>(() => sessionStorage.getItem(KEY_STORAGE))
  const [pending, setPending] = useState<PendingMember[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async (key: string) => {
    try {
      setPending(await adminApi.listPending(key))
      setError(null)
    } catch (err: unknown) {
      if (err instanceof Error && err.message === 'unauthorized') {
        sessionStorage.removeItem(KEY_STORAGE)
        setAdminKey(null)
      } else {
        setError('No se pudo contactar al servidor. ¿Está corriendo el backend?')
      }
    }
  }, [])

  useEffect(() => {
    if (adminKey) void refresh(adminKey)
  }, [adminKey, refresh])

  if (!adminKey) {
    return (
      <main className="min-h-screen bg-niebla/60">
        <LoginGate onAuthenticated={setAdminKey} />
      </main>
    )
  }

  async function resolve(id: string, action: 'approve' | 'reject') {
    if (!adminKey) return
    try {
      if (action === 'approve') await adminApi.approve(adminKey, id)
      else await adminApi.reject(adminKey, id)
      setPending((prev) => prev?.filter((entry) => entry.id !== id) ?? null)
    } catch {
      setError('La acción falló — recarga e intenta de nuevo.')
    }
  }

  return (
    <main className="min-h-screen bg-niebla/60 pb-20">
      <div className="mx-auto max-w-3xl px-4 pt-16">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-teal">RELIF · Administración</p>
            <h1 className="mt-1 font-display text-3xl font-semibold text-carbon">
              Solicitudes de membresía
            </h1>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void refresh(adminKey)}
              className="rounded-full border border-carbon/15 px-4 py-2 text-xs font-semibold text-pizarra hover:border-teal hover:text-teal"
            >
              ⟳ Actualizar
            </button>
            <button
              type="button"
              onClick={() => {
                sessionStorage.removeItem(KEY_STORAGE)
                setAdminKey(null)
              }}
              className="rounded-full border border-carbon/15 px-4 py-2 text-xs font-semibold text-pizarra hover:border-teal-deep hover:text-teal-deep"
            >
              Salir
            </button>
          </div>
        </div>

        {error ? (
          <p role="alert" className="mt-6 rounded-xl border border-naranja/40 bg-naranja/10 p-4 text-sm text-carbon">
            {error}
          </p>
        ) : null}

        {pending === null && !error ? (
          <p className="mt-10 text-sm text-pizarra">Cargando solicitudes…</p>
        ) : null}

        {pending !== null && pending.length === 0 ? (
          <p className="mt-10 rounded-2xl border border-dashed border-carbon/20 p-10 text-center text-sm text-pizarra">
            No hay solicitudes pendientes. 🎉
          </p>
        ) : null}

        {pending !== null && pending.length > 0 ? (
          <>
            <p className="mt-6 text-sm text-pizarra" role="status">
              {pending.length} solicitud{pending.length === 1 ? '' : 'es'} pendiente
              {pending.length === 1 ? '' : 's'}
            </p>
            <ul className="mt-4 space-y-4">
              {pending.map((entry) => (
                <PendingCard key={entry.id} entry={entry} onResolve={resolve} />
              ))}
            </ul>
          </>
        ) : null}

        <p className="mt-12 text-center text-xs text-pizarra/70">
          Los miembros aprobados aparecen inmediatamente en el directorio público.{' '}
          <a href="/" className="font-semibold text-teal hover:underline">
            ← Volver al sitio
          </a>
        </p>
      </div>
    </main>
  )
}

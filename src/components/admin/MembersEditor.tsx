/**
 * The members tab.
 *
 * Ordered by how the network actually works. The incorporation form is the
 * primary path — someone is vetted offline, sent the private form, and their
 * response arrives here already mapped — so arrived responses sit at the top and
 * are the first thing a moderator sees. Manual add and edit are underneath,
 * secondary by placement as well as by intent.
 *
 * Publishing an arrived response reuses the response's own document id, which is
 * what marks it handled: the response itself is immutable and is kept, because it
 * holds the reply address that `members` deliberately does not.
 */
import { useCallback, useEffect, useState } from 'react'
import { membersAdmin, type AdminMember, type ArrivedResponse } from '../../api/adminApi'
import { toDraft, type MemberDraft } from '../../domain/memberDraft'
import { MemberDraftForm } from './MemberDraftForm'
import { rowActionClass, rowDestructiveActionClass } from './ContentEditorShell'
import { useI18n } from '../../i18n/I18nContext'
import { mockMembers } from '../../data/members'

/** What the panel is currently editing, if anything. */
type Editing =
  | { kind: 'none' }
  | { kind: 'new' }
  | { kind: 'member'; id: string; draft: MemberDraft }
  | { kind: 'arrived'; id: string; draft: MemberDraft; unresolved: string[] }

export function MembersEditor() {
  const { t, lang } = useI18n()
  const copy = t.admin.members

  /**
   * Error copy by code, falling back for anything the dictionary has no entry
   * for. The validator's code union is wider than the messages worth writing —
   * `rate-limited` cannot occur on this path — and a missing key must read as a
   * generic failure rather than as the word "undefined".
   */
  const errorMessage = (code: string | null | undefined): string => {
    const table: Record<string, string | undefined> = copy.errors
    return (code ? table[code] : undefined) ?? copy.errors.generic
  }

  const [arrived, setArrived] = useState<ArrivedResponse[]>([])
  const [members, setMembers] = useState<AdminMember[]>([])
  const [editing, setEditing] = useState<Editing>({ kind: 'none' })
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<'loading' | 'ready' | 'unavailable'>('loading')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const [nextArrived, nextMembers] = await Promise.all([
        membersAdmin.listArrived(),
        membersAdmin.list(),
      ])
      setArrived(nextArrived)
      setMembers(nextMembers)
      setStatus('ready')
    } catch {
      // Firestore not configured, or rules refused — either way the tab has
      // nothing to show and says so rather than rendering an empty success.
      setStatus('unavailable')
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  /** Wraps a mutation so every action reports its own failure and reloads. */
  const run = async (action: () => Promise<unknown>) => {
    setBusy(true)
    setError(null)
    try {
      await action()
      await refresh()
      setEditing({ kind: 'none' })
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'request-failed')
    } finally {
      setBusy(false)
    }
  }

  /**
   * Name, institution or country, accent-insensitively.
   *
   * Accent folding matters more here than it looks: a directory of Latin American
   * academics is full of names a moderator will type without diacritics, and
   * "Nunez" failing to find "Núñez" reads as a missing profile rather than as a
   * fussy search box.
   */
  const fold = (value: string) =>
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()

  const query = fold(search.trim())
  const visible = query
    ? members.filter((member) =>
        [member.fullName, member.country, member.region, member.jobPositionName]
          .filter(Boolean)
          .some((field) => fold(field).includes(query)),
      )
    : members

  const formatDate = (iso: string) => {
    if (!iso) return '—'
    const parsed = new Date(iso)
    return Number.isNaN(parsed.getTime()) ? iso : parsed.toLocaleDateString(lang)
  }

  if (status === 'loading') {
    return <p className="py-8 text-center text-sm text-pizarra">{copy.loading}</p>
  }

  if (status === 'unavailable') {
    return <p className="py-8 text-center text-sm text-pizarra">{copy.unavailable}</p>
  }

  if (editing.kind !== 'none') {
    const isArrived = editing.kind === 'arrived'
    return (
      <section>
        <h2 className="mb-3 font-display text-lg font-semibold text-carbon">
          {editing.kind === 'new' ? copy.addTitle : copy.editTitle}
        </h2>
        <MemberDraftForm
          initial={editing.kind === 'new' ? undefined : editing.draft}
          unresolved={isArrived ? editing.unresolved : []}
          error={error ? errorMessage(error) : null}
          busy={busy}
          onCancel={() => {
            setError(null)
            setEditing({ kind: 'none' })
          }}
          onSave={(draft) =>
            run(() =>
              isArrived
                ? membersAdmin.publishArrived(editing.id, draft)
                : membersAdmin.save(editing.kind === 'member' ? editing.id : null, draft),
            )
          }
        />
      </section>
    )
  }

  return (
    <div className="space-y-10">
      {/* ---- Primary path: what the incorporation form delivered ---------- */}
      <section>
        <h2 className="font-display text-lg font-semibold text-carbon">{copy.arrivedTitle}</h2>
        <p className="mt-1 text-xs text-pizarra">{copy.arrivedLede}</p>

        {error && editing.kind === 'none' ? (
          <p role="alert" className="mt-3 text-xs font-medium text-teal-deep">
            {errorMessage(error)}
          </p>
        ) : null}

        {arrived.length === 0 ? (
          <p className="mt-4 rounded-2xl border border-dashed border-carbon/15 px-4 py-6 text-center text-sm text-pizarra">
            {copy.arrivedEmpty}
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {arrived.map((response) => {
              const { outcome } = response
              const name = outcome.member
                ? outcome.member.fullName
                : (response.answers['Nombre'] ?? copy.unknownName)
              const needsReview = !outcome.ok || outcome.unresolved.length > 0

              return (
                <li
                  key={response.id}
                  className="rounded-2xl border border-carbon/10 bg-white p-4 sm:flex sm:items-start sm:justify-between sm:gap-4"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-carbon">{name}</p>
                    <p className="mt-0.5 text-xs text-pizarra">
                      {copy.receivedOn.replace('{date}', formatDate(response.receivedAt))}
                    </p>
                    <p
                      className={`mt-1.5 text-xs font-medium ${
                        needsReview ? 'text-teal-deep' : 'text-pizarra'
                      }`}
                    >
                      {outcome.ok
                        ? outcome.unresolved.length > 0
                          ? copy.readyWithQueries.replace(
                              '{values}',
                              outcome.unresolved.join(', '),
                            )
                          : copy.readyToPublish
                        : errorMessage(outcome.error)}
                    </p>
                  </div>

                  <div className="mt-3 flex shrink-0 flex-wrap gap-2 sm:mt-0">
                    {/*
                      A clean response publishes in one action. Anything the
                      mapping could not settle goes through the form first, so a
                      moderator resolves it rather than a guess reaching the
                      public directory.
                    */}
                    {outcome.ok && outcome.unresolved.length === 0 ? (
                      <button
                        type="button"
                        disabled={busy}
                        className={rowActionClass}
                        onClick={() => run(() => membersAdmin.publishArrived(response.id))}
                      >
                        {copy.publish}
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={busy}
                        className={rowActionClass}
                        onClick={() =>
                          setEditing({
                            kind: 'arrived',
                            id: response.id,
                            unresolved: outcome.unresolved,
                            draft: outcome.member
                              ? toDraft(outcome.member)
                              : draftFromAnswers(response),
                          })
                        }
                      >
                        {copy.review}
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={busy}
                      className={rowDestructiveActionClass}
                      onClick={() => {
                        if (window.confirm(copy.confirmDiscard)) {
                          void run(() => membersAdmin.discardArrived(response.id))
                        }
                      }}
                    >
                      {copy.discard}
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {/* ---- Secondary: the directory itself ------------------------------ */}
      <section>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold text-carbon">
              {copy.publishedTitle}
            </h2>
            <p className="mt-1 text-xs text-pizarra">{copy.publishedLede}</p>
          </div>
          <button
            type="button"
            onClick={() => setEditing({ kind: 'new' })}
            className="rounded-full bg-carbon px-4 py-2 text-xs font-semibold text-white"
          >
            {copy.addManually}
          </button>
        </div>

        {/*
          Worth having from the first dozen profiles and essential past fifty.
          Filters in the browser rather than by query: the whole collection is
          already loaded, and a Firestore prefix query cannot match a surname in
          the middle of a full name anyway.
        */}
        {members.length > 0 ? (
          <input
            type="search"
            className="mt-4 w-full rounded-xl border border-carbon/15 bg-white px-4 py-2.5 text-sm outline-none transition-colors focus:border-teal"
            value={search}
            placeholder={copy.searchPlaceholder}
            aria-label={copy.searchLabel}
            onChange={(event) => setSearch(event.target.value)}
          />
        ) : null}

        {members.length === 0 ? (
          <p className="mt-4 rounded-2xl border border-dashed border-carbon/15 px-4 py-6 text-center text-sm text-pizarra">
            {copy.publishedEmpty}
          </p>
        ) : visible.length === 0 ? (
          <p className="mt-4 rounded-2xl border border-dashed border-carbon/15 px-4 py-6 text-center text-sm text-pizarra">
            {copy.searchEmpty.replace('{query}', search)}
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {visible.map((member) => (
              <li
                key={member.id}
                className="rounded-2xl border border-carbon/10 bg-white p-4 sm:flex sm:items-center sm:justify-between sm:gap-4"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-carbon">{member.fullName}</p>
                  <p className="mt-0.5 text-xs text-pizarra">
                    {member.title[lang]} · {member.country}
                  </p>
                  <p className="mt-0.5 text-xs text-pizarra">
                    {copy.publishedOn.replace('{date}', formatDate(member.publishedAt ?? ''))}
                  </p>
                </div>
                <div className="mt-3 flex shrink-0 flex-wrap gap-2 sm:mt-0">
                  <button
                    type="button"
                    disabled={busy}
                    className={rowActionClass}
                    onClick={() =>
                      setEditing({ kind: 'member', id: member.id, draft: toDraft(member) })
                    }
                  >
                    {copy.edit}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    className={rowDestructiveActionClass}
                    onClick={() => {
                      if (window.confirm(copy.confirmDelete.replace('{name}', member.fullName))) {
                        void run(() => membersAdmin.remove(member.id))
                      }
                    }}
                  >
                    {copy.delete}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {/*
          The public directory is these records plus a compiled-in mock seed, so
          the site shows far more people than this list does. Saying so here stops
          that gap reading as a bug in the panel — the seed lives in the repository
          and no panel action can touch it.
        */}
        <p className="mt-4 text-xs text-pizarra">
          {copy.seedNotice.replace('{count}', String(mockMembers.length))}
        </p>
      </section>
    </div>
  )
}

/**
 * Best-effort draft for a response the mapper could not validate at all.
 *
 * Only the free-text name is lifted across; every controlled field is left
 * empty so a moderator picks from the real vocabularies rather than inheriting
 * whatever text failed to match.
 */
function draftFromAnswers(response: ArrivedResponse): MemberDraft {
  return {
    fullName:
      response.answers['Nombre completo'] ??
      response.answers['Nombre y apellidos completos:'] ??
      response.answers['Nombre'] ??
      '',
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
}

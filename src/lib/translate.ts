/**
 * Machine translation for the content editors.
 *
 * MyMemory rather than Google Cloud Translation, for two reasons that are
 * properties of this project rather than preferences:
 *
 *  - Cloud Translation requires a billing account even on its free tier, which
 *    would take the project off the Spark plan that README.md and adminApi.ts
 *    both treat as a constraint ("free tiers cannot bill you — there is no card
 *    on file to charge").
 *  - This is a static bundle with no server, so any API key would ship inside
 *    the JavaScript and be readable by anyone viewing source — the same problem
 *    the admin password has. MyMemory needs no key, so there is nothing to leak.
 *
 * Everything here produces suggestions. Nothing in this file writes to
 * Firestore — the editor fills the inputs and a human presses Save.
 */
import { networkEmails } from '../data/network'

/**
 * The three languages every piece of editable content carries.
 *
 * Translation runs between any two of them rather than out of Spanish only:
 * somebody drafting in English should get the Spanish and Portuguese filled in
 * just as somebody drafting in Spanish does. Spanish is the required field and
 * the render-time fallback, but it is not privileged as an input.
 */
export type ContentLang = 'es' | 'en' | 'pt'

export const CONTENT_LANGS: readonly ContentLang[] = ['es', 'en', 'pt']

/** Why a translation could not be produced. The UI maps these to copy. */
export type TranslateFailure = 'empty' | 'too-long' | 'quota' | 'unavailable'

export class TranslationError extends Error {
  // A plain field rather than a constructor parameter property: the project
  // compiles with `erasableSyntaxOnly`, which rules that syntax out.
  readonly reason: TranslateFailure

  constructor(reason: TranslateFailure) {
    super(reason)
    this.name = 'TranslationError'
    this.reason = reason
  }
}

const ENDPOINT = 'https://api.mymemory.translated.net/get'

/**
 * MyMemory's anonymous GET limit. Measured in bytes, not characters, because
 * the accented text this site is full of costs two bytes apiece — counting
 * characters would let "sostenibles con los recursos a tu alcance" through and
 * then fail at the API.
 */
const MAX_BYTES = 500

const REQUEST_TIMEOUT_MS = 10_000

/**
 * Contact address sent as MyMemory's `de=` parameter, which raises the daily
 * quota from 5,000 to 50,000 characters.
 *
 * The network's own address, taken from the same constant the contact section
 * renders — not an environment variable and not a deployment secret.
 *
 * It was briefly both. The reasoning was that Vite inlines the value into the
 * bundle, so a committed address is publicly readable; keeping it in a secret
 * at least kept it out of a public repository's history. That reasoning does
 * not apply to *this* address: the site already prints it on the contact
 * section, so it is in the bundle either way and the secret was protecting
 * something already published. Storing it in Firestore or Remote Config would
 * be the same — both are client-readable — while adding a round-trip and a
 * fallback path to hide a value that is on the page.
 *
 * So: one constant, no secret to set, nothing to reproduce when the project
 * moves. MyMemory asks for an address they can reach if the traffic looks
 * wrong, and this is a real, monitored inbox, which is what they are asking
 * for.
 */
const CONTACT_ADDRESS = networkEmails.general

interface MyMemoryResponse {
  responseData?: { translatedText?: string }
  responseStatus?: number | string
  responseDetails?: string
}

/**
 * MyMemory returns a handful of HTML entities in its output. Decoded with an
 * explicit table rather than the usual detached-element trick, because that
 * trick is an innerHTML assignment on text this code did not author.
 */
const ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&nbsp;': ' ',
}

function decodeEntities(value: string): string {
  return value.replace(/&(?:amp|lt|gt|quot|apos|nbsp|#39);/g, (match) => ENTITIES[match] ?? match)
}

/**
 * Quota exhaustion arrives as prose in the translated text with a 200 status,
 * not as an error. Without this check "MYMEMORY WARNING: YOU USED ALL AVAILABLE
 * FREE TRANSLATIONS FOR TODAY" gets pasted into the English title and saved.
 */
function isQuotaNotice(text: string): boolean {
  return /MYMEMORY WARNING|ALL AVAILABLE FREE TRANSLATIONS|QUOTA/i.test(text)
}

/**
 * Whether a reply is a translation at all, rather than debris.
 *
 * MyMemory answers from a shared translation memory that anyone can write to,
 * so a polluted entry comes back looking entirely healthy. Asking it for the
 * English word "test" in Spanish returns:
 *
 *     { translatedText: '-', match: 1, responseStatus: 200 }
 *
 * A confident, successful, punctuation-only answer. It passes the quota check,
 * the status check and the non-empty check, so the editor accepted it and wrote
 * "-" into the Spanish title — which is the required field and the fallback
 * every other language renders through, so saving it would have blanked the
 * card's name on the public site in all three languages.
 *
 * The test is deliberately weak: at least one letter or digit, anywhere. Every
 * real translation clears it, so it cannot reject good output; junk like "-",
 * "?" or "..." cannot. Nothing stronger is safe — translations legitimately
 * differ wildly from the source in length, script and word count, and `match`
 * cannot help because this reply claimed a perfect one.
 *
 * Unicode-aware so that accents, cedillas and non-Latin scripts count as
 * letters: /\w/ would fail "ñ" and reject a perfectly good Spanish word.
 */
function looksLikeTranslation(text: string): boolean {
  return /[\p{L}\p{N}]/u.test(text)
}

/* ------------------------------------------------------- On-device provider */

/**
 * Chrome's built-in Translator API: translation by a model on the machine.
 *
 * Strictly better than the network provider where it exists — no key, no
 * account, no daily quota, nothing leaves the machine, and better output. It is
 * Chrome and Edge only, which is why it is the preferred path rather than the
 * only one.
 *
 * Typed loosely and called defensively on purpose. This API is recent and its
 * shape has moved between Chrome versions, so every step is wrapped and any
 * surprise simply means "fall back to the network" instead of an error the
 * person editing has to understand.
 */
interface OnDeviceTranslator {
  translate(text: string): Promise<string>
}

interface OnDeviceTranslatorFactory {
  availability?(options: {
    sourceLanguage: string
    targetLanguage: string
  }): Promise<string>
  create(options: { sourceLanguage: string; targetLanguage: string }): Promise<OnDeviceTranslator>
}

function onDeviceFactory(): OnDeviceTranslatorFactory | null {
  const candidate = (globalThis as { Translator?: OnDeviceTranslatorFactory }).Translator
  return candidate && typeof candidate.create === 'function' ? candidate : null
}

/**
 * Translators are expensive to construct, so keep one per language pair —
 * scoped to the factory that built it rather than held globally. Keying on the
 * pair alone would hand back a translator made by a factory that no longer
 * exists if the global were ever replaced, which is exactly what the tests do
 * when they swap the stub.
 */
const onDeviceCache = new WeakMap<
  OnDeviceTranslatorFactory,
  Map<string, Promise<OnDeviceTranslator>>
>()

function cacheFor(
  factory: OnDeviceTranslatorFactory,
): Map<string, Promise<OnDeviceTranslator>> {
  let pairs = onDeviceCache.get(factory)
  if (!pairs) {
    pairs = new Map()
    onDeviceCache.set(factory, pairs)
  }
  return pairs
}

/**
 * Returns null — never throws — when on-device translation cannot serve this
 * pair, so the caller can fall through to the network without special-casing.
 *
 * The first use of a pair downloads a model, which can outlast the timeout. That
 * request falls back to the network once; the download continues in the
 * background and later requests are instant.
 */
async function translateOnDevice(
  text: string,
  from: ContentLang,
  to: ContentLang,
): Promise<string | null> {
  const factory = onDeviceFactory()
  if (!factory) return null

  const pair = `${from}|${to}`
  try {
    if (factory.availability) {
      const availability = await factory.availability({
        sourceLanguage: from,
        targetLanguage: to,
      })
      // Chrome reports 'unavailable' | 'downloadable' | 'downloading' | 'available'.
      // Anything that is not a flat refusal is worth attempting.
      if (availability === 'unavailable') return null
    }

    const pairs = cacheFor(factory)
    let translator = pairs.get(pair)
    if (!translator) {
      translator = factory.create({ sourceLanguage: from, targetLanguage: to })
      pairs.set(pair, translator)
    }

    const result = await withTimeout(
      translator.then((instance) => instance.translate(text)),
      REQUEST_TIMEOUT_MS,
    )
    const trimmed = result.trim()
    // Same guard as the network path: debris falls through to the fallback
    // rather than being written into a field.
    return trimmed && looksLikeTranslation(trimmed) ? trimmed : null
  } catch {
    // A failed create() must not poison the cache for the next attempt.
    cacheFor(factory).delete(pair)
    return null
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ])
}

/* ------------------------------------------------------------ Public entry */

/**
 * Identical translations already in flight, so none is paid for twice.
 *
 * Pressing "fill in the missing languages" moves focus off the Spanish box,
 * which fires the auto-complete blur handler as well — two identical requests
 * for the same text, each charged against the daily quota. Sharing the pending
 * promise makes that pair cost one.
 */
const inFlight = new Map<string, Promise<string>>()

/**
 * Translates one string between two languages. Throws on failure.
 *
 * Tries the on-device model first and falls back to MyMemory, so a Chrome user
 * gets unlimited private translation and everyone else still gets a suggestion.
 */
export function translateText(
  text: string,
  from: ContentLang,
  to: ContentLang,
): Promise<string> {
  const source = text.trim()
  if (!source) return Promise.reject(new TranslationError('empty'))

  const key = `${from}|${to}|${source}`
  const existing = inFlight.get(key)
  if (existing) return existing

  // The stored promise is the one carrying the cleanup, not the bare call with
  // cleanup attached alongside it. Chained this way the entry is gone by the
  // time a caller's await resumes; a sibling chain would delete it a microtask
  // later, so the very next request would still see a settled entry and reuse
  // a result it should have asked for again.
  const pending = performTranslation(source, from, to).finally(() => {
    inFlight.delete(key)
  })
  inFlight.set(key, pending)
  return pending
}

async function performTranslation(
  source: string,
  from: ContentLang,
  to: ContentLang,
): Promise<string> {

  // Attempted before the byte check: the on-device model has no such limit, so
  // long text should not be refused just because the fallback could not take it.
  const local = await translateOnDevice(source, from, to)
  if (local) return local

  if (new TextEncoder().encode(source).length > MAX_BYTES) {
    throw new TranslationError('too-long')
  }

  const url =
    `${ENDPOINT}?q=${encodeURIComponent(source)}&langpair=${encodeURIComponent(`${from}|${to}`)}` +
    `&de=${encodeURIComponent(CONTACT_ADDRESS)}`

  let response: Response
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) })
  } catch {
    // Offline, blocked, or timed out — all the same to the person editing.
    throw new TranslationError('unavailable')
  }

  if (response.status === 429) throw new TranslationError('quota')
  if (!response.ok) throw new TranslationError('unavailable')

  let body: MyMemoryResponse
  try {
    body = (await response.json()) as MyMemoryResponse
  } catch {
    throw new TranslationError('unavailable')
  }

  const translated = body.responseData?.translatedText?.trim()
  if (!translated) throw new TranslationError('unavailable')
  if (isQuotaNotice(translated)) throw new TranslationError('quota')
  if (Number(body.responseStatus) !== 200) {
    throw new TranslationError(isQuotaNotice(body.responseDetails ?? '') ? 'quota' : 'unavailable')
  }
  if (!looksLikeTranslation(translated)) throw new TranslationError('unavailable')

  return decodeEntities(translated)
}

export type LocalisedText = Partial<Record<ContentLang, string>>

export interface TranslationOutcome {
  /** Only the languages that came back. A partial result is still useful. */
  values: LocalisedText
  /** The first failure, if any target failed. */
  failure: TranslateFailure | null
}

/**
 * Translates into several languages at once.
 *
 * One target failing does not discard the other: half a translation the editor
 * can correct beats none, and the failure is reported alongside so the message
 * still appears.
 */
export async function translateInto(
  text: string,
  from: ContentLang,
  targets: readonly ContentLang[],
): Promise<TranslationOutcome> {
  if (targets.length === 0) return { values: {}, failure: null }

  const settled = await Promise.allSettled(
    targets.map((target) => translateText(text, from, target)),
  )

  const values: LocalisedText = {}
  let failure: TranslateFailure | null = null

  settled.forEach((result, index) => {
    const target = targets[index]
    if (result.status === 'fulfilled') {
      values[target] = result.value
      return
    }
    const reason =
      result.reason instanceof TranslationError ? result.reason.reason : 'unavailable'
    // Quota is the most actionable thing to report, so it wins over a generic
    // failure when the two targets disagree about why they failed.
    if (!failure || reason === 'quota') failure = reason
  })

  return { values, failure }
}

/**
 * Picks which language to translate out of, and which to fill.
 *
 * The source is whichever box already has text, preferring Spanish because it
 * is the required field and the one the public site falls back to — but English
 * or Portuguese will do when Spanish is still blank, which is the case for
 * somebody drafting in their own language first.
 *
 * Only empty targets are filled. Overwriting a translation somebody typed
 * because they tabbed through the field would be silent data loss.
 */
export function planCompletion(value: LocalisedText): {
  from: ContentLang
  targets: ContentLang[]
} | null {
  const from = CONTENT_LANGS.find((lang) => value[lang]?.trim())
  if (!from) return null
  const targets = CONTENT_LANGS.filter((lang) => lang !== from && !value[lang]?.trim())
  return targets.length > 0 ? { from, targets } : null
}

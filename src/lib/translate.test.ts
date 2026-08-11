import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { planCompletion, translateInto, translateText, TranslationError } from './translate'
import { networkEmails } from '../data/network'

const fetchMock = vi.fn()

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

/** A MyMemory success envelope. */
function ok(translatedText: string) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ responseData: { translatedText }, responseStatus: 200 }),
  }
}

describe('translateText', () => {
  it('returns the translated text', async () => {
    fetchMock.mockResolvedValue(ok('Annual gatherings'))

    await expect(translateText('Encuentros anuales', 'es', 'en')).resolves.toBe(
      'Annual gatherings',
    )
  })

  it('asks the API for the right language pair', async () => {
    fetchMock.mockResolvedValue(ok('Encontros anuais'))

    await translateText('Encuentros anuales', 'es', 'pt')

    const [url] = fetchMock.mock.calls[0] as [string]
    expect(url).toContain('langpair=es%7Cpt')
    expect(url).toContain('q=Encuentros%20anuales')
  })

  /**
   * The contact address is what buys 50,000 chars/day instead of 5,000, and
   * dropping it silently costs 90% of the quota with nothing to show for it.
   * Asserted against the shared constant rather than a literal, so changing the
   * network's address does not require editing this test.
   */
  it("sends the network's contact address, which is what raises the quota", async () => {
    fetchMock.mockResolvedValue(ok('Annual gatherings'))

    await translateText('Encuentros anuales', 'es', 'en')

    expect(fetchMock.mock.calls[0][0]).toContain(
      `&de=${encodeURIComponent(networkEmails.general)}`,
    )
  })

  /**
   * Pressing the button also blurs the Spanish box, which fires auto-complete —
   * so the same translation was requested twice and charged twice against a
   * quota measured in characters.
   */
  it('charges the quota once when the same translation is asked for twice at once', async () => {
    fetchMock.mockResolvedValue(ok('Annual gatherings'))

    const [a, b] = await Promise.all([
      translateText('Encuentros anuales', 'es', 'en'),
      translateText('Encuentros anuales', 'es', 'en'),
    ])

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(a).toBe('Annual gatherings')
    expect(b).toBe('Annual gatherings')
  })

  it('does not reuse a finished request, so later edits are translated afresh', async () => {
    fetchMock.mockResolvedValue(ok('Annual gatherings'))

    await translateText('Encuentros anuales', 'es', 'en')
    await translateText('Encuentros anuales', 'es', 'en')

    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  /**
   * The quota notice is the dangerous case. MyMemory reports exhaustion as
   * prose inside translatedText with a 200 status, so without this check the
   * warning itself gets pasted into the English title and published.
   */
  it('treats a quota notice as a failure rather than a translation', async () => {
    fetchMock.mockResolvedValue(
      ok('MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY'),
    )

    await expect(translateText('Encuentros anuales', 'es', 'en')).rejects.toMatchObject({
      reason: 'quota',
    })
  })

  /**
   * The exact reply that put "-" into a production Spanish title. MyMemory's
   * shared memory has a polluted entry for the English word "test", and hands
   * it back claiming a perfect match with a 200 status, so every other guard
   * waves it through.
   */
  it('rejects punctuation-only debris that claims to be a perfect match', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        responseData: { translatedText: '-', match: 1 },
        responseStatus: 200,
      }),
    })

    await expect(translateText('test', 'en', 'es')).rejects.toMatchObject({
      reason: 'unavailable',
    })
  })

  it.each(['-', '?', '...', '   —   ', '!!'])(
    'rejects %j rather than writing it into a field',
    async (debris) => {
      fetchMock.mockResolvedValue(ok(debris))

      await expect(translateText('test', 'en', 'es')).rejects.toMatchObject({
        reason: 'unavailable',
      })
    },
  )

  /**
   * The guard must not be stricter than "contains a letter or a digit".
   * Accents, cedillas and non-Latin scripts are letters; /\w/ would reject
   * them and throw away perfectly good Spanish and Portuguese.
   */
  it.each(['ñ', 'Ação', 'Año 2026', '教育', 'Água e saneamento'])(
    'accepts %j as a real translation',
    async (good) => {
      fetchMock.mockResolvedValue(ok(good))

      await expect(translateText('x', 'en', 'es')).resolves.toBe(good)
    },
  )

  it('reports a 429 as a quota failure', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 429, json: async () => ({}) })

    await expect(translateText('Hola', 'es', 'en')).rejects.toMatchObject({ reason: 'quota' })
  })

  it('refuses empty input without calling the API', async () => {
    await expect(translateText('   ', 'es', 'en')).rejects.toMatchObject({ reason: 'empty' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  /**
   * The limit is in bytes, and this site's copy is full of accented characters
   * that cost two apiece — counting characters would let text through that the
   * API then rejects.
   */
  it('measures the length limit in bytes, not characters', async () => {
    const accented = 'á'.repeat(300) // 300 characters, 600 bytes

    await expect(translateText(accented, 'es', 'en')).rejects.toMatchObject({
      reason: 'too-long',
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('decodes the HTML entities MyMemory returns', async () => {
    fetchMock.mockResolvedValue(ok('Tomorrow&#39;s workshop &amp; more'))

    await expect(translateText('Taller', 'es', 'en')).resolves.toBe(
      "Tomorrow's workshop & more",
    )
  })

  it('reports a network failure rather than throwing raw', async () => {
    fetchMock.mockRejectedValue(new Error('offline'))

    await expect(translateText('Hola', 'es', 'en')).rejects.toBeInstanceOf(TranslationError)
  })

  it('rejects a non-200 responseStatus even when the body parses', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ responseData: { translatedText: 'x' }, responseStatus: 403 }),
    })

    await expect(translateText('Hola', 'es', 'en')).rejects.toMatchObject({
      reason: 'unavailable',
    })
  })
})

describe('translateInto', () => {
  it('returns both languages', async () => {
    fetchMock
      .mockResolvedValueOnce(ok('Annual gatherings'))
      .mockResolvedValueOnce(ok('Encontros anuais'))

    const { values, failure } = await translateInto('Encuentros anuales', 'es', ['en', 'pt'])

    expect(values).toEqual({ en: 'Annual gatherings', pt: 'Encontros anuais' })
    expect(failure).toBeNull()
  })

  /**
   * Half a translation the editor can correct beats none, so one target failing
   * must not discard the other — but the failure still has to surface.
   */
  it('keeps a partial result when one language fails', async () => {
    fetchMock
      .mockResolvedValueOnce(ok('Annual gatherings'))
      .mockRejectedValueOnce(new Error('offline'))

    const { values, failure } = await translateInto('Encuentros anuales', 'es', ['en', 'pt'])

    expect(values).toEqual({ en: 'Annual gatherings' })
    expect(failure).toBe('unavailable')
  })

  it('reports quota ahead of a generic failure when the two disagree', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: false, status: 429, json: async () => ({}) })

    const { failure } = await translateInto('Encuentros anuales', 'es', ['en', 'pt'])

    expect(failure).toBe('quota')
  })

  it('only requests the languages it was asked for', async () => {
    fetchMock.mockResolvedValue(ok('Encontros anuais'))

    const { values } = await translateInto('Encuentros anuales', 'es', ['pt'])

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(values).toEqual({ pt: 'Encontros anuais' })
  })

  it('does no work when there is nothing to fill', async () => {
    const { values, failure } = await translateInto('Encuentros anuales', 'es', [])

    expect(fetchMock).not.toHaveBeenCalled()
    expect(values).toEqual({})
    expect(failure).toBeNull()
  })
})

/**
 * The on-device model is preferred wherever it exists: no key, no quota,
 * nothing leaves the machine. These pin that it is actually reached, and that
 * every way it can let us down ends at the network rather than at an error.
 */
describe('on-device translation', () => {
  function stubTranslator(
    translate: (text: string) => Promise<string>,
    availability = 'available',
  ) {
    vi.stubGlobal('Translator', {
      availability: async () => availability,
      create: async () => ({ translate }),
    })
  }

  it('uses the on-device model and never touches the network', async () => {
    stubTranslator(async () => 'Annual gatherings')

    await expect(translateText('Encuentros anuales', 'es', 'en')).resolves.toBe(
      'Annual gatherings',
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('falls back to the network when the model reports the pair unavailable', async () => {
    stubTranslator(async () => 'unused', 'unavailable')
    fetchMock.mockResolvedValue(ok('Annual gatherings'))

    await expect(translateText('Encuentros anuales', 'es', 'en')).resolves.toBe(
      'Annual gatherings',
    )
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('falls back to the network when the model throws', async () => {
    stubTranslator(async () => {
      throw new Error('model exploded')
    })
    fetchMock.mockResolvedValue(ok('Annual gatherings'))

    await expect(translateText('Encuentros anuales', 'es', 'en')).resolves.toBe(
      'Annual gatherings',
    )
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('falls back to the network when the model returns punctuation-only debris', async () => {
    stubTranslator(async () => '-')
    fetchMock.mockResolvedValue(ok('Annual gatherings'))

    await expect(translateText('Encuentros anuales', 'es', 'en')).resolves.toBe(
      'Annual gatherings',
    )
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('falls back when the model returns nothing usable', async () => {
    stubTranslator(async () => '   ')
    fetchMock.mockResolvedValue(ok('Annual gatherings'))

    await expect(translateText('Encuentros anuales', 'es', 'en')).resolves.toBe(
      'Annual gatherings',
    )
  })

  /**
   * The byte cap is MyMemory's, not a property of translation, so text the
   * on-device model can handle must not be refused on the fallback's behalf.
   */
  it('has no byte limit, unlike the network fallback', async () => {
    const long = 'á'.repeat(400) // 800 bytes — far past MyMemory's cap
    stubTranslator(async () => 'a very long translation')

    await expect(translateText(long, 'es', 'en')).resolves.toBe('a very long translation')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('still refuses empty input before doing any work', async () => {
    const translate = vi.fn()
    stubTranslator(translate)

    await expect(translateText('  ', 'es', 'en')).rejects.toMatchObject({ reason: 'empty' })
    expect(translate).not.toHaveBeenCalled()
  })
})

describe('planCompletion', () => {
  it('translates out of Spanish into the two empty boxes', () => {
    expect(planCompletion({ es: 'Encuentros anuales', en: '', pt: '' })).toEqual({
      from: 'es',
      targets: ['en', 'pt'],
    })
  })

  /**
   * The point of not hardcoding Spanish as the source: somebody drafting in
   * English should get Spanish and Portuguese filled in, not nothing.
   */
  it('translates out of English when Spanish is still blank', () => {
    expect(planCompletion({ es: '', en: 'Annual gatherings', pt: '' })).toEqual({
      from: 'en',
      targets: ['es', 'pt'],
    })
  })

  it('translates out of Portuguese when it is the only box filled', () => {
    expect(planCompletion({ es: '', en: '', pt: 'Encontros anuais' })).toEqual({
      from: 'pt',
      targets: ['es', 'en'],
    })
  })

  /** Spanish is the required field and the render-time fallback, so it wins. */
  it('prefers Spanish as the source when more than one box is filled', () => {
    expect(planCompletion({ es: 'Encuentros', en: 'Gatherings', pt: '' })).toEqual({
      from: 'es',
      targets: ['pt'],
    })
  })

  /**
   * Never overwrite. Filling a box somebody typed because they tabbed through
   * it would be silent data loss, so a filled target is simply not a target.
   */
  it('leaves boxes that already have text alone', () => {
    expect(planCompletion({ es: 'Encuentros', en: 'Gatherings', pt: 'Encontros' })).toBeNull()
  })

  it('does nothing when every box is empty', () => {
    expect(planCompletion({ es: '  ', en: '', pt: undefined })).toBeNull()
  })
})

/**
 * Ingests the network's frugal-innovation bibliography.
 *
 * Source is the folder Allan maintains: 43 numbered PDFs plus
 * "000 - Article Compilation.xlsx" holding the metadata. On the production site
 * this lived as a raw Google Drive folder, which is precisely what Allan called
 * "a pain" in the kickoff — you had to open the spreadsheet in one tab to work
 * out what the numbered files were.
 *
 * This joins the two by paper number, cleans the metadata, copies the PDFs to
 * public/docs/biblio/ under readable slugs, and emits
 * src/data/bibliography.ts so the site can present it as a real catalogue.
 *
 * Usage:
 *   node scripts/ingest-bibliography.mjs "/path/to/RELIF Frugal Innovation biblio (WEBSITE)"
 */
import { readdirSync, mkdirSync, copyFileSync, writeFileSync, statSync } from 'node:fs'
import { join, dirname, extname } from 'node:path'
import { fileURLToPath } from 'node:url'
import XLSX from 'xlsx'

const sourceDir = process.argv[2]
if (!sourceDir) {
  console.error('usage: node scripts/ingest-bibliography.mjs "<source folder>"')
  process.exit(1)
}

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDocs = join(repoRoot, 'public', 'docs', 'biblio')
const outData = join(repoRoot, 'src', 'data', 'bibliography.ts')

/** Collapses the newlines and stray carriage returns the spreadsheet is full of. */
const clean = (value) =>
  String(value ?? '')
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

/**
 * The year column is inconsistent: sometimes a number, sometimes a whole
 * citation ("(2017) Elsevier. University of St.Gallen..."). Take the first
 * plausible 4-digit year, and fall back to null rather than inventing one.
 */
function extractYear(value) {
  if (typeof value === 'number' && value > 1900 && value < 2100) return value
  const years = [...String(value ?? '').matchAll(/\b(19[5-9]\d|20[0-4]\d)\b/g)].map((m) => Number(m[1]))
  return years.length ? Math.min(...years) : null
}

/**
 * Authors are newline-separated in the sheet, sometimes comma or "y" separated.
 * Normalised to a single display string; the raw value is kept for search.
 */
function cleanAuthors(value) {
  const text = clean(value)
    .replace(/\s*⁎\s*/g, '')
    .replace(/\s*\*\s*$/, '')
  // Drop trailing affiliation blobs that leaked into the author column.
  const cut = text.split(/\s(?:\(?\d{4}\)?\s)?(?:Elsevier|Intersticios|Journal|Fellow)\b/)[0]
  return (cut || text).trim()
}

/** Spanish-language entries are a minority; detect them so the UI can filter. */
function detectLanguage(title, authors) {
  const text = `${title} ${authors}`.toLowerCase()
  const spanishMarkers = [
    'innovación', 'frugalidad', 'popular', 'modelo', 'sector', 'salud',
    'enfoques', 'lectura', 'artículo', 'inversa', 'de la ', ' el ', ' en ',
  ]
  const hits = spanishMarkers.filter((m) => text.includes(m)).length
  return hits >= 2 ? 'ES' : 'EN'
}

function slugify(text, paperNumber) {
  const base = text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[“”"'’]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72)
    .replace(/-+$/g, '')
  return `${paperNumber}-${base || 'documento'}`
}

// ---- Read the metadata sheet -----------------------------------------------
const files = readdirSync(sourceDir)
const sheetFile = files.find((f) => f.toLowerCase().endsWith('.xlsx'))
if (!sheetFile) {
  console.error(`no .xlsx metadata sheet found in ${sourceDir}`)
  process.exit(1)
}

const workbook = XLSX.readFile(join(sourceDir, sheetFile))
const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], {
  header: 1,
  defval: '',
})

const metadata = new Map()
for (const row of rows.slice(1)) {
  const paperNumber = clean(row[0])
  if (!/^\d{1,3}$/.test(paperNumber)) continue
  const title = clean(row[1])
  if (!title) continue
  const authors = cleanAuthors(row[2])
  metadata.set(paperNumber.padStart(3, '0'), {
    paperNumber: paperNumber.padStart(3, '0'),
    title,
    authors,
    year: extractYear(row[3]),
    rawYear: clean(row[3]),
    type: clean(row[4]) || 'Article',
  })
}

// ---- Join to the actual PDFs ------------------------------------------------
const pdfs = files.filter((f) => extname(f).toLowerCase() === '.pdf')
mkdirSync(outDocs, { recursive: true })

const entries = []
const unmatchedFiles = []

for (const file of pdfs.sort()) {
  const prefix = file.match(/^(\d{1,3})\s*-/)
  if (!prefix) {
    unmatchedFiles.push(file)
    continue
  }
  const key = prefix[1].padStart(3, '0')
  const meta = metadata.get(key)
  if (!meta) {
    unmatchedFiles.push(file)
    continue
  }

  const slug = slugify(meta.title, key)
  const target = `${slug}.pdf`
  copyFileSync(join(sourceDir, file), join(outDocs, target))

  entries.push({
    id: `biblio-${key}`,
    paperNumber: key,
    title: meta.title,
    authors: meta.authors,
    year: meta.year,
    language: detectLanguage(meta.title, meta.authors),
    file: `/docs/biblio/${target}`,
    sizeKb: Math.round(statSync(join(sourceDir, file)).size / 1024),
  })
}

const missingFiles = [...metadata.keys()].filter((k) => !entries.some((e) => e.paperNumber === k))

// ---- Emit the data module ---------------------------------------------------
const header = `/**
 * GENERATED FILE — do not edit by hand.
 * Produced by scripts/ingest-bibliography.mjs from the network's bibliography
 * folder (43 numbered PDFs plus "000 - Article Compilation.xlsx").
 *
 * Regenerate with:
 *   node scripts/ingest-bibliography.mjs "<path to biblio folder>"
 */

export type BibliographyLanguage = 'EN' | 'ES'

export interface BibliographyEntry {
  id: string
  /** Catalogue number from the network's compilation sheet. */
  paperNumber: string
  title: string
  authors: string
  /** Null when the source sheet had no parseable year. */
  year: number | null
  language: BibliographyLanguage
  /** Path under public/. */
  file: string
  sizeKb: number
}

export const bibliography: BibliographyEntry[] = ${JSON.stringify(entries, null, 2)}

/** Distinct years present, newest first, for the year filter. */
export const bibliographyYears: number[] = ${JSON.stringify(
  [...new Set(entries.map((e) => e.year).filter((y) => y !== null))].sort((a, b) => b - a),
)}
`

writeFileSync(outData, header)

console.log(`matched   ${entries.length} papers`)
console.log(`copied to ${outDocs}`)
console.log(`wrote     ${outData}`)
if (unmatchedFiles.length) console.log(`\nPDFs with no metadata row:\n  ${unmatchedFiles.join('\n  ')}`)
if (missingFiles.length) console.log(`\nMetadata rows with no PDF: ${missingFiles.join(', ')}`)
const spanish = entries.filter((e) => e.language === 'ES').length
console.log(`\nlanguages: ${entries.length - spanish} EN, ${spanish} ES`)
console.log(`total size: ${Math.round(entries.reduce((s, e) => s + e.sizeKb, 0) / 1024)} MB`)

/**
 * Generates branded 4-page placeholder PDFs into public/docs/ so the
 * resource-library preview has real, scrollable documents until the network's
 * actual files are migrated. Zero dependencies — writes raw PDF 1.4.
 *
 * Run with: node scripts/generate-placeholder-pdfs.mjs
 */
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'docs')
mkdirSync(outDir, { recursive: true })

// Mirrors src/data/resources.ts file paths and titles.
const documents = [
  { file: 'marco-relif.pdf', title: 'Marco RELIF de Innovación Frugal', author: 'RELIF · 2020' },
  { file: 'relif-framework-en.pdf', title: 'RELIF Framework (English edition)', author: 'RELIF · 2021' },
  { file: 'referencias-relif.pdf', title: 'Referencias académicas RELIF', author: 'Comisión de Investigación · 2019' },
  { file: 'innovacion-frugal-covid.pdf', title: 'Innovación frugal en tiempos de COVID', author: 'Red RELIF · 2020' },
  { file: 'mundos-convocatoria-es.pdf', title: 'Mundos de Transformación - Convocatoria (ES)', author: 'Comité organizador · 2025' },
  { file: 'mundos-announcement-en.pdf', title: 'Worlds of Transformation - Announcement (EN)', author: 'Organizing committee · 2025' },
  { file: 'mundos-convocatoria-pt.pdf', title: 'Mundos de Transformação - Chamada (PT)', author: 'Comité organizador / REBRIF · 2025' },
  { file: 'guia-mooc.pdf', title: 'Guía del MOOC: innovar con escasos recursos', author: 'Pontificia Universidad Javeriana · 2022' },
  { file: 'agenda-encuentro-2024.pdf', title: 'Agenda - Encuentro Anual RELIF 2024', author: 'Comisión de Eventos · 2024' },
]

const PAGE_COUNT = 4
const PAGE_W = 595
const PAGE_H = 842

/** WinAnsi-safe: swap characters outside latin-1 and escape PDF delimiters. */
function pdfText(text) {
  return text
    .replace(/—/g, '-')
    .replace(/’/g, "'")
    .replace(/“|”/g, '"')
    .replace(/…/g, '...')
    .replace(/·/g, '-')
    .replace(/[\\()]/g, (ch) => `\\${ch}`)
}

function wrap(text, maxChars) {
  const words = text.split(' ')
  const lines = []
  let line = ''
  for (const word of words) {
    if ((line + ' ' + word).trim().length > maxChars) {
      lines.push(line.trim())
      line = word
    } else {
      line = `${line} ${word}`
    }
  }
  if (line.trim()) lines.push(line.trim())
  return lines
}

const bodyEs = [
  'Este es un documento de demostración generado localmente para el',
  'rediseño del sitio de la RELIF. Sustituye al archivo real únicamente',
  'mientras se migra el contenido desde Google Drive.',
  '',
  'El visor permite desplazarse por todas las páginas del documento',
  'sin salir del sitio: usa la rueda del ratón o el gesto de scroll',
  'para avanzar a las páginas siguientes.',
  '',
  'Cuando el documento definitivo esté disponible, basta con colocar',
  'el PDF real en public/docs/ con este mismo nombre de archivo y el',
  'sitio lo servirá automáticamente, sin cambios de código.',
]

/**
 * Brand palette, one entry per document. All nine placeholders previously used
 * the same teal header and the same body copy, so every preview looked like the
 * same file and the library appeared broken. Varying the band colour and
 * stamping the title large makes them tell themselves apart.
 */
const accents = [
  [0.086, 0.522, 0.6],   // teal
  [0.557, 0.737, 0.255], // verde
  [0.965, 0.651, 0.125], // naranja
  [0.914, 0.282, 0.141], // rojo
  [0.302, 0.416, 0.475], // pizarra
]

function pageStream(doc, pageNumber, docIndex) {
  const title = wrap(doc.title, 30)
  const [r, g, b] = accents[docIndex % accents.length]
  const ops = []
  // Per-document header band + brand line
  ops.push(`q ${r} ${g} ${b} rg 0 ${PAGE_H - 64} ${PAGE_W} 64 re f Q`)
  ops.push(`BT /F2 10 Tf 1 1 1 rg 48 ${PAGE_H - 40} Td (${pdfText('RED LATINOAMERICANA DE INNOVACION FRUGAL')}) Tj ET`)
  ops.push(
    `BT /F1 9 Tf 1 1 1 rg ${PAGE_W - 190} ${PAGE_H - 40} Td (${pdfText('DOCUMENTO DE MUESTRA')}) Tj ET`,
  )
  // Watermark page number
  ops.push(`BT /F2 160 Tf 0.93 0.95 0.96 rg 240 320 Td (${pageNumber}) Tj ET`)
  // Title block — larger than before so it reads as the document's identity
  let y = PAGE_H - 140
  for (const line of title) {
    ops.push(`BT /F2 26 Tf 0.125 0.196 0.212 rg 48 ${y} Td (${pdfText(line)}) Tj ET`)
    y -= 32
  }
  ops.push(`BT /F1 11 Tf 0.3 0.42 0.47 rg 48 ${y - 4} Td (${pdfText(doc.author)}) Tj ET`)
  // Accent rule
  ops.push(`q ${r} ${g} ${b} rg 48 ${y - 18} 56 4 re f Q`)
  // Body
  y -= 52
  for (const line of bodyEs) {
    if (line) ops.push(`BT /F1 12 Tf 0.19 0.28 0.31 rg 48 ${y} Td (${pdfText(line)}) Tj ET`)
    y -= 20
  }
  // Footer
  ops.push(`q ${r} ${g} ${b} rg 48 56 ${PAGE_W - 96} 1 re f Q`)
  ops.push(`BT /F1 10 Tf 0.3 0.42 0.47 rg 48 38 Td (${pdfText(`Página ${pageNumber} de ${PAGE_COUNT} - documento provisional`)}) Tj ET`)
  return ops.join('\n')
}

function buildPdf(doc, docIndex) {
  // Object layout: 1 catalog, 2 pages, 3-4 fonts, then per page: page obj + content obj
  const objects = []
  const pageObjIds = []
  const contentObjIds = []
  for (let i = 0; i < PAGE_COUNT; i += 1) {
    pageObjIds.push(5 + i * 2)
    contentObjIds.push(6 + i * 2)
  }

  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>'
  objects[2] = `<< /Type /Pages /Kids [${pageObjIds.map((n) => `${n} 0 R`).join(' ')}] /Count ${PAGE_COUNT} >>`
  objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'
  objects[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'

  for (let i = 0; i < PAGE_COUNT; i += 1) {
    const stream = pageStream(doc, i + 1, docIndex)
    objects[pageObjIds[i]] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] ` +
      `/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentObjIds[i]} 0 R >>`
    objects[contentObjIds[i]] =
      `<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream`
  }

  let body = '%PDF-1.4\n'
  const offsets = [0]
  for (let id = 1; id < objects.length; id += 1) {
    offsets[id] = Buffer.byteLength(body, 'latin1')
    body += `${id} 0 obj\n${objects[id]}\nendobj\n`
  }

  const xrefStart = Buffer.byteLength(body, 'latin1')
  let xref = `xref\n0 ${objects.length}\n0000000000 65535 f \n`
  for (let id = 1; id < objects.length; id += 1) {
    xref += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`
  }
  const trailer =
    `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`

  return Buffer.from(body + xref + trailer, 'latin1')
}

/**
 * Marker stamped into every generated page. Its presence is how we tell our own
 * placeholders apart from documents migrated from the production site — without
 * this check, re-running the script would silently destroy the real PDFs.
 */
const PLACEHOLDER_MARKER = 'DOCUMENTO DE MUESTRA'

function isRealDocument(path) {
  if (!existsSync(path)) return false
  return !readFileSync(path, 'latin1').includes(PLACEHOLDER_MARKER)
}

let written = 0
let kept = 0
documents.forEach((doc, docIndex) => {
  const path = join(outDir, doc.file)
  if (isRealDocument(path)) {
    console.log(`kept   ${path} (real document, not overwriting)`)
    kept += 1
    return
  }
  writeFileSync(path, buildPdf(doc, docIndex))
  console.log(`wrote  ${path}`)
  written += 1
})
console.log(`\n${written} placeholder(s) generated, ${kept} real document(s) left untouched.`)

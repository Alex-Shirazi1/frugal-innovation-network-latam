/**
 * Generates branded 4-page placeholder PDFs into public/docs/ so the
 * resource-library preview has real, scrollable documents until the network's
 * actual files are migrated. Zero dependencies — writes raw PDF 1.4.
 *
 * Run with: node scripts/generate-placeholder-pdfs.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs'
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

function pageStream(doc, pageNumber) {
  const title = wrap(doc.title, 38)
  const ops = []
  // Teal header band + brand line
  ops.push(`q 0.086 0.522 0.6 rg 0 ${PAGE_H - 64} ${PAGE_W} 64 re f Q`)
  ops.push(`BT /F2 10 Tf 1 1 1 rg 48 ${PAGE_H - 40} Td (${pdfText('RED LATINOAMERICANA DE INNOVACION FRUGAL')}) Tj ET`)
  // Watermark page number
  ops.push(`BT /F2 160 Tf 0.93 0.95 0.96 rg 240 320 Td (${pageNumber}) Tj ET`)
  // Title block
  let y = PAGE_H - 130
  for (const line of title) {
    ops.push(`BT /F2 20 Tf 0.125 0.196 0.212 rg 48 ${y} Td (${pdfText(line)}) Tj ET`)
    y -= 26
  }
  ops.push(`BT /F1 11 Tf 0.3 0.42 0.47 rg 48 ${y - 4} Td (${pdfText(doc.author)}) Tj ET`)
  // Accent rule
  ops.push(`q 0.965 0.65 0.125 rg 48 ${y - 18} 56 4 re f Q`)
  // Body
  y -= 52
  for (const line of bodyEs) {
    if (line) ops.push(`BT /F1 12 Tf 0.19 0.28 0.31 rg 48 ${y} Td (${pdfText(line)}) Tj ET`)
    y -= 20
  }
  // Footer
  ops.push(`q 0.086 0.522 0.6 rg 48 56 ${PAGE_W - 96} 1 re f Q`)
  ops.push(`BT /F1 10 Tf 0.3 0.42 0.47 rg 48 38 Td (${pdfText(`Página ${pageNumber} de ${PAGE_COUNT} - documento provisional`)}) Tj ET`)
  return ops.join('\n')
}

function buildPdf(doc) {
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
    const stream = pageStream(doc, i + 1)
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

for (const doc of documents) {
  const path = join(outDir, doc.file)
  writeFileSync(path, buildPdf(doc))
  console.log(`wrote ${path}`)
}

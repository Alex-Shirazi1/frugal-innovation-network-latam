/** Above this many KB, a size reads better in megabytes. */
const MB_THRESHOLD_KB = 1000

/**
 * Renders a size held in kilobytes for display.
 *
 * Nine of the bibliography's 43 papers are over a megabyte — the largest is
 * 6700 KB — and four-digit KB figures are hard to judge at a glance.
 *
 * Uses decimal megabytes (1 MB = 1000 KB), which is what a reader comparing
 * this against a download dialog will expect. A whole number of megabytes
 * drops its trailing zero, so 2000 KB reads "2 MB" rather than "2.0 MB".
 */
export function formatFileSize(sizeKb: number): string {
  if (sizeKb < MB_THRESHOLD_KB) return `${sizeKb} KB`

  const mb = sizeKb / MB_THRESHOLD_KB
  // `Number()` strips a trailing ".0" that toFixed always emits.
  return `${Number(mb.toFixed(1))} MB`
}

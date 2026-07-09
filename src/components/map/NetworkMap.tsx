import { useMemo, useRef, useState } from 'react'
import { useI18n } from '../../i18n/I18nContext'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { SectionHeading } from '../ui/SectionHeading'
import { useApiData } from '../../api/ApiDataContext'
import type { Institution, InstitutionCategory } from '../../api/types'
import { countryPaths, projectLatLon } from './geo'
import {
  INITIAL_VIEW,
  NODE_ZOOM_SCALE,
  clampView,
  toPercent,
  viewBoxOf,
  type ViewState,
} from './mapView'

/** Official brand palette — same hues as the production site's legend. */
export const categoryColors: Record<InstitutionCategory, string> = {
  universidad: '#168599',
  consultora: '#8ebc41',
  organizacion: '#f6a620',
  empresa: '#e94824',
  centro: '#4d6a79',
}

const allCategories = Object.keys(categoryColors) as InstitutionCategory[]
const TWEEN_MS = 420

/** Classic map-pin teardrop, tip at (0,0), drawn upward. */
const PIN_PATH =
  'M0 0C-1.8-4.5-8-8.9-8-14.5A8 8 0 0 1 8-14.5C8-8.9 1.8-4.5 0 0Z'

export function NetworkMap() {
  const { t } = useI18n()
  const { mappedInstitutions } = useApiData()
  const reducedMotion = useReducedMotion()
  const [view, setView] = useState<ViewState>(INITIAL_VIEW)
  const [active, setActive] = useState<Set<InstitutionCategory>>(new Set(allCategories))
  const [selected, setSelected] = useState<Institution | null>(null)
  const animRef = useRef<number>(0)
  const dragRef = useRef<{ x: number; y: number; view: ViewState; moved: boolean } | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  const visibleNodes = useMemo(
    () => mappedInstitutions.filter((node) => active.has(node.category)),
    [mappedInstitutions, active],
  )

  function animateTo(target: ViewState) {
    cancelAnimationFrame(animRef.current)
    const clamped = clampView(target)
    if (reducedMotion) {
      setView(clamped)
      return
    }
    const from = { ...view }
    const start = performance.now()
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / TWEEN_MS)
      const ease = 1 - Math.pow(1 - p, 3)
      setView({
        cx: from.cx + (clamped.cx - from.cx) * ease,
        cy: from.cy + (clamped.cy - from.cy) * ease,
        scale: from.scale + (clamped.scale - from.scale) * ease,
      })
      if (p < 1) animRef.current = requestAnimationFrame(tick)
    }
    animRef.current = requestAnimationFrame(tick)
  }

  function zoomBy(factor: number) {
    animateTo({ ...view, scale: view.scale * factor })
  }

  function selectNode(node: Institution & { coords: [number, number] }) {
    setSelected(node)
    const [x, y] = projectLatLon(node.coords[0], node.coords[1])
    animateTo({ cx: x, cy: y, scale: Math.max(view.scale, NODE_ZOOM_SCALE) })
  }

  function toggleCategory(category: InstitutionCategory) {
    setActive((prev) => {
      const next = new Set(prev)
      if (next.has(category)) next.delete(category)
      else next.add(category)
      return next
    })
    if (selected?.category === category) setSelected(null)
  }

  function onPointerDown(event: React.PointerEvent<SVGSVGElement>) {
    dragRef.current = { x: event.clientX, y: event.clientY, view, moved: false }
    ;(event.target as Element).setPointerCapture?.(event.pointerId)
  }

  function onPointerMove(event: React.PointerEvent<SVGSVGElement>) {
    const drag = dragRef.current
    const svg = svgRef.current
    if (!drag || !svg) return
    const dx = event.clientX - drag.x
    const dy = event.clientY - drag.y
    if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true
    const rect = svg.getBoundingClientRect()
    const viewW = svg.viewBox.baseVal.width
    const viewH = svg.viewBox.baseVal.height
    cancelAnimationFrame(animRef.current)
    setView(
      clampView({
        ...drag.view,
        cx: drag.view.cx - dx * (viewW / rect.width),
        cy: drag.view.cy - dy * (viewH / rect.height),
      }),
    )
  }

  function onPointerUp() {
    dragRef.current = null
  }

  const selectedPercent =
    selected && selected.coords
      ? toPercent(view, ...projectLatLon(selected.coords[0], selected.coords[1]))
      : null

  return (
    <section id="mapa" aria-labelledby="mapa-heading" className="bg-niebla py-(--spacing-section)">
      <div className="mx-auto max-w-7xl px-4 md:px-8">
        <SectionHeading
          id="mapa-heading"
          kicker={t.map.kicker}
          title={t.map.title}
          subtitle={t.map.subtitle}
        />

        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          {/* Filter sidebar */}
          <aside className="rounded-xl border border-carbon/10 bg-blanco p-5 h-fit lg:sticky lg:top-24 shadow-sm">
            <h3 className="font-display text-sm font-medium uppercase tracking-[0.18em] text-carbon">
              {t.map.filterTitle}
            </h3>
            <ul className="mt-4 space-y-1.5">
              {allCategories.map((category) => {
                const checked = active.has(category)
                const count = mappedInstitutions.filter((n) => n.category === category).length
                return (
                  <li key={category}>
                    <label className="flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors hover:bg-niebla">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleCategory(category)}
                        className="sr-only"
                      />
                      <span
                        aria-hidden="true"
                        className={`flex h-4.5 w-4.5 items-center justify-center rounded-md border transition-colors ${
                          checked ? 'border-transparent' : 'border-carbon/25 bg-white'
                        }`}
                        style={checked ? { background: categoryColors[category] } : undefined}
                      >
                        {checked ? (
                          <svg width="10" height="8" viewBox="0 0 10 8">
                            <path d="M1 4l2.6 2.6L9 1" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" />
                          </svg>
                        ) : null}
                      </span>
                      <span className={checked ? '' : 'text-pizarra/60 line-through'}>
                        {t.map.categories[category]}
                      </span>
                      <span className="ml-auto text-xs text-pizarra">{count}</span>
                    </label>
                  </li>
                )
              })}
            </ul>
            <p className="mt-4 border-t border-carbon/10 pt-3 text-xs text-pizarra">
              {visibleNodes.length} {t.map.nodesShown}
            </p>
            <button
              type="button"
              onClick={() => {
                setSelected(null)
                animateTo(INITIAL_VIEW)
              }}
              className="mt-3 w-full rounded-lg border border-teal/40 px-3 py-2 text-xs font-semibold text-teal transition-colors hover:bg-teal hover:text-blanco"
            >
              ⤾ {t.map.reset}
            </button>
          </aside>

          {/* Map canvas */}
          <div className="overflow-hidden rounded-xl border border-carbon/10 bg-blanco shadow-sm">
            <div className="relative">
              <svg
                ref={svgRef}
                viewBox={viewBoxOf(view)}
                className="block h-[420px] w-full touch-none cursor-grab active:cursor-grabbing sm:h-[500px] lg:h-[560px] bg-[#cde4ed]"
                role="application"
                aria-label={t.map.title}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
              >
                <g>
                  {countryPaths.map((country) => (
                    <path
                      key={country.name}
                      d={country.d}
                      fill={country.isMember ? '#eaf3ec' : '#f6f5f0'}
                      stroke="#b9c9ce"
                      strokeWidth={0.6 / Math.sqrt(view.scale)}
                      strokeLinejoin="round"
                    />
                  ))}
                </g>

                {visibleNodes.map((node) => {
                  const [x, y] = projectLatLon(node.coords[0], node.coords[1])
                  const isSelected = selected?.id === node.id
                  const pinScale = (isSelected ? 2.1 : 1.6) / Math.sqrt(view.scale)
                  return (
                    <g
                      key={node.id}
                      transform={`translate(${x} ${y}) scale(${pinScale})`}
                      className="cursor-pointer"
                      role="button"
                      tabIndex={0}
                      aria-label={node.name}
                      onClick={() => {
                        if (!dragRef.current?.moved) selectNode(node)
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') selectNode(node)
                      }}
                    >
                      <path
                        d={PIN_PATH}
                        fill={categoryColors[node.category]}
                        stroke="#ffffff"
                        strokeWidth="1.4"
                      />
                      <circle cx="0" cy="-14.5" r="3" fill="#ffffff" />
                    </g>
                  )
                })}
              </svg>

              {/* Tooltip popup */}
              {selected && selectedPercent ? (
                <div
                  className="absolute z-10 w-64 -translate-x-1/2 rounded-xl border border-carbon/10 bg-blanco p-4 shadow-xl"
                  style={{
                    left: `${Math.min(80, Math.max(20, selectedPercent.left))}%`,
                    top: `${Math.min(64, Math.max(5, selectedPercent.top + 4))}%`,
                  }}
                >
                  <span
                    className="inline-block rounded-full px-2 py-0.5 text-[11px] font-bold text-blanco"
                    style={{ background: categoryColors[selected.category] }}
                  >
                    {t.map.categories[selected.category]}
                  </span>
                  <h4 className="mt-2 text-sm font-bold leading-snug">{selected.name}</h4>
                  <p className="mt-1 text-xs text-pizarra">
                    {selected.city}, {selected.country}
                  </p>
                  <div className="mt-2.5 flex items-center justify-between">
                    <a
                      href={selected.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-bold text-teal hover:underline"
                    >
                      {t.map.visit} ↗
                    </a>
                    <button
                      type="button"
                      onClick={() => setSelected(null)}
                      className="text-xs text-pizarra hover:text-carbon"
                      aria-label={t.library.close}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ) : null}

              {/* Zoom controls */}
              <div className="absolute right-3 top-3 flex flex-col overflow-hidden rounded-lg border border-carbon/15 bg-blanco shadow-md">
                <button
                  type="button"
                  onClick={() => zoomBy(1.6)}
                  aria-label={t.map.zoomIn}
                  className="h-10 w-10 text-lg font-bold text-carbon transition-colors hover:bg-niebla"
                >
                  +
                </button>
                <button
                  type="button"
                  onClick={() => zoomBy(1 / 1.6)}
                  aria-label={t.map.zoomOut}
                  className="h-10 w-10 border-t border-carbon/10 text-lg font-bold text-carbon transition-colors hover:bg-niebla"
                >
                  −
                </button>
              </div>
            </div>

            {/* Legend bar — modern take on the original "LEYENDA" strip */}
            <div className="flex flex-col gap-3 bg-carbon px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <span className="font-display text-lg font-medium uppercase tracking-[0.25em] text-blanco/40">
                {t.map.legend}
              </span>
              <ul className="flex flex-wrap gap-x-5 gap-y-2">
                {allCategories.map((category) => (
                  <li key={category} className="flex items-center gap-2 text-xs font-semibold text-blanco/90">
                    <span
                      aria-hidden="true"
                      className="inline-block h-3 w-3 rounded-full ring-2 ring-white/25"
                      style={{ background: categoryColors[category] }}
                    />
                    {t.map.categories[category]}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

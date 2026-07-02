import { useMemo, useRef, useState } from 'react'
import { useI18n } from '../../i18n/I18nContext'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { SectionHeading } from '../ui/SectionHeading'
import {
  mappedInstitutions,
  offMapInstitutions,
  type Institution,
  type InstitutionCategory,
} from '../../data/institutions'
import { outlines, ringToPath, project, MAP_VIEW } from '../../data/latamOutline'
import {
  INITIAL_VIEW,
  NODE_ZOOM_SCALE,
  clampView,
  toPercent,
  viewBoxOf,
  type ViewState,
} from './mapView'

export const categoryColors: Record<InstitutionCategory, string> = {
  universidad: 'oklch(58% 0.14 40)',
  consultora: 'oklch(50% 0.1 250)',
  organizacion: 'oklch(48% 0.09 155)',
  empresa: 'oklch(62% 0.13 80)',
  centro: 'oklch(52% 0.15 320)',
}

const allCategories = Object.keys(categoryColors) as InstitutionCategory[]
const TWEEN_MS = 420

export function NetworkMap() {
  const { t } = useI18n()
  const reducedMotion = useReducedMotion()
  const [view, setView] = useState<ViewState>(INITIAL_VIEW)
  const [active, setActive] = useState<Set<InstitutionCategory>>(new Set(allCategories))
  const [selected, setSelected] = useState<Institution | null>(null)
  const animRef = useRef<number>(0)
  const dragRef = useRef<{ x: number; y: number; view: ViewState; moved: boolean } | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  const visibleNodes = useMemo(
    () => mappedInstitutions.filter((node) => active.has(node.category)),
    [active],
  )

  const outlinePaths = useMemo(() => outlines.map(ringToPath), [])

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
    const [x, y] = project([node.coords[1], node.coords[0]])
    animateTo({ cx: x, cy: y, scale: Math.max(view.scale, NODE_ZOOM_SCALE) })
  }

  function toggleCategory(category: InstitutionCategory) {
    setActive((prev) => {
      const next = new Set(prev)
      if (next.has(category)) next.delete(category)
      else next.add(category)
      return next
    })
    if (selected && !active.has(selected.category)) setSelected(null)
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
    const unitX = MAP_VIEW.width / drag.view.scale / rect.width
    const unitY = MAP_VIEW.height / drag.view.scale / rect.height
    cancelAnimationFrame(animRef.current)
    setView(clampView({ ...drag.view, cx: drag.view.cx - dx * unitX, cy: drag.view.cy - dy * unitY }))
  }

  function onPointerUp() {
    dragRef.current = null
  }

  const selectedPercent =
    selected && selected.coords
      ? toPercent(view, ...project([selected.coords[1], selected.coords[0]]))
      : null

  return (
    <section id="mapa" aria-labelledby="mapa-heading" className="bg-arena/60 py-(--spacing-section)">
      <div className="mx-auto max-w-7xl px-4 md:px-8">
        <SectionHeading
          id="mapa-heading"
          kicker={t.map.kicker}
          title={t.map.title}
          subtitle={t.map.subtitle}
        />

        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          {/* Filter sidebar */}
          <aside className="rounded-2xl border border-tinta/10 bg-white/70 p-5 h-fit lg:sticky lg:top-24">
            <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-tinta-suave">
              {t.map.filterTitle}
            </h3>
            <ul className="mt-4 space-y-1.5">
              {allCategories.map((category) => {
                const checked = active.has(category)
                const count = mappedInstitutions.filter((n) => n.category === category).length
                return (
                  <li key={category}>
                    <label className="flex cursor-pointer items-center gap-3 rounded-xl px-2.5 py-2 text-sm font-medium transition-colors hover:bg-arena">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleCategory(category)}
                        className="sr-only"
                      />
                      <span
                        aria-hidden="true"
                        className={`flex h-4.5 w-4.5 items-center justify-center rounded-md border transition-colors ${
                          checked ? 'border-transparent' : 'border-tinta/25 bg-white'
                        }`}
                        style={checked ? { background: categoryColors[category] } : undefined}
                      >
                        {checked ? (
                          <svg width="10" height="8" viewBox="0 0 10 8">
                            <path d="M1 4l2.6 2.6L9 1" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" />
                          </svg>
                        ) : null}
                      </span>
                      <span className={checked ? '' : 'text-tinta-suave/60 line-through'}>
                        {t.map.categories[category]}
                      </span>
                      <span className="ml-auto text-xs text-tinta-suave">{count}</span>
                    </label>
                  </li>
                )
              })}
            </ul>
            <p className="mt-4 border-t border-tinta/10 pt-3 text-xs text-tinta-suave">
              {visibleNodes.length} {t.map.nodesShown}
            </p>

            <div className="mt-5 border-t border-tinta/10 pt-4">
              <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-tinta-suave">
                {t.map.beyond}
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-tinta-suave">{t.map.beyondText}</p>
              <ul className="mt-2 space-y-1 text-sm">
                {offMapInstitutions.map((node) => (
                  <li key={node.id}>
                    <a
                      className="text-verde underline-offset-2 hover:underline"
                      href={node.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {node.name}
                    </a>{' '}
                    <span className="text-xs text-tinta-suave">· {node.country}</span>
                  </li>
                ))}
              </ul>
            </div>
          </aside>

          {/* Map canvas */}
          <div className="relative overflow-hidden rounded-3xl border border-tinta/10 bg-[oklch(93%_0.02_230)] shadow-inner">
            <svg
              ref={svgRef}
              viewBox={viewBoxOf(view)}
              className="block h-[420px] w-full touch-none cursor-grab active:cursor-grabbing sm:h-[520px] lg:h-[600px]"
              role="application"
              aria-label={t.map.title}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            >
              {outlinePaths.map((d, index) => (
                <path
                  key={index}
                  d={d}
                  fill="oklch(96% 0.02 100)"
                  stroke="oklch(70% 0.05 150)"
                  strokeWidth={1.6 / view.scale}
                  strokeLinejoin="round"
                />
              ))}

              {visibleNodes.map((node) => {
                const [x, y] = project([node.coords[1], node.coords[0]])
                const isSelected = selected?.id === node.id
                const r = (isSelected ? 9 : 6.5) / Math.sqrt(view.scale)
                return (
                  <g key={node.id}>
                    {isSelected ? (
                      <circle
                        cx={x}
                        cy={y}
                        r={r * 2.1}
                        fill="none"
                        stroke={categoryColors[node.category]}
                        strokeWidth={1.5 / view.scale}
                        opacity={0.6}
                      />
                    ) : null}
                    <circle
                      cx={x}
                      cy={y}
                      r={r}
                      fill={categoryColors[node.category]}
                      stroke="oklch(98% 0.01 90)"
                      strokeWidth={1.6 / view.scale}
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
                    />
                  </g>
                )
              })}
            </svg>

            {/* Tooltip popup */}
            {selected && selectedPercent ? (
              <div
                className="absolute z-10 w-60 -translate-x-1/2 rounded-2xl border border-tinta/10 bg-crema p-4 shadow-xl"
                style={{
                  left: `${Math.min(82, Math.max(18, selectedPercent.left))}%`,
                  top: `${Math.min(70, Math.max(6, selectedPercent.top + 3))}%`,
                }}
              >
                <span
                  className="inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold text-crema"
                  style={{ background: categoryColors[selected.category] }}
                >
                  {t.map.categories[selected.category]}
                </span>
                <h4 className="mt-2 text-sm font-semibold leading-snug">{selected.name}</h4>
                <p className="mt-1 text-xs text-tinta-suave">
                  {selected.city}, {selected.country}
                </p>
                <div className="mt-2.5 flex items-center justify-between">
                  <a
                    href={selected.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-semibold text-terracota hover:underline"
                  >
                    {t.map.visit} ↗
                  </a>
                  <button
                    type="button"
                    onClick={() => setSelected(null)}
                    className="text-xs text-tinta-suave hover:text-tinta"
                    aria-label={t.library.close}
                  >
                    ✕
                  </button>
                </div>
              </div>
            ) : null}

            {/* Zoom controls */}
            <div className="absolute right-3 top-3 flex flex-col gap-1.5">
              <button
                type="button"
                onClick={() => zoomBy(1.5)}
                aria-label={t.map.zoomIn}
                className="h-10 w-10 rounded-xl border border-tinta/10 bg-crema text-lg font-semibold shadow-sm transition-colors hover:bg-arena"
              >
                +
              </button>
              <button
                type="button"
                onClick={() => zoomBy(1 / 1.5)}
                aria-label={t.map.zoomOut}
                className="h-10 w-10 rounded-xl border border-tinta/10 bg-crema text-lg font-semibold shadow-sm transition-colors hover:bg-arena"
              >
                −
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelected(null)
                  animateTo(INITIAL_VIEW)
                }}
                aria-label={t.map.reset}
                className="h-10 w-10 rounded-xl border border-tinta/10 bg-crema text-sm shadow-sm transition-colors hover:bg-arena"
              >
                ⤾
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

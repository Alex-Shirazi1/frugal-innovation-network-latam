import { MAP_VIEW } from '../../data/latamOutline'

export interface ViewState {
  cx: number
  cy: number
  scale: number
}

export const INITIAL_VIEW: ViewState = {
  cx: MAP_VIEW.width / 2,
  cy: MAP_VIEW.height / 2,
  scale: 1,
}

export const MIN_SCALE = 1
export const MAX_SCALE = 7
export const NODE_ZOOM_SCALE = 3.6

export function clampView(view: ViewState): ViewState {
  const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, view.scale))
  const halfW = MAP_VIEW.width / scale / 2
  const halfH = MAP_VIEW.height / scale / 2
  return {
    scale,
    cx: Math.min(MAP_VIEW.width - halfW, Math.max(halfW, view.cx)),
    cy: Math.min(MAP_VIEW.height - halfH, Math.max(halfH, view.cy)),
  }
}

export function viewBoxOf({ cx, cy, scale }: ViewState): string {
  const w = MAP_VIEW.width / scale
  const h = MAP_VIEW.height / scale
  return `${cx - w / 2} ${cy - h / 2} ${w} ${h}`
}

/** Position of an SVG point as a percentage of the rendered map, for HTML overlays. */
export function toPercent(view: ViewState, x: number, y: number): { left: number; top: number } {
  const w = MAP_VIEW.width / view.scale
  const h = MAP_VIEW.height / view.scale
  return {
    left: ((x - (view.cx - w / 2)) / w) * 100,
    top: ((y - (view.cy - h / 2)) / h) * 100,
  }
}

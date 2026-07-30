import { MAP_W, MAP_H, projectLatLon } from './geo'

export interface ViewState {
  cx: number
  cy: number
  scale: number
}

export const MIN_SCALE = 1
export const MAX_SCALE = 48
export const NODE_ZOOM_SCALE = 18

/**
 * Initial frame: the Atlantic-facing world — the Americas down the left, Europe
 * and Africa on the right.
 *
 * The network is no longer only Latin American: it has members in Spain,
 * France and Finland, and a frame fitted to Latin America opened with those
 * four nodes off-screen, so the map understated the network's reach until the
 * reader thought to zoom out. This frame puts all 37 located members on screen
 * at once.
 *
 * `clampView` keeps the frame inside the canvas, which at this width means it
 * sits flush against the antimeridian — hence the empty Pacific on the left
 * edge. That is deliberate: pulling the frame east enough to remove it would
 * push Alaska and the US West Coast out of view.
 */
function atlanticView(): ViewState {
  const [x0, y0] = projectLatLon(72, -180)
  const [x1, y1] = projectLatLon(-56, 87)
  const scale = Math.min(MAP_W / (x1 - x0), MAP_H / (y1 - y0))
  return { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, scale }
}

export const INITIAL_VIEW: ViewState = atlanticView()

export function clampView(view: ViewState): ViewState {
  const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, view.scale))
  const halfW = MAP_W / scale / 2
  const halfH = MAP_H / scale / 2
  return {
    scale,
    cx: Math.min(MAP_W - halfW, Math.max(halfW, view.cx)),
    cy: Math.min(MAP_H - halfH, Math.max(halfH, view.cy)),
  }
}

export function viewBoxOf({ cx, cy, scale }: ViewState): string {
  const w = MAP_W / scale
  const h = MAP_H / scale
  return `${cx - w / 2} ${cy - h / 2} ${w} ${h}`
}

/** Position of a canvas point as a percentage of the rendered map, for HTML overlays. */
export function toPercent(view: ViewState, x: number, y: number): { left: number; top: number } {
  const w = MAP_W / view.scale
  const h = MAP_H / view.scale
  return {
    left: ((x - (view.cx - w / 2)) / w) * 100,
    top: ((y - (view.cy - h / 2)) / h) * 100,
  }
}

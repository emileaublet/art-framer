import sharp from 'sharp'
import { warpArtwork } from './warp.js'
import { resolveScene } from './scenes.js'
import { computeLayout } from './geometry.js'
import type { FrameOptions, Quad } from './types.js'
import { CompositorError } from './types.js'
import type { Rect } from './geometry.js'

const FRAME_COLORS: Record<string, string> = {
  'black-paint': '#1a1a1a',
  'white-paint': '#f0f0f0',
  oak:           '#c8a96e',
  walnut:        '#5c3d1e',
  cherry:        '#a0522d',
  maple:         '#d4a96a',
  ash:           '#b8a898',
  pine:          '#d4b896',
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

function resolveMatHex(color: string): string {
  if (color === 'white') return '#ffffff'
  if (color === 'eggshell') return '#f4f0e8'
  return color
}

// Cross-product point-in-quad test for clockwise quad [TL, TR, BR, BL].
// A pixel is inside when all 4 edge cross products are >= 0.
function pointInQuad(x: number, y: number, quad: Quad): boolean {
  for (let i = 0; i < 4; i++) {
    const [ax, ay] = quad[i]
    const [bx, by] = quad[(i + 1) % 4]
    if ((bx - ax) * (y - ay) - (by - ay) * (x - ax) < 0) return false
  }
  return true
}

// Build a blurred silhouette of frameQuad used for the drop shadow.
// Returns a single-channel buffer, same size as the canvas.
async function buildShadow(
  canvasW: number,
  canvasH: number,
  frameQuad: Quad,
  blurSigma: number,
): Promise<Buffer> {
  const silhouette = Buffer.alloc(canvasW * canvasH, 0)
  for (let py = 0; py < canvasH; py++) {
    for (let px = 0; px < canvasW; px++) {
      if (pointInQuad(px, py, frameQuad)) {
        silhouette[py * canvasW + px] = 255
      }
    }
  }
  return sharp(silhouette, { raw: { width: canvasW, height: canvasH, channels: 1 } })
    .blur(blurSigma)
    .raw()
    .toBuffer()
}

// Glass reflection intensity for a pixel at (px,py) within artQuad.
// Returns a 0..1 value: strongest at the top-left, fading toward bottom-right.
function glassReflection(px: number, py: number, artQuad: Quad): number {
  const tlX = artQuad[0][0], tlY = artQuad[0][1]
  const trX = artQuad[1][0], brY = artQuad[2][1]
  const w = trX - tlX
  const h = brY - tlY
  if (w <= 0 || h <= 0) return 0
  const relX = (px - tlX) / w
  const relY = (py - tlY) / h
  // Diagonal gradient: bright streak from top-left, fading out
  return Math.max(0, 0.10 - (relX + relY) * 0.07)
}

const SHADOW_SIGMA   = 10   // gaussian blur radius (px at canvas scale)
const SHADOW_DX      = 3    // shadow offset right
const SHADOW_DY      = 5    // shadow offset down
const SHADOW_OPACITY = 0.40 // max shadow darkness (0–1)

const FRAME_OUTER_HIGHLIGHT_PX = 1
const FRAME_INNER_SHADOW_PX    = 3
const FRAME_SIDE_BRIGHTNESS    = { top: 1.18, left: 1.08, bottom: 0.80, right: 0.88 } as const

function paintFrameFlat(
  px: number,
  py: number,
  frameRect: Rect,
  matRect: Rect,
  base: [number, number, number],
): [number, number, number] {
  // Distances to outer frame edges
  const dTop    = py - frameRect.y
  const dLeft   = px - frameRect.x
  const dBottom = (frameRect.y + frameRect.h - 1) - py
  const dRight  = (frameRect.x + frameRect.w - 1) - px
  const dOuter  = Math.min(dTop, dLeft, dBottom, dRight)

  // Distance to nearest mat boundary (always positive — pixel is in frame region, outside mat)
  const ds = [
    matRect.x - px,
    py - (matRect.y + matRect.h - 1),
    matRect.y - py,
    px - (matRect.x + matRect.w - 1),
  ].filter(d => d > 0)
  const dInner = ds.length > 0 ? Math.min(...ds) : 0

  const [r, g, b] = base

  // 1px outer highlight
  if (dOuter <= FRAME_OUTER_HIGHLIGHT_PX) {
    return [Math.min(255, r + 40), Math.min(255, g + 40), Math.min(255, b + 40)]
  }

  // Inner shadow at mat boundary
  if (dInner <= FRAME_INNER_SHADOW_PX) {
    const t = dInner / FRAME_INNER_SHADOW_PX  // 0 = edge (darkest), 1 = base
    const m = 0.25 + t * 0.75
    return [Math.round(r * m), Math.round(g * m), Math.round(b * m)]
  }

  // Dominant side: nearest outer edge determines brightness
  const minOuter = Math.min(dTop, dLeft, dBottom, dRight)
  let mult: number
  if      (minOuter === dTop)    mult = FRAME_SIDE_BRIGHTNESS.top
  else if (minOuter === dLeft)   mult = FRAME_SIDE_BRIGHTNESS.left
  else if (minOuter === dBottom) mult = FRAME_SIDE_BRIGHTNESS.bottom
  else                           mult = FRAME_SIDE_BRIGHTNESS.right

  return [
    Math.min(255, Math.max(0, Math.round(r * mult))),
    Math.min(255, Math.max(0, Math.round(g * mult))),
    Math.min(255, Math.max(0, Math.round(b * mult))),
  ]
}

export async function composite(artworkBuffer: Buffer, opts: FrameOptions): Promise<Buffer> {
  const { bgColor } = resolveScene(opts.scene)

  let layout
  try {
    layout = computeLayout(opts, bgColor)
  } catch (err) {
    throw new CompositorError('Layout computation failed', { cause: err })
  }

  const { canvasW, canvasH, artRect, matRect, frameRect, wallColor, frameQuad, matQuad, artQuad } = layout

  // Decode and scale artwork to artRect dimensions (source buffer for warp)
  let artworkRaw: Buffer
  try {
    artworkRaw = await sharp(artworkBuffer)
      .resize(artRect.w, artRect.h, { fit: 'fill' })
      .ensureAlpha()
      .raw()
      .toBuffer()
  } catch (err) {
    throw new CompositorError('Failed to decode or resize artwork', { cause: err })
  }

  // Warp artwork into full canvas space using artQuad as destination
  const warpedRaw = warpArtwork(artworkRaw, artRect.w, artRect.h, artQuad, canvasW, canvasH)

  // Pre-compute blurred shadow silhouette
  const shadowBuf = await buildShadow(canvasW, canvasH, frameQuad, SHADOW_SIGMA)

  const wallRgb  = hexToRgb(wallColor)
  const frameRgb = hexToRgb(FRAME_COLORS[opts.frame.material] ?? '#888888')
  const matRgb   = hexToRgb(resolveMatHex(opts.mat.color))

  const canvas = Buffer.alloc(canvasW * canvasH * 4)

  for (let py = 0; py < canvasH; py++) {
    for (let px = 0; px < canvasW; px++) {
      const i = (py * canvasW + px) * 4

      if (pointInQuad(px, py, artQuad)) {
        // Artwork + subtle glass reflection (diagonal highlight, top-left to bottom-right)
        const glassT = glassReflection(px, py, artQuad)
        canvas[i]     = Math.min(255, Math.round(warpedRaw[i]     + (255 - warpedRaw[i])     * glassT))
        canvas[i + 1] = Math.min(255, Math.round(warpedRaw[i + 1] + (255 - warpedRaw[i + 1]) * glassT))
        canvas[i + 2] = Math.min(255, Math.round(warpedRaw[i + 2] + (255 - warpedRaw[i + 2]) * glassT))
        canvas[i + 3] = 255
      } else if (pointInQuad(px, py, matQuad)) {
        canvas[i]     = matRgb[0]
        canvas[i + 1] = matRgb[1]
        canvas[i + 2] = matRgb[2]
        canvas[i + 3] = 255
      } else if (pointInQuad(px, py, frameQuad)) {
        let fr: number, fg: number, fb: number
        if (opts.angleDeg === 0) {
          const [cr, cg, cb] = paintFrameFlat(px, py, frameRect, matRect, frameRgb)
          fr = cr; fg = cg; fb = cb
        } else {
          fr = frameRgb[0]; fg = frameRgb[1]; fb = frameRgb[2]
        }
        canvas[i]     = fr
        canvas[i + 1] = fg
        canvas[i + 2] = fb
        canvas[i + 3] = 255
      } else {
        // Wall: darken by shadow cast from frame
        const sx = Math.max(0, Math.min(canvasW - 1, px - SHADOW_DX))
        const sy = Math.max(0, Math.min(canvasH - 1, py - SHADOW_DY))
        const shadowT = (shadowBuf[sy * canvasW + sx] / 255) * SHADOW_OPACITY
        const d = 1 - shadowT
        canvas[i]     = Math.round(wallRgb[0] * d)
        canvas[i + 1] = Math.round(wallRgb[1] * d)
        canvas[i + 2] = Math.round(wallRgb[2] * d)
        canvas[i + 3] = 255
      }
    }
  }

  try {
    return await sharp(canvas, { raw: { width: canvasW, height: canvasH, channels: 4 } })
      .png()
      .toBuffer()
  } catch (err) {
    throw new CompositorError('Failed to encode composite', { cause: err })
  }
}

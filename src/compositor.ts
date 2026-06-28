import sharp from 'sharp'
import { warpArtwork } from './warp.js'
import { resolveScene } from './scenes.js'
import { computeLayout } from './geometry.js'
import type { FrameOptions, Quad } from './types.js'
import { CompositorError } from './types.js'

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

export async function composite(artworkBuffer: Buffer, opts: FrameOptions): Promise<Buffer> {
  const { bgColor } = resolveScene(opts.scene)

  let layout
  try {
    layout = computeLayout(opts, bgColor)
  } catch (err) {
    throw new CompositorError('Layout computation failed', { cause: err })
  }

  const { canvasW, canvasH, artRect, wallColor, frameQuad, matQuad, artQuad } = layout

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

  const wallRgb   = hexToRgb(wallColor)
  const frameRgb  = hexToRgb(FRAME_COLORS[opts.frame.material] ?? '#888888')
  const matRgb    = hexToRgb(resolveMatHex(opts.mat.color))

  const canvas = Buffer.alloc(canvasW * canvasH * 4)

  for (let py = 0; py < canvasH; py++) {
    for (let px = 0; px < canvasW; px++) {
      const i = (py * canvasW + px) * 4

      if (pointInQuad(px, py, artQuad)) {
        canvas[i]     = warpedRaw[i]
        canvas[i + 1] = warpedRaw[i + 1]
        canvas[i + 2] = warpedRaw[i + 2]
        canvas[i + 3] = 255
      } else if (pointInQuad(px, py, matQuad)) {
        canvas[i]     = matRgb[0]
        canvas[i + 1] = matRgb[1]
        canvas[i + 2] = matRgb[2]
        canvas[i + 3] = 255
      } else if (pointInQuad(px, py, frameQuad)) {
        canvas[i]     = frameRgb[0]
        canvas[i + 1] = frameRgb[1]
        canvas[i + 2] = frameRgb[2]
        canvas[i + 3] = 255
      } else {
        canvas[i]     = wallRgb[0]
        canvas[i + 1] = wallRgb[1]
        canvas[i + 2] = wallRgb[2]
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

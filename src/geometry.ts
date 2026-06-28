import type { FrameOptions, Quad } from './types.js'
import { CompositorError } from './types.js'

export interface Rect { x: number; y: number; w: number; h: number }

export interface Layout {
  canvasW: number
  canvasH: number
  ppi: number          // effective pixels-per-inch after scale
  artRect: Rect        // artwork placement area = mat opening
  matRect: Rect        // outer edge of mat = inner edge of frame
  frameRect: Rect      // outer edge of frame
  wallColor: string
  artQuad: Quad        // destination quad for warpArtwork (canvas coordinates)
}

const BASE_PPI = 100
const MAX_CANVAS_PX = 2400
const WALL_MARGIN_RATIO = 0.2

export function computeLayout(opts: FrameOptions, wallColor: string): Layout {
  if (opts.angleDeg < 0 || opts.angleDeg > 45) {
    throw new CompositorError(`angleDeg must be 0–45, got ${opts.angleDeg}`)
  }

  const artW = opts.artworkWidthIn * BASE_PPI
  const artH = opts.artworkHeightIn * BASE_PPI
  const matPx = opts.mat.widthIn * BASE_PPI
  const framePx = opts.frame.thicknessIn * BASE_PPI

  const framedW = artW + 2 * (matPx + framePx)
  const framedH = artH + 2 * (matPx + framePx)
  const marginX = framedW * WALL_MARGIN_RATIO
  const marginY = framedH * WALL_MARGIN_RATIO

  const rawW = framedW + 2 * marginX
  const rawH = framedH + 2 * marginY

  const scale = Math.min(1, MAX_CANVAS_PX / Math.max(rawW, rawH))
  const canvasW = Math.round(rawW * scale)
  const canvasH = Math.round(rawH * scale)
  const ppi = BASE_PPI * scale

  const frameX = Math.round(marginX * scale)
  const frameY = Math.round(marginY * scale)
  const frameW = Math.round(framedW * scale)
  const frameH = Math.round(framedH * scale)

  const framePxS = Math.round(framePx * scale)
  const matPxS = Math.round(matPx * scale)

  const matX = frameX + framePxS
  const matY = frameY + framePxS
  const matW = frameW - 2 * framePxS
  const matH = frameH - 2 * framePxS

  const artX = matX + matPxS
  const artY = matY + matPxS
  const artRW = matW - 2 * matPxS
  const artRH = matH - 2 * matPxS

  const frameRect: Rect = { x: frameX, y: frameY, w: frameW, h: frameH }
  const matRect: Rect   = { x: matX,   y: matY,   w: matW,   h: matH   }
  const artRect: Rect   = { x: artX,   y: artY,   w: artRW,  h: artRH  }

  let artQuad: Quad
  if (opts.angleDeg === 0) {
    artQuad = [
      [artX,        artY       ],
      [artX + artRW, artY       ],
      [artX + artRW, artY + artRH],
      [artX,        artY + artRH],
    ]
  } else {
    const theta = (opts.angleDeg * Math.PI) / 180
    const hShift = Math.round(artRW * Math.sin(theta) * 0.25)
    const vShift = Math.round(artRH * Math.sin(theta) * 0.05)
    artQuad = [
      [artX + hShift,          artY + vShift         ],  // TL
      [artX + artRW - hShift,  artY + vShift         ],  // TR
      [artX + artRW - hShift,  artY + artRH - vShift ],  // BR
      [artX + hShift,          artY + artRH - vShift ],  // BL
    ]
  }

  return { canvasW, canvasH, ppi, artRect, matRect, frameRect, wallColor, artQuad }
}

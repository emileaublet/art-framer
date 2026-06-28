import type { FrameOptions, Quad } from './types.js'
import { CompositorError } from './types.js'

export interface Rect { x: number; y: number; w: number; h: number }

export interface Layout {
  canvasW: number
  canvasH: number
  ppi: number          // effective pixels-per-inch after scale
  artRect: Rect        // artwork resize dimensions (source buffer size)
  matRect: Rect        // flat rect — kept for tests
  frameRect: Rect      // flat rect — kept for tests
  wallColor: string
  frameQuad: Quad      // perspective-correct outer frame corners
  matQuad: Quad        // perspective-correct mat opening corners
  artQuad: Quad        // perspective-correct artwork corners (warpArtwork destination)
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

  let frameQuad: Quad, matQuad: Quad, artQuad: Quad

  if (opts.angleDeg === 0) {
    frameQuad = [
      [frameX,          frameY         ],
      [frameX + frameW, frameY         ],
      [frameX + frameW, frameY + frameH],
      [frameX,          frameY + frameH],
    ]
    matQuad = [
      [matX,        matY       ],
      [matX + matW, matY       ],
      [matX + matW, matY + matH],
      [matX,        matY + matH],
    ]
    artQuad = [
      [artX,         artY        ],
      [artX + artRW, artY        ],
      [artX + artRW, artY + artRH],
      [artX,         artY + artRH],
    ]
  } else {
    // Perspective trapezoid: left side stays fixed, right side recedes.
    // Horizontal compression: cos(θ). Vertical pinch on receding side: sin(θ) × PINCH.
    const theta = (opts.angleDeg * Math.PI) / 180
    const cosT = Math.cos(theta)
    const sinT = Math.sin(theta)
    const PINCH = 0.35  // fraction of half-height lost on the far (right) side

    const frameCY = frameY + frameH / 2
    const fTL: [number, number] = [frameX,                              frameY]
    const fTR: [number, number] = [frameX + Math.round(frameW * cosT),  Math.round(frameCY - (frameH / 2) * (1 - sinT * PINCH))]
    const fBR: [number, number] = [frameX + Math.round(frameW * cosT),  Math.round(frameCY + (frameH / 2) * (1 - sinT * PINCH))]
    const fBL: [number, number] = [frameX,                              frameY + frameH]
    frameQuad = [fTL, fTR, fBR, fBL]

    // Mat quad: inset from frame by framePxS. Horizontal inset foreshortened on right.
    const rInsetF = Math.round(framePxS * cosT)
    const mTL: [number, number] = [fTL[0] + framePxS, fTL[1] + framePxS]
    const mTR: [number, number] = [fTR[0] - rInsetF,  fTR[1] + framePxS]
    const mBR: [number, number] = [fBR[0] - rInsetF,  fBR[1] - framePxS]
    const mBL: [number, number] = [fBL[0] + framePxS, fBL[1] - framePxS]
    matQuad = [mTL, mTR, mBR, mBL]

    // Art quad: inset from mat by matPxS. Same foreshortening on right.
    const rInsetM = Math.round(matPxS * cosT)
    const aTL: [number, number] = [mTL[0] + matPxS, mTL[1] + matPxS]
    const aTR: [number, number] = [mTR[0] - rInsetM, mTR[1] + matPxS]
    const aBR: [number, number] = [mBR[0] - rInsetM, mBR[1] - matPxS]
    const aBL: [number, number] = [mBL[0] + matPxS,  mBL[1] - matPxS]
    artQuad = [aTL, aTR, aBR, aBL]
  }

  return { canvasW, canvasH, ppi, artRect, matRect, frameRect, wallColor, frameQuad, matQuad, artQuad }
}

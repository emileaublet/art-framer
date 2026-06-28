import { describe, it, expect } from 'vitest'
import { computeLayout } from '../src/geometry.js'
import { CompositorError } from '../src/types.js'
import type { FrameOptions } from '../src/types.js'

const baseOpts: FrameOptions = {
  artworkWidthIn: 10,
  artworkHeightIn: 14,
  frame: { material: 'oak', thicknessIn: 1.5, depthIn: 0.75 },
  mat: { widthIn: 2, color: 'white' },
  scene: 'white-gallery',
  angleDeg: 0,
  provider: { prePass: async (b) => b, postPass: async (b) => b },
  output: 'out.png',
}

describe('computeLayout', () => {
  it('artRect has correct aspect ratio', () => {
    const { artRect } = computeLayout(baseOpts, '#f5f5f5')
    expect(artRect.w / artRect.h).toBeCloseTo(10 / 14, 1)
  })

  it('frameRect contains matRect, matRect contains artRect', () => {
    const { frameRect, matRect, artRect } = computeLayout(baseOpts, '#f5f5f5')
    expect(matRect.x).toBeGreaterThan(frameRect.x)
    expect(matRect.y).toBeGreaterThan(frameRect.y)
    expect(artRect.x).toBeGreaterThan(matRect.x)
    expect(artRect.y).toBeGreaterThan(matRect.y)
    expect(matRect.x + matRect.w).toBeLessThan(frameRect.x + frameRect.w)
    expect(artRect.x + artRect.w).toBeLessThan(matRect.x + matRect.w)
  })

  it('canvas longest side is at most MAX_CANVAS_PX (2400)', () => {
    const layout = computeLayout(baseOpts, '#f5f5f5')
    expect(Math.max(layout.canvasW, layout.canvasH)).toBeLessThanOrEqual(2400)
  })

  it('wallColor is passed through to layout', () => {
    const layout = computeLayout(baseOpts, '#aabbcc')
    expect(layout.wallColor).toBe('#aabbcc')
  })

  it('artQuad is a perfect rectangle for angleDeg=0', () => {
    const { artQuad } = computeLayout(baseOpts, '#f5f5f5')
    // [TL, TR, BR, BL]
    expect(artQuad[0][0]).toBe(artQuad[3][0])  // TL.x === BL.x
    expect(artQuad[1][0]).toBe(artQuad[2][0])  // TR.x === BR.x
    expect(artQuad[0][1]).toBe(artQuad[1][1])  // TL.y === TR.y
    expect(artQuad[2][1]).toBe(artQuad[3][1])  // BR.y === BL.y
  })

  it('artQuad is a trapezoid for angleDeg=20', () => {
    const { artQuad } = computeLayout({ ...baseOpts, angleDeg: 20 }, '#f5f5f5')
    expect(artQuad[0][0]).toBe(artQuad[3][0])  // still symmetric vertically
    expect(artQuad[1][0]).toBe(artQuad[2][0])
    expect(artQuad[0][0]).toBeGreaterThan(0)    // left edge shifted right
    expect(artQuad[0][0]).toBeLessThan(artQuad[1][0])  // still has width
  })

  it('throws CompositorError for angleDeg > 45', () => {
    expect(() => computeLayout({ ...baseOpts, angleDeg: 50 }, '#f5f5f5'))
      .toThrow(CompositorError)
  })

  it('throws CompositorError for negative angleDeg', () => {
    expect(() => computeLayout({ ...baseOpts, angleDeg: -1 }, '#f5f5f5'))
      .toThrow(CompositorError)
  })

  it('wider artwork produces wider artRect', () => {
    const portrait = computeLayout(baseOpts, '#f5f5f5')            // 10"×14"
    const landscape = computeLayout({ ...baseOpts, artworkWidthIn: 20, artworkHeightIn: 14 }, '#f5f5f5')
    expect(landscape.artRect.w).toBeGreaterThan(portrait.artRect.w)
  })
})

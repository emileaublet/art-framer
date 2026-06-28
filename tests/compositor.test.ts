import { describe, it, expect } from 'vitest'
import { composite } from '../src/compositor.js'
import { CompositorError } from '../src/types.js'
import type { FrameOptions } from '../src/types.js'
import sharp from 'sharp'
import { computeLayout } from '../src/geometry.js'

async function makeColorPng(width: number, height: number, r: number, g: number, b: number): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 4, background: { r, g, b, alpha: 1 } },
  }).png().toBuffer()
}

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

describe('composite', () => {
  it('returns a valid PNG Buffer', async () => {
    const result = await composite(await makeColorPng(400, 560, 255, 0, 0), baseOpts)
    const meta = await sharp(result).metadata()
    expect(meta.format).toBe('png')
    expect(meta.width).toBeGreaterThan(0)
    expect(meta.height).toBeGreaterThan(0)
  })

  it('output dimensions are within 2400px on longest side', async () => {
    const result = await composite(await makeColorPng(400, 560, 255, 0, 0), baseOpts)
    const meta = await sharp(result).metadata()
    expect(Math.max(meta.width!, meta.height!)).toBeLessThanOrEqual(2400)
  })

  it('artwork aspect ratio is preserved (center region is artwork color)', async () => {
    // Red artwork — center of output should be red
    const result = await composite(await makeColorPng(400, 560, 200, 0, 0), baseOpts)
    const { width, height } = await sharp(result).metadata()
    const { data } = await sharp(result)
      .extract({ left: Math.round(width! / 2) - 1, top: Math.round(height! / 2) - 1, width: 1, height: 1 })
      .raw().toBuffer({ resolveWithObject: true })
    expect(data[0]).toBeGreaterThan(150)  // R channel
    expect(data[1]).toBeLessThan(50)      // G channel low
  })

  it('works with walnut frame and dark-moody scene', async () => {
    const result = await composite(await makeColorPng(300, 400, 100, 150, 200), {
      ...baseOpts,
      frame: { material: 'walnut', thicknessIn: 2, depthIn: 1 },
      mat: { widthIn: 1.5, color: 'eggshell' },
      scene: 'dark-moody',
    })
    expect(await sharp(result).metadata()).toMatchObject({ format: 'png' })
  })

  it('works with black-paint frame and custom scene description', async () => {
    const result = await composite(await makeColorPng(300, 400, 80, 120, 200), {
      ...baseOpts,
      frame: { material: 'black-paint', thicknessIn: 1, depthIn: 0.5 },
      scene: 'exposed brick wall with afternoon light',
    })
    expect(await sharp(result).metadata()).toMatchObject({ format: 'png' })
  })

  it('works with angle=20', async () => {
    const result = await composite(await makeColorPng(400, 560, 0, 200, 100), {
      ...baseOpts,
      angleDeg: 20,
    })
    expect(await sharp(result).metadata()).toMatchObject({ format: 'png' })
  })

  it('throws CompositorError for angleDeg > 45', async () => {
    await expect(composite(await makeColorPng(400, 560, 255, 0, 0), { ...baseOpts, angleDeg: 50 }))
      .rejects.toBeInstanceOf(CompositorError)
  })

  it('wider artwork produces wider output', async () => {
    const portrait = await composite(await makeColorPng(400, 560, 255, 0, 0), baseOpts)  // 10"×14"
    const landscape = await composite(await makeColorPng(560, 400, 255, 0, 0), {
      ...baseOpts, artworkWidthIn: 20, artworkHeightIn: 14,
    })
    expect((await sharp(landscape).metadata()).width).toBeGreaterThan(
      (await sharp(portrait).metadata()).width!,
    )
  })
})

async function samplePixel(img: Buffer, x: number, y: number): Promise<[number, number, number]> {
  const { data } = await sharp(img)
    .extract({ left: x, top: y, width: 1, height: 1 })
    .raw().toBuffer({ resolveWithObject: true })
  return [data[0], data[1], data[2]]
}

describe('frame shading (flat perspective)', () => {
  it('top frame strip is lighter than bottom frame strip', async () => {
    const artwork = await makeColorPng(400, 560, 128, 128, 128)
    const result = await composite(artwork, baseOpts)
    const layout = computeLayout(baseOpts, '#f5f5f5')
    const { frameRect, matRect } = layout
    const midX = Math.round(frameRect.x + frameRect.w / 2)
    const topY  = Math.round(frameRect.y + (matRect.y - frameRect.y) / 2)
    const botY  = Math.round(matRect.y + matRect.h + (frameRect.y + frameRect.h - matRect.y - matRect.h) / 2)
    const top = await samplePixel(result, midX, topY)
    const bot = await samplePixel(result, midX, botY)
    const brightness = (px: [number,number,number]) => px[0] + px[1] + px[2]
    expect(brightness(top)).toBeGreaterThan(brightness(bot))
  })

  it('inner frame edge is darker than frame center', async () => {
    const artwork = await makeColorPng(400, 560, 128, 128, 128)
    const result = await composite(artwork, baseOpts)
    const layout = computeLayout(baseOpts, '#f5f5f5')
    const { frameRect, matRect } = layout
    const midX     = Math.round(frameRect.x + frameRect.w / 2)
    const innerEdgeY = matRect.y - 1  // 1px inside frame at top mat boundary
    const topCenterY = Math.round(frameRect.y + (matRect.y - frameRect.y) / 2)
    const edge   = await samplePixel(result, midX, innerEdgeY)
    const center = await samplePixel(result, midX, topCenterY)
    const brightness = (px: [number,number,number]) => px[0] + px[1] + px[2]
    expect(brightness(edge)).toBeLessThan(brightness(center))
  })

  it('angled frame (angleDeg > 0) uses flat frame color, not shaded', async () => {
    const artwork = await makeColorPng(400, 560, 128, 128, 128)
    // For flat perspective: top strip is LIGHTER (brightness 1.18×)
    // For angled: frame pixels use flat base color — should NOT be as bright as flat top strip
    const flatResult   = await composite(artwork, { ...baseOpts, angleDeg: 0,  frame: { ...baseOpts.frame, material: 'oak' } })
    const angledResult = await composite(artwork, { ...baseOpts, angleDeg: 15, frame: { ...baseOpts.frame, material: 'oak' } })
    const layout = computeLayout(baseOpts, '#f5f5f5')
    const { frameRect, matRect } = layout
    // Sample center of top frame strip (always a frame pixel in flat perspective)
    const x = Math.round(frameRect.x + frameRect.w / 2)
    const y = Math.round(frameRect.y + (matRect.y - frameRect.y) / 2)
    const flatPx   = await samplePixel(flatResult,   x, y)
    const angledPx = await samplePixel(angledResult, x, y)
    // Flat top-strip pixels are brighter due to shading (1.18×); angled uses flat color
    // So flatPx should be noticeably brighter than angledPx
    const brightness = (p: [number,number,number]) => p[0] + p[1] + p[2]
    expect(brightness(flatPx)).toBeGreaterThan(brightness(angledPx))
  })
})

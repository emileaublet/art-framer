import { describe, it, expect } from 'vitest'
import { composite } from '../src/compositor.js'
import sharp from 'sharp'

async function makeRedPng(width = 200, height = 150): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 4, background: { r: 255, g: 0, b: 0, alpha: 1 } },
  }).png().toBuffer()
}

describe('composite', () => {
  it('returns a Buffer', async () => {
    const artwork = await makeRedPng()
    const result = await composite(artwork, 'thin-black')
    expect(result).toBeInstanceOf(Buffer)
    expect(result.length).toBeGreaterThan(0)
  })

  it('output is a valid PNG with correct dimensions', async () => {
    const artwork = await makeRedPng()
    const result = await composite(artwork, 'thin-black')
    const meta = await sharp(result).metadata()
    expect(meta.format).toBe('png')
    expect(meta.width).toBe(1200)
    expect(meta.height).toBe(900)
  })

  it('output differs from template (artwork was composited)', async () => {
    const artwork = await makeRedPng()
    const result = await composite(artwork, 'thin-black')
    // read center pixel — should be reddish (artwork region)
    const { data } = await sharp(result)
      .extract({ left: 590, top: 440, width: 1, height: 1 })
      .raw()
      .toBuffer({ resolveWithObject: true })
    expect(data[0]).toBeGreaterThan(150) // R channel
  })
})

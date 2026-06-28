import { describe, it, expect } from 'vitest'
import { warpArtwork } from '../src/warp.js'
import type { Quad } from '../src/types.js'

describe('warpArtwork', () => {
  it('fills target quad region with artwork pixels', () => {
    // 4x4 red artwork (RGBA)
    const artWidth = 4
    const artHeight = 4
    const artBuf = Buffer.alloc(artWidth * artHeight * 4)
    for (let i = 0; i < artWidth * artHeight; i++) {
      artBuf[i * 4 + 0] = 255 // R
      artBuf[i * 4 + 1] = 0   // G
      artBuf[i * 4 + 2] = 0   // B
      artBuf[i * 4 + 3] = 255 // A
    }

    // axis-aligned quad in an 8x8 frame — no perspective, just a rectangle
    const quad: Quad = [[2, 2], [6, 2], [6, 6], [2, 6]]
    const frameWidth = 8
    const frameHeight = 8

    const result = warpArtwork(artBuf, artWidth, artHeight, quad, frameWidth, frameHeight)

    expect(result).toBeInstanceOf(Buffer)
    expect(result.length).toBe(frameWidth * frameHeight * 4)

    // center pixel (4,4) should be red
    const cx = 4, cy = 4
    const idx = (cy * frameWidth + cx) * 4
    expect(result[idx + 0]).toBeGreaterThan(200) // R
    expect(result[idx + 1]).toBeLessThan(50)      // G
    expect(result[idx + 2]).toBeLessThan(50)      // B
    expect(result[idx + 3]).toBe(255)             // A

    // corner pixel (0,0) should be transparent
    expect(result[3]).toBe(0)
  })

  it('returns transparent buffer for empty quad', () => {
    const artBuf = Buffer.alloc(4 * 4 * 4, 255)
    const quad: Quad = [[0, 0], [0, 0], [0, 0], [0, 0]]
    const result = warpArtwork(artBuf, 4, 4, quad, 8, 8)
    // all alpha should be 0
    for (let i = 3; i < result.length; i += 4) {
      expect(result[i]).toBe(0)
    }
  })
})

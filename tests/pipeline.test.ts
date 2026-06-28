import { describe, it, expect } from 'vitest'
import { frameArtwork } from '../src/pipeline.js'
import type { AiProvider, FrameOptions } from '../src/types.js'
import { ProviderError } from '../src/types.js'
import { existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'

const FIXTURES  = join(import.meta.dirname, 'fixtures')
const OUTPUT_DIR = join(import.meta.dirname, 'output')
mkdirSync(OUTPUT_DIR, { recursive: true })

const baseOpts: Omit<FrameOptions, 'output'> = {
  artworkWidthIn: 18,
  artworkHeightIn: 24,
  frame: { material: 'oak', thicknessIn: 1.5, depthIn: 0.75 },
  mat: { widthIn: 2, color: 'white' },
  scene: 'white-gallery',
  angleDeg: 0,
  // no provider — pipeline works without AI
}

describe('frameArtwork', () => {
  it('frames mona-lisa.jpg with walnut frame (no provider)', async () => {
    const output = join(OUTPUT_DIR, 'mona-lisa-walnut-white-gallery.png')
    await frameArtwork(join(FIXTURES, 'mona-lisa.jpg'), {
      ...baseOpts,
      artworkWidthIn: 21,
      artworkHeightIn: 30,
      frame: { material: 'walnut', thicknessIn: 2, depthIn: 1 },
      output,
    })
    expect(existsSync(output)).toBe(true)
    expect(await sharp(output).metadata()).toMatchObject({ format: 'png' })
  })

  it('frames birth-of-venus.jpg with black-paint frame (no provider)', async () => {
    const output = join(OUTPUT_DIR, 'birth-of-venus-black-dark-moody.png')
    await frameArtwork(join(FIXTURES, 'birth-of-venus.jpg'), {
      ...baseOpts,
      artworkWidthIn: 54,
      artworkHeightIn: 34,
      frame: { material: 'black-paint', thicknessIn: 1.5, depthIn: 0.75 },
      mat: { widthIn: 2.5, color: 'white' },
      scene: 'dark-moody',
      output,
    })
    expect(existsSync(output)).toBe(true)
    expect(await sharp(output).metadata()).toMatchObject({ format: 'png' })
  })

  it('frames sunday-grande-jatte.jpg with oak frame, angle=15', async () => {
    const output = join(OUTPUT_DIR, 'sunday-grande-jatte-oak-angle15.png')
    await frameArtwork(join(FIXTURES, 'sunday-grande-jatte.jpg'), {
      ...baseOpts,
      artworkWidthIn: 81,
      artworkHeightIn: 54,
      frame: { material: 'oak', thicknessIn: 1.5, depthIn: 0.75 },
      mat: { widthIn: 0, color: 'white' },
      angleDeg: 15,
      output,
    })
    expect(existsSync(output)).toBe(true)
    expect(await sharp(output).metadata()).toMatchObject({ format: 'png' })
  })

  it('calls provider.prePass and provider.postPass when provider is supplied', async () => {
    let preCalled = false, postCalled = false
    const tracking: AiProvider = {
      async prePass(buf)  { preCalled = true; return buf },
      async postPass(buf) { postCalled = true; return buf },
    }
    await frameArtwork(join(FIXTURES, 'mona-lisa.jpg'), {
      ...baseOpts, provider: tracking, output: join(OUTPUT_DIR, 'provider-tracking.png'),
    })
    expect(preCalled).toBe(true)
    expect(postCalled).toBe(true)
  })

  it('wraps provider.prePass errors as ProviderError', async () => {
    const broken: AiProvider = {
      async prePass()  { throw new Error('network failure') },
      async postPass(buf) { return buf },
    }
    await expect(
      frameArtwork(join(FIXTURES, 'mona-lisa.jpg'), {
        ...baseOpts, provider: broken, output: join(OUTPUT_DIR, 'should-not-exist.png'),
      }),
    ).rejects.toThrow(ProviderError)
  })
})

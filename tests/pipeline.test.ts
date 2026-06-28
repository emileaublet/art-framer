import { describe, it, expect, afterAll } from 'vitest'
import { frameArtwork } from '../src/pipeline.js'
import type { AiProvider } from '../src/types.js'
import { ProviderError } from '../src/types.js'
import { existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'

const FIXTURES = join(import.meta.dirname, 'fixtures')
const OUTPUT_DIR = join(import.meta.dirname, 'output')

mkdirSync(OUTPUT_DIR, { recursive: true })

const mockProvider: AiProvider = {
  async prePass(buf) { return buf },
  async postPass(buf) { return buf },
}

describe('frameArtwork — real artwork fixtures', () => {
  it('frames mona-lisa.jpg with thin-black', async () => {
    const output = join(OUTPUT_DIR, 'mona-lisa-thin-black.png')
    await frameArtwork(join(FIXTURES, 'mona-lisa.jpg'), {
      frame: 'thin-black',
      provider: mockProvider,
      output,
    })
    expect(existsSync(output)).toBe(true)
    const meta = await sharp(output).metadata()
    expect(meta.format).toBe('png')
    expect(meta.width).toBe(1200)
    expect(meta.height).toBe(900)
  })

  it('frames birth-of-venus.jpg with classic-wood', async () => {
    const output = join(OUTPUT_DIR, 'birth-of-venus-classic-wood.png')
    await frameArtwork(join(FIXTURES, 'birth-of-venus.jpg'), {
      frame: 'classic-wood',
      provider: mockProvider,
      output,
    })
    expect(existsSync(output)).toBe(true)
    const meta = await sharp(output).metadata()
    expect(meta.format).toBe('png')
    expect(meta.width).toBe(1200)
    expect(meta.height).toBe(900)
  })

  it('frames sunday-grande-jatte.jpg with ornate-gold', async () => {
    const output = join(OUTPUT_DIR, 'sunday-grande-jatte-ornate-gold.png')
    await frameArtwork(join(FIXTURES, 'sunday-grande-jatte.jpg'), {
      frame: 'ornate-gold',
      provider: mockProvider,
      output,
    })
    expect(existsSync(output)).toBe(true)
    const meta = await sharp(output).metadata()
    expect(meta.format).toBe('png')
    expect(meta.width).toBe(1200)
    expect(meta.height).toBe(900)
  })

  it('calls provider.prePass and provider.postPass', async () => {
    let preCalled = false, postCalled = false
    const trackingProvider: AiProvider = {
      async prePass(buf) { preCalled = true; return buf },
      async postPass(buf) { postCalled = true; return buf },
    }
    await frameArtwork(join(FIXTURES, 'mona-lisa.jpg'), {
      frame: 'classic-wood',
      provider: trackingProvider,
      output: join(OUTPUT_DIR, 'provider-tracking-test.png'),
    })
    expect(preCalled).toBe(true)
    expect(postCalled).toBe(true)
  })

  it('wraps provider errors as ProviderError', async () => {
    const brokenProvider: AiProvider = {
      async prePass() { throw new Error('network failure') },
      async postPass(buf) { return buf },
    }
    await expect(
      frameArtwork(join(FIXTURES, 'mona-lisa.jpg'), {
        frame: 'thin-black',
        provider: brokenProvider,
        output: join(OUTPUT_DIR, 'should-not-exist.png'),
      }),
    ).rejects.toThrow(ProviderError)
  })
})

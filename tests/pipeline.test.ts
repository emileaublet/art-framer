import { describe, it, expect, afterEach } from 'vitest'
import { frameArtwork } from '../src/pipeline.js'
import type { AiProvider } from '../src/types.js'
import { ProviderError } from '../src/types.js'
import { writeFileSync, existsSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'

const OUTPUT = join(import.meta.dirname, 'output-test.png')

const mockProvider: AiProvider = {
  async prePass(buf) { return buf },
  async postPass(buf) { return buf },
}

async function makeFixturePng(): Promise<string> {
  const p = join(import.meta.dirname, 'fixture-artwork.png')
  await sharp({
    create: { width: 100, height: 100, channels: 4, background: { r: 0, g: 128, b: 255, alpha: 1 } },
  }).png().toFile(p)
  return p
}

afterEach(() => {
  if (existsSync(OUTPUT)) unlinkSync(OUTPUT)
})

describe('frameArtwork', () => {
  it('writes a valid PNG to the output path', async () => {
    const artwork = await makeFixturePng()
    await frameArtwork(artwork, { frame: 'thin-black', provider: mockProvider, output: OUTPUT })
    expect(existsSync(OUTPUT)).toBe(true)
    const meta = await sharp(OUTPUT).metadata()
    expect(meta.format).toBe('png')
    expect(meta.width).toBe(1200)
    expect(meta.height).toBe(900)
  })

  it('calls provider.prePass and provider.postPass', async () => {
    const artwork = await makeFixturePng()
    let preCalled = false, postCalled = false
    const trackingProvider: AiProvider = {
      async prePass(buf) { preCalled = true; return buf },
      async postPass(buf) { postCalled = true; return buf },
    }
    await frameArtwork(artwork, { frame: 'classic-wood', provider: trackingProvider, output: OUTPUT })
    expect(preCalled).toBe(true)
    expect(postCalled).toBe(true)
  })

  it('wraps provider errors as ProviderError', async () => {
    const artwork = await makeFixturePng()
    const brokenProvider: AiProvider = {
      async prePass() { throw new Error('network failure') },
      async postPass(buf) { return buf },
    }
    await expect(
      frameArtwork(artwork, { frame: 'thin-black', provider: brokenProvider, output: OUTPUT }),
    ).rejects.toThrow(ProviderError)
  })
})

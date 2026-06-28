import { readFileSync, writeFileSync } from 'node:fs'
import { composite } from './compositor.js'
import type { FrameOptions } from './types.js'
import { ProviderError } from './types.js'

export async function frameArtwork(artworkPath: string, opts: FrameOptions): Promise<void> {
  let artwork: Buffer = readFileSync(artworkPath)

  if (opts.provider) {
    try {
      artwork = await opts.provider.prePass(artwork, '')
    } catch (err) {
      throw new ProviderError('AI pre-pass failed', { cause: err })
    }
  }

  const composited = await composite(artwork, opts)

  if (opts.provider) {
    let final: Buffer
    try {
      final = await opts.provider.postPass(composited, '')
    } catch (err) {
      throw new ProviderError('AI post-pass failed', { cause: err })
    }
    writeFileSync(opts.output, final)
  } else {
    writeFileSync(opts.output, composited)
  }
}

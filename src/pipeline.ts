import { readFileSync, writeFileSync } from 'node:fs'
import { composite } from './compositor.js'
import { loadScene } from './templates.js'
import type { FrameOptions } from './types.js'
import { ProviderError } from './types.js'

export async function frameArtwork(artworkPath: string, options: FrameOptions): Promise<void> {
  const { frame, provider, output } = options
  const scene = loadScene(frame)

  let artwork: Buffer = readFileSync(artworkPath)

  try {
    artwork = await provider.prePass(artwork, scene.hint)
  } catch (err) {
    throw new ProviderError('AI pre-pass failed', { cause: err })
  }

  const composited = await composite(artwork, frame)

  let final: Buffer
  try {
    final = await provider.postPass(composited, scene.hint)
  } catch (err) {
    throw new ProviderError('AI post-pass failed', { cause: err })
  }

  writeFileSync(output, final)
}

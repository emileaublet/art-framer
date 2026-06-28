import { readFileSync, writeFileSync } from 'node:fs'
import { composite } from './compositor.js'
import { buildSceneHint } from './scenes.js'
import type { FrameOptions } from './types.js'
import { ProviderError } from './types.js'

export async function frameArtwork(artworkPath: string, opts: FrameOptions): Promise<void> {
  const { provider, output } = opts
  const sceneHint = buildSceneHint(opts)

  let artwork: Buffer = readFileSync(artworkPath)

  try {
    artwork = await provider.prePass(artwork, sceneHint)
  } catch (err) {
    throw new ProviderError('AI pre-pass failed', { cause: err })
  }

  const composited = await composite(artwork, opts)

  let final: Buffer
  try {
    final = await provider.postPass(composited, sceneHint)
  } catch (err) {
    throw new ProviderError('AI post-pass failed', { cause: err })
  }

  writeFileSync(output, final)
}

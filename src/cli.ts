#!/usr/bin/env node
import { Command } from 'commander'
import { frameArtwork } from './pipeline.js'
import type { FrameName } from './types.js'
import { TemplateNotFoundError, ProviderError, CompositorError } from './types.js'
import { basename, extname } from 'node:path'

const FRAME_NAMES: FrameName[] = ['thin-black', 'classic-wood', 'ornate-gold']

const program = new Command()
  .name('art-framer')
  .description('Convert a plain artwork PNG into a photorealistic framed wall image')
  .argument('<artwork>', 'Path to input artwork PNG')
  .requiredOption('-f, --frame <name>', `Frame template (${FRAME_NAMES.join(', ')})`)
  .requiredOption('-p, --provider <package>', 'AiProvider package name or path to import')
  .option('-o, --output <path>', 'Output PNG path')
  .action(async (artworkPath: string, opts: { frame: string; provider: string; output?: string }) => {
    if (!FRAME_NAMES.includes(opts.frame as FrameName)) {
      console.error(`Error: unknown frame "${opts.frame}". Choose from: ${FRAME_NAMES.join(', ')}`)
      process.exit(1)
    }
    const output = opts.output ?? `${basename(artworkPath, extname(artworkPath))}-framed.png`
    let provider
    try {
      const mod = await import(opts.provider)
      provider = mod.default
    } catch (err) {
      console.error(`Error: could not import provider "${opts.provider}": ${(err as Error).message}`)
      process.exit(1)
    }
    try {
      await frameArtwork(artworkPath, { frame: opts.frame as FrameName, provider, output })
      console.log(`Saved: ${output}`)
    } catch (err) {
      if (err instanceof TemplateNotFoundError || err instanceof ProviderError || err instanceof CompositorError) {
        console.error(`Error: ${err.message}`)
      } else {
        console.error(`Unexpected error: ${(err as Error).message}`)
      }
      process.exit(1)
    }
  })

program.parse()

#!/usr/bin/env node
import { program } from 'commander'
import { resolve } from 'node:path'
import { frameArtwork } from './pipeline.js'
import type { FrameOptions, FrameMaterial } from './types.js'
import { CompositorError, ProviderError } from './types.js'
import { basename, extname } from 'node:path'

const VALID_MATERIALS: FrameMaterial[] = [
  'oak', 'walnut', 'cherry', 'maple', 'ash', 'pine', 'black-paint', 'white-paint',
]

program
  .name('art-framer')
  .argument('<artwork>', 'path to artwork image file')
  .requiredOption('--width <inches>', 'artwork physical width in inches', parseFloat)
  .requiredOption('--height <inches>', 'artwork physical height in inches', parseFloat)
  .option('--material <material>', 'frame material', 'oak')
  .option('--frame-thickness <inches>', 'molding width in inches', parseFloat, 1.5)
  .option('--frame-depth <inches>', 'frame depth in inches', parseFloat, 0.75)
  .option('--mat-width <inches>', 'mat border width in inches', parseFloat, 2.0)
  .option('--mat-color <color>', 'mat color: white, eggshell, or #rrggbb', 'white')
  .option('--scene <scene>', 'scene preset or description', 'white-gallery')
  .option('--angle <degrees>', 'viewing angle 0–45', parseFloat, 0)
  .requiredOption('--provider <path>', 'path to AiProvider module')
  .option('--output <path>', 'output file path')
  .action(async (artwork: string, opts) => {
    if (!VALID_MATERIALS.includes(opts.material)) {
      console.error(`Unknown material "${opts.material}". Valid: ${VALID_MATERIALS.join(', ')}`)
      process.exit(1)
    }
    if (opts.angle < 0 || opts.angle > 45) {
      console.error(`--angle must be 0–45, got ${opts.angle}`)
      process.exit(1)
    }
    if (opts.width <= 0 || opts.height <= 0) {
      console.error('--width and --height must be positive')
      process.exit(1)
    }

    const providerPath = resolve(process.cwd(), opts.provider)
    let provider
    try {
      const mod = await import(providerPath)
      provider = mod.default
    } catch (err) {
      console.error(`could not import provider "${opts.provider}": ${err}`)
      process.exit(1)
    }

    const output = opts.output ?? basename(artwork, extname(artwork)) + '-framed.png'

    const frameOptions: FrameOptions = {
      artworkWidthIn:  opts.width,
      artworkHeightIn: opts.height,
      frame: {
        material:    opts.material,
        thicknessIn: opts.frameThickness,
        depthIn:     opts.frameDepth,
      },
      mat: {
        widthIn: opts.matWidth,
        color:   opts.matColor,
      },
      scene:    opts.scene,
      angleDeg: opts.angle,
      provider,
      output,
    }

    try {
      await frameArtwork(artwork, frameOptions)
      console.log(`Saved: ${output}`)
    } catch (err) {
      if (err instanceof CompositorError) {
        console.error(`Compositor error: ${err.message}`)
      } else if (err instanceof ProviderError) {
        console.error(`Provider error: ${err.message}`)
      } else {
        console.error(`Unexpected error: ${err}`)
      }
      process.exit(1)
    }
  })

program.parse()

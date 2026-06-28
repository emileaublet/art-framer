// Generate all 10 scene previews using a placeholder artwork and the Replicate provider.
// Scenes are the product here — artwork is just filler.
// Run: node --import tsx/esm scripts/scene-preview.ts
import { frameArtwork } from '../src/pipeline.js'
import type { FrameOptions, ScenePreset } from '../src/types.js'
import { mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURES = join(__dirname, '../tests/fixtures')
const OUTPUT   = join(__dirname, '../tests/output/scene-previews')
mkdirSync(OUTPUT, { recursive: true })

// Placeholder artwork — only the frame/mat/scene matter here
const ARTWORK = { file: 'mona-lisa.jpg', widthIn: 21, heightIn: 30 }

const FLAT_WALL_SCENES: ScenePreset[] = [
  'smooth-white-wall',
  'white-brick-wall',
  'warm-plaster-wall',
  'sage-wall',
  'dark-charcoal-wall',
]

const ROOM_SCENES: ScenePreset[] = [
  'modern-living-room',
  'modern-bedroom',
  'home-office',
  'hallway',
  'reading-nook',
]

const ALL_SCENES = [...FLAT_WALL_SCENES, ...ROOM_SCENES]

console.log(`Generating ${ALL_SCENES.length} scene previews via Replicate (sequential to avoid rate limits)…\n`)

let done = 0, failed = 0
for (const scene of ALL_SCENES) {
  const output = join(OUTPUT, `${scene}.png`)
  const opts: FrameOptions = {
    artworkWidthIn:  ARTWORK.widthIn,
    artworkHeightIn: ARTWORK.heightIn,
    frame: { material: 'black-paint', thicknessIn: 1.5, depthIn: 0.75 },
    mat:   { widthIn: 2, color: 'white' },
    scene,
    angleDeg: 0,
    output,
  }
  try {
    await frameArtwork(join(FIXTURES, ARTWORK.file), opts)
    console.log(`✓ [${++done + failed}/${ALL_SCENES.length}] ${scene}`)
  } catch (err: any) {
    console.error(`✗ [${done + ++failed}/${ALL_SCENES.length}] ${scene}: ${err.cause?.message ?? err.message}`)
  }
}

console.log(`\nDone — ${done} ok, ${failed} failed → tests/output/scene-previews/`)

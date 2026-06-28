// Generate AI lifestyle scene examples via Replicate.
//
// Usage:
//   node --import tsx/esm scripts/lifestyle.ts                 # all artworks × materials
//   node --import tsx/esm scripts/lifestyle.ts mona-lisa       # only mona-lisa
//   node --import tsx/esm scripts/lifestyle.ts mona-lisa black-paint walnut
//
// Filters are substring-matched against the slug: artwork--material
// Results are cached in .cache/replicate/ — re-running with the same
// inputs is free (cache hit, no Replicate call).
import { frameArtwork } from '../src/pipeline.js'
import type { FrameOptions, FrameMaterial, ScenePreset } from '../src/types.js'
import { mkdirSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURES = join(__dirname, '../tests/fixtures')
const OUTPUT = join(__dirname, '../tests/output/lifestyle')
mkdirSync(OUTPUT, { recursive: true })

const providerPath = resolve(__dirname, '../providers/replicate-provider.js')
const mod = await import(providerPath)
const provider = mod.default

// CLI filters: any positional arg after the script name
const filters = process.argv.slice(2)
function included(slug: string): boolean {
  if (filters.length === 0) return true
  return filters.some(f => slug.includes(f))
}

interface ArtworkSpec { file: string; slug: string; widthIn: number; heightIn: number }

const ARTWORKS: ArtworkSpec[] = [
  { file: 'mona-lisa.jpg',          slug: 'mona-lisa',      widthIn: 21, heightIn: 30 },
  { file: 'birth-of-venus.jpg',     slug: 'birth-of-venus', widthIn: 54, heightIn: 34 },
  { file: 'sunday-grande-jatte.jpg',slug: 'grande-jatte',   widthIn: 81, heightIn: 54 },
  { file: 'starry-night.jpg',       slug: 'starry-night',   widthIn: 29, heightIn: 23 },
  { file: 'great-wave.jpg',         slug: 'great-wave',     widthIn: 14, heightIn: 9  },
  { file: 'water-lilies.jpg',       slug: 'water-lilies',   widthIn: 36, heightIn: 29 },
]

const MATERIALS: FrameMaterial[] = ['black-paint', 'walnut', 'oak']

const SCENES: ScenePreset[] = [
  'textured-white-wall',
  'white-brick-wall',
  'modern-living-room',
  'modern-bedroom',
]

async function run() {
  const jobs: { slug: string; promise: Promise<void> }[] = []

  for (const artwork of ARTWORKS) {
    for (const material of MATERIALS) {
      const baseSlug = `${artwork.slug}--${material}`
      if (!included(baseSlug)) continue

      for (const scene of SCENES) {
        const slug = `${baseSlug}--${scene}`
        const output = join(OUTPUT, `${slug}.png`)
        const opts: FrameOptions = {
          artworkWidthIn:  artwork.widthIn,
          artworkHeightIn: artwork.heightIn,
          frame: { material, thicknessIn: 1.5, depthIn: 0.75 },
          mat:   { widthIn: 2, color: 'white' },
          scene,
          angleDeg: 0,
          provider,
          output,
        }
        jobs.push({
          slug,
          promise: frameArtwork(join(FIXTURES, artwork.file), opts)
            .catch(err => console.error(`FAIL ${slug}: ${err.message}`)),
        })
      }
    }
  }

  if (jobs.length === 0) {
    console.log('No jobs matched the filter. Check your arguments.')
    return
  }

  console.log(`Running ${jobs.length} jobs across 4 scenes…`)
  if (filters.length > 0) console.log(`Filter: ${filters.join(', ')}`)

  let done = 0
  await Promise.all(
    jobs.map(({ slug, promise }) =>
      promise.then(() => console.log(`[${++done}/${jobs.length}] ${slug}`)),
    ),
  )

  console.log(`\nDone — ${done}/${jobs.length} images in tests/output/lifestyle/`)
}

run()

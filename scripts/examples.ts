import { frameArtwork } from '../src/pipeline.js'
import type { AiProvider, FrameOptions, FrameMaterial, ScenePreset } from '../src/types.js'
import { mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURES = join(__dirname, '../tests/fixtures')
const OUTPUT = join(__dirname, '../tests/output/examples')
mkdirSync(OUTPUT, { recursive: true })

const mockProvider: AiProvider = {
  async prePass(buf) { return buf },
  async postPass(buf) { return buf },
}

interface ArtworkSpec {
  file: string
  slug: string
  widthIn: number
  heightIn: number
}

const ARTWORKS: ArtworkSpec[] = [
  { file: 'mona-lisa.jpg',          slug: 'mona-lisa',     widthIn: 21,  heightIn: 30  },
  { file: 'birth-of-venus.jpg',     slug: 'birth-of-venus',widthIn: 54,  heightIn: 34  },
  { file: 'sunday-grande-jatte.jpg',slug: 'grande-jatte',  widthIn: 81,  heightIn: 54  },
  { file: 'starry-night.jpg',       slug: 'starry-night',  widthIn: 29,  heightIn: 23  },
  { file: 'great-wave.jpg',         slug: 'great-wave',    widthIn: 14,  heightIn: 9   },
  { file: 'water-lilies.jpg',       slug: 'water-lilies',  widthIn: 36,  heightIn: 29  },
]

// Curated combinations: 3 materials × 3 scenes × 3 angles
const MATERIALS: FrameMaterial[] = ['oak', 'walnut', 'black-paint']
const SCENES: ScenePreset[]       = ['white-gallery', 'dark-moody', 'warm-living-room']
const ANGLES                      = [0, 15, 25]

async function run() {
  const jobs: Promise<void>[] = []
  let count = 0

  for (const artwork of ARTWORKS) {
    for (const material of MATERIALS) {
      for (const scene of SCENES) {
        for (const angle of ANGLES) {
          const slug = `${artwork.slug}--${material}--${scene}--${angle}deg`
          const output = join(OUTPUT, `${slug}.png`)
          const opts: FrameOptions = {
            artworkWidthIn:  artwork.widthIn,
            artworkHeightIn: artwork.heightIn,
            frame: { material, thicknessIn: 1.5, depthIn: 0.75 },
            mat:   { widthIn: 2, color: 'white' },
            scene,
            angleDeg: angle,
            provider: mockProvider,
            output,
          }
          jobs.push(
            frameArtwork(join(FIXTURES, artwork.file), opts)
              .then(() => { count++; if (count % 10 === 0) console.log(`${count} done…`) })
              .catch(err => console.error(`FAIL ${slug}: ${err.message}`))
          )
        }
      }
    }
  }

  await Promise.all(jobs)
  console.log(`Done — ${count} images in tests/output/examples/`)
}

run()

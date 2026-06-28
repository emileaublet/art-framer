// Generate empty scene background PNGs via Replicate flux-1.1-pro (text-to-image, no artwork).
// Stores to assets/scene-backgrounds/{scene}.png. Skips already-generated files.
// Run: node --import tsx/esm scripts/gen-scene-backgrounds.ts
import Replicate from 'replicate'
import sharp from 'sharp'
import { existsSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { backgroundPath } from '../src/scenes.js'

const replicate = new Replicate()

// All prompts specify flat frontal camera — perpendicular to the wall, no perspective angle.
// This is critical: the frame compositor renders artwork at 0° (orthographic), so the
// background wall must be viewed straight-on or the composite will look wrong.
const CAMERA = 'Camera is positioned directly facing the wall, perfectly perpendicular, no perspective angle, no vanishing point. The wall fills the frame flat.'

const SCENES: Record<string, string> = {
  'smooth-white-wall':
    'Photorealistic interior photograph of a smooth white-painted plaster wall. ' +
    'Soft even ambient lighting from above. Empty wall, no artwork or decorations. Subtle paint roller texture. ' +
    CAMERA,

  'white-brick-wall':
    'Photorealistic interior photograph of a white-painted brick wall. ' +
    'Brick pattern and mortar lines clearly visible beneath the white paint. ' +
    'Diffused overhead lighting. Empty wall, no artwork. ' +
    CAMERA,

  'warm-plaster-wall':
    'Photorealistic interior photograph of a warm off-white plaster wall. ' +
    'Slightly uneven aged European plaster texture. Warm natural side lighting from the left. ' +
    'Empty wall, no artwork. ' +
    CAMERA,

  'sage-wall':
    'Photorealistic interior photograph of a smooth muted sage green painted wall. ' +
    'Desaturated grey-green matte finish. Soft diffused natural light. Empty wall, no artwork. ' +
    CAMERA,

  'dark-charcoal-wall':
    'Photorealistic interior photograph of a deep charcoal almost-black painted wall. ' +
    'Rich matte finish, dramatic accent wall. Directional overhead lighting. Empty wall, no artwork. ' +
    CAMERA,

  'modern-living-room':
    'Photorealistic interior photograph of a modern Scandinavian living room wall. ' +
    'Light warm-white painted wall. Natural oak wood floor partially visible at the very bottom edge. ' +
    'Hint of a minimal linen sofa at one side edge. Soft natural daylight. Empty wall, no artwork. ' +
    CAMERA,

  'modern-bedroom':
    'Photorealistic interior photograph of a calm modern bedroom wall. ' +
    'Soft white or very light grey painted wall. Top of a neatly made bed with neutral linen visible at the very bottom edge. ' +
    'Warm soft ambient evening light. Empty wall, no artwork. ' +
    CAMERA,

  'home-office':
    'Photorealistic interior photograph of a minimal home office wall. ' +
    'Light painted wall. Top of a simple wooden desk partially visible at the very bottom edge. ' +
    'Soft natural daylight from the side. Empty wall, no artwork. ' +
    CAMERA,

  'hallway':
    'Photorealistic interior photograph of a simple residential hallway wall. ' +
    'White or very light painted wall. Baseboard trim visible at the very bottom edge, hint of doorframe at one side. ' +
    'Soft ambient light, no direct sun. Empty wall, no artwork. ' +
    CAMERA,

  'reading-nook':
    'Photorealistic interior photograph of a cozy library or reading nook wall. ' +
    'Warm cream or light beige painted wall. Hint of a bookshelf at one side edge. ' +
    'Warm table lamp light casting soft warm glow from the side. Empty wall, no artwork. ' +
    CAMERA,
}

// recraft-v3 portrait size (1024x1280 is a supported size)
const OUT_WIDTH  = 1024
const OUT_HEIGHT = 1280
const RECRAFT_SIZE = '1024x1280'

// Delay between requests to avoid rate-limit (429) on low-credit accounts
const DELAY_MS = 12000

console.log(`Generating ${Object.keys(SCENES).length} scene backgrounds via Replicate recraft-v3...\n`)

let done = 0, skipped = 0, failed = 0

for (const [scene, prompt] of Object.entries(SCENES)) {
  const outPath = backgroundPath(scene)
  if (existsSync(outPath)) {
    console.log(`  [skip] ${scene} — already exists`)
    skipped++
    continue
  }

  try {
    console.log(`  [generate] ${scene}...`)
    const output = await replicate.run('recraft-ai/recraft-v3', {
      input: {
        prompt,
        size:           RECRAFT_SIZE,
        style:          'realistic_image/natural_light',
        output_format:  'png',
      },
    })
    // Respect rate limit between requests
    await new Promise(r => setTimeout(r, DELAY_MS))

    // recraft-v3 returns an array of FileOutput objects or strings
    const raw_output = Array.isArray(output) ? output[0] : output
    const url = typeof raw_output === 'string' ? raw_output : (raw_output as any).url?.() ?? String(raw_output)
    const resp = await fetch(url)
    const raw  = Buffer.from(await resp.arrayBuffer())

    // Ensure correct dimensions (safety resize)
    const final = await sharp(raw)
      .resize(OUT_WIDTH, OUT_HEIGHT, { fit: 'cover', position: 'center' })
      .png()
      .toBuffer()

    mkdirSync(dirname(outPath), { recursive: true })
    writeFileSync(outPath, final)
    console.log(`  ✓ ${scene}`)
    done++
  } catch (err: any) {
    console.error(`  ✗ ${scene}: ${err.cause?.message ?? err.message}`)
    failed++
    await new Promise(r => setTimeout(r, DELAY_MS))
  }
}

console.log(`\nDone — ${done} generated, ${skipped} skipped, ${failed} failed`)
console.log(`Backgrounds saved to: assets/scene-backgrounds/`)

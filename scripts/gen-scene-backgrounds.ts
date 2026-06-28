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

const SCENES: Record<string, string> = {
  'smooth-white-wall':
    'Photorealistic interior photograph of a smooth white-painted plaster wall. ' +
    'Soft even ambient lighting. Empty wall surface, no artwork or decorations. ' +
    'Subtle paint roller texture. Clean and minimal.',

  'white-brick-wall':
    'Photorealistic interior photograph of a white-painted brick wall. ' +
    'Brick pattern and mortar lines clearly visible beneath the white paint. ' +
    'Diffused overhead lighting. Empty wall, no artwork.',

  'warm-plaster-wall':
    'Photorealistic interior photograph of a warm off-white plaster wall. ' +
    'Slightly uneven aged European plaster texture. ' +
    'Warm natural side lighting from the left. Empty wall, no artwork.',

  'sage-wall':
    'Photorealistic interior photograph of a smooth muted sage green painted wall. ' +
    'Desaturated grey-green matte finish. Soft diffused natural light. Empty wall, no artwork.',

  'dark-charcoal-wall':
    'Photorealistic interior photograph of a deep charcoal almost-black painted wall. ' +
    'Rich matte finish, dramatic accent wall. Directional overhead lighting. Empty wall, no artwork.',

  'modern-living-room':
    'Photorealistic interior photograph of a modern Scandinavian living room. ' +
    'Light warm-white walls, natural oak wood flooring partially visible at the bottom. ' +
    'Minimal linen sofa partially visible at one edge. ' +
    'Soft natural daylight from a large window to one side. Clean and uncluttered. Empty wall, no artwork.',

  'modern-bedroom':
    'Photorealistic interior photograph of a calm modern bedroom. ' +
    'Soft white or very light grey walls. Neatly made bed with neutral linen duvet visible below. ' +
    'Simple bedside table with warm lamp to one side. Warm soft ambient evening light. Empty wall, no artwork.',

  'home-office':
    'Photorealistic interior photograph of a minimal home office or study. ' +
    'Light painted walls, simple wooden desk or floating shelf partially visible at the bottom. ' +
    'Small plant or stacked books to one side. Soft natural daylight from a window. Empty wall, no artwork.',

  'hallway':
    'Photorealistic interior photograph of a simple residential hallway or entrance. ' +
    'White or very light painted walls. Hint of a door frame or baseboard at one edge. ' +
    'Soft ambient light, calm, no direct sun. Empty wall, no artwork.',

  'reading-nook':
    'Photorealistic interior photograph of a cozy reading nook or library corner. ' +
    'Warm cream or light beige walls. ' +
    'Hint of a bookshelf or wooden paneling at one side, warm table lamp casting soft light. ' +
    'Intimate and calm. Empty wall, no artwork.',
}

// flux-1.1-pro max dimension is 1440px
const OUT_WIDTH  = 1024
const OUT_HEIGHT = 1280

// Delay between requests to avoid rate-limit (429) on low-credit accounts
const DELAY_MS = 12000

console.log(`Generating ${Object.keys(SCENES).length} scene backgrounds via Replicate flux-1.1-pro...\n`)

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
    const output = await replicate.run('black-forest-labs/flux-1.1-pro', {
      input: {
        prompt,
        width:          OUT_WIDTH,
        height:         OUT_HEIGHT,
        output_format:  'png',
        output_quality: 95,
      },
    })
    // Respect rate limit between requests
    await new Promise(r => setTimeout(r, DELAY_MS))

    const url = typeof output === 'string' ? output : (output as any).url?.() ?? String(output)
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

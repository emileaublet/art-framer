// Copy approved lifestyle images to tests/output/selected/.
//
// Usage:
//   node --import tsx/esm scripts/select.ts mona-lisa--black-paint--modern-living-room
//   node --import tsx/esm scripts/select.ts mona-lisa--black-paint  # picks all scenes for that combo
//
// The selected/ directory is your permanent curated collection.
// Source images come from tests/output/lifestyle/.
import { copyFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs'
import { join, dirname, basename } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const LIFESTYLE = join(__dirname, '../tests/output/lifestyle')
const SELECTED  = join(__dirname, '../tests/output/selected')
mkdirSync(SELECTED, { recursive: true })

const filters = process.argv.slice(2)
if (filters.length === 0) {
  console.error('Usage: node --import tsx/esm scripts/select.ts <slug-filter> [...]')
  console.error('Example: node --import tsx/esm scripts/select.ts mona-lisa--black-paint')
  process.exit(1)
}

const allFiles = readdirSync(LIFESTYLE).filter(f => f.endsWith('.png'))

const matches = allFiles.filter(f =>
  filters.some(filter => f.includes(filter))
)

if (matches.length === 0) {
  console.log('No files matched. Available slugs in tests/output/lifestyle/:')
  allFiles.forEach(f => console.log(' ', basename(f, '.png')))
  process.exit(1)
}

for (const file of matches) {
  const src = join(LIFESTYLE, file)
  const dst = join(SELECTED, file)
  copyFileSync(src, dst)
  console.log(`✓ selected/${file}`)
}

console.log(`\n${matches.length} image(s) copied to tests/output/selected/`)

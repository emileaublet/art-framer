import { describe, it, expect, afterEach } from 'vitest'
import { execSync } from 'node:child_process'
import { existsSync, unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'

const OUTPUT = join(import.meta.dirname, 'cli-output.png')
const ARTWORK = join(import.meta.dirname, 'cli-artwork.png')
const MOCK_PROVIDER = join(import.meta.dirname, 'mock-provider.mjs')

afterEach(() => {
  if (existsSync(OUTPUT)) unlinkSync(OUTPUT)
})

// Write a minimal mock provider module once
writeFileSync(MOCK_PROVIDER, `export default { prePass: async b => b, postPass: async b => b }`)

async function makeArtwork(): Promise<void> {
  if (existsSync(ARTWORK)) return
  await sharp({
    create: { width: 100, height: 100, channels: 4, background: { r: 255, g: 165, b: 0, alpha: 1 } },
  }).png().toFile(ARTWORK)
}

describe('CLI', () => {
  it('writes output PNG when given valid args', async () => {
    await makeArtwork()
    execSync(
      `node --import tsx/esm src/cli.ts ${ARTWORK} --frame thin-black --provider ${MOCK_PROVIDER} --output ${OUTPUT}`,
    )
    expect(existsSync(OUTPUT)).toBe(true)
    const meta = await sharp(OUTPUT).metadata()
    expect(meta.format).toBe('png')
  })

  it('exits non-zero for unknown frame', async () => {
    await makeArtwork()
    expect(() =>
      execSync(
        `node --import tsx/esm src/cli.ts ${ARTWORK} --frame bad-frame --provider ${MOCK_PROVIDER} --output ${OUTPUT}`,
        { stdio: 'pipe' },
      ),
    ).toThrow()
  })
})

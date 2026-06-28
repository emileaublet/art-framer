import { describe, it, expect, afterEach } from 'vitest'
import { execSync } from 'node:child_process'
import { existsSync, unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'

const OUTPUT = join(import.meta.dirname, 'cli-output.png')
const ARTWORK = join(import.meta.dirname, 'fixtures', 'mona-lisa.jpg')
const MOCK_PROVIDER = join(import.meta.dirname, 'mock-provider.mjs')

writeFileSync(MOCK_PROVIDER, `export default { prePass: async b => b, postPass: async b => b }`)

afterEach(() => { if (existsSync(OUTPUT)) unlinkSync(OUTPUT) })

const BASE_FLAGS = [
  '--width 16 --height 24',
  '--material oak --frame-thickness 1.5 --frame-depth 0.75',
  '--mat-width 2 --mat-color white',
  '--scene white-gallery --angle 0',
  `--provider ${MOCK_PROVIDER}`,
  `--output ${OUTPUT}`,
].join(' ')

describe('CLI', () => {
  it('writes output PNG with new parametric flags', () => {
    execSync(`node --import tsx/esm src/cli.ts ${ARTWORK} ${BASE_FLAGS}`)
    expect(existsSync(OUTPUT)).toBe(true)
    expect(sharp(OUTPUT).metadata()).resolves.toMatchObject({ format: 'png' })
  })

  it('exits non-zero for invalid angle', () => {
    expect(() =>
      execSync(
        `node --import tsx/esm src/cli.ts ${ARTWORK} ${BASE_FLAGS.replace('--angle 0', '--angle 90')}`,
        { stdio: 'pipe' },
      ),
    ).toThrow()
  })

  it('exits non-zero for unknown material', () => {
    expect(() =>
      execSync(
        `node --import tsx/esm src/cli.ts ${ARTWORK} ${BASE_FLAGS.replace('--material oak', '--material titanium')}`,
        { stdio: 'pipe' },
      ),
    ).toThrow()
  })

  it('resolves relative provider path from cwd', () => {
    execSync(
      `node --import tsx/esm src/cli.ts ${ARTWORK} ${BASE_FLAGS.replace(MOCK_PROVIDER, './tests/mock-provider.mjs')}`,
    )
    expect(existsSync(OUTPUT)).toBe(true)
  })
})

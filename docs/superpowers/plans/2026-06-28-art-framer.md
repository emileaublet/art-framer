# art-framer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Node.js/TypeScript library + CLI that composites a PNG artwork into a photorealistic framed-on-wall image via a 3-step pipeline: AI pre-pass → perspective compositor → AI post-pass.

**Architecture:** Linear pipeline where each step is a pure function receiving and returning a `Buffer`. The AI provider is an injected interface; the compositor is deterministic pixel math (homography + bilinear interpolation) powered by `sharp` for I/O and raw `Buffer` operations for the warp. Three built-in frame templates (synthetic PNG assets) ship with the package.

**Tech Stack:** Node.js 20+, TypeScript 5, `sharp` 0.33, `commander` 12, `tsup` 8, `vitest` 2, `tsx` 4.

**GitHub:** https://github.com/emileaublet/art-framer

## Global Constraints

- Node.js ≥ 20.0.0
- ESM-only (`"type": "module"` in package.json)
- All source in `src/`, tests in `tests/`
- `sharp` is the only runtime image dependency — no OpenCV, no canvas, no jimp
- Perspective warp implemented via inverse homography mapping + bilinear interpolation over raw RGBA buffers
- No live AI provider required for any test — mock provider returns input buffer unchanged
- Every task ends with a `git commit`
- Frame names are the string literals `'thin-black' | 'classic-wood' | 'ornate-gold'` — exact, no variation

---

## File Map

| File | Responsibility |
|---|---|
| `src/types.ts` | `AiProvider` interface, `FrameOptions`, `SceneConfig`, error classes |
| `src/warp.ts` | Homography computation (Gaussian elimination) + bilinear interpolation |
| `src/compositor.ts` | Loads template assets, calls warp, composites artwork into frame |
| `src/templates.ts` | Resolves template directory, loads + validates `scene.json` |
| `src/pipeline.ts` | `frameArtwork()` — orchestrates pre-pass → compositor → post-pass |
| `src/index.ts` | Public exports |
| `src/cli.ts` | CLI entry point using `commander` |
| `scripts/generate-templates.ts` | Generates synthetic PNG template assets using `sharp` |
| `src/templates/thin-black/scene.json` | Quad, ambient light, hint for thin-black |
| `src/templates/classic-wood/scene.json` | Quad, ambient light, hint for classic-wood |
| `src/templates/ornate-gold/scene.json` | Quad, ambient light, hint for ornate-gold |
| `tests/warp.test.ts` | Unit tests for homography + bilinear interpolation |
| `tests/compositor.test.ts` | Unit tests for compositor using fixture images |
| `tests/pipeline.test.ts` | Pipeline tests using mock AiProvider |
| `tests/cli.test.ts` | CLI integration test |

---

### Task 1: Project scaffolding

**Model: haiku**

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `.gitignore`
- Create: `.npmignore`

**Interfaces:**
- Produces: working `npm install`, `npm test`, `npm run build` commands

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "art-framer",
  "version": "0.1.0",
  "description": "Convert plain artwork PNG into a photorealistic framed wall image",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "bin": {
    "art-framer": "./dist/cli.js"
  },
  "files": [
    "dist",
    "src/templates"
  ],
  "scripts": {
    "build": "tsup src/index.ts src/cli.ts --format esm --dts --clean",
    "test": "vitest run",
    "test:watch": "vitest",
    "generate-templates": "tsx scripts/generate-templates.ts",
    "prepublishOnly": "npm run build"
  },
  "dependencies": {
    "commander": "^12.0.0",
    "sharp": "^0.33.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "tsup": "^8.0.0",
    "tsx": "^4.0.0",
    "typescript": "^5.0.0",
    "vitest": "^2.0.0"
  },
  "engines": {
    "node": ">=20.0.0"
  },
  "repository": {
    "type": "git",
    "url": "https://github.com/emileaublet/art-framer"
  },
  "license": "MIT"
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist", "tests", "scripts"]
}
```

- [ ] **Step 3: Create `vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
})
```

- [ ] **Step 4: Create `.gitignore`**

```
node_modules/
dist/
*.js.map
.DS_Store
```

- [ ] **Step 5: Create `.npmignore`**

```
docs/
scripts/
tests/
*.test.ts
tsconfig.json
vitest.config.ts
```

- [ ] **Step 6: Create directory structure**

```bash
mkdir -p src/templates/thin-black src/templates/classic-wood src/templates/ornate-gold tests scripts
```

- [ ] **Step 7: Install dependencies**

```bash
npm install
```

Expected: `node_modules/` created, `package-lock.json` written, no errors.

- [ ] **Step 8: Commit**

```bash
git add package.json tsconfig.json vitest.config.ts .gitignore .npmignore
git commit -m "chore: project scaffolding — package.json, tsconfig, vitest, gitignore"
```

---

### Task 2: Types, interfaces, and error classes

**Model: haiku**

**Files:**
- Create: `src/types.ts`

**Interfaces:**
- Produces:
  - `AiProvider` interface with `prePass(artwork: Buffer, sceneHint: string): Promise<Buffer>` and `postPass(composite: Buffer, sceneHint: string): Promise<Buffer>`
  - `FrameOptions` type: `{ frame: 'thin-black' | 'classic-wood' | 'ornate-gold', provider: AiProvider, output: string }`
  - `SceneConfig` type: `{ quad: [[number,number],[number,number],[number,number],[number,number]], ambientLight: string, hint: string }`
  - `CompositorError`, `ProviderError`, `TemplateNotFoundError` classes

- [ ] **Step 1: Create `src/types.ts`**

```typescript
export interface AiProvider {
  prePass(artwork: Buffer, sceneHint: string): Promise<Buffer>
  postPass(composite: Buffer, sceneHint: string): Promise<Buffer>
}

export type FrameName = 'thin-black' | 'classic-wood' | 'ornate-gold'

export interface FrameOptions {
  frame: FrameName
  provider: AiProvider
  output: string
}

// quad corners ordered: top-left, top-right, bottom-right, bottom-left
export type Quad = [
  [number, number],
  [number, number],
  [number, number],
  [number, number],
]

export interface SceneConfig {
  quad: Quad
  ambientLight: string
  hint: string
}

export class CompositorError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'CompositorError'
  }
}

export class ProviderError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'ProviderError'
  }
}

export class TemplateNotFoundError extends Error {
  constructor(frame: string) {
    super(`Frame template not found: "${frame}"`)
    this.name = 'TemplateNotFoundError'
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/types.ts
git commit -m "feat: add AiProvider interface, FrameOptions, SceneConfig, and error classes"
```

---

### Task 3: Perspective warp — homography + bilinear interpolation

**Model: opus**

**Files:**
- Create: `src/warp.ts`
- Create: `tests/warp.test.ts`

**Interfaces:**
- Consumes: nothing (pure math, no imports from this codebase)
- Produces:
  - `warpArtwork(artworkBuffer: Buffer, artWidth: number, artHeight: number, targetQuad: Quad, frameWidth: number, frameHeight: number): Buffer`
    - Returns a `frameWidth × frameHeight` RGBA Buffer with the artwork perspective-warped into the region defined by `targetQuad`, transparent elsewhere.

- [ ] **Step 1: Write the failing test**

Create `tests/warp.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { warpArtwork } from '../src/warp.js'
import type { Quad } from '../src/types.js'

describe('warpArtwork', () => {
  it('fills target quad region with artwork pixels', () => {
    // 4x4 red artwork (RGBA)
    const artWidth = 4
    const artHeight = 4
    const artBuf = Buffer.alloc(artWidth * artHeight * 4)
    for (let i = 0; i < artWidth * artHeight; i++) {
      artBuf[i * 4 + 0] = 255 // R
      artBuf[i * 4 + 1] = 0   // G
      artBuf[i * 4 + 2] = 0   // B
      artBuf[i * 4 + 3] = 255 // A
    }

    // axis-aligned quad in an 8x8 frame — no perspective, just a rectangle
    const quad: Quad = [[2, 2], [6, 2], [6, 6], [2, 6]]
    const frameWidth = 8
    const frameHeight = 8

    const result = warpArtwork(artBuf, artWidth, artHeight, quad, frameWidth, frameHeight)

    expect(result).toBeInstanceOf(Buffer)
    expect(result.length).toBe(frameWidth * frameHeight * 4)

    // center pixel (4,4) should be red
    const cx = 4, cy = 4
    const idx = (cy * frameWidth + cx) * 4
    expect(result[idx + 0]).toBeGreaterThan(200) // R
    expect(result[idx + 1]).toBeLessThan(50)      // G
    expect(result[idx + 2]).toBeLessThan(50)      // B
    expect(result[idx + 3]).toBe(255)             // A

    // corner pixel (0,0) should be transparent
    expect(result[3]).toBe(0)
  })

  it('returns transparent buffer for empty quad', () => {
    const artBuf = Buffer.alloc(4 * 4 * 4, 255)
    const quad: Quad = [[0, 0], [0, 0], [0, 0], [0, 0]]
    const result = warpArtwork(artBuf, 4, 4, quad, 8, 8)
    // all alpha should be 0
    for (let i = 3; i < result.length; i += 4) {
      expect(result[i]).toBe(0)
    }
  })
})
```

- [ ] **Step 2: Run to verify it fails**

```bash
npx vitest run tests/warp.test.ts
```

Expected: FAIL — `Cannot find module '../src/warp.js'`

- [ ] **Step 3: Implement `src/warp.ts`**

```typescript
import type { Quad } from './types.js'

type Point = [number, number]
type H8 = [number, number, number, number, number, number, number, number]

function gaussianElimination(A: number[][], b: number[]): number[] {
  const n = b.length
  const M = A.map((row, i) => [...row, b[i]])

  for (let col = 0; col < n; col++) {
    let maxRow = col
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(M[row][col]) > Math.abs(M[maxRow][col])) maxRow = row
    }
    ;[M[col], M[maxRow]] = [M[maxRow], M[col]]
    for (let row = col + 1; row < n; row++) {
      const factor = M[row][col] / M[col][col]
      for (let k = col; k <= n; k++) M[row][k] -= factor * M[col][k]
    }
  }

  const x = new Array(n).fill(0)
  for (let i = n - 1; i >= 0; i--) {
    x[i] = M[i][n]
    for (let j = i + 1; j < n; j++) x[i] -= M[i][j] * x[j]
    x[i] /= M[i][i]
  }
  return x
}

// Returns H (8 coefficients, h8=1) mapping srcQuad[i] -> dstQuad[i]
function computeHomography(srcQuad: Quad, dstQuad: Quad): H8 {
  const A: number[][] = []
  const b: number[] = []
  for (let i = 0; i < 4; i++) {
    const [x, y] = srcQuad[i]
    const [X, Y] = dstQuad[i]
    A.push([x, y, 1, 0, 0, 0, -X * x, -X * y])
    b.push(X)
    A.push([0, 0, 0, x, y, 1, -Y * x, -Y * y])
    b.push(Y)
  }
  return gaussianElimination(A, b) as H8
}

function applyHomography(h: H8, px: number, py: number): Point {
  const denom = h[6] * px + h[7] * py + 1
  return [
    (h[0] * px + h[1] * py + h[2]) / denom,
    (h[3] * px + h[4] * py + h[5]) / denom,
  ]
}

function bilinear(src: Buffer, w: number, h: number, x: number, y: number): [number, number, number, number] {
  const x0 = Math.max(0, Math.floor(x))
  const y0 = Math.max(0, Math.floor(y))
  const x1 = Math.min(x0 + 1, w - 1)
  const y1 = Math.min(y0 + 1, h - 1)
  const xf = x - x0
  const yf = y - y0
  const idx = (row: number, col: number) => (row * w + col) * 4
  const result: [number, number, number, number] = [0, 0, 0, 0]
  for (let c = 0; c < 4; c++) {
    result[c] = Math.round(
      src[idx(y0, x0) + c] * (1 - xf) * (1 - yf) +
      src[idx(y0, x1) + c] * xf * (1 - yf) +
      src[idx(y1, x0) + c] * (1 - xf) * yf +
      src[idx(y1, x1) + c] * xf * yf,
    )
  }
  return result
}

export function warpArtwork(
  artworkBuffer: Buffer,
  artWidth: number,
  artHeight: number,
  targetQuad: Quad,
  frameWidth: number,
  frameHeight: number,
): Buffer {
  // artwork corners: TL, TR, BR, BL
  const artQuad: Quad = [[0, 0], [artWidth, 0], [artWidth, artHeight], [0, artHeight]]
  // inverse homography: frame pixel -> artwork pixel
  const h = computeHomography(targetQuad, artQuad)

  const out = Buffer.alloc(frameWidth * frameHeight * 4, 0)

  for (let fy = 0; fy < frameHeight; fy++) {
    for (let fx = 0; fx < frameWidth; fx++) {
      const [ax, ay] = applyHomography(h, fx, fy)
      if (ax < 0 || ay < 0 || ax >= artWidth || ay >= artHeight) continue
      const [r, g, b, a] = bilinear(artworkBuffer, artWidth, artHeight, ax, ay)
      const o = (fy * frameWidth + fx) * 4
      out[o] = r; out[o + 1] = g; out[o + 2] = b; out[o + 3] = a
    }
  }

  return out
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/warp.test.ts
```

Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/warp.ts tests/warp.test.ts
git commit -m "feat: perspective warp via inverse homography + bilinear interpolation"
```

---

### Task 4: Template loader

**Model: haiku**

**Files:**
- Create: `src/templates.ts`
- Create: `src/templates/thin-black/scene.json`
- Create: `src/templates/classic-wood/scene.json`
- Create: `src/templates/ornate-gold/scene.json`

**Interfaces:**
- Consumes: `FrameName`, `SceneConfig`, `TemplateNotFoundError` from `src/types.ts`
- Produces:
  - `getTemplatePath(frame: FrameName): string` — returns absolute path to template directory
  - `loadScene(frame: FrameName): SceneConfig` — reads and validates `scene.json`, throws `TemplateNotFoundError` if not found

- [ ] **Step 1: Create scene.json files**

`src/templates/thin-black/scene.json`:
```json
{
  "quad": [[100, 100], [1100, 100], [1100, 800], [100, 800]],
  "ambientLight": "#f8f8f8",
  "hint": "thin black metal frame on a white gallery wall, soft diffuse overhead lighting, minimal shadow"
}
```

`src/templates/classic-wood/scene.json`:
```json
{
  "quad": [[80, 80], [1120, 80], [1120, 820], [80, 820]],
  "ambientLight": "#f0e8d8",
  "hint": "classic oak wood frame on a warm gallery wall, warm side lighting, subtle drop shadow"
}
```

`src/templates/ornate-gold/scene.json`:
```json
{
  "quad": [[120, 120], [1080, 120], [1080, 780], [120, 780]],
  "ambientLight": "#1a1a1a",
  "hint": "wide ornate gold frame on a dark charcoal wall, dramatic spotlight, rich ambient glow"
}
```

- [ ] **Step 2: Write the failing test**

Create `tests/templates.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { loadScene, getTemplatePath } from '../src/templates.js'
import { TemplateNotFoundError } from '../src/types.js'
import { existsSync } from 'node:fs'

describe('loadScene', () => {
  it('loads thin-black scene config', () => {
    const scene = loadScene('thin-black')
    expect(scene.quad).toHaveLength(4)
    expect(scene.quad[0]).toHaveLength(2)
    expect(typeof scene.ambientLight).toBe('string')
    expect(scene.hint.length).toBeGreaterThan(0)
  })

  it('loads classic-wood scene config', () => {
    const scene = loadScene('classic-wood')
    expect(scene.quad).toHaveLength(4)
  })

  it('loads ornate-gold scene config', () => {
    const scene = loadScene('ornate-gold')
    expect(scene.quad).toHaveLength(4)
  })

  it('throws TemplateNotFoundError for unknown frame', () => {
    expect(() => loadScene('nonexistent' as never)).toThrow(TemplateNotFoundError)
  })
})

describe('getTemplatePath', () => {
  it('returns a path that exists', () => {
    const p = getTemplatePath('thin-black')
    expect(existsSync(p)).toBe(true)
  })
})
```

- [ ] **Step 3: Run to verify it fails**

```bash
npx vitest run tests/templates.test.ts
```

Expected: FAIL — `Cannot find module '../src/templates.js'`

- [ ] **Step 4: Implement `src/templates.ts`**

```typescript
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { FrameName, SceneConfig } from './types.js'
import { TemplateNotFoundError } from './types.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

const FRAME_NAMES: FrameName[] = ['thin-black', 'classic-wood', 'ornate-gold']

export function getTemplatePath(frame: FrameName): string {
  if (!FRAME_NAMES.includes(frame)) throw new TemplateNotFoundError(frame)
  return join(__dirname, 'templates', frame)
}

export function loadScene(frame: FrameName): SceneConfig {
  const dir = getTemplatePath(frame)
  const scenePath = join(dir, 'scene.json')
  if (!existsSync(scenePath)) throw new TemplateNotFoundError(frame)
  return JSON.parse(readFileSync(scenePath, 'utf8')) as SceneConfig
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
npx vitest run tests/templates.test.ts
```

Expected: PASS (5 tests)

- [ ] **Step 6: Commit**

```bash
git add src/templates.ts src/templates/thin-black/scene.json src/templates/classic-wood/scene.json src/templates/ornate-gold/scene.json tests/templates.test.ts
git commit -m "feat: template loader with scene.json for 3 built-in frames"
```

---

### Task 5: Synthetic template asset generator

**Model: sonnet**

**Files:**
- Create: `scripts/generate-templates.ts`
- Produces: `src/templates/thin-black/template.png`, `src/templates/thin-black/mask.png` (and same for classic-wood, ornate-gold)

**Context:** Real templates would be professional photos. These synthetic placeholders match the quads in `scene.json` exactly so the full pipeline can be exercised. The outer region is the frame/wall background; the inner region (the quad) is a solid fill that will be replaced by warped artwork.

**Interfaces:**
- Consumes: `scene.json` quad coords per template
- Produces: `template.png` (1200×900 RGBA, frame/wall background with solid artwork placeholder), `mask.png` (1200×900 grayscale — white inside quad, black outside)

- [ ] **Step 1: Implement `scripts/generate-templates.ts`**

```typescript
import sharp from 'sharp'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const TEMPLATE_DIR = join(__dirname, '../src/templates')

const FRAME_WIDTH = 1200
const FRAME_HEIGHT = 900

interface TemplateSpec {
  name: string
  wallColor: [number, number, number]
  frameColor: [number, number, number]
  artworkColor: [number, number, number]
  quad: [[number,number],[number,number],[number,number],[number,number]]
}

const SPECS: TemplateSpec[] = [
  {
    name: 'thin-black',
    wallColor: [248, 248, 248],
    frameColor: [26, 26, 26],
    artworkColor: [220, 220, 220],
    quad: [[100, 100], [1100, 100], [1100, 800], [100, 800]],
  },
  {
    name: 'classic-wood',
    wallColor: [224, 210, 190],
    frameColor: [123, 94, 58],
    artworkColor: [200, 185, 165],
    quad: [[80, 80], [1120, 80], [1120, 820], [80, 820]],
  },
  {
    name: 'ornate-gold',
    wallColor: [42, 42, 42],
    frameColor: [200, 168, 75],
    artworkColor: [60, 60, 60],
    quad: [[120, 120], [1080, 120], [1080, 780], [120, 780]],
  },
]

async function generateTemplate(spec: TemplateSpec): Promise<void> {
  const dir = join(TEMPLATE_DIR, spec.name)
  const [[x1, y1], [x2, _y2], [_x3, y3]] = spec.quad
  const artX = x1, artY = y1, artW = x2 - x1, artH = y3 - y1

  // template.png: wall background + frame border + artwork placeholder
  const templatePixels = Buffer.alloc(FRAME_WIDTH * FRAME_HEIGHT * 4)
  for (let y = 0; y < FRAME_HEIGHT; y++) {
    for (let x = 0; x < FRAME_WIDTH; x++) {
      const i = (y * FRAME_WIDTH + x) * 4
      const inArtwork = x >= artX && x < artX + artW && y >= artY && y < artY + artH
      const inFrameOuter = x >= artX - 10 && x < artX + artW + 10 && y >= artY - 10 && y < artY + artH + 10
      let color: [number, number, number]
      if (inArtwork) color = spec.artworkColor
      else if (inFrameOuter) color = spec.frameColor
      else color = spec.wallColor
      templatePixels[i] = color[0]
      templatePixels[i + 1] = color[1]
      templatePixels[i + 2] = color[2]
      templatePixels[i + 3] = 255
    }
  }
  await sharp(templatePixels, { raw: { width: FRAME_WIDTH, height: FRAME_HEIGHT, channels: 4 } })
    .png()
    .toFile(join(dir, 'template.png'))

  // mask.png: white in artwork region, black outside (grayscale)
  const maskPixels = Buffer.alloc(FRAME_WIDTH * FRAME_HEIGHT)
  for (let y = 0; y < FRAME_HEIGHT; y++) {
    for (let x = 0; x < FRAME_WIDTH; x++) {
      const inArtwork = x >= artX && x < artX + artW && y >= artY && y < artY + artH
      maskPixels[y * FRAME_WIDTH + x] = inArtwork ? 255 : 0
    }
  }
  await sharp(maskPixels, { raw: { width: FRAME_WIDTH, height: FRAME_HEIGHT, channels: 1 } })
    .png()
    .toFile(join(dir, 'mask.png'))

  console.log(`Generated ${spec.name}`)
}

for (const spec of SPECS) {
  await generateTemplate(spec)
}
console.log('All templates generated.')
```

- [ ] **Step 2: Run the generator**

```bash
npm run generate-templates
```

Expected output:
```
Generated thin-black
Generated classic-wood
Generated ornate-gold
All templates generated.
```

Verify files exist:
```bash
ls src/templates/thin-black/
```
Expected: `mask.png  scene.json  template.png`

- [ ] **Step 3: Commit**

```bash
git add scripts/generate-templates.ts src/templates/thin-black/template.png src/templates/thin-black/mask.png src/templates/classic-wood/template.png src/templates/classic-wood/mask.png src/templates/ornate-gold/template.png src/templates/ornate-gold/mask.png
git commit -m "feat: synthetic frame template PNG assets (placeholder for real photos)"
```

---

### Task 6: Compositor

**Model: sonnet**

**Files:**
- Create: `src/compositor.ts`
- Create: `tests/compositor.test.ts`

**Interfaces:**
- Consumes:
  - `warpArtwork(artworkBuffer: Buffer, artWidth: number, artHeight: number, targetQuad: Quad, frameWidth: number, frameHeight: number): Buffer` from `src/warp.ts`
  - `loadScene(frame: FrameName): SceneConfig` from `src/templates.ts`
  - `getTemplatePath(frame: FrameName): string` from `src/templates.ts`
  - `FrameName`, `Quad`, `CompositorError` from `src/types.ts`
- Produces:
  - `composite(artworkBuffer: Buffer, frame: FrameName): Promise<Buffer>` — returns a PNG Buffer of the artwork warped into the frame, composited over the template

- [ ] **Step 1: Write the failing test**

Create `tests/compositor.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { composite } from '../src/compositor.js'
import sharp from 'sharp'

async function makeRedPng(width = 200, height = 150): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 4, background: { r: 255, g: 0, b: 0, alpha: 1 } },
  }).png().toBuffer()
}

describe('composite', () => {
  it('returns a Buffer', async () => {
    const artwork = await makeRedPng()
    const result = await composite(artwork, 'thin-black')
    expect(result).toBeInstanceOf(Buffer)
    expect(result.length).toBeGreaterThan(0)
  })

  it('output is a valid PNG with correct dimensions', async () => {
    const artwork = await makeRedPng()
    const result = await composite(artwork, 'thin-black')
    const meta = await sharp(result).metadata()
    expect(meta.format).toBe('png')
    expect(meta.width).toBe(1200)
    expect(meta.height).toBe(900)
  })

  it('output differs from template (artwork was composited)', async () => {
    const artwork = await makeRedPng()
    const result = await composite(artwork, 'thin-black')
    // read center pixel — should be reddish (artwork region)
    const { data } = await sharp(result)
      .extract({ left: 590, top: 440, width: 1, height: 1 })
      .raw()
      .toBuffer({ resolveWithObject: true })
    expect(data[0]).toBeGreaterThan(150) // R channel
  })
})
```

- [ ] **Step 2: Run to verify it fails**

```bash
npx vitest run tests/compositor.test.ts
```

Expected: FAIL — `Cannot find module '../src/compositor.js'`

- [ ] **Step 3: Implement `src/compositor.ts`**

```typescript
import sharp from 'sharp'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { warpArtwork } from './warp.js'
import { loadScene, getTemplatePath } from './templates.js'
import type { FrameName } from './types.js'
import { CompositorError } from './types.js'

export async function composite(artworkBuffer: Buffer, frame: FrameName): Promise<Buffer> {
  const scene = loadScene(frame)
  const templateDir = getTemplatePath(frame)

  const templatePath = join(templateDir, 'template.png')
  const maskPath = join(templateDir, 'mask.png')

  let templateMeta: sharp.Metadata
  let artworkMeta: sharp.Metadata
  let artworkRaw: Buffer
  let templateBuf: Buffer

  try {
    templateMeta = await sharp(templatePath).metadata()
    artworkMeta = await sharp(artworkBuffer).metadata()
    artworkRaw = await sharp(artworkBuffer).ensureAlpha().raw().toBuffer()
    templateBuf = await sharp(templatePath).png().toBuffer()
  } catch (err) {
    throw new CompositorError('Failed to load template or artwork assets', { cause: err })
  }

  const frameWidth = templateMeta.width!
  const frameHeight = templateMeta.height!
  const artWidth = artworkMeta.width!
  const artHeight = artworkMeta.height!

  const warpedRaw = warpArtwork(artworkRaw, artWidth, artHeight, scene.quad, frameWidth, frameHeight)

  const warpedBuf = await sharp(warpedRaw, {
    raw: { width: frameWidth, height: frameHeight, channels: 4 },
  }).png().toBuffer()

  // Read mask and apply: use mask to punch artwork into template
  const maskRaw = await sharp(maskPath)
    .grayscale()
    .raw()
    .toBuffer()

  // Build output: for each pixel, if mask is white use warped artwork else use template
  const templateRaw = await sharp(templateBuf).ensureAlpha().raw().toBuffer()
  const warpedRawFinal = await sharp(warpedBuf).ensureAlpha().raw().toBuffer()

  const outBuf = Buffer.alloc(frameWidth * frameHeight * 4)
  for (let i = 0; i < frameWidth * frameHeight; i++) {
    const m = maskRaw[i] / 255
    for (let c = 0; c < 4; c++) {
      const tw = i * 4 + c
      outBuf[tw] = Math.round(warpedRawFinal[tw] * m + templateRaw[tw] * (1 - m))
    }
  }

  try {
    return await sharp(outBuf, {
      raw: { width: frameWidth, height: frameHeight, channels: 4 },
    }).png().toBuffer()
  } catch (err) {
    throw new CompositorError('Failed to encode composite image', { cause: err })
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/compositor.test.ts
```

Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/compositor.ts tests/compositor.test.ts
git commit -m "feat: compositor — perspective warp + mask blend into frame template"
```

---

### Task 7: Pipeline orchestrator and public index

**Model: sonnet**

**Files:**
- Create: `src/pipeline.ts`
- Create: `src/index.ts`
- Create: `tests/pipeline.test.ts`

**Interfaces:**
- Consumes:
  - `composite(artworkBuffer: Buffer, frame: FrameName): Promise<Buffer>` from `src/compositor.ts`
  - `loadScene(frame: FrameName): SceneConfig` from `src/templates.ts`
  - `AiProvider`, `FrameOptions`, `ProviderError` from `src/types.ts`
- Produces:
  - `frameArtwork(artworkPath: string, options: FrameOptions): Promise<void>` — reads artwork PNG from disk, runs full pipeline, writes output PNG to `options.output`

- [ ] **Step 1: Write the failing test**

Create `tests/pipeline.test.ts`:

```typescript
import { describe, it, expect, afterEach } from 'vitest'
import { frameArtwork } from '../src/pipeline.js'
import type { AiProvider } from '../src/types.js'
import { ProviderError } from '../src/types.js'
import { writeFileSync, existsSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'

const OUTPUT = join(import.meta.dirname, 'output-test.png')

const mockProvider: AiProvider = {
  async prePass(buf) { return buf },
  async postPass(buf) { return buf },
}

async function makeFixturePng(): Promise<string> {
  const p = join(import.meta.dirname, 'fixture-artwork.png')
  await sharp({
    create: { width: 100, height: 100, channels: 4, background: { r: 0, g: 128, b: 255, alpha: 1 } },
  }).png().toFile(p)
  return p
}

afterEach(() => {
  if (existsSync(OUTPUT)) unlinkSync(OUTPUT)
})

describe('frameArtwork', () => {
  it('writes a valid PNG to the output path', async () => {
    const artwork = await makeFixturePng()
    await frameArtwork(artwork, { frame: 'thin-black', provider: mockProvider, output: OUTPUT })
    expect(existsSync(OUTPUT)).toBe(true)
    const meta = await sharp(OUTPUT).metadata()
    expect(meta.format).toBe('png')
    expect(meta.width).toBe(1200)
    expect(meta.height).toBe(900)
  })

  it('calls provider.prePass and provider.postPass', async () => {
    const artwork = await makeFixturePng()
    let preCalled = false, postCalled = false
    const trackingProvider: AiProvider = {
      async prePass(buf) { preCalled = true; return buf },
      async postPass(buf) { postCalled = true; return buf },
    }
    await frameArtwork(artwork, { frame: 'classic-wood', provider: trackingProvider, output: OUTPUT })
    expect(preCalled).toBe(true)
    expect(postCalled).toBe(true)
  })

  it('wraps provider errors as ProviderError', async () => {
    const artwork = await makeFixturePng()
    const brokenProvider: AiProvider = {
      async prePass() { throw new Error('network failure') },
      async postPass(buf) { return buf },
    }
    await expect(
      frameArtwork(artwork, { frame: 'thin-black', provider: brokenProvider, output: OUTPUT }),
    ).rejects.toThrow(ProviderError)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

```bash
npx vitest run tests/pipeline.test.ts
```

Expected: FAIL — `Cannot find module '../src/pipeline.js'`

- [ ] **Step 3: Implement `src/pipeline.ts`**

```typescript
import { readFileSync, writeFileSync } from 'node:fs'
import { composite } from './compositor.js'
import { loadScene } from './templates.js'
import type { FrameOptions } from './types.js'
import { ProviderError } from './types.js'

export async function frameArtwork(artworkPath: string, options: FrameOptions): Promise<void> {
  const { frame, provider, output } = options
  const scene = loadScene(frame)

  let artwork = readFileSync(artworkPath)

  try {
    artwork = await provider.prePass(artwork, scene.hint)
  } catch (err) {
    throw new ProviderError('AI pre-pass failed', { cause: err })
  }

  const composited = await composite(artwork, frame)

  let final: Buffer
  try {
    final = await provider.postPass(composited, scene.hint)
  } catch (err) {
    throw new ProviderError('AI post-pass failed', { cause: err })
  }

  writeFileSync(output, final)
}
```

- [ ] **Step 4: Implement `src/index.ts`**

```typescript
export { frameArtwork } from './pipeline.js'
export type { AiProvider, FrameName, FrameOptions, SceneConfig, Quad } from './types.js'
export { CompositorError, ProviderError, TemplateNotFoundError } from './types.js'
```

- [ ] **Step 5: Run test to verify it passes**

```bash
npx vitest run tests/pipeline.test.ts
```

Expected: PASS (3 tests)

- [ ] **Step 6: Commit**

```bash
git add src/pipeline.ts src/index.ts tests/pipeline.test.ts
git commit -m "feat: pipeline orchestrator and public index — frameArtwork() end-to-end"
```

---

### Task 8: CLI

**Model: haiku**

**Files:**
- Create: `src/cli.ts`
- Create: `tests/cli.test.ts`

**Interfaces:**
- Consumes: `frameArtwork(artworkPath: string, options: FrameOptions): Promise<void>` from `src/pipeline.ts`
- Consumes: `FrameName` from `src/types.ts`
- Produces: `art-framer` binary — `art-framer input.png --frame classic-wood --provider replicate --output result.png`

**Provider dynamic import:** The `--provider` flag is the name of an npm package that default-exports an `AiProvider`. The CLI does `const { default: provider } = await import(providerName)`.

- [ ] **Step 1: Write the failing integration test**

Create `tests/cli.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run to verify it fails**

```bash
npx vitest run tests/cli.test.ts
```

Expected: FAIL — `Cannot find module '../src/cli.js'` or similar

- [ ] **Step 3: Implement `src/cli.ts`**

```typescript
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
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/cli.test.ts
```

Expected: PASS (2 tests)

- [ ] **Step 5: Run full test suite to confirm no regressions**

```bash
npm test
```

Expected: all tests pass (warp, templates, compositor, pipeline, cli)

- [ ] **Step 6: Commit**

```bash
git add src/cli.ts tests/cli.test.ts
git commit -m "feat: CLI — art-framer binary with dynamic provider import"
```

---

### Task 9: Build verification and README

**Model: haiku**

**Files:**
- Modify: `package.json` (already created, verify bin path is correct after build)
- Create: `README.md`

**Interfaces:**
- Consumes: everything built so far
- Produces: working `npm run build` output in `dist/`, README with install + usage instructions

- [ ] **Step 1: Run the build**

```bash
npm run build
```

Expected: `dist/` directory created with `index.js`, `index.d.ts`, `cli.js`, `cli.d.ts` and associated map files. No TypeScript errors.

- [ ] **Step 2: Verify the built CLI runs**

```bash
node dist/cli.js --help
```

Expected output:
```
Usage: art-framer [options] <artwork>

Convert a plain artwork PNG into a photorealistic framed wall image

Arguments:
  artwork             Path to input artwork PNG

Options:
  -f, --frame <name>      Frame template (thin-black, classic-wood, ornate-gold)
  -p, --provider <package>  AiProvider package name or path to import
  -o, --output <path>     Output PNG path
  -h, --help              display help for command
```

- [ ] **Step 3: Create `README.md`**

````markdown
# art-framer

Convert a plain artwork PNG into a photorealistic framed wall image.

## Install

```bash
npm install art-framer
```

You'll also need an AI provider adapter. Provider adapters implement `prePass` and `postPass` and handle the actual model calls:

```bash
npm install art-framer-replicate   # community adapter for Replicate
```

## CLI

```bash
art-framer portrait.png --frame classic-wood --provider art-framer-replicate --output framed.png
```

Options:
- `--frame` — `thin-black` | `classic-wood` | `ornate-gold`
- `--provider` — package name or local path of an AiProvider adapter
- `--output` — output file path (default: `<input>-framed.png`)

## Library

```typescript
import { frameArtwork } from 'art-framer'

await frameArtwork('portrait.png', {
  frame: 'classic-wood',
  provider: myProvider,   // implements AiProvider
  output: 'framed.png',
})
```

## Writing a Provider

```typescript
import type { AiProvider } from 'art-framer'

const myProvider: AiProvider = {
  async prePass(artwork, sceneHint) {
    // adapt artwork colors/texture to match the scene
    return adaptedArtwork
  },
  async postPass(composite, sceneHint) {
    // enhance realism: glare, shadows, edge blending
    return enhancedImage
  },
}
```

Both methods receive a PNG `Buffer` and must return a PNG `Buffer`.

## Frame Templates

| Name | Description |
|---|---|
| `thin-black` | Minimal black metal frame, white gallery wall |
| `classic-wood` | Oak wood frame, warm gallery lighting |
| `ornate-gold` | Wide gold ornate frame, dark wall |

## Errors

- `TemplateNotFoundError` — unknown frame name
- `ProviderError` — AI provider call failed (`.cause` has the original error)
- `CompositorError` — image transform failed
````

- [ ] **Step 4: Run full test suite one final time**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add README.md dist/
git commit -m "feat: build output and README"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task |
|---|---|
| PNG in → framed PNG out | Task 7 (pipeline) |
| AI pre-pass (color/texture adapt) | Task 7 (pipeline calls `provider.prePass`) |
| Compositor (perspective warp + mask) | Tasks 3 + 6 |
| AI post-pass (glare, shadows, blending) | Task 7 (pipeline calls `provider.postPass`) |
| `AiProvider` interface | Task 2 |
| Pluggable provider (no vendor lock-in) | Tasks 2, 7, 8 |
| 3 built-in frame templates | Tasks 4 + 5 |
| `frameArtwork()` library API | Task 7 |
| CLI with `--frame`, `--provider`, `--output` | Task 8 |
| `CompositorError`, `ProviderError`, `TemplateNotFoundError` | Task 2 |
| CLI exits non-zero on error | Task 8 |
| Compositor unit tests (no AI) | Tasks 3, 6 |
| Pipeline tests with mock provider | Task 7 |
| CLI integration test | Task 8 |

All requirements covered.

**Placeholder scan:** No TBDs, TODOs, or incomplete steps found.

**Type consistency check:**
- `warpArtwork` signature in Task 3 matches usage in Task 6 ✓
- `composite` signature in Task 6 matches usage in Task 7 ✓
- `loadScene` / `getTemplatePath` in Task 4 matches usage in Tasks 6 and 7 ✓
- `AiProvider` interface in Task 2 matches mock usage in Tasks 7 and 8 ✓
- `FrameName` union type consistent across all tasks ✓

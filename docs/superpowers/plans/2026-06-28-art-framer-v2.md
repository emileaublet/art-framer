# art-framer v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace static-template framing with fully parametric framing: physical inch dimensions, named frame materials, mat spec, scene presets, and viewing angle — producing a flat geometric composite the AI provider renders into a photorealistic wall scene.

**Architecture:** Three new pure modules (types, scenes, geometry) feed a rewritten compositor that generates the full canvas from parameters in a single pixel-buffer pass. Pipeline and CLI updated. Static template system deleted. `warp.ts` unchanged.

**Tech Stack:** TypeScript 5, ESM, Node.js ≥20, sharp 0.33, commander 12, vitest 2, pnpm

## Global Constraints

- ESM-only (`"type": "module"`, `NodeNext` module resolution) — no CommonJS anywhere
- Node.js ≥ 20 — use `import.meta.dirname`, native `fetch`
- `sharp` and `commander` are the only runtime image/CLI deps
- `src/warp.ts` is NOT modified — pure math, still correct for any Quad
- All output files are PNG
- `angleDeg` must be in `[0, 45]`; values outside this range throw `CompositorError`
- pnpm for all package management (never `npm install`)
- Vitest test runner: `pnpm test` runs all tests

---

## File Map

**Create:**
- `src/scenes.ts` — `SCENE_PRESETS`, `resolveScene()`, `buildSceneHint()`
- `src/geometry.ts` — `computeLayout()`, `Layout`, `Rect` types
- `tests/scenes.test.ts`
- `tests/geometry.test.ts`
- `scripts/examples.ts` — generates a matrix of outputs for visual evaluation
- `tests/fixtures/starry-night.jpg` — downloaded in Task 5
- `tests/fixtures/great-wave.jpg` — downloaded in Task 5
- `tests/fixtures/water-lilies.jpg` — downloaded in Task 5
- `tests/output/examples/` — created by examples script

**Modify:**
- `src/types.ts` — rewrite: add `FrameSpec`, `MatSpec`, `ScenePreset`, `FrameOptions`; remove `FrameName`, `SceneConfig`, `TemplateNotFoundError`; keep `AiProvider`, `Quad`, `CompositorError`, `ProviderError`
- `src/compositor.ts` — rewrite: dynamic layout, layered pixel-buffer pass, no template files
- `src/pipeline.ts` — update: `composite(artwork, opts)` instead of `composite(artwork, frame)`; build sceneHint from opts
- `src/cli.ts` — rewrite: new flags, resolve provider path from `process.cwd()`
- `src/index.ts` — update exports
- `tests/compositor.test.ts` — update for new API
- `tests/pipeline.test.ts` — update for new API
- `tests/cli.test.ts` — update for new flags

**Delete:**
- `src/templates.ts`
- `scripts/generate-templates.ts`
- `tests/templates.test.ts`
- `src/templates/` directory (all contents)

---

### Task 1: New types + scenes

**Files:**
- Modify: `src/types.ts`
- Create: `src/scenes.ts`
- Create: `tests/scenes.test.ts`

**Interfaces:**
- Consumes: nothing (foundation layer)
- Produces:
  - `FrameMaterial`, `WoodEssence`, `FrameSpec`, `MatSpec`, `ScenePreset`, `FrameOptions` from `src/types.ts`
  - `Quad`, `AiProvider`, `CompositorError`, `ProviderError` kept in `src/types.ts`
  - `SCENE_PRESETS`, `resolveScene(scene)`, `buildSceneHint(opts)` from `src/scenes.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/scenes.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { resolveScene, buildSceneHint, SCENE_PRESETS } from '../src/scenes.js'
import type { FrameOptions } from '../src/types.js'

const baseOpts: FrameOptions = {
  artworkWidthIn: 16,
  artworkHeightIn: 24,
  frame: { material: 'oak', thicknessIn: 1.5, depthIn: 0.75 },
  mat: { widthIn: 2, color: 'white' },
  scene: 'white-gallery',
  angleDeg: 0,
  provider: { prePass: async (b) => b, postPass: async (b) => b },
  output: 'out.png',
}

describe('resolveScene', () => {
  it('returns preset data for known preset', () => {
    const r = resolveScene('white-gallery')
    expect(r.bgColor).toBe('#f5f5f5')
    expect(r.description).toContain('gallery')
  })

  it('returns custom description for unknown string', () => {
    const r = resolveScene('brick wall with sunlight')
    expect(r.bgColor).toBe('#f0f0f0')
    expect(r.description).toBe('brick wall with sunlight')
  })

  it('SCENE_PRESETS has all 5 presets', () => {
    const keys = Object.keys(SCENE_PRESETS)
    expect(keys).toContain('white-gallery')
    expect(keys).toContain('dark-moody')
    expect(keys).toContain('warm-living-room')
    expect(keys).toContain('concrete-loft')
    expect(keys).toContain('natural-light')
  })
})

describe('buildSceneHint', () => {
  it('mentions frame material', () => {
    expect(buildSceneHint(baseOpts)).toContain('oak')
  })

  it('mentions perfectly flat frontal for angleDeg=0', () => {
    expect(buildSceneHint(baseOpts)).toContain('perfectly flat frontal')
  })

  it('mentions angle for non-zero angleDeg', () => {
    expect(buildSceneHint({ ...baseOpts, angleDeg: 20 })).toContain('20')
  })

  it('handles black-paint material', () => {
    const hint = buildSceneHint({ ...baseOpts, frame: { ...baseOpts.frame, material: 'black-paint' } })
    expect(hint).toContain('black')
  })

  it('handles custom scene description', () => {
    expect(buildSceneHint({ ...baseOpts, scene: 'exposed brick wall' })).toContain('exposed brick wall')
  })

  it('mentions mat width and color', () => {
    const hint = buildSceneHint(baseOpts)
    expect(hint).toContain('2')
    expect(hint).toContain('white')
  })
})
```

- [ ] **Step 2: Run test — verify it fails**

```bash
pnpm test tests/scenes.test.ts
```

Expected: FAIL — `Cannot find module '../src/scenes.js'`

- [ ] **Step 3: Rewrite `src/types.ts`**

```typescript
export interface AiProvider {
  prePass(artwork: Buffer, sceneHint: string): Promise<Buffer>
  postPass(composite: Buffer, sceneHint: string): Promise<Buffer>
}

export type WoodEssence = 'oak' | 'walnut' | 'cherry' | 'maple' | 'ash' | 'pine'
export type FrameMaterial = WoodEssence | 'black-paint' | 'white-paint'

export interface FrameSpec {
  material: FrameMaterial
  thicknessIn: number
  depthIn: number
}

export interface MatSpec {
  widthIn: number
  depthIn?: number   // mat board thickness in inches (informational — used in AI prompt only)
  color: string      // 'white' | 'eggshell' | '#rrggbb'
}

export type ScenePreset =
  | 'white-gallery'
  | 'dark-moody'
  | 'warm-living-room'
  | 'concrete-loft'
  | 'natural-light'

export interface FrameOptions {
  artworkWidthIn: number
  artworkHeightIn: number
  frame: FrameSpec
  mat: MatSpec
  scene: ScenePreset | string
  angleDeg: number
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
```

- [ ] **Step 4: Create `src/scenes.ts`**

```typescript
import type { ScenePreset, FrameOptions, FrameMaterial } from './types.js'

export interface SceneResolved {
  bgColor: string
  description: string
}

export const SCENE_PRESETS: Record<ScenePreset, SceneResolved> = {
  'white-gallery':     { bgColor: '#f5f5f5', description: 'clean white gallery wall, soft even lighting from above' },
  'dark-moody':        { bgColor: '#1c1c1c', description: 'dark charcoal wall, dramatic raking side light with deep shadows' },
  'warm-living-room':  { bgColor: '#e8d5b8', description: 'warm beige wall, natural afternoon window light from the left' },
  'concrete-loft':     { bgColor: '#9a9a8a', description: 'exposed concrete wall, cool industrial overhead lighting' },
  'natural-light':     { bgColor: '#ede8e0', description: 'off-white wall, soft diffused daylight, no harsh shadows' },
}

const PRESET_KEYS = new Set<string>(Object.keys(SCENE_PRESETS))

export function resolveScene(scene: ScenePreset | string): SceneResolved {
  if (PRESET_KEYS.has(scene)) return SCENE_PRESETS[scene as ScenePreset]
  return { bgColor: '#f0f0f0', description: scene }
}

function frameDesc(material: FrameMaterial, thicknessIn: number): string {
  const thick = `${thicknessIn}-inch`
  if (material === 'black-paint') return `${thick} matte black painted wood frame`
  if (material === 'white-paint') return `${thick} white painted wood frame`
  return `${thick} ${material} wood frame with natural grain`
}

export function buildSceneHint(opts: FrameOptions): string {
  const { description } = resolveScene(opts.scene)
  const frame = frameDesc(opts.frame.material, opts.frame.thicknessIn)
  const matColor = opts.mat.color === 'white' ? 'white'
    : opts.mat.color === 'eggshell' ? 'eggshell'
    : opts.mat.color
  const matDepthPart = opts.mat.depthIn ? `, ${opts.mat.depthIn}-inch thick` : ''
  const mat = `${opts.mat.widthIn}-inch ${matColor} mat board${matDepthPart}`
  const angle = opts.angleDeg === 0
    ? 'perfectly flat frontal view'
    : `approximately ${opts.angleDeg}-degree angle showing frame depth`
  return `Photorealistic framed artwork. ${frame}. ${mat}. ${description}. ${angle}. Realistic drop shadow on wall.`
}
```

- [ ] **Step 5: Run tests — verify they pass**

```bash
pnpm test tests/scenes.test.ts
```

Expected: all 9 tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/types.ts src/scenes.ts tests/scenes.test.ts
git commit -m "feat: v2 types and scene presets — parametric FrameOptions, buildSceneHint"
```

---

### Task 2: Geometry

**Files:**
- Create: `src/geometry.ts`
- Create: `tests/geometry.test.ts`

**Interfaces:**
- Consumes: `FrameOptions`, `Quad`, `CompositorError` from `src/types.ts`
- Produces:
  - `Layout` interface (canvasW, canvasH, ppi, artRect, matRect, frameRect, wallColor, artQuad)
  - `Rect` interface (`{ x, y, w, h }`)
  - `computeLayout(opts: FrameOptions, wallColor: string): Layout`

- [ ] **Step 1: Write failing tests**

Create `tests/geometry.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { computeLayout } from '../src/geometry.js'
import { CompositorError } from '../src/types.js'
import type { FrameOptions } from '../src/types.js'

const baseOpts: FrameOptions = {
  artworkWidthIn: 10,
  artworkHeightIn: 14,
  frame: { material: 'oak', thicknessIn: 1.5, depthIn: 0.75 },
  mat: { widthIn: 2, color: 'white' },
  scene: 'white-gallery',
  angleDeg: 0,
  provider: { prePass: async (b) => b, postPass: async (b) => b },
  output: 'out.png',
}

describe('computeLayout', () => {
  it('artRect has correct aspect ratio', () => {
    const { artRect } = computeLayout(baseOpts, '#f5f5f5')
    expect(artRect.w / artRect.h).toBeCloseTo(10 / 14, 1)
  })

  it('frameRect contains matRect, matRect contains artRect', () => {
    const { frameRect, matRect, artRect } = computeLayout(baseOpts, '#f5f5f5')
    expect(matRect.x).toBeGreaterThan(frameRect.x)
    expect(matRect.y).toBeGreaterThan(frameRect.y)
    expect(artRect.x).toBeGreaterThan(matRect.x)
    expect(artRect.y).toBeGreaterThan(matRect.y)
    expect(matRect.x + matRect.w).toBeLessThan(frameRect.x + frameRect.w)
    expect(artRect.x + artRect.w).toBeLessThan(matRect.x + matRect.w)
  })

  it('canvas longest side is at most MAX_CANVAS_PX (2400)', () => {
    const layout = computeLayout(baseOpts, '#f5f5f5')
    expect(Math.max(layout.canvasW, layout.canvasH)).toBeLessThanOrEqual(2400)
  })

  it('wallColor is passed through to layout', () => {
    const layout = computeLayout(baseOpts, '#aabbcc')
    expect(layout.wallColor).toBe('#aabbcc')
  })

  it('artQuad is a perfect rectangle for angleDeg=0', () => {
    const { artQuad } = computeLayout(baseOpts, '#f5f5f5')
    // [TL, TR, BR, BL]
    expect(artQuad[0][0]).toBe(artQuad[3][0])  // TL.x === BL.x
    expect(artQuad[1][0]).toBe(artQuad[2][0])  // TR.x === BR.x
    expect(artQuad[0][1]).toBe(artQuad[1][1])  // TL.y === TR.y
    expect(artQuad[2][1]).toBe(artQuad[3][1])  // BR.y === BL.y
  })

  it('artQuad is a trapezoid for angleDeg=20', () => {
    const { artQuad } = computeLayout({ ...baseOpts, angleDeg: 20 }, '#f5f5f5')
    expect(artQuad[0][0]).toBe(artQuad[3][0])  // still symmetric vertically
    expect(artQuad[1][0]).toBe(artQuad[2][0])
    expect(artQuad[0][0]).toBeGreaterThan(0)    // left edge shifted right
    expect(artQuad[0][0]).toBeLessThan(artQuad[1][0])  // still has width
  })

  it('throws CompositorError for angleDeg > 45', () => {
    expect(() => computeLayout({ ...baseOpts, angleDeg: 50 }, '#f5f5f5'))
      .toThrow(CompositorError)
  })

  it('throws CompositorError for negative angleDeg', () => {
    expect(() => computeLayout({ ...baseOpts, angleDeg: -1 }, '#f5f5f5'))
      .toThrow(CompositorError)
  })

  it('wider artwork produces wider artRect', () => {
    const portrait = computeLayout(baseOpts, '#f5f5f5')            // 10"×14"
    const landscape = computeLayout({ ...baseOpts, artworkWidthIn: 20, artworkHeightIn: 14 }, '#f5f5f5')
    expect(landscape.artRect.w).toBeGreaterThan(portrait.artRect.w)
  })
})
```

- [ ] **Step 2: Run test — verify it fails**

```bash
pnpm test tests/geometry.test.ts
```

Expected: FAIL — `Cannot find module '../src/geometry.js'`

- [ ] **Step 3: Create `src/geometry.ts`**

```typescript
import type { FrameOptions, Quad } from './types.js'
import { CompositorError } from './types.js'

export interface Rect { x: number; y: number; w: number; h: number }

export interface Layout {
  canvasW: number
  canvasH: number
  ppi: number          // effective pixels-per-inch after scale
  artRect: Rect        // artwork placement area = mat opening
  matRect: Rect        // outer edge of mat = inner edge of frame
  frameRect: Rect      // outer edge of frame
  wallColor: string
  artQuad: Quad        // destination quad for warpArtwork (canvas coordinates)
}

const BASE_PPI = 100
const MAX_CANVAS_PX = 2400
const WALL_MARGIN_RATIO = 0.2

export function computeLayout(opts: FrameOptions, wallColor: string): Layout {
  if (opts.angleDeg < 0 || opts.angleDeg > 45) {
    throw new CompositorError(`angleDeg must be 0–45, got ${opts.angleDeg}`)
  }

  const artW = opts.artworkWidthIn * BASE_PPI
  const artH = opts.artworkHeightIn * BASE_PPI
  const matPx = opts.mat.widthIn * BASE_PPI
  const framePx = opts.frame.thicknessIn * BASE_PPI

  const framedW = artW + 2 * (matPx + framePx)
  const framedH = artH + 2 * (matPx + framePx)
  const marginX = framedW * WALL_MARGIN_RATIO
  const marginY = framedH * WALL_MARGIN_RATIO

  const rawW = framedW + 2 * marginX
  const rawH = framedH + 2 * marginY

  const scale = Math.min(1, MAX_CANVAS_PX / Math.max(rawW, rawH))
  const canvasW = Math.round(rawW * scale)
  const canvasH = Math.round(rawH * scale)
  const ppi = BASE_PPI * scale

  const frameX = Math.round(marginX * scale)
  const frameY = Math.round(marginY * scale)
  const frameW = Math.round(framedW * scale)
  const frameH = Math.round(framedH * scale)

  const framePxS = Math.round(framePx * scale)
  const matPxS = Math.round(matPx * scale)

  const matX = frameX + framePxS
  const matY = frameY + framePxS
  const matW = frameW - 2 * framePxS
  const matH = frameH - 2 * framePxS

  const artX = matX + matPxS
  const artY = matY + matPxS
  const artRW = matW - 2 * matPxS
  const artRH = matH - 2 * matPxS

  const frameRect: Rect = { x: frameX, y: frameY, w: frameW, h: frameH }
  const matRect: Rect   = { x: matX,   y: matY,   w: matW,   h: matH   }
  const artRect: Rect   = { x: artX,   y: artY,   w: artRW,  h: artRH  }

  let artQuad: Quad
  if (opts.angleDeg === 0) {
    artQuad = [
      [artX,        artY       ],
      [artX + artRW, artY       ],
      [artX + artRW, artY + artRH],
      [artX,        artY + artRH],
    ]
  } else {
    const theta = (opts.angleDeg * Math.PI) / 180
    const hShift = Math.round(artRW * Math.sin(theta) * 0.25)
    const vShift = Math.round(artRH * Math.sin(theta) * 0.05)
    artQuad = [
      [artX + hShift,          artY + vShift         ],  // TL
      [artX + artRW - hShift,  artY + vShift         ],  // TR
      [artX + artRW - hShift,  artY + artRH - vShift ],  // BR
      [artX + hShift,          artY + artRH - vShift ],  // BL
    ]
  }

  return { canvasW, canvasH, ppi, artRect, matRect, frameRect, wallColor, artQuad }
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
pnpm test tests/geometry.test.ts
```

Expected: all 9 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/geometry.ts tests/geometry.test.ts
git commit -m "feat: geometry module — computeLayout converts inches to canvas pixel layout"
```

---

### Task 3: Compositor rewrite

**Files:**
- Modify: `src/compositor.ts` (full rewrite)
- Modify: `tests/compositor.test.ts` (full rewrite)

**Interfaces:**
- Consumes:
  - `warpArtwork(artworkRaw, artW, artH, quad, canvasW, canvasH): Buffer` from `src/warp.js`
  - `resolveScene(scene): SceneResolved` from `src/scenes.js`
  - `computeLayout(opts, wallColor): Layout` from `src/geometry.js`
  - `FrameOptions`, `Quad`, `CompositorError` from `src/types.js`
- Produces:
  - `composite(artworkBuffer: Buffer, opts: FrameOptions): Promise<Buffer>`

The pixel-buffer loop uses four layers (wall → frame → mat → artwork). Only pixels inside `matRect` need the `pointInQuad` check; all others are classified by rectangle bounds.

`pointInQuad` uses a cross-product test. For the clockwise quad ordering `[TL, TR, BR, BL]`, a pixel is inside when the cross product of each edge vector with the point vector is ≥ 0 for all 4 edges.

- [ ] **Step 1: Rewrite `tests/compositor.test.ts`**

```typescript
import { describe, it, expect } from 'vitest'
import { composite } from '../src/compositor.js'
import { CompositorError } from '../src/types.js'
import type { FrameOptions } from '../src/types.js'
import sharp from 'sharp'

async function makeColorPng(width: number, height: number, r: number, g: number, b: number): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 4, background: { r, g, b, alpha: 1 } },
  }).png().toBuffer()
}

const baseOpts: FrameOptions = {
  artworkWidthIn: 10,
  artworkHeightIn: 14,
  frame: { material: 'oak', thicknessIn: 1.5, depthIn: 0.75 },
  mat: { widthIn: 2, color: 'white' },
  scene: 'white-gallery',
  angleDeg: 0,
  provider: { prePass: async (b) => b, postPass: async (b) => b },
  output: 'out.png',
}

describe('composite', () => {
  it('returns a valid PNG Buffer', async () => {
    const result = await composite(await makeColorPng(400, 560, 255, 0, 0), baseOpts)
    const meta = await sharp(result).metadata()
    expect(meta.format).toBe('png')
    expect(meta.width).toBeGreaterThan(0)
    expect(meta.height).toBeGreaterThan(0)
  })

  it('output dimensions are within 2400px on longest side', async () => {
    const result = await composite(await makeColorPng(400, 560, 255, 0, 0), baseOpts)
    const meta = await sharp(result).metadata()
    expect(Math.max(meta.width!, meta.height!)).toBeLessThanOrEqual(2400)
  })

  it('artwork aspect ratio is preserved (center region is artwork color)', async () => {
    // Red artwork — center of output should be red
    const result = await composite(await makeColorPng(400, 560, 200, 0, 0), baseOpts)
    const { width, height } = await sharp(result).metadata()
    const { data } = await sharp(result)
      .extract({ left: Math.round(width! / 2) - 1, top: Math.round(height! / 2) - 1, width: 1, height: 1 })
      .raw().toBuffer({ resolveWithObject: true })
    expect(data[0]).toBeGreaterThan(150)  // R channel
    expect(data[1]).toBeLessThan(50)      // G channel low
  })

  it('works with walnut frame and dark-moody scene', async () => {
    const result = await composite(await makeColorPng(300, 400, 100, 150, 200), {
      ...baseOpts,
      frame: { material: 'walnut', thicknessIn: 2, depthIn: 1 },
      mat: { widthIn: 1.5, color: 'eggshell' },
      scene: 'dark-moody',
    })
    expect(await sharp(result).metadata()).toMatchObject({ format: 'png' })
  })

  it('works with black-paint frame and custom scene description', async () => {
    const result = await composite(await makeColorPng(300, 400, 80, 120, 200), {
      ...baseOpts,
      frame: { material: 'black-paint', thicknessIn: 1, depthIn: 0.5 },
      scene: 'exposed brick wall with afternoon light',
    })
    expect(await sharp(result).metadata()).toMatchObject({ format: 'png' })
  })

  it('works with angle=20', async () => {
    const result = await composite(await makeColorPng(400, 560, 0, 200, 100), {
      ...baseOpts,
      angleDeg: 20,
    })
    expect(await sharp(result).metadata()).toMatchObject({ format: 'png' })
  })

  it('throws CompositorError for angleDeg > 45', async () => {
    await expect(composite(await makeColorPng(400, 560, 255, 0, 0), { ...baseOpts, angleDeg: 50 }))
      .rejects.toBeInstanceOf(CompositorError)
  })

  it('wider artwork produces wider output', async () => {
    const portrait = await composite(await makeColorPng(400, 560, 255, 0, 0), baseOpts)  // 10"×14"
    const landscape = await composite(await makeColorPng(560, 400, 255, 0, 0), {
      ...baseOpts, artworkWidthIn: 20, artworkHeightIn: 14,
    })
    expect((await sharp(landscape).metadata()).width).toBeGreaterThan(
      (await sharp(portrait).metadata()).width!,
    )
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
pnpm test tests/compositor.test.ts
```

Expected: multiple FAIL — old `composite(artwork, frameName)` signature doesn't match

- [ ] **Step 3: Rewrite `src/compositor.ts`**

```typescript
import sharp from 'sharp'
import { warpArtwork } from './warp.js'
import { resolveScene } from './scenes.js'
import { computeLayout } from './geometry.js'
import type { FrameOptions, Quad } from './types.js'
import { CompositorError } from './types.js'

const FRAME_COLORS: Record<string, string> = {
  'black-paint': '#1a1a1a',
  'white-paint': '#f0f0f0',
  oak:           '#c8a96e',
  walnut:        '#5c3d1e',
  cherry:        '#a0522d',
  maple:         '#d4a96a',
  ash:           '#b8a898',
  pine:          '#d4b896',
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

function resolveMatHex(color: string): string {
  if (color === 'white') return '#ffffff'
  if (color === 'eggshell') return '#f4f0e8'
  return color
}

// Cross-product point-in-quad test for clockwise quad [TL, TR, BR, BL].
// A pixel is inside when all 4 edge cross products are >= 0.
function pointInQuad(x: number, y: number, quad: Quad): boolean {
  for (let i = 0; i < 4; i++) {
    const [ax, ay] = quad[i]
    const [bx, by] = quad[(i + 1) % 4]
    if ((bx - ax) * (y - ay) - (by - ay) * (x - ax) < 0) return false
  }
  return true
}

export async function composite(artworkBuffer: Buffer, opts: FrameOptions): Promise<Buffer> {
  const { bgColor } = resolveScene(opts.scene)

  let layout
  try {
    layout = computeLayout(opts, bgColor)
  } catch (err) {
    throw new CompositorError('Layout computation failed', { cause: err })
  }

  const { canvasW, canvasH, artRect, matRect, frameRect, wallColor, artQuad } = layout

  // Decode and scale artwork to exact artRect dimensions (user-specified aspect ratio)
  let artworkRaw: Buffer
  try {
    artworkRaw = await sharp(artworkBuffer)
      .resize(artRect.w, artRect.h, { fit: 'fill' })
      .ensureAlpha()
      .raw()
      .toBuffer()
  } catch (err) {
    throw new CompositorError('Failed to decode or resize artwork', { cause: err })
  }

  // Warp artwork into full canvas space using artQuad as destination
  const warpedRaw = warpArtwork(artworkRaw, artRect.w, artRect.h, artQuad, canvasW, canvasH)

  const wallRgb   = hexToRgb(wallColor)
  const frameRgb  = hexToRgb(FRAME_COLORS[opts.frame.material] ?? '#888888')
  const matRgb    = hexToRgb(resolveMatHex(opts.mat.color))

  const canvas = Buffer.alloc(canvasW * canvasH * 4)

  const isFlat = opts.angleDeg === 0

  for (let py = 0; py < canvasH; py++) {
    for (let px = 0; px < canvasW; px++) {
      const i = (py * canvasW + px) * 4
      let rgb: [number, number, number]

      if (
        px >= frameRect.x && px < frameRect.x + frameRect.w &&
        py >= frameRect.y && py < frameRect.y + frameRect.h
      ) {
        if (
          px >= matRect.x && px < matRect.x + matRect.w &&
          py >= matRect.y && py < matRect.y + matRect.h
        ) {
          const inArt = isFlat
            ? px >= artRect.x && px < artRect.x + artRect.w &&
              py >= artRect.y && py < artRect.y + artRect.h
            : pointInQuad(px, py, artQuad)

          if (inArt) {
            canvas[i]     = warpedRaw[i]
            canvas[i + 1] = warpedRaw[i + 1]
            canvas[i + 2] = warpedRaw[i + 2]
            canvas[i + 3] = 255
            continue
          }
          rgb = matRgb
        } else {
          rgb = frameRgb
        }
      } else {
        rgb = wallRgb
      }

      canvas[i]     = rgb[0]
      canvas[i + 1] = rgb[1]
      canvas[i + 2] = rgb[2]
      canvas[i + 3] = 255
    }
  }

  try {
    return await sharp(canvas, { raw: { width: canvasW, height: canvasH, channels: 4 } })
      .png()
      .toBuffer()
  } catch (err) {
    throw new CompositorError('Failed to encode composite', { cause: err })
  }
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
pnpm test tests/compositor.test.ts
```

Expected: all 7 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/compositor.ts tests/compositor.test.ts
git commit -m "feat: rewrite compositor — parametric pixel-buffer pass, no static templates"
```

---

### Task 4: Pipeline + CLI + Cleanup

**Files:**
- Modify: `src/pipeline.ts`
- Modify: `src/cli.ts`
- Modify: `src/index.ts`
- Modify: `tests/pipeline.test.ts`
- Modify: `tests/cli.test.ts`
- Delete: `src/templates.ts`, `scripts/generate-templates.ts`, `tests/templates.test.ts`, entire `src/templates/` directory

**Interfaces:**
- Consumes: `composite(artworkBuffer, opts)` from `src/compositor.js`; `buildSceneHint(opts)` from `src/scenes.js`
- Produces: updated public API in `src/index.ts`

- [ ] **Step 1: Rewrite `tests/pipeline.test.ts`**

```typescript
import { describe, it, expect } from 'vitest'
import { frameArtwork } from '../src/pipeline.js'
import type { AiProvider, FrameOptions } from '../src/types.js'
import { ProviderError } from '../src/types.js'
import { existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'

const FIXTURES = join(import.meta.dirname, 'fixtures')
const OUTPUT_DIR = join(import.meta.dirname, 'output')
mkdirSync(OUTPUT_DIR, { recursive: true })

const mockProvider: AiProvider = {
  async prePass(buf) { return buf },
  async postPass(buf) { return buf },
}

const baseOpts: Omit<FrameOptions, 'output'> = {
  artworkWidthIn: 18,
  artworkHeightIn: 24,
  frame: { material: 'oak', thicknessIn: 1.5, depthIn: 0.75 },
  mat: { widthIn: 2, color: 'white' },
  scene: 'white-gallery',
  angleDeg: 0,
  provider: mockProvider,
}

describe('frameArtwork — real artwork fixtures', () => {
  it('frames mona-lisa.jpg with walnut frame', async () => {
    const output = join(OUTPUT_DIR, 'mona-lisa-walnut-white-gallery.png')
    await frameArtwork(join(FIXTURES, 'mona-lisa.jpg'), {
      ...baseOpts,
      artworkWidthIn: 21,
      artworkHeightIn: 30,
      frame: { material: 'walnut', thicknessIn: 2, depthIn: 1 },
      output,
    })
    expect(existsSync(output)).toBe(true)
    expect(await sharp(output).metadata()).toMatchObject({ format: 'png' })
  })

  it('frames birth-of-venus.jpg with black-paint frame', async () => {
    const output = join(OUTPUT_DIR, 'birth-of-venus-black-dark-moody.png')
    await frameArtwork(join(FIXTURES, 'birth-of-venus.jpg'), {
      ...baseOpts,
      artworkWidthIn: 54,
      artworkHeightIn: 34,
      frame: { material: 'black-paint', thicknessIn: 1.5, depthIn: 0.75 },
      mat: { widthIn: 2.5, color: 'white' },
      scene: 'dark-moody',
      output,
    })
    expect(existsSync(output)).toBe(true)
    expect(await sharp(output).metadata()).toMatchObject({ format: 'png' })
  })

  it('frames sunday-grande-jatte.jpg with oak frame, angle=15', async () => {
    const output = join(OUTPUT_DIR, 'sunday-grande-jatte-oak-angle15.png')
    await frameArtwork(join(FIXTURES, 'sunday-grande-jatte.jpg'), {
      ...baseOpts,
      artworkWidthIn: 81,
      artworkHeightIn: 54,
      frame: { material: 'oak', thicknessIn: 1.5, depthIn: 0.75 },
      mat: { widthIn: 0, color: 'white' },
      angleDeg: 15,
      output,
    })
    expect(existsSync(output)).toBe(true)
    expect(await sharp(output).metadata()).toMatchObject({ format: 'png' })
  })

  it('calls provider.prePass and provider.postPass', async () => {
    let preCalled = false, postCalled = false
    const tracking: AiProvider = {
      async prePass(buf) { preCalled = true; return buf },
      async postPass(buf) { postCalled = true; return buf },
    }
    await frameArtwork(join(FIXTURES, 'mona-lisa.jpg'), {
      ...baseOpts, provider: tracking, output: join(OUTPUT_DIR, 'provider-tracking.png'),
    })
    expect(preCalled).toBe(true)
    expect(postCalled).toBe(true)
  })

  it('wraps provider errors as ProviderError', async () => {
    const broken: AiProvider = {
      async prePass() { throw new Error('network failure') },
      async postPass(buf) { return buf },
    }
    await expect(
      frameArtwork(join(FIXTURES, 'mona-lisa.jpg'), {
        ...baseOpts, provider: broken, output: join(OUTPUT_DIR, 'should-not-exist.png'),
      }),
    ).rejects.toThrow(ProviderError)
  })
})
```

- [ ] **Step 2: Run pipeline tests — verify they fail**

```bash
pnpm test tests/pipeline.test.ts
```

Expected: FAIL — `composite` signature mismatch or missing sceneHint

- [ ] **Step 3: Rewrite `src/pipeline.ts`**

```typescript
import { readFileSync, writeFileSync } from 'node:fs'
import { composite } from './compositor.js'
import { buildSceneHint } from './scenes.js'
import type { FrameOptions } from './types.js'
import { ProviderError } from './types.js'

export async function frameArtwork(artworkPath: string, opts: FrameOptions): Promise<void> {
  const { provider, output } = opts
  const sceneHint = buildSceneHint(opts)

  let artwork: Buffer = readFileSync(artworkPath)

  try {
    artwork = await provider.prePass(artwork, sceneHint)
  } catch (err) {
    throw new ProviderError('AI pre-pass failed', { cause: err })
  }

  const composited = await composite(artwork, opts)

  let final: Buffer
  try {
    final = await provider.postPass(composited, sceneHint)
  } catch (err) {
    throw new ProviderError('AI post-pass failed', { cause: err })
  }

  writeFileSync(output, final)
}
```

- [ ] **Step 4: Rewrite `tests/cli.test.ts`**

```typescript
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
```

- [ ] **Step 5: Rewrite `src/cli.ts`**

```typescript
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
```

- [ ] **Step 6: Update `src/index.ts`**

```typescript
export { frameArtwork } from './pipeline.js'
export type {
  AiProvider,
  FrameOptions,
  FrameSpec,
  MatSpec,
  ScenePreset,
  WoodEssence,
  FrameMaterial,
  Quad,
} from './types.js'
export { CompositorError, ProviderError } from './types.js'
export { SCENE_PRESETS, resolveScene, buildSceneHint } from './scenes.js'
export type { SceneResolved } from './scenes.js'
export { computeLayout } from './geometry.js'
export type { Layout, Rect } from './geometry.js'
```

- [ ] **Step 7: Delete old files**

```bash
rm src/templates.ts
rm scripts/generate-templates.ts
rm tests/templates.test.ts
rm -rf src/templates/
```

- [ ] **Step 8: Remove `generate-templates` npm script from `package.json`**

In `package.json`, delete the line:
```json
"generate-templates": "tsx scripts/generate-templates.ts",
```

- [ ] **Step 9: Run all tests — verify they pass**

```bash
pnpm test
```

Expected: all tests PASS (warp, scenes, geometry, compositor, cli, pipeline)

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: v2 pipeline, CLI, cleanup — parametric API, relative provider path fix, delete static templates"
```

---

### Task 5: New fixtures + Examples matrix script

**Files:**
- Create: `tests/fixtures/starry-night.jpg`
- Create: `tests/fixtures/great-wave.jpg`
- Create: `tests/fixtures/water-lilies.jpg`
- Create: `scripts/examples.ts`

**Goal:** Download 3 more artworks, then run a matrix of compositor outputs covering all materials, all scene presets, and 3 angles. Outputs go to `tests/output/examples/` for visual evaluation. Uses the mock (pass-through) provider — no Replicate API needed.

- [ ] **Step 1: Download new fixture images**

```bash
curl -L "https://upload.wikimedia.org/wikipedia/commons/thumb/e/ea/Van_Gogh_-_Starry_Night_-_Google_Art_Project.jpg/1280px-Van_Gogh_-_Starry_Night_-_Google_Art_Project.jpg" -o tests/fixtures/starry-night.jpg

curl -L "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a5/Tsunami_by_hokusai_19th_century.jpg/1280px-Tsunami_by_hokusai_19th_century.jpg" -o tests/fixtures/great-wave.jpg

curl -L "https://upload.wikimedia.org/wikipedia/commons/thumb/a/aa/Claude_Monet_-_Water_Lilies_-_1906%2C_Ryerson.jpg/1280px-Claude_Monet_-_Water_Lilies_-_1906%2C_Ryerson.jpg" -o tests/fixtures/water-lilies.jpg
```

Verify each downloaded file is a valid image:
```bash
node -e "
import('sharp').then(({default: sharp}) => Promise.all([
  'tests/fixtures/starry-night.jpg',
  'tests/fixtures/great-wave.jpg',
  'tests/fixtures/water-lilies.jpg',
].map(f => sharp(f).metadata().then(m => console.log(f, m.width + 'x' + m.height)))))"
```

- [ ] **Step 2: Create `scripts/examples.ts`**

This generates a 6-artwork × 3-material × 5-scene × 3-angle matrix = 270 outputs. To keep it manageable, use a curated subset: 6 artworks × key combinations = ~54 files. Each file is named `{artwork}-{material}-{scene}-{angle}deg.png`.

```typescript
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
```

- [ ] **Step 3: Run the examples script**

```bash
pnpm tsx scripts/examples.ts
```

Expected: `Done — 162 images in tests/output/examples/`

- [ ] **Step 4: Spot-check a few outputs**

```bash
open tests/output/examples/mona-lisa--oak--white-gallery--0deg.png
open tests/output/examples/starry-night--walnut--dark-moody--15deg.png
open tests/output/examples/great-wave--black-paint--warm-living-room--25deg.png
```

- [ ] **Step 5: Build and run full test suite**

```bash
pnpm build && pnpm test
```

Expected: all tests PASS; `dist/` contains updated CLI

- [ ] **Step 6: Commit**

```bash
git add tests/fixtures/starry-night.jpg tests/fixtures/great-wave.jpg tests/fixtures/water-lilies.jpg scripts/examples.ts
git commit -m "feat: 3 new art fixtures + examples matrix script (162 outputs for visual evaluation)"
git push origin main
```

# art-framer v2 Design Spec

## Goal

Replace the static-template framing system with a fully parametric one: physical dimensions in inches, named frame materials, mat spec, scene presets, and viewing angle — producing a flat geometric composite that the AI provider renders into a photorealistic wall scene.

## What Changes

| v1 | v2 |
|---|---|
| `frame: FrameName` (thin-black, classic-wood, ornate-gold) | `frame: FrameSpec` (material, thickness, depth) |
| Fixed 1200×900 canvas | Dynamic canvas computed from physical dimensions |
| Artwork stretched to fill quad | Artwork scaled to exact physical pixel area (no stretching) |
| Static template PNGs on disk | Compositor generates geometry from parameters |
| Opaque `sceneHint` string | Structured prompt built from all options |

## Removed

- `src/templates.ts` — deleted
- `src/templates/` directory — deleted
- `scripts/generate-templates.ts` — deleted
- `FrameName`, `SceneConfig`, `TemplateNotFoundError` types — deleted
- `generate-templates` npm script — deleted

## New Public Types (`src/types.ts`)

```typescript
export type WoodEssence = 'oak' | 'walnut' | 'cherry' | 'maple' | 'ash' | 'pine'
export type FrameMaterial = WoodEssence | 'black-paint' | 'white-paint'

export interface FrameSpec {
  material: FrameMaterial   // e.g. 'walnut', 'black-paint'
  thicknessIn: number       // molding width in inches, e.g. 1.5
  depthIn: number           // frame depth/reveal in inches, e.g. 0.75
}

export interface MatSpec {
  widthIn: number           // mat border width in inches, e.g. 2.0
  color: string             // 'white' | 'eggshell' | '#rrggbb'
}

export type ScenePreset =
  | 'white-gallery'
  | 'dark-moody'
  | 'warm-living-room'
  | 'concrete-loft'
  | 'natural-light'

export interface FrameOptions {
  artworkWidthIn: number    // physical artwork width in inches
  artworkHeightIn: number   // physical artwork height in inches
  frame: FrameSpec
  mat: MatSpec
  scene: ScenePreset | string   // preset name OR free-text description
  angleDeg: number          // 0 = perfectly flat frontal; any other value = approximate
  provider: AiProvider
  output: string
}

// Kept unchanged
export interface AiProvider {
  prePass(artwork: Buffer, sceneHint: string): Promise<Buffer>
  postPass(composite: Buffer, sceneHint: string): Promise<Buffer>
}

export class CompositorError extends Error { ... }   // unchanged
export class ProviderError extends Error { ... }     // unchanged
```

## New File: `src/scenes.ts`

Scene presets: background color (used in the flat composite) + prose description (used in the AI prompt).

```typescript
export const SCENE_PRESETS: Record<ScenePreset, { bgColor: string; description: string }> = {
  'white-gallery':     { bgColor: '#f5f5f5', description: 'clean white gallery wall, soft even lighting from above' },
  'dark-moody':        { bgColor: '#1c1c1c', description: 'dark charcoal wall, dramatic raking side light with deep shadows' },
  'warm-living-room':  { bgColor: '#e8d5b8', description: 'warm beige wall, natural afternoon window light from the left' },
  'concrete-loft':     { bgColor: '#9a9a8a', description: 'exposed concrete wall, cool industrial overhead lighting' },
  'natural-light':     { bgColor: '#ede8e0', description: 'off-white wall, soft diffused daylight, no harsh shadows' },
}

export function resolveScene(scene: ScenePreset | string): { bgColor: string; description: string }
// If scene is a known preset key, return SCENE_PRESETS[scene].
// Otherwise treat as a custom description and return bgColor '#f0f0f0'.

export function buildSceneHint(opts: FrameOptions): string
// Returns a single prose sentence used as sceneHint for both prePass and postPass.
// Format: "Photorealistic framed artwork. {frameDesc}. {matDesc}. {sceneDesc}. {angleDesc}. Realistic drop shadow on wall."
// frameDesc: e.g. "1.5-inch walnut wood frame with natural grain" or "1.5-inch matte black painted frame"
// matDesc:   e.g. "2-inch white mat board"
// sceneDesc: resolved description string
// angleDesc: angleDeg===0 → "perfectly flat frontal view"; else → "approximately {N}-degree angle showing frame depth"
```

## New File: `src/geometry.ts`

Converts physical inch measurements to pixel layout. No sharp imports.

```typescript
export const BASE_PPI = 100          // pixels per inch before scaling
export const MAX_CANVAS_PX = 2400    // longest output dimension cap
export const WALL_MARGIN_RATIO = 0.2 // wall margin = 20% of framed area on each side

export interface Layout {
  canvasW: number
  canvasH: number
  ppi: number              // effective pixels-per-inch after scaling
  artRect: Rect            // artwork placement area = mat opening
  matRect: Rect            // outer edge of mat = inner edge of frame (artRect expanded by matPx)
  frameRect: Rect          // outer edge of frame (outermost rectangle)
  wallColor: string        // from resolved scene
  artQuad: Quad            // 4-corner destination quad for warp (from artRect + angleDeg)
}

export interface Rect { x: number; y: number; w: number; h: number }

export function computeLayout(opts: FrameOptions, bgColor: string): Layout
// 1. Compute pixel sizes at BASE_PPI:
//    artW = artworkWidthIn * BASE_PPI
//    artH = artworkHeightIn * BASE_PPI
//    matPx = mat.widthIn * BASE_PPI
//    framePx = frame.thicknessIn * BASE_PPI
//    framedW = artW + 2*(matPx + framePx)
//    framedH = artH + 2*(matPx + framePx)
//    wallMarginX = framedW * WALL_MARGIN_RATIO
//    wallMarginY = framedH * WALL_MARGIN_RATIO
//    rawCanvasW = framedW + 2*wallMarginX
//    rawCanvasH = framedH + 2*wallMarginY
//
// 2. Scale to fit MAX_CANVAS_PX:
//    scale = min(1, MAX_CANVAS_PX / max(rawCanvasW, rawCanvasH))
//    canvasW = round(rawCanvasW * scale)
//    canvasH = round(rawCanvasH * scale)
//    effectivePPI = BASE_PPI * scale
//
// 3. Compute all rects (scaled):
//    artRect:   { x: wallMarginX*scale, y: wallMarginY*scale, w: artW*scale, h: artH*scale }
//    matRect:   artRect expanded by matPx*scale on all sides
//    frameRect: matRect expanded by framePx*scale on all sides
//
// 4. Compute artQuad from angleDeg:
//    angleDeg === 0 → perfect rectangle:
//      [[artRect.x, artRect.y], [artRect.x+artRect.w, artRect.y],
//       [artRect.x+artRect.w, artRect.y+artRect.h], [artRect.x, artRect.y+artRect.h]]
//    angleDeg > 0 → horizontal perspective trapezoid:
//      shift = artRect.w * sin(angleDeg * π/180) * 0.25
//      vShift = artRect.h * sin(angleDeg * π/180) * 0.05
//      top-left:     [artRect.x + shift,  artRect.y + vShift]
//      top-right:    [artRect.x + artRect.w - shift, artRect.y + vShift]
//      bottom-right: [artRect.x + artRect.w - shift, artRect.y + artRect.h - vShift]
//      bottom-left:  [artRect.x + shift,  artRect.y + artRect.h - vShift]
```

## Updated `src/compositor.ts`

No more template files. Generates flat composite entirely from `Layout`.

```typescript
export async function composite(artworkBuffer: Buffer, opts: FrameOptions): Promise<Buffer>
// 1. resolveScene(opts.scene) → { bgColor, description }
// 2. computeLayout(opts, bgColor) → layout
// 3. Build canvas pixel buffer (RGBA, canvasW × canvasH) in layers:
//
//    Layer 1 — wall: fill entire canvas with wallColor (bgColor from resolved scene)
//
//    Layer 2 — frame: fill every pixel inside frameRect with frameColor:
//        material → flat color approximation (AI adds real texture in postPass):
//        'black-paint' → #1a1a1a  'white-paint' → #f0f0f0
//        'oak'    → #c8a96e      'walnut' → #5c3d1e
//        'cherry' → #a0522d      'maple'  → #d4a96a
//        'ash'    → #b8a898      'pine'   → #d4b896
//
//    Layer 3 — mat: fill every pixel inside matRect with mat.color
//        Parse: 'white'→#ffffff  'eggshell'→#f4f0e8  '#rrggbb'→verbatim
//
//    Layer 4 — artwork: warpArtwork(artworkRaw, artWidth, artHeight,
//                                    layout.artQuad, canvasW, canvasH)
//        → warpedRaw (RGBA buffer, canvasW × canvasH)
//        For each pixel: if inside artQuad, replace canvas pixel with warpedRaw pixel.
//        angleDeg===0: artQuad is a rectangle → simple bounds check.
//        angleDeg>0:   use point-in-quad test (cross-product, same as warp.ts).
//
// 4. Encode as PNG and return.
//
// Notes:
// - Use sharp to decode artwork, scale to artRect.w × artRect.h (fit: fill —
//   user-specified inches define the aspect ratio, so no letterboxing needed).
// - All fill passes iterate the same pixel buffer (no sharp compositing overhead).
```

## Updated `src/pipeline.ts`

```typescript
export async function frameArtwork(artworkPath: string, opts: FrameOptions): Promise<void>
// 1. readFileSync(artworkPath)
// 2. sceneHint = buildSceneHint(opts)
// 3. provider.prePass(artwork, sceneHint) → wraps error in ProviderError
// 4. composite(prePassResult, opts)         → CompositorError already thrown inside
// 5. provider.postPass(composited, sceneHint) → wraps error in ProviderError
// 6. writeFileSync(opts.output, final)
```

## Updated `src/cli.ts`

```
art-framer [options] <artwork>

Options:
  --width <inches>           artwork physical width in inches (required)
  --height <inches>          artwork physical height in inches (required)
  --material <material>      oak|walnut|cherry|maple|ash|pine|black-paint|white-paint (default: oak)
  --frame-thickness <inches> molding width in inches (default: 1.5)
  --frame-depth <inches>     frame depth in inches (default: 0.75)
  --mat-width <inches>       mat border width in inches (default: 2.0)
  --mat-color <color>        white|eggshell|#rrggbb (default: white)
  --scene <scene>            preset or description string (default: white-gallery)
  --angle <degrees>          viewing angle 0–45 (default: 0)
  --provider <path>          path to AiProvider module (required)
  --output <path>            output file path (default: <artwork-basename>-framed.png)
```

CLI validation:
- `--width` and `--height` must be positive numbers
- `--angle` must be 0–45
- Unknown `--material` → error with list of valid values
- `--provider` path must resolve to a module with `.default.prePass` and `.default.postPass`

## Updated `providers/replicate-provider.js`

The `postPass` already uses `sceneHint` as the FLUX prompt. No interface change needed — just verify it still works with the richer hint string produced by `buildSceneHint`.

## Updated `src/index.ts`

Export new types; remove removed types.

```typescript
export { frameArtwork } from './pipeline.js'
export type { AiProvider, FrameOptions, FrameSpec, MatSpec, ScenePreset, WoodEssence, FrameMaterial } from './types.js'
export { CompositorError, ProviderError } from './types.js'
export { SCENE_PRESETS } from './scenes.js'   // so consumers can enumerate presets
```

## Tests

Update `tests/pipeline.test.ts`:
- Replace old `FrameName` options with new `FrameOptions` (width/height/frame/mat/scene/angle)
- Keep 3 fixture artworks; use different materials and scenes per test
- Add test: `angleDeg=0` produces a PNG with exactly the expected canvas dimensions (computed from layout)
- Add test: `angleDeg=20` produces a PNG (smoke test — no dimension assertion since AI may resize)
- Mock provider stays the same (pass-through prePass/postPass)

Remove `tests/templates.test.ts` — templates are gone.

## Error Types

- `CompositorError` — geometry computation failures, sharp decode/encode failures
- `ProviderError` — prePass/postPass failures
- *(removed)* `TemplateNotFoundError`

## Constraints

- `sharp` and `commander` remain the only runtime deps (besides `replicate` already added)
- `src/warp.ts` is not modified — pure math, still correct for any quad
- ESM-only throughout
- Node.js ≥ 20
- Output is always PNG
- `angleDeg` must be in [0, 45]; values outside this range throw `CompositorError`

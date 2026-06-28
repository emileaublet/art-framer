# art-framer

Convert a plain artwork image into a photorealistic framed wall scene — computationally, with no AI in the critical path.

The compositor renders the frame, mat board, glass reflection, and drop shadow using pure pixel math (sharp). Scene backgrounds (empty rooms/walls) are pre-generated via Replicate and stored locally; the artwork is composited on top, pixel-perfect and never deformed.

## Architecture

```
artwork.jpg
    ↓
compositor  ←  frame params (material, thickness)
            ←  mat params (width, color)
            ←  scene background PNG (pre-generated, optional)
    ↓
framed wall image (PNG)
```

## Install

```bash
npm install
```

## Quick Start

```typescript
import { frameArtwork } from './src/pipeline.js'

await frameArtwork('portrait.jpg', {
  artworkWidthIn:  21,   // physical artwork width in inches
  artworkHeightIn: 30,   // physical artwork height in inches
  frame: { material: 'black-paint', thicknessIn: 1.5, depthIn: 0.75 },
  mat:   { widthIn: 2, color: 'white' },
  scene: 'smooth-white-wall',
  angleDeg: 0,
  output: 'framed.png',
})
```

## Frame Materials

| Material | Description |
|---|---|
| `black-paint` | Matte black painted wood, subtle depth shading |
| `white-paint` | White painted wood |
| `oak` | Warm honey oak with procedural wood grain |
| `maple` | Light cream maple with fine grain |
| `walnut` | Rich dark brown walnut |
| `cherry` | Warm reddish-brown cherry |
| `ash` | Cool grey-toned ash |
| `pine` | Light warm pine |

## Scene Presets

### Flat wall (AI adds texture, compositor handles glass + shadow)

| Scene | Description |
|---|---|
| `smooth-white-wall` | Smooth white plaster, soft ambient light |
| `white-brick-wall` | White-painted brick, mortar lines visible |
| `warm-plaster-wall` | Warm off-white aged plaster, side lighting |
| `sage-wall` | Muted sage green matte wall |
| `dark-charcoal-wall` | Deep charcoal accent wall, dramatic lighting |

### Lifestyle rooms (AI generates full scene)

| Scene | Description |
|---|---|
| `modern-living-room` | Scandinavian living room, natural daylight |
| `modern-bedroom` | Calm bedroom, warm ambient light |
| `home-office` | Minimal study, natural daylight |
| `hallway` | Residential hallway, soft ambient light |
| `reading-nook` | Cozy library corner, warm lamp |

## Generating Scene Backgrounds

Scene backgrounds are empty-room images generated once via Replicate and reused for every artwork. They are stored in `assets/scene-backgrounds/` and gitignored (regenerate on each machine):

```bash
REPLICATE_API_TOKEN=<token> node --import tsx/esm scripts/gen-scene-backgrounds.ts
```

The compositor falls back to the scene's flat `bgColor` if no background PNG is found.

## Scene Previews

Generate previews of all scenes using a placeholder artwork:

```bash
node --import tsx/esm scripts/scene-preview.ts
# → tests/output/scene-previews/{scene}.png
```

## FrameOptions

```typescript
interface FrameOptions {
  artworkWidthIn:  number       // physical artwork width (inches)
  artworkHeightIn: number       // physical artwork height (inches)
  frame: {
    material:    FrameMaterial  // see Frame Materials above
    thicknessIn: number         // frame border width in inches
    depthIn:     number         // frame depth (informational, used in AI prompts)
  }
  mat: {
    widthIn: number             // mat border width in inches
    color:   string             // 'white' | 'eggshell' | '#rrggbb'
  }
  scene:    ScenePreset | string  // preset name or custom description
  angleDeg: number                // 0 = flat frontal (only supported value currently)
  output:   string                // output file path
  provider?: AiProvider           // optional AI provider (legacy postPass support)
}
```

## Errors

- `CompositorError` — image transform failed (`.cause` has the original error)
- `ProviderError` — AI provider call failed, only thrown when `provider` is supplied

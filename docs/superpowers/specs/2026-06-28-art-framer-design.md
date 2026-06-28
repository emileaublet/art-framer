# art-framer — Design Spec

**Date:** 2026-06-28

## Overview

A Node.js/TypeScript library (+ CLI) that converts a plain artwork PNG into a photorealistic image of that artwork hanging in a frame on a wall. Takes a PNG in, outputs a PNG out.

## Pipeline Architecture

Three sequential steps. Each step is a pure function. The AI provider is injected as a dependency.

```
artwork PNG
  → [AI pre-pass]   adapt color/texture to ambient scene
  → [Compositor]    warp + mask into frame template
  → [AI post-pass]  add glare, shadows, wall blending
  → output PNG
```

### Step 1 — AI Pre-pass

Adapts the raw artwork to the target scene before compositing: color temperature, ambient light matching, subtle texture overlay. Calls `provider.prePass(artworkBuffer, sceneHint)` where `sceneHint` is a text descriptor from the frame template's `scene.json`.

### Step 2 — Compositor

Pure image math — no AI, fully deterministic. Warps the adapted artwork into the frame template using a perspective transform defined by 4 corner points in `scene.json`, then applies the alpha mask. Powered by `sharp` + `canvas`.

### Step 3 — AI Post-pass

Takes the full composite and enhances realism: glass glare, cast shadows on the wall, edge blending. Calls `provider.postPass(compositeBuffer, sceneHint)`. Returns the final output PNG.

## AI Provider Interface

Users supply their own provider implementation. The library ships no default provider.

```ts
interface AiProvider {
  prePass(artwork: Buffer, sceneHint: string): Promise<Buffer>
  postPass(composite: Buffer, sceneHint: string): Promise<Buffer>
}
```

Provider adapters (e.g. `art-framer-replicate`, `art-framer-openai`) are companion packages, not part of this library. The CLI dynamically imports the adapter specified via `--provider` flag.

## Built-in Frame Templates

Three templates ship with the library, each in its own directory:

| Name | Description |
|---|---|
| `thin-black` | Minimal thin black metal frame, white gallery wall |
| `classic-wood` | Medium oak wood frame, warm gallery lighting |
| `ornate-gold` | Wide ornate gold frame, dark neutral wall |

Each template directory contains:
- `template.png` — high-res photo of the frame with a transparent or solid artwork area
- `mask.png` — alpha mask defining the exact artwork region
- `scene.json` — perspective quad (4 corner points), ambient light color, AI scene hint string

## File Structure

```
src/
  pipeline.ts        # frameArtwork() — orchestrates the 3 steps
  compositor.ts      # perspective warp, mask, layer operations
  provider.ts        # AiProvider interface + ProviderError type
  templates/
    thin-black/
      template.png
      mask.png
      scene.json
    classic-wood/
      template.png
      mask.png
      scene.json
    ornate-gold/
      template.png
      mask.png
      scene.json
  cli.ts             # CLI entry point — thin wrapper over frameArtwork()
```

## Public API

```ts
// Library
frameArtwork(
  artworkPath: string,
  options: {
    frame: 'thin-black' | 'classic-wood' | 'ornate-gold'
    provider: AiProvider
    output: string
  }
): Promise<void>

// Errors
class CompositorError extends Error {}
class ProviderError extends Error {}
class TemplateNotFoundError extends Error {}
```

## CLI

```
art-framer input.png --frame classic-wood --provider replicate --output result.png
```

- `--frame` — built-in template name (required)
- `--provider` — name of a provider adapter package to dynamically import (required)
- `--output` — output file path (default: `<input-basename>-framed.png`)

Provider config (API keys, model IDs) is read from environment variables by the adapter package.

## Error Handling

Each pipeline step wraps failures in a typed error:
- `TemplateNotFoundError` — frame name not recognized or template files missing
- `ProviderError` — AI provider call failed (wraps original error as `.cause`)
- `CompositorError` — image transform failed (corrupt input, invalid perspective points, etc.)

The CLI catches these, prints a human-readable message, and exits with code 1.

## Testing Strategy

- **`compositor.ts`** — unit tested with fixture images; deterministic, no AI provider needed
- **`pipeline.ts`** — tested with a mock `AiProvider` that returns its input unchanged
- **CLI** — integration test: real PNG input + mock provider, asserts output file is written and is a valid PNG
- No tests require a live AI provider API key

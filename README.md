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

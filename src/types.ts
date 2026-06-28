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
  // legacy flat presets (compositor-only)
  | 'white-gallery'
  | 'dark-moody'
  | 'warm-living-room'
  | 'concrete-loft'
  | 'natural-light'
  // 5 flat wall presets (glass + shadow in compositor, AI enhances texture)
  | 'smooth-white-wall'
  | 'white-brick-wall'
  | 'warm-plaster-wall'
  | 'sage-wall'
  | 'dark-charcoal-wall'
  // 5 lifestyle room presets (AI generates full scene via postPass)
  | 'modern-living-room'
  | 'modern-bedroom'
  | 'home-office'
  | 'hallway'
  | 'reading-nook'

export interface FrameOptions {
  artworkWidthIn: number
  artworkHeightIn: number
  frame: FrameSpec
  mat: MatSpec
  scene: ScenePreset | string
  angleDeg: number
  provider?: AiProvider
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

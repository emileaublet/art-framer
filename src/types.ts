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

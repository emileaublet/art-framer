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

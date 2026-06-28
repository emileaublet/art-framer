import type { ScenePreset, FrameOptions, FrameMaterial } from './types.js'

export interface SceneResolved {
  bgColor: string
  description: string
  // When provided, replaces the generic description in the AI postPass prompt.
  // Use for scenes where the AI needs room-level context, not just wall color.
  aiPrompt?: string
}

export const SCENE_PRESETS: Record<ScenePreset, SceneResolved> = {
  // --- flat wall presets (compositor-only, AI enhances texture/lighting) ---
  'white-gallery':    { bgColor: '#f5f5f5', description: 'clean white gallery wall, soft even lighting from above' },
  'dark-moody':       { bgColor: '#1c1c1c', description: 'dark charcoal wall, dramatic raking side light with deep shadows' },
  'warm-living-room': { bgColor: '#e8d5b8', description: 'warm beige wall, natural afternoon window light from the left' },
  'concrete-loft':    { bgColor: '#9a9a8a', description: 'exposed concrete wall, cool industrial overhead lighting' },
  'natural-light':    { bgColor: '#ede8e0', description: 'off-white wall, soft diffused daylight, no harsh shadows' },

  // --- AI lifestyle scene presets (Replicate postPass generates the full scene) ---
  'textured-white-wall': {
    bgColor: '#f0eeeb',
    description: 'smooth white-painted plaster wall with very subtle hand-applied texture',
    aiPrompt:
      'Replace the plain background with a smooth white-painted plaster wall. ' +
      'The surface has very faint hand-applied texture — almost imperceptible, like a freshly painted rental apartment. ' +
      'Soft even ambient light from slightly above. Clean and minimal. ' +
      'The framed artwork casts a soft, realistic drop shadow on the wall.',
  },
  'white-brick-wall': {
    bgColor: '#e9e5e0',
    description: 'white-painted brick wall, brick pattern and mortar lines visible beneath the paint',
    aiPrompt:
      'Replace the plain background with a white-painted brick wall. ' +
      'The brick pattern and mortar lines are clearly visible beneath the paint — like a loft or renovated industrial space. ' +
      'Diffused even lighting, no harsh shadows on the wall itself. ' +
      'The framed artwork casts a soft, realistic drop shadow on the bricks.',
  },
  'modern-living-room': {
    bgColor: '#ddd5c5',
    description: 'modern Scandinavian living room, light warm-white walls, natural light from the side',
    aiPrompt:
      'Transform the setting into a modern Scandinavian living room. ' +
      'Light warm-white walls, natural oak or light wood flooring partially visible at the bottom of frame. ' +
      'A minimal sofa or side table partially visible at one edge. ' +
      'Soft natural daylight from a window to one side — gentle, not harsh. ' +
      'Clean, uncluttered, livable. ' +
      'The framed artwork hangs centered on the wall with a realistic drop shadow.',
  },
  'modern-bedroom': {
    bgColor: '#e0dbd3',
    description: 'calm modern bedroom, soft white walls, warm ambient light',
    aiPrompt:
      'Transform the setting into a calm modern bedroom. ' +
      'Soft white or very light grey walls. A neatly made bed with neutral linen visible in the lower portion of the frame. ' +
      'A simple bedside table or lamp partially visible to one side. ' +
      'Warm, soft ambient evening light — not bright, relaxed. ' +
      'Serene and minimal, no clutter. ' +
      'The framed artwork hangs on the wall above the headboard area with a soft realistic shadow.',
  },
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
  const scene = resolveScene(opts.scene)
  const frame = frameDesc(opts.frame.material, opts.frame.thicknessIn)
  const matColor = opts.mat.color === 'white' ? 'white'
    : opts.mat.color === 'eggshell' ? 'eggshell'
    : opts.mat.color
  const matDepthPart = opts.mat.depthIn ? `, ${opts.mat.depthIn}-inch thick` : ''
  const mat = `${opts.mat.widthIn}-inch ${matColor} mat board${matDepthPart}`
  const angle = opts.angleDeg === 0
    ? 'perfectly flat frontal view'
    : `approximately ${opts.angleDeg}-degree angle showing frame depth`
  const sceneDesc = scene.aiPrompt ?? scene.description
  return `Photorealistic framed artwork. ${frame}. ${mat}. ${sceneDesc} ${angle}. Realistic drop shadow on wall.`
}

import type { ScenePreset, FrameOptions, FrameMaterial } from './types.js'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

export interface SceneResolved {
  bgColor: string
  description: string
  // When provided, replaces the generic description in the AI postPass prompt.
  // Use for scenes where the AI needs room-level context, not just wall color.
  aiPrompt?: string
}

export const SCENE_PRESETS: Record<ScenePreset, SceneResolved> = {
  // --- legacy flat presets (compositor only) ---
  'white-gallery':    { bgColor: '#f5f5f5', description: 'clean white gallery wall, soft even lighting from above' },
  'dark-moody':       { bgColor: '#1c1c1c', description: 'dark charcoal wall, dramatic raking side light with deep shadows' },
  'warm-living-room': { bgColor: '#e8d5b8', description: 'warm beige wall, natural afternoon window light from the left' },
  'concrete-loft':    { bgColor: '#9a9a8a', description: 'exposed concrete wall, cool industrial overhead lighting' },
  'natural-light':    { bgColor: '#ede8e0', description: 'off-white wall, soft diffused daylight, no harsh shadows' },

  // --- 5 flat wall presets ---
  // Compositor handles glass reflection + drop shadow; AI adds realistic texture and lighting.
  'smooth-white-wall': {
    bgColor: '#f2f0ed',
    description: 'smooth white-painted plaster wall, soft even light',
    aiPrompt:
      'The background is a smooth white-painted plaster wall — almost perfectly flat, like a freshly painted room. ' +
      'Very faint surface micro-texture from the paint roller. ' +
      'Soft, even ambient lighting from above. No harsh shadows on the wall itself. ' +
      'The frame casts a gentle, realistic drop shadow on the wall around its perimeter. ' +
      'Glass on the artwork shows a subtle diagonal reflection highlight.',
  },
  'white-brick-wall': {
    bgColor: '#e9e5e0',
    description: 'white-painted brick wall, brick and mortar lines visible under the paint',
    aiPrompt:
      'The background is a white-painted brick wall. ' +
      'The brick pattern and mortar lines are clearly visible beneath the white paint — like a renovated loft or urban apartment. ' +
      'Diffused even overhead lighting. ' +
      'The frame casts a soft, realistic drop shadow on the brick surface. ' +
      'Glass on the artwork shows a subtle diagonal reflection highlight.',
  },
  'warm-plaster-wall': {
    bgColor: '#d9c9b4',
    description: 'warm off-white plaster wall, slight natural texture, side lighting',
    aiPrompt:
      'The background is a warm off-white or pale sand-toned plaster wall. ' +
      'The surface has subtle natural texture — slightly uneven, like aged European plaster. Not perfectly smooth. ' +
      'Warm natural side lighting from the left casts gentle variation across the surface. ' +
      'The frame casts a soft realistic drop shadow on the plaster. ' +
      'Glass on the artwork shows a subtle diagonal reflection highlight.',
  },
  'sage-wall': {
    bgColor: '#b5c2ae',
    description: 'muted sage green painted wall, soft diffused natural light',
    aiPrompt:
      'The background is a smooth matte sage green painted wall — a muted, desaturated grey-green like Farrow & Ball Mizzle or Lichen. ' +
      'Very subtle paint texture. Soft, diffused natural light. ' +
      'The frame casts a gentle drop shadow on the sage surface. ' +
      'Glass on the artwork shows a subtle diagonal reflection highlight.',
  },
  'dark-charcoal-wall': {
    bgColor: '#2a2a2a',
    description: 'deep charcoal or near-black painted wall, dramatic directional light',
    aiPrompt:
      'The background is a deep charcoal, almost black painted wall — rich and matte, like a dramatic accent wall. ' +
      'Directional overhead or side lighting creates subtle depth and warmth on the dark surface. ' +
      'The frame casts a soft shadow that blends into the dark wall. ' +
      'Glass on the artwork shows a visible diagonal reflection highlight — more prominent against the dark background.',
  },

  // --- 5 lifestyle room presets ---
  // AI generates the full room scene around the framed artwork via postPass.
  'modern-living-room': {
    bgColor: '#ddd5c5',
    description: 'modern Scandinavian living room, light warm-white walls, natural daylight',
    aiPrompt:
      'Transform the setting into a modern Scandinavian living room. ' +
      'Light warm-white walls, natural oak wood flooring partially visible at the bottom. ' +
      'A minimal linen sofa or side table partially visible at one edge of frame. ' +
      'Soft natural daylight from a large window to one side. Clean and uncluttered. ' +
      'The framed artwork hangs on the wall with a realistic drop shadow and glass reflection.',
  },
  'modern-bedroom': {
    bgColor: '#e0dbd3',
    description: 'calm modern bedroom, white walls, neutral linen, warm ambient light',
    aiPrompt:
      'Transform the setting into a calm modern bedroom. ' +
      'Soft white or very light grey walls. A neatly made bed with neutral linen duvet visible below the artwork. ' +
      'A simple bedside table or warm lamp partially visible to one side. ' +
      'Warm, soft ambient evening light — relaxed, not bright. Serene and minimal. ' +
      'The framed artwork hangs above the headboard with a realistic drop shadow and glass reflection.',
  },
  'home-office': {
    bgColor: '#ddd8d0',
    description: 'minimal home office, light walls, wooden desk partially visible',
    aiPrompt:
      'Transform the setting into a minimal home office or study. ' +
      'Light painted walls, a simple wooden desk or floating shelf partially visible at the bottom edge. ' +
      'A small plant or stacked books to one side. Soft natural daylight from a window off to the side. ' +
      'Clean, focused, uncluttered. ' +
      'The framed artwork hangs on the wall with a realistic drop shadow and glass reflection.',
  },
  'hallway': {
    bgColor: '#ece8e2',
    description: 'simple residential hallway, white walls, soft ambient light',
    aiPrompt:
      'Transform the setting into a simple residential hallway or entrance. ' +
      'White or very light painted walls. A hint of a door frame or baseboard at one edge. ' +
      'Soft ambient light — calm, no direct sun. ' +
      'The framed artwork is hung at eye level with a realistic drop shadow and subtle glass reflection.',
  },
  'reading-nook': {
    bgColor: '#e8e2d8',
    description: 'cozy reading nook or library corner, warm wood tones, soft lamp light',
    aiPrompt:
      'Transform the setting into a cozy reading nook or library corner. ' +
      'Warm-toned walls — cream, warm white, or very light beige. ' +
      'A hint of a bookshelf or wooden paneling at one side. A warm table lamp casting soft light. ' +
      'Intimate and calm, not dark. ' +
      'The framed artwork hangs on the wall with a warm realistic drop shadow and subtle glass reflection.',
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

// Returns the filesystem path for a pre-generated scene background PNG.
// The file may or may not exist — caller should check with existsSync.
export function backgroundPath(scene: string): string {
  return join(__dirname, '../assets/scene-backgrounds', `${scene}.png`)
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

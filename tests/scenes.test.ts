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

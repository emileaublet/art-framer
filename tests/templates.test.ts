import { describe, it, expect } from 'vitest'
import { loadScene, getTemplatePath } from '../src/templates.js'
import { TemplateNotFoundError } from '../src/types.js'
import { existsSync } from 'node:fs'

describe('loadScene', () => {
  it('loads thin-black scene config', () => {
    const scene = loadScene('thin-black')
    expect(scene.quad).toHaveLength(4)
    expect(scene.quad[0]).toHaveLength(2)
    expect(typeof scene.ambientLight).toBe('string')
    expect(scene.hint.length).toBeGreaterThan(0)
  })

  it('loads classic-wood scene config', () => {
    const scene = loadScene('classic-wood')
    expect(scene.quad).toHaveLength(4)
  })

  it('loads ornate-gold scene config', () => {
    const scene = loadScene('ornate-gold')
    expect(scene.quad).toHaveLength(4)
  })

  it('throws TemplateNotFoundError for unknown frame', () => {
    expect(() => loadScene('nonexistent' as never)).toThrow(TemplateNotFoundError)
  })
})

describe('getTemplatePath', () => {
  it('returns a path that exists', () => {
    const p = getTemplatePath('thin-black')
    expect(existsSync(p)).toBe(true)
  })
})

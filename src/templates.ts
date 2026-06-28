import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { FrameName, SceneConfig } from './types.js'
import { TemplateNotFoundError } from './types.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

const FRAME_NAMES: FrameName[] = ['thin-black', 'classic-wood', 'ornate-gold']

export function getTemplatePath(frame: FrameName): string {
  if (!FRAME_NAMES.includes(frame)) throw new TemplateNotFoundError(frame)
  return join(__dirname, 'templates', frame)
}

export function loadScene(frame: FrameName): SceneConfig {
  const dir = getTemplatePath(frame)
  const scenePath = join(dir, 'scene.json')
  if (!existsSync(scenePath)) throw new TemplateNotFoundError(frame)
  return JSON.parse(readFileSync(scenePath, 'utf8')) as SceneConfig
}

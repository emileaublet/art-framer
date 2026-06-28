import Replicate from 'replicate'
import sharp from 'sharp'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const replicate = new Replicate() // reads REPLICATE_API_TOKEN from env

const CACHE_DIR = join(dirname(fileURLToPath(import.meta.url)), '../.cache/replicate')
mkdirSync(CACHE_DIR, { recursive: true })

function cacheKey(buf, prompt) {
  return createHash('sha256')
    .update(buf)
    .update('\x00')
    .update(prompt)
    .digest('hex')
}

function readCache(key) {
  const path = join(CACHE_DIR, `${key}.png`)
  return existsSync(path) ? readFileSync(path) : null
}

function writeCache(key, data) {
  writeFileSync(join(CACHE_DIR, `${key}.png`), data)
}

/** @type {import('../src/types.js').AiProvider} */
export default {
  async prePass(buf) {
    return buf
  },

  async postPass(buf, sceneHint) {
    // sceneHint already contains the full scene directive from buildSceneHint,
    // including the aiPrompt for lifestyle scenes.
    const prompt =
      'Photorealistic photograph. ' +
      'The framed artwork on the wall — including the artwork image, the frame, and the mat — must remain exactly as shown. Do not alter it in any way. ' +
      sceneHint +
      ' High resolution. Natural photography quality.'

    const key = cacheKey(buf, prompt)
    const cached = readCache(key)
    if (cached) {
      console.log(`  [cache hit] ${key.slice(0, 12)}…`)
      return cached
    }

    console.log(`  [replicate] ${key.slice(0, 12)}…`)
    const b64 = buf.toString('base64')
    const output = await replicate.run('black-forest-labs/flux-kontext-pro', {
      input: {
        prompt,
        input_image: `data:image/png;base64,${b64}`,
        output_format: 'png',
      },
    })

    const url = typeof output === 'string' ? output : output.url()
    const resp = await fetch(url)
    const result = Buffer.from(await resp.arrayBuffer())

    const { width, height } = await sharp(buf).metadata()
    const final = await sharp(result).resize(width, height, { fit: 'fill' }).png().toBuffer()

    writeCache(key, final)
    return final
  },
}

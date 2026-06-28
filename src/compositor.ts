import sharp from 'sharp'
import { join } from 'node:path'
import { warpArtwork } from './warp.js'
import { loadScene, getTemplatePath } from './templates.js'
import type { FrameName } from './types.js'
import { CompositorError } from './types.js'

export async function composite(artworkBuffer: Buffer, frame: FrameName): Promise<Buffer> {
  const scene = loadScene(frame)
  const templateDir = getTemplatePath(frame)

  const templatePath = join(templateDir, 'template.png')
  const maskPath = join(templateDir, 'mask.png')

  let templateMeta: sharp.Metadata
  let artworkMeta: sharp.Metadata
  let artworkRaw: Buffer
  let templateBuf: Buffer

  try {
    templateMeta = await sharp(templatePath).metadata()
    artworkMeta = await sharp(artworkBuffer).metadata()
    artworkRaw = await sharp(artworkBuffer).ensureAlpha().raw().toBuffer()
    templateBuf = await sharp(templatePath).png().toBuffer()
  } catch (err) {
    throw new CompositorError('Failed to load template or artwork assets', { cause: err })
  }

  const frameWidth = templateMeta.width!
  const frameHeight = templateMeta.height!
  const artWidth = artworkMeta.width!
  const artHeight = artworkMeta.height!

  const warpedRaw = warpArtwork(artworkRaw, artWidth, artHeight, scene.quad, frameWidth, frameHeight)

  const warpedBuf = await sharp(warpedRaw, {
    raw: { width: frameWidth, height: frameHeight, channels: 4 },
  }).png().toBuffer()

  // Read mask and apply: use mask to punch artwork into template
  const maskRaw = await sharp(maskPath)
    .grayscale()
    .raw()
    .toBuffer()

  // Build output: for each pixel, blend warped artwork and template using mask
  const templateRaw = await sharp(templateBuf).ensureAlpha().raw().toBuffer()
  const warpedRawFinal = await sharp(warpedBuf).ensureAlpha().raw().toBuffer()

  const outBuf = Buffer.alloc(frameWidth * frameHeight * 4)
  for (let i = 0; i < frameWidth * frameHeight; i++) {
    const m = maskRaw[i] / 255
    for (let c = 0; c < 4; c++) {
      const tw = i * 4 + c
      outBuf[tw] = Math.round(warpedRawFinal[tw] * m + templateRaw[tw] * (1 - m))
    }
  }

  try {
    return await sharp(outBuf, {
      raw: { width: frameWidth, height: frameHeight, channels: 4 },
    }).png().toBuffer()
  } catch (err) {
    throw new CompositorError('Failed to encode composite image', { cause: err })
  }
}

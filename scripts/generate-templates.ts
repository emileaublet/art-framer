import sharp from 'sharp'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const TEMPLATE_DIR = join(__dirname, '../src/templates')

const FRAME_WIDTH = 1200
const FRAME_HEIGHT = 900

interface TemplateSpec {
  name: string
  wallColor: [number, number, number]
  frameColor: [number, number, number]
  artworkColor: [number, number, number]
  quad: [[number,number],[number,number],[number,number],[number,number]]
}

const SPECS: TemplateSpec[] = [
  {
    name: 'thin-black',
    wallColor: [248, 248, 248],
    frameColor: [26, 26, 26],
    artworkColor: [220, 220, 220],
    quad: [[100, 100], [1100, 100], [1100, 800], [100, 800]],
  },
  {
    name: 'classic-wood',
    wallColor: [224, 210, 190],
    frameColor: [123, 94, 58],
    artworkColor: [200, 185, 165],
    quad: [[80, 80], [1120, 80], [1120, 820], [80, 820]],
  },
  {
    name: 'ornate-gold',
    wallColor: [42, 42, 42],
    frameColor: [200, 168, 75],
    artworkColor: [60, 60, 60],
    quad: [[120, 120], [1080, 120], [1080, 780], [120, 780]],
  },
]

async function generateTemplate(spec: TemplateSpec): Promise<void> {
  const dir = join(TEMPLATE_DIR, spec.name)
  const [[x1, y1], [x2, _y2], [_x3, y3]] = spec.quad
  const artX = x1, artY = y1, artW = x2 - x1, artH = y3 - y1

  // template.png: wall background + frame border + artwork placeholder
  const templatePixels = Buffer.alloc(FRAME_WIDTH * FRAME_HEIGHT * 4)
  for (let y = 0; y < FRAME_HEIGHT; y++) {
    for (let x = 0; x < FRAME_WIDTH; x++) {
      const i = (y * FRAME_WIDTH + x) * 4
      const inArtwork = x >= artX && x < artX + artW && y >= artY && y < artY + artH
      const inFrameOuter = x >= artX - 10 && x < artX + artW + 10 && y >= artY - 10 && y < artY + artH + 10
      let color: [number, number, number]
      if (inArtwork) color = spec.artworkColor
      else if (inFrameOuter) color = spec.frameColor
      else color = spec.wallColor
      templatePixels[i] = color[0]
      templatePixels[i + 1] = color[1]
      templatePixels[i + 2] = color[2]
      templatePixels[i + 3] = 255
    }
  }
  await sharp(templatePixels, { raw: { width: FRAME_WIDTH, height: FRAME_HEIGHT, channels: 4 } })
    .png()
    .toFile(join(dir, 'template.png'))

  // mask.png: white in artwork region, black outside (grayscale)
  const maskPixels = Buffer.alloc(FRAME_WIDTH * FRAME_HEIGHT)
  for (let y = 0; y < FRAME_HEIGHT; y++) {
    for (let x = 0; x < FRAME_WIDTH; x++) {
      const inArtwork = x >= artX && x < artX + artW && y >= artY && y < artY + artH
      maskPixels[y * FRAME_WIDTH + x] = inArtwork ? 255 : 0
    }
  }
  await sharp(maskPixels, { raw: { width: FRAME_WIDTH, height: FRAME_HEIGHT, channels: 1 } })
    .toColorspace('b-w')
    .png()
    .toFile(join(dir, 'mask.png'))

  console.log(`Generated ${spec.name}`)
}

for (const spec of SPECS) {
  await generateTemplate(spec)
}
console.log('All templates generated.')

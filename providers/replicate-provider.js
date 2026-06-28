import Replicate from 'replicate'
import sharp from 'sharp'

const replicate = new Replicate() // reads REPLICATE_API_TOKEN from env

// Tune this prompt to change the wall scene
const WALL_PROMPT =
  'photorealistic framed painting hanging on a gallery wall, ' +
  'soft natural lighting from above left, realistic drop shadow cast by frame, ' +
  'subtle wall texture, high resolution, museum quality photograph'

/** @type {import('../src/types.js').AiProvider} */
export default {
  async prePass(buf) {
    return buf
  },

  async postPass(buf) {
    const b64 = buf.toString('base64')

    const output = await replicate.run('black-forest-labs/flux-kontext-pro', {
      input: {
        prompt: WALL_PROMPT,
        input_image: `data:image/png;base64,${b64}`,
        output_format: 'png',
      },
    })

    const url = typeof output === 'string' ? output : output.url()
    const resp = await fetch(url)
    const result = Buffer.from(await resp.arrayBuffer())

    // Ensure output matches the template dimensions (1200×900)
    const { width, height } = await sharp(buf).metadata()
    return sharp(result).resize(width, height, { fit: 'fill' }).png().toBuffer()
  },
}

import Replicate from 'replicate'
import sharp from 'sharp'

const replicate = new Replicate() // reads REPLICATE_API_TOKEN from env

/** @type {import('../src/types.js').AiProvider} */
export default {
  async prePass(buf) {
    return buf
  },

  async postPass(buf, sceneHint) {
    const b64 = buf.toString('base64')

    // Use sceneHint as the creative direction, wrapped in explicit instructions
    // to preserve the framed artwork and add environmental context
    const prompt = [
      'Photorealistic interior photograph.',
      'The framed artwork on the wall — including the artwork image, frame, and mat — must remain exactly as shown.',
      sceneHint,
      'Add minimal room context: perhaps the edge of a simple piece of furniture,',
      'a small plant casting a soft shadow on the wall, or a clean architectural detail.',
      'The scene should feel like a real home — calm, simple, not over-styled.',
      'Natural lighting, soft shadows, high resolution.',
    ].join(' ')

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
    return sharp(result).resize(width, height, { fit: 'fill' }).png().toBuffer()
  },
}

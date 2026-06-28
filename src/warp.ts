import type { Quad } from './types.js'

type Point = [number, number]
type H8 = [number, number, number, number, number, number, number, number]

function gaussianElimination(A: number[][], b: number[]): number[] {
  const n = b.length
  const M = A.map((row, i) => [...row, b[i]])

  for (let col = 0; col < n; col++) {
    let maxRow = col
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(M[row][col]) > Math.abs(M[maxRow][col])) maxRow = row
    }
    ;[M[col], M[maxRow]] = [M[maxRow], M[col]]
    for (let row = col + 1; row < n; row++) {
      const factor = M[row][col] / M[col][col]
      for (let k = col; k <= n; k++) M[row][k] -= factor * M[col][k]
    }
  }

  const x = new Array(n).fill(0)
  for (let i = n - 1; i >= 0; i--) {
    x[i] = M[i][n]
    for (let j = i + 1; j < n; j++) x[i] -= M[i][j] * x[j]
    x[i] /= M[i][i]
  }
  return x
}

// Returns H (8 coefficients, h8=1) mapping srcQuad[i] -> dstQuad[i]
function computeHomography(srcQuad: Quad, dstQuad: Quad): H8 {
  const A: number[][] = []
  const b: number[] = []
  for (let i = 0; i < 4; i++) {
    const [x, y] = srcQuad[i]
    const [X, Y] = dstQuad[i]
    A.push([x, y, 1, 0, 0, 0, -X * x, -X * y])
    b.push(X)
    A.push([0, 0, 0, x, y, 1, -Y * x, -Y * y])
    b.push(Y)
  }
  return gaussianElimination(A, b) as H8
}

function applyHomography(h: H8, px: number, py: number): Point {
  const denom = h[6] * px + h[7] * py + 1
  return [
    (h[0] * px + h[1] * py + h[2]) / denom,
    (h[3] * px + h[4] * py + h[5]) / denom,
  ]
}

function bilinear(src: Buffer, w: number, h: number, x: number, y: number): [number, number, number, number] {
  const x0 = Math.max(0, Math.floor(x))
  const y0 = Math.max(0, Math.floor(y))
  const x1 = Math.min(x0 + 1, w - 1)
  const y1 = Math.min(y0 + 1, h - 1)
  const xf = x - x0
  const yf = y - y0
  const idx = (row: number, col: number) => (row * w + col) * 4
  const result: [number, number, number, number] = [0, 0, 0, 0]
  for (let c = 0; c < 4; c++) {
    result[c] = Math.round(
      src[idx(y0, x0) + c] * (1 - xf) * (1 - yf) +
      src[idx(y0, x1) + c] * xf * (1 - yf) +
      src[idx(y1, x0) + c] * (1 - xf) * yf +
      src[idx(y1, x1) + c] * xf * yf,
    )
  }
  return result
}

export function warpArtwork(
  artworkBuffer: Buffer,
  artWidth: number,
  artHeight: number,
  targetQuad: Quad,
  frameWidth: number,
  frameHeight: number,
): Buffer {
  // artwork corners: TL, TR, BR, BL
  const artQuad: Quad = [[0, 0], [artWidth, 0], [artWidth, artHeight], [0, artHeight]]
  // inverse homography: frame pixel -> artwork pixel
  const h = computeHomography(targetQuad, artQuad)

  const out = Buffer.alloc(frameWidth * frameHeight * 4, 0)

  for (let fy = 0; fy < frameHeight; fy++) {
    for (let fx = 0; fx < frameWidth; fx++) {
      const [ax, ay] = applyHomography(h, fx, fy)
      if (ax < 0 || ay < 0 || ax >= artWidth || ay >= artHeight) continue
      const [r, g, b, a] = bilinear(artworkBuffer, artWidth, artHeight, ax, ay)
      const o = (fy * frameWidth + fx) * 4
      out[o] = r; out[o + 1] = g; out[o + 2] = b; out[o + 3] = a
    }
  }

  return out
}

// src/types.ts
var CompositorError = class extends Error {
  constructor(message, options) {
    super(message, options);
    this.name = "CompositorError";
  }
};
var ProviderError = class extends Error {
  constructor(message, options) {
    super(message, options);
    this.name = "ProviderError";
  }
};
var TemplateNotFoundError = class extends Error {
  constructor(frame) {
    super(`Frame template not found: "${frame}"`);
    this.name = "TemplateNotFoundError";
  }
};

// src/pipeline.ts
import { readFileSync as readFileSync2, writeFileSync } from "fs";

// src/compositor.ts
import sharp from "sharp";
import { join as join2 } from "path";

// src/warp.ts
function gaussianElimination(A, b) {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(M[row][col]) > Math.abs(M[maxRow][col])) maxRow = row;
    }
    ;
    [M[col], M[maxRow]] = [M[maxRow], M[col]];
    for (let row = col + 1; row < n; row++) {
      const factor = M[row][col] / M[col][col];
      for (let k = col; k <= n; k++) M[row][k] -= factor * M[col][k];
    }
  }
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    x[i] = M[i][n];
    for (let j = i + 1; j < n; j++) x[i] -= M[i][j] * x[j];
    x[i] /= M[i][i];
  }
  return x;
}
function computeHomography(srcQuad, dstQuad) {
  const A = [];
  const b = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = srcQuad[i];
    const [X, Y] = dstQuad[i];
    A.push([x, y, 1, 0, 0, 0, -X * x, -X * y]);
    b.push(X);
    A.push([0, 0, 0, x, y, 1, -Y * x, -Y * y]);
    b.push(Y);
  }
  return gaussianElimination(A, b);
}
function applyHomography(h, px, py) {
  const denom = h[6] * px + h[7] * py + 1;
  return [
    (h[0] * px + h[1] * py + h[2]) / denom,
    (h[3] * px + h[4] * py + h[5]) / denom
  ];
}
function bilinear(src, w, h, x, y) {
  const x0 = Math.max(0, Math.floor(x));
  const y0 = Math.max(0, Math.floor(y));
  const x1 = Math.min(x0 + 1, w - 1);
  const y1 = Math.min(y0 + 1, h - 1);
  const xf = x - x0;
  const yf = y - y0;
  const idx = (row, col) => (row * w + col) * 4;
  const result = [0, 0, 0, 0];
  for (let c = 0; c < 4; c++) {
    result[c] = Math.round(
      src[idx(y0, x0) + c] * (1 - xf) * (1 - yf) + src[idx(y0, x1) + c] * xf * (1 - yf) + src[idx(y1, x0) + c] * (1 - xf) * yf + src[idx(y1, x1) + c] * xf * yf
    );
  }
  return result;
}
function warpArtwork(artworkBuffer, artWidth, artHeight, targetQuad, frameWidth, frameHeight) {
  const artQuad = [[0, 0], [artWidth, 0], [artWidth, artHeight], [0, artHeight]];
  const h = computeHomography(targetQuad, artQuad);
  const out = Buffer.alloc(frameWidth * frameHeight * 4, 0);
  for (let fy = 0; fy < frameHeight; fy++) {
    for (let fx = 0; fx < frameWidth; fx++) {
      const [ax, ay] = applyHomography(h, fx, fy);
      if (ax < 0 || ay < 0 || ax >= artWidth || ay >= artHeight) continue;
      const [r, g, b, a] = bilinear(artworkBuffer, artWidth, artHeight, ax, ay);
      const o = (fy * frameWidth + fx) * 4;
      out[o] = r;
      out[o + 1] = g;
      out[o + 2] = b;
      out[o + 3] = a;
    }
  }
  return out;
}

// src/templates.ts
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
var __dirname = dirname(fileURLToPath(import.meta.url));
var FRAME_NAMES = ["thin-black", "classic-wood", "ornate-gold"];
function getTemplatePath(frame) {
  if (!FRAME_NAMES.includes(frame)) throw new TemplateNotFoundError(frame);
  return join(__dirname, "templates", frame);
}
function loadScene(frame) {
  const dir = getTemplatePath(frame);
  const scenePath = join(dir, "scene.json");
  if (!existsSync(scenePath)) throw new TemplateNotFoundError(frame);
  return JSON.parse(readFileSync(scenePath, "utf8"));
}

// src/compositor.ts
async function composite(artworkBuffer, frame) {
  const scene = loadScene(frame);
  const templateDir = getTemplatePath(frame);
  const templatePath = join2(templateDir, "template.png");
  const maskPath = join2(templateDir, "mask.png");
  let templateMeta;
  let artworkMeta;
  let artworkRaw;
  let templateBuf;
  try {
    templateMeta = await sharp(templatePath).metadata();
    artworkMeta = await sharp(artworkBuffer).metadata();
    artworkRaw = await sharp(artworkBuffer).ensureAlpha().raw().toBuffer();
    templateBuf = await sharp(templatePath).png().toBuffer();
  } catch (err) {
    throw new CompositorError("Failed to load template or artwork assets", { cause: err });
  }
  const frameWidth = templateMeta.width;
  const frameHeight = templateMeta.height;
  const artWidth = artworkMeta.width;
  const artHeight = artworkMeta.height;
  const warpedRaw = warpArtwork(artworkRaw, artWidth, artHeight, scene.quad, frameWidth, frameHeight);
  const warpedBuf = await sharp(warpedRaw, {
    raw: { width: frameWidth, height: frameHeight, channels: 4 }
  }).png().toBuffer();
  const maskRaw = await sharp(maskPath).grayscale().raw().toBuffer();
  const templateRaw = await sharp(templateBuf).ensureAlpha().raw().toBuffer();
  const warpedRawFinal = await sharp(warpedBuf).ensureAlpha().raw().toBuffer();
  const outBuf = Buffer.alloc(frameWidth * frameHeight * 4);
  for (let i = 0; i < frameWidth * frameHeight; i++) {
    const m = maskRaw[i] / 255;
    for (let c = 0; c < 4; c++) {
      const tw = i * 4 + c;
      outBuf[tw] = Math.round(warpedRawFinal[tw] * m + templateRaw[tw] * (1 - m));
    }
  }
  try {
    return await sharp(outBuf, {
      raw: { width: frameWidth, height: frameHeight, channels: 4 }
    }).png().toBuffer();
  } catch (err) {
    throw new CompositorError("Failed to encode composite image", { cause: err });
  }
}

// src/pipeline.ts
async function frameArtwork(artworkPath, options) {
  const { frame, provider, output } = options;
  const scene = loadScene(frame);
  let artwork = readFileSync2(artworkPath);
  try {
    artwork = await provider.prePass(artwork, scene.hint);
  } catch (err) {
    throw new ProviderError("AI pre-pass failed", { cause: err });
  }
  const composited = await composite(artwork, frame);
  let final;
  try {
    final = await provider.postPass(composited, scene.hint);
  } catch (err) {
    throw new ProviderError("AI post-pass failed", { cause: err });
  }
  writeFileSync(output, final);
}

export {
  CompositorError,
  ProviderError,
  TemplateNotFoundError,
  frameArtwork
};

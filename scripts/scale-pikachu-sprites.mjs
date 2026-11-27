#!/usr/bin/env node
/**
 * Nearest-neighbor sprite & sprite-sheet scaling CLI for the Pikachu game module.
 *
 * Usage:
 *   node scripts/scale-pikachu-sprites.mjs --verify
 *   node scripts/scale-pikachu-sprites.mjs --scale=4
 *   node scripts/scale-pikachu-sprites.mjs --sheet=path/to/sheet.png --cols=6 --rows=6 --scale=2
 */

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const ASSETS_DIR = path.resolve(process.cwd(), 'public/assets/pikachu');
const MANIFEST_PATH = path.join(ASSETS_DIR, 'manifest.json');

function readPng(filePath) {
  const buf = fs.readFileSync(filePath);
  const pngSig = '89504e470d0a1a0a';
  if (buf.subarray(0, 8).toString('hex') !== pngSig) {
    throw new Error(`Not a valid PNG file: ${filePath}`);
  }

  let pos = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idatChunks = [];

  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.subarray(pos + 4, pos + 8).toString('ascii');
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
    } else if (type === 'IDAT') {
      idatChunks.push(data);
    } else if (type === 'IEND') {
      break;
    }
    pos += 12 + len;
  }

  if (bitDepth !== 8 || (colorType !== 6 && colorType !== 2)) {
    throw new Error(
      `Unsupported PNG format in ${filePath}: bitDepth=${bitDepth}, colorType=${colorType}`
    );
  }

  const raw = zlib.inflateSync(Buffer.concat(idatChunks));
  const bpp = colorType === 6 ? 4 : 3;
  const stride = width * bpp + 1;
  const data = new Uint8ClampedArray(width * height * 4);
  const prev = Buffer.alloc(width * bpp);
  const curr = Buffer.alloc(width * bpp);

  const paeth = (a, b, c) => {
    const p = a + b - c;
    const pa = Math.abs(p - a);
    const pb = Math.abs(p - b);
    const pc = Math.abs(p - c);
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
  };

  for (let y = 0; y < height; y++) {
    const filter = raw[y * stride];
    for (let i = 0; i < width * bpp; i++) {
      const x = raw[y * stride + 1 + i];
      const a = i >= bpp ? curr[i - bpp] : 0;
      const b = prev[i];
      const c = i >= bpp ? prev[i - bpp] : 0;
      if (filter === 0) curr[i] = x;
      else if (filter === 1) curr[i] = (x + a) & 0xff;
      else if (filter === 2) curr[i] = (x + b) & 0xff;
      else if (filter === 3) curr[i] = (x + ((a + b) >> 1)) & 0xff;
      else if (filter === 4) curr[i] = (x + paeth(a, b, c)) & 0xff;
      else throw new Error(`Unsupported PNG scanline filter ${filter}`);
    }
    curr.copy(prev);

    for (let x = 0; x < width; x++) {
      const dst = (y * width + x) * 4;
      const src = x * bpp;
      data[dst] = curr[src];
      data[dst + 1] = curr[src + 1];
      data[dst + 2] = curr[src + 2];
      data[dst + 3] = bpp === 4 ? curr[src + 3] : 255;
    }
  }

  return { width, height, data };
}

function writePng(filePath, width, height, data) {
  function crc32(b) {
    let c = 0xffffffff;
    for (let i = 0; i < b.length; i++) {
      c ^= b[i];
      for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
    }
    return (c ^ 0xffffffff) >>> 0;
  }
  function chunk(type, payload) {
    const out = Buffer.alloc(12 + payload.length);
    out.writeUInt32BE(payload.length, 0);
    out.write(type, 4, 4, 'ascii');
    payload.copy(out, 8);
    out.writeUInt32BE(crc32(out.subarray(4, 8 + payload.length)), 8 + payload.length);
    return out;
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // 8-bit
  ihdr[9] = 6; // RGBA

  const raw = Buffer.alloc(height * (width * 4 + 1));
  const pixelBuf = Buffer.from(data.buffer, data.byteOffset, data.byteLength);
  for (let y = 0; y < height; y++) {
    const rowStart = y * (width * 4 + 1);
    raw[rowStart] = 0;
    pixelBuf.copy(raw, rowStart + 1, y * width * 4, (y + 1) * width * 4);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });

  fs.writeFileSync(
    filePath,
    Buffer.concat([
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      chunk('IHDR', ihdr),
      chunk('IDAT', idat),
      chunk('IEND', Buffer.alloc(0)),
    ])
  );
}

function scaleRgbaNearestNeighbor(source, scaleFactor) {
  if (!Number.isInteger(scaleFactor) || scaleFactor < 1 || scaleFactor > 16) {
    throw new Error(`Invalid scale factor: ${scaleFactor}`);
  }
  if (scaleFactor === 1) return source;
  const outWidth = source.width * scaleFactor;
  const outHeight = source.height * scaleFactor;
  const outData = new Uint8ClampedArray(outWidth * outHeight * 4);

  for (let sy = 0; sy < source.height; sy++) {
    for (let sx = 0; sx < source.width; sx++) {
      const sp = (sy * source.width + sx) * 4;
      const r = source.data[sp];
      const g = source.data[sp + 1];
      const b = source.data[sp + 2];
      const a = source.data[sp + 3];
      for (let dy = 0; dy < scaleFactor; dy++) {
        const rowOffset = (sy * scaleFactor + dy) * outWidth;
        for (let dx = 0; dx < scaleFactor; dx++) {
          const dp = (rowOffset + sx * scaleFactor + dx) * 4;
          outData[dp] = r;
          outData[dp + 1] = g;
          outData[dp + 2] = b;
          outData[dp + 3] = a;
        }
      }
    }
  }
  return { width: outWidth, height: outHeight, data: outData };
}

function detectUniformBlockSize(image) {
  for (const k of [8, 6, 4, 3, 2]) {
    if (image.width % k !== 0 || image.height % k !== 0) continue;
    let uniform = true;
    for (let by = 0; by < image.height && uniform; by += k) {
      for (let bx = 0; bx < image.width && uniform; bx += k) {
        const base = (by * image.width + bx) * 4;
        const r = image.data[base], g = image.data[base + 1], b = image.data[base + 2], a = image.data[base + 3];
        for (let dy = 0; dy < k && uniform; dy++) {
          for (let dx = 0; dx < k; dx++) {
            const p = ((by + dy) * image.width + (bx + dx)) * 4;
            if (image.data[p] !== r || image.data[p + 1] !== g || image.data[p + 2] !== b || image.data[p + 3] !== a) {
              uniform = false;
              break;
            }
          }
        }
      }
    }
    if (uniform) return k;
  }
  return 1;
}

function downsampleExactBlock(image, blockSize) {
  if (blockSize === 1) return image;
  const w = image.width / blockSize;
  const h = image.height / blockSize;
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const sp = ((y * blockSize) * image.width + (x * blockSize)) * 4;
      const dp = (y * w + x) * 4;
      data[dp] = image.data[sp];
      data[dp + 1] = image.data[sp + 1];
      data[dp + 2] = image.data[sp + 2];
      data[dp + 3] = image.data[sp + 3];
    }
  }
  return { width: w, height: h, data };
}

function parseArgs(argv) {
  const opts = { verify: false, scale: null, sheet: null, cols: 0, rows: 0, outDir: ASSETS_DIR };
  for (const arg of argv) {
    if (arg === '--verify') opts.verify = true;
    else if (arg.startsWith('--scale=')) opts.scale = Number(arg.split('=')[1]);
    else if (arg.startsWith('--sheet=')) opts.sheet = arg.split('=')[1];
    else if (arg.startsWith('--cols=')) opts.cols = Number(arg.split('=')[1]);
    else if (arg.startsWith('--rows=')) opts.rows = Number(arg.split('=')[1]);
    else if (arg.startsWith('--out=')) opts.outDir = path.resolve(process.cwd(), arg.split('=')[1]);
  }
  return opts;
}

const opts = parseArgs(process.argv.slice(2));
const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));

if (opts.sheet) {
  const sheetPath = path.resolve(process.cwd(), opts.sheet);
  const scaleFactor = opts.scale ?? 2;
  if (!opts.cols || !opts.rows) {
    throw new Error('When using --sheet, please provide --cols=<N> and --rows=<M>.');
  }
  const sheet = readPng(sheetPath);
  const srcTileW = Math.floor(sheet.width / opts.cols);
  const srcTileH = Math.floor(sheet.height / opts.rows);
  let count = 0;
  for (let r = 0; r < opts.rows; r++) {
    for (let c = 0; c < opts.cols; c++) {
      if (count >= manifest.sprites.length) break;
      const entry = manifest.sprites[count];
      const tileData = new Uint8ClampedArray(srcTileW * srcTileH * 4);
      for (let ty = 0; ty < srcTileH; ty++) {
        const srcStart = ((r * srcTileH + ty) * sheet.width + c * srcTileW) * 4;
        tileData.set(sheet.data.subarray(srcStart, srcStart + srcTileW * 4), ty * srcTileW * 4);
      }
      const scaled = scaleRgbaNearestNeighbor(
        { width: srcTileW, height: srcTileH, data: tileData },
        scaleFactor
      );
      const targetFile = path.join(opts.outDir, path.basename(entry.src));
      writePng(targetFile, scaled.width, scaled.height, scaled.data);
      count++;
    }
  }
  console.log(`Scaled ${count} sprite-sheet tiles by ${scaleFactor}x using nearest-neighbor.`);
  process.exit(0);
}

let detectedBaseRes = null;
let detectedScale = null;
let transparentCount = 0;

for (const entry of manifest.sprites) {
  const filePath = path.resolve(process.cwd(), 'public' + entry.src);
  const img = readPng(filePath);
  const block = detectUniformBlockSize(img);
  const base = downsampleExactBlock(img, block);
  const hasTransparency = img.data.some((_, idx) => idx % 4 === 3 && img.data[idx] === 0);
  if (hasTransparency) transparentCount++;

  if (opts.scale !== null) {
    const scaled = scaleRgbaNearestNeighbor(base, opts.scale);
    writePng(filePath, scaled.width, scaled.height, scaled.data);
    detectedBaseRes = base.width;
    detectedScale = opts.scale;
  } else {
    detectedBaseRes = base.width;
    detectedScale = block;
  }
}

if (opts.scale !== null && detectedBaseRes !== null) {
  manifest.baseResolution = detectedBaseRes;
  manifest.scaleFactor = detectedScale;
  manifest.tileResolution = detectedBaseRes * detectedScale;
  manifest.scalingAlgorithm = 'nearest-neighbor';
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n');
}

console.log(
  `Verified ${manifest.sprites.length} sprites in public/assets/pikachu/: ` +
    `base=${detectedBaseRes}x${detectedBaseRes}, scale=${detectedScale}x nearest-neighbor -> ` +
    `${detectedBaseRes * detectedScale}x${detectedBaseRes * detectedScale} RGBA (${transparentCount}/${manifest.sprites.length} transparent).`
);

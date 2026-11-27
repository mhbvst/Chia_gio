/**
 * Nearest-neighbor sprite and sprite-sheet scaling utilities.
 * Preserves exact pixel-art edges, flat colors, and RGBA alpha transparency
 * without introducing bilinear blur or anti-aliasing artifacts.
 */

export interface RgbaImageBuffer {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

function assertIntegerScale(scaleFactor: number): void {
  if (!Number.isInteger(scaleFactor) || scaleFactor < 1 || scaleFactor > 16) {
    throw new Error(`Invalid integer scaleFactor: ${scaleFactor}. Expected integer between 1 and 16.`);
  }
}

/**
 * Upscales an RGBA image buffer by an exact integer factor using nearest-neighbor interpolation.
 * Each source pixel (r, g, b, a) is replicated into an exact scaleFactor x scaleFactor block.
 */
export function scaleRgbaNearestNeighbor(
  source: RgbaImageBuffer,
  scaleFactor: number
): RgbaImageBuffer {
  assertIntegerScale(scaleFactor);
  if (scaleFactor === 1) {
    return {
      width: source.width,
      height: source.height,
      data: new Uint8ClampedArray(source.data),
    };
  }

  const outWidth = source.width * scaleFactor;
  const outHeight = source.height * scaleFactor;
  const outData = new Uint8ClampedArray(outWidth * outHeight * 4);

  for (let sy = 0; sy < source.height; sy++) {
    for (let sx = 0; sx < source.width; sx++) {
      const srcIdx = (sy * source.width + sx) * 4;
      const r = source.data[srcIdx];
      const g = source.data[srcIdx + 1];
      const b = source.data[srcIdx + 2];
      const a = source.data[srcIdx + 3];

      const baseOutY = sy * scaleFactor;
      const baseOutX = sx * scaleFactor;

      for (let dy = 0; dy < scaleFactor; dy++) {
        const rowOffset = (baseOutY + dy) * outWidth;
        for (let dx = 0; dx < scaleFactor; dx++) {
          const dstIdx = (rowOffset + baseOutX + dx) * 4;
          outData[dstIdx] = r;
          outData[dstIdx + 1] = g;
          outData[dstIdx + 2] = b;
          outData[dstIdx + 3] = a;
        }
      }
    }
  }

  return {
    width: outWidth,
    height: outHeight,
    data: outData,
  };
}

/**
 * Slices an RGBA sprite sheet into uniform grid tiles and scales each sprite tile
 * independently using nearest-neighbor interpolation so adjacent sprites never bleed.
 */
export function scaleSpriteSheetGridNearestNeighbor(
  sheet: RgbaImageBuffer,
  cols: number,
  rows: number,
  scaleFactor: number
): {
  scaledSheet: RgbaImageBuffer;
  tiles: RgbaImageBuffer[];
  tileWidth: number;
  tileHeight: number;
} {
  assertIntegerScale(scaleFactor);
  if (cols < 1 || rows < 1 || sheet.width % cols !== 0 || sheet.height % rows !== 0) {
    throw new Error(
      `Sprite sheet (${sheet.width}x${sheet.height}) is not evenly divisible by ${cols}x${rows}.`
    );
  }

  const srcTileW = sheet.width / cols;
  const srcTileH = sheet.height / rows;
  const dstTileW = srcTileW * scaleFactor;
  const dstTileH = srcTileH * scaleFactor;

  const tiles: RgbaImageBuffer[] = [];
  const scaledSheetData = new Uint8ClampedArray(sheet.width * scaleFactor * sheet.height * scaleFactor * 4);
  const scaledSheetW = sheet.width * scaleFactor;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const tileSrc = new Uint8ClampedArray(srcTileW * srcTileH * 4);
      const startX = c * srcTileW;
      const startY = r * srcTileH;

      for (let ty = 0; ty < srcTileH; ty++) {
        const sheetRowStart = ((startY + ty) * sheet.width + startX) * 4;
        const tileRowStart = ty * srcTileW * 4;
        tileSrc.set(sheet.data.subarray(sheetRowStart, sheetRowStart + srcTileW * 4), tileRowStart);
      }

      const scaledTile = scaleRgbaNearestNeighbor(
        { width: srcTileW, height: srcTileH, data: tileSrc },
        scaleFactor
      );
      tiles.push(scaledTile);

      const dstStartX = c * dstTileW;
      const dstStartY = r * dstTileH;
      for (let ty = 0; ty < dstTileH; ty++) {
        const srcRowStart = ty * dstTileW * 4;
        const dstRowStart = ((dstStartY + ty) * scaledSheetW + dstStartX) * 4;
        scaledSheetData.set(
          scaledTile.data.subarray(srcRowStart, srcRowStart + dstTileW * 4),
          dstRowStart
        );
      }
    }
  }

  return {
    scaledSheet: {
      width: scaledSheetW,
      height: sheet.height * scaleFactor,
      data: scaledSheetData,
    },
    tiles,
    tileWidth: dstTileW,
    tileHeight: dstTileH,
  };
}

/**
 * Detects the largest uniform integer block size (e.g. 4 for a 192x192 sprite scaled 4x from 48x48).
 */
export function detectUniformPixelBlockSize(image: RgbaImageBuffer): number {
  const candidates = [8, 6, 4, 3, 2];
  for (const k of candidates) {
    if (image.width % k !== 0 || image.height % k !== 0) continue;
    let uniform = true;
    for (let by = 0; by < image.height && uniform; by += k) {
      for (let bx = 0; bx < image.width && uniform; bx += k) {
        const base = (by * image.width + bx) * 4;
        const r = image.data[base];
        const g = image.data[base + 1];
        const b = image.data[base + 2];
        const a = image.data[base + 3];
        for (let dy = 0; dy < k && uniform; dy++) {
          for (let dx = 0; dx < k; dx++) {
            const p = ((by + dy) * image.width + (bx + dx)) * 4;
            if (
              image.data[p] !== r ||
              image.data[p + 1] !== g ||
              image.data[p + 2] !== b ||
              image.data[p + 3] !== a
            ) {
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

/**
 * Browser helper: upscales an HTMLImageElement via nearest-neighbor canvas rendering
 * (`imageSmoothingEnabled = false`) and returns a transparent PNG data URL.
 */
export function scaleImageElementNearestNeighbor(
  image: HTMLImageElement,
  scaleFactor: number
): string {
  assertIntegerScale(scaleFactor);
  const srcW = image.naturalWidth || image.width;
  const srcH = image.naturalHeight || image.height;
  const canvas = document.createElement('canvas');
  canvas.width = srcW * scaleFactor;
  canvas.height = srcH * scaleFactor;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Could not acquire 2D canvas context for sprite scaling.');
  }
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/png');
}

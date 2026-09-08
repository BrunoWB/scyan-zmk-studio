import { BwpxGrid } from './BwpxGrid';

export interface ImageConversionOptions {
  threshold: number; // 0 - 255
  invert?: boolean;
  targetWidth?: number;
  targetHeight?: number;
}

/**
 * Converts ImageData to a BwpxGrid using perceptual luminance thresholding.
 */
export function convertImageDataToGrid(
  imageData: ImageData,
  options: ImageConversionOptions
): BwpxGrid {
  const { threshold, invert = false } = options;
  const width = imageData.width;
  const height = imageData.height;
  const data = imageData.data;
  const grid = new BwpxGrid(width, height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const a = data[idx + 3];

      // If pixel is transparent, it's considered off (0) unless inverted
      if (a < 64) {
        if (invert) {
          grid.set(x, y, 1);
        }
        continue;
      }

      // Perceptual luminance calculation (ITU-R BT.601)
      const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
      let isLit = luminance >= threshold;

      if (invert) {
        isLit = !isLit;
      }

      if (isLit) {
        grid.set(x, y, 1);
      }
    }
  }

  return grid;
}

/**
 * Helper to draw an HTMLImageElement to an offscreen canvas with optional target sizing
 * and convert to BwpxGrid.
 */
export function convertImageElementToGrid(
  img: HTMLImageElement,
  options: ImageConversionOptions
): { grid: BwpxGrid; width: number; height: number; originalWidth: number; originalHeight: number } {
  const originalWidth = img.naturalWidth || img.width;
  const originalHeight = img.naturalHeight || img.height;

  let width = options.targetWidth || originalWidth;
  let height = options.targetHeight || originalHeight;

  // Ensure positive integer dimensions
  width = Math.max(1, Math.round(width));
  height = Math.max(1, Math.round(height));

  const offscreen = document.createElement('canvas');
  offscreen.width = width;
  offscreen.height = height;

  const ctx = offscreen.getContext('2d');
  if (!ctx) {
    return {
      grid: new BwpxGrid(width, height),
      width,
      height,
      originalWidth,
      originalHeight,
    };
  }

  // Draw image to offscreen canvas (handles scaling)
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, 0, 0, width, height);

  const imgData = ctx.getImageData(0, 0, width, height);
  const grid = convertImageDataToGrid(imgData, options);

  return {
    grid,
    width,
    height,
    originalWidth,
    originalHeight,
  };
}


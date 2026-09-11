import type { SpriteSlice } from '../../types/zmk';
import { BwpxGrid } from './BwpxGrid';

export interface FramePlacement {
  index: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CanvasPackingResult {
  frames: FramePlacement[];
  bounds: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
}

/**
 * Checks whether a candidate rectangle intersects any existing sprite slice.
 */
function collidesWithSlices(
  x: number,
  y: number,
  w: number,
  h: number,
  slices: SpriteSlice[]
): boolean {
  for (const s of slices) {
    if (
      s.x < x + w &&
      s.x + s.width > x &&
      s.y < y + h &&
      s.y + s.height > y
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Checks whether a candidate rectangle contains any active pixels in the grid.
 */
function collidesWithPixels(
  x: number,
  y: number,
  w: number,
  h: number,
  activePixels: [number, number][]
): boolean {
  for (let i = 0; i < activePixels.length; i++) {
    const px = activePixels[i][0];
    const py = activePixels[i][1];
    if (px >= x && px < x + w && py >= y && py < y + h) {
      return true;
    }
  }
  return false;
}

/**
 * Finds an available collision-free spot on the canvas to place a multi-frame animation.
 * Frames are arranged in a horizontal row if space permits, or wrapped into rows fitting within canvasWidth.
 * If no gap exists within the existing content area, it places the frames cleanly below the lowest element.
 */
export function findAvailableSpot(
  grid: BwpxGrid,
  slices: SpriteSlice[],
  frameWidth: number,
  frameHeight: number,
  frameCount: number,
  canvasWidth = 128,
  canvasHeight = 34
): CanvasPackingResult {
  if (frameCount <= 0 || frameWidth <= 0 || frameHeight <= 0) {
    return {
      frames: [],
      bounds: { x: 0, y: 0, w: 0, h: 0 },
    };
  }

  // Determine grid layout of frames (cols x rows)
  const maxCols = Math.max(1, Math.floor(canvasWidth / frameWidth));
  const cols = frameCount <= maxCols ? frameCount : maxCols;
  const rows = Math.ceil(frameCount / cols);

  const totalW = Math.min(frameCount, cols) * frameWidth;
  const totalH = rows * frameHeight;

  const activePixels = grid.getAllPixels();

  // Find maximum extent of existing content
  let maxYExtent = Math.max(canvasHeight, grid.height);
  for (const s of slices) {
    maxYExtent = Math.max(maxYExtent, s.y + s.height);
  }
  for (const [, py] of activePixels) {
    maxYExtent = Math.max(maxYExtent, py + 1);
  }

  let foundX: number | null = null;
  let foundY: number | null = null;

  const maxX = Math.max(0, canvasWidth - totalW);

  // Scan for existing gaps on the canvas, stepping by 2px for performance & alignment
  for (let y = 0; y <= maxYExtent; y += 2) {
    for (let x = 0; x <= maxX; x += 2) {
      if (
        !collidesWithSlices(x, y, totalW, totalH, slices) &&
        !collidesWithPixels(x, y, totalW, totalH, activePixels)
      ) {
        foundX = x;
        foundY = y;
        break;
      }
    }
    if (foundX !== null && foundY !== null) {
      break;
    }
  }

  // If no available gap was found, place right below the lowest element with a 2px margin
  if (foundX === null || foundY === null) {
    foundX = 0;
    foundY = maxYExtent > 0 ? (maxYExtent % 2 === 0 ? maxYExtent + 2 : maxYExtent + 1) : 0;
  }

  // Generate frame placements
  const frames: FramePlacement[] = [];
  for (let i = 0; i < frameCount; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    frames.push({
      index: i,
      x: foundX + col * frameWidth,
      y: foundY + row * frameHeight,
      width: frameWidth,
      height: frameHeight,
    });
  }

  return {
    frames,
    bounds: {
      x: foundX,
      y: foundY,
      w: totalW,
      h: totalH,
    },
  };
}


import type { LayoutBlock } from '../types/zmk';
import { getWidgetDefinition } from './widgetRegistry';

/**
 * Gracefully remaps widget pixel coordinates when display screen dimensions change.
 *
 * Rules:
 * 1. Check if screen orientation changed (horizontal to vertical or vice versa).
 * 2. If same orientation: scale X and Y by their percentage of old screen dimensions, rounded to nearest pixel.
 * 3. If orientation changed: align height percentage to new width, and width percentage to new height.
 * 4. Double check bounds and nudge widgets inside screen boundaries when possible.
 *    If a widget is larger than the screen dimension, leaves it as is.
 */
export function remapBlockCoordinates(
  blocks: LayoutBlock[],
  oldDimensions: { width: number; height: number },
  newDimensions: { width: number; height: number }
): LayoutBlock[] {
  if (
    !blocks ||
    blocks.length === 0 ||
    !oldDimensions ||
    !newDimensions ||
    (oldDimensions.width === newDimensions.width && oldDimensions.height === newDimensions.height)
  ) {
    return blocks;
  }

  const oldW = oldDimensions.width;
  const oldH = oldDimensions.height;
  const newW = newDimensions.width;
  const newH = newDimensions.height;

  if (oldW <= 0 || oldH <= 0 || newW <= 0 || newH <= 0) {
    return blocks;
  }

  const oldIsVertical = oldH > oldW;
  const newIsVertical = newH > newW;
  const isOrientationChange = oldIsVertical !== newIsVertical;

  return blocks.map((block) => {
    const currX = block.x ?? 0;
    const currY = block.y ?? 0;

    const def = block.widgetType ? getWidgetDefinition(block.widgetType) : undefined;
    const bw: number = block.width ?? def?.defaultWidth ?? oldW;
    const bh: number = block.height ?? def?.defaultHeight ?? 10;

    let nextX: number;
    let nextY: number;

    if (!isOrientationChange) {
      // Same orientation: adjust percentage based on respective axis, align to nearest pixel
      const xPercent = currX / oldW;
      const yPercent = currY / oldH;
      nextX = Math.round(xPercent * newW);
      nextY = Math.round(yPercent * newH);
    } else {
      // Changing orientation: align height percentage to new width, width percentage to new height
      const yPercent = currY / oldH;
      const xPercent = currX / oldW;
      nextX = Math.round(yPercent * newW);
      nextY = Math.round(xPercent * newH);
    }

    // Boundary check & nudge inside if possible
    if (bw <= newW) {
      if (nextX + bw > newW) {
        nextX = newW - bw;
      }
      if (nextX < 0) {
        nextX = 0;
      }
    } else {
      // Widget wider than screen: nudge not possible, keep as is
    }

    if (bh <= newH) {
      if (nextY + bh > newH) {
        nextY = newH - bh;
      }
      if (nextY < 0) {
        nextY = 0;
      }
    } else {
      // Widget taller than screen: nudge not possible, keep as is
    }

    return {
      ...block,
      x: nextX,
      y: nextY,
    };
  });
}

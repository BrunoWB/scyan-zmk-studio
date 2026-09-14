import type { LayoutBlock } from '../types/zmk';
import type { WidgetInstanceMap } from '../types/widget';
import { getWidgetDefinition, normalizeWidgetType, resolveWidgetInstance } from './widgetRegistry';

type AxisAlignment = 'start' | 'center' | 'end' | 'custom';

interface AxisAlignmentInfo {
  align: AxisAlignment;
  ratio: number;
}

/**
 * Resolves the 1D alignment and relative ratio for a position within available slack.
 */
function resolveAxisAlignment(
  pos: number,
  widgetSize: number,
  screenDim: number,
  explicitAlign?: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom'
): AxisAlignmentInfo {
  const slack = screenDim - widgetSize;

  if (explicitAlign === 'center' || explicitAlign === 'middle') {
    return { align: 'center', ratio: 0.5 };
  }
  if (explicitAlign === 'left' || explicitAlign === 'top') {
    return { align: 'start', ratio: 0.0 };
  }
  if (explicitAlign === 'right' || explicitAlign === 'bottom') {
    return { align: 'end', ratio: 1.0 };
  }

  // Full-width or oversized widget in old dimension:
  // Default to center if it was placed at 0 or near center
  if (slack <= 0) {
    return { align: 'center', ratio: 0.5 };
  }

  // Geometric alignment detection with 1.0px tolerance:
  // Centered: pos is within 1.0px of slack / 2
  if (Math.abs(pos - slack / 2) <= 1.0) {
    return { align: 'center', ratio: 0.5 };
  }
  // Start edge: pos is within 0.5px of 0
  if (pos <= 0.5) {
    return { align: 'start', ratio: 0.0 };
  }
  // End edge: pos is within 1.0px of slack
  if (Math.abs(pos - slack) <= 1.0) {
    return { align: 'end', ratio: 1.0 };
  }

  // Custom position: proportional ratio across available slack
  const ratio = pos / slack;
  return { align: 'custom', ratio };
}

/**
 * Maps an axis alignment / ratio into a target dimension with target widget size.
 */
function mapAxisPosition(
  info: AxisAlignmentInfo,
  targetWidgetSize: number,
  targetDim: number
): number {
  const targetSlack = targetDim - targetWidgetSize;

  if (targetSlack <= 0) {
    if (info.align === 'center') {
      return Math.round(targetSlack / 2);
    }
    if (info.align === 'end') {
      return targetSlack;
    }
    return 0;
  }

  if (info.align === 'center') {
    return Math.round(targetSlack / 2);
  }
  if (info.align === 'start') {
    return 0;
  }
  if (info.align === 'end') {
    return targetSlack;
  }

  return Math.round(info.ratio * targetSlack);
}

/**
 * Nudges a widget's position to keep it inside screen bounds if possible.
 */
function nudgeInsideBounds(pos: number, widgetSize: number, screenDim: number): number {
  if (widgetSize <= screenDim) {
    if (pos + widgetSize > screenDim) {
      pos = screenDim - widgetSize;
    }
    if (pos < 0) {
      pos = 0;
    }
  } else {
    // Widget larger than screen: cannot fit completely inside.
    if (pos > 0 && pos + widgetSize > screenDim) {
      pos = 0;
    } else if (pos < 0) {
      pos = 0;
    }
  }
  return pos;
}

function doBlocksOverlap(
  b1: { x: number; y: number; width: number; height: number },
  b2: { x: number; y: number; width: number; height: number }
): boolean {
  return (
    b1.x < b2.x + b2.width &&
    b2.x < b1.x + b1.width &&
    b1.y < b2.y + b2.height &&
    b2.y < b1.y + b1.height
  );
}

/**
 * Gracefully remaps widget pixel coordinates when display screen dimensions change.
 *
 * Rules:
 * 1. Aware of widget alignments (explicit via block/instance config and geometric center/start/end).
 * 2. Proportional mapping: matches position proportionally across available slack space.
 * 3. Orientation inversion: when switching between vertical and horizontal, height proportion matches
 *    width and vice versa.
 * 4. Boundary check & nudge: if parts of a widget are outside bounds, nudges inside if possible.
 * 5. Collision resolution: widgets that were non-overlapping in the source screen are prevented from
 *    smashing / colliding into each other on the target screen.
 */
export function remapBlockCoordinates(
  blocks: LayoutBlock[],
  oldDimensions: { width: number; height: number },
  newDimensions: { width: number; height: number },
  instances?: WidgetInstanceMap
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

  // 1. Snapshot source geometry to record which widgets originally overlapped
  const sourceGeometry = blocks.map((block) => {
    const normType = normalizeWidgetType(block.widgetType || block.id);
    const def = getWidgetDefinition(normType);
    return {
      x: block.x ?? def?.defaultPlacement.defaultX ?? 0,
      y: block.y ?? def?.defaultPlacement.defaultY ?? 0,
      width: block.width ?? def?.defaultWidth ?? oldW,
      height: block.height ?? def?.defaultHeight ?? 10,
    };
  });

  const originallyOverlapped = new Set<string>();
  for (let i = 0; i < sourceGeometry.length; i++) {
    for (let j = i + 1; j < sourceGeometry.length; j++) {
      if (doBlocksOverlap(sourceGeometry[i], sourceGeometry[j])) {
        originallyOverlapped.add(`${i}_${j}`);
      }
    }
  }

  // 2. Initial proportional mapping with alignment awareness
  const remapped = blocks.map((block, idx) => {
    const normType = normalizeWidgetType(block.widgetType || block.id);
    const activeInstance = resolveWidgetInstance(instances, normType, block.instanceId);

    const currX = sourceGeometry[idx].x;
    const currY = sourceGeometry[idx].y;
    const bw = sourceGeometry[idx].width;
    const bh = sourceGeometry[idx].height;

    // Explicit text/block alignment if configured
    const explicitTextAlign = block.textAlign || activeInstance?.config?.textAlign || activeInstance?.config?.align;

    let nextX: number;
    let nextY: number;

    if (!isOrientationChange) {
      // Same orientation: X maps to X (width), Y maps to Y (height)
      const hInfo = resolveAxisAlignment(currX, bw, oldW, explicitTextAlign);
      const vInfo = resolveAxisAlignment(currY, bh, oldH);
      nextX = mapAxisPosition(hInfo, bw, newW);
      nextY = mapAxisPosition(vInfo, bh, newH);
    } else {
      // Changing orientation:
      // Proportion of height matches width (old Y -> new X)
      // Proportion of width matches height (old X -> new Y)
      const hInfo = resolveAxisAlignment(currX, bw, oldW);
      const vInfo = resolveAxisAlignment(currY, bh, oldH);
      nextX = mapAxisPosition(vInfo, bw, newW);
      nextY = mapAxisPosition(hInfo, bh, newH);
    }

    // Boundary check & nudge inside bounds if possible
    nextX = nudgeInsideBounds(nextX, bw, newW);
    nextY = nudgeInsideBounds(nextY, bh, newH);

    return {
      ...block,
      x: nextX,
      y: nextY,
      width: bw,
      height: bh,
    };
  });

  // 3. Collision Resolution / Overlap Prevention along the primary flow axis
  const primaryAxis: 'x' | 'y' = newW >= newH ? 'x' : 'y';
  const sourceFlowAxis: 'x' | 'y' = oldW >= oldH ? 'x' : 'y';

  // Sort indices according to the natural flow along the primary axis
  const orderedIndices = remapped.map((_, idx) => idx).sort((a, b) => {
    const posA = primaryAxis === 'x' ? remapped[a].x : remapped[a].y;
    const posB = primaryAxis === 'x' ? remapped[b].x : remapped[b].y;
    if (posA !== posB) return posA - posB;
    const srcA = sourceFlowAxis === 'x' ? sourceGeometry[a].x : sourceGeometry[a].y;
    const srcB = sourceFlowAxis === 'x' ? sourceGeometry[b].x : sourceGeometry[b].y;
    return srcA - srcB;
  });

  const minGap = 1;

  // Forward pass: separate downstream blocks that collide with earlier blocks
  for (let step = 1; step < orderedIndices.length; step++) {
    const currIdx = orderedIndices[step];
    const curr = remapped[currIdx];

    for (let prevStep = 0; prevStep < step; prevStep++) {
      const prevIdx = orderedIndices[prevStep];
      const prev = remapped[prevIdx];

      const pairKey = prevIdx < currIdx ? `${prevIdx}_${currIdx}` : `${currIdx}_${prevIdx}`;
      if (originallyOverlapped.has(pairKey)) {
        continue;
      }

      if (doBlocksOverlap(prev, curr)) {
        if (primaryAxis === 'x') {
          const reqX = prev.x + prev.width + minGap;
          if (curr.x < reqX) {
            curr.x = reqX;
          }
        } else {
          const reqY = prev.y + prev.height + minGap;
          if (curr.y < reqY) {
            curr.y = reqY;
          }
        }
      }
    }
  }

  // Backward pass: if downstream blocks overshot target screen boundary, pull back
  for (let step = orderedIndices.length - 1; step >= 0; step--) {
    const currIdx = orderedIndices[step];
    const curr = remapped[currIdx];

    if (primaryAxis === 'x') {
      if (curr.width <= newW && curr.x + curr.width > newW) {
        curr.x = newW - curr.width;
      }
    } else {
      if (curr.height <= newH && curr.y + curr.height > newH) {
        curr.y = newH - curr.height;
      }
    }

    for (let nextStep = step + 1; nextStep < orderedIndices.length; nextStep++) {
      const nextIdx = orderedIndices[nextStep];
      const next = remapped[nextIdx];

      const pairKey = currIdx < nextIdx ? `${currIdx}_${nextIdx}` : `${nextIdx}_${currIdx}`;
      if (originallyOverlapped.has(pairKey)) {
        continue;
      }

      if (doBlocksOverlap(curr, next)) {
        if (primaryAxis === 'x') {
          const maxAllowedX = next.x - curr.width - minGap;
          if (curr.x > maxAllowedX) {
            curr.x = Math.max(0, maxAllowedX);
          }
        } else {
          const maxAllowedY = next.y - curr.height - minGap;
          if (curr.y > maxAllowedY) {
            curr.y = Math.max(0, maxAllowedY);
          }
        }
      }
    }
  }

  // 4. Final bounds nudge
  for (const b of remapped) {
    b.x = nudgeInsideBounds(b.x, b.width, newW);
    b.y = nudgeInsideBounds(b.y, b.height, newH);
  }

  return remapped;
}

import { PixelGrid as BwpxGrid } from "./PixelGrid";

export function drawBrushDot(grid: BwpxGrid, cx: number, cy: number, val: number, brushSize = 1): void {
  const half = Math.floor(brushSize / 2);
  for (let dy = -half; dy <= half; dy++) {
    for (let dx = -half; dx <= half; dx++) {
      grid.set(cx + dx, cy + dy, val);
    }
  }
}

export function drawLine(
  grid: BwpxGrid,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  val: number,
  brushSize = 1
): void {
  let dx = Math.abs(x1 - x0);
  let dy = Math.abs(y1 - y0);
  let sx = x0 < x1 ? 1 : -1;
  let sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;

  let curX = x0;
  let curY = y0;

  while (true) {
    drawBrushDot(grid, curX, curY, val, brushSize);
    if (curX === x1 && curY === y1) break;
    let e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      curX += sx;
    }
    if (e2 < dx) {
      err += dx;
      curY += sy;
    }
  }
}

export function drawRect(
  grid: BwpxGrid,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  val: number,
  filled = false,
  brushSize = 1
): void {
  const minX = Math.min(x0, x1);
  const maxX = Math.max(x0, x1);
  const minY = Math.min(y0, y1);
  const maxY = Math.max(y0, y1);

  if (filled) {
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        drawBrushDot(grid, x, y, val, brushSize);
      }
    }
  } else {
    drawLine(grid, minX, minY, maxX, minY, val, brushSize);
    drawLine(grid, maxX, minY, maxX, maxY, val, brushSize);
    drawLine(grid, maxX, maxY, minX, maxY, val, brushSize);
    drawLine(grid, minX, maxY, minX, minY, val, brushSize);
  }
}

export function drawEllipse(
  grid: BwpxGrid,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  val: number,
  filled = false,
  brushSize = 1
): void {
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const rx = Math.abs(x1 - x0) / 2;
  const ry = Math.abs(y1 - y0) / 2;

  if (rx === 0 && ry === 0) {
    drawBrushDot(grid, Math.round(cx), Math.round(cy), val, brushSize);
    return;
  }

  const minX = Math.min(x0, x1);
  const maxX = Math.max(x0, x1);
  const minY = Math.min(y0, y1);
  const maxY = Math.max(y0, y1);

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const normX = rx > 0 ? (x - cx) / rx : 0;
      const normY = ry > 0 ? (y - cy) / ry : 0;
      const dist = normX * normX + normY * normY;

      if (filled) {
        if (dist <= 1.0) {
          drawBrushDot(grid, x, y, val, brushSize);
        }
      } else {
        // Outline band
        if (dist <= 1.15 && dist >= 0.75) {
          drawBrushDot(grid, x, y, val, brushSize);
        }
      }
    }
  }
}

export function drawTriangle(
  grid: BwpxGrid,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  val: number,
  filled = false,
  brushSize = 1
): void {
  const tipX = Math.round((x0 + x1) / 2);
  const tipY = Math.min(y0, y1);
  const bLeftX = Math.min(x0, x1);
  const bRightX = Math.max(x0, x1);
  const bY = Math.max(y0, y1);

  if (filled) {
    const height = bY - tipY;
    if (height <= 0) {
      drawLine(grid, bLeftX, bY, bRightX, bY, val, brushSize);
      return;
    }
    for (let y = tipY; y <= bY; y++) {
      const progress = (y - tipY) / height;
      const span = (bRightX - bLeftX) * progress;
      const startX = Math.round(tipX - span / 2);
      const endX = Math.round(tipX + span / 2);
      for (let x = startX; x <= endX; x++) {
        drawBrushDot(grid, x, y, val, brushSize);
      }
    }
  } else {
    drawLine(grid, tipX, tipY, bLeftX, bY, val, brushSize);
    drawLine(grid, bLeftX, bY, bRightX, bY, val, brushSize);
    drawLine(grid, bRightX, bY, tipX, tipY, val, brushSize);
  }
}

export function drawDiamond(
  grid: BwpxGrid,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  val: number,
  filled = false,
  brushSize = 1
): void {
  const minX = Math.min(x0, x1);
  const maxX = Math.max(x0, x1);
  const minY = Math.min(y0, y1);
  const maxY = Math.max(y0, y1);

  const cx = Math.round((minX + maxX) / 2);
  const cy = Math.round((minY + maxY) / 2);

  if (filled) {
    const rx = (maxX - minX) / 2;
    const ry = (maxY - minY) / 2;
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const dx = rx > 0 ? Math.abs(x - cx) / rx : 0;
        const dy = ry > 0 ? Math.abs(y - cy) / ry : 0;
        if (dx + dy <= 1.0) {
          drawBrushDot(grid, x, y, val, brushSize);
        }
      }
    }
  } else {
    drawLine(grid, cx, minY, maxX, cy, val, brushSize);
    drawLine(grid, maxX, cy, cx, maxY, val, brushSize);
    drawLine(grid, cx, maxY, minX, cy, val, brushSize);
    drawLine(grid, minX, cy, cx, minY, val, brushSize);
  }
}

export function drawStar(
  grid: BwpxGrid,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  val: number,
  brushSize = 1
): void {
  const minX = Math.min(x0, x1);
  const maxX = Math.max(x0, x1);
  const minY = Math.min(y0, y1);
  const maxY = Math.max(y0, y1);

  const cx = Math.round((minX + maxX) / 2);
  const cy = Math.round((minY + maxY) / 2);
  const r = Math.min(maxX - minX, maxY - minY) / 2;

  // 5-point star points
  const points: { x: number; y: number }[] = [];
  for (let i = 0; i < 5; i++) {
    const angle = (i * 4 * Math.PI) / 5 - Math.PI / 2;
    points.push({
      x: Math.round(cx + r * Math.cos(angle)),
      y: Math.round(cy + r * Math.sin(angle)),
    });
  }

  for (let i = 0; i < 5; i++) {
    const p1 = points[i];
    const p2 = points[(i + 1) % 5];
    drawLine(grid, p1.x, p1.y, p2.x, p2.y, val, brushSize);
  }
}

export function drawArrow(
  grid: BwpxGrid,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  val: number,
  brushSize = 1,
  _color?: string,
  filled = false
): void {
  drawLine(grid, x0, y0, x1, y1, val, brushSize);

  const angle = Math.atan2(y1 - y0, x1 - x0);
  const headLen = Math.min(10, Math.hypot(x1 - x0, y1 - y0) / 2);

  const a1 = angle - Math.PI / 6;
  const a2 = angle + Math.PI / 6;

  const tip1X = Math.round(x1 - headLen * Math.cos(a1));
  const tip1Y = Math.round(y1 - headLen * Math.sin(a1));
  const tip2X = Math.round(x1 - headLen * Math.cos(a2));
  const tip2Y = Math.round(y1 - headLen * Math.sin(a2));

  if (filled) {
    const minX = Math.min(x1, tip1X, tip2X);
    const maxX = Math.max(x1, tip1X, tip2X);
    const minY = Math.min(y1, tip1Y, tip2Y);
    const maxY = Math.max(y1, tip1Y, tip2Y);

    const denom = (tip1Y - tip2Y) * (x1 - tip2X) + (tip2X - tip1X) * (y1 - tip2Y);
    if (Math.abs(denom) > 1e-5) {
      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          const a = ((tip1Y - tip2Y) * (x - tip2X) + (tip2X - tip1X) * (y - tip2Y)) / denom;
          const b = ((tip2Y - y1) * (x - tip2X) + (x1 - tip2X) * (y - tip2Y)) / denom;
          const c = 1 - a - b;
          if (a >= 0 && b >= 0 && c >= 0) {
            drawBrushDot(grid, x, y, val, brushSize);
          }
        }
      }
    }
  }

  drawLine(grid, x1, y1, tip1X, tip1Y, val, brushSize);
  drawLine(grid, x1, y1, tip2X, tip2Y, val, brushSize);
  if (filled) {
    drawLine(grid, tip1X, tip1Y, tip2X, tip2Y, val, brushSize);
  }
}

export const SHAPE_TOOLS = [
  'line',
  'arrow',
  'filled-arrow',
  'rect',
  'filled-rect',
  'ellipse',
  'filled-ellipse',
  'triangle',
  'filled-triangle',
  'diamond',
  'star',
  'plus',
] as const;

export type ShapeTool = (typeof SHAPE_TOOLS)[number];

export function isShapeTool(tool: string): boolean {
  return (SHAPE_TOOLS as readonly string[]).includes(tool);
}

export interface ShapeCoordsOptions {
  shiftKey?: boolean;
  ctrlKey?: boolean;
}

export interface ShapeEndpoints {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export function calculateShapeEndpoints(
  tool: string,
  start: { x: number; y: number },
  current: { x: number; y: number },
  options: ShapeCoordsOptions = {}
): ShapeEndpoints {
  const isLine = tool === 'line' || tool === 'arrow' || tool === 'filled-arrow';
  const dx = current.x - start.x;
  const dy = current.y - start.y;

  let snappedDx = dx;
  let snappedDy = dy;

  if (options.shiftKey) {
    if (isLine) {
      if (dx === 0 && dy === 0) {
        snappedDx = 0;
        snappedDy = 0;
      } else {
        const angle = Math.atan2(dy, dx);
        const octant = Math.round(angle / (Math.PI / 4));
        const len = Math.max(Math.abs(dx), Math.abs(dy));

        if (octant === 0 || octant === 4 || octant === -4) {
          snappedDx = dx;
          snappedDy = 0;
        } else if (octant === 2 || octant === -2) {
          snappedDx = 0;
          snappedDy = dy;
        } else {
          snappedDx = octant === 1 || octant === -1 ? len : -len;
          snappedDy = octant === 1 || octant === 3 ? len : -len;
        }
      }
    } else {
      const size = Math.max(Math.abs(dx), Math.abs(dy));
      const signX = dx >= 0 ? 1 : -1;
      const signY = dy >= 0 ? 1 : -1;
      snappedDx = signX * size;
      snappedDy = signY * size;
    }
  }

  if (options.ctrlKey) {
    return {
      x0: start.x - snappedDx,
      y0: start.y - snappedDy,
      x1: start.x + snappedDx,
      y1: start.y + snappedDy,
    };
  }

  return {
    x0: start.x,
    y0: start.y,
    x1: start.x + snappedDx,
    y1: start.y + snappedDy,
  };
}

export function drawShape(
  grid: BwpxGrid,
  tool: string,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  val: number = 1,
  brushSize = 1
): void {
  switch (tool) {
    case 'line':
      drawLine(grid, x0, y0, x1, y1, val, brushSize);
      break;
    case 'arrow':
      drawArrow(grid, x0, y0, x1, y1, val, brushSize, undefined, false);
      break;
    case 'filled-arrow':
      drawArrow(grid, x0, y0, x1, y1, val, brushSize, undefined, true);
      break;
    case 'rect':
      drawRect(grid, x0, y0, x1, y1, val, false, brushSize);
      break;
    case 'filled-rect':
      drawRect(grid, x0, y0, x1, y1, val, true, brushSize);
      break;
    case 'ellipse':
      drawEllipse(grid, x0, y0, x1, y1, val, false, brushSize);
      break;
    case 'filled-ellipse':
      drawEllipse(grid, x0, y0, x1, y1, val, true, brushSize);
      break;
    case 'triangle':
      drawTriangle(grid, x0, y0, x1, y1, val, false, brushSize);
      break;
    case 'filled-triangle':
      drawTriangle(grid, x0, y0, x1, y1, val, true, brushSize);
      break;
    case 'diamond':
      drawDiamond(grid, x0, y0, x1, y1, val, false, brushSize);
      break;
    case 'star':
      drawStar(grid, x0, y0, x1, y1, val, brushSize);
      break;
    case 'plus':
      drawPlus(grid, x0, y0, x1, y1, val, brushSize);
      break;
  }
}

export function drawPlus(
  grid: BwpxGrid,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  val: number,
  brushSize = 1
): void {
  const minX = Math.min(x0, x1);
  const maxX = Math.max(x0, x1);
  const minY = Math.min(y0, y1);
  const maxY = Math.max(y0, y1);

  const cx = Math.round((minX + maxX) / 2);
  const cy = Math.round((minY + maxY) / 2);

  drawLine(grid, minX, cy, maxX, cy, val, brushSize);
  drawLine(grid, cx, minY, cx, maxY, val, brushSize);
}

export function floodFill(grid: BwpxGrid, startX: number, startY: number, newVal: number): void {
  const targetVal = grid.get(startX, startY);
  if (targetVal === newVal) return;

  const queue: [number, number][] = [[startX, startY]];
  const visited = new Set<string>();
  let filled = 0;
  const MAX_FILL = 8192; // Prevent flooding infinite outer space

  while (queue.length > 0 && filled < MAX_FILL) {
    const [x, y] = queue.pop()!;
    const key = `${x},${y}`;

    if (visited.has(key)) continue;
    visited.add(key);

    if (grid.get(x, y) === targetVal) {
      grid.set(x, y, newVal);
      filled++;

      queue.push([x - 1, y]);
      queue.push([x + 1, y]);
      queue.push([x, y - 1]);
      queue.push([x, y + 1]);
    }
  }
}

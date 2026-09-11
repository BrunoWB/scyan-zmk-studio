import { BwpxGrid } from './BwpxGrid';
import type { SpriteSlice } from '../../types/zmk';

export interface GhostOverlay {
  pixels: [number, number][]; // relative coords [relX, relY]
  x: number;
  y: number;
  w: number;
  h: number;
  rects?: { x: number; y: number; w: number; h: number }[];
}

export interface SelectionOverlay {
  x: number;
  y: number;
  w: number;
  h: number;
  active: boolean;
}

export interface RenderBwpxOptions {
  grid: BwpxGrid;
  zoom: number;
  pan: { x: number; y: number };
  pixelColor?: string;
  bgColor?: string;
  gridLineColor?: string;
  showGridLines?: boolean;
  showAxes?: boolean;
  ghost?: GhostOverlay | null;
  selection?: SelectionOverlay | null;
  slices?: SpriteSlice[];
  selectedSliceId?: string;
  frameBounds?: { x: number; y: number; w: number; h: number } | null;
  hoverPos?: { x: number; y: number } | null;
  hoverHighlightColor?: string;
}

/**
 * Shared grid canvas renderer used by BwpxEditor and ImageImportModal
 */
export function renderBwpxCanvas(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  options: RenderBwpxOptions
): void {
  const {
    grid,
    zoom,
    pan,
    pixelColor = '#ffffff',
    bgColor = '#0b0d11',
    gridLineColor = 'rgba(255, 255, 255, 0.04)',
    showGridLines = zoom >= 5,
    showAxes = true,
    ghost = null,
    selection = null,
    slices = [],
    selectedSliceId = '',
    frameBounds = null,
    hoverPos = null,
    hoverHighlightColor = 'rgba(255, 255, 255, 0.04)',
  } = options;

  ctx.imageSmoothingEnabled = false;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Deep studio background
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const panX = Math.round(pan.x);
  const panY = Math.round(pan.y);

  // Visible viewport grid bounds
  const startGridX = Math.floor(-panX / zoom);
  const endGridX = Math.ceil((canvas.width - panX) / zoom);
  const startGridY = Math.floor(-panY / zoom);
  const endGridY = Math.ceil((canvas.height - panY) / zoom);

  // Subtle column & row highlight on hover
  if (hoverPos) {
    const colX = panX + Math.round(hoverPos.x * zoom);
    const colW = Math.round((hoverPos.x + 1) * zoom) - Math.round(hoverPos.x * zoom);
    const rowY = panY + Math.round(hoverPos.y * zoom);
    const rowH = Math.round((hoverPos.y + 1) * zoom) - Math.round(hoverPos.y * zoom);

    const xMin = frameBounds ? Math.max(0, panX + Math.round(frameBounds.x * zoom)) : 0;
    const xMax = frameBounds ? Math.min(canvas.width, panX + Math.round((frameBounds.x + frameBounds.w) * zoom)) : canvas.width;
    const yMin = frameBounds ? Math.max(0, panY + Math.round(frameBounds.y * zoom)) : 0;
    const yMax = frameBounds ? Math.min(canvas.height, panY + Math.round((frameBounds.y + frameBounds.h) * zoom)) : canvas.height;

    ctx.fillStyle = hoverHighlightColor;

    // Highlight column
    const drawColX = Math.max(xMin, colX);
    const drawColW = Math.min(colX + colW, xMax) - drawColX;
    if (drawColW > 0 && yMax > yMin) {
      ctx.fillRect(drawColX, yMin, drawColW, yMax - yMin);
    }

    // Highlight row
    const drawRowY = Math.max(yMin, rowY);
    const drawRowH = Math.min(rowY + rowH, yMax) - drawRowY;
    if (drawRowH > 0 && xMax > xMin) {
      ctx.fillRect(xMin, drawRowY, xMax - xMin, drawRowH);
    }
  }

  // 1. Subtle infinite grid lines
  if (showGridLines) {
    ctx.save();
    // 0.5 offset aligns 1px strokes directly with physical pixels to prevent 2px blur
    ctx.translate(panX + 0.5, panY + 0.5);
    ctx.strokeStyle = gridLineColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = startGridX; x <= endGridX; x++) {
      const lx = Math.round(x * zoom);
      ctx.moveTo(lx, Math.round(startGridY * zoom));
      ctx.lineTo(lx, Math.round(endGridY * zoom));
    }
    for (let y = startGridY; y <= endGridY; y++) {
      const ly = Math.round(y * zoom);
      ctx.moveTo(Math.round(startGridX * zoom), ly);
      ctx.lineTo(Math.round(endGridX * zoom), ly);
    }
    ctx.stroke();
    ctx.restore();
  }

  // 2. Coordinate Axes (X axis and Y axis crossing at 0, 0)
  if (showAxes) {
    const originX = panX;
    const originY = panY;

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, originY + 0.5);
    ctx.lineTo(canvas.width, originY + 0.5);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(originX + 0.5, 0);
    ctx.lineTo(originX + 0.5, canvas.height);
    ctx.stroke();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.beginPath();
    ctx.arc(originX, originY, 2.5, 0, Math.PI * 2);
    ctx.fill();

    if (zoom >= 8) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.fillText('(0, 0)', originX + 5, originY - 5);
    }
  }

  ctx.save();
  ctx.translate(panX, panY);

  // Frame boundary (if a defined frame or image rect is specified)
  if (frameBounds) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
    ctx.lineWidth = 1;
    const fx = Math.round(frameBounds.x * zoom);
    const fy = Math.round(frameBounds.y * zoom);
    const fw = Math.round((frameBounds.x + frameBounds.w) * zoom) - fx;
    const fh = Math.round((frameBounds.y + frameBounds.h) * zoom) - fy;
    ctx.strokeRect(fx + 0.5, fy + 0.5, fw, fh);
  }

  // 3. Active pixels - drawn on exact pixel boundaries to eliminate subpixel blur
  ctx.fillStyle = pixelColor;
  const allPixels = grid.getAllPixels();
  for (let i = 0; i < allPixels.length; i++) {
    const [x, y] = allPixels[i];
    if (x >= startGridX && x <= endGridX && y >= startGridY && y <= endGridY) {
      const px = Math.round(x * zoom);
      const py = Math.round(y * zoom);
      const pw = Math.round((x + 1) * zoom) - px;
      const ph = Math.round((y + 1) * zoom) - py;
      ctx.fillRect(px, py, pw, ph);
    }
  }

  // 4. Ghost image preview during drag or placement
  if (ghost) {
    const targetX = ghost.x;
    const targetY = ghost.y;

    // Fill background so black is NOT treated as transparent layer and overrides beneath
    ctx.fillStyle = bgColor;
    if (ghost.rects && ghost.rects.length > 0) {
      ghost.rects.forEach(r => {
        const rx = Math.round(r.x * zoom);
        const ry = Math.round(r.y * zoom);
        const rw = Math.round((r.x + r.w) * zoom) - rx;
        const rh = Math.round((r.y + r.h) * zoom) - ry;
        ctx.fillRect(rx, ry, rw, rh);
      });
    } else {
      const gx = Math.round(targetX * zoom);
      const gy = Math.round(targetY * zoom);
      const gw = Math.round((targetX + ghost.w) * zoom) - gx;
      const gh = Math.round((targetY + ghost.h) * zoom) - gy;
      ctx.fillRect(gx, gy, gw, gh);
    }

    ctx.fillStyle = 'rgba(192, 132, 252, 0.7)';
    ctx.shadowColor = '#c084fc';
    ctx.shadowBlur = 10;
    ghost.pixels.forEach(([relX, relY]) => {
      const gpx = Math.round((targetX + relX) * zoom);
      const gpy = Math.round((targetY + relY) * zoom);
      const gpw = Math.round((targetX + relX + 1) * zoom) - gpx;
      const gph = Math.round((targetY + relY + 1) * zoom) - gpy;
      ctx.fillRect(gpx, gpy, gpw, gph);
    });
    ctx.shadowBlur = 0;

    // Ghost marquee
    ctx.strokeStyle = '#c084fc';
    ctx.fillStyle = 'rgba(192, 132, 252, 0.12)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    if (ghost.rects && ghost.rects.length > 0) {
      ghost.rects.forEach(r => {
        const rx = Math.round(r.x * zoom);
        const ry = Math.round(r.y * zoom);
        const rw = Math.round((r.x + r.w) * zoom) - rx;
        const rh = Math.round((r.y + r.h) * zoom) - ry;
        ctx.strokeRect(rx + 0.5, ry + 0.5, rw, rh);
        ctx.fillRect(rx, ry, rw, rh);
      });
    } else {
      const gx = Math.round(targetX * zoom);
      const gy = Math.round(targetY * zoom);
      const gw = Math.round((targetX + ghost.w) * zoom) - gx;
      const gh = Math.round((targetY + ghost.h) * zoom) - gy;
      ctx.strokeRect(gx + 0.5, gy + 0.5, gw, gh);
      ctx.fillRect(gx, gy, gw, gh);
    }
    ctx.setLineDash([]);
  }

  // 5. Sprite Slices Overlay
  if (slices && slices.length > 0) {
    slices.forEach(s => {
      const isSelected = selectedSliceId === s.id;
      const sx = Math.round(s.x * zoom);
      const sy = Math.round(s.y * zoom);
      const sw = Math.round((s.x + s.width) * zoom) - sx;
      const sh = Math.round((s.y + s.height) * zoom) - sy;

      ctx.strokeStyle = isSelected ? '#c084fc' : (s.color || 'rgba(168, 85, 247, 0.45)');
      ctx.lineWidth = isSelected ? 2 : 1;
      if (!isSelected) {
        ctx.setLineDash([3, 3]);
      } else {
        ctx.setLineDash([]);
        ctx.shadowColor = '#c084fc';
        ctx.shadowBlur = 8;
      }
      ctx.strokeRect(sx + 0.5, sy + 0.5, sw, sh);
      ctx.shadowBlur = 0;
      ctx.setLineDash([]);

      // Slice badge label
      if (zoom >= 6) {
        const label = `${s.name} (${s.width}×${s.height})`;
        ctx.font = '10px "JetBrains Mono", monospace';
        const textWidth = ctx.measureText(label).width;
        ctx.fillStyle = isSelected ? 'rgba(192, 132, 252, 0.95)' : 'rgba(18, 20, 26, 0.85)';
        ctx.fillRect(sx, sy - 15, textWidth + 8, 14);
        ctx.fillStyle = isSelected ? '#090a0d' : '#cbd5e1';
        ctx.fillText(label, sx + 4, sy - 4);
      }
    });
  }

  // 6. Selection Marquee
  if (selection && selection.active) {
    const mx = Math.round(selection.x * zoom);
    const my = Math.round(selection.y * zoom);
    const mw = Math.round((selection.x + selection.w) * zoom) - mx;
    const mh = Math.round((selection.y + selection.h) * zoom) - my;

    ctx.strokeStyle = '#38bdf8';
    ctx.fillStyle = 'rgba(56, 189, 248, 0.08)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.strokeRect(mx + 0.5, my + 0.5, mw, mh);
    ctx.fillRect(mx, my, mw, mh);
    ctx.setLineDash([]);
  }

  ctx.restore();
}


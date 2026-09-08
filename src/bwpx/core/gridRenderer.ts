import { BwpxGrid } from './BwpxGrid';
import type { SpriteSlice } from '../../types/zmk';

export interface GhostOverlay {
  pixels: [number, number][]; // relative coords [relX, relY]
  x: number;
  y: number;
  w: number;
  h: number;
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
    pixelColor = '#00d2ff',
    bgColor = '#0b0d11',
    gridLineColor = 'rgba(255, 255, 255, 0.04)',
    showGridLines = zoom >= 5,
    showAxes = true,
    ghost = null,
    selection = null,
    slices = [],
    selectedSliceId = '',
    frameBounds = null,
  } = options;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Deep studio background
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Visible viewport grid bounds
  const startGridX = Math.floor(-pan.x / zoom);
  const endGridX = Math.ceil((canvas.width - pan.x) / zoom);
  const startGridY = Math.floor(-pan.y / zoom);
  const endGridY = Math.ceil((canvas.height - pan.y) / zoom);

  // 1. Subtle infinite grid lines
  if (showGridLines) {
    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.strokeStyle = gridLineColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = startGridX; x <= endGridX; x++) {
      ctx.moveTo(x * zoom, startGridY * zoom);
      ctx.lineTo(x * zoom, endGridY * zoom);
    }
    for (let y = startGridY; y <= endGridY; y++) {
      ctx.moveTo(startGridX * zoom, y * zoom);
      ctx.lineTo(endGridX * zoom, y * zoom);
    }
    ctx.stroke();
    ctx.restore();
  }

  // 2. Coordinate Axes (X axis and Y axis crossing at 0, 0)
  if (showAxes) {
    const originX = pan.x;
    const originY = pan.y;

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, originY);
    ctx.lineTo(canvas.width, originY);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(originX, 0);
    ctx.lineTo(originX, canvas.height);
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
  ctx.translate(pan.x, pan.y);

  // Frame boundary (if a defined frame or image rect is specified)
  if (frameBounds) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
    ctx.lineWidth = 1;
    ctx.strokeRect(
      frameBounds.x * zoom,
      frameBounds.y * zoom,
      frameBounds.w * zoom,
      frameBounds.h * zoom
    );
  }

  // 3. Active pixels
  ctx.fillStyle = pixelColor;
  const allPixels = grid.getAllPixels();
  for (let i = 0; i < allPixels.length; i++) {
    const [x, y] = allPixels[i];
    if (x >= startGridX && x <= endGridX && y >= startGridY && y <= endGridY) {
      ctx.fillRect(x * zoom, y * zoom, zoom, zoom);
    }
  }

  // 4. Ghost image preview during drag or placement
  if (ghost) {
    const targetX = ghost.x;
    const targetY = ghost.y;

    ctx.fillStyle = 'rgba(192, 132, 252, 0.7)';
    ctx.shadowColor = '#c084fc';
    ctx.shadowBlur = 10;
    ghost.pixels.forEach(([relX, relY]) => {
      ctx.fillRect((targetX + relX) * zoom, (targetY + relY) * zoom, zoom, zoom);
    });
    ctx.shadowBlur = 0;

    // Ghost marquee
    ctx.strokeStyle = '#c084fc';
    ctx.fillStyle = 'rgba(192, 132, 252, 0.12)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(targetX * zoom, targetY * zoom, ghost.w * zoom, ghost.h * zoom);
    ctx.fillRect(targetX * zoom, targetY * zoom, ghost.w * zoom, ghost.h * zoom);
    ctx.setLineDash([]);
  }

  // 5. Sprite Slices Overlay
  if (slices && slices.length > 0) {
    slices.forEach(s => {
      const isSelected = selectedSliceId === s.id;
      const sx = s.x * zoom;
      const sy = s.y * zoom;
      const sw = s.width * zoom;
      const sh = s.height * zoom;

      ctx.strokeStyle = isSelected ? '#c084fc' : (s.color || 'rgba(168, 85, 247, 0.45)');
      ctx.lineWidth = isSelected ? 2 : 1;
      if (!isSelected) {
        ctx.setLineDash([3, 3]);
      } else {
        ctx.setLineDash([]);
        ctx.shadowColor = '#c084fc';
        ctx.shadowBlur = 8;
      }
      ctx.strokeRect(sx, sy, sw, sh);
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
    ctx.strokeStyle = '#38bdf8';
    ctx.fillStyle = 'rgba(56, 189, 248, 0.08)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.strokeRect(selection.x * zoom, selection.y * zoom, selection.w * zoom, selection.h * zoom);
    ctx.fillRect(selection.x * zoom, selection.y * zoom, selection.w * zoom, selection.h * zoom);
    ctx.setLineDash([]);
  }

  ctx.restore();
}


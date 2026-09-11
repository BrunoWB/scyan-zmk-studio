import { GifWriter } from 'omggif';
import type { BwpxGrid } from '../bwpx/core/BwpxGrid';
import type { SpriteSlice } from '../types/zmk';

/**
 * Derives a sanitized, friendly filename for a symbol group.
 */
export function getGroupDefaultFilename(groupSlices: SpriteSlice[], groupId?: string): string {
  const head = groupSlices.find(s => s.groupOrder === 1) || groupSlices[0];
  const rawName = (head?.name || (head?.id ? head.id.replace(/^SYMBOL_/, '') : groupId) || 'symbol_group').trim();
  const sanitized = rawName.toLowerCase().replace(/[^a-z0-9_-]/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '');
  return sanitized || 'symbol_group';
}

/**
 * Creates an offscreen HTMLCanvasElement containing either a single sprite
 * or a horizontal sprite strip of all group slices sorted by groupOrder.
 */
export function createGroupPngCanvas(
  grid: BwpxGrid,
  groupSlices: SpriteSlice[]
): HTMLCanvasElement | null {
  if (typeof document === 'undefined' || groupSlices.length === 0) return null;

  const sorted = [...groupSlices].sort((a, b) => (a.groupOrder || 1) - (b.groupOrder || 1));
  const totalWidth = sorted.reduce((sum, s) => sum + s.width, 0);
  const maxHeight = Math.max(...sorted.map(s => s.height), 1);

  if (totalWidth <= 0 || maxHeight <= 0) return null;

  const canvas = document.createElement('canvas');
  canvas.width = totalWidth;
  canvas.height = maxHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // Background 1bpp OLED black
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, totalWidth, maxHeight);

  // Foreground white pixels
  ctx.fillStyle = '#ffffff';

  let currentX = 0;
  for (const slice of sorted) {
    const offsetY = Math.floor((maxHeight - slice.height) / 2);
    for (let y = 0; y < slice.height; y++) {
      for (let x = 0; x < slice.width; x++) {
        if (grid.get(slice.x + x, slice.y + y)) {
          ctx.fillRect(currentX + x, offsetY + y, 1, 1);
        }
      }
    }
    currentX += slice.width;
  }

  return canvas;
}

/**
 * Generates an animated or static GIF Blob from a symbol group's slices.
 * Respects groupOrder sequence and centers slices in max dimensions.
 */
export function generateGroupGifBlob(
  grid: BwpxGrid,
  groupSlices: SpriteSlice[],
  options?: { delayMs?: number }
): Blob | null {
  if (groupSlices.length === 0) return null;

  const sorted = [...groupSlices].sort((a, b) => (a.groupOrder || 1) - (b.groupOrder || 1));
  const maxWidth = Math.max(...sorted.map(s => s.width), 1);
  const maxHeight = Math.max(...sorted.map(s => s.height), 1);

  if (maxWidth <= 0 || maxHeight <= 0) return null;

  // delay in 1/100ths second. 100ms default (10 fps)
  const delayMs = options?.delayMs ?? 100;
  const delayHundredths = Math.max(2, Math.round(delayMs / 10));

  const bufferSize = Math.max(64 * 1024, maxWidth * maxHeight * sorted.length * 3 + 4096);
  const buffer = new Uint8Array(bufferSize);

  const writer = new GifWriter(buffer, maxWidth, maxHeight, {
    loop: 0, // 0 = loop forever
    palette: [0x000000, 0xffffff], // 0: black, 1: white
  });

  for (const slice of sorted) {
    const pixels = new Array<number>(maxWidth * maxHeight).fill(0);
    const offsetX = Math.floor((maxWidth - slice.width) / 2);
    const offsetY = Math.floor((maxHeight - slice.height) / 2);

    for (let y = 0; y < slice.height; y++) {
      for (let x = 0; x < slice.width; x++) {
        if (grid.get(slice.x + x, slice.y + y)) {
          pixels[(offsetY + y) * maxWidth + (offsetX + x)] = 1;
        }
      }
    }

    writer.addFrame(0, 0, maxWidth, maxHeight, pixels, { delay: delayHundredths });
  }

  const byteLength = writer.end();
  return new Blob([buffer.subarray(0, byteLength)], { type: 'image/gif' });
}

/**
 * Triggers native browser download of a given Blob.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  if (typeof document === 'undefined') return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Exports a symbol group as a PNG file download.
 */
export async function exportGroupAsPng(
  grid: BwpxGrid,
  groupSlices: SpriteSlice[],
  filename?: string
): Promise<void> {
  const canvas = createGroupPngCanvas(grid, groupSlices);
  if (!canvas) return;

  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
  if (!blob) return;

  const name = filename || getGroupDefaultFilename(groupSlices);
  downloadBlob(blob, `${name}.png`);
}

/**
 * Exports a symbol group as an animated GIF file download.
 */
export function exportGroupAsGif(
  grid: BwpxGrid,
  groupSlices: SpriteSlice[],
  filename?: string,
  options?: { delayMs?: number }
): void {
  const blob = generateGroupGifBlob(grid, groupSlices, options);
  if (!blob) return;

  const name = filename || getGroupDefaultFilename(groupSlices);
  downloadBlob(blob, `${name}.gif`);
}

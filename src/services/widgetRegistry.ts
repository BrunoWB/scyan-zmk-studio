import { BwpxGrid } from '../pixel/core/PixelGrid';
import type { SpriteSlice, FontGlyph, FontCharMapping, LayoutBlock } from '../types/zmk';
import type {
  DisplayWidgetDefinition,
  WidgetCategory,
  WidgetRenderContext,
  SlotSourceType,
  WidgetSlotDefinition,
  WidgetSlotConfig,
  WidgetInstance,
  WidgetInstanceConfig,
  TypewriterMode,
  TypewriterDirection,
  TypewriterFadeType,
  KeypressElement,
} from '../types/widget';

/**
 * 4x4 Bayer threshold matrix for 1bpp ordered dithering.
 * Normalized to 16 levels (0..15).
 */
export const BAYER_4X4: readonly (readonly number[])[] = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

/**
 * 3x5 fallback bitmap fonts for punctuation characters not always included in custom 1bpp font atlases.
 * Each character is 3 pixels wide and 5 pixels high (MSB to LSB: bit 2, bit 1, bit 0).
 */
export const PUNCTUATION_3X5: Record<string, number[]> = {
  '%': [
    0b101,
    0b001,
    0b010,
    0b100,
    0b101,
  ],
  '[': [
    0b110,
    0b100,
    0b100,
    0b100,
    0b110,
  ],
  ']': [
    0b011,
    0b001,
    0b001,
    0b001,
    0b011,
  ],
  ':': [
    0b000,
    0b010,
    0b000,
    0b010,
    0b000,
  ],
  '-': [
    0b000,
    0b000,
    0b111,
    0b000,
    0b000,
  ],
  '_': [
    0b000,
    0b000,
    0b000,
    0b000,
    0b111,
  ],
  '>': [
    0b100,
    0b010,
    0b001,
    0b010,
    0b100,
  ],
  '<': [
    0b001,
    0b010,
    0b100,
    0b010,
    0b001,
  ],
  '.': [
    0b000,
    0b000,
    0b000,
    0b000,
    0b010,
  ],
  '/': [
    0b001,
    0b001,
    0b010,
    0b100,
    0b100,
  ],
  '?': [
    0b110,
    0b001,
    0b010,
    0b000,
    0b010,
  ],
  '!': [
    0b010,
    0b010,
    0b010,
    0b000,
    0b010,
  ],
  '=': [
    0b000,
    0b111,
    0b000,
    0b111,
    0b000,
  ],
  '(': [
    0b010,
    0b100,
    0b100,
    0b100,
    0b010,
  ],
  ')': [
    0b010,
    0b001,
    0b001,
    0b001,
    0b010,
  ],
  '*': [
    0b000,
    0b101,
    0b010,
    0b101,
    0b000,
  ],
  '^': [
    0b010,
    0b101,
    0b000,
    0b000,
    0b000,
  ],
  '+': [
    0b000,
    0b010,
    0b111,
    0b010,
    0b000,
  ],
  ',': [
    0b000,
    0b000,
    0b000,
    0b010,
    0b100,
  ],
  ';': [
    0b000,
    0b010,
    0b000,
    0b010,
    0b100,
  ],
  "'": [
    0b010,
    0b010,
    0b000,
    0b000,
    0b000,
  ],
  '"': [
    0b101,
    0b101,
    0b000,
    0b000,
    0b000,
  ],
  '|': [
    0b010,
    0b010,
    0b010,
    0b010,
    0b010,
  ],
  '\\': [
    0b100,
    0b100,
    0b010,
    0b001,
    0b001,
  ],
  '~': [
    0b011,
    0b110,
    0b000,
    0b000,
    0b000,
  ],
  '{': [
    0b011,
    0b010,
    0b110,
    0b010,
    0b011,
  ],
  '}': [
    0b110,
    0b010,
    0b011,
    0b010,
    0b110,
  ],
  '#': [
    0b101,
    0b111,
    0b101,
    0b111,
    0b101,
  ],
  '@': [
    0b111,
    0b101,
    0b111,
    0b100,
    0b011,
  ],
  '$': [
    0b010,
    0b111,
    0b010,
    0b111,
    0b010,
  ],
  '&': [
    0b010,
    0b101,
    0b010,
    0b101,
    0b011,
  ],
};

/**
 * Normalizes a key identifier or code into a canonical string for matching.
 * Handles space, backspace, enter, escape, arrow key aliases (ArrowUp, Up, ▲, &kp UP),
 * KeyA vs A codes, and Digit1 / N1 codes.
 */
export function normalizeKey(key: string): string {
  if (!key) return '';
  if (key === ' ') return 'space';
  let k = key.trim().toLowerCase();
  // Strip ZMK action prefix like &kp
  if (k.startsWith('&kp ')) {
    k = k.slice(4).trim();
  }
  // Space
  if (k === 'space' || k === 'spc') return 'space';
  // Enter / Return
  if (k === 'enter' || k === 'return' || k === 'ret') return 'enter';
  // Escape
  if (k === 'escape' || k === 'esc') return 'escape';
  // Backspace
  if (k === 'backspace' || k === 'bspc') return 'backspace';
  // Arrows
  if (k === 'arrowup' || k === 'up' || k === '▲') return 'arrowup';
  if (k === 'arrowdown' || k === 'down' || k === '▼') return 'arrowdown';
  if (k === 'arrowleft' || k === 'left' || k === '◀') return 'arrowleft';
  if (k === 'arrowright' || k === 'right' || k === '▶') return 'arrowright';
  // Strip 'key' prefix: e.g. keyw -> w
  if (k.startsWith('key') && k.length === 4) return k.slice(3);
  // Strip 'digit' prefix: e.g. digit1 -> 1
  if (k.startsWith('digit') && k.length === 6) return k.slice(5);
  // Strip 'numpad' prefix: e.g. numpad1 -> 1
  if (k.startsWith('numpad') && k.length === 7) return k.slice(6);
  // ZMK digit code: e.g. n1 -> 1
  if (/^n\d$/.test(k)) return k[1];
  return k;
}

/**
 * Normalizes and matches a key binding string against a pressed key/code.
 * Handles case-insensitivity, arrow key aliases (ArrowUp vs Up vs ▲), space, and scan codes.
 */
export function isKeyMatching(bindingKey: string, pressedKey: string): boolean {
  if (!bindingKey || !pressedKey) return false;
  const nb = normalizeKey(bindingKey);
  const np = normalizeKey(pressedKey);
  if (nb && np && nb === np) return true;
  return false;
}

/**
 * Utility to blit a named slice from symbolsGrid into destGrid at (destX, destY).
 * When boxWidth and/or boxHeight are provided, centers the slice horizontally and/or vertically (middle) within the bounded box.
 */
export function blitSlice(
  destGrid: BwpxGrid,
  symbolsGrid: BwpxGrid,
  symbolSlices: SpriteSlice[],
  sliceId: string,
  destX: number,
  destY: number,
  boxWidth?: number,
  boxHeight?: number
): boolean {
  const slice = symbolSlices.find(s => s.id === sliceId);
  if (!slice) return false;

  const targetStartX = (boxWidth !== undefined && boxWidth > slice.width)
    ? destX + Math.floor((boxWidth - slice.width) / 2)
    : destX;

  const targetStartY = (boxHeight !== undefined && boxHeight > slice.height)
    ? destY + Math.floor((boxHeight - slice.height) / 2)
    : destY;

  for (let sy = 0; sy < slice.height; sy++) {
    const targetY = targetStartY + sy;
    if (targetY < 0 || targetY >= destGrid.height) continue;
    for (let sx = 0; sx < slice.width; sx++) {
      const targetX = targetStartX + sx;
      if (targetX < 0 || targetX >= destGrid.width) continue;
      if (symbolsGrid.get(slice.x + sx, slice.y + sy)) {
        destGrid.set(targetX, targetY, 1);
      }
    }
  }
  return true;
}

/**
 * Accurately measures the visual pixel ink extent of a text string based on font glyphs/mappings.
 * Each character advances by its advanceX, and the final visual boundary reflects the maximum ink extent.
 */
export function measureTextWidth(
  str: string,
  fontGlyphs?: FontGlyph[],
  fontMappings?: FontCharMapping[],
  size: 'small' | 'big' | 'both' = 'small'
): number {
  if (!str) return 0;
  const effectiveSize = size === 'big' ? 'big' : 'small';
  let curX = 0;
  let maxX = 0;

  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (char === ' ') {
      curX += effectiveSize === 'big' ? 6 : 4;
      if (curX > maxX) {
        maxX = curX;
      }
      continue;
    }

    let glyphWidth = effectiveSize === 'big' ? 6 : 4;
    let advanceX = effectiveSize === 'big' ? 7 : 5;
    let found = false;

    // 1. Try fontMappings
    if (fontMappings && fontMappings.length > 0) {
      let m = fontMappings.find(item => item.chars.includes(char));
      if (!m) {
        m = fontMappings.find(item => item.chars.toUpperCase().includes(char.toUpperCase()));
      }
      const slot = m ? (effectiveSize === 'big' ? (m.big || m.small) : (m.small || m.big)) : null;
      if (slot) {
        glyphWidth = slot.width;
        advanceX = slot.advanceX ?? (slot.width + 1);
        found = true;
      }
    }

    // 2. Try fontGlyphs
    if (!found && fontGlyphs && fontGlyphs.length > 0) {
      const cpDirect = char.codePointAt(0) || 0;
      const cpUpper = char.toUpperCase().codePointAt(0) || 0;
      const glyph = fontGlyphs.find(g => g.codepoint === cpDirect || g.codepoint === cpUpper);
      if (glyph) {
        glyphWidth = glyph.width;
        advanceX = glyph.advanceX;
        found = true;
      }
    }

    // 3. Fallback to 3x5 punctuation bitmap
    if (!found) {
      const punct = PUNCTUATION_3X5[char];
      if (punct) {
        const scale = effectiveSize === 'big' ? 2 : 1;
        glyphWidth = 3 * scale;
        advanceX = 3 * scale + 1;
        found = true;
      }
    }

    // 4. Fallback character metrics if atlas/glyphs not yet loaded
    if (!found) {
      const upperChar = char.toUpperCase();
      if (['M', 'W', 'Y', 'T', 'V'].includes(upperChar)) {
        glyphWidth = 5;
        advanceX = 6;
      } else if (['I', '1'].includes(upperChar)) {
        glyphWidth = 3;
        advanceX = 4;
      } else {
        glyphWidth = 4;
        advanceX = 5;
      }
    }

    const extent = curX + glyphWidth;
    if (extent > maxX) {
      maxX = extent;
    }
    curX += advanceX;
  }

  return maxX > 0 ? maxX : curX;
}

export interface DrawTextOptions {
  align?: 'left' | 'center' | 'right';
  boxWidth?: number;
  boxHeight?: number;
  verticalAlign?: 'top' | 'middle' | 'bottom';
  clipRect?: { minX: number; minY: number; maxX: number; maxY: number };
  pixelFilter?: (x: number, y: number) => boolean;
}

/**
 * Utility to draw text using fontMappings or fontGlyphs into destGrid at (startX, startY).
 * Falls back to 3x5 punctuation bitmaps when punctuation symbols are missing from the font atlas.
 * When options are provided, supports horizontal alignment (left / center / right) and vertical alignment (middle by default).
 */
export function drawText(
  destGrid: BwpxGrid,
  fontGrid: BwpxGrid,
  fontGlyphs: FontGlyph[] | undefined,
  fontMappings: FontCharMapping[] | undefined,
  str: string,
  startX: number,
  startY: number,
  size: 'small' | 'big' | 'both' = 'small',
  options?: DrawTextOptions
): number {
  if (!str) return startX;
  const effectiveSize = size === 'big' ? 'big' : 'small';

  let originX = startX;
  let originY = startY;

  if (options) {
    const textW = measureTextWidth(str, fontGlyphs, fontMappings, effectiveSize);
    const textH = effectiveSize === 'big' ? 10 : 5;
    const boxW = options.boxWidth ?? textW;
    const boxH = options.boxHeight ?? textH;
    const align = options.align ?? 'center';
    const vAlign = options.verticalAlign ?? 'middle';

    if (align === 'right') {
      originX = startX + (boxW - textW);
    } else if (align === 'center') {
      originX = startX + Math.floor((boxW - textW) / 2);
    }

    if (boxH > textH && vAlign === 'middle') {
      originY = startY + Math.floor((boxH - textH) / 2);
    } else if (boxH > textH && vAlign === 'bottom') {
      originY = startY + (boxH - textH);
    }
  }

  let curX = originX;

  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (char === ' ') {
      curX += effectiveSize === 'big' ? 6 : 4;
      continue;
    }

    let rendered = false;

    // 1. Try fontMappings first
    if (fontMappings && fontMappings.length > 0) {
      let m = fontMappings.find(item => item.chars.includes(char));
      if (!m) {
        m = fontMappings.find(item => item.chars.toUpperCase().includes(char.toUpperCase()));
      }
      const slot = m ? (effectiveSize === 'big' ? (m.big || m.small) : (m.small || m.big)) : null;
      if (slot) {
        for (let gy = 0; gy < slot.height; gy++) {
          const targetY = originY + gy;
          if (targetY < 0 || targetY >= destGrid.height) continue;
          if (options?.clipRect && (targetY < options.clipRect.minY || targetY >= options.clipRect.maxY)) continue;
          for (let gx = 0; gx < slot.width; gx++) {
            const targetX = curX + gx;
            if (targetX < 0 || targetX >= destGrid.width) continue;
            if (options?.clipRect && (targetX < options.clipRect.minX || targetX >= options.clipRect.maxX)) continue;
            if (fontGrid.get(slot.x + gx, slot.y + gy)) {
              if (!options?.pixelFilter || options.pixelFilter(targetX, targetY)) {
                destGrid.set(targetX, targetY, 1);
              }
            }
          }
        }
        curX += slot.advanceX ?? (slot.width + 1);
        rendered = true;
      }
    }

    if (rendered) continue;

    // 2. Try fontGlyphs (check exact codepoint first, then uppercase codepoint)
    const cpDirect = char.codePointAt(0) || 0;
    const cpUpper = char.toUpperCase().codePointAt(0) || 0;
    const glyph = fontGlyphs?.find(g => g.codepoint === cpDirect || g.codepoint === cpUpper);
    if (glyph) {
      for (let gy = 0; gy < glyph.height; gy++) {
        const targetY = originY + gy;
        if (targetY < 0 || targetY >= destGrid.height) continue;
        if (options?.clipRect && (targetY < options.clipRect.minY || targetY >= options.clipRect.maxY)) continue;
        for (let gx = 0; gx < glyph.width; gx++) {
          const targetX = curX + gx;
          if (targetX < 0 || targetX >= destGrid.width) continue;
          if (options?.clipRect && (targetX < options.clipRect.minX || targetX >= options.clipRect.maxX)) continue;
          if (fontGrid.get(glyph.x + gx, glyph.y + gy)) {
            if (!options?.pixelFilter || options.pixelFilter(targetX, targetY)) {
              destGrid.set(targetX, targetY, 1);
            }
          }
        }
      }
      curX += glyph.advanceX;
      rendered = true;
    }

    if (rendered) continue;

    // 3. Fallback to 3x5 punctuation bitmap
    const punct = PUNCTUATION_3X5[char];
    if (punct) {
      const scale = effectiveSize === 'big' ? 2 : 1;
      for (let gy = 0; gy < 5; gy++) {
        const row = punct[gy];
        for (let gx = 0; gx < 3; gx++) {
          if ((row >> (2 - gx)) & 1) {
            for (let sy = 0; sy < scale; sy++) {
              const targetY = originY + gy * scale + sy;
              if (targetY < 0 || targetY >= destGrid.height) continue;
              if (options?.clipRect && (targetY < options.clipRect.minY || targetY >= options.clipRect.maxY)) continue;
              for (let sx = 0; sx < scale; sx++) {
                const targetX = curX + gx * scale + sx;
                if (targetX < 0 || targetX >= destGrid.width) continue;
                if (options?.clipRect && (targetX < options.clipRect.minX || targetX >= options.clipRect.maxX)) continue;
                if (!options?.pixelFilter || options.pixelFilter(targetX, targetY)) {
                  destGrid.set(targetX, targetY, 1);
                }
              }
            }
          }
        }
      }
      curX += 3 * scale + 1;
      rendered = true;
    }

    if (!rendered) {
      curX += effectiveSize === 'big' ? 6 : 4;
    }
  }

  return curX;
}

/**
 * Replaces dynamic template variables like {battery}, {layerName}, {wpm}, {output}, {split}
 */
export function interpolateTemplate(template: string, context: WidgetRenderContext): string {
  if (template === undefined || template === null) return '';
  const str = String(template);
  if (!str) return '';

  const batteryVal = context.battery ?? 80;
  const currentLayer = Math.max(0, context.currentLayer ?? 0);
  const layerNames = context.layerNames ?? ['DEFAULT', 'LOWER', 'RAISE', 'ADJUST'];
  const layerName = layerNames[currentLayer] || `L${currentLayer}`;
  const wpmVal = Math.min(999, Math.max(0, context.wpm ?? 60));
  const outputMode = (context.outputMode ?? 'usb').toUpperCase();
  const splitStatus = (context.splitConnected ?? true) ? 'OK' : 'NC';
  const customText = context.customText || 'ZMK';

  return str
    .replace(/{batt(?:ery)?}/gi, String(batteryVal))
    .replace(/{layer_?name}/gi, layerName)
    .replace(/{layer}/gi, String(currentLayer))
    .replace(/{wpm}/gi, String(wpmVal))
    .replace(/{output}/gi, outputMode)
    .replace(/{split}/gi, splitStatus)
    .replace(/{customText}/gi, customText);
}

export interface RenderSlotResult {
  rendered: boolean;
  mode: SlotSourceType;
  isMissingSymbol?: boolean;
  text?: string;
  symbolId?: string;
}

/**
 * Dynamically resolves and renders a widget slot based on user customization or default configuration.
 * - Text mode: renders template-replaced text and suppresses any graphic fill bars so text is not corrupted.
 * - Symbol mode: resolves slice by ID. If slice exists, blits it.
 * - If slice was deleted or missing: gracefully falls back to fallbackText or a 1px dashed placeholder with centered '?'.
 */
export function renderSlot(
  destGrid: BwpxGrid,
  destX: number,
  destY: number,
  widgetId: string,
  slotId: string,
  context: WidgetRenderContext,
  fallbackBounds?: { width?: number; height?: number },
  fontSize: 'small' | 'big' | 'both' = 'small'
): RenderSlotResult {
  const widget = getWidgetDefinition(widgetId);
  const normWidgetId = widget?.id || normalizeWidgetType(widgetId);
  const slotDef: WidgetSlotDefinition | undefined = widget?.slots.find(s => s.id === slotId);

  let customConfig: WidgetSlotConfig | undefined;
  if (context.activeInstanceId && context.instances?.[normWidgetId]) {
    const inst = context.instances[normWidgetId].find(i => i.id === context.activeInstanceId);
    if (inst) {
      customConfig = inst.slots?.[slotId];
    }
  }
  if (!customConfig && context.customizations?.[normWidgetId]?.[slotId]) {
    customConfig = context.customizations[normWidgetId][slotId];
  }

  const mode: SlotSourceType = customConfig?.mode || slotDef?.defaultMode || 'symbol';

  if (mode === 'text') {
    const rawText = customConfig?.text !== undefined ? customConfig.text : (slotDef?.defaultText ?? '');
    const interpolated = interpolateTemplate(rawText, context);
    const maxLen = slotDef?.maxTextLength ?? 12;
    const finalText = interpolated.slice(0, maxLen);
    const boxW = fallbackBounds?.width;
    const boxH = fallbackBounds?.height;

    drawText(destGrid, context.fontGrid, context.fontGlyphs, context.fontMappings, finalText, destX, destY, fontSize, { align: 'center', boxWidth: boxW, boxHeight: boxH, verticalAlign: 'middle' });
    return { rendered: true, mode: 'text', text: finalText };
  }

  // Symbol mode
  const targetSymbolId = customConfig?.symbolId || slotDef?.defaultSymbolId || '';
  const sliceExists = targetSymbolId ? context.symbolSlices.some(s => s.id === targetSymbolId) : false;

  if (sliceExists) {
    blitSlice(destGrid, context.symbolsGrid, context.symbolSlices, targetSymbolId, destX, destY, fallbackBounds?.width, fallbackBounds?.height);
    return { rendered: true, mode: 'symbol', symbolId: targetSymbolId };
  }

  // Symbol missing or deleted: graceful fallback
  if (slotDef?.fallbackText) {
    const fallbackText = interpolateTemplate(slotDef.fallbackText, context);
    const boxW = fallbackBounds?.width;
    const boxH = fallbackBounds?.height;
    drawText(destGrid, context.fontGrid, context.fontGlyphs, context.fontMappings, fallbackText, destX, destY, fontSize, { align: 'center', boxWidth: boxW, boxHeight: boxH, verticalAlign: 'middle' });
    return { rendered: true, mode: 'symbol', isMissingSymbol: true, text: fallbackText };
  }

  // Render 1px dashed placeholder box with centered '?'
  const width = fallbackBounds?.width ?? 14;
  const height = fallbackBounds?.height ?? 10;

  for (let x = 0; x < width; x++) {
    if (x % 2 === 0) {
      const tx = destX + x;
      if (tx >= 0 && tx < destGrid.width) {
        if (destY >= 0 && destY < destGrid.height) destGrid.set(tx, destY, 1);
        if (destY + height - 1 >= 0 && destY + height - 1 < destGrid.height) {
          destGrid.set(tx, destY + height - 1, 1);
        }
      }
    }
  }

  for (let y = 0; y < height; y++) {
    if (y % 2 === 0) {
      const ty = destY + y;
      if (ty >= 0 && ty < destGrid.height) {
        if (destX >= 0 && destX < destGrid.width) destGrid.set(destX, ty, 1);
        if (destX + width - 1 >= 0 && destX + width - 1 < destGrid.width) {
          destGrid.set(destX + width - 1, ty, 1);
        }
      }
    }
  }

  const qX = destX + Math.max(0, Math.floor((width - 3) / 2));
  const qY = destY + Math.max(0, Math.floor((height - 5) / 2));
  drawText(destGrid, context.fontGrid, context.fontGlyphs, context.fontMappings, '?', qX, qY, 'small');

  return { rendered: true, mode: 'symbol', isMissingSymbol: true };
}

/**
 * Unified Display Widget Registry organized into 3 Clean Tiers:
 * - Tier 1: Atomic Status Pills
 * - Tier 2: Keymap & Typing Metrics
 * - Tier 3: Mascots & Screensavers
 */

export const WIDGET_REGISTRY: DisplayWidgetDefinition[] = [
  {
    id: 'battery',
    name: 'Battery Meter',
    category: 'status',
    tier: 1,
    description: 'Dynamic battery meter using symbol interpolation or custom text divisions.',
    defaultWidth: 17,
    minWidth: 14,
    maxWidth: 32,
    defaultHeight: 10,
    minHeight: 8,
    maxHeight: 18,
    icon: 'battery',
    associatedSliceIds: ['SYMBOL_BATTERY_FRAME'],
    defaultPlacement: { side: 'both', defaultX: 7, defaultY: 4 },
    slots: [],
    render: (grid, destX, destY, ctx) => {
      const battery = ctx.battery ?? 80;
      const inst = resolveWidgetInstance(ctx.instances, 'battery', ctx.activeInstanceId);
      const mode = inst?.config?.mode || 'symbol';
      const boxW = ctx.blockWidth;
      const boxH = ctx.blockHeight;
      
      if (mode === 'symbol') {
        const groupId = inst?.config?.groupId;
        const groupMembers = ctx.symbolSlices.filter(s => s.groupId === groupId).sort((a, b) => a.groupOrder - b.groupOrder);
        if (groupMembers.length >= 2) {
          const idx = Math.min(groupMembers.length - 1, Math.floor((battery / 100) * groupMembers.length));
          const slice = groupMembers[idx];
          blitSlice(grid, ctx.symbolsGrid, ctx.symbolSlices, slice.id, destX, destY, boxW, boxH);
        } else {
          // fallback
          renderSlot(grid, destX, destY, 'battery', 'fallback', ctx, { width: boxW, height: boxH });
        }
      } else {
        const divCount = inst?.config?.fontDivisionCount || 2;
        const entries = inst?.config?.textEntries || [];
        const idx = Math.min(divCount - 1, Math.floor((battery / 100) * divCount));
        const text = entries[idx] || `${battery}%`;
        const fontSize = inst?.config?.fontSize || 'small';
        const textAlign = inst?.config?.textAlign || 'center';
        drawText(grid, ctx.fontGrid, ctx.fontGlyphs, ctx.fontMappings, text, destX, destY, fontSize, { align: textAlign, boxWidth: boxW, boxHeight: boxH, verticalAlign: 'middle' });
      }
    },
  },
  {
    id: 'connection',
    name: 'Output Status',
    category: 'status',
    tier: 1,
    requiresMaster: true,
    description: 'Active keystroke output: USB cable symbol or Bluetooth profile (P1-P5).',
    defaultWidth: 12,
    minWidth: 8,
    maxWidth: 32,
    defaultHeight: 10,
    minHeight: 8,
    maxHeight: 18,
    icon: 'wifi',
    associatedSliceIds: ['SYMBOL_USB', 'SYMBOL_BLUETOOTH'],
    defaultPlacement: { side: 'central', defaultX: 10, defaultY: 0 },
    slots: [],
    render: (grid, destX, destY, ctx) => {
      const inst = resolveWidgetInstance(ctx.instances, 'connection', ctx.activeInstanceId);
      const mode = inst?.config?.mode || 'symbol';
      const isBle = ctx.outputMode === 'ble';
      const boxW = ctx.blockWidth;
      const boxH = ctx.blockHeight;
      
      if (mode === 'symbol') {
        const resolveSliceForGroup = (gid: string | undefined): SpriteSlice | undefined => {
          if (!gid) return undefined;
          let members = ctx.symbolSlices.filter(s => s.groupId === gid).sort((a, b) => (a.groupOrder || 1) - (b.groupOrder || 1));
          if (members.length === 0) {
            members = ctx.symbolSlices.filter(s => s.groupId?.toLowerCase() === gid.toLowerCase()).sort((a, b) => (a.groupOrder || 1) - (b.groupOrder || 1));
          }
          if (members.length === 0) {
            const direct = ctx.symbolSlices.find(s => s.id === gid || s.name === gid);
            if (direct) return direct;
            return undefined;
          }
          if (members.length === 1) {
            return members[0];
          }
          const speed = 500;
          const tick = Math.floor((ctx.animationTimestamp ?? Date.now()) / speed) % members.length;
          return members[tick];
        };

        if (!isBle) {
          const targetSlice = resolveSliceForGroup(inst?.config?.groupId || 'SYMBOL_USB');
          if (targetSlice) {
            blitSlice(grid, ctx.symbolsGrid, ctx.symbolSlices, targetSlice.id, destX, destY, boxW, boxH);
          } else {
            renderSlot(grid, destX, destY, 'connection', 'fallback', ctx, { width: boxW, height: boxH });
          }
        } else {
          const profileIdx = ctx.bleProfileIndex ?? 1;
          const state = ctx.bleState || (profileIdx === 0 ? 'disconnected' : 'connected');
          
          let targetSlice: SpriteSlice | undefined;

          if (profileIdx === 0 || state === 'disconnected') {
            targetSlice = resolveSliceForGroup(inst?.config?.groupIds?.[0] || 'SYMBOL_NO_CONN');
          } else if (state === 'reconnecting') {
            const letter = String.fromCharCode(64 + profileIdx);
            targetSlice = resolveSliceForGroup(inst?.config?.reconnectGroupIds?.[profileIdx - 1] || `GROUP_BT_RECONNECT_${letter}`);
            if (!targetSlice) {
              targetSlice = resolveSliceForGroup(`SYMBOL_RECONNECTING_${letter}`);
            }
            if (!targetSlice) {
              targetSlice = resolveSliceForGroup(inst?.config?.groupIds?.[profileIdx] || inst?.config?.groupIds?.[1] || inst?.config?.groupId);
            }
          } else if (state === 'pairing') {
            const letter = String.fromCharCode(64 + profileIdx);
            targetSlice = resolveSliceForGroup(inst?.config?.pairingGroupIds?.[profileIdx - 1] || `GROUP_BT_PAIR_${letter}`);
            if (!targetSlice) {
              targetSlice = resolveSliceForGroup('SYMBOL_BLUETOOTH_9659');
            }
            if (!targetSlice) {
              targetSlice = resolveSliceForGroup(inst?.config?.groupIds?.[profileIdx] || inst?.config?.groupIds?.[1] || inst?.config?.groupId);
            }
          } else if (state === 'handshake') {
            const letter = String.fromCharCode(64 + profileIdx);
            targetSlice = resolveSliceForGroup(inst?.config?.handshakeGroupIds?.[profileIdx - 1] || `SYMBOL_HANDSHAKE_${letter}`);
            if (!targetSlice) {
              targetSlice = resolveSliceForGroup(inst?.config?.groupIds?.[profileIdx] || inst?.config?.groupIds?.[1] || inst?.config?.groupId);
            }
          } else {
            // Connected (default)
            targetSlice = resolveSliceForGroup(inst?.config?.groupIds?.[profileIdx] || inst?.config?.groupIds?.[1] || inst?.config?.groupId);
          }

          if (targetSlice) {
            blitSlice(grid, ctx.symbolsGrid, ctx.symbolSlices, targetSlice.id, destX, destY, boxW, boxH);
          } else {
            renderSlot(grid, destX, destY, 'connection', 'fallback', ctx, { width: boxW, height: boxH });
          }
        }
      } else {
        const fontSize = inst?.config?.fontSize || 'small';
        const textAlign = inst?.config?.textAlign || 'center';
        if (!isBle) {
          const text = inst?.config?.textEntries?.[0] || 'USB';
          drawText(grid, ctx.fontGrid, ctx.fontGlyphs, ctx.fontMappings, text, destX, destY, fontSize, { align: textAlign, boxWidth: boxW, boxHeight: boxH, verticalAlign: 'middle' });
        } else {
          const profileIdx = ctx.bleProfileIndex ?? 1;
          const state = ctx.bleState || (profileIdx === 0 ? 'disconnected' : 'connected');
          const entries = inst?.config?.textEntries || ['USB', 'No conn', 'P1', 'P2', 'P3', 'P4', 'P5'];
          let text = profileIdx === 0 || state === 'disconnected'
            ? (entries[1] || 'No conn')
            : (entries[profileIdx + 1] || entries[profileIdx] || `P${profileIdx}`);
          if (state === 'reconnecting') {
            text += '..';
          } else if (state === 'pairing') {
            text += '+';
          }
          drawText(grid, ctx.fontGrid, ctx.fontGlyphs, ctx.fontMappings, text, destX, destY, fontSize, { align: textAlign, boxWidth: boxW, boxHeight: boxH, verticalAlign: 'middle' });
        }
      }
    },
  },
  {
    id: 'split',
    name: 'Split Peripheral Link',
    category: 'status',
    tier: 1,
    description: 'Wireless link status indicator between master and peripheral keyboard halves.',
    defaultWidth: 13,
    minWidth: 10,
    maxWidth: 32,
    defaultHeight: 9,
    minHeight: 8,
    maxHeight: 18,
    icon: 'link',
    associatedSliceIds: ['SYMBOL_SPLIT_CONNECTED'],
    defaultPlacement: { side: 'both', defaultX: 9, defaultY: 114 },
    slots: [],
    render: (grid, destX, destY, ctx) => {
      const inst = resolveWidgetInstance(ctx.instances, 'split', ctx.activeInstanceId);
      const mode = inst?.config?.mode || 'symbol';
      const isConnected = ctx.splitConnected ?? true;
      const boxW = ctx.blockWidth;
      const boxH = ctx.blockHeight;
      
      if (mode === 'symbol') {
        const groupId = inst?.config?.groupId;
        const groupMembers = ctx.symbolSlices.filter(s => s.groupId === groupId).sort((a, b) => a.groupOrder - b.groupOrder);
        const slice = groupMembers.length >= 2 ? (isConnected ? groupMembers[0] : groupMembers[1]) : null;
        if (slice) {
          blitSlice(grid, ctx.symbolsGrid, ctx.symbolSlices, slice.id, destX, destY, boxW, boxH);
        } else {
          renderSlot(grid, destX, destY, 'split', 'fallback', ctx, { width: boxW, height: boxH });
        }
      } else {
        const entries = inst?.config?.textEntries || ['Connected', 'Not connected'];
        const text = isConnected ? entries[0] : entries[1] || 'Not connected';
        const fontSize = inst?.config?.fontSize || 'small';
        const textAlign = inst?.config?.textAlign || 'center';
        drawText(grid, ctx.fontGrid, ctx.fontGlyphs, ctx.fontMappings, text, destX, destY, fontSize, { align: textAlign, boxWidth: boxW, boxHeight: boxH, verticalAlign: 'middle' });
      }
    },
  },
  {
    id: 'caps-lock',
    name: 'Caps Lock Indicator',
    category: 'status',
    tier: 1,
    requiresMaster: true,
    description: 'Caps lock indicator pill or [CAPS] text indicator.',
    defaultWidth: 14,
    minWidth: 10,
    maxWidth: 32,
    defaultHeight: 7,
    minHeight: 6,
    maxHeight: 14,
    icon: 'activity',
    associatedSliceIds: [],
    defaultPlacement: { side: 'central', defaultX: 9, defaultY: 14 },
    slots: [],
    render: (grid, destX, destY, ctx) => {
      const inst = resolveWidgetInstance(ctx.instances, 'caps-lock', ctx.activeInstanceId);
      const mode = inst?.config?.mode || 'font';
      const isOn = ctx.capsLock ?? false;
      const boxW = ctx.blockWidth;
      const boxH = ctx.blockHeight;
      
      if (mode === 'symbol') {
        const groupId = inst?.config?.groupId;
        const groupMembers = ctx.symbolSlices.filter(s => s.groupId === groupId).sort((a, b) => a.groupOrder - b.groupOrder);
        const slice = groupMembers.length >= 2 ? (isOn ? groupMembers[0] : groupMembers[1]) : null;
        if (slice) {
          blitSlice(grid, ctx.symbolsGrid, ctx.symbolSlices, slice.id, destX, destY, boxW, boxH);
        } else {
          renderSlot(grid, destX, destY, 'caps-lock', 'fallback', ctx, { width: boxW, height: boxH });
        }
      } else {
        const entries = inst?.config?.textEntries || ['On', 'Off'];
        const text = isOn ? entries[0] : entries[1] || 'Off';
        const fontSize = inst?.config?.fontSize || 'small';
        const textAlign = inst?.config?.textAlign || 'center';
        drawText(grid, ctx.fontGrid, ctx.fontGlyphs, ctx.fontMappings, text, destX, destY, fontSize, { align: textAlign, boxWidth: boxW, boxHeight: boxH, verticalAlign: 'middle' });
      }
    },
  },
  {
    id: 'layer-banner',
    name: 'Layer Banner',
    category: 'layer',
    tier: 2,
    requiresMaster: true,
    isInteractive: true,
    description: 'Shows active keyboard layer frame brackets and text name.',
    defaultWidth: 24,
    minWidth: 18,
    maxWidth: 32,
    defaultHeight: 12,
    minHeight: 10,
    maxHeight: 20,
    icon: 'layers',
    associatedSliceIds: ['SYMBOL_BRACKET_LAYER_0'],
    defaultPlacement: { side: 'both', defaultX: 4, defaultY: 22 },
    slots: [],
    render: (grid, destX, destY, ctx) => {
      const inst = resolveWidgetInstance(ctx.instances, 'layer-banner', ctx.activeInstanceId);
      const mode = inst?.config?.mode || 'symbol';
      const layer = ctx.currentLayer ?? 0;
      const boxW = ctx.blockWidth;
      const boxH = ctx.blockHeight;
      
      if (mode === 'symbol') {
        const groupId = inst?.config?.groupIds?.[layer];
        const slice = ctx.symbolSlices.find(s => s.groupId === groupId && s.groupOrder === 1);
        if (slice) {
          blitSlice(grid, ctx.symbolsGrid, ctx.symbolSlices, slice.id, destX, destY, boxW, boxH);
        } else {
          renderSlot(grid, destX, destY, 'layer-banner', 'fallback', ctx, { width: boxW, height: boxH });
        }
      } else {
        const textFromEntries = inst?.config?.textEntries?.[layer];
        const textFromContext = ctx.layerNames?.[layer];
        const defaultLayers = ['DEFAULT', 'LOWER', 'RAISE', 'ADJUST'];
        const text = textFromEntries || textFromContext || defaultLayers[layer] || `L${layer}`;
        const fontSize = inst?.config?.fontSize || 'small';
        const textAlign = inst?.config?.textAlign || 'center';
        drawText(grid, ctx.fontGrid, ctx.fontGlyphs, ctx.fontMappings, text, destX, destY, fontSize, { align: textAlign, boxWidth: boxW, boxHeight: boxH, verticalAlign: 'middle' });
      }
    },
  },
  {
    id: 'wpm',
    name: 'WPM Meter',
    category: 'typing',
    tier: 2,
    requiresMaster: true,
    isInteractive: true,
    description: 'Typing speed readout interpolating up to a target.',
    defaultWidth: 28,
    minWidth: 8,
    maxWidth: 32,
    defaultHeight: 10,
    minHeight: 5,
    maxHeight: 28,
    icon: 'gauge',
    associatedSliceIds: ['SYMBOL_ARROW_HEAD'],
    defaultPlacement: { side: 'central', defaultX: 2, defaultY: 85 },
    slots: [],
    render: (grid, destX, destY, ctx) => {
      const inst = resolveWidgetInstance(ctx.instances, 'wpm', ctx.activeInstanceId);
      const mode = inst?.config?.mode || 'symbol';
      const wpmVal = Math.min(999, Math.max(0, ctx.wpm ?? 65));
      const target = inst?.config?.targetValue || 100;
      const progress = Math.min(1, Math.max(0, wpmVal / target));
      const boxW = ctx.blockWidth;
      const boxH = ctx.blockHeight;
      
      if (mode === 'symbol') {
        const groupId = inst?.config?.groupId;
        const groupMembers = ctx.symbolSlices.filter(s => s.groupId === groupId).sort((a, b) => a.groupOrder - b.groupOrder);
        if (groupMembers.length >= 2) {
          const idx = Math.min(groupMembers.length - 1, Math.floor(progress * groupMembers.length));
          const slice = groupMembers[idx];
          blitSlice(grid, ctx.symbolsGrid, ctx.symbolSlices, slice.id, destX, destY, boxW, boxH);
        } else {
          renderSlot(grid, destX, destY, 'wpm', 'fallback', ctx, { width: boxW, height: boxH });
        }
      } else {
        const divCount = inst?.config?.fontDivisionCount || 2;
        const entries = inst?.config?.textEntries || [];
        const idx = Math.min(divCount - 1, Math.floor(progress * divCount));
        const text = entries[idx] || `${wpmVal}`;
        const fontSize = inst?.config?.fontSize || 'small';
        const textAlign = inst?.config?.textAlign || 'center';
        drawText(grid, ctx.fontGrid, ctx.fontGlyphs, ctx.fontMappings, text, destX, destY, fontSize, { align: textAlign, boxWidth: boxW, boxHeight: boxH, verticalAlign: 'middle' });
      }
    },
  },
  {
    id: 'branding',
    name: 'Text',
    category: 'art',
    tier: 3,
    description: 'Custom username, keyboard name, or model banner text.',
    defaultWidth: 14,
    minWidth: 4,
    maxWidth: 32,
    defaultHeight: 5,
    minHeight: 5,
    maxHeight: 20,
    icon: 'type',
    associatedSliceIds: [],
    defaultPlacement: { side: 'both', defaultX: 0, defaultY: 73 },
    slots: [],
    render: (grid, destX, destY, ctx) => {
      const inst = resolveWidgetInstance(ctx.instances, 'branding', ctx.activeInstanceId) || ctx.instances?.['branding']?.[0];
      const customCfg = ctx.customizations?.['branding']?.['brand-text'];
      const rawText = inst?.config?.textEntries?.[0] !== undefined
        ? inst.config.textEntries[0]
        : (customCfg?.text !== undefined ? customCfg.text : (ctx.customText || 'ZMK'));
      const text = (interpolateTemplate(rawText, ctx) || 'ZMK').toUpperCase();
      const fontSize = inst?.config?.fontSize || 'small';
      const textAlign = inst?.config?.textAlign || 'center';
      const boxW = ctx.blockWidth;
      const boxH = ctx.blockHeight;
      drawText(grid, ctx.fontGrid, ctx.fontGlyphs, ctx.fontMappings, text, destX, destY, fontSize, { align: textAlign, boxWidth: boxW, boxHeight: boxH, verticalAlign: 'middle' });
    },
  },
  {
    id: 'wpm-chart',
    name: 'WPM Chart',
    category: 'typing',
    tier: 2,
    requiresMaster: true,
    isInteractive: true,
    description: 'Line chart widget of typing speed over time.',
    defaultWidth: 32,
    minWidth: 16,
    maxWidth: 68,
    defaultHeight: 24,
    minHeight: 12,
    maxHeight: 64,
    icon: 'activity',
    associatedSliceIds: [],
    defaultPlacement: { side: 'central', defaultX: 0, defaultY: 85 },
    slots: [],
    render: (grid, destX, destY, ctx) => {
      const inst = ctx.instances?.['wpm-chart']?.find(i => i.id === ctx.activeInstanceId);
      const conf = inst?.config?.wpmChart || { width: 32, height: 24, gridSize: 4, targetSpeed: 100, timeWindow: 30 };
      const rawWidth = ctx.blockWidth ?? conf.width ?? 32;
      const rawHeight = ctx.blockHeight ?? conf.height ?? 24;
      const width = Math.min(rawWidth, grid.width - destX);
      const height = Math.min(rawHeight, grid.height - destY);
      const gridSize = conf.gridSize ?? 4;
      const targetSpeed = conf.targetSpeed ?? 100;
      const timeWindow = conf.timeWindow ?? 30;

      // Outer border and grid
      if (gridSize > 0) {
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const isBorder = x === 0 || x === width - 1 || y === 0 || y === height - 1;
            const isGridPoint = (x % gridSize === 0) && (y % gridSize === 0);
            if (isBorder || isGridPoint) {
              const targetX = destX + x;
              const targetY = destY + y;
              if (targetX >= 0 && targetX < grid.width && targetY >= 0 && targetY < grid.height) {
                grid.set(targetX, targetY, 1);
              }
            }
          }
        }
      }

      const chartX = destX + (gridSize > 0 ? 1 : 0);
      const chartY = destY + (gridSize > 0 ? 1 : 0);
      const chartW = width - (gridSize > 0 ? 2 : 0);
      const chartH = height - (gridSize > 0 ? 2 : 0);

      if (chartW <= 1 || chartH <= 1) return;

      // Baseline if no grid
      if (gridSize === 0) {
        for (let x = 0; x < chartW; x++) {
          const targetX = chartX + x;
          const targetY = chartY + chartH - 1;
          if (targetX >= 0 && targetX < grid.width && targetY >= 0 && targetY < grid.height) {
            grid.set(targetX, targetY, 1);
          }
        }
      }

      const currentWpm = Math.min(targetSpeed, Math.max(0, ctx.wpm ?? 65));

      // Build points array of length chartW
      // Rightmost column (chartW - 1) is current speed (NOW)
      // Top row (chartY) is targetSpeed, Bottom row (chartY + chartH - 1) is 0 WPM.
      const points: number[] = new Array(chartW);

      if (ctx.wpmHistory && ctx.wpmHistory.length > 0) {
        const hist = ctx.wpmHistory;
        for (let x = 0; x < chartW; x++) {
          if (x === chartW - 1) {
            points[x] = currentWpm;
          } else {
            const ageInSeconds = ((chartW - 1 - x) * timeWindow) / Math.max(1, chartW - 1);
            const sampleOffset = Math.round(ageInSeconds);
            const histIdx = hist.length - 1 - sampleOffset;
            points[x] = (histIdx >= 0 && histIdx < hist.length) ? hist[histIdx] : 0;
          }
        }
      } else {
        // Synthesize realistic typing pulse history ending exactly at currentWpm
        for (let x = 0; x < chartW; x++) {
          if (x === chartW - 1) {
            points[x] = currentWpm;
          } else {
            const t = x / Math.max(1, chartW - 1);
            // Realistic typing cadence: warm-up, burst rhythm, settling into currentWpm
            const burst1 = Math.sin(t * 5.5);
            const burst2 = Math.cos(t * 11.0) * 0.3;
            const cadence = Math.max(0, 0.45 + 0.4 * burst1 + burst2);
            const ramp = 0.3 + 0.7 * t;
            const val = Math.round(currentWpm * cadence * ramp);
            points[x] = Math.min(targetSpeed, Math.max(0, val));
          }
        }
      }

      // Draw continuous connected heartbeat / oscilloscope line
      let prevY = -1;
      for (let x = 0; x < chartW; x++) {
        const val = Math.min(targetSpeed, Math.max(0, points[x]));
        const yPlot = chartY + chartH - 1 - Math.round((val * (chartH - 1)) / targetSpeed);

        if (prevY !== -1) {
          const minY = Math.min(prevY, yPlot);
          const maxY = Math.max(prevY, yPlot);
          for (let y = minY; y <= maxY; y++) {
            if (chartX + x >= 0 && chartX + x < grid.width && y >= 0 && y < grid.height) {
              grid.set(chartX + x, y, 1);
            }
          }
        } else {
          if (chartX + x >= 0 && chartX + x < grid.width && yPlot >= 0 && yPlot < grid.height) {
            grid.set(chartX + x, yPlot, 1);
          }
        }
        prevY = yPlot;
      }
    },
  },
  {
    id: 'typewriter',
    name: 'Typewriter',
    category: 'typing',
    tier: 2,
    requiresMaster: true,
    isInteractive: true,
    description: 'Displays user typing in real time: inline text stream, single-letter spot, or random placement.',
    defaultWidth: 32,
    minWidth: 4,
    maxWidth: 32,
    defaultHeight: 5,
    minHeight: 4,
    maxHeight: 128,
    icon: 'keyboard',
    associatedSliceIds: [],
    defaultPlacement: { side: 'central', defaultX: 0, defaultY: 70 },
    slots: [],
    render: (grid, destX, destY, ctx) => {
      const inst = resolveWidgetInstance(ctx.instances, 'typewriter', ctx.activeInstanceId);
      const mode: TypewriterMode = (inst?.config?.typewriterMode || (['inline', 'spot', 'random'].includes(inst?.config?.mode as string) ? inst?.config?.mode : undefined) || 'inline') as TypewriterMode;
      const configuredFontSize = inst?.config?.fontSize || (mode === 'random' ? 'both' : 'small');
      const fontSize = (configuredFontSize === 'both') ? 'small' : configuredFontSize;
      const charH = fontSize === 'big' ? 10 : 5;
      const charW = fontSize === 'big' ? 10 : 5;
      const direction: TypewriterDirection = inst?.config?.typewriterDirection || 'we';
      const cleaning = inst?.config?.typewriterCleaning ?? 0;

      const isHorizontal = direction === 'we' || direction === 'ew';
      const boxW = ctx.blockWidth ?? (mode === 'random' || isHorizontal ? (inst?.config?.typewriterWidth ?? 32) : charW);
      const boxH = ctx.blockHeight ?? (mode === 'random' || !isHorizontal ? (inst?.config?.typewriterHeight ?? 32) : charH);

      const rawText = ctx.typewriterText ?? ctx.typewriterState?.text ?? ctx.customText;
      const lastChar = ctx.typewriterState?.lastChar ?? (rawText && rawText.length > 0 ? rawText[rawText.length - 1] : undefined);
      const lastTimestamp = ctx.typewriterState?.lastTimestamp;
      const rawBank = ctx.typewriterState?.letterBank || ctx.typewriterState?.randomLetters || ctx.typewriterState?.randomBank;
      const effectiveLastTimestamp = lastTimestamp ?? (rawBank && rawBank.length > 0 ? rawBank[rawBank.length - 1].timestamp : undefined);
      const now = (effectiveLastTimestamp && effectiveLastTimestamp > 1_000_000_000 && (ctx.animationTimestamp ?? 0) < 1_000_000_000)
        ? Date.now()
        : (ctx.animationTimestamp ?? Date.now());

      const clip = { minX: destX, minY: destY, maxX: destX + boxW, maxY: destY + boxH };

      // Spot mode: shows last letter typed, typing multiple letters overrides last letter, only keep latest
      if (mode === 'spot') {
        const spotCleaningMs = Math.round(cleaning * 1000);
        if (cleaning > 0 && effectiveLastTimestamp && spotCleaningMs > 0 && (now - effectiveLastTimestamp >= spotCleaningMs)) {
          return; // Wiped after idle duration
        }
        const char = lastChar || (rawText ? rawText[rawText.length - 1] : 'A');
        if (!char || char === ' ') return;
        drawText(grid, ctx.fontGrid, ctx.fontGlyphs, ctx.fontMappings, char, destX, destY, fontSize, {
          align: 'center',
          boxWidth: boxW,
          boxHeight: boxH,
          verticalAlign: 'middle',
          clipRect: clip,
        });
        return;
      }

      // Random mode: chooses a random spot for the typed letter, up to bank capacity
      if (mode === 'random') {
        const bankCapacity = Math.max(1, inst?.config?.typewriterBankSize ?? inst?.config?.typewriterLetterBank ?? 20);

        // 1. Resolve candidate bank letters
        let bank: Array<{ char: string; x?: number; y?: number; fontSize?: 'small' | 'big'; timestamp?: number }> = [];

        if (ctx.typewriterState?.letterBank && ctx.typewriterState.letterBank.length > 0) {
          bank = [...ctx.typewriterState.letterBank];
        } else if (ctx.typewriterState?.randomLetters && ctx.typewriterState.randomLetters.length > 0) {
          bank = [...ctx.typewriterState.randomLetters];
        } else if (ctx.typewriterState?.randomBank && ctx.typewriterState.randomBank.length > 0) {
          bank = [...ctx.typewriterState.randomBank];
        } else {
          // Fallback when randomLetters array not directly supplied (e.g. legacy state or single test input)
          if (rawText && rawText.length > 0) {
            const chars = rawText.split('').slice(-bankCapacity);
            bank = chars.map((c, i) => ({
              char: c,
              x: i === chars.length - 1 ? ctx.typewriterState?.randomX : undefined,
              y: i === chars.length - 1 ? ctx.typewriterState?.randomY : undefined,
              timestamp: lastTimestamp,
            }));
          } else if (lastChar && lastChar !== ' ') {
            bank = [{
              char: lastChar,
              x: ctx.typewriterState?.randomX,
              y: ctx.typewriterState?.randomY,
              timestamp: lastTimestamp,
            }];
          }
        }

        // Limit to configured bank capacity (FIFO: most recent)
        if (bank.length > bankCapacity) {
          bank = bank.slice(-bankCapacity);
        }

        // 2. Idle cleaning: auto-remove/fade letters from the bank according to cleaning interval & fade effect
        const fadeType: TypewriterFadeType = inst?.config?.typewriterFadeType || 'instant';
        const fadeTimeSec = inst?.config?.typewriterFadeTime ?? 0.15;
        const fadeMs = fadeType === 'instant' ? 0 : Math.max(0, Math.round(fadeTimeSec * 1000));
        const cleaningMs = Math.round(cleaning * 1000);

        // Detect available font sizes from atlas
        const hasSmall = ctx.fontMappings && ctx.fontMappings.length > 0
          ? ctx.fontMappings.some(m => !!m.small)
          : true;
        const hasBig = ctx.fontMappings && ctx.fontMappings.length > 0
          ? ctx.fontMappings.some(m => !!m.big)
          : (ctx.fontGlyphs && ctx.fontGlyphs.length > 0 ? true : true);

        // 3. Render all letters currently remaining in the bank
        for (let i = 0; i < bank.length; i++) {
          const item = bank[i];
          const char = item.char;
          if (!char || char === ' ') continue;

          let isFading = false;
          let fadeProgress = 0;

          if (cleaning > 0 && effectiveLastTimestamp && cleaningMs > 0) {
            const elapsed = now - effectiveLastTimestamp;
            if (elapsed >= cleaningMs) {
              const tStart = (i + 1) * cleaningMs;
              const tEnd = tStart + fadeMs;

              if (fadeMs <= 0) {
                if (elapsed >= tStart) {
                  continue; // Evicted in instant mode
                }
              } else {
                if (elapsed >= tEnd) {
                  continue; // Evicted after fade completion
                }
                if (elapsed >= tStart) {
                  isFading = true;
                  fadeProgress = Math.min(1.0, Math.max(0.0, (elapsed - tStart) / fadeMs));
                }
              }
            }
          }

          if (isFading) {
            if (fadeProgress >= 1.0) continue;
            if (fadeType === 'blink') {
              // Toggle visibility at high frequency (every 80ms)
              const blinkVisible = Math.floor(now / 80) % 2 === 0;
              if (!blinkVisible) continue;
            }
          }

          let letterSize: 'small' | 'big' = 'small';
          if (configuredFontSize === 'small') {
            letterSize = hasSmall ? 'small' : (hasBig ? 'big' : 'small');
          } else if (configuredFontSize === 'big') {
            letterSize = hasBig ? 'big' : (hasSmall ? 'small' : 'big');
          } else {
            // 'both' (default)
            if (!hasBig) {
              letterSize = 'small';
            } else if (!hasSmall) {
              letterSize = 'big';
            } else if (item.fontSize === 'small' || item.fontSize === 'big') {
              letterSize = item.fontSize;
            } else {
              // Deterministic pseudo-random pick based on char code, index, and timestamp
              const code = char.charCodeAt(0) || 65;
              const pseudoRandomChoice = (((code * 31 + (i + 1) * 17) ^ ((item.timestamp || 0) & 0xff)) & 1) === 0 ? 'small' : 'big';
              letterSize = pseudoRandomChoice;
            }
          }

          const letterCharH = letterSize === 'big' ? 10 : 5;
          const letterW = measureTextWidth(char, ctx.fontGlyphs, ctx.fontMappings, letterSize);
          const maxOffsetX = Math.max(0, boxW - letterW);
          const maxOffsetY = Math.max(0, boxH - letterCharH);

          let offsetX = 0;
          let offsetY = 0;

          if (item.x !== undefined && item.y !== undefined) {
            const hasFloat = (!Number.isInteger(item.x) && item.x >= 0 && item.x <= 1) ||
                             (!Number.isInteger(item.y) && item.y >= 0 && item.y <= 1);
            const isExplicitlyNormalized = (item as any).normalized === true;
            const isNormalized = (typeof item.x === 'number' && typeof item.y === 'number') &&
              (item.x >= 0 && item.x <= 1 && item.y >= 0 && item.y <= 1) &&
              (hasFloat || isExplicitlyNormalized);
            const rx = isNormalized
              ? Math.floor(item.x * (maxOffsetX + 1))
              : item.x;
            const ry = isNormalized
              ? Math.floor(item.y * (maxOffsetY + 1))
              : item.y;
            offsetX = Math.max(0, Math.min(maxOffsetX, rx));
            offsetY = Math.max(0, Math.min(maxOffsetY, ry));
          } else {
            // Deterministic pseudo-random placement based on char code and index using 32-bit integer hash
            const code = char.charCodeAt(0) || 65;
            let h1 = Math.imul(code, 0x9e3779b1) ^ Math.imul(i + 1, 0x85ebca6b);
            h1 = Math.imul(h1 ^ (h1 >>> 16), 0x85ebca6b);
            h1 = Math.imul(h1 ^ (h1 >>> 13), 0xc2b2ae35);
            const rndX = ((h1 ^ (h1 >>> 16)) >>> 0) / 4294967296;

            let h2 = Math.imul(code, 0x85ebca6b) ^ Math.imul(i + 1, 0xc2b2ae35);
            h2 = Math.imul(h2 ^ (h2 >>> 16), 0x85ebca6b);
            h2 = Math.imul(h2 ^ (h2 >>> 13), 0xc2b2ae35);
            const rndY = ((h2 ^ (h2 >>> 16)) >>> 0) / 4294967296;

            offsetX = maxOffsetX > 0 ? Math.floor(rndX * (maxOffsetX + 1)) : 0;
            offsetY = maxOffsetY > 0 ? Math.floor(rndY * (maxOffsetY + 1)) : 0;
          }

          let pixelFilter: ((x: number, y: number) => boolean) | undefined = undefined;

          if (isFading && fadeProgress > 0) {
            if (fadeType === 'dither') {
              pixelFilter = (px: number, py: number) => {
                const bayerVal = (BAYER_4X4[((py % 4) + 4) % 4][((px % 4) + 4) % 4] + 0.5) / 16;
                return bayerVal >= fadeProgress;
              };
            } else if (fadeType === 'dissolve') {
              const seed = (char.charCodeAt(0) || 65) * 31 + (item.timestamp ? (item.timestamp % 10007) : (i * 17));
              pixelFilter = (px: number, py: number) => {
                let h = ((px * 374761393) ^ (py * 668265263) ^ (seed * 1013904223)) + 0x5bf03635;
                h = Math.imul(h ^ (h >>> 13), 1274126177);
                const rnd = ((h ^ (h >>> 16)) >>> 0) / 4294967296;
                return rnd >= fadeProgress;
              };
            }
          }

          drawText(grid, ctx.fontGrid, ctx.fontGlyphs, ctx.fontMappings, char, destX + offsetX, destY + offsetY, letterSize, {
            align: 'left',
            boxWidth: letterW,
            boxHeight: letterCharH,
            verticalAlign: 'top',
            clipRect: clip,
            pixelFilter,
          });
        }
        return;
      }

      // Inline mode: shows text being written in screen like a text
      let displayText = rawText !== undefined ? rawText : 'TYPE...';

      // Auto add space to clean up idle if cleaning is configured
      const inlineCleaningMs = Math.round(cleaning * 1000);
      if (cleaning > 0 && lastTimestamp && inlineCleaningMs > 0 && (now - lastTimestamp >= inlineCleaningMs)) {
        const idleSpaces = Math.floor((now - lastTimestamp) / inlineCleaningMs);
        displayText = displayText + ' '.repeat(idleSpaces);
      }

      if (!displayText || displayText.trim().length === 0) return;

      if (direction === 'we') {
        // West -> East (horizontal LTR): text starts at West (destX) and grows East (right).
        // When total width exceeds boxW, new letters push text to the left so the latest
        // typed characters stay visible at the right edge (destX + boxW), while older characters scroll off left.
        const totalW = measureTextWidth(displayText, ctx.fontGlyphs, ctx.fontMappings, fontSize);
        if (totalW <= boxW) {
          drawText(grid, ctx.fontGrid, ctx.fontGlyphs, ctx.fontMappings, displayText, destX, destY, fontSize, {
            align: 'left',
            boxWidth: boxW,
            boxHeight: boxH,
            verticalAlign: 'middle',
            clipRect: clip,
          });
        } else {
          // Overflow: align right so latest characters stay visible at the right edge, older scroll off left
          drawText(grid, ctx.fontGrid, ctx.fontGlyphs, ctx.fontMappings, displayText, destX, destY, fontSize, {
            align: 'right',
            boxWidth: boxW,
            boxHeight: boxH,
            verticalAlign: 'middle',
            clipRect: clip,
          });
        }
      } else if (direction === 'ew') {
        // East -> West (horizontal RTL): text begins at East (destX + boxW) and advances West (left).
        // Each newly typed letter is placed at the typing front (advancing toward the left).
        // When total text width exceeds boxW, newest characters stay visible at the typing edge (destX),
        // while older characters push off to the right (East) and are clipped.
        const reversed = displayText.split('').reverse().join('');
        const totalW = measureTextWidth(reversed, ctx.fontGlyphs, ctx.fontMappings, fontSize);
        if (totalW <= boxW) {
          drawText(grid, ctx.fontGrid, ctx.fontGlyphs, ctx.fontMappings, reversed, destX, destY, fontSize, {
            align: 'right',
            boxWidth: boxW,
            boxHeight: boxH,
            verticalAlign: 'middle',
            clipRect: clip,
          });
        } else {
          // Overflow: align left so newest characters at the typing front stay visible at destX, older push right
          drawText(grid, ctx.fontGrid, ctx.fontGlyphs, ctx.fontMappings, reversed, destX, destY, fontSize, {
            align: 'left',
            boxWidth: boxW,
            boxHeight: boxH,
            verticalAlign: 'middle',
            clipRect: clip,
          });
        }
      } else if (direction === 'ns') {
        // North -> South (vertical column, top to bottom)
        const stepY = charH + 1;
        const maxChars = Math.max(1, Math.floor((boxH + 1) / stepY));
        const charsToDraw = displayText.length > maxChars
          ? displayText.slice(displayText.length - maxChars)
          : displayText;

        for (let i = 0; i < charsToDraw.length; i++) {
          const ch = charsToDraw[i];
          const charY = destY + i * stepY;
          if (charY + charH > destY + boxH) break;
          drawText(grid, ctx.fontGrid, ctx.fontGlyphs, ctx.fontMappings, ch, destX, charY, fontSize, {
            align: 'center',
            boxWidth: boxW,
            boxHeight: charH,
            verticalAlign: 'top',
            clipRect: clip,
          });
        }
      } else if (direction === 'sn') {
        // South -> North (vertical column, bottom to top): first typed at South (bottom), latest at North (top)
        const stepY = charH + 1;
        const maxChars = Math.max(1, Math.floor((boxH + 1) / stepY));
        const charsToDraw = displayText.length > maxChars
          ? displayText.slice(displayText.length - maxChars)
          : displayText;

        for (let i = 0; i < charsToDraw.length; i++) {
          const ch = charsToDraw[i];
          const charY = destY + boxH - charH - i * stepY;
          if (charY < destY) break;
          drawText(grid, ctx.fontGrid, ctx.fontGlyphs, ctx.fontMappings, ch, destX, charY, fontSize, {
            align: 'center',
            boxWidth: boxW,
            boxHeight: charH,
            verticalAlign: 'top',
            clipRect: clip,
          });
        }
      }
    },
  },
  {
    id: 'keypress',
    name: 'Keypress',
    category: 'typing',
    tier: 2,
    requiresMaster: true,
    isInteractive: true,
    description: 'Displays custom symbols mapped to specific key presses with optional idle symbol fallback.',
    defaultWidth: 16,
    minWidth: 4,
    maxWidth: 32,
    defaultHeight: 16,
    minHeight: 4,
    maxHeight: 128,
    icon: 'keyboard',
    associatedSliceIds: ['SYMBOL_ARROW_UP', 'SYMBOL_ARROW_DOWN', 'SYMBOL_ARROW_LEFT', 'SYMBOL_ARROW_RIGHT'],
    defaultPlacement: { side: 'central', defaultX: 8, defaultY: 40 },
    slots: [],
    render: (grid, destX, destY, ctx) => {
      const inst = resolveWidgetInstance(ctx.instances, 'keypress', ctx.activeInstanceId) || ctx.instances?.['keypress']?.[0];
      const boxW = ctx.blockWidth;
      const boxH = ctx.blockHeight;
      const config = inst?.config;
      const elements: KeypressElement[] = config?.keypressElements || config?.keypressBindings || [];
      const idleSymbolId = config?.idleSymbolId || config?.keypressIdleSymbolId;

      let activeSymbolId: string | undefined;

      const activeKeys = ctx.activeKeys || ctx.keypressState?.activeKeys || [];
      if (activeKeys.length > 0) {
        for (let i = activeKeys.length - 1; i >= 0; i--) {
          const key = activeKeys[i];
          const match = elements.find(el => isKeyMatching(el.key, key));
          if (match) {
            activeSymbolId = match.symbolId;
            break;
          }
        }
      }

      const instKey = inst?.id || 'keypress-default';

      if (activeSymbolId && ctx.keypressState) {
        ctx.keypressState.lastSymbolId = activeSymbolId;
        if (!ctx.keypressState.lastSymbolByInstance) {
          ctx.keypressState.lastSymbolByInstance = {};
        }
        ctx.keypressState.lastSymbolByInstance[instKey] = activeSymbolId;
      }

      let symbolToRender: string | undefined;
      if (activeSymbolId) {
        symbolToRender = activeSymbolId;
      } else if (idleSymbolId && ctx.symbolSlices.some(s => s.id === idleSymbolId)) {
        symbolToRender = idleSymbolId;
      } else {
        const lastSym = ctx.keypressState?.lastSymbolByInstance?.[instKey] || ctx.keypressState?.lastSymbolId;
        if (lastSym && ctx.symbolSlices.some(s => s.id === lastSym)) {
          symbolToRender = lastSym;
        } else {
          const lastKey = ctx.lastKey || ctx.keypressState?.lastKey;
          if (lastKey) {
            const match = elements.find(el => isKeyMatching(el.key, lastKey));
            if (match) {
              symbolToRender = match.symbolId;
              if (ctx.keypressState) {
                ctx.keypressState.lastSymbolId = match.symbolId;
                if (!ctx.keypressState.lastSymbolByInstance) {
                  ctx.keypressState.lastSymbolByInstance = {};
                }
                ctx.keypressState.lastSymbolByInstance[instKey] = match.symbolId;
              }
            }
          }
        }
        if (!symbolToRender && elements.length > 0) {
          symbolToRender = elements[0].symbolId;
        }
      }

      if (symbolToRender) {
        blitSlice(grid, ctx.symbolsGrid, ctx.symbolSlices, symbolToRender, destX, destY, boxW, boxH);
      }
    },
  },
  {
    id: 'screensaver',
    name: 'Image',
    category: 'art',
    tier: 3,
    description: 'Idle sleep graphic or animated mascot for idle keyboard display.',
    defaultWidth: 26,
    minWidth: 20,
    maxWidth: 32,
    defaultHeight: 26,
    minHeight: 20,
    maxHeight: 36,
    icon: 'sparkles',
    associatedSliceIds: ['SYMBOL_SKULL_LAYER_0'],
    defaultPlacement: { side: 'both', defaultX: 3, defaultY: 35 },
    slots: [],
    render: (grid, destX, destY, ctx) => {
      const inst = resolveWidgetInstance(ctx.instances, 'screensaver', ctx.activeInstanceId) || ctx.instances?.['screensaver']?.[0];
      const boxW = ctx.blockWidth;
      const boxH = ctx.blockHeight;
      if (inst?.config?.groupId) {
        const slice = ctx.symbolSlices.find(s => s.groupId === inst.config?.groupId && s.groupOrder === 1)
          || ctx.symbolSlices.find(s => s.groupId === inst.config?.groupId)
          || ctx.symbolSlices.find(s => s.id === inst.config?.groupId);
        if (slice) {
          blitSlice(grid, ctx.symbolsGrid, ctx.symbolSlices, slice.id, destX, destY, boxW, boxH);
          return;
        }
      }
      renderSlot(grid, destX, destY, 'screensaver', 'mascot', ctx, { width: boxW, height: boxH });
    },
  },
  {
    id: 'bongo',
    name: 'Bongo Cat',
    category: 'art',
    tier: 3,
    isInteractive: true,
    description: 'Reactive bongo mascot that taps paws to left/right keystrokes.',
    defaultWidth: 32,
    minWidth: 20,
    maxWidth: 32,
    defaultHeight: 23,
    minHeight: 16,
    maxHeight: 36,
    icon: 'cat',
    associatedSliceIds: ['SYMBOL_SLICE_40_4046', 'SYMBOL_BONGO_SCYAN_5477'],
    defaultPlacement: { side: 'both', defaultX: 0, defaultY: 35 },
    slots: [],
    render: (grid, destX, destY, ctx) => {
      const inst = resolveWidgetInstance(ctx.instances, 'bongo', ctx.activeInstanceId) || ctx.instances?.['bongo']?.[0];
      const boxW = ctx.blockWidth;
      const boxH = ctx.blockHeight;
      let groupId = inst?.config?.groupId;
      if (!groupId) {
        const bongoSlice = ctx.symbolSlices.find(s =>
          s.id.toUpperCase().includes('BONGO') ||
          s.groupId.toUpperCase().includes('BONGO') ||
          (s.name && s.name.toUpperCase().includes('BONGO')) ||
          s.id.startsWith('SYMBOL_SLICE_40_4046') ||
          s.groupId.startsWith('SYMBOL_SLICE_40_4046')
        );
        if (bongoSlice) {
          groupId = bongoSlice.groupId;
        }
      }
      if (groupId) {
        let groupMembers = ctx.symbolSlices.filter(s => s.groupId === groupId).sort((a, b) => a.groupOrder - b.groupOrder);
        if (groupMembers.length === 0) {
          groupMembers = ctx.symbolSlices.filter(s => s.id === groupId);
        }
        if (groupMembers.length >= 3) {
          const stateIdx = ctx.bongoState ?? 0;
          const slice = groupMembers[stateIdx] || groupMembers[0];
          blitSlice(grid, ctx.symbolsGrid, ctx.symbolSlices, slice.id, destX, destY, boxW, boxH);
          return;
        } else if (groupMembers.length > 0) {
          blitSlice(grid, ctx.symbolsGrid, ctx.symbolSlices, groupMembers[0].id, destX, destY, boxW, boxH);
          return;
        }
      }
      // Direct bongo slice matching
      const directBongos = ctx.symbolSlices.filter(s =>
        s.id.toUpperCase().includes('BONGO') ||
        (s.name && s.name.toUpperCase().includes('BONGO')) ||
        s.id.startsWith('SYMBOL_SLICE_40_4046')
      ).sort((a, b) => a.groupOrder - b.groupOrder);
      if (directBongos.length > 0) {
        const stateIdx = ctx.bongoState ?? 0;
        const slice = directBongos[stateIdx] || directBongos[0];
        blitSlice(grid, ctx.symbolsGrid, ctx.symbolSlices, slice.id, destX, destY, boxW, boxH);
        return;
      }
      // Text fallback mirroring firmware
      const customText = inst?.config?.textEntries?.[0] || '(=^.^=)';
      const fontSize = inst?.config?.fontSize || 'small';
      const textAlign = inst?.config?.textAlign || 'center';
      drawText(grid, ctx.fontGrid, ctx.fontGlyphs, ctx.fontMappings, customText, destX, destY, fontSize, { align: textAlign, boxWidth: boxW, boxHeight: boxH, verticalAlign: 'middle' });
    },
  },
  {
    id: 'animation',
    name: 'Animation',
    category: 'art',
    tier: 3,
    description: 'Sequentially cycles through frames of a symbol group as an animation.',
    defaultWidth: 26,
    minWidth: 8,
    maxWidth: 32,
    defaultHeight: 26,
    minHeight: 8,
    maxHeight: 128,
    icon: 'film',
    associatedSliceIds: [],
    defaultPlacement: { side: 'both', defaultX: 3, defaultY: 35 },
    slots: [],
    render: (grid, destX, destY, ctx) => {
      const inst = resolveWidgetInstance(ctx.instances, 'animation', ctx.activeInstanceId)
        || ctx.instances?.['animation']?.[0]
        || resolveWidgetInstance(ctx.instances, 'loop', ctx.activeInstanceId)
        || ctx.instances?.['loop']?.[0];
      const boxW = ctx.blockWidth;
      const boxH = ctx.blockHeight;
      const targetGroupId = inst?.config?.groupId;
      let groupMembers: SpriteSlice[] = [];
      if (targetGroupId) {
        const normTarget = targetGroupId.toLowerCase();
        groupMembers = ctx.symbolSlices
          .filter(s => s.groupId === targetGroupId || s.groupId.toLowerCase() === normTarget)
          .sort((a, b) => a.groupOrder - b.groupOrder);
        if (groupMembers.length === 0) {
          groupMembers = ctx.symbolSlices.filter(s => s.id === targetGroupId || s.id.toLowerCase() === normTarget || (s.name && s.name.toLowerCase() === normTarget));
        }
      }
      if (groupMembers.length === 0) {
        // Find any available animation/custom multi-frame group as fallback (exclude system status icons)
        const isSystemGroup = (gid: string) => {
          const u = gid.toUpperCase();
          return u.includes('CHARGE') || u.includes('BATTERY') || u.includes('SPEED') || u.includes('WPM') || u.includes('BLUETOOTH') || u.includes('USB') || u.includes('SPLIT') || u.includes('LAYER') || u.includes('BRACKET');
        };
        const multiGroup = ctx.symbolSlices.find(s => !isSystemGroup(s.groupId) && s.groupOrder === 1 && ctx.symbolSlices.filter(m => m.groupId === s.groupId).length >= 2)
          || ctx.symbolSlices.find(s => s.groupOrder === 1 && ctx.symbolSlices.filter(m => m.groupId === s.groupId).length >= 2);
        if (multiGroup) {
          groupMembers = ctx.symbolSlices
            .filter(s => s.groupId === multiGroup.groupId)
            .sort((a, b) => a.groupOrder - b.groupOrder);
        }
      }

      if (groupMembers.length > 0) {
        const speedMs = Math.max(20, inst?.config?.loopSpeedMs ?? 250);
        const shouldLoop = inst?.config?.loop ?? true;
        const timestamp = ctx.animationTimestamp ?? (shouldLoop ? (typeof performance !== 'undefined' ? performance.now() : Date.now()) : 0);
        let frameIdx: number;
        if (shouldLoop) {
          frameIdx = Math.floor(timestamp / speedMs) % groupMembers.length;
        } else {
          frameIdx = Math.min(Math.floor(timestamp / speedMs), groupMembers.length - 1);
        }
        const slice = groupMembers[frameIdx] || groupMembers[0];
        blitSlice(grid, ctx.symbolsGrid, ctx.symbolSlices, slice.id, destX, destY, boxW, boxH);
        return;
      }

      // Fallback text if no symbol group found
      const fallbackText = inst?.config?.textEntries?.[0] || 'ANIM';
      const fontSize = inst?.config?.fontSize || 'small';
      const textAlign = inst?.config?.textAlign || 'center';
      drawText(grid, ctx.fontGrid, ctx.fontGlyphs, ctx.fontMappings, fallbackText, destX, destY, fontSize, { align: textAlign, boxWidth: boxW, boxHeight: boxH, verticalAlign: 'middle' });
    },
  }
];

/**
 * Normalizes widget type ID from potential legacy block ID
 */
export function normalizeWidgetType(idOrType: string): string {
  switch (idOrType) {
    case 'block-layer-label':
    case 'left-layer':
    case 'right-layer':
      return 'layer-banner';
    case 'block-branding':
    case 'left-branding':
    case 'right-branding':
      return 'branding';
    case 'block-wpm':
    case 'left-wpm':
    case 'right-wpm':
      return 'wpm';
    case 'block-split':
    case 'left-split':
    case 'right-split':
      return 'split';
    case 'block-battery':
    case 'right-battery':
      return 'battery';
    case 'block-caps':
      return 'caps-lock';
    case 'block-ble-profile':
    case 'ble-profile':
    case 'output-status':
      return 'connection';
    case 'block-wpm-digits':
      return 'wpm-digits';
    case 'block-wpm-gauge':
      return 'wpm-gauge';
    case 'block-screensaver':
      return 'screensaver';
    case 'block-bongo':
    case 'bongo-cat':
      return 'bongo';
    case 'block-animation':
    case 'animation':
    case 'block-loop':
    case 'loop':
      return 'animation';
    case 'block-typewriter':
    case 'typewriter':
      return 'typewriter';
    case 'block-keypress':
    case 'keypress':
    case 'key-press':
      return 'keypress';
    default:
      return idOrType;
  }
}

/**
 * Retrieve widget definition by ID or legacy block identifier
 */
export function getWidgetDefinition(id: string): DisplayWidgetDefinition | undefined {
  const normalized = normalizeWidgetType(id);
  return WIDGET_REGISTRY.find(w => w.id === normalized);
}

/**
 * Get all available widgets
 */
export function getAllWidgets(): DisplayWidgetDefinition[] {
  return WIDGET_REGISTRY;
}

/**
 * Resolves a widget's natural (pixel-accurate) size from actual atlas slice dimensions.
 *
 * Strategy:
 * - Looks at the widget's `associatedSliceIds`. Finds the first slice that exists in `symbolSlices`.
 * - For composite widgets (e.g. status-bar with USB + Battery side-by-side), returns the
 *   widget's `defaultWidth`/`defaultHeight` since they span multiple symbols.
 * - For single-symbol widgets (battery, split, connection, layer-art, screensaver, etc.),
 *   returns the actual slice's `{ width, height }`.
 * - Falls back to `widget.defaultWidth`/`widget.defaultHeight` if no matching slice is found.
 */
export function getWidgetNaturalSize(
  widget: DisplayWidgetDefinition,
  symbolSlices: SpriteSlice[],
  activeInstance?: import('../types/widget').WidgetInstance,
  fontGlyphs?: FontGlyph[],
  fontMappings?: FontCharMapping[]
): { width: number; height: number } {
  const { associatedSliceIds, defaultWidth, defaultHeight } = widget;

  if (widget.id === 'typewriter') {
    const inst = activeInstance;
    const mode: TypewriterMode = (inst?.config?.typewriterMode || (['inline', 'spot', 'random'].includes(inst?.config?.mode as string) ? inst?.config?.mode : undefined) || 'inline') as TypewriterMode;
    const fontSize = inst?.config?.fontSize || 'small';
    const charH = fontSize === 'big' ? 10 : 5;
    const charW = fontSize === 'big' ? 10 : 5;

    if (mode === 'spot') {
      return { width: charW, height: charH };
    }
    if (mode === 'random') {
      return {
        width: inst?.config?.typewriterWidth ?? defaultWidth,
        height: inst?.config?.typewriterHeight ?? 32,
      };
    }
    // Inline mode
    const direction = inst?.config?.typewriterDirection || 'we';
    if (direction === 'we' || direction === 'ew') {
      return {
        width: inst?.config?.typewriterWidth ?? defaultWidth,
        height: charH,
      };
    } else {
      return {
        width: charW,
        height: inst?.config?.typewriterHeight ?? 32,
      };
    }
  }

  if (widget.id === 'keypress') {
    const inst = activeInstance;
    const elements = inst?.config?.keypressElements || inst?.config?.keypressBindings || [];
    const idleId = inst?.config?.idleSymbolId || inst?.config?.keypressIdleSymbolId;
    const allSymIds = [...elements.map(e => e.symbolId), idleId].filter(Boolean) as string[];
    const matchingSlices = symbolSlices.filter(s => allSymIds.includes(s.id));
    if (matchingSlices.length > 0) {
      const maxW = Math.max(...matchingSlices.map(s => s.width));
      const maxH = Math.max(...matchingSlices.map(s => s.height));
      return { width: Math.max(4, maxW), height: Math.max(4, maxH) };
    }
    return { width: defaultWidth, height: defaultHeight };
  }

  if (widget.id === 'wpm-chart' && activeInstance?.config?.wpmChart) {
    return {
      width: activeInstance.config.wpmChart.width ?? defaultWidth,
      height: activeInstance.config.wpmChart.height ?? defaultHeight,
    };
  }

  if (widget.id === 'layer-banner') {
    const firstGroupId = activeInstance?.config?.groupIds?.find(id => !!id);
    if (firstGroupId) {
      const slice = symbolSlices.find(s => s.groupId === firstGroupId && s.groupOrder === 1) || symbolSlices.find(s => s.groupId === firstGroupId);
      if (slice) return { width: slice.width, height: slice.height };
    }
  }

  if (widget.id === 'connection' && activeInstance?.config) {
    const targetGroupId = activeInstance.config.groupId || activeInstance.config.groupIds?.[1];
    if (targetGroupId) {
      const slice = symbolSlices.find(s => s.groupId === targetGroupId && s.groupOrder === 1)
        || symbolSlices.find(s => s.groupId === targetGroupId)
        || symbolSlices.find(s => s.id === targetGroupId);
      if (slice) return { width: slice.width, height: slice.height };
    }
  }

  if (widget.id === 'screensaver' && activeInstance?.config?.groupId) {
    const slice = symbolSlices.find(s => s.groupId === activeInstance.config?.groupId && s.groupOrder === 1)
      || symbolSlices.find(s => s.groupId === activeInstance.config?.groupId)
      || symbolSlices.find(s => s.id === activeInstance.config?.groupId);
    if (slice) return { width: slice.width, height: slice.height };
  }

  if (widget.id === 'bongo') {
    const targetGroupId = activeInstance?.config?.groupId;
    let slice: SpriteSlice | undefined;
    if (targetGroupId) {
      slice = symbolSlices.find(s => s.groupId === targetGroupId && s.groupOrder === 1)
        || symbolSlices.find(s => s.groupId === targetGroupId)
        || symbolSlices.find(s => s.id === targetGroupId);
    }
    if (!slice) {
      slice = symbolSlices.find(s =>
        s.id.toUpperCase().includes('BONGO') ||
        s.groupId.toUpperCase().includes('BONGO') ||
        (s.name && s.name.toUpperCase().includes('BONGO')) ||
        s.id.startsWith('SYMBOL_SLICE_40_4046')
      );
    }
    if (slice) return { width: slice.width, height: slice.height };
  }

  if (widget.id === 'animation' || widget.id === 'loop') {
    const targetGroupId = activeInstance?.config?.groupId;
    let slice: SpriteSlice | undefined;
    if (targetGroupId) {
      const normTarget = targetGroupId.toLowerCase();
      slice = symbolSlices.find(s => s.groupId === targetGroupId && s.groupOrder === 1)
        || symbolSlices.find(s => s.groupId === targetGroupId)
        || symbolSlices.find(s => s.id === targetGroupId)
        || symbolSlices.find(s => s.groupId?.toLowerCase() === normTarget && s.groupOrder === 1)
        || symbolSlices.find(s => s.groupId?.toLowerCase() === normTarget)
        || symbolSlices.find(s => s.id?.toLowerCase() === normTarget)
        || symbolSlices.find(s => s.name && s.name.toLowerCase() === normTarget);
    }
    if (!slice && !targetGroupId) {
      const isSystemGroup = (gid: string) => {
        const u = gid.toUpperCase();
        return u.includes('CHARGE') || u.includes('BATTERY') || u.includes('SPEED') || u.includes('WPM') || u.includes('BLUETOOTH') || u.includes('USB') || u.includes('SPLIT') || u.includes('LAYER') || u.includes('BRACKET') || u.includes('ARROW');
      };
      // Look for custom animation / mascot groups first
      slice = symbolSlices.find(s => !isSystemGroup(s.groupId) && s.groupOrder === 1 && symbolSlices.filter(m => m.groupId === s.groupId).length >= 2)
        || symbolSlices.find(s => !isSystemGroup(s.groupId) && (s.id.toUpperCase().includes('ANIM') || s.groupId.toUpperCase().includes('ANIM') || s.id.toUpperCase().includes('DUCK') || s.groupId.toUpperCase().includes('DUCK') || s.id.toUpperCase().includes('CAMPFIRE') || s.groupId.toUpperCase().includes('CAMPFIRE')));
    }
    if (slice) return { width: slice.width, height: slice.height };
    return { width: defaultWidth, height: defaultHeight };
  }

  if (widget.id === 'branding') {
    const rawText = activeInstance?.config?.textEntries?.[0] !== undefined
      ? activeInstance.config.textEntries[0]
      : 'ZMK';
    const text = (rawText || 'ZMK').toUpperCase();
    const fontSize = activeInstance?.config?.fontSize || 'small';
    const textWidth = measureTextWidth(text, fontGlyphs, fontMappings, fontSize);
    return {
      width: Math.min(32, Math.max(textWidth, 4)),
      height: fontSize === 'big' ? 10 : 5,
    };
  }

  if (widget.id === 'wpm') {
    const mode = activeInstance?.config?.mode || 'symbol';
    if (mode === 'symbol') {
      const targetGroupId = activeInstance?.config?.groupId;
      if (targetGroupId) {
        const slice = symbolSlices.find(s => s.groupId === targetGroupId && s.groupOrder === 1)
          || symbolSlices.find(s => s.groupId === targetGroupId)
          || symbolSlices.find(s => s.id === targetGroupId);
        if (slice) return { width: slice.width, height: slice.height };
      }
      for (const sliceId of associatedSliceIds) {
        const slice = symbolSlices.find(s => s.id === sliceId);
        if (slice) return { width: slice.width, height: slice.height };
      }
      return { width: 27, height: 5 };
    } else {
      // Font / Text mode
      const isBig = activeInstance?.config?.fontSize === 'big';
      const fontSize = isBig ? 'big' : 'small';
      const entries = activeInstance?.config?.textEntries || [];
      const nonEmptyEntries = entries.map(e => e?.trim()).filter(Boolean) as string[];

      if (nonEmptyEntries.length > 0) {
        let maxTextW = 0;
        for (const e of nonEmptyEntries) {
          const w = measureTextWidth(e.toUpperCase(), fontGlyphs, fontMappings, fontSize);
          if (w > maxTextW) maxTextW = w;
        }
        return {
          width: Math.min(32, Math.max(maxTextW, 4)),
          height: isBig ? 10 : 5,
        };
      }

      // Digits mode fallback (e.g. up to 3 digits '100' at 8px advance each = 24px width, 10px height)
      return { width: 24, height: 10 };
    }
  }

  if (widget.id === 'battery') {
    const mode = activeInstance?.config?.mode || 'symbol';
    if (mode === 'symbol' && activeInstance?.config?.groupId) {
      const slice = symbolSlices.find(s => s.groupId === activeInstance.config?.groupId && s.groupOrder === 1)
        || symbolSlices.find(s => s.groupId === activeInstance.config?.groupId)
        || symbolSlices.find(s => s.id === activeInstance.config?.groupId);
      if (slice) return { width: slice.width, height: slice.height };
    }
  }

  // Composite widgets intentionally span multiple symbols; honour their hardcoded layout size.
  const COMPOSITE_WIDGET_IDS = new Set(['status-bar']);
  if (COMPOSITE_WIDGET_IDS.has(widget.id)) {
    return { width: defaultWidth, height: defaultHeight };
  }

  // For single-symbol widgets, derive size from the primary (first associated) slice.
  for (const sliceId of associatedSliceIds) {
    const slice = symbolSlices.find(s => s.id === sliceId);
    if (slice) {
      return { width: slice.width, height: slice.height };
    }
  }

  // No matching slice found (e.g. text-only widgets like branding, caps-lock) — use defaults.
  return { width: defaultWidth, height: defaultHeight };
}

/**
 * Filter widgets by category
 */
export function getWidgetsByCategory(category: WidgetCategory | 'all'): DisplayWidgetDefinition[] {
  if (category === 'all') return WIDGET_REGISTRY;
  return WIDGET_REGISTRY.filter(w => w.category === category);
}

/**
 * Filter widgets by tier (1: Status, 2: Keymap/Typing, 3: Mascots/Art)
 */
export function getWidgetsByTier(tier: 1 | 2 | 3): DisplayWidgetDefinition[] {
  return WIDGET_REGISTRY.filter(w => w.tier === tier);
}

/**
 * Render a single widget by its type onto a target grid
 */
export function renderWidgetById(
  widgetType: string,
  grid: BwpxGrid,
  destY: number,
  context: WidgetRenderContext
): void;
export function renderWidgetById(
  widgetType: string,
  grid: BwpxGrid,
  destX: number,
  destY: number,
  context: WidgetRenderContext
): void;
export function renderWidgetById(
  widgetType: string,
  grid: BwpxGrid,
  arg3: number,
  arg4: number | WidgetRenderContext,
  arg5?: WidgetRenderContext
): void {
  const widget = getWidgetDefinition(widgetType);
  if (!widget) return;

  let destX = 0;
  let destY = 0;
  let context: WidgetRenderContext;

  if (typeof arg4 === 'number') {
    destX = arg3;
    destY = arg4;
    context = arg5!;
  } else {
    destX = widget.defaultPlacement.defaultX ?? 0;
    destY = arg3;
    context = arg4;
  }

  widget.render(grid, destX, destY, context);
}

/**
 * Resolves an active widget instance from the instances map, safely handling
 * alias types (such as animation <-> loop) and falling back gracefully.
 */
export function resolveWidgetInstance(
  instances: import('../types/widget').WidgetInstanceMap | undefined,
  widgetTypeOrId: string,
  instanceId?: string | null
): import('../types/widget').WidgetInstance | undefined {
  if (!instances) return undefined;
  const normType = normalizeWidgetType(widgetTypeOrId);
  const candidateKeys = normType === 'animation'
    ? ['animation', 'loop']
    : normType === 'loop'
    ? ['loop', 'animation']
    : [normType];

  if (instanceId) {
    for (const key of candidateKeys) {
      const found = instances[key]?.find(i => i.id === instanceId);
      if (found) return found;
    }
  }

  for (const key of candidateKeys) {
    if (instances[key] && instances[key].length > 0) {
      return instances[key][0];
    }
  }

  return undefined;
}

/**
 * Render an entire screen's layout blocks onto a 32x128 grid
 */
export function renderBlocksToGrid(
  blocks: LayoutBlock[],
  grid: BwpxGrid,
  context: WidgetRenderContext
): void {
  // Sort blocks by Y position
  const sorted = [...blocks].filter(b => b.enabled).sort((a, b) => a.y - b.y);
  for (const block of sorted) {
    const type = block.widgetType || block.id;
    const normType = normalizeWidgetType(type);
    const def = getWidgetDefinition(normType);
    const destX = block.x ?? def?.defaultPlacement.defaultX ?? 0;
    const activeInstance = resolveWidgetInstance(context.instances, normType, block.instanceId);
    const resolvedInstanceId = activeInstance?.id ?? block.instanceId;
    const naturalSize = def ? getWidgetNaturalSize(def, context.symbolSlices || [], activeInstance, context.fontGlyphs, context.fontMappings) : null;
    const isDynamicSize = normType === 'wpm-chart' || normType === 'typewriter';
    const effectiveWidth = (isDynamicSize && naturalSize) ? naturalSize.width : (block.width ?? naturalSize?.width ?? def?.defaultWidth);
    const effectiveHeight = (isDynamicSize && naturalSize) ? naturalSize.height : (block.height ?? naturalSize?.height ?? def?.defaultHeight);
    const activeContext = {
      ...context,
      activeInstanceId: resolvedInstanceId,
      blockWidth: effectiveWidth,
      blockHeight: effectiveHeight,
    };
    renderWidgetById(normType, grid, destX, block.y, activeContext);
  }
}

/**
 * Resolves the canonical initial configuration for a widget type based on available symbol slices.
 * Ensures widget instances are initialized with valid groupIds and settings rather than blank fallbacks.
 */
export function getDefaultWidgetConfig(
  widgetTypeId: string,
  symbolSlices: SpriteSlice[] = []
): WidgetInstanceConfig {
  const normId = normalizeWidgetType(widgetTypeId);
  switch (normId) {
    case 'branding':
      return {
        mode: 'font',
        fontSize: 'small',
        textAlign: 'center',
        align: 'center',
        textEntries: ['ZMK'],
      };

    case 'wpm-chart':
      return {
        mode: 'symbol',
        wpmChart: { width: 32, height: 24, gridSize: 4, targetSpeed: 100, timeWindow: 30 },
      };

    case 'typewriter':
      return {
        mode: 'inline',
        typewriterMode: 'inline',
        typewriterDirection: 'we',
        typewriterCleaning: 0.2,
        typewriterWidth: 32,
        typewriterLetterBank: 20,
        typewriterBankSize: 20,
        fontSize: 'both',
        typewriterFadeType: 'dither',
        typewriterFadeTime: 0.15,
      };

    case 'connection':
      return {
        mode: 'symbol',
        groupId: 'SYMBOL_USB',
        groupIds: [
          'SYMBOL_BLUETOOTH',
          'SYMBOL_BLUETOOTH',
          'SYMBOL_BLUETOOTH',
          'SYMBOL_BLUETOOTH',
          'SYMBOL_BLUETOOTH',
          'SYMBOL_BLUETOOTH',
        ],
        textEntries: ['USB', 'No conn', 'P1', 'P2', 'P3', 'P4', 'P5'],
      };

    case 'battery': {
      const battSlice = symbolSlices.find(
        (s) =>
          (s.groupId?.toUpperCase().includes('CHARGE') ||
            s.groupId?.toUpperCase().includes('BATT') ||
            s.id.toUpperCase().includes('BATTERY')) &&
          symbolSlices.filter((m) => m.groupId === s.groupId).length >= 2
      ) || symbolSlices.find(
        (s) =>
          s.groupId?.toUpperCase().includes('CHARGE') ||
          s.groupId?.toUpperCase().includes('BATT') ||
          s.id.toUpperCase().includes('BATTERY')
      );
      return {
        mode: 'symbol',
        groupId: battSlice?.groupId || 'SYMBOL_CHARGE_0960',
      };
    }

    case 'split': {
      const splitSlice = symbolSlices.find(
        (s) =>
          s.groupId?.toUpperCase().includes('SPLIT') ||
          s.id.toUpperCase().includes('SPLIT')
      );
      return {
        mode: 'symbol',
        groupId: splitSlice?.groupId || 'SYMBOL_SPLIT_CONNECTED',
      };
    }

    case 'layer-banner': {
      const bracketSlice = symbolSlices.find(
        (s) =>
          s.groupId?.toUpperCase().includes('BRACKET') ||
          s.groupId?.toUpperCase().includes('LAYER') ||
          s.id.toUpperCase().includes('BRACKET')
      );
      const bracketGroupId = bracketSlice?.groupId || 'SYMBOL_BRACKET_LAYER_0';
      return {
        mode: 'symbol',
        groupIds: [
          bracketGroupId,
          bracketGroupId,
          'SYMBOL_BRACKET_LAYER_1',
          'SYMBOL_BRACKET_LAYER_2',
          'SYMBOL_BRACKET_LAYER_3',
        ],
      };
    }

    case 'wpm':
    case 'wpm-gauge': {
      const speedSlice = symbolSlices.find(
        (s) =>
          s.groupId?.toUpperCase().includes('SPEED') ||
          s.groupId?.toUpperCase().includes('WPM') ||
          s.id.toUpperCase().includes('ARROW')
      );
      return {
        mode: 'symbol',
        groupId: speedSlice?.groupId || 'SYMBOL_SPEEDOMETER_8803',
        targetValue: 70,
      };
    }

    case 'caps-lock': {
      const capsSlice = symbolSlices.find(
        (s) =>
          s.groupId?.toUpperCase().includes('CAPS') ||
          s.id.toUpperCase().includes('CAPS')
      );
      return {
        mode: 'symbol',
        groupId: capsSlice?.groupId || 'SYMBOL_CAPSA_9310',
        textEntries: ['a', ''],
      };
    }

    case 'bongo': {
      const bongoGroup = symbolSlices.find(
        (s) =>
          s.groupOrder === 1 &&
          symbolSlices.filter((m) => m.groupId === s.groupId).length >= 3 &&
          (s.id.toUpperCase().includes('BONGO') || s.groupId?.toUpperCase().includes('BONGO'))
      ) || symbolSlices.find(
        (s) =>
          s.id.toUpperCase().includes('BONGO') ||
          s.groupId?.toUpperCase().includes('BONGO') ||
          s.id.startsWith('SYMBOL_SLICE_40_4046')
      );
      return {
        mode: 'symbol',
        groupId: bongoGroup?.groupId || 'SYMBOL_SLICE_40_4046',
        textEntries: ['(=^.^=)'],
        bongoTapMs: 60,
        bongoDebounceMs: 100,
      };
    }

    case 'screensaver': {
      const isSystemGroup = (gid: string) => {
        const u = gid.toUpperCase();
        return (
          u.includes('CHARGE') ||
          u.includes('BATTERY') ||
          u.includes('SPEED') ||
          u.includes('WPM') ||
          u.includes('BLUETOOTH') ||
          u.includes('USB') ||
          u.includes('SPLIT') ||
          u.includes('LAYER') ||
          u.includes('BRACKET')
        );
      };
      const artSlice =
        symbolSlices.find((s) => !isSystemGroup(s.groupId)) ||
        symbolSlices.find((s) => s.id.includes('SKULL') || s.id.includes('CAMPFIRE')) ||
        symbolSlices[0];
      return {
        mode: 'symbol',
        groupId: artSlice?.groupId || 'SYMBOL_SKULL_LAYER_0',
      };
    }

    case 'animation':
    case 'loop': {
      const isSystemGroup = (gid: string) => {
        const u = gid.toUpperCase();
        return (
          u.includes('CHARGE') ||
          u.includes('BATTERY') ||
          u.includes('SPEED') ||
          u.includes('WPM') ||
          u.includes('BLUETOOTH') ||
          u.includes('USB') ||
          u.includes('SPLIT') ||
          u.includes('LAYER') ||
          u.includes('BRACKET')
        );
      };
      const animGroup =
        symbolSlices.find(
          (s) =>
            !isSystemGroup(s.groupId) &&
            s.groupOrder === 1 &&
            symbolSlices.filter((m) => m.groupId === s.groupId).length >= 2
        ) ||
        symbolSlices.find(
          (s) => s.groupOrder === 1 && symbolSlices.filter((m) => m.groupId === s.groupId).length >= 2
        );
      return {
        mode: 'symbol',
        groupId: animGroup?.groupId || 'SYMBOL_CAMPFIRE',
        loopSpeedMs: 150,
        loop: true,
      };
    }

    case 'keypress': {
      const up = symbolSlices.find(s => s.id === 'SYMBOL_ARROW_UP')?.id || 'SYMBOL_ARROW_UP';
      const down = symbolSlices.find(s => s.id === 'SYMBOL_ARROW_DOWN')?.id || 'SYMBOL_ARROW_DOWN';
      const left = symbolSlices.find(s => s.id === 'SYMBOL_ARROW_LEFT')?.id || 'SYMBOL_ARROW_LEFT';
      const right = symbolSlices.find(s => s.id === 'SYMBOL_ARROW_RIGHT')?.id || 'SYMBOL_ARROW_RIGHT';
      return {
        mode: 'symbol',
        groupId: 'SYMBOL_ARROWS',
        idleSymbolId: undefined,
        keypressElements: [
          { key: 'ArrowUp', symbolId: up },
          { key: 'ArrowDown', symbolId: down },
          { key: 'ArrowLeft', symbolId: left },
          { key: 'ArrowRight', symbolId: right },
        ],
      };
    }

    default:
      return { mode: 'symbol', textAlign: 'center', align: 'center' };
  }
}

/**
 * Creates a fully configured widget instance with all default slots and parameters populated.
 */
export function createDefaultWidgetInstance(
  widgetTypeId: string,
  symbolSlices: SpriteSlice[] = [],
  instanceId?: string
): WidgetInstance {
  const normId = normalizeWidgetType(widgetTypeId);
  const def = getWidgetDefinition(normId);
  const config = getDefaultWidgetConfig(normId, symbolSlices);
  const inst: WidgetInstance = {
    id: instanceId || `${normId}-${Date.now()}`,
    widgetTypeId: normId,
    label: def?.name || normId,
    config,
    slots: {},
  };
  if (def?.slots) {
    def.slots.forEach((s) => {
      if (s.defaultSymbolId || s.defaultText) {
        inst.slots![s.id] = {
          mode: s.defaultMode,
          symbolId: s.defaultSymbolId,
          text: s.defaultText,
        };
      }
    });
  }
  return inst;
}


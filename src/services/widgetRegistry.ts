import { BwpxGrid } from '../bwpx/core/BwpxGrid';
import type { SpriteSlice, FontGlyph, FontCharMapping, LayoutBlock } from '../types/zmk';
import type {
  DisplayWidgetDefinition,
  WidgetCategory,
  WidgetRenderContext,
  SlotSourceType,
  WidgetSlotDefinition,
  WidgetSlotConfig,
} from '../types/widget';

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
 * Utility to blit a named slice from symbolsGrid into destGrid at (destX, destY)
 */
export function blitSlice(
  destGrid: BwpxGrid,
  symbolsGrid: BwpxGrid,
  symbolSlices: SpriteSlice[],
  sliceId: string,
  destX: number,
  destY: number
): boolean {
  const slice = symbolSlices.find(s => s.id === sliceId);
  if (!slice) return false;

  for (let sy = 0; sy < slice.height; sy++) {
    const targetY = destY + sy;
    if (targetY < 0 || targetY >= destGrid.height) continue;
    for (let sx = 0; sx < slice.width; sx++) {
      const targetX = destX + sx;
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
  size: 'small' | 'big' = 'small'
): number {
  if (!str) return 0;
  let curX = 0;
  let maxX = 0;

  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (char === ' ') {
      curX += size === 'big' ? 6 : 4;
      continue;
    }

    let glyphWidth = size === 'big' ? 6 : 4;
    let advanceX = size === 'big' ? 7 : 5;
    let found = false;

    // 1. Try fontMappings
    if (fontMappings && fontMappings.length > 0) {
      let m = fontMappings.find(item => item.chars.includes(char));
      if (!m) {
        m = fontMappings.find(item => item.chars.toUpperCase().includes(char.toUpperCase()));
      }
      const slot = m ? (size === 'big' ? (m.big || m.small) : (m.small || m.big)) : null;
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
        const scale = size === 'big' ? 2 : 1;
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

/**
 * Utility to draw text using fontMappings or fontGlyphs into destGrid at (startX, startY).
 * Falls back to 3x5 punctuation bitmaps when punctuation symbols are missing from the font atlas.
 */
export function drawText(
  destGrid: BwpxGrid,
  fontGrid: BwpxGrid,
  fontGlyphs: FontGlyph[] | undefined,
  fontMappings: FontCharMapping[] | undefined,
  str: string,
  startX: number,
  startY: number,
  size: 'small' | 'big' = 'small'
): number {
  if (!str) return startX;
  let curX = startX;

  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (char === ' ') {
      curX += size === 'big' ? 6 : 4;
      continue;
    }

    let rendered = false;

    // 1. Try fontMappings first
    if (fontMappings && fontMappings.length > 0) {
      let m = fontMappings.find(item => item.chars.includes(char));
      if (!m) {
        m = fontMappings.find(item => item.chars.toUpperCase().includes(char.toUpperCase()));
      }
      const slot = m ? (size === 'big' ? (m.big || m.small) : (m.small || m.big)) : null;
      if (slot) {
        for (let gy = 0; gy < slot.height; gy++) {
          const targetY = startY + gy;
          if (targetY < 0 || targetY >= destGrid.height) continue;
          for (let gx = 0; gx < slot.width; gx++) {
            const targetX = curX + gx;
            if (targetX < 0 || targetX >= destGrid.width) continue;
            if (fontGrid.get(slot.x + gx, slot.y + gy)) {
              destGrid.set(targetX, targetY, 1);
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
        const targetY = startY + gy;
        if (targetY < 0 || targetY >= destGrid.height) continue;
        for (let gx = 0; gx < glyph.width; gx++) {
          const targetX = curX + gx;
          if (targetX < 0 || targetX >= destGrid.width) continue;
          if (fontGrid.get(glyph.x + gx, glyph.y + gy)) {
            destGrid.set(targetX, targetY, 1);
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
      const scale = size === 'big' ? 2 : 1;
      for (let gy = 0; gy < 5; gy++) {
        const row = punct[gy];
        for (let gx = 0; gx < 3; gx++) {
          if ((row >> (2 - gx)) & 1) {
            for (let sy = 0; sy < scale; sy++) {
              const targetY = startY + gy * scale + sy;
              if (targetY < 0 || targetY >= destGrid.height) continue;
              for (let sx = 0; sx < scale; sx++) {
                const targetX = curX + gx * scale + sx;
                if (targetX < 0 || targetX >= destGrid.width) continue;
                destGrid.set(targetX, targetY, 1);
              }
            }
          }
        }
      }
      curX += 3 * scale + 1;
      rendered = true;
    }

    if (!rendered) {
      curX += size === 'big' ? 6 : 4;
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
  fallbackBounds?: { width: number; height: number },
  fontSize: 'small' | 'big' = 'small'
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

    drawText(destGrid, context.fontGrid, context.fontGlyphs, context.fontMappings, finalText, destX, destY, fontSize);
    return { rendered: true, mode: 'text', text: finalText };
  }

  // Symbol mode
  const targetSymbolId = customConfig?.symbolId || slotDef?.defaultSymbolId || '';
  const sliceExists = targetSymbolId ? context.symbolSlices.some(s => s.id === targetSymbolId) : false;

  if (sliceExists) {
    blitSlice(destGrid, context.symbolsGrid, context.symbolSlices, targetSymbolId, destX, destY);
    return { rendered: true, mode: 'symbol', symbolId: targetSymbolId };
  }

  // Symbol missing or deleted: graceful fallback
  if (slotDef?.fallbackText) {
    const fallbackText = interpolateTemplate(slotDef.fallbackText, context);
    drawText(destGrid, context.fontGrid, context.fontGlyphs, context.fontMappings, fallbackText, destX, destY, fontSize);
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
      const inst = ctx.instances?.['battery']?.find(i => i.id === ctx.activeInstanceId);
      const mode = inst?.config?.mode || 'symbol';
      
      if (mode === 'symbol') {
        const groupId = inst?.config?.groupId;
        const groupMembers = ctx.symbolSlices.filter(s => s.groupId === groupId).sort((a, b) => a.groupOrder - b.groupOrder);
        if (groupMembers.length >= 2) {
          const idx = Math.min(groupMembers.length - 1, Math.floor((battery / 100) * groupMembers.length));
          const slice = groupMembers[idx];
          blitSlice(grid, ctx.symbolsGrid, ctx.symbolSlices, slice.id, destX, destY);
        } else {
          // fallback
          renderSlot(grid, destX, destY, 'battery', 'fallback', ctx, { width: 17, height: 10 });
        }
      } else {
        const divCount = inst?.config?.fontDivisionCount || 2;
        const entries = inst?.config?.textEntries || [];
        const idx = Math.min(divCount - 1, Math.floor((battery / 100) * divCount));
        const text = entries[idx] || `${battery}%`;
        const fontSize = inst?.config?.fontSize || 'small';
        drawText(grid, ctx.fontGrid, ctx.fontGlyphs, ctx.fontMappings, text, destX, destY, fontSize);
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
    defaultPlacement: { side: 'left', defaultX: 10, defaultY: 0 },
    slots: [],
    render: (grid, destX, destY, ctx) => {
      const inst = ctx.instances?.['connection']?.find(i => i.id === ctx.activeInstanceId);
      const mode = inst?.config?.mode || 'symbol';
      const isBle = ctx.outputMode === 'ble';
      
      if (mode === 'symbol') {
        if (!isBle) {
          const groupId = inst?.config?.groupId;
          const slice = ctx.symbolSlices.find(s => (s.groupId === groupId && s.groupOrder === 1) || s.groupId === groupId || s.id === groupId);
          if (slice) {
            blitSlice(grid, ctx.symbolsGrid, ctx.symbolSlices, slice.id, destX, destY);
          } else {
            renderSlot(grid, destX, destY, 'connection', 'fallback', ctx, { width: 12, height: 10 });
          }
        } else {
          const profileIdx = ctx.bleProfileIndex ?? 1;
          const groupId = inst?.config?.groupIds?.[profileIdx] || inst?.config?.groupIds?.[1] || inst?.config?.groupId;
          const slice = ctx.symbolSlices.find(s => (s.groupId === groupId && s.groupOrder === 1) || s.groupId === groupId || s.id === groupId);
          if (slice) {
            blitSlice(grid, ctx.symbolsGrid, ctx.symbolSlices, slice.id, destX, destY);
          } else {
            renderSlot(grid, destX, destY, 'connection', 'fallback', ctx, { width: 14, height: 9 });
          }
        }
      } else {
        const fontSize = inst?.config?.fontSize || 'small';
        if (!isBle) {
          const text = inst?.config?.textEntries?.[0] || 'USB';
          drawText(grid, ctx.fontGrid, ctx.fontGlyphs, ctx.fontMappings, text, destX, destY, fontSize);
        } else {
          const profileIdx = ctx.bleProfileIndex ?? 1;
          const entries = inst?.config?.textEntries || ['USB', 'No conn', 'P1', 'P2', 'P3', 'P4', 'P5'];
          const text = profileIdx === 0
            ? (entries[1] || 'No conn')
            : (entries[profileIdx + 1] || entries[profileIdx] || `P${profileIdx}`);
          drawText(grid, ctx.fontGrid, ctx.fontGlyphs, ctx.fontMappings, text, destX, destY, fontSize);
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
      const inst = ctx.instances?.['split']?.find(i => i.id === ctx.activeInstanceId);
      const mode = inst?.config?.mode || 'symbol';
      const isConnected = ctx.splitConnected ?? true;
      
      if (mode === 'symbol') {
        const groupId = inst?.config?.groupId;
        const groupMembers = ctx.symbolSlices.filter(s => s.groupId === groupId).sort((a, b) => a.groupOrder - b.groupOrder);
        const slice = groupMembers.length >= 2 ? (isConnected ? groupMembers[0] : groupMembers[1]) : null;
        if (slice) {
          blitSlice(grid, ctx.symbolsGrid, ctx.symbolSlices, slice.id, destX, destY);
        } else {
          renderSlot(grid, destX, destY, 'split', 'fallback', ctx, { width: 13, height: 9 });
        }
      } else {
        const entries = inst?.config?.textEntries || ['Connected', 'Not connected'];
        const text = isConnected ? entries[0] : entries[1] || 'Not connected';
        const fontSize = inst?.config?.fontSize || 'small';
        drawText(grid, ctx.fontGrid, ctx.fontGlyphs, ctx.fontMappings, text, destX, destY, fontSize);
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
    defaultPlacement: { side: 'left', defaultX: 9, defaultY: 14 },
    slots: [],
    render: (grid, destX, destY, ctx) => {
      const inst = ctx.instances?.['caps-lock']?.find(i => i.id === ctx.activeInstanceId);
      const mode = inst?.config?.mode || 'font';
      const isOn = ctx.capsLock ?? false;
      
      if (mode === 'symbol') {
        const groupId = inst?.config?.groupId;
        const groupMembers = ctx.symbolSlices.filter(s => s.groupId === groupId).sort((a, b) => a.groupOrder - b.groupOrder);
        const slice = groupMembers.length >= 2 ? (isOn ? groupMembers[0] : groupMembers[1]) : null;
        if (slice) {
          blitSlice(grid, ctx.symbolsGrid, ctx.symbolSlices, slice.id, destX, destY);
        } else {
          renderSlot(grid, destX, destY, 'caps-lock', 'fallback', ctx, { width: 14, height: 7 });
        }
      } else {
        const entries = inst?.config?.textEntries || ['On', 'Off'];
        const text = isOn ? entries[0] : entries[1] || 'Off';
        const fontSize = inst?.config?.fontSize || 'small';
        drawText(grid, ctx.fontGrid, ctx.fontGlyphs, ctx.fontMappings, text, destX, destY, fontSize);
      }
    },
  },
  {
    id: 'layer-banner',
    name: 'Layer Banner',
    category: 'layer',
    tier: 2,
    requiresMaster: true,
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
      const inst = ctx.instances?.['layer-banner']?.find(i => i.id === ctx.activeInstanceId);
      const mode = inst?.config?.mode || 'symbol';
      const layer = ctx.currentLayer ?? 0;
      
      if (mode === 'symbol') {
        const groupId = inst?.config?.groupIds?.[layer];
        const slice = ctx.symbolSlices.find(s => s.groupId === groupId && s.groupOrder === 1);
        if (slice) {
          blitSlice(grid, ctx.symbolsGrid, ctx.symbolSlices, slice.id, destX, destY);
        } else {
          renderSlot(grid, destX, destY, 'layer-banner', 'fallback', ctx, { width: 22, height: 12 });
        }
      } else {
        const textFromEntries = inst?.config?.textEntries?.[layer];
        const textFromContext = ctx.layerNames?.[layer];
        const defaultLayers = ['DEFAULT', 'LOWER', 'RAISE', 'ADJUST'];
        const text = textFromEntries || textFromContext || defaultLayers[layer] || `L${layer}`;
        const fontSize = inst?.config?.fontSize || 'small';
        const textW = measureTextWidth(text, ctx.fontGlyphs, ctx.fontMappings, fontSize);
        const startX = destX + Math.max(0, Math.floor((24 - textW) / 2));
        drawText(grid, ctx.fontGrid, ctx.fontGlyphs, ctx.fontMappings, text, startX, destY + (fontSize === 'big' ? 1 : 3), fontSize);
      }
    },
  },
  {
    id: 'wpm',
    name: 'WPM Meter',
    category: 'typing',
    tier: 2,
    requiresMaster: true,
    description: 'Typing speed readout interpolating up to a target.',
    defaultWidth: 28,
    minWidth: 8,
    maxWidth: 32,
    defaultHeight: 10,
    minHeight: 5,
    maxHeight: 28,
    icon: 'gauge',
    associatedSliceIds: ['SYMBOL_ARROW_HEAD'],
    defaultPlacement: { side: 'left', defaultX: 2, defaultY: 85 },
    slots: [],
    render: (grid, destX, destY, ctx) => {
      const inst = ctx.instances?.['wpm']?.find(i => i.id === ctx.activeInstanceId);
      const mode = inst?.config?.mode || 'symbol';
      const wpmVal = Math.min(999, Math.max(0, ctx.wpm ?? 65));
      const target = inst?.config?.targetValue || 100;
      const progress = Math.min(1, Math.max(0, wpmVal / target));
      
      if (mode === 'symbol') {
        const groupId = inst?.config?.groupId;
        const groupMembers = ctx.symbolSlices.filter(s => s.groupId === groupId).sort((a, b) => a.groupOrder - b.groupOrder);
        if (groupMembers.length >= 2) {
          const idx = Math.min(groupMembers.length - 1, Math.floor(progress * groupMembers.length));
          const slice = groupMembers[idx];
          blitSlice(grid, ctx.symbolsGrid, ctx.symbolSlices, slice.id, destX, destY);
        } else {
          renderSlot(grid, destX, destY, 'wpm', 'fallback', ctx, { width: 28, height: 18 });
        }
      } else {
        const divCount = inst?.config?.fontDivisionCount || 2;
        const entries = inst?.config?.textEntries || [];
        const idx = Math.min(divCount - 1, Math.floor(progress * divCount));
        const text = entries[idx] || `${wpmVal}`;
        const fontSize = inst?.config?.fontSize || 'small';
        drawText(grid, ctx.fontGrid, ctx.fontGlyphs, ctx.fontMappings, text, destX, destY, fontSize);
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
      const inst = ctx.instances?.['branding']?.find(i => i.id === ctx.activeInstanceId) || ctx.instances?.['branding']?.[0];
      const customCfg = ctx.customizations?.['branding']?.['brand-text'];
      const rawText = inst?.config?.textEntries?.[0] !== undefined
        ? inst.config.textEntries[0]
        : (customCfg?.text !== undefined ? customCfg.text : (ctx.customText || 'ZMK'));
      const text = (interpolateTemplate(rawText, ctx) || 'ZMK').toUpperCase();
      const fontSize = inst?.config?.fontSize || 'small';
      drawText(grid, ctx.fontGrid, ctx.fontGlyphs, ctx.fontMappings, text, destX, destY, fontSize);
    },
  },
  {
    id: 'wpm-chart',
    name: 'WPM Chart',
    category: 'typing',
    tier: 2,
    requiresMaster: true,
    description: 'Line chart widget of typing speed over time.',
    defaultWidth: 32,
    minWidth: 16,
    maxWidth: 68,
    defaultHeight: 24,
    minHeight: 12,
    maxHeight: 64,
    icon: 'activity',
    associatedSliceIds: [],
    defaultPlacement: { side: 'left', defaultX: 0, defaultY: 85 },
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
      const inst = ctx.instances?.['screensaver']?.find(i => i.id === ctx.activeInstanceId) || ctx.instances?.['screensaver']?.[0];
      if (inst?.config?.groupId) {
        const slice = ctx.symbolSlices.find(s => s.groupId === inst.config?.groupId && s.groupOrder === 1)
          || ctx.symbolSlices.find(s => s.groupId === inst.config?.groupId)
          || ctx.symbolSlices.find(s => s.id === inst.config?.groupId);
        if (slice) {
          blitSlice(grid, ctx.symbolsGrid, ctx.symbolSlices, slice.id, destX, destY);
          return;
        }
      }
      renderSlot(grid, destX, destY, 'screensaver', 'mascot', ctx, { width: 26, height: 26 });
    },
  },
  {
    id: 'bongo',
    name: 'Bongo Cat',
    category: 'art',
    tier: 3,
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
      const inst = ctx.instances?.['bongo']?.find(i => i.id === ctx.activeInstanceId) || ctx.instances?.['bongo']?.[0];
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
          blitSlice(grid, ctx.symbolsGrid, ctx.symbolSlices, slice.id, destX, destY);
          return;
        } else if (groupMembers.length > 0) {
          blitSlice(grid, ctx.symbolsGrid, ctx.symbolSlices, groupMembers[0].id, destX, destY);
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
        blitSlice(grid, ctx.symbolsGrid, ctx.symbolSlices, slice.id, destX, destY);
        return;
      }
      // Text fallback mirroring firmware
      const customText = inst?.config?.textEntries?.[0] || '(=^.^=)';
      const fontSize = inst?.config?.fontSize || 'small';
      drawText(grid, ctx.fontGrid, ctx.fontGlyphs, ctx.fontMappings, customText, destX, destY, fontSize);
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
    maxHeight: 32,
    icon: 'film',
    associatedSliceIds: [],
    defaultPlacement: { side: 'both', defaultX: 3, defaultY: 35 },
    slots: [],
    render: (grid, destX, destY, ctx) => {
      const inst = ctx.instances?.['animation']?.find(i => i.id === ctx.activeInstanceId)
        || ctx.instances?.['animation']?.[0]
        || ctx.instances?.['loop']?.find(i => i.id === ctx.activeInstanceId)
        || ctx.instances?.['loop']?.[0];
      const targetGroupId = inst?.config?.groupId;
      let groupMembers: SpriteSlice[] = [];
      if (targetGroupId) {
        groupMembers = ctx.symbolSlices
          .filter(s => s.groupId === targetGroupId)
          .sort((a, b) => a.groupOrder - b.groupOrder);
        if (groupMembers.length === 0) {
          groupMembers = ctx.symbolSlices.filter(s => s.id === targetGroupId);
        }
      }
      if (groupMembers.length === 0) {
        // Find any available multi-frame group as fallback
        const multiGroup = ctx.symbolSlices.find(s => s.groupOrder === 1 && ctx.symbolSlices.filter(m => m.groupId === s.groupId).length >= 2);
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
        blitSlice(grid, ctx.symbolsGrid, ctx.symbolSlices, slice.id, destX, destY);
        return;
      }

      // Fallback text if no symbol group found
      const fallbackText = inst?.config?.textEntries?.[0] || 'ANIM';
      const fontSize = inst?.config?.fontSize || 'small';
      drawText(grid, ctx.fontGrid, ctx.fontGlyphs, ctx.fontMappings, fallbackText, destX, destY, fontSize);
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
      slice = symbolSlices.find(s => s.groupId === targetGroupId && s.groupOrder === 1)
        || symbolSlices.find(s => s.groupId === targetGroupId)
        || symbolSlices.find(s => s.id === targetGroupId);
    }
    if (!slice) {
      const multiGroup = symbolSlices.find(s => s.groupOrder === 1 && symbolSlices.filter(m => m.groupId === s.groupId).length >= 2);
      if (multiGroup) slice = multiGroup;
    }
    if (slice) return { width: slice.width, height: slice.height };
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
    const resolvedInstanceId = block.instanceId ??
      context.instances?.[normType]?.[0]?.id ??
      (normType === 'animation' ? context.instances?.['loop']?.[0]?.id : undefined);
    const activeInstance = context.instances?.[normType]?.find(i => i.id === resolvedInstanceId)
      || context.instances?.[normType]?.[0]
      || (normType === 'animation' ? (context.instances?.['loop']?.find(i => i.id === resolvedInstanceId) || context.instances?.['loop']?.[0]) : undefined);
    const naturalSize = def ? getWidgetNaturalSize(def, context.symbolSlices || [], activeInstance, context.fontGlyphs, context.fontMappings) : null;
    const effectiveWidth = naturalSize ? naturalSize.width : block.width;
    const effectiveHeight = naturalSize ? naturalSize.height : block.height;
    const activeContext = {
      ...context,
      activeInstanceId: resolvedInstanceId,
      blockWidth: effectiveWidth,
      blockHeight: effectiveHeight,
    };
    renderWidgetById(normType, grid, destX, block.y, activeContext);
  }
}

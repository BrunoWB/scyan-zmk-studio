import { BwpxGrid } from '../bwpx/core/BwpxGrid';
import type { SpriteSlice, FontGlyph, FontCharMapping, LayoutBlock } from '../types/zmk';
import type { WidgetInstanceMap } from '../types/widget';
import { DEFAULT_SYMBOL_SLICES, DEFAULT_FONT_GLYPHS, DEFAULT_FONT_MAPPINGS } from '../types/zmk';
import { createDefaultSymbolsGrid, createDefaultFontGrid } from './defaultAssets';

export interface HeaderMetadata {
  version: 1;
  leftBlocks?: LayoutBlock[];
  rightBlocks?: LayoutBlock[];
  idleLeftBlocks?: LayoutBlock[];
  idleRightBlocks?: LayoutBlock[];
  screenDimensions?: { width: number; height: number };
  widgetInstances?: WidgetInstanceMap;
}

export interface ParsedAssets {
  symbolsGrid: BwpxGrid;
  symbolSlices: SpriteSlice[];
  fontGrid: BwpxGrid;
  fontGlyphs: FontGlyph[];
  fontMappings: FontCharMapping[];
  metadata?: HeaderMetadata;
}

/**
 * Parses C source code of custom_display_assets.h into BwpxGrids and slice/glyph tables.
 */
export function parseCHeader(cCode: string): ParsedAssets {
  let symbolsGrid = createDefaultSymbolsGrid();
  let symbolSlices = [...DEFAULT_SYMBOL_SLICES];
  let fontGrid = createDefaultFontGrid();
  let fontGlyphs = [...DEFAULT_FONT_GLYPHS];
  let fontMappings = [...DEFAULT_FONT_MAPPINGS];
  let metadata: HeaderMetadata | undefined;

  try {
    // 1. Parse SYMBOLS_ATLAS hex bytes with dynamic dimensions
    const symWidthMatch = cCode.match(/#define\s+SYMBOLS_ATLAS_WIDTH\s+(\d+)/);
    const symHeightMatch = cCode.match(/#define\s+SYMBOLS_ATLAS_HEIGHT\s+(\d+)/);
    const symStrideMatch = cCode.match(/#define\s+SYMBOLS_ATLAS_STRIDE\s+(\d+)/);
    const symbolsMatch = cCode.match(/SYMBOLS_ATLAS\[[\s\S]*?\]\s*=\s*\{([\s\S]*?)\};/);

    if (symbolsMatch && symbolsMatch[1]) {
      const hexTokens = symbolsMatch[1].match(/0x[0-9a-fA-F]{1,2}/g);
      if (hexTokens && hexTokens.length > 0) {
        const stride = symStrideMatch ? parseInt(symStrideMatch[1], 10) : 16;
        const height = symHeightMatch ? parseInt(symHeightMatch[1], 10) : Math.floor(hexTokens.length / stride);
        const width = symWidthMatch ? parseInt(symWidthMatch[1], 10) : Math.max(128, stride * 8);
        const bytes = new Uint8Array(hexTokens.map(h => parseInt(h, 16)));
        symbolsGrid = BwpxGrid.from1bppBytes(bytes, width, height, stride);
      }
    }

    // 2. Parse FONT_ATLAS hex bytes with dynamic dimensions
    const fontWidthMatch = cCode.match(/#define\s+FONT_ATLAS_WIDTH\s+(\d+)/);
    const fontHeightMatch = cCode.match(/#define\s+FONT_ATLAS_HEIGHT\s+(\d+)/);
    const fontStrideMatch = cCode.match(/#define\s+FONT_ATLAS_STRIDE\s+(\d+)/);
    const fontMatch = cCode.match(/FONT_ATLAS\[[\s\S]*?\]\s*=\s*\{([\s\S]*?)\};/);

    if (fontMatch && fontMatch[1]) {
      const hexTokens = fontMatch[1].match(/0x[0-9a-fA-F]{1,2}/g);
      if (hexTokens && hexTokens.length > 0) {
        const stride = fontStrideMatch ? parseInt(fontStrideMatch[1], 10) : 16;
        const height = fontHeightMatch ? parseInt(fontHeightMatch[1], 10) : Math.floor(hexTokens.length / stride);
        const width = fontWidthMatch ? parseInt(fontWidthMatch[1], 10) : Math.max(128, stride * 8);
        const bytes = new Uint8Array(hexTokens.map(h => parseInt(h, 16)));
        fontGrid = BwpxGrid.from1bppBytes(bytes, width, height, stride);
      }
    }

    // 3. Parse SYMBOL_SLICES
    const slicesMatch = cCode.match(/SYMBOL_SLICES\[[^\]]*\]\s*=\s*\{([\s\S]*?)\};/);
    if (slicesMatch && slicesMatch[1]) {
      const slicePattern = /\[\s*([A-Za-z0-9_]+)\s*\]\s*=\s*\{\s*\.x\s*=\s*(-?\d+)\s*,\s*\.y\s*=\s*(-?\d+)\s*,\s*\.width\s*=\s*(\d+)\s*,\s*\.height\s*=\s*(\d+)\s*\}(?:[\s,]*\/\/\s*(.*))?/g;
      const parsedSlices: SpriteSlice[] = [];
      let match: RegExpExecArray | null;
      while ((match = slicePattern.exec(slicesMatch[1])) !== null) {
        const id = match[1];
        const x = parseInt(match[2], 10);
        const y = parseInt(match[3], 10);
        const width = parseInt(match[4], 10);
        const height = parseInt(match[5], 10);
        const comment = match[6] || '';
        
        let groupId = id;
        let groupOrder = 1;
        let name = id.replace(/^SYMBOL_/, '').replace(/_/g, ' ');

        const groupMatch = comment.match(/groupId=([^\s]+)/);
        if (groupMatch) groupId = groupMatch[1];
        
        const orderMatch = comment.match(/groupOrder=(\d+)/);
        if (orderMatch) groupOrder = parseInt(orderMatch[1], 10);
        
        const colorMatch = comment.match(/color=([^\s]+)/);

        const nameMatch = comment.match(/name=(.*)/);
        if (nameMatch) name = nameMatch[1].trim();

        const existing = DEFAULT_SYMBOL_SLICES.find(s => s.id === id);
        
        if (!groupMatch && existing) {
            groupId = existing.groupId;
            groupOrder = existing.groupOrder;
            name = existing.name || name;
        }

        parsedSlices.push({
          id,
          name,
          groupId,
          groupOrder,
          x,
          y,
          width,
          height,
          color: colorMatch ? colorMatch[1] : (existing?.color || '#38bdf8'),
        });
      }
      if (parsedSlices.length > 0) {
        symbolSlices = parsedSlices;
      }
    }

    // 4. Parse FONT_GLYPHS_ALL or individual glyphs
    const glyphsMatch = cCode.match(/FONT_GLYPHS_ALL\[[^\]]*\]\s*=\s*\{([\s\S]*?)\};/);
    if (glyphsMatch && glyphsMatch[1]) {
      const glyphPattern = /\{\s*\.codepoint\s*=\s*([^,]+)\s*,\s*\.x\s*=\s*(-?\d+)\s*,\s*\.y\s*=\s*(-?\d+)\s*,\s*\.width\s*=\s*(\d+)\s*,\s*\.height\s*=\s*(\d+)\s*,\s*\.advance_x\s*=\s*(\d+)\s*\}/g;
      const parsedGlyphs: FontGlyph[] = [];
      let match: RegExpExecArray | null;
      while ((match = glyphPattern.exec(glyphsMatch[1])) !== null) {
        const rawCp = match[1].trim();
        let codepoint = 0;
        let char = '?';
        if (rawCp.startsWith("'") && rawCp.endsWith("'")) {
          const inside = rawCp.slice(1, -1);
          if (inside === "\\'") {
            char = "'";
            codepoint = 39;
          } else if (inside === "\\\\") {
            char = "\\";
            codepoint = 92;
          } else if (inside.length > 0) {
            char = inside;
            codepoint = inside.codePointAt(0) || 0;
          }
        } else if (rawCp.includes("'0' +")) {
          const offset = parseInt(rawCp.replace(/[^0-9]/g, ''), 10);
          codepoint = '0'.charCodeAt(0) + offset;
          char = String.fromCharCode(codepoint);
        } else {
          codepoint = parseInt(rawCp, 16) || parseInt(rawCp, 10) || 0;
          char = String.fromCodePoint(codepoint);
        }

        parsedGlyphs.push({
          char,
          codepoint,
          x: parseInt(match[2], 10),
          y: parseInt(match[3], 10),
          width: parseInt(match[4], 10),
          height: parseInt(match[5], 10),
          advanceX: parseInt(match[6], 10),
        });
      }
      if (parsedGlyphs.length > 0) {
        fontGlyphs = parsedGlyphs;
      }
    }

    // 5. Parse FONT_GLYPHS_SMALL and FONT_GLYPHS_BIG if present
    const parseGlyphsFromTable = (tableName: string): FontGlyph[] => {
      const match = cCode.match(new RegExp(`${tableName}\\[[^\\]]*\\]\\s*=\\s*\\{([\\s\\S]*?)\\};`));
      if (!match || !match[1]) return [];
      const pattern = /\{\s*\.codepoint\s*=\s*([^,]+)\s*,\s*\.x\s*=\s*(-?\d+)\s*,\s*\.y\s*=\s*(-?\d+)\s*,\s*\.width\s*=\s*(\d+)\s*,\s*\.height\s*=\s*(\d+)\s*,\s*\.advance_x\s*=\s*(\d+)\s*\}/g;
      const results: FontGlyph[] = [];
      let m: RegExpExecArray | null;
      while ((m = pattern.exec(match[1])) !== null) {
        const rawCp = m[1].trim();
        let codepoint = 0;
        let char = '?';
        if (rawCp.startsWith("'") && rawCp.endsWith("'")) {
          const inside = rawCp.slice(1, -1);
          if (inside === "\\'") {
            char = "'";
            codepoint = 39;
          } else if (inside === "\\\\") {
            char = "\\";
            codepoint = 92;
          } else if (inside.length > 0) {
            char = inside;
            codepoint = inside.codePointAt(0) || 0;
          }
        } else if (rawCp.includes("'0' +")) {
          const offset = parseInt(rawCp.replace(/[^0-9]/g, ''), 10);
          codepoint = '0'.charCodeAt(0) + offset;
          char = String.fromCharCode(codepoint);
        } else {
          codepoint = parseInt(rawCp, 16) || parseInt(rawCp, 10) || 0;
          char = String.fromCodePoint(codepoint);
        }
        results.push({
          char,
          codepoint,
          x: parseInt(m[2], 10),
          y: parseInt(m[3], 10),
          width: parseInt(m[4], 10),
          height: parseInt(m[5], 10),
          advanceX: parseInt(m[6], 10),
        });
      }
      return results;
    };

    const parsedSmall = parseGlyphsFromTable('FONT_GLYPHS_SMALL');
    const parsedBig = parseGlyphsFromTable('FONT_GLYPHS_BIG');

    if (parsedSmall.length > 0 || parsedBig.length > 0) {
      const mappingMap = new Map<string, FontCharMapping>();
      parsedSmall.forEach(g => {
        const key = g.char.toUpperCase();
        const existing = mappingMap.get(key);
        if (existing) {
          if (!existing.chars.includes(g.char)) existing.chars += g.char;
          existing.small = { x: g.x, y: g.y, width: g.width, height: g.height, advanceX: g.advanceX };
        } else {
          const def = DEFAULT_FONT_MAPPINGS.find(dm => dm.chars.includes(g.char) || dm.chars.toUpperCase().includes(key));
          mappingMap.set(key, {
            id: def ? def.id : `FONT_CHAR_${g.codepoint}`,
            chars: def ? def.chars : g.char,
            small: { x: g.x, y: g.y, width: g.width, height: g.height, advanceX: g.advanceX },
            big: null,
          });
        }
      });
      parsedBig.forEach(g => {
        const key = g.char.toUpperCase();
        const existing = mappingMap.get(key);
        if (existing) {
          if (!existing.chars.includes(g.char)) existing.chars += g.char;
          existing.big = { x: g.x, y: g.y, width: g.width, height: g.height, advanceX: g.advanceX };
        } else {
          const def = DEFAULT_FONT_MAPPINGS.find(dm => dm.chars.includes(g.char) || dm.chars.toUpperCase().includes(key));
          mappingMap.set(key, {
            id: def ? def.id : `FONT_CHAR_${g.codepoint}`,
            chars: def ? def.chars : g.char,
            small: null,
            big: { x: g.x, y: g.y, width: g.width, height: g.height, advanceX: g.advanceX },
          });
        }
      });
      fontMappings = Array.from(mappingMap.values());
    }

    // 5. Parse optional ZMK_DISPLAY_STUDIO_METADATA JSON block
    const metaMatch = cCode.match(/\/\*\s*ZMK_DISPLAY_STUDIO_METADATA\s*([\s\S]*?)\*\//);
    if (metaMatch && metaMatch[1]) {
      try {
        const parsedMeta = JSON.parse(metaMatch[1].trim());
        if (parsedMeta && typeof parsedMeta === 'object') {
          metadata = parsedMeta;
        }
      } catch (e) {
        console.warn('Failed to parse ZMK_DISPLAY_STUDIO_METADATA comment:', e);
      }
    }

    // 6. Parse screen dimensions if defined
    const virtWidthMatch = cCode.match(/#define\s+DISPLAY_VIRTUAL_WIDTH\s+(\d+)/);
    const virtHeightMatch = cCode.match(/#define\s+DISPLAY_VIRTUAL_HEIGHT\s+(\d+)/);
    const screenDims = (virtWidthMatch && virtHeightMatch)
      ? { width: parseInt(virtWidthMatch[1], 10), height: parseInt(virtHeightMatch[1], 10) }
      : undefined;

    // 7. If metadata JSON was missing or incomplete, reconstruct from C layout block arrays
    if (!metadata || (!metadata.leftBlocks && !metadata.rightBlocks)) {
      const parseCBlocks = (arrayName: string, side: 'left' | 'right') => {
        const arrMatch = cCode.match(new RegExp(`${arrayName}\\[[^\\]]*\\]\\s*=\\s*\\{([\\s\\S]*?)\\};`));
        if (!arrMatch || !arrMatch[1]) return undefined;
        const blocks: LayoutBlock[] = [];
        const content = arrMatch[1];
        let depth = 0;
        let start = -1;
        let idx = 0;
        for (let i = 0; i < content.length; i++) {
          if (content[i] === '{') {
            if (depth === 0) start = i;
            depth++;
          } else if (content[i] === '}') {
            depth--;
            if (depth === 0 && start !== -1) {
              const body = content.slice(start + 1, i);
              const typeMatch = body.match(/\.type\s*=\s*([A-Za-z0-9_]+)/);
              const rawType = typeMatch ? typeMatch[1] : '';
              if (rawType && rawType !== 'WIDGET_TYPE_NONE') {
                const xMatch = body.match(/\.x\s*=\s*(-?\d+)/);
                const yMatch = body.match(/\.y\s*=\s*(-?\d+)/);
                const wMatch = body.match(/\.width\s*=\s*(\d+)/);
                const hMatch = body.match(/\.height\s*=\s*(\d+)/);
                const enabledMatch = body.match(/\.enabled\s*=\s*(true|false|1|0)/);
                const textMatch = body.match(/\.custom_text\s*=\s*("(?:[^"\\]|\\.)*"|NULL|0)/);

                let widgetType = 'branding';
                let defaultName = 'Block';
                switch (rawType) {
                  case 'WIDGET_TYPE_OUTPUT_STATUS':
                    widgetType = 'connection';
                    defaultName = 'Output Status';
                    break;
                  case 'WIDGET_TYPE_BATTERY':
                    widgetType = 'battery';
                    defaultName = 'Battery Meter';
                    break;
                  case 'WIDGET_TYPE_LAYER':
                    widgetType = 'layer-banner';
                    defaultName = 'Layer Banner';
                    break;
                  case 'WIDGET_TYPE_WPM':
                    widgetType = 'wpm';
                    defaultName = 'WPM Gauge';
                    break;
                  case 'WIDGET_TYPE_WPM_CHART':
                    widgetType = 'wpm-chart';
                    defaultName = 'WPM Chart';
                    break;
                  case 'WIDGET_TYPE_BRANDING':
                    widgetType = 'branding';
                    defaultName = 'Custom Text';
                    break;
                  case 'WIDGET_TYPE_SPLIT':
                    widgetType = 'split';
                    defaultName = 'Split Link';
                    break;
                  case 'WIDGET_TYPE_SCREENSAVER':
                    widgetType = 'screensaver';
                    defaultName = 'Mascot Image';
                    break;
                  case 'WIDGET_TYPE_CAPS_LOCK':
                    widgetType = 'caps-lock';
                    defaultName = 'Caps Lock';
                    break;
                  case 'WIDGET_TYPE_BONGO':
                    widgetType = 'bongo';
                    defaultName = 'Bongo Cat';
                    break;
                }

                let customText: string | undefined;
                if (textMatch && textMatch[1] && textMatch[1] !== 'NULL' && textMatch[1] !== '0') {
                  try {
                    customText = JSON.parse(textMatch[1]);
                  } catch {
                    customText = textMatch[1].replace(/^"|"$/g, '');
                  }
                }

                const blockId = `${side}-${widgetType}-${idx++}`;
                blocks.push({
                  id: blockId,
                  widgetType,
                  instanceId: `inst_${blockId}`,
                  name: customText || defaultName,
                  x: xMatch ? parseInt(xMatch[1], 10) : 0,
                  y: yMatch ? parseInt(yMatch[1], 10) : 0,
                  width: wMatch ? parseInt(wMatch[1], 10) : 16,
                  height: hMatch ? parseInt(hMatch[1], 10) : 16,
                  enabled: enabledMatch ? (enabledMatch[1] === 'true' || enabledMatch[1] === '1') : true,
                  side,
                });
              }
              start = -1;
            }
          }
        }
        return blocks.length > 0 ? blocks : undefined;
      };

      const leftBlocks = parseCBlocks('LAYOUT_LEFT_ACTIVE_BLOCKS', 'left');
      const rightBlocks = parseCBlocks('LAYOUT_RIGHT_ACTIVE_BLOCKS', 'right');
      const idleLeftBlocks = parseCBlocks('LAYOUT_LEFT_IDLE_BLOCKS', 'left');
      const idleRightBlocks = parseCBlocks('LAYOUT_RIGHT_IDLE_BLOCKS', 'right');

      if (leftBlocks || rightBlocks || idleLeftBlocks || idleRightBlocks || screenDims) {
        metadata = {
          version: 1,
          leftBlocks: leftBlocks || metadata?.leftBlocks,
          rightBlocks: rightBlocks || metadata?.rightBlocks,
          idleLeftBlocks: idleLeftBlocks || metadata?.idleLeftBlocks,
          idleRightBlocks: idleRightBlocks || metadata?.idleRightBlocks,
          screenDimensions: screenDims || metadata?.screenDimensions,
          widgetInstances: metadata?.widgetInstances,
        };
      }
    } else if (screenDims && !metadata.screenDimensions) {
      metadata.screenDimensions = screenDims;
    }
  } catch (err) {
    console.warn('Error parsing C header, falling back to defaults:', err);
  }

  return { symbolsGrid, symbolSlices, fontGrid, fontGlyphs, fontMappings, metadata };
}

/**
 * Generates formatted custom_display_assets.h C code.
 */
export function generateCHeader(
  symbolsGrid: BwpxGrid,
  symbolSlices: SpriteSlice[],
  fontGrid: BwpxGrid,
  fontInput: FontCharMapping[] | FontGlyph[],
  metadata?: HeaderMetadata
): string {
  // Normalize symbols: if any slice or active pixel has negative coords, offset so all are >= 0
  let symMinX = 0;
  let symMinY = 0;
  if (symbolSlices.length > 0) {
    symMinX = Math.min(0, ...symbolSlices.map(s => s.x));
    symMinY = Math.min(0, ...symbolSlices.map(s => s.y));
  }
  const symBounds = symbolsGrid.getBounds();
  if (symBounds.width > 0) {
    symMinX = Math.min(symMinX, symBounds.minX);
    symMinY = Math.min(symMinY, symBounds.minY);
  }
  const symOffsetX = symMinX < 0 ? -symMinX : 0;
  const symOffsetY = symMinY < 0 ? -symMinY : 0;

  const symMaxX = Math.max(127, ...symbolSlices.map(s => s.x + s.width - 1), symBounds.maxX);
  const symMaxY = Math.max(33, ...symbolSlices.map(s => s.y + s.height - 1), symBounds.maxY);
  const symbolsAtlasWidth = symMaxX + symOffsetX + 1;
  const symbolsAtlasHeight = symMaxY + symOffsetY + 1;
  const symbolsStride = Math.ceil(symbolsAtlasWidth / 8);
  const symbolsBytes = symbolsGrid.to1bppBytes(symbolsStride, -symOffsetX, -symOffsetY, symbolsAtlasWidth, symbolsAtlasHeight);

  // Extract small and big glyphs from fontInput
  let smallGlyphs: FontGlyph[] = [];
  let bigGlyphs: FontGlyph[] = [];
  let allGlyphs: FontGlyph[] = [];

  if (fontInput.length > 0 && 'chars' in fontInput[0]) {
    const mappings = fontInput as FontCharMapping[];
    mappings.forEach(m => {
      if (m.small) {
        for (const ch of m.chars) {
          const cp = ch.codePointAt(0) || 0;
          smallGlyphs.push({
            char: ch,
            codepoint: cp,
            x: m.small.x,
            y: m.small.y,
            width: m.small.width,
            height: m.small.height,
            advanceX: m.small.advanceX ?? (m.small.width + 1),
          });
        }
      }
      if (m.big) {
        for (const ch of m.chars) {
          const cp = ch.codePointAt(0) || 0;
          bigGlyphs.push({
            char: ch,
            codepoint: cp,
            x: m.big.x,
            y: m.big.y,
            width: m.big.width,
            height: m.big.height,
            advanceX: m.big.advanceX ?? (m.big.width + 1),
          });
        }
      }
    });
    // Remove duplicate codepoints within lists
    const seenSmall = new Set<number>();
    smallGlyphs = smallGlyphs.filter(g => {
      if (seenSmall.has(g.codepoint)) return false;
      seenSmall.add(g.codepoint);
      return true;
    });
    const seenBig = new Set<number>();
    bigGlyphs = bigGlyphs.filter(g => {
      if (seenBig.has(g.codepoint)) return false;
      seenBig.add(g.codepoint);
      return true;
    });
    allGlyphs = [...smallGlyphs, ...bigGlyphs];
  } else {
    const glyphs = fontInput as FontGlyph[];
    bigGlyphs = glyphs.filter(g => g.codepoint >= 48 && g.codepoint <= 57);
    smallGlyphs = glyphs.filter(g => g.codepoint < 48 || g.codepoint > 57);
    allGlyphs = glyphs;
  }

  // Normalize font bounds
  let fontMinX = 0;
  let fontMinY = 0;
  if (allGlyphs.length > 0) {
    fontMinX = Math.min(0, ...allGlyphs.map(g => g.x));
    fontMinY = Math.min(0, ...allGlyphs.map(g => g.y));
  }
  const fontBounds = fontGrid.getBounds();
  if (fontBounds.width > 0) {
    fontMinX = Math.min(fontMinX, fontBounds.minX);
    fontMinY = Math.min(fontMinY, fontBounds.minY);
  }
  const fontOffsetX = fontMinX < 0 ? -fontMinX : 0;
  const fontOffsetY = fontMinY < 0 ? -fontMinY : 0;

  const fontMaxX = Math.max(127, ...allGlyphs.map(g => g.x + g.width - 1), fontBounds.maxX);
  const fontMaxY = Math.max(21, ...allGlyphs.map(g => g.y + g.height - 1), fontBounds.maxY);
  const fontAtlasWidth = fontMaxX + fontOffsetX + 1;
  const fontAtlasHeight = fontMaxY + fontOffsetY + 1;
  const fontStride = Math.ceil(fontAtlasWidth / 8);
  const fontBytes = fontGrid.to1bppBytes(fontStride, -fontOffsetX, -fontOffsetY, fontAtlasWidth, fontAtlasHeight);

  // Digits and text tables for backward compatibility
  const digitsGlyphs = bigGlyphs.length > 0 ? bigGlyphs : allGlyphs.filter(g => g.codepoint >= 48 && g.codepoint <= 57);
  const textGlyphs = smallGlyphs.length > 0 ? smallGlyphs : allGlyphs.filter(g => g.codepoint < 48 || g.codepoint > 57);

  const virtWidth = metadata?.screenDimensions?.width ?? 32;
  const virtHeight = metadata?.screenDimensions?.height ?? 128;
  const hwWidth = virtHeight;
  const hwHeight = virtWidth;

  let c = `/* Auto-generated 2-Atlas spritesheet architecture for Corne vertical OLED display */
/* Generated by ZMK Display Studio */
#pragma once

#include <stdint.h>
#include <stdbool.h>
#include <stddef.h>

#define DISPLAY_VIRTUAL_WIDTH  ${virtWidth}
#define DISPLAY_VIRTUAL_HEIGHT ${virtHeight}
#define DISPLAY_HW_WIDTH       ${hwWidth}
#define DISPLAY_HW_HEIGHT      ${hwHeight}

/* Sprite slice descriptor */
struct sprite_slice {
    uint8_t x;
    uint8_t y;
    uint8_t width;
    uint8_t height;
};

/* Symbol identifiers */
enum symbol_id {
`;

  symbolSlices.forEach(s => {
    c += `    ${s.id},\n`;
  });
  c += `    SYMBOL_COUNT,\n};\n\n`;

  // Symbols Atlas
  c += `/* Spritesheet 1: Symbols & Icons Atlas (${symbolsAtlasWidth}x${symbolsAtlasHeight}, 1bpp, ${symbolsStride} bytes stride) */\n`;
  c += `#define SYMBOLS_ATLAS_WIDTH  ${symbolsAtlasWidth}\n`;
  c += `#define SYMBOLS_ATLAS_HEIGHT ${symbolsAtlasHeight}\n`;
  c += `#define SYMBOLS_ATLAS_STRIDE ${symbolsStride}\n\n`;
  c += `static const uint8_t SYMBOLS_ATLAS[${symbolsAtlasHeight} * ${symbolsStride}] = {\n`;
  for (let y = 0; y < symbolsAtlasHeight; y++) {
    const rowHex: string[] = [];
    for (let s = 0; s < symbolsStride; s++) {
      const b = symbolsBytes[y * symbolsStride + s];
      rowHex.push(`0x${b.toString(16).toUpperCase().padStart(2, '0')}`);
    }
    c += `    ${rowHex.join(', ')}, // Row ${y}\n`;
  }
  c += `};\n\n`;

  // Symbol Slices table
  c += `static const struct sprite_slice SYMBOL_SLICES[SYMBOL_COUNT] = {\n`;
  symbolSlices.forEach(s => {
    const pad = s.id.padEnd(26, ' ');
    const normX = s.x + symOffsetX;
    const normY = s.y + symOffsetY;
    const meta = `groupId=${s.groupId || s.id} groupOrder=${s.groupOrder || 1} color=${s.color || '#38bdf8'} name=${s.name || ''}`;
    c += `    [${pad}] = { .x = ${normX.toString().padStart(3, ' ')}, .y = ${normY.toString().padStart(2, ' ')}, .width = ${s.width.toString().padStart(2, ' ')}, .height = ${s.height.toString().padStart(2, ' ')} }, // ${meta}\n`;
  });
  c += `};\n\n`;

  // Font structures
  c += `/* Font & Character Atlas structures */
struct font_glyph {
    uint16_t codepoint;
    uint8_t x;
    uint8_t y;
    uint8_t width;
    uint8_t height;
    uint8_t advance_x;
};

struct display_font {
    const uint8_t *atlas;
    uint16_t atlas_width;
    uint16_t atlas_height;
    uint16_t atlas_stride;
    const struct font_glyph *glyphs;
    uint16_t glyph_count;
    uint8_t line_height;
    uint8_t space_advance;
};

/* Spritesheet 2: Font & Character Atlas (${fontAtlasWidth}x${fontAtlasHeight}, 1bpp, ${fontStride} bytes stride) */
#define FONT_ATLAS_WIDTH  ${fontAtlasWidth}
#define FONT_ATLAS_HEIGHT ${fontAtlasHeight}
#define FONT_ATLAS_STRIDE ${fontStride}

static const uint8_t FONT_ATLAS[${fontAtlasHeight} * ${fontStride}] = {
`;
  for (let y = 0; y < fontAtlasHeight; y++) {
    const rowHex: string[] = [];
    for (let s = 0; s < fontStride; s++) {
      const b = fontBytes[y * fontStride + s];
      rowHex.push(`0x${b.toString(16).toUpperCase().padStart(2, '0')}`);
    }
    c += `    ${rowHex.join(', ')}, // Row ${y}\n`;
  }
  c += `};\n\n`;

  // Small glyph table
  c += `/* Small Font Glyphs (${smallGlyphs.length}) */\n`;
  c += `static const struct font_glyph FONT_GLYPHS_SMALL[${Math.max(1, smallGlyphs.length)}] = {\n`;
  smallGlyphs.forEach(g => {
    const cpStr = g.codepoint <= 127 && g.char !== "'" && g.char !== '\\' ? `'${g.char}'` : `0x${g.codepoint.toString(16).toUpperCase().padStart(4, '0')}`;
    c += `    { .codepoint = ${cpStr.padEnd(8, ' ')}, .x = ${(g.x + fontOffsetX).toString().padStart(3, ' ')}, .y = ${(g.y + fontOffsetY).toString().padStart(2, ' ')}, .width = ${g.width.toString().padStart(2, ' ')}, .height = ${g.height.toString().padStart(2, ' ')}, .advance_x = ${g.advanceX.toString().padStart(2, ' ')} }, // ${g.char}\n`;
  });
  if (smallGlyphs.length === 0) {
    c += `    { .codepoint = 0, .x = 0, .y = 0, .width = 0, .height = 0, .advance_x = 0 },\n`;
  }
  c += `};\n\n`;

  // Big glyph table
  c += `/* Big Font Glyphs (${bigGlyphs.length}) */\n`;
  c += `static const struct font_glyph FONT_GLYPHS_BIG[${Math.max(1, bigGlyphs.length)}] = {\n`;
  bigGlyphs.forEach(g => {
    const cpStr = g.codepoint <= 127 && g.char !== "'" && g.char !== '\\' ? `'${g.char}'` : `0x${g.codepoint.toString(16).toUpperCase().padStart(4, '0')}`;
    c += `    { .codepoint = ${cpStr.padEnd(8, ' ')}, .x = ${(g.x + fontOffsetX).toString().padStart(3, ' ')}, .y = ${(g.y + fontOffsetY).toString().padStart(2, ' ')}, .width = ${g.width.toString().padStart(2, ' ')}, .height = ${g.height.toString().padStart(2, ' ')}, .advance_x = ${g.advanceX.toString().padStart(2, ' ')} }, // ${g.char}\n`;
  });
  if (bigGlyphs.length === 0) {
    c += `    { .codepoint = 0, .x = 0, .y = 0, .width = 0, .height = 0, .advance_x = 0 },\n`;
  }
  c += `};\n\n`;

  // Backward compatibility: Digits glyph table
  c += `static const struct font_glyph FONT_GLYPHS_DIGITS[${Math.max(1, digitsGlyphs.length)}] = {\n`;
  digitsGlyphs.forEach(g => {
    const cpStr = g.codepoint >= 48 && g.codepoint <= 57 ? `'0' + ${(g.codepoint - 48)}` : `0x${g.codepoint.toString(16).toUpperCase().padStart(4, '0')}`;
    c += `    { .codepoint = ${cpStr.padEnd(8, ' ')}, .x = ${(g.x + fontOffsetX).toString().padStart(3, ' ')}, .y = ${(g.y + fontOffsetY).toString().padStart(2, ' ')}, .width = ${g.width.toString().padStart(2, ' ')}, .height = ${g.height.toString().padStart(2, ' ')}, .advance_x = ${g.advanceX.toString().padStart(2, ' ')} }, // ${g.char}\n`;
  });
  if (digitsGlyphs.length === 0) {
    c += `    { .codepoint = 0, .x = 0, .y = 0, .width = 0, .height = 0, .advance_x = 0 },\n`;
  }
  c += `};\n\n`;

  // Backward compatibility: Text glyph table
  c += `static const struct font_glyph FONT_GLYPHS_TEXT[${Math.max(1, textGlyphs.length)}] = {\n`;
  textGlyphs.forEach(g => {
    const cpStr = g.codepoint <= 127 && g.char !== "'" && g.char !== '\\' ? `'${g.char}'` : `0x${g.codepoint.toString(16).toUpperCase().padStart(4, '0')}`;
    c += `    { .codepoint = ${cpStr.padEnd(8, ' ')}, .x = ${(g.x + fontOffsetX).toString().padStart(3, ' ')}, .y = ${(g.y + fontOffsetY).toString().padStart(2, ' ')}, .width = ${g.width.toString().padStart(2, ' ')}, .height = ${g.height.toString().padStart(2, ' ')}, .advance_x = ${g.advanceX.toString().padStart(2, ' ')} }, // ${g.char}\n`;
  });
  if (textGlyphs.length === 0) {
    c += `    { .codepoint = 0, .x = 0, .y = 0, .width = 0, .height = 0, .advance_x = 0 },\n`;
  }
  c += `};\n\n`;

  // All glyphs table
  c += `static const struct font_glyph FONT_GLYPHS_ALL[${Math.max(1, allGlyphs.length)}] = {\n`;
  allGlyphs.forEach(g => {
    const cpStr = (g.codepoint >= 48 && g.codepoint <= 57)
      ? `'0' + ${(g.codepoint - 48)}`
      : (g.codepoint <= 127 && g.char !== "'" && g.char !== '\\' ? `'${g.char}'` : `0x${g.codepoint.toString(16).toUpperCase().padStart(4, '0')}`);
    c += `    { .codepoint = ${cpStr.padEnd(8, ' ')}, .x = ${(g.x + fontOffsetX).toString().padStart(3, ' ')}, .y = ${(g.y + fontOffsetY).toString().padStart(2, ' ')}, .width = ${g.width.toString().padStart(2, ' ')}, .height = ${g.height.toString().padStart(2, ' ')}, .advance_x = ${g.advanceX.toString().padStart(2, ' ')} }, // ${g.char}\n`;
  });
  if (allGlyphs.length === 0) {
    c += `    { .codepoint = 0, .x = 0, .y = 0, .width = 0, .height = 0, .advance_x = 0 },\n`;
  }
  c += `};\n\n`;

  // Font descriptors
  c += `static const struct display_font font_small = {
    .atlas = FONT_ATLAS,
    .atlas_width = FONT_ATLAS_WIDTH,
    .atlas_height = FONT_ATLAS_HEIGHT,
    .atlas_stride = FONT_ATLAS_STRIDE,
    .glyphs = FONT_GLYPHS_SMALL,
    .glyph_count = ${smallGlyphs.length},
    .line_height = 6,
    .space_advance = 4,
};

static const struct display_font font_big = {
    .atlas = FONT_ATLAS,
    .atlas_width = FONT_ATLAS_WIDTH,
    .atlas_height = FONT_ATLAS_HEIGHT,
    .atlas_stride = FONT_ATLAS_STRIDE,
    .glyphs = FONT_GLYPHS_BIG,
    .glyph_count = ${bigGlyphs.length},
    .line_height = 11,
    .space_advance = 6,
};

static const struct display_font font_digits = {
    .atlas = FONT_ATLAS,
    .atlas_width = FONT_ATLAS_WIDTH,
    .atlas_height = FONT_ATLAS_HEIGHT,
    .atlas_stride = FONT_ATLAS_STRIDE,
    .glyphs = FONT_GLYPHS_DIGITS,
    .glyph_count = ${digitsGlyphs.length},
    .line_height = 10,
    .space_advance = 6,
};

static const struct display_font font_text = {
    .atlas = FONT_ATLAS,
    .atlas_width = FONT_ATLAS_WIDTH,
    .atlas_height = FONT_ATLAS_HEIGHT,
    .atlas_stride = FONT_ATLAS_STRIDE,
    .glyphs = FONT_GLYPHS_TEXT,
    .glyph_count = ${textGlyphs.length},
    .line_height = 5,
    .space_advance = 3,
};

static const struct display_font font_default = {
    .atlas = FONT_ATLAS,
    .atlas_width = FONT_ATLAS_WIDTH,
    .atlas_height = FONT_ATLAS_HEIGHT,
    .atlas_stride = FONT_ATLAS_STRIDE,
    .glyphs = FONT_GLYPHS_ALL,
    .glyph_count = ${allGlyphs.length},
    .line_height = 10,
    .space_advance = 3,
};
`;

  if (metadata && (metadata.leftBlocks || metadata.rightBlocks || metadata.idleLeftBlocks || metadata.idleRightBlocks)) {
    c += `\n/* Interactive Screen Layout & Widget Architecture */\n`;
    c += `#define HAS_CUSTOM_LAYOUT_BLOCKS 1\n\n`;
    c += `enum display_widget_type {\n`;
    c += `    WIDGET_TYPE_NONE = 0,\n`;
    c += `    WIDGET_TYPE_OUTPUT_STATUS,\n`;
    c += `    WIDGET_TYPE_BATTERY,\n`;
    c += `    WIDGET_TYPE_LAYER,\n`;
    c += `    WIDGET_TYPE_WPM,\n`;
    c += `    WIDGET_TYPE_WPM_CHART,\n`;
    c += `    WIDGET_TYPE_BRANDING,\n`;
    c += `    WIDGET_TYPE_SPLIT,\n`;
    c += `    WIDGET_TYPE_SCREENSAVER,\n`;
    c += `    WIDGET_TYPE_CAPS_LOCK,\n`;
    c += `    WIDGET_TYPE_BONGO,\n`;
    c += `};\n\n`;
    c += `#define MAX_BLOCK_SYMBOLS 16\n`;
    c += `#define MAX_BLOCK_TEXTS 16\n\n`;
    c += `struct display_layout_block {\n`;
    c += `    uint8_t type;\n`;
    c += `    int16_t x;\n`;
    c += `    int16_t y;\n`;
    c += `    uint8_t width;\n`;
    c += `    uint8_t height;\n`;
    c += `    bool enabled;\n`;
    c += `    uint8_t mode;\n`;
    c += `    int16_t param1;\n`;
    c += `    int16_t param2;\n`;
    c += `    uint8_t symbol_count;\n`;
    c += `    uint16_t symbol_ids[MAX_BLOCK_SYMBOLS];\n`;
    c += `    uint8_t text_count;\n`;
    c += `    const char *text_entries[MAX_BLOCK_TEXTS];\n`;
    c += `    const char *custom_text;\n`;
    c += `    uint16_t symbol_id;\n`;
    c += `};\n\n`;

    const formatBlockToC = (block: LayoutBlock): string => {
      const normType = (block.widgetType || block.id).toLowerCase();
      let enumType = 'WIDGET_TYPE_NONE';
      if (normType.includes('battery')) enumType = 'WIDGET_TYPE_BATTERY';
      else if (normType.includes('connection') || normType.includes('output') || normType.includes('profile')) enumType = 'WIDGET_TYPE_OUTPUT_STATUS';
      else if (normType.includes('split')) enumType = 'WIDGET_TYPE_SPLIT';
      else if (normType.includes('caps')) enumType = 'WIDGET_TYPE_CAPS_LOCK';
      else if (normType.includes('layer')) enumType = 'WIDGET_TYPE_LAYER';
      else if (normType === 'wpm-chart' || normType.includes('chart')) enumType = 'WIDGET_TYPE_WPM_CHART';
      else if (normType.includes('wpm')) enumType = 'WIDGET_TYPE_WPM';
      else if (normType.includes('branding') || normType.includes('text')) enumType = 'WIDGET_TYPE_BRANDING';
      else if (normType.includes('screensaver') || normType.includes('art') || normType.includes('mascot')) enumType = 'WIDGET_TYPE_SCREENSAVER';
      else if (normType.includes('bongo')) enumType = 'WIDGET_TYPE_BONGO';

      const lookupKey = (normType.includes('connection') || normType.includes('output')) ? 'connection'
        : normType.includes('battery') ? 'battery'
        : normType.includes('layer') ? 'layer-banner'
        : (normType === 'wpm-chart' || normType.includes('chart')) ? 'wpm-chart'
        : normType.includes('wpm') ? 'wpm'
        : normType.includes('branding') ? 'branding'
        : normType.includes('split') ? 'split'
        : normType.includes('screensaver') ? 'screensaver'
        : normType.includes('caps') ? 'caps-lock'
        : normType.includes('bongo') ? 'bongo'
        : normType;

      const instance = block.instanceId && metadata.widgetInstances?.[lookupKey]
        ? metadata.widgetInstances[lookupKey].find(i => i.id === block.instanceId)
        : metadata.widgetInstances?.[lookupKey]?.[0];

      const mode = (instance?.config?.mode === 'font') ? 1 : 0;
      let param1 = 0;
      let param2 = 0;
      if (enumType === 'WIDGET_TYPE_WPM_CHART') {
        param1 = instance?.config?.wpmChart?.gridSize ?? 4;
        param2 = instance?.config?.wpmChart?.targetSpeed ?? 100;
      } else if (enumType === 'WIDGET_TYPE_WPM') {
        param2 = instance?.config?.targetValue ?? 100;
      } else if (enumType === 'WIDGET_TYPE_BATTERY') {
        param1 = instance?.config?.fontDivisionCount ?? 2;
      }

      const symbolIds: string[] = [];
      if (instance?.config?.groupIds && instance.config.groupIds.length > 0) {
        for (const gid of instance.config.groupIds) {
          const match = symbolSlices.find(s => (s.groupId === gid && s.groupOrder === 1) || s.groupId === gid || s.id === gid);
          if (match && symbolIds.length < 16) {
            symbolIds.push(match.id);
          }
        }
      } else if (instance?.config?.groupId) {
        const gid = instance.config.groupId;
        const members = symbolSlices.filter(s => s.groupId === gid).sort((a, b) => a.groupOrder - b.groupOrder);
        if (members.length > 0) {
          for (const m of members) {
            if (symbolIds.length < 16) symbolIds.push(m.id);
          }
        } else {
          const match = symbolSlices.find(s => s.id === gid);
          if (match) symbolIds.push(match.id);
        }
      }

      if (symbolIds.length === 0) {
        if (enumType === 'WIDGET_TYPE_BATTERY') {
          const bsym = symbolSlices.filter(s => s.id.includes('BATTERY') || s.id.includes('CHARGE') || s.groupId.includes('CHARGE'));
          if (bsym.length > 0) {
            bsym.slice(0, 16).forEach(s => symbolIds.push(s.id));
          }
        } else if (enumType === 'WIDGET_TYPE_OUTPUT_STATUS') {
          const usb = symbolSlices.find(s => s.id.includes('USB'));
          if (usb) symbolIds.push(usb.id);
          const bt = symbolSlices.find(s => s.id.includes('BLUETOOTH') || s.id.includes('BLE'));
          if (bt && symbolIds.length < 16) symbolIds.push(bt.id);
        } else if (enumType === 'WIDGET_TYPE_SPLIT') {
          const splits = symbolSlices.filter(s => s.id.includes('SPLIT'));
          if (splits.length > 0) {
            splits.slice(0, 16).forEach(s => symbolIds.push(s.id));
          }
        } else if (enumType === 'WIDGET_TYPE_LAYER') {
          const layers = symbolSlices.filter(s => s.id.includes('LAYER') || s.groupId.includes('LAYER'));
          if (layers.length > 0) {
            layers.slice(0, 16).forEach(s => symbolIds.push(s.id));
          }
        } else if (enumType === 'WIDGET_TYPE_WPM') {
          const wpms = symbolSlices.filter(s => s.id.includes('SPEED') || s.id.includes('WPM') || s.id.includes('ARROW'));
          if (wpms.length > 0) {
            wpms.slice(0, 16).forEach(s => symbolIds.push(s.id));
          }
        } else if (enumType === 'WIDGET_TYPE_BONGO') {
          const bongos = symbolSlices.filter(s => s.id.includes('BONGO') || s.groupId.includes('BONGO'));
          if (bongos.length > 0) {
            bongos.slice(0, 16).forEach(s => symbolIds.push(s.id));
          }
        }
        if (symbolIds.length === 0 && symbolSlices.length > 0) {
          symbolIds.push(symbolSlices[0].id);
        }
      }

      const symbolId = symbolIds[0] || (symbolSlices[0]?.id || '0');
      const symbolCount = symbolIds.length;
      const symbolIdsStr = symbolIds.length > 0 ? `{ ${symbolIds.join(', ')} }` : `{ 0 }`;

      const textEntries: string[] = [];
      if (instance?.config?.textEntries && instance.config.textEntries.length > 0) {
        for (const t of instance.config.textEntries) {
          if (textEntries.length < 16) {
            textEntries.push(JSON.stringify(t));
          }
        }
      }
      const textCount = textEntries.length;
      const textEntriesStr = textEntries.length > 0 ? `{ ${textEntries.join(', ')} }` : `{ NULL }`;

      let customText = 'NULL';
      if (textEntries.length > 0) {
        customText = textEntries[0];
      } else if (enumType === 'WIDGET_TYPE_BRANDING' && block.name && !block.name.includes('Default') && !block.name.includes('Text') && !block.name.includes('Model')) {
        customText = JSON.stringify(block.name);
      }

      const enabled = block.enabled ? 'true' : 'false';
      const bx = block.x ?? 0;
      const by = block.y;
      const bw = block.width ?? 0;
      const bh = block.height;

      return `    { .type = ${enumType}, .x = ${bx}, .y = ${by}, .width = ${bw}, .height = ${bh}, .enabled = ${enabled}, .mode = ${mode}, .param1 = ${param1}, .param2 = ${param2}, .symbol_count = ${symbolCount}, .symbol_ids = ${symbolIdsStr}, .text_count = ${textCount}, .text_entries = ${textEntriesStr}, .custom_text = ${customText}, .symbol_id = ${symbolId} }`;
    };

    const emitBlockArray = (name: string, countName: string, blocks?: LayoutBlock[]) => {
      const all = blocks || [];
      const len = Math.max(1, all.length);
      c += `static const struct display_layout_block ${name}[${len}] = {\n`;
      if (all.length > 0) {
        all.forEach(b => {
          c += `${formatBlockToC(b)},\n`;
        });
      } else {
        c += `    { .type = WIDGET_TYPE_NONE, .enabled = false },\n`;
      }
      c += `};\n`;
      c += `#define ${countName} ${all.length}\n\n`;
    };

    emitBlockArray('LAYOUT_LEFT_ACTIVE_BLOCKS', 'LAYOUT_LEFT_ACTIVE_COUNT', metadata.leftBlocks);
    emitBlockArray('LAYOUT_LEFT_IDLE_BLOCKS', 'LAYOUT_LEFT_IDLE_COUNT', metadata.idleLeftBlocks);
    emitBlockArray('LAYOUT_RIGHT_ACTIVE_BLOCKS', 'LAYOUT_RIGHT_ACTIVE_COUNT', metadata.rightBlocks);
    emitBlockArray('LAYOUT_RIGHT_IDLE_BLOCKS', 'LAYOUT_RIGHT_IDLE_COUNT', metadata.idleRightBlocks);
  }

  if (metadata) {
    c += `\n/* ZMK_DISPLAY_STUDIO_METADATA\n${JSON.stringify(metadata, null, 2)}\n*/\n`;
  }

  return c;
}


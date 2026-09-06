import { BwpxGrid } from '../bwpx/core/BwpxGrid';
import type { SpriteSlice, FontGlyph, FontCharMapping } from '../types/zmk';
import { DEFAULT_SYMBOL_SLICES, DEFAULT_FONT_GLYPHS, DEFAULT_FONT_MAPPINGS } from '../types/zmk';
import { createDefaultSymbolsGrid, createDefaultFontGrid } from './defaultAssets';

export interface ParsedAssets {
  symbolsGrid: BwpxGrid;
  symbolSlices: SpriteSlice[];
  fontGrid: BwpxGrid;
  fontGlyphs: FontGlyph[];
  fontMappings: FontCharMapping[];
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

  try {
    // 1. Parse SYMBOLS_ATLAS hex bytes
    const symbolsMatch = cCode.match(/SYMBOLS_ATLAS\[\s*\d+\s*\*\s*\d+\s*\]\s*=\s*\{([^}]+)\}/s);
    if (symbolsMatch && symbolsMatch[1]) {
      const hexTokens = symbolsMatch[1].match(/0x[0-9a-fA-F]{1,2}/g);
      if (hexTokens && hexTokens.length === 34 * 16) {
        const bytes = new Uint8Array(hexTokens.map(h => parseInt(h, 16)));
        symbolsGrid = BwpxGrid.from1bppBytes(bytes, 128, 34, 16);
      }
    }

    // 2. Parse FONT_ATLAS hex bytes
    const fontMatch = cCode.match(/FONT_ATLAS\[\s*\d+\s*\*\s*\d+\s*\]\s*=\s*\{([^}]+)\}/s);
    if (fontMatch && fontMatch[1]) {
      const hexTokens = fontMatch[1].match(/0x[0-9a-fA-F]{1,2}/g);
      if (hexTokens && hexTokens.length === 22 * 16) {
        const bytes = new Uint8Array(hexTokens.map(h => parseInt(h, 16)));
        fontGrid = BwpxGrid.from1bppBytes(bytes, 128, 22, 16);
      }
    }

    // 3. Parse SYMBOL_SLICES
    const slicesMatch = cCode.match(/SYMBOL_SLICES\[[^\]]*\]\s*=\s*\{([^}]+(?:\{[^}]+\}[^}]+)*)\};/s);
    if (slicesMatch && slicesMatch[1]) {
      const slicePattern = /\[\s*([A-Za-z0-9_]+)\s*\]\s*=\s*\{\s*\.x\s*=\s*(\d+)\s*,\s*\.y\s*=\s*(\d+)\s*,\s*\.width\s*=\s*(\d+)\s*,\s*\.height\s*=\s*(\d+)\s*\}/g;
      const parsedSlices: SpriteSlice[] = [];
      let match: RegExpExecArray | null;
      while ((match = slicePattern.exec(slicesMatch[1])) !== null) {
        const id = match[1];
        const x = parseInt(match[2], 10);
        const y = parseInt(match[3], 10);
        const width = parseInt(match[4], 10);
        const height = parseInt(match[5], 10);
        const existing = DEFAULT_SYMBOL_SLICES.find(s => s.id === id);
        parsedSlices.push({
          id,
          name: existing ? existing.name : id.replace(/^SYMBOL_/, '').replace(/_/g, ' '),
          x,
          y,
          width,
          height,
          color: existing?.color || '#38bdf8',
        });
      }
      if (parsedSlices.length > 0) {
        symbolSlices = parsedSlices;
      }
    }

    // 4. Parse FONT_GLYPHS_ALL or individual glyphs
    const glyphsMatch = cCode.match(/FONT_GLYPHS_ALL\[[^\]]*\]\s*=\s*\{([^}]+(?:\{[^}]+\}[^}]+)*)\};/s);
    if (glyphsMatch && glyphsMatch[1]) {
      const glyphPattern = /\{\s*\.codepoint\s*=\s*([^,]+)\s*,\s*\.x\s*=\s*(\d+)\s*,\s*\.y\s*=\s*(\d+)\s*,\s*\.width\s*=\s*(\d+)\s*,\s*\.height\s*=\s*(\d+)\s*,\s*\.advance_x\s*=\s*(\d+)\s*\}/g;
      const parsedGlyphs: FontGlyph[] = [];
      let match: RegExpExecArray | null;
      while ((match = glyphPattern.exec(glyphsMatch[1])) !== null) {
        const rawCp = match[1].trim();
        let codepoint = 0;
        let char = '?';
        if (rawCp.startsWith("'") && rawCp.endsWith("'")) {
          codepoint = rawCp.charCodeAt(1);
          char = String.fromCharCode(codepoint);
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
      const match = cCode.match(new RegExp(`${tableName}\\[[^\\]]*\\]\\s*=\\s*\\{([^}]+(?:\\{[^}]+\\}[^}]+)*)\\};`, 's'));
      if (!match || !match[1]) return [];
      const pattern = /\{\s*\.codepoint\s*=\s*([^,]+)\s*,\s*\.x\s*=\s*(\d+)\s*,\s*\.y\s*=\s*(\d+)\s*,\s*\.width\s*=\s*(\d+)\s*,\s*\.height\s*=\s*(\d+)\s*,\s*\.advance_x\s*=\s*(\d+)\s*\}/g;
      const results: FontGlyph[] = [];
      let m: RegExpExecArray | null;
      while ((m = pattern.exec(match[1])) !== null) {
        const rawCp = m[1].trim();
        let codepoint = 0;
        let char = '?';
        if (rawCp.startsWith("'") && rawCp.endsWith("'")) {
          codepoint = rawCp.charCodeAt(1);
          char = String.fromCharCode(codepoint);
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
          mappingMap.set(key, {
            id: `FONT_CHAR_${g.codepoint}`,
            chars: g.char,
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
          mappingMap.set(key, {
            id: `FONT_CHAR_${g.codepoint}`,
            chars: g.char,
            small: null,
            big: { x: g.x, y: g.y, width: g.width, height: g.height, advanceX: g.advanceX },
          });
        }
      });
      fontMappings = Array.from(mappingMap.values());
    }
  } catch (err) {
    console.warn('Error parsing C header, falling back to defaults:', err);
  }

  return { symbolsGrid, symbolSlices, fontGrid, fontGlyphs, fontMappings };
}

/**
 * Generates formatted custom_display_assets.h C code.
 */
export function generateCHeader(
  symbolsGrid: BwpxGrid,
  symbolSlices: SpriteSlice[],
  fontGrid: BwpxGrid,
  fontInput: FontCharMapping[] | FontGlyph[]
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

  let c = `/* Auto-generated 2-Atlas spritesheet architecture for Corne vertical OLED display */
/* Generated by ZMK Display Studio */
#pragma once

#include <stdint.h>
#include <stdbool.h>
#include <stddef.h>

#define DISPLAY_VIRTUAL_WIDTH  32
#define DISPLAY_VIRTUAL_HEIGHT 128
#define DISPLAY_HW_WIDTH       128
#define DISPLAY_HW_HEIGHT      32

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
  c += `#define SYMBOL_BRACKET_LAYER(idx) ((enum symbol_id)(SYMBOL_BRACKET_LAYER_0 + ((idx) & 3)))\n`;
  c += `#define SYMBOL_SKULL_LAYER(idx)   ((enum symbol_id)(SYMBOL_SKULL_LAYER_0 + ((idx) & 3)))\n\n`;

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
    c += `    [${pad}] = { .x = ${normX.toString().padStart(3, ' ')}, .y = ${normY.toString().padStart(2, ' ')}, .width = ${s.width.toString().padStart(2, ' ')}, .height = ${s.height.toString().padStart(2, ' ')} },\n`;
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

  return c;
}


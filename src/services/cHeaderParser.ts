import { BwpxGrid } from '../bwpx/core/BwpxGrid';
import type { SpriteSlice, FontGlyph, FontCharMapping, LayoutBlock, DisplayScreen } from '../types/zmk';
import type { WidgetInstanceMap } from '../types/widget';
import {
  DEFAULT_SYMBOL_SLICES,
  DEFAULT_FONT_GLYPHS,
  DEFAULT_FONT_MAPPINGS,
  DEFAULT_CENTRAL_LAYOUT_BLOCKS,
  DEFAULT_PERIPHERAL_LAYOUT_BLOCKS,
  DEFAULT_IDLE_CENTRAL_BLOCKS,
  DEFAULT_IDLE_PERIPHERAL_BLOCKS,
} from '../types/zmk';
import defaultInstallHeader from '../assets/scyan_assets.install.h?raw';
import { measureTextWidth, getWidgetNaturalSize, getWidgetDefinition, normalizeWidgetType, resolveWidgetInstance } from './widgetRegistry';
import { getShieldDefaultRotation, type LoadedShieldUnit } from '../data/shieldsData';

export interface PeripheralScreenData {
  name?: string;
  blocks?: LayoutBlock[];
  idleBlocks?: LayoutBlock[];
  screenDimensions?: { width: number; height: number };
  rotation?: 0 | 90 | 180 | 270;
  idleScreensEnabled?: boolean;
  idleTimeoutSec?: number;
  screenOffTimeoutSec?: number;
}

export interface HeaderMetadata {
  version: 1 | 2;
  /** Decoupled display screens dictionary (keyed e.g. 'display-1', 'display-2') */
  displays?: Record<string, DisplayScreen>;
  /** Physical shield units loaded in the workspace */
  shields?: LoadedShieldUnit[];
  /** Mapping of shield unit ID to mounted display ID (e.g. { 'corne_left': 'display-1', 'corne_right': 'display-2' }) */
  displayAssignments?: Record<string, string | null>;
  /** Active keyboard shield ID (e.g. 'corne', 'lily58', 'sofle', etc.) */
  shieldId?: string;
  /** Canonical Central & Peripheral display block tables */
  centralBlocks?: LayoutBlock[];
  peripheralBlocks?: LayoutBlock[];
  idleCentralBlocks?: LayoutBlock[];
  idlePeripheralBlocks?: LayoutBlock[];
  /** Dynamic peripheral screens dictionary for arbitrary N peripherals (keyed by screen ID e.g. 'peripheral-2') */
  peripheralScreens?: Record<string, PeripheralScreenData>;
  screenDimensions?: { width: number; height: number };
  rotation?: 0 | 90 | 180 | 270;
  widgetInstances?: WidgetInstanceMap;
  /** Seconds of inactivity before switching to the idle layout (default 30) */
  idleTimeoutSec?: number;
  /** Seconds after going idle before the OLED turns off completely (default 60) */
  screenOffTimeoutSec?: number;
  /** Whether idle screens are enabled (default true) */
  idleScreensEnabled?: boolean;
  /** Whether central and peripheral share the same display & power settings (default true) */
  symmetricSettings?: boolean;
  /** Peripheral screen dimensions when asymmetric */
  peripheralScreenDimensions?: { width: number; height: number };
  /** Peripheral display rotation when asymmetric */
  peripheralRotation?: 0 | 90 | 180 | 270;
  rightRotation?: 0 | 90 | 180 | 270;
  /** Peripheral idle screens toggle when asymmetric */
  peripheralIdleScreensEnabled?: boolean;
  /** Peripheral idle timeout in seconds when asymmetric */
  peripheralIdleTimeoutSec?: number;
  /** Peripheral screen off timeout in seconds when asymmetric */
  peripheralScreenOffTimeoutSec?: number;
  /** List of currently enabled screens (e.g. ['central', 'peripheral']) */
  enabledScreens?: string[];
  /** Bongo Cat tap animation duration in milliseconds (default 60, matches CONFIG_SCYAN_BONGO_TAP_MS) */
  bongoTapMs?: number;
  /** Bongo Cat debounce interval in milliseconds (default 100) */
  bongoDebounceMs?: number;
  /** Active keyboard layer names loaded from ZMK keymap */
  layerNames?: string[];
  /** Legacy fields for backward compatibility when parsing older generated headers */
  leftBlocks?: LayoutBlock[];
  rightBlocks?: LayoutBlock[];
  idleLeftBlocks?: LayoutBlock[];
  idleRightBlocks?: LayoutBlock[];
  dongleBlocks?: LayoutBlock[];
  idleDongleBlocks?: LayoutBlock[];
  rightScreenDimensions?: { width: number; height: number };
  rightIdleScreensEnabled?: boolean;
  rightIdleTimeoutSec?: number;
  rightScreenOffTimeoutSec?: number;
}

export interface ParsedAssets {
  symbolsGrid: BwpxGrid;
  symbolSlices: SpriteSlice[];
  fontGrid: BwpxGrid;
  fontGlyphs: FontGlyph[];
  fontMappings: FontCharMapping[];
  metadata?: HeaderMetadata;
}

let isParsingDefault = false;
let cachedDefaultAssets: ParsedAssets | null = null;

export function getDefaultInstallHeader(): string {
  return defaultInstallHeader;
}

export function getDefaultAssets(): ParsedAssets {
  if (!cachedDefaultAssets) {
    isParsingDefault = true;
    try {
      cachedDefaultAssets = parseCHeader(defaultInstallHeader);
    } finally {
      isParsingDefault = false;
    }
  }
  return {
    symbolsGrid: cachedDefaultAssets.symbolsGrid.clone(),
    symbolSlices: JSON.parse(JSON.stringify(cachedDefaultAssets.symbolSlices)),
    fontGrid: cachedDefaultAssets.fontGrid.clone(),
    fontGlyphs: JSON.parse(JSON.stringify(cachedDefaultAssets.fontGlyphs)),
    fontMappings: JSON.parse(JSON.stringify(cachedDefaultAssets.fontMappings)),
    metadata: cachedDefaultAssets.metadata ? JSON.parse(JSON.stringify(cachedDefaultAssets.metadata)) : undefined,
  };
}

/**
 * Parses C source code of scyan_assets.h into BwpxGrids and slice/glyph tables.
 */
export function parseCHeader(cCode: string): ParsedAssets {
  let symbolsGrid: BwpxGrid;
  let symbolSlices: SpriteSlice[];
  let fontGrid: BwpxGrid;
  let fontGlyphs: FontGlyph[];
  let fontMappings: FontCharMapping[];
  let metadata: HeaderMetadata | undefined;

  if (isParsingDefault || !cachedDefaultAssets) {
    symbolsGrid = new BwpxGrid(128, 34);
    symbolSlices = [...DEFAULT_SYMBOL_SLICES];
    fontGrid = new BwpxGrid(128, 22);
    fontGlyphs = [...DEFAULT_FONT_GLYPHS];
    fontMappings = [...DEFAULT_FONT_MAPPINGS];
  } else {
    symbolsGrid = cachedDefaultAssets.symbolsGrid.clone();
    symbolSlices = JSON.parse(JSON.stringify(cachedDefaultAssets.symbolSlices));
    fontGrid = cachedDefaultAssets.fontGrid.clone();
    fontGlyphs = JSON.parse(JSON.stringify(cachedDefaultAssets.fontGlyphs));
    fontMappings = JSON.parse(JSON.stringify(cachedDefaultAssets.fontMappings));
    metadata = cachedDefaultAssets.metadata ? JSON.parse(JSON.stringify(cachedDefaultAssets.metadata)) : undefined;
  }

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
    const hasMetadataComment = !!(metaMatch && metaMatch[1]);
    if (metaMatch && metaMatch[1]) {
      try {
        const parsedMeta = JSON.parse(metaMatch[1].trim());
        if (parsedMeta && typeof parsedMeta === 'object') {
          metadata = parsedMeta;
          if (metadata) {
            if (metadata.displays && Object.keys(metadata.displays).length > 0) {
              const d1 = metadata.displays['display-1'];
              const d2 = metadata.displays['display-2'];
              if (d1) {
                metadata.centralBlocks = d1.blocks;
                metadata.idleCentralBlocks = d1.idleBlocks;
                metadata.screenDimensions = d1.dimensions;
                metadata.rotation = d1.rotation;
                metadata.idleTimeoutSec = d1.idleTimeoutSec;
                metadata.screenOffTimeoutSec = d1.screenOffTimeoutSec;
                metadata.idleScreensEnabled = d1.idleScreensEnabled;
              }
              if (d2) {
                metadata.peripheralBlocks = d2.blocks;
                metadata.idlePeripheralBlocks = d2.idleBlocks;
                metadata.peripheralScreenDimensions = d2.dimensions;
                metadata.rightScreenDimensions = d2.dimensions;
                metadata.peripheralRotation = d2.rotation;
                metadata.rightRotation = d2.rotation;
                metadata.peripheralIdleTimeoutSec = d2.idleTimeoutSec;
                metadata.rightIdleTimeoutSec = d2.idleTimeoutSec;
                metadata.peripheralScreenOffTimeoutSec = d2.screenOffTimeoutSec;
                metadata.rightScreenOffTimeoutSec = d2.screenOffTimeoutSec;
                metadata.peripheralIdleScreensEnabled = d2.idleScreensEnabled;
                metadata.rightIdleScreensEnabled = d2.idleScreensEnabled;
              }
              if (!metadata.peripheralScreens) {
                const pScreens: Record<string, PeripheralScreenData> = {};
                Object.entries(metadata.displays).forEach(([dId, d]) => {
                  if (dId !== 'display-1' && dId !== 'display-2') {
                    const pKey = dId.startsWith('display-') ? `peripheral-${parseInt(dId.replace('display-', ''), 10) - 1}` : dId;
                    pScreens[pKey] = {
                      name: d.name,
                      blocks: d.blocks,
                      idleBlocks: d.idleBlocks,
                      screenDimensions: d.dimensions,
                      rotation: d.rotation,
                      idleScreensEnabled: d.idleScreensEnabled,
                      idleTimeoutSec: d.idleTimeoutSec,
                      screenOffTimeoutSec: d.screenOffTimeoutSec,
                    };
                  }
                });
                if (Object.keys(pScreens).length > 0) {
                  metadata.peripheralScreens = pScreens;
                }
              }
            } else {
              // Backward compatibility: build displays dictionary from v1 fields
              const d1Blocks = metadata.centralBlocks || (metadata as any).leftBlocks || DEFAULT_CENTRAL_LAYOUT_BLOCKS;
              const d1Idle = metadata.idleCentralBlocks || (metadata as any).idleLeftBlocks || DEFAULT_IDLE_CENTRAL_BLOCKS;
              const d2Blocks = metadata.peripheralBlocks || (metadata as any).rightBlocks;
              const d2Idle = metadata.idlePeripheralBlocks || (metadata as any).idleRightBlocks;

              const displaysDict: Record<string, DisplayScreen> = {
                'display-1': {
                  id: 'display-1',
                  name: 'Display 1',
                  dimensions: metadata.screenDimensions || { width: 32, height: 128 },
                  rotation: metadata.rotation ?? 90,
                  blocks: d1Blocks,
                  idleBlocks: d1Idle,
                  idleTimeoutSec: metadata.idleTimeoutSec ?? 30,
                  screenOffTimeoutSec: metadata.screenOffTimeoutSec ?? 60,
                  idleScreensEnabled: metadata.idleScreensEnabled ?? true,
                },
              };

              if (d2Blocks || d2Idle || metadata.enabledScreens?.includes('peripheral')) {
                const pDims = metadata.peripheralScreenDimensions || (metadata as any).rightScreenDimensions || metadata.screenDimensions || { width: 32, height: 128 };
                displaysDict['display-2'] = {
                  id: 'display-2',
                  name: 'Display 2',
                  dimensions: pDims,
                  rotation: metadata.peripheralRotation ?? metadata.rightRotation ?? metadata.rotation ?? 90,
                  blocks: d2Blocks || DEFAULT_PERIPHERAL_LAYOUT_BLOCKS,
                  idleBlocks: d2Idle || DEFAULT_IDLE_PERIPHERAL_BLOCKS,
                  idleTimeoutSec: metadata.peripheralIdleTimeoutSec ?? (metadata as any).rightIdleTimeoutSec ?? metadata.idleTimeoutSec ?? 30,
                  screenOffTimeoutSec: metadata.peripheralScreenOffTimeoutSec ?? (metadata as any).rightScreenOffTimeoutSec ?? metadata.screenOffTimeoutSec ?? 60,
                  idleScreensEnabled: metadata.peripheralIdleScreensEnabled ?? (metadata as any).rightIdleScreensEnabled ?? metadata.idleScreensEnabled ?? true,
                };
              }

              if (metadata.peripheralScreens) {
                let slot = 3;
                Object.entries(metadata.peripheralScreens).forEach(([, p]) => {
                  const dId = `display-${slot++}`;
                  displaysDict[dId] = {
                    id: dId,
                    name: p.name || `Display ${slot - 1}`,
                    dimensions: p.screenDimensions || { width: 32, height: 128 },
                    rotation: p.rotation ?? 90,
                    blocks: p.blocks || [],
                    idleBlocks: p.idleBlocks || [],
                    idleTimeoutSec: p.idleTimeoutSec ?? 30,
                    screenOffTimeoutSec: p.screenOffTimeoutSec ?? 60,
                    idleScreensEnabled: p.idleScreensEnabled ?? false,
                  };
                });
              }

              metadata.displays = displaysDict;
            }

            if (metadata.leftBlocks && !metadata.centralBlocks) {
              metadata.centralBlocks = metadata.leftBlocks;
            } else if (metadata.centralBlocks && !metadata.leftBlocks) {
              (metadata as any).leftBlocks = metadata.centralBlocks;
            }
            if (metadata.rightBlocks && !metadata.peripheralBlocks) {
              metadata.peripheralBlocks = metadata.rightBlocks;
            } else if (metadata.peripheralBlocks && !metadata.rightBlocks) {
              (metadata as any).rightBlocks = metadata.peripheralBlocks;
            }
            if (metadata.idleLeftBlocks && !metadata.idleCentralBlocks) {
              metadata.idleCentralBlocks = metadata.idleLeftBlocks;
            } else if (metadata.idleCentralBlocks && !metadata.idleLeftBlocks) {
              (metadata as any).idleLeftBlocks = metadata.idleCentralBlocks;
            }
            if (metadata.idleRightBlocks && !metadata.idlePeripheralBlocks) {
              metadata.idlePeripheralBlocks = metadata.idleRightBlocks;
            } else if (metadata.idlePeripheralBlocks && !metadata.idleRightBlocks) {
              (metadata as any).idleRightBlocks = metadata.idlePeripheralBlocks;
            }
            if (metadata.peripheralScreenDimensions && !metadata.rightScreenDimensions) {
              (metadata as any).rightScreenDimensions = metadata.peripheralScreenDimensions;
            } else if (metadata.rightScreenDimensions && !metadata.peripheralScreenDimensions) {
              metadata.peripheralScreenDimensions = metadata.rightScreenDimensions;
            }
            if (metadata.enabledScreens) {
              metadata.enabledScreens = metadata.enabledScreens
                .map((s: string) => (s === 'left' ? 'central' : s === 'right' ? 'peripheral' : s))
                .filter((s: string) => s !== 'dongle');
            } else {
              metadata.enabledScreens = (metadata.version === 2 && metadata.displays)
                ? Object.keys(metadata.displays)
                : ['central', 'peripheral'];
            }
            if (metadata.widgetInstances) {
              const instMap = { ...metadata.widgetInstances };
              if (instMap['loop'] && !instMap['animation']) {
                instMap['animation'] = instMap['loop'].map((i: any) => ({ ...i, widgetTypeId: 'animation' }));
              } else if (instMap['animation'] && !instMap['loop']) {
                instMap['loop'] = instMap['animation'].map((i: any) => ({ ...i, widgetTypeId: 'loop' }));
              }
              metadata.widgetInstances = instMap;
            }
          }
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

    // 6b. Parse display power-management timer defines & idle screens configuration
    const idleTimeoutMsMatch = cCode.match(/#define\s+(?:SCYAN_IDLE_TIMEOUT_MS_CENTRAL|SCYAN_IDLE_TIMEOUT_MS_LEFT|ZMK_DISPLAY_IDLE_TIMEOUT_MS|CONFIG_SCYAN_IDLE_TIMEOUT_MS|SCYAN_IDLE_TIMEOUT_MS)\s+(\d+)/);
    const sleepTimeoutMsMatch = cCode.match(/#define\s+(?:SCYAN_SLEEP_TIMEOUT_MS_CENTRAL|SCYAN_SLEEP_TIMEOUT_MS_LEFT|ZMK_DISPLAY_SLEEP_TIMEOUT_MS|CONFIG_ZMK_IDLE_TIMEOUT|SCYAN_SLEEP_TIMEOUT_MS)\s+(\d+)/);
    const idleScreensMatch = cCode.match(/#define\s+(?:SCYAN_IDLE_SCREENS_ENABLED_CENTRAL|SCYAN_IDLE_SCREENS_ENABLED_LEFT|ZMK_DISPLAY_IDLE_SCREENS_ENABLED|SCYAN_IDLE_SCREENS_ENABLED)\s+(\d+)/);
    const parsedIdleTimeoutSec = idleTimeoutMsMatch ? Math.round(parseInt(idleTimeoutMsMatch[1], 10) / 1000) : undefined;
    const parsedScreenOffTimeoutSec = sleepTimeoutMsMatch ? Math.round(parseInt(sleepTimeoutMsMatch[1], 10) / 1000) : undefined;
    const parsedIdleScreensEnabled = idleScreensMatch ? (parseInt(idleScreensMatch[1], 10) !== 0) : undefined;

    // 6c. Parse peripheral-specific dimensions & power timers (if defined for asymmetric hardware)
    const rightVirtWidthMatch = cCode.match(/#define\s+(?:DISPLAY_VIRTUAL_WIDTH_PERIPHERAL|DISPLAY_VIRTUAL_WIDTH_RIGHT)\s+(\d+)/);
    const rightVirtHeightMatch = cCode.match(/#define\s+(?:DISPLAY_VIRTUAL_HEIGHT_PERIPHERAL|DISPLAY_VIRTUAL_HEIGHT_RIGHT)\s+(\d+)/);
    const rightScreenDims = (rightVirtWidthMatch && rightVirtHeightMatch)
      ? { width: parseInt(rightVirtWidthMatch[1], 10), height: parseInt(rightVirtHeightMatch[1], 10) }
      : undefined;

    const rightIdleTimeoutMsMatch = cCode.match(/#define\s+(?:SCYAN_IDLE_TIMEOUT_MS_PERIPHERAL|SCYAN_IDLE_TIMEOUT_MS_RIGHT|CONFIG_SCYAN_IDLE_TIMEOUT_MS_RIGHT)\s+(\d+)/);
    const rightSleepTimeoutMsMatch = cCode.match(/#define\s+(?:SCYAN_SLEEP_TIMEOUT_MS_PERIPHERAL|SCYAN_SLEEP_TIMEOUT_MS_RIGHT|CONFIG_SCYAN_SLEEP_TIMEOUT_MS_RIGHT)\s+(\d+)/);
    const rightIdleScreensMatch = cCode.match(/#define\s+(?:SCYAN_IDLE_SCREENS_ENABLED_PERIPHERAL|SCYAN_IDLE_SCREENS_ENABLED_RIGHT)\s+(\d+)/);
    const parsedRightIdleTimeoutSec = rightIdleTimeoutMsMatch ? Math.round(parseInt(rightIdleTimeoutMsMatch[1], 10) / 1000) : undefined;
    const parsedRightScreenOffTimeoutSec = rightSleepTimeoutMsMatch ? Math.round(parseInt(rightSleepTimeoutMsMatch[1], 10) / 1000) : undefined;
    const parsedRightIdleScreensEnabled = rightIdleScreensMatch ? (parseInt(rightIdleScreensMatch[1], 10) !== 0) : undefined;

    // 6d. Parse display rotation defines
    const rotMacroMatch = cCode.match(/#define\s+(?:DISPLAY_ROTATION|DISPLAY_ROTATION_DEGREES|SCYAN_ROTATION)\s+(\d+)/);
    let parsedRotation: (0 | 90 | 180 | 270) | undefined;
    if (rotMacroMatch) {
      const val = parseInt(rotMacroMatch[1], 10);
      if (val === 0 || val === 90 || val === 180 || val === 270) parsedRotation = val;
    }
    if (parsedRotation === undefined) {
      if (/#define\s+CONFIG_SCYAN_ROTATION_270\s+1/.test(cCode)) parsedRotation = 270;
      else if (/#define\s+CONFIG_SCYAN_ROTATION_180\s+1/.test(cCode)) parsedRotation = 180;
      else if (/#define\s+CONFIG_SCYAN_ROTATION_0\s+1/.test(cCode)) parsedRotation = 0;
      else if (/#define\s+CONFIG_SCYAN_ROTATION_90\s+1/.test(cCode)) parsedRotation = 90;
    }

    const rightRotMacroMatch = cCode.match(/#define\s+(?:DISPLAY_ROTATION_PERIPHERAL|DISPLAY_ROTATION_RIGHT|SCYAN_ROTATION_PERIPHERAL|SCYAN_ROTATION_RIGHT)\s+(\d+)/);
    let parsedRightRotation: (0 | 90 | 180 | 270) | undefined;
    if (rightRotMacroMatch) {
      const val = parseInt(rightRotMacroMatch[1], 10);
      if (val === 0 || val === 90 || val === 180 || val === 270) parsedRightRotation = val;
    }

    const isAsymmetricC = !!(rightScreenDims || parsedRightRotation !== undefined || parsedRightIdleTimeoutSec !== undefined || parsedRightScreenOffTimeoutSec !== undefined || parsedRightIdleScreensEnabled !== undefined);

    // 7. If metadata JSON was missing or incomplete, reconstruct from C layout block arrays
    if (!hasMetadataComment || !metadata || (!metadata.displays && !metadata.centralBlocks && !metadata.peripheralBlocks && !(metadata as any).leftBlocks && !metadata.peripheralScreens)) {
      const parseCBlocks = (arrayName: string, side: 'central' | 'peripheral' | string) => {
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
              if (rawType && rawType !== 'WIDGET_TYPE_NONE' && rawType !== '0') {
                const xMatch = body.match(/\.x\s*=\s*(-?\d+)/);
                const yMatch = body.match(/\.y\s*=\s*(-?\d+)/);
                const wMatch = body.match(/\.width\s*=\s*(\d+)/);
                const hMatch = body.match(/\.height\s*=\s*(\d+)/);
                const enabledMatch = body.match(/\.enabled\s*=\s*(true|false|1|0)/);
                const textMatch = body.match(/\.custom_text\s*=\s*("(?:[^"\\]|\\.)*"|NULL|0)/);

                let widgetType = 'branding';
                let defaultName = 'Block';
                switch (rawType) {
                  case '1':
                  case 'WIDGET_TYPE_OUTPUT_STATUS':
                    widgetType = 'connection';
                    defaultName = 'Output Status';
                    break;
                  case '2':
                  case 'WIDGET_TYPE_BATTERY':
                    widgetType = 'battery';
                    defaultName = 'Battery Meter';
                    break;
                  case '3':
                  case 'WIDGET_TYPE_LAYER':
                    widgetType = 'layer-banner';
                    defaultName = 'Layer Banner';
                    break;
                  case '4':
                  case 'WIDGET_TYPE_WPM':
                    widgetType = 'wpm';
                    defaultName = 'WPM Gauge';
                    break;
                  case '5':
                  case 'WIDGET_TYPE_WPM_CHART':
                    widgetType = 'wpm-chart';
                    defaultName = 'WPM Chart';
                    break;
                  case '6':
                  case 'WIDGET_TYPE_BRANDING':
                    widgetType = 'branding';
                    defaultName = 'Custom Text';
                    break;
                  case '7':
                  case 'WIDGET_TYPE_SPLIT':
                    widgetType = 'split';
                    defaultName = 'Split Link';
                    break;
                  case '8':
                  case 'WIDGET_TYPE_SCREENSAVER':
                    widgetType = 'screensaver';
                    defaultName = 'Mascot Image';
                    break;
                  case '9':
                  case 'WIDGET_TYPE_CAPS_LOCK':
                    widgetType = 'caps-lock';
                    defaultName = 'Caps Lock';
                    break;
                  case '10':
                  case 'WIDGET_TYPE_BONGO':
                    widgetType = 'bongo';
                    defaultName = 'Bongo Cat';
                    break;
                  case '11':
                  case 'WIDGET_TYPE_LOOP':
                    widgetType = 'animation';
                    defaultName = 'Animation';
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

                const p1Match = body.match(/\.param1\s*=\s*(-?\d+)/);
                const p2Match = body.match(/\.param2\s*=\s*(-?\d+)/);
                const p3Match = body.match(/\.param3\s*=\s*(-?\d+)/);
                const param1 = p1Match ? parseInt(p1Match[1], 10) : 0;
                const param2 = p2Match ? parseInt(p2Match[1], 10) : 0;
                const param3 = p3Match ? parseInt(p3Match[1], 10) : 0;

                const blockId = `${side}-${widgetType}-${idx++}`;
                const parsedBlock: LayoutBlock = {
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
                };
                blocks.push(parsedBlock);

                if (widgetType === 'wpm-chart') {
                  if (!metadata) metadata = { version: 1 };
                  if (!metadata.widgetInstances) metadata.widgetInstances = {};
                  if (!metadata.widgetInstances['wpm-chart'] || metadata.widgetInstances['wpm-chart'].length === 0) {
                    metadata.widgetInstances['wpm-chart'] = [{
                      id: parsedBlock.instanceId!,
                      widgetTypeId: 'wpm-chart',
                      label: 'WPM Chart',
                      config: {
                        mode: 'symbol',
                        wpmChart: {
                          width: parsedBlock.width ?? 32,
                          height: parsedBlock.height ?? 24,
                          gridSize: param1 || 4,
                          targetSpeed: param2 || 100,
                          timeWindow: param3 || 30,
                        },
                      },
                      slots: {},
                    }];
                  } else {
                    const inst = metadata.widgetInstances['wpm-chart'][0];
                    if (inst && inst.config && inst.config.wpmChart) {
                      if (!inst.config.wpmChart.timeWindow) {
                        inst.config.wpmChart.timeWindow = param3 || 30;
                      }
                    }
                  }
                } else if (widgetType === 'bongo') {
                  if (!metadata) metadata = { version: 1 };
                  if (!metadata.widgetInstances) metadata.widgetInstances = {};
                  if (!metadata.widgetInstances['bongo'] || metadata.widgetInstances['bongo'].length === 0) {
                    const symIdMatch = body.match(/\.symbol_id\s*=\s*([A-Za-z0-9_]+)/);
                    const symIdsMatch = body.match(/\.symbol_ids\s*=\s*\{([^}]+)\}/);
                    let resolvedGroupId = 'SYMBOL_SLICE_40_4046';
                    if (symIdsMatch && symIdsMatch[1]) {
                      const firstSym = symIdsMatch[1].split(',')[0].trim();
                      const sliceMatch = symbolSlices.find(s => s.id === firstSym);
                      resolvedGroupId = sliceMatch?.groupId || firstSym;
                    } else if (symIdMatch && symIdMatch[1]) {
                      const sliceMatch = symbolSlices.find(s => s.id === symIdMatch[1]);
                      resolvedGroupId = sliceMatch?.groupId || symIdMatch[1];
                    }

                    metadata.widgetInstances['bongo'] = [{
                      id: parsedBlock.instanceId!,
                      widgetTypeId: 'bongo',
                      label: 'Bongo Cat',
                      config: {
                        mode: 'symbol',
                        groupId: resolvedGroupId,
                        textEntries: [customText || '(=^.^=)'],
                        bongoTapMs: 60,
                        bongoDebounceMs: 100,
                      },
                      slots: {},
                    }];
                  }
                } else if (widgetType === 'animation' || widgetType === 'loop') {
                  if (!metadata) metadata = { version: 1 };
                  if (!metadata.widgetInstances) metadata.widgetInstances = {};
                  if (!metadata.widgetInstances['animation'] && !metadata.widgetInstances['loop']) {
                    const symIdMatch = body.match(/\.symbol_id\s*=\s*([A-Za-z0-9_]+)/);
                    const symIdsMatch = body.match(/\.symbol_ids\s*=\s*\{([^}]+)\}/);
                    let resolvedGroupId = '';
                    if (symIdsMatch && symIdsMatch[1]) {
                      const firstSym = symIdsMatch[1].split(',')[0].trim();
                      const sliceMatch = symbolSlices.find(s => s.id === firstSym);
                      resolvedGroupId = sliceMatch?.groupId || firstSym;
                    } else if (symIdMatch && symIdMatch[1]) {
                      const sliceMatch = symbolSlices.find(s => s.id === symIdMatch[1]);
                      resolvedGroupId = sliceMatch?.groupId || symIdMatch[1];
                    }

                    const animInst = {
                      id: parsedBlock.instanceId!,
                      widgetTypeId: 'animation',
                      label: 'Animation',
                      config: {
                        mode: 'symbol' as const,
                        groupId: resolvedGroupId,
                        loopSpeedMs: param1 || 250,
                        loop: param2 !== 1,
                      },
                      slots: {},
                    };
                    metadata.widgetInstances['animation'] = [animInst];
                    metadata.widgetInstances['loop'] = [{ ...animInst, widgetTypeId: 'loop' }];
                  }
                }
              }
              start = -1;
            }
          }
        }
        return blocks.length > 0 ? blocks : undefined;
      };

      const centralBlocks = parseCBlocks('LAYOUT_DISPLAY_1_ACTIVE_BLOCKS', 'display-1') || parseCBlocks('LAYOUT_CENTRAL_ACTIVE_BLOCKS', 'central') || parseCBlocks('LAYOUT_LEFT_ACTIVE_BLOCKS', 'central');
      const peripheralBlocks = parseCBlocks('LAYOUT_DISPLAY_2_ACTIVE_BLOCKS', 'display-2') || parseCBlocks('LAYOUT_PERIPHERAL_ACTIVE_BLOCKS', 'peripheral') || parseCBlocks('LAYOUT_RIGHT_ACTIVE_BLOCKS', 'peripheral');
      const idleCentralBlocks = parseCBlocks('LAYOUT_DISPLAY_1_IDLE_BLOCKS', 'display-1') || parseCBlocks('LAYOUT_CENTRAL_IDLE_BLOCKS', 'central') || parseCBlocks('LAYOUT_LEFT_IDLE_BLOCKS', 'central');
      const idlePeripheralBlocks = parseCBlocks('LAYOUT_DISPLAY_2_IDLE_BLOCKS', 'display-2') || parseCBlocks('LAYOUT_PERIPHERAL_IDLE_BLOCKS', 'peripheral') || parseCBlocks('LAYOUT_RIGHT_IDLE_BLOCKS', 'peripheral');

      const tertiaryActive = parseCBlocks('LAYOUT_DISPLAY_3_ACTIVE_BLOCKS', 'display-3') || parseCBlocks('LAYOUT_PERIPHERAL_2_ACTIVE_BLOCKS', 'display-3');
      const tertiaryIdle = parseCBlocks('LAYOUT_DISPLAY_3_IDLE_BLOCKS', 'display-3') || parseCBlocks('LAYOUT_PERIPHERAL_2_IDLE_BLOCKS', 'display-3');

      if (centralBlocks || peripheralBlocks || idleCentralBlocks || idlePeripheralBlocks || tertiaryActive || tertiaryIdle || screenDims) {
        const resolvedCentral = centralBlocks || (hasMetadataComment ? metadata?.centralBlocks : undefined);
        const resolvedPeripheral = peripheralBlocks || (hasMetadataComment ? metadata?.peripheralBlocks : undefined);
        const resolvedIdleCentral = idleCentralBlocks || (hasMetadataComment ? metadata?.idleCentralBlocks : undefined);
        const resolvedIdlePeripheral = idlePeripheralBlocks || (hasMetadataComment ? metadata?.idlePeripheralBlocks : undefined);
        const resolvedPeripheralDims = rightScreenDims || (hasMetadataComment ? metadata?.peripheralScreenDimensions : undefined);
        const resolvedRotation = (hasMetadataComment ? metadata?.rotation : undefined) ?? parsedRotation ?? (metadata?.shieldId ? getShieldDefaultRotation(metadata.shieldId) : (screenDims && screenDims.width < screenDims.height ? 90 : 0));
        const resolvedPeripheralRot = (hasMetadataComment ? (metadata?.peripheralRotation ?? metadata?.rightRotation) : undefined) ?? parsedRightRotation ?? (isAsymmetricC && rightScreenDims ? (rightScreenDims.width < rightScreenDims.height ? 90 : 0) : resolvedRotation);

        const fallbackDisplays: Record<string, DisplayScreen> = {
          'display-1': {
            id: 'display-1',
            name: 'Display 1',
            dimensions: screenDims || metadata?.screenDimensions || { width: 32, height: 128 },
            rotation: resolvedRotation,
            blocks: resolvedCentral || DEFAULT_CENTRAL_LAYOUT_BLOCKS,
            idleBlocks: resolvedIdleCentral || DEFAULT_IDLE_CENTRAL_BLOCKS,
            idleTimeoutSec: (hasMetadataComment ? metadata?.idleTimeoutSec : undefined) ?? parsedIdleTimeoutSec ?? 30,
            screenOffTimeoutSec: (hasMetadataComment ? metadata?.screenOffTimeoutSec : undefined) ?? parsedScreenOffTimeoutSec ?? 60,
            idleScreensEnabled: (hasMetadataComment ? metadata?.idleScreensEnabled : undefined) ?? parsedIdleScreensEnabled ?? true,
          },
        };

        if (resolvedPeripheral || resolvedIdlePeripheral) {
          fallbackDisplays['display-2'] = {
            id: 'display-2',
            name: 'Display 2',
            dimensions: resolvedPeripheralDims || screenDims || { width: 32, height: 128 },
            rotation: resolvedPeripheralRot,
            blocks: resolvedPeripheral || DEFAULT_PERIPHERAL_LAYOUT_BLOCKS,
            idleBlocks: resolvedIdlePeripheral || DEFAULT_IDLE_PERIPHERAL_BLOCKS,
            idleTimeoutSec: (hasMetadataComment ? metadata?.peripheralIdleTimeoutSec : undefined) ?? parsedRightIdleTimeoutSec ?? 30,
            screenOffTimeoutSec: (hasMetadataComment ? metadata?.peripheralScreenOffTimeoutSec : undefined) ?? parsedRightScreenOffTimeoutSec ?? 60,
            idleScreensEnabled: (hasMetadataComment ? metadata?.peripheralIdleScreensEnabled : undefined) ?? parsedRightIdleScreensEnabled ?? true,
          };
        }

        if (tertiaryActive || tertiaryIdle) {
          fallbackDisplays['display-3'] = {
            id: 'display-3',
            name: 'Display 3',
            dimensions: resolvedPeripheralDims || screenDims || { width: 32, height: 128 },
            rotation: resolvedPeripheralRot,
            blocks: tertiaryActive || [],
            idleBlocks: tertiaryIdle || [],
            idleTimeoutSec: (hasMetadataComment ? metadata?.peripheralIdleTimeoutSec : undefined) ?? parsedRightIdleTimeoutSec ?? 30,
            screenOffTimeoutSec: (hasMetadataComment ? metadata?.peripheralScreenOffTimeoutSec : undefined) ?? parsedRightScreenOffTimeoutSec ?? 60,
            idleScreensEnabled: (hasMetadataComment ? metadata?.peripheralIdleScreensEnabled : undefined) ?? parsedRightIdleScreensEnabled ?? false,
          };
        }

        // Dynamically detect higher slotted display arrays (LAYOUT_DISPLAY_4_*, etc.)
        const slotRegex = /LAYOUT_DISPLAY_(\d+)_ACTIVE_BLOCKS/g;
        let slotMatch: RegExpExecArray | null;
        while ((slotMatch = slotRegex.exec(cCode)) !== null) {
          const slotNum = parseInt(slotMatch[1], 10);
          if (slotNum >= 4) {
            const dId = `display-${slotNum}`;
            const sActive = parseCBlocks(`LAYOUT_DISPLAY_${slotNum}_ACTIVE_BLOCKS`, dId);
            const sIdle = parseCBlocks(`LAYOUT_DISPLAY_${slotNum}_IDLE_BLOCKS`, dId);
            if (sActive || sIdle) {
              fallbackDisplays[dId] = {
                id: dId,
                name: `Display ${slotNum}`,
                dimensions: resolvedPeripheralDims || screenDims || { width: 32, height: 128 },
                rotation: resolvedPeripheralRot,
                blocks: sActive || [],
                idleBlocks: sIdle || [],
                idleTimeoutSec: 30,
                screenOffTimeoutSec: 60,
                idleScreensEnabled: false,
              };
            }
          }
        }

        metadata = {
          version: hasMetadataComment && metadata?.version ? metadata.version : 2,
          shields: hasMetadataComment ? metadata?.shields : undefined,
          displayAssignments: hasMetadataComment ? metadata?.displayAssignments : undefined,
          displays: fallbackDisplays,
          centralBlocks: resolvedCentral,
          peripheralBlocks: resolvedPeripheral,
          idleCentralBlocks: resolvedIdleCentral,
          idlePeripheralBlocks: resolvedIdlePeripheral,
          leftBlocks: resolvedCentral,
          rightBlocks: resolvedPeripheral,
          idleLeftBlocks: resolvedIdleCentral,
          idleRightBlocks: resolvedIdlePeripheral,
          screenDimensions: screenDims || metadata?.screenDimensions,
          peripheralScreens: hasMetadataComment ? metadata?.peripheralScreens : undefined,
          widgetInstances: metadata?.widgetInstances,
          idleTimeoutSec: (hasMetadataComment ? metadata?.idleTimeoutSec : undefined) ?? parsedIdleTimeoutSec,
          screenOffTimeoutSec: (hasMetadataComment ? metadata?.screenOffTimeoutSec : undefined) ?? parsedScreenOffTimeoutSec,
          idleScreensEnabled: (hasMetadataComment ? metadata?.idleScreensEnabled : undefined) ?? parsedIdleScreensEnabled,
          symmetricSettings: (hasMetadataComment ? metadata?.symmetricSettings : undefined) ?? (!isAsymmetricC),
          rotation: resolvedRotation,
          peripheralScreenDimensions: resolvedPeripheralDims,
          peripheralRotation: resolvedPeripheralRot,
          rightScreenDimensions: resolvedPeripheralDims,
          rightRotation: resolvedPeripheralRot,
          peripheralIdleTimeoutSec: (hasMetadataComment ? metadata?.peripheralIdleTimeoutSec : undefined) ?? parsedRightIdleTimeoutSec,
          rightIdleTimeoutSec: (hasMetadataComment ? metadata?.peripheralIdleTimeoutSec : undefined) ?? parsedRightIdleTimeoutSec,
          peripheralScreenOffTimeoutSec: (hasMetadataComment ? metadata?.peripheralScreenOffTimeoutSec : undefined) ?? parsedRightScreenOffTimeoutSec,
          rightScreenOffTimeoutSec: (hasMetadataComment ? metadata?.peripheralScreenOffTimeoutSec : undefined) ?? parsedRightScreenOffTimeoutSec,
          peripheralIdleScreensEnabled: (hasMetadataComment ? metadata?.peripheralIdleScreensEnabled : undefined) ?? parsedRightIdleScreensEnabled,
          rightIdleScreensEnabled: (hasMetadataComment ? metadata?.peripheralIdleScreensEnabled : undefined) ?? parsedRightIdleScreensEnabled,
          enabledScreens: (hasMetadataComment && metadata?.enabledScreens)
            ? metadata.enabledScreens
                .map(s => (s === 'left' ? 'central' : s === 'right' ? 'peripheral' : s))
                .filter(s => s !== 'dongle')
            : ((resolvedPeripheral || resolvedIdlePeripheral) ? ['central', 'peripheral'] : ['central']),
          shieldId: hasMetadataComment ? metadata?.shieldId : undefined,
        };
      }
    }

    if (!hasMetadataComment) {
      if (screenDims) {
        if (!metadata) metadata = { version: 1 };
        metadata.screenDimensions = screenDims;
        metadata.rotation = parsedRotation ?? (screenDims.width < screenDims.height ? 90 : 0);
      }
      if (rightScreenDims) {
        if (!metadata) metadata = { version: 1 };
        metadata.peripheralScreenDimensions = rightScreenDims;
        metadata.rightScreenDimensions = rightScreenDims;
        metadata.peripheralRotation = parsedRightRotation ?? (rightScreenDims.width < rightScreenDims.height ? 90 : 0);
        metadata.rightRotation = metadata.peripheralRotation;
      }
    } else if (screenDims && (!metadata || !metadata.screenDimensions)) {
      if (!metadata) metadata = { version: 1 };
      metadata.screenDimensions = screenDims;
    }
    // Merge parsed timer values and rotation into existing metadata if not already present
    if (metadata) {
      if (metadata.rotation === undefined) {
        if (parsedRotation !== undefined) {
          metadata.rotation = parsedRotation;
        } else if (metadata.shieldId) {
          metadata.rotation = getShieldDefaultRotation(metadata.shieldId);
        } else if (metadata.screenDimensions) {
          metadata.rotation = metadata.screenDimensions.width < metadata.screenDimensions.height ? 90 : 0;
        } else {
          metadata.rotation = 90;
        }
      }
      if (metadata.peripheralRotation === undefined) {
        if (metadata.symmetricSettings === false && parsedRightRotation !== undefined) {
          metadata.peripheralRotation = parsedRightRotation;
        } else if (metadata.symmetricSettings === false && metadata.rightRotation !== undefined) {
          metadata.peripheralRotation = metadata.rightRotation;
        } else if (metadata.symmetricSettings === false && metadata.peripheralScreenDimensions) {
          metadata.peripheralRotation = metadata.peripheralScreenDimensions.width < metadata.peripheralScreenDimensions.height ? 90 : 0;
        } else {
          metadata.peripheralRotation = metadata.rotation;
        }
      }
      if (metadata.rightRotation === undefined) {
        metadata.rightRotation = metadata.peripheralRotation;
      }
      if (parsedIdleTimeoutSec !== undefined && metadata.idleTimeoutSec === undefined) {
        metadata.idleTimeoutSec = parsedIdleTimeoutSec;
      }
      if (parsedScreenOffTimeoutSec !== undefined && metadata.screenOffTimeoutSec === undefined) {
        metadata.screenOffTimeoutSec = parsedScreenOffTimeoutSec;
      }
      if (parsedIdleScreensEnabled !== undefined && metadata.idleScreensEnabled === undefined) {
        metadata.idleScreensEnabled = parsedIdleScreensEnabled;
      }
      if (metadata.symmetricSettings === undefined) {
        if (metadata.peripheralScreenDimensions || isAsymmetricC) {
          metadata.symmetricSettings = false;
        } else {
          metadata.symmetricSettings = true;
        }
      }
      if (rightScreenDims && !metadata.peripheralScreenDimensions) {
        metadata.peripheralScreenDimensions = rightScreenDims;
      }
      if (parsedRightIdleTimeoutSec !== undefined && metadata.peripheralIdleTimeoutSec === undefined) {
        metadata.peripheralIdleTimeoutSec = parsedRightIdleTimeoutSec;
      }
      if (parsedRightScreenOffTimeoutSec !== undefined && metadata.peripheralScreenOffTimeoutSec === undefined) {
        metadata.peripheralScreenOffTimeoutSec = parsedRightScreenOffTimeoutSec;
      }
      if (parsedRightIdleScreensEnabled !== undefined && metadata.peripheralIdleScreensEnabled === undefined) {
        metadata.peripheralIdleScreensEnabled = parsedRightIdleScreensEnabled;
      }

      // Reconcile blocks with widget instances for wpm-chart to prevent stale dimensions
      const reconcileChartBlocks = (blockList?: LayoutBlock[]) => {
        if (!blockList || !metadata?.widgetInstances?.['wpm-chart']) return;
        blockList.forEach(block => {
          const type = block.widgetType || block.id;
          const normType = (type.includes('chart') || type === 'wpm-chart') ? 'wpm-chart' : type;
          if (normType === 'wpm-chart') {
            const inst = block.instanceId
              ? metadata!.widgetInstances!['wpm-chart'].find(i => i.id === block.instanceId)
              : metadata!.widgetInstances!['wpm-chart'][0];
            if (inst?.config?.wpmChart) {
              if (inst.config.wpmChart.width !== undefined) block.width = inst.config.wpmChart.width;
              if (inst.config.wpmChart.height !== undefined) block.height = inst.config.wpmChart.height;
            }
          }
        });
      };
      reconcileChartBlocks(metadata.centralBlocks);
      reconcileChartBlocks(metadata.peripheralBlocks);
      reconcileChartBlocks(metadata.idleCentralBlocks);
      reconcileChartBlocks(metadata.idlePeripheralBlocks);
      if (metadata.peripheralScreens) {
        Object.values(metadata.peripheralScreens).forEach(ps => {
          reconcileChartBlocks(ps.blocks);
          reconcileChartBlocks(ps.idleBlocks);
        });
      }

      // Reconcile blocks with widget instances for wpm to prevent stale dimensions
      const reconcileWpmBlocks = (blockList?: LayoutBlock[]) => {
        if (!blockList || !metadata?.widgetInstances?.['wpm']) return;
        const wpmDef = getWidgetDefinition('wpm');
        if (!wpmDef) return;
        blockList.forEach(block => {
          const type = block.widgetType || block.id;
          const normType = normalizeWidgetType(type);
          if (normType === 'wpm') {
            const inst = block.instanceId
              ? metadata!.widgetInstances!['wpm'].find(i => i.id === block.instanceId)
              : metadata!.widgetInstances!['wpm'][0];
            if (inst) {
              const naturalSize = getWidgetNaturalSize(wpmDef, symbolSlices, inst, parsedSmall, fontMappings);
              block.width = naturalSize.width;
              block.height = naturalSize.height;
            }
          }
        });
      };
      reconcileWpmBlocks(metadata.centralBlocks);
      reconcileWpmBlocks(metadata.peripheralBlocks);
      reconcileWpmBlocks(metadata.idleCentralBlocks);
      reconcileWpmBlocks(metadata.idlePeripheralBlocks);
      if (metadata.peripheralScreens) {
        Object.values(metadata.peripheralScreens).forEach(ps => {
          reconcileWpmBlocks(ps.blocks);
          reconcileWpmBlocks(ps.idleBlocks);
        });
      }

      // Reconcile blocks with widget instances for animation/loop to ensure natural dimensions
      const reconcileAnimationBlocks = (blockList?: LayoutBlock[]) => {
        if (!blockList) return;
        const animDef = getWidgetDefinition('animation');
        if (!animDef) return;
        blockList.forEach(block => {
          const type = block.widgetType || block.id;
          const normType = normalizeWidgetType(type);
          if (normType === 'animation' || normType === 'loop') {
            const inst = resolveWidgetInstance(metadata?.widgetInstances, normType, block.instanceId);
            if (inst) {
              const naturalSize = getWidgetNaturalSize(animDef, symbolSlices, inst, parsedSmall, fontMappings);
              block.width = naturalSize.width;
              block.height = naturalSize.height;
            }
          }
        });
      };
      reconcileAnimationBlocks(metadata.centralBlocks);
      reconcileAnimationBlocks(metadata.peripheralBlocks);
      reconcileAnimationBlocks(metadata.idleCentralBlocks);
      reconcileAnimationBlocks(metadata.idlePeripheralBlocks);
      if (metadata.peripheralScreens) {
        Object.values(metadata.peripheralScreens).forEach(ps => {
          reconcileAnimationBlocks(ps.blocks);
          reconcileAnimationBlocks(ps.idleBlocks);
        });
      }
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
  const safeCId = (id: string) => id.replace(/[^a-zA-Z0-9_]/g, '_');
  symbolSlices = symbolSlices.map(s => ({
    ...s,
    id: safeCId(s.id),
    groupId: s.groupId ? safeCId(s.groupId) : safeCId(s.id),
  }));

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
    const seenAll = new Set<number>();
    allGlyphs = [...smallGlyphs, ...bigGlyphs].filter(g => {
      if (seenAll.has(g.codepoint)) return false;
      seenAll.add(g.codepoint);
      return true;
    });
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
  const digitsGlyphs = bigGlyphs.filter(g => g.codepoint >= 48 && g.codepoint <= 57).length > 0
    ? bigGlyphs.filter(g => g.codepoint >= 48 && g.codepoint <= 57)
    : allGlyphs.filter(g => g.codepoint >= 48 && g.codepoint <= 57);
  const textGlyphs = smallGlyphs.filter(g => g.codepoint < 48 || g.codepoint > 57).length > 0
    ? smallGlyphs.filter(g => g.codepoint < 48 || g.codepoint > 57)
    : allGlyphs.filter(g => g.codepoint < 48 || g.codepoint > 57);

  const virtWidth = metadata?.screenDimensions?.width ?? 32;
  const virtHeight = metadata?.screenDimensions?.height ?? 128;
  const isPortrait = virtWidth < virtHeight;
  const hwWidth = isPortrait ? virtHeight : virtWidth;
  const hwHeight = isPortrait ? virtWidth : virtHeight;

  const isSymmetric = metadata?.symmetricSettings !== false;
  const peripheralDims = metadata?.peripheralScreenDimensions || (metadata as any)?.rightScreenDimensions;
  const peripheralVirtWidth = (!isSymmetric && peripheralDims?.width) ? peripheralDims.width : virtWidth;
  const peripheralVirtHeight = (!isSymmetric && peripheralDims?.height) ? peripheralDims.height : virtHeight;
  const isPeripheralPortrait = peripheralVirtWidth < peripheralVirtHeight;
  const peripheralHwWidth = isPeripheralPortrait ? peripheralVirtHeight : peripheralVirtWidth;
  const peripheralHwHeight = isPeripheralPortrait ? peripheralVirtWidth : peripheralVirtHeight;

  const idleTimeoutMs = (metadata?.idleTimeoutSec ?? 30) * 1000;
  const screenOffTimeoutMs = (metadata?.screenOffTimeoutSec ?? 60) * 1000;
  const idleScreensEnabled = metadata?.idleScreensEnabled ?? true;

  const peripheralIdleTimeoutMs = (!isSymmetric && (metadata?.peripheralIdleTimeoutSec !== undefined || (metadata as any)?.rightIdleTimeoutSec !== undefined))
    ? (metadata?.peripheralIdleTimeoutSec ?? (metadata as any)?.rightIdleTimeoutSec) * 1000
    : idleTimeoutMs;
  const peripheralScreenOffTimeoutMs = (!isSymmetric && (metadata?.peripheralScreenOffTimeoutSec !== undefined || (metadata as any)?.rightScreenOffTimeoutSec !== undefined))
    ? (metadata?.peripheralScreenOffTimeoutSec ?? (metadata as any)?.rightScreenOffTimeoutSec) * 1000
    : screenOffTimeoutMs;
  const peripheralIdleScreensEnabled = (!isSymmetric && (metadata?.peripheralIdleScreensEnabled !== undefined || (metadata as any)?.rightIdleScreensEnabled !== undefined))
    ? (metadata?.peripheralIdleScreensEnabled ?? (metadata as any)?.rightIdleScreensEnabled)
    : idleScreensEnabled;

  const rotation = metadata?.rotation ?? (virtWidth < virtHeight ? 90 : 0);
  const peripheralRotation = metadata?.peripheralRotation ?? metadata?.rightRotation ?? (isSymmetric ? rotation : (peripheralVirtWidth < peripheralVirtHeight ? 90 : 0));

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
#define DISPLAY_ROTATION       ${rotation}
#define DISPLAY_ROTATION_DEGREES ${rotation}
#define SCYAN_ROTATION         ${rotation}
#ifndef CONFIG_SCYAN_ROTATION_${rotation}
#define CONFIG_SCYAN_ROTATION_${rotation} 1
#endif
${!isSymmetric ? `#define DISPLAY_VIRTUAL_WIDTH_PERIPHERAL  ${peripheralVirtWidth}
#define DISPLAY_VIRTUAL_HEIGHT_PERIPHERAL ${peripheralVirtHeight}
#define DISPLAY_HW_WIDTH_PERIPHERAL       ${peripheralHwWidth}
#define DISPLAY_HW_HEIGHT_PERIPHERAL      ${peripheralHwHeight}
#define DISPLAY_ROTATION_PERIPHERAL       ${peripheralRotation}
#define DISPLAY_ROTATION_DEGREES_PERIPHERAL ${peripheralRotation}
#define SCYAN_ROTATION_PERIPHERAL         ${peripheralRotation}
/* Legacy right aliases */
#define DISPLAY_VIRTUAL_WIDTH_RIGHT  DISPLAY_VIRTUAL_WIDTH_PERIPHERAL
#define DISPLAY_VIRTUAL_HEIGHT_RIGHT DISPLAY_VIRTUAL_HEIGHT_PERIPHERAL
#define DISPLAY_HW_WIDTH_RIGHT       DISPLAY_HW_WIDTH_PERIPHERAL
#define DISPLAY_HW_HEIGHT_RIGHT      DISPLAY_HW_HEIGHT_PERIPHERAL
#define DISPLAY_ROTATION_RIGHT       DISPLAY_ROTATION_PERIPHERAL
` : ''}/* Display power-management timers & idle configuration */
#define ZMK_DISPLAY_IDLE_SCREENS_ENABLED ${idleScreensEnabled ? 1 : 0}
#define SCYAN_IDLE_SCREENS_ENABLED       ${idleScreensEnabled ? 1 : 0}
#define ZMK_DISPLAY_IDLE_TIMEOUT_MS  ${idleTimeoutMs}
#define SCYAN_IDLE_TIMEOUT_MS        ${idleTimeoutMs}
#ifndef CONFIG_SCYAN_IDLE_TIMEOUT_MS
#define CONFIG_SCYAN_IDLE_TIMEOUT_MS ${idleTimeoutMs}
#endif
#define ZMK_DISPLAY_SLEEP_TIMEOUT_MS ${screenOffTimeoutMs}
#define SCYAN_SLEEP_TIMEOUT_MS       ${screenOffTimeoutMs}
${!isSymmetric ? `#define SCYAN_IDLE_SCREENS_ENABLED_CENTRAL  ${idleScreensEnabled ? 1 : 0}
#define SCYAN_IDLE_TIMEOUT_MS_CENTRAL       ${idleTimeoutMs}
#define SCYAN_SLEEP_TIMEOUT_MS_CENTRAL      ${screenOffTimeoutMs}
#define SCYAN_IDLE_SCREENS_ENABLED_PERIPHERAL ${peripheralIdleScreensEnabled ? 1 : 0}
#define SCYAN_IDLE_TIMEOUT_MS_PERIPHERAL        ${peripheralIdleTimeoutMs}
#define SCYAN_SLEEP_TIMEOUT_MS_PERIPHERAL       ${peripheralScreenOffTimeoutMs}
/* Backward-compatible aliases for legacy firmware builds */
#define SCYAN_IDLE_SCREENS_ENABLED_LEFT     SCYAN_IDLE_SCREENS_ENABLED_CENTRAL
#define SCYAN_IDLE_TIMEOUT_MS_LEFT          SCYAN_IDLE_TIMEOUT_MS_CENTRAL
#define SCYAN_SLEEP_TIMEOUT_MS_LEFT         SCYAN_SLEEP_TIMEOUT_MS_CENTRAL
#define SCYAN_IDLE_SCREENS_ENABLED_RIGHT    SCYAN_IDLE_SCREENS_ENABLED_PERIPHERAL
#define SCYAN_IDLE_TIMEOUT_MS_RIGHT         SCYAN_IDLE_TIMEOUT_MS_PERIPHERAL
#define SCYAN_SLEEP_TIMEOUT_MS_RIGHT        SCYAN_SLEEP_TIMEOUT_MS_PERIPHERAL
` : ''}

/* Sprite slice descriptor */
struct sprite_slice {
    uint16_t x;
    uint16_t y;
    uint16_t width;
    uint16_t height;
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
    const cp = g.codepoint ?? (g.char ? g.char.charCodeAt(0) : 0);
    const cpStr = cp <= 127 && g.char !== "'" && g.char !== '\\' ? `'${g.char}'` : `0x${cp.toString(16).toUpperCase().padStart(4, '0')}`;
    const commentChar = g.char === '\\' ? '\\ (backslash)' : g.char;
    c += `    { .codepoint = ${cpStr.padEnd(8, ' ')}, .x = ${(g.x + fontOffsetX).toString().padStart(3, ' ')}, .y = ${(g.y + fontOffsetY).toString().padStart(2, ' ')}, .width = ${g.width.toString().padStart(2, ' ')}, .height = ${g.height.toString().padStart(2, ' ')}, .advance_x = ${g.advanceX.toString().padStart(2, ' ')} }, // ${commentChar}\n`;
  });
  if (smallGlyphs.length === 0) {
    c += `    { .codepoint = 0, .x = 0, .y = 0, .width = 0, .height = 0, .advance_x = 0 },\n`;
  }
  c += `};\n\n`;

  // Big glyph table
  c += `/* Big Font Glyphs (${bigGlyphs.length}) */\n`;
  c += `static const struct font_glyph FONT_GLYPHS_BIG[${Math.max(1, bigGlyphs.length)}] = {\n`;
  bigGlyphs.forEach(g => {
    const cp = g.codepoint ?? (g.char ? g.char.charCodeAt(0) : 0);
    const cpStr = cp <= 127 && g.char !== "'" && g.char !== '\\' ? `'${g.char}'` : `0x${cp.toString(16).toUpperCase().padStart(4, '0')}`;
    const commentChar = g.char === '\\' ? '\\ (backslash)' : g.char;
    c += `    { .codepoint = ${cpStr.padEnd(8, ' ')}, .x = ${(g.x + fontOffsetX).toString().padStart(3, ' ')}, .y = ${(g.y + fontOffsetY).toString().padStart(2, ' ')}, .width = ${g.width.toString().padStart(2, ' ')}, .height = ${g.height.toString().padStart(2, ' ')}, .advance_x = ${g.advanceX.toString().padStart(2, ' ')} }, // ${commentChar}\n`;
  });
  if (bigGlyphs.length === 0) {
    c += `    { .codepoint = 0, .x = 0, .y = 0, .width = 0, .height = 0, .advance_x = 0 },\n`;
  }
  c += `};\n\n`;

  // Backward compatibility: Digits glyph table
  c += `static const struct font_glyph FONT_GLYPHS_DIGITS[${Math.max(1, digitsGlyphs.length)}] = {\n`;
  digitsGlyphs.forEach(g => {
    const cp = g.codepoint ?? (g.char ? g.char.charCodeAt(0) : 0);
    const cpStr = cp >= 48 && cp <= 57 ? `'0' + ${(cp - 48)}` : `0x${cp.toString(16).toUpperCase().padStart(4, '0')}`;
    const commentChar = g.char === '\\' ? '\\ (backslash)' : g.char;
    c += `    { .codepoint = ${cpStr.padEnd(8, ' ')}, .x = ${(g.x + fontOffsetX).toString().padStart(3, ' ')}, .y = ${(g.y + fontOffsetY).toString().padStart(2, ' ')}, .width = ${g.width.toString().padStart(2, ' ')}, .height = ${g.height.toString().padStart(2, ' ')}, .advance_x = ${g.advanceX.toString().padStart(2, ' ')} }, // ${commentChar}\n`;
  });
  if (digitsGlyphs.length === 0) {
    c += `    { .codepoint = 0, .x = 0, .y = 0, .width = 0, .height = 0, .advance_x = 0 },\n`;
  }
  c += `};\n\n`;

  // Backward compatibility: Text glyph table
  c += `static const struct font_glyph FONT_GLYPHS_TEXT[${Math.max(1, textGlyphs.length)}] = {\n`;
  textGlyphs.forEach(g => {
    const cp = g.codepoint ?? (g.char ? g.char.charCodeAt(0) : 0);
    const cpStr = cp <= 127 && g.char !== "'" && g.char !== '\\' ? `'${g.char}'` : `0x${cp.toString(16).toUpperCase().padStart(4, '0')}`;
    const commentChar = g.char === '\\' ? '\\ (backslash)' : g.char;
    c += `    { .codepoint = ${cpStr.padEnd(8, ' ')}, .x = ${(g.x + fontOffsetX).toString().padStart(3, ' ')}, .y = ${(g.y + fontOffsetY).toString().padStart(2, ' ')}, .width = ${g.width.toString().padStart(2, ' ')}, .height = ${g.height.toString().padStart(2, ' ')}, .advance_x = ${g.advanceX.toString().padStart(2, ' ')} }, // ${commentChar}\n`;
  });
  if (textGlyphs.length === 0) {
    c += `    { .codepoint = 0, .x = 0, .y = 0, .width = 0, .height = 0, .advance_x = 0 },\n`;
  }
  c += `};\n\n`;

  // All glyphs table
  c += `static const struct font_glyph FONT_GLYPHS_ALL[${Math.max(1, allGlyphs.length)}] = {\n`;
  allGlyphs.forEach(g => {
    const cp = g.codepoint ?? (g.char ? g.char.charCodeAt(0) : 0);
    const cpStr = (cp >= 48 && cp <= 57)
      ? `'0' + ${(cp - 48)}`
      : (cp <= 127 && g.char !== "'" && g.char !== '\\' ? `'${g.char}'` : `0x${cp.toString(16).toUpperCase().padStart(4, '0')}`);
    const commentChar = g.char === '\\' ? '\\ (backslash)' : g.char;
    c += `    { .codepoint = ${cpStr.padEnd(8, ' ')}, .x = ${(g.x + fontOffsetX).toString().padStart(3, ' ')}, .y = ${(g.y + fontOffsetY).toString().padStart(2, ' ')}, .width = ${g.width.toString().padStart(2, ' ')}, .height = ${g.height.toString().padStart(2, ' ')}, .advance_x = ${g.advanceX.toString().padStart(2, ' ')} }, // ${commentChar}\n`;
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

  const resolvedDisplays: Record<string, DisplayScreen> = {};
  if (metadata) {
    if (metadata.displays && Object.keys(metadata.displays).length > 0) {
      Object.entries(metadata.displays).forEach(([k, v]) => {
        resolvedDisplays[k] = v;
      });
    } else {
      const centralActive = metadata.centralBlocks || (metadata as any).leftBlocks || DEFAULT_CENTRAL_LAYOUT_BLOCKS;
      const centralIdle = metadata.idleCentralBlocks || (metadata as any).idleLeftBlocks || DEFAULT_IDLE_CENTRAL_BLOCKS;
      const peripheralActive = metadata.peripheralBlocks || (metadata as any).rightBlocks;
      const peripheralIdle = metadata.idlePeripheralBlocks || (metadata as any).idleRightBlocks;

      resolvedDisplays['display-1'] = {
        id: 'display-1',
        name: 'Display 1',
        dimensions: metadata.screenDimensions || { width: 32, height: 128 },
        rotation: metadata.rotation ?? 90,
        blocks: centralActive,
        idleBlocks: centralIdle,
        idleTimeoutSec: metadata.idleTimeoutSec ?? 30,
        screenOffTimeoutSec: metadata.screenOffTimeoutSec ?? 60,
        idleScreensEnabled: metadata.idleScreensEnabled ?? true,
      };

      if (
        peripheralActive ||
        peripheralIdle ||
        metadata.peripheralScreenDimensions ||
        (metadata as any).rightScreenDimensions ||
        metadata.symmetricSettings === false ||
        metadata.enabledScreens?.includes('peripheral')
      ) {
        resolvedDisplays['display-2'] = {
          id: 'display-2',
          name: 'Display 2',
          dimensions: metadata.peripheralScreenDimensions || (metadata as any).rightScreenDimensions || metadata.screenDimensions || { width: 32, height: 128 },
          rotation: metadata.peripheralRotation ?? metadata.rightRotation ?? metadata.rotation ?? 90,
          blocks: peripheralActive || DEFAULT_PERIPHERAL_LAYOUT_BLOCKS,
          idleBlocks: peripheralIdle || DEFAULT_IDLE_PERIPHERAL_BLOCKS,
          idleTimeoutSec: metadata.peripheralIdleTimeoutSec ?? (metadata as any).rightIdleTimeoutSec ?? metadata.idleTimeoutSec ?? 30,
          screenOffTimeoutSec: metadata.peripheralScreenOffTimeoutSec ?? (metadata as any).rightScreenOffTimeoutSec ?? metadata.screenOffTimeoutSec ?? 60,
          idleScreensEnabled: metadata.peripheralIdleScreensEnabled ?? (metadata as any).rightIdleScreensEnabled ?? metadata.idleScreensEnabled ?? true,
        };
      }

      if (metadata.peripheralScreens) {
        let slot = 3;
        Object.entries(metadata.peripheralScreens).forEach(([, p]) => {
          const dId = `display-${slot++}`;
          resolvedDisplays[dId] = {
            id: dId,
            name: p.name || `Display ${slot - 1}`,
            dimensions: p.screenDimensions || { width: 32, height: 128 },
            rotation: p.rotation ?? 90,
            blocks: p.blocks || [],
            idleBlocks: p.idleBlocks || [],
            idleTimeoutSec: p.idleTimeoutSec ?? 30,
            screenOffTimeoutSec: p.screenOffTimeoutSec ?? 60,
            idleScreensEnabled: p.idleScreensEnabled ?? false,
          };
        });
      }
    }
  }

  if (metadata && (
    metadata.centralBlocks?.length || metadata.peripheralBlocks?.length ||
    metadata.idleCentralBlocks?.length || metadata.idlePeripheralBlocks?.length ||
    (metadata as any).leftBlocks?.length || (metadata as any).rightBlocks?.length ||
    metadata.enabledScreens?.length || (metadata.displays && Object.keys(metadata.displays).length > 0)
  )) {
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
    c += `    WIDGET_TYPE_LOOP,\n`;
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
    c += `    int16_t param3;\n`;
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
      else if (normType.includes('loop') || normType.includes('animation')) enumType = 'WIDGET_TYPE_LOOP';

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
        : (normType.includes('animation') || normType.includes('loop')) ? 'animation'
        : normType;

      const instance = resolveWidgetInstance(metadata.widgetInstances, lookupKey, block.instanceId);

      const mode = (instance?.config?.mode === 'font') ? 1 : 0;
      let param1 = 0;
      let param2 = 0;
      let param3 = 0;
      if (enumType === 'WIDGET_TYPE_WPM_CHART') {
        param1 = instance?.config?.wpmChart?.gridSize ?? 4;
        param2 = instance?.config?.wpmChart?.targetSpeed ?? 100;
        param3 = instance?.config?.wpmChart?.timeWindow ?? 30;
      } else if (enumType === 'WIDGET_TYPE_LOOP') {
        param1 = instance?.config?.loopSpeedMs ?? 250;
        param2 = (instance?.config?.loop ?? true) ? 0 : 1;
      } else {
        if (instance?.config?.fontSize === 'big') {
          param3 = 1;
        }
        if (enumType === 'WIDGET_TYPE_WPM') {
          param2 = instance?.config?.targetValue ?? 100;
        } else if (enumType === 'WIDGET_TYPE_BATTERY') {
          param1 = (mode === 1) ? (instance?.config?.fontDivisionCount ?? 2) : 0;
        }
      }

      const symbolIds: string[] = [];
      let loopTotalFrames = 0;
      if (enumType === 'WIDGET_TYPE_OUTPUT_STATUS') {
        const usbGid = instance?.config?.groupId || 'SYMBOL_USB';
        const usbMatch = symbolSlices.find(s => (s.groupId === usbGid && s.groupOrder === 1) || s.groupId === usbGid || s.id === usbGid)
          || symbolSlices.find(s => s.id.includes('USB') || s.groupId?.includes('USB'));
        if (usbMatch) {
          symbolIds.push(usbMatch.id);
        }
        if (instance?.config?.groupIds && instance.config.groupIds.length > 0) {
          const bleIds = instance.config.groupIds.length >= 6
            ? instance.config.groupIds.slice(1)
            : instance.config.groupIds;
          for (const gid of bleIds) {
            const match = symbolSlices.find(s => (s.groupId === gid && s.groupOrder === 1) || s.groupId === gid || s.id === gid);
            if (match && symbolIds.length < 16) {
              symbolIds.push(match.id);
            }
          }
        } else {
          const btMatch = symbolSlices.find(s => s.id.includes('BLUETOOTH') || s.id.includes('BLE') || s.groupId?.includes('BLUETOOTH'));
          if (btMatch && symbolIds.length < 16) {
            symbolIds.push(btMatch.id);
          }
        }
        if (symbolIds.length === 1) {
          const btMatch = symbolSlices.find(s => s.id.includes('BLUETOOTH') || s.id.includes('BLE') || s.groupId?.includes('BLUETOOTH'));
          if (btMatch && symbolIds.length < 16) {
            symbolIds.push(btMatch.id);
          }
        }
      } else if (instance?.config?.groupIds && instance.config.groupIds.length > 0) {
        for (const gid of instance.config.groupIds) {
          const match = symbolSlices.find(s => (s.groupId === gid && s.groupOrder === 1) || s.groupId === gid || s.id === gid);
          if (match && symbolIds.length < 16) {
            symbolIds.push(match.id);
          }
        }
      } else if (instance?.config?.groupId) {
        const gid = instance.config.groupId;
        let members = symbolSlices.filter(s => s.groupId === gid).sort((a, b) => a.groupOrder - b.groupOrder);
        if (members.length === 0) {
          members = symbolSlices.filter(s => s.groupId.toLowerCase() === gid.toLowerCase()).sort((a, b) => a.groupOrder - b.groupOrder);
        }
        if (members.length === 0) {
          members = symbolSlices.filter(s => s.id === gid || s.name === gid).sort((a, b) => a.groupOrder - b.groupOrder);
        }
        if (members.length > 0) {
          loopTotalFrames = members.length;
          for (const m of members) {
            if (symbolIds.length < 16) symbolIds.push(m.id);
          }
        } else {
          const match = symbolSlices.find(s => s.id === gid || s.name === gid);
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
        } else if (enumType === 'WIDGET_TYPE_LOOP') {
          const multi = symbolSlices.find(s => {
            if (s.groupOrder !== 1) return false;
            const gid = s.groupId.toUpperCase();
            if (/^(CHARGE|BATTERY|SPEED|WPM|BLUETOOTH|USB|SPLIT|LAYER|BRACKET)/i.test(gid)) return false;
            return symbolSlices.filter(m => m.groupId === s.groupId).length >= 2;
          });
          if (multi) {
            const matches = symbolSlices
              .filter(s => s.groupId === multi.groupId)
              .sort((a, b) => a.groupOrder - b.groupOrder);
            loopTotalFrames = matches.length;
            matches
              .slice(0, 16)
              .forEach(s => symbolIds.push(s.id));
          }
        }
        if (symbolIds.length === 0 && symbolSlices.length > 0) {
          symbolIds.push(symbolSlices[0].id);
        }
      }

      const symbolId = symbolIds[0] || (symbolSlices[0]?.id || '0');
      const symbolCount = (enumType === 'WIDGET_TYPE_LOOP' && loopTotalFrames > 0)
        ? loopTotalFrames
        : symbolIds.length;
      const symbolIdsStr = symbolIds.length > 0 ? `{ ${symbolIds.join(', ')} }` : `{ 0 }`;

      const textEntries: string[] = [];
      if (enumType === 'WIDGET_TYPE_OUTPUT_STATUS' && instance?.config?.textEntries && instance.config.textEntries.length > 0) {
        if (instance.config.textEntries.length >= 7) {
          textEntries.push(JSON.stringify(instance.config.textEntries[0]));
          for (let i = 2; i < instance.config.textEntries.length && textEntries.length < 16; i++) {
            textEntries.push(JSON.stringify(instance.config.textEntries[i]));
          }
        } else {
          for (const t of instance.config.textEntries) {
            if (textEntries.length < 16) textEntries.push(JSON.stringify(t));
          }
        }
      } else if (instance?.config?.textEntries && instance.config.textEntries.length > 0) {
        for (const t of instance.config.textEntries) {
          if (textEntries.length < 16) {
            textEntries.push(JSON.stringify(t));
          }
        }
      } else if (enumType === 'WIDGET_TYPE_LAYER' && metadata?.layerNames && metadata.layerNames.length > 0) {
        for (const name of metadata.layerNames) {
          if (textEntries.length < 16) {
            textEntries.push(JSON.stringify(name));
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
      let bw = block.width ?? 0;
      let bh = block.height;

      if (enumType === 'WIDGET_TYPE_BRANDING') {
        const textToMeasure = (instance?.config?.textEntries?.[0] !== undefined
          ? instance.config.textEntries[0]
          : (customText !== 'NULL' ? JSON.parse(customText) : 'ZMK')) || 'ZMK';
        const mappings = (fontInput.length > 0 && 'chars' in fontInput[0]) ? (fontInput as FontCharMapping[]) : undefined;
        const fontSize = instance?.config?.fontSize || 'small';
        bw = Math.min(32, Math.max(measureTextWidth(textToMeasure.toUpperCase(), smallGlyphs, mappings, fontSize), 4));
        bh = fontSize === 'big' ? 10 : 5;
      }

      if (enumType === 'WIDGET_TYPE_WPM') {
        if (mode === 0) {
          if (symbolIds.length > 0) {
            const match = symbolSlices.find(s => s.id === symbolIds[0]);
            if (match) {
              bw = match.width;
              bh = match.height;
            } else {
              bw = 27;
              bh = 5;
            }
          } else {
            bw = 27;
            bh = 5;
          }
        } else {
          // Font / Text mode
          const isBig = instance?.config?.fontSize === 'big';
          const fontSize = isBig ? 'big' : 'small';
          const mappings = (fontInput.length > 0 && 'chars' in fontInput[0]) ? (fontInput as FontCharMapping[]) : undefined;
          const nonEmpty = (instance?.config?.textEntries || []).map(e => e?.trim()).filter(Boolean) as string[];
          if (nonEmpty.length > 0) {
            let maxW = 0;
            for (const entry of nonEmpty) {
              const w = measureTextWidth(entry.toUpperCase(), smallGlyphs, mappings, fontSize);
              if (w > maxW) maxW = w;
            }
            bw = Math.min(32, Math.max(maxW, 4));
            bh = isBig ? 10 : 5;
          } else {
            // Digits mode fallback (e.g. up to 3 digits '100')
            bw = 24;
            bh = 10;
          }
        }
        block.width = bw;
        block.height = bh;
      }

      if (enumType === 'WIDGET_TYPE_WPM_CHART') {
        if (instance?.config?.wpmChart) {
          bw = instance.config.wpmChart.width ?? bw ?? 32;
          bh = instance.config.wpmChart.height ?? bh ?? 24;
          block.width = bw;
          block.height = bh;
        }
      }

      if (enumType === 'WIDGET_TYPE_LOOP') {
        const animDef = getWidgetDefinition('animation');
        if (animDef) {
          const naturalSize = getWidgetNaturalSize(animDef, symbolSlices, instance);
          bw = naturalSize.width;
          bh = naturalSize.height;
          block.width = bw;
          block.height = bh;
        }
      }

      return `    { .type = ${enumType}, .x = ${bx}, .y = ${by}, .width = ${bw}, .height = ${bh}, .enabled = ${enabled}, .mode = ${mode}, .param1 = ${param1}, .param2 = ${param2}, .param3 = ${param3}, .symbol_count = ${symbolCount}, .symbol_ids = ${symbolIdsStr}, .text_count = ${textCount}, .text_entries = ${textEntriesStr}, .custom_text = ${customText}, .symbol_id = ${symbolId} }`;
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

    // Emit slotted display arrays
    Object.entries(resolvedDisplays).forEach(([dId, disp]) => {
      const slotMatch = dId.match(/\d+/);
      const slotNum = slotMatch ? slotMatch[0] : dId.toUpperCase().replace(/[^A-Z0-9_]/g, '_');
      c += `/* ========================================================================== */\n`;
      c += `/* DISPLAY ${slotNum} (${disp.name || 'Display ' + slotNum})                  */\n`;
      c += `/* ========================================================================== */\n`;
      c += `#define HAS_DISPLAY_${slotNum} 1\n`;
      emitBlockArray(`LAYOUT_DISPLAY_${slotNum}_ACTIVE_BLOCKS`, `LAYOUT_DISPLAY_${slotNum}_ACTIVE_COUNT`, disp.blocks);
      emitBlockArray(`LAYOUT_DISPLAY_${slotNum}_IDLE_BLOCKS`, `LAYOUT_DISPLAY_${slotNum}_IDLE_COUNT`, disp.idleBlocks);
    });

    c += `/* Clean Aliases for ZMK Firmware Engine */\n`;
    c += `#if defined(CONFIG_SCYAN_DISPLAY_SLOT_2)\n`;
    c += `    #define SCYAN_ACTIVE_BLOCKS LAYOUT_DISPLAY_2_ACTIVE_BLOCKS\n`;
    c += `    #define SCYAN_ACTIVE_COUNT  LAYOUT_DISPLAY_2_ACTIVE_COUNT\n`;
    c += `    #define SCYAN_IDLE_BLOCKS   LAYOUT_DISPLAY_2_IDLE_BLOCKS\n`;
    c += `    #define SCYAN_IDLE_COUNT    LAYOUT_DISPLAY_2_IDLE_COUNT\n`;
    c += `#elif defined(CONFIG_SCYAN_DISPLAY_SLOT_3)\n`;
    c += `    #define SCYAN_ACTIVE_BLOCKS LAYOUT_DISPLAY_3_ACTIVE_BLOCKS\n`;
    c += `    #define SCYAN_ACTIVE_COUNT  LAYOUT_DISPLAY_3_ACTIVE_COUNT\n`;
    c += `    #define SCYAN_IDLE_BLOCKS   LAYOUT_DISPLAY_3_IDLE_BLOCKS\n`;
    c += `    #define SCYAN_IDLE_COUNT    LAYOUT_DISPLAY_3_IDLE_COUNT\n`;
    c += `#else\n`;
    c += `    #define SCYAN_ACTIVE_BLOCKS LAYOUT_DISPLAY_1_ACTIVE_BLOCKS\n`;
    c += `    #define SCYAN_ACTIVE_COUNT  LAYOUT_DISPLAY_1_ACTIVE_COUNT\n`;
    c += `    #define SCYAN_IDLE_BLOCKS   LAYOUT_DISPLAY_1_IDLE_BLOCKS\n`;
    c += `    #define SCYAN_IDLE_COUNT    LAYOUT_DISPLAY_1_IDLE_COUNT\n`;
    c += `#endif\n\n`;

    const d1ActiveLen = resolvedDisplays['display-1']?.blocks?.length ?? 0;
    const d1IdleLen = resolvedDisplays['display-1']?.idleBlocks?.length ?? 0;
    const d2ActiveLen = resolvedDisplays['display-2']?.blocks?.length ?? 0;
    const d2IdleLen = resolvedDisplays['display-2']?.idleBlocks?.length ?? 0;
    const d3ActiveLen = resolvedDisplays['display-3']?.blocks?.length ?? 0;
    const d3IdleLen = resolvedDisplays['display-3']?.idleBlocks?.length ?? 0;

    c += `/* Backward-compatible aliases for legacy firmware builds */\n`;
    c += `#define LAYOUT_CENTRAL_ACTIVE_BLOCKS LAYOUT_DISPLAY_1_ACTIVE_BLOCKS\n`;
    c += `#define LAYOUT_CENTRAL_ACTIVE_COUNT ${d1ActiveLen}\n`;
    c += `#define LAYOUT_CENTRAL_IDLE_BLOCKS  LAYOUT_DISPLAY_1_IDLE_BLOCKS\n`;
    c += `#define LAYOUT_CENTRAL_IDLE_COUNT   ${d1IdleLen}\n`;
    c += `#define LAYOUT_LEFT_ACTIVE_BLOCKS   LAYOUT_CENTRAL_ACTIVE_BLOCKS\n`;
    c += `#define LAYOUT_LEFT_ACTIVE_COUNT    LAYOUT_CENTRAL_ACTIVE_COUNT\n`;
    c += `#define LAYOUT_LEFT_IDLE_BLOCKS     LAYOUT_CENTRAL_IDLE_BLOCKS\n`;
    c += `#define LAYOUT_LEFT_IDLE_COUNT      LAYOUT_CENTRAL_IDLE_COUNT\n`;
    c += `#if defined(HAS_DISPLAY_2)\n`;
    c += `#define LAYOUT_PERIPHERAL_ACTIVE_BLOCKS LAYOUT_DISPLAY_2_ACTIVE_BLOCKS\n`;
    c += `#define LAYOUT_PERIPHERAL_ACTIVE_COUNT ${d2ActiveLen}\n`;
    c += `#define LAYOUT_PERIPHERAL_IDLE_BLOCKS  LAYOUT_DISPLAY_2_IDLE_BLOCKS\n`;
    c += `#define LAYOUT_PERIPHERAL_IDLE_COUNT   ${d2IdleLen}\n`;
    c += `#else\n`;
    c += `#define LAYOUT_PERIPHERAL_ACTIVE_BLOCKS LAYOUT_DISPLAY_1_ACTIVE_BLOCKS\n`;
    c += `#define LAYOUT_PERIPHERAL_ACTIVE_COUNT 0\n`;
    c += `#define LAYOUT_PERIPHERAL_IDLE_BLOCKS  LAYOUT_DISPLAY_1_IDLE_BLOCKS\n`;
    c += `#define LAYOUT_PERIPHERAL_IDLE_COUNT   0\n`;
    c += `#endif\n`;
    c += `#define LAYOUT_RIGHT_ACTIVE_BLOCKS  LAYOUT_PERIPHERAL_ACTIVE_BLOCKS\n`;
    c += `#define LAYOUT_RIGHT_ACTIVE_COUNT   LAYOUT_PERIPHERAL_ACTIVE_COUNT\n`;
    c += `#define LAYOUT_RIGHT_IDLE_BLOCKS    LAYOUT_PERIPHERAL_IDLE_BLOCKS\n`;
    c += `#define LAYOUT_RIGHT_IDLE_COUNT     LAYOUT_PERIPHERAL_IDLE_COUNT\n\n`;

    c += `#if defined(HAS_DISPLAY_3)\n`;
    c += `#define LAYOUT_PERIPHERAL_2_ACTIVE_BLOCKS LAYOUT_DISPLAY_3_ACTIVE_BLOCKS\n`;
    c += `#define LAYOUT_PERIPHERAL_2_ACTIVE_COUNT ${d3ActiveLen}\n`;
    c += `#define LAYOUT_PERIPHERAL_2_IDLE_BLOCKS  LAYOUT_DISPLAY_3_IDLE_BLOCKS\n`;
    c += `#define LAYOUT_PERIPHERAL_2_IDLE_COUNT   ${d3IdleLen}\n`;
    c += `#endif\n\n`;
  }

  if (metadata) {
    const displaysToEmit = metadata.displays || (Object.keys(resolvedDisplays).length > 0 ? resolvedDisplays : undefined);
    const cleanMeta: HeaderMetadata = {
      version: 2,
      shieldId: metadata.shieldId,
      shields: metadata.shields,
      displayAssignments: metadata.displayAssignments,
      displays: displaysToEmit,
      peripheralScreens: metadata.peripheralScreens,
      widgetInstances: metadata.widgetInstances,
      symmetricSettings: metadata.symmetricSettings,
      enabledScreens: (metadata.enabledScreens || (displaysToEmit ? Object.keys(displaysToEmit) : ['central', 'peripheral']))
        .map(s => (s === 'left' ? 'central' : s === 'right' ? 'peripheral' : s))
        .filter(s => s !== 'dongle'),
      bongoTapMs: metadata.bongoTapMs,
      bongoDebounceMs: metadata.bongoDebounceMs,
      layerNames: metadata.layerNames,
    };
    // Strip undefined values for clean JSON output
    Object.keys(cleanMeta).forEach(key => {
      if ((cleanMeta as any)[key] === undefined) {
        delete (cleanMeta as any)[key];
      }
    });
    c += `\n/* ZMK_DISPLAY_STUDIO_METADATA\n${JSON.stringify(cleanMeta, null, 2)}\n*/\n`;
  }

  return c;
}


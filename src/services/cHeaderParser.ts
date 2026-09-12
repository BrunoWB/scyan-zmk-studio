import { BwpxGrid } from '../bwpx/core/BwpxGrid';
import type { SpriteSlice, FontGlyph, FontCharMapping, LayoutBlock } from '../types/zmk';
import type { WidgetInstanceMap } from '../types/widget';
import { DEFAULT_SYMBOL_SLICES, DEFAULT_FONT_GLYPHS, DEFAULT_FONT_MAPPINGS } from '../types/zmk';
import defaultInstallHeader from '../assets/scyan_assets.install.h?raw';
import { measureTextWidth, getWidgetNaturalSize, getWidgetDefinition, normalizeWidgetType, resolveWidgetInstance } from './widgetRegistry';

export interface PeripheralScreenData {
  name?: string;
  blocks?: LayoutBlock[];
  idleBlocks?: LayoutBlock[];
  screenDimensions?: { width: number; height: number };
  idleScreensEnabled?: boolean;
  idleTimeoutSec?: number;
  screenOffTimeoutSec?: number;
}

export interface HeaderMetadata {
  version: 1;
  centralBlocks?: LayoutBlock[];
  peripheralBlocks?: LayoutBlock[];
  idleCentralBlocks?: LayoutBlock[];
  idlePeripheralBlocks?: LayoutBlock[];
  /** Backward-compatible aliases */
  leftBlocks?: LayoutBlock[];
  rightBlocks?: LayoutBlock[];
  dongleBlocks?: LayoutBlock[];
  idleLeftBlocks?: LayoutBlock[];
  idleRightBlocks?: LayoutBlock[];
  idleDongleBlocks?: LayoutBlock[];
  /** Dynamic peripheral screens dictionary for arbitrary N peripherals (keyed by screen ID e.g. 'peripheral-2') */
  peripheralScreens?: Record<string, PeripheralScreenData>;
  screenDimensions?: { width: number; height: number };
  widgetInstances?: WidgetInstanceMap;
  /** Seconds of inactivity before switching to the idle layout (default 30) */
  idleTimeoutSec?: number;
  /** Seconds after going idle before the OLED turns off completely (default 60) */
  screenOffTimeoutSec?: number;
  /** Whether idle screens are enabled (default true) */
  idleScreensEnabled?: boolean;
  /** Whether central and peripheral share the same display & power settings (default true) */
  symmetricSettings?: boolean;
  /** Right/Peripheral screen dimensions when asymmetric */
  rightScreenDimensions?: { width: number; height: number };
  peripheralScreenDimensions?: { width: number; height: number };
  /** Right/Peripheral idle screens toggle when asymmetric */
  rightIdleScreensEnabled?: boolean;
  peripheralIdleScreensEnabled?: boolean;
  /** Right/Peripheral idle timeout in seconds when asymmetric */
  rightIdleTimeoutSec?: number;
  peripheralIdleTimeoutSec?: number;
  /** Right/Peripheral screen off timeout in seconds when asymmetric */
  rightScreenOffTimeoutSec?: number;
  peripheralScreenOffTimeoutSec?: number;
  /** Dongle screen dimensions when dongle screen is present */
  dongleScreenDimensions?: { width: number; height: number };
  /** Dongle idle screens toggle */
  dongleIdleScreensEnabled?: boolean;
  /** Dongle idle timeout in seconds */
  dongleIdleTimeoutSec?: number;
  /** Dongle screen off timeout in seconds */
  dongleScreenOffTimeoutSec?: number;
  /** List of currently enabled screens (e.g. ['central', 'peripheral']) */
  enabledScreens?: string[];
  /** Active keyboard shield ID (e.g. 'corne', 'lily58', 'sofle', etc.) */
  shieldId?: string;
  /** Bongo Cat tap animation duration in milliseconds (default 60, matches CONFIG_SCYAN_BONGO_TAP_MS) */
  bongoTapMs?: number;
  /** Bongo Cat debounce interval in milliseconds (default 100) */
  bongoDebounceMs?: number;
  /** Active keyboard layer names loaded from ZMK keymap */
  layerNames?: string[];
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
    if (metaMatch && metaMatch[1]) {
      try {
        const parsedMeta = JSON.parse(metaMatch[1].trim());
        if (parsedMeta && typeof parsedMeta === 'object') {
          metadata = parsedMeta;
          if (metadata) {
            if (metadata.leftBlocks && !metadata.centralBlocks) {
              metadata.centralBlocks = metadata.leftBlocks;
            }
            if (metadata.rightBlocks && !metadata.peripheralBlocks) {
              metadata.peripheralBlocks = metadata.rightBlocks;
            }
            if (metadata.idleLeftBlocks && !metadata.idleCentralBlocks) {
              metadata.idleCentralBlocks = metadata.idleLeftBlocks;
            }
            if (metadata.idleRightBlocks && !metadata.idlePeripheralBlocks) {
              metadata.idlePeripheralBlocks = metadata.idleRightBlocks;
            }
            if (metadata.enabledScreens) {
              metadata.enabledScreens = metadata.enabledScreens.map((s: string) =>
                s === 'left' ? 'central' : s === 'right' ? 'peripheral' : s
              );
            } else {
              if (metadata.dongleBlocks && metadata.dongleBlocks.length > 0) {
                metadata.enabledScreens = (metadata.centralBlocks || metadata.leftBlocks)
                  ? ['central', 'dongle', 'peripheral']
                  : ['dongle'];
              } else {
                metadata.enabledScreens = ['central', 'peripheral'];
              }
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
    const idleTimeoutMsMatch = cCode.match(/#define\s+(?:SCYAN_IDLE_TIMEOUT_MS_LEFT|ZMK_DISPLAY_IDLE_TIMEOUT_MS|CONFIG_SCYAN_IDLE_TIMEOUT_MS|SCYAN_IDLE_TIMEOUT_MS)\s+(\d+)/);
    const sleepTimeoutMsMatch = cCode.match(/#define\s+(?:SCYAN_SLEEP_TIMEOUT_MS_LEFT|ZMK_DISPLAY_SLEEP_TIMEOUT_MS|CONFIG_ZMK_IDLE_TIMEOUT|SCYAN_SLEEP_TIMEOUT_MS)\s+(\d+)/);
    const idleScreensMatch = cCode.match(/#define\s+(?:SCYAN_IDLE_SCREENS_ENABLED_LEFT|ZMK_DISPLAY_IDLE_SCREENS_ENABLED|SCYAN_IDLE_SCREENS_ENABLED)\s+(\d+)/);
    const parsedIdleTimeoutSec = idleTimeoutMsMatch ? Math.round(parseInt(idleTimeoutMsMatch[1], 10) / 1000) : undefined;
    const parsedScreenOffTimeoutSec = sleepTimeoutMsMatch ? Math.round(parseInt(sleepTimeoutMsMatch[1], 10) / 1000) : undefined;
    const parsedIdleScreensEnabled = idleScreensMatch ? (parseInt(idleScreensMatch[1], 10) !== 0) : undefined;

    // 6c. Parse right-specific dimensions & power timers (if defined for asymmetric hardware)
    const rightVirtWidthMatch = cCode.match(/#define\s+DISPLAY_VIRTUAL_WIDTH_RIGHT\s+(\d+)/);
    const rightVirtHeightMatch = cCode.match(/#define\s+DISPLAY_VIRTUAL_HEIGHT_RIGHT\s+(\d+)/);
    const rightScreenDims = (rightVirtWidthMatch && rightVirtHeightMatch)
      ? { width: parseInt(rightVirtWidthMatch[1], 10), height: parseInt(rightVirtHeightMatch[1], 10) }
      : undefined;

    const rightIdleTimeoutMsMatch = cCode.match(/#define\s+(?:SCYAN_IDLE_TIMEOUT_MS_RIGHT|CONFIG_SCYAN_IDLE_TIMEOUT_MS_RIGHT)\s+(\d+)/);
    const rightSleepTimeoutMsMatch = cCode.match(/#define\s+(?:SCYAN_SLEEP_TIMEOUT_MS_RIGHT|CONFIG_SCYAN_SLEEP_TIMEOUT_MS_RIGHT)\s+(\d+)/);
    const rightIdleScreensMatch = cCode.match(/#define\s+SCYAN_IDLE_SCREENS_ENABLED_RIGHT\s+(\d+)/);
    const parsedRightIdleTimeoutSec = rightIdleTimeoutMsMatch ? Math.round(parseInt(rightIdleTimeoutMsMatch[1], 10) / 1000) : undefined;
    const parsedRightScreenOffTimeoutSec = rightSleepTimeoutMsMatch ? Math.round(parseInt(rightSleepTimeoutMsMatch[1], 10) / 1000) : undefined;
    const parsedRightIdleScreensEnabled = rightIdleScreensMatch ? (parseInt(rightIdleScreensMatch[1], 10) !== 0) : undefined;

    // 6d. Parse dongle-specific dimensions & power timers (if defined)
    const dongleVirtWidthMatch = cCode.match(/#define\s+DISPLAY_VIRTUAL_WIDTH_DONGLE\s+(\d+)/);
    const dongleVirtHeightMatch = cCode.match(/#define\s+DISPLAY_VIRTUAL_HEIGHT_DONGLE\s+(\d+)/);
    const dongleScreenDims = (dongleVirtWidthMatch && dongleVirtHeightMatch)
      ? { width: parseInt(dongleVirtWidthMatch[1], 10), height: parseInt(dongleVirtHeightMatch[1], 10) }
      : undefined;

    const dongleIdleTimeoutMsMatch = cCode.match(/#define\s+(?:SCYAN_IDLE_TIMEOUT_MS_DONGLE|CONFIG_SCYAN_IDLE_TIMEOUT_MS_DONGLE)\s+(\d+)/);
    const dongleSleepTimeoutMsMatch = cCode.match(/#define\s+(?:SCYAN_SLEEP_TIMEOUT_MS_DONGLE|CONFIG_SCYAN_SLEEP_TIMEOUT_MS_DONGLE)\s+(\d+)/);
    const dongleIdleScreensMatch = cCode.match(/#define\s+SCYAN_IDLE_SCREENS_ENABLED_DONGLE\s+(\d+)/);
    const parsedDongleIdleTimeoutSec = dongleIdleTimeoutMsMatch ? Math.round(parseInt(dongleIdleTimeoutMsMatch[1], 10) / 1000) : undefined;
    const parsedDongleScreenOffTimeoutSec = dongleSleepTimeoutMsMatch ? Math.round(parseInt(dongleSleepTimeoutMsMatch[1], 10) / 1000) : undefined;
    const parsedDongleIdleScreensEnabled = dongleIdleScreensMatch ? (parseInt(dongleIdleScreensMatch[1], 10) !== 0) : undefined;

    const isAsymmetricC = !!(rightScreenDims || parsedRightIdleTimeoutSec !== undefined || parsedRightScreenOffTimeoutSec !== undefined || parsedRightIdleScreensEnabled !== undefined);

    // 7. If metadata JSON was missing or incomplete, reconstruct from C layout block arrays
    if (!metadata || (!metadata.leftBlocks && !metadata.rightBlocks && !metadata.dongleBlocks)) {
      const parseCBlocks = (arrayName: string, side: 'left' | 'right' | 'dongle' | string) => {
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

      const leftBlocks = parseCBlocks('LAYOUT_LEFT_ACTIVE_BLOCKS', 'central');
      const rightBlocks = parseCBlocks('LAYOUT_RIGHT_ACTIVE_BLOCKS', 'peripheral');
      const dongleBlocks = parseCBlocks('LAYOUT_DONGLE_ACTIVE_BLOCKS', 'central');
      const idleLeftBlocks = parseCBlocks('LAYOUT_LEFT_IDLE_BLOCKS', 'central');
      const idleRightBlocks = parseCBlocks('LAYOUT_RIGHT_IDLE_BLOCKS', 'peripheral');
      const idleDongleBlocks = parseCBlocks('LAYOUT_DONGLE_IDLE_BLOCKS', 'central');

      if (leftBlocks || rightBlocks || dongleBlocks || idleLeftBlocks || idleRightBlocks || idleDongleBlocks || screenDims) {
        metadata = {
          version: 1,
          centralBlocks: leftBlocks || metadata?.centralBlocks || metadata?.leftBlocks,
          peripheralBlocks: rightBlocks || metadata?.peripheralBlocks || metadata?.rightBlocks,
          idleCentralBlocks: idleLeftBlocks || metadata?.idleCentralBlocks || metadata?.idleLeftBlocks,
          idlePeripheralBlocks: idleRightBlocks || metadata?.idlePeripheralBlocks || metadata?.idleRightBlocks,
          leftBlocks: leftBlocks || metadata?.centralBlocks || metadata?.leftBlocks,
          rightBlocks: rightBlocks || metadata?.peripheralBlocks || metadata?.rightBlocks,
          dongleBlocks: dongleBlocks || metadata?.dongleBlocks,
          idleLeftBlocks: idleLeftBlocks || metadata?.idleCentralBlocks || metadata?.idleLeftBlocks,
          idleRightBlocks: idleRightBlocks || metadata?.idlePeripheralBlocks || metadata?.idleRightBlocks,
          idleDongleBlocks: idleDongleBlocks || metadata?.idleDongleBlocks,
          screenDimensions: screenDims || metadata?.screenDimensions,
          widgetInstances: metadata?.widgetInstances,
          idleTimeoutSec: metadata?.idleTimeoutSec ?? parsedIdleTimeoutSec,
          screenOffTimeoutSec: metadata?.screenOffTimeoutSec ?? parsedScreenOffTimeoutSec,
          idleScreensEnabled: metadata?.idleScreensEnabled ?? parsedIdleScreensEnabled,
          symmetricSettings: metadata?.symmetricSettings ?? (!isAsymmetricC),
          rightScreenDimensions: rightScreenDims || metadata?.rightScreenDimensions || metadata?.peripheralScreenDimensions,
          peripheralScreenDimensions: rightScreenDims || metadata?.peripheralScreenDimensions || metadata?.rightScreenDimensions,
          rightIdleTimeoutSec: metadata?.rightIdleTimeoutSec ?? parsedRightIdleTimeoutSec,
          rightScreenOffTimeoutSec: metadata?.rightScreenOffTimeoutSec ?? parsedRightScreenOffTimeoutSec,
          rightIdleScreensEnabled: metadata?.rightIdleScreensEnabled ?? parsedRightIdleScreensEnabled,
          dongleScreenDimensions: dongleScreenDims || metadata?.dongleScreenDimensions,
          dongleIdleScreensEnabled: metadata?.dongleIdleScreensEnabled ?? parsedDongleIdleScreensEnabled,
          dongleIdleTimeoutSec: metadata?.dongleIdleTimeoutSec ?? parsedDongleIdleTimeoutSec,
          dongleScreenOffTimeoutSec: metadata?.dongleScreenOffTimeoutSec ?? parsedDongleScreenOffTimeoutSec,
          enabledScreens: metadata?.enabledScreens
            ? metadata.enabledScreens.map(s => s === 'left' ? 'central' : s === 'right' ? 'peripheral' : s)
            : dongleBlocks && (!leftBlocks && !rightBlocks)
            ? ['dongle']
            : dongleBlocks
            ? ['central', 'dongle', 'peripheral']
            : ['central', 'peripheral'],
          shieldId: metadata?.shieldId,
        };
      }
    } else if (screenDims && !metadata.screenDimensions) {
      metadata.screenDimensions = screenDims;
    }
    // Merge parsed timer values into existing metadata if not already present
    if (metadata) {
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
        if (metadata.rightScreenDimensions || isAsymmetricC) {
          metadata.symmetricSettings = false;
        } else {
          metadata.symmetricSettings = true;
        }
      }
      if (rightScreenDims && !metadata.rightScreenDimensions) {
        metadata.rightScreenDimensions = rightScreenDims;
      }
      if (parsedRightIdleTimeoutSec !== undefined && metadata.rightIdleTimeoutSec === undefined) {
        metadata.rightIdleTimeoutSec = parsedRightIdleTimeoutSec;
      }
      if (parsedRightScreenOffTimeoutSec !== undefined && metadata.rightScreenOffTimeoutSec === undefined) {
        metadata.rightScreenOffTimeoutSec = parsedRightScreenOffTimeoutSec;
      }
      if (parsedRightIdleScreensEnabled !== undefined && metadata.rightIdleScreensEnabled === undefined) {
        metadata.rightIdleScreensEnabled = parsedRightIdleScreensEnabled;
      }
      if (dongleScreenDims && !metadata.dongleScreenDimensions) {
        metadata.dongleScreenDimensions = dongleScreenDims;
      }
      if (parsedDongleIdleTimeoutSec !== undefined && metadata.dongleIdleTimeoutSec === undefined) {
        metadata.dongleIdleTimeoutSec = parsedDongleIdleTimeoutSec;
      }
      if (parsedDongleScreenOffTimeoutSec !== undefined && metadata.dongleScreenOffTimeoutSec === undefined) {
        metadata.dongleScreenOffTimeoutSec = parsedDongleScreenOffTimeoutSec;
      }
      if (parsedDongleIdleScreensEnabled !== undefined && metadata.dongleIdleScreensEnabled === undefined) {
        metadata.dongleIdleScreensEnabled = parsedDongleIdleScreensEnabled;
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
      reconcileChartBlocks(metadata.leftBlocks);
      reconcileChartBlocks(metadata.rightBlocks);
      reconcileChartBlocks(metadata.dongleBlocks);
      reconcileChartBlocks(metadata.idleLeftBlocks);
      reconcileChartBlocks(metadata.idleRightBlocks);
      reconcileChartBlocks(metadata.idleDongleBlocks);

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
      reconcileWpmBlocks(metadata.leftBlocks);
      reconcileWpmBlocks(metadata.rightBlocks);
      reconcileWpmBlocks(metadata.dongleBlocks);
      reconcileWpmBlocks(metadata.idleLeftBlocks);
      reconcileWpmBlocks(metadata.idleRightBlocks);
      reconcileWpmBlocks(metadata.idleDongleBlocks);

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
      reconcileAnimationBlocks(metadata.leftBlocks);
      reconcileAnimationBlocks(metadata.rightBlocks);
      reconcileAnimationBlocks(metadata.dongleBlocks);
      reconcileAnimationBlocks(metadata.idleLeftBlocks);
      reconcileAnimationBlocks(metadata.idleRightBlocks);
      reconcileAnimationBlocks(metadata.idleDongleBlocks);
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
  const hwWidth = virtHeight;
  const hwHeight = virtWidth;

  const isSymmetric = metadata?.symmetricSettings !== false;
  const rightVirtWidth = (!isSymmetric && metadata?.rightScreenDimensions?.width) ? metadata.rightScreenDimensions.width : virtWidth;
  const rightVirtHeight = (!isSymmetric && metadata?.rightScreenDimensions?.height) ? metadata.rightScreenDimensions.height : virtHeight;
  const rightHwWidth = rightVirtHeight;
  const rightHwHeight = rightVirtWidth;

  const idleTimeoutMs = (metadata?.idleTimeoutSec ?? 30) * 1000;
  const screenOffTimeoutMs = (metadata?.screenOffTimeoutSec ?? 60) * 1000;
  const idleScreensEnabled = metadata?.idleScreensEnabled ?? true;

  const rightIdleTimeoutMs = (!isSymmetric && metadata?.rightIdleTimeoutSec !== undefined)
    ? metadata.rightIdleTimeoutSec * 1000
    : idleTimeoutMs;
  const rightScreenOffTimeoutMs = (!isSymmetric && metadata?.rightScreenOffTimeoutSec !== undefined)
    ? metadata.rightScreenOffTimeoutSec * 1000
    : screenOffTimeoutMs;
  const rightIdleScreensEnabled = (!isSymmetric && metadata?.rightIdleScreensEnabled !== undefined)
    ? metadata.rightIdleScreensEnabled
    : idleScreensEnabled;

  const hasDongle = metadata?.enabledScreens?.includes('dongle') || !!metadata?.dongleBlocks || !!metadata?.dongleScreenDimensions;
  const dongleVirtWidth = metadata?.dongleScreenDimensions?.width ?? 32;
  const dongleVirtHeight = metadata?.dongleScreenDimensions?.height ?? 128;
  const dongleHwWidth = dongleVirtHeight;
  const dongleHwHeight = dongleVirtWidth;
  const dongleIdleTimeoutMs = (metadata?.dongleIdleTimeoutSec ?? 30) * 1000;
  const dongleScreenOffTimeoutMs = (metadata?.dongleScreenOffTimeoutSec ?? 60) * 1000;
  const dongleIdleScreensEnabled = metadata?.dongleIdleScreensEnabled ?? true;

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
${!isSymmetric ? `#define DISPLAY_VIRTUAL_WIDTH_RIGHT  ${rightVirtWidth}
#define DISPLAY_VIRTUAL_HEIGHT_RIGHT ${rightVirtHeight}
#define DISPLAY_HW_WIDTH_RIGHT       ${rightHwWidth}
#define DISPLAY_HW_HEIGHT_RIGHT      ${rightHwHeight}
` : ''}${hasDongle ? `#define DISPLAY_VIRTUAL_WIDTH_DONGLE  ${dongleVirtWidth}
#define DISPLAY_VIRTUAL_HEIGHT_DONGLE ${dongleVirtHeight}
#define DISPLAY_HW_WIDTH_DONGLE       ${dongleHwWidth}
#define DISPLAY_HW_HEIGHT_DONGLE      ${dongleHwHeight}
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
${!isSymmetric ? `#define SCYAN_IDLE_SCREENS_ENABLED_LEFT  ${idleScreensEnabled ? 1 : 0}
#define SCYAN_IDLE_TIMEOUT_MS_LEFT       ${idleTimeoutMs}
#define SCYAN_SLEEP_TIMEOUT_MS_LEFT      ${screenOffTimeoutMs}
#define SCYAN_IDLE_SCREENS_ENABLED_RIGHT ${rightIdleScreensEnabled ? 1 : 0}
#define SCYAN_IDLE_TIMEOUT_MS_RIGHT        ${rightIdleTimeoutMs}
#define SCYAN_SLEEP_TIMEOUT_MS_RIGHT       ${rightScreenOffTimeoutMs}
` : ''}${hasDongle ? `#define SCYAN_IDLE_SCREENS_ENABLED_DONGLE ${dongleIdleScreensEnabled ? 1 : 0}
#define SCYAN_IDLE_TIMEOUT_MS_DONGLE        ${dongleIdleTimeoutMs}
#define SCYAN_SLEEP_TIMEOUT_MS_DONGLE       ${dongleScreenOffTimeoutMs}
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

  if (metadata && (
    metadata.centralBlocks || metadata.peripheralBlocks ||
    metadata.leftBlocks || metadata.rightBlocks || metadata.dongleBlocks ||
    metadata.idleCentralBlocks || metadata.idlePeripheralBlocks ||
    metadata.idleLeftBlocks || metadata.idleRightBlocks || metadata.idleDongleBlocks ||
    metadata.enabledScreens?.length
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
      if (instance?.config?.groupIds && instance.config.groupIds.length > 0) {
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
      if (instance?.config?.textEntries && instance.config.textEntries.length > 0) {
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

    const centralActive = metadata.centralBlocks || metadata.leftBlocks;
    const centralIdle = metadata.idleCentralBlocks || metadata.idleLeftBlocks;
    const peripheralActive = metadata.peripheralBlocks || metadata.rightBlocks;
    const peripheralIdle = metadata.idlePeripheralBlocks || metadata.idleRightBlocks;

    emitBlockArray('LAYOUT_LEFT_ACTIVE_BLOCKS', 'LAYOUT_LEFT_ACTIVE_COUNT', centralActive);
    emitBlockArray('LAYOUT_LEFT_IDLE_BLOCKS', 'LAYOUT_LEFT_IDLE_COUNT', centralIdle);
    emitBlockArray('LAYOUT_RIGHT_ACTIVE_BLOCKS', 'LAYOUT_RIGHT_ACTIVE_COUNT', peripheralActive);
    emitBlockArray('LAYOUT_RIGHT_IDLE_BLOCKS', 'LAYOUT_RIGHT_IDLE_COUNT', peripheralIdle);

    c += `/* ZMK Central & Peripheral aliases */\n`;
    c += `#define LAYOUT_CENTRAL_ACTIVE_BLOCKS LAYOUT_LEFT_ACTIVE_BLOCKS\n`;
    c += `#define LAYOUT_CENTRAL_ACTIVE_COUNT  LAYOUT_LEFT_ACTIVE_COUNT\n`;
    c += `#define LAYOUT_CENTRAL_IDLE_BLOCKS   LAYOUT_LEFT_IDLE_BLOCKS\n`;
    c += `#define LAYOUT_CENTRAL_IDLE_COUNT    LAYOUT_LEFT_IDLE_COUNT\n`;
    c += `#define LAYOUT_PERIPHERAL_ACTIVE_BLOCKS LAYOUT_RIGHT_ACTIVE_BLOCKS\n`;
    c += `#define LAYOUT_PERIPHERAL_ACTIVE_COUNT  LAYOUT_RIGHT_ACTIVE_COUNT\n`;
    c += `#define LAYOUT_PERIPHERAL_IDLE_BLOCKS   LAYOUT_RIGHT_IDLE_BLOCKS\n`;
    c += `#define LAYOUT_PERIPHERAL_IDLE_COUNT    LAYOUT_RIGHT_IDLE_COUNT\n\n`;

    if (metadata.dongleBlocks || metadata.idleDongleBlocks || metadata.enabledScreens?.includes('dongle')) {
      emitBlockArray('LAYOUT_DONGLE_ACTIVE_BLOCKS', 'LAYOUT_DONGLE_ACTIVE_COUNT', metadata.dongleBlocks);
      emitBlockArray('LAYOUT_DONGLE_IDLE_BLOCKS', 'LAYOUT_DONGLE_IDLE_COUNT', metadata.idleDongleBlocks);
    }
    if (metadata.peripheralScreens) {
      Object.entries(metadata.peripheralScreens).forEach(([id, screen]) => {
        const sanitized = id.toUpperCase().replace(/[^A-Z0-9_]/g, '_');
        emitBlockArray(`LAYOUT_${sanitized}_ACTIVE_BLOCKS`, `LAYOUT_${sanitized}_ACTIVE_COUNT`, screen.blocks);
        emitBlockArray(`LAYOUT_${sanitized}_IDLE_BLOCKS`, `LAYOUT_${sanitized}_IDLE_COUNT`, screen.idleBlocks);
      });
    }
  }

  if (metadata) {
    const cleanMeta = { ...metadata };
    delete (cleanMeta as any).screenSetup;
    if (cleanMeta.leftBlocks && !cleanMeta.centralBlocks) cleanMeta.centralBlocks = cleanMeta.leftBlocks;
    if (cleanMeta.rightBlocks && !cleanMeta.peripheralBlocks) cleanMeta.peripheralBlocks = cleanMeta.rightBlocks;
    if (cleanMeta.idleLeftBlocks && !cleanMeta.idleCentralBlocks) cleanMeta.idleCentralBlocks = cleanMeta.idleLeftBlocks;
    if (cleanMeta.idleRightBlocks && !cleanMeta.idlePeripheralBlocks) cleanMeta.idlePeripheralBlocks = cleanMeta.idleRightBlocks;
    if (cleanMeta.enabledScreens) {
      cleanMeta.enabledScreens = cleanMeta.enabledScreens.map(s => s === 'left' ? 'central' : s === 'right' ? 'peripheral' : s);
    }
    c += `\n/* ZMK_DISPLAY_STUDIO_METADATA\n${JSON.stringify(cleanMeta, null, 2)}\n*/\n`;
  }

  return c;
}


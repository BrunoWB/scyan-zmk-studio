import { create } from 'zustand';
import { BwpxGrid } from '../bwpx/core/BwpxGrid';
import type { EditorViewport } from '../bwpx';
import type {
  SpriteSlice,
  FontGlyph,
  FontCharMapping,
} from '../types/zmk';
import {
  getDefaultAssets,
  type ParsedAssets,
} from '../services/cHeaderParser';

export const cloneParsedAssets = (assets: ParsedAssets): ParsedAssets => ({
  symbolsGrid: assets.symbolsGrid.clone(),
  symbolSlices: JSON.parse(JSON.stringify(assets.symbolSlices)),
  fontGrid: assets.fontGrid.clone(),
  fontGlyphs: JSON.parse(JSON.stringify(assets.fontGlyphs)),
  fontMappings: JSON.parse(JSON.stringify(assets.fontMappings || [])),
  metadata: assets.metadata ? JSON.parse(JSON.stringify(assets.metadata)) : undefined,
});

const getInitialSymbolsViewport = (): EditorViewport | undefined => {
  try {
    const saved = sessionStorage.getItem('zmk-symbols-viewport');
    if (saved) return JSON.parse(saved);
  } catch {}
  return undefined;
};

const getInitialFontViewport = (): EditorViewport | undefined => {
  try {
    const saved = sessionStorage.getItem('zmk-font-viewport');
    if (saved) return JSON.parse(saved);
  } catch {}
  return undefined;
};

export interface AtlasState {
  symbolsGrid: BwpxGrid;
  symbolSlices: SpriteSlice[];
  fontGrid: BwpxGrid;
  fontGlyphs: FontGlyph[];
  fontMappings: FontCharMapping[];
  symbolsViewport: EditorViewport | undefined;
  fontViewport: EditorViewport | undefined;
  initialAssets: ParsedAssets | null;

  setSymbolsGrid: (grid: BwpxGrid) => void;
  setSymbolSlices: (updater: SpriteSlice[] | ((prev: SpriteSlice[]) => SpriteSlice[])) => void;
  setFontGrid: (grid: BwpxGrid) => void;
  setFontGlyphs: (updater: FontGlyph[] | ((prev: FontGlyph[]) => FontGlyph[])) => void;
  setFontMappings: (updater: FontCharMapping[] | ((prev: FontCharMapping[]) => FontCharMapping[])) => void;
  setSymbolsViewport: (viewport: EditorViewport | undefined) => void;
  setFontViewport: (viewport: EditorViewport | undefined) => void;
  setInitialAssets: (assets: ParsedAssets | null) => void;
  applyAtlasAssets: (assets: {
    symbolsGrid: BwpxGrid;
    symbolSlices: SpriteSlice[];
    fontGrid: BwpxGrid;
    fontGlyphs: FontGlyph[];
    fontMappings?: FontCharMapping[];
  }) => void;
  resetAtlasDefaults: () => void;
}

export const useAtlasStore = create<AtlasState>((set) => {
  const defaultAssets = getDefaultAssets();

  return {
    symbolsGrid: defaultAssets.symbolsGrid,
    symbolSlices: defaultAssets.symbolSlices,
    fontGrid: defaultAssets.fontGrid,
    fontGlyphs: defaultAssets.fontGlyphs,
    fontMappings: defaultAssets.fontMappings,
    symbolsViewport: getInitialSymbolsViewport(),
    fontViewport: getInitialFontViewport(),
    initialAssets: null,

    setSymbolsGrid: (grid: BwpxGrid) => set({ symbolsGrid: grid }),

    setSymbolSlices: (updater: SpriteSlice[] | ((prev: SpriteSlice[]) => SpriteSlice[])) => {
      set((state) => ({
        symbolSlices: typeof updater === 'function' ? updater(state.symbolSlices) : updater,
      }));
    },

    setFontGrid: (grid: BwpxGrid) => set({ fontGrid: grid }),

    setFontGlyphs: (updater: FontGlyph[] | ((prev: FontGlyph[]) => FontGlyph[])) => {
      set((state) => ({
        fontGlyphs: typeof updater === 'function' ? updater(state.fontGlyphs) : updater,
      }));
    },

    setFontMappings: (updater: FontCharMapping[] | ((prev: FontCharMapping[]) => FontCharMapping[])) => {
      set((state) => ({
        fontMappings: typeof updater === 'function' ? updater(state.fontMappings) : updater,
      }));
    },

    setSymbolsViewport: (viewport: EditorViewport | undefined) => {
      set({ symbolsViewport: viewport });
      try {
        if (viewport) {
          sessionStorage.setItem('zmk-symbols-viewport', JSON.stringify(viewport));
        } else {
          sessionStorage.removeItem('zmk-symbols-viewport');
        }
      } catch {}
    },

    setFontViewport: (viewport: EditorViewport | undefined) => {
      set({ fontViewport: viewport });
      try {
        if (viewport) {
          sessionStorage.setItem('zmk-font-viewport', JSON.stringify(viewport));
        } else {
          sessionStorage.removeItem('zmk-font-viewport');
        }
      } catch {}
    },

    setInitialAssets: (assets: ParsedAssets | null) => {
      set({ initialAssets: assets ? cloneParsedAssets(assets) : null });
    },

    applyAtlasAssets: (assets) => {
      set({
        symbolsGrid: assets.symbolsGrid,
        symbolSlices: assets.symbolSlices,
        fontGrid: assets.fontGrid,
        fontGlyphs: assets.fontGlyphs,
        fontMappings: assets.fontMappings && assets.fontMappings.length > 0
          ? assets.fontMappings
          : getDefaultAssets().fontMappings,
      });
    },

    resetAtlasDefaults: () => {
      const def = getDefaultAssets();
      set({
        symbolsGrid: def.symbolsGrid,
        symbolSlices: def.symbolSlices,
        fontGrid: def.fontGrid,
        fontGlyphs: def.fontGlyphs,
        fontMappings: def.fontMappings,
      });
    },
  };
});

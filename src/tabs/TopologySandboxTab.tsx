import React, { useState, useMemo, useCallback } from 'react';
import { BwpxGrid } from '../bwpx/core/BwpxGrid';
import type { SpriteSlice, FontGlyph, FontCharMapping, LayoutBlock } from '../types/zmk';
import {
  DEFAULT_LEFT_LAYOUT_BLOCKS,
  DEFAULT_RIGHT_LAYOUT_BLOCKS,
  DEFAULT_DONGLE_LAYOUT_BLOCKS,
  DEFAULT_SYMBOL_SLICES,
  DEFAULT_FONT_GLYPHS,
  DEFAULT_FONT_MAPPINGS,
} from '../types/zmk';
import type { WidgetInstanceMap } from '../types/widget';
import type { PeripheralScreenData } from '../services/cHeaderParser';
import {
  getShieldParts,
  type ShieldPartItem,
} from '../data/shieldsData';
import {
  TopologyGridCanvas,
  type PlacedPartInstance,
  type LayoutDisplayItem,
} from '../components/topology/TopologyGridCanvas';
import { TopologyPartsPalette } from '../components/topology/TopologyPartsPalette';

export interface TopologySandboxTabProps {
  symbolsGrid: BwpxGrid;
  symbolSlices: SpriteSlice[];
  fontGrid: BwpxGrid;
  fontGlyphs?: FontGlyph[];
  fontMappings?: FontCharMapping[];
  leftBlocks?: LayoutBlock[];
  rightBlocks?: LayoutBlock[];
  dongleBlocks?: LayoutBlock[];
  idleLeftBlocks?: LayoutBlock[];
  idleRightBlocks?: LayoutBlock[];
  idleDongleBlocks?: LayoutBlock[];
  enabledScreens?: string[];
  peripheralScreens?: Record<string, PeripheralScreenData>;
  screenDimensions?: { width: number; height: number };
  rightScreenDimensions?: { width: number; height: number };
  dongleScreenDimensions?: { width: number; height: number };
  instances?: WidgetInstanceMap;
  customText?: string;
  onNavigateToPreview?: () => void;
  onSwapDisplays?: (displayIdA: string, displayIdB: string) => void;
  onMakeMaster?: (displayId: string) => void;
}

export const TopologySandboxTab: React.FC<TopologySandboxTabProps> = ({
  symbolsGrid,
  symbolSlices,
  fontGrid,
  fontGlyphs = [],
  fontMappings = [],
  leftBlocks = [],
  rightBlocks = [],
  dongleBlocks = [],
  idleLeftBlocks = [],
  idleRightBlocks = [],
  idleDongleBlocks = [],
  enabledScreens,
  peripheralScreens,
  screenDimensions,
  rightScreenDimensions,
  dongleScreenDimensions,
  instances,
  customText = 'SCYAN',
  onSwapDisplays,
  onMakeMaster,
}) => {
  const allParts = useMemo(() => getShieldParts(), []);

  // Initial state: Corne Split default (clean slate available via Clear button)
  const [placedParts, setPlacedParts] = useState<Record<string, PlacedPartInstance>>(() => {
    const initial: Record<string, PlacedPartInstance> = {};
    const corneLeft = allParts.find((p) => p.id === 'corne_left');
    const corneRight = allParts.find((p) => p.id === 'corne_right');
    if (corneLeft && corneRight) {
      initial['0,0'] = { part: corneLeft, x: 0, y: 0 };
      initial['1,0'] = { part: corneRight, x: 1, y: 0 };
    }
    return initial;
  });

  const [masterShieldKey, setMasterShieldKey] = useState<string | null>('0,0');

  const effectiveEnabledScreens = useMemo(() => {
    return enabledScreens && enabledScreens.length > 0 ? enabledScreens : ['left', 'right'];
  }, [enabledScreens]);

  const [displayAssignments, setDisplayAssignments] = useState<Record<string, string | null>>(() => {
    const initial: Record<string, string | null> = {};
    const screens = enabledScreens && enabledScreens.length > 0 ? enabledScreens : ['left', 'right'];
    if (screens.includes('left')) initial['0,0'] = 'left';
    if (screens.includes('right')) initial['1,0'] = 'right';
    return initial;
  });

  const [typingWpm, setTypingWpm] = useState(48);

  const handleKeystroke = useCallback(() => {
    setTypingWpm((w) => Math.min(130, Math.max(25, w + Math.floor(Math.random() * 6) - 1)));
  }, []);

  const handleQuickAddPart = useCallback(
    (part: ShieldPartItem) => {
      const keys = Object.keys(placedParts);
      if (keys.length === 0) {
        setPlacedParts({
          '0,0': { part, x: 0, y: 0 },
        });
        return;
      }

      // Find highest X in row 0, or place next to it
      let maxX = -Infinity;
      for (const k of keys) {
        const item = placedParts[k];
        if (item.x > maxX) maxX = item.x;
      }

      const nextX = maxX + 1;
      const nextKey = `${nextX},0`;
      setPlacedParts((prev) => ({
        ...prev,
        [nextKey]: { part, x: nextX, y: 0 },
      }));
    },
    [placedParts]
  );

  const effectiveSymbolSlices = useMemo(
    () => (symbolSlices && symbolSlices.length > 0 ? symbolSlices : DEFAULT_SYMBOL_SLICES),
    [symbolSlices]
  );
  const effectiveFontGlyphs = useMemo(
    () => (fontGlyphs && fontGlyphs.length > 0 ? fontGlyphs : DEFAULT_FONT_GLYPHS),
    [fontGlyphs]
  );
  const effectiveFontMappings = useMemo(
    () => (fontMappings && fontMappings.length > 0 ? fontMappings : DEFAULT_FONT_MAPPINGS),
    [fontMappings]
  );

  const effectiveLeftBlocks = useMemo(
    () => (leftBlocks && leftBlocks.length > 0 ? leftBlocks : DEFAULT_LEFT_LAYOUT_BLOCKS),
    [leftBlocks]
  );
  const effectiveRightBlocks = useMemo(
    () => (rightBlocks && rightBlocks.length > 0 ? rightBlocks : DEFAULT_RIGHT_LAYOUT_BLOCKS),
    [rightBlocks]
  );
  const effectiveDongleBlocks = useMemo(
    () => (dongleBlocks && dongleBlocks.length > 0 ? dongleBlocks : DEFAULT_DONGLE_LAYOUT_BLOCKS),
    [dongleBlocks]
  );

  const layoutDisplays = useMemo<Record<string, LayoutDisplayItem>>(() => {
    const record: Record<string, LayoutDisplayItem> = {};
    for (const screenId of effectiveEnabledScreens) {
      const isMaster = screenId === 'left';
      let name = 'Master Display';
      let dimensions = screenDimensions || { width: 32, height: 128 };
      let blocks = effectiveLeftBlocks;
      let idleBlocks = idleLeftBlocks;

      if (screenId === 'right') {
        name = 'Right Peripheral';
        dimensions = rightScreenDimensions || { width: 32, height: 128 };
        blocks = effectiveRightBlocks;
        idleBlocks = idleRightBlocks;
      } else if (screenId === 'dongle') {
        name = 'Dongle Display';
        dimensions = dongleScreenDimensions || { width: 128, height: 64 };
        blocks = effectiveDongleBlocks;
        idleBlocks = idleDongleBlocks;
      } else if (peripheralScreens && peripheralScreens[screenId]) {
        const periph = peripheralScreens[screenId];
        name = periph.name || `Peripheral ${screenId.replace('peripheral-', '')}`;
        dimensions = periph.screenDimensions || { width: 32, height: 128 };
        blocks = periph.blocks || [];
        idleBlocks = periph.idleBlocks || [];
      }

      record[screenId] = {
        id: screenId,
        name,
        isMaster,
        blocks,
        idleBlocks,
        dimensions,
      };
    }
    return record;
  }, [
    effectiveEnabledScreens,
    screenDimensions,
    rightScreenDimensions,
    dongleScreenDimensions,
    effectiveLeftBlocks,
    effectiveRightBlocks,
    effectiveDongleBlocks,
    idleLeftBlocks,
    idleRightBlocks,
    idleDongleBlocks,
    peripheralScreens,
  ]);

  return (
    <div className="flex-1 flex flex-col md:flex-row h-full overflow-hidden bg-[#0b0d13] text-[#e2e8f0] font-sans">
      {/* LEFT PANE: Clean Slate / Ever-Growing 2D Grid Canvas */}
      <TopologyGridCanvas
        placedParts={placedParts}
        onPlacedPartsChange={setPlacedParts}
        allParts={allParts}
        symbolsGrid={symbolsGrid}
        symbolSlices={effectiveSymbolSlices}
        fontGrid={fontGrid}
        fontGlyphs={effectiveFontGlyphs}
        fontMappings={effectiveFontMappings}
        activeLeftBlocks={effectiveLeftBlocks}
        activeRightBlocks={effectiveRightBlocks}
        activeDongleBlocks={effectiveDongleBlocks}
        layoutDisplays={layoutDisplays}
        displayAssignments={displayAssignments}
        onDisplayAssignmentsChange={setDisplayAssignments}
        masterShieldKey={masterShieldKey}
        onSetMasterShield={setMasterShieldKey}
        onSwapDisplays={onSwapDisplays}
        onMoveDisplayToMaster={onMakeMaster}
        typingWpm={typingWpm}
        customText={customText}
        instances={instances}
        onKeystroke={handleKeystroke}
      />

      {/* RIGHT PANE: Modular Shield Parts Palette */}
      <TopologyPartsPalette
        onQuickAddPart={handleQuickAddPart}
        symbolsGrid={symbolsGrid}
        symbolSlices={effectiveSymbolSlices}
        fontGrid={fontGrid}
        fontGlyphs={effectiveFontGlyphs}
        fontMappings={effectiveFontMappings}
        activeLeftBlocks={effectiveLeftBlocks}
        activeRightBlocks={effectiveRightBlocks}
        activeDongleBlocks={effectiveDongleBlocks}
      />
    </div>
  );
};

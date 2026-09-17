import React, { useState, useMemo, useCallback } from 'react';
import { BwpxGrid } from '../bwpx/core/BwpxGrid';
import type { SpriteSlice, FontGlyph, FontCharMapping, LayoutBlock } from '../types/zmk';
import {
  DEFAULT_CENTRAL_LAYOUT_BLOCKS,
  DEFAULT_PERIPHERAL_LAYOUT_BLOCKS,
  DEFAULT_IDLE_CENTRAL_BLOCKS,
  DEFAULT_IDLE_PERIPHERAL_BLOCKS,
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
  centralBlocks?: LayoutBlock[];
  peripheralBlocks?: LayoutBlock[];
  leftBlocks?: LayoutBlock[];
  rightBlocks?: LayoutBlock[];
  idleCentralBlocks?: LayoutBlock[];
  idlePeripheralBlocks?: LayoutBlock[];
  idleLeftBlocks?: LayoutBlock[];
  idleRightBlocks?: LayoutBlock[];
  enabledScreens?: string[];
  peripheralScreens?: Record<string, PeripheralScreenData>;
  screenDimensions?: { width: number; height: number };
  peripheralScreenDimensions?: { width: number; height: number };
  rightScreenDimensions?: { width: number; height: number };
  instances?: WidgetInstanceMap;
  customText?: string;
  displayAssignments?: Record<string, string | null>;
  onDisplayAssignmentsChange?: (assignments: Record<string, string | null>) => void;
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
  centralBlocks,
  peripheralBlocks,
  leftBlocks = [],
  rightBlocks = [],
  idleCentralBlocks,
  idlePeripheralBlocks,
  idleLeftBlocks = [],
  idleRightBlocks = [],
  enabledScreens,
  peripheralScreens,
  screenDimensions,
  peripheralScreenDimensions,
  rightScreenDimensions,
  instances,
  customText = 'SCYAN',
  displayAssignments: propDisplayAssignments,
  onDisplayAssignmentsChange: propOnDisplayAssignmentsChange,
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
    return enabledScreens && enabledScreens.length > 0 ? enabledScreens : ['central', 'peripheral'];
  }, [enabledScreens]);

  const [localDisplayAssignments, setLocalDisplayAssignments] = useState<Record<string, string | null>>(() => {
    const initial: Record<string, string | null> = {};
    const screens = enabledScreens && enabledScreens.length > 0 ? enabledScreens : ['central', 'peripheral'];
    if (screens.includes('central')) initial['0,0'] = 'central';
    else if (screens.includes('left')) initial['0,0'] = 'left';

    if (screens.includes('peripheral')) initial['1,0'] = 'peripheral';
    else if (screens.includes('right')) initial['1,0'] = 'right';
    return initial;
  });

  // Map shield-unit-keyed propDisplayAssignments to coordinate-keyed assignments for TopologyGridCanvas
  const canvasDisplayAssignments = useMemo(() => {
    if (!propDisplayAssignments) {
      return localDisplayAssignments;
    }
    const result: Record<string, string | null> = {};
    for (const [cellKey, instance] of Object.entries(placedParts)) {
      const partId = instance.part.id;
      if (partId in propDisplayAssignments) {
        result[cellKey] = propDisplayAssignments[partId];
      } else {
        result[cellKey] = null;
      }
    }
    return result;
  }, [placedParts, propDisplayAssignments, localDisplayAssignments]);

  const handleCanvasDisplayAssignmentsChange = useCallback((newCellAssignments: Record<string, string | null>) => {
    setLocalDisplayAssignments(newCellAssignments);
    if (propOnDisplayAssignmentsChange && propDisplayAssignments) {
      const nextShieldAssignments: Record<string, string | null> = { ...propDisplayAssignments };
      for (const [cellKey, dispId] of Object.entries(newCellAssignments)) {
        const instance = placedParts[cellKey];
        if (instance) {
          nextShieldAssignments[instance.part.id] = dispId;
        }
      }
      propOnDisplayAssignmentsChange(nextShieldAssignments);
    }
  }, [placedParts, propDisplayAssignments, propOnDisplayAssignmentsChange]);

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

  const effectiveCentralBlocks = useMemo(
    () => (centralBlocks?.length ? centralBlocks : leftBlocks?.length ? leftBlocks : DEFAULT_CENTRAL_LAYOUT_BLOCKS),
    [centralBlocks, leftBlocks]
  );
  const effectivePeripheralBlocks = useMemo(
    () => (peripheralBlocks?.length ? peripheralBlocks : rightBlocks?.length ? rightBlocks : DEFAULT_PERIPHERAL_LAYOUT_BLOCKS),
    [peripheralBlocks, rightBlocks]
  );
  const effectiveIdleCentralBlocks = useMemo(
    () => (idleCentralBlocks?.length ? idleCentralBlocks : idleLeftBlocks?.length ? idleLeftBlocks : DEFAULT_IDLE_CENTRAL_BLOCKS),
    [idleCentralBlocks, idleLeftBlocks]
  );
  const effectiveIdlePeripheralBlocks = useMemo(
    () => (idlePeripheralBlocks?.length ? idlePeripheralBlocks : idleRightBlocks?.length ? idleRightBlocks : DEFAULT_IDLE_PERIPHERAL_BLOCKS),
    [idlePeripheralBlocks, idleRightBlocks]
  );

  const layoutDisplays = useMemo<Record<string, LayoutDisplayItem>>(() => {
    const record: Record<string, LayoutDisplayItem> = {};
    for (const screenId of effectiveEnabledScreens) {
      const isMaster = screenId === 'central' || screenId === 'left';
      let name = isMaster ? 'Master Display' : 'Peripheral Display';
      let dimensions = screenDimensions || { width: 32, height: 128 };
      let blocks = effectiveCentralBlocks;
      let idleBlocks = effectiveIdleCentralBlocks;

      if (screenId === 'peripheral' || screenId === 'right') {
        name = 'Peripheral Display';
        dimensions = peripheralScreenDimensions || rightScreenDimensions || { width: 32, height: 128 };
        blocks = effectivePeripheralBlocks;
        idleBlocks = effectiveIdlePeripheralBlocks;
      } else if (peripheralScreens && peripheralScreens[screenId]) {
        const periph = peripheralScreens[screenId];
        name = periph.name || `Peripheral ${screenId.replace('peripheral-', '')}`;
        dimensions = periph.screenDimensions || { width: 32, height: 128 };
        blocks = periph.blocks || [];
        idleBlocks = periph.idleBlocks || [];
      } else if (screenId.startsWith('peripheral-')) {
        name = `Peripheral ${screenId.replace('peripheral-', '')}`;
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
    peripheralScreenDimensions,
    rightScreenDimensions,
    effectiveCentralBlocks,
    effectivePeripheralBlocks,
    effectiveIdleCentralBlocks,
    effectiveIdlePeripheralBlocks,
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
        activeCentralBlocks={effectiveCentralBlocks}
        activePeripheralBlocks={effectivePeripheralBlocks}
        layoutDisplays={layoutDisplays}
        displayAssignments={canvasDisplayAssignments}
        onDisplayAssignmentsChange={handleCanvasDisplayAssignmentsChange}
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
        activeCentralBlocks={effectiveCentralBlocks}
        activePeripheralBlocks={effectivePeripheralBlocks}
      />
    </div>
  );
};

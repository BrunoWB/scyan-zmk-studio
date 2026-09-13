import React, { useState, useRef, useEffect, useCallback } from 'react';
import { BwpxGrid } from '../bwpx/core/BwpxGrid';
import type { SpriteSlice, FontGlyph, FontCharMapping, LayoutBlock } from '../types/zmk';
import {
  DEFAULT_CENTRAL_LAYOUT_BLOCKS,
  DEFAULT_PERIPHERAL_LAYOUT_BLOCKS,
  DEFAULT_IDLE_CENTRAL_BLOCKS,
  DEFAULT_IDLE_PERIPHERAL_BLOCKS,
} from '../types/zmk';
import type { DisplayWidgetDefinition, DragWidgetState } from '../types/widget';
import { getWidgetNaturalSize, resolveWidgetInstance } from '../services/widgetRegistry';
import { OledPanelColumn } from './blocks/OledPanelColumn';
import { WidgetCatalogList } from './blocks/WidgetCatalogList';
import { GhostDragOverlay } from './blocks/GhostDragOverlay';
import { PeripheralMasterWarningModal } from './blocks/PeripheralMasterWarningModal';
import { SideSettingsPanel } from '../components/ScreenSizePopover';
import { trackEvent } from '../services/analytics';
import type { PeripheralScreenData } from '../services/cHeaderParser';
import { Plus, Monitor } from 'lucide-react';

export interface BlocksTabProps {
  centralBlocks?: LayoutBlock[];
  peripheralBlocks?: LayoutBlock[];
  onCentralBlocksChange?: (blocks: LayoutBlock[]) => void;
  onPeripheralBlocksChange?: (blocks: LayoutBlock[]) => void;
  idleCentralBlocks?: LayoutBlock[];
  idlePeripheralBlocks?: LayoutBlock[];
  onIdleCentralBlocksChange?: (blocks: LayoutBlock[]) => void;
  onIdlePeripheralBlocksChange?: (blocks: LayoutBlock[]) => void;
  leftBlocks?: LayoutBlock[];
  rightBlocks?: LayoutBlock[];
  onLeftBlocksChange?: (blocks: LayoutBlock[]) => void;
  onRightBlocksChange?: (blocks: LayoutBlock[]) => void;
  idleLeftBlocks?: LayoutBlock[];
  idleRightBlocks?: LayoutBlock[];
  onIdleLeftBlocksChange?: (blocks: LayoutBlock[]) => void;
  onIdleRightBlocksChange?: (blocks: LayoutBlock[]) => void;
  peripheralScreens?: Record<string, PeripheralScreenData>;
  onPeripheralScreensChange?: (screens: Record<string, PeripheralScreenData>) => void;
  screenDimensions?: { width: number; height: number };
  onScreenDimensionsChange?: (dimensions: { width: number; height: number }) => void;
  idleScreensEnabled?: boolean;
  onIdleScreensEnabledChange?: (enabled: boolean) => void;
  idleTimeoutSec?: number;
  onIdleTimeoutSecChange?: (sec: number) => void;
  screenOffTimeoutSec?: number;
  onScreenOffTimeoutSecChange?: (sec: number) => void;
  symmetricSettings?: boolean;
  onSymmetricSettingsChange?: (symmetric: boolean) => void;
  peripheralScreenDimensions?: { width: number; height: number };
  onPeripheralScreenDimensionsChange?: (dimensions: { width: number; height: number }) => void;
  peripheralIdleScreensEnabled?: boolean;
  onPeripheralIdleScreensEnabledChange?: (enabled: boolean) => void;
  peripheralIdleTimeoutSec?: number;
  onPeripheralIdleTimeoutSecChange?: (sec: number) => void;
  peripheralScreenOffTimeoutSec?: number;
  onPeripheralScreenOffTimeoutSecChange?: (sec: number) => void;
  rightScreenDimensions?: { width: number; height: number };
  onRightScreenDimensionsChange?: (dimensions: { width: number; height: number }) => void;
  rightIdleScreensEnabled?: boolean;
  onRightIdleScreensEnabledChange?: (enabled: boolean) => void;
  rightIdleTimeoutSec?: number;
  onRightIdleTimeoutSecChange?: (sec: number) => void;
  rightScreenOffTimeoutSec?: number;
  onRightScreenOffTimeoutSecChange?: (sec: number) => void;
  isSettingsOpen?: boolean;
  onToggleSettings?: () => void;
  onCloseSettings?: () => void;
  isCentralSettingsOpen?: boolean;
  onToggleCentralSettings?: () => void;
  onCloseCentralSettings?: () => void;
  isPeripheralSettingsOpen?: boolean;
  onTogglePeripheralSettings?: () => void;
  onClosePeripheralSettings?: () => void;
  isLeftSettingsOpen?: boolean;
  onToggleLeftSettings?: () => void;
  onCloseLeftSettings?: () => void;
  isRightSettingsOpen?: boolean;
  onToggleRightSettings?: () => void;
  onCloseRightSettings?: () => void;
  enabledScreens?: string[];
  onEnabledScreensChange?: (screens: string[]) => void;
  onResetDefaults?: () => void;
  symbolsGrid: BwpxGrid;
  symbolSlices: SpriteSlice[];
  fontGrid: BwpxGrid;
  fontGlyphs?: FontGlyph[];
  fontMappings?: FontCharMapping[];
  customText: string;
  instances?: import('../types/widget').WidgetInstanceMap;
  onInstancesChange?: (instances: import('../types/widget').WidgetInstanceMap) => void;

  // Backwards compatibility props
  layoutBlocks?: LayoutBlock[];
  onLayoutBlocksChange?: (blocks: LayoutBlock[]) => void;
  layerNames?: string[];
}

export const BlocksTab: React.FC<BlocksTabProps> = ({
  centralBlocks,
  peripheralBlocks,
  onCentralBlocksChange,
  onPeripheralBlocksChange,
  idleCentralBlocks,
  idlePeripheralBlocks,
  onIdleCentralBlocksChange,
  onIdlePeripheralBlocksChange,
  leftBlocks,
  rightBlocks,
  onLeftBlocksChange,
  onRightBlocksChange,
  idleLeftBlocks,
  idleRightBlocks,
  onIdleLeftBlocksChange,
  onIdleRightBlocksChange,
  peripheralScreens,
  onPeripheralScreensChange,
  layerNames,
  screenDimensions = { width: 32, height: 128 },
  onScreenDimensionsChange,
  idleScreensEnabled,
  onIdleScreensEnabledChange,
  idleTimeoutSec,
  onIdleTimeoutSecChange,
  screenOffTimeoutSec,
  onScreenOffTimeoutSecChange,
  symmetricSettings,
  onSymmetricSettingsChange,
  peripheralScreenDimensions,
  onPeripheralScreenDimensionsChange,
  peripheralIdleScreensEnabled,
  onPeripheralIdleScreensEnabledChange,
  peripheralIdleTimeoutSec,
  onPeripheralIdleTimeoutSecChange,
  peripheralScreenOffTimeoutSec,
  onPeripheralScreenOffTimeoutSecChange,
  rightScreenDimensions,
  onRightScreenDimensionsChange,
  rightIdleScreensEnabled,
  onRightIdleScreensEnabledChange,
  rightIdleTimeoutSec,
  onRightIdleTimeoutSecChange,
  rightScreenOffTimeoutSec,
  onRightScreenOffTimeoutSecChange,
  isSettingsOpen,
  onToggleSettings,
  onCloseSettings,
  isCentralSettingsOpen,
  onToggleCentralSettings,
  onCloseCentralSettings,
  isPeripheralSettingsOpen,
  onTogglePeripheralSettings,
  onClosePeripheralSettings,
  isLeftSettingsOpen,
  onToggleLeftSettings,
  onCloseLeftSettings,
  isRightSettingsOpen,
  onToggleRightSettings,
  onCloseRightSettings,
  enabledScreens,
  onEnabledScreensChange,
  onResetDefaults: _onResetDefaults,
  symbolsGrid,
  symbolSlices,
  fontGrid,
  fontGlyphs = [],
  fontMappings = [],
  customText,
  instances,
  onInstancesChange: _onInstancesChange,
  layoutBlocks,
  onLayoutBlocksChange,
}) => {
  // Active screen blocks
  const effectiveCentralBlocks = centralBlocks ?? leftBlocks ?? layoutBlocks ?? DEFAULT_CENTRAL_LAYOUT_BLOCKS;
  const effectivePeripheralBlocks = peripheralBlocks ?? rightBlocks ?? DEFAULT_PERIPHERAL_LAYOUT_BLOCKS;

  // Idle screen blocks
  const effectiveIdleCentralBlocks = idleCentralBlocks ?? idleLeftBlocks ?? DEFAULT_IDLE_CENTRAL_BLOCKS;
  const effectiveIdlePeripheralBlocks = idlePeripheralBlocks ?? idleRightBlocks ?? DEFAULT_IDLE_PERIPHERAL_BLOCKS;

  const handleCentralBlocksChange = onCentralBlocksChange || onLeftBlocksChange || onLayoutBlocksChange;
  const handlePeripheralBlocksChange = onPeripheralBlocksChange || onRightBlocksChange;
  const handleIdleCentralBlocksChange = onIdleCentralBlocksChange || onIdleLeftBlocksChange;
  const handleIdlePeripheralBlocksChange = onIdlePeripheralBlocksChange || onIdleRightBlocksChange;

  // Dynamic peripheral screens state
  const [localPeripheralScreens, setLocalPeripheralScreens] = useState<Record<string, PeripheralScreenData>>({});
  const effectivePeripheralScreens = peripheralScreens ?? localPeripheralScreens;
  const handlePeripheralScreensChange = onPeripheralScreensChange || setLocalPeripheralScreens;

  const [internalDynamicPeripheralSettingsOpen, setInternalDynamicPeripheralSettingsOpen] = useState<Record<string, boolean>>({});

  // Screen setup & enabled screens state
  const [localEnabledScreens, setLocalEnabledScreens] = useState<string[]>(['central', 'peripheral']);
  const effectiveEnabledScreens = (enabledScreens ?? localEnabledScreens)
    .map((s) => (s === 'left' ? 'central' : s === 'right' ? 'peripheral' : s))
    .filter((s) => s !== 'dongle');
  const handleEnabledScreensChange = onEnabledScreensChange || setLocalEnabledScreens;

  // Independent per-screen focus mode: 'active' or 'idle' for each screen ID ('central', 'peripheral', etc.)
  const [screenModes, setScreenModes] = useState<Record<string, 'active' | 'idle'>>({});

  const getScreenMode = useCallback(
    (side: string): 'active' | 'idle' => {
      const normalizedSide = side === 'left' ? 'central' : side === 'right' ? 'peripheral' : side;
      return screenModes[normalizedSide] ?? 'active';
    },
    [screenModes]
  );

  const setScreenMode = useCallback((side: string, mode: 'active' | 'idle') => {
    const normalizedSide = side === 'left' ? 'central' : side === 'right' ? 'peripheral' : side;
    setScreenModes((prev) => ({
      ...prev,
      [normalizedSide]: mode,
    }));
  }, []);

  // Independent Central & Peripheral settings state
  const [internalCentralSettingsOpen, setInternalCentralSettingsOpen] = useState(false);
  const [internalPeripheralSettingsOpen, setInternalPeripheralSettingsOpen] = useState(false);

  const effectiveCentralSettingsOpen = isCentralSettingsOpen !== undefined
    ? isCentralSettingsOpen
    : (isLeftSettingsOpen !== undefined ? isLeftSettingsOpen : (isSettingsOpen !== undefined ? isSettingsOpen : internalCentralSettingsOpen));
  const effectivePeripheralSettingsOpen = isPeripheralSettingsOpen !== undefined
    ? isPeripheralSettingsOpen
    : (isRightSettingsOpen !== undefined ? isRightSettingsOpen : internalPeripheralSettingsOpen);

  const toggleCentralSettings = onToggleCentralSettings || onToggleLeftSettings || onToggleSettings || (() => setInternalCentralSettingsOpen(prev => !prev));
  const closeCentralSettings = onCloseCentralSettings || onCloseLeftSettings || onCloseSettings || (() => setInternalCentralSettingsOpen(false));

  const togglePeripheralSettings = onTogglePeripheralSettings || onToggleRightSettings || (() => setInternalPeripheralSettingsOpen(prev => !prev));
  const closePeripheralSettings = onClosePeripheralSettings || onCloseRightSettings || (() => setInternalPeripheralSettingsOpen(false));

  const [localSymmetricSettings, setLocalSymmetricSettings] = useState(true);
  const effectiveSymmetricSettings = symmetricSettings !== undefined ? symmetricSettings : localSymmetricSettings;
  const handleSymmetricSettingsChange = onSymmetricSettingsChange || setLocalSymmetricSettings;

  const [localIdleScreensEnabled, setLocalIdleScreensEnabled] = useState(true);
  const effectiveIdleScreensEnabled = idleScreensEnabled !== undefined ? idleScreensEnabled : localIdleScreensEnabled;
  const handleIdleScreensEnabledChange = onIdleScreensEnabledChange || setLocalIdleScreensEnabled;

  const [localIdleTimeoutSec, setLocalIdleTimeoutSec] = useState(30);
  const effectiveIdleTimeoutSec = idleTimeoutSec !== undefined ? idleTimeoutSec : localIdleTimeoutSec;
  const handleIdleTimeoutSecChange = onIdleTimeoutSecChange || setLocalIdleTimeoutSec;

  const [localScreenOffTimeoutSec, setLocalScreenOffTimeoutSec] = useState(60);
  const effectiveScreenOffTimeoutSec = screenOffTimeoutSec !== undefined ? screenOffTimeoutSec : localScreenOffTimeoutSec;
  const handleScreenOffTimeoutSecChange = onScreenOffTimeoutSecChange || setLocalScreenOffTimeoutSec;

  // Peripheral effective settings (fallback to central when symmetric)
  const [localPeripheralScreenDimensions, setLocalPeripheralScreenDimensions] = useState(screenDimensions);
  const effectivePeripheralScreenDimensions = effectiveSymmetricSettings
    ? screenDimensions
    : (peripheralScreenDimensions ?? rightScreenDimensions ?? localPeripheralScreenDimensions);
  const handlePeripheralDimensionsChange = onPeripheralScreenDimensionsChange || onRightScreenDimensionsChange || setLocalPeripheralScreenDimensions;

  // Idle screen enabled toggles are strictly independent per display
  const [localPeripheralIdleScreensEnabled, setLocalPeripheralIdleScreensEnabled] = useState(true);
  const effectivePeripheralIdleScreensEnabled = peripheralIdleScreensEnabled !== undefined
    ? peripheralIdleScreensEnabled
    : (rightIdleScreensEnabled !== undefined ? rightIdleScreensEnabled : localPeripheralIdleScreensEnabled);
  const handlePeripheralIdleEnabledChange = onPeripheralIdleScreensEnabledChange || onRightIdleScreensEnabledChange || setLocalPeripheralIdleScreensEnabled;

  const [localPeripheralIdleTimeoutSec, setLocalPeripheralIdleTimeoutSec] = useState(30);
  const effectivePeripheralIdleTimeoutSec = effectiveSymmetricSettings
    ? effectiveIdleTimeoutSec
    : (peripheralIdleTimeoutSec !== undefined ? peripheralIdleTimeoutSec : (rightIdleTimeoutSec !== undefined ? rightIdleTimeoutSec : localPeripheralIdleTimeoutSec));
  const handlePeripheralIdleTimeoutChange = onPeripheralIdleTimeoutSecChange || onRightIdleTimeoutSecChange || setLocalPeripheralIdleTimeoutSec;

  const [localPeripheralScreenOffTimeoutSec, setLocalPeripheralScreenOffTimeoutSec] = useState(60);
  const effectivePeripheralScreenOffTimeoutSec = effectiveSymmetricSettings
    ? effectiveScreenOffTimeoutSec
    : (peripheralScreenOffTimeoutSec !== undefined ? peripheralScreenOffTimeoutSec : (rightScreenOffTimeoutSec !== undefined ? rightScreenOffTimeoutSec : localPeripheralScreenOffTimeoutSec));
  const handlePeripheralScreenOffTimeoutChange = onPeripheralScreenOffTimeoutSecChange || onRightScreenOffTimeoutSecChange || setLocalPeripheralScreenOffTimeoutSec;

  // Change handlers for Central: automatically updates Peripheral when symmetricSettings is true
  const handleCentralDimensionsChange = (dims: { width: number; height: number }) => {
    onScreenDimensionsChange?.(dims);
    if (effectiveSymmetricSettings) {
      handlePeripheralDimensionsChange(dims);
    }
  };

  const handleCentralIdleEnabledChange = (enabled: boolean) => {
    // Idle toggles are strictly independent per display
    handleIdleScreensEnabledChange(enabled);
  };

  const handleCentralIdleTimeoutChange = (sec: number) => {
    handleIdleTimeoutSecChange(sec);
    if (effectiveSymmetricSettings) {
      handlePeripheralIdleTimeoutChange(sec);
    }
  };

  const handleCentralScreenOffTimeoutChange = (sec: number) => {
    handleScreenOffTimeoutSecChange(sec);
    if (effectiveSymmetricSettings) {
      handlePeripheralScreenOffTimeoutChange(sec);
    }
  };

  const handleSymmetricChange = (next: boolean) => {
    handleSymmetricSettingsChange(next);
    if (next) {
      handlePeripheralDimensionsChange(screenDimensions);
      handlePeripheralIdleTimeoutChange(effectiveIdleTimeoutSec);
      handlePeripheralScreenOffTimeoutChange(effectiveScreenOffTimeoutSec);
    }
  };

  // Peripheral role actions: Make Master and Delete
  const handleMakeMaster = useCallback(
    (peripheralSide: string) => {
      if (peripheralSide === 'right' || peripheralSide === 'peripheral') {
        // 1. Swap active blocks
        const oldCentral = [...effectiveCentralBlocks];
        const oldPeripheral = [...effectivePeripheralBlocks];
        handleCentralBlocksChange?.(oldPeripheral);
        handlePeripheralBlocksChange?.(oldCentral);

        // 2. Swap idle blocks
        const oldIdleCentral = [...effectiveIdleCentralBlocks];
        const oldIdlePeripheral = [...effectiveIdlePeripheralBlocks];
        handleIdleCentralBlocksChange?.(oldIdlePeripheral);
        handleIdlePeripheralBlocksChange?.(oldIdleCentral);

        // 3. Swap dimensions
        const oldCentralDims = { ...screenDimensions };
        const oldPeripheralDims = { ...effectivePeripheralScreenDimensions };
        onScreenDimensionsChange?.(oldPeripheralDims);
        handlePeripheralDimensionsChange(oldCentralDims);

        // 4. Swap timeouts & power settings
        const oldCentralIdleEnabled = effectiveIdleScreensEnabled;
        const oldPeripheralIdleEnabled = effectivePeripheralIdleScreensEnabled;
        handleIdleScreensEnabledChange(oldPeripheralIdleEnabled);
        handlePeripheralIdleEnabledChange(oldCentralIdleEnabled);

        const oldCentralIdleTimeout = effectiveIdleTimeoutSec;
        const oldPeripheralIdleTimeout = effectivePeripheralIdleTimeoutSec;
        handleIdleTimeoutSecChange(oldPeripheralIdleTimeout);
        handlePeripheralIdleTimeoutChange(oldCentralIdleTimeout);

        const oldCentralOffTimeout = effectiveScreenOffTimeoutSec;
        const oldPeripheralOffTimeout = effectivePeripheralScreenOffTimeoutSec;
        handleScreenOffTimeoutSecChange(oldPeripheralOffTimeout);
        handlePeripheralScreenOffTimeoutChange(oldCentralOffTimeout);

        trackEvent('make_master_swap', { from: 'peripheral', to: 'central' });
      } else {
        // Swap with dynamic peripheral (e.g. peripheral-2)
        const pData = effectivePeripheralScreens[peripheralSide] || {
          blocks: [...DEFAULT_PERIPHERAL_LAYOUT_BLOCKS],
          idleBlocks: [...DEFAULT_IDLE_PERIPHERAL_BLOCKS],
          screenDimensions: { width: 32, height: 128 },
          idleScreensEnabled: true,
          idleTimeoutSec: 30,
          screenOffTimeoutSec: 60,
        };

        const oldCentral = [...effectiveCentralBlocks];
        const oldIdleCentral = [...effectiveIdleCentralBlocks];
        const oldCentralDims = { ...screenDimensions };
        const oldCentralIdleEnabled = effectiveIdleScreensEnabled;
        const oldCentralIdleTimeout = effectiveIdleTimeoutSec;
        const oldCentralOffTimeout = effectiveScreenOffTimeoutSec;

        handleCentralBlocksChange?.(pData.blocks || []);
        handleIdleCentralBlocksChange?.(pData.idleBlocks || []);
        onScreenDimensionsChange?.(pData.screenDimensions || { width: 32, height: 128 });
        handleIdleScreensEnabledChange(pData.idleScreensEnabled ?? true);
        handleIdleTimeoutSecChange(pData.idleTimeoutSec ?? 30);
        handleScreenOffTimeoutSecChange(pData.screenOffTimeoutSec ?? 60);

        handlePeripheralScreensChange({
          ...effectivePeripheralScreens,
          [peripheralSide]: {
            ...pData,
            blocks: oldCentral,
            idleBlocks: oldIdleCentral,
            screenDimensions: oldCentralDims,
            idleScreensEnabled: oldCentralIdleEnabled,
            idleTimeoutSec: oldCentralIdleTimeout,
            screenOffTimeoutSec: oldCentralOffTimeout,
          },
        });

        trackEvent('make_master_swap', { from: peripheralSide, to: 'central' });
      }
    },
    [
      effectiveCentralBlocks,
      effectivePeripheralBlocks,
      effectiveIdleCentralBlocks,
      effectiveIdlePeripheralBlocks,
      effectivePeripheralScreens,
      screenDimensions,
      effectivePeripheralScreenDimensions,
      effectiveIdleScreensEnabled,
      effectivePeripheralIdleScreensEnabled,
      effectiveIdleTimeoutSec,
      effectivePeripheralIdleTimeoutSec,
      effectiveScreenOffTimeoutSec,
      effectivePeripheralScreenOffTimeoutSec,
      handleCentralBlocksChange,
      handlePeripheralBlocksChange,
      handleIdleCentralBlocksChange,
      handleIdlePeripheralBlocksChange,
      onScreenDimensionsChange,
      handlePeripheralDimensionsChange,
      handleIdleScreensEnabledChange,
      handlePeripheralIdleEnabledChange,
      handleIdleTimeoutSecChange,
      handlePeripheralIdleTimeoutChange,
      handleScreenOffTimeoutSecChange,
      handlePeripheralScreenOffTimeoutChange,
      handlePeripheralScreensChange,
    ]
  );

  const handleDeletePeripheral = useCallback(
    (peripheralSide: string) => {
      const updatedScreens = effectiveEnabledScreens.filter((s) => s !== peripheralSide);
      handleEnabledScreensChange(updatedScreens);
      if (peripheralSide === 'right' || peripheralSide === 'peripheral') {
        closePeripheralSettings();
      } else {
        const copy = { ...effectivePeripheralScreens };
        delete copy[peripheralSide];
        handlePeripheralScreensChange(copy);
        setInternalDynamicPeripheralSettingsOpen(prev => ({ ...prev, [peripheralSide]: false }));
      }
      trackEvent('delete_peripheral_display', { side: peripheralSide });
    },
    [effectiveEnabledScreens, effectivePeripheralScreens, handleEnabledScreensChange, handlePeripheralScreensChange, closePeripheralSettings]
  );

  const handleAddPeripheral = useCallback(() => {
    let nextSide: string;
    if (!effectiveEnabledScreens.includes('peripheral') && !effectiveEnabledScreens.includes('right')) {
      nextSide = 'peripheral';
    } else {
      let idx = 2;
      while (effectiveEnabledScreens.includes(`peripheral-${idx}`)) {
        idx++;
      }
      nextSide = `peripheral-${idx}`;
    }

    if (nextSide !== 'peripheral') {
      const num = nextSide.replace('peripheral-', '');
      const newPeripheralData: PeripheralScreenData = {
        name: `Peripheral ${num}`,
        blocks: [...DEFAULT_PERIPHERAL_LAYOUT_BLOCKS],
        idleBlocks: [...DEFAULT_IDLE_PERIPHERAL_BLOCKS],
        screenDimensions: { width: 32, height: 128 },
        idleScreensEnabled: true,
        idleTimeoutSec: 30,
        screenOffTimeoutSec: 60,
      };
      handlePeripheralScreensChange({
        ...effectivePeripheralScreens,
        [nextSide]: newPeripheralData,
      });
    }

    handleEnabledScreensChange([...effectiveEnabledScreens, nextSide]);
    trackEvent('add_peripheral_display', { side: nextSide });
  }, [effectiveEnabledScreens, effectivePeripheralScreens, handleEnabledScreensChange, handlePeripheralScreensChange]);

  // Reset focus to active for any specific display where idle screens are disabled
  useEffect(() => {
    setScreenModes((prev) => {
      let changed = false;
      const next = { ...prev };
      if (!effectiveIdleScreensEnabled && (next['central'] === 'idle' || next['left'] === 'idle')) {
        next['central'] = 'active';
        changed = true;
      }
      if (!effectivePeripheralIdleScreensEnabled && (next['peripheral'] === 'idle' || next['right'] === 'idle')) {
        next['peripheral'] = 'active';
        changed = true;
      }
      for (const [pSide, pData] of Object.entries(effectivePeripheralScreens)) {
        if (pData.idleScreensEnabled === false && next[pSide] === 'idle') {
          next[pSide] = 'active';
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [
    effectiveIdleScreensEnabled,
    effectivePeripheralIdleScreensEnabled,
    effectivePeripheralScreens,
  ]);

  // Undo history stacks (one per block list)
  const undoCentralRef = useRef<LayoutBlock[][]>([]);
  const undoPeripheralRef = useRef<LayoutBlock[][]>([]);
  const undoIdleCentralRef = useRef<LayoutBlock[][]>([]);
  const undoIdlePeripheralRef = useRef<LayoutBlock[][]>([]);

  const handleCentralBlocksChangeWithUndo = (newBlocks: LayoutBlock[]) => {
    undoCentralRef.current.push([...effectiveCentralBlocks]);
    if (handleCentralBlocksChange) handleCentralBlocksChange(newBlocks);
  };

  const handlePeripheralBlocksChangeWithUndo = (newBlocks: LayoutBlock[]) => {
    undoPeripheralRef.current.push([...effectivePeripheralBlocks]);
    if (handlePeripheralBlocksChange) handlePeripheralBlocksChange(newBlocks);
  };

  const handleIdleCentralBlocksChangeWithUndo = (newBlocks: LayoutBlock[]) => {
    undoIdleCentralRef.current.push([...effectiveIdleCentralBlocks]);
    if (handleIdleCentralBlocksChange) handleIdleCentralBlocksChange(newBlocks);
  };

  const handleIdlePeripheralBlocksChangeWithUndo = (newBlocks: LayoutBlock[]) => {
    undoIdlePeripheralRef.current.push([...effectiveIdlePeripheralBlocks]);
    if (handleIdlePeripheralBlocksChange) handleIdlePeripheralBlocksChange(newBlocks);
  };

  // Undo handlers per panel
  const handleUndoCentral = useCallback(() => {
    const prev = undoCentralRef.current.pop();
    if (prev && handleCentralBlocksChange) handleCentralBlocksChange(prev);
  }, [handleCentralBlocksChange]);

  const handleUndoPeripheral = useCallback(() => {
    const prev = undoPeripheralRef.current.pop();
    if (prev && handlePeripheralBlocksChange) handlePeripheralBlocksChange(prev);
  }, [handlePeripheralBlocksChange]);

  const handleUndoIdleCentral = useCallback(() => {
    const prev = undoIdleCentralRef.current.pop();
    if (prev && handleIdleCentralBlocksChange) handleIdleCentralBlocksChange(prev);
  }, [handleIdleCentralBlocksChange]);

  const handleUndoIdlePeripheral = useCallback(() => {
    const prev = undoIdlePeripheralRef.current.pop();
    if (prev && handleIdlePeripheralBlocksChange) handleIdlePeripheralBlocksChange(prev);
  }, [handleIdlePeripheralBlocksChange]);

  // Global Ctrl+Z handler (undoes the most recent change across all panels)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        const target = e.target as HTMLElement | null;
        if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable) return;
        e.preventDefault();
        // Find the most recently modified stack and pop it
        const stacks = [
          { ref: undoCentralRef, fn: handleUndoCentral },
          { ref: undoPeripheralRef, fn: handleUndoPeripheral },
          { ref: undoIdleCentralRef, fn: handleUndoIdleCentral },
          { ref: undoIdlePeripheralRef, fn: handleUndoIdlePeripheral },
        ];
        // Pop the stack with the most entries (last changed)
        let maxStack = stacks[0];
        for (const s of stacks) {
          if (s.ref.current.length > maxStack.ref.current.length) maxStack = s;
        }
        if (maxStack.ref.current.length > 0) {
          maxStack.fn();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndoCentral, handleUndoPeripheral, handleUndoIdleCentral, handleUndoIdlePeripheral]);

  // Unified block selection state across all displays
  const [selectedBlockSide, setSelectedBlockSide] = useState<string | null>('central');
  const [selectedBlockKind, setSelectedBlockKind] = useState<'active' | 'idle'>('active');
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(
    effectiveCentralBlocks[0]?.id || null
  );

  // Screen Clear Action Handlers
  const handleClearCentral = useCallback(() => {
    handleCentralBlocksChangeWithUndo([]);
    setSelectedBlockId(null);
  }, [handleCentralBlocksChangeWithUndo]);

  const handleClearPeripheral = useCallback(() => {
    handlePeripheralBlocksChangeWithUndo([]);
    setSelectedBlockId(null);
  }, [handlePeripheralBlocksChangeWithUndo]);

  const handleClearIdleCentral = useCallback(() => {
    handleIdleCentralBlocksChangeWithUndo([]);
    setSelectedBlockId(null);
  }, [handleIdleCentralBlocksChangeWithUndo]);

  const handleClearIdlePeripheral = useCallback(() => {
    handleIdlePeripheralBlocksChangeWithUndo([]);
    setSelectedBlockId(null);
  }, [handleIdlePeripheralBlocksChangeWithUndo]);

  const getPeripheralConfig = useCallback((side: string) => {
    if (side === 'right' || side === 'peripheral') {
      return {
        title: 'Peripheral Active',
        idleTitle: 'Peripheral Idle',
        blocks: effectivePeripheralBlocks,
        onBlocksChange: handlePeripheralBlocksChangeWithUndo,
        idleBlocks: effectiveIdlePeripheralBlocks,
        onIdleBlocksChange: handleIdlePeripheralBlocksChangeWithUndo,
        dimensions: effectivePeripheralScreenDimensions,
        onDimensionsChange: handlePeripheralDimensionsChange,
        idleEnabled: effectivePeripheralIdleScreensEnabled,
        onIdleEnabledChange: handlePeripheralIdleEnabledChange,
        idleTimeout: effectivePeripheralIdleTimeoutSec,
        onIdleTimeoutChange: handlePeripheralIdleTimeoutChange,
        screenOffTimeout: effectivePeripheralScreenOffTimeoutSec,
        onScreenOffTimeoutChange: handlePeripheralScreenOffTimeoutChange,
        isOpen: effectivePeripheralSettingsOpen,
        toggleSettings: togglePeripheralSettings,
        closeSettings: closePeripheralSettings,
        onClear: handleClearPeripheral,
        onClearIdle: handleClearIdlePeripheral,
        onUndo: handleUndoPeripheral,
        onUndoIdle: handleUndoIdlePeripheral,
      };
    }
    const pData = effectivePeripheralScreens[side] || {
      name: side.startsWith('peripheral-') ? `Peripheral ${side.replace('peripheral-', '')}` : side,
      blocks: [...DEFAULT_PERIPHERAL_LAYOUT_BLOCKS],
      idleBlocks: [...DEFAULT_IDLE_PERIPHERAL_BLOCKS],
      screenDimensions: { width: 32, height: 128 },
      idleScreensEnabled: true,
      idleTimeoutSec: 30,
      screenOffTimeoutSec: 60,
    };
    const pName = pData.name || (side.startsWith('peripheral-') ? `Peripheral ${side.replace('peripheral-', '')}` : side);

    const updatePeripheral = (partial: Partial<PeripheralScreenData>) => {
      handlePeripheralScreensChange({
        ...effectivePeripheralScreens,
        [side]: {
          ...pData,
          ...partial,
        },
      });
    };

    return {
      title: `${pName} Active (Peripheral)`,
      idleTitle: `${pName} Idle (Peripheral)`,
      blocks: pData.blocks ?? DEFAULT_PERIPHERAL_LAYOUT_BLOCKS,
      onBlocksChange: (newBlocks: LayoutBlock[]) => updatePeripheral({ blocks: newBlocks }),
      idleBlocks: pData.idleBlocks ?? DEFAULT_IDLE_PERIPHERAL_BLOCKS,
      onIdleBlocksChange: (newBlocks: LayoutBlock[]) => updatePeripheral({ idleBlocks: newBlocks }),
      dimensions: pData.screenDimensions ?? { width: 32, height: 128 },
      onDimensionsChange: (dims: { width: number; height: number }) => updatePeripheral({ screenDimensions: dims }),
      idleEnabled: pData.idleScreensEnabled ?? true,
      onIdleEnabledChange: (enabled: boolean) => updatePeripheral({ idleScreensEnabled: enabled }),
      idleTimeout: pData.idleTimeoutSec ?? 30,
      onIdleTimeoutChange: (sec: number) => updatePeripheral({ idleTimeoutSec: sec }),
      screenOffTimeout: pData.screenOffTimeoutSec ?? 60,
      onScreenOffTimeoutChange: (sec: number) => updatePeripheral({ screenOffTimeoutSec: sec }),
      isOpen: !!internalDynamicPeripheralSettingsOpen[side],
      toggleSettings: () => setInternalDynamicPeripheralSettingsOpen(prev => ({ ...prev, [side]: !prev[side] })),
      closeSettings: () => setInternalDynamicPeripheralSettingsOpen(prev => ({ ...prev, [side]: false })),
      onClear: () => updatePeripheral({ blocks: [] }),
      onClearIdle: () => updatePeripheral({ idleBlocks: [] }),
      onUndo: () => {},
      onUndoIdle: () => {},
    };
  }, [
    effectivePeripheralBlocks,
    handlePeripheralBlocksChangeWithUndo,
    effectiveIdlePeripheralBlocks,
    handleIdlePeripheralBlocksChangeWithUndo,
    effectivePeripheralScreenDimensions,
    handlePeripheralDimensionsChange,
    effectivePeripheralIdleScreensEnabled,
    handlePeripheralIdleEnabledChange,
    effectivePeripheralIdleTimeoutSec,
    handlePeripheralIdleTimeoutChange,
    effectivePeripheralScreenOffTimeoutSec,
    handlePeripheralScreenOffTimeoutChange,
    effectivePeripheralSettingsOpen,
    togglePeripheralSettings,
    closePeripheralSettings,
    handleClearPeripheral,
    handleClearIdlePeripheral,
    handleUndoPeripheral,
    handleUndoIdlePeripheral,
    effectivePeripheralScreens,
    handlePeripheralScreensChange,
    internalDynamicPeripheralSettingsOpen,
  ]);

  const getSideConfig = useCallback((side: string) => {
    if (side === 'left' || side === 'central') {
      return {
        title: 'Central Active',
        idleTitle: 'Central Idle',
        blocks: effectiveCentralBlocks,
        onBlocksChange: handleCentralBlocksChangeWithUndo,
        idleBlocks: effectiveIdleCentralBlocks,
        onIdleBlocksChange: handleIdleCentralBlocksChangeWithUndo,
        dimensions: screenDimensions,
        onDimensionsChange: handleCentralDimensionsChange,
        idleEnabled: effectiveIdleScreensEnabled,
        onIdleEnabledChange: handleCentralIdleEnabledChange,
        idleTimeout: effectiveIdleTimeoutSec,
        onIdleTimeoutChange: handleCentralIdleTimeoutChange,
        screenOffTimeout: effectiveScreenOffTimeoutSec,
        onScreenOffTimeoutChange: handleCentralScreenOffTimeoutChange,
        isOpen: effectiveCentralSettingsOpen,
        toggleSettings: toggleCentralSettings,
        closeSettings: closeCentralSettings,
        onClear: handleClearCentral,
        onClearIdle: handleClearIdleCentral,
        onUndo: handleUndoCentral,
        onUndoIdle: handleUndoIdleCentral,
      };
    }
    return getPeripheralConfig(side);
  }, [
    effectiveCentralBlocks,
    handleCentralBlocksChangeWithUndo,
    effectiveIdleCentralBlocks,
    handleIdleCentralBlocksChangeWithUndo,
    screenDimensions,
    handleCentralDimensionsChange,
    effectiveIdleScreensEnabled,
    handleCentralIdleEnabledChange,
    effectiveIdleTimeoutSec,
    handleCentralIdleTimeoutChange,
    effectiveScreenOffTimeoutSec,
    handleCentralScreenOffTimeoutChange,
    effectiveCentralSettingsOpen,
    toggleCentralSettings,
    closeCentralSettings,
    handleClearCentral,
    handleClearIdleCentral,
    handleUndoCentral,
    handleUndoIdleCentral,
    getPeripheralConfig,
  ]);

  // Drag-and-drop state from center widget catalog to OLED panels
  const [dragState, setDragState] = useState<DragWidgetState | null>(null);

  // Warning modal when master widget is placed on peripheral side
  const [warningModalState, setWarningModalState] = useState<{
    isOpen: boolean;
    widgetName: string;
    blockId: string;
    side: 'central' | 'peripheral' | string;
    targetMode: 'active' | 'idle';
  } | null>(null);

  const checkPeripheralMasterWarning = useCallback(
    (widget: DisplayWidgetDefinition, side: 'central' | 'peripheral' | string, blockId: string, targetMode: 'active' | 'idle') => {
      // In our dynamic layout architecture:
      // Central display is always Master. Any display on peripheral is Peripheral.
      const isPeripheral = side !== 'central' && side !== 'left';

      if (isPeripheral && widget.requiresMaster) {
        const isSuppressed = typeof window !== 'undefined' && localStorage.getItem('scyan_suppress_peripheral_master_modal') === 'true';
        if (!isSuppressed) {
          setWarningModalState({
            isOpen: true,
            widgetName: widget.name,
            blockId,
            side,
            targetMode,
          });
        }
      }
    },
    []
  );

  const handleDismissWarningModal = useCallback((dontShowAgain: boolean) => {
    if (dontShowAgain && typeof window !== 'undefined') {
      localStorage.setItem('scyan_suppress_peripheral_master_modal', 'true');
    }
    setWarningModalState(null);
  }, []);

  const handleRemoveWarningWidget = useCallback(
    (dontShowAgain: boolean) => {
      if (dontShowAgain && typeof window !== 'undefined') {
        localStorage.setItem('scyan_suppress_peripheral_master_modal', 'true');
      }
      if (warningModalState) {
        const { blockId, side, targetMode } = warningModalState;
        const cfg = getSideConfig(side);
        if (targetMode === 'active') {
          cfg.onBlocksChange(cfg.blocks.filter(b => b.id !== blockId));
        } else {
          cfg.onIdleBlocksChange(cfg.idleBlocks.filter(b => b.id !== blockId));
        }
        if (selectedBlockId === blockId) {
          setSelectedBlockId(null);
          setSelectedBlockSide(null);
        }
      }
      setWarningModalState(null);
    },
    [warningModalState, getSideConfig, selectedBlockId]
  );

  // Screen DOM element registration for precise drag hit-testing
  const screenElementsRef = useRef<Record<string, HTMLDivElement | null>>({});

  const handleRegisterScreenElement = useCallback(
    (screenKey: string, el: HTMLDivElement | null) => {
      screenElementsRef.current[screenKey] = el;
    },
    []
  );

  const dragStateRef = useRef<DragWidgetState | null>(null);

  // Initiate ghost drag from center widget catalog
  const handleStartDrag = useCallback(
    (widget: DisplayWidgetDefinition, clientX: number, clientY: number) => {
      const initialDrag: DragWidgetState = {
        widget,
        clientX,
        clientY,
        targetSide: null,
        targetX: null,
        targetY: null,
      };
      dragStateRef.current = initialDrag;
      setDragState(initialDrag);
    },
    []
  );

  // Quick add helper (clicks on catalog card)
  const handleQuickAdd = useCallback(
    (widget: DisplayWidgetDefinition, side: 'central' | 'peripheral' | string) => {
      const cfg = getSideConfig(side);
      const targetMode = cfg.idleEnabled ? getScreenMode(side) : 'active';
      const targetList = targetMode === 'active' ? cfg.blocks : cfg.idleBlocks;
      const targetSideW = cfg.dimensions.width || 32;
      const targetSideH = cfg.dimensions.height || 128;

      const patchedWidget = widget as DisplayWidgetDefinition & { instanceId?: string };
      const activeInstance = resolveWidgetInstance(instances, widget.id, patchedWidget.instanceId);
      const { width: naturalW, height: naturalH } = getWidgetNaturalSize(widget, symbolSlices, activeInstance, fontGlyphs, fontMappings);

      // Find lowest occupied Y coordinate to append cleanly
      let nextY = widget.defaultPlacement.defaultY;
      const occupiedBottoms = targetList
        .filter(b => b.enabled)
        .map(b => b.y + b.height);

      if (occupiedBottoms.length > 0) {
        const maxBottom = Math.max(...occupiedBottoms);
        if (maxBottom + naturalH <= targetSideH) {
          nextY = maxBottom;
        } else {
          nextY = Math.max(0, targetSideH - naturalH);
        }
      }

      const defaultX = widget.defaultPlacement.defaultX ?? Math.max(0, Math.floor((targetSideW - naturalW) / 2));

      const newBlock: LayoutBlock = {
        id: `block-${widget.id}-${Date.now()}`,
        widgetType: widget.id,
        instanceId: patchedWidget.instanceId,
        name: widget.name,
        x: defaultX,
        y: nextY,
        width: naturalW,
        height: naturalH,
        enabled: true,
        description: widget.description,
        side,
      };

      if (targetMode === 'active') {
        cfg.onBlocksChange([...targetList, newBlock]);
      } else {
        cfg.onIdleBlocksChange([...targetList, newBlock]);
      }
      setSelectedBlockSide(side);
      setSelectedBlockKind(targetMode);
      setSelectedBlockId(newBlock.id);
      if (side !== 'central' && side !== 'left') {
        checkPeripheralMasterWarning(widget, side, newBlock.id, targetMode);
      }
    },
    [getSideConfig, getScreenMode, instances, symbolSlices, fontGlyphs, fontMappings, checkPeripheralMasterWarning]
  );

  // Window listeners during active ghost drag
  const isDragging = dragState !== null;
  useEffect(() => {
    if (!isDragging) return;

    const handlePointerMove = (e: PointerEvent) => {
      const clientX = e.clientX;
      const clientY = e.clientY;

      let targetSide: string | null = null;
      let targetX: number | null = null;
      let targetY: number | null = null;

      const currentWidget = dragStateRef.current?.widget;
      if (!currentWidget) return;

      const patchedWidget = currentWidget as DisplayWidgetDefinition & { instanceId?: string };
      const activeInstance = resolveWidgetInstance(instances, currentWidget.id, patchedWidget.instanceId);
      const naturalSize = getWidgetNaturalSize(currentWidget, symbolSlices, activeInstance, fontGlyphs, fontMappings);

      const candidateSides = ['central', ...effectiveEnabledScreens.filter(s => s !== 'central' && s !== 'left')];
      for (const side of candidateSides) {
        const cfg = getSideConfig(side);
        const targetSuffix = cfg.idleEnabled ? getScreenMode(side) : 'active';
        const el = screenElementsRef.current[`${side}-${targetSuffix}`];
        if (el) {
          const rect = el.getBoundingClientRect();
          if (
            clientX >= rect.left - 40 &&
            clientX <= rect.right + 40 &&
            clientY >= rect.top - 20 &&
            clientY <= rect.bottom + 20
          ) {
            targetSide = side;
            const sideW = cfg.dimensions.width || 32;
            const sideH = cfg.dimensions.height || 128;
            const relX = Math.round(
              ((clientX - rect.left) / rect.width) * sideW - naturalSize.width / 2
            );
            const relY = Math.round(
              ((clientY - rect.top) / rect.height) * sideH - naturalSize.height / 2
            );
            targetX = Math.max(0, Math.min(sideW - naturalSize.width, relX));
            targetY = Math.max(0, Math.min(sideH - naturalSize.height, relY));
            break;
          }
        }
      }

      const updatedState: DragWidgetState = {
        widget: currentWidget,
        clientX,
        clientY,
        targetSide: targetSide as any,
        targetX,
        targetY,
      };
      dragStateRef.current = updatedState;
      setDragState(updatedState);
    };

    const handlePointerEnd = () => {
      const active = dragStateRef.current;
      if (active && active.targetSide && active.targetY !== null) {
        const side = active.targetSide;
        const patchedWidget = active.widget as DisplayWidgetDefinition & { instanceId?: string };
        const activeInstance = resolveWidgetInstance(instances, active.widget.id, patchedWidget.instanceId);
        const { width: naturalW, height: naturalH } = getWidgetNaturalSize(active.widget, symbolSlices, activeInstance, fontGlyphs, fontMappings);
        const newBlock: LayoutBlock = {
          id: `block-${active.widget.id}-${Date.now()}`,
          widgetType: active.widget.id,
          instanceId: patchedWidget.instanceId,
          name: active.widget.name,
          x: active.targetX ?? (active.widget.defaultPlacement.defaultX ?? 0),
          y: active.targetY,
          width: naturalW,
          height: naturalH,
          enabled: true,
          description: active.widget.description,
          side,
        };

        const cfg = getSideConfig(side);
        const targetMode = cfg.idleEnabled ? getScreenMode(side) : 'active';
        trackEvent('widget_added', {
          widget_type: active.widget.id,
          side,
          mode: targetMode,
        });

        if (targetMode === 'active') {
          cfg.onBlocksChange([...cfg.blocks, newBlock]);
        } else {
          cfg.onIdleBlocksChange([...cfg.idleBlocks, newBlock]);
        }
        setSelectedBlockSide(side);
        setSelectedBlockKind(targetMode);
        setSelectedBlockId(newBlock.id);
        if (side !== 'central' && side !== 'left') {
          checkPeripheralMasterWarning(active.widget, side, newBlock.id, targetMode);
        }
      }

      dragStateRef.current = null;
      setDragState(null);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerEnd);
    window.addEventListener('pointercancel', handlePointerEnd);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerEnd);
      window.removeEventListener('pointercancel', handlePointerEnd);
    };
  }, [
    isDragging,
    getScreenMode,
    effectiveEnabledScreens,
    getSideConfig,
    symbolSlices,
    instances,
    fontGlyphs,
    fontMappings,
    checkPeripheralMasterWarning,
  ]);

  const totalDisplays = effectiveEnabledScreens.length;
  const isOverlaySettings = totalDisplays > 2;

  const masterSettingsPanel = (isOverlay: boolean) => (
    <SideSettingsPanel
      side="central"
      isOpen={effectiveCentralSettingsOpen}
      onClose={closeCentralSettings}
      isOverlay={isOverlay}
      screenDimensions={screenDimensions}
      onScreenDimensionsChange={handleCentralDimensionsChange}
      idleScreensEnabled={effectiveIdleScreensEnabled}
      onIdleScreensEnabledChange={handleCentralIdleEnabledChange}
      idleTimeoutSec={effectiveIdleTimeoutSec}
      onIdleTimeoutSecChange={handleCentralIdleTimeoutChange}
      screenOffTimeoutSec={effectiveScreenOffTimeoutSec}
      onScreenOffTimeoutSecChange={handleCentralScreenOffTimeoutChange}
      symmetricSettings={effectiveSymmetricSettings}
      onSymmetricSettingsChange={handleSymmetricChange}
      rightScreenDimensions={effectivePeripheralScreenDimensions}
      onRightScreenDimensionsChange={handlePeripheralDimensionsChange}
      rightIdleScreensEnabled={effectivePeripheralIdleScreensEnabled}
      onRightIdleScreensEnabledChange={handlePeripheralIdleEnabledChange}
      rightIdleTimeoutSec={effectivePeripheralIdleTimeoutSec}
      onRightIdleTimeoutSecChange={handlePeripheralIdleTimeoutChange}
      rightScreenOffTimeoutSec={effectivePeripheralScreenOffTimeoutSec}
      onRightScreenOffTimeoutSecChange={handlePeripheralScreenOffTimeoutChange}
      isPeripheral={false}
    />
  );

  const peripheralSettingsPanel = (side: string, cfg: ReturnType<typeof getPeripheralConfig>, isOverlay: boolean) => {
    return (
      <SideSettingsPanel
        side={side}
        isOpen={cfg.isOpen}
        onClose={cfg.closeSettings}
        isOverlay={isOverlay}
        screenDimensions={cfg.dimensions}
        onScreenDimensionsChange={cfg.onDimensionsChange}
        idleScreensEnabled={cfg.idleEnabled}
        onIdleScreensEnabledChange={cfg.onIdleEnabledChange}
        idleTimeoutSec={cfg.idleTimeout}
        onIdleTimeoutSecChange={cfg.onIdleTimeoutChange}
        screenOffTimeoutSec={cfg.screenOffTimeout}
        onScreenOffTimeoutSecChange={cfg.onScreenOffTimeoutChange}
        symmetricSettings={effectiveSymmetricSettings}
        onSymmetricSettingsChange={handleSymmetricChange}
        rightScreenDimensions={cfg.dimensions}
        onRightScreenDimensionsChange={cfg.onDimensionsChange}
        rightIdleScreensEnabled={cfg.idleEnabled}
        onRightIdleScreensEnabledChange={cfg.onIdleEnabledChange}
        rightIdleTimeoutSec={cfg.idleTimeout}
        onRightIdleTimeoutSecChange={cfg.onIdleTimeoutChange}
        rightScreenOffTimeoutSec={cfg.screenOffTimeout}
        onRightScreenOffTimeoutSecChange={cfg.onScreenOffTimeoutChange}
        isPeripheral={true}
        onMakeMaster={() => handleMakeMaster(side)}
        onDeleteDisplay={() => handleDeletePeripheral(side)}
      />
    );
  };

  const centralMode = getScreenMode('central');
  const centralColumnNode = (
    <React.Fragment key="master-display">
      {!isOverlaySettings && masterSettingsPanel(false)}
      <div className={`blocks-column-oled ${!effectiveIdleScreensEnabled ? 'idle-disabled' : centralMode === 'active' ? 'active-expanded' : 'idle-expanded'}`}>
        <OledPanelColumn
          side="central"
          screenKind="active"
          title="Central Active"
          subtitle="Central Host Coordinator Display"
          blocks={effectiveCentralBlocks}
          onBlocksChange={handleCentralBlocksChangeWithUndo}
          onClearScreen={handleClearCentral}
          onUndo={handleUndoCentral}
          onToggleSettings={toggleCentralSettings}
          isSettingsOpen={effectiveCentralSettingsOpen}
          symbolsGrid={symbolsGrid}
          symbolSlices={symbolSlices}
          fontGrid={fontGrid}
          fontGlyphs={fontGlyphs}
          fontMappings={fontMappings}
          customText={customText}
          instances={instances}
          isDropTarget={dragState?.targetSide === 'central' && (centralMode === 'active' || !effectiveIdleScreensEnabled)}
          dropTargetX={dragState?.targetSide === 'central' ? dragState.targetX : null}
          dropTargetY={dragState?.targetSide === 'central' ? dragState.targetY : null}
          draggedWidget={dragState?.widget || null}
          selectedBlockId={selectedBlockSide === 'central' && selectedBlockKind === 'active' ? selectedBlockId : null}
          onSelectBlock={id => {
            setSelectedBlockSide(id ? 'central' : null);
            setSelectedBlockKind('active');
            setSelectedBlockId(id);
          }}
          onRegisterScreenElement={handleRegisterScreenElement}
          screenDimensions={screenDimensions}
          layerNames={layerNames}
          isCompact={effectiveIdleScreensEnabled && centralMode === 'idle'}
          onExpand={() => setScreenMode('central', 'active')}
          onSwitchMode={effectiveIdleScreensEnabled ? () => setScreenMode('central', 'idle') : undefined}
        />

        {effectiveIdleScreensEnabled && (
          <OledPanelColumn
            side="central"
            screenKind="idle"
            title="Central Idle"
            subtitle="Central Host Coordinator Display"
            blocks={effectiveIdleCentralBlocks}
            onBlocksChange={handleIdleCentralBlocksChangeWithUndo}
            onClearScreen={handleClearIdleCentral}
            onUndo={handleUndoIdleCentral}
            onToggleSettings={toggleCentralSettings}
            isSettingsOpen={effectiveCentralSettingsOpen}
            symbolsGrid={symbolsGrid}
            symbolSlices={symbolSlices}
            fontGrid={fontGrid}
            fontGlyphs={fontGlyphs}
            fontMappings={fontMappings}
            customText={customText}
            instances={instances}
            isDropTarget={dragState?.targetSide === 'central' && centralMode === 'idle'}
            dropTargetX={dragState?.targetSide === 'central' ? dragState.targetX : null}
            dropTargetY={dragState?.targetSide === 'central' ? dragState.targetY : null}
            draggedWidget={dragState?.widget || null}
            selectedBlockId={selectedBlockSide === 'central' && selectedBlockKind === 'idle' ? selectedBlockId : null}
            onSelectBlock={id => {
              setSelectedBlockSide(id ? 'central' : null);
              setSelectedBlockKind('idle');
              setSelectedBlockId(id);
            }}
            onRegisterScreenElement={handleRegisterScreenElement}
            screenDimensions={screenDimensions}
            layerNames={layerNames}
            isCompact={centralMode === 'active'}
            onExpand={() => setScreenMode('central', 'idle')}
            onSwitchMode={() => setScreenMode('central', 'active')}
          />
        )}

        {isOverlaySettings && masterSettingsPanel(true)}
      </div>
    </React.Fragment>
  );

  const renderPeripheralNode = (side: string) => {
    const cfg = getPeripheralConfig(side);
    const sideMode = getScreenMode(side);

    return (
      <React.Fragment key={side}>
        <div className={`blocks-column-oled ${!cfg.idleEnabled ? 'idle-disabled' : sideMode === 'active' ? 'active-expanded' : 'idle-expanded'}`}>
          <OledPanelColumn
            side={side}
            screenKind="active"
            title={cfg.title}
            subtitle="Peripheral Display"
            blocks={cfg.blocks}
            onBlocksChange={cfg.onBlocksChange}
            onClearScreen={cfg.onClear}
            onUndo={cfg.onUndo}
            onToggleSettings={cfg.toggleSettings}
            isSettingsOpen={cfg.isOpen}
            symbolsGrid={symbolsGrid}
            symbolSlices={symbolSlices}
            fontGrid={fontGrid}
            fontGlyphs={fontGlyphs}
            fontMappings={fontMappings}
            customText={customText}
            instances={instances}
            isDropTarget={dragState?.targetSide === side && (sideMode === 'active' || !cfg.idleEnabled)}
            dropTargetX={dragState?.targetSide === side ? dragState.targetX : null}
            dropTargetY={dragState?.targetSide === side ? dragState.targetY : null}
            draggedWidget={dragState?.widget || null}
            selectedBlockId={selectedBlockSide === side && selectedBlockKind === 'active' ? selectedBlockId : null}
            onSelectBlock={id => {
              setSelectedBlockSide(id ? side : null);
              setSelectedBlockKind('active');
              setSelectedBlockId(id);
            }}
            onRegisterScreenElement={handleRegisterScreenElement}
            screenDimensions={cfg.dimensions}
            layerNames={layerNames}
            isCompact={cfg.idleEnabled && sideMode === 'idle'}
            onExpand={() => setScreenMode(side, 'active')}
            onSwitchMode={cfg.idleEnabled ? () => setScreenMode(side, 'idle') : undefined}
          />

          {cfg.idleEnabled && (
            <OledPanelColumn
              side={side}
              screenKind="idle"
              title={cfg.idleTitle}
              subtitle="Peripheral Display"
              blocks={cfg.idleBlocks}
              onBlocksChange={cfg.onIdleBlocksChange}
              onClearScreen={cfg.onClearIdle}
              onUndo={cfg.onUndoIdle}
              onToggleSettings={cfg.toggleSettings}
              isSettingsOpen={cfg.isOpen}
              symbolsGrid={symbolsGrid}
              symbolSlices={symbolSlices}
              fontGrid={fontGrid}
              fontGlyphs={fontGlyphs}
              fontMappings={fontMappings}
              customText={customText}
              instances={instances}
              isDropTarget={dragState?.targetSide === side && sideMode === 'idle'}
              dropTargetX={dragState?.targetSide === side ? dragState.targetX : null}
              dropTargetY={dragState?.targetSide === side ? dragState.targetY : null}
              draggedWidget={dragState?.widget || null}
              selectedBlockId={selectedBlockSide === side && selectedBlockKind === 'idle' ? selectedBlockId : null}
              onSelectBlock={id => {
                setSelectedBlockSide(id ? side : null);
                setSelectedBlockKind('idle');
                setSelectedBlockId(id);
              }}
              onRegisterScreenElement={handleRegisterScreenElement}
              screenDimensions={cfg.dimensions}
              layerNames={layerNames}
              isCompact={sideMode === 'active'}
              onExpand={() => setScreenMode(side, 'idle')}
              onSwitchMode={() => setScreenMode(side, 'active')}
            />
          )}

          {isOverlaySettings && peripheralSettingsPanel(side, cfg, true)}
        </div>

        {!isOverlaySettings && peripheralSettingsPanel(side, cfg, false)}
      </React.Fragment>
    );
  };

  const catalogColumnNode = (
    <div className="blocks-column-catalog">
      <WidgetCatalogList
        symbolsGrid={symbolsGrid}
        symbolSlices={symbolSlices}
        fontGrid={fontGrid}
        fontGlyphs={fontGlyphs}
        fontMappings={fontMappings}
        customText={customText}
        instances={instances}
        onStartDrag={handleStartDrag}
        onQuickAdd={handleQuickAdd}
      />
    </div>
  );

  const addButtonNode = (
    <div className="flex items-center justify-center self-stretch px-4 shrink-0">
      <button
        type="button"
        onClick={handleAddPeripheral}
        className="flex flex-col items-center justify-center w-28 h-64 border-2 border-dashed rounded-2xl transition-all duration-200 group border-[#1e2538] hover:border-[#00f0ff] bg-[#10141e]/50 hover:bg-[#00f0ff]/10 cursor-pointer shadow-sm hover:shadow-[0_0_16px_rgba(0,240,255,0.15)]"
        title="Add a new peripheral display to the right"
      >
        <div className="size-10 rounded-xl flex items-center justify-center transition-all mb-2 bg-[#1e2538] group-hover:bg-[#00f0ff] text-[#64748b] group-hover:text-black shadow-sm">
          <Plus size={22} />
        </div>
        <span className="text-xs font-bold transition-colors text-[#94a3b8] group-hover:text-[#00f0ff]">
          Add Display
        </span>
        <span className="text-[10px] font-mono text-[#64748b] mt-0.5">
          (Peripheral)
        </span>
      </button>
    </div>
  );

  const peripheralScreensList = effectiveEnabledScreens.filter((s) => s !== 'left' && s !== 'central');
  const peripheralsCount = peripheralScreensList.length;

  return (
    <div className="blocks-tab-wrapper">
      {/* SCREEN TOPOLOGY & VIEW SELECTOR BAR */}
      <div className="blocks-screen-topology-bar">
        <div className="topology-section">
          <span className="text-white font-semibold flex items-center gap-1.5">
            <Monitor size={14} className="text-[#00f0ff]" />
            <span>Layout Displays:</span>
          </span>
          <span className="text-[10px] font-mono text-[#00f0ff] bg-[#00f0ff]/10 border border-[#00f0ff]/20 px-2 py-0.5 rounded-full">
            1 Central
          </span>
          <span className="text-[10px] font-mono text-[#c084fc] bg-[#a855f7]/10 border border-[#a855f7]/20 px-2 py-0.5 rounded-full">
            {`${peripheralsCount} Peripheral${peripheralsCount === 1 ? '' : 's'}`}
          </span>
        </div>

        <div className="topology-section ml-auto">
          <span>Views:</span>
          <div className="topology-pills-group">
            <button
              type="button"
              className="topology-pill-btn"
              onClick={() => {
                const activeMap: Record<string, 'active' | 'idle'> = {};
                for (const s of effectiveEnabledScreens) activeMap[s] = 'active';
                setScreenModes(activeMap);
              }}
              title="Switch all displays to Active screen"
            >
              All Active
            </button>
            <button
              type="button"
              className="topology-pill-btn"
              onClick={() => {
                const idleMap: Record<string, 'active' | 'idle'> = {};
                for (const s of effectiveEnabledScreens) idleMap[s] = 'idle';
                setScreenModes(idleMap);
              }}
              title="Switch all displays to Idle screen"
            >
              All Idle
            </button>
          </div>
        </div>
      </div>

      <div className="blocks-tab-container">
        {/* Ghost Drag Floating Overlay attached to cursor */}
        {dragState && (
          <GhostDragOverlay
            dragState={dragState}
            symbolsGrid={symbolsGrid}
            symbolSlices={symbolSlices}
            fontGrid={fontGrid}
            fontGlyphs={fontGlyphs}
            fontMappings={fontMappings}
            customText={customText}
            instances={instances}
          />
        )}

        {/* Master Widget on Peripheral Half Warning Modal */}
        {warningModalState && (
          <PeripheralMasterWarningModal
            isOpen={warningModalState.isOpen}
            widgetName={warningModalState.widgetName}
            onDismiss={handleDismissWarningModal}
            onRemove={handleRemoveWarningWidget}
          />
        )}

        {/* 1. Master Display always on the LEFT of widgets */}
        {centralColumnNode}

        {/* 2. Widgets Catalog in the CENTER */}
        {catalogColumnNode}

        {/* 3. Peripherals on the RIGHT of widgets */}
        {peripheralScreensList.map((side) => renderPeripheralNode(side))}

        {/* 4. Add Button centered right of the right-most peripheral */}
        {addButtonNode}
      </div>
    </div>
  );
};

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { BwpxGrid } from '../bwpx/core/BwpxGrid';
import type { SpriteSlice, FontGlyph, FontCharMapping, LayoutBlock } from '../types/zmk';
import {
  DEFAULT_LEFT_LAYOUT_BLOCKS,
  DEFAULT_RIGHT_LAYOUT_BLOCKS,
  DEFAULT_IDLE_LEFT_BLOCKS,
  DEFAULT_IDLE_RIGHT_BLOCKS,
  DEFAULT_DONGLE_LAYOUT_BLOCKS,
  DEFAULT_IDLE_DONGLE_BLOCKS,
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
  leftBlocks?: LayoutBlock[];
  rightBlocks?: LayoutBlock[];
  dongleBlocks?: LayoutBlock[];
  peripheralScreens?: Record<string, PeripheralScreenData>;
  onPeripheralScreensChange?: (screens: Record<string, PeripheralScreenData>) => void;
  onLeftBlocksChange?: (blocks: LayoutBlock[]) => void;
  onRightBlocksChange?: (blocks: LayoutBlock[]) => void;
  onDongleBlocksChange?: (blocks: LayoutBlock[]) => void;
  idleLeftBlocks?: LayoutBlock[];
  idleRightBlocks?: LayoutBlock[];
  idleDongleBlocks?: LayoutBlock[];
  onIdleLeftBlocksChange?: (blocks: LayoutBlock[]) => void;
  onIdleRightBlocksChange?: (blocks: LayoutBlock[]) => void;
  onIdleDongleBlocksChange?: (blocks: LayoutBlock[]) => void;
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
  rightScreenDimensions?: { width: number; height: number };
  onRightScreenDimensionsChange?: (dimensions: { width: number; height: number }) => void;
  rightIdleScreensEnabled?: boolean;
  onRightIdleScreensEnabledChange?: (enabled: boolean) => void;
  rightIdleTimeoutSec?: number;
  onRightIdleTimeoutSecChange?: (sec: number) => void;
  rightScreenOffTimeoutSec?: number;
  onRightScreenOffTimeoutSecChange?: (sec: number) => void;
  dongleScreenDimensions?: { width: number; height: number };
  onDongleScreenDimensionsChange?: (dimensions: { width: number; height: number }) => void;
  dongleIdleScreensEnabled?: boolean;
  onDongleIdleScreensEnabledChange?: (enabled: boolean) => void;
  dongleIdleTimeoutSec?: number;
  onDongleIdleTimeoutSecChange?: (sec: number) => void;
  dongleScreenOffTimeoutSec?: number;
  onDongleScreenOffTimeoutSecChange?: (sec: number) => void;
  isSettingsOpen?: boolean;
  onToggleSettings?: () => void;
  onCloseSettings?: () => void;
  // Independent left/right/dongle side settings props
  isLeftSettingsOpen?: boolean;
  onToggleLeftSettings?: () => void;
  onCloseLeftSettings?: () => void;
  isRightSettingsOpen?: boolean;
  onToggleRightSettings?: () => void;
  onCloseRightSettings?: () => void;
  isDongleSettingsOpen?: boolean;
  onToggleDongleSettings?: () => void;
  onCloseDongleSettings?: () => void;
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
  leftBlocks,
  rightBlocks,
  dongleBlocks,
  onLeftBlocksChange,
  onRightBlocksChange,
  onDongleBlocksChange,
  idleLeftBlocks,
  idleRightBlocks,
  idleDongleBlocks,
  onIdleLeftBlocksChange,
  onIdleRightBlocksChange,
  onIdleDongleBlocksChange,
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
  rightScreenDimensions,
  onRightScreenDimensionsChange,
  rightIdleScreensEnabled,
  onRightIdleScreensEnabledChange,
  rightIdleTimeoutSec,
  onRightIdleTimeoutSecChange,
  rightScreenOffTimeoutSec,
  onRightScreenOffTimeoutSecChange,
  dongleScreenDimensions,
  onDongleScreenDimensionsChange,
  dongleIdleScreensEnabled,
  onDongleIdleScreensEnabledChange,
  dongleIdleTimeoutSec,
  onDongleIdleTimeoutSecChange,
  dongleScreenOffTimeoutSec,
  onDongleScreenOffTimeoutSecChange,
  isSettingsOpen,
  onToggleSettings,
  onCloseSettings,
  isLeftSettingsOpen,
  onToggleLeftSettings,
  onCloseLeftSettings,
  isRightSettingsOpen,
  onToggleRightSettings,
  onCloseRightSettings,
  isDongleSettingsOpen,
  onToggleDongleSettings,
  onCloseDongleSettings,
  enabledScreens,
  onEnabledScreensChange,
  peripheralScreens,
  onPeripheralScreensChange,
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
  const effectiveLeftBlocks = leftBlocks ?? layoutBlocks ?? DEFAULT_LEFT_LAYOUT_BLOCKS;
  const effectiveRightBlocks = rightBlocks ?? DEFAULT_RIGHT_LAYOUT_BLOCKS;
  const effectiveDongleBlocks = dongleBlocks ?? DEFAULT_DONGLE_LAYOUT_BLOCKS;

  // Idle screen blocks
  const effectiveIdleLeftBlocks = idleLeftBlocks ?? DEFAULT_IDLE_LEFT_BLOCKS;
  const effectiveIdleRightBlocks = idleRightBlocks ?? DEFAULT_IDLE_RIGHT_BLOCKS;
  const effectiveIdleDongleBlocks = idleDongleBlocks ?? DEFAULT_IDLE_DONGLE_BLOCKS;

  // Dynamic peripheral screens state
  const [localPeripheralScreens, setLocalPeripheralScreens] = useState<Record<string, PeripheralScreenData>>({});
  const effectivePeripheralScreens = peripheralScreens ?? localPeripheralScreens;
  const handlePeripheralScreensChange = onPeripheralScreensChange || setLocalPeripheralScreens;

  const [internalPeripheralSettingsOpen, setInternalPeripheralSettingsOpen] = useState<Record<string, boolean>>({});

  // Screen setup & enabled screens state
  const [localEnabledScreens, setLocalEnabledScreens] = useState<string[]>(['left', 'right']);
  const effectiveEnabledScreens = enabledScreens ?? localEnabledScreens;
  const handleEnabledScreensChange = onEnabledScreensChange || setLocalEnabledScreens;

  // Independent per-screen focus mode: 'active' or 'idle' for each screen ID ('left', 'right', 'dongle', etc.)
  const [screenModes, setScreenModes] = useState<Record<string, 'active' | 'idle'>>({});

  const getScreenMode = useCallback(
    (side: string): 'active' | 'idle' => {
      return screenModes[side] ?? 'active';
    },
    [screenModes]
  );

  const setScreenMode = useCallback((side: string, mode: 'active' | 'idle') => {
    setScreenModes((prev) => ({
      ...prev,
      [side]: mode,
    }));
  }, []);

  // Independent left, right & dongle settings state
  const [internalLeftSettingsOpen, setInternalLeftSettingsOpen] = useState(false);
  const [internalRightSettingsOpen, setInternalRightSettingsOpen] = useState(false);
  const [internalDongleSettingsOpen, setInternalDongleSettingsOpen] = useState(false);

  const effectiveLeftSettingsOpen = isLeftSettingsOpen !== undefined
    ? isLeftSettingsOpen
    : (isSettingsOpen !== undefined ? isSettingsOpen : internalLeftSettingsOpen);
  const effectiveRightSettingsOpen = isRightSettingsOpen !== undefined
    ? isRightSettingsOpen
    : internalRightSettingsOpen;
  const effectiveDongleSettingsOpen = isDongleSettingsOpen !== undefined
    ? isDongleSettingsOpen
    : internalDongleSettingsOpen;

  const toggleLeftSettings = onToggleLeftSettings || onToggleSettings || (() => setInternalLeftSettingsOpen(prev => !prev));
  const closeLeftSettings = onCloseLeftSettings || onCloseSettings || (() => setInternalLeftSettingsOpen(false));

  const toggleRightSettings = onToggleRightSettings || (() => setInternalRightSettingsOpen(prev => !prev));
  const closeRightSettings = onCloseRightSettings || (() => setInternalRightSettingsOpen(false));

  const toggleDongleSettings = onToggleDongleSettings || (() => setInternalDongleSettingsOpen(prev => !prev));
  const closeDongleSettings = onCloseDongleSettings || (() => setInternalDongleSettingsOpen(false));

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

  // Right-side effective settings (fallback to left when symmetric)
  const [localRightScreenDimensions, setLocalRightScreenDimensions] = useState(screenDimensions);
  const effectiveRightScreenDimensions = effectiveSymmetricSettings
    ? screenDimensions
    : (rightScreenDimensions ?? localRightScreenDimensions);
  const handleRightScreenDimensionsChange = onRightScreenDimensionsChange || setLocalRightScreenDimensions;

  // Idle screen enabled toggles are strictly independent per display
  const [localRightIdleScreensEnabled, setLocalRightIdleScreensEnabled] = useState(true);
  const effectiveRightIdleScreensEnabled = rightIdleScreensEnabled !== undefined ? rightIdleScreensEnabled : localRightIdleScreensEnabled;
  const handleRightIdleScreensEnabledChange = onRightIdleScreensEnabledChange || setLocalRightIdleScreensEnabled;

  const [localRightIdleTimeoutSec, setLocalRightIdleTimeoutSec] = useState(30);
  const effectiveRightIdleTimeoutSec = effectiveSymmetricSettings
    ? effectiveIdleTimeoutSec
    : (rightIdleTimeoutSec !== undefined ? rightIdleTimeoutSec : localRightIdleTimeoutSec);
  const handleRightIdleTimeoutSecChange = onRightIdleTimeoutSecChange || setLocalRightIdleTimeoutSec;

  const [localRightScreenOffTimeoutSec, setLocalRightScreenOffTimeoutSec] = useState(60);
  const effectiveRightScreenOffTimeoutSec = effectiveSymmetricSettings
    ? effectiveScreenOffTimeoutSec
    : (rightScreenOffTimeoutSec !== undefined ? rightScreenOffTimeoutSec : localRightScreenOffTimeoutSec);
  const handleRightScreenOffTimeoutSecChange = onRightScreenOffTimeoutSecChange || setLocalRightScreenOffTimeoutSec;

  // Dongle effective settings
  const [localDongleScreenDimensions, setLocalDongleScreenDimensions] = useState(screenDimensions);
  const effectiveDongleScreenDimensions = dongleScreenDimensions ?? localDongleScreenDimensions;
  const handleDongleScreenDimensionsChange = onDongleScreenDimensionsChange || setLocalDongleScreenDimensions;

  const [localDongleIdleScreensEnabled, setLocalDongleIdleScreensEnabled] = useState(true);
  const effectiveDongleIdleScreensEnabled = dongleIdleScreensEnabled !== undefined ? dongleIdleScreensEnabled : localDongleIdleScreensEnabled;
  const handleDongleIdleScreensEnabledChange = onDongleIdleScreensEnabledChange || setLocalDongleIdleScreensEnabled;

  const [localDongleIdleTimeoutSec, setLocalDongleIdleTimeoutSec] = useState(30);
  const effectiveDongleIdleTimeoutSec = dongleIdleTimeoutSec !== undefined ? dongleIdleTimeoutSec : localDongleIdleTimeoutSec;
  const handleDongleIdleTimeoutSecChange = onDongleIdleTimeoutSecChange || setLocalDongleIdleTimeoutSec;

  const [localDongleScreenOffTimeoutSec, setLocalDongleScreenOffTimeoutSec] = useState(60);
  const effectiveDongleScreenOffTimeoutSec = dongleScreenOffTimeoutSec !== undefined ? dongleScreenOffTimeoutSec : localDongleScreenOffTimeoutSec;
  const handleDongleScreenOffTimeoutSecChange = onDongleScreenOffTimeoutSecChange || setLocalDongleScreenOffTimeoutSec;

  const handleDongleDimensionsChange = (dims: { width: number; height: number }) => {
    handleDongleScreenDimensionsChange(dims);
  };

  const handleDongleIdleEnabledChange = (enabled: boolean) => {
    handleDongleIdleScreensEnabledChange(enabled);
  };

  const handleDongleIdleTimeoutChange = (sec: number) => {
    handleDongleIdleTimeoutSecChange(sec);
  };

  const handleDongleScreenOffTimeoutChange = (sec: number) => {
    handleDongleScreenOffTimeoutSecChange(sec);
  };

  // Change handlers for Left half: automatically updates Right half when symmetricSettings is true
  const handleLeftDimensionsChange = (dims: { width: number; height: number }) => {
    onScreenDimensionsChange?.(dims);
    if (effectiveSymmetricSettings) {
      handleRightScreenDimensionsChange(dims);
    }
  };

  const handleLeftIdleEnabledChange = (enabled: boolean) => {
    // Idle toggles are strictly independent per display
    handleIdleScreensEnabledChange(enabled);
  };

  const handleLeftIdleTimeoutChange = (sec: number) => {
    handleIdleTimeoutSecChange(sec);
    if (effectiveSymmetricSettings) {
      handleRightIdleTimeoutSecChange(sec);
    }
  };

  const handleLeftScreenOffTimeoutChange = (sec: number) => {
    handleScreenOffTimeoutSecChange(sec);
    if (effectiveSymmetricSettings) {
      handleRightScreenOffTimeoutSecChange(sec);
    }
  };

  const handleSymmetricChange = (next: boolean) => {
    handleSymmetricSettingsChange(next);
    if (next) {
      handleRightScreenDimensionsChange(screenDimensions);
      handleRightIdleTimeoutSecChange(effectiveIdleTimeoutSec);
      handleRightScreenOffTimeoutSecChange(effectiveScreenOffTimeoutSec);
    }
  };

  // Peripheral role actions: Make Master and Delete
  const handleMakeMaster = useCallback(
    (peripheralSide: string) => {
      if (peripheralSide === 'right') {
        // 1. Swap active blocks
        const oldLeft = [...effectiveLeftBlocks];
        const oldRight = [...effectiveRightBlocks];
        onLeftBlocksChange?.(oldRight);
        onRightBlocksChange?.(oldLeft);

        // 2. Swap idle blocks
        const oldIdleLeft = [...effectiveIdleLeftBlocks];
        const oldIdleRight = [...effectiveIdleRightBlocks];
        onIdleLeftBlocksChange?.(oldIdleRight);
        onIdleRightBlocksChange?.(oldIdleLeft);

        // 3. Swap dimensions
        const oldLeftDims = { ...screenDimensions };
        const oldRightDims = { ...effectiveRightScreenDimensions };
        onScreenDimensionsChange?.(oldRightDims);
        handleRightScreenDimensionsChange(oldLeftDims);

        // 4. Swap timeouts & power settings
        const oldLeftIdleEnabled = effectiveIdleScreensEnabled;
        const oldRightIdleEnabled = effectiveRightIdleScreensEnabled;
        handleIdleScreensEnabledChange(oldRightIdleEnabled);
        handleRightIdleScreensEnabledChange(oldLeftIdleEnabled);

        const oldLeftIdleTimeout = effectiveIdleTimeoutSec;
        const oldRightIdleTimeout = effectiveRightIdleTimeoutSec;
        handleIdleTimeoutSecChange(oldRightIdleTimeout);
        handleRightIdleTimeoutSecChange(oldLeftIdleTimeout);

        const oldLeftOffTimeout = effectiveScreenOffTimeoutSec;
        const oldRightOffTimeout = effectiveRightScreenOffTimeoutSec;
        handleScreenOffTimeoutSecChange(oldRightOffTimeout);
        handleRightScreenOffTimeoutSecChange(oldLeftOffTimeout);

        trackEvent('make_master_swap', { from: 'right', to: 'left' });
      } else if (peripheralSide === 'dongle') {
        // 1. Swap active blocks
        const oldLeft = [...effectiveLeftBlocks];
        const oldDongle = [...effectiveDongleBlocks];
        onLeftBlocksChange?.(oldDongle);
        onDongleBlocksChange?.(oldLeft);

        // 2. Swap idle blocks
        const oldIdleLeft = [...effectiveIdleLeftBlocks];
        const oldIdleDongle = [...effectiveIdleDongleBlocks];
        onIdleLeftBlocksChange?.(oldIdleDongle);
        onIdleDongleBlocksChange?.(oldIdleLeft);

        // 3. Swap dimensions
        const oldLeftDims = { ...screenDimensions };
        const oldDongleDims = { ...effectiveDongleScreenDimensions };
        onScreenDimensionsChange?.(oldDongleDims);
        handleDongleDimensionsChange(oldLeftDims);

        // 4. Swap timeouts & power settings
        const oldLeftIdleEnabled = effectiveIdleScreensEnabled;
        const oldDongleIdleEnabled = effectiveDongleIdleScreensEnabled;
        handleIdleScreensEnabledChange(oldDongleIdleEnabled);
        handleDongleIdleEnabledChange(oldLeftIdleEnabled);

        const oldLeftIdleTimeout = effectiveIdleTimeoutSec;
        const oldDongleIdleTimeout = effectiveDongleIdleTimeoutSec;
        handleIdleTimeoutSecChange(oldDongleIdleTimeout);
        handleDongleIdleTimeoutChange(oldLeftIdleTimeout);

        const oldLeftOffTimeout = effectiveScreenOffTimeoutSec;
        const oldDongleOffTimeout = effectiveDongleScreenOffTimeoutSec;
        handleScreenOffTimeoutSecChange(oldDongleOffTimeout);
        handleDongleScreenOffTimeoutChange(oldLeftOffTimeout);

        trackEvent('make_master_swap', { from: 'dongle', to: 'left' });
      } else {
        // Swap with dynamic peripheral (e.g. peripheral-3)
        const pData = effectivePeripheralScreens[peripheralSide] || {
          blocks: [...DEFAULT_RIGHT_LAYOUT_BLOCKS],
          idleBlocks: [...DEFAULT_IDLE_RIGHT_BLOCKS],
          screenDimensions: { width: 32, height: 128 },
          idleScreensEnabled: true,
          idleTimeoutSec: 30,
          screenOffTimeoutSec: 60,
        };

        const oldLeft = [...effectiveLeftBlocks];
        const oldIdleLeft = [...effectiveIdleLeftBlocks];
        const oldLeftDims = { ...screenDimensions };
        const oldLeftIdleEnabled = effectiveIdleScreensEnabled;
        const oldLeftIdleTimeout = effectiveIdleTimeoutSec;
        const oldLeftOffTimeout = effectiveScreenOffTimeoutSec;

        onLeftBlocksChange?.(pData.blocks || []);
        onIdleLeftBlocksChange?.(pData.idleBlocks || []);
        onScreenDimensionsChange?.(pData.screenDimensions || { width: 32, height: 128 });
        handleIdleScreensEnabledChange(pData.idleScreensEnabled ?? true);
        handleIdleTimeoutSecChange(pData.idleTimeoutSec ?? 30);
        handleScreenOffTimeoutSecChange(pData.screenOffTimeoutSec ?? 60);

        handlePeripheralScreensChange({
          ...effectivePeripheralScreens,
          [peripheralSide]: {
            ...pData,
            blocks: oldLeft,
            idleBlocks: oldIdleLeft,
            screenDimensions: oldLeftDims,
            idleScreensEnabled: oldLeftIdleEnabled,
            idleTimeoutSec: oldLeftIdleTimeout,
            screenOffTimeoutSec: oldLeftOffTimeout,
          },
        });

        trackEvent('make_master_swap', { from: peripheralSide, to: 'left' });
      }
    },
    [
      effectiveLeftBlocks,
      effectiveRightBlocks,
      effectiveDongleBlocks,
      effectiveIdleLeftBlocks,
      effectiveIdleRightBlocks,
      effectiveIdleDongleBlocks,
      effectivePeripheralScreens,
      screenDimensions,
      effectiveRightScreenDimensions,
      effectiveDongleScreenDimensions,
      effectiveIdleScreensEnabled,
      effectiveRightIdleScreensEnabled,
      effectiveDongleIdleScreensEnabled,
      effectiveIdleTimeoutSec,
      effectiveRightIdleTimeoutSec,
      effectiveDongleIdleTimeoutSec,
      effectiveScreenOffTimeoutSec,
      effectiveRightScreenOffTimeoutSec,
      effectiveDongleScreenOffTimeoutSec,
      onLeftBlocksChange,
      onRightBlocksChange,
      onDongleBlocksChange,
      onIdleLeftBlocksChange,
      onIdleRightBlocksChange,
      onIdleDongleBlocksChange,
      onScreenDimensionsChange,
      handleRightScreenDimensionsChange,
      handleDongleDimensionsChange,
      handleIdleScreensEnabledChange,
      handleRightIdleScreensEnabledChange,
      handleDongleIdleEnabledChange,
      handleIdleTimeoutSecChange,
      handleRightIdleTimeoutSecChange,
      handleDongleIdleTimeoutChange,
      handleScreenOffTimeoutSecChange,
      handleRightScreenOffTimeoutSecChange,
      handleDongleScreenOffTimeoutChange,
      handlePeripheralScreensChange,
    ]
  );

  const handleDeletePeripheral = useCallback(
    (peripheralSide: string) => {
      const updatedScreens = effectiveEnabledScreens.filter((s) => s !== peripheralSide);
      handleEnabledScreensChange(updatedScreens);
      if (peripheralSide === 'right') {
        closeRightSettings();
      } else if (peripheralSide === 'dongle') {
        closeDongleSettings();
      } else {
        const copy = { ...effectivePeripheralScreens };
        delete copy[peripheralSide];
        handlePeripheralScreensChange(copy);
        setInternalPeripheralSettingsOpen(prev => ({ ...prev, [peripheralSide]: false }));
      }
      trackEvent('delete_peripheral_display', { side: peripheralSide });
    },
    [effectiveEnabledScreens, effectivePeripheralScreens, handleEnabledScreensChange, handlePeripheralScreensChange, closeRightSettings, closeDongleSettings]
  );

  const handleAddPeripheral = useCallback(() => {
    let nextSide: string;
    if (!effectiveEnabledScreens.includes('right')) {
      nextSide = 'right';
    } else if (!effectiveEnabledScreens.includes('dongle')) {
      nextSide = 'dongle';
    } else {
      let idx = 3;
      while (effectiveEnabledScreens.includes(`peripheral-${idx}`)) {
        idx++;
      }
      nextSide = `peripheral-${idx}`;
    }

    if (!nextSide.startsWith('right') && !nextSide.startsWith('dongle')) {
      const num = nextSide.replace('peripheral-', '');
      const newPeripheralData: PeripheralScreenData = {
        name: `Peripheral ${num}`,
        blocks: [...DEFAULT_RIGHT_LAYOUT_BLOCKS],
        idleBlocks: [...DEFAULT_IDLE_RIGHT_BLOCKS],
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
      if (!effectiveIdleScreensEnabled && next['left'] === 'idle') {
        next['left'] = 'active';
        changed = true;
      }
      if (!effectiveRightIdleScreensEnabled && next['right'] === 'idle') {
        next['right'] = 'active';
        changed = true;
      }
      if (!effectiveDongleIdleScreensEnabled && next['dongle'] === 'idle') {
        next['dongle'] = 'active';
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
    effectiveRightIdleScreensEnabled,
    effectiveDongleIdleScreensEnabled,
    effectivePeripheralScreens,
  ]);

  // Undo history stacks (one per block list)
  const undoLeftRef = useRef<LayoutBlock[][]>([]);
  const undoRightRef = useRef<LayoutBlock[][]>([]);
  const undoDongleRef = useRef<LayoutBlock[][]>([]);
  const undoIdleLeftRef = useRef<LayoutBlock[][]>([]);
  const undoIdleRightRef = useRef<LayoutBlock[][]>([]);
  const undoIdleDongleRef = useRef<LayoutBlock[][]>([]);

  const handleLeftBlocksChange = (newBlocks: LayoutBlock[]) => {
    undoLeftRef.current.push([...effectiveLeftBlocks]);
    if (onLeftBlocksChange) onLeftBlocksChange(newBlocks);
    if (onLayoutBlocksChange) onLayoutBlocksChange(newBlocks);
  };

  const handleRightBlocksChange = (newBlocks: LayoutBlock[]) => {
    undoRightRef.current.push([...effectiveRightBlocks]);
    if (onRightBlocksChange) onRightBlocksChange(newBlocks);
  };

  const handleDongleBlocksChange = (newBlocks: LayoutBlock[]) => {
    undoDongleRef.current.push([...effectiveDongleBlocks]);
    if (onDongleBlocksChange) onDongleBlocksChange(newBlocks);
  };

  const handleIdleLeftBlocksChange = (newBlocks: LayoutBlock[]) => {
    undoIdleLeftRef.current.push([...effectiveIdleLeftBlocks]);
    if (onIdleLeftBlocksChange) onIdleLeftBlocksChange(newBlocks);
  };

  const handleIdleRightBlocksChange = (newBlocks: LayoutBlock[]) => {
    undoIdleRightRef.current.push([...effectiveIdleRightBlocks]);
    if (onIdleRightBlocksChange) onIdleRightBlocksChange(newBlocks);
  };

  const handleIdleDongleBlocksChange = (newBlocks: LayoutBlock[]) => {
    undoIdleDongleRef.current.push([...effectiveIdleDongleBlocks]);
    if (onIdleDongleBlocksChange) onIdleDongleBlocksChange(newBlocks);
  };

  // Undo handlers per panel
  const handleUndoLeft = useCallback(() => {
    const prev = undoLeftRef.current.pop();
    if (prev) {
      if (onLeftBlocksChange) onLeftBlocksChange(prev);
      if (onLayoutBlocksChange) onLayoutBlocksChange(prev);
    }
  }, [onLeftBlocksChange, onLayoutBlocksChange]);

  const handleUndoRight = useCallback(() => {
    const prev = undoRightRef.current.pop();
    if (prev && onRightBlocksChange) onRightBlocksChange(prev);
  }, [onRightBlocksChange]);

  const handleUndoDongle = useCallback(() => {
    const prev = undoDongleRef.current.pop();
    if (prev && onDongleBlocksChange) onDongleBlocksChange(prev);
  }, [onDongleBlocksChange]);

  const handleUndoIdleLeft = useCallback(() => {
    const prev = undoIdleLeftRef.current.pop();
    if (prev && onIdleLeftBlocksChange) onIdleLeftBlocksChange(prev);
  }, [onIdleLeftBlocksChange]);

  const handleUndoIdleRight = useCallback(() => {
    const prev = undoIdleRightRef.current.pop();
    if (prev && onIdleRightBlocksChange) onIdleRightBlocksChange(prev);
  }, [onIdleRightBlocksChange]);

  const handleUndoIdleDongle = useCallback(() => {
    const prev = undoIdleDongleRef.current.pop();
    if (prev && onIdleDongleBlocksChange) onIdleDongleBlocksChange(prev);
  }, [onIdleDongleBlocksChange]);

  // Global Ctrl+Z handler (undoes the most recent change across all panels)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        const target = e.target as HTMLElement | null;
        if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable) return;
        e.preventDefault();
        // Find the most recently modified stack and pop it
        const stacks = [
          { ref: undoLeftRef, fn: handleUndoLeft },
          { ref: undoDongleRef, fn: handleUndoDongle },
          { ref: undoRightRef, fn: handleUndoRight },
          { ref: undoIdleLeftRef, fn: handleUndoIdleLeft },
          { ref: undoIdleDongleRef, fn: handleUndoIdleDongle },
          { ref: undoIdleRightRef, fn: handleUndoIdleRight },
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
  }, [handleUndoLeft, handleUndoDongle, handleUndoRight, handleUndoIdleLeft, handleUndoIdleDongle, handleUndoIdleRight]);



  // Unified block selection state across all displays
  const [selectedBlockSide, setSelectedBlockSide] = useState<string | null>('left');
  const [selectedBlockKind, setSelectedBlockKind] = useState<'active' | 'idle'>('active');
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(
    effectiveLeftBlocks[0]?.id || null
  );

  // Screen Clear Action Handlers
  const handleClearLeft = useCallback(() => {
    handleLeftBlocksChange([]);
    setSelectedBlockId(null);
  }, [handleLeftBlocksChange]);

  const handleClearDongle = useCallback(() => {
    handleDongleBlocksChange([]);
    setSelectedBlockId(null);
  }, [handleDongleBlocksChange]);

  const handleClearRight = useCallback(() => {
    handleRightBlocksChange([]);
    setSelectedBlockId(null);
  }, [handleRightBlocksChange]);

  const handleClearIdleLeft = useCallback(() => {
    handleIdleLeftBlocksChange([]);
    setSelectedBlockId(null);
  }, [handleIdleLeftBlocksChange]);

  const handleClearIdleDongle = useCallback(() => {
    handleIdleDongleBlocksChange([]);
    setSelectedBlockId(null);
  }, [handleIdleDongleBlocksChange]);

  const handleClearIdleRight = useCallback(() => {
    handleIdleRightBlocksChange([]);
    setSelectedBlockId(null);
  }, [handleIdleRightBlocksChange]);

  const getPeripheralConfig = useCallback((side: string) => {
    if (side === 'right' || side === 'peripheral') {
      return {
        title: 'Peripheral Active',
        idleTitle: 'Peripheral Idle',
        blocks: effectiveRightBlocks,
        onBlocksChange: handleRightBlocksChange,
        idleBlocks: effectiveIdleRightBlocks,
        onIdleBlocksChange: handleIdleRightBlocksChange,
        dimensions: effectiveRightScreenDimensions,
        onDimensionsChange: handleRightScreenDimensionsChange,
        idleEnabled: effectiveRightIdleScreensEnabled,
        onIdleEnabledChange: handleRightIdleScreensEnabledChange,
        idleTimeout: effectiveRightIdleTimeoutSec,
        onIdleTimeoutChange: handleRightIdleTimeoutSecChange,
        screenOffTimeout: effectiveRightScreenOffTimeoutSec,
        onScreenOffTimeoutChange: handleRightScreenOffTimeoutSecChange,
        isOpen: effectiveRightSettingsOpen,
        toggleSettings: toggleRightSettings,
        closeSettings: closeRightSettings,
        onClear: handleClearRight,
        onClearIdle: handleClearIdleRight,
        onUndo: handleUndoRight,
        onUndoIdle: handleUndoIdleRight,
      };
    }
    if (side === 'dongle') {
      return {
        title: 'Dongle Active (Peripheral)',
        idleTitle: 'Dongle Idle (Peripheral)',
        blocks: effectiveDongleBlocks,
        onBlocksChange: handleDongleBlocksChange,
        idleBlocks: effectiveIdleDongleBlocks,
        onIdleBlocksChange: handleIdleDongleBlocksChange,
        dimensions: effectiveDongleScreenDimensions,
        onDimensionsChange: handleDongleDimensionsChange,
        idleEnabled: effectiveDongleIdleScreensEnabled,
        onIdleEnabledChange: handleDongleIdleEnabledChange,
        idleTimeout: effectiveDongleIdleTimeoutSec,
        onIdleTimeoutChange: handleDongleIdleTimeoutChange,
        screenOffTimeout: effectiveDongleScreenOffTimeoutSec,
        onScreenOffTimeoutChange: handleDongleScreenOffTimeoutChange,
        isOpen: effectiveDongleSettingsOpen,
        toggleSettings: toggleDongleSettings,
        closeSettings: closeDongleSettings,
        onClear: handleClearDongle,
        onClearIdle: handleClearIdleDongle,
        onUndo: handleUndoDongle,
        onUndoIdle: handleUndoIdleDongle,
      };
    }
    const pData = effectivePeripheralScreens[side] || {
      name: side.startsWith('peripheral-') ? `Peripheral ${side.replace('peripheral-', '')}` : side,
      blocks: [...DEFAULT_RIGHT_LAYOUT_BLOCKS],
      idleBlocks: [...DEFAULT_IDLE_RIGHT_BLOCKS],
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
      blocks: pData.blocks ?? DEFAULT_RIGHT_LAYOUT_BLOCKS,
      onBlocksChange: (newBlocks: LayoutBlock[]) => updatePeripheral({ blocks: newBlocks }),
      idleBlocks: pData.idleBlocks ?? DEFAULT_IDLE_RIGHT_BLOCKS,
      onIdleBlocksChange: (newBlocks: LayoutBlock[]) => updatePeripheral({ idleBlocks: newBlocks }),
      dimensions: pData.screenDimensions ?? { width: 32, height: 128 },
      onDimensionsChange: (dims: { width: number; height: number }) => updatePeripheral({ screenDimensions: dims }),
      idleEnabled: pData.idleScreensEnabled ?? true,
      onIdleEnabledChange: (enabled: boolean) => updatePeripheral({ idleScreensEnabled: enabled }),
      idleTimeout: pData.idleTimeoutSec ?? 30,
      onIdleTimeoutChange: (sec: number) => updatePeripheral({ idleTimeoutSec: sec }),
      screenOffTimeout: pData.screenOffTimeoutSec ?? 60,
      onScreenOffTimeoutChange: (sec: number) => updatePeripheral({ screenOffTimeoutSec: sec }),
      isOpen: !!internalPeripheralSettingsOpen[side],
      toggleSettings: () => setInternalPeripheralSettingsOpen(prev => ({ ...prev, [side]: !prev[side] })),
      closeSettings: () => setInternalPeripheralSettingsOpen(prev => ({ ...prev, [side]: false })),
      onClear: () => updatePeripheral({ blocks: [] }),
      onClearIdle: () => updatePeripheral({ idleBlocks: [] }),
      onUndo: () => {},
      onUndoIdle: () => {},
    };
  }, [
    effectiveRightBlocks,
    handleRightBlocksChange,
    effectiveIdleRightBlocks,
    handleIdleRightBlocksChange,
    effectiveRightScreenDimensions,
    handleRightScreenDimensionsChange,
    effectiveRightIdleScreensEnabled,
    handleRightIdleScreensEnabledChange,
    effectiveRightIdleTimeoutSec,
    handleRightIdleTimeoutSecChange,
    effectiveRightScreenOffTimeoutSec,
    handleRightScreenOffTimeoutSecChange,
    effectiveRightSettingsOpen,
    toggleRightSettings,
    closeRightSettings,
    handleClearRight,
    handleClearIdleRight,
    handleUndoRight,
    handleUndoIdleRight,
    effectiveDongleBlocks,
    handleDongleBlocksChange,
    effectiveIdleDongleBlocks,
    handleIdleDongleBlocksChange,
    effectiveDongleScreenDimensions,
    handleDongleDimensionsChange,
    effectiveDongleIdleScreensEnabled,
    handleDongleIdleEnabledChange,
    effectiveDongleIdleTimeoutSec,
    handleDongleIdleTimeoutChange,
    effectiveDongleScreenOffTimeoutSec,
    handleDongleScreenOffTimeoutChange,
    effectiveDongleSettingsOpen,
    toggleDongleSettings,
    closeDongleSettings,
    handleClearDongle,
    handleClearIdleDongle,
    handleUndoDongle,
    handleUndoIdleDongle,
    effectivePeripheralScreens,
    handlePeripheralScreensChange,
    internalPeripheralSettingsOpen,
  ]);

  const getSideConfig = useCallback((side: string) => {
    if (side === 'left' || side === 'central') {
      return {
        title: 'Central Active',
        idleTitle: 'Central Idle',
        blocks: effectiveLeftBlocks,
        onBlocksChange: handleLeftBlocksChange,
        idleBlocks: effectiveIdleLeftBlocks,
        onIdleBlocksChange: handleIdleLeftBlocksChange,
        dimensions: screenDimensions,
        onDimensionsChange: handleLeftDimensionsChange,
        idleEnabled: effectiveIdleScreensEnabled,
        onIdleEnabledChange: handleLeftIdleEnabledChange,
        idleTimeout: effectiveIdleTimeoutSec,
        onIdleTimeoutChange: handleLeftIdleTimeoutChange,
        screenOffTimeout: effectiveScreenOffTimeoutSec,
        onScreenOffTimeoutChange: handleLeftScreenOffTimeoutChange,
        isOpen: effectiveLeftSettingsOpen,
        toggleSettings: toggleLeftSettings,
        closeSettings: closeLeftSettings,
        onClear: handleClearLeft,
        onClearIdle: handleClearIdleLeft,
        onUndo: handleUndoLeft,
        onUndoIdle: handleUndoIdleLeft,
      };
    }
    return getPeripheralConfig(side);
  }, [
    effectiveLeftBlocks,
    handleLeftBlocksChange,
    effectiveIdleLeftBlocks,
    handleIdleLeftBlocksChange,
    screenDimensions,
    handleLeftDimensionsChange,
    effectiveIdleScreensEnabled,
    handleLeftIdleEnabledChange,
    effectiveIdleTimeoutSec,
    handleLeftIdleTimeoutChange,
    effectiveScreenOffTimeoutSec,
    handleLeftScreenOffTimeoutChange,
    effectiveLeftSettingsOpen,
    toggleLeftSettings,
    closeLeftSettings,
    handleClearLeft,
    handleClearIdleLeft,
    handleUndoLeft,
    handleUndoIdleLeft,
    getPeripheralConfig,
  ]);

  // Drag-and-drop state from center widget catalog to OLED panels
  const [dragState, setDragState] = useState<DragWidgetState | null>(null);

  // Warning modal when master widget is placed on peripheral side
  const [warningModalState, setWarningModalState] = useState<{
    isOpen: boolean;
    widgetName: string;
    blockId: string;
    side: 'left' | 'right' | 'dongle' | string;
    targetMode: 'active' | 'idle';
  } | null>(null);

  const checkPeripheralMasterWarning = useCallback(
    (widget: DisplayWidgetDefinition, side: 'left' | 'right' | 'dongle' | string, blockId: string, targetMode: 'active' | 'idle') => {
      // In our dynamic layout architecture:
      // Left display is always Master. Any display on the right (right, dongle, peripheral-3...) is Peripheral.
      const isPeripheral = side !== 'left';

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
    (widget: DisplayWidgetDefinition, side: 'left' | 'right' | 'dongle' | string) => {
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
      if (side !== 'left') {
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

      const candidateSides = ['left', ...effectiveEnabledScreens.filter(s => s !== 'left')];
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
        if (side !== 'left') {
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
      side="left"
      isOpen={effectiveLeftSettingsOpen}
      onClose={closeLeftSettings}
      isOverlay={isOverlay}
      screenDimensions={screenDimensions}
      onScreenDimensionsChange={handleLeftDimensionsChange}
      idleScreensEnabled={effectiveIdleScreensEnabled}
      onIdleScreensEnabledChange={handleLeftIdleEnabledChange}
      idleTimeoutSec={effectiveIdleTimeoutSec}
      onIdleTimeoutSecChange={handleLeftIdleTimeoutChange}
      screenOffTimeoutSec={effectiveScreenOffTimeoutSec}
      onScreenOffTimeoutSecChange={handleLeftScreenOffTimeoutChange}
      symmetricSettings={effectiveSymmetricSettings}
      onSymmetricSettingsChange={handleSymmetricChange}
      rightScreenDimensions={effectiveRightScreenDimensions}
      onRightScreenDimensionsChange={handleRightScreenDimensionsChange}
      rightIdleScreensEnabled={effectiveRightIdleScreensEnabled}
      onRightIdleScreensEnabledChange={handleRightIdleScreensEnabledChange}
      rightIdleTimeoutSec={effectiveRightIdleTimeoutSec}
      onRightIdleTimeoutSecChange={handleRightIdleTimeoutSecChange}
      rightScreenOffTimeoutSec={effectiveRightScreenOffTimeoutSec}
      onRightScreenOffTimeoutSecChange={handleRightScreenOffTimeoutSecChange}
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

  const leftMode = getScreenMode('left');
  const leftColumnNode = (
    <React.Fragment key="master-display">
      {!isOverlaySettings && masterSettingsPanel(false)}
      <div className={`blocks-column-oled ${!effectiveIdleScreensEnabled ? 'idle-disabled' : leftMode === 'active' ? 'active-expanded' : 'idle-expanded'}`}>
        <OledPanelColumn
          side="left"
          screenKind="active"
          title="Central Active"
          subtitle="Central Host Coordinator Display"
          blocks={effectiveLeftBlocks}
          onBlocksChange={handleLeftBlocksChange}
          onClearScreen={handleClearLeft}
          onUndo={handleUndoLeft}
          onToggleSettings={toggleLeftSettings}
          isSettingsOpen={effectiveLeftSettingsOpen}
          symbolsGrid={symbolsGrid}
          symbolSlices={symbolSlices}
          fontGrid={fontGrid}
          fontGlyphs={fontGlyphs}
          fontMappings={fontMappings}
          customText={customText}
          instances={instances}
          isDropTarget={dragState?.targetSide === 'left' && (leftMode === 'active' || !effectiveIdleScreensEnabled)}
          dropTargetX={dragState?.targetSide === 'left' ? dragState.targetX : null}
          dropTargetY={dragState?.targetSide === 'left' ? dragState.targetY : null}
          draggedWidget={dragState?.widget || null}
          selectedBlockId={selectedBlockSide === 'left' && selectedBlockKind === 'active' ? selectedBlockId : null}
          onSelectBlock={id => {
            setSelectedBlockSide(id ? 'left' : null);
            setSelectedBlockKind('active');
            setSelectedBlockId(id);
          }}
          onRegisterScreenElement={handleRegisterScreenElement}
          screenDimensions={screenDimensions}
          layerNames={layerNames}
          isCompact={effectiveIdleScreensEnabled && leftMode === 'idle'}
          onExpand={() => setScreenMode('left', 'active')}
          onSwitchMode={effectiveIdleScreensEnabled ? () => setScreenMode('left', 'idle') : undefined}
        />

        {effectiveIdleScreensEnabled && (
          <OledPanelColumn
            side="left"
            screenKind="idle"
            title="Central Idle"
            subtitle="Central Host Coordinator Display"
            blocks={effectiveIdleLeftBlocks}
            onBlocksChange={handleIdleLeftBlocksChange}
            onClearScreen={handleClearIdleLeft}
            onUndo={handleUndoIdleLeft}
            onToggleSettings={toggleLeftSettings}
            isSettingsOpen={effectiveLeftSettingsOpen}
            symbolsGrid={symbolsGrid}
            symbolSlices={symbolSlices}
            fontGrid={fontGrid}
            fontGlyphs={fontGlyphs}
            fontMappings={fontMappings}
            customText={customText}
            instances={instances}
            isDropTarget={dragState?.targetSide === 'left' && leftMode === 'idle'}
            dropTargetX={dragState?.targetSide === 'left' ? dragState.targetX : null}
            dropTargetY={dragState?.targetSide === 'left' ? dragState.targetY : null}
            draggedWidget={dragState?.widget || null}
            selectedBlockId={selectedBlockSide === 'left' && selectedBlockKind === 'idle' ? selectedBlockId : null}
            onSelectBlock={id => {
              setSelectedBlockSide(id ? 'left' : null);
              setSelectedBlockKind('idle');
              setSelectedBlockId(id);
            }}
            onRegisterScreenElement={handleRegisterScreenElement}
            screenDimensions={screenDimensions}
            layerNames={layerNames}
            isCompact={leftMode === 'active'}
            onExpand={() => setScreenMode('left', 'idle')}
            onSwitchMode={() => setScreenMode('left', 'active')}
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
        {leftColumnNode}

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

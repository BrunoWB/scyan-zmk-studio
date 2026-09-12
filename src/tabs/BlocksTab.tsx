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

export interface BlocksTabProps {
  leftBlocks?: LayoutBlock[];
  rightBlocks?: LayoutBlock[];
  dongleBlocks?: LayoutBlock[];
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
  screenSetup?: 'split' | 'split-dongle' | 'dongle-only' | 'custom';
  onScreenSetupChange?: (setup: 'split' | 'split-dongle' | 'dongle-only' | 'custom') => void;
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
  screenSetup,
  onScreenSetupChange,
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

  // Screen setup & enabled screens state
  const [localEnabledScreens, setLocalEnabledScreens] = useState<string[]>(['left', 'right']);
  const effectiveEnabledScreens = enabledScreens ?? localEnabledScreens;
  const handleEnabledScreensChange = onEnabledScreensChange || setLocalEnabledScreens;

  const [localScreenSetup, setLocalScreenSetup] = useState<'split' | 'split-dongle' | 'dongle-only' | 'custom'>('split');
  const effectiveScreenSetup = screenSetup ?? localScreenSetup;
  const handleScreenSetupChange = onScreenSetupChange || setLocalScreenSetup;

  const isLeftEnabled = effectiveEnabledScreens.includes('left');
  const isRightEnabled = effectiveEnabledScreens.includes('right');
  const isDongleEnabled = effectiveEnabledScreens.includes('dongle');

  // Multi-screen view mode for Blocks tab when 3 screens exist: 'all' | 'left' | 'dongle' | 'right'
  const [activeScreenView, setActiveScreenView] = useState<'all' | 'left' | 'dongle' | 'right'>('all');

  // Screen focus mode: 'active' or 'idle'
  const [focusedScreenMode, setFocusedScreenMode] = useState<'active' | 'idle'>('active');

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

  const [localRightIdleScreensEnabled, setLocalRightIdleScreensEnabled] = useState(true);
  const effectiveRightIdleScreensEnabled = effectiveSymmetricSettings
    ? effectiveIdleScreensEnabled
    : (rightIdleScreensEnabled !== undefined ? rightIdleScreensEnabled : localRightIdleScreensEnabled);
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
    handleIdleScreensEnabledChange(enabled);
    if (effectiveSymmetricSettings) {
      handleRightIdleScreensEnabledChange(enabled);
    }
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
      handleRightIdleScreensEnabledChange(effectiveIdleScreensEnabled);
      handleRightIdleTimeoutSecChange(effectiveIdleTimeoutSec);
      handleRightScreenOffTimeoutSecChange(effectiveScreenOffTimeoutSec);
    }
  };

  // Topology preset helpers
  const handleSelectPreset = (preset: 'split' | 'split-dongle' | 'dongle-only') => {
    handleScreenSetupChange(preset);
    if (preset === 'split') {
      handleEnabledScreensChange(['left', 'right']);
      if (activeScreenView === 'dongle') setActiveScreenView('all');
    } else if (preset === 'split-dongle') {
      handleEnabledScreensChange(['left', 'dongle', 'right']);
    } else if (preset === 'dongle-only') {
      handleEnabledScreensChange(['dongle']);
      setActiveScreenView('all');
    }
  };

  // Reset focus to active if idle screens are disabled on all enabled sides
  useEffect(() => {
    const idleAllowed = (isLeftEnabled && effectiveIdleScreensEnabled) ||
                        (isRightEnabled && effectiveRightIdleScreensEnabled) ||
                        (isDongleEnabled && effectiveDongleIdleScreensEnabled);
    if (!idleAllowed && focusedScreenMode === 'idle') {
      setFocusedScreenMode('active');
    }
  }, [isLeftEnabled, isRightEnabled, isDongleEnabled, effectiveIdleScreensEnabled, effectiveRightIdleScreensEnabled, effectiveDongleIdleScreensEnabled, focusedScreenMode]);

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



  // Selection tracking
  const [selectedLeftBlockId, setSelectedLeftBlockId] = useState<string | null>(
    effectiveLeftBlocks[0]?.id || null
  );
  const [selectedRightBlockId, setSelectedRightBlockId] = useState<string | null>(
    effectiveRightBlocks[0]?.id || null
  );
  const [selectedDongleBlockId, setSelectedDongleBlockId] = useState<string | null>(
    effectiveDongleBlocks[0]?.id || null
  );
  const [selectedIdleLeftBlockId, setSelectedIdleLeftBlockId] = useState<string | null>(null);
  const [selectedIdleRightBlockId, setSelectedIdleRightBlockId] = useState<string | null>(null);
  const [selectedIdleDongleBlockId, setSelectedIdleDongleBlockId] = useState<string | null>(null);

  // Drag-and-drop state from center list to OLED panels
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
      // In ZMK:
      // In dual split ('split'): Left is Central (Master), Right is Peripheral.
      // In split+dongle ('split-dongle'): Dongle is Central (Master), Left AND Right are Peripherals.
      // In dongle-only ('dongle-only'): Dongle is Central (Master).
      const isPeripheral = effectiveScreenSetup === 'split-dongle'
        ? (side === 'left' || side === 'right')
        : (side === 'right');

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
    [effectiveScreenSetup]
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
        if (side === 'left') {
          if (targetMode === 'active') {
            handleLeftBlocksChange(effectiveLeftBlocks.filter(b => b.id !== blockId));
            if (selectedLeftBlockId === blockId) setSelectedLeftBlockId(null);
          } else {
            handleIdleLeftBlocksChange(effectiveIdleLeftBlocks.filter(b => b.id !== blockId));
            if (selectedIdleLeftBlockId === blockId) setSelectedIdleLeftBlockId(null);
          }
        } else if (side === 'dongle') {
          if (targetMode === 'active') {
            handleDongleBlocksChange(effectiveDongleBlocks.filter(b => b.id !== blockId));
            if (selectedDongleBlockId === blockId) setSelectedDongleBlockId(null);
          } else {
            handleIdleDongleBlocksChange(effectiveIdleDongleBlocks.filter(b => b.id !== blockId));
            if (selectedIdleDongleBlockId === blockId) setSelectedIdleDongleBlockId(null);
          }
        } else if (side === 'right') {
          if (targetMode === 'active') {
            handleRightBlocksChange(effectiveRightBlocks.filter(b => b.id !== blockId));
            if (selectedRightBlockId === blockId) setSelectedRightBlockId(null);
          } else {
            handleIdleRightBlocksChange(effectiveIdleRightBlocks.filter(b => b.id !== blockId));
            if (selectedIdleRightBlockId === blockId) setSelectedIdleRightBlockId(null);
          }
        }
      }
      setWarningModalState(null);
    },
    [warningModalState, effectiveLeftBlocks, effectiveIdleLeftBlocks, effectiveDongleBlocks, effectiveIdleDongleBlocks, effectiveRightBlocks, effectiveIdleRightBlocks, selectedLeftBlockId, selectedIdleLeftBlockId, selectedDongleBlockId, selectedIdleDongleBlockId, selectedRightBlockId, selectedIdleRightBlockId, handleLeftBlocksChange, handleIdleLeftBlocksChange, handleDongleBlocksChange, handleIdleDongleBlocksChange, handleRightBlocksChange, handleIdleRightBlocksChange]
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

  const screenW = screenDimensions.width || 32;
  const screenH = screenDimensions.height || 128;

  // Quick add helper (clicks "+ Left", "+ Dongle", or "+ Right" on card)
  const handleQuickAdd = useCallback(
    (widget: DisplayWidgetDefinition, side: 'left' | 'right' | 'dongle' | string) => {
      const sideIdleEnabled = side === 'left'
        ? effectiveIdleScreensEnabled
        : side === 'dongle'
        ? effectiveDongleIdleScreensEnabled
        : effectiveRightIdleScreensEnabled;
      const targetMode = sideIdleEnabled ? focusedScreenMode : 'active';
      const targetList = targetMode === 'active'
        ? (side === 'left' ? effectiveLeftBlocks : side === 'dongle' ? effectiveDongleBlocks : effectiveRightBlocks)
        : (side === 'left' ? effectiveIdleLeftBlocks : side === 'dongle' ? effectiveIdleDongleBlocks : effectiveIdleRightBlocks);

      const targetSideW = side === 'left' ? screenW : side === 'dongle' ? (effectiveDongleScreenDimensions.width || 32) : (effectiveRightScreenDimensions.width || 32);
      const targetSideH = side === 'left' ? screenH : side === 'dongle' ? (effectiveDongleScreenDimensions.height || 128) : (effectiveRightScreenDimensions.height || 128);

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
        if (side === 'left') {
          handleLeftBlocksChange([...targetList, newBlock]);
          setSelectedLeftBlockId(newBlock.id);
          setSelectedDongleBlockId(null);
          setSelectedRightBlockId(null);
          checkPeripheralMasterWarning(widget, side, newBlock.id, targetMode);
        } else if (side === 'dongle') {
          handleDongleBlocksChange([...targetList, newBlock]);
          setSelectedDongleBlockId(newBlock.id);
          setSelectedLeftBlockId(null);
          setSelectedRightBlockId(null);
        } else {
          handleRightBlocksChange([...targetList, newBlock]);
          setSelectedRightBlockId(newBlock.id);
          setSelectedLeftBlockId(null);
          setSelectedDongleBlockId(null);
          checkPeripheralMasterWarning(widget, side, newBlock.id, targetMode);
        }
      } else {
        if (side === 'left') {
          handleIdleLeftBlocksChange([...targetList, newBlock]);
          setSelectedIdleLeftBlockId(newBlock.id);
          setSelectedIdleDongleBlockId(null);
          setSelectedIdleRightBlockId(null);
          checkPeripheralMasterWarning(widget, side, newBlock.id, targetMode);
        } else if (side === 'dongle') {
          handleIdleDongleBlocksChange([...targetList, newBlock]);
          setSelectedIdleDongleBlockId(newBlock.id);
          setSelectedIdleLeftBlockId(null);
          setSelectedIdleRightBlockId(null);
        } else {
          handleIdleRightBlocksChange([...targetList, newBlock]);
          setSelectedIdleRightBlockId(newBlock.id);
          setSelectedIdleLeftBlockId(null);
          setSelectedIdleDongleBlockId(null);
          checkPeripheralMasterWarning(widget, side, newBlock.id, targetMode);
        }
      }
    },
    [focusedScreenMode, effectiveIdleScreensEnabled, effectiveRightIdleScreensEnabled, effectiveDongleIdleScreensEnabled, effectiveLeftBlocks, effectiveRightBlocks, effectiveDongleBlocks, effectiveIdleLeftBlocks, effectiveIdleRightBlocks, effectiveIdleDongleBlocks, symbolSlices, instances, screenW, screenH, effectiveRightScreenDimensions, effectiveDongleScreenDimensions, checkPeripheralMasterWarning]
  );

  // Window listeners during active ghost drag
  const isDragging = dragState !== null;
  useEffect(() => {
    if (!isDragging) return;

    const handlePointerMove = (e: PointerEvent) => {
      const clientX = e.clientX;
      const clientY = e.clientY;

      let targetSide: 'left' | 'right' | 'dongle' | null = null;
      let targetX: number | null = null;
      let targetY: number | null = null;

      const currentWidget = dragStateRef.current?.widget;
      if (!currentWidget) return;

      const patchedWidget = currentWidget as DisplayWidgetDefinition & { instanceId?: string };
      const activeInstance = resolveWidgetInstance(instances, currentWidget.id, patchedWidget.instanceId);
      const naturalSize = getWidgetNaturalSize(currentWidget, symbolSlices, activeInstance, fontGlyphs, fontMappings);

      // Hit-test targeting the active/focused screens
      const leftTargetSuffix = effectiveIdleScreensEnabled ? focusedScreenMode : 'active';
      const dongleTargetSuffix = effectiveDongleIdleScreensEnabled ? focusedScreenMode : 'active';
      const rightTargetSuffix = effectiveRightIdleScreensEnabled ? focusedScreenMode : 'active';
      const leftEl = screenElementsRef.current[`left-${leftTargetSuffix}`];
      const dongleEl = screenElementsRef.current[`dongle-${dongleTargetSuffix}`];
      const rightEl = screenElementsRef.current[`right-${rightTargetSuffix}`];

      if (leftEl) {
        const rect = leftEl.getBoundingClientRect();
        if (
          clientX >= rect.left - 40 &&
          clientX <= rect.right + 40 &&
          clientY >= rect.top - 20 &&
          clientY <= rect.bottom + 20
        ) {
          targetSide = 'left';
          const relX = Math.round(
            ((clientX - rect.left) / rect.width) * screenW - naturalSize.width / 2
          );
          const relY = Math.round(
            ((clientY - rect.top) / rect.height) * screenH - naturalSize.height / 2
          );
          targetX = Math.max(0, Math.min(screenW - naturalSize.width, relX));
          targetY = Math.max(0, Math.min(screenH - naturalSize.height, relY));
        }
      }

      if (!targetSide && dongleEl) {
        const rect = dongleEl.getBoundingClientRect();
        if (
          clientX >= rect.left - 40 &&
          clientX <= rect.right + 40 &&
          clientY >= rect.top - 20 &&
          clientY <= rect.bottom + 20
        ) {
          targetSide = 'dongle';
          const dongleW = effectiveDongleScreenDimensions.width || 32;
          const dongleH = effectiveDongleScreenDimensions.height || 128;
          const relX = Math.round(
            ((clientX - rect.left) / rect.width) * dongleW - naturalSize.width / 2
          );
          const relY = Math.round(
            ((clientY - rect.top) / rect.height) * dongleH - naturalSize.height / 2
          );
          targetX = Math.max(0, Math.min(dongleW - naturalSize.width, relX));
          targetY = Math.max(0, Math.min(dongleH - naturalSize.height, relY));
        }
      }

      if (!targetSide && rightEl) {
        const rect = rightEl.getBoundingClientRect();
        if (
          clientX >= rect.left - 40 &&
          clientX <= rect.right + 40 &&
          clientY >= rect.top - 20 &&
          clientY <= rect.bottom + 20
        ) {
          targetSide = 'right';
          const rightW = effectiveRightScreenDimensions.width || 32;
          const rightH = effectiveRightScreenDimensions.height || 128;
          const relX = Math.round(
            ((clientX - rect.left) / rect.width) * rightW - naturalSize.width / 2
          );
          const relY = Math.round(
            ((clientY - rect.top) / rect.height) * rightH - naturalSize.height / 2
          );
          targetX = Math.max(0, Math.min(rightW - naturalSize.width, relX));
          targetY = Math.max(0, Math.min(rightH - naturalSize.height, relY));
        }
      }

      const updatedState: DragWidgetState = {
        widget: currentWidget,
        clientX,
        clientY,
        targetSide,
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

        const sideIdleEnabled = side === 'left'
          ? effectiveIdleScreensEnabled
          : side === 'dongle'
          ? effectiveDongleIdleScreensEnabled
          : effectiveRightIdleScreensEnabled;
        const targetMode = sideIdleEnabled ? focusedScreenMode : 'active';
        trackEvent('widget_added', {
          widget_type: active.widget.id,
          side,
          mode: targetMode,
        });
        if (targetMode === 'active') {
          if (side === 'left') {
            handleLeftBlocksChange([...effectiveLeftBlocks, newBlock]);
            setSelectedLeftBlockId(newBlock.id);
            setSelectedDongleBlockId(null);
            setSelectedRightBlockId(null);
            checkPeripheralMasterWarning(active.widget, side, newBlock.id, targetMode);
          } else if (side === 'dongle') {
            handleDongleBlocksChange([...effectiveDongleBlocks, newBlock]);
            setSelectedDongleBlockId(newBlock.id);
            setSelectedLeftBlockId(null);
            setSelectedRightBlockId(null);
          } else {
            handleRightBlocksChange([...effectiveRightBlocks, newBlock]);
            setSelectedRightBlockId(newBlock.id);
            setSelectedLeftBlockId(null);
            setSelectedDongleBlockId(null);
            checkPeripheralMasterWarning(active.widget, side, newBlock.id, targetMode);
          }
        } else {
          if (side === 'left') {
            handleIdleLeftBlocksChange([...effectiveIdleLeftBlocks, newBlock]);
            setSelectedIdleLeftBlockId(newBlock.id);
            setSelectedIdleDongleBlockId(null);
            setSelectedIdleRightBlockId(null);
            checkPeripheralMasterWarning(active.widget, side, newBlock.id, targetMode);
          } else if (side === 'dongle') {
            handleIdleDongleBlocksChange([...effectiveIdleDongleBlocks, newBlock]);
            setSelectedIdleDongleBlockId(newBlock.id);
            setSelectedIdleLeftBlockId(null);
            setSelectedIdleRightBlockId(null);
          } else {
            handleIdleRightBlocksChange([...effectiveIdleRightBlocks, newBlock]);
            setSelectedIdleRightBlockId(newBlock.id);
            setSelectedIdleLeftBlockId(null);
            setSelectedIdleDongleBlockId(null);
            checkPeripheralMasterWarning(active.widget, side, newBlock.id, targetMode);
          }
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
    focusedScreenMode,
    effectiveIdleScreensEnabled,
    effectiveRightIdleScreensEnabled,
    effectiveDongleIdleScreensEnabled,
    effectiveLeftBlocks,
    effectiveRightBlocks,
    effectiveDongleBlocks,
    effectiveIdleLeftBlocks,
    effectiveIdleRightBlocks,
    effectiveIdleDongleBlocks,
    symbolSlices,
    instances,
    screenW,
    screenH,
    effectiveRightScreenDimensions,
    effectiveDongleScreenDimensions,
    checkPeripheralMasterWarning,
    handleLeftBlocksChange,
    handleRightBlocksChange,
    handleDongleBlocksChange,
    handleIdleLeftBlocksChange,
    handleIdleRightBlocksChange,
    handleIdleDongleBlocksChange,
  ]);

  // Active Screen Action Handlers
  const handleClearLeft = () => {
    handleLeftBlocksChange([]);
    setSelectedLeftBlockId(null);
  };

  const handleClearDongle = () => {
    handleDongleBlocksChange([]);
    setSelectedDongleBlockId(null);
  };

  const handleClearRight = () => {
    handleRightBlocksChange([]);
    setSelectedRightBlockId(null);
  };

  // Idle Screen Action Handlers
  const handleClearIdleLeft = () => {
    handleIdleLeftBlocksChange([]);
    setSelectedIdleLeftBlockId(null);
  };

  const handleClearIdleDongle = () => {
    handleIdleDongleBlocksChange([]);
    setSelectedIdleDongleBlockId(null);
  };

  const handleClearIdleRight = () => {
    handleIdleRightBlocksChange([]);
    setSelectedIdleRightBlockId(null);
  };

  const showLeft = isLeftEnabled && (activeScreenView === 'all' || activeScreenView === 'left');
  const showDongle = isDongleEnabled && (activeScreenView === 'all' || activeScreenView === 'dongle');
  const showRight = isRightEnabled && (activeScreenView === 'all' || activeScreenView === 'right');

  const isLeftMaster = effectiveScreenSetup === 'split';

  const leftColumnNode = showLeft && (
    <>
      <SideSettingsPanel
        side="left"
        isOpen={effectiveLeftSettingsOpen}
        onClose={closeLeftSettings}
        screenDimensions={screenDimensions}
        onScreenDimensionsChange={handleLeftDimensionsChange}
        idleScreensEnabled={effectiveIdleScreensEnabled}
        onIdleScreensEnabledChange={handleLeftIdleEnabledChange}
        idleTimeoutSec={effectiveIdleTimeoutSec}
        onIdleTimeoutSecChange={handleLeftIdleTimeoutChange}
        screenOffTimeoutSec={effectiveScreenOffTimeoutSec}
        onScreenOffTimeoutSecChange={handleLeftScreenOffTimeoutChange}
        symmetricSettings={effectiveSymmetricSettings}
        onRightScreenDimensionsChange={handleRightScreenDimensionsChange}
        onRightIdleScreensEnabledChange={handleRightIdleScreensEnabledChange}
        rightIdleTimeoutSec={effectiveRightIdleTimeoutSec}
        onRightIdleTimeoutSecChange={handleRightIdleTimeoutSecChange}
        rightScreenOffTimeoutSec={effectiveRightScreenOffTimeoutSec}
        onRightScreenOffTimeoutSecChange={handleRightScreenOffTimeoutSecChange}
      />
      <div className={`blocks-column-oled ${!effectiveIdleScreensEnabled ? 'idle-disabled' : focusedScreenMode === 'active' ? 'active-expanded' : 'idle-expanded'}`}>
        <OledPanelColumn
          side="left"
          screenKind="active"
          title={isLeftMaster ? 'Left Active (Master)' : 'Left Active (Peripheral)'}
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
          isDropTarget={dragState?.targetSide === 'left' && (focusedScreenMode === 'active' || !effectiveIdleScreensEnabled)}
          dropTargetX={dragState?.targetSide === 'left' ? dragState.targetX : null}
          dropTargetY={dragState?.targetSide === 'left' ? dragState.targetY : null}
          draggedWidget={dragState?.widget || null}
          selectedBlockId={selectedLeftBlockId}
          onSelectBlock={id => {
            setSelectedLeftBlockId(id);
            if (id) {
              setSelectedDongleBlockId(null);
              setSelectedRightBlockId(null);
              setSelectedIdleLeftBlockId(null);
              setSelectedIdleDongleBlockId(null);
              setSelectedIdleRightBlockId(null);
            }
          }}
          onRegisterScreenElement={handleRegisterScreenElement}
          screenDimensions={screenDimensions}
          layerNames={layerNames}
          isCompact={effectiveIdleScreensEnabled && focusedScreenMode === 'idle'}
          onExpand={() => setFocusedScreenMode('active')}
        />

        {effectiveIdleScreensEnabled && (
          <OledPanelColumn
            side="left"
            screenKind="idle"
            title={isLeftMaster ? 'Left Idle (Master)' : 'Left Idle (Peripheral)'}
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
            isDropTarget={dragState?.targetSide === 'left' && focusedScreenMode === 'idle'}
            dropTargetX={dragState?.targetSide === 'left' ? dragState.targetX : null}
            dropTargetY={dragState?.targetSide === 'left' ? dragState.targetY : null}
            draggedWidget={dragState?.widget || null}
            selectedBlockId={selectedIdleLeftBlockId}
            onSelectBlock={id => {
              setSelectedIdleLeftBlockId(id);
              if (id) {
                setSelectedLeftBlockId(null);
                setSelectedDongleBlockId(null);
                setSelectedRightBlockId(null);
                setSelectedIdleDongleBlockId(null);
                setSelectedIdleRightBlockId(null);
              }
            }}
            onRegisterScreenElement={handleRegisterScreenElement}
            screenDimensions={screenDimensions}
            layerNames={layerNames}
            isCompact={focusedScreenMode === 'active'}
            onExpand={() => setFocusedScreenMode('idle')}
          />
        )}
      </div>
    </>
  );

  const dongleColumnNode = showDongle && (
    <>
      <SideSettingsPanel
        side="dongle"
        isOpen={effectiveDongleSettingsOpen}
        onClose={closeDongleSettings}
        screenDimensions={effectiveDongleScreenDimensions}
        onScreenDimensionsChange={handleDongleDimensionsChange}
        idleScreensEnabled={effectiveDongleIdleScreensEnabled}
        onIdleScreensEnabledChange={handleDongleIdleEnabledChange}
        idleTimeoutSec={effectiveDongleIdleTimeoutSec}
        onIdleTimeoutSecChange={handleDongleIdleTimeoutChange}
        screenOffTimeoutSec={effectiveDongleScreenOffTimeoutSec}
        onScreenOffTimeoutSecChange={handleDongleScreenOffTimeoutChange}
      />
      <div className={`blocks-column-oled ${!effectiveDongleIdleScreensEnabled ? 'idle-disabled' : focusedScreenMode === 'active' ? 'active-expanded' : 'idle-expanded'}`}>
        <OledPanelColumn
          side="dongle"
          screenKind="active"
          title="Dongle Master Active"
          blocks={effectiveDongleBlocks}
          onBlocksChange={handleDongleBlocksChange}
          onClearScreen={handleClearDongle}
          onUndo={handleUndoDongle}
          onToggleSettings={toggleDongleSettings}
          isSettingsOpen={effectiveDongleSettingsOpen}
          symbolsGrid={symbolsGrid}
          symbolSlices={symbolSlices}
          fontGrid={fontGrid}
          fontGlyphs={fontGlyphs}
          fontMappings={fontMappings}
          customText={customText}
          instances={instances}
          isDropTarget={dragState?.targetSide === 'dongle' && (focusedScreenMode === 'active' || !effectiveDongleIdleScreensEnabled)}
          dropTargetX={dragState?.targetSide === 'dongle' ? dragState.targetX : null}
          dropTargetY={dragState?.targetSide === 'dongle' ? dragState.targetY : null}
          draggedWidget={dragState?.widget || null}
          selectedBlockId={selectedDongleBlockId}
          onSelectBlock={id => {
            setSelectedDongleBlockId(id);
            if (id) {
              setSelectedLeftBlockId(null);
              setSelectedRightBlockId(null);
              setSelectedIdleLeftBlockId(null);
              setSelectedIdleDongleBlockId(null);
              setSelectedIdleRightBlockId(null);
            }
          }}
          onRegisterScreenElement={handleRegisterScreenElement}
          screenDimensions={effectiveDongleScreenDimensions}
          layerNames={layerNames}
          isCompact={effectiveDongleIdleScreensEnabled && focusedScreenMode === 'idle'}
          onExpand={() => setFocusedScreenMode('active')}
        />

        {effectiveDongleIdleScreensEnabled && (
          <OledPanelColumn
            side="dongle"
            screenKind="idle"
            title="Dongle Master Idle"
            blocks={effectiveIdleDongleBlocks}
            onBlocksChange={handleIdleDongleBlocksChange}
            onClearScreen={handleClearIdleDongle}
            onUndo={handleUndoIdleDongle}
            onToggleSettings={toggleDongleSettings}
            isSettingsOpen={effectiveDongleSettingsOpen}
            symbolsGrid={symbolsGrid}
            symbolSlices={symbolSlices}
            fontGrid={fontGrid}
            fontGlyphs={fontGlyphs}
            fontMappings={fontMappings}
            customText={customText}
            instances={instances}
            isDropTarget={dragState?.targetSide === 'dongle' && focusedScreenMode === 'idle'}
            dropTargetX={dragState?.targetSide === 'dongle' ? dragState.targetX : null}
            dropTargetY={dragState?.targetSide === 'dongle' ? dragState.targetY : null}
            draggedWidget={dragState?.widget || null}
            selectedBlockId={selectedIdleDongleBlockId}
            onSelectBlock={id => {
              setSelectedIdleDongleBlockId(id);
              if (id) {
                setSelectedLeftBlockId(null);
                setSelectedRightBlockId(null);
                setSelectedDongleBlockId(null);
                setSelectedIdleLeftBlockId(null);
                setSelectedIdleRightBlockId(null);
              }
            }}
            onRegisterScreenElement={handleRegisterScreenElement}
            screenDimensions={effectiveDongleScreenDimensions}
            layerNames={layerNames}
            isCompact={focusedScreenMode === 'active'}
            onExpand={() => setFocusedScreenMode('idle')}
          />
        )}
      </div>
    </>
  );

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

  const rightColumnNode = showRight && (
    <>
      <div className={`blocks-column-oled ${!effectiveRightIdleScreensEnabled ? 'idle-disabled' : focusedScreenMode === 'active' ? 'active-expanded' : 'idle-expanded'}`}>
        <OledPanelColumn
          side="right"
          screenKind="active"
          title="Right Active (Peripheral)"
          blocks={effectiveRightBlocks}
          onBlocksChange={handleRightBlocksChange}
          onClearScreen={handleClearRight}
          onUndo={handleUndoRight}
          onToggleSettings={toggleRightSettings}
          isSettingsOpen={effectiveRightSettingsOpen}
          symbolsGrid={symbolsGrid}
          symbolSlices={symbolSlices}
          fontGrid={fontGrid}
          fontGlyphs={fontGlyphs}
          fontMappings={fontMappings}
          customText={customText}
          instances={instances}
          isDropTarget={dragState?.targetSide === 'right' && (focusedScreenMode === 'active' || !effectiveRightIdleScreensEnabled)}
          dropTargetX={dragState?.targetSide === 'right' ? dragState.targetX : null}
          dropTargetY={dragState?.targetSide === 'right' ? dragState.targetY : null}
          draggedWidget={dragState?.widget || null}
          selectedBlockId={selectedRightBlockId}
          onSelectBlock={id => {
            setSelectedRightBlockId(id);
            if (id) {
              setSelectedLeftBlockId(null);
              setSelectedDongleBlockId(null);
              setSelectedIdleLeftBlockId(null);
              setSelectedIdleDongleBlockId(null);
              setSelectedIdleRightBlockId(null);
            }
          }}
          onRegisterScreenElement={handleRegisterScreenElement}
          screenDimensions={effectiveRightScreenDimensions}
          layerNames={layerNames}
          isCompact={effectiveRightIdleScreensEnabled && focusedScreenMode === 'idle'}
          onExpand={() => setFocusedScreenMode('active')}
        />

        {effectiveRightIdleScreensEnabled && (
          <OledPanelColumn
            side="right"
            screenKind="idle"
            title="Right Idle (Peripheral)"
            blocks={effectiveIdleRightBlocks}
            onBlocksChange={handleIdleRightBlocksChange}
            onClearScreen={handleClearIdleRight}
            onUndo={handleUndoIdleRight}
            onToggleSettings={toggleRightSettings}
            isSettingsOpen={effectiveRightSettingsOpen}
            symbolsGrid={symbolsGrid}
            symbolSlices={symbolSlices}
            fontGrid={fontGrid}
            fontGlyphs={fontGlyphs}
            fontMappings={fontMappings}
            customText={customText}
            instances={instances}
            isDropTarget={dragState?.targetSide === 'right' && focusedScreenMode === 'idle'}
            dropTargetX={dragState?.targetSide === 'right' ? dragState.targetX : null}
            dropTargetY={dragState?.targetSide === 'right' ? dragState.targetY : null}
            draggedWidget={dragState?.widget || null}
            selectedBlockId={selectedIdleRightBlockId}
            onSelectBlock={id => {
              setSelectedIdleRightBlockId(id);
              if (id) {
                setSelectedLeftBlockId(null);
                setSelectedDongleBlockId(null);
                setSelectedRightBlockId(null);
                setSelectedIdleLeftBlockId(null);
                setSelectedIdleDongleBlockId(null);
              }
            }}
            onRegisterScreenElement={handleRegisterScreenElement}
            screenDimensions={effectiveRightScreenDimensions}
            layerNames={layerNames}
            isCompact={focusedScreenMode === 'active'}
            onExpand={() => setFocusedScreenMode('idle')}
          />
        )}
      </div>

      <SideSettingsPanel
        side="right"
        isOpen={effectiveRightSettingsOpen}
        onClose={closeRightSettings}
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
      />
    </>
  );

  return (
    <div className="blocks-tab-wrapper">
      {/* SCREEN TOPOLOGY & VIEW SELECTOR BAR */}
      <div className="blocks-screen-topology-bar">
        <div className="topology-section">
          <span>Topology:</span>
          <div className="topology-pills-group">
            <button
              type="button"
              className={`topology-pill-btn ${effectiveScreenSetup === 'split' ? 'active' : ''}`}
              onClick={() => handleSelectPreset('split')}
              title="Dual Split: Left (Master) and Right (Peripheral)"
            >
              Dual Split (L + R)
            </button>
            <button
              type="button"
              className={`topology-pill-btn ${effectiveScreenSetup === 'split-dongle' ? 'active amber' : ''}`}
              onClick={() => handleSelectPreset('split-dongle')}
              title="Split + Dongle: Central Dongle Master + Dual Peripherals (3 Screens)"
            >
              Split + Dongle Master (3 Screens)
            </button>
            <button
              type="button"
              className={`topology-pill-btn ${effectiveScreenSetup === 'dongle-only' ? 'active amber' : ''}`}
              onClick={() => handleSelectPreset('dongle-only')}
              title="Dongle Master Only: Single Central Dongle Screen"
            >
              Dongle Master Only (1 Screen)
            </button>
          </div>
        </div>

        {effectiveEnabledScreens.length > 1 && (
          <div className="topology-section">
            <span>View:</span>
            <div className="topology-pills-group">
              <button
                type="button"
                className={`topology-pill-btn ${activeScreenView === 'all' ? 'active' : ''}`}
                onClick={() => setActiveScreenView('all')}
              >
                All Screens
              </button>
              {isLeftEnabled && (
                <button
                  type="button"
                  className={`topology-pill-btn ${activeScreenView === 'left' ? 'active' : ''}`}
                  onClick={() => setActiveScreenView('left')}
                >
                  Left
                </button>
              )}
              {isDongleEnabled && (
                <button
                  type="button"
                  className={`topology-pill-btn ${activeScreenView === 'dongle' ? 'active amber' : ''}`}
                  onClick={() => setActiveScreenView('dongle')}
                >
                  Dongle Master
                </button>
              )}
              {isRightEnabled && (
                <button
                  type="button"
                  className={`topology-pill-btn ${activeScreenView === 'right' ? 'active' : ''}`}
                  onClick={() => setActiveScreenView('right')}
                >
                  Right
                </button>
              )}
            </div>
          </div>
        )}
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

        {/* Dynamic Multi-Screen & Catalog Placement */}
        {effectiveScreenSetup === 'split-dongle' && activeScreenView === 'all' ? (
          <>
            {catalogColumnNode}
            {leftColumnNode}
            {dongleColumnNode}
            {rightColumnNode}
          </>
        ) : activeScreenView === 'dongle' || effectiveScreenSetup === 'dongle-only' ? (
          <>
            {dongleColumnNode}
            {catalogColumnNode}
          </>
        ) : activeScreenView === 'right' ? (
          <>
            {catalogColumnNode}
            {rightColumnNode}
          </>
        ) : activeScreenView === 'left' ? (
          <>
            {leftColumnNode}
            {catalogColumnNode}
          </>
        ) : (
          <>
            {leftColumnNode}
            {catalogColumnNode}
            {rightColumnNode}
          </>
        )}
      </div>
    </div>
  );
};

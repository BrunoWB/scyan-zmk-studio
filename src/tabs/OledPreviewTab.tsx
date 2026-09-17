import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { BwpxGrid } from '../bwpx/core/BwpxGrid';
import type { SpriteSlice, FontGlyph, LayoutBlock, FontCharMapping } from '../types/zmk';
import {
  Battery,
  Bluetooth,
  Usb,
  Gauge,
  Layers,
  Moon,
  Sun,
  Sliders,
  Shuffle,
  AlertTriangle,
  Monitor,
  Cpu,
} from 'lucide-react';
import type { GitHubRepoConfig, GitHubConnectionState } from '../services/githubService';
import type { PeripheralScreenData } from '../services/cHeaderParser';
import {
  type ParsedKeymapLayout,
  DEFAULT_EMPTY_5X3_LAYOUT,
  fetchRepoKeymap,
  parseZmkKeymap,
  getMatchingKeyCoords,
  formatLayerLabel,
} from '../services/keymapService';
import {
  getNextClickerAction,
  getKeystrokeIntervalMs,
  calculateTypingWpm,
} from '../services/wpmSimulator';
import {
  renderBlocksToGrid,
} from '../services/widgetRegistry';
import {
  DEFAULT_CENTRAL_LAYOUT_BLOCKS,
  DEFAULT_PERIPHERAL_LAYOUT_BLOCKS,
  DEFAULT_IDLE_CENTRAL_BLOCKS,
  DEFAULT_IDLE_PERIPHERAL_BLOCKS,
} from '../types/zmk';
import { getShieldDefinition, getShieldUnitsForShield, type LoadedShieldUnit } from '../data/shieldsData';

function getOledDisplayDimensions(width: number, height: number): { displayW: number; displayH: number } {
  const w = width || 32;
  const h = height || 128;
  const aspect = w / h;

  if (aspect <= 1) {
    // Portrait: anchor height to ~192px (fits the 3-row + thumb Corne profile)
    const displayH = 192;
    const displayW = Math.max(36, Math.min(180, Math.round(displayH * aspect)));
    return { displayW, displayH };
  } else {
    // Landscape: anchor width to ~180px
    const displayW = 180;
    const displayH = Math.max(36, Math.min(192, Math.round(displayW / aspect)));
    return { displayW, displayH };
  }
}

const OLED_BORDER_UNITS = 5;

export interface OledPreviewTabProps {
  symbolsGrid: BwpxGrid;
  symbolSlices: SpriteSlice[];
  fontGrid: BwpxGrid;
  fontGlyphs?: FontGlyph[];
  fontMappings?: FontCharMapping[];
  centralBlocks?: LayoutBlock[];
  peripheralBlocks?: LayoutBlock[];
  idleCentralBlocks?: LayoutBlock[];
  idlePeripheralBlocks?: LayoutBlock[];
  onCentralBlocksChange?: (blocks: LayoutBlock[]) => void;
  onPeripheralBlocksChange?: (blocks: LayoutBlock[]) => void;
  onIdleCentralBlocksChange?: (blocks: LayoutBlock[]) => void;
  onIdlePeripheralBlocksChange?: (blocks: LayoutBlock[]) => void;
  leftBlocks?: LayoutBlock[];
  rightBlocks?: LayoutBlock[];
  layoutBlocks?: LayoutBlock[];
  idleLeftBlocks?: LayoutBlock[];
  idleRightBlocks?: LayoutBlock[];
  onLeftBlocksChange?: (blocks: LayoutBlock[]) => void;
  onRightBlocksChange?: (blocks: LayoutBlock[]) => void;
  onIdleLeftBlocksChange?: (blocks: LayoutBlock[]) => void;
  onIdleRightBlocksChange?: (blocks: LayoutBlock[]) => void;
  screenDimensions?: { width: number; height: number };
  peripheralScreenDimensions?: { width: number; height: number };
  rightScreenDimensions?: { width: number; height: number };
  symmetricSettings?: boolean;
  shieldId?: string;
  onShieldIdChange?: (id: string) => void;
  enabledScreens?: ('central' | 'peripheral' | string)[];
  onEnabledScreensChange?: (screens: ('central' | 'peripheral' | string)[]) => void;
  onSwapDisplays?: (idA: string, idB: string) => void;
  displayAssignments?: Record<string, string | null>;
  onDisplayAssignmentsChange?: (assignments: Record<string, string | null>) => void;
  loadedShields?: LoadedShieldUnit[];
  peripheralScreens?: Record<string, PeripheralScreenData>;
  customText: string;
  onCustomTextChange: (text: string) => void;
  instances?: import('../types/widget').WidgetInstanceMap;
  customizations?: import('../types/widget').WidgetCustomizationMap;
  config?: GitHubRepoConfig;
  connection?: GitHubConnectionState;
  onShowToast?: (type: 'success' | 'error', message: string) => void;
  onOpenSettings?: () => void;
  syncTrigger?: number;
  keymapLayout?: ParsedKeymapLayout;
  onKeymapLayoutChange?: (layout: ParsedKeymapLayout) => void;
}

function normalizeScreenKey(key: string): 'central' | 'peripheral' | string {
  if (key === 'left' || key === 'central') return 'central';
  if (key === 'right' || key === 'peripheral') return 'peripheral';
  return key;
}

export const OledPreviewTab: React.FC<OledPreviewTabProps> = ({
  symbolsGrid,
  symbolSlices,
  fontGrid,
  fontGlyphs = [],
  fontMappings = [],
  centralBlocks,
  peripheralBlocks,
  onCentralBlocksChange: _onCentralBlocksChange,
  onPeripheralBlocksChange: _onPeripheralBlocksChange,
  idleCentralBlocks,
  idlePeripheralBlocks,
  onIdleCentralBlocksChange: _onIdleCentralBlocksChange,
  onIdlePeripheralBlocksChange: _onIdlePeripheralBlocksChange,
  leftBlocks,
  rightBlocks,
  layoutBlocks,
  idleLeftBlocks,
  idleRightBlocks,
  onLeftBlocksChange: _onLeftBlocksChange,
  onRightBlocksChange: _onRightBlocksChange,
  onIdleLeftBlocksChange: _onIdleLeftBlocksChange,
  onIdleRightBlocksChange: _onIdleRightBlocksChange,
  screenDimensions,
  peripheralScreenDimensions,
  rightScreenDimensions,
  symmetricSettings,
  shieldId = 'corne',
  onShieldIdChange: _onShieldIdChange,
  enabledScreens,
  onEnabledScreensChange: _onEnabledScreensChange,
  onSwapDisplays: _onSwapDisplays,
  displayAssignments,
  onDisplayAssignmentsChange,
  loadedShields,
  peripheralScreens,
  customText,
  onCustomTextChange: _onCustomTextChange,
  instances,
  customizations,
  config,
  connection,
  onShowToast,
  onOpenSettings,
  syncTrigger,
  keymapLayout: propKeymapLayout,
  onKeymapLayoutChange,
}) => {
  const activeCentralBlocks = centralBlocks ?? leftBlocks ?? layoutBlocks ?? DEFAULT_CENTRAL_LAYOUT_BLOCKS;
  const activePeripheralBlocks = peripheralBlocks ?? rightBlocks ?? DEFAULT_PERIPHERAL_LAYOUT_BLOCKS;

  const activeShield = useMemo(() => {
    return getShieldDefinition(shieldId);
  }, [shieldId]);

  const effectiveEnabledScreens = useMemo(() => {
    if (enabledScreens && enabledScreens.length > 0) {
      return enabledScreens;
    }
    return ['central', 'peripheral'];
  }, [enabledScreens]);

  const orderedScreens = useMemo<('central' | 'peripheral' | string)[]>(() => {
    const list: ('central' | 'peripheral' | string)[] = [];
    for (const raw of effectiveEnabledScreens) {
      const canonical = normalizeScreenKey(raw);
      if (!list.includes(canonical)) {
        list.push(canonical);
      }
    }
    return list.length > 0 ? list : ['central', 'peripheral'];
  }, [effectiveEnabledScreens]);

  const effectiveShields = useMemo<LoadedShieldUnit[]>(() => {
    if (loadedShields && loadedShields.length > 0) {
      return loadedShields;
    }
    return getShieldUnitsForShield(shieldId);
  }, [loadedShields, shieldId]);

  const [localDisplayAssignments, setLocalDisplayAssignments] = useState<Record<string, string | null>>(() => {
    const init: Record<string, string | null> = {};
    const shields = loadedShields && loadedShields.length > 0 ? loadedShields : getShieldUnitsForShield(shieldId);
    const screens = enabledScreens && enabledScreens.length > 0 ? enabledScreens : ['central', 'peripheral'];
    shields.forEach((shield, idx) => {
      if (idx === 0 && screens.includes('central')) init[shield.id] = 'central';
      else if (idx === 1 && screens.includes('peripheral')) init[shield.id] = 'peripheral';
      else if (idx < screens.length) init[shield.id] = screens[idx];
      else init[shield.id] = null;
    });
    return init;
  });

  const effectiveDisplayAssignments = displayAssignments !== undefined ? displayAssignments : localDisplayAssignments;
  const updateDisplayAssignments = onDisplayAssignmentsChange || setLocalDisplayAssignments;

  // Reconcile with effectiveEnabledScreens: if an assigned display is no longer enabled, treat as null (unassigned)
  const reconciledAssignments = useMemo(() => {
    const res: Record<string, string | null> = {};
    effectiveShields.forEach((sh) => {
      const assigned = effectiveDisplayAssignments[sh.id];
      if (assigned && effectiveEnabledScreens.includes(assigned)) {
        res[sh.id] = assigned;
      } else {
        res[sh.id] = null;
      }
    });
    return res;
  }, [effectiveShields, effectiveDisplayAssignments, effectiveEnabledScreens]);

  const assignedDisplayIds = useMemo(() => {
    return new Set(Object.values(reconciledAssignments).filter(Boolean) as string[]);
  }, [reconciledAssignments]);

  const unattachedDisplayIds = useMemo(() => {
    return orderedScreens.filter((screenId) => !assignedDisplayIds.has(screenId));
  }, [orderedScreens, assignedDisplayIds]);

  const handleAssignDisplay = useCallback((shieldKey: string, newDisplayId: string | null) => {
    const next = { ...reconciledAssignments };
    if (newDisplayId === null) {
      next[shieldKey] = null;
      updateDisplayAssignments(next);
      onShowToast?.('success', 'Detached display from shield');
      return;
    }

    // Check if newDisplayId is already on another shield
    const otherShieldKey = Object.keys(next).find((k) => k !== shieldKey && next[k] === newDisplayId);
    const prevDisplayOnCurrent = next[shieldKey];

    next[shieldKey] = newDisplayId;
    if (otherShieldKey) {
      next[otherShieldKey] = prevDisplayOnCurrent ?? null;
    }
    updateDisplayAssignments(next);
    if (otherShieldKey && prevDisplayOnCurrent) {
      onShowToast?.('success', 'Swapped displays between shields');
    } else {
      onShowToast?.('success', `Assigned ${newDisplayId} to shield`);
    }
  }, [reconciledAssignments, updateDisplayAssignments, onShowToast]);


  // Shields maintain fixed hardware configuration order (dropping a display swaps displays, not shields)
  const orderedShields = effectiveShields;

  // Virtual screen dimensions per side
  const leftVWidth = screenDimensions?.width || 32;
  const leftVHeight = screenDimensions?.height || 128;
  const effectiveSymmetric = symmetricSettings !== undefined ? symmetricSettings : true;
  const rightVWidth = (effectiveSymmetric ? leftVWidth : (peripheralScreenDimensions?.width ?? rightScreenDimensions?.width)) || 32;
  const rightVHeight = (effectiveSymmetric ? leftVHeight : (peripheralScreenDimensions?.height ?? rightScreenDimensions?.height)) || 128;

  // Proportional display dimensions in px for housing and canvas
  const leftDisplayDim = useMemo(() => getOledDisplayDimensions(leftVWidth, leftVHeight), [leftVWidth, leftVHeight]);
  const rightDisplayDim = useMemo(() => getOledDisplayDimensions(rightVWidth, rightVHeight), [rightVWidth, rightVHeight]);

  // Simulator states
  const [isIdle, setIsIdle] = useState<boolean>(false);

  // Active blocks according to idle/active mode
  const leftDisplayBlocks = isIdle
    ? (idleCentralBlocks && idleCentralBlocks.length > 0 ? idleCentralBlocks : (idleLeftBlocks && idleLeftBlocks.length > 0 ? idleLeftBlocks : DEFAULT_IDLE_CENTRAL_BLOCKS))
    : activeCentralBlocks;

  const rightDisplayBlocks = isIdle
    ? (idlePeripheralBlocks && idlePeripheralBlocks.length > 0 ? idlePeripheralBlocks : (idleRightBlocks && idleRightBlocks.length > 0 ? idleRightBlocks : DEFAULT_IDLE_PERIPHERAL_BLOCKS))
    : activePeripheralBlocks;

  // OLED Screen Drag & Drop state (drag screens between shields or to/from unattached drawer)
  const [draggedDisplay, setDraggedDisplay] = useState<{ fromShieldId?: string; displayId: string } | null>(null);
  const [hoveredDisplayDropTarget, setHoveredDisplayDropTarget] = useState<string | null>(null);
  const [hoveredUnattachedDrawer, setHoveredUnattachedDrawer] = useState<boolean>(false);

  const handleDisplayDragStart = useCallback((e: React.DragEvent, fromShieldId: string | undefined, displayId: string) => {
    e.stopPropagation();
    setDraggedDisplay({ fromShieldId, displayId });
    e.dataTransfer.setData(
      'application/json',
      JSON.stringify({
        type: 'preview-oled-display',
        fromShieldId,
        displayId,
      })
    );
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDisplayDragEnd = useCallback(() => {
    setDraggedDisplay(null);
    setHoveredDisplayDropTarget(null);
    setHoveredUnattachedDrawer(false);
  }, []);

  const handleDisplayDragOver = useCallback((e: React.DragEvent, targetShieldId: string) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    if (hoveredDisplayDropTarget !== targetShieldId) {
      setHoveredDisplayDropTarget(targetShieldId);
    }
  }, [hoveredDisplayDropTarget]);

  const handleDisplayDragLeave = useCallback((e: React.DragEvent, shieldId: string) => {
    const related = e.relatedTarget as HTMLElement | null;
    if (related && (e.currentTarget as HTMLElement).contains(related)) {
      return;
    }
    setHoveredDisplayDropTarget((curr) => (curr === shieldId ? null : curr));
  }, []);

  const handleDisplayDrop = useCallback((e: React.DragEvent, targetShieldId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setHoveredDisplayDropTarget(null);

    try {
      let displayId: string = '';
      let fromShieldId: string | undefined = undefined;

      const raw = e.dataTransfer.getData('application/json');
      if (raw) {
        try {
          const data = JSON.parse(raw);
          displayId = data.displayId || data.screenId;
          fromShieldId = data.fromShieldId;
        } catch {}
      }
      if (!displayId && draggedDisplay) {
        displayId = draggedDisplay.displayId;
        fromShieldId = draggedDisplay.fromShieldId;
      }

      setDraggedDisplay(null);

      if (!displayId) return;
      if (fromShieldId === targetShieldId) return;

      const next = { ...reconciledAssignments };
      const currentTargetDisplay = next[targetShieldId] ?? null;

      if (fromShieldId) {
        // Swap or move displays between the two shields
        next[fromShieldId] = currentTargetDisplay;
        next[targetShieldId] = displayId;
        updateDisplayAssignments(next);
        if (currentTargetDisplay && displayId !== currentTargetDisplay) {
          onShowToast?.('success', 'Swapped displays between shields');
        } else {
          onShowToast?.('success', 'Moved display to shield');
        }
      } else {
        // Mount from unattached drawer
        const otherShieldWithDisplay = Object.keys(next).find((k) => next[k] === displayId);
        if (otherShieldWithDisplay) {
          next[otherShieldWithDisplay] = currentTargetDisplay;
        }
        next[targetShieldId] = displayId;
        updateDisplayAssignments(next);
        onShowToast?.('success', `Mounted ${displayId} to shield`);
      }
    } catch (err) {
      console.warn('Display drop error:', err);
    }
  }, [reconciledAssignments, draggedDisplay, updateDisplayAssignments, onShowToast]);

  const handleDropOnUnattachedDrawer = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setHoveredUnattachedDrawer(false);
    setDraggedDisplay(null);

    try {
      const raw = e.dataTransfer.getData('application/json');
      if (!raw) return;
      const data = JSON.parse(raw);
      const fromShieldId: string | undefined = data.fromShieldId || data.shieldKey;
      const displayId: string = data.displayId || data.screenId;

      if (fromShieldId) {
        const next = { ...reconciledAssignments };
        next[fromShieldId] = null;
        updateDisplayAssignments(next);
        onShowToast?.('success', `Detached ${displayId} from shield`);
      }
    } catch (err) {
      console.warn('Drop on unattached drawer error:', err);
    }
  }, [reconciledAssignments, updateDisplayAssignments, onShowToast]);
  const [outputMode, setOutputMode] = useState<'usb' | 'ble'>('usb');
  const [bleProfileIndex, setBleProfileIndex] = useState<number>(1);
  const [battery, setBattery] = useState<number>(88);
  const [currentLayer, setCurrentLayer] = useState<number>(0);
  const [wpm, setWpm] = useState<number>(68);
  const [wpmHistory, setWpmHistory] = useState<number[]>(() => Array(128).fill(0));
  const [splitConnected, setSplitConnected] = useState<boolean>(true);
  const [capsLock, setCapsLock] = useState<boolean>(false);
  const [randomClickerEnabled, setRandomClickerEnabled] = useState<boolean>(true);
  const [clickerSpeed, setClickerSpeed] = useState<number>(0);
  // Configured Bongo Cat tap duration & debounce cooldown (matching firmware CONFIG_SCYAN_BONGO_TAP_MS)
  const activeBongoInstance = instances?.['bongo']?.[0];
  const bongoTapMs = activeBongoInstance?.config?.bongoTapMs ?? 60;
  const bongoDebounceMs = activeBongoInstance?.config?.bongoDebounceMs ?? Math.max(bongoTapMs + 30, 100);

  const bongoTapMsRef = useRef(bongoTapMs);
  bongoTapMsRef.current = bongoTapMs;
  const bongoDebounceMsRef = useRef(bongoDebounceMs);
  bongoDebounceMsRef.current = bongoDebounceMs;

  const [bongoState, setBongoState] = useState<0 | 1 | 2>(0);
  const bongoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTapTimeRef = useRef<number>(0);

  const triggerBongoTap = useCallback((isLeft: boolean) => {
    const now = Date.now();
    // Debounce check: suppress rapid re-triggering within the debounce window
    if (now - lastTapTimeRef.current < bongoDebounceMsRef.current) {
      return;
    }
    lastTapTimeRef.current = now;

    setBongoState(isLeft ? 1 : 2);

    if (bongoTimerRef.current) {
      clearTimeout(bongoTimerRef.current);
    }

    bongoTimerRef.current = setTimeout(() => {
      setBongoState(0);
      bongoTimerRef.current = null;
    }, bongoTapMsRef.current);
  }, []);

  useEffect(() => {
    return () => {
      if (bongoTimerRef.current) {
        clearTimeout(bongoTimerRef.current);
      }
    };
  }, []);

  // Time-progressing WPM history ticker (continuous 1Hz sampling using ref to avoid reset on keypress/decay)
  const wpmRef = useRef(wpm);
  wpmRef.current = wpm;

  useEffect(() => {
    const timer = setInterval(() => {
      setWpmHistory(prev => [...prev.slice(1), wpmRef.current]);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Keymap Layout: dynamic from GitHub, defaults to empty 5x3 blank layout
  const [internalKeymapLayout, setInternalKeymapLayout] = useState<ParsedKeymapLayout>(DEFAULT_EMPTY_5X3_LAYOUT);
  const keymapLayout = propKeymapLayout || internalKeymapLayout;
  const setKeymapLayout = useCallback((layout: ParsedKeymapLayout) => {
    setInternalKeymapLayout(layout);
    onKeymapLayoutChange?.(layout);
  }, [onKeymapLayoutChange]);

  // Currently pressed keycaps set (supports key label or coordinate for empty keys)
  const [pressedKeys, setPressedKeys] = useState<Set<string>>(new Set());

  const leftCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const rightCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const canvasRefs = useRef<Record<string, HTMLCanvasElement | null>>({});
  const keystrokeTimestampsRef = useRef<number[]>([]);
  const hadRecentKeystrokesRef = useRef<boolean>(false);

  // Automatically fetch keymap from GitHub when repository is configured
  useEffect(() => {
    if (config?.owner && config?.repo) {
      let isMounted = true;
      fetchRepoKeymap(config)
        .then(result => {
          if (!isMounted) return;
          if (result && result.content) {
            const parsed = parseZmkKeymap(result.content, result.filename);
            setKeymapLayout(parsed);
            setCurrentLayer(0);
          } else {
            setKeymapLayout(DEFAULT_EMPTY_5X3_LAYOUT);
            setCurrentLayer(0);
          }
        })
        .catch(err => {
          console.warn('Error fetching keymap from repo:', err);
          if (isMounted) {
            setKeymapLayout(DEFAULT_EMPTY_5X3_LAYOUT);
            setCurrentLayer(0);
          }
        });

      return () => {
        isMounted = false;
      };
    } else {
      setKeymapLayout(DEFAULT_EMPTY_5X3_LAYOUT);
      setCurrentLayer(0);
    }
  }, [config?.token, config?.owner, config?.repo, config?.branch, connection?.status]);

  // Re-fetch keymap when syncTrigger changes from outside (e.g. HeaderBar sync)
  const prevSyncTriggerRef = useRef<number | undefined>(syncTrigger);
  useEffect(() => {
    if (
      syncTrigger !== undefined &&
      prevSyncTriggerRef.current !== undefined &&
      syncTrigger > prevSyncTriggerRef.current
    ) {
      handleRefreshKeymap();
    }
    prevSyncTriggerRef.current = syncTrigger;
  }, [syncTrigger]);

  // Manual refresh helper with toasts and clear feedback
  const handleRefreshKeymap = async () => {
    if (!config?.owner || !config?.repo) {
      onOpenSettings?.();
      onShowToast?.('error', 'Please configure your GitHub repository in Settings before syncing.');
      return;
    }

    if (!config?.token && connection?.status !== 'connected') {
      onOpenSettings?.();
      onShowToast?.(
        'error',
        `Repository '${config.owner}/${config.repo}' is private or requires authorization. Please connect your GitHub account in Settings to sync.`
      );
      return;
    }

    try {
      const result = await fetchRepoKeymap(config);
      if (result && result.content) {
        const parsed = parseZmkKeymap(result.content, result.filename);
        setKeymapLayout(parsed);
        setCurrentLayer(0);
        const layerCount = parsed.layers?.length || parsed.layerNames?.length || 1;
        onShowToast?.(
          'success',
          `Synced keymap '${result.filename}' (${parsed.layoutType}, ${layerCount} layers) from ${config.owner}/${config.repo}!`
        );
      } else {
        onShowToast?.(
          'error',
          `Could not find a .keymap file in ${config.owner}/${config.repo}. Checked config/, boards/shields/, keymaps/, and root.`
        );
      }
    } catch (err: any) {
      console.warn('Failed to refresh keymap:', err);
      const msg = err?.message || 'Check repository access and permissions.';
      onShowToast?.('error', `Failed to sync keymap: ${msg}`);
      if (msg.includes('Settings') || msg.includes('token') || msg.includes('private')) {
        onOpenSettings?.();
      }
    }
  };

  // Layer names from parsed keymap
  const layerNames = useMemo(
    () =>
      keymapLayout.layerNames && keymapLayout.layerNames.length > 0
        ? keymapLayout.layerNames
        : ['DEFAULT', 'LOWER', 'RAISE', 'ADJUST'],
    [keymapLayout.layerNames]
  );

  // Current active layer matrices
  const activeLayerData = keymapLayout.layers && keymapLayout.layers[currentLayer]
    ? keymapLayout.layers[currentLayer]
    : null;

  const currentLeftMatrix = activeLayerData ? activeLayerData.leftMatrix : keymapLayout.leftMatrix;
  const currentRightMatrix = activeLayerData ? activeLayerData.rightMatrix : keymapLayout.rightMatrix;
  const currentLeftThumbs = activeLayerData ? activeLayerData.leftThumbs : keymapLayout.leftThumbs;
  const currentRightThumbs = activeLayerData ? activeLayerData.rightThumbs : keymapLayout.rightThumbs;

  // Stagger offsets for columns: dynamic length safe
  const getColStagger = (colIdx: number, totalCols: number, isRight: boolean) => {
    const baseStagger5 = [10, 2, -4, 2, 6];
    const baseStagger6 = [14, 10, 2, -4, 2, 6];
    if (totalCols === 6) {
      const idx = isRight ? totalCols - 1 - colIdx : colIdx;
      return baseStagger6[idx] ?? 0;
    }
    const idx = isRight ? totalCols - 1 - colIdx : colIdx;
    return baseStagger5[idx] ?? 0;
  };



  // Record timestamp for live WPM calculation
  const recordKeystroke = useCallback(() => {
    const now = Date.now();
    hadRecentKeystrokesRef.current = true;
    keystrokeTimestampsRef.current.push(now);

    // Keep only keystrokes within the last 2.5 seconds
    keystrokeTimestampsRef.current = keystrokeTimestampsRef.current.filter(t => now - t <= 2500);
    const calculatedWpm = calculateTypingWpm(keystrokeTimestampsRef.current, now, 2500);
    if (calculatedWpm > 0) {
      setWpm(calculatedWpm);
    }
  }, []);

  // Trigger keycap visual press
  const triggerKeyPress = useCallback((identifiers: string | string[]) => {
    const list = Array.isArray(identifiers) ? identifiers : [identifiers];
    const keysToAdd = list.filter(k => Boolean(k && k.trim()));
    if (keysToAdd.length === 0) return;

    setPressedKeys(prev => {
      const next = new Set(prev);
      keysToAdd.forEach(k => next.add(k));
      return next;
    });

    recordKeystroke();

    // Trigger reactive bongo paw animation based on key half
    const hasLeft = keysToAdd.some(k => k.startsWith('L_') || k.startsWith('LT_'));
    const hasRight = keysToAdd.some(k => k.startsWith('R_') || k.startsWith('RT_'));
    if (hasLeft && !hasRight) {
      triggerBongoTap(true);
    } else if (hasRight && !hasLeft) {
      triggerBongoTap(false);
    } else if (hasLeft && hasRight) {
      triggerBongoTap(true);
    }

    setTimeout(() => {
      setPressedKeys(prev => {
        const next = new Set(prev);
        keysToAdd.forEach(k => next.delete(k));
        return next;
      });
    }, 140);
  }, [recordKeystroke, triggerBongoTap]);

  // Random key clicker: simulates typing speeds from 0 (stalled) to 60 WPM
  useEffect(() => {
    if (!randomClickerEnabled) {
      setClickerSpeed(0);
      return;
    }

    let isMounted = true;
    let timerId: ReturnType<typeof setTimeout> | null = null;

    const allCoords: string[] = [];
    const cols = keymapLayout.columns || 5;
    const rows = keymapLayout.rows || 3;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        allCoords.push(`L_${r}_${c}`);
        allCoords.push(`R_${r}_${c}`);
      }
    }
    for (let i = 0; i < currentLeftThumbs.length; i++) {
      allCoords.push(`LT_${i}`);
    }
    for (let i = 0; i < currentRightThumbs.length; i++) {
      allCoords.push(`RT_${i}`);
    }

    if (allCoords.length === 0) return;

    let burstState = getNextClickerAction(false);
    setClickerSpeed(burstState.targetWpm);

    const step = () => {
      if (!isMounted) return;

      if (burstState.isStalled) {
        // Stall completed, proceed with a typing burst
        burstState = getNextClickerAction(true);
        setClickerSpeed(burstState.targetWpm);
      }

      if (burstState.burstLength > 0) {
        const picked = allCoords[Math.floor(Math.random() * allCoords.length)];
        triggerKeyPress(picked);
        burstState.burstLength--;

        if (burstState.burstLength > 0) {
          const delay = getKeystrokeIntervalMs(burstState.targetWpm, true);
          timerId = setTimeout(step, delay);
        } else {
          // Burst completed, determine next action (stall or another burst)
          const next = getNextClickerAction(false);
          burstState = next;
          setClickerSpeed(next.targetWpm);
          if (next.isStalled) {
            timerId = setTimeout(step, next.durationMs);
          } else {
            const interWordPause = Math.round(250 + Math.random() * 350);
            timerId = setTimeout(step, interWordPause);
          }
        }
      }
    };

    // Immediate first keystroke on activation
    step();

    return () => {
      isMounted = false;
      if (timerId) clearTimeout(timerId);
      setClickerSpeed(0);
    };
  }, [
    randomClickerEnabled,
    keymapLayout.columns,
    keymapLayout.rows,
    currentLeftThumbs.length,
    currentRightThumbs.length,
    triggerKeyPress,
  ]);

  // Listen to physical keyboard events anywhere on window
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Do not hijack typing if modal is open or active target is an input/textarea
      const target = e.target as HTMLElement | null;
      if (
        document.querySelector('.modal-overlay') ||
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable
      ) {
        return;
      }

      // Ignore OS key-repeat events to mirror hardware switch events (no rapid flailing on key hold)
      if (e.repeat) {
        return;
      }

      if (e.code === 'CapsLock' || e.key === 'CapsLock') {
        setCapsLock(prev => !prev);
      }

      recordKeystroke();

      const matchingCoords = getMatchingKeyCoords(
        { key: e.key, code: e.code },
        {
          leftMatrix: currentLeftMatrix,
          rightMatrix: currentRightMatrix,
          leftThumbs: currentLeftThumbs,
          rightThumbs: currentRightThumbs,
          columns: keymapLayout.columns,
          rows: keymapLayout.rows,
        }
      );

      if (matchingCoords.length > 0) {
        triggerKeyPress(matchingCoords);
      } else {
        // Fallback for keys not bound in current keymap layer:
        // Use physical scan codes to determine left vs right half
        const LEFT_CODES = new Set([
          'KeyQ', 'KeyW', 'KeyE', 'KeyR', 'KeyT',
          'KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG',
          'KeyZ', 'KeyX', 'KeyC', 'KeyV', 'KeyB',
          'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Backquote',
          'Tab', 'CapsLock', 'ShiftLeft', 'ControlLeft', 'AltLeft', 'MetaLeft',
        ]);
        triggerBongoTap(LEFT_CODES.has(e.code));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    triggerKeyPress,
    recordKeystroke,
    triggerBongoTap,
    currentLeftMatrix,
    currentRightMatrix,
    currentLeftThumbs,
    currentRightThumbs,
    keymapLayout.columns,
    keymapLayout.rows,
  ]);

  // Responsive WPM decay when user stops typing or clicker stalls
  useEffect(() => {
    const interval = setInterval(() => {
      if (!hadRecentKeystrokesRef.current) return;

      const now = Date.now();
      keystrokeTimestampsRef.current = keystrokeTimestampsRef.current.filter(t => now - t <= 2500);
      const count = keystrokeTimestampsRef.current.length;
      const lastKeystroke = keystrokeTimestampsRef.current[keystrokeTimestampsRef.current.length - 1];
      const timeSinceLast = lastKeystroke ? now - lastKeystroke : 9999;

      if (count === 0 || timeSinceLast > 1200) {
        setWpm(prev => {
          if (prev <= 0) {
            hadRecentKeystrokesRef.current = false;
            return 0;
          }
          const next = Math.max(0, Math.round(prev * 0.7 - 2));
          if (next === 0) {
            hadRecentKeystrokesRef.current = false;
          }
          return next;
        });
      }
    }, 350);
    return () => clearInterval(interval);
  }, []);

  const hasAnimationBlock = useMemo(() => {
    const isAnim = (b: LayoutBlock) => {
      const t = (b.widgetType || b.id).toLowerCase();
      return t.includes('animation') || t.includes('loop');
    };
    return leftDisplayBlocks.some(isAnim) || rightDisplayBlocks.some(isAnim);
  }, [leftDisplayBlocks, rightDisplayBlocks]);

  const animStartTimeRef = useRef<number>(Date.now());
  const [animTimestamp, setAnimTimestamp] = useState<number>(0);

  useEffect(() => {
    if (!hasAnimationBlock) return;
    animStartTimeRef.current = Date.now();
    const interval = setInterval(() => {
      setAnimTimestamp(Date.now() - animStartTimeRef.current);
    }, 50);
    return () => clearInterval(interval);
  }, [hasAnimationBlock]);

  const getDisplayInfo = useCallback(
    (displayId: string | null) => {
      if (!displayId) return null;
      const isMaster = displayId === 'central' || displayId === 'left';
      const isPeripheral = displayId === 'peripheral' || displayId === 'right';

      let blocks: LayoutBlock[] = [];
      let width = 32;
      let height = 128;
      let name = isMaster ? 'Central Display' : 'Peripheral Display';

      if (isMaster) {
        blocks = leftDisplayBlocks;
        width = leftVWidth;
        height = leftVHeight;
        name = 'Master Display (Central)';
      } else if (isPeripheral) {
        blocks = rightDisplayBlocks;
        width = rightVWidth;
        height = rightVHeight;
        name = 'Peripheral Display';
      } else if (peripheralScreens && peripheralScreens[displayId]) {
        const ps = peripheralScreens[displayId];
        blocks = isIdle ? (ps.idleBlocks || []) : (ps.blocks || []);
        width = ps.screenDimensions?.width || 32;
        height = ps.screenDimensions?.height || 128;
        name = ps.name || `Peripheral ${displayId.replace('peripheral-', '')}`;
      }

      const displayDim = getOledDisplayDimensions(width, height);
      return { blocks, width, height, name, isMaster, displayDim };
    },
    [
      leftDisplayBlocks,
      rightDisplayBlocks,
      leftVWidth,
      leftVHeight,
      rightVWidth,
      rightVHeight,
      peripheralScreens,
      isIdle,
    ]
  );

  // Render Left (Master), Right (Peripheral), and any additional/unattached OLED displays
  useEffect(() => {
    const PIXEL_PITCH = 2; // Crisp dot simulation
    const DOT_SIZE = 1.6;
    const onColor = '#e2f1ff';

    const renderToCanvas = (
      canvas: HTMLCanvasElement | null,
      blocks: LayoutBlock[],
      vW: number,
      vH: number,
      side: string
    ) => {
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const vbuf = new BwpxGrid(vW, vH);
      renderBlocksToGrid(blocks, vbuf, {
        symbolsGrid,
        symbolSlices,
        fontGrid,
        fontGlyphs,
        fontMappings,
        battery,
        outputMode,
        bleProfileIndex,
        currentLayer,
        layerNames,
        wpm,
        wpmHistory,
        splitConnected,
        capsLock,
        customText,
        instances,
        side,
        isIdle,
        customizations,
        bongoState,
        animationTimestamp: animTimestamp,
      });

      canvas.width = vW * PIXEL_PITCH;
      canvas.height = vH * PIXEL_PITCH;

      ctx.fillStyle = '#05070a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = onColor;
      for (let y = 0; y < vH; y++) {
        for (let x = 0; x < vW; x++) {
          if (vbuf.get(x, y)) {
            ctx.fillRect(x * PIXEL_PITCH, y * PIXEL_PITCH, DOT_SIZE, DOT_SIZE);
          }
        }
      }
    };

    // 1. RENDER LEFT (MASTER) DISPLAY
    renderToCanvas(leftCanvasRef.current, leftDisplayBlocks, leftVWidth, leftVHeight, 'left');

    // 2. RENDER RIGHT (PERIPHERAL) DISPLAY
    renderToCanvas(rightCanvasRef.current, rightDisplayBlocks, rightVWidth, rightVHeight, 'right');

    // 3. RENDER ANY DYNAMIC OR UNATTACHED CANVASES
    Object.entries(canvasRefs.current).forEach(([screenKey, canvasEl]) => {
      if (!canvasEl) return;
      if (screenKey === 'central' || screenKey === 'left' || screenKey === 'peripheral' || screenKey === 'right') {
        return;
      }
      const info = getDisplayInfo(screenKey);
      if (info) {
        renderToCanvas(canvasEl, info.blocks, info.width, info.height, screenKey);
      }
    });
  }, [
    leftDisplayBlocks,
    rightDisplayBlocks,
    symbolsGrid,
    symbolSlices,
    fontGrid,
    fontGlyphs,
    fontMappings,
    leftVWidth,
    leftVHeight,
    rightVWidth,
    rightVHeight,
    outputMode,
    bleProfileIndex,
    battery,
    currentLayer,
    wpm,
    wpmHistory,
    instances,
    splitConnected,
    capsLock,
    customText,
    layerNames,
    customizations,
    bongoState,
    animTimestamp,
    getDisplayInfo,
  ]);

  return (
    <div className="oled-preview-fullscreen">
      {/* =========================================================================
          TOP: KEYBOARD / SHIELD VISUALIZATION WITH OLED DISPLAYS
          Loaded configuration is realignable; drop zones are only shown during drag.
          ========================================================================= */}
      {activeShield.layoutGeometry.type === 'unknown' ? (
        <div className="flex items-center justify-center gap-8 my-6 relative">
          {orderedShields.map((shield) => {
            const assignedDisplayId = reconciledAssignments[shield.id];
            const dispInfo = getDisplayInfo(assignedDisplayId);
            const isLeft = shield.side === 'left' || shield.isMaster;

            return (
              <div
                key={shield.id}
                className={`preview-shield-wrapper relative transition-all ${
                  hoveredDisplayDropTarget === shield.id
                    ? 'ring-2 ring-[#00f0ff] shadow-[0_0_24px_rgba(0,240,255,0.4)] rounded-2xl'
                    : ''
                }`}
                onDragOver={(e) => handleDisplayDragOver(e, shield.id)}
                onDragLeave={(e) => handleDisplayDragLeave(e, shield.id)}
                onDrop={(e) => handleDisplayDrop(e, shield.id)}
              >
                <div className="unknown-shield-unit-case">
                  <div className="unknown-shield-body relative">
                    <div className="unknown-shield-header-badge">
                      <span className="live-dot" />
                      <span>{shield.name}</span>
                    </div>

                    {/* Central Shield Badge with tooltip */}
                    {isLeft && (
                      <div
                        className="central-shield-badge"
                        title="Central Shield"
                        data-testid="central-shield-badge"
                      >
                        <div className="central-shield-badge-dot">
                          <Cpu size={10} className="shrink-0" />
                        </div>
                        <div className="central-shield-tooltip">
                          Central Shield
                        </div>
                      </div>
                    )}

                    {assignedDisplayId && dispInfo ? (
                      <div
                        className={`oled-glass-housing relative group/display cursor-grab active:cursor-grabbing rounded-xl transition-all ${
                          hoveredDisplayDropTarget === shield.id
                            ? 'ring-2 ring-[#00f0ff] shadow-[0_0_20px_rgba(0,240,255,0.6)] scale-102'
                            : 'hover:ring-1 hover:ring-[#00f0ff]/50'
                        }`}
                        style={{
                          width: `${dispInfo.displayDim.displayW + OLED_BORDER_UNITS * 2}px`,
                          height: `${dispInfo.displayDim.displayH + OLED_BORDER_UNITS * 2}px`,
                        }}
                        draggable={true}
                        onDragStart={(e) => handleDisplayDragStart(e, shield.id, assignedDisplayId)}
                        onDragEnd={handleDisplayDragEnd}
                        onDragOver={(e) => handleDisplayDragOver(e, shield.id)}
                        onDragLeave={(e) => handleDisplayDragLeave(e, shield.id)}
                        onDrop={(e) => handleDisplayDrop(e, shield.id)}
                        title={`${dispInfo.name} (Drag to swap or move to another shield)`}
                      >
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 opacity-0 group-hover/display:opacity-100 transition-opacity z-20 pointer-events-none bg-[#0a0d14]/95 border border-[#00f0ff]/40 text-[#00f0ff] text-[8px] font-mono font-bold px-1.5 py-0.5 rounded shadow-sm whitespace-nowrap select-none">
                          Drag Display
                        </div>
                        <div
                          style={{
                            position: 'relative',
                            width: `${dispInfo.displayDim.displayW}px`,
                            height: `${dispInfo.displayDim.displayH}px`,
                          }}
                        >
                          <canvas
                            ref={(el) => {
                              if (assignedDisplayId === 'central') leftCanvasRef.current = el;
                              else if (assignedDisplayId === 'peripheral') rightCanvasRef.current = el;
                              canvasRefs.current[assignedDisplayId] = el;
                            }}
                            className="corne-oled-canvas"
                            style={{
                              width: `${dispInfo.displayDim.displayW}px`,
                              height: `${dispInfo.displayDim.displayH}px`,
                              display: 'block',
                            }}
                          />
                        </div>
                      </div>
                    ) : (
                      <div
                        className={`preview-oled-empty-bay transition-all ${
                          hoveredDisplayDropTarget === shield.id
                            ? 'border-[#00f0ff] bg-[#00f0ff]/15 ring-2 ring-[#00f0ff] shadow-[0_0_20px_rgba(0,240,255,0.4)] scale-102'
                            : ''
                        }`}
                        onDragOver={(e) => handleDisplayDragOver(e, shield.id)}
                        onDragLeave={(e) => handleDisplayDragLeave(e, shield.id)}
                        onDrop={(e) => handleDisplayDrop(e, shield.id)}
                        style={{
                          width: `${leftDisplayDim.displayW + OLED_BORDER_UNITS * 2}px`,
                          minHeight: `${leftDisplayDim.displayH + OLED_BORDER_UNITS * 2}px`,
                        }}
                        title="Empty OLED Bay — Drag a display here to mount"
                      >
                        <Monitor size={20} className="text-muted/60" />
                        <span className="text-[11px] text-muted font-mono font-medium">Empty OLED Bay</span>
                        <span className="text-[10px] text-muted/50 font-mono">No display attached</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="corne-keyboard-split">
          {orderedShields.map((shield) => {
            const assignedDisplayId = reconciledAssignments[shield.id];
            const dispInfo = getDisplayInfo(assignedDisplayId);
            const isLeft = shield.side === 'left' || shield.isMaster;
            const fallbackDisplayDim = isLeft ? leftDisplayDim : rightDisplayDim;

            return (
              <div
                key={shield.id}
                className={`preview-shield-wrapper relative transition-all ${
                  hoveredDisplayDropTarget === shield.id
                    ? 'ring-2 ring-[#00f0ff] shadow-[0_0_24px_rgba(0,240,255,0.4)] rounded-2xl'
                    : ''
                }`}
                onDragOver={(e) => handleDisplayDragOver(e, shield.id)}
                onDragLeave={(e) => handleDisplayDragLeave(e, shield.id)}
                onDrop={(e) => handleDisplayDrop(e, shield.id)}
              >
                <div className={`corne-half-case ${isLeft ? 'left-half' : 'right-half'}`}>
                    {/* Central Shield Badge with tooltip */}
                    {isLeft && (
                      <div
                        className="central-shield-badge"
                        title="Central Shield"
                        data-testid="central-shield-badge"
                      >
                        <div className="central-shield-badge-dot">
                          <Cpu size={10} className="shrink-0" />
                        </div>
                        <div className="central-shield-tooltip">
                          Central Shield
                        </div>
                      </div>
                    )}

                    <div className={`half-inner-layout ${!isLeft ? 'mirrored' : ''}`}>
                      {/* Left: Keys Cluster first */}
                      {isLeft && (
                        <div className="corne-keys-cluster">
                          <div className="corne-matrix">
                            {Array.from({ length: keymapLayout.columns }, (_, colIdx) => (
                              <div
                                key={colIdx}
                                className="corne-col"
                                style={{ transform: `translateY(${getColStagger(colIdx, keymapLayout.columns, false)}px)` }}
                              >
                                {Array.from({ length: keymapLayout.rows }, (_, rowIdx) => {
                                  const keyLabel = currentLeftMatrix[rowIdx]?.[colIdx] || '';
                                  const coordId = `L_${rowIdx}_${colIdx}`;
                                  const isPressed = pressedKeys.has(coordId);
                                  const isEmpty = !keyLabel;
                                  return (
                                    <div
                                      key={rowIdx}
                                      className={`corne-keycap ${isEmpty ? 'empty' : ''} ${isPressed ? 'pressed' : ''}`}
                                      onClick={() => triggerKeyPress(coordId)}
                                      title={keyLabel ? `Left [${rowIdx},${colIdx}]: ${keyLabel}` : `Left [${rowIdx},${colIdx}]`}
                                    >
                                      {keyLabel ? <span className="keycap-legend">{keyLabel}</span> : null}
                                    </div>
                                  );
                                })}
                              </div>
                            ))}
                          </div>

                          <div className="corne-thumbs left-thumbs">
                            {currentLeftThumbs.map((t, idx) => {
                              const coordId = `LT_${idx}`;
                              const isPressed = pressedKeys.has(coordId);
                              const isEmpty = !t;
                              return (
                                <div
                                  key={idx}
                                  className={`corne-thumb-key thumb-${idx} ${isEmpty ? 'empty' : ''} ${isPressed ? 'pressed' : ''}`}
                                  onClick={() => triggerKeyPress(coordId)}
                                  title={t ? `Left Thumb [${idx}]: ${t}` : `Left Thumb [${idx}]`}
                                >
                                  {t ? <span className="thumb-legend">{t}</span> : null}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* OLED Display Bay (Inner Side) */}
                      <div className="corne-mcu-bay">
                        <div className="mcu-pcb-socket">
                          {assignedDisplayId && dispInfo ? (
                            <div
                              className={`oled-glass-housing relative group/display cursor-grab active:cursor-grabbing rounded-xl transition-all ${
                                hoveredDisplayDropTarget === shield.id
                                  ? 'ring-2 ring-[#00f0ff] shadow-[0_0_20px_rgba(0,240,255,0.6)] scale-102'
                                  : 'hover:ring-1 hover:ring-[#00f0ff]/50'
                              }`}
                              style={{
                                width: `${dispInfo.displayDim.displayW + OLED_BORDER_UNITS * 2}px`,
                                height: `${dispInfo.displayDim.displayH + OLED_BORDER_UNITS * 2}px`,
                              }}
                              draggable={true}
                              onDragStart={(e) => handleDisplayDragStart(e, shield.id, assignedDisplayId)}
                              onDragEnd={handleDisplayDragEnd}
                              onDragOver={(e) => handleDisplayDragOver(e, shield.id)}
                              onDragLeave={(e) => handleDisplayDragLeave(e, shield.id)}
                              onDrop={(e) => handleDisplayDrop(e, shield.id)}
                              title={`${dispInfo.name} (Drag to swap or move to another shield)`}
                            >
                              <div className="absolute -top-3 left-1/2 -translate-x-1/2 opacity-0 group-hover/display:opacity-100 transition-opacity z-20 pointer-events-none bg-[#0a0d14]/95 border border-[#00f0ff]/40 text-[#00f0ff] text-[8px] font-mono font-bold px-1.5 py-0.5 rounded shadow-sm whitespace-nowrap select-none">
                                Drag Display
                              </div>
                              <div
                                style={{
                                  position: 'relative',
                                  width: `${dispInfo.displayDim.displayW}px`,
                                  height: `${dispInfo.displayDim.displayH}px`,
                                }}
                              >
                                <canvas
                                  ref={(el) => {
                                    if (assignedDisplayId === 'central') leftCanvasRef.current = el;
                                    else if (assignedDisplayId === 'peripheral') rightCanvasRef.current = el;
                                    canvasRefs.current[assignedDisplayId] = el;
                                  }}
                                  className="corne-oled-canvas"
                                  style={{
                                    width: `${dispInfo.displayDim.displayW}px`,
                                    height: `${dispInfo.displayDim.displayH}px`,
                                    display: 'block',
                                  }}
                                />
                              </div>
                            </div>
                          ) : (
                            <div
                              className={`preview-oled-empty-bay transition-all ${
                                hoveredDisplayDropTarget === shield.id
                                  ? 'border-[#00f0ff] bg-[#00f0ff]/15 ring-2 ring-[#00f0ff] shadow-[0_0_20px_rgba(0,240,255,0.4)] scale-102'
                                  : ''
                              }`}
                              onDragOver={(e) => handleDisplayDragOver(e, shield.id)}
                              onDragLeave={(e) => handleDisplayDragLeave(e, shield.id)}
                              onDrop={(e) => handleDisplayDrop(e, shield.id)}
                              style={{
                                width: `${fallbackDisplayDim.displayW + OLED_BORDER_UNITS * 2}px`,
                                minHeight: `${fallbackDisplayDim.displayH + OLED_BORDER_UNITS * 2}px`,
                              }}
                              title="Empty OLED Bay — Drag a display here to mount"
                            >
                              <Monitor size={18} className="text-muted/60" />
                              <span className="text-[10px] text-muted font-mono font-medium">Empty OLED Bay</span>
                              <span className="text-[9px] text-muted/50 font-mono">No display attached</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Right: Keys Cluster second */}
                      {!isLeft && (
                        <div className="corne-keys-cluster">
                          <div className="corne-matrix">
                            {Array.from({ length: keymapLayout.columns }, (_, colIdx) => (
                              <div
                                key={colIdx}
                                className="corne-col"
                                style={{ transform: `translateY(${getColStagger(colIdx, keymapLayout.columns, true)}px)` }}
                              >
                                {Array.from({ length: keymapLayout.rows }, (_, rowIdx) => {
                                  const keyLabel = currentRightMatrix[rowIdx]?.[colIdx] || '';
                                  const coordId = `R_${rowIdx}_${colIdx}`;
                                  const isPressed = pressedKeys.has(coordId);
                                  const isEmpty = !keyLabel;
                                  return (
                                    <div
                                      key={rowIdx}
                                      className={`corne-keycap ${isEmpty ? 'empty' : ''} ${isPressed ? 'pressed' : ''}`}
                                      onClick={() => triggerKeyPress(coordId)}
                                      title={keyLabel ? `Right [${rowIdx},${colIdx}]: ${keyLabel}` : `Right [${rowIdx},${colIdx}]`}
                                    >
                                      {keyLabel ? <span className="keycap-legend">{keyLabel}</span> : null}
                                    </div>
                                  );
                                })}
                              </div>
                            ))}
                          </div>

                          <div className="corne-thumbs right-thumbs">
                            {currentRightThumbs.map((t, idx) => {
                              const coordId = `RT_${idx}`;
                              const isPressed = pressedKeys.has(coordId);
                              const isEmpty = !t;
                              return (
                                <div
                                  key={idx}
                                  className={`corne-thumb-key thumb-${idx} ${isEmpty ? 'empty' : ''} ${isPressed ? 'pressed' : ''}`}
                                  onClick={() => triggerKeyPress(coordId)}
                                  title={t ? `Right Thumb [${idx}]: ${t}` : `Right Thumb [${idx}]`}
                                >
                                  {t ? <span className="thumb-legend">{t}</span> : null}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* =========================================================================
          UNATTACHED DISPLAYS SECTION
          Renders any display configured in layout that is NOT mounted to a shield.
          Displays explicit warning that it won't be saved when committing.
          ========================================================================= */}
      {unattachedDisplayIds.length > 0 && (
        <div
          className={`unattached-displays-section transition-all ${
            hoveredUnattachedDrawer && draggedDisplay?.fromShieldId
              ? 'ring-2 ring-amber-400 bg-amber-500/10 shadow-[0_0_24px_rgba(245,158,11,0.3)]'
              : ''
          }`}
          data-testid="unattached-displays-section"
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            e.dataTransfer.dropEffect = 'move';
            if (!hoveredUnattachedDrawer) setHoveredUnattachedDrawer(true);
          }}
          onDragLeave={() => setHoveredUnattachedDrawer(false)}
          onDrop={handleDropOnUnattachedDrawer}
        >
          <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
            <div className="flex items-center gap-2 text-amber-400">
              <AlertTriangle size={18} />
              <span className="font-mono font-semibold text-sm">
                {`Unattached Displays (${unattachedDisplayIds.length})`}
              </span>
            </div>
            <span className="text-xs text-amber-400/90 font-mono">
              Display is not attached and won't be saved when committing. Drop here to detach from shield.
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6">
            {unattachedDisplayIds.map((screenId) => {
              const info = getDisplayInfo(screenId);
              if (!info) return null;
              return (
                <div
                  key={screenId}
                  className="unattached-display-card cursor-grab active:cursor-grabbing"
                  data-testid={`unattached-card-${screenId}`}
                  draggable
                  onDragStart={(e) => handleDisplayDragStart(e, undefined, screenId)}
                  onDragEnd={handleDisplayDragEnd}
                  title="Drag display to any shield bay to attach"
                >
                  <div className="flex items-center justify-between w-full gap-2 border-b border-amber-500/20 pb-1.5">
                    <span className="font-mono text-xs font-semibold text-[#e2f1ff]">{info.name}</span>
                    <div className="flex items-center gap-1.5">
                      <label className="text-[10px] text-muted font-mono">Attach to:</label>
                      <select
                        className="preview-display-select"
                        value=""
                        onChange={(e) => {
                          const shieldKey = e.target.value;
                          if (shieldKey) handleAssignDisplay(shieldKey, screenId);
                        }}
                        aria-label={`Attach ${info.name} to shield`}
                      >
                        <option value="" disabled>Select shield...</option>
                        {orderedShields.map((sh) => (
                          <option key={sh.id} value={sh.id}>
                            {sh.name} {reconciledAssignments[sh.id] ? `(Replaces ${reconciledAssignments[sh.id]})` : '(Empty)'}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div
                    className="oled-glass-housing"
                    style={{
                      width: `${info.displayDim.displayW + OLED_BORDER_UNITS * 2}px`,
                      height: `${info.displayDim.displayH + OLED_BORDER_UNITS * 2}px`,
                      borderColor: 'rgba(245, 158, 11, 0.4)',
                      boxShadow: '0 0 12px rgba(245, 158, 11, 0.15)',
                    }}
                  >
                    <div
                      style={{
                        position: 'relative',
                        width: `${info.displayDim.displayW}px`,
                        height: `${info.displayDim.displayH}px`,
                      }}
                    >
                      <canvas
                        ref={(el) => {
                          if (screenId === 'central') leftCanvasRef.current = el;
                          else if (screenId === 'peripheral') rightCanvasRef.current = el;
                          canvasRefs.current[screenId] = el;
                        }}
                        className="corne-oled-canvas"
                        style={{
                          width: `${info.displayDim.displayW}px`,
                          height: `${info.displayDim.displayH}px`,
                          display: 'block',
                        }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 text-[10px] text-amber-400/80 font-mono mt-1 text-center">
                    <AlertTriangle size={11} />
                    <span>Display is not attached and won't be saved when committing.</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* =========================================================================
          BOTTOM: REACTIVE FIRMWARE SIMULATOR CONTROLS
          ========================================================================= */}
      <div className="simulator-controls-panel">
        <div className="panel-card-inner">
          <div className="card-header">
            <div className="flex items-center gap-2">
              <Sliders size={17} className="text-accent" />
              <h3 className="card-title">Live Keyboard Simulator Controls</h3>
            </div>
            <span className="badge-mode">
              {effectiveEnabledScreens.length > 2
                ? `${effectiveEnabledScreens.length}-Screen Multi-Display`
                : effectiveEnabledScreens.length === 1
                ? 'Single Display'
                : 'Dual Display Sync'}
            </span>
          </div>

          <div className="controls-grid">
            {/* Screen State */}
            <div className="control-group">
              <label>Screen State</label>
              <div className="widget-mode-radio-group w-fit" role="radiogroup" aria-label="Screen State">
                <button
                  type="button"
                  role="radio"
                  aria-checked={!isIdle}
                  className={`widget-mode-radio-btn ${!isIdle ? 'active' : ''}`}
                  onClick={() => setIsIdle(false)}
                >
                  <Sun size={13} />
                  <span>Active Mode</span>
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={isIdle}
                  className={`widget-mode-radio-btn ${isIdle ? 'active' : ''}`}
                  onClick={() => setIsIdle(true)}
                >
                  <Moon size={13} />
                  <span>Idle Sleep</span>
                </button>
              </div>
            </div>

            {/* Output Protocol */}
            <div className="control-group">
              <label>Output Protocol</label>
              <div className="widget-mode-radio-group w-fit" role="radiogroup" aria-label="Output Protocol">
                <button
                  type="button"
                  role="radio"
                  aria-checked={outputMode === 'usb'}
                  className={`widget-mode-radio-btn ${outputMode === 'usb' ? 'active' : ''}`}
                  onClick={() => setOutputMode('usb')}
                >
                  <Usb size={13} />
                  <span>USB</span>
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={outputMode === 'ble'}
                  className={`widget-mode-radio-btn ${outputMode === 'ble' ? 'active' : ''}`}
                  onClick={() => setOutputMode('ble')}
                >
                  <Bluetooth size={13} />
                  <span>Bluetooth</span>
                </button>
              </div>
              {outputMode === 'ble' && (
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-xs text-muted">Profile:</span>
                  <div className="widget-mode-radio-group flex-wrap w-fit" role="radiogroup" aria-label="Output Protocol Profiles">
                    {[0, 1, 2, 3, 4, 5].map(idx => (
                      <button
                        key={idx}
                        type="button"
                        role="radio"
                        aria-checked={bleProfileIndex === idx}
                        className={`widget-mode-radio-btn !px-2 !py-0.5 text-xs ${bleProfileIndex === idx ? 'active' : ''}`}
                        onClick={() => setBleProfileIndex(idx)}
                      >
                        <span>{idx === 0 ? 'No conn' : `P${idx}`}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Active Keyboard Layer */}
            <div className="control-group full-width">
              <label className="flex items-center gap-1">
                <Layers size={14} className="text-accent" />
                <span>Active Keyboard Layer</span>
              </label>
              <div className="widget-mode-radio-group flex-wrap w-fit" role="radiogroup" aria-label="Active Keyboard Layer">
                {layerNames.map((name, idx) => (
                  <button
                    key={`${name}-${idx}`}
                    type="button"
                    role="radio"
                    aria-checked={currentLayer === idx}
                    className={`widget-mode-radio-btn ${currentLayer === idx ? 'active' : ''}`}
                    onClick={() => setCurrentLayer(idx)}
                  >
                    <span>{formatLayerLabel(idx, name)}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Wireless Link, Caps Lock & Character Clicker Row */}
            <div className="full-width">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Split Wireless Link */}
                <div className="control-group">
                  <label>Split Wireless Link</label>
                  <button
                    className={`btn-toggle-subtle flex items-center justify-center gap-2 h-9 ${splitConnected ? 'active-accent' : 'inactive'}`}
                    onClick={() => setSplitConnected(!splitConnected)}
                  >
                    <span>{splitConnected ? 'Linked (Connected)' : 'Disconnected (Unlinked)'}</span>
                  </button>
                </div>

                {/* Caps Lock State */}
                <div className="control-group">
                  <label>Caps Lock State</label>
                  <button
                    className={`btn-toggle-subtle flex items-center justify-center gap-2 h-9 ${capsLock ? 'active-accent' : 'inactive'}`}
                    onClick={() => setCapsLock(!capsLock)}
                  >
                    <span>{capsLock ? 'Caps Lock: ON' : 'Caps Lock: OFF'}</span>
                  </button>
                </div>

                {/* Character Clicker */}
                <div className="control-group">
                  <label>Character Clicker</label>
                  <button
                    className={`btn-toggle-subtle flex items-center justify-center gap-2 h-9 ${randomClickerEnabled ? 'active-accent' : 'inactive'}`}
                    onClick={() => setRandomClickerEnabled(prev => !prev)}
                    title={randomClickerEnabled ? 'Click to stop character clicker' : 'Simulate random typing speeds (0 stalled to 60 WPM)'}
                  >
                    <Shuffle size={13} />
                    <span>
                      {randomClickerEnabled
                        ? clickerSpeed === 0
                          ? 'Clicker: Stalled (0 WPM)'
                          : `Clicker: ~${clickerSpeed} WPM`
                        : 'Clicker: OFF'}
                    </span>
                  </button>
                </div>
              </div>
            </div>

            {/* Battery Level (Single Slider) */}
            <div className="control-group">
              <div className="label-with-value">
                <label className="flex items-center gap-1">
                  <Battery size={14} className="text-accent" />
                  <span>Battery Level</span>
                </label>
                <span className="value-chip">{battery}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={battery}
                onChange={e => setBattery(parseInt(e.target.value, 10))}
                className="slider-range"
              />
            </div>

            {/* Typing Speed (WPM) (Single Slider) */}
            <div className="control-group">
              <div className="label-with-value">
                <label className="flex items-center gap-1">
                  <Gauge size={14} className="text-accent" />
                  <span>Typing Speed (WPM)</span>
                </label>
                <span className="value-chip font-mono">{`${wpm} WPM`}</span>
              </div>
              <input
                type="range"
                min="0"
                max="160"
                value={wpm}
                onChange={e => {
                  hadRecentKeystrokesRef.current = false;
                  setWpm(parseInt(e.target.value, 10));
                }}
                className="slider-range"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { BwpxGrid } from '../bwpx/core/BwpxGrid';
import type { SpriteSlice, FontGlyph, LayoutBlock, FontCharMapping } from '../types/zmk';
import { Cpu } from 'lucide-react';
import type { GitHubRepoConfig, GitHubConnectionState } from '../services/githubService';
import type { PeripheralScreenData } from '../services/cHeaderParser';
import {
  type ParsedKeymapLayout,
  DEFAULT_EMPTY_5X3_LAYOUT,
  fetchRepoKeymap,
  parseZmkKeymap,
  getMatchingKeyCoords,
} from '../services/keymapService';
import {
  OledSimulationPanel,
  OledDisplayBay,
  UnattachedDisplaysSection,
  CorneKeysCluster,
  type OledBlitterRenderState,
} from './preview';
import {
  getNextClickerAction,
  getKeystrokeIntervalMs,
  calculateTypingWpm,
} from '../services/wpmSimulator';
import {
  DEFAULT_CENTRAL_LAYOUT_BLOCKS,
  DEFAULT_PERIPHERAL_LAYOUT_BLOCKS,
  DEFAULT_IDLE_CENTRAL_BLOCKS,
  DEFAULT_IDLE_PERIPHERAL_BLOCKS,
} from '../types/zmk';
import { getShieldDefinition, getShieldUnitsForShield, type LoadedShieldUnit } from '../data/shieldsData';

import { useAtlasStore } from '../stores/useAtlasStore';
import { useLayoutStore } from '../stores/useLayoutStore';
import { useGitHubStore } from '../stores/useGitHubStore';
import { useUiStore } from '../stores/useUiStore';

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

export interface OledPreviewTabProps {
  symbolsGrid?: BwpxGrid;
  symbolSlices?: SpriteSlice[];
  fontGrid?: BwpxGrid;
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
  customText?: string;
  onCustomTextChange?: (text: string) => void;
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
  symbolsGrid: propsSymbolsGrid,
  symbolSlices: propsSymbolSlices,
  fontGrid: propsFontGrid,
  fontGlyphs: propsFontGlyphs,
  fontMappings: propsFontMappings,
  centralBlocks: propsCentralBlocks,
  peripheralBlocks: propsPeripheralBlocks,
  onCentralBlocksChange: _onCentralBlocksChange,
  onPeripheralBlocksChange: _onPeripheralBlocksChange,
  idleCentralBlocks: propsIdleCentralBlocks,
  idlePeripheralBlocks: propsIdlePeripheralBlocks,
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
  screenDimensions: propsScreenDimensions,
  peripheralScreenDimensions: propsPeripheralScreenDimensions,
  rightScreenDimensions,
  symmetricSettings: propsSymmetricSettings,
  shieldId: propsShieldId,
  onShieldIdChange: _onShieldIdChange,
  enabledScreens: propsEnabledScreens,
  onEnabledScreensChange: _onEnabledScreensChange,
  onSwapDisplays: _onSwapDisplays,
  displayAssignments: propsDisplayAssignments,
  onDisplayAssignmentsChange: propsOnDisplayAssignmentsChange,
  loadedShields: propsLoadedShields,
  peripheralScreens: propsPeripheralScreens,
  customText: propsCustomText,
  onCustomTextChange: _onCustomTextChange,
  instances: propsInstances,
  customizations,
  config: propsConfig,
  connection: propsConnection,
  onShowToast: propsOnShowToast,
  onOpenSettings: propsOnOpenSettings,
  syncTrigger: propsSyncTrigger,
  keymapLayout: propKeymapLayout,
  onKeymapLayoutChange,
}) => {
  const storeSymbolsGrid = useAtlasStore((s) => s.symbolsGrid);
  const storeSymbolSlices = useAtlasStore((s) => s.symbolSlices);
  const storeFontGrid = useAtlasStore((s) => s.fontGrid);
  const storeFontGlyphs = useAtlasStore((s) => s.fontGlyphs);
  const storeFontMappings = useAtlasStore((s) => s.fontMappings);

  const storeCentralBlocks = useLayoutStore((s) => s.centralBlocks);
  const storePeripheralBlocks = useLayoutStore((s) => s.peripheralBlocks);
  const storeIdleCentralBlocks = useLayoutStore((s) => s.idleCentralBlocks);
  const storeIdlePeripheralBlocks = useLayoutStore((s) => s.idlePeripheralBlocks);
  const storeScreenDimensions = useLayoutStore((s) => s.screenDimensions);
  const storePeripheralScreenDimensions = useLayoutStore((s) => s.peripheralScreenDimensions);
  const storeSymmetricSettings = useLayoutStore((s) => s.symmetricSettings);
  const storeShieldId = useLayoutStore((s) => s.shieldId);
  const storeEnabledScreens = useLayoutStore((s) => s.enabledScreens);
  const storeDisplayAssignments = useLayoutStore((s) => s.displayAssignments);
  const storeSetDisplayAssignments = useLayoutStore((s) => s.setDisplayAssignments);
  const storeLoadedShields = useLayoutStore((s) => s.loadedShields);
  const storeDisplays = useLayoutStore((s) => s.displays);
  const storePeripheralScreens = useLayoutStore((s) => s.peripheralScreens);
  const storeWidgetInstances = useLayoutStore((s) => s.widgetInstances);

  const storeConfig = useGitHubStore((s) => s.config);
  const storeConnection = useGitHubStore((s) => s.connection);
  const storeSyncTrigger = useGitHubStore((s) => s.syncTrigger);

  const storeCustomText = useUiStore((s) => s.customText);
  const storeShowToast = useUiStore((s) => s.showToast);
  const storeOpenSettingsModal = useUiStore((s) => s.openSettingsModal);

  const symbolsGrid = propsSymbolsGrid ?? storeSymbolsGrid;
  const symbolSlices = propsSymbolSlices ?? storeSymbolSlices;
  const fontGrid = propsFontGrid ?? storeFontGrid;
  const fontGlyphs = propsFontGlyphs ?? storeFontGlyphs;
  const fontMappings = propsFontMappings ?? storeFontMappings;
  const centralBlocks = propsCentralBlocks ?? storeCentralBlocks;
  const peripheralBlocks = propsPeripheralBlocks ?? storePeripheralBlocks;
  const idleCentralBlocks = propsIdleCentralBlocks ?? storeIdleCentralBlocks;
  const idlePeripheralBlocks = propsIdlePeripheralBlocks ?? storeIdlePeripheralBlocks;
  const screenDimensions = propsScreenDimensions ?? storeScreenDimensions;
  const peripheralScreenDimensions = propsPeripheralScreenDimensions ?? rightScreenDimensions ?? storePeripheralScreenDimensions;
  const symmetricSettings = propsSymmetricSettings ?? storeSymmetricSettings;
  const shieldId = propsShieldId ?? storeShieldId ?? 'corne';
  const enabledScreens = propsEnabledScreens ?? storeEnabledScreens;
  const displayAssignments = propsDisplayAssignments ?? storeDisplayAssignments;
  const onDisplayAssignmentsChange = propsOnDisplayAssignmentsChange ?? storeSetDisplayAssignments;
  const loadedShields = propsLoadedShields !== undefined
    ? propsLoadedShields
    : (propsShieldId === undefined || propsShieldId === storeShieldId)
      ? storeLoadedShields
      : undefined;
  const peripheralScreens = propsPeripheralScreens ?? storePeripheralScreens;
  const customText = propsCustomText ?? storeCustomText;
  const instances = propsInstances ?? storeWidgetInstances;
  const config = propsConfig ?? storeConfig;
  const connection = propsConnection ?? storeConnection;
  const onShowToast = propsOnShowToast ?? storeShowToast;
  const onOpenSettings = propsOnOpenSettings ?? storeOpenSettingsModal;
  const syncTrigger = propsSyncTrigger ?? storeSyncTrigger;

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

  const [bongoState, setBongoState] = useState<0 | 1 | 2>(0);
  const bongoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTapTimeRef = useRef<number>(0);

  const triggerBongoTap = useCallback((isLeft: boolean) => {
    const now = Date.now();
    // Debounce check: suppress rapid re-triggering within the debounce window
    if (now - lastTapTimeRef.current < bongoDebounceMs) {
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
    }, bongoTapMs);
  }, [bongoDebounceMs, bongoTapMs]);

  useEffect(() => {
    return () => {
      if (bongoTimerRef.current) {
        clearTimeout(bongoTimerRef.current);
      }
    };
  }, []);

  // Time-progressing WPM history ticker (continuous 1Hz sampling using ref to avoid reset on keypress/decay)
  const wpmRef = useRef(wpm);
  useEffect(() => {
    wpmRef.current = wpm;
  }, [wpm]);

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

  const keystrokeTimestampsRef = useRef<number[]>([]);
  const hadRecentKeystrokesRef = useRef<boolean>(false);

  // Automatically fetch keymap from GitHub when repository is configured
  useEffect(() => {
    if (!config?.owner || !config?.repo) {
      return;
    }
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
  }, [config, connection?.status, setKeymapLayout]);

  // Manual refresh helper with toasts and clear feedback
  const handleRefreshKeymap = useCallback(async () => {
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
  }, [config, connection?.status, onOpenSettings, onShowToast, setKeymapLayout]);

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
  }, [syncTrigger, handleRefreshKeymap]);

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

        const interval = getKeystrokeIntervalMs(burstState.targetWpm);
        timerId = setTimeout(step, interval);
      } else {
        // Burst finished, switch to pause/stall
        burstState = getNextClickerAction(false);
        setClickerSpeed(burstState.targetWpm);
        timerId = setTimeout(step, burstState.durationMs);
      }
    };

    timerId = setTimeout(() => {
      if (isMounted) {
        setClickerSpeed(burstState.targetWpm);
        step();
      }
    }, 100);

    return () => {
      isMounted = false;
      if (timerId) clearTimeout(timerId);
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

  const animStartTimeRef = useRef<number>(0);
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
    (displayId: string | null | undefined) => {
      if (!displayId) return null;

      // 1. Resolve from modern decoupled displays dictionary (display-1, display-2, etc.)
      if (storeDisplays && storeDisplays[displayId]) {
        const d = storeDisplays[displayId];
        const blocks = isIdle ? (d.idleBlocks || []) : (d.blocks || []);
        const width = d.dimensions?.width || 32;
        const height = d.dimensions?.height || 128;
        const name = d.name || displayId;
        const displayDim = getOledDisplayDimensions(width, height);
        return { blocks, width, height, name, isMaster: false, displayDim };
      }

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
      storeDisplays,
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

  // Memoized reactive simulator state passed down to modular OledBlitterCanvas instances
  const blitterRenderState: OledBlitterRenderState = useMemo(() => ({
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
    customizations,
    bongoState,
    animationTimestamp: animTimestamp,
    isIdle,
  }), [
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
    customizations,
    bongoState,
    animTimestamp,
    isIdle,
  ]);

  return (
    <div className="oled-preview-fullscreen">

      {/* =========================================================================
          TOP: KEYBOARD / SHIELD VISUALIZATION WITH OLED DISPLAYS
          ========================================================================= */}
      {activeShield.layoutGeometry.type === 'unknown' ? (
        <div className="flex items-center justify-center gap-8 my-6 relative">
          {orderedShields.map((shield) => {
            const assignedDisplayId = reconciledAssignments[shield.id];
            const dispInfo = getDisplayInfo(assignedDisplayId);

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
                    {shield.isMaster && (
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

                    <OledDisplayBay
                      shieldId={shield.id}
                      assignedDisplayId={assignedDisplayId}
                      dispInfo={dispInfo}
                      fallbackDisplayDim={leftDisplayDim}
                      isHoveredDropTarget={hoveredDisplayDropTarget === shield.id}
                      onDragStart={handleDisplayDragStart}
                      onDragEnd={handleDisplayDragEnd}
                      onDragOver={handleDisplayDragOver}
                      onDragLeave={handleDisplayDragLeave}
                      onDrop={handleDisplayDrop}
                      renderState={blitterRenderState}
                    />
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
                  {shield.isMaster && (
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
                      <CorneKeysCluster
                        isLeft={true}
                        keymapLayout={keymapLayout}
                        matrix={currentLeftMatrix}
                        thumbs={currentLeftThumbs}
                        pressedKeys={pressedKeys}
                        onKeyPress={triggerKeyPress}
                        getColStagger={getColStagger}
                      />
                    )}

                    {/* OLED Display Bay (Inner Side) */}
                    <div className="corne-mcu-bay">
                      <div className="mcu-pcb-socket">
                        <OledDisplayBay
                          shieldId={shield.id}
                          assignedDisplayId={assignedDisplayId}
                          dispInfo={dispInfo}
                          fallbackDisplayDim={fallbackDisplayDim}
                          isHoveredDropTarget={hoveredDisplayDropTarget === shield.id}
                          onDragStart={handleDisplayDragStart}
                          onDragEnd={handleDisplayDragEnd}
                          onDragOver={handleDisplayDragOver}
                          onDragLeave={handleDisplayDragLeave}
                          onDrop={handleDisplayDrop}
                          renderState={blitterRenderState}
                        />
                      </div>
                    </div>

                    {/* Right: Keys Cluster second */}
                    {!isLeft && (
                      <CorneKeysCluster
                        isLeft={false}
                        keymapLayout={keymapLayout}
                        matrix={currentRightMatrix}
                        thumbs={currentRightThumbs}
                        pressedKeys={pressedKeys}
                        onKeyPress={triggerKeyPress}
                        getColStagger={getColStagger}
                      />
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* UNATTACHED DISPLAYS SECTION */}
      <UnattachedDisplaysSection
        unattachedDisplayIds={unattachedDisplayIds}
        getDisplayInfo={getDisplayInfo}
        hoveredUnattachedDrawer={hoveredUnattachedDrawer}
        hasDraggedFromShield={Boolean(draggedDisplay?.fromShieldId)}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          e.dataTransfer.dropEffect = 'move';
          if (!hoveredUnattachedDrawer) setHoveredUnattachedDrawer(true);
        }}
        onDragLeave={() => setHoveredUnattachedDrawer(false)}
        onDrop={handleDropOnUnattachedDrawer}
        onDragStart={(e, screenId) => handleDisplayDragStart(e, undefined, screenId)}
        onDragEnd={handleDisplayDragEnd}
        onAssignDisplay={handleAssignDisplay}
        orderedShields={orderedShields}
        reconciledAssignments={reconciledAssignments}
        renderState={blitterRenderState}
      />

      {/* BOTTOM: REACTIVE FIRMWARE SIMULATOR CONTROLS */}
      <OledSimulationPanel
        isIdle={isIdle}
        onSetIsIdle={setIsIdle}
        outputMode={outputMode}
        onSetOutputMode={setOutputMode}
        bleProfileIndex={bleProfileIndex}
        onSetBleProfileIndex={setBleProfileIndex}
        currentLayer={currentLayer}
        onSetCurrentLayer={setCurrentLayer}
        layerNames={layerNames}
        splitConnected={splitConnected}
        onToggleSplitConnected={() => setSplitConnected(!splitConnected)}
        capsLock={capsLock}
        onToggleCapsLock={() => setCapsLock(!capsLock)}
        randomClickerEnabled={randomClickerEnabled}
        clickerSpeed={clickerSpeed}
        onToggleRandomClicker={() => {
          setRandomClickerEnabled(prev => {
            if (prev) setClickerSpeed(0);
            return !prev;
          });
        }}
        battery={battery}
        onSetBattery={setBattery}
        wpm={wpm}
        onSetWpm={(val) => {
          hadRecentKeystrokesRef.current = false;
          setWpm(val);
        }}
        screenCount={effectiveEnabledScreens.length}
      />
    </div>
  );
};

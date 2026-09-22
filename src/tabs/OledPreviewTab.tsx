import React, { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from 'react';
import { BwpxGrid } from '../pixel/core/PixelGrid';
import type { SpriteSlice, FontGlyph, LayoutBlock, FontCharMapping } from '../types/zmk';
import { Cpu, GripHorizontal, ArrowLeftRight } from 'lucide-react';
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
  onLoadedShieldsChange?: (shields: LoadedShieldUnit[]) => void;
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
  onLoadedShieldsChange: propsOnLoadedShieldsChange,
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
  const storeSetLoadedShields = useLayoutStore((s) => s.setLoadedShields);
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
  const onLoadedShieldsChange = propsOnLoadedShieldsChange ?? storeSetLoadedShields;
  const loadedShields = propsLoadedShields !== undefined
    ? propsLoadedShields
    : (propsShieldId === undefined || propsShieldId === storeShieldId)
      ? storeLoadedShields
      : undefined;

  const [localShieldsOverride, setLocalShieldsOverride] = useState<{ key: string; shields: LoadedShieldUnit[] } | null>(null);
  const currentShieldsKey = `${shieldId}_${loadedShields?.map((s) => s.id).join(',')}`;

  const effectiveShields = useMemo<LoadedShieldUnit[]>(() => {
    if (localShieldsOverride && localShieldsOverride.key === currentShieldsKey) {
      return localShieldsOverride.shields;
    }
    if (loadedShields && loadedShields.length > 0) {
      return loadedShields;
    }
    return getShieldUnitsForShield(shieldId);
  }, [localShieldsOverride, currentShieldsKey, loadedShields, shieldId]);

  const updateLoadedShields = useCallback(
    (newShields: LoadedShieldUnit[]) => {
      if (onLoadedShieldsChange) {
        onLoadedShieldsChange(newShields);
      }
      setLocalShieldsOverride({ key: currentShieldsKey, shields: newShields });
    },
    [onLoadedShieldsChange, currentShieldsKey]
  );

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
    if (!draggedDisplay) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    if (hoveredDisplayDropTarget !== targetShieldId) {
      setHoveredDisplayDropTarget(targetShieldId);
    }
  }, [draggedDisplay, hoveredDisplayDropTarget]);

  const handleDisplayDragLeave = useCallback((e: React.DragEvent, shieldId: string) => {
    if (!draggedDisplay) return;
    const related = e.relatedTarget as HTMLElement | null;
    if (related && (e.currentTarget as HTMLElement).contains(related)) {
      return;
    }
    setHoveredDisplayDropTarget((curr) => (curr === shieldId ? null : curr));
  }, [draggedDisplay]);

  const handleDisplayDrop = useCallback((e: React.DragEvent, targetShieldId: string) => {
    if (!draggedDisplay) return;
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

  // Shield Topology Drag & Drop state (reorder shields purely for user aesthetic preference)
  const [draggedShield, setDraggedShield] = useState<{ shieldId: string; sourceIndex: number } | null>(null);
  const [hoveredShieldDropIndex, setHoveredShieldDropIndex] = useState<number | null>(null);
  const [hoveredShieldWrapperId, setHoveredShieldWrapperId] = useState<string | null>(null);

  // FLIP animation for smooth shield transitions when reordered
  const shieldElementsRef = useRef<Map<string, HTMLElement>>(new Map());
  const previousPositionsRef = useRef<Map<string, number>>(new Map());
  const prevShieldOrderRef = useRef<string>(effectiveShields.map((s) => s.id).join(','));

  const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

  useIsomorphicLayoutEffect(() => {
    const currentOrder = effectiveShields.map((s) => s.id).join(',');
    if (prevShieldOrderRef.current !== currentOrder) {
      shieldElementsRef.current.forEach((el, id) => {
        const prevLeft = previousPositionsRef.current.get(id);
        if (prevLeft !== undefined && el) {
          const currentLeft = el.getBoundingClientRect().left;
          const deltaX = prevLeft - currentLeft;
          if (Math.abs(deltaX) > 1) {
            el.style.transform = `translateX(${deltaX}px)`;
            el.style.transition = 'none';

            requestAnimationFrame(() => {
              el.style.transition = 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)';
              el.style.transform = '';
            });
          }
        }
      });
      prevShieldOrderRef.current = currentOrder;
    }

    shieldElementsRef.current.forEach((el, id) => {
      if (el) {
        previousPositionsRef.current.set(id, el.getBoundingClientRect().left);
      }
    });
  }, [effectiveShields]);

  const handleShieldDragStart = useCallback((e: React.DragEvent, shieldId: string, sourceIndex: number) => {
    e.stopPropagation();
    e.dataTransfer.setData('text/plain', shieldId);
    e.dataTransfer.setData(
      'application/json',
      JSON.stringify({
        type: 'preview-shield',
        shieldId,
        sourceIndex,
      })
    );
    e.dataTransfer.effectAllowed = 'move';

    // Set ghost drag image to the entire shield casing wrapper
    const target = e.currentTarget as HTMLElement | null;
    const wrapper = target?.closest('.preview-shield-wrapper') as HTMLElement | null;
    if (wrapper && e.dataTransfer.setDragImage) {
      const rect = wrapper.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;
      e.dataTransfer.setDragImage(
        wrapper,
        clickX >= 0 && clickX <= rect.width ? clickX : rect.width / 2,
        clickY >= 0 && clickY <= rect.height ? clickY : 12
      );
    }

    setTimeout(() => {
      setDraggedShield({ shieldId, sourceIndex });
    }, 0);
  }, []);

  const handleShieldDragEnd = useCallback(() => {
    setDraggedShield(null);
    setHoveredShieldDropIndex(null);
    setHoveredShieldWrapperId(null);
  }, []);

  const handleShieldDropZoneDragOver = useCallback((e: React.DragEvent, zoneIndex: number) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    if (hoveredShieldDropIndex !== zoneIndex) {
      setHoveredShieldDropIndex(zoneIndex);
    }
  }, [hoveredShieldDropIndex]);

  const handleShieldDropZoneDragEnter = useCallback((e: React.DragEvent, zoneIndex: number) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    setHoveredShieldDropIndex(zoneIndex);
  }, []);

  const handleShieldDropZoneDragLeave = useCallback((e: React.DragEvent, zoneIndex: number) => {
    const related = e.relatedTarget as HTMLElement | null;
    if (related && (e.currentTarget as HTMLElement).contains(related)) {
      return;
    }
    setHoveredShieldDropIndex((curr) => (curr === zoneIndex ? null : curr));
  }, []);

  const handleShieldDropZoneDrop = useCallback((e: React.DragEvent, targetZoneIndex: number) => {
    e.preventDefault();
    e.stopPropagation();
    setHoveredShieldDropIndex(null);

    let sourceIndex = draggedShield?.sourceIndex ?? -1;
    let shieldId = draggedShield?.shieldId;

    const raw = e.dataTransfer.getData('application/json');
    if (raw) {
      try {
        const data = JSON.parse(raw);
        if (data.type === 'preview-shield') {
          shieldId = data.shieldId;
          sourceIndex = data.sourceIndex;
        }
      } catch {}
    }

    setDraggedShield(null);

    if (sourceIndex === -1 || !shieldId) return;
    if (targetZoneIndex === sourceIndex || targetZoneIndex === sourceIndex + 1) return;

    const nextShields = [...effectiveShields];
    const [moved] = nextShields.splice(sourceIndex, 1);
    if (!moved) return;
    const insertAt = sourceIndex < targetZoneIndex ? targetZoneIndex - 1 : targetZoneIndex;
    nextShields.splice(insertAt, 0, moved);

    updateLoadedShields(nextShields);

    const positionName =
      targetZoneIndex === 0
        ? 'the left side'
        : targetZoneIndex === effectiveShields.length
        ? 'the right side'
        : `position ${insertAt + 1}`;
    onShowToast?.('success', `Moved ${moved.name} to ${positionName}`);
  }, [draggedShield, effectiveShields, updateLoadedShields, onShowToast]);

  const handleShieldCaseDragOver = useCallback((e: React.DragEvent, targetShieldId: string) => {
    if (draggedDisplay) {
      handleDisplayDragOver(e, targetShieldId);
    }
  }, [draggedDisplay, handleDisplayDragOver]);

  const handleShieldCaseDragLeave = useCallback((e: React.DragEvent, targetShieldId: string) => {
    if (draggedDisplay) {
      handleDisplayDragLeave(e, targetShieldId);
    }
  }, [draggedDisplay, handleDisplayDragLeave]);

  const handleShieldCaseDrop = useCallback((e: React.DragEvent, targetShieldId: string) => {
    if (draggedDisplay) {
      handleDisplayDrop(e, targetShieldId);
    }
  }, [draggedDisplay, handleDisplayDrop]);

  const isDropZoneActive = useCallback(
    (zoneIndex: number) => {
      if (!draggedShield) return false;
      return (
        zoneIndex !== draggedShield.sourceIndex &&
        zoneIndex !== draggedShield.sourceIndex + 1
      );
    },
    [draggedShield]
  );

  const isDropZoneBalancer = useCallback(
    (zoneIndex: number) => {
      if (!draggedShield) return false;
      if (isDropZoneActive(zoneIndex)) return false;
      const counterpart = effectiveShields.length - zoneIndex;
      return isDropZoneActive(counterpart);
    },
    [draggedShield, effectiveShields.length, isDropZoneActive]
  );

  const renderShieldDropZone = useCallback(
    (zoneIndex: number) => {
      if (!draggedShield) return null;

      const isActive = isDropZoneActive(zoneIndex);
      const isBalancer = isDropZoneBalancer(zoneIndex);

      if (!isActive && !isBalancer) return null;

      const isHovered = isActive && hoveredShieldDropIndex === zoneIndex;

      return (
        <div
          key={`shield-drop-zone-${zoneIndex}`}
          className={`shield-drop-zone relative h-[204px] min-h-[204px] shrink-0 flex flex-col items-center justify-center ${
            isActive ? 'is-active' : 'is-balancer'
          } ${isHovered ? 'is-hovered' : ''}`}
          style={{
            position: 'relative',
            height: '204px',
            minHeight: '204px',
            width: isHovered ? '64px' : '42px',
            maxWidth: isHovered ? '64px' : '42px',
            margin: isHovered ? '0 8px' : '0 4px',
            flexShrink: 0,
            transition:
              'width 0.25s cubic-bezier(0.16, 1, 0.3, 1), max-width 0.25s cubic-bezier(0.16, 1, 0.3, 1), margin 0.25s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.25s ease',
          }}
          onDragEnter={isActive ? (e) => handleShieldDropZoneDragEnter(e, zoneIndex) : undefined}
          onDragOver={isActive ? (e) => handleShieldDropZoneDragOver(e, zoneIndex) : undefined}
          onDragLeave={isActive ? (e) => handleShieldDropZoneDragLeave(e, zoneIndex) : undefined}
          onDrop={isActive ? (e) => handleShieldDropZoneDrop(e, zoneIndex) : undefined}
          data-testid={`shield-drop-zone-${zoneIndex}`}
          title={isActive ? 'Drop shield here' : undefined}
          aria-hidden={!isActive}
        >
          {isActive && (
            <>
              {/* Reliable SVG Dashed Capsule Border (cross-browser pixel-perfect render) */}
              <svg
                className="absolute inset-[1px] w-[calc(100%-2px)] h-[calc(100%-2px)] pointer-events-none overflow-visible"
                xmlns="http://www.w3.org/2000/svg"
              >
                <rect
                  width="100%"
                  height="100%"
                  rx={isHovered ? 31 : 20}
                  fill={isHovered ? 'rgba(0, 240, 255, 0.16)' : 'rgba(0, 240, 255, 0.04)'}
                  stroke="#00f0ff"
                  strokeWidth="2"
                  strokeDasharray="6, 4"
                  strokeOpacity={isHovered ? 1 : 0.85}
                  style={{
                    filter: isHovered
                      ? 'drop-shadow(0 0 8px rgba(0, 240, 255, 0.8))'
                      : 'drop-shadow(0 0 3px rgba(0, 240, 255, 0.35))',
                    transition: 'all 0.2s ease',
                  }}
                />
              </svg>

              <ArrowLeftRight
                size={isHovered ? 22 : 18}
                className={`relative z-10 transition-all shrink-0 ${
                  isHovered
                    ? 'text-[#00f0ff] scale-110 drop-shadow-[0_0_8px_rgba(0,240,255,0.8)]'
                    : 'text-[#00f0ff]/80'
                }`}
              />
            </>
          )}
        </div>
      );
    },
    [
      draggedShield,
      isDropZoneActive,
      isDropZoneBalancer,
      hoveredShieldDropIndex,
      handleShieldDropZoneDragEnter,
      handleShieldDropZoneDragOver,
      handleShieldDropZoneDragLeave,
      handleShieldDropZoneDrop,
    ]
  );

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
        <div className="flex items-center justify-center gap-0 pt-10 pb-4 my-2 relative">
          {renderShieldDropZone(0)}
          {orderedShields.map((shield, index) => {
            const assignedDisplayId = reconciledAssignments[shield.id];
            const dispInfo = getDisplayInfo(assignedDisplayId);

            const isShieldHovered = hoveredShieldWrapperId === shield.id;

            return (
              <React.Fragment key={shield.id}>
                <div
                  ref={(el) => {
                    if (el) shieldElementsRef.current.set(shield.id, el);
                    else shieldElementsRef.current.delete(shield.id);
                  }}
                  className={`preview-shield-wrapper group/shield relative flex flex-col items-center transition-all ${
                    draggedShield?.shieldId === shield.id
                      ? 'opacity-50'
                      : (draggedDisplay && hoveredDisplayDropTarget === shield.id)
                      ? 'ring-2 ring-[#00f0ff] shadow-[0_0_24px_rgba(0,240,255,0.4)] rounded-2xl'
                      : ''
                  }`}
                  onMouseEnter={() => setHoveredShieldWrapperId(shield.id)}
                  onMouseLeave={() => setHoveredShieldWrapperId((curr) => (curr === shield.id ? null : curr))}
                  onDragOver={(e) => handleShieldCaseDragOver(e, shield.id)}
                  onDragLeave={(e) => handleShieldCaseDragLeave(e, shield.id)}
                  onDrop={(e) => handleShieldCaseDrop(e, shield.id)}
                >
                  {/* Shield Drag Handle (Only visible on shield hover) */}
                  <div
                    className={`preview-shield-drag-handle group/handle cursor-grab active:cursor-grabbing select-none transition-opacity duration-150 ${
                      isShieldHovered ? 'is-visible' : ''
                    }`}
                    style={{
                      opacity: isShieldHovered ? 1 : 0,
                      pointerEvents: isShieldHovered ? 'auto' : 'none',
                    }}
                    draggable={true}
                    onDragStart={(e) => handleShieldDragStart(e, shield.id, index)}
                    onDragEnd={handleShieldDragEnd}
                    title={`Drag to reposition ${shield.name}`}
                    data-testid={`shield-drag-handle-${shield.id}`}
                  >
                    <GripHorizontal size={22} className="shrink-0 text-[#00f0ff] group-hover/handle:text-[#ffffff] pointer-events-none" />
                  </div>

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
                        isHoveredDropTarget={Boolean(draggedDisplay) && hoveredDisplayDropTarget === shield.id}
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

                {renderShieldDropZone(index + 1)}
              </React.Fragment>
            );
          })}
        </div>
      ) : (
        <div className="corne-keyboard-split">
          {renderShieldDropZone(0)}
          {orderedShields.map((shield, index) => {
            const assignedDisplayId = reconciledAssignments[shield.id];
            const dispInfo = getDisplayInfo(assignedDisplayId);
            const isLeft = shield.side === 'left' || shield.isMaster;
            const fallbackDisplayDim = isLeft ? leftDisplayDim : rightDisplayDim;

            const isShieldHovered = hoveredShieldWrapperId === shield.id;

            return (
              <React.Fragment key={shield.id}>
                <div
                  ref={(el) => {
                    if (el) shieldElementsRef.current.set(shield.id, el);
                    else shieldElementsRef.current.delete(shield.id);
                  }}
                  className={`preview-shield-wrapper group/shield relative flex flex-col items-center transition-all ${
                    draggedShield?.shieldId === shield.id
                      ? 'opacity-50'
                      : (draggedDisplay && hoveredDisplayDropTarget === shield.id)
                      ? 'ring-2 ring-[#00f0ff] shadow-[0_0_24px_rgba(0,240,255,0.4)] rounded-2xl'
                      : ''
                  }`}
                  onMouseEnter={() => setHoveredShieldWrapperId(shield.id)}
                  onMouseLeave={() => setHoveredShieldWrapperId((curr) => (curr === shield.id ? null : curr))}
                  onDragOver={(e) => handleShieldCaseDragOver(e, shield.id)}
                  onDragLeave={(e) => handleShieldCaseDragLeave(e, shield.id)}
                  onDrop={(e) => handleShieldCaseDrop(e, shield.id)}
                >
                  {/* Shield Drag Handle (Only visible on shield hover) */}
                  <div
                    className={`preview-shield-drag-handle group/handle cursor-grab active:cursor-grabbing select-none transition-opacity duration-150 ${
                      isShieldHovered ? 'is-visible' : ''
                    }`}
                    style={{
                      opacity: isShieldHovered ? 1 : 0,
                      pointerEvents: isShieldHovered ? 'auto' : 'none',
                    }}
                    draggable={true}
                    onDragStart={(e) => handleShieldDragStart(e, shield.id, index)}
                    onDragEnd={handleShieldDragEnd}
                    title={`Drag to reposition ${shield.name}`}
                    data-testid={`shield-drag-handle-${shield.id}`}
                  >
                    <GripHorizontal size={22} className="shrink-0 text-[#00f0ff] group-hover/handle:text-[#ffffff] pointer-events-none" />
                  </div>

                  {shield.side === 'dongle' ? (
                    <div className="dongle-unit-case">
                      <div className="dongle-usb-connector">
                        <div className="dongle-usb-metal">
                          <div className="dongle-usb-pin" />
                          <div className="dongle-usb-pin" />
                        </div>
                      </div>
                      <div className="dongle-body">
                        <div className="dongle-header-badge">
                          <span className="live-dot" />
                          <span>{shield.name}</span>
                        </div>
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
                          fallbackDisplayDim={fallbackDisplayDim}
                          isHoveredDropTarget={Boolean(draggedDisplay) && hoveredDisplayDropTarget === shield.id}
                          onDragStart={handleDisplayDragStart}
                          onDragEnd={handleDisplayDragEnd}
                          onDragOver={handleDisplayDragOver}
                          onDragLeave={handleDisplayDragLeave}
                          onDrop={handleDisplayDrop}
                          renderState={blitterRenderState}
                        />
                      </div>
                    </div>
                  ) : (
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
                              isHoveredDropTarget={Boolean(draggedDisplay) && hoveredDisplayDropTarget === shield.id}
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
                  )}
                </div>

                {renderShieldDropZone(index + 1)}
              </React.Fragment>
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

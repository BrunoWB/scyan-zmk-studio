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
} from 'lucide-react';
import type { GitHubRepoConfig, GitHubConnectionState } from '../services/githubService';
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
  normalizeWidgetType,
  getWidgetDefinition,
  getWidgetNaturalSize,
  resolveWidgetInstance,
} from '../services/widgetRegistry';
import {
  DEFAULT_LEFT_LAYOUT_BLOCKS,
  DEFAULT_RIGHT_LAYOUT_BLOCKS,
  DEFAULT_IDLE_LEFT_BLOCKS,
  DEFAULT_IDLE_RIGHT_BLOCKS,
} from '../types/zmk';

const BLOCK_COLORS: Record<string, string> = {
  'status-bar': '#38bdf8',
  'battery': '#4ade80',
  'connection': '#60a5fa',
  'split': '#2dd4bf',
  'layer-banner': '#c084fc',
  'layer-art': '#34d399',
  'wpm': '#fbbf24',
  'branding': '#f472b6',
  'screensaver': '#38bdf8',
  'bongo': '#f472b6',
  'caps-lock': '#fb7185',
  'animation': '#a855f7',
  'loop': '#a855f7',
};

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
  rightScreenDimensions?: { width: number; height: number };
  symmetricSettings?: boolean;
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

export const OledPreviewTab: React.FC<OledPreviewTabProps> = ({
  symbolsGrid,
  symbolSlices,
  fontGrid,
  fontGlyphs = [],
  fontMappings = [],
  leftBlocks,
  rightBlocks,
  layoutBlocks,
  idleLeftBlocks,
  idleRightBlocks,
  onLeftBlocksChange,
  onRightBlocksChange,
  onIdleLeftBlocksChange,
  onIdleRightBlocksChange,
  screenDimensions,
  rightScreenDimensions,
  symmetricSettings,
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
  const activeLeftBlocks = leftBlocks ?? layoutBlocks ?? DEFAULT_LEFT_LAYOUT_BLOCKS;
  const activeRightBlocks = rightBlocks ?? DEFAULT_RIGHT_LAYOUT_BLOCKS;

  // Virtual screen dimensions per side
  const leftVWidth = screenDimensions?.width || 32;
  const leftVHeight = screenDimensions?.height || 128;
  const effectiveSymmetric = symmetricSettings !== undefined ? symmetricSettings : true;
  const rightVWidth = (effectiveSymmetric ? leftVWidth : rightScreenDimensions?.width) || 32;
  const rightVHeight = (effectiveSymmetric ? leftVHeight : rightScreenDimensions?.height) || 128;

  // Proportional display dimensions in px for housing and canvas
  const leftDisplayDim = useMemo(() => getOledDisplayDimensions(leftVWidth, leftVHeight), [leftVWidth, leftVHeight]);
  const rightDisplayDim = useMemo(() => getOledDisplayDimensions(rightVWidth, rightVHeight), [rightVWidth, rightVHeight]);

  // Simulator states
  const [isIdle, setIsIdle] = useState<boolean>(false);

  // Active blocks according to idle/active mode
  const leftDisplayBlocks = isIdle
    ? (idleLeftBlocks && idleLeftBlocks.length > 0 ? idleLeftBlocks : DEFAULT_IDLE_LEFT_BLOCKS)
    : activeLeftBlocks;

  const rightDisplayBlocks = isIdle
    ? (idleRightBlocks && idleRightBlocks.length > 0 ? idleRightBlocks : DEFAULT_IDLE_RIGHT_BLOCKS)
    : activeRightBlocks;

  // Direct widget manipulation state
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [internalDraggingBlockId, setInternalDraggingBlockId] = useState<string | null>(null);
  const [hoveredSide, setHoveredSide] = useState<'left' | 'right' | null>(null);
  const dragStartXRef = useRef<number>(0);
  const dragStartYRef = useRef<number>(0);
  const blockInitialXRef = useRef<number>(0);
  const blockInitialYRef = useRef<number>(0);
  const draggingSideRef = useRef<'left' | 'right'>('left');
  const leftScreenContainerRef = useRef<HTMLDivElement | null>(null);
  const rightScreenContainerRef = useRef<HTMLDivElement | null>(null);

  const handleStartMoveBlock = (e: React.PointerEvent, block: LayoutBlock, side: 'left' | 'right') => {
    e.stopPropagation();
    setSelectedBlockId(block.id);
    setInternalDraggingBlockId(block.id);
    draggingSideRef.current = side;
    dragStartXRef.current = e.clientX;
    dragStartYRef.current = e.clientY;
    const def = getWidgetDefinition(block.widgetType || block.id);
    blockInitialXRef.current = block.x ?? def?.defaultPlacement.defaultX ?? 0;
    blockInitialYRef.current = block.y;
  };

  // Window listeners for moving widgets
  useEffect(() => {
    if (!internalDraggingBlockId) return;

    const side = draggingSideRef.current;
    const isLeft = side === 'left';
    const container = isLeft ? leftScreenContainerRef.current : rightScreenContainerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const screenWidthPx = rect.width || 48;
    const screenHeightPx = rect.height || 192;
    const vWidth = isLeft ? leftVWidth : rightVWidth;
    const vHeight = isLeft ? leftVHeight : rightVHeight;
    const pxToGridX = vWidth / screenWidthPx;
    const pxToGridY = vHeight / screenHeightPx;

    const handlePointerMove = (e: PointerEvent) => {
      const deltaScreenX = e.clientX - dragStartXRef.current;
      const deltaScreenY = e.clientY - dragStartYRef.current;
      const deltaGridX = Math.round(deltaScreenX * pxToGridX);
      const deltaGridY = Math.round(deltaScreenY * pxToGridY);

      const blockList = isLeft ? leftDisplayBlocks : rightDisplayBlocks;
      const currentBlock = blockList.find(b => b.id === internalDraggingBlockId);
      if (!currentBlock) return;

      const normType = normalizeWidgetType(currentBlock.widgetType || currentBlock.id);
      const def = getWidgetDefinition(normType);
      const activeInstance = resolveWidgetInstance(instances, normType, currentBlock.instanceId);
      const naturalSize = def ? getWidgetNaturalSize(def, symbolSlices, activeInstance, fontGlyphs, fontMappings) : null;
      const blockW = naturalSize ? naturalSize.width : (currentBlock.width ?? def?.defaultWidth ?? vWidth);
      const blockH = naturalSize ? naturalSize.height : currentBlock.height;

      const newX = Math.max(0, Math.min(vWidth - blockW, blockInitialXRef.current + deltaGridX));
      const newY = Math.max(0, Math.min(vHeight - blockH, blockInitialYRef.current + deltaGridY));

      if (newX !== currentBlock.x || newY !== currentBlock.y) {
        const updated = blockList.map(b => b.id === internalDraggingBlockId ? { ...b, x: newX, y: newY } : b);
        if (isLeft) {
          if (isIdle) {
            onIdleLeftBlocksChange?.(updated);
          } else {
            onLeftBlocksChange?.(updated);
          }
        } else {
          if (isIdle) {
            onIdleRightBlocksChange?.(updated);
          } else {
            onRightBlocksChange?.(updated);
          }
        }
      }
    };

    const handlePointerUp = () => {
      setInternalDraggingBlockId(null);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [
    internalDraggingBlockId,
    isIdle,
    leftVWidth,
    leftVHeight,
    rightVWidth,
    rightVHeight,
    leftDisplayBlocks,
    rightDisplayBlocks,
    onLeftBlocksChange,
    onRightBlocksChange,
    onIdleLeftBlocksChange,
    onIdleRightBlocksChange,
    instances,
    symbolSlices,
    fontGlyphs,
    fontMappings,
  ]);
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

  // Render both Left (Master) and Right (Peripheral) OLED displays
  useEffect(() => {
    const PIXEL_PITCH = 2; // Crisp dot simulation
    const DOT_SIZE = 1.6;
    const onColor = '#e2f1ff';

    // 1. RENDER LEFT (MASTER) DISPLAY
    const leftCanvas = leftCanvasRef.current;
    if (leftCanvas) {
      const ctx = leftCanvas.getContext('2d');
      if (ctx) {
        const vbuf = new BwpxGrid(leftVWidth, leftVHeight);
        renderBlocksToGrid(leftDisplayBlocks, vbuf, {
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
          side: 'left',
          isIdle,
          customizations,
          bongoState,
          animationTimestamp: animTimestamp,
        });

        leftCanvas.width = leftVWidth * PIXEL_PITCH;
        leftCanvas.height = leftVHeight * PIXEL_PITCH;

        ctx.fillStyle = '#05070a';
        ctx.fillRect(0, 0, leftCanvas.width, leftCanvas.height);

        ctx.fillStyle = onColor;
        for (let y = 0; y < leftVHeight; y++) {
          for (let x = 0; x < leftVWidth; x++) {
            if (vbuf.get(x, y)) {
              ctx.fillRect(x * PIXEL_PITCH, y * PIXEL_PITCH, DOT_SIZE, DOT_SIZE);
            }
          }
        }
      }
    }

    // 2. RENDER RIGHT (PERIPHERAL) DISPLAY
    const rightCanvas = rightCanvasRef.current;
    if (rightCanvas) {
      const ctx = rightCanvas.getContext('2d');
      if (ctx) {
        const vbuf = new BwpxGrid(rightVWidth, rightVHeight);
        renderBlocksToGrid(rightDisplayBlocks, vbuf, {
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
          side: 'right',
          isIdle,
          customizations,
          bongoState,
          animationTimestamp: animTimestamp,
        });

        rightCanvas.width = rightVWidth * PIXEL_PITCH;
        rightCanvas.height = rightVHeight * PIXEL_PITCH;

        ctx.fillStyle = '#05070a';
        ctx.fillRect(0, 0, rightCanvas.width, rightCanvas.height);

        ctx.fillStyle = onColor;
        for (let y = 0; y < rightVHeight; y++) {
          for (let x = 0; x < rightVWidth; x++) {
            if (vbuf.get(x, y)) {
              ctx.fillRect(x * PIXEL_PITCH, y * PIXEL_PITCH, DOT_SIZE, DOT_SIZE);
            }
          }
        }
      }
    }
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
  ]);

  const renderBlockOverlay = (
    block: LayoutBlock,
    side: 'left' | 'right',
    vWidth: number,
    vHeight: number
  ) => {
    const normType = normalizeWidgetType(block.widgetType || block.id);
    const def = getWidgetDefinition(normType);
    const color = BLOCK_COLORS[normType] || '#00d2ff';
    const isSelected = selectedBlockId === block.id;
    const isDragging = internalDraggingBlockId === block.id;
    const isScreenHovered = hoveredSide === side || internalDraggingBlockId !== null;
    if (!block.enabled) return null;

    const activeInstance = resolveWidgetInstance(instances, normType, block.instanceId);
    const naturalSize = def ? getWidgetNaturalSize(def, symbolSlices, activeInstance, fontGlyphs, fontMappings) : null;

    const blockX = block.x ?? def?.defaultPlacement.defaultX ?? 0;
    const blockW = naturalSize ? naturalSize.width : (block.width ?? def?.defaultWidth ?? vWidth);
    const blockH = naturalSize ? naturalSize.height : block.height;

    const leftPct = (blockX / vWidth) * 100;
    const topPct = (block.y / vHeight) * 100;
    const widthPct = (blockW / vWidth) * 100;
    const heightPct = (blockH / vHeight) * 100;

    return (
      <div
        key={block.id}
        className={`oled-block-overlay ${isSelected ? 'selected' : ''} ${isDragging ? 'dragging' : ''}`}
        style={{
          position: 'absolute',
          left: `${leftPct}%`,
          top: `${topPct}%`,
          width: `${widthPct}%`,
          height: `${heightPct}%`,
          '--block-color': color,
          opacity: isScreenHovered ? 1 : 0,
          pointerEvents: 'auto',
          transition: 'opacity 0.15s ease',
        } as React.CSSProperties}
        onPointerDown={e => handleStartMoveBlock(e, block, side)}
        onClick={e => {
          e.stopPropagation();
          setSelectedBlockId(block.id);
        }}
        title={`${block.name || def?.name || 'Widget'} — Drag to reposition (x:${blockX}, y:${block.y})`}
      >
        {isSelected && isScreenHovered && (
          <span className="block-overlay-label" style={{ color }}>
            {block.name || def?.name}
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="oled-preview-fullscreen">
      {/* =========================================================================
          TOP: CUTE MINIMALIST CORNE 5X3 SPLIT VISUALIZATION WITH DUAL DISPLAYS
          ========================================================================= */}
      <div className="corne-keyboard-split">
          {/* LEFT HALF (MASTER) */}
          <div className="corne-half-case left-half">
            <div className="half-inner-layout">
              {/* Keys Cluster (Matrix + Thumbs tight underneath) */}
              <div className="corne-keys-cluster">
                {/* Dynamic Columns Matrix */}
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

                {/* Thumb Keys Cluster */}
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

              {/* OLED Display (Inner Side) */}
              <div className="corne-mcu-bay">
                <div className="mcu-pcb-socket">
                  <div
                    className="oled-glass-housing"
                    style={{
                      width: `${leftDisplayDim.displayW + OLED_BORDER_UNITS * 2}px`,
                      height: `${leftDisplayDim.displayH + OLED_BORDER_UNITS * 2}px`,
                    }}
                    onMouseEnter={() => setHoveredSide('left')}
                    onMouseLeave={() => setHoveredSide(null)}
                    onClick={() => setSelectedBlockId(null)}
                  >
                    <div
                      ref={leftScreenContainerRef}
                      style={{
                        position: 'relative',
                        width: `${leftDisplayDim.displayW}px`,
                        height: `${leftDisplayDim.displayH}px`,
                      }}
                    >
                      <canvas
                        ref={leftCanvasRef}
                        className="corne-oled-canvas"
                        style={{
                          width: `${leftDisplayDim.displayW}px`,
                          height: `${leftDisplayDim.displayH}px`,
                          display: 'block',
                        }}
                      />
                      <div className={`oled-block-overlays-container oled-preview-overlays ${internalDraggingBlockId ? 'is-dragging' : ''}`}>
                        {leftDisplayBlocks.map(block =>
                          renderBlockOverlay(block, 'left', leftVWidth, leftVHeight)
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT HALF (PERIPHERAL) */}
          <div className="corne-half-case right-half">
            <div className="half-inner-layout mirrored">
              {/* OLED Display (Inner Side) */}
              <div className="corne-mcu-bay">
                <div className="mcu-pcb-socket">
                  <div
                    className="oled-glass-housing"
                    style={{
                      width: `${rightDisplayDim.displayW + OLED_BORDER_UNITS * 2}px`,
                      height: `${rightDisplayDim.displayH + OLED_BORDER_UNITS * 2}px`,
                    }}
                    onMouseEnter={() => setHoveredSide('right')}
                    onMouseLeave={() => setHoveredSide(null)}
                    onClick={() => setSelectedBlockId(null)}
                  >
                    <div
                      ref={rightScreenContainerRef}
                      style={{
                        position: 'relative',
                        width: `${rightDisplayDim.displayW}px`,
                        height: `${rightDisplayDim.displayH}px`,
                      }}
                    >
                      <canvas
                        ref={rightCanvasRef}
                        className="corne-oled-canvas"
                        style={{
                          width: `${rightDisplayDim.displayW}px`,
                          height: `${rightDisplayDim.displayH}px`,
                          display: 'block',
                        }}
                      />
                      <div className={`oled-block-overlays-container oled-preview-overlays ${internalDraggingBlockId ? 'is-dragging' : ''}`}>
                        {rightDisplayBlocks.map(block =>
                          renderBlockOverlay(block, 'right', rightVWidth, rightVHeight)
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Keys Cluster (Matrix + Thumbs tight underneath) */}
              <div className="corne-keys-cluster">
                {/* Dynamic Columns Matrix */}
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

                {/* Thumb Keys Cluster */}
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
            </div>
          </div>
        </div>

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
            <span className="badge-mode">Dual Display Sync</span>
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

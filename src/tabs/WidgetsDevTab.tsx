import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { BwpxGrid } from '../pixel/core/PixelGrid';
import type { SpriteSlice, FontGlyph, FontCharMapping, LayoutBlock } from '../types/zmk';
import type { WidgetInstanceMap, WidgetInstance, TypewriterState, KeypressState } from '../types/widget';
import {
  WIDGET_REGISTRY,
  getWidgetDefinition,
  getWidgetNaturalSize,
  normalizeWidgetType,
  createDefaultWidgetInstance,
} from '../services/widgetRegistry';
import { OledDisplayModule } from '../components/OledDisplayModule';
import { OledSimulationPanel } from './preview/OledSimulationPanel';
import {
  getNextClickerAction,
  getKeystrokeIntervalMs,
} from '../services/wpmSimulator';
import {
  Search,
  RotateCw,
  ExternalLink,
  Layers,
  Sparkles,
  Activity,
  Battery,
  Wifi,
  Link2,
  Gauge,
  Type,
  Cat,
  Film,
  Keyboard,
} from 'lucide-react';
import { useAtlasStore } from '../stores/useAtlasStore';
import { useLayoutStore } from '../stores/useLayoutStore';
import { useUiStore } from '../stores/useUiStore';

const WIDGET_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  activity: Activity,
  battery: Battery,
  wifi: Wifi,
  link: Link2,
  layers: Layers,
  sparkles: Sparkles,
  gauge: Gauge,
  type: Type,
  cat: Cat,
  film: Film,
  keyboard: Keyboard,
};

export interface WidgetsDevTabProps {
  symbolsGrid?: BwpxGrid;
  symbolSlices?: SpriteSlice[];
  fontGrid?: BwpxGrid;
  fontGlyphs?: FontGlyph[];
  fontMappings?: FontCharMapping[];
  instances?: WidgetInstanceMap;
  customText?: string;
  onNavigateToWidgets?: (widgetId?: string) => void;
}

export const WidgetsDevTab: React.FC<WidgetsDevTabProps> = ({
  symbolsGrid: propSymbolsGrid,
  symbolSlices: propSymbolSlices,
  fontGrid: propFontGrid,
  fontGlyphs: propFontGlyphs,
  fontMappings: propFontMappings,
  instances: propInstances,
  customText: propCustomText,
  onNavigateToWidgets,
}) => {
  // Store integration with fallbacks
  const storeSymbolsGrid = useAtlasStore((s) => s.symbolsGrid);
  const storeSymbolSlices = useAtlasStore((s) => s.symbolSlices);
  const storeFontGrid = useAtlasStore((s) => s.fontGrid);
  const storeFontGlyphs = useAtlasStore((s) => s.fontGlyphs);
  const storeFontMappings = useAtlasStore((s) => s.fontMappings);

  const storeInstances = useLayoutStore((s) => s.widgetInstances);
  const storeCustomText = useUiStore((s) => s.customText);
  const setActiveTab = useUiStore((s) => s.setActiveTab);

  const symbolsGrid = propSymbolsGrid || storeSymbolsGrid;
  const symbolSlices = propSymbolSlices || storeSymbolSlices;
  const fontGrid = propFontGrid || storeFontGrid;
  const fontGlyphs = propFontGlyphs || storeFontGlyphs;
  const fontMappings = propFontMappings || storeFontMappings;
  const instances = propInstances || storeInstances;
  const customText = propCustomText || storeCustomText;

  // Viewport & layout options
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'status' | 'typing' | 'art'>('all');
  const [orientation, setOrientation] = useState<'horizontal' | 'vertical'>('horizontal');
  const [displayScale, setDisplayScale] = useState<number>(1.25);

  const screenWidth = orientation === 'horizontal' ? 128 : 32;
  const screenHeight = orientation === 'horizontal' ? 32 : 128;

  // =========================================================================
  // SIMULATION STATE (Matching OledSimulationPanel)
  // =========================================================================
  const [isIdle, setIsIdle] = useState<boolean>(false);
  const [outputMode, setOutputMode] = useState<'usb' | 'ble'>('usb');
  const [bleProfileIndex, setBleProfileIndex] = useState<number>(0);
  const [battery, setBattery] = useState<number>(85);
  const [currentLayer, setCurrentLayer] = useState<number>(0);
  const layerNames = useMemo(() => ['DEFAULT', 'LOWER', 'RAISE', 'NAV', 'NUM'], []);
  const [splitConnected, setSplitConnected] = useState<boolean>(true);
  const [capsLock, setCapsLock] = useState<boolean>(false);
  const [wpm, setWpm] = useState<number>(64);
  const [wpmHistory, setWpmHistory] = useState<number[]>(() => Array(128).fill(0));
  const [randomClickerEnabled, setRandomClickerEnabled] = useState<boolean>(true);
  const [clickerSpeed, setClickerSpeed] = useState<number>(0);

  // WPM History Ticker (1Hz)
  const wpmRef = useRef(wpm);
  useEffect(() => {
    wpmRef.current = wpm;
  }, [wpm]);

  useEffect(() => {
    const timer = setInterval(() => {
      setWpmHistory((prev) => [...prev.slice(1), wpmRef.current]);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Bongo Cat Tap state
  const [bongoState, setBongoState] = useState<0 | 1 | 2>(0);
  const bongoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTapTimeRef = useRef<number>(0);

  const triggerBongoTap = useCallback((isLeft: boolean) => {
    const now = Date.now();
    if (now - lastTapTimeRef.current < 90) return;
    lastTapTimeRef.current = now;

    setBongoState(isLeft ? 1 : 2);
    if (bongoTimerRef.current) clearTimeout(bongoTimerRef.current);
    bongoTimerRef.current = setTimeout(() => {
      setBongoState(0);
      bongoTimerRef.current = null;
    }, 60);
  }, []);

  // Typewriter state
  const [typewriterText, setTypewriterText] = useState<string>('TYPEWRITER ');
  const [typewriterState, setTypewriterState] = useState<TypewriterState>(() => {
    const now = Date.now();
    return {
      text: 'TYPEWRITER ',
      lastChar: 'R',
      lastTimestamp: now,
      randomX: 0.25,
      randomY: 0.25,
      randomLetters: [
        { char: 'T', x: 0.1, y: 0.15, fontSize: 'big', timestamp: now },
        { char: 'Y', x: 0.35, y: 0.45, fontSize: 'small', timestamp: now },
        { char: 'P', x: 0.6, y: 0.1, fontSize: 'big', timestamp: now },
        { char: 'E', x: 0.8, y: 0.6, fontSize: 'small', timestamp: now },
        { char: 'R', x: 0.25, y: 0.85, fontSize: 'big', timestamp: now },
      ],
      randomBank: [
        { char: 'T', x: 0.1, y: 0.15, fontSize: 'big', timestamp: now },
        { char: 'Y', x: 0.35, y: 0.45, fontSize: 'small', timestamp: now },
        { char: 'P', x: 0.6, y: 0.1, fontSize: 'big', timestamp: now },
        { char: 'E', x: 0.8, y: 0.6, fontSize: 'small', timestamp: now },
        { char: 'R', x: 0.25, y: 0.85, fontSize: 'big', timestamp: now },
      ],
      letterBank: [
        { char: 'T', x: 0.1, y: 0.15, fontSize: 'big', timestamp: now },
        { char: 'Y', x: 0.35, y: 0.45, fontSize: 'small', timestamp: now },
        { char: 'P', x: 0.6, y: 0.1, fontSize: 'big', timestamp: now },
        { char: 'E', x: 0.8, y: 0.6, fontSize: 'small', timestamp: now },
        { char: 'R', x: 0.25, y: 0.85, fontSize: 'big', timestamp: now },
      ],
    };
  });

  const handleTypewriterInput = useCallback((keyOrChar: string) => {
    const now = Date.now();
    const rx = Math.random();
    const ry = Math.random();

    if (keyOrChar === 'Backspace' || keyOrChar === 'BSPC' || keyOrChar === 'BACKSPACE') {
      setTypewriterText((prev) => {
        const next = prev.slice(0, -1);
        setTypewriterState((s) => {
          const currentBank = s.letterBank || s.randomLetters || s.randomBank || [];
          const nextBank = currentBank.slice(0, -1);
          return {
            ...s,
            text: next,
            lastTimestamp: now,
            letterBank: nextBank,
            randomLetters: nextBank,
            randomBank: nextBank,
          };
        });
        return next;
      });
      return;
    }

    let ch: string | null = null;
    if (keyOrChar === ' ' || keyOrChar === 'Space' || keyOrChar === 'SPC' || keyOrChar === 'Enter') {
      ch = ' ';
    } else if (keyOrChar.length === 1) {
      ch = keyOrChar.toUpperCase();
    }

    if (!ch) return;
    const charToAdd = ch;

    setTypewriterText((prev) => {
      const next = (prev + charToAdd).slice(-60);
      setTypewriterState((s) => {
        const surviving = s.letterBank || s.randomLetters || s.randomBank || [];
        const chosenSize: 'small' | 'big' = Math.random() < 0.5 ? 'small' : 'big';
        const nextLetters: import('../types/widget').TypewriterRandomLetter[] = [
          ...surviving,
          { char: charToAdd, x: rx, y: ry, fontSize: chosenSize, timestamp: now },
        ].slice(-24);
        return {
          text: next,
          lastChar: charToAdd,
          lastTimestamp: now,
          randomX: rx,
          randomY: ry,
          letterBank: nextLetters,
          randomLetters: nextLetters,
          randomBank: nextLetters,
        };
      });
      return next;
    });
  }, []);

  // Keypress tracking
  const [activeKeys, setActiveKeys] = useState<string[]>([]);
  const [lastKey, setLastKey] = useState<string>('');
  const keypressStateRef = useRef<KeypressState>({});

  useEffect(() => {
    keypressStateRef.current.activeKeys = activeKeys;
    keypressStateRef.current.lastKey = lastKey;
  }, [activeKeys, lastKey]);

  // Random Clicker Simulator Loop
  useEffect(() => {
    if (!randomClickerEnabled) return;
    let isMounted = true;
    let timerId: ReturnType<typeof setTimeout> | null = null;

    const sampleKeys = ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P', 'A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'SPC', 'BSPC', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];

    let burstState = getNextClickerAction(false);

    const step = () => {
      if (!isMounted) return;

      if (burstState.isStalled) {
        burstState = getNextClickerAction(true);
        setClickerSpeed(burstState.targetWpm);
      }

      if (burstState.burstLength > 0) {
        setWpm(Math.round(burstState.targetWpm));
        const key = sampleKeys[Math.floor(Math.random() * sampleKeys.length)];
        const isLeft = Math.random() < 0.5;

        triggerBongoTap(isLeft);
        handleTypewriterInput(key);
        setLastKey(key);
        setActiveKeys([key]);

        setTimeout(() => {
          if (isMounted) setActiveKeys([]);
        }, 120);

        burstState.burstLength--;
        const interval = getKeystrokeIntervalMs(burstState.targetWpm);
        timerId = setTimeout(step, interval);
      } else {
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
  }, [randomClickerEnabled, triggerBongoTap, handleTypewriterInput]);

  // Physical keyboard key listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      const k = e.key;
      triggerBongoTap(Math.random() < 0.5);
      handleTypewriterInput(k);
      setLastKey(k);
      setActiveKeys((prev) => (prev.includes(k) ? prev : [...prev, k]));
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      const k = e.key;
      setActiveKeys((prev) => prev.filter((item) => item !== k));
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [triggerBongoTap, handleTypewriterInput]);

  // =========================================================================
  // COLLECT ALL WIDGET INSTANCES
  // =========================================================================
  interface DisplayCardItem {
    instance: WidgetInstance;
    def: ReturnType<typeof getWidgetDefinition>;
    tier: number;
    category: string;
    naturalSize: { width: number; height: number };
    block: LayoutBlock;
  }

  const allDisplayItems: DisplayCardItem[] = useMemo(() => {
    const items: DisplayCardItem[] = [];
    const seenTypeIds = new Set<string>();

    WIDGET_REGISTRY.forEach((w) => {
      // Deduplicate loop and animation aliases
      if (w.id === 'loop' && seenTypeIds.has('animation')) return;
      if (w.id === 'animation' && seenTypeIds.has('loop')) return;
      seenTypeIds.add(w.id);

      const normType = normalizeWidgetType(w.id);
      const rawInstList = instances?.[w.id] || instances?.[normType];
      const instList =
        rawInstList && rawInstList.length > 0
          ? rawInstList
          : [createDefaultWidgetInstance(w.id, symbolSlices)];

      instList.forEach((inst) => {
        const naturalSize = getWidgetNaturalSize(
          w,
          symbolSlices,
          inst,
          fontGlyphs,
          fontMappings
        ) || { width: w.defaultWidth, height: w.defaultHeight };

        // Determine block dimensions and center on screen
        const isDynamic = normType === 'wpm-chart' || normType === 'typewriter';
        let blockW = naturalSize.width;
        let blockH = naturalSize.height;

        if (isDynamic) {
          if (normType === 'wpm-chart') {
            blockW = Math.min(screenWidth, inst.config?.wpmChart?.width || naturalSize.width || 32);
            blockH = Math.min(screenHeight, inst.config?.wpmChart?.height || naturalSize.height || 24);
          } else if (normType === 'typewriter') {
            blockW = Math.min(screenWidth, inst.config?.typewriterWidth || naturalSize.width || 32);
            blockH = Math.min(screenHeight, inst.config?.typewriterHeight || naturalSize.height || 32);
          }
        }

        // Center on screen
        const destX = Math.max(0, Math.floor((screenWidth - blockW) / 2));
        const destY = Math.max(0, Math.floor((screenHeight - blockH) / 2));

        const block: LayoutBlock = {
          id: `dev-${inst.id}`,
          name: inst.label || w.name,
          widgetType: normType,
          instanceId: inst.id,
          enabled: true,
          x: destX,
          y: destY,
          width: blockW,
          height: blockH,
        };

        items.push({
          instance: inst,
          def: w,
          tier: w.tier,
          category: w.category,
          naturalSize,
          block,
        });
      });
    });

    return items;
  }, [instances, symbolSlices, fontGlyphs, fontMappings, screenWidth, screenHeight]);

  // Filter items
  const filteredDisplayItems = useMemo(() => {
    return allDisplayItems.filter((item) => {
      // Category filter
      if (selectedCategory === 'status' && item.category !== 'status') return false;
      if (selectedCategory === 'typing' && item.category !== 'typing' && item.category !== 'layer') return false;
      if (selectedCategory === 'art' && item.category !== 'art' && item.category !== 'branding') return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesLabel = item.instance.label?.toLowerCase().includes(q);
        const matchesType = item.def?.name.toLowerCase().includes(q) || item.def?.id.toLowerCase().includes(q);
        const matchesId = item.instance.id.toLowerCase().includes(q);
        if (!matchesLabel && !matchesType && !matchesId) return false;
      }

      return true;
    });
  }, [allDisplayItems, selectedCategory, searchQuery]);

  const handleEditInWidgets = (widgetTypeId: string) => {
    if (onNavigateToWidgets) {
      onNavigateToWidgets(widgetTypeId);
    } else {
      setActiveTab('widgets');
    }
  };

  return (
    <div className="oled-preview-fullscreen" data-testid="widgets-dev-tab">
      {/* =========================================================================
          TOP: TOOLBAR & FILTER CONTROLS
          ========================================================================= */}
      <div className="border-b border-[#1e2538] bg-[#0d1017]/80 backdrop-blur-md px-6 py-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shrink-0">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="text-[10px] font-mono font-bold tracking-wider uppercase text-[#00f0ff] px-2 py-0.5 rounded bg-[#00f0ff]/10 border border-[#00f0ff]/30 shadow-[0_0_10px_rgba(0,240,255,0.2)]">
              DEV PREVIEW
            </span>
            <h1 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
              <span>Widget Matrix</span>
              <span className="text-xs font-mono font-normal text-[#94a3b8]">
                ({filteredDisplayItems.length} of {allDisplayItems.length} instances)
              </span>
            </h1>
          </div>
          <p className="text-xs text-[#94a3b8] mt-1">
            Simultaneous multi-display preview across all widget instances on {screenWidth}×{screenHeight} OLED displays.
          </p>
        </div>

        {/* Viewport & Display Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Search Input */}
          <div className="relative">
            <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#94a3b8]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter widgets..."
              className="bg-[#131722] border border-[#1e2538] text-xs text-white rounded-lg pl-8 pr-3 py-1.5 focus:outline-none focus:border-[#00f0ff]/50 w-40 sm:w-48 placeholder-[#64748b]"
            />
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center bg-[#131722] p-0.5 rounded-lg border border-[#1e2538]">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-2.5 py-1 text-xs font-mono rounded-md transition-all cursor-pointer ${
                selectedCategory === 'all'
                  ? 'bg-[#00f0ff]/15 text-[#00f0ff] font-semibold'
                  : 'text-[#94a3b8] hover:text-white'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setSelectedCategory('status')}
              className={`px-2.5 py-1 text-xs font-mono rounded-md transition-all cursor-pointer ${
                selectedCategory === 'status'
                  ? 'bg-[#00f0ff]/15 text-[#00f0ff] font-semibold'
                  : 'text-[#94a3b8] hover:text-white'
              }`}
            >
              Status
            </button>
            <button
              onClick={() => setSelectedCategory('typing')}
              className={`px-2.5 py-1 text-xs font-mono rounded-md transition-all cursor-pointer ${
                selectedCategory === 'typing'
                  ? 'bg-[#00f0ff]/15 text-[#00f0ff] font-semibold'
                  : 'text-[#94a3b8] hover:text-white'
              }`}
            >
              Keymap
            </button>
            <button
              onClick={() => setSelectedCategory('art')}
              className={`px-2.5 py-1 text-xs font-mono rounded-md transition-all cursor-pointer ${
                selectedCategory === 'art'
                  ? 'bg-[#00f0ff]/15 text-[#00f0ff] font-semibold'
                  : 'text-[#94a3b8] hover:text-white'
              }`}
            >
              Art
            </button>
          </div>

          {/* Orientation Toggle */}
          <button
            onClick={() => setOrientation((o) => (o === 'horizontal' ? 'vertical' : 'horizontal'))}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#131722] hover:bg-[#1a202c] text-xs font-mono text-[#cbd5e1] hover:text-white rounded-lg border border-[#1e2538] cursor-pointer transition-all"
            title="Toggle OLED orientation (128x32 horizontal vs 32x128 vertical)"
          >
            <RotateCw size={13} className="text-[#00f0ff]" />
            <span>{orientation === 'horizontal' ? '128×32' : '32×128'}</span>
          </button>

          {/* Scale Selector */}
          <div className="flex items-center bg-[#131722] p-0.5 rounded-lg border border-[#1e2538]">
            <button
              onClick={() => setDisplayScale(1)}
              className={`px-2 py-1 text-[11px] font-mono rounded cursor-pointer ${
                displayScale === 1 ? 'bg-[#00f0ff]/20 text-[#00f0ff] font-bold' : 'text-[#94a3b8] hover:text-white'
              }`}
            >
              1×
            </button>
            <button
              onClick={() => setDisplayScale(1.25)}
              className={`px-2 py-1 text-[11px] font-mono rounded cursor-pointer ${
                displayScale === 1.25 ? 'bg-[#00f0ff]/20 text-[#00f0ff] font-bold' : 'text-[#94a3b8] hover:text-white'
              }`}
            >
              1.25×
            </button>
            <button
              onClick={() => setDisplayScale(1.5)}
              className={`px-2 py-1 text-[11px] font-mono rounded cursor-pointer ${
                displayScale === 1.5 ? 'bg-[#00f0ff]/20 text-[#00f0ff] font-bold' : 'text-[#94a3b8] hover:text-white'
              }`}
            >
              1.5×
            </button>
          </div>
        </div>
      </div>

      {/* =========================================================================
          MIDDLE: MULTI-OLED DISPLAY GRID
          ========================================================================= */}
      <div className="flex-1 p-6 overflow-y-auto">
        {filteredDisplayItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-16 text-center text-[#64748b]">
            <Search size={36} className="mb-3 opacity-40 text-[#00f0ff]" />
            <p className="text-sm font-medium text-[#94a3b8]">No widget instances match your filter.</p>
            <p className="text-xs text-[#64748b] mt-1">Try clearing your search query or selecting "All" categories.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-5">
            {filteredDisplayItems.map((item) => {
              const IconComp = item.def?.icon ? WIDGET_ICONS[item.def.icon] || Sparkles : Sparkles;
              const isAnim =
                item.def?.id === 'animation' ||
                item.def?.id === 'loop' ||
                item.def?.id === 'bongo' ||
                item.def?.id === 'typewriter';

              return (
                <div
                  key={item.instance.id}
                  className="bg-[#11141f] border border-[#1e2538] hover:border-[#00f0ff]/40 rounded-xl p-4 flex flex-col justify-between transition-all duration-150 shadow-lg group hover:shadow-[0_0_20px_rgba(0,240,255,0.08)]"
                  data-testid={`widget-card-${item.instance.id}`}
                >
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="p-1.5 rounded-lg bg-[#00f0ff]/10 text-[#00f0ff] shrink-0 border border-[#00f0ff]/20">
                        <IconComp size={15} />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-xs font-semibold text-white truncate group-hover:text-[#00f0ff] transition-colors">
                          {item.instance.label || item.def?.name}
                        </h3>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] font-mono text-[#64748b] truncate max-w-[120px]">
                            {item.def?.name}
                          </span>
                          {isAnim && (
                            <span className="size-1.5 rounded-full bg-[#10b981] animate-pulse" title="Live Animating" />
                          )}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleEditInWidgets(item.def?.id || '')}
                      className="text-[#64748b] hover:text-[#00f0ff] p-1 rounded hover:bg-[#1a2234] transition-colors shrink-0 cursor-pointer"
                      title="Edit this widget in Widgets tab"
                    >
                      <ExternalLink size={13} />
                    </button>
                  </div>

                  {/* OLED Display Container */}
                  <div className="my-2 py-3 px-2 flex items-center justify-center bg-[#07090e] rounded-lg border border-[#171c2b] min-h-[110px] overflow-hidden">
                    <OledDisplayModule
                      width={screenWidth}
                      height={screenHeight}
                      blocks={[item.block]}
                      symbolsGrid={symbolsGrid}
                      symbolSlices={symbolSlices}
                      fontGrid={fontGrid}
                      fontGlyphs={fontGlyphs}
                      fontMappings={fontMappings}
                      side="central"
                      isIdle={isIdle}
                      battery={battery}
                      outputMode={outputMode}
                      bleProfileIndex={bleProfileIndex}
                      currentLayer={currentLayer}
                      layerNames={layerNames}
                      wpm={wpm}
                      wpmHistory={wpmHistory}
                      splitConnected={splitConnected}
                      capsLock={capsLock}
                      customText={customText}
                      instances={instances}
                      bongoState={bongoState}
                      typewriterText={typewriterText}
                      typewriterState={typewriterState}
                      activeKeys={activeKeys}
                      lastKey={lastKey}
                      keypressState={keypressStateRef.current}
                      scale={displayScale}
                      showHousing={true}
                      accentColor="#00f0ff"
                    />
                  </div>

                  {/* Card Footer Info */}
                  <div className="mt-3 pt-2.5 border-t border-[#1e2538]/70 flex items-center justify-between text-[11px] font-mono text-[#64748b]">
                    <span className="bg-[#171c2b] px-1.5 py-0.5 rounded text-[#94a3b8]">
                      {screenWidth}×{screenHeight}
                    </span>
                    <span className="capitalize text-[#94a3b8] truncate max-w-[140px]">
                      {item.instance.config?.mode || 'symbol'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* =========================================================================
          BOTTOM: REACTIVE FIRMWARE SIMULATOR CONTROLS
          ========================================================================= */}
      <div className="shrink-0 border-t border-[#1e2538] bg-[#0b0d13]">
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
            setRandomClickerEnabled((prev) => {
              if (prev) setClickerSpeed(0);
              return !prev;
            });
          }}
          battery={battery}
          onSetBattery={setBattery}
          wpm={wpm}
          onSetWpm={(val) => setWpm(val)}
          screenCount={filteredDisplayItems.length}
        />
      </div>
    </div>
  );
};

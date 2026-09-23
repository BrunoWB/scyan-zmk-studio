import React, { useState, useRef, useEffect, useMemo } from 'react';
import { BwpxGrid } from '../pixel/core/PixelGrid';
import type { SpriteSlice, FontGlyph, FontCharMapping, LayoutBlock } from '../types/zmk';
import {
  WIDGET_REGISTRY,
  getWidgetDefinition,
  renderWidgetById,
  getWidgetNaturalSize,
  normalizeWidgetType,
  createDefaultWidgetInstance,
} from '../services/widgetRegistry';
import { formatLayerLabel } from '../services/keymapService';
import { WidgetMiniPreview } from './blocks/WidgetCatalogList';
import type {
  DisplayWidgetDefinition,
  WidgetInstanceMap,
  WidgetInstance,
  TypewriterRandomLetter,
  TypewriterFadeType,
  KeypressState,
} from '../types/widget';
import {
  Activity, Battery, Wifi, Link2, Layers, Sparkles, Gauge, Type,
  Type as TypeIcon, Image as ImageIcon,
  Plus, Trash2, Usb, Bluetooth, Cat, Repeat, Film,
  AlignLeft, AlignCenter, AlignRight, Cpu, Keyboard,
  ArrowRight, ArrowLeft, ArrowDown, ArrowUp
} from 'lucide-react';

import { useAtlasStore } from '../stores/useAtlasStore';
import { useLayoutStore } from '../stores/useLayoutStore';
import { useUiStore } from '../stores/useUiStore';

export interface WidgetsTabProps {
  initialActiveWidgetId?: string;
  symbolsGrid?: BwpxGrid;
  symbolSlices?: SpriteSlice[];
  fontGrid?: BwpxGrid;
  fontGlyphs?: FontGlyph[];
  fontMappings?: FontCharMapping[];
  customText?: string;
  onCustomTextChange?: (text: string) => void;
  instances?: WidgetInstanceMap;
  onInstancesChange?: (instances: WidgetInstanceMap) => void;
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
  layerNames?: string[];
}

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
  repeat: Repeat,
  film: Film,
  keyboard: Keyboard,
};

const TIER_METADATA = {
  1: {
    label: 'Tier 1: Atomic Status Pills',
    shortLabel: 'Tier 1: Status',
    desc: 'Low-profile status indicators (Battery, USB/BLE, Split Link, Caps Lock).',
    badgeClass: 'badge-tier-1',
  },
  2: {
    label: 'Tier 2: Keymap & Typing Metrics',
    shortLabel: 'Tier 2: Keymap/Typing',
    desc: 'Dynamic layer banners, typing speed dials, and custom branding banners.',
    badgeClass: 'badge-tier-2',
  },
  3: {
    label: 'Tier 3: Static',
    shortLabel: 'Tier 3: Static',
    desc: 'Static images, text banners, and screensavers.',
    badgeClass: 'badge-tier-3',
  },
} as const;

export const WidgetsTab: React.FC<WidgetsTabProps> = ({
  initialActiveWidgetId,
  symbolsGrid: propsSymbolsGrid,
  symbolSlices: propsSymbolSlices,
  fontGrid: propsFontGrid,
  fontGlyphs: propsFontGlyphs,
  fontMappings: propsFontMappings,
  customText: propsCustomText,
  onCustomTextChange: _propsOnCustomTextChange,
  instances: propsInstances,
  onInstancesChange: propsOnInstancesChange,
  centralBlocks: propsCentralBlocks,
  peripheralBlocks: propsPeripheralBlocks,
  onCentralBlocksChange: propsOnCentralBlocksChange,
  onPeripheralBlocksChange: propsOnPeripheralBlocksChange,
  idleCentralBlocks: propsIdleCentralBlocks,
  idlePeripheralBlocks: propsIdlePeripheralBlocks,
  onIdleCentralBlocksChange: propsOnIdleCentralBlocksChange,
  onIdlePeripheralBlocksChange: propsOnIdlePeripheralBlocksChange,
  leftBlocks: propsLeftBlocks,
  rightBlocks: propsRightBlocks,
  onLeftBlocksChange: propsOnLeftBlocksChange,
  onRightBlocksChange: propsOnRightBlocksChange,
  idleLeftBlocks: propsIdleLeftBlocks,
  idleRightBlocks: propsIdleRightBlocks,
  onIdleLeftBlocksChange: propsOnIdleLeftBlocksChange,
  onIdleRightBlocksChange: propsOnIdleRightBlocksChange,
  layerNames: propsLayerNames,
}) => {
  const storeSymbolsGrid = useAtlasStore((s) => s.symbolsGrid);
  const storeSymbolSlices = useAtlasStore((s) => s.symbolSlices);
  const storeFontGrid = useAtlasStore((s) => s.fontGrid);
  const storeFontGlyphs = useAtlasStore((s) => s.fontGlyphs);
  const storeFontMappings = useAtlasStore((s) => s.fontMappings);

  const storeCustomText = useUiStore((s) => s.customText);

  const storeCentralBlocks = useLayoutStore((s) => s.centralBlocks);
  const storeSetCentralBlocks = useLayoutStore((s) => s.setCentralBlocks);
  const storePeripheralBlocks = useLayoutStore((s) => s.peripheralBlocks);
  const storeSetPeripheralBlocks = useLayoutStore((s) => s.setPeripheralBlocks);
  const storeIdleCentralBlocks = useLayoutStore((s) => s.idleCentralBlocks);
  const storeSetIdleCentralBlocks = useLayoutStore((s) => s.setIdleCentralBlocks);
  const storeIdlePeripheralBlocks = useLayoutStore((s) => s.idlePeripheralBlocks);
  const storeSetIdlePeripheralBlocks = useLayoutStore((s) => s.setIdlePeripheralBlocks);
  const storeWidgetInstances = useLayoutStore((s) => s.widgetInstances);
  const storeHandleInstancesChange = useLayoutStore((s) => s.handleInstancesChange);
  const storeLayerNames = useLayoutStore((s) => s.keymapLayout.layerNames);

  const symbolsGrid = propsSymbolsGrid ?? storeSymbolsGrid;
  const symbolSlices = propsSymbolSlices ?? storeSymbolSlices;
  const fontGrid = propsFontGrid ?? storeFontGrid;
  const fontGlyphs = propsFontGlyphs ?? storeFontGlyphs;
  const fontMappings = propsFontMappings ?? storeFontMappings;
  const customText = propsCustomText ?? storeCustomText;
  const instances = propsInstances ?? storeWidgetInstances;
  const onInstancesChange = propsOnInstancesChange ?? storeHandleInstancesChange;
  const centralBlocks = propsCentralBlocks ?? propsLeftBlocks ?? storeCentralBlocks;
  const peripheralBlocks = propsPeripheralBlocks ?? propsRightBlocks ?? storePeripheralBlocks;
  const onCentralBlocksChange = propsOnCentralBlocksChange ?? propsOnLeftBlocksChange ?? storeSetCentralBlocks;
  const onPeripheralBlocksChange = propsOnPeripheralBlocksChange ?? propsOnRightBlocksChange ?? storeSetPeripheralBlocks;
  const idleCentralBlocks = propsIdleCentralBlocks ?? propsIdleLeftBlocks ?? storeIdleCentralBlocks;
  const idlePeripheralBlocks = propsIdlePeripheralBlocks ?? propsIdleRightBlocks ?? storeIdlePeripheralBlocks;
  const onIdleCentralBlocksChange = propsOnIdleCentralBlocksChange ?? propsOnIdleLeftBlocksChange ?? storeSetIdleCentralBlocks;
  const onIdlePeripheralBlocksChange = propsOnIdlePeripheralBlocksChange ?? propsOnIdleRightBlocksChange ?? storeSetIdlePeripheralBlocks;
  const layerNames = propsLayerNames ?? storeLayerNames;

  const effectiveCentralBlocks = centralBlocks;
  const effectivePeripheralBlocks = peripheralBlocks;
  const handleCentralBlocksChange = onCentralBlocksChange;
  const handlePeripheralBlocksChange = onPeripheralBlocksChange;
  const effectiveIdleCentralBlocks = idleCentralBlocks;
  const effectiveIdlePeripheralBlocks = idlePeripheralBlocks;
  const handleIdleCentralBlocksChange = onIdleCentralBlocksChange;
  const handleIdlePeripheralBlocksChange = onIdlePeripheralBlocksChange;
  const [activeWidgetId, setActiveWidgetId] = useState<string>(initialActiveWidgetId || WIDGET_REGISTRY[0]?.id || 'status-bar');
  
  const effectiveLayerNames = useMemo(() => {
    if (layerNames && layerNames.length > 0) return layerNames;
    return ['DEFAULT', 'LOWER', 'RAISE', 'ADJUST'];
  }, [layerNames]);

  const [testBattery, setTestBattery] = useState<number>(75);
  const [testWpm] = useState<number>(55);
  const [testOutputMode, setTestOutputMode] = useState<'usb' | 'ble'>('usb');
  const [testBleProfile, setTestBleProfile] = useState<number>(1);
  const [testLayer, setTestLayer] = useState<number>(0);
  const [testSplitConnected] = useState<boolean>(true);
  const [simulateMissingSymbols] = useState<boolean>(false);
  const [testBongoState, setTestBongoState] = useState<0 | 1 | 2>(0);
  const [testTypewriterText, setTestTypewriterText] = useState<string>('TYPE...');
  const [testTypewriterLastChar, setTestTypewriterLastChar] = useState<string>('E');
  const [testTypewriterLastTimestamp, setTestTypewriterLastTimestamp] = useState<number>(() => Date.now());
  const [testTypewriterRandomPos, setTestTypewriterRandomPos] = useState<{ x: number; y: number }>({ x: 0.25, y: 0.25 });
  const [testTypewriterRandomLetters, setTestTypewriterRandomLetters] = useState<TypewriterRandomLetter[]>(() => {
    const now = Date.now();
    return [
      { char: 'T', x: 0.1, y: 0.08, fontSize: 'big', timestamp: now },
      { char: 'Y', x: 0.4, y: 0.32, fontSize: 'small', timestamp: now },
      { char: 'P', x: 0.75, y: 0.62, fontSize: 'big', timestamp: now },
      { char: 'E', x: 0.35, y: 0.88, fontSize: 'small', timestamp: now },
    ];
  });

  const [testActiveKeys, setTestActiveKeys] = useState<string[]>([]);
  const [testLastKey, setTestLastKey] = useState<string>('');
  const testKeypressStateRef = useRef<KeypressState>({});

  useEffect(() => {
    testKeypressStateRef.current.activeKeys = testActiveKeys;
    testKeypressStateRef.current.lastKey = testLastKey;
  }, [testActiveKeys, testLastKey]);

  const effectiveTestLayer = testLayer < effectiveLayerNames.length ? testLayer : 0;

  const activeWidget: DisplayWidgetDefinition = getWidgetDefinition(activeWidgetId) || WIDGET_REGISTRY[0];
  const activeInstances = instances[activeWidget.id] || (activeWidget.id === 'animation' ? instances['loop'] : activeWidget.id === 'loop' ? instances['animation'] : undefined) || [];

  const handleAddInstance = () => {
    if (!onInstancesChange) return;
    const newInstanceId = `${activeWidget.id}-${Date.now()}`;
    const newInst = createDefaultWidgetInstance(activeWidget.id, symbolSlices, newInstanceId);
    
    const nextInstances = [...activeInstances, newInst];
    const updatedMap: import('../types/widget').WidgetInstanceMap = {
      ...instances,
      [activeWidget.id]: nextInstances,
    };
    if (activeWidget.id === 'animation') {
      updatedMap['loop'] = nextInstances.map(i => ({ ...i, widgetTypeId: 'loop' }));
    } else if (activeWidget.id === 'loop') {
      updatedMap['animation'] = nextInstances.map(i => ({ ...i, widgetTypeId: 'animation' }));
    }
    onInstancesChange(updatedMap);
  };

  const handleDeleteInstance = (instId: string) => {
    if (!onInstancesChange) return;
    const newInstances = activeInstances.filter(i => i.id !== instId);
    
    const updatedMap: import('../types/widget').WidgetInstanceMap = {
      ...instances,
      [activeWidget.id]: newInstances,
    };
    if (activeWidget.id === 'animation') {
      updatedMap['loop'] = newInstances.map(i => ({ ...i, widgetTypeId: 'loop' }));
    } else if (activeWidget.id === 'loop') {
      updatedMap['animation'] = newInstances.map(i => ({ ...i, widgetTypeId: 'animation' }));
    }
    onInstancesChange(updatedMap);
    
    if (handleCentralBlocksChange && effectiveCentralBlocks) {
      handleCentralBlocksChange(effectiveCentralBlocks.filter(b => b.instanceId !== instId));
    }
    if (handlePeripheralBlocksChange && effectivePeripheralBlocks) {
      handlePeripheralBlocksChange(effectivePeripheralBlocks.filter(b => b.instanceId !== instId));
    }
    if (handleIdleCentralBlocksChange && effectiveIdleCentralBlocks) {
      handleIdleCentralBlocksChange(effectiveIdleCentralBlocks.filter(b => b.instanceId !== instId));
    }
    if (handleIdlePeripheralBlocksChange && effectiveIdlePeripheralBlocks) {
      handleIdlePeripheralBlocksChange(effectiveIdlePeripheralBlocks.filter(b => b.instanceId !== instId));
    }
  };

  const handleUpdateInstanceConfig = (instId: string, partial: Partial<import('../types/widget').WidgetInstanceConfig>) => {
    if (!onInstancesChange) return;
    const newInstances = activeInstances.map(inst => {
      if (inst.id !== instId) return inst;
      const currentConfig = inst.config || { mode: 'symbol' };
      return {
        ...inst,
        config: { ...currentConfig, ...partial }
      };
    });
    const updatedMap: import('../types/widget').WidgetInstanceMap = {
      ...instances,
      [activeWidget.id]: newInstances,
    };
    if (activeWidget.id === 'animation') {
      updatedMap['loop'] = newInstances.map(i => ({ ...i, widgetTypeId: 'loop' }));
    } else if (activeWidget.id === 'loop') {
      updatedMap['animation'] = newInstances.map(i => ({ ...i, widgetTypeId: 'animation' }));
    }
    onInstancesChange(updatedMap);

    const updatedInst = newInstances.find(i => i.id === instId);
    const naturalSize = updatedInst ? getWidgetNaturalSize(activeWidget, symbolSlices, updatedInst, fontGlyphs, fontMappings) : null;

    if (naturalSize) {
      const updateBlocks = (blocks?: LayoutBlock[]) => {
        if (!blocks) return blocks;
        const targetNorm = normalizeWidgetType(activeWidget.id);
        return blocks.map(b => {
          const norm = normalizeWidgetType(b.widgetType || b.id);
          if (b.instanceId === instId || (!b.instanceId && norm === targetNorm) || (norm === targetNorm && newInstances.length <= 1)) {
            return {
              ...b,
              width: naturalSize.width,
              height: naturalSize.height,
            };
          }
          return b;
        });
      };
      if (handleCentralBlocksChange && effectiveCentralBlocks) handleCentralBlocksChange(updateBlocks(effectiveCentralBlocks)!);
      if (handlePeripheralBlocksChange && effectivePeripheralBlocks) handlePeripheralBlocksChange(updateBlocks(effectivePeripheralBlocks)!);
      if (handleIdleCentralBlocksChange && effectiveIdleCentralBlocks) handleIdleCentralBlocksChange(updateBlocks(effectiveIdleCentralBlocks)!);
      if (handleIdlePeripheralBlocksChange && effectiveIdlePeripheralBlocks) handleIdlePeripheralBlocksChange(updateBlocks(effectiveIdlePeripheralBlocks)!);
    }
  };

  const handleUpdateInstanceLabel = (instId: string, label: string) => {
    if (!onInstancesChange) return;
    const newInstances = activeInstances.map(inst => {
      if (inst.id !== instId) return inst;
      return { ...inst, label };
    });
    const updatedMap: import('../types/widget').WidgetInstanceMap = {
      ...instances,
      [activeWidget.id]: newInstances,
    };
    if (activeWidget.id === 'animation') {
      updatedMap['loop'] = newInstances.map(i => ({ ...i, widgetTypeId: 'loop' }));
    } else if (activeWidget.id === 'loop') {
      updatedMap['animation'] = newInstances.map(i => ({ ...i, widgetTypeId: 'animation' }));
    }
    onInstancesChange(updatedMap);
  };

  return (
    <div className="widgets-tab-container">
      {/* Left Sidebar */}
      <div className="widgets-sidebar">
        <div className="flex items-center justify-between">
          <h3 className="sidebar-title">Widget Templates</h3>
          <span className="text-[10px] font-mono text-accent">{WIDGET_REGISTRY.length} total</span>
        </div>

        <div className="widgets-nav-list">
          {([1, 2, 3] as const).map(tierNum => {
            const tierWidgets = WIDGET_REGISTRY.filter(w => w.tier === tierNum);
            if (tierWidgets.length === 0) return null;

            return (
              <div key={tierNum} className="widget-tier-section mb-3">
                <div className="widget-tier-section-header">
                  <span className={`tier-badge-pill tier-${tierNum}`}>T{tierNum}</span>
                  <span className="widget-tier-section-title">{TIER_METADATA[tierNum].label}</span>
                </div>
                <div className="flex flex-col gap-1.5">
                  {tierWidgets.map(widget => {
                    const isActive = activeWidget.id === widget.id;
                    const instanceCount = (instances[widget.id] || []).length;

                    return (
                      <button key={widget.id} className={`widget-nav-item ${isActive ? 'active' : ''}`} onClick={() => setActiveWidgetId(widget.id)}>
                        <div className="widget-nav-badges">
                          {widget.requiresMaster && (
                            <span className="badge-master badge-master--nav" title="Requires Central half in ZMK split">
                              <Cpu size={9} className="shrink-0" />
                            </span>
                          )}
                          {instanceCount > 0 && (
                            <span className="instance-count-badge">{instanceCount}</span>
                          )}
                        </div>
                        <div className="widget-nav-thumb-wrapper">
                          <WidgetMiniPreview
                            widget={widget}
                            symbolsGrid={symbolsGrid}
                            symbolSlices={symbolSlices}
                            fontGrid={fontGrid}
                            fontGlyphs={fontGlyphs}
                            fontMappings={fontMappings}
                            customText={customText}
                            instances={instances}
                          />
                        </div>
                        <div className="widget-nav-meta flex-1 min-w-0">
                          <span className="widget-nav-name truncate">{widget.name}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right Content */}
      <div className="widgets-content-pane">
        <div className="widgets-content-inner">
          {/* Template Header — outside the card */}
          <div className="mb-5">
          <div className="flex items-center gap-2 mb-1">
            {React.createElement(WIDGET_ICONS[activeWidget.icon] || Sparkles, { size: 18, className: 'text-accent' })}
            <h3 className="text-base font-semibold text-text-main">{activeWidget.name} Template</h3>
            <span className={`px-2 py-0.5 rounded text-[10px] font-mono tier-pill tier-pill-${activeWidget.tier}`}>
              Tier {activeWidget.tier} · {activeWidget.category}
            </span>
            {activeWidget.requiresMaster && (
              <span className="badge-master" title="Requires Central half in ZMK split">
                <Cpu size={10} className="shrink-0" />
                CENTRAL
              </span>
            )}
          </div>
          <p className="text-sm text-muted">{activeWidget.description}</p>
        </div>

        {/* Preview Controls — uncontained template options */}
        {activeInstances.length > 0 && (activeWidget.id === 'battery' || activeWidget.id === 'connection' || activeWidget.id === 'bongo' || activeWidget.id === 'layer-banner' || activeWidget.id === 'typewriter' || activeWidget.id === 'keypress') && (
          <div className="mb-6 flex flex-col gap-3">
            {activeWidget.id === 'typewriter' && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-text-main whitespace-nowrap">Interactive Typing Test:</span>
                  {testTypewriterText && (
                    <button
                      type="button"
                      onClick={() => {
                        setTestTypewriterText('');
                        setTestTypewriterLastChar('');
                        setTestTypewriterRandomLetters([]);
                      }}
                      className="text-[11px] text-muted hover:text-accent cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  value={testTypewriterText}
                  onChange={e => {
                    const val = e.target.value.toUpperCase();
                    const prevText = testTypewriterText;
                    setTestTypewriterText(val);
                    const now = Date.now();
                    const randomInst = activeInstances.find(i => (i.config?.typewriterMode || i.config?.mode) === 'random') || activeInstances[0];
                    const capacity = Math.max(
                      20,
                      ...activeInstances.map(i => Math.max(1, i.config?.typewriterBankSize ?? i.config?.typewriterLetterBank ?? 20)),
                      32
                    );
                    const cleaning = randomInst?.config?.typewriterCleaning ?? 0.2;

                    if (val.length === 0) {
                      setTestTypewriterLastChar('');
                      setTestTypewriterRandomLetters([]);
                      setTestTypewriterLastTimestamp(now);
                    } else if (val.length < prevText.length) {
                      // Backspace / deletion
                      const last = val[val.length - 1];
                      setTestTypewriterLastChar(last);
                      setTestTypewriterRandomLetters(prev => {
                        let surviving = prev;
                        if (cleaning > 0 && testTypewriterLastTimestamp) {
                          const cleaningMs = Math.round(cleaning * 1000);
                          const intervals = cleaningMs > 0 ? Math.floor((now - testTypewriterLastTimestamp) / cleaningMs) : 0;
                          if (intervals > 0) {
                            surviving = prev.slice(intervals);
                          }
                        }
                        return surviving.slice(0, -1);
                      });
                      setTestTypewriterLastTimestamp(now);
                    } else {
                      // Keystroke / letter addition: use normalized [0, 1) coordinates so letters span any box dimensions
                      const last = val[val.length - 1];
                      setTestTypewriterLastChar(last);
                      const rx = Math.random();
                      const ry = Math.random();
                      setTestTypewriterRandomPos({
                        x: rx,
                        y: ry,
                      });
                      const twFontSizeCfg = randomInst?.config?.fontSize ?? 'both';
                      const chosenSize: 'small' | 'big' = twFontSizeCfg === 'both'
                        ? (Math.random() < 0.5 ? 'small' : 'big')
                        : (twFontSizeCfg === 'big' ? 'big' : 'small');
                      setTestTypewriterRandomLetters(prev => {
                        let surviving = prev;
                        if (cleaning > 0 && testTypewriterLastTimestamp) {
                          const cleaningMs = Math.round(cleaning * 1000);
                          const intervals = cleaningMs > 0 ? Math.floor((now - testTypewriterLastTimestamp) / cleaningMs) : 0;
                          if (intervals > 0) {
                            surviving = prev.slice(intervals);
                          }
                        }
                        return [...surviving, { char: last, x: rx, y: ry, fontSize: chosenSize, timestamp: now }].slice(-capacity);
                      });
                      setTestTypewriterLastTimestamp(now);
                    }
                  }}
                  placeholder="Type here to test typewriter on display..."
                  className="input-text-dark text-xs w-full font-mono"
                />
              </div>
            )}
            {activeWidget.id === 'layer-banner' && (
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-xs font-semibold text-text-main whitespace-nowrap">Preview Layer:</span>
                <div className="flex flex-wrap gap-1.5">
                  {effectiveLayerNames.map((name, idx) => (
                    <button
                      key={idx}
                      type="button"
                      className={`btn-chip !px-2.5 !py-1 text-xs ${effectiveTestLayer === idx ? 'active' : ''}`}
                      onClick={() => setTestLayer(idx)}
                    >
                      <span>{formatLayerLabel(idx, name)}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {activeWidget.id === 'battery' && (
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-text-main whitespace-nowrap">Preview Battery: {testBattery}%</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={testBattery}
                  onChange={e => setTestBattery(parseInt(e.target.value, 10))}
                  className="flex-1 accent-accent"
                />
              </div>
            )}
            {activeWidget.id === 'connection' && (
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-xs font-semibold text-text-main whitespace-nowrap">Preview Output:</span>
                <div className="button-pair">
                  <button
                    type="button"
                    className={`btn-chip ${testOutputMode === 'usb' ? 'active' : ''}`}
                    onClick={() => setTestOutputMode('usb')}
                  >
                    <Usb size={13} />
                    <span>USB</span>
                  </button>
                  <button
                    type="button"
                    className={`btn-chip ${testOutputMode === 'ble' ? 'active' : ''}`}
                    onClick={() => setTestOutputMode('ble')}
                  >
                    <Bluetooth size={13} />
                    <span>Bluetooth</span>
                  </button>
                </div>
                {testOutputMode === 'ble' && (
                  <div className="flex items-center gap-1.5 ml-2">
                    <span className="text-xs text-muted">Profile:</span>
                    {[0, 1, 2, 3, 4, 5].map(idx => (
                      <button
                        key={idx}
                        type="button"
                        className={`btn-chip !px-2 !py-0.5 text-xs ${testBleProfile === idx ? 'active' : ''}`}
                        onClick={() => setTestBleProfile(idx)}
                      >
                        {idx === 0 ? 'No conn' : `P${idx}`}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {activeWidget.id === 'bongo' && (
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-xs font-semibold text-text-main whitespace-nowrap">Preview Tap:</span>
                <div className="button-pair">
                  <button
                    type="button"
                    className={`btn-chip ${testBongoState === 1 ? 'active' : ''}`}
                    onClick={() => setTestBongoState(1)}
                  >
                    <span>Left Paw</span>
                  </button>
                  <button
                    type="button"
                    className={`btn-chip ${testBongoState === 0 ? 'active' : ''}`}
                    onClick={() => setTestBongoState(0)}
                  >
                    <span>Neutral</span>
                  </button>
                  <button
                    type="button"
                    className={`btn-chip ${testBongoState === 2 ? 'active' : ''}`}
                    onClick={() => setTestBongoState(2)}
                  >
                    <span>Right Paw</span>
                  </button>
                </div>
              </div>
            )}

            {activeWidget.id === 'keypress' && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-text-main whitespace-nowrap">Interactive Keypress Simulator:</span>
                  {(testActiveKeys.length > 0 || testLastKey) && (
                    <button
                      type="button"
                      onClick={() => {
                        setTestActiveKeys([]);
                        setTestLastKey('');
                        testKeypressStateRef.current.lastSymbolId = undefined;
                      }}
                      className="text-[11px] text-muted hover:text-accent cursor-pointer"
                    >
                      Reset State
                    </button>
                  )}
                </div>

                {/* Arrow Keys D-Pad Buttons */}
                <div className="flex flex-wrap items-center gap-2">
                  {[
                    { key: 'ArrowUp', label: '↑ Up' },
                    { key: 'ArrowDown', label: '↓ Down' },
                    { key: 'ArrowLeft', label: '← Left' },
                    { key: 'ArrowRight', label: '→ Right' },
                  ].map(btn => {
                    const isPressed = testActiveKeys.includes(btn.key);
                    return (
                      <button
                        key={btn.key}
                        type="button"
                        className={`btn-chip ${isPressed ? 'active' : ''}`}
                        onMouseDown={() => {
                          setTestActiveKeys(prev => prev.includes(btn.key) ? prev : [...prev, btn.key]);
                          setTestLastKey(btn.key);
                        }}
                        onMouseUp={() => {
                          setTestActiveKeys(prev => prev.filter(k => k !== btn.key));
                        }}
                        onMouseLeave={() => {
                          setTestActiveKeys(prev => prev.filter(k => k !== btn.key));
                        }}
                        onTouchStart={() => {
                          setTestActiveKeys(prev => prev.includes(btn.key) ? prev : [...prev, btn.key]);
                          setTestLastKey(btn.key);
                        }}
                        onTouchEnd={() => {
                          setTestActiveKeys(prev => prev.filter(k => k !== btn.key));
                        }}
                      >
                        <span>{btn.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Keyboard focus listener input for physical key press */}
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={testActiveKeys.length > 0 ? `Holding: ${testActiveKeys.join(', ')}` : (testLastKey ? `Last: ${testLastKey}` : '')}
                    placeholder="Click here & hold any key to test live..."
                    onKeyDown={e => {
                      e.preventDefault();
                      if (e.repeat) return;
                      const k = e.key;
                      setTestActiveKeys(prev => prev.includes(k) ? prev : [...prev, k]);
                      setTestLastKey(k);
                    }}
                    onKeyUp={e => {
                      e.preventDefault();
                      setTestActiveKeys(prev => prev.filter(k => k !== e.key));
                    }}
                    onBlur={() => {
                      setTestActiveKeys([]);
                    }}
                    className="input-text-dark text-xs flex-1 cursor-pointer"
                  />
                  {testLastKey && (
                    <span className="text-[11px] font-mono text-muted">
                      Last: <strong className="text-accent">{testLastKey}</strong>
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
        
        {/* Instances List */}
        <div className="space-y-4">
          {activeInstances.map(inst => (
            <div key={inst.id} className="widget-config-card p-4 group">
              <div className="mb-4 flex items-center justify-between gap-3">
                <input 
                  type="text" 
                  value={inst.label} 
                  onChange={e => handleUpdateInstanceLabel(inst.id, e.target.value)} 
                  className="widget-instance-label-input flex-1 min-w-0"
                  placeholder="Instance Label..."
                />
                {activeWidget.id !== 'wpm-chart' && activeWidget.id !== 'branding' && activeWidget.id !== 'typewriter' && activeWidget.id !== 'keypress' && (
                  <div className="widget-mode-radio-group" role="radiogroup" aria-label="Display Mode">
                    <button
                      type="button"
                      role="radio"
                      aria-checked={inst.config?.mode === 'symbol' || !inst.config?.mode}
                      className={`widget-mode-radio-btn ${inst.config?.mode === 'symbol' || !inst.config?.mode ? 'active' : ''}`}
                      onClick={() => handleUpdateInstanceConfig(inst.id, { mode: 'symbol' })}
                      title="Symbol Mode"
                    >
                      <ImageIcon size={13} />
                      <span>Symbol</span>
                    </button>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={inst.config?.mode === 'font'}
                      className={`widget-mode-radio-btn ${inst.config?.mode === 'font' ? 'active' : ''}`}
                      onClick={() => handleUpdateInstanceConfig(inst.id, { mode: 'font' })}
                      title="Font Mode"
                    >
                      <TypeIcon size={13} />
                      <span>Font</span>
                    </button>
                  </div>
                )}
                {activeWidget.id === 'typewriter' && (
                  <div className="widget-mode-radio-group" role="radiogroup" aria-label="Typewriter Mode">
                    <button
                      type="button"
                      role="radio"
                      aria-checked={((inst.config?.typewriterMode || inst.config?.mode) ?? 'inline') === 'inline'}
                      className={`widget-mode-radio-btn ${((inst.config?.typewriterMode || inst.config?.mode) ?? 'inline') === 'inline' ? 'active' : ''}`}
                      onClick={() => handleUpdateInstanceConfig(inst.id, { mode: 'inline', typewriterMode: 'inline' })}
                      title="Inline Text Stream"
                    >
                      <TypeIcon size={13} />
                      <span>Inline</span>
                    </button>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={((inst.config?.typewriterMode || inst.config?.mode) ?? 'inline') === 'spot'}
                      className={`widget-mode-radio-btn ${((inst.config?.typewriterMode || inst.config?.mode) ?? 'inline') === 'spot' ? 'active' : ''}`}
                      onClick={() => handleUpdateInstanceConfig(inst.id, { mode: 'spot', typewriterMode: 'spot' })}
                      title="Single Letter Spot"
                    >
                      <Sparkles size={13} />
                      <span>Spot</span>
                    </button>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={((inst.config?.typewriterMode || inst.config?.mode) ?? 'inline') === 'random'}
                      className={`widget-mode-radio-btn ${((inst.config?.typewriterMode || inst.config?.mode) ?? 'inline') === 'random' ? 'active' : ''}`}
                      onClick={() => handleUpdateInstanceConfig(inst.id, {
                        mode: 'random',
                        typewriterMode: 'random',
                        ...((inst.config?.typewriterBankSize === undefined && inst.config?.typewriterLetterBank === undefined) ? { typewriterLetterBank: 20, typewriterBankSize: 20 } : {}),
                        ...(inst.config?.typewriterCleaning === undefined ? { typewriterCleaning: 0.2 } : {}),
                        ...(inst.config?.typewriterFadeType === undefined ? { typewriterFadeType: 'dither' } : {}),
                        ...(inst.config?.typewriterFadeTime === undefined ? { typewriterFadeTime: 0.15 } : {}),
                        ...(inst.config?.typewriterMode !== 'random' ? { fontSize: 'both' } : (inst.config?.fontSize === undefined ? { fontSize: 'both' } : {})),
                      })}
                      title="Random Screen Scatter"
                    >
                      <Repeat size={13} />
                      <span>Random</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Side-by-Side: Preview on the side & Config Controls */}
              <div className="widget-instance-body flex flex-col sm:flex-row gap-4 items-stretch">
                {/* Side Preview (Vertical OLED) */}
                <div className="widget-interactive-demo-side shrink-0 flex flex-col items-center justify-center">
                  <div className="demo-canvas-box">
                    <InstancePreview 
                      widget={activeWidget} 
                      instance={inst} 
                      symbolsGrid={symbolsGrid} 
                      symbolSlices={symbolSlices} 
                      fontGrid={fontGrid} 
                      fontGlyphs={fontGlyphs} 
                      fontMappings={fontMappings} 
                      customText={customText} 
                      testBattery={testBattery}
                      testWpm={testWpm}
                      testOutputMode={testOutputMode}
                      testBleProfile={testBleProfile}
                      testLayer={effectiveTestLayer}
                      layerNames={effectiveLayerNames}
                      testSplitConnected={testSplitConnected}
                      simulateMissingSymbols={simulateMissingSymbols}
                      testBongoState={testBongoState}
                      testTypewriterText={testTypewriterText}
                      testTypewriterLastChar={testTypewriterLastChar}
                      testTypewriterLastTimestamp={testTypewriterLastTimestamp}
                      testTypewriterRandomPos={testTypewriterRandomPos}
                      testTypewriterRandomLetters={testTypewriterRandomLetters}
                      testActiveKeys={testActiveKeys}
                      testLastKey={testLastKey}
                      testKeypressState={testKeypressStateRef.current}
                    />
                  </div>
                  <span className="text-[10px] font-mono text-muted tracking-wider uppercase mt-2 select-none">
                    Preview
                  </span>
                </div>

                {/* Config Controls */}
                <div className="flex-1 min-w-0 flex flex-col">
                  <div className="widget-slot-card p-3 rounded-lg border border-border/40 bg-surface/60 flex-1">

                  {activeWidget.id === 'branding' && (
                    <div className="flex flex-col gap-3">
                      <div>
                        <label className="text-xs text-muted mb-1 block">Banner Text</label>
                        <input
                          type="text"
                          maxLength={32}
                          value={inst.config?.textEntries?.[0] !== undefined ? inst.config.textEntries[0] : (inst.label || 'ZMK')}
                          onChange={e => handleUpdateInstanceConfig(inst.id, { textEntries: [e.target.value] })}
                          className="input-text-dark text-xs w-full"
                          placeholder="e.g. CORNE or {layerName}"
                        />
                        <span className="text-[10px] text-muted">
                          Banner text to render on display. Supports template variables like {'{layerName}'}, {'{customText}'}.
                        </span>
                      </div>

                      <div>
                        <label className="text-xs text-muted mb-1 block">Font Size</label>
                        <div className="button-pair">
                          <button
                            type="button"
                            className={`btn-toggle ${inst.config?.fontSize !== 'big' ? 'active' : ''}`}
                            onClick={() => handleUpdateInstanceConfig(inst.id, { fontSize: 'small' })}
                          >
                            <span>Small</span>
                          </button>
                          <button
                            type="button"
                            className={`btn-toggle ${inst.config?.fontSize === 'big' ? 'active' : ''}`}
                            onClick={() => handleUpdateInstanceConfig(inst.id, { fontSize: 'big' })}
                          >
                            <span>Big</span>
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="text-xs text-muted mb-1 block">Text Alignment</label>
                        <div className="button-trio" role="radiogroup" aria-label="Text Alignment">
                          <button
                            type="button"
                            role="radio"
                            aria-checked={(inst.config?.textAlign || 'center') === 'left'}
                            className={`btn-toggle ${(inst.config?.textAlign || 'center') === 'left' ? 'active' : ''}`}
                            onClick={() => handleUpdateInstanceConfig(inst.id, { textAlign: 'left', align: 'left' })}
                            title="Left align"
                          >
                            <AlignLeft size={13} />
                            <span>Left</span>
                          </button>
                          <button
                            type="button"
                            role="radio"
                            aria-checked={(inst.config?.textAlign || 'center') === 'center'}
                            className={`btn-toggle ${(inst.config?.textAlign || 'center') === 'center' ? 'active' : ''}`}
                            onClick={() => handleUpdateInstanceConfig(inst.id, { textAlign: 'center', align: 'center' })}
                            title="Center align"
                          >
                            <AlignCenter size={13} />
                            <span>Center</span>
                          </button>
                          <button
                            type="button"
                            role="radio"
                            aria-checked={(inst.config?.textAlign || 'center') === 'right'}
                            className={`btn-toggle ${(inst.config?.textAlign || 'center') === 'right' ? 'active' : ''}`}
                            onClick={() => handleUpdateInstanceConfig(inst.id, { textAlign: 'right', align: 'right' })}
                            title="Right align"
                          >
                            <AlignRight size={13} />
                            <span>Right</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {activeWidget.id === 'typewriter' && (
                    <div className="flex flex-col gap-3">
                      <div>
                        <label className="text-xs text-muted mb-1 block">Typewriter Mode</label>
                        <div className="button-trio" role="radiogroup" aria-label="Typewriter Mode">
                          <button
                            type="button"
                            role="radio"
                            aria-checked={((inst.config?.typewriterMode || inst.config?.mode) ?? 'inline') === 'inline'}
                            className={`btn-toggle ${((inst.config?.typewriterMode || inst.config?.mode) ?? 'inline') === 'inline' ? 'active' : ''}`}
                            onClick={() => handleUpdateInstanceConfig(inst.id, { mode: 'inline', typewriterMode: 'inline' })}
                          >
                            <span>Inline</span>
                          </button>
                          <button
                            type="button"
                            role="radio"
                            aria-checked={((inst.config?.typewriterMode || inst.config?.mode) ?? 'inline') === 'spot'}
                            className={`btn-toggle ${((inst.config?.typewriterMode || inst.config?.mode) ?? 'inline') === 'spot' ? 'active' : ''}`}
                            onClick={() => handleUpdateInstanceConfig(inst.id, { mode: 'spot', typewriterMode: 'spot' })}
                          >
                            <span>Spot</span>
                          </button>
                          <button
                            type="button"
                            role="radio"
                            aria-checked={((inst.config?.typewriterMode || inst.config?.mode) ?? 'inline') === 'random'}
                            className={`btn-toggle ${((inst.config?.typewriterMode || inst.config?.mode) ?? 'inline') === 'random' ? 'active' : ''}`}
                            onClick={() => handleUpdateInstanceConfig(inst.id, {
                              mode: 'random',
                              typewriterMode: 'random',
                              ...((inst.config?.typewriterBankSize === undefined && inst.config?.typewriterLetterBank === undefined) ? { typewriterLetterBank: 20, typewriterBankSize: 20 } : {}),
                              ...(inst.config?.typewriterCleaning === undefined ? { typewriterCleaning: 0.2 } : {}),
                              ...(inst.config?.typewriterFadeType === undefined ? { typewriterFadeType: 'dither' } : {}),
                              ...(inst.config?.typewriterFadeTime === undefined ? { typewriterFadeTime: 0.15 } : {}),
                              ...(inst.config?.typewriterMode !== 'random' ? { fontSize: 'both' } : (inst.config?.fontSize === undefined ? { fontSize: 'both' } : {})),
                            })}
                          >
                            <span>Random</span>
                          </button>
                        </div>
                      </div>

                      {/* 1. INLINE MODE */}
                      {((inst.config?.typewriterMode || inst.config?.mode) ?? 'inline') === 'inline' && (
                        <>
                          <div>
                            <label className="text-xs text-muted mb-1 block">Direction</label>
                            <div className="grid grid-cols-4 gap-1">
                              {[
                                { dir: 'we', label: 'WE', icon: ArrowRight, title: 'West to East (Left-to-Right →)' },
                                { dir: 'ew', label: 'EW', icon: ArrowLeft, title: 'East to West (Right-to-Left ←)' },
                                { dir: 'ns', label: 'NS', icon: ArrowDown, title: 'North to South (Top-to-Bottom ↓)' },
                                { dir: 'sn', label: 'SN', icon: ArrowUp, title: 'South to North (Bottom-to-Top ↑)' },
                              ].map(item => {
                                const Icon = item.icon;
                                const isSelected = (inst.config?.typewriterDirection || 'we') === item.dir;
                                return (
                                  <button
                                    key={item.dir}
                                    type="button"
                                    title={item.title}
                                    className={`btn-toggle text-xs py-1 px-1.5 flex items-center justify-center gap-1 ${isSelected ? 'active' : ''}`}
                                    onClick={() => handleUpdateInstanceConfig(inst.id, { typewriterDirection: item.dir as any })}
                                  >
                                    <Icon className="w-3.5 h-3.5 shrink-0" />
                                    <span>{item.label}</span>
                                  </button>
                                );
                              })}
                            </div>
                            <span className="text-[10px] text-muted mt-1 block">
                              {inst.config?.typewriterDirection === 'ew' ? 'East to West (← Right-to-Left typing)' :
                               inst.config?.typewriterDirection === 'ns' ? 'North to South (↓ Top-to-Bottom column)' :
                               inst.config?.typewriterDirection === 'sn' ? 'South to North (↑ Bottom-to-Top column)' :
                               'West to East (→ Left-to-Right typing)'}
                            </span>
                          </div>

                          {((inst.config?.typewriterDirection || 'we') === 'we' || inst.config?.typewriterDirection === 'ew') ? (
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <label className="text-xs text-muted">Width</label>
                                <span className="text-[11px] font-mono text-accent">
                                  {inst.config?.typewriterWidth ?? 32}px (Height: {inst.config?.fontSize === 'big' ? 10 : 5}px auto)
                                </span>
                              </div>
                              <div className="flex items-center gap-3">
                                <input
                                  type="range"
                                  min={8}
                                  max={32}
                                  value={inst.config?.typewriterWidth ?? 32}
                                  onChange={e => handleUpdateInstanceConfig(inst.id, { typewriterWidth: parseInt(e.target.value, 10) || 32 })}
                                  className="flex-1 accent-accent"
                                />
                                <input
                                  type="number"
                                  min={4}
                                  max={32}
                                  value={inst.config?.typewriterWidth ?? 32}
                                  onChange={e => handleUpdateInstanceConfig(inst.id, { typewriterWidth: Math.min(32, Math.max(4, parseInt(e.target.value, 10) || 32)) })}
                                  className="input-text-dark text-xs w-16 text-right font-mono"
                                />
                              </div>
                            </div>
                          ) : (
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <label className="text-xs text-muted">Height</label>
                                <span className="text-[11px] font-mono text-accent">
                                  {inst.config?.typewriterHeight ?? 32}px (Width: {inst.config?.fontSize === 'big' ? 10 : 5}px auto)
                                </span>
                              </div>
                              <div className="flex items-center gap-3">
                                <input
                                  type="range"
                                  min={8}
                                  max={128}
                                  value={inst.config?.typewriterHeight ?? 32}
                                  onChange={e => handleUpdateInstanceConfig(inst.id, { typewriterHeight: parseInt(e.target.value, 10) || 32 })}
                                  className="flex-1 accent-accent"
                                />
                                <input
                                  type="number"
                                  min={4}
                                  max={128}
                                  value={inst.config?.typewriterHeight ?? 32}
                                  onChange={e => handleUpdateInstanceConfig(inst.id, { typewriterHeight: Math.min(128, Math.max(4, parseInt(e.target.value, 10) || 32)) })}
                                  className="input-text-dark text-xs w-16 text-right font-mono"
                                />
                              </div>
                            </div>
                          )}

                          <div>
                            <label className="text-xs text-muted mb-1 block">Font Size</label>
                            <div className="button-pair">
                              <button
                                type="button"
                                className={`btn-toggle ${inst.config?.fontSize !== 'big' ? 'active' : ''}`}
                                onClick={() => handleUpdateInstanceConfig(inst.id, { fontSize: 'small' })}
                              >
                                <span>Small</span>
                              </button>
                              <button
                                type="button"
                                className={`btn-toggle ${inst.config?.fontSize === 'big' ? 'active' : ''}`}
                                onClick={() => handleUpdateInstanceConfig(inst.id, { fontSize: 'big' })}
                              >
                                <span>Big</span>
                              </button>
                            </div>
                          </div>

                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="text-xs text-muted">Cleaning (Auto-add space on idle)</label>
                              <span className="text-[11px] font-mono text-accent">
                                {(inst.config?.typewriterCleaning ?? 0) === 0 ? 'Off' : `${inst.config?.typewriterCleaning}s`}
                              </span>
                            </div>
                            <div className="flex items-center gap-3">
                              <input
                                type="range"
                                min={0}
                                max={15}
                                step={1}
                                value={inst.config?.typewriterCleaning ?? 0}
                                onChange={e => handleUpdateInstanceConfig(inst.id, { typewriterCleaning: parseInt(e.target.value, 10) || 0 })}
                                className="flex-1 accent-accent"
                              />
                              <input
                                type="number"
                                min={0}
                                max={60}
                                value={inst.config?.typewriterCleaning ?? 0}
                                onChange={e => handleUpdateInstanceConfig(inst.id, { typewriterCleaning: Math.max(0, parseInt(e.target.value, 10) || 0) })}
                                className="input-text-dark text-xs w-16 text-right font-mono"
                              />
                            </div>
                            <span className="text-[10px] text-muted mt-1 block">
                              {(inst.config?.typewriterCleaning ?? 0) === 0
                                ? 'Off: Idle text remains on screen until new typing arrives.'
                                : `Auto-adds a space every ${inst.config?.typewriterCleaning}s during idle to clear the screen.`}
                            </span>
                          </div>
                        </>
                      )}

                      {/* 2. SPOT MODE */}
                      {((inst.config?.typewriterMode || inst.config?.mode) ?? 'inline') === 'spot' && (
                        <>
                          <div>
                            <label className="text-xs text-muted mb-1 block">Size</label>
                            <div className="button-pair">
                              <button
                                type="button"
                                className={`btn-toggle ${inst.config?.fontSize !== 'big' ? 'active' : ''}`}
                                onClick={() => handleUpdateInstanceConfig(inst.id, { fontSize: 'small' })}
                              >
                                <span>Small</span>
                              </button>
                              <button
                                type="button"
                                className={`btn-toggle ${inst.config?.fontSize === 'big' ? 'active' : ''}`}
                                onClick={() => handleUpdateInstanceConfig(inst.id, { fontSize: 'big' })}
                              >
                                <span>Big</span>
                              </button>
                            </div>
                            <span className="text-[10px] text-muted mt-1 block">
                              Single letter footprint: {inst.config?.fontSize === 'big' ? '10×10px' : '5×5px'}.
                            </span>
                          </div>

                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="text-xs text-muted">Cleaning (Wipe delay)</label>
                              <span className="text-[11px] font-mono text-accent">
                                {(inst.config?.typewriterCleaning ?? 0) === 0 ? 'Off (keep latest)' : `${inst.config?.typewriterCleaning}s`}
                              </span>
                            </div>
                            <div className="flex items-center gap-3">
                              <input
                                type="range"
                                min={0}
                                max={10}
                                step={1}
                                value={inst.config?.typewriterCleaning ?? 0}
                                onChange={e => handleUpdateInstanceConfig(inst.id, { typewriterCleaning: parseInt(e.target.value, 10) || 0 })}
                                className="flex-1 accent-accent"
                              />
                              <input
                                type="number"
                                min={0}
                                max={60}
                                value={inst.config?.typewriterCleaning ?? 0}
                                onChange={e => handleUpdateInstanceConfig(inst.id, { typewriterCleaning: Math.max(0, parseInt(e.target.value, 10) || 0) })}
                                className="input-text-dark text-xs w-16 text-right font-mono"
                              />
                            </div>
                            <span className="text-[10px] text-muted mt-1 block">
                              {(inst.config?.typewriterCleaning ?? 0) === 0
                                ? 'Off: Keeps latest letter displayed indefinitely.'
                                : `Wipes letter after ${inst.config?.typewriterCleaning}s of keyboard inactivity.`}
                            </span>
                          </div>
                        </>
                      )}

                      {/* 3. RANDOM MODE */}
                      {((inst.config?.typewriterMode || inst.config?.mode) ?? 'inline') === 'random' && (
                        <>
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="text-xs text-muted">Box Width</label>
                              <span className="text-[11px] font-mono text-accent">{inst.config?.typewriterWidth ?? 32}px</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <input
                                type="range"
                                min={8}
                                max={32}
                                value={inst.config?.typewriterWidth ?? 32}
                                onChange={e => handleUpdateInstanceConfig(inst.id, { typewriterWidth: parseInt(e.target.value, 10) || 32 })}
                                className="flex-1 accent-accent"
                              />
                              <input
                                type="number"
                                min={4}
                                max={32}
                                value={inst.config?.typewriterWidth ?? 32}
                                onChange={e => handleUpdateInstanceConfig(inst.id, { typewriterWidth: Math.min(32, Math.max(4, parseInt(e.target.value, 10) || 32)) })}
                                className="input-text-dark text-xs w-16 text-right font-mono"
                              />
                            </div>
                          </div>

                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="text-xs text-muted">Box Height</label>
                              <span className="text-[11px] font-mono text-accent">{inst.config?.typewriterHeight ?? 32}px</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <input
                                type="range"
                                min={8}
                                max={128}
                                value={inst.config?.typewriterHeight ?? 32}
                                onChange={e => handleUpdateInstanceConfig(inst.id, { typewriterHeight: parseInt(e.target.value, 10) || 32 })}
                                className="flex-1 accent-accent"
                              />
                              <input
                                type="number"
                                min={4}
                                max={128}
                                value={inst.config?.typewriterHeight ?? 32}
                                onChange={e => handleUpdateInstanceConfig(inst.id, { typewriterHeight: Math.min(128, Math.max(4, parseInt(e.target.value, 10) || 32)) })}
                                className="input-text-dark text-xs w-16 text-right font-mono"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="text-xs text-muted mb-1 block">Font Size</label>
                            <div className="button-trio">
                              <button
                                type="button"
                                className={`btn-toggle ${inst.config?.fontSize === 'small' ? 'active' : ''}`}
                                onClick={() => handleUpdateInstanceConfig(inst.id, { fontSize: 'small' })}
                              >
                                <span>Small</span>
                              </button>
                              <button
                                type="button"
                                className={`btn-toggle ${inst.config?.fontSize === 'big' ? 'active' : ''}`}
                                onClick={() => handleUpdateInstanceConfig(inst.id, { fontSize: 'big' })}
                              >
                                <span>Big</span>
                              </button>
                              <button
                                type="button"
                                className={`btn-toggle ${(inst.config?.fontSize === 'both' || !inst.config?.fontSize) ? 'active' : ''}`}
                                onClick={() => handleUpdateInstanceConfig(inst.id, { fontSize: 'both' })}
                              >
                                <span>Both</span>
                              </button>
                            </div>
                            <span className="text-[10px] text-muted mt-1 block">
                              {inst.config?.fontSize === 'small'
                                ? '5×5px compact font.'
                                : inst.config?.fontSize === 'big'
                                  ? '10×10px large font.'
                                  : 'Randomly mixes 5×5px and 10×10px letters.'}
                            </span>
                          </div>

                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="text-xs text-muted">Letter Bank</label>
                              <span className="text-[11px] font-mono text-accent">
                                {inst.config?.typewriterBankSize ?? inst.config?.typewriterLetterBank ?? 20} letters
                              </span>
                            </div>
                            <div className="flex items-center gap-3">
                              <input
                                type="range"
                                min={1}
                                max={32}
                                step={1}
                                value={inst.config?.typewriterBankSize ?? inst.config?.typewriterLetterBank ?? 20}
                                onChange={e => {
                                  const val = parseInt(e.target.value, 10) || 1;
                                  handleUpdateInstanceConfig(inst.id, { typewriterLetterBank: val, typewriterBankSize: val });
                                }}
                                className="flex-1 accent-accent"
                              />
                              <input
                                type="number"
                                min={1}
                                max={50}
                                value={inst.config?.typewriterBankSize ?? inst.config?.typewriterLetterBank ?? 20}
                                onChange={e => {
                                  const val = Math.max(1, parseInt(e.target.value, 10) || 1);
                                  handleUpdateInstanceConfig(inst.id, { typewriterLetterBank: val, typewriterBankSize: val });
                                }}
                                className="input-text-dark text-xs w-16 text-right font-mono"
                              />
                            </div>
                            <span className="text-[10px] text-muted mt-1 block">
                              How many letters to keep before older ones start disappearing.
                            </span>
                          </div>

                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="text-xs text-muted">Cleaning (Wipe delay)</label>
                              <span className="text-[11px] font-mono text-accent">
                                {(inst.config?.typewriterCleaning ?? 0.2) === 0 ? 'Off' : `${Number((inst.config?.typewriterCleaning ?? 0.2).toFixed(2))}s`}
                              </span>
                            </div>
                            <div className="flex items-center gap-3">
                              <input
                                type="range"
                                min={0}
                                max={2}
                                step={0.05}
                                value={inst.config?.typewriterCleaning ?? 0.2}
                                onChange={e => {
                                  const val = Math.max(0, Math.round(parseFloat(e.target.value) * 100) / 100 || 0);
                                  handleUpdateInstanceConfig(inst.id, { typewriterCleaning: val });
                                }}
                                className="flex-1 accent-accent"
                              />
                              <input
                                type="number"
                                min={0}
                                max={2}
                                step={0.05}
                                value={inst.config?.typewriterCleaning ?? 0.2}
                                onChange={e => {
                                  if (e.target.value === '') return;
                                  const parsed = parseFloat(e.target.value);
                                  if (isNaN(parsed)) return;
                                  const val = Math.min(2, Math.max(0, Math.round(parsed * 100) / 100));
                                  handleUpdateInstanceConfig(inst.id, { typewriterCleaning: val });
                                }}
                                onBlur={e => {
                                  if (e.target.value === '' || isNaN(parseFloat(e.target.value))) {
                                    handleUpdateInstanceConfig(inst.id, { typewriterCleaning: 0.2 });
                                  }
                                }}
                                className="input-text-dark text-xs w-16 text-right font-mono"
                              />
                            </div>
                            <span className="text-[10px] text-muted mt-1 block">
                              {(inst.config?.typewriterCleaning ?? 0.2) === 0
                                ? 'Off: Letters stay on screen until replaced by new keystrokes.'
                                : `Auto-removes the oldest letter every ${Number((inst.config?.typewriterCleaning ?? 0.2).toFixed(2))}s during idle to empty the bank.`}
                            </span>
                          </div>

                          {(inst.config?.typewriterCleaning ?? 0.2) > 0 && (
                            <>
                              <div>
                                <label className="text-xs text-muted mb-1 block">Fade Effect</label>
                                <select
                                  aria-label="Fade Effect"
                                  value={inst.config?.typewriterFadeType ?? 'dither'}
                                  onChange={e => handleUpdateInstanceConfig(inst.id, { typewriterFadeType: e.target.value as TypewriterFadeType })}
                                  className="select-dark text-xs w-full"
                                >
                                  <option value="instant">Instant</option>
                                  <option value="dither">Dither (Bayer 1bpp matrix pattern decay)</option>
                                  <option value="dissolve">Dissolve (random pixel drop)</option>
                                  <option value="blink">Blink (flashing out)</option>
                                </select>
                                <span className="text-[10px] text-muted mt-1 block">
                                  Visual transition effect when letters are cleaned up during idle.
                                </span>
                              </div>

                              <div>
                                <div className="flex items-center justify-between mb-1">
                                  <label className="text-xs text-muted">Fade Time</label>
                                  <span className="text-[11px] font-mono text-accent">
                                    {`${Number((inst.config?.typewriterFadeTime ?? 0.15).toFixed(2))}s`}
                                  </span>
                                </div>
                                <div className="flex items-center gap-3">
                                  <input
                                    type="range"
                                    aria-label="Fade Time Slider"
                                    min={0}
                                    max={2.0}
                                    step={0.05}
                                    value={inst.config?.typewriterFadeTime ?? 0.15}
                                    onChange={e => {
                                      const parsed = parseFloat(e.target.value);
                                      const val = isNaN(parsed) ? 0 : Math.min(2.0, Math.max(0, Math.round(parsed * 100) / 100));
                                      handleUpdateInstanceConfig(inst.id, { typewriterFadeTime: val });
                                    }}
                                    className="flex-1 accent-accent"
                                  />
                                  <input
                                    type="number"
                                    aria-label="Fade Time Number"
                                    min={0}
                                    max={2.0}
                                    step={0.05}
                                    value={inst.config?.typewriterFadeTime ?? 0.15}
                                    onChange={e => {
                                      if (e.target.value === '') return;
                                      const parsed = parseFloat(e.target.value);
                                      if (isNaN(parsed)) return;
                                      const val = Math.min(2.0, Math.max(0, Math.round(parsed * 100) / 100));
                                      handleUpdateInstanceConfig(inst.id, { typewriterFadeTime: val });
                                    }}
                                    onBlur={e => {
                                      if (e.target.value === '' || isNaN(parseFloat(e.target.value))) {
                                        handleUpdateInstanceConfig(inst.id, { typewriterFadeTime: 0.15 });
                                      }
                                    }}
                                    className="input-text-dark text-xs w-16 text-right font-mono"
                                  />
                                </div>
                                <span className="text-[10px] text-muted mt-1 block">
                                  Duration the fade transition takes when letters disappear.
                                </span>
                              </div>
                            </>
                          )}
                        </>
                      )}
                    </div>
                  )}

                  {activeWidget.id === 'wpm-chart' && (
                    <div className="flex flex-col gap-2">
                      <label className="text-xs text-muted mb-1 block">Width ({inst.config?.wpmChart?.width ?? 32}px)</label>
                      <input type="range" min={16} max={68} value={inst.config?.wpmChart?.width ?? 32} onChange={e => handleUpdateInstanceConfig(inst.id, { wpmChart: { ...(inst.config?.wpmChart || { width: 32, height: 24, gridSize: 4, targetSpeed: 100 }), width: parseInt(e.target.value) } })} className="w-full mb-2" />
                      
                      <label className="text-xs text-muted mb-1 block">Height ({inst.config?.wpmChart?.height ?? 24}px)</label>
                      <input type="range" min={12} max={64} value={inst.config?.wpmChart?.height ?? 24} onChange={e => handleUpdateInstanceConfig(inst.id, { wpmChart: { ...(inst.config?.wpmChart || { width: 32, height: 24, gridSize: 4, targetSpeed: 100 }), height: parseInt(e.target.value) } })} className="w-full mb-2" />
                      
                      <label className="text-xs text-muted mb-1 block">Grid Size ({inst.config?.wpmChart?.gridSize ?? 4}px) - 0 disables border & grid</label>
                      <input type="range" min={0} max={12} value={inst.config?.wpmChart?.gridSize ?? 4} onChange={e => handleUpdateInstanceConfig(inst.id, { wpmChart: { ...(inst.config?.wpmChart || { width: 32, height: 24, gridSize: 4, targetSpeed: 100 }), gridSize: parseInt(e.target.value) } })} className="w-full mb-2" />
                      
                      <label className="text-xs text-muted mb-1 block">Target Speed</label>
                      <input type="number" min={40} max={250} value={inst.config?.wpmChart?.targetSpeed ?? 100} onChange={e => handleUpdateInstanceConfig(inst.id, { wpmChart: { ...(inst.config?.wpmChart || { width: 32, height: 24, gridSize: 4, targetSpeed: 100, timeWindow: 30 }), targetSpeed: parseInt(e.target.value) || 100 } })} className="input-text-dark text-xs w-full mb-2" />
                      
                      <label className="text-xs text-muted mb-1 block">Time Window ({inst.config?.wpmChart?.timeWindow ?? 30}s history)</label>
                      <input type="range" min={10} max={120} step={5} value={inst.config?.wpmChart?.timeWindow ?? 30} onChange={e => handleUpdateInstanceConfig(inst.id, { wpmChart: { ...(inst.config?.wpmChart || { width: 32, height: 24, gridSize: 4, targetSpeed: 100, timeWindow: 30 }), timeWindow: parseInt(e.target.value) || 30 } })} className="w-full mb-2" />
                    </div>
                  )}
                  
                  {/* Symbol Mode Settings */}
                  {activeWidget.id !== 'wpm-chart' && activeWidget.id !== 'branding' && activeWidget.id !== 'typewriter' && activeWidget.id !== 'keypress' && (inst.config?.mode === 'symbol' || !inst.config?.mode) && (
                    <div className="flex flex-col gap-2">
                      {activeWidget.id === 'battery' && (
                        <div>
                          <label className="text-xs text-muted mb-1 block">Symbol Group (Needs 2+ slices)</label>
                          <select value={inst.config?.groupId || ''} onChange={e => handleUpdateInstanceConfig(inst.id, { groupId: e.target.value })} className="select-dark text-xs w-full">
                            <option value="">-- Select Group (2+ slices) --</option>
                            {symbolSlices.filter(s => s.groupOrder === 1 && symbolSlices.filter(m => m.groupId === s.groupId).length >= 2).map(s => <option key={s.groupId} value={s.groupId}>{s.name || s.id} ({symbolSlices.filter(m => m.groupId === s.groupId).length} slices)</option>)}
                          </select>
                        </div>
                      )}
                      
                      {activeWidget.id === 'connection' && (
                        <div className="flex flex-col gap-3">
                          <div>
                            <label className="text-xs text-muted mb-1 block">USB Symbol (1 slice)</label>
                            <select value={inst.config?.groupId || ''} onChange={e => handleUpdateInstanceConfig(inst.id, { groupId: e.target.value })} className="select-dark text-xs w-full">
                              <option value="">-- Select Symbol / Group (1 slice) --</option>
                              {symbolSlices.filter(s => s.groupOrder === 1 && symbolSlices.filter(m => m.groupId === s.groupId).length === 1).map(s => <option key={s.groupId} value={s.groupId}>{s.name || s.id}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="text-xs text-muted mb-1 block">Bluetooth Profile Symbols (1 slice each)</label>
                            {['No connection', 'P1', 'P2', 'P3', 'P4', 'P5'].map((label, idx) => (
                              <div key={idx} className="flex items-center gap-2 mb-1">
                                <span className="text-[10px] w-24 text-muted">{label}</span>
                                <select value={inst.config?.groupIds?.[idx] || ''} onChange={e => {
                                  const newIds = [...(inst.config?.groupIds || [])];
                                  newIds[idx] = e.target.value;
                                  handleUpdateInstanceConfig(inst.id, { groupIds: newIds });
                                }} className="select-dark text-xs flex-1">
                                  <option value="">-- Select Symbol / Group (1 slice) --</option>
                                  {symbolSlices.filter(s => s.groupOrder === 1 && symbolSlices.filter(m => m.groupId === s.groupId).length === 1).map(s => <option key={s.groupId} value={s.groupId}>{s.name || s.id}</option>)}
                                </select>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {activeWidget.id === 'split' && (
                        <div>
                          <label className="text-xs text-muted mb-1 block">Symbol Group (2 slices: Connected / Not connected)</label>
                          <select value={inst.config?.groupId || ''} onChange={e => handleUpdateInstanceConfig(inst.id, { groupId: e.target.value })} className="select-dark text-xs w-full">
                            <option value="">-- Select Group (2 slices) --</option>
                            {symbolSlices.filter(s => s.groupOrder === 1 && symbolSlices.filter(m => m.groupId === s.groupId).length === 2).map(s => <option key={s.groupId} value={s.groupId}>{s.name || s.id}</option>)}
                          </select>
                        </div>
                      )}
                      
                      {activeWidget.id === 'caps-lock' && (
                        <div>
                          <label className="text-xs text-muted mb-1 block">Symbol Group (2 slices: On / Off)</label>
                          <select value={inst.config?.groupId || ''} onChange={e => handleUpdateInstanceConfig(inst.id, { groupId: e.target.value })} className="select-dark text-xs w-full">
                            <option value="">-- Select Group (2 slices) --</option>
                            {symbolSlices.filter(s => s.groupOrder === 1 && symbolSlices.filter(m => m.groupId === s.groupId).length === 2).map(s => <option key={s.groupId} value={s.groupId}>{s.name || s.id}</option>)}
                          </select>
                        </div>
                      )}

                      {activeWidget.id === 'layer-banner' && (
                        <div>
                          <label className="text-xs text-muted mb-2 block">Layer Groups (1 slice each)</label>
                          <div className="flex flex-col gap-2">
                            {effectiveLayerNames.map((name, idx) => (
                              <div key={idx} className="flex items-center gap-2">
                                <span className="text-xs text-text-main font-medium shrink-0 min-w-[130px] truncate" title={formatLayerLabel(idx, name)}>
                                  {formatLayerLabel(idx, name)}
                                </span>
                                <select
                                  value={inst.config?.groupIds?.[idx] || ''}
                                  onChange={e => {
                                    const newIds = [...(inst.config?.groupIds || [])];
                                    newIds[idx] = e.target.value;
                                    handleUpdateInstanceConfig(inst.id, { groupIds: newIds });
                                  }}
                                  className="select-dark text-xs flex-1"
                                >
                                  <option value="">-- Select Group (1 slice) --</option>
                                  {symbolSlices
                                    .filter(s => s.groupOrder === 1 && symbolSlices.filter(m => m.groupId === s.groupId).length === 1)
                                    .map(s => (
                                      <option key={s.groupId} value={s.groupId}>
                                        {s.name || s.id}
                                      </option>
                                    ))}
                                </select>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {activeWidget.id === 'wpm' && (
                        <div>
                          <label className="text-xs text-muted mb-1 block">Target WPM</label>
                          <input type="number" min={10} max={255} value={inst.config?.targetValue || 100} onChange={e => handleUpdateInstanceConfig(inst.id, { targetValue: parseInt(e.target.value) || 100 })} className="input-text-dark text-xs w-full mb-2" />
                          <label className="text-xs text-muted mb-1 block">Symbol Group (2+ slices)</label>
                          <select value={inst.config?.groupId || ''} onChange={e => handleUpdateInstanceConfig(inst.id, { groupId: e.target.value })} className="select-dark text-xs w-full">
                            <option value="">-- Select Group (2+ slices) --</option>
                            {symbolSlices.filter(s => s.groupOrder === 1 && symbolSlices.filter(m => m.groupId === s.groupId).length >= 2).map(s => <option key={s.groupId} value={s.groupId}>{s.name || s.id} ({symbolSlices.filter(m => m.groupId === s.groupId).length} slices)</option>)}
                          </select>
                        </div>
                      )}

                      {activeWidget.id === 'screensaver' && (
                        <div>
                          <label className="text-xs text-muted mb-1 block">Image Symbol / Group</label>
                          <select
                            value={inst.config?.groupId || ''}
                            onChange={e => handleUpdateInstanceConfig(inst.id, { groupId: e.target.value })}
                            className="select-dark text-xs w-full"
                          >
                            <option value="">-- Select Symbol / Group --</option>
                            {symbolSlices
                              .filter(s => s.groupOrder === 1 || !s.groupOrder)
                              .map(s => (
                                <option key={s.groupId || s.id} value={s.groupId || s.id}>
                                  {s.name || s.id} ({s.width}×{s.height}px)
                                </option>
                              ))}
                          </select>
                        </div>
                      )}

                      {activeWidget.id === 'bongo' && (
                        <div className="flex flex-col gap-3">
                          <div>
                            <label className="text-xs text-muted mb-1 block">Bongo Cat Group (3 slices: Neutral, Left Paw, Right Paw)</label>
                            <select
                              value={inst.config?.groupId || ''}
                              onChange={e => handleUpdateInstanceConfig(inst.id, { groupId: e.target.value })}
                              className="select-dark text-xs w-full"
                            >
                              <option value="">-- Select Group (3 slices) --</option>
                              {symbolSlices
                                .filter(s => s.groupOrder === 1 && symbolSlices.filter(m => m.groupId === s.groupId).length >= 3)
                                .map(s => {
                                  const count = symbolSlices.filter(m => m.groupId === s.groupId).length;
                                  return (
                                    <option key={s.groupId} value={s.groupId}>
                                      {s.name || s.groupId} ({count} slices)
                                    </option>
                                  );
                                })}
                            </select>
                            <span className="text-[10px] text-muted mt-1 block">
                              Slice 1: Neutral/Idle pose · Slice 2: Left arm tap · Slice 3: Right arm tap
                            </span>
                          </div>

                          <div>
                            <label className="text-xs text-muted mb-1 block">
                              Tap Duration: {inst.config?.bongoTapMs ?? 60}ms
                            </label>
                            <div className="flex items-center gap-3">
                              <input
                                type="range"
                                min={30}
                                max={200}
                                step={5}
                                value={inst.config?.bongoTapMs ?? 60}
                                onChange={e => handleUpdateInstanceConfig(inst.id, { bongoTapMs: parseInt(e.target.value, 10) })}
                                className="flex-1 accent-accent"
                              />
                              <span className="text-xs font-mono text-text-main w-12 text-right">
                                {inst.config?.bongoTapMs ?? 60}ms
                              </span>
                            </div>
                            <span className="text-[10px] text-muted mt-1 block">
                              Matches firmware CONFIG_SCYAN_BONGO_TAP_MS (default 60ms). Duration paw holds down.
                            </span>
                          </div>

                          <div>
                            <label className="text-xs text-muted mb-1 block">
                              Debounce Interval: {inst.config?.bongoDebounceMs ?? 100}ms
                            </label>
                            <div className="flex items-center gap-3">
                              <input
                                type="range"
                                min={50}
                                max={300}
                                step={10}
                                value={inst.config?.bongoDebounceMs ?? 100}
                                onChange={e => handleUpdateInstanceConfig(inst.id, { bongoDebounceMs: parseInt(e.target.value, 10) })}
                                className="flex-1 accent-accent"
                              />
                              <span className="text-xs font-mono text-text-main w-12 text-right">
                                {inst.config?.bongoDebounceMs ?? 100}ms
                              </span>
                            </div>
                            <span className="text-[10px] text-muted mt-1 block">
                              Cooldown between taps. Suppresses instant rapid flailing and enforces idle poses.
                            </span>
                          </div>
                        </div>
                      )}

                      {(activeWidget.id === 'animation' || activeWidget.id === 'loop') && (
                        <div className="flex flex-col gap-3">
                          <div>
                            <label className="text-xs text-muted mb-1 block">Animation Symbol Group</label>
                            <select
                              value={inst.config?.groupId || ''}
                              onChange={e => handleUpdateInstanceConfig(inst.id, { groupId: e.target.value })}
                              className="select-dark text-xs w-full"
                            >
                              <option value="">-- Select Symbol Group --</option>
                              {symbolSlices
                                .filter(s => s.groupOrder === 1 || !s.groupOrder)
                                .map(s => {
                                  const groupCount = symbolSlices.filter(m => m.groupId === s.groupId).length;
                                  return (
                                    <option key={s.groupId || s.id} value={s.groupId || s.id}>
                                      {s.name || s.groupId || s.id} ({groupCount} {groupCount === 1 ? 'slice' : 'frames'})
                                    </option>
                                  );
                                })}
                            </select>
                            <span className="text-[10px] text-muted mt-1 block">
                              Cycles sequentially through all slices in this group by order.
                            </span>
                          </div>

                          <div className="flex items-center gap-2 pt-1">
                            <input
                              type="checkbox"
                              id={`loop-check-${inst.id}`}
                              checked={inst.config?.loop ?? true}
                              onChange={e => handleUpdateInstanceConfig(inst.id, { loop: e.target.checked })}
                              className="accent-accent h-4 w-4 rounded cursor-pointer"
                            />
                            <label htmlFor={`loop-check-${inst.id}`} className="text-xs text-text-main font-medium cursor-pointer select-none">
                              Loop
                            </label>
                          </div>
                          <span className="text-[10px] text-muted -mt-2 block">
                            When checked, repeats indefinitely. When unchecked, runs once and stops at the last slice.
                          </span>

                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="text-xs text-muted">
                                Speed / Frame Duration
                              </label>
                              <span className="text-[11px] font-mono text-accent">
                                {inst.config?.loopSpeedMs ?? 250}ms ({((1000 / (inst.config?.loopSpeedMs ?? 250))).toFixed(1)} FPS)
                              </span>
                            </div>
                            <div className="flex items-center gap-3">
                              <input
                                type="range"
                                min={50}
                                max={1500}
                                step={25}
                                value={inst.config?.loopSpeedMs ?? 250}
                                onChange={e => handleUpdateInstanceConfig(inst.id, { loopSpeedMs: parseInt(e.target.value, 10) || 250 })}
                                className="flex-1 accent-accent"
                              />
                              <input
                                type="number"
                                min={20}
                                max={5000}
                                value={inst.config?.loopSpeedMs ?? 250}
                                onChange={e => handleUpdateInstanceConfig(inst.id, { loopSpeedMs: Math.max(20, parseInt(e.target.value, 10) || 250) })}
                                className="input-text-dark text-xs w-20 text-right font-mono"
                              />
                            </div>
                            {(inst.config?.loopSpeedMs ?? 250) < 150 && (
                              <div className="mt-2 text-[11px] text-amber-400 bg-amber-950/30 border border-amber-800/40 rounded p-2">
                                ⚠️ <strong>Battery Warning</strong>: Speeds under 150ms (&gt;6.7 FPS) trigger rapid I2C screen blits that increase microcontroller wake-ups and accelerate battery drain on wireless split keyboards.
                              </div>
                            )}
                            <span className="text-[10px] text-muted mt-1 block">
                              Duration in milliseconds each symbol frame remains on screen before cycling to the next frame.
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Keypress Widget Settings */}
                  {activeWidget.id === 'keypress' && (
                    <div className="flex flex-col gap-4">
                      {/* Idle Symbol */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs font-semibold text-text-main">
                            Idle Symbol
                          </label>
                          <span className="text-[10px] text-muted">
                            Optional fallback when no key is held
                          </span>
                        </div>
                        <select
                          value={inst.config?.idleSymbolId || inst.config?.keypressIdleSymbolId || ''}
                          onChange={e => {
                            const val = e.target.value || undefined;
                            handleUpdateInstanceConfig(inst.id, {
                              idleSymbolId: val,
                              keypressIdleSymbolId: val,
                            });
                          }}
                          className="select-dark text-xs w-full"
                        >
                          <option value="">(None - keep last key pressed symbol)</option>
                          {symbolSlices.map(s => (
                            <option key={s.id} value={s.id}>
                              {s.name || s.id} ({s.width}×{s.height}px)
                            </option>
                          ))}
                        </select>
                        <span className="text-[10px] text-muted mt-1 block">
                          If idle is not given, the last key pressed symbol stays on until the next symbol.
                        </span>
                      </div>

                      {/* Key-Symbol Elements List */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-xs font-semibold text-text-main">
                            Key-to-Symbol Mappings ({(inst.config?.keypressElements || []).length})
                          </label>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                const up = symbolSlices.find(s => s.id === 'SYMBOL_ARROW_UP')?.id || 'SYMBOL_ARROW_UP';
                                const down = symbolSlices.find(s => s.id === 'SYMBOL_ARROW_DOWN')?.id || 'SYMBOL_ARROW_DOWN';
                                const left = symbolSlices.find(s => s.id === 'SYMBOL_ARROW_LEFT')?.id || 'SYMBOL_ARROW_LEFT';
                                const right = symbolSlices.find(s => s.id === 'SYMBOL_ARROW_RIGHT')?.id || 'SYMBOL_ARROW_RIGHT';
                                handleUpdateInstanceConfig(inst.id, {
                                  keypressElements: [
                                    { key: 'ArrowUp', symbolId: up },
                                    { key: 'ArrowDown', symbolId: down },
                                    { key: 'ArrowLeft', symbolId: left },
                                    { key: 'ArrowRight', symbolId: right },
                                  ],
                                  keypressBindings: [
                                    { key: 'ArrowUp', symbolId: up },
                                    { key: 'ArrowDown', symbolId: down },
                                    { key: 'ArrowLeft', symbolId: left },
                                    { key: 'ArrowRight', symbolId: right },
                                  ],
                                });
                              }}
                              className="text-[10px] text-muted hover:text-accent cursor-pointer"
                              title="Reset mapping to arrow keys"
                            >
                              Reset Arrows
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const curr = inst.config?.keypressElements || [];
                                const defaultSym = symbolSlices[0]?.id || 'SYMBOL_ARROW_UP';
                                const next = [...curr, { key: '', symbolId: defaultSym }];
                                handleUpdateInstanceConfig(inst.id, {
                                  keypressElements: next,
                                  keypressBindings: next,
                                });
                              }}
                              className="btn-chip active text-xs py-0.5 px-2 cursor-pointer"
                            >
                              + Add Element
                            </button>
                          </div>
                        </div>

                        <div className="space-y-2">
                          {(inst.config?.keypressElements || []).map((el, idx) => (
                            <div key={idx} className="flex items-center gap-2 bg-[#0c1017] p-2 rounded border border-border/30">
                              <div className="w-1/3">
                                <input
                                  type="text"
                                  value={el.key}
                                  placeholder="Key (e.g. ArrowUp)"
                                  onChange={e => {
                                    const next = [...(inst.config?.keypressElements || [])];
                                    next[idx] = { ...next[idx], key: e.target.value };
                                    handleUpdateInstanceConfig(inst.id, { keypressElements: next, keypressBindings: next });
                                  }}
                                  className="input-text-dark text-xs w-full font-mono"
                                />
                              </div>
                              <div className="flex-1 min-w-0">
                                <select
                                  value={el.symbolId}
                                  onChange={e => {
                                    const next = [...(inst.config?.keypressElements || [])];
                                    next[idx] = { ...next[idx], symbolId: e.target.value };
                                    handleUpdateInstanceConfig(inst.id, { keypressElements: next, keypressBindings: next });
                                  }}
                                  className="select-dark text-xs w-full font-mono"
                                >
                                  {symbolSlices.map(s => (
                                    <option key={s.id} value={s.id}>
                                      {s.name || s.id} ({s.width}×{s.height})
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  const next = (inst.config?.keypressElements || []).filter((_, i) => i !== idx);
                                  handleUpdateInstanceConfig(inst.id, { keypressElements: next, keypressBindings: next });
                                }}
                                className="text-muted hover:text-red-400 p-1 cursor-pointer"
                                title="Remove mapping"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          ))}

                          {(inst.config?.keypressElements || []).length === 0 && (
                            <div className="text-xs text-muted italic p-2 text-center border border-dashed border-border/30 rounded">
                              No key elements configured. Click "+ Add Element" to map keys to symbols.
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Font Mode Settings */}
                  {activeWidget.id !== 'wpm-chart' && activeWidget.id !== 'branding' && activeWidget.id !== 'typewriter' && activeWidget.id !== 'keypress' && inst.config?.mode === 'font' && (
                    <div className="flex flex-col gap-3">
                      <div>
                        <label className="text-xs text-muted mb-1 block">Font Size</label>
                        <div className="button-pair">
                          <button
                            type="button"
                            className={`btn-toggle ${inst.config?.fontSize !== 'big' ? 'active' : ''}`}
                            onClick={() => handleUpdateInstanceConfig(inst.id, { fontSize: 'small' })}
                          >
                            <span>Small</span>
                          </button>
                          <button
                            type="button"
                            className={`btn-toggle ${inst.config?.fontSize === 'big' ? 'active' : ''}`}
                            onClick={() => handleUpdateInstanceConfig(inst.id, { fontSize: 'big' })}
                          >
                            <span>Big</span>
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="text-xs text-muted mb-1 block">Text Alignment</label>
                        <div className="button-trio" role="radiogroup" aria-label="Text Alignment">
                          <button
                            type="button"
                            role="radio"
                            aria-checked={(inst.config?.textAlign || 'center') === 'left'}
                            className={`btn-toggle ${(inst.config?.textAlign || 'center') === 'left' ? 'active' : ''}`}
                            onClick={() => handleUpdateInstanceConfig(inst.id, { textAlign: 'left', align: 'left' })}
                            title="Left align"
                          >
                            <AlignLeft size={13} />
                            <span>Left</span>
                          </button>
                          <button
                            type="button"
                            role="radio"
                            aria-checked={(inst.config?.textAlign || 'center') === 'center'}
                            className={`btn-toggle ${(inst.config?.textAlign || 'center') === 'center' ? 'active' : ''}`}
                            onClick={() => handleUpdateInstanceConfig(inst.id, { textAlign: 'center', align: 'center' })}
                            title="Center align"
                          >
                            <AlignCenter size={13} />
                            <span>Center</span>
                          </button>
                          <button
                            type="button"
                            role="radio"
                            aria-checked={(inst.config?.textAlign || 'center') === 'right'}
                            className={`btn-toggle ${(inst.config?.textAlign || 'center') === 'right' ? 'active' : ''}`}
                            onClick={() => handleUpdateInstanceConfig(inst.id, { textAlign: 'right', align: 'right' })}
                            title="Right align"
                          >
                            <AlignRight size={13} />
                            <span>Right</span>
                          </button>
                        </div>
                      </div>

                      {activeWidget.id === 'battery' && (
                        <div>
                          <label className="text-xs text-muted mb-1 block">Divisions: {inst.config?.fontDivisionCount || 2}</label>
                          <input type="range" min={2} max={100} value={inst.config?.fontDivisionCount || 2} onChange={e => handleUpdateInstanceConfig(inst.id, { fontDivisionCount: parseInt(e.target.value) })} className="w-full mb-2" />
                          <div className="grid grid-cols-2 gap-1 max-h-32 overflow-y-auto">
                            {Array.from({ length: inst.config?.fontDivisionCount || 2 }).map((_, idx) => (
                              <input key={idx} type="text" value={inst.config?.textEntries?.[idx] || ''} onChange={e => {
                                const newTexts = [...(inst.config?.textEntries || [])];
                                newTexts[idx] = e.target.value;
                                handleUpdateInstanceConfig(inst.id, { textEntries: newTexts });
                              }} className="input-text-dark text-xs" placeholder={`Text ${idx+1}`} />
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {activeWidget.id === 'connection' && (
                        <div className="flex flex-col gap-2">
                          <div>
                            <label className="text-xs text-muted mb-1 block">USB Text</label>
                            <input
                              type="text"
                              value={inst.config?.textEntries?.[0] !== undefined ? inst.config.textEntries[0] : 'USB'}
                              onChange={e => {
                                const newTexts = [...(inst.config?.textEntries || ['USB', 'No conn', 'P1', 'P2', 'P3', 'P4', 'P5'])];
                                newTexts[0] = e.target.value;
                                handleUpdateInstanceConfig(inst.id, { textEntries: newTexts });
                              }}
                              className="input-text-dark text-xs w-full"
                              placeholder="USB"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-muted mb-1 block">Bluetooth Profile Texts</label>
                            {['No conn', 'P1', 'P2', 'P3', 'P4', 'P5'].map((label, idx) => (
                              <div key={idx} className="flex items-center gap-2 mb-1">
                                <span className="text-[10px] w-24 text-muted">{label}</span>
                                <input
                                  type="text"
                                  value={inst.config?.textEntries?.[idx + 1] !== undefined ? inst.config.textEntries[idx + 1] : label}
                                  onChange={e => {
                                    const newTexts = [...(inst.config?.textEntries || ['USB', 'No conn', 'P1', 'P2', 'P3', 'P4', 'P5'])];
                                    newTexts[idx + 1] = e.target.value;
                                    handleUpdateInstanceConfig(inst.id, { textEntries: newTexts });
                                  }}
                                  className="input-text-dark text-xs flex-1"
                                  placeholder={label}
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {activeWidget.id === 'split' && (
                        <div className="flex flex-col gap-1">
                          <input type="text" value={inst.config?.textEntries?.[0] || 'Connected'} onChange={e => handleUpdateInstanceConfig(inst.id, { textEntries: [e.target.value, inst.config?.textEntries?.[1] || ''] })} className="input-text-dark text-xs w-full" placeholder="Connected" />
                          <input type="text" value={inst.config?.textEntries?.[1] || 'Not connected'} onChange={e => handleUpdateInstanceConfig(inst.id, { textEntries: [inst.config?.textEntries?.[0] || '', e.target.value] })} className="input-text-dark text-xs w-full" placeholder="Not connected" />
                        </div>
                      )}
                      
                      {activeWidget.id === 'caps-lock' && (
                        <div className="flex flex-col gap-1">
                          <input type="text" value={inst.config?.textEntries?.[0] || 'On'} onChange={e => handleUpdateInstanceConfig(inst.id, { textEntries: [e.target.value, inst.config?.textEntries?.[1] || ''] })} className="input-text-dark text-xs w-full" placeholder="On" />
                          <input type="text" value={inst.config?.textEntries?.[1] || 'Off'} onChange={e => handleUpdateInstanceConfig(inst.id, { textEntries: [inst.config?.textEntries?.[0] || '', e.target.value] })} className="input-text-dark text-xs w-full" placeholder="Off" />
                        </div>
                      )}

                      {activeWidget.id === 'layer-banner' && (
                        <div className="flex flex-col gap-2">
                          <label className="text-xs text-muted mb-1 block">Layer Text Labels</label>
                          {effectiveLayerNames.map((name, idx) => (
                            <div key={idx} className="flex items-center gap-2">
                              <span className="text-xs text-text-main font-medium shrink-0 min-w-[130px] truncate" title={formatLayerLabel(idx, name)}>
                                {formatLayerLabel(idx, name)}
                              </span>
                              <input
                                type="text"
                                maxLength={16}
                                value={inst.config?.textEntries?.[idx] !== undefined ? inst.config.textEntries[idx] : name}
                                onChange={e => {
                                  const newTexts = [...(inst.config?.textEntries || [])];
                                  for (let i = 0; i < idx; i++) {
                                    if (newTexts[i] === undefined) {
                                      newTexts[i] = effectiveLayerNames[i] || `L${i}`;
                                    }
                                  }
                                  newTexts[idx] = e.target.value;
                                  handleUpdateInstanceConfig(inst.id, { textEntries: newTexts });
                                }}
                                className="input-text-dark text-xs flex-1"
                                placeholder={name}
                              />
                            </div>
                          ))}
                        </div>
                      )}

                      {activeWidget.id === 'wpm' && (
                        <div>
                          <label className="text-xs text-muted mb-1 block">Target WPM</label>
                          <input type="number" min={10} max={255} value={inst.config?.targetValue || 100} onChange={e => handleUpdateInstanceConfig(inst.id, { targetValue: parseInt(e.target.value) || 100 })} className="input-text-dark text-xs w-full mb-2" />
                          <label className="text-xs text-muted mb-1 block">Divisions: {inst.config?.fontDivisionCount || 2}</label>
                          <input type="range" min={2} max={inst.config?.targetValue || 100} value={inst.config?.fontDivisionCount || 2} onChange={e => handleUpdateInstanceConfig(inst.id, { fontDivisionCount: parseInt(e.target.value) })} className="w-full mb-2" />
                          <div className="grid grid-cols-2 gap-1 max-h-32 overflow-y-auto">
                            {Array.from({ length: inst.config?.fontDivisionCount || 2 }).map((_, idx) => (
                              <input key={idx} type="text" value={inst.config?.textEntries?.[idx] || ''} onChange={e => {
                                const newTexts = [...(inst.config?.textEntries || [])];
                                newTexts[idx] = e.target.value;
                                handleUpdateInstanceConfig(inst.id, { textEntries: newTexts });
                              }} className="input-text-dark text-xs" placeholder={`Text ${idx+1}`} />
                            ))}
                          </div>
                        </div>
                      )}

                      {activeWidget.id === 'screensaver' && (
                        <div>
                          <label className="text-xs text-muted mb-1 block">Fallback Text</label>
                          <input
                            type="text"
                            value={inst.config?.textEntries?.[0] || 'ZMK'}
                            onChange={e => handleUpdateInstanceConfig(inst.id, { textEntries: [e.target.value] })}
                            className="input-text-dark text-xs w-full"
                            placeholder="Fallback text"
                          />
                        </div>
                      )}

                      {activeWidget.id === 'bongo' && (
                        <div>
                          <label className="text-xs text-muted mb-1 block">Fallback Text</label>
                          <input
                            type="text"
                            value={inst.config?.textEntries?.[0] || '(=^.^=)'}
                            onChange={e => handleUpdateInstanceConfig(inst.id, { textEntries: [e.target.value] })}
                            className="input-text-dark text-xs w-full"
                            placeholder="Fallback text"
                          />
                        </div>
                      )}
                    </div>
                  )}
                  </div>
                </div>
              </div>

              {/* Outside bottom corner trash button on hover */}
              <button
                type="button"
                className="widget-card-trash-btn"
                title="Delete instance"
                aria-label="Delete instance"
                onClick={() => handleDeleteInstance(inst.id)}
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
          
          <button className="w-full border-2 border-dashed border-border/50 hover:border-accent/50 bg-transparent hover:bg-accent/5 rounded-xl p-4 flex items-center justify-center gap-2 text-muted hover:text-accent transition-all cursor-pointer" onClick={handleAddInstance}>
            <Plus size={20} />
            <span className="font-semibold text-sm">Create New Instance</span>
          </button>
        </div>
        </div>
      </div>
    </div>
  );
};

interface InstancePreviewProps {
  widget: DisplayWidgetDefinition;
  instance: WidgetInstance;
  symbolsGrid: BwpxGrid;
  symbolSlices: SpriteSlice[];
  fontGrid: BwpxGrid;
  fontGlyphs: FontGlyph[];
  fontMappings: FontCharMapping[];
  customText: string;
  testBattery: number;
  testWpm: number;
  testOutputMode: 'usb' | 'ble';
  testBleProfile: number;
  testLayer: number;
  layerNames?: string[];
  testSplitConnected: boolean;
  simulateMissingSymbols: boolean;
  testBongoState?: 0 | 1 | 2;
  testTypewriterText?: string;
  testTypewriterLastChar?: string;
  testTypewriterLastTimestamp?: number;
  testTypewriterRandomPos?: { x: number; y: number };
  testTypewriterRandomLetters?: TypewriterRandomLetter[];
  testActiveKeys?: string[];
  testLastKey?: string;
  testKeypressState?: KeypressState;
}

const InstancePreview: React.FC<InstancePreviewProps> = ({
  widget, instance, symbolsGrid, symbolSlices, fontGrid, fontGlyphs, fontMappings,
  customText, testBattery, testWpm, testOutputMode, testBleProfile, testLayer, layerNames, testSplitConnected, simulateMissingSymbols,
  testBongoState = 0,
  testTypewriterText,
  testTypewriterLastChar,
  testTypewriterLastTimestamp,
  testTypewriterRandomPos,
  testTypewriterRandomLetters,
  testActiveKeys,
  testLastKey,
  testKeypressState,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const startTimeRef = useRef<number>(0);
  const [animTimestamp, setAnimTimestamp] = useState<number>(0);

  useEffect(() => {
    if (widget.id !== 'animation' && widget.id !== 'loop' && widget.id !== 'typewriter') return;
    const speedMs = widget.id === 'typewriter' ? 30 : Math.max(20, instance.config?.loopSpeedMs ?? 250);
    startTimeRef.current = Date.now();
    const timer = setInterval(() => {
      const now = Date.now();
      const elapsed = now - startTimeRef.current;
      if (widget.id === 'typewriter') {
        const cleaning = instance.config?.typewriterCleaning ?? 0;
        if (cleaning > 0) {
          const fadeSec = instance.config?.typewriterFadeTime ?? 0.15;
          const bankCount = (testTypewriterRandomLetters && testTypewriterRandomLetters.length > 0) ? testTypewriterRandomLetters.length : 4;
          const totalCycleMs = (bankCount + 1) * cleaning * 1000 + fadeSec * 1000 + 1000;
          if (elapsed > totalCycleMs) {
            startTimeRef.current = now;
            setAnimTimestamp(0);
            return;
          }
        }
      }
      setAnimTimestamp(elapsed);
    }, speedMs);
    return () => clearInterval(timer);
  }, [
    widget.id,
    instance.id,
    instance.config?.loopSpeedMs,
    instance.config?.loop,
    instance.config?.groupId,
    instance.config?.typewriterCleaning,
    instance.config?.typewriterLetterBank,
    instance.config?.typewriterBankSize,
    instance.config?.typewriterFadeType,
    instance.config?.typewriterFadeTime,
    instance.config?.typewriterMode,
    instance.config?.mode,
    testTypewriterRandomLetters,
  ]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const scale = 3;
    const effectiveSlices = simulateMissingSymbols ? [] : symbolSlices;
    const naturalSize = getWidgetNaturalSize(widget, effectiveSlices, instance, fontGlyphs, fontMappings);
    const width = Math.max(naturalSize.width, 14);
    const height = Math.max(naturalSize.height, widget.defaultHeight, 14);

    canvas.width = width * scale;
    canvas.height = height * scale;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#080b10';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const tempGrid = new BwpxGrid(width, height);
    
    // Create an instances map for rendering just this instance
    const tempInstances = { [widget.id]: [instance] };

    const isTypewriter = widget.id === 'typewriter';
    const effectiveBaseTimestamp = (isTypewriter && startTimeRef.current > 0)
      ? startTimeRef.current
      : testTypewriterLastTimestamp;
    const fontSize = instance.config?.fontSize || (isTypewriter && (instance.config?.typewriterMode || instance.config?.mode) === 'random' ? 'both' : 'small');
    const charW = fontSize === 'big' ? 10 : 5;
    const charH = fontSize === 'big' ? 10 : 5;
    const maxOffsetX = Math.max(0, width - charW);
    const maxOffsetY = Math.max(0, height - charH);

    const effectiveLetters = isTypewriter
      ? (testTypewriterRandomLetters || []).map(l => {
          let lx = l.x;
          let ly = l.y;
          // If coordinates are legacy integer pixels generated for a 32-high box (e.g. y <= 26) but box is taller,
          // scale them proportionally so they span the full [0, maxOffsetY]
          if (maxOffsetY > 32 && typeof ly === 'number' && Number.isInteger(ly) && ly <= 26) {
            ly = Math.round((ly / 26) * maxOffsetY);
          }
          if (maxOffsetX > 32 && typeof lx === 'number' && Number.isInteger(lx) && lx <= 26) {
            lx = Math.round((lx / 26) * maxOffsetX);
          }
          return {
            ...l,
            x: lx,
            y: ly,
            timestamp: effectiveBaseTimestamp,
          };
        })
      : testTypewriterRandomLetters;

    renderWidgetById(widget.id, tempGrid, 0, {
      symbolsGrid,
      symbolSlices: effectiveSlices,
      fontGrid,
      fontGlyphs,
      fontMappings,
      battery: testBattery,
      outputMode: testOutputMode,
      bleProfileIndex: testBleProfile,
      currentLayer: testLayer,
      layerNames: layerNames && layerNames.length > 0 ? layerNames : ['DEFAULT', 'LOWER', 'RAISE', 'ADJUST'],
      wpm: testWpm,
      splitConnected: testSplitConnected,
      customText,
      instances: tempInstances,
      activeInstanceId: instance.id,
      bongoState: testBongoState,
      animationTimestamp: animTimestamp,
      blockWidth: width,
      blockHeight: height,
      typewriterText: testTypewriterText,
      typewriterState: {
        text: testTypewriterText ?? 'TYPE...',
        lastChar: testTypewriterLastChar,
        lastTimestamp: effectiveBaseTimestamp,
        randomX: testTypewriterRandomPos?.x,
        randomY: testTypewriterRandomPos?.y,
        letterBank: effectiveLetters,
        randomLetters: effectiveLetters,
        randomBank: effectiveLetters,
      },
      activeKeys: testActiveKeys,
      lastKey: testLastKey,
      keypressState: testKeypressState,
    });

    ctx.fillStyle = '#00d2ff';
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (tempGrid.get(x, y)) {
          ctx.fillRect(x * scale, y * scale, scale - 0.4, scale - 0.4);
        }
      }
    }
  }, [
    widget, instance, symbolsGrid, symbolSlices, fontGrid, fontGlyphs, fontMappings,
    customText, testBattery, testWpm, testOutputMode, testBleProfile, testLayer, layerNames, testSplitConnected, simulateMissingSymbols,
    testBongoState, animTimestamp, testTypewriterText, testTypewriterLastChar, testTypewriterLastTimestamp, testTypewriterRandomPos, testTypewriterRandomLetters, instance.config?.typewriterLetterBank, instance.config?.typewriterBankSize,
    instance.config?.typewriterFadeType, instance.config?.typewriterFadeTime,
    testActiveKeys, testLastKey, testKeypressState
  ]);

  return (
    <canvas
      ref={canvasRef}
      className="pixel-preview-canvas cursor-pointer"
      title="Click to replay animation"
      onClick={() => {
        startTimeRef.current = Date.now();
        setAnimTimestamp(0);
      }}
    />
  );
};

import React, { useState, useRef, useEffect } from 'react';
import { BwpxGrid } from '../bwpx/core/BwpxGrid';
import type { SpriteSlice, FontGlyph, FontCharMapping, LayoutBlock } from '../types/zmk';
import {
  WIDGET_REGISTRY,
  getWidgetDefinition,
  renderWidgetById,
  getWidgetsByTier,
} from '../services/widgetRegistry';
import { WidgetMiniPreview } from './blocks/WidgetCatalogList';
import type {
  DisplayWidgetDefinition,
  WidgetInstanceMap,
  WidgetInstance,
} from '../types/widget';
import {
  Activity, Battery, Wifi, Link2, Layers, Sparkles, Gauge, Type,
  Type as TypeIcon, Image as ImageIcon,
  Plus, Trash2, Usb, Bluetooth, Cat
} from 'lucide-react';

export interface WidgetsTabProps {
  symbolsGrid: BwpxGrid;
  symbolSlices: SpriteSlice[];
  fontGrid: BwpxGrid;
  fontGlyphs?: FontGlyph[];
  fontMappings?: FontCharMapping[];
  customText: string;
  onCustomTextChange: (text: string) => void;
  instances?: WidgetInstanceMap;
  onInstancesChange?: (instances: WidgetInstanceMap) => void;
  leftBlocks?: LayoutBlock[];
  rightBlocks?: LayoutBlock[];
  onLeftBlocksChange?: (blocks: LayoutBlock[]) => void;
  onRightBlocksChange?: (blocks: LayoutBlock[]) => void;
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
  symbolsGrid,
  symbolSlices,
  fontGrid,
  fontGlyphs = [],
  fontMappings = [],
  customText,
  onCustomTextChange: _onCustomTextChange,
  instances = {},
  onInstancesChange,
  leftBlocks,
  rightBlocks,
  onLeftBlocksChange,
  onRightBlocksChange
}) => {
  const [activeWidgetId, setActiveWidgetId] = useState<string>(WIDGET_REGISTRY[0]?.id || 'status-bar');
  const [selectedTier, setSelectedTier] = useState<'all' | 1 | 2 | 3>('all');
  
  const [testBattery, setTestBattery] = useState<number>(75);
  const [testWpm] = useState<number>(55);
  const [testOutputMode, setTestOutputMode] = useState<'usb' | 'ble'>('usb');
  const [testBleProfile, setTestBleProfile] = useState<number>(1);
  const [testLayer] = useState<number>(0);
  const [testSplitConnected] = useState<boolean>(true);
  const [simulateMissingSymbols] = useState<boolean>(false);
  const [testBongoState, setTestBongoState] = useState<0 | 1 | 2>(0);

  const activeWidget: DisplayWidgetDefinition = getWidgetDefinition(activeWidgetId) || WIDGET_REGISTRY[0];
  const activeInstances = instances[activeWidget.id] || [];

  const handleAddInstance = () => {
    if (!onInstancesChange) return;
    const newInstanceId = `${activeWidget.id}-${Date.now()}`;
    let initialConfig: import('../types/widget').WidgetInstanceConfig = { mode: 'symbol' };
    if (activeWidget.id === 'wpm-chart') {
      initialConfig = { mode: 'symbol', wpmChart: { width: 32, height: 24, gridSize: 4, targetSpeed: 100, timeWindow: 30 } };
    } else if (activeWidget.id === 'connection') {
      initialConfig = {
        mode: 'symbol',
        groupId: 'SYMBOL_USB',
        groupIds: [
          'SYMBOL_BLUETOOTH',
          'SYMBOL_BLUETOOTH',
          'SYMBOL_BLUETOOTH',
          'SYMBOL_BLUETOOTH',
          'SYMBOL_BLUETOOTH',
          'SYMBOL_BLUETOOTH'
        ],
        textEntries: ['USB', 'No conn', 'P1', 'P2', 'P3', 'P4', 'P5']
      };
    } else if (activeWidget.id === 'bongo') {
      const bongoGroup = symbolSlices.find(s => s.groupOrder === 1 && symbolSlices.filter(m => m.groupId === s.groupId).length >= 3);
      initialConfig = {
        mode: 'symbol',
        groupId: bongoGroup?.groupId || '',
        textEntries: ['(=^.^=)']
      };
    }

    const newInst: WidgetInstance = {
      id: newInstanceId,
      widgetTypeId: activeWidget.id,
      label: `${activeWidget.name}`,
      config: initialConfig,
      slots: {}
    };
    if (newInst.slots) {
      activeWidget.slots.forEach(s => {
        newInst.slots![s.id] = {
          mode: s.defaultMode,
          symbolId: s.defaultSymbolId,
          text: s.defaultText
        };
      });
    }
    
    onInstancesChange({
      ...instances,
      [activeWidget.id]: [...activeInstances, newInst]
    });
  };

  const handleDeleteInstance = (instId: string) => {
    if (!onInstancesChange) return;
    const newInstances = activeInstances.filter(i => i.id !== instId);
    
    onInstancesChange({
      ...instances,
      [activeWidget.id]: newInstances
    });
    
    if (onLeftBlocksChange && leftBlocks) {
      onLeftBlocksChange(leftBlocks.filter(b => b.instanceId !== instId));
    }
    if (onRightBlocksChange && rightBlocks) {
      onRightBlocksChange(rightBlocks.filter(b => b.instanceId !== instId));
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
    onInstancesChange({ ...instances, [activeWidget.id]: newInstances });
  };

  const handleUpdateInstanceLabel = (instId: string, label: string) => {
    if (!onInstancesChange) return;
    const newInstances = activeInstances.map(inst => {
      if (inst.id !== instId) return inst;
      return { ...inst, label };
    });
    onInstancesChange({ ...instances, [activeWidget.id]: newInstances });
  };

  const filteredWidgets = selectedTier === 'all' ? WIDGET_REGISTRY : getWidgetsByTier(selectedTier);

  return (
    <div className="widgets-tab-container">
      {/* Left Sidebar */}
      <div className="widgets-sidebar">
        <div className="flex items-center justify-between">
          <h3 className="sidebar-title">Widget Templates</h3>
          <span className="text-[10px] font-mono text-accent">{WIDGET_REGISTRY.length} total</span>
        </div>
        <p className="sidebar-desc">Select a template to configure its instances.</p>

        <div className="widget-tier-filter-row">
          <button className={`btn-filter-tag ${selectedTier === 'all' ? 'active' : ''}`} onClick={() => setSelectedTier('all')}>All</button>
          <button className={`btn-filter-tag ${selectedTier === 1 ? 'active' : ''}`} onClick={() => setSelectedTier(1)}>T1</button>
          <button className={`btn-filter-tag ${selectedTier === 2 ? 'active' : ''}`} onClick={() => setSelectedTier(2)}>T2</button>
          <button className={`btn-filter-tag ${selectedTier === 3 ? 'active' : ''}`} onClick={() => setSelectedTier(3)}>T3</button>
        </div>

        <div className="widgets-nav-list">
          {([1, 2, 3] as const).map(tierNum => {
            if (selectedTier !== 'all' && selectedTier !== tierNum) return null;
            const tierWidgets = filteredWidgets.filter(w => w.tier === tierNum);
            if (tierWidgets.length === 0) return null;

            return (
              <div key={tierNum} className="widget-tier-section mb-3">
                {selectedTier === 'all' && (
                  <div className="widget-tier-section-header">
                    <span className={`tier-badge-pill tier-${tierNum}`}>T{tierNum}</span>
                    <span className="widget-tier-section-title">{TIER_METADATA[tierNum].label}</span>
                  </div>
                )}
                <div className="flex flex-col gap-1.5">
                  {tierWidgets.map(widget => {
                    const isActive = activeWidget.id === widget.id;
                    const instanceCount = (instances[widget.id] || []).length;

                    return (
                      <button key={widget.id} className={`widget-nav-item ${isActive ? 'active' : ''}`} onClick={() => setActiveWidgetId(widget.id)}>
                        {instanceCount > 0 && (
                          <span className="instance-count-badge">{instanceCount}</span>
                        )}
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
                        <div className="widget-nav-meta flex-1 min-w-0 flex items-center justify-between gap-1">
                          <span className="widget-nav-name truncate">{widget.name}</span>
                          {widget.requiresMaster && (
                            <span className="badge-master" title="Requires Central (Master) half in ZMK split">MASTER</span>
                          )}
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
        <div className="widget-config-card mb-8">
          <div className="widget-card-header !mb-2 !pb-2 border-b-0">
            <div>
              <div className="flex items-center gap-2">
                {React.createElement(WIDGET_ICONS[activeWidget.icon] || Sparkles, { size: 20, className: 'text-accent' })}
                <h3 className="text-base font-semibold text-text-main">{activeWidget.name} Template</h3>
                <span className={`px-2 py-0.5 rounded text-[10px] font-mono tier-pill tier-pill-${activeWidget.tier}`}>
                  Tier {activeWidget.tier} · {activeWidget.category}
                </span>
                {activeWidget.requiresMaster && (
                  <span className="badge-master" title="Requires Central (Master) half in ZMK split">MASTER</span>
                )}
              </div>
              <p className="text-sm text-muted mt-2">{activeWidget.description}</p>
            </div>
          </div>
          {activeWidget.id === 'battery' && activeInstances.length > 0 && (
            <div className="mt-3 pt-3 border-t border-border/40 flex items-center gap-3">
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
          {activeWidget.id === 'connection' && activeInstances.length > 0 && (
            <div className="mt-3 pt-3 border-t border-border/40 flex flex-wrap items-center gap-3">
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
          {activeWidget.id === 'bongo' && activeInstances.length > 0 && (
            <div className="mt-3 pt-3 border-t border-border/40 flex flex-wrap items-center gap-3">
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
        </div>
        
        {/* Instances List */}
        <div className="space-y-4">
          {activeInstances.map(inst => (
            <div key={inst.id} className="widget-config-card p-4">
              <div className="mb-4 flex items-center justify-between gap-2">
                <input 
                  type="text" 
                  value={inst.label} 
                  onChange={e => handleUpdateInstanceLabel(inst.id, e.target.value)} 
                  className="widget-instance-label-input"
                  placeholder="Instance Label..."
                />
                <button className="text-red-400 hover:text-red-300 transition-colors flex-shrink-0" onClick={() => handleDeleteInstance(inst.id)}>
                  <Trash2 size={16} />
                </button>
              </div>

              {/* Simulation Demo Component */}
              <div className="widget-interactive-demo mb-4">
                <div className="demo-canvas-box" style={{ height: `${Math.max(activeWidget.defaultHeight * 4, 28)}px` }}>
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
                    testLayer={testLayer}
                    testSplitConnected={testSplitConnected}
                    simulateMissingSymbols={simulateMissingSymbols}
                    testBongoState={testBongoState}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <div className="widget-slot-card p-3 rounded-lg border border-border/40 bg-surface/60">
                  {activeWidget.id !== 'wpm-chart' && activeWidget.id !== 'branding' && (
                    <div className="control-group mb-4">
                      <label>Display Mode</label>
                      <div className="button-pair">
                        <button
                          type="button"
                          className={`btn-toggle ${inst.config?.mode === 'symbol' || !inst.config?.mode ? 'active' : ''}`}
                          onClick={() => handleUpdateInstanceConfig(inst.id, { mode: 'symbol' })}
                        >
                          <ImageIcon size={14} />
                          <span>Symbol Mode</span>
                        </button>
                        <button
                          type="button"
                          className={`btn-toggle ${inst.config?.mode === 'font' ? 'active' : ''}`}
                          onClick={() => handleUpdateInstanceConfig(inst.id, { mode: 'font' })}
                        >
                          <TypeIcon size={14} />
                          <span>Font Mode</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {activeWidget.id === 'branding' && (
                    <div className="flex flex-col gap-2">
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
                  {activeWidget.id !== 'wpm-chart' && activeWidget.id !== 'branding' && (inst.config?.mode === 'symbol' || !inst.config?.mode) && (
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
                          <label className="text-xs text-muted mb-1 block">Layer Groups (1 slice each)</label>
                          {['QWERTY', 'LOWER', 'RAISE', 'ADJUST'].map((label, idx) => (
                            <div key={idx} className="flex items-center gap-2 mb-1">
                              <span className="text-[10px] w-16 text-muted">{label}</span>
                              <select value={inst.config?.groupIds?.[idx] || ''} onChange={e => {
                                const newIds = [...(inst.config?.groupIds || [])];
                                newIds[idx] = e.target.value;
                                handleUpdateInstanceConfig(inst.id, { groupIds: newIds });
                              }} className="select-dark text-xs flex-1">
                                <option value="">-- Select Group (1 slice) --</option>
                                {symbolSlices.filter(s => s.groupOrder === 1 && symbolSlices.filter(m => m.groupId === s.groupId).length === 1).map(s => <option key={s.groupId} value={s.groupId}>{s.name || s.id}</option>)}
                              </select>
                            </div>
                          ))}
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
                      )}
                    </div>
                  )}

                  {/* Font Mode Settings */}
                  {inst.config?.mode === 'font' && (
                    <div className="flex flex-col gap-2">
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
                        <div className="flex flex-col gap-1">
                          {['QWERTY', 'LOWER', 'RAISE', 'ADJUST'].map((label, idx) => (
                            <input key={idx} type="text" value={inst.config?.textEntries?.[idx] || label} onChange={e => {
                              const newTexts = [...(inst.config?.textEntries || [])];
                              newTexts[idx] = e.target.value;
                              handleUpdateInstanceConfig(inst.id, { textEntries: newTexts });
                            }} className="input-text-dark text-xs w-full" placeholder={label} />
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
          ))}
          
          <button className="w-full border-2 border-dashed border-border/50 hover:border-accent/50 bg-transparent hover:bg-accent/5 rounded-xl p-4 flex items-center justify-center gap-2 text-muted hover:text-accent transition-all cursor-pointer" onClick={handleAddInstance}>
            <Plus size={20} />
            <span className="font-semibold text-sm">Create New Instance</span>
          </button>
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
  testSplitConnected: boolean;
  simulateMissingSymbols: boolean;
  testBongoState?: 0 | 1 | 2;
}

const InstancePreview: React.FC<InstancePreviewProps> = ({
  widget, instance, symbolsGrid, symbolSlices, fontGrid, fontGlyphs, fontMappings,
  customText, testBattery, testWpm, testOutputMode, testBleProfile, testLayer, testSplitConnected, simulateMissingSymbols,
  testBongoState = 0
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const scale = 3;
    const width = 32;
    const height = Math.max(widget.defaultHeight, 14);

    canvas.width = width * scale;
    canvas.height = height * scale;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#080b10';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const effectiveSlices = simulateMissingSymbols ? [] : symbolSlices;
    const tempGrid = new BwpxGrid(width, height);
    
    // Create an instances map for rendering just this instance
    const tempInstances = { [widget.id]: [instance] };

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
      layerNames: ['QWERTY', 'LOWER', 'RAISE', 'ADJUST'],
      wpm: testWpm,
      splitConnected: testSplitConnected,
      customText,
      instances: tempInstances,
      activeInstanceId: instance.id,
      bongoState: testBongoState,
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
    customText, testBattery, testWpm, testOutputMode, testBleProfile, testLayer, testSplitConnected, simulateMissingSymbols,
    testBongoState
  ]);

  return <canvas ref={canvasRef} className="pixel-preview-canvas" />;
};

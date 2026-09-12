import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { BwpxGrid } from '../bwpx/core/BwpxGrid';
import type { SpriteSlice, FontGlyph, FontCharMapping, LayoutBlock } from '../types/zmk';
import {
  DEFAULT_LEFT_LAYOUT_BLOCKS,
  DEFAULT_RIGHT_LAYOUT_BLOCKS,
  DEFAULT_DONGLE_LAYOUT_BLOCKS,
  DEFAULT_IDLE_LEFT_BLOCKS,
  DEFAULT_IDLE_RIGHT_BLOCKS,
  DEFAULT_IDLE_DONGLE_BLOCKS,
  DEFAULT_SYMBOL_SLICES,
  DEFAULT_FONT_GLYPHS,
  DEFAULT_FONT_MAPPINGS,
} from '../types/zmk';
import type { WidgetInstanceMap } from '../types/widget';
import { KNOWN_SHIELDS, type ShieldDefinition } from '../data/shieldsData';
import { ShieldKeyboardGeometry } from '../components/ShieldKeyboardGeometry';
import {
  Search,
  Cpu,
  Layers,
  Copy,
  Check,
  Sun,
  Moon,
  Usb,
  Bluetooth,
  ChevronRight,
  Sliders,
  CheckCircle2,
  Keyboard,
} from 'lucide-react';

export interface ShieldsTabProps {
  symbolsGrid: BwpxGrid;
  symbolSlices: SpriteSlice[];
  fontGrid: BwpxGrid;
  fontGlyphs?: FontGlyph[];
  fontMappings?: FontCharMapping[];
  leftBlocks?: LayoutBlock[];
  rightBlocks?: LayoutBlock[];
  dongleBlocks?: LayoutBlock[];
  idleLeftBlocks?: LayoutBlock[];
  idleRightBlocks?: LayoutBlock[];
  idleDongleBlocks?: LayoutBlock[];
  instances?: WidgetInstanceMap;
  customText?: string;
  onApplyDimensions?: (
    dimensions: { width: number; height: number },
    rightDimensions?: { width: number; height: number }
  ) => void;
  onSelectScreenSetup?: (setup: 'split' | 'split-dongle' | 'dongle-only') => void;
  onNavigateToPreview?: () => void;
}

export const ShieldsTab: React.FC<ShieldsTabProps> = ({
  symbolsGrid,
  symbolSlices,
  fontGrid,
  fontGlyphs = [],
  fontMappings = [],
  leftBlocks = [],
  rightBlocks = [],
  dongleBlocks = [],
  idleLeftBlocks = [],
  idleRightBlocks = [],
  idleDongleBlocks = [],
  instances,
  customText = 'SCYAN',
  onApplyDimensions,
  onSelectScreenSetup,
  onNavigateToPreview,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'split-pair' | 'single-piece'>('all');
  const [selectedShieldId, setSelectedShieldId] = useState<string | null>('corne');

  // Shared Simulator States for the Dev Lab
  const [isIdle, setIsIdle] = useState(false);
  const [outputMode, setOutputMode] = useState<'usb' | 'ble'>('ble');
  const [batteryLevel, setBatteryLevel] = useState(88);
  const [currentLayer, setCurrentLayer] = useState(0);
  const [typingWpm, setTypingWpm] = useState(48);
  const [corneColumns, setCorneColumns] = useState<5 | 6>(6);
  const [sandboxScale, setSandboxScale] = useState<number>(1.0);

  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopyText = useCallback((key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  }, []);

  const handleKeystroke = useCallback(() => {
    setTypingWpm((w) => Math.min(130, Math.max(25, w + Math.floor(Math.random() * 6) - 1)));
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        document.querySelector('.modal-overlay') ||
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable
      ) {
        return;
      }
      if (e.repeat) return;
      handleKeystroke();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeystroke]);

  const filteredShields = useMemo(() => {
    return KNOWN_SHIELDS.filter((shield) => {
      if (categoryFilter !== 'all' && shield.category !== categoryFilter) {
        return false;
      }
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        shield.name.toLowerCase().includes(q) ||
        shield.author.toLowerCase().includes(q) ||
        shield.formFactor.toLowerCase().includes(q) ||
        shield.features.some((f) => f.toLowerCase().includes(q)) ||
        shield.controllerCompatibility.some((c) => c.toLowerCase().includes(q)) ||
        shield.zmkTarget.toLowerCase().includes(q)
      );
    });
  }, [categoryFilter, searchQuery]);

  const selectedShield = useMemo(() => {
    return KNOWN_SHIELDS.find((s) => s.id === selectedShieldId) || KNOWN_SHIELDS[0];
  }, [selectedShieldId]);

  const effectiveSymbolSlices = useMemo(
    () => (symbolSlices && symbolSlices.length > 0 ? symbolSlices : DEFAULT_SYMBOL_SLICES),
    [symbolSlices]
  );
  const effectiveFontGlyphs = useMemo(
    () => (fontGlyphs && fontGlyphs.length > 0 ? fontGlyphs : DEFAULT_FONT_GLYPHS),
    [fontGlyphs]
  );
  const effectiveFontMappings = useMemo(
    () => (fontMappings && fontMappings.length > 0 ? fontMappings : DEFAULT_FONT_MAPPINGS),
    [fontMappings]
  );

  const effectiveLeftBlocks = useMemo(
    () => (leftBlocks && leftBlocks.length > 0 ? leftBlocks : DEFAULT_LEFT_LAYOUT_BLOCKS),
    [leftBlocks]
  );
  const effectiveRightBlocks = useMemo(
    () => (rightBlocks && rightBlocks.length > 0 ? rightBlocks : DEFAULT_RIGHT_LAYOUT_BLOCKS),
    [rightBlocks]
  );
  const effectiveDongleBlocks = useMemo(
    () => (dongleBlocks && dongleBlocks.length > 0 ? dongleBlocks : DEFAULT_DONGLE_LAYOUT_BLOCKS),
    [dongleBlocks]
  );
  const effectiveIdleLeftBlocks = useMemo(
    () => (idleLeftBlocks && idleLeftBlocks.length > 0 ? idleLeftBlocks : DEFAULT_IDLE_LEFT_BLOCKS),
    [idleLeftBlocks]
  );
  const effectiveIdleRightBlocks = useMemo(
    () => (idleRightBlocks && idleRightBlocks.length > 0 ? idleRightBlocks : DEFAULT_IDLE_RIGHT_BLOCKS),
    [idleRightBlocks]
  );
  const effectiveIdleDongleBlocks = useMemo(
    () => (idleDongleBlocks && idleDongleBlocks.length > 0 ? idleDongleBlocks : DEFAULT_IDLE_DONGLE_BLOCKS),
    [idleDongleBlocks]
  );

  const activeLeftBlocks = isIdle ? effectiveIdleLeftBlocks : effectiveLeftBlocks;
  const activeRightBlocks = isIdle ? effectiveIdleRightBlocks : effectiveRightBlocks;
  const activeDongleBlocks = isIdle ? effectiveIdleDongleBlocks : effectiveDongleBlocks;

  const handleApplyShieldConfig = useCallback(
    (shield: ShieldDefinition) => {
      const res = shield.displayConfig.nativeResolution;
      if (onApplyDimensions) {
        onApplyDimensions(res, res);
      }
      if (onSelectScreenSetup) {
        if (shield.id === 'xiao-dongle') {
          onSelectScreenSetup('dongle-only');
        } else {
          onSelectScreenSetup('split');
        }
      }
      if (onNavigateToPreview) {
        onNavigateToPreview();
      }
    },
    [onApplyDimensions, onSelectScreenSetup, onNavigateToPreview]
  );

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto bg-[#0b0d13] text-[#e2e8f0] font-sans">
      {/* Dev Lab Header */}
      <div className="border-b border-[#1e2538] bg-gradient-to-r from-[#0e121b] via-[#111623] to-[#0e121b] px-6 py-5 shrink-0">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 mb-1.5">
              <div className="size-7 rounded-lg bg-[#00f0ff]/15 border border-[#00f0ff]/30 text-[#00f0ff] flex items-center justify-center shadow-[0_0_12px_rgba(0,240,255,0.25)]">
                <Cpu className="size-4" />
              </div>
              <h1 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                ZMK Shields & Display Mounting Hardware Lab
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#00f0ff]/10 border border-[#00f0ff]/30 text-[#00f0ff] font-semibold">
                  DEV
                </span>
              </h1>
            </div>
            <p className="text-xs text-[#94a3b8] max-w-3xl leading-relaxed">
              Explore how your 1bpp OLED display layouts mount and behave across split shield pairs
              (Corne, Lily58, Sofle, Ferris Sweep, Kyria, Iris) and single-piece unibody / dongle shields
              (Reviung41, Reviung34, Xiao Dongle, Tidbit). Inspect pinouts, native resolutions, and runtime blitting geometry.
            </p>
          </div>

          {/* Quick Stats Pill */}
          <div className="flex items-center gap-3 self-start md:self-auto bg-[#131722] border border-[#1e2538] px-3.5 py-2 rounded-xl text-xs font-mono">
            <div className="text-center">
              <div className="text-white font-bold">{KNOWN_SHIELDS.filter((s) => s.category === 'split-pair').length}</div>
              <div className="text-[10px] text-[#64748b]">Split Pairs</div>
            </div>
            <div className="h-6 w-px bg-[#1e2538]" />
            <div className="text-center">
              <div className="text-white font-bold">{KNOWN_SHIELDS.filter((s) => s.category === 'single-piece').length}</div>
              <div className="text-[10px] text-[#64748b]">Single/Dongle</div>
            </div>
            <div className="h-6 w-px bg-[#1e2538]" />
            <div className="text-center">
              <div className="text-[#00f0ff] font-bold">1bpp</div>
              <div className="text-[10px] text-[#64748b]">SSD1306</div>
            </div>
          </div>
        </div>
      </div>

      {/* Simulator Control Bar (Global telemetry for all shields) */}
      <div className="border-b border-[#1e2538] bg-[#11141d] px-6 py-2.5 shrink-0">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Sliders className="size-3.5 text-[#00f0ff]" />
              <span className="font-mono text-[#94a3b8] text-[11px] uppercase tracking-wider font-semibold">
                Lab Simulator:
              </span>
            </div>

            {/* Active / Idle Mode Toggle */}
            <div className="flex items-center bg-[#0b0d13] border border-[#1e2538] rounded-lg p-0.5">
              <button
                type="button"
                onClick={() => setIsIdle(false)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                  !isIdle ? 'bg-[#00f0ff]/15 text-[#00f0ff] font-semibold' : 'text-[#94a3b8] hover:text-white'
                }`}
              >
                <Sun className="size-3" />
                <span>Active</span>
              </button>
              <button
                type="button"
                onClick={() => setIsIdle(true)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                  isIdle ? 'bg-amber-500/20 text-amber-300 font-semibold' : 'text-[#94a3b8] hover:text-white'
                }`}
              >
                <Moon className="size-3" />
                <span>Idle Sleep</span>
              </button>
            </div>

            {/* Output Protocol */}
            <div className="flex items-center bg-[#0b0d13] border border-[#1e2538] rounded-lg p-0.5">
              <button
                type="button"
                onClick={() => setOutputMode('ble')}
                className={`px-2 py-1 rounded-md text-[11px] font-medium transition-all flex items-center gap-1 cursor-pointer ${
                  outputMode === 'ble' ? 'bg-[#00f0ff]/15 text-[#00f0ff] font-semibold' : 'text-[#94a3b8] hover:text-white'
                }`}
              >
                <Bluetooth className="size-3" />
                <span>BLE</span>
              </button>
              <button
                type="button"
                onClick={() => setOutputMode('usb')}
                className={`px-2 py-1 rounded-md text-[11px] font-medium transition-all flex items-center gap-1 cursor-pointer ${
                  outputMode === 'usb' ? 'bg-[#00f0ff]/15 text-[#00f0ff] font-semibold' : 'text-[#94a3b8] hover:text-white'
                }`}
              >
                <Usb className="size-3" />
                <span>USB</span>
              </button>
            </div>

            {/* Layer Selection */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-[#64748b]">Layer:</span>
              <select
                value={currentLayer}
                onChange={(e) => setCurrentLayer(Number(e.target.value))}
                className="bg-[#0b0d13] border border-[#1e2538] text-white rounded px-2 py-1 text-xs font-mono focus:border-[#00f0ff] outline-none"
              >
                <option value={0}>0: DEFAULT</option>
                <option value={1}>1: LOWER</option>
                <option value={2}>2: RAISE</option>
                <option value={3}>3: NAV</option>
                <option value={4}>4: NUM</option>
              </select>
            </div>

            {/* Typing Speed (WPM) Slider */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-[#64748b]">Speed:</span>
              <input
                type="range"
                min="0"
                max="140"
                value={typingWpm}
                onChange={(e) => setTypingWpm(Number(e.target.value))}
                className="w-20 accent-[#00f0ff] cursor-pointer"
              />
              <span className="font-mono text-xs text-[#00f0ff] w-12">{typingWpm} WPM</span>
            </div>

            {/* Battery Level Stepper */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-[#64748b]">Batt:</span>
              <button
                onClick={() => setBatteryLevel((b) => Math.max(10, b - 15))}
                className="px-1.5 py-0.5 bg-[#0b0d13] border border-[#1e2538] rounded hover:border-[#00f0ff] text-xs font-mono"
              >
                -
              </button>
              <span className="font-mono text-xs text-[#4ade80] w-9 text-center">{batteryLevel}%</span>
              <button
                onClick={() => setBatteryLevel((b) => Math.min(100, b + 15))}
                className="px-1.5 py-0.5 bg-[#0b0d13] border border-[#1e2538] rounded hover:border-[#00f0ff] text-xs font-mono"
              >
                +
              </button>
            </div>
          </div>

          <div className="text-[11px] text-[#64748b] font-mono">
            Displays auto-reflect studio assets
          </div>
        </div>
      </div>

      {/* Main Workspace Area */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-6 flex flex-col gap-6">
        {/* Search & Filter Header Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Category Tabs */}
          <div className="flex items-center bg-[#131722] border border-[#1e2538] rounded-xl p-1 gap-1">
            <button
              onClick={() => setCategoryFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all cursor-pointer ${
                categoryFilter === 'all'
                  ? 'bg-[#00f0ff]/15 text-[#00f0ff] font-semibold shadow-sm'
                  : 'text-[#94a3b8] hover:text-white'
              }`}
            >
              All Shields ({KNOWN_SHIELDS.length})
            </button>
            <button
              onClick={() => setCategoryFilter('split-pair')}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all cursor-pointer ${
                categoryFilter === 'split-pair'
                  ? 'bg-[#00f0ff]/15 text-[#00f0ff] font-semibold shadow-sm'
                  : 'text-[#94a3b8] hover:text-white'
              }`}
            >
              Split Pairs ({KNOWN_SHIELDS.filter((s) => s.category === 'split-pair').length})
            </button>
            <button
              onClick={() => setCategoryFilter('single-piece')}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all cursor-pointer ${
                categoryFilter === 'single-piece'
                  ? 'bg-[#00f0ff]/15 text-[#00f0ff] font-semibold shadow-sm'
                  : 'text-[#94a3b8] hover:text-white'
              }`}
            >
              Single-Piece / Dongles ({KNOWN_SHIELDS.filter((s) => s.category === 'single-piece').length})
            </button>
          </div>

          {/* Search Box */}
          <div className="relative sm:w-72">
            <Search className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#64748b]" />
            <input
              type="text"
              placeholder="Search shield, author, pinout..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#131722] border border-[#1e2538] rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-[#64748b] focus:border-[#00f0ff] outline-none font-mono"
            />
          </div>
        </div>

        {/* Selected Shield Hardware Inspector Highlight */}
        {selectedShield && (
          <div className="bg-[#131722] border border-[#00f0ff]/40 rounded-2xl overflow-hidden shadow-[0_4px_24px_rgba(0,240,255,0.08)]">
            <div className="bg-gradient-to-r from-[#00f0ff]/10 via-[#131722] to-[#131722] px-6 py-4 border-b border-[#1e2538] flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="size-2 rounded-full bg-[#00f0ff] shadow-[0_0_8px_#00f0ff]" />
                <div>
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    {selectedShield.name}
                    <span className="text-xs font-normal text-[#94a3b8]">by {selectedShield.author}</span>
                  </h2>
                  <div className="text-xs font-mono text-[#00f0ff]/80">
                    {selectedShield.formFactor} • {selectedShield.keysCount}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleApplyShieldConfig(selectedShield)}
                  className="px-3.5 py-1.5 rounded-lg bg-[#00f0ff]/15 text-[#00f0ff] hover:bg-[#00f0ff]/25 border border-[#00f0ff]/40 text-xs font-mono font-semibold transition-all flex items-center gap-1.5 cursor-pointer shadow-[0_0_12px_rgba(0,240,255,0.15)]"
                  title="Apply this shield resolution and geometry to your workspace layout"
                >
                  <CheckCircle2 className="size-3.5" />
                  <span>Apply Setup & Preview</span>
                </button>
              </div>
            </div>

            <div className="p-6 flex flex-col gap-6">
              {/* Keyboard Physical Blank Keys & OLED Mounting Sandbox */}
              <div className="flex flex-col bg-[#0a0c12] border border-[#1e2538] rounded-xl overflow-hidden">
                {/* Sandbox Control Bar */}
                <div className="px-5 py-3 bg-[#0e121c] border-b border-[#1e2538] flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Keyboard className="size-4 text-[#00f0ff]" />
                    <span className="text-xs font-mono font-bold uppercase tracking-wider text-white">
                      Physical Keyboard Geometry & OLED Mount Sandbox
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#00f0ff]/10 text-[#00f0ff] border border-[#00f0ff]/30 font-semibold">
                      {selectedShield.layoutGeometry.oledLabel}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Corne 6-col vs 5-col Snap-off Toggle */}
                    {selectedShield.id === 'corne' && (
                      <div className="flex items-center bg-[#0b0d13] border border-[#1e2538] rounded-lg p-0.5 text-xs font-mono">
                        <button
                          type="button"
                          onClick={() => setCorneColumns(6)}
                          className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                            corneColumns === 6
                              ? 'bg-[#00f0ff]/20 text-[#00f0ff] font-bold'
                              : 'text-[#94a3b8] hover:text-white'
                          }`}
                        >
                          6-Col (42k)
                        </button>
                        <button
                          type="button"
                          onClick={() => setCorneColumns(5)}
                          className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                            corneColumns === 5
                              ? 'bg-[#00f0ff]/20 text-[#00f0ff] font-bold'
                              : 'text-[#94a3b8] hover:text-white'
                          }`}
                        >
                          5-Col Snap-off (36k)
                        </button>
                      </div>
                    )}

                    {/* Sandbox Scale Zoom Controls */}
                    <div className="flex items-center bg-[#0b0d13] border border-[#1e2538] rounded-lg p-0.5 text-xs font-mono">
                      {[0.85, 1.0, 1.15].map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setSandboxScale(s)}
                          className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                            sandboxScale === s
                              ? 'bg-[#00f0ff]/20 text-[#00f0ff] font-bold'
                              : 'text-[#94a3b8] hover:text-white'
                          }`}
                        >
                          {s}x
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Live Keyboard Visualizer */}
                <div className="p-6 flex flex-col items-center justify-center overflow-x-auto min-h-[300px]">
                  <ShieldKeyboardGeometry
                    shield={selectedShield}
                    symbolsGrid={symbolsGrid}
                    symbolSlices={effectiveSymbolSlices}
                    fontGrid={fontGrid}
                    fontGlyphs={effectiveFontGlyphs}
                    fontMappings={effectiveFontMappings}
                    activeLeftBlocks={activeLeftBlocks}
                    activeRightBlocks={activeRightBlocks}
                    activeDongleBlocks={activeDongleBlocks}
                    isIdle={isIdle}
                    batteryLevel={batteryLevel}
                    outputMode={outputMode}
                    currentLayer={currentLayer}
                    typingWpm={typingWpm}
                    customText={customText}
                    instances={instances}
                    corneColumns={corneColumns}
                    scale={sandboxScale}
                    onKeystroke={handleKeystroke}
                  />

                  {/* Sandbox Hint & Placement Description */}
                  <div className="mt-5 text-center text-xs text-[#94a3b8] max-w-2xl leading-relaxed font-mono">
                    <span className="text-[#00f0ff] font-semibold">Blank Keycaps Geometry:</span>{' '}
                    {selectedShield.layoutGeometry.description} Click blank keys to test tactile press response.
                  </div>
                </div>

                {/* Mounting Orientation & Transform Banner */}
                <div className="px-5 py-2.5 bg-[#0e121c] border-t border-[#1e2538] flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
                  <div className="text-[#94a3b8]">
                    Mounting:{' '}
                    <span className="text-[#00f0ff] font-semibold">
                      {selectedShield.layoutGeometry.oledMount.toUpperCase()}
                    </span>{' '}
                    ({selectedShield.displayConfig.physicalMount})
                  </div>
                  <div className="text-[#64748b]">
                    Orientation:{' '}
                    <span className="text-[#00f0ff] font-semibold">
                      {selectedShield.displayConfig.defaultOrientation.toUpperCase()}
                    </span>{' '}
                    ({selectedShield.displayConfig.nativeResolution.width}×
                    {selectedShield.displayConfig.nativeResolution.height} px virtual buffer •{' '}
                    {selectedShield.displayConfig.rotation}° blit transform)
                  </div>
                </div>
              </div>

              {/* Specs, Mounting Pinouts, and ZMK Flags Panel */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Left Specs Column */}
                <div className="lg:col-span-6 space-y-4">
                  <div>
                    <h3 className="text-xs font-mono uppercase tracking-wider text-[#94a3b8] mb-1">
                      Mounting Geometry & Housing
                    </h3>
                    <p className="text-xs text-white leading-relaxed bg-[#0b0d13] p-3 rounded-lg border border-[#1e2538]">
                      {selectedShield.displayConfig.physicalMount}
                    </p>
                  </div>

                  <div>
                    <h3 className="text-xs font-mono uppercase tracking-wider text-[#94a3b8] mb-1">
                      Runtime Blitting & Behavior
                    </h3>
                    <p className="text-xs text-[#cbd5e1] leading-relaxed bg-[#0b0d13] p-3 rounded-lg border border-[#1e2538]">
                      {selectedShield.behaviorNotes}
                    </p>
                  </div>
                </div>

                {/* Right Specs Column: Pinouts, Controllers, and West Build */}
                <div className="lg:col-span-6 space-y-4">
                  {/* Pinout & Bus Table */}
                  <div>
                    <h3 className="text-xs font-mono uppercase tracking-wider text-[#94a3b8] mb-1">
                      Hardware Pinout (I2C Bus)
                    </h3>
                    <div className="grid grid-cols-4 gap-2 text-center text-xs font-mono">
                      <div className="bg-[#0b0d13] p-2 rounded border border-[#1e2538]">
                        <span className="text-[10px] text-[#64748b] block">SDA</span>
                        <span className="text-[#00f0ff] font-semibold">{selectedShield.displayConfig.pinout.sda}</span>
                      </div>
                      <div className="bg-[#0b0d13] p-2 rounded border border-[#1e2538]">
                        <span className="text-[10px] text-[#64748b] block">SCL</span>
                        <span className="text-[#00f0ff] font-semibold">{selectedShield.displayConfig.pinout.scl}</span>
                      </div>
                      <div className="bg-[#0b0d13] p-2 rounded border border-[#1e2538]">
                        <span className="text-[10px] text-[#64748b] block">VCC</span>
                        <span className="text-[#4ade80] font-semibold">{selectedShield.displayConfig.pinout.vcc}</span>
                      </div>
                      <div className="bg-[#0b0d13] p-2 rounded border border-[#1e2538]">
                        <span className="text-[10px] text-[#64748b] block">GND</span>
                        <span className="text-[#94a3b8] font-semibold">{selectedShield.displayConfig.pinout.gnd}</span>
                      </div>
                    </div>
                  </div>

                  {/* Compatible Controllers */}
                  <div>
                    <h3 className="text-xs font-mono uppercase tracking-wider text-[#94a3b8] mb-1.5">
                      Compatible Microcontrollers
                    </h3>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedShield.controllerCompatibility.map((ctrl) => (
                        <span
                          key={ctrl}
                          className="text-[11px] font-mono px-2 py-0.5 rounded bg-[#1e2538]/70 border border-[#2d3748] text-[#e2e8f0]"
                        >
                          {ctrl}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* ZMK West Build Flag */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="text-xs font-mono uppercase tracking-wider text-[#94a3b8]">
                        ZMK West Build Target
                      </h3>
                      <button
                        type="button"
                        onClick={() => handleCopyText('west', selectedShield.zmkTarget)}
                        className="text-[11px] font-mono text-[#00f0ff] hover:text-white flex items-center gap-1 cursor-pointer"
                      >
                        {copiedKey === 'west' ? <Check className="size-3" /> : <Copy className="size-3" />}
                        <span>{copiedKey === 'west' ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                    <code className="block bg-[#0b0d13] text-[#00f0ff] p-2.5 rounded-lg border border-[#1e2538] text-xs font-mono select-all overflow-x-auto">
                      west build -b nice_nano_v2 -- {selectedShield.zmkTarget}
                    </code>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Shields Gallery Grid */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-[#94a3b8] flex items-center gap-2">
              <Layers className="size-3.5 text-[#00f0ff]" />
              <span>All Known Shields Catalog ({filteredShields.length})</span>
            </h2>
            <span className="text-[11px] text-[#64748b] font-mono">
              Click any card to inspect full mount details
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {filteredShields.map((shield) => {
              const isSelected = shield.id === selectedShieldId;
              const isSplit = shield.category === 'split-pair';

              return (
                <div
                  key={shield.id}
                  onClick={() => setSelectedShieldId(shield.id)}
                  className={`group bg-[#131722] rounded-xl border p-4.5 transition-all cursor-pointer flex flex-col justify-between hover:border-[#00f0ff]/50 hover:shadow-[0_4px_20px_rgba(0,0,0,0.4)] ${
                    isSelected
                      ? 'border-[#00f0ff] shadow-[0_0_16px_rgba(0,240,255,0.15)] bg-[#141926]'
                      : 'border-[#1e2538]'
                  }`}
                >
                  {/* Card Header */}
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-white group-hover:text-[#00f0ff] transition-colors">
                            {shield.name}
                          </h3>
                        </div>
                        <div className="text-[11px] font-mono text-[#64748b]">
                          {shield.author} • {shield.keysCount}
                        </div>
                      </div>

                      <span
                        className={`text-[9px] font-mono px-2 py-0.5 rounded-full uppercase tracking-wider font-semibold border ${
                          isSplit
                            ? 'bg-[#00f0ff]/10 border-[#00f0ff]/30 text-[#00f0ff]'
                            : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                        }`}
                      >
                        {isSplit ? 'Split Pair' : 'Single Piece'}
                      </span>
                    </div>

                    <p className="text-xs text-[#94a3b8] line-clamp-2 mb-4 leading-relaxed">
                      {shield.layoutDesc}
                    </p>
                  </div>

                  {/* Keyboard Blank Keys Mini Sandbox */}
                  <div className="bg-[#0b0d13] border border-[#1e2538] rounded-lg p-3 my-2 flex items-center justify-center min-h-[140px] overflow-hidden">
                    <ShieldKeyboardGeometry
                      shield={shield}
                      symbolsGrid={symbolsGrid}
                      symbolSlices={effectiveSymbolSlices}
                      fontGrid={fontGrid}
                      fontGlyphs={effectiveFontGlyphs}
                      fontMappings={effectiveFontMappings}
                      activeLeftBlocks={activeLeftBlocks}
                      activeRightBlocks={activeRightBlocks}
                      activeDongleBlocks={activeDongleBlocks}
                      isIdle={isIdle}
                      batteryLevel={batteryLevel}
                      outputMode={outputMode}
                      currentLayer={currentLayer}
                      typingWpm={typingWpm}
                      customText={customText}
                      instances={instances}
                      compact={true}
                      scale={0.65}
                    />
                  </div>

                  {/* Card Footer Specs & Action */}
                  <div className="pt-2 border-t border-[#1e2538] flex items-center justify-between gap-2">
                    <div className="text-[10px] font-mono text-[#64748b] truncate">
                      {shield.displayConfig.nativeResolution.width}×
                      {shield.displayConfig.nativeResolution.height} ({shield.displayConfig.defaultOrientation})
                    </div>

                    <div className="flex items-center gap-1.5 text-xs font-mono text-[#00f0ff] group-hover:translate-x-0.5 transition-transform">
                      <span>Inspect</span>
                      <ChevronRight className="size-3" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

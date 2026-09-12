import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { BwpxGrid } from '../bwpx/core/BwpxGrid';
import type { SpriteSlice, FontGlyph, FontCharMapping, LayoutBlock } from '../types/zmk';
import {
  DEFAULT_LEFT_LAYOUT_BLOCKS,
  DEFAULT_RIGHT_LAYOUT_BLOCKS,
  DEFAULT_DONGLE_LAYOUT_BLOCKS,
  DEFAULT_SYMBOL_SLICES,
  DEFAULT_FONT_GLYPHS,
  DEFAULT_FONT_MAPPINGS,
} from '../types/zmk';
import type { WidgetInstanceMap } from '../types/widget';
import { KNOWN_SHIELDS, getShieldDefinition, type ShieldDefinition } from '../data/shieldsData';
import { ShieldKeyboardGeometry } from '../components/ShieldKeyboardGeometry';
import {
  Layers,
  Copy,
  Check,
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
  onSelectShield?: (shieldId: string) => void;
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
  idleLeftBlocks: _idleLeftBlocks = [],
  idleRightBlocks: _idleRightBlocks = [],
  idleDongleBlocks: _idleDongleBlocks = [],
  instances,
  customText = 'SCYAN',
  onApplyDimensions,
  onSelectShield,
  onNavigateToPreview,
}) => {
  const [selectedShieldId, setSelectedShieldId] = useState<string | null>('corne');
  const [corneColumns, setCorneColumns] = useState<5 | 6>(6);
  const [sandboxScale, setSandboxScale] = useState<number>(0.9);
  const [typingWpm, setTypingWpm] = useState(48);
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

  const selectedShield = useMemo(() => {
    return getShieldDefinition(selectedShieldId);
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

  const handleApplyShieldConfig = useCallback(
    (shield: ShieldDefinition) => {
      const res = shield.displayConfig.nativeResolution;
      if (onApplyDimensions) {
        onApplyDimensions(res, res);
      }
      if (onSelectShield) {
        onSelectShield(shield.id);
      }
      if (onNavigateToPreview) {
        onNavigateToPreview();
      }
    },
    [onApplyDimensions, onSelectShield, onNavigateToPreview]
  );

  return (
    <div className="flex-1 flex flex-col md:flex-row h-full overflow-hidden bg-[#0b0d13] text-[#e2e8f0] font-sans">
      {/* LEFT PANE: Stage & Information */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-y-auto md:overflow-hidden p-3 md:p-4 bg-[#0b0d13] justify-between gap-2.5">
        {/* Header Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 shrink-0 bg-[#131722] border border-[#1e2538] rounded-xl px-3.5 py-2">
          <div className="flex items-center gap-3">
            <span className="size-2 rounded-full bg-[#00f0ff] shadow-[0_0_8px_#00f0ff]" />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm lg:text-base font-bold text-white tracking-tight">
                  {selectedShield.name}
                </h2>
                <span className="text-[11px] text-[#94a3b8]">by {selectedShield.author}</span>
                <span
                  className={`text-[9px] font-mono px-2 py-0.5 rounded-full uppercase tracking-wider font-semibold border ${
                    selectedShield.category === 'split-pair'
                      ? 'bg-[#00f0ff]/10 border-[#00f0ff]/30 text-[#00f0ff]'
                      : 'bg-[#a953f6]/10 border-[#a953f6]/30 text-[#a953f6]'
                  }`}
                >
                  {selectedShield.category === 'split-pair' ? 'Split Pair' : 'Single Piece'}
                </span>
              </div>
              <div className="text-[11px] font-mono text-[#00f0ff]/80">
                {selectedShield.formFactor} • {selectedShield.keysCount}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
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

            {/* Sandbox Zoom Controls */}
            <div className="flex items-center bg-[#0b0d13] border border-[#1e2538] rounded-lg p-0.5 text-xs font-mono">
              {[0.8, 0.9, 1.0].map((s) => (
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

            {/* Apply Button */}
            <button
              type="button"
              onClick={() => handleApplyShieldConfig(selectedShield)}
              className="px-3 py-1.5 rounded-lg bg-[#00f0ff]/15 text-[#00f0ff] hover:bg-[#00f0ff]/25 border border-[#00f0ff]/40 text-xs font-mono font-semibold transition-all flex items-center gap-1.5 cursor-pointer shadow-[0_0_12px_rgba(0,240,255,0.15)]"
              title="Apply this shield resolution and geometry to your workspace layout"
            >
              <CheckCircle2 className="size-3.5" />
              <span>Apply Setup & Preview</span>
            </button>
          </div>
        </div>

        {/* Visual Stage: Keyboard Geometry & Live OLED Mount */}
        <div className="flex-1 flex flex-col items-center justify-between min-h-0 bg-[#0e121c] border border-[#1e2538] rounded-2xl p-3 overflow-hidden relative">
          <div className="w-full flex items-center justify-between gap-2 px-1 shrink-0">
            <div className="flex items-center gap-2">
              <Keyboard className="size-3.5 text-[#00f0ff]" />
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-white">
                Physical Keyboard Geometry & OLED Mount Sandbox
              </span>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#00f0ff]/10 text-[#00f0ff] border border-[#00f0ff]/30 font-semibold">
              {selectedShield.layoutGeometry.oledLabel}
            </span>
          </div>

          <div className="flex-1 flex items-center justify-center w-full min-h-0 py-1 overflow-auto">
            <ShieldKeyboardGeometry
              shield={selectedShield}
              symbolsGrid={symbolsGrid}
              symbolSlices={effectiveSymbolSlices}
              fontGrid={fontGrid}
              fontGlyphs={effectiveFontGlyphs}
              fontMappings={effectiveFontMappings}
              activeLeftBlocks={effectiveLeftBlocks}
              activeRightBlocks={effectiveRightBlocks}
              activeDongleBlocks={effectiveDongleBlocks}
              isIdle={false}
              batteryLevel={88}
              outputMode="ble"
              currentLayer={0}
              typingWpm={typingWpm}
              customText={customText}
              instances={instances}
              corneColumns={corneColumns}
              scale={sandboxScale}
              onKeystroke={handleKeystroke}
            />
          </div>

          <div className="text-center text-[11px] text-[#94a3b8] max-w-2xl leading-relaxed font-mono shrink-0 truncate px-2">
            <span className="text-[#00f0ff] font-semibold">Blank Keycaps Geometry:</span>{' '}
            {selectedShield.layoutGeometry.description} Click blank keys to test tactile press response.
          </div>
        </div>

        {/* Compact Information Cards Strip */}
        <div className="shrink-0 grid grid-cols-1 md:grid-cols-3 gap-2.5">
          {/* Card 1: Hardware Pinout (I2C Bus) */}
          <div className="bg-[#131722] border border-[#1e2538] rounded-xl p-2.5 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-1.5">
              <h3 className="text-[11px] font-mono uppercase tracking-wider text-[#94a3b8] font-semibold">
                Hardware Pinout (I2C Bus)
              </h3>
              <span className="text-[10px] font-mono text-[#64748b]">
                {selectedShield.displayConfig.displayType.split(' ')[0]} {selectedShield.displayConfig.bus}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1 text-xs font-mono">
              <div className="bg-[#0b0d13] px-2 py-1 rounded border border-[#1e2538] flex items-center justify-between min-w-0">
                <span className="text-[9px] text-[#64748b] uppercase shrink-0">SDA</span>
                <span
                  className="text-[#00f0ff] font-semibold text-[11px] truncate ml-1.5"
                  title={selectedShield.displayConfig.pinout.sda}
                >
                  {selectedShield.displayConfig.pinout.sda}
                </span>
              </div>
              <div className="bg-[#0b0d13] px-2 py-1 rounded border border-[#1e2538] flex items-center justify-between min-w-0">
                <span className="text-[9px] text-[#64748b] uppercase shrink-0">SCL</span>
                <span
                  className="text-[#00f0ff] font-semibold text-[11px] truncate ml-1.5"
                  title={selectedShield.displayConfig.pinout.scl}
                >
                  {selectedShield.displayConfig.pinout.scl}
                </span>
              </div>
              <div className="bg-[#0b0d13] px-2 py-1 rounded border border-[#1e2538] flex items-center justify-between min-w-0">
                <span className="text-[9px] text-[#64748b] uppercase shrink-0">VCC</span>
                <span
                  className="text-[#4ade80] font-semibold text-[11px] truncate ml-1.5"
                  title={selectedShield.displayConfig.pinout.vcc}
                >
                  {selectedShield.displayConfig.pinout.vcc}
                </span>
              </div>
              <div className="bg-[#0b0d13] px-2 py-1 rounded border border-[#1e2538] flex items-center justify-between min-w-0">
                <span className="text-[9px] text-[#64748b] uppercase shrink-0">GND</span>
                <span
                  className="text-[#94a3b8] font-semibold text-[11px] truncate ml-1.5"
                  title={selectedShield.displayConfig.pinout.gnd}
                >
                  {selectedShield.displayConfig.pinout.gnd}
                </span>
              </div>
            </div>
          </div>

          {/* Card 2: Compatible Microcontrollers & Mounting */}
          <div className="bg-[#131722] border border-[#1e2538] rounded-xl p-2.5 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-1.5">
              <h3 className="text-[11px] font-mono uppercase tracking-wider text-[#94a3b8] font-semibold">
                Compatible Microcontrollers
              </h3>
              <span className="text-[10px] font-mono text-[#64748b]">
                {selectedShield.displayConfig.nativeResolution.width}×
                {selectedShield.displayConfig.nativeResolution.height} ({selectedShield.displayConfig.defaultOrientation})
              </span>
            </div>
            <div className="flex flex-wrap gap-1">
              {selectedShield.controllerCompatibility.map((ctrl) => (
                <span
                  key={ctrl}
                  className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#1e2538]/70 border border-[#2d3748] text-[#e2e8f0]"
                >
                  {ctrl}
                </span>
              ))}
            </div>
          </div>

          {/* Card 3: ZMK West Build Target */}
          <div className="bg-[#131722] border border-[#1e2538] rounded-xl p-2.5 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-1.5">
              <h3 className="text-[11px] font-mono uppercase tracking-wider text-[#94a3b8] font-semibold">
                ZMK West Build Target
              </h3>
              <button
                type="button"
                onClick={() =>
                  handleCopyText(
                    'west',
                    `west build -b nice_nano_v2 -- ${selectedShield.zmkTarget}`
                  )
                }
                className="text-[10px] font-mono text-[#00f0ff] hover:text-white flex items-center gap-1 cursor-pointer"
              >
                {copiedKey === 'west' ? <Check className="size-3" /> : <Copy className="size-3" />}
                <span>{copiedKey === 'west' ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
            <code className="block bg-[#0b0d13] text-[#00f0ff] p-1.5 rounded-lg border border-[#1e2538] text-[11px] font-mono select-all overflow-x-auto truncate">
              west build -b nice_nano_v2 -- {selectedShield.zmkTarget}
            </code>
          </div>
        </div>
      </div>

      {/* RIGHT PANE: Clean Scrollable Layouts List */}
      <div className="w-full md:w-72 lg:w-80 xl:w-88 shrink-0 border-t md:border-t-0 md:border-l border-[#1e2538] bg-[#0e121c] flex flex-col h-72 md:h-full overflow-hidden">
        <div className="px-4 py-3 border-b border-[#1e2538] flex items-center justify-between shrink-0 bg-[#0e121c]">
          <div className="flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-wider text-[#94a3b8]">
            <Layers className="size-3.5 text-[#00f0ff]" />
            <span>Layouts</span>
          </div>
          <span className="text-[11px] font-mono text-[#64748b]">
            {KNOWN_SHIELDS.length} shields
          </span>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
          {KNOWN_SHIELDS.map((shield) => {
            const isSelected = shield.id === selectedShieldId;
            return (
              <button
                key={shield.id}
                type="button"
                onClick={() => setSelectedShieldId(shield.id)}
                className={`w-full text-left rounded-xl border p-2.5 transition-all cursor-pointer flex flex-col gap-2 ${
                  isSelected
                    ? 'border-[#00f0ff] bg-[#141a29] shadow-[0_0_14px_rgba(0,240,255,0.15)] ring-1 ring-[#00f0ff]/40'
                    : 'border-[#1e2538] bg-[#11141e] hover:border-[#00f0ff]/40 hover:bg-[#151a27]'
                }`}
              >
                <div className="flex items-center justify-between gap-2 px-1">
                  <span
                    className={`text-xs font-bold truncate ${
                      isSelected ? 'text-[#00f0ff]' : 'text-white'
                    }`}
                  >
                    {shield.name}
                  </span>
                  <span className="text-[10px] font-mono text-[#64748b] shrink-0">
                    {shield.keysCount}
                  </span>
                </div>

                {/* Small Compact Preview */}
                <div className="bg-[#080a0f] border border-[#1e2538]/80 rounded-lg p-2 flex items-center justify-center min-h-[86px] overflow-hidden pointer-events-none">
                  <ShieldKeyboardGeometry
                    shield={shield}
                    symbolsGrid={symbolsGrid}
                    symbolSlices={effectiveSymbolSlices}
                    fontGrid={fontGrid}
                    fontGlyphs={effectiveFontGlyphs}
                    fontMappings={effectiveFontMappings}
                    activeLeftBlocks={effectiveLeftBlocks}
                    activeRightBlocks={effectiveRightBlocks}
                    activeDongleBlocks={effectiveDongleBlocks}
                    isIdle={false}
                    batteryLevel={88}
                    outputMode="ble"
                    currentLayer={0}
                    typingWpm={48}
                    customText={customText}
                    instances={instances}
                    compact={true}
                    scale={0.55}
                  />
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

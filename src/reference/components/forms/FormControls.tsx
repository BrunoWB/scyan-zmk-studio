import { useState } from 'react';
import { Chip } from '@heroui/react';
import { 
  Search, 
  Plus, 
  Minus, 
  SlidersHorizontal, 
  Sun, 
  Move, 
  Type as TypeIcon 
} from 'lucide-react';

export default function FormControls() {
  const [basicText, setBasicText] = useState('scyan_zmk_studio_v4');
  const [searchValue, setSearchValue] = useState('');
  
  // Coordinate & Size Numerical Steppers (X, Y, W, H)
  const [coordX, setCoordX] = useState(16);
  const [coordY, setCoordY] = useState(8);
  const [sizeW, setSizeW] = useState(32);
  const [sizeH, setSizeH] = useState(24);

  // Slider Bar (Display Contrast / Brightness 0-100%)
  const [brightness, setBrightness] = useState(75);

  // Switches & Selects
  const [screensaverEnabled, setScreensaverEnabled] = useState(true);
  const [selectedPreset, setSelectedPreset] = useState('128x32');

  return (
    <section className="space-y-6">
      {/* Header */}
      <div className="border-b border-[#1e2538] pb-4">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="size-5 text-[#00f0ff]" />
          <h2 className="text-xl font-bold text-white tracking-tight">Form Controls &amp; Steppers</h2>
        </div>
        <p className="text-sm text-[#94a3b8] mt-1">
          Basic text inputs, search with glow, quad coordinate &amp; size numerical steppers, and brightness slider.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        
        {/* ================= CARD 1: TEXT INPUTS (BASIC + SEARCH WITH GLOW) ================= */}
        <div className="bg-[#131722] border border-[#1e2538] rounded-2xl p-5 space-y-4 flex flex-col justify-between">
          <div className="space-y-3.5">
            <div>
              <h4 className="text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-2">
                <TypeIcon className="size-3.5 text-[#00f0ff]" />
                <span>Text Inputs</span>
              </h4>
              <p className="text-[11px] text-[#94a3b8] mt-0.5">Basic single-line field and search with active glow ring.</p>
            </div>

            {/* Basic Text Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-white flex items-center justify-between">
                <span>Device Hostname</span>
                <span className="text-[10px] font-mono text-[#555e6e]">Standard</span>
              </label>
              <input
                type="text"
                value={basicText}
                onChange={(e) => setBasicText(e.target.value)}
                placeholder="Enter device hostname..."
                className="w-full bg-[#0b0d13] border border-[#1e2538] focus:border-[#00f0ff]/70 text-xs text-white placeholder-[#555e6e] rounded-xl px-3.5 py-2.5 outline-none transition-colors"
              />
              <p className="text-[10px] text-[#555e6e]">Unique alphanumeric device identifier on BLE bus.</p>
            </div>

            {/* Search Input with Glow */}
            <div className="space-y-1.5 pt-1">
              <label className="text-xs font-medium text-white flex items-center justify-between">
                <span>Search Input with Glow</span>
                <span className="text-[10px] font-mono text-[#00f0ff]">Active Focus</span>
              </label>
              <div className="relative">
                <Search className="size-4 text-[#94a3b8] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                  placeholder="Filter by layer, address, tag..."
                  className="w-full bg-[#0b0d13] border border-[#1e2538] focus:border-[#00f0ff] focus:shadow-[0_0_14px_rgba(0,240,255,0.3)] text-xs text-white placeholder-[#555e6e] rounded-xl pl-9 pr-8 py-2.5 outline-none transition-all"
                />
                {searchValue && (
                  <button
                    onClick={() => setSearchValue('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-[#94a3b8] hover:text-white bg-[#19202f] rounded-full size-4 flex items-center justify-center cursor-pointer"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-[#1e2538] text-[11px] font-mono text-[#94a3b8]">
            Active Text: <span className="text-[#00f0ff]">{basicText}</span>
          </div>
        </div>

        {/* ================= CARD 2: QUAD NUMERICAL STEPPERS (COORDINATES X, Y & SIZE W, H) ================= */}
        <div className="bg-[#131722] border border-[#1e2538] rounded-2xl p-5 space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1">
              <h4 className="text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-2">
                <Move className="size-3.5 text-[#a953f6]" />
                <span>Coordinate &amp; Size Steppers</span>
              </h4>
              <Chip className="bg-[#a953f6]/15 text-[#a953f6] text-[10px] font-mono h-4.5 px-1.5">
                X, Y · W, H
              </Chip>
            </div>
            <p className="text-[11px] text-[#94a3b8]">Numerical steppers with increment/decrement bounds.</p>
          </div>

          <div className="space-y-3">
            {/* Position Steppers (X, Y) */}
            <div>
              <div className="text-[10px] font-mono text-[#94a3b8] uppercase mb-1.5 flex items-center gap-1">
                <span>Position Vector [X, Y]</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {/* X Stepper */}
                <div className="bg-[#0b0d13] border border-[#1e2538] rounded-xl p-1.5 flex items-center justify-between">
                  <button
                    onClick={() => setCoordX(Math.max(0, coordX - 1))}
                    className="size-6 bg-[#131722] hover:bg-[#19202f] text-white rounded flex items-center justify-center cursor-pointer text-xs"
                  >
                    <Minus className="size-3" />
                  </button>
                  <div className="font-mono text-xs font-bold text-white px-1">
                    <span className="text-[#94a3b8] mr-0.5">X:</span>{coordX}
                  </div>
                  <button
                    onClick={() => setCoordX(Math.min(128, coordX + 1))}
                    className="size-6 bg-[#131722] hover:bg-[#19202f] text-white rounded flex items-center justify-center cursor-pointer text-xs"
                  >
                    <Plus className="size-3" />
                  </button>
                </div>

                {/* Y Stepper */}
                <div className="bg-[#0b0d13] border border-[#1e2538] rounded-xl p-1.5 flex items-center justify-between">
                  <button
                    onClick={() => setCoordY(Math.max(0, coordY - 1))}
                    className="size-6 bg-[#131722] hover:bg-[#19202f] text-white rounded flex items-center justify-center cursor-pointer text-xs"
                  >
                    <Minus className="size-3" />
                  </button>
                  <div className="font-mono text-xs font-bold text-white px-1">
                    <span className="text-[#94a3b8] mr-0.5">Y:</span>{coordY}
                  </div>
                  <button
                    onClick={() => setCoordY(Math.min(64, coordY + 1))}
                    className="size-6 bg-[#131722] hover:bg-[#19202f] text-white rounded flex items-center justify-center cursor-pointer text-xs"
                  >
                    <Plus className="size-3" />
                  </button>
                </div>
              </div>
            </div>

            {/* Size Steppers (W, H) */}
            <div>
              <div className="text-[10px] font-mono text-[#94a3b8] uppercase mb-1.5 flex items-center gap-1">
                <span>Dimensions Pair [W, H]</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {/* Width Stepper */}
                <div className="bg-[#0b0d13] border border-[#1e2538] rounded-xl p-1.5 flex items-center justify-between">
                  <button
                    onClick={() => setSizeW(Math.max(1, sizeW - 2))}
                    className="size-6 bg-[#131722] hover:bg-[#19202f] text-white rounded flex items-center justify-center cursor-pointer text-xs"
                  >
                    <Minus className="size-3" />
                  </button>
                  <div className="font-mono text-xs font-bold text-white px-1">
                    <span className="text-[#94a3b8] mr-0.5">W:</span>{sizeW}
                  </div>
                  <button
                    onClick={() => setSizeW(Math.min(128, sizeW + 2))}
                    className="size-6 bg-[#131722] hover:bg-[#19202f] text-white rounded flex items-center justify-center cursor-pointer text-xs"
                  >
                    <Plus className="size-3" />
                  </button>
                </div>

                {/* Height Stepper */}
                <div className="bg-[#0b0d13] border border-[#1e2538] rounded-xl p-1.5 flex items-center justify-between">
                  <button
                    onClick={() => setSizeH(Math.max(1, sizeH - 2))}
                    className="size-6 bg-[#131722] hover:bg-[#19202f] text-white rounded flex items-center justify-center cursor-pointer text-xs"
                  >
                    <Minus className="size-3" />
                  </button>
                  <div className="font-mono text-xs font-bold text-white px-1">
                    <span className="text-[#94a3b8] mr-0.5">H:</span>{sizeH}
                  </div>
                  <button
                    onClick={() => setSizeH(Math.min(64, sizeH + 2))}
                    className="size-6 bg-[#131722] hover:bg-[#19202f] text-white rounded flex items-center justify-center cursor-pointer text-xs"
                  >
                    <Plus className="size-3" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-[#1e2538] text-[11px] font-mono text-[#94a3b8] flex justify-between">
            <span>Pos: <strong className="text-[#00f0ff]">{coordX}, {coordY}</strong></span>
            <span>Size: <strong className="text-[#a953f6]">{sizeW}×{sizeH}</strong></span>
          </div>
        </div>

        {/* ================= CARD 3: SLIDER BAR & MODE SWITCHES ================= */}
        <div className="bg-[#131722] border border-[#1e2538] rounded-2xl p-5 space-y-4 flex flex-col justify-between">
          <div className="space-y-3.5">
            <div>
              <h4 className="text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-2">
                <Sun className="size-3.5 text-[#f2741d]" />
                <span>Slider Bar &amp; Toggles</span>
              </h4>
              <p className="text-[11px] text-[#94a3b8] mt-0.5">OLED contrast slider and hardware mode selectors.</p>
            </div>

            {/* Slider Bar Control */}
            <div className="space-y-2 bg-[#0b0d13] p-3 rounded-xl border border-[#1e2538]">
              <div className="flex items-center justify-between text-xs">
                <span className="text-white font-medium flex items-center gap-1.5">
                  <Sun className="size-3 text-[#f2741d]" /> Brightness / Contrast
                </span>
                <span className="font-mono font-bold text-[#00f0ff] text-xs">{brightness}%</span>
              </div>

              {/* Slider Input */}
              <input
                type="range"
                min="0"
                max="100"
                value={brightness}
                onChange={(e) => setBrightness(Number(e.target.value))}
                className="w-full h-2 bg-[#1e2538] rounded-lg appearance-none cursor-pointer accent-[#00f0ff]"
              />

              {/* Preset Buttons */}
              <div className="flex justify-between gap-1 pt-1">
                {[25, 50, 75, 100].map((preset) => (
                  <button
                    key={preset}
                    onClick={() => setBrightness(preset)}
                    className={`px-2 py-0.5 rounded text-[10px] font-mono transition-colors cursor-pointer ${
                      brightness === preset
                        ? 'bg-[#00f0ff]/20 text-[#00f0ff] border border-[#00f0ff]/40'
                        : 'bg-[#131722] text-[#94a3b8] hover:text-white border border-[#1e2538]'
                    }`}
                  >
                    {preset}%
                  </button>
                ))}
              </div>
            </div>

            {/* Select & Switch Toggles */}
            <div className="space-y-2.5">
              <select
                value={selectedPreset}
                onChange={(e) => setSelectedPreset(e.target.value)}
                className="w-full bg-[#0b0d13] border border-[#1e2538] focus:border-[#00f0ff] text-xs font-mono text-white rounded-lg px-2.5 py-2 outline-none cursor-pointer"
              >
                <option value="128x32">T1 - 128x32 Custom OLED Spec</option>
                <option value="128x64">T2 - 128x64 Dual Layer Spec</option>
                <option value="96x16">T3 - 96x16 Mini Status Pill</option>
              </select>

              <div className="flex items-center justify-between bg-[#0b0d13] p-2 px-3 rounded-xl border border-[#1e2538]">
                <span className="text-xs text-white">Screensaver Widget</span>
                <button
                  onClick={() => setScreensaverEnabled(!screensaverEnabled)}
                  className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer ${
                    screensaverEnabled ? 'bg-[#00f0ff]' : 'bg-[#232c3f]'
                  }`}
                >
                  <div
                    className={`size-4 rounded-full bg-[#0b0d13] transition-transform ${
                      screensaverEnabled ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-[#1e2538] text-[11px] font-mono text-[#94a3b8] flex justify-between">
            <span>Mode: <strong className="text-[#00f0ff]">{selectedPreset}</strong></span>
            <span>State: <strong className={screensaverEnabled ? 'text-emerald-400' : 'text-[#555e6e]'}>{screensaverEnabled ? 'On' : 'Off'}</strong></span>
          </div>
        </div>

      </div>
    </section>
  );
}

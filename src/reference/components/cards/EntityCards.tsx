import { useState } from 'react';
import { Button, Chip } from '@heroui/react';
import { Layers, ChevronDown, ChevronUp, Bluetooth, Battery } from 'lucide-react';
import { MOCK_DEVICE } from '../../data/paletteData';

export default function EntityCards() {
  const [accordionOpen, setAccordionOpen] = useState(true);

  return (
    <section className="space-y-5">
      {/* Header */}
      <div className="border-b border-[#1e2538] pb-4">
        <div className="flex items-center gap-2">
          <Layers className="size-5 text-[#00f0ff]" />
          <h2 className="text-xl font-bold text-white tracking-tight">Items Cards</h2>
        </div>
        <p className="text-sm text-[#94a3b8] mt-1">
          Structured item cards: hardware telemetry, expandable configuration layers, and OLED display specifications.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Studio Core Hardware Item Card */}
        <div className="bg-[#131722] border border-[#00f0ff]/30 hover:border-[#00f0ff] rounded-2xl p-4 flex flex-col justify-between transition-all group">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-mono text-[#00f0ff]">Hardware Status</span>
              <span className="size-2 rounded-full bg-[#00f0ff] animate-pulse"></span>
            </div>
            <h3 className="text-sm font-bold text-white">{MOCK_DEVICE.name}</h3>
            <p className="text-xs text-[#94a3b8] mt-1">{MOCK_DEVICE.firmware}</p>

            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between text-xs bg-[#0b0d13] p-2 rounded-xl border border-[#1e2538]">
                <span className="text-[#94a3b8] flex items-center gap-1.5">
                  <Bluetooth className="size-3.5 text-[#00f0ff]" /> BLE 5.2
                </span>
                <span className="text-[#00f0ff] font-mono text-[11px] font-semibold">Active</span>
              </div>
              <div className="flex items-center justify-between text-xs bg-[#0b0d13] p-2 rounded-xl border border-[#1e2538]">
                <span className="text-[#94a3b8] flex items-center gap-1.5">
                  <Battery className="size-3.5 text-emerald-400" /> Battery
                </span>
                <span className="text-white font-mono text-[11px]">{MOCK_DEVICE.battery}%</span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[#1e2538]">
            <Button
              size="sm"
              className="w-full bg-[#00f0ff]/10 hover:bg-[#00f0ff] text-[#00f0ff] hover:text-[#0b0d13] border border-[#00f0ff]/30 hover:border-[#00f0ff] text-xs font-semibold py-1.5 rounded-lg transition-all duration-200 hover:shadow-[0_0_16px_rgba(0,240,255,0.4)] cursor-pointer"
            >
              Inspect Telemetry
            </Button>
          </div>
        </div>

        {/* 2. Expandable Accordion Item */}
        <div className="bg-[#131722] border border-[#1e2538] rounded-2xl p-4 flex flex-col justify-between">
          <div>
            <button
              onClick={() => setAccordionOpen(!accordionOpen)}
              className="w-full flex items-center justify-between text-left cursor-pointer"
            >
              <div>
                <span className="text-[11px] font-mono text-[#a953f6]">Config Layer</span>
                <h3 className="text-sm font-bold text-white mt-0.5">ZMK Core Bindings</h3>
              </div>
              <div className="size-6 rounded-lg bg-[#0b0d13] border border-[#1e2538] flex items-center justify-center text-[#94a3b8]">
                {accordionOpen ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
              </div>
            </button>

            {accordionOpen ? (
              <div className="mt-4 space-y-2 text-xs">
                <div className="bg-[#0b0d13] p-2 rounded-xl border border-[#1e2538] flex justify-between items-center">
                  <span className="text-[#94a3b8] font-mono">Layer 0 (Base)</span>
                  <span className="text-[#00f0ff] font-mono text-[11px]">QWERTY</span>
                </div>
                <div className="bg-[#0b0d13] p-2 rounded-xl border border-[#1e2538] flex justify-between items-center">
                  <span className="text-[#94a3b8] font-mono">Layer 1 (Nav)</span>
                  <span className="text-[#a953f6] font-mono text-[11px]">HJKL + PgUp</span>
                </div>
                <div className="bg-[#0b0d13] p-2 rounded-xl border border-[#1e2538] flex justify-between items-center">
                  <span className="text-[#94a3b8] font-mono">Layer 2 (Media)</span>
                  <span className="text-[#f2741d] font-mono text-[11px]">Vol+ / Vol-</span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-[#555e6e] mt-4">Accordion collapsed. Click to reveal layer matrix.</p>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-[#1e2538] text-[11px] font-mono text-[#555e6e]">
            Tokens: 5 of 8 active
          </div>
        </div>

        {/* 3. Font Mapping Spec Card (OLED Font) */}
        <div className="bg-[#131722] border border-[#1e2538] rounded-2xl p-4 flex flex-col justify-between">
          <div>
            <span className="text-[11px] font-mono text-[#f2741d]">Typography Spec</span>
            <h3 className="text-sm font-bold text-white mt-0.5">OLED Font Matrix</h3>
            <p className="text-xs text-[#94a3b8] mt-1">1-Bit Monochrome Raster Engine</p>

            <div className="mt-4 bg-[#0b0d13] p-3 rounded-xl border border-[#1e2538] font-mono space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-[#94a3b8]">Pitch:</span>
                <span className="text-white">6x8 px</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#94a3b8]">Glyphs:</span>
                <span className="text-[#00f0ff]">128 (ASCII)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#94a3b8]">Memory:</span>
                <span className="text-[#a953f6]">1,024 Bytes</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#94a3b8]">Buffer:</span>
                <span className="text-[#f2741d]">Direct SPI DMA</span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[#1e2538] flex items-center justify-between text-[11px] font-mono">
            <span className="text-[#94a3b8]">Driver: SSD1306</span>
            <span className="text-[#00f0ff]">I2C / SPI</span>
          </div>
        </div>

        {/* 4. Screen Mock Spec Blocks (Simulated OLED Canvas) */}
        <div className="bg-[#131722] border border-[#1e2538] rounded-2xl p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-mono text-[#00f0ff]">Screen Mock Spec</span>
              <Chip className="bg-[#00f0ff]/15 text-[#00f0ff] text-[10px] font-mono h-4.5 px-1.5">
                OLED LIVE
              </Chip>
            </div>
            <h3 className="text-sm font-bold text-white">128x32 Mono Canvas</h3>

            {/* Visual Pixel Screen Box */}
            <div className="mt-3 bg-black border-2 border-[#1e2538] rounded-xl p-3 font-mono shadow-[inset_0_2px_8px_rgba(0,0,0,0.8)]">
              <div className="flex items-center justify-between text-[10px] text-white border-b border-white/20 pb-1 mb-1.5">
                <span className="font-bold tracking-widest text-[#00f0ff]">SCYAN·ZMK</span>
                <span>BAT: 92%</span>
              </div>
              <div className="flex items-center justify-between text-xs text-white">
                <span className="text-white font-bold tracking-wider">[L2 NAV]</span>
                <span className="text-[10px] text-white/80">BLE: #1</span>
              </div>
              <div className="mt-1 flex items-center gap-1">
                <div className="h-1.5 w-full bg-white/10 rounded-sm overflow-hidden">
                  <div className="h-full bg-white w-[65%]"></div>
                </div>
                <span className="text-[9px] text-white/80">65%</span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[#1e2538] flex items-center justify-between text-[11px] font-mono text-[#555e6e]">
            <span>1-Bit Bitmapped</span>
            <span className="text-white">Active</span>
          </div>
        </div>
      </div>
    </section>
  );
}

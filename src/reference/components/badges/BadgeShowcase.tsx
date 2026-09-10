import { Chip } from '@heroui/react';
import { Tag, Bluetooth, BatteryCharging, GitBranch, Cpu } from 'lucide-react';

export default function BadgeShowcase() {
  return (
    <section className="space-y-5">
      {/* Header */}
      <div className="border-b border-[#1e2538] pb-4">
        <div className="flex items-center gap-2">
          <Tag className="size-5 text-[#f2741d]" />
          <h2 className="text-xl font-bold text-white tracking-tight">Badges, Tags &amp; Status Chips</h2>
        </div>
        <p className="text-sm text-[#94a3b8] mt-1">
          Visual pills and status indicators for hardware pins, repository connection, and display geometry.
        </p>
      </div>

      {/* Tri-Tone Semantic Badges Bar */}
      <div className="bg-[#131722] border border-[#1e2538] rounded-2xl p-5 space-y-3">
        <h4 className="text-xs font-semibold text-white uppercase tracking-wider">
          Tri-Tone Semantic Badges &amp; Chips
        </h4>
        <div className="flex flex-wrap items-center gap-2.5">
          <Chip className="bg-[#00f0ff]/15 text-[#00f0ff] border border-[#00f0ff]/40 text-xs font-mono font-semibold px-3 py-1">
            • 0X7F89321: FLASH_PRIMARY
          </Chip>
          <Chip className="bg-[#00f0ff]/15 text-[#00f0ff] border border-[#00f0ff]/40 text-xs font-mono font-semibold px-3 py-1">
            • IDE_NORMAL_FLOW: PASS
          </Chip>
          <Chip className="bg-[#a953f6]/15 text-[#a953f6] border border-[#a953f6]/40 text-xs font-mono font-semibold px-3 py-1">
            • SECONDARY: ZMK_MODULE
          </Chip>
          <Chip className="bg-[#a953f6]/15 text-[#a953f6] border border-[#a953f6]/40 text-xs font-mono font-semibold px-3 py-1">
            • ACTIVE LAYER: L2_NAV
          </Chip>
          <Chip className="bg-[#f2741d]/15 text-[#f2741d] border border-[#f2741d]/40 text-xs font-mono font-semibold px-3 py-1">
            • WARNING: 17% FLASH REMAINING
          </Chip>
          <Chip className="bg-[#f2741d]/15 text-[#f2741d] border border-[#f2741d]/40 text-xs font-mono font-semibold px-3 py-1">
            • STATE: REBUILD_CONFLICT
          </Chip>
        </div>
      </div>

      {/* 4 Detail Columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Status Rings */}
        <div className="bg-[#131722] border border-[#1e2538] rounded-2xl p-4 space-y-3">
          <h4 className="text-xs font-semibold text-white uppercase tracking-wider">Live Status Indicators</h4>
          <div className="space-y-2.5">
            <div className="flex items-center gap-2 text-xs text-white">
              <span className="size-2 rounded-full bg-[#00f0ff] animate-ping"></span>
              <span className="size-2 rounded-full bg-[#00f0ff] -ml-4"></span>
              <span>Hardware Connected</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-white">
              <span className="size-2 rounded-full bg-[#a953f6]"></span>
              <span>Layer 2 Navigation Active</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-white">
              <span className="size-2 rounded-full bg-[#f2741d]"></span>
              <span>Warning: Sleep Disabled</span>
            </div>
          </div>
        </div>

        {/* 2. Hardware Live Chips */}
        <div className="bg-[#131722] border border-[#1e2538] rounded-2xl p-4 space-y-3">
          <h4 className="text-xs font-semibold text-white uppercase tracking-wider">Device Telemetry Chips</h4>
          <div className="space-y-2">
            <div className="bg-[#0b0d13] border border-[#00f0ff]/30 rounded-xl p-2 flex items-center justify-between">
              <span className="text-[11px] font-mono text-[#94a3b8] flex items-center gap-1.5">
                <Bluetooth className="size-3 text-[#00f0ff]" /> BLE Link
              </span>
              <Chip className="bg-[#00f0ff]/20 text-[#00f0ff] text-[10px] font-mono h-4.5 px-1.5 font-semibold">
                PAIR 1
              </Chip>
            </div>
            <div className="bg-[#0b0d13] border border-[#f2741d]/30 rounded-xl p-2 flex items-center justify-between">
              <span className="text-[11px] font-mono text-[#94a3b8] flex items-center gap-1.5">
                <BatteryCharging className="size-3 text-[#f2741d]" /> Battery
              </span>
              <Chip className="bg-[#f2741d]/20 text-[#f2741d] text-[10px] font-mono h-4.5 px-1.5 font-semibold">
                92%
              </Chip>
            </div>
          </div>
        </div>

        {/* 3. Layer & Dimension Pills */}
        <div className="bg-[#131722] border border-[#1e2538] rounded-2xl p-4 space-y-3">
          <h4 className="text-xs font-semibold text-white uppercase tracking-wider">Layer &amp; Dimension Pills</h4>
          <div className="flex flex-wrap gap-1.5">
            {['L0 Default', 'L1 Lower', 'L2 Raise', 'L3 Adjust'].map((layer, idx) => (
              <span
                key={layer}
                className={`px-2 py-1 rounded-md text-[11px] font-mono font-medium border ${
                  idx === 2
                    ? 'bg-[#a953f6]/20 text-[#a953f6] border-[#a953f6]/50'
                    : 'bg-[#0b0d13] text-[#94a3b8] border-[#1e2538]'
                }`}
              >
                {layer}
              </span>
            ))}
          </div>
          <div className="flex gap-1.5 pt-1">
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#00f0ff]/10 text-[#00f0ff] border border-[#00f0ff]/30">
              128x32 px
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#19202f] text-[#94a3b8] border border-[#1e2538]">
              60 FPS
            </span>
          </div>
        </div>

        {/* 4. Dynamic Process Badges */}
        <div className="bg-[#131722] border border-[#1e2538] rounded-2xl p-4 space-y-3">
          <h4 className="text-xs font-semibold text-white uppercase tracking-wider">Workflow Badges</h4>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs bg-[#0b0d13] p-2 rounded-xl border border-[#1e2538]">
              <span className="text-[#94a3b8] flex items-center gap-1.5">
                <GitBranch className="size-3 text-[#00f0ff]" /> Git Pending
              </span>
              <span className="bg-[#00f0ff]/20 text-[#00f0ff] font-mono text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                #241
              </span>
            </div>
            <div className="flex items-center justify-between text-xs bg-[#0b0d13] p-2 rounded-xl border border-[#1e2538]">
              <span className="text-[#94a3b8] flex items-center gap-1.5">
                <Cpu className="size-3 text-[#a953f6]" /> Building .uf2
              </span>
              <span className="bg-[#a953f6]/20 text-[#a953f6] font-mono text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                78%
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

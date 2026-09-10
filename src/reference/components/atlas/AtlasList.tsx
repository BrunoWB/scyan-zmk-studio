import React, { useState } from 'react';
import { Chip } from '@heroui/react';
import { 
  ListTree, 
  Trash2, 
  FolderCheck, 
  Layers, 
  Image as ImageIcon, 
  Type, 
  Info,
  FileText,
  BadgeAlert
} from 'lucide-react';

// Custom pixel art SVGs
function UsbPixelIcon() {
  return (
    <svg width="24" height="20" viewBox="0 0 16 14" fill="none" className="text-[#00f0ff]">
      <rect x="2" y="2" width="6" height="8" stroke="currentColor" strokeWidth="1.2" fill="none" />
      <rect x="4" y="4" width="2" height="2" fill="currentColor" />
      <path d="M8 6h3a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2H6" stroke="currentColor" strokeWidth="1.2" />
      <rect x="5" y="11" width="2" height="2" fill="currentColor" />
    </svg>
  );
}

function BatteryPixelIcon({ level = 0 }: { level?: number }) {
  return (
    <svg width="32" height="18" viewBox="0 0 20 12" fill="none" className="text-[#00f0ff]">
      <rect x="1" y="1" width="16" height="10" rx="1" stroke="currentColor" strokeWidth="1.2" fill="#0b0d13" />
      <rect x="17" y="4" width="2" height="4" fill="currentColor" />
      {level > 0 && <rect x="3" y="3" width={level * 3.8} height="6" fill="currentColor" />}
    </svg>
  );
}

function BongoCatIcon({ frame = 1 }: { frame?: number }) {
  return (
    <svg width="40" height="26" viewBox="0 0 32 20" fill="none" className="text-[#00f0ff]">
      <path d="M6 14V6L10 9H22L26 6V14" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
      <circle cx="12" cy="11" r="0.8" fill="currentColor" />
      <circle cx="20" cy="11" r="0.8" fill="currentColor" />
      <path d="M14 13q2 1 4 0" stroke="currentColor" strokeWidth="0.8" />
      {frame === 1 && (
        <>
          <path d="M6 15q2 -3 4 0" stroke="currentColor" strokeWidth="1.2" />
          <path d="M22 15q2 -3 4 0" stroke="currentColor" strokeWidth="1.2" />
        </>
      )}
      {frame === 2 && (
        <>
          <path d="M6 15q2 -3 4 0" stroke="currentColor" strokeWidth="1.2" />
          <path d="M22 17h4" stroke="currentColor" strokeWidth="1.6" />
        </>
      )}
      {frame === 3 && (
        <>
          <path d="M6 17h4" stroke="currentColor" strokeWidth="1.6" />
          <path d="M22 15q2 -3 4 0" stroke="currentColor" strokeWidth="1.2" />
        </>
      )}
    </svg>
  );
}

function LighthouseIcon() {
  return (
    <svg width="30" height="52" viewBox="0 0 24 44" fill="none" className="text-[#00f0ff]">
      <path d="M2 4L8 10M22 4L16 10" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2" opacity="0.7" />
      <rect x="9" y="8" width="6" height="6" stroke="currentColor" strokeWidth="1.2" fill="currentColor" fillOpacity="0.2" />
      <path d="M9 14L7 38H17L15 14Z" stroke="currentColor" strokeWidth="1.2" fill="#0b0d13" />
      <line x1="8.5" y1="20" x2="15.5" y2="20" stroke="currentColor" strokeWidth="1.2" />
      <line x1="8" y1="28" x2="16" y2="28" stroke="currentColor" strokeWidth="1.2" />
      <rect x="5" y="38" width="14" height="4" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

export default function AtlasList() {
  const [selectedId, setSelectedId] = useState('charge-1');
  const [viewFilter, setViewFilter] = useState<'all' | 'single' | 'dual' | 'text'>('all');
  const [showBadges, setShowBadges] = useState(true);

  // Single-Item Data (Type 1: 1-item slot)
  const [singleItems, setSingleItems] = useState([
    {
      id: 'standalone-usb',
      title: 'USB Plug',
      coords: '0,46 · 12×10',
      type: 'usb',
      badge: '(1)',
      isGrouped: false
    },
    {
      id: 'standalone-lighthouse',
      title: 'import test',
      coords: '63,144 · 32×64',
      type: 'lighthouse',
      badge: '(badge)',
      isGrouped: false
    }
  ]);

  // Group 1: Battery Charge States (Type 1, wrapped together)
  const [chargeGroup, setChargeGroup] = useState([
    { id: 'charge-1', title: 'Charge', coords: '1,94 · 17×10', level: 0, badge: '(1)' },
    { id: 'charge-2', title: 'Charge #2', coords: '20,94 · 17×10', level: 0, badge: '(2)' },
    { id: 'charge-3', title: 'Charge #3', coords: '39,94 · 17×10', level: 0, badge: null },
    { id: 'charge-4', title: 'Charge #4', coords: '58,94 · 17×10', level: 0, badge: null },
    { id: 'charge-5', title: 'Charge #5', coords: '1,106 · 17×10', level: 1, badge: null },
    { id: 'charge-6', title: 'Charge #6', coords: '20,106 · 17×10', level: 2, badge: '(badge)' },
    { id: 'charge-7', title: 'Charge #7', coords: '39,106 · 17×10', level: 3, badge: '(1)' }
  ]);

  // Group 2: Bongo Cat Animations (Type 1, wrapped together)
  const [bongoGroup, setBongoGroup] = useState([
    { id: 'bongo-1', title: 'Bongo Cat', coords: '128,11 · 32×23', frame: 1, badge: '(1)' },
    { id: 'bongo-2', title: 'Bongo Cat #2', coords: '160,11 · 32×23', frame: 2, badge: '(badge)' },
    { id: 'bongo-3', title: 'Bongo Cat #3', coords: '192,11 · 32×23', frame: 3, badge: '(3)' }
  ]);

  // Dual-Item Data (Type 2: holds 2 slots/items per entry)
  const [dualItems, setDualItems] = useState([
    {
      id: 'dual-a',
      label: 'aA',
      slot1: { tag: '4×5', glyph: 'A', color: 'cyan' },
      slot2: { tag: '8×10', glyph: '4', color: 'purple' },
      badge: '(1)'
    },
    {
      id: 'dual-b',
      label: 'bB',
      slot1: { tag: '4×5', glyph: 'B', color: 'cyan' },
      slot2: { tag: 'B -', glyph: null, color: 'unassigned' },
      badge: '(badge)'
    },
    {
      id: 'dual-c',
      label: 'cC',
      slot1: { tag: '4×5', glyph: 'C', color: 'cyan' },
      slot2: { tag: 'B -', glyph: null, color: 'unassigned' },
      badge: '(2)'
    },
    {
      id: 'dual-d',
      label: 'dD',
      slot1: { tag: '4×5', glyph: 'D', color: 'cyan' },
      slot2: { tag: 'B -', glyph: null, color: 'unassigned' },
      badge: null
    },
    {
      id: 'dual-e',
      label: 'eE',
      slot1: { tag: '4×5', glyph: 'E', color: 'cyan' },
      slot2: { tag: 'B -', glyph: null, color: 'unassigned' },
      badge: '(1)'
    },
    {
      id: 'dual-f',
      label: 'fF',
      slot1: { tag: '4×5', glyph: 'F', color: 'cyan' },
      slot2: { tag: 'B -', glyph: null, color: 'unassigned' },
      badge: null
    }
  ]);

  // Non-Atlas List Data (Text Labels Inside Similar Wrapper)
  const [textGroup, setTextGroup] = useState([
    { id: 'text-1', label: 'Layer 0 — Default Base QWERTY Layout', badge: '(1)', subtitle: 'Primary keymap matrix' },
    { id: 'text-2', label: 'Layer 1 — Lower Symbols & Punctuation', badge: '(badge)', subtitle: 'Shifted symbol mappings' },
    { id: 'text-3', label: 'Layer 2 — Raise Navigation & Arrows', badge: '(1)', subtitle: 'HJKL, Home, End, PageUp' },
    { id: 'text-4', label: 'Layer 3 — Adjust Hardware & Diagnostics', badge: '(2)', subtitle: 'BLE clear, bootloader jump' },
    { id: 'text-5', label: 'Layer 4 — Media Controls & Audio', badge: null, subtitle: 'Play, pause, volume wheel' },
    { id: 'text-6', label: 'Layer 5 — RGB Underglow Animation Matrix', badge: '(badge)', subtitle: 'Breath, rainbow, strobe' },
  ]);

  const [standaloneText, setStandaloneText] = useState([
    { id: 'text-stand-1', label: 'Global 60 FPS OLED Refresh Rate Arbiter', badge: '(1)', subtitle: 'System driver lock' },
    { id: 'text-stand-2', label: 'SPI Flash Sector Wear-Leveling Watchdog', badge: '(badge)', subtitle: 'Storage telemetry' },
  ]);

  const handleDelete = (e: React.MouseEvent, id: string, listType: string) => {
    e.stopPropagation();
    if (listType === 'charge') setChargeGroup(prev => prev.filter(item => item.id !== id));
    else if (listType === 'bongo') setBongoGroup(prev => prev.filter(item => item.id !== id));
    else if (listType === 'single') setSingleItems(prev => prev.filter(item => item.id !== id));
    else if (listType === 'dual') setDualItems(prev => prev.filter(item => item.id !== id));
    else if (listType === 'text') setTextGroup(prev => prev.filter(item => item.id !== id));
    else if (listType === 'standaloneText') setStandaloneText(prev => prev.filter(item => item.id !== id));
  };

  return (
    <section className="space-y-6">
      {/* Section Header */}
      <div className="border-b border-[#1e2538] pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ListTree className="size-5 text-[#00f0ff]" />
            <h2 className="text-xl font-bold text-white tracking-tight">Atlas &amp; Non-Atlas Lists</h2>
          </div>
          <p className="text-sm text-[#94a3b8] mt-1">
            Lists supporting 1-item, 2-item slots, text-only labels, wrapped group containers, and top-right badges.
          </p>
        </div>

        {/* Controls: Filter & Badge Toggle */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => setShowBadges(!showBadges)}
            className={`px-3 py-1 text-xs font-mono rounded-lg border transition-all cursor-pointer flex items-center gap-1.5 ${
              showBadges
                ? 'bg-[#00f0ff]/15 text-[#00f0ff] border-[#00f0ff]/40'
                : 'bg-[#131722] text-[#94a3b8] border-[#1e2538]'
            }`}
          >
            <BadgeAlert className="size-3.5" />
            <span>Badges (1): {showBadges ? 'ON' : 'OFF'}</span>
          </button>

          <div className="flex items-center gap-1 bg-[#131722] p-1 rounded-xl border border-[#1e2538]">
            {([
              { id: 'all' as const, label: 'All' },
              { id: 'single' as const, label: '1-Item' },
              { id: 'dual' as const, label: '2-Item' },
              { id: 'text' as const, label: 'Text Only' },
            ]).map(tab => (
              <button
                key={tab.id}
                onClick={() => setViewFilter(tab.id)}
                className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-all cursor-pointer ${
                  viewFilter === tab.id
                    ? 'bg-[#00f0ff] text-[#0b0d13] font-semibold shadow-[0_0_10px_rgba(0,240,255,0.3)]'
                    : 'text-[#94a3b8] hover:text-white hover:bg-[#19202f]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Info Callout */}
      <div className="bg-[#131722] border border-[#1e2538] rounded-xl p-3.5 flex items-center justify-between text-xs text-[#94a3b8]">
        <div className="flex items-center gap-2">
          <Info className="size-4 text-[#00f0ff] shrink-0" />
          <span>
            Every list item can display an optional badge <strong className="text-[#00f0ff] font-mono">(1)</strong> or <strong className="text-[#a953f6] font-mono">(badge)</strong> on its top right. Items wrapped in groups share an outer boundary with row dividers.
          </span>
        </div>
      </div>

      {/* Grid of List Types */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        
        {/* ================= COLUMN 1: TYPE 1 (1-ITEM SLOTS + WRAPPED GROUPS) ================= */}
        {(viewFilter === 'all' || viewFilter === 'single') && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ImageIcon className="size-4 text-[#00f0ff]" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Type 1: 1-Item Slot (Atlas)
                </h3>
              </div>
              <Chip className="bg-[#00f0ff]/15 text-[#00f0ff] text-[10px] font-mono h-5 px-1.5">
                Graphics &amp; States
              </Chip>
            </div>

            <div className="space-y-3">
              {/* Standalone Items */}
              {singleItems.map(item => (
                <div
                  key={item.id}
                  onClick={() => setSelectedId(item.id)}
                  className={`relative bg-[#131722] rounded-xl p-3 px-3.5 flex items-center justify-between border transition-all cursor-pointer ${
                    selectedId === item.id
                      ? 'border-[#00f0ff] shadow-[0_0_12px_rgba(0,240,255,0.25)] ring-1 ring-[#00f0ff]'
                      : 'border-[#1e2538] hover:border-[#2d3748] hover:bg-[#19202f]'
                  }`}
                >
                  {/* Top-Right Badge (1) */}
                  {showBadges && item.badge && (
                    <span className="absolute -top-1.5 -right-1.5 bg-[#00f0ff]/20 text-[#00f0ff] border border-[#00f0ff]/50 text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-full shadow-[0_0_8px_rgba(0,240,255,0.3)] z-10">
                      {item.badge}
                    </span>
                  )}

                  <div className="flex items-center gap-2.5">
                    <span className="size-2 rounded-full bg-[#00f0ff]"></span>
                    <div>
                      <h4 className="text-xs font-semibold text-white">{item.title}</h4>
                      <p className="text-[10px] font-mono text-[#94a3b8]">{item.coords}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <div className="bg-[#0b0d13] border border-[#1e2538] rounded-lg p-1.5 size-8 flex items-center justify-center">
                      {item.type === 'usb' && <UsbPixelIcon />}
                      {item.type === 'lighthouse' && <LighthouseIcon />}
                    </div>
                    <button
                      onClick={(e) => handleDelete(e, item.id, 'single')}
                      className="text-[#555e6e] hover:text-[#f2741d] p-1 rounded transition-colors cursor-pointer"
                      title="Delete entry"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
              ))}

              {/* Wrapped Group: Battery Charge States */}
              {chargeGroup.length > 0 && (
                <div className="bg-[#131722] border border-[#1e2538] rounded-2xl p-2 space-y-1 overflow-hidden">
                  <div className="px-2.5 py-1.5 flex items-center justify-between border-b border-[#1e2538]/60 mb-1">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-[#94a3b8] flex items-center gap-1.5">
                      <FolderCheck className="size-3 text-[#00f0ff]" /> Battery States Group
                    </span>
                    <span className="text-[10px] font-mono text-[#555e6e]">
                      {chargeGroup.length} wrapped
                    </span>
                  </div>

                  {chargeGroup.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => setSelectedId(item.id)}
                      className={`relative rounded-xl p-2 px-3 flex items-center justify-between border transition-all cursor-pointer ${
                        selectedId === item.id
                          ? 'border-[#00f0ff] bg-[#0b0d13] shadow-[0_0_12px_rgba(0,240,255,0.25)] ring-1 ring-[#00f0ff]'
                          : 'border-transparent hover:bg-[#19202f] hover:border-[#1e2538]'
                      }`}
                    >
                      {/* Top-Right Badge */}
                      {showBadges && item.badge && (
                        <span className="absolute -top-1 -right-1 bg-[#00f0ff]/20 text-[#00f0ff] border border-[#00f0ff]/50 text-[9px] font-mono font-bold px-1.5 rounded-full shadow-[0_0_6px_rgba(0,240,255,0.3)] z-10">
                          {item.badge}
                        </span>
                      )}

                      <div className="flex items-center gap-2.5">
                        <span className="size-2 rounded-full bg-[#00f0ff]"></span>
                        <div>
                          <h4 className="text-xs font-semibold text-white">{item.title}</h4>
                          <p className="text-[10px] font-mono text-[#94a3b8]">{item.coords}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="bg-[#0b0d13] border border-[#1e2538] rounded-lg px-2 py-0.5 flex items-center justify-center">
                          <BatteryPixelIcon level={item.level} />
                        </div>
                        <button
                          onClick={(e) => handleDelete(e, item.id, 'charge')}
                          className="text-[#555e6e] hover:text-[#f2741d] p-1 rounded transition-colors cursor-pointer"
                          title="Delete entry"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Wrapped Group: Bongo Cat Animation */}
              {bongoGroup.length > 0 && (
                <div className="bg-[#131722] border border-[#1e2538] rounded-2xl p-2 space-y-1 overflow-hidden">
                  <div className="px-2.5 py-1.5 flex items-center justify-between border-b border-[#1e2538]/60 mb-1">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-[#94a3b8] flex items-center gap-1.5">
                      <FolderCheck className="size-3 text-[#a953f6]" /> Bongo Cat Frames
                    </span>
                    <span className="text-[10px] font-mono text-[#555e6e]">
                      {bongoGroup.length} frames
                    </span>
                  </div>

                  {bongoGroup.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => setSelectedId(item.id)}
                      className={`relative rounded-xl p-2 px-3 flex items-center justify-between border transition-all cursor-pointer ${
                        selectedId === item.id
                          ? 'border-[#00f0ff] bg-[#0b0d13] shadow-[0_0_12px_rgba(0,240,255,0.25)] ring-1 ring-[#00f0ff]'
                          : 'border-transparent hover:bg-[#19202f] hover:border-[#1e2538]'
                      }`}
                    >
                      {/* Top-Right Badge */}
                      {showBadges && item.badge && (
                        <span className="absolute -top-1 -right-1 bg-[#a953f6]/25 text-[#a953f6] border border-[#a953f6]/50 text-[9px] font-mono font-bold px-1.5 rounded-full shadow-[0_0_6px_rgba(169,83,246,0.3)] z-10">
                          {item.badge}
                        </span>
                      )}

                      <div className="flex items-center gap-2.5">
                        <span className="size-2 rounded-full bg-[#00f0ff]"></span>
                        <div>
                          <h4 className="text-xs font-semibold text-white">{item.title}</h4>
                          <p className="text-[10px] font-mono text-[#94a3b8]">{item.coords}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="bg-[#0b0d13] border border-[#1e2538] rounded-lg p-0.5 px-1.5 flex items-center justify-center">
                          <BongoCatIcon frame={item.frame} />
                        </div>
                        <button
                          onClick={(e) => handleDelete(e, item.id, 'bongo')}
                          className="text-[#555e6e] hover:text-[#f2741d] p-1 rounded transition-colors cursor-pointer"
                          title="Delete frame"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================= COLUMN 2: TYPE 2 (2-ITEM SLOTS / DUAL GLYPHS) ================= */}
        {(viewFilter === 'all' || viewFilter === 'dual') && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Type className="size-4 text-[#a953f6]" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Type 2: Dual-Item Slots (Atlas)
                </h3>
              </div>
              <Chip className="bg-[#a953f6]/15 text-[#a953f6] text-[10px] font-mono h-5 px-1.5">
                2-Item Pairs
              </Chip>
            </div>

            <div className="bg-[#131722] border border-[#1e2538] rounded-2xl p-2 space-y-1">
              <div className="px-2.5 py-1.5 flex items-center justify-between border-b border-[#1e2538]/60 mb-1">
                <span className="text-[10px] font-mono uppercase tracking-wider text-[#94a3b8] flex items-center gap-1.5">
                  <Layers className="size-3 text-[#a953f6]" /> Font Glyph Pairings
                </span>
                <span className="text-[10px] font-mono text-[#555e6e]">
                  Slot 1 + Slot 2
                </span>
              </div>

              {dualItems.map((item) => (
                <div
                  key={item.id}
                  onClick={() => setSelectedId(item.id)}
                  className={`relative rounded-xl p-2 px-3 flex items-center justify-between border transition-all cursor-pointer ${
                    selectedId === item.id
                      ? 'border-[#00f0ff] bg-[#0b0d13] shadow-[0_0_12px_rgba(0,240,255,0.25)] ring-1 ring-[#00f0ff]'
                      : 'border-transparent hover:bg-[#19202f] hover:border-[#1e2538]'
                  }`}
                >
                  {/* Top-Right Badge (1) */}
                  {showBadges && item.badge && (
                    <span className="absolute -top-1 -right-1 bg-[#00f0ff]/20 text-[#00f0ff] border border-[#00f0ff]/50 text-[9px] font-mono font-bold px-1.5 rounded-full shadow-[0_0_6px_rgba(0,240,255,0.3)] z-10">
                      {item.badge}
                    </span>
                  )}

                  {/* Left: Label & Dual Badges */}
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono text-xs font-bold text-white w-6">{item.label}</span>
                    
                    {/* Slot 1 Badge */}
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-[#00f0ff]/15 text-[#00f0ff] border border-[#00f0ff]/30 font-medium">
                      {item.slot1.tag}
                    </span>

                    {/* Slot 2 Badge */}
                    {item.slot2.color === 'purple' ? (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-[#a953f6]/20 text-[#a953f6] border border-[#a953f6]/40 font-medium">
                        {item.slot2.tag}
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-[#0b0d13] text-[#555e6e] border border-[#1e2538]">
                        {item.slot2.tag}
                      </span>
                    )}
                  </div>

                  {/* Right: Dual Previews & Delete */}
                  <div className="flex items-center gap-1.5">
                    <div className="size-6 rounded-lg bg-[#0b0d13] border border-[#1e2538] flex items-center justify-center font-mono font-bold text-[11px] text-[#00f0ff]">
                      {item.slot1.glyph}
                    </div>

                    {item.slot2.glyph ? (
                      <div className="size-6 rounded-lg bg-[#a953f6]/20 border border-[#a953f6]/40 flex items-center justify-center font-mono font-bold text-[11px] text-[#a953f6]">
                        {item.slot2.glyph}
                      </div>
                    ) : (
                      <div className="size-6 rounded-lg bg-[#0b0d13]/50 border border-[#1e2538]/50 flex items-center justify-center font-mono text-[9px] text-[#555e6e]">
                        —
                      </div>
                    )}

                    <button
                      onClick={(e) => handleDelete(e, item.id, 'dual')}
                      className="text-[#555e6e] hover:text-[#f2741d] p-1 rounded transition-colors cursor-pointer ml-0.5"
                      title="Delete mapping"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ================= COLUMN 3: NON-ATLAS LIST (TEXT LABELS IN WRAPPER) ================= */}
        {(viewFilter === 'all' || viewFilter === 'text') && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="size-4 text-[#f2741d]" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Non-Atlas List (Text Labels)
                </h3>
              </div>
              <Chip className="bg-[#f2741d]/15 text-[#f2741d] text-[10px] font-mono h-5 px-1.5">
                Simple Labels
              </Chip>
            </div>

            <div className="space-y-3">
              {/* Standalone Text Items */}
              {standaloneText.map(item => (
                <div
                  key={item.id}
                  onClick={() => setSelectedId(item.id)}
                  className={`relative bg-[#131722] rounded-xl p-3 px-3.5 flex items-center justify-between border transition-all cursor-pointer ${
                    selectedId === item.id
                      ? 'border-[#00f0ff] shadow-[0_0_12px_rgba(0,240,255,0.25)] ring-1 ring-[#00f0ff]'
                      : 'border-[#1e2538] hover:border-[#2d3748] hover:bg-[#19202f]'
                  }`}
                >
                  {/* Top-Right Badge */}
                  {showBadges && item.badge && (
                    <span className="absolute -top-1.5 -right-1.5 bg-[#f2741d]/20 text-[#f2741d] border border-[#f2741d]/50 text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-full shadow-[0_0_8px_rgba(242,116,29,0.3)] z-10">
                      {item.badge}
                    </span>
                  )}

                  <div className="flex-1 pr-2">
                    <h4 className="text-xs font-semibold text-white">{item.label}</h4>
                    <p className="text-[10px] text-[#94a3b8] mt-0.5">{item.subtitle}</p>
                  </div>

                  <button
                    onClick={(e) => handleDelete(e, item.id, 'standaloneText')}
                    className="text-[#555e6e] hover:text-[#f2741d] p-1 rounded transition-colors cursor-pointer"
                    title="Delete item"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              ))}

              {/* Wrapped Group: Keymap Layer Text Items */}
              <div className="bg-[#131722] border border-[#1e2538] rounded-2xl p-2 space-y-1">
                <div className="px-2.5 py-1.5 flex items-center justify-between border-b border-[#1e2538]/60 mb-1">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-[#94a3b8] flex items-center gap-1.5">
                    <FolderCheck className="size-3 text-[#f2741d]" /> System Keymap Layers
                  </span>
                  <span className="text-[10px] font-mono text-[#555e6e]">
                    {textGroup.length} items wrapped
                  </span>
                </div>

                {textGroup.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => setSelectedId(item.id)}
                    className={`relative rounded-xl p-2 px-3 flex items-center justify-between border transition-all cursor-pointer ${
                      selectedId === item.id
                        ? 'border-[#00f0ff] bg-[#0b0d13] shadow-[0_0_12px_rgba(0,240,255,0.25)] ring-1 ring-[#00f0ff]'
                        : 'border-transparent hover:bg-[#19202f] hover:border-[#1e2538]'
                    }`}
                  >
                    {/* Top-Right Badge */}
                    {showBadges && item.badge && (
                      <span className="absolute -top-1 -right-1 bg-[#00f0ff]/20 text-[#00f0ff] border border-[#00f0ff]/50 text-[9px] font-mono font-bold px-1.5 rounded-full shadow-[0_0_6px_rgba(0,240,255,0.3)] z-10">
                        {item.badge}
                      </span>
                    )}

                    <div className="flex items-center gap-2.5 flex-1 pr-2">
                      <span className="size-1.5 rounded-full bg-[#f2741d]"></span>
                      <div>
                        <h4 className="text-xs font-semibold text-white leading-tight">{item.label}</h4>
                        <p className="text-[10px] text-[#94a3b8]">{item.subtitle}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Optional Right Pill Badge */}
                      {item.badge && (
                        <span className="text-[10px] font-mono text-[#00f0ff] bg-[#00f0ff]/10 px-1.5 py-0.5 rounded border border-[#00f0ff]/25">
                          {item.badge}
                        </span>
                      )}
                      <button
                        onClick={(e) => handleDelete(e, item.id, 'text')}
                        className="text-[#555e6e] hover:text-[#f2741d] p-1 rounded transition-colors cursor-pointer"
                        title="Delete item"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

      </div>
    </section>
  );
}

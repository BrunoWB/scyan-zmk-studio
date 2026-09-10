import { useState } from 'react';
import { Button, Chip } from '@heroui/react';
import { 
  Zap, 
  Terminal, 
  Trash2, 
  Download, 
  Settings, 
  RefreshCw, 
  Sliders, 
  Layers, 
  Save, 
  Code2,
  Unplug,
  Monitor,
  Shapes,
  Type
} from 'lucide-react';

interface ActionControlsProps {
  onTriggerAction?: (msg: string) => void;
}

export default function ActionControls({ onTriggerAction }: ActionControlsProps) {
  const [selectedFilter, setSelectedFilter] = useState('All');
  const [actionFeedback, setActionFeedback] = useState('');

  const handleAction = (msg: string) => {
    setActionFeedback(msg);
    if (onTriggerAction) onTriggerAction(msg);
    setTimeout(() => setActionFeedback(''), 2500);
  };

  const filterOptions = ['All', 'TS', 'PY', 'C++', 'ZMK-CONFIG'];

  return (
    <section className="space-y-6">
      {/* Header */}
      <div className="border-b border-[#1e2538] pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Zap className="size-5 text-[#00f0ff]" />
            <h2 className="text-xl font-bold text-white tracking-tight">Buttons &amp; Action Controls</h2>
          </div>
          <p className="text-sm text-[#94a3b8] mt-1">
            Tri-tone priority hierarchy (Cyan Primary, Purple Auxiliary, Orange Warning) using HeroUI v3 button primitives.
          </p>
        </div>

        {actionFeedback && (
          <Chip className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-mono">
            {actionFeedback}
          </Chip>
        )}
      </div>

      {/* Tri-Tone Action Hierarchy Big Blocks */}
      <div className="bg-[#131722] border border-[#1e2538] rounded-2xl p-5 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-white uppercase tracking-wider">
            Tri-Tone Action Hierarchy (High Traffic Triggers)
          </h3>
          <p className="text-xs text-[#94a3b8] mt-0.5">
            Distinct semantic roles: Cyan for hardware flashing, Purple for code compilation, Orange for memory wipe.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          {/* Primary Action (Cyan) */}
          <div className="bg-[#0b0d13] border border-[#00f0ff]/30 p-4 rounded-xl flex flex-col justify-between hover:border-[#00f0ff] transition-all group">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-mono text-[#00f0ff] uppercase tracking-wider">Primary / High Priority</span>
              <span className="size-2 rounded-full bg-[#00f0ff] shadow-[0_0_8px_#00f0ff]"></span>
            </div>
            <p className="text-xs text-[#94a3b8] mb-4">
              Commit active layout buffer directly into device flash storage.
            </p>
            <Button
              onClick={() => handleAction('Flashing firmware via Primary Action...')}
              className="w-full bg-[#00f0ff]/10 hover:bg-[#00f0ff] text-[#00f0ff] hover:text-[#0b0d13] border border-[#00f0ff]/30 hover:border-[#00f0ff] font-bold text-xs py-2.5 rounded-lg transition-all duration-200 hover:shadow-[0_0_20px_rgba(0,240,255,0.45)] flex items-center justify-center gap-2 cursor-pointer"
            >
              <Zap className="size-4 fill-current" />
              <span>Confirm &amp; Flash</span>
            </Button>
          </div>

          {/* Auxiliary Action (Purple) */}
          <div className="bg-[#0b0d13] border border-[#a953f6]/30 p-4 rounded-xl flex flex-col justify-between hover:border-[#a953f6] transition-all group">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-mono text-[#a953f6] uppercase tracking-wider">Secondary / Build</span>
              <span className="size-2 rounded-full bg-[#a953f6] shadow-[0_0_8px_#a953f6]"></span>
            </div>
            <p className="text-xs text-[#94a3b8] mb-4">
              Compile layout trees and generate hardware schema binary (.uf2).
            </p>
            <Button
              onClick={() => handleAction('Compiling layout tree...')}
              className="w-full bg-[#a953f6] hover:bg-[#bf84fd] text-white font-bold text-xs py-2.5 rounded-lg shadow-[0_0_16px_rgba(169,83,246,0.3)] transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Terminal className="size-4" />
              <span>Compile Layout</span>
            </Button>
          </div>

          {/* Cautionary Action (Orange) */}
          <div className="bg-[#0b0d13] border border-[#f2741d]/30 p-4 rounded-xl flex flex-col justify-between hover:border-[#f2741d] transition-all group">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-mono text-[#f2741d] uppercase tracking-wider">Warning / Caution</span>
              <span className="size-2 rounded-full bg-[#f2741d] shadow-[0_0_8px_#f2741d]"></span>
            </div>
            <p className="text-xs text-[#94a3b8] mb-4">
              Clear buffer memory and reset active state back to factory defaults.
            </p>
            <Button
              onClick={() => handleAction('Layout reset to default.')}
              className="w-full bg-[#f2741d] hover:bg-[#f59442] text-white font-bold text-xs py-2.5 rounded-lg shadow-[0_0_16px_rgba(242,116,29,0.3)] transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Trash2 className="size-4" />
              <span>Delete / Reset</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Button Variations Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Standard Buttons */}
        <div className="bg-[#131722] border border-[#1e2538] rounded-2xl p-4 space-y-3">
          <h4 className="text-xs font-semibold text-white uppercase tracking-wider">Standard Variations</h4>
          <div className="space-y-2">
            <Button
              onClick={() => handleAction('Primary button clicked')}
              className="w-full bg-[#00f0ff]/10 hover:bg-[#00f0ff] text-[#00f0ff] hover:text-[#0b0d13] border border-[#00f0ff]/30 hover:border-[#00f0ff] text-xs font-semibold py-2 rounded-lg transition-all duration-200 hover:shadow-[0_0_16px_rgba(0,240,255,0.4)] cursor-pointer"
            >
              Primary (Glows on Hover)
            </Button>
            <Button
              onClick={() => handleAction('Secondary Flat clicked')}
              className="w-full bg-[#a953f6]/15 hover:bg-[#a953f6]/25 text-[#a953f6] border border-[#a953f6]/30 text-xs font-semibold py-2 rounded-lg cursor-pointer"
            >
              Secondary Flat
            </Button>
            <Button
              onClick={() => handleAction('Warning Outline clicked')}
              className="w-full bg-transparent hover:bg-[#f2741d]/10 text-[#f2741d] border border-[#f2741d]/40 text-xs font-semibold py-2 rounded-lg cursor-pointer"
            >
              Warning Outline
            </Button>
            <Button
              isDisabled
              className="w-full bg-[#19202f] text-[#555e6e] border border-[#1e2538] text-xs font-semibold py-2 rounded-lg cursor-not-allowed"
            >
              Disabled Action
            </Button>
          </div>
        </div>

        {/* Special & Download Actions */}
        <div className="bg-[#131722] border border-[#1e2538] rounded-2xl p-4 space-y-3">
          <h4 className="text-xs font-semibold text-white uppercase tracking-wider">Firmware Actions</h4>
          <div className="space-y-2">
            <Button
              onClick={() => handleAction('Downloading uf2 binary...')}
              className="w-full bg-[#19202f] hover:bg-[#232c3f] border border-[#1e2538] hover:border-[#00f0ff]/40 text-white text-xs font-medium py-2 rounded-lg flex items-center justify-center gap-2 cursor-pointer"
            >
              <Download className="size-3.5 text-[#00f0ff]" />
              <span>Download .uf2</span>
            </Button>
            <Button
              onClick={() => handleAction('Schema exported to JSON')}
              className="w-full bg-[#19202f] hover:bg-[#232c3f] border border-[#1e2538] hover:border-[#a953f6]/40 text-white text-xs font-medium py-2 rounded-lg flex items-center justify-center gap-2 cursor-pointer"
            >
              <Code2 className="size-3.5 text-[#a953f6]" />
              <span>Export Schema</span>
            </Button>
            <Button
              onClick={() => handleAction('Re-syncing layout...')}
              className="w-full bg-[#19202f] hover:bg-[#232c3f] border border-[#1e2538] hover:border-[#f2741d]/40 text-white text-xs font-medium py-2 rounded-lg flex items-center justify-center gap-2 cursor-pointer"
            >
              <RefreshCw className="size-3.5 text-[#f2741d]" />
              <span>Sync Buffer</span>
            </Button>
          </div>
        </div>

        {/* Segmented Toggles & Filters */}
        <div className="bg-[#131722] border border-[#1e2538] rounded-2xl p-4 space-y-3">
          <h4 className="text-xs font-semibold text-white uppercase tracking-wider">Segmented Filter</h4>
          <p className="text-[11px] text-[#94a3b8]">Exclusive category switcher.</p>
          <div className="bg-[#0b0d13] p-1 rounded-xl border border-[#1e2538] flex flex-wrap gap-1">
            {filterOptions.map(opt => (
              <button
                key={opt}
                onClick={() => setSelectedFilter(opt)}
                className={`flex-1 min-w-[48px] py-1.5 px-2 text-[11px] font-mono font-medium rounded-lg text-center transition-all cursor-pointer ${
                  selectedFilter === opt
                    ? 'bg-[#00f0ff] text-[#0b0d13] font-bold shadow-[0_0_10px_rgba(0,240,255,0.3)]'
                    : 'text-[#94a3b8] hover:text-white hover:bg-[#19202f]'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
          <div className="text-[11px] font-mono text-[#94a3b8] pt-1">
            Selected: <span className="text-[#00f0ff]">{selectedFilter}</span>
          </div>
        </div>

        {/* Tool & Utility Toolbar */}
        <div className="bg-[#131722] border border-[#1e2538] rounded-2xl p-4 space-y-3">
          <h4 className="text-xs font-semibold text-white uppercase tracking-wider">Tool &amp; Icon Toolbar</h4>
          <p className="text-[11px] text-[#94a3b8]">Contextual quick triggers &amp; hardware controls.</p>
          <div className="flex flex-wrap items-center gap-1.5 bg-[#0b0d13] p-1.5 rounded-xl border border-[#1e2538]">
            <button
              onClick={() => handleAction('Disconnected from device')}
              className="p-2 text-[#94a3b8] hover:text-[#f2741d] hover:bg-[#19202f] rounded-lg transition-colors cursor-pointer"
              title="Disconnect Hardware"
            >
              <Unplug className="size-4" />
            </button>
            <button
              onClick={() => handleAction('Screen preview switched')}
              className="p-2 text-[#94a3b8] hover:text-[#00f0ff] hover:bg-[#19202f] rounded-lg transition-colors cursor-pointer"
              title="Screen Display"
            >
              <Monitor className="size-4" />
            </button>
            <button
              onClick={() => handleAction('Symbols library opened')}
              className="p-2 text-[#94a3b8] hover:text-[#a953f6] hover:bg-[#19202f] rounded-lg transition-colors cursor-pointer"
              title="Symbols"
            >
              <Shapes className="size-4" />
            </button>
            <button
              onClick={() => handleAction('Font editor opened')}
              className="p-2 text-[#94a3b8] hover:text-[#00f0ff] hover:bg-[#19202f] rounded-lg transition-colors cursor-pointer"
              title="Font"
            >
              <Type className="size-4" />
            </button>
            <button
              onClick={() => handleAction('Settings opened')}
              className="p-2 text-[#94a3b8] hover:text-white hover:bg-[#19202f] rounded-lg transition-colors cursor-pointer"
              title="Settings"
            >
              <Settings className="size-4" />
            </button>
            <button
              onClick={() => handleAction('Sliders opened')}
              className="p-2 text-[#94a3b8] hover:text-[#a953f6] hover:bg-[#19202f] rounded-lg transition-colors cursor-pointer"
              title="Parameters"
            >
              <Sliders className="size-4" />
            </button>
            <button
              onClick={() => handleAction('Layers opened')}
              className="p-2 text-[#94a3b8] hover:text-[#00f0ff] hover:bg-[#19202f] rounded-lg transition-colors cursor-pointer"
              title="Layers"
            >
              <Layers className="size-4" />
            </button>
            <button
              onClick={() => handleAction('State saved')}
              className="p-2 text-[#94a3b8] hover:text-[#f2741d] hover:bg-[#19202f] rounded-lg transition-colors cursor-pointer"
              title="Save"
            >
              <Save className="size-4" />
            </button>
            <button
              onClick={() => handleAction('Terminal launched')}
              className="p-2 text-[#94a3b8] hover:text-white hover:bg-[#19202f] rounded-lg transition-colors cursor-pointer"
              title="Terminal"
            >
              <Terminal className="size-4" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

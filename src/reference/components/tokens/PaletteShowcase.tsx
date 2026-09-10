import { useState } from 'react';
import { Card, Chip } from '@heroui/react';
import { Copy, Check, Palette, Layers } from 'lucide-react';
import { PALETTE_CATEGORIES } from '../../data/paletteData';

export default function PaletteShowcase() {
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const handleCopy = (text: string, name: string) => {
    navigator.clipboard.writeText(text);
    setCopiedToken(name);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  const categories = [
    { id: 'all', label: 'All Tokens' },
    ...PALETTE_CATEGORIES.map(c => ({ id: c.id, label: c.name.split(' (')[0] }))
  ];

  const displayedCategories = activeCategory === 'all'
    ? PALETTE_CATEGORIES
    : PALETTE_CATEGORIES.filter(c => c.id === activeCategory);

  return (
    <section className="space-y-6">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1e2538] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Palette className="size-5 text-[#00f0ff]" />
            <h2 className="text-xl font-bold text-white tracking-tight">Design Tokens &amp; Color Palette</h2>
          </div>
          <p className="text-sm text-[#94a3b8] mt-1">
            Tri-tone semantic hierarchy extracted directly from the system specification.
          </p>
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-1.5 flex-wrap bg-[#131722] p-1.5 rounded-xl border border-[#1e2538]">
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`px-3 py-1 text-xs font-medium rounded-lg transition-all cursor-pointer ${
                activeCategory === cat.id
                  ? 'bg-[#00f0ff] text-[#0b0d13] font-semibold shadow-[0_0_12px_rgba(0,240,255,0.3)]'
                  : 'text-[#94a3b8] hover:text-white hover:bg-[#19202f]'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Surface Elevation Foundation Guide */}
      <div className="bg-[#131722] border border-[#1e2538] rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <Layers className="size-4 text-[#a953f6]" />
          <h3 className="text-sm font-semibold text-white uppercase tracking-wider">Surface Elevation Architecture</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-[#0b0d13] border border-[#1e2538] p-4 rounded-xl relative overflow-hidden">
            <div className="text-xs font-mono text-[#00f0ff] mb-1">Level 0 - Canvas</div>
            <div className="text-sm font-semibold text-white">App Foundation</div>
            <div className="text-xs text-[#94a3b8] mt-1">#0B0D13 • Root background</div>
            <div className="mt-3 text-[10px] font-mono text-[#555e6e]">--surface-canvas-0</div>
          </div>

          <div className="bg-[#131722] border border-[#2d3748] p-4 rounded-xl shadow-md">
            <div className="text-xs font-mono text-[#a953f6] mb-1">Level 1 - Panel</div>
            <div className="text-sm font-semibold text-white">Structural Surfaces</div>
            <div className="text-xs text-[#94a3b8] mt-1">#131722 • Sidebars &amp; headers</div>
            <div className="mt-3 text-[10px] font-mono text-[#555e6e]">--surface-panel-1</div>
          </div>

          <div className="bg-[#19202f] border border-[#2d3748] p-4 rounded-xl shadow-lg">
            <div className="text-xs font-mono text-[#f2741d] mb-1">Level 2 - Element</div>
            <div className="text-sm font-semibold text-white">Interactive Cards</div>
            <div className="text-xs text-[#94a3b8] mt-1">#19202F • Card surfaces</div>
            <div className="mt-3 text-[10px] font-mono text-[#555e6e]">--surface-element-2</div>
          </div>

          <div className="bg-[#232c3f] border border-[#00f0ff]/40 p-4 rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.5)]">
            <div className="text-xs font-mono text-[#38f2fd] mb-1">Level 3 - Popover</div>
            <div className="text-sm font-semibold text-white">Floating Overlays</div>
            <div className="text-xs text-[#94a3b8] mt-1">#232C3F • Modals &amp; menus</div>
            <div className="mt-3 text-[10px] font-mono text-[#555e6e]">--surface-popover-3</div>
          </div>
        </div>
      </div>

      {/* Swatch Category Sections */}
      <div className="space-y-6">
        {displayedCategories.map(category => (
          <div key={category.id} className="space-y-3">
            <div>
              <h3 className="text-base font-semibold text-white">{category.name}</h3>
              <p className="text-xs text-[#94a3b8]">{category.description}</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
              {category.tokens.map(token => {
                const isCopied = copiedToken === token.name;
                const isLight = token.hex === '#FFFFFF' || token.hex === '#F1F5F9' || token.hex === '#00F0FF' || token.hex === '#38F2FD';

                return (
                  <Card
                    key={token.variable}
                    className="bg-[#131722] hover:bg-[#19202f] border border-[#1e2538] hover:border-[#2d3748] rounded-xl overflow-hidden transition-all duration-200 group"
                  >
                    {/* Swatch Color Bar */}
                    <div
                      className="h-16 w-full relative flex items-end justify-between p-2.5 transition-transform group-hover:scale-[1.01]"
                      style={{ backgroundColor: token.hex }}
                    >
                      <span
                        className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded backdrop-blur-sm ${
                          isLight
                            ? 'bg-black/60 text-white'
                            : 'bg-white/20 text-white border border-white/20'
                        }`}
                      >
                        {token.hex}
                      </span>

                      <button
                        onClick={() => handleCopy(token.hex, token.name)}
                        className={`p-1.5 rounded-md transition-all cursor-pointer ${
                          isLight
                            ? 'bg-black/70 hover:bg-black text-white'
                            : 'bg-white/20 hover:bg-white/30 text-white'
                        }`}
                        title="Copy hex code"
                      >
                        {isCopied ? <Check className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5" />}
                      </button>
                    </div>

                    {/* Swatch Details */}
                    <div className="p-3.5 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-xs text-white tracking-tight">{token.name}</span>
                        {isCopied && (
                          <Chip className="bg-emerald-500/20 text-emerald-300 text-[10px] font-medium h-4 px-1.5">
                            Copied!
                          </Chip>
                        )}
                      </div>

                      <div className="flex items-center justify-between text-[11px] font-mono text-[#94a3b8] bg-[#0b0d13] p-1.5 rounded-lg border border-[#1e2538]">
                        <span className="text-[#00f0ff] truncate max-w-[170px]">{token.variable}</span>
                        <button
                          onClick={() => handleCopy(`var(${token.variable})`, token.name)}
                          className="text-[#94a3b8] hover:text-white transition-colors ml-1 cursor-pointer"
                          title="Copy CSS var"
                        >
                          <Copy className="size-3" />
                        </button>
                      </div>

                      <p className="text-[11px] text-[#94a3b8] line-clamp-2 leading-relaxed">
                        {token.desc}
                      </p>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

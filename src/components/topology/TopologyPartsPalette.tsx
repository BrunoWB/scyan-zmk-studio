import React, { useState, useMemo } from 'react';
import { getShieldParts, type ShieldPartItem } from '../../data/shieldsData';
import { ShieldKeyboardGeometry } from '../ShieldKeyboardGeometry';
import { BwpxGrid } from '../../bwpx/core/BwpxGrid';
import type { SpriteSlice, FontGlyph, FontCharMapping, LayoutBlock } from '../../types/zmk';
import { Search, Plus, GripVertical, Keyboard, Monitor } from 'lucide-react';

export interface TopologyPartsPaletteProps {
  onQuickAddPart: (part: ShieldPartItem) => void;
  symbolsGrid: BwpxGrid;
  symbolSlices: SpriteSlice[];
  fontGrid: BwpxGrid;
  fontGlyphs?: FontGlyph[];
  fontMappings?: FontCharMapping[];
  activeLeftBlocks: LayoutBlock[];
  activeRightBlocks: LayoutBlock[];
  activeDongleBlocks: LayoutBlock[];
}

export const TopologyPartsPalette: React.FC<TopologyPartsPaletteProps> = ({
  onQuickAddPart,
  symbolsGrid,
  symbolSlices,
  fontGrid,
  fontGlyphs = [],
  fontMappings = [],
  activeLeftBlocks,
  activeRightBlocks,
  activeDongleBlocks,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'split-half' | 'single-piece'>('all');

  const allParts = useMemo(() => getShieldParts(), []);

  const filteredParts = useMemo(() => {
    return allParts.filter((part) => {
      if (selectedCategory !== 'all' && part.category !== selectedCategory) {
        return false;
      }
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesName = part.name.toLowerCase().includes(query);
        const matchesShield = part.shield.name.toLowerCase().includes(query);
        const matchesCategory = part.category.toLowerCase().includes(query);
        return matchesName || matchesShield || matchesCategory;
      }
      return true;
    });
  }, [allParts, selectedCategory, searchQuery]);

  const handleDragStart = (e: React.DragEvent, part: ShieldPartItem) => {
    e.dataTransfer.setData('application/json', JSON.stringify({ partId: part.id }));
    e.dataTransfer.effectAllowed = 'copy';
  };

  const getSideBadge = (side: ShieldPartItem['side']) => {
    switch (side) {
      case 'left':
        return (
          <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase tracking-wider bg-[#00f0ff]/15 text-[#00f0ff] border border-[#00f0ff]/30">
            Left
          </span>
        );
      case 'right':
        return (
          <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase tracking-wider bg-[#a855f7]/15 text-[#c084fc] border border-[#a855f7]/30">
            Right
          </span>
        );
      case 'dongle':
        return (
          <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase tracking-wider bg-[#a855f7]/15 text-[#c084fc] border border-[#a855f7]/30">
            Dongle
          </span>
        );
      case 'single':
      default:
        return (
          <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase tracking-wider bg-[#3b82f6]/15 text-[#60a5fa] border border-[#3b82f6]/30">
            Single
          </span>
        );
    }
  };

  return (
    <aside className="w-80 md:w-88 flex flex-col h-full bg-[#10141e] border-l border-[#1e2538] shrink-0">
      {/* Sidebar Header */}
      <div className="p-4 border-b border-[#1e2538] space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#94a3b8]">
            Shield Parts Palette
          </h3>
          <span className="text-[10px] font-mono text-[#00f0ff] bg-[#00f0ff]/10 px-2 py-0.5 rounded-full border border-[#00f0ff]/20">
            {filteredParts.length} parts
          </span>
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-2.5 text-[#64748b]" />
          <input
            type="text"
            placeholder="Filter shield parts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#0b0d13] border border-[#1e2538] rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-[#64748b] focus:outline-none focus:border-[#00f0ff]/50"
          />
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 pt-1">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`text-[11px] font-mono px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
              selectedCategory === 'all'
                ? 'bg-[#00f0ff]/20 text-[#00f0ff] font-semibold border border-[#00f0ff]/40'
                : 'text-[#94a3b8] hover:text-white bg-[#0b0d13] border border-[#1e2538]'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setSelectedCategory('split-half')}
            className={`text-[11px] font-mono px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
              selectedCategory === 'split-half'
                ? 'bg-[#00f0ff]/20 text-[#00f0ff] font-semibold border border-[#00f0ff]/40'
                : 'text-[#94a3b8] hover:text-white bg-[#0b0d13] border border-[#1e2538]'
            }`}
          >
            Split Halves
          </button>
          <button
            onClick={() => setSelectedCategory('single-piece')}
            className={`text-[11px] font-mono px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
              selectedCategory === 'single-piece'
                ? 'bg-[#00f0ff]/20 text-[#00f0ff] font-semibold border border-[#00f0ff]/40'
                : 'text-[#94a3b8] hover:text-white bg-[#0b0d13] border border-[#1e2538]'
            }`}
          >
            Single / Dongle
          </button>
        </div>
      </div>

      {/* Parts List with Visual Previews */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 no-scrollbar">
        {filteredParts.map((part) => {
          const onlySide =
            part.side === 'left' || part.side === 'right' ? part.side : undefined;

          return (
            <div
              key={part.id}
              draggable
              onDragStart={(e) => handleDragStart(e, part)}
              className="flex flex-col p-2.5 rounded-xl bg-[#131722] border border-[#1e2538] hover:border-[#00f0ff]/50 hover:bg-[#151a27] transition-all cursor-grab active:cursor-grabbing group shadow-sm"
            >
              {/* Card Header: Title, Side Badge, and Quick Add */}
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <GripVertical
                    size={14}
                    className="text-[#64748b] group-hover:text-[#00f0ff] shrink-0"
                  />
                  <span className="text-xs font-bold text-white truncate">
                    {part.name}
                  </span>
                  {getSideBadge(part.side)}
                </div>

                <button
                  type="button"
                  onClick={() => onQuickAddPart(part)}
                  className="p-1 rounded-lg bg-[#0b0d13] text-[#94a3b8] hover:text-[#00f0ff] hover:bg-[#00f0ff]/10 border border-[#1e2538] hover:border-[#00f0ff]/30 transition-all cursor-pointer shrink-0"
                  title="Add part to grid"
                >
                  <Plus size={13} />
                </button>
              </div>

              {/* Small Visual Shield Preview */}
              <div className="bg-[#080a0f] border border-[#1e2538]/80 rounded-lg p-2 flex items-center justify-center min-h-[74px] overflow-hidden pointer-events-none">
                <ShieldKeyboardGeometry
                  shield={part.shield}
                  onlySide={onlySide}
                  symbolsGrid={symbolsGrid}
                  symbolSlices={symbolSlices}
                  fontGrid={fontGrid}
                  fontGlyphs={fontGlyphs}
                  fontMappings={fontMappings}
                  activeLeftBlocks={activeLeftBlocks}
                  activeRightBlocks={activeRightBlocks}
                  activeDongleBlocks={activeDongleBlocks}
                  compact={true}
                />
              </div>

              {/* Card Footer Info */}
              <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-[#1e2538]/60 text-[10px] text-[#64748b] font-mono">
                <span className="flex items-center gap-1">
                  <Keyboard size={10} />
                  {part.keyCount > 0 ? `${part.keyCount} keys` : 'Dongle'}
                </span>
                <span className="flex items-center gap-1">
                  <Monitor size={10} />
                  {part.shield.displayConfig.nativeResolution.width}×
                  {part.shield.displayConfig.nativeResolution.height}
                </span>
              </div>
            </div>
          );
        })}

        {filteredParts.length === 0 && (
          <div className="text-center py-8 text-xs text-[#64748b]">
            No shield parts found matching "{searchQuery}".
          </div>
        )}
      </div>

      {/* Footer hint */}
      <div className="p-3 border-t border-[#1e2538] bg-[#0b0d13]/50 text-[10px] text-[#64748b] text-center font-mono">
        💡 Drag any part onto the grid or click (+) to place
      </div>
    </aside>
  );
};

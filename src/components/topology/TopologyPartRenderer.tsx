import React from 'react';
import type { ShieldPartItem } from '../../data/shieldsData';
import { ShieldKeyboardGeometry, type DisplayConfigOverride } from '../ShieldKeyboardGeometry';
import { BwpxGrid } from '../../bwpx/core/BwpxGrid';
import type { SpriteSlice, FontGlyph, FontCharMapping, LayoutBlock } from '../../types/zmk';
import type { WidgetInstanceMap } from '../../types/widget';
import { GripVertical, X, Crown, Monitor } from 'lucide-react';

export interface TopologyPartRendererProps {
  part: ShieldPartItem;
  x: number;
  y: number;
  symbolsGrid: BwpxGrid;
  symbolSlices: SpriteSlice[];
  fontGrid: BwpxGrid;
  fontGlyphs?: FontGlyph[];
  fontMappings?: FontCharMapping[];
  activeLeftBlocks: LayoutBlock[];
  activeRightBlocks: LayoutBlock[];
  activeDongleBlocks: LayoutBlock[];
  batteryLevel?: number;
  typingWpm?: number;
  outputMode?: 'usb' | 'ble';
  currentLayer?: number;
  customText?: string;
  instances?: WidgetInstanceMap;
  scale?: number;
  displayConfigOverride?: DisplayConfigOverride;
  isMasterShield?: boolean;
  onSetMasterShield?: () => void;
  onDisplayDragStart?: (e: React.DragEvent) => void;
  onDisplayDrop?: (e: React.DragEvent) => void;
  isDisplayDropTarget?: boolean;
  onDelete?: () => void;
  onDragStart?: (e: React.DragEvent) => void;
  onKeystroke?: () => void;
}

export const TopologyPartRenderer: React.FC<TopologyPartRendererProps> = ({
  part,
  x,
  y,
  symbolsGrid,
  symbolSlices,
  fontGrid,
  fontGlyphs,
  fontMappings,
  activeLeftBlocks,
  activeRightBlocks,
  activeDongleBlocks,
  batteryLevel = 88,
  typingWpm = 48,
  outputMode = 'ble',
  currentLayer = 0,
  customText = 'SCYAN',
  instances,
  scale = 0.75,
  displayConfigOverride,
  isMasterShield = false,
  onSetMasterShield,
  onDisplayDragStart,
  onDisplayDrop,
  isDisplayDropTarget = false,
  onDelete,
  onDragStart,
  onKeystroke,
}) => {
  const onlySide =
    part.side === 'left' || part.side === 'right' ? part.side : undefined;

  return (
    <div
      draggable
      onDragStart={onDragStart}
      className="relative group cursor-grab active:cursor-grabbing select-none transition-all duration-200"
    >
      {/* On Hover: Floating Grip Bar & Controls */}
      <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-30 opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-auto flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#131722]/95 border border-[#00f0ff]/40 shadow-[0_0_16px_rgba(0,240,255,0.3)] backdrop-blur-md whitespace-nowrap">
        <GripVertical size={13} className="text-[#00f0ff] animate-pulse" />
        <span className="text-[10px] font-mono font-bold text-white tracking-wide">
          {part.name}
        </span>
        <span className="text-[9px] font-mono text-[#64748b]">
          ({x},{y})
        </span>

        {/* Master Shield Status & Toggle */}
        {isMasterShield ? (
          <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase tracking-wider bg-[#00f0ff]/20 text-[#00f0ff] border border-[#00f0ff]/40 shadow-[0_0_8px_rgba(0,240,255,0.3)] flex items-center gap-1">
            <Crown size={10} />
            <span>Master Shield</span>
          </span>
        ) : onSetMasterShield ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSetMasterShield();
            }}
            className="px-1.5 py-0.5 rounded text-[9px] font-mono text-[#94a3b8] hover:text-[#00f0ff] hover:bg-[#00f0ff]/15 border border-[#1e2538] hover:border-[#00f0ff]/30 transition-all cursor-pointer flex items-center gap-1"
            title="Make this shield the central Master controller (its display will become the Master Display)"
          >
            <Crown size={10} />
            <span>Set Master</span>
          </button>
        ) : null}

        {/* Display Status Badge */}
        {displayConfigOverride && (
          displayConfigOverride.displayId ? (
            <span className="px-1.5 py-0.5 rounded text-[9px] font-mono text-[#c084fc] bg-[#a855f7]/15 border border-[#a855f7]/30 flex items-center gap-1">
              <Monitor size={10} />
              <span>{displayConfigOverride.displayName || displayConfigOverride.displayId}</span>
            </span>
          ) : (
            <span className="px-1.5 py-0.5 rounded text-[9px] font-mono text-[#64748b] bg-white/5 border border-white/10">
              No Display
            </span>
          )
        )}

        {onDelete && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="text-[#64748b] hover:text-red-400 hover:bg-red-500/20 p-0.5 rounded-full transition-colors ml-1 cursor-pointer"
            title="Remove shield part"
          >
            <X size={12} />
          </button>
        )}
      </div>

      {/* The Shield Itself is the Drag Container */}
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
        batteryLevel={batteryLevel}
        typingWpm={typingWpm}
        outputMode={outputMode}
        currentLayer={currentLayer}
        customText={customText}
        instances={instances}
        compact={false}
        scale={scale}
        displayConfigOverride={displayConfigOverride}
        onDisplayDragStart={onDisplayDragStart}
        onDisplayDrop={onDisplayDrop}
        isDisplayDropTarget={isDisplayDropTarget}
        onKeystroke={onKeystroke}
      />
    </div>
  );
};

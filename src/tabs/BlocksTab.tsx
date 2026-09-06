import React, { useState } from 'react';
import type { LayoutBlock } from '../types/zmk';
import {
  MoveUp,
  MoveDown,
  Eye,
  EyeOff,
  RotateCcw,
  LayoutGrid,
} from 'lucide-react';

export interface BlocksTabProps {
  layoutBlocks: LayoutBlock[];
  onLayoutBlocksChange: (blocks: LayoutBlock[]) => void;
  onResetDefaults: () => void;
}

export const BlocksTab: React.FC<BlocksTabProps> = ({
  layoutBlocks,
  onLayoutBlocksChange,
  onResetDefaults,
}) => {
  const [hoveredBlockId, setHoveredBlockId] = useState<string | null>(null);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(
    layoutBlocks[0]?.id || null
  );

  const moveBlock = (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= layoutBlocks.length) return;

    const next = [...layoutBlocks];
    const temp = next[index];
    next[index] = next[targetIndex];
    next[targetIndex] = temp;

    onLayoutBlocksChange(next);
  };

  const toggleBlock = (id: string) => {
    const next = layoutBlocks.map(b => (b.id === id ? { ...b, enabled: !b.enabled } : b));
    onLayoutBlocksChange(next);
  };

  const updateBlock = (id: string, updated: Partial<LayoutBlock>) => {
    const next = layoutBlocks.map(b => (b.id === id ? { ...b, ...updated } : b));
    onLayoutBlocksChange(next);
  };

  // Block colors for visual differentiation
  const blockColors: Record<string, string> = {
    'block-status': '#38bdf8',
    'block-layer-label': '#a78bfa',
    'block-art': '#34d399',
    'block-branding': '#f472b6',
    'block-wpm': '#fbbf24',
    'block-split': '#2dd4bf',
  };

  return (
    <div className="blocks-tab-container">
      {/* Left Screen Preview with Block Slices */}
      <div className="blocks-screen-column">
        <div className="screen-frame-card">
          <div className="screen-frame-header">
            <span className="text-xs font-mono text-muted">32×128 SCREEN BOUNDS</span>
          </div>

          <div className="screen-wireframe">
            {layoutBlocks.map(block => {
              const isHovered = hoveredBlockId === block.id;
              const isSelected = selectedBlockId === block.id;
              const color = blockColors[block.id] || '#00d2ff';

              if (!block.enabled) return null;

              return (
                <div
                  key={block.id}
                  className={`wireframe-block ${isSelected ? 'selected' : ''} ${isHovered ? 'hovered' : ''}`}
                  style={{
                    top: `${(block.y / 128) * 100}%`,
                    height: `${(block.height / 128) * 100}%`,
                    borderColor: color,
                    backgroundColor: `${color}18`,
                  }}
                  onClick={() => setSelectedBlockId(block.id)}
                  onMouseEnter={() => setHoveredBlockId(block.id)}
                  onMouseLeave={() => setHoveredBlockId(null)}
                >
                  <span className="wireframe-block-label" style={{ color }}>
                    {block.name.split(' ')[0]} ({block.y}px)
                  </span>
                </div>
              );
            })}
          </div>

          <button className="btn-reset-blocks" onClick={onResetDefaults}>
            <RotateCcw size={13} />
            <span>Reset Default Layout</span>
          </button>
        </div>
      </div>

      {/* Right Blocks Inspector & Reordering List */}
      <div className="blocks-inspector-column">
        <div className="blocks-header">
          <div className="flex items-center gap-2">
            <LayoutGrid size={18} className="text-accent" />
            <h3 className="text-base font-semibold">Vertical Screen Blocks ({layoutBlocks.length})</h3>
          </div>
          <p className="text-xs text-muted mt-1">
            Drag, toggle, and tune the Y-offset positions of widgets on the 32x128 vertical OLED canvas.
          </p>
        </div>

        <div className="blocks-list">
          {layoutBlocks.map((block, index) => {
            const isHovered = hoveredBlockId === block.id;
            const isSelected = selectedBlockId === block.id;
            const color = blockColors[block.id] || '#00d2ff';

            return (
              <div
                key={block.id}
                className={`block-card ${isSelected ? 'selected' : ''} ${isHovered ? 'hovered' : ''}`}
                onMouseEnter={() => setHoveredBlockId(block.id)}
                onMouseLeave={() => setHoveredBlockId(null)}
                onClick={() => setSelectedBlockId(block.id)}
              >
                <div className="block-card-header">
                  <div className="flex items-center gap-2">
                    <span className="block-pip" style={{ backgroundColor: color }} />
                    <span className={`block-name ${!block.enabled ? 'line-through text-muted' : ''}`}>
                      {block.name}
                    </span>
                  </div>

                  <div className="block-actions" onClick={e => e.stopPropagation()}>
                    <button
                      className="btn-block-action"
                      disabled={index === 0}
                      onClick={() => moveBlock(index, -1)}
                      title="Move Block Up"
                    >
                      <MoveUp size={13} />
                    </button>
                    <button
                      className="btn-block-action"
                      disabled={index === layoutBlocks.length - 1}
                      onClick={() => moveBlock(index, 1)}
                      title="Move Block Down"
                    >
                      <MoveDown size={13} />
                    </button>
                    <button
                      className="btn-block-action"
                      onClick={() => toggleBlock(block.id)}
                      title={block.enabled ? 'Disable block' : 'Enable block'}
                    >
                      {block.enabled ? <Eye size={13} className="text-accent" /> : <EyeOff size={13} />}
                    </button>
                  </div>
                </div>

                <div className="block-card-desc">{block.description}</div>

                {/* Offset & Height sliders */}
                <div className="block-controls-row" onClick={e => e.stopPropagation()}>
                  <div className="block-control">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted">Y Position</span>
                      <span className="font-mono text-accent">{block.y} px</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="120"
                      value={block.y}
                      onChange={e => updateBlock(block.id, { y: parseInt(e.target.value, 10) })}
                      className="slider-range"
                      disabled={!block.enabled}
                    />
                  </div>

                  <div className="block-control">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted">Height</span>
                      <span className="font-mono text-accent">{block.height} px</span>
                    </div>
                    <input
                      type="range"
                      min="4"
                      max="40"
                      value={block.height}
                      onChange={e => updateBlock(block.id, { height: parseInt(e.target.value, 10) })}
                      className="slider-range"
                      disabled={!block.enabled}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};


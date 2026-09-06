import React, { useState } from 'react';
import { BwpxGrid } from '../bwpx/core/BwpxGrid';
import { BwpxEditor } from '../bwpx/components/BwpxEditor';
import type { SpriteSlice } from '../types/zmk';
import {
  Plus,
  Trash2,
  BoxSelect,
  Sparkles,
} from 'lucide-react';

export interface SymbolsAtlasTabProps {
  symbolsGrid: BwpxGrid;
  onSymbolsGridChange: (grid: BwpxGrid) => void;
  slices: SpriteSlice[];
  onSlicesChange: (slices: SpriteSlice[]) => void;
}

export const SymbolsAtlasTab: React.FC<SymbolsAtlasTabProps> = ({
  symbolsGrid,
  onSymbolsGridChange,
  slices,
  onSlicesChange,
}) => {
  const [selectedSliceId, setSelectedSliceId] = useState<string>(slices[0]?.id || '');
  const [newSliceName, setNewSliceName] = useState<string>('');
  const [pendingNewSlice, setPendingNewSlice] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);

  const selectedSlice = slices.find(s => s.id === selectedSliceId);

  const handleUpdateSelectedSlice = (updated: Partial<SpriteSlice>) => {
    if (!selectedSlice) return;
    const next = slices.map(s => (s.id === selectedSlice.id ? { ...s, ...updated } : s));
    onSlicesChange(next);
  };

  const handleAddSlice = () => {
    const coords = pendingNewSlice || { x: 0, y: 0, width: 16, height: 16 };
    const name = newSliceName.trim() || `Slice ${slices.length + 1}`;
    const cleanId = `SYMBOL_${name.toUpperCase().replace(/[^A-Z0-9]/g, '_')}_${Date.now().toString().slice(-4)}`;
    const newSlice: SpriteSlice = {
      id: cleanId,
      name,
      x: coords.x,
      y: coords.y,
      width: coords.width,
      height: coords.height,
      color: '#00d2ff',
    };
    onSlicesChange([...slices, newSlice]);
    setSelectedSliceId(cleanId);
    setNewSliceName('');
    setPendingNewSlice(null);
  };

  const handleDeleteSlice = (id: string) => {
    if (slices.length <= 1) return;
    const next = slices.filter(s => s.id !== id);
    onSlicesChange(next);
    if (selectedSliceId === id) {
      setSelectedSliceId(next[0]?.id || '');
    }
  };

  const handleSliceMove = (sliceId: string, newX: number, newY: number) => {
    const next = slices.map(s => (s.id === sliceId ? { ...s, x: newX, y: newY } : s));
    onSlicesChange(next);
  };

  // Helper to render slice thumbnail onto small canvas
  const renderSliceThumb = (slice: SpriteSlice) => {
    const scale = 2;
    return (
      <div
        className="slice-thumbnail-box"
        style={{
          width: Math.max(24, slice.width * scale + 4),
          height: Math.max(24, slice.height * scale + 4),
        }}
      >
        <canvas
          width={slice.width}
          height={slice.height}
          style={{
            width: slice.width * scale,
            height: slice.height * scale,
            imageRendering: 'pixelated',
          }}
          ref={canvas => {
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;
            ctx.fillStyle = '#101216';
            ctx.fillRect(0, 0, slice.width, slice.height);
            ctx.fillStyle = '#00d2ff';
            for (let y = 0; y < slice.height; y++) {
              for (let x = 0; x < slice.width; x++) {
                if (symbolsGrid.get(slice.x + x, slice.y + y)) {
                  ctx.fillRect(x, y, 1, 1);
                }
              }
            }
          }}
        />
      </div>
    );
  };

  return (
    <div className="atlas-tab-container">
      {/* Center/Left: Bwpx Monochrome Canvas Editor */}
      <div className="atlas-editor-pane">
        <BwpxEditor
          initialWidth={128}
          initialHeight={34}
          initialGrid={symbolsGrid}
          onGridChange={onSymbolsGridChange}
          title="SYMBOLS ATLAS (INFINITE 1BPP)"
          showPresets={false}
          slices={slices}
          selectedSliceId={selectedSliceId}
          onSelectSlice={id => {
            setSelectedSliceId(id);
            setPendingNewSlice(null);
          }}
          onNewSelection={rect => {
            setSelectedSliceId('');
            setPendingNewSlice(rect);
          }}
          onSliceMove={handleSliceMove}
        />
      </div>

      {/* Right Pane: Slice Inspector */}
      <div className="atlas-inspector-pane">
        <div className="inspector-header">
          <div className="flex items-center gap-2">
            <BoxSelect size={18} className="text-accent" />
            <h3 className="inspector-title">Sprite Slices ({slices.length})</h3>
          </div>
        </div>

        {/* New Slice Prompt from Selection */}
        {pendingNewSlice && !selectedSliceId && (
          <div className="selected-slice-card" style={{ borderColor: '#c084fc', boxShadow: '0 0 14px rgba(192, 132, 252, 0.25)' }}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Sparkles size={15} className="text-[#c084fc] animate-pulse" />
                <span className="font-bold text-xs text-[#c084fc]">New Selection Detected</span>
              </div>
              <span className="text-[11px] font-mono text-purple-300">
                {pendingNewSlice.width}×{pendingNewSlice.height}
              </span>
            </div>

            <div className="text-xs text-slate-300 mb-3 font-mono">
              Coordinates: ({pendingNewSlice.x}, {pendingNewSlice.y})
            </div>

            <div className="flex flex-col gap-2">
              <input
                type="text"
                placeholder="Enter slice name..."
                value={newSliceName}
                onChange={e => setNewSliceName(e.target.value)}
                className="input-text-dark text-xs"
                onKeyDown={e => e.key === 'Enter' && handleAddSlice()}
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  className="btn-add-slice"
                  style={{
                    flex: 1,
                    justifyContent: 'center',
                    padding: '7px 0',
                    background: '#9333ea',
                    borderColor: '#a855f7',
                    boxShadow: '0 0 10px rgba(168, 85, 247, 0.35)',
                  }}
                  onClick={handleAddSlice}
                >
                  <Plus size={14} />
                  <span>Create Slice</span>
                </button>
                <button
                  className="btn-toggle-subtle text-xs px-3"
                  onClick={() => setPendingNewSlice(null)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Selected Slice Details Card */}
        {selectedSlice && (
          <div className="selected-slice-card">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span
                  className="slice-color-pip"
                  style={{ backgroundColor: selectedSlice.color || '#38bdf8' }}
                />
                <span className="font-semibold text-sm">{selectedSlice.name}</span>
              </div>
              {renderSliceThumb(selectedSlice)}
            </div>

            <div className="slice-inputs-grid">
              <div className="slice-field">
                <label>Enum ID</label>
                <input
                  type="text"
                  value={selectedSlice.id}
                  onChange={e => handleUpdateSelectedSlice({ id: e.target.value })}
                  className="font-mono text-xs"
                />
              </div>

              <div className="slice-field">
                <label>Display Name</label>
                <input
                  type="text"
                  value={selectedSlice.name}
                  onChange={e => handleUpdateSelectedSlice({ name: e.target.value })}
                />
              </div>

              <div className="slice-coords-row">
                <div className="slice-coord">
                  <label>X</label>
                  <input
                    type="number"
                    value={selectedSlice.x}
                    onChange={e => handleUpdateSelectedSlice({ x: parseInt(e.target.value, 10) || 0 })}
                  />
                </div>
                <div className="slice-coord">
                  <label>Y</label>
                  <input
                    type="number"
                    value={selectedSlice.y}
                    onChange={e => handleUpdateSelectedSlice({ y: parseInt(e.target.value, 10) || 0 })}
                  />
                </div>
                <div className="slice-coord">
                  <label>Width</label>
                  <input
                    type="number"
                    min={1}
                    value={selectedSlice.width}
                    onChange={e => handleUpdateSelectedSlice({ width: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                  />
                </div>
                <div className="slice-coord">
                  <label>Height</label>
                  <input
                    type="number"
                    min={1}
                    value={selectedSlice.height}
                    onChange={e => handleUpdateSelectedSlice({ height: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Add Slice Action */}
        <div className="add-slice-bar">
          <input
            type="text"
            placeholder="New slice name..."
            value={newSliceName}
            onChange={e => setNewSliceName(e.target.value)}
            className="input-text-dark text-xs"
            onKeyDown={e => e.key === 'Enter' && handleAddSlice()}
          />
          <button className="btn-add-slice" onClick={handleAddSlice}>
            <Plus size={14} />
            <span>Add Slice</span>
          </button>
        </div>

        {/* Slices List */}
        <div className="slices-list-scroll">
          {slices.map(slice => {
            const isSelected = slice.id === selectedSlice?.id;
            return (
              <div
                key={slice.id}
                className={`slice-list-item ${isSelected ? 'active' : ''}`}
                onClick={() => {
                  setSelectedSliceId(slice.id);
                  setPendingNewSlice(null);
                }}
              >
                <div className="slice-item-left">
                  <span
                    className="slice-color-pip"
                    style={{ backgroundColor: slice.color || '#38bdf8' }}
                  />
                  <div className="slice-item-info">
                    <span className="slice-item-name">{slice.name}</span>
                    <span className="slice-item-bounds font-mono">
                      {slice.x},{slice.y} · {slice.width}×{slice.height}
                    </span>
                  </div>
                </div>

                <div className="slice-item-right">
                  {renderSliceThumb(slice)}
                  <button
                    className="btn-slice-delete"
                    onClick={e => {
                      e.stopPropagation();
                      handleDeleteSlice(slice.id);
                    }}
                    title="Delete Slice"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

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
  const [selectedSliceIds, setSelectedSliceIds] = useState<Set<string>>(new Set(slices[0] ? [slices[0].id] : []));
  const selectedSliceId = Array.from(selectedSliceIds)[0] || '';
  const [newSliceName, setNewSliceName] = useState<string>('');
  const [pendingNewSlice, setPendingNewSlice] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);

  const [splitGroup, setSplitGroup] = useState<boolean>(false);
  const [splitCount, setSplitCount] = useState<number | ''>(2);
  const [splitDirection, setSplitDirection] = useState<'Horizontal' | 'Vertical'>('Horizontal');

  const selectedSlice = slices.find(s => s.id === selectedSliceId);

  React.useEffect(() => {
    let changed = false;
    const groupColors: Record<string, string> = {};
    slices.forEach(s => {
      if (s.groupOrder === 1) {
        groupColors[s.groupId || s.id] = s.color || '#38bdf8';
      }
    });

    const migrated = slices.map(s => {
      let mod = false;
      let next = { ...s };
      if (!s.groupId || !s.groupOrder) {
         mod = true;
         next.groupId = s.groupId || s.id;
         next.groupOrder = s.groupOrder || 1;
      }
      const headColor = groupColors[next.groupId];
      if (headColor && next.color !== headColor) {
         mod = true;
         next.color = headColor;
      }
      if (mod) {
         changed = true;
         return next;
      }
      return s;
    });
    if (changed) {
      onSlicesChange(migrated);
    }
  }, [slices, onSlicesChange]);

  const handleAddSlice = () => {
    const coords = pendingNewSlice || { x: 0, y: 0, width: 16, height: 16 };
    const name = newSliceName.trim() || `Slice ${slices.length + 1}`;
    const cleanId = `SYMBOL_${name.toUpperCase().replace(/[^A-Z0-9]/g, '_')}_${Date.now().toString().slice(-4)}`;
    
    if (splitGroup) {
      const parsedCount = Number(splitCount) || 2;
      const count = Math.min(splitDirection === 'Horizontal' ? coords.width : coords.height, Math.max(2, Math.floor(parsedCount)));
      const newSlices: SpriteSlice[] = [];
      const totalWidth = coords.width;
      const totalHeight = coords.height;

      const sw = Math.floor(totalWidth / count);
      const sh = Math.floor(totalHeight / count);

      for (let i = 0; i < count; i++) {
        let sliceW = totalWidth;
        let sliceH = totalHeight;
        let sx = coords.x;
        let sy = coords.y;

        if (splitDirection === 'Horizontal') {
          sliceW = (i === count - 1) ? totalWidth - (i * sw) : sw;
          sx = coords.x + i * sw;
        } else {
          sliceH = (i === count - 1) ? totalHeight - (i * sh) : sh;
          sy = coords.y + i * sh;
        }

        newSlices.push({
          id: i === 0 ? cleanId : `${cleanId}_SUB_${i}`,
          name: i === 0 ? name : undefined,
          groupId: cleanId,
          groupOrder: i + 1,
          x: sx,
          y: sy,
          width: sliceW,
          height: sliceH,
          color: '#00d2ff',
        });
      }
      onSlicesChange([...slices, ...newSlices]);
      setSelectedSliceIds(new Set([cleanId]));
    } else {
      const newSlice: SpriteSlice = {
        id: cleanId,
        name,
        groupId: cleanId,
        groupOrder: 1,
        x: coords.x,
        y: coords.y,
        width: coords.width,
        height: coords.height,
        color: '#00d2ff',
      };
      onSlicesChange([...slices, newSlice]);
      setSelectedSliceIds(new Set([cleanId]));
    }
    
    setNewSliceName('');
    setPendingNewSlice(null);
  };

  const reindexGroup = (slicesList: SpriteSlice[], groupId: string): SpriteSlice[] => {
    const groupMembers = slicesList.filter(s => s.groupId === groupId);
    if (groupMembers.length === 0) return slicesList;
    
    groupMembers.sort((a, b) => (a.groupOrder || 1) - (b.groupOrder || 1));
    const headName = groupMembers.find(s => s.name)?.name || 'Symbol';
    const headColor = groupMembers[0].color || '#38bdf8';
    
    return slicesList.map(s => {
      if (s.groupId === groupId) {
        const idx = groupMembers.findIndex(m => m.id === s.id);
        if (idx === 0) {
          return { ...s, groupOrder: 1, name: headName, color: headColor };
        } else {
          return { ...s, groupOrder: idx + 1, name: undefined, color: headColor };
        }
      }
      return s;
    });
  };

  const handleDeleteSlice = (id: string) => {
    if (slices.length <= 1) return;
    const toDelete = slices.find(s => s.id === id);
    if (!toDelete) return;

    let next = slices.filter(s => s.id !== id);
    next = reindexGroup(next, toDelete.groupId || toDelete.id);
    
    onSlicesChange(next);
    if (selectedSliceIds.has(id)) {
      const nextSet = new Set(selectedSliceIds);
      nextSet.delete(id);
      if (nextSet.size === 0 && next[0]) nextSet.add(next[0].id);
      setSelectedSliceIds(nextSet);
    }
  };

  const handleSliceMove = (sliceId: string, newX: number, newY: number) => {
    const next = slices.map(s => (s.id === sliceId ? { ...s, x: newX, y: newY } : s));
    onSlicesChange(next);
  };

  const handleGroupMembershipChange = (groupId: string) => {
    if (!selectedSlice) return;
    const oldGroupId = selectedSlice.groupId || selectedSlice.id;
    
    let next = [...slices];
    if (groupId === selectedSlice.id) {
      next = next.map(s => s.id === selectedSlice.id ? { ...s, groupId: s.id, groupOrder: 1, name: s.name || 'Symbol' } : s);
    } else {
      const currentGroupElements = next.filter(s => s.groupId === groupId && s.id !== selectedSlice.id);
      const newOrder = currentGroupElements.length + 1;
      next = next.map(s => s.id === selectedSlice.id ? { ...s, groupId, groupOrder: newOrder, name: undefined } : s);
    }

    next = reindexGroup(next, oldGroupId);
    if (groupId !== selectedSlice.id) {
      next = reindexGroup(next, groupId);
    }
    
    onSlicesChange(next);
  };

  const handleGroupOrderChange = (groupOrder: number) => {
    if (!selectedSlice) return;
    
    const groupId = selectedSlice.groupId || selectedSlice.id;
    let groupMembers = slices.filter(s => s.groupId === groupId);
    groupMembers = groupMembers.filter(s => s.id !== selectedSlice.id);
    groupMembers.sort((a, b) => (a.groupOrder || 1) - (b.groupOrder || 1));
    
    const insertIdx = Math.max(0, Math.min(groupMembers.length, groupOrder - 1));
    groupMembers.splice(insertIdx, 0, selectedSlice);
    
    const headName = groupMembers.find(s => s.name)?.name || 'Symbol';
    const headColor = groupMembers[0].color || '#38bdf8';
    
    const updatedMembers = groupMembers.map((s, idx) => {
      if (idx === 0) {
        return { ...s, groupOrder: 1, name: s.id === selectedSlice.id ? (s.name || headName) : headName, color: headColor };
      } else {
        return { ...s, groupOrder: idx + 1, name: undefined, color: headColor };
      }
    });

    const next = slices.map(s => {
      const updated = updatedMembers.find(u => u.id === s.id);
      return updated ? updated : s;
    });
    
    onSlicesChange(next);
  };

  const handleUpdateSelectedSlice = (partial: Partial<SpriteSlice>) => {
    if (!selectedSlice) return;
    const next = slices.map(s => s.id === selectedSlice.id ? { ...s, ...partial } : s);
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
          selectedSliceIds={Array.from(selectedSliceIds)}
          pendingSelection={pendingNewSlice}
          onSelectSlice={(id, isMulti) => {
            if (!id) {
              setSelectedSliceIds(new Set());
            } else if (isMulti) {
              const next = new Set(selectedSliceIds);
              if (next.has(id)) next.delete(id);
              else next.add(id);
              setSelectedSliceIds(next);
            } else {
              setSelectedSliceIds(new Set([id]));
            }
            setPendingNewSlice(null);
          }}
          onNewSelection={rect => {
            setSelectedSliceIds(new Set());
            setPendingNewSlice(rect);
          }}
          onSliceMove={handleSliceMove}
          onSlicesMove={(updates) => {
            const next = [...slices];
            updates.forEach(u => {
              const idx = next.findIndex(s => s.id === u.id);
              if (idx !== -1) {
                next[idx] = { ...next[idx], x: next[idx].x + u.dx, y: next[idx].y + u.dy };
              }
            });
            onSlicesChange(next);
          }}
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
        {pendingNewSlice && selectedSliceIds.size === 0 && (
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

              <div className="flex items-center gap-2 mt-1">
                <input
                  type="checkbox"
                  id="splitGroup"
                  checked={splitGroup}
                  onChange={e => setSplitGroup(e.target.checked)}
                />
                <label htmlFor="splitGroup" className="text-xs text-slate-300 cursor-pointer">Split evenly into group</label>
              </div>

              {splitGroup && (
                <div className="flex flex-col gap-2 p-2 bg-slate-800/50 rounded border border-slate-700/50">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">Slices</span>
                    <input
                      type="number"
                      min={2}
                      value={splitCount}
                      onChange={e => setSplitCount(e.target.value === '' ? '' : (parseInt(e.target.value, 10) || 2))}
                      className="input-text-dark text-xs w-16"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">Direction</span>
                    <select
                      value={splitDirection}
                      onChange={e => setSplitDirection(e.target.value as 'Horizontal' | 'Vertical')}
                      className="input-text-dark text-xs w-24"
                    >
                      <option value="Horizontal">Horizontal</option>
                      <option value="Vertical">Vertical</option>
                    </select>
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono mt-1">
                    Preview: {Math.min(splitDirection === 'Horizontal' ? pendingNewSlice.width : pendingNewSlice.height, Math.max(2, Number(splitCount) || 2))} slices of {splitDirection === 'Horizontal' ? `${Math.floor(pendingNewSlice.width / Math.min(pendingNewSlice.width, Math.max(2, Number(splitCount) || 2)))}×${pendingNewSlice.height}` : `${pendingNewSlice.width}×${Math.floor(pendingNewSlice.height / Math.min(pendingNewSlice.height, Math.max(2, Number(splitCount) || 2)))}`}
                  </div>
                </div>
              )}

              <div className="flex gap-2 mt-1">
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
                  <span>{splitGroup ? 'Create Group' : 'Create Slice'}</span>
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
                <span className="font-semibold text-sm">
                  {selectedSlice.name || (() => {
                    const head = slices.find(s => s.groupId === selectedSlice.groupId && s.groupOrder === 1);
                    return head?.name ? `${head.name} (Order ${selectedSlice.groupOrder})` : `Symbol (Order ${selectedSlice.groupOrder})`;
                  })()}
                </span>
              </div>
              {renderSliceThumb(selectedSlice)}
            </div>

            <div className="slice-inputs-grid">
              <div className="slice-field">
                <label>Symbol Group</label>
                <select
                  value={selectedSlice.groupId === selectedSlice.id && selectedSlice.groupOrder === 1 ? selectedSlice.id : selectedSlice.groupId}
                  onChange={e => handleGroupMembershipChange(e.target.value)}
                  className="input-text-dark text-xs"
                >
                  <option value={selectedSlice.id}>[ Standalone / New Group ]</option>
                  {slices.filter(s => s.groupOrder === 1 && s.id !== selectedSlice.id).map(s => (
                    <option key={s.id} value={s.groupId}>{s.name || s.id}</option>
                  ))}
                </select>
              </div>

              {selectedSlice.groupOrder === 1 ? (
                <div className="slice-field">
                  <label>Display Name</label>
                  <input
                    type="text"
                    value={selectedSlice.name || ''}
                    onChange={e => handleUpdateSelectedSlice({ name: e.target.value })}
                  />
                </div>
              ) : (
                <div className="slice-field">
                  <label>Group Order</label>
                  <input
                    type="number"
                    min={1}
                    value={selectedSlice.groupOrder || 2}
                    onChange={e => handleGroupOrderChange(parseInt(e.target.value, 10) || 2)}
                  />
                </div>
              )}

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
        <div className="slices-list-scroll" style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '8px' }}>
          {(() => {
            const groups: Record<string, SpriteSlice[]> = {};
            slices.forEach(s => {
              const gid = s.groupId || s.id;
              if (!groups[gid]) groups[gid] = [];
              groups[gid].push(s);
            });
            Object.values(groups).forEach(g => g.sort((a, b) => (a.groupOrder || 1) - (b.groupOrder || 1)));

            return Object.entries(groups).map(([groupId, groupSlices]) => {
              const head = groupSlices[0];
              const groupColor = head?.color || '#38bdf8';
              const hasMultiple = groupSlices.length > 1;

              return (
                <div 
                  key={groupId} 
                  className={`group-container ${hasMultiple ? 'has-multiple' : ''}`}
                  style={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: '4px',
                    ...(hasMultiple ? {
                      border: `1px solid ${groupColor}40`,
                      borderRadius: '6px',
                      padding: '4px',
                      backgroundColor: `${groupColor}08`,
                    } : {})
                  }}
                >
                  {groupSlices.map(slice => {
                    const isSelected = selectedSliceIds.has(slice.id);
                    return (
                      <div
                        key={slice.id}
                        className={`slice-list-item ${isSelected ? 'active' : ''}`}
                        onClick={(e) => {
                          if (e.ctrlKey || e.metaKey) {
                            const next = new Set(selectedSliceIds);
                            if (next.has(slice.id)) next.delete(slice.id);
                            else next.add(slice.id);
                            setSelectedSliceIds(next);
                          } else {
                            setSelectedSliceIds(new Set([slice.id]));
                          }
                          setPendingNewSlice(null);
                        }}
                      >
                        <div className="slice-item-left">
                          <span
                            className="slice-color-pip"
                            style={{ backgroundColor: groupColor }}
                          />
                          <div className="slice-item-info">
                            <span className="slice-item-name">
                              {slice.name || (() => {
                                return head?.name ? `${head.name} #${slice.groupOrder}` : `Symbol #${slice.groupOrder}`;
                              })()}
                            </span>
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
              );
            });
          })()}
        </div>
      </div>
    </div>
  );
};

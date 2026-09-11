import React, { useState } from 'react';
import { BwpxGrid } from '../bwpx/core/BwpxGrid';
import { BwpxEditor } from '../bwpx/components/BwpxEditor';
import type { SpriteSlice } from '../types/zmk';
import { Chip } from '@heroui/react';
import { StepperControl } from '../components/ScreenSizePopover';
import {
  Plus,
  Trash2,
  BoxSelect,
  Sparkles,
  Move,
  Layers,
  MoreVertical,
} from 'lucide-react';
import { SymbolGroupContextMenu } from '../components/SymbolGroupContextMenu';
import {
  exportGroupAsPng,
  exportGroupAsGif,
  getGroupDefaultFilename,
} from '../services/symbolGroupExport';

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

  const [groupContextMenu, setGroupContextMenu] = useState<{
    x: number;
    y: number;
    groupId: string;
    groupName: string;
    slices: SpriteSlice[];
  } | null>(null);

  const handleGroupContextMenu = (
    e: React.MouseEvent,
    groupId: string,
    groupSlices: SpriteSlice[]
  ) => {
    e.preventDefault();
    e.stopPropagation();
    const head = groupSlices.find(s => s.groupOrder === 1) || groupSlices[0];
    const name = head?.name || (head?.id ? head.id.replace(/^SYMBOL_/, '') : groupId) || 'Symbol Group';

    setGroupContextMenu({
      x: e.clientX,
      y: e.clientY,
      groupId,
      groupName: name,
      slices: groupSlices,
    });
  };

  const handleExportGroupPng = () => {
    if (!groupContextMenu) return;
    exportGroupAsPng(
      symbolsGrid,
      groupContextMenu.slices,
      getGroupDefaultFilename(groupContextMenu.slices, groupContextMenu.groupId)
    );
  };

  const handleExportGroupGif = () => {
    if (!groupContextMenu) return;
    exportGroupAsGif(
      symbolsGrid,
      groupContextMenu.slices,
      getGroupDefaultFilename(groupContextMenu.slices, groupContextMenu.groupId)
    );
  };

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
          onSelectSlices={(ids) => {
            setSelectedSliceIds(new Set(ids));
            setPendingNewSlice(null);
          }}
          onNewSelection={rect => {
            if (!rect) {
              setPendingNewSlice(null);
              return;
            }
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
          onAddSlices={(newSlices) => {
            onSlicesChange([...slices, ...newSlices]);
            if (newSlices.length > 0) {
              setSelectedSliceIds(new Set(newSlices.map(s => s.id)));
            }
          }}
        />
      </div>

      {/* Right Pane: Slice Inspector */}
      <div className="atlas-inspector-pane">
        <div className="inspector-header pb-2.5 border-b border-[#1e2538] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BoxSelect size={18} className="text-[#00f0ff]" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">Sprite Slices ({slices.length})</h3>
          </div>
          <Chip className="bg-[#00f0ff]/15 text-[#00f0ff] border border-[#00f0ff]/30 text-[10px] font-mono h-5 px-2">
            1-Item Atlas
          </Chip>
        </div>

        {/* New Slice Prompt from Selection */}
        {pendingNewSlice && selectedSliceIds.size === 0 && (
          <div
            className="selected-slice-card bg-[#131722] border border-[#a953f6]/40 rounded-2xl p-4 space-y-3.5 shadow-[0_0_18px_rgba(169,83,246,0.18)]"
          >
            <div className="flex items-center justify-between pb-2 border-b border-[#1e2538]">
              <div className="flex items-center gap-2">
                <Sparkles size={14} className="text-[#a953f6] animate-pulse" />
                <span className="font-bold text-xs text-[#a953f6] uppercase tracking-wider">New Selection Detected</span>
              </div>
              <Chip className="bg-[#a953f6]/15 text-[#a953f6] border border-[#a953f6]/30 text-[10px] font-mono h-5 px-2">
                {pendingNewSlice.width}×{pendingNewSlice.height}
              </Chip>
            </div>

            <div className="text-[11px] text-[#94a3b8] font-mono flex items-center justify-between bg-[#0b0d13] p-2 px-3 rounded-xl border border-[#1e2538]">
              <span>Coordinates [X, Y]:</span>
              <span className="text-white font-bold">({pendingNewSlice.x}, {pendingNewSlice.y})</span>
            </div>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-white flex items-center justify-between">
                  <span>Slice Name</span>
                  <span className="text-[10px] font-mono text-[#555e6e]">Standard</span>
                </label>
                <input
                  type="text"
                  placeholder="Enter slice name..."
                  value={newSliceName}
                  onChange={e => setNewSliceName(e.target.value)}
                  className="w-full bg-[#0b0d13] border border-[#1e2538] focus:border-[#a953f6] text-xs text-white placeholder-[#555e6e] rounded-xl px-3.5 py-2 outline-none font-mono transition-colors"
                  onKeyDown={e => e.key === 'Enter' && handleAddSlice()}
                  autoFocus
                />
              </div>

              <label className="flex items-center gap-2.5 text-xs text-[#94a3b8] hover:text-white cursor-pointer select-none">
                <input
                  type="checkbox"
                  id="splitGroup"
                  checked={splitGroup}
                  onChange={e => setSplitGroup(e.target.checked)}
                  className="accent-[#a953f6] rounded cursor-pointer size-3.5"
                />
                <span>Split evenly into group</span>
              </label>

              {splitGroup && (
                <div className="space-y-2.5 p-3 bg-[#0b0d13] rounded-xl border border-[#1e2538]">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[#94a3b8]">Slices</span>
                    <input
                      type="number"
                      min={2}
                      value={splitCount}
                      onChange={e => setSplitCount(e.target.value === '' ? '' : (parseInt(e.target.value, 10) || 2))}
                      className="bg-[#131722] border border-[#1e2538] focus:border-[#a953f6] text-xs text-white font-mono rounded-lg px-2 py-1 w-16 text-center outline-none"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[#94a3b8]">Direction</span>
                    <select
                      value={splitDirection}
                      onChange={e => setSplitDirection(e.target.value as 'Horizontal' | 'Vertical')}
                      className="bg-[#131722] border border-[#1e2538] focus:border-[#a953f6] text-xs font-mono text-white rounded-lg px-2 py-1 w-28 outline-none cursor-pointer"
                    >
                      <option value="Horizontal">Horizontal</option>
                      <option value="Vertical">Vertical</option>
                    </select>
                  </div>
                  <div className="text-[10px] text-[#94a3b8] font-mono pt-1 border-t border-[#1e2538]/60">
                    Preview: {Math.min(splitDirection === 'Horizontal' ? pendingNewSlice.width : pendingNewSlice.height, Math.max(2, Number(splitCount) || 2))} slices of {splitDirection === 'Horizontal' ? `${Math.floor(pendingNewSlice.width / Math.min(pendingNewSlice.width, Math.max(2, Number(splitCount) || 2)))}×${pendingNewSlice.height}` : `${pendingNewSlice.width}×${Math.floor(pendingNewSlice.height / Math.min(pendingNewSlice.height, Math.max(2, Number(splitCount) || 2)))}`}
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  className="flex-1 bg-[#a953f6] hover:bg-[#bf84fd] text-white font-bold text-xs py-2 rounded-xl shadow-[0_0_12px_rgba(169,83,246,0.3)] transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  onClick={handleAddSlice}
                >
                  <Plus size={14} />
                  <span>{splitGroup ? 'Create Group' : 'Create Slice'}</span>
                </button>
                <button
                  className="px-3.5 bg-[#131722] hover:bg-[#19202f] border border-[#1e2538] text-[#94a3b8] hover:text-white text-xs rounded-xl transition-colors cursor-pointer"
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
          <div
            className="selected-slice-card bg-[#131722] border rounded-2xl p-4 space-y-4 shadow-xl transition-all"
            style={{
              borderColor: `${selectedSlice.color || '#00f0ff'}40`,
              boxShadow: `0 4px 20px rgba(0,0,0,0.5), 0 0 12px ${selectedSlice.color || '#00f0ff'}15`,
            }}
          >
            {/* Header: Name, Group Status, Thumbnail, Delete */}
            <div className="flex items-center justify-between pb-3 border-b border-[#1e2538]">
              <div className="flex items-center gap-2.5 min-w-0">
                <span
                  className="size-2.5 rounded-full flex-shrink-0"
                  style={{
                    backgroundColor: selectedSlice.color || '#00f0ff',
                    boxShadow: `0 0 8px ${selectedSlice.color || '#00f0ff'}`,
                  }}
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs font-bold text-white truncate">
                      {selectedSlice.name || (() => {
                        const head = slices.find(s => s.groupId === selectedSlice.groupId && s.groupOrder === 1);
                        return head?.name ? `${head.name} #${selectedSlice.groupOrder}` : `Symbol #${selectedSlice.groupOrder}`;
                      })()}
                    </h4>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] font-mono text-[#00f0ff]">
                      {selectedSlice.groupId === selectedSlice.id && selectedSlice.groupOrder === 1 ? 'Group Master' : `Order #${selectedSlice.groupOrder}`}
                    </span>
                    <span className="text-[10px] font-mono text-[#555e6e]">·</span>
                    <span className="text-[10px] font-mono text-[#94a3b8]">
                      {`${selectedSlice.width}×${selectedSlice.height}`}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <div className="bg-[#0b0d13] border border-[#1e2538] rounded-xl p-1 flex items-center justify-center">
                  {renderSliceThumb(selectedSlice)}
                </div>
                {slices.length > 1 && (
                  <button
                    onClick={() => handleDeleteSlice(selectedSlice.id)}
                    className="size-7 rounded-lg text-[#555e6e] hover:text-[#f2741d] hover:bg-[#f2741d]/10 border border-transparent hover:border-[#f2741d]/30 flex items-center justify-center transition-all cursor-pointer"
                    title="Delete slice"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            </div>

            {/* Group Membership & Display Name */}
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label
                  className="text-xs font-medium text-white flex items-center justify-between cursor-context-menu"
                  onContextMenu={(e) => {
                    const targetGroupId = selectedSlice.groupId || selectedSlice.id;
                    const members = slices.filter(s => (s.groupId || s.id) === targetGroupId);
                    handleGroupContextMenu(e, targetGroupId, members);
                  }}
                >
                  <span className="flex items-center gap-1.5">
                    <Layers className="size-3 text-[#00f0ff]" />
                    <span>Symbol Group</span>
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-mono text-[#00f0ff]">
                      {selectedSlice.groupId === selectedSlice.id && selectedSlice.groupOrder === 1 ? 'Master' : 'Member'}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        const targetGroupId = selectedSlice.groupId || selectedSlice.id;
                        const members = slices.filter(s => (s.groupId || s.id) === targetGroupId);
                        handleGroupContextMenu(e, targetGroupId, members);
                      }}
                      className="text-[#555e6e] hover:text-[#00f0ff] p-0.5 rounded transition-colors cursor-pointer"
                      title="Group export options"
                    >
                      <MoreVertical size={12} />
                    </button>
                  </div>
                </label>
                <select
                  value={selectedSlice.groupId === selectedSlice.id && selectedSlice.groupOrder === 1 ? selectedSlice.id : selectedSlice.groupId}
                  onChange={e => handleGroupMembershipChange(e.target.value)}
                  className="w-full bg-[#0b0d13] border border-[#1e2538] focus:border-[#00f0ff] text-xs font-mono text-white rounded-xl px-3 py-2 outline-none cursor-pointer transition-colors"
                >
                  <option value={selectedSlice.id}>[ Standalone / New Group ]</option>
                  {slices.filter(s => s.groupOrder === 1 && s.id !== selectedSlice.id).map(s => (
                    <option key={s.id} value={s.groupId}>{s.name || s.id}</option>
                  ))}
                </select>
              </div>

              {selectedSlice.groupOrder === 1 ? (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-white flex items-center justify-between">
                    <span>Display Name</span>
                    <span className="text-[10px] font-mono text-[#555e6e]">Standard</span>
                  </label>
                  <input
                    type="text"
                    value={selectedSlice.name || ''}
                    onChange={e => handleUpdateSelectedSlice({ name: e.target.value })}
                    placeholder="Enter slice name..."
                    className="w-full bg-[#0b0d13] border border-[#1e2538] focus:border-[#00f0ff]/70 text-xs text-white placeholder-[#555e6e] rounded-xl px-3.5 py-2 outline-none transition-colors font-mono"
                  />
                </div>
              ) : (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-white flex items-center justify-between">
                    <span>Group Order</span>
                    <span className="text-[10px] font-mono text-[#a953f6]">Index</span>
                  </label>
                  <StepperControl
                    label="Order"
                    value={selectedSlice.groupOrder || 2}
                    onChange={val => handleGroupOrderChange(val || 2)}
                    min={1}
                    accentColor="purple"
                  />
                </div>
              )}
            </div>

            {/* Coordinate & Size Steppers (Matching FormControls Card 2) */}
            <div className="space-y-3 pt-1">
              <div>
                <div className="text-[10px] font-mono text-[#94a3b8] uppercase mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <Move className="size-3 text-[#00f0ff]" />
                    <span>Position Vector [X, Y]</span>
                  </span>
                  <span className="text-[10px] font-mono text-[#555e6e]">px</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <StepperControl
                    label="X"
                    value={selectedSlice.x}
                    onChange={val => handleUpdateSelectedSlice({ x: val })}
                    min={0}
                    accentColor="cyan"
                  />
                  <StepperControl
                    label="Y"
                    value={selectedSlice.y}
                    onChange={val => handleUpdateSelectedSlice({ y: val })}
                    min={0}
                    accentColor="cyan"
                  />
                </div>
              </div>

              <div>
                <div className="text-[10px] font-mono text-[#94a3b8] uppercase mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <Move className="size-3 text-[#a953f6]" />
                    <span>Dimensions Pair [W, H]</span>
                  </span>
                  <span className="text-[10px] font-mono text-[#555e6e]">px</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <StepperControl
                    label="W"
                    value={selectedSlice.width}
                    onChange={val => handleUpdateSelectedSlice({ width: Math.max(1, val) })}
                    min={1}
                    accentColor="purple"
                  />
                  <StepperControl
                    label="H"
                    value={selectedSlice.height}
                    onChange={val => handleUpdateSelectedSlice({ height: Math.max(1, val) })}
                    min={1}
                    accentColor="purple"
                  />
                </div>
              </div>
            </div>

            {/* Footer Vector Summary */}
            <div className="pt-2.5 border-t border-[#1e2538] text-[11px] font-mono text-[#94a3b8] flex justify-between items-center">
              <span>Pos: <strong className="text-[#00f0ff]">{selectedSlice.x}, {selectedSlice.y}</strong></span>
              <span>Size: <strong className="text-[#a953f6]">{`${selectedSlice.width}×${selectedSlice.height}`}</strong></span>
            </div>
          </div>
        )}

        {/* Add Slice Action */}
        <div className="flex items-center gap-2 p-1">
          <input
            type="text"
            placeholder="New slice name..."
            value={newSliceName}
            onChange={e => setNewSliceName(e.target.value)}
            className="flex-1 bg-[#0b0d13] border border-[#1e2538] focus:border-[#00f0ff]/70 text-xs text-white placeholder-[#555e6e] rounded-xl px-3 py-2 outline-none transition-colors font-mono"
            onKeyDown={e => e.key === 'Enter' && handleAddSlice()}
          />
          <button
            className="bg-[#00f0ff]/10 hover:bg-[#00f0ff] text-[#00f0ff] hover:text-[#0b0d13] border border-[#00f0ff]/30 hover:border-[#00f0ff] text-xs font-semibold px-3.5 py-2 rounded-xl transition-all duration-200 hover:shadow-[0_0_14px_rgba(0,240,255,0.35)] flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            onClick={handleAddSlice}
          >
            <Plus size={14} />
            <span>Add Slice</span>
          </button>
        </div>

        {/* Slices List */}
        <div className="slices-list-scroll" style={{ padding: '8px' }}>
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

              if (hasMultiple) {
                return (
                  <div
                    key={groupId}
                    className="mb-3 cursor-context-menu"
                    style={{
                      background: '#131722',
                      border: `1px solid ${groupColor}30`,
                      borderRadius: '14px',
                      padding: '6px',
                    }}
                    onContextMenu={(e) => handleGroupContextMenu(e, groupId, groupSlices)}
                  >
                    {/* Group header */}
                    <div className="px-2.5 py-1.5 flex items-center justify-between border-b mb-1" style={{ borderColor: `${groupColor}20` }}>
                      <span className="text-[10px] font-mono uppercase tracking-wider flex items-center gap-1.5" style={{ color: groupColor }}>
                        <span className="size-1.5 rounded-full inline-block" style={{ background: groupColor }} />
                        {head?.name || 'Group'}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-mono text-[#555e6e]">{`${groupSlices.length} slices`}</span>
                        <button
                          type="button"
                          onClick={(e) => handleGroupContextMenu(e, groupId, groupSlices)}
                          className="text-[#555e6e] hover:text-[#00f0ff] p-0.5 rounded transition-colors cursor-pointer"
                          title="Group options (Export PNG/GIF)"
                        >
                          <MoreVertical size={12} />
                        </button>
                      </div>
                    </div>

                    {groupSlices.map(slice => {
                      const isSelected = selectedSliceIds.has(slice.id);
                      return (
                        <div
                          key={slice.id}
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
                          onContextMenu={(e) => handleGroupContextMenu(e, groupId, groupSlices)}
                          className="relative rounded-xl p-2 px-3 flex items-center justify-between border transition-all cursor-pointer"
                          style={{
                            borderColor: isSelected ? groupColor : 'transparent',
                            background: isSelected ? '#0b0d13' : undefined,
                            boxShadow: isSelected ? `0 0 12px ${groupColor}40` : undefined,
                          }}
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="size-1.5 rounded-full inline-block flex-shrink-0" style={{ background: groupColor }} />
                            <div>
                              <h4 className="text-xs font-semibold text-white">
                                {slice.name || (head?.name ? `${head.name} #${slice.groupOrder}` : `Symbol #${slice.groupOrder}`)}
                              </h4>
                              <p className="text-[10px] font-mono text-[#94a3b8]">{slice.x},{slice.y} · {slice.width}×{slice.height}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {renderSliceThumb(slice)}
                            <button
                              onClick={e => { e.stopPropagation(); handleDeleteSlice(slice.id); }}
                              className="text-[#555e6e] hover:text-[#f2741d] p-1 rounded transition-colors cursor-pointer"
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
              }

              // Standalone single-slice item
              const slice = groupSlices[0];
              const isSelected = selectedSliceIds.has(slice.id);
              return (
                <div
                  key={slice.id}
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
                  onContextMenu={(e) => handleGroupContextMenu(e, groupId, groupSlices)}
                  className="relative mb-2 rounded-xl p-2.5 px-3 flex items-center justify-between border transition-all cursor-pointer cursor-context-menu"
                  style={{
                    background: '#131722',
                    borderColor: isSelected ? groupColor : '#1e2538',
                    boxShadow: isSelected ? `0 0 12px ${groupColor}40` : undefined,
                  }}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="size-2 rounded-full flex-shrink-0" style={{ background: groupColor }} />
                    <div>
                      <h4 className="text-xs font-semibold text-white">{slice.name || slice.id}</h4>
                      <p className="text-[10px] font-mono text-[#94a3b8]">{slice.x},{slice.y} · {slice.width}×{slice.height}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {renderSliceThumb(slice)}
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation();
                        handleGroupContextMenu(e, groupId, groupSlices);
                      }}
                      className="text-[#555e6e] hover:text-[#00f0ff] p-1 rounded transition-colors cursor-pointer"
                      title="Group options (Export PNG/GIF)"
                    >
                      <MoreVertical size={12} />
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); handleDeleteSlice(slice.id); }}
                      className="text-[#555e6e] hover:text-[#f2741d] p-1 rounded transition-colors cursor-pointer"
                      title="Delete Slice"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              );
            });
          })()}
        </div>

      </div>

      <SymbolGroupContextMenu
        isOpen={groupContextMenu !== null}
        position={groupContextMenu ? { x: groupContextMenu.x, y: groupContextMenu.y } : null}
        groupName={groupContextMenu?.groupName || ''}
        slicesCount={groupContextMenu?.slices.length || 0}
        onClose={() => setGroupContextMenu(null)}
        onExportPng={handleExportGroupPng}
        onExportGif={handleExportGroupGif}
      />
    </div>
  );
};

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { BwpxGrid } from '../bwpx/core/BwpxGrid';
import { BwpxEditor, type EditorViewport } from '../bwpx';
import type { FontCharMapping, GlyphSlot, SpriteSlice } from '../types/zmk';
import {
  Type,
  Play,
  Plus,
  Trash2,
  Crosshair,
  X,
  Search,
  Sparkles,
} from 'lucide-react';

export interface FontAtlasTabProps {
  fontGrid: BwpxGrid;
  onFontGridChange: (grid: BwpxGrid) => void;
  fontMappings: FontCharMapping[];
  onFontMappingsChange: (mappings: FontCharMapping[]) => void;
  initialSelectedMappingId?: string;
  viewport?: EditorViewport;
  onViewportChange?: (viewport: EditorViewport) => void;
}

export const GHOST_SENTENCES = [
  'Hello World',
  'Lorem Ipsum',
  'Scyan Studio',
  'Corne 5x3 Split',
  '120 WPM Speedy',
  'Quick Brown Fox',
  'Cyberpunk OLED',
  'あいうえお 狼',
  'ZMK Firmware Active',
  'Click Clack Thock!',
];

export const FontAtlasTab: React.FC<FontAtlasTabProps> = ({
  fontGrid,
  onFontGridChange,
  fontMappings,
  onFontMappingsChange,
  initialSelectedMappingId,
  viewport,
  onViewportChange,
}) => {
  const [selectedMappingId, setSelectedMappingId] = useState<string>(initialSelectedMappingId || '');
  const [selectedMappingIds, setSelectedMappingIds] = useState<Set<string>>(
    () => new Set(initialSelectedMappingId ? [initialSelectedMappingId] : [])
  );
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [newCharsInput, setNewCharsInput] = useState<string>('');
  const [userInput, setUserInput] = useState<string>('');
  const [ghostText, setGhostText] = useState<string>('');
  const sentenceIdxRef = useRef<number>(0);
  const [previewFontSize, setPreviewFontSize] = useState<'small' | 'big'>('small');

  const [assigningSlot, setAssigningSlot] = useState<{
    mappingId: string;
    slotType: 'small' | 'big';
  } | null>(null);

  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const selectedMapping = selectedMappingId ? fontMappings.find(m => m.id === selectedMappingId) : undefined;

  const filteredMappings = useMemo(() => {
    if (!searchQuery.trim()) return fontMappings;
    const q = searchQuery.trim().toLowerCase();
    return fontMappings.filter(m =>
      m.chars.toLowerCase().includes(q) || m.id.toLowerCase().includes(q)
    );
  }, [fontMappings, searchQuery]);

  const glyphSlices: SpriteSlice[] = useMemo(() => {
    const list: SpriteSlice[] = [];
    fontMappings.forEach(m => {
      if (m.small) {
        list.push({
          groupId: `${m.id}__small`,
          groupOrder: 1,
          id: `${m.id}__small`,
          name: `${m.chars || '?'} (S)`,
          x: m.small.x, y: m.small.y, width: m.small.width, height: m.small.height,
          color: '#38bdf8',
        });
      }
      if (m.big) {
        list.push({
          groupId: `${m.id}__big`,
          groupOrder: 1,
          id: `${m.id}__big`,
          name: `${m.chars || '?'} (B)`,
          x: m.big.x, y: m.big.y, width: m.big.width, height: m.big.height,
          color: '#c084fc',
        });
      }
    });
    return list;
  }, [fontMappings]);

  const selectedSliceId = useMemo(() => {
    if (assigningSlot) return `${assigningSlot.mappingId}__${assigningSlot.slotType}`;
    if (!selectedMapping) return undefined;
    if (selectedMapping.small) return `${selectedMapping.id}__small`;
    if (selectedMapping.big) return `${selectedMapping.id}__big`;
    return undefined;
  }, [selectedMapping, assigningSlot]);

  const handleSliceMove = (sliceId: string, newX: number, newY: number) => {
    const [mappingId, slotType] = sliceId.split('__') as [string, 'small' | 'big'];
    if (!mappingId || !slotType) return;
    const next = fontMappings.map(m => {
      if (m.id !== mappingId) return m;
      const currentSlot = m[slotType];
      if (!currentSlot) return m;
      return { ...m, [slotType]: { ...currentSlot, x: newX, y: newY } };
    });
    onFontMappingsChange(next);
  };

  const handleNewSelection = (rect: { x: number; y: number; width: number; height: number } | null) => {
    if (!rect) return;
    if (assigningSlot) {
      const next = fontMappings.map(m => {
        if (m.id !== assigningSlot.mappingId) return m;
        const currentSlot = m[assigningSlot.slotType];
        const newSlot: GlyphSlot = {
          x: rect.x, y: rect.y, width: rect.width, height: rect.height,
          advanceX: currentSlot?.advanceX ?? (rect.width + 1),
        };
        return { ...m, [assigningSlot.slotType]: newSlot };
      });
      onFontMappingsChange(next);
      setSelectedMappingId(assigningSlot.mappingId);
      setAssigningSlot(null);
    }
  };

  const handleAddMapping = () => {
    const chars = newCharsInput.trim() || '?';
    const newId = `FONT_CHAR_${chars.replace(/[^A-Za-z0-9]/g, '_')}_${Date.now().toString().slice(-4)}`;
    const newMapping: FontCharMapping = { id: newId, chars, small: null, big: null };
    onFontMappingsChange([newMapping, ...fontMappings]);
    setSelectedMappingId(newId);
    setNewCharsInput('');
  };

  const handleDeleteMapping = (id: string) => {
    if (fontMappings.length <= 1) return;
    const next = fontMappings.filter(m => m.id !== id);
    onFontMappingsChange(next);
    if (selectedMappingId === id) {
      setSelectedMappingId('');
      setSelectedMappingIds(new Set());
    }
  };

  const handleUpdateMapping = (id: string, updated: Partial<FontCharMapping>) => {
    const next = fontMappings.map(m => (m.id === id ? { ...m, ...updated } : m));
    onFontMappingsChange(next);
  };

  const handleClearSlot = (mappingId: string, slotType: 'small' | 'big') => {
    const next = fontMappings.map(m => {
      if (m.id !== mappingId) return m;
      return { ...m, [slotType]: null };
    });
    onFontMappingsChange(next);
    if (assigningSlot?.mappingId === mappingId && assigningSlot?.slotType === slotType) {
      setAssigningSlot(null);
    }
  };

  const findGlyphForChar = (char: string, size: 'small' | 'big'): GlyphSlot | null => {
    let match = fontMappings.find(m => m.chars.includes(char));
    if (!match) match = fontMappings.find(m => m.chars.toUpperCase().includes(char.toUpperCase()));
    if (!match) return null;
    if (size === 'small') return match.small || match.big || null;
    else return match.big || match.small || null;
  };

  // Ghost typing animated demo effect
  useEffect(() => {
    // If user has typed anything, stop ghost typing
    if (userInput !== '') {
      return;
    }

    let isMounted = true;
    let timeoutId: ReturnType<typeof setTimeout>;

    let charIdx = 0;
    let phase: 'typing' | 'pausing' | 'deleting' = 'typing';

    const step = () => {
      if (!isMounted) return;

      const sentence = GHOST_SENTENCES[sentenceIdxRef.current];

      if (phase === 'typing') {
        if (charIdx < sentence.length) {
          charIdx++;
          setGhostText(sentence.slice(0, charIdx));
          // Fast typing: 75ms to 140ms per char
          const delay = Math.floor(75 + Math.random() * 65);
          timeoutId = setTimeout(step, delay);
        } else {
          // Fully typed, hold to read for 2-3 seconds
          phase = 'pausing';
          const delay = Math.floor(2000 + Math.random() * 1000);
          timeoutId = setTimeout(step, delay);
        }
      } else if (phase === 'pausing') {
        phase = 'deleting';
        // start deleting fast
        timeoutId = setTimeout(step, 40);
      } else if (phase === 'deleting') {
        if (charIdx > 0) {
          charIdx--;
          setGhostText(sentence.slice(0, charIdx));
          // Fast backspacing: 40ms per character
          timeoutId = setTimeout(step, 40);
        } else {
          // Finished deleting, advance to next word/sentence and loop
          sentenceIdxRef.current = (sentenceIdxRef.current + 1) % GHOST_SENTENCES.length;
          phase = 'typing';
          charIdx = 0;
          setGhostText('');
          timeoutId = setTimeout(step, 300);
        }
      }
    };

    // Initial kick-off
    timeoutId = setTimeout(step, 300);

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
  }, [userInput]);

  const activeDisplayString = userInput || ghostText;

  useEffect(() => {
    const canvas = previewCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const scale = previewFontSize === 'big' ? 2.5 : 3;
    const baseHeight = previewFontSize === 'big' ? 18 : 12;
    let totalWidth = 6;

    for (let i = 0; i < activeDisplayString.length; i++) {
      const char = activeDisplayString[i];
      if (char === ' ') { totalWidth += previewFontSize === 'big' ? 6 : 4; continue; }
      const slot = findGlyphForChar(char, previewFontSize);
      totalWidth += slot ? (slot.advanceX ?? (slot.width + 1)) : (previewFontSize === 'big' ? 6 : 4);
    }

    if (!userInput) {
      totalWidth += 6; // Space for ghost typing cursor
    }

    canvas.width = Math.max(120, Math.ceil(totalWidth * scale));
    canvas.height = Math.ceil(baseHeight * scale);
    ctx.fillStyle = '#0f1217';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = previewFontSize === 'big' ? '#c084fc' : '#00d2ff';
    let curX = 3;

    for (let i = 0; i < activeDisplayString.length; i++) {
      const char = activeDisplayString[i];
      if (char === ' ') { curX += previewFontSize === 'big' ? 6 : 4; continue; }
      const slot = findGlyphForChar(char, previewFontSize);
      if (slot) {
        const topY = Math.max(1, Math.floor((baseHeight - slot.height) / 2));
        for (let gy = 0; gy < slot.height; gy++) {
          for (let gx = 0; gx < slot.width; gx++) {
            if (fontGrid.get(slot.x + gx, slot.y + gy)) {
              ctx.fillRect((curX + gx) * scale, (topY + gy) * scale, scale - 0.4, scale - 0.4);
            }
          }
        }
        curX += (slot.advanceX ?? (slot.width + 1));
      } else {
        curX += previewFontSize === 'big' ? 6 : 4;
      }
    }

    // Ghost typing cursor
    if (!userInput) {
      const cursorY = Math.max(1, Math.floor((baseHeight - 8) / 2));
      ctx.fillStyle = previewFontSize === 'big' ? '#c084fc' : '#00d2ff';
      ctx.fillRect((curX + 1) * scale, cursorY * scale, Math.max(2, scale * 0.7), 8 * scale);
    }
  }, [activeDisplayString, previewFontSize, fontGrid, fontMappings, userInput]);

  const renderSlotThumb = (slot: GlyphSlot, isBig: boolean, scale = 2) => (
    <canvas
      width={slot.width}
      height={slot.height}
      style={{ width: slot.width * scale, height: slot.height * scale, imageRendering: 'pixelated' }}
      ref={canvas => {
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.fillStyle = '#101216';
        ctx.fillRect(0, 0, slot.width, slot.height);
        ctx.fillStyle = isBig ? '#c084fc' : '#38bdf8';
        for (let y = 0; y < slot.height; y++) {
          for (let x = 0; x < slot.width; x++) {
            if (fontGrid.get(slot.x + x, slot.y + y)) ctx.fillRect(x, y, 1, 1);
          }
        }
      }}
    />
  );

  const assigningTargetMapping = assigningSlot
    ? fontMappings.find(m => m.id === assigningSlot.mappingId)
    : null;

  return (
    <div className="atlas-tab-container">
      {/* Left/Center: Top String Renderer + Canvas editor below */}
      <div className="atlas-editor-pane font-atlas-editor-pane">
        {/* Interactive String Renderer (Top) */}
        <div className="font-preview-top-bar">
          <div className="font-preview-top-inner">
            <div className="flex items-center gap-3 mb-2">
              <label className="text-xs text-muted flex items-center gap-1 whitespace-nowrap">
                <Play size={11} className="text-accent" />
                <span>String Renderer</span>
              </label>
              {!userInput && (
                <span className="flex items-center gap-1 text-[10px] font-mono text-accent/80 bg-accent/10 px-1.5 py-0.5 rounded border border-accent/20 animate-pulse">
                  <Sparkles size={10} />
                  <span>ghost typing</span>
                </span>
              )}
              <div className="font-size-toggle-group ml-auto">
                <button
                  className={`btn-toggle-subtle text-[10px] px-2 py-0.5 ${previewFontSize === 'small' ? 'active font-bold' : ''}`}
                  style={previewFontSize === 'small' ? { color: '#38bdf8', borderColor: '#38bdf8' } : {}}
                  onClick={() => setPreviewFontSize('small')}
                >
                  Small
                </button>
                <button
                  className={`btn-toggle-subtle text-[10px] px-2 py-0.5 ${previewFontSize === 'big' ? 'active font-bold' : ''}`}
                  style={previewFontSize === 'big' ? { color: '#c084fc', borderColor: '#c084fc' } : {}}
                  onClick={() => setPreviewFontSize('big')}
                >
                  Big
                </button>
              </div>
            </div>
            <div className="font-preview-canvas-wrapper mb-2">
              <canvas ref={previewCanvasRef} className="font-preview-canvas" />
            </div>
            <div className="relative flex items-center">
              <input
                type="text"
                value={userInput}
                onChange={e => setUserInput(e.target.value)}
                className="input-text-dark text-xs font-mono w-full pr-8"
                placeholder={ghostText || "Type text, hiragana, katakana, or 狼 to test font..."}
              />
              {userInput && (
                <button
                  type="button"
                  onClick={() => setUserInput('')}
                  className="absolute right-2 text-muted hover:text-white text-xs transition-colors px-1"
                  title="Clear text (resume ghost typing)"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="font-canvas-flex">
          <BwpxEditor
            initialWidth={fontGrid.width}
            initialHeight={fontGrid.height}
            initialGrid={fontGrid}
            onGridChange={onFontGridChange}
            title="FONT & CHARACTER ATLAS (1BPP)"
            showPresets={false}
            slices={glyphSlices}
            selectedSliceId={selectedSliceId}
            initialViewport={viewport}
            onViewportChange={onViewportChange}
            selectedSliceIds={Array.from(selectedMappingIds).flatMap(mid => {
              const m = fontMappings.find(fm => fm.id === mid);
              if (!m) return [];
              const ids: string[] = [];
              if (m.small) ids.push(`${mid}__small`);
              if (m.big) ids.push(`${mid}__big`);
              return ids;
            })}
            externalTool={assigningSlot ? 'select' : undefined}
            onSelectSlice={(id, isMulti) => {
              if (!id) {
                setSelectedMappingIds(new Set());
                setSelectedMappingId('');
                return;
              }
              const [mappingId] = id.split('__');
              if (!mappingId) return;
              if (isMulti) {
                setSelectedMappingIds(prev => {
                  const next = new Set(prev);
                  if (next.has(mappingId)) next.delete(mappingId);
                  else next.add(mappingId);
                  return next;
                });
              } else {
                setSelectedMappingIds(new Set([mappingId]));
                setSelectedMappingId(mappingId);
              }
            }}
            onSelectSlices={(ids) => {
              const mappingIds = new Set(ids.map(id => id.split('__')[0]).filter(Boolean));
              setSelectedMappingIds(mappingIds);
              const firstId = Array.from(mappingIds)[0];
              if (firstId) setSelectedMappingId(firstId);
            }}
            onNewSelection={handleNewSelection}
            onSliceMove={handleSliceMove}
            onSlicesMove={(updates) => {
              const next = fontMappings.map(m => {
                const allUpdates = updates.filter(upd => upd.id.startsWith(m.id + '__'));
                if (allUpdates.length === 0) return m;
                const dx = allUpdates[0].dx;
                const dy = allUpdates[0].dy;
                let updated = { ...m };
                if (m.small) updated = { ...updated, small: { ...m.small, x: m.small.x + dx, y: m.small.y + dy } };
                if (m.big) updated = { ...updated, big: { ...m.big, x: m.big.x + dx, y: m.big.y + dy } };
                return updated;
              });
              onFontMappingsChange(next);
            }}
          />
        </div>
      </div>

      {/* Right Pane: Inspector */}
      <div className="atlas-inspector-pane">
        <div className="inspector-header">
          <div className="flex items-center gap-2">
            <Type size={18} className="text-accent" />
            <h3 className="inspector-title">Character Mappings ({fontMappings.length})</h3>
          </div>
        </div>

        {/* Slot Assignment Banner */}
        {assigningSlot && assigningTargetMapping && (
          <div className="font-assigning-banner">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5">
                <Crosshair size={14} className="text-[#c084fc] animate-spin" />
                <span className="font-bold text-xs text-purple-300">
                  Assigning &ldquo;{assigningTargetMapping.chars}&rdquo; ({assigningSlot.slotType.toUpperCase()})
                </span>
              </div>
              <button className="text-slate-400 hover:text-white p-0.5" onClick={() => setAssigningSlot(null)}>
                <X size={14} />
              </button>
            </div>
            <p className="text-[11px] text-slate-300">Drag a selection box on the canvas to capture the glyph.</p>
          </div>
        )}

        {/* Selected Mapping Editor Module */}
        {selectedMapping && !assigningSlot && (
          <div className="selected-slice-card font-mapping-editor-card">
            <div className="flex items-center gap-2 mb-3">
              <input
                type="text"
                value={selectedMapping.chars}
                onChange={e => handleUpdateMapping(selectedMapping.id, { chars: e.target.value })}
                className="font-mapping-chars-input"
                title="Characters that map to this glyph (e.g. 'aAÁ')"
                placeholder="char(s)..."
              />
              {selectedMapping.chars.length > 1 && (
                <span className="text-[10px] text-slate-500 font-mono whitespace-nowrap">
                  {selectedMapping.chars.length} aliases
                </span>
              )}
              <button
                className="btn-slice-delete ml-auto"
                onClick={() => handleDeleteMapping(selectedMapping.id)}
                title="Delete mapping"
              >
                <Trash2 size={13} />
              </button>
              <button
                className="text-slate-400 hover:text-white p-1 rounded hover:bg-white/10 transition-colors cursor-pointer"
                onClick={() => {
                  setSelectedMappingId('');
                  setSelectedMappingIds(new Set());
                }}
                title="Deselect mapping"
              >
                <X size={14} />
              </button>
            </div>

            <div className="font-mapping-slots-grid">
              {(['small', 'big'] as const).map(slotType => {
                const slot = selectedMapping[slotType];
                const isSmall = slotType === 'small';
                const color = isSmall ? '#38bdf8' : '#c084fc';
                const label = isSmall ? 'S' : 'B';

                return (
                  <div
                    key={slotType}
                    className={`font-slot-panel ${slot ? 'assigned' : 'empty'}`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-slot-label" style={{ color }}>{label}</span>
                      {slot && (
                        <div className="flex items-center gap-1">
                          <button
                            className="font-slot-icon-btn"
                            onClick={() => setAssigningSlot({ mappingId: selectedMapping.id, slotType })}
                            title="Reassign on canvas"
                          >
                            <Crosshair size={11} />
                          </button>
                          <button
                            className="font-slot-icon-btn hover:text-red-400"
                            onClick={() => handleClearSlot(selectedMapping.id, slotType)}
                            title={`Clear ${slotType} slot`}
                          >
                            <X size={11} />
                          </button>
                        </div>
                      )}
                    </div>
                    {slot ? (
                      <div className="flex items-center gap-2">
                        <div className="font-slot-thumb-wrapper">
                          {renderSlotThumb(slot, !isSmall)}
                        </div>
                        <div className="font-slot-meta">
                          <span style={{ color }}>{slot.width}x{slot.height}</span>
                          <span className="text-slate-500">{slot.x},{slot.y}</span>
                        </div>
                      </div>
                    ) : (
                      <button
                        className="font-slot-empty-btn"
                        style={{ color }}
                        onClick={() => setAssigningSlot({ mappingId: selectedMapping.id, slotType })}
                      >
                        <Plus size={12} />
                        <span>Assign</span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Add Character Mapping Bar */}
        <div className="add-slice-bar mt-2">
          <input
            type="text"
            placeholder="char(s) e.g. aA or K..."
            value={newCharsInput}
            onChange={e => setNewCharsInput(e.target.value)}
            className="input-text-dark text-xs font-mono"
            onKeyDown={e => e.key === 'Enter' && handleAddMapping()}
          />
          <button className="btn-add-slice" onClick={handleAddMapping}>
            <Plus size={14} />
            <span>Add</span>
          </button>
        </div>

        {/* Search / Filter Input */}
        <div className="relative mt-2">
          <input
            type="text"
            placeholder="Filter..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="input-text-dark text-xs pl-7"
          />
          <Search size={12} className="absolute left-2.5 top-2.5 text-slate-500" />
        </div>

        {/* Compact Scrollable List */}
        <div className="slices-list-scroll mt-2">
          {filteredMappings.map(mapping => {
            const isSelected = Boolean(selectedMappingId) && (selectedMappingIds.has(mapping.id) || mapping.id === selectedMappingId);
            const isAssigningThis = assigningSlot?.mappingId === mapping.id;
            return (
              <div
                key={mapping.id}
                onClick={() => {
                  if (selectedMappingId === mapping.id) {
                    setSelectedMappingId('');
                    setSelectedMappingIds(new Set());
                  } else {
                    setSelectedMappingId(mapping.id);
                    setSelectedMappingIds(new Set([mapping.id]));
                  }
                }}
                className="relative mb-2 rounded-xl p-2 px-3 flex items-center justify-between border transition-all cursor-pointer"
                style={{
                  background: isAssigningThis ? 'rgba(169,83,246,0.08)' : '#131722',
                  borderColor: isSelected
                    ? '#00f0ff'
                    : isAssigningThis
                    ? 'rgba(169,83,246,0.5)'
                    : '#1e2538',
                  boxShadow: isSelected ? '0 0 12px rgba(0,240,255,0.25)' : undefined,
                }}
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className="font-mono text-sm font-bold w-7 text-center"
                    style={{ color: isSelected ? '#00f0ff' : '#e2e8f0' }}
                  >
                    {mapping.chars || '?'}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {mapping.small ? (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-[#00f0ff]/15 text-[#00f0ff] border border-[#00f0ff]/30">
                        S {mapping.small.width}×{mapping.small.height}
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-mono text-[#555e6e] border border-[#1e2538]">S —</span>
                    )}
                    {mapping.big ? (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-[#a953f6]/15 text-[#a953f6] border border-[#a953f6]/30">
                        B {mapping.big.width}×{mapping.big.height}
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-mono text-[#555e6e] border border-[#1e2538]">B —</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {mapping.small && (
                    <div className="bg-[#0b0d13] border border-[#1e2538] rounded-lg p-0.5 flex items-center justify-center">
                      {renderSlotThumb(mapping.small, false, 1.5)}
                    </div>
                  )}
                  {mapping.big && (
                    <div className="bg-[#0b0d13] border border-[#1e2538] rounded-lg p-0.5 flex items-center justify-center">
                      {renderSlotThumb(mapping.big, true, 1.5)}
                    </div>
                  )}
                  <button
                    className="text-[#555e6e] hover:text-[#f2741d] p-1 rounded transition-colors cursor-pointer"
                    onClick={e => { e.stopPropagation(); handleDeleteMapping(mapping.id); }}
                    title="Delete mapping"
                  >
                    <Trash2 size={12} />
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

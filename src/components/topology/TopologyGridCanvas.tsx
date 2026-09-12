import React, { useState, useMemo, useCallback } from 'react';
import type { ShieldPartItem } from '../../data/shieldsData';
import { TopologyPartRenderer } from './TopologyPartRenderer';
import { BwpxGrid } from '../../bwpx/core/BwpxGrid';
import type { SpriteSlice, FontGlyph, FontCharMapping, LayoutBlock } from '../../types/zmk';
import type { WidgetInstanceMap } from '../../types/widget';
import {
  Plus,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Trash2,
  Layers,
  Cpu,
  Monitor,
  Sparkles,
  GripVertical,
} from 'lucide-react';

export interface PlacedPartInstance {
  part: ShieldPartItem;
  x: number;
  y: number;
}

export interface LayoutDisplayItem {
  id: string; // e.g. 'left', 'right', 'dongle', 'peripheral-1'
  name: string; // e.g. 'Master Display', 'Right Peripheral', 'Dongle'
  isMaster: boolean;
  blocks: LayoutBlock[];
  idleBlocks?: LayoutBlock[];
  dimensions: { width: number; height: number };
}

export interface TopologyGridCanvasProps {
  placedParts: Record<string, PlacedPartInstance>;
  onPlacedPartsChange: (parts: Record<string, PlacedPartInstance>) => void;
  allParts: ShieldPartItem[];
  symbolsGrid: BwpxGrid;
  symbolSlices: SpriteSlice[];
  fontGrid: BwpxGrid;
  fontGlyphs?: FontGlyph[];
  fontMappings?: FontCharMapping[];
  activeLeftBlocks: LayoutBlock[];
  activeRightBlocks: LayoutBlock[];
  activeDongleBlocks: LayoutBlock[];
  layoutDisplays?: Record<string, LayoutDisplayItem>;
  displayAssignments?: Record<string, string | null>;
  onDisplayAssignmentsChange?: (assignments: Record<string, string | null>) => void;
  masterShieldKey?: string | null;
  onSetMasterShield?: (cellKey: string | null) => void;
  onSwapDisplays?: (displayIdA: string, displayIdB: string) => void;
  onMoveDisplayToMaster?: (displayId: string) => void;
  typingWpm?: number;
  batteryLevel?: number;
  outputMode?: 'usb' | 'ble';
  currentLayer?: number;
  customText?: string;
  instances?: WidgetInstanceMap;
  onKeystroke?: () => void;
}

export const TopologyGridCanvas: React.FC<TopologyGridCanvasProps> = ({
  placedParts,
  onPlacedPartsChange,
  allParts,
  symbolsGrid,
  symbolSlices,
  fontGrid,
  fontGlyphs,
  fontMappings,
  activeLeftBlocks,
  activeRightBlocks,
  activeDongleBlocks,
  layoutDisplays,
  displayAssignments,
  onDisplayAssignmentsChange,
  masterShieldKey,
  onSetMasterShield,
  onSwapDisplays,
  onMoveDisplayToMaster,
  typingWpm = 48,
  batteryLevel = 88,
  outputMode = 'ble',
  currentLayer = 0,
  customText = 'SCYAN',
  instances,
  onKeystroke,
}) => {
  const [zoomScale, setZoomScale] = useState<number>(0.85);
  const [hoveredDropSlot, setHoveredDropSlot] = useState<string | null>(null);

  // Fallback layout displays if not provided
  const effectiveLayoutDisplays = useMemo<Record<string, LayoutDisplayItem>>(() => {
    if (layoutDisplays && Object.keys(layoutDisplays).length > 0) {
      return layoutDisplays;
    }
    return {
      left: {
        id: 'left',
        name: 'Master Display',
        isMaster: true,
        blocks: activeLeftBlocks,
        dimensions: { width: 32, height: 128 },
      },
      right: {
        id: 'right',
        name: 'Right Peripheral',
        isMaster: false,
        blocks: activeRightBlocks,
        dimensions: { width: 32, height: 128 },
      },
    };
  }, [layoutDisplays, activeLeftBlocks, activeRightBlocks]);

  // Local fallback for display assignments
  const [localDisplayAssignments, setLocalDisplayAssignments] = useState<Record<string, string | null>>(() => {
    return {
      '0,0': 'left',
      '1,0': 'right',
    };
  });

  const effectiveDisplayAssignments = displayAssignments !== undefined ? displayAssignments : localDisplayAssignments;
  const updateDisplayAssignments = onDisplayAssignmentsChange || setLocalDisplayAssignments;

  // Local fallback for master shield key
  const [localMasterShieldKey, setLocalMasterShieldKey] = useState<string | null>('0,0');
  const effectiveMasterShieldKey = masterShieldKey !== undefined ? masterShieldKey : localMasterShieldKey;
  const updateMasterShieldKey = onSetMasterShield || setLocalMasterShieldKey;

  // Display dragging & drop target state
  const [_draggedDisplay, setDraggedDisplay] = useState<{ fromCellKey: string | 'unassigned'; displayId: string } | null>(null);
  const [hoveredDisplayDropTarget, setHoveredDisplayDropTarget] = useState<string | null>(null);

  // Layout displays count & unassigned displays
  const assignedDisplayIds = useMemo(() => {
    return new Set(Object.values(effectiveDisplayAssignments).filter(Boolean) as string[]);
  }, [effectiveDisplayAssignments]);

  const unassignedDisplays = useMemo(() => {
    return Object.values(effectiveLayoutDisplays).filter((disp) => !assignedDisplayIds.has(disp.id));
  }, [effectiveLayoutDisplays, assignedDisplayIds]);

  const totalLayoutDisplaysCount = Object.keys(effectiveLayoutDisplays).length;
  const assignedDisplaysCount = assignedDisplayIds.size;

  const placedKeys = Object.keys(placedParts);
  const isEmpty = placedKeys.length === 0;

  // Compute bounding box
  const { minX, maxX, minY, maxY } = useMemo(() => {
    if (isEmpty) return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
    let mx = Infinity;
    let Mx = -Infinity;
    let my = Infinity;
    let My = -Infinity;

    for (const key of placedKeys) {
      const item = placedParts[key];
      if (item.x < mx) mx = item.x;
      if (item.x > Mx) Mx = item.x;
      if (item.y < my) my = item.y;
      if (item.y > My) My = item.y;
    }

    return { minX: mx, maxX: Mx, minY: my, maxY: My };
  }, [placedParts, placedKeys, isEmpty]);

  // Compute all available neighbor slots (Left, Right, Up, Down of all placed parts)
  const neighborSlots = useMemo(() => {
    const slots = new Set<string>();
    const offsets = [
      { dx: 0, dy: -1 }, // Up
      { dx: 0, dy: 1 },  // Down
      { dx: -1, dy: 0 }, // Left
      { dx: 1, dy: 0 },  // Right
    ];

    for (const key of placedKeys) {
      const item = placedParts[key];
      for (const { dx, dy } of offsets) {
        const nx = item.x + dx;
        const ny = item.y + dy;
        const nKey = `${nx},${ny}`;
        if (!placedParts[nKey]) {
          slots.add(nKey);
        }
      }
    }

    return slots;
  }, [placedParts, placedKeys]);

  // Grid bounds for rendering rows and columns
  const gridBounds = useMemo(() => {
    if (isEmpty) {
      return { rows: [0], cols: [0] };
    }
    // Include 1 extra cell on each side for neighbor slots
    const rStart = minY - 1;
    const rEnd = maxY + 1;
    const cStart = minX - 1;
    const cEnd = maxX + 1;

    const rows: number[] = [];
    for (let y = rStart; y <= rEnd; y++) rows.push(y);

    const cols: number[] = [];
    for (let x = cStart; x <= cEnd; x++) cols.push(x);

    return { rows, cols };
  }, [isEmpty, minY, maxY, minX, maxX]);

  // Drag and drop handlers
  const handleDragOver = useCallback((e: React.DragEvent, slotKey: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setHoveredDropSlot(slotKey);
  }, []);

  const handleDragLeave = useCallback((_e: React.DragEvent, slotKey: string) => {
    setHoveredDropSlot((curr) => (curr === slotKey ? null : curr));
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, targetX: number, targetY: number) => {
      e.preventDefault();
      setHoveredDropSlot(null);

      try {
        const raw = e.dataTransfer.getData('application/json');
        if (!raw) return;
        const payload = JSON.parse(raw);

        if (payload.moveFrom) {
          // Move from another cell
          const fromKey = `${payload.moveFrom.x},${payload.moveFrom.y}`;
          const targetKey = `${targetX},${targetY}`;
          const sourceItem = placedParts[fromKey];
          if (!sourceItem) return;

          const updated = { ...placedParts };
          delete updated[fromKey];
          updated[targetKey] = {
            ...sourceItem,
            x: targetX,
            y: targetY,
          };
          onPlacedPartsChange(updated);

          // If moving part to another cell, migrate its display assignment
          const sourceDisplay = effectiveDisplayAssignments[fromKey];
          const nextAssignments = { ...effectiveDisplayAssignments };
          delete nextAssignments[fromKey];
          if (sourceDisplay !== undefined) {
            nextAssignments[targetKey] = sourceDisplay;
          }
          updateDisplayAssignments(nextAssignments);

          if (effectiveMasterShieldKey === fromKey) {
            updateMasterShieldKey(targetKey);
          }
        } else if (payload.partId) {
          // Add newly dropped part
          const foundPart = allParts.find((p) => p.id === payload.partId);
          if (foundPart) {
            const targetKey = `${targetX},${targetY}`;
            onPlacedPartsChange({
              ...placedParts,
              [targetKey]: {
                part: foundPart,
                x: targetX,
                y: targetY,
              },
            });

            // Automatically assign first unassigned display to this part if available, or null (empty bay)
            const nextUnassigned = unassignedDisplays[0];
            const nextAssignments = { ...effectiveDisplayAssignments };
            nextAssignments[targetKey] = nextUnassigned ? nextUnassigned.id : null;
            updateDisplayAssignments(nextAssignments);

            // If this is the first part or a left half, set as master shield
            if (isEmpty || foundPart.side === 'left' || foundPart.side === 'dongle') {
              updateMasterShieldKey(targetKey);
            }
          }
        }
      } catch (err) {
        console.error('Error handling drop in topology canvas:', err);
      }
    },
    [
      placedParts,
      allParts,
      onPlacedPartsChange,
      effectiveDisplayAssignments,
      updateDisplayAssignments,
      effectiveMasterShieldKey,
      updateMasterShieldKey,
      unassignedDisplays,
      isEmpty,
    ]
  );

  // Drag and Drop handlers for OLED displays between shields
  const handleDisplayDragStart = useCallback((e: React.DragEvent, cellKey: string, displayId: string) => {
    e.stopPropagation();
    setDraggedDisplay({ fromCellKey: cellKey, displayId });
    e.dataTransfer.setData(
      'application/json',
      JSON.stringify({
        type: 'topology-oled-display',
        fromCellKey: cellKey,
        displayId,
      })
    );
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleSetMasterShield = useCallback(
    (cellKey: string) => {
      const prevMasterKey = effectiveMasterShieldKey;
      updateMasterShieldKey(cellKey);

      const assignedDisplay = effectiveDisplayAssignments[cellKey];
      if (assignedDisplay && assignedDisplay !== 'left') {
        onMoveDisplayToMaster?.(assignedDisplay);
        const next = { ...effectiveDisplayAssignments };
        next[cellKey] = 'left';
        if (prevMasterKey && prevMasterKey !== cellKey && effectiveDisplayAssignments[prevMasterKey] === 'left') {
          next[prevMasterKey] = assignedDisplay;
        }
        updateDisplayAssignments(next);
      }
    },
    [effectiveMasterShieldKey, effectiveDisplayAssignments, updateMasterShieldKey, onMoveDisplayToMaster, updateDisplayAssignments]
  );

  const handleDisplayDropOnShield = useCallback(
    (e: React.DragEvent, targetCellKey: string) => {
      e.preventDefault();
      e.stopPropagation();
      setHoveredDisplayDropTarget(null);

      try {
        const raw = e.dataTransfer.getData('application/json');
        if (!raw) return;
        const payload = JSON.parse(raw);
        if (payload.type !== 'topology-oled-display') return;

        const fromCellKey: string = payload.fromCellKey;
        const sourceDisplayId: string = payload.displayId;

        if (fromCellKey === targetCellKey) return;

        const targetDisplayId: string | null = effectiveDisplayAssignments[targetCellKey] ?? null;
        const isTargetMasterShield = targetCellKey === effectiveMasterShieldKey;

        if (targetDisplayId) {
          // SWAP: Target shield already has an OLED display!
          if (fromCellKey === 'unassigned') {
            if (isTargetMasterShield) {
              onSwapDisplays?.(sourceDisplayId, 'left');
              const next = { ...effectiveDisplayAssignments };
              next[targetCellKey] = 'left';
              updateDisplayAssignments(next);
            } else {
              const next = { ...effectiveDisplayAssignments };
              next[targetCellKey] = sourceDisplayId;
              updateDisplayAssignments(next);
            }
          } else {
            // Both are mounted on shields! Swap the two displays between shields losslessly.
            onSwapDisplays?.(sourceDisplayId, targetDisplayId);
          }
        } else {
          // MOVE: Target shield has an Empty OLED Bay!
          const next = { ...effectiveDisplayAssignments };
          if (fromCellKey !== 'unassigned') {
            next[fromCellKey] = null;
          }

          if (isTargetMasterShield) {
            // Moving a display to the master shield puts it as the master display
            onMoveDisplayToMaster?.(sourceDisplayId);
            next[targetCellKey] = 'left';
          } else {
            next[targetCellKey] = sourceDisplayId;
          }
          updateDisplayAssignments(next);
        }
      } catch (err) {
        console.error('Error dropping display onto shield:', err);
      } finally {
        setDraggedDisplay(null);
      }
    },
    [
      effectiveDisplayAssignments,
      effectiveMasterShieldKey,
      onSwapDisplays,
      onMoveDisplayToMaster,
      updateDisplayAssignments,
    ]
  );

  const handleDeletePart = useCallback(
    (x: number, y: number) => {
      const key = `${x},${y}`;
      const updated = { ...placedParts };
      delete updated[key];
      onPlacedPartsChange(updated);

      const nextAssignments = { ...effectiveDisplayAssignments };
      delete nextAssignments[key];
      updateDisplayAssignments(nextAssignments);

      if (effectiveMasterShieldKey === key) {
        // If master shield deleted, reassign to first remaining shield
        const remainingKeys = Object.keys(updated);
        updateMasterShieldKey(remainingKeys.length > 0 ? remainingKeys[0] : null);
      }
    },
    [
      placedParts,
      onPlacedPartsChange,
      effectiveDisplayAssignments,
      updateDisplayAssignments,
      effectiveMasterShieldKey,
      updateMasterShieldKey,
    ]
  );

  const handleApplyPreset = (presetKey: 'corne' | 'dongle-split' | 'numpad' | 'reviung') => {
    const corneLeft = allParts.find((p) => p.id === 'corne_left');
    const corneRight = allParts.find((p) => p.id === 'corne_right');
    const xiao = allParts.find((p) => p.id === 'xiao-dongle');
    const tidbit = allParts.find((p) => p.id === 'tidbit');
    const reviung = allParts.find((p) => p.id === 'reviung41');

    if (presetKey === 'corne' && corneLeft && corneRight) {
      onPlacedPartsChange({
        '0,0': { part: corneLeft, x: 0, y: 0 },
        '1,0': { part: corneRight, x: 1, y: 0 },
      });
      updateMasterShieldKey('0,0');
      updateDisplayAssignments({
        '0,0': 'left',
        '1,0': effectiveLayoutDisplays['right'] ? 'right' : null,
      });
    } else if (presetKey === 'dongle-split' && corneLeft && corneRight && xiao) {
      onPlacedPartsChange({
        '0,0': { part: corneLeft, x: 0, y: 0 },
        '1,0': { part: xiao, x: 1, y: 0 },
        '2,0': { part: corneRight, x: 2, y: 0 },
      });
      updateMasterShieldKey('1,0'); // Dongle is Master!
      updateDisplayAssignments({
        '1,0': 'left', // Master display on Dongle
        '0,0': effectiveLayoutDisplays['right'] ? 'right' : null,
        '2,0': effectiveLayoutDisplays['dongle'] ? 'dongle' : null,
      });
    } else if (presetKey === 'numpad' && corneLeft && corneRight && tidbit) {
      onPlacedPartsChange({
        '0,0': { part: corneLeft, x: 0, y: 0 },
        '1,0': { part: corneRight, x: 1, y: 0 },
        '2,0': { part: tidbit, x: 2, y: 0 },
      });
      updateMasterShieldKey('0,0');
      updateDisplayAssignments({
        '0,0': 'left',
        '1,0': effectiveLayoutDisplays['right'] ? 'right' : null,
        '2,0': effectiveLayoutDisplays['dongle'] ? 'dongle' : null,
      });
    } else if (presetKey === 'reviung' && reviung && tidbit) {
      onPlacedPartsChange({
        '0,0': { part: reviung, x: 0, y: 0 },
        '1,0': { part: tidbit, x: 1, y: 0 },
      });
      updateMasterShieldKey('0,0');
      updateDisplayAssignments({
        '0,0': 'left',
        '1,0': effectiveLayoutDisplays['right'] ? 'right' : null,
      });
    }
  };

  // Quick stats
  const totalKeys = useMemo(() => {
    return Object.values(placedParts).reduce((acc, p) => acc + p.part.keyCount, 0);
  }, [placedParts]);

  const totalScreens = useMemo(() => {
    return Object.values(placedParts).length; // Each shield part in our catalog has an OLED!
  }, [placedParts]);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#0b0d13] relative">
      {/* Top Toolbar: Presets, Stats & Canvas Controls */}
      <div className="border-b border-[#1e2538] px-4 py-2.5 bg-[#0e121b] flex items-center justify-between gap-4 shrink-0 flex-wrap">
        {/* Presets */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] font-mono text-[#64748b] mr-1 uppercase font-semibold">
            Presets:
          </span>
          <button
            onClick={() => handleApplyPreset('corne')}
            className="px-2.5 py-1 rounded-lg text-xs font-mono bg-[#131722] hover:bg-[#1a2030] text-[#94a3b8] hover:text-[#00f0ff] border border-[#1e2538] hover:border-[#00f0ff]/30 transition-all cursor-pointer"
          >
            Corne Split (L+R)
          </button>
          <button
            onClick={() => handleApplyPreset('dongle-split')}
            className="px-2.5 py-1 rounded-lg text-xs font-mono bg-[#131722] hover:bg-[#1a2030] text-[#94a3b8] hover:text-[#a855f7] border border-[#1e2538] hover:border-[#a855f7]/30 transition-all cursor-pointer flex items-center gap-1"
          >
            <Sparkles size={12} className="text-[#a855f7]" />
            <span>Dongle Master + Split</span>
          </button>
          <button
            onClick={() => handleApplyPreset('numpad')}
            className="px-2.5 py-1 rounded-lg text-xs font-mono bg-[#131722] hover:bg-[#1a2030] text-[#94a3b8] hover:text-[#00f0ff] border border-[#1e2538] hover:border-[#00f0ff]/30 transition-all cursor-pointer"
          >
            Split + Numpad
          </button>
          <button
            onClick={() => handleApplyPreset('reviung')}
            className="px-2.5 py-1 rounded-lg text-xs font-mono bg-[#131722] hover:bg-[#1a2030] text-[#94a3b8] hover:text-[#00f0ff] border border-[#1e2538] hover:border-[#00f0ff]/30 transition-all cursor-pointer"
          >
            Unibody + Numpad
          </button>
          {!isEmpty && (
            <button
              onClick={() => onPlacedPartsChange({})}
              className="px-2.5 py-1 rounded-lg text-xs font-mono bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 transition-all cursor-pointer flex items-center gap-1 ml-1"
              title="Clear all parts to a clean slate"
            >
              <Trash2 size={12} />
              <span>Clear Slate</span>
            </button>
          )}
        </div>

        {/* Stats & Zoom */}
        <div className="flex items-center gap-3 ml-auto">
          <div className="hidden sm:flex items-center gap-2 text-xs font-mono text-[#94a3b8] bg-[#131722] px-2.5 py-1 rounded-lg border border-[#1e2538]">
            <span className="flex items-center gap-1">
              <Cpu size={12} className="text-[#00f0ff]" />
              <strong>{placedKeys.length}</strong> parts
            </span>
            <span className="text-[#1e2538]">|</span>
            <span className="flex items-center gap-1">
              <Layers size={12} className="text-[#a855f7]" />
              <strong>{totalKeys}</strong> keys
            </span>
            <span className="text-[#1e2538]">|</span>
            <span className="flex items-center gap-1">
              <Monitor size={12} className="text-[#00f0ff]" />
              <strong>{totalScreens}</strong> screens
            </span>
          </div>

          <div className="flex items-center gap-1 bg-[#131722] p-1 rounded-lg border border-[#1e2538]">
            <button
              onClick={() => setZoomScale((s) => Math.max(0.5, s - 0.1))}
              className="p-1 rounded text-[#94a3b8] hover:text-white hover:bg-[#1e2538] transition-colors cursor-pointer"
              title="Zoom out"
            >
              <ZoomOut size={14} />
            </button>
            <span className="text-[10px] font-mono text-[#64748b] px-1 min-w-9 text-center">
              {Math.round(zoomScale * 100)}%
            </span>
            <button
              onClick={() => setZoomScale((s) => Math.min(1.4, s + 0.1))}
              className="p-1 rounded text-[#94a3b8] hover:text-white hover:bg-[#1e2538] transition-colors cursor-pointer"
              title="Zoom in"
            >
              <ZoomIn size={14} />
            </button>
            <button
              onClick={() => setZoomScale(0.85)}
              className="p-1 rounded text-[#94a3b8] hover:text-white hover:bg-[#1e2538] transition-colors cursor-pointer"
              title="Reset zoom"
            >
              <Maximize2 size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Layout Displays Sync & Unassigned Displays Shelf */}
      <div className="border-b border-[#1e2538] px-4 py-2 bg-[#0a0d14] flex items-center justify-between gap-3 shrink-0 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-mono text-[#64748b] uppercase font-semibold flex items-center gap-1.5">
            <Monitor size={13} className="text-[#00f0ff]" />
            <span>Layout Displays ({assignedDisplaysCount}/{totalLayoutDisplaysCount} mounted):</span>
          </span>

          {unassignedDisplays.length === 0 ? (
            <span className="text-[10px] font-mono text-[#10b981] bg-[#10b981]/10 border border-[#10b981]/20 px-2 py-0.5 rounded-full flex items-center gap-1">
              ✓ All Layout Displays Mounted on Shields
            </span>
          ) : (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] font-mono text-[#fbbf24] bg-[#fbbf24]/10 border border-[#fbbf24]/20 px-2 py-0.5 rounded-full">
                {unassignedDisplays.length} Unassigned:
              </span>
              {unassignedDisplays.map((disp) => (
                <div
                  key={disp.id}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData(
                      'application/json',
                      JSON.stringify({
                        type: 'topology-oled-display',
                        fromCellKey: 'unassigned',
                        displayId: disp.id,
                      })
                    );
                    e.dataTransfer.effectAllowed = 'move';
                  }}
                  className="px-2.5 py-1 rounded-lg bg-[#141824] hover:bg-[#1a2030] border border-[#00f0ff]/30 hover:border-[#00f0ff] text-[#00f0ff] text-xs font-mono flex items-center gap-1.5 cursor-grab active:cursor-grabbing transition-all shadow-sm group select-none"
                  title="Drag this layout display onto any shield to mount it"
                >
                  <GripVertical size={12} className="text-[#64748b] group-hover:text-[#00f0ff]" />
                  <span>{disp.name}</span>
                  {disp.isMaster && (
                    <span className="text-[9px] font-bold bg-[#00f0ff]/20 px-1 rounded text-[#00f0ff] uppercase">
                      Master
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="text-[10px] font-mono text-[#64748b] flex items-center gap-1">
          <span>Tip: Drag an OLED screen to another shield to swap them</span>
        </div>
      </div>

      {/* Main Ever-Growing Canvas Viewport */}
      <div className="flex-1 overflow-auto p-8 relative flex items-center justify-center no-scrollbar">
        {isEmpty ? (
          /* Clean Slate: Initial Drop Zone */
          <div
            onDragOver={(e) => handleDragOver(e, '0,0')}
            onDragLeave={(e) => handleDragLeave(e, '0,0')}
            onDrop={(e) => handleDrop(e, 0, 0)}
            className={`max-w-md w-full border-2 border-dashed rounded-3xl p-10 flex flex-col items-center justify-center text-center transition-all ${
              hoveredDropSlot === '0,0'
                ? 'border-[#00f0ff] bg-[#00f0ff]/10 shadow-[0_0_30px_rgba(0,240,255,0.25)] scale-102'
                : 'border-[#1e2538] bg-[#131722]/60 hover:border-[#00f0ff]/40'
            }`}
          >
            <div className="size-16 rounded-2xl bg-[#00f0ff]/10 border border-[#00f0ff]/30 text-[#00f0ff] flex items-center justify-center mb-4 shadow-[0_0_20px_rgba(0,240,255,0.15)]">
              <Plus size={32} />
            </div>
            <h3 className="text-base font-bold text-white mb-1">
              Clean Slate Topology
            </h3>
            <p className="text-xs text-[#94a3b8] max-w-sm mb-6 leading-relaxed">
              Drag your first shield part from the palette on the right, or pick one of the presets above to assemble a multi-device ZMK network.
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleApplyPreset('corne')}
                className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-[#00f0ff]/15 text-[#00f0ff] border border-[#00f0ff]/30 hover:bg-[#00f0ff]/25 transition-all cursor-pointer shadow-sm"
              >
                Load Corne Split
              </button>
              <button
                onClick={() => handleApplyPreset('dongle-split')}
                className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-[#a855f7]/15 text-[#c084fc] border border-[#a855f7]/30 hover:bg-[#a855f7]/25 transition-all cursor-pointer shadow-sm"
              >
                Load Dongle Master
              </button>
            </div>
          </div>
        ) : (
          /* Active Dynamic Grid with Placed Parts & Adjacent (+ Up/Down/Left/Right) Drop Targets */
          <div
            className="flex flex-col items-center justify-center transition-transform"
            style={{
              gap: '24px',
              transform: `scale(${zoomScale})`,
              transformOrigin: 'center center',
            }}
          >
            {gridBounds.rows.map((rowY) => (
              <div key={`row-${rowY}`} className="flex items-center justify-center" style={{ gap: '24px' }}>
                {gridBounds.cols.map((colX) => {
                  const cellKey = `${colX},${rowY}`;
                  const placedInstance = placedParts[cellKey];
                  const isNeighbor = neighborSlots.has(cellKey);
                  const isHovered = hoveredDropSlot === cellKey;

                  if (placedInstance) {
                    const assignedDisplayId = effectiveDisplayAssignments[cellKey] ?? null;
                    const assignedDisplay = assignedDisplayId ? effectiveLayoutDisplays[assignedDisplayId] : null;

                    const displayConfigOverride = assignedDisplay
                      ? {
                          displayId: assignedDisplay.id,
                          displayName: assignedDisplay.name,
                          isMaster: assignedDisplay.isMaster,
                          blocks: assignedDisplay.blocks,
                          width: assignedDisplay.dimensions?.width,
                          height: assignedDisplay.dimensions?.height,
                        }
                      : assignedDisplayId === null
                      ? {
                          displayId: null,
                        }
                      : undefined;

                    const isMasterShield = effectiveMasterShieldKey === cellKey;
                    const isDisplayDropTarget = hoveredDisplayDropTarget === cellKey;

                    return (
                      <div key={cellKey} className="relative">
                        <TopologyPartRenderer
                          part={placedInstance.part}
                          x={colX}
                          y={rowY}
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
                          scale={0.7}
                          displayConfigOverride={displayConfigOverride}
                          isMasterShield={isMasterShield}
                          onSetMasterShield={() => handleSetMasterShield(cellKey)}
                          onDisplayDragStart={assignedDisplay ? (e) => handleDisplayDragStart(e, cellKey, assignedDisplay.id) : undefined}
                          onDisplayDrop={(e) => handleDisplayDropOnShield(e, cellKey)}
                          isDisplayDropTarget={isDisplayDropTarget}
                          onDelete={() => handleDeletePart(colX, rowY)}
                          onDragStart={(e) => {
                            e.dataTransfer.setData(
                              'application/json',
                              JSON.stringify({ moveFrom: { x: colX, y: rowY } })
                            );
                          }}
                          onKeystroke={onKeystroke}
                        />
                      </div>
                    );
                  }

                  if (isNeighbor) {
                    return (
                      <div
                        key={cellKey}
                        onDragOver={(e) => handleDragOver(e, cellKey)}
                        onDragLeave={(e) => handleDragLeave(e, cellKey)}
                        onDrop={(e) => handleDrop(e, colX, rowY)}
                        className={`flex flex-col items-center justify-center border-2 border-dashed rounded-2xl transition-all p-6 text-center cursor-pointer ${
                          isHovered
                            ? 'border-[#00f0ff] bg-[#00f0ff]/15 shadow-[0_0_24px_rgba(0,240,255,0.3)] scale-105'
                            : 'border-[#1e2538] bg-[#10141e]/50 hover:border-[#00f0ff]/50 hover:bg-[#131722]/80'
                        }`}
                        style={{
                          width: '260px',
                          minHeight: '220px',
                        }}
                        title={`Drop or attach part at (${colX}, ${rowY})`}
                      >
                        <div
                          className={`size-10 rounded-xl flex items-center justify-center mb-2 transition-all ${
                            isHovered
                              ? 'bg-[#00f0ff] text-black shadow-[0_0_12px_rgba(0,240,255,0.6)]'
                              : 'bg-[#1e2538] text-[#64748b] group-hover:text-[#00f0ff]'
                          }`}
                        >
                          <Plus size={20} />
                        </div>
                        <span className="text-xs font-bold text-[#94a3b8]">
                          Drop Shield Part
                        </span>
                        <span className="text-[10px] font-mono text-[#64748b] mt-0.5">
                          Position ({colX}, {rowY})
                        </span>
                      </div>
                    );
                  }

                  // Non-neighbor empty cell spacer (invisible placeholder)
                  return (
                    <div
                      key={cellKey}
                      style={{
                        width: '260px',
                        minHeight: '220px',
                      }}
                      className="opacity-0 pointer-events-none"
                    />
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

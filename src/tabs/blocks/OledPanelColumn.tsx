import React, { useRef, useEffect, useState, useCallback } from 'react';
import { BwpxGrid } from '../../bwpx/core/BwpxGrid';
import type { SpriteSlice, FontGlyph, FontCharMapping, LayoutBlock } from '../../types/zmk';
import type { DisplayWidgetDefinition } from '../../types/widget';
import {
  renderBlocksToGrid,
  getWidgetDefinition,
  normalizeWidgetType,
  getWidgetNaturalSize,
} from '../../services/widgetRegistry';
import {
  Eye,
  EyeOff,
  Trash2,
  MoveUp,
  MoveDown,
  RotateCcw,
  ArrowRightLeft,
} from 'lucide-react';

export interface OledPanelColumnProps {
  side: 'left' | 'right';
  screenKind?: 'active' | 'idle';
  title: string;
  subtitle: string;
  blocks: LayoutBlock[];
  onBlocksChange: (blocks: LayoutBlock[]) => void;
  onResetDefaults: () => void;
  onClearScreen: () => void;
  onMirror: () => void;
  mirrorButtonLabel: string;
  symbolsGrid: BwpxGrid;
  symbolSlices: SpriteSlice[];
  fontGrid: BwpxGrid;
  fontGlyphs?: FontGlyph[];
  fontMappings?: FontCharMapping[];
  customText: string;
  instances?: import('../../types/widget').WidgetInstanceMap;
  isDropTarget: boolean;
  dropTargetX?: number | null;
  dropTargetY: number | null;
  draggedWidget: DisplayWidgetDefinition | null;
  selectedBlockId: string | null;
  onSelectBlock: (id: string | null) => void;
  onRegisterScreenElement: (screenKey: string, el: HTMLDivElement | null) => void;
  screenDimensions?: { width: number; height: number };
  isCompact?: boolean;
  onExpand?: () => void;
}

const BLOCK_COLORS: Record<string, string> = {
  'status-bar': '#38bdf8',
  'battery': '#4ade80',
  'connection': '#60a5fa',
  'split': '#2dd4bf',
  'layer-banner': '#c084fc',
  'layer-art': '#34d399',
  'wpm': '#fbbf24',
  'branding': '#f472b6',
};

export const OledPanelColumn: React.FC<OledPanelColumnProps> = ({
  side,
  screenKind = 'active',
  title,
  subtitle,
  blocks,
  onBlocksChange,
  onResetDefaults,
  onClearScreen,
  onMirror,
  mirrorButtonLabel,
  symbolsGrid,
  symbolSlices,
  fontGrid,
  fontGlyphs = [],
  fontMappings = [],
  customText,
  instances,
  isDropTarget,
  dropTargetX,
  dropTargetY,
  draggedWidget,
  selectedBlockId,
  onSelectBlock,
  onRegisterScreenElement,
  screenDimensions,
  isCompact = false,
  onExpand,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const screenContainerRef = useRef<HTMLDivElement | null>(null);

  const [internalDraggingBlockId, setInternalDraggingBlockId] = useState<string | null>(null);
  const dragStartXRef = useRef<number>(0);
  const dragStartYRef = useRef<number>(0);
  const blockInitialXRef = useRef<number>(0);
  const blockInitialYRef = useRef<number>(0);

  const blocksRef = useRef(blocks);
  blocksRef.current = blocks;
  const onBlocksChangeRef = useRef(onBlocksChange);
  onBlocksChangeRef.current = onBlocksChange;

  const V_WIDTH = screenDimensions?.width || 32;
  const V_HEIGHT = screenDimensions?.height || 128;
  const screenKey = `${side}-${screenKind || 'active'}`;

  // Register screen element with parent for drag detection
  useEffect(() => {
    onRegisterScreenElement(screenKey, screenContainerRef.current);
    return () => {
      onRegisterScreenElement(screenKey, null);
    };
  }, [screenKey, onRegisterScreenElement]);

  // Render live 1bpp OLED canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const PIXEL_PITCH = 2; // Screen display scale
    const DOT_SIZE = 1.6;

    canvas.width = V_WIDTH * PIXEL_PITCH;
    canvas.height = V_HEIGHT * PIXEL_PITCH;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#06080d';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const vbuf = new BwpxGrid(V_WIDTH, V_HEIGHT);
    renderBlocksToGrid(blocks, vbuf, {
      symbolsGrid,
      symbolSlices,
      fontGrid,
      fontGlyphs,
      fontMappings,
      battery: 85,
      outputMode: 'usb',
      currentLayer: 0,
      layerNames: ['QWERTY', 'LOWER', 'RAISE', 'ADJUST'],
      wpm: 68,
      splitConnected: true,
      customText,
      side,
      instances,
    });

    for (let y = 0; y < V_HEIGHT; y++) {
      for (let x = 0; x < V_WIDTH; x++) {
        ctx.fillStyle = vbuf.get(x, y) ? '#e2f1ff' : '#0e131b';
        ctx.fillRect(x * PIXEL_PITCH, y * PIXEL_PITCH, DOT_SIZE, DOT_SIZE);
      }
    }
  }, [
    blocks,
    symbolsGrid,
    symbolSlices,
    fontGrid,
    fontGlyphs,
    fontMappings,
    customText,
    instances,
    side,
    V_WIDTH,
    V_HEIGHT,
  ]);

  const selectedBlock = blocks.find(b => b.id === selectedBlockId) || null;

  // Reorder block up/down
  const moveBlockOrder = (blockId: string, direction: -1 | 1) => {
    const index = blocks.findIndex(b => b.id === blockId);
    if (index === -1) return;
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= blocks.length) return;

    const next = [...blocks];
    const temp = next[index];
    next[index] = next[targetIndex];
    next[targetIndex] = temp;
    onBlocksChange(next);
  };

  // Update a single block's properties
  const updateBlock = useCallback(
    (blockId: string, patch: Partial<LayoutBlock>) => {
      onBlocksChangeRef.current(blocksRef.current.map(b => (b.id === blockId ? { ...b, ...patch } : b)));
    },
    []
  );

  // Delete a block
  const deleteBlock = useCallback((blockId: string) => {
    onBlocksChangeRef.current(blocksRef.current.filter(b => b.id !== blockId));
    if (selectedBlockId === blockId) {
      onSelectBlock(null);
    }
  }, [selectedBlockId, onSelectBlock]);

  // Keyboard shortcut to delete currently selected block
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedBlockId) return;
      const target = e.target as HTMLElement | null;
      if (
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable
      ) {
        return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        deleteBlock(selectedBlockId);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedBlockId, deleteBlock]);

  // Direct manipulation drag-to-move inside OLED panel (2D)
  const handleStartMoveBlock = (e: React.PointerEvent, block: LayoutBlock) => {
    e.stopPropagation();
    onSelectBlock(block.id);
    setInternalDraggingBlockId(block.id);
    dragStartXRef.current = e.clientX;
    dragStartYRef.current = e.clientY;
    const def = getWidgetDefinition(block.widgetType || block.id);
    blockInitialXRef.current = block.x ?? def?.defaultPlacement.defaultX ?? 0;
    blockInitialYRef.current = block.y;
  };

  // Window listeners for direct block move
  useEffect(() => {
    if (!internalDraggingBlockId) return;

    const screenEl = screenContainerRef.current;
    if (!screenEl) return;
    const rect = screenEl.getBoundingClientRect();
    const screenWidthPx = rect.width || 64;
    const screenHeightPx = rect.height || 256;
    const pxToGridX = V_WIDTH / screenWidthPx;
    const pxToGridY = V_HEIGHT / screenHeightPx;

    const handlePointerMove = (e: PointerEvent) => {
      const deltaScreenX = e.clientX - dragStartXRef.current;
      const deltaScreenY = e.clientY - dragStartYRef.current;
      const deltaGridX = Math.round(deltaScreenX * pxToGridX);
      const deltaGridY = Math.round(deltaScreenY * pxToGridY);

      if (internalDraggingBlockId) {
        const currentBlock = blocksRef.current.find(b => b.id === internalDraggingBlockId);
        if (!currentBlock) return;
        const normType = normalizeWidgetType(currentBlock.widgetType || currentBlock.id);
        const def = getWidgetDefinition(normType);
        
        const activeInstance = instances?.[normType]?.find(i => i.id === currentBlock.instanceId) || instances?.[normType]?.[0];
        const naturalSize = def ? getWidgetNaturalSize(def, symbolSlices, activeInstance) : null;
        
        const blockW = naturalSize ? naturalSize.width : (currentBlock.width ?? def?.defaultWidth ?? V_WIDTH);
        const blockH = naturalSize ? naturalSize.height : currentBlock.height;

        const newX = Math.max(0, Math.min(V_WIDTH - blockW, blockInitialXRef.current + deltaGridX));
        const newY = Math.max(0, Math.min(V_HEIGHT - blockH, blockInitialYRef.current + deltaGridY));

        const patch: Partial<LayoutBlock> = {};
        if (newX !== currentBlock.x) patch.x = newX;
        if (newY !== currentBlock.y) patch.y = newY;
        if (Object.keys(patch).length > 0) {
          updateBlock(internalDraggingBlockId, patch);
        }
      }
    };

    const handlePointerUp = () => {
      setInternalDraggingBlockId(null);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [internalDraggingBlockId, updateBlock, instances, symbolSlices]);

  const aspect = V_WIDTH / V_HEIGHT;
  let casingStyle: React.CSSProperties = {};
  if (isCompact) {
    if (aspect <= 1) {
      const h = 72;
      const w = Math.round(h * aspect);
      casingStyle = { width: `${Math.max(w, 22)}px`, height: `${h}px` };
    } else {
      const w = 84;
      const h = Math.round(w / aspect);
      casingStyle = { width: `${w}px`, height: `${Math.max(h, 26)}px` };
    }
  } else {
    if (aspect <= 0.6) {
      const h = 420;
      const w = Math.min(220, Math.round(h * aspect));
      casingStyle = { width: `${Math.max(w, 105)}px`, height: `${h}px` };
    } else if (aspect <= 1) {
      const h = 320;
      const w = Math.round(h * aspect);
      casingStyle = { width: `${Math.max(w, 140)}px`, height: `${h}px` };
    } else {
      const w = 240;
      const h = Math.min(240, Math.round(w / aspect));
      casingStyle = { width: `${w}px`, height: `${Math.max(h, 90)}px` };
    }
  }

  return (
    <div
      className={`oled-panel-column ${isCompact ? 'oled-panel-compact' : 'oled-panel-expanded'}`}
      onClick={isCompact ? onExpand : undefined}
    >
      {/* Column Header */}
      <div className="oled-panel-header">
        <div className="oled-panel-header-info">
          <div className="oled-panel-title flex items-center">
            <span>{title}</span>
            <span
              className="text-[9px] text-accent/80 font-mono ml-2 border border-accent/30 px-1.5 py-0.5 rounded bg-accent/5 transition-all duration-300"
              style={{
                opacity: isCompact ? 1 : 0,
                transform: isCompact ? 'translateX(0)' : 'translateX(-6px)',
                pointerEvents: isCompact ? 'auto' : 'none',
              }}
            >
              Click to edit
            </span>
          </div>
          <span className="oled-panel-subtitle">{subtitle}</span>
        </div>

        <div
          className="oled-panel-actions transition-all duration-300"
          style={{
            opacity: isCompact ? 0 : 1,
            transform: isCompact ? 'scale(0.85)' : 'scale(1)',
            pointerEvents: isCompact ? 'none' : 'auto',
          }}
        >
          <button
            className="btn-block-action"
            onClick={onResetDefaults}
            title="Reset default layout"
            tabIndex={isCompact ? -1 : 0}
          >
            <RotateCcw size={13} />
          </button>
          <button
            className="btn-block-action"
            onClick={onMirror}
            title={mirrorButtonLabel}
            tabIndex={isCompact ? -1 : 0}
          >
            <ArrowRightLeft size={13} />
          </button>
          <button
            className="btn-block-action danger"
            onClick={onClearScreen}
            title="Clear all blocks"
            tabIndex={isCompact ? -1 : 0}
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Screen & Interactive Direct Drag Area */}
      <div className="oled-screen-stage">
        <div
          className={`oled-screen-casing ${isDropTarget ? 'drop-target-active' : ''} ${isCompact ? 'cursor-pointer hover:border-accent/40 hover:shadow-lg hover:shadow-accent/5 transition-all' : ''}`}
          style={casingStyle}
          onClick={e => {
            if (isCompact) {
              e.stopPropagation();
              onExpand?.();
            } else {
              onSelectBlock(null);
            }
          }}
        >
          {/* OLED Glass Bezel Border */}
          <div ref={screenContainerRef} className="oled-screen-inner" style={{ width: '100%', height: '100%', position: 'relative' }}>
            <canvas
              ref={canvasRef}
              className="pixel-preview-canvas"
              style={{ width: '100%', height: '100%', display: 'block', pointerEvents: 'none' }}
            />

            {/* Placed block boundary overlays with smooth fade transition */}
            <div
              className="oled-block-overlays-container"
              style={{
                opacity: isCompact ? 0 : 1,
                pointerEvents: isCompact ? 'none' : 'auto',
                transition: 'opacity 0.25s ease',
              }}
            >
              {blocks.map(block => {
                const normType = normalizeWidgetType(block.widgetType || block.id);
                const def = getWidgetDefinition(normType);
                const color = BLOCK_COLORS[normType] || '#00d2ff';
                const isSelected = selectedBlockId === block.id;
                if (!block.enabled) return null;

                const activeInstance = instances?.[normType]?.find(i => i.id === block.instanceId) || instances?.[normType]?.[0];
                const naturalSize = def ? getWidgetNaturalSize(def, symbolSlices, activeInstance) : null;
                
                const blockX = block.x ?? def?.defaultPlacement.defaultX ?? 0;
                const blockW = naturalSize ? naturalSize.width : (block.width ?? def?.defaultWidth ?? V_WIDTH);
                const blockH = naturalSize ? naturalSize.height : block.height;

                const leftPct = (blockX / V_WIDTH) * 100;
                const topPct = (block.y / V_HEIGHT) * 100;
                const widthPct = (blockW / V_WIDTH) * 100;
                const heightPct = (blockH / V_HEIGHT) * 100;

                return (
                  <div
                    key={block.id}
                    className={`oled-block-overlay ${isSelected ? 'selected' : ''}`}
                    style={{
                      position: 'absolute',
                      left: `${leftPct}%`,
                      top: `${topPct}%`,
                      width: `${widthPct}%`,
                      height: `${heightPct}%`,
                      '--block-color': color,
                    } as React.CSSProperties}
                    onPointerDown={e => handleStartMoveBlock(e, block)}
                    onClick={e => {
                      e.stopPropagation();
                      onSelectBlock(block.id);
                    }}
                  />
                );
              })}
            </div>

            {/* Ghost Snapping Drop Guide during active drag */}
            {isDropTarget && dropTargetY !== null && draggedWidget && (() => {
              const guideSize = getWidgetNaturalSize(draggedWidget, symbolSlices);
              return (
                <div
                  className="oled-drop-guide"
                  style={{
                    left: `${(((dropTargetX ?? (draggedWidget.defaultPlacement.defaultX ?? 0))) / V_WIDTH) * 100}%`,
                    top: `${(dropTargetY / V_HEIGHT) * 100}%`,
                    width: `${(guideSize.width / V_WIDTH) * 100}%`,
                    height: `${(guideSize.height / V_HEIGHT) * 100}%`,
                  }}
                >
                  <span className="oled-drop-guide-label">
                    {draggedWidget.name}
                  </span>
                </div>
              );
            })()}
          </div>
        </div>
      </div>

      {/* Pure Drag Action Toolbar with smooth CSS Grid collapsible transition */}
      <div className={`oled-bottom-collapsible ${isCompact ? 'collapsed' : ''}`}>
        <div className="oled-bottom-inner">
          {selectedBlock ? (
            <div className="oled-block-toolbar">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="oled-selected-name truncate" title={selectedBlock.name}>
                  {selectedBlock.name}
                </span>
                {(() => {
                  const def = getWidgetDefinition(selectedBlock.widgetType || selectedBlock.id);
                  return def ? (
                    <span className={`tier-badge-pill tier-${def.tier}`}>
                      T{def.tier}
                    </span>
                  ) : null;
                })()}
              </div>
              <div className="oled-toolbar-actions">
                <button
                  className="btn-block-action"
                  onClick={() => updateBlock(selectedBlock.id, { enabled: !selectedBlock.enabled })}
                  title={selectedBlock.enabled ? 'Hide block' : 'Show block'}
                  tabIndex={isCompact ? -1 : 0}
                >
                  {selectedBlock.enabled ? <Eye size={13} /> : <EyeOff size={13} />}
                </button>
                <button
                  className="btn-block-action"
                  disabled={blocks.findIndex(b => b.id === selectedBlock.id) === blocks.length - 1}
                  onClick={() => moveBlockOrder(selectedBlock.id, 1)}
                  title="Bring forward in stack"
                  tabIndex={isCompact ? -1 : 0}
                >
                  <MoveUp size={13} />
                </button>
                <button
                  className="btn-block-action"
                  disabled={blocks.findIndex(b => b.id === selectedBlock.id) === 0}
                  onClick={() => moveBlockOrder(selectedBlock.id, -1)}
                  title="Send backward in stack"
                  tabIndex={isCompact ? -1 : 0}
                >
                  <MoveDown size={13} />
                </button>
                <button
                  className="btn-block-action danger"
                  onClick={() => deleteBlock(selectedBlock.id)}
                  title="Remove block"
                  tabIndex={isCompact ? -1 : 0}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ) : (
            <div className="oled-hint-text">
              Drag blocks to position
            </div>
          )}
        </div>
      </div>
    </div>
  );
};


import React, { useRef, useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
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
  Paintbrush,
  Undo2,
  Settings,
} from 'lucide-react';

export interface OledPanelColumnProps {
  side: 'left' | 'right';
  screenKind?: 'active' | 'idle';
  title?: string;
  subtitle?: string;
  blocks: LayoutBlock[];
  onBlocksChange: (blocks: LayoutBlock[]) => void;
  onResetDefaults?: () => void;
  onClearScreen: () => void;
  onUndo?: () => void;
  onToggleSettings?: () => void;
  isSettingsOpen?: boolean;
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
  layerNames?: string[];
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
  title: _title,
  subtitle: _subtitle,
  blocks,
  onBlocksChange,
  onResetDefaults: _onResetDefaults,
  onClearScreen,
  onUndo,
  onToggleSettings,
  isSettingsOpen = false,
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
  layerNames,
  isCompact = false,
  onExpand,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const screenContainerRef = useRef<HTMLDivElement | null>(null);

  const [internalDraggingBlockId, setInternalDraggingBlockId] = useState<string | null>(null);
  // Track screen hover to only show overlays and selection while hovering the screen
  const [isScreenHovered, setIsScreenHovered] = useState(false);
  // Track when an internal block drag exits the screen (for drag-out-to-remove)
  const [dragOutGhost, setDragOutGhost] = useState<{ blockId: string; clientX: number; clientY: number } | null>(null);

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

    ctx.fillStyle = '#05070a';
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
      layerNames: layerNames && layerNames.length > 0 ? layerNames : ['DEFAULT', 'LOWER', 'RAISE', 'ADJUST'],
      wpm: 68,
      splitConnected: true,
      customText,
      side,
      instances,
    });

    ctx.fillStyle = '#e2f1ff';
    for (let y = 0; y < V_HEIGHT; y++) {
      for (let x = 0; x < V_WIDTH; x++) {
        if (vbuf.get(x, y)) {
          ctx.fillRect(x * PIXEL_PITCH, y * PIXEL_PITCH, DOT_SIZE, DOT_SIZE);
        }
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

  // Context Menu State
  interface ContextMenuState {
    x: number;
    y: number;
    block: LayoutBlock | null;
  }
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const contextMenuRef = useRef<HTMLDivElement | null>(null);

  // Hit test coordinate against blocks (top-to-bottom of render stack)
  const getBlockAtCoords = useCallback((clientX: number, clientY: number): LayoutBlock | null => {
    const screenEl = screenContainerRef.current;
    if (!screenEl) return null;
    const rect = screenEl.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;

    const pxToGridX = V_WIDTH / rect.width;
    const pxToGridY = V_HEIGHT / rect.height;
    const gridX = (clientX - rect.left) * pxToGridX;
    const gridY = (clientY - rect.top) * pxToGridY;

    // Search from topmost block down
    for (let i = blocksRef.current.length - 1; i >= 0; i--) {
      const block = blocksRef.current[i];
      if (!block.enabled) continue;
      const normType = normalizeWidgetType(block.widgetType || block.id);
      const def = getWidgetDefinition(normType);
      const activeInstance = instances?.[normType]?.find(inst => inst.id === block.instanceId) || instances?.[normType]?.[0];
      const naturalSize = def ? getWidgetNaturalSize(def, symbolSlices, activeInstance, fontGlyphs, fontMappings) : null;
      
      const blockX = block.x ?? def?.defaultPlacement.defaultX ?? 0;
      const blockY = block.y;
      const blockW = naturalSize ? naturalSize.width : (block.width ?? def?.defaultWidth ?? V_WIDTH);
      const blockH = naturalSize ? naturalSize.height : block.height;

      if (gridX >= blockX && gridX <= blockX + blockW && gridY >= blockY && gridY <= blockY + blockH) {
        return block;
      }
    }
    return null;
  }, [V_WIDTH, V_HEIGHT, instances, symbolSlices, fontGlyphs, fontMappings]);

  // Context menu trigger handler
  const handleContextMenu = useCallback((e: React.MouseEvent, explicitBlock?: LayoutBlock) => {
    e.preventDefault();
    e.stopPropagation();

    if (isCompact) return;

    const targetBlock = explicitBlock || getBlockAtCoords(e.clientX, e.clientY);
    if (targetBlock) {
      onSelectBlock(targetBlock.id);
    }

    const menuWidth = 175;
    const menuHeight = targetBlock ? 150 : 95;
    const clampedX = Math.max(8, Math.min(e.clientX, window.innerWidth - menuWidth - 8));
    const clampedY = Math.max(8, Math.min(e.clientY, window.innerHeight - menuHeight - 8));

    setContextMenu({
      x: clampedX,
      y: clampedY,
      block: targetBlock,
    });
  }, [isCompact, getBlockAtCoords, onSelectBlock]);

  // Dismiss context menu on pointerdown outside or escape key
  useEffect(() => {
    if (!contextMenu) return;

    const handlePointerDown = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setContextMenu(null);
      }
    };

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [contextMenu]);

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

    // Generous padding so minor overshoots don't instantly trigger ghost
    const OUTSIDE_THRESHOLD = 40;

    const handlePointerMove = (e: PointerEvent) => {
      const deltaScreenX = e.clientX - dragStartXRef.current;
      const deltaScreenY = e.clientY - dragStartYRef.current;
      const deltaGridX = Math.round(deltaScreenX * pxToGridX);
      const deltaGridY = Math.round(deltaScreenY * pxToGridY);

      // Check if cursor is outside screen bounds
      const currentRect = screenContainerRef.current?.getBoundingClientRect() ?? rect;
      const isOutside =
        e.clientX < currentRect.left - OUTSIDE_THRESHOLD ||
        e.clientX > currentRect.right + OUTSIDE_THRESHOLD ||
        e.clientY < currentRect.top - OUTSIDE_THRESHOLD ||
        e.clientY > currentRect.bottom + OUTSIDE_THRESHOLD;

      if (isOutside) {
        // Show drag-out ghost, stop moving block
        setDragOutGhost({ blockId: internalDraggingBlockId, clientX: e.clientX, clientY: e.clientY });
        return;
      }

      // Inside screen — clear ghost and move normally
      setDragOutGhost(null);

      if (internalDraggingBlockId) {
        const currentBlock = blocksRef.current.find(b => b.id === internalDraggingBlockId);
        if (!currentBlock) return;
        const normType = normalizeWidgetType(currentBlock.widgetType || currentBlock.id);
        const def = getWidgetDefinition(normType);
        
        const activeInstance = instances?.[normType]?.find(i => i.id === currentBlock.instanceId) || instances?.[normType]?.[0];
        const naturalSize = def ? getWidgetNaturalSize(def, symbolSlices, activeInstance, fontGlyphs, fontMappings) : null;
        
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

    const handlePointerUp = (e: PointerEvent) => {
      // If ghost is showing at pointer-up, remove the block
      const currentRect = screenContainerRef.current?.getBoundingClientRect() ?? rect;
      const isOutside =
        e.clientX < currentRect.left - OUTSIDE_THRESHOLD ||
        e.clientX > currentRect.right + OUTSIDE_THRESHOLD ||
        e.clientY < currentRect.top - OUTSIDE_THRESHOLD ||
        e.clientY > currentRect.bottom + OUTSIDE_THRESHOLD;

      if (isOutside && internalDraggingBlockId) {
        deleteBlock(internalDraggingBlockId);
      }

      setDragOutGhost(null);
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
  }, [internalDraggingBlockId, updateBlock, deleteBlock, instances, symbolSlices]);


  const aspect = V_WIDTH / V_HEIGHT;
  const screenBorder = isCompact ? 2 : 5;
  const showOverlays = (isScreenHovered || internalDraggingBlockId !== null || Boolean(isDropTarget && draggedWidget)) && !isCompact;

  let activeW = 95;
  let activeH = 380;

  if (isCompact) {
    if (aspect <= 1) {
      activeH = 64;
      activeW = Math.max(16, Math.round(activeH * aspect));
    } else {
      activeW = 80;
      activeH = Math.max(16, Math.round(activeW / aspect));
    }
  } else {
    if (aspect <= 0.6) {
      activeH = 380;
      activeW = Math.round(activeH * aspect);
    } else if (aspect <= 1) {
      activeH = 280;
      activeW = Math.round(activeH * aspect);
    } else {
      activeW = 240;
      activeH = Math.max(40, Math.round(activeW / aspect));
    }
  }

  // Casing dimensions = active dimensions + screen border on both sides + casing padding & border (12px total)
  const casingWidth = activeW + screenBorder * 2 + 12;
  const casingHeight = activeH + screenBorder * 2 + 12;
  const casingStyle: React.CSSProperties = {
    width: `${casingWidth}px`,
    height: `${casingHeight}px`,
  };

  return (
    <div
      className={`oled-panel-column ${isCompact ? 'oled-panel-compact' : 'oled-panel-expanded'}`}
      onClick={isCompact ? onExpand : undefined}
    >
      {/* Column Header */}
      <div className="oled-panel-header">
        <div className="oled-panel-header-info">
          <div className="oled-panel-title flex items-center">
            <span>{side === 'left' ? 'Master' : 'Peripheral'}</span>
            {screenKind === 'idle' && (
              <span className="text-[9px] text-[#94a3b8] font-mono ml-1.5 border border-[#94a3b8]/25 px-1.5 py-0.5 rounded bg-[#94a3b8]/5">
                idle
              </span>
            )}
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
        </div>

        <div
          className="oled-panel-actions transition-all duration-300"
          style={{
            opacity: isCompact ? 0 : 1,
            transform: isCompact ? 'scale(0.85)' : 'scale(1)',
            pointerEvents: isCompact ? 'none' : 'auto',
          }}
        >
          {onToggleSettings && (
            <button
              className={`btn-block-action ${isSettingsOpen ? (side === 'right' ? 'active-purple' : 'active') : ''}`}
              onClick={e => {
                e.stopPropagation();
                onToggleSettings();
              }}
              title={isSettingsOpen ? 'Close Settings' : `${side === 'left' ? 'Master' : 'Peripheral'} Display & Power Settings`}
              aria-label={`${side === 'left' ? 'Master' : 'Peripheral'} Settings`}
              tabIndex={isCompact ? -1 : 0}
            >
              <Settings size={13} className={isSettingsOpen ? 'text-inherit' : ''} />
            </button>
          )}
          {onUndo && (
            <button
              className="btn-block-action"
              onClick={e => { e.stopPropagation(); onUndo(); }}
              title="Undo last action (Ctrl+Z)"
              tabIndex={isCompact ? -1 : 0}
            >
              <Undo2 size={13} />
            </button>
          )}
          <button
            className="btn-block-action danger"
            onClick={onClearScreen}
            title="Clear all widgets"
            tabIndex={isCompact ? -1 : 0}
          >
            <Paintbrush size={13} />
          </button>
        </div>
      </div>


      {/* Screen & Interactive Direct Drag Area */}
      <div className="oled-screen-stage">
        <div
          className={`oled-screen-casing ${isDropTarget ? 'drop-target-active' : ''} ${isCompact ? 'cursor-pointer hover:border-accent/40 hover:shadow-lg hover:shadow-accent/5 transition-all' : ''}`}
          style={casingStyle}
          onMouseEnter={() => !isCompact && setIsScreenHovered(true)}
          onMouseLeave={() => setIsScreenHovered(false)}
          onClick={e => {
            if (isCompact) {
              e.stopPropagation();
              onExpand?.();
            } else {
              onSelectBlock(null);
            }
          }}
          onContextMenu={e => handleContextMenu(e)}
        >
          {/* OLED Glass Bezel Border (5 units fake border) */}
          <div
            className={`oled-screen-inner ${showOverlays ? 'highlight-border' : ''}`}
            style={{
              width: '100%',
              height: '100%',
              position: 'relative',
              padding: `${screenBorder}px`,
              boxSizing: 'border-box',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#05070a',
              borderColor: 'transparent',
            }}
          >
            <div
              ref={screenContainerRef}
              className="oled-screen-active-area"
              style={{
                width: `${activeW}px`,
                height: `${activeH}px`,
                position: 'relative',
                flexShrink: 0,
                backgroundColor: '#05070a',
                boxShadow: showOverlays ? '0 0 0 1px #ffffff' : 'none',
                transition: 'box-shadow 0.15s ease',
              }}
            >
              <canvas
                ref={canvasRef}
                className="pixel-preview-canvas"
                style={{ width: '100%', height: '100%', display: 'block', pointerEvents: 'none' }}
              />

              {/* Placed block boundary overlays with smooth fade transition */}
              <div
                className={`oled-block-overlays-container oled-layout-overlays ${internalDraggingBlockId ? 'is-dragging' : ''} ${isScreenHovered ? 'screen-hovered' : ''}`}
                style={{
                  position: 'absolute',
                  inset: 0,
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
                const naturalSize = def ? getWidgetNaturalSize(def, symbolSlices, activeInstance, fontGlyphs, fontMappings) : null;
                
                const blockX = block.x ?? def?.defaultPlacement.defaultX ?? 0;
                const blockW = naturalSize ? naturalSize.width : (block.width ?? def?.defaultWidth ?? V_WIDTH);
                const blockH = naturalSize ? naturalSize.height : block.height;

                const leftPct = (blockX / V_WIDTH) * 100;
                const topPct = (block.y / V_HEIGHT) * 100;
                const widthPct = (blockW / V_WIDTH) * 100;
                const heightPct = (blockH / V_HEIGHT) * 100;

                const isPeripheralMaster = side === 'right' && !!def?.requiresMaster;

                return (
                  <div
                    key={block.id}
                    className={`oled-block-overlay ${isSelected ? 'selected' : ''}`}
                    title={block.name}
                    style={{
                      position: 'absolute',
                      left: `${leftPct}%`,
                      top: `${topPct}%`,
                      width: `${widthPct}%`,
                      height: `${heightPct}%`,
                      '--block-color': color,
                      opacity: showOverlays ? 1 : 0,
                      pointerEvents: isCompact ? 'none' : 'auto',
                      transition: 'opacity 0.15s ease',
                    } as React.CSSProperties}
                    onPointerDown={e => handleStartMoveBlock(e, block)}
                    onClick={e => {
                      e.stopPropagation();
                      onSelectBlock(block.id);
                    }}
                    onContextMenu={e => handleContextMenu(e, block)}
                  >
                    {isPeripheralMaster && (
                      <div
                        className="absolute top-1 right-1 z-30 group/warn cursor-help pointer-events-auto flex items-center justify-center"
                        title="may not work as intended"
                        onClick={e => e.stopPropagation()}
                      >
                        <div className="size-4 rounded-full bg-[#f2741d] text-[#0b0d13] font-black text-[10px] flex items-center justify-center shadow-[0_0_8px_rgba(242,116,29,0.9)] border border-[#0b0d13] leading-none select-none transition-transform group-hover/warn:scale-110">
                          !
                        </div>
                        {/* Hover tooltip */}
                        <div className="pointer-events-none opacity-0 group-hover/warn:opacity-100 transition-all duration-150 transform group-hover/warn:translate-y-0 translate-y-1 absolute bottom-full right-1/2 translate-x-1/2 mb-1.5 px-2 py-1 bg-[#131722] border border-[#f2741d]/70 text-white text-[10px] font-sans font-medium rounded shadow-[0_4px_16px_rgba(0,0,0,0.9),0_0_8px_rgba(242,116,29,0.2)] whitespace-nowrap z-50">
                          may not work as intended
                          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-[1px] border-4 border-transparent border-t-[#131722]" />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Ghost Snapping Drop Guide during active drag */}
            {isDropTarget && dropTargetY !== null && draggedWidget && (() => {
              const guideSize = getWidgetNaturalSize(draggedWidget, symbolSlices, undefined, fontGlyphs, fontMappings);
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
      </div>

      {/* Right-click Context Menu */}
      {contextMenu && typeof document !== 'undefined' && createPortal(
        <div
          ref={contextMenuRef}
          className="fixed z-[9999] min-w-[168px] bg-[#11141e]/95 backdrop-blur-md border border-[#232c3f] rounded-xl shadow-[0_12px_32px_rgba(0,0,0,0.85),0_0_16px_rgba(0,210,255,0.08)] py-1.5 px-1 text-xs text-[#cbd5e1] animate-in fade-in zoom-in-95 duration-75 select-none"
          style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
          onClick={e => e.stopPropagation()}
          onContextMenu={e => e.preventDefault()}
        >
          <div className="px-2.5 py-1 text-[10px] font-mono font-semibold uppercase tracking-wider text-[#64748b] truncate flex items-center justify-between">
            <span className="truncate">{contextMenu.block ? contextMenu.block.name : (side === 'left' ? 'Master' : 'Peripheral')}</span>
            {contextMenu.block && (
              <span
                className="size-2 rounded-full shrink-0 ml-1.5"
                style={{ backgroundColor: BLOCK_COLORS[normalizeWidgetType(contextMenu.block.widgetType || contextMenu.block.id)] || '#00d2ff' }}
              />
            )}
          </div>
          <div className="h-px bg-[#1e2538] my-1" />

          {contextMenu.block ? (
            <>
              <button
                type="button"
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-xs font-medium text-red-400 hover:text-white hover:bg-red-500/20 transition-colors cursor-pointer"
                onClick={() => {
                  deleteBlock(contextMenu.block!.id);
                  setContextMenu(null);
                }}
              >
                <Trash2 size={13} className="shrink-0 text-red-400" />
                <span>Remove</span>
              </button>

              <button
                type="button"
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-xs text-[#94a3b8] hover:text-white hover:bg-[#1e2538] transition-colors cursor-pointer"
                onClick={() => {
                  updateBlock(contextMenu.block!.id, { enabled: !contextMenu.block!.enabled });
                  setContextMenu(null);
                }}
              >
                {contextMenu.block.enabled ? <EyeOff size={13} className="shrink-0" /> : <Eye size={13} className="shrink-0" />}
                <span>{contextMenu.block.enabled ? 'Hide' : 'Show'}</span>
              </button>

              <button
                type="button"
                disabled={blocks.findIndex(b => b.id === contextMenu.block!.id) === blocks.length - 1}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-xs text-[#94a3b8] hover:text-white hover:bg-[#1e2538] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-[#94a3b8]"
                onClick={() => {
                  moveBlockOrder(contextMenu.block!.id, 1);
                  setContextMenu(null);
                }}
              >
                <MoveUp size={13} className="shrink-0" />
                <span>Bring Forward</span>
              </button>

              <button
                type="button"
                disabled={blocks.findIndex(b => b.id === contextMenu.block!.id) === 0}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-xs text-[#94a3b8] hover:text-white hover:bg-[#1e2538] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-[#94a3b8]"
                onClick={() => {
                  moveBlockOrder(contextMenu.block!.id, -1);
                  setContextMenu(null);
                }}
              >
                <MoveDown size={13} className="shrink-0" />
                <span>Send Backward</span>
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-xs font-medium text-red-400 hover:text-white hover:bg-red-500/20 transition-colors cursor-pointer"
                onClick={() => {
                  onClearScreen();
                  setContextMenu(null);
                }}
              >
                <Paintbrush size={13} className="shrink-0 text-red-400" />
                <span>Clear All Widgets</span>
              </button>
            </>
          )}
        </div>,
        document.body
      )}

      {/* Drag-out-to-remove orange ghost overlay */}
      {dragOutGhost && typeof document !== 'undefined' && createPortal(
        <div
          style={{
            position: 'fixed',
            left: dragOutGhost.clientX - 20,
            top: dragOutGhost.clientY - 20,
            width: 40,
            height: 40,
            pointerEvents: 'none',
            zIndex: 9998,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            gap: 4,
          }}
        >
          {/* Orange ghost circle */}
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: 'rgba(242, 116, 29, 0.18)',
              border: '2px dashed #f2741d',
              boxShadow: '0 0 16px rgba(242, 116, 29, 0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Trash2 size={14} style={{ color: '#f2741d', opacity: 0.9 }} />
          </div>
          <div
            style={{
              fontSize: 10,
              fontFamily: 'inherit',
              fontWeight: 600,
              color: '#f2741d',
              background: 'rgba(15,17,24,0.85)',
              borderRadius: 4,
              padding: '1px 6px',
              whiteSpace: 'nowrap',
              border: '1px solid rgba(242,116,29,0.35)',
              letterSpacing: '0.03em',
            }}
          >
            Release to remove
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};



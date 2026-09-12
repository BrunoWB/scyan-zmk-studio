import React, { useState, useRef, useEffect, useCallback } from 'react';
import { BwpxGrid } from '../core/BwpxGrid';
import {
  drawLine,
  drawRect,
  drawEllipse,
  drawTriangle,
  drawDiamond,
  drawStar,
  drawArrow,
  drawPlus,
  floodFill,
  drawBrushDot,
} from '../core/algorithms';
import {
  Undo2,
  Redo2,
  Pencil,
  Eraser,
  PaintBucket,
  MousePointer2,
  Move,
  Minus,
  Square,
  Circle,
  Triangle,
  Sparkles,
  ArrowRight,
  Plus,
  RotateCw,
  FlipHorizontal,
  FlipVertical,
  Maximize2,
  Upload,
  FileCode,
  Check,
  Copy,
} from 'lucide-react';
import type { SpriteSlice } from '../../types/zmk';
import { renderBwpxCanvas } from '../core/gridRenderer';
import { ImageImportModal } from './ImageImportModal';
import { CanvasContextMenu } from './CanvasContextMenu';
import { findAvailableSpot } from '../core/canvasPacking';
import './BwpxEditor.css';

export type ToolType =
  | 'pencil'
  | 'eraser'
  | 'bucket'
  | 'select'
  | 'move'
  | 'line'
  | 'rect'
  | 'filled-rect'
  | 'ellipse'
  | 'filled-ellipse'
  | 'triangle'
  | 'filled-triangle'
  | 'diamond'
  | 'star'
  | 'arrow'
  | 'plus';

export const ZOOM_STEPS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 40, 48, 56, 64];

export function calculateZoomAtPoint(
  prevZoom: number,
  prevPan: { x: number; y: number },
  mouseX: number,
  mouseY: number,
  step: number,
  zoomSteps: number[] = ZOOM_STEPS
): { zoom: number; pan: { x: number; y: number } } {
  let closestIdx = 0;
  let minDiff = Infinity;
  for (let i = 0; i < zoomSteps.length; i++) {
    const diff = Math.abs(zoomSteps[i] - prevZoom);
    if (diff < minDiff) {
      minDiff = diff;
      closestIdx = i;
    }
  }

  const nextIdx = Math.max(0, Math.min(zoomSteps.length - 1, closestIdx + step));
  const nextZoom = zoomSteps[nextIdx];

  if (nextZoom === prevZoom) {
    return { zoom: prevZoom, pan: prevPan };
  }

  const nextPan = {
    x: Math.round(mouseX - ((mouseX - prevPan.x) * nextZoom) / prevZoom),
    y: Math.round(mouseY - ((mouseY - prevPan.y) * nextZoom) / prevZoom),
  };

  return { zoom: nextZoom, pan: nextPan };
}

export function calculateFitViewport(
  viewportWidth: number,
  viewportHeight: number,
  targetW: number = 128,
  targetH: number = 34,
  zoomSteps: number[] = ZOOM_STEPS
): { zoom: number; pan: { x: number; y: number } } {
  if (viewportWidth <= 0 || viewportHeight <= 0) {
    return { zoom: 10, pan: { x: 300, y: 200 } };
  }

  // Put origin (0, 0) in the center of the top-left quadrant of the viewport
  const pan = {
    x: Math.round(viewportWidth / 4),
    y: Math.round(viewportHeight / 4),
  };

  // Remaining space from origin (W/4, H/4) to right/bottom edges: 3/4 * W and 3/4 * H
  const availableW = viewportWidth * 0.75 - 40;
  const availableH = viewportHeight * 0.75 - 40;
  const rawFitZoom = Math.min(18, Math.max(4, Math.floor(Math.min(availableW / targetW, availableH / targetH))));

  // Snap to valid ZOOM_STEPS
  const snapZoom = [...zoomSteps].reverse().find(z => z <= rawFitZoom) ?? 4;

  return { zoom: snapZoom, pan };
}

export interface EditorViewport {
  zoom: number;
  pan: { x: number; y: number };
}

export interface HistoryEntry {
  grid: BwpxGrid;
  selection: { x: number; y: number; w: number; h: number; active: boolean } | null;
  sliceUpdates?: { id: string; prevX: number; prevY: number; newX: number; newY: number }[];
}

export interface BwpxEditorProps {
  initialWidth?: number;
  initialHeight?: number;
  initialGrid?: BwpxGrid;
  onGridChange?: (grid: BwpxGrid) => void;
  title?: string;
  showPresets?: boolean;
  slices?: SpriteSlice[];
  selectedSliceId?: string;
  selectedSliceIds?: string[];
  pendingSelection?: { x: number; y: number; width: number; height: number } | null;
  onSelectSlice?: (id: string, isMulti?: boolean) => void;
  onSelectSlices?: (ids: string[]) => void;
  onNewSelection?: (rect: { x: number; y: number; width: number; height: number } | null) => void;
  onSliceMove?: (sliceId: string, newX: number, newY: number) => void;
  onSlicesMove?: (updates: { id: string; dx: number; dy: number }[]) => void;
  onAddSlices?: (slices: SpriteSlice[]) => void;
  onSlicesChange?: (slices: SpriteSlice[]) => void;
  externalTool?: ToolType;
  initialViewport?: EditorViewport;
  onViewportChange?: (viewport: EditorViewport) => void;
}

export const BwpxEditor: React.FC<BwpxEditorProps> = ({
  initialWidth = 128,
  initialHeight = 34,
  initialGrid,
  onGridChange,
  title: _title = '',
  showPresets = true,
  slices = [],
  selectedSliceId = '',
  selectedSliceIds = [],
  pendingSelection = null,
  onSelectSlice,
  onSelectSlices,
  onNewSelection,
  onSliceMove,
  onSlicesMove,
  onAddSlices,
  onSlicesChange,
  externalTool,
  initialViewport,
  onViewportChange,
}) => {
  const [grid, setGrid] = useState<BwpxGrid>(
    () => initialGrid?.clone() ?? new BwpxGrid(initialWidth, initialHeight)
  );
  const [history, setHistory] = useState<HistoryEntry[]>([
    { grid: initialGrid?.clone() ?? new BwpxGrid(initialWidth, initialHeight), selection: null },
  ]);
  const [historyIndex, setHistoryIndex] = useState<number>(0);

  const historyRef = useRef<HistoryEntry[]>([
    { grid: initialGrid?.clone() ?? new BwpxGrid(initialWidth, initialHeight), selection: null },
  ]);
  const historyIndexRef = useRef<number>(0);

  const [activeTool, setActiveTool] = useState<ToolType>(externalTool || 'pencil');

  useEffect(() => {
    if (externalTool) {
      setActiveTool(externalTool);
    }
  }, [externalTool]);
  const [brushSize, setBrushSize] = useState<number>(1);
  const [viewport, setViewport] = useState<EditorViewport>(
    () => initialViewport ?? {
      zoom: 10,
      pan: { x: 300, y: 200 },
    }
  );
  const { zoom, pan } = viewport;

  const onViewportChangeRef = useRef(onViewportChange);
  onViewportChangeRef.current = onViewportChange;

  const setPan = useCallback((action: { x: number; y: number } | ((prev: { x: number; y: number }) => { x: number; y: number })) => {
    setViewport(v => {
      const nextPan = typeof action === 'function' ? action(v.pan) : action;
      panRef.current = nextPan;
      const nextViewport = { ...v, pan: nextPan };
      onViewportChangeRef.current?.(nextViewport);
      return nextViewport;
    });
  }, []);

  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [drawButton, setDrawButton] = useState<number>(0);
  const drawButtonRef = useRef<number>(0);
  const wasErasingRef = useRef<boolean>(false);
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);
  const [isSpaceHeld, setIsSpaceHeld] = useState<boolean>(false);
  const [dragCurrentPos, setDragCurrentPos] = useState<{ x: number; y: number } | null>(null);

  // Dynamic tool activation via modifier keys
  const [isControlHeld, setIsControlHeld] = useState<boolean>(false);
  const isControlHeldRef = useRef<boolean>(false);
  const [isShiftHeld, setIsShiftHeld] = useState<boolean>(false);
  const isShiftHeldRef = useRef<boolean>(false);
  const [quickMoveMode, setQuickMoveMode] = useState<'drag' | 'zone-select' | null>(null);

  const lastDrawPosRef = useRef<{ x: number; y: number } | null>(null);
  const strokeModifiedRef = useRef<boolean>(false);

  // Selection state
  const [selection, setSelection] = useState<{
    x: number;
    y: number;
    w: number;
    h: number;
    active: boolean;
  } | null>(null);

  // Moving pixels with ghost preview during drag
  const [movingPixels, setMovingPixels] = useState<{
    originalRect: { x: number; y: number; w: number; h: number };
    pixels: [number, number][]; // relative coords [relX, relY]
    offset: { dx: number; dy: number };
    active: boolean;
    sliceRects?: { x: number; y: number; w: number; h: number }[];
  } | null>(null);
  const [isInsideSelectionOnDown, setIsInsideSelectionOnDown] = useState<boolean>(false);

  const [isPanning, setIsPanning] = useState<boolean>(false);
  
  // Internal clipboard for canvas pixel copy
  const internalClipboardRef = useRef<{
    width: number;
    height: number;
    pixels: [number, number][];
    copiedAt: number;
  } | null>(null);
  const lastBlurTimeRef = useRef<number>(0);

  const [panStart, setPanStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const wheelDeltaRef = useRef<number>(0);
  void wheelDeltaRef;

  const [modalContent, setModalContent] = useState<{ title: string; text: string } | null>(null);
  const [copiedNotification, setCopiedNotification] = useState<boolean>(false);

  // Floating ghost placement for imported images
  const [ghostPlacement, setGhostPlacement] = useState<{
    grid: BwpxGrid;
    width: number;
    height: number;
    pixels: [number, number][];
    x: number;
    y: number;
  } | null>(null);

  // Image Import Modal & Context Menu states
  const [importModalOpen, setImportModalOpen] = useState<boolean>(false);
  const [pendingImageSource, setPendingImageSource] = useState<File | Blob | string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Sync when initialGrid changes from outside (e.g. discard changes or repo sync)
  const lastCommittedRef = useRef<BwpxGrid | null>(null);
  useEffect(() => {
    if (initialGrid && initialGrid !== lastCommittedRef.current) {
      const cloned = initialGrid.clone();
      historyRef.current = [{ grid: cloned.clone(), selection: null }];
      historyIndexRef.current = 0;
      setGrid(cloned);
      setHistory([{ grid: cloned.clone(), selection: null }]);
      setHistoryIndex(0);
    }
  }, [initialGrid]);

  // Sync selection when selectedSliceId changes from inspector or outside
  useEffect(() => {
    if (isDrawing || movingPixels) return;
    if (pendingSelection) {
      setSelection({
        x: pendingSelection.x,
        y: pendingSelection.y,
        w: pendingSelection.width,
        h: pendingSelection.height,
        active: true,
      });
      return;
    }
    if (selectedSliceIds && selectedSliceIds.length > 0 && slices && slices.length > 0) {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      selectedSliceIds.forEach(id => {
         const s = slices.find(item => item.id === id);
         if (s) {
           minX = Math.min(minX, s.x);
           minY = Math.min(minY, s.y);
           maxX = Math.max(maxX, s.x + s.width);
           maxY = Math.max(maxY, s.y + s.height);
         }
      });
      if (minX !== Infinity) {
        setSelection({
          x: minX,
          y: minY,
          w: maxX - minX,
          h: maxY - minY,
          active: true,
        });
      }
    } else if (selectedSliceId && slices && slices.length > 0) {
      const s = slices.find(item => item.id === selectedSliceId);
      if (s) {
        setSelection({
          x: s.x,
          y: s.y,
          w: s.width,
          h: s.height,
          active: true,
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSliceId, selectedSliceIds ? selectedSliceIds.join(',') : '', slices, isDrawing, movingPixels, activeTool, pendingSelection]);

  const onSliceMoveRef = useRef(onSliceMove);
  onSliceMoveRef.current = onSliceMove;
  const onSlicesMoveRef = useRef(onSlicesMove);
  onSlicesMoveRef.current = onSlicesMove;

  const commitGridState = useCallback(
    (
      newGrid: BwpxGrid,
      explicitNewSelection?: { x: number; y: number; w: number; h: number; active: boolean } | null,
      sliceUpdates?: { id: string; prevX: number; prevY: number; newX: number; newY: number }[]
    ) => {
      lastCommittedRef.current = newGrid;
      const currentIdx = historyIndexRef.current;
      const nextHistory = historyRef.current.slice(0, currentIdx + 1);

      // Ensure the state before this action recorded whatever selection was active
      if (nextHistory[currentIdx]) {
        if (selectionRef.current && !nextHistory[currentIdx].selection) {
          nextHistory[currentIdx] = {
            ...nextHistory[currentIdx],
            selection: { ...selectionRef.current },
          };
        }
      }

      const finalSelection = explicitNewSelection !== undefined
        ? (explicitNewSelection ? { ...explicitNewSelection } : null)
        : (selectionRef.current ? { ...selectionRef.current } : null);

      nextHistory.push({
        grid: newGrid.clone(),
        selection: finalSelection,
        sliceUpdates,
      });

      historyRef.current = nextHistory;
      historyIndexRef.current = nextHistory.length - 1;
      setHistory(nextHistory);
      setHistoryIndex(nextHistory.length - 1);
      setGrid(newGrid);
      if (explicitNewSelection !== undefined) {
        setSelection(explicitNewSelection);
      }
      onGridChange?.(newGrid);
    },
    [onGridChange]
  );

  const handleUndo = useCallback(() => {
    const currentIdx = historyIndexRef.current;
    if (currentIdx > 0) {
      const currentEntry = historyRef.current[currentIdx];
      const nextIdx = currentIdx - 1;
      historyIndexRef.current = nextIdx;
      const targetEntry = historyRef.current[nextIdx];
      const nextGrid = targetEntry.grid.clone();
      lastCommittedRef.current = nextGrid;
      setHistoryIndex(nextIdx);
      setGrid(nextGrid);
      setSelection(targetEntry.selection ? { ...targetEntry.selection } : null);

      // If currentEntry had sliceUpdates, revert slices to original coordinates
      if (currentEntry.sliceUpdates && currentEntry.sliceUpdates.length > 0) {
        if (onSlicesMoveRef.current) {
          onSlicesMoveRef.current(
            currentEntry.sliceUpdates.map(u => ({
              id: u.id,
              dx: u.prevX - u.newX,
              dy: u.prevY - u.newY,
            }))
          );
        } else if (onSliceMoveRef.current) {
          currentEntry.sliceUpdates.forEach(u => {
            onSliceMoveRef.current?.(u.id, u.prevX, u.prevY);
          });
        }
      }

      onGridChange?.(nextGrid);
    }
  }, [onGridChange]);

  const handleRedo = useCallback(() => {
    const currentIdx = historyIndexRef.current;
    if (currentIdx < historyRef.current.length - 1) {
      const nextIdx = currentIdx + 1;
      historyIndexRef.current = nextIdx;
      const targetEntry = historyRef.current[nextIdx];
      const nextGrid = targetEntry.grid.clone();
      lastCommittedRef.current = nextGrid;
      setHistoryIndex(nextIdx);
      setGrid(nextGrid);
      setSelection(targetEntry.selection ? { ...targetEntry.selection } : null);

      // If targetEntry had sliceUpdates, re-apply them forward
      if (targetEntry.sliceUpdates && targetEntry.sliceUpdates.length > 0) {
        if (onSlicesMoveRef.current) {
          onSlicesMoveRef.current(
            targetEntry.sliceUpdates.map(u => ({
              id: u.id,
              dx: u.newX - u.prevX,
              dy: u.newY - u.prevY,
            }))
          );
        } else if (onSliceMoveRef.current) {
          targetEntry.sliceUpdates.forEach(u => {
            onSliceMoveRef.current?.(u.id, u.newX, u.newY);
          });
        }
      }

      onGridChange?.(nextGrid);
    }
  }, [onGridChange]);

  const gridRef = useRef<BwpxGrid>(grid);
  gridRef.current = grid;
  const panRef = useRef(pan);
  panRef.current = pan;
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const selectionRef = useRef(selection);
  selectionRef.current = selection;
  const movingPixelsRef = useRef(movingPixels);
  movingPixelsRef.current = movingPixels;
  const slicesRef = useRef(slices);
  slicesRef.current = slices;
  const selectedSliceIdsRef = useRef(selectedSliceIds);
  selectedSliceIdsRef.current = selectedSliceIds;
  const selectedSliceIdRef = useRef(selectedSliceId);
  selectedSliceIdRef.current = selectedSliceId;
  const ghostPlacementRef = useRef(ghostPlacement);
  ghostPlacementRef.current = ghostPlacement;
  const commitGridStateRef = useRef(commitGridState);
  commitGridStateRef.current = commitGridState;
  const onNewSelectionRef = useRef(onNewSelection);
  onNewSelectionRef.current = onNewSelection;
  const onSelectSliceRef = useRef(onSelectSlice);
  onSelectSliceRef.current = onSelectSlice;
  const onSelectSlicesRef = useRef(onSelectSlices);
  onSelectSlicesRef.current = onSelectSlices;
  const onAddSlicesRef = useRef(onAddSlices);
  onAddSlicesRef.current = onAddSlices;
  const onSlicesChangeRef = useRef(onSlicesChange);
  onSlicesChangeRef.current = onSlicesChange;

  // Clear free marquee selections when selection tool is deactivated
  const clearFreeSelections = useCallback(() => {
    const activeSliceIds = selectedSliceIdsRef.current?.length
      ? selectedSliceIdsRef.current
      : (selectedSliceIdRef.current ? [selectedSliceIdRef.current] : []);
    if (activeSliceIds.length === 0) {
      setSelection(null);
    }
    onNewSelectionRef.current?.(null);
  }, []);

  useEffect(() => {
    if (activeTool !== 'select') {
      clearFreeSelections();
    }
  }, [activeTool, clearFreeSelections]);

  // Center view on (0, 0) origin in the center top-left quadrant of the viewport
  const fitToView = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const targetW = initialWidth > 0 ? initialWidth : 128;
    const targetH = initialHeight > 0 ? initialHeight : 34;

    const { zoom: fitZoom, pan: newPan } = calculateFitViewport(
      rect.width,
      rect.height,
      targetW,
      targetH
    );

    const nextViewport = { zoom: fitZoom, pan: newPan };
    zoomRef.current = fitZoom;
    panRef.current = newPan;
    setViewport(nextViewport);
    onViewportChangeRef.current?.(nextViewport);
  }, [initialWidth, initialHeight]);

  // Reset to (0, 0) origin when entering the editor / mounting only if no initialViewport is provided
  useEffect(() => {
    if (initialViewport) return;
    fitToView();
    const timer = setTimeout(() => {
      fitToView();
    }, 40);
    return () => clearTimeout(timer);
  }, [fitToView, initialViewport]);

  // Coordinate conversion helper
  const getGridCoords = useCallback((clientX: number, clientY: number): { x: number; y: number } | null => {
    if (!canvasRef.current) return null;
    const rect = canvasRef.current.getBoundingClientRect();
    const canvasX = clientX - rect.left - pan.x;
    const canvasY = clientY - rect.top - pan.y;
    return {
      x: Math.floor(canvasX / zoom),
      y: Math.floor(canvasY / zoom),
    };
  }, [pan, zoom]);

  const pastePixelsAsGhost = useCallback((width: number, height: number, pixels: [number, number][]) => {
    const canvas = canvasRef.current;
    const pan = panRef.current;
    const zoom = zoomRef.current;
    let initialX = 0;
    let initialY = 0;
    if (canvas) {
      initialX = Math.round((-pan.x + canvas.width / 2) / zoom - width / 2);
      initialY = Math.round((-pan.y + canvas.height / 2) / zoom - height / 2);
    }
    const tempGrid = new BwpxGrid(width, height);
    pixels.forEach(([rx, ry]) => {
      tempGrid.set(rx, ry, 1);
    });
    setGhostPlacement({
      grid: tempGrid,
      width,
      height,
      pixels,
      x: initialX,
      y: initialY,
    });
  }, []);

  // Spacebar tracking, modifier keys, Undo/Redo, Copy, and Enter/Escape
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return;
      }

      if (e.key === 'Control' || e.key === 'Meta') {
        if (!isControlHeldRef.current) {
          isControlHeldRef.current = true;
          setIsControlHeld(true);
        }
      }
      if (e.key === 'Shift') {
        if (!isShiftHeldRef.current) {
          isShiftHeldRef.current = true;
          setIsShiftHeld(true);
        }
      }

      // Undo: Ctrl+Z / Cmd+Z (without Shift)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
        return;
      }

      // Redo: Ctrl+Y / Cmd+Y or Ctrl+Shift+Z / Cmd+Shift+Z
      if (
        ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && e.shiftKey) ||
        ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y')
      ) {
        e.preventDefault();
        handleRedo();
        return;
      }

      const selection = selectionRef.current;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        if (selection && selection.active) {
          const sIds = selectedSliceIdsRef.current?.length ? selectedSliceIdsRef.current : (selectedSliceIdRef.current ? [selectedSliceIdRef.current] : []);
          let pixels: [number, number][] = [];
          
          if (sIds.length > 0 && slicesRef.current) {
            sIds.forEach(id => {
              const s = slicesRef.current.find(item => item.id === id);
              if (s) {
                const slicePixels = gridRef.current.extractRect({
                  x: s.x,
                  y: s.y,
                  w: s.width,
                  h: s.height,
                });
                slicePixels.forEach(([rx, ry]) => {
                  pixels.push([s.x + rx - selection.x, s.y + ry - selection.y]);
                });
              }
            });
          } else {
            pixels = gridRef.current.extractRect({
              x: selection.x,
              y: selection.y,
              w: selection.w,
              h: selection.h,
            });
          }

          const clipPayload = {
            type: 'bwpx-pixels',
            width: selection.w,
            height: selection.h,
            pixels,
            copiedAt: Date.now(),
          };
          internalClipboardRef.current = clipPayload;

          try {
            navigator.clipboard.writeText(JSON.stringify(clipPayload));
          } catch (err) {
            console.warn('Could not write to system clipboard', err);
          }

          setCopiedNotification(true);
          setTimeout(() => setCopiedNotification(false), 2000);
          return;
        }
      }

      if (e.code === 'Space' && !e.repeat) {
        setIsSpaceHeld(true);
      }
      if (e.key === 'Escape') {
        const mp = movingPixelsRef.current;
        if (mp && mp.active) {
          const next = gridRef.current.clone();
          if (mp.sliceRects && mp.sliceRects.length > 0) {
            mp.sliceRects.forEach(sr => next.clearRect(sr));
          } else {
            next.clearRect(mp.originalRect);
          }
          mp.pixels.forEach(([rx, ry]) => {
            next.set(mp.originalRect.x + rx, mp.originalRect.y + ry, 1);
          });
          setGrid(next);
          setMovingPixels(null);
        }
        clearFreeSelections();
        setSelection(null);
        onSelectSliceRef.current?.('', false);
        onNewSelectionRef.current?.(null);
        setGhostPlacement(null);
        setContextMenu(null);
      }
      if (e.key === 'Enter') {
        const ghost = ghostPlacementRef.current;
        if (ghost) {
          const targetX = ghost.x;
          const targetY = ghost.y;
          const next = gridRef.current.clone();
          // Override beneath by clearing rect first
          next.clearRect({ x: targetX, y: targetY, w: ghost.width, h: ghost.height });
          ghost.pixels.forEach(([rx, ry]) => {
            next.set(targetX + rx, targetY + ry, 1);
          });
          commitGridStateRef.current(next);
          setSelection({
            x: targetX,
            y: targetY,
            w: ghost.width,
            h: ghost.height,
            active: true,
          });
          onNewSelectionRef.current?.({
            x: targetX,
            y: targetY,
            width: ghost.width,
            height: ghost.height,
          });
          setGhostPlacement(null);
        }
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpaceHeld(false);
      }
      if (e.key === 'Control' || e.key === 'Meta') {
        if (isControlHeldRef.current) {
          isControlHeldRef.current = false;
          setIsControlHeld(false);
        }
      }
      if (e.key === 'Shift') {
        if (isShiftHeldRef.current) {
          isShiftHeldRef.current = false;
          setIsShiftHeld(false);
        }
      }
    };

    const onBlur = () => {
      lastBlurTimeRef.current = Date.now();
      if (isControlHeldRef.current) {
        isControlHeldRef.current = false;
        setIsControlHeld(false);
      }
      if (isShiftHeldRef.current) {
        isShiftHeldRef.current = false;
        setIsShiftHeld(false);
      }
      setIsSpaceHeld(false);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [handleUndo, handleRedo]);

  // Global clipboard paste listener with canvas vs external image precedence
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return;
      }

      // 1. Check if clipboard text contains true canvas pixel copy (bwpx-pixels)
      const textData = e.clipboardData?.getData('text/plain');
      if (textData) {
        try {
          const parsed = JSON.parse(textData);
          if (parsed && parsed.type === 'bwpx-pixels' && Array.isArray(parsed.pixels)) {
            e.preventDefault();
            pastePixelsAsGhost(parsed.width, parsed.height, parsed.pixels);
            return;
          }
        } catch {
          // Not JSON, continue checking
        }
      }

      // 2. Check if internal canvas copy is newer than last external copy/blur
      if (internalClipboardRef.current && internalClipboardRef.current.copiedAt > lastBlurTimeRef.current) {
        e.preventDefault();
        pastePixelsAsGhost(
          internalClipboardRef.current.width,
          internalClipboardRef.current.height,
          internalClipboardRef.current.pixels
        );
        return;
      }

      // 3. Check for external image file in clipboard items
      const items = e.clipboardData?.items;
      if (items) {
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          if (item.type.startsWith('image/')) {
            const file = item.getAsFile();
            if (file) {
              e.preventDefault();
              setPendingImageSource(file);
              setImportModalOpen(true);
              return;
            }
          }
        }
      }

      // 4. Fallback to in-memory canvas pixels if available
      if (internalClipboardRef.current) {
        e.preventDefault();
        pastePixelsAsGhost(
          internalClipboardRef.current.width,
          internalClipboardRef.current.height,
          internalClipboardRef.current.pixels
        );
      }
    };

    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [pastePixelsAsGhost]);

  // Render canvas loop
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Render preview state if dragging a shape
    let displayGrid = grid;
    if (
      isDrawing &&
      startPos &&
      dragCurrentPos &&
      activeTool !== 'pencil' &&
      activeTool !== 'eraser' &&
      activeTool !== 'bucket' &&
      activeTool !== 'select'
    ) {
      const temp = grid.clone();
      const val = drawButton === 2 ? 0 : 1;
      switch (activeTool) {
        case 'line':
          drawLine(temp, startPos.x, startPos.y, dragCurrentPos.x, dragCurrentPos.y, val, brushSize);
          break;
        case 'rect':
          drawRect(temp, startPos.x, startPos.y, dragCurrentPos.x, dragCurrentPos.y, val, false, brushSize);
          break;
        case 'filled-rect':
          drawRect(temp, startPos.x, startPos.y, dragCurrentPos.x, dragCurrentPos.y, val, true, brushSize);
          break;
        case 'ellipse':
          drawEllipse(temp, startPos.x, startPos.y, dragCurrentPos.x, dragCurrentPos.y, val, false, brushSize);
          break;
        case 'filled-ellipse':
          drawEllipse(temp, startPos.x, startPos.y, dragCurrentPos.x, dragCurrentPos.y, val, true, brushSize);
          break;
        case 'triangle':
          drawTriangle(temp, startPos.x, startPos.y, dragCurrentPos.x, dragCurrentPos.y, val, false, brushSize);
          break;
        case 'filled-triangle':
          drawTriangle(temp, startPos.x, startPos.y, dragCurrentPos.x, dragCurrentPos.y, val, true, brushSize);
          break;
        case 'diamond':
          drawDiamond(temp, startPos.x, startPos.y, dragCurrentPos.x, dragCurrentPos.y, val, false, brushSize);
          break;
        case 'star':
          drawStar(temp, startPos.x, startPos.y, dragCurrentPos.x, dragCurrentPos.y, val, brushSize);
          break;
        case 'arrow':
          drawArrow(temp, startPos.x, startPos.y, dragCurrentPos.x, dragCurrentPos.y, val, brushSize);
          break;
        case 'plus':
          drawPlus(temp, startPos.x, startPos.y, dragCurrentPos.x, dragCurrentPos.y, val, brushSize);
          break;
      }
      displayGrid = temp;
    }

    const activeGhost =
      movingPixels && movingPixels.active
        ? {
            pixels: movingPixels.pixels,
            x: movingPixels.originalRect.x + movingPixels.offset.dx,
            y: movingPixels.originalRect.y + movingPixels.offset.dy,
            w: movingPixels.originalRect.w,
            h: movingPixels.originalRect.h,
            rects: movingPixels.sliceRects
              ? movingPixels.sliceRects.map(r => ({
                  x: r.x + movingPixels.offset.dx,
                  y: r.y + movingPixels.offset.dy,
                  w: r.w,
                  h: r.h,
                }))
              : undefined,
          }
        : ghostPlacement
        ? {
            pixels: ghostPlacement.pixels,
            x: ghostPlacement.x,
            y: ghostPlacement.y,
            w: ghostPlacement.width,
            h: ghostPlacement.height,
          }
        : null;

    renderBwpxCanvas(canvas, ctx, {
      grid: displayGrid,
      zoom,
      pan,
      pixelColor: '#ffffff',
      bgColor: '#0b0d11',
      showAxes: true,
      showGridLines: zoom >= 5,
      ghost: activeGhost,
      selection: !movingPixels || !movingPixels.active ? selection : null,
      slices,
      selectedSliceId,
      hoverPos: !isPanning ? hoverPos : null,
    });

    // Hover brush indicator (when not panning, not placing ghost, and using drawing tool)
    const isInteractingTool = isControlHeld || isShiftHeld || activeTool === 'select';
    if (hoverPos && !ghostPlacement && !isPanning && !isInteractingTool) {
      ctx.save();
      ctx.translate(Math.round(pan.x), Math.round(pan.y));
      const half = Math.floor(brushSize / 2);
      ctx.strokeStyle = 'rgba(0, 229, 163, 0.6)';
      ctx.lineWidth = 1;
      const bx = Math.round((hoverPos.x - half) * zoom);
      const by = Math.round((hoverPos.y - half) * zoom);
      const bw = Math.round((hoverPos.x - half + brushSize) * zoom) - bx;
      const bh = Math.round((hoverPos.y - half + brushSize) * zoom) - by;
      ctx.strokeRect(bx + 0.5, by + 0.5, bw, bh);
      ctx.restore();
    }
  }, [
    grid,
    pan,
    zoom,
    isDrawing,
    startPos,
    dragCurrentPos,
    activeTool,
    drawButton,
    brushSize,
    selection,
    movingPixels,
    ghostPlacement,
    slices,
    selectedSliceId,
    hoverPos,
    isPanning,
    isControlHeld,
    isShiftHeld,
  ]);

  useEffect(() => {
    renderCanvas();
  }, [renderCanvas]);

  // Handle Resize of canvas container with ResizeObserver
  useEffect(() => {
    const updateCanvasSize = () => {
      if (containerRef.current && canvasRef.current) {
        const w = containerRef.current.clientWidth;
        const h = containerRef.current.clientHeight;
        if (w > 0 && h > 0) {
          canvasRef.current.width = w;
          canvasRef.current.height = h;
          renderCanvas();
        }
      }
    };
    updateCanvasSize();
    const ro = new ResizeObserver(() => {
      updateCanvasSize();
    });
    if (containerRef.current) {
      ro.observe(containerRef.current);
    }
    window.addEventListener('resize', updateCanvasSize);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', updateCanvasSize);
    };
  }, [renderCanvas]);

  // Mouse Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    // Close context menu if open
    if (contextMenu) {
      setContextMenu(null);
    }

    // Ghost Placement mode for imported image
    if (ghostPlacement) {
      if (e.button === 0) {
        // Left click: stamp pixels onto grid, overriding what's beneath
        const targetX = ghostPlacement.x;
        const targetY = ghostPlacement.y;
        const next = grid.clone();
        next.clearRect({ x: targetX, y: targetY, w: ghostPlacement.width, h: ghostPlacement.height });
        ghostPlacement.pixels.forEach(([rx, ry]) => {
          next.set(targetX + rx, targetY + ry, 1);
        });
        commitGridState(next);
        setSelection({
          x: targetX,
          y: targetY,
          w: ghostPlacement.width,
          h: ghostPlacement.height,
          active: true,
        });
        onNewSelectionRef.current?.({
          x: targetX,
          y: targetY,
          width: ghostPlacement.width,
          height: ghostPlacement.height,
        });
        setGhostPlacement(null);
      } else if (e.button === 2) {
        // Right click: cancel ghost placement without modifying grid
        setGhostPlacement(null);
      }
      return;
    }

    // Middle click or spacebar -> Pan
    if (e.button === 1 || isSpaceHeld) {
      drawButtonRef.current = 0;
      setDrawButton(0);
      setIsPanning(true);
      setPanStart({ x: Math.round(e.clientX - pan.x), y: Math.round(e.clientY - pan.y) });
      return;
    }

    const coords = getGridCoords(e.clientX, e.clientY);
    if (!coords) return;

    // Quick move tool: activated by Shift key or shift click, or activeTool === 'move'
    const isQuickMove = isShiftHeldRef.current || e.shiftKey || activeTool === 'move';
    // Selection tool: activated by Control key or external tool, or activeTool === 'select'
    const isSelect = !isQuickMove && (isControlHeldRef.current || e.ctrlKey || e.metaKey || activeTool === 'select');

    // Right-clicking is an eraser ONLY when drawing tools are active (not select or quick-move):
    const isErasing = !isQuickMove && !isSelect && (e.button === 2 || activeTool === 'eraser');

    if (e.button === 2) {
      if (isSelect || isQuickMove) {
        // Cancel active drag or move if in progress
        if (isDrawing || movingPixels) {
          setIsDrawing(false);
          setStartPos(null);
          setDragCurrentPos(null);
          if (movingPixels) {
            const next = grid.clone();
            if (movingPixels.sliceRects && movingPixels.sliceRects.length > 0) {
              movingPixels.sliceRects.forEach(sr => next.clearRect(sr));
            } else {
              next.clearRect(movingPixels.originalRect);
            }
            movingPixels.pixels.forEach(([rx, ry]) => {
              next.set(movingPixels.originalRect.x + rx, movingPixels.originalRect.y + ry, 1);
            });
            setGrid(next);
            setMovingPixels(null);
          }
          wasErasingRef.current = true; // suppress context menu when right click cancels drag
        }
        drawButtonRef.current = 0;
        setDrawButton(0);
        return;
      }
    }

    if (isQuickMove) {
      drawButtonRef.current = 0;
      setDrawButton(0);
      wasErasingRef.current = false;
      // QUICK MOVE TOOL SPECIFICATIONS:
      // "when clicking with tool if a selection exists underneath add immedialy to active selections and starts drag of current active selections.
      // If clicking and dragging starts on empty starts outside a selection, on mouse up activate all selections in the zone"
      const clickedSlice = slicesRef.current?.find(
        s =>
          coords.x >= s.x &&
          coords.x < s.x + s.width &&
          coords.y >= s.y &&
          coords.y < s.y + s.height
      );
      const isInsideSel = Boolean(
        selection &&
        selection.active &&
        coords.x >= selection.x &&
        coords.x < selection.x + selection.w &&
        coords.y >= selection.y &&
        coords.y < selection.y + selection.h
      );

      if (clickedSlice || isInsideSel) {
        // A selection exists underneath!
        let currentIds = new Set<string>(selectedSliceIdsRef.current || []);
        if (clickedSlice) {
          currentIds.add(clickedSlice.id);
          const allIds = Array.from(currentIds);
          if (onSelectSlicesRef.current) {
            onSelectSlicesRef.current(allIds);
          } else {
            onSelectSliceRef.current?.(clickedSlice.id, true);
          }
        }

        // Calculate combined bounding box
        const activeSlices = (slicesRef.current || []).filter(s => currentIds.has(s.id));
        let selRect = selection;
        let sliceRects: { x: number; y: number; w: number; h: number }[] = [];

        if (activeSlices.length > 0) {
          let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
          activeSlices.forEach(s => {
            minX = Math.min(minX, s.x);
            minY = Math.min(minY, s.y);
            maxX = Math.max(maxX, s.x + s.width);
            maxY = Math.max(maxY, s.y + s.height);
            sliceRects.push({ x: s.x, y: s.y, w: s.width, h: s.height });
          });
          selRect = { x: minX, y: minY, w: maxX - minX, h: maxY - minY, active: true };
          setSelection(selRect);
        } else if (selRect) {
          sliceRects.push({ x: selRect.x, y: selRect.y, w: selRect.w, h: selRect.h });
        }

        if (selRect) {
          // Immediately start drag of current active selections
          let extracted: [number, number][] = [];
          const temp = grid.clone();

          if (sliceRects.length > 0) {
            sliceRects.forEach(sr => {
              const spx = grid.extractRect(sr);
              spx.forEach(([rx, ry]) => {
                extracted.push([sr.x + rx - selRect!.x, sr.y + ry - selRect!.y]);
              });
              temp.clearRect(sr);
            });
          } else {
            extracted = grid.extractRect(selRect);
            temp.clearRect(selRect);
          }

          setGrid(temp);
          setMovingPixels({
            originalRect: { ...selRect },
            pixels: extracted,
            offset: { dx: 0, dy: 0 },
            active: true,
            sliceRects,
          });
          setIsInsideSelectionOnDown(true);
          setIsDrawing(true);
          setStartPos(coords);
          setDragCurrentPos(coords);
          setQuickMoveMode('drag');
          return;
        }
      }

      // Started outside any selection: zone selection mode
      setQuickMoveMode('zone-select');
      setIsDrawing(true);
      setStartPos(coords);
      setDragCurrentPos(coords);
      setIsInsideSelectionOnDown(false);
      return;
    }

    if (isSelect) {
      drawButtonRef.current = 0;
      setDrawButton(0);
      wasErasingRef.current = false;
      const isInside = Boolean(
        selection &&
        selection.active &&
        coords.x >= selection.x &&
        coords.x < selection.x + selection.w &&
        coords.y >= selection.y &&
        coords.y < selection.y + selection.h
      );

      setIsDrawing(true);
      setStartPos(coords);
      setDragCurrentPos(coords);
      setIsInsideSelectionOnDown(isInside);
      return;
    }

    // Normal drawing or right-click erasing
    setIsDrawing(true);
    const btn = isErasing ? 2 : 0;
    drawButtonRef.current = btn;
    setDrawButton(btn);
    wasErasingRef.current = isErasing;
    setStartPos(coords);
    setDragCurrentPos(coords);
    lastDrawPosRef.current = coords;
    strokeModifiedRef.current = false;

    const val = isErasing ? 0 : 1;

    if (isErasing || activeTool === 'pencil') {
      const temp = grid.clone();
      drawBrushDot(temp, coords.x, coords.y, val, brushSize);
      strokeModifiedRef.current = true;
      setGrid(temp);
    } else if (activeTool === 'bucket') {
      const temp = grid.clone();
      floodFill(temp, coords.x, coords.y, val);
      commitGridState(temp);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setPan({
        x: Math.round(e.clientX - panStart.x),
        y: Math.round(e.clientY - panStart.y),
      });
      return;
    }

    const coords = getGridCoords(e.clientX, e.clientY);
    setHoverPos(prev => {
      if (!prev && !coords) return null;
      if (prev && coords && prev.x === coords.x && prev.y === coords.y) return prev;
      return coords;
    });

    if (!coords) return;

    // Track ghost placement position centered on cursor
    if (ghostPlacement) {
      setGhostPlacement(prev =>
        prev
          ? {
              ...prev,
              x: coords.x - Math.floor(prev.width / 2),
              y: coords.y - Math.floor(prev.height / 2),
            }
          : null
      );
      return;
    }

    // Quick move zone-select marquee drag
    if (isDrawing && quickMoveMode === 'zone-select' && startPos) {
      setDragCurrentPos(coords);
      const minX = Math.min(startPos.x, coords.x);
      const minY = Math.min(startPos.y, coords.y);
      const w = Math.abs(coords.x - startPos.x) + 1;
      const h = Math.abs(coords.y - startPos.y) + 1;
      setSelection({ x: minX, y: minY, w, h, active: true });
      return;
    }

    // Quick move drag or selection drag with active movingPixels
    if (movingPixels && isDrawing && startPos) {
      setDragCurrentPos(coords);
      const dx = coords.x - startPos.x;
      const dy = coords.y - startPos.y;
      setMovingPixels(prev => (prev ? { ...prev, offset: { dx, dy } } : null));
      setSelection(prev =>
        prev
          ? {
              ...prev,
              x: movingPixels.originalRect.x + dx,
              y: movingPixels.originalRect.y + dy,
            }
          : null
      );
      return;
    }

    const isErasing = drawButtonRef.current === 2;
    const isSelect = !isErasing && (isControlHeldRef.current || e.ctrlKey || e.metaKey || activeTool === 'select');

    if (isSelect) {
      if (isDrawing && startPos) {
        setDragCurrentPos(coords);
        const dx = coords.x - startPos.x;
        const dy = coords.y - startPos.y;
        const hasMoved = Math.abs(dx) > 0 || Math.abs(dy) > 0;

        if (isInsideSelectionOnDown && selection) {
          // Started drag inside active selection -> lift & move pixels
          if (!movingPixels && hasMoved) {
            let extracted: [number, number][] = [];
            const temp = grid.clone();
            const activeIds = selectedSliceIds?.length ? selectedSliceIds : (selectedSliceId ? [selectedSliceId] : []);
            let sliceRects: { x: number; y: number; w: number; h: number }[] = [];

            if (activeIds.length > 0 && slices) {
              activeIds.forEach(id => {
                const s = slices.find(item => item.id === id);
                if (s) {
                  sliceRects.push({ x: s.x, y: s.y, w: s.width, h: s.height });
                  const slicePixels = grid.extractRect({
                    x: s.x,
                    y: s.y,
                    w: s.width,
                    h: s.height,
                  });
                  slicePixels.forEach(([rx, ry]) => {
                    extracted.push([s.x + rx - selection.x, s.y + ry - selection.y]);
                  });
                  temp.clearRect({
                    x: s.x,
                    y: s.y,
                    w: s.width,
                    h: s.height,
                  });
                }
              });
            } else {
              sliceRects.push({ x: selection.x, y: selection.y, w: selection.w, h: selection.h });
              extracted = grid.extractRect({
                x: selection.x,
                y: selection.y,
                w: selection.w,
                h: selection.h,
              });
              temp.clearRect({
                x: selection.x,
                y: selection.y,
                w: selection.w,
                h: selection.h,
              });
            }

            setGrid(temp);
            setMovingPixels({
              originalRect: { ...selection },
              pixels: extracted,
              offset: { dx, dy },
              active: true,
              sliceRects,
            });
          } else if (movingPixels) {
            setMovingPixels(prev => (prev ? { ...prev, offset: { dx, dy } } : null));
          }

          setSelection(prev =>
            prev
              ? {
                  ...prev,
                  x: (movingPixels ? movingPixels.originalRect.x : selection.x) + dx,
                  y: (movingPixels ? movingPixels.originalRect.y : selection.y) + dy,
                }
              : null
          );
          return;
        }

        // Free select marquee
        if (hasMoved) {
          const minX = Math.min(startPos.x, coords.x);
          const minY = Math.min(startPos.y, coords.y);
          const w = Math.abs(coords.x - startPos.x) + 1;
          const h = Math.abs(coords.y - startPos.y) + 1;
          setSelection({ x: minX, y: minY, w, h, active: true });
        }
        return;
      }
      return;
    }

    if (!isDrawing) return;

    setDragCurrentPos(coords);

    // Continuous pencil / eraser drawing without gaps:
    if (isErasing || activeTool === 'pencil') {
      const val = isErasing ? 0 : 1;
      const last = lastDrawPosRef.current || startPos || coords;
      const temp = grid.clone();
      drawLine(temp, last.x, last.y, coords.x, coords.y, val, brushSize);
      lastDrawPosRef.current = coords;
      strokeModifiedRef.current = true;
      setGrid(temp);
    }
  };

  const handleMouseUp = (e?: React.MouseEvent) => {
    if (ghostPlacement) {
      return;
    }

    if (isPanning) {
      setIsPanning(false);
      return;
    }

    // Quick move zone-select completion
    if (quickMoveMode === 'zone-select') {
      setQuickMoveMode(null);
      setIsDrawing(false);
      const endCoords = dragCurrentPos || startPos;
      if (startPos && endCoords) {
        const minX = Math.min(startPos.x, endCoords.x);
        const minY = Math.min(startPos.y, endCoords.y);
        const w = Math.abs(endCoords.x - startPos.x) + 1;
        const h = Math.abs(endCoords.y - startPos.y) + 1;

        // Find all slices that intersect this zone
        const zoneSlices = (slices || []).filter(s =>
          s.x < minX + w && s.x + s.width > minX &&
          s.y < minY + h && s.y + s.height > minY
        );

        if (zoneSlices.length > 0) {
          const zoneIds = zoneSlices.map(s => s.id);
          if (onSelectSlicesRef.current) {
            onSelectSlicesRef.current(zoneIds);
          } else {
            zoneIds.forEach(id => onSelectSliceRef.current?.(id, true));
          }
          let zMinX = Infinity, zMinY = Infinity, zMaxX = -Infinity, zMaxY = -Infinity;
          zoneSlices.forEach(s => {
            zMinX = Math.min(zMinX, s.x);
            zMinY = Math.min(zMinY, s.y);
            zMaxX = Math.max(zMaxX, s.x + s.width);
            zMaxY = Math.max(zMaxY, s.y + s.height);
          });
          setSelection({
            x: zMinX,
            y: zMinY,
            w: zMaxX - zMinX,
            h: zMaxY - zMinY,
            active: true,
          });
        } else {
          // No slices in zone; clear selection
          setSelection(null);
          onSelectSliceRef.current?.('', false);
        }
      }
      setStartPos(null);
      setDragCurrentPos(null);
      return;
    }

    if (quickMoveMode === 'drag') {
      setQuickMoveMode(null);
    }

    // Finished moving selected pixels: OVERRIDE WHAT'S BENEATH (black is not transparent)
    if (movingPixels && movingPixels.active) {
      const targetX = movingPixels.originalRect.x + movingPixels.offset.dx;
      const targetY = movingPixels.originalRect.y + movingPixels.offset.dy;
      const next = grid.clone();

      // Clear destination rectangles first so black overrides beneath
      if (movingPixels.sliceRects && movingPixels.sliceRects.length > 0) {
        movingPixels.sliceRects.forEach(sr => {
          next.clearRect({
            x: sr.x + movingPixels.offset.dx,
            y: sr.y + movingPixels.offset.dy,
            w: sr.w,
            h: sr.h,
          });
        });
      } else {
        next.clearRect({
          x: targetX,
          y: targetY,
          w: movingPixels.originalRect.w,
          h: movingPixels.originalRect.h,
        });
      }

      // Stamp active pixels
      movingPixels.pixels.forEach(([relX, relY]) => {
        next.set(targetX + relX, targetY + relY, 1);
      });
      const originalSelection = {
        x: movingPixels.originalRect.x,
        y: movingPixels.originalRect.y,
        w: movingPixels.originalRect.w,
        h: movingPixels.originalRect.h,
        active: true,
      };

      const newSelection = {
        x: targetX,
        y: targetY,
        w: movingPixels.originalRect.w,
        h: movingPixels.originalRect.h,
        active: true,
      };

      // Ensure the history entry before the move records the selection in its original place!
      const currentIdx = historyIndexRef.current;
      if (historyRef.current[currentIdx]) {
        historyRef.current[currentIdx] = {
          ...historyRef.current[currentIdx],
          selection: originalSelection,
        };
      }

      // Collect slice updates if slices were moved
      let sliceUpdates: { id: string; prevX: number; prevY: number; newX: number; newY: number }[] = [];
      if (selectedSliceIds && selectedSliceIds.length > 0) {
        selectedSliceIds.forEach(id => {
          const s = slices?.find(item => item.id === id);
          if (s) {
            sliceUpdates.push({
              id,
              prevX: s.x,
              prevY: s.y,
              newX: s.x + movingPixels.offset.dx,
              newY: s.y + movingPixels.offset.dy,
            });
          }
        });
      } else if (selectedSliceId) {
        const s = slices?.find(item => item.id === selectedSliceId);
        if (s) {
          sliceUpdates.push({
            id: selectedSliceId,
            prevX: s.x,
            prevY: s.y,
            newX: targetX,
            newY: targetY,
          });
        }
      } else if (slices) {
        const matchingSlice = slices.find(
          s =>
            s.x === movingPixels.originalRect.x &&
            s.y === movingPixels.originalRect.y &&
            s.width === movingPixels.originalRect.w &&
            s.height === movingPixels.originalRect.h
        );
        if (matchingSlice) {
          sliceUpdates.push({
            id: matchingSlice.id,
            prevX: matchingSlice.x,
            prevY: matchingSlice.y,
            newX: targetX,
            newY: targetY,
          });
        }
      }

      commitGridState(next, newSelection, sliceUpdates.length > 0 ? sliceUpdates : undefined);

      // Update slice coordinates if this move was on a valid slice selection
      if (selectedSliceIds && selectedSliceIds.length > 0 && onSlicesMove) {
        onSlicesMove(selectedSliceIds.map(id => ({ id, dx: movingPixels.offset.dx, dy: movingPixels.offset.dy })));
      } else if (selectedSliceId && onSliceMove) {
        onSliceMove(selectedSliceId, targetX, targetY);
      } else if (slices && onSliceMove && sliceUpdates.length > 0) {
        onSliceMove(sliceUpdates[0].id, targetX, targetY);
      } else if (pendingSelection) {
        onNewSelectionRef.current?.({
          x: targetX,
          y: targetY,
          width: movingPixels.originalRect.w,
          height: movingPixels.originalRect.h,
        });
      }

      setMovingPixels(null);
      setIsInsideSelectionOnDown(false);
      setIsDrawing(false);
      setStartPos(null);
      setDragCurrentPos(null);
      return;
    }

    const isErasing = drawButtonRef.current === 2 || activeTool === 'eraser';
    const isSelect = !isErasing && (isControlHeldRef.current || e?.ctrlKey || e?.metaKey || activeTool === 'select');

    if (isDrawing && isSelect) {
      const endCoords = dragCurrentPos || startPos;
      const hasDragged =
        startPos && endCoords &&
        (Math.abs(endCoords.x - startPos.x) > 0 || Math.abs(endCoords.y - startPos.y) > 0);

      setIsDrawing(false);
      setIsInsideSelectionOnDown(false);

      if (!hasDragged && startPos) {
        // CLICK (no dragging): trigger slice search!
        if (slices && slices.length > 0) {
          const clickedSlice = slices.find(
            s =>
              startPos.x >= s.x &&
              startPos.x < s.x + s.width &&
              startPos.y >= s.y &&
              startPos.y < s.y + s.height
          );
          if (clickedSlice) {
            onSelectSliceRef.current?.(clickedSlice.id, e?.ctrlKey || e?.metaKey);
            setSelection({
              x: clickedSlice.x,
              y: clickedSlice.y,
              w: clickedSlice.width,
              h: clickedSlice.height,
              active: true,
            });
            setStartPos(null);
            setDragCurrentPos(null);
            return;
          }
        }
        // Clicked outside any slice
        onSelectSliceRef.current?.('', e?.ctrlKey || e?.metaKey);
        setSelection(null);
        setStartPos(null);
        setDragCurrentPos(null);
        return;
      }

      if (hasDragged && startPos && endCoords) {
        // DRAG: free select marquee!
        const minX = Math.min(startPos.x, endCoords.x);
        const minY = Math.min(startPos.y, endCoords.y);
        const w = Math.abs(endCoords.x - startPos.x) + 1;
        const h = Math.abs(endCoords.y - startPos.y) + 1;

        setSelection({ x: minX, y: minY, w, h, active: true });
        onNewSelectionRef.current?.({ x: minX, y: minY, width: w, height: h });
        setStartPos(null);
        setDragCurrentPos(null);
        return;
      }
    }

    // Commit single stroke to history on mouseUp if modified
    if (strokeModifiedRef.current) {
      commitGridState(grid);
      strokeModifiedRef.current = false;
    }

    // Finished dragging a geometric shape
    if (isDrawing && startPos && dragCurrentPos && !isErasing) {
      const val = 1;
      const temp = grid.clone();

      if (activeTool !== 'pencil' && activeTool !== 'bucket' && activeTool !== 'select' && activeTool !== 'move') {
        switch (activeTool) {
          case 'line':
            drawLine(temp, startPos.x, startPos.y, dragCurrentPos.x, dragCurrentPos.y, val, brushSize);
            break;
          case 'rect':
            drawRect(temp, startPos.x, startPos.y, dragCurrentPos.x, dragCurrentPos.y, val, false, brushSize);
            break;
          case 'filled-rect':
            drawRect(temp, startPos.x, startPos.y, dragCurrentPos.x, dragCurrentPos.y, val, true, brushSize);
            break;
          case 'ellipse':
            drawEllipse(temp, startPos.x, startPos.y, dragCurrentPos.x, dragCurrentPos.y, val, false, brushSize);
            break;
          case 'filled-ellipse':
            drawEllipse(temp, startPos.x, startPos.y, dragCurrentPos.x, dragCurrentPos.y, val, true, brushSize);
            break;
          case 'triangle':
            drawTriangle(temp, startPos.x, startPos.y, dragCurrentPos.x, dragCurrentPos.y, val, false, brushSize);
            break;
          case 'filled-triangle':
            drawTriangle(temp, startPos.x, startPos.y, dragCurrentPos.x, dragCurrentPos.y, val, true, brushSize);
            break;
          case 'diamond':
            drawDiamond(temp, startPos.x, startPos.y, dragCurrentPos.x, dragCurrentPos.y, val, false, brushSize);
            break;
          case 'star':
            drawStar(temp, startPos.x, startPos.y, dragCurrentPos.x, dragCurrentPos.y, val, brushSize);
            break;
          case 'arrow':
            drawArrow(temp, startPos.x, startPos.y, dragCurrentPos.x, dragCurrentPos.y, val, brushSize);
            break;
          case 'plus':
            drawPlus(temp, startPos.x, startPos.y, dragCurrentPos.x, dragCurrentPos.y, val, brushSize);
            break;
        }
        commitGridState(temp);
      }
    }

    setIsDrawing(false);
    setStartPos(null);
    setDragCurrentPos(null);
    lastDrawPosRef.current = null;
    drawButtonRef.current = 0;
    setDrawButton(0);
  };

  // Zoom with mouse wheel centered at cursor (non-passive to allow preventDefault safely)
  useEffect(() => {
    const target = containerRef.current || canvasRef.current;
    if (!target) return;

    const onWheelNative = (e: WheelEvent) => {
      e.preventDefault();
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const dy = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaMode === 2 ? e.deltaY * 800 : e.deltaY;
      let step = 0;
      if (Math.abs(dy) >= 40) {
        step = dy > 0 ? -1 : 1;
        wheelDeltaRef.current = 0;
      } else {
        wheelDeltaRef.current += dy;
        const threshold = 30;
        if (Math.abs(wheelDeltaRef.current) >= threshold) {
          step = wheelDeltaRef.current > 0 ? -1 : 1;
          wheelDeltaRef.current = 0;
        }
      }

      if (step === 0) return;

      setViewport(prev => {
        const next = calculateZoomAtPoint(prev.zoom, prev.pan, mouseX, mouseY, step);
        zoomRef.current = next.zoom;
        panRef.current = next.pan;
        onViewportChangeRef.current?.(next);
        return next;
      });
    };

    target.addEventListener('wheel', onWheelNative as EventListener, { passive: false });
    return () => {
      target.removeEventListener('wheel', onWheelNative as EventListener);
    };
  }, []);

  const getCanvasCursor = () => {
    if (ghostPlacement) return 'copy';
    if (isPanning) return 'grabbing';
    if (isSpaceHeld) return 'grab';
    const effectiveTool = isControlHeld ? 'select' : (isShiftHeld ? 'move' : activeTool);
    if (effectiveTool === 'move') {
      if (movingPixels && movingPixels.active) return 'grabbing';
      return 'grab';
    }
    if (effectiveTool === 'select') {
      if (movingPixels && movingPixels.active) return 'grabbing';
      if (
        hoverPos &&
        selection &&
        selection.active &&
        hoverPos.x >= selection.x &&
        hoverPos.x < selection.x + selection.w &&
        hoverPos.y >= selection.y &&
        hoverPos.y < selection.y + selection.h
      ) {
        return 'grab';
      }
      return 'crosshair';
    }
    return 'crosshair';
  };

  // Transformations
  const handleInvert = () => {
    if (selection && selection.active) {
      commitGridState(grid.invert({ minX: selection.x, minY: selection.y, width: selection.w, height: selection.h }));
    } else {
      commitGridState(grid.invert());
    }
  };

  const handleFlipH = () => {
    if (selection && selection.active) {
      commitGridState(grid.flipH({ minX: selection.x, minY: selection.y, width: selection.w, height: selection.h }));
    } else {
      commitGridState(grid.flipH());
    }
  };

  const handleFlipV = () => {
    if (selection && selection.active) {
      commitGridState(grid.flipV({ minX: selection.x, minY: selection.y, width: selection.w, height: selection.h }));
    } else {
      commitGridState(grid.flipV());
    }
  };

  const handleRotate90 = () => {
    if (selection && selection.active) {
      commitGridState(grid.rotate90({ minX: selection.x, minY: selection.y, width: selection.w, height: selection.h }));
    } else {
      commitGridState(grid.rotate90());
    }
  };

  // Export handlers
  const handleExportPNG = () => {
    const b = grid.getBounds();
    const w = b.width > 0 ? b.width : 128;
    const h = b.height > 0 ? b.height : 34;
    const minX = b.width > 0 ? b.minX : 0;
    const minY = b.height > 0 ? b.minY : 0;

    const offscreen = document.createElement('canvas');
    offscreen.width = w;
    offscreen.height = h;
    const octx = offscreen.getContext('2d');
    if (!octx) return;

    octx.fillStyle = '#000000';
    octx.fillRect(0, 0, w, h);
    octx.fillStyle = '#ffffff';

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (grid.get(minX + x, minY + y)) {
          octx.fillRect(x, y, 1, 1);
        }
      }
    }

    offscreen.toBlob(blob => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pixel_art_${w}x${h}.png`;
      a.click();
      URL.revokeObjectURL(url);
    });
  };

  const handleExportCArray = () => {
    const cCode = grid.toCArray('CUSTOM_DISPLAY_BITMAP');
    setModalContent({ title: 'Export C 1bpp Array', text: cCode });
  };

  const handleExportJSON = () => {
    const b = grid.getBounds();
    const json = JSON.stringify(
      {
        bounds: b,
        pixels: grid.getAllPixels(),
      },
      null,
      2
    );
    setModalContent({ title: 'Export JSON', text: json });
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type.startsWith('image/') || file.name.toLowerCase().endsWith('.gif')) {
      setPendingImageSource(file);
      setImportModalOpen(true);
    }
    e.target.value = '';
  };

  const handleConfirmImageImport = (
    importedGrid: BwpxGrid,
    width: number,
    height: number,
    gifData?: {
      frames: { grid: BwpxGrid; delayMs: number }[];
      name?: string;
    }
  ) => {
    setImportModalOpen(false);
    setPendingImageSource(null);

    // If multi-frame GIF animation:
    if (gifData && gifData.frames.length > 0) {
      const frameCount = gifData.frames.length;
      const spot = findAvailableSpot(
        grid,
        slicesRef.current || [],
        width,
        height,
        frameCount,
        initialWidth,
        initialHeight
      );

      // Stamp frames onto canvas
      const next = grid.clone();
      gifData.frames.forEach((frame, i) => {
        const placement = spot.frames[i];
        if (!placement) return;
        const pixels = frame.grid.getAllPixels();
        pixels.forEach(([px, py]) => {
          next.set(placement.x + px, placement.y + py, 1);
        });
      });

      // Construct unique groupId and SpriteSlice entries
      const rawName = (gifData.name || 'Anim').trim();
      const sanitizedName = rawName.replace(/[^a-zA-Z0-9_]/g, '_');
      const cleanId = `SYMBOL_${sanitizedName.toUpperCase()}_${Date.now().toString().slice(-4)}`;
      const groupColor = '#00d2ff';

      const newSlices: SpriteSlice[] = spot.frames.map((placement, i) => ({
        id: i === 0 ? cleanId : `${cleanId}_SUB_${i}`,
        name: i === 0 ? rawName : undefined,
        groupId: cleanId,
        groupOrder: i + 1,
        x: placement.x,
        y: placement.y,
        width,
        height,
        color: groupColor,
      }));

      // Add slices via callbacks
      if (onAddSlicesRef.current) {
        onAddSlicesRef.current(newSlices);
      } else if (onSlicesChangeRef.current) {
        onSlicesChangeRef.current([...(slicesRef.current || []), ...newSlices]);
      }

      // Select newly added slices
      const newSliceIds = newSlices.map(s => s.id);
      if (onSelectSlicesRef.current) {
        onSelectSlicesRef.current(newSliceIds);
      } else if (onSelectSliceRef.current && newSliceIds[0]) {
        onSelectSliceRef.current(newSliceIds[0]);
      }

      // Commit grid state with active marquee selection over the pasted group
      commitGridState(next, {
        x: spot.bounds.x,
        y: spot.bounds.y,
        w: spot.bounds.w,
        h: spot.bounds.h,
        active: true,
      });

      // Adjust viewport pan if the placed group is outside view
      const canvas = canvasRef.current;
      if (canvas) {
        const screenX = pan.x + spot.bounds.x * zoom;
        const screenY = pan.y + spot.bounds.y * zoom;
        if (
          screenX < 0 ||
          screenY < 0 ||
          screenX + spot.bounds.w * zoom > canvas.width ||
          screenY + spot.bounds.h * zoom > canvas.height
        ) {
          setPan({
            x: Math.round(canvas.width / 2 - (spot.bounds.x + spot.bounds.w / 2) * zoom),
            y: Math.round(canvas.height / 2 - (spot.bounds.y + spot.bounds.h / 2) * zoom),
          });
        }
      }

      return;
    }

    // Static image fallback: ghost placement
    const canvas = canvasRef.current;
    let initialX = 0;
    let initialY = 0;
    if (canvas) {
      initialX = Math.round((-pan.x + canvas.width / 2) / zoom - width / 2);
      initialY = Math.round((-pan.y + canvas.height / 2) / zoom - height / 2);
    }

    setGhostPlacement({
      grid: importedGrid,
      width,
      height,
      pixels: importedGrid.getAllPixels(),
      x: initialX,
      y: initialY,
    });
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    if (ghostPlacement) {
      setGhostPlacement(null);
      return;
    }
    if (wasErasingRef.current) {
      wasErasingRef.current = false;
      return;
    }
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const handleContextMenuPaste = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.read) {
        const items = await navigator.clipboard.read();
        for (const item of items) {
          const imgType = item.types.find(t => t.startsWith('image/'));
          if (imgType) {
            const blob = await item.getType(imgType);
            setPendingImageSource(blob);
            setImportModalOpen(true);
            return;
          }
        }
      }
      alert('No image found in clipboard. Copy an image or screenshot first (Ctrl+C / PrintScreen).');
    } catch (err) {
      console.warn('Clipboard read error or permission denied:', err);
      fileInputRef.current?.click();
    }
  };

  const handlePresetChange = (w: number, h: number) => {
    const next = new BwpxGrid(w, h);
    next.blit(grid, 0, 0);
    commitGridState(next);
    fitToView();
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedNotification(true);
    setTimeout(() => setCopiedNotification(false), 2000);
  };

  return (
    <div className="bwpx-editor-container">
      {/* 1. TOP TOOLBAR */}
      <header className="bwpx-header">
        {/* Left: History, Brush & Transforms */}
        <div className="bwpx-header-left">
          {/* Undo / Redo */}
          <div className="bwpx-group">
            <button
              onClick={handleUndo}
              disabled={historyIndex <= 0}
              className="bwpx-btn-icon"
              title="Undo (Ctrl+Z)"
            >
              <Undo2 size={14} />
            </button>
            <button
              onClick={handleRedo}
              disabled={historyIndex >= history.length - 1}
              className="bwpx-btn-icon"
              title="Redo (Ctrl+Y)"
            >
              <Redo2 size={14} />
            </button>
            <span className="bwpx-history-text">
              {historyIndex} / {history.length - 1} steps
            </span>
          </div>

          <div className="bwpx-v-divider" />

          {/* Brush Sizes */}
          <div className="bwpx-group-box">
            <span className="bwpx-group-label">Brush</span>
            {[1, 2, 3, 4].map(sz => (
              <button
                key={sz}
                onClick={() => setBrushSize(sz)}
                className={`bwpx-brush-btn ${brushSize === sz ? 'active' : ''}`}
              >
                {sz}
              </button>
            ))}
          </div>

          <div className="bwpx-v-divider" />

          {/* Transformations */}
          <div className="bwpx-group">
            <button
              onClick={handleInvert}
              className="bwpx-btn-text"
              title="Invert Colors"
            >
              Invert
            </button>
            <button
              onClick={handleFlipH}
              className="bwpx-btn-icon"
              title="Flip Horizontal"
            >
              <FlipHorizontal size={14} />
            </button>
            <button
              onClick={handleFlipV}
              className="bwpx-btn-icon"
              title="Flip Vertical"
            >
              <FlipVertical size={14} />
            </button>
            <button
              onClick={handleRotate90}
              className="bwpx-btn-icon"
              title="Rotate 90°"
            >
              <RotateCw size={14} />
            </button>
          </div>
        </div>

        {/* Right: Export / Import & Presets */}
        <div className="bwpx-header-right">
          <div className="bwpx-group-box">
            <button onClick={handleExportPNG} className="bwpx-btn-text">
              PNG
            </button>
            <button onClick={handleExportCArray} className="bwpx-btn-text">
              C Array
            </button>
            <button onClick={handleExportJSON} className="bwpx-btn-text">
              JSON
            </button>
          </div>

          <label className="bwpx-btn-import">
            <Upload size={13} />
            <span>Import</span>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.json"
              onChange={handleImportFile}
              style={{ display: 'none' }}
            />
          </label>

          {showPresets && (
            <div className="bwpx-group-box">
              <span className="bwpx-group-label">Canvas</span>
              <select
                value={`${grid.width}x${grid.height}`}
                onChange={e => {
                  const [w, h] = e.target.value.split('x').map(Number);
                  handlePresetChange(w, h);
                }}
                className="bwpx-preset-select"
              >
                <option value="128x32">128×32 (Corne HW)</option>
                <option value="32x128">32×128 (Corne Portrait)</option>
                <option value="128x64">128×64</option>
                <option value="128x34">128×34 (Symbols Atlas)</option>
                <option value="128x22">128×22 (Font Atlas)</option>
              </select>
            </div>
          )}

          <button
            onClick={fitToView}
            className="bwpx-btn-icon"
            title="Fit to Screen"
          >
            <Maximize2 size={15} />
          </button>
        </div>
      </header>

      {/* 2. MAIN WORKSPACE */}
      <div className="bwpx-main-area">
        {/* Left Toolbar */}
        <aside className="bwpx-sidebar">
          {/* DRAW GROUP */}
          <span className="bwpx-section-label">DRAW</span>

          <button
            onClick={() => setActiveTool('pencil')}
            className={`bwpx-tool-btn ${activeTool === 'pencil' && !isControlHeld && !isShiftHeld ? 'active' : ''}`}
            title="Pencil (Left click draws)"
          >
            <Pencil size={15} />
          </button>

          <div className="has-tooltip">
            <button
              type="button"
              onClick={() => setActiveTool('eraser')}
              className={`bwpx-tool-btn ${activeTool === 'eraser' ? 'active' : ''}`}
              title="Eraser (or Right click)"
            >
              <Eraser size={15} />
            </button>
            <div className="tooltip">Eraser (or Right click)</div>
          </div>

          <button
            type="button"
            onClick={() => setActiveTool('bucket')}
            className={`bwpx-tool-btn ${activeTool === 'bucket' && !isControlHeld && !isShiftHeld ? 'active' : ''}`}
            title="Flood Fill Bucket"
          >
            <PaintBucket size={15} />
          </button>

          <div className="has-tooltip">
            <button
              type="button"
              onClick={() => setActiveTool('select')}
              className={`bwpx-tool-btn tool-select ${activeTool === 'select' || isControlHeld ? 'active' : ''}`}
              title="Selection (or Ctrl click)"
            >
              <MousePointer2 size={15} />
            </button>
            <div className="tooltip">Select (or Ctrl click)</div>
          </div>

          <div className="has-tooltip">
            <button
              type="button"
              onClick={() => setActiveTool('move')}
              className={`bwpx-tool-btn ${activeTool === 'move' || isShiftHeld ? 'active' : ''}`}
              title="Move (or Shift click)"
            >
              <Move size={15} />
            </button>
            <div className="tooltip">Move (or Shift click)</div>
          </div>

          <div className="bwpx-h-divider" />

          {/* SHAPES GROUP */}
          <span className="bwpx-section-label">SHAPES</span>

          <button
            onClick={() => setActiveTool('line')}
            className={`bwpx-tool-btn ${activeTool === 'line' ? 'active' : ''}`}
            title="Line"
          >
            <Minus size={15} style={{ transform: 'rotate(-45deg)' }} />
          </button>

          <button
            onClick={() => setActiveTool('rect')}
            className={`bwpx-tool-btn ${activeTool === 'rect' ? 'active' : ''}`}
            title="Rectangle Outline"
          >
            <Square size={14} />
          </button>

          <button
            onClick={() => setActiveTool('filled-rect')}
            className={`bwpx-tool-btn ${activeTool === 'filled-rect' ? 'active' : ''}`}
            title="Filled Rectangle"
          >
            <div style={{ width: 12, height: 12, backgroundColor: 'currentColor', borderRadius: 2 }} />
          </button>

          <button
            onClick={() => setActiveTool('ellipse')}
            className={`bwpx-tool-btn ${activeTool === 'ellipse' ? 'active' : ''}`}
            title="Ellipse / Circle"
          >
            <Circle size={14} />
          </button>

          <button
            onClick={() => setActiveTool('filled-ellipse')}
            className={`bwpx-tool-btn ${activeTool === 'filled-ellipse' ? 'active' : ''}`}
            title="Filled Circle"
          >
            <div style={{ width: 12, height: 12, backgroundColor: 'currentColor', borderRadius: '50%' }} />
          </button>

          <button
            onClick={() => setActiveTool('triangle')}
            className={`bwpx-tool-btn ${activeTool === 'triangle' ? 'active' : ''}`}
            title="Triangle Outline"
          >
            <Triangle size={14} />
          </button>

          <button
            onClick={() => setActiveTool('filled-triangle')}
            className={`bwpx-tool-btn ${activeTool === 'filled-triangle' ? 'active' : ''}`}
            title="Filled Triangle"
          >
            <Triangle size={14} fill="currentColor" />
          </button>

          <button
            onClick={() => setActiveTool('star')}
            className={`bwpx-tool-btn ${activeTool === 'star' ? 'active' : ''}`}
            title="5-Point Star"
          >
            <Sparkles size={14} />
          </button>

          <button
            onClick={() => setActiveTool('arrow')}
            className={`bwpx-tool-btn ${activeTool === 'arrow' ? 'active' : ''}`}
            title="Arrow"
          >
            <ArrowRight size={14} />
          </button>

          <button
            onClick={() => setActiveTool('plus')}
            className={`bwpx-tool-btn ${activeTool === 'plus' ? 'active' : ''}`}
            title="Cross / Plus"
          >
            <Plus size={14} />
          </button>
        </aside>

        {/* Center Canvas Viewport */}
        <main
          ref={containerRef}
          className="bwpx-viewport"
          onContextMenu={handleContextMenu}
        >
          <canvas
            ref={canvasRef}
            style={{ cursor: getCanvasCursor() }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={(e) => handleMouseUp(e)}
            onMouseLeave={() => {
              setHoverPos(null);
              setIsPanning(false);
              drawButtonRef.current = 0;
              setDrawButton(0);
              if (movingPixels && movingPixels.active) {
                handleMouseUp();
              } else {
                if (strokeModifiedRef.current) {
                  commitGridState(grid);
                  strokeModifiedRef.current = false;
                }
                setIsDrawing(false);
                setIsInsideSelectionOnDown(false);
                setStartPos(null);
                setDragCurrentPos(null);
                lastDrawPosRef.current = null;
              }
            }}
          />
        </main>
      </div>

      {/* 3. BOTTOM STATUS BAR */}
      <footer className="bwpx-statusbar">
        <div className="bwpx-status-left">
          {ghostPlacement ? (
            <span className="bwpx-status-tool" style={{ color: '#c084fc', background: 'rgba(192, 132, 252, 0.15)' }}>
              Ghost Drag: Click to stamp, Esc or Right-click to cancel
            </span>
          ) : (
            <span className="bwpx-status-tool">
              {isControlHeld ? 'select (ctrl)' : (isShiftHeld ? 'quick-move (shift)' : (drawButton === 2 ? 'eraser' : activeTool))}
            </span>
          )}
          <span>
            Pos:{' '}
            <strong className="bwpx-status-val">
              {hoverPos ? `${hoverPos.x >= 0 ? '+' : ''}${hoverPos.x}, ${hoverPos.y >= 0 ? '+' : ''}${hoverPos.y}` : '--'}
            </strong>
          </span>
          <span>
            Brush: <strong className="bwpx-status-val">{brushSize}px</strong>
          </span>
          <span>
            Bounds:{' '}
            <strong className="bwpx-status-val">
              {(() => {
                const b = grid.getBounds();
                return b.width > 0 ? `${b.width}×${b.height}` : 'Infinite';
              })()}
            </strong>
          </span>
          <span>
            Selection:{' '}
            <strong
              className="bwpx-status-val"
              style={{ color: selection && selection.active ? '#c084fc' : undefined }}
            >
              {selection && selection.active ? `${selection.w}×${selection.h} (${selection.x}, ${selection.y})` : 'None'}
            </strong>
          </span>
        </div>

        <div className="bwpx-status-right">
          <span>
            On: <strong className="bwpx-status-val" style={{ color: 'var(--accent, #00d2ff)' }}>{grid.countOn()}</strong>
          </span>
          <span>
            Zoom: <strong className="bwpx-status-val">{Math.round(zoom * 100)}%</strong>
          </span>
        </div>
      </footer>

      {/* Export Modal */}
      {modalContent && (
        <div className="bwpx-modal-backdrop">
          <div className="bwpx-modal-card">
            <div className="bwpx-modal-header">
              <h3 className="bwpx-modal-title">
                <FileCode size={16} />
                <span>{modalContent.title}</span>
              </h3>
              <button
                onClick={() => setModalContent(null)}
                className="bwpx-modal-close"
              >
                ✕
              </button>
            </div>
            <pre className="bwpx-modal-pre">
              {modalContent.text}
            </pre>
            <div className="bwpx-modal-footer">
              <span className="bwpx-modal-hint">Ready to copy into your project header</span>
              <div className="bwpx-modal-actions">
                <button
                  onClick={() => copyToClipboard(modalContent.text)}
                  className="bwpx-btn-primary"
                >
                  {copiedNotification ? <Check size={14} /> : <Copy size={14} />}
                  <span>{copiedNotification ? 'Copied!' : 'Copy to Clipboard'}</span>
                </button>
                <button
                  onClick={() => setModalContent(null)}
                  className="bwpx-btn-secondary"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Image Import & Tuning Modal */}
      <ImageImportModal
        isOpen={importModalOpen}
        imageSource={pendingImageSource}
        onClose={() => {
          setImportModalOpen(false);
          setPendingImageSource(null);
        }}
        onConfirm={handleConfirmImageImport}
      />

      {/* Canvas Context Menu */}
      {contextMenu && (
        <CanvasContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          onPaste={handleContextMenuPaste}
          onImportFile={() => fileInputRef.current?.click()}
          onInvert={handleInvert}
          onFlipH={handleFlipH}
          onFlipV={handleFlipV}
          onRotate90={handleRotate90}
          onDeselect={() => {
            clearFreeSelections();
            setSelection(null);
            onSelectSliceRef.current?.('', false);
            onNewSelectionRef.current?.(null);
          }}
          hasSelection={Boolean(selection && selection.active)}
        />
      )}
    </div>
  );
};

/* oxlint-disable react/only-export-components, react/refs, react/set-state-in-effect */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { BwpxGrid } from '../core/BwpxGrid';
import {
  FileCode,
  Check,
  Copy,
} from 'lucide-react';
import type { SpriteSlice } from '../../types/zmk';
import { renderBaseCanvas, renderOverlayCanvas } from '../core/gridRenderer';
import { ImageImportModal } from './ImageImportModal';
import { CanvasContextMenu } from './CanvasContextMenu';
import { findAvailableSpot } from '../core/canvasPacking';
import { BenchmarkOverlay } from '../benchmarks/BenchmarkOverlay';
import { useBwpxHistory, type HistoryEntry } from '../hooks/useBwpxHistory';
import { useBwpxCanvasPointer } from '../hooks/useBwpxCanvasPointer';
import {
  BwpxEditorTopToolbar,
  BwpxEditorSidebar,
  type ToolType,
} from './BwpxEditorToolbar';
import { BwpxOverlayCanvas } from './BwpxOverlayCanvas';
import './BwpxEditor.css';

export type { ToolType, HistoryEntry };
export { useBwpxHistory } from '../hooks/useBwpxHistory';
export { useBwpxCanvasPointer } from '../hooks/useBwpxCanvasPointer';
export { BwpxEditorTopToolbar, BwpxEditorSidebar } from './BwpxEditorToolbar';
export { BwpxOverlayCanvas } from './BwpxOverlayCanvas';

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
  const selectionRef = useRef<{
    x: number;
    y: number;
    w: number;
    h: number;
    active: boolean;
  } | null>(null);

  const [selection, setSelection] = useState<{
    x: number;
    y: number;
    w: number;
    h: number;
    active: boolean;
  } | null>(null);
  selectionRef.current = selection;

  const onSliceMoveRef = useRef(onSliceMove);
  onSliceMoveRef.current = onSliceMove;
  const onSlicesMoveRef = useRef(onSlicesMove);
  onSlicesMoveRef.current = onSlicesMove;

  // History hook extraction
  const {
    grid,
    setGrid,
    history,
    historyIndex,
    historyRef,
    historyIndexRef,
    lastCommittedRef,
    commitGridState,
    handleUndo,
    handleRedo,
    canUndo,
    canRedo,
  } = useBwpxHistory({
    initialGrid,
    initialWidth,
    initialHeight,
    onGridChange,
    onSliceMoveRef,
    onSlicesMoveRef,
    selectionRef,
    setSelection,
  });

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
  const debouncedViewportNotifyRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notifyViewportChange = useCallback((vp: EditorViewport) => {
    if (debouncedViewportNotifyRef.current) {
      clearTimeout(debouncedViewportNotifyRef.current);
    }
    debouncedViewportNotifyRef.current = setTimeout(() => {
      debouncedViewportNotifyRef.current = null;
      onViewportChangeRef.current?.(vp);
    }, 120);
  }, []);

  useEffect(() => {
    return () => {
      if (debouncedViewportNotifyRef.current) {
        clearTimeout(debouncedViewportNotifyRef.current);
      }
    };
  }, []);

  const panRef = useRef(pan);
  panRef.current = pan;
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;

  const setPan = useCallback((action: { x: number; y: number } | ((prev: { x: number; y: number }) => { x: number; y: number })) => {
    setViewport(v => {
      const nextPan = typeof action === 'function' ? action(v.pan) : action;
      panRef.current = nextPan;
      return { ...v, pan: nextPan };
    });
  }, []);

  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayRafId = useRef<number | null>(null);
  const [isBenchmarkOpen, setIsBenchmarkOpen] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.location.search.includes('bench=true') || window.location.hash.includes('bench');
  });

  // Moving pixels with ghost preview during drag
  const [movingPixels, setMovingPixels] = useState<{
    originalRect: { x: number; y: number; w: number; h: number };
    pixels: [number, number][];
    offset: { dx: number; dy: number };
    active: boolean;
    sliceRects?: { x: number; y: number; w: number; h: number }[];
  } | null>(null);
  const movingPixelsRef = useRef(movingPixels);
  movingPixelsRef.current = movingPixels;

  // Internal clipboard for canvas pixel copy
  const internalClipboardRef = useRef<{
    width: number;
    height: number;
    pixels: [number, number][];
    copiedAt: number;
  } | null>(null);
  const lastBlurTimeRef = useRef<number>(0);

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
  const ghostPlacementRef = useRef(ghostPlacement);
  ghostPlacementRef.current = ghostPlacement;

  // Image Import Modal & Context Menu states
  const [importModalOpen, setImportModalOpen] = useState<boolean>(false);
  const [pendingImageSource, setPendingImageSource] = useState<File | Blob | string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRectRef = useRef<DOMRect | null>(null);

  const gridRef = useRef<BwpxGrid>(grid);
  gridRef.current = grid;
  const slicesRef = useRef(slices);
  slicesRef.current = slices;
  const selectedSliceIdsRef = useRef(selectedSliceIds);
  selectedSliceIdsRef.current = selectedSliceIds;
  const selectedSliceIdRef = useRef(selectedSliceId);
  selectedSliceIdRef.current = selectedSliceId;

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

  const activeToolRef = useRef<ToolType>(activeTool);
  activeToolRef.current = activeTool;
  const brushSizeRef = useRef<number>(brushSize);
  brushSizeRef.current = brushSize;

  const isDrawingStrokeRef = useRef<boolean>(false);
  const workingGridRef = useRef<BwpxGrid>(grid);
  if (!isDrawingStrokeRef.current) {
    workingGridRef.current = grid;
  }
  const strokeRafId = useRef<number | null>(null);

  // Sync selection when selectedSliceId changes from inspector or outside
  useEffect(() => {
    if (movingPixels) return;
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
        return;
      }
    }
    if (selectedSliceId && slices && slices.length > 0) {
      const slice = slices.find(s => s.id === selectedSliceId);
      if (slice) {
        setSelection({
          x: slice.x,
          y: slice.y,
          w: slice.width,
          h: slice.height,
          active: true,
        });
        return;
      }
    }
    if (!pendingSelection && (!selectedSliceIds || selectedSliceIds.length === 0) && !selectedSliceId) {
      setSelection(null);
    }
  }, [selectedSliceId, selectedSliceIds, pendingSelection, slices, movingPixels]);

  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const curZoom = zoomRef.current || viewport.zoom;
    const curPan = panRef.current || viewport.pan;

    renderBaseCanvas(canvas, ctx, {
      grid: isDrawingStrokeRef.current ? workingGridRef.current : grid,
      zoom: curZoom,
      pan: curPan,
      pixelColor: '#ffffff',
      bgColor: '#0b0d11',
      showAxes: true,
      showGridLines: curZoom >= 5,
      slices: slicesRef.current,
      selectedSliceId: selectedSliceIdRef.current,
    });
  }, [grid, viewport]);

  const renderWorkingGrid = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    renderBaseCanvas(canvas, ctx, {
      grid: workingGridRef.current,
      zoom: zoomRef.current,
      pan: panRef.current,
      pixelColor: '#ffffff',
      bgColor: '#0b0d11',
      showAxes: true,
      showGridLines: zoomRef.current >= 5,
      slices: slicesRef.current,
      selectedSliceId: selectedSliceIdRef.current,
    });
  }, []);

  const scheduleStrokeRender = useCallback(() => {
    if (strokeRafId.current !== null) return;
    strokeRafId.current = requestAnimationFrame(() => {
      strokeRafId.current = null;
      renderWorkingGrid();
    });
  }, [renderWorkingGrid]);

  const hoverPosRef = useRef<{ x: number; y: number } | null>(null);
  const isPanningRef = useRef<boolean>(false);

  const requestOverlayRender = useCallback(() => {
    if (overlayRafId.current !== null) return;
    overlayRafId.current = requestAnimationFrame(() => {
      overlayRafId.current = null;
      const overlayCanvas = overlayCanvasRef.current;
      if (!overlayCanvas) return;
      const ctx = overlayCanvas.getContext('2d');
      if (!ctx) return;

      const isInteractingTool = activeToolRef.current === 'select';
      const showBrush = Boolean(
        hoverPosRef.current &&
        !ghostPlacementRef.current &&
        !isPanningRef.current &&
        !isInteractingTool
      );

      const movingPx = movingPixelsRef.current;
      const ghost = ghostPlacementRef.current;
      const sel = selectionRef.current;

      const activeGhost =
        movingPx && movingPx.active
          ? {
              pixels: movingPx.pixels,
              x: movingPx.originalRect.x + movingPx.offset.dx,
              y: movingPx.originalRect.y + movingPx.offset.dy,
              w: movingPx.originalRect.w,
              h: movingPx.originalRect.h,
              rects: movingPx.sliceRects
                ? movingPx.sliceRects.map(r => ({
                    x: r.x + movingPx.offset.dx,
                    y: r.y + movingPx.offset.dy,
                    w: r.w,
                    h: r.h,
                  }))
                : undefined,
            }
          : ghost
          ? {
              pixels: ghost.pixels,
              x: ghost.x,
              y: ghost.y,
              w: ghost.width,
              h: ghost.height,
            }
          : null;

      renderOverlayCanvas(overlayCanvas, ctx, {
        zoom: zoomRef.current,
        pan: panRef.current,
        hoverPos: !isPanningRef.current ? hoverPosRef.current : null,
        brushSize: brushSizeRef.current,
        showBrushIndicator: showBrush,
        ghost: activeGhost,
        selection: !movingPx || !movingPx.active ? sel : null,
      });
    });
  }, []);

  const moveRafId = useRef<number | null>(null);
  const pendingMovingOffsetRef = useRef<{ dx: number; dy: number } | null>(null);
  const scheduleMovingPixelsRender = useCallback(() => {
    if (moveRafId.current !== null) return;
    moveRafId.current = requestAnimationFrame(() => {
      moveRafId.current = null;
      if (!pendingMovingOffsetRef.current) return;
      const { dx, dy } = pendingMovingOffsetRef.current;
      if (movingPixelsRef.current) {
        movingPixelsRef.current = {
          ...movingPixelsRef.current,
          offset: { dx, dy },
        };
      }
      if (selectionRef.current && movingPixelsRef.current) {
        selectionRef.current = {
          ...selectionRef.current,
          x: movingPixelsRef.current.originalRect.x + dx,
          y: movingPixelsRef.current.originalRect.y + dy,
        };
      }
      requestOverlayRender();
    });
  }, [requestOverlayRender]);

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

  // Pointer controls hook extraction
  const pointerControls = useBwpxCanvasPointer({
    grid,
    setGrid,
    viewport,
    setPan,
    notifyViewportChange,
    activeTool,
    brushSize,
    commitGridState,
    selection,
    setSelection,
    selectionRef,
    movingPixels,
    setMovingPixels,
    movingPixelsRef,
    scheduleMovingPixelsRender,
    pendingMovingOffsetRef,
    ghostPlacement,
    setGhostPlacement,
    slices,
    slicesRef,
    selectedSliceId,
    selectedSliceIdRef,
    selectedSliceIds,
    selectedSliceIdsRef,
    pendingSelection,
    onSelectSlice,
    onSelectSlices,
    onSelectSliceRef,
    onSelectSlicesRef,
    onNewSelectionRef,
    onSliceMove,
    onSlicesMove,
    onSliceMoveRef,
    onSlicesMoveRef,
    canvasRef,
    containerRef,
    canvasRectRef,
    renderCanvas,
    renderWorkingGrid,
    scheduleStrokeRender,
    requestOverlayRender,
    workingGridRef,
    isDrawingStrokeRef,
    contextMenu,
    setContextMenu,
    historyRef,
    historyIndexRef,
    externalHoverPosRef: hoverPosRef,
    externalIsPanningRef: isPanningRef,
  });

  const {
    isDrawing: _isDrawing,
    drawButton,
    isControlHeld,
    isShiftHeld,
    coordsDisplayRef,
    wasErasingRef,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleMouseLeave,
    getCanvasCursor,
  } = pointerControls;

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

  useEffect(() => {
    if (initialViewport) return;
    fitToView();
    const timer = setTimeout(() => {
      fitToView();
    }, 40);
    return () => clearTimeout(timer);
  }, [fitToView, initialViewport]);

  const pastePixelsAsGhost = useCallback((width: number, height: number, pixels: [number, number][]) => {
    const canvas = canvasRef.current;
    const curPan = panRef.current;
    const curZoom = zoomRef.current;
    let initialX = 0;
    let initialY = 0;
    if (canvas) {
      initialX = Math.round((-curPan.x + canvas.width / 2) / curZoom - width / 2);
      initialY = Math.round((-curPan.y + canvas.height / 2) / curZoom - height / 2);
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

  // Keyboard Arrow Key Move Selection
  const lastArrowTimeRef = useRef<number>(0);
  const moveActiveSelection = useCallback(
    (dx: number, dy: number, isRepeat: boolean = false) => {
      const currentSel = selectionRef.current;
      if (!currentSel || !currentSel.active) return;

      const curGrid = gridRef.current;
      const currentSlices = slicesRef.current || [];
      const currentSelectedSliceIds = selectedSliceIdsRef.current || [];
      const currentSelectedSliceId = selectedSliceIdRef.current;

      const activeIds = currentSelectedSliceIds.length > 0
        ? currentSelectedSliceIds
        : (currentSelectedSliceId ? [currentSelectedSliceId] : []);

      let sliceRects: { x: number; y: number; w: number; h: number }[] = [];
      let extracted: [number, number][] = [];
      const next = curGrid.clone();

      if (activeIds.length > 0) {
        activeIds.forEach(id => {
          const s = currentSlices.find(item => item.id === id);
          if (s) {
            sliceRects.push({ x: s.x, y: s.y, w: s.width, h: s.height });
            const spx = curGrid.extractRect(s);
            spx.forEach(([rx, ry]) => {
              extracted.push([s.x + rx - currentSel.x, s.y + ry - currentSel.y]);
            });
            next.clearRect(s);
          }
        });
      } else {
        sliceRects.push({ x: currentSel.x, y: currentSel.y, w: currentSel.w, h: currentSel.h });
        extracted = curGrid.extractRect(currentSel);
        next.clearRect(currentSel);
      }

      const targetX = currentSel.x + dx;
      const targetY = currentSel.y + dy;

      if (sliceRects.length > 0) {
        sliceRects.forEach(sr => {
          next.clearRect({
            x: sr.x + dx,
            y: sr.y + dy,
            w: sr.w,
            h: sr.h,
          });
        });
      } else {
        next.clearRect({
          x: targetX,
          y: targetY,
          w: currentSel.w,
          h: currentSel.h,
        });
      }

      extracted.forEach(([relX, relY]) => {
        next.set(targetX + relX, targetY + relY, 1);
      });

      const newSelection = {
        x: targetX,
        y: targetY,
        w: currentSel.w,
        h: currentSel.h,
        active: true,
      };

      const sliceUpdates: { id: string; prevX: number; prevY: number; newX: number; newY: number }[] = [];
      if (activeIds.length > 0) {
        activeIds.forEach(id => {
          const s = currentSlices.find(item => item.id === id);
          if (s) {
            sliceUpdates.push({
              id,
              prevX: s.x,
              prevY: s.y,
              newX: s.x + dx,
              newY: s.y + dy,
            });
          }
        });
      }

      if (sliceUpdates.length > 0) {
        slicesRef.current = slicesRef.current.map(s => {
          const u = sliceUpdates.find(item => item.id === s.id);
          return u ? { ...s, x: u.newX, y: u.newY } : s;
        });
      }

      const currentIdx = historyIndexRef.current;
      if (isRepeat && currentIdx > 0 && historyRef.current[currentIdx]) {
        const entry = historyRef.current[currentIdx];
        entry.grid = next.clone();
        entry.selection = { ...newSelection };
        if (sliceUpdates.length > 0) {
          const existingUpdates = entry.sliceUpdates || [];
          const mergedUpdates = sliceUpdates.map(u => {
            const existing = existingUpdates.find(eu => eu.id === u.id);
            return {
              id: u.id,
              prevX: existing !== undefined ? existing.prevX : u.prevX,
              prevY: existing !== undefined ? existing.prevY : u.prevY,
              newX: u.newX,
              newY: u.newY,
            };
          });
          entry.sliceUpdates = mergedUpdates;
        }
        lastCommittedRef.current = next;
        gridRef.current = next;
        workingGridRef.current = next;
        selectionRef.current = newSelection;
        setGrid(next);
        setSelection(newSelection);
        onGridChange?.(next);
      } else {
        if (historyRef.current[currentIdx]) {
          historyRef.current[currentIdx] = {
            ...historyRef.current[currentIdx],
            selection: { ...currentSel },
          };
        }
        commitGridState(next, newSelection, sliceUpdates.length > 0 ? sliceUpdates : undefined);
        gridRef.current = next;
        workingGridRef.current = next;
        selectionRef.current = newSelection;
      }

      if (selectedSliceIdsRef.current && selectedSliceIdsRef.current.length > 0 && onSlicesMoveRef.current) {
        onSlicesMoveRef.current(selectedSliceIdsRef.current.map(id => ({ id, dx, dy })));
      } else if (selectedSliceIdRef.current && onSliceMoveRef.current) {
        const s = currentSlices.find(item => item.id === selectedSliceIdRef.current);
        if (s) {
          onSliceMoveRef.current(s.id, s.x + dx, s.y + dy);
        }
      } else if (pendingSelection) {
        onNewSelectionRef.current?.({
          x: targetX,
          y: targetY,
          width: currentSel.w,
          height: currentSel.h,
        });
      }
    },
    [commitGridState, onGridChange, pendingSelection, historyIndexRef, historyRef, lastCommittedRef, setGrid]
  );

  // Keyboard Shortcuts (Undo, Redo, Copy, Paste, Arrows, etc.)
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
        return;
      }

      // Arrow Keys to Move Active Selection
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        if (selectionRef.current && selectionRef.current.active) {
          e.preventDefault();
          const step = e.shiftKey ? 4 : 1;
          let dx = 0;
          let dy = 0;
          if (e.key === 'ArrowUp') dy = -step;
          if (e.key === 'ArrowDown') dy = step;
          if (e.key === 'ArrowLeft') dx = -step;
          if (e.key === 'ArrowRight') dx = step;

          const now = Date.now();
          const isRepeat = e.repeat || now - lastArrowTimeRef.current < 250;
          lastArrowTimeRef.current = now;

          moveActiveSelection(dx, dy, isRepeat);
          return;
        }
      }

      // Escape key: cancel ghost placement or selection
      if (e.key === 'Escape') {
        if (ghostPlacementRef.current) {
          setGhostPlacement(null);
          return;
        }
        if (selectionRef.current && selectionRef.current.active) {
          clearFreeSelections();
          setSelection(null);
          onSelectSliceRef.current?.('', false);
          onNewSelectionRef.current?.(null);
          return;
        }
      }

      // Undo / Redo
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
        return;
      }

      // Copy
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        const curSel = selectionRef.current;
        if (curSel && curSel.active && curSel.w > 0 && curSel.h > 0) {
          e.preventDefault();
          const extractedPixels = gridRef.current.extractRect(curSel);
          const clipPayload = {
            type: 'bwpx-pixels',
            width: curSel.w,
            height: curSel.h,
            pixels: extractedPixels,
            copiedAt: Date.now(),
          };
          internalClipboardRef.current = clipPayload;

          try {
            navigator.clipboard.writeText(JSON.stringify(clipPayload));
          } catch (err) {
            console.warn('Could not write to system clipboard', err);
          }
        }
        return;
      }

      // Paste
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        const now = Date.now();
        const hasRecentBlur = now - lastBlurTimeRef.current < 1000;

        if (!hasRecentBlur && internalClipboardRef.current) {
          pastePixelsAsGhost(
            internalClipboardRef.current.width,
            internalClipboardRef.current.height,
            internalClipboardRef.current.pixels
          );
          return;
        }

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
        } catch (err) {
          console.warn('System clipboard read error, falling back to internal clipboard:', err);
        }

        if (internalClipboardRef.current) {
          pastePixelsAsGhost(
            internalClipboardRef.current.width,
            internalClipboardRef.current.height,
            internalClipboardRef.current.pixels
          );
        }
        return;
      }

      // Select All (Ctrl+A)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        const b = gridRef.current.getBounds();
        if (b.width > 0 && b.height > 0) {
          const newSel = { x: b.minX, y: b.minY, w: b.width, h: b.height, active: true };
          setSelection(newSel);
          onNewSelectionRef.current?.({ x: b.minX, y: b.minY, width: b.width, height: b.height });
        } else {
          const newSel = { x: 0, y: 0, w: gridRef.current.width, h: gridRef.current.height, active: true };
          setSelection(newSel);
          onNewSelectionRef.current?.({ x: 0, y: 0, width: gridRef.current.width, height: gridRef.current.height });
        }
        return;
      }

      // Delete / Backspace: Clear pixels in active selection
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const curSel = selectionRef.current;
        if (curSel && curSel.active && curSel.w > 0 && curSel.h > 0) {
          e.preventDefault();
          const next = gridRef.current.clone();
          next.clearRect(curSel);
          commitGridState(next);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [clearFreeSelections, commitGridState, handleRedo, handleUndo, moveActiveSelection, pastePixelsAsGhost]);

  // Window blur tracking
  useEffect(() => {
    const handleBlur = () => {
      lastBlurTimeRef.current = Date.now();
    };
    window.addEventListener('blur', handleBlur);
    return () => window.removeEventListener('blur', handleBlur);
  }, []);

  useEffect(() => {
    renderCanvas();
    requestOverlayRender();
  }, [renderCanvas, requestOverlayRender, viewport]);

  useEffect(() => {
    requestOverlayRender();
  }, [selection, movingPixels, ghostPlacement, requestOverlayRender]);

  // Handle Resize of canvas container with ResizeObserver
  useEffect(() => {
    const updateCanvasSize = () => {
      if (containerRef.current && canvasRef.current) {
        const w = containerRef.current.clientWidth;
        const h = containerRef.current.clientHeight;
        if (w > 0 && h > 0) {
          canvasRef.current.width = w;
          canvasRef.current.height = h;
          canvasRectRef.current = canvasRef.current.getBoundingClientRect();
          if (overlayCanvasRef.current) {
            overlayCanvasRef.current.width = w;
            overlayCanvasRef.current.height = h;
          }
          renderCanvas();
          requestOverlayRender();
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
  }, [renderCanvas, requestOverlayRender]);

  // Mouse wheel zoom
  useEffect(() => {
    const target = containerRef.current;
    if (!target) return;

    const onWheelNative = (e: WheelEvent) => {
      e.preventDefault();
      const rect = target.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const delta = e.deltaY < 0 ? 1 : -1;
      const next = calculateZoomAtPoint(zoomRef.current, panRef.current, mouseX, mouseY, delta);
      if (next.zoom !== zoomRef.current || next.pan.x !== panRef.current.x || next.pan.y !== panRef.current.y) {
        zoomRef.current = next.zoom;
        panRef.current = next.pan;
        setViewport(next);
        notifyViewportChange(next);
        renderCanvas();
        requestOverlayRender();
      }
    };

    target.addEventListener('wheel', onWheelNative, { passive: false });
    return () => {
      target.removeEventListener('wheel', onWheelNative);
    };
  }, [renderCanvas, requestOverlayRender, notifyViewportChange]);

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
      <BwpxEditorTopToolbar
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={handleUndo}
        onRedo={handleRedo}
        historyIndex={historyIndex}
        historyLength={history.length}
        brushSize={brushSize}
        onBrushSizeChange={setBrushSize}
        onInvert={handleInvert}
        onFlipH={handleFlipH}
        onFlipV={handleFlipV}
        onRotate90={handleRotate90}
        onExportPNG={handleExportPNG}
        onExportCArray={handleExportCArray}
        onExportJSON={handleExportJSON}
        onImportFile={handleImportFile}
        fileInputRef={fileInputRef}
        showPresets={showPresets}
        gridWidth={grid.width}
        gridHeight={grid.height}
        onPresetChange={handlePresetChange}
        onFitToView={fitToView}
        onOpenBenchmark={() => setIsBenchmarkOpen(true)}
      />

      {/* 2. MAIN WORKSPACE */}
      <div className="bwpx-main-area">
        {/* Left Toolbar */}
        <BwpxEditorSidebar
          activeTool={activeTool}
          onSelectTool={setActiveTool}
          isControlHeld={isControlHeld}
          isShiftHeld={isShiftHeld}
        />

        {/* Center Canvas Viewport */}
        <main
          ref={containerRef}
          className="bwpx-viewport"
          style={{ cursor: getCanvasCursor() }}
          onMouseEnter={() => {
            if (containerRef.current) {
              canvasRectRef.current = containerRef.current.getBoundingClientRect();
            }
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={(e) => handleMouseUp(e)}
          onMouseLeave={handleMouseLeave}
          onContextMenu={handleContextMenu}
        >
          <canvas
            ref={canvasRef}
            className="bwpx-base-canvas"
          />
          <BwpxOverlayCanvas
            ref={overlayCanvasRef}
            className="bwpx-overlay-canvas"
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
            <strong ref={coordsDisplayRef} className="bwpx-status-val">
              --
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

      {/* Performance Benchmark Modal */}
      <BenchmarkOverlay
        isOpen={isBenchmarkOpen}
        onClose={() => setIsBenchmarkOpen(false)}
      />
    </div>
  );
};

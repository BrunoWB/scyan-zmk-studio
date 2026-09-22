/* oxlint-disable react/refs */
import { useState, useRef, useEffect, useCallback } from 'react';
import { PixelGrid as BwpxGrid } from '../core/PixelGrid';
import {
  drawLine,
  floodFill,
  drawBrushDot,
  drawShape,
  calculateShapeEndpoints,
  isShapeTool,
} from '../core/algorithms';
import type { SpriteSlice } from '../../types/zmk';
import type { ToolType, EditorViewport } from '../components/PixelEditor';

export interface UseBwpxCanvasPointerProps {
  grid: BwpxGrid;
  setGrid: (g: BwpxGrid | ((prev: BwpxGrid) => BwpxGrid)) => void;
  viewport: EditorViewport;
  setPan: (action: { x: number; y: number } | ((prev: { x: number; y: number }) => { x: number; y: number })) => void;
  notifyViewportChange: (vp: EditorViewport) => void;
  activeTool: ToolType;
  brushSize: number;
  commitGridState: (
    newGrid: BwpxGrid,
    explicitNewSelection?: { x: number; y: number; w: number; h: number; active: boolean } | null,
    sliceUpdates?: { id: string; prevX: number; prevY: number; newX: number; newY: number }[]
  ) => void;
  selection: { x: number; y: number; w: number; h: number; active: boolean } | null;
  setSelection: (sel: { x: number; y: number; w: number; h: number; active: boolean } | null) => void;
  selectionRef: React.MutableRefObject<{ x: number; y: number; w: number; h: number; active: boolean } | null>;
  movingPixels: {
    originalRect: { x: number; y: number; w: number; h: number };
    pixels: [number, number][];
    offset: { dx: number; dy: number };
    active: boolean;
    sliceRects?: { x: number; y: number; w: number; h: number }[];
  } | null;
  setMovingPixels: (mp: {
    originalRect: { x: number; y: number; w: number; h: number };
    pixels: [number, number][];
    offset: { dx: number; dy: number };
    active: boolean;
    sliceRects?: { x: number; y: number; w: number; h: number }[];
  } | null) => void;
  movingPixelsRef: React.MutableRefObject<{
    originalRect: { x: number; y: number; w: number; h: number };
    pixels: [number, number][];
    offset: { dx: number; dy: number };
    active: boolean;
    sliceRects?: { x: number; y: number; w: number; h: number }[];
  } | null>;
  scheduleMovingPixelsRender: () => void;
  pendingMovingOffsetRef: React.MutableRefObject<{ dx: number; dy: number } | null>;
  ghostPlacement: {
    grid: BwpxGrid;
    pixels: [number, number][];
    x: number;
    y: number;
    width: number;
    height: number;
  } | null;
  setGhostPlacement: (gp: {
    grid: BwpxGrid;
    pixels: [number, number][];
    x: number;
    y: number;
    width: number;
    height: number;
  } | null | ((prev: any) => any)) => void;
  slices: SpriteSlice[];
  slicesRef: React.MutableRefObject<SpriteSlice[]>;
  selectedSliceId: string;
  selectedSliceIdRef?: React.MutableRefObject<string>;
  selectedSliceIds: string[];
  selectedSliceIdsRef: React.MutableRefObject<string[]>;
  pendingSelection?: { x: number; y: number; width: number; height: number } | null;
  onSelectSlice?: (id: string, isMulti?: boolean) => void;
  onSelectSlices?: (ids: string[]) => void;
  onSelectSliceRef: React.MutableRefObject<((id: string, isMulti?: boolean) => void) | undefined>;
  onSelectSlicesRef: React.MutableRefObject<((ids: string[]) => void) | undefined>;
  onNewSelectionRef: React.MutableRefObject<((rect: { x: number; y: number; width: number; height: number } | null) => void) | undefined>;
  onSliceMove?: (sliceId: string, newX: number, newY: number) => void;
  onSlicesMove?: (updates: { id: string; dx: number; dy: number }[]) => void;
  onSliceMoveRef?: React.MutableRefObject<((sliceId: string, newX: number, newY: number) => void) | undefined>;
  onSlicesMoveRef?: React.MutableRefObject<((updates: { id: string; dx: number; dy: number }[]) => void) | undefined>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  containerRef?: React.RefObject<HTMLDivElement | null>;
  canvasRectRef: React.MutableRefObject<DOMRect | null>;
  renderCanvas?: () => void;
  renderWorkingGrid: () => void;
  scheduleStrokeRender: () => void;
  requestOverlayRender: () => void;
  workingGridRef: React.MutableRefObject<BwpxGrid>;
  isDrawingStrokeRef: React.MutableRefObject<boolean>;
  contextMenu: { x: number; y: number } | null;
  setContextMenu: (cm: { x: number; y: number } | null) => void;
  historyRef: React.MutableRefObject<any[]>;
  historyIndexRef: React.MutableRefObject<number>;
  externalHoverPosRef?: React.MutableRefObject<{ x: number; y: number } | null>;
  externalIsPanningRef?: React.MutableRefObject<boolean>;
}

export type UsePixelCanvasPointerProps = UseBwpxCanvasPointerProps;

export function usePixelCanvasPointer({
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
  selectedSliceIds,
  selectedSliceIdsRef,
  pendingSelection,
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
  externalHoverPosRef,
  externalIsPanningRef,
}: UseBwpxCanvasPointerProps) {
  const { zoom, pan } = viewport;
  const zoomRef = useRef(zoom);
  const panRef = useRef(pan);
  useEffect(() => {
    zoomRef.current = zoom;
    panRef.current = pan;
  }, [zoom, pan]);

  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [drawButton, setDrawButton] = useState<number>(0);
  const drawButtonRef = useRef<number>(0);
  const wasErasingRef = useRef<boolean>(false);
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);
  const [dragCurrentPos, setDragCurrentPos] = useState<{ x: number; y: number } | null>(null);
  const [isInsideSelectionOnDown, setIsInsideSelectionOnDown] = useState<boolean>(false);

  const [isSpaceHeld, setIsSpaceHeld] = useState<boolean>(false);
  const [isControlHeld, setIsControlHeld] = useState<boolean>(false);
  const isControlHeldRef = useRef<boolean>(false);
  const [isShiftHeld, setIsShiftHeld] = useState<boolean>(false);
  const isShiftHeldRef = useRef<boolean>(false);
  const [quickMoveMode, setQuickMoveMode] = useState<'drag' | 'zone-select' | null>(null);

  const [isPanning, setIsPanning] = useState<boolean>(false);
  const localIsPanningRef = useRef<boolean>(false);
  const isPanningRef = externalIsPanningRef || localIsPanningRef;
  const [panStart, setPanStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const panStartRef = useRef<{ x: number; y: number } | null>(null);
  const pendingPanRef = useRef<{ x: number; y: number } | null>(null);
  const panRafId = useRef<number | null>(null);
  const strokeRafId = useRef<number | null>(null);

  const localHoverPosRef = useRef<{ x: number; y: number } | null>(null);
  const hoverPosRef = externalHoverPosRef || localHoverPosRef;
  const coordsDisplayRef = useRef<HTMLSpanElement | null>(null);
  const lastDrawPosRef = useRef<{ x: number; y: number } | null>(null);
  const strokeModifiedRef = useRef<boolean>(false);

  // Synchronize modifier keys globally
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        setIsSpaceHeld(true);
      }
      if ((e.key === 'Control' || e.key === 'Meta') && !e.repeat) {
        setIsControlHeld(true);
        isControlHeldRef.current = true;
      }
      if (e.key === 'Shift' && !e.repeat) {
        setIsShiftHeld(true);
        isShiftHeldRef.current = true;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpaceHeld(false);
      }
      if (e.key === 'Control' || e.key === 'Meta') {
        setIsControlHeld(false);
        isControlHeldRef.current = false;
      }
      if (e.key === 'Shift') {
        setIsShiftHeld(false);
        isShiftHeldRef.current = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const schedulePanRender = useCallback(() => {
    if (panRafId.current !== null) return;
    panRafId.current = requestAnimationFrame(() => {
      panRafId.current = null;
      if (!pendingPanRef.current) return;
      const nextPan = pendingPanRef.current;
      panRef.current = nextPan;
      setPan(nextPan);
      notifyViewportChange({ zoom: zoomRef.current, pan: nextPan });
      renderCanvas?.();
      requestOverlayRender();
    });
  }, [setPan, notifyViewportChange, renderCanvas, requestOverlayRender]);

  const getGridCoords = useCallback((clientX: number, clientY: number): { x: number; y: number } | null => {
    const rect = canvasRectRef.current || containerRef?.current?.getBoundingClientRect() || canvasRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const canvasX = clientX - rect.left;
    const canvasY = clientY - rect.top;
    const curZoom = zoomRef.current;
    const curPan = panRef.current;
    const gridX = Math.floor((canvasX - curPan.x) / curZoom);
    const gridY = Math.floor((canvasY - curPan.y) / curZoom);
    return { x: gridX, y: gridY };
  }, [canvasRectRef, containerRef, canvasRef]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (contextMenu) {
      setContextMenu(null);
    }

    if (ghostPlacement) {
      if (e.button === 0) {
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
        setGhostPlacement(null);
      }
      return;
    }

    if (e.button === 1 || isSpaceHeld) {
      drawButtonRef.current = 0;
      setDrawButton(0);
      isPanningRef.current = true;
      setIsPanning(true);
      const currentPan = panRef.current;
      const pStart = { x: Math.round(e.clientX - currentPan.x), y: Math.round(e.clientY - currentPan.y) };
      panStartRef.current = pStart;
      setPanStart(pStart);
      return;
    }

    const coords = getGridCoords(e.clientX, e.clientY);
    if (!coords) return;

    const isQuickMove = isShiftHeldRef.current || e.shiftKey || activeTool === 'move';
    const isSelect = !isQuickMove && (isControlHeldRef.current || e.ctrlKey || e.metaKey || activeTool === 'select');
    const isErasing = !isQuickMove && !isSelect && (e.button === 2 || activeTool === 'eraser');

    if (e.button === 2) {
      if (isSelect || isQuickMove) {
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
          wasErasingRef.current = true;
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
      workingGridRef.current = grid.clone();
      isDrawingStrokeRef.current = true;
      drawBrushDot(workingGridRef.current, coords.x, coords.y, val, brushSize);
      strokeModifiedRef.current = true;
      renderWorkingGrid();
    } else if (activeTool === 'bucket') {
      const temp = grid.clone();
      floodFill(temp, coords.x, coords.y, val);
      commitGridState(temp);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      const pStart = panStartRef.current || panStart;
      const newX = Math.round(e.clientX - pStart.x);
      const newY = Math.round(e.clientY - pStart.y);
      pendingPanRef.current = { x: newX, y: newY };
      schedulePanRender();
      return;
    }

    const coords = getGridCoords(e.clientX, e.clientY);
    hoverPosRef.current = coords;
    if (coordsDisplayRef.current) {
      coordsDisplayRef.current.textContent = coords
        ? `${coords.x >= 0 ? '+' : ''}${coords.x}, ${coords.y >= 0 ? '+' : ''}${coords.y}`
        : '--';
    }
    requestOverlayRender();

    if (!coords) return;

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

    if (isDrawing && quickMoveMode === 'zone-select' && startPos) {
      const minX = Math.min(startPos.x, coords.x);
      const minY = Math.min(startPos.y, coords.y);
      const w = Math.abs(coords.x - startPos.x) + 1;
      const h = Math.abs(coords.y - startPos.y) + 1;
      selectionRef.current = { x: minX, y: minY, w, h, active: true };
      requestOverlayRender();
      return;
    }

    if (movingPixels && isDrawing && startPos) {
      const dx = coords.x - startPos.x;
      const dy = coords.y - startPos.y;
      pendingMovingOffsetRef.current = { dx, dy };
      if (movingPixelsRef.current) {
        movingPixelsRef.current = { ...movingPixelsRef.current, offset: { dx, dy } };
      }
      requestOverlayRender();
      scheduleMovingPixelsRender();
      return;
    }

    const isErasing = drawButtonRef.current === 2;
    const isSelect = !isErasing && (isControlHeldRef.current || e.ctrlKey || e.metaKey || activeTool === 'select');

    if (isSelect) {
      if (isDrawing && startPos) {
        const dx = coords.x - startPos.x;
        const dy = coords.y - startPos.y;
        const hasMoved = Math.abs(dx) > 0 || Math.abs(dy) > 0;

        if (isInsideSelectionOnDown && selection) {
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
            pendingMovingOffsetRef.current = { dx, dy };
            if (movingPixelsRef.current) {
              movingPixelsRef.current = { ...movingPixelsRef.current, offset: { dx, dy } };
            }
            requestOverlayRender();
            scheduleMovingPixelsRender();
          }
          return;
        }

        if (hasMoved) {
          const minX = Math.min(startPos.x, coords.x);
          const minY = Math.min(startPos.y, coords.y);
          const w = Math.abs(coords.x - startPos.x) + 1;
          const h = Math.abs(coords.y - startPos.y) + 1;
          selectionRef.current = { x: minX, y: minY, w, h, active: true };
          requestOverlayRender();
        }
        return;
      }
      return;
    }

    if (!isDrawing) return;

    if (isErasing || activeTool === 'pencil') {
      const val = isErasing ? 0 : 1;
      const last = lastDrawPosRef.current || startPos || coords;
      drawLine(workingGridRef.current, last.x, last.y, coords.x, coords.y, val, brushSize);
      lastDrawPosRef.current = coords;
      strokeModifiedRef.current = true;
      scheduleStrokeRender();
      return;
    }

    if (isShapeTool(activeTool) && startPos) {
      setDragCurrentPos(coords);
      const endpoints = calculateShapeEndpoints(activeTool, startPos, coords, {
        shiftKey: e.shiftKey || isShiftHeldRef.current,
        ctrlKey: e.ctrlKey || isControlHeldRef.current,
      });
      workingGridRef.current = grid.clone();
      isDrawingStrokeRef.current = true;
      drawShape(
        workingGridRef.current,
        activeTool,
        endpoints.x0,
        endpoints.y0,
        endpoints.x1,
        endpoints.y1,
        1,
        brushSize
      );
      scheduleStrokeRender();
      return;
    }

    setDragCurrentPos(coords);
  };

  const handleMouseUp = (e?: React.MouseEvent) => {
    if (ghostPlacement) {
      return;
    }

    if (isPanning) {
      if (panRafId.current !== null) {
        cancelAnimationFrame(panRafId.current);
        panRafId.current = null;
      }
      const finalPan = pendingPanRef.current || panRef.current;
      panRef.current = finalPan;
      if (pendingPanRef.current) {
        setPan(pendingPanRef.current);
        pendingPanRef.current = null;
      }
      setIsPanning(false);
      isPanningRef.current = false;
      notifyViewportChange({ zoom: zoomRef.current, pan: finalPan });
      renderCanvas?.();
      requestOverlayRender();
      return;
    }

    if (quickMoveMode === 'zone-select') {
      setQuickMoveMode(null);
      setIsDrawing(false);
      const endCoords = hoverPosRef.current || dragCurrentPos || startPos;
      if (startPos && endCoords) {
        const minX = Math.min(startPos.x, endCoords.x);
        const minY = Math.min(startPos.y, endCoords.y);
        const w = Math.abs(endCoords.x - startPos.x) + 1;
        const h = Math.abs(endCoords.y - startPos.y) + 1;

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

    if (movingPixels && movingPixels.active) {
      const targetX = movingPixels.originalRect.x + movingPixels.offset.dx;
      const targetY = movingPixels.originalRect.y + movingPixels.offset.dy;
      const next = grid.clone();

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

      const currentIdx = historyIndexRef.current;
      if (historyRef.current[currentIdx]) {
        historyRef.current[currentIdx] = {
          ...historyRef.current[currentIdx],
          selection: originalSelection,
        };
      }

      const sliceUpdates: { id: string; prevX: number; prevY: number; newX: number; newY: number }[] = [];
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

      const effectiveOnSlicesMove = onSlicesMoveRef?.current || onSlicesMove;
      const effectiveOnSliceMove = onSliceMoveRef?.current || onSliceMove;

      if (selectedSliceIds && selectedSliceIds.length > 0 && effectiveOnSlicesMove) {
        effectiveOnSlicesMove(selectedSliceIds.map(id => ({ id, dx: movingPixels.offset.dx, dy: movingPixels.offset.dy })));
      } else if (selectedSliceId && effectiveOnSliceMove) {
        const s = slices?.find(item => item.id === selectedSliceId);
        const nextX = s ? s.x + movingPixels.offset.dx : targetX;
        const nextY = s ? s.y + movingPixels.offset.dy : targetY;
        effectiveOnSliceMove(selectedSliceId, nextX, nextY);
      } else if (slices && effectiveOnSliceMove && sliceUpdates.length > 0) {
        effectiveOnSliceMove(sliceUpdates[0].id, sliceUpdates[0].newX, sliceUpdates[0].newY);
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
      const endCoords = hoverPosRef.current || dragCurrentPos || startPos;
      const hasDragged =
        startPos && endCoords &&
        (Math.abs(endCoords.x - startPos.x) > 0 || Math.abs(endCoords.y - startPos.y) > 0);

      setIsDrawing(false);
      setIsInsideSelectionOnDown(false);

      if (!hasDragged && startPos) {
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
        onSelectSliceRef.current?.('', e?.ctrlKey || e?.metaKey);
        setSelection(null);
        setStartPos(null);
        setDragCurrentPos(null);
        return;
      }

      if (hasDragged && startPos && endCoords) {
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

    if (strokeModifiedRef.current) {
      if (strokeRafId.current !== null) {
        cancelAnimationFrame(strokeRafId.current);
        strokeRafId.current = null;
      }
      isDrawingStrokeRef.current = false;
      const finalGrid = workingGridRef.current;
      commitGridState(finalGrid);
      setGrid(finalGrid);
      strokeModifiedRef.current = false;
    }

    if (isDrawing && startPos && (dragCurrentPos || hoverPosRef.current) && !isErasing) {
      const endCoords = hoverPosRef.current || dragCurrentPos || startPos;
      const val = 1;
      const temp = grid.clone();

      if (isShapeTool(activeTool)) {
        const endpoints = calculateShapeEndpoints(activeTool, startPos, endCoords, {
          shiftKey: e?.shiftKey || isShiftHeldRef.current,
          ctrlKey: e?.ctrlKey || isControlHeldRef.current,
        });
        drawShape(
          temp,
          activeTool,
          endpoints.x0,
          endpoints.y0,
          endpoints.x1,
          endpoints.y1,
          val,
          brushSize
        );
        isDrawingStrokeRef.current = false;
        commitGridState(temp);
      }
    }

    setIsDrawing(false);
    isDrawingStrokeRef.current = false;
    setStartPos(null);
    setDragCurrentPos(null);
    lastDrawPosRef.current = null;
    drawButtonRef.current = 0;
    setDrawButton(0);
  };

  const handleMouseLeave = () => {
    hoverPosRef.current = null;
    if (coordsDisplayRef.current) {
      coordsDisplayRef.current.textContent = '--';
    }
    requestOverlayRender();
    const wasPanning = isPanningRef.current;
    if (panRafId.current !== null) {
      cancelAnimationFrame(panRafId.current);
      panRafId.current = null;
    }
    const finalPan = pendingPanRef.current || panRef.current;
    if (pendingPanRef.current) {
      setPan(pendingPanRef.current);
      pendingPanRef.current = null;
    }
    setIsPanning(false);
    isPanningRef.current = false;
    if (wasPanning) {
      notifyViewportChange({ zoom: zoomRef.current, pan: finalPan });
    }
    drawButtonRef.current = 0;
    setDrawButton(0);
    if (movingPixels && movingPixels.active) {
      handleMouseUp();
    } else {
      if (strokeModifiedRef.current) {
        if (strokeRafId.current !== null) {
          cancelAnimationFrame(strokeRafId.current);
          strokeRafId.current = null;
        }
        isDrawingStrokeRef.current = false;
        const finalGrid = workingGridRef.current;
        commitGridState(finalGrid);
        setGrid(finalGrid);
        strokeModifiedRef.current = false;
      }
      setIsDrawing(false);
      setIsInsideSelectionOnDown(false);
      setStartPos(null);
      setDragCurrentPos(null);
      lastDrawPosRef.current = null;
    }
  };

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
      const hp = hoverPosRef.current;
      if (
        hp &&
        selection &&
        selection.active &&
        hp.x >= selection.x &&
        hp.x < selection.x + selection.w &&
        hp.y >= selection.y &&
        hp.y < selection.y + selection.h
      ) {
        return 'grab';
      }
      return 'crosshair';
    }
    return 'crosshair';
  };

  return {
    isDrawing,
    drawButton,
    isPanning,
    isSpaceHeld,
    isControlHeld,
    isShiftHeld,
    hoverPosRef,
    coordsDisplayRef,
    wasErasingRef,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleMouseLeave,
    getCanvasCursor,
    getGridCoords,
  };
}

export const useBwpxCanvasPointer = usePixelCanvasPointer;

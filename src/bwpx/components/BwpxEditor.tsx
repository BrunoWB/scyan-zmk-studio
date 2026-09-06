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
import './BwpxEditor.css';

export type ToolType =
  | 'pencil'
  | 'eraser'
  | 'bucket'
  | 'select'
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

export interface BwpxEditorProps {
  initialWidth?: number;
  initialHeight?: number;
  initialGrid?: BwpxGrid;
  onGridChange?: (grid: BwpxGrid) => void;
  title?: string;
  showPresets?: boolean;
  slices?: SpriteSlice[];
  selectedSliceId?: string;
  onSelectSlice?: (id: string) => void;
  onNewSelection?: (rect: { x: number; y: number; width: number; height: number }) => void;
  onSliceMove?: (sliceId: string, newX: number, newY: number) => void;
  externalTool?: ToolType;
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
  onSelectSlice,
  onNewSelection,
  onSliceMove,
  externalTool,
}) => {
  const [grid, setGrid] = useState<BwpxGrid>(
    () => initialGrid?.clone() ?? new BwpxGrid(initialWidth, initialHeight)
  );
  const [history, setHistory] = useState<BwpxGrid[]>([
    initialGrid?.clone() ?? new BwpxGrid(initialWidth, initialHeight),
  ]);
  const [historyIndex, setHistoryIndex] = useState<number>(0);

  const [activeTool, setActiveTool] = useState<ToolType>(externalTool || 'pencil');

  useEffect(() => {
    if (externalTool) {
      setActiveTool(externalTool);
    }
  }, [externalTool]);
  const [brushSize, setBrushSize] = useState<number>(1);
  const [zoom, setZoom] = useState<number>(10); // pixels per cell
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 300, y: 200 });

  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [drawButton, setDrawButton] = useState<number>(0);
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);
  const [isSpaceHeld, setIsSpaceHeld] = useState<boolean>(false);
  const [dragCurrentPos, setDragCurrentPos] = useState<{ x: number; y: number } | null>(null);

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
  } | null>(null);
  const [isInsideSelectionOnDown, setIsInsideSelectionOnDown] = useState<boolean>(false);

  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const [modalContent, setModalContent] = useState<{ title: string; text: string } | null>(null);
  const [copiedNotification, setCopiedNotification] = useState<boolean>(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Sync when initialGrid changes from outside (e.g. discard changes or repo sync)
  const lastCommittedRef = useRef<BwpxGrid | null>(null);
  useEffect(() => {
    if (initialGrid && initialGrid !== lastCommittedRef.current) {
      setGrid(initialGrid.clone());
      setHistory([initialGrid.clone()]);
      setHistoryIndex(0);
    }
  }, [initialGrid]);

  // Sync selection when selectedSliceId changes from inspector or outside
  useEffect(() => {
    if (isDrawing || movingPixels) return;
    if (selectedSliceId && slices && slices.length > 0) {
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
  }, [selectedSliceId, slices, isDrawing, movingPixels]);

  const commitGridState = useCallback(
    (newGrid: BwpxGrid) => {
      lastCommittedRef.current = newGrid;
      const nextHistory = history.slice(0, historyIndex + 1);
      nextHistory.push(newGrid.clone());
      setHistory(nextHistory);
      setHistoryIndex(nextHistory.length - 1);
      setGrid(newGrid);
      onGridChange?.(newGrid);
    },
    [history, historyIndex, onGridChange]
  );

  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      const nextIdx = historyIndex - 1;
      setHistoryIndex(nextIdx);
      const nextGrid = history[nextIdx].clone();
      lastCommittedRef.current = nextGrid;
      setGrid(nextGrid);
      onGridChange?.(nextGrid);
    }
  }, [historyIndex, history, onGridChange]);

  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const nextIdx = historyIndex + 1;
      setHistoryIndex(nextIdx);
      const nextGrid = history[nextIdx].clone();
      lastCommittedRef.current = nextGrid;
      setGrid(nextGrid);
      onGridChange?.(nextGrid);
    }
  }, [historyIndex, history, onGridChange]);

  const gridRef = useRef<BwpxGrid>(grid);
  gridRef.current = grid;

  // Center view on (0, 0) origin with reasonable zoom (manual or once on mount)
  const fitToView = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const b = gridRef.current.getBounds();
    const targetW = b.width > 0 ? Math.max(b.width, 64) : 128;
    const targetH = b.height > 0 ? Math.max(b.height, 32) : 34;

    const fitZoom = Math.min(18, Math.max(4, Math.floor(Math.min((rect.width - 100) / targetW, (rect.height - 100) / targetH))));
    setZoom(fitZoom);

    // If pixels exist, center the bounding box around origin/center
    if (b.width > 0) {
      const centerX = b.minX + b.width / 2;
      const centerY = b.minY + b.height / 2;
      setPan({
        x: Math.round(rect.width / 2 - centerX * fitZoom),
        y: Math.round(rect.height / 2 - centerY * fitZoom),
      });
    } else {
      setPan({
        x: Math.round(rect.width / 2),
        y: Math.round(rect.height / 2),
      });
    }
  }, []);

  // Only auto-fit once on initial mount
  useEffect(() => {
    const timer = setTimeout(() => {
      fitToView();
    }, 40);
    return () => clearTimeout(timer);
  }, [fitToView]);

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

  // Spacebar tracking for panning
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat) {
        setIsSpaceHeld(true);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpaceHeld(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  // Render canvas loop
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Deep studio infinite canvas background
    ctx.fillStyle = '#0b0d11';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Visible viewport grid bounds
    const startGridX = Math.floor(-pan.x / zoom);
    const endGridX = Math.ceil((canvas.width - pan.x) / zoom);
    const startGridY = Math.floor(-pan.y / zoom);
    const endGridY = Math.ceil((canvas.height - pan.y) / zoom);

    // 1. Subtle infinite grid lines
    if (zoom >= 5) {
      ctx.save();
      ctx.translate(pan.x, pan.y);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = startGridX; x <= endGridX; x++) {
        ctx.moveTo(x * zoom, startGridY * zoom);
        ctx.lineTo(x * zoom, endGridY * zoom);
      }
      for (let y = startGridY; y <= endGridY; y++) {
        ctx.moveTo(startGridX * zoom, y * zoom);
        ctx.lineTo(endGridX * zoom, y * zoom);
      }
      ctx.stroke();
      ctx.restore();
    }

    // 2. Coordinate Axes (X axis and Y axis crossing at 0, 0)
    const originX = pan.x;
    const originY = pan.y;

    // Horizontal X-axis (y = 0) - faint white
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, originY);
    ctx.lineTo(canvas.width, originY);
    ctx.stroke();

    // Vertical Y-axis (x = 0) - faint white
    ctx.beginPath();
    ctx.moveTo(originX, 0);
    ctx.lineTo(originX, canvas.height);
    ctx.stroke();

    // Origin (0,0) center point marker - faint white
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.beginPath();
    ctx.arc(originX, originY, 2.5, 0, Math.PI * 2);
    ctx.fill();

    if (zoom >= 8) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.fillText('(0, 0)', originX + 5, originY - 5);
    }

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

    ctx.save();
    ctx.translate(pan.x, pan.y);

    // 3. Draw active pixels
    ctx.fillStyle = '#00d2ff';
    const allPixels = displayGrid.getAllPixels();
    for (let i = 0; i < allPixels.length; i++) {
      const [x, y] = allPixels[i];
      if (x >= startGridX && x <= endGridX && y >= startGridY && y <= endGridY) {
        ctx.fillRect(x * zoom, y * zoom, zoom, zoom);
      }
    }

    // 4. Ghost image preview during pixel move drag
    if (movingPixels && movingPixels.active) {
      const targetX = movingPixels.originalRect.x + movingPixels.offset.dx;
      const targetY = movingPixels.originalRect.y + movingPixels.offset.dy;

      // Translucent ghost preview during drag (purple accent)
      ctx.fillStyle = 'rgba(192, 132, 252, 0.7)';
      ctx.shadowColor = '#c084fc';
      ctx.shadowBlur = 10;
      movingPixels.pixels.forEach(([relX, relY]) => {
        ctx.fillRect((targetX + relX) * zoom, (targetY + relY) * zoom, zoom, zoom);
      });
      ctx.shadowBlur = 0;

      // Ghost marquee
      ctx.strokeStyle = '#c084fc';
      ctx.fillStyle = 'rgba(192, 132, 252, 0.12)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(
        targetX * zoom,
        targetY * zoom,
        movingPixels.originalRect.w * zoom,
        movingPixels.originalRect.h * zoom
      );
      ctx.fillRect(
        targetX * zoom,
        targetY * zoom,
        movingPixels.originalRect.w * zoom,
        movingPixels.originalRect.h * zoom
      );
      ctx.setLineDash([]);
    }

    // 5. Sprite Slices Overlay on canvas
    if (slices && slices.length > 0) {
      slices.forEach(s => {
        const isSelected = selectedSliceId === s.id;
        const sx = s.x * zoom;
        const sy = s.y * zoom;
        const sw = s.width * zoom;
        const sh = s.height * zoom;

        ctx.strokeStyle = isSelected ? '#c084fc' : (s.color || 'rgba(168, 85, 247, 0.45)');
        ctx.lineWidth = isSelected ? 2 : 1;
        if (!isSelected) {
          ctx.setLineDash([3, 3]);
        } else {
          ctx.setLineDash([]);
          ctx.shadowColor = '#c084fc';
          ctx.shadowBlur = 8;
        }
        ctx.strokeRect(sx, sy, sw, sh);
        ctx.shadowBlur = 0;
        ctx.setLineDash([]);

        // Slice badge label
        if (zoom >= 6) {
          const label = `${s.name} (${s.width}×${s.height})`;
          ctx.font = '10px "JetBrains Mono", monospace';
          const textWidth = ctx.measureText(label).width;
          ctx.fillStyle = isSelected ? 'rgba(192, 132, 252, 0.95)' : 'rgba(18, 20, 26, 0.85)';
          ctx.fillRect(sx, sy - 15, textWidth + 8, 14);
          ctx.fillStyle = isSelected ? '#090a0d' : '#cbd5e1';
          ctx.fillText(label, sx + 4, sy - 4);
        }
      });
    }

    // 6. Selection Marquee (when not moving pixels) - vibrant purple
    if (selection && selection.active && (!movingPixels || !movingPixels.active)) {
      ctx.strokeStyle = '#c084fc';
      ctx.fillStyle = 'rgba(192, 132, 252, 0.12)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(
        selection.x * zoom,
        selection.y * zoom,
        selection.w * zoom,
        selection.h * zoom
      );
      ctx.fillRect(
        selection.x * zoom,
        selection.y * zoom,
        selection.w * zoom,
        selection.h * zoom
      );
      ctx.setLineDash([]);
    }

    // 7. Hover brush indicator
    if (hoverPos) {
      const half = Math.floor(brushSize / 2);
      ctx.strokeStyle = 'rgba(0, 229, 163, 0.6)';
      ctx.lineWidth = 1;
      ctx.strokeRect(
        (hoverPos.x - half) * zoom,
        (hoverPos.y - half) * zoom,
        brushSize * zoom,
        brushSize * zoom
      );
    }

    ctx.restore();
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
    slices,
    selectedSliceId,
    hoverPos,
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
    // Middle click or spacebar -> Pan
    if (e.button === 1 || isSpaceHeld) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      return;
    }

    const coords = getGridCoords(e.clientX, e.clientY);
    if (!coords) return;

    // Shift key enables rapid selection
    if (e.shiftKey) {
      setActiveTool('select');
      setIsDrawing(true);
      setStartPos(coords);
      setDragCurrentPos(coords);
      setIsInsideSelectionOnDown(false);
      return;
    }

    if (activeTool === 'select') {
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

    // Normal drawing tools
    setIsDrawing(true);
    setDrawButton(e.button); // 0 = left draw, 2 = right erase
    setStartPos(coords);
    setDragCurrentPos(coords);

    if (activeTool === 'pencil' || activeTool === 'eraser') {
      const temp = grid.clone();
      const val = e.button === 2 || activeTool === 'eraser' ? 0 : 1;
      drawBrushDot(temp, coords.x, coords.y, val, brushSize);
      commitGridState(temp);
    } else if (activeTool === 'bucket') {
      const temp = grid.clone();
      const val = e.button === 2 ? 0 : 1;
      floodFill(temp, coords.x, coords.y, val);
      commitGridState(temp);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
      return;
    }

    const coords = getGridCoords(e.clientX, e.clientY);
    setHoverPos(coords);

    if (!coords) return;

    if (activeTool === 'select') {
      if (isDrawing && startPos) {
        setDragCurrentPos(coords);
        const dx = coords.x - startPos.x;
        const dy = coords.y - startPos.y;
        const hasMoved = Math.abs(dx) > 0 || Math.abs(dy) > 0;

        if (isInsideSelectionOnDown && selection) {
          // User started drag INSIDE an active selection marquee -> Move pixels!
          if (!movingPixels && hasMoved) {
            // Lift pixels now that drag has actually started
            const extracted = grid.extractRect({
              x: selection.x,
              y: selection.y,
              w: selection.w,
              h: selection.h,
            });
            const temp = grid.clone();
            temp.clearRect({
              x: selection.x,
              y: selection.y,
              w: selection.w,
              h: selection.h,
            });
            setGrid(temp);
            setMovingPixels({
              originalRect: { ...selection },
              pixels: extracted,
              offset: { dx, dy },
              active: true,
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

        // Free select marquee (even if started inside an existing sprite!)
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

    if (activeTool === 'pencil' || activeTool === 'eraser') {
      const val = drawButton === 2 || activeTool === 'eraser' ? 0 : 1;
      if (grid.get(coords.x, coords.y) !== val) {
        const temp = grid.clone();
        if (startPos) {
          drawLine(temp, startPos.x, startPos.y, coords.x, coords.y, val, brushSize);
        } else {
          drawBrushDot(temp, coords.x, coords.y, val, brushSize);
        }
        setStartPos(coords);
        commitGridState(temp);
      }
    }
  };

  const handleMouseUp = () => {
    if (isPanning) {
      setIsPanning(false);
      return;
    }

    // Finished moving selected pixels
    if (movingPixels && movingPixels.active) {
      const targetX = movingPixels.originalRect.x + movingPixels.offset.dx;
      const targetY = movingPixels.originalRect.y + movingPixels.offset.dy;
      const next = grid.clone();
      movingPixels.pixels.forEach(([relX, relY]) => {
        next.set(targetX + relX, targetY + relY, 1);
      });
      commitGridState(next);
      setSelection({
        x: targetX,
        y: targetY,
        w: movingPixels.originalRect.w,
        h: movingPixels.originalRect.h,
        active: true,
      });

      // Update slice coordinates if this move was on a valid slice selection
      if (selectedSliceId && onSliceMove) {
        onSliceMove(selectedSliceId, targetX, targetY);
      } else if (slices && onSliceMove) {
        const matchingSlice = slices.find(
          s =>
            s.x === movingPixels.originalRect.x &&
            s.y === movingPixels.originalRect.y &&
            s.width === movingPixels.originalRect.w &&
            s.height === movingPixels.originalRect.h
        );
        if (matchingSlice) {
          onSliceMove(matchingSlice.id, targetX, targetY);
        }
      }

      setMovingPixels(null);
      setIsInsideSelectionOnDown(false);
      setIsDrawing(false);
      setStartPos(null);
      setDragCurrentPos(null);
      return;
    }

    if (isDrawing && activeTool === 'select') {
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
            onSelectSlice?.(clickedSlice.id);
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
        onSelectSlice?.('');
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
        onNewSelection?.({ x: minX, y: minY, width: w, height: h });
        setStartPos(null);
        setDragCurrentPos(null);
        return;
      }
    }

    // Finished dragging a geometric shape
    if (isDrawing && startPos && dragCurrentPos) {
      const val = drawButton === 2 ? 0 : 1;
      const temp = grid.clone();

      if (activeTool !== 'pencil' && activeTool !== 'eraser' && activeTool !== 'bucket' && activeTool !== 'select') {
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
  };

  // Zoom with mouse wheel centered at cursor (non-passive to allow preventDefault safely)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onWheelNative = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      setZoom(prevZoom => {
        let nextZoom: number;
        if (e.deltaY < 0) {
          // Zoom in: guarantee at least +1 step to prevent rounding lock (e.g. 2 * 1.2 = 2.4 => 2)
          nextZoom = Math.max(prevZoom + 1, Math.round(prevZoom * 1.25));
        } else {
          // Zoom out: guarantee at least -1 step
          nextZoom = Math.min(prevZoom - 1, Math.round(prevZoom * 0.8));
        }
        nextZoom = Math.min(64, Math.max(1, nextZoom));

        if (nextZoom !== prevZoom) {
          setPan(prevPan => ({
            x: Math.round(mouseX - ((mouseX - prevPan.x) * nextZoom) / prevZoom),
            y: Math.round(mouseY - ((mouseY - prevPan.y) * nextZoom) / prevZoom),
          }));
          return nextZoom;
        }
        return prevZoom;
      });
    };

    canvas.addEventListener('wheel', onWheelNative, { passive: false });
    return () => {
      canvas.removeEventListener('wheel', onWheelNative);
    };
  }, []);

  const getCanvasCursor = () => {
    if (isPanning) return 'grabbing';
    if (isSpaceHeld) return 'grab';
    if (activeTool === 'select') {
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

    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = ev => {
        const img = new Image();
        img.onload = () => {
          const off = document.createElement('canvas');
          off.width = img.width;
          off.height = img.height;
          const octx = off.getContext('2d');
          if (!octx) return;
          octx.drawImage(img, 0, 0);
          const imgData = octx.getImageData(0, 0, img.width, img.height);
          const next = new BwpxGrid(img.width, img.height);
          for (let y = 0; y < img.height; y++) {
            for (let x = 0; x < img.width; x++) {
              const idx = (y * img.width + x) * 4;
              const brightness = (imgData.data[idx] + imgData.data[idx + 1] + imgData.data[idx + 2]) / 3;
              if (brightness > 127) {
                next.set(x, y, 1);
              }
            }
          }
          commitGridState(next);
          fitToView();
        };
        img.src = ev.target?.result as string;
      };
      reader.readAsDataURL(file);
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
            <input type="file" accept=".png,.bmp,.json" onChange={handleImportFile} style={{ display: 'none' }} />
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
            className={`bwpx-tool-btn ${activeTool === 'pencil' ? 'active' : ''}`}
            title="Pencil (Left click draws)"
          >
            <Pencil size={15} />
          </button>

          <div className="has-tooltip">
            <button
              onClick={() => setActiveTool('eraser')}
              className={`bwpx-tool-btn ${activeTool === 'eraser' ? 'active' : ''}`}
            >
              <Eraser size={15} />
            </button>
            <div className="tooltip">Right-click to erase</div>
          </div>

          <button
            onClick={() => setActiveTool('bucket')}
            className={`bwpx-tool-btn ${activeTool === 'bucket' ? 'active' : ''}`}
            title="Flood Fill Bucket"
          >
            <PaintBucket size={15} />
          </button>

          <div className="has-tooltip">
            <button
              onClick={() => setActiveTool('select')}
              className={`bwpx-tool-btn tool-select ${activeTool === 'select' ? 'active' : ''}`}
              title="Selection Tool (Click to select slice, drag to free-select or move)"
            >
              <MousePointer2 size={15} />
            </button>
            <div className="tooltip">Click slice / Drag select</div>
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
          onContextMenu={e => e.preventDefault()}
        >
          <canvas
            ref={canvasRef}
            style={{ cursor: getCanvasCursor() }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={() => {
              setHoverPos(null);
              setIsPanning(false);
              if (movingPixels && movingPixels.active) {
                handleMouseUp();
              } else {
                setIsDrawing(false);
                setIsInsideSelectionOnDown(false);
              }
            }}
          />
        </main>
      </div>

      {/* 3. BOTTOM STATUS BAR */}
      <footer className="bwpx-statusbar">
        <div className="bwpx-status-left">
          <span className="bwpx-status-tool">{activeTool}</span>
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
            Zoom: <strong className="bwpx-status-val">{zoom * 100}%</strong>
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
    </div>
  );
};

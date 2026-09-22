import { useState, useRef, useCallback, useEffect } from 'react';
import { PixelGrid, PixelGrid as BwpxGrid } from '../core/PixelGrid';

export interface HistoryEntry {
  grid: PixelGrid;
  selection: { x: number; y: number; w: number; h: number; active: boolean } | null;
  sliceUpdates?: { id: string; prevX: number; prevY: number; newX: number; newY: number }[];
}

export interface UsePixelHistoryOptions {
  initialGrid?: PixelGrid;
  initialWidth?: number;
  initialHeight?: number;
  onGridChange?: (grid: PixelGrid) => void;
  onSliceMoveRef?: React.MutableRefObject<((sliceId: string, newX: number, newY: number) => void) | undefined>;
  onSlicesMoveRef?: React.MutableRefObject<((updates: { id: string; dx: number; dy: number }[]) => void) | undefined>;
  selectionRef?: React.MutableRefObject<{ x: number; y: number; w: number; h: number; active: boolean } | null>;
  setSelection?: (sel: { x: number; y: number; w: number; h: number; active: boolean } | null) => void;
}

export type UseBwpxHistoryOptions = UsePixelHistoryOptions;

export function usePixelHistory({
  initialGrid,
  initialWidth = 128,
  initialHeight = 34,
  onGridChange,
  onSliceMoveRef,
  onSlicesMoveRef,
  selectionRef,
  setSelection,
}: UsePixelHistoryOptions) {
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
  const lastCommittedRef = useRef<BwpxGrid | null>(null);

  // Sync when initialGrid changes from outside (e.g. discard changes or repo sync)
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
        if (selectionRef?.current && !nextHistory[currentIdx].selection) {
          nextHistory[currentIdx] = {
            ...nextHistory[currentIdx],
            selection: { ...selectionRef.current },
          };
        }
      }

      const finalSelection = explicitNewSelection !== undefined
        ? (explicitNewSelection ? { ...explicitNewSelection } : null)
        : (selectionRef?.current ? { ...selectionRef.current } : null);

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
      if (explicitNewSelection !== undefined && setSelection) {
        setSelection(explicitNewSelection);
      }
      onGridChange?.(newGrid);
    },
    [onGridChange, selectionRef, setSelection]
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
      if (setSelection) {
        setSelection(targetEntry.selection ? { ...targetEntry.selection } : null);
      }

      // If currentEntry had sliceUpdates, revert slices to original coordinates
      if (currentEntry.sliceUpdates && currentEntry.sliceUpdates.length > 0) {
        if (onSlicesMoveRef?.current) {
          onSlicesMoveRef.current(
            currentEntry.sliceUpdates.map(u => ({
              id: u.id,
              dx: u.prevX - u.newX,
              dy: u.prevY - u.newY,
            }))
          );
        } else if (onSliceMoveRef?.current) {
          currentEntry.sliceUpdates.forEach(u => {
            onSliceMoveRef.current?.(u.id, u.prevX, u.prevY);
          });
        }
      }

      onGridChange?.(nextGrid);
    }
  }, [onGridChange, onSliceMoveRef, onSlicesMoveRef, setSelection]);

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
      if (setSelection) {
        setSelection(targetEntry.selection ? { ...targetEntry.selection } : null);
      }

      // If targetEntry had sliceUpdates, re-apply them forward
      if (targetEntry.sliceUpdates && targetEntry.sliceUpdates.length > 0) {
        if (onSlicesMoveRef?.current) {
          onSlicesMoveRef.current(
            targetEntry.sliceUpdates.map(u => ({
              id: u.id,
              dx: u.newX - u.prevX,
              dy: u.newY - u.prevY,
            }))
          );
        } else if (onSliceMoveRef?.current) {
          targetEntry.sliceUpdates.forEach(u => {
            onSliceMoveRef.current?.(u.id, u.newX, u.newY);
          });
        }
      }

      onGridChange?.(nextGrid);
    }
  }, [onGridChange, onSliceMoveRef, onSlicesMoveRef, setSelection]);

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  const resetHistory = useCallback((newGrid: BwpxGrid) => {
    const cloned = newGrid.clone();
    historyRef.current = [{ grid: cloned.clone(), selection: null }];
    historyIndexRef.current = 0;
    setGrid(cloned);
    setHistory([{ grid: cloned.clone(), selection: null }]);
    setHistoryIndex(0);
    lastCommittedRef.current = cloned;
  }, []);

  return {
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
    resetHistory,
  };
}

export const useBwpxHistory = usePixelHistory;

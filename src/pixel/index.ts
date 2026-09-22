export {
  PixelEditor,
  PixelEditor as BwpxEditor,
  calculateFitViewport,
  calculateZoomAtPoint,
  ZOOM_STEPS,
  WHEEL_ZOOM_THRESHOLD,
  processWheelZoomDelta,
} from './components/PixelEditor';
export type {
  PixelEditorProps,
  PixelEditorProps as BwpxEditorProps,
  ToolType,
  EditorViewport,
  HistoryEntry,
} from './components/PixelEditor';

export { usePixelHistory, usePixelHistory as useBwpxHistory } from './hooks/usePixelHistory';
export { usePixelCanvasPointer, usePixelCanvasPointer as useBwpxCanvasPointer } from './hooks/usePixelCanvasPointer';
export {
  PixelEditorTopToolbar,
  PixelEditorSidebar,
  PixelEditorTopToolbar as BwpxEditorTopToolbar,
  PixelEditorSidebar as BwpxEditorSidebar,
} from './components/PixelEditorToolbar';
export {
  PixelOverlayCanvas,
  PixelOverlayCanvas as BwpxOverlayCanvas,
} from './components/PixelOverlayCanvas';
export { PixelGrid, PixelGrid as BwpxGrid } from './core/PixelGrid';
export * from './core/algorithms';

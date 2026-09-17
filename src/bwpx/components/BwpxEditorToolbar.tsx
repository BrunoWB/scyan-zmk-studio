import React from 'react';
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
  Activity,
} from 'lucide-react';

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

export interface BwpxEditorToolbarProps {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  historyIndex: number;
  historyLength: number;
  brushSize: number;
  onBrushSizeChange: (size: number) => void;
  onInvert: () => void;
  onFlipH: () => void;
  onFlipV: () => void;
  onRotate90: () => void;
  onExportPNG: () => void;
  onExportCArray: () => void;
  onExportJSON: () => void;
  onImportFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  showPresets?: boolean;
  gridWidth: number;
  gridHeight: number;
  onPresetChange: (w: number, h: number) => void;
  onFitToView: () => void;
  onOpenBenchmark: () => void;
  activeTool: ToolType;
  onSelectTool: (tool: ToolType) => void;
  isControlHeld: boolean;
  isShiftHeld: boolean;
}

export const BwpxEditorTopToolbar: React.FC<Omit<BwpxEditorToolbarProps, 'activeTool' | 'onSelectTool' | 'isControlHeld' | 'isShiftHeld'>> = ({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  historyIndex,
  historyLength,
  brushSize,
  onBrushSizeChange,
  onInvert,
  onFlipH,
  onFlipV,
  onRotate90,
  onExportPNG,
  onExportCArray,
  onExportJSON,
  onImportFile,
  fileInputRef,
  showPresets = true,
  gridWidth,
  gridHeight,
  onPresetChange,
  onFitToView,
  onOpenBenchmark,
}) => {
  return (
    <header className="bwpx-header">
      {/* Left: History, Brush & Transforms */}
      <div className="bwpx-header-left">
        {/* Undo / Redo */}
        <div className="bwpx-group">
          <button
            type="button"
            onClick={onUndo}
            disabled={!canUndo}
            className="bwpx-btn-icon"
            title="Undo (Ctrl+Z)"
          >
            <Undo2 size={14} />
          </button>
          <button
            type="button"
            onClick={onRedo}
            disabled={!canRedo}
            className="bwpx-btn-icon"
            title="Redo (Ctrl+Y)"
          >
            <Redo2 size={14} />
          </button>
          <span className="bwpx-history-text">
            {historyIndex} / {Math.max(0, historyLength - 1)} steps
          </span>
        </div>

        <div className="bwpx-v-divider" />

        {/* Brush Sizes */}
        <div className="bwpx-group-box">
          <span className="bwpx-group-label">Brush</span>
          {[1, 2, 3, 4].map(sz => (
            <button
              key={sz}
              type="button"
              onClick={() => onBrushSizeChange(sz)}
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
            type="button"
            onClick={onInvert}
            className="bwpx-btn-text"
            title="Invert Colors"
          >
            Invert
          </button>
          <button
            type="button"
            onClick={onFlipH}
            className="bwpx-btn-icon"
            title="Flip Horizontal"
          >
            <FlipHorizontal size={14} />
          </button>
          <button
            type="button"
            onClick={onFlipV}
            className="bwpx-btn-icon"
            title="Flip Vertical"
          >
            <FlipVertical size={14} />
          </button>
          <button
            type="button"
            onClick={onRotate90}
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
          <button type="button" onClick={onExportPNG} className="bwpx-btn-text">
            PNG
          </button>
          <button type="button" onClick={onExportCArray} className="bwpx-btn-text">
            C Array
          </button>
          <button type="button" onClick={onExportJSON} className="bwpx-btn-text">
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
            onChange={onImportFile}
            style={{ display: 'none' }}
          />
        </label>

        {showPresets && (
          <div className="bwpx-group-box">
            <span className="bwpx-group-label">Canvas</span>
            <select
              value={`${gridWidth}x${gridHeight}`}
              onChange={e => {
                const [w, h] = e.target.value.split('x').map(Number);
                onPresetChange(w, h);
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
          type="button"
          onClick={onFitToView}
          className="bwpx-btn-icon"
          title="Fit to Screen"
        >
          <Maximize2 size={15} />
        </button>

        <button
          type="button"
          onClick={onOpenBenchmark}
          className="bwpx-btn-icon"
          title="Performance Benchmark (W3C Profiler)"
          style={{ color: '#34d399' }}
        >
          <Activity size={15} />
        </button>
      </div>
    </header>
  );
};

export const BwpxEditorSidebar: React.FC<{
  activeTool: ToolType;
  onSelectTool: (tool: ToolType) => void;
  isControlHeld: boolean;
  isShiftHeld: boolean;
}> = ({
  activeTool,
  onSelectTool,
  isControlHeld,
  isShiftHeld,
}) => {
  return (
    <aside className="bwpx-sidebar">
      {/* DRAW GROUP */}
      <span className="bwpx-section-label">DRAW</span>

      <button
        type="button"
        onClick={() => onSelectTool('pencil')}
        className={`bwpx-tool-btn ${activeTool === 'pencil' && !isControlHeld && !isShiftHeld ? 'active' : ''}`}
        title="Pencil (Left click draws)"
      >
        <Pencil size={15} />
      </button>

      <div className="has-tooltip">
        <button
          type="button"
          onClick={() => onSelectTool('eraser')}
          className={`bwpx-tool-btn ${activeTool === 'eraser' ? 'active' : ''}`}
          title="Eraser (or Right click)"
        >
          <Eraser size={15} />
        </button>
        <div className="tooltip">Eraser (or Right click)</div>
      </div>

      <button
        type="button"
        onClick={() => onSelectTool('bucket')}
        className={`bwpx-tool-btn ${activeTool === 'bucket' && !isControlHeld && !isShiftHeld ? 'active' : ''}`}
        title="Flood Fill Bucket"
      >
        <PaintBucket size={15} />
      </button>

      <div className="has-tooltip">
        <button
          type="button"
          onClick={() => onSelectTool('select')}
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
          onClick={() => onSelectTool('move')}
          className={`bwpx-tool-btn ${activeTool === 'move' || isShiftHeld ? 'active' : ''}`}
          title="Move (or Shift click / Arrow keys)"
        >
          <Move size={15} />
        </button>
        <div className="tooltip">Move (or Shift click / Arrow keys)</div>
      </div>

      <div className="bwpx-h-divider" />

      {/* SHAPES GROUP */}
      <span className="bwpx-section-label">SHAPES</span>

      <button
        type="button"
        onClick={() => onSelectTool('line')}
        className={`bwpx-tool-btn ${activeTool === 'line' ? 'active' : ''}`}
        title="Line"
      >
        <Minus size={15} style={{ transform: 'rotate(-45deg)' }} />
      </button>

      <button
        type="button"
        onClick={() => onSelectTool('rect')}
        className={`bwpx-tool-btn ${activeTool === 'rect' ? 'active' : ''}`}
        title="Rectangle Outline"
      >
        <Square size={14} />
      </button>

      <button
        type="button"
        onClick={() => onSelectTool('filled-rect')}
        className={`bwpx-tool-btn ${activeTool === 'filled-rect' ? 'active' : ''}`}
        title="Filled Rectangle"
      >
        <div style={{ width: 12, height: 12, backgroundColor: 'currentColor', borderRadius: 2 }} />
      </button>

      <button
        type="button"
        onClick={() => onSelectTool('ellipse')}
        className={`bwpx-tool-btn ${activeTool === 'ellipse' ? 'active' : ''}`}
        title="Ellipse / Circle"
      >
        <Circle size={14} />
      </button>

      <button
        type="button"
        onClick={() => onSelectTool('filled-ellipse')}
        className={`bwpx-tool-btn ${activeTool === 'filled-ellipse' ? 'active' : ''}`}
        title="Filled Circle"
      >
        <div style={{ width: 12, height: 12, backgroundColor: 'currentColor', borderRadius: '50%' }} />
      </button>

      <button
        type="button"
        onClick={() => onSelectTool('triangle')}
        className={`bwpx-tool-btn ${activeTool === 'triangle' ? 'active' : ''}`}
        title="Triangle Outline"
      >
        <Triangle size={14} />
      </button>

      <button
        type="button"
        onClick={() => onSelectTool('filled-triangle')}
        className={`bwpx-tool-btn ${activeTool === 'filled-triangle' ? 'active' : ''}`}
        title="Filled Triangle"
      >
        <Triangle size={14} fill="currentColor" />
      </button>

      <button
        type="button"
        onClick={() => onSelectTool('star')}
        className={`bwpx-tool-btn ${activeTool === 'star' ? 'active' : ''}`}
        title="5-Point Star"
      >
        <Sparkles size={14} />
      </button>

      <button
        type="button"
        onClick={() => onSelectTool('arrow')}
        className={`bwpx-tool-btn ${activeTool === 'arrow' ? 'active' : ''}`}
        title="Arrow"
      >
        <ArrowRight size={14} />
      </button>

      <button
        type="button"
        onClick={() => onSelectTool('plus')}
        className={`bwpx-tool-btn ${activeTool === 'plus' ? 'active' : ''}`}
        title="Cross / Plus"
      >
        <Plus size={14} />
      </button>
    </aside>
  );
};

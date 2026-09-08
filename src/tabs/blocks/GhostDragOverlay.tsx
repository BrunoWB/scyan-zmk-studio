import React, { useEffect, useRef } from 'react';
import type { DragWidgetState } from '../../types/widget';
import { BwpxGrid } from '../../bwpx/core/BwpxGrid';
import type { SpriteSlice, FontGlyph, FontCharMapping } from '../../types/zmk';

export interface GhostDragOverlayProps {
  dragState: DragWidgetState;
  symbolsGrid: BwpxGrid;
  symbolSlices: SpriteSlice[];
  fontGrid: BwpxGrid;
  fontGlyphs?: FontGlyph[];
  fontMappings?: FontCharMapping[];
  customText: string;
  instances?: import('../../types/widget').WidgetInstanceMap;
}

export const GhostDragOverlay: React.FC<GhostDragOverlayProps> = ({
  dragState,
  symbolsGrid,
  symbolSlices,
  fontGrid,
  fontGlyphs = [],
  fontMappings = [],
  customText,
  instances,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const widget = dragState.widget;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !widget) return;

    const scale = 2;
    const width = widget.defaultWidth;
    const height = widget.defaultHeight;

    canvas.width = width * scale;
    canvas.height = height * scale;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#080b10';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const tempGrid = new BwpxGrid(width, height);
    widget.render(tempGrid, 0, 0, {
      symbolsGrid,
      symbolSlices,
      fontGrid,
      fontGlyphs,
      fontMappings,
      battery: 85,
      outputMode: 'usb',
      currentLayer: 0,
      layerNames: ['QWERTY', 'LOWER', 'RAISE', 'ADJUST'],
      wpm: 60,
      splitConnected: true,
      customText,
      instances,
    });

    ctx.fillStyle = '#00d2ff';
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (tempGrid.get(x, y)) {
          ctx.fillRect(x * scale, y * scale, scale - 0.3, scale - 0.3);
        }
      }
    }
  }, [widget, symbolsGrid, symbolSlices, fontGrid, fontGlyphs, fontMappings, customText, instances]);

  const { clientX, clientY, targetSide } = dragState;

  return (
    <div
      className="ghost-drag-overlay"
      style={{
        position: 'fixed',
        left: 0,
        top: 0,
        transform: `translate3d(calc(${clientX}px - 50%), calc(${clientY}px - 50%), 0)`,
        pointerEvents: 'none',
        zIndex: 99999,
        willChange: 'transform',
      }}
    >
      <div className={`ghost-drag-card ${targetSide ? 'active-target' : ''}`}>
        <div className="ghost-drag-header">
          <span className="ghost-drag-dot" />
          <span className="ghost-drag-title">{widget.name}</span>
        </div>

        <div className="ghost-canvas-wrapper">
          <canvas ref={canvasRef} className="pixel-preview-canvas" />
        </div>

        {targetSide ? (
          <div className="ghost-drag-pill target">
            Drop on {targetSide === 'left' ? 'Left Screen' : 'Right Screen'}
          </div>
        ) : (
          <div className="ghost-drag-pill">
            Drag to screen
          </div>
        )}
      </div>
    </div>
  );
};



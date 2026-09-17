import React, { useEffect, useRef } from 'react';
import { BwpxGrid } from '../../bwpx/core/BwpxGrid';
import type { LayoutBlock, SpriteSlice, FontGlyph, FontCharMapping } from '../../types/zmk';
import type { WidgetInstanceMap, WidgetCustomizationMap } from '../../types/widget';
import { renderBlocksToGrid } from '../../services/widgetRegistry';

export interface OledBlitterRenderState {
  symbolsGrid: BwpxGrid;
  symbolSlices: SpriteSlice[];
  fontGrid: BwpxGrid;
  fontGlyphs: FontGlyph[];
  fontMappings: FontCharMapping[];
  battery: number;
  outputMode: 'usb' | 'ble';
  bleProfileIndex: number;
  currentLayer: number;
  layerNames: string[];
  wpm: number;
  wpmHistory: number[];
  splitConnected: boolean;
  capsLock: boolean;
  customText?: string;
  instances?: WidgetInstanceMap;
  customizations?: WidgetCustomizationMap;
  bongoState?: 0 | 1 | 2;
  animationTimestamp?: number;
  isIdle?: boolean;
}

export interface OledBlitterCanvasProps {
  blocks: LayoutBlock[];
  vWidth: number;
  vHeight: number;
  displayDim: { displayW: number; displayH: number };
  side: string;
  renderState?: Partial<OledBlitterRenderState>;
  onRegisterCanvas?: (el: HTMLCanvasElement | null) => void;
  className?: string;
  style?: React.CSSProperties;
}

const DEFAULT_GRID = new BwpxGrid(32, 32);

/**
 * Hardware-accurate 1bpp OLED display blitter canvas.
 * Renders virtual layout blocks to virtual 1bpp memory buffer,
 * then blits simulated phosphor dot matrix pixels onto physical HTML canvas.
 */
export const OledBlitterCanvas: React.FC<OledBlitterCanvasProps> = ({
  blocks,
  vWidth,
  vHeight,
  displayDim,
  side,
  renderState,
  onRegisterCanvas,
  className = '',
  style,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const PIXEL_PITCH = 2; // Crisp dot simulation
    const DOT_SIZE = 1.6;
    const onColor = '#e2f1ff';
    const offColor = '#05070a';

    const vbuf = new BwpxGrid(vWidth, vHeight);
    renderBlocksToGrid(blocks, vbuf, {
      symbolsGrid: renderState?.symbolsGrid ?? DEFAULT_GRID,
      symbolSlices: renderState?.symbolSlices ?? [],
      fontGrid: renderState?.fontGrid ?? DEFAULT_GRID,
      fontGlyphs: renderState?.fontGlyphs ?? [],
      fontMappings: renderState?.fontMappings ?? [],
      battery: renderState?.battery ?? 100,
      outputMode: renderState?.outputMode ?? 'usb',
      bleProfileIndex: renderState?.bleProfileIndex ?? 0,
      currentLayer: renderState?.currentLayer ?? 0,
      layerNames: renderState?.layerNames ?? ['DEF', 'LWR', 'RSE', 'ADJ'],
      wpm: renderState?.wpm ?? 0,
      wpmHistory: renderState?.wpmHistory ?? [],
      splitConnected: renderState?.splitConnected ?? true,
      capsLock: renderState?.capsLock ?? false,
      customText: renderState?.customText ?? '',
      instances: renderState?.instances,
      side,
      isIdle: renderState?.isIdle ?? false,
      customizations: renderState?.customizations,
      bongoState: renderState?.bongoState,
      animationTimestamp: renderState?.animationTimestamp ?? 0,
    });

    canvas.width = vWidth * PIXEL_PITCH;
    canvas.height = vHeight * PIXEL_PITCH;

    ctx.fillStyle = offColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = onColor;
    for (let y = 0; y < vHeight; y++) {
      for (let x = 0; x < vWidth; x++) {
        if (vbuf.get(x, y)) {
          ctx.fillRect(x * PIXEL_PITCH, y * PIXEL_PITCH, DOT_SIZE, DOT_SIZE);
        }
      }
    }
  }, [
    blocks,
    vWidth,
    vHeight,
    side,
    renderState,
  ]);

  return (
    <canvas
      ref={(el) => {
        canvasRef.current = el;
        onRegisterCanvas?.(el);
      }}
      className={`corne-oled-canvas ${className}`.trim()}
      style={{
        width: `${displayDim.displayW}px`,
        height: `${displayDim.displayH}px`,
        display: 'block',
        ...style,
      }}
    />
  );
};

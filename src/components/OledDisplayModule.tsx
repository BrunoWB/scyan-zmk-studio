import React, { useRef, useEffect, useState, useMemo } from 'react';
import { BwpxGrid } from '../bwpx/core/BwpxGrid';
import type { SpriteSlice, FontGlyph, FontCharMapping, LayoutBlock } from '../types/zmk';
import type { WidgetInstanceMap, WidgetCustomizationMap } from '../types/widget';
import { renderBlocksToGrid } from '../services/widgetRegistry';

export interface OledDisplayModuleProps {
  width: number;
  height: number;
  blocks?: LayoutBlock[];
  symbolsGrid: BwpxGrid;
  symbolSlices: SpriteSlice[];
  fontGrid: BwpxGrid;
  fontGlyphs?: FontGlyph[];
  fontMappings?: FontCharMapping[];
  side?: 'left' | 'right' | 'dongle' | 'single';
  badge?: string;
  isIdle?: boolean;
  battery?: number;
  outputMode?: 'usb' | 'ble';
  bleProfileIndex?: number;
  currentLayer?: number;
  layerNames?: string[];
  wpm?: number;
  splitConnected?: boolean;
  capsLock?: boolean;
  customText?: string;
  instances?: WidgetInstanceMap;
  customizations?: WidgetCustomizationMap;
  scale?: number;
  showHousing?: boolean;
  showLiveDot?: boolean;
  accentColor?: string;
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
  overlayContent?: React.ReactNode;
}

export const OLED_BORDER_UNITS = 5;

export function getCalculatedDisplayDim(
  width: number,
  height: number,
  scale: number = 1
): { displayW: number; displayH: number } {
  const w = width > 0 ? width : 32;
  const h = height > 0 ? height : 128;
  const aspect = w / h;

  let baseW: number;
  let baseH: number;

  if (aspect <= 1) {
    baseH = Math.round(192 * scale);
    baseW = Math.max(28, Math.min(Math.round(180 * scale), Math.round(baseH * aspect)));
  } else {
    baseW = Math.round(180 * scale);
    baseH = Math.max(28, Math.min(Math.round(192 * scale), Math.round(baseW / aspect)));
  }

  return { displayW: baseW, displayH: baseH };
}

export const OledDisplayModule: React.FC<OledDisplayModuleProps> = ({
  width,
  height,
  blocks = [],
  symbolsGrid,
  symbolSlices,
  fontGrid,
  fontGlyphs = [],
  fontMappings = [],
  side = 'left',
  badge: _badge,
  isIdle = false,
  battery = 85,
  outputMode = 'ble',
  bleProfileIndex = 0,
  currentLayer = 0,
  layerNames = ['DEFAULT', 'LOWER', 'RAISE', 'NAV', 'NUM'],
  wpm = 42,
  splitConnected = true,
  capsLock = false,
  customText = 'SCYAN',
  instances,
  customizations,
  scale = 1,
  showHousing = true,
  showLiveDot: _showLiveDot = false,
  accentColor,
  className = '',
  style,
  onClick,
  overlayContent,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const displayDim = useMemo(
    () => getCalculatedDisplayDim(width, height, scale),
    [width, height, scale]
  );

  const [animTimestamp, setAnimTimestamp] = useState(0);
  const animStartTimeRef = useRef<number>(Date.now());

  const hasAnimation = useMemo(() => {
    return blocks.some((b) => {
      const t = (b.widgetType || '').toLowerCase();
      return t.includes('animation') || t.includes('loop') || t.includes('bongo');
    });
  }, [blocks]);

  useEffect(() => {
    if (!hasAnimation) return;
    animStartTimeRef.current = Date.now();
    const interval = setInterval(() => {
      setAnimTimestamp(Date.now() - animStartTimeRef.current);
    }, 50);
    return () => clearInterval(interval);
  }, [hasAnimation]);

  // Render pixels to canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const PIXEL_PITCH = 2;
    const DOT_SIZE = 1.6;
    const onColor = '#e2f1ff';
    const offColor = '#05070a';

    const vWidth = width > 0 ? width : 32;
    const vHeight = height > 0 ? height : 128;

    const vbuf = new BwpxGrid(vWidth, vHeight);
    const renderSide = side === 'single' ? 'left' : side;

    renderBlocksToGrid(blocks, vbuf, {
      symbolsGrid,
      symbolSlices,
      fontGrid,
      fontGlyphs,
      fontMappings,
      battery,
      outputMode,
      bleProfileIndex,
      currentLayer,
      layerNames,
      wpm,
      wpmHistory: [
        Math.max(0, wpm - 12),
        Math.max(0, wpm - 6),
        Math.max(0, wpm - 2),
        wpm,
        Math.max(0, wpm - 4),
      ],
      splitConnected,
      capsLock,
      customText,
      instances,
      side: renderSide,
      isIdle,
      customizations,
      bongoState: wpm > 0 ? 1 : 0,
      animationTimestamp: animTimestamp,
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
    width,
    height,
    blocks,
    symbolsGrid,
    symbolSlices,
    fontGrid,
    fontGlyphs,
    fontMappings,
    side,
    isIdle,
    battery,
    outputMode,
    bleProfileIndex,
    currentLayer,
    layerNames,
    wpm,
    splitConnected,
    capsLock,
    customText,
    instances,
    customizations,
    animTimestamp,
  ]);

  const housingWidth = displayDim.displayW + OLED_BORDER_UNITS * 2;
  const housingHeight = displayDim.displayH + OLED_BORDER_UNITS * 2;

  const housingBorderColor = accentColor || (side === 'dongle' ? 'rgba(245, 158, 11, 0.4)' : undefined);
  const housingShadow = accentColor
    ? `0 0 12px ${accentColor}33`
    : side === 'dongle'
      ? '0 0 12px rgba(245, 158, 11, 0.15)'
      : undefined;

  const innerContent = (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: `${displayDim.displayW}px`,
        height: `${displayDim.displayH}px`,
      }}
    >
      <canvas
        ref={canvasRef}
        className="corne-oled-canvas"
        style={{
          width: `${displayDim.displayW}px`,
          height: `${displayDim.displayH}px`,
          display: 'block',
        }}
      />
      {overlayContent}
    </div>
  );

  return (
    <div className={`oled-display-module-wrapper inline-flex flex-col items-center ${className}`} style={style}>
      {showHousing ? (
        <div
          className="oled-glass-housing cursor-pointer transition-all hover:border-[#00f0ff]/60"
          style={{
            width: `${housingWidth}px`,
            height: `${housingHeight}px`,
            borderColor: housingBorderColor,
            boxShadow: housingShadow,
          }}
          onClick={onClick}
        >
          {innerContent}
        </div>
      ) : (
        <div onClick={onClick} className="cursor-pointer">
          {innerContent}
        </div>
      )}
    </div>
  );
};

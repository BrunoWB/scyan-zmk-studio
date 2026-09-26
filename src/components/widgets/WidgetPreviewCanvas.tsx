import React, { useState, useRef, useEffect } from 'react';
import { BwpxGrid } from '../../pixel/core/PixelGrid';
import type { SpriteSlice, FontGlyph, FontCharMapping } from '../../types/zmk';
import type {
  DisplayWidgetDefinition,
  WidgetInstanceMap,
  WidgetInstance,
  TypewriterRandomLetter,
  TypewriterState,
  KeypressState,
  WidgetRenderContext,
} from '../../types/widget';
import {
  getWidgetNaturalSize,
  resolveWidgetInstance,
} from '../../services/widgetRegistry';
/**
 * Calculates optimal width, height, and scale for rendering widget previews
 * ensuring that wide screensaver layouts do not squish into slivers in thumbnails
 * and standard widgets maintain their natural aspect ratios without clipping.
 */
export function computePreviewDimensions(
  widget: DisplayWidgetDefinition,
  mode: 'thumb' | 'instance',
  naturalSize: { width: number; height: number },
  propScale?: number
): { width: number; height: number; scale: number } {
  const scale = propScale ?? (mode === 'thumb' ? 2 : 3);
  let width: number;
  let height: number;

  if (mode === 'thumb') {
    width = Math.min(32, Math.max(naturalSize.width, 14));
    if (widget.id === 'screensaver' || widget.id === 'animation' || widget.id === 'loop') {
      height = naturalSize.height > 0 && naturalSize.height <= 26 ? naturalSize.height : 26;
    } else {
      height = Math.min(26, Math.max(naturalSize.height, widget.defaultHeight, 10));
    }
  } else {
    width = Math.max(naturalSize.width, 14);
    if (widget.id === 'screensaver' || widget.id === 'animation' || widget.id === 'loop') {
      height = naturalSize.height > 0 && naturalSize.height <= 64 ? naturalSize.height : 32;
    } else if (widget.id === 'typewriter') {
      height = Math.min(64, Math.max(naturalSize.height, widget.defaultHeight, 14));
    } else {
      height = Math.max(naturalSize.height, widget.defaultHeight, 14);
    }
  }

  return { width, height, scale };
}

/**
 * Pure rendering function that paints a widget centered onto a temporary BwpxGrid.
 * Enforces destX = 0, destY = 0 and sets blockWidth / blockHeight to the grid dimensions
 * so blitSlice and drawText center slices without right-edge truncation.
 */
export function renderWidgetPreviewToGrid(
  widget: DisplayWidgetDefinition,
  grid: BwpxGrid,
  context: WidgetRenderContext
): void {
  const fullContext: WidgetRenderContext = {
    ...context,
    blockWidth: grid.width,
    blockHeight: grid.height,
  };
  widget.render(grid, 0, 0, fullContext);
}

export interface WidgetPreviewCanvasProps {
  widget: DisplayWidgetDefinition;
  instance?: WidgetInstance;
  instances?: WidgetInstanceMap;
  symbolsGrid: BwpxGrid;
  symbolSlices: SpriteSlice[];
  fontGrid: BwpxGrid;
  fontGlyphs?: FontGlyph[];
  fontMappings?: FontCharMapping[];
  customText?: string;
  mode?: 'thumb' | 'instance';
  scale?: number;
  testBattery?: number;
  testWpm?: number;
  testOutputMode?: 'usb' | 'ble';
  testBleProfile?: number;
  testBleState?: 'connected' | 'reconnecting' | 'pairing' | 'handshake' | 'disconnected';
  testLayer?: number;
  layerNames?: string[];
  testSplitConnected?: boolean;
  simulateMissingSymbols?: boolean;
  testBongoState?: 0 | 1 | 2;
  testTypewriterText?: string;
  testTypewriterLastChar?: string;
  testTypewriterLastTimestamp?: number;
  testTypewriterRandomPos?: { x: number; y: number };
  testTypewriterRandomLetters?: TypewriterRandomLetter[];
  testActiveKeys?: string[];
  testLastKey?: string;
  testKeypressState?: KeypressState;
  className?: string;
  interactive?: boolean;
  pixelColor?: string;
  backgroundColor?: string;
  onClick?: () => void;
  title?: string;
}

export const WidgetPreviewCanvas: React.FC<WidgetPreviewCanvasProps> = ({
  widget,
  instance,
  instances,
  symbolsGrid,
  symbolSlices,
  fontGrid,
  fontGlyphs,
  fontMappings,
  customText = '',
  mode = 'instance',
  scale: propScale,
  testBattery = 80,
  testWpm = 65,
  testOutputMode = 'usb',
  testBleProfile = 1,
  testBleState = 'connected',
  testLayer = 0,
  layerNames,
  testSplitConnected = true,
  simulateMissingSymbols = false,
  testBongoState = 0,
  testTypewriterText,
  testTypewriterLastChar,
  testTypewriterLastTimestamp,
  testTypewriterRandomPos,
  testTypewriterRandomLetters,
  testActiveKeys,
  testLastKey,
  testKeypressState,
  className = 'pixel-preview-canvas',
  interactive = true,
  pixelColor = '#00d2ff',
  backgroundColor = '#08090b',
  onClick,
  title,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const startTimeRef = useRef<number>(0);
  const [animTimestamp, setAnimTimestamp] = useState<number>(0);

  const activeInst = instance ?? resolveWidgetInstance(instances, widget.id);

  // Animated widget timer
  useEffect(() => {
    const isAnimWidget =
      widget.id === 'animation' ||
      widget.id === 'loop' ||
      widget.id === 'typewriter' ||
      widget.id === 'connection';

    if (!isAnimWidget) return;

    const speedMs =
      widget.id === 'connection'
        ? 500
        : widget.id === 'typewriter'
        ? 30
        : Math.max(20, activeInst?.config?.loopSpeedMs ?? 250);

    startTimeRef.current = Date.now();
    const timer = setInterval(() => {
      const now = Date.now();
      const elapsed = now - startTimeRef.current;

      if (widget.id === 'typewriter') {
        const cleaning = activeInst?.config?.typewriterCleaning ?? 0;
        if (cleaning > 0) {
          const fadeSec = activeInst?.config?.typewriterFadeTime ?? 0.15;
          const bankCount =
            testTypewriterRandomLetters && testTypewriterRandomLetters.length > 0
              ? testTypewriterRandomLetters.length
              : 4;
          const totalCycleMs = (bankCount + 1) * cleaning * 1000 + fadeSec * 1000 + 1000;
          if (elapsed > totalCycleMs) {
            startTimeRef.current = now;
            setAnimTimestamp(0);
            return;
          }
        }
      }

      setAnimTimestamp(elapsed);
    }, speedMs);

    return () => clearInterval(timer);
  }, [
    widget.id,
    activeInst?.id,
    activeInst?.config?.loopSpeedMs,
    activeInst?.config?.loop,
    activeInst?.config?.groupId,
    activeInst?.config?.typewriterCleaning,
    activeInst?.config?.typewriterLetterBank,
    activeInst?.config?.typewriterBankSize,
    activeInst?.config?.typewriterFadeType,
    activeInst?.config?.typewriterFadeTime,
    activeInst?.config?.typewriterMode,
    activeInst?.config?.mode,
    testTypewriterRandomLetters,
  ]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const effectiveSlices = simulateMissingSymbols ? [] : symbolSlices;
    const naturalSize = getWidgetNaturalSize(
      widget,
      effectiveSlices,
      activeInst,
      fontGlyphs,
      fontMappings
    );

    const { width, height, scale: effectiveScale } = computePreviewDimensions(
      widget,
      mode,
      naturalSize,
      propScale
    );

    canvas.width = width * effectiveScale;
    canvas.height = height * effectiveScale;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const tempGrid = new BwpxGrid(width, height);
    const tempInstances: WidgetInstanceMap = activeInst
      ? {
          [widget.id]: [activeInst],
          ...(widget.id === 'animation' ? { loop: [{ ...activeInst, widgetTypeId: 'loop' }] } : {}),
          ...(widget.id === 'loop' ? { animation: [{ ...activeInst, widgetTypeId: 'animation' }] } : {}),
        }
      : instances || {};

    const isTypewriter = widget.id === 'typewriter';
    const effectiveBaseTimestamp =
      isTypewriter && startTimeRef.current > 0
        ? startTimeRef.current
        : (testTypewriterLastTimestamp ?? Date.now());

    const fontSize =
      activeInst?.config?.fontSize ||
      (isTypewriter && (activeInst?.config?.typewriterMode || activeInst?.config?.mode) === 'random'
        ? 'both'
        : 'small');
    const charW = fontSize === 'big' ? 10 : 5;
    const charH = fontSize === 'big' ? 10 : 5;
    const maxOffsetX = Math.max(0, width - charW);
    const maxOffsetY = Math.max(0, height - charH);

    let typewriterState: TypewriterState | undefined;
    if (isTypewriter) {
      if (mode === 'thumb' && (!testTypewriterRandomLetters || testTypewriterRandomLetters.length === 0)) {
        const twCleaning = activeInst?.config?.typewriterCleaning ?? 0;
        const twFadeSec = activeInst?.config?.typewriterFadeTime ?? 0.15;
        const twCycleMs = twCleaning > 0 ? 5 * twCleaning * 1000 + twFadeSec * 1000 + 1000 : 4000;
        const previewStartTime =
          animTimestamp > 0 ? Date.now() - (animTimestamp % twCycleMs) : Date.now();
        typewriterState = {
          text: 'TYPE',
          lastChar: 'E',
          lastTimestamp: previewStartTime,
          letterBank: [
            { char: 'T', x: 2, y: 2, fontSize: 'big', timestamp: previewStartTime },
            { char: 'Y', x: 10, y: 4, fontSize: 'small', timestamp: previewStartTime },
            { char: 'P', x: 18, y: 12, fontSize: 'big', timestamp: previewStartTime },
            { char: 'E', x: 8, y: 20, fontSize: 'small', timestamp: previewStartTime },
          ],
          randomLetters: [
            { char: 'T', x: 2, y: 2, fontSize: 'big', timestamp: previewStartTime },
            { char: 'Y', x: 10, y: 4, fontSize: 'small', timestamp: previewStartTime },
            { char: 'P', x: 18, y: 12, fontSize: 'big', timestamp: previewStartTime },
            { char: 'E', x: 8, y: 20, fontSize: 'small', timestamp: previewStartTime },
          ],
        };
      } else {
        const effectiveLetters = (testTypewriterRandomLetters || []).map((l) => {
          let lx = l.x;
          let ly = l.y;
          if (maxOffsetY > 32 && typeof ly === 'number' && Number.isInteger(ly) && ly <= 26) {
            ly = Math.round((ly / 26) * maxOffsetY);
          }
          if (maxOffsetX > 32 && typeof lx === 'number' && Number.isInteger(lx) && lx <= 26) {
            lx = Math.round((lx / 26) * maxOffsetX);
          }
          return {
            ...l,
            x: lx,
            y: ly,
            timestamp: effectiveBaseTimestamp,
          };
        });

        typewriterState = {
          text: testTypewriterText ?? 'TYPE...',
          lastChar: testTypewriterLastChar,
          lastTimestamp: effectiveBaseTimestamp,
          randomX: testTypewriterRandomPos?.x,
          randomY: testTypewriterRandomPos?.y,
          letterBank: effectiveLetters,
          randomLetters: effectiveLetters,
          randomBank: effectiveLetters,
        };
      }
    }

    const renderContext: WidgetRenderContext = {
      symbolsGrid,
      symbolSlices: effectiveSlices,
      fontGrid,
      fontGlyphs,
      fontMappings,
      battery: testBattery,
      outputMode: testOutputMode,
      bleProfileIndex: testBleProfile,
      bleState: testBleProfile === 0 ? 'disconnected' : testBleState,
      currentLayer: testLayer,
      layerNames: layerNames && layerNames.length > 0 ? layerNames : ['DEFAULT', 'LOWER', 'RAISE', 'ADJUST'],
      wpm: testWpm,
      splitConnected: testSplitConnected,
      customText,
      instances: tempInstances,
      activeInstanceId: activeInst?.id,
      bongoState: testBongoState,
      animationTimestamp: animTimestamp,
      blockWidth: width,
      blockHeight: height,
      typewriterText: testTypewriterText ?? (isTypewriter ? 'TYPE' : undefined),
      typewriterState,
      activeKeys: testActiveKeys,
      lastKey: testLastKey,
      keypressState: testKeypressState,
    };

    renderWidgetPreviewToGrid(widget, tempGrid, renderContext);

    ctx.fillStyle = pixelColor;
    const pixelInset = effectiveScale > 2 ? 0.35 : 0.2;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (tempGrid.get(x, y)) {
          ctx.fillRect(
            x * effectiveScale,
            y * effectiveScale,
            effectiveScale - pixelInset,
            effectiveScale - pixelInset
          );
        }
      }
    }
  }, [
    widget,
    activeInst,
    instances,
    symbolsGrid,
    symbolSlices,
    fontGrid,
    fontGlyphs,
    fontMappings,
    customText,
    mode,
    propScale,
    testBattery,
    testWpm,
    testOutputMode,
    testBleProfile,
    testBleState,
    testLayer,
    layerNames,
    testSplitConnected,
    simulateMissingSymbols,
    testBongoState,
    animTimestamp,
    testTypewriterText,
    testTypewriterLastChar,
    testTypewriterLastTimestamp,
    testTypewriterRandomPos,
    testTypewriterRandomLetters,
    activeInst?.config?.typewriterLetterBank,
    activeInst?.config?.typewriterBankSize,
    activeInst?.config?.typewriterFadeType,
    activeInst?.config?.typewriterFadeTime,
    testActiveKeys,
    testLastKey,
    testKeypressState,
    pixelColor,
    backgroundColor,
  ]);

  const handleClick = () => {
    if (interactive) {
      startTimeRef.current = Date.now();
      setAnimTimestamp(0);
    }
    if (onClick) onClick();
  };

  return (
    <canvas
      ref={canvasRef}
      className={className}
      title={title ?? (interactive ? 'Click to replay animation' : undefined)}
      onClick={handleClick}
      style={{ imageRendering: 'pixelated' }}
    />
  );
};

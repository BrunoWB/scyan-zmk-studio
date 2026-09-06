import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { BwpxGrid } from '../bwpx/core/BwpxGrid';
import type { SpriteSlice, FontGlyph, LayoutBlock, FontCharMapping } from '../types/zmk';
import {
  Battery,
  Bluetooth,
  Usb,
  Gauge,
  Layers,
  Moon,
  Sun,
  Sliders,
} from 'lucide-react';
import type { GitHubRepoConfig, GitHubConnectionState } from '../services/githubService';
import {
  type ParsedKeymapLayout,
  DEFAULT_EMPTY_5X3_LAYOUT,
  fetchRepoKeymap,
  parseZmkKeymap,
  getMatchingKeyCoords,
} from '../services/keymapService';

export interface OledPreviewTabProps {
  symbolsGrid: BwpxGrid;
  symbolSlices: SpriteSlice[];
  fontGrid: BwpxGrid;
  fontGlyphs?: FontGlyph[];
  fontMappings?: FontCharMapping[];
  layoutBlocks: LayoutBlock[];
  customText: string;
  onCustomTextChange: (text: string) => void;
  config?: GitHubRepoConfig;
  connection?: GitHubConnectionState;
  onShowToast?: (type: 'success' | 'error', message: string) => void;
  onOpenSettings?: () => void;
  syncTrigger?: number;
}

export const OledPreviewTab: React.FC<OledPreviewTabProps> = ({
  symbolsGrid,
  symbolSlices,
  fontGrid,
  fontGlyphs = [],
  fontMappings = [],
  layoutBlocks,
  customText,
  onCustomTextChange: _onCustomTextChange,
  config,
  connection,
  onShowToast,
  onOpenSettings,
  syncTrigger,
}) => {
  // Simulator states
  const [isIdle, setIsIdle] = useState<boolean>(false);
  const [outputMode, setOutputMode] = useState<'usb' | 'ble'>('usb');
  const [battery, setBattery] = useState<number>(88);
  const [currentLayer, setCurrentLayer] = useState<number>(0);
  const [wpm, setWpm] = useState<number>(68);
  const [splitConnected, setSplitConnected] = useState<boolean>(true);

  // Keymap Layout: dynamic from GitHub, defaults to empty 5x3 blank layout
  const [keymapLayout, setKeymapLayout] = useState<ParsedKeymapLayout>(DEFAULT_EMPTY_5X3_LAYOUT);

  // Currently pressed keycaps set (supports key label or coordinate for empty keys)
  const [pressedKeys, setPressedKeys] = useState<Set<string>>(new Set());

  const leftCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const rightCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const keystrokeTimestampsRef = useRef<number[]>([]);

  // Automatically fetch keymap from GitHub when repository is configured
  useEffect(() => {
    if (config?.owner && config?.repo) {
      let isMounted = true;
      fetchRepoKeymap(config)
        .then(result => {
          if (!isMounted) return;
          if (result && result.content) {
            const parsed = parseZmkKeymap(result.content, result.filename);
            setKeymapLayout(parsed);
            setCurrentLayer(0);
          } else {
            setKeymapLayout(DEFAULT_EMPTY_5X3_LAYOUT);
            setCurrentLayer(0);
          }
        })
        .catch(err => {
          console.warn('Error fetching keymap from repo:', err);
          if (isMounted) {
            setKeymapLayout(DEFAULT_EMPTY_5X3_LAYOUT);
            setCurrentLayer(0);
          }
        });

      return () => {
        isMounted = false;
      };
    } else {
      setKeymapLayout(DEFAULT_EMPTY_5X3_LAYOUT);
      setCurrentLayer(0);
    }
  }, [config?.token, config?.owner, config?.repo, config?.branch, connection?.status]);

  // Re-fetch keymap when syncTrigger changes from outside (e.g. HeaderBar sync)
  const prevSyncTriggerRef = useRef<number | undefined>(syncTrigger);
  useEffect(() => {
    if (
      syncTrigger !== undefined &&
      prevSyncTriggerRef.current !== undefined &&
      syncTrigger > prevSyncTriggerRef.current
    ) {
      handleRefreshKeymap();
    }
    prevSyncTriggerRef.current = syncTrigger;
  }, [syncTrigger]);

  // Manual refresh helper with toasts and clear feedback
  const handleRefreshKeymap = async () => {
    if (!config?.owner || !config?.repo) {
      onOpenSettings?.();
      onShowToast?.('error', 'Please configure your GitHub repository in Settings before syncing.');
      return;
    }

    if (!config?.token && connection?.status !== 'connected') {
      onOpenSettings?.();
      onShowToast?.(
        'error',
        `Repository '${config.owner}/${config.repo}' is private or requires authorization. Please connect your GitHub account in Settings to sync.`
      );
      return;
    }

    try {
      const result = await fetchRepoKeymap(config);
      if (result && result.content) {
        const parsed = parseZmkKeymap(result.content, result.filename);
        setKeymapLayout(parsed);
        setCurrentLayer(0);
        const layerCount = parsed.layers?.length || parsed.layerNames?.length || 1;
        onShowToast?.(
          'success',
          `Synced keymap '${result.filename}' (${parsed.layoutType}, ${layerCount} layers) from ${config.owner}/${config.repo}!`
        );
      } else {
        onShowToast?.(
          'error',
          `Could not find a .keymap file in ${config.owner}/${config.repo}. Checked config/, boards/shields/, keymaps/, and root.`
        );
      }
    } catch (err: any) {
      console.warn('Failed to refresh keymap:', err);
      const msg = err?.message || 'Check repository access and permissions.';
      onShowToast?.('error', `Failed to sync keymap: ${msg}`);
      if (msg.includes('Settings') || msg.includes('token') || msg.includes('private')) {
        onOpenSettings?.();
      }
    }
  };

  // Layer names from parsed keymap
  const layerNames = useMemo(
    () =>
      keymapLayout.layerNames && keymapLayout.layerNames.length > 0
        ? keymapLayout.layerNames
        : ['DEFAULT', 'LOWER', 'RAISE', 'ADJUST'],
    [keymapLayout.layerNames]
  );

  // Current active layer matrices
  const activeLayerData = keymapLayout.layers && keymapLayout.layers[currentLayer]
    ? keymapLayout.layers[currentLayer]
    : null;

  const currentLeftMatrix = activeLayerData ? activeLayerData.leftMatrix : keymapLayout.leftMatrix;
  const currentRightMatrix = activeLayerData ? activeLayerData.rightMatrix : keymapLayout.rightMatrix;
  const currentLeftThumbs = activeLayerData ? activeLayerData.leftThumbs : keymapLayout.leftThumbs;
  const currentRightThumbs = activeLayerData ? activeLayerData.rightThumbs : keymapLayout.rightThumbs;

  // Stagger offsets for columns: dynamic length safe
  const getColStagger = (colIdx: number, totalCols: number, isRight: boolean) => {
    const baseStagger5 = [10, 2, -4, 2, 6];
    const baseStagger6 = [14, 10, 2, -4, 2, 6];
    if (totalCols === 6) {
      const idx = isRight ? totalCols - 1 - colIdx : colIdx;
      return baseStagger6[idx] ?? 0;
    }
    const idx = isRight ? totalCols - 1 - colIdx : colIdx;
    return baseStagger5[idx] ?? 0;
  };

  // Helper to find slice
  const getSlice = (id: string): SpriteSlice | undefined => {
    return symbolSlices.find(s => s.id === id);
  };

  // Helper to find glyph
  const getGlyph = (codepoint: number): FontGlyph | undefined => {
    return fontGlyphs.find(g => g.codepoint === codepoint);
  };

  // Block helpers
  const getBlockY = (blockId: string, defaultY: number): number => {
    const b = layoutBlocks.find(item => item.id === blockId);
    return b && b.enabled ? b.y : defaultY;
  };

  const isBlockEnabled = (blockId: string): boolean => {
    const b = layoutBlocks.find(item => item.id === blockId);
    return b ? b.enabled : true;
  };

  // Record timestamp for live WPM calculation
  const recordKeystroke = useCallback(() => {
    const now = Date.now();
    keystrokeTimestampsRef.current.push(now);

    // Keep only keystrokes within the last 3.5 seconds
    keystrokeTimestampsRef.current = keystrokeTimestampsRef.current.filter(t => now - t <= 3500);
    const count = keystrokeTimestampsRef.current.length;
    if (count >= 2) {
      // 5 keystrokes per word average
      const calculatedWpm = Math.min(160, Math.round((count / 5) * (60 / 3.5)));
      setWpm(Math.max(12, calculatedWpm));
    }
  }, []);

  // Trigger keycap visual press
  const triggerKeyPress = useCallback((identifiers: string | string[]) => {
    const list = Array.isArray(identifiers) ? identifiers : [identifiers];
    const keysToAdd = list.filter(k => Boolean(k && k.trim()));
    if (keysToAdd.length === 0) return;

    setPressedKeys(prev => {
      const next = new Set(prev);
      keysToAdd.forEach(k => next.add(k));
      return next;
    });

    recordKeystroke();

    setTimeout(() => {
      setPressedKeys(prev => {
        const next = new Set(prev);
        keysToAdd.forEach(k => next.delete(k));
        return next;
      });
    }, 140);
  }, [recordKeystroke]);

  // Listen to physical keyboard events anywhere on window
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Do not hijack typing if modal is open or active target is an input/textarea
      const target = e.target as HTMLElement | null;
      if (
        document.querySelector('.modal-overlay') ||
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable
      ) {
        return;
      }

      recordKeystroke();

      const matchingCoords = getMatchingKeyCoords(
        { key: e.key, code: e.code },
        {
          leftMatrix: currentLeftMatrix,
          rightMatrix: currentRightMatrix,
          leftThumbs: currentLeftThumbs,
          rightThumbs: currentRightThumbs,
          columns: keymapLayout.columns,
          rows: keymapLayout.rows,
        }
      );

      if (matchingCoords.length > 0) {
        triggerKeyPress(matchingCoords);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    triggerKeyPress,
    recordKeystroke,
    currentLeftMatrix,
    currentRightMatrix,
    currentLeftThumbs,
    currentRightThumbs,
    keymapLayout.columns,
    keymapLayout.rows,
  ]);

  // Gentle WPM decay when user stops typing
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      keystrokeTimestampsRef.current = keystrokeTimestampsRef.current.filter(t => now - t <= 3000);
      if (keystrokeTimestampsRef.current.length === 0) {
        setWpm(prev => (prev > 0 ? Math.max(0, Math.round(prev * 0.9 - 1)) : 0));
      }
    }, 500);
    return () => clearInterval(interval);
  }, []);

  // Render both Left (Master) and Right (Peripheral) OLED displays
  useEffect(() => {
    const V_WIDTH = 32;
    const V_HEIGHT = 128;
    const PIXEL_PITCH = 2; // Crisp dot simulation
    const DOT_SIZE = 1.6;
    const onColor = '#e2f1ff';
    const offColor = '#0b0e13';

    // -------------------------------------------------------------
    // 1. RENDER LEFT (MASTER) DISPLAY
    // -------------------------------------------------------------
    const leftCanvas = leftCanvasRef.current;
    if (leftCanvas) {
      const ctx = leftCanvas.getContext('2d');
      if (ctx) {
        const vbuf = new BwpxGrid(V_WIDTH, V_HEIGHT);

        const blitSlice = (sliceId: string, destX: number, destY: number) => {
          const slice = getSlice(sliceId);
          if (!slice) return;
          for (let sy = 0; sy < slice.height; sy++) {
            for (let sx = 0; sx < slice.width; sx++) {
              if (symbolsGrid.get(slice.x + sx, slice.y + sy)) {
                vbuf.set(destX + sx, destY + sy, 1);
              }
            }
          }
        };

        const drawText = (str: string, startX: number, startY: number, size: 'small' | 'big' = 'small'): number => {
          if (!str) return startX;
          let curX = startX;
          for (let i = 0; i < str.length; i++) {
            const char = str[i];
            if (char === ' ') {
              curX += size === 'big' ? 6 : 4;
              continue;
            }
            if (fontMappings.length > 0) {
              let m = fontMappings.find(item => item.chars.includes(char));
              if (!m) {
                m = fontMappings.find(item => item.chars.toUpperCase().includes(char.toUpperCase()));
              }
              const slot = m ? (size === 'big' ? (m.big || m.small) : (m.small || m.big)) : null;
              if (slot) {
                for (let gy = 0; gy < slot.height; gy++) {
                  for (let gx = 0; gx < slot.width; gx++) {
                    if (fontGrid.get(slot.x + gx, slot.y + gy)) {
                      vbuf.set(curX + gx, startY + gy, 1);
                    }
                  }
                }
                curX += (slot.advanceX ?? (slot.width + 1));
                continue;
              }
            }
            const cp = char.toUpperCase().codePointAt(0) || 0;
            const glyph = getGlyph(cp);
            if (glyph) {
              for (let gy = 0; gy < glyph.height; gy++) {
                for (let gx = 0; gx < glyph.width; gx++) {
                  if (fontGrid.get(glyph.x + gx, glyph.y + gy)) {
                    vbuf.set(curX + gx, startY + gy, 1);
                  }
                }
              }
              curX += glyph.advanceX;
            } else {
              curX += size === 'big' ? 6 : 4;
            }
          }
          return curX;
        };

        if (!isIdle) {
          // Status Bar
          if (isBlockEnabled('block-status')) {
            const statusY = getBlockY('block-status', 0);
            if (outputMode === 'usb') {
              blitSlice('SYMBOL_USB', 1, statusY + 1);
            } else {
              blitSlice('SYMBOL_BLUETOOTH', 3, statusY + 2);
            }

            blitSlice('SYMBOL_BATTERY_FRAME', 14, statusY + 1);
            const numBars = Math.min(4, Math.floor((battery + 12) / 25));
            for (let b = 0; b < numBars; b++) {
              const bx = 16 + b * 3;
              for (let by = statusY + 3; by <= statusY + 7; by++) {
                vbuf.set(bx, by, 1);
                vbuf.set(bx + 1, by, 1);
              }
            }
          }

          // Layer Bar
          if (isBlockEnabled('block-layer-label')) {
            const layerY = getBlockY('block-layer-label', 25);
            blitSlice(`SYMBOL_BRACKET_LAYER_${currentLayer % 4}`, 5, layerY);
            const curLayerName = layerNames[currentLayer] || layerNames[0] || 'DEFAULT';
            drawText(curLayerName, 4, layerY + 3);
          }

          // Center Art
          if (isBlockEnabled('block-art')) {
            const artY = getBlockY('block-art', 47);
            blitSlice(`SYMBOL_SKULL_LAYER_${currentLayer % 4}`, 3, artY);
          }

          // WPM Section
          if (isBlockEnabled('block-wpm')) {
            const wpmY = getBlockY('block-wpm', 83);
            const wpmStr = Math.min(999, Math.max(0, wpm)).toString().padStart(3, '0');
            drawText(wpmStr[0], 2, wpmY, 'big');
            drawText(wpmStr[1], 12, wpmY, 'big');
            drawText(wpmStr[2], 22, wpmY, 'big');

            const thresholds = [1, 10, 25, 40, 60, 80, 100];
            for (let stage = 0; stage < 7; stage++) {
              const arrowX = 2 + stage * 4;
              const arrowY = wpmY + 12;
              if (wpm >= thresholds[stage]) {
                blitSlice('SYMBOL_ARROW_HEAD', arrowX, arrowY);
              } else {
                blitSlice('SYMBOL_ARROW_DOT', arrowX, arrowY);
              }
            }
          }

          // Split Status
          if (isBlockEnabled('block-split')) {
            const splitY = getBlockY('block-split', 116);
            blitSlice(
              splitConnected ? 'SYMBOL_SPLIT_CONNECTED' : 'SYMBOL_SPLIT_DISCONNECTED',
              10,
              splitY
            );
          }
        } else {
          // IDLE SCREEN
          blitSlice('SYMBOL_SKULL_LAYER_0', 3, 35);
          const brandY = getBlockY('block-branding', 73);
          const brandText = (customText || 'ZMK DISPLAY').toUpperCase();
          const startX = Math.max(1, Math.floor((32 - brandText.length * 4) / 2));
          drawText(brandText, startX, brandY);

          // Sleep dots
          vbuf.set(24, 25, 1);
          vbuf.set(26, 23, 1);
          vbuf.set(28, 20, 1);
        }

        const finalGrid = vbuf;
        leftCanvas.width = V_WIDTH * PIXEL_PITCH;
        leftCanvas.height = V_HEIGHT * PIXEL_PITCH;

        ctx.fillStyle = '#05070a';
        ctx.fillRect(0, 0, leftCanvas.width, leftCanvas.height);

        for (let y = 0; y < V_HEIGHT; y++) {
          for (let x = 0; x < V_WIDTH; x++) {
            ctx.fillStyle = finalGrid.get(x, y) ? onColor : offColor;
            ctx.fillRect(x * PIXEL_PITCH, y * PIXEL_PITCH, DOT_SIZE, DOT_SIZE);
          }
        }
      }
    }

    // -------------------------------------------------------------
    // 2. RENDER RIGHT (PERIPHERAL) DISPLAY
    // -------------------------------------------------------------
    const rightCanvas = rightCanvasRef.current;
    if (rightCanvas) {
      const ctx = rightCanvas.getContext('2d');
      if (ctx) {
        const vbuf = new BwpxGrid(V_WIDTH, V_HEIGHT);

        const blitSlice = (sliceId: string, destX: number, destY: number) => {
          const slice = getSlice(sliceId);
          if (!slice) return;
          for (let sy = 0; sy < slice.height; sy++) {
            for (let sx = 0; sx < slice.width; sx++) {
              if (symbolsGrid.get(slice.x + sx, slice.y + sy)) {
                vbuf.set(destX + sx, destY + sy, 1);
              }
            }
          }
        };

        const drawText = (str: string, startX: number, startY: number, size: 'small' | 'big' = 'small'): number => {
          if (!str) return startX;
          let curX = startX;
          for (let i = 0; i < str.length; i++) {
            const char = str[i];
            if (char === ' ') {
              curX += size === 'big' ? 6 : 4;
              continue;
            }
            if (fontMappings.length > 0) {
              let m = fontMappings.find(item => item.chars.includes(char));
              if (!m) {
                m = fontMappings.find(item => item.chars.toUpperCase().includes(char.toUpperCase()));
              }
              const slot = m ? (size === 'big' ? (m.big || m.small) : (m.small || m.big)) : null;
              if (slot) {
                for (let gy = 0; gy < slot.height; gy++) {
                  for (let gx = 0; gx < slot.width; gx++) {
                    if (fontGrid.get(slot.x + gx, slot.y + gy)) {
                      vbuf.set(curX + gx, startY + gy, 1);
                    }
                  }
                }
                curX += (slot.advanceX ?? (slot.width + 1));
                continue;
              }
            }
            const cp = char.toUpperCase().codePointAt(0) || 0;
            const glyph = getGlyph(cp);
            if (glyph) {
              for (let gy = 0; gy < glyph.height; gy++) {
                for (let gx = 0; gx < glyph.width; gx++) {
                  if (fontGrid.get(glyph.x + gx, glyph.y + gy)) {
                    vbuf.set(curX + gx, startY + gy, 1);
                  }
                }
              }
              curX += glyph.advanceX;
            } else {
              curX += size === 'big' ? 6 : 4;
            }
          }
          return curX;
        };

        // Peripheral Battery Frame & bars
        blitSlice('SYMBOL_BATTERY_FRAME', 8, 8);
        const numBars = Math.min(4, Math.floor((battery + 12) / 25));
        for (let b = 0; b < numBars; b++) {
          const bx = 10 + b * 3;
          for (let by = 10; by <= 14; by++) {
            vbuf.set(bx, by, 1);
            vbuf.set(bx + 1, by, 1);
          }
        }

        // Split Wireless Link Status
        blitSlice(
          splitConnected ? 'SYMBOL_SPLIT_CONNECTED' : 'SYMBOL_SPLIT_DISCONNECTED',
          10,
          26
        );

        // Center Art (mirrored/matching layer art or skull)
        blitSlice(`SYMBOL_SKULL_LAYER_${currentLayer % 4}`, 3, 48);

        // Peripheral Label & Layer name
        const sideModel = keymapLayout.columns === 6 ? 'CORNE 6X3' : keymapLayout.columns === 5 ? 'CORNE 5X3' : 'ZMK 5X3';
        const modelParts = sideModel.split(' ');
        drawText(modelParts[0], 6, 82);
        if (modelParts[1]) {
          drawText(modelParts[1], 10, 92);
        }
        const curLayerName = layerNames[currentLayer] || layerNames[0] || 'DEFAULT';
        drawText(curLayerName, 4, 108);

        const finalGrid = vbuf;
        rightCanvas.width = V_WIDTH * PIXEL_PITCH;
        rightCanvas.height = V_HEIGHT * PIXEL_PITCH;

        ctx.fillStyle = '#05070a';
        ctx.fillRect(0, 0, rightCanvas.width, rightCanvas.height);

        for (let y = 0; y < V_HEIGHT; y++) {
          for (let x = 0; x < V_WIDTH; x++) {
            ctx.fillStyle = finalGrid.get(x, y) ? onColor : offColor;
            ctx.fillRect(x * PIXEL_PITCH, y * PIXEL_PITCH, DOT_SIZE, DOT_SIZE);
          }
        }
      }
    }
  }, [
    symbolsGrid,
    symbolSlices,
    fontGrid,
    fontGlyphs,
    layoutBlocks,
    isIdle,
    outputMode,
    battery,
    currentLayer,
    wpm,
    splitConnected,
    customText,
    layerNames,
  ]);

  return (
    <div className="oled-preview-fullscreen">
      {/* =========================================================================
          TOP: CUTE MINIMALIST CORNE 5X3 SPLIT VISUALIZATION WITH DUAL DISPLAYS
          ========================================================================= */}
      <div className="corne-stage-container">
        <div className="corne-keyboard-split">
          {/* LEFT HALF (MASTER) */}
          <div className="corne-half-case left-half">
            <div className="half-inner-layout">
              {/* Keys Cluster (Matrix + Thumbs tight underneath) */}
              <div className="corne-keys-cluster">
                {/* Dynamic Columns Matrix */}
                <div className="corne-matrix">
                  {Array.from({ length: keymapLayout.columns }, (_, colIdx) => (
                    <div
                      key={colIdx}
                      className="corne-col"
                      style={{ transform: `translateY(${getColStagger(colIdx, keymapLayout.columns, false)}px)` }}
                    >
                      {Array.from({ length: keymapLayout.rows }, (_, rowIdx) => {
                        const keyLabel = currentLeftMatrix[rowIdx]?.[colIdx] || '';
                        const coordId = `L_${rowIdx}_${colIdx}`;
                        const isPressed = pressedKeys.has(coordId);
                        const isEmpty = !keyLabel;
                        return (
                          <div
                            key={rowIdx}
                            className={`corne-keycap ${isEmpty ? 'empty' : ''} ${isPressed ? 'pressed' : ''}`}
                            onClick={() => triggerKeyPress(coordId)}
                            title={keyLabel ? `Left [${rowIdx},${colIdx}]: ${keyLabel}` : `Left [${rowIdx},${colIdx}]`}
                          >
                            {keyLabel ? <span className="keycap-legend">{keyLabel}</span> : null}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>

                {/* Thumb Keys Cluster */}
                <div className="corne-thumbs left-thumbs">
                  {currentLeftThumbs.map((t, idx) => {
                    const coordId = `LT_${idx}`;
                    const isPressed = pressedKeys.has(coordId);
                    const isEmpty = !t;
                    return (
                      <div
                        key={idx}
                        className={`corne-thumb-key thumb-${idx} ${isEmpty ? 'empty' : ''} ${isPressed ? 'pressed' : ''}`}
                        onClick={() => triggerKeyPress(coordId)}
                        title={t ? `Left Thumb [${idx}]: ${t}` : `Left Thumb [${idx}]`}
                      >
                        {t ? <span className="thumb-legend">{t}</span> : null}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* OLED Display (Inner Side) */}
              <div className="corne-mcu-bay">
                <div className="mcu-pcb-socket">
                  <div className="oled-glass-housing">
                    <canvas
                      ref={leftCanvasRef}
                      className="corne-oled-canvas"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT HALF (PERIPHERAL) */}
          <div className="corne-half-case right-half">
            <div className="half-inner-layout mirrored">
              {/* OLED Display (Inner Side) */}
              <div className="corne-mcu-bay">
                <div className="mcu-pcb-socket">
                  <div className="oled-glass-housing">
                    <canvas
                      ref={rightCanvasRef}
                      className="corne-oled-canvas"
                    />
                  </div>
                </div>
              </div>

              {/* Keys Cluster (Matrix + Thumbs tight underneath) */}
              <div className="corne-keys-cluster">
                {/* Dynamic Columns Matrix */}
                <div className="corne-matrix">
                  {Array.from({ length: keymapLayout.columns }, (_, colIdx) => (
                    <div
                      key={colIdx}
                      className="corne-col"
                      style={{ transform: `translateY(${getColStagger(colIdx, keymapLayout.columns, true)}px)` }}
                    >
                      {Array.from({ length: keymapLayout.rows }, (_, rowIdx) => {
                        const keyLabel = currentRightMatrix[rowIdx]?.[colIdx] || '';
                        const coordId = `R_${rowIdx}_${colIdx}`;
                        const isPressed = pressedKeys.has(coordId);
                        const isEmpty = !keyLabel;
                        return (
                          <div
                            key={rowIdx}
                            className={`corne-keycap ${isEmpty ? 'empty' : ''} ${isPressed ? 'pressed' : ''}`}
                            onClick={() => triggerKeyPress(coordId)}
                            title={keyLabel ? `Right [${rowIdx},${colIdx}]: ${keyLabel}` : `Right [${rowIdx},${colIdx}]`}
                          >
                            {keyLabel ? <span className="keycap-legend">{keyLabel}</span> : null}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>

                {/* Thumb Keys Cluster */}
                <div className="corne-thumbs right-thumbs">
                  {currentRightThumbs.map((t, idx) => {
                    const coordId = `RT_${idx}`;
                    const isPressed = pressedKeys.has(coordId);
                    const isEmpty = !t;
                    return (
                      <div
                        key={idx}
                        className={`corne-thumb-key thumb-${idx} ${isEmpty ? 'empty' : ''} ${isPressed ? 'pressed' : ''}`}
                        onClick={() => triggerKeyPress(coordId)}
                        title={t ? `Right Thumb [${idx}]: ${t}` : `Right Thumb [${idx}]`}
                      >
                        {t ? <span className="thumb-legend">{t}</span> : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          BOTTOM: REACTIVE FIRMWARE SIMULATOR CONTROLS
          ========================================================================= */}
      <div className="simulator-controls-panel">
        <div className="panel-card-inner">
          <div className="card-header">
            <div className="flex items-center gap-2">
              <Sliders size={17} className="text-accent" />
              <h3 className="card-title">Live Keyboard Simulator Controls</h3>
            </div>
            <span className="badge-mode">Dual Display Sync</span>
          </div>

          <div className="controls-grid">
            {/* Screen Mode */}
            <div className="control-group">
              <label>Screen State</label>
              <div className="mode-toggle-group">
                <button
                  className={`btn-toggle ${!isIdle ? 'active' : ''}`}
                  onClick={() => setIsIdle(false)}
                >
                  <Sun size={14} />
                  <span>Active Mode</span>
                </button>
                <button
                  className={`btn-toggle ${isIdle ? 'active' : ''}`}
                  onClick={() => setIsIdle(true)}
                >
                  <Moon size={14} />
                  <span>Idle Sleep</span>
                </button>
              </div>
            </div>

            {/* Connection Mode */}
            <div className="control-group">
              <label>Output Protocol</label>
              <div className="button-pair">
                <button
                  className={`btn-chip ${outputMode === 'usb' ? 'active' : ''}`}
                  onClick={() => setOutputMode('usb')}
                >
                  <Usb size={13} />
                  <span>USB</span>
                </button>
                <button
                  className={`btn-chip ${outputMode === 'ble' ? 'active' : ''}`}
                  onClick={() => setOutputMode('ble')}
                >
                  <Bluetooth size={13} />
                  <span>Bluetooth</span>
                </button>
              </div>
            </div>

            {/* Active Layer Buttons */}
            <div className="control-group full-width">
              <label className="flex items-center gap-1">
                <Layers size={14} className="text-accent" />
                <span>Active Keyboard Layer</span>
              </label>
              <div className="layer-button-row">
                {layerNames.map((name, idx) => (
                  <button
                    key={name}
                    className={`btn-layer ${currentLayer === idx ? 'active' : ''}`}
                    onClick={() => setCurrentLayer(idx)}
                  >
                    <span className="layer-idx">{idx}</span>
                    <span className="layer-name">{name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Battery Level (Single Slider) */}
            <div className="control-group">
              <div className="label-with-value">
                <label className="flex items-center gap-1">
                  <Battery size={14} className="text-accent" />
                  <span>Battery Level</span>
                </label>
                <span className="value-chip">{battery}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={battery}
                onChange={e => setBattery(parseInt(e.target.value, 10))}
                className="slider-range"
              />
            </div>

            {/* Split Wireless Link */}
            <div className="control-group">
              <label>Split Wireless Link</label>
              <button
                className={`btn-toggle-subtle ${splitConnected ? 'active-accent' : 'inactive'}`}
                onClick={() => setSplitConnected(!splitConnected)}
              >
                <span>{splitConnected ? 'Linked (Connected)' : 'Disconnected (Unlinked)'}</span>
              </button>
            </div>

            {/* WPM Speed Gauge */}
            <div className="control-group full-width">
              <div className="label-with-value">
                <label className="flex items-center gap-1">
                  <Gauge size={14} className="text-accent" />
                  <span>Typing Speed (WPM)</span>
                </label>
                <span className="value-chip font-mono">{wpm} WPM</span>
              </div>
              <input
                type="range"
                min="0"
                max="160"
                value={wpm}
                onChange={e => setWpm(parseInt(e.target.value, 10))}
                className="slider-range"
              />
              <div className="wpm-arrow-preview">
                {[1, 10, 25, 40, 60, 80, 100].map((th, idx) => (
                  <span
                    key={idx}
                    className={`gauge-pip ${wpm >= th ? 'lit' : ''}`}
                    title={`Stage ${idx + 1}: ${th}+ WPM`}
                  >
                    ▲
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

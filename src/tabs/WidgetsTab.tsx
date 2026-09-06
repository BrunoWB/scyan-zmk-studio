import React, { useState } from 'react';
import { BwpxGrid } from '../bwpx/core/BwpxGrid';
import type { SpriteSlice, FontGlyph, FontCharMapping } from '../types/zmk';
import {
  Battery,
  Wifi,
  Gauge,
  Layers,
  Sparkles,
} from 'lucide-react';

export interface WidgetsTabProps {
  symbolsGrid: BwpxGrid;
  symbolSlices: SpriteSlice[];
  fontGrid: BwpxGrid;
  fontGlyphs?: FontGlyph[];
  fontMappings?: FontCharMapping[];
  customText: string;
  onCustomTextChange: (text: string) => void;
}

export const WidgetsTab: React.FC<WidgetsTabProps> = ({
  symbolsGrid,
  symbolSlices,
  fontGrid,
  fontGlyphs = [],
  fontMappings = [],
  customText,
  onCustomTextChange,
}) => {
  const [activeWidget, setActiveWidget] = useState<
    'battery' | 'connection' | 'wpm' | 'layer' | 'branding'
  >('battery');

  // Widget preview state
  const [testBattery, setTestBattery] = useState<number>(75);
  const [testWpm, setTestWpm] = useState<number>(55);

  // Helper to render slice to canvas
  const renderSliceToCanvas = (
    canvas: HTMLCanvasElement | null,
    sliceId: string,
    scale = 3
  ) => {
    if (!canvas) return;
    const slice = symbolSlices.find(s => s.id === sliceId);
    if (!slice) return;

    canvas.width = slice.width * scale;
    canvas.height = slice.height * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#0f1217';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#00d2ff';

    for (let y = 0; y < slice.height; y++) {
      for (let x = 0; x < slice.width; x++) {
        if (symbolsGrid.get(slice.x + x, slice.y + y)) {
          ctx.fillRect(x * scale, y * scale, scale - 0.4, scale - 0.4);
        }
      }
    }
  };

  // Helper to render text preview using fontGrid and fontMappings / fontGlyphs
  const renderTextPreviewToCanvas = (canvas: HTMLCanvasElement | null, text: string) => {
    if (!canvas) return;
    const scale = 2;
    let totalW = 4;
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (fontMappings.length > 0) {
        let m = fontMappings.find(item => item.chars.includes(char));
        if (!m) m = fontMappings.find(item => item.chars.toUpperCase().includes(char.toUpperCase()));
        const slot = m?.small || m?.big;
        if (slot) {
          totalW += slot.advanceX ?? (slot.width + 1);
          continue;
        }
      }
      const cp = char.toUpperCase().codePointAt(0) || 0;
      const g = fontGlyphs.find(glyph => glyph.codepoint === cp);
      totalW += g ? g.advanceX : 4;
    }
    canvas.width = Math.max(60, totalW * scale);
    canvas.height = 10 * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#0f1217';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#00d2ff';

    let curX = 2;
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (fontMappings.length > 0) {
        let m = fontMappings.find(item => item.chars.includes(char));
        if (!m) m = fontMappings.find(item => item.chars.toUpperCase().includes(char.toUpperCase()));
        const slot = m?.small || m?.big;
        if (slot) {
          for (let gy = 0; gy < slot.height; gy++) {
            for (let gx = 0; gx < slot.width; gx++) {
              if (fontGrid.get(slot.x + gx, slot.y + gy)) {
                ctx.fillRect((curX + gx) * scale, (2 + gy) * scale, scale - 0.3, scale - 0.3);
              }
            }
          }
          curX += slot.advanceX ?? (slot.width + 1);
          continue;
        }
      }
      const cp = char.toUpperCase().codePointAt(0) || 0;
      const g = fontGlyphs.find(glyph => glyph.codepoint === cp);
      if (g) {
        for (let gy = 0; gy < g.height; gy++) {
          for (let gx = 0; gx < g.width; gx++) {
            if (fontGrid.get(g.x + gx, g.y + gy)) {
              ctx.fillRect((curX + gx) * scale, (2 + gy) * scale, scale - 0.3, scale - 0.3);
            }
          }
        }
        curX += g.advanceX;
      } else {
        curX += 4;
      }
    }
  };

  return (
    <div className="widgets-tab-container">
      {/* Left Sidebar: Widget Selection */}
      <div className="widgets-sidebar">
        <h3 className="sidebar-title">Display Widgets</h3>
        <p className="sidebar-desc">
          Configure widget logic, dimensions, and assign atlas symbols from Tabs 2 & 3.
        </p>

        <div className="widgets-nav-list">
          <button
            className={`widget-nav-item ${activeWidget === 'battery' ? 'active' : ''}`}
            onClick={() => setActiveWidget('battery')}
          >
            <Battery size={16} className="text-emerald-400" />
            <div className="widget-nav-meta">
              <span className="widget-nav-name">Battery Meter</span>
              <span className="widget-nav-sub">Frame + 4-step dynamic fill</span>
            </div>
          </button>

          <button
            className={`widget-nav-item ${activeWidget === 'connection' ? 'active' : ''}`}
            onClick={() => setActiveWidget('connection')}
          >
            <Wifi size={16} className="text-sky-400" />
            <div className="widget-nav-meta">
              <span className="widget-nav-name">Connection & Split</span>
              <span className="widget-nav-sub">USB, BLE & Split Link icons</span>
            </div>
          </button>

          <button
            className={`widget-nav-item ${activeWidget === 'wpm' ? 'active' : ''}`}
            onClick={() => setActiveWidget('wpm')}
          >
            <Gauge size={16} className="text-amber-400" />
            <div className="widget-nav-meta">
              <span className="widget-nav-name">WPM Speed & Arrows</span>
              <span className="widget-nav-sub">3-digit speed + 7-level gauge</span>
            </div>
          </button>

          <button
            className={`widget-nav-item ${activeWidget === 'layer' ? 'active' : ''}`}
            onClick={() => setActiveWidget('layer')}
          >
            <Layers size={16} className="text-purple-400" />
            <div className="widget-nav-meta">
              <span className="widget-nav-name">Layer Art & Brackets</span>
              <span className="widget-nav-sub">Layers 0–3 graphics & banners</span>
            </div>
          </button>

          <button
            className={`widget-nav-item ${activeWidget === 'branding' ? 'active' : ''}`}
            onClick={() => setActiveWidget('branding')}
          >
            <Sparkles size={16} className="text-pink-400" />
            <div className="widget-nav-meta">
              <span className="widget-nav-name">Idle Screen & Branding</span>
              <span className="widget-nav-sub">Sleep state & custom text banner</span>
            </div>
          </button>
        </div>
      </div>

      {/* Right Content: Active Widget Editor & Live Visualizer */}
      <div className="widgets-content-pane">
        {/* 1. BATTERY WIDGET */}
        {activeWidget === 'battery' && (
          <div className="widget-config-card">
            <div className="widget-card-header">
              <div>
                <h3 className="text-base font-semibold text-text-main flex items-center gap-2">
                  <Battery size={18} className="text-emerald-400" />
                  <span>Battery Meter Widget</span>
                </h3>
                <p className="text-xs text-muted mt-1">
                  Renders the battery terminal frame slice and dynamically fills up to 4 interior bars based on battery state.
                </p>
              </div>
            </div>

            <div className="widget-interactive-demo">
              <div className="demo-canvas-box">
                <canvas
                  ref={el => renderSliceToCanvas(el, 'SYMBOL_BATTERY_FRAME', 4)}
                  className="pixel-preview-canvas"
                />
              </div>
              <div className="demo-controls">
                <div className="flex justify-between items-center text-xs">
                  <span>Simulated Level:</span>
                  <span className="font-mono text-accent">{testBattery}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={testBattery}
                  onChange={e => setTestBattery(parseInt(e.target.value, 10))}
                  className="slider-range"
                />
              </div>
            </div>

            <div className="widget-settings-grid mt-4">
              <div className="setting-field">
                <label>Frame Atlas Slice</label>
                <select className="select-dark" defaultValue="SYMBOL_BATTERY_FRAME">
                  {symbolSlices.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.id})
                    </option>
                  ))}
                </select>
              </div>
              <div className="setting-field">
                <label>Fill Bar Width (px)</label>
                <input type="number" defaultValue={2} className="input-text-dark" />
              </div>
              <div className="setting-field">
                <label>Interior Bar Spacing (px)</label>
                <input type="number" defaultValue={1} className="input-text-dark" />
              </div>
              <div className="setting-field">
                <label>Max Segment Bars</label>
                <input type="number" defaultValue={4} className="input-text-dark" />
              </div>
            </div>
          </div>
        )}

        {/* 2. CONNECTION WIDGET */}
        {activeWidget === 'connection' && (
          <div className="widget-config-card">
            <div className="widget-card-header">
              <div>
                <h3 className="text-base font-semibold text-text-main flex items-center gap-2">
                  <Wifi size={18} className="text-sky-400" />
                  <span>Connection & Split Wireless Widget</span>
                </h3>
                <p className="text-xs text-muted mt-1">
                  Displays active connection protocol (USB / BLE profile) and split keyboard inter-half wireless status.
                </p>
              </div>
            </div>

            <div className="widget-symbols-mosaic">
              <div className="mosaic-item">
                <span className="mosaic-label">USB Mode</span>
                <canvas
                  ref={el => renderSliceToCanvas(el, 'SYMBOL_USB', 3)}
                  className="pixel-preview-canvas"
                />
                <select className="select-dark text-xs mt-2" defaultValue="SYMBOL_USB">
                  {symbolSlices.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div className="mosaic-item">
                <span className="mosaic-label">Bluetooth Mode</span>
                <canvas
                  ref={el => renderSliceToCanvas(el, 'SYMBOL_BLUETOOTH', 3)}
                  className="pixel-preview-canvas"
                />
                <select className="select-dark text-xs mt-2" defaultValue="SYMBOL_BLUETOOTH">
                  {symbolSlices.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div className="mosaic-item">
                <span className="mosaic-label">Split Linked</span>
                <canvas
                  ref={el => renderSliceToCanvas(el, 'SYMBOL_SPLIT_CONNECTED', 3)}
                  className="pixel-preview-canvas"
                />
                <select className="select-dark text-xs mt-2" defaultValue="SYMBOL_SPLIT_CONNECTED">
                  {symbolSlices.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div className="mosaic-item">
                <span className="mosaic-label">Split Unlinked</span>
                <canvas
                  ref={el => renderSliceToCanvas(el, 'SYMBOL_SPLIT_DISCONNECTED', 3)}
                  className="pixel-preview-canvas"
                />
                <select className="select-dark text-xs mt-2" defaultValue="SYMBOL_SPLIT_DISCONNECTED">
                  {symbolSlices.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* 3. WPM SPEED & ARROWS WIDGET */}
        {activeWidget === 'wpm' && (
          <div className="widget-config-card">
            <div className="widget-card-header">
              <div>
                <h3 className="text-base font-semibold text-text-main flex items-center gap-2">
                  <Gauge size={18} className="text-amber-400" />
                  <span>WPM Typing Speed & Arrows Gauge</span>
                </h3>
                <p className="text-xs text-muted mt-1">
                  Renders a 3-digit speed readout with 7 progressive gauge arrows lighting up as typing speed increases.
                </p>
              </div>
            </div>

            <div className="widget-interactive-demo">
              <div className="flex items-center gap-4">
                <canvas
                  ref={el => renderSliceToCanvas(el, 'SYMBOL_ARROW_HEAD', 4)}
                  className="pixel-preview-canvas"
                />
                <canvas
                  ref={el => renderSliceToCanvas(el, 'SYMBOL_ARROW_DOT', 4)}
                  className="pixel-preview-canvas"
                />
                <div className="text-xs text-muted">
                  Head Slice (Active) · Dot Slice (Inactive)
                </div>
              </div>

              <div className="demo-controls mt-3">
                <div className="flex justify-between items-center text-xs">
                  <span>Speed Slider:</span>
                  <span className="font-mono text-accent">{testWpm} WPM</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="140"
                  value={testWpm}
                  onChange={e => setTestWpm(parseInt(e.target.value, 10))}
                  className="slider-range"
                />
              </div>
            </div>

            <div className="thresholds-table mt-4">
              <h4 className="text-xs font-semibold text-text-muted mb-2">Stage Speed Thresholds</h4>
              <div className="grid grid-cols-7 gap-2">
                {[
                  { stage: 1, wpm: 1 },
                  { stage: 2, wpm: 10 },
                  { stage: 3, wpm: 25 },
                  { stage: 4, wpm: 40 },
                  { stage: 5, wpm: 60 },
                  { stage: 6, wpm: 80 },
                  { stage: 7, wpm: 100 },
                ].map(t => (
                  <div key={t.stage} className="threshold-chip">
                    <span className="text-muted">P{t.stage}</span>
                    <span className="font-mono text-accent">{t.wpm}+</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 4. LAYER ART & BRACKETS WIDGET */}
        {activeWidget === 'layer' && (
          <div className="widget-config-card">
            <div className="widget-card-header">
              <div>
                <h3 className="text-base font-semibold text-text-main flex items-center gap-2">
                  <Layers size={18} className="text-purple-400" />
                  <span>Layer Graphic Art & Brackets</span>
                </h3>
                <p className="text-xs text-muted mt-1">
                  Binds custom character art and banner brackets to active keyboard layers (0 to 3).
                </p>
              </div>
            </div>

            <div className="widget-symbols-mosaic">
              {[0, 1, 2, 3].map(layerIdx => {
                const skullId = `SYMBOL_SKULL_LAYER_${layerIdx}`;
                const bracketId = `SYMBOL_BRACKET_LAYER_${layerIdx}`;
                const layerNames = ['QWERTY (0)', 'LOWER (1)', 'RAISE (2)', 'ADJUST (3)'];
                return (
                  <div key={layerIdx} className="mosaic-item">
                    <span className="mosaic-label font-bold text-accent">{layerNames[layerIdx]}</span>
                    <div className="flex flex-col items-center gap-2 my-2">
                      <canvas
                        ref={el => renderSliceToCanvas(el, skullId, 2)}
                        className="pixel-preview-canvas"
                      />
                      <canvas
                        ref={el => renderSliceToCanvas(el, bracketId, 2)}
                        className="pixel-preview-canvas"
                      />
                    </div>
                    <select className="select-dark text-xs" defaultValue={skullId}>
                      {symbolSlices.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 5. IDLE / BRANDING WIDGET */}
        {activeWidget === 'branding' && (
          <div className="widget-config-card">
            <div className="widget-card-header">
              <div>
                <h3 className="text-base font-semibold text-text-main flex items-center gap-2">
                  <Sparkles size={18} className="text-pink-400" />
                  <span>Idle Screen & Custom Branding</span>
                </h3>
                <p className="text-xs text-muted mt-1">
                  Configures sleep screen art and custom text drawn with Font Atlas glyphs.
                </p>
              </div>
            </div>

            <div className="widget-settings-grid">
              <div className="setting-field">
                <label>Custom Username / Text Banner</label>
                <input
                  type="text"
                  maxLength={8}
                  value={customText}
                  onChange={e => onCustomTextChange(e.target.value)}
                  className="input-text-dark font-mono uppercase"
                  placeholder="BRUNOWB"
                />
                <div className="mt-2">
                  <canvas
                    ref={el => renderTextPreviewToCanvas(el, customText || 'BRUNOWB')}
                    className="pixel-preview-canvas"
                  />
                </div>
              </div>

              <div className="setting-field">
                <label>Idle Graphic Art Slice</label>
                <select className="select-dark" defaultValue="SYMBOL_SKULL_LAYER_0">
                  {symbolSlices.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div className="setting-field">
                <label>Idle Timeout (ms)</label>
                <input type="number" defaultValue={30000} className="input-text-dark font-mono" />
              </div>

              <div className="setting-field">
                <label>Screen Inversion in Idle</label>
                <select className="select-dark" defaultValue="true">
                  <option value="true">Enabled (Invert colors)</option>
                  <option value="false">Disabled (Keep standard)</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};


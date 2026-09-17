import React from 'react';
import {
  Battery,
  Bluetooth,
  Usb,
  Gauge,
  Layers,
  Moon,
  Sun,
  Sliders,
  Shuffle,
} from 'lucide-react';
import { formatLayerLabel } from '../../services/keymapService';

export interface OledSimulationPanelProps {
  isIdle: boolean;
  onSetIsIdle: (idle: boolean) => void;
  outputMode: 'usb' | 'ble';
  onSetOutputMode: (mode: 'usb' | 'ble') => void;
  bleProfileIndex: number;
  onSetBleProfileIndex: (idx: number) => void;
  currentLayer: number;
  onSetCurrentLayer: (layer: number) => void;
  layerNames: string[];
  splitConnected: boolean;
  onToggleSplitConnected: () => void;
  capsLock: boolean;
  onToggleCapsLock: () => void;
  randomClickerEnabled: boolean;
  clickerSpeed: number;
  onToggleRandomClicker: () => void;
  battery: number;
  onSetBattery: (battery: number) => void;
  wpm: number;
  onSetWpm: (wpm: number) => void;
  screenCount: number;
}

export const OledSimulationPanel: React.FC<OledSimulationPanelProps> = ({
  isIdle,
  onSetIsIdle,
  outputMode,
  onSetOutputMode,
  bleProfileIndex,
  onSetBleProfileIndex,
  currentLayer,
  onSetCurrentLayer,
  layerNames,
  splitConnected,
  onToggleSplitConnected,
  capsLock,
  onToggleCapsLock,
  randomClickerEnabled,
  clickerSpeed,
  onToggleRandomClicker,
  battery,
  onSetBattery,
  wpm,
  onSetWpm,
  screenCount,
}) => {
  return (
    <div className="simulator-controls-panel">
      <div className="panel-card-inner">
        <div className="card-header">
          <div className="flex items-center gap-2">
            <Sliders size={17} className="text-accent" />
            <h3 className="card-title">Live Keyboard Simulator Controls</h3>
          </div>
          <span className="badge-mode">
            {screenCount > 2
              ? `${screenCount}-Screen Multi-Display`
              : screenCount === 1
              ? 'Single Display'
              : 'Dual Display Sync'}
          </span>
        </div>

        <div className="controls-grid">
          {/* Screen State */}
          <div className="control-group">
            <label>Screen State</label>
            <div className="widget-mode-radio-group w-fit" role="radiogroup" aria-label="Screen State">
              <button
                type="button"
                role="radio"
                aria-checked={!isIdle}
                className={`widget-mode-radio-btn ${!isIdle ? 'active' : ''}`}
                onClick={() => onSetIsIdle(false)}
              >
                <Sun size={13} />
                <span>Active Mode</span>
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={isIdle}
                className={`widget-mode-radio-btn ${isIdle ? 'active' : ''}`}
                onClick={() => onSetIsIdle(true)}
              >
                <Moon size={13} />
                <span>Idle Sleep</span>
              </button>
            </div>
          </div>

          {/* Output Protocol */}
          <div className="control-group">
            <label>Output Protocol</label>
            <div className="widget-mode-radio-group w-fit" role="radiogroup" aria-label="Output Protocol">
              <button
                type="button"
                role="radio"
                aria-checked={outputMode === 'usb'}
                className={`widget-mode-radio-btn ${outputMode === 'usb' ? 'active' : ''}`}
                onClick={() => onSetOutputMode('usb')}
              >
                <Usb size={13} />
                <span>USB</span>
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={outputMode === 'ble'}
                className={`widget-mode-radio-btn ${outputMode === 'ble' ? 'active' : ''}`}
                onClick={() => onSetOutputMode('ble')}
              >
                <Bluetooth size={13} />
                <span>Bluetooth</span>
              </button>
            </div>
            {outputMode === 'ble' && (
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-xs text-muted">Profile:</span>
                <div className="widget-mode-radio-group flex-wrap w-fit" role="radiogroup" aria-label="Output Protocol Profiles">
                  {[0, 1, 2, 3, 4, 5].map(idx => (
                    <button
                      key={idx}
                      type="button"
                      role="radio"
                      aria-checked={bleProfileIndex === idx}
                      className={`widget-mode-radio-btn !px-2 !py-0.5 text-xs ${bleProfileIndex === idx ? 'active' : ''}`}
                      onClick={() => onSetBleProfileIndex(idx)}
                    >
                      <span>{idx === 0 ? 'No conn' : `P${idx}`}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Active Keyboard Layer */}
          <div className="control-group full-width">
            <label className="flex items-center gap-1">
              <Layers size={14} className="text-accent" />
              <span>Active Keyboard Layer</span>
            </label>
            <div className="widget-mode-radio-group flex-wrap w-fit" role="radiogroup" aria-label="Active Keyboard Layer">
              {layerNames.map((name, idx) => (
                <button
                  key={`${name}-${idx}`}
                  type="button"
                  role="radio"
                  aria-checked={currentLayer === idx}
                  className={`widget-mode-radio-btn ${currentLayer === idx ? 'active' : ''}`}
                  onClick={() => onSetCurrentLayer(idx)}
                >
                  <span>{formatLayerLabel(idx, name)}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Wireless Link, Caps Lock & Character Clicker Row */}
          <div className="full-width">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Split Wireless Link */}
              <div className="control-group">
                <label>Split Wireless Link</label>
                <button
                  type="button"
                  className={`btn-toggle-subtle flex items-center justify-center gap-2 h-9 ${splitConnected ? 'active-accent' : 'inactive'}`}
                  onClick={onToggleSplitConnected}
                >
                  <span>{splitConnected ? 'Linked (Connected)' : 'Disconnected (Unlinked)'}</span>
                </button>
              </div>

              {/* Caps Lock State */}
              <div className="control-group">
                <label>Caps Lock State</label>
                <button
                  type="button"
                  className={`btn-toggle-subtle flex items-center justify-center gap-2 h-9 ${capsLock ? 'active-accent' : 'inactive'}`}
                  onClick={onToggleCapsLock}
                >
                  <span>{capsLock ? 'Caps Lock: ON' : 'Caps Lock: OFF'}</span>
                </button>
              </div>

              {/* Character Clicker */}
              <div className="control-group">
                <label>Character Clicker</label>
                <button
                  type="button"
                  className={`btn-toggle-subtle flex items-center justify-center gap-2 h-9 ${randomClickerEnabled ? 'active-accent' : 'inactive'}`}
                  onClick={onToggleRandomClicker}
                  title={randomClickerEnabled ? 'Click to stop character clicker' : 'Simulate random typing speeds (0 stalled to 60 WPM)'}
                >
                  <Shuffle size={13} />
                  <span>
                    {randomClickerEnabled
                      ? clickerSpeed === 0
                        ? 'Clicker: Stalled (0 WPM)'
                        : `Clicker: ~${clickerSpeed} WPM`
                      : 'Clicker: OFF'}
                  </span>
                </button>
              </div>
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
              onChange={e => onSetBattery(parseInt(e.target.value, 10))}
              className="slider-range"
            />
          </div>

          {/* Typing Speed (WPM) (Single Slider) */}
          <div className="control-group">
            <div className="label-with-value">
              <label className="flex items-center gap-1">
                <Gauge size={14} className="text-accent" />
                <span>Typing Speed (WPM)</span>
              </label>
              <span className="value-chip font-mono">{`${wpm} WPM`}</span>
            </div>
            <input
              type="range"
              min="0"
              max="160"
              value={wpm}
              onChange={e => onSetWpm(parseInt(e.target.value, 10))}
              className="slider-range"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

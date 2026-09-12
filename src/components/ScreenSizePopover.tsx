import React, { useState, useEffect } from 'react';
import { Settings, X, Monitor, Moon, Clock, Power, Check, Plus, Minus, SlidersHorizontal } from 'lucide-react';
import { trackEvent } from '../services/analytics';

export const PRESET_SCREEN_SIZES = [
  { label: '32 × 128 (Corne / OLED Standard)', width: 32, height: 128 },
  { label: '68 × 160 (nice!view)', width: 68, height: 160 },
  { label: '128 × 64 (OLED Standard)', width: 128, height: 64 },
  { label: '128 × 32 (Horizontal OLED)', width: 128, height: 32 },
  { label: 'Custom', width: 0, height: 0 },
];

export const IDLE_TIMEOUT_PRESETS = [
  { label: '10s', sec: 10 },
  { label: '15s', sec: 15 },
  { label: '30s (Default)', sec: 30 },
  { label: '60s (1m)', sec: 60 },
  { label: '120s (2m)', sec: 120 },
  { label: '300s (5m)', sec: 300 },
];

export const SLEEP_TIMEOUT_PRESETS = [
  { label: '30s', sec: 30 },
  { label: '60s (Default)', sec: 60 },
  { label: '120s (2m)', sec: 120 },
  { label: '300s (5m)', sec: 300 },
  { label: '600s (10m)', sec: 600 },
];

export interface StepperControlProps {
  label?: string;
  value: number;
  onChange: (val: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  disabled?: boolean;
  accentColor?: 'cyan' | 'purple' | 'amber';
  className?: string;
  ariaLabel?: string;
}

/**
 * Numerical Stepper control matching the design system in FormControls reference.
 * Supports Minus and Plus decrement/increment buttons with direct numeric typing.
 */
export const StepperControl: React.FC<StepperControlProps> = ({
  label,
  value,
  onChange,
  min = 0,
  max = 9999,
  step = 1,
  unit,
  disabled = false,
  accentColor = 'cyan',
  className = '',
  ariaLabel,
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [localStr, setLocalStr] = useState(String(value));

  useEffect(() => {
    if (!isFocused) {
      setLocalStr(String(value));
    }
  }, [value, isFocused]);

  const commitValue = (valStr: string) => {
    const parsed = parseInt(valStr, 10);
    if (isNaN(parsed) || parsed < min) {
      onChange(min);
      setLocalStr(String(min));
    } else if (parsed > max) {
      onChange(max);
      setLocalStr(String(max));
    } else {
      onChange(parsed);
      setLocalStr(String(parsed));
    }
  };

  const handleDec = () => {
    if (disabled || value <= min) return;
    const nextVal = Math.max(min, value - step);
    onChange(nextVal);
    setLocalStr(String(nextVal));
  };

  const handleInc = () => {
    if (disabled || value >= max) return;
    const nextVal = Math.min(max, value + step);
    onChange(nextVal);
    setLocalStr(String(nextVal));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newStr = e.target.value;
    setLocalStr(newStr);
    const parsed = parseInt(newStr, 10);
    if (!isNaN(parsed) && parsed >= min && parsed <= max) {
      onChange(parsed);
    }
  };

  const handleFocus = () => {
    setIsFocused(true);
  };

  const handleBlur = () => {
    setIsFocused(false);
    commitValue(localStr);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      commitValue(localStr);
      (e.target as HTMLInputElement).blur();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      handleInc();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      handleDec();
    }
  };

  const focusBorderClass =
    accentColor === 'purple'
      ? 'focus-within:border-[#a953f6]/70'
      : accentColor === 'amber'
      ? 'focus-within:border-[#fbbf24]/70'
      : 'focus-within:border-[#00f0ff]/70';

  return (
    <div
      className={`bg-[#0b0d13] border border-[#1e2538] rounded-xl p-1.5 flex items-center justify-between transition-colors ${focusBorderClass} ${
        disabled ? 'opacity-40 pointer-events-none' : ''
      } ${className}`}
    >
      <button
        type="button"
        onClick={handleDec}
        disabled={disabled || value <= min}
        aria-label={`Decrease ${ariaLabel || label || 'value'}`}
        className="size-6 bg-[#131722] hover:bg-[#19202f] active:bg-[#20293d] text-white rounded flex items-center justify-center cursor-pointer text-xs transition-colors shrink-0 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-[#131722]"
      >
        <Minus className="size-3" />
      </button>

      <div className="flex items-center justify-center px-1 font-mono text-xs font-bold text-white flex-1 min-w-0">
        {label && <span className="text-[#94a3b8] mr-0.5 select-none">{`${label}:`}</span>}
        <input
          type="number"
          min={min}
          max={max}
          value={localStr}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          aria-label={ariaLabel || label}
          className="bg-transparent border-none outline-none text-xs text-white font-mono font-bold text-center w-full min-w-[1.8rem] max-w-[3.5rem] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none disabled:text-[#64748b]"
        />
        {unit && <span className="text-[10px] text-[#64748b] ml-0.5 select-none font-normal">{unit}</span>}
      </div>

      <button
        type="button"
        onClick={handleInc}
        disabled={disabled || value >= max}
        aria-label={`Increase ${ariaLabel || label || 'value'}`}
        className="size-6 bg-[#131722] hover:bg-[#19202f] active:bg-[#20293d] text-white rounded flex items-center justify-center cursor-pointer text-xs transition-colors shrink-0 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-[#131722]"
      >
        <Plus className="size-3" />
      </button>
    </div>
  );
};

export interface BlockSettingsSectionProps {
  isOpen: boolean;
  onClose: () => void;
  // Left / Unified settings
  screenDimensions: { width: number; height: number };
  onScreenDimensionsChange: (dims: { width: number; height: number }) => void;
  idleScreensEnabled?: boolean;
  onIdleScreensEnabledChange?: (enabled: boolean) => void;
  idleTimeoutSec?: number;
  onIdleTimeoutSecChange?: (sec: number) => void;
  screenOffTimeoutSec?: number;
  onScreenOffTimeoutSecChange?: (sec: number) => void;

  // Symmetric settings toggle (checked by default)
  symmetricSettings?: boolean;
  onSymmetricSettingsChange?: (symmetric: boolean) => void;

  // Right-specific settings (used when symmetricSettings === false)
  rightScreenDimensions?: { width: number; height: number };
  onRightScreenDimensionsChange?: (dims: { width: number; height: number }) => void;
  rightIdleScreensEnabled?: boolean;
  onRightIdleScreensEnabledChange?: (enabled: boolean) => void;
  rightIdleTimeoutSec?: number;
  onRightIdleTimeoutSecChange?: (sec: number) => void;
  rightScreenOffTimeoutSec?: number;
  onRightScreenOffTimeoutSecChange?: (sec: number) => void;

  className?: string;
}

interface SideSettingsBlockProps {
  title?: string;
  badge?: string;
  sideName: string;
  themeColor?: 'cyan' | 'purple' | 'amber';
  screenDimensions: { width: number; height: number };
  onScreenDimensionsChange: (dims: { width: number; height: number }) => void;
  idleScreensEnabled: boolean;
  onIdleScreensEnabledChange: (enabled: boolean) => void;
  idleTimeoutSec: number;
  onIdleTimeoutSecChange: (sec: number) => void;
  screenOffTimeoutSec: number;
  onScreenOffTimeoutSecChange: (sec: number) => void;
  layout?: 'horizontal' | 'vertical';
  disabled?: boolean;
}

const SideSettingsBlock: React.FC<SideSettingsBlockProps> = ({
  title,
  badge,
  sideName,
  themeColor = 'cyan',
  screenDimensions,
  onScreenDimensionsChange,
  idleScreensEnabled,
  onIdleScreensEnabledChange,
  idleTimeoutSec,
  onIdleTimeoutSecChange,
  screenOffTimeoutSec,
  onScreenOffTimeoutSecChange,
  layout = 'horizontal',
  disabled = false,
}) => {
  const matchedPreset = PRESET_SCREEN_SIZES.find(
    p => p.width === screenDimensions.width && p.height === screenDimensions.height
  );

  const handleIdleChange = (val: number) => {
    if (disabled) return;
    const clamped = Math.max(5, Math.min(1800, val));
    onIdleTimeoutSecChange(clamped);
    if (idleScreensEnabled && clamped >= screenOffTimeoutSec) {
      onScreenOffTimeoutSecChange(clamped + 15);
    }
  };

  const handleScreenOffChange = (val: number) => {
    if (disabled) return;
    const minSleep = idleScreensEnabled ? idleTimeoutSec + 5 : 10;
    const clamped = Math.max(minSleep, Math.min(7200, val));
    onScreenOffTimeoutSecChange(clamped);
  };

  const handleToggleIdle = () => {
    if (disabled) return;
    const next = !idleScreensEnabled;
    onIdleScreensEnabledChange(next);
    if (next && screenOffTimeoutSec <= idleTimeoutSec) {
      onScreenOffTimeoutSecChange(idleTimeoutSec + 15);
    }
  };

  const minSleep = idleScreensEnabled ? idleTimeoutSec + 5 : 10;
  const idleWindowSec = idleScreensEnabled ? Math.max(0, screenOffTimeoutSec - idleTimeoutSec) : 0;
  const isPurple = themeColor === 'purple';
  const isAmber = themeColor === 'amber';
  const isVertical = layout === 'vertical';

  return (
    <div className="space-y-2.5">
      {title && (
        <div className="flex items-center justify-between pb-1.5 border-b border-white/5">
          <div className="flex items-center gap-2">
            <span
              className={`size-2 rounded-full ${
                isAmber
                  ? 'bg-[#fbbf24] shadow-[0_0_8px_#fbbf24]'
                  : isPurple
                  ? 'bg-[#a953f6] shadow-[0_0_8px_#a953f6]'
                  : 'bg-[#00f0ff] shadow-[0_0_8px_#00f0ff]'
              }`}
            />
            <h4 className="text-xs font-semibold text-white tracking-wide">{title}</h4>
          </div>
          {badge && (
            <span
              className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                isAmber
                  ? 'bg-[#fbbf24]/15 text-[#fbbf24] border border-[#fbbf24]/30'
                  : isPurple
                  ? 'bg-[#a953f6]/15 text-[#a953f6] border border-[#a953f6]/30'
                  : 'bg-[#00f0ff]/15 text-[#00f0ff] border border-[#00f0ff]/30'
              }`}
            >
              {badge}
            </span>
          )}
        </div>
      )}

      {/* 3 Settings Cards */}
      <div className={isVertical ? "flex flex-col gap-3" : "grid grid-cols-1 md:grid-cols-3 gap-3.5"}>
        {/* Card 1: Screen Dimensions */}
        <div className="bg-[#0e1118] border border-[#1e2538] rounded-xl p-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-[#e2f1ff]">
                <Monitor size={13} className={isPurple ? 'text-[#a953f6]' : 'text-[#00f0ff]'} />
                <span>Screen Dimensions</span>
              </div>
              <span
                className={`font-mono text-[10px] px-1.5 py-0.5 rounded ${
                  isPurple ? 'text-[#a953f6] bg-[#a953f6]/10' : 'text-[#00f0ff] bg-[#00f0ff]/10'
                }`}
              >
                {`${screenDimensions.width}×${screenDimensions.height}px`}
              </span>
            </div>

            <div className="space-y-2.5">
              <div>
                <label className="text-[10px] font-mono uppercase text-[#64748b] block mb-1">
                  Preset Resolution
                </label>
                <select
                  value={matchedPreset ? `${matchedPreset.width}x${matchedPreset.height}` : 'custom'}
                  onChange={e => {
                    const val = e.target.value;
                    if (val === 'custom') return;
                    trackEvent('screen_size_changed', {
                      size: val,
                      side: sideName || 'Left',
                    });
                    const [w, h] = val.split('x').map(Number);
                    onScreenDimensionsChange({ width: w, height: h });
                  }}
                  disabled={disabled}
                  className={`w-full text-xs font-mono bg-[#141720] border border-[#232936] text-white rounded px-2 py-1.5 ${
                    isPurple ? 'focus:border-[#a953f6]' : 'focus:border-[#00f0ff]'
                  } focus:outline-none transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed`}
                >
                  {PRESET_SCREEN_SIZES.map(p => (
                    <option key={p.label} value={p.width > 0 ? `${p.width}x${p.height}` : 'custom'}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="text-[10px] font-mono uppercase text-[#64748b] mb-1 flex items-center justify-between">
                  <span>Dimensions Pair [W, H]</span>
                  <span className="text-[9px] text-[#475569]">Custom px</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <StepperControl
                    label="W"
                    value={screenDimensions.width}
                    onChange={w => onScreenDimensionsChange({ width: w, height: screenDimensions.height })}
                    min={16}
                    max={256}
                    step={2}
                    disabled={disabled}
                    accentColor={themeColor}
                    ariaLabel={`${sideName} Width`}
                  />
                  <StepperControl
                    label="H"
                    value={screenDimensions.height}
                    onChange={h => onScreenDimensionsChange({ width: screenDimensions.width, height: h })}
                    min={16}
                    max={256}
                    step={2}
                    disabled={disabled}
                    accentColor={themeColor}
                    ariaLabel={`${sideName} Height`}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-2.5 pt-2 border-t border-white/5 text-[10px] text-[#64748b] flex justify-between">
            <span>Canvas Stride</span>
            <span className="font-mono text-[#94a3b8]">{Math.ceil(screenDimensions.width / 8)} bytes/row</span>
          </div>
        </div>

        {/* Card 2: Idle Screensaver */}
        <div className="bg-[#0e1118] border border-[#1e2538] rounded-xl p-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-[#e2f1ff]">
                <Moon size={13} className={isPurple ? 'text-[#bf84fd]' : 'text-[#38bdf8]'} />
                <span>Idle Screensaver</span>
              </div>
              <span
                className={`font-mono text-[10px] px-1.5 py-0.5 rounded ${
                  idleScreensEnabled
                    ? isPurple
                      ? 'text-[#a953f6] bg-[#a953f6]/10 border border-[#a953f6]/20'
                      : 'text-[#00f0ff] bg-[#00f0ff]/10 border border-[#00f0ff]/20'
                    : 'text-[#94a3b8] bg-white/5 border border-white/10'
                }`}
              >
                {idleScreensEnabled ? 'Enabled' : 'Disabled'}
              </span>
            </div>

            {/* Toggle Switch */}
            <div className="space-y-2">
              <div className="flex items-center justify-between p-2 px-3 rounded-xl bg-[#0b0d13] border border-[#1e2538]">
                <div>
                  <div className="text-xs font-medium text-white">Allow Idle Screens</div>
                  <div className="text-[10px] text-[#64748b]">Show mascot / screensaver on inactivity</div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={idleScreensEnabled}
                  aria-label={`${sideName} Allow Idle Screens`}
                  disabled={disabled}
                  onClick={handleToggleIdle}
                  className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer shrink-0 disabled:opacity-40 disabled:cursor-not-allowed ${
                    idleScreensEnabled
                      ? isPurple
                        ? 'bg-[#a953f6] shadow-[0_0_10px_rgba(169,83,246,0.4)]'
                        : 'bg-[#00f0ff] shadow-[0_0_10px_rgba(0,240,255,0.4)]'
                      : 'bg-[#232c3f]'
                  }`}
                >
                  <div
                    className={`size-4 rounded-full bg-[#0b0d13] transition-transform ${
                      idleScreensEnabled ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              <p className="text-[11px] text-[#94a3b8] leading-relaxed">
                {idleScreensEnabled
                  ? `${sideName} idle layouts will show custom mascots and animations during keyboard inactivity.`
                  : `Display remains on active layout until the sleep timeout is reached.`}
              </p>
            </div>
          </div>

          <div className="mt-2.5 pt-2 border-t border-white/5 text-[10px] text-[#64748b] flex justify-between">
            <span>Layout Mode</span>
            <span className="font-mono text-[#94a3b8]">{idleScreensEnabled ? 'Dual (Active + Idle)' : 'Active-Only'}</span>
          </div>
        </div>

        {/* Card 3: Inactivity & Sleep Timers */}
        <div className="bg-[#0e1118] border border-[#1e2538] rounded-xl p-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-[#e2f1ff]">
                <Clock size={13} className="text-[#fbbf24]" />
                <span>Inactivity Timers</span>
              </div>
              <span className="font-mono text-[10px] text-[#fbbf24] bg-[#fbbf24]/10 px-1.5 py-0.5 rounded">
                {idleScreensEnabled ? `Idle: ${idleTimeoutSec}s · Off: ${screenOffTimeoutSec}s` : `Off: ${screenOffTimeoutSec}s`}
              </span>
            </div>

            <div className="space-y-2.5">
              {/* Timer 1: Idle Inactivity Timer */}
              <div className={`transition-opacity ${!idleScreensEnabled || disabled ? 'opacity-40 pointer-events-none' : ''}`}>
                <div className="flex items-center justify-between text-[10px] font-mono text-[#64748b] mb-1">
                  <span>TIME UNTIL IDLE</span>
                  <span className="text-white font-semibold">{idleTimeoutSec}s</span>
                </div>

                <div className="mb-1.5">
                  <StepperControl
                    label="Idle"
                    value={idleTimeoutSec}
                    onChange={handleIdleChange}
                    min={5}
                    max={1800}
                    step={5}
                    unit="s"
                    disabled={disabled || !idleScreensEnabled}
                    accentColor={themeColor}
                    ariaLabel={`${sideName} Time Until Idle`}
                  />
                </div>

                {/* Quick presets */}
                <div className="flex items-center gap-1 flex-wrap">
                  {IDLE_TIMEOUT_PRESETS.map(p => (
                    <button
                      key={p.sec}
                      type="button"
                      disabled={disabled || !idleScreensEnabled}
                      onClick={() => handleIdleChange(p.sec)}
                      className={`px-1.5 py-0.5 text-[10px] font-mono rounded transition-all cursor-pointer border ${
                        idleTimeoutSec === p.sec
                          ? isPurple
                            ? 'bg-[#a953f6]/20 text-[#a953f6] border-[#a953f6]/40 font-semibold'
                            : 'bg-[#00f0ff]/20 text-[#00f0ff] border-[#00f0ff]/40 font-semibold'
                          : 'bg-[#141720] text-[#64748b] border-transparent hover:text-white hover:bg-white/5'
                      }`}
                    >
                      {p.label.split(' ')[0]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Timer 2: Screen Off Timer */}
              <div>
                <div className="flex items-center justify-between text-[10px] font-mono text-[#64748b] mb-1">
                  <span>TIME UNTIL SCREEN OFF</span>
                  <span className="text-white font-semibold">{screenOffTimeoutSec}s</span>
                </div>

                <div className="mb-1.5">
                  <StepperControl
                    label="Off"
                    value={screenOffTimeoutSec}
                    onChange={handleScreenOffChange}
                    min={minSleep}
                    max={7200}
                    step={5}
                    unit="s"
                    disabled={disabled}
                    accentColor="amber"
                    ariaLabel={`${sideName} Time Until Screen Off`}
                  />
                </div>

                {/* Quick presets */}
                <div className="flex items-center gap-1 flex-wrap">
                  {SLEEP_TIMEOUT_PRESETS.map(p => {
                    const isPresetTooLow = idleScreensEnabled && p.sec <= idleTimeoutSec;
                    return (
                      <button
                        key={p.sec}
                        type="button"
                        disabled={disabled || isPresetTooLow}
                        onClick={() => handleScreenOffChange(p.sec)}
                        title={isPresetTooLow ? `Must exceed idle timer (${idleTimeoutSec}s)` : undefined}
                        className={`px-1.5 py-0.5 text-[10px] font-mono rounded transition-all cursor-pointer border ${
                          isPresetTooLow || disabled
                            ? 'opacity-30 bg-[#141720] text-[#475569] border-transparent cursor-not-allowed'
                            : screenOffTimeoutSec === p.sec
                            ? 'bg-[#fbbf24]/20 text-[#fbbf24] border-[#fbbf24]/40 font-semibold'
                            : 'bg-[#141720] text-[#64748b] border-transparent hover:text-white hover:bg-white/5'
                        }`}
                      >
                        {p.label.split(' ')[0]}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-2.5 pt-2 border-t border-white/5 text-[10px] text-[#64748b] flex justify-between">
            <span>Total Inactivity to Off</span>
            <span className="font-mono text-[#fbbf24]">
              {screenOffTimeoutSec}s
              {idleScreensEnabled && (
                <span className="text-[#94a3b8] text-[9px] ml-1">
                  {`(${idleWindowSec}s screensaver)`}
                </span>
              )}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export const BlockSettingsSection: React.FC<BlockSettingsSectionProps> = ({
  isOpen,
  onClose,
  screenDimensions,
  onScreenDimensionsChange,
  idleScreensEnabled = true,
  onIdleScreensEnabledChange,
  idleTimeoutSec = 30,
  onIdleTimeoutSecChange,
  screenOffTimeoutSec = 60,
  onScreenOffTimeoutSecChange,
  symmetricSettings = true,
  onSymmetricSettingsChange,
  rightScreenDimensions,
  onRightScreenDimensionsChange,
  rightIdleScreensEnabled,
  onRightIdleScreensEnabledChange,
  rightIdleTimeoutSec,
  onRightIdleTimeoutSecChange,
  rightScreenOffTimeoutSec,
  onRightScreenOffTimeoutSecChange,
  className = '',
}) => {
  // Listen for Escape key to close settings drawer
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Local fallback for symmetric toggle
  const [localSymmetric, setLocalSymmetric] = useState(true);
  const effectiveSymmetric = symmetricSettings !== undefined ? symmetricSettings : localSymmetric;

  const handleToggleSymmetric = () => {
    const next = !effectiveSymmetric;
    if (onSymmetricSettingsChange) {
      onSymmetricSettingsChange(next);
    } else {
      setLocalSymmetric(next);
    }
    // When toggling symmetric back ON, synchronize right side with left side
    if (next) {
      if (onRightScreenDimensionsChange) onRightScreenDimensionsChange(screenDimensions);
      if (onRightIdleScreensEnabledChange) onRightIdleScreensEnabledChange(idleScreensEnabled);
      if (onRightIdleTimeoutSecChange) onRightIdleTimeoutSecChange(idleTimeoutSec);
      if (onRightScreenOffTimeoutSecChange) onRightScreenOffTimeoutSecChange(screenOffTimeoutSec);
    }
  };

  // Right side values with fallbacks to left side values
  const effectiveRightDimensions = effectiveSymmetric
    ? screenDimensions
    : (rightScreenDimensions ?? screenDimensions);

  const effectiveRightIdleEnabled = effectiveSymmetric
    ? idleScreensEnabled
    : (rightIdleScreensEnabled !== undefined ? rightIdleScreensEnabled : idleScreensEnabled);

  const effectiveRightIdleTimeout = effectiveSymmetric
    ? idleTimeoutSec
    : (rightIdleTimeoutSec !== undefined ? rightIdleTimeoutSec : idleTimeoutSec);

  const effectiveRightScreenOffTimeout = effectiveSymmetric
    ? screenOffTimeoutSec
    : (rightScreenOffTimeoutSec !== undefined ? rightScreenOffTimeoutSec : screenOffTimeoutSec);

  // Left/Unified change handlers
  const handleLeftDimensionsChange = (dims: { width: number; height: number }) => {
    onScreenDimensionsChange(dims);
    if (effectiveSymmetric && onRightScreenDimensionsChange) {
      onRightScreenDimensionsChange(dims);
    }
  };

  const handleLeftIdleEnabledChange = (enabled: boolean) => {
    if (onIdleScreensEnabledChange) onIdleScreensEnabledChange(enabled);
    if (effectiveSymmetric && onRightIdleScreensEnabledChange) {
      onRightIdleScreensEnabledChange(enabled);
    }
  };

  const handleLeftIdleTimeoutChange = (sec: number) => {
    if (onIdleTimeoutSecChange) onIdleTimeoutSecChange(sec);
    if (effectiveSymmetric && onRightIdleTimeoutSecChange) {
      onRightIdleTimeoutSecChange(sec);
    }
  };

  const handleLeftScreenOffTimeoutChange = (sec: number) => {
    if (onScreenOffTimeoutSecChange) onScreenOffTimeoutSecChange(sec);
    if (effectiveSymmetric && onRightScreenOffTimeoutSecChange) {
      onRightScreenOffTimeoutSecChange(sec);
    }
  };

  return (
    <div
      className={`blocks-settings-drawer-wrapper ${isOpen ? 'open' : ''} ${className}`}
      aria-hidden={!isOpen}
      role="region"
      aria-label="Display & Power Settings"
    >
      <div className="blocks-settings-drawer-inner">
        <div className="blocks-settings-panel">
          {/* Header Row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 mb-3 border-b border-white/10 gap-2.5">
            <div className="flex items-center gap-2.5">
              <div className="size-6 rounded-lg bg-[#00f0ff]/15 border border-[#00f0ff]/30 text-[#00f0ff] flex items-center justify-center shadow-[0_0_10px_rgba(0,240,255,0.2)] shrink-0">
                <Settings size={14} />
              </div>
              <div>
                <h3 className="text-xs font-semibold text-white tracking-wide flex items-center gap-2">
                  <span>Display & Power Settings</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#00f0ff]/10 text-[#00f0ff] border border-[#00f0ff]/20">
                    Firmware Sync
                  </span>
                </h3>
                <p className="text-[11px] text-[#94a3b8] leading-tight">
                  Configure OLED screen geometry, idle screensaver toggle, and inactivity sleep timers.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3 self-end sm:self-center">
              {/* Symmetric Settings Toggle */}
              <div
                className="flex items-center gap-2 bg-[#0b0d13] border border-[#1e2538] hover:border-[#00f0ff]/40 px-2.5 py-1.5 rounded-xl transition-all cursor-pointer select-none"
                onClick={handleToggleSymmetric}
              >
                <div className="flex items-center gap-1.5">
                  <SlidersHorizontal size={13} className={effectiveSymmetric ? 'text-[#00f0ff]' : 'text-[#64748b]'} />
                  <span className="text-xs font-medium text-white">Symmetric Settings</span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={effectiveSymmetric}
                  aria-label="Symmetric Settings"
                  onClick={e => {
                    e.stopPropagation();
                    handleToggleSymmetric();
                  }}
                  className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer shrink-0 ${
                    effectiveSymmetric ? 'bg-[#00f0ff] shadow-[0_0_8px_rgba(0,240,255,0.4)]' : 'bg-[#232936]'
                  }`}
                  title={
                    effectiveSymmetric
                      ? 'Symmetric settings enabled: both halves share display and power parameters'
                      : 'Asymmetric settings enabled: independent display and power blocks per half'
                  }
                >
                  <div
                    className={`size-4 rounded-full bg-[#0b0d13] transition-transform ${
                      effectiveSymmetric ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              <button
                onClick={onClose}
                className="text-[#94a3b8] hover:text-white hover:bg-white/5 transition-all p-1 rounded-md cursor-pointer flex items-center gap-1 text-xs"
                title="Close Settings (Esc)"
              >
                <span className="text-[11px] font-mono hidden sm:inline">Close</span>
                <X size={15} />
              </button>
            </div>
          </div>

          {/* Settings Section: Unified (Symmetric) OR Split (Asymmetric Left + Right) */}
          {effectiveSymmetric ? (
            <SideSettingsBlock
              sideName="Unified"
              themeColor="cyan"
              screenDimensions={screenDimensions}
              onScreenDimensionsChange={handleLeftDimensionsChange}
              idleScreensEnabled={idleScreensEnabled}
              onIdleScreensEnabledChange={handleLeftIdleEnabledChange}
              idleTimeoutSec={idleTimeoutSec}
              onIdleTimeoutSecChange={handleLeftIdleTimeoutChange}
              screenOffTimeoutSec={screenOffTimeoutSec}
              onScreenOffTimeoutSecChange={handleLeftScreenOffTimeoutChange}
            />
          ) : (
            <div className="space-y-4">
              {/* Block 1: Left Half Display & Power Settings */}
              <SideSettingsBlock
                title="Left Half Display & Power Settings"
                badge="Left Half (Master)"
                sideName="Left Half"
                themeColor="cyan"
                screenDimensions={screenDimensions}
                onScreenDimensionsChange={handleLeftDimensionsChange}
                idleScreensEnabled={idleScreensEnabled}
                onIdleScreensEnabledChange={handleLeftIdleEnabledChange}
                idleTimeoutSec={idleTimeoutSec}
                onIdleTimeoutSecChange={handleLeftIdleTimeoutChange}
                screenOffTimeoutSec={screenOffTimeoutSec}
                onScreenOffTimeoutSecChange={handleLeftScreenOffTimeoutChange}
              />

              {/* Block 2: Right Half Display & Power Settings */}
              <SideSettingsBlock
                title="Right Half Display & Power Settings"
                badge="Right Half (Peripheral)"
                sideName="Right Half"
                themeColor="purple"
                screenDimensions={effectiveRightDimensions}
                onScreenDimensionsChange={onRightScreenDimensionsChange || (() => {})}
                idleScreensEnabled={effectiveRightIdleEnabled}
                onIdleScreensEnabledChange={onRightIdleScreensEnabledChange || (() => {})}
                idleTimeoutSec={effectiveRightIdleTimeout}
                onIdleTimeoutSecChange={onRightIdleTimeoutSecChange || (() => {})}
                screenOffTimeoutSec={effectiveRightScreenOffTimeout}
                onScreenOffTimeoutSecChange={onRightScreenOffTimeoutSecChange || (() => {})}
              />
            </div>
          )}

          {/* Timeline Visualizer Footer */}
          <div className="mt-3.5 pt-2.5 border-t border-white/10 space-y-2 text-[11px] text-[#94a3b8]">
            {effectiveSymmetric ? (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
                <div className="flex items-center gap-2 overflow-x-auto max-w-full font-mono text-[10px]">
                  <span className="px-2 py-0.5 rounded bg-[#00f0ff]/15 text-[#00f0ff] border border-[#00f0ff]/30 shrink-0 flex items-center gap-1">
                    <Check size={11} />
                    <span>Active (Typing)</span>
                    <span className="text-[9px] opacity-70">0–{idleScreensEnabled ? idleTimeoutSec : screenOffTimeoutSec}s</span>
                  </span>

                  <span className="text-[#64748b] shrink-0">──▶</span>

                  {idleScreensEnabled && (
                    <>
                      <span className="px-2 py-0.5 rounded bg-[#38bdf8]/15 text-[#38bdf8] border border-[#38bdf8]/30 shrink-0 flex items-center gap-1">
                        <Moon size={11} />
                        <span>Idle Screensaver</span>
                        <span className="text-[9px] opacity-70">{idleTimeoutSec}–{screenOffTimeoutSec}s</span>
                      </span>

                      <span className="text-[#64748b] shrink-0">──▶</span>
                    </>
                  )}

                  <span className="px-2 py-0.5 rounded bg-white/5 text-[#94a3b8] border border-white/10 shrink-0 flex items-center gap-1">
                    <Power size={11} />
                    <span>Display Off (Sleep)</span>
                    <span className="text-[9px] opacity-70">{screenOffTimeoutSec}s+</span>
                  </span>
                </div>

                <div className="text-[10px] text-[#64748b] font-mono shrink-0">
                  {`#define ZMK_DISPLAY_SLEEP_TIMEOUT_MS ${screenOffTimeoutSec * 1000}`}
                </div>
              </div>
            ) : (
              <div className="space-y-1.5">
                {/* Left Timeline */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
                  <div className="flex items-center gap-2 overflow-x-auto max-w-full font-mono text-[10px]">
                    <span className="text-[10px] font-mono text-[#00f0ff] font-bold shrink-0">Left Half:</span>
                    <span className="px-1.5 py-0.5 rounded bg-[#00f0ff]/15 text-[#00f0ff] border border-[#00f0ff]/30 shrink-0 text-[9px]">
                      Active: 0–{idleScreensEnabled ? idleTimeoutSec : screenOffTimeoutSec}s
                    </span>
                    {idleScreensEnabled && (
                      <span className="px-1.5 py-0.5 rounded bg-[#38bdf8]/15 text-[#38bdf8] border border-[#38bdf8]/30 shrink-0 text-[9px]">
                        Idle: {idleTimeoutSec}–{screenOffTimeoutSec}s
                      </span>
                    )}
                    <span className="px-1.5 py-0.5 rounded bg-white/5 text-[#94a3b8] border border-white/10 shrink-0 text-[9px]">
                      Off: {screenOffTimeoutSec}s+
                    </span>
                  </div>
                  <div className="text-[10px] text-[#64748b] font-mono shrink-0">
                    {`#define SCYAN_SLEEP_TIMEOUT_MS ${screenOffTimeoutSec * 1000}`}
                  </div>
                </div>

                {/* Right Timeline */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
                  <div className="flex items-center gap-2 overflow-x-auto max-w-full font-mono text-[10px]">
                    <span className="text-[10px] font-mono text-[#a953f6] font-bold shrink-0">Right Half:</span>
                    <span className="px-1.5 py-0.5 rounded bg-[#a953f6]/15 text-[#a953f6] border border-[#a953f6]/30 shrink-0 text-[9px]">
                      Active: 0–{effectiveRightIdleEnabled ? effectiveRightIdleTimeout : effectiveRightScreenOffTimeout}s
                    </span>
                    {effectiveRightIdleEnabled && (
                      <span className="px-1.5 py-0.5 rounded bg-[#bf84fd]/15 text-[#bf84fd] border border-[#bf84fd]/30 shrink-0 text-[9px]">
                        Idle: {effectiveRightIdleTimeout}–{effectiveRightScreenOffTimeout}s
                      </span>
                    )}
                    <span className="px-1.5 py-0.5 rounded bg-white/5 text-[#94a3b8] border border-white/10 shrink-0 text-[9px]">
                      Off: {effectiveRightScreenOffTimeout}s+
                    </span>
                  </div>
                  <div className="text-[10px] text-[#64748b] font-mono shrink-0">
                    {`#define SCYAN_SLEEP_TIMEOUT_MS_RIGHT ${effectiveRightScreenOffTimeout * 1000}`}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export type ScreenSizePopoverProps = BlockSettingsSectionProps;
export const ScreenSizePopover = BlockSettingsSection;

export interface SideSettingsPanelProps {
  side: 'left' | 'right' | 'dongle';
  isOpen: boolean;
  onClose: () => void;
  // Master / Left settings
  screenDimensions: { width: number; height: number };
  onScreenDimensionsChange: (dims: { width: number; height: number }) => void;
  idleScreensEnabled?: boolean;
  onIdleScreensEnabledChange?: (enabled: boolean) => void;
  idleTimeoutSec?: number;
  onIdleTimeoutSecChange?: (sec: number) => void;
  screenOffTimeoutSec?: number;
  onScreenOffTimeoutSecChange?: (sec: number) => void;

  // Symmetric settings toggle (stays inside the peripheral settings panel)
  symmetricSettings?: boolean;
  onSymmetricSettingsChange?: (symmetric: boolean) => void;

  // Right-specific settings (used when side === 'right' and symmetricSettings === false)
  rightScreenDimensions?: { width: number; height: number };
  onRightScreenDimensionsChange?: (dims: { width: number; height: number }) => void;
  rightIdleScreensEnabled?: boolean;
  onRightIdleScreensEnabledChange?: (enabled: boolean) => void;
  rightIdleTimeoutSec?: number;
  onRightIdleTimeoutSecChange?: (sec: number) => void;
  rightScreenOffTimeoutSec?: number;
  onRightScreenOffTimeoutSecChange?: (sec: number) => void;

  className?: string;
}

export const SideSettingsPanel: React.FC<SideSettingsPanelProps> = ({
  side,
  isOpen,
  onClose,
  screenDimensions,
  onScreenDimensionsChange,
  idleScreensEnabled = true,
  onIdleScreensEnabledChange,
  idleTimeoutSec = 30,
  onIdleTimeoutSecChange,
  screenOffTimeoutSec = 60,
  onScreenOffTimeoutSecChange,
  symmetricSettings = true,
  onSymmetricSettingsChange,
  rightScreenDimensions,
  onRightScreenDimensionsChange,
  rightIdleScreensEnabled,
  onRightIdleScreensEnabledChange,
  rightIdleTimeoutSec,
  onRightIdleTimeoutSecChange,
  rightScreenOffTimeoutSec,
  onRightScreenOffTimeoutSecChange,
  className = '',
}) => {
  // Listen for Escape key to close settings panel
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Local fallback for symmetric toggle
  const [localSymmetric, setLocalSymmetric] = useState(true);
  const effectiveSymmetric = symmetricSettings !== undefined ? symmetricSettings : localSymmetric;

  const handleToggleSymmetric = () => {
    const next = !effectiveSymmetric;
    if (onSymmetricSettingsChange) {
      onSymmetricSettingsChange(next);
    } else {
      setLocalSymmetric(next);
    }
    // When toggling symmetric back ON, synchronize right side with left side
    if (next) {
      if (onRightScreenDimensionsChange) onRightScreenDimensionsChange(screenDimensions);
      if (onRightIdleScreensEnabledChange) onRightIdleScreensEnabledChange(idleScreensEnabled);
      if (onRightIdleTimeoutSecChange) onRightIdleTimeoutSecChange(idleTimeoutSec);
      if (onRightScreenOffTimeoutSecChange) onRightScreenOffTimeoutSecChange(screenOffTimeoutSec);
    }
  };

  // Right side values with fallbacks to left side values
  const effectiveRightDimensions = effectiveSymmetric
    ? screenDimensions
    : (rightScreenDimensions ?? screenDimensions);

  const effectiveRightIdleEnabled = effectiveSymmetric
    ? idleScreensEnabled
    : (rightIdleScreensEnabled !== undefined ? rightIdleScreensEnabled : idleScreensEnabled);

  const effectiveRightIdleTimeout = effectiveSymmetric
    ? idleTimeoutSec
    : (rightIdleTimeoutSec !== undefined ? rightIdleTimeoutSec : idleTimeoutSec);

  const effectiveRightScreenOffTimeout = effectiveSymmetric
    ? screenOffTimeoutSec
    : (rightScreenOffTimeoutSec !== undefined ? rightScreenOffTimeoutSec : screenOffTimeoutSec);

  // Left/Unified change handlers
  const handleLeftDimensionsChange = (dims: { width: number; height: number }) => {
    onScreenDimensionsChange(dims);
    if (effectiveSymmetric && onRightScreenDimensionsChange) {
      onRightScreenDimensionsChange(dims);
    }
  };

  const handleLeftIdleEnabledChange = (enabled: boolean) => {
    if (onIdleScreensEnabledChange) onIdleScreensEnabledChange(enabled);
    if (effectiveSymmetric && onRightIdleScreensEnabledChange) {
      onRightIdleScreensEnabledChange(enabled);
    }
  };

  const handleLeftIdleTimeoutChange = (sec: number) => {
    if (onIdleTimeoutSecChange) onIdleTimeoutSecChange(sec);
    if (effectiveSymmetric && onRightIdleTimeoutSecChange) {
      onRightIdleTimeoutSecChange(sec);
    }
  };

  const handleLeftScreenOffTimeoutChange = (sec: number) => {
    if (onScreenOffTimeoutSecChange) onScreenOffTimeoutSecChange(sec);
    if (effectiveSymmetric && onRightScreenOffTimeoutSecChange) {
      onRightScreenOffTimeoutSecChange(sec);
    }
  };

  const isLeft = side === 'left';
  const isDongle = side === 'dongle';

  return (
    <aside
      className={`side-settings-panel-container side-${side} ${isOpen ? 'open' : ''} ${className}`}
      aria-hidden={!isOpen}
      role="region"
      aria-label={`${isDongle ? 'Dongle Master' : isLeft ? 'Left Active (Master)' : 'Right Active (Peripheral)'} Display & Power Settings`}
    >
      <div className="side-settings-panel-inner">
        {/* Header */}
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2">
            <div
              className={`size-6 rounded-lg flex items-center justify-center shrink-0 border ${
                isDongle
                  ? 'bg-[#f59e0b]/15 border-[#f59e0b]/30 text-[#f59e0b] shadow-[0_0_8px_rgba(245,158,11,0.2)]'
                  : isLeft
                  ? 'bg-[#00f0ff]/15 border-[#00f0ff]/30 text-[#00f0ff] shadow-[0_0_8px_rgba(0,240,255,0.2)]'
                  : 'bg-[#a953f6]/15 border-[#a953f6]/30 text-[#a953f6] shadow-[0_0_8px_rgba(169,83,246,0.2)]'
              }`}
            >
              <Settings size={13} />
            </div>
            <div>
              <div className="text-xs font-semibold text-white flex items-center gap-1.5">
                <span>{isDongle ? 'Dongle Settings' : isLeft ? 'Master Settings' : 'Peripheral Settings'}</span>
                <span
                  className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${
                    isDongle
                      ? 'bg-[#f59e0b]/10 text-[#f59e0b] border-[#f59e0b]/20'
                      : isLeft
                      ? 'bg-[#00f0ff]/10 text-[#00f0ff] border-[#00f0ff]/20'
                      : 'bg-[#a953f6]/10 text-[#a953f6] border-[#a953f6]/20'
                  }`}
                >
                  {isDongle ? 'Dongle Master' : isLeft ? 'Left Half' : 'Right Half'}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-[#94a3b8] hover:text-white hover:bg-white/5 transition-all p-1 rounded-md cursor-pointer flex items-center gap-1 text-xs"
            title="Close Settings (Esc)"
            aria-label={`Close ${isDongle ? 'Dongle' : isLeft ? 'Master' : 'Peripheral'} Settings`}
          >
            <X size={14} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="side-settings-panel-body custom-scrollbar">
          {isDongle ? (
            <>
              <SideSettingsBlock
                sideName="Dongle Master"
                themeColor="amber"
                screenDimensions={screenDimensions}
                onScreenDimensionsChange={onScreenDimensionsChange}
                idleScreensEnabled={idleScreensEnabled}
                onIdleScreensEnabledChange={onIdleScreensEnabledChange ?? (() => {})}
                idleTimeoutSec={idleTimeoutSec}
                onIdleTimeoutSecChange={onIdleTimeoutSecChange ?? (() => {})}
                screenOffTimeoutSec={screenOffTimeoutSec}
                onScreenOffTimeoutSecChange={onScreenOffTimeoutSecChange ?? (() => {})}
                layout="vertical"
              />
              <div className="pt-2 border-t border-white/10 text-[10px] text-[#64748b] font-mono shrink-0">
                {`#define SCYAN_SLEEP_TIMEOUT_MS_DONGLE ${screenOffTimeoutSec * 1000}`}
              </div>
            </>
          ) : isLeft ? (
            <>
              {effectiveSymmetric && (
                <div className="p-2 rounded-lg bg-[#00f0ff]/10 border border-[#00f0ff]/20 text-[11px] text-[#e2f1ff] flex items-center gap-1.5 shrink-0">
                  <Check size={12} className="text-[#00f0ff] shrink-0" />
                  <span className="text-[10px] text-[#94a3b8]">
                    <strong className="text-[#00f0ff] font-medium">Symmetric Mode:</strong> Controls both Master &amp; Peripheral.
                  </span>
                </div>
              )}

              <SideSettingsBlock
                sideName="Left Half"
                themeColor="cyan"
                screenDimensions={screenDimensions}
                onScreenDimensionsChange={handleLeftDimensionsChange}
                idleScreensEnabled={idleScreensEnabled}
                onIdleScreensEnabledChange={handleLeftIdleEnabledChange}
                idleTimeoutSec={idleTimeoutSec}
                onIdleTimeoutSecChange={handleLeftIdleTimeoutChange}
                screenOffTimeoutSec={screenOffTimeoutSec}
                onScreenOffTimeoutSecChange={handleLeftScreenOffTimeoutChange}
                layout="vertical"
              />

              <div className="pt-2 border-t border-white/10 text-[10px] text-[#64748b] font-mono shrink-0">
                {`#define SCYAN_SLEEP_TIMEOUT_MS ${screenOffTimeoutSec * 1000}`}
              </div>
            </>
          ) : (
            <>
              {/* Symmetric Settings Toggle Card inside Peripheral Settings */}
              <div className="bg-[#0e1118] border border-[#1e2538] rounded-xl p-3 space-y-2 shrink-0">
                <div
                  className="flex items-center justify-between cursor-pointer select-none"
                  onClick={handleToggleSymmetric}
                >
                  <div className="flex items-center gap-2">
                    <SlidersHorizontal size={14} className={effectiveSymmetric ? 'text-[#00f0ff]' : 'text-[#a953f6]'} />
                    <div>
                      <div className="text-xs font-semibold text-white">Symmetric Settings</div>
                      <div className="text-[10px] text-[#64748b]">Mirror Master display &amp; power</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={effectiveSymmetric}
                    aria-label="Symmetric Settings"
                    onClick={e => {
                      e.stopPropagation();
                      handleToggleSymmetric();
                    }}
                    className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer shrink-0 ${
                      effectiveSymmetric ? 'bg-[#00f0ff] shadow-[0_0_8px_rgba(0,240,255,0.4)]' : 'bg-[#232936]'
                    }`}
                    title={
                      effectiveSymmetric
                        ? 'Symmetric settings enabled: both halves share display and power parameters'
                        : 'Asymmetric settings enabled: independent display and power parameters per half'
                    }
                  >
                    <div
                      className={`size-4 rounded-full bg-[#0b0d13] transition-transform ${
                        effectiveSymmetric ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {effectiveSymmetric ? (
                  <div className="p-2 rounded-lg bg-[#00f0ff]/10 border border-[#00f0ff]/20 text-[11px] text-[#e2f1ff] flex items-start gap-2">
                    <Check size={13} className="text-[#00f0ff] shrink-0 mt-0.5" />
                    <div className="text-[10px] text-[#94a3b8] leading-tight">
                      <strong className="text-white font-medium block">Mirroring Left Half (Master)</strong>
                      Peripheral settings are visually locked. Turn off symmetric settings to edit independently.
                    </div>
                  </div>
                ) : (
                  <div className="p-1.5 rounded-lg bg-[#a953f6]/10 border border-[#a953f6]/20 text-[10px] text-[#bf84fd] flex items-center gap-1.5 font-mono">
                    <span className="size-1.5 rounded-full bg-[#a953f6]" />
                    <span>Independent Peripheral Settings</span>
                  </div>
                )}
              </div>

              {/* Peripheral Controls: Visually disabled when symmetric is enabled */}
              <div
                className={`space-y-3 transition-opacity duration-200 ${
                  effectiveSymmetric ? 'opacity-40 pointer-events-none select-none' : ''
                }`}
              >
                <SideSettingsBlock
                  sideName="Right Half"
                  themeColor="purple"
                  screenDimensions={effectiveRightDimensions}
                  onScreenDimensionsChange={effectiveSymmetric ? () => {} : (onRightScreenDimensionsChange || (() => {}))}
                  idleScreensEnabled={effectiveRightIdleEnabled}
                  onIdleScreensEnabledChange={effectiveSymmetric ? () => {} : (onRightIdleScreensEnabledChange || (() => {}))}
                  idleTimeoutSec={effectiveRightIdleTimeout}
                  onIdleTimeoutSecChange={effectiveSymmetric ? () => {} : (onRightIdleTimeoutSecChange || (() => {}))}
                  screenOffTimeoutSec={effectiveRightScreenOffTimeout}
                  onScreenOffTimeoutSecChange={effectiveSymmetric ? () => {} : (onRightScreenOffTimeoutSecChange || (() => {}))}
                  disabled={effectiveSymmetric}
                  layout="vertical"
                />

                <div className="pt-2 border-t border-white/10 text-[10px] text-[#64748b] font-mono shrink-0">
                  {effectiveSymmetric
                    ? `#define SCYAN_SLEEP_TIMEOUT_MS ${screenOffTimeoutSec * 1000}`
                    : `#define SCYAN_SLEEP_TIMEOUT_MS_RIGHT ${effectiveRightScreenOffTimeout * 1000}`}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </aside>
  );
};

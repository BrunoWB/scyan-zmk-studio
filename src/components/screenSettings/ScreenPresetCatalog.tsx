/* oxlint-disable react/only-export-components */
import React from 'react';

export const PRESET_SCREEN_SIZES = [
  { label: '128 × 32 (0.91" OLED)', width: 128, height: 32 },
  { label: '128 × 64 (0.96" OLED)', width: 128, height: 64 },
  { label: '160 × 68 (nice!view)', width: 160, height: 68 },
  { label: 'Custom', width: 0, height: 0 },
];

export const ROTATION_OPTIONS: { value: 0 | 90 | 180 | 270; label: string; tooltip: string }[] = [
  { value: 0, label: '0°', tooltip: 'Horizontal / Normal (0°)' },
  { value: 90, label: '90°', tooltip: 'Vertical / Clockwise (90°)' },
  { value: 180, label: '180°', tooltip: 'Inverted Horizontal (180°)' },
  { value: 270, label: '270°', tooltip: 'Inverted Vertical (270°)' },
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

export interface ScreenPresetSelectorProps {
  isCustomMode: boolean;
  matchedPreset?: { width: number; height: number; label: string };
  onPresetSelect: (val: string) => void;
  disabled?: boolean;
  themeColor?: 'cyan' | 'purple' | 'amber';
}

export const ScreenPresetSelector: React.FC<ScreenPresetSelectorProps> = ({
  isCustomMode,
  matchedPreset,
  onPresetSelect,
  disabled = false,
  themeColor = 'cyan',
}) => {
  const isPurple = themeColor === 'purple';

  return (
    <div>
      <label className="text-[10px] font-mono uppercase text-[#64748b] block mb-1">
        Preset Resolution
      </label>
      <select
        value={isCustomMode ? 'custom' : (matchedPreset ? `${matchedPreset.width}x${matchedPreset.height}` : 'custom')}
        onChange={e => onPresetSelect(e.target.value)}
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
  );
};

export interface ScreenRotationSelectorProps {
  sideName: string;
  effectiveRotation: 0 | 90 | 180 | 270;
  onRotationSelect: (rot: 0 | 90 | 180 | 270) => void;
  radioGroupId: string;
  disabled?: boolean;
  themeColor?: 'cyan' | 'purple' | 'amber';
}

export const ScreenRotationSelector: React.FC<ScreenRotationSelectorProps> = ({
  sideName,
  effectiveRotation,
  onRotationSelect,
  radioGroupId,
  disabled = false,
  themeColor = 'cyan',
}) => {
  const isPurple = themeColor === 'purple';

  return (
    <div>
      <label className="text-[10px] font-mono uppercase text-[#64748b] block mb-1">
        Screen Rotation
      </label>
      <div
        role="radiogroup"
        aria-label={`${sideName} Screen Rotation`}
        className="grid grid-cols-4 gap-1 p-1 bg-[#141720] border border-[#232936] rounded-lg"
      >
        {ROTATION_OPTIONS.map(opt => {
          const isSelected = effectiveRotation === opt.value;
          return (
            <label
              key={opt.value}
              title={opt.tooltip}
              className={`flex items-center justify-center gap-1 py-1 px-1 rounded cursor-pointer transition-all text-xs font-mono select-none ${
                disabled ? 'opacity-40 cursor-not-allowed' : ''
              } ${
                isSelected
                  ? isPurple
                    ? 'bg-[#a953f6]/20 text-[#a953f6] border border-[#a953f6]/40 font-bold shadow-[0_0_8px_rgba(169,83,246,0.2)]'
                    : 'bg-[#00f0ff]/20 text-[#00f0ff] border border-[#00f0ff]/40 font-bold shadow-[0_0_8px_rgba(0,240,255,0.2)]'
                  : 'text-[#94a3b8] hover:text-white hover:bg-white/5 border border-transparent'
              }`}
            >
              <input
                type="radio"
                name={`rotation-${radioGroupId}`}
                value={opt.value}
                checked={isSelected}
                disabled={disabled}
                onChange={() => onRotationSelect(opt.value)}
                aria-label={`${sideName} Rotation ${opt.label}`}
                className="sr-only"
              />
              <span
                className={`size-2 rounded-full border transition-colors shrink-0 ${
                  isSelected
                    ? isPurple
                      ? 'bg-[#a953f6] border-[#a953f6]'
                      : 'bg-[#00f0ff] border-[#00f0ff]'
                    : 'border-[#64748b] bg-transparent'
                }`}
              />
              <span>{opt.label}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
};

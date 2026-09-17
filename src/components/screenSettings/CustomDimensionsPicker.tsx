/* oxlint-disable react/only-export-components */
import React, { useState } from 'react';
import { Plus, Minus } from 'lucide-react';

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
  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    if (!isFocused) {
      setLocalStr(String(value));
    }
  }

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

export function calculateAspectRatio(w: number, h: number): string {
  if (w <= 0 || h <= 0) return '1:1';
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const divisor = gcd(w, h);
  return `${w / divisor}:${h / divisor}`;
}

export interface CustomDimensionsPickerProps {
  width: number;
  height: number;
  onWidthChange: (w: number) => void;
  onHeightChange: (h: number) => void;
  sideName: string;
  themeColor?: 'cyan' | 'purple' | 'amber';
  disabled?: boolean;
}

export const CustomDimensionsPicker: React.FC<CustomDimensionsPickerProps> = ({
  width,
  height,
  onWidthChange,
  onHeightChange,
  sideName,
  themeColor = 'cyan',
  disabled = false,
}) => {
  const ratio = calculateAspectRatio(width, height);

  return (
    <div>
      <div className="text-[10px] font-mono uppercase text-[#64748b] mb-1 flex items-center justify-between">
        <span>Dimensions Pair [W, H]</span>
        <span className="text-[9px] text-[#475569]">Aspect {ratio}</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <StepperControl
          label="W"
          value={width}
          onChange={onWidthChange}
          min={16}
          max={256}
          step={2}
          disabled={disabled}
          accentColor={themeColor}
          ariaLabel={`${sideName} Width`}
        />
        <StepperControl
          label="H"
          value={height}
          onChange={onHeightChange}
          min={16}
          max={256}
          step={2}
          disabled={disabled}
          accentColor={themeColor}
          ariaLabel={`${sideName} Height`}
        />
      </div>
    </div>
  );
};

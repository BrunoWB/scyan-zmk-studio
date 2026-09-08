import React, { useEffect, useRef } from 'react';
import { Settings, X } from 'lucide-react';

export const PRESET_SCREEN_SIZES = [
  { label: '32 × 128 (Corne / OLED Standard)', width: 32, height: 128 },
  { label: '68 × 160 (nice!view)', width: 68, height: 160 },
  { label: '128 × 64 (OLED Standard)', width: 128, height: 64 },
  { label: '128 × 32 (Horizontal OLED)', width: 128, height: 32 },
  { label: 'Custom', width: 0, height: 0 },
];

export interface ScreenSizePopoverProps {
  screenDimensions: { width: number; height: number };
  onScreenDimensionsChange: (dims: { width: number; height: number }) => void;
  onClose: () => void;
  className?: string;
}

export const ScreenSizePopover: React.FC<ScreenSizePopoverProps> = ({
  screenDimensions,
  onScreenDimensionsChange,
  onClose,
  className = '',
}) => {
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close on Escape or click outside
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  const matchedPreset = PRESET_SCREEN_SIZES.find(
    p => p.width === screenDimensions.width && p.height === screenDimensions.height
  );

  return (
    <div ref={popoverRef} className={`screen-size-popover ${className}`}>
      <div className="screen-size-popover-header">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
          <Settings size={13} className="text-accent" />
          <span>Screen Dimensions</span>
        </div>
        <button
          onClick={onClose}
          className="text-muted hover:text-foreground transition-colors p-0.5 rounded cursor-pointer"
          title="Close"
        >
          <X size={14} />
        </button>
      </div>

      <div className="screen-size-popover-body">
        <div className="screen-size-field">
          <label className="text-[11px] font-medium text-muted mb-1 block">Preset</label>
          <select
            value={matchedPreset ? `${matchedPreset.width}x${matchedPreset.height}` : 'custom'}
            onChange={e => {
              const val = e.target.value;
              if (val === 'custom') return;
              const [w, h] = val.split('x').map(Number);
              onScreenDimensionsChange({ width: w, height: h });
            }}
            className="select-dark text-xs w-full"
          >
            {PRESET_SCREEN_SIZES.map(p => (
              <option key={p.label} value={p.width > 0 ? `${p.width}x${p.height}` : 'custom'}>
                {p.label}
              </option>
            ))}
          </select>
        </div>

        <div className="screen-size-dimensions-row mt-3">
          <label className="text-[11px] font-medium text-muted mb-1 block">Custom Size (px)</label>
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center gap-1 bg-surface-dark border border-border/80 rounded px-2 py-1">
              <span className="text-[11px] font-mono text-muted">W:</span>
              <input
                type="number"
                min={16}
                max={256}
                value={screenDimensions.width}
                onChange={e => {
                  const w = Math.max(16, Math.min(256, parseInt(e.target.value) || 32));
                  onScreenDimensionsChange({ width: w, height: screenDimensions.height });
                }}
                className="bg-transparent border-none outline-none text-xs text-foreground font-mono w-full text-right"
              />
              <span className="text-[10px] text-muted font-mono">px</span>
            </div>

            <span className="text-muted text-xs">×</span>

            <div className="flex-1 flex items-center gap-1 bg-surface-dark border border-border/80 rounded px-2 py-1">
              <span className="text-[11px] font-mono text-muted">H:</span>
              <input
                type="number"
                min={16}
                max={256}
                value={screenDimensions.height}
                onChange={e => {
                  const h = Math.max(16, Math.min(256, parseInt(e.target.value) || 128));
                  onScreenDimensionsChange({ width: screenDimensions.width, height: h });
                }}
                className="bg-transparent border-none outline-none text-xs text-foreground font-mono w-full text-right"
              />
              <span className="text-[10px] text-muted font-mono">px</span>
            </div>
          </div>
        </div>

        <div className="mt-3 pt-2 border-t border-border/40 text-[10px] text-muted/70 flex justify-between items-center">
          <span>Active & Idle OLED panels</span>
          <span className="font-mono text-accent">{screenDimensions.width} × {screenDimensions.height}</span>
        </div>
      </div>
    </div>
  );
};


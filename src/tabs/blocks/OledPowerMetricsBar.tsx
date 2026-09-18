import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { NumberField } from '@heroui/react';
import {
  Zap,
  CheckCircle2,
  Activity,
  AlertTriangle,
  Flame,
  Battery,
  Clock,
  Info,
  Cpu,
  X,
} from 'lucide-react';
import type {
  PowerEstimationResult,
  PowerRatingTier,
} from '../../services/powerEstimation';
import {
  formatFillPct,
  formatPixelFill,
  formatCurrent,
  formatRefreshRate,
  formatDurationHours,
  POWER_CONSTANTS,
} from '../../services/powerEstimation';

export interface OledPowerMetricsBarProps {
  estimation: PowerEstimationResult;
  screenKind?: 'active' | 'idle';
  side?: string;
  isCompact?: boolean;
}

const RATING_ICON_MAP: Record<PowerRatingTier, React.ElementType> = {
  ultra: Zap,
  great: CheckCircle2,
  good: Activity,
  moderate: AlertTriangle,
  heavy: Flame,
};

export const OledPowerMetricsBar: React.FC<OledPowerMetricsBarProps> = ({
  estimation,
  screenKind = 'active',
  side: _side = 'left',
  isCompact = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [batteryCapacity, setBatteryCapacity] = useState<number>(
    estimation.batteryCapacityMah || POWER_CONSTANTS.DEFAULT_BATTERY_CAPACITY_MAH
  );
  const [placement, setPlacement] = useState<'above' | 'below'>('above');
  const [coords, setCoords] = useState<{ x: number; y: number } | null>(null);

  const barRef = useRef<HTMLDivElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  const { stats, refreshRateHz, rating, avgTotalMa, minTotalMa, maxTotalMa, currentTotalMa } = estimation;
  const RatingIcon = RATING_ICON_MAP[rating.tier] || Activity;

  // Dynamic life recalculation based on HeroUI NumberField battery capacity
  const activeBatteryCapacity =
    typeof batteryCapacity === 'number' && Number.isFinite(batteryCapacity) && batteryCapacity > 0
      ? batteryCapacity
      : POWER_CONSTANTS.DEFAULT_BATTERY_CAPACITY_MAH;

  const continuousLifeHours = avgTotalMa > 0 ? activeBatteryCapacity / avgTotalMa : 0;
  const effectiveDailyMa =
    POWER_CONSTANTS.TYPICAL_ACTIVE_DUTY_CYCLE * avgTotalMa +
    (1 - POWER_CONSTANTS.TYPICAL_ACTIVE_DUTY_CYCLE) * POWER_CONSTANTS.DEEP_SLEEP_CURRENT_MA;
  const expectedLifeHours = effectiveDailyMa > 0 ? activeBatteryCapacity / effectiveDailyMa : 0;

  // Update popover coordinates and auto-flip placement relative to viewport
  const updatePosition = useCallback(() => {
    if (!barRef.current) return;
    const rect = barRef.current.getBoundingClientRect();
    const windowH = window.innerHeight;
    const windowW = window.innerWidth;

    // Popover height is approx 520px; if space above is less than 440px and space below is greater, flip downward
    const spaceAbove = rect.top;
    const spaceBelow = windowH - rect.bottom;
    const shouldPlaceBelow = spaceAbove < 440 && spaceBelow > spaceAbove;

    setPlacement(shouldPlaceBelow ? 'below' : 'above');
    setCoords({
      x: Math.min(windowW - 170, Math.max(170, rect.left + rect.width / 2)),
      y: shouldPlaceBelow ? Math.min(windowH - 24, rect.bottom + 8) : Math.max(12, rect.top - 8),
    });
  }, []);

  const handleClickBar = (e: React.MouseEvent) => {
    e.stopPropagation();
    updatePosition();
    setIsOpen(prev => !prev);
  };

  // Close when clicking outside popover
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (barRef.current?.contains(target)) return;
      if (popoverRef.current?.contains(target)) return;
      setIsOpen(false);
    };
    window.addEventListener('pointerdown', handleClickOutside);
    return () => window.removeEventListener('pointerdown', handleClickOutside);
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Keep position accurate on scroll/resize
  useEffect(() => {
    if (!isOpen) return;
    const handleScrollOrResize = () => updatePosition();
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);
    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [isOpen, updatePosition]);

  if (isCompact) {
    return null;
  }

  return (
    <>
      {/* Metrics Bar at the bottom of the oled-screen-stage */}
      <div
        ref={barRef}
        data-testid="oled-power-metrics-bar"
        className={`oled-power-metrics-bar flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg bg-[#0e121b]/95 border ${
          isOpen ? 'border-[#00d2ff] ring-1 ring-[#00d2ff]/30' : 'border-[#1e2538] hover:border-[#38bdf8]/40'
        } shadow-sm cursor-pointer select-none transition-all text-[11px] font-mono leading-none z-10`}
        onClick={handleClickBar}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleClickBar(e as unknown as React.MouseEvent);
          }
        }}
        tabIndex={0}
        role="button"
        aria-expanded={isOpen}
        aria-label="OLED Power and Display Metrics. Click to toggle breakdown."
        title="Click to toggle detailed power breakdown"
      >
        {/* Pixel Fill: value and unit "X px%" */}
        <div
          className="flex items-center text-[#38bdf8] font-semibold hover:text-white transition-colors"
          title={`Average Pixel Fill: ${formatFillPct(stats.avgFillPct)} (${stats.avgLitPixels} of ${stats.totalPixels} px)`}
        >
          <span>{formatPixelFill(stats.avgFillPct)}</span>
        </div>

        <span className="text-[#2a3449] font-sans font-light select-none">|</span>

        {/* Refresh Rate: value and unit */}
        <div
          className="flex items-center text-[#cbd5e1] font-semibold hover:text-white transition-colors"
          title={`Display Refresh Rate: ${formatRefreshRate(refreshRateHz)} (${estimation.refreshReason})`}
        >
          <span>{formatRefreshRate(refreshRateHz)}</span>
        </div>

        <span className="text-[#2a3449] font-sans font-light select-none">|</span>

        {/* Rating: icon and badge */}
        <div
          className={`flex items-center gap-1 px-1.5 py-0.5 rounded ${rating.bgColor} ${rating.textColor} font-semibold transition-colors`}
          title={`Efficiency Rating: ${rating.label} (~${formatCurrent(avgTotalMa)})`}
        >
          <RatingIcon size={11} className="shrink-0" />
          <span>{rating.label}</span>
        </div>
      </div>

      {/* Power Breakdown Card Portal */}
      {isOpen && coords && typeof document !== 'undefined' && createPortal(
        <div
          ref={popoverRef}
          data-testid="oled-power-breakdown-popover"
          role="dialog"
          aria-label="OLED Power & Endurance Breakdown"
          className={`fixed z-[99999] w-[320px] max-w-[calc(100vw-32px)] max-h-[calc(100vh-32px)] overflow-y-auto bg-[#0d1017]/95 backdrop-blur-xl border border-[#00d2ff]/60 rounded-xl shadow-[0_16px_40px_rgba(0,0,0,0.85),0_0_20px_rgba(0,210,255,0.06)] p-3.5 text-xs text-[#cbd5e1] animate-in fade-in zoom-in-95 duration-100 select-none`}
          style={{
            top: `${coords.y}px`,
            left: `${coords.x}px`,
            transform: placement === 'below' ? 'translate(-50%, 0)' : 'translate(-50%, -100%)',
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-2 pb-2 border-b border-[#1e2538]">
            <div className="flex items-center gap-1.5">
              <Cpu size={14} className="text-[#00d2ff]" />
              <span className="font-semibold text-white tracking-tight">OLED Power & Endurance</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/5 text-[#94a3b8] border border-white/10">
                {screenKind === 'idle' ? 'Idle Screen' : 'Active Screen'}
              </span>
              <button
                type="button"
                className="p-1 rounded hover:bg-white/10 text-[#64748b] hover:text-white transition-colors cursor-pointer"
                onClick={() => setIsOpen(false)}
                title="Close breakdown"
                aria-label="Close breakdown"
              >
                <X size={13} />
              </button>
            </div>
          </div>

          {/* Rating Summary Banner */}
          <div className={`mt-2.5 p-2 rounded-lg ${rating.bgColor} border ${rating.borderColor} flex items-center justify-between gap-2`}>
            <div className="flex items-center gap-2">
              <div className={`size-6 rounded-full flex items-center justify-center ${rating.bgColor} ${rating.textColor} border ${rating.borderColor}`}>
                <RatingIcon size={13} />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className={`font-bold text-xs ${rating.textColor}`}>{rating.label} Rating</span>
                  <span className="text-[10px] font-mono text-[#94a3b8]">({formatCurrent(avgTotalMa)})</span>
                </div>
                <div className="text-[10px] text-[#94a3b8] leading-tight mt-0.5">
                  {rating.description}
                </div>
              </div>
            </div>
          </div>

          {/* Pixel Fill Matrix (min, max, current, avg) */}
          <div className="mt-3 bg-[#121622]/70 rounded-lg p-2.5 border border-[#1b2234]">
            <div className="flex items-center justify-between text-[11px] mb-1.5">
              <span className="text-[#94a3b8] font-medium">Pixel Fill Breakdown</span>
              <span className="font-mono text-[#38bdf8] font-semibold">{formatFillPct(stats.avgFillPct)} avg</span>
            </div>

            {/* Visual Fill Bar */}
            <div className="w-full h-1.5 rounded-full bg-[#1b2234] overflow-hidden mb-2">
              <div
                className="h-full bg-gradient-to-r from-[#00d2ff] to-[#a953f6] rounded-full transition-all duration-300"
                style={{ width: `${Math.min(100, Math.max(2, stats.avgFillPct))}%` }}
              />
            </div>

            {/* Min / Max / Current / Avg Grid */}
            <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
              <div className="bg-[#0b0e14] px-2 py-1 rounded border border-[#182030]">
                <div className="text-[#64748b] text-[9px] uppercase">Current</div>
                <div className="text-white font-semibold mt-0.5">
                  {formatFillPct(stats.currentFillPct)} <span className="text-[#64748b]">({stats.currentLitPixels}px)</span>
                </div>
              </div>
              <div className="bg-[#0b0e14] px-2 py-1 rounded border border-[#182030]">
                <div className="text-[#64748b] text-[9px] uppercase">Average</div>
                <div className="text-[#38bdf8] font-semibold mt-0.5">
                  {formatFillPct(stats.avgFillPct)} <span className="text-[#64748b]">({stats.avgLitPixels}px)</span>
                </div>
              </div>
              <div className="bg-[#0b0e14] px-2 py-1 rounded border border-[#182030]">
                <div className="text-[#64748b] text-[9px] uppercase">Min Fill</div>
                <div className="text-[#4ade80] font-semibold mt-0.5">
                  {formatFillPct(stats.minFillPct)} <span className="text-[#64748b]">({stats.minLitPixels}px)</span>
                </div>
              </div>
              <div className="bg-[#0b0e14] px-2 py-1 rounded border border-[#182030]">
                <div className="text-[#64748b] text-[9px] uppercase">Max Fill</div>
                <div className="text-[#fb923c] font-semibold mt-0.5">
                  {formatFillPct(stats.maxFillPct)} <span className="text-[#64748b]">({stats.maxLitPixels}px)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Current & Power Breakdown */}
          <div className="mt-2.5 space-y-1 text-[11px] font-mono bg-[#121622]/70 rounded-lg p-2.5 border border-[#1b2234]">
            <div className="flex items-center justify-between text-[#94a3b8] text-[10px] pb-1 border-b border-[#1b2234]">
              <span>Current Draw Components</span>
              <span>Rate</span>
            </div>

            <div className="flex items-center justify-between pt-0.5">
              <span className="text-[#94a3b8]">SSD1306 + MCU Baseline:</span>
              <span className="text-white font-medium">{formatCurrent(estimation.baselineCurrentMa)}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[#94a3b8]">Screen Refresh ({formatRefreshRate(refreshRateHz)}):</span>
              <span className="text-white font-medium">+{formatCurrent(estimation.refreshCurrentMa)}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[#94a3b8]">OLED Diodes ({stats.avgLitPixels} px avg):</span>
              <span className="text-white font-medium">+{formatCurrent(estimation.avgDiodeCurrentMa)}</span>
            </div>

            <div className="h-px bg-[#1e2538] my-1" />

            <div className="flex items-center justify-between font-semibold pt-0.5">
              <span className="text-white">Estimated Average Current:</span>
              <span className={rating.textColor}>{formatCurrent(avgTotalMa)}</span>
            </div>

            <div className="flex items-center justify-between text-[10px] text-[#94a3b8]">
              <span>Current State Current:</span>
              <span className="text-white font-mono">{formatCurrent(currentTotalMa)}</span>
            </div>

            <div className="flex items-center justify-between text-[10px] text-[#64748b]">
              <span>Dynamic Range (min – max):</span>
              <span>{formatCurrent(minTotalMa)} – {formatCurrent(maxTotalMa)}</span>
            </div>
          </div>

          {/* Energy Rate per minute */}
          <div className="mt-2.5 flex items-center justify-between p-2 rounded-lg bg-[#0b0e14] border border-[#182030] text-[11px] font-mono">
            <div className="flex items-center gap-1.5 text-[#94a3b8]">
              <Clock size={12} className="text-[#00d2ff]" />
              <span>Energy (/minute):</span>
            </div>
            <div className="text-right">
              <span className="text-white font-semibold">{estimation.energyMahPerMin.toFixed(3)} mAh/min</span>
              <span className="text-[10px] text-[#64748b] ml-1.5">({estimation.energyMwhPerMin.toFixed(3)} mWh/min · {estimation.energyJoulesPerMin.toFixed(2)} J/min)</span>
            </div>
          </div>

          {/* Battery Life (Continuous vs Expected) */}
          <div className="mt-2.5 bg-[#121622]/70 rounded-lg p-2.5 border border-[#1b2234]">
            <div className="flex items-center justify-between gap-2 text-[#cbd5e1] font-semibold text-[11px] mb-2">
              <div className="flex items-center gap-1.5">
                <Battery size={13} className="text-[#4ade80]" />
                <span>Battery Endurance</span>
              </div>
              <div
                className="flex items-center gap-1.5 text-[10px] font-mono"
                onClick={e => e.stopPropagation()}
                onKeyDown={e => e.stopPropagation()}
              >
                <NumberField
                  value={batteryCapacity}
                  onChange={val => {
                    if (typeof val === 'number' && Number.isFinite(val)) {
                      setBatteryCapacity(val);
                    }
                  }}
                  minValue={1}
                  maxValue={99999}
                  step={10}
                  aria-label="Battery capacity in mAh"
                  className="w-24 text-xs font-mono"
                >
                  <NumberField.Group className="!h-6 !grid-cols-[18px_1fr_18px] !bg-[#0b0e14] !border-[#232c3f] rounded-md px-0.5">
                    <NumberField.DecrementButton className="!size-4.5 text-[#94a3b8] hover:text-white flex items-center justify-center cursor-pointer text-[10px]" />
                    <NumberField.Input className="text-center font-mono text-[11px] text-white !py-0 !px-1 focus:outline-none bg-transparent" />
                    <NumberField.IncrementButton className="!size-4.5 text-[#94a3b8] hover:text-white flex items-center justify-center cursor-pointer text-[10px]" />
                  </NumberField.Group>
                </NumberField>
                <span className="text-[#94a3b8]">mAh</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-center font-mono">
              <div className="bg-[#0b0e14] p-2 rounded border border-[#182030]">
                <div className="text-[#64748b] text-[9px] uppercase tracking-tight">Life (Continuous)</div>
                <div className="text-[#38bdf8] font-bold text-xs mt-1">
                  {formatDurationHours(continuousLifeHours)}
                </div>
                <div className="text-[9px] text-[#64748b] mt-0.5">100% Screen Always ON</div>
              </div>

              <div className="bg-[#0b0e14] p-2 rounded border border-[#182030]">
                <div className="text-[#64748b] text-[9px] uppercase tracking-tight">Life (Expected Real-Life)</div>
                <div className="text-[#4ade80] font-bold text-xs mt-1">
                  {formatDurationHours(expectedLifeHours)}
                </div>
                <div className="text-[9px] text-[#64748b] mt-0.5">20% Typing / 80% Sleep</div>
              </div>
            </div>
          </div>

          {/* Rating Scale & Iconography Guide */}
          <div className="mt-2.5 pt-2 border-t border-[#1e2538] text-[9px] text-[#64748b]">
            <div className="font-semibold uppercase tracking-wider text-[#94a3b8] mb-1 flex items-center justify-between">
              <div className="flex items-center gap-1">
                <Info size={10} />
                <span>Efficiency Rating Scale (Target &lt; 2.0 mA):</span>
              </div>
              <span className="text-[8px] text-[#64748b]">Esc to close</span>
            </div>
            <div className="grid grid-cols-1 gap-1 leading-relaxed">
              <div className="flex items-center gap-1.5 text-emerald-400">
                <Zap size={9} className="shrink-0" />
                <span className="font-semibold text-emerald-400">Ultra (&lt; 2.0 mA):</span>
                <span className="text-[#94a3b8]">Minimal diode draw; sub-2mA target offering &gt;55h cont., &gt;10d real.</span>
              </div>
              <div className="flex items-center gap-1.5 text-sky-400">
                <CheckCircle2 size={9} className="shrink-0" />
                <span className="font-semibold text-sky-400">Great (2.0 – 4.5 mA):</span>
                <span className="text-[#94a3b8]">Optimal efficiency for static layouts (25–55h cont., 5–10d real).</span>
              </div>
              <div className="flex items-center gap-1.5 text-amber-400">
                <Activity size={9} className="shrink-0" />
                <span className="font-semibold text-amber-400">Good (4.5 – 8.0 mA):</span>
                <span className="text-[#94a3b8]">Balanced layout with standard status widgets (14–25h cont.).</span>
              </div>
              <div className="flex items-center gap-1.5 text-orange-400">
                <AlertTriangle size={9} className="shrink-0" />
                <span className="font-semibold text-orange-400">Moderate (8.0 – 14.0 mA):</span>
                <span className="text-[#94a3b8]">Dense graphics or active animation loops (8–14h cont.).</span>
              </div>
              <div className="flex items-center gap-1.5 text-rose-400">
                <Flame size={9} className="shrink-0" />
                <span className="font-semibold text-rose-400">Heavy (&gt; 14.0 mA):</span>
                <span className="text-[#94a3b8]">High pixel saturation or rapid updates (&lt;8h cont.).</span>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

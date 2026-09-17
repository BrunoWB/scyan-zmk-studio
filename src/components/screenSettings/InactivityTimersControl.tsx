import React from 'react';
import { Moon, Clock, Check, Power } from 'lucide-react';
import { StepperControl } from './CustomDimensionsPicker';
import { IDLE_TIMEOUT_PRESETS, SLEEP_TIMEOUT_PRESETS } from './ScreenPresetCatalog';

export interface IdleScreensaverCardProps {
  idleScreensEnabled: boolean;
  onToggleIdle: () => void;
  sideName: string;
  themeColor?: 'cyan' | 'purple' | 'amber';
  disabled?: boolean;
}

export const IdleScreensaverCard: React.FC<IdleScreensaverCardProps> = ({
  idleScreensEnabled,
  onToggleIdle,
  sideName,
  themeColor = 'cyan',
  disabled = false,
}) => {
  const isPurple = themeColor === 'purple';

  return (
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
        <div className="pt-1">
          <div className="flex items-center justify-between p-2 px-3 rounded-xl bg-[#0b0d13] border border-[#1e2538]">
            <div className="text-xs font-medium text-white">Allow Idle Screensaver</div>
            <button
              type="button"
              role="switch"
              aria-checked={idleScreensEnabled}
              aria-label={`${sideName} Allow Idle Screensaver`}
              disabled={disabled}
              onClick={onToggleIdle}
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
        </div>
      </div>
    </div>
  );
};

export interface InactivityTimersCardProps {
  idleScreensEnabled: boolean;
  idleTimeoutSec: number;
  onIdleChange: (val: number) => void;
  screenOffTimeoutSec: number;
  onScreenOffChange: (val: number) => void;
  sideName: string;
  themeColor?: 'cyan' | 'purple' | 'amber';
  disabled?: boolean;
}

export const InactivityTimersCard: React.FC<InactivityTimersCardProps> = ({
  idleScreensEnabled,
  idleTimeoutSec,
  onIdleChange,
  screenOffTimeoutSec,
  onScreenOffChange,
  sideName,
  themeColor = 'cyan',
  disabled = false,
}) => {
  const isPurple = themeColor === 'purple';
  const minSleep = idleScreensEnabled ? idleTimeoutSec + 5 : 10;

  return (
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
                onChange={onIdleChange}
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
                  onClick={() => onIdleChange(p.sec)}
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
                onChange={onScreenOffChange}
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
                    onClick={() => onScreenOffChange(p.sec)}
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
    </div>
  );
};

export interface SettingsTimelineVisualizerProps {
  effectiveSymmetric: boolean;
  idleScreensEnabled: boolean;
  idleTimeoutSec: number;
  screenOffTimeoutSec: number;
  effectiveRightIdleEnabled?: boolean;
  effectiveRightIdleTimeout?: number;
  effectiveRightScreenOffTimeout?: number;
}

export const SettingsTimelineVisualizer: React.FC<SettingsTimelineVisualizerProps> = ({
  effectiveSymmetric,
  idleScreensEnabled,
  idleTimeoutSec,
  screenOffTimeoutSec,
  effectiveRightIdleEnabled,
  effectiveRightIdleTimeout,
  effectiveRightScreenOffTimeout,
}) => {
  return (
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
        </div>
      ) : (
        <div className="space-y-1.5">
          {/* Left Timeline */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
            <div className="flex items-center gap-2 overflow-x-auto max-w-full font-mono text-[10px]">
              <span className="text-[10px] font-mono text-[#00f0ff] font-bold shrink-0">Central:</span>
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
          </div>

          {/* Right Timeline */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
            <div className="flex items-center gap-2 overflow-x-auto max-w-full font-mono text-[10px]">
              <span className="text-[10px] font-mono text-[#a953f6] font-bold shrink-0">Peripheral:</span>
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
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState } from 'react';
import { Monitor } from 'lucide-react';
import { trackEvent } from '../../services/analytics';
import {
  PRESET_SCREEN_SIZES,
  ScreenPresetSelector,
  ScreenRotationSelector,
} from './ScreenPresetCatalog';
import { CustomDimensionsPicker } from './CustomDimensionsPicker';
import { IdleScreensaverCard, InactivityTimersCard } from './InactivityTimersControl';

export interface SideSettingsBlockProps {
  title?: string;
  badge?: string;
  sideName: string;
  themeColor?: 'cyan' | 'purple' | 'amber';
  screenDimensions: { width: number; height: number };
  onScreenDimensionsChange: (dims: { width: number; height: number }) => void;
  rotation?: 0 | 90 | 180 | 270;
  onRotationChange?: (rotation: 0 | 90 | 180 | 270) => void;
  idleScreensEnabled: boolean;
  onIdleScreensEnabledChange: (enabled: boolean) => void;
  idleTimeoutSec: number;
  onIdleTimeoutSecChange: (sec: number) => void;
  screenOffTimeoutSec: number;
  onScreenOffTimeoutSecChange: (sec: number) => void;
  layout?: 'horizontal' | 'vertical';
  disabled?: boolean;
}

export const SideSettingsBlock: React.FC<SideSettingsBlockProps> = ({
  title,
  badge,
  sideName,
  themeColor = 'cyan',
  screenDimensions,
  onScreenDimensionsChange,
  rotation,
  onRotationChange,
  idleScreensEnabled,
  onIdleScreensEnabledChange,
  idleTimeoutSec,
  onIdleTimeoutSecChange,
  screenOffTimeoutSec,
  onScreenOffTimeoutSecChange,
  layout = 'horizontal',
  disabled = false,
}) => {
  const radioGroupId = React.useId();
  const hwW = Math.max(screenDimensions.width, screenDimensions.height);
  const hwH = Math.min(screenDimensions.width, screenDimensions.height);
  const matchedPreset = PRESET_SCREEN_SIZES.find(
    p => p.width > 0 && p.width === hwW && p.height === hwH
  );
  const [prevMatchedPreset, setPrevMatchedPreset] = useState(matchedPreset);
  const [isCustomMode, setIsCustomMode] = useState(!matchedPreset);
  if (matchedPreset !== prevMatchedPreset) {
    setPrevMatchedPreset(matchedPreset);
    if (!matchedPreset) {
      setIsCustomMode(true);
    }
  }

  const isCurrentlyVertical = screenDimensions.width < screenDimensions.height;
  const effectiveRotation: 0 | 90 | 180 | 270 = rotation !== undefined
    ? rotation
    : (isCurrentlyVertical ? 90 : 0);

  const handleRotationSelect = (newRot: 0 | 90 | 180 | 270) => {
    if (disabled) return;
    onRotationChange?.(newRot);
    trackEvent('screen_rotation_changed', {
      rotation: newRot,
      side: sideName || 'Left',
    });

    const isNewRotVertical = newRot === 90 || newRot === 270;
    const isCurVertical = effectiveRotation === 90 || effectiveRotation === 270;

    if (isNewRotVertical !== isCurVertical) {
      onScreenDimensionsChange({
        width: screenDimensions.height,
        height: screenDimensions.width,
      });
    }
  };

  const handlePresetSelect = (val: string) => {
    if (val === 'custom') {
      setIsCustomMode(true);
      return;
    }
    setIsCustomMode(false);
    trackEvent('screen_size_changed', {
      size: val,
      side: sideName || 'Left',
    });
    const [specW, specH] = val.split('x').map(Number);
    const hwWidth = Math.max(specW, specH);
    const hwHeight = Math.min(specW, specH);
    const isVert = effectiveRotation === 90 || effectiveRotation === 270;
    onScreenDimensionsChange(
      isVert ? { width: hwHeight, height: hwWidth } : { width: hwWidth, height: hwHeight }
    );
  };

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
              <ScreenPresetSelector
                isCustomMode={isCustomMode}
                matchedPreset={matchedPreset}
                onPresetSelect={handlePresetSelect}
                disabled={disabled}
                themeColor={themeColor}
              />

              <ScreenRotationSelector
                sideName={sideName}
                effectiveRotation={effectiveRotation}
                onRotationSelect={handleRotationSelect}
                radioGroupId={radioGroupId}
                disabled={disabled}
                themeColor={themeColor}
              />

              {isCustomMode && (
                <CustomDimensionsPicker
                  width={screenDimensions.width}
                  height={screenDimensions.height}
                  onWidthChange={w => onScreenDimensionsChange({ width: w, height: screenDimensions.height })}
                  onHeightChange={h => onScreenDimensionsChange({ width: screenDimensions.width, height: h })}
                  sideName={sideName}
                  themeColor={themeColor}
                  disabled={disabled}
                />
              )}
            </div>
          </div>
        </div>

        {/* Card 2: Idle Screensaver */}
        <IdleScreensaverCard
          idleScreensEnabled={idleScreensEnabled}
          onToggleIdle={handleToggleIdle}
          sideName={sideName}
          themeColor={themeColor}
          disabled={disabled}
        />

        {/* Card 3: Inactivity & Sleep Timers */}
        <InactivityTimersCard
          idleScreensEnabled={idleScreensEnabled}
          idleTimeoutSec={idleTimeoutSec}
          onIdleChange={handleIdleChange}
          screenOffTimeoutSec={screenOffTimeoutSec}
          onScreenOffChange={handleScreenOffChange}
          sideName={sideName}
          themeColor={themeColor}
          disabled={disabled}
        />
      </div>
    </div>
  );
};

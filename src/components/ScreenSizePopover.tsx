/* oxlint-disable react/only-export-components */
import React, { useState, useEffect } from 'react';
import { Settings, X, Check, SlidersHorizontal, Crown, Trash2, ArrowRightLeft } from 'lucide-react';
import {
  PRESET_SCREEN_SIZES,
  ROTATION_OPTIONS,
  IDLE_TIMEOUT_PRESETS,
  SLEEP_TIMEOUT_PRESETS,
  StepperControl,
  SideSettingsBlock,
  SettingsTimelineVisualizer,
  type StepperControlProps,
} from './screenSettings';

export {
  PRESET_SCREEN_SIZES,
  ROTATION_OPTIONS,
  IDLE_TIMEOUT_PRESETS,
  SLEEP_TIMEOUT_PRESETS,
  StepperControl,
  SideSettingsBlock,
  SettingsTimelineVisualizer,
  type StepperControlProps,
};

export interface BlockSettingsSectionProps {
  isOpen: boolean;
  onClose: () => void;
  // Left / Unified settings
  screenDimensions: { width: number; height: number };
  onScreenDimensionsChange: (dims: { width: number; height: number }) => void;
  rotation?: 0 | 90 | 180 | 270;
  onRotationChange?: (rotation: 0 | 90 | 180 | 270) => void;
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
  rightRotation?: 0 | 90 | 180 | 270;
  onRightRotationChange?: (rotation: 0 | 90 | 180 | 270) => void;
  rightIdleScreensEnabled?: boolean;
  onRightIdleScreensEnabledChange?: (enabled: boolean) => void;
  rightIdleTimeoutSec?: number;
  onRightIdleTimeoutSecChange?: (sec: number) => void;
  rightScreenOffTimeoutSec?: number;
  onRightScreenOffTimeoutSecChange?: (sec: number) => void;

  // Modern displays architecture support
  displays?: Record<string, import('../types/zmk').DisplayScreen>;
  activeDisplayId?: string;
  onUpdateDisplay?: (displayId: string, updater: Partial<import('../types/zmk').DisplayScreen>) => void;
  onActiveDisplayChange?: (displayId: string) => void;

  className?: string;
}

export const BlockSettingsSection: React.FC<BlockSettingsSectionProps> = ({
  isOpen,
  onClose,
  screenDimensions,
  onScreenDimensionsChange,
  rotation,
  onRotationChange,
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
  rightRotation,
  onRightRotationChange,
  rightIdleScreensEnabled,
  onRightIdleScreensEnabledChange,
  rightIdleTimeoutSec,
  onRightIdleTimeoutSecChange,
  rightScreenOffTimeoutSec,
  onRightScreenOffTimeoutSecChange,
  displays,
  activeDisplayId,
  onUpdateDisplay,
  onActiveDisplayChange,
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

  // Local active display tracking
  const [localActiveId, setLocalActiveId] = useState<string>('display-1');
  const currentActiveId = activeDisplayId ?? (displays && displays[localActiveId] ? localActiveId : displays ? Object.keys(displays)[0] : 'display-1');
  const activeDisplay = displays ? (displays[currentActiveId] ?? displays['display-1'] ?? Object.values(displays)[0]) : undefined;

  const handleSelectDisplay = (dId: string) => {
    setLocalActiveId(dId);
    onActiveDisplayChange?.(dId);
  };

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
      if (onRightRotationChange && rotation !== undefined) onRightRotationChange(rotation);
      if (onRightIdleScreensEnabledChange) onRightIdleScreensEnabledChange(idleScreensEnabled);
      if (onRightIdleTimeoutSecChange) onRightIdleTimeoutSecChange(idleTimeoutSec);
      if (onRightScreenOffTimeoutSecChange) onRightScreenOffTimeoutSecChange(screenOffTimeoutSec);
      if (displays && onUpdateDisplay) {
        Object.keys(displays).forEach((dId) => {
          onUpdateDisplay(dId, {
            dimensions: screenDimensions,
            rotation: rotation ?? 90,
            idleScreensEnabled,
            idleTimeoutSec,
            screenOffTimeoutSec,
          });
        });
      }
    }
  };

  // Right side values with fallbacks to left side values
  const effectiveRightDimensions = effectiveSymmetric
    ? screenDimensions
    : (rightScreenDimensions ?? displays?.['display-2']?.dimensions ?? screenDimensions);

  const effectiveRightRotation = effectiveSymmetric
    ? rotation
    : (rightRotation !== undefined ? rightRotation : (displays?.['display-2']?.rotation ?? rotation));

  const effectiveRightIdleEnabled = effectiveSymmetric
    ? idleScreensEnabled
    : (rightIdleScreensEnabled !== undefined ? rightIdleScreensEnabled : (displays?.['display-2']?.idleScreensEnabled ?? idleScreensEnabled));

  const effectiveRightIdleTimeout = effectiveSymmetric
    ? idleTimeoutSec
    : (rightIdleTimeoutSec !== undefined ? rightIdleTimeoutSec : (displays?.['display-2']?.idleTimeoutSec ?? idleTimeoutSec));

  const effectiveRightScreenOffTimeout = effectiveSymmetric
    ? screenOffTimeoutSec
    : (rightScreenOffTimeoutSec !== undefined ? rightScreenOffTimeoutSec : (displays?.['display-2']?.screenOffTimeoutSec ?? screenOffTimeoutSec));

  // Left/Unified change handlers
  const handleLeftDimensionsChange = (dims: { width: number; height: number }) => {
    onScreenDimensionsChange(dims);
    if (effectiveSymmetric && onRightScreenDimensionsChange) {
      onRightScreenDimensionsChange(dims);
    }
    if (displays && onUpdateDisplay) {
      if (effectiveSymmetric) {
        Object.keys(displays).forEach((dId) => onUpdateDisplay(dId, { dimensions: dims }));
      } else {
        onUpdateDisplay('display-1', { dimensions: dims });
      }
    }
  };

  const handleLeftRotationChange = (rot: 0 | 90 | 180 | 270) => {
    if (onRotationChange) onRotationChange(rot);
    if (effectiveSymmetric && onRightRotationChange) {
      onRightRotationChange(rot);
    }
    if (displays && onUpdateDisplay) {
      if (effectiveSymmetric) {
        Object.keys(displays).forEach((dId) => onUpdateDisplay(dId, { rotation: rot }));
      } else {
        onUpdateDisplay('display-1', { rotation: rot });
      }
    }
  };

  const handleLeftIdleEnabledChange = (enabled: boolean) => {
    if (onIdleScreensEnabledChange) onIdleScreensEnabledChange(enabled);
    if (effectiveSymmetric && onRightIdleScreensEnabledChange) {
      onRightIdleScreensEnabledChange(enabled);
    }
    if (displays && onUpdateDisplay) {
      if (effectiveSymmetric) {
        Object.keys(displays).forEach((dId) => onUpdateDisplay(dId, { idleScreensEnabled: enabled }));
      } else {
        onUpdateDisplay('display-1', { idleScreensEnabled: enabled });
      }
    }
  };

  const handleLeftIdleTimeoutChange = (sec: number) => {
    if (onIdleTimeoutSecChange) onIdleTimeoutSecChange(sec);
    if (effectiveSymmetric && onRightIdleTimeoutSecChange) {
      onRightIdleTimeoutSecChange(sec);
    }
    if (displays && onUpdateDisplay) {
      if (effectiveSymmetric) {
        Object.keys(displays).forEach((dId) => onUpdateDisplay(dId, { idleTimeoutSec: sec }));
      } else {
        onUpdateDisplay('display-1', { idleTimeoutSec: sec });
      }
    }
  };

  const handleLeftScreenOffTimeoutChange = (sec: number) => {
    if (onScreenOffTimeoutSecChange) onScreenOffTimeoutSecChange(sec);
    if (effectiveSymmetric && onRightScreenOffTimeoutSecChange) {
      onRightScreenOffTimeoutSecChange(sec);
    }
    if (displays && onUpdateDisplay) {
      if (effectiveSymmetric) {
        Object.keys(displays).forEach((dId) => onUpdateDisplay(dId, { screenOffTimeoutSec: sec }));
      } else {
        onUpdateDisplay('display-1', { screenOffTimeoutSec: sec });
      }
    }
  };

  // Active display change handlers (used when displays map is provided)
  const handleActiveDimensionsChange = (dims: { width: number; height: number }) => {
    onUpdateDisplay?.(currentActiveId, { dimensions: dims });
    if (currentActiveId === 'display-1' || currentActiveId === 'central') {
      onScreenDimensionsChange(dims);
    } else if (currentActiveId === 'display-2' || currentActiveId === 'peripheral') {
      onRightScreenDimensionsChange?.(dims);
    }
  };

  const handleActiveRotationChange = (rot: 0 | 90 | 180 | 270) => {
    onUpdateDisplay?.(currentActiveId, { rotation: rot });
    if (currentActiveId === 'display-1' || currentActiveId === 'central') {
      onRotationChange?.(rot);
    } else if (currentActiveId === 'display-2' || currentActiveId === 'peripheral') {
      onRightRotationChange?.(rot);
    }
  };

  const handleActiveIdleEnabledChange = (enabled: boolean) => {
    onUpdateDisplay?.(currentActiveId, { idleScreensEnabled: enabled });
    if (currentActiveId === 'display-1' || currentActiveId === 'central') {
      onIdleScreensEnabledChange?.(enabled);
    } else if (currentActiveId === 'display-2' || currentActiveId === 'peripheral') {
      onRightIdleScreensEnabledChange?.(enabled);
    }
  };

  const handleActiveIdleTimeoutChange = (sec: number) => {
    onUpdateDisplay?.(currentActiveId, { idleTimeoutSec: sec });
    if (currentActiveId === 'display-1' || currentActiveId === 'central') {
      onIdleTimeoutSecChange?.(sec);
    } else if (currentActiveId === 'display-2' || currentActiveId === 'peripheral') {
      onRightIdleTimeoutSecChange?.(sec);
    }
  };

  const handleActiveScreenOffTimeoutChange = (sec: number) => {
    onUpdateDisplay?.(currentActiveId, { screenOffTimeoutSec: sec });
    if (currentActiveId === 'display-1' || currentActiveId === 'central') {
      onScreenOffTimeoutSecChange?.(sec);
    } else if (currentActiveId === 'display-2' || currentActiveId === 'peripheral') {
      onRightScreenOffTimeoutSecChange?.(sec);
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

          {/* Display selector tabs when displays are provided */}
          {displays && Object.keys(displays).length > 1 && (
            <div className="flex items-center gap-1.5 p-1 bg-[#0b0d13] border border-[#1e2538] rounded-xl mb-3 overflow-x-auto">
              {Object.entries(displays).map(([dId, d]) => (
                <button
                  key={dId}
                  type="button"
                  onClick={() => handleSelectDisplay(dId)}
                  className={`px-3 py-1 text-xs font-medium rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                    currentActiveId === dId
                      ? 'bg-[#00f0ff]/15 text-[#00f0ff] border border-[#00f0ff]/30 shadow-sm'
                      : 'text-[#94a3b8] hover:text-white hover:bg-white/5 border border-transparent'
                  }`}
                >
                  {d.name || dId}
                </button>
              ))}
            </div>
          )}

          {/* Settings Section: Unified (Symmetric) OR Active Display (displays provided) OR Legacy Split */}
          {effectiveSymmetric ? (
            <SideSettingsBlock
              sideName="Unified"
              themeColor="cyan"
              screenDimensions={activeDisplay?.dimensions ?? screenDimensions}
              onScreenDimensionsChange={handleLeftDimensionsChange}
              rotation={activeDisplay?.rotation ?? rotation}
              onRotationChange={handleLeftRotationChange}
              idleScreensEnabled={activeDisplay?.idleScreensEnabled ?? idleScreensEnabled}
              onIdleScreensEnabledChange={handleLeftIdleEnabledChange}
              idleTimeoutSec={activeDisplay?.idleTimeoutSec ?? idleTimeoutSec}
              onIdleTimeoutSecChange={handleLeftIdleTimeoutChange}
              screenOffTimeoutSec={activeDisplay?.screenOffTimeoutSec ?? screenOffTimeoutSec}
              onScreenOffTimeoutSecChange={handleLeftScreenOffTimeoutChange}
            />
          ) : displays && Object.keys(displays).length > 0 ? (
            /* Modern architecture: drive settings directly from active display */
            <div className="space-y-4">
              <SideSettingsBlock
                title={`${activeDisplay?.name || currentActiveId} Display & Power Settings`}
                badge={activeDisplay?.name || currentActiveId}
                sideName={activeDisplay?.name || currentActiveId}
                themeColor={currentActiveId === 'display-1' ? 'cyan' : 'purple'}
                screenDimensions={activeDisplay?.dimensions ?? screenDimensions}
                onScreenDimensionsChange={handleActiveDimensionsChange}
                rotation={activeDisplay?.rotation ?? rotation}
                onRotationChange={handleActiveRotationChange}
                idleScreensEnabled={activeDisplay?.idleScreensEnabled ?? idleScreensEnabled}
                onIdleScreensEnabledChange={handleActiveIdleEnabledChange}
                idleTimeoutSec={activeDisplay?.idleTimeoutSec ?? idleTimeoutSec}
                onIdleTimeoutSecChange={handleActiveIdleTimeoutChange}
                screenOffTimeoutSec={activeDisplay?.screenOffTimeoutSec ?? screenOffTimeoutSec}
                onScreenOffTimeoutSecChange={handleActiveScreenOffTimeoutChange}
              />
            </div>
          ) : (
            /* Legacy fallback when displays dictionary is omitted */
            <div className="space-y-4">
              {/* Block 1: Central Display & Power Settings */}
              <SideSettingsBlock
                title="Central Display & Power Settings"
                badge="Central"
                sideName="Central"
                themeColor="cyan"
                screenDimensions={screenDimensions}
                onScreenDimensionsChange={handleLeftDimensionsChange}
                rotation={rotation}
                onRotationChange={handleLeftRotationChange}
                idleScreensEnabled={idleScreensEnabled}
                onIdleScreensEnabledChange={handleLeftIdleEnabledChange}
                idleTimeoutSec={idleTimeoutSec}
                onIdleTimeoutSecChange={handleLeftIdleTimeoutChange}
                screenOffTimeoutSec={screenOffTimeoutSec}
                onScreenOffTimeoutSecChange={handleLeftScreenOffTimeoutChange}
              />

              {/* Block 2: Peripheral Display & Power Settings */}
              <SideSettingsBlock
                title="Peripheral Display & Power Settings"
                badge="Peripheral"
                sideName="Peripheral"
                themeColor="purple"
                screenDimensions={effectiveRightDimensions}
                onScreenDimensionsChange={onRightScreenDimensionsChange || (() => {})}
                rotation={effectiveRightRotation}
                onRotationChange={onRightRotationChange || (() => {})}
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
          <SettingsTimelineVisualizer
            effectiveSymmetric={effectiveSymmetric}
            idleScreensEnabled={activeDisplay?.idleScreensEnabled ?? idleScreensEnabled}
            idleTimeoutSec={activeDisplay?.idleTimeoutSec ?? idleTimeoutSec}
            screenOffTimeoutSec={activeDisplay?.screenOffTimeoutSec ?? screenOffTimeoutSec}
            effectiveRightIdleEnabled={effectiveRightIdleEnabled}
            effectiveRightIdleTimeout={effectiveRightIdleTimeout}
            effectiveRightScreenOffTimeout={effectiveRightScreenOffTimeout}
          />
        </div>
      </div>
    </div>
  );
};

export type ScreenSizePopoverProps = BlockSettingsSectionProps;
export const ScreenSizePopover = BlockSettingsSection;

export interface SideSettingsPanelProps {
  side: 'central' | 'peripheral' | string;
  isOpen: boolean;
  onClose: () => void;
  // Master / Left settings
  screenDimensions: { width: number; height: number };
  onScreenDimensionsChange: (dims: { width: number; height: number }) => void;
  rotation?: 0 | 90 | 180 | 270;
  onRotationChange?: (rotation: 0 | 90 | 180 | 270) => void;
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
  rightRotation?: 0 | 90 | 180 | 270;
  onRightRotationChange?: (rotation: 0 | 90 | 180 | 270) => void;
  rightIdleScreensEnabled?: boolean;
  onRightIdleScreensEnabledChange?: (enabled: boolean) => void;
  rightIdleTimeoutSec?: number;
  onRightIdleTimeoutSecChange?: (sec: number) => void;
  rightScreenOffTimeoutSec?: number;
  onRightScreenOffTimeoutSecChange?: (sec: number) => void;

  // Display role actions
  isPeripheral?: boolean;
  onMakeMaster?: () => void;
  onMakeCentral?: () => void;
  onMakePeripheral?: () => void;
  onDeleteDisplay?: () => void;
  canDeleteDisplay?: boolean;

  /** When true (e.g. totalDisplays > 2), displays overlay directly over the screen instead of pushing horizontally */
  isOverlay?: boolean;

  /** Associated display screen object if available */
  display?: import('../types/zmk').DisplayScreen;

  className?: string;
}

export const SideSettingsPanel: React.FC<SideSettingsPanelProps> = ({
  side,
  isOpen,
  onClose,
  screenDimensions,
  onScreenDimensionsChange,
  rotation,
  onRotationChange,
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
  rightRotation,
  onRightRotationChange,
  rightIdleScreensEnabled,
  onRightIdleScreensEnabledChange,
  rightIdleTimeoutSec,
  onRightIdleTimeoutSecChange,
  rightScreenOffTimeoutSec,
  onRightScreenOffTimeoutSecChange,
  isPeripheral,
  onMakeMaster,
  onMakeCentral,
  onMakePeripheral,
  onDeleteDisplay,
  canDeleteDisplay = true,
  isOverlay = false,
  display,
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
    // When toggling symmetric back ON, synchronize right side with left side (dimensions & timeouts)
    if (next) {
      if (onRightScreenDimensionsChange) onRightScreenDimensionsChange(screenDimensions);
      if (onRightRotationChange && rotation !== undefined) onRightRotationChange(rotation);
      if (onRightIdleTimeoutSecChange) onRightIdleTimeoutSecChange(idleTimeoutSec);
      if (onRightScreenOffTimeoutSecChange) onRightScreenOffTimeoutSecChange(screenOffTimeoutSec);
    }
  };

  // Right side values with fallbacks to left side values
  const effectiveRightDimensions = effectiveSymmetric
    ? screenDimensions
    : (rightScreenDimensions ?? display?.dimensions ?? screenDimensions);

  const effectiveRightRotation = effectiveSymmetric
    ? rotation
    : (rightRotation !== undefined ? rightRotation : (display?.rotation ?? rotation));

  // Idle toggles are independent per display
  const effectiveRightIdleEnabled = rightIdleScreensEnabled !== undefined ? rightIdleScreensEnabled : (display?.idleScreensEnabled ?? idleScreensEnabled);

  const effectiveRightIdleTimeout = effectiveSymmetric
    ? idleTimeoutSec
    : (rightIdleTimeoutSec !== undefined ? rightIdleTimeoutSec : (display?.idleTimeoutSec ?? idleTimeoutSec));

  const effectiveRightScreenOffTimeout = effectiveSymmetric
    ? screenOffTimeoutSec
    : (rightScreenOffTimeoutSec !== undefined ? rightScreenOffTimeoutSec : (display?.screenOffTimeoutSec ?? screenOffTimeoutSec));

  // Left/Unified change handlers
  const handleLeftDimensionsChange = (dims: { width: number; height: number }) => {
    onScreenDimensionsChange(dims);
    if (effectiveSymmetric && onRightScreenDimensionsChange) {
      onRightScreenDimensionsChange(dims);
    }
  };

  const handleLeftRotationChange = (rot: 0 | 90 | 180 | 270) => {
    if (onRotationChange) onRotationChange(rot);
    if (effectiveSymmetric && onRightRotationChange) {
      onRightRotationChange(rot);
    }
  };

  const handleLeftIdleEnabledChange = (enabled: boolean) => {
    if (onIdleScreensEnabledChange) onIdleScreensEnabledChange(enabled);
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

  const isCentral = isPeripheral !== undefined ? !isPeripheral : (side === 'central' || side === 'left' || side === 'display-1');
  const peripheralIndex = side.startsWith('peripheral-')
    ? side.replace('peripheral-', '')
    : (side.startsWith('display-') && side !== 'display-1' ? side.replace('display-', '') : null);
  const sideTitle = isCentral ? 'Central Settings' : peripheralIndex ? `Peripheral ${peripheralIndex} Settings` : 'Peripheral Settings';
  const sideBadge = isCentral ? 'Central' : peripheralIndex ? `Peripheral ${peripheralIndex}` : 'Peripheral';

  return (
    <aside
      className={[
        'side-settings-panel-container',
        `side-${side}`,
        isOverlay ? 'is-overlay' : '',
        isOpen ? 'open' : '',
        className,
      ].filter(Boolean).join(' ')}
      aria-hidden={!isOpen}
      role="region"
      aria-label={`${isCentral ? 'Central' : `Peripheral ${peripheralIndex || ''}`} Display & Power Settings`}
    >
      <div className="side-settings-panel-inner">
        {/* Header */}
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2">
            <div
              className={`size-6 rounded-lg flex items-center justify-center shrink-0 border ${
                !isCentral
                  ? 'bg-[#a953f6]/15 border-[#a953f6]/30 text-[#a953f6] shadow-[0_0_8px_rgba(169,83,246,0.2)]'
                  : 'bg-[#00f0ff]/15 border-[#00f0ff]/30 text-[#00f0ff] shadow-[0_0_8px_rgba(0,240,255,0.2)]'
              }`}
            >
              <Settings size={13} />
            </div>
            <div>
              <div className="text-xs font-semibold text-white flex items-center gap-1.5">
                <span>{sideTitle}</span>
                <span
                  className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${
                    !isCentral
                      ? 'bg-[#a953f6]/10 text-[#a953f6] border-[#a953f6]/20'
                      : 'bg-[#00f0ff]/10 text-[#00f0ff] border-[#00f0ff]/20'
                  }`}
                >
                  {sideBadge}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-[#94a3b8] hover:text-white hover:bg-white/5 transition-all p-1 rounded-md cursor-pointer flex items-center gap-1 text-xs"
            title="Close Settings (Esc)"
            aria-label={`Close ${isCentral ? 'Central' : 'Peripheral'} Settings`}
          >
            <X size={14} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="side-settings-panel-body custom-scrollbar">
          {isCentral ? (
            <>
              {effectiveSymmetric && (
                <div className="p-2 rounded-lg bg-[#00f0ff]/10 border border-[#00f0ff]/20 text-[11px] text-[#e2f1ff] flex items-center gap-1.5 shrink-0">
                  <Check size={12} className="text-[#00f0ff] shrink-0" />
                  <span className="text-[10px] text-[#94a3b8]">
                    <strong className="text-[#00f0ff] font-medium">Symmetric Mode:</strong> Controls both Central &amp; Peripheral.
                  </span>
                </div>
              )}

              <SideSettingsBlock
                sideName="Central"
                themeColor="cyan"
                screenDimensions={screenDimensions}
                onScreenDimensionsChange={handleLeftDimensionsChange}
                rotation={rotation}
                onRotationChange={handleLeftRotationChange}
                idleScreensEnabled={idleScreensEnabled}
                onIdleScreensEnabledChange={handleLeftIdleEnabledChange}
                idleTimeoutSec={idleTimeoutSec}
                onIdleTimeoutSecChange={handleLeftIdleTimeoutChange}
                screenOffTimeoutSec={screenOffTimeoutSec}
                onScreenOffTimeoutSecChange={handleLeftScreenOffTimeoutChange}
                layout="vertical"
              />
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
                      <div className="text-[10px] text-[#64748b]">Mirror Central display &amp; power</div>
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
                      <strong className="text-white font-medium block">Mirroring Central</strong>
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
                  sideName={sideBadge}
                  themeColor="purple"
                  screenDimensions={effectiveRightDimensions}
                  onScreenDimensionsChange={effectiveSymmetric ? () => {} : (onRightScreenDimensionsChange || (() => {}))}
                  rotation={effectiveRightRotation}
                  onRotationChange={effectiveSymmetric ? () => {} : (onRightRotationChange || (() => {}))}
                  idleScreensEnabled={effectiveRightIdleEnabled}
                  onIdleScreensEnabledChange={effectiveSymmetric ? () => {} : (onRightIdleScreensEnabledChange || (() => {}))}
                  idleTimeoutSec={effectiveRightIdleTimeout}
                  onIdleTimeoutSecChange={effectiveSymmetric ? () => {} : (onRightIdleTimeoutSecChange || (() => {}))}
                  screenOffTimeoutSec={effectiveRightScreenOffTimeout}
                  onScreenOffTimeoutSecChange={effectiveSymmetric ? () => {} : (onRightScreenOffTimeoutSecChange || (() => {}))}
                  disabled={effectiveSymmetric}
                  layout="vertical"
                />
              </div>
            </>
          )}

          {/* Display Role Actions for Central and Peripheral */}
          {((!isCentral && (onMakeCentral || onMakeMaster)) || (isCentral && onMakePeripheral) || onDeleteDisplay) && (
            <div className="bg-[#0e1118] border border-[#1e2538] rounded-xl p-3 space-y-2 shrink-0 mt-3">
              <div className="text-[11px] font-mono uppercase tracking-wider text-[#94a3b8] font-semibold">
                {isCentral ? 'Central Actions' : 'Peripheral Actions'}
              </div>

              {!isCentral && (onMakeCentral || onMakeMaster) && (
                <button
                  type="button"
                  onClick={() => {
                    (onMakeCentral || onMakeMaster)?.();
                    onClose();
                  }}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-[#00f0ff]/10 hover:bg-[#00f0ff]/20 text-[#00f0ff] border border-[#00f0ff]/30 text-xs font-semibold transition-all cursor-pointer shadow-sm hover:shadow-[0_0_12px_rgba(0,240,255,0.2)]"
                  title="Promote this peripheral to Central display"
                >
                  <Crown size={14} />
                  <span>Make Central Display</span>
                </button>
              )}

              {isCentral && onMakePeripheral && (
                <button
                  type="button"
                  onClick={() => {
                    onMakePeripheral();
                    onClose();
                  }}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-[#a953f6]/10 hover:bg-[#a953f6]/20 text-[#a953f6] border border-[#a953f6]/30 text-xs font-semibold transition-all cursor-pointer shadow-sm hover:shadow-[0_0_12px_rgba(169,83,246,0.2)]"
                  title="Convert Central display into a Peripheral display (leaves no Central display)"
                >
                  <ArrowRightLeft size={14} />
                  <span>Make Peripheral Display</span>
                </button>
              )}

              {onDeleteDisplay && (
                <button
                  type="button"
                  disabled={!canDeleteDisplay}
                  onClick={() => {
                    if (!canDeleteDisplay) return;
                    onDeleteDisplay();
                    onClose();
                  }}
                  className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                    canDeleteDisplay
                      ? 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 cursor-pointer'
                      : 'bg-white/5 text-[#64748b] border border-white/5 opacity-50 cursor-not-allowed'
                  }`}
                  title={
                    canDeleteDisplay
                      ? `Delete this ${isCentral ? 'central' : 'peripheral'} display from the layout`
                      : 'Cannot delete display: at least one display is required'
                  }
                >
                  <Trash2 size={14} />
                  <span>Delete Display</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};

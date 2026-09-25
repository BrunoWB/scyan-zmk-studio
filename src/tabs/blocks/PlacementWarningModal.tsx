import React, { useState } from 'react';
import { Zap, RefreshCw, AlertTriangle, X, CheckCircle2, RotateCcw } from 'lucide-react';

export type PlacementWarningType = 'peripheral-master' | 'idle-interactive' | 'sync-animation';

export const PLACEMENT_WARNING_SUPPRESS_KEYS: Record<PlacementWarningType, string> = {
  'peripheral-master': 'scyan_suppress_peripheral_master_modal',
  'idle-interactive': 'scyan_suppress_idle_interactive_modal',
  'sync-animation': 'scyan_suppress_sync_animation_modal',
};

export interface PlacementWarningModalProps {
  isOpen: boolean;
  type: PlacementWarningType;
  widgetName: string;
  onDismiss: (dontShowAgain: boolean) => void;
  onRemove: (dontShowAgain: boolean) => void;
}

const CONTENT: Record<
  PlacementWarningType,
  {
    icon: React.ReactNode;
    accentColor: string;
    accentBg: string;
    accentBorder: string;
    accentShadow: string;
    keepLabel: string;
    keepGradient: string;
    keepShadow: string;
    title: string;
    subtitle: (widgetName: string) => string;
    body: React.ReactNode;
  }
> = {
  'peripheral-master': {
    icon: <AlertTriangle size={20} />,
    accentColor: '#f2741d',
    accentBg: 'rgba(242,116,29,0.15)',
    accentBorder: 'rgba(242,116,29,0.4)',
    accentShadow: 'rgba(242,116,29,0.15)',
    keepLabel: 'Keep Widget',
    keepGradient: 'from-[#f2741d] to-[#e35913] hover:from-[#f59442] hover:to-[#f2741d]',
    keepShadow: 'rgba(242,116,29,0.35)',
    title: 'Just a heads up!',
    subtitle: (n) => `${n} on the right side`,
    body: (
      <>
        <p className="text-[#cbd5e1] text-xs leading-relaxed">
          The secondary half of a split keyboard usually doesn't receive live updates from your
          computer (like battery, active layer, or Bluetooth status).
        </p>
        <p className="text-[#94a3b8] text-xs leading-relaxed mt-2">
          You can still place it here, but it might not update in real time. We marked it with a
          small <span className="text-[#f2741d] font-bold">(!)</span> badge on your preview as a
          reminder.
        </p>
      </>
    ),
  },

  'idle-interactive': {
    icon: <Zap size={20} />,
    accentColor: '#f59e0b',
    accentBg: 'rgba(245,158,11,0.12)',
    accentBorder: 'rgba(245,158,11,0.4)',
    accentShadow: 'rgba(245,158,11,0.25)',
    keepLabel: 'Keep Widget',
    keepGradient: 'from-[#d97706] to-[#b45309]',
    keepShadow: 'rgba(217,119,6,0.35)',
    title: 'Active widget on Idle screen',
    subtitle: (n) => `${n} responds to input`,
    body: (
      <>
        <p className="text-[#cbd5e1] text-xs leading-relaxed">
          This widget reacts to keystrokes or typing events — but the Idle screen is only shown
          when the keyboard has been inactive for a while.
        </p>
        <p className="text-[#94a3b8] text-xs leading-relaxed mt-2">
          When a key is pressed, the display wakes out of idle and shows the Active screen instead,
          so the interactive state of this widget{' '}
          <span className="text-[#f59e0b] font-semibold">will not be visible during idle</span>.
          You can still keep it here — it will appear briefly on wake — but it may be confusing.
        </p>
      </>
    ),
  },

  'sync-animation': {
    icon: <RefreshCw size={20} />,
    accentColor: '#22d3ee',
    accentBg: 'rgba(34,211,238,0.10)',
    accentBorder: 'rgba(34,211,238,0.35)',
    accentShadow: 'rgba(34,211,238,0.20)',
    keepLabel: 'Got it',
    keepGradient: 'from-[#0891b2] to-[#0e7490]',
    keepShadow: 'rgba(8,145,178,0.35)',
    title: 'Split-Synchronized Animation',
    subtitle: (n) => `${n} is phase-locked to MCU uptime`,
    body: (
      <>
        <p className="text-[#cbd5e1] text-xs leading-relaxed">
          This animation uses{' '}
          <code className="bg-[#0b0d13] px-1 py-0.5 rounded text-[#22d3ee] font-mono">
            k_uptime_get_32()
          </code>{' '}
          to lock its frame phase to the global MCU clock — both halves will play the same frame at
          the same moment, as long as their uptimes are aligned.
        </p>
        <p className="text-[#94a3b8] text-xs leading-relaxed mt-2">
          For optimal synchronicity,{' '}
          <span className="text-[#22d3ee] font-semibold">
            power on or reset both keyboard halves around the same time.
          </span>{' '}
          If one half was already running for minutes before the other boots, the phase offset will
          be visible.
        </p>
      </>
    ),
  },
};

export const PlacementWarningModal: React.FC<PlacementWarningModalProps> = ({
  isOpen,
  type,
  widgetName,
  onDismiss,
  onRemove,
}) => {
  const [dontShowAgain, setDontShowAgain] = useState(false);

  if (!isOpen) return null;

  const c = CONTENT[type];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={() => onDismiss(dontShowAgain)}
      role="dialog"
      aria-modal="true"
      aria-labelledby="placement-warning-title"
    >
      <div
        className="bg-[#131722] rounded-2xl w-full max-w-md overflow-hidden flex flex-col"
        style={{
          border: `1px solid ${c.accentBorder}`,
          boxShadow: `0 16px 48px rgba(0,0,0,0.85), 0 0 24px ${c.accentShadow}`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[#1e2538] bg-[#161a27]">
          <div className="flex items-center gap-3">
            <div
              className="size-10 rounded-xl flex items-center justify-center shrink-0"
              style={{
                background: c.accentBg,
                border: `1px solid ${c.accentBorder}`,
                color: c.accentColor,
                boxShadow: `0 0 12px ${c.accentShadow}`,
              }}
            >
              {c.icon}
            </div>
            <div>
              <h3
                id="placement-warning-title"
                className="text-base font-bold text-white tracking-tight"
              >
                {c.title}
              </h3>
              <p className="text-xs font-medium" style={{ color: c.accentColor }}>
                {c.subtitle(widgetName)}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="text-[#94a3b8] hover:text-white transition-colors cursor-pointer p-1.5 rounded-lg hover:bg-[#19202f]"
            onClick={() => onDismiss(dontShowAgain)}
            aria-label="Close dialog"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-3.5 text-sm">
          {c.body}

          {/* Don't show again */}
          <div className="pt-2 border-t border-[#1e2538]">
            <label className="flex items-center gap-2.5 cursor-pointer select-none group">
              <input
                type="checkbox"
                checked={dontShowAgain}
                onChange={(e) => setDontShowAgain(e.target.checked)}
                className="size-4 rounded border-[#2d3748] bg-[#0b0d13] focus:ring-offset-0 cursor-pointer"
                style={{ accentColor: c.accentColor } as React.CSSProperties}
              />
              <span className="text-xs text-[#94a3b8] group-hover:text-white transition-colors">
                Don't bother me again
              </span>
            </label>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2.5 p-4 bg-[#0e121a] border-t border-[#1e2538]">
          <button
            type="button"
            onClick={() => onRemove(dontShowAgain)}
            className="px-3.5 py-2 rounded-xl text-xs font-medium text-[#94a3b8] hover:text-white bg-[#19202f] hover:bg-[#232c3f] border border-[#2d3748] transition-all cursor-pointer flex items-center gap-1.5"
          >
            <RotateCcw size={13} />
            <span>Remove</span>
          </button>
          <button
            type="button"
            onClick={() => onDismiss(dontShowAgain)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold text-white bg-gradient-to-r ${c.keepGradient} transition-all cursor-pointer flex items-center gap-1.5`}
            style={{ boxShadow: `0 0 16px ${c.keepShadow}` }}
          >
            <CheckCircle2 size={13} />
            <span>{c.keepLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

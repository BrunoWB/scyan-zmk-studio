import React, { useState } from 'react';
import { AlertTriangle, X, CheckCircle2, RotateCcw } from 'lucide-react';

export interface PeripheralMasterWarningModalProps {
  isOpen: boolean;
  widgetName: string;
  onDismiss: (dontShowAgain: boolean) => void;
  onRemove: (dontShowAgain: boolean) => void;
}

export const PeripheralMasterWarningModal: React.FC<PeripheralMasterWarningModalProps> = ({
  isOpen,
  widgetName,
  onDismiss,
  onRemove,
}) => {
  const [dontShowAgain, setDontShowAgain] = useState(false);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={() => onDismiss(dontShowAgain)}
      role="dialog"
      aria-modal="true"
      aria-labelledby="peripheral-warning-title"
    >
      <div
        className="bg-[#131722] border border-[#f2741d]/40 rounded-2xl w-full max-w-md overflow-hidden shadow-[0_16px_48px_rgba(0,0,0,0.85),_0_0_24px_rgba(242,116,29,0.15)] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 border-b border-[#1e2538] bg-[#161a27]">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-[#f2741d]/15 border border-[#f2741d]/40 flex items-center justify-center text-[#f2741d] shadow-[0_0_12px_rgba(242,116,29,0.25)] shrink-0">
              <AlertTriangle size={20} />
            </div>
            <div>
              <h3 id="peripheral-warning-title" className="text-base font-bold text-white tracking-tight">
                Just a heads up!
              </h3>
              <p className="text-xs text-[#f2741d] font-medium">
                {widgetName} on the right side
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

        {/* Modal Body */}
        <div className="p-5 space-y-3.5 text-sm">
          <p className="text-[#cbd5e1] text-xs leading-relaxed">
            The secondary half of a split keyboard usually doesn’t receive live updates from your computer (like battery, active layer, or Bluetooth status).
          </p>

          <p className="text-[#94a3b8] text-xs leading-relaxed">
            You can still place it here, but it might not update in real time. We marked it with a small <span className="text-[#f2741d] font-bold">(!)</span> badge on your preview as a reminder.
          </p>

          {/* Don't bother me again checkbox */}
          <div className="pt-2 border-t border-[#1e2538]">
            <label className="flex items-center gap-2.5 cursor-pointer select-none group">
              <input
                type="checkbox"
                checked={dontShowAgain}
                onChange={e => setDontShowAgain(e.target.checked)}
                className="size-4 rounded border-[#2d3748] bg-[#0b0d13] text-[#f2741d] focus:ring-[#f2741d]/40 focus:ring-offset-0 cursor-pointer accent-[#f2741d]"
              />
              <span className="text-xs text-[#94a3b8] group-hover:text-white transition-colors">
                Don't bother me again
              </span>
            </label>
          </div>
        </div>

        {/* Modal Actions */}
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
            className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-[#f2741d] to-[#e35913] hover:from-[#f59442] hover:to-[#f2741d] shadow-[0_0_16px_rgba(242,116,29,0.35)] transition-all cursor-pointer flex items-center gap-1.5"
          >
            <CheckCircle2 size={13} />
            <span>Keep Widget</span>
          </button>
        </div>
      </div>
    </div>
  );
};


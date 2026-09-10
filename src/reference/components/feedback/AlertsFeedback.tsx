import { useState } from 'react';
import { Button } from '@heroui/react';
import { Bell, Info, AlertTriangle, CheckCircle, XCircle, X } from 'lucide-react';

interface ToastItem {
  id: number;
  type: 'success' | 'error' | 'info';
  title: string;
  message: string;
}

export default function AlertsFeedback() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = (type: 'success' | 'error' | 'info', title: string, message: string) => {
    const id = Date.now();
    const newToast: ToastItem = { id, type, title, message };
    setToasts((prev) => [...prev, newToast]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  const removeToast = (id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <section className="space-y-5 relative">
      {/* Floating Toast Notification Container */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none">
        {toasts.map((toast) => {
          const isSuccess = toast.type === 'success';
          const isError = toast.type === 'error';

          return (
            <div
              key={toast.id}
              className={`pointer-events-auto p-4 rounded-xl border shadow-2xl backdrop-blur-lg flex items-start gap-3 transition-all ${
                isSuccess
                  ? 'bg-[#0b0d13]/95 border-[#00f0ff]/50 text-white shadow-[0_0_24px_rgba(0,240,255,0.2)]'
                  : isError
                  ? 'bg-[#0b0d13]/95 border-[#f2741d]/50 text-white shadow-[0_0_24px_rgba(242,116,29,0.2)]'
                  : 'bg-[#0b0d13]/95 border-[#a953f6]/50 text-white shadow-[0_0_24px_rgba(169,83,246,0.2)]'
              }`}
            >
              {isSuccess && <CheckCircle className="size-5 text-[#00f0ff] shrink-0 mt-0.5" />}
              {isError && <XCircle className="size-5 text-[#f2741d] shrink-0 mt-0.5" />}
              {!isSuccess && !isError && <Info className="size-5 text-[#a953f6] shrink-0 mt-0.5" />}

              <div className="flex-1 min-w-0">
                <h4 className="text-xs font-bold">{toast.title}</h4>
                <p className="text-xs text-[#94a3b8] mt-0.5 leading-relaxed">{toast.message}</p>
              </div>

              <button
                onClick={() => removeToast(toast.id)}
                className="text-[#94a3b8] hover:text-white transition-colors cursor-pointer p-0.5"
              >
                <X className="size-4" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Section Header */}
      <div className="border-b border-[#1e2538] pb-4">
        <div className="flex items-center gap-2">
          <Bell className="size-5 text-[#00f0ff]" />
          <h2 className="text-xl font-bold text-white tracking-tight">Alerts, Toasts &amp; Feedback</h2>
        </div>
        <p className="text-sm text-[#94a3b8] mt-1">
          System state feedback, interactive toast dispatchers, and dual-tone contextual warning banners.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* 1. Toast Triggers Panel */}
        <div className="bg-[#131722] border border-[#1e2538] rounded-2xl p-5 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider">Toast Dispatcher</h3>
            <p className="text-xs text-[#94a3b8] mt-0.5">Click any trigger below to simulate reactive toast alerts.</p>
          </div>

          <div className="flex flex-wrap gap-2.5">
            <Button
              onClick={() => addToast('success', 'Layout Flashed Successfully', 'Active keymap buffer has been written to device SPI flash.')}
              className="bg-[#00f0ff]/10 hover:bg-[#00f0ff] text-[#00f0ff] hover:text-[#0b0d13] border border-[#00f0ff]/30 hover:border-[#00f0ff] text-xs font-semibold py-2 px-3.5 rounded-lg transition-all duration-200 hover:shadow-[0_0_16px_rgba(0,240,255,0.4)] flex items-center gap-2 cursor-pointer"
            >
              <CheckCircle className="size-4" />
              <span>Success Toast (Cyan)</span>
            </Button>

            <Button
              onClick={() => addToast('info', 'ZMK Module Compiled', 'Header schemas and glyph bitmaps validated with 0 warnings.')}
              className="bg-[#a953f6]/15 hover:bg-[#a953f6]/25 text-[#a953f6] border border-[#a953f6]/30 text-xs font-semibold py-2 px-3.5 rounded-lg transition-all flex items-center gap-2 cursor-pointer"
            >
              <Info className="size-4" />
              <span>Info Toast (Violet)</span>
            </Button>

            <Button
              onClick={() => addToast('error', 'Memory Allocation Warning', 'Flash boundary nearing capacity: 83% of allocated sector filled.')}
              className="bg-[#f2741d]/15 hover:bg-[#f2741d]/25 text-[#f2741d] border border-[#f2741d]/30 text-xs font-semibold py-2 px-3.5 rounded-lg transition-all flex items-center gap-2 cursor-pointer"
            >
              <AlertTriangle className="size-4" />
              <span>Warning Toast (Orange)</span>
            </Button>
          </div>

          <div className="text-[11px] font-mono text-[#555e6e]">
            Active toasts dismiss automatically after 4 seconds or can be closed manually.
          </div>
        </div>

        {/* 2. Dual-Tone Informational Callout Banners */}
        <div className="bg-[#131722] border border-[#1e2538] rounded-2xl p-5 space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider">Informational Callout Banners</h3>
            <p className="text-xs text-[#94a3b8] mt-0.5">Persistent dual-tone status blocks from the system specification.</p>
          </div>

          <div className="space-y-3">
            {/* Info Banner (Purple) */}
            <div className="bg-[#a953f6]/10 border border-[#a953f6]/30 rounded-xl p-3.5 flex items-start gap-3">
              <Info className="size-4.5 text-[#a953f6] shrink-0 mt-0.5" />
              <div className="text-xs">
                <span className="font-bold text-white">0x021330:</span>{' '}
                <span className="text-[#f1f5f9]">
                  Graphics core verified: 60 fps limit lock on 128x32 OLED display. Memory written in unitary 1-bit pages.
                </span>
              </div>
            </div>

            {/* Warning Banner (Orange) */}
            <div className="bg-[#f2741d]/10 border border-[#f2741d]/30 rounded-xl p-3.5 flex items-start gap-3">
              <AlertTriangle className="size-4.5 text-[#f2741d] shrink-0 mt-0.5" />
              <div className="text-xs">
                <span className="font-bold text-white">0x021340 Warning:</span>{' '}
                <span className="text-[#f1f5f9]">
                  Flash Limit Mode: Active buffer size is 83% of allocated flash sector. Compaction recommended before next build.
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

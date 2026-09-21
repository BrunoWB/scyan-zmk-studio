import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Monitor, Smartphone, Copy, Check, ExternalLink, Sparkles, ArrowRight } from 'lucide-react';
import { OledBlitterCanvas, type OledBlitterRenderState } from '../tabs/preview/OledBlitterCanvas';
import { getCalculatedDisplayDim, OLED_BORDER_UNITS } from './oledDisplayHelper';
import { useAtlasStore } from '../stores/useAtlasStore';
import { useLayoutStore } from '../stores/useLayoutStore';
import { useUiStore } from '../stores/useUiStore';
import { DEFAULT_CENTRAL_LAYOUT_BLOCKS } from '../types/zmk';

export interface MobileUnsupportedViewProps {
  onDismiss?: () => void;
}

export const MobileUnsupportedView: React.FC<MobileUnsupportedViewProps> = ({ onDismiss }) => {
  const symbolsGrid = useAtlasStore((s) => s.symbolsGrid);
  const symbolSlices = useAtlasStore((s) => s.symbolSlices);
  const fontGrid = useAtlasStore((s) => s.fontGrid);
  const fontGlyphs = useAtlasStore((s) => s.fontGlyphs);
  const fontMappings = useAtlasStore((s) => s.fontMappings);
  const centralBlocks = useLayoutStore((s) => s.centralBlocks);
  const widgetInstances = useLayoutStore((s) => s.widgetInstances);
  const showToast = useUiStore((s) => s.showToast);

  const [copied, setCopied] = useState(false);

  // Looping animation state
  const startTimeRef = useRef<number>(Date.now());
  const [animTimestamp, setAnimTimestamp] = useState(0);
  const [bongoPaw, setBongoPaw] = useState<0 | 1 | 2>(1);
  const [wpm, setWpm] = useState(64);
  const [wpmHistory, setWpmHistory] = useState<number[]>([32, 54, 78, 92, 64]);
  const [currentLayer, setCurrentLayer] = useState(0);

  const layerNames = useMemo(() => ['DESKTOP', 'NO_MOBILE', 'USE_PC', 'SPLIT_ZMK'], []);

  // Use loaded central blocks if available, else fallback to standard layout
  const blocks = useMemo(() => {
    return centralBlocks && centralBlocks.length > 0 ? centralBlocks : DEFAULT_CENTRAL_LAYOUT_BLOCKS;
  }, [centralBlocks]);

  // Scaled dimensions for the cute preview screen (scale = 1.25 gives ~60x240 display)
  const displayDim = useMemo(() => getCalculatedDisplayDim(32, 128, 1.25), []);

  // Animation and typing simulation loop
  useEffect(() => {
    let tick = 0;
    const interval = setInterval(() => {
      tick++;
      const now = Date.now();
      setAnimTimestamp(now - startTimeRef.current);

      // Rhythmically alternate bongo paws (left paw, right paw, with occasional pause)
      if (tick % 16 === 0) {
        setBongoPaw(0); // brief pause
      } else {
        setBongoPaw((prev) => (prev === 1 ? 2 : 1));
      }

      // Oscillate WPM in a wave-like typing burst pattern
      const targetWpm = Math.round(45 + 35 * Math.sin(tick / 4) + 15 * Math.cos(tick / 2));
      setWpm(targetWpm);
      setWpmHistory((prev) => [...prev.slice(-7), targetWpm]);

      // Cycle through custom layers every ~4 seconds (32 ticks * 125ms = 4000ms)
      if (tick % 32 === 0) {
        setCurrentLayer((l) => (l + 1) % layerNames.length);
      }
    }, 125);

    return () => clearInterval(interval);
  }, [layerNames.length]);

  const blitterRenderState: OledBlitterRenderState = useMemo(
    () => ({
      symbolsGrid,
      symbolSlices,
      fontGrid,
      fontGlyphs,
      fontMappings,
      battery: 94,
      outputMode: 'ble',
      bleProfileIndex: 0,
      currentLayer,
      layerNames,
      wpm,
      wpmHistory,
      splitConnected: true,
      capsLock: false,
      customText: 'DESKTOP ONLY',
      instances: widgetInstances,
      bongoState: bongoPaw,
      animationTimestamp: animTimestamp,
      isIdle: false,
    }),
    [
      symbolsGrid,
      symbolSlices,
      fontGrid,
      fontGlyphs,
      fontMappings,
      currentLayer,
      layerNames,
      wpm,
      wpmHistory,
      widgetInstances,
      bongoPaw,
      animTimestamp,
    ]
  );

  const handleCopyLink = async () => {
    try {
      const url = window.location.origin + window.location.pathname;
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        // Fallback for older browsers
        const input = document.createElement('input');
        input.value = url;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
      }
      setCopied(true);
      showToast('success', 'Studio URL copied to clipboard! Open it on your PC.');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      showToast('error', 'Could not copy URL to clipboard.');
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Mobile not supported notice"
      className="fixed inset-0 z-50 flex flex-col items-center justify-between p-6 bg-[#07090e] text-[#f8fafc] overflow-y-auto"
    >
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-[#00f0ff]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-60 h-60 bg-[#a855f7]/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header section */}
      <div className="w-full max-w-sm flex items-center justify-between z-10 pt-2">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-[#00f0ff]/15 border border-[#00f0ff]/40 flex items-center justify-center text-[#00f0ff]">
            <Sparkles size={13} />
          </div>
          <span className="font-mono text-xs font-semibold tracking-wider text-slate-300">
            SCYAN ZMK STUDIO
          </span>
        </div>
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[10px] font-mono">
          <Smartphone size={11} />
          <span>PHONE DETECTED</span>
        </div>
      </div>

      {/* Main card */}
      <div className="w-full max-w-sm flex flex-col items-center text-center my-auto py-6 z-10">
        {/* Animated ZMK OLED Display in Glass Enclosure */}
        <div className="relative mb-6">
          {/* Subtle glow aura behind housing */}
          <div className="absolute inset-0 bg-[#00f0ff]/20 rounded-2xl blur-xl" />

          <div
            className="oled-glass-housing relative rounded-xl shadow-[0_0_30px_rgba(0,240,255,0.35)] border border-[#00f0ff]/60 bg-[#03060c] p-1.5 transition-transform hover:scale-102"
            style={{
              width: `${displayDim.displayW + OLED_BORDER_UNITS * 2}px`,
              height: `${displayDim.displayH + OLED_BORDER_UNITS * 2}px`,
            }}
          >
            <div
              style={{
                position: 'relative',
                width: `${displayDim.displayW}px`,
                height: `${displayDim.displayH}px`,
              }}
            >
              <OledBlitterCanvas
                blocks={blocks}
                vWidth={32}
                vHeight={128}
                displayDim={displayDim}
                side="central"
                renderState={blitterRenderState}
              />
            </div>
          </div>

          <div className="mt-2.5 flex items-center justify-center gap-1.5 text-[10px] font-mono text-[#00f0ff]/80">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00f0ff] animate-ping" />
            <span>ZMK 32x128 OLED SIMULATION</span>
          </div>
        </div>

        {/* Message Content */}
        <h1 className="text-xl font-bold tracking-tight text-white mb-2">
          Desktop Required
        </h1>

        <p className="text-xs sm:text-sm text-slate-400 leading-relaxed mb-6 px-2">
          Scyan ZMK Studio is an IDE designed for split keyboards, 1bpp raster pixel art editing,
          and ZMK firmware compilation. It requires a wider desktop display and mouse precision.
        </p>

        {/* Primary Call to Action: Copy Link */}
        <div className="w-full flex flex-col gap-2.5">
          <button
            onClick={handleCopyLink}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#00f0ff] to-[#00b4d8] text-[#07090e] font-semibold text-xs tracking-wide shadow-[0_0_20px_rgba(0,240,255,0.4)] hover:brightness-110 active:scale-98 transition-all cursor-pointer"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            <span>{copied ? 'Link Copied to Clipboard!' : 'Copy Link to Open on PC'}</span>
          </button>

          <a
            href="https://github.com/BrunoWB/scyan-zmk-studio"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-center gap-1.5 py-2 px-4 rounded-xl bg-white/5 border border-white/10 text-slate-300 font-mono text-xs hover:bg-white/10 hover:text-white transition-all"
          >
            <ExternalLink size={12} />
            <span>View GitHub Repository</span>
          </a>
        </div>
      </div>

      {/* Footer / Bypass for debugging */}
      <div className="w-full max-w-sm flex flex-col items-center gap-2 z-10 pb-2">
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
          >
            <span>Continue to desktop interface anyway</span>
            <ArrowRight size={11} />
          </button>
        )}
        <div className="flex items-center gap-1.5 text-[10px] text-slate-600 font-mono">
          <Monitor size={11} />
          <span>Recommended resolution: 1280x720 or higher</span>
        </div>
      </div>
    </div>
  );
};


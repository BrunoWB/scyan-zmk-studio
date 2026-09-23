import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Construction, ExternalLink, Sparkles, ArrowRight, GitBranch, AlertTriangle } from 'lucide-react';
import { OledBlitterCanvas, type OledBlitterRenderState } from '../tabs/preview/OledBlitterCanvas';
import { getCalculatedDisplayDim, OLED_BORDER_UNITS } from './oledDisplayHelper';
import { useAtlasStore } from '../stores/useAtlasStore';
import { useLayoutStore } from '../stores/useLayoutStore';
import { DEFAULT_CENTRAL_LAYOUT_BLOCKS } from '../types/zmk';
import { MAINTENANCE_CONFIG } from '../config/maintenance';

export interface MaintenanceViewProps {
  onDismiss?: () => void;
}

export const MaintenanceView: React.FC<MaintenanceViewProps> = ({ onDismiss }) => {
  const symbolsGrid = useAtlasStore((s) => s.symbolsGrid);
  const symbolSlices = useAtlasStore((s) => s.symbolSlices);
  const fontGrid = useAtlasStore((s) => s.fontGrid);
  const fontGlyphs = useAtlasStore((s) => s.fontGlyphs);
  const fontMappings = useAtlasStore((s) => s.fontMappings);
  const centralBlocks = useLayoutStore((s) => s.centralBlocks);
  const widgetInstances = useLayoutStore((s) => s.widgetInstances);

  // Looping animation state
  const startTimeRef = useRef<number>(Date.now());
  const [animTimestamp, setAnimTimestamp] = useState(0);
  const [bongoPaw, setBongoPaw] = useState<0 | 1 | 2>(1);
  const [wpm, setWpm] = useState(72);
  const [wpmHistory, setWpmHistory] = useState<number[]>([40, 60, 85, 95, 72]);
  const [currentLayer, setCurrentLayer] = useState(0);

  const layerNames = useMemo(
    () => ['MAINTENANCE', 'MODULE_DEV', 'UNDER_CONSTR', 'USE_NIGHTLY'],
    []
  );

  // Use loaded central blocks if available, else fallback to standard layout
  const blocks = useMemo(() => {
    return centralBlocks && centralBlocks.length > 0 ? centralBlocks : DEFAULT_CENTRAL_LAYOUT_BLOCKS;
  }, [centralBlocks]);

  // Scaled dimensions for the preview display (scale = 1.25 gives ~60x240 display)
  const displayDim = useMemo(() => getCalculatedDisplayDim(32, 128, 1.25), []);

  // Animation and typing simulation loop
  useEffect(() => {
    let tick = 0;
    const interval = setInterval(() => {
      tick++;
      const now = Date.now();
      setAnimTimestamp(now - startTimeRef.current);

      // Rhythmically alternate bongo paws
      if (tick % 16 === 0) {
        setBongoPaw(0); // brief pause
      } else {
        setBongoPaw((prev) => (prev === 1 ? 2 : 1));
      }

      // Oscillate WPM in wave-like burst pattern
      const targetWpm = Math.round(50 + 30 * Math.sin(tick / 4) + 12 * Math.cos(tick / 2));
      setWpm(targetWpm);
      setWpmHistory((prev) => [...prev.slice(-7), targetWpm]);

      // Cycle through diagnostic layers every ~4 seconds
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
      battery: 88,
      outputMode: 'ble',
      bleProfileIndex: 0,
      currentLayer,
      layerNames,
      wpm,
      wpmHistory,
      splitConnected: true,
      capsLock: false,
      customText: 'MAINTENANCE',
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

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Maintenance notice"
      className="fixed inset-0 z-50 flex flex-col items-center justify-between p-6 bg-[#07090e] text-[#f8fafc] overflow-y-auto"
    >
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-60 h-60 bg-[#00f0ff]/10 rounded-full blur-3xl pointer-events-none" />

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
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-400 text-[10px] font-mono font-medium shadow-[0_0_10px_rgba(245,158,11,0.2)]">
          <Construction size={11} className="animate-pulse" />
          <span>MAINTENANCE MODE</span>
        </div>
      </div>

      {/* Main card */}
      <div className="w-full max-w-sm flex flex-col items-center text-center my-auto py-6 z-10">
        {/* Animated ZMK OLED Display in Glass Enclosure */}
        <div className="relative mb-6">
          {/* Amber glow aura behind housing */}
          <div className="absolute inset-0 bg-amber-500/20 rounded-2xl blur-xl" />

          <div
            className="oled-glass-housing relative rounded-xl shadow-[0_0_30px_rgba(245,158,11,0.35)] border border-amber-500/60 bg-[#03060c] p-1.5 transition-transform hover:scale-102"
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

          <div className="mt-2.5 flex items-center justify-center gap-1.5 text-[10px] font-mono text-amber-400/90">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
            <span>ZMK 32x128 OLED SIMULATION • DIAGNOSTIC</span>
          </div>
        </div>

        {/* Message Content */}
        <h1 className="text-xl font-bold tracking-tight text-white mb-2">
          {MAINTENANCE_CONFIG.title}
        </h1>

        <p className="text-xs sm:text-sm text-slate-400 leading-relaxed mb-6 px-2">
          {MAINTENANCE_CONFIG.subtitle}
        </p>

        {/* Call to Actions */}
        <div className="w-full flex flex-col gap-2.5">
          <a
            href={MAINTENANCE_CONFIG.nightlyUrl}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-400 via-amber-500 to-[#f2741d] text-[#07090e] font-semibold text-xs tracking-wide shadow-[0_0_20px_rgba(245,158,11,0.4)] hover:brightness-110 active:scale-98 transition-all"
          >
            <GitBranch size={14} />
            <span>Try Nightly Build</span>
            <ExternalLink size={12} className="opacity-75" />
          </a>

          <a
            href={MAINTENANCE_CONFIG.moduleRepoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-center gap-1.5 py-2 px-4 rounded-xl bg-white/5 border border-white/10 text-slate-300 font-mono text-xs hover:bg-white/10 hover:text-white transition-all"
          >
            <ExternalLink size={12} />
            <span>View scyan-zmk-module on GitHub</span>
          </a>
        </div>
      </div>

      {/* Footer / Bypass */}
      <div className="w-full max-w-sm flex flex-col items-center gap-2 z-10 pb-2">
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
          >
            <span>Continue to studio anyway (unstable mode)</span>
            <ArrowRight size={11} />
          </button>
        )}
        <div className="flex items-center gap-1.5 text-[10px] text-slate-600 font-mono">
          <AlertTriangle size={11} className="text-amber-500/70" />
          <span>Active firmware changes in progress</span>
        </div>
      </div>
    </div>
  );
};

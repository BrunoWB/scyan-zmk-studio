import { useState } from 'react';
import { Sparkles, Copy, Check, Eye, Layers, Flame, SlidersHorizontal } from 'lucide-react';
import { Chip, Button } from '@heroui/react';
import { BrandIdentityLogo } from '../../../components/brand/BrandIdentityLogo';

export default function LogoShowcase() {
  const [copied, setCopied] = useState<boolean>(false);
  const [forceState, setForceState] = useState<'auto' | 'rest' | 'hover'>('auto');
  const [isHeroHovered, setIsHeroHovered] = useState(false);

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isAwakened = forceState === 'hover' || (forceState === 'auto' && isHeroHovered);

  const jsxSnippet = `<div className="inline-flex items-center gap-3 group cursor-pointer select-none">
  {/* Wolf Mascot */}
  <div className="relative flex items-center justify-center shrink-0">
    {/* Rest state: radial gradient with secondary color (#a953f6) - NO glow */}
    <div
      className="absolute -inset-2 rounded-full transition-opacity duration-500 pointer-events-none group-hover:opacity-0"
      style={{
        background:
          'radial-gradient(circle at center, rgba(169, 83, 246, 0.32) 0%, rgba(169, 83, 246, 0.08) 52%, transparent 72%)',
      }}
    />

    {/* Hover state: pulsing atmospheric orange glow on background */}
    <div
      className="absolute -inset-3.5 rounded-full blur-md opacity-0 group-hover:opacity-100 group-hover:animate-[pulseOrangeGlow_1.5s_ease-in-out_infinite] transition-all duration-300 pointer-events-none"
      style={{
        background:
          'radial-gradient(circle at center, rgba(245, 148, 66, 0.65) 0%, rgba(245, 148, 66, 0.22) 50%, transparent 75%)',
      }}
    />

    {/* Wolf SVG with 1bpp geometry */}
    <svg viewBox="0 0 31 29" width={28} height={26} className="relative z-10" style={{ imageRendering: 'pixelated' }}>
      <defs>
        <radialGradient id="brandWolfGrad" cx="100%" cy="100%" r="140%" gradientUnits="userSpaceOnUse" fx="31" fy="29">
          <stop offset="0%" stopColor="#a953f6" />
          <stop offset="100%" stopColor="#00f0ff" />
        </radialGradient>
        <filter id="brandEyeGlow" x="-200%" y="-200%" width="500%" height="500%">
          <feDropShadow dx="0" dy="0" stdDeviation="0.5" floodColor="#f59442" floodOpacity="1" />
        </filter>
      </defs>
      <path d="M6,0h2v1h-2z..." fill="url(#brandWolfGrad)" />

      {/* Orange pupils on hover only with reverse-pulsing glow */}
      <path
        d="M12,14h1v2h-1zM20,14h1v2h-1z"
        fill="#f59442"
        className="opacity-0 group-hover:opacity-100 group-hover:animate-[pulseOrangeReverse_1.5s_ease-in-out_infinite] transition-all duration-300"
        style={{ filter: 'url(#brandEyeGlow)' }}
      />
    </svg>
  </div>

  {/* Name and Underline Container */}
  <div className="flex flex-col justify-center">
    <div className="flex items-center gap-2">
      <span className="font-extrabold tracking-widest text-white text-base font-sans">SCYAN</span>
      <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border border-[#00f0ff]/30 bg-[#00f0ff]/10 text-[#00f0ff] group-hover:border-[#f59442]/50 group-hover:text-[#f59442] group-hover:bg-[#f59442]/10 transition-all duration-300">
        STUDIO
      </span>
    </div>

    {/* Line strictly under the name with animated gradient showing hidden orange */}
    <div className="mt-1 h-[2px] w-full overflow-hidden rounded-full">
      <div
        className="h-full w-full rounded-full transition-all duration-300 group-hover:animate-[brandLineShift_2s_linear_infinite] group-hover:shadow-[0_0_8px_rgba(245,148,66,0.7)]"
        style={{
          background: 'linear-gradient(90deg, #00f0ff 0%, #a953f6 35%, #f59442 50%, #a953f6 65%, #00f0ff 100%)',
          backgroundSize: '250% 100%',
          backgroundPosition: '0% 50%',
        }}
      />
    </div>
  </div>
</div>`;

  return (
    <section className="space-y-6">
      {/* Section Header */}
      <div className="border-b border-[#1e2538] pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <Sparkles className="size-5 text-[#00f0ff]" />
            <h2 className="text-xl font-bold text-white tracking-tight">
              Brand Identity Logo
            </h2>
            <Chip
              size="sm"
              className="bg-[#a953f6]/15 text-[#a953f6] border border-[#a953f6]/40 text-[11px] font-mono font-semibold px-2 h-5"
            >
              Active Identity
            </Chip>
          </div>
          <p className="text-sm text-[#94a3b8] mt-1 max-w-2xl">
            Typographic wordmark with 31×29 pixel Wolf mascot. Featuring a secondary-color radial backdrop, awakened orange eyes, pulsing background aura, and an animated horizon line anchored strictly under the name.
          </p>
        </div>

        {/* State Simulator Controls */}
        <div className="flex items-center gap-1.5 bg-[#131722] border border-[#1e2538] p-1.5 rounded-xl shrink-0">
          <span className="text-[11px] font-mono text-[#64748b] px-2 flex items-center gap-1">
            <SlidersHorizontal size={12} />
            <span className="hidden sm:inline">State:</span>
          </span>
          <button
            type="button"
            onClick={() => setForceState('auto')}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              forceState === 'auto'
                ? 'bg-[#00f0ff]/15 text-[#00f0ff] border border-[#00f0ff]/30 font-semibold'
                : 'text-[#94a3b8] hover:text-white'
            }`}
          >
            Auto (Hover)
          </button>
          <button
            type="button"
            onClick={() => setForceState('rest')}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              forceState === 'rest'
                ? 'bg-[#a953f6]/20 text-[#a953f6] border border-[#a953f6]/40 font-semibold'
                : 'text-[#94a3b8] hover:text-white'
            }`}
          >
            Rest Mode
          </button>
          <button
            type="button"
            onClick={() => setForceState('hover')}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center gap-1 ${
              forceState === 'hover'
                ? 'bg-[#f59442]/20 text-[#f59442] border border-[#f59442]/40 font-semibold'
                : 'text-[#94a3b8] hover:text-white'
            }`}
          >
            <Flame size={12} />
            <span>Awakened</span>
          </button>
        </div>
      </div>

      {/* Hero Interactive Stage */}
      <div
        onMouseEnter={() => setIsHeroHovered(true)}
        onMouseLeave={() => setIsHeroHovered(false)}
        className="bg-[#0e1118] border border-[#1e2538] hover:border-[#00f0ff]/40 rounded-2xl p-8 sm:p-12 flex flex-col items-center justify-center relative overflow-hidden transition-all shadow-xl group cursor-pointer"
      >
        {/* Subtle grid background */}
        <div
          className="absolute inset-0 opacity-15 pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(#00f0ff 0.75px, transparent 0.75px)',
            backgroundSize: '16px 16px',
          }}
        />

        {/* Ambient atmospheric corner glows */}
        <div
          className={`absolute -top-16 -left-16 size-48 rounded-full blur-3xl pointer-events-none transition-all duration-700 ${
            isAwakened ? 'bg-[#f59442]/20 scale-125' : 'bg-[#00f0ff]/10'
          }`}
        />
        <div
          className={`absolute -bottom-16 -right-16 size-48 rounded-full blur-3xl pointer-events-none transition-all duration-700 ${
            isAwakened ? 'bg-[#f59442]/20 scale-125' : 'bg-[#a953f6]/10'
          }`}
        />

        {/* Centerpiece Hero Logo */}
        <div className="relative z-10 py-6 scale-125 sm:scale-150 transition-transform duration-300">
          <BrandIdentityLogo
            size={40}
            isHovered={forceState === 'auto' ? undefined : forceState === 'hover'}
          />
        </div>

        {/* Status prompt */}
        <div className="relative z-10 mt-8 flex items-center gap-2">
          <span
            className={`inline-block size-2 rounded-full transition-colors duration-300 ${
              isAwakened ? 'bg-[#f59442] shadow-[0_0_8px_#f59442]' : 'bg-[#a953f6]'
            }`}
          />
          <span className="text-xs font-mono text-[#94a3b8]">
            {isAwakened
              ? 'Telemetry Active: Eyes Awakened (#F59442 Warning Hover) • Reverse Glow • Horizon Animated'
              : 'Rest State: Secondary Radial Backdrop (#A953F6) • Zero Glow Bloom • Orange Hidden'}
          </span>
        </div>
      </div>

      {/* Side-by-Side State Comparison */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Card 1: Rest State */}
        <div className="bg-[#131722] border border-[#1e2538] rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-[#a953f6]" />
              <h3 className="text-sm font-bold text-white font-mono">Rest State</h3>
            </div>
            <Chip
              size="sm"
              className="text-[10px] font-mono bg-[#a953f6]/10 text-[#a953f6] border border-[#a953f6]/30 px-2 h-5"
            >
              Zero Glow / Crisp
            </Chip>
          </div>

          <div className="h-32 bg-[#0b0d13] border border-[#1e2538] rounded-xl flex items-center justify-center relative overflow-hidden">
            <BrandIdentityLogo size={32} isHovered={false} />
          </div>

          <div className="space-y-1 text-xs text-[#94a3b8] font-mono">
            <p className="flex items-center gap-1.5">
              <span className="text-[#00f0ff]">✓</span>
              <span>No glow on the back of the wolf; crisp secondary radial aura</span>
            </p>
            <p className="flex items-center gap-1.5">
              <span className="text-[#00f0ff]">✓</span>
              <span>Wolf body filled with Cyan → Violet radial gradient</span>
            </p>
            <p className="flex items-center gap-1.5">
              <span className="text-[#00f0ff]">✓</span>
              <span>Line under the name; hidden orange stays masked</span>
            </p>
          </div>
        </div>

        {/* Card 2: Awakened Hover State */}
        <div className="bg-[#131722] border border-[#f59442]/40 rounded-2xl p-5 space-y-4 shadow-[0_0_20px_rgba(245,148,66,0.08)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-[#f59442] shadow-[0_0_6px_#f59442]" />
              <h3 className="text-sm font-bold text-white font-mono">Hover / Awakened State</h3>
            </div>
            <Chip
              size="sm"
              className="text-[10px] font-mono bg-[#f59442]/15 text-[#f59442] border border-[#f59442]/40 px-2 h-5"
            >
              Active Interaction
            </Chip>
          </div>

          <div className="h-32 bg-[#0b0d13] border border-[#f59442]/30 rounded-xl flex items-center justify-center relative overflow-hidden">
            <BrandIdentityLogo size={32} isHovered={true} />
          </div>

          <div className="space-y-1 text-xs text-[#94a3b8] font-mono">
            <p className="flex items-center gap-1.5">
              <span className="text-[#f59442]">✓</span>
              <span>Eyes illuminate in Warning Hover orange (#F59442) with reverse-pulse glow</span>
            </p>
            <p className="flex items-center gap-1.5">
              <span className="text-[#f59442]">✓</span>
              <span>Pulsing atmospheric orange glow on background (counter-phase to eyes)</span>
            </p>
            <p className="flex items-center gap-1.5">
              <span className="text-[#f59442]">✓</span>
              <span>Line gradient animates dynamically, cycling Warning Hover orange</span>
            </p>
          </div>
        </div>
      </div>

      {/* Header Context Integration Preview */}
      <div className="bg-[#131722] border border-[#1e2538] rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Eye className="size-4 text-[#00f0ff]" />
            <h3 className="text-sm font-bold text-white font-mono">
              In Header Context Preview
            </h3>
          </div>
          <span className="text-xs text-[#64748b] font-mono">54px Desktop Bar</span>
        </div>

        {/* Mockup Header */}
        <div className="h-14 bg-[#0b0d13] rounded-xl border border-[#232c3f] px-5 flex items-center justify-between shadow-inner">
          <BrandIdentityLogo size={24} />

          <div className="flex items-center gap-4 text-xs font-mono text-[#64748b]">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-lg bg-[#131722] border border-[#1e2538]">
              <span className="size-2 rounded-full bg-[#00f0ff]" />
              <span className="text-[#94a3b8]">main</span>
            </div>
            <span className="text-[11px] text-[#94a3b8]">scyan-zmk-studio</span>
          </div>
        </div>
      </div>

      {/* Scale Variations Matrix */}
      <div className="bg-[#131722] border border-[#1e2538] rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="size-4 text-[#a953f6]" />
            <h3 className="text-sm font-bold text-white font-mono">
              Scale Variations Matrix
            </h3>
          </div>
          <span className="text-xs text-[#64748b] font-mono">1bpp Crisp Geometry</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'Compact Header', size: 20 },
            { label: 'Standard Nav', size: 28 },
            { label: 'Card Hero', size: 38 },
            { label: 'Display High-Res', size: 48 },
          ].map(v => (
            <div
              key={v.label}
              className="bg-[#0b0d13] border border-[#1e2538] hover:border-[#00f0ff]/40 rounded-xl p-4 flex flex-col justify-between space-y-4 group transition-all"
            >
              <div className="flex items-center justify-between text-[11px] font-mono text-[#64748b]">
                <span>{v.label}</span>
                <span>{v.size}px</span>
              </div>
              <div className="py-2 flex items-center justify-center">
                <BrandIdentityLogo size={v.size} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Code Snippet & Copy Actions */}
      <div className="bg-[#0e1118] border border-[#1e2538] rounded-2xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold text-white">JSX Implementation</span>
            <span className="text-[10px] font-mono text-[#64748b]">Reusable Component</span>
          </div>
          <Button
            size="sm"
            onClick={() => copyCode(jsxSnippet)}
            className="text-xs h-8 bg-[#19202f] hover:bg-[#232c3f] text-[#cbd5e1] hover:text-white border border-[#2d3748] rounded-lg cursor-pointer flex items-center gap-1.5"
          >
            {copied ? (
              <>
                <Check size={13} className="text-[#00f0ff]" />
                <span>Copied JSX!</span>
              </>
            ) : (
              <>
                <Copy size={13} />
                <span>Copy Brand JSX</span>
              </>
            )}
          </Button>
        </div>

        <pre className="p-4 rounded-xl bg-[#08090d] border border-[#1a2030] text-[11px] font-mono text-[#94a3b8] overflow-x-auto leading-relaxed max-h-60">
          <code>{jsxSnippet}</code>
        </pre>
      </div>
    </section>
  );
}

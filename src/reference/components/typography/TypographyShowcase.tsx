import { useState } from 'react';
import { Chip } from '@heroui/react';
import { Type, Code, Copy, Check } from 'lucide-react';

export default function TypographyShowcase() {
  const [copiedCode, setCopiedCode] = useState(false);

  const sampleCode = `const display_render_pipeline = (ctx) => {
  return {
    resolution: "128x32",
    mode: "OLED_HIGH_CONTRAST",
    activeLayer: 2,
    palette: {
      primary: "#00F0FF",
      secondary: "#A953F6",
      warning: "#F2741D"
    }
  };
};`;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(sampleCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <section className="space-y-5">
      {/* Header */}
      <div className="border-b border-[#1e2538] pb-4">
        <div className="flex items-center gap-2">
          <Type className="size-5 text-[#a953f6]" />
          <h2 className="text-xl font-bold text-white tracking-tight">Typography Hierarchy</h2>
        </div>
        <p className="text-sm text-[#94a3b8] mt-1">
          Dual typographic system: Modern Sans for application UI + Monospace for coordinates, memory and tokens.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Scale Hierarchy Card */}
        <div className="space-y-3 bg-[#131722] border border-[#1e2538] rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4 flex items-center justify-between">
            <span>Font Scale &amp; Contrast</span>
            <Chip className="bg-[#a953f6]/15 text-[#a953f6] border border-[#a953f6]/30 text-[10px] font-mono h-5">
              Sans-Serif
            </Chip>
          </h3>

          <div className="space-y-4">
            <div className="border-b border-[#1e2538] pb-3">
              <div className="flex items-center justify-between text-[11px] font-mono text-[#94a3b8] mb-1">
                <span>H1 Page Header</span>
                <span>28px • SemiBold</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                Scyan ZMK Studio - Display IDE
              </h1>
            </div>

            <div className="border-b border-[#1e2538] pb-3">
              <div className="flex items-center justify-between text-[11px] font-mono text-[#94a3b8] mb-1">
                <span>H2 Section Header</span>
                <span>20px • SemiBold</span>
              </div>
              <h2 className="text-lg sm:text-xl font-semibold text-white tracking-tight">
                Layout Blocks &amp; OLED Pages
              </h2>
            </div>

            <div className="border-b border-[#1e2538] pb-3">
              <div className="flex items-center justify-between text-[11px] font-mono text-[#94a3b8] mb-1">
                <span>H3 Subsection Header</span>
                <span>15px • Medium</span>
              </div>
              <h3 className="text-sm sm:text-base font-medium text-[#f1f5f9]">
                Widget Template Library &amp; Component States
              </h3>
            </div>

            <div>
              <div className="flex items-center justify-between text-[11px] font-mono text-[#94a3b8] mb-1">
                <span>Body UI Text</span>
                <span>13px • Regular</span>
              </div>
              <p className="text-xs sm:text-sm text-[#94a3b8] leading-relaxed">
                Configurable interface widgets and customized displays for standard 128x32 / 128x64 display drivers.
                Optimized for low-latency firmware rendering and high visual clarity.
              </p>
            </div>
          </div>
        </div>

        {/* Monospace Code Preview Card */}
        <div className="bg-[#131722] border border-[#1e2538] rounded-2xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Code className="size-4 text-[#00f0ff]" />
                <h3 className="text-sm font-semibold text-white uppercase tracking-wider">Monospace Code &amp; Syntactical Pipeline</h3>
              </div>
              <button
                onClick={handleCopyCode}
                className="flex items-center gap-1.5 text-xs text-[#94a3b8] hover:text-[#00f0ff] transition-colors cursor-pointer bg-[#0b0d13] px-2.5 py-1 rounded-lg border border-[#1e2538]"
              >
                {copiedCode ? <Check className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5" />}
                <span>{copiedCode ? 'Copied' : 'Copy'}</span>
              </button>
            </div>

            <div className="bg-[#0b0d13] border border-[#1e2538] rounded-xl p-4 font-mono text-xs overflow-x-auto leading-relaxed shadow-inner">
              <div className="text-[#94a3b8]">// Device Render Context</div>
              <div>
                <span className="text-[#a953f6]">const</span>{' '}
                <span className="text-[#00f0ff]">display_render_pipeline</span> = (
                <span className="text-[#f2741d]">ctx</span>) =&gt; &#123;
              </div>
              <div className="pl-4">
                <span className="text-[#a953f6]">return</span> &#123;
              </div>
              <div className="pl-8">
                <span className="text-[#94a3b8]">resolution:</span>{' '}
                <span className="text-[#f2741d]">"128x32"</span>,
              </div>
              <div className="pl-8">
                <span className="text-[#94a3b8]">mode:</span>{' '}
                <span className="text-[#00f0ff]">"OLED_HIGH_CONTRAST"</span>,
              </div>
              <div className="pl-8">
                <span className="text-[#94a3b8]">activeLayer:</span>{' '}
                <span className="text-[#a953f6]">2</span>,
              </div>
              <div className="pl-8">
                <span className="text-[#94a3b8]">palette:</span> &#123;
              </div>
              <div className="pl-12">
                <span className="text-[#94a3b8]">primary:</span>{' '}
                <span className="text-[#00f0ff]">"#00F0FF"</span>,
              </div>
              <div className="pl-12">
                <span className="text-[#94a3b8]">secondary:</span>{' '}
                <span className="text-[#a953f6]">"#A953F6"</span>,
              </div>
              <div className="pl-12">
                <span className="text-[#94a3b8]">warning:</span>{' '}
                <span className="text-[#f2741d]">"#F2741D"</span>
              </div>
              <div className="pl-8">&#125;</div>
              <div className="pl-4">&#125;;</div>
              <div>&#125;;</div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[#1e2538] flex items-center justify-between text-xs text-[#94a3b8]">
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-[#00f0ff]"></span>
              JetBrains Mono / Tabular numbers
            </span>
            <span className="font-mono text-[11px] text-[#555e6e]">UTF-8 • 60 FPS Engine</span>
          </div>
        </div>
      </div>
    </section>
  );
}

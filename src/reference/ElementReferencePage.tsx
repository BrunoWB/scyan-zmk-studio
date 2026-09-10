import { useState } from 'react';
import PaletteShowcase from './components/tokens/PaletteShowcase';
import TypographyShowcase from './components/typography/TypographyShowcase';
import ActionControls from './components/actions/ActionControls';
import FormControls from './components/forms/FormControls';
import BadgeShowcase from './components/badges/BadgeShowcase';
import EntityCards from './components/cards/EntityCards';
import AtlasList from './components/atlas/AtlasList';
import AlertsFeedback from './components/feedback/AlertsFeedback';
import LogoShowcase from './components/brand/LogoShowcase';
import { Chip, Button } from '@heroui/react';
import { ArrowUpRight } from 'lucide-react';

interface ElementReferencePageProps {
  onOpenCommandPalette?: () => void;
}

export default function ElementReferencePage({ onOpenCommandPalette: _onOpenCommandPalette }: ElementReferencePageProps) {
  const [activeTab, setActiveTab] = useState('all');

  const scrollToSection = (id: string) => {
    setActiveTab(id);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const navSections = [
    { id: 'logo', label: 'Brand Identity Logo' },
    { id: 'tokens', label: 'Color Tokens' },
    { id: 'typography', label: 'Typography' },
    { id: 'actions', label: 'Buttons & Actions' },
    { id: 'forms', label: 'Form Controls' },
    { id: 'badges', label: 'Badges & Status' },
    { id: 'cards', label: 'Items Cards' },
    { id: 'atlas', label: 'Atlas List' },
    { id: 'feedback', label: 'Alerts & Feedback' },
  ];

  return (
    <div className="w-full text-[#f1f5f9] flex flex-col selection:bg-[#00f0ff]/25 selection:text-[#00f0ff]">
      {/* Hero Header Banner */}
      <div className="border-b border-[#1e2538] bg-gradient-to-b from-[#131722]/60 to-transparent py-10 px-6">
        <div className="max-w-7xl mx-auto space-y-4">
          <div className="flex items-center gap-2.5 flex-wrap">
            <Chip className="bg-[#00f0ff]/15 text-[#00f0ff] border border-[#00f0ff]/30 text-xs font-mono font-semibold px-2.5 h-6">
              HeroUI v3 Engine
            </Chip>
            <Chip className="bg-[#a953f6]/15 text-[#a953f6] border border-[#a953f6]/30 text-xs font-mono font-semibold px-2.5 h-6">
              Tailwind CSS v4
            </Chip>
            <Chip className="bg-[#f2741d]/15 text-[#f2741d] border border-[#f2741d]/30 text-xs font-mono font-semibold px-2.5 h-6">
              Tri-Tone Architecture
            </Chip>
          </div>

          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                Modern Design System Showcase
              </h1>
              <p className="text-sm sm:text-base text-[#94a3b8] mt-2 max-w-2xl leading-relaxed">
                A clean, modern React user interface built on the extracted tri-tone palette 
                (<span className="text-[#00f0ff] font-medium">Electric Cyan</span>,{' '}
                <span className="text-[#a953f6] font-medium">Vivid Violet</span>, and{' '}
                <span className="text-[#f2741d] font-medium">Tangerine Orange</span>) 
                and structured using official HeroUI v3 compound primitives.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                onClick={() => scrollToSection('tokens')}
                size="sm"
                className="bg-[#19202f] hover:bg-[#232c3f] border border-[#2d3748] text-white text-xs font-medium px-4 h-9 rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
              >
                <span>Explore Tokens</span>
                <ArrowUpRight className="size-3.5 text-[#00f0ff]" />
              </Button>
            </div>
          </div>

          {/* Quick Navigation Scroll Bar */}
          <div className="flex items-center gap-2 pt-4 overflow-x-auto pb-1 no-scrollbar border-t border-[#1e2538]/60">
            {navSections.map((sec) => (
              <button
                key={sec.id}
                onClick={() => scrollToSection(sec.id)}
                className={`text-xs font-mono px-3 py-1.5 rounded-lg whitespace-nowrap transition-all cursor-pointer ${
                  activeTab === sec.id
                    ? 'bg-[#00f0ff]/15 text-[#00f0ff] border border-[#00f0ff]/40 font-semibold shadow-[0_0_8px_rgba(0,240,255,0.2)]'
                    : 'text-[#94a3b8] hover:text-white hover:bg-[#131722] border border-transparent'
                }`}
              >
                {sec.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-7xl mx-auto px-6 py-10 space-y-16 flex-1 w-full">
        {/* Section: Brand Identity Logo */}
        <div id="logo">
          <LogoShowcase />
        </div>

        {/* Section 1: Tokens & Palette */}
        <div id="tokens">
          <PaletteShowcase />
        </div>

        {/* Section 2: Typography Hierarchy */}
        <div id="typography">
          <TypographyShowcase />
        </div>

        {/* Section 3: Buttons & Action Controls */}
        <div id="actions">
          <ActionControls />
        </div>

        {/* Section 4: Form Controls & Steppers */}
        <div id="forms">
          <FormControls />
        </div>

        {/* Section 5: Badges, Tags & Status Chips */}
        <div id="badges">
          <BadgeShowcase />
        </div>

        {/* Section 6: Items Cards */}
        <div id="cards">
          <EntityCards />
        </div>

        {/* Section 7: Atlas List */}
        <div id="atlas">
          <AtlasList />
        </div>

        {/* Section 8: Alerts, Toasts & Feedback */}
        <div id="feedback">
          <AlertsFeedback />
        </div>
      </div>

      {/* Showcase Footer */}
      <footer className="border-t border-[#1e2538] bg-[#0b0d13] py-8 px-6 mt-12 text-xs text-[#94a3b8]">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-[#00f0ff]"></span>
            <span className="font-semibold text-white">Scyan Design System</span>
            <span>• Built with HeroUI v3 &amp; React 19</span>
          </div>

          <div className="flex items-center gap-4 text-[#555e6e]">
            <span>Level 0: #0B0D13</span>
            <span>•</span>
            <span className="text-[#00f0ff]">Cyan: #00F0FF</span>
            <span>•</span>
            <span className="text-[#a953f6]">Purple: #A953F6</span>
            <span>•</span>
            <span className="text-[#f2741d]">Orange: #F2741D</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

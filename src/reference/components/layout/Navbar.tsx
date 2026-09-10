import { Chip, Button, Kbd } from '@heroui/react';
import { Cpu, Search, Zap } from 'lucide-react';

interface NavbarProps {
  onSearchClick?: () => void;
  activeSection?: string;
  onNavigate?: (id: string) => void;
  onConnectClick?: () => void;
  isConnected?: boolean;
  statusText?: string;
}

export default function Navbar({
  onSearchClick,
  onConnectClick,
  isConnected = false,
  statusText = 'ZMK IDE Active'
}: NavbarProps) {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-[#1e2538] bg-[#0b0d13]/85 backdrop-blur-md px-6 py-3.5 transition-all">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Left: Brand & Mode */}
        <div className="flex items-center gap-3">
          <div className="size-9 rounded-lg bg-gradient-to-br from-[#00f0ff] to-[#a953f6] p-[1.5px] flex items-center justify-center shadow-[0_0_16px_rgba(0,240,255,0.3)]">
            <div className="size-full bg-[#0b0d13] rounded-[6.5px] flex items-center justify-center">
              <Cpu className="size-4.5 text-[#00f0ff]" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold tracking-tight text-white text-base font-sans">
                Scyan Studio
              </span>
              <Chip
                className="bg-[#00f0ff]/10 text-[#00f0ff] border border-[#00f0ff]/30 text-[11px] font-mono font-medium px-2 h-5"
              >
                v3.2 Design System
              </Chip>
            </div>
            <p className="text-xs text-[#94a3b8] font-normal hidden sm:block">
              Testing tokens, tri-tone hierarchy &amp; HeroUI v3 components
            </p>
          </div>
        </div>

        {/* Center: Environment / Preview Pill */}
        <div className="hidden md:flex items-center gap-2 bg-[#131722] border border-[#f2741d]/30 rounded-full px-3.5 py-1 text-xs">
          <span className={`size-2 rounded-full ${isConnected ? 'bg-[#00f0ff]' : 'bg-[#f2741d] animate-pulse'}`}></span>
          <span className="text-[#f1f5f9] font-medium">{isConnected ? 'Hardware Linked' : 'Studio is in preview mode'}</span>
          <span className="text-[#94a3b8]">•</span>
          <span className={`${isConnected ? 'text-[#00f0ff]' : 'text-[#f2741d]'} font-mono text-[11px]`}>{statusText}</span>
        </div>

        {/* Right: Quick Search & Actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={onSearchClick}
            className="flex items-center gap-2 bg-[#131722] hover:bg-[#19202f] border border-[#1e2538] hover:border-[#00f0ff]/40 rounded-lg px-3 py-1.5 text-xs text-[#94a3b8] transition-all cursor-pointer shadow-inner"
          >
            <Search className="size-3.5 text-[#00f0ff]" />
            <span className="hidden sm:inline">Search components...</span>
            <span className="sm:hidden">Search</span>
            <Kbd className="bg-[#0b0d13] text-[#f1f5f9] text-[10px] px-1.5 py-0.5 border border-[#232c3f] rounded ml-1 font-mono">
              Ctrl + K
            </Kbd>
          </button>

          <Button
            size="sm"
            onClick={onConnectClick}
            className="bg-[#00f0ff]/10 hover:bg-[#00f0ff] text-[#00f0ff] hover:text-[#0b0d13] border border-[#00f0ff]/30 hover:border-[#00f0ff] font-semibold text-xs rounded-lg px-3 h-8 transition-all duration-200 hover:shadow-[0_0_16px_rgba(0,240,255,0.4)] flex items-center gap-1.5 cursor-pointer"
          >
            <Zap className="size-3.5 fill-current" />
            <span className="hidden sm:inline">{isConnected ? 'Hardware Settings' : 'Connect Hardware'}</span>
            <span className="sm:hidden">{isConnected ? 'Settings' : 'Connect'}</span>
          </Button>
        </div>
      </div>
    </header>
  );
}

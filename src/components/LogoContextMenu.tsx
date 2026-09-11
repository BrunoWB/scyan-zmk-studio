import React, { useEffect, useRef } from 'react';
import { ExternalLink, GitBranch, History } from 'lucide-react';
import { REPOSITORY_URL } from '../data/changelog';
import { KofiIcon } from './HeaderBar';

export interface LogoContextMenuProps {
  isOpen: boolean;
  position: { x: number; y: number } | null;
  onClose: () => void;
  onOpenChangelog: () => void;
}

export const LogoContextMenu: React.FC<LogoContextMenuProps> = ({
  isOpen,
  position,
  onClose,
  onOpenChangelog,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !position) return null;

  // Viewport bounds protection
  const menuWidth = 220;
  const menuHeight = 150;
  const windowWidth = typeof window !== 'undefined' ? window.innerWidth : 1024;
  const windowHeight = typeof window !== 'undefined' ? window.innerHeight : 768;
  const left = Math.min(position.x, windowWidth - menuWidth - 12);
  const top = Math.min(position.y, windowHeight - menuHeight - 12);

  const handleOpenRepo = () => {
    window.open(REPOSITORY_URL, '_blank', 'noopener,noreferrer');
    onClose();
  };

  const handleSeeChangelog = () => {
    onClose();
    onOpenChangelog();
  };

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label="Logo Options"
      style={{ left: `${Math.max(12, left)}px`, top: `${Math.max(12, top)}px` }}
      className="fixed z-50 min-w-[210px] bg-[#131722]/95 backdrop-blur-md border border-[#2d3748] rounded-xl shadow-[0_12px_32px_rgba(0,0,0,0.8),_0_0_15px_rgba(0,240,255,0.08)] py-1.5 animate-in fade-in zoom-in-95 duration-150 overflow-hidden"
    >
      <div className="px-3 py-1.5 border-b border-[#1e2538] mb-1">
        <span className="text-[10px] font-mono tracking-wider uppercase text-[#64748b] font-semibold">
          Scyan Studio
        </span>
      </div>

      <button
        type="button"
        role="menuitem"
        onClick={handleOpenRepo}
        className="w-full flex items-center justify-between px-3 py-2 text-xs text-[#cbd5e1] hover:text-white hover:bg-[#1a2234] transition-colors cursor-pointer text-left group"
      >
        <div className="flex items-center gap-2.5">
          <GitBranch size={14} className="text-[#00f0ff] group-hover:scale-110 transition-transform" />
          <span className="font-medium">Go to git repository</span>
        </div>
        <ExternalLink size={12} className="text-[#64748b] group-hover:text-[#94a3b8]" />
      </button>

      <button
        type="button"
        role="menuitem"
        onClick={handleSeeChangelog}
        className="w-full flex items-center justify-between px-3 py-2 text-xs text-[#cbd5e1] hover:text-white hover:bg-[#1a2234] transition-colors cursor-pointer text-left group"
      >
        <div className="flex items-center gap-2.5">
          <History size={14} className="text-[#f59442] group-hover:scale-110 transition-transform" />
          <span className="font-medium">See change log</span>
        </div>
        <span className="text-[10px] font-mono text-[#00f0ff] bg-[#00f0ff]/10 px-1.5 py-0.5 rounded border border-[#00f0ff]/20">
          v{typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.0.0'}
        </span>
      </button>

      <a
        href="https://ko-fi.com/brunowb"
        target="_blank"
        rel="noopener noreferrer"
        role="menuitem"
        onClick={onClose}
        className="w-full flex items-center justify-between px-3 py-2 text-xs text-[#cbd5e1] hover:text-white hover:bg-[#1a2234] transition-colors cursor-pointer text-left group border-t border-[#1e2538] mt-1 pt-2"
      >
        <div className="flex items-center gap-2.5">
          <KofiIcon size={14} className="text-[#00f0ff] group-hover:scale-110 transition-transform" />
          <span className="font-medium">Support on Ko-fi</span>
        </div>
        <ExternalLink size={12} className="text-[#64748b] group-hover:text-[#94a3b8]" />
      </a>
    </div>
  );
};

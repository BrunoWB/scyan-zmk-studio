import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { FileImage, Film } from 'lucide-react';

export interface SymbolGroupContextMenuProps {
  isOpen: boolean;
  position: { x: number; y: number } | null;
  groupName: string;
  slicesCount: number;
  onClose: () => void;
  onExportPng: () => void;
  onExportGif: () => void;
}

export const SymbolGroupContextMenu: React.FC<SymbolGroupContextMenuProps> = ({
  isOpen,
  position,
  groupName,
  slicesCount,
  onClose,
  onExportPng,
  onExportGif,
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
  const menuWidth = 210;
  const menuHeight = 115;
  const windowWidth = typeof window !== 'undefined' ? window.innerWidth : 1024;
  const windowHeight = typeof window !== 'undefined' ? window.innerHeight : 768;
  const left = Math.min(position.x, windowWidth - menuWidth - 12);
  const top = Math.min(position.y, windowHeight - menuHeight - 12);

  const content = (
    <div
      ref={menuRef}
      role="menu"
      aria-label="Symbol Group Options"
      style={{ left: `${Math.max(12, left)}px`, top: `${Math.max(12, top)}px` }}
      className="fixed z-[9999] min-w-[210px] bg-[#131722]/95 backdrop-blur-md border border-[#2d3748] rounded-xl shadow-[0_12px_32px_rgba(0,0,0,0.8),_0_0_15px_rgba(0,240,255,0.08)] py-1.5 animate-in fade-in zoom-in-95 duration-150 overflow-hidden"
    >
      <div className="px-3 py-1.5 border-b border-[#1e2538] mb-1 flex items-center justify-between gap-2">
        <span
          className="text-[10px] font-mono tracking-wider uppercase text-[#00f0ff] font-semibold truncate max-w-[130px]"
          title={groupName}
        >
          {groupName}
        </span>
        <span className="text-[10px] font-mono text-[#64748b] shrink-0">
          {`${slicesCount} ${slicesCount === 1 ? 'slice' : 'slices'}`}
        </span>
      </div>

      <button
        type="button"
        role="menuitem"
        onClick={() => {
          onExportPng();
          onClose();
        }}
        className="w-full flex items-center justify-between px-3 py-2 text-xs text-[#cbd5e1] hover:text-white hover:bg-[#1a2234] transition-colors cursor-pointer text-left group"
      >
        <div className="flex items-center gap-2.5">
          <FileImage size={14} className="text-[#00f0ff] group-hover:scale-110 transition-transform shrink-0" />
          <span className="font-medium">Export as PNG</span>
        </div>
        <span className="text-[10px] font-mono text-[#00f0ff] bg-[#00f0ff]/10 px-1.5 py-0.5 rounded border border-[#00f0ff]/20">
          PNG
        </span>
      </button>

      <button
        type="button"
        role="menuitem"
        onClick={() => {
          onExportGif();
          onClose();
        }}
        className="w-full flex items-center justify-between px-3 py-2 text-xs text-[#cbd5e1] hover:text-white hover:bg-[#1a2234] transition-colors cursor-pointer text-left group"
      >
        <div className="flex items-center gap-2.5">
          <Film size={14} className="text-[#a953f6] group-hover:scale-110 transition-transform shrink-0" />
          <span className="font-medium">Export as GIF</span>
        </div>
        <span className="text-[10px] font-mono text-[#a953f6] bg-[#a953f6]/10 px-1.5 py-0.5 rounded border border-[#a953f6]/20">
          GIF
        </span>
      </button>
    </div>
  );

  if (typeof document !== 'undefined' && document.body) {
    return createPortal(content, document.body);
  }

  return content;
};

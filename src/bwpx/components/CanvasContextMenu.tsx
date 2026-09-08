import React, { useEffect, useRef } from 'react';
import {
  ClipboardPaste,
  Upload,
  RefreshCw,
  FlipHorizontal,
  FlipVertical,
  RotateCw,
} from 'lucide-react';
import './CanvasContextMenu.css';

export interface CanvasContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  onPaste: () => void;
  onImportFile: () => void;
  onInvert: () => void;
  onFlipH: () => void;
  onFlipV: () => void;
  onRotate90: () => void;
  hasSelection: boolean;
}

export const CanvasContextMenu: React.FC<CanvasContextMenuProps> = ({
  x,
  y,
  onClose,
  onPaste,
  onImportFile,
  onInvert,
  onFlipH,
  onFlipV,
  onRotate90,
  hasSelection,
}) => {
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Close on outside click or scroll or Escape
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  // Adjust menu position so it stays inside window bounds
  const adjustedStyle = React.useMemo(() => {
    const menuWidth = 210;
    const menuHeight = 220;
    const padding = 10;

    let posX = x;
    let posY = y;

    if (x + menuWidth > window.innerWidth - padding) {
      posX = Math.max(padding, window.innerWidth - menuWidth - padding);
    }
    if (y + menuHeight > window.innerHeight - padding) {
      posY = Math.max(padding, window.innerHeight - menuHeight - padding);
    }

    return {
      left: `${posX}px`,
      top: `${posY}px`,
    };
  }, [x, y]);

  return (
    <div
      ref={menuRef}
      className="canvas-context-menu"
      style={adjustedStyle}
      onClick={e => e.stopPropagation()}
    >
      <button
        className="context-menu-item highlight"
        onClick={() => {
          onPaste();
          onClose();
        }}
      >
        <ClipboardPaste size={14} />
        <span>Paste Image</span>
        <span className="context-menu-shortcut">Ctrl+V</span>
      </button>

      <button
        className="context-menu-item"
        onClick={() => {
          onImportFile();
          onClose();
        }}
      >
        <Upload size={14} />
        <span>Import Image File...</span>
      </button>

      <div className="context-menu-divider" />

      <button
        className="context-menu-item"
        onClick={() => {
          onInvert();
          onClose();
        }}
      >
        <RefreshCw size={13} />
        <span>{hasSelection ? 'Invert Selection' : 'Invert Canvas'}</span>
      </button>

      <button
        className="context-menu-item"
        onClick={() => {
          onFlipH();
          onClose();
        }}
      >
        <FlipHorizontal size={13} />
        <span>Flip Horizontal</span>
      </button>

      <button
        className="context-menu-item"
        onClick={() => {
          onFlipV();
          onClose();
        }}
      >
        <FlipVertical size={13} />
        <span>Flip Vertical</span>
      </button>

      <button
        className="context-menu-item"
        onClick={() => {
          onRotate90();
          onClose();
        }}
      >
        <RotateCw size={13} />
        <span>Rotate 90°</span>
      </button>
    </div>
  );
};


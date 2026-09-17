import React from 'react';
import { Monitor } from 'lucide-react';
import { OledBlitterCanvas, type OledBlitterRenderState } from './OledBlitterCanvas';

export const OLED_BORDER_UNITS = 5;

export interface DisplayInfo {
  name: string;
  width: number;
  height: number;
  displayDim: { displayW: number; displayH: number };
  blocks: any[];
  isMaster?: boolean;
}

export interface OledDisplayBayProps {
  shieldId: string;
  assignedDisplayId?: string | null;
  dispInfo?: DisplayInfo | null;
  fallbackDisplayDim: { displayW: number; displayH: number };
  isHoveredDropTarget: boolean;
  onDragStart: (e: React.DragEvent, shieldId: string, displayId: string) => void;
  onDragEnd: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent, shieldId: string) => void;
  onDragLeave: (e: React.DragEvent, shieldId: string) => void;
  onDrop: (e: React.DragEvent, shieldId: string) => void;
  onRegisterCanvas?: (displayId: string, el: HTMLCanvasElement | null) => void;
  renderState?: Partial<OledBlitterRenderState>;
}

export const OledDisplayBay: React.FC<OledDisplayBayProps> = ({
  shieldId,
  assignedDisplayId,
  dispInfo,
  fallbackDisplayDim,
  isHoveredDropTarget,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
  onRegisterCanvas,
  renderState,
}) => {
  if (assignedDisplayId && dispInfo) {
    return (
      <div
        className={`oled-glass-housing relative group/display cursor-grab active:cursor-grabbing rounded-xl transition-all ${
          isHoveredDropTarget
            ? 'ring-2 ring-[#00f0ff] shadow-[0_0_20px_rgba(0,240,255,0.6)] scale-102'
            : 'hover:ring-1 hover:ring-[#00f0ff]/50'
        }`}
        style={{
          width: `${dispInfo.displayDim.displayW + OLED_BORDER_UNITS * 2}px`,
          height: `${dispInfo.displayDim.displayH + OLED_BORDER_UNITS * 2}px`,
        }}
        draggable={true}
        onDragStart={(e) => onDragStart(e, shieldId, assignedDisplayId)}
        onDragEnd={onDragEnd}
        onDragOver={(e) => onDragOver(e, shieldId)}
        onDragLeave={(e) => onDragLeave(e, shieldId)}
        onDrop={(e) => onDrop(e, shieldId)}
        title={`${dispInfo.name} (Drag to swap or move to another shield)`}
      >
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 opacity-0 group-hover/display:opacity-100 transition-opacity z-20 pointer-events-none bg-[#0a0d14]/95 border border-[#00f0ff]/40 text-[#00f0ff] text-[8px] font-mono font-bold px-1.5 py-0.5 rounded shadow-sm whitespace-nowrap select-none">
          Drag Display
        </div>
        <div
          style={{
            position: 'relative',
            width: `${dispInfo.displayDim.displayW}px`,
            height: `${dispInfo.displayDim.displayH}px`,
          }}
        >
          <OledBlitterCanvas
            blocks={dispInfo.blocks}
            vWidth={dispInfo.width}
            vHeight={dispInfo.height}
            displayDim={dispInfo.displayDim}
            side={dispInfo.isMaster ? 'left' : 'right'}
            renderState={renderState}
            onRegisterCanvas={(el) => onRegisterCanvas?.(assignedDisplayId, el)}
          />
        </div>
      </div>
    );
  }

  return (
    <div
      className={`preview-oled-empty-bay transition-all ${
        isHoveredDropTarget
          ? 'border-[#00f0ff] bg-[#00f0ff]/15 ring-2 ring-[#00f0ff] shadow-[0_0_20px_rgba(0,240,255,0.4)] scale-102'
          : ''
      }`}
      onDragOver={(e) => onDragOver(e, shieldId)}
      onDragLeave={(e) => onDragLeave(e, shieldId)}
      onDrop={(e) => onDrop(e, shieldId)}
      style={{
        width: `${fallbackDisplayDim.displayW + OLED_BORDER_UNITS * 2}px`,
        minHeight: `${fallbackDisplayDim.displayH + OLED_BORDER_UNITS * 2}px`,
      }}
      title="Empty OLED Bay — Drag a display here to mount"
    >
      <Monitor size={18} className="text-muted/60" />
      <span className="text-[10px] text-muted font-mono font-medium">Empty OLED Bay</span>
      <span className="text-[9px] text-muted/50 font-mono">No display attached</span>
    </div>
  );
};

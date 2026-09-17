import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { OLED_BORDER_UNITS, type DisplayInfo } from './OledDisplayBay';
import { OledBlitterCanvas, type OledBlitterRenderState } from './OledBlitterCanvas';

export interface UnattachedDisplaysSectionProps {
  unattachedDisplayIds: string[];
  getDisplayInfo: (id: string | null | undefined) => DisplayInfo | null;
  hoveredUnattachedDrawer: boolean;
  hasDraggedFromShield: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  onDragStart: (e: React.DragEvent, displayId: string) => void;
  onDragEnd: (e: React.DragEvent) => void;
  onAssignDisplay: (shieldKey: string, displayId: string) => void;
  onRegisterCanvas?: (displayId: string, el: HTMLCanvasElement | null) => void;
  orderedShields: { id: string; name: string }[];
  reconciledAssignments: Record<string, string | null>;
  renderState?: Partial<OledBlitterRenderState>;
}

export const UnattachedDisplaysSection: React.FC<UnattachedDisplaysSectionProps> = ({
  unattachedDisplayIds,
  getDisplayInfo,
  hoveredUnattachedDrawer,
  hasDraggedFromShield,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragStart,
  onDragEnd,
  onAssignDisplay,
  onRegisterCanvas,
  orderedShields,
  reconciledAssignments,
  renderState,
}) => {
  if (unattachedDisplayIds.length === 0) {
    return null;
  }

  return (
    <div
      className={`unattached-displays-section transition-all ${
        hoveredUnattachedDrawer && hasDraggedFromShield
          ? 'ring-2 ring-amber-400 bg-amber-500/10 shadow-[0_0_24px_rgba(245,158,11,0.3)]'
          : ''
      }`}
      data-testid="unattached-displays-section"
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <div className="flex items-center gap-2 text-amber-400">
          <AlertTriangle size={18} />
          <span className="font-mono font-semibold text-sm">
            {`Unattached Displays (${unattachedDisplayIds.length})`}
          </span>
        </div>
        <span className="text-xs text-amber-400/90 font-mono">
          Display is not attached and won't be saved when committing. Drop here to detach from shield.
        </span>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-6">
        {unattachedDisplayIds.map((screenId) => {
          const info = getDisplayInfo(screenId);
          if (!info) return null;
          return (
            <div
              key={screenId}
              className="unattached-display-card cursor-grab active:cursor-grabbing"
              data-testid={`unattached-card-${screenId}`}
              draggable
              onDragStart={(e) => onDragStart(e, screenId)}
              onDragEnd={onDragEnd}
              title="Drag display to any shield bay to attach"
            >
              <div className="flex items-center justify-between w-full gap-2 border-b border-amber-500/20 pb-1.5">
                <span className="font-mono text-xs font-semibold text-[#e2f1ff]">{info.name}</span>
                <div className="flex items-center gap-1.5">
                  <label className="text-[10px] text-muted font-mono">Attach to:</label>
                  <select
                    className="preview-display-select"
                    value=""
                    onChange={(e) => {
                      const shieldKey = e.target.value;
                      if (shieldKey) onAssignDisplay(shieldKey, screenId);
                    }}
                    aria-label={`Attach ${info.name} to shield`}
                  >
                    <option value="" disabled>Select shield...</option>
                    {orderedShields.map((sh) => (
                      <option key={sh.id} value={sh.id}>
                        {sh.name} {reconciledAssignments[sh.id] ? `(Replaces ${reconciledAssignments[sh.id]})` : '(Empty)'}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div
                className="oled-glass-housing"
                style={{
                  width: `${info.displayDim.displayW + OLED_BORDER_UNITS * 2}px`,
                  height: `${info.displayDim.displayH + OLED_BORDER_UNITS * 2}px`,
                  borderColor: 'rgba(245, 158, 11, 0.4)',
                  boxShadow: '0 0 12px rgba(245, 158, 11, 0.15)',
                }}
              >
                <div
                  style={{
                    position: 'relative',
                    width: `${info.displayDim.displayW}px`,
                    height: `${info.displayDim.displayH}px`,
                  }}
                >
                  <OledBlitterCanvas
                    blocks={info.blocks}
                    vWidth={info.width}
                    vHeight={info.height}
                    displayDim={info.displayDim}
                    side={screenId}
                    renderState={renderState}
                    onRegisterCanvas={(el) => onRegisterCanvas?.(screenId, el)}
                  />
                </div>
              </div>

              <div className="flex items-center gap-1.5 text-[10px] text-amber-400/80 font-mono mt-1 text-center">
                <AlertTriangle size={11} />
                <span>Display is not attached and won't be saved when committing.</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

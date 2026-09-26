import React from 'react';
import { BwpxGrid } from '../../pixel/core/PixelGrid';
import type { SpriteSlice, FontGlyph, FontCharMapping } from '../../types/zmk';
import type { WidgetInstanceMap } from '../../types/widget';
import { WIDGET_REGISTRY } from '../../services/widgetRegistry';
import { WidgetPreviewCanvas } from '../../components/widgets/WidgetPreviewCanvas';
import { Cpu, Zap } from 'lucide-react';

export const TIER_METADATA = {
  1: {
    label: 'Tier 1: Atomic Status Pills',
    shortLabel: 'Tier 1: Status',
    desc: 'Low-profile status indicators (Battery, USB/BLE, Split Link, Caps Lock).',
    badgeClass: 'badge-tier-1',
  },
  2: {
    label: 'Tier 2: Keymap & Typing Metrics',
    shortLabel: 'Tier 2: Keymap/Typing',
    desc: 'Dynamic layer banners, typing speed dials, and custom branding banners.',
    badgeClass: 'badge-tier-2',
  },
  3: {
    label: 'Tier 3: Static',
    shortLabel: 'Tier 3: Static',
    desc: 'Static images, text banners, animations, and interactive mascots.',
    badgeClass: 'badge-tier-3',
  },
} as const;

export interface WidgetsSidebarNavProps {
  activeWidgetId: string;
  onSelectWidget: (widgetId: string) => void;
  instances: WidgetInstanceMap;
  symbolsGrid: BwpxGrid;
  symbolSlices: SpriteSlice[];
  fontGrid: BwpxGrid;
  fontGlyphs?: FontGlyph[];
  fontMappings?: FontCharMapping[];
  customText?: string;
}

export const WidgetsSidebarNav: React.FC<WidgetsSidebarNavProps> = ({
  activeWidgetId,
  onSelectWidget,
  instances,
  symbolsGrid,
  symbolSlices,
  fontGrid,
  fontGlyphs,
  fontMappings,
  customText = '',
}) => {
  return (
    <div className="widgets-nav-list" data-testid="widgets-sidebar-nav">
      {([1, 2, 3] as const).map((tierNum) => {
        const tierWidgets = WIDGET_REGISTRY.filter((w) => w.tier === tierNum);
        if (tierWidgets.length === 0) return null;

        return (
          <div key={tierNum} className="widget-tier-section mb-3">
            <div className="widget-tier-section-header">
              <span className={`tier-badge-pill tier-${tierNum}`}>T{tierNum}</span>
              <span className="widget-tier-section-title">{TIER_METADATA[tierNum].label}</span>
            </div>
            <div className="flex flex-col gap-2">
              {tierWidgets.map((widget) => {
                const isActive = activeWidgetId === widget.id;
                const instanceCount = (instances[widget.id] || []).length;

                return (
                  <button
                    key={widget.id}
                    className={`widget-nav-item ${isActive ? 'active' : ''}`}
                    onClick={() => onSelectWidget(widget.id)}
                    type="button"
                    data-testid={`widget-nav-${widget.id}`}
                  >
                    <div className="widget-nav-badges">
                      {widget.requiresMaster && (
                        <span
                          className="badge-master badge-master--nav"
                          title="Requires Central half in ZMK split"
                        >
                          <Cpu size={9} className="shrink-0" />
                        </span>
                      )}
                      {widget.isInteractive && (
                        <span
                          className="badge-active badge-active--nav"
                          title="Active — responds interactively to keystrokes or typing events"
                        >
                          <Zap size={9} className="shrink-0" />
                        </span>
                      )}
                      {instanceCount > 0 && (
                        <span className="instance-count-badge">{instanceCount}</span>
                      )}
                    </div>
                    <div className="widget-nav-thumb-wrapper">
                      <WidgetPreviewCanvas
                        widget={widget}
                        symbolsGrid={symbolsGrid}
                        symbolSlices={symbolSlices}
                        fontGrid={fontGrid}
                        fontGlyphs={fontGlyphs}
                        fontMappings={fontMappings}
                        customText={customText}
                        instances={instances}
                        mode="thumb"
                        interactive={false}
                      />
                    </div>
                    <div className="widget-nav-meta flex-1 min-w-0">
                      <span className="widget-nav-name truncate">{widget.name}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};

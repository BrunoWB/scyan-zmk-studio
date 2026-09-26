import React, { useState } from 'react';
import { BwpxGrid } from '../../pixel/core/PixelGrid';
import type { SpriteSlice, FontGlyph, FontCharMapping } from '../../types/zmk';
import {
  WIDGET_REGISTRY,
  getWidgetsByCategory,
  getWidgetsByTier,
} from '../../services/widgetRegistry';
import type {
  DisplayWidgetDefinition,
  WidgetCategory,
} from '../../types/widget';
import { Search, Cpu, Zap, RefreshCw } from 'lucide-react';

type FilterType = 'all' | 'tier-1' | 'tier-2' | 'tier-3' | WidgetCategory;

const FILTER_OPTIONS: Array<{ id: FilterType; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'tier-1', label: 'T1: Status' },
  { id: 'tier-2', label: 'T2: Keymap' },
  { id: 'tier-3', label: 'T3: Static' },
];

export interface WidgetCatalogListProps {
  symbolsGrid: BwpxGrid;
  symbolSlices: SpriteSlice[];
  fontGrid: BwpxGrid;
  fontGlyphs?: FontGlyph[];
  fontMappings?: FontCharMapping[];
  customText: string;
  instances?: import('../../types/widget').WidgetInstanceMap;
  onStartDrag: (widget: DisplayWidgetDefinition, clientX: number, clientY: number) => void;
  onQuickAdd?: (widget: DisplayWidgetDefinition, side: 'left' | 'right' | 'dongle' | string) => void;
}

import { WidgetPreviewCanvas } from '../../components/widgets/WidgetPreviewCanvas';

export const WidgetMiniPreview: React.FC<{
  widget: DisplayWidgetDefinition;
  symbolsGrid: BwpxGrid;
  symbolSlices: SpriteSlice[];
  fontGrid: BwpxGrid;
  fontGlyphs?: FontGlyph[];
  fontMappings?: FontCharMapping[];
  customText: string;
  instances?: import('../../types/widget').WidgetInstanceMap;
}> = (props) => {
  return (
    <WidgetPreviewCanvas
      {...props}
      mode="thumb"
      interactive={false}
    />
  );
};

export const WidgetCatalogList: React.FC<WidgetCatalogListProps> = ({
  symbolsGrid,
  symbolSlices,
  fontGrid,
  fontGlyphs = [],
  fontMappings = [],
  customText,
  instances,
  onStartDrag,
}) => {
  const [selectedFilter, setSelectedFilter] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  let baseWidgets: DisplayWidgetDefinition[];
  if (selectedFilter === 'all') {
    baseWidgets = WIDGET_REGISTRY;
  } else if (selectedFilter === 'tier-1') {
    baseWidgets = getWidgetsByTier(1);
  } else if (selectedFilter === 'tier-2') {
    baseWidgets = getWidgetsByTier(2);
  } else if (selectedFilter === 'tier-3') {
    baseWidgets = getWidgetsByTier(3);
  } else {
    baseWidgets = getWidgetsByCategory(selectedFilter);
  }

  const filteredWidgets = baseWidgets.filter(w => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      w.name.toLowerCase().includes(q) ||
      w.description.toLowerCase().includes(q) ||
      w.category.toLowerCase().includes(q)
    );
  });

  return (
    <div className="widget-catalog-container">
      <div className="widget-catalog-header">
        <div className="widget-catalog-top-row">
          <div className="widget-catalog-title">
            <span>Widgets</span>
            <span className="widget-catalog-badge">{Object.values(instances || {}).reduce((sum, arr) => sum + arr.length, 0)} instances</span>
          </div>

          <div className="widget-catalog-search">
            <Search size={12} className="widget-catalog-search-icon" />
            <input
              type="text"
              placeholder="Filter..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="widget-catalog-search-input"
            />
          </div>
        </div>

        {/* 3 Clean Tiers & Category Pill Filters */}
        <div className="widget-category-pills">
          {FILTER_OPTIONS.map(opt => (
            <button
              key={opt.id}
              className={`btn-filter-tag ${selectedFilter === opt.id ? 'active' : ''}`}
              onClick={() => setSelectedFilter(opt.id)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="widget-catalog-grid">
        {filteredWidgets.length === 0 ? (
          <div className="widget-catalog-empty">
            No widgets found matching "{searchQuery}"
          </div>
        ) : (
          filteredWidgets.map(widget => {
            const widgetInstances = instances?.[widget.id] || (widget.id === 'animation' ? instances?.['loop'] : widget.id === 'loop' ? instances?.['animation'] : undefined) || [];
            if (widgetInstances.length === 0) return null;

            return widgetInstances.map(inst => {
              const handlePointerDown = (e: React.PointerEvent) => {
                if (e.button !== 0 && e.pointerType === 'mouse') return;
                e.preventDefault();
                // Pass a patched widget definition that knows its instance ID?
                // For onStartDrag, we just need to pass the widget type. BlocksTab will need to know the instance ID.
                const patchedWidget = { ...widget, id: widget.id, instanceId: inst.id } as DisplayWidgetDefinition & { instanceId: string };
                onStartDrag(patchedWidget, e.clientX, e.clientY);
              };

              return (
                <div
                  key={inst.id}
                  className="widget-tile"
                  onPointerDown={handlePointerDown}
                  draggable={false}
                  title={`Drag ${inst.label} (Tier ${widget.tier}) to screen`}
                >
                  <div className="widget-tile-badges">
                    <span className={`tier-badge-pill tier-${widget.tier}`} title={`Tier ${widget.tier}`}>
                      T{widget.tier}
                    </span>
                    {widget.requiresMaster && (
                      <span className="badge-master badge-master--nav" title="Requires Central half in ZMK split">
                        <Cpu size={9} className="shrink-0" />
                      </span>
                    )}
                    {widget.isInteractive && (
                      <span className="badge-active badge-active--tile" title="Active — responds interactively to keystrokes or typing events">
                        <Zap size={9} className="shrink-0" />
                      </span>
                    )}
                    {inst.config?.syncAnimation && (
                      <span className="badge-synced badge-synced--tile" title="Synced — phase-locked to MCU uptime across split displays">
                        <RefreshCw size={9} className="shrink-0" />
                      </span>
                    )}
                  </div>
                  <div className="widget-tile-header">
                    <span className="widget-tile-title">{widget.name}</span>
                  </div>
                  <div className="widget-tile-preview" style={{ minHeight: `${Math.max(widget.defaultHeight * 3, 32)}px` }}>
                    {/* We need to pass the activeInstanceId to WidgetMiniPreview so it renders the instance */}
                    <WidgetMiniPreview
                      widget={widget}
                      symbolsGrid={symbolsGrid}
                      symbolSlices={symbolSlices}
                      fontGrid={fontGrid}
                      fontGlyphs={fontGlyphs}
                      fontMappings={fontMappings}
                      customText={customText}
                      instances={{ [widget.id]: [inst] }}
                    />
                  </div>
                </div>
              );
            });
          })
        )}
      </div>
    </div>
  );
};

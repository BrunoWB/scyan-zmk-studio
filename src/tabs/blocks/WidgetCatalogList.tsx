import React, { useState, useRef, useEffect } from 'react';
import { BwpxGrid } from '../../bwpx/core/BwpxGrid';
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
import { Search } from 'lucide-react';

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
  onQuickAdd?: (widget: DisplayWidgetDefinition, side: 'left' | 'right') => void;
}

export const WidgetMiniPreview: React.FC<{
  widget: DisplayWidgetDefinition;
  symbolsGrid: BwpxGrid;
  symbolSlices: SpriteSlice[];
  fontGrid: BwpxGrid;
  fontGlyphs?: FontGlyph[];
  fontMappings?: FontCharMapping[];
  customText: string;
  instances?: import('../../types/widget').WidgetInstanceMap;
}> = ({
  widget,
  symbolsGrid,
  symbolSlices,
  fontGrid,
  fontGlyphs,
  fontMappings,
  customText,
  instances,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const scale = 2;
    const width = 32;
    const height = Math.max(widget.defaultHeight, 10);

    canvas.width = width * scale;
    canvas.height = height * scale;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#07090e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const tempGrid = new BwpxGrid(width, height);
    const startX = Math.max(0, Math.floor((width - widget.defaultWidth) / 2));
    
    const activeInstanceId = instances?.[widget.id]?.[0]?.id;

    widget.render(tempGrid, startX, 0, {
      symbolsGrid,
      symbolSlices,
      fontGrid,
      fontGlyphs,
      fontMappings,
      battery: 80,
      outputMode: 'usb',
      currentLayer: 0,
      layerNames: ['QWERTY', 'LOWER', 'RAISE', 'ADJUST'],
      wpm: 65,
      splitConnected: true,
      customText,
      instances,
      activeInstanceId,
    });

    ctx.fillStyle = '#00d2ff';
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (tempGrid.get(x, y)) {
          ctx.fillRect(x * scale, y * scale, scale - 0.2, scale - 0.2);
        }
      }
    }
  }, [
    widget,
    symbolsGrid,
    symbolSlices,
    fontGrid,
    fontGlyphs,
    fontMappings,
    customText,
    instances,
  ]);

  return <canvas ref={canvasRef} className="pixel-preview-canvas" />;
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
            const widgetInstances = instances?.[widget.id] || [];
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
                  <div className="widget-tile-header">
                    <span className={`tier-badge-pill tier-${widget.tier}`}>T{widget.tier}</span>
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

import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { WidgetsSidebarNav } from '../WidgetsSidebarNav';
import { BwpxGrid } from '../../../pixel/core/PixelGrid';
import { WIDGET_REGISTRY } from '../../../services/widgetRegistry';
import type { WidgetInstanceMap } from '../../../types/widget';

describe('WidgetsSidebarNav component', () => {
  const dummyGrid = new BwpxGrid(32, 128);

  it('renders all three tiers with tier headers', () => {
    const html = renderToString(
      <WidgetsSidebarNav
        activeWidgetId="battery"
        onSelectWidget={() => {}}
        instances={{}}
        symbolsGrid={dummyGrid}
        symbolSlices={[]}
        fontGrid={dummyGrid}
      />
    );

    expect(html).toContain('tier-1');
    expect(html).toContain('Tier 1: Atomic Status Pills');
    expect(html).toContain('tier-2');
    expect(html).toContain('Tier 2: Keymap &amp; Typing Metrics');
    expect(html).toContain('tier-3');
    expect(html).toContain('Tier 3: Static');
  });

  it('renders nav items and thumbnail wrappers for each widget in registry', () => {
    const html = renderToString(
      <WidgetsSidebarNav
        activeWidgetId="battery"
        onSelectWidget={() => {}}
        instances={{}}
        symbolsGrid={dummyGrid}
        symbolSlices={[]}
        fontGrid={dummyGrid}
      />
    );

    WIDGET_REGISTRY.forEach((w) => {
      expect(html).toContain(w.name);
      expect(html).toContain(`data-testid="widget-nav-${w.id}"`);
    });

    const thumbWrapperMatches = html.match(/class="[^"]*widget-nav-thumb-wrapper[^"]*"/g);
    expect(thumbWrapperMatches).not.toBeNull();
    expect(thumbWrapperMatches?.length).toBe(WIDGET_REGISTRY.length);
  });

  it('highlights the active widget with the active class', () => {
    const html = renderToString(
      <WidgetsSidebarNav
        activeWidgetId="bongo"
        onSelectWidget={() => {}}
        instances={{}}
        symbolsGrid={dummyGrid}
        symbolSlices={[]}
        fontGrid={dummyGrid}
      />
    );

    expect(html).toMatch(/class="widget-nav-item active"[^>]*data-testid="widget-nav-bongo"/);
    expect(html).not.toMatch(/class="widget-nav-item active"[^>]*data-testid="widget-nav-battery"/);
  });

  it('renders instance count badge when instances exist for a widget', () => {
    const instances: WidgetInstanceMap = {
      battery: [
        { id: 'b1', widgetTypeId: 'battery', label: 'Bat 1', config: { mode: 'symbol' }, slots: {} },
        { id: 'b2', widgetTypeId: 'battery', label: 'Bat 2', config: { mode: 'symbol' }, slots: {} },
      ],
    };

    const html = renderToString(
      <WidgetsSidebarNav
        activeWidgetId="battery"
        onSelectWidget={() => {}}
        instances={instances}
        symbolsGrid={dummyGrid}
        symbolSlices={[]}
        fontGrid={dummyGrid}
      />
    );

    expect(html).toContain('class="instance-count-badge">2</span>');
  });
});

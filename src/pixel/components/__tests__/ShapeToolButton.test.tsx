import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { ShapeToolButton } from '../ShapeToolButton';
import { PixelGrid as BwpxGrid } from '../../core/PixelGrid';
import { drawShape, calculateShapeEndpoints } from '../../core/algorithms';

describe('ShapeToolButton & shape algorithms in scyan-zmk-studio', () => {
  it('renders ShapeToolButton with corner indicator polygon and active state', () => {
    const html = renderToString(
      <ShapeToolButton
        outlineTool="rect"
        filledTool="filled-rect"
        outlineTitle="Rectangle Outline"
        filledTitle="Filled Rectangle"
        activeTool="rect"
        setActiveTool={() => {}}
      />
    );

    expect(html).toContain('bwpx-tool-btn');
    expect(html).toContain('active');
    expect(html).toContain('title="Rectangle Outline"');
    expect(html).toContain('<polygon points="6,2 6,6 2,6"');
  });

  it('renders ShapeToolButton with multi-variant arrow configuration', () => {
    const html = renderToString(
      <ShapeToolButton
        variants={[
          { tool: 'line', icon: <span>LineIcon</span>, title: 'Line Tool', label: 'Line' },
          { tool: 'arrow', icon: <span>ArrowIcon</span>, title: 'Arrow Tool', label: 'Arrow' },
          { tool: 'filled-arrow', icon: <span>FilledArrowIcon</span>, title: 'Filled Arrow Tool', label: 'Filled Arrow' },
        ]}
        activeTool="filled-arrow"
        setActiveTool={() => {}}
      />
    );

    expect(html).toContain('bwpx-tool-btn');
    expect(html).toContain('active');
    expect(html).toContain('title="Filled Arrow Tool"');
    expect(html).toContain('FilledArrowIcon');
  });

  it('draws unfilled arrow and filled arrow correctly on BwpxGrid', () => {
    const gridUnfilled = new BwpxGrid(32, 32);
    drawShape(gridUnfilled, 'arrow', 4, 16, 24, 16, 1, 1);
    expect(gridUnfilled.countOn()).toBeGreaterThan(0);

    const gridFilled = new BwpxGrid(32, 32);
    drawShape(gridFilled, 'filled-arrow', 4, 16, 24, 16, 1, 1);
    expect(gridFilled.countOn()).toBeGreaterThan(gridUnfilled.countOn());
  });

  it('calculates snapped endpoints with Shift key for 45-degree angle increments', () => {
    const endpoints = calculateShapeEndpoints(
      'line',
      { x: 10, y: 10 },
      { x: 22, y: 12 },
      { shiftKey: true }
    );

    // Closest octant to horizontal (dy=2, dx=12) is 0 degrees (snappedDy = 0)
    expect(endpoints.x0).toBe(10);
    expect(endpoints.y0).toBe(10);
    expect(endpoints.y1).toBe(10);
  });

  it('renders ShapeToolButton for pencil variants with round-pencil default', () => {
    const html = renderToString(
      <ShapeToolButton
        variants={[
          { tool: 'round-pencil', icon: <span>BrushIcon</span>, title: 'Round Brush', label: 'Round' },
          { tool: 'pencil', icon: <span>PencilIcon</span>, title: 'Square Pencil', label: 'Square' },
        ]}
        activeTool="round-pencil"
        setActiveTool={() => {}}
      />
    );

    expect(html).toContain('bwpx-tool-btn');
    expect(html).toContain('active');
    expect(html).toContain('title="Round Brush"');
    expect(html).toContain('BrushIcon');
  });
});

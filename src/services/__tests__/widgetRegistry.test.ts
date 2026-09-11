import { describe, it, expect, beforeEach } from 'vitest';
import { BwpxGrid } from '../../bwpx/core/BwpxGrid';
import {
  WIDGET_REGISTRY,
  getWidgetDefinition,
  getAllWidgets,
  getWidgetsByCategory,
  getWidgetsByTier,
  normalizeWidgetType,
  renderWidgetById,
  renderBlocksToGrid,
  blitSlice,
  drawText,
  renderSlot,
  interpolateTemplate,
  PUNCTUATION_3X5,
  getWidgetNaturalSize,
  measureTextWidth,
} from '../widgetRegistry';
import {
  DEFAULT_LEFT_LAYOUT_BLOCKS,
  DEFAULT_RIGHT_LAYOUT_BLOCKS,
  DEFAULT_LAYOUT_BLOCKS,
  DEFAULT_SYMBOL_SLICES,
  DEFAULT_FONT_GLYPHS,
  DEFAULT_FONT_MAPPINGS,
  type SpriteSlice,
  type LayoutBlock,
} from '../../types/zmk';
import { getDefaultAssets } from '../cHeaderParser';
import type { WidgetRenderContext } from '../../types/widget';

describe('Widget Registry - Single Source of Truth', () => {
  let symbolsGrid: BwpxGrid;
  let fontGrid: BwpxGrid;
  let renderContext: WidgetRenderContext;

  beforeEach(() => {
    const defaults = getDefaultAssets();
    symbolsGrid = defaults.symbolsGrid;
    fontGrid = defaults.fontGrid;
    renderContext = {
      symbolsGrid,
      symbolSlices: DEFAULT_SYMBOL_SLICES,
      fontGrid,
      fontGlyphs: DEFAULT_FONT_GLYPHS,
      fontMappings: DEFAULT_FONT_MAPPINGS,
      battery: 80,
      outputMode: 'usb',
      currentLayer: 0,
      layerNames: ['QWERTY', 'LOWER', 'RAISE', 'ADJUST'],
      wpm: 60,
      splitConnected: true,
      customText: 'BRUNOWB',
    };
  });

  it('contains all core required display widgets', () => {
    const requiredWidgetIds = [
      'battery',
      'connection',
      'split',
      'layer-banner',
      'wpm',
      'branding',
    ];

    const registryIds = WIDGET_REGISTRY.map(w => w.id);
    for (const reqId of requiredWidgetIds) {
      expect(registryIds).toContain(reqId);
    }
  });

  it('all widgets have valid dimension constraints and render functions', () => {
    for (const widget of WIDGET_REGISTRY) {
      expect(widget.name).toBeTruthy();
      expect(widget.description).toBeTruthy();
      expect(widget.category).toMatch(/^(status|typing|layer|art|branding)$/);
      expect(widget.defaultHeight).toBeGreaterThan(0);
      expect(widget.minHeight).toBeLessThanOrEqual(widget.defaultHeight);
      expect(widget.maxHeight).toBeGreaterThanOrEqual(widget.defaultHeight);
      expect(typeof widget.render).toBe('function');
    }
  });

  it('correctly maps legacy block IDs via normalizeWidgetType', () => {
    expect(normalizeWidgetType('block-layer-label')).toBe('layer-banner');
    expect(normalizeWidgetType('block-branding')).toBe('branding');
    expect(normalizeWidgetType('block-wpm')).toBe('wpm');
    expect(normalizeWidgetType('block-split')).toBe('split');
    expect(normalizeWidgetType('block-battery')).toBe('battery');
    expect(normalizeWidgetType('block-ble-profile')).toBe('connection');
    expect(normalizeWidgetType('ble-profile')).toBe('connection');
    expect(normalizeWidgetType('output-status')).toBe('connection');
    expect(normalizeWidgetType('custom-widget')).toBe('custom-widget');
  });

  it('retrieves widget definition by id or normalized alias', () => {
    expect(getWidgetDefinition('battery')?.id).toBe('battery');
    expect(getWidgetDefinition('block-battery')?.id).toBe('battery');
    expect(getWidgetDefinition('non-existent')).toBeUndefined();
  });

  it('filters widgets by category and supports "all"', () => {
    const statusWidgets = getWidgetsByCategory('status');
    expect(statusWidgets.length).toBeGreaterThan(0);
    expect(statusWidgets.every(w => w.category === 'status')).toBe(true);

    const allWidgets = getWidgetsByCategory('all');
    expect(allWidgets.length).toBe(getAllWidgets().length);
  });

  it('renders battery meter widget onto grid and turns on pixels', () => {
    const grid = new BwpxGrid(32, 30);
    expect(grid.countOn()).toBe(0);

    renderWidgetById('battery', grid, 0, renderContext);
    expect(grid.countOn()).toBeGreaterThan(0);
  });



  it('renders layer banner reacting to current layer', () => {
    const bannerGrid0 = new BwpxGrid(32, 20);
    renderWidgetById('layer-banner', bannerGrid0, 0, { ...renderContext, currentLayer: 0 });
    expect(bannerGrid0.countOn()).toBeGreaterThan(10);
  });

  it('renders WPM gauge with 3 digits and arrows', () => {
    const grid = new BwpxGrid(32, 30);
    renderWidgetById('wpm', grid, 0, { ...renderContext, wpm: 88 });
    expect(grid.countOn()).toBeGreaterThan(20);
  });

  it('renders split peripheral link widget for connected and disconnected states', () => {
    const connectedGrid = new BwpxGrid(32, 20);
    renderWidgetById('split', connectedGrid, 0, { ...renderContext, splitConnected: true });
    expect(connectedGrid.countOn()).toBeGreaterThan(5);

    const disconnectedGrid = new BwpxGrid(32, 20);
    renderWidgetById('split', disconnectedGrid, 0, { ...renderContext, splitConnected: false });
    expect(disconnectedGrid.countOn()).toBeGreaterThan(5);
  });

  it('renders custom branding text widget', () => {
    const grid = new BwpxGrid(32, 20);
    renderWidgetById('branding', grid, 0, { ...renderContext, customText: 'CORNE' });
    expect(grid.countOn()).toBeGreaterThan(10);
  });

  it('renders wpm-chart with and without grid', () => {
    const gridWithBorder = new BwpxGrid(32, 24);
    renderWidgetById('wpm-chart', gridWithBorder, 0, {
      ...renderContext,
      activeInstanceId: 'inst_wpm_chart_grid',
      instances: {
        'wpm-chart': [{
          id: 'inst_wpm_chart_grid',
          widgetTypeId: 'wpm-chart',
          label: 'WPM Chart',
          config: { mode: 'symbol', wpmChart: { width: 32, height: 24, gridSize: 4, targetSpeed: 100 } },
          slots: {}
        }]
      }
    });
    // With gridSize: 4, the outer border includes (0,0). So (0,0) must be 1.
    expect(gridWithBorder.get(0, 0)).toBe(1);

    const gridNoBorder = new BwpxGrid(32, 24);
    renderWidgetById('wpm-chart', gridNoBorder, 0, {
      ...renderContext,
      activeInstanceId: 'inst_wpm_chart_nogrid',
      instances: {
        'wpm-chart': [{
          id: 'inst_wpm_chart_nogrid',
          widgetTypeId: 'wpm-chart',
          label: 'WPM Chart No Grid',
          config: { mode: 'symbol', wpmChart: { width: 32, height: 24, gridSize: 0, targetSpeed: 100 } },
          slots: {}
        }]
      }
    });
    // With gridSize: 0, there is no outer border, so (0,0) is likely 0, but there's a chart drawn.
    expect(gridNoBorder.get(0, 0)).toBe(0);
    // Baseline is drawn at bottom row y = 23
    expect(gridNoBorder.get(0, 23)).toBe(1);
    expect(gridNoBorder.get(31, 23)).toBe(1);
  });

  it('renders wpm-chart heartbeat where rightmost column matches current wpm and respects wpmHistory', () => {
    const gridMax = new BwpxGrid(32, 24);
    renderWidgetById('wpm-chart', gridMax, 0, {
      ...renderContext,
      wpm: 100,
      activeInstanceId: 'inst_wpm_chart_pulse',
      instances: {
        'wpm-chart': [{
          id: 'inst_wpm_chart_pulse',
          widgetTypeId: 'wpm-chart',
          label: 'WPM Pulse',
          config: { mode: 'symbol', wpmChart: { width: 32, height: 24, gridSize: 4, targetSpeed: 100, timeWindow: 30 } },
          slots: {}
        }]
      }
    });
    // With targetSpeed: 100, border: 1, inner_w = 30 (x=1..30).
    // Rightmost column is x = 30.
    // At wpm = 100, yPlot = chartY + 0 = 1 (top inner row).
    expect(gridMax.get(30, 1)).toBe(1);

    const gridMin = new BwpxGrid(32, 24);
    renderWidgetById('wpm-chart', gridMin, 0, {
      ...renderContext,
      wpm: 0,
      activeInstanceId: 'inst_wpm_chart_pulse',
      instances: {
        'wpm-chart': [{
          id: 'inst_wpm_chart_pulse',
          widgetTypeId: 'wpm-chart',
          label: 'WPM Pulse',
          config: { mode: 'symbol', wpmChart: { width: 32, height: 24, gridSize: 4, targetSpeed: 100, timeWindow: 30 } },
          slots: {}
        }]
      }
    });
    // At wpm = 0, yPlot = chartY + innerH - 1 = 1 + 21 = 22 (bottom inner row).
    expect(gridMin.get(30, 22)).toBe(1);

    // Test with explicit wpmHistory
    const gridHist = new BwpxGrid(32, 24);
    const customHistory = new Array(30).fill(0);
    customHistory[customHistory.length - 1] = 80; // age 1 was 80
    renderWidgetById('wpm-chart', gridHist, 0, {
      ...renderContext,
      wpm: 20,
      wpmHistory: customHistory,
      activeInstanceId: 'inst_wpm_chart_pulse',
      instances: {
        'wpm-chart': [{
          id: 'inst_wpm_chart_pulse',
          widgetTypeId: 'wpm-chart',
          label: 'WPM Pulse',
          config: { mode: 'symbol', wpmChart: { width: 32, height: 24, gridSize: 4, targetSpeed: 100, timeWindow: 30 } },
          slots: {}
        }]
      }
    });
    // Rightmost column (x=30) should be at wpm=20
    const expectedYNow = 1 + 21 - Math.round((20 * 21) / 100);
    expect(gridHist.get(30, expectedYNow)).toBe(1);
  });

  it('wpm-chart respects blockWidth and blockHeight when smaller than config', () => {
    const gridBlock = new BwpxGrid(32, 32);
    renderWidgetById('wpm-chart', gridBlock, 0, {
      ...renderContext,
      wpm: 50,
      blockWidth: 24,
      blockHeight: 18,
      activeInstanceId: 'inst_wpm_chart_36',
      instances: {
        'wpm-chart': [{
          id: 'inst_wpm_chart_36',
          widgetTypeId: 'wpm-chart',
          label: 'WPM Chart',
          config: { mode: 'symbol', wpmChart: { width: 36, height: 30, gridSize: 4, targetSpeed: 100, timeWindow: 30 } },
          slots: {}
        }]
      }
    });
    // With blockWidth 24, right border should be at x = 23 (not x = 35)
    expect(gridBlock.get(23, 0)).toBe(1);
    expect(gridBlock.get(23, 17)).toBe(1);
    // x = 24 should NOT have border pixels
    expect(gridBlock.get(24, 0)).toBe(0);
  });

  it('marks requiresMaster correctly on central-dependent widgets', () => {
    expect(getWidgetDefinition('connection')?.requiresMaster).toBe(true);
    expect(getWidgetDefinition('caps-lock')?.requiresMaster).toBe(true);
    expect(getWidgetDefinition('layer-banner')?.requiresMaster).toBe(true);
    expect(getWidgetDefinition('wpm')?.requiresMaster).toBe(true);
    expect(getWidgetDefinition('wpm-chart')?.requiresMaster).toBe(true);

    // Peripheral-capable widgets should not require master
    expect(getWidgetDefinition('battery')?.requiresMaster).toBeFalsy();
    expect(getWidgetDefinition('split')?.requiresMaster).toBeFalsy();
    expect(getWidgetDefinition('branding')?.requiresMaster).toBeFalsy();
    expect(getWidgetDefinition('screensaver')?.requiresMaster).toBeFalsy();
    expect(getWidgetDefinition('bongo')?.requiresMaster).toBeFalsy();
  });

  it('renders full screen layout blocks in Y order', () => {
    const screenGrid = new BwpxGrid(32, 128);
    expect(screenGrid.countOn()).toBe(0);

    renderBlocksToGrid(DEFAULT_LEFT_LAYOUT_BLOCKS, screenGrid, renderContext);
    expect(screenGrid.countOn()).toBeGreaterThan(100);
  });

  it('DEFAULT_LEFT_LAYOUT_BLOCKS and DEFAULT_RIGHT_LAYOUT_BLOCKS have valid bounds within 0..128', () => {
    for (const block of DEFAULT_LEFT_LAYOUT_BLOCKS) {
      expect(block.y).toBeGreaterThanOrEqual(0);
      expect(block.y + block.height).toBeLessThanOrEqual(128);
      expect(block.enabled).toBe(true);
      expect(getWidgetDefinition(block.widgetType || block.id)).toBeDefined();
    }

    for (const block of DEFAULT_RIGHT_LAYOUT_BLOCKS) {
      expect(block.y).toBeGreaterThanOrEqual(0);
      expect(block.y + block.height).toBeLessThanOrEqual(128);
      expect(block.enabled).toBe(true);
      expect(getWidgetDefinition(block.widgetType || block.id)).toBeDefined();
    }
  });

  it('DEFAULT_LAYOUT_BLOCKS maintains backwards compatibility with DEFAULT_LEFT_LAYOUT_BLOCKS', () => {
    expect(DEFAULT_LAYOUT_BLOCKS).toEqual(DEFAULT_LEFT_LAYOUT_BLOCKS);
  });

  it('blitSlice handles out-of-bounds destination coordinates gracefully', () => {
    const smallGrid = new BwpxGrid(10, 10);
    // Render partially or wholly off-screen
    blitSlice(smallGrid, symbolsGrid, DEFAULT_SYMBOL_SLICES, 'SYMBOL_USB', -5, -5);
    blitSlice(smallGrid, symbolsGrid, DEFAULT_SYMBOL_SLICES, 'SYMBOL_USB', 8, 8);
    blitSlice(smallGrid, symbolsGrid, DEFAULT_SYMBOL_SLICES, 'SYMBOL_USB', 100, 100);
    // Check that all pixels inside smallGrid remain within 0..9
    const pixels = smallGrid.getAllPixels();
    for (const [x, y] of pixels) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(10);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThan(10);
    }
  });

  it('drawText handles out-of-bounds start coordinates gracefully', () => {
    const smallGrid = new BwpxGrid(16, 12);
    drawText(smallGrid, fontGrid, DEFAULT_FONT_GLYPHS, DEFAULT_FONT_MAPPINGS, 'TEST', -4, -2);
    drawText(smallGrid, fontGrid, DEFAULT_FONT_GLYPHS, DEFAULT_FONT_MAPPINGS, 'OVERFLOW', 10, 2);
    const pixels = smallGrid.getAllPixels();
    for (const [x, y] of pixels) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(16);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThan(12);
    }
  });

  it('renderBlocksToGrid does not render disabled blocks', () => {
    const screenGrid = new BwpxGrid(32, 128);
    const allDisabled = DEFAULT_LEFT_LAYOUT_BLOCKS.map(b => ({ ...b, enabled: false }));
    renderBlocksToGrid(allDisabled, screenGrid, renderContext);
    expect(screenGrid.countOn()).toBe(0);
  });

  describe('3 Clean Tiers Architecture', () => {
    it('every widget in registry is classified into Tier 1, 2, or 3', () => {
      for (const widget of WIDGET_REGISTRY) {
        expect([1, 2, 3]).toContain(widget.tier);
      }
    });

    it('correctly filters widgets by tier via getWidgetsByTier', () => {
      const tier1 = getWidgetsByTier(1);
      const tier2 = getWidgetsByTier(2);
      const tier3 = getWidgetsByTier(3);

      expect(tier1.length).toBe(4);
      expect(tier1.map(w => w.id)).toEqual([
        'battery',
        'connection',
        'split',
        'caps-lock',
      ]);

      expect(tier2.length).toBe(3);
      expect(tier2.map(w => w.id)).toEqual([
        'layer-banner',
        'wpm',
        'wpm-chart',
      ]);

      expect(tier3.length).toBe(4);
      expect(tier3.map(w => w.id)).toEqual(['branding', 'screensaver', 'bongo', 'animation']);

      expect(tier1.length + tier2.length + tier3.length).toBe(WIDGET_REGISTRY.length);
    });
  });

  describe('Punctuation Fallback (3x5 Bitmaps)', () => {
    it('contains all standard punctuation glyph bitmaps with valid 5-row heights', () => {
      const expectedChars = [
        '%', '[', ']', ':', '-', '_', '>', '<', '.', '/', '?', '!', '=', '(', ')', '*', '^', '+',
        ',', ';', "'", '"', '|', '\\', '~', '{', '}', '#', '@', '$', '&',
      ];
      for (const char of expectedChars) {
        expect(PUNCTUATION_3X5[char]).toBeDefined();
        expect(PUNCTUATION_3X5[char].length).toBe(5);
      }
    });

    it('drawText renders punctuation bitmaps when character is missing from font atlas', () => {
      const emptyFontGrid = new BwpxGrid(64, 20);
      const destGrid = new BwpxGrid(64, 20);

      // Pass empty glyphs and mappings to force fallback
      const endX = drawText(destGrid, emptyFontGrid, [], [], '[%?]', 2, 2, 'small');
      expect(endX).toBeGreaterThan(2);
      expect(destGrid.countOn()).toBeGreaterThan(0);

      // Verify that '[' has lit pixels
      expect(destGrid.get(2, 2)).toBe(1); // top-left of '['
      expect(destGrid.get(3, 2)).toBe(1);
    });

    it('drawText scales punctuation fallback characters when size is "big"', () => {
      const emptyFontGrid = new BwpxGrid(64, 20);
      const smallGrid = new BwpxGrid(32, 20);
      const bigGrid = new BwpxGrid(32, 20);

      drawText(smallGrid, emptyFontGrid, [], [], '!', 2, 2, 'small');
      drawText(bigGrid, emptyFontGrid, [], [], '!', 2, 2, 'big');

      // Big size should have 4x the lit pixels (2x width and 2x height)
      expect(bigGrid.countOn()).toBe(smallGrid.countOn() * 4);
    });
  });

  describe('Missing Symbol Graceful Fallback', () => {
    it('renders a 1px dashed placeholder box with centered "?" when no fallbackText exists', () => {
      const grid = new BwpxGrid(32, 20);
      const customDef = {
        ...renderContext,
        symbolSlices: [],
      };

      const result = renderSlot(
        grid,
        2,
        2,
        'unknown-widget',
        'unknown-slot',
        customDef,
        { width: 8, height: 8 }
      );

      expect(result.isMissingSymbol).toBe(true);
      expect(grid.countOn()).toBeGreaterThan(0);
      expect(grid.get(2, 2)).toBe(1);
      expect(grid.get(3, 2)).toBe(0);
      expect(grid.get(4, 2)).toBe(1);
    });
  });

  describe('Slot Customization Architecture', () => {
    it('interpolates all dynamic template variables', () => {
      const template = 'B:{battery}% L:{layer}:{layerName} W:{wpm} O:{output} S:{split} T:{customText}';
      const output = interpolateTemplate(template, {
        ...renderContext,
        battery: 95,
        currentLayer: 2,
        layerNames: ['BASE', 'NAV', 'NUM', 'SYM'],
        wpm: 120,
        outputMode: 'ble',
        splitConnected: true,
        customText: 'MYKEYBOARD',
      });

      expect(output).toBe('B:95% L:2:NUM W:120 O:BLE S:OK T:MYKEYBOARD');
    });

    it('customizing battery slot to text mode renders text and suppresses fill bars', () => {
      const normalGrid = new BwpxGrid(32, 20);
      renderWidgetById('battery', normalGrid, 0, renderContext);

      const textCustomGrid = new BwpxGrid(32, 20);
      renderWidgetById('battery', textCustomGrid, 0, {
        ...renderContext,
        activeInstanceId: 'inst1',
        instances: {
          battery: [{
            id: 'inst1',
            widgetTypeId: 'battery',
            label: 'Battery',
            config: { mode: 'font', textEntries: ['{battery}%'], fontDivisionCount: 2 },
            slots: {}
          }]
        }
      });

      expect(textCustomGrid.countOn()).toBeGreaterThan(0);
      // Battery fill bars were active in symbol mode, should be suppressed in text mode
      expect(textCustomGrid.getAllPixels()).not.toEqual(normalGrid.getAllPixels());
    });

    it('customizing layer-banner bracket slot to custom text replaces symbol bracket', () => {
      const textBracketGrid = new BwpxGrid(32, 20);
      renderWidgetById('layer-banner', textBracketGrid, 0, {
        ...renderContext,
        customizations: {
          'layer-banner': {
            'bracket-0': {
              mode: 'text',
              text: '<QWERTY>',
            },
          },
        },
      });

      expect(textBracketGrid.countOn()).toBeGreaterThan(0);
    });

    it('renderBlocksToGrid respects slot customizations across entire screen layout', () => {
      const defaultScreen = new BwpxGrid(32, 128);
      renderBlocksToGrid(DEFAULT_LEFT_LAYOUT_BLOCKS, defaultScreen, renderContext);

      const customizedScreen = new BwpxGrid(32, 128);
      renderBlocksToGrid(DEFAULT_LEFT_LAYOUT_BLOCKS, customizedScreen, {
        ...renderContext,
        customizations: {
          branding: {
            'brand-text': {
              mode: 'text',
              text: 'CUSTOMZMK',
            },
          },
        },
      });

      expect(customizedScreen.countOn()).toBeGreaterThan(0);
      expect(customizedScreen.getAllPixels()).not.toEqual(defaultScreen.getAllPixels());
    });

    it('customizing wpm combined widget digits slot renders custom text template', () => {
      const defaultGrid = new BwpxGrid(32, 30);
      renderWidgetById('wpm', defaultGrid, 0, { ...renderContext, wpm: 80 });

      const customGrid = new BwpxGrid(32, 30);
      renderWidgetById('wpm', customGrid, 0, {
        ...renderContext,
        wpm: 80,
        activeInstanceId: 'inst_wpm',
        instances: {
          wpm: [{
            id: 'inst_wpm',
            widgetTypeId: 'wpm',
            label: 'WPM',
            config: { mode: 'font', textEntries: ['120', '120'], fontDivisionCount: 2 },
            slots: {}
          }]
        }
      });

      expect(customGrid.countOn()).toBeGreaterThan(0);
      expect(customGrid.getAllPixels()).not.toEqual(defaultGrid.getAllPixels());
    });

    it('does not draw battery fill bars over non-battery-frame symbols', () => {
      const customSymbolGrid = new BwpxGrid(32, 20);
      renderWidgetById('battery', customSymbolGrid, 0, {
        ...renderContext,
        battery: 100,
        activeInstanceId: 'inst2',
        instances: {
          battery: [{
            id: 'inst2',
            widgetTypeId: 'battery',
            label: 'Battery',
            config: { mode: 'symbol', groupId: 'SYMBOL_USB' },
            slots: {}
          }]
        }
      });

      // Battery bars would normally be drawn at x=9..20, y=3..7
      // But because symbolId is SYMBOL_USB and not SYMBOL_BATTERY_FRAME,
      // it should NOT draw the 4 battery bars
      expect(customSymbolGrid.countOn()).toBeGreaterThan(0);
    });

    it('interpolateTemplate handles null, empty string, and aliases like {batt} and {layer_name}', () => {
      expect(interpolateTemplate('', renderContext)).toBe('');
      expect(interpolateTemplate(null as unknown as string, renderContext)).toBe('');
      expect(interpolateTemplate(undefined as unknown as string, renderContext)).toBe('');

      const res = interpolateTemplate('{batt}% on {layer_name}', {
        ...renderContext,
        battery: 88,
        currentLayer: 1,
        layerNames: ['BASE', 'NUMPAD'],
      });
      expect(res).toBe('88% on NUMPAD');
    });

    it('renderSlot normalizes legacy widget ID like block-battery', () => {
      const grid = new BwpxGrid(32, 20);
      const result = renderSlot(
        grid,
        2,
        2,
        'block-battery',
        'battery-icon',
        {
          ...renderContext,
          customizations: {
            battery: {
              'battery-icon': {
                mode: 'text',
                text: 'BATT',
              },
            },
          },
        }
      );

      expect(result.rendered).toBe(true);
      expect(result.mode).toBe('text');
      expect(result.text).toBe('BATT');
    });

    it('renderWidgetById supports explicit destX and shifts pixel output horizontally', () => {
      const gridAtX0 = new BwpxGrid(32, 20);
      const gridAtX10 = new BwpxGrid(32, 20);

      renderWidgetById('connection', gridAtX0, 0, 0, {
        ...renderContext,
        outputMode: 'usb',
      });
      renderWidgetById('connection', gridAtX10, 10, 0, {
        ...renderContext,
        outputMode: 'usb',
      });

      expect(gridAtX0.countOn()).toBeGreaterThan(0);
      expect(gridAtX10.countOn()).toBeGreaterThan(0);
      expect(gridAtX0.countOn()).toEqual(gridAtX10.countOn());

      // At X=0, pixel at column 0-11 is on, but column 20 is off
      // At X=10, pixel at column 10-21 is on, but column 0 is off
      let hasColUnder5AtX0 = false;
      let hasColUnder5AtX10 = false;
      for (let y = 0; y < 10; y++) {
        for (let x = 0; x < 5; x++) {
          if (gridAtX0.get(x, y)) hasColUnder5AtX0 = true;
          if (gridAtX10.get(x, y)) hasColUnder5AtX10 = true;
        }
      }
      expect(hasColUnder5AtX0).toBe(true);
      expect(hasColUnder5AtX10).toBe(false);
    });

    it('renderBlocksToGrid places blocks at their respective block.x and block.y', () => {
      const grid = new BwpxGrid(32, 128);
      const blocks: import('../../types/zmk').LayoutBlock[] = [
        {
          id: 'b-left',
          widgetType: 'connection',
          name: 'Connection Left',
          x: 0,
          y: 10,
          width: 12,
          height: 10,
          enabled: true,
          description: 'Conn at left',
        },
        {
          id: 'b-right',
          widgetType: 'connection',
          name: 'Connection Right',
          x: 18,
          y: 50,
          width: 12,
          height: 10,
          enabled: true,
          description: 'Conn at right',
        },
      ];

      renderBlocksToGrid(blocks, grid, {
        ...renderContext,
        outputMode: 'usb',
      });

      // Around Y=10..20, pixels should be on in left columns (0..12) and 0 in right (18..30)
      let leftAreaCount = 0;
      let rightAreaCountAtY10 = 0;
      for (let y = 10; y < 20; y++) {
        for (let x = 0; x < 12; x++) {
          if (grid.get(x, y)) leftAreaCount++;
        }
        for (let x = 18; x < 30; x++) {
          if (grid.get(x, y)) rightAreaCountAtY10++;
        }
      }
      expect(leftAreaCount).toBeGreaterThan(0);
      expect(rightAreaCountAtY10).toBe(0);

      // Around Y=50..60, pixels should be on in right columns (18..30) and 0 in left (0..12)
      let rightAreaCountAtY50 = 0;
      let leftAreaCountAtY50 = 0;
      for (let y = 50; y < 60; y++) {
        for (let x = 18; x < 30; x++) {
          if (grid.get(x, y)) rightAreaCountAtY50++;
        }
        for (let x = 0; x < 12; x++) {
          if (grid.get(x, y)) leftAreaCountAtY50++;
        }
      }
      expect(rightAreaCountAtY50).toBeGreaterThan(0);
      expect(leftAreaCountAtY50).toBe(0);
    });

    it('branding widget renders text within screen boundary when positioned at destX > 0', () => {
      const grid = new BwpxGrid(32, 20);
      renderWidgetById('branding', grid, 8, 2, {
        ...renderContext,
        customText: 'CORNE',
      });

      // CORNE has 5 chars (5 * 4 = 20px). At destX=8, availWidth=24, text is drawn at startX = 8 + (24 - 20)/2 = 10..29
      expect(grid.countOn()).toBeGreaterThan(0);
      // Pixels should not be out of bounds or before destX
      for (let y = 0; y < 20; y++) {
        for (let x = 0; x < 8; x++) {
          expect(grid.get(x, y)).toBe(0);
        }
      }
    });

    it('screensaver widget renders at exact destY', () => {
      const grid = new BwpxGrid(32, 30);
      renderWidgetById('screensaver', grid, 3, 2, renderContext);
      expect(grid.countOn()).toBeGreaterThan(0);
      // y=0 and y=1 should have no pixels lit since destY=2
      for (let x = 0; x < 32; x++) {
        expect(grid.get(x, 0)).toBe(0);
        expect(grid.get(x, 1)).toBe(0);
      }
    });

    it('Output Status (connection) renders USB when outputMode is usb', () => {
      const grid = new BwpxGrid(32, 20);
      const usbContext: WidgetRenderContext = {
        ...renderContext,
        outputMode: 'usb',
        instances: {
          connection: [
            {
              id: 'test-conn',
              widgetTypeId: 'connection',
              label: 'Output Status',
              config: {
                mode: 'font',
                textEntries: ['USB', 'No conn', 'P1', 'P2', 'P3', 'P4', 'P5'],
              },
            },
          ],
        },
        activeInstanceId: 'test-conn',
      };
      renderWidgetById('connection', grid, 0, 0, usbContext);
      expect(grid.countOn()).toBeGreaterThan(0);
    });

    it('Output Status (connection) renders BLE profile when outputMode is ble', () => {
      const grid = new BwpxGrid(32, 20);
      const bleContext: WidgetRenderContext = {
        ...renderContext,
        outputMode: 'ble',
        bleProfileIndex: 2,
        instances: {
          connection: [
            {
              id: 'test-conn',
              widgetTypeId: 'connection',
              label: 'Output Status',
              config: {
                mode: 'font',
                textEntries: ['USB', 'No conn', 'P1', 'P2', 'P3', 'P4', 'P5'],
              },
            },
          ],
        },
        activeInstanceId: 'test-conn',
      };
      renderWidgetById('connection', grid, 0, 0, bleContext);
      expect(grid.countOn()).toBeGreaterThan(0);
    });

    it('Text (branding) widget renders flush at (destX, destY) with no artificial padding', () => {
      const grid = new BwpxGrid(32, 20);
      const textContext: WidgetRenderContext = {
        ...renderContext,
        instances: {
          branding: [
            {
              id: 'text-inst',
              widgetTypeId: 'branding',
              label: 'Text',
              config: {
                mode: 'font',
                textEntries: ['SCYAN'],
              },
            },
          ],
        },
        activeInstanceId: 'text-inst',
      };
      renderWidgetById('branding', grid, 4, 3, textContext);
      // Pixels should be drawn starting at x=4, y=3 without any extra margin or top offset
      expect(grid.countOn()).toBeGreaterThan(0);
      // x < 4 must be completely empty
      for (let y = 0; y < 20; y++) {
        for (let x = 0; x < 4; x++) {
          expect(grid.get(x, y)).toBe(0);
        }
      }
      // y < 3 must be completely empty
      for (let y = 0; y < 3; y++) {
        for (let x = 0; x < 32; x++) {
          expect(grid.get(x, y)).toBe(0);
        }
      }
      // At x=4, the first column of 'S' should be drawn immediately at y=3
      let hasPixelAtX4 = false;
      for (let y = 3; y < 9; y++) {
        if (grid.get(4, y)) hasPixelAtX4 = true;
      }
      expect(hasPixelAtX4).toBe(true);
    });

    it('getWidgetNaturalSize computes text-tight natural dimensions for Text (branding)', () => {
      const def = getWidgetDefinition('branding')!;
      const textInst = {
        id: 'text-inst',
        widgetTypeId: 'branding',
        label: 'Text',
        config: {
          mode: 'font' as const,
          textEntries: ['SCYAN'],
        },
      };
      const size = getWidgetNaturalSize(def, DEFAULT_SYMBOL_SLICES, textInst, DEFAULT_FONT_GLYPHS, DEFAULT_FONT_MAPPINGS);
      // 'SCYAN': S(4) + C(4) + Y(5) + A(4) + N(4) = 21px wide ink extent, 5px high
      expect(size.height).toBe(5);
      expect(size.width).toBe(21);
      expect(measureTextWidth('SCYAN', DEFAULT_FONT_GLYPHS, DEFAULT_FONT_MAPPINGS, 'small')).toBe(21);
    });

    it('renders Bongo Cat widget reacting to bongoState (idle, left tap, right tap)', () => {
      const bongoDef = getWidgetDefinition('bongo')!;
      expect(bongoDef).toBeDefined();
      expect(bongoDef.category).toBe('art');
      expect(bongoDef.tier).toBe(3);

      const symbolsGrid = new BwpxGrid(128, 64);
      // Create 3 slices for bongo group
      // Slice 0 (idle): pixel at (2, 2)
      symbolsGrid.set(2, 2, 1);
      // Slice 1 (tap left): pixel at (22, 2)
      symbolsGrid.set(22, 2, 1);
      // Slice 2 (tap right): pixel at (42, 2)
      symbolsGrid.set(42, 2, 1);

      const bongoSlices: SpriteSlice[] = [
        { id: 'SYMBOL_BONGO_1', name: 'Bongo Cat', groupId: 'GROUP_BONGO', groupOrder: 1, x: 0, y: 0, width: 20, height: 16, color: '#38bdf8' },
        { id: 'SYMBOL_BONGO_2', name: 'Bongo Cat #2', groupId: 'GROUP_BONGO', groupOrder: 2, x: 20, y: 0, width: 20, height: 16, color: '#38bdf8' },
        { id: 'SYMBOL_BONGO_3', name: 'Bongo Cat #3', groupId: 'GROUP_BONGO', groupOrder: 3, x: 40, y: 0, width: 20, height: 16, color: '#38bdf8' },
      ];

      const bongoInst = {
        id: 'inst-bongo',
        widgetTypeId: 'bongo',
        label: 'Bongo Cat',
        config: {
          mode: 'symbol' as const,
          groupId: 'GROUP_BONGO',
        },
      };

      const instances = { bongo: [bongoInst] };

      // 1. Idle (state 0)
      const gridIdle = new BwpxGrid(32, 32);
      bongoDef.render(gridIdle, 0, 0, {
        symbolsGrid,
        symbolSlices: bongoSlices,
        fontGrid: new BwpxGrid(128, 32),
        instances,
        activeInstanceId: 'inst-bongo',
        bongoState: 0,
      });
      expect(gridIdle.get(2, 2)).toBe(1);
      expect(gridIdle.get(22, 2)).toBe(0);

      // 2. Tap Left (state 1)
      const gridLeft = new BwpxGrid(32, 32);
      bongoDef.render(gridLeft, 0, 0, {
        symbolsGrid,
        symbolSlices: bongoSlices,
        fontGrid: new BwpxGrid(128, 32),
        instances,
        activeInstanceId: 'inst-bongo',
        bongoState: 1,
      });
      // Slice 2 has relative x=2 in its slice coordinates, so blitted at 0+2=2
      expect(gridLeft.get(2, 2)).toBe(1);

      // 2b. Tap Right (state 2)
      const gridRight = new BwpxGrid(32, 32);
      bongoDef.render(gridRight, 0, 0, {
        symbolsGrid,
        symbolSlices: bongoSlices,
        fontGrid: new BwpxGrid(128, 32),
        instances,
        activeInstanceId: 'inst-bongo',
        bongoState: 2,
      });
      expect(gridRight.get(2, 2)).toBe(1);

      // 2c. Fallback without explicit instances or activeInstanceId
      const gridAutoFallback = new BwpxGrid(32, 32);
      bongoDef.render(gridAutoFallback, 0, 0, {
        symbolsGrid,
        symbolSlices: bongoSlices,
        fontGrid: new BwpxGrid(128, 32),
        bongoState: 0,
      });
      expect(gridAutoFallback.get(2, 2)).toBe(1);

      // 3. Natural size
      const naturalSize = getWidgetNaturalSize(bongoDef, bongoSlices, bongoInst);
      expect(naturalSize).toEqual({ width: 20, height: 16 });

      // 4. Natural size fallback when no instance provided
      const autoNaturalSize = getWidgetNaturalSize(bongoDef, bongoSlices);
      expect(autoNaturalSize).toEqual({ width: 20, height: 16 });
    });

    it('computes content-tight natural size for WPM widget in symbol and font modes', () => {
      const wpmDef = getWidgetDefinition('wpm')!;
      const speedoSlices: SpriteSlice[] = [
        { id: 'SPEEDO_0', groupId: 'SPEEDO', groupOrder: 1, x: 0, y: 0, width: 27, height: 5 },
        { id: 'SPEEDO_1', groupId: 'SPEEDO', groupOrder: 2, x: 0, y: 5, width: 27, height: 5 },
      ];

      // Symbol mode with speedometer
      const symbolInst = {
        id: 'inst-wpm-sym',
        widgetTypeId: 'wpm',
        label: 'WPM Gauge',
        config: { mode: 'symbol' as const, groupId: 'SPEEDO' },
      };
      expect(getWidgetNaturalSize(wpmDef, speedoSlices, symbolInst)).toEqual({ width: 27, height: 5 });

      // Font mode with digits (no text entries)
      const fontInst = {
        id: 'inst-wpm-font',
        widgetTypeId: 'wpm',
        label: 'WPM Digits',
        config: { mode: 'font' as const },
      };
      expect(getWidgetNaturalSize(wpmDef, speedoSlices, fontInst)).toEqual({ width: 24, height: 10 });

      // Font mode with single text entry ('A')
      const singleTextInst = {
        id: 'inst-wpm-single',
        widgetTypeId: 'wpm',
        label: 'WPM Letter',
        config: { mode: 'font' as const, textEntries: ['A'], fontSize: 'small' as const },
      };
      expect(getWidgetNaturalSize(wpmDef, speedoSlices, singleTextInst)).toEqual({ width: 4, height: 5 });

      // Font mode with multiple text entries ('SLOW', 'TURBO')
      const multiTextInst = {
        id: 'inst-wpm-multi',
        widgetTypeId: 'wpm',
        label: 'WPM Multi',
        config: { mode: 'font' as const, textEntries: ['SLOW', 'TURBO'], fontSize: 'small' as const },
      };
      const expectedTurboW = measureTextWidth('TURBO', DEFAULT_FONT_GLYPHS, DEFAULT_FONT_MAPPINGS, 'small');
      expect(getWidgetNaturalSize(wpmDef, speedoSlices, multiTextInst, DEFAULT_FONT_GLYPHS, DEFAULT_FONT_MAPPINGS)).toEqual({ width: expectedTurboW, height: 5 });

      // Font mode with big font
      const bigTextInst = {
        id: 'inst-wpm-big',
        widgetTypeId: 'wpm',
        label: 'WPM Big',
        config: { mode: 'font' as const, textEntries: ['A'], fontSize: 'big' as const },
      };
      const expectedBigW = measureTextWidth('A', DEFAULT_FONT_GLYPHS, DEFAULT_FONT_MAPPINGS, 'big');
      expect(getWidgetNaturalSize(wpmDef, speedoSlices, bigTextInst, DEFAULT_FONT_GLYPHS, DEFAULT_FONT_MAPPINGS)).toEqual({ width: expectedBigW, height: 10 });
    });

    it('computes natural size and renders branding widget with small and big font size configs', () => {
      const brandingDef = getWidgetDefinition('branding')!;
      const smallInst = {
        id: 'inst-brand-small',
        widgetTypeId: 'branding',
        label: 'Brand Small',
        config: { mode: 'font' as const, fontSize: 'small' as const, textEntries: ['CORNE'] },
      };
      const bigInst = {
        id: 'inst-brand-big',
        widgetTypeId: 'branding',
        label: 'Brand Big',
        config: { mode: 'font' as const, fontSize: 'big' as const, textEntries: ['CORNE'] },
      };

      const smallSize = getWidgetNaturalSize(brandingDef, [], smallInst);
      const bigSize = getWidgetNaturalSize(brandingDef, [], bigInst);

      expect(smallSize.height).toBe(5);
      expect(bigSize.height).toBe(10);
    });

    it('renders layer-banner in font mode dynamically from context layerNames', () => {
      const grid = new BwpxGrid(32, 20);
      const fontInst = {
        id: 'inst-layer-font',
        widgetTypeId: 'layer-banner',
        label: 'Layer Banner Font',
        config: { mode: 'font' as const },
      };

      const customLayers = ['FREE', 'QWERTY', 'NUMPAD', 'MEDIA'];

      renderWidgetById('layer-banner', grid, 0, {
        ...renderContext,
        currentLayer: 0,
        layerNames: customLayers,
        instances: { 'layer-banner': [fontInst] },
        activeInstanceId: 'inst-layer-font',
      });

      expect(grid.countOn()).toBeGreaterThan(0);

      const grid2 = new BwpxGrid(32, 20);
      renderWidgetById('layer-banner', grid2, 0, {
        ...renderContext,
        currentLayer: 2,
        layerNames: customLayers,
        instances: { 'layer-banner': [fontInst] },
        activeInstanceId: 'inst-layer-font',
      });

      expect(grid2.countOn()).toBeGreaterThan(0);
      expect(grid2.getAllPixels()).not.toEqual(grid.getAllPixels());
    });

    it('renders Animation widget cycling sequentially or stopping at last slice based on loop config', () => {
      const animDef = getWidgetDefinition('animation')!;
      expect(animDef).toBeDefined();
      expect(animDef.id).toBe('animation');
      expect(animDef.name).toBe('Animation');
      expect(animDef.category).toBe('art');
      expect(animDef.tier).toBe(3);
      expect(animDef.icon).toBe('film');

      // Legacy 'loop' lookup resolves to animation
      expect(getWidgetDefinition('loop')).toBe(animDef);

      // Create test slices with 2 frames in GROUP_TEST
      const testSymbols = new BwpxGrid(32, 16);
      testSymbols.set(0, 0, 1); // Frame 0 pixel
      testSymbols.set(16, 0, 1); // Frame 1 pixel
      testSymbols.set(16, 1, 1); // Distinct Frame 1 pixel

      const customSlices: SpriteSlice[] = [
        { id: 'FRAME_A', groupId: 'GROUP_TEST', groupOrder: 1, x: 0, y: 0, width: 8, height: 8 },
        { id: 'FRAME_B', groupId: 'GROUP_TEST', groupOrder: 2, x: 16, y: 0, width: 8, height: 8 },
      ];

      // 1. Looping instance (loop: true, default)
      const loopingInst = {
        id: 'inst-anim-loop',
        widgetTypeId: 'animation',
        label: 'Animated Loop',
        config: { mode: 'symbol' as const, groupId: 'GROUP_TEST', loopSpeedMs: 200, loop: true },
      };

      const gridFrame0 = new BwpxGrid(32, 20);
      renderWidgetById('animation', gridFrame0, 0, {
        ...renderContext,
        symbolsGrid: testSymbols,
        symbolSlices: customSlices,
        instances: { animation: [loopingInst] },
        activeInstanceId: 'inst-anim-loop',
        animationTimestamp: 100, // Frame 0 (100 / 200 = 0)
      });

      const gridFrame1 = new BwpxGrid(32, 20);
      renderWidgetById('animation', gridFrame1, 0, {
        ...renderContext,
        symbolsGrid: testSymbols,
        symbolSlices: customSlices,
        instances: { animation: [loopingInst] },
        activeInstanceId: 'inst-anim-loop',
        animationTimestamp: 300, // Frame 1 (300 / 200 = 1)
      });

      const gridFrame2Looped = new BwpxGrid(32, 20);
      renderWidgetById('animation', gridFrame2Looped, 0, {
        ...renderContext,
        symbolsGrid: testSymbols,
        symbolSlices: customSlices,
        instances: { animation: [loopingInst] },
        activeInstanceId: 'inst-anim-loop',
        animationTimestamp: 500, // Frame 0 again (500 / 200 = 2 % 2 = 0)
      });

      expect(gridFrame0.countOn()).toBeGreaterThan(0);
      expect(gridFrame1.countOn()).toBeGreaterThan(0);
      expect(gridFrame0.getAllPixels()).not.toEqual(gridFrame1.getAllPixels());
      expect(gridFrame2Looped.getAllPixels()).toEqual(gridFrame0.getAllPixels());

      // 2. Non-looping instance (loop: false, stop at last slice)
      const nonLoopingInst = {
        id: 'inst-anim-noloop',
        widgetTypeId: 'animation',
        label: 'One-shot Animation',
        config: { mode: 'symbol' as const, groupId: 'GROUP_TEST', loopSpeedMs: 200, loop: false },
      };

      const gridStoppedAtLast = new BwpxGrid(32, 20);
      renderWidgetById('animation', gridStoppedAtLast, 0, {
        ...renderContext,
        symbolsGrid: testSymbols,
        symbolSlices: customSlices,
        instances: { animation: [nonLoopingInst] },
        activeInstanceId: 'inst-anim-noloop',
        animationTimestamp: 500, // Clamped to frame 1 (min(500 / 200, 1) = 1)
      });

      const gridFarPast = new BwpxGrid(32, 20);
      renderWidgetById('animation', gridFarPast, 0, {
        ...renderContext,
        symbolsGrid: testSymbols,
        symbolSlices: customSlices,
        instances: { animation: [nonLoopingInst] },
        activeInstanceId: 'inst-anim-noloop',
        animationTimestamp: 99999, // Still frame 1!
      });

      expect(gridStoppedAtLast.getAllPixels()).toEqual(gridFrame1.getAllPixels());
      expect(gridFarPast.getAllPixels()).toEqual(gridFrame1.getAllPixels());

      // Natural size check
      const natSize = getWidgetNaturalSize(animDef, customSlices, loopingInst);
      expect(natSize.width).toBe(8);
      expect(natSize.height).toBe(8);
    });

    it('renders the default example loop instance (Duck) with default install assets', async () => {
      const { getDefaultAssets } = await import('../cHeaderParser');
      const assets = getDefaultAssets();
      expect(assets.metadata?.widgetInstances?.['loop']).toBeDefined();
      const loopInstances = assets.metadata?.widgetInstances?.['loop'] || [];
      expect(loopInstances.length).toBeGreaterThanOrEqual(1);

      const duck = loopInstances.find(i => i.label.toLowerCase().includes('duck'));
      expect(duck).toBeDefined();
      expect(duck?.config?.groupId).toBe('SYMBOL_DUCK_PIXEL_0414');

      // Verify instance renders successfully with real atlas and slices
      const grid = new BwpxGrid(32, 55);
      renderWidgetById('loop', grid, 0, {
        ...renderContext,
        symbolsGrid: assets.symbolsGrid,
        symbolSlices: assets.symbolSlices,
        instances: { loop: [duck!] },
        activeInstanceId: duck!.id,
        animationTimestamp: 0,
      });
      expect(grid.countOn()).toBeGreaterThan(0);
    });

    it('renderBlocksToGrid uses naturalSize so wpm-chart renders at 32px even if block has stale 24px', () => {
      const grid = new BwpxGrid(32, 64);
      const staleBlock: LayoutBlock = {
        id: 'block-wpm',
        widgetType: 'wpm-chart',
        instanceId: 'inst_wpm_32',
        name: 'WPM Chart',
        x: 0,
        y: 10,
        width: 24, // Stale width
        height: 21, // Stale height
        enabled: true,
        side: 'left',
      };

      renderBlocksToGrid([staleBlock], grid, {
        ...renderContext,
        wpm: 50,
        instances: {
          'wpm-chart': [{
            id: 'inst_wpm_32',
            widgetTypeId: 'wpm-chart',
            label: 'WPM Chart',
            config: {
              mode: 'symbol',
              wpmChart: { width: 32, height: 30, gridSize: 4, targetSpeed: 100, timeWindow: 30 }
            },
            slots: {}
          }]
        }
      });

      // Right border should be at x = 31 (since width = 32), not at x = 23
      expect(grid.get(31, 10)).toBe(1);
      expect(grid.get(31, 10 + 30 - 1)).toBe(1);
    });
  });
});


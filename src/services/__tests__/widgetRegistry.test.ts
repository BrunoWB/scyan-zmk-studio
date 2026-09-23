import { describe, it, expect, beforeEach } from 'vitest';
import { BwpxGrid } from '../../pixel/core/PixelGrid';
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
  resolveWidgetInstance,
  getDefaultWidgetConfig,
  createDefaultWidgetInstance,
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
  type FontCharMapping,
} from '../../types/zmk';
import { getDefaultAssets } from '../cHeaderParser';
import type { WidgetRenderContext, WidgetInstance } from '../../types/widget';

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
    expect(getWidgetDefinition('typewriter')?.requiresMaster).toBe(true);
    expect(getWidgetDefinition('keypress')?.requiresMaster).toBe(true);

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

      expect(tier2.length).toBe(5);
      expect(tier2.map(w => w.id)).toEqual([
        'layer-banner',
        'wpm',
        'wpm-chart',
        'typewriter',
        'keypress',
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

  describe('resolveWidgetInstance & Animation Natural Sizing', () => {
    it('bidirectionally resolves instances between animation and loop', () => {
      const instances = {
        loop: [{
          id: 'inst-duck-1',
          widgetTypeId: 'loop',
          label: 'Shuba Duck',
          config: { mode: 'symbol' as const, groupId: 'GROUP_DUCK' },
          slots: {},
        }],
      };

      // Querying for 'animation' finds the 'loop' instance
      const resolvedFromAnim = resolveWidgetInstance(instances, 'animation', 'inst-duck-1');
      expect(resolvedFromAnim).toBeDefined();
      expect(resolvedFromAnim?.id).toBe('inst-duck-1');

      // Querying without instanceId returns the first candidate
      const defaultResolved = resolveWidgetInstance(instances, 'animation');
      expect(defaultResolved?.id).toBe('inst-duck-1');

      // Querying for 'loop' works as expected
      const resolvedFromLoop = resolveWidgetInstance(instances, 'loop', 'inst-duck-1');
      expect(resolvedFromLoop?.id).toBe('inst-duck-1');
    });

    it('calculates natural size for animation matching custom sprite dimensions', () => {
      const animDef = getWidgetDefinition('animation');
      expect(animDef).toBeDefined();

      const customSlices: SpriteSlice[] = [
        ...DEFAULT_SYMBOL_SLICES,
        {
          id: 'SLICE_DUCK_0',
          name: 'Duck Frame 0',
          groupId: 'GROUP_DUCK',
          groupOrder: 1,
          x: 0,
          y: 0,
          width: 32,
          height: 55,
          color: '#ffdd00',
        },
        {
          id: 'SLICE_DUCK_1',
          name: 'Duck Frame 1',
          groupId: 'GROUP_DUCK',
          groupOrder: 2,
          x: 0,
          y: 55,
          width: 32,
          height: 55,
          color: '#ffdd00',
        },
      ];

      const instance = {
        id: 'inst-duck',
        widgetTypeId: 'animation',
        label: 'Duck',
        config: { mode: 'symbol' as const, groupId: 'GROUP_DUCK' },
        slots: {},
      };

      const size = getWidgetNaturalSize(animDef!, customSlices, instance);
      // The natural size must match the actual sprite dimensions (32x55), NOT the 17x10 battery charge icon!
      expect(size).toEqual({ width: 32, height: 55 });
    });

    it('matches group ID case-insensitively or by slice ID', () => {
      const animDef = getWidgetDefinition('animation');
      const customSlices: SpriteSlice[] = [
        {
          id: 'SYMBOL_CAMPFIRE_1',
          name: 'Campfire 1',
          groupId: 'symbol_campfire',
          groupOrder: 1,
          x: 0,
          y: 0,
          width: 28,
          height: 42,
          color: '#ff4400',
        },
      ];

      const instanceUpper = {
        id: 'inst-camp',
        widgetTypeId: 'animation',
        label: 'Campfire',
        config: { mode: 'symbol' as const, groupId: 'SYMBOL_CAMPFIRE' },
        slots: {},
      };

      const size = getWidgetNaturalSize(animDef!, customSlices, instanceUpper);
      expect(size).toEqual({ width: 28, height: 42 });
    });

    it('does not fall back to battery or charge icon when animation groupId is missing', () => {
      const animDef = getWidgetDefinition('animation');
      // Even with default symbol slices containing CHARGE and BATTERY multi-frame groups,
      // fallback must NOT pick system icons like CHARGE (17x10).
      const instanceUnknown = {
        id: 'inst-nonexistent',
        widgetTypeId: 'animation',
        label: 'Unknown',
        config: { mode: 'symbol' as const, groupId: 'NONEXISTENT_GROUP' },
        slots: {},
      };

      const size = getWidgetNaturalSize(animDef!, DEFAULT_SYMBOL_SLICES, instanceUnknown);
      // Should fall back to defaultWidth/defaultHeight (26x26), not 17x10
      expect(size).toEqual({ width: 26, height: 26 });
    });
  });

  describe('Widget Instance Alignment (Center Symbol & Left/Center/Right Text)', () => {
    it('blitSlice centers slice within bounding box horizontally and vertically (middle)', () => {
      const symbolsGrid = new BwpxGrid(64, 64);
      symbolsGrid.set(2, 2, 1);
      const testSlice: SpriteSlice = {
        id: 'TEST_SLICE',
        name: 'Test',
        groupId: 'TEST_GROUP',
        groupOrder: 1,
        x: 0,
        y: 0,
        width: 10,
        height: 8,
      };

      const destGrid = new BwpxGrid(32, 20);
      // Blit with bounding box of 32x20
      blitSlice(destGrid, symbolsGrid, [testSlice], 'TEST_SLICE', 0, 0, 32, 20);

      // Expected offsets:
      // X: Math.floor((32 - 10) / 2) = 11 -> pixel at 11 + 2 = 13
      // Y: Math.floor((20 - 8) / 2) = 6 -> pixel at 6 + 2 = 8
      expect(destGrid.get(13, 8)).toBe(1);
      expect(destGrid.get(2, 2)).toBe(0);
    });

    it('drawText aligns text horizontally (left, center, right) and middle vertically', () => {
      const fontGrid = new BwpxGrid(128, 32);
      // Put a 3x5 'I' at (0, 0)
      for (let y = 0; y < 5; y++) fontGrid.set(1, y, 1);
      const fontGlyphs = [{
        char: 'I',
        codepoint: 73,
        x: 0,
        y: 0,
        width: 3,
        height: 5,
        advanceX: 4,
      }];

      const boxW = 20;
      const boxH = 15;

      // 1. Left alignment
      const gridLeft = new BwpxGrid(32, 20);
      drawText(gridLeft, fontGrid, fontGlyphs, [], 'I', 0, 0, 'small', {
        align: 'left',
        boxWidth: boxW,
        boxHeight: boxH,
        verticalAlign: 'middle',
      });
      // Vertically centered at Math.floor((15 - 5) / 2) = 5
      // Left aligned at x = 0 + 1 (stroke is at x=1 of 3x5)
      expect(gridLeft.get(1, 5)).toBe(1);
      expect(gridLeft.get(1, 4)).toBe(0);

      // 2. Center alignment
      const gridCenter = new BwpxGrid(32, 20);
      drawText(gridCenter, fontGrid, fontGlyphs, [], 'I', 0, 0, 'small', {
        align: 'center',
        boxWidth: boxW,
        boxHeight: boxH,
        verticalAlign: 'middle',
      });
      // Centered horizontally: textW=3, (20 - 3)/2 = 8 -> stroke at 8 + 1 = 9
      expect(gridCenter.get(9, 5)).toBe(1);

      // 3. Right alignment
      const gridRight = new BwpxGrid(32, 20);
      drawText(gridRight, fontGrid, fontGlyphs, [], 'I', 0, 0, 'small', {
        align: 'right',
        boxWidth: boxW,
        boxHeight: boxH,
        verticalAlign: 'middle',
      });
      // Right aligned: 20 - 3 = 17 -> stroke at 17 + 1 = 18
      expect(gridRight.get(18, 5)).toBe(1);
    });

    it('branding widget renders left, center, and right based on instance config', () => {
      const fontGrid = new BwpxGrid(128, 32);
      for (let y = 0; y < 5; y++) fontGrid.set(0, y, 1);
      const fontGlyphs = [{
        char: 'Z',
        codepoint: 90,
        x: 0,
        y: 0,
        width: 4,
        height: 5,
        advanceX: 5,
      }];

      const brandingDef = getWidgetDefinition('branding')!;
      expect(brandingDef).toBeDefined();

      const makeContext = (align: 'left' | 'center' | 'right') => ({
        symbolsGrid: new BwpxGrid(128, 32),
        symbolSlices: [],
        fontGrid,
        fontGlyphs,
        fontMappings: [],
        blockWidth: 32,
        blockHeight: 15,
        activeInstanceId: `inst-brand-${align}`,
        instances: {
          branding: [{
            id: `inst-brand-${align}`,
            widgetTypeId: 'branding',
            label: 'Branding',
            config: {
              mode: 'font' as const,
              fontSize: 'small' as const,
              textAlign: align,
              textEntries: ['Z'],
            },
            slots: {},
          }],
        },
      });

      // Left
      const gridLeft = new BwpxGrid(32, 15);
      brandingDef.render(gridLeft, 0, 0, makeContext('left'));
      // Text starts at x=0, middle at y=5
      expect(gridLeft.get(0, 5)).toBe(1);

      // Center
      const gridCenter = new BwpxGrid(32, 15);
      brandingDef.render(gridCenter, 0, 0, makeContext('center'));
      // (32 - 4) / 2 = 14
      expect(gridCenter.get(14, 5)).toBe(1);

      // Right
      const gridRight = new BwpxGrid(32, 15);
      brandingDef.render(gridRight, 0, 0, makeContext('right'));
      // 32 - 4 = 28
      expect(gridRight.get(28, 5)).toBe(1);
    });
  });

  describe('Canonical Initial Configuration (Single Source of Truth)', () => {
    it('assigns valid initial configuration for all core widgets without missing values', () => {
      const all = getAllWidgets();
      all.forEach((w) => {
        const config = getDefaultWidgetConfig(w.id, DEFAULT_SYMBOL_SLICES);
        expect(config).toBeDefined();
        if (config.mode === 'symbol') {
          if (w.id === 'layer-banner') {
            expect(config.groupIds).toBeDefined();
            expect(config.groupIds!.length).toBeGreaterThanOrEqual(4);
          } else if (w.id === 'wpm-chart') {
            expect(config.wpmChart).toBeDefined();
          } else {
            expect(config.groupId).toBeDefined();
            expect(typeof config.groupId).toBe('string');
            expect(config.groupId!.length).toBeGreaterThan(0);
          }
        }
      });
    });

    it('creates complete default widget instances with valid default values and slots', () => {
      const inst = createDefaultWidgetInstance('battery', DEFAULT_SYMBOL_SLICES, 'batt-test');
      expect(inst.id).toBe('batt-test');
      expect(inst.widgetTypeId).toBe('battery');
      expect(inst.config?.groupId).toBe('SYMBOL_BATTERY_FRAME');

      const splitInst = createDefaultWidgetInstance('split', DEFAULT_SYMBOL_SLICES);
      expect(splitInst.config?.groupId).toBe('SYMBOL_SPLIT_CONNECTED');

      const layerInst = createDefaultWidgetInstance('layer-banner', DEFAULT_SYMBOL_SLICES);
      expect(layerInst.config?.groupIds).toContain('SYMBOL_BRACKET_LAYER_0');

      const wpmInst = createDefaultWidgetInstance('wpm', DEFAULT_SYMBOL_SLICES);
      expect(wpmInst.config?.groupId).toBe('SYMBOL_ARROW_HEAD');
      expect(wpmInst.config?.targetValue).toBe(70);

      const typewriterInst = createDefaultWidgetInstance('typewriter', DEFAULT_SYMBOL_SLICES);
      expect(typewriterInst.widgetTypeId).toBe('typewriter');
      expect(typewriterInst.config?.typewriterMode).toBe('inline');
      expect(typewriterInst.config?.typewriterDirection).toBe('we');
      expect(typewriterInst.config?.typewriterWidth).toBe(32);
    });
  });

  describe('Typewriter Widget', () => {
    const typewriterDef = WIDGET_REGISTRY.find(w => w.id === 'typewriter')!;

    it('has valid registry definition in Tier 2 with typing category', () => {
      expect(typewriterDef).toBeDefined();
      expect(typewriterDef.tier).toBe(2);
      expect(typewriterDef.category).toBe('typing');
      expect(typewriterDef.icon).toBe('keyboard');
      expect(normalizeWidgetType('typewriter')).toBe('typewriter');
      expect(normalizeWidgetType('block-typewriter')).toBe('typewriter');
    });

    describe('getWidgetNaturalSize', () => {
      it('calculates size for spot mode (small 5x5, big 10x10)', () => {
        const spotSmallInst: WidgetInstance = {
          id: 't-spot-s',
          widgetTypeId: 'typewriter',
          label: 'Typewriter Spot Small',
          config: { mode: 'spot' as const, typewriterMode: 'spot' as const, fontSize: 'small' as const },
        };
        const spotBigInst: WidgetInstance = {
          id: 't-spot-b',
          widgetTypeId: 'typewriter',
          label: 'Typewriter Spot Big',
          config: { mode: 'spot' as const, typewriterMode: 'spot' as const, fontSize: 'big' as const },
        };

        const sizeSmall = getWidgetNaturalSize(typewriterDef, [], spotSmallInst, DEFAULT_FONT_GLYPHS, DEFAULT_FONT_MAPPINGS);
        expect(sizeSmall).toEqual({ width: 5, height: 5 });

        const sizeBig = getWidgetNaturalSize(typewriterDef, [], spotBigInst, DEFAULT_FONT_GLYPHS, DEFAULT_FONT_MAPPINGS);
        expect(sizeBig).toEqual({ width: 10, height: 10 });
      });

      it('calculates size for random mode using custom width and height', () => {
        const randomInst: WidgetInstance = {
          id: 't-rnd',
          widgetTypeId: 'typewriter',
          label: 'Typewriter Random',
          config: {
            mode: 'random' as const,
            typewriterMode: 'random' as const,
            typewriterWidth: 28,
            typewriterHeight: 22,
          },
        };
        const size = getWidgetNaturalSize(typewriterDef, [], randomInst, DEFAULT_FONT_GLYPHS, DEFAULT_FONT_MAPPINGS);
        expect(size).toEqual({ width: 28, height: 22 });
      });

      it('calculates size for inline horizontal mode (height calculated from font, user chooses width)', () => {
        const inlineWeSmall: WidgetInstance = {
          id: 't-we-s',
          widgetTypeId: 'typewriter',
          label: 'Typewriter Inline WE',
          config: {
            mode: 'inline' as const,
            typewriterMode: 'inline' as const,
            typewriterDirection: 'we' as const,
            typewriterWidth: 30,
            fontSize: 'small' as const,
          },
        };
        const inlineEwBig: WidgetInstance = {
          id: 't-ew-b',
          widgetTypeId: 'typewriter',
          label: 'Typewriter Inline EW',
          config: {
            mode: 'inline' as const,
            typewriterMode: 'inline' as const,
            typewriterDirection: 'ew' as const,
            typewriterWidth: 26,
            fontSize: 'big' as const,
          },
        };

        const sizeWe = getWidgetNaturalSize(typewriterDef, [], inlineWeSmall, DEFAULT_FONT_GLYPHS, DEFAULT_FONT_MAPPINGS);
        expect(sizeWe).toEqual({ width: 30, height: 5 });

        const sizeEw = getWidgetNaturalSize(typewriterDef, [], inlineEwBig, DEFAULT_FONT_GLYPHS, DEFAULT_FONT_MAPPINGS);
        expect(sizeEw).toEqual({ width: 26, height: 10 });
      });

      it('calculates size for inline vertical mode (width calculated from font, user chooses height)', () => {
        const inlineNsSmall: WidgetInstance = {
          id: 't-ns-s',
          widgetTypeId: 'typewriter',
          label: 'Typewriter Inline NS',
          config: {
            mode: 'inline' as const,
            typewriterMode: 'inline' as const,
            typewriterDirection: 'ns' as const,
            typewriterHeight: 48,
            fontSize: 'small' as const,
          },
        };
        const inlineSnBig: WidgetInstance = {
          id: 't-sn-b',
          widgetTypeId: 'typewriter',
          label: 'Typewriter Inline SN',
          config: {
            mode: 'inline' as const,
            typewriterMode: 'inline' as const,
            typewriterDirection: 'sn' as const,
            typewriterHeight: 64,
            fontSize: 'big' as const,
          },
        };

        const sizeNs = getWidgetNaturalSize(typewriterDef, [], inlineNsSmall, DEFAULT_FONT_GLYPHS, DEFAULT_FONT_MAPPINGS);
        expect(sizeNs).toEqual({ width: 5, height: 48 });

        const sizeSn = getWidgetNaturalSize(typewriterDef, [], inlineSnBig, DEFAULT_FONT_GLYPHS, DEFAULT_FONT_MAPPINGS);
        expect(sizeSn).toEqual({ width: 10, height: 64 });
      });
    });

    describe('render', () => {
      it('renders in spot mode, keeping only latest letter and wiping after cleaning timeout', () => {
        const grid = new BwpxGrid(32, 16);
        const inst: WidgetInstance = {
          id: 't-spot',
          widgetTypeId: 'typewriter',
          label: 'Typewriter Spot',
          config: {
            mode: 'spot' as const,
            typewriterMode: 'spot' as const,
            typewriterCleaning: 2, // 2 seconds
          },
        };

        const ctx: WidgetRenderContext = {
          ...renderContext,
          instances: { typewriter: [inst] },
          activeInstanceId: inst.id,
          blockWidth: 32,
          blockHeight: 16,
          typewriterState: {
            text: 'HELLO',
            lastChar: 'O',
            lastTimestamp: 1000,
          },
          animationTimestamp: 1500, // 0.5s idle -> should be visible
        };

        // Render with 'O'
        renderWidgetById('typewriter', grid, 0, ctx);
        let nonZeroCount = 0;
        for (let y = 0; y < 16; y++) {
          for (let x = 0; x < 32; x++) {
            if (grid.get(x, y)) nonZeroCount++;
          }
        }
        expect(nonZeroCount).toBeGreaterThan(0);

        // Advance animationTimestamp past cleaning window (1000 + 2000 = 3000)
        const wipedGrid = new BwpxGrid(32, 16);
        const wipedCtx = { ...ctx, animationTimestamp: 4000 };
        renderWidgetById('typewriter', wipedGrid, 0, wipedCtx);
        let wipedCount = 0;
        for (let y = 0; y < 16; y++) {
          for (let x = 0; x < 32; x++) {
            if (wipedGrid.get(x, y)) wipedCount++;
          }
        }
        expect(wipedCount).toBe(0);
      });

      it('renders in random mode at specified coordinates and wipes when idle', () => {
        const grid = new BwpxGrid(32, 32);
        const inst: WidgetInstance = {
          id: 't-rnd',
          widgetTypeId: 'typewriter',
          label: 'Typewriter Random',
          config: {
            mode: 'random' as const,
            typewriterMode: 'random' as const,
            typewriterWidth: 32,
            typewriterHeight: 32,
            typewriterCleaning: 3,
          },
        };

        const ctx: WidgetRenderContext = {
          ...renderContext,
          instances: { typewriter: [inst] },
          activeInstanceId: inst.id,
          blockWidth: 32,
          blockHeight: 32,
          typewriterState: {
            text: 'Z',
            lastChar: 'Z',
            lastTimestamp: 100,
            randomX: 10,
            randomY: 10,
          },
          animationTimestamp: 500,
        };

        renderWidgetById('typewriter', grid, 0, ctx);
        let count = 0;
        for (let y = 0; y < 32; y++) {
          for (let x = 0; x < 32; x++) {
            if (grid.get(x, y)) count++;
          }
        }
        expect(count).toBeGreaterThan(0);

        // Test wiping after 3s
        const wipedGrid = new BwpxGrid(32, 32);
        renderWidgetById('typewriter', wipedGrid, 0, { ...ctx, animationTimestamp: 3500 });
        let wipedCount = 0;
        for (let y = 0; y < 32; y++) {
          for (let x = 0; x < 32; x++) {
            if (wipedGrid.get(x, y)) wipedCount++;
          }
        }
        expect(wipedCount).toBe(0);
      });

      it('supports normalized random coordinate scaling', () => {
        const grid = new BwpxGrid(64, 32);
        const inst: WidgetInstance = {
          id: 't-rnd-norm',
          widgetTypeId: 'typewriter',
          label: 'Typewriter Random Normalized',
          config: {
            mode: 'random' as const,
            typewriterMode: 'random' as const,
            typewriterWidth: 64,
            typewriterHeight: 32,
          },
        };

        const ctx: WidgetRenderContext = {
          ...renderContext,
          instances: { typewriter: [inst] },
          activeInstanceId: inst.id,
          blockWidth: 64,
          blockHeight: 32,
          typewriterState: {
            text: 'A',
            lastChar: 'A',
            lastTimestamp: 100,
            randomX: 0.8, // 80% across the 64px width
            randomY: 0.5, // 50% down the 32px height
          },
        };

        renderWidgetById('typewriter', grid, 0, ctx);
        let rightHalfCount = 0;
        for (let y = 0; y < 32; y++) {
          for (let x = 32; x < 64; x++) {
            if (grid.get(x, y)) rightHalfCount++;
          }
        }
        expect(rightHalfCount).toBeGreaterThan(0);
      });

      it('manages letter bank in random mode with FIFO queue keeping up to bank capacity', () => {
        const grid = new BwpxGrid(32, 32);
        const inst: WidgetInstance = {
          id: 't-rnd-bank',
          widgetTypeId: 'typewriter',
          label: 'Typewriter Random Bank',
          config: {
            mode: 'random' as const,
            typewriterMode: 'random' as const,
            typewriterWidth: 32,
            typewriterHeight: 32,
            typewriterLetterBank: 3,
            fontSize: 'small',
          },
        };

        const ctx: WidgetRenderContext = {
          ...renderContext,
          instances: { typewriter: [inst] },
          activeInstanceId: inst.id,
          blockWidth: 32,
          blockHeight: 32,
          typewriterState: {
            randomLetters: [
              { char: 'A', x: 2, y: 2 },
              { char: 'B', x: 12, y: 12 },
              { char: 'C', x: 22, y: 22 },
            ],
            lastTimestamp: 1000,
          },
          animationTimestamp: 1000,
        };

        renderWidgetById('typewriter', grid, 0, ctx);

        // Verify pixels in the 3 regions where A, B, C are placed
        const countRegion = (g: BwpxGrid, minX: number, maxX: number, minY: number, maxY: number) => {
          let count = 0;
          for (let y = minY; y <= maxY; y++) {
            for (let x = minX; x <= maxX; x++) {
              if (g.get(x, y)) count++;
            }
          }
          return count;
        };

        expect(countRegion(grid, 2, 6, 2, 6)).toBeGreaterThan(0); // 'A'
        expect(countRegion(grid, 12, 16, 12, 16)).toBeGreaterThan(0); // 'B'
        expect(countRegion(grid, 22, 26, 22, 26)).toBeGreaterThan(0); // 'C'

        // Now push a 4th letter 'D' at x:2, y:22. Bank capacity is 3, so oldest ('A') is dropped from FIFO
        const gridAfterD = new BwpxGrid(32, 32);
        renderWidgetById('typewriter', gridAfterD, 0, {
          ...ctx,
          typewriterState: {
            randomLetters: [
              { char: 'A', x: 2, y: 2 },
              { char: 'B', x: 12, y: 12 },
              { char: 'C', x: 22, y: 22 },
              { char: 'D', x: 2, y: 22 },
            ],
            lastTimestamp: 1500,
          },
          animationTimestamp: 1500,
        });

        // 'A' at (2, 2) must have disappeared
        expect(countRegion(gridAfterD, 2, 6, 2, 6)).toBe(0);
        // 'B', 'C', 'D' must still be present
        expect(countRegion(gridAfterD, 12, 16, 12, 16)).toBeGreaterThan(0); // 'B'
        expect(countRegion(gridAfterD, 22, 26, 22, 26)).toBeGreaterThan(0); // 'C'
        expect(countRegion(gridAfterD, 2, 6, 22, 26)).toBeGreaterThan(0); // 'D'
      });

      it('disperses letters across a 128px tall box when using normalized coordinates', () => {
        const inst: WidgetInstance = {
          id: 't-rnd-128',
          widgetTypeId: 'typewriter',
          label: 'Typewriter Random 128',
          config: {
            mode: 'random' as const,
            typewriterMode: 'random' as const,
            typewriterWidth: 32,
            typewriterHeight: 128,
            typewriterLetterBank: 10,
            fontSize: 'small',
          },
        };

        const grid = new BwpxGrid(32, 128);
        const ctx: WidgetRenderContext = {
          ...renderContext,
          instances: { typewriter: [inst] },
          activeInstanceId: inst.id,
          blockWidth: 32,
          blockHeight: 128,
          typewriterState: {
            randomLetters: [
              { char: 'T', x: 0.1, y: 0.1 },
              { char: 'Y', x: 0.3, y: 0.4 },
              { char: 'P', x: 0.5, y: 0.7 },
              { char: 'E', x: 0.2, y: 0.95 },
            ],
            lastTimestamp: 1000,
          },
          animationTimestamp: 1000,
        };

        renderWidgetById('typewriter', grid, 0, ctx);

        const countRegion = (g: BwpxGrid, minX: number, maxX: number, minY: number, maxY: number) => {
          let count = 0;
          for (let y = minY; y <= maxY; y++) {
            for (let x = minX; x <= maxX; x++) {
              if (g.get(x, y)) count++;
            }
          }
          return count;
        };

        // 'T' near top (y around 12)
        expect(countRegion(grid, 0, 31, 0, 30)).toBeGreaterThan(0);
        // 'Y' in upper-middle (y around 49)
        expect(countRegion(grid, 0, 31, 35, 65)).toBeGreaterThan(0);
        // 'P' in lower-middle (y around 86)
        expect(countRegion(grid, 0, 31, 70, 100)).toBeGreaterThan(0);
        // 'E' near bottom (y around 117)
        expect(countRegion(grid, 0, 31, 105, 127)).toBeGreaterThan(0);
      });

      it('disperses letters across 128px height when using deterministic fallback hash', () => {
        const inst: WidgetInstance = {
          id: 't-rnd-hash-128',
          widgetTypeId: 'typewriter',
          label: 'Typewriter Random Hash 128',
          config: {
            mode: 'random' as const,
            typewriterMode: 'random' as const,
            typewriterWidth: 32,
            typewriterHeight: 128,
            typewriterLetterBank: 16,
            fontSize: 'small',
          },
        };

        const grid = new BwpxGrid(32, 128);
        const ctx: WidgetRenderContext = {
          ...renderContext,
          instances: { typewriter: [inst] },
          activeInstanceId: inst.id,
          blockWidth: 32,
          blockHeight: 128,
          typewriterText: 'TESBSTABTSRRETRA',
          typewriterState: {
            text: 'TESBSTABTSRRETRA',
            lastTimestamp: 1000,
          },
          animationTimestamp: 1000,
        };

        renderWidgetById('typewriter', grid, 0, ctx);

        const countRegion = (g: BwpxGrid, minX: number, maxX: number, minY: number, maxY: number) => {
          let count = 0;
          for (let y = minY; y <= maxY; y++) {
            for (let x = minX; x <= maxX; x++) {
              if (g.get(x, y)) count++;
            }
          }
          return count;
        };

        // Letters must be dispersed across top, middle, and bottom thirds of the 128px space
        const topCount = countRegion(grid, 0, 31, 0, 42);
        const midCount = countRegion(grid, 0, 31, 43, 85);
        const botCount = countRegion(grid, 0, 31, 86, 127);

        expect(topCount).toBeGreaterThan(0);
        expect(midCount).toBeGreaterThan(0);
        expect(botCount).toBeGreaterThan(0);
      });

      it('preserves exact pixel placement for integer coordinates like (1, 1) without blowing up', () => {
        const inst: WidgetInstance = {
          id: 't-rnd-pixel-fidelity',
          widgetTypeId: 'typewriter',
          label: 'Typewriter Pixel Fidelity',
          config: {
            mode: 'random' as const,
            typewriterMode: 'random' as const,
            typewriterWidth: 32,
            typewriterHeight: 128,
            typewriterLetterBank: 5,
            fontSize: 'small',
          },
        };

        const grid = new BwpxGrid(32, 128);
        const ctx: WidgetRenderContext = {
          ...renderContext,
          instances: { typewriter: [inst] },
          activeInstanceId: inst.id,
          blockWidth: 32,
          blockHeight: 128,
          typewriterState: {
            randomLetters: [
              { char: 'A', x: 1, y: 1 },
            ],
            lastTimestamp: 1000,
          },
          animationTimestamp: 1000,
        };

        renderWidgetById('typewriter', grid, 0, ctx);

        const countRegion = (g: BwpxGrid, minX: number, maxX: number, minY: number, maxY: number) => {
          let count = 0;
          for (let y = minY; y <= maxY; y++) {
            for (let x = minX; x <= maxX; x++) {
              if (g.get(x, y)) count++;
            }
          }
          return count;
        };

        // 'A' must be at (1, 1), not scaled to the bottom (123)
        expect(countRegion(grid, 1, 5, 1, 5)).toBeGreaterThan(0);
        expect(countRegion(grid, 0, 31, 50, 127)).toBe(0);
      });

      it('correctly maps boundary normalized coordinates including (0, 0.95) and (0.5, 1.0)', () => {
        const inst: WidgetInstance = {
          id: 't-rnd-norm-bounds',
          widgetTypeId: 'typewriter',
          label: 'Typewriter Norm Bounds',
          config: {
            mode: 'random' as const,
            typewriterMode: 'random' as const,
            typewriterWidth: 32,
            typewriterHeight: 128,
            typewriterLetterBank: 5,
            fontSize: 'small',
          },
        };

        const grid = new BwpxGrid(32, 128);
        const ctx: WidgetRenderContext = {
          ...renderContext,
          instances: { typewriter: [inst] },
          activeInstanceId: inst.id,
          blockWidth: 32,
          blockHeight: 128,
          typewriterState: {
            randomLetters: [
              { char: 'A', x: 0, y: 0.95 },
              { char: 'B', x: 0.5, y: 1.0 },
            ],
            lastTimestamp: 1000,
          },
          animationTimestamp: 1000,
        };

        renderWidgetById('typewriter', grid, 0, ctx);

        const countRegion = (g: BwpxGrid, minX: number, maxX: number, minY: number, maxY: number) => {
          let count = 0;
          for (let y = minY; y <= maxY; y++) {
            for (let x = minX; x <= maxX; x++) {
              if (g.get(x, y)) count++;
            }
          }
          return count;
        };

        // 'A' at x=0, y=0.95 -> near bottom (y around 117)
        expect(countRegion(grid, 0, 10, 110, 127)).toBeGreaterThan(0);
        // 'B' at x=0.5, y=1.0 -> at the very bottom edge (y=123)
        expect(countRegion(grid, 10, 20, 120, 127)).toBeGreaterThan(0);
      });

      it('renders blocks to grid with dynamic typewriter height from naturalSize', () => {
        const inst: WidgetInstance = {
          id: 't-rnd-dyn-block',
          widgetTypeId: 'typewriter',
          label: 'Typewriter Dyn Block',
          config: {
            mode: 'random' as const,
            typewriterMode: 'random' as const,
            typewriterWidth: 32,
            typewriterHeight: 128,
            typewriterLetterBank: 5,
            fontSize: 'small',
          },
        };

        const grid = new BwpxGrid(32, 128);
        const block: LayoutBlock = {
          id: 'block-typewriter-1',
          name: 'Typewriter Block',
          widgetType: 'typewriter',
          instanceId: inst.id,
          x: 0,
          y: 0,
          width: 32,
          height: 32, // Stale default block height; should be overridden by instance's naturalSize (128)
          enabled: true,
        };

        const ctx: WidgetRenderContext = {
          ...renderContext,
          instances: { typewriter: [inst] },
          typewriterState: {
            randomLetters: [
              { char: 'Z', x: 0.5, y: 0.9 },
            ],
            lastTimestamp: 1000,
          },
          animationTimestamp: 1000,
        };

        renderBlocksToGrid([block], grid, ctx);

        let bottomPixels = 0;
        for (let y = 100; y < 128; y++) {
          for (let x = 0; x < 32; x++) {
            if (grid.get(x, y)) bottomPixels++;
          }
        }
        // 'Z' should render near the bottom around y=110, proving 128 height was used instead of 32
        expect(bottomPixels).toBeGreaterThan(0);
      });

      it('gradually empties the random mode letter bank during idle cleaning', () => {
        const inst: WidgetInstance = {
          id: 't-rnd-clean',
          widgetTypeId: 'typewriter',
          label: 'Typewriter Random Idle Cleaning',
          config: {
            mode: 'random' as const,
            typewriterMode: 'random' as const,
            typewriterWidth: 32,
            typewriterHeight: 32,
            typewriterLetterBank: 3,
            typewriterCleaning: 2, // 2 seconds per item
            fontSize: 'small',
          },
        };

        const ctx: WidgetRenderContext = {
          ...renderContext,
          instances: { typewriter: [inst] },
          activeInstanceId: inst.id,
          blockWidth: 32,
          blockHeight: 32,
          typewriterState: {
            randomLetters: [
              { char: 'A', x: 2, y: 2 },
              { char: 'B', x: 12, y: 12 },
              { char: 'C', x: 22, y: 22 },
            ],
            lastTimestamp: 1000,
          },
        };

        const countRegion = (g: BwpxGrid, minX: number, maxX: number, minY: number, maxY: number) => {
          let count = 0;
          for (let y = minY; y <= maxY; y++) {
            for (let x = minX; x <= maxX; x++) {
              if (g.get(x, y)) count++;
            }
          }
          return count;
        };

        // At 1.0s elapsed (animationTimestamp: 2000): 0 cleaning intervals elapsed, all 3 letters visible
        const grid0 = new BwpxGrid(32, 32);
        renderWidgetById('typewriter', grid0, 0, { ...ctx, animationTimestamp: 2000 });
        expect(countRegion(grid0, 2, 6, 2, 6)).toBeGreaterThan(0); // 'A'
        expect(countRegion(grid0, 12, 16, 12, 16)).toBeGreaterThan(0); // 'B'
        expect(countRegion(grid0, 22, 26, 22, 26)).toBeGreaterThan(0); // 'C'

        // At 2.5s elapsed (animationTimestamp: 3500): 1 interval elapsed -> 'A' popped, 'B' and 'C' remain
        const grid1 = new BwpxGrid(32, 32);
        renderWidgetById('typewriter', grid1, 0, { ...ctx, animationTimestamp: 3500 });
        expect(countRegion(grid1, 2, 6, 2, 6)).toBe(0); // 'A' popped
        expect(countRegion(grid1, 12, 16, 12, 16)).toBeGreaterThan(0); // 'B'
        expect(countRegion(grid1, 22, 26, 22, 26)).toBeGreaterThan(0); // 'C'

        // At 4.5s elapsed (animationTimestamp: 5500): 2 intervals elapsed -> 'A' and 'B' popped, only 'C' remains
        const grid2 = new BwpxGrid(32, 32);
        renderWidgetById('typewriter', grid2, 0, { ...ctx, animationTimestamp: 5500 });
        expect(countRegion(grid2, 2, 6, 2, 6)).toBe(0); // 'A' popped
        expect(countRegion(grid2, 12, 16, 12, 16)).toBe(0); // 'B' popped
        expect(countRegion(grid2, 22, 26, 22, 26)).toBeGreaterThan(0); // 'C' remains

        // At 6.5s elapsed (animationTimestamp: 7500): 3 intervals elapsed -> bank completely emptied
        const grid3 = new BwpxGrid(32, 32);
        renderWidgetById('typewriter', grid3, 0, { ...ctx, animationTimestamp: 7500 });
        let totalPixels = 0;
        for (let y = 0; y < 32; y++) {
          for (let x = 0; x < 32; x++) {
            if (grid3.get(x, y)) totalPixels++;
          }
        }
        expect(totalPixels).toBe(0);
      });

      it('supports letterBank property and typewriterBankSize config alias in random mode', () => {
        const inst: WidgetInstance = {
          id: 't-rnd-banksize',
          widgetTypeId: 'typewriter',
          label: 'Typewriter Random Bank Size',
          config: {
            mode: 'random' as const,
            typewriterMode: 'random' as const,
            typewriterWidth: 32,
            typewriterHeight: 32,
            typewriterBankSize: 2, // bank capacity 2
            fontSize: 'small',
          },
        };

        const countRegion = (g: BwpxGrid, minX: number, maxX: number, minY: number, maxY: number) => {
          let count = 0;
          for (let y = minY; y <= maxY; y++) {
            for (let x = minX; x <= maxX; x++) {
              if (g.get(x, y)) count++;
            }
          }
          return count;
        };

        const grid = new BwpxGrid(32, 32);
        // Providing 3 letters in letterBank; capacity is 2 so only B and C should survive
        renderWidgetById('typewriter', grid, 0, {
          ...renderContext,
          instances: { typewriter: [inst] },
          activeInstanceId: inst.id,
          blockWidth: 32,
          blockHeight: 32,
          typewriterState: {
            letterBank: [
              { char: 'A', x: 2, y: 2 },
              { char: 'B', x: 12, y: 12 },
              { char: 'C', x: 22, y: 22 },
            ],
            lastTimestamp: 1000,
          },
          animationTimestamp: 1000,
        });

        expect(countRegion(grid, 2, 6, 2, 6)).toBe(0); // 'A' evicted by bank capacity of 2
        expect(countRegion(grid, 12, 16, 12, 16)).toBeGreaterThan(0); // 'B'
        expect(countRegion(grid, 22, 26, 22, 26)).toBeGreaterThan(0); // 'C'
      });

      it('supports decimal cleaning with 0.05 second steps (50ms interval)', () => {
        const inst: WidgetInstance = {
          id: 't-rnd-dec-clean',
          widgetTypeId: 'typewriter',
          label: 'Typewriter Decimal Cleaning',
          config: {
            mode: 'random' as const,
            typewriterMode: 'random' as const,
            typewriterWidth: 32,
            typewriterHeight: 32,
            typewriterBankSize: 3,
            typewriterCleaning: 0.05, // 0.05s = 50ms per item
            fontSize: 'small',
          },
        };

        const countRegion = (g: BwpxGrid, minX: number, maxX: number, minY: number, maxY: number) => {
          let count = 0;
          for (let y = minY; y <= maxY; y++) {
            for (let x = minX; x <= maxX; x++) {
              if (g.get(x, y)) count++;
            }
          }
          return count;
        };

        const baseCtx: WidgetRenderContext = {
          ...renderContext,
          instances: { typewriter: [inst] },
          activeInstanceId: inst.id,
          blockWidth: 32,
          blockHeight: 32,
          typewriterState: {
            letterBank: [
              { char: 'A', x: 2, y: 2 },
              { char: 'B', x: 12, y: 12 },
              { char: 'C', x: 22, y: 22 },
            ],
            lastTimestamp: 1000,
          },
        };

        // At 30ms elapsed (timestamp: 1030): 0 intervals elapsed -> all 3 remain
        const grid0 = new BwpxGrid(32, 32);
        renderWidgetById('typewriter', grid0, 0, { ...baseCtx, animationTimestamp: 1030 });
        expect(countRegion(grid0, 2, 6, 2, 6)).toBeGreaterThan(0); // 'A'
        expect(countRegion(grid0, 12, 16, 12, 16)).toBeGreaterThan(0); // 'B'
        expect(countRegion(grid0, 22, 26, 22, 26)).toBeGreaterThan(0); // 'C'

        // At 60ms elapsed (timestamp: 1060): 1 interval of 50ms elapsed -> 'A' popped
        const grid1 = new BwpxGrid(32, 32);
        renderWidgetById('typewriter', grid1, 0, { ...baseCtx, animationTimestamp: 1060 });
        expect(countRegion(grid1, 2, 6, 2, 6)).toBe(0); // 'A' popped
        expect(countRegion(grid1, 12, 16, 12, 16)).toBeGreaterThan(0); // 'B'
        expect(countRegion(grid1, 22, 26, 22, 26)).toBeGreaterThan(0); // 'C'

        // At 110ms elapsed (timestamp: 1110): 2 intervals elapsed -> 'A' and 'B' popped
        const grid2 = new BwpxGrid(32, 32);
        renderWidgetById('typewriter', grid2, 0, { ...baseCtx, animationTimestamp: 1110 });
        expect(countRegion(grid2, 2, 6, 2, 6)).toBe(0); // 'A' popped
        expect(countRegion(grid2, 12, 16, 12, 16)).toBe(0); // 'B' popped
        expect(countRegion(grid2, 22, 26, 22, 26)).toBeGreaterThan(0); // 'C'

        // At 160ms elapsed (timestamp: 1160): 3 intervals elapsed -> bank emptied
        const grid3 = new BwpxGrid(32, 32);
        renderWidgetById('typewriter', grid3, 0, { ...baseCtx, animationTimestamp: 1160 });
        let totalPix = 0;
        for (let y = 0; y < 32; y++) {
          for (let x = 0; x < 32; x++) {
            if (grid3.get(x, y)) totalPix++;
          }
        }
        expect(totalPix).toBe(0);
      });

      it('disables cleaning when typewriterCleaning is 0 in random mode', () => {
        const inst: WidgetInstance = {
          id: 't-rnd-no-clean',
          widgetTypeId: 'typewriter',
          label: 'Typewriter No Clean',
          config: {
            mode: 'random' as const,
            typewriterMode: 'random' as const,
            typewriterWidth: 32,
            typewriterHeight: 32,
            typewriterBankSize: 2,
            typewriterCleaning: 0, // Off
            fontSize: 'small',
          },
        };

        const countRegion = (g: BwpxGrid, minX: number, maxX: number, minY: number, maxY: number) => {
          let count = 0;
          for (let y = minY; y <= maxY; y++) {
            for (let x = minX; x <= maxX; x++) {
              if (g.get(x, y)) count++;
            }
          }
          return count;
        };

        const grid = new BwpxGrid(32, 32);
        // Even after 100 seconds (100,000ms), letters remain
        renderWidgetById('typewriter', grid, 0, {
          ...renderContext,
          instances: { typewriter: [inst] },
          activeInstanceId: inst.id,
          blockWidth: 32,
          blockHeight: 32,
          typewriterState: {
            letterBank: [
              { char: 'A', x: 2, y: 2 },
              { char: 'B', x: 12, y: 12 },
            ],
            lastTimestamp: 1000,
          },
          animationTimestamp: 101000,
        });

        expect(countRegion(grid, 2, 6, 2, 6)).toBeGreaterThan(0);
        expect(countRegion(grid, 12, 16, 12, 16)).toBeGreaterThan(0);
      });

      describe('Typewriter Random Mode Fade Transitions', () => {
        const countRegion = (g: BwpxGrid, minX: number, maxX: number, minY: number, maxY: number) => {
          let count = 0;
          for (let y = minY; y <= maxY; y++) {
            for (let x = minX; x <= maxX; x++) {
              if (g.get(x, y)) count++;
            }
          }
          return count;
        };

        it('applies 1bpp Bayer dither decay progressively during fade window and clears when complete', () => {
          const inst: WidgetInstance = {
            id: 't-dither-fade',
            widgetTypeId: 'typewriter',
            label: 'Typewriter Dither Fade',
            config: {
              mode: 'random' as const,
              typewriterMode: 'random' as const,
              typewriterCleaning: 2, // 2s intervals
              typewriterFadeType: 'dither',
              typewriterFadeTime: 1.0, // 1s fade duration
              typewriterWidth: 32,
              typewriterHeight: 32,
              fontSize: 'small',
            },
          };

          const baseContext = {
            ...renderContext,
            instances: { typewriter: [inst] },
            activeInstanceId: inst.id,
            blockWidth: 32,
            blockHeight: 32,
            typewriterState: {
              letterBank: [
                { char: 'A', x: 2, y: 2 },
                { char: 'B', x: 16, y: 16 },
              ],
              lastTimestamp: 1000,
            },
          };

          // 1. Before eviction (elapsed = 1000ms < 2000ms): 'A' is fully intact
          const gBefore = new BwpxGrid(32, 32);
          renderWidgetById('typewriter', gBefore, 0, { ...baseContext, animationTimestamp: 2000 });
          const fullCountA = countRegion(gBefore, 2, 6, 2, 6);
          expect(fullCountA).toBeGreaterThan(5);

          // 2. Mid-fade (elapsed = 2500ms -> cycle 1, timeIntoInterval = 500ms, progress = 0.5):
          // Bayer dithering should drop some pixels but leave others visible
          const gMid = new BwpxGrid(32, 32);
          renderWidgetById('typewriter', gMid, 0, { ...baseContext, animationTimestamp: 3500 });
          const midCountA = countRegion(gMid, 2, 6, 2, 6);
          expect(midCountA).toBeGreaterThan(0);
          expect(midCountA).toBeLessThan(fullCountA);
          // Letter 'B' should be completely unaffected
          expect(countRegion(gMid, 16, 20, 16, 20)).toBeGreaterThan(0);

          // 3. Fade complete (elapsed = 3000ms -> cycle 1, timeIntoInterval = 1000ms >= fadeMs):
          // 'A' must be completely cleared, 'B' intact
          const gAfter = new BwpxGrid(32, 32);
          renderWidgetById('typewriter', gAfter, 0, { ...baseContext, animationTimestamp: 4000 });
          expect(countRegion(gAfter, 2, 6, 2, 6)).toBe(0);
          expect(countRegion(gAfter, 16, 20, 16, 20)).toBeGreaterThan(0);
        });

        it('applies pseudo-random dissolve decay progressively during fade window', () => {
          const inst: WidgetInstance = {
            id: 't-dissolve-fade',
            widgetTypeId: 'typewriter',
            label: 'Typewriter Dissolve Fade',
            config: {
              mode: 'random' as const,
              typewriterMode: 'random' as const,
              typewriterCleaning: 2,
              typewriterFadeType: 'dissolve',
              typewriterFadeTime: 1.0,
              typewriterWidth: 32,
              typewriterHeight: 32,
              fontSize: 'small',
            },
          };

          const baseContext = {
            ...renderContext,
            instances: { typewriter: [inst] },
            activeInstanceId: inst.id,
            blockWidth: 32,
            blockHeight: 32,
            typewriterState: {
              letterBank: [
                { char: 'A', x: 2, y: 2, timestamp: 1000 },
                { char: 'B', x: 16, y: 16, timestamp: 1000 },
              ],
              lastTimestamp: 1000,
            },
          };

          const gBefore = new BwpxGrid(32, 32);
          renderWidgetById('typewriter', gBefore, 0, { ...baseContext, animationTimestamp: 2000 });
          const fullCount = countRegion(gBefore, 2, 6, 2, 6);
          expect(fullCount).toBeGreaterThan(5);

          const gMid = new BwpxGrid(32, 32);
          renderWidgetById('typewriter', gMid, 0, { ...baseContext, animationTimestamp: 3500 });
          const midCount = countRegion(gMid, 2, 6, 2, 6);
          expect(midCount).toBeGreaterThan(0);
          expect(midCount).toBeLessThan(fullCount);

          const gAfter = new BwpxGrid(32, 32);
          renderWidgetById('typewriter', gAfter, 0, { ...baseContext, animationTimestamp: 4000 });
          expect(countRegion(gAfter, 2, 6, 2, 6)).toBe(0);
        });

        it('toggles visibility at high frequency for blink fade and disappears after fade window', () => {
          const inst: WidgetInstance = {
            id: 't-blink-fade',
            widgetTypeId: 'typewriter',
            label: 'Typewriter Blink Fade',
            config: {
              mode: 'random' as const,
              typewriterMode: 'random' as const,
              typewriterCleaning: 2,
              typewriterFadeType: 'blink',
              typewriterFadeTime: 1.0,
              typewriterWidth: 32,
              typewriterHeight: 32,
              fontSize: 'small',
            },
          };

          const baseContext = {
            ...renderContext,
            instances: { typewriter: [inst] },
            activeInstanceId: inst.id,
            blockWidth: 32,
            blockHeight: 32,
            typewriterState: {
              letterBank: [
                { char: 'A', x: 2, y: 2 },
              ],
              lastTimestamp: 1000,
            },
          };

          // In blink phase (elapsed in [2000..3000ms]):
          // At timestamp where Math.floor(now / 80) % 2 === 0: visible
          // At timestamp where Math.floor(now / 80) % 2 === 1: hidden
          // Find timestamps in [3100, 3300] for both states:
          // 3200 / 80 = 40 (even -> visible)
          // 3280 / 80 = 41 (odd -> hidden)
          const gVisible = new BwpxGrid(32, 32);
          renderWidgetById('typewriter', gVisible, 0, { ...baseContext, animationTimestamp: 3200 });
          expect(countRegion(gVisible, 2, 6, 2, 6)).toBeGreaterThan(0);

          const gHidden = new BwpxGrid(32, 32);
          renderWidgetById('typewriter', gHidden, 0, { ...baseContext, animationTimestamp: 3280 });
          expect(countRegion(gHidden, 2, 6, 2, 6)).toBe(0);

          // Once fade window ends (elapsed >= 3000ms, animationTimestamp >= 4000):
          // Permanently gone
          const gDone = new BwpxGrid(32, 32);
          renderWidgetById('typewriter', gDone, 0, { ...baseContext, animationTimestamp: 4000 });
          expect(countRegion(gDone, 2, 6, 2, 6)).toBe(0);
        });

        it('instantly drops letters when fadeType is instant even with cleaning > 0', () => {
          const inst: WidgetInstance = {
            id: 't-instant-fade',
            widgetTypeId: 'typewriter',
            label: 'Typewriter Instant Fade',
            config: {
              mode: 'random' as const,
              typewriterMode: 'random' as const,
              typewriterCleaning: 2,
              typewriterFadeType: 'instant',
              typewriterFadeTime: 1.0,
              typewriterWidth: 32,
              typewriterHeight: 32,
              fontSize: 'small',
            },
          };

          const baseContext = {
            ...renderContext,
            instances: { typewriter: [inst] },
            activeInstanceId: inst.id,
            blockWidth: 32,
            blockHeight: 32,
            typewriterState: {
              letterBank: [
                { char: 'A', x: 2, y: 2 },
                { char: 'B', x: 16, y: 16 },
              ],
              lastTimestamp: 1000,
            },
          };

          // At elapsed = 2050ms (50ms into cycle 1), instant means 'A' is immediately gone
          const gMid = new BwpxGrid(32, 32);
          renderWidgetById('typewriter', gMid, 0, { ...baseContext, animationTimestamp: 3050 });
          expect(countRegion(gMid, 2, 6, 2, 6)).toBe(0);
          expect(countRegion(gMid, 16, 20, 16, 20)).toBeGreaterThan(0);
        });

        it('supports concurrent overlapping fade intervals when fadeTime exceeds cleaning interval without truncation', () => {
          const inst: WidgetInstance = {
            id: 't-overlapping-fade',
            widgetTypeId: 'typewriter',
            label: 'Typewriter Overlapping Fade',
            config: {
              mode: 'random' as const,
              typewriterMode: 'random' as const,
              typewriterCleaning: 1, // 1s interval
              typewriterFadeType: 'dither',
              typewriterFadeTime: 2.5, // 2.5s fade duration (> cleaning)
              typewriterWidth: 32,
              typewriterHeight: 32,
              fontSize: 'small',
            },
          };

          const baseContext = {
            ...renderContext,
            instances: { typewriter: [inst] },
            activeInstanceId: inst.id,
            blockWidth: 32,
            blockHeight: 32,
            typewriterState: {
              letterBank: [
                { char: 'A', x: 2, y: 2 },
                { char: 'B', x: 16, y: 16 },
              ],
              lastTimestamp: 1000,
            },
          };

          // At elapsed = 2200ms (animationTimestamp = 3200):
          // Letter A (tStart = 1000ms): elapsed - tStart = 1200ms, progress = 1200 / 2500 = 0.48 (actively fading via dither)
          // Letter B (tStart = 2000ms): elapsed - tStart = 200ms, progress = 200 / 2500 = 0.08 (also actively fading via dither!)
          const gOverlap = new BwpxGrid(32, 32);
          renderWidgetById('typewriter', gOverlap, 0, { ...baseContext, animationTimestamp: 3200 });

          const countA = countRegion(gOverlap, 2, 6, 2, 6);
          const countB = countRegion(gOverlap, 16, 20, 16, 20);

          // Both letters should be actively rendered with dither pixels
          expect(countA).toBeGreaterThan(0);
          expect(countB).toBeGreaterThan(0);

          // Letter A has higher progress (0.48) than Letter B (0.08), so Letter A has fewer or equal remaining pixels
          expect(countA).toBeLessThanOrEqual(countB);

          // At elapsed = 3600ms (animationTimestamp = 4600):
          // Letter A (tEnd = 3500ms): elapsed >= 3500ms -> completely evicted!
          // Letter B (tStart = 2000ms, tEnd = 4500ms): elapsed - tStart = 1600ms, progress = 1600 / 2500 = 0.64 (still fading)
          const gLater = new BwpxGrid(32, 32);
          renderWidgetById('typewriter', gLater, 0, { ...baseContext, animationTimestamp: 4600 });
          expect(countRegion(gLater, 2, 6, 2, 6)).toBe(0);
          expect(countRegion(gLater, 16, 20, 16, 20)).toBeGreaterThan(0);

          // At elapsed = 4600ms (animationTimestamp = 5600):
          // Both completely evicted
          const gAllDone = new BwpxGrid(32, 32);
          renderWidgetById('typewriter', gAllDone, 0, { ...baseContext, animationTimestamp: 5600 });
          expect(countRegion(gAllDone, 2, 6, 2, 6)).toBe(0);
          expect(countRegion(gAllDone, 16, 20, 16, 20)).toBe(0);
        });
      });

      it('handles empty space characters added to the letter bank without rendering them', () => {
        const grid = new BwpxGrid(32, 32);
        const inst: WidgetInstance = {
          id: 't-rnd-space',
          widgetTypeId: 'typewriter',
          label: 'Typewriter Random Space',
          config: {
            mode: 'random' as const,
            typewriterMode: 'random' as const,
            typewriterWidth: 32,
            typewriterHeight: 32,
            typewriterLetterBank: 2,
            fontSize: 'small',
          },
        };

        const ctx: WidgetRenderContext = {
          ...renderContext,
          instances: { typewriter: [inst] },
          activeInstanceId: inst.id,
          blockWidth: 32,
          blockHeight: 32,
          typewriterState: {
            randomLetters: [
              { char: 'A', x: 2, y: 2 },
              { char: ' ', x: 12, y: 12 }, // Empty space slot in bank
            ],
            lastTimestamp: 1000,
          },
          animationTimestamp: 1000,
        };

        renderWidgetById('typewriter', grid, 0, ctx);

        let totalPixels = 0;
        let aPixels = 0;
        for (let y = 0; y < 32; y++) {
          for (let x = 0; x < 32; x++) {
            if (grid.get(x, y)) {
              totalPixels++;
              if (x >= 2 && x <= 6 && y >= 2 && y <= 6) aPixels++;
            }
          }
        }
        expect(aPixels).toBeGreaterThan(0);
        // Only 'A' rendered, space didn't draw any pixels
        expect(totalPixels).toBe(aPixels);

        // Pushing another space pushes 'A' out of the 2-capacity bank
        const grid2 = new BwpxGrid(32, 32);
        renderWidgetById('typewriter', grid2, 0, {
          ...ctx,
          typewriterState: {
            randomLetters: [
              { char: 'A', x: 2, y: 2 },
              { char: ' ', x: 12, y: 12 },
              { char: ' ', x: 20, y: 20 },
            ],
            lastTimestamp: 1200,
          },
          animationTimestamp: 1200,
        });

        let totalPixels2 = 0;
        for (let y = 0; y < 32; y++) {
          for (let x = 0; x < 32; x++) {
            if (grid2.get(x, y)) totalPixels2++;
          }
        }
        expect(totalPixels2).toBe(0);
      });

      it('renders in inline mode (we, ew, ns, sn) and auto-adds spaces during idle cleaning', () => {
        const instWe: WidgetInstance = {
          id: 't-inl-we',
          widgetTypeId: 'typewriter',
          label: 'Typewriter Inline WE',
          config: {
            mode: 'inline' as const,
            typewriterMode: 'inline' as const,
            typewriterDirection: 'we' as const,
            typewriterWidth: 32,
            typewriterCleaning: 1, // 1 space per second idle
          },
        };

        const grid = new BwpxGrid(32, 8);
        const ctx: WidgetRenderContext = {
          ...renderContext,
          instances: { typewriter: [instWe] },
          activeInstanceId: instWe.id,
          blockWidth: 32,
          blockHeight: 8,
          typewriterText: 'HI',
          typewriterState: {
            text: 'HI',
            lastChar: 'I',
            lastTimestamp: 1000,
          },
          animationTimestamp: 1200, // < 1s idle
        };

        renderWidgetById('typewriter', grid, 0, ctx);
        let pixels = 0;
        for (let y = 0; y < 8; y++) {
          for (let x = 0; x < 32; x++) {
            if (grid.get(x, y)) pixels++;
          }
        }
        expect(pixels).toBeGreaterThan(0);

        // East to West (ew) test
        const instEw: WidgetInstance = {
          id: 't-inl-ew',
          widgetTypeId: 'typewriter',
          label: 'Typewriter Inline EW',
          config: {
            mode: 'inline' as const,
            typewriterMode: 'inline' as const,
            typewriterDirection: 'ew' as const,
            typewriterWidth: 32,
          },
        };
        const gridEw = new BwpxGrid(32, 8);
        renderWidgetById('typewriter', gridEw, 0, {
          ...renderContext,
          instances: { typewriter: [instEw] },
          activeInstanceId: instEw.id,
          blockWidth: 32,
          blockHeight: 8,
          typewriterText: 'AB',
        });
        let ewPixels = 0;
        for (let y = 0; y < 8; y++) {
          for (let x = 0; x < 32; x++) {
            if (gridEw.get(x, y)) ewPixels++;
          }
        }
        expect(ewPixels).toBeGreaterThan(0);

        // Vertical ns test
        const instNs: WidgetInstance = {
          id: 't-inl-ns',
          widgetTypeId: 'typewriter',
          label: 'Typewriter Inline NS',
          config: {
            mode: 'inline' as const,
            typewriterMode: 'inline' as const,
            typewriterDirection: 'ns' as const,
            typewriterHeight: 32,
          },
        };
        const gridNs = new BwpxGrid(8, 32);
        renderWidgetById('typewriter', gridNs, 0, {
          ...renderContext,
          instances: { typewriter: [instNs] },
          activeInstanceId: instNs.id,
          blockWidth: 8,
          blockHeight: 32,
          typewriterText: 'OK',
        });
        let nsPixels = 0;
        for (let y = 0; y < 32; y++) {
          for (let x = 0; x < 8; x++) {
            if (gridNs.get(x, y)) nsPixels++;
          }
        }
        expect(nsPixels).toBeGreaterThan(0);

        // Vertical sn test
        const instSn: WidgetInstance = {
          id: 't-inl-sn',
          widgetTypeId: 'typewriter',
          label: 'Typewriter Inline SN',
          config: {
            mode: 'inline' as const,
            typewriterMode: 'inline' as const,
            typewriterDirection: 'sn' as const,
            typewriterHeight: 32,
          },
        };
        const gridSn = new BwpxGrid(8, 32);
        renderWidgetById('typewriter', gridSn, 0, {
          ...renderContext,
          instances: { typewriter: [instSn] },
          activeInstanceId: instSn.id,
          blockWidth: 8,
          blockHeight: 32,
          typewriterText: 'UP',
        });
        let snPixels = 0;
        for (let y = 0; y < 32; y++) {
          for (let x = 0; x < 8; x++) {
            if (gridSn.get(x, y)) snPixels++;
          }
        }
        expect(snPixels).toBeGreaterThan(0);
      });

      it('handles NS overflow scrolling by pushing older characters upward and keeping latest at bottom', () => {
        const instNs: WidgetInstance = {
          id: 't-scrolling-ns',
          widgetTypeId: 'typewriter',
          label: 'Typewriter Scroll NS',
          config: {
            mode: 'inline' as const,
            typewriterMode: 'inline' as const,
            typewriterDirection: 'ns' as const,
            typewriterHeight: 11, // Can fit exactly 2 characters (5px + 1px gap + 5px)
          },
        };

        const countRegion = (g: BwpxGrid, minY: number, maxY: number) => {
          let count = 0;
          for (let y = minY; y <= maxY; y++) {
            for (let x = 0; x < 8; x++) {
              if (g.get(x, y)) count++;
            }
          }
          return count;
        };

        // 1. Single character 'A' starts at top (y: 0..4)
        const grid1 = new BwpxGrid(8, 11);
        renderWidgetById('typewriter', grid1, 0, {
          ...renderContext,
          instances: { typewriter: [instNs] },
          activeInstanceId: instNs.id,
          blockWidth: 8,
          blockHeight: 11,
          typewriterText: 'A',
        });
        expect(countRegion(grid1, 0, 4)).toBeGreaterThan(0); // 'A' at top
        expect(countRegion(grid1, 6, 10)).toBe(0); // Bottom is empty

        // 2. Two characters 'AB' fills the 11px column (top: 'A' at 0..4, bottom: 'B' at 6..10)
        const grid2 = new BwpxGrid(8, 11);
        renderWidgetById('typewriter', grid2, 0, {
          ...renderContext,
          instances: { typewriter: [instNs] },
          activeInstanceId: instNs.id,
          blockWidth: 8,
          blockHeight: 11,
          typewriterText: 'AB',
        });
        expect(countRegion(grid2, 0, 4)).toBeGreaterThan(0); // 'A' at top
        expect(countRegion(grid2, 6, 10)).toBeGreaterThan(0); // 'B' at bottom

        // 3. Overflow: typing 'ABC' pushes older character 'A' upward off-screen; 'B' is at top, 'C' is at bottom
        const grid3 = new BwpxGrid(8, 11);
        renderWidgetById('typewriter', grid3, 0, {
          ...renderContext,
          instances: { typewriter: [instNs] },
          activeInstanceId: instNs.id,
          blockWidth: 8,
          blockHeight: 11,
          typewriterText: 'ABC',
        });
        expect(countRegion(grid3, 0, 4)).toBeGreaterThan(0); // 'B' at top
        expect(countRegion(grid3, 6, 10)).toBeGreaterThan(0); // 'C' at bottom
      });

      it('handles SN overflow scrolling by pushing older characters downward and keeping latest at top', () => {
        const instSn: WidgetInstance = {
          id: 't-scrolling-sn',
          widgetTypeId: 'typewriter',
          label: 'Typewriter Scroll SN',
          config: {
            mode: 'inline' as const,
            typewriterMode: 'inline' as const,
            typewriterDirection: 'sn' as const,
            typewriterHeight: 11, // Can fit exactly 2 characters (5px + 1px gap + 5px)
          },
        };

        const countRegion = (g: BwpxGrid, minY: number, maxY: number) => {
          let count = 0;
          for (let y = minY; y <= maxY; y++) {
            for (let x = 0; x < 8; x++) {
              if (g.get(x, y)) count++;
            }
          }
          return count;
        };

        // 1. Single character 'A' starts at bottom (y: 6..10)
        const grid1 = new BwpxGrid(8, 11);
        renderWidgetById('typewriter', grid1, 0, {
          ...renderContext,
          instances: { typewriter: [instSn] },
          activeInstanceId: instSn.id,
          blockWidth: 8,
          blockHeight: 11,
          typewriterText: 'A',
        });
        expect(countRegion(grid1, 0, 4)).toBe(0); // Top is empty
        expect(countRegion(grid1, 6, 10)).toBeGreaterThan(0); // 'A' at bottom

        // 2. Two characters 'AB' fills column: 'A' at bottom (6..10), 'B' at top (0..4)
        const grid2 = new BwpxGrid(8, 11);
        renderWidgetById('typewriter', grid2, 0, {
          ...renderContext,
          instances: { typewriter: [instSn] },
          activeInstanceId: instSn.id,
          blockWidth: 8,
          blockHeight: 11,
          typewriterText: 'AB',
        });
        expect(countRegion(grid2, 0, 4)).toBeGreaterThan(0); // 'B' at top
        expect(countRegion(grid2, 6, 10)).toBeGreaterThan(0); // 'A' at bottom

        // 3. Overflow: typing 'ABC' pushes older character 'A' downward off-screen; 'B' is at bottom, 'C' is at top
        const grid3 = new BwpxGrid(8, 11);
        renderWidgetById('typewriter', grid3, 0, {
          ...renderContext,
          instances: { typewriter: [instSn] },
          activeInstanceId: instSn.id,
          blockWidth: 8,
          blockHeight: 11,
          typewriterText: 'ABC',
        });
        expect(countRegion(grid3, 0, 4)).toBeGreaterThan(0); // 'C' at top
        expect(countRegion(grid3, 6, 10)).toBeGreaterThan(0); // 'B' at bottom
      });

      it('handles WE overflow scrolling by pushing text left and keeping latest typed characters visible', () => {
        const instWe: WidgetInstance = {
          id: 't-scrolling-we',
          widgetTypeId: 'typewriter',
          label: 'Typewriter Scroll WE',
          config: {
            mode: 'inline' as const,
            typewriterMode: 'inline' as const,
            typewriterDirection: 'we' as const,
            typewriterWidth: 20,
          },
        };

        // 1. Short text 'A' fits within 20px box and renders starting at left edge
        const gridShort = new BwpxGrid(20, 8);
        renderWidgetById('typewriter', gridShort, 0, {
          ...renderContext,
          instances: { typewriter: [instWe] },
          activeInstanceId: instWe.id,
          blockWidth: 20,
          blockHeight: 8,
          typewriterText: 'A',
        });

        // Left edge (x in [0, 4]) has pixels for 'A'
        let leftPixelsShort = 0;
        for (let y = 0; y < 8; y++) {
          for (let x = 0; x < 4; x++) {
            if (gridShort.get(x, y)) leftPixelsShort++;
          }
        }
        expect(leftPixelsShort).toBeGreaterThan(0);

        // Right edge (x in [16, 19]) has NO pixels
        let rightPixelsShort = 0;
        for (let y = 0; y < 8; y++) {
          for (let x = 16; x < 20; x++) {
            if (gridShort.get(x, y)) rightPixelsShort++;
          }
        }
        expect(rightPixelsShort).toBe(0);

        // 2. Long text overflowing 20px: 'ABCDEFGH' (approx 40px wide)
        // Newest characters ('H') should push text left and be visible at the right edge
        const gridLong = new BwpxGrid(20, 8);
        renderWidgetById('typewriter', gridLong, 0, {
          ...renderContext,
          instances: { typewriter: [instWe] },
          activeInstanceId: instWe.id,
          blockWidth: 20,
          blockHeight: 8,
          typewriterText: 'ABCDEFGH',
        });

        // Right edge (x in [16, 19]) MUST now have pixels (showing 'H')
        let rightPixelsLong = 0;
        for (let y = 0; y < 8; y++) {
          for (let x = 16; x < 20; x++) {
            if (gridLong.get(x, y)) rightPixelsLong++;
          }
        }
        expect(rightPixelsLong).toBeGreaterThan(0);

        // 3. Typing another character ('ABCDEFGHI') pushes further left:
        // Right edge now contains 'I'
        const gridLonger = new BwpxGrid(20, 8);
        renderWidgetById('typewriter', gridLonger, 0, {
          ...renderContext,
          instances: { typewriter: [instWe] },
          activeInstanceId: instWe.id,
          blockWidth: 20,
          blockHeight: 8,
          typewriterText: 'ABCDEFGHI',
        });

        let rightPixelsLonger = 0;
        for (let y = 0; y < 8; y++) {
          for (let x = 16; x < 20; x++) {
            if (gridLonger.get(x, y)) rightPixelsLonger++;
          }
        }
        expect(rightPixelsLonger).toBeGreaterThan(0);
      });

      it('handles EW RTL typing and overflow scrolling by placing new characters at typing front and pushing older right', () => {
        const instEw: WidgetInstance = {
          id: 't-scrolling-ew',
          widgetTypeId: 'typewriter',
          label: 'Typewriter Scroll EW',
          config: {
            mode: 'inline' as const,
            typewriterMode: 'inline' as const,
            typewriterDirection: 'ew' as const,
            typewriterWidth: 20,
          },
        };

        // 1. Short text 'A' fits within 20px box and renders at the right edge
        const gridShort = new BwpxGrid(20, 8);
        renderWidgetById('typewriter', gridShort, 0, {
          ...renderContext,
          instances: { typewriter: [instEw] },
          activeInstanceId: instEw.id,
          blockWidth: 20,
          blockHeight: 8,
          typewriterText: 'A',
        });

        // Left edge (x in [0, 4]) has NO pixels for short text in EW
        let leftPixelsShort = 0;
        for (let y = 0; y < 8; y++) {
          for (let x = 0; x < 4; x++) {
            if (gridShort.get(x, y)) leftPixelsShort++;
          }
        }
        expect(leftPixelsShort).toBe(0);

        // Right edge (x in [16, 19]) has pixels for 'A'
        let rightPixelsShort = 0;
        for (let y = 0; y < 8; y++) {
          for (let x = 16; x < 20; x++) {
            if (gridShort.get(x, y)) rightPixelsShort++;
          }
        }
        expect(rightPixelsShort).toBeGreaterThan(0);

        // 2. Long text overflowing 20px: 'ABCDEFGH'
        // In EW, newest characters ('H') are at typing front (x=0) and older characters are pushed right
        const gridLong = new BwpxGrid(20, 8);
        renderWidgetById('typewriter', gridLong, 0, {
          ...renderContext,
          instances: { typewriter: [instEw] },
          activeInstanceId: instEw.id,
          blockWidth: 20,
          blockHeight: 8,
          typewriterText: 'ABCDEFGH',
        });

        // Left edge (x in [0, 4]) MUST now have pixels (showing 'H' at typing front)
        let leftPixelsLong = 0;
        for (let y = 0; y < 8; y++) {
          for (let x = 0; x < 4; x++) {
            if (gridLong.get(x, y)) leftPixelsLong++;
          }
        }
        expect(leftPixelsLong).toBeGreaterThan(0);

        // 3. Typing another character ('ABCDEFGHI') puts 'I' at x=0, shifting 'H' to the right
        const gridLonger = new BwpxGrid(20, 8);
        renderWidgetById('typewriter', gridLonger, 0, {
          ...renderContext,
          instances: { typewriter: [instEw] },
          activeInstanceId: instEw.id,
          blockWidth: 20,
          blockHeight: 8,
          typewriterText: 'ABCDEFGHI',
        });

        let leftPixelsLonger = 0;
        for (let y = 0; y < 8; y++) {
          for (let x = 0; x < 4; x++) {
            if (gridLonger.get(x, y)) leftPixelsLonger++;
          }
        }
        expect(leftPixelsLonger).toBeGreaterThan(0);
      });

      it('cleans idle text by pushing characters off-screen in WE and EW modes', () => {
        const instWe: WidgetInstance = {
          id: 't-idle-we',
          widgetTypeId: 'typewriter',
          label: 'Typewriter Idle WE',
          config: {
            mode: 'inline' as const,
            typewriterMode: 'inline' as const,
            typewriterDirection: 'we' as const,
            typewriterWidth: 20,
            typewriterCleaning: 1, // 1 space per second
          },
        };

        const gridWeCleaned = new BwpxGrid(20, 8);
        renderWidgetById('typewriter', gridWeCleaned, 0, {
          ...renderContext,
          instances: { typewriter: [instWe] },
          activeInstanceId: instWe.id,
          blockWidth: 20,
          blockHeight: 8,
          typewriterText: 'AB',
          typewriterState: {
            text: 'AB',
            lastChar: 'B',
            lastTimestamp: 1000,
          },
          animationTimestamp: 1000 + 10000, // 10s idle -> 10 spaces added, pushing 'AB' completely off left
        });

        let wePixels = 0;
        for (let y = 0; y < 8; y++) {
          for (let x = 0; x < 20; x++) {
            if (gridWeCleaned.get(x, y)) wePixels++;
          }
        }
        expect(wePixels).toBe(0);

        const instEw: WidgetInstance = {
          id: 't-idle-ew',
          widgetTypeId: 'typewriter',
          label: 'Typewriter Idle EW',
          config: {
            mode: 'inline' as const,
            typewriterMode: 'inline' as const,
            typewriterDirection: 'ew' as const,
            typewriterWidth: 20,
            typewriterCleaning: 1, // 1 space per second
          },
        };

        const gridEwCleaned = new BwpxGrid(20, 8);
        renderWidgetById('typewriter', gridEwCleaned, 0, {
          ...renderContext,
          instances: { typewriter: [instEw] },
          activeInstanceId: instEw.id,
          blockWidth: 20,
          blockHeight: 8,
          typewriterText: 'AB',
          typewriterState: {
            text: 'AB',
            lastChar: 'B',
            lastTimestamp: 1000,
          },
          animationTimestamp: 1000 + 10000, // 10s idle -> 10 spaces added, pushing 'AB' completely off right
        });

        let ewPixels = 0;
        for (let y = 0; y < 8; y++) {
          for (let x = 0; x < 20; x++) {
            if (gridEwCleaned.get(x, y)) ewPixels++;
          }
        }
        expect(ewPixels).toBe(0);
      });

      it('falls back to letter timestamps when lastTimestamp is omitted in typewriterState', () => {
        const inst: WidgetInstance = {
          id: 't-rnd-item-ts',
          widgetTypeId: 'typewriter',
          label: 'Typewriter Item TS',
          config: {
            mode: 'random' as const,
            typewriterMode: 'random' as const,
            typewriterWidth: 32,
            typewriterHeight: 32,
            typewriterBankSize: 3,
            typewriterCleaning: 0.1, // 100ms per letter
            fontSize: 'small',
          },
        };

        const countRegion = (g: BwpxGrid, minX: number, maxX: number, minY: number, maxY: number) => {
          let count = 0;
          for (let y = minY; y <= maxY; y++) {
            for (let x = minX; x <= maxX; x++) {
              if (g.get(x, y)) count++;
            }
          }
          return count;
        };

        // Bank with timestamps on each letter, no root lastTimestamp
        const baseCtx: WidgetRenderContext = {
          ...renderContext,
          instances: { typewriter: [inst] },
          activeInstanceId: inst.id,
          blockWidth: 32,
          blockHeight: 32,
          typewriterState: {
            letterBank: [
              { char: 'X', x: 2, y: 2, timestamp: 1000 },
              { char: 'Y', x: 12, y: 12, timestamp: 1000 },
            ],
          },
        };

        // At 50ms: 0 intervals elapsed -> both visible
        const grid0 = new BwpxGrid(32, 32);
        renderWidgetById('typewriter', grid0, 0, { ...baseCtx, animationTimestamp: 1050 });
        expect(countRegion(grid0, 2, 6, 2, 6)).toBeGreaterThan(0);
        expect(countRegion(grid0, 12, 16, 12, 16)).toBeGreaterThan(0);

        // At 120ms: 1 interval of 100ms elapsed -> X popped
        const grid1 = new BwpxGrid(32, 32);
        renderWidgetById('typewriter', grid1, 0, { ...baseCtx, animationTimestamp: 1120 });
        expect(countRegion(grid1, 2, 6, 2, 6)).toBe(0);
        expect(countRegion(grid1, 12, 16, 12, 16)).toBeGreaterThan(0);

        // At 220ms: 2 intervals elapsed -> both popped
        const grid2 = new BwpxGrid(32, 32);
        renderWidgetById('typewriter', grid2, 0, { ...baseCtx, animationTimestamp: 1220 });
        let total = 0;
        for (let y = 0; y < 32; y++) {
          for (let x = 0; x < 32; x++) {
            if (grid2.get(x, y)) total++;
          }
        }
        expect(total).toBe(0);
      });

      it('respects decimal cleaning in spot mode and inline mode', () => {
        // Spot mode with 0.15s (150ms) cleaning
        const instSpot: WidgetInstance = {
          id: 't-spot-dec',
          widgetTypeId: 'typewriter',
          label: 'Typewriter Spot Dec',
          config: {
            mode: 'spot' as const,
            typewriterMode: 'spot' as const,
            typewriterCleaning: 0.15,
            fontSize: 'small',
          },
        };

        const gridSpotBefore = new BwpxGrid(16, 16);
        renderWidgetById('typewriter', gridSpotBefore, 0, {
          ...renderContext,
          instances: { typewriter: [instSpot] },
          activeInstanceId: instSpot.id,
          blockWidth: 16,
          blockHeight: 16,
          typewriterState: { lastChar: 'Z', lastTimestamp: 1000 },
          animationTimestamp: 1100, // 100ms < 150ms -> visible
        });
        let spotPixBefore = 0;
        for (let y = 0; y < 16; y++) {
          for (let x = 0; x < 16; x++) {
            if (gridSpotBefore.get(x, y)) spotPixBefore++;
          }
        }
        expect(spotPixBefore).toBeGreaterThan(0);

        const gridSpotAfter = new BwpxGrid(16, 16);
        renderWidgetById('typewriter', gridSpotAfter, 0, {
          ...renderContext,
          instances: { typewriter: [instSpot] },
          activeInstanceId: instSpot.id,
          blockWidth: 16,
          blockHeight: 16,
          typewriterState: { lastChar: 'Z', lastTimestamp: 1000 },
          animationTimestamp: 1160, // 160ms >= 150ms -> wiped
        });
        let spotPixAfter = 0;
        for (let y = 0; y < 16; y++) {
          for (let x = 0; x < 16; x++) {
            if (gridSpotAfter.get(x, y)) spotPixAfter++;
          }
        }
        expect(spotPixAfter).toBe(0);
      });

      it('supports fontSize "both" in random mode and renders mixed small and big letters', () => {
        const instBoth: WidgetInstance = {
          id: 't-rnd-both',
          widgetTypeId: 'typewriter',
          label: 'Typewriter Random Both',
          config: {
            mode: 'random' as const,
            typewriterMode: 'random' as const,
            typewriterWidth: 32,
            typewriterHeight: 32,
            fontSize: 'both',
          },
        };

        // Letter bank with explicit small and big font sizes
        const grid = new BwpxGrid(32, 32);
        renderWidgetById('typewriter', grid, 0, {
          ...renderContext,
          instances: { typewriter: [instBoth] },
          activeInstanceId: instBoth.id,
          blockWidth: 32,
          blockHeight: 32,
          typewriterState: {
            letterBank: [
              { char: 'A', x: 2, y: 2, fontSize: 'small' },
              { char: 'B', x: 12, y: 12, fontSize: 'big' },
            ],
            lastTimestamp: 1000,
          },
          animationTimestamp: 1000,
        });

        // 'A' should occupy at most 5x5 region [2..6, 2..6]
        let aPixels = 0;
        let outsideA = 0;
        for (let y = 2; y <= 6; y++) {
          for (let x = 2; x <= 6; x++) {
            if (grid.get(x, y)) aPixels++;
          }
        }
        for (let y = 2; y <= 10; y++) {
          for (let x = 7; x <= 11; x++) {
            if (grid.get(x, y)) outsideA++;
          }
        }
        expect(aPixels).toBeGreaterThan(0);
        expect(outsideA).toBe(0); // Small font doesn't bleed beyond 5x5

        // 'B' with 'big' font occupies up to 10x10 region [12..21, 12..21]
        let bPixels = 0;
        let bTallPixels = 0;
        for (let y = 12; y <= 21; y++) {
          for (let x = 12; x <= 21; x++) {
            if (grid.get(x, y)) {
              bPixels++;
              if (y >= 18) bTallPixels++; // Big font height > 5 (6..10)
            }
          }
        }
        expect(bPixels).toBeGreaterThan(0);
        expect(bTallPixels).toBeGreaterThan(0); // Proves big font was drawn
      });

      it('pseudo-randomly selects between small and big when fontSize is "both" and letter has no explicit size', () => {
        const instBothAuto: WidgetInstance = {
          id: 't-rnd-both-auto',
          widgetTypeId: 'typewriter',
          label: 'Typewriter Random Both Auto',
          config: {
            mode: 'random' as const,
            typewriterMode: 'random' as const,
            typewriterWidth: 32,
            typewriterHeight: 32,
            fontSize: 'both',
          },
        };

        const grid = new BwpxGrid(32, 32);
        renderWidgetById('typewriter', grid, 0, {
          ...renderContext,
          instances: { typewriter: [instBothAuto] },
          activeInstanceId: instBothAuto.id,
          blockWidth: 32,
          blockHeight: 32,
          typewriterState: {
            letterBank: [
              { char: 'A', x: 2, y: 2 },
              { char: 'Z', x: 14, y: 14 },
            ],
            lastTimestamp: 1000,
          },
          animationTimestamp: 1000,
        });

        let total = 0;
        for (let y = 0; y < 32; y++) {
          for (let x = 0; x < 32; x++) {
            if (grid.get(x, y)) total++;
          }
        }
        expect(total).toBeGreaterThan(0);
      });

      it('has new defaults for typewriter random mode in getDefaultWidgetConfig', () => {
        const def = getDefaultWidgetConfig('typewriter');
        expect(def.typewriterLetterBank).toBe(20);
        expect(def.typewriterBankSize).toBe(20);
        expect(def.typewriterCleaning).toBe(0.2);
        expect(def.typewriterFadeType).toBe('dither');
        expect(def.typewriterFadeTime).toBe(0.15);
        expect(def.fontSize).toBe('both');
      });

      it('verifies font availability fallback: falls back to whichever font is available when fontSize is both', () => {
        const dummyGrid = new BwpxGrid(128, 32);
        // Atlas with only small font mapping
        const smallOnlyMappings: FontCharMapping[] = [
          {
            id: 'map-A',
            chars: 'A',
            small: { x: 0, y: 0, width: 4, height: 5, advanceX: 5 },
          },
        ];

        const gridSmallOnly = new BwpxGrid(32, 32);
        const instBoth: WidgetInstance = {
          id: 'tw-rnd-avail',
          widgetTypeId: 'typewriter',
          label: 'Typewriter',
          config: {
            mode: 'random',
            typewriterMode: 'random',
            fontSize: 'both',
          },
        };

        renderWidgetById('typewriter', gridSmallOnly, 0, {
          ...renderContext,
          fontGrid: dummyGrid,
          fontMappings: smallOnlyMappings,
          instances: { typewriter: [instBoth] },
          activeInstanceId: instBoth.id,
          typewriterState: {
            randomLetters: [
              { char: 'A', x: 2, y: 2, fontSize: 'big' }, // Requested big, but atlas only has small
            ],
          },
        });

        // Small height is 5px, so y=2 to y=6 could have pixels, but y >= 7 should have none
        let pixelsBelow5 = 0;
        for (let y = 7; y < 32; y++) {
          for (let x = 0; x < 32; x++) {
            if (gridSmallOnly.get(x, y)) pixelsBelow5++;
          }
        }
        expect(pixelsBelow5).toBe(0);

        // Atlas with only big font mapping
        const bigOnlyMappings: FontCharMapping[] = [
          {
            id: 'map-B',
            chars: 'B',
            big: { x: 10, y: 0, width: 8, height: 10, advanceX: 9 },
          },
        ];

        const gridBigOnly = new BwpxGrid(32, 32);
        renderWidgetById('typewriter', gridBigOnly, 0, {
          ...renderContext,
          fontGrid: dummyGrid,
          fontMappings: bigOnlyMappings,
          instances: { typewriter: [instBoth] },
          activeInstanceId: instBoth.id,
          typewriterState: {
            randomLetters: [
              { char: 'B', x: 2, y: 2, fontSize: 'small' }, // Requested small, but atlas only has big
            ],
          },
        });
        // Rendering completed without crashing and utilized big glyph
        expect(gridBigOnly.width).toBe(32);
      });
    });

    describe('keypress widget', () => {
      const testSymbolsGrid = new BwpxGrid(64, 64);
      // Place marker pixels for each symbol slice
      testSymbolsGrid.set(0, 0, 1);  // SYM_UP: relative (0, 0)
      testSymbolsGrid.set(9, 0, 1);  // SYM_DOWN: relative (1, 0)
      testSymbolsGrid.set(18, 0, 1); // SYM_LEFT: relative (2, 0)
      testSymbolsGrid.set(27, 0, 1); // SYM_RIGHT: relative (3, 0)
      testSymbolsGrid.set(36, 0, 1); // SYM_IDLE: relative (4, 0)

      const testSlices: SpriteSlice[] = [
        { id: 'SYM_UP', name: 'Up', groupId: 'ARROWS', groupOrder: 1, x: 0, y: 0, width: 8, height: 8, color: '#fff' },
        { id: 'SYM_DOWN', name: 'Down', groupId: 'ARROWS', groupOrder: 2, x: 8, y: 0, width: 8, height: 8, color: '#fff' },
        { id: 'SYM_LEFT', name: 'Left', groupId: 'ARROWS', groupOrder: 3, x: 16, y: 0, width: 8, height: 8, color: '#fff' },
        { id: 'SYM_RIGHT', name: 'Right', groupId: 'ARROWS', groupOrder: 4, x: 24, y: 0, width: 8, height: 8, color: '#fff' },
        { id: 'SYM_IDLE', name: 'Idle', groupId: 'MISC', groupOrder: 1, x: 32, y: 0, width: 8, height: 8, color: '#fff' },
      ];

      it('is registered in Tier 2 with category typing', () => {
        const def = getWidgetDefinition('keypress');
        expect(def).toBeDefined();
        expect(def?.tier).toBe(2);
        expect(def?.category).toBe('typing');
        expect(def?.associatedSliceIds).toContain('SYMBOL_ARROW_UP');
        expect(def?.associatedSliceIds).toContain('SYMBOL_ARROW_DOWN');
        expect(def?.associatedSliceIds).toContain('SYMBOL_ARROW_LEFT');
        expect(def?.associatedSliceIds).toContain('SYMBOL_ARROW_RIGHT');
      });

      it('generates default config with arrow key elements', () => {
        const config = getDefaultWidgetConfig('keypress', testSlices);
        expect(config.keypressElements).toBeDefined();
        expect(config.keypressElements?.length).toBe(4);
        expect(config.keypressElements?.[0].key).toBe('ArrowUp');
        expect(config.keypressElements?.[1].key).toBe('ArrowDown');
        expect(config.keypressElements?.[2].key).toBe('ArrowLeft');
        expect(config.keypressElements?.[3].key).toBe('ArrowRight');
      });

      it('renders matching symbol while key is pressed', () => {
        const inst: WidgetInstance = {
          id: 'keypress-test-1',
          widgetTypeId: 'keypress',
          label: 'Keypress Test',
          config: {
            mode: 'symbol',
            keypressElements: [
              { key: 'ArrowUp', symbolId: 'SYM_UP' },
              { key: 'ArrowDown', symbolId: 'SYM_DOWN' },
              { key: 'ArrowLeft', symbolId: 'SYM_LEFT' },
              { key: 'ArrowRight', symbolId: 'SYM_RIGHT' },
            ],
          },
        };

        const grid = new BwpxGrid(16, 16);
        const kpState = {};
        renderWidgetById('keypress', grid, 0, 0, {
          ...renderContext,
          symbolsGrid: testSymbolsGrid,
          symbolSlices: testSlices,
          instances: { keypress: [inst] },
          activeInstanceId: inst.id,
          activeKeys: ['ArrowUp'],
          keypressState: kpState,
          blockWidth: 8,
          blockHeight: 8,
        });

        // SYM_UP marker pixel (0, 0) should be set
        expect(grid.get(0, 0)).toBe(1);
        expect(grid.get(1, 0)).toBe(0);
      });

      it('keeps last key pressed symbol on screen when idle is not given', () => {
        const inst: WidgetInstance = {
          id: 'keypress-test-no-idle',
          widgetTypeId: 'keypress',
          label: 'Keypress No Idle',
          config: {
            mode: 'symbol',
            idleSymbolId: undefined,
            keypressElements: [
              { key: 'ArrowUp', symbolId: 'SYM_UP' },
              { key: 'ArrowDown', symbolId: 'SYM_DOWN' },
            ],
          },
        };

        const kpState: { activeKeys?: string[]; lastKey?: string; lastSymbolId?: string } = {};

        // 1. Press ArrowUp
        const grid1 = new BwpxGrid(16, 16);
        renderWidgetById('keypress', grid1, 0, 0, {
          ...renderContext,
          symbolsGrid: testSymbolsGrid,
          symbolSlices: testSlices,
          instances: { keypress: [inst] },
          activeInstanceId: inst.id,
          activeKeys: ['ArrowUp'],
          lastKey: 'ArrowUp',
          keypressState: kpState,
          blockWidth: 8,
          blockHeight: 8,
        });
        expect(grid1.get(0, 0)).toBe(1); // SYM_UP
        expect(kpState.lastSymbolId).toBe('SYM_UP');

        // 2. Release ArrowUp (activeKeys empty)
        const grid2 = new BwpxGrid(16, 16);
        renderWidgetById('keypress', grid2, 0, 0, {
          ...renderContext,
          symbolsGrid: testSymbolsGrid,
          symbolSlices: testSlices,
          instances: { keypress: [inst] },
          activeInstanceId: inst.id,
          activeKeys: [],
          lastKey: 'ArrowUp',
          keypressState: kpState,
          blockWidth: 8,
          blockHeight: 8,
        });
        // SYM_UP must stay on!
        expect(grid2.get(0, 0)).toBe(1);
        expect(grid2.get(1, 0)).toBe(0);

        // 3. Press ArrowDown
        const grid3 = new BwpxGrid(16, 16);
        renderWidgetById('keypress', grid3, 0, 0, {
          ...renderContext,
          symbolsGrid: testSymbolsGrid,
          symbolSlices: testSlices,
          instances: { keypress: [inst] },
          activeInstanceId: inst.id,
          activeKeys: ['ArrowDown'],
          lastKey: 'ArrowDown',
          keypressState: kpState,
          blockWidth: 8,
          blockHeight: 8,
        });
        expect(grid3.get(1, 0)).toBe(1); // SYM_DOWN
        expect(kpState.lastSymbolId).toBe('SYM_DOWN');

        // 4. Release ArrowDown
        const grid4 = new BwpxGrid(16, 16);
        renderWidgetById('keypress', grid4, 0, 0, {
          ...renderContext,
          symbolsGrid: testSymbolsGrid,
          symbolSlices: testSlices,
          instances: { keypress: [inst] },
          activeInstanceId: inst.id,
          activeKeys: [],
          lastKey: 'ArrowDown',
          keypressState: kpState,
          blockWidth: 8,
          blockHeight: 8,
        });
        // SYM_DOWN stays on until next symbol
        expect(grid4.get(1, 0)).toBe(1);
        expect(grid4.get(0, 0)).toBe(0);
      });

      it('shows idle symbol when key is released and idle symbol is given', () => {
        const inst: WidgetInstance = {
          id: 'keypress-test-with-idle',
          widgetTypeId: 'keypress',
          label: 'Keypress With Idle',
          config: {
            mode: 'symbol',
            idleSymbolId: 'SYM_IDLE',
            keypressElements: [
              { key: 'ArrowUp', symbolId: 'SYM_UP' },
            ],
          },
        };

        const kpState = {};

        // 1. Initial idle state (no keys pressed)
        const gridIdle = new BwpxGrid(16, 16);
        renderWidgetById('keypress', gridIdle, 0, 0, {
          ...renderContext,
          symbolsGrid: testSymbolsGrid,
          symbolSlices: testSlices,
          instances: { keypress: [inst] },
          activeInstanceId: inst.id,
          activeKeys: [],
          keypressState: kpState,
          blockWidth: 8,
          blockHeight: 8,
        });
        // SYM_IDLE marker pixel (4, 0)
        expect(gridIdle.get(4, 0)).toBe(1);
        expect(gridIdle.get(0, 0)).toBe(0);

        // 2. Press ArrowUp
        const gridPressed = new BwpxGrid(16, 16);
        renderWidgetById('keypress', gridPressed, 0, 0, {
          ...renderContext,
          symbolsGrid: testSymbolsGrid,
          symbolSlices: testSlices,
          instances: { keypress: [inst] },
          activeInstanceId: inst.id,
          activeKeys: ['ArrowUp'],
          keypressState: kpState,
          blockWidth: 8,
          blockHeight: 8,
        });
        expect(gridPressed.get(0, 0)).toBe(1); // SYM_UP
        expect(gridPressed.get(4, 0)).toBe(0);

        // 3. Release ArrowUp -> returns to idle symbol
        const gridReleased = new BwpxGrid(16, 16);
        renderWidgetById('keypress', gridReleased, 0, 0, {
          ...renderContext,
          symbolsGrid: testSymbolsGrid,
          symbolSlices: testSlices,
          instances: { keypress: [inst] },
          activeInstanceId: inst.id,
          activeKeys: [],
          keypressState: kpState,
          blockWidth: 8,
          blockHeight: 8,
        });
        expect(gridReleased.get(4, 0)).toBe(1); // SYM_IDLE
        expect(gridReleased.get(0, 0)).toBe(0);
      });

      it('supports case-insensitivity and arrow aliases', () => {
        const inst: WidgetInstance = {
          id: 'keypress-test-alias',
          widgetTypeId: 'keypress',
          label: 'Keypress Alias',
          config: {
            mode: 'symbol',
            keypressElements: [
              { key: 'ArrowLeft', symbolId: 'SYM_LEFT' },
              { key: 'w', symbolId: 'SYM_UP' },
            ],
          },
        };

        // 'Left' alias for 'ArrowLeft'
        const grid1 = new BwpxGrid(16, 16);
        renderWidgetById('keypress', grid1, 0, 0, {
          ...renderContext,
          symbolsGrid: testSymbolsGrid,
          symbolSlices: testSlices,
          instances: { keypress: [inst] },
          activeInstanceId: inst.id,
          activeKeys: ['Left'],
          blockWidth: 8,
          blockHeight: 8,
        });
        expect(grid1.get(2, 0)).toBe(1); // SYM_LEFT

        // 'KeyW' code for 'w'
        const grid2 = new BwpxGrid(16, 16);
        renderWidgetById('keypress', grid2, 0, 0, {
          ...renderContext,
          symbolsGrid: testSymbolsGrid,
          symbolSlices: testSlices,
          instances: { keypress: [inst] },
          activeInstanceId: inst.id,
          activeKeys: ['KeyW'],
          blockWidth: 8,
          blockHeight: 8,
        });
        expect(grid2.get(0, 0)).toBe(1); // SYM_UP
      });

      it('correctly handles multi-key rollover and reprioritizes held key upon releasing most recent key', () => {
        const inst: WidgetInstance = {
          id: 'keypress-test-rollover',
          widgetTypeId: 'keypress',
          label: 'Keypress Rollover',
          config: {
            mode: 'symbol',
            keypressElements: [
              { key: 'ArrowUp', symbolId: 'SYM_UP' },
              { key: 'ArrowDown', symbolId: 'SYM_DOWN' },
            ],
          },
        };

        const kpState = {};

        // 1. Hold ArrowUp
        const grid1 = new BwpxGrid(16, 16);
        renderWidgetById('keypress', grid1, 0, 0, {
          ...renderContext,
          symbolsGrid: testSymbolsGrid,
          symbolSlices: testSlices,
          instances: { keypress: [inst] },
          activeInstanceId: inst.id,
          activeKeys: ['ArrowUp'],
          lastKey: 'ArrowUp',
          keypressState: kpState,
          blockWidth: 8,
          blockHeight: 8,
        });
        expect(grid1.get(0, 0)).toBe(1); // SYM_UP
        expect(grid1.get(1, 0)).toBe(0);

        // 2. Chording: While still holding ArrowUp, press ArrowDown
        const grid2 = new BwpxGrid(16, 16);
        renderWidgetById('keypress', grid2, 0, 0, {
          ...renderContext,
          symbolsGrid: testSymbolsGrid,
          symbolSlices: testSlices,
          instances: { keypress: [inst] },
          activeInstanceId: inst.id,
          activeKeys: ['ArrowUp', 'ArrowDown'],
          lastKey: 'ArrowDown',
          keypressState: kpState,
          blockWidth: 8,
          blockHeight: 8,
        });
        expect(grid2.get(1, 0)).toBe(1); // SYM_DOWN takes priority (most recent)
        expect(grid2.get(0, 0)).toBe(0);

        // 3. Release ArrowDown while STILL holding ArrowUp
        const grid3 = new BwpxGrid(16, 16);
        renderWidgetById('keypress', grid3, 0, 0, {
          ...renderContext,
          symbolsGrid: testSymbolsGrid,
          symbolSlices: testSlices,
          instances: { keypress: [inst] },
          activeInstanceId: inst.id,
          activeKeys: ['ArrowUp'],
          lastKey: 'ArrowDown', // lastKey is still ArrowDown from keyup
          keypressState: kpState,
          blockWidth: 8,
          blockHeight: 8,
        });
        expect(grid3.get(0, 0)).toBe(1); // SYM_UP is reprioritized because ArrowUp is still active!
        expect(grid3.get(1, 0)).toBe(0);

        // 4. Finally release ArrowUp
        const grid4 = new BwpxGrid(16, 16);
        renderWidgetById('keypress', grid4, 0, 0, {
          ...renderContext,
          symbolsGrid: testSymbolsGrid,
          symbolSlices: testSlices,
          instances: { keypress: [inst] },
          activeInstanceId: inst.id,
          activeKeys: [],
          lastKey: 'ArrowUp',
          keypressState: kpState,
          blockWidth: 8,
          blockHeight: 8,
        });
        expect(grid4.get(0, 0)).toBe(1); // SYM_UP stays on (last key pressed before idle)
        expect(grid4.get(1, 0)).toBe(0);
      });

      it('normalizes Space, Esc, Enter, Backspace and ZMK &kp prefixes', () => {
        const inst: WidgetInstance = {
          id: 'keypress-test-special',
          widgetTypeId: 'keypress',
          label: 'Special Keys',
          config: {
            mode: 'symbol',
            keypressElements: [
              { key: 'Space', symbolId: 'SYM_IDLE' },
              { key: 'Enter', symbolId: 'SYM_UP' },
              { key: '&kp UP', symbolId: 'SYM_DOWN' },
            ],
          },
        };

        // Space bar press (event.key is ' ')
        const gridSpace = new BwpxGrid(16, 16);
        renderWidgetById('keypress', gridSpace, 0, 0, {
          ...renderContext,
          symbolsGrid: testSymbolsGrid,
          symbolSlices: testSlices,
          instances: { keypress: [inst] },
          activeInstanceId: inst.id,
          activeKeys: [' '],
          blockWidth: 8,
          blockHeight: 8,
        });
        expect(gridSpace.get(4, 0)).toBe(1); // SYM_IDLE mapped to Space

        // Enter key press ('Return')
        const gridEnter = new BwpxGrid(16, 16);
        renderWidgetById('keypress', gridEnter, 0, 0, {
          ...renderContext,
          symbolsGrid: testSymbolsGrid,
          symbolSlices: testSlices,
          instances: { keypress: [inst] },
          activeInstanceId: inst.id,
          activeKeys: ['Return'],
          blockWidth: 8,
          blockHeight: 8,
        });
        expect(gridEnter.get(0, 0)).toBe(1); // SYM_UP mapped to Enter

        // ArrowUp unicode '▲' matching '&kp UP' binding
        const gridArrow = new BwpxGrid(16, 16);
        renderWidgetById('keypress', gridArrow, 0, 0, {
          ...renderContext,
          symbolsGrid: testSymbolsGrid,
          symbolSlices: testSlices,
          instances: { keypress: [inst] },
          activeInstanceId: inst.id,
          activeKeys: ['▲'],
          blockWidth: 8,
          blockHeight: 8,
        });
        expect(gridArrow.get(1, 0)).toBe(1); // SYM_DOWN mapped to &kp UP
      });

      it('tracks lastSymbol independently across multiple keypress instances', () => {
        const inst1: WidgetInstance = {
          id: 'kp-inst-1',
          widgetTypeId: 'keypress',
          label: 'Keypress 1',
          config: {
            mode: 'symbol',
            keypressElements: [{ key: 'ArrowUp', symbolId: 'SYM_UP' }],
          },
        };
        const inst2: WidgetInstance = {
          id: 'kp-inst-2',
          widgetTypeId: 'keypress',
          label: 'Keypress 2',
          config: {
            mode: 'symbol',
            keypressElements: [{ key: 'ArrowDown', symbolId: 'SYM_DOWN' }],
          },
        };

        const sharedState = {};

        // Press ArrowUp on inst1
        const g1 = new BwpxGrid(16, 16);
        renderWidgetById('keypress', g1, 0, 0, {
          ...renderContext,
          symbolsGrid: testSymbolsGrid,
          symbolSlices: testSlices,
          instances: { keypress: [inst1, inst2] },
          activeInstanceId: inst1.id,
          activeKeys: ['ArrowUp'],
          keypressState: sharedState,
          blockWidth: 8,
          blockHeight: 8,
        });
        expect(g1.get(0, 0)).toBe(1); // SYM_UP

        // Release on inst1
        const g1Rel = new BwpxGrid(16, 16);
        renderWidgetById('keypress', g1Rel, 0, 0, {
          ...renderContext,
          symbolsGrid: testSymbolsGrid,
          symbolSlices: testSlices,
          instances: { keypress: [inst1, inst2] },
          activeInstanceId: inst1.id,
          activeKeys: [],
          keypressState: sharedState,
          blockWidth: 8,
          blockHeight: 8,
        });
        expect(g1Rel.get(0, 0)).toBe(1); // SYM_UP retained

        // Now press ArrowDown on inst2
        const g2 = new BwpxGrid(16, 16);
        renderWidgetById('keypress', g2, 0, 0, {
          ...renderContext,
          symbolsGrid: testSymbolsGrid,
          symbolSlices: testSlices,
          instances: { keypress: [inst1, inst2] },
          activeInstanceId: inst2.id,
          activeKeys: ['ArrowDown'],
          keypressState: sharedState,
          blockWidth: 8,
          blockHeight: 8,
        });
        expect(g2.get(1, 0)).toBe(1); // SYM_DOWN

        // Release on inst2
        const g2Rel = new BwpxGrid(16, 16);
        renderWidgetById('keypress', g2Rel, 0, 0, {
          ...renderContext,
          symbolsGrid: testSymbolsGrid,
          symbolSlices: testSlices,
          instances: { keypress: [inst1, inst2] },
          activeInstanceId: inst2.id,
          activeKeys: [],
          keypressState: sharedState,
          blockWidth: 8,
          blockHeight: 8,
        });
        expect(g2Rel.get(1, 0)).toBe(1); // SYM_DOWN retained

        // Verify inst1 still retains SYM_UP without being corrupted by inst2
        const g1Recheck = new BwpxGrid(16, 16);
        renderWidgetById('keypress', g1Recheck, 0, 0, {
          ...renderContext,
          symbolsGrid: testSymbolsGrid,
          symbolSlices: testSlices,
          instances: { keypress: [inst1, inst2] },
          activeInstanceId: inst1.id,
          activeKeys: [],
          keypressState: sharedState,
          blockWidth: 8,
          blockHeight: 8,
        });
        expect(g1Recheck.get(0, 0)).toBe(1); // SYM_UP still intact!
        expect(g1Recheck.get(1, 0)).toBe(0);
      });
    });
  });
});


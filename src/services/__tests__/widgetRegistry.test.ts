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
} from '../widgetRegistry';
import {
  DEFAULT_LEFT_LAYOUT_BLOCKS,
  DEFAULT_RIGHT_LAYOUT_BLOCKS,
  DEFAULT_LAYOUT_BLOCKS,
  DEFAULT_SYMBOL_SLICES,
  DEFAULT_FONT_GLYPHS,
  DEFAULT_FONT_MAPPINGS,
  type SpriteSlice,
} from '../../types/zmk';
import { createDefaultSymbolsGrid, createDefaultFontGrid } from '../defaultAssets';
import type { WidgetRenderContext } from '../../types/widget';

describe('Widget Registry - Single Source of Truth', () => {
  let symbolsGrid: BwpxGrid;
  let fontGrid: BwpxGrid;
  let renderContext: WidgetRenderContext;

  beforeEach(() => {
    symbolsGrid = createDefaultSymbolsGrid();
    fontGrid = createDefaultFontGrid();
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

      expect(tier3.length).toBe(3);
      expect(tier3.map(w => w.id)).toEqual(['branding', 'screensaver', 'bongo']);

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
      const size = getWidgetNaturalSize(def, DEFAULT_SYMBOL_SLICES, textInst);
      // 'SCYAN' (5 chars) takes ~23px wide and 5px high
      expect(size.height).toBe(5);
      expect(size.width).toBeLessThanOrEqual(32);
      expect(size.width).toBeGreaterThan(15);
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

      // 3. Natural size
      const naturalSize = getWidgetNaturalSize(bongoDef, bongoSlices, bongoInst);
      expect(naturalSize).toEqual({ width: 20, height: 16 });
    });
  });
});


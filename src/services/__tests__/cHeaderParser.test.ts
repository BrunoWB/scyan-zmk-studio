import {
  parseCHeader,
  generateCHeader,
  generateDevicetreeLayouts,
  generateDevicetreeSymbols,
  sanitizeSymbolId,
  formatBlockToDevicetree,
  getDefaultAssets,
  type HeaderMetadata,
} from '../cHeaderParser';
import { BwpxGrid } from '../../pixel/core/PixelGrid';
import type { SpriteSlice } from '../../types/zmk';
import { describe, it, expect } from 'vitest';

describe('cHeaderParser', () => {
  it('should encode and decode metadata comments', () => {
    const testGrid = new BwpxGrid(16, 16);
    const symbolSlices: SpriteSlice[] = [
      { id: 'SYMBOL_LAYER', groupId: 'GROUP_1', groupOrder: 1, name: 'Layer Symbol', x: 0, y: 0, width: 16, height: 16, color: '#00d2ff' },
      { id: 'SYMBOL_SKULL', groupId: 'GROUP_1', groupOrder: 2, name: 'Skull Symbol', x: 16, y: 0, width: 16, height: 16, color: '#00d2ff' }
    ];

    const cHeader = generateCHeader(testGrid, symbolSlices, testGrid, []);
    console.log(cHeader.substring(cHeader.indexOf('SYMBOL_SLICES')));

    const parsed = parseCHeader(cHeader);
    console.log(JSON.stringify(parsed.symbolSlices, null, 2));

    expect(parsed.symbolSlices[0].groupId).toBe('GROUP_1');
    expect(parsed.symbolSlices[0].groupOrder).toBe(1);
    expect(parsed.symbolSlices[0].name).toBe('Layer Symbol');

    expect(parsed.symbolSlices[1].groupId).toBe('GROUP_1');
    expect(parsed.symbolSlices[1].groupOrder).toBe(2);
    expect(parsed.symbolSlices[1].name).toBe('Skull Symbol');
  });

  it('should encode and decode display studio metadata block', () => {
    const testGrid = new BwpxGrid(16, 16);
    const symbolSlices: SpriteSlice[] = [];
    const metadata = {
      version: 1 as const,
      screenDimensions: { width: 68, height: 160 },
      leftBlocks: [
        { id: 'b1', widgetType: 'battery', name: 'Battery', x: 2, y: 5, width: 17, height: 10, enabled: true, side: 'left' as const }
      ],
      rightBlocks: [
        { id: 'b2', widgetType: 'branding', name: 'Text', x: 0, y: 40, width: 32, height: 8, enabled: true, side: 'right' as const }
      ],
      idleLeftBlocks: [
        { id: 'idle-b1', widgetType: 'screensaver', name: 'Image', x: 5, y: 20, width: 26, height: 26, enabled: true, side: 'left' as const }
      ],
      idleRightBlocks: [],
      widgetInstances: {
        branding: [{ id: 'w_text', widgetTypeId: 'branding', label: 'My Custom Text', config: { mode: 'font' as const, textEntries: ['CORNE-PRO'] }, slots: {} }]
      }
    };

    const cHeader = generateCHeader(testGrid, symbolSlices, testGrid, [], metadata);
    const dts = generateDevicetreeLayouts(metadata, symbolSlices);
    expect(cHeader).toContain('/* ZMK_DISPLAY_STUDIO_METADATA');
    expect(cHeader).not.toContain('LAYOUT_LEFT_ACTIVE_BLOCKS');
    expect(dts).toContain('compatible = "scyan,widget-battery";');
    expect(dts).toContain('compatible = "scyan,widget-screensaver";');
    expect(cHeader).toContain('#define DISPLAY_VIRTUAL_WIDTH  68');
    expect(cHeader).toContain('#define DISPLAY_VIRTUAL_HEIGHT 160');

    const parsed = parseCHeader(cHeader);
    expect(parsed.metadata).toBeDefined();
    expect(parsed.metadata?.screenDimensions).toEqual({ width: 68, height: 160 });
    expect(parsed.metadata?.leftBlocks?.length).toBe(1);
    expect(parsed.metadata?.leftBlocks?.[0].widgetType).toBe('battery');
    expect(parsed.metadata?.idleLeftBlocks?.[0].widgetType).toBe('screensaver');
    expect(parsed.metadata?.widgetInstances?.['branding']?.[0].label).toBe('My Custom Text');
  });

  it('should generate valid C code that passes GCC syntax checking', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const os = await import('os');
    const { execSync } = await import('child_process');

    const symbolsGrid = new BwpxGrid(128, 34);
    const fontGrid = new BwpxGrid(128, 22);
    const symbolSlices: SpriteSlice[] = [
      { id: 'SYMBOL_USB', groupId: 'SYMBOL_USB', groupOrder: 1, name: 'USB', x: 0, y: 0, width: 12, height: 10 },
      { id: 'SYMBOL_BLUETOOTH', groupId: 'SYMBOL_BLUETOOTH', groupOrder: 1, name: 'BT', x: 12, y: 0, width: 8, height: 8 },
      { id: 'SYMBOL_SKULL_LAYER_0', groupId: 'SKULL', groupOrder: 1, name: 'Skull', x: 20, y: 0, width: 26, height: 23 },
    ];
    const metadata = {
      version: 1 as const,
      screenDimensions: { width: 32, height: 128 },
      leftBlocks: [
        { id: 'left-batt', widgetType: 'battery', name: 'Battery', x: 7, y: 11, width: 17, height: 10, enabled: true, side: 'left' as const },
        { id: 'left-wpm', widgetType: 'wpm-chart', name: 'WPM Chart', x: 0, y: 50, width: 32, height: 24, enabled: true, side: 'left' as const },
      ],
      rightBlocks: [
        { id: 'right-split', widgetType: 'split', name: 'Split', x: 9, y: 20, width: 13, height: 9, enabled: true, side: 'right' as const },
        { id: 'right-loop', widgetType: 'loop', name: 'Loop', x: 0, y: 40, width: 26, height: 26, enabled: true, side: 'right' as const },
      ],
      idleLeftBlocks: [
        { id: 'idle-art', widgetType: 'screensaver', name: 'Mascot', x: 3, y: 35, width: 26, height: 26, enabled: true, side: 'left' as const },
      ],
      idleRightBlocks: [],
      widgetInstances: {
        'wpm-chart': [{ id: 'wpm_1', widgetTypeId: 'wpm-chart', label: 'WPM Chart', config: { mode: 'symbol' as const, wpmChart: { width: 32, height: 24, gridSize: 4, targetSpeed: 100 } }, slots: {} }],
        'loop': [{ id: 'loop_1', widgetTypeId: 'loop', label: 'My Loop', config: { mode: 'symbol' as const, loopSpeedMs: 150 }, slots: {} }],
      }
    };

    const cCode = generateCHeader(symbolsGrid, symbolSlices, fontGrid, [], metadata);
    const dts = generateDevicetreeLayouts(metadata, symbolSlices);
    expect(dts).toContain('compatible = "scyan,widget-loop";');
    expect(cCode).toContain('#define SYMBOL_USB 0');
    const tmpPath = path.join(os.tmpdir(), 'test_generated_assets.h');
    fs.writeFileSync(tmpPath, cCode);

    try {
      execSync(`gcc -fsyntax-only "${tmpPath}"`);
      execSync(`gcc -E -P -x assembler-with-cpp -nostdinc -D__DTS__ -D_ASMLANGUAGE "${tmpPath}"`);
    } finally {
      if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
    }
  });

  it('should wrap stdint/stdbool/stddef includes in preprocessor guards for Devicetree preprocessing compatibility', () => {
    const testGrid = new BwpxGrid(16, 16);
    const cHeader = generateCHeader(testGrid, [], testGrid, []);

    expect(cHeader).toMatch(/#if !defined\(_ASMLANGUAGE\) && !defined\(__DTS__\)\r?\n#include <stdint\.h>\r?\n#include <stdbool\.h>\r?\n#include <stddef\.h>\r?\n#endif/);
  });

  it('should generate unique devicetree node labels across multiple layouts and displays', () => {
    const metadata = {
      version: 1 as const,
      screenDimensions: { width: 32, height: 128 },
      leftBlocks: [
        { id: 'b1', widgetType: 'screensaver', name: 'Mascot 1', x: 0, y: 0, width: 32, height: 32, enabled: true, side: 'left' as const }
      ],
      rightBlocks: [
        { id: 'b2', widgetType: 'screensaver', name: 'Mascot 2', x: 0, y: 0, width: 32, height: 32, enabled: true, side: 'right' as const }
      ],
      idleLeftBlocks: [],
      idleRightBlocks: [],
    };
    const dts = generateDevicetreeLayouts(metadata, []);
    expect(dts).toContain('display_1_active_widget_screensaver_0: widget_0 {');
    expect(dts).toContain('display_2_active_widget_screensaver_0: widget_0 {');
  });

  it('should parse C layout block arrays even when JSON metadata comment is completely stripped', () => {
    const rawCWithBlocks = `
#pragma once
#include <stdint.h>
#include <stdbool.h>

#define DISPLAY_VIRTUAL_WIDTH  32
#define DISPLAY_VIRTUAL_HEIGHT 128
#define DISPLAY_HW_WIDTH       128
#define DISPLAY_HW_HEIGHT      32

enum symbol_id {
    SYMBOL_USB,
    SYMBOL_COUNT,
};

#define HAS_CUSTOM_LAYOUT_BLOCKS 1
enum display_widget_type {
    WIDGET_TYPE_NONE = 0,
    WIDGET_TYPE_OUTPUT_STATUS,
    WIDGET_TYPE_BATTERY,
    WIDGET_TYPE_LAYER,
    WIDGET_TYPE_WPM,
    WIDGET_TYPE_WPM_CHART,
    WIDGET_TYPE_BRANDING,
    WIDGET_TYPE_SPLIT,
    WIDGET_TYPE_SCREENSAVER,
    WIDGET_TYPE_CAPS_LOCK,
};

struct display_layout_block {
    uint8_t type;
    int16_t x;
    int16_t y;
    uint8_t width;
    uint8_t height;
    bool enabled;
    uint8_t mode;
    int16_t param1;
    int16_t param2;
    int16_t param3;
    const char *custom_text;
    uint16_t symbol_id;
};

static const struct display_layout_block LAYOUT_LEFT_ACTIVE_BLOCKS[2] = {
    { .type = WIDGET_TYPE_BATTERY, .x = 13, .y = 3, .width = 17, .height = 10, .enabled = true, .mode = 0, .param1 = 0, .param2 = 0, .custom_text = NULL, .symbol_id = 0 },
    { .type = WIDGET_TYPE_BRANDING, .x = 3, .y = 73, .width = 26, .height = 5, .enabled = true, .mode = 1, .param1 = 0, .param2 = 0, .custom_text = "SCYAN", .symbol_id = 0 },
};
#define LAYOUT_LEFT_ACTIVE_COUNT 2

static const struct display_layout_block LAYOUT_RIGHT_ACTIVE_BLOCKS[1] = {
    { .type = WIDGET_TYPE_SPLIT, .x = 10, .y = 116, .width = 13, .height = 9, .enabled = true, .mode = 0, .param1 = 0, .param2 = 0, .custom_text = NULL, .symbol_id = 0 },
};
#define LAYOUT_RIGHT_ACTIVE_COUNT 1
`;

    const parsed = parseCHeader(rawCWithBlocks);
    expect(parsed.metadata).toBeDefined();
    expect(parsed.metadata?.screenDimensions).toEqual({ width: 32, height: 128 });
    expect(parsed.metadata?.leftBlocks?.length).toBe(2);
    expect(parsed.metadata?.leftBlocks?.[0].widgetType).toBe('battery');
    expect(parsed.metadata?.leftBlocks?.[0].x).toBe(13);
    expect(parsed.metadata?.leftBlocks?.[0].y).toBe(3);
    expect(parsed.metadata?.leftBlocks?.[1].widgetType).toBe('branding');
    expect(parsed.metadata?.leftBlocks?.[1].name).toBe('SCYAN');
    expect(parsed.metadata?.rightBlocks?.length).toBe(1);
    expect(parsed.metadata?.rightBlocks?.[0].widgetType).toBe('split');
    expect(parsed.metadata?.rightBlocks?.[0].y).toBe(116);
  });

  it('generates symbol_ids and text_entries arrays in display_layout_block', () => {
    const symbolsGrid = new BwpxGrid(128, 34);
    const fontGrid = new BwpxGrid(128, 22);
    const symbolSlices: SpriteSlice[] = [
      { id: 'SYMBOL_BATTERY_0', groupId: 'BATTERY_GRP', groupOrder: 1, name: 'Batt 0', x: 0, y: 0, width: 17, height: 10 },
      { id: 'SYMBOL_BATTERY_1', groupId: 'BATTERY_GRP', groupOrder: 2, name: 'Batt 1', x: 17, y: 0, width: 17, height: 10 },
      { id: 'SYMBOL_BATTERY_2', groupId: 'BATTERY_GRP', groupOrder: 3, name: 'Batt 2', x: 34, y: 0, width: 17, height: 10 },
    ];
    const metadata = {
      version: 1 as const,
      screenDimensions: { width: 32, height: 128 },
      leftBlocks: [
        { id: 'left-batt', widgetType: 'battery', instanceId: 'inst_batt', name: 'Battery Meter', x: 7, y: 11, width: 17, height: 10, enabled: true, side: 'left' as const },
      ],
      widgetInstances: {
        battery: [{
          id: 'inst_batt',
          widgetTypeId: 'battery',
          label: 'Battery Meter',
          config: {
            mode: 'symbol' as const,
            groupId: 'BATTERY_GRP',
            textEntries: ['0%', '50%', '100%'],
          },
          slots: {},
        }]
      }
    };

    const cCode = generateCHeader(symbolsGrid, symbolSlices, fontGrid, [], metadata);
    const dts = generateDevicetreeLayouts(metadata, symbolSlices);
    expect(dts).toContain('symbols = <SYMBOL_BATTERY_0 SYMBOL_BATTERY_1 SYMBOL_BATTERY_2>;');
    expect(dts).toContain('text-entries = "0%", "50%", "100%";');
    expect(cCode).not.toContain('LAYOUT_LEFT_ACTIVE_BLOCKS');
    expect(cCode).not.toContain('SYMBOL_BRACKET_LAYER(idx)');
    expect(cCode).not.toContain('SYMBOL_SKULL_LAYER(idx)');

    const parsed = parseCHeader(cCode);
    expect(parsed.metadata?.leftBlocks?.length).toBe(1);
    expect(parsed.metadata?.leftBlocks?.[0].widgetType).toBe('battery');
  });

  it('correctly parses user scyan_assets.h and generates clean blocks without legacy fallbacks', async () => {
    const fs = await import('fs');
    const userHeader = fs.readFileSync('/home/Scyan/Projects/Firmware/zmk-config/config/scyan_assets.h', 'utf8');
    const parsed = parseCHeader(userHeader);
    expect(parsed.metadata).toBeDefined();
    expect(parsed.symbolSlices.length).toBeGreaterThan(15);
    
    // Generate C header
    const generated = generateCHeader(parsed.symbolsGrid, parsed.symbolSlices, parsed.fontGrid, parsed.fontGlyphs, parsed.metadata);
    const dts = generateDevicetreeLayouts(parsed.metadata!, parsed.symbolSlices, parsed.fontGlyphs);
    fs.writeFileSync('/tmp/regenerated_assets.h', generated);
    expect(generated).not.toContain('LAYOUT_LEFT_ACTIVE_BLOCKS');
    expect(dts).toContain('compatible = "scyan,layouts";');
    expect(dts).toContain('compatible = "scyan,display-layout";');
    expect(generated).not.toContain('SYMBOL_BRACKET_LAYER(idx)');
    expect(generated).not.toContain('SYMBOL_SKULL_LAYER(idx)');
  });

  it('correctly handles idleScreensEnabled and power timers in metadata and C defines', () => {
    const testGrid = new BwpxGrid(16, 16);
    const metadata = {
      version: 1 as const,
      idleScreensEnabled: false,
      idleTimeoutSec: 45,
      screenOffTimeoutSec: 120,
    };

    const cCode = generateCHeader(testGrid, [], testGrid, [], metadata);
    expect(cCode).toContain('#define ZMK_DISPLAY_IDLE_SCREENS_ENABLED 0');
    expect(cCode).toContain('#define SCYAN_IDLE_SCREENS_ENABLED       0');
    expect(cCode).toContain('#define ZMK_DISPLAY_IDLE_TIMEOUT_MS  45000');
    expect(cCode).toContain('#define SCYAN_IDLE_TIMEOUT_MS        45000');
    expect(cCode).toContain('#define CONFIG_SCYAN_IDLE_TIMEOUT_MS 45000');
    expect(cCode).toContain('#define ZMK_DISPLAY_SLEEP_TIMEOUT_MS 120000');
    expect(cCode).toContain('#define SCYAN_SLEEP_TIMEOUT_MS       120000');

    const parsed = parseCHeader(cCode);
    expect(parsed.metadata?.idleScreensEnabled).toBe(false);
    expect(parsed.metadata?.idleTimeoutSec).toBe(45);
    expect(parsed.metadata?.screenOffTimeoutSec).toBe(120);

    // Test raw C defines fallback without metadata comment
    const rawC = `
#define DISPLAY_VIRTUAL_WIDTH 32
#define DISPLAY_VIRTUAL_HEIGHT 128
#define ZMK_DISPLAY_IDLE_SCREENS_ENABLED 0
#define ZMK_DISPLAY_IDLE_TIMEOUT_MS 15000
#define ZMK_DISPLAY_SLEEP_TIMEOUT_MS 90000
static const struct display_layout_block LAYOUT_LEFT_ACTIVE_BLOCKS[1] = {
    { .type = 1, .x = 0, .y = 0, .width = 10, .height = 10, .enabled = true }
};
`;
    const parsedRaw = parseCHeader(rawC);
    expect(parsedRaw.metadata?.idleScreensEnabled).toBe(false);
    expect(parsedRaw.metadata?.idleTimeoutSec).toBe(15);
    expect(parsedRaw.metadata?.screenOffTimeoutSec).toBe(90);

    // Test SCYAN module naming fallback
    const scyanRawC = `
#define DISPLAY_VIRTUAL_WIDTH 32
#define DISPLAY_VIRTUAL_HEIGHT 128
#define SCYAN_IDLE_SCREENS_ENABLED 1
#define CONFIG_SCYAN_IDLE_TIMEOUT_MS 20000
#define SCYAN_SLEEP_TIMEOUT_MS 80000
static const struct display_layout_block LAYOUT_LEFT_ACTIVE_BLOCKS[1] = {
    { .type = 1, .x = 0, .y = 0, .width = 10, .height = 10, .enabled = true }
};
`;
    const parsedScyan = parseCHeader(scyanRawC);
    expect(parsedScyan.metadata?.idleScreensEnabled).toBe(true);
    expect(parsedScyan.metadata?.idleTimeoutSec).toBe(20);
    expect(parsedScyan.metadata?.screenOffTimeoutSec).toBe(80);
  });

  it('correctly handles symmetric and asymmetric settings in metadata and C defines', () => {
    const testGrid = new BwpxGrid(16, 16);
    const metadata = {
      version: 1 as const,
      screenDimensions: { width: 32, height: 128 },
      symmetricSettings: false,
      rightScreenDimensions: { width: 68, height: 160 },
      idleScreensEnabled: true,
      rightIdleScreensEnabled: false,
      idleTimeoutSec: 30,
      rightIdleTimeoutSec: 15,
      screenOffTimeoutSec: 60,
      rightScreenOffTimeoutSec: 120,
    };

    const cCode = generateCHeader(testGrid, [], testGrid, [], metadata);
    // Left (standard) macros
    expect(cCode).toContain('#define DISPLAY_VIRTUAL_WIDTH  32');
    expect(cCode).toContain('#define DISPLAY_VIRTUAL_HEIGHT 128');
    expect(cCode).toContain('#define ZMK_DISPLAY_IDLE_TIMEOUT_MS  30000');
    expect(cCode).toContain('#define ZMK_DISPLAY_SLEEP_TIMEOUT_MS 60000');

    // Peripheral asymmetric macros and legacy right aliases
    expect(cCode).toContain('#define DISPLAY_VIRTUAL_WIDTH_PERIPHERAL  68');
    expect(cCode).toContain('#define DISPLAY_VIRTUAL_HEIGHT_PERIPHERAL 160');
    expect(cCode).toContain('#define DISPLAY_VIRTUAL_WIDTH_RIGHT  DISPLAY_VIRTUAL_WIDTH_PERIPHERAL');
    expect(cCode).toContain('#define SCYAN_IDLE_SCREENS_ENABLED_PERIPHERAL 0');
    expect(cCode).toContain('#define SCYAN_IDLE_TIMEOUT_MS_PERIPHERAL        15000');
    expect(cCode).toContain('#define SCYAN_SLEEP_TIMEOUT_MS_PERIPHERAL       120000');
    expect(cCode).toContain('#define SCYAN_IDLE_TIMEOUT_MS_RIGHT         SCYAN_IDLE_TIMEOUT_MS_PERIPHERAL');

    // Parse and verify round-trip
    const parsed = parseCHeader(cCode);
    expect(parsed.metadata?.symmetricSettings).toBe(false);
    expect(parsed.metadata?.screenDimensions).toEqual({ width: 32, height: 128 });
    expect(parsed.metadata?.rightScreenDimensions).toEqual({ width: 68, height: 160 });
    expect(parsed.metadata?.idleScreensEnabled).toBe(true);
    expect(parsed.metadata?.rightIdleScreensEnabled).toBe(false);
    expect(parsed.metadata?.idleTimeoutSec).toBe(30);
    expect(parsed.metadata?.rightIdleTimeoutSec).toBe(15);
    expect(parsed.metadata?.screenOffTimeoutSec).toBe(60);
    expect(parsed.metadata?.rightScreenOffTimeoutSec).toBe(120);

    // Also verify raw C parsing without metadata comment
    const rawAsymmetricC = `
#define DISPLAY_VIRTUAL_WIDTH 32
#define DISPLAY_VIRTUAL_HEIGHT 128
#define DISPLAY_VIRTUAL_WIDTH_RIGHT 68
#define DISPLAY_VIRTUAL_HEIGHT_RIGHT 160
#define SCYAN_IDLE_TIMEOUT_MS_RIGHT 25000
#define SCYAN_SLEEP_TIMEOUT_MS_RIGHT 75000
static const struct display_layout_block LAYOUT_LEFT_ACTIVE_BLOCKS[1] = {
    { .type = 1, .x = 0, .y = 0, .width = 10, .height = 10, .enabled = true }
};
`;
    const parsedRaw = parseCHeader(rawAsymmetricC);
    expect(parsedRaw.metadata?.symmetricSettings).toBe(false);
    expect(parsedRaw.metadata?.rightScreenDimensions).toEqual({ width: 68, height: 160 });
    expect(parsedRaw.metadata?.rightIdleTimeoutSec).toBe(25);
    expect(parsedRaw.metadata?.rightScreenOffTimeoutSec).toBe(75);
  });

  it('encodes metadata.layerNames and populates WIDGET_TYPE_LAYER text_entries', () => {
    const testGrid = new BwpxGrid(16, 16);
    const metadata = {
      version: 1 as const,
      layerNames: ['FREE', 'QWERTY', 'RIGHTHOLD', 'LEFTHOLD', 'SIMMHOLD'],
      leftBlocks: [
        { id: 'b_layer', widgetType: 'layer-banner', name: 'Layer Banner', x: 4, y: 22, width: 24, height: 12, enabled: true, side: 'left' as const }
      ],
      rightBlocks: [],
      idleLeftBlocks: [],
      idleRightBlocks: [],
      widgetInstances: {
        'layer-banner': [{ id: 'inst-layer', widgetTypeId: 'layer-banner', label: 'Layer Banner', config: { mode: 'font' as const } }]
      }
    };

    const cCode = generateCHeader(testGrid, [], testGrid, [], metadata);
    const dts = generateDevicetreeLayouts(metadata, []);
    expect(dts).toContain('compatible = "scyan,widget-layer";');
    expect(dts).toContain('"FREE"');
    expect(dts).toContain('"QWERTY"');
    expect(dts).toContain('"RIGHTHOLD"');
    expect(dts).toContain('"LEFTHOLD"');
    expect(dts).toContain('"SIMMHOLD"');

    const parsed = parseCHeader(cCode);
    expect(parsed.metadata?.layerNames).toEqual(['FREE', 'QWERTY', 'RIGHTHOLD', 'LEFTHOLD', 'SIMMHOLD']);
  });

  it('synchronizes wpm-chart width and height from instance config to C block and metadata', () => {
    const testGrid = new BwpxGrid(16, 16);
    const metadata = {
      version: 1 as const,
      leftBlocks: [
        { id: 'b_wpm_chart', instanceId: 'w_chart_1', widgetType: 'wpm-chart', name: 'WPM Chart', x: 0, y: 56, width: 24, height: 21, enabled: true, side: 'left' as const }
      ],
      rightBlocks: [],
      idleLeftBlocks: [],
      idleRightBlocks: [],
      widgetInstances: {
        'wpm-chart': [{
          id: 'w_chart_1',
          widgetTypeId: 'wpm-chart',
          label: 'WPM Chart',
          config: {
            mode: 'symbol' as const,
            wpmChart: { width: 32, height: 30, gridSize: 0, targetSpeed: 60, timeWindow: 10 }
          },
          slots: {}
        }]
      }
    };

    const cCode = generateCHeader(testGrid, [], testGrid, [], metadata);
    const dts = generateDevicetreeLayouts(metadata, []);
    // DTS node should have width 32 and height 30 (not stale 24 and 21)
    expect(dts).toContain('compatible = "scyan,widget-wpm-chart";');
    expect(dts).toContain('width = <32>;');
    expect(dts).toContain('height = <30>;');

    // Parsing should reconcile block width and height to 32 and 30
    const parsed = parseCHeader(cCode);
    const parsedBlock = parsed.metadata?.leftBlocks?.[0];
    expect(parsedBlock?.width).toBe(32);
    expect(parsedBlock?.height).toBe(30);
  });

  it('synchronizes wpm text mode width and height from instance config to C block and metadata', () => {
    const testGrid = new BwpxGrid(16, 16);
    const metadata = {
      version: 1 as const,
      leftBlocks: [
        { id: 'b_wpm_text', instanceId: 'w_text_1', widgetType: 'wpm', name: 'WPM Meter', x: 4, y: 87, width: 24, height: 10, enabled: true, side: 'left' as const }
      ],
      rightBlocks: [],
      idleLeftBlocks: [],
      idleRightBlocks: [],
      widgetInstances: {
        'wpm': [{
          id: 'w_text_1',
          widgetTypeId: 'wpm',
          label: 'WPM Meter',
          config: {
            mode: 'font' as const,
            fontSize: 'small' as const,
            textEntries: ['A'],
          },
          slots: {}
        }]
      }
    };

    const cCode = generateCHeader(testGrid, [], testGrid, [], metadata);
    const dts = generateDevicetreeLayouts(metadata, []);
    // DTS node should have width 5 and height 5 (measured tight for 'A', not stale 24 and 10)
    expect(dts).toContain('compatible = "scyan,widget-wpm";');
    expect(dts).toContain('width = <5>;');
    expect(dts).toContain('height = <5>;');

    // Parsing should reconcile block width and height to 5 and 5
    const parsed = parseCHeader(cCode);
    const parsedBlock = parsed.metadata?.leftBlocks?.[0];
    expect(parsedBlock?.width).toBe(5);
    expect(parsedBlock?.height).toBe(5);
  });

  it('generates and parses Animation widget with loop config correctly', () => {
    const testGrid = new BwpxGrid(32, 16);
    const metadata = {
      version: 1 as const,
      screenDimensions: { width: 32, height: 128 },
      leftBlocks: [
        { id: 'left-anim-loop', widgetType: 'animation', name: 'Anim Loop', x: 0, y: 10, width: 26, height: 26, enabled: true, side: 'left' as const, instanceId: 'inst_loop' },
        { id: 'left-anim-oneshot', widgetType: 'animation', name: 'Anim Oneshot', x: 0, y: 50, width: 26, height: 26, enabled: true, side: 'left' as const, instanceId: 'inst_oneshot' },
      ],
      rightBlocks: [],
      idleLeftBlocks: [],
      idleRightBlocks: [],
      widgetInstances: {
        'animation': [
          { id: 'inst_loop', widgetTypeId: 'animation', label: 'Looping', config: { mode: 'symbol' as const, loopSpeedMs: 150, loop: true, syncAnimation: true }, slots: {} },
          { id: 'inst_oneshot', widgetTypeId: 'animation', label: 'One Shot', config: { mode: 'symbol' as const, loopSpeedMs: 200, loop: false, syncAnimation: false }, slots: {} },
        ]
      }
    };

    const cCode = generateCHeader(testGrid, [], testGrid, [], metadata);
    const dts = generateDevicetreeLayouts(metadata, []);
    // inst_loop has loop: true -> param2 = 0, param1 = 150, mode = 1 (synced)
    expect(dts).toContain('param1 = <150>;');
    expect(dts).toContain('mode = <1>;');
    // inst_oneshot has loop: false -> param1 = 200, param2 = 1, mode = 0
    expect(dts).toContain('param1 = <200>;');
    expect(dts).toContain('param2 = <1>;');

    // Round-trip parse
    const parsed = parseCHeader(cCode);
    const animInstances = parsed.metadata?.widgetInstances?.['animation'];
    expect(animInstances).toBeDefined();
    expect(animInstances?.length).toBe(2);
    expect(animInstances?.find(i => i.id === 'inst_loop')?.config.loop).toBe(true);
    expect(animInstances?.find(i => i.id === 'inst_loop')?.config.syncAnimation).toBe(true);
    expect(animInstances?.find(i => i.id === 'inst_oneshot')?.config.loop).toBe(false);

    // Raw C fallback parsing (when metadata block stripped)
    const rawC = `
      static const struct display_layout_block LAYOUT_LEFT_ACTIVE_BLOCKS[1] = {
          { .type = WIDGET_TYPE_LOOP, .x = 2, .y = 20, .width = 24, .height = 24, .enabled = true, .mode = 1, .param1 = 120, .param2 = 1, .param3 = 0, .symbol_count = 0, .symbol_ids = { 0 }, .text_count = 0, .text_entries = { NULL }, .custom_text = NULL, .symbol_id = 0 },
      };
      #define LAYOUT_LEFT_ACTIVE_COUNT 1
    `;
    const parsedRaw = parseCHeader(rawC);
    expect(parsedRaw.metadata?.leftBlocks?.length).toBe(1);
    expect(parsedRaw.metadata?.leftBlocks?.[0].widgetType).toBe('animation');
    const rawAnimInst = parsedRaw.metadata?.widgetInstances?.['animation']?.[0];
    expect(rawAnimInst).toBeDefined();
    expect(rawAnimInst?.config.loopSpeedMs).toBe(120);
    expect(rawAnimInst?.config.loop).toBe(false); // param2 == 1 -> loop: false
    expect(rawAnimInst?.config.syncAnimation).toBe(true); // mode == 1 -> syncAnimation: true
  });

  it('reconciles animation blocks to natural sprite dimensions and syncs loop/animation metadata', () => {
    const testGrid = new BwpxGrid(32, 128);
    const duckSlices: SpriteSlice[] = [
      {
        id: 'SYMBOL_DUCK_FRAME0',
        name: 'Duck Frame 0',
        groupId: 'SYMBOL_DUCK_PIXEL',
        groupOrder: 1,
        x: 0,
        y: 0,
        width: 32,
        height: 55,
        color: '#ffdd00',
      },
      {
        id: 'SYMBOL_DUCK_FRAME1',
        name: 'Duck Frame 1',
        groupId: 'SYMBOL_DUCK_PIXEL',
        groupOrder: 2,
        x: 0,
        y: 55,
        width: 32,
        height: 55,
        color: '#ffdd00',
      },
    ];

    const metadata = {
      version: 1 as const,
      leftBlocks: [
        {
          id: 'block-anim-duck',
          widgetType: 'animation',
          instanceId: 'inst-duck',
          name: 'Duck',
          x: 0,
          y: 35,
          width: 17, // Stale / too small width (e.g. 17x10 battery charge fallback)
          height: 10,
          enabled: true,
          side: 'left' as const,
        },
      ],
      rightBlocks: [],
      idleLeftBlocks: [],
      idleRightBlocks: [],
      widgetInstances: {
        loop: [
          {
            id: 'inst-duck',
            widgetTypeId: 'loop',
            label: 'Duck',
            config: {
              mode: 'symbol' as const,
              groupId: 'SYMBOL_DUCK_PIXEL',
              loopSpeedMs: 120,
              loop: true,
            },
            slots: {},
          },
        ],
      },
    };

    const cCode = generateCHeader(testGrid, duckSlices, testGrid, [], metadata);
    // Generated C code must have the natural slice width/height (32x55), NOT 17x10
    expect(cCode).toContain('.width = 32, .height = 55');

    // Parse the generated header
    const parsed = parseCHeader(cCode);
    expect(parsed.metadata).toBeDefined();
    // Both 'loop' and 'animation' keys must be populated
    expect(parsed.metadata?.widgetInstances?.['loop']).toBeDefined();
    expect(parsed.metadata?.widgetInstances?.['animation']).toBeDefined();
    expect(parsed.metadata?.widgetInstances?.['animation']?.[0].id).toBe('inst-duck');

    // Reconciled block dimensions must match natural sprite size (32x55)
    const block = parsed.metadata?.leftBlocks?.[0];
    expect(block).toBeDefined();
    expect(block?.width).toBe(32);
    expect(block?.height).toBe(55);
  });

  it('correctly loads and validates 32x128 sync inspection animations (SYMBOL_SYNC_DOWN & SYMBOL_SYNC_UP)', () => {
    const assets = getDefaultAssets();
    const downSlices = assets.symbolSlices.filter(s => s.groupId === 'SYMBOL_SYNC_DOWN');
    const upSlices = assets.symbolSlices.filter(s => s.groupId === 'SYMBOL_SYNC_UP');

    // Both groups have 16 frames
    expect(downSlices).toHaveLength(16);
    expect(upSlices).toHaveLength(16);

    // Each frame is 32x128
    for (const s of [...downSlices, ...upSlices]) {
      expect(s.width).toBe(32);
      expect(s.height).toBe(128);
    }

    // Verify marks at heights 1 (y=0), 32 (y=31), 64 (y=63), 96 (y=95), 128 (y=127) on frame 0
    const f0 = downSlices[0];
    const marksY = [0, 31, 63, 95, 127];
    for (const my of marksY) {
      // Left mark x=0..9
      for (let x = 0; x <= 9; x++) {
        expect(assets.symbolsGrid.get(f0.x + x, f0.y + my)).toBe(1);
      }
      // Left gap x=10..14
      for (let x = 10; x <= 14; x++) {
        expect(assets.symbolsGrid.get(f0.x + x, f0.y + my)).toBe(0);
      }
      // Centered pixel at x=15 on frame 0 (my=0)
      if (my === 0) {
        expect(assets.symbolsGrid.get(f0.x + 15, f0.y + my)).toBe(1);
      }
      // Right gap x=16..20
      for (let x = 16; x <= 20; x++) {
        expect(assets.symbolsGrid.get(f0.x + x, f0.y + my)).toBe(0);
      }
      // Right mark x=21..31
      for (let x = 21; x <= 31; x++) {
        expect(assets.symbolsGrid.get(f0.x + x, f0.y + my)).toBe(1);
      }
    }

    // Verify moving pixel positions along the down-up trajectory
    const expectedY = [0, 16, 31, 47, 63, 79, 95, 111, 127, 111, 95, 79, 63, 47, 31, 16];
    for (let i = 0; i < 16; i++) {
      const slice = downSlices[i];
      const py = expectedY[i];
      expect(assets.symbolsGrid.get(slice.x + 15, slice.y + py)).toBe(1);
    }

    // Verify Devicetree generation for a sync loop block
    const testMeta = {
      version: 1 as const,
      enabledScreens: ['central', 'peripheral'],
      screenDimensions: { width: 32, height: 128 },
      centralBlocks: [
        {
          id: 'test-sync',
          widgetType: 'animation',
          instanceId: 'inst-sync',
          name: 'Sync',
          x: 0,
          y: 0,
          width: 32,
          height: 128,
          enabled: true,
          side: 'central' as const,
        }
      ],
      peripheralBlocks: [],
      idleCentralBlocks: [],
      idlePeripheralBlocks: [],
      widgetInstances: {
        animation: [
          {
            id: 'inst-sync',
            widgetTypeId: 'animation',
            label: 'Sync Test',
            config: {
              mode: 'symbol' as const,
              groupId: 'SYMBOL_SYNC_DOWN',
              loopSpeedMs: 100,
              loop: true,
              syncAnimation: true,
            },
            slots: {},
          }
        ]
      }
    };

    const dts = generateDevicetreeLayouts(testMeta, assets.symbolSlices);
    expect(dts).toContain('compatible = "scyan,widget-loop";');
    expect(dts).toContain('width = <32>;');
    expect(dts).toContain('height = <128>;');
    expect(dts).toContain('mode = <1>;');
    expect(dts).toContain('param1 = <100>;');
    expect(dts).toContain('param3 = <16>;');
    expect(dts).toContain('symbol-id = <SYMBOL_SYNC_DOWN_01>;');
  });

  it('should support multi-screen setup with dynamic peripheral screens in C header export and parsing', () => {
    const testGrid = new BwpxGrid(16, 16);
    const symbolSlices: SpriteSlice[] = [];
    const metadata = {
      version: 1 as const,
      enabledScreens: ['central', 'peripheral', 'peripheral-2'],
      screenDimensions: { width: 32, height: 128 },
      peripheralScreenDimensions: { width: 64, height: 128 },
      centralBlocks: [
        { id: 'b-central-wpm', widgetType: 'wpm', name: 'WPM', x: 2, y: 10, width: 28, height: 16, enabled: true, side: 'central' as const }
      ],
      peripheralBlocks: [
        { id: 'b-peripheral-split', widgetType: 'split', name: 'Split', x: 0, y: 20, width: 32, height: 16, enabled: true, side: 'peripheral' as const }
      ],
      peripheralScreens: {
        'peripheral-2': {
          blocks: [
            { id: 'b-p2-bongo', widgetType: 'bongo', name: 'Bongo Cat', x: 0, y: 20, width: 32, height: 32, enabled: true, side: 'peripheral-2' },
            { id: 'b-p2-layer', widgetType: 'layer-banner', name: 'Layer Banner', x: 0, y: 60, width: 32, height: 14, enabled: true, side: 'peripheral-2' },
          ],
          idleBlocks: [
            { id: 'b-p2-mascot', widgetType: 'screensaver', name: 'Mascot', x: 4, y: 30, width: 24, height: 24, enabled: true, side: 'peripheral-2' }
          ],
        }
      },
    };

    const cCode = generateCHeader(testGrid, symbolSlices, testGrid, [], metadata);
    const dts = generateDevicetreeLayouts(metadata, symbolSlices);

    // Verify generated Devicetree includes canonical layouts and dynamic peripheral blocks
    expect(dts).toContain('display_1_active:');
    expect(dts).toContain('display_2_active:');
    expect(dts).toContain('display_3_active:');
    expect(dts).toContain('compatible = "scyan,widget-bongo";');
    expect(dts).toContain('compatible = "scyan,widget-layer";');
    expect(dts).toContain('compatible = "scyan,widget-screensaver";');

    // Verify C header does not contain static layout arrays
    expect(cCode).not.toContain('LAYOUT_CENTRAL_ACTIVE_BLOCKS');
    expect(cCode).not.toContain('LAYOUT_PERIPHERAL_ACTIVE_BLOCKS');

    // Parse the generated header and verify 100% round-trip fidelity
    const parsed = parseCHeader(cCode);
    expect(parsed.metadata).toBeDefined();
    expect(parsed.metadata?.enabledScreens).toEqual(['central', 'peripheral', 'peripheral-2']);
    expect(parsed.metadata?.peripheralScreenDimensions).toEqual({ width: 64, height: 128 });
    expect(parsed.metadata?.centralBlocks?.length).toBe(1);
    expect(parsed.metadata?.peripheralBlocks?.length).toBe(1);
    expect(parsed.metadata?.peripheralScreens?.['peripheral-2']?.blocks?.length).toBe(2);
    expect(parsed.metadata?.peripheralScreens?.['peripheral-2']?.blocks?.[0].widgetType).toBe('bongo');
    expect(parsed.metadata?.peripheralScreens?.['peripheral-2']?.blocks?.[1].widgetType).toBe('layer-banner');
    expect(parsed.metadata?.peripheralScreens?.['peripheral-2']?.idleBlocks?.length).toBe(1);
    expect(parsed.metadata?.peripheralScreens?.['peripheral-2']?.idleBlocks?.[0].widgetType).toBe('screensaver');
  });

  it('should emit canonical central and peripheral layout blocks and aliases for dual split', () => {
    const testGrid = new BwpxGrid(16, 16);
    const metadata = {
      version: 1 as const,
      enabledScreens: ['central', 'peripheral'],
      centralBlocks: [
        { id: 'b1', widgetType: 'battery', name: 'Battery', x: 0, y: 0, width: 17, height: 10, enabled: true, side: 'central' as const }
      ],
      peripheralBlocks: [
        { id: 'b2', widgetType: 'split', name: 'Split', x: 0, y: 0, width: 13, height: 9, enabled: true, side: 'peripheral' as const }
      ],
    };

    const cCode = generateCHeader(testGrid, [], testGrid, [], metadata);
    const dts = generateDevicetreeLayouts(metadata, []);
    expect(dts).toContain('display_1_active:');
    expect(dts).toContain('display_2_active:');
    expect(cCode).not.toContain('LAYOUT_CENTRAL_ACTIVE_BLOCKS');
  });

  it('should reconcile widget instances for peripheralScreens blocks', () => {
    const testGrid = new BwpxGrid(16, 16);
    const metadata = {
      version: 1 as const,
      enabledScreens: ['central', 'peripheral', 'peripheral-2'],
      widgetInstances: {
        'wpm-chart': [
          {
            id: 'inst_p2_chart',
            widgetTypeId: 'wpm-chart',
            label: 'WPM Chart',
            config: {
              mode: 'symbol' as const,
              wpmChart: { width: 32, height: 28, gridSize: 4, targetSpeed: 100, timeWindow: 30 },
            },
            slots: {},
          },
        ],
      },
      peripheralScreens: {
        'peripheral-2': {
          blocks: [
            { id: 'p2-chart', widgetType: 'wpm-chart', instanceId: 'inst_p2_chart', name: 'Chart', x: 0, y: 10, width: 16, height: 16, enabled: true, side: 'peripheral-2' }
          ]
        }
      }
    };

    const cCode = generateCHeader(testGrid, [], testGrid, [], metadata);
    const parsed = parseCHeader(cCode);
    expect(parsed.metadata?.peripheralScreens?.['peripheral-2']?.blocks?.[0].width).toBe(32);
    expect(parsed.metadata?.peripheralScreens?.['peripheral-2']?.blocks?.[0].height).toBe(28);
  });

  it('should emit and parse raw C defines for peripheral screen dimensions and power timers', () => {
    const rawPeripheralC = `
#define DISPLAY_VIRTUAL_WIDTH 32
#define DISPLAY_VIRTUAL_HEIGHT 128
#define DISPLAY_VIRTUAL_WIDTH_PERIPHERAL 68
#define DISPLAY_VIRTUAL_HEIGHT_PERIPHERAL 160
#define SCYAN_IDLE_SCREENS_ENABLED_PERIPHERAL 1
#define SCYAN_IDLE_TIMEOUT_MS_PERIPHERAL 20000
#define SCYAN_SLEEP_TIMEOUT_MS_PERIPHERAL 50000
static const struct display_layout_block LAYOUT_CENTRAL_ACTIVE_BLOCKS[1] = {
    { .type = 1, .x = 0, .y = 0, .width = 12, .height = 10, .enabled = true }
};
static const struct display_layout_block LAYOUT_PERIPHERAL_ACTIVE_BLOCKS[1] = {
    { .type = 2, .x = 5, .y = 10, .width = 17, .height = 10, .enabled = true }
};
`;
    const parsed = parseCHeader(rawPeripheralC);
    expect(parsed.metadata).toBeDefined();
    expect(parsed.metadata?.enabledScreens).toEqual(['central', 'peripheral']);
    expect(parsed.metadata?.peripheralScreenDimensions).toEqual({ width: 68, height: 160 });
    expect(parsed.metadata?.peripheralIdleScreensEnabled).toBe(true);
    expect(parsed.metadata?.peripheralIdleTimeoutSec).toBe(20);
    expect(parsed.metadata?.peripheralScreenOffTimeoutSec).toBe(50);
    expect(parsed.metadata?.peripheralBlocks?.length).toBe(1);
  });

  it('should gracefully normalize legacy 2-screen C header to central/peripheral enabledScreens', () => {
    const legacyC = `
#define DISPLAY_VIRTUAL_WIDTH 32
#define DISPLAY_VIRTUAL_HEIGHT 128
static const struct display_layout_block LAYOUT_LEFT_ACTIVE_BLOCKS[1] = {
    { .type = 1, .x = 0, .y = 0, .width = 12, .height = 10, .enabled = true }
};
static const struct display_layout_block LAYOUT_RIGHT_ACTIVE_BLOCKS[1] = {
    { .type = 2, .x = 0, .y = 0, .width = 17, .height = 10, .enabled = true }
};
/* ZMK_DISPLAY_STUDIO_METADATA
{
  "version": 1,
  "leftBlocks": [{ "id": "l1", "widgetType": "connection", "name": "Output", "x": 0, "y": 0, "width": 12, "height": 10, "enabled": true, "side": "left" }],
  "rightBlocks": [{ "id": "r1", "widgetType": "battery", "name": "Battery", "x": 0, "y": 0, "width": 17, "height": 10, "enabled": true, "side": "right" }]
}
*/
`;
    const parsed = parseCHeader(legacyC);
    expect(parsed.metadata?.enabledScreens).toEqual(['central', 'peripheral']);
    expect(parsed.metadata?.centralBlocks?.length).toBe(1);
    expect(parsed.metadata?.peripheralBlocks?.length).toBe(1);
  });

  it('generates correct physical hardware dimensions for horizontal/landscape displays (e.g. Lily58 128x32)', () => {
    const assets = getDefaultAssets();
    const metadata: HeaderMetadata = {
      version: 1,
      centralBlocks: [],
      peripheralBlocks: [],
      screenDimensions: { width: 128, height: 32 },
      shieldId: 'lily58',
    };
    const cCode = generateCHeader(assets.symbolsGrid, assets.symbolSlices, assets.fontGrid, assets.fontMappings, metadata);

    expect(cCode).toContain('#define DISPLAY_VIRTUAL_WIDTH  128');
    expect(cCode).toContain('#define DISPLAY_VIRTUAL_HEIGHT 32');
    expect(cCode).toContain('#define DISPLAY_HW_WIDTH       128');
    expect(cCode).toContain('#define DISPLAY_HW_HEIGHT      32');
    expect(cCode).toContain('"shieldId": "lily58"');
  });

  it('generates and parses display rotation defines and metadata roundtrip', () => {
    const assets = getDefaultAssets();
    const metadata: HeaderMetadata = {
      version: 1,
      centralBlocks: [],
      peripheralBlocks: [],
      screenDimensions: { width: 32, height: 128 },
      rotation: 90,
      peripheralScreenDimensions: { width: 128, height: 32 },
      peripheralRotation: 0,
      symmetricSettings: false,
    };
    const cCode = generateCHeader(assets.symbolsGrid, assets.symbolSlices, assets.fontGrid, assets.fontMappings, metadata);

    expect(cCode).toContain('#define DISPLAY_ROTATION       90');
    expect(cCode).toContain('#define DISPLAY_ROTATION_DEGREES 90');
    expect(cCode).toContain('#define SCYAN_ROTATION         90');
    expect(cCode).toContain('#define CONFIG_SCYAN_ROTATION_90 1');
    expect(cCode).toContain('#define DISPLAY_ROTATION_PERIPHERAL       0');
    expect(cCode).toContain('#define DISPLAY_ROTATION_DEGREES_PERIPHERAL 0');
    expect(cCode).toContain('#define DISPLAY_ROTATION_RIGHT       DISPLAY_ROTATION_PERIPHERAL');

    const parsed = parseCHeader(cCode);
    expect(parsed.metadata?.rotation).toBe(90);
    expect(parsed.metadata?.peripheralRotation).toBe(0);
    expect(parsed.metadata?.symmetricSettings).toBe(false);
  });

  it('deduces best assumption rotation from shieldId or dimensions when rotation macro is absent', () => {
    const rawCorne = `
#define DISPLAY_VIRTUAL_WIDTH 32
#define DISPLAY_VIRTUAL_HEIGHT 128
`;
    const parsedCorne = parseCHeader(rawCorne);
    expect(parsedCorne.metadata?.rotation).toBe(90);

    const rawLily = `
#define DISPLAY_VIRTUAL_WIDTH 128
#define DISPLAY_VIRTUAL_HEIGHT 32
`;
    const parsedLily = parseCHeader(rawLily);
    expect(parsedLily.metadata?.rotation).toBe(0);

    const rawConfigMacro = `
#define DISPLAY_VIRTUAL_WIDTH 32
#define DISPLAY_VIRTUAL_HEIGHT 128
#define CONFIG_SCYAN_ROTATION_270 1
`;
    const parsedCustomRot = parseCHeader(rawConfigMacro);
    expect(parsedCustomRot.metadata?.rotation).toBe(270);
  });

  it('correctly orders symbol_ids for WIDGET_TYPE_OUTPUT_STATUS with USB at index 0 followed by BLE profiles', () => {
    const testGrid = new BwpxGrid(32, 32);
    const symbolSlices: SpriteSlice[] = [
      { id: 'SYMBOL_USB', name: 'USB', groupId: 'SYMBOL_USB', groupOrder: 1, x: 0, y: 0, width: 12, height: 10, color: '#38bdf8' },
      { id: 'SYMBOL_BLUETOOTH', name: 'BT', groupId: 'SYMBOL_BLUETOOTH', groupOrder: 1, x: 12, y: 0, width: 10, height: 11, color: '#00d2ff' },
      { id: 'SYMBOL_BLUETOOTH_P1', name: 'BTA', groupId: 'SYMBOL_BLUETOOTH_P1', groupOrder: 1, x: 22, y: 0, width: 10, height: 11, color: '#00d2ff' },
    ];
    const metadata: HeaderMetadata = {
      version: 1,
      centralBlocks: [
        { id: 'block-conn', widgetType: 'connection', instanceId: 'conn-1', name: 'Output Status', x: 0, y: 0, width: 12, height: 10, enabled: true, side: 'central' }
      ],
      widgetInstances: {
        connection: [
          {
            id: 'conn-1',
            widgetTypeId: 'connection',
            label: 'Connection',
            config: {
              mode: 'symbol',
              groupId: 'SYMBOL_USB',
              groupIds: ['SYMBOL_BLUETOOTH', 'SYMBOL_BLUETOOTH_P1', 'SYMBOL_BLUETOOTH_P2', 'SYMBOL_BLUETOOTH_P3', 'SYMBOL_BLUETOOTH_P4', 'SYMBOL_BLUETOOTH_P5'],
            },
            slots: {},
          }
        ]
      }
    };

    const cCode = generateCHeader(testGrid, symbolSlices, testGrid, [], metadata);
    const dts = generateDevicetreeLayouts(metadata, symbolSlices);
    expect(cCode).toContain('#define SYMBOL_USB 0');
    expect(dts).toContain('compatible = "scyan,widget-output";');
    // Ensure SYMBOL_USB is at index 0 of symbol_ids and symbol_id is SYMBOL_USB
    expect(dts).toContain('symbols = <SYMBOL_USB SYMBOL_BLUETOOTH_P1>;');
    expect(dts).toContain('symbol-id = <SYMBOL_USB>;');
  });

  describe('Typewriter Widget Serialization & Round-Trip', () => {
    it('generates C code encoding WIDGET_TYPE_TYPEWRITER with mode, param1 (direction), param2 (cleaning), and param3 (fontSize)', () => {
      const testGrid = new BwpxGrid(32, 32);
      const metadata: HeaderMetadata = {
        version: 1,
        centralBlocks: [
          {
            id: 'block-typewriter-1',
            widgetType: 'typewriter',
            instanceId: 'typewriter-inline-1',
            name: 'Typewriter',
            x: 0,
            y: 50,
            width: 32,
            height: 5,
            enabled: true,
            side: 'central',
          }
        ],
        widgetInstances: {
          typewriter: [
            {
              id: 'typewriter-inline-1',
              widgetTypeId: 'typewriter',
              label: 'Typewriter Stream',
              config: {
                mode: 'inline',
                typewriterMode: 'inline',
                typewriterDirection: 'ew',
                typewriterCleaning: 5,
                typewriterWidth: 32,
                fontSize: 'small',
              },
              slots: {},
            }
          ]
        }
      };

      const cCode = generateCHeader(testGrid, [], testGrid, [], metadata);
      const dts = generateDevicetreeLayouts(metadata, []);
      expect(dts).toContain('compatible = "scyan,widget-typewriter";');
      // mode: 0 (inline), param1: 1 (ew), param2: 5 (cleaning), param3: 0 (small)
      expect(dts).toContain('param1 = <1>;');
      expect(dts).toContain('param2 = <5>;');

      // Verify round-trip parsing with metadata
      const parsed = parseCHeader(cCode);
      expect(parsed.metadata?.centralBlocks?.[0]?.widgetType).toBe('typewriter');
      const inst = parsed.metadata?.widgetInstances?.typewriter?.[0];
      expect(inst).toBeDefined();
      expect(inst?.config?.typewriterMode).toBe('inline');
      expect(inst?.config?.typewriterDirection).toBe('ew');
      expect(inst?.config?.typewriterCleaning).toBe(5);
    });

    it('falls back gracefully to synthetic typewriter instance when parsing raw C header without metadata', () => {
      const rawCHeader = `
enum display_widget_type {
    WIDGET_TYPE_NONE = 0,
    WIDGET_TYPE_OUTPUT_STATUS,
    WIDGET_TYPE_BATTERY,
    WIDGET_TYPE_LAYER,
    WIDGET_TYPE_WPM,
    WIDGET_TYPE_WPM_CHART,
    WIDGET_TYPE_BRANDING,
    WIDGET_TYPE_SPLIT,
    WIDGET_TYPE_SCREENSAVER,
    WIDGET_TYPE_CAPS_LOCK,
    WIDGET_TYPE_BONGO,
    WIDGET_TYPE_LOOP,
    WIDGET_TYPE_TYPEWRITER,
};

static const struct display_layout_block LAYOUT_LEFT_ACTIVE_BLOCKS[] = {
    { .type = WIDGET_TYPE_TYPEWRITER, .x = 2, .y = 40, .width = 28, .height = 10, .enabled = true, .mode = 1, .param1 = 0, .param2 = 3, .param3 = 1, .symbol_count = 0, .symbol_ids = { 0 }, .text_count = 0, .text_entries = { NULL }, .custom_text = NULL, .symbol_id = 0 },
};
`;
      const parsed = parseCHeader(rawCHeader);
      expect(parsed.metadata?.leftBlocks?.length).toBe(1);
      expect(parsed.metadata?.leftBlocks?.[0].widgetType).toBe('typewriter');
      expect(parsed.metadata?.leftBlocks?.[0].width).toBe(28);
      expect(parsed.metadata?.leftBlocks?.[0].height).toBe(10);

      // Verify synthetic instance from raw C block: mode 1 -> spot, param2 3 -> cleaning 3s, param3 1 -> big
      const inst = parsed.metadata?.widgetInstances?.typewriter?.[0];
      expect(inst).toBeDefined();
      expect(inst?.config?.typewriterMode).toBe('spot');
      expect(inst?.config?.typewriterCleaning).toBe(3);
      expect(inst?.config?.fontSize).toBe('big');
    });

    it('serializes and parses random mode with letter bank in param1 and round-trips via metadata', () => {
      const testGrid = new BwpxGrid(32, 32);
      const metadata: HeaderMetadata = {
        version: 1,
        centralBlocks: [
          {
            id: 'block-typewriter-rnd',
            widgetType: 'typewriter',
            instanceId: 'typewriter-rnd-1',
            name: 'Typewriter Random',
            x: 0,
            y: 40,
            width: 32,
            height: 32,
            enabled: true,
            side: 'central',
          }
        ],
        widgetInstances: {
          typewriter: [
            {
              id: 'typewriter-rnd-1',
              widgetTypeId: 'typewriter',
              label: 'Typewriter Random Bank',
              config: {
                mode: 'random',
                typewriterMode: 'random',
                typewriterLetterBank: 7,
                typewriterCleaning: 4,
                typewriterWidth: 32,
                typewriterHeight: 32,
                fontSize: 'small',
              },
              slots: {},
            }
          ]
        }
      };

      const cCode = generateCHeader(testGrid, [], testGrid, [], metadata);
      const dts = generateDevicetreeLayouts(metadata, []);
      expect(dts).toContain('compatible = "scyan,widget-typewriter";');
      // mode: 2 (random), param1: 7 (letter bank), param2: 4 (cleaning), param3: 0 (small)
      expect(dts).toContain('mode = <2>;');
      expect(dts).toContain('param1 = <7>;');
      expect(dts).toContain('param2 = <4>;');

      // Verify round-trip parsing with metadata
      const parsed = parseCHeader(cCode);
      const inst = parsed.metadata?.widgetInstances?.typewriter?.[0];
      expect(inst).toBeDefined();
      expect(inst?.config?.typewriterMode).toBe('random');
      expect(inst?.config?.typewriterLetterBank).toBe(7);
      expect(inst?.config?.typewriterCleaning).toBe(4);

      // Verify raw C fallback parsing decodes mode: 2, param1: 7 as random mode with letter bank 7
      const rawCHeader = `
enum display_widget_type {
    WIDGET_TYPE_NONE = 0,
    WIDGET_TYPE_OUTPUT_STATUS,
    WIDGET_TYPE_BATTERY,
    WIDGET_TYPE_LAYER,
    WIDGET_TYPE_WPM,
    WIDGET_TYPE_WPM_CHART,
    WIDGET_TYPE_BRANDING,
    WIDGET_TYPE_SPLIT,
    WIDGET_TYPE_SCREENSAVER,
    WIDGET_TYPE_CAPS_LOCK,
    WIDGET_TYPE_BONGO,
    WIDGET_TYPE_LOOP,
    WIDGET_TYPE_TYPEWRITER,
};

static const struct display_layout_block LAYOUT_LEFT_ACTIVE_BLOCKS[] = {
    { .type = WIDGET_TYPE_TYPEWRITER, .x = 0, .y = 40, .width = 32, .height = 32, .enabled = true, .mode = 2, .param1 = 7, .param2 = 4, .param3 = 0, .symbol_count = 0, .symbol_ids = { 0 }, .text_count = 0, .text_entries = { NULL }, .custom_text = NULL, .symbol_id = 0 },
};
`;
      const rawParsed = parseCHeader(rawCHeader);
      const rawInst = rawParsed.metadata?.widgetInstances?.typewriter?.[0];
      expect(rawInst).toBeDefined();
      expect(rawInst?.config?.typewriterMode).toBe('random');
      expect(rawInst?.config?.typewriterLetterBank).toBe(7);
      expect(rawInst?.config?.typewriterBankSize).toBe(7);
      expect(rawInst?.config?.typewriterCleaning).toBe(4);
    });

    it('serializes and parses random mode with decimal cleaning and typewriterBankSize', () => {
      const testGrid = new BwpxGrid(32, 32);
      const metadata: HeaderMetadata = {
        version: 1,
        centralBlocks: [
          {
            id: 'block-typewriter-rnd-dec',
            widgetType: 'typewriter',
            instanceId: 'typewriter-rnd-dec-1',
            name: 'Typewriter Random Dec',
            x: 0,
            y: 40,
            width: 32,
            height: 32,
            enabled: true,
            side: 'central',
          }
        ],
        widgetInstances: {
          typewriter: [
            {
              id: 'typewriter-rnd-dec-1',
              widgetTypeId: 'typewriter',
              label: 'Typewriter Random Dec Cleaning',
              config: {
                mode: 'random',
                typewriterMode: 'random',
                typewriterBankSize: 8,
                typewriterCleaning: 0.35,
                typewriterWidth: 32,
                typewriterHeight: 32,
                fontSize: 'small',
              },
              slots: {},
            }
          ]
        }
      };

      const cCode = generateCHeader(testGrid, [], testGrid, [], metadata);
      const dts = generateDevicetreeLayouts(metadata, []);
      expect(dts).toContain('compatible = "scyan,widget-typewriter";');
      // mode: 2, param1: 8 (bank size)
      expect(dts).toContain('mode = <2>;');
      expect(dts).toContain('param1 = <8>;');

      // Verify round-trip parsing with metadata preserves decimal cleaning
      const parsed = parseCHeader(cCode);
      const inst = parsed.metadata?.widgetInstances?.typewriter?.[0];
      expect(inst).toBeDefined();
      expect(inst?.config?.typewriterMode).toBe('random');
      expect(inst?.config?.typewriterBankSize).toBe(8);
      expect(inst?.config?.typewriterCleaning).toBe(0.35);

      // Verify raw C fallback parsing with decimal cleaning
      const rawCHeader = `
enum display_widget_type {
    WIDGET_TYPE_TYPEWRITER = 12,
};
static const struct display_layout_block LAYOUT_LEFT_ACTIVE_BLOCKS[] = {
    { .type = WIDGET_TYPE_TYPEWRITER, .x = 0, .y = 40, .width = 32, .height = 32, .enabled = true, .mode = 2, .param1 = 6, .param2 = 0.5, .param3 = 0, .symbol_count = 0, .symbol_ids = { 0 }, .text_count = 0, .text_entries = { NULL }, .custom_text = NULL, .symbol_id = 0 },
};
`;
      const rawParsed = parseCHeader(rawCHeader);
      const rawInst = rawParsed.metadata?.widgetInstances?.typewriter?.[0];
      expect(rawInst).toBeDefined();
      expect(rawInst?.config?.typewriterMode).toBe('random');
      expect(rawInst?.config?.typewriterBankSize).toBe(6);
      expect(rawInst?.config?.typewriterLetterBank).toBe(6);
      expect(rawInst?.config?.typewriterCleaning).toBe(0.5);
    });

    it('serializes and parses random mode with fontSize: "both" (param3: 2) and default parameters', () => {
      const testGrid = new BwpxGrid(32, 32);
      const metadata: HeaderMetadata = {
        version: 1,
        centralBlocks: [
          {
            id: 'block-typewriter-both',
            widgetType: 'typewriter',
            instanceId: 'typewriter-both-1',
            name: 'Typewriter Both',
            x: 0,
            y: 0,
            width: 32,
            height: 32,
            enabled: true,
          }
        ],
        widgetInstances: {
          typewriter: [
            {
              id: 'typewriter-both-1',
              widgetTypeId: 'typewriter',
              label: 'Random Both',
              config: {
                mode: 'random',
                typewriterMode: 'random',
                typewriterWidth: 32,
                typewriterHeight: 32,
                fontSize: 'both',
                typewriterCleaning: 0.2,
              },
              slots: {},
            }
          ]
        }
      };

      const cCode = generateCHeader(testGrid, [], testGrid, [], metadata);
      const dts = generateDevicetreeLayouts(metadata, []);
      expect(dts).toContain('compatible = "scyan,widget-typewriter";');
      // Default random mode: param1: 20 (letter bank default), param3: 2 (both)
      expect(dts).toContain('mode = <2>;');
      expect(dts).toContain('param1 = <20>;');
      expect(dts).toContain('param3 = <2>;');

      // Verify round-trip parsing with metadata
      const parsed = parseCHeader(cCode);
      const inst = parsed.metadata?.widgetInstances?.typewriter?.[0];
      expect(inst).toBeDefined();
      expect(inst?.config?.fontSize).toBe('both');

      // Verify raw C fallback parsing with param3: 2 decodes to fontSize: 'both'
      const rawCHeader = `
enum display_widget_type {
    WIDGET_TYPE_TYPEWRITER = 12,
};
static const struct display_layout_block LAYOUT_LEFT_ACTIVE_BLOCKS[] = {
    { .type = WIDGET_TYPE_TYPEWRITER, .x = 0, .y = 0, .width = 32, .height = 32, .enabled = true, .mode = 2, .param1 = 20, .param2 = 0.2, .param3 = 2, .symbol_count = 0, .symbol_ids = { 0 }, .text_count = 0, .text_entries = { NULL }, .custom_text = NULL, .symbol_id = 0 },
};
`;
      const rawParsed = parseCHeader(rawCHeader);
      const rawInst = rawParsed.metadata?.widgetInstances?.typewriter?.[0];
      expect(rawInst).toBeDefined();
      expect(rawInst?.config?.typewriterMode).toBe('random');
      expect(rawInst?.config?.fontSize).toBe('both');
      expect(rawInst?.config?.typewriterLetterBank).toBe(20);
      expect(rawInst?.config?.typewriterCleaning).toBe(0.2);
    });

    it('preserves typewriterFadeType and typewriterFadeTime through round-trip metadata and supplies defaults on raw C parse', () => {
      const testGrid = new BwpxGrid(32, 32);
      const metadata: HeaderMetadata = {
        version: 1,
        centralBlocks: [
          {
            id: 'block-typewriter-fade',
            widgetType: 'typewriter',
            instanceId: 'typewriter-fade-1',
            name: 'Typewriter Fade',
            x: 0,
            y: 0,
            width: 32,
            height: 32,
            enabled: true,
          }
        ],
        widgetInstances: {
          typewriter: [
            {
              id: 'typewriter-fade-1',
              widgetTypeId: 'typewriter',
              label: 'Typewriter Dither Fade',
              config: {
                mode: 'random',
                typewriterMode: 'random',
                typewriterLetterBank: 10,
                typewriterCleaning: 1.5,
                typewriterFadeType: 'dither',
                typewriterFadeTime: 0.75,
                typewriterWidth: 32,
                typewriterHeight: 32,
              },
              slots: {},
            }
          ]
        }
      };

      const cCode = generateCHeader(testGrid, [], testGrid, [], metadata);
      const dts = generateDevicetreeLayouts(metadata, []);
      expect(dts).toContain('compatible = "scyan,widget-typewriter";');

      // Round-trip parse metadata
      const parsed = parseCHeader(cCode);
      const inst = parsed.metadata?.widgetInstances?.typewriter?.[0];
      expect(inst).toBeDefined();
      expect(inst?.config?.typewriterFadeType).toBe('dither');
      expect(inst?.config?.typewriterFadeTime).toBe(0.75);
      expect(inst?.config?.typewriterCleaning).toBe(1.5);

      // Raw C fallback parsing sets default fadeType: 'instant' and fadeTime: 0.5
      const rawCHeader = `
enum display_widget_type {
    WIDGET_TYPE_TYPEWRITER = 12,
};
static const struct display_layout_block LAYOUT_LEFT_ACTIVE_BLOCKS[] = {
    { .type = WIDGET_TYPE_TYPEWRITER, .x = 0, .y = 0, .width = 32, .height = 32, .enabled = true, .mode = 2, .param1 = 5, .param2 = 2, .param3 = 0, .symbol_count = 0, .symbol_ids = { 0 }, .text_count = 0, .text_entries = { NULL }, .custom_text = NULL, .symbol_id = 0 },
};
`;
      const rawParsed = parseCHeader(rawCHeader);
      const rawInst = rawParsed.metadata?.widgetInstances?.typewriter?.[0];
      expect(rawInst).toBeDefined();
      expect(rawInst?.config?.typewriterFadeType).toBe('instant');
      expect(rawInst?.config?.typewriterFadeTime).toBe(0.5);
    });

    it('serializes and round-trips keypress widget with elements and idle symbol', () => {
      const testGrid = new BwpxGrid(32, 32);
      const testSlices: SpriteSlice[] = [
        { id: 'SYMBOL_ARROW_UP', name: 'Up', groupId: 'ARROWS', groupOrder: 1, x: 0, y: 0, width: 8, height: 8, color: '#fff' },
        { id: 'SYMBOL_ARROW_DOWN', name: 'Down', groupId: 'ARROWS', groupOrder: 2, x: 8, y: 0, width: 8, height: 8, color: '#fff' },
        { id: 'SYMBOL_IDLE', name: 'Idle', groupId: 'MISC', groupOrder: 1, x: 16, y: 0, width: 8, height: 8, color: '#fff' },
      ];

      const metadata: HeaderMetadata = {
        version: 2,
        centralBlocks: [
          {
            id: 'block-keypress-1',
            widgetType: 'keypress',
            instanceId: 'keypress-arrows-1',
            name: 'Keypress Arrow Block',
            x: 0,
            y: 0,
            width: 16,
            height: 16,
            enabled: true,
            side: 'central',
          },
        ],
        widgetInstances: {
          keypress: [
            {
              id: 'keypress-arrows-1',
              widgetTypeId: 'keypress',
              label: 'Arrow Keys',
              config: {
                mode: 'symbol',
                idleSymbolId: 'SYMBOL_IDLE',
                keypressElements: [
                  { key: 'ArrowUp', symbolId: 'SYMBOL_ARROW_UP' },
                  { key: 'ArrowDown', symbolId: 'SYMBOL_ARROW_DOWN' },
                ],
              },
              slots: {},
            },
          ],
        },
      };

      const cCode = generateCHeader(testGrid, testSlices, testGrid, [], metadata);
      const dts = generateDevicetreeLayouts(metadata, testSlices);
      expect(dts).toContain('compatible = "scyan,widget-keypress";');
      expect(dts).toContain('SYMBOL_ARROW_UP');
      expect(dts).toContain('ArrowUp');

      const parsed = parseCHeader(cCode);
      expect(parsed.metadata?.centralBlocks?.[0]?.widgetType).toBe('keypress');
      const inst = parsed.metadata?.widgetInstances?.keypress?.[0];
      expect(inst).toBeDefined();
      expect(inst?.config?.idleSymbolId).toBe('SYMBOL_IDLE');
      expect(inst?.config?.keypressElements).toHaveLength(2);
      expect(inst?.config?.keypressElements?.[0]).toEqual({ key: 'ArrowUp', symbolId: 'SYMBOL_ARROW_UP' });
      expect(inst?.config?.keypressElements?.[1]).toEqual({ key: 'ArrowDown', symbolId: 'SYMBOL_ARROW_DOWN' });
    });

    it('falls back gracefully to synthetic keypress instance when parsing raw C header without metadata', () => {
      const rawCHeader = `
enum display_widget_type {
    WIDGET_TYPE_KEYPRESS = 13,
};
enum symbol_id {
    SYMBOL_ARROW_UP = 0,
    SYMBOL_ARROW_DOWN = 1,
    SYMBOL_IDLE_SYM = 2,
};
static const struct display_layout_block LAYOUT_LEFT_ACTIVE_BLOCKS[] = {
    { .type = WIDGET_TYPE_KEYPRESS, .x = 4, .y = 20, .width = 16, .height = 16, .enabled = true, .mode = 1, .param1 = 0, .param2 = 0, .param3 = 0, .symbol_count = 2, .symbol_ids = { SYMBOL_ARROW_UP, SYMBOL_ARROW_DOWN }, .text_count = 2, .text_entries = { "ArrowUp", "ArrowDown" }, .custom_text = NULL, .symbol_id = SYMBOL_IDLE_SYM },
};
`;
      const parsed = parseCHeader(rawCHeader);
      expect(parsed.metadata?.leftBlocks?.[0].widgetType).toBe('keypress');
      const inst = parsed.metadata?.widgetInstances?.keypress?.[0];
      expect(inst).toBeDefined();
      expect(inst?.config?.idleSymbolId).toBe('SYMBOL_IDLE_SYM');
      expect(inst?.config?.keypressElements).toHaveLength(2);
      expect(inst?.config?.keypressElements?.[0].key).toBe('ArrowUp');
      expect(inst?.config?.keypressElements?.[0].symbolId).toBe('SYMBOL_ARROW_UP');
      expect(inst?.config?.keypressElements?.[1].key).toBe('ArrowDown');
      expect(inst?.config?.keypressElements?.[1].symbolId).toBe('SYMBOL_ARROW_DOWN');
    });
  });

  describe('Devicetree Robust Generation', () => {
    it('generateDevicetreeSymbols emits only #define SYMBOL_* numeric integer macros', () => {
      const slices: SpriteSlice[] = [
        { id: 'SYMBOL_USB', groupId: 'SYMBOL_USB', groupOrder: 1, name: 'USB', x: 0, y: 0, width: 10, height: 10, color: '#fff' },
        { id: 'SYMBOL_BATTERY', groupId: 'SYMBOL_BATTERY', groupOrder: 1, name: 'Battery', x: 10, y: 0, width: 10, height: 10, color: '#fff' },
        { id: 'LAYER_ICON', groupId: 'LAYER', groupOrder: 1, name: 'Layer', x: 20, y: 0, width: 10, height: 10, color: '#fff' },
      ];

      const dtsi = generateDevicetreeSymbols(slices);
      expect(dtsi).toBe(
        '#define SYMBOL_USB 0\n#define SYMBOL_BATTERY 1\n#define SYMBOL_LAYER_ICON 2\n'
      );

      const lines = dtsi.trim().split('\n');
      for (const line of lines) {
        expect(line).toMatch(/^#define SYMBOL_[A-Za-z0-9_]+ \d+$/);
      }
    });

    it('generateDevicetreeSymbols sanitizes non-alphanumeric characters and handles missing IDs', () => {
      const dirtySlices: any[] = [
        { id: 'SYMBOL_MY-ICON', name: 'Hyphen Icon' },
        { id: 'Custom Space Icon', name: 'Space' },
        { id: 'SYMBOL_DOT.NAME', name: 'Dot' },
        { id: '', name: 'Empty' },
        { id: 'SYMBOL_', name: 'Prefix only' },
        { name: 'No ID' },
      ];

      const dtsi = generateDevicetreeSymbols(dirtySlices);
      expect(dtsi).toBe(
        '#define SYMBOL_MY_ICON 0\n' +
        '#define SYMBOL_Custom_Space_Icon 1\n' +
        '#define SYMBOL_DOT_NAME 2\n' +
        '#define SYMBOL_3 3\n' +
        '#define SYMBOL_4 4\n' +
        '#define SYMBOL_5 5\n'
      );

      const lines = dtsi.trim().split('\n');
      for (const line of lines) {
        expect(line).toMatch(/^#define SYMBOL_[A-Za-z0-9_]+ \d+$/);
      }
    });

    it('generateDevicetreeSymbols handles empty or null symbols list gracefully', () => {
      expect(generateDevicetreeSymbols([])).toBe('');
      expect(generateDevicetreeSymbols(null as any)).toBe('');
      expect(generateDevicetreeSymbols(undefined as any)).toBe('');
    });

    it('generateDevicetreeLayouts includes scyan_symbols.dtsi instead of scyan_assets.h', () => {
      const metadata: HeaderMetadata = {
        version: 2,
        displays: {
          display_1: {
            id: 'display_1',
            name: 'Left',
            dimensions: { width: 32, height: 128 },
            rotation: 90,
            idleTimeoutSec: 30,
            screenOffTimeoutSec: 60,
            idleScreensEnabled: false,
            blocks: [],
            idleBlocks: [],
          }
        }
      };
      const dts = generateDevicetreeLayouts(metadata, []);
      expect(dts).toContain('#include "scyan_symbols.dtsi"');
      expect(dts).not.toContain('#include "scyan_assets.h"');
    });

    it('sortSymbolSlices orders multi-frame group members contiguously by groupOrder', () => {
      const unorderedSlices: any[] = [
        { id: 'SYMBOL_STANDALONE_0', groupId: 'SYMBOL_STANDALONE_0', groupOrder: 1, x: 0, y: 0, width: 8, height: 8 },
        { id: 'SYMBOL_ANIM_1', groupId: 'ANIM_DUCK', groupOrder: 1, x: 0, y: 0, width: 8, height: 8 },
        { id: 'SYMBOL_ANIM_5', groupId: 'ANIM_DUCK', groupOrder: 5, x: 0, y: 0, width: 8, height: 8 },
        { id: 'SYMBOL_STANDALONE_1', groupId: 'SYMBOL_STANDALONE_1', groupOrder: 1, x: 0, y: 0, width: 8, height: 8 },
        { id: 'SYMBOL_ANIM_2', groupId: 'ANIM_DUCK', groupOrder: 2, x: 0, y: 0, width: 8, height: 8 },
        { id: 'SYMBOL_ANIM_4', groupId: 'ANIM_DUCK', groupOrder: 4, x: 0, y: 0, width: 8, height: 8 },
        { id: 'SYMBOL_ANIM_3', groupId: 'ANIM_DUCK', groupOrder: 3, x: 0, y: 0, width: 8, height: 8 },
      ];

      const dtsi = generateDevicetreeSymbols(unorderedSlices);
      expect(dtsi).toBe(
        '#define SYMBOL_STANDALONE_0 0\n' +
        '#define SYMBOL_ANIM_1 1\n' +
        '#define SYMBOL_ANIM_2 2\n' +
        '#define SYMBOL_ANIM_3 3\n' +
        '#define SYMBOL_ANIM_4 4\n' +
        '#define SYMBOL_ANIM_5 5\n' +
        '#define SYMBOL_STANDALONE_1 6\n'
      );
    });

    it('unifies sanitizeSymbolId across Devicetree symbols, C header, and block devicetree formatting', () => {
      expect(sanitizeSymbolId('raw_icon')).toBe('SYMBOL_raw_icon');
      expect(sanitizeSymbolId('SYMBOL_already_clean')).toBe('SYMBOL_already_clean');
      expect(sanitizeSymbolId('icon-with-dash.and.dot')).toBe('SYMBOL_icon_with_dash_and_dot');
      expect(sanitizeSymbolId('', 7)).toBe('SYMBOL_7');
      expect(sanitizeSymbolId(undefined, 0)).toBe('SYMBOL_0');

      const slices: any[] = [
        { id: 'dirty-name', groupId: 'dirty-name', groupOrder: 1, x: 0, y: 0, width: 8, height: 8 },
        { id: 'clean_id', groupId: 'clean_id', groupOrder: 1, x: 0, y: 0, width: 8, height: 8 },
      ];

      // 1. generateDevicetreeSymbols emits SYMBOL_<SANITIZED>
      const symbolsDtsi = generateDevicetreeSymbols(slices);
      expect(symbolsDtsi).toContain('#define SYMBOL_dirty_name 0');
      expect(symbolsDtsi).toContain('#define SYMBOL_clean_id 1');

      // 2. generateCHeader emits the exact same #define SYMBOL_<SANITIZED>
      const testGrid = new BwpxGrid(16, 16);
      const cHeader = generateCHeader(testGrid, slices, testGrid, []);
      expect(cHeader).toContain('#define SYMBOL_dirty_name 0');
      expect(cHeader).toContain('#define SYMBOL_clean_id 1');
      expect(cHeader).toContain('[SYMBOL_dirty_name         ] = {');
      expect(cHeader).toContain('[SYMBOL_clean_id           ] = {');

      // 3. formatBlockToDevicetree formats symbols and symbol-id with SYMBOL_<SANITIZED>
      const blockProps: any = {
        compat: 'scyan,widget-battery',
        compatSuffix: 'battery',
        x: 0,
        y: 0,
        width: 10,
        height: 10,
        enabled: true,
        mode: 0,
        param1: 0,
        param2: 0,
        param3: 0,
        symbolIds: ['dirty-name', 'clean_id'],
        symbolId: 'dirty-name',
        textEntries: [],
      };
      const dts = formatBlockToDevicetree(blockProps, 0, 'disp_1_active');
      expect(dts).toContain('symbols = <SYMBOL_dirty_name SYMBOL_clean_id>;');
      expect(dts).toContain('symbol-id = <SYMBOL_dirty_name>;');
    });
  });
});



import { parseCHeader, generateCHeader } from '../cHeaderParser';
import { BwpxGrid } from '../../bwpx/core/BwpxGrid';
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
    expect(cHeader).toContain('/* ZMK_DISPLAY_STUDIO_METADATA');
    expect(cHeader).toContain('#define HAS_CUSTOM_LAYOUT_BLOCKS 1');
    expect(cHeader).toContain('LAYOUT_LEFT_ACTIVE_BLOCKS');
    expect(cHeader).toContain('WIDGET_TYPE_BATTERY');
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
      ],
      idleLeftBlocks: [
        { id: 'idle-art', widgetType: 'screensaver', name: 'Mascot', x: 3, y: 35, width: 26, height: 26, enabled: true, side: 'left' as const },
      ],
      idleRightBlocks: [],
      widgetInstances: {
        'wpm-chart': [{ id: 'wpm_1', widgetTypeId: 'wpm-chart', label: 'WPM Chart', config: { mode: 'symbol' as const, wpmChart: { width: 32, height: 24, gridSize: 4, targetSpeed: 100 } }, slots: {} }]
      }
    };

    const cCode = generateCHeader(symbolsGrid, symbolSlices, fontGrid, [], metadata);
    const tmpPath = path.join(os.tmpdir(), 'test_generated_assets.h');
    fs.writeFileSync(tmpPath, cCode);

    try {
      execSync(`gcc -fsyntax-only "${tmpPath}"`);
    } finally {
      if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
    }
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
    expect(cCode).toContain('.symbol_count = 3');
    expect(cCode).toContain('.symbol_ids = { SYMBOL_BATTERY_0, SYMBOL_BATTERY_1, SYMBOL_BATTERY_2 }');
    expect(cCode).toContain('.text_count = 3');
    expect(cCode).toContain('.text_entries = { "0%", "50%", "100%" }');
    expect(cCode).not.toContain('SYMBOL_BRACKET_LAYER(idx)');
    expect(cCode).not.toContain('SYMBOL_SKULL_LAYER(idx)');

    const parsed = parseCHeader(cCode);
    expect(parsed.metadata?.leftBlocks?.length).toBe(1);
    expect(parsed.metadata?.leftBlocks?.[0].widgetType).toBe('battery');
  });

  it('correctly parses user custom_display_assets.h and generates clean blocks without legacy fallbacks', async () => {
    const fs = await import('fs');
    const userHeader = fs.readFileSync('/home/Scyan/Projects/Firmware/zmk-config/include/custom_display_assets.h', 'utf8');
    const parsed = parseCHeader(userHeader);
    expect(parsed.metadata).toBeDefined();
    expect(parsed.symbolSlices.length).toBeGreaterThan(15);
    
    // Generate C header
    const generated = generateCHeader(parsed.symbolsGrid, parsed.symbolSlices, parsed.fontGrid, parsed.fontGlyphs, parsed.metadata);
    fs.writeFileSync('/tmp/regenerated_assets.h', generated);
    expect(generated).toContain('LAYOUT_LEFT_ACTIVE_BLOCKS');
    expect(generated).toContain('LAYOUT_RIGHT_ACTIVE_BLOCKS');
    expect(generated).toContain('LAYOUT_LEFT_IDLE_BLOCKS');
    expect(generated).toContain('LAYOUT_RIGHT_IDLE_BLOCKS');
    expect(generated).not.toContain('SYMBOL_BRACKET_LAYER(idx)');
    expect(generated).not.toContain('SYMBOL_SKULL_LAYER(idx)');
  });
});



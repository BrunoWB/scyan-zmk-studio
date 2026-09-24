import { describe, it, expect } from 'vitest';
import { parseCHeader, generateCHeader, generateDevicetreeLayouts, getDefaultAssets, type HeaderMetadata } from '../cHeaderParser';
import type { DisplayScreen } from '../../types/zmk';

describe('cHeaderParser Version 2 Slotted Displays Architecture', () => {
  it('emits Devicetree layout containers and Version 2 metadata', () => {
    const assets = getDefaultAssets();
    const screen1: DisplayScreen = {
      id: 'display-1',
      name: 'Corne Left Master',
      dimensions: { width: 32, height: 128 },
      rotation: 90,
      blocks: [
        { id: 'b-layer', widgetType: 'layer', name: 'Layer', y: 10, height: 14, enabled: true, side: 'central' },
        { id: 'b-battery', widgetType: 'battery', name: 'Battery', y: 30, height: 10, enabled: true, side: 'central' },
      ],
      idleBlocks: [
        { id: 'b-idle-cat', widgetType: 'screensaver', name: 'Idle Cat', y: 40, height: 26, enabled: true, side: 'central' },
      ],
      idleTimeoutSec: 30,
      screenOffTimeoutSec: 60,
      idleScreensEnabled: true,
    };

    const screen2: DisplayScreen = {
      id: 'display-2',
      name: 'Corne Right Peripheral',
      dimensions: { width: 32, height: 128 },
      rotation: 90,
      blocks: [
        { id: 'b-split', widgetType: 'split', name: 'Split Status', y: 20, height: 9, enabled: true, side: 'peripheral' },
      ],
      idleBlocks: [
        { id: 'b-idle-sleep', widgetType: 'screensaver', name: 'Idle Sleep', y: 40, height: 26, enabled: true, side: 'peripheral' },
      ],
      idleTimeoutSec: 15,
      screenOffTimeoutSec: 45,
      idleScreensEnabled: true,
    };

    const metadata: HeaderMetadata = {
      version: 2,
      shieldId: 'corne',
      shields: [
        { id: 'corne_left', shieldId: 'corne', name: 'Corne Left', side: 'left', isMaster: true },
        { id: 'corne_right', shieldId: 'corne', name: 'Corne Right', side: 'right', isMaster: false },
      ],
      displayAssignments: {
        corne_left: 'display-1',
        corne_right: 'display-2',
      },
      displays: {
        'display-1': screen1,
        'display-2': screen2,
      },
    };

    const cCode = generateCHeader(assets.symbolsGrid, assets.symbolSlices, assets.fontGrid, assets.fontMappings, metadata);
    const dts = generateDevicetreeLayouts(metadata, assets.symbolSlices);

    // 1. Verify Devicetree Layouts
    expect(dts).toContain('display_1_active: layout_display_1_active {');
    expect(dts).toContain('compatible = "scyan,display-layout";');
    expect(dts).toContain('compatible = "scyan,widget-layer";');
    expect(dts).toContain('compatible = "scyan,widget-battery";');
    expect(dts).toContain('display_1_idle: layout_display_1_idle {');
    expect(dts).toContain('compatible = "scyan,widget-screensaver";');

    expect(dts).toContain('display_2_active: layout_display_2_active {');
    expect(dts).toContain('compatible = "scyan,widget-split";');
    expect(dts).toContain('display_2_idle: layout_display_2_idle {');

    // 2. Verify C Header does NOT contain obsolete static layout arrays
    expect(cCode).not.toContain('LAYOUT_DISPLAY_1_ACTIVE_BLOCKS');
    expect(cCode).not.toContain('CONFIG_SCYAN_DISPLAY_SLOT');

    // 3. Verify 100% Round-Trip Metadata Parsing
    const parsed = parseCHeader(cCode);
    expect(parsed.metadata).toBeDefined();
    expect(parsed.metadata?.version).toBe(2);
    expect(parsed.metadata?.displays).toBeDefined();
    expect(parsed.metadata?.displays?.['display-1']).toBeDefined();
    expect(parsed.metadata?.displays?.['display-1'].blocks).toHaveLength(2);
    expect(parsed.metadata?.displays?.['display-2']).toBeDefined();
    expect(parsed.metadata?.displays?.['display-2'].blocks).toHaveLength(1);
    expect(parsed.metadata?.displays?.['display-2'].idleTimeoutSec).toBe(15);
    expect(parsed.metadata?.displayAssignments).toEqual({
      corne_left: 'display-1',
      corne_right: 'display-2',
    });
    expect(parsed.metadata?.shields).toHaveLength(2);
  });

  it('handles tertiary display slots (display-3 / peripheral-2) with correct aliases', () => {
    const assets = getDefaultAssets();
    const metadata: HeaderMetadata = {
      version: 2,
      shieldId: 'three_parts',
      shields: [
        { id: 'three_parts_dongle', shieldId: 'three_parts', name: 'Dongle', side: 'dongle', isMaster: true },
        { id: 'three_parts_left', shieldId: 'three_parts', name: 'Left', side: 'left', isMaster: false },
        { id: 'three_parts_right', shieldId: 'three_parts', name: 'Right', side: 'right', isMaster: false },
      ],
      displayAssignments: {
        three_parts_dongle: null,
        three_parts_left: 'display-1',
        three_parts_right: 'display-2',
      },
      displays: {
        'display-1': {
          id: 'display-1',
          name: 'Left Screen',
          dimensions: { width: 32, height: 128 },
          rotation: 90,
          blocks: [{ id: 'b1', widgetType: 'battery', name: 'Battery', y: 0, height: 10, enabled: true }],
          idleBlocks: [],
          idleTimeoutSec: 30,
          screenOffTimeoutSec: 60,
          idleScreensEnabled: true,
        },
        'display-2': {
          id: 'display-2',
          name: 'Right Screen',
          dimensions: { width: 32, height: 128 },
          rotation: 90,
          blocks: [{ id: 'b2', widgetType: 'split', name: 'Split', y: 0, height: 10, enabled: true }],
          idleBlocks: [],
          idleTimeoutSec: 30,
          screenOffTimeoutSec: 60,
          idleScreensEnabled: true,
        },
        'display-3': {
          id: 'display-3',
          name: 'Dongle Screen',
          dimensions: { width: 128, height: 32 },
          rotation: 0,
          blocks: [{ id: 'b3', widgetType: 'wpm', name: 'WPM', y: 0, height: 10, enabled: true }],
          idleBlocks: [],
          idleTimeoutSec: 60,
          screenOffTimeoutSec: 120,
          idleScreensEnabled: false,
        },
      },
    };

    const cCode = generateCHeader(assets.symbolsGrid, assets.symbolSlices, assets.fontGrid, assets.fontMappings, metadata);
    const dts = generateDevicetreeLayouts(metadata, assets.symbolSlices);

    expect(dts).toContain('display_1_active: layout_display_1_active {');
    expect(dts).toContain('display_2_active: layout_display_2_active {');
    expect(dts).toContain('display_3_active: layout_display_3_active {');
    expect(dts).toContain('compatible = "scyan,widget-wpm";');

    expect(cCode).not.toContain('LAYOUT_DISPLAY_3_ACTIVE_BLOCKS');

    const parsed = parseCHeader(cCode);
    expect(parsed.metadata?.version).toBe(2);
    expect(Object.keys(parsed.metadata?.displays || {})).toHaveLength(3);
    expect(parsed.metadata?.displays?.['display-3'].dimensions).toEqual({ width: 128, height: 32 });
    expect(parsed.metadata?.displays?.['display-3'].rotation).toBe(0);
  });

  it('parses raw slotted C header without metadata block into displays dictionary', () => {
    const rawC = `
#define DISPLAY_VIRTUAL_WIDTH 32
#define DISPLAY_VIRTUAL_HEIGHT 128

#define HAS_DISPLAY_1 1
static const struct display_layout_block LAYOUT_DISPLAY_1_ACTIVE_BLOCKS[1] = {
    { .type = 2, .x = 0, .y = 10, .width = 17, .height = 10, .enabled = true }
};
#define LAYOUT_DISPLAY_1_ACTIVE_COUNT 1
static const struct display_layout_block LAYOUT_DISPLAY_1_IDLE_BLOCKS[1] = {
    { .type = 8, .x = 3, .y = 35, .width = 26, .height = 26, .enabled = true }
};
#define LAYOUT_DISPLAY_1_IDLE_COUNT 1

#define HAS_DISPLAY_2 1
static const struct display_layout_block LAYOUT_DISPLAY_2_ACTIVE_BLOCKS[1] = {
    { .type = 7, .x = 0, .y = 20, .width = 13, .height = 9, .enabled = true }
};
#define LAYOUT_DISPLAY_2_ACTIVE_COUNT 1
static const struct display_layout_block LAYOUT_DISPLAY_2_IDLE_BLOCKS[1] = {
    { .type = 8, .x = 3, .y = 35, .width = 26, .height = 26, .enabled = true }
};
#define LAYOUT_DISPLAY_2_IDLE_COUNT 1
`;

    const parsed = parseCHeader(rawC);
    expect(parsed.metadata?.displays).toBeDefined();
    expect(parsed.metadata?.displays?.['display-1']).toBeDefined();
    expect(parsed.metadata?.displays?.['display-1'].blocks).toHaveLength(1);
    expect(parsed.metadata?.displays?.['display-2']).toBeDefined();
    expect(parsed.metadata?.displays?.['display-2'].blocks).toHaveLength(1);
    expect(parsed.metadata?.centralBlocks).toHaveLength(1);
    expect(parsed.metadata?.peripheralBlocks).toHaveLength(1);
  });

  it('parses raw C header with tertiary slotted display (LAYOUT_DISPLAY_3_*) into display-3', () => {
    const rawC = `
#define DISPLAY_VIRTUAL_WIDTH 32
#define DISPLAY_VIRTUAL_HEIGHT 128

#define HAS_DISPLAY_1 1
static const struct display_layout_block LAYOUT_DISPLAY_1_ACTIVE_BLOCKS[1] = {
    { .type = 2, .x = 0, .y = 10, .width = 17, .height = 10, .enabled = true }
};
#define LAYOUT_DISPLAY_1_ACTIVE_COUNT 1
static const struct display_layout_block LAYOUT_DISPLAY_1_IDLE_BLOCKS[1] = {
    { .type = 8, .x = 3, .y = 35, .width = 26, .height = 26, .enabled = true }
};
#define LAYOUT_DISPLAY_1_IDLE_COUNT 1

#define HAS_DISPLAY_2 1
static const struct display_layout_block LAYOUT_DISPLAY_2_ACTIVE_BLOCKS[1] = {
    { .type = 7, .x = 0, .y = 20, .width = 13, .height = 9, .enabled = true }
};
#define LAYOUT_DISPLAY_2_ACTIVE_COUNT 1
static const struct display_layout_block LAYOUT_DISPLAY_2_IDLE_BLOCKS[1] = {
    { .type = 8, .x = 3, .y = 35, .width = 26, .height = 26, .enabled = true }
};
#define LAYOUT_DISPLAY_2_IDLE_COUNT 1

#define HAS_DISPLAY_3 1
static const struct display_layout_block LAYOUT_DISPLAY_3_ACTIVE_BLOCKS[1] = {
    { .type = 4, .x = 0, .y = 0, .width = 27, .height = 5, .enabled = true }
};
#define LAYOUT_DISPLAY_3_ACTIVE_COUNT 1
static const struct display_layout_block LAYOUT_DISPLAY_3_IDLE_BLOCKS[1] = {
    { .type = 8, .x = 0, .y = 0, .width = 26, .height = 26, .enabled = true }
};
#define LAYOUT_DISPLAY_3_IDLE_COUNT 1
`;

    const parsed = parseCHeader(rawC);
    expect(parsed.metadata?.displays).toBeDefined();
    expect(parsed.metadata?.displays?.['display-1']).toBeDefined();
    expect(parsed.metadata?.displays?.['display-2']).toBeDefined();
    expect(parsed.metadata?.displays?.['display-3']).toBeDefined();
    expect(parsed.metadata?.displays?.['display-3'].blocks).toHaveLength(1);
    expect(parsed.metadata?.displays?.['display-3'].idleBlocks).toHaveLength(1);
  });

  it('generates and parses 4 slotted displays dynamically including slot 4 alias', () => {
    const assets = getDefaultAssets();
    const metadata: HeaderMetadata = {
      version: 2,
      shieldId: 'quad_split',
      displays: {
        'display-1': {
          id: 'display-1',
          name: 'Left',
          dimensions: { width: 32, height: 128 },
          rotation: 90,
          blocks: [{ id: 'b1', widgetType: 'layer-banner', instanceId: 'layer-default', name: 'Layer', x: 0, y: 0, width: 32, height: 10, enabled: true }],
          idleBlocks: [],
          idleTimeoutSec: 30,
          screenOffTimeoutSec: 60,
          idleScreensEnabled: false,
        },
        'display-2': {
          id: 'display-2',
          name: 'Right',
          dimensions: { width: 32, height: 128 },
          rotation: 90,
          blocks: [{ id: 'b2', widgetType: 'battery', instanceId: 'battery-default', name: 'Battery', x: 0, y: 0, width: 32, height: 10, enabled: true }],
          idleBlocks: [],
          idleTimeoutSec: 30,
          screenOffTimeoutSec: 60,
          idleScreensEnabled: false,
        },
        'display-3': {
          id: 'display-3',
          name: 'Dongle',
          dimensions: { width: 128, height: 32 },
          rotation: 0,
          blocks: [{ id: 'b3', widgetType: 'wpm', instanceId: 'wpm-default', name: 'WPM', x: 0, y: 0, width: 27, height: 5, enabled: true }],
          idleBlocks: [],
          idleTimeoutSec: 30,
          screenOffTimeoutSec: 60,
          idleScreensEnabled: false,
        },
        'display-4': {
          id: 'display-4',
          name: 'Auxiliary',
          dimensions: { width: 64, height: 32 },
          rotation: 0,
          blocks: [{ id: 'b4', widgetType: 'bongo-cat', instanceId: 'bongo-default', name: 'Bongo', x: 0, y: 0, width: 32, height: 32, enabled: true }],
          idleBlocks: [],
          idleTimeoutSec: 30,
          screenOffTimeoutSec: 60,
          idleScreensEnabled: false,
        },
      },
    };

    const cCode = generateCHeader(assets.symbolsGrid, assets.symbolSlices, assets.fontGrid, assets.fontMappings, metadata);
    const dts = generateDevicetreeLayouts(metadata, assets.symbolSlices);

    expect(dts).toContain('display_1_active: layout_display_1_active {');
    expect(dts).toContain('display_2_active: layout_display_2_active {');
    expect(dts).toContain('display_3_active: layout_display_3_active {');
    expect(dts).toContain('display_4_active: layout_display_4_active {');
    expect(dts).toContain('compatible = "scyan,widget-bongo";');

    expect(cCode).not.toContain('LAYOUT_DISPLAY_4_ACTIVE_BLOCKS');
    expect(cCode).not.toContain('CONFIG_SCYAN_DISPLAY_SLOT');

    const parsed = parseCHeader(cCode);
    expect(Object.keys(parsed.metadata?.displays || {})).toHaveLength(4);
    expect(parsed.metadata?.displays?.['display-4'].name).toBe('Auxiliary');
    expect(parsed.metadata?.displays?.['display-4'].dimensions).toEqual({ width: 64, height: 32 });
  });
});


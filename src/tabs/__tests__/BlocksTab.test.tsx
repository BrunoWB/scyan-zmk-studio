import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { BlocksTab } from '../BlocksTab';
import { BwpxGrid } from '../../bwpx/core/BwpxGrid';
import type { LayoutBlock } from '../../types/zmk';

describe('BlocksTab Multi-Screen Dynamic Layout Architecture', () => {
  const dummyGrid = new BwpxGrid(32, 128);

  const sampleCentralBlocks: LayoutBlock[] = [
    { id: 'central-wpm', widgetType: 'wpm', name: 'WPM Central', x: 0, y: 0, width: 20, height: 10, enabled: true, side: 'central' },
  ];
  const samplePeripheralBlocks: LayoutBlock[] = [
    { id: 'peripheral-battery', widgetType: 'battery', name: 'Battery Peripheral', x: 0, y: 0, width: 17, height: 10, enabled: true, side: 'peripheral' },
  ];
  const samplePeripheral2Blocks: LayoutBlock[] = [
    { id: 'p2-conn', widgetType: 'connection', name: 'Output P2', x: 0, y: 0, width: 12, height: 10, enabled: true, side: 'peripheral-2' },
  ];

  it('renders Master display on the left, Widgets catalog in the center, and Peripheral on the right', () => {
    const html = renderToString(
      <BlocksTab
        symbolsGrid={dummyGrid}
        symbolSlices={[]}
        fontGrid={dummyGrid}
        customText="TEST"
        centralBlocks={sampleCentralBlocks}
        peripheralBlocks={samplePeripheralBlocks}
        enabledScreens={['central', 'peripheral']}
      />
    );

    // Central on the left
    expect(html).toContain('Central Active');

    // Widgets Catalog in the center
    expect(html).toContain('widget-catalog');

    // Peripheral on the right
    expect(html).toContain('Peripheral Active');

    // Add button on the far right
    expect(html).toContain('Add Display');

    // No hardcoded topology buttons
    expect(html).not.toContain('Dual Split (L + R)');
    expect(html).not.toContain('Split + Dongle Master (3 Screens)');
    expect(html).not.toContain('Dongle Master Only (1 Screen)');
  });

  it('renders multiple peripherals to the right of the widgets catalog', () => {
    const html = renderToString(
      <BlocksTab
        symbolsGrid={dummyGrid}
        symbolSlices={[]}
        fontGrid={dummyGrid}
        customText="TEST"
        centralBlocks={sampleCentralBlocks}
        peripheralBlocks={samplePeripheralBlocks}
        enabledScreens={['central', 'peripheral', 'peripheral-2']}
        peripheralScreens={{
          'peripheral-2': {
            name: 'Peripheral 2',
            blocks: samplePeripheral2Blocks,
          },
        }}
      />
    );

    // Central is on the left
    expect(html).toContain('Central Active');

    // Both peripherals are on the right of the catalog
    expect(html).toContain('Peripheral Active');
    expect(html).toContain('Peripheral 2 Active (Peripheral)');
  });

  it('renders Peripheral Actions with Make Master and Delete in peripheral settings', () => {
    const html = renderToString(
      <BlocksTab
        symbolsGrid={dummyGrid}
        symbolSlices={[]}
        fontGrid={dummyGrid}
        customText="TEST"
        centralBlocks={sampleCentralBlocks}
        peripheralBlocks={samplePeripheralBlocks}
        isRightSettingsOpen={true}
        enabledScreens={['central', 'peripheral']}
      />
    );

    // Peripheral settings open contains Make Central and Delete
    expect(html).toContain('Peripheral Actions');
    expect(html).toContain('Make Central Display');
    expect(html).toContain('Delete Display');
  });

  it('renders Central Actions with disabled Delete Display when only one screen exists', () => {
    const html = renderToString(
      <BlocksTab
        symbolsGrid={dummyGrid}
        symbolSlices={[]}
        fontGrid={dummyGrid}
        customText="TEST"
        centralBlocks={sampleCentralBlocks}
        isLeftSettingsOpen={true}
        enabledScreens={['central']}
      />
    );

    // Central settings contains Central Actions, Make Peripheral Display, and disabled Delete Display
    expect(html).toContain('Central Actions');
    expect(html).toContain('Make Peripheral Display');
    expect(html).toContain('Delete Display');
    expect(html).toContain('disabled=""');
    expect(html).not.toContain('Make Central Display');
  });

  it('supports arbitrary/unlimited peripheral displays (4+ screens) without disabling Add Display', () => {
    const html = renderToString(
      <BlocksTab
        symbolsGrid={dummyGrid}
        symbolSlices={[]}
        fontGrid={dummyGrid}
        customText="TEST"
        centralBlocks={sampleCentralBlocks}
        peripheralBlocks={samplePeripheralBlocks}
        enabledScreens={['central', 'peripheral', 'peripheral-2', 'peripheral-3', 'peripheral-4']}
        peripheralScreens={{
          'peripheral-2': {
            name: 'Numpad Display',
            blocks: [{ id: 'p2-blk', widgetType: 'connection', name: 'Conn P2', x: 0, y: 0, width: 12, height: 10, enabled: true, side: 'peripheral-2' }],
          },
          'peripheral-3': {
            name: 'Macro Pad Display',
            blocks: [{ id: 'p3-blk', widgetType: 'layer', name: 'Layer P3', x: 0, y: 0, width: 20, height: 10, enabled: true, side: 'peripheral-3' }],
          },
          'peripheral-4': {
            name: 'Status Bar Display',
            blocks: [{ id: 'p4-blk', widgetType: 'battery', name: 'Battery P4', x: 0, y: 0, width: 20, height: 10, enabled: true, side: 'peripheral-4' }],
          },
        }}
      />
    );

    // Central on the left
    expect(html).toContain('Central Active');

    // All 4 peripherals on the right of widgets catalog
    expect(html).toContain('Peripheral Active');
    expect(html).toContain('Numpad Display Active (Peripheral)');
    expect(html).toContain('Macro Pad Display Active (Peripheral)');
    expect(html).toContain('Status Bar Display Active (Peripheral)');

    // Add button is present and not disabled
    expect(html).toContain('Add Display');
    expect(html).toMatch(/<button[^>]*title="Add a new peripheral display to the right"[^>]*>/);
    const buttonMatch = html.match(/<button[^>]*title="Add a new peripheral display to the right"[^>]*>/);
    expect(buttonMatch?.[0]).not.toContain('disabled');
  });

  it('renders seamless display column containing active and idle sections without splitting', () => {
    const html = renderToString(
      <BlocksTab
        symbolsGrid={dummyGrid}
        symbolSlices={[]}
        fontGrid={dummyGrid}
        customText="TEST"
        centralBlocks={sampleCentralBlocks}
        peripheralBlocks={samplePeripheralBlocks}
        enabledScreens={['central', 'peripheral']}
        idleScreensEnabled={true}
      />
    );

    // blocks-column-oled container exists
    expect(html).toContain('blocks-column-oled');
    // It contains both active and idle sections seamlessly
    expect(html).toContain('oled-panel-active');
    expect(html).toContain('oled-panel-idle');
  });

  it('renders settings as side drawer when total displays <= 2, and as overlay when total displays > 2', () => {
    // Case 1: 2 displays (Master + 1 Peripheral) -> side drawer (no is-overlay)
    const html2Screens = renderToString(
      <BlocksTab
        symbolsGrid={dummyGrid}
        symbolSlices={[]}
        fontGrid={dummyGrid}
        customText="TEST"
        centralBlocks={sampleCentralBlocks}
        peripheralBlocks={samplePeripheralBlocks}
        enabledScreens={['central', 'peripheral']}
        isRightSettingsOpen={true}
      />
    );
    expect(html2Screens).toContain('side-settings-panel-container');
    expect(html2Screens).not.toContain('is-overlay');

    // Case 2: 3 displays (Master + 2 Peripherals) -> overlay over the display UI (is-overlay present)
    const html3Screens = renderToString(
      <BlocksTab
        symbolsGrid={dummyGrid}
        symbolSlices={[]}
        fontGrid={dummyGrid}
        customText="TEST"
        centralBlocks={sampleCentralBlocks}
        peripheralBlocks={samplePeripheralBlocks}
        enabledScreens={['central', 'peripheral', 'peripheral-2']}
        isRightSettingsOpen={true}
      />
    );
    expect(html3Screens).toContain('side-settings-panel-container');
    expect(html3Screens).toContain('is-overlay');
  });

  it('renders independent idle screen toggles and view mode controls per display', () => {
    // Central has idle enabled, Peripheral has idle disabled
    const html = renderToString(
      <BlocksTab
        symbolsGrid={dummyGrid}
        symbolSlices={[]}
        fontGrid={dummyGrid}
        customText="TEST"
        centralBlocks={sampleCentralBlocks}
        peripheralBlocks={samplePeripheralBlocks}
        enabledScreens={['central', 'peripheral']}
        idleScreensEnabled={true}
        peripheralIdleScreensEnabled={false}
      />
    );

    // Central has idle enabled: renders "View Idle" button and "Central Idle"
    expect(html).toContain('View Idle');
    expect(html).toContain('Central Idle');

    // Peripheral has idle disabled: renders Peripheral as idle-disabled without idle panel
    expect(html).toContain('Peripheral Active');
    expect(html).not.toContain('Peripheral Idle');
  });
});

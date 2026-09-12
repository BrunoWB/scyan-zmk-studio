import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { BlocksTab } from '../BlocksTab';
import { BwpxGrid } from '../../bwpx/core/BwpxGrid';
import type { LayoutBlock } from '../../types/zmk';

describe('BlocksTab Multi-Screen Dynamic Layout Architecture', () => {
  const dummyGrid = new BwpxGrid(32, 128);

  const sampleLeftBlocks: LayoutBlock[] = [
    { id: 'left-wpm', widgetType: 'wpm', name: 'WPM Left', x: 0, y: 0, width: 20, height: 10, enabled: true, side: 'left' },
  ];
  const sampleRightBlocks: LayoutBlock[] = [
    { id: 'right-battery', widgetType: 'battery', name: 'Battery Right', x: 0, y: 0, width: 17, height: 10, enabled: true, side: 'right' },
  ];
  const sampleDongleBlocks: LayoutBlock[] = [
    { id: 'dongle-conn', widgetType: 'connection', name: 'Output Dongle', x: 0, y: 0, width: 12, height: 10, enabled: true, side: 'dongle' },
  ];

  it('renders Master display on the left, Widgets catalog in the center, and Peripheral on the right', () => {
    const html = renderToString(
      <BlocksTab
        symbolsGrid={dummyGrid}
        symbolSlices={[]}
        fontGrid={dummyGrid}
        customText="TEST"
        leftBlocks={sampleLeftBlocks}
        rightBlocks={sampleRightBlocks}
        enabledScreens={['left', 'right']}
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
        leftBlocks={sampleLeftBlocks}
        rightBlocks={sampleRightBlocks}
        dongleBlocks={sampleDongleBlocks}
        enabledScreens={['left', 'right', 'dongle']}
      />
    );

    // Central is on the left
    expect(html).toContain('Central Active');

    // Both peripherals are on the right of the catalog
    expect(html).toContain('Peripheral Active');
    expect(html).toContain('Dongle Active (Peripheral)');

    // Display counter reflects 1 Central and 2 Peripherals
    expect(html).toContain('1 Central');
    expect(html).toContain('2 Peripherals');
  });

  it('renders Peripheral Actions with Make Master and Delete in peripheral settings', () => {
    const html = renderToString(
      <BlocksTab
        symbolsGrid={dummyGrid}
        symbolSlices={[]}
        fontGrid={dummyGrid}
        customText="TEST"
        leftBlocks={sampleLeftBlocks}
        rightBlocks={sampleRightBlocks}
        isRightSettingsOpen={true}
        enabledScreens={['left', 'right']}
      />
    );

    // Peripheral settings open contains Make Master and Delete
    expect(html).toContain('Peripheral Actions');
    expect(html).toContain('Make Master Display');
    expect(html).toContain('Delete Display');
  });

  it('does not render Delete Display in Master settings panel', () => {
    const html = renderToString(
      <BlocksTab
        symbolsGrid={dummyGrid}
        symbolSlices={[]}
        fontGrid={dummyGrid}
        customText="TEST"
        leftBlocks={sampleLeftBlocks}
        isLeftSettingsOpen={true}
        enabledScreens={['left']}
      />
    );

    // Master settings should NOT contain Delete Display or Make Master
    expect(html).not.toContain('Delete Display');
    expect(html).not.toContain('Make Master Display');
  });

  it('supports arbitrary/unlimited peripheral displays (4+ screens) without disabling Add Display', () => {
    const html = renderToString(
      <BlocksTab
        symbolsGrid={dummyGrid}
        symbolSlices={[]}
        fontGrid={dummyGrid}
        customText="TEST"
        leftBlocks={sampleLeftBlocks}
        rightBlocks={sampleRightBlocks}
        dongleBlocks={sampleDongleBlocks}
        enabledScreens={['left', 'right', 'dongle', 'peripheral-3', 'peripheral-4']}
        peripheralScreens={{
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
    expect(html).toContain('Dongle Active (Peripheral)');
    expect(html).toContain('Macro Pad Display Active (Peripheral)');
    expect(html).toContain('Status Bar Display Active (Peripheral)');

    // Counter shows 4 Peripherals
    expect(html).toContain('4 Peripherals');

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
        leftBlocks={sampleLeftBlocks}
        rightBlocks={sampleRightBlocks}
        enabledScreens={['left', 'right']}
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
        leftBlocks={sampleLeftBlocks}
        rightBlocks={sampleRightBlocks}
        enabledScreens={['left', 'right']}
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
        leftBlocks={sampleLeftBlocks}
        rightBlocks={sampleRightBlocks}
        dongleBlocks={sampleDongleBlocks}
        enabledScreens={['left', 'right', 'dongle']}
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
        leftBlocks={sampleLeftBlocks}
        rightBlocks={sampleRightBlocks}
        enabledScreens={['left', 'right']}
        idleScreensEnabled={true}
        rightIdleScreensEnabled={false}
      />
    );

    // Central has idle enabled: renders "View Idle" button and "Central Idle"
    expect(html).toContain('View Idle');
    expect(html).toContain('Central Idle');

    // Peripheral has idle disabled: renders Peripheral as idle-disabled without idle panel
    expect(html).toContain('Peripheral Active');
    expect(html).not.toContain('Peripheral Idle');

    // Independent Views buttons in topbar
    expect(html).toContain('All Active');
    expect(html).toContain('All Idle');
  });
});

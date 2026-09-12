import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { BlocksTab } from '../BlocksTab';
import { BwpxGrid } from '../../bwpx/core/BwpxGrid';
import type { LayoutBlock } from '../../types/zmk';

describe('BlocksTab Multi-Screen Topology and UX Layout', () => {
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

  it('renders dual split topology with Left Master, Center Catalog, and Right Peripheral by default', () => {
    const html = renderToString(
      <BlocksTab
        symbolsGrid={dummyGrid}
        symbolSlices={[]}
        fontGrid={dummyGrid}
        customText="TEST"
        leftBlocks={sampleLeftBlocks}
        rightBlocks={sampleRightBlocks}
        screenSetup="split"
        enabledScreens={['left', 'right']}
      />
    );

    expect(html).toContain('Left Active (Master)');
    expect(html).toContain('Right Active (Peripheral)');
    expect(html).not.toContain('Dongle Master Active');
    expect(html).toContain('Dual Split (L + R)');
    expect(html).toContain('Split + Dongle Master (3 Screens)');
    expect(html).toContain('Dongle Master Only (1 Screen)');
  });

  it('renders split-dongle topology with Left, Dongle Master, and Right screens', () => {
    const html = renderToString(
      <BlocksTab
        symbolsGrid={dummyGrid}
        symbolSlices={[]}
        fontGrid={dummyGrid}
        customText="TEST"
        leftBlocks={sampleLeftBlocks}
        rightBlocks={sampleRightBlocks}
        dongleBlocks={sampleDongleBlocks}
        screenSetup="split-dongle"
        enabledScreens={['left', 'dongle', 'right']}
      />
    );

    // Left and Right are now marked as Peripherals in split-dongle setup
    expect(html).toContain('Left Active (Peripheral)');
    expect(html).toContain('Dongle Master Active');
    expect(html).toContain('Right Active (Peripheral)');

    // Top view switcher includes All Screens, Left, Dongle Master, Right
    expect(html).toContain('All Screens');
    expect(html).toContain('Left');
    expect(html).toContain('Dongle Master');
    expect(html).toContain('Right');
  });

  it('renders dongle-only topology with only Dongle screen and Widget Catalog', () => {
    const html = renderToString(
      <BlocksTab
        symbolsGrid={dummyGrid}
        symbolSlices={[]}
        fontGrid={dummyGrid}
        customText="TEST"
        leftBlocks={sampleLeftBlocks}
        rightBlocks={sampleRightBlocks}
        dongleBlocks={sampleDongleBlocks}
        screenSetup="dongle-only"
        enabledScreens={['dongle']}
      />
    );

    expect(html).toContain('Dongle Master Active');
    expect(html).not.toContain('Left Active');
    expect(html).not.toContain('Right Active');
    expect(html).toContain('widget-catalog');
  });
});

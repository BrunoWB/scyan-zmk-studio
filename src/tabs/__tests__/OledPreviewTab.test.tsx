import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { OledPreviewTab } from '../OledPreviewTab';
import { BwpxGrid } from '../../bwpx/core/BwpxGrid';
import type { LayoutBlock } from '../../types/zmk';

describe('OledPreviewTab dynamic screen dimensions & widget moving', () => {
  const dummyGrid = new BwpxGrid(32, 128);

  const sampleLeftBlocks: LayoutBlock[] = [
    {
      id: 'left-battery',
      widgetType: 'battery',
      name: 'Battery Meter',
      x: 5,
      y: 10,
      width: 20,
      height: 10,
      enabled: true,
      side: 'left',
    },
  ];

  const sampleRightBlocks: LayoutBlock[] = [
    {
      id: 'right-split',
      widgetType: 'split',
      name: 'Split Link',
      x: 8,
      y: 15,
      width: 14,
      height: 9,
      enabled: true,
      side: 'right',
    },
  ];

  it('renders screens with custom dimensions matching layout settings', () => {
    const html = renderToString(
      <OledPreviewTab
        symbolsGrid={dummyGrid}
        symbolSlices={[]}
        fontGrid={dummyGrid}
        customText="TEST"
        onCustomTextChange={() => {}}
        leftBlocks={sampleLeftBlocks}
        rightBlocks={sampleRightBlocks}
        screenDimensions={{ width: 128, height: 32 }}
        rightScreenDimensions={{ width: 128, height: 32 }}
        symmetricSettings={true}
      />
    );

    // Display titles (MASTER / PERIPHERAL badges) are removed
    expect(html).not.toContain('MASTER');
    expect(html).not.toContain('PERIPHERAL');

    // Displays reflect the custom dimensions in housing dimensions (180x45 + border)
    expect(html).toContain('width:190px');
    expect(html).toContain('height:55px');

    // Both widget overlays are rendered
    expect(html).toContain('oled-block-overlay');
    expect(html).toContain('Battery Meter');
    expect(html).toContain('Split Link');
  });

  it('renders independent dimensions when asymmetricSettings is false', () => {
    const html = renderToString(
      <OledPreviewTab
        symbolsGrid={dummyGrid}
        symbolSlices={[]}
        fontGrid={dummyGrid}
        customText="TEST"
        onCustomTextChange={() => {}}
        leftBlocks={sampleLeftBlocks}
        rightBlocks={sampleRightBlocks}
        screenDimensions={{ width: 32, height: 128 }}
        rightScreenDimensions={{ width: 64, height: 128 }}
        symmetricSettings={false}
      />
    );

    // Left display is 48px (+10 border = 58px), Right display is 96px (+10 border = 106px)
    expect(html).toContain('width:58px');
    expect(html).toContain('width:106px');
  });

  it('renders bongo cat widget with configured speed limits', () => {
    const sampleBongoBlocks: LayoutBlock[] = [
      {
        id: 'bongo-widget',
        widgetType: 'bongo',
        name: 'Bongo Cat',
        x: 0,
        y: 40,
        width: 32,
        height: 24,
        enabled: true,
        side: 'left',
      },
    ];

    const sampleInstances = {
      bongo: [
        {
          id: 'bongo-1',
          widgetTypeId: 'bongo',
          label: 'Bongo Cat',
          config: {
            mode: 'symbol' as const,
            bongoTapMs: 60,
          },
        },
      ],
    };

    const html = renderToString(
      <OledPreviewTab
        symbolsGrid={dummyGrid}
        symbolSlices={[]}
        fontGrid={dummyGrid}
        customText="TEST"
        onCustomTextChange={() => {}}
        leftBlocks={sampleBongoBlocks}
        rightBlocks={[]}
        instances={sampleInstances}
      />
    );

    expect(html).toContain('Bongo Cat');
    expect(html).toContain('oled-block-overlay');
  });

  it('renders character clicker and typing speed controls', () => {
    const html = renderToString(
      <OledPreviewTab
        symbolsGrid={dummyGrid}
        symbolSlices={[]}
        fontGrid={dummyGrid}
        customText="TEST"
        onCustomTextChange={() => {}}
        leftBlocks={sampleLeftBlocks}
        rightBlocks={sampleRightBlocks}
      />
    );

    expect(html).toContain('Character Clicker');
    expect(html).toContain('active-accent');
    expect(html).not.toContain('Clicker: OFF');
    expect(html).toContain('Typing Speed (WPM)');
    expect(html).toContain('68 WPM');
  });

  it('renders central dongle unit case in between keyboard halves when dongle is enabled', () => {
    const sampleDongleBlocks: LayoutBlock[] = [
      {
        id: 'dongle-battery',
        widgetType: 'battery',
        name: 'Dongle Battery',
        x: 0,
        y: 0,
        width: 17,
        height: 10,
        enabled: true,
        side: 'dongle',
      },
    ];

    const html = renderToString(
      <OledPreviewTab
        symbolsGrid={dummyGrid}
        symbolSlices={[]}
        fontGrid={dummyGrid}
        customText="TEST"
        onCustomTextChange={() => {}}
        leftBlocks={sampleLeftBlocks}
        rightBlocks={sampleRightBlocks}
        dongleBlocks={sampleDongleBlocks}
        enabledScreens={['central', 'dongle', 'peripheral']}
      />
    );

    // Left keyboard half is rendered
    expect(html).toContain('corne-half-case left-half');
    // Central dongle case is rendered
    expect(html).toContain('dongle-unit-case');
    expect(html).toContain('Dongle Master');
    expect(html).toContain('Dongle Battery');
    // Right keyboard half is rendered
    expect(html).toContain('corne-half-case right-half');
    // Simulator control reflects 3-screen mode
    expect(html).toContain('3-Screen Multi-Display');
  });

  it('renders standalone dongle unit case without keyboards when only dongle screen is enabled', () => {
    const sampleDongleBlocks: LayoutBlock[] = [
      {
        id: 'dongle-wpm',
        widgetType: 'wpm',
        name: 'Dongle WPM',
        x: 0,
        y: 0,
        width: 28,
        height: 16,
        enabled: true,
        side: 'dongle',
      },
    ];

    const html = renderToString(
      <OledPreviewTab
        symbolsGrid={dummyGrid}
        symbolSlices={[]}
        fontGrid={dummyGrid}
        customText="TEST"
        onCustomTextChange={() => {}}
        dongleBlocks={sampleDongleBlocks}
        enabledScreens={['dongle']}
      />
    );

    // Keyboards are not rendered
    expect(html).not.toContain('corne-half-case left-half');
    expect(html).not.toContain('corne-half-case right-half');
    // Dongle case is rendered standalone
    expect(html).toContain('dongle-unit-case');
    expect(html).toContain('Dongle Master');
    expect(html).toContain('Dongle WPM');
    expect(html).toContain('Dongle Display');
  });

  it('renders purple wrapper without USB connector for unknown shields in preview tab', () => {
    const html = renderToString(
      <OledPreviewTab
        symbolsGrid={dummyGrid}
        symbolSlices={[]}
        fontGrid={dummyGrid}
        customText="TEST"
        onCustomTextChange={() => {}}
        leftBlocks={sampleLeftBlocks}
        rightBlocks={sampleRightBlocks}
        shieldId="unknown"
        enabledScreens={['central', 'peripheral']}
      />
    );

    // Purple wrapper cases and bodies for both displays
    expect(html).toContain('unknown-shield-unit-case');
    expect(html).toContain('unknown-shield-body');
    expect(html).toContain('unknown-shield-header-badge');
    expect(html).toContain('Custom / Unknown Shield (Central)');
    expect(html).toContain('Custom / Unknown Shield (Peripheral)');

    // Corne half cases are NOT rendered
    expect(html).not.toContain('corne-half-case');
    // Strictly NO USB connector
    expect(html).not.toContain('dongle-usb-connector');
    expect(html).not.toContain('dongle-usb-metal');
    expect(html).not.toContain('dongle-usb-pin');
  });

  it('keeps drag zones completely invisible during resting state (zero clutter)', () => {
    const html = renderToString(
      <OledPreviewTab
        symbolsGrid={dummyGrid}
        symbolSlices={[]}
        fontGrid={dummyGrid}
        customText="TEST"
        onCustomTextChange={() => {}}
        leftBlocks={sampleLeftBlocks}
        rightBlocks={sampleRightBlocks}
        enabledScreens={['central', 'peripheral']}
      />
    );

    // Units are realignable wrappers
    expect(html).toContain('preview-realignable-unit');
    expect(html).toContain('draggable="true"');

    // Drop slots and swap overlays are completely absent when idle (not dragging)
    expect(html).not.toContain('preview-realign-drop-slot');
    expect(html).not.toContain('preview-unit-swap-overlay');
    expect(html).not.toContain('Drop to realign position');
    expect(html).not.toContain('Swap Position');
  });

  it('renders reordered configuration according to enabledScreens order', () => {
    const html = renderToString(
      <OledPreviewTab
        symbolsGrid={dummyGrid}
        symbolSlices={[]}
        fontGrid={dummyGrid}
        customText="TEST"
        onCustomTextChange={() => {}}
        leftBlocks={sampleLeftBlocks}
        rightBlocks={sampleRightBlocks}
        dongleBlocks={[]}
        // Inverted: peripheral first, then dongle, then central
        enabledScreens={['peripheral', 'dongle', 'central']}
      />
    );

    // All 3 units rendered
    expect(html).toContain('corne-half-case right-half');
    expect(html).toContain('dongle-unit-case');
    expect(html).toContain('corne-half-case left-half');

    // Check DOM order: right-half appears before dongle-unit-case, which appears before left-half
    const rightIdx = html.indexOf('corne-half-case right-half');
    const dongleIdx = html.indexOf('dongle-unit-case');
    const leftIdx = html.indexOf('corne-half-case left-half');

    expect(rightIdx).toBeLessThan(dongleIdx);
    expect(dongleIdx).toBeLessThan(leftIdx);
  });
});

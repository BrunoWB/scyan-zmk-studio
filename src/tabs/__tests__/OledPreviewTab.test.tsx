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

    // Displays have MASTER and PERIPHERAL badges with dimensions
    expect(html).toContain('MASTER');
    expect(html).toContain('PERIPHERAL');
    expect(html).toContain('128×32');

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

    expect(html).toContain('32×128');
    expect(html).toContain('64×128');
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
});

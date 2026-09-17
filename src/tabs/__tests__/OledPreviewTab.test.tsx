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

    // Draggable glass housings are rendered
    expect(html).toContain('oled-glass-housing');
    expect(html).toContain('draggable="true"');
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

    expect(html).toContain('oled-glass-housing');
    expect(html).toContain('draggable="true"');
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

  it('renders multi-screen configuration with dynamic peripheral screen', () => {
    const html = renderToString(
      <OledPreviewTab
        symbolsGrid={dummyGrid}
        symbolSlices={[]}
        fontGrid={dummyGrid}
        customText="TEST"
        onCustomTextChange={() => {}}
        centralBlocks={sampleLeftBlocks}
        peripheralBlocks={sampleRightBlocks}
        enabledScreens={['central', 'peripheral', 'peripheral-2']}
      />
    );

    // Left and right keyboard halves rendered
    expect(html).toContain('corne-half-case left-half');
    expect(html).toContain('corne-half-case right-half');
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

    // Units are rendered with shield wrappers and draggable OLED screen
    expect(html).toContain('preview-shield-wrapper');
    expect(html).toContain('oled-glass-housing');
    expect(html).toContain('draggable="true"');

    // Shield casings themselves are static (no realign drop slots or swap overlays)
    expect(html).not.toContain('preview-realign-drop-slot');
    expect(html).not.toContain('preview-unit-swap-overlay');
    expect(html).not.toContain('Drop to realign position');
    expect(html).not.toContain('Swap Position');
  });

  it('maintains physical shield order when displays are swapped across shields', () => {
    const html = renderToString(
      <OledPreviewTab
        symbolsGrid={dummyGrid}
        symbolSlices={[]}
        fontGrid={dummyGrid}
        customText="TEST"
        onCustomTextChange={() => {}}
        centralBlocks={sampleLeftBlocks}
        peripheralBlocks={sampleRightBlocks}
        enabledScreens={['central', 'peripheral']}
        displayAssignments={{
          'corne_left': 'peripheral',
          'corne_right': 'central',
        }}
      />
    );

    // Both units rendered
    expect(html).toContain('corne-half-case left-half');
    expect(html).toContain('corne-half-case right-half');

    // Physical shield order is strictly maintained: left half on left, right half on right
    const leftIdx = html.indexOf('corne-half-case left-half');
    const rightIdx = html.indexOf('corne-half-case right-half');
    expect(leftIdx).toBeGreaterThan(-1);
    expect(rightIdx).toBeGreaterThan(-1);
    expect(leftIdx).toBeLessThan(rightIdx);
  });

  it('renders empty OLED bay on shield when display is unattached (e.g. deleted in layout)', () => {
    const html = renderToString(
      <OledPreviewTab
        symbolsGrid={dummyGrid}
        symbolSlices={[]}
        fontGrid={dummyGrid}
        customText="TEST"
        onCustomTextChange={() => {}}
        centralBlocks={sampleLeftBlocks}
        peripheralBlocks={sampleRightBlocks}
        enabledScreens={['central']}
        displayAssignments={{
          'corne_left': 'central',
          'corne_right': null,
        }}
      />
    );

    // Both shield halves are still present
    expect(html).toContain('corne-half-case left-half');
    expect(html).toContain('corne-half-case right-half');

    // Left half has active OLED glass housing
    expect(html).toContain('oled-glass-housing');

    // Right half has Empty OLED Bay socket
    expect(html).toContain('preview-oled-empty-bay');
    expect(html).toContain('Empty OLED Bay');
    expect(html).toContain('No display attached');
  });

  it('renders unattached displays section with warning banner when display has no shield', () => {
    const html = renderToString(
      <OledPreviewTab
        symbolsGrid={dummyGrid}
        symbolSlices={[]}
        fontGrid={dummyGrid}
        customText="TEST"
        onCustomTextChange={() => {}}
        centralBlocks={sampleLeftBlocks}
        peripheralBlocks={sampleRightBlocks}
        enabledScreens={['central', 'peripheral', 'peripheral-2']}
        displayAssignments={{
          'corne_left': 'central',
          'corne_right': 'peripheral',
        }}
      />
    );

    // Unattached display section rendered
    expect(html).toContain('unattached-displays-section');
    expect(html).toContain('Unattached Displays (1)');
    expect(html).toContain("Display is not attached and won&#x27;t be saved when committing.");
    expect(html).toContain('unattached-display-card');
  });

  it('renders central shield badge C with tooltip and no header inside the shields', () => {
    const html = renderToString(
      <OledPreviewTab
        symbolsGrid={dummyGrid}
        symbolSlices={[]}
        fontGrid={dummyGrid}
        customText="TEST"
        onCustomTextChange={() => {}}
        centralBlocks={sampleLeftBlocks}
        peripheralBlocks={sampleRightBlocks}
        enabledScreens={['central', 'peripheral']}
        displayAssignments={{
          'corne_left': 'central',
          'corne_right': 'peripheral',
        }}
      />
    );

    // No header inside the shields
    expect(html).not.toContain('preview-shield-header-bar');

    // Central shield has Cpu icon badge with tooltip
    expect(html).toContain('central-shield-badge');
    expect(html).toContain('central-shield-badge-dot');
    expect(html).toContain('lucide-cpu');
    expect(html).toContain('Central Shield');
  });

  it('keeps left half on left and right half on right when left half has empty bay', () => {
    const html = renderToString(
      <OledPreviewTab
        symbolsGrid={dummyGrid}
        symbolSlices={[]}
        fontGrid={dummyGrid}
        customText="TEST"
        onCustomTextChange={() => {}}
        centralBlocks={sampleLeftBlocks}
        peripheralBlocks={sampleRightBlocks}
        enabledScreens={['peripheral']}
        displayAssignments={{
          'corne_left': null,
          'corne_right': 'peripheral',
        }}
      />
    );

    // Left half still precedes right half in DOM
    const leftIdx = html.indexOf('corne-half-case left-half');
    const rightIdx = html.indexOf('corne-half-case right-half');
    expect(leftIdx).toBeGreaterThan(-1);
    expect(rightIdx).toBeGreaterThan(-1);
    expect(leftIdx).toBeLessThan(rightIdx);

    // Left half has Empty OLED Bay, Right half has glass housing
    expect(html).toContain('Empty OLED Bay');
    expect(html).toContain('oled-glass-housing');
  });
});

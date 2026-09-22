import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { OledPreviewTab } from '../OledPreviewTab';
import { BwpxGrid } from '../../pixel/core/PixelGrid';
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
    expect(html).toContain('Custom / Unknown Shield Left');
    expect(html).toContain('Custom / Unknown Shield Right');

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

  it('renders preview-shield-drag-handle on each shield with draggable=true and correct testids', () => {
    const html = renderToString(
      <OledPreviewTab
        symbolsGrid={dummyGrid}
        symbolSlices={[]}
        fontGrid={dummyGrid}
        customText="TEST"
        onCustomTextChange={() => {}}
        centralBlocks={sampleLeftBlocks}
        peripheralBlocks={sampleRightBlocks}
      />
    );

    // Each shield has its own drag handle pill with grab cursor and no inline title text
    expect(html).toContain('preview-shield-drag-handle');
    expect(html).toContain('cursor-grab');
    expect(html).toContain('data-testid="shield-drag-handle-corne_left"');
    expect(html).toContain('data-testid="shield-drag-handle-corne_right"');
    expect(html).toContain('title="Drag to reposition Corne (CRKBD) Left"');
    expect(html).toContain('title="Drag to reposition Corne (CRKBD) Right"');
    expect(html).not.toContain('<span>Corne (CRKBD) Left</span>');
    expect(html).not.toContain('<span>Corne (CRKBD) Right</span>');
  });

  it('renders shields in custom topology order when loadedShields are reordered (putting shield to one of the sides)', () => {
    // Simulate user having dragged corne_right to the left side: [corne_right, corne_left]
    const reorderedShields = [
      {
        id: 'corne_right',
        shieldId: 'corne',
        name: 'Corne Right',
        side: 'right' as const,
        isMaster: false,
      },
      {
        id: 'corne_left',
        shieldId: 'corne',
        name: 'Corne Left',
        side: 'left' as const,
        isMaster: true,
      },
    ];

    const html = renderToString(
      <OledPreviewTab
        symbolsGrid={dummyGrid}
        symbolSlices={[]}
        fontGrid={dummyGrid}
        customText="TEST"
        onCustomTextChange={() => {}}
        centralBlocks={sampleLeftBlocks}
        peripheralBlocks={sampleRightBlocks}
        loadedShields={reorderedShields}
      />
    );

    const leftIdx = html.indexOf('corne-half-case left-half');
    const rightIdx = html.indexOf('corne-half-case right-half');
    expect(leftIdx).toBeGreaterThan(-1);
    expect(rightIdx).toBeGreaterThan(-1);
    // User aesthetic choice is persisted: right half precedes left half in DOM
    expect(rightIdx).toBeLessThan(leftIdx);
  });

  it('renders 3-part multi-shield topology including dongle enclosure with dedicated drag handles', () => {
    // 3 shields: Dongle, Left half, Right half
    const threeShields = [
      {
        id: 'xiao_dongle',
        shieldId: 'xiao-dongle',
        name: 'Xiao Dongle',
        side: 'dongle' as const,
        isMaster: true,
      },
      {
        id: 'corne_left',
        shieldId: 'corne',
        name: 'Corne Left',
        side: 'left' as const,
        isMaster: false,
      },
      {
        id: 'corne_right',
        shieldId: 'corne',
        name: 'Corne Right',
        side: 'right' as const,
        isMaster: false,
      },
    ];

    const html = renderToString(
      <OledPreviewTab
        symbolsGrid={dummyGrid}
        symbolSlices={[]}
        fontGrid={dummyGrid}
        customText="TEST"
        onCustomTextChange={() => {}}
        centralBlocks={sampleLeftBlocks}
        peripheralBlocks={sampleRightBlocks}
        loadedShields={threeShields}
        displayAssignments={{
          'xiao_dongle': 'central',
          'corne_left': 'peripheral',
          'corne_right': null,
        }}
      />
    );

    // Dongle enclosure is rendered
    expect(html).toContain('dongle-unit-case');
    expect(html).toContain('dongle-usb-connector');
    expect(html).toContain('dongle-body');

    // All 3 drag handles exist
    expect(html).toContain('data-testid="shield-drag-handle-xiao_dongle"');
    expect(html).toContain('data-testid="shield-drag-handle-corne_left"');
    expect(html).toContain('data-testid="shield-drag-handle-corne_right"');

    // Dongle is at far left (index 0)
    const dongleIdx = html.indexOf('dongle-unit-case');
    const leftHalfIdx = html.indexOf('corne-half-case left-half');
    const rightHalfIdx = html.indexOf('corne-half-case right-half');
    expect(dongleIdx).toBeLessThan(leftHalfIdx);
    expect(leftHalfIdx).toBeLessThan(rightHalfIdx);
  });

  it('preserves display assignments when shields are in custom topological order', () => {
    // Swapped visual topology: [corne_right, corne_left]
    // Display assignments: corne_left has central, corne_right has peripheral
    const reorderedShields = [
      {
        id: 'corne_right',
        shieldId: 'corne',
        name: 'Corne Right',
        side: 'right' as const,
        isMaster: false,
      },
      {
        id: 'corne_left',
        shieldId: 'corne',
        name: 'Corne Left',
        side: 'left' as const,
        isMaster: true,
      },
    ];

    const html = renderToString(
      <OledPreviewTab
        symbolsGrid={dummyGrid}
        symbolSlices={[]}
        fontGrid={dummyGrid}
        customText="TEST"
        onCustomTextChange={() => {}}
        centralBlocks={sampleLeftBlocks}
        peripheralBlocks={sampleRightBlocks}
        loadedShields={reorderedShields}
        displayAssignments={{
          'corne_left': 'central',
          'corne_right': 'peripheral',
        }}
      />
    );

    // Both displays are attached to their respective shields regardless of visual position
    expect(html).toContain('oled-glass-housing');
    expect(html).not.toContain('preview-oled-empty-bay');
  });

  it('omits drop zones that lead to the same position as the source shield index', () => {
    // Pure drop zone index filtering algorithm verified:
    // When an item at sourceIndex is dragged across N shields,
    // dropping into slot sourceIndex (before it) or slot sourceIndex + 1 (after it)
    // results in the exact same array. Any such drop zone must be omitted.
    const isDropZoneValid = (zoneIndex: number, sourceIndex: number) => {
      return zoneIndex !== sourceIndex && zoneIndex !== sourceIndex + 1;
    };

    // Case 1: 2 shields (Left, Right). Dragging Left (sourceIndex = 0)
    // Total zones: [0, 1, 2]
    // Zone 0: before left -> invalid (omitted)
    // Zone 1: after left / before right -> invalid (omitted)
    // Zone 2: after right -> valid (only Move to Right should be shown)
    expect(isDropZoneValid(0, 0)).toBe(false);
    expect(isDropZoneValid(1, 0)).toBe(false);
    expect(isDropZoneValid(2, 0)).toBe(true);

    // Case 2: 2 shields. Dragging Right (sourceIndex = 1)
    // Zone 0: before left -> valid (Move to Left shown)
    // Zone 1: before right -> invalid (omitted)
    // Zone 2: after right -> invalid (omitted)
    expect(isDropZoneValid(0, 1)).toBe(true);
    expect(isDropZoneValid(1, 1)).toBe(false);
    expect(isDropZoneValid(2, 1)).toBe(false);

    // Case 3: 3 shields [Dongle, Left, Right]. Dragging middle shield (sourceIndex = 1)
    // Total zones: [0, 1, 2, 3]
    // Zone 0: before dongle -> valid
    // Zone 1: before left -> invalid (omitted)
    // Zone 2: after left -> invalid (omitted)
    // Zone 3: after right -> valid
    expect(isDropZoneValid(0, 1)).toBe(true);
    expect(isDropZoneValid(1, 1)).toBe(false);
    expect(isDropZoneValid(2, 1)).toBe(false);
    expect(isDropZoneValid(3, 1)).toBe(true);
  });

  it('symmetrically balances drop zones to preserve layout center during shield dragging', () => {
    // Symmetrical balancer algorithm verification:
    // For N shields, drop zones are [0, ..., N].
    // A zone j is active if j !== sourceIndex && j !== sourceIndex + 1.
    // A zone j is a balancer if !isActive(j) and isActive(N - j).
    // An active or balancer zone occupies 1 unit of horizontal width.
    const isDropZoneActive = (zoneIndex: number, sourceIndex: number) => {
      return zoneIndex !== sourceIndex && zoneIndex !== sourceIndex + 1;
    };

    const isDropZoneBalancer = (zoneIndex: number, sourceIndex: number, totalShields: number) => {
      if (isDropZoneActive(zoneIndex, sourceIndex)) return false;
      const counterpart = totalShields - zoneIndex;
      return isDropZoneActive(counterpart, sourceIndex);
    };

    // Helper to calculate total expanded slots on left and right of layout center
    const verifyCenterBalance = (sourceIndex: number, totalShields: number) => {
      const allZones = Array.from({ length: totalShields + 1 }, (_, i) => i);
      const activeCount = allZones.filter((z) => isDropZoneActive(z, sourceIndex)).length;
      const balancerCount = allZones.filter((z) => isDropZoneBalancer(z, sourceIndex, totalShields)).length;

      // Verify that for every zone j, the pair (j, N - j) has identical expansion
      for (let j = 0; j <= totalShields; j++) {
        const jExpands = isDropZoneActive(j, sourceIndex) || isDropZoneBalancer(j, sourceIndex, totalShields);
        const counterpartExpands =
          isDropZoneActive(totalShields - j, sourceIndex) ||
          isDropZoneBalancer(totalShields - j, sourceIndex, totalShields);
        expect(jExpands).toBe(counterpartExpands);
      }

      return { activeCount, balancerCount };
    };

    // Case 1: 2 shields (Left, Right). Dragging Left (sourceIndex = 0)
    // Zone 2 is active (Move to Right). Zone 0 is balancer (invisible counterweight on left).
    // Zone 1 (between shields) is resting.
    const res2Left = verifyCenterBalance(0, 2);
    expect(res2Left.activeCount).toBe(1);
    expect(res2Left.balancerCount).toBe(1);

    // Case 2: 2 shields. Dragging Right (sourceIndex = 1)
    // Zone 0 is active (Move to Left). Zone 2 is balancer.
    const res2Right = verifyCenterBalance(1, 2);
    expect(res2Right.activeCount).toBe(1);
    expect(res2Right.balancerCount).toBe(1);

    // Case 3: 3 shields [Left, Dongle, Right]. Dragging Dongle (sourceIndex = 1)
    // Zone 0 is active (left), Zone 3 is active (right).
    // Layout is naturally symmetric, 0 balancers needed.
    const res3Dongle = verifyCenterBalance(1, 3);
    expect(res3Dongle.activeCount).toBe(2);
    expect(res3Dongle.balancerCount).toBe(0);

    // Case 4: 3 shields. Dragging Left (sourceIndex = 0)
    // Zones 2 and 3 are active. Zones 0 and 1 are balancers.
    const res3Left = verifyCenterBalance(0, 3);
    expect(res3Left.activeCount).toBe(2);
    expect(res3Left.balancerCount).toBe(2);

    // Case 5: 4 shields. Dragging shield 1
    const res4 = verifyCenterBalance(1, 4);
    expect(res4.activeCount).toBe(3);
    expect(res4.balancerCount).toBe(1);
  });
});



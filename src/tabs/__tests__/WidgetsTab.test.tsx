import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { WidgetsTab } from '../WidgetsTab';
import { BwpxGrid } from '../../pixel/core/PixelGrid';
import type { WidgetInstanceMap } from '../../types/widget';

describe('WidgetsTab branding widget instance font size controls', () => {
  const dummyGrid = new BwpxGrid(32, 128);

  it('renders Font Size block exactly once for branding widget with mode="font"', () => {
    const instances: WidgetInstanceMap = {
      branding: [
        {
          id: 'branding-test-1',
          widgetTypeId: 'branding',
          label: 'Custom Text',
          config: {
            mode: 'font',
            fontSize: 'small',
            textEntries: ['SCYAN'],
          },
          slots: {},
        },
      ],
    };

    const html = renderToString(
      <WidgetsTab
        initialActiveWidgetId="branding"
        symbolsGrid={dummyGrid}
        symbolSlices={[]}
        fontGrid={dummyGrid}
        customText="SCYAN"
        onCustomTextChange={() => {}}
        instances={instances}
        onInstancesChange={() => {}}
      />
    );

    // Count occurrences of 'Font Size' in rendered output
    const matches = html.match(/Font Size/g);
    expect(matches).not.toBeNull();
    expect(matches?.length).toBe(1);
  });

  it('renders Font Size block exactly once for branding widget with mode="symbol"', () => {
    const instances: WidgetInstanceMap = {
      branding: [
        {
          id: 'branding-test-2',
          widgetTypeId: 'branding',
          label: 'Custom Text',
          config: {
            mode: 'symbol',
            fontSize: 'big',
            textEntries: ['SCYAN'],
          },
          slots: {},
        },
      ],
    };

    const html = renderToString(
      <WidgetsTab
        initialActiveWidgetId="branding"
        symbolsGrid={dummyGrid}
        symbolSlices={[]}
        fontGrid={dummyGrid}
        customText="SCYAN"
        onCustomTextChange={() => {}}
        instances={instances}
        onInstancesChange={() => {}}
      />
    );

    const matches = html.match(/Font Size/g);
    expect(matches).not.toBeNull();
    expect(matches?.length).toBe(1);
  });
});

describe('WidgetsTab typewriter random cleaning fade controls', () => {
  const dummyGrid = new BwpxGrid(32, 128);

  it('does NOT render Fade Effect or Fade Time controls when typewriterCleaning is 0', () => {
    const instances: WidgetInstanceMap = {
      typewriter: [
        {
          id: 'tw-no-clean',
          widgetTypeId: 'typewriter',
          label: 'Typewriter Random',
          config: {
            mode: 'random',
            typewriterMode: 'random',
            typewriterCleaning: 0,
            typewriterWidth: 32,
            typewriterHeight: 32,
          },
          slots: {},
        },
      ],
    };

    const html = renderToString(
      <WidgetsTab
        initialActiveWidgetId="typewriter"
        symbolsGrid={dummyGrid}
        symbolSlices={[]}
        fontGrid={dummyGrid}
        customText="TYPE"
        onCustomTextChange={() => {}}
        instances={instances}
        onInstancesChange={() => {}}
      />
    );

    expect(html).not.toContain('Fade Effect');
    expect(html).not.toContain('Fade Time');
  });

  it('renders Fade Effect dropdown and Fade Time slider when in random mode and typewriterCleaning > 0', () => {
    const instances: WidgetInstanceMap = {
      typewriter: [
        {
          id: 'tw-clean-fade',
          widgetTypeId: 'typewriter',
          label: 'Typewriter Random',
          config: {
            mode: 'random',
            typewriterMode: 'random',
            typewriterCleaning: 1.5,
            typewriterFadeType: 'dither',
            typewriterFadeTime: 0.75,
            typewriterWidth: 32,
            typewriterHeight: 32,
          },
          slots: {},
        },
      ],
    };

    const html = renderToString(
      <WidgetsTab
        initialActiveWidgetId="typewriter"
        symbolsGrid={dummyGrid}
        symbolSlices={[]}
        fontGrid={dummyGrid}
        customText="TYPE"
        onCustomTextChange={() => {}}
        instances={instances}
        onInstancesChange={() => {}}
      />
    );

    expect(html).toContain('Fade Effect');
    expect(html).toContain('Fade Time');
    expect(html).toContain('Dither (Bayer 1bpp matrix pattern decay)');
    expect(html).toContain('Dissolve (random pixel drop)');
    expect(html).toContain('Blink (flashing out)');
    expect(html).toContain('Instant');
    expect(html).toContain('0.75s');
  });

  it('does NOT render Fade Effect or Fade Time controls for spot or inline mode even when typewriterCleaning > 0', () => {
    const instances: WidgetInstanceMap = {
      typewriter: [
        {
          id: 'tw-spot-clean',
          widgetTypeId: 'typewriter',
          label: 'Typewriter Spot',
          config: {
            mode: 'spot',
            typewriterMode: 'spot',
            typewriterCleaning: 1.5,
            fontSize: 'small',
          },
          slots: {},
        },
      ],
    };

    const html = renderToString(
      <WidgetsTab
        initialActiveWidgetId="typewriter"
        symbolsGrid={dummyGrid}
        symbolSlices={[]}
        fontGrid={dummyGrid}
        customText="TYPE"
        onCustomTextChange={() => {}}
        instances={instances}
        onInstancesChange={() => {}}
      />
    );

    expect(html).not.toContain('Fade Effect');
    expect(html).not.toContain('Fade Time');
  });
});

describe('WidgetsTab typewriter inline direction buttons', () => {
  const dummyGrid = new BwpxGrid(32, 128);

  it('renders all four direction buttons with arrow icons, labels, titles, and active indicator', () => {
    const instances: WidgetInstanceMap = {
      typewriter: [
        {
          id: 'tw-dir-we',
          widgetTypeId: 'typewriter',
          label: 'Typewriter Inline',
          config: {
            mode: 'inline',
            typewriterMode: 'inline',
            typewriterDirection: 'we',
            typewriterWidth: 32,
          },
          slots: {},
        },
      ],
    };

    const html = renderToString(
      <WidgetsTab
        initialActiveWidgetId="typewriter"
        symbolsGrid={dummyGrid}
        symbolSlices={[]}
        fontGrid={dummyGrid}
        customText="TYPE"
        onCustomTextChange={() => {}}
        instances={instances}
        onInstancesChange={() => {}}
      />
    );

    expect(html).toContain('Direction');
    expect(html).toContain('WE');
    expect(html).toContain('EW');
    expect(html).toContain('NS');
    expect(html).toContain('SN');
    expect(html).toContain('West to East (Left-to-Right →)');
    expect(html).toContain('East to West (Right-to-Left ←)');
    expect(html).toContain('North to South (Top-to-Bottom ↓)');
    expect(html).toContain('South to North (Bottom-to-Top ↑)');
    expect(html).toContain('West to East (→ Left-to-Right typing)');
  });

  it('reflects active state and helper text for EW RTL direction', () => {
    const instances: WidgetInstanceMap = {
      typewriter: [
        {
          id: 'tw-dir-ew',
          widgetTypeId: 'typewriter',
          label: 'Typewriter Inline',
          config: {
            mode: 'inline',
            typewriterMode: 'inline',
            typewriterDirection: 'ew',
            typewriterWidth: 32,
          },
          slots: {},
        },
      ],
    };

    const html = renderToString(
      <WidgetsTab
        initialActiveWidgetId="typewriter"
        symbolsGrid={dummyGrid}
        symbolSlices={[]}
        fontGrid={dummyGrid}
        customText="TYPE"
        onCustomTextChange={() => {}}
        instances={instances}
        onInstancesChange={() => {}}
      />
    );

    expect(html).toContain('East to West (← Right-to-Left typing)');
  });

  it('reflects active state and helper text for NS and SN column directions', () => {
    const instancesNs: WidgetInstanceMap = {
      typewriter: [
        {
          id: 'tw-dir-ns',
          widgetTypeId: 'typewriter',
          label: 'Typewriter Inline',
          config: {
            mode: 'inline',
            typewriterMode: 'inline',
            typewriterDirection: 'ns',
            typewriterHeight: 32,
          },
          slots: {},
        },
      ],
    };

    const htmlNs = renderToString(
      <WidgetsTab
        initialActiveWidgetId="typewriter"
        symbolsGrid={dummyGrid}
        symbolSlices={[]}
        fontGrid={dummyGrid}
        customText="TYPE"
        onCustomTextChange={() => {}}
        instances={instancesNs}
        onInstancesChange={() => {}}
      />
    );
    expect(htmlNs).toContain('North to South (↓ Top-to-Bottom column)');

    const instancesSn: WidgetInstanceMap = {
      typewriter: [
        {
          id: 'tw-dir-sn',
          widgetTypeId: 'typewriter',
          label: 'Typewriter Inline',
          config: {
            mode: 'inline',
            typewriterMode: 'inline',
            typewriterDirection: 'sn',
            typewriterHeight: 32,
          },
          slots: {},
        },
      ],
    };

    const htmlSn = renderToString(
      <WidgetsTab
        initialActiveWidgetId="typewriter"
        symbolsGrid={dummyGrid}
        symbolSlices={[]}
        fontGrid={dummyGrid}
        customText="TYPE"
        onCustomTextChange={() => {}}
        instances={instancesSn}
        onInstancesChange={() => {}}
      />
    );
    expect(htmlSn).toContain('South to North (↑ Bottom-to-Top column)');
  });
});

describe('WidgetsTab typewriter random font size options and fade slider range', () => {
  const dummyGrid = new BwpxGrid(32, 128);

  it('renders Font Size trio (Small / Big / Both) with Both active by default in random mode', () => {
    const instances: WidgetInstanceMap = {
      typewriter: [
        {
          id: 'tw-rnd-default',
          widgetTypeId: 'typewriter',
          label: 'Typewriter Random',
          config: {
            mode: 'random',
            typewriterMode: 'random',
            typewriterWidth: 32,
            typewriterHeight: 32,
            typewriterCleaning: 0.2,
          },
          slots: {},
        },
      ],
    };

    const html = renderToString(
      <WidgetsTab
        initialActiveWidgetId="typewriter"
        symbolsGrid={dummyGrid}
        symbolSlices={[]}
        fontGrid={dummyGrid}
        customText="TYPE"
        onCustomTextChange={() => {}}
        instances={instances}
        onInstancesChange={() => {}}
      />
    );

    expect(html).toContain('button-trio');
    expect(html).toContain('Small');
    expect(html).toContain('Big');
    expect(html).toContain('Both');
    expect(html).toContain('Randomly mixes 5×5px and 10×10px letters.');

    // Both should have active class when fontSize is not specified
    const bothBtnRegex = /<button[^>]*class="[^"]*btn-toggle[^"]*active[^"]*"[^>]*><span>Both<\/span><\/button>/;
    expect(html).toMatch(bothBtnRegex);
  });

  it('renders fade time slider with 0 to 2 range and step 0.05', () => {
    const instances: WidgetInstanceMap = {
      typewriter: [
        {
          id: 'tw-rnd-fade-range',
          widgetTypeId: 'typewriter',
          label: 'Typewriter Random Fade',
          config: {
            mode: 'random',
            typewriterMode: 'random',
            typewriterWidth: 32,
            typewriterHeight: 32,
            typewriterCleaning: 0.2,
            typewriterFadeTime: 0.15,
          },
          slots: {},
        },
      ],
    };

    const html = renderToString(
      <WidgetsTab
        initialActiveWidgetId="typewriter"
        symbolsGrid={dummyGrid}
        symbolSlices={[]}
        fontGrid={dummyGrid}
        customText="TYPE"
        onCustomTextChange={() => {}}
        instances={instances}
        onInstancesChange={() => {}}
      />
    );

    expect(html).toContain('min="0"');
    expect(html).toContain('max="2"');
    expect(html).toContain('step="0.05"');
    expect(html).toContain('0.15s');
  });
});

describe('WidgetsTab keypress widget UI', () => {
  const dummyGrid = new BwpxGrid(32, 128);
  const testSlices = [
    { id: 'SYMBOL_ARROW_UP', name: 'Arrow Up', groupId: 'ARROWS', groupOrder: 1, x: 0, y: 0, width: 8, height: 8, color: '#fff' },
    { id: 'SYMBOL_ARROW_DOWN', name: 'Arrow Down', groupId: 'ARROWS', groupOrder: 2, x: 8, y: 0, width: 8, height: 8, color: '#fff' },
    { id: 'SYMBOL_IDLE', name: 'Idle Face', groupId: 'FACES', groupOrder: 1, x: 16, y: 0, width: 8, height: 8, color: '#fff' },
  ];

  it('renders interactive simulator controls and arrow d-pad buttons', () => {
    const instances: WidgetInstanceMap = {
      keypress: [
        {
          id: 'keypress-test',
          widgetTypeId: 'keypress',
          label: 'Arrow Keypress',
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
    };

    const html = renderToString(
      <WidgetsTab
        initialActiveWidgetId="keypress"
        symbolsGrid={dummyGrid}
        symbolSlices={testSlices}
        fontGrid={dummyGrid}
        instances={instances}
        onInstancesChange={() => {}}
      />
    );

    expect(html).toContain('Interactive Keypress Simulator:');
    expect(html).toContain('↑ Up');
    expect(html).toContain('↓ Down');
    expect(html).toContain('← Left');
    expect(html).toContain('→ Right');
    expect(html).toContain('Click here &amp; hold any key to test live...');
  });

  it('renders idle symbol selector and key-to-symbol elements', () => {
    const instances: WidgetInstanceMap = {
      keypress: [
        {
          id: 'keypress-test',
          widgetTypeId: 'keypress',
          label: 'Arrow Keypress',
          config: {
            mode: 'symbol',
            idleSymbolId: undefined,
            keypressElements: [
              { key: 'ArrowUp', symbolId: 'SYMBOL_ARROW_UP' },
              { key: 'ArrowDown', symbolId: 'SYMBOL_ARROW_DOWN' },
            ],
          },
          slots: {},
        },
      ],
    };

    const html = renderToString(
      <WidgetsTab
        initialActiveWidgetId="keypress"
        symbolsGrid={dummyGrid}
        symbolSlices={testSlices}
        fontGrid={dummyGrid}
        instances={instances}
        onInstancesChange={() => {}}
      />
    );

    expect(html).toContain('Idle Symbol');
    expect(html).toContain('(None - keep last key pressed symbol)');
    expect(html).toMatch(/Key-to-Symbol Mappings.*2/);
    expect(html).toContain('Reset Arrows');
    expect(html).toContain('+ Add Element');
    expect(html).toContain('value="ArrowUp"');
    expect(html).toContain('value="ArrowDown"');
    // Does not render generic mode radio buttons
    expect(html).not.toContain('aria-label="Display Mode"');
    // Renders CENTRAL badge
    expect(html).toContain('badge-master');
    expect(html).toContain('CENTRAL');
  });

  it('renders CENTRAL badge for typewriter widget template', () => {
    const html = renderToString(
      <WidgetsTab
        initialActiveWidgetId="typewriter"
        symbolsGrid={dummyGrid}
        symbolSlices={[]}
        fontGrid={dummyGrid}
        instances={{}}
        onInstancesChange={() => {}}
      />
    );

    expect(html).toContain('badge-master');
    expect(html).toContain('CENTRAL');
  });
});




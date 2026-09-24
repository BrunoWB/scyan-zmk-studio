import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { WidgetsDevTab } from '../WidgetsDevTab';
import { BwpxGrid } from '../../pixel/core/PixelGrid';
import type { WidgetInstanceMap } from '../../types/widget';

describe('WidgetsDevTab', () => {
  const dummyGrid = new BwpxGrid(32, 128);

  it('renders top toolbar with Widget Matrix title and dev preview badge', () => {
    const html = renderToString(
      <WidgetsDevTab
        symbolsGrid={dummyGrid}
        symbolSlices={[]}
        fontGrid={dummyGrid}
      />
    );

    expect(html).toContain('DEV PREVIEW');
    expect(html).toContain('Widget Matrix');
    expect(html).toContain('128×32');
    expect(html).toContain('Filter widgets...');
  });

  it('renders OLED display cards for widget instances', () => {
    const html = renderToString(
      <WidgetsDevTab
        symbolsGrid={dummyGrid}
        symbolSlices={[]}
        fontGrid={dummyGrid}
      />
    );

    // Cards should render with glass housing and canvas
    expect(html).toContain('oled-glass-housing');
    expect(html).toContain('corne-oled-canvas');
    expect(html).toContain('128×32');

    // Expected core widget types to be present
    expect(html).toContain('Battery Meter');
    expect(html).toContain('Output Status');
    expect(html).toContain('Layer Banner');
    expect(html).toContain('Typing Speed');
    expect(html).toContain('WPM Chart');
    expect(html).toContain('Bongo Cat');
  });

  it('renders bottom Live Keyboard Simulator Controls panel with all interactive inputs', () => {
    const html = renderToString(
      <WidgetsDevTab
        symbolsGrid={dummyGrid}
        symbolSlices={[]}
        fontGrid={dummyGrid}
      />
    );

    expect(html).toContain('Live Keyboard Simulator Controls');
    expect(html).toContain('Active Mode');
    expect(html).toContain('Idle Sleep');
    expect(html).toContain('Output Protocol');
    expect(html).toContain('Active Keyboard Layer');
    expect(html).toContain('Split Wireless Link');
    expect(html).toContain('Caps Lock State');
    expect(html).toContain('Character Clicker');
    expect(html).toContain('Battery');
    expect(html).toContain('Typing Speed (WPM)');
  });

  it('renders custom widget instances when provided via props', () => {
    const customInstances: WidgetInstanceMap = {
      battery: [
        {
          id: 'custom-battery-1',
          widgetTypeId: 'battery',
          label: 'Custom LiPo Meter',
          config: { mode: 'symbol', groupId: 'SYMBOL_BATTERY' },
        },
      ],
      animation: [
        {
          id: 'custom-anim-1',
          widgetTypeId: 'animation',
          label: 'Custom Neon Spark',
          config: { mode: 'symbol', groupId: 'SYMBOL_SPARK' },
        },
      ],
    };

    const html = renderToString(
      <WidgetsDevTab
        symbolsGrid={dummyGrid}
        symbolSlices={[]}
        fontGrid={dummyGrid}
        instances={customInstances}
      />
    );

    expect(html).toContain('Custom LiPo Meter');
    expect(html).toContain('Custom Neon Spark');
  });

  it('renders category filter buttons and scale options', () => {
    const html = renderToString(
      <WidgetsDevTab
        symbolsGrid={dummyGrid}
        symbolSlices={[]}
        fontGrid={dummyGrid}
      />
    );

    expect(html).toContain('>All<');
    expect(html).toContain('>Status<');
    expect(html).toContain('>Keymap<');
    expect(html).toContain('>Art<');
    expect(html).toContain('1×');
    expect(html).toContain('1.25×');
    expect(html).toContain('1.5×');
  });
});

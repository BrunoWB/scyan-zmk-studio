import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { WidgetsTab } from '../WidgetsTab';
import { BwpxGrid } from '../../bwpx/core/BwpxGrid';
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


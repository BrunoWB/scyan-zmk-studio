import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { FontAtlasTab } from '../FontAtlasTab';
import { BwpxGrid } from '../../bwpx/core/BwpxGrid';
import type { FontCharMapping } from '../../types/zmk';

describe('FontAtlasTab selection & editing card', () => {
  const dummyGrid = new BwpxGrid(128, 64);

  const sampleMappings: FontCharMapping[] = [
    {
      id: 'FONT_CHAR_A_0001',
      chars: 'A',
      small: { x: 0, y: 0, width: 6, height: 8, advanceX: 7 },
      big: { x: 0, y: 16, width: 12, height: 16, advanceX: 13 },
    },
    {
      id: 'FONT_CHAR_B_0002',
      chars: 'B',
      small: { x: 8, y: 0, width: 6, height: 8, advanceX: 7 },
      big: { x: 16, y: 16, width: 12, height: 16, advanceX: 13 },
    },
  ];

  it('does not pre-select mappings when entering the tab and does not show editing box', () => {
    const html = renderToString(
      <FontAtlasTab
        fontGrid={dummyGrid}
        onFontGridChange={() => {}}
        fontMappings={sampleMappings}
        onFontMappingsChange={() => {}}
      />
    );

    // Editing box should NOT be shown
    expect(html).not.toContain('font-mapping-editor-card');
    expect(html).not.toContain('aliases');
    // List header and items should be shown
    expect(html).toContain('Character Mappings');
    expect(html).toContain('A');
    expect(html).toContain('B');
  });

  it('renders font-mapping-editor-card when initialSelectedMappingId is provided', () => {
    const html = renderToString(
      <FontAtlasTab
        fontGrid={dummyGrid}
        onFontGridChange={() => {}}
        fontMappings={sampleMappings}
        onFontMappingsChange={() => {}}
        initialSelectedMappingId="FONT_CHAR_A_0001"
      />
    );

    // Editing box should be present
    expect(html).toContain('font-mapping-editor-card');
    expect(html).toContain('value="A"');
    expect(html).toContain('Deselect mapping');
  });
});

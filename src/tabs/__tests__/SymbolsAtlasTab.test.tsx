import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { SymbolsAtlasTab } from '../SymbolsAtlasTab';
import { BwpxGrid } from '../../bwpx/core/BwpxGrid';
import type { SpriteSlice } from '../../types/zmk';

describe('SymbolsAtlasTab selected-slice-card', () => {
  const dummyGrid = new BwpxGrid(128, 34);

  const sampleSlices: SpriteSlice[] = [
    {
      id: 'SYMBOL_BLUETOOTH',
      name: 'Bluetooth Connected',
      groupId: 'SYMBOL_BLUETOOTH',
      groupOrder: 1,
      x: 4,
      y: 8,
      width: 12,
      height: 14,
      color: '#00f0ff',
    },
    {
      id: 'SYMBOL_BLUETOOTH_DISC',
      name: undefined,
      groupId: 'SYMBOL_BLUETOOTH',
      groupOrder: 2,
      x: 18,
      y: 8,
      width: 12,
      height: 14,
      color: '#00f0ff',
    },
  ];

  it('renders selected-slice-card adhering to Element Reference design specifications', () => {
    const html = renderToString(
      <SymbolsAtlasTab
        symbolsGrid={dummyGrid}
        onSymbolsGridChange={() => {}}
        slices={sampleSlices}
        onSlicesChange={() => {}}
      />
    );

    // 1. Container matches Element Reference card styling
    expect(html).toContain('selected-slice-card');
    expect(html).toContain('rounded-2xl');

    // 2. Header matches Element Reference item cards
    expect(html).toContain('Bluetooth Connected');
    expect(html).toContain('Group Master');
    expect(html).toContain('12×14');

    // 3. Form fields match Element Reference FormControls
    expect(html).toContain('Symbol Group');
    expect(html).toContain('Display Name');

    // 4. Coordinate & Size Steppers match FormControls Card 2
    expect(html).toContain('Position Vector [X, Y]');
    expect(html).toContain('Dimensions Pair [W, H]');
    expect(html).toContain('X:');
    expect(html).toContain('Y:');
    expect(html).toContain('W:');
    expect(html).toContain('H:');

    // 5. Footer summary matches FormControls Card 2 footer
    expect(html).toContain('Pos:');
    expect(html).toContain('Size:');
  });
});

import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { SymbolGroupContextMenu } from '../SymbolGroupContextMenu';

describe('SymbolGroupContextMenu', () => {
  it('renders null when isOpen is false', () => {
    const html = renderToString(
      <SymbolGroupContextMenu
        isOpen={false}
        position={{ x: 100, y: 100 }}
        groupName="Test Group"
        slicesCount={2}
        onClose={() => {}}
        onExportPng={() => {}}
        onExportGif={() => {}}
      />
    );
    expect(html).toBe('');
  });

  it('renders null when position is null', () => {
    const html = renderToString(
      <SymbolGroupContextMenu
        isOpen={true}
        position={null}
        groupName="Test Group"
        slicesCount={2}
        onClose={() => {}}
        onExportPng={() => {}}
        onExportGif={() => {}}
      />
    );
    expect(html).toBe('');
  });

  it('renders group options with accessible roles when open', () => {
    const html = renderToString(
      <SymbolGroupContextMenu
        isOpen={true}
        position={{ x: 150, y: 250 }}
        groupName="Bongo Cat"
        slicesCount={4}
        onClose={() => {}}
        onExportPng={() => {}}
        onExportGif={() => {}}
      />
    );

    expect(html).toContain('Bongo Cat');
    expect(html).toContain('4 slices');
    expect(html).toContain('Export as PNG');
    expect(html).toContain('Export as GIF');
    expect(html).toContain('role="menu"');
    expect(html).toContain('role="menuitem"');
  });

  it('formats single slice count correctly', () => {
    const html = renderToString(
      <SymbolGroupContextMenu
        isOpen={true}
        position={{ x: 150, y: 250 }}
        groupName="Single Icon"
        slicesCount={1}
        onClose={() => {}}
        onExportPng={() => {}}
        onExportGif={() => {}}
      />
    );

    expect(html).toContain('Single Icon');
    expect(html).toContain('1 slice');
  });
});

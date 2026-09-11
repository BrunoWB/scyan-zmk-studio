import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { LogoContextMenu } from '../LogoContextMenu';

describe('LogoContextMenu', () => {
  it('renders null when isOpen is false', () => {
    const html = renderToString(
      <LogoContextMenu
        isOpen={false}
        position={{ x: 100, y: 100 }}
        onClose={() => {}}
        onOpenChangelog={() => {}}
      />
    );
    expect(html).toBe('');
  });

  it('renders null when position is null', () => {
    const html = renderToString(
      <LogoContextMenu
        isOpen={true}
        position={null}
        onClose={() => {}}
        onOpenChangelog={() => {}}
      />
    );
    expect(html).toBe('');
  });

  it('renders menu options when open with valid position', () => {
    const html = renderToString(
      <LogoContextMenu
        isOpen={true}
        position={{ x: 120, y: 240 }}
        onClose={() => {}}
        onOpenChangelog={() => {}}
      />
    );

    expect(html).toContain('Go to git repository');
    expect(html).toContain('See change log');
    expect(html).toContain('Support on Ko-fi');
    expect(html).toContain('Scyan Studio');
    expect(html).toContain('role="menu"');
    expect(html).toContain('role="menuitem"');
  });
});

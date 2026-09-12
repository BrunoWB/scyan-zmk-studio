import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { TopologySandboxTab } from '../TopologySandboxTab';
import { BwpxGrid } from '../../bwpx/core/BwpxGrid';
import { getShieldParts, KNOWN_SHIELDS } from '../../data/shieldsData';

describe('TopologySandboxTab', () => {
  const dummyGrid = new BwpxGrid(32, 128);

  it('derives all modular shield parts directly from the unique KNOWN_SHIELDS catalogue', () => {
    const parts = getShieldParts();

    // Verify all parts come directly from KNOWN_SHIELDS
    expect(parts.length).toBeGreaterThanOrEqual(16);

    // Verify Corne generates both Left and Right halves
    const corneLeft = parts.find((p) => p.id === 'corne_left');
    const corneRight = parts.find((p) => p.id === 'corne_right');
    expect(corneLeft).toBeDefined();
    expect(corneLeft?.side).toBe('left');
    expect(corneLeft?.keyCount).toBe(21);
    expect(corneRight).toBeDefined();
    expect(corneRight?.side).toBe('right');

    // Verify Lily58 generates both halves
    expect(parts.find((p) => p.id === 'lily58_left')).toBeDefined();
    expect(parts.find((p) => p.id === 'lily58_right')).toBeDefined();

    // Verify Xiao Dongle generates dongle
    const xiao = parts.find((p) => p.id === 'xiao-dongle');
    expect(xiao).toBeDefined();
    expect(xiao?.side).toBe('dongle');
    expect(xiao?.keyCount).toBe(0);

    // Verify TIDBIT numpad generates single piece
    const tidbit = parts.find((p) => p.id === 'tidbit');
    expect(tidbit).toBeDefined();
    expect(tidbit?.keyCount).toBe(19);

    // Verify Reviung41 unibody generates single piece
    const reviung41 = parts.find((p) => p.id === 'reviung41');
    expect(reviung41).toBeDefined();
    expect(reviung41?.keyCount).toBe(41);

    // Ensure no disconnected IDs exist (all link to an existing KNOWN_SHIELD)
    for (const part of parts) {
      expect(KNOWN_SHIELDS.some((s) => s.id === part.shieldId)).toBe(true);
    }
  });

  it('renders initial topology with placed split parts and palette', () => {
    const html = renderToString(
      <TopologySandboxTab
        symbolsGrid={dummyGrid}
        symbolSlices={[]}
        fontGrid={dummyGrid}
      />
    );

    // Right palette headers and parts
    expect(html).toContain('Shield Parts Palette');
    expect(html).toContain('Split Halves');
    expect(html).toContain('Single / Dongle');

    // Left canvas controls & presets
    expect(html).toContain('Presets:');
    expect(html).toContain('Corne Split (L+R)');
    expect(html).toContain('Dongle Master + Split');
    expect(html).toContain('Split + Numpad');
    expect(html).toContain('Unibody + Numpad');

    // Initial placed Corne Left & Right
    expect(html).toContain('Corne (CRKBD) (Left Half)');
    expect(html).toContain('Corne (CRKBD) (Right Half)');
    expect(html).toContain('Left Half');
    expect(html).toContain('Right Half');

    // Live OLED canvas present
    expect(html).toContain('corne-oled-canvas');
  });

  it('renders drop targets for expanding the grid in all 4 directions', () => {
    const html = renderToString(
      <TopologySandboxTab
        symbolsGrid={dummyGrid}
        symbolSlices={[]}
        fontGrid={dummyGrid}
      />
    );

    // Neighbor drop slots should be rendered
    expect(html).toContain('Drop Shield Part');
    expect(html).toContain('Position (');
  });

  it('renders visual shield previews in the parts palette list and naked shield drag containers', () => {
    const html = renderToString(
      <TopologySandboxTab
        symbolsGrid={dummyGrid}
        symbolSlices={[]}
        fontGrid={dummyGrid}
      />
    );

    // Compact previews rendered in the palette list
    expect(html).toContain('shield-half-case');
    expect(html).toContain('compact');

    // Floating grip indicator present on hover for placed shields
    expect(html).toContain('opacity-0 group-hover:opacity-100');
  });

  it('reflects exact layout displays from enabledScreens and renders empty OLED bay when no display is assigned', () => {
    // Single display configured in Layout tab: only 'left'
    const htmlSingle = renderToString(
      <TopologySandboxTab
        symbolsGrid={dummyGrid}
        symbolSlices={[]}
        fontGrid={dummyGrid}
        enabledScreens={['left']}
      />
    );

    // Master screen is mounted on the left half
    expect(htmlSingle).toContain('Master Display');
    // Right half should render the empty OLED socket bay
    expect(htmlSingle).toContain('Empty OLED');
    expect(htmlSingle).toContain('Drag an OLED display here to mount it on this shield');

    // Extra display configured in Layout tab: 'left', 'right', 'dongle'
    const htmlExtra = renderToString(
      <TopologySandboxTab
        symbolsGrid={dummyGrid}
        symbolSlices={[]}
        fontGrid={dummyGrid}
        enabledScreens={['left', 'right', 'dongle']}
      />
    );

    // Unassigned shelf should display the dongle screen ready to drag
    expect(htmlExtra).toContain('Unassigned:');
    expect(htmlExtra).toContain('Dongle Display');
    expect(htmlExtra).toContain('Drag this layout display onto any shield to mount it');
  });

  it('renders master shield indicators and display drag grips', () => {
    const html = renderToString(
      <TopologySandboxTab
        symbolsGrid={dummyGrid}
        symbolSlices={[]}
        fontGrid={dummyGrid}
        enabledScreens={['left', 'right']}
      />
    );

    // Master Shield banner and badge
    expect(html).toContain('Master Shield');
    expect(html).toContain('Master Display');
    expect(html).toContain('Set Master');

    // Draggable OLED display indicator
    expect(html).toContain('Drag to swap or move to another shield');
    expect(html).toContain('Drag Display');
  });
});

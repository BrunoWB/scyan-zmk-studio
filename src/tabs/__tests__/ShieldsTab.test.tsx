import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { ShieldsTab } from '../ShieldsTab';
import { BwpxGrid } from '../../bwpx/core/BwpxGrid';
import { KNOWN_SHIELDS } from '../../data/shieldsData';

describe('ShieldsTab', () => {
  const dummyGrid = new BwpxGrid(32, 128);

  it('renders known split shield pairs', () => {
    const html = renderToString(
      <ShieldsTab
        symbolsGrid={dummyGrid}
        symbolSlices={[]}
        fontGrid={dummyGrid}
      />
    );

    // Split shield pairs
    expect(html).toContain('Corne (CRKBD)');
    expect(html).toContain('Lily58');
    expect(html).toContain('Sofle (v1 / v2 / RGB)');
    expect(html).toContain('Ferris Sweep');
    expect(html).toContain('Kyria');
    expect(html).toContain('Iris (Keebio Iris)');
  });

  it('renders known single-piece and dongle shields', () => {
    const html = renderToString(
      <ShieldsTab
        symbolsGrid={dummyGrid}
        symbolSlices={[]}
        fontGrid={dummyGrid}
      />
    );

    // Single-piece and dongles
    expect(html).toContain('Reviung41');
    expect(html).toContain('Reviung34');
    expect(html).toContain('Seeed XIAO BLE Dongle');
    expect(html).toContain('TIDBIT 19-key');
  });

  it('renders live OLED display module cleanly without clutter for split pairs and dongles', () => {
    const html = renderToString(
      <ShieldsTab
        symbolsGrid={dummyGrid}
        symbolSlices={[]}
        fontGrid={dummyGrid}
      />
    );

    expect(html).toContain('oled-glass-housing');
    expect(html).toContain('corne-oled-canvas');
    expect(html).not.toContain('case-screw');
    expect(html).not.toContain('Left Half (Master)');
    expect(html).not.toContain('Right Half (Peripheral)');
  });

  it('displays hardware pinouts and ZMK build targets for the selected shield', () => {
    const html = renderToString(
      <ShieldsTab
        symbolsGrid={dummyGrid}
        symbolSlices={[]}
        fontGrid={dummyGrid}
      />
    );

    expect(html).toContain('Hardware Pinout (I2C Bus)');
    expect(html).toContain('SDA');
    expect(html).toContain('SCL');
    expect(html).toContain('VCC');
    expect(html).toContain('GND');
    expect(html).toContain('west build -b nice_nano_v2');
    expect(html).toContain('-DSHIELD=corne_left -DSHIELD=corne_right');
  });

  it('renders horizontal split layout with preview stage on left and layouts list on right', () => {
    const html = renderToString(
      <ShieldsTab
        symbolsGrid={dummyGrid}
        symbolSlices={[]}
        fontGrid={dummyGrid}
      />
    );

    expect(html).toContain('Layouts');
    expect(html).toContain('Apply Setup &amp; Preview');
    expect(html).toContain('Physical Keyboard Geometry &amp; OLED Mount Sandbox');
  });

  it('has valid definitions in KNOWN_SHIELDS dataset', () => {
    expect(KNOWN_SHIELDS.length).toBeGreaterThanOrEqual(10);
    const splitPairs = KNOWN_SHIELDS.filter((s) => s.category === 'split-pair');
    const singlePieces = KNOWN_SHIELDS.filter((s) => s.category === 'single-piece');

    expect(splitPairs.length).toBe(6);
    expect(singlePieces.length).toBe(4);

    for (const shield of KNOWN_SHIELDS) {
      expect(shield.id).toBeTruthy();
      expect(shield.name).toBeTruthy();
      expect(shield.displayConfig.nativeResolution.width).toBeGreaterThan(0);
      expect(shield.displayConfig.nativeResolution.height).toBeGreaterThan(0);
      expect(shield.displayConfig.bus).toBe('I2C');
      expect(shield.zmkTarget).toContain('-DSHIELD=');
      expect(shield.displayConfig.pinout.sda).toBeTruthy();
      expect(shield.displayConfig.pinout.scl).toBeTruthy();
    }
  });

  it('renders blank keycaps in the keyboard geometry sandbox without matrix wires or switch labels', () => {
    const html = renderToString(
      <ShieldsTab
        symbolsGrid={dummyGrid}
        symbolSlices={[]}
        fontGrid={dummyGrid}
      />
    );

    // Sandbox header and blank keycaps
    expect(html).toContain('Physical Keyboard Geometry &amp; OLED Mount Sandbox');
    expect(html).toContain('Blank Keycaps Geometry:');
    expect(html).toContain('data-keycap="blank"');
    expect(html).toContain('shield-blank-keycap');
    expect(html).toContain('shield-blank-thumb');
    // Corne snap-off toggle
    expect(html).toContain('6-Col (42k)');
    expect(html).toContain('5-Col Snap-off (36k)');
  });

  it('validates layoutGeometry on all 10 shields in KNOWN_SHIELDS catalog', () => {
    for (const shield of KNOWN_SHIELDS) {
      expect(shield.layoutGeometry).toBeDefined();
      expect(shield.layoutGeometry.type).toMatch(/^(split-pair|unibody|dongle|numpad)$/);
      expect(shield.layoutGeometry.oledMount).toBeTruthy();
      expect(shield.layoutGeometry.oledLabel).toBeTruthy();
      expect(shield.layoutGeometry.description).toBeTruthy();

      if (shield.layoutGeometry.type === 'split-pair') {
        expect(shield.layoutGeometry.columns).toBeGreaterThanOrEqual(5);
        expect(shield.layoutGeometry.rows).toBeGreaterThanOrEqual(3);
        expect(shield.layoutGeometry.columnStaggers.length).toBe(shield.layoutGeometry.columns);
        expect(shield.layoutGeometry.thumbCount).toBeGreaterThanOrEqual(2);
      } else if (shield.layoutGeometry.type === 'unibody') {
        expect(shield.layoutGeometry.columns).toBeGreaterThanOrEqual(5);
        expect(shield.layoutGeometry.rows).toBe(3);
        expect(shield.layoutGeometry.thumbCount).toBeGreaterThanOrEqual(4);
      } else if (shield.layoutGeometry.type === 'dongle') {
        expect(shield.layoutGeometry.columns).toBe(0);
        expect(shield.layoutGeometry.rows).toBe(0);
      } else if (shield.layoutGeometry.type === 'numpad') {
        expect(shield.layoutGeometry.columns).toBe(4);
        expect(shield.layoutGeometry.rows).toBe(5);
        expect(shield.layoutGeometry.hasEncoder).toBe(true);
      }
    }
  });

  it('renders gracefully even when blocks, glyphs, and mappings are empty arrays', () => {
    const html = renderToString(
      <ShieldsTab
        symbolsGrid={dummyGrid}
        symbolSlices={[]}
        fontGrid={dummyGrid}
        fontGlyphs={[]}
        fontMappings={[]}
        leftBlocks={[]}
        rightBlocks={[]}
        dongleBlocks={[]}
        idleLeftBlocks={[]}
        idleRightBlocks={[]}
        idleDongleBlocks={[]}
      />
    );

    // Verifies rendering succeeds with fallback defaults
    expect(html).toContain('oled-glass-housing');
    expect(html).toContain('corne-oled-canvas');
    expect(html).not.toContain('case-screw');
  });
});

import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { ShieldKeyboardGeometry } from '../ShieldKeyboardGeometry';
import { KNOWN_SHIELDS } from '../../data/shieldsData';
import { BwpxGrid } from '../../bwpx/core/BwpxGrid';

describe('ShieldKeyboardGeometry', () => {
  const dummyGrid = new BwpxGrid(32, 128);

  const corneShield = KNOWN_SHIELDS.find((s) => s.id === 'corne')!;
  const lily58Shield = KNOWN_SHIELDS.find((s) => s.id === 'lily58')!;
  const sofleShield = KNOWN_SHIELDS.find((s) => s.id === 'sofle')!;
  const sweepShield = KNOWN_SHIELDS.find((s) => s.id === 'ferris-sweep')!;
  const kyriaShield = KNOWN_SHIELDS.find((s) => s.id === 'kyria')!;
  const reviung41Shield = KNOWN_SHIELDS.find((s) => s.id === 'reviung41')!;
  const reviung34Shield = KNOWN_SHIELDS.find((s) => s.id === 'reviung34')!;
  const xiaoDongleShield = KNOWN_SHIELDS.find((s) => s.id === 'xiao-dongle')!;
  const tidbitShield = KNOWN_SHIELDS.find((s) => s.id === 'tidbit')!;
  const irisShield = KNOWN_SHIELDS.find((s) => s.id === 'iris')!;

  it('renders Corne split pair with blank keys and inner vertical OLED bay', () => {
    const html = renderToString(
      <ShieldKeyboardGeometry
        shield={corneShield}
        symbolsGrid={dummyGrid}
        symbolSlices={[]}
        fontGrid={dummyGrid}
        activeLeftBlocks={[]}
        activeRightBlocks={[]}
        activeDongleBlocks={[]}
        corneColumns={6}
      />
    );

    expect(html).toContain('shield-half-case left-half');
    expect(html).toContain('shield-half-case right-half');
    expect(html).toContain('data-keycap="blank"');
    expect(html).toContain('role="button"');
    expect(html).toContain('tabindex="0"');
    expect(html).toContain('shield-blank-thumb');
    expect(html).toContain('Left Half (Master)');
    expect(html).toContain('Right Half (Peripheral)');
    expect(html).toContain('shield-snapoff-label');
  });

  it('renders Corne in 5-column snap-off mode', () => {
    const html = renderToString(
      <ShieldKeyboardGeometry
        shield={corneShield}
        symbolsGrid={dummyGrid}
        symbolSlices={[]}
        fontGrid={dummyGrid}
        activeLeftBlocks={[]}
        activeRightBlocks={[]}
        activeDongleBlocks={[]}
        corneColumns={5}
      />
    );

    expect(html).toContain('5x3+3');
    expect(html).not.toContain('shield-snapoff-label');
  });

  it('renders Lily58 with top-inner horizontal OLED bay and 4-row matrix', () => {
    const html = renderToString(
      <ShieldKeyboardGeometry
        shield={lily58Shield}
        symbolsGrid={dummyGrid}
        symbolSlices={[]}
        fontGrid={dummyGrid}
        activeLeftBlocks={[]}
        activeRightBlocks={[]}
        activeDongleBlocks={[]}
      />
    );

    expect(html).toContain('Top-Inner');
    expect(html).toContain('shield-half-case left-half');
    expect(html).toContain('shield-blank-keycap');
  });

  it('renders Iris (Keebio) with top-inner horizontal OLED and 4-row matrix', () => {
    const html = renderToString(
      <ShieldKeyboardGeometry
        shield={irisShield}
        symbolsGrid={dummyGrid}
        symbolSlices={[]}
        fontGrid={dummyGrid}
        activeLeftBlocks={[]}
        activeRightBlocks={[]}
        activeDongleBlocks={[]}
      />
    );

    expect(html).toContain('Top-Inner');
    expect(html).toContain('shield-half-case left-half');
    expect(html).toContain('shield-blank-keycap');
    expect(html).toContain('shield-blank-thumb');
  });

  it('renders Sofle with EC11 rotary encoders and top-inner OLED module', () => {
    const html = renderToString(
      <ShieldKeyboardGeometry
        shield={sofleShield}
        symbolsGrid={dummyGrid}
        symbolSlices={[]}
        fontGrid={dummyGrid}
        activeLeftBlocks={[]}
        activeRightBlocks={[]}
        activeDongleBlocks={[]}
      />
    );

    expect(html).toContain('data-encoder="rotary"');
    expect(html).toContain('shield-encoder-knob');
    expect(html).toContain('encoder-indicator-notch');
  });

  it('renders Ferris Sweep ultra-compact 34-key layout', () => {
    const html = renderToString(
      <ShieldKeyboardGeometry
        shield={sweepShield}
        symbolsGrid={dummyGrid}
        symbolSlices={[]}
        fontGrid={dummyGrid}
        activeLeftBlocks={[]}
        activeRightBlocks={[]}
        activeDongleBlocks={[]}
      />
    );

    expect(html).toContain('5x3+2');
    expect(html).toContain('shield-half-case');
  });

  it('renders Kyria with aggressive stagger and fanning thumb cluster', () => {
    const html = renderToString(
      <ShieldKeyboardGeometry
        shield={kyriaShield}
        symbolsGrid={dummyGrid}
        symbolSlices={[]}
        fontGrid={dummyGrid}
        activeLeftBlocks={[]}
        activeRightBlocks={[]}
        activeDongleBlocks={[]}
      />
    );

    expect(html).toContain('Inner High-Res 128x64 Bay');
    expect(html).toContain('shield-blank-thumb');
  });

  it('renders Reviung41 angled unibody with central OLED diamond and 2.25u center spacebar', () => {
    const html = renderToString(
      <ShieldKeyboardGeometry
        shield={reviung41Shield}
        symbolsGrid={dummyGrid}
        symbolSlices={[]}
        fontGrid={dummyGrid}
        activeLeftBlocks={[]}
        activeRightBlocks={[]}
        activeDongleBlocks={[]}
      />
    );

    expect(html).toContain('shield-unibody-case');
    expect(html).toContain('Center Unibody Display');
    expect(html).toContain('Reviung41');
    expect(html).toContain('shield-blank-thumb');
  });

  it('renders Reviung34 compact unibody with top-center bridge OLED bay', () => {
    const html = renderToString(
      <ShieldKeyboardGeometry
        shield={reviung34Shield}
        symbolsGrid={dummyGrid}
        symbolSlices={[]}
        fontGrid={dummyGrid}
        activeLeftBlocks={[]}
        activeRightBlocks={[]}
        activeDongleBlocks={[]}
      />
    );

    expect(html).toContain('shield-unibody-case');
    expect(html).toContain('Top Center Bridge Display');
    expect(html).toContain('Reviung34');
  });

  it('renders Seeed XIAO Dongle with USB-A plug and central OLED module', () => {
    const html = renderToString(
      <ShieldKeyboardGeometry
        shield={xiaoDongleShield}
        symbolsGrid={dummyGrid}
        symbolSlices={[]}
        fontGrid={dummyGrid}
        activeLeftBlocks={[]}
        activeRightBlocks={[]}
        activeDongleBlocks={[]}
      />
    );

    expect(html).toContain('dongle-unit-case');
    expect(html).toContain('dongle-usb-connector');
    expect(html).toContain('dongle-usb-metal');
    expect(html).toContain('dongle-usb-pin');
    expect(html).toContain('Central Dongle Master');
    expect(html).toContain('Host Receiver Node (0 keys)');
  });

  it('renders TIDBIT 19-key numpad with top OLED, rotary encoder knob, and 2u key', () => {
    const html = renderToString(
      <ShieldKeyboardGeometry
        shield={tidbitShield}
        symbolsGrid={dummyGrid}
        symbolSlices={[]}
        fontGrid={dummyGrid}
        activeLeftBlocks={[]}
        activeRightBlocks={[]}
        activeDongleBlocks={[]}
      />
    );

    expect(html).toContain('shield-numpad-case');
    expect(html).toContain('TIDBIT Macropad (19-key)');
    expect(html).toContain('TIDBIT Numpad Display');
    expect(html).toContain('data-encoder="rotary"');
    expect(html).toContain('shield-encoder-knob');
  });

  it('renders cleanly in compact mode for card previews', () => {
    const html = renderToString(
      <ShieldKeyboardGeometry
        shield={corneShield}
        symbolsGrid={dummyGrid}
        symbolSlices={[]}
        fontGrid={dummyGrid}
        activeLeftBlocks={[]}
        activeRightBlocks={[]}
        activeDongleBlocks={[]}
        compact={true}
      />
    );

    expect(html).toContain('shield-sandbox-container compact');
    expect(html).toContain('shield-split-wrapper compact');
    expect(html).toContain('shield-half-case left-half compact');
    expect(html).toContain('shield-blank-keycap compact');
    expect(html).not.toContain('case-screw');
  });
});

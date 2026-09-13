import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { OledDisplayModule, getCalculatedDisplayDim } from '../OledDisplayModule';
import { BwpxGrid } from '../../bwpx/core/BwpxGrid';

describe('OledDisplayModule', () => {
  const dummyGrid = new BwpxGrid(32, 128);

  it('calculates portrait display dimensions anchoring to height 192px', () => {
    const dim = getCalculatedDisplayDim(32, 128, 1);
    expect(dim.displayH).toBe(192);
    expect(dim.displayW).toBe(48);
  });

  it('calculates landscape display dimensions anchoring to width 180px', () => {
    const dim = getCalculatedDisplayDim(128, 32, 1);
    expect(dim.displayW).toBe(180);
    expect(dim.displayH).toBe(45);
  });

  it('applies scale factor correctly', () => {
    const dim = getCalculatedDisplayDim(32, 128, 0.5);
    expect(dim.displayH).toBe(96);
    expect(dim.displayW).toBe(28); // minimum bound is 28
  });

  it('renders OLED glass housing with border padding', () => {
    const html = renderToString(
      <OledDisplayModule
        width={32}
        height={128}
        blocks={[]}
        symbolsGrid={dummyGrid}
        symbolSlices={[]}
        fontGrid={dummyGrid}
        badge="Left Half"
        showLiveDot={true}
      />
    );

    // 48 + 10 = 58px width, 192 + 10 = 202px height
    expect(html).toContain('oled-glass-housing');
    expect(html).toContain('width:58px');
    expect(html).toContain('height:202px');
    expect(html).not.toContain('Left Half');
    expect(html).not.toContain('live-dot');
    expect(html).not.toContain('32×128 px');
  });

  it('renders horizontal 128x32 screen with appropriate dimensions', () => {
    const html = renderToString(
      <OledDisplayModule
        width={128}
        height={32}
        blocks={[]}
        symbolsGrid={dummyGrid}
        symbolSlices={[]}
        fontGrid={dummyGrid}
        side="single"
        badge="Center Display"
      />
    );

    // 180 + 10 = 190px width, 45 + 10 = 55px height
    expect(html).toContain('width:190px');
    expect(html).toContain('height:55px');
    expect(html).not.toContain('Center Display');
    expect(html).not.toContain('128×32 px');
  });

  it('safely falls back to default 32x128 when given zero or negative dimensions', () => {
    const zeroDim = getCalculatedDisplayDim(0, 0, 1);
    expect(zeroDim.displayW).toBe(48);
    expect(zeroDim.displayH).toBe(192);

    const negDim = getCalculatedDisplayDim(-10, -50, 1);
    expect(negDim.displayW).toBe(48);
    expect(negDim.displayH).toBe(192);
  });
});

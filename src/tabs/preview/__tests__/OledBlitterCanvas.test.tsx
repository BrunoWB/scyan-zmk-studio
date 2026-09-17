import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { OledBlitterCanvas } from '../OledBlitterCanvas';
import type { LayoutBlock } from '../../../types/zmk';

describe('OledBlitterCanvas component', () => {
  const sampleBlocks: LayoutBlock[] = [
    {
      id: 'test-battery',
      widgetType: 'battery',
      name: 'Battery',
      x: 0,
      y: 0,
      width: 24,
      height: 12,
      enabled: true,
      side: 'left',
    },
  ];

  it('renders canvas with exact display dimensions style', () => {
    const html = renderToString(
      <OledBlitterCanvas
        blocks={sampleBlocks}
        vWidth={32}
        vHeight={128}
        displayDim={{ displayW: 48, displayH: 192 }}
        side="left"
      />
    );

    expect(html).toContain('corne-oled-canvas');
    expect(html).toContain('width:48px');
    expect(html).toContain('height:192px');
  });

  it('applies custom className and style overrides', () => {
    const html = renderToString(
      <OledBlitterCanvas
        blocks={[]}
        vWidth={128}
        vHeight={32}
        displayDim={{ displayW: 180, displayH: 45 }}
        side="central"
        className="test-custom-class"
        style={{ opacity: 0.9 }}
      />
    );

    expect(html).toContain('test-custom-class');
    expect(html).toContain('opacity:0.9');
  });

  it('is forwardRef / registerCanvas callback compatible', () => {
    let capturedElement: HTMLCanvasElement | null = null;
    const element = (
      <OledBlitterCanvas
        blocks={sampleBlocks}
        vWidth={32}
        vHeight={128}
        displayDim={{ displayW: 48, displayH: 192 }}
        side="left"
        onRegisterCanvas={(el) => {
          capturedElement = el;
        }}
      />
    );
    expect(element).toBeDefined();
    expect(element.props.onRegisterCanvas).toBeDefined();
    element.props.onRegisterCanvas?.(null);
    expect(capturedElement).toBeNull();
  });
});

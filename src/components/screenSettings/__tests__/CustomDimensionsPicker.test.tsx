import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import {
  calculateAspectRatio,
  StepperControl,
  CustomDimensionsPicker,
} from '../CustomDimensionsPicker';

describe('CustomDimensionsPicker & calculateAspectRatio', () => {
  describe('calculateAspectRatio', () => {
    it('calculates standard ZMK display aspect ratios', () => {
      expect(calculateAspectRatio(128, 32)).toBe('4:1');
      expect(calculateAspectRatio(128, 64)).toBe('2:1');
      expect(calculateAspectRatio(64, 128)).toBe('1:2');
      expect(calculateAspectRatio(160, 68)).toBe('40:17');
      expect(calculateAspectRatio(32, 128)).toBe('1:4');
    });

    it('handles edge cases gracefully', () => {
      expect(calculateAspectRatio(0, 0)).toBe('1:1');
      expect(calculateAspectRatio(-10, 20)).toBe('1:1');
      expect(calculateAspectRatio(100, 100)).toBe('1:1');
    });
  });

  describe('StepperControl', () => {
    it('renders label, initial value, and decrement/increment buttons', () => {
      const html = renderToString(
        <StepperControl
          label="W"
          value={128}
          onChange={() => {}}
          min={16}
          max={256}
        />
      );

      expect(html).toContain('W:');
      expect(html).toContain('value="128"');
      expect(html).toContain('aria-label="Decrease W"');
      expect(html).toContain('aria-label="Increase W"');
    });
  });

  describe('CustomDimensionsPicker', () => {
    it('renders both W and H stepper controls with calculated aspect ratio', () => {
      const html = renderToString(
        <CustomDimensionsPicker
          width={128}
          height={32}
          onWidthChange={() => {}}
          onHeightChange={() => {}}
          sideName="Central"
        />
      );

      expect(html).toContain('Dimensions Pair [W, H]');
      expect(html).toContain('Aspect');
      expect(html).toContain('4:1');
      expect(html).toContain('aria-label="Central Width"');
      expect(html).toContain('aria-label="Central Height"');
    });
  });
});

import { describe, it, expect, afterEach, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { MobileUnsupportedView } from '../MobileUnsupportedView';
import { useIsMobile } from '../../hooks/useIsMobile';

describe('MobileUnsupportedView', () => {
  it('renders mobile notice with title and descriptions', () => {
    const html = renderToString(<MobileUnsupportedView onDismiss={() => {}} />);

    expect(html).toContain('Desktop Required');
    expect(html).toContain('SCYAN ZMK STUDIO');
    expect(html).toContain('PHONE DETECTED');
    expect(html).toContain('ZMK 32x128 OLED SIMULATION');
    expect(html).toContain('oled-glass-housing');
    expect(html).toContain('Copy Link to Open on PC');
    expect(html).toContain('Continue to desktop interface anyway');
  });

  it('renders dismiss button when onDismiss prop is provided', () => {
    const html = renderToString(<MobileUnsupportedView onDismiss={() => {}} />);
    expect(html).toContain('Continue to desktop interface anyway');
  });

  it('omits dismiss button when onDismiss is omitted', () => {
    const html = renderToString(<MobileUnsupportedView />);
    expect(html).not.toContain('Continue to desktop interface anyway');
  });
});

describe('useIsMobile hook', () => {
  afterEach(() => {
    delete (globalThis as any).window;
  });

  it('returns false when window is undefined (SSR)', () => {
    delete (globalThis as any).window;
    let detected: boolean | null = null;
    const TestComponent = () => {
      detected = useIsMobile(768);
      return null;
    };
    renderToString(<TestComponent />);
    expect(detected).toBe(false);
  });

  it('detects mobile screen when window.innerWidth <= 768', () => {
    (globalThis as any).window = {
      innerWidth: 390,
      matchMedia: vi.fn().mockReturnValue({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };

    let detected: boolean | null = null;
    const TestComponent = () => {
      detected = useIsMobile(768);
      return null;
    };
    renderToString(<TestComponent />);
    expect(detected).toBe(true);
  });

  it('detects desktop screen when window.innerWidth > 768', () => {
    (globalThis as any).window = {
      innerWidth: 1280,
      matchMedia: vi.fn().mockReturnValue({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };

    let detected: boolean | null = null;
    const TestComponent = () => {
      detected = useIsMobile(768);
      return null;
    };
    renderToString(<TestComponent />);
    expect(detected).toBe(false);
  });
});

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { MaintenanceView } from '../MaintenanceView';
import { isMaintenanceActive, MAINTENANCE_CONFIG } from '../../config/maintenance';

describe('MaintenanceView', () => {
  it('renders maintenance notice with title, badges, and CTA links', () => {
    const html = renderToString(<MaintenanceView onDismiss={() => {}} />);

    expect(html).toContain('SCYAN ZMK STUDIO');
    expect(html).toContain('MAINTENANCE MODE');
    expect(html).toContain('Under Maintenance');
    expect(html).toContain('scyan-zmk-module');
    expect(html).toContain('Try Nightly Build');
    expect(html).toContain('View scyan-zmk-module on GitHub');
    expect(html).toContain('oled-glass-housing');
    expect(html).toContain('Continue to studio anyway (unstable mode)');
  });

  it('renders dismiss button when onDismiss prop is provided', () => {
    const html = renderToString(<MaintenanceView onDismiss={() => {}} />);
    expect(html).toContain('Continue to studio anyway (unstable mode)');
  });

  it('omits dismiss button when onDismiss is omitted', () => {
    const html = renderToString(<MaintenanceView />);
    expect(html).not.toContain('Continue to studio anyway (unstable mode)');
  });
});

describe('isMaintenanceActive logic', () => {
  beforeEach(() => {
    MAINTENANCE_CONFIG.enabled = true;

    const mockStorage: Record<string, string> = {};
    (globalThis as any).window = {
      location: {
        pathname: '/',
        search: '',
        origin: 'https://brunowb.github.io',
      },
      sessionStorage: {
        getItem: vi.fn((key: string) => mockStorage[key] || null),
        setItem: vi.fn((key: string, val: string) => {
          mockStorage[key] = val;
        }),
        removeItem: vi.fn((key: string) => {
          delete mockStorage[key];
        }),
        clear: vi.fn(() => {}),
      },
    };
  });

  afterEach(() => {
    delete (globalThis as any).window;
    MAINTENANCE_CONFIG.enabled = false;
  });

  it('returns true when maintenance is enabled on standard root', () => {
    expect(isMaintenanceActive()).toBe(true);
  });

  it('returns false when window is undefined (SSR)', () => {
    delete (globalThis as any).window;
    expect(isMaintenanceActive()).toBe(false);
  });

  it('returns false when MAINTENANCE_CONFIG.enabled is false', () => {
    MAINTENANCE_CONFIG.enabled = false;
    expect(isMaintenanceActive()).toBe(false);
  });

  it('returns false when path is on nightly build', () => {
    (globalThis as any).window.location.pathname = '/nightly/scyan-zmk-studio/';
    expect(isMaintenanceActive()).toBe(false);
  });

  it('returns false when query parameter maintenance=false is present', () => {
    (globalThis as any).window.location.search = '?maintenance=false';
    expect(isMaintenanceActive()).toBe(false);
  });

  it('returns false when query parameter bypass=true is present', () => {
    (globalThis as any).window.location.search = '?bypass=true';
    expect(isMaintenanceActive()).toBe(false);
  });

  it('returns false when dismissed in sessionStorage', () => {
    (globalThis as any).window.sessionStorage.getItem = vi.fn().mockReturnValue('true');
    expect(isMaintenanceActive()).toBe(false);
  });
});

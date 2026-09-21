import { useState, useEffect } from 'react';

const DEFAULT_MOBILE_BREAKPOINT = 768;

/**
 * Hook to detect if the current viewport is mobile/phone width.
 * Listens to matchMedia and window resize events.
 */
export function useIsMobile(breakpoint: number = DEFAULT_MOBILE_BREAKPOINT): boolean {
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth <= breakpoint;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mql = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const update = () => {
      setIsMobile(window.innerWidth <= breakpoint || mql.matches);
    };

    update();

    if (mql.addEventListener) {
      mql.addEventListener('change', update);
    } else {
      // Fallback for older browsers
      mql.addListener(update);
    }
    window.addEventListener('resize', update);

    return () => {
      if (mql.removeEventListener) {
        mql.removeEventListener('change', update);
      } else {
        mql.removeListener(update);
      }
      window.removeEventListener('resize', update);
    };
  }, [breakpoint]);

  return isMobile;
}


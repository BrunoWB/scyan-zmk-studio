/**
 * Configuration for Maintenance Mode in Scyan ZMK Studio.
 *
 * When enabled, visitors on production see a maintenance screen informing
 * them that scyan-zmk-module changes are currently in progress, with links
 * to the Nightly build and GitHub repositories, plus an optional bypass.
 */

export interface MaintenanceConfig {
  /** Master toggle for maintenance overlay on production */
  enabled: boolean;
  title: string;
  subtitle: string;
  nightlyUrl: string;
  moduleRepoUrl: string;
  studioRepoUrl: string;
}

export const MAINTENANCE_CONFIG: MaintenanceConfig = {
  enabled: true,
  title: 'Under Maintenance',
  subtitle:
    'We are actively refactoring and upgrading the underlying scyan-zmk-module firmware architecture. Production studio is temporarily in maintenance while these firmware changes are rolling out.',
  nightlyUrl: 'https://brunowb.github.io/nightly/scyan-zmk-studio/',
  moduleRepoUrl: 'https://github.com/BrunoWB/scyan-zmk-module',
  studioRepoUrl: 'https://github.com/BrunoWB/scyan-zmk-studio',
};

/**
 * Checks whether maintenance overlay should currently be displayed.
 * Returns false on nightly builds, when explicitly bypassed via URL,
 * or when dismissed for the current browser session.
 */
export function isMaintenanceActive(): boolean {
  if (!MAINTENANCE_CONFIG.enabled) {
    return false;
  }

  if (typeof window === 'undefined') {
    return false;
  }

  // Never block the nightly build
  const isNightly =
    window.location.pathname.includes('/nightly/') ||
    (typeof import.meta !== 'undefined' && Boolean(import.meta.env?.BASE_URL?.includes('/nightly/')));
  if (isNightly) {
    return false;
  }

  // Allow bypass via URL query param (?maintenance=false or ?bypass=true)
  try {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('maintenance') === 'false' || urlParams.get('bypass') === 'true') {
      return false;
    }
  } catch {
    // ignore query parsing errors
  }

  // Check if user dismissed the overlay in the current session
  try {
    if (window.sessionStorage?.getItem('scyan_maintenance_dismissed') === 'true') {
      return false;
    }
  } catch {
    // sessionStorage might be restricted in some iframe / incognito contexts
  }

  return true;
}

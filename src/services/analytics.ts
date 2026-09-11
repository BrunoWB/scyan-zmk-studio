/**
 * Google Analytics (gtag.js) safe event dispatcher.
 */

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (...args: unknown[]) => void
  }
}

/**
 * Dispatches a custom GA4 event if gtag is defined on the window.
 *
 * @param eventName Name of the event, e.g. 'export_header', 'github_push'
 * @param params Optional key-value parameters for GA4
 */
export function trackEvent(eventName: string, params?: Record<string, unknown>): void {
  if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
    window.gtag('event', eventName, params)
  }
}

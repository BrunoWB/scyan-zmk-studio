import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { trackEvent } from '../analytics'

describe('analytics service', () => {
  const originalWindow = (globalThis as unknown as { window?: unknown }).window

  beforeEach(() => {
    delete (globalThis as unknown as { window?: unknown }).window
  })

  afterEach(() => {
    ;(globalThis as unknown as { window?: unknown }).window = originalWindow
  })

  it('should safely do nothing when window is not defined', () => {
    expect(() => trackEvent('test_event', { foo: 'bar' })).not.toThrow()
  })

  it('should safely do nothing when window.gtag is not defined', () => {
    ;(globalThis as unknown as { window: unknown }).window = {}
    expect(() => trackEvent('test_event')).not.toThrow()
  })

  it('should call window.gtag when defined', () => {
    const gtagMock = vi.fn()
    ;(globalThis as unknown as { window: { gtag: typeof gtagMock } }).window = {
      gtag: gtagMock,
    }

    trackEvent('export_header', { format: 'c_header' })

    expect(gtagMock).toHaveBeenCalledTimes(1)
    expect(gtagMock).toHaveBeenCalledWith('event', 'export_header', { format: 'c_header' })
  })
})

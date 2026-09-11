import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { WOLF_BODY_PATH } from '../BrandIdentityLogo'

describe('Favicon Assets', () => {
  const rootDir = path.resolve(__dirname, '../../../../')
  const publicDir = path.join(rootDir, 'public')

  it('verifies public/favicon.svg matches header logo and brand gradient with 32x32 square canvas', () => {
    const svgPath = path.join(publicDir, 'favicon.svg')
    expect(fs.existsSync(svgPath)).toBe(true)

    const content = fs.readFileSync(svgPath, 'utf-8')
    // viewBox is exactly 32 x 32
    expect(content).toContain('viewBox="0 0 32 32"')
    // contains exact wolf body path from BrandIdentityLogo
    expect(content).toContain(WOLF_BODY_PATH)
    // contains purple and cyan brand gradient
    expect(content).toContain('#a953f6')
    expect(content).toContain('#00f0ff')
    // crisp edges for pixel art rendering
    expect(content).toContain('shape-rendering="crispEdges"')
  })

  it('verifies public/favicon-dev.svg uses orange instead of purple gradient with 32x32 square canvas', () => {
    const devSvgPath = path.join(publicDir, 'favicon-dev.svg')
    expect(fs.existsSync(devSvgPath)).toBe(true)

    const content = fs.readFileSync(devSvgPath, 'utf-8')
    // viewBox is exactly 32 x 32
    expect(content).toContain('viewBox="0 0 32 32"')
    // contains exact wolf body path from BrandIdentityLogo
    expect(content).toContain(WOLF_BODY_PATH)
    // contains orange and cyan gradient (orange #f59442 replacing purple #a953f6)
    expect(content).toContain('#f59442')
    expect(content).toContain('#00f0ff')
    expect(content).not.toContain('#a953f6')
    // crisp edges for pixel art rendering
    expect(content).toContain('shape-rendering="crispEdges"')
  })

  it('verifies all pre-rendered PNG and ICO ladder files exist in public/', () => {
    const expectedFiles = [
      'favicon.ico',
      'favicon-32x32.png',
      'favicon-16x16.png',
      'apple-touch-icon.png',
      'favicon-dev.ico',
      'favicon-dev-32x32.png',
      'favicon-dev-16x16.png',
      'apple-touch-icon-dev.png',
    ]

    for (const file of expectedFiles) {
      expect(fs.existsSync(path.join(publicDir, file)), `Missing expected favicon file: ${file}`).toBe(true)
    }
  })

  it('verifies index.html declares explicit high-res and touch icon tags', () => {
    const indexHtml = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf-8')
    expect(indexHtml).toContain('href="./favicon.svg"')
    expect(indexHtml).toContain('sizes="32x32" href="./favicon-32x32.png"')
    expect(indexHtml).toContain('sizes="16x16" href="./favicon-16x16.png"')
    expect(indexHtml).toContain('rel="apple-touch-icon" sizes="180x180" href="./apple-touch-icon.png"')
    expect(indexHtml).toContain('rel="alternate icon" href="./favicon.ico"')
  })
})

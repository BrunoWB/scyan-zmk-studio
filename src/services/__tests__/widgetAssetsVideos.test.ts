import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('widget screencasts & media assets verification', () => {
  const rootDir = process.cwd();
  const assetsDir = path.resolve(rootDir, 'docs/assets/widgets');
  const userScreencastDir = '/home/Scyan/Videos/Screencasts';

  const EXPECTED_SCREENCAST_SETS = [
    'animation-widget',
    'charge-widgets',
    'connection-widget',
    'speed-widgets',
    'typewriter-widgets',
  ];

  it('verifies all authentic screencast video (.webm, .mp4) and animated (.gif) assets exist and have non-zero size', () => {
    expect(fs.existsSync(assetsDir)).toBe(true);

    for (const name of EXPECTED_SCREENCAST_SETS) {
      const webmPath = path.join(assetsDir, `${name}.webm`);
      const mp4Path = path.join(assetsDir, `${name}.mp4`);
      const gifPath = path.join(assetsDir, `${name}.gif`);

      expect(fs.existsSync(webmPath), `Missing WebM screencast for ${name}`).toBe(true);
      expect(fs.existsSync(mp4Path), `Missing MP4 video for ${name}`).toBe(true);
      expect(fs.existsSync(gifPath), `Missing GIF animation for ${name}`).toBe(true);

      const webmStat = fs.statSync(webmPath);
      const mp4Stat = fs.statSync(mp4Path);
      const gifStat = fs.statSync(gifPath);

      expect(webmStat.size, `WebM for ${name} is empty`).toBeGreaterThan(1000);
      expect(mp4Stat.size, `MP4 for ${name} is empty`).toBeGreaterThan(1000);
      expect(gifStat.size, `GIF for ${name} is empty`).toBeGreaterThan(1000);
    }

    const staticImagesPath = path.join(assetsDir, 'static-images.png');
    expect(fs.existsSync(staticImagesPath), 'Missing static-images.png').toBe(true);
    expect(fs.statSync(staticImagesPath).size).toBeGreaterThan(1000);
  });

  it('verifies all files in docs/assets/widgets are regular files and not broken symlinks', () => {
    const files = fs.readdirSync(assetsDir);
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const filePath = path.join(assetsDir, file);
      const lstat = fs.lstatSync(filePath);
      expect(lstat.isSymbolicLink(), `Symlink found: ${file}`).toBe(false);
      expect(lstat.isFile(), `Not a regular file: ${file}`).toBe(true);
    }
  });

  it('verifies that all media links in README.md point to existing files', () => {
    const readmeContent = fs.readFileSync(path.resolve(rootDir, 'README.md'), 'utf-8');
    const assetMatches = [...readmeContent.matchAll(/(?:!\[.*?\]\((docs\/assets\/widgets\/[^)]+)\)|href="(docs\/assets\/widgets\/[^"]+)")/g)];
    expect(assetMatches.length).toBeGreaterThan(0);

    for (const match of assetMatches) {
      const relPath = match[1] || match[2];
      const absPath = path.resolve(rootDir, relPath);
      expect(fs.existsSync(absPath), `README.md references missing file: ${relPath}`).toBe(true);
    }
  });

  it('verifies that all media links in docs/WIDGET_EXAMPLES.md point to existing files', () => {
    const docsDir = path.resolve(rootDir, 'docs');
    const examplesContent = fs.readFileSync(path.resolve(docsDir, 'WIDGET_EXAMPLES.md'), 'utf-8');
    const assetMatches = [...examplesContent.matchAll(/(?:!\[.*?\]\((assets\/widgets\/[^)]+)\)|\[.*?\]\((assets\/widgets\/[^)]+)\))/g)];
    expect(assetMatches.length).toBeGreaterThan(0);

    for (const match of assetMatches) {
      const relPath = match[1] || match[2];
      const absPath = path.resolve(docsDir, relPath);
      expect(fs.existsSync(absPath), `docs/WIDGET_EXAMPLES.md references missing file: ${relPath}`).toBe(true);
    }
  });

  it('verifies byte-for-byte fidelity with source screencasts in /home/Scyan/Videos/Screencasts when present', () => {
    if (!fs.existsSync(userScreencastDir)) return;

    const sourceMapping: Record<string, string> = {
      'animation widget.webm': 'animation-widget.webm',
      'charge widgets.webm': 'charge-widgets.webm',
      'connection widget.webm': 'connection-widget.webm',
      'speed widgets.webm': 'speed-widgets.webm',
      'typewriter widgets.webm': 'typewriter-widgets.webm',
      'static images.png': 'static-images.png',
    };

    for (const [sourceName, repoName] of Object.entries(sourceMapping)) {
      const srcPath = path.join(userScreencastDir, sourceName);
      const dstPath = path.join(assetsDir, repoName);

      if (fs.existsSync(srcPath)) {
        const srcBuffer = fs.readFileSync(srcPath);
        const dstBuffer = fs.readFileSync(dstPath);
        expect(Buffer.compare(srcBuffer, dstBuffer), `Byte mismatch for ${sourceName} -> ${repoName}`).toBe(0);
      }
    }
  });
});

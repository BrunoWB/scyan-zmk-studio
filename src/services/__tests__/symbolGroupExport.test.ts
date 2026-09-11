import { describe, it, expect } from 'vitest';
import { GifReader } from 'omggif';
import { BwpxGrid } from '../../bwpx/core/BwpxGrid';
import type { SpriteSlice } from '../../types/zmk';
import {
  getGroupDefaultFilename,
  generateGroupGifBlob,
  createGroupPngCanvas,
} from '../symbolGroupExport';

describe('symbolGroupExport', () => {
  describe('getGroupDefaultFilename', () => {
    it('uses head slice name when available', () => {
      const slices: SpriteSlice[] = [
        {
          id: 'SYMBOL_BONGO_0',
          name: 'Bongo Cat!',
          groupId: 'BONGO_GROUP',
          groupOrder: 1,
          x: 0,
          y: 0,
          width: 16,
          height: 16,
        },
        {
          id: 'SYMBOL_BONGO_1',
          groupId: 'BONGO_GROUP',
          groupOrder: 2,
          x: 16,
          y: 0,
          width: 16,
          height: 16,
        },
      ];

      expect(getGroupDefaultFilename(slices)).toBe('bongo_cat');
    });

    it('falls back to cleaned id if name is missing', () => {
      const slices: SpriteSlice[] = [
        {
          id: 'SYMBOL_BATTERY_LEVEL',
          groupId: 'BATTERY',
          groupOrder: 1,
          x: 0,
          y: 0,
          width: 16,
          height: 16,
        },
      ];

      expect(getGroupDefaultFilename(slices)).toBe('battery_level');
    });

    it('falls back to groupId if slice id has no symbol prefix and no name', () => {
      const slices: SpriteSlice[] = [
        {
          id: '',
          groupId: 'custom_anim',
          groupOrder: 1,
          x: 0,
          y: 0,
          width: 16,
          height: 16,
        },
      ];

      expect(getGroupDefaultFilename(slices, 'custom_anim')).toBe('custom_anim');
    });
  });

  describe('generateGroupGifBlob', () => {
    it('generates a valid animated GIF readable by GifReader', async () => {
      const grid = new BwpxGrid(64, 32);
      // Set some pixels for frame 1
      grid.set(2, 2, 1);
      // Set some pixels for frame 2
      grid.set(18, 2, 1);
      grid.set(19, 3, 1);

      const slices: SpriteSlice[] = [
        {
          id: 'FRAME_1',
          name: 'Test Anim',
          groupId: 'TEST_ANIM',
          groupOrder: 1,
          x: 0,
          y: 0,
          width: 16,
          height: 16,
        },
        {
          id: 'FRAME_2',
          groupId: 'TEST_ANIM',
          groupOrder: 2,
          x: 16,
          y: 0,
          width: 16,
          height: 16,
        },
      ];

      const blob = generateGroupGifBlob(grid, slices, { delayMs: 150 });
      expect(blob).not.toBeNull();
      expect(blob!.type).toBe('image/gif');

      const arrayBuffer = await blob!.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      const reader = new GifReader(bytes);

      expect(reader.numFrames()).toBe(2);
      expect(reader.width).toBe(16);
      expect(reader.height).toBe(16);

      const frame0 = reader.frameInfo(0);
      const frame1 = reader.frameInfo(1);
      expect(frame0.delay).toBe(15); // 150ms -> 15 hundredths
      expect(frame1.delay).toBe(15);
    });

    it('returns null if groupSlices is empty', () => {
      const grid = new BwpxGrid(32, 32);
      expect(generateGroupGifBlob(grid, [])).toBeNull();
    });
  });

  describe('createGroupPngCanvas', () => {
    it('creates a canvas with sprite strip dimensions for multi-frame groups', () => {
      if (typeof document === 'undefined') return;

      const grid = new BwpxGrid(64, 32);
      grid.set(1, 1, 1);

      const slices: SpriteSlice[] = [
        {
          id: 'SLICE_1',
          groupId: 'GRP',
          groupOrder: 1,
          x: 0,
          y: 0,
          width: 16,
          height: 16,
        },
        {
          id: 'SLICE_2',
          groupId: 'GRP',
          groupOrder: 2,
          x: 16,
          y: 0,
          width: 20,
          height: 16,
        },
      ];

      const canvas = createGroupPngCanvas(grid, slices);
      expect(canvas).not.toBeNull();
      expect(canvas!.width).toBe(36); // 16 + 20
      expect(canvas!.height).toBe(16);
    });
  });
});

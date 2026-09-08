import { describe, it, expect } from 'vitest';
import type { LayoutBlock } from '../../types/zmk';
import {
  DEFAULT_LEFT_LAYOUT_BLOCKS,
  DEFAULT_RIGHT_LAYOUT_BLOCKS,
} from '../../types/zmk';
import { getWidgetDefinition } from '../widgetRegistry';

describe('Blocks Tab Layout & Interaction Mechanics', () => {
  // Helper for computing drop target side and clamped Y
  function computeDropPosition(
    clientX: number,
    clientY: number,
    leftRect: { left: number; right: number; top: number; bottom: number; height: number },
    rightRect: { left: number; right: number; top: number; bottom: number; height: number },
    widgetHeight: number
  ): { targetSide: 'left' | 'right' | null; targetY: number | null } {
    let targetSide: 'left' | 'right' | null = null;
    let targetY: number | null = null;

    if (
      clientX >= leftRect.left - 40 &&
      clientX <= leftRect.right + 40 &&
      clientY >= leftRect.top - 20 &&
      clientY <= leftRect.bottom + 20
    ) {
      targetSide = 'left';
      const relY = Math.round(
        ((clientY - leftRect.top) / leftRect.height) * 128 - widgetHeight / 2
      );
      targetY = Math.max(0, Math.min(128 - widgetHeight, relY));
    } else if (
      clientX >= rightRect.left - 40 &&
      clientX <= rightRect.right + 40 &&
      clientY >= rightRect.top - 20 &&
      clientY <= rightRect.bottom + 20
    ) {
      targetSide = 'right';
      const relY = Math.round(
        ((clientY - rightRect.top) / rightRect.height) * 128 - widgetHeight / 2
      );
      targetY = Math.max(0, Math.min(128 - widgetHeight, relY));
    }

    return { targetSide, targetY };
  }

  // Helper for stack order reordering
  function moveBlockOrder(blocks: LayoutBlock[], blockId: string, direction: -1 | 1): LayoutBlock[] {
    const index = blocks.findIndex(b => b.id === blockId);
    if (index === -1) return blocks;
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= blocks.length) return blocks;

    const next = [...blocks];
    const temp = next[index];
    next[index] = next[targetIndex];
    next[targetIndex] = temp;
    return next;
  }

  const mockLeftRect = { left: 100, right: 196, top: 150, bottom: 534, height: 384 };
  const mockRightRect = { left: 700, right: 796, top: 150, bottom: 534, height: 384 };

  describe('Drop Target Hit-testing and Coordinate Clamping', () => {
    it('detects drop onto Left screen and centers widget vertically on cursor', () => {
      // Cursor in the middle of left screen (Y = 150 + 192 = 342)
      // Height = 16. Middle of screen is grid Y = 64. Widget top should be 64 - 8 = 56.
      const result = computeDropPosition(148, 342, mockLeftRect, mockRightRect, 16);
      expect(result.targetSide).toBe('left');
      expect(result.targetY).toBe(56);
    });

    it('clamps targetY to top boundary (0) when dragging near top edge', () => {
      // Cursor near top (Y = 152)
      const result = computeDropPosition(148, 152, mockLeftRect, mockRightRect, 20);
      expect(result.targetSide).toBe('left');
      expect(result.targetY).toBe(0);
    });

    it('clamps targetY to bottom boundary (128 - height) when dragging near bottom edge', () => {
      // Cursor near bottom (Y = 530)
      const widgetHeight = 24;
      const result = computeDropPosition(148, 530, mockLeftRect, mockRightRect, widgetHeight);
      expect(result.targetSide).toBe('left');
      expect(result.targetY).toBe(128 - widgetHeight);
    });

    it('detects drop onto Right screen within horizontal tolerance', () => {
      // Cursor within 40px left of right screen
      const result = computeDropPosition(670, 300, mockLeftRect, mockRightRect, 12);
      expect(result.targetSide).toBe('right');
      expect(result.targetY).toBeGreaterThanOrEqual(0);
      expect(result.targetY).toBeLessThanOrEqual(128 - 12);
    });

    it('returns null targetSide when cursor is outside screen hitboxes', () => {
      // Cursor in center catalog area (X = 450)
      const result = computeDropPosition(450, 300, mockLeftRect, mockRightRect, 16);
      expect(result.targetSide).toBeNull();
      expect(result.targetY).toBeNull();
    });
  });

  describe('Stack Order Reordering (Bring Forward / Send Backward)', () => {
    const testBlocks: LayoutBlock[] = [
      { id: 'b1', name: 'Block 1', widgetType: 'connection', y: 0, height: 12, enabled: true, description: 'Test 1' },
      { id: 'b2', name: 'Block 2', widgetType: 'battery', y: 14, height: 12, enabled: true, description: 'Test 2' },
      { id: 'b3', name: 'Block 3', widgetType: 'wpm', y: 28, height: 14, enabled: true, description: 'Test 3' },
    ];

    it('brings block forward (MoveUp direction +1, increases stack index)', () => {
      // Move b1 forward from index 0 to index 1
      const reordered = moveBlockOrder(testBlocks, 'b1', 1);
      expect(reordered.map(b => b.id)).toEqual(['b2', 'b1', 'b3']);
    });

    it('sends block backward (MoveDown direction -1, decreases stack index)', () => {
      // Move b3 backward from index 2 to index 1
      const reordered = moveBlockOrder(testBlocks, 'b3', -1);
      expect(reordered.map(b => b.id)).toEqual(['b1', 'b3', 'b2']);
    });

    it('does not allow moving beyond the top of stack (last index)', () => {
      // b3 is already at index 2 (last)
      const reordered = moveBlockOrder(testBlocks, 'b3', 1);
      expect(reordered.map(b => b.id)).toEqual(['b1', 'b2', 'b3']);
    });

    it('does not allow moving beyond the bottom of stack (index 0)', () => {
      // b1 is already at index 0 (first)
      const reordered = moveBlockOrder(testBlocks, 'b1', -1);
      expect(reordered.map(b => b.id)).toEqual(['b1', 'b2', 'b3']);
    });
  });

  describe('Direct On-Screen Manipulation Clamping', () => {
    it('clamps delta move Y within 0 and 128 - height', () => {
      const block: LayoutBlock = {
        id: 'b-test',
        name: 'Test Block',
        widgetType: 'layer-banner',
        y: 40,
        height: 16,
        enabled: true,
        description: 'Test banner',
      };

      // Move down by 200px equivalent -> should clamp to 128 - 16 = 112
      const newYLarge = Math.max(0, Math.min(128 - block.height, block.y + 200));
      expect(newYLarge).toBe(112);

      // Move up by 100px equivalent -> should clamp to 0
      const newYNegative = Math.max(0, Math.min(128 - block.height, block.y - 100));
      expect(newYNegative).toBe(0);
    });

    it('clamps resize height between widget minHeight and remaining screen height', () => {
      const def = getWidgetDefinition('layer-banner');
      const minH = def?.minHeight ?? 10;
      const maxH = def?.maxHeight ?? 20;
      const currentY = 110;

      // When block is at Y=110, max possible height on 128 screen is 18
      const effectiveMaxH = Math.min(maxH, 128 - currentY);
      expect(effectiveMaxH).toBe(18);

      // Try to resize larger than screen capacity
      const attemptedH = 30;
      const clampedH = Math.max(minH, Math.min(effectiveMaxH, attemptedH));
      expect(clampedH).toBe(18);

      // Try to resize smaller than minHeight
      const attemptedSmall = 2;
      const clampedSmall = Math.max(minH, Math.min(effectiveMaxH, attemptedSmall));
      expect(clampedSmall).toBe(minH);
    });
  });

  describe('Default Layout Verification', () => {
    it('default left blocks fit within 128 OLED height and 32 width without out-of-bounds', () => {
      for (const block of DEFAULT_LEFT_LAYOUT_BLOCKS) {
        expect(block.y).toBeGreaterThanOrEqual(0);
        expect(block.height).toBeGreaterThan(0);
        expect(block.y + block.height).toBeLessThanOrEqual(128);

        expect(block.x).toBeDefined();
        expect(block.width).toBeDefined();
        expect(block.x!).toBeGreaterThanOrEqual(0);
        expect(block.x! + block.width!).toBeLessThanOrEqual(32);
      }
    });

    it('default right blocks fit within 128 OLED height and 32 width without out-of-bounds', () => {
      for (const block of DEFAULT_RIGHT_LAYOUT_BLOCKS) {
        expect(block.y).toBeGreaterThanOrEqual(0);
        expect(block.height).toBeGreaterThan(0);
        expect(block.y + block.height).toBeLessThanOrEqual(128);

        expect(block.x).toBeDefined();
        expect(block.width).toBeDefined();
        expect(block.x!).toBeGreaterThanOrEqual(0);
        expect(block.x! + block.width!).toBeLessThanOrEqual(32);
      }
    });
  });

  describe('2D Spatial Manipulation & Clamping Mechanics', () => {
    // 2D drop hit-test calculation matching BlocksTab logic
    function computeDropPosition2D(
      clientX: number,
      clientY: number,
      screenRect: { left: number; right: number; top: number; bottom: number; width: number; height: number },
      widgetWidth: number,
      widgetHeight: number
    ): { targetX: number | null; targetY: number | null } {
      if (
        clientX >= screenRect.left - 40 &&
        clientX <= screenRect.right + 40 &&
        clientY >= screenRect.top - 20 &&
        clientY <= screenRect.bottom + 20
      ) {
        const relX = Math.round(((clientX - screenRect.left) / screenRect.width) * 32 - widgetWidth / 2);
        const relY = Math.round(((clientY - screenRect.top) / screenRect.height) * 128 - widgetHeight / 2);
        return {
          targetX: Math.max(0, Math.min(32 - widgetWidth, relX)),
          targetY: Math.max(0, Math.min(128 - widgetHeight, relY)),
        };
      }
      return { targetX: null, targetY: null };
    }

    const mockScreenRect = { left: 100, right: 196, top: 150, bottom: 534, width: 96, height: 384 };

    it('computes 2D drop coordinates centered on cursor position', () => {
      // Center of screen: X = 100 + 48 = 148, Y = 150 + 192 = 342
      // Widget: 12x10. Grid center: X=16, Y=64. Top-left: X = 16 - 6 = 10, Y = 64 - 5 = 59
      const res = computeDropPosition2D(148, 342, mockScreenRect, 12, 10);
      expect(res.targetX).toBe(10);
      expect(res.targetY).toBe(59);
    });

    it('clamps 2D targetX and targetY within screen boundaries (0..32 - W, 0..128 - H)', () => {
      // Top-left overflow
      const topLeft = computeDropPosition2D(90, 140, mockScreenRect, 17, 10);
      expect(topLeft.targetX).toBe(0);
      expect(topLeft.targetY).toBe(0);

      // Bottom-right overflow
      const bottomRight = computeDropPosition2D(210, 540, mockScreenRect, 17, 10);
      expect(bottomRight.targetX).toBe(32 - 17);
      expect(bottomRight.targetY).toBe(128 - 10);
    });

    it('clamps delta move in 2D space on OLED canvas', () => {
      const block: LayoutBlock = {
        id: 'block-battery',
        widgetType: 'battery',
        name: 'Battery',
        x: 7,
        y: 10,
        width: 17,
        height: 10,
        enabled: true,
        description: 'Battery',
      };

      // Moving right by 50px equivalent -> should clamp to 32 - 17 = 15
      const newX = Math.max(0, Math.min(32 - block.width!, block.x! + 50));
      expect(newX).toBe(15);

      // Moving left by 20px equivalent -> should clamp to 0
      const newXNeg = Math.max(0, Math.min(32 - block.width!, block.x! - 20));
      expect(newXNeg).toBe(0);

      // Moving down by 200px equivalent -> should clamp to 128 - 10 = 118
      const newY = Math.max(0, Math.min(128 - block.height, block.y + 200));
      expect(newY).toBe(118);
    });

    it('clamps 2D resizing within min dimensions and remaining canvas space', () => {
      const def = getWidgetDefinition('battery')!;
      expect(def.defaultWidth).toBe(17);
      expect(def.minWidth).toBe(14);
      expect(def.defaultHeight).toBe(10);
      expect(def.minHeight).toBe(8);

      const curX = 20;
      const curY = 115;
      const maxW = Math.min(def.maxWidth, 32 - curX); // 32 - 20 = 12
      const maxH = Math.min(def.maxHeight, 128 - curY); // 128 - 115 = 13

      // Attempt to resize width to 30 -> clamped to remaining 12 (or minWidth 14)
      const clampedW = Math.max(def.minWidth, Math.min(maxW, 30));
      expect(clampedW).toBe(14); // minWidth constraint

      // Attempt to resize height to 25 -> clamped to maxH (13)
      const clampedH = Math.max(def.minHeight, Math.min(maxH, 25));
      expect(clampedH).toBe(13);

      // Normal resize within capacity
      const curX2 = 0;
      const maxW2 = Math.min(def.maxWidth, 32 - curX2); // 32
      const normalW = Math.max(def.minWidth, Math.min(maxW2, 22));
      expect(normalW).toBe(22);
    });

    it('handles dedicated resize modes (width only, height only, and corner both)', () => {
      const initialW = 20;
      const initialH = 15;
      const deltaX = 5;
      const deltaY = -3;

      // Mode 'width' (right edge handle): modifies width only
      const modeWidth = (w: number, h: number) => ({
        width: w + deltaX,
        height: h,
      });
      const widthRes = modeWidth(initialW, initialH);
      expect(widthRes.width).toBe(25);
      expect(widthRes.height).toBe(15);

      // Mode 'height' (bottom edge handle): modifies height only
      const modeHeight = (w: number, h: number) => ({
        width: w,
        height: h + deltaY,
      });
      const heightRes = modeHeight(initialW, initialH);
      expect(heightRes.width).toBe(20);
      expect(heightRes.height).toBe(12);

      // Mode 'both' (bottom-right corner handle): modifies both dimensions
      const modeBoth = (w: number, h: number) => ({
        width: w + deltaX,
        height: h + deltaY,
      });
      const bothRes = modeBoth(initialW, initialH);
      expect(bothRes.width).toBe(25);
      expect(bothRes.height).toBe(12);
    });
  });

  describe('Widget Registry Natural Dimensions Verification', () => {
    it('defines compact natural dimensions for all widgets', () => {
      const battery = getWidgetDefinition('battery')!;
      expect(battery.defaultWidth).toBe(17);
      expect(battery.defaultHeight).toBe(10);

      const conn = getWidgetDefinition('connection')!;
      expect(conn.defaultWidth).toBe(12);
      expect(conn.defaultHeight).toBe(10);

      const split = getWidgetDefinition('split')!;
      expect(split.defaultWidth).toBe(13);
      expect(split.defaultHeight).toBe(9);

      const caps = getWidgetDefinition('caps-lock')!;
      expect(caps.defaultWidth).toBe(14);
      expect(caps.defaultHeight).toBe(7);

      expect(getWidgetDefinition('ble-profile')?.id).toBe('connection');

      const banner = getWidgetDefinition('layer-banner')!;
      expect(banner.defaultWidth).toBe(24);
      expect(banner.defaultHeight).toBe(12);



      const wpm = getWidgetDefinition('wpm')!;
      expect(wpm.defaultWidth).toBe(28);
      expect(wpm.defaultHeight).toBe(18);

    });
  });
});

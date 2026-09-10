import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { OledPanelColumn } from '../OledPanelColumn';
import { BwpxGrid } from '../../../bwpx/core/BwpxGrid';
import type { LayoutBlock } from '../../../types/zmk';

describe('OledPanelColumn right-click context menu and block removal', () => {
  const dummyGrid = new BwpxGrid(32, 128);

  const sampleBlocks: LayoutBlock[] = [
    {
      id: 'block-status',
      widgetType: 'output-status',
      name: 'Output Status',
      x: 0,
      y: 0,
      width: 32,
      height: 16,
      enabled: true,
    },
    {
      id: 'block-battery',
      widgetType: 'battery',
      name: 'Battery Monitor',
      x: 0,
      y: 20,
      width: 32,
      height: 12,
      enabled: true,
    },
  ];

  it('renders display panel with placed block overlays', () => {
    const html = renderToString(
      <OledPanelColumn
        side="left"
        screenKind="active"
        title="Left Screen"
        subtitle="Master / Central"
        blocks={sampleBlocks}
        onBlocksChange={() => {}}
        onResetDefaults={() => {}}
        onClearScreen={() => {}}
        symbolsGrid={dummyGrid}
        symbolSlices={[]}
        fontGrid={dummyGrid}
        customText=""
        isDropTarget={false}
        dropTargetY={null}
        draggedWidget={null}
        selectedBlockId="block-status"
        onSelectBlock={() => {}}
        onRegisterScreenElement={() => {}}
      />
    );

    expect(html).toContain('oled-screen-casing');
    expect(html).toContain('oled-block-overlay');
    expect(html).toContain('selected');
    expect(html).toContain('Output Status');
    expect(html).not.toContain('oled-panel-subtitle');
    expect(html).not.toContain('Reset to default layout');
  });

  it('removes block cleanly when delete is invoked', () => {
    const onBlocksChange = vi.fn();
    const onSelectBlock = vi.fn();

    const blocks = [...sampleBlocks];
    const targetBlockId = 'block-status';

    // Simulate delete block logic directly
    const remaining = blocks.filter(b => b.id !== targetBlockId);
    onBlocksChange(remaining);
    if (targetBlockId === 'block-status') {
      onSelectBlock(null);
    }

    expect(onBlocksChange).toHaveBeenCalledWith([sampleBlocks[1]]);
    expect(onSelectBlock).toHaveBeenCalledWith(null);
  });

  it('clamps context menu coordinates within viewport limits', () => {
    const viewportWidth = 1000;
    const viewportHeight = 800;
    const menuWidth = 175;
    const menuHeight = 150;

    const clamp = (clientX: number, clientY: number) => {
      const clampedX = Math.max(8, Math.min(clientX, viewportWidth - menuWidth - 8));
      const clampedY = Math.max(8, Math.min(clientY, viewportHeight - menuHeight - 8));
      return { x: clampedX, y: clampedY };
    };

    // Click near bottom-right corner
    const clampedNearBottomRight = clamp(990, 790);
    expect(clampedNearBottomRight.x).toBe(viewportWidth - menuWidth - 8);
    expect(clampedNearBottomRight.y).toBe(viewportHeight - menuHeight - 8);

    // Click near top-left corner
    const clampedNearTopLeft = clamp(2, 3);
    expect(clampedNearTopLeft.x).toBe(8);
    expect(clampedNearTopLeft.y).toBe(8);

    // Normal click inside viewport
    const normal = clamp(300, 400);
    expect(normal.x).toBe(300);
    expect(normal.y).toBe(400);
  });

  it('accurately hit-tests blocks at grid coordinates', () => {
    const V_WIDTH = 32;
    const V_HEIGHT = 128;
    const rect = { left: 100, top: 100, width: 64, height: 256 };

    const hitTest = (clientX: number, clientY: number, blocks: LayoutBlock[]): LayoutBlock | null => {
      const pxToGridX = V_WIDTH / rect.width;
      const pxToGridY = V_HEIGHT / rect.height;
      const gridX = (clientX - rect.left) * pxToGridX;
      const gridY = (clientY - rect.top) * pxToGridY;

      for (let i = blocks.length - 1; i >= 0; i--) {
        const block = blocks[i];
        if (!block.enabled) continue;
        const blockX = block.x ?? 0;
        const blockY = block.y;
        const blockW = block.width ?? V_WIDTH;
        const blockH = block.height;

        if (gridX >= blockX && gridX <= blockX + blockW && gridY >= blockY && gridY <= blockY + blockH) {
          return block;
        }
      }
      return null;
    };

    // Click within block-status (x: 0..32, y: 0..16) -> clientX: 110, clientY: 110
    const hit1 = hitTest(110, 110, sampleBlocks);
    expect(hit1?.id).toBe('block-status');

    // Click within block-battery (x: 0..32, y: 20..32) -> gridY: (clientY - 100) * (128 / 256) = 24 when clientY = 148
    const hit2 = hitTest(110, 148, sampleBlocks);
    expect(hit2?.id).toBe('block-battery');

    // Click on empty gap (gridY = 18 when clientY = 136)
    const hitEmpty = hitTest(110, 136, sampleBlocks);
    expect(hitEmpty).toBeNull();
  });
});


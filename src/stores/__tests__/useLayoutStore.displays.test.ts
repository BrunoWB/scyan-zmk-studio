import { describe, it, expect, beforeEach } from 'vitest';
import { useLayoutStore } from '../useLayoutStore';
import type { LayoutBlock, HeaderMetadata } from '../../types/zmk';

describe('useLayoutStore Displays & Decoupled Architecture', () => {
  beforeEach(() => {
    useLayoutStore.getState().resetLayoutDefaults();
  });

  it('maintains bidirectional synchronization between central/peripheral blocks and displays', () => {
    const store = useLayoutStore.getState();

    const newCentralBlock: LayoutBlock = {
      id: 'custom-central-block',
      widgetType: 'layer',
      name: 'Custom Layer',
      x: 0,
      y: 10,
      width: 32,
      height: 10,
      enabled: true,
      side: 'central',
    };

    store.setCentralBlocks([newCentralBlock]);

    const updatedState = useLayoutStore.getState();
    expect(updatedState.centralBlocks).toHaveLength(1);
    expect(updatedState.centralBlocks[0].id).toBe('custom-central-block');

    // displays['display-1'] must also be synchronized!
    expect(updatedState.displays['display-1']).toBeDefined();
    expect(updatedState.displays['display-1'].blocks).toHaveLength(1);
    expect(updatedState.displays['display-1'].blocks[0].id).toBe('custom-central-block');

    // getScreenData with 'display-1' must return the updated block
    const screen1Data = updatedState.getScreenData('display-1');
    expect(screen1Data.blocks).toHaveLength(1);
    expect(screen1Data.blocks[0].id).toBe('custom-central-block');

    // getScreenData with legacy 'central' must return the same block
    const centralData = updatedState.getScreenData('central');
    expect(centralData.blocks).toHaveLength(1);
    expect(centralData.blocks[0].id).toBe('custom-central-block');
  });

  it('updates displays correctly via updateDisplay and reflects in legacy fields', () => {
    const store = useLayoutStore.getState();

    const block: LayoutBlock = {
      id: 'peripheral-test-block',
      widgetType: 'battery',
      name: 'Peripheral Battery',
      x: 0,
      y: 5,
      width: 32,
      height: 10,
      enabled: true,
      side: 'peripheral',
    };

    store.updateDisplay('display-2', {
      blocks: [block],
      idleTimeoutSec: 12,
    });

    const state = useLayoutStore.getState();
    expect(state.displays['display-2'].blocks).toHaveLength(1);
    expect(state.displays['display-2'].idleTimeoutSec).toBe(12);
    expect(state.peripheralBlocks).toHaveLength(1);
    expect(state.peripheralIdleTimeoutSec).toBe(12);

    const pData = state.getScreenData('display-2');
    expect(pData.blocks).toHaveLength(1);
    expect(pData.idleTimeoutSec).toBe(12);
  });

  it('supports adding, activating, and removing display screens', () => {
    const store = useLayoutStore.getState();

    const initialDisplayCount = Object.keys(store.displays).length;
    const newDisplayId = store.addDisplay({
      name: 'Secondary Peripheral',
      idleTimeoutSec: 45,
    });

    expect(newDisplayId).toBe('display-3');
    let state = useLayoutStore.getState();
    expect(Object.keys(state.displays).length).toBe(initialDisplayCount + 1);
    expect(state.activeDisplayId).toBe('display-3');
    expect(state.displays['display-3'].name).toBe('Secondary Peripheral');

    // Switch active display
    store.setActiveDisplayId('display-1');
    expect(useLayoutStore.getState().activeDisplayId).toBe('display-1');

    // Remove display
    store.removeDisplay('display-3');
    state = useLayoutStore.getState();
    expect(state.displays['display-3']).toBeUndefined();
    expect(Object.keys(state.displays).length).toBe(initialDisplayCount);
  });

  it('applies v2 metadata and populates loadedShields and displays', () => {
    const store = useLayoutStore.getState();

    const v2Meta: HeaderMetadata = {
      version: 2,
      shieldId: 'corne',
      shields: [
        { id: 'corne_left', shieldId: 'corne', name: 'Corne Left (Central)', side: 'left', isMaster: true },
        { id: 'corne_right', shieldId: 'corne', name: 'Corne Right (Peripheral)', side: 'right', isMaster: false },
      ],
      displayAssignments: {
        corne_left: 'display-1',
        corne_right: 'display-2',
      },
      displays: {
        'display-1': {
          id: 'display-1',
          name: 'Display 1 Left',
          dimensions: { width: 32, height: 128 },
          rotation: 90,
          blocks: [{ id: 'b-v2-left', widgetType: 'layer', name: 'Layer', y: 0, height: 14, enabled: true }],
          idleBlocks: [],
          idleTimeoutSec: 25,
          screenOffTimeoutSec: 50,
          idleScreensEnabled: true,
        },
        'display-2': {
          id: 'display-2',
          name: 'Display 2 Right',
          dimensions: { width: 32, height: 128 },
          rotation: 90,
          blocks: [{ id: 'b-v2-right', widgetType: 'battery', name: 'Battery', y: 10, height: 10, enabled: true }],
          idleBlocks: [],
          idleTimeoutSec: 25,
          screenOffTimeoutSec: 50,
          idleScreensEnabled: true,
        },
      },
    };

    store.applyLayoutMetadata(v2Meta);

    const state = useLayoutStore.getState();
    expect(state.loadedShields).toHaveLength(2);
    expect(state.loadedShields[0].id).toBe('corne_left');
    expect(state.loadedShields[1].id).toBe('corne_right');
    expect(state.displayAssignments['corne_left']).toBe('display-1');
    expect(state.displayAssignments['corne_right']).toBe('display-2');
    expect(state.displays['display-1'].blocks[0].id).toBe('b-v2-left');
    expect(state.displays['display-2'].blocks[0].id).toBe('b-v2-right');
    expect(state.centralBlocks[0].id).toBe('b-v2-left');
    expect(state.peripheralBlocks[0].id).toBe('b-v2-right');
  });
});

import { create } from 'zustand';
import type { LayoutBlock, SpriteSlice } from '../types/zmk';
import type { WidgetInstanceMap, WidgetInstance } from '../types/widget';
import {
  WIDGET_REGISTRY,
  normalizeWidgetType,
  getDefaultWidgetConfig,
  createDefaultWidgetInstance,
} from '../services/widgetRegistry';
import {
  DEFAULT_CENTRAL_LAYOUT_BLOCKS,
  DEFAULT_PERIPHERAL_LAYOUT_BLOCKS,
  DEFAULT_IDLE_CENTRAL_BLOCKS,
  DEFAULT_IDLE_PERIPHERAL_BLOCKS,
  type DisplayScreen,
  createDefaultDisplayScreen,
} from '../types/zmk';
import {
  getDefaultAssets,
  type HeaderMetadata,
  type PeripheralScreenData,
} from '../services/cHeaderParser';
import {
  type ParsedKeymapLayout,
  DEFAULT_EMPTY_5X3_LAYOUT,
  getShieldDefaultResolution,
  getShieldDefaultRotation,
} from '../services/keymapService';
import {
  type LoadedShieldUnit,
  getShieldUnitsForShield,
} from '../data/shieldsData';
import { remapBlockCoordinates } from '../services/blocksLayout';
import { useUiStore } from './useUiStore';

export const populateDefaultWidgetInstances = (
  savedInstances: WidgetInstanceMap = {},
  clearedTemplates: string[] = [],
  symbolSlices: SpriteSlice[] = []
): WidgetInstanceMap => {
  const defaults: WidgetInstanceMap = { ...savedInstances };
  const clearedSet = new Set<string>(clearedTemplates);

  if (savedInstances['loop'] && !defaults['animation']) {
    defaults['animation'] = savedInstances['loop'].map((i) => ({ ...i, widgetTypeId: 'animation' }));
  } else if (savedInstances['animation'] && !defaults['loop']) {
    defaults['loop'] = savedInstances['animation'].map((i) => ({ ...i, widgetTypeId: 'loop' }));
  }

  // 1. Auto-populate missing widget templates
  WIDGET_REGISTRY.forEach((w) => {
    const shouldAutoPopulate =
      w.id === 'wpm-chart' ||
      w.id === 'animation' ||
      w.id === 'loop' ||
      (w.associatedSliceIds && w.associatedSliceIds.length > 0);
    if (!defaults[w.id] && !clearedSet.has(w.id) && shouldAutoPopulate) {
      if (w.id === 'animation' || w.id === 'loop') {
        const campfireInst: WidgetInstance = {
          id: 'anim-campfire',
          widgetTypeId: w.id,
          label: 'Campfire',
          config: {
            mode: 'symbol',
            groupId: 'SYMBOL_CAMPFIRE',
            loopSpeedMs: 150,
            loop: true,
          },
          slots: {},
        };
        const duckInst: WidgetInstance = {
          id: 'anim-shuba-duck',
          widgetTypeId: w.id,
          label: 'Infinite Walker Shuba Duck',
          config: {
            mode: 'symbol',
            groupId: 'SYMBOL_SHUBA_DUCK',
            loopSpeedMs: 120,
            loop: true,
          },
          slots: {},
        };
        const capybaraInst: WidgetInstance = {
          id: 'anim-capybara',
          widgetTypeId: w.id,
          label: 'Bathing Capybara',
          config: {
            mode: 'symbol',
            groupId: 'SYMBOL_BATHING_CAPYBARA',
            loopSpeedMs: 300,
            loop: true,
          },
          slots: {},
        };
        defaults[w.id] = [campfireInst, duckInst, capybaraInst];
      } else {
        defaults[w.id] = [createDefaultWidgetInstance(w.id, symbolSlices)];
      }
    }
  });

  // 2. Validate & self-heal existing instances: ensure values like groupId/groupIds are assigned
  Object.entries(defaults).forEach(([typeId, instList]) => {
    if (!Array.isArray(instList)) return;
    const normId = normalizeWidgetType(typeId);
    instList.forEach((inst) => {
      if (!inst.config) {
        inst.config = getDefaultWidgetConfig(normId, symbolSlices);
      } else if (inst.config.mode === 'symbol') {
        if (!inst.config.groupId && !inst.config.groupIds && normId !== 'wpm-chart') {
          const defConfig = getDefaultWidgetConfig(normId, symbolSlices);
          if (defConfig.groupId) inst.config.groupId = defConfig.groupId;
          if (defConfig.groupIds) inst.config.groupIds = defConfig.groupIds;
        }
      }
    });
  });

  if (defaults['animation'] && !defaults['loop']) {
    defaults['loop'] = defaults['animation'].map((i) => ({ ...i, widgetTypeId: 'loop' }));
  } else if (defaults['loop'] && !defaults['animation']) {
    defaults['animation'] = defaults['loop'].map((i) => ({ ...i, widgetTypeId: 'animation' }));
  }

  if (defaults['ble-profile']) {
    delete defaults['ble-profile'];
  }
  return defaults;
};

export interface ScreenData {
  blocks: LayoutBlock[];
  idleBlocks: LayoutBlock[];
  dimensions: { width: number; height: number };
  rotation: 0 | 90 | 180 | 270;
  idleScreensEnabled: boolean;
  idleTimeoutSec: number;
  screenOffTimeoutSec: number;
  customTitle?: string;
}

export interface LayoutState {
  centralBlocks: LayoutBlock[];
  peripheralBlocks: LayoutBlock[];
  idleCentralBlocks: LayoutBlock[];
  idlePeripheralBlocks: LayoutBlock[];
  screenDimensions: { width: number; height: number };
  peripheralScreenDimensions: { width: number; height: number };
  rotation: 0 | 90 | 180 | 270;
  peripheralRotation: 0 | 90 | 180 | 270;
  idleScreensEnabled: boolean;
  peripheralIdleScreensEnabled: boolean;
  idleTimeoutSec: number;
  peripheralIdleTimeoutSec: number;
  screenOffTimeoutSec: number;
  peripheralScreenOffTimeoutSec: number;
  symmetricSettings: boolean;
  shieldId: string;
  enabledScreens: ('central' | 'peripheral' | string)[];
  peripheralScreens: Record<string, PeripheralScreenData>;
  loadedShields: LoadedShieldUnit[];
  displayAssignments: Record<string, string | null>;
  hasUserCustomizedDimensions: boolean;
  widgetInstances: WidgetInstanceMap;
  clearedTemplates: string[];
  keymapLayout: ParsedKeymapLayout;
  displays: Record<string, DisplayScreen>;
  activeDisplayId: string;
  addDisplay: (screen?: Partial<DisplayScreen>) => string;
  removeDisplay: (displayId: string) => void;
  updateDisplay: (displayId: string, updater: Partial<DisplayScreen> | ((prev: DisplayScreen) => DisplayScreen)) => void;
  setActiveDisplayId: (displayId: string) => void;

  setCentralBlocks: (updater: LayoutBlock[] | ((prev: LayoutBlock[]) => LayoutBlock[])) => void;
  setPeripheralBlocks: (updater: LayoutBlock[] | ((prev: LayoutBlock[]) => LayoutBlock[])) => void;
  setIdleCentralBlocks: (updater: LayoutBlock[] | ((prev: LayoutBlock[]) => LayoutBlock[])) => void;
  setIdlePeripheralBlocks: (updater: LayoutBlock[] | ((prev: LayoutBlock[]) => LayoutBlock[])) => void;
  setScreenDimensions: (updater: { width: number; height: number } | ((prev: { width: number; height: number }) => { width: number; height: number })) => void;
  setPeripheralScreenDimensions: (updater: { width: number; height: number } | ((prev: { width: number; height: number }) => { width: number; height: number })) => void;
  setRotation: (updater: (0 | 90 | 180 | 270) | ((prev: 0 | 90 | 180 | 270) => 0 | 90 | 180 | 270)) => void;
  setPeripheralRotation: (updater: (0 | 90 | 180 | 270) | ((prev: 0 | 90 | 180 | 270) => 0 | 90 | 180 | 270)) => void;
  setIdleScreensEnabled: (enabled: boolean) => void;
  setPeripheralIdleScreensEnabled: (enabled: boolean) => void;
  setIdleTimeoutSec: (sec: number) => void;
  setPeripheralIdleTimeoutSec: (sec: number) => void;
  setScreenOffTimeoutSec: (sec: number) => void;
  setPeripheralScreenOffTimeoutSec: (sec: number) => void;
  setSymmetricSettings: (symmetric: boolean) => void;
  setShieldId: (shieldId: string) => void;
  setEnabledScreens: (updater: ('central' | 'peripheral' | string)[] | ((prev: ('central' | 'peripheral' | string)[]) => ('central' | 'peripheral' | string)[])) => void;
  setPeripheralScreens: (updater: Record<string, PeripheralScreenData> | ((prev: Record<string, PeripheralScreenData>) => Record<string, PeripheralScreenData>)) => void;
  setLoadedShields: (updater: LoadedShieldUnit[] | ((prev: LoadedShieldUnit[]) => LoadedShieldUnit[])) => void;
  setDisplayAssignments: (updater: Record<string, string | null> | ((prev: Record<string, string | null>) => Record<string, string | null>)) => void;
  setWidgetInstances: (updater: WidgetInstanceMap | ((prev: WidgetInstanceMap) => WidgetInstanceMap)) => void;
  setKeymapLayout: (updater: ParsedKeymapLayout | ((prev: ParsedKeymapLayout) => ParsedKeymapLayout)) => void;
  markDimensionsCustomized: () => void;
  markDimensionsReset: () => void;

  handleCentralDimensionsChange: (newDims: { width: number; height: number }) => void;
  handlePeripheralDimensionsChange: (newDims: { width: number; height: number }) => void;
  handleRotationChange: (newRot: 0 | 90 | 180 | 270) => void;
  handlePeripheralRotationChange: (newRot: 0 | 90 | 180 | 270) => void;
  handleInstancesChange: (newInstances: WidgetInstanceMap) => void;

  getScreenData: (id: string) => ScreenData;
  setScreenData: (id: string, data: ScreenData) => void;
  swapDisplays: (idA: string, idB: string) => void;
  makeMaster: (displayId: string) => void;

  reconcileDetectedShields: (detectedUnits: LoadedShieldUnit[], sourceDesc?: string) => void;
  applyShieldDetectionIfUnset: (detectedShield: string, sourceDesc?: string) => void;
  applyLayoutMetadata: (metadata: HeaderMetadata) => void;
  resetLayoutDefaults: () => void;
}

const getInitialLayoutValues = () => {
  const def = getDefaultAssets();

  let initialCentralBlocks: LayoutBlock[] = def.metadata?.centralBlocks?.length
    ? def.metadata.centralBlocks
    : def.metadata?.leftBlocks?.length
    ? def.metadata.leftBlocks
    : [...DEFAULT_CENTRAL_LAYOUT_BLOCKS];
  try {
    const saved = localStorage.getItem('zmk-central-blocks') || localStorage.getItem('zmk-left-blocks');
    if (saved) initialCentralBlocks = JSON.parse(saved);
  } catch {}

  let initialPeripheralBlocks: LayoutBlock[] = def.metadata?.peripheralBlocks?.length
    ? def.metadata.peripheralBlocks
    : def.metadata?.rightBlocks?.length
    ? def.metadata.rightBlocks
    : [...DEFAULT_PERIPHERAL_LAYOUT_BLOCKS];
  try {
    const saved = localStorage.getItem('zmk-peripheral-blocks') || localStorage.getItem('zmk-right-blocks');
    if (saved) initialPeripheralBlocks = JSON.parse(saved);
  } catch {}

  let initialIdleCentralBlocks: LayoutBlock[] = def.metadata?.idleCentralBlocks?.length
    ? def.metadata.idleCentralBlocks
    : def.metadata?.idleLeftBlocks?.length
    ? def.metadata.idleLeftBlocks
    : [...DEFAULT_IDLE_CENTRAL_BLOCKS];
  try {
    const saved = localStorage.getItem('zmk-idle-central-blocks') || localStorage.getItem('zmk-idle-left-blocks');
    if (saved) initialIdleCentralBlocks = JSON.parse(saved);
  } catch {}

  let initialIdlePeripheralBlocks: LayoutBlock[] = def.metadata?.idlePeripheralBlocks?.length
    ? def.metadata.idlePeripheralBlocks
    : def.metadata?.idleRightBlocks?.length
    ? def.metadata.idleRightBlocks
    : [...DEFAULT_IDLE_PERIPHERAL_BLOCKS];
  try {
    const saved = localStorage.getItem('zmk-idle-peripheral-blocks') || localStorage.getItem('zmk-idle-right-blocks');
    if (saved) initialIdlePeripheralBlocks = JSON.parse(saved);
  } catch {}

  let initialScreenDimensions = def.metadata?.screenDimensions || { width: 32, height: 128 };
  try {
    const saved = localStorage.getItem('zmk-screen-dimensions');
    if (saved) initialScreenDimensions = JSON.parse(saved);
  } catch {}

  let initialPeripheralScreenDimensions =
    def.metadata?.peripheralScreenDimensions ||
    def.metadata?.rightScreenDimensions ||
    def.metadata?.screenDimensions || { width: 32, height: 128 };
  try {
    const saved =
      localStorage.getItem('zmk-peripheral-screen-dimensions') ||
      localStorage.getItem('zmk-right-screen-dimensions');
    if (saved) initialPeripheralScreenDimensions = JSON.parse(saved);
  } catch {}

  let initialHasUserCustomized = false;
  try {
    initialHasUserCustomized = localStorage.getItem('zmk-customized-dimensions') === 'true';
  } catch {}

  let initialIdleScreensEnabled = def.metadata?.idleScreensEnabled ?? true;
  try {
    const saved = localStorage.getItem('zmk-idle-screens-enabled');
    if (saved !== null) initialIdleScreensEnabled = JSON.parse(saved);
  } catch {}

  let initialPeripheralIdleScreensEnabled =
    def.metadata?.peripheralIdleScreensEnabled ??
    def.metadata?.rightIdleScreensEnabled ??
    def.metadata?.idleScreensEnabled ??
    true;
  try {
    const saved =
      localStorage.getItem('zmk-peripheral-idle-screens-enabled') ||
      localStorage.getItem('zmk-right-idle-screens-enabled');
    if (saved !== null) initialPeripheralIdleScreensEnabled = JSON.parse(saved);
  } catch {}

  let initialIdleTimeoutSec = def.metadata?.idleTimeoutSec ?? 30;
  try {
    const saved = localStorage.getItem('zmk-idle-timeout-sec');
    if (saved) initialIdleTimeoutSec = JSON.parse(saved);
  } catch {}

  let initialPeripheralIdleTimeoutSec =
    def.metadata?.peripheralIdleTimeoutSec ??
    def.metadata?.rightIdleTimeoutSec ??
    def.metadata?.idleTimeoutSec ??
    30;
  try {
    const saved =
      localStorage.getItem('zmk-peripheral-idle-timeout-sec') ||
      localStorage.getItem('zmk-right-idle-timeout-sec');
    if (saved) initialPeripheralIdleTimeoutSec = JSON.parse(saved);
  } catch {}

  let initialScreenOffTimeoutSec = def.metadata?.screenOffTimeoutSec ?? 60;
  try {
    const saved = localStorage.getItem('zmk-screen-off-timeout-sec');
    if (saved) initialScreenOffTimeoutSec = JSON.parse(saved);
  } catch {}

  let initialPeripheralScreenOffTimeoutSec =
    def.metadata?.peripheralScreenOffTimeoutSec ??
    def.metadata?.rightScreenOffTimeoutSec ??
    def.metadata?.screenOffTimeoutSec ??
    60;
  try {
    const saved =
      localStorage.getItem('zmk-peripheral-screen-off-timeout-sec') ||
      localStorage.getItem('zmk-right-screen-off-timeout-sec');
    if (saved) initialPeripheralScreenOffTimeoutSec = JSON.parse(saved);
  } catch {}

  let initialSymmetricSettings = def.metadata?.symmetricSettings ?? true;
  try {
    const saved = localStorage.getItem('zmk-symmetric-settings');
    if (saved !== null) initialSymmetricSettings = JSON.parse(saved);
  } catch {}

  let initialRotation: 0 | 90 | 180 | 270 =
    def.metadata?.rotation !== undefined ? def.metadata.rotation : getShieldDefaultRotation('corne');
  try {
    const saved = localStorage.getItem('zmk-screen-rotation');
    if (saved !== null) {
      const val = Number(saved);
      if (val === 0 || val === 90 || val === 180 || val === 270) initialRotation = val as 0 | 90 | 180 | 270;
    }
  } catch {}

  let initialPeripheralRotation: 0 | 90 | 180 | 270 =
    def.metadata?.peripheralRotation !== undefined
      ? def.metadata.peripheralRotation
      : def.metadata?.rightRotation !== undefined
      ? def.metadata.rightRotation
      : def.metadata?.rotation !== undefined
      ? def.metadata.rotation
      : getShieldDefaultRotation('corne');
  try {
    const saved =
      localStorage.getItem('zmk-peripheral-screen-rotation') ||
      localStorage.getItem('zmk-right-screen-rotation');
    if (saved !== null) {
      const val = Number(saved);
      if (val === 0 || val === 90 || val === 180 || val === 270)
        initialPeripheralRotation = val as 0 | 90 | 180 | 270;
    }
  } catch {}

  let initialShieldId = 'corne';
  try {
    const saved = localStorage.getItem('zmk-shield-id');
    if (saved) initialShieldId = saved;
  } catch {}

  let initialEnabledScreens: ('central' | 'peripheral' | string)[] = def.metadata?.enabledScreens
    ?.map((s) => (s === 'left' ? 'central' : s === 'right' ? 'peripheral' : s))
    ?.filter((s) => s !== 'dongle') ?? ['central', 'peripheral'];
  try {
    const saved = localStorage.getItem('zmk-enabled-screens');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        initialEnabledScreens = parsed
          .map((s: string) => (s === 'left' ? 'central' : s === 'right' ? 'peripheral' : s))
          .filter((s: string) => s !== 'dongle');
      }
    }
  } catch {}

  let initialPeripheralScreens: Record<string, PeripheralScreenData> = def.metadata?.peripheralScreens || {};
  try {
    const saved = localStorage.getItem('zmk-peripheral-screens');
    if (saved) initialPeripheralScreens = JSON.parse(saved);
  } catch {}

  let initialLoadedShields = getShieldUnitsForShield(initialShieldId);
  try {
    const saved = localStorage.getItem('zmk-loaded-shields');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) initialLoadedShields = parsed;
    }
  } catch {}

  let initialDisplayAssignments: Record<string, string | null> = {};
  try {
    const saved = localStorage.getItem('zmk-display-assignments');
    if (saved) {
      initialDisplayAssignments = JSON.parse(saved);
    } else {
      const shields = getShieldUnitsForShield(initialShieldId);
      const screens = initialEnabledScreens;
      shields.forEach((shield, idx) => {
        if (idx === 0 && screens.includes('central')) initialDisplayAssignments[shield.id] = 'central';
        else if (idx === 1 && screens.includes('peripheral')) initialDisplayAssignments[shield.id] = 'peripheral';
        else if (idx < screens.length) initialDisplayAssignments[shield.id] = screens[idx];
        else initialDisplayAssignments[shield.id] = null;
      });
    }
  } catch {}

  let initialClearedTemplates: string[] = [];
  try {
    const saved = localStorage.getItem('zmk-cleared-templates');
    if (saved) initialClearedTemplates = JSON.parse(saved);
  } catch {}

  let initialWidgetInstances: WidgetInstanceMap = {};
  try {
    const saved = localStorage.getItem('zmk-widget-instances');
    if (saved) {
      initialWidgetInstances = JSON.parse(saved);
    } else if (def.metadata?.widgetInstances) {
      initialWidgetInstances = JSON.parse(JSON.stringify(def.metadata.widgetInstances));
    }
  } catch {}
  initialWidgetInstances = populateDefaultWidgetInstances(
    initialWidgetInstances,
    initialClearedTemplates,
    def.symbolSlices
  );

  let initialKeymapLayout = DEFAULT_EMPTY_5X3_LAYOUT;
  try {
    const saved = localStorage.getItem('zmk-keymap-layout');
    if (saved) initialKeymapLayout = JSON.parse(saved);
  } catch {}

  const initialDisplays: Record<string, DisplayScreen> = {
    'display-1': {
      id: 'display-1',
      name: 'Display 1',
      dimensions: initialScreenDimensions,
      rotation: initialRotation,
      blocks: initialCentralBlocks,
      idleBlocks: initialIdleCentralBlocks,
      idleTimeoutSec: initialIdleTimeoutSec,
      screenOffTimeoutSec: initialScreenOffTimeoutSec,
      idleScreensEnabled: initialIdleScreensEnabled,
    },
  };
  if (initialPeripheralBlocks?.length > 0 || initialEnabledScreens.includes('peripheral')) {
    initialDisplays['display-2'] = {
      id: 'display-2',
      name: 'Display 2',
      dimensions: initialPeripheralScreenDimensions,
      rotation: initialPeripheralRotation,
      blocks: initialPeripheralBlocks,
      idleBlocks: initialIdlePeripheralBlocks,
      idleTimeoutSec: initialPeripheralIdleTimeoutSec,
      screenOffTimeoutSec: initialPeripheralScreenOffTimeoutSec,
      idleScreensEnabled: initialPeripheralIdleScreensEnabled,
    };
  }
  if (initialPeripheralScreens) {
    let slot = 3;
    Object.entries(initialPeripheralScreens).forEach(([, p]) => {
      const dId = `display-${slot++}`;
      initialDisplays[dId] = {
        id: dId,
        name: p.name || `Display ${slot - 1}`,
        dimensions: p.screenDimensions || { width: 32, height: 128 },
        rotation: p.rotation ?? 90,
        blocks: p.blocks || [],
        idleBlocks: p.idleBlocks || [],
        idleTimeoutSec: p.idleTimeoutSec ?? 30,
        screenOffTimeoutSec: p.screenOffTimeoutSec ?? 60,
        idleScreensEnabled: p.idleScreensEnabled ?? false,
      };
    });
  }

  return {
    initialDisplays,
    initialCentralBlocks,
    initialPeripheralBlocks,
    initialIdleCentralBlocks,
    initialIdlePeripheralBlocks,
    initialScreenDimensions,
    initialPeripheralScreenDimensions,
    initialHasUserCustomized,
    initialIdleScreensEnabled,
    initialPeripheralIdleScreensEnabled,
    initialIdleTimeoutSec,
    initialPeripheralIdleTimeoutSec,
    initialScreenOffTimeoutSec,
    initialPeripheralScreenOffTimeoutSec,
    initialSymmetricSettings,
    initialRotation,
    initialPeripheralRotation,
    initialShieldId,
    initialEnabledScreens,
    initialPeripheralScreens,
    initialLoadedShields,
    initialDisplayAssignments,
    initialClearedTemplates,
    initialWidgetInstances,
    initialKeymapLayout,
  };
};

export const useLayoutStore = create<LayoutState>((set, get) => {
  const init = getInitialLayoutValues();

  const syncStorage = (key: string, value: any) => {
    try {
      if (typeof value === 'string') {
        localStorage.setItem(key, value);
      } else {
        localStorage.setItem(key, JSON.stringify(value));
      }
    } catch {}
  };

  return {
    centralBlocks: init.initialCentralBlocks,
    peripheralBlocks: init.initialPeripheralBlocks,
    idleCentralBlocks: init.initialIdleCentralBlocks,
    idlePeripheralBlocks: init.initialIdlePeripheralBlocks,
    screenDimensions: init.initialScreenDimensions,
    peripheralScreenDimensions: init.initialPeripheralScreenDimensions,
    rotation: init.initialRotation,
    peripheralRotation: init.initialPeripheralRotation,
    idleScreensEnabled: init.initialIdleScreensEnabled,
    peripheralIdleScreensEnabled: init.initialPeripheralIdleScreensEnabled,
    idleTimeoutSec: init.initialIdleTimeoutSec,
    peripheralIdleTimeoutSec: init.initialPeripheralIdleTimeoutSec,
    screenOffTimeoutSec: init.initialScreenOffTimeoutSec,
    peripheralScreenOffTimeoutSec: init.initialPeripheralScreenOffTimeoutSec,
    symmetricSettings: init.initialSymmetricSettings,
    shieldId: init.initialShieldId,
    enabledScreens: init.initialEnabledScreens,
    peripheralScreens: init.initialPeripheralScreens,
    loadedShields: init.initialLoadedShields,
    displayAssignments: init.initialDisplayAssignments,
    hasUserCustomizedDimensions: init.initialHasUserCustomized,
    widgetInstances: init.initialWidgetInstances,
    clearedTemplates: init.initialClearedTemplates,
    keymapLayout: init.initialKeymapLayout,
    displays: init.initialDisplays,
    activeDisplayId: 'display-1',

    addDisplay: (screen?: Partial<DisplayScreen>) => {
      let newId = '';
      set((state) => {
        let slot = 1;
        while (state.displays[`display-${slot}`]) slot++;
        newId = `display-${slot}`;
        const newScreen: DisplayScreen = {
          ...createDefaultDisplayScreen(newId, `Display ${slot}`, false),
          ...screen,
          id: newId,
        };
        const nextDisplays = { ...state.displays, [newId]: newScreen };
        return { displays: nextDisplays, activeDisplayId: newId };
      });
      return newId;
    },

    removeDisplay: (displayId: string) => {
      set((state) => {
        if (Object.keys(state.displays).length <= 1) {
          useUiStore.getState().showToast('error', 'Cannot remove the only display screen.');
          return state;
        }
        const nextDisplays = { ...state.displays };
        delete nextDisplays[displayId];
        const nextAssignments = { ...state.displayAssignments };
        for (const [sId, dId] of Object.entries(nextAssignments)) {
          if (dId === displayId) nextAssignments[sId] = null;
        }
        const remainingIds = Object.keys(nextDisplays);
        const nextActiveId = state.activeDisplayId === displayId ? remainingIds[0] : state.activeDisplayId;
        return {
          displays: nextDisplays,
          displayAssignments: nextAssignments,
          activeDisplayId: nextActiveId,
        };
      });
    },

    updateDisplay: (displayId: string, updater: Partial<DisplayScreen> | ((prev: DisplayScreen) => DisplayScreen)) => {
      set((state) => {
        const prev = state.displays[displayId];
        if (!prev) return state;
        const updated = typeof updater === 'function' ? updater(prev) : { ...prev, ...updater };
        const nextDisplays = { ...state.displays, [displayId]: updated };

        let legacyUpdates: any = {};
        if (displayId === 'display-1') {
          legacyUpdates = {
            centralBlocks: updated.blocks,
            idleCentralBlocks: updated.idleBlocks,
            screenDimensions: updated.dimensions,
            rotation: updated.rotation,
            idleTimeoutSec: updated.idleTimeoutSec,
            screenOffTimeoutSec: updated.screenOffTimeoutSec,
            idleScreensEnabled: updated.idleScreensEnabled,
          };
        } else if (displayId === 'display-2') {
          legacyUpdates = {
            peripheralBlocks: updated.blocks,
            idlePeripheralBlocks: updated.idleBlocks,
            peripheralScreenDimensions: updated.dimensions,
            peripheralRotation: updated.rotation,
            peripheralIdleTimeoutSec: updated.idleTimeoutSec,
            peripheralScreenOffTimeoutSec: updated.screenOffTimeoutSec,
            peripheralIdleScreensEnabled: updated.idleScreensEnabled,
          };
        }

        return {
          displays: nextDisplays,
          ...legacyUpdates,
        };
      });
    },

    setActiveDisplayId: (displayId: string) => {
      set({ activeDisplayId: displayId });
    },

    setCentralBlocks: (updater) => {
      set((state) => {
        const next = typeof updater === 'function' ? updater(state.centralBlocks) : updater;
        syncStorage('zmk-central-blocks', next);
        const nextDisplays = { ...state.displays };
        if (nextDisplays['display-1']) {
          nextDisplays['display-1'] = { ...nextDisplays['display-1'], blocks: next };
        }
        return { centralBlocks: next, displays: nextDisplays };
      });
    },

    setPeripheralBlocks: (updater) => {
      set((state) => {
        const next = typeof updater === 'function' ? updater(state.peripheralBlocks) : updater;
        syncStorage('zmk-peripheral-blocks', next);
        const nextDisplays = { ...state.displays };
        if (nextDisplays['display-2']) {
          nextDisplays['display-2'] = { ...nextDisplays['display-2'], blocks: next };
        }
        return { peripheralBlocks: next, displays: nextDisplays };
      });
    },

    setIdleCentralBlocks: (updater) => {
      set((state) => {
        const next = typeof updater === 'function' ? updater(state.idleCentralBlocks) : updater;
        syncStorage('zmk-idle-central-blocks', next);
        const nextDisplays = { ...state.displays };
        if (nextDisplays['display-1']) {
          nextDisplays['display-1'] = { ...nextDisplays['display-1'], idleBlocks: next };
        }
        return { idleCentralBlocks: next, displays: nextDisplays };
      });
    },

    setIdlePeripheralBlocks: (updater) => {
      set((state) => {
        const next = typeof updater === 'function' ? updater(state.idlePeripheralBlocks) : updater;
        syncStorage('zmk-idle-peripheral-blocks', next);
        const nextDisplays = { ...state.displays };
        if (nextDisplays['display-2']) {
          nextDisplays['display-2'] = { ...nextDisplays['display-2'], idleBlocks: next };
        }
        return { idlePeripheralBlocks: next, displays: nextDisplays };
      });
    },

    setScreenDimensions: (updater) => {
      set((state) => {
        const next = typeof updater === 'function' ? updater(state.screenDimensions) : updater;
        syncStorage('zmk-screen-dimensions', next);
        const nextDisplays = { ...state.displays };
        if (nextDisplays['display-1']) {
          nextDisplays['display-1'] = { ...nextDisplays['display-1'], dimensions: next };
        }
        return { screenDimensions: next, displays: nextDisplays };
      });
    },

    setPeripheralScreenDimensions: (updater) => {
      set((state) => {
        const next = typeof updater === 'function' ? updater(state.peripheralScreenDimensions) : updater;
        syncStorage('zmk-peripheral-screen-dimensions', next);
        const nextDisplays = { ...state.displays };
        if (nextDisplays['display-2']) {
          nextDisplays['display-2'] = { ...nextDisplays['display-2'], dimensions: next };
        }
        return { peripheralScreenDimensions: next, displays: nextDisplays };
      });
    },

    setRotation: (updater) => {
      set((state) => {
        const next = typeof updater === 'function' ? updater(state.rotation) : updater;
        syncStorage('zmk-screen-rotation', String(next));
        const nextDisplays = { ...state.displays };
        if (nextDisplays['display-1']) {
          nextDisplays['display-1'] = { ...nextDisplays['display-1'], rotation: next };
        }
        return { rotation: next, displays: nextDisplays };
      });
    },

    setPeripheralRotation: (updater) => {
      set((state) => {
        const next = typeof updater === 'function' ? updater(state.peripheralRotation) : updater;
        syncStorage('zmk-peripheral-screen-rotation', String(next));
        const nextDisplays = { ...state.displays };
        if (nextDisplays['display-2']) {
          nextDisplays['display-2'] = { ...nextDisplays['display-2'], rotation: next };
        }
        return { peripheralRotation: next, displays: nextDisplays };
      });
    },

    setIdleScreensEnabled: (enabled) => {
      syncStorage('zmk-idle-screens-enabled', enabled);
      set((state) => {
        const nextDisplays = { ...state.displays };
        if (nextDisplays['display-1']) {
          nextDisplays['display-1'] = { ...nextDisplays['display-1'], idleScreensEnabled: enabled };
        }
        return { idleScreensEnabled: enabled, displays: nextDisplays };
      });
    },

    setPeripheralIdleScreensEnabled: (enabled) => {
      syncStorage('zmk-peripheral-idle-screens-enabled', enabled);
      set((state) => {
        const nextDisplays = { ...state.displays };
        if (nextDisplays['display-2']) {
          nextDisplays['display-2'] = { ...nextDisplays['display-2'], idleScreensEnabled: enabled };
        }
        return { peripheralIdleScreensEnabled: enabled, displays: nextDisplays };
      });
    },

    setIdleTimeoutSec: (sec) => {
      syncStorage('zmk-idle-timeout-sec', sec);
      set((state) => {
        const nextDisplays = { ...state.displays };
        if (nextDisplays['display-1']) {
          nextDisplays['display-1'] = { ...nextDisplays['display-1'], idleTimeoutSec: sec };
        }
        return { idleTimeoutSec: sec, displays: nextDisplays };
      });
    },

    setPeripheralIdleTimeoutSec: (sec) => {
      syncStorage('zmk-peripheral-idle-timeout-sec', sec);
      set((state) => {
        const nextDisplays = { ...state.displays };
        if (nextDisplays['display-2']) {
          nextDisplays['display-2'] = { ...nextDisplays['display-2'], idleTimeoutSec: sec };
        }
        return { peripheralIdleTimeoutSec: sec, displays: nextDisplays };
      });
    },

    setScreenOffTimeoutSec: (sec) => {
      syncStorage('zmk-screen-off-timeout-sec', sec);
      set((state) => {
        const nextDisplays = { ...state.displays };
        if (nextDisplays['display-1']) {
          nextDisplays['display-1'] = { ...nextDisplays['display-1'], screenOffTimeoutSec: sec };
        }
        return { screenOffTimeoutSec: sec, displays: nextDisplays };
      });
    },

    setPeripheralScreenOffTimeoutSec: (sec) => {
      syncStorage('zmk-peripheral-screen-off-timeout-sec', sec);
      set((state) => {
        const nextDisplays = { ...state.displays };
        if (nextDisplays['display-2']) {
          nextDisplays['display-2'] = { ...nextDisplays['display-2'], screenOffTimeoutSec: sec };
        }
        return { peripheralScreenOffTimeoutSec: sec, displays: nextDisplays };
      });
    },

    setSymmetricSettings: (symmetric) => {
      syncStorage('zmk-symmetric-settings', symmetric);
      set({ symmetricSettings: symmetric });
    },

    setShieldId: (shieldId) => {
      syncStorage('zmk-shield-id', shieldId);
      set({ shieldId });
    },

    setEnabledScreens: (updater) => {
      set((state) => {
        const nextScreens = typeof updater === 'function' ? updater(state.enabledScreens) : updater;
        syncStorage('zmk-enabled-screens', nextScreens);

        let changed = false;
        const nextAssignments = { ...state.displayAssignments };
        for (const [shieldKey, dispId] of Object.entries(nextAssignments)) {
          if (dispId && !nextScreens.includes(dispId)) {
            nextAssignments[shieldKey] = null;
            changed = true;
          }
        }
        if (changed) {
          syncStorage('zmk-display-assignments', nextAssignments);
        }

        return {
          enabledScreens: nextScreens,
          ...(changed ? { displayAssignments: nextAssignments } : {}),
        };
      });
    },

    setPeripheralScreens: (updater) => {
      set((state) => {
        const next = typeof updater === 'function' ? updater(state.peripheralScreens) : updater;
        syncStorage('zmk-peripheral-screens', next);
        return { peripheralScreens: next };
      });
    },

    setLoadedShields: (updater) => {
      set((state) => {
        const next = typeof updater === 'function' ? updater(state.loadedShields) : updater;
        syncStorage('zmk-loaded-shields', next);
        return { loadedShields: next };
      });
    },

    setDisplayAssignments: (updater) => {
      set((state) => {
        const next = typeof updater === 'function' ? updater(state.displayAssignments) : updater;
        syncStorage('zmk-display-assignments', next);
        return { displayAssignments: next };
      });
    },

    setWidgetInstances: (updater) => {
      set((state) => {
        const next = typeof updater === 'function' ? updater(state.widgetInstances) : updater;
        syncStorage('zmk-widget-instances', next);
        return { widgetInstances: next };
      });
    },

    setKeymapLayout: (updater) => {
      set((state) => {
        const next = typeof updater === 'function' ? updater(state.keymapLayout) : updater;
        syncStorage('zmk-keymap-layout', next);
        return { keymapLayout: next };
      });
    },

    markDimensionsCustomized: () => {
      syncStorage('zmk-customized-dimensions', 'true');
      set({ hasUserCustomizedDimensions: true });
    },

    markDimensionsReset: () => {
      try {
        localStorage.removeItem('zmk-customized-dimensions');
      } catch {}
      set({ hasUserCustomizedDimensions: false });
    },

    handleCentralDimensionsChange: (newDims) => {
      const { screenDimensions: prevDims, widgetInstances } = get();
      if (prevDims.width === newDims.width && prevDims.height === newDims.height) {
        return;
      }
      const remappedCentral = remapBlockCoordinates(get().centralBlocks, prevDims, newDims, widgetInstances);
      const remappedIdle = remapBlockCoordinates(get().idleCentralBlocks, prevDims, newDims, widgetInstances);

      syncStorage('zmk-central-blocks', remappedCentral);
      syncStorage('zmk-idle-central-blocks', remappedIdle);
      syncStorage('zmk-screen-dimensions', newDims);
      syncStorage('zmk-customized-dimensions', 'true');

      set({
        centralBlocks: remappedCentral,
        idleCentralBlocks: remappedIdle,
        screenDimensions: newDims,
        hasUserCustomizedDimensions: true,
      });
    },

    handlePeripheralDimensionsChange: (newDims) => {
      const { peripheralScreenDimensions: prevDims, widgetInstances } = get();
      if (prevDims.width === newDims.width && prevDims.height === newDims.height) {
        return;
      }
      const remappedPeripheral = remapBlockCoordinates(get().peripheralBlocks, prevDims, newDims, widgetInstances);
      const remappedIdle = remapBlockCoordinates(get().idlePeripheralBlocks, prevDims, newDims, widgetInstances);

      syncStorage('zmk-peripheral-blocks', remappedPeripheral);
      syncStorage('zmk-idle-peripheral-blocks', remappedIdle);
      syncStorage('zmk-peripheral-screen-dimensions', newDims);
      syncStorage('zmk-customized-dimensions', 'true');

      set({
        peripheralBlocks: remappedPeripheral,
        idlePeripheralBlocks: remappedIdle,
        peripheralScreenDimensions: newDims,
        hasUserCustomizedDimensions: true,
      });
    },

    handleRotationChange: (newRot) => {
      const { symmetricSettings } = get();
      syncStorage('zmk-screen-rotation', String(newRot));
      syncStorage('zmk-customized-dimensions', 'true');
      if (symmetricSettings) {
        syncStorage('zmk-peripheral-screen-rotation', String(newRot));
      }
      set((state) => ({
        rotation: newRot,
        peripheralRotation: symmetricSettings ? newRot : state.peripheralRotation,
        hasUserCustomizedDimensions: true,
      }));
    },

    handlePeripheralRotationChange: (newRot) => {
      syncStorage('zmk-peripheral-screen-rotation', String(newRot));
      syncStorage('zmk-customized-dimensions', 'true');
      set({ peripheralRotation: newRot, hasUserCustomizedDimensions: true });
    },

    handleInstancesChange: (newInstances) => {
      const prev = get().widgetInstances;
      const newlyCleared = Object.keys(prev).filter(
        (typeId) => prev[typeId].length > 0 && (!newInstances[typeId] || newInstances[typeId].length === 0)
      );

      let nextCleared = get().clearedTemplates;
      if (newlyCleared.length > 0) {
        nextCleared = Array.from(new Set([...nextCleared, ...newlyCleared]));
        syncStorage('zmk-cleared-templates', nextCleared);
      }

      syncStorage('zmk-widget-instances', newInstances);
      set({ widgetInstances: newInstances, clearedTemplates: nextCleared });
    },

    getScreenData: (id: string): ScreenData => {
      const state = get();
      const normId = (id === 'left' || id === 'central') ? 'display-1' : (id === 'right' || id === 'peripheral') ? 'display-2' : id;

      if (state.displays && state.displays[normId]) {
        const d = state.displays[normId];
        return {
          blocks: d.blocks,
          idleBlocks: d.idleBlocks,
          dimensions: d.dimensions,
          rotation: d.rotation,
          idleScreensEnabled: d.idleScreensEnabled,
          idleTimeoutSec: d.idleTimeoutSec,
          screenOffTimeoutSec: d.screenOffTimeoutSec,
          customTitle: d.name,
        };
      }

      if (normId === 'display-1') {
        return {
          blocks: state.centralBlocks,
          idleBlocks: state.idleCentralBlocks,
          dimensions: state.screenDimensions,
          rotation: state.rotation,
          idleScreensEnabled: state.idleScreensEnabled,
          idleTimeoutSec: state.idleTimeoutSec,
          screenOffTimeoutSec: state.screenOffTimeoutSec,
        };
      }
      if (normId === 'display-2') {
        return {
          blocks: state.peripheralBlocks,
          idleBlocks: state.idlePeripheralBlocks,
          dimensions: state.peripheralScreenDimensions,
          rotation: state.peripheralRotation,
          idleScreensEnabled: state.peripheralIdleScreensEnabled,
          idleTimeoutSec: state.peripheralIdleTimeoutSec,
          screenOffTimeoutSec: state.peripheralScreenOffTimeoutSec,
        };
      }

      const p = state.peripheralScreens[id] || {};
      return {
        blocks: p.blocks || [],
        idleBlocks: p.idleBlocks || [],
        dimensions: p.screenDimensions || { width: 32, height: 128 },
        rotation:
          p.rotation ??
          (p.screenDimensions && p.screenDimensions.width < p.screenDimensions.height ? 90 : 0),
        idleScreensEnabled: p.idleScreensEnabled ?? false,
        idleTimeoutSec: p.idleTimeoutSec ?? 30,
        screenOffTimeoutSec: p.screenOffTimeoutSec ?? 60,
        customTitle: p.name,
      };
    },

    setScreenData: (id: string, data: ScreenData) => {
      const state = get();
      const normId = (id === 'left' || id === 'central') ? 'display-1' : (id === 'right' || id === 'peripheral') ? 'display-2' : id;

      if (state.displays && state.displays[normId]) {
        const prev = state.displays[normId];
        const remappedBlocks = remapBlockCoordinates(
          data.blocks,
          prev.dimensions,
          data.dimensions,
          state.widgetInstances
        );
        const remappedIdle = remapBlockCoordinates(
          data.idleBlocks,
          prev.dimensions,
          data.dimensions,
          state.widgetInstances
        );
        get().updateDisplay(normId, {
          blocks: remappedBlocks,
          idleBlocks: remappedIdle,
          dimensions: data.dimensions,
          rotation: data.rotation ?? prev.rotation,
          idleScreensEnabled: data.idleScreensEnabled,
          idleTimeoutSec: data.idleTimeoutSec,
          screenOffTimeoutSec: data.screenOffTimeoutSec,
          name: data.customTitle ?? prev.name,
        });
        return;
      }

      if (normId === 'display-1') {
        const remappedBlocks = remapBlockCoordinates(
          data.blocks,
          state.screenDimensions,
          data.dimensions,
          state.widgetInstances
        );
        const remappedIdle = remapBlockCoordinates(
          data.idleBlocks,
          state.screenDimensions,
          data.dimensions,
          state.widgetInstances
        );

        syncStorage('zmk-central-blocks', remappedBlocks);
        syncStorage('zmk-idle-central-blocks', remappedIdle);
        syncStorage('zmk-screen-dimensions', data.dimensions);
        syncStorage('zmk-customized-dimensions', 'true');
        syncStorage('zmk-idle-screens-enabled', data.idleScreensEnabled);
        syncStorage('zmk-idle-timeout-sec', data.idleTimeoutSec);
        syncStorage('zmk-screen-off-timeout-sec', data.screenOffTimeoutSec);
        if (data.rotation !== undefined) {
          syncStorage('zmk-screen-rotation', String(data.rotation));
        }

        const nextDisplays = { ...state.displays };
        nextDisplays['display-1'] = {
          id: 'display-1',
          name: data.customTitle || 'Display 1',
          dimensions: data.dimensions,
          rotation: data.rotation !== undefined ? data.rotation : state.rotation,
          blocks: remappedBlocks,
          idleBlocks: remappedIdle,
          idleTimeoutSec: data.idleTimeoutSec,
          screenOffTimeoutSec: data.screenOffTimeoutSec,
          idleScreensEnabled: data.idleScreensEnabled,
        };

        set({
          displays: nextDisplays,
          centralBlocks: remappedBlocks,
          idleCentralBlocks: remappedIdle,
          screenDimensions: data.dimensions,
          rotation: data.rotation !== undefined ? data.rotation : state.rotation,
          hasUserCustomizedDimensions: true,
          idleScreensEnabled: data.idleScreensEnabled,
          idleTimeoutSec: data.idleTimeoutSec,
          screenOffTimeoutSec: data.screenOffTimeoutSec,
        });
        return;
      }

      if (normId === 'display-2') {
        const remappedBlocks = remapBlockCoordinates(
          data.blocks,
          state.peripheralScreenDimensions,
          data.dimensions,
          state.widgetInstances
        );
        const remappedIdle = remapBlockCoordinates(
          data.idleBlocks,
          state.peripheralScreenDimensions,
          data.dimensions,
          state.widgetInstances
        );

        syncStorage('zmk-peripheral-blocks', remappedBlocks);
        syncStorage('zmk-idle-peripheral-blocks', remappedIdle);
        syncStorage('zmk-peripheral-screen-dimensions', data.dimensions);
        syncStorage('zmk-customized-dimensions', 'true');
        syncStorage('zmk-peripheral-idle-screens-enabled', data.idleScreensEnabled);
        syncStorage('zmk-peripheral-idle-timeout-sec', data.idleTimeoutSec);
        syncStorage('zmk-peripheral-screen-off-timeout-sec', data.screenOffTimeoutSec);
        if (data.rotation !== undefined) {
          syncStorage('zmk-peripheral-screen-rotation', String(data.rotation));
        }

        const nextDisplays = { ...state.displays };
        nextDisplays['display-2'] = {
          id: 'display-2',
          name: data.customTitle || 'Display 2',
          dimensions: data.dimensions,
          rotation: data.rotation !== undefined ? data.rotation : state.peripheralRotation,
          blocks: remappedBlocks,
          idleBlocks: remappedIdle,
          idleTimeoutSec: data.idleTimeoutSec,
          screenOffTimeoutSec: data.screenOffTimeoutSec,
          idleScreensEnabled: data.idleScreensEnabled,
        };

        set({
          displays: nextDisplays,
          peripheralBlocks: remappedBlocks,
          idlePeripheralBlocks: remappedIdle,
          peripheralScreenDimensions: data.dimensions,
          peripheralRotation: data.rotation !== undefined ? data.rotation : state.peripheralRotation,
          hasUserCustomizedDimensions: true,
          peripheralIdleScreensEnabled: data.idleScreensEnabled,
          peripheralIdleTimeoutSec: data.idleTimeoutSec,
          peripheralScreenOffTimeoutSec: data.screenOffTimeoutSec,
        });
        return;
      }

      set((prev) => {
        const oldDims = prev.peripheralScreens[id]?.screenDimensions || { width: 32, height: 128 };
        const updatedScreens: Record<string, PeripheralScreenData> = {
          ...prev.peripheralScreens,
          [id]: {
            ...prev.peripheralScreens[id],
            blocks: remapBlockCoordinates(data.blocks, oldDims, data.dimensions, prev.widgetInstances),
            idleBlocks: remapBlockCoordinates(data.idleBlocks, oldDims, data.dimensions, prev.widgetInstances),
            screenDimensions: data.dimensions,
            rotation: data.rotation ?? prev.peripheralScreens[id]?.rotation,
            idleScreensEnabled: data.idleScreensEnabled,
            idleTimeoutSec: data.idleTimeoutSec,
            screenOffTimeoutSec: data.screenOffTimeoutSec,
            name: data.customTitle ?? prev.peripheralScreens[id]?.name,
          },
        };
        syncStorage('zmk-peripheral-screens', updatedScreens);
        return { peripheralScreens: updatedScreens };
      });
    },

    swapDisplays: (idA: string, idB: string) => {
      if (idA === idB) return;
      const dataA = get().getScreenData(idA);
      const dataB = get().getScreenData(idB);
      get().setScreenData(idA, dataB);
      get().setScreenData(idB, dataA);
      useUiStore.getState().showToast('success', `Swapped displays: ${idA} ↔ ${idB}`);
    },

    makeMaster: (displayId: string) => {
      if (displayId === 'left' || displayId === 'central') return;
      get().swapDisplays('central', displayId);
    },

    reconcileDetectedShields: (detectedUnits: LoadedShieldUnit[], sourceDesc = 'repository config') => {
      if (!detectedUnits || detectedUnits.length === 0) return;

      const detectedIds = new Set(detectedUnits.map((u) => u.id));
      const prevShields = get().loadedShields;
      const currentAssignments = get().displayAssignments;

      const removedShieldIds = new Set<string>();
      prevShields.forEach((s) => {
        if (!detectedIds.has(s.id)) {
          removedShieldIds.add(s.id);
        }
      });
      Object.keys(currentAssignments).forEach((shId) => {
        if (!detectedIds.has(shId)) {
          removedShieldIds.add(shId);
        }
      });

      const nextAssignments = { ...currentAssignments };
      let assignmentsChanged = false;
      if (removedShieldIds.size > 0) {
        removedShieldIds.forEach((shId) => {
          if (shId in nextAssignments) {
            delete nextAssignments[shId];
            assignmentsChanged = true;
          }
        });
      }

      let nextScreens = [...get().enabledScreens];
      let screensChanged = false;

      // Harmonize enabledScreens and displayAssignments for detected shields
      if (detectedUnits.length === 1 && detectedUnits[0].side === 'single') {
        // Unibody: ensure exactly central is enabled and assigned
        const singleId = detectedUnits[0].id;
        if (!nextAssignments[singleId]) {
          nextAssignments[singleId] = 'central';
          assignmentsChanged = true;
        }
        if (nextScreens.length !== 1 || nextScreens[0] !== 'central') {
          nextScreens = ['central'];
          screensChanged = true;
        }
      } else {
        // Multi-part: expand enabled screens to match shield units if needed
        while (nextScreens.length < detectedUnits.length) {
          const nextIdx = nextScreens.length;
          const newScreenId = nextIdx === 1 ? 'peripheral' : `peripheral-${nextIdx}`;
          if (!nextScreens.includes(newScreenId)) {
            nextScreens.push(newScreenId);
            screensChanged = true;
          } else {
            break;
          }
        }

        // Auto-assign any newly discovered shields to available display slots (prioritize master/central)
        const sortedUnits = [...detectedUnits].sort((a, b) => (b.isMaster ? 1 : 0) - (a.isMaster ? 1 : 0));
        sortedUnits.forEach((u) => {
          if (!nextAssignments[u.id]) {
            const usedScreens = new Set(Object.values(nextAssignments).filter(Boolean));
            if (u.isMaster && !usedScreens.has('central')) {
              nextAssignments[u.id] = 'central';
              assignmentsChanged = true;
            } else {
              const availableScreen = nextScreens.find((s) => !usedScreens.has(s));
              if (availableScreen) {
                nextAssignments[u.id] = availableScreen;
                assignmentsChanged = true;
              }
            }
          }
        });
      }

      syncStorage('zmk-loaded-shields', detectedUnits);
      if (assignmentsChanged) {
        syncStorage('zmk-display-assignments', nextAssignments);
      }
      if (screensChanged) {
        syncStorage('zmk-enabled-screens', nextScreens);
      }

      set({
        loadedShields: detectedUnits,
        ...(assignmentsChanged ? { displayAssignments: nextAssignments } : {}),
        ...(screensChanged ? { enabledScreens: nextScreens } : {}),
      });

      if (removedShieldIds.size > 0) {
        const removedNames = Array.from(removedShieldIds).join(', ');
        useUiStore.getState().showToast(
          'warning',
          `Shield (${removedNames}) was removed from ${sourceDesc}. Any previously attached display is now unattached and won't be saved when committing.`
        );
      }
    },

    applyShieldDetectionIfUnset: (detectedShield: string, sourceDesc?: string) => {
      if (!detectedShield || detectedShield === 'unknown') return;

      get().setShieldId(detectedShield);

      if (!get().hasUserCustomizedDimensions) {
        const defaultRes = getShieldDefaultResolution(detectedShield);
        const defaultRot = getShieldDefaultRotation(detectedShield);
        get().handleCentralDimensionsChange(defaultRes);
        get().handlePeripheralDimensionsChange(defaultRes);
        get().setRotation(defaultRot);
        get().setPeripheralRotation(defaultRot);
        if (sourceDesc) {
          useUiStore.getState().showToast(
            'success',
            `Detected ${detectedShield} from ${sourceDesc}: aligned canvas to ${defaultRes.width}x${defaultRes.height} px (${defaultRot}°)`
          );
        }
      }
    },

    applyLayoutMetadata: (metadata: HeaderMetadata) => {
      const cBlocks = metadata.centralBlocks ?? metadata.leftBlocks;
      const pBlocks = metadata.peripheralBlocks ?? metadata.rightBlocks;
      const idleCBlocks = metadata.idleCentralBlocks ?? metadata.idleLeftBlocks;
      const idlePBlocks = metadata.idlePeripheralBlocks ?? metadata.idleRightBlocks;
      const pDims = metadata.peripheralScreenDimensions ?? metadata.rightScreenDimensions;
      const pIdleEnabled = metadata.peripheralIdleScreensEnabled ?? metadata.rightIdleScreensEnabled;
      const pIdleTimeout = metadata.peripheralIdleTimeoutSec ?? metadata.rightIdleTimeoutSec;
      const pScreenOffTimeout = metadata.peripheralScreenOffTimeoutSec ?? metadata.rightScreenOffTimeoutSec;
      const pRot = metadata.peripheralRotation ?? metadata.rightRotation ?? metadata.rotation;

      let instMap: WidgetInstanceMap | undefined;
      if (metadata.widgetInstances) {
        instMap = { ...metadata.widgetInstances };
        if (instMap['loop'] && !instMap['animation']) {
          instMap['animation'] = instMap['loop'].map((i) => ({ ...i, widgetTypeId: 'animation' }));
        } else if (instMap['animation'] && !instMap['loop']) {
          instMap['loop'] = instMap['animation'].map((i) => ({ ...i, widgetTypeId: 'loop' }));
        }
      }

      const rawEnabled = metadata.enabledScreens;
      const resolvedEnabledScreens =
        rawEnabled && rawEnabled.length > 0
          ? rawEnabled
              .map((s) => (s === 'left' ? 'central' : s === 'right' ? 'peripheral' : s))
              .filter((s) => s !== 'dongle')
          : ['central', 'peripheral'];

      let nextDisplays: Record<string, DisplayScreen>;
      if (metadata.displays && Object.keys(metadata.displays).length > 0) {
        nextDisplays = { ...metadata.displays };
      } else {
        const resolvedCentral = cBlocks && cBlocks.length > 0 ? cBlocks : get().centralBlocks;
        const resolvedPeripheral = pBlocks && pBlocks.length > 0 ? pBlocks : get().peripheralBlocks;
        const resolvedIdleCentral = idleCBlocks && idleCBlocks.length > 0 ? idleCBlocks : get().idleCentralBlocks;
        const resolvedIdlePeripheral = idlePBlocks && idlePBlocks.length > 0 ? idlePBlocks : get().idlePeripheralBlocks;
        const resolvedDims = metadata.screenDimensions ?? get().screenDimensions;
        const resolvedPDims = pDims ?? get().peripheralScreenDimensions;
        const resolvedRot = metadata.rotation !== undefined ? metadata.rotation : get().rotation;
        const resolvedPRot = pRot !== undefined ? pRot : get().peripheralRotation;

        nextDisplays = {
          'display-1': {
            id: 'display-1',
            name: 'Display 1',
            dimensions: resolvedDims,
            rotation: resolvedRot,
            blocks: resolvedCentral,
            idleBlocks: resolvedIdleCentral,
            idleTimeoutSec: metadata.idleTimeoutSec ?? get().idleTimeoutSec,
            screenOffTimeoutSec: metadata.screenOffTimeoutSec ?? get().screenOffTimeoutSec,
            idleScreensEnabled: metadata.idleScreensEnabled ?? get().idleScreensEnabled,
          },
        };
        if (pBlocks || idlePBlocks || resolvedEnabledScreens.includes('peripheral')) {
          nextDisplays['display-2'] = {
            id: 'display-2',
            name: 'Display 2',
            dimensions: resolvedPDims,
            rotation: resolvedPRot,
            blocks: resolvedPeripheral,
            idleBlocks: resolvedIdlePeripheral,
            idleTimeoutSec: pIdleTimeout ?? get().peripheralIdleTimeoutSec,
            screenOffTimeoutSec: pScreenOffTimeout ?? get().peripheralScreenOffTimeoutSec,
            idleScreensEnabled: pIdleEnabled ?? get().peripheralIdleScreensEnabled,
          };
        }
      }

      if (metadata.shields) {
        syncStorage('zmk-loaded-shields', metadata.shields);
      }
      if (metadata.displayAssignments) {
        syncStorage('zmk-display-assignments', metadata.displayAssignments);
      }

      set((state) => ({
        displays: nextDisplays,
        loadedShields: metadata.shields ?? state.loadedShields,
        centralBlocks: cBlocks && cBlocks.length > 0 ? cBlocks : (nextDisplays['display-1']?.blocks ?? state.centralBlocks),
        peripheralBlocks: pBlocks && pBlocks.length > 0 ? pBlocks : (nextDisplays['display-2']?.blocks ?? state.peripheralBlocks),
        idleCentralBlocks: idleCBlocks && idleCBlocks.length > 0 ? idleCBlocks : (nextDisplays['display-1']?.idleBlocks ?? state.idleCentralBlocks),
        idlePeripheralBlocks: idlePBlocks && idlePBlocks.length > 0 ? idlePBlocks : (nextDisplays['display-2']?.idleBlocks ?? state.idlePeripheralBlocks),
        screenDimensions: metadata.screenDimensions ?? state.screenDimensions,
        rotation: metadata.rotation !== undefined ? metadata.rotation : state.rotation,
        peripheralRotation: pRot !== undefined ? pRot : state.peripheralRotation,
        hasUserCustomizedDimensions: metadata.screenDimensions ? true : state.hasUserCustomizedDimensions,
        widgetInstances: instMap ?? state.widgetInstances,
        idleTimeoutSec: metadata.idleTimeoutSec !== undefined ? metadata.idleTimeoutSec : state.idleTimeoutSec,
        screenOffTimeoutSec:
          metadata.screenOffTimeoutSec !== undefined ? metadata.screenOffTimeoutSec : state.screenOffTimeoutSec,
        idleScreensEnabled:
          metadata.idleScreensEnabled !== undefined ? metadata.idleScreensEnabled : state.idleScreensEnabled,
        symmetricSettings:
          metadata.symmetricSettings !== undefined ? metadata.symmetricSettings : state.symmetricSettings,
        peripheralScreenDimensions: pDims ?? state.peripheralScreenDimensions,
        peripheralIdleScreensEnabled:
          pIdleEnabled !== undefined ? pIdleEnabled : state.peripheralIdleScreensEnabled,
        peripheralIdleTimeoutSec:
          pIdleTimeout !== undefined ? pIdleTimeout : state.peripheralIdleTimeoutSec,
        peripheralScreenOffTimeoutSec:
          pScreenOffTimeout !== undefined ? pScreenOffTimeout : state.peripheralScreenOffTimeoutSec,
        peripheralScreens: metadata.peripheralScreens ?? state.peripheralScreens,
        shieldId: metadata.shieldId ?? state.shieldId,
        displayAssignments: metadata.displayAssignments ?? state.displayAssignments,
        enabledScreens: resolvedEnabledScreens,
      }));
    },

    resetLayoutDefaults: () => {
      const keysToRemove = [
        'zmk-central-blocks',
        'zmk-peripheral-blocks',
        'zmk-idle-central-blocks',
        'zmk-idle-peripheral-blocks',
        'zmk-screen-dimensions',
        'zmk-idle-screens-enabled',
        'zmk-idle-timeout-sec',
        'zmk-screen-off-timeout-sec',
        'zmk-symmetric-settings',
        'zmk-peripheral-screen-dimensions',
        'zmk-peripheral-idle-screens-enabled',
        'zmk-peripheral-idle-timeout-sec',
        'zmk-peripheral-screen-off-timeout-sec',
        'zmk-left-blocks',
        'zmk-right-blocks',
        'zmk-dongle-blocks',
        'zmk-idle-left-blocks',
        'zmk-idle-right-blocks',
        'zmk-idle-dongle-blocks',
        'zmk-dongle-screen-dimensions',
        'zmk-dongle-idle-screens-enabled',
        'zmk-dongle-idle-timeout-sec',
        'zmk-dongle-screen-off-timeout-sec',
        'zmk-right-screen-dimensions',
        'zmk-right-idle-screens-enabled',
        'zmk-right-idle-timeout-sec',
        'zmk-right-screen-off-timeout-sec',
        'zmk-screen-rotation',
        'zmk-peripheral-screen-rotation',
        'zmk-right-screen-rotation',
        'zmk-shield-id',
        'zmk-enabled-screens',
        'zmk-peripheral-screens',
        'zmk-widget-instances',
        'zmk-cleared-templates',
        'zmk_builder_cached_header',
        'zmk-customized-dimensions',
        'zmk-loaded-shields',
        'zmk-display-assignments',
      ];
      keysToRemove.forEach((k) => {
        try {
          localStorage.removeItem(k);
        } catch {}
      });

      const def = getDefaultAssets();
      const meta = def.metadata;
      const baseInstances = meta?.widgetInstances ? JSON.parse(JSON.stringify(meta.widgetInstances)) : {};
      const defaultInstances = populateDefaultWidgetInstances(baseInstances, [], def.symbolSlices);

      set({
        centralBlocks: meta?.centralBlocks ?? meta?.leftBlocks ?? [...DEFAULT_CENTRAL_LAYOUT_BLOCKS],
        peripheralBlocks: meta?.peripheralBlocks ?? meta?.rightBlocks ?? [...DEFAULT_PERIPHERAL_LAYOUT_BLOCKS],
        idleCentralBlocks: meta?.idleCentralBlocks ?? meta?.idleLeftBlocks ?? [...DEFAULT_IDLE_CENTRAL_BLOCKS],
        idlePeripheralBlocks: meta?.idlePeripheralBlocks ?? meta?.idleRightBlocks ?? [...DEFAULT_IDLE_PERIPHERAL_BLOCKS],
        screenDimensions: meta?.screenDimensions ?? { width: 32, height: 128 },
        peripheralScreenDimensions: meta?.peripheralScreenDimensions ?? meta?.rightScreenDimensions ?? { width: 32, height: 128 },
        rotation: meta?.rotation ?? getShieldDefaultRotation('corne'),
        peripheralRotation: meta?.peripheralRotation ?? meta?.rightRotation ?? getShieldDefaultRotation('corne'),
        idleScreensEnabled: meta?.idleScreensEnabled ?? true,
        peripheralIdleScreensEnabled: meta?.peripheralIdleScreensEnabled ?? true,
        idleTimeoutSec: meta?.idleTimeoutSec ?? 30,
        peripheralIdleTimeoutSec: meta?.peripheralIdleTimeoutSec ?? 30,
        screenOffTimeoutSec: meta?.screenOffTimeoutSec ?? 60,
        peripheralScreenOffTimeoutSec: meta?.peripheralScreenOffTimeoutSec ?? 60,
        symmetricSettings: meta?.symmetricSettings ?? true,
        shieldId: meta?.shieldId ?? 'corne',
        enabledScreens: meta?.enabledScreens ?? ['central', 'peripheral'],
        peripheralScreens: meta?.peripheralScreens ?? {},
        loadedShields: getShieldUnitsForShield('corne'),
        displayAssignments: meta?.displayAssignments ?? {
          corne_left: 'central',
          corne_right: 'peripheral',
        },
        hasUserCustomizedDimensions: false,
        widgetInstances: defaultInstances,
        clearedTemplates: [],
      });
    },
  };
});

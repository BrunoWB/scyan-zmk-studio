import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Plus } from 'lucide-react';
import { BwpxGrid } from '../pixel/core/PixelGrid';
import type { SpriteSlice, FontGlyph, FontCharMapping, LayoutBlock } from '../types/zmk';
import {
  DEFAULT_CENTRAL_LAYOUT_BLOCKS,
  DEFAULT_PERIPHERAL_LAYOUT_BLOCKS,
  DEFAULT_IDLE_CENTRAL_BLOCKS,
  DEFAULT_IDLE_PERIPHERAL_BLOCKS,
} from '../types/zmk';
import type { DisplayWidgetDefinition, DragWidgetState } from '../types/widget';
import { getWidgetNaturalSize, resolveWidgetInstance, normalizeWidgetType } from '../services/widgetRegistry';
import { OledPanelColumn } from './blocks/OledPanelColumn';
import { WidgetCatalogList } from './blocks/WidgetCatalogList';
import { GhostDragOverlay } from './blocks/GhostDragOverlay';
import { PlacementWarningModal, PLACEMENT_WARNING_SUPPRESS_KEYS } from './blocks/PlacementWarningModal';
import type { PlacementWarningType } from './blocks/PlacementWarningModal';
import { SideSettingsPanel } from '../components/ScreenSizePopover';
import { trackEvent } from '../services/analytics';
import { remapBlockCoordinates } from '../services/blocksLayout';
import type { PeripheralScreenData } from '../services/cHeaderParser';
import { getShieldUnitsForShield, type LoadedShieldUnit } from '../data/shieldsData';
import { useAtlasStore } from '../stores/useAtlasStore';
import { useLayoutStore } from '../stores/useLayoutStore';
import { useUiStore } from '../stores/useUiStore';

export interface BlocksTabProps {
  centralBlocks?: LayoutBlock[];
  peripheralBlocks?: LayoutBlock[];
  onCentralBlocksChange?: (blocks: LayoutBlock[]) => void;
  onPeripheralBlocksChange?: (blocks: LayoutBlock[]) => void;
  idleCentralBlocks?: LayoutBlock[];
  idlePeripheralBlocks?: LayoutBlock[];
  onIdleCentralBlocksChange?: (blocks: LayoutBlock[]) => void;
  onIdlePeripheralBlocksChange?: (blocks: LayoutBlock[]) => void;
  leftBlocks?: LayoutBlock[];
  rightBlocks?: LayoutBlock[];
  onLeftBlocksChange?: (blocks: LayoutBlock[]) => void;
  onRightBlocksChange?: (blocks: LayoutBlock[]) => void;
  idleLeftBlocks?: LayoutBlock[];
  idleRightBlocks?: LayoutBlock[];
  onIdleLeftBlocksChange?: (blocks: LayoutBlock[]) => void;
  onIdleRightBlocksChange?: (blocks: LayoutBlock[]) => void;
  peripheralScreens?: Record<string, PeripheralScreenData>;
  onPeripheralScreensChange?: (screens: Record<string, PeripheralScreenData>) => void;
  screenDimensions?: { width: number; height: number };
  onScreenDimensionsChange?: (dimensions: { width: number; height: number }) => void;
  rotation?: 0 | 90 | 180 | 270;
  onRotationChange?: (rotation: 0 | 90 | 180 | 270) => void;
  idleScreensEnabled?: boolean;
  onIdleScreensEnabledChange?: (enabled: boolean) => void;
  idleTimeoutSec?: number;
  onIdleTimeoutSecChange?: (sec: number) => void;
  screenOffTimeoutSec?: number;
  onScreenOffTimeoutSecChange?: (sec: number) => void;
  symmetricSettings?: boolean;
  onSymmetricSettingsChange?: (symmetric: boolean) => void;
  peripheralScreenDimensions?: { width: number; height: number };
  onPeripheralScreenDimensionsChange?: (dimensions: { width: number; height: number }) => void;
  peripheralRotation?: 0 | 90 | 180 | 270;
  onPeripheralRotationChange?: (rotation: 0 | 90 | 180 | 270) => void;
  peripheralIdleScreensEnabled?: boolean;
  onPeripheralIdleScreensEnabledChange?: (enabled: boolean) => void;
  peripheralIdleTimeoutSec?: number;
  onPeripheralIdleTimeoutSecChange?: (sec: number) => void;
  peripheralScreenOffTimeoutSec?: number;
  onPeripheralScreenOffTimeoutSecChange?: (sec: number) => void;
  rightScreenDimensions?: { width: number; height: number };
  onRightScreenDimensionsChange?: (dimensions: { width: number; height: number }) => void;
  rightRotation?: 0 | 90 | 180 | 270;
  onRightRotationChange?: (rotation: 0 | 90 | 180 | 270) => void;
  rightIdleScreensEnabled?: boolean;
  onRightIdleScreensEnabledChange?: (enabled: boolean) => void;
  rightIdleTimeoutSec?: number;
  onRightIdleTimeoutSecChange?: (sec: number) => void;
  rightScreenOffTimeoutSec?: number;
  onRightScreenOffTimeoutSecChange?: (sec: number) => void;
  isSettingsOpen?: boolean;
  onToggleSettings?: () => void;
  onCloseSettings?: () => void;
  isCentralSettingsOpen?: boolean;
  onToggleCentralSettings?: () => void;
  onCloseCentralSettings?: () => void;
  isPeripheralSettingsOpen?: boolean;
  onTogglePeripheralSettings?: () => void;
  onClosePeripheralSettings?: () => void;
  isLeftSettingsOpen?: boolean;
  onToggleLeftSettings?: () => void;
  onCloseLeftSettings?: () => void;
  isRightSettingsOpen?: boolean;
  onToggleRightSettings?: () => void;
  onCloseRightSettings?: () => void;
  enabledScreens?: string[];
  onEnabledScreensChange?: (screens: string[]) => void;
  onResetDefaults?: () => void;
  symbolsGrid?: BwpxGrid;
  symbolSlices?: SpriteSlice[];
  fontGrid?: BwpxGrid;
  fontGlyphs?: FontGlyph[];
  fontMappings?: FontCharMapping[];
  customText?: string;
  instances?: import('../types/widget').WidgetInstanceMap;
  onInstancesChange?: (instances: import('../types/widget').WidgetInstanceMap) => void;

  // Backwards compatibility props
  layoutBlocks?: LayoutBlock[];
  onLayoutBlocksChange?: (blocks: LayoutBlock[]) => void;
  layerNames?: string[];
  displayAssignments?: Record<string, string | null>;
  onDisplayAssignmentsChange?: (assignments: Record<string, string | null>) => void;
  loadedShields?: LoadedShieldUnit[];
  shieldId?: string;
}

export const BlocksTab: React.FC<BlocksTabProps> = ({
  centralBlocks: propsCentralBlocks,
  peripheralBlocks: propsPeripheralBlocks,
  onCentralBlocksChange: propsOnCentralBlocksChange,
  onPeripheralBlocksChange: propsOnPeripheralBlocksChange,
  idleCentralBlocks: propsIdleCentralBlocks,
  idlePeripheralBlocks: propsIdlePeripheralBlocks,
  onIdleCentralBlocksChange: propsOnIdleCentralBlocksChange,
  onIdlePeripheralBlocksChange: propsOnIdlePeripheralBlocksChange,
  leftBlocks: propsLeftBlocks,
  rightBlocks: propsRightBlocks,
  onLeftBlocksChange: propsOnLeftBlocksChange,
  onRightBlocksChange: propsOnRightBlocksChange,
  idleLeftBlocks: propsIdleLeftBlocks,
  idleRightBlocks: propsIdleRightBlocks,
  onIdleLeftBlocksChange: propsOnIdleLeftBlocksChange,
  onIdleRightBlocksChange: propsOnIdleRightBlocksChange,
  peripheralScreens: propsPeripheralScreens,
  onPeripheralScreensChange: propsOnPeripheralScreensChange,
  layerNames: propsLayerNames,
  screenDimensions: propsScreenDimensions,
  onScreenDimensionsChange: propsOnScreenDimensionsChange,
  rotation: propsRotation,
  onRotationChange: propsOnRotationChange,
  idleScreensEnabled: propsIdleScreensEnabled,
  onIdleScreensEnabledChange: propsOnIdleScreensEnabledChange,
  idleTimeoutSec: propsIdleTimeoutSec,
  onIdleTimeoutSecChange: propsOnIdleTimeoutSecChange,
  screenOffTimeoutSec: propsScreenOffTimeoutSec,
  onScreenOffTimeoutSecChange: propsOnScreenOffTimeoutSecChange,
  symmetricSettings: propsSymmetricSettings,
  onSymmetricSettingsChange: propsOnSymmetricSettingsChange,
  peripheralScreenDimensions: propsPeripheralScreenDimensions,
  onPeripheralScreenDimensionsChange: propsOnPeripheralScreenDimensionsChange,
  peripheralRotation: propsPeripheralRotation,
  onPeripheralRotationChange: propsOnPeripheralRotationChange,
  peripheralIdleScreensEnabled: propsPeripheralIdleScreensEnabled,
  onPeripheralIdleScreensEnabledChange: propsOnPeripheralIdleScreensEnabledChange,
  peripheralIdleTimeoutSec: propsPeripheralIdleTimeoutSec,
  onPeripheralIdleTimeoutSecChange: propsOnPeripheralIdleTimeoutSecChange,
  peripheralScreenOffTimeoutSec: propsPeripheralScreenOffTimeoutSec,
  onPeripheralScreenOffTimeoutSecChange: propsOnPeripheralScreenOffTimeoutSecChange,
  rightScreenDimensions: propsRightScreenDimensions,
  onRightScreenDimensionsChange: propsOnRightScreenDimensionsChange,
  rightRotation: propsRightRotation,
  onRightRotationChange: propsOnRightRotationChange,
  rightIdleScreensEnabled: propsRightIdleScreensEnabled,
  onRightIdleScreensEnabledChange: propsOnRightIdleScreensEnabledChange,
  rightIdleTimeoutSec: propsRightIdleTimeoutSec,
  onRightIdleTimeoutSecChange: propsOnRightIdleTimeoutSecChange,
  rightScreenOffTimeoutSec: propsRightScreenOffTimeoutSec,
  onRightScreenOffTimeoutSecChange: propsOnRightScreenOffTimeoutSecChange,
  isSettingsOpen,
  onToggleSettings,
  onCloseSettings,
  isCentralSettingsOpen,
  onToggleCentralSettings,
  onCloseCentralSettings,
  isPeripheralSettingsOpen,
  onTogglePeripheralSettings,
  onClosePeripheralSettings,
  isLeftSettingsOpen,
  onToggleLeftSettings,
  onCloseLeftSettings,
  isRightSettingsOpen,
  onToggleRightSettings,
  onCloseRightSettings,
  enabledScreens: propsEnabledScreens,
  onEnabledScreensChange: propsOnEnabledScreensChange,
  onResetDefaults: _onResetDefaults,
  symbolsGrid: propsSymbolsGrid,
  symbolSlices: propsSymbolSlices,
  fontGrid: propsFontGrid,
  fontGlyphs: propsFontGlyphs,
  fontMappings: propsFontMappings,
  customText: propsCustomText,
  instances: propsInstances,
  onInstancesChange: _propsOnInstancesChange,
  layoutBlocks,
  onLayoutBlocksChange,
  displayAssignments: propsDisplayAssignments,
  onDisplayAssignmentsChange: propsOnDisplayAssignmentsChange,
  loadedShields: propsLoadedShields,
  shieldId: propsShieldId,
}) => {
  const storeSymbolsGrid = useAtlasStore((s) => s.symbolsGrid);
  const storeSymbolSlices = useAtlasStore((s) => s.symbolSlices);
  const storeFontGrid = useAtlasStore((s) => s.fontGrid);
  const storeFontGlyphs = useAtlasStore((s) => s.fontGlyphs);
  const storeFontMappings = useAtlasStore((s) => s.fontMappings);
  const storeCustomText = useUiStore((s) => s.customText);

  const storeCentralBlocks = useLayoutStore((s) => s.centralBlocks);
  const storeSetCentralBlocks = useLayoutStore((s) => s.setCentralBlocks);
  const storePeripheralBlocks = useLayoutStore((s) => s.peripheralBlocks);
  const storeSetPeripheralBlocks = useLayoutStore((s) => s.setPeripheralBlocks);
  const storeIdleCentralBlocks = useLayoutStore((s) => s.idleCentralBlocks);
  const storeSetIdleCentralBlocks = useLayoutStore((s) => s.setIdleCentralBlocks);
  const storeIdlePeripheralBlocks = useLayoutStore((s) => s.idlePeripheralBlocks);
  const storeSetIdlePeripheralBlocks = useLayoutStore((s) => s.setIdlePeripheralBlocks);
  const storeScreenDimensions = useLayoutStore((s) => s.screenDimensions);
  const storeSetScreenDimensions = useLayoutStore((s) => s.handleCentralDimensionsChange);
  const storePeripheralScreenDimensions = useLayoutStore((s) => s.peripheralScreenDimensions);
  const storeSetPeripheralScreenDimensions = useLayoutStore((s) => s.handlePeripheralDimensionsChange);
  const storeRotation = useLayoutStore((s) => s.rotation);
  const storeSetRotation = useLayoutStore((s) => s.handleRotationChange);
  const storePeripheralRotation = useLayoutStore((s) => s.peripheralRotation);
  const storeSetPeripheralRotation = useLayoutStore((s) => s.handlePeripheralRotationChange);
  const storeIdleScreensEnabled = useLayoutStore((s) => s.idleScreensEnabled);
  const storeSetIdleScreensEnabled = useLayoutStore((s) => s.setIdleScreensEnabled);
  const storePeripheralIdleScreensEnabled = useLayoutStore((s) => s.peripheralIdleScreensEnabled);
  const storeSetPeripheralIdleScreensEnabled = useLayoutStore((s) => s.setPeripheralIdleScreensEnabled);
  const storeIdleTimeoutSec = useLayoutStore((s) => s.idleTimeoutSec);
  const storeSetIdleTimeoutSec = useLayoutStore((s) => s.setIdleTimeoutSec);
  const storePeripheralIdleTimeoutSec = useLayoutStore((s) => s.peripheralIdleTimeoutSec);
  const storeSetPeripheralIdleTimeoutSec = useLayoutStore((s) => s.setPeripheralIdleTimeoutSec);
  const storeScreenOffTimeoutSec = useLayoutStore((s) => s.screenOffTimeoutSec);
  const storeSetScreenOffTimeoutSec = useLayoutStore((s) => s.setScreenOffTimeoutSec);
  const storePeripheralScreenOffTimeoutSec = useLayoutStore((s) => s.peripheralScreenOffTimeoutSec);
  const storeSetPeripheralScreenOffTimeoutSec = useLayoutStore((s) => s.setPeripheralScreenOffTimeoutSec);
  const storeSymmetricSettings = useLayoutStore((s) => s.symmetricSettings);
  const storeSetSymmetricSettings = useLayoutStore((s) => s.setSymmetricSettings);
  const storeEnabledScreens = useLayoutStore((s) => s.enabledScreens);
  const storeSetEnabledScreens = useLayoutStore((s) => s.setEnabledScreens);
  const storePeripheralScreens = useLayoutStore((s) => s.peripheralScreens);
  const storeSetPeripheralScreens = useLayoutStore((s) => s.setPeripheralScreens);
  const storeLoadedShields = useLayoutStore((s) => s.loadedShields);
  const storeShieldId = useLayoutStore((s) => s.shieldId);
  const storeDisplayAssignments = useLayoutStore((s) => s.displayAssignments);
  const storeSetDisplayAssignments = useLayoutStore((s) => s.setDisplayAssignments);
  const storeWidgetInstances = useLayoutStore((s) => s.widgetInstances);
  const storeLayerNames = useLayoutStore((s) => s.keymapLayout.layerNames);
  const storeDisplays = useLayoutStore((s) => s.displays);

  const symbolsGrid = propsSymbolsGrid ?? storeSymbolsGrid;
  const symbolSlices = propsSymbolSlices ?? storeSymbolSlices;
  const fontGrid = propsFontGrid ?? storeFontGrid;
  const fontGlyphs = propsFontGlyphs ?? storeFontGlyphs;
  const fontMappings = propsFontMappings ?? storeFontMappings;
  const customText = propsCustomText ?? storeCustomText;
  const instances = propsInstances ?? storeWidgetInstances;
  const layerNames = propsLayerNames ?? storeLayerNames;
  const shieldId = propsShieldId ?? storeShieldId;
  const loadedShields = propsLoadedShields ?? storeLoadedShields;
  const displayAssignments = propsDisplayAssignments ?? storeDisplayAssignments;
  const onDisplayAssignmentsChange = propsOnDisplayAssignmentsChange ?? storeSetDisplayAssignments;

  const onCentralBlocksChange = propsOnCentralBlocksChange ?? storeSetCentralBlocks;
  const onPeripheralBlocksChange = propsOnPeripheralBlocksChange ?? storeSetPeripheralBlocks;
  const onIdleCentralBlocksChange = propsOnIdleCentralBlocksChange ?? storeSetIdleCentralBlocks;
  const onIdlePeripheralBlocksChange = propsOnIdlePeripheralBlocksChange ?? storeSetIdlePeripheralBlocks;
  const onLeftBlocksChange = propsOnLeftBlocksChange;
  const onRightBlocksChange = propsOnRightBlocksChange;
  const onIdleLeftBlocksChange = propsOnIdleLeftBlocksChange;
  const onIdleRightBlocksChange = propsOnIdleRightBlocksChange;

  const peripheralScreens = propsPeripheralScreens ?? storePeripheralScreens;
  const onPeripheralScreensChange = propsOnPeripheralScreensChange ?? storeSetPeripheralScreens;
  const screenDimensions = propsScreenDimensions ?? storeScreenDimensions;
  const onScreenDimensionsChange = propsOnScreenDimensionsChange ?? storeSetScreenDimensions;
  const rotation = propsRotation ?? storeRotation;
  const onRotationChange = propsOnRotationChange ?? storeSetRotation;
  const idleScreensEnabled = propsIdleScreensEnabled ?? storeIdleScreensEnabled;
  const onIdleScreensEnabledChange = propsOnIdleScreensEnabledChange ?? storeSetIdleScreensEnabled;
  const idleTimeoutSec = propsIdleTimeoutSec ?? storeIdleTimeoutSec;
  const onIdleTimeoutSecChange = propsOnIdleTimeoutSecChange ?? storeSetIdleTimeoutSec;
  const screenOffTimeoutSec = propsScreenOffTimeoutSec ?? storeScreenOffTimeoutSec;
  const onScreenOffTimeoutSecChange = propsOnScreenOffTimeoutSecChange ?? storeSetScreenOffTimeoutSec;
  const symmetricSettings = propsSymmetricSettings ?? storeSymmetricSettings;
  const onSymmetricSettingsChange = propsOnSymmetricSettingsChange ?? storeSetSymmetricSettings;
  const peripheralScreenDimensions = propsPeripheralScreenDimensions ?? storePeripheralScreenDimensions;
  const onPeripheralScreenDimensionsChange = propsOnPeripheralScreenDimensionsChange ?? storeSetPeripheralScreenDimensions;
  const peripheralRotation = propsPeripheralRotation ?? storePeripheralRotation;
  const onPeripheralRotationChange = propsOnPeripheralRotationChange ?? storeSetPeripheralRotation;
  const peripheralIdleScreensEnabled = propsPeripheralIdleScreensEnabled ?? storePeripheralIdleScreensEnabled;
  const onPeripheralIdleScreensEnabledChange = propsOnPeripheralIdleScreensEnabledChange ?? storeSetPeripheralIdleScreensEnabled;
  const peripheralIdleTimeoutSec = propsPeripheralIdleTimeoutSec ?? storePeripheralIdleTimeoutSec;
  const onPeripheralIdleTimeoutSecChange = propsOnPeripheralIdleTimeoutSecChange ?? storeSetPeripheralIdleTimeoutSec;
  const peripheralScreenOffTimeoutSec = propsPeripheralScreenOffTimeoutSec ?? storePeripheralScreenOffTimeoutSec;
  const onPeripheralScreenOffTimeoutSecChange = propsOnPeripheralScreenOffTimeoutSecChange ?? storeSetPeripheralScreenOffTimeoutSec;
  const rightScreenDimensions = propsRightScreenDimensions;
  const onRightScreenDimensionsChange = propsOnRightScreenDimensionsChange;
  const rightRotation = propsRightRotation;
  const onRightRotationChange = propsOnRightRotationChange;
  const rightIdleScreensEnabled = propsRightIdleScreensEnabled;
  const onRightIdleScreensEnabledChange = propsOnRightIdleScreensEnabledChange;
  const rightIdleTimeoutSec = propsRightIdleTimeoutSec;
  const onRightIdleTimeoutSecChange = propsOnRightIdleTimeoutSecChange;
  const rightScreenOffTimeoutSec = propsRightScreenOffTimeoutSec;
  const onRightScreenOffTimeoutSecChange = propsOnRightScreenOffTimeoutSecChange;
  const enabledScreens = propsEnabledScreens ?? storeEnabledScreens;
  const onEnabledScreensChange = propsOnEnabledScreensChange ?? storeSetEnabledScreens;
  const effectiveShields = useMemo<LoadedShieldUnit[]>(() => {
    if (loadedShields && loadedShields.length > 0) {
      return loadedShields;
    }
    return getShieldUnitsForShield(shieldId);
  }, [loadedShields, shieldId]);

  // Screen setup & enabled screens state
  const [localEnabledScreens, setLocalEnabledScreens] = useState<string[]>(['central', 'peripheral']);
  const effectiveEnabledScreens = (enabledScreens ?? localEnabledScreens)
    .map((s) => (s === 'left' ? 'central' : s === 'right' ? 'peripheral' : s))
    .filter((s) => s !== 'dongle');
  const handleEnabledScreensChange = onEnabledScreensChange || setLocalEnabledScreens;

  const centralShield = useMemo(() => {
    return effectiveShields.find((s) => s.isMaster || s.side === 'left') || effectiveShields[0];
  }, [effectiveShields]);

  const centralDisplayId = useMemo(() => {
    if (!centralShield) {
      return effectiveEnabledScreens.includes('central')
        ? 'central'
        : effectiveEnabledScreens.includes('left')
        ? 'left'
        : effectiveEnabledScreens[0] || null;
    }
    if (displayAssignments) {
      if (displayAssignments[centralShield.id] !== undefined) {
        return displayAssignments[centralShield.id];
      }
    }
    return effectiveEnabledScreens.includes('central')
      ? 'central'
      : effectiveEnabledScreens.includes('left')
      ? 'left'
      : null;
  }, [displayAssignments, centralShield, effectiveEnabledScreens]);

  const isCentralAttached = useMemo(() => {
    if (!centralDisplayId) return false;
    return effectiveEnabledScreens.includes(centralDisplayId);
  }, [centralDisplayId, effectiveEnabledScreens]);

  const display1 = storeDisplays['display-1'];
  const display2 = storeDisplays['display-2'];

  // Active screen blocks resolved directly from displays map when not passed via props
  const effectiveCentralBlocks = propsCentralBlocks ?? propsLeftBlocks ?? layoutBlocks ?? display1?.blocks ?? storeCentralBlocks ?? DEFAULT_CENTRAL_LAYOUT_BLOCKS;
  const effectivePeripheralBlocks = propsPeripheralBlocks ?? propsRightBlocks ?? display2?.blocks ?? storePeripheralBlocks ?? DEFAULT_PERIPHERAL_LAYOUT_BLOCKS;

  // Idle screen blocks resolved directly from displays map when not passed via props
  const effectiveIdleCentralBlocks = propsIdleCentralBlocks ?? propsIdleLeftBlocks ?? display1?.idleBlocks ?? storeIdleCentralBlocks ?? DEFAULT_IDLE_CENTRAL_BLOCKS;
  const effectiveIdlePeripheralBlocks = propsIdlePeripheralBlocks ?? propsIdleRightBlocks ?? display2?.idleBlocks ?? storeIdlePeripheralBlocks ?? DEFAULT_IDLE_PERIPHERAL_BLOCKS;

  const handleCentralBlocksChange = onCentralBlocksChange || onLeftBlocksChange || onLayoutBlocksChange;
  const handlePeripheralBlocksChange = onPeripheralBlocksChange || onRightBlocksChange;
  const handleIdleCentralBlocksChange = onIdleCentralBlocksChange || onIdleLeftBlocksChange;
  const handleIdlePeripheralBlocksChange = onIdlePeripheralBlocksChange || onIdleRightBlocksChange;

  const effectivePeripheralRotation = peripheralRotation ?? rightRotation ?? rotation;
  const handlePeripheralRotationChange = onPeripheralRotationChange ?? onRightRotationChange;

  // Dynamic peripheral screens state
  const [localPeripheralScreens, setLocalPeripheralScreens] = useState<Record<string, PeripheralScreenData>>({});
  const effectivePeripheralScreens = peripheralScreens ?? localPeripheralScreens;
  const handlePeripheralScreensChange = onPeripheralScreensChange || setLocalPeripheralScreens;

  const [internalDynamicPeripheralSettingsOpen, setInternalDynamicPeripheralSettingsOpen] = useState<Record<string, boolean>>({});

  // Independent per-screen focus mode: 'active' or 'idle' for each screen ID ('central', 'peripheral', etc.)
  const [screenModes, setScreenModes] = useState<Record<string, 'active' | 'idle'>>({});

  const [localIdleScreensEnabled, setLocalIdleScreensEnabled] = useState(true);
  const effectiveIdleScreensEnabled = idleScreensEnabled !== undefined ? idleScreensEnabled : localIdleScreensEnabled;
  const handleIdleScreensEnabledChange = onIdleScreensEnabledChange || setLocalIdleScreensEnabled;

  const [localPeripheralIdleScreensEnabled, setLocalPeripheralIdleScreensEnabled] = useState(true);
  const effectivePeripheralIdleScreensEnabled = peripheralIdleScreensEnabled !== undefined
    ? peripheralIdleScreensEnabled
    : (rightIdleScreensEnabled !== undefined ? rightIdleScreensEnabled : localPeripheralIdleScreensEnabled);
  const handlePeripheralIdleEnabledChange = onPeripheralIdleScreensEnabledChange || onRightIdleScreensEnabledChange || setLocalPeripheralIdleScreensEnabled;

  const getScreenMode = useCallback(
    (side: string): 'active' | 'idle' => {
      const normalizedSide = side === 'left' ? 'central' : side === 'right' ? 'peripheral' : side;
      if (normalizedSide === 'central' && !effectiveIdleScreensEnabled) return 'active';
      if (normalizedSide === 'peripheral' && !effectivePeripheralIdleScreensEnabled) return 'active';
      if (effectivePeripheralScreens[normalizedSide]?.idleScreensEnabled === false) return 'active';
      return screenModes[normalizedSide] ?? 'active';
    },
    [screenModes, effectiveIdleScreensEnabled, effectivePeripheralIdleScreensEnabled, effectivePeripheralScreens]
  );

  const setScreenMode = useCallback((side: string, mode: 'active' | 'idle') => {
    const normalizedSide = side === 'left' ? 'central' : side === 'right' ? 'peripheral' : side;
    setScreenModes((prev) => ({
      ...prev,
      [normalizedSide]: mode,
    }));
  }, []);

  // Independent Central & Peripheral settings state
  const [internalCentralSettingsOpen, setInternalCentralSettingsOpen] = useState(false);
  const [internalPeripheralSettingsOpen, setInternalPeripheralSettingsOpen] = useState(false);

  const effectiveCentralSettingsOpen = isCentralSettingsOpen !== undefined
    ? isCentralSettingsOpen
    : (isLeftSettingsOpen !== undefined ? isLeftSettingsOpen : (isSettingsOpen !== undefined ? isSettingsOpen : internalCentralSettingsOpen));
  const effectivePeripheralSettingsOpen = isPeripheralSettingsOpen !== undefined
    ? isPeripheralSettingsOpen
    : (isRightSettingsOpen !== undefined ? isRightSettingsOpen : internalPeripheralSettingsOpen);

  const defaultToggleCentral = useCallback(() => setInternalCentralSettingsOpen(prev => !prev), []);
  const defaultCloseCentral = useCallback(() => setInternalCentralSettingsOpen(false), []);
  const defaultTogglePeripheral = useCallback(() => setInternalPeripheralSettingsOpen(prev => !prev), []);
  const defaultClosePeripheral = useCallback(() => setInternalPeripheralSettingsOpen(false), []);

  const toggleCentralSettings = onToggleCentralSettings || onToggleLeftSettings || onToggleSettings || defaultToggleCentral;
  const closeCentralSettings = onCloseCentralSettings || onCloseLeftSettings || onCloseSettings || defaultCloseCentral;

  const togglePeripheralSettings = onTogglePeripheralSettings || onToggleRightSettings || defaultTogglePeripheral;
  const closePeripheralSettings = onClosePeripheralSettings || onCloseRightSettings || defaultClosePeripheral;

  const [localSymmetricSettings, setLocalSymmetricSettings] = useState(true);
  const effectiveSymmetricSettings = symmetricSettings !== undefined ? symmetricSettings : localSymmetricSettings;
  const handleSymmetricSettingsChange = onSymmetricSettingsChange || setLocalSymmetricSettings;

  const [localIdleTimeoutSec, setLocalIdleTimeoutSec] = useState(30);
  const effectiveIdleTimeoutSec = idleTimeoutSec !== undefined ? idleTimeoutSec : localIdleTimeoutSec;
  const handleIdleTimeoutSecChange = onIdleTimeoutSecChange || setLocalIdleTimeoutSec;

  const [localScreenOffTimeoutSec, setLocalScreenOffTimeoutSec] = useState(60);
  const effectiveScreenOffTimeoutSec = screenOffTimeoutSec !== undefined ? screenOffTimeoutSec : localScreenOffTimeoutSec;
  const handleScreenOffTimeoutSecChange = onScreenOffTimeoutSecChange || setLocalScreenOffTimeoutSec;

  // Peripheral effective settings (fallback to central when symmetric)
  const [localPeripheralScreenDimensions, setLocalPeripheralScreenDimensions] = useState(screenDimensions);
  const effectivePeripheralScreenDimensions = effectiveSymmetricSettings
    ? screenDimensions
    : (peripheralScreenDimensions ?? rightScreenDimensions ?? localPeripheralScreenDimensions);
  const handlePeripheralDimensionsChange = onPeripheralScreenDimensionsChange || onRightScreenDimensionsChange || setLocalPeripheralScreenDimensions;

  const [localPeripheralIdleTimeoutSec, setLocalPeripheralIdleTimeoutSec] = useState(30);
  const effectivePeripheralIdleTimeoutSec = effectiveSymmetricSettings
    ? effectiveIdleTimeoutSec
    : (peripheralIdleTimeoutSec !== undefined ? peripheralIdleTimeoutSec : (rightIdleTimeoutSec !== undefined ? rightIdleTimeoutSec : localPeripheralIdleTimeoutSec));
  const handlePeripheralIdleTimeoutChange = onPeripheralIdleTimeoutSecChange || onRightIdleTimeoutSecChange || setLocalPeripheralIdleTimeoutSec;

  const [localPeripheralScreenOffTimeoutSec, setLocalPeripheralScreenOffTimeoutSec] = useState(60);
  const effectivePeripheralScreenOffTimeoutSec = effectiveSymmetricSettings
    ? effectiveScreenOffTimeoutSec
    : (peripheralScreenOffTimeoutSec !== undefined ? peripheralScreenOffTimeoutSec : (rightScreenOffTimeoutSec !== undefined ? rightScreenOffTimeoutSec : localPeripheralScreenOffTimeoutSec));
  const handlePeripheralScreenOffTimeoutChange = onPeripheralScreenOffTimeoutSecChange || onRightScreenOffTimeoutSecChange || setLocalPeripheralScreenOffTimeoutSec;

  // Change handlers for Central: automatically updates Peripheral when symmetricSettings is true
  const handleCentralDimensionsChange = useCallback((dims: { width: number; height: number }) => {
    onScreenDimensionsChange?.(dims);
    if (effectiveSymmetricSettings) {
      handlePeripheralDimensionsChange(dims);
    }
  }, [onScreenDimensionsChange, effectiveSymmetricSettings, handlePeripheralDimensionsChange]);

  const handleCentralIdleEnabledChange = useCallback((enabled: boolean) => {
    handleIdleScreensEnabledChange(enabled);
  }, [handleIdleScreensEnabledChange]);

  const handleCentralIdleTimeoutChange = useCallback((sec: number) => {
    handleIdleTimeoutSecChange(sec);
    if (effectiveSymmetricSettings) {
      handlePeripheralIdleTimeoutChange(sec);
    }
  }, [handleIdleTimeoutSecChange, effectiveSymmetricSettings, handlePeripheralIdleTimeoutChange]);

  const handleCentralScreenOffTimeoutChange = useCallback((sec: number) => {
    handleScreenOffTimeoutSecChange(sec);
    if (effectiveSymmetricSettings) {
      handlePeripheralScreenOffTimeoutChange(sec);
    }
  }, [handleScreenOffTimeoutSecChange, effectiveSymmetricSettings, handlePeripheralScreenOffTimeoutChange]);

  const handleSymmetricChange = (next: boolean) => {
    handleSymmetricSettingsChange(next);
    if (next) {
      handlePeripheralDimensionsChange(screenDimensions);
      if (handlePeripheralRotationChange && rotation !== undefined) {
        handlePeripheralRotationChange(rotation);
      }
      handlePeripheralIdleTimeoutChange(effectiveIdleTimeoutSec);
      handlePeripheralScreenOffTimeoutChange(effectiveScreenOffTimeoutSec);
    }
  };

  // Display role actions: Central to Peripheral, Promotion to Central, and Deletion
  const handleMakeCentral = useCallback(
    (peripheralSide: string) => {
      const hasCentral = effectiveEnabledScreens.includes('central') || effectiveEnabledScreens.includes('left');
      if (!hasCentral) {
        // No central display exists: promote this peripheral to become Central
        if (peripheralSide === 'right' || peripheralSide === 'peripheral') {
          handleCentralBlocksChange?.(effectivePeripheralBlocks);
          handleIdleCentralBlocksChange?.(effectiveIdlePeripheralBlocks);
          onScreenDimensionsChange?.(effectivePeripheralScreenDimensions);
          if (onRotationChange && effectivePeripheralRotation !== undefined) {
            onRotationChange(effectivePeripheralRotation);
          }
          handleCentralIdleEnabledChange(effectivePeripheralIdleScreensEnabled);
          handleCentralIdleTimeoutChange(effectivePeripheralIdleTimeoutSec);
          handleCentralScreenOffTimeoutChange(effectivePeripheralScreenOffTimeoutSec);
        } else {
          const pData = effectivePeripheralScreens[peripheralSide] || {
            blocks: [...DEFAULT_PERIPHERAL_LAYOUT_BLOCKS],
            idleBlocks: [...DEFAULT_IDLE_PERIPHERAL_BLOCKS],
            screenDimensions: { width: 32, height: 128 },
            rotation: 90,
            idleScreensEnabled: true,
            idleTimeoutSec: 30,
            screenOffTimeoutSec: 60,
          };
          handleCentralBlocksChange?.(pData.blocks || []);
          handleIdleCentralBlocksChange?.(pData.idleBlocks || []);
          onScreenDimensionsChange?.(pData.screenDimensions || { width: 32, height: 128 });
          if (onRotationChange && pData.rotation !== undefined) {
            onRotationChange(pData.rotation);
          }
          handleCentralIdleEnabledChange(pData.idleScreensEnabled ?? true);
          handleCentralIdleTimeoutChange(pData.idleTimeoutSec ?? 30);
          handleCentralScreenOffTimeoutChange(pData.screenOffTimeoutSec ?? 60);

          const copy = { ...effectivePeripheralScreens };
          delete copy[peripheralSide];
          handlePeripheralScreensChange(copy);
        }

        const updatedScreens = effectiveEnabledScreens.filter((s) => s !== peripheralSide).concat('central');
        handleEnabledScreensChange(updatedScreens);
        trackEvent('promote_to_central', { from: peripheralSide });
      } else if (peripheralSide === 'right' || peripheralSide === 'peripheral') {
        // 1. Swap active blocks
        const oldCentral = [...effectiveCentralBlocks];
        const oldPeripheral = [...effectivePeripheralBlocks];
        handleCentralBlocksChange?.(oldPeripheral);
        handlePeripheralBlocksChange?.(oldCentral);

        // 2. Swap idle blocks
        const oldIdleCentral = [...effectiveIdleCentralBlocks];
        const oldIdlePeripheral = [...effectiveIdlePeripheralBlocks];
        handleIdleCentralBlocksChange?.(oldIdlePeripheral);
        handleIdlePeripheralBlocksChange?.(oldIdleCentral);

        // 3. Swap dimensions and rotation
        const oldCentralDims = { ...screenDimensions };
        const oldPeripheralDims = { ...effectivePeripheralScreenDimensions };
        onScreenDimensionsChange?.(oldPeripheralDims);
        handlePeripheralDimensionsChange(oldCentralDims);

        const oldCentralRot = rotation ?? 90;
        const oldPeripheralRot = effectivePeripheralRotation ?? 90;
        onRotationChange?.(oldPeripheralRot);
        handlePeripheralRotationChange?.(oldCentralRot);

        // 4. Swap timeouts & power settings
        const oldCentralIdleEnabled = effectiveIdleScreensEnabled;
        const oldPeripheralIdleEnabled = effectivePeripheralIdleScreensEnabled;
        handleCentralIdleEnabledChange(oldPeripheralIdleEnabled);
        handlePeripheralIdleEnabledChange(oldCentralIdleEnabled);

        const oldCentralIdleTimeout = effectiveIdleTimeoutSec;
        const oldPeripheralIdleTimeout = effectivePeripheralIdleTimeoutSec;
        handleCentralIdleTimeoutChange(oldPeripheralIdleTimeout);
        handlePeripheralIdleTimeoutChange(oldCentralIdleTimeout);

        const oldCentralOffTimeout = effectiveScreenOffTimeoutSec;
        const oldPeripheralOffTimeout = effectivePeripheralScreenOffTimeoutSec;
        handleCentralScreenOffTimeoutChange(oldPeripheralOffTimeout);
        handlePeripheralScreenOffTimeoutChange(oldCentralOffTimeout);

        trackEvent('make_master_swap', { from: 'peripheral', to: 'central' });
      } else {
        // Swap with dynamic peripheral (e.g. peripheral-2)
        const pData = effectivePeripheralScreens[peripheralSide] || {
          blocks: [...DEFAULT_PERIPHERAL_LAYOUT_BLOCKS],
          idleBlocks: [...DEFAULT_IDLE_PERIPHERAL_BLOCKS],
          screenDimensions: { width: 32, height: 128 },
          rotation: 90,
          idleScreensEnabled: true,
          idleTimeoutSec: 30,
          screenOffTimeoutSec: 60,
        };

        const oldCentral = [...effectiveCentralBlocks];
        const oldIdleCentral = [...effectiveIdleCentralBlocks];
        const oldCentralDims = { ...screenDimensions };
        const oldCentralRot = rotation ?? 90;
        const oldCentralIdleEnabled = effectiveIdleScreensEnabled;
        const oldCentralIdleTimeout = effectiveIdleTimeoutSec;
        const oldCentralOffTimeout = effectiveScreenOffTimeoutSec;

        handleCentralBlocksChange?.(pData.blocks || []);
        handleIdleCentralBlocksChange?.(pData.idleBlocks || []);
        onScreenDimensionsChange?.(pData.screenDimensions || { width: 32, height: 128 });
        onRotationChange?.(pData.rotation ?? 90);
        handleCentralIdleEnabledChange(pData.idleScreensEnabled ?? true);
        handleCentralIdleTimeoutChange(pData.idleTimeoutSec ?? 30);
        handleCentralScreenOffTimeoutChange(pData.screenOffTimeoutSec ?? 60);

        handlePeripheralScreensChange({
          ...effectivePeripheralScreens,
          [peripheralSide]: {
            ...pData,
            blocks: oldCentral,
            idleBlocks: oldIdleCentral,
            screenDimensions: oldCentralDims,
            rotation: oldCentralRot,
            idleScreensEnabled: oldCentralIdleEnabled,
            idleTimeoutSec: oldCentralIdleTimeout,
            screenOffTimeoutSec: oldCentralOffTimeout,
          },
        });

        trackEvent('make_master_swap', { from: peripheralSide, to: 'central' });
      }
    },
    [
      effectiveEnabledScreens,
      effectiveCentralBlocks,
      effectivePeripheralBlocks,
      effectiveIdleCentralBlocks,
      effectiveIdlePeripheralBlocks,
      effectivePeripheralScreens,
      screenDimensions,
      effectivePeripheralScreenDimensions,
      rotation,
      effectivePeripheralRotation,
      effectiveIdleScreensEnabled,
      effectivePeripheralIdleScreensEnabled,
      effectiveIdleTimeoutSec,
      effectivePeripheralIdleTimeoutSec,
      effectiveScreenOffTimeoutSec,
      effectivePeripheralScreenOffTimeoutSec,
      handleCentralBlocksChange,
      handlePeripheralBlocksChange,
      handleIdleCentralBlocksChange,
      handleIdlePeripheralBlocksChange,
      onScreenDimensionsChange,
      handlePeripheralDimensionsChange,
      onRotationChange,
      handlePeripheralRotationChange,
      handleCentralIdleEnabledChange,
      handlePeripheralIdleEnabledChange,
      handleCentralIdleTimeoutChange,
      handlePeripheralIdleTimeoutChange,
      handleCentralScreenOffTimeoutChange,
      handlePeripheralScreenOffTimeoutChange,
      handlePeripheralScreensChange,
      handleEnabledScreensChange,
    ]
  );

  const handleCentralToPeripheral = useCallback(() => {
    let targetSide: string;
    if (!effectiveEnabledScreens.includes('peripheral') && !effectiveEnabledScreens.includes('right')) {
      targetSide = 'peripheral';
    } else {
      let idx = 2;
      while (effectiveEnabledScreens.includes(`peripheral-${idx}`)) {
        idx++;
      }
      targetSide = `peripheral-${idx}`;
    }

    if (targetSide === 'peripheral') {
      handlePeripheralBlocksChange?.(effectiveCentralBlocks);
      handleIdlePeripheralBlocksChange?.(effectiveIdleCentralBlocks);
      handlePeripheralDimensionsChange(screenDimensions);
      handlePeripheralIdleEnabledChange(effectiveIdleScreensEnabled);
      handlePeripheralIdleTimeoutChange(effectiveIdleTimeoutSec);
      handlePeripheralScreenOffTimeoutChange(effectiveScreenOffTimeoutSec);
    } else {
      const num = targetSide.replace('peripheral-', '');
      handlePeripheralScreensChange({
        ...effectivePeripheralScreens,
        [targetSide]: {
          name: `Peripheral ${num}`,
          blocks: effectiveCentralBlocks,
          idleBlocks: effectiveIdleCentralBlocks,
          screenDimensions,
          idleScreensEnabled: effectiveIdleScreensEnabled,
          idleTimeoutSec: effectiveIdleTimeoutSec,
          screenOffTimeoutSec: effectiveScreenOffTimeoutSec,
        },
      });
    }

    const updatedScreens = effectiveEnabledScreens
      .filter((s) => s !== 'central' && s !== 'left')
      .concat(targetSide);
    handleEnabledScreensChange(updatedScreens);
    closeCentralSettings();
    trackEvent('central_to_peripheral', { targetSide });
  }, [
    effectiveEnabledScreens,
    effectiveCentralBlocks,
    effectiveIdleCentralBlocks,
    screenDimensions,
    effectiveIdleScreensEnabled,
    effectiveIdleTimeoutSec,
    effectiveScreenOffTimeoutSec,
    effectivePeripheralScreens,
    handlePeripheralBlocksChange,
    handleIdlePeripheralBlocksChange,
    handlePeripheralDimensionsChange,
    handlePeripheralIdleEnabledChange,
    handlePeripheralIdleTimeoutChange,
    handlePeripheralScreenOffTimeoutChange,
    handlePeripheralScreensChange,
    handleEnabledScreensChange,
    closeCentralSettings,
  ]);

  const handleDeleteCentral = useCallback(() => {
    if (effectiveEnabledScreens.length <= 1) return;
    const activeCentralSide = centralDisplayId || 'central';
    const updatedScreens = effectiveEnabledScreens.filter((s) => s !== activeCentralSide);
    handleEnabledScreensChange(updatedScreens);
    if (displayAssignments && centralShield) {
      onDisplayAssignmentsChange?.({ ...displayAssignments, [centralShield.id]: null });
    }
    closeCentralSettings();
    trackEvent('delete_central_display');
  }, [effectiveEnabledScreens, centralDisplayId, handleEnabledScreensChange, closeCentralSettings, displayAssignments, centralShield, onDisplayAssignmentsChange]);

  const handleAddCentral = useCallback(() => {
    if (centralShield) {
      const assigned = Object.values(displayAssignments || {}).filter(Boolean);
      const unattached = effectiveEnabledScreens.find((s) => !assigned.includes(s));
      const targetDisplayId = unattached || 'central';

      if (!effectiveEnabledScreens.includes(targetDisplayId)) {
        handleEnabledScreensChange([targetDisplayId, ...effectiveEnabledScreens]);
      }
      if (displayAssignments && onDisplayAssignmentsChange) {
        onDisplayAssignmentsChange({
          ...displayAssignments,
          [centralShield.id]: targetDisplayId,
        });
      }
      trackEvent('add_central_display');
    }
  }, [centralShield, displayAssignments, onDisplayAssignmentsChange, effectiveEnabledScreens, handleEnabledScreensChange]);

  const handleDeletePeripheral = useCallback(
    (peripheralSide: string) => {
      if (effectiveEnabledScreens.length <= 1) return;
      const updatedScreens = effectiveEnabledScreens.filter((s) => s !== peripheralSide);
      handleEnabledScreensChange(updatedScreens);
      if (peripheralSide === 'right' || peripheralSide === 'peripheral') {
        closePeripheralSettings();
      } else {
        const copy = { ...effectivePeripheralScreens };
        delete copy[peripheralSide];
        handlePeripheralScreensChange(copy);
        setInternalDynamicPeripheralSettingsOpen(prev => ({ ...prev, [peripheralSide]: false }));
      }
      trackEvent('delete_peripheral_display', { side: peripheralSide });
    },
    [effectiveEnabledScreens, effectivePeripheralScreens, handleEnabledScreensChange, handlePeripheralScreensChange, closePeripheralSettings]
  );

  const handleAddPeripheral = useCallback(() => {
    let nextSide: string;
    if (!effectiveEnabledScreens.includes('peripheral') && !effectiveEnabledScreens.includes('right')) {
      nextSide = 'peripheral';
    } else {
      let idx = 2;
      while (effectiveEnabledScreens.includes(`peripheral-${idx}`)) {
        idx++;
      }
      nextSide = `peripheral-${idx}`;
    }

    if (nextSide !== 'peripheral') {
      const num = nextSide.replace('peripheral-', '');
      const newPeripheralData: PeripheralScreenData = {
        name: `Peripheral ${num}`,
        blocks: [...DEFAULT_PERIPHERAL_LAYOUT_BLOCKS],
        idleBlocks: [...DEFAULT_IDLE_PERIPHERAL_BLOCKS],
        screenDimensions: { width: 32, height: 128 },
        idleScreensEnabled: true,
        idleTimeoutSec: 30,
        screenOffTimeoutSec: 60,
      };
      handlePeripheralScreensChange({
        ...effectivePeripheralScreens,
        [nextSide]: newPeripheralData,
      });
    }

    handleEnabledScreensChange([...effectiveEnabledScreens, nextSide]);
    trackEvent('add_peripheral_display', { side: nextSide });
  }, [effectiveEnabledScreens, effectivePeripheralScreens, handleEnabledScreensChange, handlePeripheralScreensChange]);

  // Undo history stacks (one per block list)
  const undoStacks = useMemo(() => ({
    central: [] as LayoutBlock[][],
    peripheral: [] as LayoutBlock[][],
    idleCentral: [] as LayoutBlock[][],
    idlePeripheral: [] as LayoutBlock[][],
  }), []);

  const handleCentralBlocksChangeWithUndo = useCallback((newBlocks: LayoutBlock[]) => {
    undoStacks.central.push([...effectiveCentralBlocks]);
    if (handleCentralBlocksChange) handleCentralBlocksChange(newBlocks);
  }, [effectiveCentralBlocks, handleCentralBlocksChange, undoStacks]);

  const handlePeripheralBlocksChangeWithUndo = useCallback((newBlocks: LayoutBlock[]) => {
    undoStacks.peripheral.push([...effectivePeripheralBlocks]);
    if (handlePeripheralBlocksChange) handlePeripheralBlocksChange(newBlocks);
  }, [effectivePeripheralBlocks, handlePeripheralBlocksChange, undoStacks]);

  const handleIdleCentralBlocksChangeWithUndo = useCallback((newBlocks: LayoutBlock[]) => {
    undoStacks.idleCentral.push([...effectiveIdleCentralBlocks]);
    if (handleIdleCentralBlocksChange) handleIdleCentralBlocksChange(newBlocks);
  }, [effectiveIdleCentralBlocks, handleIdleCentralBlocksChange, undoStacks]);

  const handleIdlePeripheralBlocksChangeWithUndo = useCallback((newBlocks: LayoutBlock[]) => {
    undoStacks.idlePeripheral.push([...effectiveIdlePeripheralBlocks]);
    if (handleIdlePeripheralBlocksChange) handleIdlePeripheralBlocksChange(newBlocks);
  }, [effectiveIdlePeripheralBlocks, handleIdlePeripheralBlocksChange, undoStacks]);

  // Undo handlers per panel
  const handleUndoCentral = useCallback(() => {
    const prev = undoStacks.central.pop();
    if (prev && handleCentralBlocksChange) handleCentralBlocksChange(prev);
  }, [handleCentralBlocksChange, undoStacks]);

  const handleUndoPeripheral = useCallback(() => {
    const prev = undoStacks.peripheral.pop();
    if (prev && handlePeripheralBlocksChange) handlePeripheralBlocksChange(prev);
  }, [handlePeripheralBlocksChange, undoStacks]);

  const handleUndoIdleCentral = useCallback(() => {
    const prev = undoStacks.idleCentral.pop();
    if (prev && handleIdleCentralBlocksChange) handleIdleCentralBlocksChange(prev);
  }, [handleIdleCentralBlocksChange, undoStacks]);

  const handleUndoIdlePeripheral = useCallback(() => {
    const prev = undoStacks.idlePeripheral.pop();
    if (prev && handleIdlePeripheralBlocksChange) handleIdlePeripheralBlocksChange(prev);
  }, [handleIdlePeripheralBlocksChange, undoStacks]);

  // Global Ctrl+Z handler (undoes the most recent change across all panels)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        const target = e.target as HTMLElement | null;
        if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable) return;
        e.preventDefault();
        // Find the most recently modified stack and pop it
        const stacks = [
          { list: undoStacks.central, fn: handleUndoCentral },
          { list: undoStacks.peripheral, fn: handleUndoPeripheral },
          { list: undoStacks.idleCentral, fn: handleUndoIdleCentral },
          { list: undoStacks.idlePeripheral, fn: handleUndoIdlePeripheral },
        ];
        // Pop the stack with the most entries (last changed)
        let maxStack = stacks[0];
        for (const s of stacks) {
          if (s.list.length > maxStack.list.length) maxStack = s;
        }
        if (maxStack.list.length > 0) {
          maxStack.fn();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndoCentral, handleUndoPeripheral, handleUndoIdleCentral, handleUndoIdlePeripheral, undoStacks]);

  // Unified block selection state across all displays
  const [selectedBlockSide, setSelectedBlockSide] = useState<string | null>('central');
  const [selectedBlockKind, setSelectedBlockKind] = useState<'active' | 'idle'>('active');
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(
    effectiveCentralBlocks[0]?.id || null
  );

  // Screen Clear Action Handlers
  const handleClearCentral = useCallback(() => {
    handleCentralBlocksChangeWithUndo([]);
    setSelectedBlockId(null);
  }, [handleCentralBlocksChangeWithUndo]);

  const handleClearPeripheral = useCallback(() => {
    handlePeripheralBlocksChangeWithUndo([]);
    setSelectedBlockId(null);
  }, [handlePeripheralBlocksChangeWithUndo]);

  const handleClearIdleCentral = useCallback(() => {
    handleIdleCentralBlocksChangeWithUndo([]);
    setSelectedBlockId(null);
  }, [handleIdleCentralBlocksChangeWithUndo]);

  const handleClearIdlePeripheral = useCallback(() => {
    handleIdlePeripheralBlocksChangeWithUndo([]);
    setSelectedBlockId(null);
  }, [handleIdlePeripheralBlocksChangeWithUndo]);

  const getPeripheralConfig = useCallback((side: string) => {
    if (side === 'right' || side === 'peripheral') {
      return {
        title: 'Peripheral Active',
        idleTitle: 'Peripheral Idle',
        blocks: effectivePeripheralBlocks,
        onBlocksChange: handlePeripheralBlocksChangeWithUndo,
        idleBlocks: effectiveIdlePeripheralBlocks,
        onIdleBlocksChange: handleIdlePeripheralBlocksChangeWithUndo,
        dimensions: effectivePeripheralScreenDimensions,
        onDimensionsChange: handlePeripheralDimensionsChange,
        idleEnabled: effectivePeripheralIdleScreensEnabled,
        onIdleEnabledChange: handlePeripheralIdleEnabledChange,
        idleTimeout: effectivePeripheralIdleTimeoutSec,
        onIdleTimeoutChange: handlePeripheralIdleTimeoutChange,
        screenOffTimeout: effectivePeripheralScreenOffTimeoutSec,
        onScreenOffTimeoutChange: handlePeripheralScreenOffTimeoutChange,
        isOpen: effectivePeripheralSettingsOpen,
        toggleSettings: togglePeripheralSettings,
        closeSettings: closePeripheralSettings,
        onClear: handleClearPeripheral,
        onClearIdle: handleClearIdlePeripheral,
      };
    }
    const pData = effectivePeripheralScreens[side] || {
      name: side.startsWith('peripheral-') ? `Peripheral ${side.replace('peripheral-', '')}` : side,
      blocks: [...DEFAULT_PERIPHERAL_LAYOUT_BLOCKS],
      idleBlocks: [...DEFAULT_IDLE_PERIPHERAL_BLOCKS],
      screenDimensions: { width: 32, height: 128 },
      idleScreensEnabled: true,
      idleTimeoutSec: 30,
      screenOffTimeoutSec: 60,
    };
    const pName = pData.name || (side.startsWith('peripheral-') ? `Peripheral ${side.replace('peripheral-', '')}` : side);

    const updatePeripheral = (partial: Partial<PeripheralScreenData>) => {
      handlePeripheralScreensChange({
        ...effectivePeripheralScreens,
        [side]: {
          ...pData,
          ...partial,
        },
      });
    };

    return {
      title: `${pName} Active (Peripheral)`,
      idleTitle: `${pName} Idle (Peripheral)`,
      blocks: pData.blocks ?? DEFAULT_PERIPHERAL_LAYOUT_BLOCKS,
      onBlocksChange: (newBlocks: LayoutBlock[]) => updatePeripheral({ blocks: newBlocks }),
      idleBlocks: pData.idleBlocks ?? DEFAULT_IDLE_PERIPHERAL_BLOCKS,
      onIdleBlocksChange: (newBlocks: LayoutBlock[]) => updatePeripheral({ idleBlocks: newBlocks }),
      dimensions: pData.screenDimensions ?? { width: 32, height: 128 },
      onDimensionsChange: (dims: { width: number; height: number }) => {
        const oldDims = pData.screenDimensions ?? { width: 32, height: 128 };
        const currentBlocks = pData.blocks ?? DEFAULT_PERIPHERAL_LAYOUT_BLOCKS;
        const currentIdleBlocks = pData.idleBlocks ?? DEFAULT_IDLE_PERIPHERAL_BLOCKS;
        updatePeripheral({
          screenDimensions: dims,
          blocks: remapBlockCoordinates(currentBlocks, oldDims, dims, instances),
          idleBlocks: remapBlockCoordinates(currentIdleBlocks, oldDims, dims, instances),
        });
      },
      idleEnabled: pData.idleScreensEnabled ?? true,
      onIdleEnabledChange: (enabled: boolean) => updatePeripheral({ idleScreensEnabled: enabled }),
      idleTimeout: pData.idleTimeoutSec ?? 30,
      onIdleTimeoutChange: (sec: number) => updatePeripheral({ idleTimeoutSec: sec }),
      screenOffTimeout: pData.screenOffTimeoutSec ?? 60,
      onScreenOffTimeoutChange: (sec: number) => updatePeripheral({ screenOffTimeoutSec: sec }),
      isOpen: !!internalDynamicPeripheralSettingsOpen[side],
      toggleSettings: () => setInternalDynamicPeripheralSettingsOpen(prev => ({ ...prev, [side]: !prev[side] })),
      closeSettings: () => setInternalDynamicPeripheralSettingsOpen(prev => ({ ...prev, [side]: false })),
      onClear: () => updatePeripheral({ blocks: [] }),
      onClearIdle: () => updatePeripheral({ idleBlocks: [] }),
    };
  }, [
    effectivePeripheralBlocks,
    handlePeripheralBlocksChangeWithUndo,
    effectiveIdlePeripheralBlocks,
    handleIdlePeripheralBlocksChangeWithUndo,
    effectivePeripheralScreenDimensions,
    handlePeripheralDimensionsChange,
    effectivePeripheralIdleScreensEnabled,
    handlePeripheralIdleEnabledChange,
    effectivePeripheralIdleTimeoutSec,
    handlePeripheralIdleTimeoutChange,
    effectivePeripheralScreenOffTimeoutSec,
    handlePeripheralScreenOffTimeoutChange,
    effectivePeripheralSettingsOpen,
    togglePeripheralSettings,
    closePeripheralSettings,
    handleClearPeripheral,
    handleClearIdlePeripheral,
    effectivePeripheralScreens,
    handlePeripheralScreensChange,
    instances,
    internalDynamicPeripheralSettingsOpen,
  ]);

  const getSideConfig = useCallback((side: string) => {
    if (side === 'left' || side === 'central') {
      return {
        title: 'Central Active',
        idleTitle: 'Central Idle',
        blocks: effectiveCentralBlocks,
        onBlocksChange: handleCentralBlocksChangeWithUndo,
        idleBlocks: effectiveIdleCentralBlocks,
        onIdleBlocksChange: handleIdleCentralBlocksChangeWithUndo,
        dimensions: screenDimensions,
        onDimensionsChange: handleCentralDimensionsChange,
        idleEnabled: effectiveIdleScreensEnabled,
        onIdleEnabledChange: handleCentralIdleEnabledChange,
        idleTimeout: effectiveIdleTimeoutSec,
        onIdleTimeoutChange: handleCentralIdleTimeoutChange,
        screenOffTimeout: effectiveScreenOffTimeoutSec,
        onScreenOffTimeoutChange: handleCentralScreenOffTimeoutChange,
        isOpen: effectiveCentralSettingsOpen,
        toggleSettings: toggleCentralSettings,
        closeSettings: closeCentralSettings,
        onClear: handleClearCentral,
        onClearIdle: handleClearIdleCentral,
      };
    }
    return getPeripheralConfig(side);
  }, [
    effectiveCentralBlocks,
    handleCentralBlocksChangeWithUndo,
    effectiveIdleCentralBlocks,
    handleIdleCentralBlocksChangeWithUndo,
    screenDimensions,
    handleCentralDimensionsChange,
    effectiveIdleScreensEnabled,
    handleCentralIdleEnabledChange,
    effectiveIdleTimeoutSec,
    handleCentralIdleTimeoutChange,
    effectiveScreenOffTimeoutSec,
    handleCentralScreenOffTimeoutChange,
    effectiveCentralSettingsOpen,
    toggleCentralSettings,
    closeCentralSettings,
    handleClearCentral,
    handleClearIdleCentral,
    getPeripheralConfig,
  ]);

  // Drag-and-drop state from center widget catalog to OLED panels
  const [dragState, setDragState] = useState<DragWidgetState | null>(null);

  // Unified placement warning modal (peripheral-master, idle-interactive, sync-animation)
  const [placementModalState, setPlacementModalState] = useState<{
    isOpen: boolean;
    type: PlacementWarningType;
    widgetName: string;
    blockId: string;
    side: string;
    targetMode: 'active' | 'idle';
  } | null>(null);

  const checkPlacementWarning = useCallback(
    (
      widget: DisplayWidgetDefinition,
      side: string,
      blockId: string,
      targetMode: 'active' | 'idle',
      activeInstance: { config?: { syncAnimation?: boolean } } | null | undefined,
    ) => {
      // 1. Central / Master widget placed on peripheral side
      const isPeripheral = side !== 'central' && side !== 'left';
      if (isPeripheral && widget.requiresMaster) {
        const key = PLACEMENT_WARNING_SUPPRESS_KEYS['peripheral-master'];
        const isSuppressed = typeof window !== 'undefined' && localStorage.getItem(key) === 'true';
        if (!isSuppressed) {
          setPlacementModalState({
            isOpen: true,
            type: 'peripheral-master',
            widgetName: widget.name,
            blockId,
            side,
            targetMode,
          });
          return;
        }
      }

      // 2. Active / interactive widget placed on idle screen
      if (targetMode === 'idle' && widget.isInteractive) {
        const key = PLACEMENT_WARNING_SUPPRESS_KEYS['idle-interactive'];
        const isSuppressed = typeof window !== 'undefined' && localStorage.getItem(key) === 'true';
        if (!isSuppressed) {
          setPlacementModalState({
            isOpen: true,
            type: 'idle-interactive',
            widgetName: widget.name,
            blockId,
            side,
            targetMode,
          });
          return;
        }
      }

      // 3. Split-synchronized animation uptime requirement
      if (
        (widget.id === 'animation' || normalizeWidgetType(widget.id) === 'animation') &&
        activeInstance?.config?.syncAnimation
      ) {
        const key = PLACEMENT_WARNING_SUPPRESS_KEYS['sync-animation'];
        const isSuppressed = typeof window !== 'undefined' && localStorage.getItem(key) === 'true';
        if (!isSuppressed) {
          setPlacementModalState({
            isOpen: true,
            type: 'sync-animation',
            widgetName: widget.name,
            blockId,
            side,
            targetMode,
          });
        }
      }
    },
    []
  );

  const handleDismissPlacementModal = useCallback((dontShowAgain: boolean) => {
    if (dontShowAgain && placementModalState && typeof window !== 'undefined') {
      const key = PLACEMENT_WARNING_SUPPRESS_KEYS[placementModalState.type];
      localStorage.setItem(key, 'true');
    }
    setPlacementModalState(null);
  }, [placementModalState]);

  const handleRemovePlacementWidget = useCallback(
    (dontShowAgain: boolean) => {
      if (dontShowAgain && placementModalState && typeof window !== 'undefined') {
        const key = PLACEMENT_WARNING_SUPPRESS_KEYS[placementModalState.type];
        localStorage.setItem(key, 'true');
      }
      if (placementModalState) {
        const { blockId, side, targetMode } = placementModalState;
        const cfg = getSideConfig(side);
        if (targetMode === 'active') {
          cfg.onBlocksChange(cfg.blocks.filter((b) => b.id !== blockId));
        } else {
          cfg.onIdleBlocksChange(cfg.idleBlocks.filter((b) => b.id !== blockId));
        }
        if (selectedBlockId === blockId) {
          setSelectedBlockId(null);
          setSelectedBlockSide(null);
        }
      }
      setPlacementModalState(null);
    },
    [placementModalState, getSideConfig, selectedBlockId]
  );

  // Screen DOM element registration for precise drag hit-testing
  const screenElementsRef = useRef<Record<string, HTMLDivElement | null>>({});

  const handleRegisterScreenElement = useCallback(
    (screenKey: string, el: HTMLDivElement | null) => {
      screenElementsRef.current[screenKey] = el;
    },
    []
  );

  const dragStateRef = useRef<DragWidgetState | null>(null);

  // Initiate ghost drag from center widget catalog
  const handleStartDrag = useCallback(
    (widget: DisplayWidgetDefinition, clientX: number, clientY: number) => {
      const initialDrag: DragWidgetState = {
        widget,
        clientX,
        clientY,
        targetSide: null,
        targetX: null,
        targetY: null,
      };
      dragStateRef.current = initialDrag;
      setDragState(initialDrag);
    },
    []
  );

  // Quick add helper (clicks on catalog card)
  const handleQuickAdd = useCallback(
    (widget: DisplayWidgetDefinition, side: 'central' | 'peripheral' | string) => {
      const cfg = getSideConfig(side);
      const targetMode = cfg.idleEnabled ? getScreenMode(side) : 'active';
      const targetList = targetMode === 'active' ? cfg.blocks : cfg.idleBlocks;
      const targetSideW = cfg.dimensions.width || 32;
      const targetSideH = cfg.dimensions.height || 128;

      const patchedWidget = widget as DisplayWidgetDefinition & { instanceId?: string };
      const activeInstance = resolveWidgetInstance(instances, widget.id, patchedWidget.instanceId);
      const { width: naturalW, height: naturalH } = getWidgetNaturalSize(widget, symbolSlices, activeInstance, fontGlyphs, fontMappings);

      // Find lowest occupied Y coordinate to append cleanly
      let nextY = widget.defaultPlacement.defaultY;
      const occupiedBottoms = targetList
        .filter(b => b.enabled)
        .map(b => b.y + b.height);

      if (occupiedBottoms.length > 0) {
        const maxBottom = Math.max(...occupiedBottoms);
        if (maxBottom + naturalH <= targetSideH) {
          nextY = maxBottom;
        } else {
          nextY = Math.max(0, targetSideH - naturalH);
        }
      }

      const defaultX = widget.defaultPlacement.defaultX ?? Math.max(0, Math.floor((targetSideW - naturalW) / 2));

      const newBlock: LayoutBlock = {
        id: `block-${widget.id}-${Date.now()}`,
        widgetType: widget.id,
        instanceId: patchedWidget.instanceId,
        name: widget.name,
        x: defaultX,
        y: nextY,
        width: naturalW,
        height: naturalH,
        enabled: true,
        description: widget.description,
        side,
      };

      if (targetMode === 'active') {
        cfg.onBlocksChange([...targetList, newBlock]);
      } else {
        cfg.onIdleBlocksChange([...targetList, newBlock]);
      }
      setSelectedBlockSide(side);
      setSelectedBlockKind(targetMode);
      setSelectedBlockId(newBlock.id);
      checkPlacementWarning(widget, side, newBlock.id, targetMode, activeInstance);
    },
    [getSideConfig, getScreenMode, instances, symbolSlices, fontGlyphs, fontMappings, checkPlacementWarning]
  );

  // Window listeners during active ghost drag
  const isDragging = dragState !== null;
  useEffect(() => {
    if (!isDragging) return;

    const handlePointerMove = (e: PointerEvent) => {
      const clientX = e.clientX;
      const clientY = e.clientY;

      let targetSide: string | null = null;
      let targetX: number | null = null;
      let targetY: number | null = null;

      const currentWidget = dragStateRef.current?.widget;
      if (!currentWidget) return;

      const patchedWidget = currentWidget as DisplayWidgetDefinition & { instanceId?: string };
      const activeInstance = resolveWidgetInstance(instances, currentWidget.id, patchedWidget.instanceId);
      const naturalSize = getWidgetNaturalSize(currentWidget, symbolSlices, activeInstance, fontGlyphs, fontMappings);

      const candidateSides = ['central', ...effectiveEnabledScreens.filter(s => s !== 'central' && s !== 'left')];
      for (const side of candidateSides) {
        const cfg = getSideConfig(side);
        const targetSuffix = cfg.idleEnabled ? getScreenMode(side) : 'active';
        const el = screenElementsRef.current[`${side}-${targetSuffix}`];
        if (el) {
          const rect = el.getBoundingClientRect();
          if (
            clientX >= rect.left - 40 &&
            clientX <= rect.right + 40 &&
            clientY >= rect.top - 20 &&
            clientY <= rect.bottom + 20
          ) {
            targetSide = side;
            const sideW = cfg.dimensions.width || 32;
            const sideH = cfg.dimensions.height || 128;
            const relX = Math.round(
              ((clientX - rect.left) / rect.width) * sideW - naturalSize.width / 2
            );
            const relY = Math.round(
              ((clientY - rect.top) / rect.height) * sideH - naturalSize.height / 2
            );
            targetX = Math.max(0, Math.min(sideW - naturalSize.width, relX));
            targetY = Math.max(0, Math.min(sideH - naturalSize.height, relY));
            break;
          }
        }
      }

      const updatedState: DragWidgetState = {
        widget: currentWidget,
        clientX,
        clientY,
        targetSide: targetSide as any,
        targetX,
        targetY,
      };
      dragStateRef.current = updatedState;
      setDragState(updatedState);
    };

    const handlePointerEnd = () => {
      const active = dragStateRef.current;
      if (active && active.targetSide && active.targetY !== null) {
        const side = active.targetSide;
        const patchedWidget = active.widget as DisplayWidgetDefinition & { instanceId?: string };
        const activeInstance = resolveWidgetInstance(instances, active.widget.id, patchedWidget.instanceId);
        const { width: naturalW, height: naturalH } = getWidgetNaturalSize(active.widget, symbolSlices, activeInstance, fontGlyphs, fontMappings);
        const newBlock: LayoutBlock = {
          id: `block-${active.widget.id}-${Date.now()}`,
          widgetType: active.widget.id,
          instanceId: patchedWidget.instanceId,
          name: active.widget.name,
          x: active.targetX ?? (active.widget.defaultPlacement.defaultX ?? 0),
          y: active.targetY,
          width: naturalW,
          height: naturalH,
          enabled: true,
          description: active.widget.description,
          side,
        };

        const cfg = getSideConfig(side);
        const targetMode = cfg.idleEnabled ? getScreenMode(side) : 'active';
        trackEvent('widget_added', {
          widget_type: active.widget.id,
          side,
          mode: targetMode,
        });

        if (targetMode === 'active') {
          cfg.onBlocksChange([...cfg.blocks, newBlock]);
        } else {
          cfg.onIdleBlocksChange([...cfg.idleBlocks, newBlock]);
        }
        setSelectedBlockSide(side);
        setSelectedBlockKind(targetMode);
        setSelectedBlockId(newBlock.id);
        checkPlacementWarning(active.widget, side, newBlock.id, targetMode, activeInstance);
      }

      dragStateRef.current = null;
      setDragState(null);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerEnd);
    window.addEventListener('pointercancel', handlePointerEnd);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerEnd);
      window.removeEventListener('pointercancel', handlePointerEnd);
    };
  }, [
    isDragging,
    getScreenMode,
    effectiveEnabledScreens,
    getSideConfig,
    symbolSlices,
    instances,
    fontGlyphs,
    fontMappings,
    checkPlacementWarning,
  ]);

  const totalDisplays = effectiveEnabledScreens.length;
  const isOverlaySettings = totalDisplays > 2;
  const canDeleteDisplay = totalDisplays > 1;
  const hasCentral = isCentralAttached;
  const activeCentralSide = centralDisplayId || 'central';
  const centralCfg = getSideConfig(activeCentralSide);

  const masterSettingsPanel = (isOverlay: boolean) => (
    <SideSettingsPanel
      side={activeCentralSide}
      isOpen={centralCfg.isOpen}
      onClose={centralCfg.closeSettings}
      isOverlay={isOverlay}
      screenDimensions={centralCfg.dimensions}
      onScreenDimensionsChange={centralCfg.onDimensionsChange}
      rotation={rotation}
      onRotationChange={onRotationChange}
      idleScreensEnabled={centralCfg.idleEnabled}
      onIdleScreensEnabledChange={centralCfg.onIdleEnabledChange}
      idleTimeoutSec={centralCfg.idleTimeout}
      onIdleTimeoutSecChange={centralCfg.onIdleTimeoutChange}
      screenOffTimeoutSec={centralCfg.screenOffTimeout}
      onScreenOffTimeoutSecChange={centralCfg.onScreenOffTimeoutChange}
      symmetricSettings={effectiveSymmetricSettings}
      onSymmetricSettingsChange={handleSymmetricChange}
      rightScreenDimensions={effectivePeripheralScreenDimensions}
      onRightScreenDimensionsChange={handlePeripheralDimensionsChange}
      rightRotation={effectivePeripheralRotation}
      onRightRotationChange={handlePeripheralRotationChange}
      rightIdleScreensEnabled={effectivePeripheralIdleScreensEnabled}
      onRightIdleScreensEnabledChange={handlePeripheralIdleEnabledChange}
      rightIdleTimeoutSec={effectivePeripheralIdleTimeoutSec}
      onRightIdleTimeoutSecChange={handlePeripheralIdleTimeoutChange}
      rightScreenOffTimeoutSec={effectivePeripheralScreenOffTimeoutSec}
      onRightScreenOffTimeoutSecChange={handlePeripheralScreenOffTimeoutChange}
      isPeripheral={false}
      onMakePeripheral={handleCentralToPeripheral}
      onDeleteDisplay={handleDeleteCentral}
      canDeleteDisplay={canDeleteDisplay}
    />
  );

  const peripheralSettingsPanel = (side: string, cfg: ReturnType<typeof getSideConfig>, isOverlay: boolean) => {
    return (
      <SideSettingsPanel
        side={side}
        isOpen={cfg.isOpen}
        onClose={cfg.closeSettings}
        isOverlay={isOverlay}
        screenDimensions={cfg.dimensions}
        onScreenDimensionsChange={cfg.onDimensionsChange}
        rotation={effectivePeripheralRotation}
        onRotationChange={handlePeripheralRotationChange}
        idleScreensEnabled={cfg.idleEnabled}
        onIdleScreensEnabledChange={cfg.onIdleEnabledChange}
        idleTimeoutSec={cfg.idleTimeout}
        onIdleTimeoutSecChange={cfg.onIdleTimeoutChange}
        screenOffTimeoutSec={cfg.screenOffTimeout}
        onScreenOffTimeoutSecChange={cfg.onScreenOffTimeoutChange}
        symmetricSettings={effectiveSymmetricSettings}
        onSymmetricSettingsChange={handleSymmetricChange}
        rightScreenDimensions={cfg.dimensions}
        onRightScreenDimensionsChange={cfg.onDimensionsChange}
        rightRotation={effectivePeripheralRotation}
        onRightRotationChange={handlePeripheralRotationChange}
        rightIdleScreensEnabled={cfg.idleEnabled}
        onRightIdleScreensEnabledChange={cfg.onIdleEnabledChange}
        rightIdleTimeoutSec={cfg.idleTimeout}
        onRightIdleTimeoutSecChange={cfg.onIdleTimeoutChange}
        rightScreenOffTimeoutSec={cfg.screenOffTimeout}
        onRightScreenOffTimeoutSecChange={cfg.onScreenOffTimeoutChange}
        isPeripheral={true}
        onMakeMaster={() => handleMakeCentral(side)}
        onMakeCentral={() => handleMakeCentral(side)}
        onDeleteDisplay={() => handleDeletePeripheral(side)}
        canDeleteDisplay={canDeleteDisplay}
      />
    );
  };

  const centralMode = getScreenMode(activeCentralSide);
  const centralColumnNode = (
    <React.Fragment key="master-display">
      {!isOverlaySettings && masterSettingsPanel(false)}
      <div className={`blocks-column-oled ${!centralCfg.idleEnabled ? 'idle-disabled' : centralMode === 'active' ? 'active-expanded' : 'idle-expanded'}`}>
        <OledPanelColumn
          side={activeCentralSide}
          isCentral={true}
          roleLabel="Central"
          screenKind="active"
          title="Central Active"
          subtitle="Central Host Coordinator Display"
          blocks={centralCfg.blocks}
          onBlocksChange={centralCfg.onBlocksChange}
          onClearScreen={centralCfg.onClear}
          onUndo={handleUndoCentral}
          onToggleSettings={centralCfg.toggleSettings}
          isSettingsOpen={centralCfg.isOpen}
          symbolsGrid={symbolsGrid}
          symbolSlices={symbolSlices}
          fontGrid={fontGrid}
          fontGlyphs={fontGlyphs}
          fontMappings={fontMappings}
          customText={customText}
          instances={instances}
          isDropTarget={dragState?.targetSide === activeCentralSide && (centralMode === 'active' || !centralCfg.idleEnabled)}
          dropTargetX={dragState?.targetSide === activeCentralSide ? dragState.targetX : null}
          dropTargetY={dragState?.targetSide === activeCentralSide ? dragState.targetY : null}
          draggedWidget={dragState?.widget || null}
          selectedBlockId={selectedBlockSide === activeCentralSide && selectedBlockKind === 'active' ? selectedBlockId : null}
          onSelectBlock={id => {
            setSelectedBlockSide(id ? activeCentralSide : null);
            setSelectedBlockKind('active');
            setSelectedBlockId(id);
          }}
          onRegisterScreenElement={handleRegisterScreenElement}
          screenDimensions={centralCfg.dimensions}
          layerNames={layerNames}
          isCompact={centralCfg.idleEnabled && centralMode === 'idle'}
          onExpand={() => setScreenMode(activeCentralSide, 'active')}
        />

        {centralCfg.idleEnabled && (
          <OledPanelColumn
            side={activeCentralSide}
            isCentral={true}
            roleLabel="Central"
            screenKind="idle"
            title="Central Idle"
            subtitle="Central Host Coordinator Display"
            blocks={centralCfg.idleBlocks}
            onBlocksChange={centralCfg.onIdleBlocksChange}
            onClearScreen={centralCfg.onClearIdle}
            onUndo={handleUndoIdleCentral}
            onToggleSettings={centralCfg.toggleSettings}
            isSettingsOpen={centralCfg.isOpen}
            symbolsGrid={symbolsGrid}
            symbolSlices={symbolSlices}
            fontGrid={fontGrid}
            fontGlyphs={fontGlyphs}
            fontMappings={fontMappings}
            customText={customText}
            instances={instances}
            isDropTarget={dragState?.targetSide === activeCentralSide && centralMode === 'idle'}
            dropTargetX={dragState?.targetSide === activeCentralSide ? dragState.targetX : null}
            dropTargetY={dragState?.targetSide === activeCentralSide ? dragState.targetY : null}
            draggedWidget={dragState?.widget || null}
            selectedBlockId={selectedBlockSide === activeCentralSide && selectedBlockKind === 'idle' ? selectedBlockId : null}
            onSelectBlock={id => {
              setSelectedBlockSide(id ? activeCentralSide : null);
              setSelectedBlockKind('idle');
              setSelectedBlockId(id);
            }}
            onRegisterScreenElement={handleRegisterScreenElement}
            screenDimensions={centralCfg.dimensions}
            layerNames={layerNames}
            isCompact={centralMode === 'active'}
            onExpand={() => setScreenMode(activeCentralSide, 'idle')}
          />
        )}

        {isOverlaySettings && masterSettingsPanel(true)}
      </div>
    </React.Fragment>
  );

  const renderPeripheralNode = (side: string, index: number) => {
    const cfg = getSideConfig(side);
    const sideMode = getScreenMode(side);
    const num = side.startsWith('peripheral-')
      ? side.replace('peripheral-', '')
      : (peripheralScreensList.length > 1 ? String(index + 1) : '');
    const pRoleLabel = num ? `Peripheral ${num}` : 'Peripheral';
    const pTitle = (side === 'central' || side === 'left') ? `${pRoleLabel} Active` : cfg.title;
    const pIdleTitle = (side === 'central' || side === 'left') ? `${pRoleLabel} Idle` : cfg.idleTitle;

    return (
      <React.Fragment key={side}>
        <div className={`blocks-column-oled ${!cfg.idleEnabled ? 'idle-disabled' : sideMode === 'active' ? 'active-expanded' : 'idle-expanded'}`}>
          <OledPanelColumn
            side={side}
            isCentral={false}
            roleLabel={pRoleLabel}
            screenKind="active"
            title={pTitle}
            subtitle="Peripheral Display"
            blocks={cfg.blocks}
            onBlocksChange={cfg.onBlocksChange}
            onClearScreen={cfg.onClear}
            onUndo={(side === 'peripheral' || side === 'right') ? handleUndoPeripheral : undefined}
            onToggleSettings={cfg.toggleSettings}
            isSettingsOpen={cfg.isOpen}
            symbolsGrid={symbolsGrid}
            symbolSlices={symbolSlices}
            fontGrid={fontGrid}
            fontGlyphs={fontGlyphs}
            fontMappings={fontMappings}
            customText={customText}
            instances={instances}
            isDropTarget={dragState?.targetSide === side && (sideMode === 'active' || !cfg.idleEnabled)}
            dropTargetX={dragState?.targetSide === side ? dragState.targetX : null}
            dropTargetY={dragState?.targetSide === side ? dragState.targetY : null}
            draggedWidget={dragState?.widget || null}
            selectedBlockId={selectedBlockSide === side && selectedBlockKind === 'active' ? selectedBlockId : null}
            onSelectBlock={id => {
              setSelectedBlockSide(id ? side : null);
              setSelectedBlockKind('active');
              setSelectedBlockId(id);
            }}
            onRegisterScreenElement={handleRegisterScreenElement}
            screenDimensions={cfg.dimensions}
            layerNames={layerNames}
            isCompact={cfg.idleEnabled && sideMode === 'idle'}
            onExpand={() => setScreenMode(side, 'active')}
          />

          {cfg.idleEnabled && (
            <OledPanelColumn
              side={side}
              isCentral={false}
              roleLabel={pRoleLabel}
              screenKind="idle"
              title={pIdleTitle}
              subtitle="Peripheral Display"
              blocks={cfg.idleBlocks}
              onBlocksChange={cfg.onIdleBlocksChange}
              onClearScreen={cfg.onClearIdle}
              onUndo={(side === 'peripheral' || side === 'right') ? handleUndoIdlePeripheral : undefined}
              onToggleSettings={cfg.toggleSettings}
              isSettingsOpen={cfg.isOpen}
              symbolsGrid={symbolsGrid}
              symbolSlices={symbolSlices}
              fontGrid={fontGrid}
              fontGlyphs={fontGlyphs}
              fontMappings={fontMappings}
              customText={customText}
              instances={instances}
              isDropTarget={dragState?.targetSide === side && sideMode === 'idle'}
              dropTargetX={dragState?.targetSide === side ? dragState.targetX : null}
              dropTargetY={dragState?.targetSide === side ? dragState.targetY : null}
              draggedWidget={dragState?.widget || null}
              selectedBlockId={selectedBlockSide === side && selectedBlockKind === 'idle' ? selectedBlockId : null}
              onSelectBlock={id => {
                setSelectedBlockSide(id ? side : null);
                setSelectedBlockKind('idle');
                setSelectedBlockId(id);
              }}
              onRegisterScreenElement={handleRegisterScreenElement}
              screenDimensions={cfg.dimensions}
              layerNames={layerNames}
              isCompact={sideMode === 'active'}
              onExpand={() => setScreenMode(side, 'idle')}
            />
          )}

          {isOverlaySettings && peripheralSettingsPanel(side, cfg, true)}
        </div>

        {!isOverlaySettings && peripheralSettingsPanel(side, cfg, false)}
      </React.Fragment>
    );
  };

  const catalogColumnNode = (
    <div className="blocks-column-catalog">
      <WidgetCatalogList
        symbolsGrid={symbolsGrid}
        symbolSlices={symbolSlices}
        fontGrid={fontGrid}
        fontGlyphs={fontGlyphs}
        fontMappings={fontMappings}
        customText={customText}
        instances={instances}
        onStartDrag={handleStartDrag}
        onQuickAdd={handleQuickAdd}
      />
    </div>
  );

  const addCentralButtonNode = (
    <div className="flex items-center justify-center self-stretch px-4 shrink-0">
      <button
        type="button"
        onClick={handleAddCentral}
        className="flex flex-col items-center justify-center w-28 h-64 border-2 border-dashed rounded-2xl transition-all duration-200 group border-[#1e2538] hover:border-[#00f0ff] bg-[#10141e]/50 hover:bg-[#00f0ff]/10 cursor-pointer shadow-sm hover:shadow-[0_0_16px_rgba(0,240,255,0.15)]"
        title="Add a Central display to the left"
      >
        <div className="size-10 rounded-xl flex items-center justify-center transition-all mb-2 bg-[#1e2538] group-hover:bg-[#00f0ff] text-[#64748b] group-hover:text-black shadow-sm">
          <Plus size={22} />
        </div>
        <span className="text-xs font-bold transition-colors text-[#94a3b8] group-hover:text-[#00f0ff]">
          Add Display
        </span>
        <span className="text-[10px] font-mono text-[#64748b] mt-0.5">
          (Central)
        </span>
      </button>
    </div>
  );

  const addButtonNode = (
    <div className="flex items-center justify-center self-stretch px-4 shrink-0">
      <button
        type="button"
        onClick={handleAddPeripheral}
        className="flex flex-col items-center justify-center w-28 h-64 border-2 border-dashed rounded-2xl transition-all duration-200 group border-[#1e2538] hover:border-[#00f0ff] bg-[#10141e]/50 hover:bg-[#00f0ff]/10 cursor-pointer shadow-sm hover:shadow-[0_0_16px_rgba(0,240,255,0.15)]"
        title="Add a new peripheral display to the right"
      >
        <div className="size-10 rounded-xl flex items-center justify-center transition-all mb-2 bg-[#1e2538] group-hover:bg-[#00f0ff] text-[#64748b] group-hover:text-black shadow-sm">
          <Plus size={22} />
        </div>
        <span className="text-xs font-bold transition-colors text-[#94a3b8] group-hover:text-[#00f0ff]">
          Add Display
        </span>
        <span className="text-[10px] font-mono text-[#64748b] mt-0.5">
          (Peripheral)
        </span>
      </button>
    </div>
  );

  const peripheralScreensList = effectiveEnabledScreens.filter((s) => s !== activeCentralSide);

  return (
    <div className="blocks-tab-wrapper">
      <div className="blocks-tab-container">
        {/* Ghost Drag Floating Overlay attached to cursor */}
        {dragState && (
          <GhostDragOverlay
            dragState={dragState}
            symbolsGrid={symbolsGrid}
            symbolSlices={symbolSlices}
            fontGrid={fontGrid}
            fontGlyphs={fontGlyphs}
            fontMappings={fontMappings}
            customText={customText}
            instances={instances}
          />
        )}

        {/* Placement Warning Modal (Peripheral Master / Idle-Interactive / Sync-Animation) */}
        {placementModalState && (
          <PlacementWarningModal
            isOpen={placementModalState.isOpen}
            type={placementModalState.type}
            widgetName={placementModalState.widgetName}
            onDismiss={handleDismissPlacementModal}
            onRemove={handleRemovePlacementWidget}
          />
        )}

        {/* 1. Central Display on the LEFT of widgets (or Add Central Button if none) */}
        {hasCentral ? centralColumnNode : addCentralButtonNode}

        {/* 2. Widgets Catalog in the CENTER */}
        {catalogColumnNode}

        {/* 3. Peripherals on the RIGHT of widgets */}
        {peripheralScreensList.map((side, idx) => renderPeripheralNode(side, idx))}

        {/* 4. Add Peripheral Display Button */}
        {addButtonNode}
      </div>
    </div>
  );
};

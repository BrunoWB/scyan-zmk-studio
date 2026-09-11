import type { BwpxGrid } from '../bwpx/core/BwpxGrid';
import type { SpriteSlice, FontGlyph, FontCharMapping } from './zmk';

export type WidgetCategory = 'status' | 'typing' | 'layer' | 'branding' | 'art';

export type SlotSourceType = 'symbol' | 'text';

export type WidgetMode = 'symbol' | 'font';

export interface WidgetInstanceConfig {
  mode: WidgetMode;
  fontSize?: 'small' | 'big';     // Font size: 'small' (default) or 'big'
  groupId?: string;               // For single group selection
  groupIds?: string[];            // For multi-group selection
  textEntries?: string[];         // Text values for 1, 2, 6, or N divisions
  fontDivisionCount?: number;     // For sliders
  targetValue?: number;           // e.g. Target WPM
  wpmChart?: {
    width: number;
    height: number;
    gridSize: number;
    targetSpeed: number;
    timeWindow?: number;
  };
  bongoTapMs?: number;            // Tap duration in ms, matching CONFIG_SCYAN_BONGO_TAP_MS (default 60)
  bongoDebounceMs?: number;       // Debounce interval in ms (default 100)
  loopSpeedMs?: number;           // Animation frame duration in ms for Animation widget (default 250)
  loop?: boolean;                  // Whether animation loops indefinitely (default true) or stops at the last frame
}

export interface WidgetSlotDefinition {
  id: string;
  name: string;
  description: string;
  supportedModes: SlotSourceType[];
  defaultMode: SlotSourceType;
  defaultSymbolId?: string;
  defaultText?: string;
  fallbackText?: string;
  allowTemplateVars?: boolean;
  maxTextLength?: number;
}

export interface WidgetSlotConfig {
  mode: SlotSourceType;
  symbolId?: string;
  text?: string;
}

export interface WidgetInstance {
  id: string;          // unique instance ID
  widgetTypeId: string; // references WIDGET_REGISTRY entry
  label: string;       // user-editable label
  config: WidgetInstanceConfig;
  slots?: Record<string, WidgetSlotConfig>; // legacy
}

export type WidgetInstanceMap = Record<string, WidgetInstance[]>; // widgetTypeId -> instances[]

export type ClearedTemplateSet = string[];

export function resolveInstanceCustomizations(
  instances: WidgetInstanceMap,
  widgetTypeId: string,
  instanceId?: string
): Record<string, WidgetSlotConfig> | undefined {
  if (!instanceId || !instances[widgetTypeId]) {
    return undefined;
  }
  const instance = instances[widgetTypeId].find(inst => inst.id === instanceId);
  return instance?.slots;
}
export type WidgetCustomizationMap = Record<string, Record<string, WidgetSlotConfig>>;

export interface WidgetRenderContext {
  symbolsGrid: BwpxGrid;
  symbolSlices: SpriteSlice[];
  fontGrid: BwpxGrid;
  fontGlyphs?: FontGlyph[];
  fontMappings?: FontCharMapping[];
  battery?: number; // 0-100
  charging?: boolean;
  outputMode?: 'usb' | 'ble';
  bleProfileIndex?: number; // 0: no connection, 1-5: profiles P1-P5
  currentLayer?: number;
  layerNames?: string[];
  wpm?: number;
  wpmHistory?: number[]; // Rolling samples over time (oldest to newest, or chronological)
  splitConnected?: boolean;
  capsLock?: boolean;
  customText?: string;
  side?: 'left' | 'right';
  isIdle?: boolean;
  instances?: WidgetInstanceMap;
  activeInstanceId?: string;
  customizations?: WidgetCustomizationMap;
  bongoState?: 0 | 1 | 2; // 0: idle/neutral, 1: tap left, 2: tap right
  animationTimestamp?: number; // Timestamp in ms for time-based animation widgets (e.g. Loop)
  blockWidth?: number;
  blockHeight?: number;
}

export interface DisplayWidgetDefinition {
  id: string; // e.g. 'status-bar', 'battery', 'connection', 'split', 'layer-banner', 'layer-art', 'branding', 'wpm', etc.
  name: string;
  category: WidgetCategory;
  tier: 1 | 2 | 3;
  requiresMaster?: boolean;
  description: string;
  defaultWidth: number;
  minWidth: number;
  maxWidth: number;
  defaultHeight: number;
  minHeight: number;
  maxHeight: number;
  icon: string; // Lucide icon identifier
  associatedSliceIds: string[];
  slots: WidgetSlotDefinition[];
  defaultPlacement: {
    side: 'left' | 'right' | 'both';
    defaultX?: number;
    defaultY: number;
  };
  render: (
    grid: BwpxGrid,
    destX: number,
    destY: number,
    context: WidgetRenderContext
  ) => void;
}

export interface DragWidgetState {
  widget: DisplayWidgetDefinition;
  clientX: number;
  clientY: number;
  targetSide: 'left' | 'right' | null;
  targetX: number | null;
  targetY: number | null;
}


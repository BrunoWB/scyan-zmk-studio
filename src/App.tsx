import { useState, useEffect, useCallback, useRef } from 'react';
import { BwpxGrid } from './bwpx/core/BwpxGrid';
import type {
  SpriteSlice,
  FontGlyph,
  FontCharMapping,
  LayoutBlock,
} from './types/zmk';
import type { WidgetInstanceMap, WidgetInstance } from './types/widget';
import { WIDGET_REGISTRY } from './services/widgetRegistry';
import {
  DEFAULT_LEFT_LAYOUT_BLOCKS,
  DEFAULT_RIGHT_LAYOUT_BLOCKS,
} from './types/zmk';
import {
  parseCHeader,
  generateCHeader,
  getDefaultAssets,
  type HeaderMetadata,
  type ParsedAssets,
} from './services/cHeaderParser';
import {
  type ParsedKeymapLayout,
  DEFAULT_EMPTY_5X3_LAYOUT,
  fetchRepoKeymap,
  parseZmkKeymap,
} from './services/keymapService';
import type {
  GitHubRepoConfig,
  GitHubConnectionState,
} from './services/githubService';
import {
  getStoredGitHubConfig,
  saveStoredGitHubConfig,
  fetchFileFromRepo,
  commitStudioSaveToRepo,
  verifyGitHubConnection,
  clearStoredGitHubToken,
  checkRepoPrerequisites,
  installScyanStudioToRepo,
  uninstallScyanStudioFromRepo,
  type RepoPrerequisites,
} from './services/githubService';
import { trackEvent } from './services/analytics';
import { HeaderBar } from './components/HeaderBar';
import { OledPreviewTab } from './tabs/OledPreviewTab';
import { SymbolsAtlasTab } from './tabs/SymbolsAtlasTab';
import { FontAtlasTab } from './tabs/FontAtlasTab';
import { WidgetsTab } from './tabs/WidgetsTab';
import { BlocksTab } from './tabs/BlocksTab';
import ElementReferencePage from './reference/ElementReferencePage';
import CommandPalette from './reference/components/layout/CommandPalette';
import {
  MonitorPlay,
  Shapes,
  Type,
  Component,
  Columns2,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Unplug,
  Palette,
} from 'lucide-react';
import './App.css';

const VALID_TABS = ['preview', 'symbols', 'font', 'widgets', 'layout', 'blocks', 'reference', 'ui-elements', 'ui-elements-hero'] as const;
type TabType = typeof VALID_TABS[number];

const getTabFromHash = (): TabType => {
  const path = window.location.pathname.replace(/^\//, '').toLowerCase().trim();
  if (import.meta.env.DEV && (path === 'ui-elements' || path === 'elements' || path === 'reference' || path === 'hero' || path === 'heroui')) {
    return 'reference';
  }
  const hash = window.location.hash.replace(/^#/, '').toLowerCase().trim();
  if (hash === 'reference' && !import.meta.env.DEV) {
    return 'preview';
  }
  if (hash === 'blocks') {
    return 'layout';
  }
  if (VALID_TABS.includes(hash as TabType)) {
    return hash as TabType;
  }
  if (import.meta.env.DEV && (hash === 'ui-elements-hero' || hash === 'hero' || hash === 'heroui' || hash === 'elements' || hash === 'ui-elements')) {
    return 'reference';
  }
  return 'preview';
};

const cloneParsedAssets = (assets: ParsedAssets): ParsedAssets => ({
  symbolsGrid: assets.symbolsGrid.clone(),
  symbolSlices: JSON.parse(JSON.stringify(assets.symbolSlices)),
  fontGrid: assets.fontGrid.clone(),
  fontGlyphs: JSON.parse(JSON.stringify(assets.fontGlyphs)),
  fontMappings: JSON.parse(JSON.stringify(assets.fontMappings || [])),
  metadata: assets.metadata ? JSON.parse(JSON.stringify(assets.metadata)) : undefined,
});

export function App() {
  // Navigation Tab: initialized and tracked via URL hash (#preview, #symbols, etc.)
  const [activeTab, setActiveTab] = useState<TabType>(() => getTabFromHash());
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

  // Loading overlay state: keep true until repository data (or defaults fallback) is loaded
  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(true);

  // Snapshot of initially loaded assets (for Restore to Initial Values)
  const initialAssetsRef = useRef<ParsedAssets | null>(null);

  // Core Bitmaps & Descriptors (initialized directly from canonical scyan_assets.install.h)
  const [symbolsGrid, setSymbolsGrid] = useState<BwpxGrid>(() => getDefaultAssets().symbolsGrid);
  const [symbolSlices, setSymbolSlices] = useState<SpriteSlice[]>(() => getDefaultAssets().symbolSlices);
  const [fontGrid, setFontGrid] = useState<BwpxGrid>(() => getDefaultAssets().fontGrid);
  const [fontGlyphs, setFontGlyphs] = useState<FontGlyph[]>(() => getDefaultAssets().fontGlyphs);
  const [fontMappings, setFontMappings] = useState<FontCharMapping[]>(() => getDefaultAssets().fontMappings);
  const [leftBlocks, setLeftBlocks] = useState<LayoutBlock[]>(() => {
    try {
      const saved = localStorage.getItem('zmk-left-blocks');
      if (saved) return JSON.parse(saved);
    } catch {}
    const def = getDefaultAssets();
    return def.metadata?.leftBlocks?.length ? def.metadata.leftBlocks : [...DEFAULT_LEFT_LAYOUT_BLOCKS];
  });
  const [rightBlocks, setRightBlocks] = useState<LayoutBlock[]>(() => {
    try {
      const saved = localStorage.getItem('zmk-right-blocks');
      if (saved) return JSON.parse(saved);
    } catch {}
    const def = getDefaultAssets();
    return def.metadata?.rightBlocks?.length ? def.metadata.rightBlocks : [...DEFAULT_RIGHT_LAYOUT_BLOCKS];
  });
  const [idleLeftBlocks, setIdleLeftBlocks] = useState<LayoutBlock[]>(() => {
    try {
      const saved = localStorage.getItem('zmk-idle-left-blocks');
      if (saved) return JSON.parse(saved);
    } catch {}
    const def = getDefaultAssets();
    return def.metadata?.idleLeftBlocks?.length ? def.metadata.idleLeftBlocks : [
      { id: 'idle-left-art', widgetType: 'screensaver', name: 'Mascot Image', x: 3, y: 35, width: 26, height: 26, enabled: true, side: 'left' }
    ];
  });
  const [idleRightBlocks, setIdleRightBlocks] = useState<LayoutBlock[]>(() => {
    try {
      const saved = localStorage.getItem('zmk-idle-right-blocks');
      if (saved) return JSON.parse(saved);
    } catch {}
    const def = getDefaultAssets();
    return def.metadata?.idleRightBlocks?.length ? def.metadata.idleRightBlocks : [
      { id: 'idle-right-art', widgetType: 'screensaver', name: 'Mascot Image', x: 3, y: 35, width: 26, height: 26, enabled: true, side: 'right' }
    ];
  });
  const [screenDimensions, setScreenDimensions] = useState<{ width: number; height: number }>(() => {
    try {
      const saved = localStorage.getItem('zmk-screen-dimensions');
      if (saved) return JSON.parse(saved);
    } catch {}
    const def = getDefaultAssets();
    return def.metadata?.screenDimensions || { width: 32, height: 128 };
  });

  const [idleScreensEnabled, setIdleScreensEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('zmk-idle-screens-enabled');
      if (saved !== null) return JSON.parse(saved);
    } catch {}
    const def = getDefaultAssets();
    return def.metadata?.idleScreensEnabled ?? true;
  });

  const [idleTimeoutSec, setIdleTimeoutSec] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('zmk-idle-timeout-sec');
      if (saved) return JSON.parse(saved);
    } catch {}
    const def = getDefaultAssets();
    return def.metadata?.idleTimeoutSec ?? 30;
  });

  const [screenOffTimeoutSec, setScreenOffTimeoutSec] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('zmk-screen-off-timeout-sec');
      if (saved) return JSON.parse(saved);
    } catch {}
    const def = getDefaultAssets();
    return def.metadata?.screenOffTimeoutSec ?? 60;
  });

  const [symmetricSettings, setSymmetricSettings] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('zmk-symmetric-settings');
      if (saved !== null) return JSON.parse(saved);
    } catch {}
    const def = getDefaultAssets();
    return def.metadata?.symmetricSettings ?? true;
  });

  const [rightScreenDimensions, setRightScreenDimensions] = useState<{ width: number; height: number }>(() => {
    try {
      const saved = localStorage.getItem('zmk-right-screen-dimensions');
      if (saved) return JSON.parse(saved);
    } catch {}
    const def = getDefaultAssets();
    return def.metadata?.rightScreenDimensions || def.metadata?.screenDimensions || { width: 32, height: 128 };
  });

  const [rightIdleScreensEnabled, setRightIdleScreensEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('zmk-right-idle-screens-enabled');
      if (saved !== null) return JSON.parse(saved);
    } catch {}
    const def = getDefaultAssets();
    return def.metadata?.rightIdleScreensEnabled ?? def.metadata?.idleScreensEnabled ?? true;
  });

  const [rightIdleTimeoutSec, setRightIdleTimeoutSec] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('zmk-right-idle-timeout-sec');
      if (saved) return JSON.parse(saved);
    } catch {}
    const def = getDefaultAssets();
    return def.metadata?.rightIdleTimeoutSec ?? def.metadata?.idleTimeoutSec ?? 30;
  });

  const [rightScreenOffTimeoutSec, setRightScreenOffTimeoutSec] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('zmk-right-screen-off-timeout-sec');
      if (saved) return JSON.parse(saved);
    } catch {}
    const def = getDefaultAssets();
    return def.metadata?.rightScreenOffTimeoutSec ?? def.metadata?.screenOffTimeoutSec ?? 60;
  });

  useEffect(() => {
    try {
      localStorage.setItem('zmk-idle-screens-enabled', JSON.stringify(idleScreensEnabled));
    } catch {}
  }, [idleScreensEnabled]);

  useEffect(() => {
    try {
      localStorage.setItem('zmk-left-blocks', JSON.stringify(leftBlocks));
    } catch {}
  }, [leftBlocks]);

  useEffect(() => {
    try {
      localStorage.setItem('zmk-right-blocks', JSON.stringify(rightBlocks));
    } catch {}
  }, [rightBlocks]);

  useEffect(() => {
    try {
      localStorage.setItem('zmk-idle-left-blocks', JSON.stringify(idleLeftBlocks));
    } catch {}
  }, [idleLeftBlocks]);

  useEffect(() => {
    try {
      localStorage.setItem('zmk-idle-right-blocks', JSON.stringify(idleRightBlocks));
    } catch {}
  }, [idleRightBlocks]);

  useEffect(() => {
    try {
      localStorage.setItem('zmk-screen-dimensions', JSON.stringify(screenDimensions));
    } catch {}
  }, [screenDimensions]);

  useEffect(() => {
    try {
      localStorage.setItem('zmk-idle-timeout-sec', JSON.stringify(idleTimeoutSec));
    } catch {}
  }, [idleTimeoutSec]);

  useEffect(() => {
    try {
      localStorage.setItem('zmk-screen-off-timeout-sec', JSON.stringify(screenOffTimeoutSec));
    } catch {}
  }, [screenOffTimeoutSec]);

  useEffect(() => {
    try {
      localStorage.setItem('zmk-symmetric-settings', JSON.stringify(symmetricSettings));
    } catch {}
  }, [symmetricSettings]);

  useEffect(() => {
    try {
      localStorage.setItem('zmk-right-screen-dimensions', JSON.stringify(rightScreenDimensions));
    } catch {}
  }, [rightScreenDimensions]);

  useEffect(() => {
    try {
      localStorage.setItem('zmk-right-idle-screens-enabled', JSON.stringify(rightIdleScreensEnabled));
    } catch {}
  }, [rightIdleScreensEnabled]);

  useEffect(() => {
    try {
      localStorage.setItem('zmk-right-idle-timeout-sec', JSON.stringify(rightIdleTimeoutSec));
    } catch {}
  }, [rightIdleTimeoutSec]);

  useEffect(() => {
    try {
      localStorage.setItem('zmk-right-screen-off-timeout-sec', JSON.stringify(rightScreenOffTimeoutSec));
    } catch {}
  }, [rightScreenOffTimeoutSec]);

  const [customText, setCustomText] = useState<string>('BRUNOWB');
  const [_clearedTemplates, setClearedTemplates] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('zmk-cleared-templates');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });

  const [widgetInstances, setWidgetInstances] = useState<WidgetInstanceMap>(() => {
    let savedInstances: WidgetInstanceMap = {};
    try {
      const saved = localStorage.getItem('zmk-widget-instances');
      if (saved) {
        savedInstances = JSON.parse(saved);
      } else {
        const def = getDefaultAssets();
        if (def.metadata?.widgetInstances) {
          savedInstances = JSON.parse(JSON.stringify(def.metadata.widgetInstances));
        }
      }
    } catch {}
    
    // Auto-populate defaults for templates that aren't in savedInstances AND aren't cleared
    const defaults: WidgetInstanceMap = { ...savedInstances };
    let clearedStr = localStorage.getItem('zmk-cleared-templates');
    let clearedSet = new Set<string>();
    if (clearedStr) {
      try { clearedSet = new Set(JSON.parse(clearedStr)); } catch {}
    }

    if (savedInstances['loop'] && !defaults['animation']) {
      defaults['animation'] = savedInstances['loop'].map(i => ({ ...i, widgetTypeId: 'animation' }));
    } else if (savedInstances['animation'] && !defaults['loop']) {
      defaults['loop'] = savedInstances['animation'].map(i => ({ ...i, widgetTypeId: 'loop' }));
    }

    WIDGET_REGISTRY.forEach(w => {
      const shouldAutoPopulate = w.id === 'wpm-chart' || w.id === 'animation' || w.id === 'loop' || (w.associatedSliceIds && w.associatedSliceIds.length > 0);
      if (!defaults[w.id] && !clearedSet.has(w.id) && shouldAutoPopulate) {
        let initialConfig: import('./types/widget').WidgetInstanceConfig = { mode: 'symbol' };
        if (w.id === 'branding') {
          initialConfig = { mode: 'font', fontSize: 'small', textEntries: ['ZMK'] };
        } else if (w.id === 'wpm-chart') {
          initialConfig = { mode: 'symbol', wpmChart: { width: 32, height: 24, gridSize: 4, targetSpeed: 100 } };
        } else if (w.id === 'connection') {
          initialConfig = {
            mode: 'symbol',
            groupId: 'SYMBOL_USB',
            groupIds: [
              'SYMBOL_BLUETOOTH',
              'SYMBOL_BLUETOOTH',
              'SYMBOL_BLUETOOTH',
              'SYMBOL_BLUETOOTH',
              'SYMBOL_BLUETOOTH',
              'SYMBOL_BLUETOOTH',
            ],
            textEntries: ['USB', 'No conn', 'P1', 'P2', 'P3', 'P4', 'P5'],
          };
        } else if (w.id === 'bongo') {
          const bongoSlice = (symbolSlices || []).find(s =>
            s.id.toUpperCase().includes('BONGO') ||
            s.groupId.toUpperCase().includes('BONGO') ||
            s.id.startsWith('SYMBOL_SLICE_40_4046')
          );
          initialConfig = {
            mode: 'symbol',
            groupId: bongoSlice?.groupId || 'SYMBOL_SLICE_40_4046',
            textEntries: ['(=^.^=)'],
            bongoTapMs: 60,
            bongoDebounceMs: 100,
          };
        } else if (w.id === 'animation' || w.id === 'loop') {
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
          return;
        }

        const inst: WidgetInstance = {
          id: `w_${Math.random().toString(36).substr(2, 6)}`,
          widgetTypeId: w.id,
          label: `${w.name}`,
          config: initialConfig,
          slots: {}
        };
        w.slots.forEach(slot => {
          if (slot.defaultSymbolId || slot.defaultText) {
            if (!inst.slots) inst.slots = {};
            inst.slots[slot.id] = {
              mode: slot.defaultMode,
              symbolId: slot.defaultSymbolId,
              text: slot.defaultText
            };
          }
        });
        defaults[w.id] = [inst];
      }
    });
 
    if (defaults['animation'] && !defaults['loop']) {
      defaults['loop'] = defaults['animation'].map(i => ({ ...i, widgetTypeId: 'loop' }));
    } else if (defaults['loop'] && !defaults['animation']) {
      defaults['animation'] = defaults['loop'].map(i => ({ ...i, widgetTypeId: 'animation' }));
    }

    if (defaults['ble-profile']) {
      delete defaults['ble-profile'];
    }
    return defaults;
  });

  const handleInstancesChange = useCallback((newInstances: WidgetInstanceMap) => {
    setWidgetInstances(prev => {
      // Find templates that went from having instances to having 0 instances
      const newlyCleared = Object.keys(prev).filter(
        typeId => prev[typeId].length > 0 && (!newInstances[typeId] || newInstances[typeId].length === 0)
      );
      
      if (newlyCleared.length > 0) {
        setClearedTemplates(prevCleared => {
          const nextCleared = Array.from(new Set([...prevCleared, ...newlyCleared]));
          localStorage.setItem('zmk-cleared-templates', JSON.stringify(nextCleared));
          return nextCleared;
        });
      }
      return newInstances;
    });
    
    try {
      localStorage.setItem('zmk-widget-instances', JSON.stringify(newInstances));
    } catch (e) {
      console.error('Failed to save instances to localStorage', e);
    }
  }, []);

  const applyParsedAssets = useCallback((parsed: ParsedAssets) => {
    setSymbolsGrid(parsed.symbolsGrid);
    setSymbolSlices(parsed.symbolSlices);
    setFontGrid(parsed.fontGrid);
    setFontGlyphs(parsed.fontGlyphs);
    if (parsed.fontMappings && parsed.fontMappings.length > 0) {
      setFontMappings(parsed.fontMappings);
    }
    if (parsed.metadata) {
      if (parsed.metadata.leftBlocks && parsed.metadata.leftBlocks.length > 0) {
        setLeftBlocks(parsed.metadata.leftBlocks);
      }
      if (parsed.metadata.rightBlocks && parsed.metadata.rightBlocks.length > 0) {
        setRightBlocks(parsed.metadata.rightBlocks);
      }
      if (parsed.metadata.idleLeftBlocks && parsed.metadata.idleLeftBlocks.length > 0) {
        setIdleLeftBlocks(parsed.metadata.idleLeftBlocks);
      }
      if (parsed.metadata.idleRightBlocks && parsed.metadata.idleRightBlocks.length > 0) {
        setIdleRightBlocks(parsed.metadata.idleRightBlocks);
      }
      if (parsed.metadata.screenDimensions) {
        setScreenDimensions(parsed.metadata.screenDimensions);
      }
      if (parsed.metadata.widgetInstances) {
        const instMap = { ...parsed.metadata.widgetInstances };
        if (instMap['loop'] && !instMap['animation']) {
          instMap['animation'] = instMap['loop'].map(i => ({ ...i, widgetTypeId: 'animation' }));
        } else if (instMap['animation'] && !instMap['loop']) {
          instMap['loop'] = instMap['animation'].map(i => ({ ...i, widgetTypeId: 'loop' }));
        }
        setWidgetInstances(instMap);
      }
      if (parsed.metadata.idleTimeoutSec !== undefined) {
        setIdleTimeoutSec(parsed.metadata.idleTimeoutSec);
      }
      if (parsed.metadata.screenOffTimeoutSec !== undefined) {
        setScreenOffTimeoutSec(parsed.metadata.screenOffTimeoutSec);
      }
      if (parsed.metadata.idleScreensEnabled !== undefined) {
        setIdleScreensEnabled(parsed.metadata.idleScreensEnabled);
      }
      if (parsed.metadata.symmetricSettings !== undefined) {
        setSymmetricSettings(parsed.metadata.symmetricSettings);
      }
      if (parsed.metadata.rightScreenDimensions) {
        setRightScreenDimensions(parsed.metadata.rightScreenDimensions);
      }
      if (parsed.metadata.rightIdleScreensEnabled !== undefined) {
        setRightIdleScreensEnabled(parsed.metadata.rightIdleScreensEnabled);
      }
      if (parsed.metadata.rightIdleTimeoutSec !== undefined) {
        setRightIdleTimeoutSec(parsed.metadata.rightIdleTimeoutSec);
      }
      if (parsed.metadata.rightScreenOffTimeoutSec !== undefined) {
        setRightScreenOffTimeoutSec(parsed.metadata.rightScreenOffTimeoutSec);
      }
    }
  }, []);


  const applyDefaults = useCallback(() => {
    const keysToRemove = [
      'zmk-left-blocks',
      'zmk-right-blocks',
      'zmk-idle-left-blocks',
      'zmk-idle-right-blocks',
      'zmk-screen-dimensions',
      'zmk-idle-screens-enabled',
      'zmk-idle-timeout-sec',
      'zmk-screen-off-timeout-sec',
      'zmk-symmetric-settings',
      'zmk-right-screen-dimensions',
      'zmk-right-idle-screens-enabled',
      'zmk-right-idle-timeout-sec',
      'zmk-right-screen-off-timeout-sec',
      'zmk-widget-instances',
      'zmk-cleared-templates',
      'zmk_builder_cached_header',
    ];
    keysToRemove.forEach(k => {
      try {
        localStorage.removeItem(k);
      } catch {}
    });
    applyParsedAssets(getDefaultAssets());
    setCustomText('BRUNOWB');
  }, [applyParsedAssets]);

  // Notification Toast
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  }, []);

  const handleRestoreInitialValues = useCallback(() => {
    if (initialAssetsRef.current) {
      applyParsedAssets(cloneParsedAssets(initialAssetsRef.current));
      showToast('success', 'Workspace restored to initial values.');
    } else {
      applyDefaults();
      showToast('success', 'Workspace restored to initial values.');
    }
  }, [applyParsedAssets, applyDefaults, showToast]);

  const handleRestoreDefaults = useCallback(() => {
    applyDefaults();
    showToast('success', 'Workspace restored to base factory defaults.');
  }, [applyDefaults, showToast]);

  // GitHub integration & Connection State
  const [config, setConfig] = useState<GitHubRepoConfig>(getStoredGitHubConfig());
  const [connection, setConnection] = useState<GitHubConnectionState>({
    status: 'connecting',
    user: null,
    repo: null,
    errorMessage: null,
    lastCheckedAt: null,
    resolvedOwner: null,
    resolvedRepo: null,
  });
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(() => localStorage.getItem('zmk_builder_last_saved_at'));
  const [_currentSha, setCurrentSha] = useState<string | undefined>(undefined);
  const [currentHeaderPath, setCurrentHeaderPath] = useState<string>('config/scyan_assets.h');
  const [repoPrereqs, setRepoPrereqs] = useState<RepoPrerequisites | null>(null);
  const [isInstallingStudio, setIsInstallingStudio] = useState<boolean>(false);
  const [isUninstallingStudio, setIsUninstallingStudio] = useState<boolean>(false);
  const [syncTrigger, setSyncTrigger] = useState<number>(0);
  const autoSyncedRepoRef = useRef<string | null>(null);

  // Keymap Layout: dynamic from GitHub ZMK repository, cached in localStorage
  const [keymapLayout, setKeymapLayout] = useState<ParsedKeymapLayout>(() => {
    try {
      const saved = localStorage.getItem('zmk-keymap-layout');
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_EMPTY_5X3_LAYOUT;
  });

  useEffect(() => {
    try {
      localStorage.setItem('zmk-keymap-layout', JSON.stringify(keymapLayout));
    } catch {}
  }, [keymapLayout]);

  // Automatically fetch keymap from GitHub when repository is configured or synced
  useEffect(() => {
    if (config?.owner && config?.repo) {
      let isMounted = true;
      fetchRepoKeymap(config)
        .then(result => {
          if (!isMounted) return;
          if (result && result.content) {
            const parsed = parseZmkKeymap(result.content, result.filename);
            setKeymapLayout(parsed);
          }
        })
        .catch(err => {
          console.warn('Error fetching keymap from repo in App:', err);
        });

      return () => {
        isMounted = false;
      };
    }
  }, [config?.token, config?.owner, config?.repo, config?.branch, connection?.status, syncTrigger]);

  // Check and verify GitHub connection on mount and config updates
  const testConnection = useCallback(async (cfg: GitHubRepoConfig) => {
    setConnection(prev => ({ ...prev, status: 'connecting' }));
    const result = await verifyGitHubConnection(cfg);
    setConnection(result);

    if (result.status === 'connected') {
      trackEvent('github_connected', {
        has_push_access: Boolean(result.repo?.hasPushAccess),
      });
    } else if (result.status === 'error') {
      trackEvent('github_connect_failed', {
        error: result.errorMessage ?? 'Connection failed',
      });
    }

    let updatedCfg = { ...cfg };
    let configChanged = false;

    // If auto-discovery resolved a different owner/repo, write it back to config
    // so the commit target is always the same repo that was verified.
    if (result.resolvedOwner && result.resolvedOwner !== cfg.owner) {
      updatedCfg = { ...updatedCfg, owner: result.resolvedOwner };
      configChanged = true;
    }
    if (result.resolvedRepo && result.resolvedRepo !== cfg.repo) {
      updatedCfg = { ...updatedCfg, repo: result.resolvedRepo };
      configChanged = true;
    }

    // If connected and default branch is detected (e.g. main while config was master), auto-align
    if (result.status === 'connected' && result.repo?.defaultBranch) {
      if (updatedCfg.branch !== result.repo.defaultBranch && (updatedCfg.branch === 'master' || !updatedCfg.branch)) {
        updatedCfg = { ...updatedCfg, branch: result.repo.defaultBranch };
        configChanged = true;
      }
    }

    if (configChanged) {
      setConfig(updatedCfg);
      saveStoredGitHubConfig(updatedCfg);
    }

    return result;
  }, []);

  // Initial startup: verify connection, fetch repo scyan_assets.h, or load factory defaults
  useEffect(() => {
    let isCancelled = false;

    const initializeWorkspace = async () => {
      setIsInitialLoading(true);

      // Check if credentials exist
      if (!config.token || !config.owner || !config.repo) {
        applyDefaults();
        initialAssetsRef.current = cloneParsedAssets(getDefaultAssets());
        setConnection({
          status: 'disconnected',
          user: null,
          repo: null,
          errorMessage: null,
          lastCheckedAt: Date.now(),
          resolvedOwner: null,
          resolvedRepo: null,
        });
        setRepoPrereqs(null);
        if (!isCancelled) {
          setIsInitialLoading(false);
        }
        return;
      }

      try {
        const connResult = await testConnection(config);
        if (isCancelled) return;

        if (connResult.status === 'connected') {
          try {
            const activeOwner = connResult.resolvedOwner || config.owner;
            const activeRepo = connResult.resolvedRepo || config.repo;
            const activeBranch = connResult.repo?.defaultBranch || config.branch || 'main';
            const fetchConfig = { ...config, owner: activeOwner, repo: activeRepo, branch: activeBranch };

            // Check if repo has module and config installed
            const prereqs = await checkRepoPrerequisites(fetchConfig);
            if (isCancelled) return;
            setRepoPrereqs(prereqs);

            if (prereqs.hasAssetsHeader) {
              const fileData = await fetchFileFromRepo(fetchConfig, 'config/scyan_assets.h');
              if (isCancelled) return;

              if (fileData.content) {
                const parsed = parseCHeader(fileData.content);
                applyParsedAssets(parsed);
                initialAssetsRef.current = cloneParsedAssets(parsed);
                setCurrentSha(fileData.sha);
                if (fileData.resolvedPath) {
                  setCurrentHeaderPath(fileData.resolvedPath);
                }
                localStorage.setItem('zmk_builder_cached_header', fileData.content);
                showToast('success', `Loaded display assets from ${activeOwner}/${activeRepo}!`);
              } else {
                applyDefaults();
                initialAssetsRef.current = cloneParsedAssets(getDefaultAssets());
              }
            } else {
              applyDefaults();
              initialAssetsRef.current = cloneParsedAssets(getDefaultAssets());
            }
          } catch {
            console.info('No scyan_assets.h in repo (first time setup). Loading defaults.');
            applyDefaults();
            initialAssetsRef.current = cloneParsedAssets(getDefaultAssets());
          }
        } else {
          applyDefaults();
          initialAssetsRef.current = cloneParsedAssets(getDefaultAssets());
        }
      } catch (err) {
        console.warn('Initial workspace loading error:', err);
        applyDefaults();
      } finally {
        if (!isCancelled) {
          setIsInitialLoading(false);
        }
      }
    };

    initializeWorkspace();

    return () => {
      isCancelled = true;
    };
  }, []); // Run on initial mount

  // Automatically fetch latest assets when repository selection changes after initial load
  useEffect(() => {
    if (isInitialLoading) return;
    if (connection.status !== 'connected' || !config.owner || !config.repo || !config.token) {
      return;
    }

    const repoKey = `${config.owner}/${config.repo}@${config.branch}`;
    if (autoSyncedRepoRef.current === repoKey) {
      return;
    }
    autoSyncedRepoRef.current = repoKey;

    let isMounted = true;
    const syncRepoAssets = async () => {
      try {
        setIsSyncing(true);
        const prereqs = await checkRepoPrerequisites(config);
        if (!isMounted) return;
        setRepoPrereqs(prereqs);

        if (prereqs.hasAssetsHeader) {
          const fileData = await fetchFileFromRepo(config, 'config/scyan_assets.h');
          if (!isMounted) return;

          if (fileData.content) {
            const parsed = parseCHeader(fileData.content);
            applyParsedAssets(parsed);
            initialAssetsRef.current = cloneParsedAssets(parsed);
            setCurrentSha(fileData.sha);
            if (fileData.resolvedPath) {
              setCurrentHeaderPath(fileData.resolvedPath);
            }
            localStorage.setItem('zmk_builder_cached_header', fileData.content);
            showToast('success', `Loaded display assets from ${config.owner}/${config.repo}!`);
          } else {
            applyDefaults();
            initialAssetsRef.current = cloneParsedAssets(getDefaultAssets());
          }
        } else {
          applyDefaults();
          initialAssetsRef.current = cloneParsedAssets(getDefaultAssets());
        }
      } catch (err: any) {
        console.info('Repository does not contain scyan_assets.h yet. Keeping defaults.', err);
      } finally {
        if (isMounted) {
          setIsSyncing(false);
        }
      }
    };

    syncRepoAssets();

    return () => {
      isMounted = false;
    };
  }, [isInitialLoading, connection.status, config.owner, config.repo, config.branch, config.token, showToast, applyDefaults]);

  // Detect GitHub OAuth token or callback in URL parameters
  useEffect(() => {
    const url = new URL(window.location.href);
    const tokenParam = url.searchParams.get('token') || url.searchParams.get('access_token');
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const hashToken = hashParams.get('access_token');
    const incomingToken = tokenParam || hashToken;

    if (incomingToken) {
      const updatedConfig = { ...config, token: incomingToken };
      setConfig(updatedConfig);
      saveStoredGitHubConfig(updatedConfig);
      testConnection(updatedConfig);
      showToast('success', 'Logged in with GitHub!');
      // Clean query parameters from URL without reloading
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [config, testConnection, showToast]);

  // Listen to hash changes (e.g. browser back/forward or manual hash edits)
  useEffect(() => {
    const onHashChange = () => {
      const hashTab = getTabFromHash();
      setActiveTab(hashTab);
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  // Keep URL hash synchronized with activeTab
  useEffect(() => {
    const currentHash = window.location.hash.replace(/^#/, '').toLowerCase().trim();
    if (currentHash !== activeTab) {
      window.location.hash = activeTab;
    }
  }, [activeTab]);

  const handleDisconnect = () => {
    clearStoredGitHubToken();
    autoSyncedRepoRef.current = null;
    localStorage.removeItem('zmk_builder_cached_header');
    const newConfig = { ...config, token: '' };
    setConfig(newConfig);
    setConnection({
      status: 'disconnected',
      user: null,
      repo: null,
      errorMessage: null,
      lastCheckedAt: Date.now(),
      resolvedOwner: null,
      resolvedRepo: null,
    });
    showToast('success', 'GitHub repository disconnected.');
  };

  const isConnected = connection.status === 'connected';
  const isStudioInstalled = isConnected && Boolean(repoPrereqs?.isInstalled);
  const isPlaygroundMode = !isConnected || !isStudioInstalled;

  // Handle Tab navigation (open to all as interactive playground)
  const handleTabClick = (tabKey: TabType) => {
    if (tabKey !== activeTab) {
      trackEvent('tab_switched', { tab_id: tabKey });
    }
    setActiveTab(tabKey);
    window.location.hash = tabKey;
  };

  // Sync assets from GitHub repo
  const handleSync = async () => {
    if (!isConnected) {
      setIsSettingsOpen(true);
      showToast('error', 'Connect your GitHub repository before syncing.');
      return;
    }

    try {
      setIsSyncing(true);
      setSyncTrigger(prev => prev + 1);

      try {
        const prereqs = await checkRepoPrerequisites(config);
        setRepoPrereqs(prereqs);

        if (prereqs.hasAssetsHeader) {
          const fileData = await fetchFileFromRepo(config, 'config/scyan_assets.h');
          const parsed = parseCHeader(fileData.content);
          applyParsedAssets(parsed);
          initialAssetsRef.current = cloneParsedAssets(parsed);
          setCurrentSha(fileData.sha);
          if (fileData.resolvedPath) {
            setCurrentHeaderPath(fileData.resolvedPath);
          }
          localStorage.setItem('zmk_builder_cached_header', fileData.content);
          showToast('success', `Synced display assets from ${config.owner}/${config.repo}!`);
        } else {
          showToast('success', `Synced repository from ${config.owner}/${config.repo}! (Display assets not installed yet)`);
        }

        // Also fetch and update keymap layout from repository
        try {
          const keymapResult = await fetchRepoKeymap(config);
          if (keymapResult && keymapResult.content) {
            const parsedKm = parseZmkKeymap(keymapResult.content, keymapResult.filename);
            setKeymapLayout(parsedKm);
          }
        } catch (kmErr) {
          console.warn('Failed to fetch keymap during repo sync:', kmErr);
        }
      } catch (assetErr: any) {
        console.warn('Sync failed:', assetErr);
        showToast('error', `Sync failed: ${assetErr.message || 'Could not fetch file'}`);
      }
    } catch (err: any) {
      console.error('Sync failed:', err);
      showToast('error', `Sync failed: ${err.message || 'Could not fetch file'}`);
    } finally {
      setIsSyncing(false);
    }
  };

  // One-click installation of Scyan Studio into connected repository
  const handleInstallStudio = async () => {
    if (!isConnected || !config.token || !config.owner || !config.repo) {
      setIsSettingsOpen(true);
      showToast('error', 'Connect your GitHub repository before installing.');
      return;
    }

    try {
      setIsInstallingStudio(true);
      const metadata: HeaderMetadata = {
        version: 1,
        leftBlocks,
        rightBlocks,
        idleLeftBlocks,
        idleRightBlocks,
        screenDimensions,
        widgetInstances,
        idleTimeoutSec,
        screenOffTimeoutSec,
        idleScreensEnabled,
        symmetricSettings,
        rightScreenDimensions: symmetricSettings ? undefined : rightScreenDimensions,
        rightIdleScreensEnabled: symmetricSettings ? undefined : rightIdleScreensEnabled,
        rightIdleTimeoutSec: symmetricSettings ? undefined : rightIdleTimeoutSec,
        rightScreenOffTimeoutSec: symmetricSettings ? undefined : rightScreenOffTimeoutSec,
        layerNames: keymapLayout.layerNames,
      };

      const defaultC = generateCHeader(symbolsGrid, symbolSlices, fontGrid, fontMappings, metadata);
      const res = await installScyanStudioToRepo(config, defaultC);

      // Re-verify prerequisites immediately against the newly created commit SHA to bypass any CDN / browser caching
      const updatedPrereqs = await checkRepoPrerequisites(config, res.commitSha);
      setRepoPrereqs(updatedPrereqs);
      setCurrentSha(res.commitSha);
      setCurrentHeaderPath('config/scyan_assets.h');
      localStorage.setItem('zmk_builder_cached_header', defaultC);

      showToast('success', `Scyan Studio successfully installed in ${config.owner}/${config.repo}! Firmware build started in GitHub Actions.`);
      trackEvent('studio_installed', {
        repo: `${config.owner}/${config.repo}`,
      });
    } catch (err: any) {
      console.error('Failed to install Scyan Studio:', err);
      showToast('error', `Installation failed: ${err.message || 'Check repository permissions'}`);
    } finally {
      setIsInstallingStudio(false);
    }
  };

  // One-click uninstallation of Scyan Studio from connected repository
  const handleUninstallStudio = async () => {
    if (!config.token || !config.owner || !config.repo) {
      showToast('error', 'Connect your GitHub repository before uninstalling.');
      return;
    }

    try {
      setIsUninstallingStudio(true);
      await uninstallScyanStudioFromRepo(config);
      trackEvent('studio_uninstalled', {
        repo: `${config.owner}/${config.repo}`,
      });

      // Remove all cached workspace, layout, header, and session data from local storage
      const preserveAuthKeys = new Set([
        'zmk_builder_gh_token',
        'zmk_builder_gh_owner',
        'zmk_builder_gh_repo',
        'zmk_builder_gh_branch',
      ]);
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && !preserveAuthKeys.has(key)) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(k => {
        try {
          localStorage.removeItem(k);
        } catch {}
      });
      try {
        sessionStorage.clear();
      } catch {}

      showToast('success', `Scyan Studio successfully uninstalled from ${config.owner}/${config.repo}! Reloading...`);
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (err: any) {
      console.error('Failed to uninstall Scyan Studio:', err);
      showToast('error', `Uninstallation failed: ${err.message || 'Check repository permissions'}`);
      setIsUninstallingStudio(false);
    }
  };

  // Save & Commit to GitHub
  const handleSave = async () => {
    if (!isConnected) {
      setIsSettingsOpen(true);
      showToast('error', 'Please configure and connect your GitHub repository in settings first.');
      return;
    }

    if (!connection.repo?.hasPushAccess) {
      showToast('error', 'Your token lacks push permissions for this repository.');
      return;
    }

    // Guard against config drift: ensure the commit target matches what was verified
    if (connection.repo && connection.repo.name !== config.repo) {
      showToast('error',
        `Config mismatch: connection was verified for "${connection.repo.name}" but config targets "${config.repo}". ` +
        `Re-open Settings to re-verify the connection.`
      );
      return;
    }

    try {
      setIsSaving(true);
      const metadata: HeaderMetadata = {
        version: 1,
        leftBlocks,
        rightBlocks,
        idleLeftBlocks,
        idleRightBlocks,
        screenDimensions,
        widgetInstances,
        idleTimeoutSec,
        screenOffTimeoutSec,
        idleScreensEnabled,
        symmetricSettings,
        rightScreenDimensions: symmetricSettings ? undefined : rightScreenDimensions,
        rightIdleScreensEnabled: symmetricSettings ? undefined : rightIdleScreensEnabled,
        rightIdleTimeoutSec: symmetricSettings ? undefined : rightIdleTimeoutSec,
        rightScreenOffTimeoutSec: symmetricSettings ? undefined : rightScreenOffTimeoutSec,
        layerNames: keymapLayout.layerNames,
      };
      const generatedC = generateCHeader(symbolsGrid, symbolSlices, fontGrid, fontMappings, metadata);
      const targetPath = currentHeaderPath || 'config/scyan_assets.h';
      const commitRes = await commitStudioSaveToRepo(
        config,
        targetPath,
        generatedC,
        {
          screenOffTimeoutSec,
          rightScreenOffTimeoutSec,
          symmetricSettings,
        },
        '[Scyan Studio] feat(display): update 2-Atlas display spritesheets & glyph tables via Scyan ZMK Studio'
      );
      setCurrentSha(commitRes.commitSha);
      setCurrentHeaderPath(targetPath);
      localStorage.setItem('zmk_builder_cached_header', generatedC);
      const savedParsed = parseCHeader(generatedC);
      initialAssetsRef.current = cloneParsedAssets(savedParsed);
      const nowStr = new Date().toLocaleTimeString();
      setLastSavedAt(nowStr);
      localStorage.setItem('zmk_builder_last_saved_at', nowStr);
      const fileListMsg = commitRes.filesCommitted.length > 1
        ? ` (${commitRes.filesCommitted.join(', ')})`
        : '';
      showToast('success', `Committed to ${config.branch}!${fileListMsg} GitHub Actions firmware build started.`);
      trackEvent('github_push_success', {
        branch: config.branch,
        files_count: commitRes.filesCommitted.length,
      });
    } catch (err: any) {
      console.error('Save failed:', err);
      let msg = err.message || 'Check repository permissions';
      if (err.status === 403 || msg.includes('accessible by personal access token')) {
        msg =
          `Permission denied writing to ${config.owner}/${config.repo}. ` +
          `Ensure your PAT has "Contents: Read & write" access for this exact repository, ` +
          `then re-open Settings and reconnect.`;
      }
      showToast('error', `Save failed: ${msg}`);
      trackEvent('github_push_failed', {
        error: msg,
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-[#0b0d13] text-[#f1f5f9] overflow-hidden">
      {/* Top Header Bar with Live Git Status */}
      <HeaderBar
        config={config}
        connection={connection}
        onConfigChange={setConfig}
        onSync={handleSync}
        onSave={handleSave}
        onTestConnection={testConnection}
        onDisconnect={handleDisconnect}
        isSyncing={isSyncing}
        isSaving={isSaving}
        lastSavedAt={lastSavedAt}
        isSettingsOpen={isSettingsOpen}
        setIsSettingsOpen={setIsSettingsOpen}
        showToast={showToast}
        repoPrereqs={repoPrereqs}
        isInstallingStudio={isInstallingStudio}
        onInstallStudio={handleInstallStudio}
        isUninstallingStudio={isUninstallingStudio}
        onUninstallStudio={handleUninstallStudio}
        onSearchClick={import.meta.env.DEV ? () => setIsCommandPaletteOpen(true) : undefined}
        onRestoreInitialValues={handleRestoreInitialValues}
        onRestoreDefaults={handleRestoreDefaults}
      />

      {/* Main Tab Navigation Bar with Quick Navigation Scroll Bar */}
      <div className="border-b border-[#1e2538] bg-[#0b0d13] px-6 py-2.5 flex items-center justify-between gap-4 overflow-x-auto no-scrollbar shrink-0">
        <div className="flex items-center gap-1.5">
          {/* Tab 1: Preview */}
          <button
            onClick={() => handleTabClick('preview')}
            className={`text-xs font-mono px-3.5 py-1.5 rounded-lg whitespace-nowrap transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'preview'
                ? 'bg-[#00f0ff]/15 text-[#00f0ff] border border-[#00f0ff]/40 font-semibold shadow-[0_0_8px_rgba(0,240,255,0.2)]'
                : 'text-[#94a3b8] hover:text-white hover:bg-[#131722] border border-transparent'
            }`}
            title="OLED Preview & Corne Simulator"
          >
            <MonitorPlay className="size-3.5" />
            <span>Preview</span>
            {isPlaygroundMode && <Unplug className="size-3 text-[#f2741d]" />}
          </button>

          {/* Tab 2: Symbols Atlas */}
          <button
            onClick={() => handleTabClick('symbols')}
            className={`text-xs font-mono px-3.5 py-1.5 rounded-lg whitespace-nowrap transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'symbols'
                ? 'bg-[#00f0ff]/15 text-[#00f0ff] border border-[#00f0ff]/40 font-semibold shadow-[0_0_8px_rgba(0,240,255,0.2)]'
                : 'text-[#94a3b8] hover:text-white hover:bg-[#131722] border border-transparent'
            }`}
            title="Edit 1bpp Symbols & Icons Atlas"
          >
            <Shapes className="size-3.5" />
            <span>Symbols Atlas</span>
            {isPlaygroundMode && <Unplug className="size-3 text-[#f2741d]" />}
          </button>

          {/* Tab 3: Font Atlas */}
          <button
            onClick={() => handleTabClick('font')}
            className={`text-xs font-mono px-3.5 py-1.5 rounded-lg whitespace-nowrap transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'font'
                ? 'bg-[#00f0ff]/15 text-[#00f0ff] border border-[#00f0ff]/40 font-semibold shadow-[0_0_8px_rgba(0,240,255,0.2)]'
                : 'text-[#94a3b8] hover:text-white hover:bg-[#131722] border border-transparent'
            }`}
            title="Edit 1bpp Font & Glyphs Atlas"
          >
            <Type className="size-3.5" />
            <span>Font Atlas</span>
            {isPlaygroundMode && <Unplug className="size-3 text-[#f2741d]" />}
          </button>

          {/* Tab 4: Widgets */}
          <button
            onClick={() => handleTabClick('widgets')}
            className={`text-xs font-mono px-3.5 py-1.5 rounded-lg whitespace-nowrap transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'widgets'
                ? 'bg-[#00f0ff]/15 text-[#00f0ff] border border-[#00f0ff]/40 font-semibold shadow-[0_0_8px_rgba(0,240,255,0.2)]'
                : 'text-[#94a3b8] hover:text-white hover:bg-[#131722] border border-transparent'
            }`}
            title="Configure and arrange display Widgets"
          >
            <Component className="size-3.5" />
            <span>Widgets</span>
            {isPlaygroundMode && <Unplug className="size-3 text-[#f2741d]" />}
          </button>

          {/* Tab 5: Layout */}
          <button
            onClick={() => handleTabClick('layout')}
            className={`text-xs font-mono px-3.5 py-1.5 rounded-lg whitespace-nowrap transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'layout' || activeTab === 'blocks'
                ? 'bg-[#00f0ff]/15 text-[#00f0ff] border border-[#00f0ff]/40 font-semibold shadow-[0_0_8px_rgba(0,240,255,0.2)]'
                : 'text-[#94a3b8] hover:text-white hover:bg-[#131722] border border-transparent'
            }`}
            title="Arrange screen layout & split OLED blocks"
          >
            <Columns2 className="size-3.5" />
            <span>Layout</span>
            {isPlaygroundMode && <Unplug className="size-3 text-[#f2741d]" />}
          </button>

          {/* Tab 6: Design System (Dev-only) */}
          {import.meta.env.DEV && (
            <button
              onClick={() => handleTabClick('reference')}
              className={`text-xs font-mono px-3.5 py-1.5 rounded-lg whitespace-nowrap transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === 'reference' || activeTab === 'ui-elements' || activeTab === 'ui-elements-hero'
                  ? 'bg-[#00f0ff]/15 text-[#00f0ff] border border-[#00f0ff]/40 font-semibold shadow-[0_0_8px_rgba(0,240,255,0.2)]'
                  : 'text-[#94a3b8] hover:text-white hover:bg-[#131722] border border-transparent'
              }`}
              title="Design System & Element Reference (HeroUI v3)"
            >
              <Palette className="size-3.5 text-[#00f0ff]" />
              <span>Design System</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Tab Content */}
      <main className="flex-1 flex flex-col overflow-hidden relative bg-[#0b0d13]">
        {isInitialLoading ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0b0d13]/85 backdrop-blur-md">
            <div className="bg-[#131722] border border-[#1e2538] rounded-2xl p-8 max-w-md w-full text-center space-y-4 shadow-2xl">
              <div className="size-12 rounded-xl bg-[#00f0ff]/10 border border-[#00f0ff]/30 text-[#00f0ff] mx-auto flex items-center justify-center shadow-[0_0_16px_rgba(0,240,255,0.2)]">
                <RefreshCw size={24} className="animate-spin" />
              </div>
              <div className="text-base font-bold text-white tracking-tight">Loading ZMK Display Assets</div>
              <div className="text-xs text-[#94a3b8] leading-relaxed">
                {config.token && config.owner && config.repo ? (
                  <>
                    Connecting to <strong className="text-[#00f0ff]">{config.owner}/{config.repo}</strong> and retrieving display assets...
                  </>
                ) : (
                  'Initializing display workspace...'
                )}
              </div>
            </div>
          </div>
        ) : (
          <>
            {activeTab === 'preview' && (
              <OledPreviewTab
                symbolsGrid={symbolsGrid}
                symbolSlices={symbolSlices}
                fontGrid={fontGrid}
                fontGlyphs={fontGlyphs}
                fontMappings={fontMappings}
                leftBlocks={leftBlocks}
                rightBlocks={rightBlocks}
                layoutBlocks={leftBlocks}
                idleLeftBlocks={idleLeftBlocks}
                idleRightBlocks={idleRightBlocks}
                onLeftBlocksChange={setLeftBlocks}
                onRightBlocksChange={setRightBlocks}
                onIdleLeftBlocksChange={setIdleLeftBlocks}
                onIdleRightBlocksChange={setIdleRightBlocks}
                screenDimensions={screenDimensions}
                rightScreenDimensions={rightScreenDimensions}
                symmetricSettings={symmetricSettings}
                customText={customText}
                onCustomTextChange={setCustomText}
                instances={widgetInstances}
                config={config}
                connection={connection}
                onShowToast={showToast}
                onOpenSettings={() => setIsSettingsOpen(true)}
                syncTrigger={syncTrigger}
                keymapLayout={keymapLayout}
                onKeymapLayoutChange={setKeymapLayout}
              />
            )}

            {activeTab === 'symbols' && (
              <SymbolsAtlasTab
                symbolsGrid={symbolsGrid}
                onSymbolsGridChange={setSymbolsGrid}
                slices={symbolSlices}
                onSlicesChange={setSymbolSlices}
              />
            )}

            {activeTab === 'font' && (
              <FontAtlasTab
                fontGrid={fontGrid}
                onFontGridChange={setFontGrid}
                fontMappings={fontMappings}
                onFontMappingsChange={setFontMappings}
              />
            )}

            {activeTab === 'widgets' && (
              <WidgetsTab
                symbolsGrid={symbolsGrid}
                symbolSlices={symbolSlices}
                fontGrid={fontGrid}
                fontGlyphs={fontGlyphs}
                fontMappings={fontMappings}
                customText={customText}
                onCustomTextChange={setCustomText}
                instances={widgetInstances}
                onInstancesChange={handleInstancesChange}
                leftBlocks={leftBlocks}
                rightBlocks={rightBlocks}
                onLeftBlocksChange={setLeftBlocks}
                onRightBlocksChange={setRightBlocks}
                idleLeftBlocks={idleLeftBlocks}
                idleRightBlocks={idleRightBlocks}
                onIdleLeftBlocksChange={setIdleLeftBlocks}
                onIdleRightBlocksChange={setIdleRightBlocks}
                layerNames={keymapLayout.layerNames}
              />
            )}

            {(activeTab === 'layout' || activeTab === 'blocks') && (
              <BlocksTab
                leftBlocks={leftBlocks}
                rightBlocks={rightBlocks}
                onLeftBlocksChange={setLeftBlocks}
                onRightBlocksChange={setRightBlocks}
                idleLeftBlocks={idleLeftBlocks}
                idleRightBlocks={idleRightBlocks}
                layerNames={keymapLayout.layerNames}
                onIdleLeftBlocksChange={setIdleLeftBlocks}
                onIdleRightBlocksChange={setIdleRightBlocks}
                screenDimensions={screenDimensions}
                onScreenDimensionsChange={setScreenDimensions}
                idleScreensEnabled={idleScreensEnabled}
                onIdleScreensEnabledChange={setIdleScreensEnabled}
                idleTimeoutSec={idleTimeoutSec}
                onIdleTimeoutSecChange={setIdleTimeoutSec}
                screenOffTimeoutSec={screenOffTimeoutSec}
                onScreenOffTimeoutSecChange={setScreenOffTimeoutSec}
                symmetricSettings={symmetricSettings}
                onSymmetricSettingsChange={setSymmetricSettings}
                rightScreenDimensions={rightScreenDimensions}
                onRightScreenDimensionsChange={setRightScreenDimensions}
                rightIdleScreensEnabled={rightIdleScreensEnabled}
                onRightIdleScreensEnabledChange={setRightIdleScreensEnabled}
                rightIdleTimeoutSec={rightIdleTimeoutSec}
                onRightIdleTimeoutSecChange={setRightIdleTimeoutSec}
                rightScreenOffTimeoutSec={rightScreenOffTimeoutSec}
                onRightScreenOffTimeoutSecChange={setRightScreenOffTimeoutSec}
                symbolsGrid={symbolsGrid}
                symbolSlices={symbolSlices}
                fontGrid={fontGrid}
                fontGlyphs={fontGlyphs}
                fontMappings={fontMappings}
                customText={customText}
                instances={widgetInstances}
                onInstancesChange={handleInstancesChange}
                layoutBlocks={leftBlocks}
                onLayoutBlocksChange={setLeftBlocks}
              />
            )}

            {import.meta.env.DEV && (activeTab === 'reference' || activeTab === 'ui-elements' || activeTab === 'ui-elements-hero') && (
              <div className="flex-1 overflow-y-auto">
                <ElementReferencePage onOpenCommandPalette={() => setIsCommandPaletteOpen(true)} />
              </div>
            )}
          </>
        )}
      </main>

      {/* Floating Toast notification */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none">
          <div
            className={`pointer-events-auto p-4 rounded-xl border shadow-2xl backdrop-blur-lg flex items-start gap-3 transition-all ${
              toast.type === 'success'
                ? 'bg-[#0b0d13]/95 border-[#00f0ff]/50 text-white shadow-[0_0_24px_rgba(0,240,255,0.2)]'
                : 'bg-[#0b0d13]/95 border-[#f2741d]/50 text-white shadow-[0_0_24px_rgba(242,116,29,0.2)]'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle2 size={16} className="text-[#00f0ff] shrink-0 mt-0.5" />
            ) : (
              <AlertCircle size={16} className="text-[#f2741d] shrink-0 mt-0.5" />
            )}
            <div className="flex-1 min-w-0">
              <h4 className="text-xs font-bold">{toast.type === 'success' ? 'Success' : 'Error'}</h4>
              <p className="text-xs text-[#94a3b8] mt-0.5 leading-relaxed">{toast.message}</p>
            </div>
            <button
              onClick={() => setToast(null)}
              className="text-[#94a3b8] hover:text-white transition-colors cursor-pointer p-0.5"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Command Palette Modal (Ctrl+K) - Dev Only */}
      {import.meta.env.DEV && (
        <CommandPalette
          isOpen={isCommandPaletteOpen}
          onClose={setIsCommandPaletteOpen}
          onSelectSection={(sectionId) => {
            if (['preview', 'symbols', 'font', 'widgets', 'layout', 'blocks'].includes(sectionId)) {
              handleTabClick((sectionId === 'blocks' ? 'layout' : sectionId) as TabType);
            } else {
              handleTabClick('reference');
              setTimeout(() => {
                const el = document.getElementById(sectionId);
                if (el) {
                  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
              }, 100);
            }
          }}
        />
      )}
    </div>
  );
}

export default App;

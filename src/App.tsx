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
import type {
  GitHubRepoConfig,
  GitHubConnectionState,
} from './services/githubService';
import {
  getStoredGitHubConfig,
  saveStoredGitHubConfig,
  fetchFileFromRepo,
  commitFileToRepo,
  verifyGitHubConnection,
  clearStoredGitHubToken,
  checkRepoPrerequisites,
  installScyanStudioToRepo,
  type RepoPrerequisites,
} from './services/githubService';
import { HeaderBar } from './components/HeaderBar';
import { OledPreviewTab } from './tabs/OledPreviewTab';
import { SymbolsAtlasTab } from './tabs/SymbolsAtlasTab';
import { FontAtlasTab } from './tabs/FontAtlasTab';
import { WidgetsTab } from './tabs/WidgetsTab';
import { BlocksTab } from './tabs/BlocksTab';
import { ScreenSizePopover } from './components/ScreenSizePopover';
import {
  Monitor,
  Shapes,
  Type,
  Sliders,
  LayoutGrid,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Settings,
  Unplug,
} from 'lucide-react';
import './App.css';

const VALID_TABS = ['preview', 'symbols', 'font', 'widgets', 'blocks'] as const;
type TabType = typeof VALID_TABS[number];

const getTabFromHash = (): TabType => {
  const hash = window.location.hash.replace(/^#/, '').toLowerCase().trim();
  if (VALID_TABS.includes(hash as TabType)) {
    return hash as TabType;
  }
  return 'preview';
};

export function App() {
  // Navigation Tab: initialized and tracked via URL hash (#preview, #symbols, etc.)
  const [activeTab, setActiveTab] = useState<TabType>(() => getTabFromHash());

  // Loading overlay state: keep true until repository data (or defaults fallback) is loaded
  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(true);

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
      if (saved) savedInstances = JSON.parse(saved);
    } catch {}
    
    // Auto-populate defaults for templates that aren't in savedInstances AND aren't cleared
    const defaults: WidgetInstanceMap = { ...savedInstances };
    let clearedStr = localStorage.getItem('zmk-cleared-templates');
    let clearedSet = new Set<string>();
    if (clearedStr) {
      try { clearedSet = new Set(JSON.parse(clearedStr)); } catch {}
    }

    WIDGET_REGISTRY.forEach(w => {
      const shouldAutoPopulate = w.id === 'wpm-chart' || (w.associatedSliceIds && w.associatedSliceIds.length > 0);
      if (!defaults[w.id] && !clearedSet.has(w.id) && shouldAutoPopulate) {
        let initialConfig: import('./types/widget').WidgetInstanceConfig = { mode: 'symbol' };
        if (w.id === 'wpm-chart') {
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
        setWidgetInstances(parsed.metadata.widgetInstances);
      }
    }
  }, []);

  const applyDefaults = useCallback(() => {
    applyParsedAssets(getDefaultAssets());
  }, [applyParsedAssets]);

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
  const [isScreenSettingsOpen, setIsScreenSettingsOpen] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(() => localStorage.getItem('zmk_builder_last_saved_at'));
  const [currentSha, setCurrentSha] = useState<string | undefined>(undefined);
  const [currentHeaderPath, setCurrentHeaderPath] = useState<string>('config/scyan_assets.h');
  const [repoPrereqs, setRepoPrereqs] = useState<RepoPrerequisites | null>(null);
  const [isInstallingStudio, setIsInstallingStudio] = useState<boolean>(false);
  const [syncTrigger, setSyncTrigger] = useState<number>(0);
  const autoSyncedRepoRef = useRef<string | null>(null);

  // Notification Toast
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  }, []);

  // Check and verify GitHub connection on mount and config updates
  const testConnection = useCallback(async (cfg: GitHubRepoConfig) => {
    setConnection(prev => ({ ...prev, status: 'connecting' }));
    const result = await verifyGitHubConnection(cfg);
    setConnection(result);

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
                setCurrentSha(fileData.sha);
                if (fileData.resolvedPath) {
                  setCurrentHeaderPath(fileData.resolvedPath);
                }
                localStorage.setItem('zmk_builder_cached_header', fileData.content);
                showToast('success', `Loaded display assets from ${activeOwner}/${activeRepo}!`);
              } else {
                applyDefaults();
              }
            } else {
              applyDefaults();
            }
          } catch {
            console.info('No scyan_assets.h in repo (first time setup). Loading defaults.');
            applyDefaults();
          }
        } else {
          applyDefaults();
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
            setCurrentSha(fileData.sha);
            if (fileData.resolvedPath) {
              setCurrentHeaderPath(fileData.resolvedPath);
            }
            localStorage.setItem('zmk_builder_cached_header', fileData.content);
            showToast('success', `Loaded display assets from ${config.owner}/${config.repo}!`);
          } else {
            applyDefaults();
          }
        } else {
          applyDefaults();
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
          setCurrentSha(fileData.sha);
          if (fileData.resolvedPath) {
            setCurrentHeaderPath(fileData.resolvedPath);
          }
          localStorage.setItem('zmk_builder_cached_header', fileData.content);
          showToast('success', `Synced display assets from ${config.owner}/${config.repo}!`);
        } else {
          showToast('success', `Synced repository from ${config.owner}/${config.repo}! (Display assets not installed yet)`);
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
      };
      const defaultC = generateCHeader(symbolsGrid, symbolSlices, fontGrid, fontMappings, metadata);
      const res = await installScyanStudioToRepo(config, defaultC);

      // Re-verify prerequisites
      const updatedPrereqs = await checkRepoPrerequisites(config);
      setRepoPrereqs(updatedPrereqs);
      setCurrentSha(res.commitSha);
      setCurrentHeaderPath('config/scyan_assets.h');
      localStorage.setItem('zmk_builder_cached_header', defaultC);

      showToast('success', `Scyan Studio successfully installed in ${config.owner}/${config.repo}! Firmware build started in GitHub Actions.`);
    } catch (err: any) {
      console.error('Failed to install Scyan Studio:', err);
      showToast('error', `Installation failed: ${err.message || 'Check repository permissions'}`);
    } finally {
      setIsInstallingStudio(false);
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
      };
      const generatedC = generateCHeader(symbolsGrid, symbolSlices, fontGrid, fontMappings, metadata);
      const targetPath = currentHeaderPath || 'config/scyan_assets.h';
      const commitRes = await commitFileToRepo(
        config,
        targetPath,
        generatedC,
        'feat(display): update 2-Atlas display spritesheets & glyph tables via Scyan ZMK Studio',
        currentSha
      );
      setCurrentSha(commitRes.sha);
      setCurrentHeaderPath(targetPath);
      localStorage.setItem('zmk_builder_cached_header', generatedC);
      const nowStr = new Date().toLocaleTimeString();
      setLastSavedAt(nowStr);
      localStorage.setItem('zmk_builder_last_saved_at', nowStr);
      showToast('success', `Committed to ${config.branch}! GitHub Actions firmware build started.`);
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
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="builder-root">
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
      />

      {/* Main Tab Navigation Bar with Locked State indicator */}
      <div className="tabs-nav-bar">
        <div className="tabs-group">
          {/* Tab 1: Preview */}
          <button
            className={`tab-btn ${activeTab === 'preview' ? 'active' : ''}`}
            onClick={() => handleTabClick('preview')}
            title="OLED Preview & Corne Simulator"
          >
            <Monitor size={15} />
            <span>Preview</span>
            {isPlaygroundMode && <Unplug size={12} className="tab-disconnect-icon" />}
          </button>

          {/* Tab 2: Symbols Atlas */}
          <button
            className={`tab-btn ${activeTab === 'symbols' ? 'active' : ''}`}
            onClick={() => handleTabClick('symbols')}
            title="Edit 1bpp Symbols & Icons Atlas"
          >
            <Shapes size={15} />
            <span>Symbols Atlas</span>
            {isPlaygroundMode && <Unplug size={12} className="tab-disconnect-icon" />}
          </button>

          {/* Tab 3: Font Atlas */}
          <button
            className={`tab-btn ${activeTab === 'font' ? 'active' : ''}`}
            onClick={() => handleTabClick('font')}
            title="Edit 1bpp Font & Glyphs Atlas"
          >
            <Type size={15} />
            <span>Font Atlas</span>
            {isPlaygroundMode && <Unplug size={12} className="tab-disconnect-icon" />}
          </button>

          {/* Tab 4: Widgets */}
          <button
            className={`tab-btn ${activeTab === 'widgets' ? 'active' : ''}`}
            onClick={() => handleTabClick('widgets')}
            title="Configure and arrange display Widgets"
          >
            <Sliders size={15} />
            <span>Widgets</span>
            {isPlaygroundMode && <Unplug size={12} className="tab-disconnect-icon" />}
          </button>

          {/* Tab 5: Blocks */}
          <div className="tab-blocks-wrapper">
            <button
              className={`tab-btn ${activeTab === 'blocks' ? 'active' : ''}`}
              onClick={() => handleTabClick('blocks')}
              title="Drag & drop screen layout blocks"
            >
              <LayoutGrid size={15} />
              <span>Blocks</span>
              {isPlaygroundMode && <Unplug size={12} className="tab-disconnect-icon" />}
            </button>
            <button
              className={`tab-blocks-gear-btn ${isScreenSettingsOpen ? 'active' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                if (activeTab !== 'blocks') {
                  handleTabClick('blocks');
                }
                setIsScreenSettingsOpen(prev => !prev);
              }}
              title="Screen Dimensions Settings"
            >
              <Settings size={13} />
            </button>

            {isScreenSettingsOpen && (
              <ScreenSizePopover
                screenDimensions={screenDimensions}
                onScreenDimensionsChange={setScreenDimensions}
                onClose={() => setIsScreenSettingsOpen(false)}
              />
            )}
          </div>
        </div>
      </div>

      {/* Main Tab Content */}
      <main className="tab-content-area">
        {isInitialLoading ? (
          <div className="assets-loading-overlay">
            <div className="assets-loading-card">
              <div className="assets-loading-spinner">
                <RefreshCw size={24} className="spin" />
              </div>
              <div className="assets-loading-title">Loading ZMK Display Assets</div>
              <div className="assets-loading-subtitle">
                {config.token && config.owner && config.repo ? (
                  <>
                    Connecting to <strong className="text-cyan-300">{config.owner}/{config.repo}</strong> and retrieving display assets...
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
                customText={customText}
                onCustomTextChange={setCustomText}
                instances={widgetInstances}
                config={config}
                connection={connection}
                onShowToast={showToast}
                onOpenSettings={() => setIsSettingsOpen(true)}
                syncTrigger={syncTrigger}
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
              />
            )}

            {activeTab === 'blocks' && (
              <BlocksTab
                leftBlocks={leftBlocks}
                rightBlocks={rightBlocks}
                onLeftBlocksChange={setLeftBlocks}
                onRightBlocksChange={setRightBlocks}
                idleLeftBlocks={idleLeftBlocks}
                idleRightBlocks={idleRightBlocks}
                onIdleLeftBlocksChange={setIdleLeftBlocks}
                onIdleRightBlocksChange={setIdleRightBlocks}
                screenDimensions={screenDimensions}
                onScreenDimensionsChange={setScreenDimensions}
                onResetDefaults={() => {
                  setLeftBlocks([...DEFAULT_LEFT_LAYOUT_BLOCKS]);
                  setRightBlocks([...DEFAULT_RIGHT_LAYOUT_BLOCKS]);
                }}
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
          </>
        )}
      </main>

      {/* Toast notification */}
      {toast && (
        <div className={`toast-notification ${toast.type}`}>
          {toast.type === 'success' ? (
            <CheckCircle2 size={16} className="text-emerald-400" />
          ) : (
            <AlertCircle size={16} className="text-red-400" />
          )}
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}

export default App;

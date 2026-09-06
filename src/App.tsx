import { useState, useEffect, useCallback } from 'react';
import { BwpxGrid } from './bwpx/core/BwpxGrid';
import type {
  SpriteSlice,
  FontGlyph,
  FontCharMapping,
  LayoutBlock,
} from './types/zmk';
import {
  DEFAULT_SYMBOL_SLICES,
  DEFAULT_FONT_GLYPHS,
  DEFAULT_FONT_MAPPINGS,
  DEFAULT_LAYOUT_BLOCKS,
} from './types/zmk';
import { createDefaultSymbolsGrid, createDefaultFontGrid } from './services/defaultAssets';
import { parseCHeader, generateCHeader } from './services/cHeaderParser';
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
} from './services/githubService';
import { HeaderBar } from './components/HeaderBar';
import { OledPreviewTab } from './tabs/OledPreviewTab';
import { SymbolsAtlasTab } from './tabs/SymbolsAtlasTab';
import { FontAtlasTab } from './tabs/FontAtlasTab';
import { WidgetsTab } from './tabs/WidgetsTab';
import { BlocksTab } from './tabs/BlocksTab';
import {
  Monitor,
  Shapes,
  Type,
  Sliders,
  LayoutGrid,
  CheckCircle2,
  AlertCircle,
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

  // Core Bitmaps & Descriptors
  const [symbolsGrid, setSymbolsGrid] = useState<BwpxGrid>(() => createDefaultSymbolsGrid());
  const [symbolSlices, setSymbolSlices] = useState<SpriteSlice[]>(() => [...DEFAULT_SYMBOL_SLICES]);
  const [fontGrid, setFontGrid] = useState<BwpxGrid>(() => createDefaultFontGrid());
  const [fontGlyphs, setFontGlyphs] = useState<FontGlyph[]>(() => [...DEFAULT_FONT_GLYPHS]);
  const [fontMappings, setFontMappings] = useState<FontCharMapping[]>(() => [...DEFAULT_FONT_MAPPINGS]);
  const [layoutBlocks, setLayoutBlocks] = useState<LayoutBlock[]>(() => [...DEFAULT_LAYOUT_BLOCKS]);
  const [customText, setCustomText] = useState<string>('BRUNOWB');

  // GitHub integration & Connection State
  const [config, setConfig] = useState<GitHubRepoConfig>(getStoredGitHubConfig());
  const [connection, setConnection] = useState<GitHubConnectionState>({
    status: 'connecting',
    user: null,
    repo: null,
    errorMessage: null,
    lastCheckedAt: null,
  });
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [currentSha, setCurrentSha] = useState<string | undefined>(undefined);
  const [syncTrigger, setSyncTrigger] = useState<number>(0);

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

    // If connected and default branch is detected (e.g. main while config was master), auto-align
    if (result.status === 'connected' && result.repo?.defaultBranch) {
      if (cfg.branch !== result.repo.defaultBranch && (cfg.branch === 'master' || !cfg.branch)) {
        const updated = { ...cfg, branch: result.repo.defaultBranch };
        setConfig(updated);
        saveStoredGitHubConfig(updated);
      }
    }

    return result;
  }, []);

  useEffect(() => {
    testConnection(config);
  }, [config, testConnection]);

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
    const newConfig = { ...config, token: '' };
    setConfig(newConfig);
    setConnection({
      status: 'disconnected',
      user: null,
      repo: null,
      errorMessage: null,
      lastCheckedAt: Date.now(),
    });
    showToast('success', 'GitHub repository disconnected.');
  };

  const isConnected = connection.status === 'connected';

  // Handle Tab navigation with URL hash update
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
        const fileData = await fetchFileFromRepo(config, 'include/custom_display_assets.h');
        const parsed = parseCHeader(fileData.content);
        setSymbolsGrid(parsed.symbolsGrid);
        setSymbolSlices(parsed.symbolSlices);
        setFontGrid(parsed.fontGrid);
        setFontGlyphs(parsed.fontGlyphs);
        if (parsed.fontMappings && parsed.fontMappings.length > 0) {
          setFontMappings(parsed.fontMappings);
        }
        setCurrentSha(fileData.sha);
        showToast('success', `Synced display assets from ${config.owner}/${config.repo}!`);
      } catch (assetErr: any) {
        // If include/custom_display_assets.h does not exist yet in the repo, that is normal for fresh ZMK repos!
        console.warn('No custom_display_assets.h found in repo yet:', assetErr);
        showToast('success', `Synced repository from ${config.owner}/${config.repo}! (Display assets header not present yet)`);
      }
    } catch (err: any) {
      console.error('Sync failed:', err);
      showToast('error', `Sync failed: ${err.message || 'Could not fetch file'}`);
    } finally {
      setIsSyncing(false);
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

    try {
      setIsSaving(true);
      const generatedC = generateCHeader(symbolsGrid, symbolSlices, fontGrid, fontMappings);
      const commitRes = await commitFileToRepo(
        config,
        'include/custom_display_assets.h',
        generatedC,
        'feat(display): update 2-Atlas display spritesheets & glyph tables via ZMK Display Studio',
        currentSha
      );
      setCurrentSha(commitRes.sha);
      const nowStr = new Date().toLocaleTimeString();
      setLastSavedAt(nowStr);
      showToast('success', `Committed to ${config.branch}! GitHub Actions firmware build started.`);
    } catch (err: any) {
      console.error('Save failed:', err);
      showToast('error', `Save failed: ${err.message || 'Check repository permissions'}`);
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
      />

      {/* Main Tab Navigation Bar with Locked State indicator */}
      <div className="tabs-nav-bar">
        <div className="tabs-group">
          {/* Tab 1: Always accessible */}
          <button
            className={`tab-btn ${activeTab === 'preview' ? 'active' : ''}`}
            onClick={() => handleTabClick('preview')}
            title="OLED Preview & Corne Simulator (Always Available)"
          >
            <Monitor size={15} />
            <span>Preview</span>
          </button>

          {/* Tab 2: Symbols Atlas */}
          <button
            className={`tab-btn ${activeTab === 'symbols' ? 'active' : ''}`}
            onClick={() => handleTabClick('symbols')}
            title="Edit 1bpp Symbols & Icons Atlas"
          >
            <Shapes size={15} />
            <span>Symbols Atlas</span>
          </button>

          {/* Tab 3: Font Atlas */}
          <button
            className={`tab-btn ${activeTab === 'font' ? 'active' : ''}`}
            onClick={() => handleTabClick('font')}
            title="Edit 1bpp Font & Glyphs Atlas"
          >
            <Type size={15} />
            <span>Font Atlas</span>
          </button>

          {/* Tab 4: Widgets */}
          <button
            className={`tab-btn ${activeTab === 'widgets' ? 'active' : ''}`}
            onClick={() => handleTabClick('widgets')}
            title="Configure and arrange display Widgets"
          >
            <Sliders size={15} />
            <span>Widgets</span>
          </button>

          {/* Tab 5: Blocks */}
          <button
            className={`tab-btn ${activeTab === 'blocks' ? 'active' : ''}`}
            onClick={() => handleTabClick('blocks')}
            title="Drag & drop screen layout blocks"
          >
            <LayoutGrid size={15} />
            <span>Blocks</span>
          </button>
        </div>
      </div>

      {/* Main Tab Content */}
      <main className="tab-content-area">
        {activeTab === 'preview' && (
          <OledPreviewTab
            symbolsGrid={symbolsGrid}
            symbolSlices={symbolSlices}
            fontGrid={fontGrid}
            fontGlyphs={fontGlyphs}
            fontMappings={fontMappings}
            layoutBlocks={layoutBlocks}
            customText={customText}
            onCustomTextChange={setCustomText}
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
          />
        )}

        {activeTab === 'blocks' && (
          <BlocksTab
            layoutBlocks={layoutBlocks}
            onLayoutBlocksChange={setLayoutBlocks}
            onResetDefaults={() => setLayoutBlocks([...DEFAULT_LAYOUT_BLOCKS])}
          />
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

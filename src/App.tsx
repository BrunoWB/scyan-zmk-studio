import { useEffect, useMemo } from 'react';
import { getShieldUnitsForShield } from './data/shieldsData';
import { trackEvent } from './services/analytics';
import { HeaderBar } from './components/HeaderBar';
import { OledPreviewTab } from './tabs/OledPreviewTab';
import { SymbolsAtlasTab } from './tabs/SymbolsAtlasTab';
import { FontAtlasTab } from './tabs/FontAtlasTab';
import { WidgetsTab } from './tabs/WidgetsTab';
import { BlocksTab } from './tabs/BlocksTab';
import ElementReferencePage from './reference/ElementReferencePage';
import CommandPalette from './reference/components/layout/CommandPalette';
import { ShieldsTab } from './tabs/ShieldsTab';
import { TopologySandboxTab } from './tabs/TopologySandboxTab';
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
  Cpu,
  Network,
} from 'lucide-react';
import { useAtlasStore } from './stores/useAtlasStore';
import { useLayoutStore } from './stores/useLayoutStore';
import { useGitHubStore } from './stores/useGitHubStore';
import { useUiStore, type TabType, type ToastMessage } from './stores/useUiStore';
import {
  initializeWorkspace,
  syncRepoAssets,
  saveWorkspaceToRepo,
  installScyanStudio,
  uninstallScyanStudio,
  restoreInitialValues,
  restoreDefaults,
} from './stores/workspaceActions';
import './App.css';

const VALID_TABS = ['preview', 'symbols', 'font', 'widgets', 'layout', 'blocks', 'reference', 'ui-elements', 'ui-elements-hero', 'shields', 'topology'] as const;

const getTabFromHash = (): TabType => {
  const path = window.location.pathname.replace(/^\//, '').toLowerCase().trim();
  if (import.meta.env.DEV && (path === 'ui-elements' || path === 'elements' || path === 'reference' || path === 'hero' || path === 'heroui')) {
    return 'reference';
  }
  if (import.meta.env.DEV && (path === 'shields' || path === 'shield')) {
    return 'shields';
  }
  if (import.meta.env.DEV && (path === 'topology' || path === 'topology-sandbox')) {
    return 'topology';
  }
  const hash = window.location.hash.replace(/^#/, '').toLowerCase().trim();
  if ((hash === 'reference' || hash === 'shields' || hash === 'shield' || hash === 'topology' || hash === 'topology-sandbox' || hash === 'ui-elements' || hash === 'ui-elements-hero') && !import.meta.env.DEV) {
    return 'preview';
  }
  if (hash === 'blocks') {
    return 'layout';
  }
  if (import.meta.env.DEV && (hash === 'shields' || hash === 'shield')) {
    return 'shields';
  }
  if (import.meta.env.DEV && (hash === 'topology' || hash === 'topology-sandbox')) {
    return 'topology';
  }
  if (VALID_TABS.includes(hash as any)) {
    return hash as TabType;
  }
  if (import.meta.env.DEV && (hash === 'ui-elements-hero' || hash === 'hero' || hash === 'heroui' || hash === 'elements' || hash === 'ui-elements')) {
    return 'reference';
  }
  return 'preview';
};

export function App() {
  // Navigation & UI state from useUiStore
  const activeTab = useUiStore((s) => s.activeTab);
  const setActiveTab = useUiStore((s) => s.setActiveTab);
  const isCommandPaletteOpen = useUiStore((s) => s.isCommandPaletteOpen);
  const setIsCommandPaletteOpen = useUiStore((s) => s.setIsCommandPaletteOpen);
  const isSettingsOpen = useUiStore((s) => s.isSettingsOpen);
  const setIsSettingsOpen = useUiStore((s) => s.setIsSettingsOpen);
  const isInitialLoading = useUiStore((s) => s.isInitialLoading);
  const toasts = useUiStore((s) => s.toasts);
  const showToast = useUiStore((s) => s.showToast);
  const removeToast = useUiStore((s) => s.removeToast);
  const customText = useUiStore((s) => s.customText);

  // Atlas state from useAtlasStore
  const symbolsGrid = useAtlasStore((s) => s.symbolsGrid);
  const symbolSlices = useAtlasStore((s) => s.symbolSlices);
  const fontGrid = useAtlasStore((s) => s.fontGrid);
  const fontGlyphs = useAtlasStore((s) => s.fontGlyphs);
  const fontMappings = useAtlasStore((s) => s.fontMappings);

  // Layout state from useLayoutStore
  const centralBlocks = useLayoutStore((s) => s.centralBlocks);
  const peripheralBlocks = useLayoutStore((s) => s.peripheralBlocks);
  const idleCentralBlocks = useLayoutStore((s) => s.idleCentralBlocks);
  const idlePeripheralBlocks = useLayoutStore((s) => s.idlePeripheralBlocks);
  const screenDimensions = useLayoutStore((s) => s.screenDimensions);
  const peripheralScreenDimensions = useLayoutStore((s) => s.peripheralScreenDimensions);
  const handleCentralDimensionsChange = useLayoutStore((s) => s.handleCentralDimensionsChange);
  const handlePeripheralDimensionsChange = useLayoutStore((s) => s.handlePeripheralDimensionsChange);
  const handleRotationChange = useLayoutStore((s) => s.handleRotationChange);
  const shieldId = useLayoutStore((s) => s.shieldId);
  const setShieldId = useLayoutStore((s) => s.setShieldId);
  const enabledScreens = useLayoutStore((s) => s.enabledScreens);
  const displayAssignments = useLayoutStore((s) => s.displayAssignments);
  const setDisplayAssignments = useLayoutStore((s) => s.setDisplayAssignments);
  const loadedShields = useLayoutStore((s) => s.loadedShields);
  const peripheralScreens = useLayoutStore((s) => s.peripheralScreens);
  const widgetInstances = useLayoutStore((s) => s.widgetInstances);
  const swapDisplays = useLayoutStore((s) => s.swapDisplays);
  const makeMaster = useLayoutStore((s) => s.makeMaster);

  // GitHub store state & actions
  const config = useGitHubStore((s) => s.config);
  const setConfig = useGitHubStore((s) => s.setConfig);
  const connection = useGitHubStore((s) => s.connection);
  const testConnection = useGitHubStore((s) => s.testConnection);
  const disconnect = useGitHubStore((s) => s.disconnect);
  const isSyncing = useGitHubStore((s) => s.isSyncing);
  const isSaving = useGitHubStore((s) => s.isSaving);
  const lastSavedAt = useGitHubStore((s) => s.lastSavedAt);
  const repoPrereqs = useGitHubStore((s) => s.repoPrereqs);
  const isInstallingStudio = useGitHubStore((s) => s.isInstallingStudio);
  const isUninstallingStudio = useGitHubStore((s) => s.isUninstallingStudio);

  // Sync hash routing on window popstate / hashchange
  useEffect(() => {
    const handleHashChange = () => {
      const next = getTabFromHash();
      setActiveTab(next);
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [setActiveTab]);

  // Initialize workspace from GitHub or fallback defaults
  useEffect(() => {
    initializeWorkspace();
  }, []);

  const handleTabClick = (tab: TabType) => {
    setActiveTab(tab);
    window.location.hash = tab;
    trackEvent('switch_tab', { tab });
  };

  const isConnected = connection.status === 'connected';
  const isStudioInstalled = Boolean(repoPrereqs?.isInstalled);
  const isPlaygroundMode = !isConnected || !isStudioInstalled;

  const effectiveShields = useMemo(() => {
    if (loadedShields && loadedShields.length > 0) return loadedShields;
    return getShieldUnitsForShield(shieldId);
  }, [loadedShields, shieldId]);

  const currentShieldIds = useMemo(() => new Set(effectiveShields.map((u) => u.id)), [effectiveShields]);

  const attachedDisplayIds = useMemo(() => {
    const ids = new Set<string>();
    for (const [shieldKey, dispId] of Object.entries(displayAssignments)) {
      if (dispId && currentShieldIds.has(shieldKey)) {
        ids.add(dispId);
      }
    }
    return ids;
  }, [displayAssignments, currentShieldIds]);

  const unattachedScreens = useMemo(() => {
    return enabledScreens.filter((s) => !attachedDisplayIds.has(s));
  }, [enabledScreens, attachedDisplayIds]);

  return (
    <div className="flex flex-col h-screen w-screen bg-[#0b0d13] text-[#f1f5f9] overflow-hidden">
      {/* Top Header Bar with Live Git Status */}
      <HeaderBar
        config={config}
        connection={connection}
        onConfigChange={setConfig}
        onSync={syncRepoAssets}
        onSave={saveWorkspaceToRepo}
        onTestConnection={testConnection}
        onDisconnect={disconnect}
        isSyncing={isSyncing}
        isSaving={isSaving}
        lastSavedAt={lastSavedAt}
        isSettingsOpen={isSettingsOpen}
        setIsSettingsOpen={setIsSettingsOpen}
        showToast={showToast}
        repoPrereqs={repoPrereqs}
        isInstallingStudio={isInstallingStudio}
        onInstallStudio={installScyanStudio}
        isUninstallingStudio={isUninstallingStudio}
        onUninstallStudio={uninstallScyanStudio}
        onSearchClick={import.meta.env.DEV ? () => setIsCommandPaletteOpen(true) : undefined}
        onRestoreInitialValues={restoreInitialValues}
        onRestoreDefaults={restoreDefaults}
        unattachedDisplaysCount={unattachedScreens.length}
      />

      {/* Main Tab Navigation Bar */}
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
        </div>

        {/* Right-Aligned Dev Tabs (Dev-only) */}
        {import.meta.env.DEV && (
          <div className="flex items-center gap-1.5 ml-auto pl-3.5 border-l border-[#1e2538]/80">
            <span className="text-[9px] font-mono font-bold tracking-wider uppercase text-[#00f0ff]/60 px-1.5 py-0.5 rounded bg-[#00f0ff]/5 border border-[#00f0ff]/20">
              DEV
            </span>

            {/* Dev Tab 1: Design System */}
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

            {/* Dev Tab 2: Shields */}
            <button
              onClick={() => handleTabClick('shields')}
              className={`text-xs font-mono px-3.5 py-1.5 rounded-lg whitespace-nowrap transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === 'shields'
                  ? 'bg-[#00f0ff]/15 text-[#00f0ff] border border-[#00f0ff]/40 font-semibold shadow-[0_0_8px_rgba(0,240,255,0.2)]'
                  : 'text-[#94a3b8] hover:text-white hover:bg-[#131722] border border-transparent'
              }`}
              title="Known Keyboard Shields & Hardware Mounts (Dev-only)"
            >
              <Cpu className="size-3.5 text-[#00f0ff]" />
              <span>Shields</span>
            </button>

            {/* Dev Tab 3: Topology Sandbox */}
            <button
              onClick={() => handleTabClick('topology')}
              className={`text-xs font-mono px-3.5 py-1.5 rounded-lg whitespace-nowrap transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === 'topology'
                  ? 'bg-[#00f0ff]/15 text-[#00f0ff] border border-[#00f0ff]/40 font-semibold shadow-[0_0_8px_rgba(0,240,255,0.2)]'
                  : 'text-[#94a3b8] hover:text-white hover:bg-[#131722] border border-transparent'
              }`}
              title="Modular Shield Topology & Multi-Screen Sandbox (Dev-only)"
            >
              <Network className="size-3.5 text-[#00f0ff]" />
              <span>Topology</span>
            </button>
          </div>
        )}
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
            {activeTab === 'preview' && <OledPreviewTab />}

            {activeTab === 'symbols' && <SymbolsAtlasTab />}

            {activeTab === 'font' && <FontAtlasTab />}

            {activeTab === 'widgets' && <WidgetsTab />}

            {(activeTab === 'layout' || activeTab === 'blocks') && <BlocksTab />}

            {import.meta.env.DEV && (activeTab === 'reference' || activeTab === 'ui-elements' || activeTab === 'ui-elements-hero') && (
              <ElementReferencePage />
            )}

            {import.meta.env.DEV && activeTab === 'shields' && (
              <ShieldsTab
                symbolsGrid={symbolsGrid}
                symbolSlices={symbolSlices}
                fontGrid={fontGrid}
                fontGlyphs={fontGlyphs}
                fontMappings={fontMappings}
                centralBlocks={centralBlocks}
                peripheralBlocks={peripheralBlocks}
                idleCentralBlocks={idleCentralBlocks}
                idlePeripheralBlocks={idlePeripheralBlocks}
                instances={widgetInstances}
                customText={customText}
                onApplyDimensions={(dims, rightDims, rot) => {
                  handleCentralDimensionsChange(dims);
                  if (rightDims) handlePeripheralDimensionsChange(rightDims);
                  if (rot !== undefined) handleRotationChange(rot);
                }}
                currentShieldId={shieldId}
                onSelectShield={(id) => {
                  setShieldId(id);
                  showToast('success', `Switched keyboard shield to: ${id}`);
                }}
                onNavigateToPreview={() => handleTabClick('preview')}
              />
            )}

            {import.meta.env.DEV && activeTab === 'topology' && (
              <TopologySandboxTab
                symbolsGrid={symbolsGrid}
                symbolSlices={symbolSlices}
                fontGrid={fontGrid}
                fontGlyphs={fontGlyphs}
                fontMappings={fontMappings}
                centralBlocks={centralBlocks}
                peripheralBlocks={peripheralBlocks}
                idleCentralBlocks={idleCentralBlocks}
                idlePeripheralBlocks={idlePeripheralBlocks}
                enabledScreens={enabledScreens}
                peripheralScreens={peripheralScreens}
                screenDimensions={screenDimensions}
                peripheralScreenDimensions={peripheralScreenDimensions}
                instances={widgetInstances}
                customText={customText}
                displayAssignments={displayAssignments}
                onDisplayAssignmentsChange={setDisplayAssignments}
                onSwapDisplays={swapDisplays}
                onMakeMaster={makeMaster}
                onNavigateToPreview={() => handleTabClick('preview')}
              />
            )}
          </>
        )}
      </main>

      {/* Floating Toast notifications */}
      {toasts.length > 0 && (
        <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none">
          {toasts.map((t: ToastMessage) => (
            <div
              key={t.id}
              className={`pointer-events-auto p-4 rounded-xl border shadow-2xl backdrop-blur-lg flex items-start gap-3 transition-all ${
                t.type === 'success'
                  ? 'bg-[#0b0d13]/95 border-[#00f0ff]/50 text-white shadow-[0_0_24px_rgba(0,240,255,0.2)]'
                  : t.type === 'warning'
                  ? 'bg-[#0b0d13]/95 border-amber-500/60 text-white shadow-[0_0_24px_rgba(245,158,11,0.2)]'
                  : 'bg-[#0b0d13]/95 border-[#f2741d]/50 text-white shadow-[0_0_24px_rgba(242,116,29,0.2)]'
              }`}
            >
              {t.type === 'success' ? (
                <CheckCircle2 size={16} className="text-[#00f0ff] shrink-0 mt-0.5" />
              ) : t.type === 'warning' ? (
                <AlertCircle size={16} className="text-amber-400 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle size={16} className="text-[#f2741d] shrink-0 mt-0.5" />
              )}
              <div className="flex-1 min-w-0">
                <h4 className="text-xs font-bold">
                  {t.type === 'success' ? 'Success' : t.type === 'warning' ? 'Warning' : 'Error'}
                </h4>
                <p className="text-xs text-[#94a3b8] mt-0.5 leading-relaxed">{t.message}</p>
              </div>
              <button
                onClick={() => removeToast(t.id)}
                className="text-[#94a3b8] hover:text-white transition-colors cursor-pointer p-0.5"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Command Palette Modal (Ctrl+K) - Dev Only */}
      {import.meta.env.DEV && (
        <CommandPalette
          isOpen={isCommandPaletteOpen}
          onClose={setIsCommandPaletteOpen}
          onSelectSection={(sectionId) => {
            if (['preview', 'symbols', 'font', 'widgets', 'layout', 'blocks', 'shields', 'topology'].includes(sectionId)) {
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

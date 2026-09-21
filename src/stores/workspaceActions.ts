import {
  getDefaultAssets,
  parseCHeader,
  generateCHeader,
  type ParsedAssets,
  type HeaderMetadata,
  type PeripheralScreenData,
} from '../services/cHeaderParser';
import {
  checkRepoPrerequisites,
  fetchFileFromRepo,
  installScyanStudioToRepo,
  uninstallScyanStudioFromRepo,
  commitStudioSaveToRepo,
} from '../services/githubService';
import {
  fetchRepoKeymap,
  parseZmkKeymap,
  inferShieldFromRepo,
} from '../services/keymapService';
import { detectShieldUnitsFromRepo, getShieldDefinition } from '../data/shieldsData';
import { trackEvent } from '../services/analytics';
import { useAtlasStore, cloneParsedAssets } from './useAtlasStore';
import { useLayoutStore } from './useLayoutStore';
import { useGitHubStore } from './useGitHubStore';
import { useUiStore } from './useUiStore';

export const applyParsedAssets = (parsed: ParsedAssets) => {
  useAtlasStore.getState().applyAtlasAssets(parsed);
  if (parsed.metadata) {
    useLayoutStore.getState().applyLayoutMetadata(parsed.metadata);
  }
};

export const applyDefaults = () => {
  useAtlasStore.getState().resetAtlasDefaults();
  useLayoutStore.getState().resetLayoutDefaults();
  useUiStore.getState().setCustomText('BRUNOWB');
};

export const restoreInitialValues = () => {
  const initial = useAtlasStore.getState().initialAssets;
  if (initial) {
    applyParsedAssets(cloneParsedAssets(initial));
    useUiStore.getState().showToast('success', 'Workspace restored to initial values.');
  } else {
    applyDefaults();
    useUiStore.getState().showToast('success', 'Workspace restored to initial values.');
  }
};

export const restoreDefaults = () => {
  applyDefaults();
  useUiStore.getState().showToast('success', 'Workspace restored to base factory defaults.');
};

export const initializeWorkspace = async () => {
  const gitHubStore = useGitHubStore.getState();
  const uiStore = useUiStore.getState();
  const atlasStore = useAtlasStore.getState();
  const layoutStore = useLayoutStore.getState();

  uiStore.setIsInitialLoading(true);

  const { config } = gitHubStore;

  if (!config.token || !config.owner || !config.repo) {
    applyDefaults();
    atlasStore.setInitialAssets(getDefaultAssets());
    gitHubStore.setConnection({
      status: 'disconnected',
      user: null,
      repo: null,
      errorMessage: null,
      lastCheckedAt: Date.now(),
      resolvedOwner: null,
      resolvedRepo: null,
    });
    gitHubStore.setRepoPrereqs(null);
    uiStore.setIsInitialLoading(false);
    return;
  }

  try {
    const connResult = await gitHubStore.testConnection(config);

    if (connResult.status === 'connected') {
      try {
        const activeOwner = connResult.resolvedOwner || config.owner;
        const activeRepo = connResult.resolvedRepo || config.repo;
        const activeBranch = connResult.repo?.defaultBranch || config.branch || 'main';
        const fetchConfig = { ...config, owner: activeOwner, repo: activeRepo, branch: activeBranch };

        const prereqs = await checkRepoPrerequisites(fetchConfig);
        gitHubStore.setRepoPrereqs(prereqs);

        if (prereqs.hasAssetsHeader) {
          const fileData = await fetchFileFromRepo(fetchConfig, 'config/scyan_assets.h');

          if (fileData.content) {
            const parsed = parseCHeader(fileData.content);
            applyParsedAssets(parsed);
            atlasStore.setInitialAssets(parsed);
            gitHubStore.setCurrentSha(fileData.sha);
            if (fileData.resolvedPath) {
              gitHubStore.setCurrentHeaderPath(fileData.resolvedPath);
            }
            try {
              localStorage.setItem('zmk_builder_cached_header', fileData.content);
            } catch {}
            uiStore.showToast('success', `Loaded display assets from ${activeOwner}/${activeRepo}!`);
          } else {
            applyDefaults();
            atlasStore.setInitialAssets(getDefaultAssets());
          }
        } else {
          applyDefaults();
          atlasStore.setInitialAssets(getDefaultAssets());
          try {
            const confCandidates = prereqs.candidateConfFiles || (prereqs.confPath ? [prereqs.confPath] : undefined);
            const inferred = inferShieldFromRepo(activeRepo, undefined, confCandidates);
            if (inferred) {
              layoutStore.applyShieldDetectionIfUnset(inferred.shieldId, 'repository config');
            }
          } catch (detectErr) {
            console.warn('Pre-install shield inference warning:', detectErr);
          }
        }

        try {
          const confCandidates = prereqs.candidateConfFiles || (prereqs.confPath ? [prereqs.confPath] : undefined);
          const detected = detectShieldUnitsFromRepo(
            layoutStore.shieldId,
            confCandidates,
            undefined,
            prereqs.buildYamlContent
          );
          layoutStore.reconcileDetectedShields(detected, `${activeOwner}/${activeRepo}`);
        } catch (shieldErr) {
          console.warn('Shield detection warning:', shieldErr);
        }
      } catch {
        console.info('No scyan_assets.h in repo (first time setup). Loading defaults.');
        applyDefaults();
        atlasStore.setInitialAssets(getDefaultAssets());
      }
    } else {
      applyDefaults();
      atlasStore.setInitialAssets(getDefaultAssets());
    }
  } catch (err) {
    console.warn('Initial workspace loading error:', err);
    applyDefaults();
  } finally {
    uiStore.setIsInitialLoading(false);
  }
};

export const syncRepoAssets = async () => {
  const gitHubStore = useGitHubStore.getState();
  const uiStore = useUiStore.getState();
  const atlasStore = useAtlasStore.getState();
  const layoutStore = useLayoutStore.getState();

  const isConnected = gitHubStore.connection.status === 'connected';
  const { config } = gitHubStore;

  if (!isConnected) {
    uiStore.setIsSettingsOpen(true);
    uiStore.showToast('error', 'Connect your GitHub repository before syncing.');
    return;
  }

  try {
    gitHubStore.setIsSyncing(true);
    gitHubStore.triggerSync();

    try {
      const prereqs = await checkRepoPrerequisites(config);
      gitHubStore.setRepoPrereqs(prereqs);

      if (prereqs.hasAssetsHeader) {
        const fileData = await fetchFileFromRepo(config, 'config/scyan_assets.h');
        const parsed = parseCHeader(fileData.content);
        applyParsedAssets(parsed);
        atlasStore.setInitialAssets(parsed);
        gitHubStore.setCurrentSha(fileData.sha);
        if (fileData.resolvedPath) {
          gitHubStore.setCurrentHeaderPath(fileData.resolvedPath);
        }
        try {
          localStorage.setItem('zmk_builder_cached_header', fileData.content);
        } catch {}
        uiStore.showToast('success', `Synced display assets from ${config.owner}/${config.repo}!`);
      } else {
        uiStore.showToast(
          'success',
          `Synced repository from ${config.owner}/${config.repo}! (Display assets not installed yet)`
        );
        try {
          const confCandidates = prereqs.candidateConfFiles || (prereqs.confPath ? [prereqs.confPath] : undefined);
          const inferred = inferShieldFromRepo(config.repo, undefined, confCandidates);
          if (inferred) {
            layoutStore.applyShieldDetectionIfUnset(inferred.shieldId, 'repository config');
          }
        } catch (inferErr) {
          console.warn('Sync shield inference error:', inferErr);
        }
      }

      try {
        const confCandidates = prereqs.candidateConfFiles || (prereqs.confPath ? [prereqs.confPath] : undefined);
        const detected = detectShieldUnitsFromRepo(
          layoutStore.shieldId,
          confCandidates,
          undefined,
          prereqs.buildYamlContent
        );
        layoutStore.reconcileDetectedShields(detected, `${config.owner}/${config.repo}`);
      } catch (shieldErr) {
        console.warn('Sync shield detection warning:', shieldErr);
      }

      try {
        const keymapResult = await fetchRepoKeymap(config);
        if (keymapResult && keymapResult.content) {
          const parsedKm = parseZmkKeymap(keymapResult.content, keymapResult.filename);
          layoutStore.setKeymapLayout(parsedKm);
          if (!prereqs.hasAssetsHeader && parsedKm.shieldId && parsedKm.shieldId !== 'unknown') {
            layoutStore.applyShieldDetectionIfUnset(parsedKm.shieldId, keymapResult.filename);
          }
        }
      } catch (kmErr) {
        console.warn('Failed to fetch keymap during repo sync:', kmErr);
      }
    } catch (assetErr: any) {
      console.warn('Sync failed:', assetErr);
      uiStore.showToast('error', `Sync failed: ${assetErr.message || 'Could not fetch file'}`);
    }
  } catch (err: any) {
    console.error('Sync failed:', err);
    uiStore.showToast('error', `Sync failed: ${err.message || 'Could not fetch file'}`);
  } finally {
    gitHubStore.setIsSyncing(false);
  }
};

export const installScyanStudio = async () => {
  const gitHubStore = useGitHubStore.getState();
  const uiStore = useUiStore.getState();
  const atlasStore = useAtlasStore.getState();
  const layoutStore = useLayoutStore.getState();

  const isConnected = gitHubStore.connection.status === 'connected';
  const { config } = gitHubStore;

  if (!isConnected || !config.token || !config.owner || !config.repo) {
    uiStore.setIsSettingsOpen(true);
    uiStore.showToast('error', 'Connect your GitHub repository before installing.');
    return;
  }

  try {
    gitHubStore.setIsInstallingStudio(true);

    const isSplitKeyboard =
      layoutStore.loadedShields.length > 0
        ? layoutStore.loadedShields.length > 1 && !layoutStore.loadedShields.every((s) => s.side === 'single')
        : getShieldDefinition(layoutStore.shieldId).category === 'split-pair';

    const effCentralShield =
      layoutStore.loadedShields.find((s) => s.isMaster || s.side === 'left') || layoutStore.loadedShields[0];
    const effPeripheralShield = layoutStore.loadedShields.find((s) => s.id !== effCentralShield?.id);

    const centralDispId = effCentralShield
      ? layoutStore.displayAssignments[effCentralShield.id] ?? 'display-1'
      : 'display-1';
    const peripheralDispId = effPeripheralShield
      ? layoutStore.displayAssignments[effPeripheralShield.id] ?? 'display-2'
      : 'display-2';

    const hasPeripheralScreen = Boolean(
      isSplitKeyboard &&
      effPeripheralShield &&
      layoutStore.displayAssignments[effPeripheralShield.id] !== null
    );

    const centralData = layoutStore.getScreenData(centralDispId || 'display-1');
    const peripheralData = layoutStore.getScreenData(peripheralDispId || 'display-2');

    const metadata: HeaderMetadata = {
      version: 2,
      displays: layoutStore.displays,
      shields: layoutStore.loadedShields,
      displayAssignments: layoutStore.displayAssignments,
      centralBlocks: centralData.blocks,
      peripheralBlocks: hasPeripheralScreen ? peripheralData.blocks : [],
      idleCentralBlocks: centralData.idleBlocks,
      idlePeripheralBlocks: hasPeripheralScreen ? peripheralData.idleBlocks : [],
      screenDimensions: centralData.dimensions,
      rotation: centralData.rotation,
      widgetInstances: layoutStore.widgetInstances,
      idleTimeoutSec: centralData.idleTimeoutSec,
      screenOffTimeoutSec: centralData.screenOffTimeoutSec,
      idleScreensEnabled: centralData.idleScreensEnabled,
      symmetricSettings: layoutStore.symmetricSettings,
      peripheralScreenDimensions: layoutStore.symmetricSettings ? undefined : peripheralData.dimensions,
      peripheralRotation: layoutStore.symmetricSettings ? undefined : peripheralData.rotation,
      peripheralIdleScreensEnabled: layoutStore.symmetricSettings ? undefined : peripheralData.idleScreensEnabled,
      peripheralIdleTimeoutSec: layoutStore.symmetricSettings ? undefined : peripheralData.idleTimeoutSec,
      peripheralScreenOffTimeoutSec: layoutStore.symmetricSettings ? undefined : peripheralData.screenOffTimeoutSec,
      shieldId: layoutStore.shieldId,
      enabledScreens: layoutStore.enabledScreens,
      peripheralScreens:
        Object.keys(layoutStore.peripheralScreens).length > 0 ? layoutStore.peripheralScreens : undefined,
      layerNames: layoutStore.keymapLayout.layerNames,
    };

    const defaultC = generateCHeader(
      atlasStore.symbolsGrid,
      atlasStore.symbolSlices,
      atlasStore.fontGrid,
      atlasStore.fontMappings,
      metadata
    );

    const res = await installScyanStudioToRepo(config, defaultC);

    const updatedPrereqs = await checkRepoPrerequisites(config, res.commitSha);
    gitHubStore.setRepoPrereqs(updatedPrereqs);
    gitHubStore.setCurrentSha(res.commitSha);
    gitHubStore.setCurrentHeaderPath('config/scyan_assets.h');
    try {
      localStorage.setItem('zmk_builder_cached_header', defaultC);
    } catch {}
    layoutStore.markDimensionsCustomized();

    uiStore.showToast(
      'success',
      `Scyan Studio successfully installed in ${config.owner}/${config.repo}! Firmware build started in GitHub Actions.`
    );
    trackEvent('studio_installed', {
      repo: `${config.owner}/${config.repo}`,
    });
  } catch (err: any) {
    console.error('Failed to install Scyan Studio:', err);
    uiStore.showToast('error', `Installation failed: ${err.message || 'Check repository permissions'}`);
  } finally {
    gitHubStore.setIsInstallingStudio(false);
  }
};

export const uninstallScyanStudio = async () => {
  const gitHubStore = useGitHubStore.getState();
  const uiStore = useUiStore.getState();
  const { config } = gitHubStore;

  if (!config.token || !config.owner || !config.repo) {
    uiStore.showToast('error', 'Connect your GitHub repository before uninstalling.');
    return;
  }

  try {
    gitHubStore.setIsUninstallingStudio(true);
    await uninstallScyanStudioFromRepo(config);
    trackEvent('studio_uninstalled', {
      repo: `${config.owner}/${config.repo}`,
    });

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
    keysToRemove.forEach((k) => {
      try {
        localStorage.removeItem(k);
      } catch {}
    });
    try {
      sessionStorage.clear();
    } catch {}

    uiStore.showToast(
      'success',
      `Scyan Studio successfully uninstalled from ${config.owner}/${config.repo}! Reloading...`
    );
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  } catch (err: any) {
    console.error('Failed to uninstall Scyan Studio:', err);
    uiStore.showToast('error', `Uninstallation failed: ${err.message || 'Check repository permissions'}`);
    gitHubStore.setIsUninstallingStudio(false);
  }
};

export const saveWorkspaceToRepo = async () => {
  const gitHubStore = useGitHubStore.getState();
  const uiStore = useUiStore.getState();
  const atlasStore = useAtlasStore.getState();
  const layoutStore = useLayoutStore.getState();

  const isConnected = gitHubStore.connection.status === 'connected';
  const { config, connection } = gitHubStore;

  if (!isConnected || !config.owner || !config.repo) {
    uiStore.setIsSettingsOpen(true);
    uiStore.showToast('error', 'Please configure and connect a valid GitHub repository in settings first.');
    return;
  }

  if (!connection.repo?.hasPushAccess) {
    uiStore.showToast('error', 'Your token lacks push permissions for this repository.');
    return;
  }

  if (connection.repo && connection.repo.name !== config.repo) {
    uiStore.showToast(
      'error',
      `Config mismatch: connection was verified for "${connection.repo.name}" but config targets "${config.repo}". ` +
        `Re-open Settings to re-verify the connection.`
    );
    return;
  }

  try {
    gitHubStore.setIsSaving(true);

    const currentShieldIds = new Set(layoutStore.loadedShields.map((s) => s.id));
    const attachedDisplayIds = new Set<string>();
    for (const [shieldKey, dispId] of Object.entries(layoutStore.displayAssignments)) {
      if (dispId && currentShieldIds.has(shieldKey)) {
        attachedDisplayIds.add(dispId);
      }
    }
    const unattachedScreens = layoutStore.enabledScreens.filter((s) => !attachedDisplayIds.has(s));

    if (unattachedScreens.length > 0) {
      uiStore.showToast(
        'warning',
        `Warning: ${unattachedScreens.length} display(s) (${unattachedScreens.join(', ')}) are not attached and won't be saved when committing.`
      );
    }

    const screensToCommit = layoutStore.enabledScreens.filter((s) => attachedDisplayIds.has(s));
    const peripheralScreensToCommit: Record<string, PeripheralScreenData> = {};
    Object.entries(layoutStore.peripheralScreens).forEach(([k, v]) => {
      if (attachedDisplayIds.has(k)) {
        peripheralScreensToCommit[k] = v;
      }
    });

    const effCentralShield =
      layoutStore.loadedShields.find((s) => s.isMaster) ||
      layoutStore.loadedShields.find((s) => s.side === 'left') ||
      layoutStore.loadedShields[0];
    const effPeripheralShield = layoutStore.loadedShields.find((s) => s.id !== effCentralShield?.id);

    const isSplitKeyboard =
      layoutStore.loadedShields.length > 0
        ? layoutStore.loadedShields.length > 1 && !layoutStore.loadedShields.every((s) => s.side === 'single')
        : getShieldDefinition(layoutStore.shieldId).category === 'split-pair';
    const hasPeripheralScreen = Boolean(
      isSplitKeyboard &&
      effPeripheralShield &&
      (screensToCommit.includes('peripheral') ||
        (layoutStore.displayAssignments[effPeripheralShield.id] &&
          screensToCommit.includes(layoutStore.displayAssignments[effPeripheralShield.id]!)))
    );

    const centralDispId = effCentralShield
      ? layoutStore.displayAssignments[effCentralShield.id] ?? 'central'
      : 'central';
    const peripheralDispId = effPeripheralShield
      ? layoutStore.displayAssignments[effPeripheralShield.id] ?? 'peripheral'
      : 'peripheral';

    const centralData = layoutStore.getScreenData(centralDispId || 'central');
    const peripheralData = layoutStore.getScreenData(peripheralDispId || 'peripheral');

    const metadata: HeaderMetadata = {
      version: 2,
      displays: layoutStore.displays,
      shields: layoutStore.loadedShields,
      displayAssignments: layoutStore.displayAssignments,
      centralBlocks: centralData.blocks,
      peripheralBlocks: hasPeripheralScreen ? peripheralData.blocks : [],
      idleCentralBlocks: centralData.idleBlocks,
      idlePeripheralBlocks: hasPeripheralScreen ? peripheralData.idleBlocks : [],
      screenDimensions: centralData.dimensions,
      rotation: centralData.rotation,
      widgetInstances: layoutStore.widgetInstances,
      idleTimeoutSec: centralData.idleTimeoutSec,
      screenOffTimeoutSec: centralData.screenOffTimeoutSec,
      idleScreensEnabled: centralData.idleScreensEnabled,
      symmetricSettings: layoutStore.symmetricSettings,
      peripheralScreenDimensions: (!isSplitKeyboard || layoutStore.symmetricSettings) ? undefined : peripheralData.dimensions,
      peripheralRotation: (!isSplitKeyboard || layoutStore.symmetricSettings) ? undefined : peripheralData.rotation,
      peripheralIdleScreensEnabled: (!isSplitKeyboard || layoutStore.symmetricSettings) ? undefined : peripheralData.idleScreensEnabled,
      peripheralIdleTimeoutSec: (!isSplitKeyboard || layoutStore.symmetricSettings) ? undefined : peripheralData.idleTimeoutSec,
      peripheralScreenOffTimeoutSec: (!isSplitKeyboard || layoutStore.symmetricSettings) ? undefined : peripheralData.screenOffTimeoutSec,
      shieldId: layoutStore.shieldId,
      enabledScreens: screensToCommit.length > 0 ? screensToCommit : ['central'],
      peripheralScreens:
        Object.keys(peripheralScreensToCommit).length > 0 ? peripheralScreensToCommit : undefined,
      layerNames: layoutStore.keymapLayout?.layerNames,
    };

    const { symbolsGrid, symbolSlices: symbolsMeta, fontGrid, fontMappings: fontMeta } = atlasStore;
    const generatedC = generateCHeader(
      symbolsGrid,
      symbolsMeta,
      fontGrid,
      fontMeta,
      metadata
    );

    const targetPath = gitHubStore.currentHeaderPath || 'config/scyan_assets.h';
    const rightIsCentral = effCentralShield?.side === 'right';
    const commitRes = await commitStudioSaveToRepo(
      config,
      targetPath,
      generatedC,
      {
        screenOffTimeoutSec: layoutStore.screenOffTimeoutSec,
        peripheralScreenOffTimeoutSec: layoutStore.peripheralScreenOffTimeoutSec,
        rightScreenOffTimeoutSec: layoutStore.peripheralScreenOffTimeoutSec,
        symmetricSettings: layoutStore.symmetricSettings,
      },
      '[Scyan Studio] feat(display): update 2-Atlas display spritesheets & glyph tables via Scyan ZMK Studio',
      { isSplit: isSplitKeyboard, rightIsCentral, displayAssignments: layoutStore.displayAssignments }
    );

    gitHubStore.setCurrentSha(commitRes.commitSha);
    gitHubStore.setCurrentHeaderPath(targetPath);
    try {
      localStorage.setItem('zmk_builder_cached_header', generatedC);
    } catch {}

    const savedParsed = parseCHeader(generatedC);
    atlasStore.setInitialAssets(savedParsed);

    const nowStr = new Date().toLocaleTimeString();
    gitHubStore.setLastSavedAt(nowStr);

    const fileListMsg =
      commitRes.filesCommitted.length > 1 ? ` (${commitRes.filesCommitted.join(', ')})` : '';
    uiStore.showToast(
      'success',
      `Committed to ${config.branch}!${fileListMsg} GitHub Actions firmware build started.`
    );
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
    uiStore.showToast('error', `Save failed: ${msg}`);
    trackEvent('github_push_failed', {
      error: msg,
    });
  } finally {
    gitHubStore.setIsSaving(false);
  }
};

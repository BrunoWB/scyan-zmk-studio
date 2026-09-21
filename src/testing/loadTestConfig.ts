import { useGitHubStore } from '../stores/useGitHubStore';
import { useLayoutStore } from '../stores/useLayoutStore';
import { useUiStore } from '../stores/useUiStore';
import { detectShieldUnitsFromRepo, getShieldDefaultResolution, getShieldDefaultRotation } from '../data/shieldsData';
import { parseZmkKeymap } from '../services/keymapService';
import { TEST_KEYBOARD_CONFIGS } from './testConfigs';

/**
 * Loads a test keyboard configuration into the live Scyan ZMK Studio stores.
 * Simulates repository discovery, keymap parsing, and shield unit reconciliation.
 */
export function loadTestConfigIntoStudio(configId: string): boolean {
  const config = TEST_KEYBOARD_CONFIGS.find((c) => c.id === configId);
  if (!config) {
    console.error(`[loadTestConfig] Config not found: ${configId}`);
    return false;
  }

  const gitHubStore = useGitHubStore.getState();
  const layoutStore = useLayoutStore.getState();
  const uiStore = useUiStore.getState();

  // 1. Simulate GitHub connection
  gitHubStore.setConnection({
    status: 'connected',
    user: {
      login: config.repo.owner,
      name: config.repo.owner,
      avatarUrl: 'https://github.com/github.png',
    },
    repo: {
      name: config.repo.repo,
      fullName: `${config.repo.owner}/${config.repo.repo}`,
      isPrivate: false,
      hasPushAccess: true,
      defaultBranch: config.repo.branch,
      description: config.description,
    },
    errorMessage: null,
    lastCheckedAt: Date.now(),
    resolvedOwner: config.repo.owner,
    resolvedRepo: config.repo.repo,
  });

  gitHubStore.setConfig({
    owner: config.repo.owner,
    repo: config.repo.repo,
    branch: config.repo.branch,
    token: 'ghp_mockTestingTokenForLocalDevelopmentOnly12345',
  });

  const candidateConfPaths = config.confFiles.map((c) => c.path);
  gitHubStore.setRepoPrereqs({
    isInstalled: true,
    hasWestModule: true,
    hasKconfig: true,
    hasAssetsHeader: false,
    confPath: candidateConfPaths[0] || 'config/corne.conf',
    candidateConfFiles: candidateConfPaths,
    westPath: 'config/west.yml',
    headerPath: 'config/scyan_assets.h',
    existingConfContent: config.confFiles[0]?.content,
    buildYamlContent: config.buildYaml,
  });

  // 2. Parse Keymap if present
  try {
    if (config.keymapFile) {
      const parsedKeymap = parseZmkKeymap(config.keymapFile.content, config.keymapFile.path);
      layoutStore.setKeymapLayout(parsedKeymap);
    }
  } catch (err) {
    console.warn('[loadTestConfig] Failed to parse keymap:', err);
  }

  // 3. Detect and reconcile shield units
  try {
    const primaryId = config.topology.type === 'unibody' ? config.expectedShieldIds[0] : 'corne';
    const detectedUnits = detectShieldUnitsFromRepo(
      primaryId,
      candidateConfPaths,
      [config.keymapFile.path],
      config.buildYaml
    );

    layoutStore.reconcileDetectedShields(detectedUnits, `${config.repo.owner}/${config.repo.repo}`);

    // If config specifies expected enabled screens, apply them
    if (config.expectedEnabledScreens && config.expectedEnabledScreens.length > 0) {
      layoutStore.setEnabledScreens(config.expectedEnabledScreens);
    }

    // Set shield ID & align canvas dimensions
    const activeShieldId = detectedUnits[0]?.shieldId || primaryId;
    layoutStore.setShieldId(activeShieldId);
    const defaultRes = getShieldDefaultResolution(activeShieldId);
    const defaultRot = getShieldDefaultRotation(activeShieldId);
    layoutStore.handleCentralDimensionsChange(defaultRes);
    layoutStore.handlePeripheralDimensionsChange(defaultRes);
    layoutStore.setRotation(defaultRot);
    layoutStore.setPeripheralRotation(defaultRot);
  } catch (err) {
    console.warn('[loadTestConfig] Shield detection error:', err);
  }

  uiStore.showToast('success', `Loaded test configuration: "${config.name}"`);
  return true;
}

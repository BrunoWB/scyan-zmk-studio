import { create } from 'zustand';
import type {
  GitHubRepoConfig,
  GitHubConnectionState,
  RepoPrerequisites,
} from '../services/githubService';
import {
  getStoredGitHubConfig,
  saveStoredGitHubConfig,
  verifyGitHubConnection,
  clearStoredGitHubToken,
} from '../services/githubService';
import { trackEvent } from '../services/analytics';
import { useUiStore } from './useUiStore';
import { useLayoutStore } from './useLayoutStore';

export interface GitHubState {
  config: GitHubRepoConfig;
  connection: GitHubConnectionState;
  repoPrereqs: RepoPrerequisites | null;
  currentSha: string | undefined;
  currentHeaderPath: string;
  lastSavedAt: string | null;
  isSyncing: boolean;
  isSaving: boolean;
  isInstallingStudio: boolean;
  isUninstallingStudio: boolean;
  syncTrigger: number;
  autoSyncedRepo: string | null;

  setConfig: (updater: GitHubRepoConfig | ((prev: GitHubRepoConfig) => GitHubRepoConfig)) => void;
  setConnection: (updater: GitHubConnectionState | ((prev: GitHubConnectionState) => GitHubConnectionState)) => void;
  setRepoPrereqs: (prereqs: RepoPrerequisites | null) => void;
  setCurrentSha: (sha: string | undefined) => void;
  setCurrentHeaderPath: (path: string) => void;
  setLastSavedAt: (time: string | null) => void;
  setIsSyncing: (isSyncing: boolean) => void;
  setIsSaving: (isSaving: boolean) => void;
  setIsInstallingStudio: (isInstalling: boolean) => void;
  setIsUninstallingStudio: (isUninstalling: boolean) => void;
  triggerSync: () => void;
  setAutoSyncedRepo: (repoKey: string | null) => void;
  testConnection: (cfg?: GitHubRepoConfig) => Promise<GitHubConnectionState>;
  disconnect: () => void;
}

const getInitialLastSavedAt = (): string | null => {
  try {
    return localStorage.getItem('zmk_builder_last_saved_at');
  } catch {}
  return null;
};

export const useGitHubStore = create<GitHubState>((set, get) => ({
  config: getStoredGitHubConfig(),
  connection: {
    status: 'connecting',
    user: null,
    repo: null,
    errorMessage: null,
    lastCheckedAt: null,
    resolvedOwner: null,
    resolvedRepo: null,
  },
  repoPrereqs: null,
  currentSha: undefined,
  currentHeaderPath: 'config/scyan_assets.h',
  lastSavedAt: getInitialLastSavedAt(),
  isSyncing: false,
  isSaving: false,
  isInstallingStudio: false,
  isUninstallingStudio: false,
  syncTrigger: 0,
  autoSyncedRepo: null,

  setConfig: (updater) => {
    set((state) => {
      const next = typeof updater === 'function' ? updater(state.config) : updater;
      saveStoredGitHubConfig(next);
      return { config: next };
    });
  },

  setConnection: (updater) => {
    set((state) => ({
      connection: typeof updater === 'function' ? updater(state.connection) : updater,
    }));
  },

  setRepoPrereqs: (prereqs) => set({ repoPrereqs: prereqs }),

  setCurrentSha: (sha) => set({ currentSha: sha }),

  setCurrentHeaderPath: (path) => set({ currentHeaderPath: path }),

  setLastSavedAt: (time) => {
    if (time) {
      try {
        localStorage.setItem('zmk_builder_last_saved_at', time);
      } catch {}
    } else {
      try {
        localStorage.removeItem('zmk_builder_last_saved_at');
      } catch {}
    }
    set({ lastSavedAt: time });
  },

  setIsSyncing: (isSyncing) => set({ isSyncing }),

  setIsSaving: (isSaving) => set({ isSaving }),

  setIsInstallingStudio: (isInstallingStudio) => set({ isInstallingStudio }),

  setIsUninstallingStudio: (isUninstallingStudio) => set({ isUninstallingStudio }),

  triggerSync: () => set((state) => ({ syncTrigger: state.syncTrigger + 1 })),

  setAutoSyncedRepo: (autoSyncedRepo) => set({ autoSyncedRepo }),

  testConnection: async (cfg?: GitHubRepoConfig) => {
    const targetConfig = cfg ?? get().config;
    set((state) => ({
      connection: { ...state.connection, status: 'connecting' },
    }));

    const result = await verifyGitHubConnection(targetConfig);
    set({ connection: result });

    if (result.status === 'connected') {
      trackEvent('github_connected', {
        has_push_access: Boolean(result.repo?.hasPushAccess),
      });
    } else if (result.status === 'error') {
      trackEvent('github_connect_failed', {
        error: result.errorMessage ?? 'Connection failed',
      });
    }

    let updatedCfg = { ...targetConfig };
    let configChanged = false;

    if (result.resolvedOwner && result.resolvedOwner !== targetConfig.owner) {
      updatedCfg = { ...updatedCfg, owner: result.resolvedOwner };
      configChanged = true;
    }
    if (result.resolvedRepo && result.resolvedRepo !== targetConfig.repo) {
      updatedCfg = { ...updatedCfg, repo: result.resolvedRepo };
      configChanged = true;
    }
    if (result.status === 'connected' && result.repo?.defaultBranch) {
      if (
        updatedCfg.branch !== result.repo.defaultBranch &&
        (updatedCfg.branch === 'master' || !updatedCfg.branch)
      ) {
        updatedCfg = { ...updatedCfg, branch: result.repo.defaultBranch };
        configChanged = true;
      }
    }

    if (configChanged) {
      set({ config: updatedCfg });
      saveStoredGitHubConfig(updatedCfg);
    }

    return result;
  },

  disconnect: () => {
    clearStoredGitHubToken();
    try {
      localStorage.removeItem('zmk_builder_cached_header');
    } catch {}
    useLayoutStore.getState().markDimensionsReset();
    const newConfig = { ...get().config, token: '' };
    set({
      autoSyncedRepo: null,
      config: newConfig,
      connection: {
        status: 'disconnected',
        user: null,
        repo: null,
        errorMessage: null,
        lastCheckedAt: Date.now(),
        resolvedOwner: null,
        resolvedRepo: null,
      },
    });
    useUiStore.getState().showToast('success', 'GitHub repository disconnected.');
  },
}));

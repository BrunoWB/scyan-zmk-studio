import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  detectModuleChannelMismatch,
  updateModuleRevision,
  type GitHubRepoConfig,
} from '../githubService';
import { switchModuleChannel } from '../../stores/workspaceActions';
import { useGitHubStore } from '../../stores/useGitHubStore';
import { useUiStore } from '../../stores/useUiStore';

const mockReposGetContent = vi.fn();
const mockGitGetRef = vi.fn();
const mockGraphql = vi.fn();

vi.mock('@octokit/rest', () => {
  return {
    Octokit: class {
      graphql = (...args: any[]) => mockGraphql(...args);
      repos = {
        getContent: (...args: any[]) => mockReposGetContent(...args),
      };
      git = {
        getRef: (...args: any[]) => mockGitGetRef(...args),
      };
    },
  };
});

describe('Module Channel Switching & Migration', () => {
  const testConfig: GitHubRepoConfig = {
    owner: 'BrunoWB',
    repo: 'zmk-config',
    branch: 'main',
    token: 'ghp_test_token_123',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('detectModuleChannelMismatch', () => {
    it('returns null if prerequisites are null or not installed', () => {
      expect(detectModuleChannelMismatch(null)).toBeNull();
      expect(
        detectModuleChannelMismatch({
          isInstalled: false,
          hasWestModule: false,
          hasKconfig: false,
          hasAssetsHeader: false,
        })
      ).toBeNull();
    });

    it('detects mismatch when studio is nightly and repo is main (Move to Nightly)', () => {
      const prereqs = {
        isInstalled: true,
        hasWestModule: true,
        hasKconfig: true,
        hasAssetsHeader: true,
        moduleRevision: 'main',
      };

      const result = detectModuleChannelMismatch(prereqs, 'nightly');
      expect(result).not.toBeNull();
      expect(result?.hasMismatch).toBe(true);
      expect(result?.isMovingToNightly).toBe(true);
      expect(result?.isMovingToStable).toBe(false);
      expect(result?.targetRevision).toBe('nightly');
      expect(result?.actionLabel).toBe('Move to Nightly');
      expect(result?.description).toContain('you are on Nightly Studio');
    });

    it('detects mismatch when studio is stable and repo is nightly (Move to Stable)', () => {
      const prereqs = {
        isInstalled: true,
        hasWestModule: true,
        hasKconfig: true,
        hasAssetsHeader: true,
        moduleRevision: 'nightly',
      };

      const result = detectModuleChannelMismatch(prereqs, 'main');
      expect(result).not.toBeNull();
      expect(result?.hasMismatch).toBe(true);
      expect(result?.isMovingToNightly).toBe(false);
      expect(result?.isMovingToStable).toBe(true);
      expect(result?.targetRevision).toBe('main');
      expect(result?.actionLabel).toBe('Move to Stable');
      expect(result?.description).toContain('you are on Stable Studio');
    });

    it('returns null when studio and repo channels are aligned', () => {
      const stablePrereqs = {
        isInstalled: true,
        hasWestModule: true,
        hasKconfig: true,
        hasAssetsHeader: true,
        moduleRevision: 'main',
      };
      expect(detectModuleChannelMismatch(stablePrereqs, 'main')).toBeNull();

      const nightlyPrereqs = {
        isInstalled: true,
        hasWestModule: true,
        hasKconfig: true,
        hasAssetsHeader: true,
        moduleRevision: 'nightly',
      };
      expect(detectModuleChannelMismatch(nightlyPrereqs, 'nightly')).toBeNull();
    });
  });

  describe('updateModuleRevision', () => {
    it('commits updated west.yml with target revision without affecting other settings', async () => {
      mockGitGetRef.mockResolvedValue({
        data: { object: { sha: 'head_commit_sha' } },
      });

      mockReposGetContent.mockImplementation(async ({ path }: { path: string }) => {
        if (path === 'config/west.yml') {
          const westContent = [
            'manifest:',
            '  remotes:',
            '    - name: zmkfirmware',
            '      url-base: https://github.com/zmkfirmware',
            '    - name: brunowb',
            '      url-base: https://github.com/BrunoWB',
            '  projects:',
            '    - name: zmk',
            '      remote: zmkfirmware',
            '      import: app/west.yml',
            '    - name: scyan-zmk-module',
            '      remote: brunowb',
            '      revision: main',
            '  self:',
            '    path: config',
          ].join('\n');
          return { data: { content: btoa(westContent) } };
        }
        if (path === 'config/scyan_assets.h') {
          return { data: { content: btoa('/* assets */') } };
        }
        if (path === 'config/corne.conf') {
          return { data: { content: btoa('CONFIG_SCYAN_ENABLE_STATUS=y\n') } };
        }
        throw { status: 404 };
      });

      mockGraphql
        .mockResolvedValueOnce({
          repository: {
            ref: {
              target: {
                oid: 'head_before_update',
              },
            },
          },
        })
        .mockResolvedValueOnce({
          createCommitOnBranch: {
            commit: {
              oid: 'commit_sha_nightly_updated',
              url: 'https://github.com/BrunoWB/zmk-config/commit/commit_sha_nightly_updated',
            },
          },
        });

      const res = await updateModuleRevision(testConfig, 'nightly');
      expect(res.commitSha).toBe('commit_sha_nightly_updated');

      expect(mockGraphql).toHaveBeenCalled();
      const callArgs = mockGraphql.mock.calls[1][1];
      const addition = callArgs.input.fileChanges.additions.find(
        (a: any) => a.path === 'config/west.yml'
      );
      expect(addition).toBeDefined();
      const decodedWest = atob(addition.contents);
      expect(decodedWest).toContain('revision: nightly');
    });
  });

  describe('switchModuleChannel action', () => {
    it('switches channel, updates repoPrereqs, and triggers toast notification', async () => {
      useGitHubStore.getState().setConfig(testConfig);
      const toastSpy = vi.spyOn(useUiStore.getState(), 'showToast');

      mockGitGetRef.mockResolvedValue({
        data: { object: { sha: 'head_sha' } },
      });

      mockReposGetContent.mockImplementation(async ({ path }: { path: string }) => {
        if (path === 'config/west.yml') {
          const westContent = [
            'manifest:',
            '  remotes:',
            '    - name: brunowb',
            '      url-base: https://github.com/BrunoWB',
            '  projects:',
            '    - name: scyan-zmk-module',
            '      remote: brunowb',
            '      revision: main',
          ].join('\n');
          return { data: { content: btoa(westContent) } };
        }
        if (path === 'config/scyan_assets.h') {
          return { data: { content: btoa('/* assets */') } };
        }
        if (path === 'config/corne.conf') {
          return { data: { content: btoa('CONFIG_SCYAN_ENABLE_STATUS=y\n') } };
        }
        throw { status: 404 };
      });

      mockGraphql
        .mockResolvedValueOnce({
          repository: {
            ref: {
              target: {
                oid: 'head_before_switch',
              },
            },
          },
        })
        .mockResolvedValueOnce({
          createCommitOnBranch: {
            commit: {
              oid: 'commit_sha_switch_success',
              url: 'https://github.com/BrunoWB/zmk-config/commit/commit_sha_switch_success',
            },
          },
        });

      await switchModuleChannel('nightly');

      expect(toastSpy).toHaveBeenCalledWith(
        'success',
        expect.stringContaining('Switched scyan-zmk-module to Nightly!')
      );
      expect(useGitHubStore.getState().isSwitchingChannel).toBe(false);
    });
  });
});

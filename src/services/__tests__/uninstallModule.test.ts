import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  uninstallScyanStudioFromRepo,
  checkRepoPrerequisites,
  DEFAULT_HEADER_CANDIDATES,
  type GitHubRepoConfig,
} from '../githubService';

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

describe('Module Uninstallation & Header Cleanup', () => {
  const testConfig: GitHubRepoConfig = {
    owner: 'BrunoWB',
    repo: 'zmk-config',
    branch: 'main',
    token: 'ghp_test_token_123',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('DEFAULT_HEADER_CANDIDATES', () => {
    it('contains all standard and legacy asset header candidate locations', () => {
      expect(DEFAULT_HEADER_CANDIDATES).toContain('config/scyan_assets.h');
      expect(DEFAULT_HEADER_CANDIDATES).toContain('include/scyan_assets.h');
      expect(DEFAULT_HEADER_CANDIDATES).toContain('scyan_assets.h');
      expect(DEFAULT_HEADER_CANDIDATES).toContain('include/custom_display_assets.h');
    });
  });

  describe('checkRepoPrerequisites with multiple headers', () => {
    it('detects all existing header paths without breaking early on the first match', async () => {
      mockGitGetRef.mockResolvedValueOnce({
        data: { object: { sha: 'commit_sha_123' } },
      });

      mockReposGetContent.mockImplementation(async ({ path }: { path: string }) => {
        if (path === 'config/west.yml') {
          return { data: { content: btoa('manifest:\n  projects:\n    - name: scyan-zmk-module\n') } };
        }
        if (path === 'config/scyan_assets.h') {
          return { data: { content: btoa('// modern assets header') } };
        }
        if (path === 'include/scyan_assets.h') {
          return { data: { content: btoa('// legacy assets header') } };
        }
        if (path === 'config') {
          return {
            data: [
              { name: 'corne.conf', path: 'config/corne.conf', type: 'file' },
            ],
          };
        }
        if (path === 'config/corne.conf') {
          return { data: { content: btoa('CONFIG_ZMK_DISPLAY_STATUS_SCREEN_CUSTOM=y\n') } };
        }
        const err: any = new Error('Not found');
        err.status = 404;
        throw err;
      });

      const prereqs = await checkRepoPrerequisites(testConfig);

      expect(prereqs.hasAssetsHeader).toBe(true);
      expect(prereqs.headerPath).toBe('config/scyan_assets.h');
      expect(prereqs.existingHeaderPaths).toEqual([
        'config/scyan_assets.h',
        'include/scyan_assets.h',
      ]);
    });
  });

  describe('uninstallScyanStudioFromRepo', () => {
    it('deletes both primary and legacy scyan_assets.h locations so old atlases are never resurrected', async () => {
      mockGitGetRef.mockResolvedValue({
        data: { object: { sha: 'commit_sha_123' } },
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
          ].join('\n');
          return { data: { content: btoa(westContent) } };
        }
        if (path === 'config/scyan_assets.h') {
          return { data: { content: btoa('// current assets') } };
        }
        if (path === 'include/scyan_assets.h') {
          return { data: { content: btoa('// old assets from past setup') } };
        }
        if (path === 'config') {
          return {
            data: [
              { name: 'corne.conf', path: 'config/corne.conf', type: 'file' },
            ],
          };
        }
        if (path === 'config/corne.conf') {
          const conf = [
            'CONFIG_ZMK_DISPLAY=y',
            'CONFIG_SCYAN_ROTATION_90=y',
            'CONFIG_ZMK_DISPLAY_STATUS_SCREEN_CUSTOM=y',
          ].join('\n');
          return { data: { content: btoa(conf) } };
        }
        const err: any = new Error('Not found');
        err.status = 404;
        throw err;
      });

      mockGraphql
        .mockResolvedValueOnce({
          repository: {
            ref: {
              target: {
                oid: 'head_before_uninstall',
              },
            },
          },
        })
        .mockResolvedValueOnce({
          createCommitOnBranch: {
            commit: {
              oid: 'sha_uninstalled_999',
              url: 'https://github.com/BrunoWB/zmk-config/commit/sha_uninstalled_999',
            },
          },
        });

      const result = await uninstallScyanStudioFromRepo(testConfig);

      expect(result.commitSha).toBe('sha_uninstalled_999');

      // Verify GraphQL mutation fileChanges input contains BOTH headers in deletions
      const mutationCall = mockGraphql.mock.calls[1];
      const fileChanges = mutationCall[1].input.fileChanges;

      expect(fileChanges.deletions).toEqual(
        expect.arrayContaining([
          { path: 'config/scyan_assets.h' },
          { path: 'include/scyan_assets.h' },
        ])
      );

      // Verify .conf was cleaned
      expect(fileChanges.additions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: 'config/corne.conf' }),
        ])
      );
    });

    it('deletes config/scyan_symbols.dtsi alongside scyan_layouts.dtsi when present', async () => {
      mockGitGetRef.mockResolvedValueOnce({
        data: { object: { sha: 'commit_sha_123' } },
      });

      mockReposGetContent.mockImplementation(async ({ path }: { path: string }) => {
        if (path === 'config/scyan_assets.h') {
          return { data: { content: btoa('// assets') } };
        }
        if (path === 'config/scyan_layouts.dtsi') {
          return { data: { content: btoa('// layouts') } };
        }
        if (path === 'config/scyan_symbols.dtsi') {
          return { data: { content: btoa('#define SYMBOL_USB 0\n') } };
        }
        const err: any = new Error('Not found');
        err.status = 404;
        throw err;
      });

      mockGraphql
        .mockResolvedValueOnce({
          repository: {
            ref: {
              target: {
                oid: 'head_before_uninstall',
              },
            },
          },
        })
        .mockResolvedValueOnce({
          createCommitOnBranch: {
            commit: {
              oid: 'sha_uninstalled_sym',
              url: 'https://github.com/BrunoWB/zmk-config/commit/sha_uninstalled_sym',
            },
          },
        });

      const result = await uninstallScyanStudioFromRepo(testConfig);
      expect(result.commitSha).toBe('sha_uninstalled_sym');

      const mutationCall = mockGraphql.mock.calls[1];
      const fileChanges = mutationCall[1].input.fileChanges;

      expect(fileChanges.deletions).toEqual(
        expect.arrayContaining([
          { path: 'config/scyan_assets.h' },
          { path: 'config/scyan_layouts.dtsi' },
          { path: 'config/scyan_symbols.dtsi' },
        ])
      );
    });
  });

  describe('uninstallScyanStudio action', () => {
    it('immediately resets atlas and layout stores to default assets upon uninstallation', async () => {
      const { uninstallScyanStudio } = await import('../../stores/workspaceActions');
      const { useAtlasStore } = await import('../../stores/useAtlasStore');
      const { useGitHubStore } = await import('../../stores/useGitHubStore');
      const { getDefaultAssets } = await import('../cHeaderParser');
      const { BwpxGrid } = await import('../../pixel/core/PixelGrid');

      // Set up a custom/modified atlas
      const customGrid = new BwpxGrid(50, 50);
      customGrid.set(5, 5, 1);
      useAtlasStore.getState().setSymbolsGrid(customGrid);
      useAtlasStore.getState().setSymbolSlices([
        { id: 'SYMBOL_CUSTOM_TEST', groupId: 'SYMBOL_CUSTOM_TEST', groupOrder: 1, name: 'Custom', x: 0, y: 0, width: 10, height: 10, color: '#ff0000' },
      ]);

      useGitHubStore.getState().setConfig({
        owner: 'BrunoWB',
        repo: 'zmk-config',
        token: 'ghp_test_token_123',
        branch: 'main',
      });

      const originalWindow = (globalThis as any).window;
      const originalLocalStorage = (globalThis as any).localStorage;
      const reloadMock = vi.fn();
      const storageMock: Record<string, string> = {
        zmk_builder_gh_token: 'ghp_test_token_123',
        zmk_builder_gh_owner: 'BrunoWB',
        zmk_builder_gh_repo: 'zmk-config',
        'zmk-custom-text': 'OldText',
      };

      (globalThis as any).window = {
        location: { reload: reloadMock },
      };
      (globalThis as any).localStorage = {
        getItem: (k: string) => storageMock[k] ?? null,
        setItem: (k: string, v: string) => { storageMock[k] = v; },
        removeItem: (k: string) => { delete storageMock[k]; },
        clear: () => { Object.keys(storageMock).forEach(k => delete storageMock[k]); },
        ...storageMock,
      };

      try {
        mockGitGetRef.mockResolvedValue({
          data: { object: { sha: 'commit_sha_123' } },
        });

        mockReposGetContent.mockImplementation(async ({ path }: { path: string }) => {
          if (path === 'config/scyan_assets.h') {
            return { data: { content: btoa('// current assets') } };
          }
          const err: any = new Error('Not found');
          err.status = 404;
          throw err;
        });

        mockGraphql
          .mockResolvedValueOnce({
            repository: {
              ref: {
                target: {
                  oid: 'head_before_uninstall',
                },
              },
            },
          })
          .mockResolvedValueOnce({
            createCommitOnBranch: {
              commit: {
                oid: 'sha_uninstalled_123',
                url: 'https://github.com/BrunoWB/zmk-config/commit/sha_uninstalled_123',
              },
            },
          });

        await uninstallScyanStudio();

        const defaultAssets = getDefaultAssets();
        const currentAtlas = useAtlasStore.getState();

        // The symbol slices should now match the default/demo assets
        expect(currentAtlas.symbolSlices.length).toBe(defaultAssets.symbolSlices.length);
        expect(currentAtlas.symbolsGrid.width).toBe(defaultAssets.symbolsGrid.width);
        expect(currentAtlas.symbolsGrid.height).toBe(defaultAssets.symbolsGrid.height);

        // Non-auth keys should be cleaned from storage
        expect(storageMock['zmk-custom-text']).toBeUndefined();
        expect(storageMock['zmk_builder_gh_token']).toBe('ghp_test_token_123');
      } finally {
        if (originalWindow === undefined) {
          delete (globalThis as any).window;
        } else {
          (globalThis as any).window = originalWindow;
        }
        if (originalLocalStorage === undefined) {
          delete (globalThis as any).localStorage;
        } else {
          (globalThis as any).localStorage = originalLocalStorage;
        }
      }
    });
  });

  describe('removeScyanFromOverlay', () => {
    it('returns empty string for a pure Scyan overlay', async () => {
      const { removeScyanFromOverlay } = await import('../githubService');
      const pureOverlay = [
        '#include "scyan_layouts.dtsi"',
        '',
        '/ {',
        '    chosen {',
        '        scyan,display-layout = <&display_1_active>;',
        '    };',
        '};',
      ].join('\n');

      expect(removeScyanFromOverlay(pureOverlay)).toBe('');
    });

    it('preserves other user nodes when stripping Scyan configurations', async () => {
      const { removeScyanFromOverlay } = await import('../githubService');
      const mixedOverlay = [
        '#include "scyan_layouts.dtsi"',
        '',
        '/ {',
        '    chosen {',
        '        zmk,matrix-transform = &default_transform;',
        '        scyan,display-layout = <&display_1_active>;',
        '    };',
        '};',
      ].join('\n');

      const cleaned = removeScyanFromOverlay(mixedOverlay);
      expect(cleaned).not.toContain('scyan_layouts.dtsi');
      expect(cleaned).not.toContain('scyan,display-layout');
      expect(cleaned).toContain('zmk,matrix-transform = &default_transform;');
    });

    it('returns empty string for a pure Scyan overlay with delimited markers', async () => {
      const { removeScyanFromOverlay, formatScyanOverlayBlock } = await import('../githubService');
      const pureMarkerOverlay = formatScyanOverlayBlock('display_1_active') + '\n';
      expect(removeScyanFromOverlay(pureMarkerOverlay)).toBe('');
    });

    it('preserves other user nodes when stripping delimited SCYAN-STUDIO marker block', async () => {
      const { removeScyanFromOverlay, formatScyanOverlayBlock } = await import('../githubService');
      const mixedMarkerOverlay = [
        '/ {',
        '    chosen {',
        '        zmk,matrix-transform = &default_transform;',
        '    };',
        '};',
        '',
        formatScyanOverlayBlock('display_1_active'),
      ].join('\n');

      const cleaned = removeScyanFromOverlay(mixedMarkerOverlay);
      expect(cleaned).not.toContain('SCYAN-STUDIO');
      expect(cleaned).not.toContain('scyan_layouts.dtsi');
      expect(cleaned).not.toContain('scyan,display-layout');
      expect(cleaned).toContain('zmk,matrix-transform = &default_transform;');
    });

    it('returns empty string when stripping overlay with inline comments and CRLF', async () => {
      const { removeScyanFromOverlay } = await import('../githubService');
      const pureWithComments = [
        '#include "scyan_layouts.dtsi" /* layouts */',
        '',
        '/ {',
        '    chosen {',
        '        scyan,display-layout = &display_1_active; /* layout */',
        '    };',
        '};',
      ].join('\r\n');

      expect(removeScyanFromOverlay(pureWithComments)).toBe('');
    });
  });
});

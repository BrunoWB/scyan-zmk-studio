import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  installScyanStudioToRepo,
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

describe('installScyanStudioToRepo (screen-agnostic installation)', () => {
  const testConfig: GitHubRepoConfig = {
    owner: 'BrunoWB',
    repo: 'zmk-config',
    branch: 'main',
    token: 'ghp_test_token_123',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('installs module and injects display configs without CONFIG_SSD1306', async () => {
    mockGitGetRef.mockResolvedValueOnce({
      data: { object: { sha: 'commit_sha_123' } },
    });

    mockReposGetContent.mockImplementation(async ({ path }: { path: string }) => {
      if (path === 'config/west.yml') {
        return {
          data: {
            content: btoa('manifest:\n  projects:\n    - name: zmk\n'),
          },
        };
      }
      if (path === 'config') {
        return {
          data: [
            { name: 'corne.conf', path: 'config/corne.conf', type: 'file' },
          ],
        };
      }
      if (path === 'config/corne.conf') {
        // Conf file without any display configs
        return {
          data: {
            content: btoa('CONFIG_ZMK_KEYBOARD_NAME="Corne"\n'),
          },
        };
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
              oid: 'head_before_install',
            },
          },
        },
      })
      .mockResolvedValueOnce({
        createCommitOnBranch: {
          commit: {
            oid: 'sha_installed_123',
            url: 'https://github.com/BrunoWB/zmk-config/commit/sha_installed_123',
          },
        },
      });

    const result = await installScyanStudioToRepo(testConfig, '/* default header */');
    expect(result.commitSha).toBe('sha_installed_123');

    // Verify GraphQL mutation additions
    const mutationCall = mockGraphql.mock.calls[1];
    const additions = mutationCall[1].input.fileChanges.additions;
    const confAddition = additions.find((a: any) => a.path === 'config/corne.conf');
    expect(confAddition).toBeDefined();

    const confContent = atob(confAddition.contents);
    expect(confContent).toContain('CONFIG_ZMK_DISPLAY=y');
    expect(confContent).not.toContain('CONFIG_SSD1306');
    expect(confContent).toContain('CONFIG_ZMK_DISPLAY_STATUS_SCREEN_CUSTOM=y');
    expect(confContent).toContain('CONFIG_LV_USE_CANVAS=y');
  });

  it('does not duplicate CONFIG_ZMK_DISPLAY if already present in conf file', async () => {
    mockGitGetRef.mockResolvedValueOnce({
      data: { object: { sha: 'commit_sha_123' } },
    });

    mockReposGetContent.mockImplementation(async ({ path }: { path: string }) => {
      if (path === 'config/west.yml') {
        return {
          data: {
            content: btoa('manifest:\n  projects:\n    - name: zmk\n'),
          },
        };
      }
      if (path === 'config') {
        return {
          data: [
            { name: 'corne.conf', path: 'config/corne.conf', type: 'file' },
          ],
        };
      }
      if (path === 'config/corne.conf') {
        // Conf file already has generic display enabled (e.g. from a shield or nice!view)
        return {
          data: {
            content: btoa('CONFIG_ZMK_DISPLAY=y\nCONFIG_ZMK_IDLE_TIMEOUT=30000\n'),
          },
        };
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
              oid: 'head_before_install',
            },
          },
        },
      })
      .mockResolvedValueOnce({
        createCommitOnBranch: {
          commit: {
            oid: 'sha_installed_456',
            url: 'https://github.com/BrunoWB/zmk-config/commit/sha_installed_456',
          },
        },
      });

    const result = await installScyanStudioToRepo(testConfig, '/* default header */');
    expect(result.commitSha).toBe('sha_installed_456');

    const mutationCall = mockGraphql.mock.calls[1];
    const additions = mutationCall[1].input.fileChanges.additions;
    const confAddition = additions.find((a: any) => a.path === 'config/corne.conf');
    const confContent = atob(confAddition.contents);

    // Should only have 1 occurrence of CONFIG_ZMK_DISPLAY=y
    const matches = confContent.match(/CONFIG_ZMK_DISPLAY=y/g);
    expect(matches).toHaveLength(1);
    expect(confContent).not.toContain('CONFIG_SSD1306');
    expect(confContent).toContain('CONFIG_ZMK_DISPLAY_STATUS_SCREEN_CUSTOM=y');
  });

  it('generates custom shield files and does not mutate user overlay without legacy blocks', async () => {
    mockGitGetRef.mockResolvedValueOnce({
      data: { object: { sha: 'commit_sha_123' } },
    });

    mockReposGetContent.mockImplementation(async ({ path }: { path: string }) => {
      if (path === 'config/west.yml') {
        return {
          data: {
            content: btoa('manifest:\n  projects:\n    - name: zmk\n'),
          },
        };
      }
      if (path === 'config') {
        return {
          data: [
            { name: 'corne.conf', path: 'config/corne.conf', type: 'file' },
            { name: 'corne_left.overlay', path: 'config/corne_left.overlay', type: 'file' },
          ],
        };
      }
      if (path === 'config/corne.conf') {
        return { data: { content: btoa('CONFIG_ZMK_DISPLAY=y\n') } };
      }
      if (path === 'config/corne_left.overlay') {
        return { data: { content: btoa('&pro_micro_i2c { status = "okay"; };\n') } };
      }
      if (path === 'boards/shields/scyan_screen/scyan_screen_left.overlay') {
        return { data: { content: btoa('/* legacy */') } };
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
              oid: 'head_before_install',
            },
          },
        },
      })
      .mockResolvedValueOnce({
        createCommitOnBranch: {
          commit: {
            oid: 'sha_installed_789',
            url: 'https://github.com/BrunoWB/zmk-config/commit/sha_installed_789',
          },
        },
      });

    const result = await installScyanStudioToRepo(testConfig, '/* default header */');
    expect(result.commitSha).toBe('sha_installed_789');

    const mutationCall = mockGraphql.mock.calls[1];
    const additions = mutationCall[1].input.fileChanges.additions;

    // Verify user overlay is NOT mutated
    const userOverlayAddition = additions.find((a: any) => a.path === 'config/corne_left.overlay');
    expect(userOverlayAddition).toBeUndefined();

    // Verify custom shield overlays are generated
    const shieldOverlayAddition = additions.find((a: any) => a.path === 'boards/shields/scyan_screen/scyan_screen_1.overlay');
    expect(shieldOverlayAddition).toBeDefined();

    const overlayContent = atob(shieldOverlayAddition.contents);
    expect(overlayContent).toContain('#include "scyan_layouts.dtsi"');
    expect(overlayContent).toContain('scyan,display-layout = &display_1_active;');

    expect(additions.find((a: any) => a.path === 'boards/shields/scyan_screen/scyan_screen_left.overlay')).toBeUndefined();

    const deletions = mutationCall[1].input.fileChanges.deletions;
    expect(deletions).toEqual(
      expect.arrayContaining([
        { path: 'boards/shields/scyan_screen/scyan_screen_left.overlay' },
      ])
    );

    // Verify zephyr/module.yml is generated
    const zephyrModAddition = additions.find((a: any) => a.path === 'zephyr/module.yml');
    expect(zephyrModAddition).toBeDefined();
    expect(atob(zephyrModAddition.contents)).toContain('board_root: .');
  });
});

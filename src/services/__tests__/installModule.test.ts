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
});

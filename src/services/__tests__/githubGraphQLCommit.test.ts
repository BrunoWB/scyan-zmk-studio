import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  encodeBase64Utf8,
  commitChangesAtomicViaGraphQL,
  commitChangesViaGitTrees,
  commitChangesWithFallback,
  commitStudioSaveToRepo,
} from '../githubService';
import type { GitHubRepoConfig } from '../githubService';

const mockGraphql = vi.fn();
const mockGitGetRef = vi.fn();
const mockGitGetCommit = vi.fn();
const mockGitCreateTree = vi.fn();
const mockGitCreateCommit = vi.fn();
const mockGitUpdateRef = vi.fn();
const mockReposGetContent = vi.fn();

vi.mock('@octokit/rest', () => {
  return {
    Octokit: class {
      graphql = (...args: any[]) => mockGraphql(...args);
      repos = {
        getContent: (...args: any[]) => mockReposGetContent(...args),
      };
      git = {
        getRef: (...args: any[]) => mockGitGetRef(...args),
        getCommit: (...args: any[]) => mockGitGetCommit(...args),
        createTree: (...args: any[]) => mockGitCreateTree(...args),
        createCommit: (...args: any[]) => mockGitCreateCommit(...args),
        updateRef: (...args: any[]) => mockGitUpdateRef(...args),
      };
    },
  };
});

describe('Issue #9: GitHub GraphQL createCommitOnBranch operations', () => {
  const testConfig: GitHubRepoConfig = {
    owner: 'BrunoWB',
    repo: 'zmk-config',
    branch: 'main',
    token: 'ghp_test_token_123',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('encodeBase64Utf8', () => {
    it('encodes standard ASCII strings accurately', () => {
      const input = '#define SCYAN_DISPLAY 1\n';
      const encoded = encodeBase64Utf8(input);
      const decoded = Buffer.from(encoded, 'base64').toString('utf8');
      expect(decoded).toBe(input);
    });

    it('safely encodes multi-byte Unicode and symbol glyph characters without throwing', () => {
      const input = '/* Glyph ⚡ ✨ © — 2-Atlas OLED font */\nconst char* title = "Scyan 键盘";';
      const encoded = encodeBase64Utf8(input);
      const decoded = Buffer.from(encoded, 'base64').toString('utf8');
      expect(decoded).toBe(input);
    });
  });

  describe('commitChangesAtomicViaGraphQL', () => {
    it('executes createCommitOnBranch mutation with additions and fetched HEAD OID in 2 requests', async () => {
      mockGraphql
        // 1. GetBranchHead query
        .mockResolvedValueOnce({
          repository: {
            ref: {
              target: {
                oid: 'commit_sha_head_123',
              },
            },
          },
        })
        // 2. createCommitOnBranch mutation
        .mockResolvedValueOnce({
          createCommitOnBranch: {
            commit: {
              oid: 'new_commit_sha_456',
              url: 'https://github.com/BrunoWB/zmk-config/commit/new_commit_sha_456',
            },
          },
        });

      const result = await commitChangesAtomicViaGraphQL({
        config: testConfig,
        message: 'feat(display): update 2-Atlas display spritesheets & glyph tables',
        additions: [
          {
            path: 'config/scyan_assets.h',
            content: '/* C Header Assets */',
          },
          {
            path: 'config/corne.conf',
            content: 'CONFIG_ZMK_IDLE_TIMEOUT=30000\n',
          },
        ],
      });

      expect(result.commitSha).toBe('new_commit_sha_456');
      expect(result.commitUrl).toBe('https://github.com/BrunoWB/zmk-config/commit/new_commit_sha_456');
      expect(result.filesCommitted).toEqual(['config/scyan_assets.h', 'config/corne.conf']);

      expect(mockGraphql).toHaveBeenCalledTimes(2);

      // Verify mutation payload
      const mutationCall = mockGraphql.mock.calls[1];
      expect(mutationCall[0]).toContain('createCommitOnBranch');
      expect(mutationCall[1].input).toEqual({
        branch: {
          repositoryNameWithOwner: 'BrunoWB/zmk-config',
          branchName: 'main',
        },
        expectedHeadOid: 'commit_sha_head_123',
        message: {
          headline: '[Scyan Studio] feat(display): update 2-Atlas display spritesheets & glyph tables',
        },
        fileChanges: {
          additions: [
            {
              path: 'config/scyan_assets.h',
              contents: encodeBase64Utf8('/* C Header Assets */'),
            },
            {
              path: 'config/corne.conf',
              contents: encodeBase64Utf8('CONFIG_ZMK_IDLE_TIMEOUT=30000\n'),
            },
          ],
        },
      });
    });

    it('skips branch head query if expectedHeadOid is explicitly provided (1 single network request)', async () => {
      mockGraphql.mockResolvedValueOnce({
        createCommitOnBranch: {
          commit: {
            oid: 'sha_direct_789',
            url: 'https://github.com/BrunoWB/zmk-config/commit/sha_direct_789',
          },
        },
      });

      const result = await commitChangesAtomicViaGraphQL({
        config: testConfig,
        message: 'feat(display): fast direct commit',
        expectedHeadOid: 'pre_known_sha_111',
        additions: [
          { path: 'config/scyan_assets.h', content: '// direct' },
        ],
      });

      expect(result.commitSha).toBe('sha_direct_789');
      expect(mockGraphql).toHaveBeenCalledTimes(1);
      expect(mockGraphql.mock.calls[0][1].input.expectedHeadOid).toBe('pre_known_sha_111');
    });

    it('supports deletions cleanly in single atomic mutation (e.g. uninstallation)', async () => {
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
              oid: 'sha_after_uninstall',
              url: 'https://github.com/BrunoWB/zmk-config/commit/sha_after_uninstall',
            },
          },
        });

      const result = await commitChangesAtomicViaGraphQL({
        config: testConfig,
        message: 'chore(display): uninstall Scyan ZMK Studio module, config & assets',
        additions: [
          { path: 'config/west.yml', content: 'manifest: cleaned' },
        ],
        deletions: [
          { path: 'config/scyan_assets.h' },
        ],
      });

      expect(result.commitSha).toBe('sha_after_uninstall');
      expect(result.filesCommitted).toEqual([
        'config/west.yml',
        'config/scyan_assets.h (deleted)',
      ]);

      const mutationCall = mockGraphql.mock.calls[1];
      expect(mutationCall[1].input.fileChanges).toEqual({
        additions: [
          { path: 'config/west.yml', contents: encodeBase64Utf8('manifest: cleaned') },
        ],
        deletions: [
          { path: 'config/scyan_assets.h' },
        ],
      });
    });

    it('falls back to getRef if GetBranchHead query errors or returns empty', async () => {
      mockGraphql
        .mockRejectedValueOnce(new Error('GraphQL query disabled or schema mismatch'))
        .mockResolvedValueOnce({
          createCommitOnBranch: {
            commit: {
              oid: 'new_sha_via_rest_head',
              url: 'https://github.com/commit/1',
            },
          },
        });

      mockGitGetRef.mockResolvedValueOnce({
        data: {
          object: { sha: 'rest_retrieved_head_sha' },
        },
      });

      const result = await commitChangesAtomicViaGraphQL({
        config: testConfig,
        message: 'test commit',
        additions: [{ path: 'test.txt', content: 'hello' }],
      });

      expect(mockGitGetRef).toHaveBeenCalledWith({
        owner: 'BrunoWB',
        repo: 'zmk-config',
        ref: 'heads/main',
      });
      expect(result.commitSha).toBe('new_sha_via_rest_head');
      expect(mockGraphql.mock.calls[1][1].input.expectedHeadOid).toBe('rest_retrieved_head_sha');
    });

    it('throws when neither additions nor deletions are supplied', async () => {
      await expect(
        commitChangesAtomicViaGraphQL({
          config: testConfig,
          message: 'empty commit',
          additions: [],
          deletions: [],
        })
      ).rejects.toThrow('No file changes specified for commit.');
    });
  });

  describe('commitChangesViaGitTrees (REST fallback)', () => {
    it('orchestrates getRef -> getCommit -> createTree -> createCommit -> updateRef', async () => {
      mockGitGetRef.mockResolvedValueOnce({
        data: { object: { sha: 'rest_head_sha' } },
      });
      mockGitGetCommit.mockResolvedValueOnce({
        data: { tree: { sha: 'base_tree_sha' } },
      });
      mockGitCreateTree.mockResolvedValueOnce({
        data: { sha: 'new_tree_sha' },
      });
      mockGitCreateCommit.mockResolvedValueOnce({
        data: {
          sha: 'new_rest_commit_sha',
          html_url: 'https://github.com/commit/new_rest_commit_sha',
        },
      });
      mockGitUpdateRef.mockResolvedValueOnce({
        data: {},
      });

      const result = await commitChangesViaGitTrees({
        config: testConfig,
        message: 'feat(display): rest fallback commit',
        additions: [
          { path: 'config/scyan_assets.h', content: '// REST fallback' },
        ],
        deletions: [
          { path: 'config/old_file.h' },
        ],
      });

      expect(result.commitSha).toBe('new_rest_commit_sha');
      expect(mockGitCreateTree).toHaveBeenCalledWith(
        expect.objectContaining({
          base_tree: 'base_tree_sha',
          tree: [
            {
              path: 'config/scyan_assets.h',
              mode: '100644',
              type: 'blob',
              content: '// REST fallback',
            },
            {
              path: 'config/old_file.h',
              mode: '100644',
              type: 'blob',
              sha: null,
            },
          ],
        })
      );
      expect(mockGitUpdateRef).toHaveBeenCalledWith({
        owner: 'BrunoWB',
        repo: 'zmk-config',
        ref: 'heads/main',
        sha: 'new_rest_commit_sha',
      });
    });
  });

  describe('commitChangesWithFallback', () => {
    it('returns GraphQL commit result when GraphQL succeeds', async () => {
      mockGraphql
        .mockResolvedValueOnce({
          repository: { ref: { target: { oid: 'sha_1' } } },
        })
        .mockResolvedValueOnce({
          createCommitOnBranch: {
            commit: { oid: 'graphql_success_sha', url: 'https://github.com/success' },
          },
        });

      const result = await commitChangesWithFallback({
        config: testConfig,
        message: 'test commit',
        additions: [{ path: 'a.txt', content: 'ok' }],
      });

      expect(result.commitSha).toBe('graphql_success_sha');
      expect(mockGitCreateTree).not.toHaveBeenCalled();
    });

    it('gracefully falls back to Git Trees REST API when GraphQL createCommitOnBranch fails', async () => {
      // 1. Head query succeeds
      mockGraphql.mockResolvedValueOnce({
        repository: { ref: { target: { oid: 'sha_head' } } },
      });
      // 2. Mutation fails (e.g. rate limit, scope, or network error)
      mockGraphql.mockRejectedValueOnce(
        new Error('GraphQL mutation createCommitOnBranch failed: 502 Bad Gateway')
      );

      // REST fallback mock sequence:
      mockGitGetRef.mockResolvedValueOnce({
        data: { object: { sha: 'rest_head_sha' } },
      });
      mockGitGetCommit.mockResolvedValueOnce({
        data: { tree: { sha: 'base_tree_sha' } },
      });
      mockGitCreateTree.mockResolvedValueOnce({
        data: { sha: 'fallback_tree_sha' },
      });
      mockGitCreateCommit.mockResolvedValueOnce({
        data: {
          sha: 'fallback_commit_sha',
          html_url: 'https://github.com/fallback',
        },
      });
      mockGitUpdateRef.mockResolvedValueOnce({ data: {} });

      const result = await commitChangesWithFallback({
        config: testConfig,
        message: 'fallback test',
        additions: [{ path: 'config/scyan_assets.h', content: 'code' }],
      });

      expect(result.commitSha).toBe('fallback_commit_sha');
      expect(mockGitCreateTree).toHaveBeenCalled();
      expect(mockGitUpdateRef).toHaveBeenCalled();
    });
  });

  describe('commitStudioSaveToRepo atomic symbols generation', () => {
    it('atomically commits scyan_symbols.dtsi alongside scyan_assets.h and scyan_layouts.dtsi', async () => {
      mockReposGetContent.mockResolvedValue({ data: [] });
      mockGraphql
        .mockResolvedValueOnce({
          repository: { ref: { target: { oid: 'sha_head_save' } } },
        })
        .mockResolvedValueOnce({
          createCommitOnBranch: {
            commit: {
              oid: 'sha_committed_save',
              url: 'https://github.com/save',
            },
          },
        });

      const headerContent = `
/* Symbol identifiers */
#define SYMBOL_USB 0
#define SYMBOL_BATTERY 1
#define SYMBOL_COUNT 2

/* ZMK_DISPLAY_STUDIO_METADATA {"version":2,"displays":{"display_1":{"blocks":[]}}} */
`;

      const result = await commitStudioSaveToRepo(
        testConfig,
        'config/scyan_assets.h',
        headerContent,
        { screenOffTimeoutSec: 30, symmetricSettings: true },
        'Update assets',
        { overlays: [] }
      );

      expect(result.commitSha).toBe('sha_committed_save');
      expect(result.filesCommitted).toContain('config/scyan_assets.h');
      expect(result.filesCommitted).toContain('boards/shields/scyan_screen/scyan_layouts.dtsi');
      expect(result.filesCommitted).toContain('boards/shields/scyan_screen/scyan_symbols.dtsi');

      // Check mutation additions
      const mutationCall = mockGraphql.mock.calls[1];
      const additions = mutationCall[1].input.fileChanges.additions;
      const symbolsFile = additions.find((a: any) => a.path === 'boards/shields/scyan_screen/scyan_symbols.dtsi');
      expect(symbolsFile).toBeDefined();
      const decodedSymbols = Buffer.from(symbolsFile.contents, 'base64').toString('utf8');
      expect(decodedSymbols).toContain('#define SYMBOL_USB 0');
      expect(decodedSymbols).toContain('#define SYMBOL_BLUETOOTH 1');
      expect(decodedSymbols).toContain('#define SYMBOL_BATTERY_FRAME 2');
    });

    it('commits scyan_symbols.dtsi even when symbolsDtsiContent is empty string', async () => {
      mockReposGetContent.mockResolvedValue({ data: [] });
      mockGraphql
        .mockResolvedValueOnce({
          repository: { ref: { target: { oid: 'sha_head_empty' } } },
        })
        .mockResolvedValueOnce({
          createCommitOnBranch: {
            commit: {
              oid: 'sha_committed_empty',
              url: 'https://github.com/save_empty',
            },
          },
        });

      const headerContent = `/* ZMK_DISPLAY_STUDIO_METADATA {"version":2,"displays":{"display_1":{"blocks":[]}}} */`;

      const result = await commitStudioSaveToRepo(
        testConfig,
        'config/scyan_assets.h',
        headerContent,
        { screenOffTimeoutSec: 30, symmetricSettings: true },
        'Update assets empty symbols',
        { symbolsDtsiContent: '', overlays: [] }
      );

      expect(result.filesCommitted).toContain('boards/shields/scyan_screen/scyan_symbols.dtsi');

      const mutationCall = mockGraphql.mock.calls[1];
      const additions = mutationCall[1].input.fileChanges.additions;
      const symbolsFile = additions.find((a: any) => a.path === 'boards/shields/scyan_screen/scyan_symbols.dtsi');
      expect(symbolsFile).toBeDefined();
      expect(symbolsFile.contents).toBe('');
    });
  });
});

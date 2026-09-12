import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockListForAuthenticatedUser = vi.fn();
const mockGetAuthenticated = vi.fn();
const mockReposGet = vi.fn();
const mockGetContent = vi.fn();

vi.mock('@octokit/rest', () => {
  return {
    Octokit: class {
      users = {
        getAuthenticated: (...args: any[]) => mockGetAuthenticated(...args),
      };
      repos = {
        listForAuthenticatedUser: (...args: any[]) => mockListForAuthenticatedUser(...args),
        get: (...args: any[]) => mockReposGet(...args),
        getContent: (...args: any[]) => mockGetContent(...args),
      };
    },
  };
});

import { fetchUserRepositories, verifyGitHubConnection } from '../githubService';

describe('githubService - Issue #2 fine-grained PAT repository discovery and filtering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('fetchUserRepositories', () => {
    it('filters out public read-only repositories when push-accessible repositories exist (fine-grained PAT)', async () => {
      mockListForAuthenticatedUser.mockResolvedValue({
        data: [
          {
            id: 1,
            name: 'personal-blog',
            full_name: 'genteure/personal-blog',
            owner: { login: 'genteure' },
            private: false,
            default_branch: 'main',
            description: 'My blog',
            updated_at: '2026-09-01T00:00:00Z',
            permissions: { push: false },
          },
          {
            id: 2,
            name: 'corne-zmk-config',
            full_name: 'genteure/corne-zmk-config',
            owner: { login: 'genteure' },
            private: false,
            default_branch: 'main',
            description: 'ZMK config for Corne',
            updated_at: '2026-09-10T00:00:00Z',
            permissions: { push: true },
          },
          {
            id: 3,
            name: 'random-project',
            full_name: 'genteure/random-project',
            owner: { login: 'genteure' },
            private: false,
            default_branch: 'main',
            description: null,
            updated_at: '2026-08-01T00:00:00Z',
            permissions: { push: false },
          },
        ],
      });

      const repos = await fetchUserRepositories('github_pat_valid');

      // Must filter to only the push-accessible repository selected in the fine-grained PAT
      expect(repos).toHaveLength(1);
      expect(repos[0].name).toBe('corne-zmk-config');
      expect(repos[0].hasPushAccess).toBe(true);
      expect(repos[0].isZmkConfig).toBe(true);
    });

    it('returns all repositories if none have explicit push access', async () => {
      mockListForAuthenticatedUser.mockResolvedValue({
        data: [
          {
            id: 1,
            name: 'public-repo-1',
            full_name: 'genteure/public-repo-1',
            owner: { login: 'genteure' },
            private: false,
            default_branch: 'main',
            description: null,
            updated_at: '2026-09-01T00:00:00Z',
            permissions: { push: false },
          },
        ],
      });

      const repos = await fetchUserRepositories('github_pat_valid');
      expect(repos).toHaveLength(1);
      expect(repos[0].name).toBe('public-repo-1');
      expect(repos[0].hasPushAccess).toBe(false);
    });
  });

  describe('verifyGitHubConnection auto-discovery', () => {
    it('prioritizes repository with push access during auto-discovery', async () => {
      mockGetAuthenticated.mockResolvedValue({
        data: {
          login: 'genteure',
          name: 'Genteure',
          avatar_url: 'https://example.com/avatar.png',
        },
      });

      mockListForAuthenticatedUser.mockResolvedValue({
        data: [
          {
            id: 10,
            name: 'other-zmk-project',
            full_name: 'genteure/other-zmk-project',
            owner: { login: 'genteure', avatar_url: 'https://example.com/avatar.png' },
            description: 'ReadOnly ZMK mirror',
            permissions: { push: false },
          },
          {
            id: 20,
            name: 'zmk-config',
            full_name: 'genteure/zmk-config',
            owner: { login: 'genteure', avatar_url: 'https://example.com/avatar.png' },
            description: 'My active keymap',
            permissions: { push: true },
          },
        ],
      });

      mockReposGet.mockResolvedValue({
        data: {
          name: 'zmk-config',
          full_name: 'genteure/zmk-config',
          private: false,
          permissions: { push: true },
          default_branch: 'main',
          description: 'My active keymap',
        },
      });

      mockGetContent.mockResolvedValue({ data: [] });

      const result = await verifyGitHubConnection({
        token: 'github_pat_test',
        owner: '',
        repo: '',
        branch: 'main',
      });

      expect(result.status).toBe('connected');
      expect(result.resolvedOwner).toBe('genteure');
      expect(result.resolvedRepo).toBe('zmk-config');
      expect(result.repo?.name).toBe('zmk-config');
      expect(result.repo?.hasPushAccess).toBe(true);
    });
  });
});

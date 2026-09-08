import { Octokit } from '@octokit/rest';

export interface GitHubRepoConfig {
  owner: string;
  repo: string;
  branch: string;
  token: string;
}

export interface WorkflowRunInfo {
  id: number;
  status: string; // "queued" | "in_progress" | "completed"
  conclusion: string | null; // "success" | "failure" | null
  htmlUrl: string;
  createdAt: string;
  artifactsUrl: string;
  artifacts?: {
    id: number;
    name: string;
    sizeInBytes: number;
    downloadUrl: string;
  }[];
}

export type GitConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface GitHubUser {
  login: string;
  name: string | null;
  avatarUrl: string;
}

export interface GitHubRepoDetails {
  name: string;
  fullName: string;
  isPrivate: boolean;
  hasPushAccess: boolean;
  defaultBranch: string;
  description: string | null;
}

export interface GitHubConnectionState {
  status: GitConnectionStatus;
  user: GitHubUser | null;
  repo: GitHubRepoDetails | null;
  errorMessage: string | null;
  lastCheckedAt: number | null;
  /** The owner/repo that connection verification was actually performed against.
   *  May differ from the raw config values when auto-discovery ran. */
  resolvedOwner: string | null;
  resolvedRepo: string | null;
}

const STORAGE_KEY_TOKEN = 'zmk_builder_gh_token';
const STORAGE_KEY_OWNER = 'zmk_builder_gh_owner';
const STORAGE_KEY_REPO = 'zmk_builder_gh_repo';
const STORAGE_KEY_BRANCH = 'zmk_builder_gh_branch';

export function getStoredGitHubConfig(): GitHubRepoConfig {
  return {
    owner: localStorage.getItem(STORAGE_KEY_OWNER) || 'BrunoWB',
    repo: localStorage.getItem(STORAGE_KEY_REPO) || 'zmk-config',
    branch: localStorage.getItem(STORAGE_KEY_BRANCH) || 'main',
    token: localStorage.getItem(STORAGE_KEY_TOKEN) || '',
  };
}

export function saveStoredGitHubConfig(config: Partial<GitHubRepoConfig>): void {
  if (config.owner !== undefined) localStorage.setItem(STORAGE_KEY_OWNER, config.owner);
  if (config.repo !== undefined) localStorage.setItem(STORAGE_KEY_REPO, config.repo);
  if (config.branch !== undefined) localStorage.setItem(STORAGE_KEY_BRANCH, config.branch);
  if (config.token !== undefined) localStorage.setItem(STORAGE_KEY_TOKEN, config.token);
}

export function clearStoredGitHubToken(): void {
  localStorage.removeItem(STORAGE_KEY_TOKEN);
}

function getOctokit(token?: string): Octokit {
  return new Octokit({
    auth: token || undefined,
  });
}

/**
 * Tests and verifies GitHub authentication, repository permissions, and branch existence.
 */
export async function verifyGitHubConnection(config: GitHubRepoConfig): Promise<GitHubConnectionState> {
  const token = config.token?.trim();
  let owner = config.owner?.trim() || 'BrunoWB';
  let repo = config.repo?.trim() || 'zmk-config';

  if (!token) {
    return {
      status: 'disconnected',
      user: null,
      repo: null,
      errorMessage: null,
      lastCheckedAt: Date.now(),
      resolvedOwner: null,
      resolvedRepo: null,
    };
  }

  const octokit = getOctokit(token);

  try {
    let user: GitHubUser = {
      login: owner,
      name: owner,
      avatarUrl: '',
    };

    // 1. Try to fetch user profile (OAuth and Classic tokens support /user)
    try {
      const userRes = await octokit.users.getAuthenticated();
      user = {
        login: userRes.data.login,
        name: userRes.data.name ?? userRes.data.login,
        avatarUrl: userRes.data.avatar_url,
      };
      if (!config.owner) {
        owner = user.login;
      }
    } catch {
      // Fine-grained PATs with repository-only scope return 403 on /user.
      // This is expected and normal for modern GitHub fine-grained tokens.
    }

    // 2. Auto-discover owner/repo ONLY when both are completely blank.
    //    Never silently override a configured repo — doing so causes the
    //    connection check to pass against a different repo than the one the
    //    commit will target, resulting in a 403 on save.
    if (!config.owner && !config.repo) {
      try {
        const listRes = await octokit.repos.listForAuthenticatedUser({ per_page: 20 });
        if (listRes.data.length > 0) {
          const found = listRes.data[0];
          owner = found.owner.login;
          repo = found.name;
          if (!user.avatarUrl) {
            user.login = found.owner.login;
            user.avatarUrl = found.owner.avatar_url;
          }
        }
      } catch {
        // Direct repo fetch will be the fallback probe
      }
    }

    // 3. Verify repository existence
    const repoRes = await octokit.repos.get({
      owner,
      repo,
    });

    // 4. Verify Contents Read permission by probing repository contents
    try {
      await octokit.repos.getContent({
        owner,
        repo,
        path: '',
      });
    } catch (contentsErr: any) {
      if (contentsErr?.status === 403 || contentsErr?.status === 404) {
        return {
          status: 'error',
          user: null,
          repo: null,
          errorMessage: `Token is missing 'Contents' permission for ${owner}/${repo}. In GitHub token settings, add 'Contents' with 'Read and write' access.`,
          lastCheckedAt: Date.now(),
          resolvedOwner: owner,
          resolvedRepo: repo,
        };
      }
      throw contentsErr;
    }

    // 5. Verify Contents Write/Push permission
    const hasPushAccess = Boolean(repoRes.data.permissions?.push);
    if (!hasPushAccess) {
      return {
        status: 'error',
        user,
        repo: {
          name: repoRes.data.name,
          fullName: repoRes.data.full_name,
          isPrivate: repoRes.data.private,
          hasPushAccess: false,
          defaultBranch: repoRes.data.default_branch,
          description: repoRes.data.description,
        },
        errorMessage: `Token has read access but lacks write/push permissions for ${owner}/${repo}. In GitHub token settings, change 'Contents' to 'Read and write'.`,
        lastCheckedAt: Date.now(),
        resolvedOwner: owner,
        resolvedRepo: repo,
      };
    }

    return {
      status: 'connected',
      user,
      repo: {
        name: repoRes.data.name,
        fullName: repoRes.data.full_name,
        isPrivate: repoRes.data.private,
        hasPushAccess: true,
        defaultBranch: repoRes.data.default_branch,
        description: repoRes.data.description,
      },
      errorMessage: null,
      lastCheckedAt: Date.now(),
      resolvedOwner: owner,
      resolvedRepo: repo,
    };
  } catch (err: any) {
    let msg = err.message || 'Failed to authenticate with GitHub';
    if (err.status === 401) {
      msg = 'Invalid token: Bad credentials. Please verify your token.';
    } else if (err.status === 404) {
      msg = `Repository '${owner}/${repo}' not found or token lacks access to it.`;
    } else if (err.status === 403) {
      msg = `Access denied to '${owner}/${repo}'. Ensure repository permissions have 'Contents: Read and write'.`;
    }
    return {
      status: 'error',
      user: null,
      repo: null,
      errorMessage: msg,
      lastCheckedAt: Date.now(),
      resolvedOwner: owner,
      resolvedRepo: repo,
    };
  }
}

/**
 * Fetches file content from repository.
 */
export async function fetchFileFromRepo(
  config: GitHubRepoConfig,
  path = 'include/custom_display_assets.h'
): Promise<{ content: string; sha: string; resolvedPath?: string }> {
  const octokit = getOctokit(config.token);

  // Try configured branch first, then fallback to main/master
  const branches = [config.branch, 'main', 'master'].filter(Boolean);
  const uniqueBranches = Array.from(new Set(branches));

  // Determine candidate paths to probe in target repository
  const isDefaultAssetPath = path === 'include/custom_display_assets.h';
  const candidatePaths = isDefaultAssetPath
    ? (config.repo === 'zmk-display-core'
        ? ['include/custom_display_assets.h', 'config/custom_display_assets.h']
        : ['config/custom_display_assets.h', 'config/include/custom_display_assets.h', 'include/custom_display_assets.h'])
    : [path, 'config/custom_display_assets.h', 'include/custom_display_assets.h'];
  const uniqueCandidatePaths = Array.from(new Set(candidatePaths));

  let lastErr: any = null;
  for (const candidatePath of uniqueCandidatePaths) {
    for (const branch of uniqueBranches) {
      try {
        const res = await octokit.repos.getContent({
          owner: config.owner,
          repo: config.repo,
          path: candidatePath,
          ref: branch,
          ...({ timestamp: Date.now() } as any)
        });

        if ('content' in res.data && typeof res.data.content === 'string') {
          const decoded = atob(res.data.content.replace(/\s/g, ''));
          return {
            content: decoded,
            sha: res.data.sha,
            resolvedPath: candidatePath,
          };
        }
      } catch (err: any) {
        lastErr = err;
      }
    }
  }

  try {
    // If not found in config repo (e.g. zmk-config), check zmk-display-core
    if (lastErr?.status === 404 && config.repo !== 'zmk-display-core') {
      const fallbackRes = await octokit.repos.getContent({
        owner: 'BrunoWB',
        repo: 'zmk-display-core',
        path: 'include/custom_display_assets.h',
        ref: 'main',
      });
      if ('content' in fallbackRes.data && typeof fallbackRes.data.content === 'string') {
        const decoded = atob(fallbackRes.data.content.replace(/\s/g, ''));
        return {
          content: decoded,
          sha: '', // New file for the destination repo
          resolvedPath: 'config/custom_display_assets.h',
        };
      }
    }
  } catch {
    // Fallback probe failed
  }

  throw lastErr || new Error('File content is not text or is a directory');
}

/**
 * Commits a file update to the repository.
 */
export async function commitFileToRepo(
  config: GitHubRepoConfig,
  path: string,
  content: string,
  commitMessage: string,
  fileSha?: string
): Promise<{ commitUrl: string; sha: string }> {
  if (!config.token) {
    throw new Error('GitHub Personal Access Token is required to commit changes.');
  }

  const octokit = getOctokit(config.token);

  // Base64 encode UTF-8 string cleanly
  const utf8Bytes = new TextEncoder().encode(content);
  let binary = '';
  utf8Bytes.forEach(b => {
    binary += String.fromCharCode(b);
  });
  const base64Content = btoa(binary);

  try {
    const res = await octokit.repos.createOrUpdateFileContents({
      owner: config.owner,
      repo: config.repo,
      path,
      message: commitMessage,
      content: base64Content,
      branch: config.branch,
      sha: fileSha || undefined,
    });

    return {
      commitUrl: res.data.commit.html_url || '',
      sha: res.data.content?.sha || '',
    };
  } catch (err: any) {
    // If a conflict or SHA mismatch occurs (409 or 422), re-fetch and retry once
    if (err.status === 409 || (err.status === 422 && err.message?.includes('does not match'))) {
      const existing = await octokit.repos.getContent({
        owner: config.owner,
        repo: config.repo,
        path,
        ref: config.branch,
        ...({ timestamp: Date.now() } as any)
      });
      if ('sha' in existing.data) {
        const retryRes = await octokit.repos.createOrUpdateFileContents({
          owner: config.owner,
          repo: config.repo,
          path,
          message: commitMessage,
          content: base64Content,
          branch: config.branch,
          sha: existing.data.sha,
        });
        return {
          commitUrl: retryRes.data.commit.html_url || '',
          sha: retryRes.data.content?.sha || '',
        };
      }
    }
    throw err;
  }
}

/**
 * Polls the latest GitHub Actions workflow runs for the repo.
 */
export async function fetchLatestWorkflowRuns(
  config: GitHubRepoConfig
): Promise<WorkflowRunInfo | null> {
  const octokit = getOctokit(config.token);

  try {
    const res = await octokit.actions.listWorkflowRunsForRepo({
      owner: config.owner,
      repo: config.repo,
      branch: config.branch,
      per_page: 1,
    });

    if (res.data.workflow_runs.length === 0) {
      return null;
    }

    const run = res.data.workflow_runs[0];
    const info: WorkflowRunInfo = {
      id: run.id,
      status: run.status || 'unknown',
      conclusion: run.conclusion,
      htmlUrl: run.html_url,
      createdAt: run.created_at,
      artifactsUrl: run.artifacts_url,
    };

    // If completed successfully, fetch artifacts
    if (run.conclusion === 'success') {
      try {
        const artifactsRes = await octokit.actions.listWorkflowRunArtifacts({
          owner: config.owner,
          repo: config.repo,
          run_id: run.id,
        });

        info.artifacts = artifactsRes.data.artifacts.map(art => ({
          id: art.id,
          name: art.name,
          sizeInBytes: art.size_in_bytes,
          downloadUrl: `https://github.com/${config.owner}/${config.repo}/actions/runs/${run.id}`,
        }));
      } catch (err) {
        console.warn('Could not fetch artifacts:', err);
      }
    }

    return info;
  } catch (err) {
    console.warn('Error fetching workflow runs:', err);
    return null;
  }
}

export interface GitHubRepositoryItem {
  id: number;
  name: string;
  fullName: string;
  owner: string;
  private: boolean;
  defaultBranch: string;
  description: string | null;
  updatedAt: string;
  hasPushAccess: boolean;
  isZmkConfig: boolean;
}

/**
 * Fetches repositories accessible to the authenticated user for the repository selector.
 */
export async function fetchUserRepositories(token: string): Promise<GitHubRepositoryItem[]> {
  if (!token) return [];
  const octokit = getOctokit(token);

  try {
    const res = await octokit.repos.listForAuthenticatedUser({
      sort: 'updated',
      per_page: 100,
      affiliation: 'owner,collaborator',
    });

    return res.data.map(repo => {
      const isZmk =
        repo.name.toLowerCase().includes('zmk') ||
        repo.name.toLowerCase().includes('keymap') ||
        Boolean(repo.description && repo.description.toLowerCase().includes('zmk'));

      return {
        id: repo.id,
        name: repo.name,
        fullName: repo.full_name,
        owner: repo.owner.login,
        private: repo.private,
        defaultBranch: repo.default_branch,
        description: repo.description ?? null,
        updatedAt: repo.updated_at ?? '',
        hasPushAccess: Boolean(repo.permissions?.push),
        isZmkConfig: Boolean(isZmk),
      };
    });
  } catch (err) {
    console.error('Failed to list user repositories:', err);
    return [];
  }
}

/**
 * Fetches branches for a given repository.
 */
export async function fetchRepoBranches(token: string, owner: string, repo: string): Promise<string[]> {
  if (!token || !owner || !repo) return ['master', 'main'];
  const octokit = getOctokit(token);

  try {
    const res = await octokit.repos.listBranches({
      owner,
      repo,
      per_page: 50,
    });
    return res.data.map(b => b.name);
  } catch (err) {
    console.error('Failed to list repository branches:', err);
    return ['master', 'main'];
  }
}



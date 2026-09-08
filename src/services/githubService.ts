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
    owner: localStorage.getItem(STORAGE_KEY_OWNER) || '',
    repo: localStorage.getItem(STORAGE_KEY_REPO) || '',
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
  let owner = config.owner?.trim() || '';
  let repo = config.repo?.trim() || '';

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
      if (!owner) {
        owner = user.login;
      }
    } catch {
      // Fine-grained PATs with repository-only scope return 403 on /user.
      // This is expected and normal for modern GitHub fine-grained tokens.
    }

    // 2. Auto-discover owner/repo if either owner or repo is not yet determined
    if (!owner || !repo) {
      try {
        const listRes = await octokit.repos.listForAuthenticatedUser({
          sort: 'updated',
          per_page: 50,
          affiliation: 'owner,collaborator',
        });
        if (listRes.data.length > 0) {
          const zmkRepo = listRes.data.find(r =>
            r.name.toLowerCase().includes('zmk') ||
            Boolean(r.description && r.description.toLowerCase().includes('zmk'))
          ) || listRes.data[0];

          if (!owner) owner = zmkRepo.owner.login;
          if (!repo) repo = zmkRepo.name;
          if (!user.avatarUrl) {
            user.login = zmkRepo.owner.login;
            user.name = zmkRepo.owner.login;
            user.avatarUrl = zmkRepo.owner.avatar_url;
          }
        }
      } catch (listErr) {
        console.warn('Auto-discovery of user repositories failed:', listErr);
      }
    }

    if (!owner || !repo) {
      return {
        status: 'error',
        user,
        repo: null,
        errorMessage: 'Could not automatically identify a repository. Please enter the repository name in Settings.',
        lastCheckedAt: Date.now(),
        resolvedOwner: null,
        resolvedRepo: null,
      };
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
  path = 'config/scyan_assets.h'
): Promise<{ content: string; sha: string; resolvedPath?: string }> {
  const octokit = getOctokit(config.token);

  // Try configured branch first, then fallback to main/master
  const branches = [config.branch, 'main', 'master'].filter(Boolean);
  const uniqueBranches = Array.from(new Set(branches));

  // Determine candidate paths to probe in target repository
  const isDefaultAssetPath = path === 'config/scyan_assets.h' || path === 'include/custom_display_assets.h';
  const candidatePaths = isDefaultAssetPath
    ? ['config/scyan_assets.h', 'include/scyan_assets.h', 'scyan_assets.h']
    : [path, 'config/scyan_assets.h', 'include/scyan_assets.h', 'scyan_assets.h'];
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

export interface RepoPrerequisites {
  isInstalled: boolean;
  hasWestModule: boolean;
  hasKconfig: boolean;
  hasAssetsHeader: boolean;
  confPath?: string;
  westPath?: string;
  existingConfContent?: string;
  existingWestContent?: string;
}

/**
 * Checks whether the connected repository is configured with scyan-zmk-module,
 * required display Kconfig flags, and scyan_assets.h.
 */
export async function checkRepoPrerequisites(
  config: GitHubRepoConfig
): Promise<RepoPrerequisites> {
  if (!config.token || !config.owner || !config.repo) {
    return {
      isInstalled: false,
      hasWestModule: false,
      hasKconfig: false,
      hasAssetsHeader: false,
    };
  }

  const octokit = getOctokit(config.token);
  const branch = config.branch || 'main';

  let hasWestModule = false;
  let hasKconfig = false;
  let hasAssetsHeader = false;
  let confPath = 'config/corne.conf';
  let westPath = 'config/west.yml';
  let existingConfContent = '';
  let existingWestContent = '';

  // 1. Check west.yml
  const westCandidates = ['config/west.yml', 'west.yml'];
  for (const p of westCandidates) {
    try {
      const res = await octokit.repos.getContent({
        owner: config.owner,
        repo: config.repo,
        path: p,
        ref: branch,
      });
      if ('content' in res.data && typeof res.data.content === 'string') {
        const decoded = atob(res.data.content.replace(/\s/g, ''));
        westPath = p;
        existingWestContent = decoded;
        if (decoded.includes('scyan-zmk-module')) {
          hasWestModule = true;
        }
        break;
      }
    } catch {
      // not found
    }
  }

  // 2. Check scyan_assets.h
  const headerCandidates = ['config/scyan_assets.h', 'include/scyan_assets.h', 'scyan_assets.h'];
  for (const p of headerCandidates) {
    try {
      const res = await octokit.repos.getContent({
        owner: config.owner,
        repo: config.repo,
        path: p,
        ref: branch,
      });
      if ('content' in res.data && typeof res.data.content === 'string') {
        hasAssetsHeader = true;
        break;
      }
    } catch {
      // not found
    }
  }

  // 3. Check .conf file
  let candidateConfFiles = ['config/corne.conf'];
  try {
    const dirRes = await octokit.repos.getContent({
      owner: config.owner,
      repo: config.repo,
      path: 'config',
      ref: branch,
    });
    if (Array.isArray(dirRes.data)) {
      const foundConfs = dirRes.data
        .filter(item => item.type === 'file' && item.name.endsWith('.conf') && !item.name.includes('_left') && !item.name.includes('_right'))
        .map(item => item.path);
      if (foundConfs.length > 0) {
        candidateConfFiles = foundConfs;
      }
    }
  } catch {
    // default candidate
  }

  for (const cp of candidateConfFiles) {
    try {
      const res = await octokit.repos.getContent({
        owner: config.owner,
        repo: config.repo,
        path: cp,
        ref: branch,
      });
      if ('content' in res.data && typeof res.data.content === 'string') {
        const decoded = atob(res.data.content.replace(/\s/g, ''));
        confPath = cp;
        existingConfContent = decoded;
        if (decoded.includes('CONFIG_ZMK_DISPLAY_STATUS_SCREEN_CUSTOM=y')) {
          hasKconfig = true;
        }
        break;
      }
    } catch {
      // not found
    }
  }

  const isInstalled = hasWestModule && hasKconfig && hasAssetsHeader;

  return {
    isInstalled,
    hasWestModule,
    hasKconfig,
    hasAssetsHeader,
    confPath,
    westPath,
    existingConfContent,
    existingWestContent,
  };
}

/**
 * Atomically configures the repository via GitHub Git Trees API:
 * 1. Updates/creates west.yml with scyan-zmk-module dependency
 * 2. Updates/creates corne.conf with custom status screen flags
 * 3. Commits initial starter scyan_assets.h
 */
export async function installScyanStudioToRepo(
  config: GitHubRepoConfig,
  defaultHeaderContent: string
): Promise<{ commitSha: string; commitUrl: string }> {
  if (!config.token || !config.owner || !config.repo) {
    throw new Error('Repository is not configured.');
  }

  const octokit = getOctokit(config.token);
  const branch = config.branch || 'main';

  // 1. Check prerequisites to obtain existing file contents
  const prereqs = await checkRepoPrerequisites(config);

  // 2. Prepare west.yml
  let newWestContent = prereqs.existingWestContent || '';
  if (!prereqs.hasWestModule) {
    if (newWestContent && newWestContent.includes('projects:')) {
      if (!newWestContent.includes('scyan-zmk-module')) {
        let remoteSnippet = '';
        if (!newWestContent.includes('name: brunowb')) {
          remoteSnippet = '    - name: brunowb\n      url-base: https://github.com/BrunoWB\n';
        }
        if (remoteSnippet && newWestContent.includes('remotes:')) {
          newWestContent = newWestContent.replace('remotes:\n', `remotes:\n${remoteSnippet}`);
        }
        const moduleSnippet = '    - name: scyan-zmk-module\n      remote: brunowb\n      revision: main\n';
        newWestContent = newWestContent.replace('projects:\n', `projects:\n${moduleSnippet}`);
      }
    } else {
      newWestContent = [
        'manifest:',
        '  defaults:',
        '    revision: v0.3',
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
        '',
      ].join('\n');
    }
  }

  // 3. Prepare .conf content
  let newConfContent = prereqs.existingConfContent || '';
  if (!prereqs.hasKconfig) {
    const kconfigSnippet = [
      '',
      '# Enable the Corne OLED Display (SSD1306)',
      'CONFIG_ZMK_DISPLAY=y',
      'CONFIG_SSD1306=y',
      'CONFIG_ZMK_DISPLAY_WORK_QUEUE_DEDICATED=y',
      'CONFIG_ZMK_DISPLAY_DEDICATED_THREAD_PRIORITY=10',
      'CONFIG_ZMK_DISPLAY_BLANK_ON_IDLE=y',
      '',
      '# Custom status screen (Scyan ZMK Display Module)',
      'CONFIG_ZMK_DISPLAY_STATUS_SCREEN_CUSTOM=y',
      'CONFIG_ZMK_DISPLAY_STATUS_SCREEN_BUILT_IN=n',
      'CONFIG_LV_USE_CANVAS=y',
      'CONFIG_LV_USE_IMG=y',
      'CONFIG_SCYAN_ROTATION_90=y',
      'CONFIG_SCYAN_ROTATION_270=n',
      'CONFIG_SCYAN_INVERT=y',
      'CONFIG_SCYAN_IDLE_TIMEOUT_MS=10000',
      'CONFIG_SCYAN_USER_NAME="SCYAN"',
      '',
    ].join('\n');

    newConfContent = (newConfContent ? newConfContent.trimEnd() + '\n' : '') + kconfigSnippet;
  }

  // 4. Collect file updates
  const filesToCommit: { path: string; content: string }[] = [];

  filesToCommit.push({
    path: 'config/scyan_assets.h',
    content: defaultHeaderContent,
  });

  if (!prereqs.hasWestModule) {
    filesToCommit.push({
      path: prereqs.westPath || 'config/west.yml',
      content: newWestContent,
    });
  }

  if (!prereqs.hasKconfig) {
    filesToCommit.push({
      path: prereqs.confPath || 'config/corne.conf',
      content: newConfContent,
    });
  }

  // 5. Git Trees API atomic commit
  const refRes = await octokit.git.getRef({
    owner: config.owner,
    repo: config.repo,
    ref: `heads/${branch}`,
  });
  const currentCommitSha = refRes.data.object.sha;

  const commitObjRes = await octokit.git.getCommit({
    owner: config.owner,
    repo: config.repo,
    commit_sha: currentCommitSha,
  });
  const baseTreeSha = commitObjRes.data.tree.sha;

  const treeRes = await octokit.git.createTree({
    owner: config.owner,
    repo: config.repo,
    base_tree: baseTreeSha,
    tree: filesToCommit.map(f => ({
      path: f.path,
      mode: '100644' as const,
      type: 'blob' as const,
      content: f.content,
    })),
  });

  const newCommitRes = await octokit.git.createCommit({
    owner: config.owner,
    repo: config.repo,
    message: 'feat(display): install Scyan ZMK Studio module, config & assets',
    tree: treeRes.data.sha,
    parents: [currentCommitSha],
  });

  await octokit.git.updateRef({
    owner: config.owner,
    repo: config.repo,
    ref: `heads/${branch}`,
    sha: newCommitRes.data.sha,
  });

  return {
    commitSha: newCommitRes.data.sha,
    commitUrl: newCommitRes.data.html_url,
  };
}



import { Octokit } from '@octokit/rest';
import YAML from 'yaml';
import { getShieldDefinition } from '../data/shieldsData';

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
  if (typeof localStorage === 'undefined') {
    return { owner: '', repo: '', branch: 'main', token: '' };
  }
  return {
    owner: localStorage.getItem(STORAGE_KEY_OWNER) || '',
    repo: localStorage.getItem(STORAGE_KEY_REPO) || '',
    branch: localStorage.getItem(STORAGE_KEY_BRANCH) || 'main',
    token: localStorage.getItem(STORAGE_KEY_TOKEN) || '',
  };
}

export function saveStoredGitHubConfig(config: Partial<GitHubRepoConfig>): void {
  if (typeof localStorage === 'undefined') return;
  if (config.owner !== undefined) localStorage.setItem(STORAGE_KEY_OWNER, config.owner);
  if (config.repo !== undefined) localStorage.setItem(STORAGE_KEY_REPO, config.repo);
  if (config.branch !== undefined) localStorage.setItem(STORAGE_KEY_BRANCH, config.branch);
  if (config.token !== undefined) localStorage.setItem(STORAGE_KEY_TOKEN, config.token);
}

export function clearStoredGitHubToken(): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY_TOKEN);
}

function getOctokit(token?: string): Octokit {
  return new Octokit({
    auth: token || undefined,
    request: {
      fetch: (url: any, opts: any) => fetch(url, { ...opts, cache: 'no-store' }),
    },
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
          const isZmk = (r: (typeof listRes.data)[0]) =>
            r.name.toLowerCase().includes('zmk') ||
            r.name.toLowerCase().includes('keymap') ||
            Boolean(r.description && r.description.toLowerCase().includes('zmk'));

          // Prioritize: 1) ZMK repo with push access, 2) Any repo with push access, 3) Any ZMK repo, 4) Most recently updated repo
          const zmkRepoWithPush = listRes.data.find(r => Boolean(r.permissions?.push) && isZmk(r));
          const anyRepoWithPush = listRes.data.find(r => Boolean(r.permissions?.push));
          const zmkRepo = listRes.data.find(r => isZmk(r));

          const candidate = zmkRepoWithPush || anyRepoWithPush || zmkRepo || listRes.data[0];

          if (candidate) {
            if (!owner) owner = candidate.owner.login;
            if (!repo) repo = candidate.name;
            if (!user.avatarUrl) {
              user.login = candidate.owner.login;
              user.name = candidate.owner.login;
              user.avatarUrl = candidate.owner.avatar_url;
            }
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

export const DEFAULT_HEADER_CANDIDATES = [
  'config/scyan_assets.h',
  'include/scyan_assets.h',
  'scyan_assets.h',
  'include/custom_display_assets.h',
] as const;

/**
 * Fetches file content from repository.
 */
export async function fetchFileFromRepo(
  config: GitHubRepoConfig,
  path = 'config/scyan_assets.h',
  targetRef?: string
): Promise<{ content: string; sha: string; resolvedPath?: string }> {
  const octokit = getOctokit(config.token);

  // Try targetRef or configured branch first, then fallback to main/master
  let headSha: string | undefined;
  if (!targetRef) {
    try {
      const branchToProbe = config.branch || 'main';
      const refRes = await octokit.git.getRef({
        owner: config.owner,
        repo: config.repo,
        ref: `heads/${branchToProbe}`,
      });
      headSha = refRes.data.object.sha;
    } catch {}
  }

  const branches = targetRef
    ? [targetRef]
    : [headSha, config.branch, 'main', 'master'].filter((b): b is string => Boolean(b));
  const uniqueBranches = Array.from(new Set(branches));

  // Determine candidate paths to probe in target repository
  const isDefaultAssetPath = DEFAULT_HEADER_CANDIDATES.includes(path as any);
  const candidatePaths = isDefaultAssetPath
    ? [...DEFAULT_HEADER_CANDIDATES]
    : [path, ...DEFAULT_HEADER_CANDIDATES];
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

export const STUDIO_COMMIT_PREFIX = '[Scyan Studio] ';

/**
 * Ensures all commits originating from Scyan Studio start with "[Scyan Studio] ".
 */
export function formatStudioCommitMessage(message: string): string {
  const trimmed = message.trim();
  if (trimmed.startsWith(STUDIO_COMMIT_PREFIX)) {
    return trimmed;
  }
  return `${STUDIO_COMMIT_PREFIX}${trimmed}`;
}

/**
 * Safely encodes a UTF-8 string into Base64 (browser & Node compatible).
 */
export function encodeBase64Utf8(content: string): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(content, 'utf8').toString('base64');
  }
  const utf8Bytes = new TextEncoder().encode(content);
  let binary = '';
  const len = utf8Bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(utf8Bytes[i]);
  }
  return btoa(binary);
}

export interface GitFileAddition {
  path: string;
  content: string;
}

export interface GitFileDeletion {
  path: string;
}

export interface AtomicCommitOptions {
  config: GitHubRepoConfig;
  message: string;
  additions?: GitFileAddition[];
  deletions?: GitFileDeletion[];
  expectedHeadOid?: string;
}

export interface AtomicCommitResult {
  commitSha: string;
  commitUrl: string;
  filesCommitted: string[];
}

/**
 * Atomically commits multiple file additions and deletions directly on a branch
 * in a single network roundtrip using the GitHub GraphQL `createCommitOnBranch` mutation.
 */
export async function commitChangesAtomicViaGraphQL(
  options: AtomicCommitOptions
): Promise<AtomicCommitResult> {
  const { config, message, additions = [], deletions = [] } = options;
  if (additions.length === 0 && deletions.length === 0) {
    throw new Error('No file changes specified for commit.');
  }

  const octokit = getOctokit(config.token);
  const branch = (config.branch || 'main').replace(/^refs\/heads\//, '');
  const formattedMessage = formatStudioCommitMessage(message);

  const lines = formattedMessage.split('\n');
  const headline = lines[0];
  const body = lines.slice(1).join('\n').trim();

  // 1. Resolve expectedHeadOid if not provided
  let headOid = options.expectedHeadOid;
  if (!headOid) {
    try {
      const branchData = await octokit.graphql<{
        repository?: {
          ref?: {
            target?: {
              oid?: string;
            };
          };
        };
      }>(
        `
        query GetBranchHead($owner: String!, $repo: String!, $qualifiedName: String!) {
          repository(owner: $owner, name: $repo) {
            ref(qualifiedName: $qualifiedName) {
              target {
                oid
              }
            }
          }
        }
        `,
        {
          owner: config.owner,
          repo: config.repo,
          qualifiedName: `refs/heads/${branch}`,
        }
      );
      headOid = branchData?.repository?.ref?.target?.oid;
    } catch {
      // If GraphQL query fails, fallback to getRef below
    }
  }

  if (!headOid) {
    const refRes = await octokit.git.getRef({
      owner: config.owner,
      repo: config.repo,
      ref: `heads/${branch}`,
    });
    headOid = refRes.data.object.sha;
  }

  // 2. Build file changes
  const fileChanges: {
    additions?: { path: string; contents: string }[];
    deletions?: { path: string }[];
  } = {};

  if (additions.length > 0) {
    fileChanges.additions = additions.map(a => ({
      path: a.path,
      contents: encodeBase64Utf8(a.content),
    }));
  }

  if (deletions.length > 0) {
    fileChanges.deletions = deletions.map(d => ({
      path: d.path,
    }));
  }

  const mutation = `
    mutation CreateCommitOnBranch($input: CreateCommitOnBranchInput!) {
      createCommitOnBranch(input: $input) {
        commit {
          oid
          url
        }
      }
    }
  `;

  const res = await octokit.graphql<{
    createCommitOnBranch: {
      commit: {
        oid: string;
        url: string;
      };
    };
  }>(mutation, {
    input: {
      branch: {
        repositoryNameWithOwner: `${config.owner}/${config.repo}`,
        branchName: branch,
      },
      expectedHeadOid: headOid,
      message: {
        headline,
        ...(body ? { body } : {}),
      },
      fileChanges,
    },
  });

  const commit = res.createCommitOnBranch.commit;
  const filesCommitted = [
    ...additions.map(a => a.path),
    ...deletions.map(d => `${d.path} (deleted)`),
  ];

  return {
    commitSha: commit.oid,
    commitUrl: commit.url,
    filesCommitted,
  };
}

/**
 * Commits multiple file additions and deletions via the multi-step REST Git Trees API
 * (getRef -> getCommit -> createTree -> createCommit -> updateRef).
 */
export async function commitChangesViaGitTrees(
  options: AtomicCommitOptions
): Promise<AtomicCommitResult> {
  const { config, message, additions = [], deletions = [] } = options;
  if (additions.length === 0 && deletions.length === 0) {
    throw new Error('No file changes specified for commit.');
  }

  const octokit = getOctokit(config.token);
  const branch = (config.branch || 'main').replace(/^refs\/heads\//, '');
  const formattedMessage = formatStudioCommitMessage(message);

  let currentCommitSha = options.expectedHeadOid;
  if (!currentCommitSha) {
    const refRes = await octokit.git.getRef({
      owner: config.owner,
      repo: config.repo,
      ref: `heads/${branch}`,
    });
    currentCommitSha = refRes.data.object.sha;
  }

  const commitObjRes = await octokit.git.getCommit({
    owner: config.owner,
    repo: config.repo,
    commit_sha: currentCommitSha,
  });
  const baseTreeSha = commitObjRes.data.tree.sha;

  const treeEntries: Array<{
    path: string;
    mode: '100644';
    type: 'blob';
    sha?: string | null;
    content?: string;
  }> = [];

  for (const a of additions) {
    treeEntries.push({
      path: a.path,
      mode: '100644',
      type: 'blob',
      content: a.content,
    });
  }

  for (const d of deletions) {
    treeEntries.push({
      path: d.path,
      mode: '100644',
      type: 'blob',
      sha: null,
    });
  }

  const treeRes = await octokit.git.createTree({
    owner: config.owner,
    repo: config.repo,
    base_tree: baseTreeSha,
    tree: treeEntries as any,
  });

  const newCommitRes = await octokit.git.createCommit({
    owner: config.owner,
    repo: config.repo,
    message: formattedMessage,
    tree: treeRes.data.sha,
    parents: [currentCommitSha],
  });

  await octokit.git.updateRef({
    owner: config.owner,
    repo: config.repo,
    ref: `heads/${branch}`,
    sha: newCommitRes.data.sha,
  });

  const filesCommitted = [
    ...additions.map(a => a.path),
    ...deletions.map(d => `${d.path} (deleted)`),
  ];

  return {
    commitSha: newCommitRes.data.sha,
    commitUrl: newCommitRes.data.html_url,
    filesCommitted,
  };
}

/**
 * Commits file additions and deletions, trying the single-roundtrip GraphQL createCommitOnBranch
 * first, and gracefully falling back to Git Trees REST API if GraphQL fails.
 */
export async function commitChangesWithFallback(
  options: AtomicCommitOptions
): Promise<AtomicCommitResult> {
  try {
    return await commitChangesAtomicViaGraphQL(options);
  } catch (graphQLErr) {
    console.warn(
      'GitHub GraphQL createCommitOnBranch failed, falling back to Git Trees REST API:',
      graphQLErr
    );
    return await commitChangesViaGitTrees(options);
  }
}

/**
 * Commits a single file update to the repository (legacy/single-file fallback).
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
  const base64Content = encodeBase64Utf8(content);
  const formattedMessage = formatStudioCommitMessage(commitMessage);

  try {
    const res = await octokit.repos.createOrUpdateFileContents({
      owner: config.owner,
      repo: config.repo,
      path,
      message: formattedMessage,
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
          message: formattedMessage,
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

    const items: GitHubRepositoryItem[] = res.data.map(repo => {
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

    // When fine-grained tokens are used or when write-accessible repositories exist,
    // restrict selection to repositories where push access is verified so the selector
    // does not list unrelated public read-only repositories.
    const pushAccessible = items.filter(r => r.hasPushAccess);
    if (pushAccessible.length > 0) {
      return pushAccessible;
    }
    return items;
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
  candidateConfFiles?: string[];
  westPath?: string;
  headerPath?: string;
  existingHeaderPaths?: string[];
  existingConfContent?: string;
  existingWestContent?: string;
  buildYamlContent?: string;
}

/**
 * Checks whether the connected repository is configured with scyan-zmk-module,
 * required display Kconfig flags, and scyan_assets.h.
 */
export async function checkRepoPrerequisites(
  config: GitHubRepoConfig,
  targetRef?: string
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

  // Resolve ref: use targetRef if provided, or fetch the latest live branch commit SHA
  // via Git Data API to guarantee fresh contents and bypass GitHub's 60s edge cache.
  let refToUse = targetRef;
  if (!refToUse) {
    try {
      const refRes = await octokit.git.getRef({
        owner: config.owner,
        repo: config.repo,
        ref: `heads/${branch}`,
      });
      refToUse = refRes.data.object.sha;
    } catch {
      refToUse = branch;
    }
  }

  let hasWestModule = false;
  let hasKconfig = false;
  let hasAssetsHeader = false;
  let confPath = 'config/corne.conf';
  let westPath = 'config/west.yml';
  let headerPath = 'config/scyan_assets.h';
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
        ref: refToUse,
      });
      if ('content' in res.data && typeof res.data.content === 'string') {
        const decoded = atob(res.data.content.replace(/\s/g, ''));
        westPath = p;
        existingWestContent = decoded;
        try {
          const parsedManifest = YAML.parse(decoded);
          const projects = parsedManifest?.manifest?.projects;
          if (Array.isArray(projects)) {
            hasWestModule = projects.some((proj: any) => proj?.name === 'scyan-zmk-module');
          } else {
            hasWestModule = false;
          }
        } catch {
          // Fallback if YAML parsing errors
          hasWestModule = decoded.includes('scyan-zmk-module');
        }
        break;
      }
    } catch (err: any) {
      if (err.status !== 404) {
        console.warn(`[checkRepoPrerequisites] Error checking west candidate ${p}:`, err);
      }
    }
  }

  // 2. Check scyan_assets.h across all candidate paths (detecting all existing files)
  const existingHeaderPaths: string[] = [];
  let detectedHeaderPath: string | undefined = undefined;
  for (const p of DEFAULT_HEADER_CANDIDATES) {
    try {
      const res = await octokit.repos.getContent({
        owner: config.owner,
        repo: config.repo,
        path: p,
        ref: refToUse,
      });
      if ('content' in res.data && typeof res.data.content === 'string') {
        hasAssetsHeader = true;
        if (!detectedHeaderPath) {
          detectedHeaderPath = p;
        }
        existingHeaderPaths.push(p);
      }
    } catch (err: any) {
      if (err.status !== 404) {
        console.warn(`[checkRepoPrerequisites] Error checking header candidate ${p}:`, err);
      }
    }
  }
  if (detectedHeaderPath) {
    headerPath = detectedHeaderPath;
  }

  // 3. Check .conf file
  let candidateConfFiles = ['config/corne.conf'];
  try {
    const dirRes = await octokit.repos.getContent({
      owner: config.owner,
      repo: config.repo,
      path: 'config',
      ref: refToUse,
    });
    if (Array.isArray(dirRes.data)) {
      const foundConfs = dirRes.data
        .filter(item => item.type === 'file' && item.name.endsWith('.conf') && !item.name.includes('_left') && !item.name.includes('_right'))
        .map(item => item.path);
      if (foundConfs.length > 0) {
        candidateConfFiles = foundConfs;
      }
    }
  } catch (err: any) {
    if (err.status !== 404) {
      console.warn('[checkRepoPrerequisites] Error reading config directory:', err);
    }
  }

  for (const cp of candidateConfFiles) {
    try {
      const res = await octokit.repos.getContent({
        owner: config.owner,
        repo: config.repo,
        path: cp,
        ref: refToUse,
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
    } catch (err: any) {
      if (err.status !== 404) {
        console.warn(`[checkRepoPrerequisites] Error checking conf candidate ${cp}:`, err);
      }
    }
  }

  let buildYamlContent: string | undefined = undefined;
  try {
    const buildRes = await octokit.repos.getContent({
      owner: config.owner,
      repo: config.repo,
      path: 'build.yaml',
      ref: refToUse,
    });
    if ('content' in buildRes.data && typeof buildRes.data.content === 'string') {
      buildYamlContent = atob(buildRes.data.content.replace(/\s/g, ''));
    }
  } catch {
    // build.yaml is optional
  }

  const isInstalled = hasWestModule && hasKconfig && hasAssetsHeader;

  return {
    isInstalled,
    hasWestModule,
    hasKconfig,
    hasAssetsHeader,
    confPath,
    candidateConfFiles,
    westPath,
    headerPath,
    existingHeaderPaths,
    existingConfContent,
    existingWestContent,
    buildYamlContent,
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

  // 1. Check prerequisites to obtain existing file contents
  const prereqs = await checkRepoPrerequisites(config);

  // 2. Prepare west.yml
  let newWestContent = prereqs.existingWestContent || '';
  if (!prereqs.hasWestModule) {
    newWestContent = injectScyanIntoWest(newWestContent);
  }

  // 3. Prepare .conf content
  let newConfContent = prereqs.existingConfContent || '';
  if (!prereqs.hasKconfig) {
    const lines: string[] = [''];
    if (!newConfContent.includes('CONFIG_ZMK_DISPLAY=')) {
      lines.push('# Enable display');
      lines.push('CONFIG_ZMK_DISPLAY=y');
      lines.push('CONFIG_ZMK_DISPLAY_WORK_QUEUE_DEDICATED=y');
      lines.push('CONFIG_ZMK_DISPLAY_DEDICATED_THREAD_PRIORITY=10');
      lines.push('CONFIG_ZMK_DISPLAY_BLANK_ON_IDLE=y');
      lines.push('');
    }
    lines.push('# Custom status screen (Scyan ZMK Display Module)');
    lines.push('CONFIG_ZMK_DISPLAY_STATUS_SCREEN_CUSTOM=y');
    lines.push('CONFIG_ZMK_DISPLAY_STATUS_SCREEN_BUILT_IN=n');
    lines.push('CONFIG_LV_USE_CANVAS=y');
    lines.push('CONFIG_LV_USE_IMG=y');
    lines.push('CONFIG_SCYAN_INVERT=y');
    lines.push('');
    const kconfigSnippet = lines.join('\n');

    newConfContent = (newConfContent ? newConfContent.trimEnd() + '\n' : '') + kconfigSnippet;
  }

  // 4. Collect file updates
  const filesToCommit: GitFileAddition[] = [];

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

  // 5. Commit changes atomically (GraphQL createCommitOnBranch with REST fallback)
  const commitRes = await commitChangesWithFallback({
    config,
    message: `${STUDIO_COMMIT_PREFIX}Install: module & starter assets`,
    additions: filesToCommit,
  });

  return {
    commitSha: commitRes.commitSha,
    commitUrl: commitRes.commitUrl,
  };
}

/**
 * Injects scyan-zmk-module and the brunowb remote into west.yml using YAML AST.
 * Preserves comments, formatting, and indentation.
 */
export function injectScyanIntoWest(content: string): string {
  if (!content || !content.trim()) {
    return [
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

  try {
    const doc = YAML.parseDocument(content);
    let manifest = doc.get('manifest') as any;
    if (!manifest) {
      doc.set('manifest', doc.createNode({}));
      manifest = doc.get('manifest');
    }

    // Check / add remote 'brunowb'
    let remotes = manifest.get ? manifest.get('remotes') : manifest.remotes;
    if (!remotes) {
      manifest.set('remotes', doc.createNode([]));
      remotes = manifest.get('remotes');
    }

    const hasBrunowbRemote =
      remotes?.items &&
      Array.isArray(remotes.items) &&
      remotes.items.some((item: any) => {
        const name = item?.get ? item.get('name') : item?.name;
        return name === 'brunowb';
      });

    if (!hasBrunowbRemote) {
      remotes.add(
        doc.createNode({
          name: 'brunowb',
          'url-base': 'https://github.com/BrunoWB',
        })
      );
    }

    // Check / add project 'scyan-zmk-module'
    let projects = manifest.get ? manifest.get('projects') : manifest.projects;
    if (!projects) {
      manifest.set('projects', doc.createNode([]));
      projects = manifest.get('projects');
    }

    const hasModule =
      projects?.items &&
      Array.isArray(projects.items) &&
      projects.items.some((item: any) => {
        const name = item?.get ? item.get('name') : item?.name;
        return name === 'scyan-zmk-module';
      });

    if (!hasModule) {
      projects.add(
        doc.createNode({
          name: 'scyan-zmk-module',
          remote: 'brunowb',
          revision: 'main',
        })
      );
    }

    return doc.toString();
  } catch (err) {
    console.warn('[injectScyanIntoWest] AST manipulation failed, returning original:', err);
    return content;
  }
}

/**
 * Removes a named entry from a YAML list (e.g. under `projects:` or `remotes:` in west.yml),
 * safely preserving sibling items, comments, and following sections using YAML AST.
 */
export function removeYamlListItem(content: string, itemName: string): string {
  try {
    const doc = YAML.parseDocument(content);
    if (!doc || !doc.contents) return content;

    const manifest = doc.get('manifest') as any;
    if (manifest) {
      for (const key of ['projects', 'remotes']) {
        const seq = manifest.get ? manifest.get(key) : manifest[key];
        if (seq && seq.items && Array.isArray(seq.items)) {
          const idx = seq.items.findIndex((item: any) => {
            const name = item?.get ? item.get('name') : item?.name;
            return typeof name === 'string' && name.toLowerCase() === itemName.toLowerCase();
          });
          if (idx !== -1) {
            seq.items.splice(idx, 1);
          }
        }
      }
    }
    return doc.toString();
  } catch (err) {
    console.warn('[removeYamlListItem] Failed to parse YAML AST:', err);
    return content;
  }
}

/**
 * Removes scyan-zmk-module and its remote (if unused by other projects) from west.yml using YAML AST.
 */
export function removeScyanFromWest(content: string): string {
  try {
    const doc = YAML.parseDocument(content);
    if (!doc || !doc.contents) return content;

    const manifest = doc.get('manifest') as any;
    if (!manifest) return content;

    // 1. Remove project scyan-zmk-module
    const projects = manifest.get ? manifest.get('projects') : manifest.projects;
    if (projects && projects.items && Array.isArray(projects.items)) {
      const projIdx = projects.items.findIndex((item: any) => {
        const name = item?.get ? item.get('name') : item?.name;
        return typeof name === 'string' && name.toLowerCase() === 'scyan-zmk-module';
      });
      if (projIdx !== -1) {
        projects.items.splice(projIdx, 1);
      }
    }

    // 2. Check if any other project uses brunowb remote
    let hasOtherBrunowb = false;
    if (projects && projects.items && Array.isArray(projects.items)) {
      hasOtherBrunowb = projects.items.some((item: any) => {
        const remote = item?.get ? item.get('remote') : item?.remote;
        return typeof remote === 'string' && remote.toLowerCase() === 'brunowb';
      });
    }

    // 3. If no other project uses brunowb, remove brunowb remote
    if (!hasOtherBrunowb) {
      const remotes = manifest.get ? manifest.get('remotes') : manifest.remotes;
      if (remotes && remotes.items && Array.isArray(remotes.items)) {
        const remIdx = remotes.items.findIndex((item: any) => {
          const name = item?.get ? item.get('name') : item?.name;
          return typeof name === 'string' && name.toLowerCase() === 'brunowb';
        });
        if (remIdx !== -1) {
          remotes.items.splice(remIdx, 1);
        }
      }
    }

    return doc.toString();
  } catch (err) {
    console.warn('[removeScyanFromWest] Failed to parse YAML AST:', err);
    return content;
  }
}

/**
 * Removes custom Scyan display configs and overrides from a .conf file.
 * Leaves generic display configurations (like SSD1306, work queue, etc.) intact.
 */
export function removeScyanFromConf(content: string): string {
  const lines = content.split(/\r?\n/);
  const filtered = lines.filter(line => {
    const trimmed = line.trim();
    if (/^#?\s*CONFIG_SCYAN_/i.test(trimmed)) return false;
    if (/^#?\s*CONFIG_ZMK_DISPLAY_STATUS_SCREEN_CUSTOM\b/i.test(trimmed)) return false;
    if (/^#?\s*CONFIG_ZMK_DISPLAY_STATUS_SCREEN_BUILT_IN\b/i.test(trimmed)) return false;
    if (/^#?\s*CONFIG_LV_USE_CANVAS\b/i.test(trimmed)) return false;
    if (/^#?\s*CONFIG_LV_USE_IMG\b/i.test(trimmed)) return false;
    if (/^#\s*(Custom status screen|Scyan ZMK Display Module)/i.test(trimmed)) return false;
    return true;
  });
  return filtered.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
}

/**
 * Atomically uninstalls Scyan Studio from the connected repository:
 * 1. Removes scyan-zmk-module from west.yml
 * 2. Cleans custom Scyan Kconfig flags from .conf
 * 3. Deletes scyan_assets.h
 */
export async function uninstallScyanStudioFromRepo(
  config: GitHubRepoConfig
): Promise<{ commitSha: string; commitUrl: string }> {
  if (!config.token || !config.owner || !config.repo) {
    throw new Error('Repository is not configured.');
  }

  // 1. Check prerequisites to locate existing files
  const prereqs = await checkRepoPrerequisites(config);

  const additions: GitFileAddition[] = [];
  const deletions: GitFileDeletion[] = [];

  // 2. Prepare cleaned west.yml if present
  if (prereqs.existingWestContent && prereqs.existingWestContent.includes('scyan-zmk-module')) {
    const cleanedWest = removeScyanFromWest(prereqs.existingWestContent);
    if (cleanedWest !== prereqs.existingWestContent) {
      additions.push({
        path: prereqs.westPath || 'config/west.yml',
        content: cleanedWest,
      });
    }
  }

  // 3. Prepare cleaned .conf if present
  const confsToClean = new Set<string>();
  if (prereqs.confPath) confsToClean.add(prereqs.confPath);
  if (prereqs.candidateConfFiles) {
    prereqs.candidateConfFiles.forEach((cp) => confsToClean.add(cp));
  }

  const octokit = getOctokit(config.token);
  const refToUse = config.branch || 'main';

  for (const cp of confsToClean) {
    try {
      let content = cp === prereqs.confPath && prereqs.existingConfContent ? prereqs.existingConfContent : null;
      if (!content) {
        const res = await octokit.repos.getContent({
          owner: config.owner,
          repo: config.repo,
          path: cp,
          ref: refToUse,
        });
        if ('content' in res.data && typeof res.data.content === 'string') {
          content = atob(res.data.content.replace(/\s/g, ''));
        }
      }
      if (content) {
        const cleanedConf = removeScyanFromConf(content);
        if (cleanedConf !== content) {
          additions.push({
            path: cp,
            content: cleanedConf,
          });
        }
      }
    } catch {}
  }

  // 4. Remove all scyan_assets.h files if they exist (primary and legacy locations)
  const headersToDelete = new Set<string>();
  if (prereqs.hasAssetsHeader && prereqs.headerPath) {
    headersToDelete.add(prereqs.headerPath);
  }
  if (prereqs.existingHeaderPaths) {
    prereqs.existingHeaderPaths.forEach((hp) => headersToDelete.add(hp));
  }
  for (const p of DEFAULT_HEADER_CANDIDATES) {
    if (!headersToDelete.has(p)) {
      try {
        const res = await octokit.repos.getContent({
          owner: config.owner,
          repo: config.repo,
          path: p,
          ref: refToUse,
        });
        if ('content' in res.data) {
          headersToDelete.add(p);
        }
      } catch {}
    }
  }

  for (const p of headersToDelete) {
    deletions.push({ path: p });
  }

  if (additions.length === 0 && deletions.length === 0) {
    throw new Error('No Scyan Studio assets or configurations found to uninstall.');
  }

  // 5. Commit changes atomically (GraphQL createCommitOnBranch with REST fallback)
  const commitRes = await commitChangesWithFallback({
    config,
    message: `${STUDIO_COMMIT_PREFIX}Uninstall: module & assets`,
    additions,
    deletions,
  });

  return {
    commitSha: commitRes.commitSha,
    commitUrl: commitRes.commitUrl,
  };
}

/**
 * Updates or appends a Kconfig key=value setting in .conf content.
 * Safely handles commented-out values like `# CONFIG_ZMK_IDLE_TIMEOUT=...`
 * without touching unrelated comments.
 */
export function updateKconfigSetting(
  content: string,
  key: string,
  value: string | number
): { updated: string; changed: boolean } {
  const targetLine = `${key}=${value}`;
  const regex = new RegExp(`^(\\s*#\\s*)?${key}=.*$`, 'm');
  const match = content.match(regex);

  if (match) {
    // If exact match already exists, no change needed
    if (match[0] === targetLine) {
      return { updated: content, changed: false };
    }
    const updated = content.replace(regex, targetLine);
    return { updated, changed: true };
  }

  // Not found: append at end
  const trimmed = content.trimEnd();
  const updated = trimmed ? `${trimmed}\n${targetLine}\n` : `${targetLine}\n`;
  return { updated, changed: true };
}

export interface TimeoutConfig {
  screenOffTimeoutSec: number;
  peripheralScreenOffTimeoutSec?: number;
  rightScreenOffTimeoutSec?: number;
  symmetricSettings: boolean;
  displays?: Record<string, import('../types/zmk').DisplayScreen>;
}

export interface ResolveConfUpdatesOptions {
  isSplit?: boolean;
  rightIsCentral?: boolean;
  displayAssignments?: Record<string, string | null>;
  displays?: Record<string, import('../types/zmk').DisplayScreen>;
}

/**
 * Resolves which .conf files should be updated with new CONFIG_ZMK_IDLE_TIMEOUT settings.
 * Directly maps shields that have mounted displays (displayAssignments[shield.id]) to their display's screenOffTimeoutSec.
 */
export function resolveConfTimeoutUpdates(
  confFiles: { path: string; content: string }[],
  timeouts: TimeoutConfig,
  options?: ResolveConfUpdatesOptions
): { path: string; content: string }[] {
  const isConfWithoutDisplay = (confPath: string): boolean => {
    if (!options?.displayAssignments) return false;
    const base = confPath.replace(/^.*[/\\]/, '').replace(/\.conf$/, '').toLowerCase().replace(/_/g, '-');
    for (const [shId, disp] of Object.entries(options.displayAssignments)) {
      const normSh = shId.toLowerCase().replace(/_/g, '-');
      if (disp === null && (base.includes(normSh) || normSh.includes(base))) {
        return true;
      }
    }
    return false;
  };

  const activeConfFiles = confFiles.filter((f) => !isConfWithoutDisplay(f.path));

  const hasSplitName = activeConfFiles.some((f) => {
    const l = f.path.toLowerCase();
    return (
      l.includes('_central') ||
      l.includes('-central') ||
      l.includes('_left') ||
      l.includes('-left') ||
      l.includes('_peripheral') ||
      l.includes('-peripheral') ||
      l.includes('_right') ||
      l.includes('-right')
    );
  });

  const baseShield =
    activeConfFiles.length > 0
      ? activeConfFiles[0].path
          .replace(/^.*[/\\]/, '')
          .replace(/\.conf$/, '')
          .replace(/_(left|right)$/, '')
          .toLowerCase()
          .replace(/_/g, '-')
      : '';
  const shieldDef = baseShield ? getShieldDefinition(baseShield) : null;
  const isKnownSplitShield =
    shieldDef?.layoutGeometry?.type === 'split-pair' ||
    shieldDef?.category === 'split-pair';

  const isSplit =
    options?.isSplit !== undefined
      ? options.isSplit
      : hasSplitName || isKnownSplitShield || activeConfFiles.length > 1;

  const centralTimeoutMs = timeouts.screenOffTimeoutSec * 1000;
  const peripheralTimeoutSec = timeouts.peripheralScreenOffTimeoutSec ?? timeouts.rightScreenOffTimeoutSec;
  const peripheralTimeoutMs = (
    timeouts.symmetricSettings
      ? timeouts.screenOffTimeoutSec
      : (peripheralTimeoutSec ?? timeouts.screenOffTimeoutSec)
  ) * 1000;

  const leftTimeoutMs = options?.rightIsCentral ? peripheralTimeoutMs : centralTimeoutMs;
  const rightTimeoutMs = options?.rightIsCentral ? centralTimeoutMs : peripheralTimeoutMs;

  const displaysMap = options?.displays ?? timeouts.displays;
  const updates: { path: string; content: string }[] = [];
  const handledPaths = new Set<string>();

  // If display assignments are provided, directly map each assigned shield to its display's timeout
  if (options?.displayAssignments && Object.keys(options.displayAssignments).length > 0) {
    for (const [shieldId, dispId] of Object.entries(options.displayAssignments)) {
      if (!dispId) continue;

      let targetTimeoutMs = centralTimeoutMs;
      if (timeouts.symmetricSettings) {
        targetTimeoutMs = timeouts.screenOffTimeoutSec * 1000;
      } else if (displaysMap && displaysMap[dispId]) {
        targetTimeoutMs = displaysMap[dispId].screenOffTimeoutSec * 1000;
      } else if (dispId === 'peripheral' || dispId === 'display-2' || dispId.startsWith('peripheral')) {
        targetTimeoutMs = peripheralTimeoutMs;
      } else if (dispId === 'central' || dispId === 'display-1') {
        targetTimeoutMs = centralTimeoutMs;
      }

      const normShield = shieldId.toLowerCase().replace(/_/g, '-');
      const matchingConfs = activeConfFiles.filter((f) => {
        const base = f.path.replace(/^.*[/\\]/, '').replace(/\.conf$/, '').toLowerCase().replace(/_/g, '-');
        return base === normShield || base.endsWith(`-${normShield}`) || normShield.endsWith(`-${base}`);
      });

      for (const conf of matchingConfs) {
        handledPaths.add(conf.path);
        const res = updateKconfigSetting(conf.content, 'CONFIG_ZMK_IDLE_TIMEOUT', targetTimeoutMs);
        if (res.changed) {
          updates.push({ path: conf.path, content: res.updated });
        }
      }
    }
  }

  // If all active conf files were resolved via display assignments, return early
  const unhandledConfs = activeConfFiles.filter((f) => !handledPaths.has(f.path));
  if (unhandledConfs.length === 0) {
    return updates;
  }

  const leftConfs = unhandledConfs.filter((f) => {
    const lower = f.path.toLowerCase();
    return (
      lower.includes('_central') ||
      lower.includes('-central') ||
      lower.includes('_left') ||
      lower.includes('-left')
    );
  });

  const rightConfs = unhandledConfs.filter((f) => {
    const lower = f.path.toLowerCase();
    return (
      lower.includes('_peripheral') ||
      lower.includes('-peripheral') ||
      lower.includes('_right') ||
      lower.includes('-right')
    );
  });

  const baseConfs = unhandledConfs.filter((f) => {
    const lower = f.path.toLowerCase();
    return (
      !lower.includes('_central') &&
      !lower.includes('-central') &&
      !lower.includes('_left') &&
      !lower.includes('-left') &&
      !lower.includes('_peripheral') &&
      !lower.includes('-peripheral') &&
      !lower.includes('_right') &&
      !lower.includes('-right')
    );
  });

  if (leftConfs.length > 0 || rightConfs.length > 0) {
    // Split configuration present: update left (or base fallback) and right confs
    const primaryLefts = leftConfs.length > 0 ? leftConfs : baseConfs;
    for (const lc of primaryLefts) {
      const res = updateKconfigSetting(lc.content, 'CONFIG_ZMK_IDLE_TIMEOUT', leftTimeoutMs);
      if (res.changed) {
        updates.push({ path: lc.path, content: res.updated });
      }
    }
    for (const rc of rightConfs) {
      const res = updateKconfigSetting(rc.content, 'CONFIG_ZMK_IDLE_TIMEOUT', rightTimeoutMs);
      if (res.changed) {
        updates.push({ path: rc.path, content: res.updated });
      }
    }
  } else if (baseConfs.length > 0) {
    if (timeouts.symmetricSettings || !isSplit) {
      // Single/unified configuration or unibody keyboard
      for (const bc of baseConfs) {
        const res = updateKconfigSetting(bc.content, 'CONFIG_ZMK_IDLE_TIMEOUT', leftTimeoutMs);
        if (res.changed) {
          updates.push({ path: bc.path, content: res.updated });
        }
      }
    } else {
      // Asymmetric settings requested for split keyboard but only base conf exists.
      // 1. Update base conf with left (central) timeout
      const primaryBase = baseConfs[0];
      const baseRes = updateKconfigSetting(primaryBase.content, 'CONFIG_ZMK_IDLE_TIMEOUT', leftTimeoutMs);
      if (baseRes.changed) {
        updates.push({ path: primaryBase.path, content: baseRes.updated });
      }
      // 2. Create right conf (e.g. config/corne.conf -> config/corne_right.conf) to apply right peripheral timeout
      const extMatch = primaryBase.path.match(/^(.*)\.conf$/);
      if (extMatch && isSplit) {
        const rightPath = `${extMatch[1]}_right.conf`;
        const rightRes = updateKconfigSetting('', 'CONFIG_ZMK_IDLE_TIMEOUT', rightTimeoutMs);
        updates.push({ path: rightPath, content: rightRes.updated });
      }
    }
  }

  return updates;
}

export const resolveConfUpdates = resolveConfTimeoutUpdates;

/**
 * Probes the repository for .conf files, typically in config/ or root.
 */
export async function fetchRepoConfFiles(
  config: GitHubRepoConfig
): Promise<{ path: string; content: string }[]> {
  if (!config.token || !config.owner || !config.repo) {
    return [];
  }
  const octokit = getOctokit(config.token);
  const branch = config.branch || 'main';

  const confFiles: { path: string; content: string }[] = [];
  const candidateDirs = ['config', ''];

  for (const dir of candidateDirs) {
    try {
      const res = await octokit.repos.getContent({
        owner: config.owner,
        repo: config.repo,
        path: dir,
        ref: branch,
      });
      if (Array.isArray(res.data)) {
        const confItems = res.data.filter(
          item => item.type === 'file' && item.name.endsWith('.conf')
        );
        for (const item of confItems) {
          try {
            const fileRes = await octokit.repos.getContent({
              owner: config.owner,
              repo: config.repo,
              path: item.path,
              ref: branch,
            });
            if ('content' in fileRes.data && typeof fileRes.data.content === 'string') {
              const decoded = atob(fileRes.data.content.replace(/\s/g, ''));
              confFiles.push({ path: item.path, content: decoded });
            }
          } catch {
            // ignore individual file read failure
          }
        }
        if (confFiles.length > 0) {
          break; // Found conf files in preferred directory
        }
      }
    } catch {
      // directory does not exist or inaccessible
    }
  }

  return confFiles;
}

export interface CommitStudioSaveResult {
  commitUrl: string;
  commitSha: string;
  filesCommitted: string[];
}

/**
 * Atomically commits display assets and any updated Kconfig .conf files using Git Trees API.
 */
export async function commitStudioSaveToRepo(
  config: GitHubRepoConfig,
  headerPath: string,
  headerContent: string,
  timeouts: TimeoutConfig,
  commitMessage = `${STUDIO_COMMIT_PREFIX}Update: spritesheets & screen layouts`,
  options?: ResolveConfUpdatesOptions
): Promise<CommitStudioSaveResult> {
  if (!config.token || !config.owner || !config.repo) {
    throw new Error('GitHub Personal Access Token is required to commit changes.');
  }

  const formattedMessage = formatStudioCommitMessage(commitMessage);

  // 1. Discover .conf files and calculate required Kconfig updates
  let confUpdates: { path: string; content: string }[] = [];
  try {
    const existingConfs = await fetchRepoConfFiles(config);
    confUpdates = resolveConfTimeoutUpdates(existingConfs, timeouts, options);
  } catch (err) {
    console.warn('Could not inspect .conf files for Kconfig timeout synchronization:', err);
  }

  // 2. Collect all files to commit
  const additions: GitFileAddition[] = [
    { path: headerPath, content: headerContent },
    ...confUpdates,
  ];

  // 3. Perform atomic commit via GraphQL createCommitOnBranch (with Git Trees REST fallback)
  try {
    const commitRes = await commitChangesWithFallback({
      config,
      message: commitMessage,
      additions,
    });

    return {
      commitSha: commitRes.commitSha,
      commitUrl: commitRes.commitUrl,
      filesCommitted: additions.map(f => f.path),
    };
  } catch (gitErr) {
    console.warn('Atomic commit failed, attempting fallback to single-file commit:', gitErr);
    // Fallback: Commit just the header file so user work is never lost
    const singleRes = await commitFileToRepo(config, headerPath, headerContent, formattedMessage);
    return {
      commitSha: singleRes.sha,
      commitUrl: singleRes.commitUrl,
      filesCommitted: [headerPath],
    };
  }
}




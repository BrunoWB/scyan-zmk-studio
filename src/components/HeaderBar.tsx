import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  GitBranch,
  Save,
  RefreshCw,
  Trash2,
  Settings,
  CheckCircle2,
  XCircle,
  Clock,
  Download,
  AlertCircle,
  Check,
  LogOut,
  ShieldCheck,
  ShieldAlert,
  Search,
  FolderGit2,
  Lock,
  Globe,
  Info,
  Unplug,
} from 'lucide-react';
import type {
  GitHubRepoConfig,
  WorkflowRunInfo,
  GitHubConnectionState,
  GitHubRepositoryItem,
  RepoPrerequisites,
} from '../services/githubService';
import {
  saveStoredGitHubConfig,
  fetchLatestWorkflowRuns,
  fetchUserRepositories,
  fetchRepoBranches,
} from '../services/githubService';

export interface HeaderBarProps {
  config: GitHubRepoConfig;
  connection: GitHubConnectionState;
  onConfigChange: (config: GitHubRepoConfig) => void;
  onSync: () => void;
  onSave: () => void;
  onTestConnection: (cfg: GitHubRepoConfig) => Promise<GitHubConnectionState>;
  onDisconnect: () => void;
  isSaving: boolean;
  isSyncing: boolean;
  lastSavedAt: string | null;
  isSettingsOpen: boolean;
  setIsSettingsOpen: (open: boolean) => void;
  showToast?: (type: 'success' | 'error', message: string) => void;
  repoPrereqs?: RepoPrerequisites | null;
  isInstallingStudio?: boolean;
  onInstallStudio?: () => void;
}

const GithubIcon = ({ size = 16, className = '' }: { size?: number; className?: string }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
    />
  </svg>
);

export const WolfLogo = ({ size = 22, className = '' }: { size?: number; className?: string }) => (
  <svg
    viewBox="0 0 26 23"
    width={size}
    height={Math.round((size * 23) / 26)}
    fill="currentColor"
    className={className}
    style={{ imageRendering: 'pixelated' }}
    aria-hidden="true"
  >
    <path d="M3,0h2v1h-2zM21,0h2v1h-2zM2,1h4v1h-4zM20,1h4v1h-4zM1,2h2v1h-2zM4,2h3v1h-3zM9,2h1v1h-1zM13,2h1v1h-1zM19,2h3v1h-3zM23,2h2v1h-2zM1,3h2v1h-2zM5,3h3v1h-3zM9,3h2v1h-2zM12,3h5v1h-5zM18,3h3v1h-3zM23,3h2v1h-2zM1,4h2v1h-2zM6,4h3v1h-3zM10,4h5v1h-5zM16,4h4v1h-4zM23,4h2v1h-2zM1,5h2v1h-2zM7,5h1v1h-1zM9,5h7v1h-7zM17,5h2v1h-2zM23,5h2v1h-2zM2,6h2v1h-2zM5,6h4v1h-4zM10,6h3v1h-3zM14,6h2v1h-2zM17,6h4v1h-4zM22,6h2v1h-2zM3,7h11v1h-11zM16,7h7v1h-7zM1,8h24v1h-24zM2,9h4v1h-4zM8,9h2v1h-2zM11,9h4v1h-4zM16,9h2v1h-2zM20,9h4v1h-4zM3,10h1v1h-1zM5,10h1v1h-1zM10,10h1v1h-1zM12,10h2v1h-2zM15,10h1v1h-1zM20,10h1v1h-1zM22,10h1v1h-1zM1,11h6v1h-6zM8,11h2v1h-2zM11,11h4v1h-4zM16,11h2v1h-2zM19,11h6v1h-6zM0,12h5v1h-5zM6,12h2v1h-2zM11,12h4v1h-4zM18,12h2v1h-2zM21,12h5v1h-5zM2,13h1v1h-1zM4,13h1v1h-1zM7,13h3v1h-3zM11,13h4v1h-4zM16,13h3v1h-3zM21,13h1v1h-1zM23,13h1v1h-1zM1,14h2v1h-2zM4,14h2v1h-2zM9,14h8v1h-8zM20,14h2v1h-2zM23,14h2v1h-2zM0,15h4v1h-4zM5,15h16v1h-16zM22,15h4v1h-4zM1,16h20v1h-20zM22,16h2v1h-2zM3,17h2v1h-2zM6,17h5v1h-5zM15,17h5v1h-5zM21,17h3v1h-3zM3,18h5v1h-5zM9,18h2v1h-2zM15,18h2v1h-2zM18,18h5v1h-5zM3,19h1v1h-1zM5,19h3v1h-3zM9,19h3v1h-3zM14,19h3v1h-3zM18,19h3v1h-3zM22,19h1v1h-1zM7,20h2v1h-2zM10,20h3v1h-3zM14,20h2v1h-2zM17,20h2v1h-2zM9,21h1v1h-1zM16,21h1v1h-1zM10,22h6v1h-6z" />
  </svg>
);

export const HeaderBar: React.FC<HeaderBarProps> = ({
  config,
  connection,
  onConfigChange,
  onSync,
  onSave,
  onTestConnection,
  onDisconnect,
  isSaving,
  isSyncing,
  lastSavedAt,
  isSettingsOpen,
  setIsSettingsOpen,
  showToast,
  repoPrereqs,
  isInstallingStudio,
  onInstallStudio,
}) => {
  const [tempConfig, setTempConfig] = useState<GitHubRepoConfig>(config);
  const [workflowRun, setWorkflowRun] = useState<WorkflowRunInfo | null>(null);

  // Repositories and Branches for interactive selection
  const [repositories, setRepositories] = useState<GitHubRepositoryItem[]>([]);
  const [isLoadingRepos, setIsLoadingRepos] = useState<boolean>(false);
  const [repoSearch, setRepoSearch] = useState<string>('');
  const [branches, setBranches] = useState<string[]>([]);
  const [isLoadingBranches, setIsLoadingBranches] = useState<boolean>(false);
  const [quickKeyInput, setQuickKeyInput] = useState<string>('');
  const [isAuthorizing, setIsAuthorizing] = useState<boolean>(false);
  const [authFeedback, setAuthFeedback] = useState<{ status: 'success' | 'failed'; message: string } | null>(null);
  const quickKeyInputRef = useRef<HTMLInputElement>(null);

  // Sync tempConfig when modal opens or config changes
  useEffect(() => {
    if (isSettingsOpen) {
      setTempConfig(config);
      setRepoSearch('');
      setAuthFeedback(null);
      setQuickKeyInput('');
    }
  }, [isSettingsOpen, config]);

  // When connected and modal is open, load user repositories for the selector
  useEffect(() => {
    if (isSettingsOpen && connection.status === 'connected' && config.token) {
      let isMounted = true;
      setIsLoadingRepos(true);

      fetchUserRepositories(config.token)
        .then(repos => {
          if (isMounted) {
            setRepositories(repos);
            setIsLoadingRepos(false);
          }
        })
        .catch(() => {
          if (isMounted) setIsLoadingRepos(false);
        });

      return () => {
        isMounted = false;
      };
    }
  }, [isSettingsOpen, connection.status, config.token]);

  // Load branches when selected repository changes
  useEffect(() => {
    if (isSettingsOpen && tempConfig.token && tempConfig.owner && tempConfig.repo) {
      let isMounted = true;
      setIsLoadingBranches(true);

      fetchRepoBranches(tempConfig.token, tempConfig.owner, tempConfig.repo)
        .then(branchList => {
          if (isMounted) {
            setBranches(branchList);
            setIsLoadingBranches(false);
            if (!branchList.includes(tempConfig.branch) && branchList.length > 0) {
              setTempConfig(prev => ({ ...prev, branch: branchList[0] }));
            }
          }
        })
        .catch(() => {
          if (isMounted) setIsLoadingBranches(false);
        });

      return () => {
        isMounted = false;
      };
    }
  }, [isSettingsOpen, tempConfig.token, tempConfig.owner, tempConfig.repo]);

  // Poll workflow runs periodically only when connected
  useEffect(() => {
    if (connection.status !== 'connected') {
      setWorkflowRun(null);
      return;
    }

    let interval: ReturnType<typeof setInterval>;

    const checkCi = async () => {
      try {
        const run = await fetchLatestWorkflowRuns(config);
        setWorkflowRun(run);
      } catch {
        // Ignore polling errors
      }
    };

    checkCi();
    interval = setInterval(checkCi, 30000); // every 30s
    return () => clearInterval(interval);
  }, [config, connection.status]);

  // Handle saving chosen repository and branch
  const handleSaveSelection = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAuthorizing(true);
    setAuthFeedback(null);
    try {
      const testResult = await onTestConnection(tempConfig);
      if (testResult.status === 'connected') {
        const alignedBranch = testResult.repo?.defaultBranch && (tempConfig.branch === 'master' || !tempConfig.branch)
          ? testResult.repo.defaultBranch
          : tempConfig.branch;
        const finalizedCfg = { ...tempConfig, branch: alignedBranch };
        setTempConfig(finalizedCfg);
        saveStoredGitHubConfig(finalizedCfg);
        onConfigChange(finalizedCfg);
        setIsSettingsOpen(false);
      } else {
        // Permissions lacking - do not store useless config and do not leave modal!
        setAuthFeedback({
          status: 'failed',
          message: testResult.errorMessage || 'Validation failed. Check that the token has Contents read/write permissions.',
        });
      }
    } catch (err: any) {
      setAuthFeedback({
        status: 'failed',
        message: err.message || 'Validation failed. Please verify your token and connection.',
      });
    } finally {
      setIsAuthorizing(false);
    }
  };

  const handleSelectRepository = (repo: GitHubRepositoryItem) => {
    setTempConfig(prev => ({
      ...prev,
      owner: repo.owner,
      repo: repo.name,
      branch: repo.defaultBranch || 'master',
    }));
  };

  const handleDisconnectClick = () => {
    onDisconnect();
    setTempConfig({ ...tempConfig, token: '' });
    setRepositories([]);
    setAuthFeedback(null);
  };

  // Handle validating and authorizing the fine-grained repository key
  const handleApplyFineGrainedKey = useCallback(async (overrideKey?: string) => {
    const key = (overrideKey !== undefined ? overrideKey : quickKeyInput).trim();
    if (!key) return;

    setIsAuthorizing(true);
    setAuthFeedback(null);

    const newCfg: GitHubRepoConfig = {
      ...tempConfig,
      token: key,
    };

    try {
      const testResult = await onTestConnection(newCfg);
      if (testResult.status === 'connected') {
        const alignedBranch = testResult.repo?.defaultBranch && (newCfg.branch === 'master' || !newCfg.branch)
          ? testResult.repo.defaultBranch
          : newCfg.branch;
        const finalizedCfg = { ...newCfg, branch: alignedBranch };
        setTempConfig(finalizedCfg);
        saveStoredGitHubConfig(finalizedCfg);
        onConfigChange(finalizedCfg);
        setAuthFeedback({
          status: 'success',
          message: `Validated! Connected as @${testResult.user?.login || 'User'} with Contents Read & Write access to ${testResult.repo?.fullName || newCfg.repo}.`,
        });

        // Close modal and clean input only after successful validation
        setTimeout(() => {
          setQuickKeyInput('');
          setAuthFeedback(null);
          setIsSettingsOpen(false);
        }, 1200);
      } else {
        // Permissions are lacking or invalid - do NOT leave modal and do NOT store useless config!
        setAuthFeedback({
          status: 'failed',
          message: testResult.errorMessage || 'Validation failed. Check that the token has Contents read/write permissions.',
        });
      }
    } catch (err: any) {
      setAuthFeedback({
        status: 'failed',
        message: err.message || 'Validation failed. Please verify your token and connection.',
      });
    } finally {
      setIsAuthorizing(false);
    }
  }, [quickKeyInput, tempConfig, onTestConnection, onConfigChange]);

  const isValidTokenLength = (raw: string): boolean => {
    const token = raw.trim();
    if (token.startsWith('github_pat_')) {
      return token.length >= 80 && token.length <= 110;
    }
    return token.length === 40;
  };

  const handleProcessToken = useCallback((rawToken: string) => {
    const token = rawToken.trim();
    if (!token) return;

    if (isValidTokenLength(token)) {
      setQuickKeyInput(token);
      handleApplyFineGrainedKey(token);
    } else {
      setQuickKeyInput('');
      if (showToast) {
        showToast('error', 'Token has an invalid length.');
      }
      setAuthFeedback({
        status: 'failed',
        message: 'Token has an invalid length.',
      });
    }
  }, [handleApplyFineGrainedKey, showToast]);

  const handleTokenPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text').trim();
    if (!pasted) return;
    e.preventDefault();
    handleProcessToken(pasted);
  };

  // Steal keyboard hits when modal is open: auto-focus input and auto-authorize on Ctrl/Cmd + V
  useEffect(() => {
    if (!isSettingsOpen || connection.status === 'connected') return;

    // Auto-focus input when modal opens
    const timer = setTimeout(() => {
      quickKeyInputRef.current?.focus();
    }, 50);

    const handleGlobalModalKeyDown = async (e: KeyboardEvent) => {
      // Escape closes modal
      if (e.key === 'Escape') {
        setIsSettingsOpen(false);
        return;
      }

      // If user hits Ctrl+V or Cmd+V anywhere while modal is open
      if ((e.ctrlKey || e.metaKey) && (e.key === 'v' || e.key === 'V')) {
        // Try reading directly from clipboard
        if (navigator.clipboard && navigator.clipboard.readText) {
          try {
            const clipText = await navigator.clipboard.readText();
            const cleanToken = clipText.trim();
            if (cleanToken) {
              e.preventDefault();
              handleProcessToken(cleanToken);
              return;
            }
          } catch {
            // Fallback: input onPaste event will catch it
          }
        }
        quickKeyInputRef.current?.focus();
        return;
      }

      // Steal keyboard hits: if user types printable characters and focus is not on an input/textarea/select
      if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key.length === 1) {
        const active = document.activeElement;
        if (
          active !== quickKeyInputRef.current &&
          active?.tagName !== 'INPUT' &&
          active?.tagName !== 'TEXTAREA' &&
          active?.tagName !== 'SELECT'
        ) {
          quickKeyInputRef.current?.focus();
        }
      }
    };

    window.addEventListener('keydown', handleGlobalModalKeyDown, true);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', handleGlobalModalKeyDown, true);
    };
  }, [isSettingsOpen, connection.status, handleProcessToken, setIsSettingsOpen]);

  // Filter repositories based on search input
  const filteredRepos = useMemo(() => {
    const query = repoSearch.trim().toLowerCase();
    if (!query) {
      return [...repositories].sort((a, b) => {
        if (a.isZmkConfig && !b.isZmkConfig) return -1;
        if (!a.isZmkConfig && b.isZmkConfig) return 1;
        return a.name.localeCompare(b.name);
      });
    }
    return repositories.filter(
      r =>
        r.name.toLowerCase().includes(query) ||
        r.owner.toLowerCase().includes(query) ||
        (r.description && r.description.toLowerCase().includes(query))
    );
  }, [repositories, repoSearch]);

  const isConnected = connection.status === 'connected';
  const isDisconnected = connection.status === 'disconnected' || connection.status === 'error';

  return (
    <header className={`builder-header ${isDisconnected ? 'disconnected-expanded' : ''}`}>
      {/* Brand & Live Git Connection Info */}
      <div className="header-left">
        <div className="brand">
          <WolfLogo size={24} className="brand-icon text-cyan-400" />
          <div className="brand-text">
            <span className="brand-title">Scyan ZMK Studio</span>
            <span className="brand-badge">2-Atlas Core</span>
          </div>
        </div>

        {/* Live GitHub Connection Status Widget */}
        <div className="git-status-wrapper">
          {connection.status === 'connected' ? (
            repoPrereqs && !repoPrereqs.isInstalled ? (
              <div
                className="git-status-chip connected install-needed"
                title={`Connected to ${config.owner}/${config.repo}. Scyan Studio setup is required to save.`}
              >
                <div className="status-chip-left" onClick={() => setIsSettingsOpen(true)}>
                  <span className="status-ping orange"></span>
                  {connection.user?.avatarUrl ? (
                    <img
                      src={connection.user.avatarUrl}
                      alt={connection.user.login}
                      className="git-user-avatar"
                    />
                  ) : (
                    <GithubIcon size={13} className="text-cyan-400" />
                  )}
                  <span className="git-repo-name">{config.owner}/{config.repo}</span>
                  <span className="git-status-text text-amber-400 text-xs">Setup Required</span>
                </div>
                <button
                  type="button"
                  className="git-install-header-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    onInstallStudio?.();
                  }}
                  disabled={isInstallingStudio}
                  title="Install Scyan Studio module, config & assets into this repository"
                >
                  {isInstallingStudio ? (
                    <>
                      <RefreshCw size={11} className="spin" />
                      <span>Installing...</span>
                    </>
                  ) : (
                    <>
                      <WolfLogo size={12} />
                      <span>Install Studio</span>
                    </>
                  )}
                </button>
              </div>
            ) : (
              <button
                className="git-status-chip connected"
                onClick={() => setIsSettingsOpen(true)}
                title={`Connected as @${connection.user?.login} to ${config.owner}/${config.repo} (${config.branch}). Click to switch repository.`}
              >
                <span className="status-ping cyan"></span>
                {connection.user?.avatarUrl ? (
                  <img
                    src={connection.user.avatarUrl}
                    alt={connection.user.login}
                    className="git-user-avatar"
                  />
                ) : (
                  <GithubIcon size={13} className="text-cyan-400" />
                )}
                <span className="git-repo-name">{config.owner}/{config.repo}</span>
                <span className="git-branch-tag">
                  <GitBranch size={11} />
                  {config.branch}
                </span>
                {connection.repo?.hasPushAccess ? (
                  <span className="git-access-badge write" title="Push permission verified">
                    Push OK
                  </span>
                ) : (
                  <span className="git-access-badge read" title="Read only: commit requires write permissions">
                    Read Only
                  </span>
                )}
              </button>
            )
          ) : connection.status === 'connecting' ? (
            <div className="git-status-chip connecting">
              <RefreshCw size={12} className="spin text-amber-400" />
              <span className="git-status-text">Connecting Git...</span>
            </div>
          ) : connection.status === 'error' ? (
            <button
              className="git-status-chip error"
              onClick={() => setIsSettingsOpen(true)}
              title={connection.errorMessage || 'Connection failed. Click to reconfigure.'}
            >
              <span className="status-ping orange"></span>
              <AlertCircle size={13} className="text-orange-400" />
              <span className="git-status-text">Git Error</span>
              <span className="git-action-hint">Fix</span>
            </button>
          ) : (
            <button
              className="git-status-chip disconnected"
              onClick={() => setIsSettingsOpen(true)}
              title="Studio is in preview mode. Connect your GitHub repository to unlock editing."
            >
              <div className="status-chip-left">
                <span className="status-ping orange"></span>
                <Unplug size={14} className="text-orange-400 shrink-0" />
                <span className="git-status-text">Studio is in preview mode</span>
              </div>
              <span className="git-connect-btn-tag">Connect</span>
            </button>
          )}
        </div>

        {lastSavedAt && (
          <span className="text-xs text-muted font-mono hidden lg:inline">
            Saved {lastSavedAt}
          </span>
        )}
      </div>

      {/* CI Build Status Badge & Actions */}
      <div className="header-right">
        {/* Live CI Badge */}
        {workflowRun && isConnected && (
          <div className="ci-badge-container">
            {workflowRun.status === 'in_progress' || workflowRun.status === 'queued' ? (
              <a
                href={workflowRun.htmlUrl}
                target="_blank"
                rel="noreferrer"
                className="ci-badge building has-tooltip"
                title="GitHub Actions build in progress..."
              >
                <Clock size={13} className="spin-slow text-amber-400" />
                <span>Building Firmware</span>
              </a>
            ) : workflowRun.conclusion === 'success' ? (
              <div className="ci-success-group">
                <a
                  href={workflowRun.htmlUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="ci-badge success has-tooltip"
                  title={`Build passed at ${new Date(workflowRun.createdAt).toLocaleTimeString()}`}
                >
                  <CheckCircle2 size={13} className="text-cyan-400" />
                  <span>CI Passed</span>
                </a>
                <a
                  href={workflowRun.htmlUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-download-uf2"
                  title="Download compiled .uf2 firmware from GitHub Actions"
                >
                  <Download size={12} />
                  <span>UF2</span>
                </a>
              </div>
            ) : (
              <a
                href={workflowRun.htmlUrl}
                target="_blank"
                rel="noreferrer"
                className="ci-badge failed"
                title="Latest build failed. Click to view GitHub logs."
              >
                <XCircle size={13} className="text-red-400" />
                <span>CI Failed</span>
              </a>
            )}
          </div>
        )}

        {/* Discard Changes Button */}
        <button
          className="btn-header-secondary"
          onClick={onSync}
          disabled={isSyncing || !isConnected}
          title={isConnected ? "Discard local modifications and pull latest assets from GitHub repository" : "Connect GitHub to discard changes and sync repository assets"}
        >
          <Trash2 size={14} className={isSyncing ? 'animate-pulse' : ''} />
          <span>Discard Changes</span>
        </button>

        {/* Save & Commit Button */}
        <button
          className="btn-header-primary"
          onClick={onSave}
          disabled={isSaving || !isConnected || !connection.repo?.hasPushAccess}
          title={
            !isConnected
              ? 'Connect GitHub repository to save changes'
              : !connection.repo?.hasPushAccess
              ? 'Read-only access: push permissions required on this repo'
              : 'Commit changes directly to your GitHub repository'
          }
        >
          <Save size={14} className={isSaving ? 'spin' : ''} />
          <span>{isSaving ? 'Committing...' : 'Save to GitHub'}</span>
        </button>

        {/* Settings Button */}
        <button
          className="btn-header-icon"
          onClick={() => setIsSettingsOpen(true)}
          title="Select GitHub Repository & Permissions"
        >
          <Settings size={16} />
        </button>
      </div>

      {/* Settings & Repository Selection Modal */}
      {isSettingsOpen && (
        <div className="modal-overlay" onClick={() => setIsSettingsOpen(false)}>
          <div className="modal-card git-modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="flex items-center gap-2">
                <GithubIcon size={18} className="text-accent" />
                <h3 className="modal-title">GitHub Repository Connection</h3>
              </div>
              <button
                className="modal-close-btn"
                onClick={() => setIsSettingsOpen(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveSelection} className="modal-body">
              {/* Connected State with Repository Selector */}
              {isConnected ? (
                <>
                  <div className="modal-status-card connected">
                    <div className="status-user-info">
                      {connection.user?.avatarUrl && (
                        <img
                          src={connection.user.avatarUrl}
                          alt={connection.user.login}
                          className="modal-avatar"
                        />
                      )}
                      <div>
                        <div className="status-user-name">
                          <strong>{connection.user?.name || connection.user?.login}</strong>
                          <span className="status-user-handle">@{connection.user?.login}</span>
                        </div>
                        <div className="status-repo-summary">
                          Active: <code>{tempConfig.owner}/{tempConfig.repo}</code> on <code>{tempConfig.branch}</code>
                        </div>
                      </div>
                    </div>
                    <div className="status-meta-row">
                      {connection.repo?.hasPushAccess ? (
                        <span className="badge-permission write">
                          <ShieldCheck size={13} /> Push Permission Verified
                        </span>
                      ) : (
                        <span className="badge-permission read">
                          <ShieldAlert size={13} /> Read Only
                        </span>
                      )}
                      <button
                        type="button"
                        className="btn-disconnect"
                        onClick={handleDisconnectClick}
                        title="Disconnect repository access"
                      >
                        <LogOut size={12} /> Disconnect
                      </button>
                    </div>
                  </div>

                  {/* Interactive Repository Picker */}
                  <div className="repo-picker-section">
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                        <FolderGit2 size={13} className="text-accent" />
                        <span>Select ZMK Repository</span>
                      </label>
                      <span className="text-[11px] text-muted">
                        {repositories.length > 0 ? `${repositories.length} repos available` : ''}
                      </span>
                    </div>

                    {/* Repository Search Filter */}
                    <div className="repo-search-bar">
                      <Search size={13} className="text-muted" />
                      <input
                        type="text"
                        value={repoSearch}
                        onChange={e => setRepoSearch(e.target.value)}
                        placeholder="Search your repositories (e.g. zmk-config)..."
                      />
                    </div>

                    {/* Repository List */}
                    <div className="repo-selection-list">
                      {isLoadingRepos ? (
                        <div className="repo-loading-row">
                          <RefreshCw size={14} className="spin text-accent" />
                          <span>Loading accessible repositories...</span>
                        </div>
                      ) : filteredRepos.length === 0 ? (
                        <div className="repo-empty-row">
                          <span>No matching repositories found.</span>
                        </div>
                      ) : (
                        filteredRepos.map(repo => {
                          const isCurrent =
                            tempConfig.owner.toLowerCase() === repo.owner.toLowerCase() &&
                            tempConfig.repo.toLowerCase() === repo.name.toLowerCase();

                          return (
                            <div
                              key={repo.id}
                              className={`repo-item-card ${isCurrent ? 'selected' : ''}`}
                              onClick={() => handleSelectRepository(repo)}
                            >
                              <div className="repo-item-main">
                                <div className="flex items-center gap-1.5">
                                  {repo.private ? (
                                    <Lock size={12} className="text-amber-400" />
                                  ) : (
                                    <Globe size={12} className="text-slate-400" />
                                  )}
                                  <span className="repo-item-name">{repo.fullName}</span>
                                  {repo.isZmkConfig && (
                                    <span className="repo-zmk-badge">ZMK</span>
                                  )}
                                </div>
                                {repo.description && (
                                  <p className="repo-item-desc">{repo.description}</p>
                                )}
                              </div>
                              {isCurrent && (
                                <span className="repo-selected-check">
                                  <Check size={14} />
                                </span>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* Branch Selector */}
                  <div className="form-group mt-2">
                    <label className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <GitBranch size={13} className="text-accent" />
                        <span>Branch</span>
                      </span>
                      {isLoadingBranches && (
                        <span className="text-[11px] text-muted flex items-center gap-1">
                          <RefreshCw size={10} className="spin" /> Loading branches...
                        </span>
                      )}
                    </label>
                    <select
                      value={tempConfig.branch}
                      onChange={e => setTempConfig({ ...tempConfig, branch: e.target.value })}
                      className="repo-branch-select"
                      disabled={isLoadingBranches}
                    >
                      {branches.length > 0 ? (
                        branches.map(b => (
                          <option key={b} value={b}>
                            {b}
                          </option>
                        ))
                      ) : (
                        <option value={tempConfig.branch}>{tempConfig.branch}</option>
                      )}
                    </select>
                  </div>

                  <div className="modal-actions">
                    <button
                      type="button"
                      className="btn-cancel"
                      onClick={() => setIsSettingsOpen(false)}
                    >
                      Cancel
                    </button>
                    <button type="submit" className="btn-save">
                      Apply Repository Selection
                    </button>
                  </div>
                </>
              ) : (
                /* Disconnected State - Warm Beige Informational Banner & Authorize with Live Feedback */
                <div className="modern-auth-container">
                  <div className="modal-status-card info-beige">
                    <div className="flex items-start gap-2.5">
                      <Info size={17} className="text-[var(--color-info)] mt-0.5 shrink-0" />
                      <div>
                        <strong className="text-[var(--color-info)] text-sm font-semibold">GitHub Connection</strong>
                        <p className="text-xs text-[var(--color-info-muted)] mt-1 leading-relaxed">
                          Make sure to select only the zmk-config repository you want to use for your keymap and firmware builds.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Get GitHub Token Action & Direct Paste Authorization */}
                  <div className="modern-login-box">
                    <a
                      href="https://github.com/settings/personal-access-tokens/new?name=ZMK+Keymap+Manager&description=Read+and+write+keymap+files,+download+firmware+build+artifacts&repository_selection=selected&contents=write&actions=read"
                      target="_blank"
                      rel="noreferrer"
                      className="btn-modern-github-auth"
                      title="Opens GitHub with Contents (write), Actions (read), and Only select repositories pre-selected"
                    >
                      <GithubIcon size={18} />
                      <span>Get Github Token</span>
                    </a>

                    <div className="w-full max-w-sm mt-1">
                      <input
                        ref={quickKeyInputRef}
                        type="password"
                        value={quickKeyInput}
                        onChange={e => {
                          setQuickKeyInput(e.target.value);
                          if (authFeedback) setAuthFeedback(null);
                        }}
                        onPaste={handleTokenPaste}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleProcessToken(quickKeyInput);
                          }
                        }}
                        placeholder="Paste here and Authorize"
                        className="auth-token-input text-center"
                        disabled={isAuthorizing}
                        autoFocus
                      />
                    </div>

                    {isAuthorizing && (
                      <div className="flex items-center gap-1.5 text-xs text-accent mt-1">
                        <RefreshCw size={12} className="spin" />
                        <span>Validating and connecting...</span>
                      </div>
                    )}

                    {/* Live Validation Feedback: Cyan OK or Orange Failed */}
                    {authFeedback && !isAuthorizing && (
                      <div className={`validation-feedback ${authFeedback.status} w-full max-w-sm justify-center`}>
                        {authFeedback.status === 'success' ? (
                          <Check size={14} className="text-cyan-400 shrink-0" />
                        ) : (
                          <AlertCircle size={14} className="text-orange-400 shrink-0" />
                        )}
                        <span className="text-xs">{authFeedback.message}</span>
                      </div>
                    )}
                  </div>

                  <div className="modal-actions">
                    <button
                      type="button"
                      className="btn-cancel"
                      onClick={() => setIsSettingsOpen(false)}
                    >
                      Close
                    </button>
                  </div>
                </div>
              )}
            </form>
          </div>
        </div>
      )}
    </header>
  );
};

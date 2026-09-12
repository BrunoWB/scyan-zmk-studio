import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  GitBranch,
  Save,
  RefreshCw,
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
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { Chip, Button, Kbd } from '@heroui/react';
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
import { BrandIdentityLogo } from './brand/BrandIdentityLogo';
import { LogoContextMenu } from './LogoContextMenu';
import { ChangelogModal } from './ChangelogModal';
import { trackEvent } from '../services/analytics';

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
  isUninstallingStudio?: boolean;
  onUninstallStudio?: () => void;
  onSearchClick?: () => void;
  onRestoreInitialValues?: () => void;
  onRestoreDefaults?: () => void;
  initialWorkflowRun?: WorkflowRunInfo | null;
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

export const WolfLogo = ({ size = 40, className = '' }: { size?: number; className?: string }) => (
  <svg
    viewBox="0 0 31 29"
    width={size}
    height={Math.round((size * 29) / 31)}
    fill="currentColor"
    className={className}
    style={{ imageRendering: 'pixelated' }}
    aria-hidden="true"
  >
    <path d="M6,0h2v1h-2zM25,0h2v1h-2zM5,1h4v1h-4zM24,1h4v1h-4zM4,2h5v1h-5zM24,2h5v1h-5zM4,3h2v1h-2zM7,3h3v1h-3zM12,3h1v1h-1zM17,3h1v1h-1zM23,3h3v1h-3zM27,3h2v1h-2zM3,4h2v1h-2zM8,4h3v1h-3zM13,4h1v1h-1zM17,4h2v1h-2zM22,4h3v1h-3zM28,4h2v1h-2zM3,5h2v1h-2zM8,5h3v1h-3zM12,5h9v1h-9zM22,5h3v1h-3zM28,5h2v1h-2zM3,6h2v1h-2zM9,6h9v1h-9zM20,6h4v1h-4zM28,6h2v1h-2zM3,7h2v1h-2zM10,7h1v1h-1zM12,7h8v1h-8zM21,7h2v1h-2zM28,7h2v1h-2zM3,8h2v1h-2zM10,8h1v1h-1zM13,8h7v1h-7zM21,8h2v1h-2zM28,8h2v1h-2zM4,9h2v1h-2zM7,9h4v1h-4zM12,9h4v1h-4zM17,9h2v1h-2zM21,9h5v1h-5zM27,9h2v1h-2zM5,10h12v1h-12zM19,10h9v1h-9zM2,11h5v1h-5zM8,11h4v1h-4zM13,11h1v1h-1zM15,11h5v1h-5zM21,11h4v1h-4zM26,11h5v1h-5zM3,12h3v1h-3zM7,12h6v1h-6zM15,12h3v1h-3zM20,12h6v1h-6zM27,12h3v1h-3zM5,13h1v1h-1zM7,13h1v1h-1zM13,13h7v1h-7zM25,13h1v1h-1zM27,13h1v1h-1zM3,14h6v1h-6zM12,14h1v1h-1zM14,14h5v1h-5zM20,14h1v1h-1zM24,14h6v1h-6zM2,15h6v1h-6zM9,15h1v1h-1zM12,15h1v1h-1zM14,15h5v1h-5zM20,15h1v1h-1zM23,15h1v1h-1zM25,15h6v1h-6zM1,16h3v1h-3zM5,16h2v1h-2zM9,16h2v1h-2zM14,16h5v1h-5zM22,16h2v1h-2zM26,16h2v1h-2zM29,16h2v1h-2zM3,17h2v1h-2zM6,17h2v1h-2zM10,17h3v1h-3zM14,17h5v1h-5zM20,17h3v1h-3zM25,17h2v1h-2zM28,17h2v1h-2zM2,18h2v1h-2zM6,18h3v1h-3zM12,18h9v1h-9zM24,18h3v1h-3zM29,18h2v1h-2zM2,19h5v1h-5zM8,19h17v1h-17zM26,19h5v1h-5zM1,20h5v1h-5zM7,20h2v1h-2zM10,20h16v1h-16zM27,20h4v1h-4zM3,21h3v1h-3zM7,21h3v1h-3zM11,21h9v1h-9zM21,21h5v1h-5zM27,21h3v1h-3zM5,22h2v1h-2zM8,22h6v1h-6zM19,22h2v1h-2zM22,22h3v1h-3zM26,22h2v1h-2zM5,23h6v1h-6zM12,23h2v1h-2zM19,23h2v1h-2zM22,23h6v1h-6zM5,24h1v1h-1zM9,24h2v1h-2zM12,24h3v1h-3zM18,24h3v1h-3zM22,24h2v1h-2zM27,24h1v1h-1zM10,25h2v1h-2zM13,25h3v1h-3zM17,25h3v1h-3zM21,25h2v1h-2zM12,26h1v1h-1zM20,26h1v1h-1zM13,27h7v1h-7zM13,28h7v1h-7z" />
  </svg>
);

export const KofiIcon = ({ size = 16, className = '' }: { size?: number; className?: string }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    aria-hidden="true"
  >
    <path d="M23.881 8.948c-.773-4.085-4.859-4.593-4.859-4.593H.723c-.604 0-.679.798-.679.798s-.082 7.324-.022 11.822c.164 2.424 2.586 2.672 2.586 2.672s8.267-.023 11.966-.049c2.438-.426 2.683-2.566 2.658-3.734 4.352.24 7.422-2.831 6.649-6.916zm-11.062 3.511c-1.246 1.453-4.011 3.976-4.011 3.976s-.121.119-.31.023c-.076-.057-.238-.209-.344-.319-1.206-1.261-2.91-3.69-2.91-3.69s-.733-1.09-.272-2.146c.465-1.055 1.579-1.328 2.378-1.024.798.304 1.344 1.092 1.344 1.092s.546-.788 1.344-1.092c.799-.304 1.913-.031 2.378 1.024.461 1.056-.272 2.146-.272 2.146l.405.01zm5.286-.967c-.206 1.37-1.144 1.705-1.993 1.745V7.472c.849.04 1.787.375 1.993 1.745z" />
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
  isUninstallingStudio,
  onUninstallStudio,
  onSearchClick,
  onRestoreInitialValues,
  onRestoreDefaults,
  initialWorkflowRun,
}) => {
  const [tempConfig, setTempConfig] = useState<GitHubRepoConfig>(config);
  const [workflowRun, setWorkflowRun] = useState<WorkflowRunInfo | null>(initialWorkflowRun ?? null);
  const [isHeaderHovered, setIsHeaderHovered] = useState(false);
  const [confirmUninstall, setConfirmUninstall] = useState(false);
  const [logoMenuPos, setLogoMenuPos] = useState<{ x: number; y: number } | null>(null);
  const [isChangelogOpen, setIsChangelogOpen] = useState(false);

  useEffect(() => {
    if (!isSettingsOpen) {
      setConfirmUninstall(false);
    }
  }, [isSettingsOpen]);

  // Repositories and Branches for interactive selection
  const [repositories, setRepositories] = useState<GitHubRepositoryItem[]>([]);
  const [isLoadingRepos, setIsLoadingRepos] = useState<boolean>(false);
  const [repoSearch, setRepoSearch] = useState<string>('');
  const [branches, setBranches] = useState<string[]>([]);
  const [isLoadingBranches, setIsLoadingBranches] = useState<boolean>(false);
  const [quickKeyInput, setQuickKeyInput] = useState<string>('');
  const [manualRepoInput, setManualRepoInput] = useState<string>('');
  const [isAuthorizing, setIsAuthorizing] = useState<boolean>(false);
  const [authFeedback, setAuthFeedback] = useState<{ status: 'success' | 'failed'; message: string } | null>(null);
  const quickKeyInputRef = useRef<HTMLInputElement>(null);

  const renderWorkspaceRestoration = () => (
    <div className="bg-[#19202f] border border-[#2d3748] rounded-xl p-4 flex flex-col gap-3">
      <div>
        <div className="text-xs font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
          <RotateCcw size={13} className="text-[#00f0ff]" />
          <span>Workspace Restoration</span>
        </div>
        <p className="text-xs text-[#94a3b8] mt-1">
          Revert current edits by reloading from GitHub, or reset everything to factory defaults.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <Button
          size="sm"
          type="button"
          onClick={() => {
            if (isConnected) {
              onSync();
            } else {
              onRestoreInitialValues?.();
            }
            setIsSettingsOpen(false);
          }}
          isDisabled={isSyncing}
          className="bg-[#131722] hover:bg-[#1e2538] border border-[#2d3748] hover:border-[#00f0ff]/50 text-white hover:text-[#00f0ff] text-xs font-medium px-3 h-8 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer"
          aria-label="Reload display assets directly from your GitHub repository"
        >
          <RotateCcw size={12} className={isSyncing ? "animate-spin text-[#00f0ff]" : "text-[#00f0ff]"} />
          <span>Reload from GitHub</span>
        </Button>
        <Button
          size="sm"
          type="button"
          onClick={() => {
            onRestoreDefaults?.();
            setIsSettingsOpen(false);
          }}
          className="bg-[#131722] hover:bg-[#f2741d]/15 border border-[#2d3748] hover:border-[#f2741d]/40 text-[#94a3b8] hover:text-[#f2741d] text-xs font-medium px-3 h-8 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer"
          aria-label="Reset entire workspace back to clean base factory defaults"
        >
          <RotateCcw size={12} />
          <span>Restore Defaults</span>
        </Button>
      </div>
    </div>
  );

  // Sync tempConfig when modal opens or config changes
  useEffect(() => {
    if (isSettingsOpen) {
      setTempConfig(config);
      setRepoSearch('');
      setAuthFeedback(null);
      setQuickKeyInput('');
      setManualRepoInput('');
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
    if (!tempConfig.owner?.trim() || !tempConfig.repo?.trim()) {
      setAuthFeedback({
        status: 'failed',
        message: 'Please select or enter a valid repository before applying.',
      });
      return;
    }
    setIsAuthorizing(true);
    setAuthFeedback(null);
    try {
      const testResult = await onTestConnection(tempConfig);
      if (testResult.status === 'connected') {
        const resolvedOwner = testResult.resolvedOwner || testResult.repo?.fullName?.split('/')[0] || testResult.user?.login || tempConfig.owner;
        const resolvedRepo = testResult.resolvedRepo || testResult.repo?.name || tempConfig.repo;
        const alignedBranch = testResult.repo?.defaultBranch && (tempConfig.branch === 'master' || !tempConfig.branch)
          ? testResult.repo.defaultBranch
          : tempConfig.branch;
        const finalizedCfg = {
          ...tempConfig,
          owner: resolvedOwner,
          repo: resolvedRepo,
          branch: alignedBranch,
        };
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

    // If user provided a manual target repo in disconnected state (or already had one in tempConfig)
    let parsedOwner = tempConfig.owner?.trim() || '';
    let parsedRepo = tempConfig.repo?.trim() || '';
    if (manualRepoInput.trim()) {
      const parts = manualRepoInput.trim().split('/');
      if (parts.length >= 2) {
        parsedOwner = parts[0].trim();
        parsedRepo = parts.slice(1).join('/').trim();
      } else {
        parsedRepo = parts[0].trim();
      }
    }

    const newCfg: GitHubRepoConfig = {
      ...tempConfig,
      token: key,
      owner: parsedOwner,
      repo: parsedRepo,
    };

    try {
      const testResult = await onTestConnection(newCfg);
      if (testResult.status === 'connected') {
        const resolvedOwner = testResult.resolvedOwner || testResult.repo?.fullName?.split('/')[0] || testResult.user?.login || newCfg.owner;
        const resolvedRepo = testResult.resolvedRepo || testResult.repo?.name || newCfg.repo;

        if (!resolvedRepo || !resolvedOwner) {
          setAuthFeedback({
            status: 'failed',
            message: 'Connected with token, but no repository was selected. Please choose your ZMK repository below.',
          });
          return;
        }

        const alignedBranch = testResult.repo?.defaultBranch && (newCfg.branch === 'master' || !newCfg.branch)
          ? testResult.repo.defaultBranch
          : newCfg.branch;
        const finalizedCfg = {
          ...newCfg,
          owner: resolvedOwner,
          repo: resolvedRepo,
          branch: alignedBranch,
        };
        setTempConfig(finalizedCfg);
        saveStoredGitHubConfig(finalizedCfg);
        onConfigChange(finalizedCfg);
        setAuthFeedback({
          status: 'success',
          message: `Validated! Connected as @${testResult.user?.login || 'User'} with Contents Read & Write access to ${testResult.repo?.fullName || `${resolvedOwner}/${resolvedRepo}`}.`,
        });

        // Close modal and clean input only after successful validation
        setTimeout(() => {
          setQuickKeyInput('');
          setManualRepoInput('');
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
  }, [quickKeyInput, manualRepoInput, tempConfig, onTestConnection, onConfigChange]);

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
  const requiresInstalling = isConnected && Boolean(repoPrereqs && !repoPrereqs.isInstalled);
  const isExpanded = isDisconnected || requiresInstalling;

  return (
    <>
      <header
      onMouseEnter={() => setIsHeaderHovered(true)}
      onMouseLeave={() => setIsHeaderHovered(false)}
      className={`builder-header sticky top-0 z-40 w-full transition-all duration-[350ms] ease-[cubic-bezier(0.16,1,0.3,1)] flex items-center justify-between gap-4 shrink-0 px-6 ${
        isExpanded
          ? 'disconnected-expanded h-[130px] bg-gradient-to-b from-[#161920] to-[#121419] border-b border-[#f2741d]/35 shadow-[0_4px_20px_rgba(242,116,29,0.08)]'
          : 'h-[54px] bg-[#0b0d13]/90 backdrop-blur-md border-b border-[#1e2538]'
      }`}
    >
      {/* Brand & Live Git Connection Info */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3">
          {/* Logo rendered at Display High-Res (48px) then CSS-scaled to Card Hero (38px) in
              compact mode. Scale transitions in sync with the header's own cubic-bezier so
              the size change flows naturally as the header expands/collapses. */}
          <div
            style={{
              transform: isExpanded ? 'scale(1)' : 'scale(0.7917)',
              transformOrigin: 'left center',
              transition: 'transform 350ms cubic-bezier(0.16,1,0.3,1)',
            }}
          >
            <BrandIdentityLogo
              size={48}
              isHovered={isHeaderHovered}
              onClick={() => setIsSettingsOpen(false)}
              onContextMenu={(e) => {
                e.preventDefault();
                setLogoMenuPos({ x: e.clientX, y: e.clientY });
              }}
            />
          </div>
        </div>
      </div>

      {/* Center: Live GitHub Connection Status Widget */}
      {isExpanded ? (
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 flex items-center pointer-events-auto">
          {connection.status === 'error' ? (
            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              className="w-[440px] max-w-[calc(100vw-32px)] sm:min-w-[400px] h-11 px-4 flex items-center justify-between text-xs font-semibold rounded-xl border border-[#f2741d]/55 bg-[#f2741d]/10 hover:border-[#f2741d]/85 hover:bg-[#f2741d]/18 shadow-[0_0_20px_rgba(242,116,29,0.15),_inset_0_0_12px_rgba(242,116,29,0.05)] hover:shadow-[0_0_24px_rgba(242,116,29,0.3)] transition-all duration-300 group cursor-pointer"
              title={connection.errorMessage || 'Connection failed. Click to reconfigure.'}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="size-2.5 rounded-full bg-[#f2741d] shadow-[0_0_8px_#f2741d] animate-pulse shrink-0"></span>
                <AlertCircle size={15} className="text-[#f2741d] shrink-0" />
                <span className="text-[#fed7aa] font-semibold text-sm truncate">Git Connection Error</span>
              </div>
              <span className="bg-[#f2741d] group-hover:bg-[#ea580c] text-white text-[11px] font-bold px-3.5 py-1 rounded-md tracking-wider transition-colors shadow-sm shrink-0 ml-2">
                Fix
              </span>
            </button>
          ) : isDisconnected ? (
            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              className="w-[440px] max-w-[calc(100vw-32px)] sm:min-w-[400px] h-11 px-4 flex items-center justify-between text-[13.5px] font-semibold rounded-xl border border-[#f2741d]/55 bg-[#f2741d]/10 hover:border-[#f2741d]/85 hover:bg-[#f2741d]/18 shadow-[0_0_20px_rgba(242,116,29,0.15),_inset_0_0_12px_rgba(242,116,29,0.05)] hover:shadow-[0_0_24px_rgba(242,116,29,0.3)] hover:scale-[1.015] transition-all duration-300 group cursor-pointer"
              title="Studio is in preview mode. Connect your GitHub repository to unlock editing."
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="size-2.5 rounded-full bg-[#f2741d] shadow-[0_0_8px_#f2741d] animate-pulse shrink-0"></span>
                <Unplug size={15} className="text-[#f2741d] shrink-0" />
                <span className="text-[#fed7aa] font-semibold text-sm truncate">Studio is in preview mode</span>
              </div>
              <span className="bg-[#f2741d] group-hover:bg-[#ea580c] text-white text-[11px] font-bold px-3.5 py-1 rounded-md tracking-wider transition-colors shadow-sm shrink-0 ml-2">
                Connect
              </span>
            </button>
          ) : (
            <div
              className="w-[440px] max-w-[calc(100vw-32px)] sm:min-w-[400px] h-11 px-4 flex items-center justify-between text-[13.5px] font-semibold rounded-xl border border-[#f2741d]/55 bg-[#f2741d]/10 hover:border-[#f2741d]/85 hover:bg-[#f2741d]/18 shadow-[0_0_20px_rgba(242,116,29,0.15),_inset_0_0_12px_rgba(242,116,29,0.05)] hover:shadow-[0_0_24px_rgba(242,116,29,0.3)] transition-all duration-300 group"
            >
              <div
                onClick={() => setIsSettingsOpen(true)}
                className="flex items-center gap-2.5 min-w-0 cursor-pointer flex-1 py-1"
                title={`Connected to ${config.owner}/${config.repo}. Click to open settings.`}
              >
                <span className="size-2.5 rounded-full bg-[#f2741d] shadow-[0_0_8px_#f2741d] animate-pulse shrink-0"></span>
                <FolderGit2 size={15} className="text-[#f2741d] shrink-0" />
                <span className="text-white font-medium text-sm truncate">{config.owner}/{config.repo}</span>
                <span className="text-[#f2741d] font-mono text-[11px] shrink-0 hidden sm:inline">Setup Required</span>
              </div>
              <button
                type="button"
                className="bg-[#f2741d] hover:bg-[#ea580c] disabled:opacity-60 text-white text-[11px] font-bold px-3.5 py-1 rounded-md tracking-wider transition-colors shadow-sm shrink-0 ml-2 flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
                onClick={(e) => {
                  e.stopPropagation();
                  onInstallStudio?.();
                }}
                disabled={isInstallingStudio}
              >
                {isInstallingStudio ? (
                  <>
                    <RefreshCw size={11} className="animate-spin" />
                    <span>Installing...</span>
                  </>
                ) : (
                  <span>Install</span>
                )}
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="hidden md:flex items-center">
          {connection.status === 'connecting' ? (
            <div className="flex items-center gap-2 bg-[#131722] border border-amber-500/30 rounded-full px-3.5 py-1 text-xs">
              <RefreshCw size={12} className="animate-spin text-amber-400" />
              <span className="text-amber-400 font-mono text-[11px]">Connecting Git...</span>
            </div>
          ) : repoPrereqs && !repoPrereqs.isInstalled ? (
            <div className="flex items-center gap-2 bg-[#131722] border border-[#f2741d]/30 rounded-full px-3.5 py-1 text-xs">
              <span className="size-2 rounded-full bg-[#f2741d] animate-pulse"></span>
              <span className="text-white font-medium">{config.owner}/{config.repo}</span>
              <span className="text-[#f2741d] font-mono text-[11px]">Setup Required</span>
              <button
                type="button"
                className="bg-[#f2741d]/20 hover:bg-[#f2741d] text-[#f2741d] hover:text-white border border-[#f2741d]/40 text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full transition-all cursor-pointer flex items-center gap-1"
                onClick={(e) => {
                  e.stopPropagation();
                  onInstallStudio?.();
                }}
                disabled={isInstallingStudio}
              >
                {isInstallingStudio ? (
                  <>
                    <RefreshCw size={10} className="animate-spin" />
                    <span>Installing...</span>
                  </>
                ) : (
                  <span>Install</span>
                )}
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="flex items-center gap-2 bg-[#131722] hover:bg-[#19202f] border border-[#00f0ff]/30 hover:border-[#00f0ff] rounded-full px-3.5 py-1 text-xs transition-all cursor-pointer shadow-inner"
              title={`Connected to ${config.owner}/${config.repo} (${config.branch}). Click to change.`}
            >
              <span className="size-2 rounded-full bg-[#00f0ff] shadow-[0_0_8px_#00f0ff]"></span>
              {connection.user?.avatarUrl ? (
                <img
                  src={connection.user.avatarUrl}
                  alt={connection.user.login}
                  className="size-4 rounded-full border border-[#00f0ff]/40"
                />
              ) : (
                <GithubIcon size={12} className="text-[#00f0ff]" />
              )}
              <span className="text-white font-medium">
                {config.owner && config.repo ? `${config.owner}/${config.repo}` : 'No Repository Selected'}
              </span>
              <span className="text-[#94a3b8]">•</span>
              <span className="text-[#00f0ff] font-mono text-[11px] flex items-center gap-1">
                <GitBranch size={11} />
                {config.branch}
              </span>
              {config.owner && config.repo && connection.repo?.name?.toLowerCase() === config.repo.toLowerCase() && connection.repo?.hasPushAccess ? (
                <span className="text-[10px] font-mono bg-[#00f0ff]/20 text-[#00f0ff] border border-[#00f0ff]/40 px-1.5 py-0.2 rounded font-semibold ml-1">
                  PUSH OK
                </span>
              ) : !config.owner || !config.repo ? (
                <span className="text-[10px] font-mono bg-amber-500/20 text-amber-300 border border-amber-500/40 px-1.5 py-0.2 rounded font-semibold ml-1">
                  NO REPO
                </span>
              ) : (
                <span className="text-[10px] font-mono bg-amber-500/20 text-amber-300 border border-amber-500/40 px-1.5 py-0.2 rounded font-semibold ml-1">
                  READ ONLY
                </span>
              )}
            </button>
          )}
        </div>
      )}

      {/* CI Build Status Badge & Actions */}
      <div className="flex items-center gap-2.5">
        {/* Search Command Palette Button */}
        {onSearchClick && (
          <button
            onClick={onSearchClick}
            className="flex items-center gap-2 bg-[#131722] hover:bg-[#19202f] border border-[#1e2538] hover:border-[#00f0ff]/40 rounded-lg px-3 py-1.5 text-xs text-[#94a3b8] transition-all cursor-pointer shadow-inner"
          >
            <Search className="size-3.5 text-[#00f0ff]" />
            <span className="hidden xl:inline">Search components...</span>
            <span className="hidden sm:inline xl:hidden">Search</span>
            <Kbd className="bg-[#0b0d13] text-[#f1f5f9] text-[10px] px-1.5 py-0.5 border border-[#232c3f] rounded ml-1 font-mono hidden sm:inline-block">
              Ctrl + K
            </Kbd>
          </button>
        )}

        {/* Live CI Badge */}
        {workflowRun && isConnected && (
          <div className="hidden sm:flex items-center gap-1.5">
            {workflowRun.status === 'in_progress' || workflowRun.status === 'queued' ? (
              <a
                href={workflowRun.htmlUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 bg-[#f2741d]/15 border border-[#f2741d]/40 text-[#f2741d] text-xs font-mono px-2.5 py-1 rounded-lg hover:bg-[#f2741d]/25 transition-colors"
                title="GitHub Actions build in progress..."
              >
                <Clock size={12} className="animate-spin text-[#f2741d]" />
                <span>Building</span>
              </a>
            ) : workflowRun.conclusion === 'success' ? (
              <div className="flex items-center gap-1">
                <a
                  href={workflowRun.htmlUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 bg-[#00f0ff]/15 border border-[#00f0ff]/40 text-[#00f0ff] text-xs font-mono px-2.5 py-1 rounded-lg hover:bg-[#00f0ff]/25 transition-colors"
                  title={`Build passed at ${new Date(workflowRun.createdAt).toLocaleTimeString()}${lastSavedAt ? ` • Saved at ${lastSavedAt}` : ''}`}
                >
                  <CheckCircle2 size={12} className="text-[#00f0ff] shrink-0" />
                  <span>CI Passed</span>
                  {lastSavedAt && (
                    <>
                      <span className="text-[#00f0ff]/40">•</span>
                      <span className="text-[#00f0ff]/80 text-[11px]">{`Saved ${lastSavedAt}`}</span>
                    </>
                  )}
                </a>
                <a
                  href={workflowRun.htmlUrl}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => trackEvent('firmware_uf2_clicked', { run_id: workflowRun.id })}
                  className="bg-[#19202f] hover:bg-[#232c3f] border border-[#2d3748] text-white text-xs font-mono px-2 py-1 rounded-lg flex items-center gap-1 transition-colors"
                  title="Download compiled .uf2 firmware"
                >
                  <Download size={11} />
                  <span>UF2</span>
                </a>
              </div>
            ) : (
              <a
                href={workflowRun.htmlUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 bg-[#f2741d]/15 border border-[#f2741d]/40 text-[#f2741d] text-xs font-mono px-2.5 py-1 rounded-lg hover:bg-[#f2741d]/25 transition-colors"
                title="Latest build failed. Click to view logs."
              >
                <XCircle size={12} />
                <span>CI Failed</span>
              </a>
            )}
          </div>
        )}

        {/* Save & Commit Button with Hidden Slide-Down Coffee Tip */}
        <div className="relative isolate group/commit inline-flex items-center">
          {/* Coffee Tip: slides down from behind Commit & Build on hover */}
          <a
            href="https://ko-fi.com/brunowb"
            target="_blank"
            rel="noopener noreferrer"
            className="absolute left-1.5 right-1.5 top-full -mt-1 -z-10 flex items-center justify-center gap-1.5 bg-[#121622] hover:bg-[#19202f] border border-t-0 border-[#2d3748] hover:border-[#00f0ff]/50 text-[#94a3b8] hover:text-[#00f0ff] text-[11px] font-medium pt-2 pb-1 px-2.5 rounded-b-lg shadow-xl shadow-black/50 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] -translate-y-full opacity-0 pointer-events-none group-hover/commit:translate-y-0 group-hover/commit:opacity-100 group-hover/commit:pointer-events-auto group-focus-within/commit:translate-y-0 group-focus-within/commit:opacity-100 group-focus-within/commit:pointer-events-auto cursor-pointer"
            style={{ zIndex: -1 }}
            title="Support me on Ko-fi"
            aria-label="Support me on Ko-fi"
          >
            <KofiIcon size={12} className="text-[#00f0ff] shrink-0" />
            <span className="text-slate-300 hover:text-white">Buy me a coffee</span>
          </a>

          <div className="relative z-10 bg-[#0b0d13] rounded-lg flex items-center">
            <Button
              size="sm"
              onClick={onSave}
              isDisabled={isSaving || !isConnected || !connection.repo?.hasPushAccess}
              className="bg-[#0e1626] hover:bg-[#00f0ff] text-[#00f0ff] hover:text-[#0b0d13] border border-[#00f0ff]/40 hover:border-[#00f0ff] font-semibold text-xs rounded-lg px-3.5 h-8 transition-all duration-200 hover:shadow-[0_0_16px_rgba(0,240,255,0.4)] flex items-center gap-1.5 cursor-pointer"
              aria-label={
                !isConnected
                  ? 'Connect GitHub repository to save changes'
                  : !connection.repo?.hasPushAccess
                  ? 'Read-only access: push permissions required on this repo'
                  : 'Commit changes directly to your GitHub repository'
              }
            >
              <Save size={13} className={isSaving ? 'animate-spin' : ''} />
              <span>{isSaving ? 'Committing...' : 'Commit & Build'}</span>
            </Button>
          </div>
        </div>

        {/* Settings Button */}
        <Button
          size="sm"
          onClick={() => setIsSettingsOpen(true)}
          className="bg-[#19202f] hover:bg-[#232c3f] border border-[#2d3748] text-white text-xs font-medium px-2.5 h-8 rounded-lg transition-all flex items-center justify-center cursor-pointer"
          aria-label="Select GitHub Repository & Permissions"
        >
          <Settings size={14} className="text-[#00f0ff]" />
        </Button>
      </div>
    </header>

    {/* Settings & Repository Selection Modal Portaled to Document Body */}
    {isSettingsOpen && (
      (() => {
        const modalNode = (
          <div
            className="modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
            onClick={() => setIsSettingsOpen(false)}
          >
            <div
              className="bg-[#131722] border border-[#2d3748] rounded-2xl w-full max-w-xl overflow-hidden shadow-[0_16px_40px_rgba(0,0,0,0.7)] flex flex-col max-h-[90vh]"
              onClick={e => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between p-4 border-b border-[#1e2538] shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="size-7 rounded-lg bg-[#00f0ff]/10 border border-[#00f0ff]/30 flex items-center justify-center">
                    <GithubIcon size={15} className="text-[#00f0ff]" />
                  </div>
                  <h3 className="text-sm font-bold text-white tracking-tight">GitHub Repository Connection</h3>
                </div>
                <button
                  type="button"
                  className="text-[#94a3b8] hover:text-white transition-colors cursor-pointer p-1 rounded-lg hover:bg-[#19202f]"
                  onClick={() => setIsSettingsOpen(false)}
                >
                  ✕
                </button>
              </div>

              {/* Modal Body */}
              <form onSubmit={handleSaveSelection} className="flex flex-col flex-1 min-h-0 overflow-hidden">
                {/* Connected State with Repository Selector */}
                {isConnected ? (
                  <>
                    <div className="p-5 space-y-4 overflow-y-auto flex-1 min-h-0">
                      <div className="bg-[#19202f] border border-[#2d3748] rounded-xl p-4 flex flex-col gap-3">
                        <div className="flex items-center gap-3">
                          {connection.user?.avatarUrl && (
                            <img
                              src={connection.user.avatarUrl}
                              alt={connection.user.login}
                              className="size-10 rounded-full border border-[#00f0ff]/30 shadow-[0_0_8px_rgba(0,240,255,0.2)]"
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <strong className="text-sm font-bold text-white truncate">
                                {connection.user?.name || connection.user?.login}
                              </strong>
                              <span className="text-xs text-[#94a3b8] font-mono">@{connection.user?.login}</span>
                            </div>
                            <div className="text-xs text-[#94a3b8] font-mono mt-0.5 truncate">
                              {tempConfig.owner && tempConfig.repo ? (
                                <>
                                  Active: <code className="text-[#00f0ff]">{tempConfig.owner}/{tempConfig.repo}</code> on <code className="text-[#a953f6]">{tempConfig.branch}</code>
                                </>
                              ) : (
                                <span className="text-amber-400 font-medium">No repository selected — choose below</span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-[#1e2538] gap-2">
                          {tempConfig.owner && tempConfig.repo && connection.repo && connection.repo.name.toLowerCase() === tempConfig.repo.toLowerCase() && connection.repo.hasPushAccess ? (
                            <Chip className="bg-[#00f0ff]/15 text-[#00f0ff] border border-[#00f0ff]/30 text-xs font-mono font-semibold px-2.5 h-6">
                              <span className="flex items-center gap-1.5">
                                <ShieldCheck size={12} /> Push Permission Verified
                              </span>
                            </Chip>
                          ) : !tempConfig.owner || !tempConfig.repo ? (
                            <Chip className="bg-amber-500/15 text-amber-300 border border-amber-500/30 text-xs font-mono font-semibold px-2.5 h-6">
                              <span className="flex items-center gap-1.5">
                                <ShieldAlert size={12} /> No Repository Selected
                              </span>
                            </Chip>
                          ) : connection.repo && connection.repo.name.toLowerCase() !== tempConfig.repo.toLowerCase() ? (
                            <Chip className="bg-amber-500/15 text-amber-300 border border-amber-500/30 text-xs font-mono font-semibold px-2.5 h-6">
                              <span className="flex items-center gap-1.5">
                                <ShieldAlert size={12} /> Unverified Selection
                              </span>
                            </Chip>
                          ) : (
                            <Chip className="bg-amber-500/15 text-amber-300 border border-amber-500/30 text-xs font-mono font-semibold px-2.5 h-6">
                              <span className="flex items-center gap-1.5">
                                <ShieldAlert size={12} /> Read Only
                              </span>
                            </Chip>
                          )}
                          <Button
                            size="sm"
                            type="button"
                            onClick={handleDisconnectClick}
                            className="bg-[#0b0d13] hover:bg-[#f2741d]/15 border border-[#f2741d]/30 hover:border-[#f2741d]/60 text-[#f2741d] hover:text-[#f59442] text-xs font-medium px-3 h-7 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                            aria-label="Disconnect repository access"
                          >
                            <LogOut size={12} /> Disconnect
                          </Button>
                        </div>
                      </div>

                      {/* Interactive Repository Picker */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                            <FolderGit2 size={13} className="text-[#00f0ff]" />
                            <span>Select ZMK Repository</span>
                          </label>
                          <span className="text-[11px] text-[#94a3b8]">
                            {repositories.length > 0 ? `${repositories.length} repos available` : ''}
                          </span>
                        </div>

                        {/* Repository Search Filter */}
                        <div className="flex items-center gap-2 bg-[#0e1118] border border-[#1e2538] focus-within:border-[#00f0ff]/50 rounded-xl px-3 py-2 text-xs transition-colors">
                          <Search size={13} className="text-[#94a3b8] shrink-0" />
                          <input
                            type="text"
                            value={repoSearch}
                            onChange={e => setRepoSearch(e.target.value)}
                            placeholder="Search your repositories (e.g. zmk-config)..."
                            className="w-full bg-transparent text-white placeholder-[#555e6e] outline-none text-xs"
                          />
                        </div>

                        {/* Repository List */}
                        <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1">
                          {isLoadingRepos ? (
                            <div className="flex items-center justify-center gap-2 py-6 text-xs text-[#94a3b8]">
                              <RefreshCw size={14} className="animate-spin text-[#00f0ff]" />
                              <span>Loading accessible repositories...</span>
                            </div>
                          ) : filteredRepos.length === 0 ? (
                            <div className="text-center py-6 text-xs text-[#94a3b8] space-y-2">
                              <div>No matching repositories found.</div>
                              {repoSearch.trim() && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const raw = repoSearch.trim();
                                    const parts = raw.split('/');
                                    if (parts.length >= 2) {
                                      setTempConfig(prev => ({
                                        ...prev,
                                        owner: parts[0].trim(),
                                        repo: parts.slice(1).join('/').trim(),
                                      }));
                                    } else {
                                      setTempConfig(prev => ({
                                        ...prev,
                                        owner: prev.owner || connection.user?.login || '',
                                        repo: raw,
                                      }));
                                    }
                                  }}
                                  className="inline-flex items-center gap-1.5 bg-[#00f0ff]/10 hover:bg-[#00f0ff]/20 text-[#00f0ff] border border-[#00f0ff]/30 px-3 py-1.5 rounded-lg text-xs font-mono transition-colors cursor-pointer"
                                >
                                  <span>Use target: <strong>{repoSearch.trim()}</strong></span>
                                </button>
                              )}
                            </div>
                          ) : (
                            filteredRepos.map(repo => {
                              const isCurrent =
                                Boolean(tempConfig.owner && tempConfig.repo) &&
                                tempConfig.owner.toLowerCase() === repo.owner.toLowerCase() &&
                                tempConfig.repo.toLowerCase() === repo.name.toLowerCase();

                              return (
                                <div
                                  key={repo.id}
                                  onClick={() => handleSelectRepository(repo)}
                                  className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                                    isCurrent
                                      ? 'bg-[#00f0ff]/10 border-[#00f0ff]/50 shadow-[0_0_12px_rgba(0,240,255,0.15)]'
                                      : 'bg-[#0e1118] border-[#1e2538] hover:border-[#00f0ff]/30 hover:bg-[#19202f]'
                                  }`}
                                >
                                  <div className="flex-1 min-w-0 pr-2">
                                    <div className="flex items-center gap-1.5">
                                      {repo.private ? (
                                        <Lock size={12} className="text-[#f2741d] shrink-0" />
                                      ) : (
                                        <Globe size={12} className="text-[#94a3b8] shrink-0" />
                                      )}
                                      <span className={`text-xs font-semibold truncate ${isCurrent ? 'text-[#00f0ff]' : 'text-white'}`}>
                                        {repo.fullName}
                                      </span>
                                      {repo.isZmkConfig && (
                                        <Chip className="bg-[#00f0ff]/20 text-[#00f0ff] border border-[#00f0ff]/40 text-[10px] font-mono px-1.5 h-4">
                                          ZMK
                                        </Chip>
                                      )}
                                    </div>
                                    {repo.description && (
                                      <p className="text-[11px] text-[#94a3b8] truncate mt-0.5">{repo.description}</p>
                                    )}
                                  </div>
                                  {isCurrent && (
                                    <span className="size-5 rounded-full bg-[#00f0ff]/20 border border-[#00f0ff] flex items-center justify-center text-[#00f0ff] shrink-0">
                                      <Check size={12} />
                                    </span>
                                  )}
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>

                      {/* Branch Selector */}
                      <div className="space-y-1.5 pt-1">
                        <label className="flex items-center justify-between text-xs font-semibold text-slate-200">
                          <span className="flex items-center gap-1.5">
                            <GitBranch size={13} className="text-[#00f0ff]" />
                            <span>Branch</span>
                          </span>
                          {isLoadingBranches && (
                            <span className="text-[11px] text-[#94a3b8] flex items-center gap-1">
                              <RefreshCw size={10} className="animate-spin" /> Loading branches...
                            </span>
                          )}
                        </label>
                        <select
                          value={tempConfig.branch}
                          onChange={e => setTempConfig({ ...tempConfig, branch: e.target.value })}
                          className="w-full bg-[#0e1118] border border-[#1e2538] focus:border-[#00f0ff]/50 text-white text-xs rounded-xl px-3 py-2 outline-none transition-colors cursor-pointer font-mono"
                          disabled={isLoadingBranches}
                        >
                          {branches.length > 0 ? (
                            branches.map(b => (
                              <option key={b} value={b} className="bg-[#131722] text-white">
                                {b}
                              </option>
                            ))
                          ) : (
                            <option value={tempConfig.branch} className="bg-[#131722] text-white">{tempConfig.branch}</option>
                          )}
                        </select>
                      </div>

                      {/* Scyan Display Module Ecosystem Integration */}
                      {repoPrereqs && (
                        <div className="bg-[#0e1118] border border-[#1e2538] rounded-xl p-3.5 space-y-2.5">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span
                                className={`size-2 rounded-full ${
                                  repoPrereqs.isInstalled
                                    ? 'bg-[#00f0ff] shadow-[0_0_8px_#00f0ff]'
                                    : 'bg-[#f2741d] animate-pulse'
                                }`}
                              />
                              <span className="text-xs font-semibold text-white">Scyan Display Module</span>
                              {repoPrereqs.isInstalled ? (
                                <Chip className="bg-[#00f0ff]/15 text-[#00f0ff] border border-[#00f0ff]/30 text-[10px] font-mono px-1.5 h-4">
                                  Installed
                                </Chip>
                              ) : (
                                <Chip className="bg-[#f2741d]/15 text-[#f2741d] border border-[#f2741d]/30 text-[10px] font-mono px-1.5 h-4">
                                  Setup Required
                                </Chip>
                              )}
                            </div>

                            {repoPrereqs.isInstalled ? (
                              !confirmUninstall ? (
                                <Button
                                  size="sm"
                                  type="button"
                                  onClick={() => setConfirmUninstall(true)}
                                  isDisabled={isUninstallingStudio}
                                  className="bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 border border-red-500/30 text-[11px] font-medium px-2.5 h-7 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                                >
                                  <Trash2 size={11} />
                                  <span>Uninstall Module</span>
                                </Button>
                              ) : (
                                <div className="flex items-center gap-1.5">
                                  <Button
                                    size="sm"
                                    type="button"
                                    onClick={() => setConfirmUninstall(false)}
                                    isDisabled={isUninstallingStudio}
                                    className="bg-[#19202f] hover:bg-[#232c3f] text-[#94a3b8] hover:text-white border border-[#2d3748] text-[10px] font-medium px-2 h-6 rounded-md transition-colors cursor-pointer"
                                  >
                                    Cancel
                                  </Button>
                                  <Button
                                    size="sm"
                                    type="button"
                                    onClick={() => {
                                      setConfirmUninstall(false);
                                      onUninstallStudio?.();
                                    }}
                                    isDisabled={isUninstallingStudio}
                                    className="bg-red-600 hover:bg-red-500 text-white font-bold text-[10px] px-2.5 h-6 rounded-md transition-colors flex items-center gap-1 cursor-pointer"
                                  >
                                    {isUninstallingStudio ? (
                                      <>
                                        <RefreshCw size={10} className="animate-spin" />
                                        <span>Uninstalling...</span>
                                      </>
                                    ) : (
                                      <>
                                        <Trash2 size={10} />
                                        <span>Confirm Uninstall</span>
                                      </>
                                    )}
                                  </Button>
                                </div>
                              )
                            ) : (
                              <Button
                                size="sm"
                                type="button"
                                onClick={() => onInstallStudio?.()}
                                isDisabled={isInstallingStudio}
                                className="bg-[#f2741d]/20 hover:bg-[#f2741d] text-[#f2741d] hover:text-white border border-[#f2741d]/40 text-[11px] font-semibold px-2.5 h-7 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                              >
                                {isInstallingStudio ? (
                                  <>
                                    <RefreshCw size={11} className="animate-spin" />
                                    <span>Installing...</span>
                                  </>
                                ) : (
                                  <span>Install Module</span>
                                )}
                              </Button>
                            )}
                          </div>

                          <p className="text-[11px] text-[#94a3b8] leading-relaxed">
                            {repoPrereqs.isInstalled
                              ? confirmUninstall
                                ? 'Are you sure? This will remove scyan-zmk-module from west.yml, clean custom Scyan display configs from your .conf file, and delete scyan_assets.h.'
                                : 'Scyan display driver and assets are active in this repository. Uninstalling cleanly reverts your repository to standard ZMK display widgets.'
                              : 'This repository does not have Scyan ZMK Studio installed yet. Click Install to inject west.yml and display configs.'}
                          </p>
                        </div>
                      )}

                      {/* Workspace Restoration */}
                      {renderWorkspaceRestoration()}
                    </div>

                    {/* Modal Action Buttons */}
                    <div className="flex items-center justify-end gap-2.5 p-4 border-t border-[#1e2538] bg-[#131722] shrink-0">
                      <Button
                        size="sm"
                        type="button"
                        onClick={() => setIsSettingsOpen(false)}
                        className="bg-[#19202f] hover:bg-[#232c3f] border border-[#2d3748] text-[#94a3b8] hover:text-white text-xs font-medium px-4 h-9 rounded-xl transition-all cursor-pointer"
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        type="submit"
                        isDisabled={!tempConfig.owner || !tempConfig.repo || isAuthorizing}
                        className="bg-[#00f0ff] hover:bg-[#38f2fd] disabled:opacity-50 text-[#0b0d13] font-bold text-xs px-5 h-9 rounded-xl shadow-[0_0_16px_rgba(0,240,255,0.3)] transition-all cursor-pointer"
                      >
                        Apply Repository Selection
                      </Button>
                    </div>
                  </>
                ) : (
                  /* Disconnected State */
                  <>
                    <div className="p-5 space-y-4 overflow-y-auto flex-1 min-h-0">
                      <div className="bg-[#a953f6]/10 border border-[#a953f6]/30 rounded-xl p-4 flex items-start gap-3">
                        <Info size={18} className="text-[#a953f6] mt-0.5 shrink-0" />
                        <div>
                          <strong className="text-[#a953f6] text-sm font-semibold">GitHub Connection</strong>
                          <p className="text-xs text-[#94a3b8] mt-1 leading-relaxed">
                            Make sure to select only the zmk-config repository you want to use for your keymap and firmware builds.
                          </p>
                        </div>
                      </div>

                      {/* Login Box */}
                      <div className="bg-[#0e1118] border border-[#1e2538] rounded-xl p-5 flex flex-col items-center gap-3.5 text-center">
                        <a
                          href="https://github.com/settings/personal-access-tokens/new?name=ZMK+Keymap+Manager&description=Read+and+write+keymap+files,+download+firmware+build+artifacts&repository_selection=selected&contents=write&actions=read"
                          target="_blank"
                          rel="noreferrer"
                          className="w-full max-w-sm bg-gradient-to-r from-[#00f0ff] to-[#a953f6] hover:opacity-95 text-[#0b0d13] font-bold text-xs py-2.5 rounded-xl transition-all shadow-[0_0_16px_rgba(0,240,255,0.25)] flex items-center justify-center gap-2"
                          title="Opens GitHub with Contents (write), Actions (read), and Only select repositories pre-selected"
                        >
                          <GithubIcon size={16} />
                          <span>Get GitHub Token</span>
                        </a>

                        <div className="w-full max-w-sm space-y-2">
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
                            placeholder="Personal Access Token (paste & press Enter)"
                            className="w-full bg-[#131722] border border-[#1e2538] focus:border-[#00f0ff]/50 rounded-xl px-3.5 py-2.5 text-xs text-center text-white placeholder-[#555e6e] outline-none font-mono transition-colors"
                            disabled={isAuthorizing}
                            autoFocus
                          />
                          <input
                            type="text"
                            value={manualRepoInput}
                            onChange={e => setManualRepoInput(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleProcessToken(quickKeyInput);
                              }
                            }}
                            placeholder="Repository (e.g. owner/zmk-config) — optional"
                            className="w-full bg-[#131722] border border-[#1e2538] focus:border-[#00f0ff]/50 rounded-xl px-3.5 py-2 text-xs text-center text-white placeholder-[#555e6e] outline-none font-mono transition-colors"
                            disabled={isAuthorizing}
                          />
                        </div>

                        {isAuthorizing && (
                          <div className="flex items-center gap-1.5 text-xs text-[#00f0ff]">
                            <RefreshCw size={12} className="animate-spin" />
                            <span>Validating and connecting...</span>
                          </div>
                        )}

                        {/* Live Validation Feedback */}
                        {authFeedback && !isAuthorizing && (
                          <div
                            className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs w-full max-w-sm justify-center ${
                              authFeedback.status === 'success'
                                ? 'bg-[#00f0ff]/10 border-[#00f0ff]/30 text-[#00f0ff]'
                                : 'bg-[#f2741d]/10 border-[#f2741d]/30 text-[#f2741d]'
                            }`}
                          >
                            {authFeedback.status === 'success' ? (
                              <Check size={14} className="shrink-0" />
                            ) : (
                              <AlertCircle size={14} className="shrink-0" />
                            )}
                            <span>{authFeedback.message}</span>
                          </div>
                        )}
                      </div>

                      {/* Workspace Restoration */}
                      {renderWorkspaceRestoration()}
                    </div>

                    <div className="flex items-center justify-end p-4 border-t border-[#1e2538] bg-[#131722] shrink-0">
                      <Button
                        size="sm"
                        type="button"
                        onClick={() => setIsSettingsOpen(false)}
                        className="bg-[#19202f] hover:bg-[#232c3f] border border-[#2d3748] text-[#94a3b8] hover:text-white text-xs font-medium px-4 h-9 rounded-xl transition-all cursor-pointer"
                      >
                        Close
                      </Button>
                    </div>
                  </>
                )}
              </form>
            </div>
          </div>
        );

        return typeof document !== 'undefined' ? createPortal(modalNode, document.body) : modalNode;
      })()
    )}

    <LogoContextMenu
      isOpen={!!logoMenuPos}
      position={logoMenuPos}
      onClose={() => setLogoMenuPos(null)}
      onOpenChangelog={() => setIsChangelogOpen(true)}
    />

    <ChangelogModal
      isOpen={isChangelogOpen}
      onClose={() => setIsChangelogOpen(false)}
    />
  </>
  );
};

import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { HeaderBar } from '../HeaderBar';
import type { GitHubConnectionState, GitHubRepoConfig } from '../../services/githubService';

const mockConfig: GitHubRepoConfig = {
  owner: 'test-user',
  repo: 'zmk-config',
  branch: 'main',
  token: 'ghp_test_token',
};

const baseProps = {
  config: mockConfig,
  onConfigChange: () => {},
  onSync: () => {},
  onSave: () => {},
  onTestConnection: async () => ({ status: 'connected' } as any),
  onDisconnect: () => {},
  isSaving: false,
  isSyncing: false,
  lastSavedAt: null,
  isSettingsOpen: false,
  setIsSettingsOpen: () => {},
};

describe('HeaderBar disconnected-expanded and compact states', () => {
  it('renders expanded 130px header with preview mode status when disconnected', () => {
    const connection: GitHubConnectionState = {
      status: 'disconnected',
      user: null,
      repo: null,
      errorMessage: null,
      lastCheckedAt: null,
      resolvedOwner: null,
      resolvedRepo: null,
    };

    const html = renderToString(
      <HeaderBar {...baseProps} connection={connection} />
    );

    expect(html).toContain('disconnected-expanded');
    expect(html).toContain('h-[130px]');
    expect(html).toContain('Studio is in preview mode');
    expect(html).toContain('Connect');
    expect(html).not.toContain('h-[54px]');
  });

  it('renders expanded 130px header with error state when connection status is error', () => {
    const connection: GitHubConnectionState = {
      status: 'error',
      user: null,
      repo: null,
      errorMessage: 'Bad credentials',
      lastCheckedAt: null,
      resolvedOwner: null,
      resolvedRepo: null,
    };

    const html = renderToString(
      <HeaderBar {...baseProps} connection={connection} />
    );

    expect(html).toContain('disconnected-expanded');
    expect(html).toContain('h-[130px]');
    expect(html).toContain('Git Connection Error');
    expect(html).toContain('Fix');
  });

  it('renders compact 54px header when connection status is connecting without expanding', () => {
    const connection: GitHubConnectionState = {
      status: 'connecting',
      user: null,
      repo: null,
      errorMessage: null,
      lastCheckedAt: null,
      resolvedOwner: null,
      resolvedRepo: null,
    };

    const html = renderToString(
      <HeaderBar {...baseProps} connection={connection} />
    );

    expect(html).toContain('h-[54px]');
    expect(html).not.toContain('disconnected-expanded');
    expect(html).not.toContain('h-[130px]');
    expect(html).toContain('Connecting Git...');
  });

  it('renders compact 54px header with repository details when connected and no prerequisites require install', () => {
    const connection: GitHubConnectionState = {
      status: 'connected',
      user: { login: 'test-user', name: 'Test User', avatarUrl: 'https://example.com/avatar.png' },
      repo: { name: 'zmk-config', fullName: 'test-user/zmk-config', isPrivate: false, hasPushAccess: true, defaultBranch: 'main', description: null },
      errorMessage: null,
      lastCheckedAt: 123456789,
      resolvedOwner: 'test-user',
      resolvedRepo: 'zmk-config',
    };

    const html = renderToString(
      <HeaderBar {...baseProps} connection={connection} />
    );

    expect(html).toContain('h-[54px]');
    expect(html).not.toContain('disconnected-expanded');
    expect(html).not.toContain('h-[130px]');
    expect(html).toContain('test-user/zmk-config');
    expect(html).toContain('main');
    expect(html).toContain('PUSH OK');
  });

  it('renders expanded 130px header when connected but user still requires installing', () => {
    const connection: GitHubConnectionState = {
      status: 'connected',
      user: { login: 'test-user', name: 'Test User', avatarUrl: 'https://example.com/avatar.png' },
      repo: { name: 'zmk-config', fullName: 'test-user/zmk-config', isPrivate: false, hasPushAccess: true, defaultBranch: 'main', description: null },
      errorMessage: null,
      lastCheckedAt: 123456789,
      resolvedOwner: 'test-user',
      resolvedRepo: 'zmk-config',
    };

    const prereqs = {
      hasWestModule: false,
      hasKconfig: false,
      hasAssetsHeader: false,
      isInstalled: false,
    };

    const html = renderToString(
      <HeaderBar {...baseProps} connection={connection} repoPrereqs={prereqs} />
    );

    expect(html).toContain('disconnected-expanded');
    expect(html).toContain('h-[130px]');
    expect(html).not.toContain('h-[54px]');
    expect(html).toContain('test-user/zmk-config');
    expect(html).toContain('Setup Required');
    expect(html).toContain('Install');
  });

  it('renders expanded 130px header with installing state when install is in progress', () => {
    const connection: GitHubConnectionState = {
      status: 'connected',
      user: { login: 'test-user', name: 'Test User', avatarUrl: 'https://example.com/avatar.png' },
      repo: { name: 'zmk-config', fullName: 'test-user/zmk-config', isPrivate: false, hasPushAccess: true, defaultBranch: 'main', description: null },
      errorMessage: null,
      lastCheckedAt: 123456789,
      resolvedOwner: 'test-user',
      resolvedRepo: 'zmk-config',
    };

    const prereqs = {
      hasWestModule: false,
      hasKconfig: false,
      hasAssetsHeader: false,
      isInstalled: false,
    };

    const html = renderToString(
      <HeaderBar
        {...baseProps}
        connection={connection}
        repoPrereqs={prereqs}
        isInstallingStudio={true}
      />
    );

    expect(html).toContain('disconnected-expanded');
    expect(html).toContain('h-[130px]');
    expect(html).not.toContain('h-[54px]');
    expect(html).toContain('Installing...');
  });

  it('renders compact 54px header when connected and studio is installed', () => {
    const connection: GitHubConnectionState = {
      status: 'connected',
      user: { login: 'test-user', name: 'Test User', avatarUrl: 'https://example.com/avatar.png' },
      repo: { name: 'zmk-config', fullName: 'test-user/zmk-config', isPrivate: false, hasPushAccess: true, defaultBranch: 'main', description: null },
      errorMessage: null,
      lastCheckedAt: 123456789,
      resolvedOwner: 'test-user',
      resolvedRepo: 'zmk-config',
    };

    const prereqs = {
      hasWestModule: true,
      hasKconfig: true,
      hasAssetsHeader: true,
      isInstalled: true,
    };

    const html = renderToString(
      <HeaderBar {...baseProps} connection={connection} repoPrereqs={prereqs} />
    );

    expect(html).toContain('h-[54px]');
    expect(html).not.toContain('disconnected-expanded');
    expect(html).not.toContain('h-[130px]');
    expect(html).toContain('test-user/zmk-config');
    expect(html).toContain('main');
    expect(html).toContain('PUSH OK');
  });

  it('renders settings modal outside the header element when open in connected state', () => {
    const connection: GitHubConnectionState = {
      status: 'connected',
      user: { login: 'test-user', name: 'Test User', avatarUrl: 'https://example.com/avatar.png' },
      repo: { name: 'zmk-config', fullName: 'test-user/zmk-config', isPrivate: false, hasPushAccess: true, defaultBranch: 'main', description: null },
      errorMessage: null,
      lastCheckedAt: 123456789,
      resolvedOwner: 'test-user',
      resolvedRepo: 'zmk-config',
    };

    const html = renderToString(
      <HeaderBar {...baseProps} connection={connection} isSettingsOpen={true} />
    );

    expect(html).toContain('modal-overlay');
    expect(html).toContain('GitHub Repository Connection');
    expect(html).toContain('Apply Repository Selection');
    expect(html).toContain('Reload from GitHub');
    expect(html).toContain('Restore Defaults');
    expect(html).not.toContain('>Discard<');

    // Crucial check: modal must not be nested inside <header> which has backdrop-blur-md
    const headerEndIndex = html.indexOf('</header>');
    const modalIndex = html.indexOf('modal-overlay');
    expect(headerEndIndex).toBeGreaterThan(-1);
    expect(modalIndex).toBeGreaterThan(headerEndIndex);
  });

  it('does not render saved at subtitle in the logo even when lastSavedAt is set', () => {
    const connection: GitHubConnectionState = {
      status: 'connected',
      user: { login: 'test-user', name: 'Test User', avatarUrl: 'https://example.com/avatar.png' },
      repo: { name: 'zmk-config', fullName: 'test-user/zmk-config', isPrivate: false, hasPushAccess: true, defaultBranch: 'main', description: null },
      errorMessage: null,
      lastCheckedAt: 123456789,
      resolvedOwner: 'test-user',
      resolvedRepo: 'zmk-config',
    };

    const html = renderToString(
      <HeaderBar {...baseProps} connection={connection} lastSavedAt="3:45:00 PM" />
    );

    // The logo should not display the saved subtitle
    expect(html).not.toContain('Saved 3:45:00 PM');
  });

  it('renders saved at information inside CI Passed badge when lastSavedAt is set and build succeeded', () => {
    const connection: GitHubConnectionState = {
      status: 'connected',
      user: { login: 'test-user', name: 'Test User', avatarUrl: 'https://example.com/avatar.png' },
      repo: { name: 'zmk-config', fullName: 'test-user/zmk-config', isPrivate: false, hasPushAccess: true, defaultBranch: 'main', description: null },
      errorMessage: null,
      lastCheckedAt: 123456789,
      resolvedOwner: 'test-user',
      resolvedRepo: 'zmk-config',
    };

    const mockRun = {
      id: 123,
      name: 'Build Firmware',
      status: 'completed' as const,
      conclusion: 'success' as const,
      htmlUrl: 'https://github.com/test-user/zmk-config/actions/runs/123',
      artifactsUrl: 'https://api.github.com/repos/test-user/zmk-config/actions/runs/123/artifacts',
      createdAt: '2026-09-10T12:00:00Z',
      updatedAt: '2026-09-10T12:02:00Z',
    };

    const html = renderToString(
      <HeaderBar
        {...baseProps}
        connection={connection}
        lastSavedAt="3:45:00 PM"
        initialWorkflowRun={mockRun}
      />
    );

    expect(html).toContain('CI Passed');
    expect(html).toContain('Saved 3:45:00 PM');
    expect(html).toContain('Saved at 3:45:00 PM');
  });

  it('renders CI Passed badge without saved at text when lastSavedAt is null', () => {
    const connection: GitHubConnectionState = {
      status: 'connected',
      user: { login: 'test-user', name: 'Test User', avatarUrl: 'https://example.com/avatar.png' },
      repo: { name: 'zmk-config', fullName: 'test-user/zmk-config', isPrivate: false, hasPushAccess: true, defaultBranch: 'main', description: null },
      errorMessage: null,
      lastCheckedAt: 123456789,
      resolvedOwner: 'test-user',
      resolvedRepo: 'zmk-config',
    };

    const mockRun = {
      id: 123,
      name: 'Build Firmware',
      status: 'completed' as const,
      conclusion: 'success' as const,
      htmlUrl: 'https://github.com/test-user/zmk-config/actions/runs/123',
      artifactsUrl: 'https://api.github.com/repos/test-user/zmk-config/actions/runs/123/artifacts',
      createdAt: '2026-09-10T12:00:00Z',
      updatedAt: '2026-09-10T12:02:00Z',
    };

    const html = renderToString(
      <HeaderBar
        {...baseProps}
        connection={connection}
        lastSavedAt={null}
        initialWorkflowRun={mockRun}
      />
    );

    expect(html).toContain('CI Passed');
    expect(html).not.toContain('Saved ');
  });

  it('renders BrandIdentityLogo with SCYAN and STUDIO text in HeaderBar', () => {
    const connection: GitHubConnectionState = {
      status: 'connected',
      user: { login: 'test-user', name: 'Test User', avatarUrl: 'https://example.com/avatar.png' },
      repo: { name: 'zmk-config', fullName: 'test-user/zmk-config', isPrivate: false, hasPushAccess: true, defaultBranch: 'main', description: null },
      errorMessage: null,
      lastCheckedAt: 123456789,
      resolvedOwner: 'test-user',
      resolvedRepo: 'zmk-config',
    };

    const html = renderToString(
      <HeaderBar {...baseProps} connection={connection} />
    );

    expect(html).toContain('SCYAN');
    expect(html).toContain('STUDIO');
  });

  it('renders Ko-fi tipping link tucked behind Commit & Build with slide-down on hover', () => {
    const connection: GitHubConnectionState = {
      status: 'connected',
      user: null,
      repo: null,
      errorMessage: null,
      lastCheckedAt: null,
      resolvedOwner: null,
      resolvedRepo: null,
    };

    const html = renderToString(
      <HeaderBar {...baseProps} connection={connection} />
    );

    expect(html).toContain('https://ko-fi.com/brunowb');
    expect(html).toContain('Support me on Ko-fi');
    expect(html).toContain('Buy me a coffee');
    expect(html).toContain('group/commit');
    expect(html).toContain('group-hover/commit:translate-y-0');
  });
});

import { describe, it, expect } from 'vitest';
import {
  updateKconfigSetting,
  resolveConfUpdates,
  removeScyanFromWest,
  removeScyanFromConf,
  formatStudioCommitMessage,
  STUDIO_COMMIT_PREFIX,
} from '../githubService';

describe('githubService Kconfig timeout synchronization', () => {
  describe('updateKconfigSetting', () => {
    it('updates an existing configuration value', () => {
      const input = [
        '# Right half: custom display enabled',
        'CONFIG_ZMK_DISPLAY=y',
        'CONFIG_ZMK_IDLE_TIMEOUT=60000',
      ].join('\n');

      const res = updateKconfigSetting(input, 'CONFIG_ZMK_IDLE_TIMEOUT', 25000);
      expect(res.changed).toBe(true);
      expect(res.updated).toContain('CONFIG_ZMK_IDLE_TIMEOUT=25000');
      expect(res.updated).not.toContain('CONFIG_ZMK_IDLE_TIMEOUT=60000');
      // Preserves preceding comments
      expect(res.updated).toContain('# Right half: custom display enabled');
    });

    it('uncomments and updates a commented out configuration value', () => {
      const input = [
        '# CONFIG_ZMK_IDLE_TIMEOUT=30000',
        'CONFIG_ZMK_DISPLAY=y',
      ].join('\n');

      const res = updateKconfigSetting(input, 'CONFIG_ZMK_IDLE_TIMEOUT', 25000);
      expect(res.changed).toBe(true);
      expect(res.updated).toContain('CONFIG_ZMK_IDLE_TIMEOUT=25000');
      expect(res.updated).not.toContain('# CONFIG_ZMK_IDLE_TIMEOUT');
    });

    it('reports no change if the setting is already set to the target value', () => {
      const input = [
        'CONFIG_ZMK_DISPLAY=y',
        'CONFIG_ZMK_IDLE_TIMEOUT=25000',
      ].join('\n');

      const res = updateKconfigSetting(input, 'CONFIG_ZMK_IDLE_TIMEOUT', 25000);
      expect(res.changed).toBe(false);
      expect(res.updated).toBe(input);
    });

    it('appends the setting cleanly to the end when not present', () => {
      const input = 'CONFIG_ZMK_DISPLAY=y\n';
      const res = updateKconfigSetting(input, 'CONFIG_ZMK_IDLE_TIMEOUT', 25000);
      expect(res.changed).toBe(true);
      expect(res.updated).toBe('CONFIG_ZMK_DISPLAY=y\nCONFIG_ZMK_IDLE_TIMEOUT=25000\n');
    });

    it('does not corrupt unrelated comments that mention the key', () => {
      const input = [
        '# Note: CONFIG_ZMK_IDLE_TIMEOUT is configured below',
        'CONFIG_ZMK_IDLE_TIMEOUT=60000',
      ].join('\n');

      const res = updateKconfigSetting(input, 'CONFIG_ZMK_IDLE_TIMEOUT', 25000);
      expect(res.changed).toBe(true);
      expect(res.updated).toContain('# Note: CONFIG_ZMK_IDLE_TIMEOUT is configured below');
      expect(res.updated).toContain('CONFIG_ZMK_IDLE_TIMEOUT=25000');
    });
  });

  describe('resolveConfUpdates', () => {
    it('updates both left and right conf files when asymmetric settings are provided', () => {
      const confFiles = [
        {
          path: 'config/corne_left.conf',
          content: 'CONFIG_ZMK_IDLE_TIMEOUT=60000\nCONFIG_ZMK_WPM=y\n',
        },
        {
          path: 'config/corne_right.conf',
          content: 'CONFIG_ZMK_DISPLAY=y\nCONFIG_ZMK_IDLE_TIMEOUT=60000\n',
        },
      ];

      const updates = resolveConfUpdates(confFiles, {
        screenOffTimeoutSec: 60,
        rightScreenOffTimeoutSec: 25,
        symmetricSettings: false,
      });

      // Left is already 60000, so only right needs updating!
      expect(updates).toHaveLength(1);
      expect(updates[0].path).toBe('config/corne_right.conf');
      expect(updates[0].content).toContain('CONFIG_ZMK_IDLE_TIMEOUT=25000');
    });

    it('updates both halves when symmetric settings are provided', () => {
      const confFiles = [
        {
          path: 'config/corne_left.conf',
          content: 'CONFIG_ZMK_IDLE_TIMEOUT=60000\n',
        },
        {
          path: 'config/corne_right.conf',
          content: 'CONFIG_ZMK_IDLE_TIMEOUT=60000\n',
        },
      ];

      const updates = resolveConfUpdates(confFiles, {
        screenOffTimeoutSec: 30,
        rightScreenOffTimeoutSec: 25, // should be ignored because symmetricSettings is true
        symmetricSettings: true,
      });

      expect(updates).toHaveLength(2);
      expect(updates.find(u => u.path === 'config/corne_left.conf')?.content).toContain('CONFIG_ZMK_IDLE_TIMEOUT=30000');
      expect(updates.find(u => u.path === 'config/corne_right.conf')?.content).toContain('CONFIG_ZMK_IDLE_TIMEOUT=30000');
    });

    it('returns empty array when all conf files already match target timeouts', () => {
      const confFiles = [
        {
          path: 'config/corne_left.conf',
          content: 'CONFIG_ZMK_IDLE_TIMEOUT=60000\n',
        },
        {
          path: 'config/corne_right.conf',
          content: 'CONFIG_ZMK_IDLE_TIMEOUT=25000\n',
        },
      ];

      const updates = resolveConfUpdates(confFiles, {
        screenOffTimeoutSec: 60,
        rightScreenOffTimeoutSec: 25,
        symmetricSettings: false,
      });

      expect(updates).toHaveLength(0);
    });

    it('handles unified base conf with symmetric timeout', () => {
      const confFiles = [
        {
          path: 'config/corne.conf',
          content: 'CONFIG_ZMK_DISPLAY=y\nCONFIG_ZMK_IDLE_TIMEOUT=60000\n',
        },
      ];

      const updates = resolveConfUpdates(confFiles, {
        screenOffTimeoutSec: 45,
        symmetricSettings: true,
      });

      expect(updates).toHaveLength(1);
      expect(updates[0].path).toBe('config/corne.conf');
      expect(updates[0].content).toContain('CONFIG_ZMK_IDLE_TIMEOUT=45000');
    });

    it('handles base conf with asymmetric timeout by updating base and creating right conf', () => {
      const confFiles = [
        {
          path: 'config/corne.conf',
          content: 'CONFIG_ZMK_DISPLAY=y\nCONFIG_ZMK_IDLE_TIMEOUT=60000\n',
        },
      ];

      const updates = resolveConfUpdates(confFiles, {
        screenOffTimeoutSec: 60,
        rightScreenOffTimeoutSec: 25,
        symmetricSettings: false,
      });

      expect(updates.some(u => u.path === 'config/corne_right.conf')).toBe(true);
      const rightConf = updates.find(u => u.path === 'config/corne_right.conf');
      expect(rightConf?.content).toContain('CONFIG_ZMK_IDLE_TIMEOUT=25000');
    });
  });

  describe('removeScyanFromWest', () => {
    it('removes scyan-zmk-module project and brunowb remote cleanly', () => {
      const westYml = [
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
      ].join('\n');

      const result = removeScyanFromWest(westYml);
      expect(result).not.toContain('scyan-zmk-module');
      expect(result).not.toContain('brunowb');
      expect(result).toContain('name: zmk');
      expect(result).toContain('url-base: https://github.com/zmkfirmware');
      expect(result).toContain('self:');
      expect(result).toContain('path: config');
    });

    it('safely removes scyan when it is listed first without eating subsequent projects or self (regression)', () => {
      // Exact scenario from user bug report where brunowb and scyan are the first items
      const westYml = [
        'manifest:',
        '  defaults:',
        '    revision: v0.3',
        '  remotes:',
        '    - name: brunowb',
        '      url-base: https://github.com/BrunoWB',
        '    - name: zmkfirmware',
        '      url-base: https://github.com/zmkfirmware',
        '    # Additional modules containing boards/shields/custom code can be listed here as well',
        '    # See https://docs.zephyrproject.org/3.2.0/develop/west/manifest.html#projects',
        '  projects:',
        '    - name: scyan-zmk-module',
        '      remote: brunowb',
        '      revision: main',
        '    - name: zmk',
        '      remote: zmkfirmware',
        '      import: app/west.yml',
        '  self:',
        '    path: config',
      ].join('\n');

      const result = removeScyanFromWest(westYml);
      expect(result).not.toContain('scyan-zmk-module');
      expect(result).not.toContain('brunowb');
      expect(result).toContain('name: zmkfirmware');
      expect(result).toContain('url-base: https://github.com/zmkfirmware');
      expect(result).toContain('# Additional modules');
      expect(result).toContain('name: zmk');
      expect(result).toContain('remote: zmkfirmware');
      expect(result).toContain('import: app/west.yml');
      expect(result).toContain('self:');
      expect(result).toContain('path: config');
    });

    it('preserves brunowb remote if another project uses it', () => {
      const westYml = [
        'manifest:',
        '  remotes:',
        '    - name: brunowb',
        '      url-base: https://github.com/BrunoWB',
        '  projects:',
        '    - name: other-module',
        '      remote: brunowb',
        '    - name: scyan-zmk-module',
        '      remote: brunowb',
        '      revision: main',
      ].join('\n');

      const result = removeScyanFromWest(westYml);
      expect(result).not.toContain('scyan-zmk-module');
      expect(result).toContain('name: brunowb');
      expect(result).toContain('name: other-module');
    });
  });

  describe('removeScyanFromConf', () => {
    it('removes Scyan-specific configs and comments while preserving generic display configs', () => {
      const conf = [
        '# Enable the Corne OLED Display (SSD1306)',
        'CONFIG_ZMK_DISPLAY=y',
        'CONFIG_SSD1306=y',
        'CONFIG_ZMK_DISPLAY_WORK_QUEUE_DEDICATED=y',
        'CONFIG_ZMK_DISPLAY_DEDICATED_THREAD_PRIORITY=10',
        'CONFIG_ZMK_DISPLAY_BLANK_ON_IDLE=y',
        '',
        '# Scyan ZMK Display Module',
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
        '# Eager debounce config:',
        'CONFIG_ZMK_KSCAN_DEBOUNCE_PRESS_MS=1',
      ].join('\n');

      const result = removeScyanFromConf(conf);

      // Scyan custom configs must be removed
      expect(result).not.toContain('CONFIG_SCYAN_');
      expect(result).not.toContain('CONFIG_ZMK_DISPLAY_STATUS_SCREEN_CUSTOM');
      expect(result).not.toContain('CONFIG_ZMK_DISPLAY_STATUS_SCREEN_BUILT_IN');
      expect(result).not.toContain('CONFIG_LV_USE_CANVAS');
      expect(result).not.toContain('CONFIG_LV_USE_IMG');
      expect(result).not.toContain('# Scyan ZMK Display Module');

      // Generic display and input configs must be preserved
      expect(result).toContain('CONFIG_ZMK_DISPLAY=y');
      expect(result).toContain('CONFIG_SSD1306=y');
      expect(result).toContain('CONFIG_ZMK_DISPLAY_WORK_QUEUE_DEDICATED=y');
      expect(result).toContain('CONFIG_ZMK_DISPLAY_DEDICATED_THREAD_PRIORITY=10');
      expect(result).toContain('CONFIG_ZMK_DISPLAY_BLANK_ON_IDLE=y');
      expect(result).toContain('CONFIG_ZMK_KSCAN_DEBOUNCE_PRESS_MS=1');
    });
  });

  describe('formatStudioCommitMessage', () => {
    it('prepends [Scyan Studio] prefix to messages that lack it', () => {
      const msg = 'feat(display): update 2-Atlas display spritesheets & glyph tables';
      expect(formatStudioCommitMessage(msg)).toBe(`[Scyan Studio] ${msg}`);
    });

    it('does not double-prefix if already starts with [Scyan Studio]', () => {
      const msg = '[Scyan Studio] chore(display): uninstall Scyan ZMK Studio module, config & assets';
      expect(formatStudioCommitMessage(msg)).toBe(msg);
    });

    it('trims whitespace and prepends prefix cleanly', () => {
      const msg = '  feat(display): install Scyan ZMK Studio module, config & assets  ';
      expect(formatStudioCommitMessage(msg)).toBe('[Scyan Studio] feat(display): install Scyan ZMK Studio module, config & assets');
    });

    it('exports the standard prefix constant [Scyan Studio] ', () => {
      expect(STUDIO_COMMIT_PREFIX).toBe('[Scyan Studio] ');
    });
  });
});


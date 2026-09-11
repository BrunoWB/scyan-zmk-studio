import { describe, it, expect } from 'vitest';
import {
  updateKconfigSetting,
  resolveConfUpdates,
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
});


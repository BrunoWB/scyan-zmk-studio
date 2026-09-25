import { describe, it, expect } from 'vitest';
import {
  updateKconfigSetting,
  removeKconfigSetting,
  resolveConfUpdates,
  resolveConfTimeoutUpdates,
  injectOrUpdateOverlay,
  formatScyanOverlayBlock,
  cleanLegacyScyanOverlay,
  SCYAN_STUDIO_MARKER_BEGIN,
  SCYAN_STUDIO_MARKER_END,
  SCYAN_CONF_MARKER_BEGIN,
  SCYAN_CONF_MARKER_END,
  SCYAN_CONF_BLOCK_REGEX,
  formatScyanConfBlock,
  injectOrUpdateConfBlock,
  cleanLegacyScyanConf,
  updateConfTimeoutSetting,
  removeConfTimeoutSetting,
  migrateLegacyConfToBlock,
  injectScyanIntoWest,
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

  describe('removeKconfigSetting', () => {
    it('removes an active configuration line', () => {
      const input = [
        'CONFIG_ZMK_DISPLAY=y',
        'CONFIG_ZMK_IDLE_TIMEOUT=60000',
        'CONFIG_SCYAN_BONGO=y',
      ].join('\n');

      const res = removeKconfigSetting(input, 'CONFIG_ZMK_IDLE_TIMEOUT');
      expect(res.changed).toBe(true);
      expect(res.updated).not.toContain('CONFIG_ZMK_IDLE_TIMEOUT');
      expect(res.updated).toContain('CONFIG_ZMK_DISPLAY=y');
      expect(res.updated).toContain('CONFIG_SCYAN_BONGO=y');
    });

    it('removes a commented-out configuration line', () => {
      const input = [
        'CONFIG_ZMK_DISPLAY=y',
        '# CONFIG_ZMK_IDLE_TIMEOUT=60000',
        'CONFIG_SCYAN_BONGO=y',
      ].join('\n');

      const res = removeKconfigSetting(input, 'CONFIG_ZMK_IDLE_TIMEOUT');
      expect(res.changed).toBe(true);
      expect(res.updated).not.toContain('CONFIG_ZMK_IDLE_TIMEOUT');
    });

    it('removes a commented-out "is not set" line', () => {
      const input = [
        'CONFIG_ZMK_DISPLAY=y',
        '# CONFIG_ZMK_IDLE_TIMEOUT is not set',
        'CONFIG_SCYAN_BONGO=y',
      ].join('\n');

      const res = removeKconfigSetting(input, 'CONFIG_ZMK_IDLE_TIMEOUT');
      expect(res.changed).toBe(true);
      expect(res.updated).not.toContain('CONFIG_ZMK_IDLE_TIMEOUT');
    });

    it('reports no change if the setting is absent', () => {
      const input = 'CONFIG_ZMK_DISPLAY=y\nCONFIG_SCYAN_BONGO=y\n';
      const res = removeKconfigSetting(input, 'CONFIG_ZMK_IDLE_TIMEOUT');
      expect(res.changed).toBe(false);
      expect(res.updated).toBe(input);
    });

    it('preserves unrelated comments mentioning the setting name', () => {
      const input = [
        '# Note: CONFIG_ZMK_IDLE_TIMEOUT is configured below',
        'CONFIG_ZMK_IDLE_TIMEOUT=60000',
      ].join('\n');

      const res = removeKconfigSetting(input, 'CONFIG_ZMK_IDLE_TIMEOUT');
      expect(res.changed).toBe(true);
      expect(res.updated).toContain('# Note: CONFIG_ZMK_IDLE_TIMEOUT is configured below');
      expect(res.updated).not.toContain('CONFIG_ZMK_IDLE_TIMEOUT=60000');
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

    it('handles base conf with asymmetric timeout without creating phantom right conf', () => {
      const confFiles = [
        {
          path: 'config/corne.conf',
          content: 'CONFIG_ZMK_DISPLAY=y\nCONFIG_ZMK_IDLE_TIMEOUT=60000\n',
        },
      ];

      const updates = resolveConfUpdates(confFiles, {
        screenOffTimeoutSec: 45,
        rightScreenOffTimeoutSec: 25,
        symmetricSettings: false,
      });

      expect(updates.some(u => u.path === 'config/corne_right.conf')).toBe(false);
      expect(updates).toHaveLength(1);
      expect(updates[0].path).toBe('config/corne.conf');
      expect(updates[0].content).toContain('CONFIG_ZMK_IDLE_TIMEOUT=45000');
    });

    it('strips CONFIG_ZMK_IDLE_TIMEOUT from base conf when side-specific conf files are present', () => {
      const confFiles = [
        {
          path: 'config/corne.conf',
          content: 'CONFIG_ZMK_DISPLAY=y\nCONFIG_ZMK_IDLE_TIMEOUT=60000\nCONFIG_SCYAN_BONGO=y\n',
        },
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
        screenOffTimeoutSec: 60,
        rightScreenOffTimeoutSec: 25,
        symmetricSettings: false,
      });

      // corne_right.conf updated to 25000
      // corne.conf has CONFIG_ZMK_IDLE_TIMEOUT stripped to prevent overriding right in ZMK
      const rightUpdate = updates.find(u => u.path === 'config/corne_right.conf');
      const baseUpdate = updates.find(u => u.path === 'config/corne.conf');
      const leftUpdate = updates.find(u => u.path === 'config/corne_left.conf');

      expect(leftUpdate).toBeUndefined(); // already 60000
      expect(rightUpdate?.content).toContain('CONFIG_ZMK_IDLE_TIMEOUT=25000');
      expect(baseUpdate?.content).not.toContain('CONFIG_ZMK_IDLE_TIMEOUT');
      expect(baseUpdate?.content).toContain('CONFIG_ZMK_DISPLAY=y');
      expect(baseUpdate?.content).toContain('CONFIG_SCYAN_BONGO=y');
    });

    it('strips CONFIG_ZMK_IDLE_TIMEOUT from base conf when displayAssignments are present', () => {
      const confFiles = [
        {
          path: 'config/corne.conf',
          content: 'CONFIG_ZMK_DISPLAY=y\nCONFIG_ZMK_IDLE_TIMEOUT=60000\n',
        },
        {
          path: 'config/corne_left.conf',
          content: 'CONFIG_ZMK_IDLE_TIMEOUT=60000\n',
        },
        {
          path: 'config/corne_right.conf',
          content: 'CONFIG_ZMK_IDLE_TIMEOUT=60000\n',
        },
      ];

      const updates = resolveConfTimeoutUpdates(
        confFiles,
        {
          screenOffTimeoutSec: 60,
          rightScreenOffTimeoutSec: 25,
          symmetricSettings: false,
        },
        {
          displayAssignments: {
            corne_left: 'central',
            corne_right: 'peripheral',
          },
        }
      );

      const rightUpdate = updates.find(u => u.path === 'config/corne_right.conf');
      const baseUpdate = updates.find(u => u.path === 'config/corne.conf');

      expect(rightUpdate?.content).toContain('CONFIG_ZMK_IDLE_TIMEOUT=25000');
      expect(baseUpdate?.content).not.toContain('CONFIG_ZMK_IDLE_TIMEOUT');
    });

    it('updates unhandled side confs with default side timeouts and strips base confs when only one side is assigned', () => {
      const confFiles = [
        {
          path: 'config/corne.conf',
          content: 'CONFIG_ZMK_DISPLAY=y\nCONFIG_ZMK_IDLE_TIMEOUT=60000\n',
        },
        {
          path: 'config/corne_left.conf',
          content: 'CONFIG_ZMK_IDLE_TIMEOUT=60000\n',
        },
        {
          path: 'config/corne_right.conf',
          content: 'CONFIG_ZMK_IDLE_TIMEOUT=60000\n',
        },
      ];

      const updates = resolveConfTimeoutUpdates(
        confFiles,
        {
          screenOffTimeoutSec: 60,
          rightScreenOffTimeoutSec: 25,
          symmetricSettings: false,
        },
        {
          displayAssignments: {
            corne_left: 'central',
          },
        }
      );

      const rightUpdate = updates.find(u => u.path === 'config/corne_right.conf');
      const baseUpdate = updates.find(u => u.path === 'config/corne.conf');

      expect(rightUpdate?.content).toContain('CONFIG_ZMK_IDLE_TIMEOUT=25000');
      expect(baseUpdate?.content).not.toContain('CONFIG_ZMK_IDLE_TIMEOUT');
    });

    it('directly maps shields with mounted displays to their display screenOffTimeoutSec', () => {
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

      const updates = resolveConfTimeoutUpdates(
        confFiles,
        {
          screenOffTimeoutSec: 40,
          symmetricSettings: false,
        },
        {
          displayAssignments: {
            corne_left: 'display-1',
            corne_right: 'display-2',
          },
          displays: {
            'display-1': {
              id: 'display-1',
              name: 'Left',
              dimensions: { width: 32, height: 128 },
              rotation: 90,
              blocks: [],
              idleBlocks: [],
              idleTimeoutSec: 30,
              screenOffTimeoutSec: 40,
              idleScreensEnabled: true,
            },
            'display-2': {
              id: 'display-2',
              name: 'Right',
              dimensions: { width: 32, height: 128 },
              rotation: 90,
              blocks: [],
              idleBlocks: [],
              idleTimeoutSec: 15,
              screenOffTimeoutSec: 15,
              idleScreensEnabled: true,
            },
          },
        }
      );

      expect(updates).toHaveLength(2);
      expect(updates.find(u => u.path === 'config/corne_left.conf')?.content).toContain('CONFIG_ZMK_IDLE_TIMEOUT=40000');
      expect(updates.find(u => u.path === 'config/corne_right.conf')?.content).toContain('CONFIG_ZMK_IDLE_TIMEOUT=15000');
    });
  });

  describe('injectOrUpdateOverlay', () => {
    it('creates a brand new overlay with delimited markers from empty content', () => {
      const result = injectOrUpdateOverlay('', 'display_1_active');
      expect(result).toBe(formatScyanOverlayBlock('display_1_active') + '\n');
      expect(result).toContain(SCYAN_STUDIO_MARKER_BEGIN);
      expect(result).toContain('#include "scyan_layouts.dtsi"');
      expect(result).toContain('scyan,display-layout = &display_1_active;');
      expect(result).toContain(SCYAN_STUDIO_MARKER_END);
      expect(result.startsWith(SCYAN_STUDIO_MARKER_BEGIN)).toBe(true);
      expect(result.endsWith(SCYAN_STUDIO_MARKER_END + '\n')).toBe(true);
    });

    it('appends markers to an existing overlay containing other nodes without altering those nodes', () => {
      const existingOverlay = [
        '#include <dt-bindings/zmk/matrix_transform.h>',
        '',
        '/ {',
        '    chosen {',
        '        zmk,kscan = &kscan0;',
        '    };',
        '};',
        '',
        '&pro_micro_i2c {',
        '    status = "okay";',
        '    oled: ssd1306@3c {',
        '        compatible = "solomon,ssd1306fb";',
        '        reg = <0x3c>;',
        '        width = <128>;',
        '        height = <32>;',
        '    };',
        '};',
      ].join('\n');

      const result = injectOrUpdateOverlay(existingOverlay, 'display_1_active');

      // The original user nodes must be preserved at the top verbatim
      expect(result.startsWith(existingOverlay.trim())).toBe(true);
      // The delimited Scyan block must be appended at the bottom
      expect(result).toContain(SCYAN_STUDIO_MARKER_BEGIN);
      expect(result).toContain('#include "scyan_layouts.dtsi"');
      expect(result).toContain('scyan,display-layout = &display_1_active;');
      expect(result).toContain(SCYAN_STUDIO_MARKER_END);
      // Confirm all original user nodes are intact
      expect(result).toContain('zmk,kscan = &kscan0;');
      expect(result).toContain('&pro_micro_i2c');
      expect(result).toContain('oled: ssd1306@3c');
    });

    it('updates an existing overlay that already has markers in-place without altering code outside markers', () => {
      const existingContent = [
        '#include <dt-bindings/zmk/matrix_transform.h>',
        '',
        '/ {',
        '    chosen {',
        '        zmk,kscan = &kscan0;',
        '    };',
        '};',
        '',
        SCYAN_STUDIO_MARKER_BEGIN,
        '#include "scyan_layouts.dtsi"',
        '',
        '/ {',
        '    chosen {',
        '        scyan,display-layout = &display_1_active;',
        '    };',
        '};',
        SCYAN_STUDIO_MARKER_END,
        '',
        '&spi0 {',
        '    status = "okay";',
        '};',
      ].join('\n');

      const result = injectOrUpdateOverlay(existingContent, 'display_2_active');

      // Header before marker must be identical
      const prefixBeforeMarker = existingContent.slice(0, existingContent.indexOf(SCYAN_STUDIO_MARKER_BEGIN));
      expect(result.startsWith(prefixBeforeMarker)).toBe(true);

      // Trailing code after marker must be identical
      const suffixAfterMarker = existingContent.slice(existingContent.indexOf(SCYAN_STUDIO_MARKER_END) + SCYAN_STUDIO_MARKER_END.length);
      expect(result.endsWith(suffixAfterMarker)).toBe(true);

      // Layout binding must be cleanly updated
      expect(result).toContain('scyan,display-layout = &display_2_active;');
      expect(result).not.toContain('display_1_active');

      // Verify no duplicates
      const beginMatches = result.match(new RegExp(SCYAN_STUDIO_MARKER_BEGIN.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'));
      expect(beginMatches).toHaveLength(1);
    });

    it('upgrades a pure legacy un-delimited overlay into delimited markers', () => {
      const legacyPure = [
        '#include "scyan_layouts.dtsi"',
        '',
        '/ {',
        '    chosen {',
        '        scyan,display-layout = <&display_1_active>;',
        '    };',
        '};',
      ].join('\n');

      const result = injectOrUpdateOverlay(legacyPure, 'display_2_active');

      expect(result).toBe(formatScyanOverlayBlock('display_2_active') + '\n');
      expect(result).toContain(SCYAN_STUDIO_MARKER_BEGIN);
      expect(result).toContain('scyan,display-layout = &display_2_active;');
      expect(result).not.toContain('&display_1_active');
      expect(result.match(/scyan,display-layout/g)).toHaveLength(1);
      expect(result.match(/#include "scyan_layouts\.dtsi"/g)).toHaveLength(1);
    });

    it('upgrades a mixed legacy un-delimited overlay and cleans up conflicting directives', () => {
      const legacyMixed = [
        '#include <dt-bindings/zmk/matrix_transform.h>',
        '#include "scyan_layouts.dtsi"',
        '',
        '/ {',
        '    chosen {',
        '        zmk,kscan = &kscan0;',
        '        scyan,display-layout = <&display_1_active>;',
        '    };',
        '    &spi0 {',
        '        status = "okay";',
        '    };',
        '};',
      ].join('\n');

      const result = injectOrUpdateOverlay(legacyMixed, 'display_2_active');

      // User configurations must be preserved
      expect(result).toContain('#include <dt-bindings/zmk/matrix_transform.h>');
      expect(result).toContain('zmk,kscan = &kscan0;');
      expect(result).toContain('&spi0');

      // Scyan must now be isolated in the delimited marker block
      expect(result).toContain(SCYAN_STUDIO_MARKER_BEGIN);
      expect(result).toContain(SCYAN_STUDIO_MARKER_END);
      expect(result).toContain('scyan,display-layout = &display_2_active;');

      // Old directives must be removed without duplication
      expect(result).not.toContain('&display_1_active');
      expect(result.match(/#include "scyan_layouts\.dtsi"/g)).toHaveLength(1);
      expect(result.match(/scyan,display-layout/g)).toHaveLength(1);
    });

    it('handles layoutRef syntax variations (&name, name, <&name>) uniformly', () => {
      const r1 = injectOrUpdateOverlay('', 'display_1_active');
      const r2 = injectOrUpdateOverlay('', '&display_1_active');
      const r3 = injectOrUpdateOverlay('', '<&display_1_active>');

      expect(r1).toContain('scyan,display-layout = &display_1_active;');
      expect(r2).toContain('scyan,display-layout = &display_1_active;');
      expect(r3).toContain('scyan,display-layout = &display_1_active;');
      expect(r1).toBe(r2);
      expect(r1).toBe(r3);
    });

    it('cleanLegacyScyanOverlay removes empty chosen and root blocks when only Scyan directives were present', () => {
      const legacyPure = [
        '#include "scyan_layouts.dtsi"',
        '',
        '/ {',
        '    chosen {',
        '        scyan,display-layout = <&display_1_active>;',
        '    };',
        '};',
      ].join('\n');

      expect(cleanLegacyScyanOverlay(legacyPure)).toBe('');
    });

    it('handles trailing comments and CRLF line endings in legacy Scyan cleanup', () => {
      const legacyWithCommentsAndCrlf = [
        '#include <dt-bindings/zmk/matrix_transform.h>',
        '#include "scyan_layouts.dtsi" /* Scyan layouts include */',
        '',
        '/ {',
        '    chosen {',
        '        zmk,kscan = &kscan0;',
        '        scyan,display-layout = &display_1_active; /* active display layout */',
        '    };',
        '};',
      ].join('\r\n');

      const result = injectOrUpdateOverlay(legacyWithCommentsAndCrlf, 'display_2_active');
      expect(result).not.toContain('/* active display layout */');
      expect(result).not.toContain('/* Scyan layouts include */');
      expect(result).toContain('zmk,kscan = &kscan0;');
      expect(result).toContain(SCYAN_STUDIO_MARKER_BEGIN);
      expect(result).toContain('scyan,display-layout = &display_2_active;');
    });

    it('cleans up legacy standalone /chosen { scyan,display-layout = ...; }; nodes', () => {
      const legacyStandaloneChosen = [
        '#include "scyan_layouts.dtsi"',
        '',
        '/chosen {',
        '    scyan,display-layout = &display_1_active;',
        '};',
      ].join('\n');

      const result = injectOrUpdateOverlay(legacyStandaloneChosen, 'display_2_active');
      expect(result).toBe(formatScyanOverlayBlock('display_2_active') + '\n');
    });

    it('does not greedily match beyond the marker closing delimiter when inline comments follow', () => {
      const content = [
        SCYAN_STUDIO_MARKER_BEGIN + ' /* inline comment after begin */',
        '#include "scyan_layouts.dtsi"',
        '',
        '/ {',
        '    chosen {',
        '        scyan,display-layout = &display_1_active;',
        '    };',
        '};',
        SCYAN_STUDIO_MARKER_END + ' /* inline comment after end */',
      ].join('\n');

      const result = injectOrUpdateOverlay(content, 'display_2_active');
      expect(result).toContain(SCYAN_STUDIO_MARKER_BEGIN);
      expect(result).toContain('scyan,display-layout = &display_2_active;');
      expect(result).toContain(SCYAN_STUDIO_MARKER_END);
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

  describe('injectScyanIntoWest', () => {
    it('creates default west.yml content if empty', () => {
      const res = injectScyanIntoWest('');
      expect(res).toContain('name: scyan-zmk-module');
      expect(res).toContain('name: brunowb');
      expect(res).toContain('url-base: https://github.com/BrunoWB');
    });

    it('injects brunowb remote and scyan-zmk-module project while preserving comments and other projects', () => {
      const west = [
        'manifest:',
        '  remotes:',
        '    # Primary remote',
        '    - name: zmkfirmware',
        '      url-base: https://github.com/zmkfirmware',
        '  projects:',
        '    - name: zmk',
        '      remote: zmkfirmware',
        '      import: app/west.yml',
        '  self:',
        '    path: config',
      ].join('\n');

      const res = injectScyanIntoWest(west);
      expect(res).toContain('name: scyan-zmk-module');
      expect(res).toContain('remote: brunowb');
      expect(res).toContain('revision: main');
      expect(res).toContain('name: brunowb');
      expect(res).toContain('url-base: https://github.com/BrunoWB');
      expect(res).toContain('# Primary remote');
      expect(res).toContain('name: zmk');
      expect(res).toContain('self:');
    });

    it('does not duplicate remote or project if already present', () => {
      const west = [
        'manifest:',
        '  remotes:',
        '    - name: brunowb',
        '      url-base: https://github.com/BrunoWB',
        '  projects:',
        '    - name: scyan-zmk-module',
        '      remote: brunowb',
        '      revision: main',
      ].join('\n');

      const res = injectScyanIntoWest(west);
      const brunowbMatches = res.match(/name:\s*brunowb/g) || [];
      const moduleMatches = res.match(/name:\s*scyan-zmk-module/g) || [];
      expect(brunowbMatches.length).toBe(1);
      expect(moduleMatches.length).toBe(1);
    });

    it('injects custom targetRevision such as nightly when specified', () => {
      const emptyRes = injectScyanIntoWest('', 'nightly');
      expect(emptyRes).toContain('revision: nightly');

      const existingWest = [
        'manifest:',
        '  projects:',
        '    - name: zmk',
        '      remote: zmkfirmware',
      ].join('\n');
      const res = injectScyanIntoWest(existingWest, 'nightly');
      expect(res).toContain('revision: nightly');
    });

    it('updates existing module revision if targetRevision is provided', () => {
      const westWithMain = [
        'manifest:',
        '  projects:',
        '    - name: scyan-zmk-module',
        '      remote: brunowb',
        '      revision: main',
      ].join('\n');
      const res = injectScyanIntoWest(westWithMain, 'nightly');
      expect(res).toContain('revision: nightly');
      expect(res).not.toContain('revision: main');
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
      const msg = 'Update: spritesheets & screen layouts';
      expect(formatStudioCommitMessage(msg)).toBe(`[Scyan Studio] ${msg}`);
    });

    it('does not double-prefix if already starts with [Scyan Studio]', () => {
      const msg = '[Scyan Studio] Uninstall: module & assets';
      expect(formatStudioCommitMessage(msg)).toBe(msg);
    });

    it('trims whitespace and prepends prefix cleanly', () => {
      const msg = '  Install: module & starter assets  ';
      expect(formatStudioCommitMessage(msg)).toBe('[Scyan Studio] Install: module & starter assets');
    });

    it('exports the standard prefix constant [Scyan Studio] ', () => {
      expect(STUDIO_COMMIT_PREFIX).toBe('[Scyan Studio] ');
    });
  });

  describe('Delimited Scyan .conf blocks', () => {
    describe('formatScyanConfBlock', () => {
      it('formats key-value settings between Scyan conf markers', () => {
        const block = formatScyanConfBlock({
          CONFIG_ZMK_IDLE_TIMEOUT: 25000,
          CONFIG_SCYAN_INVERT: true,
          CONFIG_SCYAN_TEST: false,
        });

        expect(block).toContain(SCYAN_CONF_MARKER_BEGIN);
        expect(block).toContain('CONFIG_ZMK_IDLE_TIMEOUT=25000');
        expect(block).toContain('CONFIG_SCYAN_INVERT=y');
        expect(block).toContain('CONFIG_SCYAN_TEST=n');
        expect(block).toContain(SCYAN_CONF_MARKER_END);
      });

      it('includes display defaults when includeDisplayDefaults is true', () => {
        const block = formatScyanConfBlock(
          { CONFIG_ZMK_IDLE_TIMEOUT: 60000 },
          { includeDisplayDefaults: true }
        );

        expect(block).toContain('CONFIG_ZMK_DISPLAY=y');
        expect(block).toContain('CONFIG_ZMK_DISPLAY_WORK_QUEUE_DEDICATED=y');
        expect(block).toContain('CONFIG_ZMK_DISPLAY_STATUS_SCREEN_CUSTOM=y');
        expect(block).toContain('CONFIG_ZMK_DISPLAY_STATUS_SCREEN_BUILT_IN=n');
        expect(block).toContain('CONFIG_LV_USE_CANVAS=y');
        expect(block).toContain('CONFIG_LV_USE_IMG=y');
        expect(block).toContain('CONFIG_SCYAN_INVERT=y');
        expect(block).toContain('CONFIG_ZMK_IDLE_TIMEOUT=60000');
      });
    });

    describe('injectOrUpdateConfBlock', () => {
      it('creates a conf block in an empty conf file', () => {
        const block = formatScyanConfBlock({ CONFIG_ZMK_IDLE_TIMEOUT: 30000 });
        const res = injectOrUpdateConfBlock('', block);

        expect(res).toBe(`${block}\n`);
      });

      it('creates a conf block in a pre-existing conf file preserving user settings', () => {
        const existing = [
          '# User Bluetooth setting',
          'CONFIG_BT_CTLR_TX_PWR_PLUS_8=y',
          'CONFIG_ZMK_KEYBOARD_NAME="Corne"',
        ].join('\n');

        const block = formatScyanConfBlock({ CONFIG_ZMK_IDLE_TIMEOUT: 30000 });
        const res = injectOrUpdateConfBlock(existing, block);

        expect(res).toContain('# User Bluetooth setting');
        expect(res).toContain('CONFIG_BT_CTLR_TX_PWR_PLUS_8=y');
        expect(res).toContain('CONFIG_ZMK_KEYBOARD_NAME="Corne"');
        expect(res).toContain(block);
        expect(res.endsWith(`${block}\n`)).toBe(true);
      });

      it('updates an existing conf block without altering surrounding user settings', () => {
        const initial = [
          '# Header comment',
          'CONFIG_USER_A=y',
          '',
          '# === SCYAN-STUDIO:BEGIN (DO NOT EDIT) ===',
          'CONFIG_ZMK_IDLE_TIMEOUT=60000',
          '# === SCYAN-STUDIO:END ===',
          '',
          '# Footer comment',
          'CONFIG_USER_B=y',
        ].join('\n');

        const newBlock = formatScyanConfBlock({ CONFIG_ZMK_IDLE_TIMEOUT: 25000 });
        const res = injectOrUpdateConfBlock(initial, newBlock);

        expect(res).toContain('# Header comment');
        expect(res).toContain('CONFIG_USER_A=y');
        expect(res).toContain('CONFIG_ZMK_IDLE_TIMEOUT=25000');
        expect(res).not.toContain('CONFIG_ZMK_IDLE_TIMEOUT=60000');
        expect(res).toContain('# Footer comment');
        expect(res).toContain('CONFIG_USER_B=y');
      });

      it('removes block when given an empty block string', () => {
        const existing = [
          'CONFIG_USER=y',
          '',
          '# === SCYAN-STUDIO:BEGIN (DO NOT EDIT) ===',
          'CONFIG_ZMK_IDLE_TIMEOUT=60000',
          '# === SCYAN-STUDIO:END ===',
        ].join('\n');

        const res = injectOrUpdateConfBlock(existing, '');
        expect(res).toBe('CONFIG_USER=y\n');
        expect(res).not.toContain('SCYAN-STUDIO');
      });
    });

    describe('cleanLegacyScyanConf and migrateLegacyConfToBlock', () => {
      it('removes legacy un-delimited Scyan configs while leaving user configs', () => {
        const legacy = [
          '# User config',
          'CONFIG_ZMK_KEYBOARD_NAME="Corne"',
          '',
          '# Custom status screen (Scyan ZMK Display Module)',
          'CONFIG_ZMK_DISPLAY_STATUS_SCREEN_CUSTOM=y',
          'CONFIG_ZMK_DISPLAY_STATUS_SCREEN_BUILT_IN=n',
          'CONFIG_LV_USE_CANVAS=y',
          'CONFIG_LV_USE_IMG=y',
          'CONFIG_SCYAN_INVERT=y',
          '',
          '# More user configs',
          'CONFIG_ZMK_SLEEP=y',
        ].join('\n');

        const cleaned = cleanLegacyScyanConf(legacy);

        expect(cleaned).toContain('# User config');
        expect(cleaned).toContain('CONFIG_ZMK_KEYBOARD_NAME="Corne"');
        expect(cleaned).toContain('# More user configs');
        expect(cleaned).toContain('CONFIG_ZMK_SLEEP=y');
        expect(cleaned).not.toContain('CONFIG_SCYAN_INVERT');
        expect(cleaned).not.toContain('CONFIG_ZMK_DISPLAY_STATUS_SCREEN_CUSTOM');
        expect(cleaned).not.toContain('CONFIG_LV_USE_CANVAS');
      });

      it('migrates legacy un-delimited Scyan configs into a delimited block', () => {
        const legacy = [
          'CONFIG_ZMK_KEYBOARD_NAME="Corne"',
          'CONFIG_ZMK_DISPLAY_STATUS_SCREEN_CUSTOM=y',
          'CONFIG_SCYAN_INVERT=y',
          'CONFIG_ZMK_SLEEP=y',
        ].join('\n');

        const { updated, changed } = migrateLegacyConfToBlock(legacy);

        expect(changed).toBe(true);
        expect(updated).toContain('CONFIG_ZMK_KEYBOARD_NAME="Corne"');
        expect(updated).toContain('CONFIG_ZMK_SLEEP=y');
        expect(updated).toContain(SCYAN_CONF_MARKER_BEGIN);
        expect(updated).toContain('CONFIG_ZMK_DISPLAY_STATUS_SCREEN_CUSTOM=y');
        expect(updated).toContain('CONFIG_SCYAN_INVERT=y');
        expect(updated).toContain(SCYAN_CONF_MARKER_END);
      });

      it('consolidates legacy Scyan settings outside an existing block into the block', () => {
        const content = [
          'CONFIG_USER_A=y',
          'CONFIG_SCYAN_BONGO=y',
          '',
          '# === SCYAN-STUDIO:BEGIN (DO NOT EDIT) ===',
          'CONFIG_ZMK_DISPLAY_STATUS_SCREEN_CUSTOM=y',
          '# === SCYAN-STUDIO:END ===',
          '',
          'CONFIG_USER_B=y',
        ].join('\n');

        const { updated, changed } = migrateLegacyConfToBlock(content);

        expect(changed).toBe(true);
        expect(updated).toContain('CONFIG_USER_A=y');
        expect(updated).toContain('CONFIG_USER_B=y');
        expect(updated).toContain(SCYAN_CONF_MARKER_BEGIN);
        expect(updated).toContain('CONFIG_ZMK_DISPLAY_STATUS_SCREEN_CUSTOM=y');
        expect(updated).toContain('CONFIG_SCYAN_BONGO=y');
        expect(updated).toContain(SCYAN_CONF_MARKER_END);
        // Ensure outside has no duplicate legacy flags
        const outside = updated.split(SCYAN_CONF_BLOCK_REGEX).join('');
        expect(outside).not.toContain('CONFIG_SCYAN_BONGO');
      });

      it('reports no change if block exists and there are no legacy settings outside', () => {
        const content = [
          'CONFIG_USER=y',
          '',
          '# === SCYAN-STUDIO:BEGIN (DO NOT EDIT) ===',
          'CONFIG_ZMK_DISPLAY_STATUS_SCREEN_CUSTOM=y',
          '# === SCYAN-STUDIO:END ===',
        ].join('\n');

        const { updated, changed } = migrateLegacyConfToBlock(content);
        expect(changed).toBe(false);
        expect(updated).toBe(content);
      });
    });

    describe('removeScyanFromConf with delimited block', () => {
      it('cleanly removes delimited Scyan block and preserves user settings', () => {
        const conf = [
          '# User settings',
          'CONFIG_ZMK_DISPLAY=y',
          'CONFIG_SSD1306=y',
          '',
          '# === SCYAN-STUDIO:BEGIN (DO NOT EDIT) ===',
          'CONFIG_ZMK_DISPLAY_STATUS_SCREEN_CUSTOM=y',
          'CONFIG_LV_USE_CANVAS=y',
          'CONFIG_SCYAN_INVERT=y',
          'CONFIG_ZMK_IDLE_TIMEOUT=30000',
          '# === SCYAN-STUDIO:END ===',
          '',
          'CONFIG_ZMK_KSCAN_DEBOUNCE_PRESS_MS=1',
        ].join('\n');

        const res = removeScyanFromConf(conf);

        expect(res).not.toContain('SCYAN-STUDIO');
        expect(res).not.toContain('CONFIG_SCYAN_INVERT');
        expect(res).not.toContain('CONFIG_ZMK_DISPLAY_STATUS_SCREEN_CUSTOM');
        expect(res).not.toContain('CONFIG_LV_USE_CANVAS');
        expect(res).toContain('CONFIG_ZMK_DISPLAY=y');
        expect(res).toContain('CONFIG_SSD1306=y');
        expect(res).toContain('CONFIG_ZMK_KSCAN_DEBOUNCE_PRESS_MS=1');
      });

      it('returns empty string when conf only contains Scyan block', () => {
        const conf = [
          '# === SCYAN-STUDIO:BEGIN (DO NOT EDIT) ===',
          'CONFIG_ZMK_DISPLAY_STATUS_SCREEN_CUSTOM=y',
          'CONFIG_SCYAN_INVERT=y',
          '# === SCYAN-STUDIO:END ===',
        ].join('\n');

        const res = removeScyanFromConf(conf);
        expect(res).toBe('');
      });
    });

    describe('updateConfTimeoutSetting and removeConfTimeoutSetting', () => {
      it('injects timeout into a new delimited block while preserving user settings', () => {
        const conf = [
          '# User configuration',
          'CONFIG_ZMK_WPM=y',
        ].join('\n');

        const { updated, changed } = updateConfTimeoutSetting(conf, 30000);

        expect(changed).toBe(true);
        expect(updated).toContain('# User configuration');
        expect(updated).toContain('CONFIG_ZMK_WPM=y');
        expect(updated).toContain(SCYAN_CONF_MARKER_BEGIN);
        expect(updated).toContain('CONFIG_ZMK_IDLE_TIMEOUT=30000');
        expect(updated).toContain(SCYAN_CONF_MARKER_END);
      });

      it('updates timeout inside existing block without altering outside settings', () => {
        const conf = [
          '# Header',
          'CONFIG_USER=y',
          '',
          '# === SCYAN-STUDIO:BEGIN (DO NOT EDIT) ===',
          'CONFIG_ZMK_DISPLAY_STATUS_SCREEN_CUSTOM=y',
          'CONFIG_ZMK_IDLE_TIMEOUT=60000',
          '# === SCYAN-STUDIO:END ===',
          '',
          '# Footer',
        ].join('\n');

        const { updated, changed } = updateConfTimeoutSetting(conf, 20000);

        expect(changed).toBe(true);
        expect(updated).toContain('# Header');
        expect(updated).toContain('CONFIG_USER=y');
        expect(updated).toContain('CONFIG_ZMK_DISPLAY_STATUS_SCREEN_CUSTOM=y');
        expect(updated).toContain('CONFIG_ZMK_IDLE_TIMEOUT=20000');
        expect(updated).not.toContain('CONFIG_ZMK_IDLE_TIMEOUT=60000');
        expect(updated).toContain('# Footer');
      });

      it('migrates legacy un-delimited Scyan flags and timeout into the block', () => {
        const conf = [
          'CONFIG_USER=y',
          'CONFIG_SCYAN_INVERT=y',
          'CONFIG_ZMK_IDLE_TIMEOUT=60000',
        ].join('\n');

        const { updated, changed } = updateConfTimeoutSetting(conf, 25000);

        expect(changed).toBe(true);
        expect(updated).toContain('CONFIG_USER=y');
        expect(updated).toContain(SCYAN_CONF_MARKER_BEGIN);
        expect(updated).toContain('CONFIG_SCYAN_INVERT=y');
        expect(updated).toContain('CONFIG_ZMK_IDLE_TIMEOUT=25000');
        expect(updated).toContain(SCYAN_CONF_MARKER_END);
        // Ensure outside has no legacy timeout or Scyan flag
        const linesOutside = updated.split(SCYAN_CONF_BLOCK_REGEX).join('');
        expect(linesOutside).not.toContain('CONFIG_SCYAN_INVERT');
        expect(linesOutside).not.toContain('CONFIG_ZMK_IDLE_TIMEOUT');
      });

      it('removes timeout from block while preserving other block settings', () => {
        const conf = [
          'CONFIG_USER=y',
          '',
          '# === SCYAN-STUDIO:BEGIN (DO NOT EDIT) ===',
          'CONFIG_ZMK_DISPLAY_STATUS_SCREEN_CUSTOM=y',
          'CONFIG_ZMK_IDLE_TIMEOUT=60000',
          '# === SCYAN-STUDIO:END ===',
        ].join('\n');

        const { updated, changed } = removeConfTimeoutSetting(conf);

        expect(changed).toBe(true);
        expect(updated).toContain('CONFIG_USER=y');
        expect(updated).toContain(SCYAN_CONF_MARKER_BEGIN);
        expect(updated).toContain('CONFIG_ZMK_DISPLAY_STATUS_SCREEN_CUSTOM=y');
        expect(updated).not.toContain('CONFIG_ZMK_IDLE_TIMEOUT');
        expect(updated).toContain(SCYAN_CONF_MARKER_END);
      });

      it('removes entire block when timeout was the only setting in it', () => {
        const conf = [
          'CONFIG_USER=y',
          '',
          '# === SCYAN-STUDIO:BEGIN (DO NOT EDIT) ===',
          'CONFIG_ZMK_IDLE_TIMEOUT=60000',
          '# === SCYAN-STUDIO:END ===',
        ].join('\n');

        const { updated, changed } = removeConfTimeoutSetting(conf);

        expect(changed).toBe(true);
        expect(updated).toBe('CONFIG_USER=y\n');
        expect(updated).not.toContain('SCYAN-STUDIO');
      });

      it('migrates legacy un-delimited Scyan flags into a block when removing timeout', () => {
        const conf = [
          '# Display',
          'CONFIG_ZMK_DISPLAY=y',
          '',
          '# Custom status screen (Scyan ZMK Display Module)',
          'CONFIG_ZMK_DISPLAY_STATUS_SCREEN_CUSTOM=y',
          'CONFIG_LV_USE_CANVAS=y',
          'CONFIG_SCYAN_INVERT=y',
          'CONFIG_ZMK_IDLE_TIMEOUT=60000',
        ].join('\n');

        const { updated, changed } = removeConfTimeoutSetting(conf);

        expect(changed).toBe(true);
        expect(updated).toContain('# Display');
        expect(updated).toContain('CONFIG_ZMK_DISPLAY=y');
        expect(updated).toContain(SCYAN_CONF_MARKER_BEGIN);
        expect(updated).toContain('CONFIG_ZMK_DISPLAY_STATUS_SCREEN_CUSTOM=y');
        expect(updated).toContain('CONFIG_LV_USE_CANVAS=y');
        expect(updated).toContain('CONFIG_SCYAN_INVERT=y');
        expect(updated).toContain(SCYAN_CONF_MARKER_END);
        expect(updated).not.toContain('CONFIG_ZMK_IDLE_TIMEOUT');
      });

      it('consolidates legacy Scyan flags outside block when removing timeout', () => {
        const conf = [
          'CONFIG_USER=y',
          'CONFIG_SCYAN_BONGO=y',
          '',
          '# === SCYAN-STUDIO:BEGIN (DO NOT EDIT) ===',
          'CONFIG_ZMK_DISPLAY_STATUS_SCREEN_CUSTOM=y',
          'CONFIG_ZMK_IDLE_TIMEOUT=60000',
          '# === SCYAN-STUDIO:END ===',
        ].join('\n');

        const { updated, changed } = removeConfTimeoutSetting(conf);

        expect(changed).toBe(true);
        expect(updated).toContain('CONFIG_USER=y');
        expect(updated).toContain(SCYAN_CONF_MARKER_BEGIN);
        expect(updated).toContain('CONFIG_ZMK_DISPLAY_STATUS_SCREEN_CUSTOM=y');
        expect(updated).toContain('CONFIG_SCYAN_BONGO=y');
        expect(updated).not.toContain('CONFIG_ZMK_IDLE_TIMEOUT');
        expect(updated).toContain(SCYAN_CONF_MARKER_END);
        const outside = updated.split(SCYAN_CONF_BLOCK_REGEX).join('');
        expect(outside).not.toContain('CONFIG_SCYAN_BONGO');
      });
    });

    describe('asymmetric split keyboard timeout synchronization with conf blocks', () => {
      it('synchronizes asymmetric timeouts into blocks and strips timeout from base conf', () => {
        const confFiles = [
          {
            path: 'config/corne.conf',
            content: [
              '# Enable display',
              'CONFIG_ZMK_DISPLAY=y',
              '',
              '# === SCYAN-STUDIO:BEGIN (DO NOT EDIT) ===',
              'CONFIG_ZMK_DISPLAY_STATUS_SCREEN_CUSTOM=y',
              'CONFIG_ZMK_IDLE_TIMEOUT=60000',
              '# === SCYAN-STUDIO:END ===',
            ].join('\n'),
          },
          {
            path: 'config/corne_left.conf',
            content: [
              '# Left half specific',
              'CONFIG_ZMK_WPM=y',
              '',
              '# === SCYAN-STUDIO:BEGIN (DO NOT EDIT) ===',
              'CONFIG_ZMK_IDLE_TIMEOUT=60000',
              '# === SCYAN-STUDIO:END ===',
            ].join('\n'),
          },
          {
            path: 'config/corne_right.conf',
            content: [
              '# === SCYAN-STUDIO:BEGIN (DO NOT EDIT) ===',
              'CONFIG_ZMK_IDLE_TIMEOUT=60000',
              '# === SCYAN-STUDIO:END ===',
            ].join('\n'),
          },
        ];

        const updates = resolveConfTimeoutUpdates(confFiles, {
          screenOffTimeoutSec: 60,
          rightScreenOffTimeoutSec: 25,
          symmetricSettings: false,
        });

        // Left already 60000, so only right and base conf need updates
        const leftUpdate = updates.find((u) => u.path === 'config/corne_left.conf');
        const rightUpdate = updates.find((u) => u.path === 'config/corne_right.conf');
        const baseUpdate = updates.find((u) => u.path === 'config/corne.conf');

        expect(leftUpdate).toBeUndefined();

        expect(rightUpdate).toBeDefined();
        expect(rightUpdate?.content).toContain(SCYAN_CONF_MARKER_BEGIN);
        expect(rightUpdate?.content).toContain('CONFIG_ZMK_IDLE_TIMEOUT=25000');
        expect(rightUpdate?.content).toContain(SCYAN_CONF_MARKER_END);

        expect(baseUpdate).toBeDefined();
        // Base conf must keep display configuration inside block
        expect(baseUpdate?.content).toContain(SCYAN_CONF_MARKER_BEGIN);
        expect(baseUpdate?.content).toContain('CONFIG_ZMK_DISPLAY_STATUS_SCREEN_CUSTOM=y');
        // Base conf must NOT have CONFIG_ZMK_IDLE_TIMEOUT inside or outside block
        expect(baseUpdate?.content).not.toContain('CONFIG_ZMK_IDLE_TIMEOUT');
        expect(baseUpdate?.content).toContain(SCYAN_CONF_MARKER_END);
        expect(baseUpdate?.content).toContain('CONFIG_ZMK_DISPLAY=y');
      });

      it('migrates legacy un-delimited base conf into block and strips timeout during split sync', () => {
        const confFiles = [
          {
            path: 'config/corne.conf',
            content: [
              'CONFIG_ZMK_DISPLAY=y',
              'CONFIG_ZMK_DISPLAY_STATUS_SCREEN_CUSTOM=y',
              'CONFIG_LV_USE_CANVAS=y',
              'CONFIG_SCYAN_INVERT=y',
              'CONFIG_ZMK_IDLE_TIMEOUT=60000',
            ].join('\n'),
          },
          {
            path: 'config/corne_left.conf',
            content: 'CONFIG_ZMK_IDLE_TIMEOUT=60000\n',
          },
          {
            path: 'config/corne_right.conf',
            content: 'CONFIG_ZMK_IDLE_TIMEOUT=60000\n',
          },
        ];

        const updates = resolveConfTimeoutUpdates(confFiles, {
          screenOffTimeoutSec: 60,
          rightScreenOffTimeoutSec: 25,
          symmetricSettings: false,
        });

        const baseUpdate = updates.find((u) => u.path === 'config/corne.conf');
        expect(baseUpdate).toBeDefined();
        expect(baseUpdate?.content).toContain('CONFIG_ZMK_DISPLAY=y');
        expect(baseUpdate?.content).toContain(SCYAN_CONF_MARKER_BEGIN);
        expect(baseUpdate?.content).toContain('CONFIG_ZMK_DISPLAY_STATUS_SCREEN_CUSTOM=y');
        expect(baseUpdate?.content).toContain('CONFIG_LV_USE_CANVAS=y');
        expect(baseUpdate?.content).toContain('CONFIG_SCYAN_INVERT=y');
        expect(baseUpdate?.content).not.toContain('CONFIG_ZMK_IDLE_TIMEOUT');
        expect(baseUpdate?.content).toContain(SCYAN_CONF_MARKER_END);
      });
    });
  });
});


import { describe, it, expect } from 'vitest';
import YAML from 'yaml';
import {
  generateKconfigShield,
  generateKconfigDefconfig,
  generateShieldOverlay,
  generateZephyrModule,
  generateShieldFiles,
  getShieldFilePaths,
  normalizeSlot,
  extractSlotId,
  SCYAN_SHIELD_DIR,
  SCYAN_SHIELD_FILE_PATHS,
  LEGACY_SHIELD_FILE_PATHS,
  ZEPHYR_MODULE_PATH,
} from '../shieldService';

describe('shieldService', () => {
  describe('constants & paths', () => {
    it('defines correct paths for shield directory and zephyr module', () => {
      expect(SCYAN_SHIELD_DIR).toBe('boards/shields/scyan_screen');
      expect(ZEPHYR_MODULE_PATH).toBe('zephyr/module.yml');
    });

    it('defines standard default shield file paths including slots 1 and 2', () => {
      expect(SCYAN_SHIELD_FILE_PATHS).toEqual([
        'boards/shields/scyan_screen/Kconfig.shield',
        'boards/shields/scyan_screen/Kconfig.defconfig',
        'boards/shields/scyan_screen/scyan_screen.overlay',
        'boards/shields/scyan_screen/scyan_screen_1.overlay',
        'boards/shields/scyan_screen/scyan_screen_2.overlay',
        'boards/shields/scyan_screen/scyan_layouts.dtsi',
        'boards/shields/scyan_screen/scyan_symbols.dtsi',
      ]);
      expect(LEGACY_SHIELD_FILE_PATHS).toEqual([
        'boards/shields/scyan_screen/scyan_screen_left.overlay',
        'boards/shields/scyan_screen/scyan_screen_right.overlay',
      ]);
    });

    it('dynamically generates shield file paths for arbitrary N slots via getShieldFilePaths', () => {
      const paths1 = getShieldFilePaths([1]);
      expect(paths1).toContain('boards/shields/scyan_screen/scyan_screen_1.overlay');
      expect(paths1).not.toContain('boards/shields/scyan_screen/scyan_screen_2.overlay');

      const paths3 = getShieldFilePaths([1, 2, 3]);
      expect(paths3).toContain('boards/shields/scyan_screen/scyan_screen_1.overlay');
      expect(paths3).toContain('boards/shields/scyan_screen/scyan_screen_2.overlay');
      expect(paths3).toContain('boards/shields/scyan_screen/scyan_screen_3.overlay');
    });

    it('extractSlotId and normalizeSlot normalize string roles and display identifiers cleanly', () => {
      expect(extractSlotId('display-1')).toBe('1');
      expect(extractSlotId('display_2')).toBe('2');
      expect(extractSlotId('central')).toBe('1');
      expect(extractSlotId('peripheral')).toBe('2');
      expect(extractSlotId('left')).toBe('1');
      expect(extractSlotId('right')).toBe('2');
      expect(extractSlotId('display-3')).toBe('3');

      expect(normalizeSlot('central')).toEqual({
        slotNum: 1,
        configSuffix: '1',
        shieldName: 'scyan_screen_1',
        fileName: 'scyan_screen_1.overlay',
      });
      expect(normalizeSlot('peripheral')).toEqual({
        slotNum: 2,
        configSuffix: '2',
        shieldName: 'scyan_screen_2',
        fileName: 'scyan_screen_2.overlay',
      });
    });
  });

  describe('generateKconfigShield', () => {
    it('declares default shield symbol and slots 1 and 2 when no args provided', () => {
      const content = generateKconfigShield();
      expect(content).toContain('config SHIELD_SCYAN_SCREEN');
      expect(content).toContain('def_bool $(shields_list_contains,scyan_screen)');
      expect(content).not.toContain('SHIELD_SCYAN_SCREEN_LEFT');
      expect(content).not.toContain('SHIELD_SCYAN_SCREEN_RIGHT');
      expect(content).toContain('config SHIELD_SCYAN_SCREEN_1');
      expect(content).toContain('def_bool $(shields_list_contains,scyan_screen_1)');
      expect(content).toContain('config SHIELD_SCYAN_SCREEN_2');
      expect(content).toContain('def_bool $(shields_list_contains,scyan_screen_2)');
    });

    it('declares single-screen slot 1 without slot 2', () => {
      const content = generateKconfigShield([1]);
      expect(content).toContain('config SHIELD_SCYAN_SCREEN_1');
      expect(content).toContain('def_bool $(shields_list_contains,scyan_screen_1)');
      expect(content).not.toContain('SHIELD_SCYAN_SCREEN_LEFT');
      expect(content).not.toContain('SHIELD_SCYAN_SCREEN_RIGHT');
      expect(content).not.toContain('config SHIELD_SCYAN_SCREEN_2');
    });

    it('declares multi-screen slots (3+ screens) dynamically', () => {
      const content = generateKconfigShield([1, 2, 3, 4]);
      expect(content).toContain('config SHIELD_SCYAN_SCREEN_1');
      expect(content).toContain('config SHIELD_SCYAN_SCREEN_2');
      expect(content).toContain('config SHIELD_SCYAN_SCREEN_3');
      expect(content).toContain('def_bool $(shields_list_contains,scyan_screen_3)');
      expect(content).toContain('config SHIELD_SCYAN_SCREEN_4');
      expect(content).toContain('def_bool $(shields_list_contains,scyan_screen_4)');
      expect(content).not.toContain('SHIELD_SCYAN_SCREEN_LEFT');
      expect(content).not.toContain('SHIELD_SCYAN_SCREEN_RIGHT');
    });
  });

  describe('generateKconfigDefconfig', () => {
    it('produces valid defconfig block guarded by all declared shield symbols by default', () => {
      const content = generateKconfigDefconfig();
      expect(content).toContain('if SHIELD_SCYAN_SCREEN || SHIELD_SCYAN_SCREEN_1 || SHIELD_SCYAN_SCREEN_2');
      expect(content).not.toContain('SHIELD_SCYAN_SCREEN_LEFT');
      expect(content).not.toContain('SHIELD_SCYAN_SCREEN_RIGHT');
      expect(content).toContain('endif');
    });

    it('produces guard condition for 1-screen configuration', () => {
      const content = generateKconfigDefconfig([1]);
      expect(content).toContain('if SHIELD_SCYAN_SCREEN || SHIELD_SCYAN_SCREEN_1');
      expect(content).not.toContain('SHIELD_SCYAN_SCREEN_2');
      expect(content).toContain('endif');
    });

    it('produces guard condition for 3+ screen configurations', () => {
      const content = generateKconfigDefconfig([1, 2, 3]);
      expect(content).toContain('if SHIELD_SCYAN_SCREEN || SHIELD_SCYAN_SCREEN_1 || SHIELD_SCYAN_SCREEN_2 || SHIELD_SCYAN_SCREEN_3');
      expect(content).toContain('endif');
    });
  });

  describe('generateShieldOverlay', () => {
    it('binds chosen layout node cleanly without angle brackets', () => {
      const ov1 = generateShieldOverlay(1);
      expect(ov1).toContain('#include "scyan_layouts.dtsi"');
      expect(ov1).toContain('scyan,display-layout = &display_1_active;');

      const ov2 = generateShieldOverlay(2);
      expect(ov2).toContain('scyan,display-layout = &display_2_active;');

      const ov3 = generateShieldOverlay(3);
      expect(ov3).toContain('scyan,display-layout = &display_3_active;');
    });

    it('handles explicit node name formatting and normalizes string inputs', () => {
      const ov = generateShieldOverlay('display_custom_active');
      expect(ov).toContain('scyan,display-layout = &display_custom_active;');

      const ovDisplayDash = generateShieldOverlay('display-1');
      expect(ovDisplayDash).toContain('scyan,display-layout = &display_1_active;');

      const ovDisplayUnderscore = generateShieldOverlay('display_2');
      expect(ovDisplayUnderscore).toContain('scyan,display-layout = &display_2_active;');

      const ovCentral = generateShieldOverlay('central');
      expect(ovCentral).toContain('scyan,display-layout = &display_1_active;');

      const ovPeripheral = generateShieldOverlay('peripheral');
      expect(ovPeripheral).toContain('scyan,display-layout = &display_2_active;');
    });
  });

  describe('generateZephyrModule', () => {
    it('generates standard zephyr/module.yml when no existing file present', () => {
      const content = generateZephyrModule();
      const parsed = YAML.parse(content);
      expect(parsed.build.settings.board_root).toBe('.');
    });

    it('preserves existing settings and injects board_root: . if absent', () => {
      const existing = `
name: custom-user-config
build:
  cmake: CMakeLists.txt
  settings:
    snippet_root: snippets
`;
      const content = generateZephyrModule(existing);
      const parsed = YAML.parse(content);
      expect(parsed.name).toBe('custom-user-config');
      expect(parsed.build.cmake).toBe('CMakeLists.txt');
      expect(parsed.build.settings.snippet_root).toBe('snippets');
      expect(parsed.build.settings.board_root).toBe('.');
    });
  });

  describe('generateShieldFiles', () => {
    it('generates all 7 default shield files for 2-screen setups in boards/shields/scyan_screen/', () => {
      const files = generateShieldFiles({
        layoutsDtsiContent: '/* layouts */',
        symbolsDtsiContent: '/* symbols */',
      });

      expect(files).toHaveLength(7);
      const paths = files.map(f => f.path);
      expect(paths).toEqual(SCYAN_SHIELD_FILE_PATHS);

      const unibodyOverlay = files.find(f => f.path === `${SCYAN_SHIELD_DIR}/scyan_screen.overlay`);
      expect(unibodyOverlay?.content).toContain('&display_1_active;');

      const screen1Overlay = files.find(f => f.path === `${SCYAN_SHIELD_DIR}/scyan_screen_1.overlay`);
      expect(screen1Overlay?.content).toContain('&display_1_active;');

      const screen2Overlay = files.find(f => f.path === `${SCYAN_SHIELD_DIR}/scyan_screen_2.overlay`);
      expect(screen2Overlay?.content).toContain('&display_2_active;');

      expect(files.find(f => f.path === `${SCYAN_SHIELD_DIR}/scyan_screen_left.overlay`)).toBeUndefined();
      expect(files.find(f => f.path === `${SCYAN_SHIELD_DIR}/scyan_screen_right.overlay`)).toBeUndefined();

      const layoutsFile = files.find(f => f.path === `${SCYAN_SHIELD_DIR}/scyan_layouts.dtsi`);
      expect(layoutsFile?.content).toBe('/* layouts */');
    });

    it('generates 1-screen configuration correctly with slot 1', () => {
      const files = generateShieldFiles({
        layoutsDtsiContent: '/* layouts */',
        symbolsDtsiContent: '/* symbols */',
        displays: {
          'display-1': { id: 'display-1', name: 'Primary Screen' },
        },
      });

      expect(files).toHaveLength(6);
      const paths = files.map(f => f.path);
      expect(paths).toContain(`${SCYAN_SHIELD_DIR}/scyan_screen.overlay`);
      expect(paths).toContain(`${SCYAN_SHIELD_DIR}/scyan_screen_1.overlay`);
      expect(paths).not.toContain(`${SCYAN_SHIELD_DIR}/scyan_screen_2.overlay`);
      expect(paths).not.toContain(`${SCYAN_SHIELD_DIR}/scyan_screen_left.overlay`);
      expect(paths).not.toContain(`${SCYAN_SHIELD_DIR}/scyan_screen_right.overlay`);

      const kconfigShield = files.find(f => f.path === `${SCYAN_SHIELD_DIR}/Kconfig.shield`);
      expect(kconfigShield?.content).toContain('config SHIELD_SCYAN_SCREEN_1');
      expect(kconfigShield?.content).not.toContain('config SHIELD_SCYAN_SCREEN_2');

      const kconfigDefconfig = files.find(f => f.path === `${SCYAN_SHIELD_DIR}/Kconfig.defconfig`);
      expect(kconfigDefconfig?.content).toContain('if SHIELD_SCYAN_SCREEN || SHIELD_SCYAN_SCREEN_1\n');
    });

    it('generates 3+ screen configurations dynamically', () => {
      const files = generateShieldFiles({
        layoutsDtsiContent: '/* layouts */',
        symbolsDtsiContent: '/* symbols */',
        displays: {
          'display-1': { id: 'display-1', name: 'Screen 1' },
          'display-2': { id: 'display-2', name: 'Screen 2' },
          'display-3': { id: 'display-3', name: 'Screen 3' },
        },
      });

      expect(files).toHaveLength(8);
      const paths = files.map(f => f.path);
      expect(paths).toContain(`${SCYAN_SHIELD_DIR}/scyan_screen_1.overlay`);
      expect(paths).toContain(`${SCYAN_SHIELD_DIR}/scyan_screen_2.overlay`);
      expect(paths).toContain(`${SCYAN_SHIELD_DIR}/scyan_screen_3.overlay`);

      const screen3Overlay = files.find(f => f.path === `${SCYAN_SHIELD_DIR}/scyan_screen_3.overlay`);
      expect(screen3Overlay?.content).toContain('&display_3_active;');

      const kconfigShield = files.find(f => f.path === `${SCYAN_SHIELD_DIR}/Kconfig.shield`);
      expect(kconfigShield?.content).toContain('config SHIELD_SCYAN_SCREEN_3');

      const kconfigDefconfig = files.find(f => f.path === `${SCYAN_SHIELD_DIR}/Kconfig.defconfig`);
      expect(kconfigDefconfig?.content).toContain('SHIELD_SCYAN_SCREEN_3');
    });

    it('extracts slots from custom displayAssignments and generates numbered overlays', () => {
      const files = generateShieldFiles({
        layoutsDtsiContent: '/* layouts */',
        symbolsDtsiContent: '/* symbols */',
        displayAssignments: {
          corne_left: 'display-2',
          corne_right: 'display-1',
          dongle: 'display-3',
        },
      });

      expect(files).toHaveLength(8);
      const paths = files.map(f => f.path);
      expect(paths).toContain(`${SCYAN_SHIELD_DIR}/scyan_screen_1.overlay`);
      expect(paths).toContain(`${SCYAN_SHIELD_DIR}/scyan_screen_2.overlay`);
      expect(paths).toContain(`${SCYAN_SHIELD_DIR}/scyan_screen_3.overlay`);

      const screen1Overlay = files.find(f => f.path === `${SCYAN_SHIELD_DIR}/scyan_screen_1.overlay`);
      expect(screen1Overlay?.content).toContain('&display_1_active;');

      const screen2Overlay = files.find(f => f.path === `${SCYAN_SHIELD_DIR}/scyan_screen_2.overlay`);
      expect(screen2Overlay?.content).toContain('&display_2_active;');

      const screen3Overlay = files.find(f => f.path === `${SCYAN_SHIELD_DIR}/scyan_screen_3.overlay`);
      expect(screen3Overlay?.content).toContain('&display_3_active;');
    });
  });
});

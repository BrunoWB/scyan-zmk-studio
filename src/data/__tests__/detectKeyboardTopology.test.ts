import { describe, it, expect } from 'vitest';
import {
  detectKeyboardTopology,
  detectSideFromShieldName,
  isAccessoryShield,
} from '../shieldsData';

describe('detectKeyboardTopology & Deterministic Detection Pipeline', () => {
  describe('Strict word-boundary token matching (Tier 3)', () => {
    it('correctly classifies unibodies with substrings of side names', () => {
      // "leftover30" has "left" as substring, but word boundary \b(left)\b must NOT match it
      expect(detectSideFromShieldName('leftover30')).toBe('single');
      expect(detectSideFromShieldName('reviung41')).toBe('single');
      expect(detectSideFromShieldName('le_petite')).toBe('single');
      expect(detectSideFromShieldName('myunibody')).toBe('single');
    });

    it('correctly classifies true split side tokens with hyphens or underscores', () => {
      expect(detectSideFromShieldName('corne_left')).toBe('left');
      expect(detectSideFromShieldName('corne-left')).toBe('left');
      expect(detectSideFromShieldName('corne_right')).toBe('right');
      expect(detectSideFromShieldName('corne-right')).toBe('right');
      expect(detectSideFromShieldName('three_parts_dongle')).toBe('dongle');
      expect(detectSideFromShieldName('three-parts-dongle')).toBe('dongle');
      expect(detectSideFromShieldName('split_central')).toBe('left');
      expect(detectSideFromShieldName('split-central')).toBe('left');
      expect(detectSideFromShieldName('split_peripheral')).toBe('right');
      expect(detectSideFromShieldName('split-peripheral')).toBe('right');
    });
  });

  describe('Accessory shield tokenization & filtering (Tier 1)', () => {
    it('identifies and filters accessory shields', () => {
      expect(isAccessoryShield('nice_view')).toBe(true);
      expect(isAccessoryShield('nice-view')).toBe(true);
      expect(isAccessoryShield('nice_view_adapter')).toBe(true);
      expect(isAccessoryShield('nice_oled')).toBe(true);
      expect(isAccessoryShield('settings_reset')).toBe(true);
      expect(isAccessoryShield('settings-reset')).toBe(true);
      expect(isAccessoryShield('oled')).toBe(true);

      // Base shields are not accessories
      expect(isAccessoryShield('corne_left')).toBe(false);
      expect(isAccessoryShield('three_parts_dongle')).toBe(false);
      expect(isAccessoryShield('myunibody')).toBe(false);
    });

    it('tokenizes compound shield targets and isolates base keyboard shield', () => {
      const buildYaml = `---
include:
  - board: nice_nano_v2
    shield: corne_left nice_view_adapter nice_view
  - board: nice_nano_v2
    shield: corne_right nice_view
`;
      const topo = detectKeyboardTopology({ buildYamlContent: buildYaml });
      expect(topo.type).toBe('split-pair');
      expect(topo.units).toHaveLength(2);
      expect(topo.units.map(u => u.id)).toEqual(['corne_left', 'corne_right']);
      expect(topo.displayAssignments['corne_left']).toBe('display-1');
      expect(topo.displayAssignments['corne_right']).toBe('display-2');
      expect(topo.displays['display-1']).toBeDefined();
      expect(topo.displays['display-2']).toBeDefined();
    });
  });

  describe('Deep Kconfig & Conf Inspection (Tier 2)', () => {
    it('detects reversible split right half as central coordinator via build.yaml cmake-args', () => {
      const buildYaml = `---
include:
  - board: nice_nano_v2
    shield: cradio_left
    cmake-args: -DCONFIG_ZMK_SPLIT_ROLE_CENTRAL=n
  - board: nice_nano_v2
    shield: cradio_right
    cmake-args: -DCONFIG_ZMK_SPLIT_ROLE_CENTRAL=y
`;
      const topo = detectKeyboardTopology({ buildYamlContent: buildYaml });
      expect(topo.units).toHaveLength(2);
      const right = topo.units.find(u => u.id === 'cradio-right');
      const left = topo.units.find(u => u.id === 'cradio-left');
      expect(right?.isMaster).toBe(true);
      expect(left?.isMaster).toBe(false);
      expect(topo.centralRole).toBe('right');
    });

    it('detects right half as central coordinator via .conf file contents', () => {
      const confContents = {
        'config/cradio.conf': '# Base config\nCONFIG_ZMK_DISPLAY=y\n',
        'config/cradio_right.conf': '# Right central coordinator\nCONFIG_ZMK_SPLIT_ROLE_CENTRAL=y\n',
      };
      const topo = detectKeyboardTopology({
        primaryShieldId: 'cradio',
        candidateConfFiles: Object.keys(confContents),
        confFileContents: confContents,
      });
      const right = topo.units.find(u => u.id === 'cradio-right' || u.id === 'cradio_right');
      expect(right?.isMaster).toBe(true);
    });

    it('detects shields configured with CONFIG_ZMK_DISPLAY=n as headless', () => {
      const buildYaml = `---
include:
  - board: seeeduino_xiao_ble
    shield: custom_dongle
    cmake-args: -DCONFIG_ZMK_DISPLAY=n
  - board: nice_nano_v2
    shield: custom_left
  - board: nice_nano_v2
    shield: custom_right
`;
      const topo = detectKeyboardTopology({ buildYamlContent: buildYaml });
      expect(topo.type).toBe('dongle-split');
      expect(topo.displayAssignments['custom-dongle']).toBeNull();
      expect(topo.displayAssignments['custom-left']).toBe('display-1');
      expect(topo.displayAssignments['custom-right']).toBe('display-2');
    });
  });

  describe('Saved Metadata Lock (Tier 0 Authority)', () => {
    it('preserves user display assignments and displays from saved metadata', () => {
      const savedMetadata = {
        version: 2,
        shieldId: 'corne',
        shields: [
          { id: 'corne_left', name: 'Corne Left', side: 'left' as const, isMaster: false, shield: {} as any },
          { id: 'corne_right', name: 'Corne Right', side: 'right' as const, isMaster: true, shield: {} as any },
        ],
        displayAssignments: {
          corne_left: 'display-2',
          corne_right: 'display-1',
        },
        displays: {
          'display-1': {
            id: 'display-1',
            name: 'Screen A',
            dimensions: { width: 32, height: 128 },
            rotation: 90 as const,
            blocks: [],
            idleBlocks: [],
            idleTimeoutSec: 40,
            screenOffTimeoutSec: 80,
            idleScreensEnabled: true,
          },
          'display-2': {
            id: 'display-2',
            name: 'Screen B',
            dimensions: { width: 32, height: 128 },
            rotation: 270 as const,
            blocks: [],
            idleBlocks: [],
            idleTimeoutSec: 15,
            screenOffTimeoutSec: 30,
            idleScreensEnabled: false,
          },
        },
      };

      const topo = detectKeyboardTopology({
        primaryShieldId: 'corne',
        metadata: savedMetadata,
      });

      expect(topo.displayAssignments['corne_left']).toBe('display-2');
      expect(topo.displayAssignments['corne_right']).toBe('display-1');
      expect(topo.displays['display-1'].name).toBe('Screen A');
      expect(topo.displays['display-2'].name).toBe('Screen B');
    });

    it('respects saved metadata displays even when shields array is omitted', () => {
      const savedMetadataWithoutShields = {
        version: 2,
        shieldId: 'corne',
        displays: {
          'display-1': {
            id: 'display-1',
            name: 'Custom Primary Screen',
            dimensions: { width: 32, height: 128 },
            rotation: 90 as const,
            blocks: [],
            idleBlocks: [],
            idleTimeoutSec: 45,
            screenOffTimeoutSec: 90,
            idleScreensEnabled: true,
          },
        },
      };

      const topo = detectKeyboardTopology({
        primaryShieldId: 'corne',
        metadata: savedMetadataWithoutShields,
      });

      expect(topo.displays['display-1']).toBeDefined();
      expect(topo.displays['display-1'].name).toBe('Custom Primary Screen');
      expect(topo.units.length).toBeGreaterThanOrEqual(1);
    });
  });
});

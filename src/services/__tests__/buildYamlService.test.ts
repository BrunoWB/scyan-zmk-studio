import { describe, it, expect } from 'vitest';
import YAML from 'yaml';
import {
  isCartesianMatrix,
  convertCartesianToInclude,
  determineScyanShieldToken,
  updateShieldTokens,
  removeShieldTokens,
  addScyanShieldToBuildYaml,
  removeScyanShieldFromBuildYaml,
  SCYAN_SHIELD_TOKEN_REGEX,
} from '../buildYamlService';

describe('buildYamlService', () => {
  describe('constants & regex', () => {
    it('matches all Scyan shield token variations', () => {
      expect(SCYAN_SHIELD_TOKEN_REGEX.test('scyan_screen')).toBe(true);
      expect(SCYAN_SHIELD_TOKEN_REGEX.test('scyan_screen_1')).toBe(true);
      expect(SCYAN_SHIELD_TOKEN_REGEX.test('scyan_screen_2')).toBe(true);
      expect(SCYAN_SHIELD_TOKEN_REGEX.test('scyan_screen_3')).toBe(true);
      expect(SCYAN_SHIELD_TOKEN_REGEX.test('scyan_screen_10')).toBe(true);
      expect(SCYAN_SHIELD_TOKEN_REGEX.test('scyan_screen_left')).toBe(true);
      expect(SCYAN_SHIELD_TOKEN_REGEX.test('scyan_screen_right')).toBe(true);
      expect(SCYAN_SHIELD_TOKEN_REGEX.test('scyan_screen_custom')).toBe(true);

      expect(SCYAN_SHIELD_TOKEN_REGEX.test('corne_left')).toBe(false);
      expect(SCYAN_SHIELD_TOKEN_REGEX.test('corne_right')).toBe(false);
      expect(SCYAN_SHIELD_TOKEN_REGEX.test('settings_reset')).toBe(false);
      expect(SCYAN_SHIELD_TOKEN_REGEX.test('nice_view')).toBe(false);
    });
  });

  describe('isCartesianMatrix', () => {
    it('detects Cartesian matrix when board or shield arrays are present at top level', () => {
      const cartesian1 = `
board:
  - nice_nano_v2
shield:
  - corne_left
  - corne_right
`;
      expect(isCartesianMatrix(cartesian1)).toBe(true);

      const cartesianInline = `
board: [ "nice_nano" ]
shield: [ "corne_left", "corne_right" ]
`;
      expect(isCartesianMatrix(cartesianInline)).toBe(true);
    });

    it('returns false for explicit include format', () => {
      const includeOnly = `
include:
  - board: nice_nano_v2
    shield: corne_left
  - board: nice_nano_v2
    shield: corne_right
`;
      expect(isCartesianMatrix(includeOnly)).toBe(false);
    });

    it('handles empty or invalid content gracefully', () => {
      expect(isCartesianMatrix('')).toBe(false);
      expect(isCartesianMatrix('   ')).toBe(false);
      expect(isCartesianMatrix('# only comments\n')).toBe(false);
    });
  });

  describe('convertCartesianToInclude', () => {
    it('losslessly converts simple Cartesian matrix to include format', () => {
      const input = `
board:
  - nice_nano_v2
shield:
  - corne_left
  - corne_right
`;
      const output = convertCartesianToInclude(input);
      expect(isCartesianMatrix(output)).toBe(false);

      const parsed = YAML.parse(output);
      expect(parsed.include).toEqual([
        { board: 'nice_nano_v2', shield: 'corne_left' },
        { board: 'nice_nano_v2', shield: 'corne_right' },
      ]);
    });

    it('converts multi-board and multi-shield combinations', () => {
      const input = `
board:
  - nice_nano
  - seeeduino_xiao_ble
shield:
  - corne_left
  - corne_right
`;
      const output = convertCartesianToInclude(input);
      const parsed = YAML.parse(output);
      expect(parsed.include).toHaveLength(4);
      expect(parsed.include).toEqual([
        { board: 'nice_nano', shield: 'corne_left' },
        { board: 'nice_nano', shield: 'corne_right' },
        { board: 'seeeduino_xiao_ble', shield: 'corne_left' },
        { board: 'seeeduino_xiao_ble', shield: 'corne_right' },
      ]);
    });

    it('preserves existing include items and merges Cartesian overlaps', () => {
      const input = `
board:
  - nice_nano_v2
shield:
  - corne_left
  - corne_right
include:
  - board: nice_nano_v2
    shield: corne_left
    snippet: studio-rpc-usb-uart
    cmake-args: -DCONFIG_ZMK_STUDIO=y
  - board: bdn9_rev2
`;
      const output = convertCartesianToInclude(input);
      const parsed = YAML.parse(output);
      expect(parsed.include).toHaveLength(3);

      const left = parsed.include.find((i: any) => i.shield === 'corne_left');
      expect(left).toBeDefined();
      expect(left.snippet).toBe('studio-rpc-usb-uart');
      expect(left['cmake-args']).toBe('-DCONFIG_ZMK_STUDIO=y');

      const bdn9 = parsed.include.find((i: any) => i.board === 'bdn9_rev2');
      expect(bdn9).toBeDefined();
    });

    it('preserves top-level comments and formatting', () => {
      const input = `
# Header Comment for actions matrix
board: [ "nice_nano" ]
shield: [ "corne_left" ]
# Footer Comment
`;
      const output = convertCartesianToInclude(input);
      expect(output).toContain('# Header Comment for actions matrix');
      expect(output).toContain('# Footer Comment');
      expect(output).toContain('include:');
    });
  });

  describe('determineScyanShieldToken', () => {
    it('detects canonical scyan_screen_1 token for corne_left, split_left, etc.', () => {
      expect(determineScyanShieldToken('corne_left')).toBe('scyan_screen_1');
      expect(determineScyanShieldToken('cradio_left')).toBe('scyan_screen_1');
      expect(determineScyanShieldToken('corne-left')).toBe('scyan_screen_1');
      expect(determineScyanShieldToken('my_keyboard_central')).toBe('scyan_screen_1');
    });

    it('detects canonical scyan_screen_2 token for corne_right, split_right, etc.', () => {
      expect(determineScyanShieldToken('corne_right')).toBe('scyan_screen_2');
      expect(determineScyanShieldToken('cradio_right')).toBe('scyan_screen_2');
      expect(determineScyanShieldToken('corne-right')).toBe('scyan_screen_2');
      expect(determineScyanShieldToken('my_keyboard_peripheral')).toBe('scyan_screen_2');
    });

    it('inverts slot assignments when rightIsCentral is true', () => {
      expect(determineScyanShieldToken('corne_left', { rightIsCentral: true })).toBe('scyan_screen_2');
      expect(determineScyanShieldToken('corne_right', { rightIsCentral: true })).toBe('scyan_screen_1');
    });

    it('returns scyan_screen for unibody boards or shields', () => {
      expect(determineScyanShieldToken('reviung41')).toBe('scyan_screen');
      expect(determineScyanShieldToken('corne')).toBe('scyan_screen');
      expect(determineScyanShieldToken('')).toBe('scyan_screen');
      expect(determineScyanShieldToken(undefined)).toBe('scyan_screen');
    });

    it('respects custom displayAssignments with display-1, display-2, display-3, and null', () => {
      const options = {
        displayAssignments: {
          my_custom_shield: 'display-2',
          my_dongle: null,
          peripheral_3: 'display-3',
          screen_4: 4,
        },
      };
      expect(determineScyanShieldToken('my_custom_shield', options)).toBe('scyan_screen_2');
      expect(determineScyanShieldToken('my_dongle', options)).toBeUndefined();
      expect(determineScyanShieldToken('peripheral_3', options)).toBe('scyan_screen_3');
      expect(determineScyanShieldToken('screen_4', options)).toBe('scyan_screen_4');
    });

    it('matches short role keys (left, right, dongle) in displayAssignments against full shield tokens', () => {
      const options = {
        displayAssignments: {
          left: 'display-2',
          right: 'display-1',
          dongle: 'display-3',
        },
      };
      expect(determineScyanShieldToken('corne_left', options)).toBe('scyan_screen_2');
      expect(determineScyanShieldToken('corne_right', options)).toBe('scyan_screen_1');
      expect(determineScyanShieldToken('corne_dongle', options)).toBe('scyan_screen_3');

      const nullDongleOptions = {
        displayAssignments: {
          dongle: null,
        },
      };
      expect(determineScyanShieldToken('corne_dongle', nullDongleOptions)).toBeUndefined();
    });

    it('returns undefined for non-display utility shields like settings_reset', () => {
      expect(determineScyanShieldToken('settings_reset')).toBeUndefined();
      expect(determineScyanShieldToken('settings_reset scyan_screen_1')).toBeUndefined();
      expect(determineScyanShieldToken('settings_reset scyan_screen_left')).toBeUndefined();
    });
  });

  describe('updateShieldTokens & removeShieldTokens', () => {
    it('appends canonical Scyan token to an existing shield string', () => {
      expect(updateShieldTokens('corne_left', 'scyan_screen_1')).toBe('corne_left scyan_screen_1');
    });

    it('replaces old/legacy Scyan tokens cleanly without duplicating', () => {
      expect(updateShieldTokens('corne_left scyan_screen', 'scyan_screen_1')).toBe('corne_left scyan_screen_1');
      expect(updateShieldTokens('corne_left scyan_screen_left', 'scyan_screen_1')).toBe('corne_left scyan_screen_1');
      expect(updateShieldTokens('corne_left scyan_screen_2', 'scyan_screen_1')).toBe('corne_left scyan_screen_1');
      expect(updateShieldTokens('corne_right scyan_screen_right', 'scyan_screen_2')).toBe('corne_right scyan_screen_2');
      expect(updateShieldTokens('dongle scyan_screen_1', 'scyan_screen_3')).toBe('dongle scyan_screen_3');
    });

    it('removes Scyan tokens and returns undefined if empty', () => {
      expect(removeShieldTokens('corne_left scyan_screen_1')).toBe('corne_left');
      expect(removeShieldTokens('corne_left scyan_screen_left')).toBe('corne_left');
      expect(removeShieldTokens('corne_left scyan_screen_3')).toBe('corne_left');
      expect(removeShieldTokens('scyan_screen')).toBeUndefined();
      expect(removeShieldTokens('scyan_screen_1')).toBeUndefined();
      expect(removeShieldTokens('scyan_screen_left')).toBeUndefined();
      expect(removeShieldTokens('corne_left nice_view scyan_screen_1')).toBe('corne_left nice_view');
    });
  });

  describe('addScyanShieldToBuildYaml', () => {
    it('adds canonical scyan_screen_1 and scyan_screen_2 tokens to existing include format', () => {
      const input = `---
include:
  - board: nice_nano_v2
    shield: corne_left
    snippet: studio-rpc-usb-uart
    cmake-args: -DCONFIG_ZMK_STUDIO=y
  - board: nice_nano_v2
    shield: corne_right
# cache-bust: test
`;
      const output = addScyanShieldToBuildYaml(input);
      expect(output).toContain('shield: corne_left scyan_screen_1');
      expect(output).toContain('shield: corne_right scyan_screen_2');
      expect(output).toContain('snippet: studio-rpc-usb-uart');
      expect(output).toContain('# cache-bust: test');
    });

    it('upgrades legacy scyan_screen_left and scyan_screen_right tokens to canonical slot tokens', () => {
      const input = `---
include:
  - board: nice_nano_v2
    shield: corne_left scyan_screen_left
  - board: nice_nano_v2
    shield: corne_right scyan_screen_right
`;
      const output = addScyanShieldToBuildYaml(input);
      expect(output).toContain('shield: corne_left scyan_screen_1');
      expect(output).toContain('shield: corne_right scyan_screen_2');
      expect(output).not.toContain('scyan_screen_left');
      expect(output).not.toContain('scyan_screen_right');
    });

    it('supports 3+ screen configurations via displayAssignments', () => {
      const input = `---
include:
  - board: nice_nano_v2
    shield: corne_left
  - board: nice_nano_v2
    shield: corne_right
  - board: seeeduino_xiao_ble
    shield: custom_dongle
`;
      const output = addScyanShieldToBuildYaml(input, {
        displayAssignments: {
          corne_left: 'display-1',
          corne_right: 'display-2',
          custom_dongle: 'display-3',
        },
      });
      expect(output).toContain('shield: corne_left scyan_screen_1');
      expect(output).toContain('shield: corne_right scyan_screen_2');
      expect(output).toContain('shield: custom_dongle scyan_screen_3');
    });

    it('does not corrupt settings_reset or standalone board entries', () => {
      const input = `---
include:
  - board: nice_nano_v2
    shield: settings_reset
  - board: planck_rev6
  - board: nice_nano_v2
    shield: corne_left
`;
      const output = addScyanShieldToBuildYaml(input);
      const parsed = YAML.parse(output);
      expect(parsed.include[0].shield).toBe('settings_reset');
      expect(parsed.include[1].shield).toBeUndefined();
      expect(parsed.include[2].shield).toBe('corne_left scyan_screen_1');
    });

    it('auto-converts Cartesian matrix and adds canonical Scyan shields', () => {
      const input = `
board: [ "nice_nano" ]
shield: [ "corne_left", "corne_right" ]
`;
      const output = addScyanShieldToBuildYaml(input);
      expect(isCartesianMatrix(output)).toBe(false);
      const parsed = YAML.parse(output);
      expect(parsed.include).toEqual([
        { board: 'nice_nano', shield: 'corne_left scyan_screen_1' },
        { board: 'nice_nano', shield: 'corne_right scyan_screen_2' },
      ]);
    });
  });

  describe('removeScyanShieldFromBuildYaml', () => {
    it('removes all Scyan tokens (slots and legacy) from include entries', () => {
      const input = `---
include:
  - board: nice_nano_v2
    shield: corne_left scyan_screen_1
  - board: nice_nano_v2
    shield: corne_right scyan_screen_2
  - board: seeeduino_xiao_ble
    shield: custom_dongle scyan_screen_3
  - board: nice_nano_v2
    shield: cradio_left scyan_screen_left
`;
      const output = removeScyanShieldFromBuildYaml(input);
      expect(output).toContain('shield: corne_left');
      expect(output).toContain('shield: corne_right');
      expect(output).toContain('shield: custom_dongle');
      expect(output).toContain('shield: cradio_left');
      expect(output).not.toContain('scyan_screen');
    });

    it('removes shield key entirely if only scyan_screen variant was specified', () => {
      const input = `
include:
  - board: nice_nano_v2
    shield: scyan_screen_1
`;
      const output = removeScyanShieldFromBuildYaml(input);
      const parsed = YAML.parse(output);
      expect(parsed.include[0].shield).toBeUndefined();
    });

    it('cleans compound Scyan shield tokens from top-level Cartesian shield sequence', () => {
      const input = `
board: [ nice_nano ]
shield:
  - corne_left scyan_screen_1
  - corne_right scyan_screen_2
  - scyan_screen_3
`;
      const output = removeScyanShieldFromBuildYaml(input);
      const parsed = YAML.parse(output);
      expect(parsed.shield).toEqual(['corne_left', 'corne_right']);
    });
  });
});

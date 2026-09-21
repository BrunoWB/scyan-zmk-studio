import { describe, it, expect } from 'vitest';
import {
  getShieldUnitsForShield,
  detectShieldUnitsFromRepo,
  extractShieldsFromYaml,
} from '../shieldsData';
import { generateCHeader, parseCHeader } from '../../services/cHeaderParser';
import { BwpxGrid } from '../../bwpx/core/BwpxGrid';

describe('detectShieldUnitsFromRepo & Shield Assignment Pipeline', () => {
  it('returns split shield units for Corne split keyboard', () => {
    const units = getShieldUnitsForShield('corne');
    expect(units).toHaveLength(2);
    expect(units[0].id).toBe('corne_left');
    expect(units[0].name).toBe('Corne (CRKBD) Left');
    expect(units[0].isMaster).toBe(true);

    expect(units[1].id).toBe('corne_right');
    expect(units[1].name).toBe('Corne (CRKBD) Right');
    expect(units[1].isMaster).toBe(false);
  });

  it('detects extra shields from build.yaml and candidate conf files', () => {
    const buildYaml = `
include:
  - board: nice_nano_v2
    shield: corne_left
  - board: nice_nano_v2
    shield: corne_right
  - board: seeed_xiao_ble
    shield: my_custom_dongle
`;
    const confFiles = ['config/corne.conf'];
    const detected = detectShieldUnitsFromRepo('corne', confFiles, undefined, buildYaml);

    expect(detected.length).toBe(3);
    expect(detected.some((u) => u.id === 'corne_left')).toBe(true);
    expect(detected.some((u) => u.id === 'corne_right')).toBe(true);
    expect(detected.some((u) => u.id === 'my-custom-dongle')).toBe(true);
  });

  it('handles shield removal gracefully: identifies removed shield and unassigned display', () => {
    const previousUnits = [
      { id: 'corne_left', shieldId: 'corne', name: 'Corne Left', side: 'left' as const, shield: {} as any },
      { id: 'corne_right', shieldId: 'corne', name: 'Corne Right', side: 'right' as const, shield: {} as any },
      { id: 'my-custom-dongle', shieldId: 'dongle', name: 'Dongle Shield', side: 'dongle' as const, shield: {} as any },
    ];

    const displayAssignments: Record<string, string | null> = {
      corne_left: 'central',
      corne_right: 'peripheral',
      'my-custom-dongle': 'peripheral-2',
    };

    // User deleted the dongle from repo config, so only corne is detected
    const newDetected = detectShieldUnitsFromRepo('corne', ['config/corne.conf']);
    const detectedIds = new Set(newDetected.map((u) => u.id));
    const removedShields = previousUnits.filter((s) => !detectedIds.has(s.id));

    expect(removedShields).toHaveLength(1);
    expect(removedShields[0].id).toBe('my-custom-dongle');

    // Detach display from removed shield
    const nextAssignments = { ...displayAssignments };
    removedShields.forEach((sh) => {
      delete nextAssignments[sh.id];
    });

    expect(nextAssignments['my-custom-dongle']).toBeUndefined();
    // 'peripheral-2' is still in enabledScreens, but no longer in attached displays
    const enabledScreens = ['central', 'peripheral', 'peripheral-2'];
    const attachedDisplays = new Set(Object.values(nextAssignments).filter(Boolean) as string[]);
    const unattachedDisplays = enabledScreens.filter((s) => !attachedDisplays.has(s));

    expect(unattachedDisplays).toEqual(['peripheral-2']);
  });

  it('excludes unattached displays from committed C header metadata', () => {
    const dummyGrid = new BwpxGrid(32, 128);
    const enabledScreens = ['central', 'peripheral', 'peripheral-2'];
    const displayAssignments: Record<string, string | null> = {
      corne_left: 'central',
      corne_right: 'peripheral',
    };

    const attached = new Set(Object.values(displayAssignments).filter(Boolean) as string[]);
    const committedScreens = enabledScreens.filter((s) => attached.has(s));

    const header = generateCHeader(dummyGrid, [], dummyGrid, [], {
      version: 1,
      shieldId: 'corne',
      enabledScreens: committedScreens,
      displayAssignments,
    });

    expect(header).toContain('ZMK_DISPLAY_STUDIO_METADATA');
    const parsed = parseCHeader(header);
    expect(parsed.metadata?.enabledScreens).toEqual(['central', 'peripheral']);
    expect(parsed.metadata?.displayAssignments).toEqual(displayAssignments);
  });

  it('does not inject default primaryShieldId if build.yaml specifies different shields', () => {
    const buildYaml = `
include:
  - board: nice_nano_v2
    shield: sofle_left
  - board: nice_nano_v2
    shield: sofle_right
`;
    const detected = detectShieldUnitsFromRepo('corne', undefined, undefined, buildYaml);

    expect(detected.length).toBe(2);
    expect(detected.every((u) => u.shieldId === 'sofle')).toBe(true);
    expect(detected.some((u) => u.shieldId === 'corne')).toBe(false);
  });

  it('handles user deleting 1 of 3 shields from build.yaml config gracefully', () => {
    // Session 1: Repo has Corne + Tidbit (3 units)
    const initialBuildYaml = `
include:
  - board: nice_nano_v2
    shield: corne_left
  - board: nice_nano_v2
    shield: corne_right
  - board: seeed_xiao_ble
    shield: tidbit
`;
    const session1Shields = detectShieldUnitsFromRepo('corne', undefined, undefined, initialBuildYaml);
    expect(session1Shields).toHaveLength(3);
    expect(session1Shields.map((s) => s.id)).toEqual(['corne_left', 'corne_right', 'tidbit']);

    const displayAssignments: Record<string, string | null> = {
      corne_left: 'central',
      corne_right: 'peripheral',
      tidbit: 'peripheral-2',
    };

    // Session 2: User manually deleted tidbit in GitHub repo
    const updatedBuildYaml = `
include:
  - board: nice_nano_v2
    shield: corne_left
  - board: nice_nano_v2
    shield: corne_right
`;
    const session2Shields = detectShieldUnitsFromRepo('corne', undefined, undefined, updatedBuildYaml);
    expect(session2Shields).toHaveLength(2);
    expect(session2Shields.map((s) => s.id)).toEqual(['corne_left', 'corne_right']);

    // Reconcile
    const detectedIds = new Set(session2Shields.map((s) => s.id));
    const removedShields = session1Shields.filter((s) => !detectedIds.has(s.id));
    expect(removedShields).toHaveLength(1);
    expect(removedShields[0].id).toBe('tidbit');

    const nextAssignments = { ...displayAssignments };
    removedShields.forEach((sh) => {
      delete nextAssignments[sh.id];
    });

    // The display 'peripheral-2' that was on tidbit is now unattached
    const enabledScreens = ['central', 'peripheral', 'peripheral-2'];
    const attachedIds = new Set(Object.values(nextAssignments).filter(Boolean) as string[]);
    const unattached = enabledScreens.filter((s) => !attachedIds.has(s));
    expect(unattached).toEqual(['peripheral-2']);
  });

  it('completely ignores commented-out shields and handles multi-document build.yaml (regression)', () => {
    // Exact structure of user build.yaml with template comments and --- separator
    const buildYaml = `
# This file generates the GitHub Actions matrix.
# board: [ "nice_nano" ]
# shield: [ "corne_left", "corne_right" ]
# include:
#   - board: bdn9_rev2
#   - board: nice_nano
#     shield: reviung41
#   - board: nice_nano
#     shield: corne_left
#     snippet: studio-rpc-usb-uart
#
---
include:
  - board: nice_nano_v2
    shield: corne_left
    snippet: studio-rpc-usb-uart
    cmake-args: -DCONFIG_ZMK_STUDIO=y
  - board: nice_nano_v2
    shield: corne_right
# cache-bust: 2026-09-08-0300
`;
    const tokens = extractShieldsFromYaml(buildYaml);
    expect(tokens).toEqual(['corne_left', 'corne_right']);
    expect(tokens).not.toContain('reviung41');

    const detected = detectShieldUnitsFromRepo('corne', ['config/corne.conf'], undefined, buildYaml);
    expect(detected).toHaveLength(2);
    expect(detected.map((u) => u.id)).toEqual(['corne_left', 'corne_right']);
    expect(detected.some((u) => u.id === 'reviung41')).toBe(false);
  });

  it('extracts shields from top-level matrix arrays and composite space-delimited shield strings', () => {
    const matrixYaml = `
shield:
  - corne_left
  - corne_right
`;
    expect(extractShieldsFromYaml(matrixYaml)).toEqual(['corne_left', 'corne_right']);

    const inlineArrayYaml = `
shield: [ "corne_left", "corne_right" ]
`;
    expect(extractShieldsFromYaml(inlineArrayYaml)).toEqual(['corne_left', 'corne_right']);

    const compositeYaml = `
include:
  - board: nice_nano_v2
    shield: corne_left nice_view_adapter nice_view
`;
    expect(extractShieldsFromYaml(compositeYaml)).toEqual(['corne_left', 'nice_view_adapter', 'nice_view']);
  });
});

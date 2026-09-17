import { describe, it, expect } from 'vitest';
import {
  getShieldUnitsForShield,
  detectShieldUnitsFromRepo,
} from '../shieldsData';
import { generateCHeader, parseCHeader } from '../../services/cHeaderParser';
import { BwpxGrid } from '../../bwpx/core/BwpxGrid';

describe('detectShieldUnitsFromRepo & Shield Assignment Pipeline', () => {
  it('returns split shield units for Corne split keyboard', () => {
    const units = getShieldUnitsForShield('corne');
    expect(units).toHaveLength(2);
    expect(units[0].id).toBe('corne_left');
    expect(units[0].name).toBe('Corne (CRKBD) (Central)');
    expect(units[0].isMaster).toBe(true);

    expect(units[1].id).toBe('corne_right');
    expect(units[1].name).toBe('Corne (CRKBD) (Peripheral)');
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
});

import { describe, it, expect, beforeEach } from 'vitest';
import { TEST_KEYBOARD_CONFIGS } from '../testConfigs';
import { loadTestConfigIntoStudio } from '../loadTestConfig';
import { detectShieldUnitsFromRepo } from '../../data/shieldsData';
import { resolveConfUpdates } from '../../services/githubService';
import { generateCHeader, parseCHeader } from '../../services/cHeaderParser';
import { BwpxGrid } from '../../bwpx/core/BwpxGrid';
import { useLayoutStore } from '../../stores/useLayoutStore';
import { useGitHubStore } from '../../stores/useGitHubStore';

describe('Keyboard Topology Test System & Fixtures', () => {
  beforeEach(() => {
    // Reset stores
    useLayoutStore.setState({
      shieldId: 'corne',
      loadedShields: [],
      displayAssignments: {},
      enabledScreens: ['central', 'peripheral'],
      centralBlocks: [
        { id: 'b1', widgetType: 'layer-banner', name: 'Layer', x: 0, y: 0, width: 32, height: 16, enabled: true, side: 'central' },
      ],
      peripheralBlocks: [
        { id: 'b2', widgetType: 'battery', name: 'Battery', x: 0, y: 0, width: 32, height: 16, enabled: true, side: 'peripheral' },
      ],
      symmetricSettings: false,
      screenOffTimeoutSec: 60,
      peripheralScreenOffTimeoutSec: 25,
    });
    useGitHubStore.setState({
      connection: {
        status: 'disconnected',
        user: null,
        repo: null,
        errorMessage: null,
        lastCheckedAt: null,
        resolvedOwner: null,
        resolvedRepo: null,
      },
      config: { token: '', owner: '', repo: '', branch: 'main' },
    });
  });

  describe('Genteure 3-Parts Split (Dongle + Left + Right)', () => {
    const config = TEST_KEYBOARD_CONFIGS.find((c) => c.id === 'genteure-three-parts')!;

    it('exists in test configurations registry with correct metadata', () => {
      expect(config).toBeDefined();
      expect(config.topology.partsCount).toBe(3);
      expect(config.topology.type).toBe('dongle-split');
      expect(config.topology.displayCount).toBe(3);
      expect(config.topology.centralRole).toBe('dongle');
    });

    it('detects all 3 shield units from build.yaml (fixes previous 2-part truncation bug)', () => {
      const units = detectShieldUnitsFromRepo('unknown', undefined, undefined, config.buildYaml);
      expect(units).toHaveLength(3);

      const dongle = units.find((u) => u.id === 'three-parts-dongle');
      const left = units.find((u) => u.id === 'three-parts-left');
      const right = units.find((u) => u.id === 'three-parts-right');

      expect(dongle).toBeDefined();
      expect(left).toBeDefined();
      expect(right).toBeDefined();

      // Dongle is master coordinator
      expect(dongle?.side).toBe('dongle');
      expect(dongle?.isMaster).toBe(true);

      // Left & right are peripherals
      expect(left?.side).toBe('left');
      expect(left?.isMaster).toBe(false);

      expect(right?.side).toBe('right');
      expect(right?.isMaster).toBe(false);
    });

    it('reconciles 3 shield units and enables 3 screens (central, peripheral, peripheral-2)', () => {
      const ok = loadTestConfigIntoStudio('genteure-three-parts');
      expect(ok).toBe(true);

      const state = useLayoutStore.getState();
      expect(state.loadedShields).toHaveLength(3);
      expect(state.enabledScreens).toContain('central');
      expect(state.enabledScreens).toContain('peripheral');
      expect(state.enabledScreens).toContain('peripheral-2');

      expect(state.displayAssignments['three-parts-dongle']).toBe('central');
      expect(state.displayAssignments['three-parts-left']).toBe('peripheral');
      expect(state.displayAssignments['three-parts-right']).toBe('peripheral-2');
    });
  });

  describe('Genteure RP2040 Unibody (Wired-Only, No Battery)', () => {
    const config = TEST_KEYBOARD_CONFIGS.find((c) => c.id === 'genteure-unibody')!;

    it('exists in test configurations registry with correct metadata', () => {
      expect(config).toBeDefined();
      expect(config.topology.partsCount).toBe(1);
      expect(config.topology.type).toBe('unibody');
      expect(config.topology.hasBattery).toBe(false);
    });

    it('detects exactly 1 shield unit with side single and isMaster true', () => {
      const units = detectShieldUnitsFromRepo('myunibody', ['config/myunibody.conf'], undefined, config.buildYaml);
      expect(units).toHaveLength(1);
      expect(units[0].id).toBe('myunibody');
      expect(units[0].side).toBe('single');
      expect(units[0].isMaster).toBe(true);
    });

    it('harmonizes enabledScreens to [central] when unibody is loaded', () => {
      const ok = loadTestConfigIntoStudio('genteure-unibody');
      expect(ok).toBe(true);

      const state = useLayoutStore.getState();
      expect(state.loadedShields).toHaveLength(1);
      expect(state.enabledScreens).toEqual(['central']);
      expect(state.displayAssignments['myunibody']).toBe('central');
    });

    it('never generates phantom _right.conf for unibody even if asymmetric timeouts are set', () => {
      const confFiles = [{ path: 'config/myunibody.conf', content: 'CONFIG_ZMK_IDLE_TIMEOUT=60000\n' }];
      const timeouts = {
        screenOffTimeoutSec: 45, // Changed to 45s (45000ms)
        peripheralScreenOffTimeoutSec: 25,
        symmetricSettings: false, // asymmetric requested!
      };

      const updates = resolveConfUpdates(confFiles, timeouts, { isSplit: false });
      expect(updates.some((u) => u.path.includes('_right.conf'))).toBe(false);
      expect(updates).toHaveLength(1);
      expect(updates[0].path).toBe('config/myunibody.conf');
      expect(updates[0].content).toContain('CONFIG_ZMK_IDLE_TIMEOUT=45000');
    });

    it('generates clean single-screen C header where LAYOUT_PERIPHERAL count is 0', () => {
      const dummyGrid = new BwpxGrid(32, 128);
      const header = generateCHeader(dummyGrid, [], dummyGrid, [], {
        version: 1,
        shieldId: 'myunibody',
        enabledScreens: ['central'],
        centralBlocks: [
          { id: 'b1', widgetType: 'layer-banner', name: 'Layer', x: 0, y: 0, width: 32, height: 16, enabled: true, side: 'central' },
        ],
        peripheralBlocks: [],
        idlePeripheralBlocks: [],
      });

      expect(header).toContain('LAYOUT_CENTRAL_ACTIVE_COUNT 1');
      expect(header).toContain('LAYOUT_PERIPHERAL_ACTIVE_COUNT 0');
      expect(header).toContain('#define LAYOUT_RIGHT_ACTIVE_COUNT   LAYOUT_PERIPHERAL_ACTIVE_COUNT');

      const parsed = parseCHeader(header);
      expect(parsed.metadata?.enabledScreens).toEqual(['central']);
    });
  });

  describe('Additional Topology Scenarios', () => {
    it('handles standard 2-part Corne split correctly', () => {
      const ok = loadTestConfigIntoStudio('corne-standard-split');
      expect(ok).toBe(true);

      const state = useLayoutStore.getState();
      expect(state.loadedShields).toHaveLength(2);
      expect(state.enabledScreens).toContain('central');
      expect(state.enabledScreens).toContain('peripheral');
    });

    it('handles split central-display-only scenario', () => {
      const ok = loadTestConfigIntoStudio('split-central-only');
      expect(ok).toBe(true);

      const state = useLayoutStore.getState();
      expect(state.loadedShields).toHaveLength(2);
      expect(state.enabledScreens).toEqual(['central']);
    });

    it('handles split peripheral-display-only scenario', () => {
      const ok = loadTestConfigIntoStudio('split-peripheral-only');
      expect(ok).toBe(true);

      const state = useLayoutStore.getState();
      expect(state.loadedShields).toHaveLength(2);
      expect(state.enabledScreens).toEqual(['peripheral']);
    });

    it('handles wireless unibody keyboard (Reviung41 with battery)', () => {
      const ok = loadTestConfigIntoStudio('unibody-wireless-battery');
      expect(ok).toBe(true);

      const state = useLayoutStore.getState();
      expect(state.loadedShields).toHaveLength(1);
      expect(state.enabledScreens).toEqual(['central']);
    });

    it('handles reversible shield split with standard left central', () => {
      const ok = loadTestConfigIntoStudio('reversible-cradio');
      expect(ok).toBe(true);

      const state = useLayoutStore.getState();
      expect(state.loadedShields).toHaveLength(2);
      expect(state.enabledScreens).toContain('central');
      expect(state.enabledScreens).toContain('peripheral');
      expect(state.displayAssignments['cradio-left']).toBe('central');
      expect(state.displayAssignments['cradio-right']).toBe('peripheral');
    });

    it('handles reversible shield split with right central (Right is Master, Left is Peripheral)', () => {
      const config = TEST_KEYBOARD_CONFIGS.find((c) => c.id === 'reversible-right-central')!;
      expect(config).toBeDefined();

      const units = detectShieldUnitsFromRepo('cradio', undefined, undefined, config.buildYaml);
      expect(units).toHaveLength(2);

      const rightUnit = units.find((u) => u.side === 'right')!;
      const leftUnit = units.find((u) => u.side === 'left')!;

      expect(rightUnit.isMaster).toBe(true);
      expect(leftUnit.isMaster).toBe(false);

      const ok = loadTestConfigIntoStudio('reversible-right-central');
      expect(ok).toBe(true);

      const state = useLayoutStore.getState();
      expect(state.loadedShields).toHaveLength(2);
      // Right half is master so it gets assigned to 'central'
      expect(state.displayAssignments['cradio-right']).toBe('central');
      // Left half is peripheral so it gets assigned to 'peripheral'
      expect(state.displayAssignments['cradio-left']).toBe('peripheral');

      // Test asymmetric timeout routing when right is central
      const confFiles = [
        { path: 'config/cradio.conf', content: 'CONFIG_ZMK_IDLE_TIMEOUT=30000\n' },
        { path: 'config/cradio_right.conf', content: 'CONFIG_ZMK_IDLE_TIMEOUT=30000\n' },
      ];
      const timeouts = {
        screenOffTimeoutSec: 60, // central timeout: 60s
        peripheralScreenOffTimeoutSec: 15, // peripheral timeout: 15s
        symmetricSettings: false,
      };
      const updates = resolveConfUpdates(confFiles, timeouts, { isSplit: true, rightIsCentral: true });
      const rightUpdate = updates.find((u) => u.path === 'config/cradio_right.conf');
      const leftUpdate = updates.find((u) => u.path === 'config/cradio.conf');

      // Central timeout (60000ms) goes to right
      expect(rightUpdate?.content).toContain('CONFIG_ZMK_IDLE_TIMEOUT=60000');
      // Peripheral timeout (15000ms) goes to left
      expect(leftUpdate?.content).toContain('CONFIG_ZMK_IDLE_TIMEOUT=15000');
    });

    it('handles Seeed XIAO RP2040 unibody (wired, no battery)', () => {
      const config = TEST_KEYBOARD_CONFIGS.find((c) => c.id === 'xiao-rp2040-unibody')!;
      expect(config).toBeDefined();

      const units = detectShieldUnitsFromRepo('xiaounibody', ['config/xiaounibody.conf'], undefined, config.buildYaml);
      expect(units).toHaveLength(1);
      expect(units[0].side).toBe('single');
      expect(units[0].isMaster).toBe(true);

      const ok = loadTestConfigIntoStudio('xiao-rp2040-unibody');
      expect(ok).toBe(true);

      const state = useLayoutStore.getState();
      expect(state.loadedShields).toHaveLength(1);
      expect(state.enabledScreens).toEqual(['central']);
      expect(state.displayAssignments['xiaounibody']).toBe('central');
    });

    it('handles headless central dongle with 2 peripheral displays', () => {
      const ok = loadTestConfigIntoStudio('dongle-headless-split');
      expect(ok).toBe(true);

      const state = useLayoutStore.getState();
      expect(state.loadedShields).toHaveLength(3);
      expect(state.enabledScreens).toContain('peripheral');
      expect(state.enabledScreens).toContain('peripheral-2');
    });

    it('detects custom unibody shield from candidate conf files when build.yaml is omitted', () => {
      const detected = detectShieldUnitsFromRepo('unknown', ['config/myunibody.conf']);
      expect(detected).toHaveLength(1);
      expect(detected[0].id).toBe('myunibody');
      expect(detected[0].side).toBe('single');
      expect(detected[0].isMaster).toBe(true);
    });

    it('never creates phantom _right.conf for unibody even when resolveConfUpdates is called without options', () => {
      const confFiles = [{ path: 'config/planck.conf', content: 'CONFIG_ZMK_IDLE_TIMEOUT=30000\n' }];
      const timeouts = {
        screenOffTimeoutSec: 45,
        peripheralScreenOffTimeoutSec: 15,
        symmetricSettings: false, // asymmetric requested!
      };
      const updates = resolveConfUpdates(confFiles, timeouts);
      expect(updates.some((u) => u.path.includes('_right.conf'))).toBe(false);
      expect(updates).toHaveLength(1);
      expect(updates[0].path).toBe('config/planck.conf');
      expect(updates[0].content).toContain('CONFIG_ZMK_IDLE_TIMEOUT=45000');
    });

    it('creates _right.conf for known split shield (corne) with asymmetric timeouts when options omitted', () => {
      const confFiles = [{ path: 'config/corne.conf', content: 'CONFIG_ZMK_IDLE_TIMEOUT=30000\n' }];
      const timeouts = {
        screenOffTimeoutSec: 45,
        peripheralScreenOffTimeoutSec: 15,
        symmetricSettings: false,
      };
      const updates = resolveConfUpdates(confFiles, timeouts);
      expect(updates.some((u) => u.path === 'config/corne_right.conf')).toBe(true);
    });

    it('escapes backslash characters in C header glyph comments to prevent gcc -Wcomment errors', () => {
      const dummyGrid = new BwpxGrid(32, 128);
      const header = generateCHeader(
        dummyGrid,
        [],
        dummyGrid,
        [{ codepoint: 92, char: '\\', width: 3, height: 5, advanceX: 4, x: 0, y: 0 }],
        {
          version: 1,
          shieldId: 'corne',
        }
      );
      // The backslash in line comment must NOT be at the end of the line (which triggers gcc -Wcomment)
      expect(header).not.toMatch(/\/\/\s*\\$/m);
      expect(header).toContain('// \\ (backslash)');
    });

    it('all registered test configurations load without errors', () => {
      for (const config of TEST_KEYBOARD_CONFIGS) {
        const ok = loadTestConfigIntoStudio(config.id);
        expect(ok).toBe(true);
      }
    });
  });
});

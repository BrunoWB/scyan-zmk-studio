import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import {
  BlockSettingsSection,
  ScreenSizePopover,
  SideSettingsPanel,
  StepperControl,
  PRESET_SCREEN_SIZES,
  IDLE_TIMEOUT_PRESETS,
  SLEEP_TIMEOUT_PRESETS,
} from '../ScreenSizePopover';

describe('BlockSettingsSection & ScreenSizePopover', () => {
  it('exports preset configurations', () => {
    expect(PRESET_SCREEN_SIZES.length).toBeGreaterThanOrEqual(4);
    expect(IDLE_TIMEOUT_PRESETS.length).toBeGreaterThanOrEqual(4);
    expect(SLEEP_TIMEOUT_PRESETS.length).toBeGreaterThanOrEqual(4);
  });

  it('renders closed state with 0-height drawer wrapper', () => {
    const html = renderToString(
      <BlockSettingsSection
        isOpen={false}
        onClose={() => {}}
        screenDimensions={{ width: 32, height: 128 }}
        onScreenDimensionsChange={() => {}}
        idleScreensEnabled={true}
        idleTimeoutSec={30}
        screenOffTimeoutSec={60}
      />
    );

    expect(html).toContain('blocks-settings-drawer-wrapper');
    expect(html).not.toContain('blocks-settings-drawer-wrapper open');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('role="region"');
    expect(html).toContain('aria-label="Display &amp; Power Settings"');
  });

  it('renders open state with open class and all options', () => {
    const html = renderToString(
      <BlockSettingsSection
        isOpen={true}
        onClose={() => {}}
        screenDimensions={{ width: 32, height: 128 }}
        onScreenDimensionsChange={() => {}}
        idleScreensEnabled={true}
        idleTimeoutSec={30}
        screenOffTimeoutSec={60}
      />
    );

    expect(html).toContain('blocks-settings-drawer-wrapper open');
    expect(html).toContain('Display &amp; Power Settings');
    expect(html).toContain('Screen Dimensions');
    expect(html).toContain('32×128px');
    expect(html).toContain('Idle Screensaver');
    expect(html).toContain('Allow Idle Screensaver');
    expect(html).toContain('Inactivity Timers');
    expect(html).toContain('TIME UNTIL IDLE');
    expect(html).toContain('TIME UNTIL SCREEN OFF');
    expect(html).toContain('Active (Typing)');
    expect(html).toContain('Idle Screensaver');
    expect(html).toContain('Display Off (Sleep)');
    expect(html).not.toContain('Total Inactivity to Off');
    expect(html).not.toContain('#define ZMK_DISPLAY_SLEEP_TIMEOUT_MS');
  });

  it('dims idle timer when idleScreensEnabled is false', () => {
    const html = renderToString(
      <BlockSettingsSection
        isOpen={true}
        onClose={() => {}}
        screenDimensions={{ width: 32, height: 128 }}
        onScreenDimensionsChange={() => {}}
        idleScreensEnabled={false}
        idleTimeoutSec={30}
        screenOffTimeoutSec={90}
      />
    );

    expect(html).toContain('opacity-40 pointer-events-none');
    expect(html).toContain('Disabled');
    expect(html).toContain('Off: 90s');
    expect(html).not.toContain('screensaver)');
  });

  it('ScreenSizePopover is backward compatible alias of BlockSettingsSection', () => {
    expect(ScreenSizePopover).toBe(BlockSettingsSection);
  });

  it('renders StepperControl with decrement and increment buttons matching reference styling', () => {
    const html = renderToString(
      <StepperControl
        label="W"
        value={32}
        onChange={() => {}}
        min={16}
        max={256}
        step={2}
        unit="px"
        disabled={false}
        accentColor="cyan"
      />
    );

    expect(html).toContain('W:');
    expect(html).toContain('32');
    expect(html).toContain('px');
    expect(html).toContain('Decrease W');
    expect(html).toContain('Increase W');
  });

  it('renders StepperControl in disabled state with disabled attributes and opacity', () => {
    const html = renderToString(
      <StepperControl
        label="Idle"
        value={30}
        onChange={() => {}}
        disabled={true}
        ariaLabel="Time Until Idle"
      />
    );

    expect(html).toContain('opacity-40 pointer-events-none');
    expect(html).toContain('disabled=""');
  });

  it('renders symmetric settings toggle on the header, checked by default', () => {
    const html = renderToString(
      <BlockSettingsSection
        isOpen={true}
        onClose={() => {}}
        screenDimensions={{ width: 32, height: 128 }}
        onScreenDimensionsChange={() => {}}
        idleScreensEnabled={true}
        idleTimeoutSec={30}
        screenOffTimeoutSec={60}
        symmetricSettings={true}
      />
    );

    expect(html).toContain('Symmetric Settings');
    expect(html).toContain('role="switch"');
    expect(html).toContain('aria-checked="true"');
    // Only one unified block when symmetric
    expect(html).not.toContain('Central Display &amp; Power Settings');
    expect(html).not.toContain('Peripheral Display &amp; Power Settings');
  });

  it('renders two independent blocks for Left and Right sides when symmetric settings is unchecked', () => {
    const html = renderToString(
      <BlockSettingsSection
        isOpen={true}
        onClose={() => {}}
        screenDimensions={{ width: 32, height: 128 }}
        onScreenDimensionsChange={() => {}}
        idleScreensEnabled={true}
        idleTimeoutSec={30}
        screenOffTimeoutSec={60}
        symmetricSettings={false}
        rightScreenDimensions={{ width: 68, height: 160 }}
        rightIdleScreensEnabled={false}
        rightIdleTimeoutSec={15}
        rightScreenOffTimeoutSec={120}
      />
    );

    // Symmetric toggle switch is aria-checked false
    expect(html).toContain('aria-checked="false"');

    // Both independent side blocks are rendered
    expect(html).toContain('Central Display &amp; Power Settings');
    expect(html).toContain('Central');
    expect(html).toContain('Peripheral Display &amp; Power Settings');
    expect(html).toContain('Peripheral');

    // Left dimensions and Right dimensions are distinct
    expect(html).toContain('32×128px');
    expect(html).toContain('68×160px');

    // Central and Peripheral timers in timeline footer
    expect(html).toContain('Central:');
    expect(html).toContain('Peripheral:');
    expect(html).not.toContain('#define SCYAN_SLEEP_TIMEOUT_MS');
  });
});

describe('SideSettingsPanel (Side-Docked Display & Power Panels)', () => {
  it('renders closed state with zero-width container and aria-hidden', () => {
    const html = renderToString(
      <SideSettingsPanel
        side="left"
        isOpen={false}
        onClose={() => {}}
        screenDimensions={{ width: 32, height: 128 }}
        onScreenDimensionsChange={() => {}}
        idleScreensEnabled={true}
        idleTimeoutSec={30}
        screenOffTimeoutSec={60}
      />
    );

    expect(html).toContain('side-settings-panel-container side-left');
    expect(html).not.toContain('side-settings-panel-container side-left open');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('role="region"');
    expect(html).toContain('aria-label="Central Display &amp; Power Settings"');
  });

  it('renders open state for Central (Left) with controls and no defines', () => {
    const html = renderToString(
      <SideSettingsPanel
        side="left"
        isOpen={true}
        onClose={() => {}}
        screenDimensions={{ width: 32, height: 128 }}
        onScreenDimensionsChange={() => {}}
        idleScreensEnabled={true}
        idleTimeoutSec={30}
        screenOffTimeoutSec={60}
        symmetricSettings={true}
      />
    );

    expect(html).toContain('side-settings-panel-container side-left open');
    expect(html).toContain('Central Settings');
    expect(html).toContain('Central');
    expect(html).toContain('Symmetric Mode:');
    expect(html).toContain('Screen Dimensions');
    expect(html).toContain('32×128px');
    expect(html).toContain('Idle Screensaver');
    expect(html).toContain('Inactivity Timers');
    expect(html).not.toContain('#define SCYAN_SLEEP_TIMEOUT_MS');
  });

  it('renders Peripheral (Right) panel with symmetric settings ON, visually disabling controls', () => {
    const html = renderToString(
      <SideSettingsPanel
        side="right"
        isOpen={true}
        onClose={() => {}}
        screenDimensions={{ width: 32, height: 128 }}
        onScreenDimensionsChange={() => {}}
        idleScreensEnabled={true}
        idleTimeoutSec={30}
        screenOffTimeoutSec={60}
        symmetricSettings={true}
        rightScreenDimensions={{ width: 68, height: 160 }}
        rightIdleScreensEnabled={false}
        rightIdleTimeoutSec={15}
        rightScreenOffTimeoutSec={120}
      />
    );

    expect(html).toContain('side-settings-panel-container side-right open');
    expect(html).toContain('Peripheral Settings');
    expect(html).toContain('Peripheral');

    // Symmetric Settings toggle is inside Peripheral panel, checked true
    expect(html).toContain('Symmetric Settings');
    expect(html).toContain('role="switch"');
    expect(html).toContain('aria-checked="true"');

    // Mirroring Central indicator banner
    expect(html).toContain('Mirroring Central');

    // Controls container is visually disabled with opacity-40 pointer-events-none select-none
    expect(html).toContain('opacity-40 pointer-events-none select-none');

    // Displays mirrored Central values
    expect(html).toContain('32×128px');
    expect(html).not.toContain('#define SCYAN_SLEEP_TIMEOUT_MS');
  });

  it('renders Peripheral (Right) panel with symmetric settings OFF, controls fully active and independent', () => {
    const html = renderToString(
      <SideSettingsPanel
        side="right"
        isOpen={true}
        onClose={() => {}}
        screenDimensions={{ width: 32, height: 128 }}
        onScreenDimensionsChange={() => {}}
        idleScreensEnabled={true}
        idleTimeoutSec={30}
        screenOffTimeoutSec={60}
        symmetricSettings={false}
        rightScreenDimensions={{ width: 68, height: 160 }}
        rightIdleScreensEnabled={false}
        rightIdleTimeoutSec={15}
        rightScreenOffTimeoutSec={120}
      />
    );

    expect(html).toContain('side-settings-panel-container side-right open');
    expect(html).toContain('Peripheral Settings');
    expect(html).toContain('Peripheral');

    // Symmetric Settings toggle is unchecked
    expect(html).toContain('Symmetric Settings');
    expect(html).toContain('role="switch"');
    expect(html).toContain('aria-checked="false"');

    // Independent Peripheral Settings indicator
    expect(html).toContain('Independent Peripheral Settings');

    // Controls container is NOT visually disabled
    expect(html).not.toContain('opacity-40 pointer-events-none select-none');

    // Displays independent Right values
    expect(html).toContain('68×160px');
    expect(html).not.toContain('#define SCYAN_SLEEP_TIMEOUT_MS_RIGHT');
    // Themed purple preset buttons and select focus
    expect(html).toContain('focus:border-[#a953f6]');
    expect(html).toContain('bg-[#a953f6]/20 text-[#a953f6]');
  });

  it('renders all settings cards with unified rounded-xl border radius', () => {
    const html = renderToString(
      <SideSettingsPanel
        side="left"
        isOpen={true}
        onClose={() => {}}
        screenDimensions={{ width: 32, height: 128 }}
        onScreenDimensionsChange={() => {}}
        idleScreensEnabled={true}
        idleTimeoutSec={30}
        screenOffTimeoutSec={60}
      />
    );

    // All 3 cards should use rounded-xl
    expect(html).not.toContain('rounded-lg p-3 flex flex-col justify-between');
    expect(html).toContain('rounded-xl p-3 flex flex-col justify-between');
  });

  it('hides W/H stepper inputs when matching a preset and shows them when custom is selected', () => {
    // 32x128 matches preset: W/H stepper controls should NOT appear
    const presetHtml = renderToString(
      <SideSettingsPanel
        side="left"
        isOpen={true}
        onClose={() => {}}
        screenDimensions={{ width: 32, height: 128 }}
        onScreenDimensionsChange={() => {}}
      />
    );
    expect(presetHtml).not.toContain('Dimensions Pair [W, H]');

    // 50x50 does not match any preset: custom inputs appear
    const customHtml = renderToString(
      <SideSettingsPanel
        side="left"
        isOpen={true}
        onClose={() => {}}
        screenDimensions={{ width: 50, height: 50 }}
        onScreenDimensionsChange={() => {}}
      />
    );
    expect(customHtml).toContain('Dimensions Pair [W, H]');
  });

  it('renders Central Actions with Make Peripheral Display and Delete Display', () => {
    const html = renderToString(
      <SideSettingsPanel
        side="central"
        isOpen={true}
        onClose={() => {}}
        screenDimensions={{ width: 32, height: 128 }}
        onScreenDimensionsChange={() => {}}
        onMakePeripheral={() => {}}
        onDeleteDisplay={() => {}}
        canDeleteDisplay={true}
      />
    );

    expect(html).toContain('Central Actions');
    expect(html).toContain('Make Peripheral Display');
    expect(html).toContain('Delete Display');
  });

  it('renders Peripheral Actions with Make Central Display and disabled Delete Display when canDeleteDisplay is false', () => {
    const html = renderToString(
      <SideSettingsPanel
        side="peripheral"
        isOpen={true}
        onClose={() => {}}
        screenDimensions={{ width: 32, height: 128 }}
        onScreenDimensionsChange={() => {}}
        onMakeCentral={() => {}}
        onDeleteDisplay={() => {}}
        canDeleteDisplay={false}
      />
    );

    expect(html).toContain('Peripheral Actions');
    expect(html).toContain('Make Central Display');
    expect(html).toContain('Delete Display');
    expect(html).toContain('disabled=""');
    expect(html).toContain('Cannot delete display: at least one display is required');
  });

  it('standardizes screen specs so both Corne (32x128) and Lily58 (128x32) match the 128x32 preset', () => {
    const corneHtml = renderToString(
      <SideSettingsPanel
        side="left"
        isOpen={true}
        onClose={() => {}}
        screenDimensions={{ width: 32, height: 128 }}
        onScreenDimensionsChange={() => {}}
        rotation={90}
      />
    );
    expect(corneHtml).toContain('128 × 32 (0.91&quot; OLED)');
    expect(corneHtml).toContain('<option value="128x32" selected=""');

    const lilyHtml = renderToString(
      <SideSettingsPanel
        side="left"
        isOpen={true}
        onClose={() => {}}
        screenDimensions={{ width: 128, height: 32 }}
        onScreenDimensionsChange={() => {}}
        rotation={0}
      />
    );
    expect(lilyHtml).toContain('128 × 32 (0.91&quot; OLED)');
    expect(lilyHtml).toContain('<option value="128x32" selected=""');
  });

  it('renders rotation radio buttons (0°, 90°, 180°, 270°) with accessible radiogroup', () => {
    const html = renderToString(
      <SideSettingsPanel
        side="left"
        isOpen={true}
        onClose={() => {}}
        screenDimensions={{ width: 32, height: 128 }}
        onScreenDimensionsChange={() => {}}
        rotation={90}
      />
    );

    expect(html).toContain('role="radiogroup"');
    expect(html).toContain('Screen Rotation');
    expect(html).toContain('0°');
    expect(html).toContain('90°');
    expect(html).toContain('180°');
    expect(html).toContain('270°');
    expect(html).toContain('type="radio"');
    expect(html).toContain('checked="" value="90"');
  });

  it('standardizes nice!view preset for both horizontal (160x68) and vertical (68x160) orientations', () => {
    const horizontalHtml = renderToString(
      <SideSettingsPanel
        side="left"
        isOpen={true}
        onClose={() => {}}
        screenDimensions={{ width: 160, height: 68 }}
        onScreenDimensionsChange={() => {}}
        rotation={0}
      />
    );
    expect(horizontalHtml).toContain('160 × 68 (nice!view)');
    expect(horizontalHtml).toContain('<option value="160x68" selected=""');

    const verticalHtml = renderToString(
      <SideSettingsPanel
        side="left"
        isOpen={true}
        onClose={() => {}}
        screenDimensions={{ width: 68, height: 160 }}
        onScreenDimensionsChange={() => {}}
        rotation={90}
      />
    );
    expect(verticalHtml).toContain('160 × 68 (nice!view)');
    expect(verticalHtml).toContain('<option value="160x68" selected=""');
  });

  it('isolates radio input names using unique IDs so groups do not clash in the DOM', () => {
    const asymmetricHtml = renderToString(
      <BlockSettingsSection
        isOpen={true}
        onClose={() => {}}
        screenDimensions={{ width: 32, height: 128 }}
        onScreenDimensionsChange={() => {}}
        rotation={90}
        symmetricSettings={false}
        rightScreenDimensions={{ width: 128, height: 32 }}
        rightRotation={0}
      />
    );

    const nameMatches = asymmetricHtml.match(/name="rotation-[^"]+"/g);
    expect(nameMatches).not.toBeNull();
    // At least 2 distinct radio groups (central and peripheral)
    const uniqueNames = new Set(nameMatches);
    expect(uniqueNames.size).toBeGreaterThanOrEqual(2);
  });

  it('drives settings directly from active display and renders display tabs when displays is provided', () => {
    const displays = {
      'display-1': {
        id: 'display-1',
        name: 'Master Left',
        dimensions: { width: 32, height: 128 },
        rotation: 90 as const,
        blocks: [],
        idleBlocks: [],
        idleTimeoutSec: 30,
        screenOffTimeoutSec: 60,
        idleScreensEnabled: true,
      },
      'display-2': {
        id: 'display-2',
        name: 'Peripheral Right',
        dimensions: { width: 68, height: 160 },
        rotation: 0 as const,
        blocks: [],
        idleBlocks: [],
        idleTimeoutSec: 15,
        screenOffTimeoutSec: 45,
        idleScreensEnabled: false,
      },
      'display-3': {
        id: 'display-3',
        name: 'Status Dongle',
        dimensions: { width: 128, height: 32 },
        rotation: 0 as const,
        blocks: [],
        idleBlocks: [],
        idleTimeoutSec: 10,
        screenOffTimeoutSec: 30,
        idleScreensEnabled: true,
      },
    };

    // Render with activeDisplayId = 'display-2' in asymmetric mode
    const html = renderToString(
      <BlockSettingsSection
        isOpen={true}
        onClose={() => {}}
        screenDimensions={{ width: 32, height: 128 }}
        onScreenDimensionsChange={() => {}}
        symmetricSettings={false}
        displays={displays}
        activeDisplayId="display-2"
      />
    );

    // Verify all 3 display tabs are rendered
    expect(html).toContain('Master Left');
    expect(html).toContain('Peripheral Right');
    expect(html).toContain('Status Dongle');

    // Active tab (display-2) styling
    expect(html).toContain('Peripheral Right Display &amp; Power Settings');
    expect(html).toContain('68×160px');
  });
});

describe('Shield Dictionary Orientation & Screen Resolution', () => {
  it('returns standardized hardware resolution and default oriented resolution', async () => {
    const {
      getShieldDefaultRotation,
      getShieldHardwareResolution,
      getShieldDefaultResolution,
    } = await import('../../data/shieldsData');

    expect(getShieldHardwareResolution('corne')).toEqual({ width: 128, height: 32 });
    expect(getShieldDefaultRotation('corne')).toBe(90);
    expect(getShieldDefaultResolution('corne')).toEqual({ width: 32, height: 128 });

    expect(getShieldHardwareResolution('lily58')).toEqual({ width: 128, height: 32 });
    expect(getShieldDefaultRotation('lily58')).toBe(0);
    expect(getShieldDefaultResolution('lily58')).toEqual({ width: 128, height: 32 });

    expect(getShieldHardwareResolution('ferris-sweep')).toEqual({ width: 128, height: 32 });
    expect(getShieldDefaultRotation('ferris-sweep')).toBe(90);
    expect(getShieldDefaultResolution('ferris-sweep')).toEqual({ width: 32, height: 128 });

    expect(getShieldHardwareResolution('kyria')).toEqual({ width: 128, height: 64 });
    expect(getShieldDefaultRotation('kyria')).toBe(0);
    expect(getShieldDefaultResolution('kyria')).toEqual({ width: 128, height: 64 });

    expect(getShieldHardwareResolution('xiao-dongle')).toEqual({ width: 128, height: 32 });
    expect(getShieldDefaultRotation('xiao-dongle')).toBe(90);
    expect(getShieldDefaultResolution('xiao-dongle')).toEqual({ width: 32, height: 128 });

    expect(getShieldHardwareResolution('reviung41')).toEqual({ width: 128, height: 32 });
    expect(getShieldDefaultRotation('reviung41')).toBe(0);
    expect(getShieldDefaultResolution('reviung41')).toEqual({ width: 128, height: 32 });
  });
});

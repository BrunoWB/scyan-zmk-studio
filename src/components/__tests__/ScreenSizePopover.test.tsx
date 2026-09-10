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
    expect(html).toContain('Allow Idle Screens');
    expect(html).toContain('Inactivity Timers');
    expect(html).toContain('TIME UNTIL IDLE');
    expect(html).toContain('TIME UNTIL SCREEN OFF');
    expect(html).toContain('Active (Typing)');
    expect(html).toContain('Idle Screensaver');
    expect(html).toContain('Display Off (Sleep)');
    expect(html).toContain('Total Inactivity to Off');
    expect(html).toContain('30s screensaver');
    expect(html).toContain('#define ZMK_DISPLAY_SLEEP_TIMEOUT_MS 60000');
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
        ariaLabel="Width"
      />
    );

    expect(html).toContain('aria-label="Decrease Width"');
    expect(html).toContain('aria-label="Increase Width"');
    expect(html).toContain('value="32"');
    expect(html).toContain('W:');
    expect(html).toContain('bg-[#0b0d13]');
    expect(html).toContain('rounded-xl');
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
    expect(html).not.toContain('Left Half Display &amp; Power Settings');
    expect(html).not.toContain('Right Half Display &amp; Power Settings');
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
    expect(html).toContain('Left Half Display &amp; Power Settings');
    expect(html).toContain('Left Half (Master)');
    expect(html).toContain('Right Half Display &amp; Power Settings');
    expect(html).toContain('Right Half (Peripheral)');

    // Left dimensions and Right dimensions are distinct
    expect(html).toContain('32×128px');
    expect(html).toContain('68×160px');

    // Left and Right timers in timeline footer
    expect(html).toContain('Left Half:');
    expect(html).toContain('#define SCYAN_SLEEP_TIMEOUT_MS 60000');
    expect(html).toContain('Right Half:');
    expect(html).toContain('#define SCYAN_SLEEP_TIMEOUT_MS_RIGHT 120000');
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
    expect(html).toContain('aria-label="Left Active (Master) Display &amp; Power Settings"');
  });

  it('renders open state for Master (Left) with controls and defines', () => {
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
    expect(html).toContain('Master Settings');
    expect(html).toContain('Left Half');
    expect(html).toContain('Symmetric Mode:');
    expect(html).toContain('Screen Dimensions');
    expect(html).toContain('32×128px');
    expect(html).toContain('Idle Screensaver');
    expect(html).toContain('Inactivity Timers');
    expect(html).toContain('#define SCYAN_SLEEP_TIMEOUT_MS 60000');
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
    expect(html).toContain('Right Half');

    // Symmetric Settings toggle is inside Peripheral panel, checked true
    expect(html).toContain('Symmetric Settings');
    expect(html).toContain('role="switch"');
    expect(html).toContain('aria-checked="true"');

    // Mirroring Master indicator banner
    expect(html).toContain('Mirroring Left Half (Master)');

    // Controls container is visually disabled with opacity-40 pointer-events-none select-none
    expect(html).toContain('opacity-40 pointer-events-none select-none');

    // Displays mirrored Master values
    expect(html).toContain('32×128px');
    expect(html).toContain('#define SCYAN_SLEEP_TIMEOUT_MS 60000');
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
    expect(html).toContain('Right Half');

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
    expect(html).toContain('#define SCYAN_SLEEP_TIMEOUT_MS_RIGHT 120000');
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
});



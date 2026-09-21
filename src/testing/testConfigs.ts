/**
 * Keyboard Configuration Test Fixtures & Scenarios
 *
 * Provides realistic ZMK configuration fixtures for automated testing
 * and interactive simulation in Scyan ZMK Studio dev tools.
 */

export interface TestConfigFile {
  path: string;
  content: string;
}

export interface TestKeyboardConfig {
  id: string;
  name: string;
  category: 'genteure' | 'split' | 'unibody' | 'dongle';
  description: string;
  notes?: string;
  repo: {
    owner: string;
    repo: string;
    branch: string;
    url?: string;
  };
  topology: {
    partsCount: number;
    type: 'unibody' | 'split' | 'dongle-split';
    displayCount: number;
    hasBattery: boolean;
    isWireless: boolean;
    centralRole: 'dongle' | 'left' | 'right' | 'single';
  };
  buildYaml: string;
  confFiles: TestConfigFile[];
  keymapFile: TestConfigFile;
  shieldFiles?: TestConfigFile[];
  expectedShieldIds: string[];
  expectedEnabledScreens: string[];
}

export const TEST_KEYBOARD_CONFIGS: TestKeyboardConfig[] = [
  {
    id: 'genteure-three-parts',
    name: 'Genteure 3-Parts Split (Xiao Dongle + 2 Peripherals)',
    category: 'genteure',
    description:
      'Non-standard 3-part topology: 1 central Xiao BLE dongle + 2 Nice!Nano peripheral halves (left & right). All 3 units feature SSD1306 OLED displays.',
    notes:
      'Tests detection of 3 distinct shield units, assigning central to dongle and peripheral/peripheral-2 to halves.',
    repo: {
      owner: 'Genteure',
      repo: 'zmk-config-scyan-test',
      branch: 'main',
      url: 'https://github.com/Genteure/zmk-config-scyan-test',
    },
    topology: {
      partsCount: 3,
      type: 'dongle-split',
      displayCount: 3,
      hasBattery: true,
      isWireless: true,
      centralRole: 'dongle',
    },
    buildYaml: `---
include:
  - board: seeeduino_xiao_ble
    shield: three_parts_dongle

  - board: nice_nano_v2
    shield: three_parts_left

  - board: nice_nano_v2
    shield: three_parts_right

  - board: seeeduino_xiao_ble
    shield: settings_reset

  - board: nice_nano_v2
    shield: settings_reset
`,
    confFiles: [
      {
        path: 'config/three_parts.conf',
        content: `# User Configuration
# All driver Kconfig is in Kconfig.defconfig
CONFIG_ZMK_IDLE_TIMEOUT=60000

# Enable the Corne OLED Display (SSD1306)
CONFIG_ZMK_DISPLAY=y
CONFIG_SSD1306=y
CONFIG_ZMK_DISPLAY_WORK_QUEUE_DEDICATED=y
CONFIG_ZMK_DISPLAY_DEDICATED_THREAD_PRIORITY=10
CONFIG_ZMK_DISPLAY_BLANK_ON_IDLE=y

# Custom status screen (Scyan ZMK Display Module)
CONFIG_ZMK_DISPLAY_STATUS_SCREEN_CUSTOM=y
CONFIG_ZMK_DISPLAY_STATUS_SCREEN_BUILT_IN=n
CONFIG_LV_USE_CANVAS=y
CONFIG_LV_USE_IMG=y
CONFIG_SCYAN_ROTATION_90=y
CONFIG_SCYAN_ROTATION_270=n
CONFIG_SCYAN_INVERT=y
CONFIG_SCYAN_IDLE_TIMEOUT_MS=10000
CONFIG_SCYAN_USER_NAME="SCYAN"
`,
      },
      {
        path: 'config/three_parts_right.conf',
        content: `CONFIG_ZMK_IDLE_TIMEOUT=25000\n`,
      },
    ],
    keymapFile: {
      path: 'config/three_parts.keymap',
      content: `#include <behaviors.dtsi>
#include <dt-bindings/zmk/keys.h>

/ {
    keymap {
        compatible = "zmk,keymap";

        default_layer {
            display-name = "Base";
            bindings = <
                &kp A &kp B &kp C
            >;
        };
    };
};
`,
    },
    shieldFiles: [
      {
        path: 'boards/shields/three_parts/Kconfig.shield',
        content: `config SHIELD_THREE_PARTS_DONGLE
    def_bool $(shields_list_contains,three_parts_dongle)

config SHIELD_THREE_PARTS_LEFT
    def_bool $(shields_list_contains,three_parts_left)

config SHIELD_THREE_PARTS_RIGHT
    def_bool $(shields_list_contains,three_parts_right)
`,
      },
    ],
    expectedShieldIds: ['three-parts-dongle', 'three-parts-left', 'three-parts-right'],
    expectedEnabledScreens: ['central', 'peripheral', 'peripheral-2'],
  },

  {
    id: 'genteure-unibody',
    name: 'Genteure RP2040 Unibody (Wired-Only, No Battery)',
    category: 'genteure',
    description:
      'Single-part unibody keyboard on Raspberry Pi Pico / RP2040. Wired-only via USB, no wireless/battery stack. Single SSD1306 OLED display.',
    notes:
      'Tests that no phantom _right.conf is generated, and LAYOUT_PERIPHERAL_* blocks remain empty with count 0.',
    repo: {
      owner: 'Genteure',
      repo: 'zmk-config-scyan-unibody',
      branch: 'main',
      url: 'https://github.com/Genteure/zmk-config-scyan-unibody',
    },
    topology: {
      partsCount: 1,
      type: 'unibody',
      displayCount: 1,
      hasBattery: false,
      isWireless: false,
      centralRole: 'single',
    },
    buildYaml: `---
include:
  - board: rpi_pico
    shield: myunibody

  - board: rpi_pico
    shield: settings_reset
`,
    confFiles: [
      {
        path: 'config/myunibody.conf',
        content: `# User Configuration
# All driver Kconfig is in Kconfig.defconfig

# Enable the Corne OLED Display (SSD1306)
CONFIG_ZMK_DISPLAY=y
CONFIG_SSD1306=y
CONFIG_ZMK_DISPLAY_WORK_QUEUE_DEDICATED=y
CONFIG_ZMK_DISPLAY_DEDICATED_THREAD_PRIORITY=10
CONFIG_ZMK_DISPLAY_BLANK_ON_IDLE=y

# Custom status screen (Scyan ZMK Display Module)
CONFIG_ZMK_DISPLAY_STATUS_SCREEN_CUSTOM=y
CONFIG_ZMK_DISPLAY_STATUS_SCREEN_BUILT_IN=n
CONFIG_LV_USE_CANVAS=y
CONFIG_LV_USE_IMG=y
CONFIG_SCYAN_ROTATION_90=y
CONFIG_SCYAN_ROTATION_270=n
CONFIG_SCYAN_INVERT=y
CONFIG_SCYAN_IDLE_TIMEOUT_MS=10000
CONFIG_SCYAN_USER_NAME="SCYAN"
CONFIG_ZMK_IDLE_TIMEOUT=60000
`,
      },
    ],
    keymapFile: {
      path: 'config/myunibody.keymap',
      content: `#include <behaviors.dtsi>
#include <dt-bindings/zmk/keys.h>

/ {
    keymap {
        compatible = "zmk,keymap";

        default_layer {
            display-name = "Base";
            bindings = <
                &kp A &kp B
            >;
        };
    };
};
`,
    },
    shieldFiles: [
      {
        path: 'boards/shields/myunibody/Kconfig.shield',
        content: `config SHIELD_MYUNIBODY
    def_bool $(shields_list_contains,myunibody)
`,
      },
    ],
    expectedShieldIds: ['myunibody'],
    expectedEnabledScreens: ['central'],
  },

  {
    id: 'corne-standard-split',
    name: 'Corne Split 42 (Standard 2-Part Wireless)',
    category: 'split',
    description:
      'Standard split 2-part Corne keyboard on Nice!Nano v2 with dual displays and rechargeable batteries.',
    notes:
      'Standard baseline for split pair keyboard with central (left) and peripheral (right) OLEDs.',
    repo: {
      owner: 'example-user',
      repo: 'zmk-corne-config',
      branch: 'main',
    },
    topology: {
      partsCount: 2,
      type: 'split',
      displayCount: 2,
      hasBattery: true,
      isWireless: true,
      centralRole: 'left',
    },
    buildYaml: `---
include:
  - board: nice_nano_v2
    shield: corne_left
  - board: nice_nano_v2
    shield: corne_right
`,
    confFiles: [
      {
        path: 'config/corne.conf',
        content: `CONFIG_ZMK_DISPLAY=y
CONFIG_SSD1306=y
CONFIG_ZMK_DISPLAY_STATUS_SCREEN_CUSTOM=y
CONFIG_SCYAN_ROTATION_90=y
CONFIG_ZMK_IDLE_TIMEOUT=30000
`,
      },
    ],
    keymapFile: {
      path: 'config/corne.keymap',
      content: `#include <behaviors.dtsi>
#include <dt-bindings/zmk/keys.h>

/ {
    keymap {
        compatible = "zmk,keymap";
        default_layer {
            display-name = "QWERTY";
            bindings = <
                &kp TAB   &kp Q &kp W &kp E &kp R &kp T   &kp Y &kp U &kp I     &kp O   &kp P    &kp BSPC
                &kp LCTRL &kp A &kp S &kp D &kp F &kp G   &kp H &kp J &kp K     &kp L   &kp SEMI &kp SQT
                &kp LSHFT &kp Z &kp X &kp C &kp V &kp B   &kp N &kp M &kp COMMA &kp DOT &kp FSLH &kp ESC
                                &kp LGUI &mo 1 &kp SPACE  &kp RET &mo 2 &kp RALT
            >;
        };
    };
};
`,
    },
    expectedShieldIds: ['corne_left', 'corne_right'],
    expectedEnabledScreens: ['central', 'peripheral'],
  },

  {
    id: 'split-central-only',
    name: 'Split Central-Display-Only (Left Screen, Right Blind)',
    category: 'split',
    description:
      'Corne split build where only the central half (left) has an OLED installed; the right peripheral is display-less to save battery.',
    notes:
      'Tests attaching a display to central while peripheral has no display attached.',
    repo: {
      owner: 'power-saver',
      repo: 'zmk-split-left-display',
      branch: 'main',
    },
    topology: {
      partsCount: 2,
      type: 'split',
      displayCount: 1,
      hasBattery: true,
      isWireless: true,
      centralRole: 'left',
    },
    buildYaml: `---
include:
  - board: nice_nano_v2
    shield: corne_left
  - board: nice_nano_v2
    shield: corne_right
`,
    confFiles: [
      {
        path: 'config/corne.conf',
        content: `CONFIG_ZMK_DISPLAY=y
CONFIG_SSD1306=y
CONFIG_ZMK_DISPLAY_STATUS_SCREEN_CUSTOM=y
CONFIG_ZMK_IDLE_TIMEOUT=30000
`,
      },
    ],
    keymapFile: {
      path: 'config/corne.keymap',
      content: `#include <behaviors.dtsi>
#include <dt-bindings/zmk/keys.h>

/ {
    keymap {
        compatible = "zmk,keymap";
        default_layer {
            display-name = "Base";
            bindings = <
                &kp Q &kp W &kp E &kp R   &kp U &kp I &kp O &kp P
            >;
        };
    };
};
`,
    },
    expectedShieldIds: ['corne_left', 'corne_right'],
    expectedEnabledScreens: ['central'],
  },

  {
    id: 'split-peripheral-only',
    name: 'Split Peripheral-Display-Only (Right Screen, Left Blind)',
    category: 'split',
    description:
      'Split keyboard where the central half is display-less (hidden or low-profile) while the peripheral half has an animated OLED badge or artwork display.',
    notes:
      'Tests attaching display to peripheral while central display is unattached.',
    repo: {
      owner: 'artisan-builder',
      repo: 'zmk-art-peripheral',
      branch: 'main',
    },
    topology: {
      partsCount: 2,
      type: 'split',
      displayCount: 1,
      hasBattery: true,
      isWireless: true,
      centralRole: 'left',
    },
    buildYaml: `---
include:
  - board: nice_nano_v2
    shield: lily58_left
  - board: nice_nano_v2
    shield: lily58_right
`,
    confFiles: [
      {
        path: 'config/lily58.conf',
        content: `CONFIG_ZMK_DISPLAY=y
CONFIG_SSD1306=y
CONFIG_ZMK_DISPLAY_STATUS_SCREEN_CUSTOM=y
CONFIG_ZMK_IDLE_TIMEOUT=30000
`,
      },
    ],
    keymapFile: {
      path: 'config/lily58.keymap',
      content: `#include <behaviors.dtsi>
#include <dt-bindings/zmk/keys.h>

/ {
    keymap {
        compatible = "zmk,keymap";
        default_layer {
            display-name = "Base";
            bindings = <
                &kp Q &kp W &kp E &kp R   &kp U &kp I &kp O &kp P
            >;
        };
    };
};
`,
    },
    expectedShieldIds: ['lily58_left', 'lily58_right'],
    expectedEnabledScreens: ['peripheral'],
  },

  {
    id: 'unibody-wireless-battery',
    name: 'Reviung41 Unibody (Wireless + Battery)',
    category: 'unibody',
    description:
      'Single-piece 41-key columnar unibody keyboard powered by Nice!Nano v2 with Bluetooth LE and LiPo battery monitoring.',
    notes:
      'Tests unibody layout generation with battery widget enabled and wired/wireless endpoints.',
    repo: {
      owner: 'unibody-fan',
      repo: 'zmk-reviung41-ble',
      branch: 'main',
    },
    topology: {
      partsCount: 1,
      type: 'unibody',
      displayCount: 1,
      hasBattery: true,
      isWireless: true,
      centralRole: 'single',
    },
    buildYaml: `---
include:
  - board: nice_nano_v2
    shield: reviung41
`,
    confFiles: [
      {
        path: 'config/reviung41.conf',
        content: `CONFIG_ZMK_DISPLAY=y
CONFIG_SSD1306=y
CONFIG_ZMK_DISPLAY_STATUS_SCREEN_CUSTOM=y
CONFIG_ZMK_IDLE_TIMEOUT=45000
CONFIG_ZMK_BATTERY=y
`,
      },
    ],
    keymapFile: {
      path: 'config/reviung41.keymap',
      content: `#include <behaviors.dtsi>
#include <dt-bindings/zmk/keys.h>

/ {
    keymap {
        compatible = "zmk,keymap";
        default_layer {
            display-name = "Reviung";
            bindings = <
                &kp TAB   &kp Q &kp W &kp E &kp R &kp T   &kp Y &kp U &kp I     &kp O   &kp P    &kp BSPC
                &kp LCTRL &kp A &kp S &kp D &kp F &kp G   &kp H &kp J &kp K     &kp L   &kp SEMI &kp SQT
                &kp LSHFT &kp Z &kp X &kp C &kp V &kp B   &kp N &kp M &kp COMMA &kp DOT &kp FSLH &kp ESC
                                      &kp LGUI &mo 1 &kp SPACE &mo 2 &kp RALT
            >;
        };
    };
};
`,
    },
    expectedShieldIds: ['reviung41'],
    expectedEnabledScreens: ['central'],
  },

  {
    id: 'reversible-cradio',
    name: 'Cradio / Ferris Sweep (Reversible Shield Split)',
    category: 'split',
    description:
      'Ultra-compact 34-key split keyboard using reversible PCBs (cradio_left and cradio_right generated from common cradio base).',
    notes:
      'Tests reversible shield detection and 34-key minimalist layout handling.',
    repo: {
      owner: 'sweep-minimalist',
      repo: 'zmk-cradio-config',
      branch: 'main',
    },
    topology: {
      partsCount: 2,
      type: 'split',
      displayCount: 2,
      hasBattery: true,
      isWireless: true,
      centralRole: 'left',
    },
    buildYaml: `---
include:
  - board: nice_nano_v2
    shield: cradio_left
  - board: nice_nano_v2
    shield: cradio_right
`,
    confFiles: [
      {
        path: 'config/cradio.conf',
        content: `CONFIG_ZMK_DISPLAY=y
CONFIG_SSD1306=y
CONFIG_ZMK_DISPLAY_STATUS_SCREEN_CUSTOM=y
CONFIG_ZMK_IDLE_TIMEOUT=30000
`,
      },
    ],
    keymapFile: {
      path: 'config/cradio.keymap',
      content: `#include <behaviors.dtsi>
#include <dt-bindings/zmk/keys.h>

/ {
    keymap {
        compatible = "zmk,keymap";
        default_layer {
            display-name = "Sweep";
            bindings = <
                &kp Q &kp W &kp F &kp P &kp B   &kp J &kp L &kp U &kp Y &kp SQT
                &kp A &kp R &kp S &kp T &kp G   &kp M &kp N &kp E &kp I &kp O
                &kp Z &kp X &kp C &kp D &kp V   &kp K &kp H &kp COMMA &kp DOT &kp FSLH
                            &kp TAB &kp SPACE   &kp RET &kp BSPC
            >;
        };
    };
};
`,
    },
    expectedShieldIds: ['cradio-left', 'cradio-right'],
    expectedEnabledScreens: ['central', 'peripheral'],
  },

  {
    id: 'reversible-right-central',
    name: 'Cradio / Sweep Split (Right Central, Left Peripheral)',
    category: 'split',
    description:
      'Reversible split keyboard where the right half acts as the Bluetooth central coordinator and USB host, while the left half is peripheral.',
    notes:
      'Tests explicit CONFIG_ZMK_SPLIT_ROLE_CENTRAL=y detection on right half, assigning right to central and left to peripheral.',
    repo: {
      owner: 'southpaw-builder',
      repo: 'zmk-cradio-right-central',
      branch: 'main',
    },
    topology: {
      partsCount: 2,
      type: 'split',
      displayCount: 2,
      hasBattery: true,
      isWireless: true,
      centralRole: 'right',
    },
    buildYaml: `---
include:
  - board: nice_nano_v2
    shield: cradio_right
    cmake-args: -DCONFIG_ZMK_SPLIT_ROLE_CENTRAL=y
  - board: nice_nano_v2
    shield: cradio_left
    cmake-args: -DCONFIG_ZMK_SPLIT_ROLE_CENTRAL=n
`,
    confFiles: [
      {
        path: 'config/cradio.conf',
        content: `CONFIG_ZMK_DISPLAY=y
CONFIG_SSD1306=y
CONFIG_ZMK_DISPLAY_STATUS_SCREEN_CUSTOM=y
CONFIG_ZMK_IDLE_TIMEOUT=30000
`,
      },
      {
        path: 'config/cradio_right.conf',
        content: `CONFIG_ZMK_SPLIT_ROLE_CENTRAL=y
CONFIG_ZMK_IDLE_TIMEOUT=30000
`,
      },
    ],
    keymapFile: {
      path: 'config/cradio.keymap',
      content: `#include <behaviors.dtsi>
#include <dt-bindings/zmk/keys.h>

/ {
    keymap {
        compatible = "zmk,keymap";
        default_layer {
            display-name = "RightCentral";
            bindings = <
                &kp Q &kp W &kp F &kp P &kp B   &kp J &kp L &kp U &kp Y &kp SQT
                &kp A &kp R &kp S &kp T &kp G   &kp M &kp N &kp E &kp I &kp O
                &kp Z &kp X &kp C &kp D &kp V   &kp K &kp H &kp COMMA &kp DOT &kp FSLH
                            &kp TAB &kp SPACE   &kp RET &kp BSPC
            >;
        };
    };
};
`,
    },
    expectedShieldIds: ['cradio-left', 'cradio-right'],
    expectedEnabledScreens: ['central', 'peripheral'],
  },

  {
    id: 'xiao-rp2040-unibody',
    name: 'Seeed XIAO RP2040 Unibody (Wired-Only, No Battery)',
    category: 'unibody',
    description:
      'Ultra-compact 36-key unibody keyboard powered by Seeed Studio XIAO RP2040. Direct USB-C connection, no wireless/battery hardware, single vertical OLED.',
    notes:
      'Tests unibody single-shield detection on Seeed XIAO RP2040, verifying single screen enforcement and zero peripheral blocks.',
    repo: {
      owner: 'xiao-designer',
      repo: 'zmk-xiao-unibody',
      branch: 'main',
    },
    topology: {
      partsCount: 1,
      type: 'unibody',
      displayCount: 1,
      hasBattery: false,
      isWireless: false,
      centralRole: 'single',
    },
    buildYaml: `---
include:
  - board: seeed_xiao_rp2040
    shield: xiaounibody
  - board: seeed_xiao_rp2040
    shield: settings_reset
`,
    confFiles: [
      {
        path: 'config/xiaounibody.conf',
        content: `CONFIG_ZMK_DISPLAY=y
CONFIG_SSD1306=y
CONFIG_ZMK_DISPLAY_STATUS_SCREEN_CUSTOM=y
CONFIG_SCYAN_ROTATION_90=y
CONFIG_ZMK_IDLE_TIMEOUT=60000
`,
      },
    ],
    keymapFile: {
      path: 'config/xiaounibody.keymap',
      content: `#include <behaviors.dtsi>
#include <dt-bindings/zmk/keys.h>

/ {
    keymap {
        compatible = "zmk,keymap";
        default_layer {
            display-name = "Base";
            bindings = <
                &kp Q &kp W &kp E &kp R   &kp U &kp I &kp O &kp P
                &kp A &kp S &kp D &kp F   &kp J &kp K &kp L &kp SEMI
            >;
        };
    };
};
`,
    },
    shieldFiles: [
      {
        path: 'boards/shields/xiaounibody/Kconfig.shield',
        content: `config SHIELD_XIAOUNIBODY
    def_bool $(shields_list_contains,xiaounibody)
`,
      },
    ],
    expectedShieldIds: ['xiaounibody'],
    expectedEnabledScreens: ['central'],
  },

  {
    id: 'dongle-headless-split',
    name: 'Headless Central Dongle + 2 Peripheral Displays',
    category: 'dongle',
    description:
      'Dedicated central USB dongle (no display) acting as wireless coordinator, while both left and right keyboard halves feature battery and OLED displays.',
    notes:
      'Tests assigning peripheral and peripheral-2 to halves while central dongle has no display.',
    repo: {
      owner: 'dongle-master',
      repo: 'zmk-dongle-peripherals',
      branch: 'main',
    },
    topology: {
      partsCount: 3,
      type: 'dongle-split',
      displayCount: 2,
      hasBattery: true,
      isWireless: true,
      centralRole: 'dongle',
    },
    buildYaml: `---
include:
  - board: seeeduino_xiao_ble
    shield: custom_dongle
  - board: nice_nano_v2
    shield: custom_split_left
  - board: nice_nano_v2
    shield: custom_split_right
`,
    confFiles: [
      {
        path: 'config/custom_split.conf',
        content: `CONFIG_ZMK_DISPLAY=y
CONFIG_SSD1306=y
CONFIG_ZMK_DISPLAY_STATUS_SCREEN_CUSTOM=y
CONFIG_ZMK_IDLE_TIMEOUT=30000
`,
      },
    ],
    keymapFile: {
      path: 'config/custom_split.keymap',
      content: `#include <behaviors.dtsi>
#include <dt-bindings/zmk/keys.h>

/ {
    keymap {
        compatible = "zmk,keymap";
        default_layer {
            display-name = "Dongle";
            bindings = <
                &kp A &kp B &kp C
            >;
        };
    };
};
`,
    },
    expectedShieldIds: ['custom-dongle', 'custom-split-left', 'custom-split-right'],
    expectedEnabledScreens: ['peripheral', 'peripheral-2'],
  },
];

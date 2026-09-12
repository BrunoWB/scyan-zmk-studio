export interface ShieldDisplayConfig {
  screenCount: 1 | 2;
  nativeResolution: { width: number; height: number };
  defaultOrientation: 'vertical' | 'horizontal';
  physicalMount: string;
  displayType: string;
  bus: 'I2C' | 'SPI';
  rotation: 90 | 270 | 0;
  pinout: {
    sda: string;
    scl: string;
    vcc: string;
    gnd: string;
  };
}

export interface ShieldDefinition {
  id: string;
  name: string;
  author: string;
  category: 'split-pair' | 'single-piece';
  keysCount: string;
  formFactor: string;
  layoutDesc: string;
  displayConfig: ShieldDisplayConfig;
  features: string[];
  controllerCompatibility: string[];
  zmkTarget: string;
  kconfigSnippet: string;
  mountingNotes: string;
  behaviorNotes: string;
}

export const KNOWN_SHIELDS: ShieldDefinition[] = [
  // ==========================================
  // SPLIT PAIRS
  // ==========================================
  {
    id: 'corne',
    name: 'Corne (CRKBD)',
    author: 'foostan (Kosuke Adachi)',
    category: 'split-pair',
    keysCount: '42 or 36 keys',
    formFactor: 'Ergonomic Split (3x6+3 or 3x5+3)',
    layoutDesc: 'Columnar stagger split keyboard with 3 thumb keys per half and snap-off 6th column.',
    displayConfig: {
      screenCount: 2,
      nativeResolution: { width: 32, height: 128 },
      defaultOrientation: 'vertical',
      physicalMount: 'Vertical socket bay parallel to the inner column, directly flanking the microcontroller.',
      displayType: '0.91" SSD1306 OLED (128x32 physical)',
      bus: 'I2C',
      rotation: 90,
      pinout: {
        sda: 'P0.17 (Pro Micro Pin 2)',
        scl: 'P0.20 (Pro Micro Pin 3)',
        vcc: 'VCC (3.3V / RAW)',
        gnd: 'GND',
      },
    },
    features: [
      'Dual 128x32 OLED screens',
      'Vertical 32x128 virtual blitter with 90° runtime rotation',
      'Per-key RGB & Underglow support',
      'Hotswap Kailh Choc or MX sockets',
      'Independent Peripheral Battery Telemetry',
    ],
    controllerCompatibility: ['nice!nano v2', 'Pro Micro', 'RP2040-Zero', 'SuperMini nRF52840'],
    zmkTarget: '-DSHIELD=corne_left -DSHIELD=corne_right',
    kconfigSnippet: `# Corne OLED Configuration
CONFIG_ZMK_DISPLAY=y
CONFIG_ZMK_DISPLAY_STATUS_SCREEN_BUILT_IN=y
CONFIG_ZMK_SPLIT_BLE_CENTRAL_BATTERY_LEVEL_FETCHING=y
CONFIG_ZMK_SPLIT_BLE_CENTRAL_BATTERY_LEVEL_PROXY=y
CONFIG_SSD1306=y`,
    mountingNotes:
      'The OLED display is mounted vertically over the MCU socket using a 4-pin female header. A transparent acrylic OLED cover protects the glass.',
    behaviorNotes:
      'The central left half displays connection state, active layer, battery levels for both halves, and live WPM chart. The peripheral right half displays idle mascot/animation or custom logo.',
  },
  {
    id: 'lily58',
    name: 'Lily58',
    author: 'kata0510',
    category: 'split-pair',
    keysCount: '58 keys',
    formFactor: 'Ergonomic Split (4x6+4)',
    layoutDesc: 'Columnar stagger 4-row split with dedicated number row and 4 thumb keys per half.',
    displayConfig: {
      screenCount: 2,
      nativeResolution: { width: 128, height: 32 },
      defaultOrientation: 'horizontal',
      physicalMount: 'Horizontal mount at top inner edge above the number row or stacked above the Pro Micro.',
      displayType: '0.91" SSD1306 OLED (128x32 physical)',
      bus: 'I2C',
      rotation: 0,
      pinout: {
        sda: 'P0.17 (Pro Micro Pin 2)',
        scl: 'P0.20 (Pro Micro Pin 3)',
        vcc: 'VCC (3.3V)',
        gnd: 'GND',
      },
    },
    features: [
      'Dual 128x32 OLED screens',
      'Native horizontal status bar blit (128x32)',
      'Dedicated number row for programming',
      'Supports rotary encoder in outer top slot',
    ],
    controllerCompatibility: ['nice!nano v2', 'Pro Micro', 'RP2040 ProMicro'],
    zmkTarget: '-DSHIELD=lily58_left -DSHIELD=lily58_right',
    kconfigSnippet: `# Lily58 OLED Configuration
CONFIG_ZMK_DISPLAY=y
CONFIG_ZMK_DISPLAY_STATUS_SCREEN_BUILT_IN=y
CONFIG_SSD1306=y`,
    mountingNotes:
      'Mounted horizontally across the top inner section. Both 128x32 horizontal orientation and 32x128 vertical orientations are supported.',
    behaviorNotes:
      'Wide horizontal 128x32 canvas allows single-row combined telemetry (Layer label, BLE profile pills, WPM counter, and dual battery gauges side-by-side).',
  },
  {
    id: 'sofle',
    name: 'Sofle (v1 / v2 / RGB)',
    author: 'Josef Adamčík',
    category: 'split-pair',
    keysCount: '58 or 60 keys',
    formFactor: 'Ergonomic Split (4x6+5)',
    layoutDesc: 'Lily58-inspired split with thumb arc, dedicated number row, and dual EC11 rotary encoders.',
    displayConfig: {
      screenCount: 2,
      nativeResolution: { width: 128, height: 32 },
      defaultOrientation: 'horizontal',
      physicalMount: 'Horizontal socket bay adjacent to the rotary encoder and above the Pro Micro socket.',
      displayType: '0.91" SSD1306 OLED (128x32 physical)',
      bus: 'I2C',
      rotation: 0,
      pinout: {
        sda: 'P0.17 (Pin 2)',
        scl: 'P0.20 (Pin 3)',
        vcc: 'VCC (3.3V)',
        gnd: 'GND',
      },
    },
    features: [
      'Dual 128x32 OLED screens',
      'Dual EC11 Rotary Encoders',
      'Per-key RGB Backlight & Underglow (RGB rev)',
      'Aggressive thumb cluster arc',
    ],
    controllerCompatibility: ['nice!nano v2', 'Pro Micro', 'RP2040-Zero', 'SuperMini nRF52840'],
    zmkTarget: '-DSHIELD=sofle_left -DSHIELD=sofle_right',
    kconfigSnippet: `# Sofle OLED & Encoder Configuration
CONFIG_ZMK_DISPLAY=y
CONFIG_SSD1306=y
CONFIG_EC11=y
CONFIG_EC11_TRIGGER_GLOBAL_THREAD=y`,
    mountingNotes:
      'Positioned directly above the rotary encoders. Clear acrylic guards protect the displays while keeping encoder knobs accessible.',
    behaviorNotes:
      'OLED displays real-time encoder action feedback (volume dB, scroll step, brush size) alongside standard layer and connection diagnostics.',
  },
  {
    id: 'ferris-sweep',
    name: 'Ferris Sweep (Sweep / Bling)',
    author: 'David Philip Barr & Pierre Chevalier',
    category: 'split-pair',
    keysCount: '34 keys',
    formFactor: 'Ultra-Compact Split (3x5+2)',
    layoutDesc: 'Minimalist 34-key split keyboard using direct pin matrix or shift registers with 2 thumb keys.',
    displayConfig: {
      screenCount: 2,
      nativeResolution: { width: 32, height: 128 },
      defaultOrientation: 'vertical',
      physicalMount: 'Vertical socket or daughterboard directly overlying the central microcontroller.',
      displayType: '0.91" SSD1306 OLED or nice!view (160x68 Sharp Memory)',
      bus: 'I2C',
      rotation: 90,
      pinout: {
        sda: 'P0.17',
        scl: 'P0.20',
        vcc: '3.3V',
        gnd: 'GND',
      },
    },
    features: [
      'Ultra-minimalist 34-key footprint',
      'Extremely low power wireless optimization',
      'Direct matrix pinout (zero diodes on Sweep v2)',
      'Compatible with 1bpp OLED or Sharp Memory display',
    ],
    controllerCompatibility: ['nice!nano v2', 'Pro Micro', 'RP2040-Zero'],
    zmkTarget: '-DSHIELD=cradio_left -DSHIELD=cradio_right',
    kconfigSnippet: `# Ferris Sweep Minimal Display
CONFIG_ZMK_DISPLAY=y
CONFIG_SSD1306=y
CONFIG_ZMK_DISPLAY_STATUS_SCREEN_BUILT_IN=y`,
    mountingNotes:
      'Mounted vertically directly over the face of the microcontroller to save board area and maintain an ultra-compact silhouette.',
    behaviorNotes:
      'Due to aggressive 34-key layer switching (home row mods, combos), the vertical OLED layer indicator is essential for immediate tactile confidence.',
  },
  {
    id: 'kyria',
    name: 'Kyria (rev1 / rev2 / rev3)',
    author: 'Thomas Baart (splitkb.com)',
    category: 'split-pair',
    keysCount: '40 to 50 keys',
    formFactor: 'Aggressive Columnar Stagger Split',
    layoutDesc: 'Ergonomic split with aggressive pinky stagger, 2u thumb keys, dual encoders, and 128x64 OLED support.',
    displayConfig: {
      screenCount: 2,
      nativeResolution: { width: 128, height: 64 },
      defaultOrientation: 'horizontal',
      physicalMount: 'Central inner bay between the inner keys and the controller, accommodating 0.96" 128x64 or 0.91" 128x32 screens.',
      displayType: '0.96" SSD1306 OLED (128x64 high resolution)',
      bus: 'I2C',
      rotation: 0,
      pinout: {
        sda: 'P0.17 (SDA)',
        scl: 'P0.20 (SCL)',
        vcc: '3.3V / VCC',
        gnd: 'GND',
      },
    },
    features: [
      'High-resolution 128x64 or 128x32 OLED support',
      'Up to 2 rotary encoders per half',
      'Aggressive pinky stagger column matching natural hand geometry',
      'Expanded thumb cluster with 2u keys',
    ],
    controllerCompatibility: ['nice!nano v2', 'Pro Micro', 'Elite-C', 'RP2040'],
    zmkTarget: '-DSHIELD=kyria_rev3_left -DSHIELD=kyria_rev3_right',
    kconfigSnippet: `# Kyria 128x64 High-Res OLED
CONFIG_ZMK_DISPLAY=y
CONFIG_SSD1306=y
CONFIG_SSD1306_DEFAULT_CONTRAST=128`,
    mountingNotes:
      'Sockets support both standard 128x32 (0.91") and wider 128x64 (0.96") OLED glass modules. High contrast mode is configured via Kconfig.',
    behaviorNotes:
      'The 128x64 double-height display allows real-time live WPM graph telemetry, extended symbol art, and full layer name previews simultaneously.',
  },
  {
    id: 'iris',
    name: 'Iris (Keebio Iris)',
    author: 'Keebio',
    category: 'split-pair',
    keysCount: '56 keys',
    formFactor: 'Ergonomic Split (4x6+4)',
    layoutDesc: 'Keebio signature split keyboard with 4-row matrix, thumb cluster, and optional rotary encoder.',
    displayConfig: {
      screenCount: 2,
      nativeResolution: { width: 128, height: 32 },
      defaultOrientation: 'horizontal',
      physicalMount: 'Top inner corner socket located immediately adjacent to the TRRS / USB-C interconnect port.',
      displayType: '0.91" SSD1306 OLED (128x32 physical)',
      bus: 'I2C',
      rotation: 0,
      pinout: {
        sda: 'P0.17',
        scl: 'P0.20',
        vcc: 'VCC',
        gnd: 'GND',
      },
    },
    features: [
      'Dual 128x32 OLED displays',
      'Optional rotary encoder at thumb or top corner',
      'Proven ergonomic geometry with comfortable thumb arc',
      'Per-key RGB LED lighting',
    ],
    controllerCompatibility: ['nice!nano v2', 'Pro Micro', 'Keebio Onboard MCU'],
    zmkTarget: '-DSHIELD=iris_rev4_left -DSHIELD=iris_rev4_right',
    kconfigSnippet: `# Iris Display Config
CONFIG_ZMK_DISPLAY=y
CONFIG_SSD1306=y`,
    mountingNotes:
      'Top corner placement keeps the display visible without interfering with hands or palm rests.',
    behaviorNotes:
      'Left master OLED delivers instant profile indicators while the right peripheral screen displays custom idle graphics or animated bongo mascot.',
  },

  // ==========================================
  // SINGLE-PIECE & DONGLES
  // ==========================================
  {
    id: 'reviung41',
    name: 'Reviung41',
    author: 'gtips',
    category: 'single-piece',
    keysCount: '41 keys',
    formFactor: 'Unibody Columnar-Stagger (3x6+5)',
    layoutDesc: 'Single-piece angled unibody keyboard combining both hands on one PCB with central display diamond.',
    displayConfig: {
      screenCount: 1,
      nativeResolution: { width: 128, height: 32 },
      defaultOrientation: 'horizontal',
      physicalMount: 'Center horizontal diamond mount nestled in the V-angle between the left and right key clusters.',
      displayType: '0.91" SSD1306 OLED (128x32 physical)',
      bus: 'I2C',
      rotation: 0,
      pinout: {
        sda: 'P0.17 (Pin 2)',
        scl: 'P0.20 (Pin 3)',
        vcc: '3.3V',
        gnd: 'GND',
      },
    },
    features: [
      'Central unified 128x32 horizontal OLED',
      'Single PCB unibody architecture',
      'Integrated underglow acrylic diffuser',
      'Ergonomic inward angle between hands',
    ],
    controllerCompatibility: ['nice!nano v2', 'Pro Micro', 'RP2040 ProMicro'],
    zmkTarget: '-DSHIELD=reviung41',
    kconfigSnippet: `# Reviung41 Single OLED
CONFIG_ZMK_DISPLAY=y
CONFIG_SSD1306=y
CONFIG_ZMK_DISPLAY_STATUS_SCREEN_BUILT_IN=y`,
    mountingNotes:
      'Display is mounted horizontally in the center cutout of the switch plate, facing the user directly between both hands.',
    behaviorNotes:
      'Single screen serves as the master information display for both hands: battery percentage, active layer, USB/BLE connection, and typing speed.',
  },
  {
    id: 'reviung34',
    name: 'Reviung34',
    author: 'gtips',
    category: 'single-piece',
    keysCount: '34 keys',
    formFactor: 'Ultra-Compact Unibody (3x5+2)',
    layoutDesc: 'Ultra-compact unibody with 3x5 layout per hand and 2 shared center thumb keys.',
    displayConfig: {
      screenCount: 1,
      nativeResolution: { width: 128, height: 32 },
      defaultOrientation: 'horizontal',
      physicalMount: 'Centered at the top edge above the inner index columns.',
      displayType: '0.91" SSD1306 OLED (128x32 physical)',
      bus: 'I2C',
      rotation: 0,
      pinout: {
        sda: 'P0.17',
        scl: 'P0.20',
        vcc: '3.3V',
        gnd: 'GND',
      },
    },
    features: [
      'Extreme minimalist unibody footprint',
      'Centered single OLED display',
      'Direct switch routing',
      'Ultra portable pocket mechanical keyboard',
    ],
    controllerCompatibility: ['nice!nano v2', 'Pro Micro', 'RP2040-Zero'],
    zmkTarget: '-DSHIELD=reviung34',
    kconfigSnippet: `# Reviung34 OLED
CONFIG_ZMK_DISPLAY=y
CONFIG_SSD1306=y`,
    mountingNotes:
      'Top-centered OLED provides clear line-of-sight while keeping key travel unobstructed.',
    behaviorNotes:
      'Essential layer feedback for 34-key modal navigation (Nav, Sym, Num, Media, Mouse layers).',
  },
  {
    id: 'xiao-dongle',
    name: 'Seeed XIAO BLE Dongle',
    author: 'Open Source ZMK Community',
    category: 'single-piece',
    keysCount: '0 keys (Host Dongle Master)',
    formFactor: 'Wireless USB Dongle Enclosure',
    layoutDesc: 'Central master receiver node bridging dual wireless split halves to the host computer with custom OLED telemetry.',
    displayConfig: {
      screenCount: 1,
      nativeResolution: { width: 32, height: 128 },
      defaultOrientation: 'vertical',
      physicalMount: 'Integrated directly into the dongle body enclosure with USB-A plug protruding.',
      displayType: '0.91" SSD1306 OLED (128x32 physical)',
      bus: 'I2C',
      rotation: 90,
      pinout: {
        sda: 'D4 (P0.04 / SDA)',
        scl: 'D5 (P0.05 / SCL)',
        vcc: '3.3V',
        gnd: 'GND',
      },
    },
    features: [
      'Central Dongle Master architecture',
      'Tri-screen telemetry (monitors Left Half, Right Half & Dongle connection)',
      'Eliminates peripheral BLE master power drain on split keyboards',
      'Integrated USB-A interface with 3D-printable case',
    ],
    controllerCompatibility: ['Seeed Studio XIAO BLE (nRF52840)', 'XIAO RP2040'],
    zmkTarget: '-DSHIELD=xiao_dongle -DBOARD=seeeduino_xiao_ble',
    kconfigSnippet: `# ZMK Central Dongle Configuration
CONFIG_ZMK_SPLIT_BLE_ROLE_CENTRAL=y
CONFIG_ZMK_DISPLAY=y
CONFIG_SSD1306=y
CONFIG_ZMK_SPLIT_BLE_CENTRAL_BATTERY_LEVEL_FETCHING=y
CONFIG_ZMK_SPLIT_BLE_CENTRAL_BATTERY_LEVEL_PROXY=y`,
    mountingNotes:
      'The OLED sits in a sleek USB stick form-factor case with an acrylic or PETG diffuser window, plugged directly into PC or USB hub.',
    behaviorNotes:
      'Because split keyboards connect as wireless peripherals to the dongle, the dongle screen displays real-time battery status for BOTH sides, BLE connection quality, and active modifier locks.',
  },
  {
    id: 'tidbit',
    name: 'TIDBIT 19-key',
    author: 'nullbits',
    category: 'single-piece',
    keysCount: '19 keys',
    formFactor: 'Mechanical Numpad / Macropad',
    layoutDesc: '19-key customizable numpad and macropad featuring rotary encoders, bit display, and RGB underglow.',
    displayConfig: {
      screenCount: 1,
      nativeResolution: { width: 128, height: 32 },
      defaultOrientation: 'horizontal',
      physicalMount: 'Top horizontal header slot situated directly above the number pad matrix.',
      displayType: '0.91" SSD1306 OLED or 0.96" SSD1306 OLED',
      bus: 'I2C',
      rotation: 0,
      pinout: {
        sda: 'Pro Micro Pin 2',
        scl: 'Pro Micro Pin 3',
        vcc: '3.3V',
        gnd: 'GND',
      },
    },
    features: [
      'Top-mounted 128x32 or 128x64 OLED display',
      'Dual rotary encoder positions',
      'Versatile 19-key numpad / macro matrix',
      'Integrated bit display LEDs',
    ],
    controllerCompatibility: ['nice!nano v2', 'Pro Micro', 'Elite-C', 'RP2040 ProMicro'],
    zmkTarget: '-DSHIELD=tidbit',
    kconfigSnippet: `# TIDBIT Macropad OLED
CONFIG_ZMK_DISPLAY=y
CONFIG_SSD1306=y`,
    mountingNotes:
      'Top-aligned horizontal mounting allows comfortable desk viewing next to primary split keyboards or full-size mice.',
    behaviorNotes:
      'Displays active macropad mode (Numpad, Blender, Photoshop, Terminal navigation) and encoder scrubbing values.',
  },
];

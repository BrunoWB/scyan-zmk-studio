import YAML from 'yaml';

export interface ShieldDisplayConfig {
  screenCount: 1 | 2;
  nativeResolution: { width: number; height: number };
  defaultOrientation: 'vertical' | 'horizontal';
  physicalMount: string;
  displayType: string;
  bus: 'I2C' | 'SPI';
  rotation: 0 | 90 | 180 | 270;
  pinout: {
    sda: string;
    scl: string;
    vcc: string;
    gnd: string;
  };
}

export interface ShieldLayoutGeometry {
  type: 'split-pair' | 'unibody' | 'dongle' | 'numpad' | 'unknown';
  columns: number;
  rows: number;
  columnStaggers: number[];
  thumbCount: number;
  oledMount:
    | 'inner-vertical'
    | 'top-inner-horizontal'
    | 'inner-horizontal'
    | 'center-notch'
    | 'top-center'
    | 'top-horizontal'
    | 'dongle-center'
    | 'unknown-center';
  oledLabel: string;
  hasEncoder?: boolean;
  encoderCount?: number;
  encoderLabel?: string;
  hasSnapOff?: boolean;
  angle?: number;
  description: string;
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
  layoutGeometry: ShieldLayoutGeometry;
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
      nativeResolution: { width: 128, height: 32 },
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
    layoutGeometry: {
      type: 'split-pair',
      columns: 6,
      rows: 3,
      columnStaggers: [14, 8, -2, -8, 0, 4],
      thumbCount: 3,
      oledMount: 'inner-vertical',
      oledLabel: 'Inner Vertical Bay (Parallel to MCU)',
      hasSnapOff: true,
      description:
        'Columnar stagger split with 3 rows, 6 columns per half, and 3 thumb keys. Outer 6th column can snap off for a 3x5+3 compact footprint.',
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
    layoutGeometry: {
      type: 'split-pair',
      columns: 6,
      rows: 4,
      columnStaggers: [10, 6, -2, -6, 0, 4],
      thumbCount: 4,
      oledMount: 'top-inner-horizontal',
      oledLabel: 'Top-Inner Horizontal Bay',
      hasEncoder: true,
      encoderCount: 1,
      encoderLabel: 'Optional Rotary Encoder in outer/top slot',
      description:
        '4 rows with dedicated number row, 6 columns per half, 4 thumb/inner keys, and horizontal OLED mounted at the top-inner edge.',
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
    layoutGeometry: {
      type: 'split-pair',
      columns: 6,
      rows: 4,
      columnStaggers: [10, 6, -2, -6, 0, 4],
      thumbCount: 5,
      oledMount: 'top-inner-horizontal',
      oledLabel: 'Top-Inner Horizontal Bay with Encoder',
      hasEncoder: true,
      encoderCount: 2,
      encoderLabel: 'Dual EC11 Rotary Encoders',
      description:
        '4-row matrix with dedicated number row, 5-key ergonomic thumb arc, dual EC11 encoders, and top-inner horizontal OLED modules.',
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
      nativeResolution: { width: 128, height: 32 },
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
    layoutGeometry: {
      type: 'split-pair',
      columns: 5,
      rows: 3,
      columnStaggers: [14, 4, -6, 0, 4],
      thumbCount: 2,
      oledMount: 'inner-vertical',
      oledLabel: 'Inner MCU Overlay Bay',
      description:
        'Minimalist 34-key layout (3x5+2) with vertical OLED mounted directly over the microcontroller socket.',
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
    layoutGeometry: {
      type: 'split-pair',
      columns: 6,
      rows: 3,
      columnStaggers: [24, 16, -2, -10, 0, 6],
      thumbCount: 5,
      oledMount: 'inner-horizontal',
      oledLabel: 'Inner High-Res 128x64 Bay',
      hasEncoder: true,
      encoderCount: 2,
      encoderLabel: 'Dual Encoders Support',
      description:
        'Aggressive pinky stagger matching natural finger lengths, fanning 5-key thumb cluster, and 128x64 high-res OLED.',
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
    layoutGeometry: {
      type: 'split-pair',
      columns: 6,
      rows: 4,
      columnStaggers: [10, 4, -4, -8, 0, 4],
      thumbCount: 4,
      oledMount: 'top-inner-horizontal',
      oledLabel: 'Top-Inner Corner Bay',
      description:
        'Keebio signature 4x6+4 ergonomic split with top-inner corner horizontal 128x32 OLED display.',
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
    layoutGeometry: {
      type: 'unibody',
      columns: 6,
      rows: 3,
      columnStaggers: [10, 6, -2, -6, 0, 4],
      thumbCount: 5,
      oledMount: 'center-notch',
      oledLabel: 'Center V-Notch Diamond Bay',
      angle: 12,
      description:
        'Single-piece unibody with hands angled inward at 12°, central horizontal 128x32 OLED in diamond cutout, and 5 shared center thumb keys.',
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
    layoutGeometry: {
      type: 'unibody',
      columns: 5,
      rows: 3,
      columnStaggers: [10, 4, -4, 0, 4],
      thumbCount: 4,
      oledMount: 'top-center',
      oledLabel: 'Top Center Bridge Bay',
      angle: 10,
      description:
        'Ultra-compact unibody with 3x5 keys per hand, top-centered horizontal OLED, and shared thumb keys.',
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
      nativeResolution: { width: 128, height: 32 },
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
    layoutGeometry: {
      type: 'dongle',
      columns: 0,
      rows: 0,
      columnStaggers: [],
      thumbCount: 0,
      oledMount: 'dongle-center',
      oledLabel: 'Central Dongle Enclosure',
      description:
        'Wireless USB dongle enclosure with USB-A plug on top and integrated vertical 32x128 OLED telemetry screen (0 keys).',
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
    layoutGeometry: {
      type: 'numpad',
      columns: 4,
      rows: 5,
      columnStaggers: [0, 0, 0, 0],
      thumbCount: 0,
      oledMount: 'top-horizontal',
      oledLabel: 'Top Horizontal Header Bay',
      hasEncoder: true,
      encoderCount: 1,
      encoderLabel: 'Top Rotary Encoder',
      description:
        '19-key mechanical numpad with top-mounted horizontal OLED display, rotary encoder, and blank numpad keycaps.',
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
  {
    id: 'unknown',
    name: 'Custom / Unknown Shield',
    author: 'Generic ZMK Device',
    category: 'single-piece',
    keysCount: 'Custom Hardware',
    formFactor: 'Enclosure / Custom PCB',
    layoutDesc: 'Generic standalone OLED display mount with direct telemetry for custom shields and handwired keyboards.',
    displayConfig: {
      screenCount: 1,
      nativeResolution: { width: 128, height: 32 },
      defaultOrientation: 'vertical',
      physicalMount: 'Direct custom PCB mounting with isolated OLED enclosure.',
      displayType: '0.91" SSD1306 OLED (128x32 physical)',
      bus: 'I2C',
      rotation: 90,
      pinout: {
        sda: 'SDA',
        scl: 'SCL',
        vcc: '3.3V',
        gnd: 'GND',
      },
    },
    layoutGeometry: {
      type: 'unknown',
      columns: 0,
      rows: 0,
      columnStaggers: [],
      thumbCount: 0,
      oledMount: 'unknown-center',
      oledLabel: 'Generic Display Enclosure',
      description: 'Generic purple enclosure wrapper for custom/unknown shields without USB connector.',
    },
    features: [
      'Custom shield and handwired keyboard compatibility',
      'Direct 1bpp OLED display telemetry',
      'Supports arbitrary screen dimensions',
      'Automatic fallback for unrecognized shields',
    ],
    controllerCompatibility: ['Any ZMK Supported MCU (Pro Micro, nice!nano, XIAO, RP2040)'],
    zmkTarget: '-DSHIELD=custom',
    kconfigSnippet: `# Generic ZMK Display Configuration
CONFIG_ZMK_DISPLAY=y
CONFIG_SSD1306=y`,
    mountingNotes: 'Compact standalone purple enclosure wrapper for OLED display monitoring.',
    behaviorNotes: 'Displays telemetry on custom hardware not present in the pre-defined catalog.',
  },
];

export const UNKNOWN_SHIELD: ShieldDefinition = KNOWN_SHIELDS[KNOWN_SHIELDS.length - 1];

export function getShieldDefinition(shieldId?: string | null): ShieldDefinition {
  if (!shieldId) return KNOWN_SHIELDS[0];
  const normalized = shieldId.toLowerCase().replace(/_/g, '-');
  const found = KNOWN_SHIELDS.find((s) => s.id === shieldId || s.id === normalized);
  if (found) return found;

  return {
    ...UNKNOWN_SHIELD,
    id: shieldId,
    name: shieldId === 'unknown' ? 'Custom / Unknown Shield' : `${shieldId} (Custom Shield)`,
  };
}

/**
 * Returns the default rotation angle (0, 90, 180, 270) defined in the shield dictionary.
 * Defaults to 90° for vertical shields (Corne, Sweep) and 0° for horizontal (Lily58, Sofle).
 */
export function getShieldDefaultRotation(shieldId?: string | null): 0 | 90 | 180 | 270 {
  const def = getShieldDefinition(shieldId);
  if (def?.displayConfig?.rotation !== undefined) {
    return def.displayConfig.rotation as 0 | 90 | 180 | 270;
  }
  if (def?.displayConfig?.defaultOrientation === 'vertical') {
    return 90;
  }
  return 0;
}

/**
 * Returns the standardized hardware screen spec dimensions (e.g. 128x32, 128x64) from the shield dictionary.
 */
export function getShieldHardwareResolution(shieldId?: string | null): { width: number; height: number } {
  const def = getShieldDefinition(shieldId);
  const native = def?.displayConfig?.nativeResolution || { width: 128, height: 32 };
  const w = Math.max(native.width, native.height);
  const h = Math.min(native.width, native.height);
  return { width: w, height: h };
}

/**
 * Returns the active virtual display resolution for a shield ID, applying its default orientation / rotation.
 * E.g., Corne (128x32 hardware @ 90° vertical) returns { width: 32, height: 128 }.
 * Lily58 (128x32 hardware @ 0° horizontal) returns { width: 128, height: 32 }.
 */
export function getShieldDefaultResolution(shieldId?: string | null): { width: number; height: number } {
  const def = getShieldDefinition(shieldId);
  if (!def?.displayConfig) return { width: 32, height: 128 };
  const { nativeResolution, rotation, defaultOrientation } = def.displayConfig;
  const isVertical = rotation === 90 || rotation === 270 || defaultOrientation === 'vertical';
  const minDim = Math.min(nativeResolution.width, nativeResolution.height);
  const maxDim = Math.max(nativeResolution.width, nativeResolution.height);
  return isVertical ? { width: minDim, height: maxDim } : { width: maxDim, height: minDim };
}

export type ShieldPartSide = 'left' | 'right' | 'single' | 'dongle';

export interface ShieldPartItem {
  id: string;
  shieldId: string;
  name: string;
  category: 'split-half' | 'single-piece';
  side: ShieldPartSide;
  shield: ShieldDefinition;
  keyCount: number;
}

export function getShieldParts(): ShieldPartItem[] {
  const parts: ShieldPartItem[] = [];

  for (const shield of KNOWN_SHIELDS) {
    if (shield.layoutGeometry.type === 'split-pair') {
      const keysPerHalf =
        shield.layoutGeometry.rows * shield.layoutGeometry.columns +
        shield.layoutGeometry.thumbCount;

      parts.push({
        id: `${shield.id}_left`,
        shieldId: shield.id,
        name: `${shield.name} (Left Half)`,
        category: 'split-half',
        side: 'left',
        shield,
        keyCount: keysPerHalf,
      });

      parts.push({
        id: `${shield.id}_right`,
        shieldId: shield.id,
        name: `${shield.name} (Right Half)`,
        category: 'split-half',
        side: 'right',
        shield,
        keyCount: keysPerHalf,
      });
    } else if (shield.layoutGeometry.type === 'dongle') {
      parts.push({
        id: shield.id,
        shieldId: shield.id,
        name: shield.name,
        category: 'single-piece',
        side: 'dongle',
        shield,
        keyCount: 0,
      });
    } else if (shield.layoutGeometry.type === 'numpad') {
      parts.push({
        id: shield.id,
        shieldId: shield.id,
        name: shield.name,
        category: 'single-piece',
        side: 'single',
        shield,
        keyCount: 19,
      });
    } else if (shield.layoutGeometry.type === 'unibody') {
      const count = shield.id === 'reviung41' ? 41 : 34;
      parts.push({
        id: shield.id,
        shieldId: shield.id,
        name: shield.name,
        category: 'single-piece',
        side: 'single',
        shield,
        keyCount: count,
      });
    } else if (shield.layoutGeometry.type === 'unknown') {
      parts.push({
        id: shield.id,
        shieldId: shield.id,
        name: shield.name,
        category: 'single-piece',
        side: 'single',
        shield,
        keyCount: 0,
      });
    }
  }

  return parts;
}

export interface LoadedShieldUnit {
  id: string;
  shieldId: string;
  name: string;
  side: ShieldPartSide;
  shield: ShieldDefinition;
  keyCount?: number;
  isMaster?: boolean;
}

export function getShieldUnitsForShield(shieldId?: string | null): LoadedShieldUnit[] {
  const shield = getShieldDefinition(shieldId);
  if (shield.layoutGeometry.type === 'split-pair' || shield.layoutGeometry.type === 'unknown') {
    return [
      {
        id: `${shield.id}_left`,
        shieldId: shield.id,
        name: `${shield.name} (Central)`,
        side: 'left',
        shield,
        isMaster: true,
      },
      {
        id: `${shield.id}_right`,
        shieldId: shield.id,
        name: `${shield.name} (Peripheral)`,
        side: 'right',
        shield,
        isMaster: false,
      },
    ];
  } else if (shield.layoutGeometry.type === 'dongle') {
    return [
      {
        id: shield.id,
        shieldId: shield.id,
        name: shield.name,
        side: 'dongle',
        shield,
        isMaster: true,
      },
    ];
  } else {
    // Unibody or numpad
    return [
      {
        id: shield.id,
        shieldId: shield.id,
        name: shield.name,
        side: 'single',
        shield,
        isMaster: true,
      },
    ];
  }
}

/**
 * Robust AST-based extraction of shield names from build.yaml content.
 * Automatically ignores comments, handles multi-document streams (separated by ---),
 * matrix arrays, multi-line lists, and space-delimited composite shields.
 */
export function extractShieldsFromYaml(yamlContent?: string): string[] {
  if (!yamlContent || !yamlContent.trim()) return [];
  try {
    const docs = YAML.parseAllDocuments(yamlContent);
    const result: string[] = [];

    const collectTokens = (val: unknown) => {
      if (typeof val === 'string') {
        const parts = val.trim().split(/\s+/);
        for (const p of parts) {
          if (p && !result.includes(p)) {
            result.push(p);
          }
        }
      } else if (Array.isArray(val)) {
        for (const item of val) {
          collectTokens(item);
        }
      }
    };

    for (const doc of docs) {
      const data = doc.toJSON();
      if (!data || typeof data !== 'object') continue;

      // 1. Top-level shield matrix (string or array)
      if ('shield' in data) {
        collectTokens((data as Record<string, unknown>).shield);
      }

      // 2. Include list: include: [ { shield: ... }, ... ]
      if ('include' in data && Array.isArray((data as Record<string, unknown>).include)) {
        for (const entry of (data as Record<string, unknown>).include as unknown[]) {
          if (entry && typeof entry === 'object' && 'shield' in entry) {
            collectTokens((entry as Record<string, unknown>).shield);
          }
        }
      }
    }

    return result;
  } catch (err) {
    console.warn('[extractShieldsFromYaml] Error parsing YAML content:', err);
    return [];
  }
}

export function detectShieldUnitsFromRepo(
  primaryShieldId: string = 'corne',
  candidateConfFiles?: string[],
  _keymapFilenames?: string[],
  buildYamlContent?: string
): LoadedShieldUnit[] {
  const units: LoadedShieldUnit[] = [];
  const seenIds = new Set<string>();
  const seenShieldIds = new Set<string>();

  // Check build.yaml content if provided (using robust YAML AST parser)
  if (buildYamlContent) {
    const rawShieldNames = extractShieldsFromYaml(buildYamlContent);
    for (const rawName of rawShieldNames) {
      const sName = rawName.toLowerCase().replace(/_/g, '-');
      if (sName === 'settings-reset') continue;
      const baseName = sName.replace(/-(left|right)$/, '');
      if (!seenShieldIds.has(baseName) && !seenIds.has(sName)) {
        const knownDef = KNOWN_SHIELDS.find((s) => s.id === baseName || s.id === sName);
        if (knownDef) {
          const extraUnits = getShieldUnitsForShield(knownDef.id);
          for (const u of extraUnits) {
            if (!seenIds.has(u.id)) {
              units.push(u);
              seenIds.add(u.id);
            }
          }
          seenShieldIds.add(knownDef.id);
        } else {
          const customUnit: LoadedShieldUnit = {
            id: sName,
            shieldId: sName,
            name: `${rawName} (Shield)`,
            side: sName.includes('dongle') ? 'dongle' : 'single',
            shield: getShieldDefinition(sName),
            isMaster: false,
          };
          units.push(customUnit);
          seenIds.add(sName);
          seenShieldIds.add(sName);
          seenShieldIds.add(baseName);
        }
      }
    }
  }

  // Check candidate conf files
  if (candidateConfFiles) {
    for (const conf of candidateConfFiles) {
      const base = conf.replace(/^.*[/\\]/, '').replace(/\.conf$/, '');
      const cleanBase = base.replace(/_(left|right)$/, '').toLowerCase().replace(/_/g, '-');
      if (cleanBase && !seenShieldIds.has(cleanBase)) {
        const knownDef = KNOWN_SHIELDS.find((s) => s.id === cleanBase);
        if (knownDef) {
          const extraUnits = getShieldUnitsForShield(knownDef.id);
          for (const u of extraUnits) {
            if (!seenIds.has(u.id)) {
              units.push(u);
              seenIds.add(u.id);
            }
          }
          seenShieldIds.add(knownDef.id);
        }
      }
    }
  }

  // If no shields were detected from build.yaml or conf files, fall back to primaryShieldId
  if (units.length === 0) {
    const baseUnits = getShieldUnitsForShield(primaryShieldId);
    units.push(...baseUnits);
  }

  return units;
}

import YAML from 'yaml';
import { resolveMetadataDisplays, type HeaderMetadata } from './cHeaderParser';

export const SCYAN_SHIELD_NAME = 'scyan_screen';
export const SCYAN_SHIELD_DIR = `boards/shields/${SCYAN_SHIELD_NAME}`;
export const ZEPHYR_MODULE_PATH = 'zephyr/module.yml';

export interface ShieldFileAddition {
  path: string;
  content: string;
}

export function getShieldFilePaths(slots?: (number | string)[]): string[] {
  const resolvedSlots = resolveSlotList(slots);
  const paths = [
    `${SCYAN_SHIELD_DIR}/Kconfig.shield`,
    `${SCYAN_SHIELD_DIR}/Kconfig.defconfig`,
    `${SCYAN_SHIELD_DIR}/scyan_screen.overlay`,
  ];
  for (const s of resolvedSlots) {
    paths.push(`${SCYAN_SHIELD_DIR}/${s.fileName}`);
  }
  paths.push(
    `${SCYAN_SHIELD_DIR}/scyan_layouts.dtsi`,
    `${SCYAN_SHIELD_DIR}/scyan_symbols.dtsi`,
  );
  return Array.from(new Set(paths));
}

export const SCYAN_SHIELD_FILE_PATHS = getShieldFilePaths([1, 2]);

export const LEGACY_SHIELD_FILE_PATHS = [
  `${SCYAN_SHIELD_DIR}/scyan_screen_left.overlay`,
  `${SCYAN_SHIELD_DIR}/scyan_screen_right.overlay`,
];

export interface NormalizedSlot {
  slotNum: number | string;
  configSuffix: string;
  shieldName: string;
  fileName: string;
}

export function extractSlotId(slot: number | string): string {
  const str = String(slot).trim().toLowerCase();
  const stripped = str.replace(/^display-?/, '');
  if (stripped === 'central' || stripped === 'left') return '1';
  if (stripped === 'peripheral' || stripped === 'right') return '2';
  const match = str.match(/\d+/);
  return match ? match[0] : str.replace(/^&+/, '').replace(/[^a-zA-Z0-9_]/g, '_');
}

export function normalizeSlot(slot: number | string): NormalizedSlot {
  const extracted = extractSlotId(slot);
  const match = extracted.match(/^\d+$/);
  const slotNum = match ? parseInt(extracted, 10) : extracted;
  const slotStr = String(slotNum);
  const configSuffix = slotStr.toUpperCase();
  const lower = slotStr.toLowerCase();
  return {
    slotNum,
    configSuffix,
    shieldName: `scyan_screen_${lower}`,
    fileName: `scyan_screen_${lower}.overlay`,
  };
}

export function resolveSlotList(slots?: (number | string)[]): NormalizedSlot[] {
  if (!slots || slots.length === 0) {
    return [normalizeSlot(1), normalizeSlot(2)];
  }
  const seen = new Set<string>();
  const result: NormalizedSlot[] = [];
  for (const s of slots) {
    const norm = normalizeSlot(s);
    const key = String(norm.slotNum);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(norm);
    }
  }
  return result;
}

/**
 * Generates Kconfig.shield declaring SHIELD_SCYAN_SCREEN and dynamic SHIELD_SCYAN_SCREEN_<slot> symbols.
 */
export function generateKconfigShield(slots?: (number | string)[]): string {
  const resolvedSlots = resolveSlotList(slots);
  const lines: string[] = [
    '# Copyright (c) 2026 Scyan ZMK Studio',
    '# SPDX-License-Identifier: MIT',
    '',
    'config SHIELD_SCYAN_SCREEN',
    '    def_bool $(shields_list_contains,scyan_screen)',
    '',
  ];

  for (const s of resolvedSlots) {
    if (s.configSuffix === 'SCREEN') {
      continue;
    }
    lines.push(`config SHIELD_SCYAN_SCREEN_${s.configSuffix}`);
    lines.push(`    def_bool $(shields_list_contains,${s.shieldName})`);
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Generates Kconfig.defconfig for the Scyan custom shield with dynamic guard condition.
 */
export function generateKconfigDefconfig(slots?: (number | string)[]): string {
  const resolvedSlots = resolveSlotList(slots);
  const targets = [
    'SHIELD_SCYAN_SCREEN',
    ...resolvedSlots.map(s => `SHIELD_SCYAN_SCREEN_${s.configSuffix}`),
  ];
  const uniqueTargets = Array.from(new Set(targets));

  return [
    '# Copyright (c) 2026 Scyan ZMK Studio',
    '# SPDX-License-Identifier: MIT',
    '',
    `if ${uniqueTargets.join(' || ')}`,
    '',
    'endif',
    '',
  ].join('\n');
}

/**
 * Generates a shield .overlay file binding /chosen { scyan,display-layout = &display_<slot>_active; }.
 */
export function generateShieldOverlay(slotNum: number | string): string {
  const str = String(slotNum).trim();
  let targetNode: string;
  if (/^display_\w+_active$/i.test(str)) {
    targetNode = str.toLowerCase();
  } else {
    const extracted = extractSlotId(slotNum);
    targetNode = `display_${extracted}_active`;
  }

  return [
    '/*',
    ' * Copyright (c) 2026 Scyan ZMK Studio',
    ' * SPDX-License-Identifier: MIT',
    ' */',
    '',
    '#include "scyan_layouts.dtsi"',
    '',
    '/ {',
    '    chosen {',
    `        scyan,display-layout = &${targetNode};`,
    '    };',
    '};',
    '',
  ].join('\n');
}

/**
 * Generates or updates zephyr/module.yml ensuring `build.settings.board_root: .` is present.
 */
export function generateZephyrModule(existingContent?: string): string {
  if (existingContent && existingContent.trim()) {
    try {
      const doc = YAML.parseDocument(existingContent);
      if (doc && doc.contents && YAML.isMap(doc.contents)) {
        const boardRoot = doc.getIn(['build', 'settings', 'board_root']);
        if (!boardRoot) {
          doc.setIn(['build', 'settings', 'board_root'], '.');
        }
        return doc.toString();
      }
    } catch {
      // Fall through to default generation on parse failure
    }
  }

  return [
    'build:',
    '  settings:',
    '    board_root: .',
    '',
  ].join('\n');
}

export interface GenerateShieldFilesOptions {
  layoutsDtsiContent: string;
  symbolsDtsiContent: string;
  rightIsCentral?: boolean;
  displayAssignments?: Record<string, string | number | null | undefined | boolean>;
  metadata?: HeaderMetadata | any;
  displays?: Record<string, any> | Array<any>;
  slots?: (number | string)[];
}

/**
 * Extracts display slot numbers/identifiers from options, metadata, and display assignments.
 */
export function extractSlotsFromOptions(options: GenerateShieldFilesOptions): (number | string)[] {
  if (options.slots && options.slots.length > 0) {
    return options.slots;
  }

  const slotSet = new Set<string>();

  // 1. Inspect explicit displays option if provided
  if (options.displays) {
    if (Array.isArray(options.displays)) {
      options.displays.forEach((d, idx) => {
        const id = d?.id || d?.name || String(idx + 1);
        slotSet.add(extractSlotId(id));
      });
    } else if (typeof options.displays === 'object') {
      Object.keys(options.displays).forEach(key => {
        slotSet.add(extractSlotId(key));
      });
    }
  }

  // 2. Inspect metadata displays
  if (options.metadata) {
    if (options.metadata.displays && typeof options.metadata.displays === 'object' && Object.keys(options.metadata.displays).length > 0) {
      Object.keys(options.metadata.displays).forEach(key => {
        slotSet.add(extractSlotId(key));
      });
    } else {
      try {
        const resolved = resolveMetadataDisplays(options.metadata);
        Object.keys(resolved).forEach(key => {
          slotSet.add(extractSlotId(key));
        });
      } catch {}
    }
  }

  // 3. Inspect displayAssignments
  if (options.displayAssignments) {
    Object.values(options.displayAssignments).forEach(val => {
      if (!val || typeof val === 'boolean') return;
      slotSet.add(extractSlotId(String(val)));
    });
  }

  if (slotSet.size === 0) {
    return [1, 2];
  }

  const sorted = Array.from(slotSet).sort((a, b) => {
    const numA = parseInt(a, 10);
    const numB = parseInt(b, 10);
    if (!isNaN(numA) && !isNaN(numB)) {
      return numA - numB;
    }
    return a.localeCompare(b);
  });

  return sorted.map(s => {
    const n = parseInt(s, 10);
    return isNaN(n) ? s : n;
  });
}

/**
 * Generates the full set of shield files in boards/shields/scyan_screen/.
 */
export function generateShieldFiles(options: GenerateShieldFilesOptions): ShieldFileAddition[] {
  const slots = extractSlotsFromOptions(options);
  const resolvedSlots = resolveSlotList(slots);

  const files: ShieldFileAddition[] = [
    {
      path: `${SCYAN_SHIELD_DIR}/Kconfig.shield`,
      content: generateKconfigShield(slots),
    },
    {
      path: `${SCYAN_SHIELD_DIR}/Kconfig.defconfig`,
      content: generateKconfigDefconfig(slots),
    },
    {
      path: `${SCYAN_SHIELD_DIR}/scyan_screen.overlay`,
      content: generateShieldOverlay(1),
    },
  ];

  for (const s of resolvedSlots) {
    files.push({
      path: `${SCYAN_SHIELD_DIR}/${s.fileName}`,
      content: generateShieldOverlay(s.slotNum),
    });
  }

  files.push(
    {
      path: `${SCYAN_SHIELD_DIR}/scyan_layouts.dtsi`,
      content: options.layoutsDtsiContent,
    },
    {
      path: `${SCYAN_SHIELD_DIR}/scyan_symbols.dtsi`,
      content: options.symbolsDtsiContent,
    },
  );

  return files;
}

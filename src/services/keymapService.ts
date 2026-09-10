import { Octokit } from '@octokit/rest';
import type { GitHubRepoConfig } from './githubService';

export interface LayerData {
  name: string;
  leftMatrix: string[][];
  rightMatrix: string[][];
  leftThumbs: string[];
  rightThumbs: string[];
}

export interface ParsedKeymapLayout {
  name: string;
  layoutType: string;
  columns: number;
  rows: number;
  thumbCount: number;
  leftMatrix: string[][];
  rightMatrix: string[][];
  leftThumbs: string[];
  rightThumbs: string[];
  layerNames: string[];
  layers?: LayerData[];
}

/**
 * Default empty 5x3 layout when no configuration is available.
 * Keycaps are completely empty / blank by default.
 */
export const DEFAULT_EMPTY_5X3_LAYOUT: ParsedKeymapLayout = {
  name: 'Default 5×3',
  layoutType: '5×3 (Empty)',
  columns: 5,
  rows: 3,
  thumbCount: 3,
  leftMatrix: [
    ['', '', '', '', ''],
    ['', '', '', '', ''],
    ['', '', '', '', ''],
  ],
  rightMatrix: [
    ['', '', '', '', ''],
    ['', '', '', '', ''],
    ['', '', '', '', ''],
  ],
  leftThumbs: ['', '', ''],
  rightThumbs: ['', '', ''],
  layerNames: ['DEFAULT', 'LOWER', 'RAISE', 'ADJUST'],
};

/**
 * Formats a layer label with its numerical index and optional human-readable name from GitHub.
 * Format: "Layer N (NAME)" or "Layer N" if name is absent or identical to index.
 */
export function formatLayerLabel(index: number, name?: string): string {
  const trimmed = name?.trim();
  if (
    !trimmed ||
    trimmed === String(index) ||
    trimmed.toUpperCase() === `LAYER_${index}` ||
    trimmed.toUpperCase() === `LAYER ${index}` ||
    trimmed.toUpperCase() === `L${index}`
  ) {
    return `Layer ${index}`;
  }
  return `Layer ${index} (${trimmed})`;
}

/**
 * Standard ZMK keycode names to clean human-readable keycap labels
 */
const KEY_CODE_MAP: Record<string, string> = {
  COMMA: ',',
  DOT: '.',
  PERIOD: '.',
  SEMI: ';',
  SEMICOLON: ';',
  SQT: "'",
  APOS: "'",
  SINGLE_QUOTE: "'",
  SLASH: '/',
  FSLH: '/',
  BSLH: '\\',
  BACKSLASH: '\\',
  MINUS: '-',
  EQUAL: '=',
  EQUALS: '=',
  LBKT: '[',
  RBKT: ']',
  LEFT_BRACKET: '[',
  RIGHT_BRACKET: ']',
  GRAVE: '`',
  TILDE: '~',
  EXCL: '!',
  EXCLAMATION: '!',
  AT: '@',
  HASH: '#',
  DOLLAR: '$',
  DLLR: '$',
  PERCENT: '%',
  PRCNT: '%',
  CARET: '^',
  AMPERSAND: '&',
  AMPS: '&',
  STAR: '*',
  ASTRK: '*',
  PLUS: '+',
  UNDER: '_',
  UNDERSCORE: '_',
  LPAR: '(',
  RPAR: ')',
  LEFT_PARENTHESIS: '(',
  RIGHT_PARENTHESIS: ')',
  LBRC: '{',
  RBRC: '}',
  LEFT_BRACE: '{',
  RIGHT_BRACE: '}',
  PIPE: '|',
  COLON: ':',
  QUESTION: '?',
  LESS_THAN: '<',
  GREATER_THAN: '>',
  DOUBLE_QUOTES: '"',
  DQT: '"',
  SPACE: 'SPC',
  BSPC: 'BSPC',
  BACKSPACE: 'BSPC',
  RET: 'ENT',
  RETURN: 'ENT',
  ENTER: 'ENT',
  TAB: 'TAB',
  ESC: 'ESC',
  ESCAPE: 'ESC',
  DEL: 'DEL',
  DELETE: 'DEL',
  INS: 'INS',
  INSERT: 'INS',
  HOME: 'HOME',
  END: 'END',
  PG_UP: 'PGUP',
  PG_DN: 'PGDN',
  PAGE_UP: 'PGUP',
  PAGE_DOWN: 'PGDN',
  PRINTSCREEN: 'PRNT',
  PSCRN: 'PRNT',
  LALT: 'ALT',
  RALT: 'ALT',
  LEFT_ALT: 'ALT',
  RIGHT_ALT: 'ALT',
  LSHIFT: 'SFT',
  RSHIFT: 'SFT',
  LSHFT: 'SFT',
  RSHFT: 'SFT',
  LEFT_SHIFT: 'SFT',
  RIGHT_SHIFT: 'SFT',
  LCTRL: 'CTL',
  RCTRL: 'CTL',
  LCTL: 'CTL',
  RCTL: 'CTL',
  LEFT_CONTROL: 'CTL',
  RIGHT_CONTROL: 'CTL',
  LGUI: 'GUI',
  RGUI: 'GUI',
  LCMD: 'GUI',
  RCMD: 'GUI',
  LEFT_GUI: 'GUI',
  RIGHT_GUI: 'GUI',
  UP: '▲',
  DOWN: '▼',
  LEFT: '◀',
  RIGHT: '▶',
  C_VOL_UP: 'VOL+',
  C_VOL_DN: 'VOL-',
  C_VOLUME_UP: 'VOL+',
  C_VOLUME_DOWN: 'VOL-',
  C_MUTE: 'MUTE',
  C_PP: 'PLAY',
  C_PLAY_PAUSE: 'PLAY',
  C_NEXT: 'NEXT',
  C_PREV: 'PREV',
  C_BRI_UP: 'BRI+',
  C_BRI_DN: 'BRI-',
  C_BRIGHTNESS_INC: 'BRI+',
  C_BRIGHTNESS_DEC: 'BRI-',
};

/**
 * Strips C and C++ style comments from devicetree content
 */
export function stripDtsComments(content: string): string {
  // Replace block comments with a single space to avoid accidental token merging
  let cleaned = content.replace(/\/\*[\s\S]*?\*\//g, ' ');
  // Replace line comments
  cleaned = cleaned.replace(/\/\/[^\r\n]*/g, '');
  return cleaned;
}

/**
 * Expand simple C preprocessor #define macros used in keymaps
 * (e.g. #define HRML(...) ..., #define XXX &none, #define ___ &trans, #define _BT_SEL_KEYS_ ...)
 */
export function expandDtsMacros(content: string): string {
  // 0. Collapse backslash line continuations
  let expanded = content.replace(/\\\r?\n\s*/g, ' ');

  // 1. Function-like macros: #define NAME(a,b,c) ...
  const funcMacroRegex = /#define\s+([a-zA-Z0-9_]+)\s*\(([^)]+)\)\s+([^\r\n]+)/g;
  let match: RegExpExecArray | null;
  const funcMacros: { name: string; params: string[]; body: string }[] = [];

  while ((match = funcMacroRegex.exec(expanded)) !== null) {
    const name = match[1];
    if (name.startsWith('ZMK_')) continue;
    const params = match[2].split(',').map(p => p.trim());
    const body = match[3].trim().replace(/\\$/, '').trim();
    funcMacros.push({ name, params, body });
  }

  // 2. Simple object-like macros: #define NAME replacement
  const objMacroRegex = /#define\s+([a-zA-Z0-9_]+)\s+(&?[a-zA-Z0-9_]+[^\r\n]*)/g;
  const objMacros: { name: string; body: string }[] = [];

  while ((match = objMacroRegex.exec(expanded)) !== null) {
    const name = match[1];
    const body = match[2].trim().replace(/\\$/, '').trim();
    if (!name.startsWith('CONFIG_') && !name.startsWith('ZMK_') && !name.endsWith('_H')) {
      objMacros.push({ name, body });
    }
  }

  // Apply function-like macros
  for (const macro of funcMacros) {
    const callRegex = new RegExp(`(?<!#define\\s+)\\b${macro.name}\\s*\\(([^)]+)\\)`, 'g');
    expanded = expanded.replace(callRegex, (_, argsStr) => {
      const args = argsStr.split(',').map((a: string) => a.trim());
      let res = macro.body;
      macro.params.forEach((param, idx) => {
        const argVal = args[idx] ?? '';
        const paramRegex = new RegExp(`\\b${param}\\b`, 'g');
        res = res.replace(paramRegex, argVal);
      });
      return res;
    });
  }

  // Apply object-like macros (2 passes for chained macros)
  for (let pass = 0; pass < 2; pass++) {
    for (const macro of objMacros) {
      const nameRegex = new RegExp(`(?<!#define\\s+)\\b${macro.name}\\b`, 'g');
      expanded = expanded.replace(nameRegex, macro.body);
    }
  }

  return expanded;
}

/**
 * Extracts balanced braced block starting at startIndex (which points to '{')
 */
function extractBracedBlock(text: string, startIndex: number): string | null {
  if (text[startIndex] !== '{') return null;
  let depth = 0;
  let start = -1;

  for (let i = startIndex; i < text.length; i++) {
    if (text[i] === '{') {
      if (depth === 0) start = i + 1;
      depth++;
    } else if (text[i] === '}') {
      depth--;
      if (depth === 0) {
        return text.substring(start, i);
      }
    }
  }
  return null;
}

/**
 * Safely decodes base64 string to UTF-8 text (handles Unicode box-drawing, accents, etc.)
 */
export function decodeBase64Utf8(base64: string): string {
  const clean = base64.replace(/\s/g, '');
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

/**
 * Extracts balanced parenthesized block starting at startIndex (which points to '(')
 */
function extractParenBlock(text: string, startIndex: number): string | null {
  if (text[startIndex] !== '(') return null;
  let depth = 0;
  let start = -1;

  for (let i = startIndex; i < text.length; i++) {
    if (text[i] === '(') {
      if (depth === 0) start = i + 1;
      depth++;
    } else if (text[i] === ')') {
      depth--;
      if (depth === 0) {
        return text.substring(start, i);
      }
    }
  }
  return null;
}

/**
 * Clean up an individual behavior or keycode into a concise keycap label
 */
export function cleanKeyLabel(rawKey: string): string {
  let key = rawKey.trim();

  // Strip wrapping quotes
  if (key.startsWith('"') && key.endsWith('"')) key = key.slice(1, -1).trim();
  if (key.startsWith("'") && key.endsWith("'")) key = key.slice(1, -1).trim();

  // Strip nested modifier wrappers, e.g. LG(PERIOD), LC(LEFT), LS(N1), RA(E), LG(LC(LEFT))
  while (/^[A-Z0-9_]+\((.*)\)$/i.test(key)) {
    const inner = key.match(/^[A-Z0-9_]+\((.*)\)$/i);
    if (inner && inner[1]) {
      key = inner[1].trim();
    } else {
      break;
    }
  }

  // Strip wrapping parentheses if any remain
  if (key.startsWith('(') && key.endsWith(')')) {
    key = key.slice(1, -1).trim();
  }

  // Strip leading '&' if left
  key = key.replace(/^&/, '').trim();

  // Special macro names & symbols
  if (key === 'XXX' || key === 'none') return '';
  if (key === '___' || key === 'trans') return '_';
  if (key === 'SMART_NUM') return 'NUM';
  if (key === 'MAGIC_SHIFT') return 'SFT';
  if (key === 'CANCEL') return 'CAN';
  if (key === 'smart_mouse') return 'MOU';
  if (key === 'swapper') return 'SWAP';
  if (key === 'comma_morph' || key.includes('COMMA')) return ',';
  if (key === 'dot_morph' || key.includes('DOT') || key.includes('PERIOD')) return '.';
  if (key === 'qexcl') return '!';
  if (key.startsWith('NAV_')) {
    const sub = key.substring(4);
    if (KEY_CODE_MAP[sub]) return KEY_CODE_MAP[sub];
    return sub;
  }
  if (key.startsWith('U_MS_') || key.startsWith('U_WH_')) {
    if (key.endsWith('_U')) return '▲';
    if (key.endsWith('_D')) return '▼';
    if (key.endsWith('_L')) return '◀';
    if (key.endsWith('_R')) return '▶';
  }
  if (key.startsWith('DSK_')) {
    if (key === 'DSK_PREV') return 'PREV';
    if (key === 'DSK_NEXT') return 'NEXT';
    return 'DSK';
  }
  if (key.startsWith('PIN_')) return 'PIN';
  if (key === 'VOL_DOWN') return 'VOL-';
  if (key === 'VOL_UP') return 'VOL+';

  // If number key like N1, N2, NUMBER_1
  if (/^N[0-9]$/i.test(key)) {
    return key.substring(1);
  }
  if (/^NUMBER_[0-9]$/i.test(key)) {
    return key.substring(7);
  }

  // Check lookup table
  if (KEY_CODE_MAP[key.toUpperCase()]) {
    return KEY_CODE_MAP[key.toUpperCase()];
  }

  // Single character letters or symbols
  if (key.length === 1) {
    return key.toUpperCase();
  }

  // Function keys F1..F24
  if (/^F[0-9]{1,2}$/i.test(key)) {
    return key.toUpperCase();
  }

  // Standard modifier or layer abbreviations
  if (key.length <= 4) {
    return key.toUpperCase();
  }

  // Default truncation for clean display
  return key.substring(0, 4).toUpperCase();
}

/**
 * Parse a single binding statement (e.g. "&kp Q", "&mt RIGHT_ALT SQT", "&lt 3 LEFT_GUI", "&mo 1")
 */
export function parseBindingToken(token: string): string {
  const clean = token.trim();
  if (!clean) return '';

  const parts = clean.replace(/^&/, '').split(/\s+/);
  if (parts.length === 0 || !parts[0]) return '';

  const behavior = parts[0].toLowerCase();

  // 1. Standard key press
  if (behavior === 'kp') {
    return parts[1] ? cleanKeyLabel(parts.slice(1).join(' ')) : '';
  }

  // 2. Mod-taps and hold-taps: extract the tap key (last argument)
  if (['mt', 'ht', 'hml', 'hmr'].includes(behavior)) {
    const targetKey = parts[parts.length - 1];
    return targetKey ? cleanKeyLabel(targetKey) : '';
  }

  // 3. Layer-taps: extract the tap key (last argument)
  if (behavior.startsWith('lt')) {
    if (parts.length > 1) {
      const targetKey = parts[parts.length - 1];
      return targetKey ? cleanKeyLabel(targetKey) : '';
    }
    return behavior === 'lt_spc' ? 'SPC' : 'LT';
  }

  // 4. Layer navigation / momentary / toggle
  if (behavior === 'mo' || behavior === 'sl') {
    return parts[1] ? `L${parts[1]}` : 'LYR';
  }
  if (behavior === 'tog') {
    return parts[1] ? `TG${parts[1]}` : 'TOG';
  }
  if (behavior === 'to') {
    return parts[1] ? `TO${parts[1]}` : 'TO';
  }

  // 5. Sticky keys
  if (behavior === 'sk' || behavior === 'kt') {
    return parts[1] ? cleanKeyLabel(parts[1]) : 'STK';
  }

  // 6. Bluetooth
  if (behavior === 'bt') {
    if (parts[1] === 'BT_SEL' && parts[2] !== undefined) {
      return `BT${parts[2]}`;
    }
    if (parts[1] === 'BT_CLR') return 'CLR';
    if (parts[1] === 'BT_CLR_ALL') return 'CLR*';
    if (parts[1] === 'BT_NXT') return 'NXT';
    if (parts[1] === 'BT_PRV') return 'PRV';
    return 'BT';
  }

  // 7. Output protocol
  if (behavior === 'out') {
    if (parts[1] === 'OUT_BLE') return 'BLE';
    if (parts[1] === 'OUT_USB') return 'USB';
    if (parts[1] === 'OUT_TOG') return 'OUT';
    return 'OUT';
  }

  // 8. Power
  if (behavior === 'ext_power') {
    if (parts[1] === 'EP_TOG') return 'EP';
    if (parts[1] === 'EP_ON') return 'EP+';
    if (parts[1] === 'EP_OFF') return 'EP-';
    return 'EP';
  }

  // 9. System / Hardware
  if (behavior === 'bootloader') return 'BOOT';
  if (behavior === 'sys_reset') return 'RST';
  if (behavior === 'studio_unlock') return 'UNLK';
  if (behavior === 'caps_word') return 'CAPS';
  if (behavior === 'key_repeat') return 'RPT';

  // 10. Mouse keys
  if (behavior === 'mkp') {
    return parts[1] ? parts[1].toUpperCase() : 'MOU';
  }

  // 11. Transparent & None
  if (behavior === 'trans') return '_';
  if (behavior === 'none') return '';

  // 12. Other behaviors / macros: use last argument or behavior name
  if (parts.length > 1) {
    const last = parts[parts.length - 1];
    // If last part is a trailing number (e.g. timeout or layer index) and previous is a known key/name
    if (/^[0-9]+$/.test(last) && parts.length > 2) {
      const prev = cleanKeyLabel(parts[parts.length - 2]);
      if (prev && prev !== '_') return prev;
    }
    return cleanKeyLabel(last);
  }

  return cleanKeyLabel(parts[0]);
}

/**
 * Parses a ZMK devicetree .keymap file content into a ParsedKeymapLayout
 */
export function parseZmkKeymap(rawContent: string, filename = 'keymap.keymap'): ParsedKeymapLayout {
  if (!rawContent || !rawContent.trim()) {
    return { ...DEFAULT_EMPTY_5X3_LAYOUT, name: filename.replace(/\.keymap$/, '') };
  }

  // 1. Strip comments and expand macros
  const stripped = stripDtsComments(rawContent);
  const content = expandDtsMacros(stripped);

  const rawLayers: { name: string; bindingsText: string }[] = [];
  const layerNames: string[] = [];

  // Helper to sanitize layer name for display
  const sanitizeLayerName = (name: string): string => {
    return name
      .replace(/[\s_-]+layer$/i, '')
      .replace(/^[_-]+|[_-]+$/g, '')
      .trim()
      .toUpperCase() || 'DEFAULT';
  };

  // 2. Locate the keymap block to prevent matching behaviors { ... } or macros { ... }
  let keymapBody: string | null = null;
  const keymapMatch = /\bkeymap\s*(?::\s*[^{]+)?\{/.exec(content);
  if (keymapMatch) {
    const braceIndex = content.indexOf('{', keymapMatch.index);
    if (braceIndex !== -1) {
      keymapBody = extractBracedBlock(content, braceIndex);
    }
  }

  if (keymapBody) {
    // Extract layers inside the keymap block
    const layerNodeRegex = /([a-zA-Z0-9_-]+)\s*\{/g;
    let nodeMatch: RegExpExecArray | null;

    while ((nodeMatch = layerNodeRegex.exec(keymapBody)) !== null) {
      const nodeName = nodeMatch[1].trim();
      const nodeBraceIndex = keymapBody.indexOf('{', nodeMatch.index);
      if (nodeBraceIndex === -1) continue;

      const layerBlockContent = extractBracedBlock(keymapBody, nodeBraceIndex);
      if (!layerBlockContent) continue;

      // Extract bindings = < ... >;
      const bindingsMatch = /bindings\s*=\s*<([\s\S]*?)>;/.exec(layerBlockContent);
      if (bindingsMatch) {
        // Check for display-name = "...";
        const displayNameMatch = /display-name\s*=\s*"([^"]+)";/i.exec(layerBlockContent);
        const effectiveName = displayNameMatch ? sanitizeLayerName(displayNameMatch[1]) : sanitizeLayerName(nodeName);

        layerNames.push(effectiveName);
        rawLayers.push({ name: effectiveName, bindingsText: bindingsMatch[1].trim() });
      }
    }
  }

  // 3. Fallback: Macro-based layer declarations (e.g. ZMK_BASE_LAYER, ZMK_LAYER in urob/caksoylar configs)
  if (rawLayers.length === 0) {
    const macroRegex = /(?:^|[^\w#])ZMK_(?:BASE_)?LAYER\s*\(/g;
    let mMatch: RegExpExecArray | null;
    while ((mMatch = macroRegex.exec(content)) !== null) {
      const matchPos = mMatch.index + mMatch[0].indexOf('ZMK');
      const lineStart = content.lastIndexOf('\n', matchPos) + 1;
      const prefixOnLine = content.substring(lineStart, matchPos).trim();
      if (
        prefixOnLine.startsWith('#define') ||
        prefixOnLine.startsWith('#ifndef') ||
        prefixOnLine.startsWith('#ifdef') ||
        prefixOnLine.startsWith('#')
      ) {
        continue;
      }

      const parenIndex = content.indexOf('(', matchPos);
      if (parenIndex === -1) continue;

      const block = extractParenBlock(content, parenIndex);
      if (!block) continue;

      const firstComma = block.indexOf(',');
      if (firstComma === -1) continue;

      const layerName = sanitizeLayerName(block.substring(0, firstComma).trim());
      const bindingsText = block.substring(firstComma + 1).trim();

      layerNames.push(layerName);
      rawLayers.push({ name: layerName, bindingsText });
    }
  }

  // 4. Fallback: General bindings regex if structured block wasn't found
  if (rawLayers.length === 0) {
    const genericLayerRegex = /([a-zA-Z0-9_-]+)\s*\{[^{}]*?bindings\s*=\s*<([\s\S]*?)>;/g;
    let gMatch: RegExpExecArray | null;
    while ((gMatch = genericLayerRegex.exec(content)) !== null) {
      const lName = gMatch[1].trim();
      if (!['keymap', 'compatible', 'behaviors', 'macros', 'combos', 'hold_tap', 'tap_dance'].includes(lName)) {
        const sanitized = sanitizeLayerName(lName);
        layerNames.push(sanitized);
        rawLayers.push({ name: sanitized, bindingsText: gMatch[2].trim() });
      }
    }
  }

  // 5. Ultimate fallback: look for any bindings = < ... > in file
  if (rawLayers.length === 0) {
    const fallbackBindings = content.match(/bindings\s*=\s*<([\s\S]*?)>;/);
    if (fallbackBindings) {
      rawLayers.push({ name: 'DEFAULT', bindingsText: fallbackBindings[1].trim() });
      layerNames.push('DEFAULT');
    }
  }

  if (rawLayers.length === 0) {
    return { ...DEFAULT_EMPTY_5X3_LAYOUT, name: filename.replace(/\.keymap$/, '') };
  }

  // Helper to tokenize bindings text into individual key statements
  const tokenizeBindings = (text: string): string[] => {
    // Replace commas with spaces so devicetree separators don't stick to keys
    const cleanedText = text.replace(/,/g, ' ').trim();
    if (!cleanedText) return [];

    const words = cleanedText.split(/\s+/).filter(w => w.length > 0);
    const keys: string[] = [];
    let i = 0;

    while (i < words.length) {
      const word = words[i];
      if (word.startsWith('&')) {
        const behavior = word.substring(1).toLowerCase();
        // 0-parameter behaviors
        if ([
          'trans', 'none', 'bootloader', 'sys_reset', 'caps_word',
          'key_repeat', 'studio_unlock', 'smart_mouse',
        ].includes(behavior)) {
          keys.push(parseBindingToken(word));
          i++;
        }
        // 2-parameter behaviors (mod-taps, hold-taps, layer-taps)
        else if (
          ['mt', 'ht', 'hml', 'hmr'].includes(behavior) ||
          behavior.startsWith('lt')
        ) {
          const arg1 = words[i + 1] ?? '';
          const arg2 = words[i + 2] ?? '';
          if (arg1.startsWith('&')) {
            keys.push(parseBindingToken(word));
            i++;
          } else if (arg2.startsWith('&')) {
            keys.push(parseBindingToken(`${word} ${arg1}`));
            i += 2;
          } else {
            keys.push(parseBindingToken(`${word} ${arg1} ${arg2}`.trim()));
            i += 3;
          }
        }
        // Bluetooth
        else if (behavior === 'bt') {
          const sub = words[i + 1] ?? '';
          if (sub === 'BT_SEL') {
            const val = words[i + 2] ?? '';
            keys.push(parseBindingToken(`${word} ${sub} ${val}`.trim()));
            i += 3;
          } else {
            keys.push(parseBindingToken(`${word} ${sub}`.trim()));
            i += sub && !sub.startsWith('&') ? 2 : 1;
          }
        }
        // 1-parameter standard behaviors
        else if ([
          'kp', 'mo', 'tog', 'to', 'sl', 'sk', 'kt', 'mkp', 'out', 'ext_power'
        ].includes(behavior)) {
          const arg1 = words[i + 1] ?? '';
          if (arg1 && !arg1.startsWith('&')) {
            keys.push(parseBindingToken(`${word} ${arg1}`));
            i += 2;
          } else {
            keys.push(parseBindingToken(word));
            i++;
          }
        }
        // Custom behavior or macro
        else {
          let consumed = 1;
          const args = [word];
          while (consumed <= 2 && i + consumed < words.length && !words[i + consumed].startsWith('&')) {
            args.push(words[i + consumed]);
            consumed++;
          }
          keys.push(parseBindingToken(args.join(' ')));
          i += consumed;
        }
      } else {
        // Macro or symbol without '&'
        keys.push(cleanKeyLabel(word));
        i++;
      }
    }

    return keys;
  };

  // Parse layer 0 keys to determine keyboard geometry
  const layer0Keys = tokenizeBindings(rawLayers[0].bindingsText);
  const totalKeys = layer0Keys.length;

  let columns = 5;
  let rows = 3;
  let thumbCount = 3;
  let layoutType = '5×3 (36 keys)';

  if (
    rawContent.includes('five_column') ||
    rawContent.includes('5col') ||
    totalKeys === 36
  ) {
    columns = 5;
    rows = 3;
    thumbCount = 3;
    layoutType = 'Corne 5×3 (36 keys)';
  } else if (totalKeys === 42) {
    columns = 6;
    rows = 3;
    thumbCount = 3;
    layoutType = 'Corne 6×3 (42 keys)';
  } else if (
    totalKeys === 34 ||
    rawContent.includes('cradio') ||
    rawContent.includes('sweep') ||
    rawContent.includes('ferris')
  ) {
    columns = 5;
    rows = 3;
    thumbCount = 2;
    layoutType = 'Sweep / Ferris (34 keys)';
  } else if (totalKeys === 30 || totalKeys === 32) {
    columns = 5;
    rows = 3;
    thumbCount = 2;
    layoutType = `Custom Split (${totalKeys} keys)`;
  } else if (totalKeys >= 54 && totalKeys <= 62) {
    columns = 6;
    rows = 4;
    thumbCount = 5;
    layoutType = 'Lily58 / Sofle (58 keys)';
  } else if (totalKeys >= 70) {
    columns = 6;
    rows = 5;
    thumbCount = 6;
    layoutType = `Glove80 (${totalKeys} keys)`;
  } else {
    // General heuristic for any split count
    if (totalKeys % 2 === 0) {
      const half = totalKeys / 2;
      if (half <= 18) {
        columns = 5;
        rows = 3;
        thumbCount = Math.max(2, half - 15);
        layoutType = `Custom Split (${totalKeys} keys)`;
      } else {
        columns = 6;
        rows = 3;
        thumbCount = Math.max(3, half - 18);
        layoutType = `Custom Split (${totalKeys} keys)`;
      }
    }
  }

  // Helper to distribute flat keys into matrices and thumbs
  const distributeKeys = (layerKeyList: string[]): LayerData => {
    const lMat: string[][] = Array.from({ length: rows }, () => Array(columns).fill(''));
    const rMat: string[][] = Array.from({ length: rows }, () => Array(columns).fill(''));
    const lTh: string[] = [];
    const rTh: string[] = [];
    let idx = 0;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < columns; c++) {
        if (idx < layerKeyList.length) lMat[r][c] = layerKeyList[idx++];
      }
      for (let c = 0; c < columns; c++) {
        if (idx < layerKeyList.length) rMat[r][c] = layerKeyList[idx++];
      }
    }

    for (let t = 0; t < thumbCount; t++) {
      if (idx < layerKeyList.length) lTh.push(layerKeyList[idx++]);
    }
    for (let t = 0; t < thumbCount; t++) {
      if (idx < layerKeyList.length) rTh.push(layerKeyList[idx++]);
    }

    return {
      name: '',
      leftMatrix: lMat,
      rightMatrix: rMat,
      leftThumbs: lTh,
      rightThumbs: rTh,
    };
  };

  // Parse and distribute all layers
  const parsedLayers: LayerData[] = rawLayers.map(l => {
    const layerKeys = tokenizeBindings(l.bindingsText);
    const dist = distributeKeys(layerKeys);
    dist.name = l.name;
    return dist;
  });

  const layer0 = parsedLayers[0] || distributeKeys(layer0Keys);

  return {
    name: filename.replace(/\.keymap$/, ''),
    layoutType,
    columns,
    rows,
    thumbCount,
    leftMatrix: layer0.leftMatrix,
    rightMatrix: layer0.rightMatrix,
    leftThumbs: layer0.leftThumbs,
    rightThumbs: layer0.rightThumbs,
    layerNames: layerNames.length > 0 ? layerNames : ['DEFAULT', 'LOWER', 'RAISE', 'ADJUST'],
    layers: parsedLayers,
  };
}

/**
 * Recursively resolves and inlines relative #include directives for keymaps and dtsi files.
 */
export async function resolveIncludes(
  basePath: string,
  content: string,
  fetchFile: (path: string) => Promise<string | null>,
  depth = 0
): Promise<string> {
  if (depth >= 3) return content;
  const includeRegex = /#include\s+["']([^"']+\.(?:keymap|dtsi|h))["']/g;
  let match: RegExpExecArray | null;
  let resolved = content;
  const dir = basePath.includes('/') ? basePath.substring(0, basePath.lastIndexOf('/')) : '';

  while ((match = includeRegex.exec(content)) !== null) {
    const incFileName = match[1];
    // Resolve relative path against basePath's directory
    const targetPath = dir ? `${dir}/${incFileName}` : incFileName;
    try {
      const incContent = await fetchFile(targetPath);
      if (incContent) {
        const nested = await resolveIncludes(targetPath, incContent, fetchFile, depth + 1);
        resolved = resolved.replace(match[0], `\n/* Inlined from ${incFileName} */\n${nested}\n`);
      }
    } catch {
      // Ignore if include cannot be fetched
    }
  }
  return resolved;
}

/**
 * Fetch keymap file from GitHub repository with multi-branch and multi-directory fallback resilience.
 * Supports public repositories without requiring personal access tokens.
 */
export async function fetchRepoKeymap(
  config: GitHubRepoConfig
): Promise<{ filename: string; content: string } | null> {
  const owner = config.owner?.trim();
  const repo = config.repo?.trim();
  if (!owner || !repo) {
    return null;
  }

  const token = config.token?.trim();
  const octokit = new Octokit({ auth: token || undefined });

  // Priority list of branches to try:
  // 1. Custom branch (if explicitly specified and not generic main/master)
  // 2. undefined (GitHub's default branch for this repo - always resolves accurately without 404)
  // 3. main, master as standard fallbacks
  const branchesToTry: (string | undefined)[] = [];
  const specifiedBranch = config.branch?.trim();
  if (specifiedBranch && specifiedBranch !== 'master' && specifiedBranch !== 'main') {
    branchesToTry.push(specifiedBranch);
  }
  // Try default branch (undefined ref) first - GitHub resolves this automatically without 404s
  branchesToTry.push(undefined);
  branchesToTry.push('main');
  branchesToTry.push('master');
  if (specifiedBranch) {
    branchesToTry.push(specifiedBranch);
  }

  const uniqueBranches = Array.from(new Set(branchesToTry));

  let authRequiredError: Error | null = null;

  const checkHttpError = (err: any) => {
    if (err?.status === 401) {
      throw new Error('Invalid GitHub token. Please verify your Personal Access Token in Settings.');
    }
    if (err?.status === 403 || err?.message?.toLowerCase().includes('rate limit')) {
      throw new Error('GitHub API rate limit exceeded. Please add a Personal Access Token in Settings to continue.');
    }
    if (err?.status === 404) {
      const msg = (err?.message || err?.response?.data?.message || '').toLowerCase();
      // Only record repository not found / access denied if error is not just a missing ref
      if (!msg.includes('ref') && !msg.includes('commit')) {
        authRequiredError = new Error(
          token
            ? `Repository '${owner}/${repo}' was not found or your token lacks permissions. Please check repository access in Settings.`
            : `Repository '${owner}/${repo}' was not found or is private. Please connect your GitHub account or provide a Personal Access Token in Settings.`
        );
      }
    }
    if (err?.name === 'TypeError' && err?.message?.includes('fetch')) {
      throw new Error('Network error: Unable to connect to GitHub. Please check your internet connection.');
    }
  };

  // Helper to pick the best keymap file among candidates
  const pickBestKeymap = (items: { name: string; path: string }[]): { name: string; path: string } | null => {
    if (items.length === 0) return null;
    const corne = items.find(i => i.name.toLowerCase().includes('corne'));
    if (corne) return corne;
    const sweep = items.find(i => i.name.toLowerCase().includes('sweep') || i.name.toLowerCase().includes('cradio'));
    if (sweep) return sweep;
    const lily = items.find(i => i.name.toLowerCase().includes('lily') || i.name.toLowerCase().includes('sofle'));
    if (lily) return lily;
    return items[0];
  };

  for (const branch of uniqueBranches) {
    let branchRefInvalid = false;
    const safeListDir = async (dirPath: string) => {
      if (branchRefInvalid) return null;
      try {
        const res = await octokit.repos.getContent({
          owner,
          repo,
          path: dirPath,
          ...(branch ? { ref: branch } : {}),
        });
        return Array.isArray(res.data) ? res.data : null;
      } catch (err: any) {
        const msg = (err?.message || err?.response?.data?.message || '').toLowerCase();
        if (err?.status === 404 && (msg.includes('ref') || msg.includes('commit'))) {
          branchRefInvalid = true;
          return null;
        }
        checkHttpError(err);
        return null;
      }
    };

    const safeGetFile = async (filePath: string) => {
      if (branchRefInvalid) return null;
      try {
        const res = await octokit.repos.getContent({
          owner,
          repo,
          path: filePath,
          ...(branch ? { ref: branch } : {}),
        });
        if ('content' in res.data && typeof res.data.content === 'string') {
          return decodeBase64Utf8(res.data.content);
        }
        return null;
      } catch (err: any) {
        const msg = (err?.message || err?.response?.data?.message || '').toLowerCase();
        if (err?.status === 404 && (msg.includes('ref') || msg.includes('commit'))) {
          branchRefInvalid = true;
          return null;
        }
        checkHttpError(err);
        return null;
      }
    };

    // 1. Probe config/ directory (standard ZMK config repo layout)
    const configItems = await safeListDir('config');
    if (branchRefInvalid) {
      // Branch ref does not exist on remote, skip to next branch immediately
      continue;
    }
    if (configItems) {
      const keymapFiles = configItems.filter(i => i.type === 'file' && i.name.endsWith('.keymap'));
      let picked = pickBestKeymap(keymapFiles);
      if (!picked) {
        const subdirs = configItems.filter(i => i.type === 'dir');
        for (const subdir of subdirs) {
          const subFiles = await safeListDir(subdir.path);
          if (subFiles) {
            const subKeymaps = subFiles.filter(i => i.type === 'file' && i.name.endsWith('.keymap'));
            picked = pickBestKeymap(subKeymaps);
            if (picked) break;
          }
        }
      }
      if (picked) {
        let content = await safeGetFile(picked.path);
        if (content) {
          content = await resolveIncludes(picked.path, content, p => safeGetFile(p));
          return { filename: picked.name, content };
        }
      }
    }

    if (branchRefInvalid) continue;

    // 2. Probe boards/shields/ subdirectories
    const shieldItems = await safeListDir('boards/shields');
    if (branchRefInvalid) continue;
    if (shieldItems) {
      const directKeymaps = shieldItems.filter(i => i.type === 'file' && i.name.endsWith('.keymap'));
      let picked = pickBestKeymap(directKeymaps);
      if (!picked) {
        const subdirs = shieldItems.filter(i => i.type === 'dir');
        for (const subdir of subdirs) {
          const subFiles = await safeListDir(subdir.path);
          if (subFiles) {
            const keymaps = subFiles.filter(i => i.type === 'file' && i.name.endsWith('.keymap'));
            picked = pickBestKeymap(keymaps);
            if (picked) break;
          }
        }
      }
      if (picked) {
        let content = await safeGetFile(picked.path);
        if (content) {
          content = await resolveIncludes(picked.path, content, p => safeGetFile(p));
          return { filename: picked.name, content };
        }
      }
    }

    if (branchRefInvalid) continue;

    // 3. Probe app/boards/shields/ (zmkfirmware/zmk upstream repo layout)
    const upstreamShieldItems = await safeListDir('app/boards/shields');
    if (branchRefInvalid) continue;
    if (upstreamShieldItems) {
      const subdirs = upstreamShieldItems.filter(i => i.type === 'dir');
      for (const subdir of subdirs) {
        const subFiles = await safeListDir(subdir.path);
        if (subFiles) {
          const keymaps = subFiles.filter(i => i.type === 'file' && i.name.endsWith('.keymap'));
          const picked = pickBestKeymap(keymaps);
          if (picked) {
            let content = await safeGetFile(picked.path);
            if (content) {
              content = await resolveIncludes(picked.path, content, p => safeGetFile(p));
              return { filename: picked.name, content };
            }
          }
        }
      }
    }

    if (branchRefInvalid) continue;

    // 4. Probe keymaps/ or keymap/ directory
    const keymapDirItems = (await safeListDir('keymaps')) || (await safeListDir('keymap'));
    if (branchRefInvalid) continue;
    if (keymapDirItems) {
      const directKeymaps = keymapDirItems.filter(i => i.type === 'file' && i.name.endsWith('.keymap'));
      let picked = pickBestKeymap(directKeymaps);
      if (picked) {
        let content = await safeGetFile(picked.path);
        if (content) {
          content = await resolveIncludes(picked.path, content, p => safeGetFile(p));
          return { filename: picked.name, content };
        }
      }
    }

    if (branchRefInvalid) continue;

    // 5. Probe root directory
    const rootItems = await safeListDir('');
    if (branchRefInvalid) continue;
    if (rootItems) {
      const keymapFiles = rootItems.filter(i => i.type === 'file' && i.name.endsWith('.keymap'));
      const picked = pickBestKeymap(keymapFiles);
      if (picked) {
        let content = await safeGetFile(picked.path);
        if (content) {
          content = await resolveIncludes(picked.path, content, p => safeGetFile(p));
          return { filename: picked.name, content };
        }
      }
    }
  }

  if (authRequiredError) {
    throw authRequiredError;
  }

  return null;
}

/**
 * Map a keyboard event key to possible keycap labels and aliases
 */
export function getKeyAliases(key: string): string[] {
  const aliases: string[] = [];
  if (!key) return aliases;

  if (key === ' ') {
    aliases.push('SPC', 'SPACE');
  } else if (key === 'Enter') {
    aliases.push('ENT', 'ENTER', 'RET', 'RETURN');
  } else if (key === 'Backspace') {
    aliases.push('BSPC', 'BACKSPACE', 'BKSP');
  } else if (key === 'Tab') {
    aliases.push('TAB');
  } else if (key === 'Escape') {
    aliases.push('ESC', 'ESCAPE');
  } else if (key === 'Delete') {
    aliases.push('DEL', 'DELETE');
  } else if (key === 'Shift') {
    aliases.push('SFT', 'SHIFT', 'LSHIFT', 'RSHIFT');
  } else if (key === 'Control') {
    aliases.push('CTL', 'CTRL', 'CONTROL', 'LCTRL', 'RCTRL');
  } else if (key === 'Alt') {
    aliases.push('ALT', 'LALT', 'RALT', 'OPT');
  } else if (key === 'Meta') {
    aliases.push('GUI', 'LGUI', 'RGUI', 'WIN', 'CMD');
  } else if (key === 'ArrowUp') {
    aliases.push('▲', 'UP');
  } else if (key === 'ArrowDown') {
    aliases.push('▼', 'DOWN');
  } else if (key === 'ArrowLeft') {
    aliases.push('◀', 'LEFT');
  } else if (key === 'ArrowRight') {
    aliases.push('▶', 'RIGHT');
  } else if (key.length === 1) {
    const upper = key.toUpperCase();
    aliases.push(upper);

    switch (upper) {
      case ';': aliases.push('SEMI', 'SEMICOLON'); break;
      case ':': aliases.push('COLON'); break;
      case "'": aliases.push('SQT', 'APOS', 'QUOTE', 'SINGLE_QUOTE'); break;
      case '"': aliases.push('DQT', 'DOUBLE_QUOTES'); break;
      case ',': aliases.push('COMMA'); break;
      case '<': aliases.push('LESS_THAN'); break;
      case '.': aliases.push('DOT', 'PERIOD'); break;
      case '>': aliases.push('GREATER_THAN'); break;
      case '/': aliases.push('SLASH', 'FSLH'); break;
      case '?': aliases.push('QUESTION'); break;
      case '\\': aliases.push('BSLH', 'BACKSLASH'); break;
      case '|': aliases.push('PIPE'); break;
      case '-': aliases.push('MINUS', 'MINS'); break;
      case '_': aliases.push('UNDER', 'UNDERSCORE'); break;
      case '=': aliases.push('EQUAL', 'EQUALS'); break;
      case '+': aliases.push('PLUS'); break;
      case '[': aliases.push('LBKT', 'LEFT_BRACKET'); break;
      case '{': aliases.push('LBRC', 'LEFT_BRACE'); break;
      case ']': aliases.push('RBKT', 'RIGHT_BRACKET'); break;
      case '}': aliases.push('RBRC', 'RIGHT_BRACE'); break;
      case '`': aliases.push('GRAVE'); break;
      case '~': aliases.push('TILDE'); break;
      case '!': aliases.push('EXCL'); break;
      case '@': aliases.push('AT'); break;
      case '#': aliases.push('HASH'); break;
      case '$': aliases.push('DOLLAR', 'DLLR'); break;
      case '%': aliases.push('PERCENT', 'PRCNT'); break;
      case '^': aliases.push('CARET'); break;
      case '&': aliases.push('AMPERSAND', 'AMPS'); break;
      case '*': aliases.push('ASTRK', 'STAR'); break;
      case '(': aliases.push('LPAR'); break;
      case ')': aliases.push('RPAR'); break;
    }
  } else {
    aliases.push(key.toUpperCase());
  }

  return aliases;
}

/**
 * Maps physical scan code (e.code) to a coordinate on empty 5x3 or 6x3 keyboards
 */
export function getCoordForPhysicalScanCode(code: string, totalCols: number): string | undefined {
  if (totalCols === 6) {
    const map6: Record<string, string> = {
      Tab: 'L_0_0', KeyQ: 'L_0_1', KeyW: 'L_0_2', KeyE: 'L_0_3', KeyR: 'L_0_4', KeyT: 'L_0_5',
      KeyY: 'R_0_0', KeyU: 'R_0_1', KeyI: 'R_0_2', KeyO: 'R_0_3', KeyP: 'R_0_4', BracketLeft: 'R_0_5',
      CapsLock: 'L_1_0', KeyA: 'L_1_1', KeyS: 'L_1_2', KeyD: 'L_1_3', KeyF: 'L_1_4', KeyG: 'L_1_5',
      KeyH: 'R_1_0', KeyJ: 'R_1_1', KeyK: 'R_1_2', KeyL: 'R_1_3', Semicolon: 'R_1_4', Quote: 'R_1_5',
      ShiftLeft: 'L_2_0', KeyZ: 'L_2_1', KeyX: 'L_2_2', KeyC: 'L_2_3', KeyV: 'L_2_4', KeyB: 'L_2_5',
      KeyN: 'R_2_0', KeyM: 'R_2_1', Comma: 'R_2_2', Period: 'R_2_3', Slash: 'R_2_4', ShiftRight: 'R_2_5',
      AltLeft: 'LT_0', Space: 'LT_1', ControlLeft: 'LT_2',
      Backspace: 'RT_0', Enter: 'RT_1', AltRight: 'RT_2',
    };
    return map6[code];
  }

  const map5: Record<string, string> = {
    KeyQ: 'L_0_0', KeyW: 'L_0_1', KeyE: 'L_0_2', KeyR: 'L_0_3', KeyT: 'L_0_4',
    KeyY: 'R_0_0', KeyU: 'R_0_1', KeyI: 'R_0_2', KeyO: 'R_0_3', KeyP: 'R_0_4',
    KeyA: 'L_1_0', KeyS: 'L_1_1', KeyD: 'L_1_2', KeyF: 'L_1_3', KeyG: 'L_1_4',
    KeyH: 'R_1_0', KeyJ: 'R_1_1', KeyK: 'R_1_2', KeyL: 'R_1_3', Semicolon: 'R_1_4', Quote: 'R_1_4',
    KeyZ: 'L_2_0', KeyX: 'L_2_1', KeyC: 'L_2_2', KeyV: 'L_2_3', KeyB: 'L_2_4',
    KeyN: 'R_2_0', KeyM: 'R_2_1', Comma: 'R_2_2', Period: 'R_2_3', Slash: 'R_2_4',
    AltLeft: 'LT_0', MetaLeft: 'LT_0', Space: 'LT_1', Tab: 'LT_2',
    Backspace: 'RT_0', Enter: 'RT_1', ControlRight: 'RT_2', AltRight: 'RT_2', MetaRight: 'RT_2',
  };
  return map5[code];
}

export interface ActiveLayerKeyLayout {
  leftMatrix: string[][];
  rightMatrix: string[][];
  leftThumbs: string[];
  rightThumbs: string[];
  columns: number;
  rows: number;
}

/**
 * Returns matching coordinate(s) for a keyboard event.
 * When the active layer has keys, matches by key label/aliases on the current layer
 * and NEVER falls back to QWERTY scan-code positions.
 * Only falls back to scan-code coordinates when the entire active layout is empty.
 */
export function getMatchingKeyCoords(
  event: { key: string; code?: string },
  layout: ActiveLayerKeyLayout
): string[] {
  const hasAnyKeys =
    layout.leftMatrix.some(r => r.some(k => Boolean(k && k.trim()))) ||
    layout.rightMatrix.some(r => r.some(k => Boolean(k && k.trim()))) ||
    layout.leftThumbs.some(k => Boolean(k && k.trim())) ||
    layout.rightThumbs.some(k => Boolean(k && k.trim()));

  if (!hasAnyKeys) {
    // Only use physical scan code coordinate if layout is completely empty
    if (event.code) {
      const coord = getCoordForPhysicalScanCode(event.code, layout.columns);
      return coord ? [coord] : [];
    }
    return [];
  }

  const aliases = getKeyAliases(event.key);
  const aliasSet = new Set(aliases.map(a => a.toUpperCase()));
  const matches: string[] = [];

  // 1. Search left matrix
  for (let r = 0; r < layout.rows; r++) {
    for (let c = 0; c < layout.columns; c++) {
      const label = layout.leftMatrix[r]?.[c]?.trim().toUpperCase();
      if (label && aliasSet.has(label)) {
        matches.push(`L_${r}_${c}`);
      }
    }
  }

  // 2. Search right matrix
  for (let r = 0; r < layout.rows; r++) {
    for (let c = 0; c < layout.columns; c++) {
      const label = layout.rightMatrix[r]?.[c]?.trim().toUpperCase();
      if (label && aliasSet.has(label)) {
        matches.push(`R_${r}_${c}`);
      }
    }
  }

  // 3. Search left thumbs
  layout.leftThumbs.forEach((t, idx) => {
    const label = t?.trim().toUpperCase();
    if (label && aliasSet.has(label)) {
      matches.push(`LT_${idx}`);
    }
  });

  // 4. Search right thumbs
  layout.rightThumbs.forEach((t, idx) => {
    const label = t?.trim().toUpperCase();
    if (label && aliasSet.has(label)) {
      matches.push(`RT_${idx}`);
    }
  });

  return matches;
}


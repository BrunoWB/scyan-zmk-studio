export interface SpriteSlice {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color?: string;
}

export interface GlyphSlot {
  x: number;
  y: number;
  width: number;
  height: number;
  advanceX?: number;
}

export interface FontCharMapping {
  id: string;
  chars: string;
  small?: GlyphSlot | null;
  big?: GlyphSlot | null;
}

export interface FontGlyph {
  char: string;
  codepoint: number;
  x: number;
  y: number;
  width: number;
  height: number;
  advanceX: number;
}

export interface LayoutBlock {
  id: string;
  name: string;
  y: number;
  height: number;
  enabled: boolean;
  description: string;
}

export interface DisplaySettings {
  rotation: '90' | '270';
  invert: boolean;
  idleTimeoutMs: number;
  userName: string;
  repoOwner: string;
  repoName: string;
  branch: string;
  githubToken: string;
}

export const DEFAULT_SYMBOL_SLICES: SpriteSlice[] = [
  { id: 'SYMBOL_USB', name: 'USB Plug', x: 104, y: 0, width: 12, height: 10, color: '#38bdf8' },
  { id: 'SYMBOL_BLUETOOTH', name: 'Bluetooth Rune', x: 118, y: 0, width: 8, height: 8, color: '#60a5fa' },
  { id: 'SYMBOL_BATTERY_FRAME', name: 'Battery Frame & Terminal', x: 88, y: 23, width: 17, height: 10, color: '#4ade80' },
  { id: 'SYMBOL_SPLIT_CONNECTED', name: 'Split Connected Chain', x: 104, y: 11, width: 13, height: 9, color: '#2dd4bf' },
  { id: 'SYMBOL_SPLIT_DISCONNECTED', name: 'Split Broken Link', x: 106, y: 23, width: 13, height: 9, color: '#f87171' },
  { id: 'SYMBOL_ARROW_HEAD', name: 'WPM Arrow Head', x: 118, y: 11, width: 3, height: 5, color: '#fbbf24' },
  { id: 'SYMBOL_ARROW_DOT', name: 'WPM Progress Dot', x: 122, y: 11, width: 3, height: 5, color: '#f59e0b' },
  { id: 'SYMBOL_BRACKET_LAYER_0', name: 'Layer 0 Bracket', x: 0, y: 23, width: 22, height: 11, color: '#a78bfa' },
  { id: 'SYMBOL_BRACKET_LAYER_1', name: 'Layer 1 Bracket', x: 22, y: 23, width: 22, height: 11, color: '#c084fc' },
  { id: 'SYMBOL_BRACKET_LAYER_2', name: 'Layer 2 Bracket', x: 44, y: 23, width: 22, height: 11, color: '#e879f9' },
  { id: 'SYMBOL_BRACKET_LAYER_3', name: 'Layer 3 Bracket', x: 66, y: 23, width: 22, height: 11, color: '#f472b6' },
  { id: 'SYMBOL_SKULL_LAYER_0', name: 'Skull (Straight / Idle)', x: 0, y: 0, width: 26, height: 23, color: '#34d399' },
  { id: 'SYMBOL_SKULL_LAYER_1', name: 'Skull (Right Tilt)', x: 26, y: 0, width: 26, height: 23, color: '#10b981' },
  { id: 'SYMBOL_SKULL_LAYER_2', name: 'Skull (Left Tilt)', x: 52, y: 0, width: 26, height: 23, color: '#059669' },
  { id: 'SYMBOL_SKULL_LAYER_3', name: 'Skull (Symmetrical Angle)', x: 78, y: 0, width: 26, height: 23, color: '#047857' },
];

export const DEFAULT_LAYOUT_BLOCKS: LayoutBlock[] = [
  { id: 'block-status', name: 'Status Bar (USB/BLE + Battery)', y: 0, height: 15, enabled: true, description: 'Top connection icon and battery meter' },
  { id: 'block-layer-label', name: 'Layer Banner / Brackets', y: 25, height: 12, enabled: true, description: 'QWERTY text or layer brackets' },
  { id: 'block-art', name: 'Center Character Art', y: 47, height: 24, enabled: true, description: 'Skull or custom avatar art' },
  { id: 'block-branding', name: 'Idle Custom Text', y: 73, height: 6, enabled: true, description: 'Custom username branding' },
  { id: 'block-wpm', name: 'WPM Speed & Arrow Gauge', y: 83, height: 20, enabled: true, description: '3-digit WPM readout and 7-arrow progress meter' },
  { id: 'block-split', name: 'Split Peripheral Link', y: 116, height: 10, enabled: true, description: 'Bottom link chain icon' },
];

export const DEFAULT_FONT_GLYPHS: FontGlyph[] = [
  // Digits 0-9
  { char: '0', codepoint: 48, x: 0, y: 0, width: 8, height: 10, advanceX: 10 },
  { char: '1', codepoint: 49, x: 8, y: 0, width: 8, height: 10, advanceX: 10 },
  { char: '2', codepoint: 50, x: 16, y: 0, width: 8, height: 10, advanceX: 10 },
  { char: '3', codepoint: 51, x: 24, y: 0, width: 8, height: 10, advanceX: 10 },
  { char: '4', codepoint: 52, x: 32, y: 0, width: 8, height: 10, advanceX: 10 },
  { char: '5', codepoint: 53, x: 40, y: 0, width: 8, height: 10, advanceX: 10 },
  { char: '6', codepoint: 54, x: 48, y: 0, width: 8, height: 10, advanceX: 10 },
  { char: '7', codepoint: 55, x: 56, y: 0, width: 8, height: 10, advanceX: 10 },
  { char: '8', codepoint: 56, x: 64, y: 0, width: 8, height: 10, advanceX: 10 },
  { char: '9', codepoint: 57, x: 72, y: 0, width: 8, height: 10, advanceX: 10 },
  // Letters A-Z
  { char: 'A', codepoint: 65, x: 0, y: 10, width: 4, height: 5, advanceX: 5 },
  { char: 'B', codepoint: 66, x: 4, y: 10, width: 4, height: 5, advanceX: 5 },
  { char: 'C', codepoint: 67, x: 8, y: 10, width: 4, height: 5, advanceX: 5 },
  { char: 'D', codepoint: 68, x: 12, y: 10, width: 4, height: 5, advanceX: 5 },
  { char: 'E', codepoint: 69, x: 16, y: 10, width: 4, height: 5, advanceX: 5 },
  { char: 'F', codepoint: 70, x: 20, y: 10, width: 4, height: 5, advanceX: 5 },
  { char: 'G', codepoint: 71, x: 24, y: 10, width: 4, height: 5, advanceX: 5 },
  { char: 'H', codepoint: 72, x: 28, y: 10, width: 4, height: 5, advanceX: 5 },
  { char: 'I', codepoint: 73, x: 32, y: 10, width: 3, height: 5, advanceX: 4 },
  { char: 'J', codepoint: 74, x: 35, y: 10, width: 4, height: 5, advanceX: 5 },
  { char: 'K', codepoint: 75, x: 39, y: 10, width: 4, height: 5, advanceX: 5 },
  { char: 'L', codepoint: 76, x: 43, y: 10, width: 4, height: 5, advanceX: 5 },
  { char: 'M', codepoint: 77, x: 47, y: 10, width: 5, height: 5, advanceX: 6 },
  { char: 'N', codepoint: 78, x: 52, y: 10, width: 4, height: 5, advanceX: 5 },
  { char: 'O', codepoint: 79, x: 56, y: 10, width: 4, height: 5, advanceX: 5 },
  { char: 'P', codepoint: 80, x: 60, y: 10, width: 4, height: 5, advanceX: 5 },
  { char: 'Q', codepoint: 81, x: 64, y: 10, width: 4, height: 5, advanceX: 5 },
  { char: 'R', codepoint: 82, x: 68, y: 10, width: 4, height: 5, advanceX: 5 },
  { char: 'S', codepoint: 83, x: 72, y: 10, width: 4, height: 5, advanceX: 5 },
  { char: 'T', codepoint: 84, x: 76, y: 10, width: 5, height: 5, advanceX: 6 },
  { char: 'U', codepoint: 85, x: 81, y: 10, width: 4, height: 5, advanceX: 5 },
  { char: 'V', codepoint: 86, x: 85, y: 10, width: 5, height: 5, advanceX: 6 },
  { char: 'W', codepoint: 87, x: 90, y: 10, width: 5, height: 5, advanceX: 6 },
  { char: 'X', codepoint: 88, x: 95, y: 10, width: 4, height: 5, advanceX: 5 },
  { char: 'Y', codepoint: 89, x: 99, y: 10, width: 5, height: 5, advanceX: 6 },
  { char: 'Z', codepoint: 90, x: 104, y: 10, width: 4, height: 5, advanceX: 5 },
  // Accents
  { char: 'Á', codepoint: 0x00c1, x: 0, y: 15, width: 4, height: 6, advanceX: 5 },
  { char: 'À', codepoint: 0x00c0, x: 4, y: 15, width: 4, height: 6, advanceX: 5 },
  { char: 'Â', codepoint: 0x00c2, x: 8, y: 15, width: 4, height: 6, advanceX: 5 },
  { char: 'Ã', codepoint: 0x00c3, x: 12, y: 15, width: 4, height: 6, advanceX: 5 },
  { char: 'É', codepoint: 0x00c9, x: 16, y: 15, width: 4, height: 6, advanceX: 5 },
  { char: 'Ê', codepoint: 0x00ca, x: 20, y: 15, width: 4, height: 6, advanceX: 5 },
  { char: 'Í', codepoint: 0x00cd, x: 24, y: 15, width: 3, height: 6, advanceX: 4 },
  { char: 'Ó', codepoint: 0x00d3, x: 27, y: 15, width: 4, height: 6, advanceX: 5 },
  { char: 'Ô', codepoint: 0x00d4, x: 31, y: 15, width: 4, height: 6, advanceX: 5 },
  { char: 'Õ', codepoint: 0x00d5, x: 35, y: 15, width: 4, height: 6, advanceX: 5 },
  { char: 'Ú', codepoint: 0x00da, x: 39, y: 15, width: 4, height: 6, advanceX: 5 },
  { char: 'Ç', codepoint: 0x00c7, x: 43, y: 15, width: 4, height: 6, advanceX: 5 },
];

export const DEFAULT_FONT_MAPPINGS: FontCharMapping[] = [
  // Digits (default in Big slot, 8x10)
  { id: 'FONT_CHAR_0', chars: '0', big: { x: 0, y: 0, width: 8, height: 10, advanceX: 10 }, small: null },
  { id: 'FONT_CHAR_1', chars: '1', big: { x: 8, y: 0, width: 8, height: 10, advanceX: 10 }, small: null },
  { id: 'FONT_CHAR_2', chars: '2', big: { x: 16, y: 0, width: 8, height: 10, advanceX: 10 }, small: null },
  { id: 'FONT_CHAR_3', chars: '3', big: { x: 24, y: 0, width: 8, height: 10, advanceX: 10 }, small: null },
  { id: 'FONT_CHAR_4', chars: '4', big: { x: 32, y: 0, width: 8, height: 10, advanceX: 10 }, small: null },
  { id: 'FONT_CHAR_5', chars: '5', big: { x: 40, y: 0, width: 8, height: 10, advanceX: 10 }, small: null },
  { id: 'FONT_CHAR_6', chars: '6', big: { x: 48, y: 0, width: 8, height: 10, advanceX: 10 }, small: null },
  { id: 'FONT_CHAR_7', chars: '7', big: { x: 56, y: 0, width: 8, height: 10, advanceX: 10 }, small: null },
  { id: 'FONT_CHAR_8', chars: '8', big: { x: 64, y: 0, width: 8, height: 10, advanceX: 10 }, small: null },
  { id: 'FONT_CHAR_9', chars: '9', big: { x: 72, y: 0, width: 8, height: 10, advanceX: 10 }, small: null },

  // Letters (default in Small slot, e.g. "aA")
  { id: 'FONT_CHAR_A', chars: 'aA', small: { x: 0, y: 10, width: 4, height: 5, advanceX: 5 }, big: null },
  { id: 'FONT_CHAR_B', chars: 'bB', small: { x: 4, y: 10, width: 4, height: 5, advanceX: 5 }, big: null },
  { id: 'FONT_CHAR_C', chars: 'cC', small: { x: 8, y: 10, width: 4, height: 5, advanceX: 5 }, big: null },
  { id: 'FONT_CHAR_D', chars: 'dD', small: { x: 12, y: 10, width: 4, height: 5, advanceX: 5 }, big: null },
  { id: 'FONT_CHAR_E', chars: 'eE', small: { x: 16, y: 10, width: 4, height: 5, advanceX: 5 }, big: null },
  { id: 'FONT_CHAR_F', chars: 'fF', small: { x: 20, y: 10, width: 4, height: 5, advanceX: 5 }, big: null },
  { id: 'FONT_CHAR_G', chars: 'gG', small: { x: 24, y: 10, width: 4, height: 5, advanceX: 5 }, big: null },
  { id: 'FONT_CHAR_H', chars: 'hH', small: { x: 28, y: 10, width: 4, height: 5, advanceX: 5 }, big: null },
  { id: 'FONT_CHAR_I', chars: 'iI', small: { x: 32, y: 10, width: 3, height: 5, advanceX: 4 }, big: null },
  { id: 'FONT_CHAR_J', chars: 'jJ', small: { x: 35, y: 10, width: 4, height: 5, advanceX: 5 }, big: null },
  { id: 'FONT_CHAR_K', chars: 'kK', small: { x: 39, y: 10, width: 4, height: 5, advanceX: 5 }, big: null },
  { id: 'FONT_CHAR_L', chars: 'lL', small: { x: 43, y: 10, width: 4, height: 5, advanceX: 5 }, big: null },
  { id: 'FONT_CHAR_M', chars: 'mM', small: { x: 47, y: 10, width: 5, height: 5, advanceX: 6 }, big: null },
  { id: 'FONT_CHAR_N', chars: 'nN', small: { x: 52, y: 10, width: 4, height: 5, advanceX: 5 }, big: null },
  { id: 'FONT_CHAR_O', chars: 'oO', small: { x: 56, y: 10, width: 4, height: 5, advanceX: 5 }, big: null },
  { id: 'FONT_CHAR_P', chars: 'pP', small: { x: 60, y: 10, width: 4, height: 5, advanceX: 5 }, big: null },
  { id: 'FONT_CHAR_Q', chars: 'qQ', small: { x: 64, y: 10, width: 4, height: 5, advanceX: 5 }, big: null },
  { id: 'FONT_CHAR_R', chars: 'rR', small: { x: 68, y: 10, width: 4, height: 5, advanceX: 5 }, big: null },
  { id: 'FONT_CHAR_S', chars: 'sS', small: { x: 72, y: 10, width: 4, height: 5, advanceX: 5 }, big: null },
  { id: 'FONT_CHAR_T', chars: 'tT', small: { x: 76, y: 10, width: 5, height: 5, advanceX: 6 }, big: null },
  { id: 'FONT_CHAR_U', chars: 'uU', small: { x: 81, y: 10, width: 4, height: 5, advanceX: 5 }, big: null },
  { id: 'FONT_CHAR_V', chars: 'vV', small: { x: 85, y: 10, width: 5, height: 5, advanceX: 6 }, big: null },
  { id: 'FONT_CHAR_W', chars: 'wW', small: { x: 90, y: 10, width: 5, height: 5, advanceX: 6 }, big: null },
  { id: 'FONT_CHAR_X', chars: 'xX', small: { x: 95, y: 10, width: 4, height: 5, advanceX: 5 }, big: null },
  { id: 'FONT_CHAR_Y', chars: 'yY', small: { x: 99, y: 10, width: 5, height: 5, advanceX: 6 }, big: null },
  { id: 'FONT_CHAR_Z', chars: 'zZ', small: { x: 104, y: 10, width: 4, height: 5, advanceX: 5 }, big: null },

  // Accents (in Small slot)
  { id: 'FONT_CHAR_A_ACUTE', chars: 'áÁ', small: { x: 0, y: 15, width: 4, height: 6, advanceX: 5 }, big: null },
  { id: 'FONT_CHAR_A_GRAVE', chars: 'àÀ', small: { x: 4, y: 15, width: 4, height: 6, advanceX: 5 }, big: null },
  { id: 'FONT_CHAR_A_CIRC', chars: 'âÂ', small: { x: 8, y: 15, width: 4, height: 6, advanceX: 5 }, big: null },
  { id: 'FONT_CHAR_A_TILDE', chars: 'ãÃ', small: { x: 12, y: 15, width: 4, height: 6, advanceX: 5 }, big: null },
  { id: 'FONT_CHAR_E_ACUTE', chars: 'éÉ', small: { x: 16, y: 15, width: 4, height: 6, advanceX: 5 }, big: null },
  { id: 'FONT_CHAR_E_CIRC', chars: 'êÊ', small: { x: 20, y: 15, width: 4, height: 6, advanceX: 5 }, big: null },
  { id: 'FONT_CHAR_I_ACUTE', chars: 'íÍ', small: { x: 24, y: 15, width: 3, height: 6, advanceX: 4 }, big: null },
  { id: 'FONT_CHAR_O_ACUTE', chars: 'óÓ', small: { x: 27, y: 15, width: 4, height: 6, advanceX: 5 }, big: null },
  { id: 'FONT_CHAR_O_CIRC', chars: 'ôÔ', small: { x: 31, y: 15, width: 4, height: 6, advanceX: 5 }, big: null },
  { id: 'FONT_CHAR_O_TILDE', chars: 'õÕ', small: { x: 35, y: 15, width: 4, height: 6, advanceX: 5 }, big: null },
  { id: 'FONT_CHAR_U_ACUTE', chars: 'úÚ', small: { x: 39, y: 15, width: 4, height: 6, advanceX: 5 }, big: null },
  { id: 'FONT_CHAR_C_CEDIL', chars: 'çÇ', small: { x: 43, y: 15, width: 4, height: 6, advanceX: 5 }, big: null },
];

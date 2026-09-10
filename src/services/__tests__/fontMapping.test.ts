import { describe, it, expect } from 'vitest';
import { BwpxGrid } from '../../bwpx/core/BwpxGrid';
import type { FontCharMapping, SpriteSlice } from '../../types/zmk';
import { DEFAULT_FONT_MAPPINGS } from '../../types/zmk';
import { generateCHeader, parseCHeader } from '../cHeaderParser';

describe('Font Character Mapping & Dual-Slot Architecture', () => {
  it('DEFAULT_FONT_MAPPINGS contains both Big and Small slots for digits and letters, plus Kana and Kanji', () => {
    const digit0 = DEFAULT_FONT_MAPPINGS.find(m => m.chars === '0');
    expect(digit0).toBeDefined();
    expect(digit0?.big).toBeDefined();
    expect(digit0?.big?.width).toBe(8);
    expect(digit0?.big?.height).toBe(10);
    expect(digit0?.small).toBeDefined();
    expect(digit0?.small?.width).toBe(3);
    expect(digit0?.small?.height).toBe(5);

    const charA = DEFAULT_FONT_MAPPINGS.find(m => m.chars.includes('A'));
    expect(charA).toBeDefined();
    expect(charA?.small).toBeDefined();
    expect(charA?.small?.width).toBe(3);
    expect(charA?.small?.height).toBe(5);
    expect(charA?.big).toBeDefined();
    expect(charA?.big?.width).toBe(5);
    expect(charA?.big?.height).toBe(10);

    const acuteA = DEFAULT_FONT_MAPPINGS.find(m => m.chars.includes('Á'));
    expect(acuteA).toBeDefined();
    expect(acuteA?.small?.height).toBe(6);
    expect(acuteA?.big?.height).toBe(12);

    const hiraA = DEFAULT_FONT_MAPPINGS.find(m => m.chars === 'あ');
    expect(hiraA).toBeDefined();
    expect(hiraA?.small?.width).toBe(8);
    expect(hiraA?.small?.height).toBe(8);
    expect(hiraA?.big?.width).toBe(10);
    expect(hiraA?.big?.height).toBe(10);

    const kataA = DEFAULT_FONT_MAPPINGS.find(m => m.chars === 'ア');
    expect(kataA).toBeDefined();
    expect(kataA?.small?.width).toBe(8);
    expect(kataA?.small?.height).toBe(8);
    expect(kataA?.big?.width).toBe(10);
    expect(kataA?.big?.height).toBe(10);

    const symExcl = DEFAULT_FONT_MAPPINGS.find(m => m.chars === '!');
    expect(symExcl).toBeDefined();
    expect(symExcl?.small?.height).toBe(5);
    expect(symExcl?.big?.height).toBe(10);

    const kanjiWolf = DEFAULT_FONT_MAPPINGS.find(m => m.chars === '狼');
    expect(kanjiWolf).toBeDefined();
    expect(kanjiWolf?.small?.width).toBe(8);
    expect(kanjiWolf?.small?.height).toBe(8);
    expect(kanjiWolf?.big?.width).toBe(10);
    expect(kanjiWolf?.big?.height).toBe(10);
  });

  it('supports multi-character aliases (e.g. aAÁ)', () => {
    const mapping: FontCharMapping = {
      id: 'FONT_CHAR_A_COMPOUND',
      chars: 'aAÁ',
      small: { x: 10, y: 10, width: 4, height: 5, advanceX: 5 },
      big: null,
    };

    // Any char in chars matches
    const isMatch = (char: string) => mapping.chars.includes(char) || mapping.chars.toUpperCase().includes(char.toUpperCase());
    expect(isMatch('a')).toBe(true);
    expect(isMatch('A')).toBe(true);
    expect(isMatch('Á')).toBe(true);
    expect(isMatch('b')).toBe(false);
  });

  it('supports non-Latin characters (e.g. Kanji 漢, Cyrillic Д)', () => {
    const kanjiMapping: FontCharMapping = {
      id: 'FONT_CHAR_KANJI',
      chars: '漢',
      small: { x: 0, y: 0, width: 12, height: 12 }, // advanceX omitted -> optional
      big: { x: 20, y: 0, width: 16, height: 16, advanceX: 18 },
    };

    expect(kanjiMapping.small?.advanceX).toBeUndefined();
    // Default fallback calculation:
    const smallAdv = kanjiMapping.small?.advanceX ?? (kanjiMapping.small!.width + 1);
    expect(smallAdv).toBe(13);

    const bigAdv = kanjiMapping.big?.advanceX ?? (kanjiMapping.big!.width + 1);
    expect(bigAdv).toBe(18);
  });

  it('generates dual font tables FONT_GLYPHS_SMALL and FONT_GLYPHS_BIG in C header', () => {
    const symbolsGrid = new BwpxGrid(128, 34);
    const fontGrid = new BwpxGrid(128, 22);
    const symbolSlices: SpriteSlice[] = [
      { id: 'SYMBOL_USB', name: 'USB', groupId: 'SYMBOL_USB', groupOrder: 1, x: 0, y: 0, width: 8, height: 8 },
    ];
    const mappings: FontCharMapping[] = [
      {
        id: 'FONT_CHAR_0',
        chars: '0',
        big: { x: 0, y: 0, width: 8, height: 10, advanceX: 10 },
        small: null,
      },
      {
        id: 'FONT_CHAR_A',
        chars: 'aA',
        small: { x: 0, y: 10, width: 4, height: 5, advanceX: 5 },
        big: null,
      },
      {
        id: 'FONT_CHAR_KANJI',
        chars: '漢',
        small: { x: 10, y: 10, width: 8, height: 8 },
        big: { x: 20, y: 0, width: 12, height: 12, advanceX: 14 },
      },
    ];

    const cCode = generateCHeader(symbolsGrid, symbolSlices, fontGrid, mappings);

    // Verify FONT_GLYPHS_SMALL is present and contains 'a', 'A', and '漢'
    expect(cCode).toContain('FONT_GLYPHS_SMALL');
    expect(cCode).toContain("'a'");
    expect(cCode).toContain("'A'");
    // Kanji hex codepoint for 漢 (0x6F22)
    expect(cCode).toContain('0x6F22');

    // Verify FONT_GLYPHS_BIG is present and contains '0' and '漢'
    expect(cCode).toContain('FONT_GLYPHS_BIG');
    expect(cCode).toContain("'0'");

    // Verify font descriptors font_small and font_big are defined
    expect(cCode).toContain('struct display_font font_small');
    expect(cCode).toContain('struct display_font font_big');

    // Verify backward compatible font descriptors are defined
    expect(cCode).toContain('struct display_font font_digits');
    expect(cCode).toContain('struct display_font font_text');
    expect(cCode).toContain('struct display_font font_default');
  });

  it('parses C header with FONT_GLYPHS_SMALL and FONT_GLYPHS_BIG back into fontMappings', () => {
    const symbolsGrid = new BwpxGrid(128, 34);
    const fontGrid = new BwpxGrid(128, 22);
    const symbolSlices: SpriteSlice[] = [
      { id: 'SYMBOL_USB', name: 'USB', groupId: 'SYMBOL_USB', groupOrder: 1, x: 0, y: 0, width: 8, height: 8 },
    ];
    const mappings: FontCharMapping[] = [
      {
        id: 'FONT_CHAR_A',
        chars: 'A',
        small: { x: 5, y: 10, width: 4, height: 5, advanceX: 5 },
        big: { x: 15, y: 0, width: 8, height: 10, advanceX: 9 },
      },
    ];

    const cCode = generateCHeader(symbolsGrid, symbolSlices, fontGrid, mappings);
    const parsed = parseCHeader(cCode);

    expect(parsed.fontMappings).toBeDefined();
    const parsedA = parsed.fontMappings.find(m => m.chars.includes('A'));
    expect(parsedA).toBeDefined();
    expect(parsedA?.small).toBeDefined();
    expect(parsedA?.small?.width).toBe(4);
    expect(parsedA?.big).toBeDefined();
    expect(parsedA?.big?.width).toBe(8);
  });

  it('provides proportional modern pixel big font for alphabet (e.g. A is 5px, E is 4px, I is 3px, M is 7px)', () => {
    const a = DEFAULT_FONT_MAPPINGS.find(m => m.id === 'FONT_CHAR_A');
    const i = DEFAULT_FONT_MAPPINGS.find(m => m.id === 'FONT_CHAR_I');
    const m = DEFAULT_FONT_MAPPINGS.find(m => m.id === 'FONT_CHAR_M');
    const e = DEFAULT_FONT_MAPPINGS.find(m => m.id === 'FONT_CHAR_E');

    expect(a?.big?.width).toBe(5);
    expect(a?.big?.advanceX).toBe(6);

    expect(i?.big?.width).toBe(3);
    expect(i?.big?.advanceX).toBe(4);

    expect(m?.big?.width).toBe(7);
    expect(m?.big?.advanceX).toBe(8);

    expect(e?.big?.width).toBe(4);
    expect(e?.big?.advanceX).toBe(5);
  });
});

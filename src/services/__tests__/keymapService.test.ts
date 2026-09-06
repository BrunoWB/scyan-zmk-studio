import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';

const mockGetContent = vi.fn();

vi.mock('@octokit/rest', () => {
  return {
    Octokit: class {
      repos = {
        getContent: (...args: any[]) => mockGetContent(...args),
      };
    },
  };
});

import {
  parseZmkKeymap,
  cleanKeyLabel,
  parseBindingToken,
  stripDtsComments,
  expandDtsMacros,
  decodeBase64Utf8,
  fetchRepoKeymap,
  getKeyAliases,
  getCoordForPhysicalScanCode,
  getMatchingKeyCoords,
} from '../keymapService';
import type { GitHubRepoConfig } from '../githubService';

const fixturesDir = path.join(__dirname, 'fixtures');

function loadFixture(filename: string): string {
  return fs.readFileSync(path.join(fixturesDir, filename), 'utf-8');
}

describe('ZMK Keymap Parser - Real-World Public Configs', () => {
  it('parses BrunoWB Corne 36-key 5-column layout with 5 layers', () => {
    const content = loadFixture('corne_36_brunowb.keymap');
    const layout = parseZmkKeymap(content, 'corne.keymap');

    expect(layout.name).toBe('corne');
    expect(layout.columns).toBe(5);
    expect(layout.rows).toBe(3);
    expect(layout.thumbCount).toBe(3);
    expect(layout.layoutType).toBe('Corne 5×3 (36 keys)');

    // Check layer names
    expect(layout.layerNames).toEqual(['FREE', 'QWERTY', 'RIGHTHOLD', 'LEFTHOLD', 'SIMMHOLD']);
    expect(layout.layers?.length).toBe(5);

    // Check Layer 0 (Free) key placement
    const free = layout.layers![0];
    expect(free.name).toBe('FREE');
    expect(free.leftMatrix[0]).toEqual(['Q', 'W', 'F', 'P', 'G']);
    expect(free.rightMatrix[0]).toEqual(['J', 'L', 'U', 'Y', 'ALT']);
    expect(free.leftThumbs).toEqual(['GUI', 'SPC', 'ENT']);
    expect(free.rightThumbs).toEqual(['BSPC', 'SFT', 'GUI']);

    // Check Layer 1 (Qwerty) key placement
    const qwerty = layout.layers![1];
    expect(qwerty.name).toBe('QWERTY');
    expect(qwerty.leftMatrix[0]).toEqual(['Q', 'W', 'E', 'R', 'T']);
    expect(qwerty.rightMatrix[0]).toEqual(['Y', 'U', 'I', 'O', 'P']);

    // Check Layer 4 (SimmHold) system & bluetooth behaviors
    const simm = layout.layers![4];
    expect(simm.name).toBe('SIMMHOLD');
    expect(simm.leftMatrix[0]).toEqual(['BT0', 'BT1', 'BT2', 'BT3', 'BT4']);
    expect(simm.rightMatrix[0]).toEqual(['_', 'BLE', 'USB', 'CLR', 'CLR*']);
  });

  it('parses official ZMK Corne 42-key layout with display-name attributes and comments', () => {
    const content = loadFixture('corne_42_official.keymap');
    const layout = parseZmkKeymap(content, 'corne.keymap');

    expect(layout.name).toBe('corne');
    expect(layout.columns).toBe(6);
    expect(layout.rows).toBe(3);
    expect(layout.thumbCount).toBe(3);
    expect(layout.layoutType).toBe('Corne 6×3 (42 keys)');

    // Layer names extracted from display-name
    expect(layout.layerNames).toEqual(['DEFAULT', 'LOWER', 'RAISE']);
    expect(layout.layers?.length).toBe(3);

    // Layer 0 (Default)
    const layer0 = layout.layers![0];
    expect(layer0.leftMatrix[0]).toEqual(['TAB', 'Q', 'W', 'E', 'R', 'T']);
    expect(layer0.rightMatrix[0]).toEqual(['Y', 'U', 'I', 'O', 'P', 'BSPC']);
    expect(layer0.leftMatrix[1]).toEqual(['CTL', 'A', 'S', 'D', 'F', 'G']);
    expect(layer0.rightMatrix[1]).toEqual(['H', 'J', 'K', 'L', ';', "'"]);
    expect(layer0.leftThumbs).toEqual(['GUI', 'L1', 'SPC']);
    expect(layer0.rightThumbs).toEqual(['ENT', 'L2', 'ALT']);

    // Layer 1 (Lower) numbers & navigation
    const lower = layout.layers![1];
    expect(lower.leftMatrix[0]).toEqual(['TAB', '1', '2', '3', '4', '5']);
    expect(lower.rightMatrix[0]).toEqual(['6', '7', '8', '9', '0', 'BSPC']);
    expect(lower.leftMatrix[1]).toEqual(['CLR', 'BT0', 'BT1', 'BT2', 'BT3', 'BT4']);
    expect(lower.rightMatrix[1]).toEqual(['◀', '▼', '▲', '▶', '_', '_']);
  });

  it('parses Sweep / Ferris Cradio 34-key layout with #define macros and hold-tap behaviors', () => {
    const content = loadFixture('cradio_34_sweep.keymap');
    const layout = parseZmkKeymap(content, 'cradio.keymap');

    expect(layout.name).toBe('cradio');
    expect(layout.columns).toBe(5);
    expect(layout.rows).toBe(3);
    expect(layout.thumbCount).toBe(2);
    expect(layout.layoutType).toBe('Sweep / Ferris (34 keys)');

    // Ensure hold_tap behavior inside behaviors { ... } is NOT parsed as a layer
    expect(layout.layerNames).not.toContain('HOLD_TAP');
    expect(layout.layerNames).not.toContain('HT');
    expect(layout.layerNames).toContain('DEFAULT');
    expect(layout.layerNames).toContain('RIGHT');
    expect(layout.layerNames).toContain('LEFT');
    expect(layout.layerNames).toContain('TRI');

    // Layer 0: Homerow mods expanded cleanly from HRML / HRMR
    const layer0 = layout.layers![0];
    expect(layer0.leftMatrix[0]).toEqual(['Q', 'W', 'E', 'R', 'T']);
    expect(layer0.rightMatrix[0]).toEqual(['Y', 'U', 'I', 'O', 'P']);
    // HRML(A, S, D, F) -> tap keys are A, S, D, F
    expect(layer0.leftMatrix[1]).toEqual(['A', 'S', 'D', 'F', 'G']);
    // HRMR(J, K, L, SQT) -> tap keys are J, K, L, SQT (')
    expect(layer0.rightMatrix[1]).toEqual(['H', 'J', 'K', 'L', "'"]);
    expect(layer0.leftThumbs).toEqual(['TAB', 'ENT']);
    expect(layer0.rightThumbs).toEqual(['SPC', 'BSPC']);
  });

  it('parses official Lily58 58-key layout with 4 rows and sensor-bindings', () => {
    const content = loadFixture('lily58_official.keymap');
    const layout = parseZmkKeymap(content, 'lily58.keymap');

    expect(layout.name).toBe('lily58');
    expect(layout.columns).toBe(6);
    expect(layout.rows).toBe(4);
    expect(layout.thumbCount).toBe(5);
    expect(layout.layoutType).toBe('Lily58 / Sofle (58 keys)');

    expect(layout.layerNames).toEqual(['DEFAULT', 'LOWER', 'RAISE']);

    // Layer 0 has number row as row 0
    const layer0 = layout.layers![0];
    expect(layer0.leftMatrix[0]).toEqual(['ESC', '1', '2', '3', '4', '5']);
    expect(layer0.rightMatrix[0]).toEqual(['6', '7', '8', '9', '0', '`']);
    expect(layer0.leftMatrix[1]).toEqual(['TAB', 'Q', 'W', 'E', 'R', 'T']);
    expect(layer0.rightMatrix[1]).toEqual(['Y', 'U', 'I', 'O', 'P', '-']);
  });

  it('parses MoErgo Glove80 80-key layout ignoring behaviors and macros nodes', () => {
    const content = loadFixture('glove80_moergo.keymap');
    const layout = parseZmkKeymap(content, 'glove80.keymap');

    expect(layout.name).toBe('glove80');
    // Ensure behaviors { tap_dance_0 ... } and macros { rgb_ug_status ... } are not parsed as layers
    expect(layout.layerNames).not.toContain('LAYER_TD');
    expect(layout.layerNames).not.toContain('TAP_DANCE_0');
    expect(layout.layerNames).not.toContain('RGB_UG_STATUS_MACRO');
    expect(layout.layerNames).not.toContain('BT_0');

    // Expected layers inside keymap
    expect(layout.layerNames).toEqual(['DEFAULT', 'LOWER', 'MAGIC', 'FACTORY_TEST']);
    expect(layout.layoutType).toContain('Glove80');
    expect(layout.rows).toBe(5);
    expect(layout.columns).toBe(6);
  });

  it('parses Caksoylar Rommana 30-key compact split layout', () => {
    const content = loadFixture('rommana_caksoylar.keymap');
    const layout = parseZmkKeymap(content, 'rommana.keymap');

    expect(layout.name).toBe('rommana');
    expect(layout.columns).toBe(5);
    expect(layout.rows).toBe(3);
    expect(layout.thumbCount).toBe(2);
    expect(layout.layoutType).toBe('Custom Split (30 keys)');
    expect(layout.layerNames).toEqual(['DEFAULT']);

    const layer0 = layout.layers![0];
    expect(layer0.leftMatrix[0]).toEqual(['Q', 'W', 'E', 'R', 'T']);
    expect(layer0.rightMatrix[0]).toEqual(['Y', 'U', 'I', 'O', 'P']);
  });

  it('parses Urob base.keymap with ZMK_BASE_LAYER macros', () => {
    const content = loadFixture('base_urob.keymap');
    const layout = parseZmkKeymap(content, 'base.keymap');

    expect(layout.name).toBe('base');
    expect(layout.columns).toBe(5);
    expect(layout.rows).toBe(3);

    // Expected layers defined with ZMK_BASE_LAYER(name, ...)
    expect(layout.layerNames).toContain('BASE');
    expect(layout.layerNames).toContain('NAV');
    expect(layout.layerNames).toContain('FN');
    expect(layout.layerNames).toContain('NUM');
    expect(layout.layerNames).toContain('SYS');
    expect(layout.layerNames).toContain('MOUSE');
  });
});

describe('Geometry Detection Heuristics', () => {
  it('identifies Corne 5x3 from five_column matrix transform flag', () => {
    const dts = `
      / { chosen { zmk,matrix-transform = &five_column_transform; };
          keymap { compatible = "zmk,keymap";
            l0 { bindings = <
              &kp A &kp B &kp C &kp D &kp E  &kp F &kp G &kp H &kp I &kp J
              &kp K &kp L &kp M &kp N &kp O  &kp P &kp Q &kp R &kp S &kp T
              &kp U &kp V &kp W &kp X &kp Y  &kp Z &kp 1 &kp 2 &kp 3 &kp 4
                                &kp 5 &kp 6 &kp 7  &kp 8 &kp 9 &kp 0
            >; };
          };
      };
    `;
    const layout = parseZmkKeymap(dts);
    expect(layout.columns).toBe(5);
    expect(layout.rows).toBe(3);
    expect(layout.thumbCount).toBe(3);
    expect(layout.layoutType).toBe('Corne 5×3 (36 keys)');
  });

  it('identifies Corne 6x3 from 42 total bindings', () => {
    const keys = Array.from({ length: 42 }, (_, i) => `&kp N${i}`).join(' ');
    const dts = `
      / { keymap { compatible = "zmk,keymap";
            l0 { bindings = < ${keys} >; };
          };
      };
    `;
    const layout = parseZmkKeymap(dts);
    expect(layout.columns).toBe(6);
    expect(layout.rows).toBe(3);
    expect(layout.thumbCount).toBe(3);
    expect(layout.layoutType).toBe('Corne 6×3 (42 keys)');
  });

  it('identifies Sweep / Ferris from 34 keys', () => {
    const keys = Array.from({ length: 34 }, (_, i) => `&kp N${i}`).join(' ');
    const dts = `
      / { keymap { compatible = "zmk,keymap";
            l0 { bindings = < ${keys} >; };
          };
      };
    `;
    const layout = parseZmkKeymap(dts);
    expect(layout.columns).toBe(5);
    expect(layout.rows).toBe(3);
    expect(layout.thumbCount).toBe(2);
    expect(layout.layoutType).toBe('Sweep / Ferris (34 keys)');
  });

  it('identifies Lily58 from 58 keys', () => {
    const keys = Array.from({ length: 58 }, (_, i) => `&kp N${i}`).join(' ');
    const dts = `
      / { keymap { compatible = "zmk,keymap";
            l0 { bindings = < ${keys} >; };
          };
      };
    `;
    const layout = parseZmkKeymap(dts);
    expect(layout.columns).toBe(6);
    expect(layout.rows).toBe(4);
    expect(layout.thumbCount).toBe(5);
    expect(layout.layoutType).toBe('Lily58 / Sofle (58 keys)');
  });
});

describe('Binding Token Parsing & Label Cleaning', () => {
  it('cleans standard keys and numbers', () => {
    expect(cleanKeyLabel('Q')).toBe('Q');
    expect(cleanKeyLabel('N1')).toBe('1');
    expect(cleanKeyLabel('NUMBER_9')).toBe('9');
    expect(cleanKeyLabel('COMMA')).toBe(',');
    expect(cleanKeyLabel('PERIOD')).toBe('.');
    expect(cleanKeyLabel('DOT')).toBe('.');
    expect(cleanKeyLabel('SEMI')).toBe(';');
    expect(cleanKeyLabel('SQT')).toBe("'");
    expect(cleanKeyLabel('BSPC')).toBe('BSPC');
    expect(cleanKeyLabel('SPACE')).toBe('SPC');
    expect(cleanKeyLabel('ENTER')).toBe('ENT');
  });

  it('cleans arrows and navigation keys', () => {
    expect(cleanKeyLabel('UP')).toBe('▲');
    expect(cleanKeyLabel('DOWN')).toBe('▼');
    expect(cleanKeyLabel('LEFT')).toBe('◀');
    expect(cleanKeyLabel('RIGHT')).toBe('▶');
    expect(cleanKeyLabel('HOME')).toBe('HOME');
    expect(cleanKeyLabel('END')).toBe('END');
    expect(cleanKeyLabel('PG_UP')).toBe('PGUP');
    expect(cleanKeyLabel('PG_DN')).toBe('PGDN');
  });

  it('strips nested modifier wrappers cleanly without dangling parentheses', () => {
    expect(cleanKeyLabel('LG(PERIOD)')).toBe('.');
    expect(cleanKeyLabel('LG(P)')).toBe('P');
    expect(cleanKeyLabel('LC(LEFT)')).toBe('◀');
    expect(cleanKeyLabel('LA(F4)')).toBe('F4');
    expect(cleanKeyLabel('LS(TAB)')).toBe('TAB');
    expect(cleanKeyLabel('RA(N1)')).toBe('1');
    expect(cleanKeyLabel('LG(LC(RIGHT))')).toBe('▶');
    expect(cleanKeyLabel('LG(LC(LS(Q)))')).toBe('Q');
  });

  it('parses standard ZMK behaviors into concise keycap labels', () => {
    expect(parseBindingToken('&kp Q')).toBe('Q');
    expect(parseBindingToken('&kp BSPC')).toBe('BSPC');
    expect(parseBindingToken('&kp LG(PERIOD)')).toBe('.');
    expect(parseBindingToken('&mt RIGHT_ALT SQT')).toBe("'");
    expect(parseBindingToken('&hml LGUI A')).toBe('A');
    expect(parseBindingToken('&hmr RCTRL N')).toBe('N');
    expect(parseBindingToken('&lt 3 LEFT_GUI')).toBe('GUI');
    expect(parseBindingToken('&lt 2 TAB')).toBe('TAB');
    expect(parseBindingToken('&lt_spc NAV 0')).toBe('0');
    expect(parseBindingToken('&mo 1')).toBe('L1');
    expect(parseBindingToken('&tog 2')).toBe('TG2');
    expect(parseBindingToken('&to 0')).toBe('TO0');
    expect(parseBindingToken('&sl 3')).toBe('L3');
    expect(parseBindingToken('&bt BT_SEL 0')).toBe('BT0');
    expect(parseBindingToken('&bt BT_SEL 3')).toBe('BT3');
    expect(parseBindingToken('&bt BT_CLR')).toBe('CLR');
    expect(parseBindingToken('&bt BT_CLR_ALL')).toBe('CLR*');
    expect(parseBindingToken('&out OUT_BLE')).toBe('BLE');
    expect(parseBindingToken('&out OUT_USB')).toBe('USB');
    expect(parseBindingToken('&ext_power EP_TOG')).toBe('EP');
    expect(parseBindingToken('&bootloader')).toBe('BOOT');
    expect(parseBindingToken('&sys_reset')).toBe('RST');
    expect(parseBindingToken('&studio_unlock')).toBe('UNLK');
    expect(parseBindingToken('&caps_word')).toBe('CAPS');
    expect(parseBindingToken('&key_repeat')).toBe('RPT');
    expect(parseBindingToken('&trans')).toBe('_');
    expect(parseBindingToken('&none')).toBe('');
  });
});

describe('Preprocessor & Comment Handling', () => {
  it('strips block comments and line comments without token merging', () => {
    const raw = `
      // Single line comment
      &kp A /* inline block comment */ &kp B
      /* Multi-line
         comment with { braces }
      */
      &kp C
    `;
    const cleaned = stripDtsComments(raw);
    expect(cleaned).not.toContain('Single line comment');
    expect(cleaned).not.toContain('inline block comment');
    expect(cleaned).not.toContain('Multi-line');
    expect(cleaned).toContain('&kp A');
    expect(cleaned).toContain('&kp B');
    expect(cleaned).toContain('&kp C');
  });

  it('expands function-like and object-like macros', () => {
    const raw = `
      #define HRML(k1,k2) &ht LSHFT k1 &ht LALT k2
      #define XXX &none
      #define ___ &trans
      HRML(A, B) XXX ___
    `;
    const expanded = expandDtsMacros(raw);
    expect(expanded).toContain('&ht LSHFT A &ht LALT B');
    expect(expanded).toContain('&none');
    expect(expanded).toContain('&trans');
  });
});

describe('UTF-8 Base64 Decoding', () => {
  it('decodes UTF-8 characters including box-drawing and symbols safely', () => {
    // "╭───┬───╮\n▲ ▼ ◀ ▶\n" in UTF-8 Base64
    const originalText = '╭───┬───╮\n▲ ▼ ◀ ▶\n';
    const utf8Bytes = new TextEncoder().encode(originalText);
    let binary = '';
    utf8Bytes.forEach(b => {
      binary += String.fromCharCode(b);
    });
    const base64 = btoa(binary);

    const decoded = decodeBase64Utf8(base64);
    expect(decoded).toBe(originalText);
  });
});

describe('fetchRepoKeymap - Resilience & Fallback Tests', () => {
  beforeEach(() => {
    mockGetContent.mockReset();
  });

  it('falls back from branch master to main when master 404s', async () => {
    const keymapContent = `
      / { keymap { compatible = "zmk,keymap";
            free { bindings = < &kp Q &kp W &kp E &kp R &kp T &kp Y &kp U &kp I &kp O &kp P
                                &kp A &kp S &kp D &kp F &kp G &kp H &kp J &kp K &kp L &kp SEMI
                                &kp Z &kp X &kp C &kp V &kp B &kp N &kp M &kp COMMA &kp DOT &kp FSLH
                                                  &kp SPC &kp ENT &kp BSPC &kp TAB &kp ESC &kp DEL >; };
          }; };
    `;
    const utf8Bytes = new TextEncoder().encode(keymapContent);
    let binary = '';
    utf8Bytes.forEach(b => (binary += String.fromCharCode(b)));
    const base64 = btoa(binary);

    mockGetContent.mockImplementation(async (params: any) => {
      if (params.ref === 'master') {
        const error: any = new Error('Not Found');
        error.status = 404;
        throw error;
      }
      if (params.ref === 'main' && params.path === 'config') {
        return {
          data: [
            { type: 'file', name: 'corne.keymap', path: 'config/corne.keymap' },
          ],
        };
      }
      if (params.ref === 'main' && params.path === 'config/corne.keymap') {
        return {
          data: {
            content: base64,
          },
        };
      }
      const err: any = new Error('Not Found');
      err.status = 404;
      throw err;
    });

    const config: GitHubRepoConfig = {
      owner: 'BrunoWB',
      repo: 'zmk-config',
      branch: 'master', // Configured as master, but repo is on main!
      token: '',
    };

    const result = await fetchRepoKeymap(config);
    expect(result).not.toBeNull();
    expect(result?.filename).toBe('corne.keymap');
    expect(result?.content).toContain('free');
  });

  it('finds keymap in boards/shields when not present in config/', async () => {
    const keymapContent = `/ { keymap { compatible = "zmk,keymap"; l0 { bindings = < &kp A >; }; }; };`;
    const base64 = Buffer.from(keymapContent).toString('base64');

    mockGetContent.mockImplementation(async (params: any) => {
      if (params.path === 'config') {
        const error: any = new Error('Not Found');
        error.status = 404;
        throw error;
      }
      if (params.path === 'boards/shields') {
        return {
          data: [
            { type: 'dir', name: 'corne', path: 'boards/shields/corne' },
          ],
        };
      }
      if (params.path === 'boards/shields/corne') {
        return {
          data: [
            { type: 'file', name: 'corne.keymap', path: 'boards/shields/corne/corne.keymap' },
          ],
        };
      }
      if (params.path === 'boards/shields/corne/corne.keymap') {
        return {
          data: { content: base64 },
        };
      }
      const err: any = new Error('Not Found');
      err.status = 404;
      throw err;
    });

    const config: GitHubRepoConfig = {
      owner: 'caksoylar',
      repo: 'zmk-config',
      branch: 'main',
      token: '',
    };

    const result = await fetchRepoKeymap(config);
    expect(result).not.toBeNull();
    expect(result?.filename).toBe('corne.keymap');
  });

  it('returns null gracefully when repo owner or repo is missing', async () => {
    const config: GitHubRepoConfig = {
      owner: '',
      repo: '',
      branch: 'main',
      token: '',
    };

    const result = await fetchRepoKeymap(config);
    expect(result).toBeNull();
  });
});

describe('Empty Layout & Edge Case Handling', () => {
  it('returns default empty 5x3 layout when content is empty or blank', () => {
    const resEmpty = parseZmkKeymap('');
    expect(resEmpty.layoutType).toBe('5×3 (Empty)');
    expect(resEmpty.columns).toBe(5);
    expect(resEmpty.rows).toBe(3);
    expect(resEmpty.leftMatrix[0]).toEqual(['', '', '', '', '']);

    const resWhitespace = parseZmkKeymap('   \n  \t ');
    expect(resWhitespace.layoutType).toBe('5×3 (Empty)');
  });

  it('returns default layout with filename when DTS has no bindings block', () => {
    const resNoBindings = parseZmkKeymap('// Just comments\n#include <behaviors.dtsi>', 'my_keyboard.keymap');
    expect(resNoBindings.name).toBe('my_keyboard');
    expect(resNoBindings.layoutType).toBe('5×3 (Empty)');
  });

  it('handles single layer keymap cleanly', () => {
    const dts = `
      / { keymap { compatible = "zmk,keymap";
            single_layer { bindings = <
              &kp Q &kp W &kp E &kp R &kp T   &kp Y &kp U &kp I &kp O &kp P
              &kp A &kp S &kp D &kp F &kp G   &kp H &kp J &kp K &kp L &kp SEMI
              &kp Z &kp X &kp C &kp V &kp B   &kp N &kp M &kp COMMA &kp DOT &kp SLASH
                                &kp SPC &kp ENT &kp BSPC   &kp TAB &kp ESC &kp DEL
            >; };
          }; };
    `;
    const layout = parseZmkKeymap(dts, 'single.keymap');
    expect(layout.layerNames).toEqual(['SINGLE']);
    expect(layout.layers?.length).toBe(1);
    expect(layout.leftMatrix[0]).toEqual(['Q', 'W', 'E', 'R', 'T']);
  });
});

describe('User Repository Test Set (BrunoWB/zmk-config)', () => {
  const brunowbContent = loadFixture('corne_36_brunowb.keymap');

  it('accurately parses all 5 layers, matrix transform, and custom Colemak keybindings from BrunoWB corne.keymap', () => {
    const layout = parseZmkKeymap(brunowbContent, 'corne.keymap');

    expect(layout.name).toBe('corne');
    expect(layout.columns).toBe(5);
    expect(layout.rows).toBe(3);
    expect(layout.thumbCount).toBe(3);
    expect(layout.layoutType).toBe('Corne 5×3 (36 keys)');

    // Verify all 5 layer names
    expect(layout.layerNames).toEqual(['FREE', 'QWERTY', 'RIGHTHOLD', 'LEFTHOLD', 'SIMMHOLD']);
    expect(layout.layers?.length).toBe(5);

    // Layer 0: Free (Colemak layout with B on right hand, thumbs: GUI SPC ENT / BSPC SFT GUI)
    const free = layout.layers![0];
    expect(free.name).toBe('FREE');
    expect(free.leftMatrix[0]).toEqual(['Q', 'W', 'F', 'P', 'G']);
    expect(free.rightMatrix[0]).toEqual(['J', 'L', 'U', 'Y', 'ALT']);
    expect(free.leftMatrix[1]).toEqual(['A', 'R', 'S', 'T', 'D']);
    expect(free.rightMatrix[1]).toEqual(['H', 'N', 'E', 'I', 'O']);
    expect(free.leftMatrix[2]).toEqual(['Z', 'X', 'C', 'V', ',']);
    expect(free.rightMatrix[2]).toEqual(['.', 'B', 'K', 'M', "'"]);
    expect(free.leftThumbs).toEqual(['GUI', 'SPC', 'ENT']);
    expect(free.rightThumbs).toEqual(['BSPC', 'SFT', 'GUI']);

    // Layer 1: Qwerty
    const qwerty = layout.layers![1];
    expect(qwerty.name).toBe('QWERTY');
    expect(qwerty.leftMatrix[0]).toEqual(['Q', 'W', 'E', 'R', 'T']);
    expect(qwerty.rightMatrix[0]).toEqual(['Y', 'U', 'I', 'O', 'P']);
    expect(qwerty.leftMatrix[1]).toEqual(['A', 'S', 'D', 'F', 'G']);
    expect(qwerty.rightMatrix[1]).toEqual(['H', 'J', 'K', 'L', "'"]);
    expect(qwerty.leftMatrix[2]).toEqual(['Z', 'X', 'C', 'V', 'B']);
    expect(qwerty.rightMatrix[2]).toEqual(['N', 'M', ',', '.', 'ALT']);
    expect(qwerty.leftThumbs).toEqual(['GUI', 'SPC', 'ENT']);
    expect(qwerty.rightThumbs).toEqual(['BSPC', 'SFT', 'GUI']);

    // Layer 2: RightHold (Navigation & numbers)
    const rightHold = layout.layers![2];
    expect(rightHold.name).toBe('RIGHTHOLD');
    expect(rightHold.leftMatrix[0]).toEqual(['ESC', '1', '2', '3', 'PRNT']);
    expect(rightHold.rightMatrix[0]).toEqual(['DEL', '_', '▲', '_', 'ALT']);
    expect(rightHold.leftMatrix[1]).toEqual(['TAB', '4', '5', '6', 'HOME']);
    expect(rightHold.rightMatrix[1]).toEqual(['_', '◀', '▼', '▶', '_']);
    expect(rightHold.leftMatrix[2]).toEqual(['BSPC', '7', '8', '9', 'END']);
    expect(rightHold.leftThumbs).toEqual(['SFT', '0', 'CTL']);
    expect(rightHold.rightThumbs).toEqual(['_', 'L4', '_']);

    // Layer 3: LeftHold (Symbols & punctuation)
    const leftHold = layout.layers![3];
    expect(leftHold.name).toBe('LEFTHOLD');
    expect(leftHold.leftMatrix[0]).toEqual(['<', '>', '^', 'P', 'G']);
    expect(leftHold.rightMatrix[0]).toEqual(['\\', '(', ')', '-', '_']);
    expect(leftHold.leftMatrix[1]).toEqual(['@', '*', '$', '|', '_']);
    expect(leftHold.rightMatrix[1]).toEqual(['/', '[', ']', '!', '?']);
    expect(leftHold.leftMatrix[2]).toEqual(['&', '~', '%', '#', ';']);
    expect(leftHold.rightMatrix[2]).toEqual([':', '{', '}', '`', '"']);
    expect(leftHold.leftThumbs).toEqual(['_', '_', '_']);
    expect(leftHold.rightThumbs).toEqual(['CTL', '=', '+']);

    // Layer 4: SimmHold (Bluetooth, Power, Output toggles)
    const simmHold = layout.layers![4];
    expect(simmHold.name).toBe('SIMMHOLD');
    expect(simmHold.leftMatrix[0]).toEqual(['BT0', 'BT1', 'BT2', 'BT3', 'BT4']);
    expect(simmHold.rightMatrix[0]).toEqual(['_', 'BLE', 'USB', 'CLR', 'CLR*']);
    expect(simmHold.leftThumbs).toEqual(['TG1', '_', '_']);
    expect(simmHold.rightThumbs).toEqual(['_', '_', '_']);
  });

  it('fetches BrunoWB/zmk-config with master branch falling back to main when master 404s', async () => {
    const base64 = Buffer.from(brunowbContent).toString('base64');

    mockGetContent.mockImplementation((params: any) => {
      // Requests on 'master' branch simulate GitHub 404: "No commit found for the ref master"
      if (params.ref === 'master') {
        const error: any = new Error('No commit found for the ref master');
        error.status = 404;
        throw error;
      }

      // Requests on 'main' branch succeed
      if (params.path === 'config') {
        return {
          data: [
            { type: 'file', name: 'corne.keymap', path: 'config/corne.keymap' },
            { type: 'file', name: 'corne.conf', path: 'config/corne.conf' },
          ],
        };
      }
      if (params.path === 'config/corne.keymap') {
        return {
          data: { content: base64 },
        };
      }

      const error: any = new Error('Not Found');
      error.status = 404;
      throw error;
    });

    const config: GitHubRepoConfig = {
      owner: 'BrunoWB',
      repo: 'zmk-config',
      branch: 'master', // User initially had master
      token: 'fake-token',
    };

    const result = await fetchRepoKeymap(config);
    expect(result).not.toBeNull();
    expect(result?.filename).toBe('corne.keymap');

    // Parse returned content and ensure all 5 layers are present
    const parsed = parseZmkKeymap(result!.content, result!.filename);
    expect(parsed.layers?.length).toBe(5);
    expect(parsed.layerNames).toEqual(['FREE', 'QWERTY', 'RIGHTHOLD', 'LEFTHOLD', 'SIMMHOLD']);
    expect(parsed.layoutType).toBe('Corne 5×3 (36 keys)');
  });

  it('fetches BrunoWB/zmk-config seamlessly with unspecified branch (using repo default branch)', async () => {
    const base64 = Buffer.from(brunowbContent).toString('base64');

    mockGetContent.mockImplementation((params: any) => {
      if (params.path === 'config') {
        return {
          data: [{ type: 'file', name: 'corne.keymap', path: 'config/corne.keymap' }],
        };
      }
      if (params.path === 'config/corne.keymap') {
        return {
          data: { content: base64 },
        };
      }
      const err: any = new Error('Not Found');
      err.status = 404;
      throw err;
    });

    const config: GitHubRepoConfig = {
      owner: 'BrunoWB',
      repo: 'zmk-config',
      branch: '',
      token: '',
    };

    const result = await fetchRepoKeymap(config);
    expect(result).not.toBeNull();
    expect(result?.filename).toBe('corne.keymap');
  });

  describe('Keyboard Event Matching & Single-Selection (Colemak & Multi-Layer)', () => {
    // BrunoWB Colemak layer 0 matrix
    const colemakLayout = {
      columns: 5,
      rows: 3,
      leftMatrix: [
        ['Q', 'W', 'F', 'P', 'G'],
        ['A', 'R', 'S', 'T', 'D'],
        ['Z', 'X', 'C', 'V', ','],
      ],
      rightMatrix: [
        ['J', 'L', 'U', 'Y', 'ALT'],
        ['H', 'N', 'E', 'I', 'O'],
        ['.', 'B', 'K', 'M', "'"],
      ],
      leftThumbs: ['GUI', 'SPC', 'ENT'],
      rightThumbs: ['BSPC', 'SFT', 'GUI'],
    };

    it('getKeyAliases returns standard abbreviations and symbols', () => {
      expect(getKeyAliases(' ')).toContain('SPC');
      expect(getKeyAliases('Enter')).toContain('ENT');
      expect(getKeyAliases('Backspace')).toContain('BSPC');
      expect(getKeyAliases(';')).toContain('SEMI');
    });

    it('getCoordForPhysicalScanCode returns proper 5x3 and 6x3 matrix positions', () => {
      expect(getCoordForPhysicalScanCode('KeyQ', 5)).toBe('L_0_0');
      expect(getCoordForPhysicalScanCode('KeyY', 5)).toBe('R_0_0');
      expect(getCoordForPhysicalScanCode('KeyQ', 6)).toBe('L_0_1');
      expect(getCoordForPhysicalScanCode('Tab', 6)).toBe('L_0_0');
    });

    it('Colemak: pressing F matches ONLY the Colemak position [L_0_2] and never duplicates to QWERTY [L_1_3]', () => {
      // User types 'f' (KeyboardEvent: key='f', code='KeyF')
      const matches = getMatchingKeyCoords({ key: 'f', code: 'KeyF' }, colemakLayout);
      expect(matches).toEqual(['L_0_2']);
      expect(matches).not.toContain('L_1_3');
    });

    it('Colemak: pressing P matches ONLY the Colemak position [L_0_3] and never duplicates to QWERTY [R_0_4]', () => {
      // User types 'p' (KeyboardEvent: key='p', code='KeyP')
      const matches = getMatchingKeyCoords({ key: 'p', code: 'KeyP' }, colemakLayout);
      expect(matches).toEqual(['L_0_3']);
      expect(matches).not.toContain('R_0_4');
    });

    it('Colemak: pressing B matches ONLY the right-hand position [R_2_1] and never duplicates to QWERTY [L_2_4]', () => {
      // User types 'b' (KeyboardEvent: key='b', code='KeyB')
      const matches = getMatchingKeyCoords({ key: 'b', code: 'KeyB' }, colemakLayout);
      expect(matches).toEqual(['R_2_1']);
      expect(matches).not.toContain('L_2_4');
    });

    it('Colemak: pressing Space matches the left thumb [LT_1]', () => {
      const matches = getMatchingKeyCoords({ key: ' ', code: 'Space' }, colemakLayout);
      expect(matches).toEqual(['LT_1']);
    });

    it('Colemak: pressing Enter matches the left thumb [LT_2]', () => {
      const matches = getMatchingKeyCoords({ key: 'Enter', code: 'Enter' }, colemakLayout);
      expect(matches).toEqual(['LT_2']);
    });

    it('Colemak: pressing Backspace matches the right thumb [RT_0]', () => {
      const matches = getMatchingKeyCoords({ key: 'Backspace', code: 'Backspace' }, colemakLayout);
      expect(matches).toEqual(['RT_0']);
    });

    it('Colemak: pressing Comma matches [L_2_4] and Period matches [R_2_0]', () => {
      expect(getMatchingKeyCoords({ key: ',', code: 'Comma' }, colemakLayout)).toEqual(['L_2_4']);
      expect(getMatchingKeyCoords({ key: '.', code: 'Period' }, colemakLayout)).toEqual(['R_2_0']);
    });

    it('Colemak: pressing Quote matches [R_2_4]', () => {
      expect(getMatchingKeyCoords({ key: "'", code: 'Quote' }, colemakLayout)).toEqual(['R_2_4']);
    });

    it('Empty Layout: falls back to a single physical scan-code coordinate and never duplicates', () => {
      const emptyLayout = {
        columns: 5,
        rows: 3,
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
      };

      // When layout is blank, typing KeyF gives physical coordinate L_1_3
      const matches = getMatchingKeyCoords({ key: 'f', code: 'KeyF' }, emptyLayout);
      expect(matches).toEqual(['L_1_3']);
      expect(matches.length).toBe(1);
    });

    it('Key not on active layer returns empty array without triggering QWERTY fallback', () => {
      // Numpad layer with only numbers and arrows
      const numpadLayout = {
        columns: 5,
        rows: 3,
        leftMatrix: [
          ['1', '2', '3', '', ''],
          ['4', '5', '6', '', ''],
          ['7', '8', '9', '', ''],
        ],
        rightMatrix: [
          ['', '', '▲', '', ''],
          ['', '◀', '▼', '▶', ''],
          ['', '', '0', '', ''],
        ],
        leftThumbs: ['', '', ''],
        rightThumbs: ['', '', ''],
      };

      // Pressing 'z' on a numpad layer should NOT light up L_2_0
      const matches = getMatchingKeyCoords({ key: 'z', code: 'KeyZ' }, numpadLayout);
      expect(matches).toEqual([]);
    });
  });
});


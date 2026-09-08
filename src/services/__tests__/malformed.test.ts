import { parseCHeader } from '../cHeaderParser';
import { describe, it, expect } from 'vitest';

describe('cHeaderParser malformed', () => {
  it('should handle malformed comments gracefully', () => {
    const malformedHeader = `
    SYMBOL_SLICES[SYMBOL_COUNT] = {
    [SYMBOL_MALFORMED              ] = { .x =   0, .y =  0, .width = 16, .height = 16 }, // groupId= groupOrder=abc name=
    [SYMBOL_WEIRD_COMMENT          ] = { .x =   0, .y =  0, .width = 16, .height = 16 }, // something completely else
    [SYMBOL_PARTIAL                ] = { .x =   0, .y =  0, .width = 16, .height = 16 }, // groupId=MY_GROUP name=Hello
    };
    `;

    const parsed = parseCHeader(malformedHeader);
    console.log(JSON.stringify(parsed.symbolSlices, null, 2));

    expect(parsed.symbolSlices.length).toBe(3);
  });
});

import { describe, it, expect } from 'vitest';
import { parseJsonStringArray } from '../../src/lib/tool-utils.js';

describe('parseJsonStringArray', () => {
    it('parses valid JSON array string', () => {
        const result = parseJsonStringArray('["a","b"]', 'test');
        expect(result.ok).toBe(true);
        if (result.ok) expect(result.value).toEqual(['a', 'b']);
    });

    it('rejects non-string input', () => {
        const result = parseJsonStringArray(123, 'test');
        expect(result.ok).toBe(false);
    });

    it('rejects valid JSON that is not an array', () => {
        const result = parseJsonStringArray('{"key":"val"}', 'test');
        expect(result.ok).toBe(false);
    });

    it('rejects invalid JSON string', () => {
        const result = parseJsonStringArray('not-json', 'test');
        expect(result.ok).toBe(false);
    });

    it('accepts already-parsed array of strings', () => {
        const result = parseJsonStringArray(['a', 'b'], 'test');
        expect(result.ok).toBe(true);
        if (result.ok) expect(result.value).toEqual(['a', 'b']);
    });

    it('rejects already-parsed array with non-strings', () => {
        const result = parseJsonStringArray(['a', 123], 'test');
        expect(result.ok).toBe(false);
    });

    it('rejects non-array object input', () => {
        const result = parseJsonStringArray({}, 'test');
        expect(result.ok).toBe(false);
    });
});

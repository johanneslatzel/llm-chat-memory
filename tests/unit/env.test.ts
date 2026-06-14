import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { envFloat, envInt, envString } from '../../src/env.js';

const ENV_KEY = 'LLM_CHAT_MEMORY_TEST_VAR';

beforeEach(() => {
    delete process.env[ENV_KEY];
});

afterEach(() => {
    delete process.env[ENV_KEY];
});

describe('envInt', () => {

    it('returns fallback when env var is not set', () => {
        expect(envInt(ENV_KEY, 5)).toBe(5);
    });

    it('returns fallback when env var is empty', () => {
        process.env[ENV_KEY] = '';
        expect(envInt(ENV_KEY, 5)).toBe(5);
    });

    it('parses a valid integer from env var', () => {
        process.env[ENV_KEY] = '42';
        expect(envInt(ENV_KEY, 5)).toBe(42);
    });

    it('uses min when parsed value is below min', () => {
        process.env[ENV_KEY] = '0';
        expect(envInt(ENV_KEY, 5, 1)).toBe(1);
    });

    it('caps value at max when provided', () => {
        process.env[ENV_KEY] = '100';
        expect(envInt(ENV_KEY, 5, 1, 50)).toBe(50);
    });

    it('returns fallback when env var is NaN', () => {
        process.env[ENV_KEY] = 'not-a-number';
        expect(envInt(ENV_KEY, 5, 1)).toBe(5);
    });
});

describe('envFloat', () => {
    it('returns fallback when env var is not set', () => {
        expect(envFloat(ENV_KEY, 0.5)).toBe(0.5);
    });

    it('returns fallback when env var is empty', () => {
        process.env[ENV_KEY] = '';
        expect(envFloat(ENV_KEY, 0.5)).toBe(0.5);
    });

    it('parses a valid float from env var', () => {
        process.env[ENV_KEY] = '0.75';
        expect(envFloat(ENV_KEY, 0.5)).toBe(0.75);
    });

    it('uses min when parsed value is below min', () => {
        process.env[ENV_KEY] = '-0.1';
        expect(envFloat(ENV_KEY, 0.5, 0)).toBe(0);
    });

    it('caps value at max when provided', () => {
        process.env[ENV_KEY] = '2';
        expect(envFloat(ENV_KEY, 0.5, 0, 1)).toBe(1);
    });

    it('returns fallback when env var is NaN', () => {
        process.env[ENV_KEY] = 'not-a-number';
        expect(envFloat(ENV_KEY, 0.5)).toBe(0.5);
    });

    it('uses min when env var is NaN and min is provided', () => {
        process.env[ENV_KEY] = 'not-a-number';
        expect(envFloat(ENV_KEY, 0.5, 1)).toBe(1);
    });
});

describe('envString', () => {
    it('returns fallback when env var is not set', () => {
        expect(envString(ENV_KEY, 'default')).toBe('default');
    });

    it('returns value when env var is set', () => {
        process.env[ENV_KEY] = 'custom-value';
        expect(envString(ENV_KEY, 'default')).toBe('custom-value');
    });

    it('returns empty string when env var is set to empty', () => {
        process.env[ENV_KEY] = '';
        expect(envString(ENV_KEY, 'default')).toBe('');
    });
});

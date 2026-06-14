import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
    DEFAULT_MEMORY_DIR,
} from '../../src/lib/constants.js';
import { MemoryConfiguration } from '../../src/lib/config.js';

describe('MemoryConfiguration', () => {
    const OLD_ENV = process.env;

    beforeEach(() => {
        process.env = { ...OLD_ENV };
        delete process.env.LLM_CHAT_MEMORY_DIR;
        delete process.env.LLM_CHAT_MEMORY_MAX_INJECT_PER_MESSAGE;
    });

    afterEach(() => {
        process.env = OLD_ENV;
    });

    it('uses default values when no env vars or constructor args', () => {
        const config = new MemoryConfiguration();
        expect(config.memoryDir).toBe(DEFAULT_MEMORY_DIR);
        expect(config.maxInjectPerMessage).toBe(2);
    });

    it('reads from env vars', () => {
        process.env.LLM_CHAT_MEMORY_DIR = '/custom/path';
        process.env.LLM_CHAT_MEMORY_MAX_INJECT_PER_MESSAGE = '5';
        const config = new MemoryConfiguration();
        expect(config.memoryDir).toBe('/custom/path');
        expect(config.maxInjectPerMessage).toBe(5);
    });

    it('constructor args override env vars', () => {
        process.env.LLM_CHAT_MEMORY_DIR = '/env/path';
        process.env.LLM_CHAT_MEMORY_MAX_INJECT_PER_MESSAGE = '10';
        const config = new MemoryConfiguration('/override/path', 2, 5);
        expect(config.memoryDir).toBe('/override/path');
        expect(config.maxInjectPerMessage).toBe(2);
    });

    it('maxInjectPerMessage has min of 1', () => {
        process.env.LLM_CHAT_MEMORY_MAX_INJECT_PER_MESSAGE = '0';
        const config = new MemoryConfiguration();
        expect(config.maxInjectPerMessage).toBe(1);
    });
});

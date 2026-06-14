import { describe, it, expect } from 'vitest';
import { Memory } from '../../src/lib/memory/memory.js';

function mem(
    id: string,
    content: string,
    tags: string[] = [],
    score = 1,
    summary?: string,
    createdAt?: Date,
    changedAt?: Date,
    recalledAt?: Date | null
): Memory {
    const now = Date.now();
    return new Memory({
        id,
        content,
        summary: summary ?? `Summary for ${id}`,
        tags,
        score,
        embedding: null,
        cachedAt: null,
        createdAt: createdAt ? createdAt.getTime() : now,
        changedAt: changedAt ? changedAt.getTime() : now,
        recalledAt: recalledAt === undefined ? null : recalledAt?.getTime() ?? null
    });
}

describe('Memory', () => {
    it('creates a memory with default values', () => {
        const memory = mem('test-id', 'Hello world');
        expect(memory.id()).toBe('test-id');
        expect(memory.content()).toBe('Hello world');
        expect(memory.tags()).toEqual([]);
        expect(memory.score()).toBe(1);
        expect(memory.summary()).toBe('Summary for test-id');
        expect(memory.recalledAt()).toBeNull();
    });

    it('creates a memory with custom values', () => {
        const createdAt = new Date('2024-01-01');
        const changedAt = new Date('2024-01-02');
        const recalledAt = new Date('2024-01-03');
        const memory = mem('test-id', 'Content', ['tag1', 'tag2'], 5, 'Custom summary', createdAt, changedAt, recalledAt);
        expect(memory.tags()).toEqual(['tag1', 'tag2']);
        expect(memory.score()).toBe(5);
        expect(memory.summary()).toBe('Custom summary');
        expect(memory.createdAt().getTime()).toBe(createdAt.getTime());
        expect(memory.changedAt().getTime()).toBe(changedAt.getTime());
        expect(memory.recalledAt()!.getTime()).toBe(recalledAt.getTime());
    });

    it('toJSON returns correct shape', () => {
        const memory = mem('json-id', 'JSON content', ['a'], 3, 'My summary');
        const json = memory.toJSON();
        expect(json.id).toBe('json-id');
        expect(json.content).toBe('JSON content');
        expect(json.summary).toBe('My summary');
        expect(json.tags).toEqual(['a']);
        expect(json.score).toBe(3);
        expect(json.recalledAt).toBeNull();
        expect(typeof json.createdAt).toBe('number');
        expect(typeof json.changedAt).toBe('number');
        expect(json.embedding).toBeNull();
        expect(json.cachedAt).toBeNull();
    });

    it('can set recalledAt to null', () => {
        const memory = mem('id', 'content');
        memory.recalledAt(new Date());
        expect(memory.recalledAt()).not.toBeNull();
        memory.recalledAt(null);
        expect(memory.recalledAt()).toBeNull();
    });

    it('can update summary', () => {
        const memory = mem('id', 'content');
        memory.summary('Updated summary');
        expect(memory.summary()).toBe('Updated summary');
    });

    it('can set and get embedding', () => {
        const memory = mem('id', 'content');
        expect(memory.embedding()).toBeNull();
        memory.embedding([0.1, 0.2, 0.3]);
        expect(memory.embedding()).toEqual([0.1, 0.2, 0.3]);
    });

    it('can set and get cachedAt', () => {
        const memory = mem('id', 'content');
        expect(memory.cachedAt()).toBeNull();
        const d = new Date();
        memory.cachedAt(d);
        expect(memory.cachedAt()!.getTime()).toBe(d.getTime());
    });

    it('handles embedding: undefined in constructor', () => {
        const now = Date.now();
        const memory = new Memory({
            id: 'test',
            content: 'content',
            summary: 'summary',
            tags: [],
            score: 1,
            createdAt: now,
            changedAt: now,
            recalledAt: null
        });
        expect(memory.embedding()).toBeNull();
    });

    it('handles cachedAt: undefined in constructor', () => {
        const now = Date.now();
        const memory = new Memory({
            id: 'test',
            content: 'content',
            summary: 'summary',
            tags: [],
            score: 1,
            createdAt: now,
            changedAt: now,
            recalledAt: null
        });
        expect(memory.cachedAt()).toBeNull();
    });

    it('setting embedding to null stores null', () => {
        const memory = mem('id', 'content');
        memory.embedding([0.1, 0.2]);
        expect(memory.embedding()).toEqual([0.1, 0.2]);
        memory.embedding(null);
        expect(memory.embedding()).toBeNull();
    });

    it('constructor handles embedding as an array', () => {
        const now = Date.now();
        const memory = new Memory({
            id: 'test',
            content: 'content',
            summary: 'summary',
            tags: [],
            score: 1,
            embedding: [0.1, 0.2, 0.3],
            createdAt: now,
            changedAt: now,
            recalledAt: null,
        });
        expect(memory.embedding()).toEqual([0.1, 0.2, 0.3]);
    });
});

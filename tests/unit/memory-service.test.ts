import { randomUUID } from 'node:crypto';
import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import { describe, it, expect, vi } from 'vitest';
import { ChatMessageOrigin, ChatRole, ChatService } from '@johannes.latzel/llm-chat';
import type { ChatMessage } from '@johannes.latzel/llm-chat';
import { MemoryService } from '../../src/lib/memory-service.js';
import { MemoryConfiguration } from '../../src/lib/config.js';
import { testConfig } from '../helper/config.js';
import { withTempDir } from '../helper/temp-fs.js';
import { MockEmbedder } from '../helper/mock-embedder.js';

function userMsg(content: string): ChatMessage {
    return { role: ChatRole.User, content, createdAt: new Date(), origin: ChatMessageOrigin.User };
}

function reasoningMsg(content: string): ChatMessage {
    return { role: ChatRole.Reasoning, content, createdAt: new Date(), origin: ChatMessageOrigin.Model };
}

function reasoningHookMsg(content: string): ChatMessage {
    return { role: ChatRole.Reasoning, content, createdAt: new Date(), origin: ChatMessageOrigin.Hook };
}

function assistantMsg(content: string): ChatMessage {
    return { role: ChatRole.Assistant, content, createdAt: new Date(), origin: ChatMessageOrigin.Model };
}

function hookMsg(content: string): ChatMessage {
    return { role: ChatRole.User, content, createdAt: new Date(), origin: ChatMessageOrigin.Hook };
}

function toolMsg(content: string): ChatMessage {
    return { role: ChatRole.Assistant, content, createdAt: new Date(), origin: ChatMessageOrigin.Tool };
}

function makeMockService(messages: ChatMessage[]) {
    const mockBeforeSendDo = vi.fn();
    const mockAfterSendDo = vi.fn();

    const mockChat = {
        messages: vi.fn().mockReturnValue(messages),
        assistant: vi.fn().mockResolvedValue(undefined),
        sessionId: vi.fn().mockReturnValue('test-session')
    };

    const mockQueue = {
        assistant: vi.fn().mockResolvedValue(undefined),
        tool: vi.fn().mockResolvedValue(undefined)
    };

    const mockService = {
        chat: vi.fn().mockReturnValue(mockChat),
        queue: vi.fn().mockReturnValue(mockQueue),
        hook: vi.fn().mockReturnValue({
            beforeSendLoop: vi.fn().mockReturnValue({ do: mockBeforeSendDo }),
            afterSend: vi.fn().mockReturnValue({ do: mockAfterSendDo })
        }),
        setNeedsResend: vi.fn(),
        injectToolCall: vi.fn().mockResolvedValue(undefined)
    };

    return { mockService, mockChat, mockQueue, mockBeforeSendDo, mockAfterSendDo };
}

describe('MemoryService', () => {
    it('memories and links return underlying pools', async () => {
        const service = new MemoryService(new MemoryConfiguration(), new MockEmbedder());
        expect(service.memories()).toBeDefined();
        expect(service.links()).toBeDefined();
        expect(service.memories()).not.toBe(service.links());
    });

    it('getEmbedder returns the configured embedder', () => {
        const embedder = new MockEmbedder();
        const service = new MemoryService(new MemoryConfiguration(), embedder);
        expect(service.getEmbedder()).toBe(embedder);
    });

    it('init loads empty pool without error', async () => {
        await withTempDir(async (dir) => {
            const config = testConfig(dir);
            const service = new MemoryService(config, new MockEmbedder());
            await fsp.writeFile(path.join(dir, 'links.json'), '[]', 'utf-8');
            await service.init();
            expect(await service.memories().all()).toEqual([]);
        });
    });

    it('init is idempotent (second call is no-op)', async () => {
        await withTempDir(async (dir) => {
            const config = testConfig(dir);
            const service = new MemoryService(config, new MockEmbedder());
            await fsp.writeFile(path.join(dir, 'links.json'), '[]', 'utf-8');
            await service.init();
            await service.init();
            expect(await service.memories().all()).toEqual([]);
        });
    });

    describe('recall', () => {
        it('returns results via embedder', async () => {
            await withTempDir(async (dir) => {
                const config = testConfig(dir);
                const service = new MemoryService(config, new MockEmbedder());
                const pool = service.memories();
                await pool.create('a', { content: 'A', summary: 'A sum' });
                await pool.create('b', { content: 'B', summary: 'B sum' });

                const results = await service.recall('hello', 5);
                expect(results).toHaveLength(2);
            });
        });

        it('handles missing memory gracefully when pool.get returns undefined', async () => {
            await withTempDir(async (dir) => {
                const config = testConfig(dir);
                const service = new MemoryService(config, new MockEmbedder());
                const pool = service.memories();
                await pool.create('a', { content: 'A', summary: 'A sum' });

                const getSpy = vi.spyOn(pool, 'get');
                getSpy.mockResolvedValue(undefined);

                const results = await service.recall('hello', 5);
                expect(results).toEqual([]);
                getSpy.mockRestore();
            });
        });
    });

    describe('score', () => {
        it('computes PageRank from link edges', async () => {
            await withTempDir(async (dir) => {
                const config = testConfig(dir);
                const service = new MemoryService(config, new MockEmbedder());
                await fsp.writeFile(path.join(dir, 'links.json'), '[]', 'utf-8');
                await service.init();
                const pool = service.memories();
                const linkPool = service.links();
                await pool.create('a', { content: 'A', summary: 'A sum', tags: ['test'] });
                await pool.create('b', { content: 'B', summary: 'B sum', tags: ['test'] });
                await pool.create('c', { content: 'C', summary: 'C sum', tags: ['test'] });

                await linkPool.link('a', 'b');
                await linkPool.link('b', 'c');

                await service.score();

                const a = (await pool.get('a'))!;
                const b = (await pool.get('b'))!;
                const c = (await pool.get('c'))!;

                expect(c.score()).toBeGreaterThan(b.score());
                expect(b.score()).toBeGreaterThan(a.score());
            });
        });

        it('handles empty link graph', async () => {
            await withTempDir(async (dir) => {
                const config = testConfig(dir);
                const service = new MemoryService(config, new MockEmbedder());
                await fsp.writeFile(path.join(dir, 'links.json'), '[]', 'utf-8');
                await service.init();
                const pool = service.memories();
                await pool.create('a', { content: 'A', summary: 'A sum', tags: ['test'] });

                await service.score();

                const a = (await pool.get('a'))!;
                expect(a.score()).toBeDefined();
            });
        });

        it('skips orphaned rank entries', async () => {
            await withTempDir(async (dir) => {
                const config = testConfig(dir);
                const service = new MemoryService(config, new MockEmbedder());
                await fsp.writeFile(path.join(dir, 'links.json'), '[]', 'utf-8');
                await service.init();
                const pool = service.memories();
                const linkPool = service.links();
                await pool.create('a', { content: 'A', summary: 'A sum', tags: ['test'] });
                await pool.create('b', { content: 'B', summary: 'B sum', tags: ['test'] });
                await linkPool.link('a', 'b');
                await pool.delete('b');
                await linkPool.link('a', 'b');

                await expect(service.score()).resolves.toBeUndefined();
                expect((await pool.get('a'))?.score()).toBeDefined();
            });
        });
    });

    describe('hookInto', () => {
        it('registers beforeSendLoop and afterSend service hooks', () => {
            withTempDir(async (dir) => {
                const config = testConfig(dir);
                const service = new MemoryService(config, new MockEmbedder());

                const { mockService } = makeMockService([]);
                service.hookInto(mockService as unknown as ChatService);

                expect(mockService.hook().beforeSendLoop().do).toHaveBeenCalled();
                expect(mockService.hook().afterSend().do).toHaveBeenCalled();
            });
        });

        describe('beforeSendLoop hook', () => {
            it('calls injectToolCall for matching user message without calling setNeedsResend', async () => {
                await withTempDir(async (dir) => {
                    const config = testConfig(dir);
                    const service = new MemoryService(config, new MockEmbedder());

                    await service.memories().create('match-id', {
                        content: 'The user likes cats',
                        summary: 'User likes cats'
                    });

                    const { mockService, mockBeforeSendDo } = makeMockService([
                        userMsg('I love my cat')
                    ]);

                    service.hookInto(mockService as unknown as ChatService);

                    const callback = mockBeforeSendDo.mock.calls[0]![0] as () => Promise<void>;
                    await callback();

                    expect(mockService.injectToolCall).toHaveBeenCalledTimes(1);
                    expect(mockService.injectToolCall).toHaveBeenCalledWith('get_memory', { ids: ['match-id'], summary: true });
                    expect(mockService.setNeedsResend).not.toHaveBeenCalled();
                });
            });

            it('does not inject when no memories exist', async () => {
                await withTempDir(async (dir) => {
                    const config = testConfig(dir);
                    const service = new MemoryService(config, new MockEmbedder());

                    const { mockService, mockBeforeSendDo } = makeMockService([
                        userMsg('I like birds')
                    ]);

                    service.hookInto(mockService as unknown as ChatService);

                    const callback = mockBeforeSendDo.mock.calls[0]![0] as () => Promise<void>;
                    await callback();

                    expect(mockService.injectToolCall).not.toHaveBeenCalled();
                    expect(mockService.setNeedsResend).not.toHaveBeenCalled();
                });
            });

            it('processes Hook origin messages like any other user message', async () => {
                await withTempDir(async (dir) => {
                    const config = testConfig(dir);
                    const service = new MemoryService(config, new MockEmbedder());

                    await service.memories().create('match-id', {
                        content: 'Secret info',
                        summary: 'Secret info'
                    });

                    const { mockService, mockBeforeSendDo } = makeMockService([
                        hookMsg('this is a secret')
                    ]);

                    service.hookInto(mockService as unknown as ChatService);

                    const callback = mockBeforeSendDo.mock.calls[0]![0] as () => Promise<void>;
                    await callback();

                    expect(mockService.injectToolCall).toHaveBeenCalledTimes(1);
                    expect(mockService.injectToolCall).toHaveBeenCalledWith('get_memory', { ids: ['match-id'], summary: true });
                });
            });

            it('skips non-User messages in beforeSendLoop', async () => {
                await withTempDir(async (dir) => {
                    const config = testConfig(dir);
                    const service = new MemoryService(config, new MockEmbedder());

                    await service.memories().create('mem', {
                        content: 'Should not inject',
                        summary: 'Test'
                    });

                    const { mockService, mockBeforeSendDo } = makeMockService([
                        assistantMsg('trigger word')
                    ]);

                    service.hookInto(mockService as unknown as ChatService);

                    const callback = mockBeforeSendDo.mock.calls[0]![0] as () => Promise<void>;
                    await callback();

                    expect(mockService.injectToolCall).not.toHaveBeenCalled();
                });
            });

            it('processes multiple user messages with separate injectToolCall invocations', async () => {
                await withTempDir(async (dir) => {
                    const config = testConfig(dir);
                    const service = new MemoryService(config, new MockEmbedder());

                    await service.memories().create('cat-mem', {
                        content: 'Loves cats',
                        summary: 'Cats'
                    });
                    await service.memories().create('dog-mem', {
                        content: 'Loves dogs',
                        summary: 'Dogs'
                    });

                    const { mockService, mockBeforeSendDo } = makeMockService([
                        userMsg('I like cats'),
                        userMsg('and dogs too')
                    ]);

                    service.hookInto(mockService as unknown as ChatService);

                    const callback = mockBeforeSendDo.mock.calls[0]![0] as () => Promise<void>;
                    await callback();

                    // Each message triggers recall, but with MockEmbedder all memories match
                    // First message gets both, second message gets filtered (session dedup)
                    expect(mockService.injectToolCall).toHaveBeenCalledTimes(1);
                    expect(mockService.injectToolCall).toHaveBeenCalledWith('get_memory', { ids: ['cat-mem', 'dog-mem'], summary: true });
                });
            });

            it('only processes new messages on subsequent calls', async () => {
                await withTempDir(async (dir) => {
                    const config = testConfig(dir);
                    const service = new MemoryService(config, new MockEmbedder());

                    await service.memories().create('mem', {
                        content: 'Important',
                        summary: 'Important'
                    });

                    const messages: ChatMessage[] = [userMsg('first message')];
                    const mockBeforeSendDo = vi.fn();
                    const mockAfterSendDo = vi.fn();
                    const mockQueue = {
                        assistant: vi.fn().mockResolvedValue(undefined),
                        tool: vi.fn().mockResolvedValue(undefined)
                    };
                    const mockChat = {
                        messages: vi.fn().mockImplementation(() => messages),
                        assistant: vi.fn().mockResolvedValue(undefined),
                        sessionId: vi.fn().mockReturnValue('test-session')
                    };
                    const mockService = {
                        chat: vi.fn().mockReturnValue(mockChat),
                        queue: vi.fn().mockReturnValue(mockQueue),
                        hook: vi.fn().mockReturnValue({
                            beforeSendLoop: vi.fn().mockReturnValue({ do: mockBeforeSendDo }),
                            afterSend: vi.fn().mockReturnValue({ do: mockAfterSendDo })
                        }),
                        setNeedsResend: vi.fn(),
                        injectToolCall: vi.fn().mockResolvedValue(undefined)
                    };

                    service.hookInto(mockService as unknown as ChatService);
                    const callback = mockBeforeSendDo.mock.calls[0]![0] as () => Promise<void>;

                    await callback();
                    // MockEmbedder matches everything, so the first call injects 'mem'
                    expect(mockService.injectToolCall).toHaveBeenCalledTimes(1);
                    expect(mockService.injectToolCall).toHaveBeenCalledWith('get_memory', { ids: ['mem'], summary: true });

                    messages.push(userMsg('trigger word'));
                    await callback();
                    // 'mem' already injected, dedup prevents re-injection
                    expect(mockService.injectToolCall).toHaveBeenCalledTimes(1);
                });
            });
        });

        describe('afterSend hook', () => {
            it('calls injectToolCall on matching reasoning message and calls setNeedsResend', async () => {
                await withTempDir(async (dir) => {
                    const config = testConfig(dir);
                    const service = new MemoryService(config, new MockEmbedder());

                    await service.memories().create('match-id', {
                        content: 'The user likes cats',
                        summary: 'User likes cats'
                    });

                    const { mockService, mockAfterSendDo } = makeMockService([
                        reasoningMsg('I think the user has a cat')
                    ]);

                    service.hookInto(mockService as unknown as ChatService);

                    const callback = mockAfterSendDo.mock.calls[0]![0] as () => Promise<void>;
                    await callback();

                    expect(mockService.injectToolCall).toHaveBeenCalledTimes(1);
                    expect(mockService.injectToolCall).toHaveBeenCalledWith('get_memory', { ids: ['match-id'], summary: true });
                    expect(mockService.setNeedsResend).toHaveBeenCalledTimes(1);
                });
            });

            it('skips non-Reasoning messages in afterSend', async () => {
                await withTempDir(async (dir) => {
                    const config = testConfig(dir);
                    const service = new MemoryService(config, new MockEmbedder());

                    await service.memories().create('mem', {
                        content: 'Should not inject',
                        summary: 'Test'
                    });

                    const { mockService, mockAfterSendDo } = makeMockService([
                        userMsg('trigger word')
                    ]);

                    service.hookInto(mockService as unknown as ChatService);

                    const callback = mockAfterSendDo.mock.calls[0]![0] as () => Promise<void>;
                    await callback();

                    expect(mockService.injectToolCall).not.toHaveBeenCalled();
                });
            });

            it('does not inject on non-Model origin', async () => {
                await withTempDir(async (dir) => {
                    const config = testConfig(dir);
                    const service = new MemoryService(config, new MockEmbedder());

                    await service.memories().create('match-id', {
                        content: 'Secret',
                        summary: 'Secret'
                    });

                    const { mockService, mockAfterSendDo } = makeMockService([
                        toolMsg('the secret is out')
                    ]);

                    service.hookInto(mockService as unknown as ChatService);

                    const callback = mockAfterSendDo.mock.calls[0]![0] as () => Promise<void>;
                    await callback();

                    expect(mockService.injectToolCall).not.toHaveBeenCalled();
                    expect(mockService.setNeedsResend).not.toHaveBeenCalled();
                });
            });

            it('skips Reasoning messages with non-Model origin', async () => {
                await withTempDir(async (dir) => {
                    const config = testConfig(dir);
                    const service = new MemoryService(config, new MockEmbedder());

                    await service.memories().create('match-id', {
                        content: 'Secret',
                        summary: 'Secret'
                    });

                    const { mockService, mockAfterSendDo } = makeMockService([
                        reasoningHookMsg('the secret is out')
                    ]);

                    service.hookInto(mockService as unknown as ChatService);

                    const callback = mockAfterSendDo.mock.calls[0]![0] as () => Promise<void>;
                    await callback();

                    expect(mockService.injectToolCall).not.toHaveBeenCalled();
                    expect(mockService.setNeedsResend).not.toHaveBeenCalled();
                });
            });

            it('afterSend inner loop breaks when toInject reaches remainingPerSendLoop', async () => {
                await withTempDir(async (dir) => {
                    const config = testConfig(dir, 3, 2);
                    const service = new MemoryService(config, new MockEmbedder());

                    await service.memories().create('mem-a', {
                        content: 'Alpha',
                        summary: 'Alpha'
                    });
                    await service.memories().create('mem-b', {
                        content: 'Beta',
                        summary: 'Beta'
                    });
                    await service.memories().create('mem-c', {
                        content: 'Gamma',
                        summary: 'Gamma'
                    });

                    const { mockService, mockAfterSendDo } = makeMockService([
                        reasoningMsg('trigger word')
                    ]);

                    service.hookInto(mockService as unknown as ChatService);

                    const callback = mockAfterSendDo.mock.calls[0]![0] as () => Promise<void>;
                    await callback();

                    // remainingPerSendLoop=2, 3 matching memories → batch limited to 2
                    expect(mockService.injectToolCall).toHaveBeenCalledTimes(1);
                    expect(mockService.injectToolCall).toHaveBeenCalledWith('get_memory', { ids: ['mem-a', 'mem-b'], summary: true });
                    expect(mockService.setNeedsResend).toHaveBeenCalledTimes(1);
                });
            });

            it('set prevents afterSend from re-injecting memories already handled by beforeSendLoop', async () => {
                await withTempDir(async (dir) => {
                    const config = testConfig(dir);
                    const service = new MemoryService(config, new MockEmbedder());

                    await service.memories().create('mem', {
                        content: 'Important',
                        summary: 'Important'
                    });

                    const messages: ChatMessage[] = [
                        userMsg('this is important')
                    ];
                    const { mockService, mockBeforeSendDo, mockAfterSendDo } = makeMockService(messages);

                    service.hookInto(mockService as unknown as ChatService);
                    const beforeCb = mockBeforeSendDo.mock.calls[0]![0] as () => Promise<void>;
                    const afterCb = mockAfterSendDo.mock.calls[0]![0] as () => Promise<void>;

                    await beforeCb();
                    expect(mockService.injectToolCall).toHaveBeenCalledTimes(1);

                    messages.push(reasoningMsg('this is also important'));

                    await afterCb();
                    expect(mockService.injectToolCall).toHaveBeenCalledTimes(1);
                    expect(mockService.setNeedsResend).not.toHaveBeenCalled();
                });
            });

            it('afterSend injects only new memories not already in the injected set', async () => {
                await withTempDir(async (dir) => {
                    const config = testConfig(dir);
                    const service = new MemoryService(config, new MockEmbedder());

                    await service.memories().create('mem-a', {
                        content: 'Alpha',
                        summary: 'Alpha'
                    });
                    await service.memories().create('mem-b', {
                        content: 'Beta',
                        summary: 'Beta'
                    });

                    const messages: ChatMessage[] = [
                        userMsg('alpha trigger')
                    ];
                    const { mockService, mockBeforeSendDo, mockAfterSendDo } = makeMockService(messages);

                    service.hookInto(mockService as unknown as ChatService);
                    const beforeCb = mockBeforeSendDo.mock.calls[0]![0] as () => Promise<void>;
                    const afterCb = mockAfterSendDo.mock.calls[0]![0] as () => Promise<void>;

                    await beforeCb();
                    expect(mockService.injectToolCall).toHaveBeenCalledTimes(1);
                    expect(mockService.injectToolCall).toHaveBeenCalledWith('get_memory', { ids: ['mem-a', 'mem-b'], summary: true });

                    messages.push(reasoningMsg('alpha and beta trigger'));

                    await afterCb();
                    // Both already injected by beforeSendLoop, nothing new to inject
                    expect(mockService.injectToolCall).toHaveBeenCalledTimes(1);
                    expect(mockService.setNeedsResend).not.toHaveBeenCalled();
                });
            });
        });

        describe('shared counter between hooks', () => {
            it('beforeSendLoop breaks when remainingPerSendLoop is exhausted', async () => {
                await withTempDir(async (dir) => {
                    const config = testConfig(dir, 1, 1);
                    const service = new MemoryService(config, new MockEmbedder());

                    await service.memories().create('mem', {
                        content: 'Important',
                        summary: 'Important'
                    });

                    const messages: ChatMessage[] = [
                        userMsg('first'),
                        userMsg('second')
                    ];
                    const { mockService, mockBeforeSendDo } = makeMockService(messages);

                    service.hookInto(mockService as unknown as ChatService);
                    const callback = mockBeforeSendDo.mock.calls[0]![0] as () => Promise<void>;
                    await callback();

                    expect(mockService.injectToolCall).toHaveBeenCalledTimes(1);
                });
            });

            it('afterSend continues when recall returns no results', async () => {
                await withTempDir(async (dir) => {
                    const config = testConfig(dir);
                    const service = new MemoryService(config, new MockEmbedder());

                    const { mockService, mockAfterSendDo } = makeMockService([
                        reasoningMsg('test')
                    ]);

                    service.hookInto(mockService as unknown as ChatService);
                    const callback = mockAfterSendDo.mock.calls[0]![0] as () => Promise<void>;
                    await callback();

                    expect(mockService.injectToolCall).not.toHaveBeenCalled();
                    expect(mockService.setNeedsResend).not.toHaveBeenCalled();
                });
            });

            it('afterSend breaks when remainingPerSendLoop is exhausted by beforeSendLoop', async () => {
                await withTempDir(async (dir) => {
                    const config = testConfig(dir, 1, 1);
                    const service = new MemoryService(config, new MockEmbedder());

                    await service.memories().create('mem', {
                        content: 'Important',
                        summary: 'Important'
                    });

                    const messages: ChatMessage[] = [
                        userMsg('first')
                    ];
                    const { mockService, mockBeforeSendDo, mockAfterSendDo } = makeMockService(messages);

                    service.hookInto(mockService as unknown as ChatService);
                    const beforeCb = mockBeforeSendDo.mock.calls[0]![0] as () => Promise<void>;
                    const afterCb = mockAfterSendDo.mock.calls[0]![0] as () => Promise<void>;

                    await beforeCb();

                    messages.push(reasoningMsg('still thinking'));
                    await afterCb();

                    // afterSend hits the break because remainingPerSendLoop is 0
                    expect(mockService.injectToolCall).toHaveBeenCalledTimes(1);
                    expect(mockService.setNeedsResend).not.toHaveBeenCalled();
                });
            });

            it('beforeSendLoop advances counter and afterSend only processes remaining messages', async () => {
                await withTempDir(async (dir) => {
                    const config = testConfig(dir);
                    const service = new MemoryService(config, new MockEmbedder());

                    await service.memories().create('mem', {
                        content: 'Important',
                        summary: 'Important'
                    });

                    const messages: ChatMessage[] = [];
                    const mockBeforeSendDo = vi.fn();
                    const mockAfterSendDo = vi.fn();
                    const mockQueue = {
                        assistant: vi.fn().mockResolvedValue(undefined),
                        tool: vi.fn().mockResolvedValue(undefined)
                    };
                    const mockChat = {
                        messages: vi.fn().mockImplementation(() => messages),
                        assistant: vi.fn().mockResolvedValue(undefined),
                        sessionId: vi.fn().mockReturnValue('test-session')
                    };
                    const mockService = {
                        chat: vi.fn().mockReturnValue(mockChat),
                        queue: vi.fn().mockReturnValue(mockQueue),
                        hook: vi.fn().mockReturnValue({
                            beforeSendLoop: vi.fn().mockReturnValue({ do: mockBeforeSendDo }),
                            afterSend: vi.fn().mockReturnValue({ do: mockAfterSendDo })
                        }),
                        setNeedsResend: vi.fn(),
                        injectToolCall: vi.fn().mockResolvedValue(undefined)
                    };

                    service.hookInto(mockService as unknown as ChatService);
                    const beforeCb = mockBeforeSendDo.mock.calls[0]![0] as () => Promise<void>;
                    const afterCb = mockAfterSendDo.mock.calls[0]![0] as () => Promise<void>;

                    messages.push(userMsg('hello world'));
                    await beforeCb();
                    expect(mockService.injectToolCall).toHaveBeenCalledTimes(1);

                    messages.push(reasoningMsg('this is important'));
                    await afterCb();
                    expect(mockService.injectToolCall).toHaveBeenCalledTimes(1);
                    expect(mockService.setNeedsResend).not.toHaveBeenCalled();
                });
            });
        });

        it('dispose calls dispose on the Hook objects returned by do()', async () => {
            await withTempDir(async (dir) => {
                const config = testConfig(dir);
                const service = new MemoryService(config, new MockEmbedder());

                const beforeDispose = vi.fn();
                const afterDispose = vi.fn();
                const mockBeforeSendDo = vi.fn().mockReturnValue({ dispose: beforeDispose });
                const mockAfterSendDo = vi.fn().mockReturnValue({ dispose: afterDispose });
                const mockService = {
                    chat: vi.fn().mockReturnValue({
                        messages: vi.fn().mockReturnValue([]),
                        assistant: vi.fn().mockResolvedValue(undefined),
                        sessionId: vi.fn().mockReturnValue('test-session')
                    }),
                    queue: vi.fn().mockReturnValue({
                        assistant: vi.fn().mockResolvedValue(undefined),
                        tool: vi.fn().mockResolvedValue(undefined)
                    }),
                    hook: vi.fn().mockReturnValue({
                        beforeSendLoop: vi.fn().mockReturnValue({ do: mockBeforeSendDo }),
                        afterSend: vi.fn().mockReturnValue({ do: mockAfterSendDo })
                    }),
                    setNeedsResend: vi.fn(),
                    injectToolCall: vi.fn().mockResolvedValue(undefined)
                };

                const session = service.hookInto(mockService as unknown as ChatService);

                session.dispose();

                expect(beforeDispose).toHaveBeenCalledTimes(1);
                expect(afterDispose).toHaveBeenCalledTimes(1);
            });
        });

        it('dispose is safe to call multiple times', async () => {
            await withTempDir(async (dir) => {
                const config = testConfig(dir);
                const service = new MemoryService(config, new MockEmbedder());

                const beforeDispose = vi.fn();
                const afterDispose = vi.fn();
                const mockBeforeSendDo = vi.fn().mockReturnValue({ dispose: beforeDispose });
                const mockAfterSendDo = vi.fn().mockReturnValue({ dispose: afterDispose });
                const mockService = {
                    chat: vi.fn().mockReturnValue({
                        messages: vi.fn().mockReturnValue([]),
                        assistant: vi.fn().mockResolvedValue(undefined),
                        sessionId: vi.fn().mockReturnValue('test-session')
                    }),
                    queue: vi.fn().mockReturnValue({
                        assistant: vi.fn().mockResolvedValue(undefined),
                        tool: vi.fn().mockResolvedValue(undefined)
                    }),
                    hook: vi.fn().mockReturnValue({
                        beforeSendLoop: vi.fn().mockReturnValue({ do: mockBeforeSendDo }),
                        afterSend: vi.fn().mockReturnValue({ do: mockAfterSendDo })
                    }),
                    setNeedsResend: vi.fn(),
                    injectToolCall: vi.fn().mockResolvedValue(undefined)
                };

                const session = service.hookInto(mockService as unknown as ChatService);

                session.dispose();
                session.dispose();

                expect(beforeDispose).toHaveBeenCalledTimes(1);
                expect(afterDispose).toHaveBeenCalledTimes(1);
            });
        });

        it('setHooks throws when called twice', async () => {
            await withTempDir(async (dir) => {
                const config = testConfig(dir);
                const service = new MemoryService(config, new MockEmbedder());

                const mockDo = vi.fn().mockReturnValue({ dispose: vi.fn() });
                const mockService = {
                    chat: vi.fn().mockReturnValue({
                        messages: vi.fn().mockReturnValue([]),
                        assistant: vi.fn().mockResolvedValue(undefined),
                        sessionId: vi.fn().mockReturnValue('test-session')
                    }),
                    queue: vi.fn().mockReturnValue({
                        assistant: vi.fn().mockResolvedValue(undefined),
                        tool: vi.fn().mockResolvedValue(undefined)
                    }),
                    hook: vi.fn().mockReturnValue({
                        beforeSendLoop: vi.fn().mockReturnValue({ do: mockDo }),
                        afterSend: vi.fn().mockReturnValue({ do: mockDo })
                    }),
                    setNeedsResend: vi.fn(),
                    injectToolCall: vi.fn().mockResolvedValue(undefined)
                };

                const session = service.hookInto(mockService as unknown as ChatService);
                expect(() => (session as any).setHooks({ dispose: vi.fn() }, { dispose: vi.fn() })).toThrow('setHooks already called');
            });
        });

        it('multiple hookInto calls keep independent state per ChatService', async () => {
            await withTempDir(async (dir) => {
                const config = testConfig(dir);
                const service = new MemoryService(config, new MockEmbedder());

                await service.memories().create('mem', {
                    content: 'Shared fact',
                    summary: 'Shared fact'
                });

                const msgsA: ChatMessage[] = [userMsg('trigger word')];
                const msgsB: ChatMessage[] = [userMsg('trigger word')];

                const makeMock = (msgs: ChatMessage[]) => {
                    const bsd = vi.fn();
                    const asd = vi.fn();
                    return {
                        mock: {
                            chat: vi.fn().mockReturnValue({
                                messages: vi.fn().mockImplementation(() => msgs),
                                assistant: vi.fn().mockResolvedValue(undefined),
                                sessionId: vi.fn().mockReturnValue(randomUUID())
                            }),
                            queue: vi.fn().mockReturnValue({
                                assistant: vi.fn().mockResolvedValue(undefined),
                                tool: vi.fn().mockResolvedValue(undefined)
                            }),
                            hook: vi.fn().mockReturnValue({
                                beforeSendLoop: vi.fn().mockReturnValue({ do: bsd }),
                                afterSend: vi.fn().mockReturnValue({ do: asd })
                            }),
                            setNeedsResend: vi.fn(),
                            injectToolCall: vi.fn().mockResolvedValue(undefined)
                        },
                        beforeCb: () => bsd.mock.calls[0]![0] as () => Promise<void>,
                        afterCb: () => asd.mock.calls[0]![0] as () => Promise<void>,
                    };
                };

                const a = makeMock(msgsA);
                const b = makeMock(msgsB);

                service.hookInto(a.mock as unknown as ChatService);
                service.hookInto(b.mock as unknown as ChatService);

                await a.beforeCb()();
                await b.beforeCb()();

                expect(a.mock.injectToolCall).toHaveBeenCalledTimes(1);
                expect(b.mock.injectToolCall).toHaveBeenCalledTimes(1);
            });
        });
    });

    it('save persists links to disk', async () => {
        await withTempDir(async (dir) => {
            const config = testConfig(dir);
            const service = new MemoryService(config, new MockEmbedder());
            await fsp.writeFile(path.join(dir, 'links.json'), '[]', 'utf-8');
            await service.init();

            await service.links().link('a', 'b');
            await service.save();

            const content = await fsp.readFile(path.join(dir, 'links.json'), 'utf-8');
            const data = JSON.parse(content);
            expect(data).toHaveLength(1);
            expect(data[0]!.from).toBe('a');
            expect(data[0]!.to).toBe('b');
        });
    });

    it('linker returns the semantic linker instance', () => {
        const service = new MemoryService(new MemoryConfiguration(), new MockEmbedder());
        expect(service.linker).toBeDefined();
    });
});

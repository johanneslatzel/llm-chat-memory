import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import { tmpdir } from 'node:os';

export async function createTempDir(): Promise<string> {
    return fsp.mkdtemp(path.join(tmpdir(), 'llm-chat-memory-'));
}

export async function removeTempDir(dir: string): Promise<void> {
    await fsp.rm(dir, { recursive: true, force: true });
}

export async function withTempDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
    const dir = await createTempDir();
    try {
        return await fn(dir);
    } finally {
        await removeTempDir(dir);
    }
}



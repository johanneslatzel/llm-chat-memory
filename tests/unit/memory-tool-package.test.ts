import { describe, it, expect } from 'vitest';
import { MemoryToolPackage } from '../../src/tools/memory-tool-package.js';
import { MemoryService } from '../../src/lib/memory-service.js';
import { testConfig } from '../helper/config.js';
import { withTempDir } from '../helper/temp-fs.js';
import { MockEmbedder } from '../helper/mock-embedder.js';

describe('MemoryToolPackage', () => {
    it('creates package with seven tools', async () => {
        await withTempDir(async (dir) => {
            const config = testConfig(dir);
            const service = new MemoryService(config, new MockEmbedder());
            const pkg = new MemoryToolPackage(service);
            const tools = pkg.tools();
            expect(tools).toHaveLength(7);
        });
    });

    it('tutorial method returns the guide', async () => {
        await withTempDir(async (dir) => {
            const config = testConfig(dir);
            const service = new MemoryService(config, new MockEmbedder());
            const pkg = new MemoryToolPackage(service);
            expect(pkg.tutorial()?.length).toBeGreaterThan(50);
        });
    });
});

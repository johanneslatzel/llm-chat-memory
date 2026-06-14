import { MemoryConfiguration } from '../../src/lib/config.js';

/**
 * Creates a MemoryConfiguration suitable for test environments.
 * Relaxes summary length validation so tests don't need 50+ char summaries
 * or worry about the summary-to-content ratio.
 */
export function testConfig(
    dir?: string,
    maxInjectPerMessage?: number,
    maxInjectPerSendLoop?: number,
    minSummaryLength?: number
): MemoryConfiguration {
    const config = new MemoryConfiguration(
        dir,
        maxInjectPerMessage,
        maxInjectPerSendLoop
    );
    config.minSummaryLength = minSummaryLength ?? 1;
    config.summaryContentRatio = 1000;
    return config;
}

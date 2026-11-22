/***
 * Compile-time check that the real chat engine satisfies the recall port.
 *
 * The package itself has no dependency on `@johannes.latzel/llm-chat`; this
 * test keeps `RecallHookTarget` aligned with `ChatService`.
 */
import { describe, expectTypeOf, it } from 'vitest';
import type { ChatService } from '@johannes.latzel/llm-chat';
import type { RecallHookTarget } from '../../src/lib/memory-service.js';

describe('RecallHookTarget', () => {
    it('is satisfied by ChatService', () => {
        expectTypeOf<ChatService>().toExtend<RecallHookTarget>();
    });
});

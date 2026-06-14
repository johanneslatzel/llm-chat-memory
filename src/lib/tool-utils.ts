import { ResultStatus } from '@johannes.latzel/llm-chat';
import type { PartialToolResult } from '@johannes.latzel/llm-chat';

/**
 * Parses a JSON string into a string array.
 *
 * Tool parameters arrive as JSON strings. This validates the format
 * and returns a typed result with consistent error reporting, avoiding
 * repeated try/catch + type-check boilerplate in each tool handler.
 */
export function parseJsonStringArray(
    value: unknown,
    label: string
): { ok: true; value: string[] } | { ok: false; error: PartialToolResult } {
    // already parsed by the tool runtime — validate and pass through
    if (Array.isArray(value)) {
        if (!value.every((t: unknown) => typeof t === 'string')) {
            return {
                ok: false,
                error: {
                    result: `'${label}' must be an array of strings`,
                    status: ResultStatus.Error
                }
            };
        }
        return { ok: true, value };
    }

    if (typeof value !== 'string') {
        return {
            ok: false,
            error: {
                result: `'${label}' must be a JSON array of strings`,
                status: ResultStatus.Error
            }
        };
    }
    try {
        const parsed = JSON.parse(value);
        if (!Array.isArray(parsed) || !parsed.every((t: unknown) => typeof t === 'string')) {
            return {
                ok: false,
                error: {
                    result: `'${label}' must be a JSON array of strings`,
                    status: ResultStatus.Error
                }
            };
        }
        return { ok: true, value: parsed };
    } catch {
        return {
            ok: false,
            error: {
                result: `'${label}' must be a valid JSON array of strings`,
                status: ResultStatus.Error
            }
        };
    }
}

/**
 * Validates that a value is a non-blank string and returns it trimmed.
 *
 * Required tool parameters need a uniform validation path. This
 * encapsulates the null/undefined/empty check and returns a tagged
 * union so callers can handle success and error without exceptions.
 */
export function requireString(
    value: unknown,
    name: string
): { ok: true; value: string } | { ok: false; error: PartialToolResult } {
    if (typeof value !== 'string' || !value.trim()) {
        return {
            ok: false,
            error: {
                result: `Required parameter '${name}' is missing or not a string`,
                status: ResultStatus.Error
            }
        };
    }
    return { ok: true, value: value.trim() };
}

/**
 * Converts a label into a URL-safe ID (lowercase, hyphen-separated).
 *
 * The memory pool uses IDs derived from user-provided labels for
 * deduplication and lookup. This ensures labels like "My Memories"
 * become stable, filesystem-safe keys like "my-memories".
 */
export function sanitiseId(label: string): string {
    const sanitised = label
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9_-]/g, '')
        .replace(/^-+|-+$/g, '');
    if (!sanitised) {
        throw new Error(
            `Invalid memory id '${label}': must contain at least one alphanumeric character`
        );
    }
    return sanitised;
}

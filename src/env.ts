import {
    createEnvReader,
    EmptyStringPolicy,
    NumberParsing,
    RangePolicy
} from '@johannes.latzel/env';

function makeEnv() {
    return createEnvReader({
        numberParsing: NumberParsing.Lenient,
        rangePolicy: RangePolicy.Clamp,
        emptyString: EmptyStringPolicy.Value
    });
}

function clampFallback(fallback: number, min?: number, max?: number): number {
    const lower = min ?? Number.NEGATIVE_INFINITY;
    const upper = max ?? Number.POSITIVE_INFINITY;
    return Math.min(upper, Math.max(lower, fallback));
}

/** Read an integer clamped to the inclusive bounds, or the clamped fallback. */
export function envInt(key: string, fallback: number, min = 1, max?: number): number {
    return makeEnv().int(key, clampFallback(fallback, min, max), min, max);
}

/** Read a finite float clamped to the inclusive bounds, or the clamped fallback. */
export function envFloat(key: string, fallback: number, min?: number, max?: number): number {
    return makeEnv().float(key, clampFallback(fallback, min, max), min, max);
}

/** Read a string, preserving an explicitly empty value. */
export function envString(key: string, fallback: string): string {
    return makeEnv().string(key, fallback);
}

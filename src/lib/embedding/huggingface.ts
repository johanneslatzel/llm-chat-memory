import type { PretrainedModelOptions } from '@huggingface/transformers';
import type { TextEmbeddingProvider } from './provider.js';

/** Valid execution devices for HuggingFace Transformers.js. */
export enum HuggingFaceDevice {
    CUDA = 'cuda',
    WebGPU = 'webgpu',
    CPU = 'cpu'
}

/** Options for configuring a {@link HuggingFaceEmbeddingProvider}. */
export interface HuggingFaceEmbeddingProviderOptions {
    model?: string;
    dtype?: string;
    device?: HuggingFaceDevice;
    dimensions?: number;
}

/**
 * Local embedding provider using {@link https://huggingface.co/docs/transformers.js | Transformers.js}.
 *
 * Runs a feature-extraction pipeline in-process (default: `Xenova/all-MiniLM-L6-v2`).
 * The pipeline is lazy-loaded on the first {@link encode} call.
 */
export class HuggingFaceEmbeddingProvider implements TextEmbeddingProvider {
    readonly #dimensions: number;
    private pipeline: unknown = null;
    private readonly model: string;
    private readonly dtype: string;
    private readonly device: HuggingFaceDevice;

    constructor(options?: HuggingFaceEmbeddingProviderOptions) {
        this.model = options?.model ?? 'Xenova/all-MiniLM-L6-v2';
        this.dtype = options?.dtype ?? 'q8';
        this.device = options?.device ?? HuggingFaceDevice.CPU;
        this.#dimensions = options?.dimensions ?? 384;
    }

    /** Returns the embedding vector dimensionality (default 384). */
    dimensions(): number {
        return this.#dimensions;
    }

    /**
     * Encodes text into an embedding vector.
     *
     * The Transformers.js pipeline is lazy-loaded on the first call.
     */
    async encode(text: string): Promise<number[]> {
        if (!this.pipeline) {
            await this.#initPipeline();
        }

        const pipe = this.pipeline as (
            text: string,
            options: { pooling: string; normalize: boolean }
        ) => Promise<{ data: Float32Array }>;
        const result = await pipe(text, { pooling: 'mean', normalize: true });
        return Array.from(result.data);
    }

    /**
     * Lazy-loads the Transformers.js pipeline on first use.
     *
     * @huggingface/transformers ships large WASM binaries (~30 MB).
     * A dynamic import keeps startup fast when using a different
     * embedding provider that doesn't need this dependency.
     */
    async #initPipeline(): Promise<void> {
        const { pipeline } = await import('@huggingface/transformers');
        this.pipeline = await pipeline('feature-extraction', this.model, {
            dtype: this.dtype,
            device: this.device
        } as PretrainedModelOptions);
    }
}

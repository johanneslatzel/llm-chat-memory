/** Converts text into a numerical vector (embedding) for similarity search. */
export interface TextEmbeddingProvider {
    encode(text: string): Promise<number[]>;
    dimensions(): number;
}

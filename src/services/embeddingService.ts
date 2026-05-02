import { DocumentChunk } from '../types';

export class EmbeddingService {
  private apiKey: string = '';
  private provider: 'huggingface' | 'transformers';

  constructor(provider: 'huggingface' | 'transformers' = 'huggingface') {
    this.provider = provider;
    if (provider === 'huggingface') {
      this.apiKey = import.meta.env.VITE_HUGGINGFACE_API_KEY || '';
    }
  }

  async generateEmbedding(text: string): Promise<number[]> {
    if (this.provider === 'huggingface') {
      return this.generateEmbeddingWithHuggingFace(text);
    } else {
      return this.generateEmbeddingWithTransformers(text);
    }
  }

  private async generateEmbeddingWithHuggingFace(text: string, retries: number = 3): Promise<number[]> {
    if (!this.apiKey) {
      throw new Error('HuggingFace API key is not configured. Please set VITE_HUGGINGFACE_API_KEY in your .env file.');
    }

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        // Use Vite proxy to bypass CORS
        const response = await fetch(
          '/hf-api/hf-inference/models/sentence-transformers/all-MiniLM-L6-v2/pipeline/feature-extraction',
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${this.apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              inputs: text,
              options: { wait_for_model: true },
            }),
          }
        );

        if (response.status === 503) {
          // Model is loading (cold start on free tier) — retry after delay
          const waitTime = attempt * 5000;
          console.log(`HuggingFace model is loading, retrying in ${waitTime / 1000}s (attempt ${attempt}/${retries})...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }

        if (!response.ok) {
          const errorBody = await response.text();
          throw new Error(`HuggingFace API error (${response.status}): ${errorBody}`);
        }

        const result = await response.json();

        // Handle HuggingFace sentence-transformers response formats:
        // Format 1: flat array [0.1, 0.2, ...] (single input)
        // Format 2: nested array [[0.1, 0.2, ...]] (batch input)
        if (Array.isArray(result)) {
          if (result.length > 0 && typeof result[0] === 'number') {
            // Flat array of numbers — direct embedding
            return result;
          }
          if (result.length > 0 && Array.isArray(result[0])) {
            // Nested array — return first embedding
            return result[0];
          }
        }

        console.error('Unexpected HuggingFace response format:', JSON.stringify(result).substring(0, 200));
        throw new Error('HuggingFace returned an unexpected embedding format. Check console for details.');
      } catch (error) {
        if (attempt === retries) {
          throw error;
        }
        // Only retry on network errors, not on API errors
        if (error instanceof TypeError && (error.message.includes('fetch') || error.message.includes('network'))) {
          console.log(`Network error, retrying (attempt ${attempt}/${retries})...`);
          await new Promise(resolve => setTimeout(resolve, 2000));
          continue;
        }
        throw error;
      }
    }

    throw new Error('HuggingFace API: Max retries exceeded');
  }

  private async generateEmbeddingWithTransformers(_text: string): Promise<number[]> {
    // This would use transformers.js in the browser
    // For now, return a placeholder implementation
    throw new Error('Transformers.js embedding generation not yet implemented');
  }

  chunkText(text: string, chunkSize: number = 1000, overlap: number = 200): string[] {
    const chunks: string[] = [];
    
    for (let i = 0; i < text.length; i += chunkSize - overlap) {
      const chunk = text.slice(i, i + chunkSize);
      if (chunk.trim().length > 0) {
        chunks.push(chunk.trim());
      }
    }
    
    return chunks;
  }

  async processDocument(
    text: string,
    fileId: string,
    fileName: string,
    folderId: string
  ): Promise<Omit<DocumentChunk, 'id' | 'created_at'>[]> {
    const chunks = this.chunkText(text);
    const processedChunks: Omit<DocumentChunk, 'id' | 'created_at'>[] = [];

    for (const chunk of chunks) {
      try {
        const embedding = await this.generateEmbedding(chunk);
        
        processedChunks.push({
          content: chunk,
          file_id: fileId,
          file_name: fileName,
          folder_id: folderId,
          embedding,
        });
      } catch (error) {
        console.error('Error generating embedding for chunk:', error);
        // Continue processing other chunks even if one fails
      }
    }

    return processedChunks;
  }
}

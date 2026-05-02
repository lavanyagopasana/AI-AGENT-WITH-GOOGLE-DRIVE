import { createClient } from '@supabase/supabase-js';
import { DocumentChunk } from '../types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase URL and Anon Key are required');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export class SupabaseService {
  async storeDocumentChunk(chunk: Omit<DocumentChunk, 'id' | 'created_at'>): Promise<DocumentChunk> {
    const { data, error } = await supabase
      .from('document_chunks')
      .insert({
        content: chunk.content,
        file_id: chunk.file_id,
        file_name: chunk.file_name,
        folder_id: chunk.folder_id,
        embedding: chunk.embedding,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to store document chunk: ${error.message}`);
    }

    return data;
  }

  async searchSimilarChunks(queryEmbedding: number[], folderId: string, limit: number = 5): Promise<DocumentChunk[]> {
    const { data, error } = await supabase
      .rpc('search_documents', {
        query_embedding: queryEmbedding,
        folder_id: folderId,
        match_count: limit,
      });

    if (error) {
      throw new Error(`Failed to search documents: ${error.message}`);
    }

    return data || [];
  }

  async getStoredChunks(folderId: string): Promise<DocumentChunk[]> {
    const { data, error } = await supabase
      .from('document_chunks')
      .select('*')
      .eq('folder_id', folderId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to get stored chunks: ${error.message}`);
    }

    return data || [];
  }

  async deleteDocumentChunks(folderId: string): Promise<void> {
    const { error } = await supabase
      .from('document_chunks')
      .delete()
      .eq('folder_id', folderId);

    if (error) {
      throw new Error('Failed to delete document chunks');
    }
  }

  async searchDocuments(queryEmbedding: number[], folderId: string, limit: number = 5): Promise<any[]> {
    const { data, error } = await supabase
      .rpc('search_documents', {
        query_embedding: queryEmbedding,
        search_folder_id: folderId,
        match_count: limit
      });

    if (error) {
      throw new Error(`Failed to search documents: ${error.message}`);
    }

    return data || [];
  }

  async deleteChunksByFile(fileId: string): Promise<void> {
    const { error } = await supabase
      .from('document_chunks')
      .delete()
      .eq('file_id', fileId);

    if (error) {
      throw new Error(`Failed to delete chunks: ${error.message}`);
    }
  }

  async chunkExists(fileId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('document_chunks')
      .select('id')
      .eq('file_id', fileId)
      .limit(1);

    if (error) {
      throw new Error(`Failed to check chunk existence: ${error.message}`);
    }

    return (data && data.length > 0) || false;
  }
}

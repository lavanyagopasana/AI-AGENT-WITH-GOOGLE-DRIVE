-- AI Drive Agent Supabase Database Setup
-- Run this SQL in your Supabase SQL Editor

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create document chunks table
CREATE TABLE document_chunks (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  content text NOT NULL,
  file_id text NOT NULL,
  file_name text NOT NULL,
  folder_id text NOT NULL,
  embedding vector(384),
  created_at timestamptz DEFAULT now()
);

-- Create vector similarity search function
CREATE OR REPLACE FUNCTION search_documents(
  query_embedding vector(384),
  search_folder_id text,
  match_count int DEFAULT 5
)
RETURNS TABLE(
  id uuid,
  content text,
  file_id text,
  file_name text,
  folder_id text,
  embedding vector(384),
  created_at timestamptz,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    dc.*,
    1 - (dc.embedding <=> query_embedding) as similarity
  FROM document_chunks dc
  WHERE dc.folder_id = search_folder_id
  ORDER BY dc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Create indexes for better performance
CREATE INDEX ON document_chunks (folder_id);
CREATE INDEX ON document_chunks (file_id);

-- Enable Row Level Security (optional but recommended)
ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;

-- Create policy for document access (adjust as needed)
CREATE POLICY "Users can access their own document chunks" ON document_chunks
  FOR ALL USING (true); -- Simplified policy for development

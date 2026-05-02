# AI Drive Agent

A local, free-tier-optimized AI agent that allows users to connect their Google Drive via OAuth, select specific folders, and ask questions about the documents within.

## Features

- **Google OAuth Integration**: Secure authentication with Google Drive using `@react-oauth/google`
- **Document Ingestion**: Automatically processes PDF and text files from selected folders
- **Vector Search**: Uses Supabase with pgvector for semantic document retrieval
- **RAG Pipeline**: Retrieves relevant document chunks and generates context-aware responses
- **Strict Guardrails**: AI only answers based on provided documents, never external knowledge
- **Modern UI**: Professional dashboard with sidebar navigation and chat interface

## Tech Stack

- **Frontend**: React + Vite + TypeScript + Tailwind CSS
- **Authentication**: `@react-oauth/google`
- **Storage**: Supabase (PostgreSQL + pgvector)
- **Embeddings**: HuggingFace Inference API (free tier)
- **LLM**: Groq (Llama-3) or Claude (Anthropic API)
- **Icons**: Lucide React

## Prerequisites

1. **Google Cloud Project**
   - Create a project at [Google Cloud Console](https://console.cloud.google.com/)
   - Enable Google Drive API
   - Create OAuth 2.0 credentials
   - Add authorized redirect URI: `http://localhost:5173`

2. **Supabase Project**
   - Create a project at [Supabase](https://supabase.com/)
   - Enable pgvector extension
   - Create the `document_chunks` table (see SQL below)

3. **API Keys**
   - Groq API key (recommended - free tier available)
   - OR Claude API key
   - HuggingFace API key (for embeddings)

## Setup

### 1. Clone and Install

```bash
git clone <your-repo>
cd ai-drive-agent
npm install
```

### 2. Environment Variables

Copy `.env.example` to `.env` and fill in your credentials:

```env
# Google OAuth Configuration
VITE_GOOGLE_CLIENT_ID=your_google_client_id_here

# Supabase Configuration
VITE_SUPABASE_URL=your_supabase_url_here
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key_here

# LLM Configuration (choose one)
VITE_GROQ_API_KEY=your_groq_api_key_here
# VITE_CLAUDE_API_KEY=your_claude_api_key_here

# Embeddings Configuration
VITE_HUGGINGFACE_API_KEY=your_huggingface_api_key_here
```

### 3. Supabase Database Setup

Run this SQL in your Supabase SQL Editor:

```sql
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
  folder_id text,
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
  WHERE dc.folder_id = search_documents.folder_id
  ORDER BY dc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Create indexes for better performance
CREATE INDEX ON document_chunks (folder_id);
CREATE INDEX ON document_chunks (file_id);
```

### 4. Run the Application

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## Usage

1. **Connect Google Drive**: Click "Connect Google Drive" in the header
2. **Select Folder**: Choose a folder from the sidebar
3. **Wait for Processing**: Documents are automatically processed and stored
4. **Ask Questions**: Type questions in the chat interface

## Architecture

### Phase 1: OAuth & Drive Discovery
- Google OAuth flow with `drive.readonly` and `drive.metadata.readonly` scopes
- Service to list folders and fetch file content
- Support for PDF and text files

### Phase 2: Ingestion & Vectorization
- Text extraction from documents
- Chunking into 1000-character segments with 200-character overlap
- Embedding generation using HuggingFace API
- Storage in Supabase with metadata

### Phase 3: Retrieval & Chat
- Query vectorization
- Similarity search in Supabase
- Context-aware LLM responses with strict guardrails

## Guardrails

The system enforces strict context-only responses:

- AI can only use information from retrieved document chunks
- If information isn't found, responds: "I cannot find this information in your documents."
- No external knowledge or assumptions beyond the context
- Always cites source documents when providing information

## Development

### Project Structure

```
src/
├── components/          # React components
│   ├── Layout.tsx
│   ├── Header.tsx
│   ├── Sidebar.tsx
│   └── ChatInterface.tsx
├── contexts/           # React contexts
│   ├── AuthContext.tsx
│   └── DriveContext.tsx
├── services/           # API services
│   ├── googleDriveService.ts
│   ├── supabaseService.ts
│   ├── embeddingService.ts
│   └── llmService.ts
├── types/              # TypeScript types
│   └── index.ts
└── utils/              # Utilities
    └── pdfParser.ts
```

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## Troubleshooting

### Common Issues

1. **Google OAuth Error**: Ensure redirect URI is set to `http://localhost:5173`
2. **Supabase Connection**: Verify URL and anon key are correct
3. **Embedding Failures**: Check HuggingFace API key and rate limits
4. **LLM Errors**: Verify Groq/Claude API key is valid

### Debug Mode

Add `?debug=true` to the URL to enable console logging for troubleshooting.

## License

MIT License - see LICENSE file for details.

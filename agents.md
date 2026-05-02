# Project Mission: Google Drive RAG Agent
Build a local, free-tier-optimized AI agent that allows users to connect their Google Drive via OAuth, select specific folders, and ask questions about the documents within.

## Technical Stack Constraints
- **Frontend:** React + Vite + Tailwind CSS.
- **Auth:** `@react-oauth/google` for Drive access tokens.
- **Storage:** Supabase (PostgreSQL + pgvector) for document storage and vector search.
- **Embeddings:** Transformers.js (running locally) or HuggingFace Inference API (free tier).
- **LLM:** Claude (via Anthropic API) or Groq (Llama-3) for fast, free-tier inference.

## Implementation Workflow
1. **Phase 1: OAuth & Drive Discovery:** 
   - Implement Google OAuth flow with `drive.readonly` and `drive.metadata.readonly` scopes.
   - Build a service to list folders and fetch file content (handle PDF and Text).
2. **Phase 2: Ingestion & Vectorization:** 
   - Extract text from documents.
   - Chunk text into 1000-character segments with 200-character overlap.
   - Generate embeddings and store them in Supabase with metadata (folder_id, file_name).
3. **Phase 3: Retrieval & Chat:** 
   - Convert user queries to vectors.
   - Perform similarity search in Supabase.
   - Pass context + query to the LLM.

## Strict Guardrails & Instructions
- **Context-Only Mode:** The system prompt for the LLM must explicitly forbid the use of external knowledge. 
- **Error Handling:** If the user asks a question not covered by the retrieved chunks, the agent must reply: "I cannot find this information in the selected documents."
- **Efficiency:** Minimize API calls. Do not re-vectorize files that haven't changed.
- **UI Fidelity:** Maintain the professional dashboard layout established in initial Bolt.new prototypes (Sidebar for folders, Header for Auth, Main Chat).

## Coding Standards
- Use TypeScript for all components and services.
- Follow a modular architecture (separate services for Google Drive, Supabase, and AI).
- Use Lucide-React for consistent iconography.
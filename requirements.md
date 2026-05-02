# AI Drive Agent - System Requirements

## Environment Requirements
- Node.js (v18.0.0 or higher)
- npm (v9.0.0 or higher)

## Core Dependencies (installed via package.json)
react @ ^18.3.1
react-dom @ ^18.3.1
react-router-dom @ ^6.22.3
@supabase/supabase-js @ ^2.39.8
@react-oauth/google @ ^0.12.1
pdfjs-dist @ ^4.0.379
lucide-react @ ^0.344.0
tailwindcss @ ^3.4.1

## External APIs / Services Required
1. Google Cloud Console (OAuth 2.0 Client ID)
   - Required Scopes: drive.readonly, drive.metadata.readonly
2. Supabase (PostgreSQL with pgvector extension)
   - Required tables: document_chunks
3. HuggingFace (Free Serverless Inference API)
   - Model: sentence-transformers/all-MiniLM-L6-v2
4. Groq (Free Inference API)
   - Model: llama-3.1-8b-instant

## Environment Variables (.env)
VITE_GOOGLE_CLIENT_ID=
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_GROQ_API_KEY=
VITE_HUGGINGFACE_API_KEY=

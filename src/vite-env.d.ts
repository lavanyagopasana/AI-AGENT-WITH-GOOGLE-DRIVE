/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GOOGLE_CLIENT_ID: string;
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_GROQ_API_KEY: string;
  readonly VITE_CLAUDE_API_KEY: string;
  readonly VITE_HUGGINGFACE_API_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

# Quick Setup Guide

## 1. Install Dependencies
```bash
npm install
```

## 2. Environment Configuration
Copy the values you need into your `.env` file:

```env
# Get this from Google Cloud Console
VITE_GOOGLE_CLIENT_ID=your_google_client_id_here

# Get these from Supabase Dashboard
VITE_SUPABASE_URL=your_supabase_url_here
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key_here

# Get this from Groq Dashboard (recommended - free tier)
VITE_GROQ_API_KEY=your_groq_api_key_here

# Get this from HuggingFace
VITE_HUGGINGFACE_API_KEY=your_huggingface_api_key_here
```

## 3. Database Setup
Run the SQL in `supabase-setup.sql` in your Supabase SQL Editor.

## 4. Google OAuth Setup
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Google Drive API
4. Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client IDs"
5. Select "Web application"
6. Add authorized redirect URI: `http://localhost:5173`
7. Copy the Client ID to your `.env`

## 5. Run the Application
```bash
npm run dev
```

Open http://localhost:5173

## 6. Test the Flow
1. Click "Connect Google Drive"
2. Select a folder from the sidebar
3. Wait for documents to process
4. Ask questions about your documents

## API Keys Setup

### Groq (Recommended - Free Tier)
1. Go to [Groq Console](https://console.groq.com/)
2. Sign up for free account
3. Go to API Keys
4. Create new key
5. Copy to `.env`

### HuggingFace (Free Tier)
1. Go to [HuggingFace](https://huggingface.co/)
2. Sign up for free account
3. Go to Settings → Access Tokens
4. Create new token
5. Copy to `.env`

### Supabase (Free Tier)
1. Go to [Supabase](https://supabase.com/)
2. Sign up for free account
3. Create new project
4. Go to Settings → API
5. Copy URL and anon key to `.env`
6. Run the SQL from `supabase-setup.sql`

## Troubleshooting

### Common Issues
- **Google OAuth Error**: Make sure redirect URI is exactly `http://localhost:5173`
- **Supabase Connection**: Verify URL and keys are correct
- **API Errors**: Check that API keys are valid and have credits

### Debug Mode
Add `?debug=true` to URL for console logging.

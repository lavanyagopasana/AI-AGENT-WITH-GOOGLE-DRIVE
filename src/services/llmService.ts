export class LLMService {
  private apiKey: string;
  private provider: 'groq' | 'claude';

  constructor(provider: 'groq' | 'claude' = 'groq') {
    this.provider = provider;
    if (provider === 'groq') {
      this.apiKey = import.meta.env.VITE_GROQ_API_KEY || '';
    } else {
      this.apiKey = import.meta.env.VITE_CLAUDE_API_KEY || '';
    }
  }

  async generateResponse(
    query: string,
    context: string,
    folderMetadata?: { folderName: string; fileNames: string[] }
  ): Promise<string> {
    if (!this.apiKey) {
      throw new Error(`${this.provider === 'groq' ? 'Groq' : 'Claude'} API key is not configured. Please set ${this.provider === 'groq' ? 'VITE_GROQ_API_KEY' : 'VITE_CLAUDE_API_KEY'} in your .env file.`);
    }

    const systemPrompt = this.createSystemPrompt(context, folderMetadata);

    if (this.provider === 'groq') {
      return this.generateResponseWithGroq(systemPrompt, query);
    } else {
      return this.generateResponseWithClaude(systemPrompt, query);
    }
  }

  private createSystemPrompt(
    context: string,
    folderMetadata?: { folderName: string; fileNames: string[] }
  ): string {
    const metadataSection = folderMetadata
      ? `FOLDER METADATA (always use this for questions about files, file count, or folder structure):
Folder name: ${folderMetadata.folderName}
Total files: ${folderMetadata.fileNames.length}
Files in this folder:
${folderMetadata.fileNames.map((name, i) => `  ${i + 1}. ${name}`).join('\n')}

`
      : '';

    return `You are a helpful AI assistant that answers questions based ONLY on the provided folder metadata and document context below.

${metadataSection}DOCUMENT CONTENT (use this for questions about what the documents contain):
${context}

STRICT RULES:
1. For questions about files, file names, file count, or folder structure — ALWAYS use the FOLDER METADATA section above. Never say you cannot find this.
2. For questions about document content — use the DOCUMENT CONTENT section above.
3. If the user asks a general question (e.g., "summarize" or "what does this contain"), provide a high-level summary.
4. If the answer to a specific content question cannot be found in the context, respond with: "I cannot find this information in the selected documents."
5. Do not use any external knowledge beyond the provided metadata and context.
6. Be concise and direct in your answers.
7. When referencing content, mention which document it came from.

Now answer the user's question.`;
  }

  private async generateResponseWithGroq(systemPrompt: string, query: string): Promise<string> {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: query }
        ],
        temperature: 0.1,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Groq API error (${response.status}): ${errorBody}`);
    }

    const result = await response.json();
    return result.choices[0]?.message?.content || 'I cannot find this information in the selected documents.';
  }

  private async generateResponseWithClaude(systemPrompt: string, query: string): Promise<string> {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-sonnet-20240229',
        max_tokens: 1000,
        system: systemPrompt,
        messages: [
          { role: 'user', content: query }
        ],
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Claude API error (${response.status}): ${errorBody}`);
    }

    const result = await response.json();
    return result.content[0]?.text || 'I cannot find this information in the selected documents.';
  }
}
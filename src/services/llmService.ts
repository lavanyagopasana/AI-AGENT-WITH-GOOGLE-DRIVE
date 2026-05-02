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
    context: string
  ): Promise<string> {
    if (!this.apiKey) {
      throw new Error(`${this.provider === 'groq' ? 'Groq' : 'Claude'} API key is not configured. Please set ${this.provider === 'groq' ? 'VITE_GROQ_API_KEY' : 'VITE_CLAUDE_API_KEY'} in your .env file.`);
    }

    const systemPrompt = this.createSystemPrompt(context);
    
    if (this.provider === 'groq') {
      return this.generateResponseWithGroq(systemPrompt, query);
    } else {
      return this.generateResponseWithClaude(systemPrompt, query);
    }
  }

  private createSystemPrompt(context: string): string {
    return `You are a helpful AI assistant that answers questions based ONLY on the provided document context.

CONTEXT:
${context}

STRICT RULES:
1. You MUST answer ONLY using information from the provided context above
2. If the answer cannot be found in the context, you MUST respond with: "I cannot find this information in the selected documents."
3. Do not use any external knowledge or make assumptions beyond the context
4. Be concise and direct in your answers
5. If you reference information, mention which document it came from

Now answer the user's question based on the provided context.`;
  }

  private async generateResponseWithGroq(systemPrompt: string, query: string): Promise<string> {
    // Use Vite proxy to bypass CORS
    const response = await fetch('/groq-api/openai/v1/chat/completions', {
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

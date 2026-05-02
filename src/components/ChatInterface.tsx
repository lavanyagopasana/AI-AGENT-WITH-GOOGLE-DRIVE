import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useDrive } from '../contexts/DriveContext';
import { Send, Bot, User, FileText, Folder, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { ChatMessage } from '../types';
import { SupabaseService } from '../services/supabaseService';
import { EmbeddingService } from '../services/embeddingService';
import { LLMService } from '../services/llmService';

const ChatInterface: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const { selectedFolder, files } = useDrive();
  const fileNames: string[] = files ? files.map((f: any) => f.name) : [];
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [expandedErrors, setExpandedErrors] = useState<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const normalizeForMatch = (s: string) =>
    s
      .toLowerCase()
      .replace(/\.[a-z0-9]+$/i, '') // drop extension
      .replace(/[_\-]+/g, ' ')
      .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const scoreFileNameMatch = (query: string, fileName: string): number => {
    const q = normalizeForMatch(query);
    const f = normalizeForMatch(fileName);
    if (!q || !f) return 0;

    // strong signals: explicit inclusion
    if (q.includes(fileName.toLowerCase())) return 100;
    if (q.includes(f)) return 80;

    const qTokens = new Set(q.split(' ').filter((t) => t.length >= 3));
    const fTokens = f.split(' ').filter((t) => t.length >= 3);

    // token overlap score
    let overlap = 0;
    for (const t of fTokens) {
      if (qTokens.has(t)) overlap += 1;
    }

    // boost if query includes a distinctive token from file name
    const boost = overlap > 0 ? 10 : 0;
    return overlap * 10 + boost;
  };

  const resolveRequestedFileName = (query: string): string | null => {
    const q = query.trim();
    if (!q || fileNames.length === 0) return null;

    // Match "file 8", "file #8", "file:8"
    const fileNumMatch = q.match(/\bfile\s*[#:]*\s*(\d+)\b/i);
    if (fileNumMatch) {
      const idx = Number(fileNumMatch[1]);
      if (Number.isFinite(idx) && idx >= 1 && idx <= fileNames.length) {
        return fileNames[idx - 1];
      }
    }

    // Match explicit filename mention (case-insensitive)
    const lowered = q.toLowerCase();
    const direct = fileNames.find((name) => lowered.includes(name.toLowerCase()));
    if (direct) return direct;

    // Topic-based filename matching (e.g. "dividends" -> 08_Dividends_and_Income_Investing.md)
    const scored = fileNames
      .map((name) => ({ name, score: scoreFileNameMatch(q, name) }))
      .sort((a, b) => b.score - a.score);

    const best = scored[0];
    const second = scored[1];

    // Only lock to a file when it’s a clear winner
    if (best && best.score >= 20 && (!second || best.score >= second.score + 10)) {
      return best.name;
    }

    return null;
  };

  const isFileListQuestion = (query: string): boolean => {
    const q = query.toLowerCase().trim();
    if (!q) return false;

    return (
      (q.includes('file') || q.includes('files')) &&
      (
        q.includes('what are') ||
        q.includes('list') ||
        q.includes('show') ||
        q.includes('in this folder') ||
        q.includes('folder')
      )
    );
  };

  const isIrrelevantQuestion = (query: string): boolean => {
    const q = query.toLowerCase().trim();
    if (!q) return false;

    // If the user is asking about folder/files/docs, it's not irrelevant.
    const docIntent =
      q.includes('document') ||
      q.includes('documents') ||
      q.includes('folder') ||
      q.includes('file') ||
      q.includes('files') ||
      q.includes('summar') ||
      q.includes('explain') ||
      q.includes('contains') ||
      q.includes('content');
    if (docIntent) return false;

    // Personal / world-knowledge / unrelated patterns
    const patterns: RegExp[] = [
      /\bwhat('?s| is)\s+my\s+name\b/i,
      /\bwhat('?s| is)\s+my\s+age\b/i,
      /\bwho\s+am\s+i\b/i,
      /\bmy\s+(name|age)\b/i,
      /\bweather\b/i,
      /\btemperature\b/i,
      /\brain\b/i,
      /\bnews\b/i,
      /\bwho\s+is\b/i,
      /\bwhat\s+is\s+the\s+capital\b/i,
    ];

    return patterns.some((re) => re.test(query));
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Reset messages when folder changes
  useEffect(() => {
    setMessages([]);
  }, [selectedFolder?.id]);

  const toggleErrorDetails = (messageId: string) => {
    setExpandedErrors(prev => {
      const next = new Set(prev);
      if (next.has(messageId)) {
        next.delete(messageId);
      } else {
        next.add(messageId);
      }
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!inputValue.trim() || isLoading || !selectedFolder) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      content: inputValue,
      role: 'user',
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      console.log('Starting RAG pipeline for query:', inputValue);

      if (isIrrelevantQuestion(inputValue)) {
        const aiMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          content: "Not related to the selected documents. Ask a question about the files in this folder.",
          role: 'assistant',
          timestamp: new Date().toISOString(),
          sources: [],
        };
        setMessages(prev => [...prev, aiMessage]);
        return;
      }

      // Initialize services
      const supabaseService = new SupabaseService();
      const embeddingService = new EmbeddingService();
      const llmService = new LLMService();

      // folderMetadata uses fileNames computed at component scope from useDrive()
      const folderMetadata = {
        folderName: selectedFolder.name,
        fileNames,
      };

      const metadataOnlyFileListQuestion = isFileListQuestion(inputValue);
      const requestedFileName = metadataOnlyFileListQuestion ? null : resolveRequestedFileName(inputValue);
      let relevantChunks: any[] = [];

      if (metadataOnlyFileListQuestion) {
        console.log('Detected file-list question. Using folder metadata only.');
      } else if (requestedFileName) {
        console.log('Detected file-specific question. Restricting to file:', requestedFileName);
        relevantChunks = await supabaseService.getChunksForFile(selectedFolder.id, requestedFileName, 30);
      } else {
        // Step 1: Generate embedding for user query
        console.log('Step 1: Generating embedding for query...');
        const queryEmbedding = await embeddingService.generateEmbedding(inputValue);
        console.log('Embedding generated, dimension:', queryEmbedding.length);

        // Step 2: Search for relevant document chunks in Supabase
        console.log('Step 2: Searching documents in folder:', selectedFolder.id);
        relevantChunks = await supabaseService.searchDocuments(queryEmbedding, selectedFolder.id, 5);
      }

      console.log('Found relevant chunks:', relevantChunks.length);

      if (!metadataOnlyFileListQuestion && relevantChunks.length === 0) {
        const aiMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          content: requestedFileName
            ? `I cannot find any processed chunks for "${requestedFileName}" in this folder yet. It may still be indexing — wait a moment and try again. If it persists, re-select the folder to trigger indexing.`
            : "I cannot find any processed documents in this folder. The documents may still be processing — please wait a moment and try again. If this persists, try re-selecting the folder from the sidebar to trigger document indexing.",
          role: 'assistant',
          timestamp: new Date().toISOString(),
        };
        setMessages(prev => [...prev, aiMessage]);
        setIsLoading(false);
        return;
      }

      // Step 3: Generate response using LLM with context + folder metadata
      console.log('Step 3: Generating LLM response...');
      const context = relevantChunks
        .map((chunk: any) => `From ${chunk.file_name}:\n${chunk.content}`)
        .join('\n\n---\n\n');

      const aiResponse = await llmService.generateResponse(inputValue, context, folderMetadata);

      const uniqueSources = metadataOnlyFileListQuestion
        ? fileNames.map((name) => ({ file_name: name }))
        : Array.from(new Map(relevantChunks.map((chunk: any) => [chunk.file_name, chunk])).values());

      const aiMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        content: aiResponse,
        role: 'assistant',
        timestamp: new Date().toISOString(),
        sources: uniqueSources,
      };

      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error('RAG pipeline error:', error);
      const errorMessage = (error as Error).message || 'Unknown error';
      console.error('Error message:', errorMessage);

      let responseMessage = "I encountered an error while processing your request.";
      let errorDetail = errorMessage;

      if (errorMessage.includes('HuggingFace')) {
        responseMessage = "There was a problem with the embedding service (HuggingFace). This could be due to an invalid API key, rate limiting, or the model is loading.";
      } else if (errorMessage.includes('Groq')) {
        responseMessage = "There was a problem with the AI service (Groq). Please verify your VITE_GROQ_API_KEY in the .env file.";
      } else if (errorMessage.includes('Claude')) {
        responseMessage = "There was a problem with the AI service (Claude). Please verify your VITE_CLAUDE_API_KEY in the .env file.";
      } else if (errorMessage.includes('Supabase') || errorMessage.includes('search_documents') || errorMessage.includes('document_chunks')) {
        responseMessage = "There was a problem with the database (Supabase). Please verify your Supabase URL, anon key, and that the database tables are set up correctly.";
      } else if (errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError') || errorMessage.includes('network')) {
        responseMessage = "A network request failed. This could be due to CORS restrictions, an invalid API endpoint, or a connectivity issue. Check the browser console (F12) for more details.";
      } else if (errorMessage.includes('API key')) {
        responseMessage = errorMessage;
      }

      const errorId = (Date.now() + 1).toString();
      const errorResponse: ChatMessage = {
        id: errorId,
        content: responseMessage,
        role: 'assistant',
        timestamp: new Date().toISOString(),
        errorDetail,
      };
      setMessages(prev => [...prev, errorResponse]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
        <div className="text-center max-w-md">
          <Bot className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Welcome to AI Drive Agent</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Connect your Google Drive to ask questions about your documents using AI.
          </p>
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 text-left">
            <h3 className="font-semibold text-blue-900 dark:text-blue-300 mb-2">Getting Started:</h3>
            <ol className="text-sm text-blue-800 dark:text-blue-400 space-y-1">
              <li>1. Click "Connect Google Drive" in the header</li>
              <li>2. Select a folder from the sidebar</li>
              <li>3. Start asking questions about your documents</li>
            </ol>
          </div>
        </div>
      </div>
    );
  }

  if (!selectedFolder) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
        <div className="text-center">
          <Folder className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Select a Folder</h2>
          <p className="text-gray-600 dark:text-gray-400">Choose a folder from the sidebar to start chatting</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-white dark:bg-gray-800 transition-colors duration-200">
      <div className="border-b border-gray-200 dark:border-gray-700 p-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Chat about {selectedFolder.name}
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {fileNames && fileNames.length > 0
            ? `${fileNames.length} files indexed — ask anything about them`
            : 'Ask questions about documents in this folder'}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center py-8">
            <Bot className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400">Start a conversation about your documents</p>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex items-start space-x-3 ${
                message.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              {message.role === 'assistant' && (
                <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center flex-shrink-0">
                  <Bot className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                </div>
              )}

              <div
                className={`max-w-2xl rounded-lg px-4 py-3 ${
                  message.role === 'user'
                    ? 'bg-blue-600 text-white dark:bg-blue-600'
                    : 'bg-gray-100 text-gray-900 dark:bg-gray-700 dark:text-gray-100'
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>

                {message.errorDetail && (
                  <div className="mt-2">
                    <button
                      onClick={() => toggleErrorDetails(message.id)}
                      className="flex items-center text-xs text-red-600 hover:text-red-800 transition-colors"
                    >
                      <AlertTriangle className="w-3 h-3 mr-1" />
                      {expandedErrors.has(message.id) ? (
                        <>Hide details <ChevronUp className="w-3 h-3 ml-1" /></>
                      ) : (
                        <>Show error details <ChevronDown className="w-3 h-3 ml-1" /></>
                      )}
                    </button>
                    {expandedErrors.has(message.id) && (
                      <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-800 font-mono break-all">
                        {message.errorDetail}
                      </div>
                    )}
                  </div>
                )}

                {message.sources && message.sources.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-300 dark:border-gray-600">
                    <p className="text-xs font-medium mb-2 dark:text-gray-300">Sources:</p>
                    <div className="space-y-1">
                      {message.sources.map((source, index) => (
                        <div key={index} className="flex items-center space-x-2">
                          <FileText className="w-3 h-3 text-gray-500 dark:text-gray-400" />
                          <span className="text-xs text-gray-600 dark:text-gray-400">{source.file_name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {message.role === 'user' && (
                <div className="w-8 h-8 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center flex-shrink-0">
                  <User className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                </div>
              )}
            </div>
          ))
        )}

        {isLoading && (
          <div className="flex items-start space-x-3">
            <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center">
              <Bot className="w-4 h-4 text-blue-600 dark:text-blue-400 animate-pulse" />
            </div>
            <div className="bg-gray-100 dark:bg-gray-700 rounded-lg px-4 py-3">
              <div className="flex space-x-2">
                <div className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce delay-100"></div>
                <div className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce delay-200"></div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="border-t border-gray-200 dark:border-gray-700 p-4">
        <div className="flex space-x-3">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Ask about your documents..."
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!inputValue.trim() || isLoading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </form>
    </div>
  );
};

export default ChatInterface;
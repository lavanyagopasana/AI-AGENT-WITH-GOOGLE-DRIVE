import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useDrive } from '../contexts/DriveContext';
import { MessageCircle, Send, Bot, User, FileText, Folder, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { ChatMessage } from '../types';
import { SupabaseService } from '../services/supabaseService';
import { EmbeddingService } from '../services/embeddingService';
import { LLMService } from '../services/llmService';

const ChatInterface: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const { selectedFolder } = useDrive();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [expandedErrors, setExpandedErrors] = useState<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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
    e.preventDefault(); // Prevent page reload
    
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
      
      // Initialize services
      const supabaseService = new SupabaseService();
      const embeddingService = new EmbeddingService();
      const llmService = new LLMService();

      // Step 1: Generate embedding for user query
      console.log('Step 1: Generating embedding for query...');
      const queryEmbedding = await embeddingService.generateEmbedding(inputValue);
      console.log('Embedding generated successfully, dimension:', queryEmbedding.length);

      // Step 2: Search for relevant documents in Supabase
      console.log('Step 2: Searching documents in folder:', selectedFolder.id);
      const relevantChunks = await supabaseService.searchDocuments(
        queryEmbedding,
        selectedFolder.id,
        5
      );
      console.log('Found relevant chunks:', relevantChunks.length);

      if (relevantChunks.length === 0) {
        console.log('No relevant chunks found. Documents may not be processed yet.');
        const aiMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          content: "I cannot find any processed documents in this folder. The documents may still be processing — please wait a moment and try again. If this persists, try re-selecting the folder from the sidebar to trigger document indexing.",
          role: 'assistant',
          timestamp: new Date().toISOString(),
        };
        setMessages(prev => [...prev, aiMessage]);
        setIsLoading(false);
        return;
      }

      // Step 3: Generate response using LLM with context
      console.log('Step 3: Generating LLM response...');
      const context = relevantChunks.map((chunk: any) => 
        `From ${chunk.file_name}:\n${chunk.content}`
      ).join('\n\n---\n\n');
      const aiResponse = await llmService.generateResponse(inputValue, context);

      // Use the relevant chunks directly as sources
      const sources = relevantChunks;

      const aiMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        content: aiResponse,
        role: 'assistant',
        timestamp: new Date().toISOString(),
        sources,
      };

      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error('RAG pipeline error:', error);
      const errorMessage = (error as Error).message || 'Unknown error';
      const errorStack = (error as Error).stack || '';
      console.error('Error message:', errorMessage);
      console.error('Error stack:', errorStack);
      
      let responseMessage = "I encountered an error while processing your request.";
      let errorDetail = errorMessage;
      
      // Provide more specific error messages based on the error
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
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md">
          <Bot className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Welcome to AI Drive Agent</h2>
          <p className="text-gray-600 mb-6">
            Connect your Google Drive to ask questions about your documents using AI.
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-left">
            <h3 className="font-semibold text-blue-900 mb-2">Getting Started:</h3>
            <ol className="text-sm text-blue-800 space-y-1">
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
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Folder className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Select a Folder</h2>
          <p className="text-gray-600">Choose a folder from the sidebar to start chatting</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-white">
      <div className="border-b border-gray-200 p-4">
        <h2 className="text-lg font-semibold text-gray-900">
          Chat about {selectedFolder.name}
        </h2>
        <p className="text-sm text-gray-600">
          Ask questions about documents in this folder
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center py-8">
            <Bot className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">Start a conversation about your documents</p>
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
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <Bot className="w-4 h-4 text-blue-600" />
                </div>
              )}
              
              <div
                className={`max-w-2xl rounded-lg px-4 py-3 ${
                  message.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-900'
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                
                {/* Error details toggle */}
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
                  <div className="mt-3 pt-3 border-t border-gray-300">
                    <p className="text-xs font-medium mb-2">Sources:</p>
                    <div className="space-y-1">
                      {message.sources.map((source, index) => (
                        <div key={index} className="flex items-center space-x-2">
                          <FileText className="w-3 h-3 text-gray-500" />
                          <span className="text-xs text-gray-600">{source.file_name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              
              {message.role === 'user' && (
                <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <User className="w-4 h-4 text-gray-600" />
                </div>
              )}
            </div>
          ))
        )}
        
        {isLoading && (
          <div className="flex items-start space-x-3">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
              <Bot className="w-4 h-4 text-blue-600 animate-pulse" />
            </div>
            <div className="bg-gray-100 rounded-lg px-4 py-3">
              <div className="flex space-x-2">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200"></div>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="border-t border-gray-200 p-4">
        <div className="flex space-x-3">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Ask about your documents..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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

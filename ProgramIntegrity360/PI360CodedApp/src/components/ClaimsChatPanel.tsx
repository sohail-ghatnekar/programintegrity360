/**
 * ClaimsChatPanel - A slide-in drawer that embeds a conversational agent
 * scoped to the currently selected claim. The agent is pre-seeded with all
 * claim data so it can answer caseworker questions immediately.
 */

import { useState, useRef, useEffect, useCallback, memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useClaimsAgent, type AgentMessage } from '../hooks/useClaimsAgent';
import type { ProcessedClaim } from '../hooks/useClaims';

interface ClaimsChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  claim: ProcessedClaim | null;
}

// ─── Message bubble ───

const MessageBubble = memo(function MessageBubble({ message }: { message: AgentMessage }) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex gap-3 px-4 py-3 ${isUser ? '' : 'bg-gray-50'}`}>
      {/* Avatar */}
      <div className={`w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-semibold mt-0.5 ${
        isUser ? 'bg-blue-500' : 'bg-purple-600'
      }`}>
        {isUser ? 'U' : 'AI'}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-gray-500 mb-1">
          {isUser ? 'You' : 'Claims Assistant'}
        </p>

        {message.isStreaming && !message.content ? (
          <div className="flex gap-1 items-center h-5">
            <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        ) : isUser ? (
          <p className="text-sm text-gray-800 whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="prose prose-sm max-w-none text-gray-800 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {message.content}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
});

// ─── Chat input ───

function ChatInput({
  onSubmit,
  isDisabled,
}: {
  onSubmit: (text: string) => void;
  isDisabled: boolean;
}) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
    }
  }, [value]);

  const handleSubmit = useCallback(() => {
    const text = value.trim();
    if (!text || isDisabled) return;
    onSubmit(text);
    setValue('');
  }, [value, isDisabled, onSubmit]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }, [handleSubmit]);

  return (
    <div className="border-t border-gray-200 p-3 bg-white">
      <div className="flex gap-2 items-end bg-gray-50 border border-gray-200 rounded-xl focus-within:border-purple-400 focus-within:ring-1 focus-within:ring-purple-200 transition-all">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about this claim..."
          rows={1}
          disabled={isDisabled}
          className="flex-1 bg-transparent px-3 py-2.5 text-sm resize-none focus:outline-none disabled:opacity-50 max-h-40"
        />
        <button
          onClick={handleSubmit}
          disabled={!value.trim() || isDisabled}
          className="mb-2 mr-2 p-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-shrink-0"
          title="Send (Enter)"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
          </svg>
        </button>
      </div>
      <p className="text-xs text-gray-400 mt-1.5 text-center">Enter to send · Shift+Enter for new line</p>
    </div>
  );
}

// ─── Main panel ───

export function ClaimsChatPanel({ isOpen, onClose, claim }: ClaimsChatPanelProps) {
  const { messages, isStreaming, isInitializing, sendMessage, error } = useClaimsAgent(
    claim,
    isOpen,
  );

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Trap Escape key to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  return (
    <>
      {/* Backdrop (only on mobile / narrower screens) */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-30 lg:hidden"
          onClick={onClose}
          aria-hidden
        />
      )}

      {/* Slide-in drawer */}
      <div
        className={`fixed top-0 right-0 h-full w-[420px] max-w-full bg-white shadow-2xl border-l border-gray-200 z-40 flex flex-col transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        aria-label="Claims Assistant"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-indigo-50 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-white">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Claims Assistant</p>
              {claim && (
                <p className="text-xs text-gray-500 truncate max-w-[260px]">{claim.applicantName}</p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            title="Close (Esc)"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {/* Error banner */}
          {error && (
            <div className="mx-4 mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-start gap-2">
              <svg className="w-4 h-4 flex-shrink-0 mt-0.5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {/* Initializing state */}
          {isInitializing && messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-64 text-center px-6">
              <div className="w-10 h-10 rounded-full border-3 border-purple-200 border-t-purple-600 animate-spin mb-3" style={{ borderWidth: '3px' }} />
              <p className="text-sm text-gray-600 font-medium">Connecting to agent...</p>
              <p className="text-xs text-gray-400 mt-1">Loading claim context</p>
            </div>
          )}

          {/* Messages */}
          {messages.length > 0 && (
            <div className="py-2">
              {messages.map(msg => (
                <MessageBubble key={msg.id} message={msg} />
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}

          {/* Empty state (after init, no messages yet) */}
          {!isInitializing && messages.length === 0 && !error && (
            <div className="flex flex-col items-center justify-center h-64 text-center px-6">
              <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center mb-3">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <p className="text-sm font-medium text-gray-700">Ask about this claim</p>
              <p className="text-xs text-gray-400 mt-1">The agent has access to all case data</p>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="flex-shrink-0">
          {isStreaming && (
            <div className="px-4 py-1.5 flex items-center gap-1.5 bg-purple-50 border-t border-purple-100">
              <div className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-pulse" />
              <span className="text-xs text-purple-600 font-medium">Agent is responding...</span>
            </div>
          )}
          <ChatInput
            onSubmit={sendMessage}
            isDisabled={isInitializing || isStreaming || !claim}
          />
        </div>
      </div>
    </>
  );
}

/**
 * useClaimsAgent - Manages a conversational agent session scoped to a specific claim.
 *
 * On open: loads the configured agent, creates a fresh conversation, and silently
 * seeds it with the claim data so the agent can answer questions accurately.
 * Only the agent's responses (not the hidden context message) are shown to the user.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import {
  ConversationalAgent,
  MessageRole,
  LogLevel,
  type SessionStream,
  type CompletedContentPart,
} from '@uipath/uipath-typescript/conversational-agent';
// eslint-disable-next-line @typescript-eslint/no-deprecated
import { UiPath } from '@uipath/uipath-typescript';
import type { ProcessedClaim } from './useClaims';
import { getUiPathAuthSetup } from '../config/uipath';
import { useAuth } from './useAuth';
import { buildClaimContextPromptFromClaim } from '../lib/claimContext';
import { buildAgentPromptFromClaimContext, fetchClaimConversationContext } from '../services/claimContextApi';

// Build an agent-specific SDK config that uses the real platform URL as baseUrl.
// This is required because the main app SDK uses window.location.origin so that
// HTTP API calls route through the Vite dev proxy (no CORS), but the
// ConversationalAgent WebSocket must connect to the actual platform URL.
// The instance is created lazily inside initialize() so it reads the OAuth token
// from sessionStorage only after the user has already authenticated.
const authSetup = getUiPathAuthSetup();
const AGENT_SDK_CONFIG = {
  ...authSetup.config,
  baseUrl: authSetup.platformBaseUrl,
};

export interface AgentMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
}

const AGENT_ID_ENV = import.meta.env.VITE_CLAIMS_AGENT_ID;

export function useClaimsAgent(
  claim: ProcessedClaim | null,
  isOpen: boolean,
) {
  const { sdk } = useAuth();
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sessionRef = useRef<SessionStream | null>(null);
  const conversationRef = useRef<any>(null);
  const exchangeAssistantIdRef = useRef<Map<string, string>>(new Map());
  const currentClaimIdRef = useRef<string | null>(null);

  // ─── Message update helper ───

  const updateMessage = (id: string, updates: Partial<AgentMessage>) => {
    setMessages(prev => prev.map(m => (m.id === id ? { ...m, ...updates } : m)));
  };

  // ─── Session teardown ───

  const endSession = useCallback(() => {
    if (conversationRef.current) {
      try { conversationRef.current.endSession(); } catch { /* ignore */ }
      conversationRef.current = null;
    }
    sessionRef.current = null;
    currentClaimIdRef.current = null;
    exchangeAssistantIdRef.current.clear();
  }, []);

  // ─── Session setup ───

  const initialize = useCallback(async () => {
    if (!claim) return;
    if (currentClaimIdRef.current === claim.id) return; // already initialized for this claim

    endSession();
    setMessages([]);
    setError(null);
    setIsInitializing(true);

    try {
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      const agentSdk = new UiPath(AGENT_SDK_CONFIG);
      console.log('[useClaimsAgent] agentSdk authenticated:', agentSdk.isAuthenticated());
      const conversationalAgent = new ConversationalAgent(agentSdk as any);

      // Load agents and find the target agent
      const agents = await conversationalAgent.getAll();
      console.log('[useClaimsAgent] agents found:', JSON.stringify(agents.map(a => ({ id: a.id, name: (a as any).name || (a as any).label, status: (a as any).status || (a as any).state }))));
      if (agents.length === 0) {
        setError('No conversational agents found in your tenant.');
        return;
      }

      let targetAgent = agents[0];
      if (AGENT_ID_ENV) {
        const agentIdNum = parseInt(AGENT_ID_ENV, 10);
        const found = agents.find(a => a.id === agentIdNum);
        if (found) targetAgent = found;
      }

      // Create a fresh conversation for this claim visit
      const conversation = await targetAgent.conversations.create({ autogenerateLabel: true });
      conversationRef.current = conversation;
      currentClaimIdRef.current = claim.id;

      // Start WebSocket session
      const session = conversation.startSession({ echo: true, logLevel: LogLevel.Debug });

      // Handle all exchange events (both from echo and future user messages)
      session.onExchangeStart((exchange) => {
        const assistantId = exchangeAssistantIdRef.current.get(exchange.exchangeId);
        if (!assistantId) return;

        setIsStreaming(true);

        exchange.onMessageStart((message) => {
          if (!message.isAssistant) return;

          const contentState = { fullContent: '' };

          message.onContentPartStart((part) => {
            if (part.isText || part.isMarkdown) {
              part.onChunk((chunk: any) => {
                contentState.fullContent += chunk.data || '';
                updateMessage(assistantId, { content: contentState.fullContent });
              });
              part.onCompleted((_completed: CompletedContentPart) => {
                updateMessage(assistantId, { content: contentState.fullContent, isStreaming: false });
              });
            }
          });
        });

        exchange.onExchangeEnd(() => {
          exchangeAssistantIdRef.current.delete(exchange.exchangeId);
          setIsStreaming(false);
        });

        exchange.onErrorStart((err: any) => {
          exchangeAssistantIdRef.current.delete(exchange.exchangeId);
          setError(err.message || 'Exchange error');
          setIsStreaming(false);
          setMessages(prev => prev.filter(m => m.id !== assistantId || m.content.length > 0));
        });
      });

      // Wait for session to be established
      await new Promise<void>((resolve, reject) => {
        session.onSessionStarted(() => {
          sessionRef.current = session;
          resolve();
        });
        session.onSessionEnd(() => {
          sessionRef.current = null;
          setIsStreaming(false);
        });
        session.onErrorStart((err: any) => {
          console.error('[useClaimsAgent] session error:', JSON.stringify(err));
          const msg = err.message || err.errorId || 'Session failed to start';
          if (!sessionRef.current) {
            reject(new Error(msg));
          } else {
            setError(msg);
          }
          setIsStreaming(false);
        });
      });

      // ─── Silently send the claim context as the first exchange ───
      // The user message is NOT added to the messages state — only the assistant's
      // greeting/acknowledgement response will appear in the chat.
      const contextExchangeId = `exchange-ctx-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
      const contextAssistantId = `assistant-ctx-${Date.now()}`;

      exchangeAssistantIdRef.current.set(contextExchangeId, contextAssistantId);

      // Add the assistant placeholder so the streaming response renders immediately
      setMessages([{
        id: contextAssistantId,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        isStreaming: true,
      }]);
      setIsStreaming(true);

      let contextPrompt = buildClaimContextPromptFromClaim(claim);
      const accessToken = sdk.getToken() || agentSdk.getToken();

      if (accessToken) {
        try {
          const claimContext = await fetchClaimConversationContext(claim.id, accessToken);
          contextPrompt = buildAgentPromptFromClaimContext(claimContext);
        } catch (contextError) {
          console.warn('[useClaimsAgent] failed to load API claim context, falling back to local prompt:', contextError);
        }
      }

      const ctxExchange = session.startExchange({ exchangeId: contextExchangeId });
      const ctxMessage = ctxExchange.startMessage({ role: MessageRole.User });
      await ctxMessage.sendContentPart({ data: contextPrompt });
      ctxMessage.sendMessageEnd();

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initialize agent');
    } finally {
      setIsInitializing(false);
    }
  }, [claim, endSession, sdk]);

  // ─── Lifecycle: initialize when opened, clean up when closed ───

  useEffect(() => {
    if (isOpen && claim) {
      initialize();
    } else if (!isOpen) {
      endSession();
      setMessages([]);
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, claim?.id]);

  // ─── Send a user message ───

  const sendMessage = useCallback(async (content: string) => {
    if (!sessionRef.current || !content.trim() || isStreaming) return;

    setError(null);

    // Add user message to the UI
    setMessages(prev => [...prev, {
      id: `user-${Date.now()}`,
      role: 'user',
      content: content.trim(),
      timestamp: new Date(),
    }]);

    // Add assistant placeholder
    const assistantId = `assistant-${Date.now()}`;
    setMessages(prev => [...prev, {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isStreaming: true,
    }]);
    setIsStreaming(true);

    const exchangeId = `exchange-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
    exchangeAssistantIdRef.current.set(exchangeId, assistantId);

    const exchange = sessionRef.current.startExchange({ exchangeId });
    const message = exchange.startMessage({ role: MessageRole.User });
    await message.sendContentPart({ data: content });
    message.sendMessageEnd();
  }, [isStreaming]);

  return { messages, isStreaming, isInitializing, sendMessage, error };
}

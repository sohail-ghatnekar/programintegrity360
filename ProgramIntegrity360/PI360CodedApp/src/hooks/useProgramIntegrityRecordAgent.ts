import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ConversationalAgent,
  LogLevel,
  MessageRole,
  type CompletedContentPart,
  type SessionStream,
} from '@uipath/uipath-typescript/conversational-agent';
// eslint-disable-next-line @typescript-eslint/no-deprecated
import { UiPath } from '@uipath/uipath-typescript';
import { getUiPathAuthSetup } from '../config/uipath';
import { useAuth } from './useAuth';

export interface RecordAssistantMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
}

export type ProgramIntegrityRecordContext = Record<string, unknown>;

const authSetup = getUiPathAuthSetup();
const AGENT_SDK_CONFIG = {
  ...authSetup.config,
  baseUrl: authSetup.platformBaseUrl,
};
const RECORD_AGENT_ID_ENV = import.meta.env.VITE_PI360_RECORD_AGENT_ID;
const RECORD_AGENT_NAME_ENV = import.meta.env.VITE_PI360_RECORD_AGENT_NAME || 'PI360RecordConversationAgent';

function getRecordKey(recordContext: ProgramIntegrityRecordContext | null): string | null {
  const caseRecord = recordContext?.caseRecord as { id?: unknown } | undefined;
  return typeof caseRecord?.id === 'string' ? caseRecord.id : null;
}

function buildRecordContextPrompt(recordContext: ProgramIntegrityRecordContext): string {
  return [
    'You are reviewing a Program Integrity 360 case record in the coded app.',
    'Use the JSON below as the source of truth for this conversation.',
    'The same JSON is rendered beside the chat in an iframe for the caseworker.',
    '',
    '=== RECORD CONTEXT JSON ===',
    JSON.stringify(recordContext, null, 2),
    '',
    'Answer from the record. If the caseworker asks to create or complete a task, wait for the host coded app task-tool result before claiming the action happened.',
  ].join('\n');
}

export function useProgramIntegrityRecordAgent(
  recordContext: ProgramIntegrityRecordContext | null,
  isOpen: boolean,
) {
  const { isAuthenticated } = useAuth();
  const [messages, setMessages] = useState<RecordAssistantMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sessionRef = useRef<SessionStream | null>(null);
  const conversationRef = useRef<any>(null);
  const exchangeAssistantIdRef = useRef<Map<string, string>>(new Map());
  const currentRecordKeyRef = useRef<string | null>(null);

  const updateMessage = useCallback((id: string, updates: Partial<RecordAssistantMessage>) => {
    setMessages(prev => prev.map(message => (message.id === id ? { ...message, ...updates } : message)));
  }, []);

  const endSession = useCallback(() => {
    if (conversationRef.current) {
      try {
        conversationRef.current.endSession();
      } catch {
        // Session teardown is best-effort.
      }
      conversationRef.current = null;
    }
    sessionRef.current = null;
    currentRecordKeyRef.current = null;
    exchangeAssistantIdRef.current.clear();
  }, []);

  const initialize = useCallback(async () => {
    if (!recordContext || !isAuthenticated) return;

    const recordKey = getRecordKey(recordContext) || 'program-integrity-record';
    if (currentRecordKeyRef.current === recordKey) return;

    endSession();
    setMessages([]);
    setError(null);
    setIsInitializing(true);

    try {
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      const agentSdk = new UiPath(AGENT_SDK_CONFIG);
      const conversationalAgent = new ConversationalAgent(agentSdk as any);
      const agents = await conversationalAgent.getAll();
      const targetAgent = (() => {
        if (RECORD_AGENT_ID_ENV) {
          const agentId = Number(RECORD_AGENT_ID_ENV);
          const byId = agents.find(agent => agent.id === agentId);
          if (byId) return byId;
        }

        return agents.find(agent => {
          const candidate = agent as any;
          return candidate.name === RECORD_AGENT_NAME_ENV || candidate.label === RECORD_AGENT_NAME_ENV;
        }) || null;
      })();

      if (!targetAgent) {
        setError(`Conversational agent '${RECORD_AGENT_NAME_ENV}' was not found in this tenant.`);
        return;
      }

      const conversation = await targetAgent.conversations.create({ autogenerateLabel: true });
      conversationRef.current = conversation;
      currentRecordKeyRef.current = recordKey;

      const session = conversation.startSession({ echo: true, logLevel: LogLevel.Debug });

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

        exchange.onErrorStart((streamError: any) => {
          exchangeAssistantIdRef.current.delete(exchange.exchangeId);
          setError(streamError.message || 'Exchange error');
          setIsStreaming(false);
          setMessages(prev => prev.filter(message => message.id !== assistantId || message.content.length > 0));
        });
      });

      await new Promise<void>((resolve, reject) => {
        session.onSessionStarted(() => {
          sessionRef.current = session;
          resolve();
        });
        session.onSessionEnd(() => {
          sessionRef.current = null;
          setIsStreaming(false);
        });
        session.onErrorStart((streamError: any) => {
          const message = streamError.message || streamError.errorId || 'Session failed to start';
          if (!sessionRef.current) {
            reject(new Error(message));
          } else {
            setError(message);
          }
          setIsStreaming(false);
        });
      });

      const exchangeId = `exchange-record-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
      const assistantId = `assistant-record-${Date.now()}`;
      exchangeAssistantIdRef.current.set(exchangeId, assistantId);

      setMessages([{
        id: assistantId,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        isStreaming: true,
      }]);
      setIsStreaming(true);

      const exchange = session.startExchange({ exchangeId });
      const message = exchange.startMessage({ role: MessageRole.User });
      await message.sendContentPart({ data: buildRecordContextPrompt(recordContext) });
      message.sendMessageEnd();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initialize record assistant');
    } finally {
      setIsInitializing(false);
    }
  }, [endSession, isAuthenticated, recordContext, updateMessage]);

  useEffect(() => {
    if (isOpen && recordContext && isAuthenticated) {
      void initialize();
    } else if (!isOpen) {
      endSession();
      setMessages([]);
      setError(null);
    }
  }, [endSession, initialize, isAuthenticated, isOpen, recordContext]);

  const sendMessage = useCallback(async (content: string) => {
    if (!sessionRef.current || !content.trim() || isStreaming) return;

    setError(null);
    setMessages(prev => [...prev, {
      id: `user-${Date.now()}`,
      role: 'user',
      content: content.trim(),
      timestamp: new Date(),
    }]);

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

  return {
    messages,
    isStreaming,
    isInitializing,
    sendMessage,
    error,
    isAuthenticated,
  };
}

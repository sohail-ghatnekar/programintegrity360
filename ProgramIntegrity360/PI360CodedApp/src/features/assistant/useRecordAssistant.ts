import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ConversationalAgent,
  MessageRole,
  type AgentGetResponse,
  type ConversationGetResponse,
  type SessionStream,
} from '@uipath/uipath-typescript/conversational-agent';
import type { UiPath } from '@uipath/uipath-typescript/core';
import { getUiPathRuntimeConfig } from '../../config/uipath';
import { useAuth } from '../../hooks/useAuth';
import { createActivityEvent } from '../activity/activityLog';
import type { ActivityEvent, CaseWorkspaceSnapshot } from '../cases/types';

export type AssistantState = 'idle' | 'connecting' | 'live' | 'demo' | 'error';

export interface RecordAssistantMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  isStreaming?: boolean;
  handoffTaskId?: number;
}

export interface CaseGrounding {
  caseId: string;
  currentStage: {
    key: string;
    label: string;
    status: string;
  };
  signals: Array<{
    id: string;
    name: string;
    severity: string;
    result: string;
    citations: readonly string[];
  }>;
  evidence: Array<{
    id: string;
    type: string;
    source: string;
    confidence: number;
    status: string;
    summary: string;
  }>;
  decisions: Array<{
    id: string;
    timestamp: string;
    status: string;
    summary: string;
    correlationId: string;
  }>;
  tasks: Array<{
    id: number;
    title: string;
    status: string;
    stage: string;
    priority: string;
    assignee: string;
    gated: boolean;
    correlationId: string;
  }>;
  correlationIds: string[];
}

export interface DemoAssistantResponse {
  content: string;
  handoffTaskId?: number;
}

export interface RecordAssistantController {
  state: AssistantState;
  messages: readonly RecordAssistantMessage[];
  activityEvents: readonly ActivityEvent[];
  error: string | null;
  isSending: boolean;
  sendMessage: (content: string) => Promise<void>;
  useDemoFallback: () => void;
}

type DiscoverableAgent = Pick<AgentGetResponse, 'id' | 'name'>;

const runtimeConfig = getUiPathRuntimeConfig();
const DEFAULT_AGENT_NAME = 'PI360RecordConversationAgent';

function nowIso(): string {
  return new Date().toISOString();
}

function randomId(prefix: string): string {
  const suffix = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${suffix}`;
}

export function findConfiguredAgent<T extends DiscoverableAgent>(
  agents: readonly T[],
  configuredName: string,
): T | null {
  return agents.find((agent) => agent.name === configuredName) ?? null;
}

function eventCorrelationId(event: CaseWorkspaceSnapshot['executionTimeline'][number]): string {
  if (event.correlationId) return event.correlationId;
  return createActivityEvent({
    id: event.id,
    timestamp: event.timestamp,
    source: event.source ?? 'maestro',
    severity: event.severity ?? 'info',
    status: event.status ?? 'recorded',
    summary: event.summary ?? 'Case activity recorded.',
  }).correlationId;
}

export function buildCaseGrounding(workspace: CaseWorkspaceSnapshot): CaseGrounding {
  const currentStage = workspace.stages.find((stage) => stage.status === 'active')
    ?? workspace.stages.find((stage) => stage.status === 'waiting')
    ?? workspace.stages.find((stage) => stage.status === 'completed')
    ?? workspace.stages[0];
  const decisions = workspace.executionTimeline.filter((event) => (
    event.status.toLowerCase() === 'decision' || event.status.toLowerCase() === 'approval'
  ));
  const tasks = workspace.caseTasks.map((task) => ({
    id: task.id,
    title: task.title,
    status: task.status,
    stage: task.stageLabel,
    priority: task.priority,
    assignee: task.assignee,
    gated: task.gated,
    correlationId: createActivityEvent({
      id: `task:${task.id}:${task.status}`,
      timestamp: task.createdAt,
      source: 'task',
      severity: task.status === 'Unassigned' ? 'warning' : 'info',
      status: task.status,
      summary: `Task ${task.id} is ${task.status}.`,
      caseId: workspace.case.id,
      taskId: task.id,
    }).correlationId,
  }));
  const decisionSummaries = decisions.map((event) => ({
    id: event.id,
    timestamp: event.timestamp,
    status: event.status,
    summary: event.summary,
    correlationId: eventCorrelationId(event),
  }));
  const correlationIds = [
    ...workspace.executionTimeline.map(eventCorrelationId),
    ...tasks.map((task) => task.correlationId),
  ];

  return {
    caseId: workspace.case.id,
    currentStage: currentStage
      ? { key: currentStage.key, label: currentStage.label, status: currentStage.status }
      : { key: 'unknown', label: workspace.case.stage, status: 'unknown' },
    signals: workspace.riskSignals.slice(0, 8).map((signal) => ({
      id: signal.id,
      name: signal.name,
      severity: signal.severity,
      result: signal.result,
      citations: signal.citations,
    })),
    evidence: workspace.evidenceDocuments.slice(0, 8).map((document) => ({
      id: document.id,
      type: document.type,
      source: document.source,
      confidence: document.confidence,
      status: document.status,
      summary: document.note,
    })),
    decisions: decisionSummaries,
    tasks,
    correlationIds: [...new Set(correlationIds)],
  };
}

function nextTask(grounding: CaseGrounding) {
  return [...grounding.tasks]
    .filter((task) => task.status !== 'Completed')
    .sort((left, right) => (
      Number(left.gated) - Number(right.gated)
      || Number(left.status !== 'Pending') - Number(right.status !== 'Pending')
      || left.id - right.id
    ))[0];
}

export function createDemoAssistantResponse(
  prompt: string,
  grounding: CaseGrounding,
): DemoAssistantResponse {
  const normalized = prompt.trim().toLowerCase();
  const task = nextTask(grounding);
  const taskRequested = /\b(next|open|current|review)\b.*\btask\b|\btask\b.*\b(next|open|current|review)\b/.test(normalized);
  const completionRequested = /\b(complete|finish|resolve|close)\b.*\btask\b/.test(normalized);

  if (completionRequested) {
    if (!task) {
      return { content: '**Demo data** No open selected-case task is available. This assistant cannot complete tasks; completion must be confirmed in Action Center.' };
    }

    return {
      content: `**Demo data** I cannot complete Task ${task.id}. Use the app handoff below to open its real Action Center workflow; only the Tasks API confirmation is treated as completion.`,
      handoffTaskId: task.id,
    };
  }

  if (taskRequested) {
    if (!task) {
      return { content: '**Demo data** No open selected-case task is available. No task state was changed.' };
    }

    return {
      content: `**Demo data** Task ${task.id}, "${task.title}", is the next open selected-case task (${task.status}, ${task.priority}). This is an app handoff to Action Center, not an agent tool call.`,
      handoffTaskId: task.id,
    };
  }

  if (/\b(stage|posture|status)\b/.test(normalized)) {
    return {
      content: `**Demo data** ${grounding.caseId} is in **${grounding.currentStage.label}** with stage status **${grounding.currentStage.status}**. ${grounding.tasks.filter((item) => item.status !== 'Completed').length} selected-case tasks remain open.`,
    };
  }

  if (/\b(evidence|signal|risk|finding)\b/.test(normalized)) {
    const highSignals = grounding.signals.filter((signal) => signal.severity === 'High');
    const reviewEvidence = grounding.evidence.filter((item) => item.status.toLowerCase().includes('review'));
    return {
      content: `**Demo data** The compact case context contains ${grounding.signals.length} signals (${highSignals.length} High) and ${grounding.evidence.length} evidence summaries. ${reviewEvidence.length} evidence item${reviewEvidence.length === 1 ? '' : 's'} remain marked for review.`,
    };
  }

  if (/\b(decision|approval|disposition)\b/.test(normalized)) {
    const latest = grounding.decisions.at(-1);
    return {
      content: latest
        ? `**Demo data** The latest recorded decision event is ${latest.status}: ${latest.summary} Correlation ID: ${latest.correlationId}.`
        : '**Demo data** No decision or approval event is present in the selected-case context.',
    };
  }

  return {
    content: `**Demo data** ${grounding.caseId} is in ${grounding.currentStage.label}. I can summarize its signals, evidence, decisions, or identify the next selected-case task without changing backend state.`,
  };
}

function buildGroundingPrompt(grounding: CaseGrounding): string {
  return [
    'Selected-case context for this session. Treat this compact redacted JSON as the source of truth.',
    'Do not claim a task tool call or completion unless the app provides an actual backend result.',
    'The deployed agent currently has no app-authorized task tool; task navigation is an app handoff.',
    JSON.stringify(grounding),
  ].join('\n\n');
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim() ? error.message : fallback;
}

export function useRecordAssistant(
  workspace: CaseWorkspaceSnapshot | null,
  open: boolean,
): RecordAssistantController {
  const { isAuthenticated, sdk } = useAuth();
  const [state, setState] = useState<AssistantState>('idle');
  const [messages, setMessages] = useState<RecordAssistantMessage[]>([]);
  const [activityEvents, setActivityEvents] = useState<ActivityEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const conversationRef = useRef<ConversationGetResponse | null>(null);
  const sessionRef = useRef<SessionStream | null>(null);
  const pendingAssistantIds = useRef(new Map<string, string>());
  const generationRef = useRef(0);
  const selectedCaseRef = useRef<string | null>(null);
  const grounding = useMemo(() => workspace ? buildCaseGrounding(workspace) : null, [workspace]);
  const groundingRef = useRef(grounding);
  groundingRef.current = grounding;
  const caseId = workspace?.case.id ?? null;
  const dataSource = workspace?.dataSource ?? null;
  const agentName = runtimeConfig.recordAgentName || DEFAULT_AGENT_NAME;

  const appendActivity = useCallback((input: Parameters<typeof createActivityEvent>[0]) => {
    const next = createActivityEvent(input);
    setActivityEvents((current) => (
      current.some((event) => event.source === next.source && event.id === next.id)
        ? current.map((event) => event.source === next.source && event.id === next.id ? next : event)
        : [...current, next]
    ));
  }, []);

  const endSession = useCallback(() => {
    generationRef.current += 1;
    try {
      conversationRef.current?.endSession();
    } catch {
      // Session teardown is best-effort and must not block case navigation.
    }
    conversationRef.current = null;
    sessionRef.current = null;
    pendingAssistantIds.current.clear();
    setIsSending(false);
  }, []);

  const updateMessage = useCallback((id: string, updates: Partial<RecordAssistantMessage>) => {
    setMessages((current) => current.map((message) => (
      message.id === id ? { ...message, ...updates } : message
    )));
  }, []);

  const attachSessionHandlers = useCallback((session: SessionStream) => {
    session.onExchangeStart((exchange) => {
      let assistantId = pendingAssistantIds.current.get(exchange.exchangeId);
      if (!assistantId) {
        assistantId = randomId('assistant');
        setMessages((current) => [...current, {
          id: assistantId as string,
          role: 'assistant',
          content: '',
          timestamp: nowIso(),
          isStreaming: true,
        }]);
      }

      const resolvedAssistantId = assistantId;
      let fullContent = '';
      exchange.onMessageStart((message) => {
        if (!message.isAssistant) return;

        message.onContentPartStart((part) => {
          if (!part.isText && !part.isMarkdown) return;
          part.onChunk((chunk) => {
            fullContent += chunk.data ?? '';
            updateMessage(resolvedAssistantId, { content: fullContent, isStreaming: true });
          });
          part.onCompleted(() => {
            updateMessage(resolvedAssistantId, { content: fullContent, isStreaming: false });
          });
        });

        message.onToolCallStart((toolCall) => {
          appendActivity({
            id: `agent-tool:${toolCall.toolCallId}`,
            timestamp: nowIso(),
            source: 'agent',
            severity: 'warning',
            status: 'tool-call-observed',
            summary: `Agent emitted tool call ${toolCall.startEvent.toolName}. No task result was inferred by the app.`,
            caseId: caseId ?? undefined,
          });
        });
      });
      exchange.onExchangeEnd(() => {
        pendingAssistantIds.current.delete(exchange.exchangeId);
        updateMessage(resolvedAssistantId, { isStreaming: false });
        setIsSending(false);
        appendActivity({
          id: `agent-response:${exchange.exchangeId}`,
          timestamp: nowIso(),
          source: 'agent',
          severity: 'info',
          status: 'response-received',
          summary: 'Live conversational-agent response received.',
          caseId: caseId ?? undefined,
        });
      });
    });
  }, [appendActivity, caseId, updateMessage]);

  const sendLiveMessage = useCallback(async (content: string, showUser: boolean, handoffTaskId?: number) => {
    const session = sessionRef.current;
    if (!session) throw new Error('The live assistant session is not connected.');

    const exchangeId = randomId('exchange');
    const assistantId = randomId('assistant');
    pendingAssistantIds.current.set(exchangeId, assistantId);
    if (showUser) {
      setMessages((current) => [...current, {
        id: randomId('user'),
        role: 'user',
        content,
        timestamp: nowIso(),
      }]);
    }
    setMessages((current) => [...current, {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: nowIso(),
      isStreaming: true,
      handoffTaskId,
    }]);
    setIsSending(true);

    const exchange = session.startExchange({ exchangeId });
    await exchange.sendMessageWithContentPart({ data: content, role: MessageRole.User });
  }, []);

  useEffect(() => {
    endSession();
    const selectedGrounding = groundingRef.current;
    const caseChanged = selectedCaseRef.current !== caseId;
    if (caseChanged) {
      selectedCaseRef.current = caseId;
      setMessages([]);
      setActivityEvents([]);
    } else if (open) {
      setMessages([]);
    }
    setError(null);

    if (!open || !caseId || !selectedGrounding) {
      setState('idle');
      return;
    }

    if (dataSource === 'demo') {
      setState('demo');
      appendActivity({
        id: `fallback:${caseId}`,
        timestamp: nowIso(),
        source: 'app',
        severity: 'warning',
        status: 'demo-fallback-active',
        summary: 'Deterministic assistant fallback activated and labeled Demo data.',
        caseId: caseId ?? undefined,
      });
      return;
    }

    if (!isAuthenticated) {
      setState('error');
      setError('Connect to UiPath to use the live record assistant.');
      return;
    }

    const generation = generationRef.current;
    let cancelled = false;
    setState('connecting');
    appendActivity({
      id: `agent-connecting:${caseId}`,
      timestamp: nowIso(),
      source: 'agent',
      severity: 'info',
      status: 'connecting',
      summary: `Connecting to ${agentName}.`,
      caseId: caseId ?? undefined,
    });

    const initialize = async () => {
      try {
        const service = new ConversationalAgent(sdk as UiPath);
        service.onConnectionStatusChanged((
          connectionStatus: 'Disconnected' | 'Connecting' | 'Connected',
          connectionError: Error | null,
        ) => {
          if (cancelled || generation !== generationRef.current) return;
          if (connectionStatus === 'Connecting') setState('connecting');
          if (connectionError) {
            setState('error');
            setError(connectionError.message);
          }
        });
        const agents = await service.getAll(runtimeConfig.folderId ?? undefined);
        const agent = findConfiguredAgent(agents, agentName);
        if (!agent) throw new Error(`Conversational agent '${agentName}' was not found in the configured folder.`);

        const conversation = await agent.conversations.create({
          label: `PI360 ${selectedGrounding.caseId}`,
          autogenerateLabel: false,
          traceId: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : undefined,
        });
        if (cancelled || generation !== generationRef.current) {
          conversation.endSession();
          return;
        }
        conversationRef.current = conversation;
        const session = conversation.startSession({ echo: false });
        sessionRef.current = session;
        attachSessionHandlers(session);

        await new Promise<void>((resolve, reject) => {
          let started = false;
          session.onSessionStarted(() => {
            started = true;
            resolve();
          });
          session.onErrorStart((sessionError) => {
            const nextError = new Error(sessionError.message || sessionError.errorId || 'Agent session failed.');
            if (!started) reject(nextError);
            else {
              setState('error');
              setError(nextError.message);
              setIsSending(false);
            }
          });
          session.onSessionEnd(() => {
            sessionRef.current = null;
            setIsSending(false);
            if (!cancelled && generation === generationRef.current) {
              setState('error');
              setError('The live assistant session ended. Reopen the assistant to start a new session.');
            }
          });
        });

        if (cancelled || generation !== generationRef.current) return;
        setState('live');
        appendActivity({
          id: `agent-connected:${caseId}`,
          timestamp: nowIso(),
          source: 'agent',
          severity: 'info',
          status: 'connected',
          summary: `${agentName} session connected.`,
          caseId: caseId ?? undefined,
        });
        await sendLiveMessage(buildGroundingPrompt(selectedGrounding), false);
      } catch (caught) {
        if (cancelled || generation !== generationRef.current) return;
        const message = errorMessage(caught, 'Unable to connect to the live record assistant.');
        setState('error');
        setError(message);
        setIsSending(false);
        appendActivity({
          id: `agent-error:${caseId}`,
          timestamp: nowIso(),
          source: 'agent',
          severity: 'error',
          status: 'connection-error',
          summary: message,
          caseId: caseId ?? undefined,
        });
      }
    };

    void initialize();
    return () => {
      cancelled = true;
      endSession();
    };
  }, [agentName, appendActivity, attachSessionHandlers, caseId, dataSource, endSession, isAuthenticated, open, sdk, sendLiveMessage]);

  const useDemoFallback = useCallback(() => {
    endSession();
    setMessages([]);
    setError(null);
    setState('demo');
    appendActivity({
      id: `fallback:${caseId}`,
      timestamp: nowIso(),
      source: 'app',
      severity: 'warning',
      status: 'demo-fallback-active',
      summary: 'Deterministic assistant fallback activated and labeled Demo data.',
      caseId: caseId ?? undefined,
    });
  }, [appendActivity, caseId, endSession]);

  const sendMessage = useCallback(async (content: string) => {
    const normalized = content.trim();
    if (!normalized || isSending || !grounding) return;
    setError(null);
    appendActivity({
      id: randomId('user-message'),
      timestamp: nowIso(),
      source: 'user',
      severity: 'info',
      status: 'message-sent',
      summary: 'Caseworker sent a record-assistant message.',
      caseId: grounding.caseId,
    });

    if (state === 'demo') {
      const response = createDemoAssistantResponse(normalized, grounding);
      setMessages((current) => [...current,
        { id: randomId('user'), role: 'user', content: normalized, timestamp: nowIso() },
        {
          id: randomId('assistant'),
          role: 'assistant',
          content: response.content,
          timestamp: nowIso(),
          handoffTaskId: response.handoffTaskId,
        },
      ]);
      appendActivity({
        id: randomId('demo-response'),
        timestamp: nowIso(),
        source: 'app',
        severity: 'warning',
        status: response.handoffTaskId ? 'app-handoff-offered' : 'demo-response',
        summary: response.handoffTaskId
          ? `Demo assistant offered an app handoff to task ${response.handoffTaskId}.`
          : 'Deterministic Demo data response generated.',
        caseId: grounding.caseId,
        taskId: response.handoffTaskId,
      });
      return;
    }

    if (state !== 'live') return;
    try {
      const handoffTaskId = createDemoAssistantResponse(normalized, grounding).handoffTaskId;
      if (handoffTaskId) {
        appendActivity({
          id: randomId('app-handoff'),
          timestamp: nowIso(),
          source: 'app',
          severity: 'info',
          status: 'app-handoff-offered',
          summary: `App handoff offered for task ${handoffTaskId}; no agent task tool was inferred.`,
          caseId: grounding.caseId,
          taskId: handoffTaskId,
        });
      }
      await sendLiveMessage(normalized, true, handoffTaskId);
    } catch (caught) {
      const message = errorMessage(caught, 'Unable to send the assistant message.');
      setState('error');
      setError(message);
      setIsSending(false);
    }
  }, [appendActivity, grounding, isSending, sendLiveMessage, state]);

  return {
    state,
    messages,
    activityEvents,
    error,
    isSending,
    sendMessage,
    useDemoFallback,
  };
}

import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ComponentProps, ReactNode } from 'react';
import type { CaseWorkspaceSnapshot } from '../cases/types';
import { createDemoCaseWorkspace } from '../cases/demoCase';
import { RecordAssistantPanel } from './RecordAssistantPanel';
import {
  buildCaseGrounding,
  createDemoAssistantResponse,
  findConfiguredAgent,
  useRecordAssistant,
  type RecordAssistantController,
} from './useRecordAssistant';

const authSdk = vi.hoisted(() => ({}));
const assistantAuth = vi.hoisted(() => ({
  current: {
    isAuthenticated: false,
    sdk: authSdk,
  },
}));
const agentSdk = vi.hoisted(() => ({
  connectionHandler: null as null | ((status: 'Disconnected' | 'Connecting' | 'Connected', error: Error | null) => void),
  sessionStartedHandler: null as null | (() => void),
  sessionEndHandler: null as null | (() => void),
  sessionErrorHandler: null as null | ((error: { message?: string; errorId?: string }) => void),
  exchangeHandler: null as null | ((exchange: unknown) => void),
  getAll: vi.fn(),
  createConversation: vi.fn(),
  startSession: vi.fn(),
  endSession: vi.fn(),
  startExchange: vi.fn(),
  sendMessage: vi.fn(),
}));

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => assistantAuth.current,
}));

vi.mock('@uipath/uipath-typescript/conversational-agent', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@uipath/uipath-typescript/conversational-agent')>();
  return {
    ...actual,
    ConversationalAgent: class ConversationalAgent {
      onConnectionStatusChanged(handler: typeof agentSdk.connectionHandler) {
        agentSdk.connectionHandler = handler;
        return vi.fn();
      }

      getAll = agentSdk.getAll;
    },
  };
});

afterEach(() => {
  cleanup();
  assistantAuth.current = { isAuthenticated: false, sdk: authSdk };
  agentSdk.connectionHandler = null;
  agentSdk.sessionStartedHandler = null;
  agentSdk.sessionEndHandler = null;
  agentSdk.sessionErrorHandler = null;
  agentSdk.exchangeHandler = null;
  agentSdk.getAll.mockReset();
  agentSdk.createConversation.mockReset();
  agentSdk.startSession.mockReset();
  agentSdk.endSession.mockReset();
  agentSdk.startExchange.mockReset();
  agentSdk.sendMessage.mockReset();
});

function controller(overrides: Partial<RecordAssistantController> = {}): RecordAssistantController {
  return {
    state: 'demo',
    messages: [],
    activityEvents: [],
    error: null,
    isSending: false,
    sendMessage: vi.fn().mockResolvedValue(undefined),
    useDemoFallback: vi.fn(),
    ...overrides,
  };
}

function renderPanel(
  assistant: RecordAssistantController,
  overrides: Partial<ComponentProps<typeof RecordAssistantPanel>> = {},
) {
  const workspace = createDemoCaseWorkspace();
  const props: ComponentProps<typeof RecordAssistantPanel> = {
    isOpen: true,
    onClose: vi.fn(),
    workspace,
    assistant,
    onOpenTask: vi.fn(),
    ...overrides,
  };

  return { ...render(<RecordAssistantPanel {...props} />), props, workspace };
}

describe('assistant discovery and grounding', () => {
  it('discovers the live agent by the configured exact name', () => {
    const expected = { id: 42, name: 'PI360RecordConversationAgent' };
    const agents = [
      { id: 7, name: 'AnotherAgent' },
      expected,
      { id: 99, name: 'PI360RecordConversationAgent Copy' },
    ];

    expect(findConfiguredAgent(agents, 'PI360RecordConversationAgent')).toBe(expected);
    expect(findConfiguredAgent(agents, 'pi360recordconversationagent')).toBeNull();
  });

  it('grounds a session with compact selected-case stage, evidence, decisions, tasks, and correlation IDs', () => {
    const workspace = createDemoCaseWorkspace();
    const grounding = buildCaseGrounding(workspace);
    const serialized = JSON.stringify(grounding);

    expect(grounding.caseId).toBe(workspace.case.id);
    expect(grounding.currentStage).toEqual({
      key: 'investigation',
      label: 'Investigation and case management',
      status: 'active',
    });
    expect(grounding.signals[0]).toEqual(expect.objectContaining({ id: 'RS-01', severity: 'High' }));
    expect(grounding.evidence[0]).toEqual(expect.objectContaining({ id: 'DOC-TS-0416', status: 'Human-validated' }));
    expect(grounding.decisions).toEqual(expect.arrayContaining([
      expect.objectContaining({ status: 'Decision', correlationId: expect.stringMatching(/^corr-/) }),
      expect.objectContaining({ status: 'Approval', correlationId: expect.stringMatching(/^corr-/) }),
    ]));
    expect(grounding.tasks[0]).toEqual(expect.objectContaining({ id: 1002, status: 'Pending' }));
    expect(serialized).not.toContain('fields');
    expect(grounding).not.toHaveProperty('claims');
    expect(serialized.toLowerCase()).not.toContain('token');
    expect(serialized.toLowerCase()).not.toContain('oauth');
  });

  it('returns the same labeled demo response and app handoff for the same prompt', () => {
    const workspace = createDemoCaseWorkspace();
    const grounding = buildCaseGrounding(workspace);

    const first = createDemoAssistantResponse('What is my next task?', grounding);
    const second = createDemoAssistantResponse('What is my next task?', grounding);

    expect(second).toEqual(first);
    expect(first.content).toContain('Demo data');
    expect(first.content).toContain('Task 1002');
    expect(first.handoffTaskId).toBe(1002);
    expect(first.content).toContain('app handoff');
    expect(first.content.toLowerCase()).not.toContain('completed task');
    expect(first.content.toLowerCase()).not.toContain('called a backend');
  });

  it('refuses to synthesize completion in demo mode', () => {
    const grounding = buildCaseGrounding(createDemoCaseWorkspace());

    const response = createDemoAssistantResponse('Complete task 1002', grounding);

    expect(response.content).toContain('Demo data');
    expect(response.content).toContain('cannot complete');
    expect(response.content).toContain('Action Center');
    expect(response.handoffTaskId).toBe(1002);
  });
});

describe('selected-case sessions', () => {
  it('resets messages when the selected case changes', async () => {
    const firstWorkspace = createDemoCaseWorkspace();
    const secondWorkspace = {
      ...firstWorkspace,
      sourceId: 'demo-case-workspace:CASE-2',
      case: { ...firstWorkspace.case, id: 'CASE-2', sourceId: 'case:CASE-2' },
    } as CaseWorkspaceSnapshot;
    const wrapper = ({ children }: { children: ReactNode }) => children;
    const { result, rerender } = renderHook(
      ({ workspace }) => useRecordAssistant(workspace, true),
      { initialProps: { workspace: firstWorkspace }, wrapper },
    );

    await act(() => result.current.sendMessage('Summarize the evidence.'));
    expect(result.current.messages.some((message) => message.role === 'user')).toBe(true);

    rerender({ workspace: secondWorkspace });

    expect(result.current.messages).toEqual([]);
    expect(result.current.state).toBe('demo');
  });

  it('waits for the SDK session-start event before exposing the live state and grounding exchange', async () => {
    const demoWorkspace = createDemoCaseWorkspace();
    const liveWorkspace = { ...demoWorkspace, dataSource: 'live' as const };
    assistantAuth.current = { isAuthenticated: true, sdk: authSdk };
    agentSdk.sendMessage.mockResolvedValue(undefined);
    agentSdk.startExchange.mockReturnValue({ sendMessageWithContentPart: agentSdk.sendMessage });
    agentSdk.startSession.mockReturnValue({
      onExchangeStart: (handler: typeof agentSdk.exchangeHandler) => {
        agentSdk.exchangeHandler = handler;
        return vi.fn();
      },
      onSessionStarted: (handler: typeof agentSdk.sessionStartedHandler) => {
        agentSdk.sessionStartedHandler = handler;
        return vi.fn();
      },
      onErrorStart: (handler: typeof agentSdk.sessionErrorHandler) => {
        agentSdk.sessionErrorHandler = handler;
        return vi.fn();
      },
      onSessionEnd: (handler: typeof agentSdk.sessionEndHandler) => {
        agentSdk.sessionEndHandler = handler;
        return vi.fn();
      },
      startExchange: agentSdk.startExchange,
    });
    agentSdk.createConversation.mockResolvedValue({
      startSession: agentSdk.startSession,
      endSession: agentSdk.endSession,
    });
    agentSdk.getAll.mockResolvedValue([{
      id: 42,
      name: 'PI360RecordConversationAgent',
      conversations: { create: agentSdk.createConversation },
    }]);

    const { result, unmount } = renderHook(() => useRecordAssistant(liveWorkspace, true));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(result.current.state).toBe('connecting');

    act(() => agentSdk.connectionHandler?.('Connected', null));
    expect(result.current.state).toBe('connecting');
    expect(agentSdk.startExchange).not.toHaveBeenCalled();

    await act(async () => {
      agentSdk.sessionStartedHandler?.();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.state).toBe('live');
    expect(agentSdk.startExchange).toHaveBeenCalledTimes(1);
    expect(agentSdk.sendMessage).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.stringContaining('Selected-case context for this session'),
    }));

    act(() => agentSdk.sessionEndHandler?.());
    expect(result.current.state).toBe('error');
    expect(result.current.error).toContain('ended');
    unmount();
  });
});

describe('RecordAssistantPanel', () => {
  it('shows connecting, demo, error, and empty states explicitly', () => {
    const { rerender, props } = renderPanel(controller({ state: 'connecting' }));
    expect(screen.getByRole('status', { name: 'Assistant connecting' })).toBeInTheDocument();

    rerender(<RecordAssistantPanel {...props} assistant={controller({ state: 'demo' })} />);
    expect(screen.getByText('Demo data')).toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'No assistant messages' })).toBeInTheDocument();

    rerender(<RecordAssistantPanel {...props} assistant={controller({ state: 'error', error: 'Agent unavailable' })} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Agent unavailable');
    expect(screen.getByRole('button', { name: 'Use demo assistant' })).toBeInTheDocument();
  });

  it('puts a suggested prompt into the free-text input for editing instead of sending it', async () => {
    const assistant = controller();
    renderPanel(assistant);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'What is my next task?' }));
    const input = screen.getByRole('textbox', { name: 'Message Record Assistant' });
    expect(input).toHaveValue('What is my next task?');

    await user.type(input, ' Include the SLA.');
    expect(input).toHaveValue('What is my next task? Include the SLA.');
    expect(assistant.sendMessage).not.toHaveBeenCalled();

    fireEvent.submit(screen.getByRole('form', { name: 'Send assistant message' }));
    expect(assistant.sendMessage).toHaveBeenCalledWith('What is my next task? Include the SLA.');
  });

  it('opens the real selected-case task through a labeled app handoff', async () => {
    const onOpenTask = vi.fn();
    const assistant = controller({
      messages: [{
        id: 'assistant-1',
        role: 'assistant',
        content: '**Demo data** Task 1002 is next.',
        timestamp: '2026-08-06T10:00:00Z',
        handoffTaskId: 1002,
      }],
    });
    renderPanel(assistant, { onOpenTask });

    expect(screen.getByText('App handoff')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Open task 1002 in Action Center' }));

    expect(onOpenTask).toHaveBeenCalledWith(expect.objectContaining({ id: 1002 }));
    expect(screen.queryByRole('button', { name: /complete task/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /create task/i })).not.toBeInTheDocument();
  });
});

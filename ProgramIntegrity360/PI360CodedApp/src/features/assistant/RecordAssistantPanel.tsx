import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
} from '@uipath/apollo-wind';
import {
  AlertTriangle,
  ArrowUp,
  Bot,
  CircleUserRound,
  ExternalLink,
  LoaderCircle,
  PanelRightClose,
  Sparkles,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { DeepReadonly, CaseTaskModel, CaseWorkspaceSnapshot } from '../cases/types';
import type { AssistantState, RecordAssistantController, RecordAssistantMessage } from './useRecordAssistant';

export type RecordAssistantPanelProps = {
  isOpen: boolean;
  onClose: () => void;
  workspace: CaseWorkspaceSnapshot | null;
  assistant: RecordAssistantController;
  onOpenTask: (task: DeepReadonly<CaseTaskModel>) => void;
};

const suggestedPrompts = [
  'What is my next task?',
  'Summarize the evidence posture.',
  'Explain the current stage.',
] as const;

const statePresentation: Record<AssistantState, { label: string; variant: 'secondary' | 'info' | 'success' | 'warning' | 'error' }> = {
  idle: { label: 'No case', variant: 'secondary' },
  connecting: { label: 'Connecting', variant: 'info' },
  live: { label: 'Live agent', variant: 'success' },
  demo: { label: 'Demo data', variant: 'warning' },
  error: { label: 'Error', variant: 'error' },
};

export function RecordAssistantPanel({
  isOpen,
  onClose,
  workspace,
  assistant,
  onOpenTask,
}: RecordAssistantPanelProps) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const presentation = statePresentation[assistant.state];

  useEffect(() => {
    setInput('');
  }, [workspace?.case.id]);

  useEffect(() => {
    if (typeof messagesEndRef.current?.scrollIntoView === 'function') {
      messagesEndRef.current.scrollIntoView({ block: 'nearest' });
    }
  }, [assistant.messages]);

  if (!isOpen) return null;

  const submit = async () => {
    const content = input.trim();
    if (!content || assistant.isSending) return;
    setInput('');
    await assistant.sendMessage(content);
  };

  return (
    <section className="sticky top-14 flex h-[calc(100vh-56px)] min-w-0 flex-col bg-white" aria-labelledby="record-assistant-heading">
      <header className="flex min-h-16 items-center justify-between gap-2 border-b border-slate-200 px-3 py-2">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <Bot aria-hidden="true" className="h-4 w-4 shrink-0 text-slate-600" />
            <h2 id="record-assistant-heading" className="truncate text-sm font-semibold text-slate-950">Record Assistant</h2>
          </div>
          <div className="mt-1 truncate font-mono text-[11px] text-slate-500">
            {workspace?.case.id ?? 'No case selected'}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Badge variant={presentation.variant}>{presentation.label}</Badge>
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" aria-label="Close record assistant" onClick={onClose}>
            <PanelRightClose aria-hidden="true" className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {assistant.state === 'connecting' && (
          <div role="status" aria-label="Assistant connecting" className="flex min-h-44 flex-col items-center justify-center px-5 text-center">
            <LoaderCircle aria-hidden="true" className="h-5 w-5 animate-spin text-slate-500" />
            <p className="mt-3 text-sm font-semibold text-slate-800">Connecting to live agent</p>
            <p className="mt-1 text-xs text-slate-500">Starting a selected-case session.</p>
          </div>
        )}

        {assistant.state === 'error' && (
          <div className="p-3">
            <Alert variant="destructive" role="alert">
              <AlertTriangle aria-hidden="true" className="h-4 w-4" />
              <AlertTitle>Assistant unavailable</AlertTitle>
              <AlertDescription>{assistant.error ?? 'The live agent session could not be started.'}</AlertDescription>
            </Alert>
            {workspace && (
              <Button type="button" size="sm" variant="outline" className="mt-3 w-full" onClick={assistant.useDemoFallback}>
                <Sparkles aria-hidden="true" className="h-4 w-4" />
                Use demo assistant
              </Button>
            )}
          </div>
        )}

        {assistant.state === 'idle' && (
          <div role="status" aria-label="No case selected for assistant" className="px-5 py-10 text-center">
            <Bot aria-hidden="true" className="mx-auto h-5 w-5 text-slate-400" />
            <p className="mt-3 text-sm font-semibold text-slate-800">Select a case</p>
            <p className="mt-1 text-xs text-slate-500">The assistant starts a new session for each selected case.</p>
          </div>
        )}

        {(assistant.state === 'demo' || assistant.state === 'live') && assistant.messages.length === 0 && (
          <div role="status" aria-label="No assistant messages" className="px-4 py-6">
            <p className="text-sm font-semibold text-slate-900">Ask about this case</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              {assistant.state === 'demo'
                ? 'Responses are deterministic and labeled Demo data.'
                : 'The live session is grounded in compact redacted case context.'}
            </p>
          </div>
        )}

        {assistant.messages.length > 0 && (
          <ol aria-label="Assistant conversation" className="divide-y divide-slate-100">
            {assistant.messages.map((message) => (
              <MessageRow
                key={message.id}
                message={message}
                workspace={workspace}
                onOpenTask={onOpenTask}
              />
            ))}
          </ol>
        )}
        <div ref={messagesEndRef} />
      </div>

      {(assistant.state === 'demo' || assistant.state === 'live') && workspace && (
        <div className="border-t border-slate-200 bg-slate-50 px-3 py-2">
          <div className="flex flex-col gap-1.5">
            {suggestedPrompts.map((prompt) => (
              <Button
                key={prompt}
                type="button"
                size="sm"
                variant="ghost"
                className="h-auto min-h-8 justify-start whitespace-normal px-2 py-1.5 text-left text-xs font-normal"
                onClick={() => setInput(prompt)}
              >
                {prompt}
              </Button>
            ))}
          </div>
        </div>
      )}

      <form
        aria-label="Send assistant message"
        className="border-t border-slate-200 bg-white p-3"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <div className="flex min-w-0 items-end gap-1 rounded border border-slate-300 bg-white p-1 focus-within:border-slate-500">
          <textarea
            aria-label="Message Record Assistant"
            rows={2}
            value={input}
            disabled={!workspace || assistant.state === 'idle' || assistant.state === 'connecting' || assistant.state === 'error' || assistant.isSending}
            placeholder="Ask about this case"
            className="min-h-14 min-w-0 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm leading-5 text-slate-900 outline-none placeholder:text-slate-400 disabled:opacity-50"
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                void submit();
              }
            }}
          />
          <Button type="submit" size="icon" className="h-8 w-8 shrink-0" aria-label="Send message" disabled={!input.trim() || assistant.isSending}>
            {assistant.isSending
              ? <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" />
              : <ArrowUp aria-hidden="true" className="h-4 w-4" />}
          </Button>
        </div>
      </form>
    </section>
  );
}

function MessageRow({
  message,
  workspace,
  onOpenTask,
}: {
  message: RecordAssistantMessage;
  workspace: CaseWorkspaceSnapshot | null;
  onOpenTask: RecordAssistantPanelProps['onOpenTask'];
}) {
  const task = message.handoffTaskId
    ? workspace?.caseTasks.find((candidate) => candidate.id === message.handoffTaskId)
    : undefined;
  const Icon = message.role === 'user' ? CircleUserRound : Bot;

  return (
    <li className="px-3 py-3">
      <div className="flex min-w-0 gap-2">
        <Icon aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-semibold text-slate-500">{message.role === 'user' ? 'You' : 'Record Assistant'}</div>
          {message.isStreaming && !message.content ? (
            <div role="status" aria-label="Assistant responding" className="mt-2 flex items-center gap-2 text-xs text-slate-500">
              <LoaderCircle aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />
              Responding
            </div>
          ) : message.role === 'assistant' ? (
            <div className="mt-1 break-words text-sm leading-5 text-slate-800 [&_p]:m-0 [&_ul]:my-1 [&_ul]:pl-4">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
            </div>
          ) : (
            <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-5 text-slate-800">{message.content}</p>
          )}

          {task && (
            <div className="mt-3 border-l-2 border-amber-400 bg-amber-50 px-2 py-2">
              <Badge variant="warning">App handoff</Badge>
              <p className="mt-1 break-words text-xs font-semibold text-slate-900">Task {task.id}: {task.title}</p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="mt-2 h-8 w-full justify-start text-xs"
                aria-label={`Open task ${task.id} in Action Center`}
                onClick={() => onOpenTask(task)}
              >
                <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
                Open in Action Center
              </Button>
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

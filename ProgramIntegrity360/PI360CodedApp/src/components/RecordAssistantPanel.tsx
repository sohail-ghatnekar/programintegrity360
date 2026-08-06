import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useAuth } from '../hooks/useAuth';
import {
  useProgramIntegrityRecordAgent,
  type ProgramIntegrityRecordContext,
  type RecordAssistantMessage,
} from '../hooks/useProgramIntegrityRecordAgent';
import { useProgramIntegrityRecordTasks } from '../hooks/useProgramIntegrityRecordTasks';

interface RecordAssistantPanelProps {
  isOpen: boolean;
  onClose: () => void;
  recordContext: ProgramIntegrityRecordContext;
  configurationError?: string | null;
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatValue(value: unknown): string {
  if (Array.isArray(value)) return value.map(item => String(item)).join(', ');
  if (value && typeof value === 'object') return JSON.stringify(value);
  return String(value ?? '');
}

function renderKeyValueTable(title: string, record: Record<string, unknown> | undefined): string {
  if (!record) return '';

  const rows = Object.entries(record).map(([key, value]) => `
    <tr>
      <th>${escapeHtml(key)}</th>
      <td>${escapeHtml(formatValue(value))}</td>
    </tr>
  `).join('');

  return `
    <section>
      <h2>${escapeHtml(title)}</h2>
      <table>${rows}</table>
    </section>
  `;
}

function renderObjectRows(title: string, records: Array<Record<string, unknown>> | undefined, columns: string[]): string {
  if (!records?.length) return '';

  const headers = columns.map(column => `<th>${escapeHtml(column)}</th>`).join('');
  const rows = records.map(record => `
    <tr>
      ${columns.map(column => `<td>${escapeHtml(formatValue(record[column]))}</td>`).join('')}
    </tr>
  `).join('');

  return `
    <section>
      <h2>${escapeHtml(title)}</h2>
      <table>
        <thead><tr>${headers}</tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </section>
  `;
}

function buildRecordFrameHtml(recordContext: ProgramIntegrityRecordContext): string {
  const caseRecord = recordContext.caseRecord as Record<string, unknown> | undefined;
  const provider = recordContext.provider as Record<string, unknown> | undefined;
  const attendant = recordContext.attendant as Record<string, unknown> | undefined;
  const claims = recordContext.claims as Array<Record<string, unknown>> | undefined;
  const riskSignals = recordContext.riskSignals as Array<Record<string, unknown>> | undefined;
  const evidenceDocuments = recordContext.evidenceDocuments as Array<Record<string, unknown>> | undefined;
  const actions = recordContext.actions as Array<Record<string, unknown>> | undefined;
  const tasks = recordContext.tasks as Array<Record<string, unknown>> | undefined;

  return `<!doctype html>
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <style>
        :root { color-scheme: light; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
        body { margin: 0; background: #f8fafc; color: #0f172a; }
        main { padding: 16px; }
        header { border-bottom: 1px solid #e2e8f0; background: #ffffff; padding: 14px 16px; position: sticky; top: 0; z-index: 1; }
        h1 { font-size: 18px; margin: 0; line-height: 1.25; }
        h2 { color: #475569; font-size: 11px; letter-spacing: 0; margin: 0 0 8px; text-transform: uppercase; }
        section { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; margin: 0 0 12px; overflow: hidden; padding: 12px; }
        table { border-collapse: collapse; table-layout: fixed; width: 100%; }
        th, td { border-bottom: 1px solid #f1f5f9; font-size: 12px; line-height: 1.35; padding: 7px 8px; text-align: left; vertical-align: top; word-break: break-word; }
        tr:last-child th, tr:last-child td { border-bottom: 0; }
        th { color: #64748b; font-weight: 700; width: 136px; }
        thead th { color: #334155; background: #f8fafc; width: auto; }
        .case-id { color: #475569; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace; font-size: 12px; margin-top: 4px; }
      </style>
    </head>
    <body>
      <header>
        <h1>${escapeHtml(caseRecord?.title || 'Program Integrity 360 Record')}</h1>
        <div class="case-id">${escapeHtml(caseRecord?.id || 'PI-PCS-2026-0041')}</div>
      </header>
      <main>
        ${renderKeyValueTable('Case', caseRecord)}
        ${renderKeyValueTable('Provider', provider)}
        ${renderKeyValueTable('Attendant', attendant)}
        ${renderObjectRows('Risk Signals', riskSignals, ['id', 'name', 'result', 'severity', 'citations'])}
        ${renderObjectRows('Claims', claims, ['id', 'dos', 'member', 'billed', 'evv', 'timesheet', 'poc', 'improper', 'status', 'source'])}
        ${renderObjectRows('Evidence', evidenceDocuments, ['id', 'type', 'source', 'confidence', 'status', 'note'])}
        ${renderObjectRows('Timeline', actions, ['id', 'timestamp', 'actorKind', 'actor', 'type', 'detail'])}
        ${renderObjectRows('Tasks', tasks, ['title', 'type', 'priority', 'status', 'assignee', 'sla'])}
      </main>
    </body>
  </html>`;
}

const MessageBubble = memo(function MessageBubble({ message }: { message: RecordAssistantMessage }) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex gap-3 px-4 py-3 ${isUser ? '' : 'bg-slate-50'}`}>
      <div className={`mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white ${
        isUser ? 'bg-slate-700' : 'bg-amber-600'
      }`}>
        {isUser ? 'U' : 'AI'}
      </div>
      <div className="min-w-0 flex-1">
        <p className="mb-1 text-xs font-medium text-slate-500">{isUser ? 'You' : 'Record Assistant'}</p>
        {message.isStreaming && !message.content ? (
          <div className="flex h-5 items-center gap-1">
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-amber-500" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-amber-500" style={{ animationDelay: '150ms' }} />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-amber-500" style={{ animationDelay: '300ms' }} />
          </div>
        ) : isUser ? (
          <p className="whitespace-pre-wrap text-sm text-slate-800">{message.content}</p>
        ) : (
          <div className="prose prose-sm max-w-none text-slate-800 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
});

function ChatInput({
  onSubmit,
  isDisabled,
}: {
  onSubmit: (text: string) => void;
  isDisabled: boolean;
}) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 144)}px`;
    }
  }, [value]);

  const submit = useCallback(() => {
    const text = value.trim();
    if (!text || isDisabled) return;
    onSubmit(text);
    setValue('');
  }, [isDisabled, onSubmit, value]);

  return (
    <div className="border-t border-slate-200 bg-white p-3">
      <div className="flex items-end gap-2 rounded-md border border-slate-200 bg-slate-50 focus-within:border-amber-500 focus-within:ring-1 focus-within:ring-amber-200">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={event => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              submit();
            }
          }}
          placeholder="Ask about this record..."
          rows={1}
          disabled={isDisabled}
          className="max-h-36 flex-1 resize-none bg-transparent px-3 py-2.5 text-sm outline-none disabled:opacity-50"
        />
        <button
          type="button"
          onClick={submit}
          disabled={!value.trim() || isDisabled}
          title="Send"
          className="mb-2 mr-2 rounded-md bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Send
        </button>
      </div>
    </div>
  );
}

function isCreateTaskIntent(text: string): boolean {
  return text === '/create-task' || /\b(create|open|start|add)\b.*\btask\b/i.test(text);
}

function isCompleteTaskIntent(text: string): boolean {
  return text === '/complete-task' || /\b(complete|finish|resolve|close)\b.*\btask\b/i.test(text);
}

export function RecordAssistantPanel({
  isOpen,
  onClose,
  recordContext,
  configurationError,
}: RecordAssistantPanelProps) {
  const { login, isLoading, isAuthenticated } = useAuth();
  const frameHtml = useMemo(() => buildRecordFrameHtml(recordContext), [recordContext]);
  const agent = useProgramIntegrityRecordAgent(recordContext, isOpen);
  const taskTools = useProgramIntegrityRecordTasks(recordContext);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [agent.messages]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  const sendWithTaskTool = useCallback(async (text: string) => {
    if (isCreateTaskIntent(text)) {
      try {
        const result = await taskTools.createReviewTask();
        await agent.sendMessage(`${text}\n\nHost task tool result:\n${JSON.stringify({ tool: 'create_record_review_task', result }, null, 2)}`);
      } catch {
        return;
      }
      return;
    }

    if (isCompleteTaskIntent(text)) {
      try {
        const result = await taskTools.completeCurrentTask();
        await agent.sendMessage(`${text}\n\nHost task tool result:\n${JSON.stringify({ tool: 'complete_record_review_task', result }, null, 2)}`);
      } catch {
        return;
      }
      return;
    }

    await agent.sendMessage(text);
  }, [agent, taskTools]);

  const runTaskTool = useCallback(async (tool: 'create' | 'complete') => {
    try {
      const result = tool === 'create'
        ? await taskTools.createReviewTask()
        : await taskTools.completeCurrentTask();
      await agent.sendMessage(`Host task tool result:\n${JSON.stringify({
        tool: tool === 'create' ? 'create_record_review_task' : 'complete_record_review_task',
        result,
      }, null, 2)}`);
    } catch {
      return;
    }
  }, [agent, taskTools]);

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/25"
          onClick={onClose}
          aria-hidden
        />
      )}

      <aside
        className={`fixed right-0 top-0 z-50 flex h-full w-[min(1120px,100vw)] flex-col border-l border-slate-200 bg-white shadow-2xl transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        aria-label="Record assistant"
      >
        <header className="flex flex-shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-slate-950">Record Assistant</p>
            <p className="mt-0.5 truncate font-mono text-xs text-slate-500">
              {String((recordContext.caseRecord as { id?: unknown })?.id || 'PI-PCS-2026-0041')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {!isAuthenticated && (
              <button
                type="button"
                onClick={() => void login()}
                disabled={isLoading || Boolean(configurationError)}
                className="rounded-md bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Connect
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              title="Close"
              className="rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </header>

        <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[1.05fr_0.95fr]">
          <section className="min-h-0 border-b border-slate-200 bg-slate-100 p-3 lg:border-b-0 lg:border-r">
            <iframe
              title="Program Integrity record frame"
              srcDoc={frameHtml}
              sandbox=""
              className="h-full min-h-[360px] w-full rounded-md border border-slate-300 bg-white"
            />
          </section>

          <section className="flex min-h-0 flex-col bg-white">
            <div className="border-b border-slate-200 p-3">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => void runTaskTool('create')}
                  disabled={!isAuthenticated || taskTools.isWorking || agent.isStreaming}
                  className="rounded-md bg-amber-500 px-3 py-2 text-xs font-bold text-slate-950 hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Create task
                </button>
                <button
                  type="button"
                  onClick={() => void runTaskTool('complete')}
                  disabled={!isAuthenticated || !taskTools.activeTask || taskTools.activeTask.status === 'Completed' || taskTools.isWorking || agent.isStreaming}
                  className="rounded-md bg-slate-900 px-3 py-2 text-xs font-bold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Complete task
                </button>
              </div>
              <div className="mt-2 min-h-5 text-xs text-slate-500">
                {taskTools.activeTask
                  ? `Task ${taskTools.activeTask.id}: ${taskTools.activeTask.status}`
                  : `Folder ${taskTools.taskFolderId}`}
              </div>
            </div>

            {(configurationError || agent.error || taskTools.error || taskTools.notice) && (
              <div className="border-b border-slate-200 px-4 py-2 text-xs">
                {configurationError && <p className="text-amber-700">{configurationError}</p>}
                {agent.error && <p className="text-red-700">{agent.error}</p>}
                {taskTools.error && <p className="text-red-700">{taskTools.error}</p>}
                {taskTools.notice && <p className="text-emerald-700">{taskTools.notice}</p>}
              </div>
            )}

            <div className="min-h-0 flex-1 overflow-y-auto">
              {!isAuthenticated && !configurationError && (
                <div className="flex h-64 items-center justify-center px-6 text-center text-sm text-slate-500">
                  Connect to UiPath to start the record conversation.
                </div>
              )}

              {agent.isInitializing && agent.messages.length === 0 && (
                <div className="flex h-64 flex-col items-center justify-center px-6 text-center">
                  <div className="mb-3 h-9 w-9 animate-spin rounded-full border-4 border-slate-200 border-t-amber-500" />
                  <p className="text-sm font-medium text-slate-600">Connecting to agent...</p>
                </div>
              )}

              {agent.messages.length > 0 && (
                <div className="py-2">
                  {agent.messages.map(message => (
                    <MessageBubble key={message.id} message={message} />
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {agent.isStreaming && (
              <div className="border-t border-amber-100 bg-amber-50 px-4 py-1.5 text-xs font-medium text-amber-800">
                Agent is responding...
              </div>
            )}
            <ChatInput
              onSubmit={sendWithTaskTool}
              isDisabled={!isAuthenticated || agent.isInitializing || agent.isStreaming || taskTools.isWorking}
            />
          </section>
        </div>
      </aside>
    </>
  );
}

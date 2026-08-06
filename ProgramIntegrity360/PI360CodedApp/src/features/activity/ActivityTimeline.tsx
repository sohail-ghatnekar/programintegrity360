import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@uipath/apollo-wind';
import { Bot, CircleUserRound, ClipboardCheck, Cpu, PanelsTopLeft } from 'lucide-react';
import type { ActivityEvent } from '../cases/types';
import { ActivityLog } from './activityLog';

type ActivityTimelineProps = {
  events: readonly ActivityEvent[];
};

const sourcePresentation = {
  maestro: { label: 'Maestro', icon: Cpu, variant: 'info' as const },
  task: { label: 'Task', icon: ClipboardCheck, variant: 'warning' as const },
  agent: { label: 'Agent', icon: Bot, variant: 'success' as const },
  user: { label: 'User', icon: CircleUserRound, variant: 'secondary' as const },
  app: { label: 'App', icon: PanelsTopLeft, variant: 'secondary' as const },
};

function severityVariant(severity: ActivityEvent['severity']) {
  if (severity === 'error') return 'error' as const;
  if (severity === 'warning') return 'warning' as const;
  return 'secondary' as const;
}

export function ActivityTimeline({ events }: ActivityTimelineProps) {
  const [source, setSource] = useState<'all' | ActivityEvent['source']>('all');
  const [status, setStatus] = useState('all');
  const log = useMemo(() => new ActivityLog([events]), [events]);
  const statuses = useMemo(() => (
    [...new Set(log.events.map((event) => event.status))].sort((left, right) => left.localeCompare(right))
  ), [log.events]);
  const filtered = useMemo(() => log.filter({
    sources: source === 'all' ? undefined : [source],
    statuses: status === 'all' ? undefined : [status],
  }).events, [log, source, status]);

  useEffect(() => {
    if (status !== 'all' && !statuses.includes(status)) setStatus('all');
  }, [status, statuses]);

  return (
    <section aria-labelledby="activity-heading" className="min-w-0">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="activity-heading" className="text-base font-semibold text-slate-950">Full case timeline</h2>
          <p className="mt-1 text-sm text-slate-600">Maestro, task, agent, user, and app activity in deterministic order.</p>
        </div>
        <span className="shrink-0 text-xs tabular-nums text-slate-500">{filtered.length} of {log.events.length} events</span>
      </div>

      <div className="mb-3 flex flex-wrap gap-3 border-y border-slate-200 bg-white px-3 py-3">
        <ActivityFilter
          label="Source"
          value={source}
          options={['all', 'maestro', 'task', 'agent', 'user', 'app']}
          onChange={(value) => setSource(value as typeof source)}
        />
        <ActivityFilter
          label="Status"
          value={status}
          options={['all', ...statuses]}
          onChange={setStatus}
        />
      </div>

      <ol className="border-t border-slate-200">
        {filtered.length === 0 && (
          <li role="status" aria-label={log.events.length === 0 ? 'No activity recorded' : 'No matching activity'} className="border-b border-slate-200 py-6 text-center text-sm text-slate-500">
            {log.events.length === 0 ? 'No case activity has been recorded.' : 'No activity matches the selected filters.'}
          </li>
        )}
        {filtered.map((event) => {
          const presentation = sourcePresentation[event.source];
          const SourceIcon = presentation.icon;

          return (
            <li key={`${event.source}:${event.id}`} className="grid gap-2 border-b border-slate-200 py-3 sm:grid-cols-[150px_104px_minmax(0,1fr)_126px] sm:items-start">
              <time className="break-words font-mono text-xs text-slate-500">{event.timestamp}</time>
              <Badge variant={presentation.variant} className="w-fit gap-1">
                <SourceIcon aria-hidden="true" className="h-3.5 w-3.5" />
                {presentation.label}
              </Badge>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="break-words text-sm font-semibold text-slate-900">{event.status}</span>
                  <Badge variant={severityVariant(event.severity)}>{event.severity}</Badge>
                </div>
                <p className="mt-1 break-words text-sm text-slate-600">{event.summary}</p>
                {(event.caseId || event.taskId) && (
                  <div className="mt-1 text-xs text-slate-500">
                    {event.caseId && <span>{event.caseId}</span>}
                    {event.caseId && event.taskId && <span> · </span>}
                    {event.taskId && <span>Task {event.taskId}</span>}
                  </div>
                )}
              </div>
              <code className="break-all text-[11px] text-slate-500 sm:text-right">{event.correlationId}</code>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function ActivityFilter({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="min-w-36 text-xs font-semibold text-slate-600">
      <span className="mb-1 block">{label}</span>
      <select
        aria-label={`Activity ${label.toLowerCase()}`}
        value={value}
        className="h-9 w-full rounded border border-slate-300 bg-white px-2 text-sm font-normal text-slate-900"
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option} value={option}>{option === 'all' ? `All ${label.toLowerCase()}s` : option}</option>
        ))}
      </select>
    </label>
  );
}

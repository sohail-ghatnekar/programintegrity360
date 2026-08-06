import { useState } from 'react';
import {
  Badge,
  Button,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@uipath/apollo-wind';
import { ExternalLink, RefreshCw, X } from 'lucide-react';
import type { CaseTaskModel, DeepReadonly } from '../cases/types';
import { useTaskPolling } from './useTaskPolling';
import type { TaskScope } from './TaskCenter';
import type { TaskStatusReader } from './useTaskPolling';

type TaskDrawerProps = {
  task: DeepReadonly<CaseTaskModel>;
  taskScope: TaskScope;
  open: boolean;
  onClose: () => void;
  onCompleted: (taskId: number) => void | Promise<void>;
  onRefreshWorkspace?: () => void | Promise<void>;
  readTaskStatus?: TaskStatusReader;
};

export function TaskDrawer({
  task,
  taskScope,
  open,
  onClose,
  onCompleted,
  onRefreshWorkspace,
  readTaskStatus,
}: TaskDrawerProps) {
  const [frameRevision, setFrameRevision] = useState(0);
  const poll = useTaskPolling({
    taskId: task.id,
    folderId: task.folderId,
    open: open && task.status !== 'Completed',
    readTaskStatus,
    onCompleted,
    onRefreshWorkspace,
  });
  const completed = task.status === 'Completed' || poll.state === 'completed';
  const hasTaskUrl = task.actionCenterUrl.trim().length > 0;
  const canEmbed = open && !completed && hasTaskUrl;

  return (
    <Sheet open={open} onOpenChange={(nextOpen) => {
      if (!nextOpen) onClose();
    }}>
      <SheetContent side="right" className="flex w-[min(1120px,96vw)] max-w-none flex-col p-0 sm:max-w-[1120px]">
        <SheetHeader className="border-b border-slate-200 px-5 py-4 text-left">
          <div className="flex min-w-0 flex-wrap items-start justify-between gap-3 pr-8">
            <div className="min-w-0">
              <SheetTitle className="break-words">{task.title}</SheetTitle>
              <SheetDescription className="mt-1">
                {taskScope === 'case' ? 'This Case task' : 'Folder Inbox task'} · Task {task.id}
              </SheetDescription>
            </div>
            <Badge variant={completed ? 'success' : task.status === 'Unassigned' ? 'warning' : 'info'}>
              {completed ? 'Completed' : task.status}
            </Badge>
          </div>

          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-5">
            <TaskDatum label="Stage" value={taskScope === 'folder' ? 'Folder Inbox' : task.stageLabel} />
            <TaskDatum label="Type" value={task.type} />
            <TaskDatum label="Priority" value={task.priority} />
            <TaskDatum label="Assignee" value={task.assignee === '-' ? 'Unassigned' : task.assignee} />
            <TaskDatum label="SLA" value={task.sla} />
          </dl>

          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" disabled={!canEmbed} onClick={() => setFrameRevision((value) => value + 1)}>
              <RefreshCw aria-hidden="true" className="h-4 w-4" />
              Refresh
            </Button>
            {hasTaskUrl ? (
              <Button asChild size="sm" variant="outline">
                <a href={task.actionCenterUrl} target="_blank" rel="noreferrer">
                  <ExternalLink aria-hidden="true" className="h-4 w-4" />
                  Open in Action Center
                </a>
              </Button>
            ) : (
              <Button type="button" size="sm" variant="outline" disabled aria-label="Open in Action Center">
                <ExternalLink aria-hidden="true" className="h-4 w-4" />
                Open in Action Center
              </Button>
            )}
            <Button type="button" size="sm" variant="ghost" onClick={onClose}>
              <X aria-hidden="true" className="h-4 w-4" />
              Close
            </Button>
          </div>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-auto bg-slate-50">
          {completed ? (
            <>
              <div role="status" aria-label="Task completed" aria-live="polite" className="border-b border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-900">
                Tasks API confirmed this task is Completed. Completion remains confirmed until this drawer closes.
              </div>
              {poll.completionRefreshState === 'failed' && (
                <div role="alert" className="border-b border-red-200 bg-red-50 px-5 py-4 text-sm text-red-950">
                  <p>Task completion is confirmed, but the workspace refresh failed: {poll.completionRefreshError ?? 'Unknown workspace refresh error.'}</p>
                  {poll.canRetryWorkspaceRefresh && (
                    <Button type="button" size="sm" variant="outline" className="mt-3" onClick={() => void poll.retryWorkspaceRefresh()}>
                      <RefreshCw aria-hidden="true" className="h-4 w-4" />
                      Retry workspace refresh
                    </Button>
                  )}
                </div>
              )}
              {poll.completionRefreshState === 'refreshing' && (
                <div role="status" className="border-b border-slate-200 bg-white px-5 py-3 text-sm text-slate-700">Refreshing workspace...</div>
              )}
              {poll.completionRefreshState === 'succeeded' && (
                <div className="border-b border-slate-200 bg-white px-5 py-3 text-sm text-slate-700">Workspace refreshed.</div>
              )}
            </>
          ) : poll.state === 'unavailable' ? (
            <div className="border-b border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-950">
              Live task polling is unavailable for this demo or unpublished task. Use Action Center to confirm completion.
            </div>
          ) : poll.state === 'retrying' ? (
            <div className="border-b border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-950">
              Live task status is temporarily unavailable. Polling will retry in 3 seconds.
            </div>
          ) : poll.state === 'timed-out' ? (
            <div className="border-b border-slate-200 bg-white px-5 py-3 text-sm text-slate-700">
              Live polling stopped after two minutes. Open Action Center or close and reopen this task to check again.
            </div>
          ) : poll.state === 'terminal-unavailable' ? (
            <div role="alert" className="border-b border-red-200 bg-red-50 px-5 py-3 text-sm text-red-950">
              Live task status cannot be checked: {poll.error ?? 'Tasks API request is unavailable.'} Polling stopped.
            </div>
          ) : null}

          {!hasTaskUrl && (
            <div role="status" aria-label="Action Center link unavailable" className="border-b border-slate-200 bg-white px-5 py-4 text-sm text-slate-700">
              This task is not published with an Action Center URL yet. No completion is inferred locally.
            </div>
          )}

          {canEmbed && (
            <iframe
              key={`${task.id}-${frameRevision}`}
              title={`Action Center task ${task.id}`}
              src={task.actionCenterUrl}
              className="h-full min-h-[560px] w-full border-0 bg-white"
              allow="clipboard-read; clipboard-write"
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function TaskDatum({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-slate-500">{label}</dt>
      <dd className="mt-0.5 break-words font-semibold text-slate-800">{value}</dd>
    </div>
  );
}

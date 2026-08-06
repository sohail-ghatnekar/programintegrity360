import { useEffect, useMemo, useState } from 'react';
import {
  Badge,
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@uipath/apollo-wind';
import { ChevronLeft, ChevronRight, Inbox, ListFilter } from 'lucide-react';
import type { CaseTaskModel, DeepReadonly, Severity, TaskStatus } from '../cases/types';

export type TaskScope = 'case' | 'folder';

type TaskCenterProps = {
  caseTasks: readonly DeepReadonly<CaseTaskModel>[];
  folderTasks: readonly DeepReadonly<CaseTaskModel>[];
  onOpenTask: (task: DeepReadonly<CaseTaskModel>, scope: TaskScope) => void;
};

type TaskTypeFilter = 'All' | CaseTaskModel['type'];
type TaskStatusFilter = 'All' | TaskStatus;
type TaskPriorityFilter = 'All' | Severity;

const PAGE_SIZE = 6;

function statusVariant(status: TaskStatus) {
  if (status === 'Completed') return 'success' as const;
  if (status === 'Unassigned') return 'warning' as const;
  return 'info' as const;
}

function TaskEmptyState({ scope, filtered }: { scope: TaskScope; filtered: boolean }) {
  const label = filtered
    ? 'No matching tasks'
    : scope === 'case'
      ? 'No tasks for this case'
      : 'Folder inbox is empty';
  const detail = filtered
    ? 'Adjust the status, type, or priority filters.'
    : scope === 'case'
      ? 'The selected case instance returned no Action Center tasks.'
      : 'The configured folder returned no accessible Action Center tasks.';

  return (
    <div role="status" aria-label={label} className="border-y border-slate-200 px-4 py-10 text-center">
      <Inbox aria-hidden="true" className="mx-auto h-6 w-6 text-slate-400" />
      <div className="mt-3 text-sm font-semibold text-slate-900">{label}</div>
      <p className="mt-1 text-xs text-slate-500">{detail}</p>
    </div>
  );
}

export function TaskCenter({ caseTasks, folderTasks, onOpenTask }: TaskCenterProps) {
  const [scope, setScope] = useState<TaskScope>('case');
  const [status, setStatus] = useState<TaskStatusFilter>('All');
  const [type, setType] = useState<TaskTypeFilter>('All');
  const [priority, setPriority] = useState<TaskPriorityFilter>('All');
  const [page, setPage] = useState(0);
  const tasks = scope === 'case' ? caseTasks : folderTasks;
  const filteredTasks = useMemo(() => tasks.filter((task) => (
    (status === 'All' || task.status === status)
    && (type === 'All' || task.type === type)
    && (priority === 'All' || task.priority === priority)
  )), [priority, status, tasks, type]);
  const pageCount = Math.max(1, Math.ceil(filteredTasks.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageTasks = filteredTasks.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  useEffect(() => {
    setPage(0);
  }, [priority, scope, status, type]);

  useEffect(() => {
    if (page >= pageCount) setPage(pageCount - 1);
  }, [page, pageCount]);

  return (
    <section aria-labelledby="task-center-heading" className="min-w-0">
      <div className="mb-4">
        <h1 id="task-center-heading" className="text-xl font-semibold text-slate-950">Task Center</h1>
        <p className="mt-1 text-sm text-slate-600">Action Center work available to the signed-in UiPath user.</p>
      </div>

      <Tabs value={scope} onValueChange={(value) => setScope(value === 'folder' ? 'folder' : 'case')}>
        <TabsList aria-label="Task sources">
          <TabsTrigger value="case">This Case ({caseTasks.length})</TabsTrigger>
          <TabsTrigger value="folder">Folder Inbox ({folderTasks.length})</TabsTrigger>
        </TabsList>
        <TabsContent value={scope} className="mt-4">
          {scope === 'folder' && (
            <p className="mb-3 border-l-2 border-slate-300 pl-3 text-xs text-slate-600">
              Folder Inbox tasks are not relabeled as current-case work.
            </p>
          )}

          <div className="mb-3 flex flex-wrap items-end gap-3 border-y border-slate-200 bg-white px-3 py-3">
            <ListFilter aria-hidden="true" className="mb-2 h-4 w-4 text-slate-500" />
            <TaskFilter label="Status" value={status} options={['All', 'Unassigned', 'Pending', 'Completed']} onChange={(value) => setStatus(value as TaskStatusFilter)} />
            <TaskFilter label="Type" value={type} options={['All', 'Form', 'App']} onChange={(value) => setType(value as TaskTypeFilter)} />
            <TaskFilter label="Priority" value={priority} options={['All', 'High', 'Medium', 'Low']} onChange={(value) => setPriority(value as TaskPriorityFilter)} />
          </div>

          {pageTasks.length === 0 ? (
            <TaskEmptyState scope={scope} filtered={tasks.length > 0} />
          ) : (
            <div className="overflow-x-auto border-y border-slate-200 bg-white">
              <Table className="min-w-[900px] table-fixed">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[30%]">Task</TableHead>
                    <TableHead className="w-[20%]">Stage</TableHead>
                    <TableHead className="w-[8%]">Type</TableHead>
                    <TableHead className="w-[10%]">Priority</TableHead>
                    <TableHead className="w-[12%]">Assignee</TableHead>
                    <TableHead className="w-[9%]">SLA</TableHead>
                    <TableHead className="w-[11%] text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageTasks.map((task) => (
                    <TableRow key={task.id} data-testid={`task-row-${task.id}`}>
                      <TableCell className="align-top">
                        <div className="break-words text-sm font-semibold text-slate-900">{task.title}</div>
                        <div className="mt-1 flex items-center gap-3 text-xs text-slate-500">
                          <code>Task {task.id}</code>
                          <Button type="button" variant="link" size="sm" className="h-auto p-0" aria-label={`Open task ${task.id}`} onClick={() => onOpenTask(task, scope)}>
                            Open
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell className="break-words align-top text-xs text-slate-700">{scope === 'folder' ? 'Folder Inbox' : task.stageLabel}</TableCell>
                      <TableCell className="align-top text-xs">{task.type}</TableCell>
                      <TableCell className="align-top text-xs">{task.priority}</TableCell>
                      <TableCell className="break-words align-top text-xs">{task.assignee === '-' ? 'Unassigned' : task.assignee}</TableCell>
                      <TableCell className="align-top text-xs">{task.sla}</TableCell>
                      <TableCell className="align-top text-right"><Badge variant={statusVariant(task.status)}>{task.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {filteredTasks.length > 0 && (
            <div className="mt-3 flex items-center justify-between gap-3 text-xs text-slate-500">
              <span>Showing {safePage * PAGE_SIZE + 1}-{Math.min((safePage + 1) * PAGE_SIZE, filteredTasks.length)} of {filteredTasks.length}</span>
              <div className="flex gap-1">
                <Button type="button" variant="outline" size="icon" className="h-8 w-8" aria-label="Previous task page" disabled={safePage === 0} onClick={() => setPage((current) => Math.max(0, current - 1))}>
                  <ChevronLeft aria-hidden="true" className="h-4 w-4" />
                </Button>
                <Button type="button" variant="outline" size="icon" className="h-8 w-8" aria-label="Next task page" disabled={safePage >= pageCount - 1} onClick={() => setPage((current) => Math.min(pageCount - 1, current + 1))}>
                  <ChevronRight aria-hidden="true" className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </section>
  );
}

function TaskFilter({
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
    <label className="min-w-32 text-xs font-semibold text-slate-600">
      <span className="mb-1 block">{label}</span>
      <select
        aria-label={label}
        value={value}
        className="h-9 w-full rounded border border-slate-300 bg-white px-2 text-sm font-normal text-slate-900"
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
  );
}

import { Badge } from '@uipath/apollo-wind';
import { ClipboardList } from 'lucide-react';
import { isOpenSupervisorApprovalTask, isOpenTask } from './caseTaskScope';
import type { CaseTaskModel, DeepReadonly, DemoRole } from './types';

type RoleWorkQueueProps = {
  role: DemoRole;
  caseTasks: readonly DeepReadonly<CaseTaskModel>[];
};

const statusVariant = {
  Completed: 'success',
  Pending: 'info',
  Unassigned: 'warning',
} as const;

export function RoleWorkQueue({ role, caseTasks }: RoleWorkQueueProps) {
  const roleLabel = role === 'supervisor' ? 'Supervisor' : 'Investigator';
  const workRecords = caseTasks.filter((task) => role === 'supervisor'
    ? isOpenSupervisorApprovalTask(task)
    : !task.gated && isOpenTask(task));

  return (
    <section aria-labelledby="role-work-queue-heading" className="mt-3 border-t border-slate-200 pt-3">
      <div className="flex items-center justify-between gap-3">
        <h3 id="role-work-queue-heading" className="flex items-center gap-2 text-xs font-semibold text-slate-800">
          <ClipboardList aria-hidden="true" className="h-4 w-4 text-slate-500" />
          {roleLabel} work queue
        </h3>
        <span className="text-xs tabular-nums text-slate-500">{workRecords.length} records</span>
      </div>

      {workRecords.length === 0 ? (
        <div
          role="status"
          aria-label={`No ${role} work records`}
          className="py-4 text-sm text-slate-500"
        >
          No {role} work records are available for this case.
        </div>
      ) : (
        <ul className="mt-2 divide-y divide-slate-200 border-y border-slate-200 bg-white">
          {workRecords.map((task) => (
            <li
              key={task.id}
              className="grid min-w-0 gap-x-3 gap-y-1 px-3 py-2 text-xs sm:grid-cols-[minmax(180px,1fr)_110px_minmax(150px,0.7fr)_90px_110px] sm:items-center"
            >
              <div className="min-w-0">
                <div className="break-words font-medium text-slate-900">{task.title}</div>
                <code className="text-slate-500">Task {task.id}</code>
              </div>
              <Badge variant={statusVariant[task.status]} className="w-fit">{task.status}</Badge>
              <div className="break-words text-slate-600">Stage: {task.stageLabel}</div>
              <div className="font-medium text-slate-700">{task.sla}</div>
              <div className="break-words text-slate-600">{task.assignee === '-' ? 'No assignee' : task.assignee}</div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

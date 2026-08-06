import type { CaseTaskModel, DeepReadonly } from './types';

export const SUPERVISOR_REVIEW_STAGE = 'Supervisor review and approval';

export function isOpenTask(task: DeepReadonly<CaseTaskModel>) {
  return task.status !== 'Completed';
}

export function isOpenSupervisorApprovalTask(task: DeepReadonly<CaseTaskModel>) {
  return task.gated
    && isOpenTask(task)
    && task.stageLabel === SUPERVISOR_REVIEW_STAGE;
}

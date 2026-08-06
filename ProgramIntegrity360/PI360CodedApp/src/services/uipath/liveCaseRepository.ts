import { CaseInstances, Cases } from '@uipath/uipath-typescript/cases';
import type {
  CaseGetAllResponse,
  CaseGetStageResponse,
  CaseInstanceExecutionHistoryResponse,
  CaseInstanceGetResponse,
  ElementExecutionMetadata,
} from '@uipath/uipath-typescript/cases';
import type { UiPath } from '@uipath/uipath-typescript/core';
import { Tasks } from '@uipath/uipath-typescript/tasks';
import type { TaskGetResponse } from '@uipath/uipath-typescript/tasks';
import { STAGE_DEFINITIONS } from '../../features/cases/stages';
import type {
  ActivityEvent,
  CaseRepository,
  CaseStageKey,
  CaseStageModel,
  CaseSummary,
  CaseTaskModel,
  CaseWorkspaceModel,
  CaseWorkspaceSnapshot,
  DeepReadonly,
  Severity,
  StageStatus,
  TaskRefreshSnapshot,
  TaskStatus,
} from '../../features/cases/types';
import { buildActionCenterTaskUrl } from './actionCenterUrl';
import { itemsOf } from './collection';

const EMPTY_TIMESTAMP = '1970-01-01T00:00:00.000Z';
const NOT_AVAILABLE = 'Not available';

export type LiveCaseRepositoryConfig = {
  caseProcessName: string;
  folderKey: string;
  folderId: number | null;
  portalOrigin: string;
  organizationName: string;
  tenantName: string;
};

type PartialCaseProcess = Partial<CaseGetAllResponse>;
type PartialCaseInstance = Partial<CaseInstanceGetResponse>;
type PartialCaseStage = Partial<CaseGetStageResponse>;
type PartialTask = Partial<TaskGetResponse>;
type PartialExecution = Partial<ElementExecutionMetadata>;
type PartialHistory = Partial<CaseInstanceExecutionHistoryResponse>;

function deepFreeze<T>(value: T): DeepReadonly<T> {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) {
      deepFreeze(child);
    }
  }

  return value as DeepReadonly<T>;
}

function text(value: unknown, fallback = NOT_AVAILABLE): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function timestamp(value: unknown, fallback = EMPTY_TIMESTAMP): string {
  return text(value, fallback);
}

function canonicalIdentifier(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLocaleLowerCase().replace(/[^a-z0-9]/g, '') : '';
}

function errorMessage(reason: unknown): string {
  return reason instanceof Error ? reason.message : text(reason, 'Unknown service error');
}

function isCompletedInstance(instance: PartialCaseInstance): boolean {
  return canonicalIdentifier(instance.latestRunStatus) === 'completed' || Boolean(text(instance.completedTime, ''));
}

function startedAt(instance: PartialCaseInstance): number {
  const parsed = Date.parse(text(instance.startedTime, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function orderInstances(instances: PartialCaseInstance[]): PartialCaseInstance[] {
  return [...instances].sort((left, right) => {
    const completionOrder = Number(isCompletedInstance(left)) - Number(isCompletedInstance(right));
    return completionOrder || startedAt(right) - startedAt(left);
  });
}

function stageKeyFor(name: unknown): CaseStageKey | null {
  const normalized = canonicalIdentifier(name);
  if (!normalized) {
    return null;
  }

  const exact = STAGE_DEFINITIONS.find((stage) => (
    canonicalIdentifier(stage.key) === normalized || canonicalIdentifier(stage.label) === normalized
  ));
  if (exact) {
    return exact.key;
  }

  if (normalized.includes('intake') || normalized.includes('triage')) return 'intake';
  if (normalized.includes('evidence') || normalized.includes('acquisition') || normalized.includes('validation')) return 'evidence';
  if (normalized.includes('provider') && normalized.includes('response')) return 'provider-response';
  if (normalized.includes('supervisor') || normalized.includes('approval')) return 'supervisor-review';
  if (normalized.includes('closure') || normalized.includes('monitoring')) return 'closure';
  if (normalized.includes('investigation') || normalized.includes('casemanagement')) return 'investigation';

  return null;
}

function stageStatus(value: unknown): StageStatus {
  const normalized = canonicalIdentifier(value);
  if (['completed', 'successful', 'success'].includes(normalized)) return 'completed';
  if (['running', 'active', 'inprogress', 'executing'].includes(normalized)) return 'active';
  if (['waiting', 'pending', 'paused', 'pausing'].includes(normalized)) return 'waiting';
  if (['faulted', 'failed', 'error'].includes(normalized)) return 'faulted';
  return 'not-started';
}

function taskStatus(task: PartialTask): TaskStatus {
  if (task.isCompleted || canonicalIdentifier(task.status) === 'completed') return 'Completed';
  if (canonicalIdentifier(task.status) === 'unassigned') return 'Unassigned';
  return 'Pending';
}

function taskPriority(value: unknown): Severity {
  const normalized = canonicalIdentifier(value);
  if (normalized === 'critical' || normalized === 'high') return 'High';
  if (normalized === 'low') return 'Low';
  return 'Medium';
}

function taskType(value: unknown): 'Form' | 'App' {
  return canonicalIdentifier(value) === 'apptask' || canonicalIdentifier(value) === 'app' ? 'App' : 'Form';
}

function taskAssignee(task: PartialTask): string {
  if (text(task.taskAssigneeName, '')) return text(task.taskAssigneeName);
  const user = task.assignedToUser;
  if (!user) return '-';

  return text(user.displayName, text(user.emailAddress, text(user.userName, text(user.name, '-'))));
}

function taskSla(task: PartialTask): string {
  const detail = task.taskSlaDetail;
  if (!detail) return 'Not available';
  if (text(detail.status, '')) return text(detail.status);
  if (text(detail.expiryTime, '')) return `Due ${text(detail.expiryTime)}`;
  return 'Not available';
}

function sourceUpdatedAtForTask(task: PartialTask): string {
  return timestamp(task.lastModifiedTime, timestamp(task.completedTime, timestamp(task.createdTime)));
}

function portalTaskUrl(taskId: number, config: LiveCaseRepositoryConfig): string {
  try {
    return buildActionCenterTaskUrl({
      portalOrigin: config.portalOrigin,
      organizationName: config.organizationName,
      tenantName: config.tenantName,
      taskId,
    });
  } catch {
    return '';
  }
}

function normalizeTask(
  task: PartialTask,
  config: LiveCaseRepositoryConfig,
  stageLabel: string,
  index: number,
): CaseTaskModel {
  const id = Number.isSafeInteger(task.id) ? Number(task.id) : 0;
  const folderId = Number.isSafeInteger(task.folderId)
    ? Number(task.folderId)
    : (config.folderId ?? 0);
  const type = taskType(task.type);

  return {
    dataSource: 'live',
    sourceId: text(task.key, `action-center-task:${id || index}`),
    sourceUpdatedAt: sourceUpdatedAtForTask(task),
    id,
    folderId,
    type,
    title: text(task.title, `UiPath task ${id || index + 1}`),
    priority: taskPriority(task.priority),
    assignee: taskAssignee(task),
    status: taskStatus(task),
    stageLabel: text(stageLabel, 'Unmapped UiPath stage'),
    actionCenterUrl: portalTaskUrl(id, config),
    createdAt: timestamp(task.createdTime),
    sla: taskSla(task),
    gated: type === 'App',
  };
}

function taskStageLookup(stages: PartialCaseStage[]): Map<string, string> {
  const lookup = new Map<string, string>();
  for (const stage of stages) {
    const stageLabel = text(stage.name, 'Unmapped UiPath stage');
    const groups = Array.isArray(stage.tasks) ? stage.tasks : [];
    for (const group of groups) {
      const tasks = Array.isArray(group) ? group : [];
      for (const task of tasks) {
        for (const value of [task?.id, task?.name]) {
          const key = canonicalIdentifier(value);
          if (key) lookup.set(key, stageLabel);
        }
      }
    }
  }
  return lookup;
}

function stageForTask(task: PartialTask, lookup: Map<string, string>): string {
  for (const value of [task.id, task.key, task.title]) {
    const match = lookup.get(canonicalIdentifier(value));
    if (match) return match;
  }
  return 'Unmapped UiPath stage';
}

function executionLookup(history: PartialHistory): Map<string, PartialExecution> {
  const lookup = new Map<string, PartialExecution>();
  const executions = Array.isArray(history.elementExecutions) ? history.elementExecutions : [];
  for (const execution of executions) {
    const key = canonicalIdentifier(execution?.elementName);
    if (key) lookup.set(key, execution);
  }
  return lookup;
}

function normalizeStages(
  rawStages: PartialCaseStage[],
  history: PartialHistory,
  instance: PartialCaseInstance,
): CaseStageModel[] {
  const byExecutionName = executionLookup(history);
  const sourceFallback = timestamp(instance.startedTime);
  const canonicalStages = STAGE_DEFINITIONS.map<CaseStageModel>((definition) => ({
    ...definition,
    dataSource: 'live',
    sourceId: `case-stage:${text(instance.instanceId, 'unknown')}:${definition.key}`,
    sourceUpdatedAt: sourceFallback,
    status: 'not-started',
  }));
  const mappedKeys = new Set<CaseStageKey>();
  const unknownStages: CaseStageModel[] = [];

  rawStages.forEach((stage, index) => {
    const label = text(stage.name, `Unnamed UiPath stage ${index + 1}`);
    const matchedKey = stageKeyFor(label);
    const key = matchedKey ?? 'investigation';
    const execution = byExecutionName.get(canonicalIdentifier(label));
    const model: CaseStageModel = {
      key,
      label,
      description: matchedKey
        ? (STAGE_DEFINITIONS.find((definition) => definition.key === matchedKey)?.description ?? `Live UiPath stage: ${label}.`)
        : `Live UiPath stage: ${label}.`,
      dataSource: 'live',
      sourceId: text(stage.id, `case-stage:${text(instance.instanceId, 'unknown')}:${index}`),
      sourceUpdatedAt: timestamp(execution?.completedTime, timestamp(execution?.startedTime, sourceFallback)),
      status: stageStatus(stage.status ?? execution?.status),
      enteredAt: text(execution?.startedTime, '') || undefined,
      completedAt: text(execution?.completedTime, '') || undefined,
    };

    if (matchedKey && !mappedKeys.has(matchedKey)) {
      const targetIndex = canonicalStages.findIndex((candidate) => candidate.key === matchedKey);
      canonicalStages[targetIndex] = model;
      mappedKeys.add(matchedKey);
    } else {
      unknownStages.push(model);
    }
  });

  return [...canonicalStages, ...unknownStages];
}

function normalizeTimeline(history: PartialHistory, instance: PartialCaseInstance): ActivityEvent[] {
  const executions = Array.isArray(history.elementExecutions) ? history.elementExecutions : [];
  return executions.map((execution, index) => {
    const actor = text(execution?.elementName, 'UiPath case execution');
    const type = text(execution?.status, 'Unknown');
    const sourceUpdatedAt = timestamp(execution?.completedTime, timestamp(execution?.startedTime, timestamp(instance.startedTime)));
    const id = text(execution?.elementId, `execution:${text(instance.instanceId, 'unknown')}:${index}`);

    return {
      dataSource: 'live',
      sourceId: `case-execution:${id}`,
      sourceUpdatedAt,
      id,
      timestamp: sourceUpdatedAt,
      actorKind: canonicalIdentifier(actor).includes('agent') ? 'Agent' : 'System',
      actor,
      type,
      detail: `${actor} reported ${type}.`,
    };
  });
}

function activeStageLabel(stages: CaseStageModel[]): string {
  return stages.find((stage) => stage.status === 'active')?.label
    ?? stages.find((stage) => stage.status === 'waiting')?.label
    ?? stages.find((stage) => stage.status === 'completed')?.label
    ?? 'Not started';
}

function normalizeSummary(instance: PartialCaseInstance, process: PartialCaseProcess): CaseSummary {
  const id = text(instance.instanceId, text(instance.instanceDisplayName, 'unknown-case'));
  const sourceUpdatedAt = timestamp(instance.completedTime, timestamp(instance.startedTime));

  return {
    dataSource: 'live',
    sourceId: `case-instance:${id}`,
    sourceUpdatedAt,
    id,
    title: text(instance.caseTitle, text(instance.instanceDisplayName, text(process.name, id))),
    program: text(process.name, text(instance.packageId, 'UiPath Case Management')),
    priority: 'Medium',
    status: text(instance.latestRunStatus, 'Unknown'),
    stage: 'Not loaded',
    trigger: text(instance.source),
    alertDate: timestamp(instance.startedTime),
    servicePeriod: NOT_AVAILABLE,
    opened: timestamp(instance.startedTime),
    slaDue: NOT_AVAILABLE,
    investigator: text(instance.startedByUser, 'Unassigned'),
    supervisor: 'Unassigned',
    providerId: NOT_AVAILABLE,
    attendantId: NOT_AVAILABLE,
    riskSignalCount: 0,
    sampleExposure: NOT_AVAILABLE,
    periodExposure: NOT_AVAILABLE,
    rangeExposure: NOT_AVAILABLE,
  };
}

function emptyWorkspace(summary: CaseSummary): CaseWorkspaceModel {
  return {
    dataSource: 'live',
    sourceId: `case-workspace:${summary.id}`,
    sourceUpdatedAt: summary.sourceUpdatedAt,
    case: summary,
    stages: [],
    provider: {
      dataSource: 'live', sourceId: `provider:${summary.id}:unavailable`, sourceUpdatedAt: summary.sourceUpdatedAt,
      name: NOT_AVAILABLE, medicaidId: NOT_AVAILABLE, npi: NOT_AVAILABLE, address: NOT_AVAILABLE,
      enrollment: NOT_AVAILABLE, attendants: NOT_AVAILABLE, history: NOT_AVAILABLE,
    },
    attendant: {
      dataSource: 'live', sourceId: `attendant:${summary.id}:unavailable`, sourceUpdatedAt: summary.sourceUpdatedAt,
      name: NOT_AVAILABLE, id: NOT_AVAILABLE, role: NOT_AVAILABLE, cert: NOT_AVAILABLE,
      certStatus: NOT_AVAILABLE, docs: [],
    },
    claims: [],
    riskSignals: [],
    evidenceDocuments: [],
    caseTasks: [],
    folderTasks: [],
    executionTimeline: [],
  };
}

export class LiveCaseRepository implements CaseRepository {
  private readonly cases: Cases;
  private readonly caseInstances: CaseInstances;
  private readonly tasks: Tasks;
  private warnings: string[] = [];

  constructor(
    sdk: UiPath,
    private readonly config: LiveCaseRepositoryConfig,
  ) {
    this.cases = new Cases(sdk);
    this.caseInstances = new CaseInstances(sdk);
    this.tasks = new Tasks(sdk);
  }

  getWarnings(): readonly string[] {
    return Object.freeze([...this.warnings]);
  }

  async listCases(): Promise<readonly DeepReadonly<CaseSummary>[]> {
    this.warnings = [];
    const { process, instances } = await this.discoverInstances();
    return deepFreeze(orderInstances(instances).map((instance) => normalizeSummary(instance, process)));
  }

  async loadWorkspace(caseId: string): Promise<CaseWorkspaceSnapshot> {
    this.warnings = [];
    const { process, instances } = await this.discoverInstances();
    const instance = instances.find((candidate) => text(candidate.instanceId, '') === caseId);
    if (!instance) {
      throw new Error(`UiPath case instance not found: ${caseId}`);
    }

    const folderKey = text(instance.folderKey, this.config.folderKey.trim());
    const [stagesResult, caseTasksResult, historyResult, folderTasksResult] = await Promise.allSettled([
      folderKey
        ? this.caseInstances.getStages(caseId, folderKey)
        : Promise.reject(new Error('folder key is unavailable')),
      this.caseInstances.getActionTasks(caseId),
      folderKey
        ? this.caseInstances.getExecutionHistory(caseId, folderKey)
        : Promise.reject(new Error('folder key is unavailable')),
      this.config.folderId === null
        ? Promise.reject(new Error('folder ID is unavailable'))
        : this.tasks.getAll({ folderId: this.config.folderId }),
    ]);

    const rawStages = this.valueOrWarning('case stages', stagesResult, []);
    const rawCaseTasks = itemsOf(this.valueOrWarning('case tasks', caseTasksResult, { items: [] }));
    const history = this.valueOrWarning('execution history', historyResult, {}) as PartialHistory;
    const rawFolderTasks = itemsOf(this.valueOrWarning('folder tasks', folderTasksResult, { items: [] }));
    const stages = normalizeStages(rawStages as PartialCaseStage[], history, instance);
    const taskLookup = taskStageLookup(rawStages as PartialCaseStage[]);
    const summary = normalizeSummary(instance, process);
    const workspace = emptyWorkspace({ ...summary, stage: activeStageLabel(stages) });

    workspace.stages = stages;
    workspace.caseTasks = (rawCaseTasks as PartialTask[]).map((task, index) => (
      normalizeTask(task, this.config, stageForTask(task, taskLookup), index)
    ));
    workspace.folderTasks = (rawFolderTasks as PartialTask[]).map((task, index) => (
      normalizeTask(task, this.config, 'Folder inbox', index)
    ));
    workspace.executionTimeline = normalizeTimeline(history, instance);

    return deepFreeze(workspace);
  }

  async refreshTasks(caseId: string): Promise<TaskRefreshSnapshot> {
    this.warnings = [];
    const { instances } = await this.discoverInstances();
    const instance = instances.find((candidate) => text(candidate.instanceId, '') === caseId);
    if (!instance) {
      throw new Error(`UiPath case instance not found: ${caseId}`);
    }

    const [caseTasksResult, folderTasksResult] = await Promise.allSettled([
      this.caseInstances.getActionTasks(caseId),
      this.config.folderId === null
        ? Promise.reject(new Error('folder ID is unavailable'))
        : this.tasks.getAll({ folderId: this.config.folderId }),
    ]);
    const caseTasks = itemsOf(this.valueOrWarning('case tasks', caseTasksResult, { items: [] }));
    const folderTasks = itemsOf(this.valueOrWarning('folder tasks', folderTasksResult, { items: [] }));

    return deepFreeze({
      caseTasks: (caseTasks as PartialTask[]).map((task, index) => (
        normalizeTask(task, this.config, 'Unmapped UiPath stage', index)
      )),
      folderTasks: (folderTasks as PartialTask[]).map((task, index) => (
        normalizeTask(task, this.config, 'Folder inbox', index)
      )),
    });
  }

  private async discoverInstances(): Promise<{
    process: PartialCaseProcess;
    instances: PartialCaseInstance[];
  }> {
    const processes = itemsOf<PartialCaseProcess>(await this.cases.getAll());
    const configuredName = canonicalIdentifier(this.config.caseProcessName);
    const process = processes.find((candidate) => [candidate.name, candidate.packageId, candidate.processKey]
      .some((value) => canonicalIdentifier(value) === configuredName));

    if (!process) {
      throw new Error(`UiPath case process not found: ${this.config.caseProcessName}`);
    }

    const processKey = text(process.processKey, '');
    if (!processKey) {
      throw new Error(`UiPath case process has no processKey: ${this.config.caseProcessName}`);
    }

    const response = await this.caseInstances.getAll({ processKey });
    return { process, instances: itemsOf(response) as PartialCaseInstance[] };
  }

  private valueOrWarning<T>(label: string, result: PromiseSettledResult<T>, fallback: T): T {
    if (result.status === 'fulfilled') {
      return result.value;
    }

    this.warnings.push(`Unable to load ${label}: ${errorMessage(result.reason)}.`);
    return fallback;
  }
}

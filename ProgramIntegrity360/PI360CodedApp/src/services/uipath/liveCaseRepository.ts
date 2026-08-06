import { CaseInstances, Cases } from '@uipath/uipath-typescript/cases';
import type {
  CaseGetAllResponse,
  CaseGetStageResponse,
  CaseInstanceExecutionHistoryResponse,
  CaseInstanceGetResponse,
  ElementExecutionMetadata,
} from '@uipath/uipath-typescript/cases';
import type { PaginationCursor, UiPath } from '@uipath/uipath-typescript/core';
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
const SDK_PAGE_SIZE = 100;
const MAX_CURSOR_PAGES = 100;

export type LiveCaseRepositoryConfig = {
  caseProcessName: string;
  folderKey: string;
  folderId: number | null;
  portalOrigin: string;
  organizationName: string;
  tenantName: string;
};

export type RepositoryOperationResult<T> = {
  readonly data: T;
  readonly warnings: readonly string[];
};

type PartialCaseProcess = Partial<CaseGetAllResponse>;
type PartialCaseInstance = Partial<CaseInstanceGetResponse>;
type PartialCaseStage = Partial<CaseGetStageResponse>;
type PartialTask = Partial<TaskGetResponse>;
type PartialExecution = Partial<ElementExecutionMetadata>;
type PartialHistory = Partial<CaseInstanceExecutionHistoryResponse>;
type CursorResponse<T> = readonly T[] | {
  readonly items?: readonly T[] | null;
  readonly hasNextPage?: boolean;
  readonly nextCursor?: PaginationCursor;
};

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

function addWarning(warnings: string[], warning: string): void {
  if (!warnings.includes(warning)) {
    warnings.push(warning);
  }
}

function operationResult<T>(data: T, warnings: string[]): RepositoryOperationResult<T> {
  return Object.freeze({
    data,
    warnings: Object.freeze([...warnings]),
  });
}

async function collectCursorPages<T>(
  label: string,
  loadPage: (cursor?: PaginationCursor) => Promise<CursorResponse<T>>,
  warnings: string[],
): Promise<T[]> {
  const items: T[] = [];
  const seenCursors = new Set<string>();
  let cursor: PaginationCursor | undefined;

  for (let page = 0; page < MAX_CURSOR_PAGES; page += 1) {
    let response: CursorResponse<T>;
    try {
      response = await loadPage(cursor);
    } catch (reason) {
      addWarning(warnings, `Unable to load ${label}: ${errorMessage(reason)}.`);
      return items;
    }

    items.push(...itemsOf(response));
    if (!('hasNextPage' in response) || !response.hasNextPage) {
      return items;
    }

    const nextCursor = response.nextCursor;
    if (!nextCursor?.value) {
      addWarning(warnings, `Stopped ${label} pagination because the SDK response omitted the next cursor.`);
      return items;
    }
    if (seenCursors.has(nextCursor.value)) {
      addWarning(warnings, `Stopped ${label} pagination after a repeated cursor; partial data was preserved.`);
      return items;
    }

    seenCursors.add(nextCursor.value);
    cursor = nextCursor;
  }

  addWarning(warnings, `Stopped ${label} pagination after ${MAX_CURSOR_PAGES} pages; partial data was preserved.`);
  return items;
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

function portalTaskUrl(
  taskId: number,
  config: LiveCaseRepositoryConfig,
  warnings: string[],
): string {
  try {
    return buildActionCenterTaskUrl({
      portalOrigin: config.portalOrigin,
      organizationName: config.organizationName,
      tenantName: config.tenantName,
      taskId,
    });
  } catch (reason) {
    addWarning(warnings, `Unable to build Action Center URL for task ${taskId}: ${errorMessage(reason)}.`);
    return '';
  }
}

function normalizeTask(
  task: PartialTask,
  config: LiveCaseRepositoryConfig,
  stageLabel: string,
  index: number,
  warnings: string[],
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
    actionCenterUrl: portalTaskUrl(id, config, warnings),
    createdAt: timestamp(task.createdTime),
    sla: taskSla(task),
    gated: type === 'App',
  };
}

function taskStageLookup(stages: PartialCaseStage[]): Map<string, string> {
  const lookup = new Map<string, string>();
  for (const stage of stages) {
    const stageName = text(stage.name, 'Unmapped UiPath stage');
    const stageKey = stageKeyFor(stageName) ?? 'investigation';
    const stageLabel = STAGE_DEFINITIONS.find((definition) => definition.key === stageKey)?.label
      ?? 'Investigation and case management';
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
  warnings: string[],
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
  const statusRank: Record<StageStatus, number> = {
    'not-started': 0,
    completed: 1,
    waiting: 2,
    active: 3,
    faulted: 4,
  };

  rawStages.forEach((stage, index) => {
    const backendLabel = text(stage.name, `Unnamed UiPath stage ${index + 1}`);
    const matchedKey = stageKeyFor(backendLabel);
    const key = matchedKey ?? 'investigation';
    const definition = STAGE_DEFINITIONS.find((candidate) => candidate.key === key)
      ?? STAGE_DEFINITIONS[2];
    const execution = byExecutionName.get(canonicalIdentifier(backendLabel));
    const status = stageStatus(stage.status ?? execution?.status);
    const stageId = text(stage.id, `backend-stage-${index + 1}`);
    const backendStatus = text(stage.status ?? execution?.status, 'Unknown');
    const taskGroupCount = Array.isArray(stage.tasks) ? stage.tasks.length : 0;
    const backendDetail = `Backend stage "${backendLabel}" [id: ${stageId}; status: ${backendStatus}; task groups: ${taskGroupCount}].`;
    const model: CaseStageModel = {
      key,
      label: definition.label,
      description: `${definition.description} ${backendDetail}`,
      dataSource: 'live',
      sourceId: text(stage.id, `case-stage:${text(instance.instanceId, 'unknown')}:${index}`),
      sourceUpdatedAt: timestamp(execution?.completedTime, timestamp(execution?.startedTime, sourceFallback)),
      status,
      enteredAt: text(execution?.startedTime, '') || undefined,
      completedAt: text(execution?.completedTime, '') || undefined,
    };

    if (!matchedKey) {
      addWarning(
        warnings,
        `Mapped unknown UiPath stage "${backendLabel}" to canonical stage "${definition.label}".`,
      );
    }

    if (!mappedKeys.has(key)) {
      const targetIndex = canonicalStages.findIndex((candidate) => candidate.key === key);
      canonicalStages[targetIndex] = model;
      mappedKeys.add(key);
    } else {
      const targetIndex = canonicalStages.findIndex((candidate) => candidate.key === key);
      const existing = canonicalStages[targetIndex];
      addWarning(
        warnings,
        `Merged duplicate UiPath stage "${backendLabel}" into canonical stage "${definition.label}".`,
      );
      canonicalStages[targetIndex] = {
        ...existing,
        description: `${existing.description} ${backendDetail}`,
        status: statusRank[status] > statusRank[existing.status] ? status : existing.status,
        sourceUpdatedAt: model.sourceUpdatedAt,
        enteredAt: existing.enteredAt ?? model.enteredAt,
        completedAt: existing.completedAt ?? model.completedAt,
      };
    }
  });

  return canonicalStages;
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

  constructor(
    sdk: UiPath,
    private readonly config: LiveCaseRepositoryConfig,
  ) {
    this.cases = new Cases(sdk);
    this.caseInstances = new CaseInstances(sdk);
    this.tasks = new Tasks(sdk);
  }

  async listCases(): Promise<readonly DeepReadonly<CaseSummary>[]> {
    return (await this.listCasesWithWarnings()).data;
  }

  async listCasesWithWarnings(): Promise<RepositoryOperationResult<readonly DeepReadonly<CaseSummary>[]>> {
    const warnings: string[] = [];
    const { process, instances } = await this.discoverInstances(warnings);
    const cases = deepFreeze(orderInstances(instances).map((instance) => normalizeSummary(instance, process)));
    return operationResult(cases, warnings);
  }

  async loadWorkspace(caseId: string): Promise<CaseWorkspaceSnapshot> {
    return (await this.loadWorkspaceWithWarnings(caseId)).data;
  }

  async loadWorkspaceWithWarnings(
    caseId: string,
  ): Promise<RepositoryOperationResult<CaseWorkspaceSnapshot>> {
    const warnings: string[] = [];
    const { process, instances } = await this.discoverInstances(warnings);
    const instance = instances.find((candidate) => text(candidate.instanceId, '') === caseId);
    if (!instance) {
      throw new Error(`UiPath case instance not found: ${caseId}`);
    }

    const folderKey = this.requiredFolderKey();
    const [stagesResult, historyResult, rawCaseTasks, rawFolderTasks] = await Promise.all([
      this.settleValue('case stages', this.caseInstances.getStages(caseId, folderKey), [], warnings),
      this.settleValue<PartialHistory>(
        'execution history',
        this.caseInstances.getExecutionHistory(caseId, folderKey),
        {},
        warnings,
      ),
      this.collectCaseTasks(caseId, warnings),
      this.collectFolderTasks(warnings),
    ]);

    const rawStages = stagesResult as PartialCaseStage[];
    const history = historyResult as PartialHistory;
    const stages = normalizeStages(rawStages, history, instance, warnings);
    const taskLookup = taskStageLookup(rawStages);
    const summary = normalizeSummary(instance, process);
    const workspace = emptyWorkspace({ ...summary, stage: activeStageLabel(stages) });

    workspace.stages = stages;
    workspace.caseTasks = rawCaseTasks.map((task, index) => (
      normalizeTask(task, this.config, stageForTask(task, taskLookup), index, warnings)
    ));
    workspace.folderTasks = rawFolderTasks.map((task, index) => (
      normalizeTask(task, this.config, 'Folder inbox', index, warnings)
    ));
    workspace.executionTimeline = normalizeTimeline(history, instance);

    return operationResult(deepFreeze(workspace), warnings);
  }

  async refreshTasks(caseId: string): Promise<TaskRefreshSnapshot> {
    return (await this.refreshTasksWithWarnings(caseId)).data;
  }

  async refreshTasksWithWarnings(
    caseId: string,
  ): Promise<RepositoryOperationResult<TaskRefreshSnapshot>> {
    const warnings: string[] = [];
    const { instances } = await this.discoverInstances(warnings);
    const instance = instances.find((candidate) => text(candidate.instanceId, '') === caseId);
    if (!instance) {
      throw new Error(`UiPath case instance not found: ${caseId}`);
    }

    const [caseTasks, folderTasks] = await Promise.all([
      this.collectCaseTasks(caseId, warnings),
      this.collectFolderTasks(warnings),
    ]);

    return operationResult(deepFreeze({
      caseTasks: caseTasks.map((task, index) => (
        normalizeTask(task, this.config, 'Unmapped UiPath stage', index, warnings)
      )),
      folderTasks: folderTasks.map((task, index) => (
        normalizeTask(task, this.config, 'Folder inbox', index, warnings)
      )),
    }), warnings);
  }

  private async discoverInstances(warnings: string[]): Promise<{
    process: PartialCaseProcess;
    instances: PartialCaseInstance[];
  }> {
    const configuredFolderKey = this.requiredFolderKey();
    const processes = itemsOf<PartialCaseProcess>(await this.cases.getAll());
    const configuredName = canonicalIdentifier(this.config.caseProcessName);
    const matchingProcesses = processes.filter((candidate) => [candidate.name, candidate.packageId, candidate.processKey]
      .some((value) => canonicalIdentifier(value) === configuredName));
    const process = matchingProcesses.find((candidate) => text(candidate.folderKey, '') === configuredFolderKey)
      ?? matchingProcesses.find((candidate) => !text(candidate.folderKey, ''));

    if (!process) {
      if (matchingProcesses.length > 0) {
        const folders = matchingProcesses.map((candidate) => text(candidate.folderKey, 'missing')).join(', ');
        throw new Error(
          `UiPath case process ${this.config.caseProcessName} was not found in configured folder ${configuredFolderKey}; discovered folders: ${folders}.`,
        );
      }
      throw new Error(`UiPath case process not found: ${this.config.caseProcessName}`);
    }
    if (!text(process.folderKey, '')) {
      addWarning(
        warnings,
        `The selected case process did not include a folder key; instance folder keys were used to enforce configured folder ${configuredFolderKey}.`,
      );
    }

    const processKey = text(process.processKey, '');
    if (!processKey) {
      throw new Error(`UiPath case process has no processKey: ${this.config.caseProcessName}`);
    }

    const discoveredInstances = await collectCursorPages<PartialCaseInstance>(
      'case instances',
      (cursor) => this.caseInstances.getAll(cursor
        ? { processKey, pageSize: SDK_PAGE_SIZE, cursor }
        : { processKey, pageSize: SDK_PAGE_SIZE }),
      warnings,
    );
    const instances = discoveredInstances.filter((instance) => {
      const instanceFolderKey = text(instance.folderKey, '');
      const instanceId = text(instance.instanceId, 'unknown instance');
      if (!instanceFolderKey) {
        addWarning(
          warnings,
          `UiPath case instance ${instanceId} did not include a folder key; configured folder ${configuredFolderKey} is used for detail calls.`,
        );
        return true;
      }
      if (instanceFolderKey !== configuredFolderKey) {
        addWarning(
          warnings,
          `Excluded UiPath case instance ${instanceId} because folder ${instanceFolderKey} conflicts with configured folder ${configuredFolderKey}.`,
        );
        return false;
      }
      return true;
    });

    return { process, instances };
  }

  private requiredFolderKey(): string {
    const folderKey = this.config.folderKey.trim();
    if (!folderKey) {
      throw new Error('Configured UiPath folder key is required for case discovery.');
    }
    return folderKey;
  }

  private collectCaseTasks(caseId: string, warnings: string[]): Promise<PartialTask[]> {
    return collectCursorPages<PartialTask>(
      'case tasks',
      (cursor) => this.caseInstances.getActionTasks(caseId, cursor
        ? { pageSize: SDK_PAGE_SIZE, cursor }
        : { pageSize: SDK_PAGE_SIZE }),
      warnings,
    );
  }

  private collectFolderTasks(warnings: string[]): Promise<PartialTask[]> {
    if (this.config.folderId === null) {
      addWarning(warnings, 'Unable to load folder tasks: configured folder ID is unavailable.');
      return Promise.resolve([]);
    }

    const folderId = this.config.folderId;
    return collectCursorPages<PartialTask>(
      'folder tasks',
      (cursor) => this.tasks.getAll(cursor
        ? { folderId, pageSize: SDK_PAGE_SIZE, cursor }
        : { folderId, pageSize: SDK_PAGE_SIZE }),
      warnings,
    );
  }

  private async settleValue<T>(
    label: string,
    promise: Promise<T>,
    fallback: T,
    warnings: string[],
  ): Promise<T> {
    try {
      return await promise;
    } catch (reason) {
      addWarning(warnings, `Unable to load ${label}: ${errorMessage(reason)}.`);
      return fallback;
    }
  }
}

import type { UiPath } from '@uipath/uipath-typescript/core';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const sdkMocks = vi.hoisted(() => ({
  casesGetAll: vi.fn(),
  instancesGetAll: vi.fn(),
  getStages: vi.fn(),
  getActionTasks: vi.fn(),
  getExecutionHistory: vi.fn(),
  tasksGetAll: vi.fn(),
}));

const authState = vi.hoisted(() => ({
  current: {
    isAuthenticated: false,
    isLoading: false,
    sdk: {} as UiPath,
  },
}));

vi.mock('@uipath/uipath-typescript/cases', () => ({
  Cases: class Cases {
    getAll = sdkMocks.casesGetAll;
  },
  CaseInstances: class CaseInstances {
    getAll = sdkMocks.instancesGetAll;
    getStages = sdkMocks.getStages;
    getActionTasks = sdkMocks.getActionTasks;
    getExecutionHistory = sdkMocks.getExecutionHistory;
  },
}));

vi.mock('@uipath/uipath-typescript/tasks', () => ({
  Tasks: class Tasks {
    getAll = sdkMocks.tasksGetAll;
  },
}));

vi.mock('../../hooks/useAuth', () => ({
  useOptionalAuth: () => authState.current,
}));

import { createDemoCaseWorkspace, DemoCaseRepository } from '../../features/cases/demoRepository';
import type {
  CaseRepository,
  CaseSummary,
  CaseWorkspaceSnapshot,
  DeepReadonly,
} from '../../features/cases/types';
import { useCaseWorkspace } from '../../features/cases/useCaseWorkspace';
import uipathConfig from '../../../uipath.json';
import { itemsOf } from './collection';
import { LiveCaseRepository } from './liveCaseRepository';

const repositoryConfig = {
  caseProcessName: 'Program Integrity 360 Case',
  folderKey: 'folder-key',
  folderId: 3295396,
  portalOrigin: 'https://staging.uipath.com',
  organizationName: 'uipathlabs',
  tenantName: 'Playground',
};

const targetProcess = {
  name: 'Program Integrity 360 Case',
  packageId: 'Program.Integrity.360.Case',
  processKey: 'target-process-key',
  folderKey: 'folder-key',
};

const activeInstance = {
  instanceId: 'active-instance',
  instanceDisplayName: 'PI-PCS-2026-0041',
  caseTitle: 'Harbor Home Support Services review',
  latestRunStatus: 'Running',
  processKey: 'target-process-key',
  folderKey: 'folder-key',
  packageId: 'Program.Integrity.360.Case',
  startedByUser: 'inv.taylor',
  startedTime: '2026-08-04T09:00:00Z',
  completedTime: '',
};

function task(overrides: Record<string, unknown> = {}) {
  return {
    id: 123,
    folderId: 3295396,
    title: 'Supervisor approval',
    type: 'AppTask',
    priority: 'Critical',
    status: 'Pending',
    createdTime: '2026-08-04T10:00:00Z',
    taskAssigneeName: null,
    assignedToUser: null,
    taskSlaDetail: null,
    ...overrides,
  };
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, resolve, reject };
}

describe('itemsOf', () => {
  it('normalizes arrays and SDK response wrappers without sharing their array', () => {
    const array = [{ id: 1 }];
    const wrapped = { items: [{ id: 2 }], hasNextPage: false };

    expect(itemsOf(array)).toEqual([{ id: 1 }]);
    expect(itemsOf(array)).not.toBe(array);
    expect(itemsOf(wrapped)).toEqual([{ id: 2 }]);
    expect(itemsOf({ items: undefined })).toEqual([]);
    expect(itemsOf(undefined)).toEqual([]);
  });
});

describe('UiPath OAuth configuration', () => {
  it('requests the PIMS scope required by Cases and CaseInstances', () => {
    expect(uipathConfig.scope.split(/\s+/)).toContain('PIMS');
  });
});

describe('LiveCaseRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sdkMocks.casesGetAll.mockResolvedValue([
      { name: 'Unrelated Case', packageId: 'Other.Package', processKey: 'other-key' },
      targetProcess,
    ]);
    sdkMocks.instancesGetAll.mockResolvedValue({
      items: [
        {
          ...activeInstance,
          instanceId: 'completed-newest',
          latestRunStatus: 'Completed',
          startedTime: '2026-08-05T09:00:00Z',
          completedTime: '2026-08-05T10:00:00Z',
        },
        activeInstance,
      ],
      totalCount: 2,
      hasNextPage: false,
    });
    sdkMocks.getStages.mockResolvedValue([
      { id: 'stage-intake', name: 'Alert intake and triage', status: 'Completed', tasks: [] },
      { name: 'Recovery Hold', status: 'Paused' },
    ]);
    sdkMocks.getActionTasks.mockResolvedValue({ items: [task()], totalCount: 1, hasNextPage: false });
    sdkMocks.getExecutionHistory.mockResolvedValue({
      instanceId: activeInstance.instanceId,
      startedTime: activeInstance.startedTime,
      status: 'Running',
      elementExecutions: [
        {
          elementId: 'history-1',
          elementName: 'Alert intake and triage',
          status: 'Completed',
          startedTime: '2026-08-04T09:00:00Z',
          completedTime: '2026-08-04T09:30:00Z',
        },
      ],
    });
    sdkMocks.tasksGetAll.mockResolvedValue({
      items: [task({ id: 456, type: 'FormTask' })],
      hasNextPage: false,
    });
  });

  it('discovers the configured process and prefers the newest non-completed instance', async () => {
    const repository = new LiveCaseRepository({} as UiPath, repositoryConfig);

    const cases = await repository.listCases();

    expect(sdkMocks.instancesGetAll).toHaveBeenCalledWith({
      processKey: 'target-process-key',
      pageSize: 100,
    });
    expect(cases[0].id).toBe('active-instance');
    expect(cases[0].dataSource).toBe('live');
  });

  it('matches package-style process identifiers after defensive normalization', async () => {
    sdkMocks.casesGetAll.mockResolvedValue([
      { ...targetProcess, name: 'Different display name' },
    ]);
    const repository = new LiveCaseRepository({} as UiPath, repositoryConfig);

    await repository.listCases();

    expect(sdkMocks.instancesGetAll).toHaveBeenCalledWith({
      processKey: 'target-process-key',
      pageSize: 100,
    });
  });

  it('selects the configured process folder when the same process name exists elsewhere', async () => {
    sdkMocks.casesGetAll.mockResolvedValue([
      { ...targetProcess, processKey: 'wrong-folder-process', folderKey: 'wrong-folder' },
      targetProcess,
    ]);
    const repository = new LiveCaseRepository({} as UiPath, repositoryConfig);

    await repository.listCases();

    expect(sdkMocks.instancesGetAll).toHaveBeenCalledWith({
      processKey: 'target-process-key',
      pageSize: 100,
    });
  });

  it('rejects conflicting instance folders and reports the excluded instance', async () => {
    sdkMocks.instancesGetAll.mockResolvedValue({
      items: [
        { ...activeInstance, folderKey: 'wrong-folder' },
        {
          ...activeInstance,
          instanceId: 'configured-folder-instance',
          latestRunStatus: 'Completed',
          completedTime: '2026-08-04T10:00:00Z',
        },
      ],
      hasNextPage: false,
    });
    const repository = new LiveCaseRepository({} as UiPath, repositoryConfig);

    const result = await repository.listCasesWithWarnings();

    expect(result.data.map((item) => item.id)).toEqual(['configured-folder-instance']);
    expect(result.warnings).toEqual([
      expect.stringContaining('active-instance'),
    ]);
  });

  it('loads stages, case tasks, execution history, and folder-scoped tasks', async () => {
    const repository = new LiveCaseRepository({} as UiPath, repositoryConfig);

    const workspace = await repository.loadWorkspace('active-instance');

    expect(sdkMocks.getStages).toHaveBeenCalledWith('active-instance', 'folder-key');
    expect(sdkMocks.getActionTasks).toHaveBeenCalledWith('active-instance', { pageSize: 100 });
    expect(sdkMocks.getExecutionHistory).toHaveBeenCalledWith('active-instance', 'folder-key');
    expect(sdkMocks.tasksGetAll).toHaveBeenCalledWith({ folderId: 3295396, pageSize: 100 });
    expect(workspace.caseTasks[0]).toMatchObject({
      id: 123,
      type: 'App',
      priority: 'High',
      assignee: '-',
      actionCenterUrl: 'https://staging.uipath.com/uipathlabs/Playground/actions_/tasks/123',
    });
    expect(workspace.folderTasks[0]).toMatchObject({ id: 456, type: 'Form' });
    expect(workspace.executionTimeline[0]).toMatchObject({
      id: 'history-1',
      type: 'Completed',
    });
  });

  it('uses the configured folder key for detail calls when the instance omits folder identity', async () => {
    sdkMocks.instancesGetAll.mockResolvedValue({
      items: [{ ...activeInstance, folderKey: undefined }],
      hasNextPage: false,
    });
    const repository = new LiveCaseRepository({} as UiPath, repositoryConfig);

    const result = await repository.loadWorkspaceWithWarnings('active-instance');

    expect(sdkMocks.getStages).toHaveBeenCalledWith('active-instance', 'folder-key');
    expect(sdkMocks.getExecutionHistory).toHaveBeenCalledWith('active-instance', 'folder-key');
    expect(result.warnings).toEqual(expect.arrayContaining([
      expect.stringContaining('did not include a folder key'),
    ]));
  });

  it('exhausts instance, case-task, and folder-task cursor pages', async () => {
    sdkMocks.instancesGetAll
      .mockResolvedValueOnce({
        items: [{
          ...activeInstance,
          instanceId: 'completed-first-page',
          latestRunStatus: 'Completed',
          completedTime: '2026-08-05T10:00:00Z',
        }],
        hasNextPage: true,
        nextCursor: { value: 'instances-page-2' },
      })
      .mockResolvedValueOnce({ items: [activeInstance], hasNextPage: false });
    sdkMocks.getActionTasks
      .mockResolvedValueOnce({
        items: [task({ id: 123 })],
        hasNextPage: true,
        nextCursor: { value: 'case-tasks-page-2' },
      })
      .mockResolvedValueOnce({ items: [task({ id: 124 })], hasNextPage: false });
    sdkMocks.tasksGetAll
      .mockResolvedValueOnce({
        items: [task({ id: 456, type: 'FormTask' })],
        hasNextPage: true,
        nextCursor: { value: 'folder-tasks-page-2' },
      })
      .mockResolvedValueOnce({
        items: [task({ id: 457, type: 'FormTask' })],
        hasNextPage: false,
      });
    const repository = new LiveCaseRepository({} as UiPath, repositoryConfig);

    const cases = await repository.listCases();
    const workspace = await repository.loadWorkspace('active-instance');

    expect(cases[0].id).toBe('active-instance');
    expect(sdkMocks.instancesGetAll).toHaveBeenCalledWith({
      processKey: 'target-process-key',
      pageSize: 100,
      cursor: { value: 'instances-page-2' },
    });
    expect(sdkMocks.getActionTasks).toHaveBeenCalledWith('active-instance', {
      pageSize: 100,
      cursor: { value: 'case-tasks-page-2' },
    });
    expect(sdkMocks.tasksGetAll).toHaveBeenCalledWith({
      folderId: 3295396,
      pageSize: 100,
      cursor: { value: 'folder-tasks-page-2' },
    });
    expect(workspace.caseTasks.map((item) => item.id)).toEqual([123, 124]);
    expect(workspace.folderTasks.map((item) => item.id)).toEqual([456, 457]);
  });

  it('stops repeated pagination cursors with a truncation warning', async () => {
    sdkMocks.instancesGetAll
      .mockResolvedValueOnce({
        items: [activeInstance],
        hasNextPage: true,
        nextCursor: { value: 'repeated-cursor' },
      })
      .mockResolvedValueOnce({
        items: [],
        hasNextPage: true,
        nextCursor: { value: 'repeated-cursor' },
      });
    const repository = new LiveCaseRepository({} as UiPath, repositoryConfig);

    const result = await repository.listCasesWithWarnings();

    expect(sdkMocks.instancesGetAll).toHaveBeenCalledTimes(2);
    expect(result.data).toHaveLength(1);
    expect(result.warnings).toEqual([
      expect.stringContaining('repeated cursor'),
    ]);
  });

  it('returns six unique canonical stages while preserving unknown and duplicate backend details', async () => {
    sdkMocks.getStages.mockResolvedValue([
      { id: 'stage-intake', name: 'Alert intake and triage', status: 'Completed', tasks: [] },
      { id: 'stage-intake-duplicate', name: 'Alert intake and triage', status: 'Faulted', tasks: [] },
      { id: 'stage-recovery', name: 'Recovery Hold', status: 'Paused', tasks: [] },
    ]);
    const repository = new LiveCaseRepository({} as UiPath, repositoryConfig);

    const result = await repository.loadWorkspaceWithWarnings('active-instance');
    const intake = result.data.stages.find((stage) => stage.key === 'intake');
    const investigation = result.data.stages.find((stage) => stage.key === 'investigation');

    expect(result.data.stages).toHaveLength(6);
    expect(new Set(result.data.stages.map((stage) => stage.key))).toHaveProperty('size', 6);
    expect(result.data.stages.map((stage) => stage.label)).toEqual([
      'Alert intake and triage',
      'Evidence acquisition and validation',
      'Investigation and case management',
      'Provider response',
      'Supervisor review and approval',
      'Closure and monitoring',
    ]);
    expect(intake).toMatchObject({
      status: 'faulted',
    });
    expect(intake?.description).toContain('stage-intake-duplicate');
    expect(investigation).toMatchObject({
      status: 'waiting',
    });
    expect(investigation?.description).toContain('Recovery Hold');
    expect(investigation?.description).toContain('Paused');
    expect(result.warnings).toEqual(expect.arrayContaining([
      expect.stringContaining('unknown UiPath stage "Recovery Hold"'),
      expect.stringContaining('duplicate UiPath stage "Alert intake and triage"'),
    ]));
  });

  it('preserves a usable workspace and records warnings when optional services fail', async () => {
    sdkMocks.getStages.mockRejectedValue(new Error('stage service unavailable'));
    sdkMocks.getActionTasks.mockRejectedValue(new Error('case tasks unavailable'));
    const repository = new LiveCaseRepository({} as UiPath, repositoryConfig);

    const result = await repository.loadWorkspaceWithWarnings('active-instance');
    const workspace = result.data;

    expect(workspace.case.id).toBe('active-instance');
    expect(workspace.stages).toHaveLength(6);
    expect(workspace.caseTasks).toEqual([]);
    expect(workspace.folderTasks).toHaveLength(1);
    expect(result.warnings).toEqual(expect.arrayContaining([
      expect.stringContaining('stages'),
      expect.stringContaining('case tasks'),
    ]));
  });

  it('keeps concurrent operation warnings isolated', async () => {
    const firstStages = deferred<never>();
    sdkMocks.getStages
      .mockImplementationOnce(() => firstStages.promise)
      .mockResolvedValueOnce([]);
    const repository = new LiveCaseRepository({} as UiPath, repositoryConfig);

    const firstOperation = repository.loadWorkspaceWithWarnings('active-instance');
    const secondOperation = repository.loadWorkspaceWithWarnings('active-instance');
    const secondResult = await secondOperation;
    firstStages.reject(new Error('first request stage failure'));
    const firstResult = await firstOperation;

    expect(secondResult.warnings).not.toEqual(expect.arrayContaining([
      expect.stringContaining('first request stage failure'),
    ]));
    expect(firstResult.warnings).toEqual(expect.arrayContaining([
      expect.stringContaining('first request stage failure'),
    ]));
  });

  it('surfaces Action Center URL configuration failures while keeping an empty render-safe URL', async () => {
    const repository = new LiveCaseRepository({} as UiPath, {
      ...repositoryConfig,
      organizationName: '',
    });

    const result = await repository.loadWorkspaceWithWarnings('active-instance');

    expect(result.data.caseTasks[0].actionCenterUrl).toBe('');
    expect(result.warnings).toEqual(expect.arrayContaining([
      expect.stringContaining('Action Center URL'),
      expect.stringContaining('organizationName'),
    ]));
  });
});

function liveWorkspace(caseId = 'active-instance'): CaseWorkspaceSnapshot {
  const demo = createDemoCaseWorkspace();
  return {
    ...demo,
    dataSource: 'live',
    sourceId: `case-workspace:${caseId}`,
    case: {
      ...demo.case,
      dataSource: 'live',
      sourceId: `case-instance:${caseId}`,
      id: caseId,
    },
  };
}

type HookTestRepository = CaseRepository & {
  listCasesWithWarnings?: () => Promise<{
    data: readonly DeepReadonly<CaseSummary>[];
    warnings: readonly string[];
  }>;
  loadWorkspaceWithWarnings?: (caseId: string) => Promise<{ data: CaseWorkspaceSnapshot; warnings: readonly string[] }>;
};

function hookOptions(repository: HookTestRepository) {
  return {
    demoRepository: new DemoCaseRepository(),
    liveRepositoryFactory: () => repository,
    runtimeConfig: {
      ...repositoryConfig,
      platformBaseUrl: 'https://staging.api.uipath.com',
      config: {
        clientId: 'client-id',
        orgName: 'uipathlabs',
        tenantName: 'Playground',
        baseUrl: 'https://staging.api.uipath.com',
        redirectUri: 'http://localhost:5173',
        scope: 'PIMS OR.Tasks.Read',
      },
      missingFields: [],
      folderPath: 'ProgramIntegrity360 1',
      recordAgentName: 'PI360RecordConversationAgent',
    },
  };
}

describe('useCaseWorkspace', () => {
  beforeEach(() => {
    authState.current = {
      isAuthenticated: false,
      isLoading: false,
      sdk: {} as UiPath,
    };
  });

  it('starts an unauthenticated local session in demo mode without calling live services', async () => {
    const liveRepository = {
      listCases: vi.fn(),
      loadWorkspace: vi.fn(),
      refreshTasks: vi.fn(),
    } satisfies CaseRepository;

    const options = hookOptions(liveRepository);
    const { result } = renderHook(() => useCaseWorkspace(options));

    await waitFor(() => expect(result.current.status).toBe('demo'));
    expect(result.current.workspace?.dataSource).toBe('demo');
    expect(result.current.cases).toHaveLength(1);
    expect(liveRepository.listCases).not.toHaveBeenCalled();
  });

  it('loads live data for an authenticated session and exposes repository warnings', async () => {
    authState.current = { isAuthenticated: true, isLoading: false, sdk: {} as UiPath };
    const workspace = liveWorkspace();
    const liveRepository = {
      listCases: vi.fn().mockResolvedValue([workspace.case]),
      loadWorkspace: vi.fn().mockResolvedValue(workspace),
      refreshTasks: vi.fn(),
      listCasesWithWarnings: vi.fn().mockResolvedValue({
        data: [workspace.case],
        warnings: ['Instance folder identity was unavailable.'],
      }),
      loadWorkspaceWithWarnings: vi.fn().mockResolvedValue({
        data: workspace,
        warnings: ['Folder tasks are temporarily unavailable.'],
      }),
    };

    const options = hookOptions(liveRepository);
    const { result } = renderHook(() => useCaseWorkspace(options));

    await waitFor(() => expect(result.current.status).toBe('live'));
    expect(result.current.workspace?.case.id).toBe('active-instance');
    expect(result.current.warnings).toEqual([
      'Instance folder identity was unavailable.',
      'Folder tasks are temporarily unavailable.',
    ]);
  });

  it('shows an authenticated failure until retry succeeds', async () => {
    authState.current = { isAuthenticated: true, isLoading: false, sdk: {} as UiPath };
    const workspace = liveWorkspace();
    const liveRepository = {
      listCases: vi.fn()
        .mockRejectedValueOnce(new Error('Cases API unavailable'))
        .mockResolvedValue([workspace.case]),
      loadWorkspace: vi.fn().mockResolvedValue(workspace),
      refreshTasks: vi.fn(),
    } satisfies CaseRepository;

    const options = hookOptions(liveRepository);
    const { result } = renderHook(() => useCaseWorkspace(options));

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.workspace).toBeNull();
    expect(result.current.warnings[0]).toContain('Cases API unavailable');

    await act(async () => result.current.refresh());

    expect(result.current.status).toBe('live');
    expect(result.current.workspace?.dataSource).toBe('live');
  });

  it('uses demo data only after explicit fallback from an authenticated error', async () => {
    authState.current = { isAuthenticated: true, isLoading: false, sdk: {} as UiPath };
    const liveRepository = {
      listCases: vi.fn().mockRejectedValue(new Error('No live access')),
      loadWorkspace: vi.fn(),
      refreshTasks: vi.fn(),
    } satisfies CaseRepository;

    const options = hookOptions(liveRepository);
    const { result } = renderHook(() => useCaseWorkspace(options));

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.workspace).toBeNull();

    await act(async () => result.current.useDemoData());

    expect(result.current.status).toBe('demo');
    expect(result.current.workspace?.dataSource).toBe('demo');
  });

  it('loads the selected live case', async () => {
    authState.current = { isAuthenticated: true, isLoading: false, sdk: {} as UiPath };
    const first = liveWorkspace('case-1');
    const second = liveWorkspace('case-2');
    const liveRepository = {
      listCases: vi.fn().mockResolvedValue([first.case, second.case]),
      loadWorkspace: vi.fn((caseId: string) => Promise.resolve(caseId === 'case-2' ? second : first)),
      refreshTasks: vi.fn(),
    } satisfies CaseRepository;

    const options = hookOptions(liveRepository);
    const { result } = renderHook(() => useCaseWorkspace(options));
    await waitFor(() => expect(result.current.status).toBe('live'));

    await act(async () => result.current.selectCase('case-2'));

    expect(result.current.workspace?.case.id).toBe('case-2');
    expect(liveRepository.loadWorkspace).toHaveBeenLastCalledWith('case-2');
  });

  it('does not start obsolete workspace loading after a newer SDK request wins', async () => {
    const firstSdk = {} as UiPath;
    const secondSdk = {} as UiPath;
    const first = liveWorkspace('case-1');
    const second = liveWorkspace('case-2');
    const firstCases = deferred<readonly [typeof first.case]>();
    const firstRepository = {
      listCases: vi.fn(() => firstCases.promise),
      loadWorkspace: vi.fn().mockResolvedValue(first),
      refreshTasks: vi.fn(),
    } satisfies CaseRepository;
    const secondRepository = {
      listCases: vi.fn().mockResolvedValue([second.case]),
      loadWorkspace: vi.fn().mockResolvedValue(second),
      refreshTasks: vi.fn(),
    } satisfies CaseRepository;
    authState.current = { isAuthenticated: true, isLoading: false, sdk: firstSdk };
    const options = hookOptions(firstRepository);
    options.liveRepositoryFactory = (sdk: UiPath) => (
      sdk === firstSdk ? firstRepository : secondRepository
    );
    const { result, rerender } = renderHook(() => useCaseWorkspace(options));
    await waitFor(() => expect(firstRepository.listCases).toHaveBeenCalledOnce());

    authState.current = { isAuthenticated: true, isLoading: false, sdk: secondSdk };
    rerender();
    await waitFor(() => expect(result.current.workspace?.case.id).toBe('case-2'));

    await act(async () => {
      firstCases.resolve([first.case]);
      await firstCases.promise;
    });

    expect(firstRepository.loadWorkspace).not.toHaveBeenCalled();
    expect(result.current.workspace?.case.id).toBe('case-2');
  });
});

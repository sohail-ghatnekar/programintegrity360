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
import type { CaseRepository, CaseWorkspaceSnapshot } from '../../features/cases/types';
import { useCaseWorkspace } from '../../features/cases/useCaseWorkspace';
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
    });
    sdkMocks.getStages.mockResolvedValue([
      { id: 'stage-intake', name: 'Alert intake and triage', status: 'Completed', tasks: [] },
      { name: 'Recovery Hold', status: 'Paused' },
    ]);
    sdkMocks.getActionTasks.mockResolvedValue({ items: [task()], totalCount: 1 });
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
    sdkMocks.tasksGetAll.mockResolvedValue({ items: [task({ id: 456, type: 'FormTask' })] });
  });

  it('discovers the configured process and prefers the newest non-completed instance', async () => {
    const repository = new LiveCaseRepository({} as UiPath, repositoryConfig);

    const cases = await repository.listCases();

    expect(sdkMocks.instancesGetAll).toHaveBeenCalledWith({ processKey: 'target-process-key' });
    expect(cases[0].id).toBe('active-instance');
    expect(cases[0].dataSource).toBe('live');
  });

  it('matches package-style process identifiers after defensive normalization', async () => {
    sdkMocks.casesGetAll.mockResolvedValue([
      { ...targetProcess, name: 'Different display name' },
    ]);
    const repository = new LiveCaseRepository({} as UiPath, repositoryConfig);

    await repository.listCases();

    expect(sdkMocks.instancesGetAll).toHaveBeenCalledWith({ processKey: 'target-process-key' });
  });

  it('loads stages, case tasks, execution history, and folder-scoped tasks', async () => {
    const repository = new LiveCaseRepository({} as UiPath, repositoryConfig);

    const workspace = await repository.loadWorkspace('active-instance');

    expect(sdkMocks.getStages).toHaveBeenCalledWith('active-instance', 'folder-key');
    expect(sdkMocks.getActionTasks).toHaveBeenCalledWith('active-instance');
    expect(sdkMocks.getExecutionHistory).toHaveBeenCalledWith('active-instance', 'folder-key');
    expect(sdkMocks.tasksGetAll).toHaveBeenCalledWith({ folderId: 3295396 });
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

  it('keeps unknown backend stages with safe render fields', async () => {
    const repository = new LiveCaseRepository({} as UiPath, repositoryConfig);

    const workspace = await repository.loadWorkspace('active-instance');
    const unknownStage = workspace.stages.find((stage) => stage.label === 'Recovery Hold');

    expect(unknownStage).toMatchObject({
      key: 'investigation',
      description: 'Live UiPath stage: Recovery Hold.',
      status: 'waiting',
    });
    expect(unknownStage?.sourceId).toBeTruthy();
    expect(unknownStage?.sourceUpdatedAt).toBeTruthy();
  });

  it('preserves a usable workspace and records warnings when optional services fail', async () => {
    sdkMocks.getStages.mockRejectedValue(new Error('stage service unavailable'));
    sdkMocks.getActionTasks.mockRejectedValue(new Error('case tasks unavailable'));
    const repository = new LiveCaseRepository({} as UiPath, repositoryConfig);

    const workspace = await repository.loadWorkspace('active-instance');

    expect(workspace.case.id).toBe('active-instance');
    expect(workspace.stages).toHaveLength(6);
    expect(workspace.caseTasks).toEqual([]);
    expect(workspace.folderTasks).toHaveLength(1);
    expect(repository.getWarnings()).toEqual(expect.arrayContaining([
      expect.stringContaining('stages'),
      expect.stringContaining('case tasks'),
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

function hookOptions(repository: CaseRepository & { getWarnings?: () => readonly string[] }) {
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
      getWarnings: () => ['Folder tasks are temporarily unavailable.'],
    } satisfies CaseRepository & { getWarnings: () => readonly string[] };

    const options = hookOptions(liveRepository);
    const { result } = renderHook(() => useCaseWorkspace(options));

    await waitFor(() => expect(result.current.status).toBe('live'));
    expect(result.current.workspace?.case.id).toBe('active-instance');
    expect(result.current.warnings).toEqual(['Folder tasks are temporarily unavailable.']);
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
      getWarnings: () => [],
    } satisfies CaseRepository & { getWarnings: () => readonly string[] };

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
      getWarnings: () => [],
    } satisfies CaseRepository & { getWarnings: () => readonly string[] };

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
      getWarnings: () => [],
    } satisfies CaseRepository & { getWarnings: () => readonly string[] };

    const options = hookOptions(liveRepository);
    const { result } = renderHook(() => useCaseWorkspace(options));
    await waitFor(() => expect(result.current.status).toBe('live'));

    await act(async () => result.current.selectCase('case-2'));

    expect(result.current.workspace?.case.id).toBe('case-2');
    expect(liveRepository.loadWorkspace).toHaveBeenLastCalledWith('case-2');
  });
});

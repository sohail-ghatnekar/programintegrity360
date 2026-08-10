import type { UiPath } from '@uipath/uipath-typescript/core';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const authState = vi.hoisted(() => ({
  current: {
    isAuthenticated: true,
    isLoading: false,
    sdk: {} as UiPath,
  },
}));

vi.mock('../../hooks/useAuth', () => ({
  useOptionalAuth: () => authState.current,
}));

import { createDemoCaseWorkspace, DemoCaseRepository } from './demoRepository';
import type {
  CaseRepository,
  CaseSummary,
  CaseWorkspaceSnapshot,
  DeepReadonly,
} from './types';
import { useCaseWorkspace } from './useCaseWorkspace';

const CASE_ID = 'PI-HSP-2026-ABC123';
const SECOND_CASE_ID = 'PI-HSP-2026-XYZ789';
const JOB_KEY = '6d829526-34d4-4678-bf02-5d137fa1fc0d';
const ZERO_DELAY_POLICY = { attempts: 3, intervalMs: 0 };

type HookRepository = CaseRepository & {
  listCasesWithWarnings: ReturnType<typeof vi.fn<() => Promise<{
    data: readonly DeepReadonly<CaseSummary>[];
    warnings: readonly string[];
  }>>>;
  loadWorkspaceWithWarnings: ReturnType<typeof vi.fn<(caseId: string) => Promise<{
    data: CaseWorkspaceSnapshot;
    warnings: readonly string[];
  }>>>;
};

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, reject, resolve };
}

function liveWorkspace(caseId: string): CaseWorkspaceSnapshot {
  const demo = createDemoCaseWorkspace();
  return {
    ...demo,
    dataSource: 'live',
    sourceId: `data-fabric-workspace:${caseId}`,
    case: {
      ...demo.case,
      dataSource: 'live',
      sourceId: `data-fabric-case:${caseId}`,
      id: caseId,
      businessCaseId: caseId,
    },
  };
}

function createRepository(): HookRepository {
  const initial = liveWorkspace('PI-PCS-2026-OLD001');
  const listCasesWithWarnings = vi.fn().mockResolvedValue({
    data: [initial.case],
    warnings: [],
  });
  const loadWorkspaceWithWarnings = vi.fn().mockResolvedValue({
    data: initial,
    warnings: [],
  });

  return {
    listCases: vi.fn(async () => (await listCasesWithWarnings()).data),
    loadWorkspace: vi.fn(async (caseId: string) => (await loadWorkspaceWithWarnings(caseId)).data),
    refreshTasks: vi.fn(),
    listCasesWithWarnings,
    loadWorkspaceWithWarnings,
  };
}

const runtimeConfig = {
  platformBaseUrl: 'https://api.uipath.com',
  config: {
    clientId: 'client-id',
    orgName: 'uipathlabs',
    tenantName: 'Playground',
    baseUrl: 'https://api.uipath.com',
    redirectUri: 'http://localhost:5173',
    scope: 'PIMS OR.Execution.Read OR.Jobs.Write DataFabric.Data.Read',
  },
  missingFields: [],
  folderPath: 'AMER Presales/Public Sector/ProgramIntegrity360',
  folderKey: '5db31dd1-1073-4f9e-b44b-76f5484e03c4',
  folderId: 2182825,
  caseProcessName: 'PI360CaseManagement',
  recordAgentName: 'PI360RecordConversationAgent',
  entityIds: {},
};

function options(repository: HookRepository, overrides: Record<string, unknown> = {}) {
  return {
    runtimeConfig,
    demoRepository: new DemoCaseRepository(),
    liveRepositoryFactory: () => repository,
    delay: vi.fn().mockResolvedValue(undefined),
    pollPolicy: ZERO_DELAY_POLICY,
    ...overrides,
  };
}

async function renderReady(repository: HookRepository, hookOptions: ReturnType<typeof options>) {
  const view = renderHook(() => useCaseWorkspace(hookOptions));
  await waitFor(() => expect(view.result.current.status).toBe('live'));
  repository.listCasesWithWarnings.mockReset();
  repository.loadWorkspaceWithWarnings.mockReset();
  return view;
}

function useGeneratedSuffixes(...suffixBytes: number[][]) {
  const queue = [...suffixBytes];
  vi.spyOn(globalThis.crypto, 'getRandomValues').mockImplementation((array) => {
    const bytes = queue.shift();
    if (!bytes) throw new Error('No deterministic suffix bytes remain.');
    (array as Uint8Array).set(bytes);
    return array;
  });
}

describe('useCaseWorkspace case start coordination', () => {
  beforeEach(() => {
    authState.current = {
      isAuthenticated: true,
      isLoading: false,
      sdk: {} as UiPath,
    };
    vi.spyOn(Date.prototype, 'getUTCFullYear').mockReturnValue(2026);
    useGeneratedSuffixes([0, 1, 2, 27, 28, 29]);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('rejects unauthenticated demo starts with the exact connect message', async () => {
    authState.current = { ...authState.current, isAuthenticated: false };
    const repository = createRepository();
    const caseStarter = vi.fn();
    const hookOptions = options(repository, { caseStarter });
    const { result } = renderHook(() => useCaseWorkspace(hookOptions));
    await waitFor(() => expect(result.current.status).toBe('demo'));

    await act(async () => {
      await expect(result.current.startCase({
        caseType: 'StateMedicaidHospice',
        requesterEmail: 'investigator@example.gov',
      })).rejects.toThrow('Connect UiPath to start a case.');
    });

    expect(result.current.caseStartStatus).toBe('error');
    expect(result.current.caseStartMessage).toBe('Connect UiPath to start a case.');
    expect(caseStarter).not.toHaveBeenCalled();
    expect(repository.listCasesWithWarnings).not.toHaveBeenCalled();
  });

  it('builds the selected payload, starts once, polls until its business ID appears, and opens it once', async () => {
    const repository = createRepository();
    const target = liveWorkspace(CASE_ID);
    const old = liveWorkspace('PI-PCS-2026-OLD001');
    const caseStarter = vi.fn().mockResolvedValue({ caseId: CASE_ID, jobKey: JOB_KEY });
    const hookOptions = options(repository, { caseStarter });
    const { result } = await renderReady(repository, hookOptions);
    repository.listCasesWithWarnings
      .mockResolvedValueOnce({ data: [old.case], warnings: [] })
      .mockResolvedValueOnce({
        data: [{ ...target.case, id: 'data-fabric-row-id', businessCaseId: ` ${CASE_ID.toLowerCase()} ` }],
        warnings: [],
      })
      .mockResolvedValue({ data: [target.case], warnings: [] });
    repository.loadWorkspaceWithWarnings.mockResolvedValue({ data: target, warnings: [] });

    let outcome: Awaited<ReturnType<typeof result.current.startCase>> | undefined;
    await act(async () => {
      outcome = await result.current.startCase({
        caseType: 'StateMedicaidHospice',
        requesterEmail: ' Investigator@Example.Gov ',
      });
    });

    expect(caseStarter).toHaveBeenCalledOnce();
    expect(caseStarter).toHaveBeenCalledWith(expect.objectContaining({
      caseId: CASE_ID,
      inputArguments: expect.objectContaining({
        caseInput: expect.objectContaining({
          caseId: CASE_ID,
          caseType: 'StateMedicaidHospice',
          requesterEmail: 'investigator@example.gov',
        }),
      }),
    }));
    expect(repository.listCasesWithWarnings).toHaveBeenCalledTimes(3);
    expect(repository.loadWorkspaceWithWarnings).toHaveBeenCalledOnce();
    expect(repository.loadWorkspaceWithWarnings).toHaveBeenCalledWith(CASE_ID);
    expect(result.current.workspace?.case.id).toBe(CASE_ID);
    expect(result.current.caseStartStatus).toBe('registered');
    expect(outcome).toEqual({ status: 'registered', caseId: CASE_ID, jobKey: JOB_KEY });
  });

  it('does not load a workspace before the generated case appears', async () => {
    const repository = createRepository();
    const old = liveWorkspace('PI-PCS-2026-OLD001');
    const target = liveWorkspace(CASE_ID);
    const firstPoll = deferred<{ data: readonly DeepReadonly<CaseSummary>[]; warnings: readonly string[] }>();
    const secondPoll = deferred<{ data: readonly DeepReadonly<CaseSummary>[]; warnings: readonly string[] }>();
    const caseStarter = vi.fn().mockResolvedValue({ caseId: CASE_ID, jobKey: JOB_KEY });
    const { result } = await renderReady(repository, options(repository, { caseStarter }));
    repository.listCasesWithWarnings
      .mockReturnValueOnce(firstPoll.promise)
      .mockReturnValueOnce(secondPoll.promise)
      .mockResolvedValue({ data: [target.case], warnings: [] });
    repository.loadWorkspaceWithWarnings.mockResolvedValue({ data: target, warnings: [] });

    let startPromise!: ReturnType<typeof result.current.startCase>;
    act(() => {
      startPromise = result.current.startCase({
        caseType: 'StateMedicaidHospice',
        requesterEmail: 'investigator@example.gov',
      });
    });
    await waitFor(() => expect(repository.listCasesWithWarnings).toHaveBeenCalledTimes(1));
    expect(repository.loadWorkspaceWithWarnings).not.toHaveBeenCalled();

    await act(async () => {
      firstPoll.resolve({ data: [old.case], warnings: [] });
      await firstPoll.promise;
    });
    await waitFor(() => expect(repository.listCasesWithWarnings).toHaveBeenCalledTimes(2));
    expect(repository.loadWorkspaceWithWarnings).not.toHaveBeenCalled();

    await act(async () => {
      secondPoll.resolve({ data: [target.case], warnings: [] });
      await startPromise;
    });
    expect(repository.loadWorkspaceWithWarnings).toHaveBeenCalledOnce();
  });

  it('returns a bounded pending outcome with the generated ID after an empty timeout', async () => {
    const repository = createRepository();
    const caseStarter = vi.fn().mockResolvedValue({ caseId: CASE_ID, jobKey: JOB_KEY });
    const delay = vi.fn().mockResolvedValue(undefined);
    const { result } = await renderReady(repository, options(repository, { caseStarter, delay }));
    repository.listCasesWithWarnings.mockResolvedValue({ data: [], warnings: [] });

    let outcome: Awaited<ReturnType<typeof result.current.startCase>> | undefined;
    await act(async () => {
      outcome = await result.current.startCase({
        caseType: 'StateMedicaidHospice',
        requesterEmail: 'investigator@example.gov',
      });
    });

    const message = `Process started; workspace registration is pending for ${CASE_ID}.`;
    expect(caseStarter).toHaveBeenCalledOnce();
    expect(repository.listCasesWithWarnings).toHaveBeenCalledTimes(3);
    expect(delay).toHaveBeenCalledTimes(3);
    expect(repository.loadWorkspaceWithWarnings).not.toHaveBeenCalled();
    expect(result.current.caseStartStatus).toBe('pending');
    expect(result.current.caseStartMessage).toBe(message);
    expect(outcome).toEqual({ status: 'pending', caseId: CASE_ID, jobKey: JOB_KEY });
  });

  it('retries transient list failures but stops at the configured attempt bound', async () => {
    const repository = createRepository();
    const caseStarter = vi.fn().mockResolvedValue({ caseId: CASE_ID, jobKey: JOB_KEY });
    const delay = vi.fn().mockResolvedValue(undefined);
    const { result } = await renderReady(repository, options(repository, { caseStarter, delay }));
    repository.listCasesWithWarnings.mockRejectedValue(new Error('Data Fabric temporarily unavailable'));

    await act(async () => {
      await expect(result.current.startCase({
        caseType: 'StateMedicaidHospice',
        requesterEmail: 'investigator@example.gov',
      })).resolves.toEqual({ status: 'pending', caseId: CASE_ID, jobKey: JOB_KEY });
    });

    expect(repository.listCasesWithWarnings).toHaveBeenCalledTimes(3);
    expect(delay).toHaveBeenCalledTimes(3);
    expect(result.current.caseStartMessage).toBe(
      `Process started; workspace registration is pending for ${CASE_ID}.`,
    );
    expect(result.current.warnings).toContain(
      `Unable to confirm workspace registration for ${CASE_ID}: Data Fabric temporarily unavailable.`,
    );
  });

  it('uses the production default of ten 1500ms attempts when no policy is injected', async () => {
    const repository = createRepository();
    const caseStarter = vi.fn().mockResolvedValue({ caseId: CASE_ID, jobKey: JOB_KEY });
    const delay = vi.fn().mockResolvedValue(undefined);
    const { result } = await renderReady(repository, options(repository, {
      caseStarter,
      delay,
      pollPolicy: undefined,
    }));
    repository.listCasesWithWarnings.mockResolvedValue({ data: [], warnings: [] });

    await act(async () => {
      await result.current.startCase({
        caseType: 'StateMedicaidHospice',
        requesterEmail: 'investigator@example.gov',
      });
    });

    expect(repository.listCasesWithWarnings).toHaveBeenCalledTimes(10);
    expect(delay).toHaveBeenCalledTimes(10);
    expect(delay).toHaveBeenCalledWith(1500);
  });

  it('performs zero polling when process start fails', async () => {
    const repository = createRepository();
    const caseStarter = vi.fn().mockRejectedValue(new Error('UiPath job start denied (403)'));
    const { result } = await renderReady(repository, options(repository, { caseStarter }));

    await act(async () => {
      await expect(result.current.startCase({
        caseType: 'StateMedicaidHospice',
        requesterEmail: 'investigator@example.gov',
      })).rejects.toThrow('UiPath job start denied (403)');
    });

    expect(repository.listCasesWithWarnings).not.toHaveBeenCalled();
    expect(repository.loadWorkspaceWithWarnings).not.toHaveBeenCalled();
    expect(result.current.caseStartStatus).toBe('error');
    expect(result.current.caseStartMessage).toBe('UiPath job start denied (403)');
  });

  it('rejects a starter response whose case ID does not correlate to the generated request', async () => {
    const repository = createRepository();
    const caseStarter = vi.fn().mockResolvedValue({ caseId: 'PI-HSP-2026-WRONG1', jobKey: JOB_KEY });
    const { result } = await renderReady(repository, options(repository, { caseStarter }));

    await act(async () => {
      await expect(result.current.startCase({
        caseType: 'StateMedicaidHospice',
        requesterEmail: 'investigator@example.gov',
      })).rejects.toThrow(`UiPath process start returned a mismatched case ID for ${CASE_ID}.`);
    });

    expect(repository.listCasesWithWarnings).not.toHaveBeenCalled();
    expect(result.current.caseStartStatus).toBe('error');
  });

  it('lets a newer request supersede an older start without loading stale workspace state', async () => {
    vi.restoreAllMocks();
    vi.spyOn(Date.prototype, 'getUTCFullYear').mockReturnValue(2026);
    useGeneratedSuffixes(
      [0, 1, 2, 27, 28, 29],
      [23, 24, 25, 33, 34, 35],
    );
    const repository = createRepository();
    const firstStart = deferred<{ caseId: string; jobKey: string }>();
    const secondStart = deferred<{ caseId: string; jobKey: string }>();
    const caseStarter = vi.fn()
      .mockReturnValueOnce(firstStart.promise)
      .mockReturnValueOnce(secondStart.promise);
    const { result } = await renderReady(repository, options(repository, { caseStarter }));
    const secondWorkspace = liveWorkspace(SECOND_CASE_ID);
    repository.listCasesWithWarnings.mockResolvedValue({ data: [secondWorkspace.case], warnings: [] });
    repository.loadWorkspaceWithWarnings.mockResolvedValue({ data: secondWorkspace, warnings: [] });

    let firstPromise!: ReturnType<typeof result.current.startCase>;
    let secondPromise!: ReturnType<typeof result.current.startCase>;
    act(() => {
      firstPromise = result.current.startCase({
        caseType: 'StateMedicaidHospice',
        requesterEmail: 'first@example.gov',
      });
      secondPromise = result.current.startCase({
        caseType: 'StateMedicaidHospice',
        requesterEmail: 'second@example.gov',
      });
    });

    await act(async () => {
      secondStart.resolve({ caseId: SECOND_CASE_ID, jobKey: 'second-job-key' });
      await secondPromise;
    });
    await act(async () => {
      firstStart.resolve({ caseId: CASE_ID, jobKey: 'first-job-key' });
      await expect(firstPromise).rejects.toThrow('Case start was superseded by a newer request.');
    });

    expect(repository.loadWorkspaceWithWarnings).toHaveBeenCalledOnce();
    expect(repository.loadWorkspaceWithWarnings).toHaveBeenCalledWith(SECOND_CASE_ID);
    expect(result.current.workspace?.case.id).toBe(SECOND_CASE_ID);
    expect(result.current.caseStartStatus).toBe('registered');
  });

  it('does not poll or update stale workspace state after unmount', async () => {
    const repository = createRepository();
    const started = deferred<{ caseId: string; jobKey: string }>();
    const caseStarter = vi.fn(() => started.promise);
    const view = await renderReady(repository, options(repository, { caseStarter }));

    const startPromise = view.result.current.startCase({
      caseType: 'StateMedicaidHospice',
      requesterEmail: 'investigator@example.gov',
    });
    view.unmount();
    started.resolve({ caseId: CASE_ID, jobKey: JOB_KEY });

    await expect(startPromise).rejects.toThrow('Case start was superseded by a newer request.');
    expect(repository.listCasesWithWarnings).not.toHaveBeenCalled();
    expect(repository.loadWorkspaceWithWarnings).not.toHaveBeenCalled();
  });
});

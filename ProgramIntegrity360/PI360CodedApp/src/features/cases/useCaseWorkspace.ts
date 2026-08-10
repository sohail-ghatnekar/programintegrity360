import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { UiPath } from '@uipath/uipath-typescript/core';
import { getUiPathRuntimeConfig } from '../../config/uipath';
import type { UiPathRuntimeConfig } from '../../config/uipath';
import { useOptionalAuth } from '../../hooks/useAuth';
import {
  LiveCaseRepository,
  RepositoryOperationError,
} from '../../services/uipath/liveCaseRepository';
import type {
  LiveCaseRepositoryConfig,
  RepositoryOperationResult,
} from '../../services/uipath/liveCaseRepository';
import { DataFabricCaseRepository } from '../../services/uipath/dataFabricCaseRepository';
import { createCaseStarter } from '../../services/uipath/caseStarter';
import type { CaseStarter } from '../../services/uipath/caseStarter';
import type { Pi360EntityIds } from '../../config/uipath';
import { buildCaseStartPayload } from './caseIntakeCatalog';
import type { CaseType } from './caseIntakeCatalog';
import { DemoCaseRepository } from './demoRepository';
import type { CaseRepository, CaseSummary, CaseWorkspaceSnapshot, DeepReadonly } from './types';

export type CaseWorkspaceStatus = 'idle' | 'loading' | 'live' | 'demo' | 'error';

export type CaseWorkspaceRefreshResult =
  | { ok: true }
  | { ok: false; error: Error };

export type CaseStartStatus = 'idle' | 'starting' | 'polling' | 'registered' | 'pending' | 'error';

export type CaseStartOutcome =
  | { status: 'registered'; caseId: string; jobKey: string }
  | { status: 'pending'; caseId: string; jobKey: string };

export type CaseStartPollPolicy = {
  attempts: number;
  intervalMs: number;
};

type WarningRepository = CaseRepository & {
  listCasesWithWarnings?: () => Promise<RepositoryOperationResult<readonly DeepReadonly<CaseSummary>[]>>;
  loadWorkspaceWithWarnings?: (
    caseId: string,
  ) => Promise<RepositoryOperationResult<CaseWorkspaceSnapshot>>;
};

type LiveRepositoryFactory = (
  sdk: UiPath,
  config: ConfiguredCaseRepository,
) => WarningRepository;

type ConfiguredCaseRepository = LiveCaseRepositoryConfig & {
  entityIds: Partial<Pi360EntityIds>;
};

export type UseCaseWorkspaceOptions = {
  runtimeConfig?: UiPathRuntimeConfig;
  demoRepository?: CaseRepository;
  liveRepositoryFactory?: LiveRepositoryFactory;
  caseStarter?: CaseStarter;
  delay?: (milliseconds: number) => Promise<void>;
  pollPolicy?: CaseStartPollPolicy;
};

const defaultDemoRepository = new DemoCaseRepository();
export const DEFAULT_CASE_START_POLL_POLICY: Readonly<CaseStartPollPolicy> = Object.freeze({
  attempts: 10,
  intervalMs: 1500,
});
const defaultDelay = (milliseconds: number) => new Promise<void>((resolve) => {
  window.setTimeout(resolve, milliseconds);
});
const entityKeys: Array<keyof Pi360EntityIds> = [
  'cases',
  'providers',
  'attendants',
  'claims',
  'evvVisits',
  'riskSignals',
  'evidenceDocuments',
  'investigationActions',
  'decisions',
];

function hasCompleteEntityMapping(entityIds?: Partial<Pi360EntityIds>): entityIds is Pi360EntityIds {
  if (!entityIds) return false;
  return entityKeys.every((key) => Boolean(entityIds[key]?.trim()));
}

const defaultLiveRepositoryFactory: LiveRepositoryFactory = (sdk, config) => {
  const runtimeRepository = new LiveCaseRepository(sdk, config);
  return hasCompleteEntityMapping(config.entityIds)
    ? new DataFabricCaseRepository(sdk, { entityIds: config.entityIds }, runtimeRepository)
    : runtimeRepository;
};

function errorMessage(reason: unknown): string {
  return reason instanceof Error ? reason.message : 'Unknown UiPath service error';
}

function errorWarnings(reason: unknown): readonly string[] {
  return reason instanceof RepositoryOperationError ? reason.warnings : [];
}

function refreshFailure(reason: unknown): CaseWorkspaceRefreshResult {
  return {
    ok: false,
    error: reason instanceof Error ? reason : new Error(errorMessage(reason)),
  };
}

const refreshSucceeded: CaseWorkspaceRefreshResult = { ok: true };
const refreshSuperseded = () => refreshFailure(new Error('Case workspace refresh was superseded by a newer request.'));
const caseStartSuperseded = () => new Error('Case start was superseded by a newer request.');

function matchesBusinessCaseId(candidate: DeepReadonly<CaseSummary>, caseId: string): boolean {
  const expected = caseId.trim().toUpperCase();
  return [candidate.id, candidate.businessCaseId].some(
    (value) => typeof value === 'string' && value.trim().toUpperCase() === expected,
  );
}

function portalOriginFromPlatformBase(platformBaseUrl: string): string {
  try {
    const url = new URL(platformBaseUrl);
    if (url.hostname === 'api.uipath.com') {
      url.hostname = 'cloud.uipath.com';
    } else {
      url.hostname = url.hostname.replace('.api.', '.');
    }
    return url.origin;
  } catch {
    return window.location.origin;
  }
}

function repositoryConfig(runtime: UiPathRuntimeConfig): ConfiguredCaseRepository {
  return {
    caseProcessName: runtime.caseProcessName,
    folderKey: runtime.folderKey,
    folderId: runtime.folderId,
    portalOrigin: portalOriginFromPlatformBase(runtime.platformBaseUrl),
    organizationName: runtime.config.orgName ?? '',
    tenantName: runtime.config.tenantName ?? '',
    entityIds: runtime.entityIds ?? {},
  };
}

function listCasesWithWarnings(
  repository: WarningRepository,
): Promise<RepositoryOperationResult<readonly DeepReadonly<CaseSummary>[]>> {
  if (repository.listCasesWithWarnings) {
    return repository.listCasesWithWarnings();
  }
  return repository.listCases().then((data) => ({ data, warnings: [] }));
}

function loadWorkspaceWithWarnings(
  repository: WarningRepository,
  caseId: string,
): Promise<RepositoryOperationResult<CaseWorkspaceSnapshot>> {
  if (repository.loadWorkspaceWithWarnings) {
    return repository.loadWorkspaceWithWarnings(caseId);
  }
  return repository.loadWorkspace(caseId).then((data) => ({ data, warnings: [] }));
}

export function useCaseWorkspace(options: UseCaseWorkspaceOptions = {}) {
  const auth = useOptionalAuth();
  const runtime = useMemo(
    () => options.runtimeConfig ?? getUiPathRuntimeConfig(),
    [options.runtimeConfig],
  );
  const liveConfig = useMemo(() => repositoryConfig(runtime), [runtime]);
  const demoRepository = options.demoRepository ?? defaultDemoRepository;
  const repositoryFactory = options.liveRepositoryFactory ?? defaultLiveRepositoryFactory;
  const delay = options.delay ?? defaultDelay;
  const pollPolicy = options.pollPolicy ?? DEFAULT_CASE_START_POLL_POLICY;
  const liveRepository = useMemo(
    () => auth?.sdk ? repositoryFactory(auth.sdk, liveConfig) : null,
    [auth?.sdk, liveConfig, repositoryFactory],
  );
  const caseStarter = useMemo(() => {
    if (options.caseStarter) return options.caseStarter;
    if (!auth?.sdk) return null;
    return async (request: Parameters<CaseStarter>[0]) => createCaseStarter(auth.sdk, {
      folderId: runtime.folderId ?? undefined,
      processName: runtime.caseProcessName || undefined,
    })(request);
  }, [auth?.sdk, options.caseStarter, runtime.caseProcessName, runtime.folderId]);
  const [cases, setCases] = useState<readonly DeepReadonly<CaseSummary>[]>([]);
  const [workspace, setWorkspace] = useState<CaseWorkspaceSnapshot | null>(null);
  const [status, setStatus] = useState<CaseWorkspaceStatus>('idle');
  const [warnings, setWarnings] = useState<readonly string[]>([]);
  const [caseStartStatus, setCaseStartStatus] = useState<CaseStartStatus>('idle');
  const [caseStartMessage, setCaseStartMessage] = useState<string | null>(null);
  const selectedCaseId = useRef<string | null>(null);
  const requestId = useRef(0);
  const caseStartRequestId = useRef(0);
  const mounted = useRef(true);

  const loadDemo = useCallback(async (): Promise<CaseWorkspaceRefreshResult> => {
    const currentRequest = ++requestId.current;
    setStatus('loading');

    try {
      const demoCases = await demoRepository.listCases();
      if (currentRequest !== requestId.current) return refreshSuperseded();
      const selected = demoCases.find((candidate) => candidate.id === selectedCaseId.current) ?? demoCases[0];
      if (!selected) {
        throw new Error('Demo case repository returned no cases.');
      }
      const demoWorkspace = await demoRepository.loadWorkspace(selected.id);
      if (currentRequest !== requestId.current) return refreshSuperseded();

      selectedCaseId.current = selected.id;
      setCases(demoCases);
      setWorkspace(demoWorkspace);
      setWarnings([]);
      setStatus('demo');
      return refreshSucceeded;
    } catch (reason) {
      if (currentRequest !== requestId.current) return refreshSuperseded();
      setWorkspace(null);
      setWarnings([`Unable to load demo case data: ${errorMessage(reason)}.`]);
      setStatus('error');
      return refreshFailure(reason);
    }
  }, [demoRepository]);

  const loadLive = useCallback(async (preferredCaseId?: string | null): Promise<CaseWorkspaceRefreshResult> => {
    const currentRequest = ++requestId.current;
    let caseWarnings: readonly string[] = [];
    setStatus('loading');
    setWarnings([]);

    if (!liveRepository) {
      const reason = new Error('Authenticated UiPath SDK is unavailable.');
      setWorkspace(null);
      setWarnings([reason.message]);
      setStatus('error');
      return refreshFailure(reason);
    }

    try {
      const casesResult = await listCasesWithWarnings(liveRepository);
      caseWarnings = casesResult.warnings;
      if (currentRequest !== requestId.current) return refreshSuperseded();
      const liveCases = casesResult.data;
      const selected = liveCases.find((candidate) => candidate.id === preferredCaseId) ?? liveCases[0];
      if (!selected) {
        throw new Error(`No instances found for ${liveConfig.caseProcessName || 'the configured case process'}`);
      }
      const workspaceResult = await loadWorkspaceWithWarnings(liveRepository, selected.id);
      if (currentRequest !== requestId.current) return refreshSuperseded();

      selectedCaseId.current = selected.id;
      setCases(liveCases);
      setWorkspace(workspaceResult.data);
      setWarnings([...casesResult.warnings, ...workspaceResult.warnings]);
      setStatus('live');
      return refreshSucceeded;
    } catch (reason) {
      if (currentRequest !== requestId.current) return refreshSuperseded();
      setWorkspace(null);
      setWarnings([...new Set([
        ...caseWarnings,
        ...errorWarnings(reason),
        `Unable to load live UiPath case data: ${errorMessage(reason)}.`,
      ])]);
      setStatus('error');
      return refreshFailure(reason);
    }
  }, [liveConfig.caseProcessName, liveRepository]);

  const refresh = useCallback(async (): Promise<CaseWorkspaceRefreshResult> => {
    if (auth?.isLoading) {
      setStatus('idle');
      return refreshFailure(new Error('UiPath authentication is still loading.'));
    }

    if (auth?.isAuthenticated) {
      return loadLive(selectedCaseId.current);
    }
    return loadDemo();
  }, [auth?.isAuthenticated, auth?.isLoading, loadDemo, loadLive]);

  const useDemoData = useCallback(async () => {
    await loadDemo();
  }, [loadDemo]);

  const selectCase = useCallback(async (caseId: string) => {
    selectedCaseId.current = caseId;
    if (auth?.isAuthenticated) {
      await loadLive(caseId);
    } else {
      await loadDemo();
    }
  }, [auth?.isAuthenticated, loadDemo, loadLive]);

  const startCase = useCallback(async (input: {
    caseType: CaseType;
    requesterEmail: string;
  }): Promise<CaseStartOutcome> => {
    const currentRequest = ++caseStartRequestId.current;
    requestId.current += 1;
    const isCurrent = () => mounted.current && currentRequest === caseStartRequestId.current;
    const requireCurrent = () => {
      if (!isCurrent()) throw caseStartSuperseded();
    };

    const rejectStart = (reason: unknown): never => {
      requireCurrent();
      const error = reason instanceof Error ? reason : new Error(errorMessage(reason));
      setCaseStartStatus('error');
      setCaseStartMessage(error.message);
      throw error;
    };

    if (!auth?.isAuthenticated || !caseStarter || !liveRepository) {
      return rejectStart(new Error('Connect UiPath to start a case.'));
    }

    setCaseStartStatus('starting');
    setCaseStartMessage(null);

    try {
      const payload = buildCaseStartPayload(input);
      const started = await caseStarter(payload);
      requireCurrent();

      if (started.caseId !== payload.caseId) {
        throw new Error(`UiPath process start returned a mismatched case ID for ${payload.caseId}.`);
      }

      setCaseStartStatus('polling');
      let lastPollError: unknown;
      for (let attempt = 0; attempt < pollPolicy.attempts; attempt += 1) {
        await delay(pollPolicy.intervalMs);
        requireCurrent();

        let discovered: RepositoryOperationResult<readonly DeepReadonly<CaseSummary>[]>;
        try {
          discovered = await listCasesWithWarnings(liveRepository);
        } catch (reason) {
          requireCurrent();
          lastPollError = reason;
          continue;
        }
        requireCurrent();

        if (!discovered.data.some((candidate) => matchesBusinessCaseId(candidate, payload.caseId))) {
          continue;
        }

        const loaded = await loadLive(payload.caseId);
        requireCurrent();
        if (!loaded.ok) {
          throw loaded.error;
        }

        setCaseStartStatus('registered');
        setCaseStartMessage(`Case ${payload.caseId} is ready.`);
        return {
          status: 'registered',
          caseId: payload.caseId,
          jobKey: started.jobKey,
        };
      }

      requireCurrent();
      if (lastPollError !== undefined) {
        const warning = `Unable to confirm workspace registration for ${payload.caseId}: ${errorMessage(lastPollError)}.`;
        setWarnings((current) => [...new Set([...current, warning])]);
      }
      setCaseStartStatus('pending');
      setCaseStartMessage(`Process started; workspace registration is pending for ${payload.caseId}.`);
      return {
        status: 'pending',
        caseId: payload.caseId,
        jobKey: started.jobKey,
      };
    } catch (reason) {
      if (!isCurrent()) throw caseStartSuperseded();
      return rejectStart(reason);
    }
  }, [auth?.isAuthenticated, caseStarter, delay, liveRepository, loadLive, pollPolicy]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      caseStartRequestId.current += 1;
      requestId.current += 1;
    };
  }, []);

  useEffect(() => {
    if (auth?.isLoading) {
      setStatus('idle');
      return;
    }

    if (auth?.isAuthenticated) {
      void loadLive(selectedCaseId.current);
    } else {
      void loadDemo();
    }

    return () => {
      requestId.current += 1;
    };
  }, [auth?.isAuthenticated, auth?.isLoading, loadDemo, loadLive]);

  return {
    cases,
    workspace,
    status,
    warnings,
    refresh,
    useDemoData,
    selectCase,
    startCase,
    caseStartStatus,
    caseStartMessage,
  };
}

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
import type { Pi360EntityIds } from '../../config/uipath';
import { DemoCaseRepository } from './demoRepository';
import type { CaseRepository, CaseSummary, CaseWorkspaceSnapshot, DeepReadonly } from './types';

export type CaseWorkspaceStatus = 'idle' | 'loading' | 'live' | 'demo' | 'error';

export type CaseWorkspaceRefreshResult =
  | { ok: true }
  | { ok: false; error: Error };

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
};

const defaultDemoRepository = new DemoCaseRepository();
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
  const liveRepository = useMemo(
    () => auth?.sdk ? repositoryFactory(auth.sdk, liveConfig) : null,
    [auth?.sdk, liveConfig, repositoryFactory],
  );
  const [cases, setCases] = useState<readonly DeepReadonly<CaseSummary>[]>([]);
  const [workspace, setWorkspace] = useState<CaseWorkspaceSnapshot | null>(null);
  const [status, setStatus] = useState<CaseWorkspaceStatus>('idle');
  const [warnings, setWarnings] = useState<readonly string[]>([]);
  const selectedCaseId = useRef<string | null>(null);
  const requestId = useRef(0);

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
  };
}

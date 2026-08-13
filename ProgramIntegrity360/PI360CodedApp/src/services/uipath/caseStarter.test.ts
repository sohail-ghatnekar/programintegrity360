import type { UiPath } from '@uipath/uipath-typescript/core';
import type {
  ProcessGetResponse,
  ProcessStartResponse,
} from '@uipath/uipath-typescript/processes';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { CaseStartPayload } from '../../features/cases/caseIntakeCatalog';
import uipathConfig from '../../../uipath.json';

const sdkModuleState = vi.hoisted(() => ({
  entityModuleLoads: 0,
  processesConstructor: vi.fn(),
  getAll: vi.fn(),
  start: vi.fn(),
}));

vi.mock('@uipath/uipath-typescript/entities', () => {
  sdkModuleState.entityModuleLoads += 1;
  return {
    Entities: class Entities {},
  };
});

vi.mock('@uipath/uipath-typescript/processes', () => ({
  Processes: class Processes {
    constructor(sdk: UiPath) {
      sdkModuleState.processesConstructor(sdk);
    }

    getAll = sdkModuleState.getAll;
    start = sdkModuleState.start;
  },
}));

import {
  DEFAULT_CASE_PROCESS_FOLDER_ID,
  DEFAULT_CASE_PROCESS_NAME,
  createCaseStarter,
  type ProcessesFactory,
} from './caseStarter';

const CASE_ID = 'PI-HSP-2026-ABC123';
const PROCESS_KEY = 'AF6729CE-F675-4943-8483-0B4A065C3152';
const JOB_KEY = '6d829526-34d4-4678-bf02-5d137fa1fc0d';

const inputArguments: CaseStartPayload = {
  caseInput: {
    caseId: CASE_ID,
    caseType: 'StateMedicaidHospice',
    requesterEmail: 'investigator@example.gov',
  },
  claimInput: { claimId: 'CLM-HSP-2026-0714-001', totalBilled: 3250 },
  memberInput: { memberId: 'MBR-071426', memberName: 'Jordan Ellis' },
  providerInput: { providerId: 'PRV-100482' },
  serviceEventInput: { dateOfService: '2026-07-14' },
  documentInput: { patientClass: 'Observation' },
};

function processFixture(overrides: Partial<ProcessGetResponse> = {}): ProcessGetResponse {
  return {
    key: PROCESS_KEY,
    packageKey: 'ProgramIntegrity360.Case.PI360CaseManagement',
    packageVersion: '0.6.1',
    isLatestVersion: true,
    isPackageDeleted: false,
    description: '',
    name: 'PI360CaseManagement',
    entryPointId: 3994729,
    packageType: 'CaseManagement' as ProcessGetResponse['packageType'],
    supportsMultipleEntryPoints: true,
    isConversational: false,
    minRequiredRobotVersion: null,
    isCompiled: true,
    arguments: {},
    autoUpdate: false,
    hiddenForAttendedUser: false,
    feedId: '93949a13-9388-45bb-af90-5783a67e1b33',
    folderKey: '5db31dd1-1073-4f9e-b44b-76f5484e03c4',
    folderId: 2182825,
    folderName: 'AMER Presales/Public Sector/ProgramIntegrity360',
    targetFramework: 'Portable' as ProcessGetResponse['targetFramework'],
    robotSize: null,
    lastModifiedTime: '2026-08-09T15:25:10.393Z',
    lastModifierUserId: null,
    createdTime: '2026-08-07T15:05:14.300Z',
    creatorUserId: 0,
    ...overrides,
  } as ProcessGetResponse;
}

function jobFixture(overrides: Partial<ProcessStartResponse> = {}): ProcessStartResponse {
  return {
    key: JOB_KEY,
    startTime: null,
    endTime: null,
    state: 'Pending' as ProcessStartResponse['state'],
    source: 'Apps',
    sourceType: 'Apps',
    batchExecutionKey: '',
    info: null,
    createdTime: '2026-08-10T12:00:00.000Z',
    startingScheduleId: null,
    processName: 'PI360CaseManagement',
    type: 'Unattended' as ProcessStartResponse['type'],
    inputFile: null,
    outputArguments: null,
    outputFile: null,
    hostMachineName: null,
    persistenceId: null,
    resumeVersion: null,
    stopStrategy: null,
    runtimeType: '',
    processVersionId: null,
    reference: CASE_ID,
    packageType: 'CaseManagement' as ProcessStartResponse['packageType'],
    resumeOnSameContext: false,
    localSystemAccount: '',
    orchestratorUserIdentity: null,
    startingTriggerId: null,
    maxExpectedRunningTimeSeconds: null,
    parentJobKey: null,
    resumeTime: null,
    lastModifiedTime: null,
    jobError: null,
    errorCode: null,
    id: 461900,
    folderId: 2182825,
    folderName: 'AMER Presales/Public Sector/ProgramIntegrity360',
    ...overrides,
  } as ProcessStartResponse;
}

function injectedStarter(
  overrides: {
    folderId?: number;
    processName?: string;
    processesFactory?: ProcessesFactory;
  } = {},
) {
  const sdk = {} as UiPath;
  const processesFactory: ProcessesFactory = overrides.processesFactory ?? (() => ({
    getAll: sdkModuleState.getAll,
    start: sdkModuleState.start,
  }));

  return {
    sdk,
    startCase: createCaseStarter(sdk, {
      folderId: overrides.folderId,
      processName: overrides.processName,
      processesFactory,
    }),
  };
}

describe('createCaseStarter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sdkModuleState.getAll.mockResolvedValue({
      items: [processFixture({ name: 'Other process', key: 'other-key' }), processFixture()],
      totalCount: 2,
    });
    sdkModuleState.start.mockResolvedValue([jobFixture()]);
  });

  it('uses the installed Processes SDK contract to start the exact v30 case release', async () => {
    const activeSdk = {} as UiPath;
    const startCase = createCaseStarter(activeSdk);

    const result = await startCase({ caseId: CASE_ID, inputArguments });

    expect(DEFAULT_CASE_PROCESS_FOLDER_ID).toBe(2182825);
    expect(DEFAULT_CASE_PROCESS_NAME).toBe('PI360CaseManagement');
    expect(sdkModuleState.processesConstructor).toHaveBeenCalledOnce();
    expect(sdkModuleState.processesConstructor).toHaveBeenCalledWith(activeSdk);
    expect(sdkModuleState.getAll).toHaveBeenCalledOnce();
    expect(sdkModuleState.getAll).toHaveBeenCalledWith({ folderId: 2182825 });
    expect(sdkModuleState.start).toHaveBeenCalledOnce();
    expect(sdkModuleState.start).toHaveBeenCalledWith({
      processKey: PROCESS_KEY,
      reference: CASE_ID,
      inputArguments: JSON.stringify(inputArguments),
    }, 2182825);
    expect(JSON.parse(sdkModuleState.start.mock.calls[0][0].inputArguments)).toEqual(inputArguments);
    expect(Object.keys(JSON.parse(sdkModuleState.start.mock.calls[0][0].inputArguments))).toEqual([
      'caseInput',
      'claimInput',
      'memberInput',
      'providerInput',
      'serviceEventInput',
      'documentInput',
    ]);
    expect(result).toEqual({ caseId: CASE_ID, jobKey: JOB_KEY });
    expect(sdkModuleState.entityModuleLoads).toBe(0);
  });

  it('keeps live workspace discovery on the same process name as process start', () => {
    expect(uipathConfig.caseProcessName).toBe(DEFAULT_CASE_PROCESS_NAME);
  });

  it('supports an injected Processes factory, folder ID, and future process name', async () => {
    const createProcesses = vi.fn(() => ({
      getAll: sdkModuleState.getAll,
      start: sdkModuleState.start,
    }));
    sdkModuleState.getAll.mockResolvedValue({
      items: [processFixture({ name: 'FutureCasePath', key: 'future-key', folderId: 42 })],
      totalCount: 1,
    });
    const { sdk, startCase } = injectedStarter({
      folderId: 42,
      processName: 'FutureCasePath',
      processesFactory: createProcesses,
    });

    await startCase({ caseId: CASE_ID, inputArguments });

    expect(createProcesses).toHaveBeenCalledWith(sdk);
    expect(sdkModuleState.getAll).toHaveBeenCalledWith({ folderId: 42 });
    expect(sdkModuleState.start).toHaveBeenCalledWith(expect.objectContaining({
      processKey: 'future-key',
    }), 42);
  });

  it('requires an exact single process-name match', async () => {
    sdkModuleState.getAll.mockResolvedValue({
      items: [processFixture({ name: 'PI360CaseManagement backup' })],
      totalCount: 1,
    });
    const { startCase } = injectedStarter();

    await expect(startCase({ caseId: CASE_ID, inputArguments })).rejects.toThrow(
      'No UiPath process named "PI360CaseManagement" was found in folder 2182825.',
    );
    expect(sdkModuleState.start).not.toHaveBeenCalled();
  });

  it('rejects ambiguous duplicate process-name matches', async () => {
    sdkModuleState.getAll.mockResolvedValue({
      items: [processFixture(), processFixture({ key: 'duplicate-key', id: 461901 })],
      totalCount: 2,
    });
    const { startCase } = injectedStarter();

    await expect(startCase({ caseId: CASE_ID, inputArguments })).rejects.toThrow(
      'Found 2 UiPath processes named "PI360CaseManagement" in folder 2182825; expected exactly one.',
    );
    expect(sdkModuleState.start).not.toHaveBeenCalled();
  });

  it.each([
    ['deleted', { isPackageDeleted: true }],
    ['uncompiled', { isCompiled: false }],
  ])('excludes a sole %s exact-name release from start eligibility', async (_label, overrides) => {
    sdkModuleState.getAll.mockResolvedValue({
      items: [processFixture(overrides)],
      totalCount: 1,
    });
    const { startCase } = injectedStarter();

    await expect(startCase({ caseId: CASE_ID, inputArguments })).rejects.toThrow(
      'No UiPath process named "PI360CaseManagement" was found in folder 2182825.',
    );
    expect(sdkModuleState.start).not.toHaveBeenCalled();
  });

  it('starts the runnable release when a deleted exact-name release also exists', async () => {
    sdkModuleState.getAll.mockResolvedValue({
      items: [
        processFixture({ key: 'deleted-key', isPackageDeleted: true, id: 461901 }),
        processFixture(),
      ],
      totalCount: 2,
    });
    const { startCase } = injectedStarter();

    await startCase({ caseId: CASE_ID, inputArguments });

    expect(sdkModuleState.start).toHaveBeenCalledOnce();
    expect(sdkModuleState.start).toHaveBeenCalledWith(expect.objectContaining({
      processKey: PROCESS_KEY,
    }), 2182825);
  });

  it('keeps a runnable nonlatest exact-name release eligible', async () => {
    sdkModuleState.getAll.mockResolvedValue({
      items: [processFixture({ isLatestVersion: false })],
      totalCount: 1,
    });
    const { startCase } = injectedStarter();

    await startCase({ caseId: CASE_ID, inputArguments });

    expect(sdkModuleState.start).toHaveBeenCalledOnce();
  });

  it.each([
    ['missing', { key: undefined }],
    ['blank', { key: '   ' }],
  ])('rejects a %s release key before calling start', async (_label, overrides) => {
    sdkModuleState.getAll.mockResolvedValue({
      items: [processFixture(overrides as Partial<ProcessGetResponse>)],
      totalCount: 1,
    });
    const { startCase } = injectedStarter();

    await expect(startCase({ caseId: CASE_ID, inputArguments })).rejects.toThrow(
      'UiPath process "PI360CaseManagement" in folder 2182825 has no valid release key.',
    );
    expect(sdkModuleState.start).not.toHaveBeenCalled();
  });

  it.each([
    ['a nested case ID mismatch', {
      caseId: CASE_ID,
      inputArguments: {
        ...inputArguments,
        caseInput: { ...inputArguments.caseInput, caseId: 'PI-HSP-2026-XYZ999' },
      },
    }],
    ['an unsupported nested case type', {
      caseId: CASE_ID,
      inputArguments: {
        ...inputArguments,
        caseInput: { ...inputArguments.caseInput, caseType: 'MedicareHospice' },
      },
    }],
    ['a PCS case type with an HSP-prefixed ID', {
      caseId: CASE_ID,
      inputArguments: {
        ...inputArguments,
        caseInput: { ...inputArguments.caseInput, caseType: 'MedicaidPCS' },
      },
    }],
    ['a hospice case type with a PCS-prefixed ID', {
      caseId: 'PI-PCS-2026-ABC123',
      inputArguments: {
        ...inputArguments,
        caseInput: {
          ...inputArguments.caseInput,
          caseId: 'PI-PCS-2026-ABC123',
          caseType: 'StateMedicaidHospice',
        },
      },
    }],
  ])('rejects %s before process inventory or start', async (_label, request) => {
    const { startCase } = injectedStarter();

    await expect(startCase(request as Parameters<typeof startCase>[0])).rejects.toThrow();
    expect(sdkModuleState.getAll).not.toHaveBeenCalled();
    expect(sdkModuleState.start).not.toHaveBeenCalled();
  });

  it.each([
    ['an empty array', []],
    ['null', null],
    ['an unsupported direct job object', jobFixture()],
    ['an object envelope', { items: [jobFixture()] }],
    ['a missing job key', [jobFixture({ key: undefined as unknown as string })]],
    ['a blank job key', [jobFixture({ key: '   ' })]],
  ])('rejects %s as a malformed SDK start response', async (_label, response) => {
    sdkModuleState.start.mockResolvedValue(response);
    const { startCase } = injectedStarter();

    await expect(startCase({ caseId: CASE_ID, inputArguments })).rejects.toThrow(
      `UiPath process "PI360CaseManagement" returned no valid started job key for ${CASE_ID}.`,
    );
  });

  it('reports a process-inventory SDK rejection with the resolution stage and original cause', async () => {
    sdkModuleState.getAll.mockRejectedValue(new Error('inventory unavailable'));
    const { startCase } = injectedStarter();

    await expect(startCase({ caseId: CASE_ID, inputArguments })).rejects.toThrow(
      'Failed to resolve UiPath process "PI360CaseManagement" in folder 2182825: inventory unavailable',
    );
    expect(sdkModuleState.start).not.toHaveBeenCalled();
  });

  it('reports a start SDK rejection with the execution stage and original cause', async () => {
    sdkModuleState.start.mockRejectedValue(new Error('runtime unavailable'));
    const { startCase } = injectedStarter();

    await expect(startCase({ caseId: CASE_ID, inputArguments })).rejects.toThrow(
      `Failed to start UiPath process "PI360CaseManagement" for ${CASE_ID}: runtime unavailable`,
    );
  });

  it.each([
    ['a blank case ID', { caseId: '   ', inputArguments }],
    ['a missing trigger object', {
      caseId: CASE_ID,
      inputArguments: {
        ...inputArguments,
        documentInput: undefined,
      },
    }],
    ['an extra top-level input', {
      caseId: CASE_ID,
      inputArguments: {
        ...inputArguments,
        seventhInput: {},
      },
    }],
  ])('rejects %s before process resolution or start', async (_label, request) => {
    const { startCase } = injectedStarter();

    await expect(startCase(request as Parameters<typeof startCase>[0])).rejects.toThrow();
    expect(sdkModuleState.getAll).not.toHaveBeenCalled();
    expect(sdkModuleState.start).not.toHaveBeenCalled();
  });

  it('rejects a malformed process-list envelope instead of treating it as no match', async () => {
    sdkModuleState.getAll.mockResolvedValue({ value: [processFixture()] });
    const { startCase } = injectedStarter();

    await expect(startCase({ caseId: CASE_ID, inputArguments })).rejects.toThrow(
      'UiPath returned a malformed process inventory for folder 2182825.',
    );
    expect(sdkModuleState.start).not.toHaveBeenCalled();
  });

  it('does not mutate the caller-owned case ID or six trigger objects', async () => {
    const request = {
      caseId: CASE_ID,
      inputArguments: structuredClone(inputArguments),
    };
    const before = structuredClone(request);
    Object.freeze(request);
    Object.values(request.inputArguments).forEach(Object.freeze);
    Object.freeze(request.inputArguments);

    const { startCase } = injectedStarter();
    await startCase(request);

    expect(request).toEqual(before);
    expect(request.caseId).toBe(CASE_ID);
  });
});

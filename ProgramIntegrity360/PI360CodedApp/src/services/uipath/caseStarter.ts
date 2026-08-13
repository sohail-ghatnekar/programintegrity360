import type { UiPath } from '@uipath/uipath-typescript/core';
import {
  Processes,
  type ProcessServiceModel,
  type ProcessStartRequest,
} from '@uipath/uipath-typescript/processes';

import type { CaseStartPayload } from '../../features/cases/caseIntakeCatalog';

export const DEFAULT_CASE_PROCESS_FOLDER_ID = 2182825;
export const DEFAULT_CASE_PROCESS_NAME = 'PI360CaseManagement';

const TRIGGER_INPUT_NAMES = [
  'caseInput',
  'claimInput',
  'memberInput',
  'providerInput',
  'serviceEventInput',
  'documentInput',
] as const;

type ProcessesClient = Pick<ProcessServiceModel, 'getAll' | 'start'>;

export type ProcessesFactory = (sdk: UiPath) => ProcessesClient;

export type CaseStartRequest = {
  caseId: string;
  inputArguments: CaseStartPayload;
};

export type CaseStartResult = {
  caseId: string;
  jobKey: string;
};

export type CaseStarter = (request: CaseStartRequest) => Promise<CaseStartResult>;

export type CaseStarterOptions = {
  folderId?: number;
  processName?: string;
  processesFactory?: ProcessesFactory;
};

function errorMessage(reason: unknown): string {
  if (reason instanceof Error && reason.message.trim()) {
    return reason.message.trim();
  }
  if (typeof reason === 'string' && reason.trim()) {
    return reason.trim();
  }
  return 'Unknown UiPath SDK error';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function assertValidRequest(request: CaseStartRequest): void {
  if (!/^PI-(?:PCS|HSP)-\d{4}-[A-Z0-9]{6}$/.test(request.caseId)) {
    throw new Error('Case start requires a valid generated PI360 case ID.');
  }

  if (!isRecord(request.inputArguments)) {
    throw new Error('Case start inputArguments must contain exactly the six Maestro trigger objects.');
  }

  const keys = Object.keys(request.inputArguments);
  const hasExactKeys = keys.length === TRIGGER_INPUT_NAMES.length
    && TRIGGER_INPUT_NAMES.every((name) => Object.hasOwn(request.inputArguments, name));
  const hasObjectValues = hasExactKeys && TRIGGER_INPUT_NAMES.every(
    (name) => isRecord(request.inputArguments[name]),
  );

  if (!hasObjectValues) {
    throw new Error('Case start inputArguments must contain exactly the six Maestro trigger objects.');
  }

  const caseInput = request.inputArguments.caseInput;
  const nestedCaseId = caseInput.caseId;
  const caseType = caseInput.caseType;
  if (nestedCaseId !== request.caseId) {
    throw new Error('caseInput.caseId must exactly match the outer case ID.');
  }
  if (caseType !== 'MedicaidPCS' && caseType !== 'StateMedicaidHospice') {
    throw new Error('caseInput.caseType must be MedicaidPCS or StateMedicaidHospice.');
  }

  const expectedPrefix = caseType === 'MedicaidPCS' ? 'PCS' : 'HSP';
  const caseTypePattern = new RegExp(`^PI-${expectedPrefix}-\\d{4}-[A-Z0-9]{6}$`);
  if (!caseTypePattern.test(request.caseId)) {
    throw new Error(
      `${caseType} case IDs must match PI-${expectedPrefix}-<year>-<six uppercase alphanumeric characters>.`,
    );
  }
}

export function createCaseStarter(
  sdk: UiPath,
  options: CaseStarterOptions = {},
): CaseStarter {
  const folderId = options.folderId ?? DEFAULT_CASE_PROCESS_FOLDER_ID;
  const processName = options.processName ?? DEFAULT_CASE_PROCESS_NAME;
  const processes = (options.processesFactory ?? ((activeSdk) => new Processes(activeSdk)))(sdk);

  return async (request) => {
    assertValidRequest(request);

    let inventory: unknown;
    try {
      inventory = await processes.getAll({ folderId });
    } catch (reason) {
      throw new Error(
        `Failed to resolve UiPath process "${processName}" in folder ${folderId}: ${errorMessage(reason)}`,
        { cause: reason },
      );
    }

    if (!isRecord(inventory) || !Array.isArray(inventory.items)) {
      throw new Error(`UiPath returned a malformed process inventory for folder ${folderId}.`);
    }

    const matches = inventory.items.filter(
      (release) => isRecord(release)
        && release.name === processName
        && release.isPackageDeleted !== true
        && release.isCompiled !== false,
    );
    if (matches.length === 0) {
      throw new Error(`No UiPath process named "${processName}" was found in folder ${folderId}.`);
    }
    if (matches.length > 1) {
      throw new Error(
        `Found ${matches.length} UiPath processes named "${processName}" in folder ${folderId}; expected exactly one.`,
      );
    }

    const processKey = typeof matches[0].key === 'string' ? matches[0].key.trim() : '';
    if (!processKey) {
      throw new Error(
        `UiPath process "${processName}" in folder ${folderId} has no valid release key.`,
      );
    }

    const startRequest: ProcessStartRequest = {
      processKey,
      reference: request.caseId,
      inputArguments: JSON.stringify(request.inputArguments),
    };

    let jobs: unknown;
    try {
      jobs = await processes.start(startRequest, folderId);
    } catch (reason) {
      throw new Error(
        `Failed to start UiPath process "${processName}" for ${request.caseId}: ${errorMessage(reason)}`,
        { cause: reason },
      );
    }

    const firstJob = Array.isArray(jobs) ? jobs[0] : undefined;
    const jobKey = isRecord(firstJob) && typeof firstJob.key === 'string'
      ? firstJob.key.trim()
      : '';
    if (!jobKey) {
      throw new Error(
        `UiPath process "${processName}" returned no valid started job key for ${request.caseId}.`,
      );
    }

    return Object.freeze({ caseId: request.caseId, jobKey });
  };
}

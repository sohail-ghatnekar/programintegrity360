export type CaseType = 'MedicaidPCS' | 'StateMedicaidHospice';

export type CaseTriggerInputName =
  | 'caseInput'
  | 'claimInput'
  | 'memberInput'
  | 'providerInput'
  | 'serviceEventInput'
  | 'documentInput';

export type CaseStartPayload = Record<CaseTriggerInputName, Record<string, unknown>>;

const CASE_TYPES: CaseType[] = ['MedicaidPCS', 'StateMedicaidHospice'];
const RANDOM_CHARACTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const SUFFIX_PATTERN = /^[A-Z0-9]{6}$/;
const SINGLE_EMAIL_PATTERN = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;

function assertCaseType(caseType: string): asserts caseType is CaseType {
  if (!CASE_TYPES.includes(caseType as CaseType)) {
    throw new Error(
      `Unsupported CaseType '${caseType}'. Expected MedicaidPCS or StateMedicaidHospice.`,
    );
  }
}

function normalizeRequesterEmail(requesterEmail: string): string {
  const normalized = requesterEmail.trim().toLowerCase();

  if (!SINGLE_EMAIL_PATTERN.test(normalized)) {
    throw new Error('Case intake requires one valid requester email address.');
  }

  return normalized;
}

function generateSuffix(): string {
  const bytes = new Uint8Array(6);
  globalThis.crypto.getRandomValues(bytes);

  return Array.from(bytes, (value) => RANDOM_CHARACTERS[value % RANDOM_CHARACTERS.length]).join('');
}

export function createCaseId(caseType: CaseType, now: Date, suffix: string): string {
  assertCaseType(caseType);

  if (!SUFFIX_PATTERN.test(suffix)) {
    throw new Error('Case ID suffix must contain exactly six uppercase alphanumeric characters.');
  }

  const year = now.getUTCFullYear();
  if (!Number.isInteger(year)) {
    throw new Error('Case ID requires a valid date.');
  }

  const scenarioCode = caseType === 'StateMedicaidHospice' ? 'HSP' : 'PCS';
  return `PI-${scenarioCode}-${year}-${suffix}`;
}

function hospicePayload(caseId: string, requesterEmail: string): CaseStartPayload {
  return {
    caseInput: {
      caseId,
      caseType: 'StateMedicaidHospice',
      requesterEmail,
      currentStage: 'Stage_Aintk1',
      title: 'Harbor Home Support Services — hospice location conflict review',
      program: 'State Medicaid Hospice',
      priority: 'High',
      riskScore: 82,
      triggerType: 'Claims Analytics Alert',
      triggerRef: 'ALERT-HSP-2026-0714',
    },
    claimInput: {
      claimId: 'CLM-HSP-2026-0714-001',
      totalUnits: 52,
      totalBilled: 3250,
      claimThreshold: 2500,
    },
    memberInput: {
      memberId: 'MBR-071426',
      medicaidId: 'NMCD-SYN-071426',
      memberName: 'Jordan Ellis',
      dateOfBirth: '1991-02-08',
    },
    providerInput: {
      providerId: 'PRV-100482',
      providerName: 'Harbor Home Support Services',
      caregiverId: 'ATT-HSP-4401',
      caregiverName: 'Taylor Brooks',
    },
    serviceEventInput: {
      lineId: 'LINE-0714-01',
      dateOfService: '2026-07-14',
      servicePeriodStart: '2026-07-13',
      servicePeriodEnd: '2026-07-16',
      serviceType: 'In-home hospice personal care',
      placeOfServiceCode: '12',
      placeOfServiceDescription: 'Member home',
      claimedServiceStartAt: '2026-07-14T09:00:00-05:00',
      claimedServiceEndAt: '2026-07-14T15:00:00-05:00',
      units: 24,
    },
    documentInput: {
      timesheetBucketPath:
        `Timesheets/hospice/${caseId}/incoming/01_personal_care_timesheet.pdf`,
      hospitalRecordBucketPath:
        `Hospital Records/hospice/${caseId}/provider-response/jordan_ellis_synthetic_medical_record_packet.pdf`,
      policyBucketPath: 'Policy Docs/reference/policy/03_personal_care_services_policy.pdf',
      hospitalRecordAvailable: false,
      hospitalRecordRequestRequired: true,
      patientClass: 'Observation',
      serviceEvidenceModel: 'PI360 Service Evidence Extractor',
      institutionalEncounterModel: 'PI360 Institutional Encounter Extractor',
      policyReferenceOnly: true,
    },
  };
}

function pcsPayload(caseId: string, requesterEmail: string): CaseStartPayload {
  return {
    caseInput: {
      caseId,
      caseType: 'MedicaidPCS',
      requesterEmail,
      currentStage: 'Stage_Aintk1',
      title: 'Harbor Home Support Services — PCS billing integrity review',
      program: 'Medicaid PCS',
      priority: 'High',
      riskScore: 72,
      triggerType: 'Claims Analytics Alert',
      triggerRef: 'ALERT-CA-2026-7781',
    },
    claimInput: {
      claimCount: 9,
      totalUnits: 176,
      totalBilled: 1267.2,
      claimThreshold: 0,
    },
    memberInput: {
      memberId: 'MBR-33915',
      memberName: 'Medicaid member under review',
    },
    providerInput: {
      providerId: 'PRV-100482',
      providerName: 'Harbor Home Support Services',
      attendantId: 'ATT-2087',
      attendantName: 'Jordan Ellis',
    },
    serviceEventInput: {
      servicePeriodStart: '2026-03-01',
      servicePeriodEnd: '2026-05-31',
      dateOfService: '2026-04-14',
      overlapMinutes: 90,
      unsupportedUnits: 24,
    },
    documentInput: {
      timesheetBucketPaths: [
        `Timesheets/pcs/${caseId}/incoming/timesheet_0416.pdf`,
        `Timesheets/pcs/${caseId}/incoming/timesheet_0519.pdf`,
      ],
      planOfCareBucketPath: `Policy Docs/pcs/${caseId}/incoming/poc_MBR-33915.pdf`,
      hospitalRecordAvailable: false,
      hospitalRecordRequestRequired: false,
      serviceEvidenceModel: 'PI360 Service Evidence Extractor',
      institutionalEncounterModel: null,
    },
  };
}

export function buildCaseStartPayload(input: {
  caseType: CaseType;
  requesterEmail: string;
  now?: Date;
  suffix?: string;
}): { caseId: string; inputArguments: CaseStartPayload } {
  assertCaseType(input.caseType);
  const requesterEmail = normalizeRequesterEmail(input.requesterEmail);
  const caseId = createCaseId(input.caseType, input.now ?? new Date(), input.suffix ?? generateSuffix());
  const inputArguments = input.caseType === 'StateMedicaidHospice'
    ? hospicePayload(caseId, requesterEmail)
    : pcsPayload(caseId, requesterEmail);

  return { caseId, inputArguments };
}

import { STAGE_DEFINITIONS } from './stages';
import type {
  ActivityEvent,
  CaseTaskModel,
  CaseWorkspaceSnapshot,
  CaseWorkspaceModel,
  DeepReadonly,
  EvidenceDocumentModel,
  RiskSignalModel,
  SourceMetadata,
} from './types';

const dataSource = 'demo' as const;
const sourceUpdatedAt = '2026-07-29T14:00:00Z';

function deepFreeze<T>(value: T): DeepReadonly<T> {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) {
      deepFreeze(child);
    }
  }

  return value as DeepReadonly<T>;
}

function withDemoSource<T extends { id: string | number }>(
  records: T[],
  sourceType: string,
): Array<T & SourceMetadata> {
  return records.map((record) => ({
    ...record,
    dataSource,
    sourceId: `${sourceType}:${record.id}`,
    sourceUpdatedAt,
  }));
}

const DEMO_CASE_WORKSPACE = deepFreeze<CaseWorkspaceModel>({
  dataSource,
  sourceId: 'demo-case-workspace:PI-PCS-2026-0041',
  sourceUpdatedAt,
  case: {
    dataSource,
    sourceId: 'case:PI-PCS-2026-0041',
    sourceUpdatedAt,
    id: 'PI-PCS-2026-0041',
    caseType: 'MedicaidPCS',
    memberId: 'MBR-33915',
    memberName: 'Medicaid member under review',
    title: 'Harbor Home Support Services - PCS billing integrity review',
    program: 'Medicaid PCS',
    priority: 'High',
    status: 'In Review',
    stage: 'Investigation and case management',
    trigger: 'ALERT-CA-2026-7781',
    alertDate: '2026-07-20',
    servicePeriod: '2026-03-01 to 2026-05-31',
    opened: '2026-07-22',
    slaDue: '2026-08-05 17:00Z',
    investigator: 'inv.taylor',
    supervisor: 'sup.morgan',
    providerId: 'PRV-100482',
    attendantId: 'ATT-2087',
    riskSignalCount: 5,
    sampleExposure: '$172.80',
    periodExposure: '$1,600',
    rangeExposure: '$18K-$42K',
  },
  stages: STAGE_DEFINITIONS.map((stage, index) => ({
    ...stage,
    dataSource,
    sourceId: `case-stage:PI-PCS-2026-0041:${stage.key}`,
    sourceUpdatedAt,
    status: index < 2 ? 'completed' : index === 2 ? 'active' : 'not-started',
    enteredAt: index < 3 ? ['2026-07-22T09:12:00Z', '2026-07-23T08:20:00Z', '2026-07-24T11:10:00Z'][index] : undefined,
    completedAt: index < 2 ? ['2026-07-22T10:45:00Z', '2026-07-23T09:35:00Z'][index] : undefined,
  })),
  provider: {
    dataSource,
    sourceId: 'provider:PRV-100482',
    sourceUpdatedAt,
    name: 'Harbor Home Support Services',
    medicaidId: 'MPI-4471902',
    npi: '1730456789',
    address: '2200 Marina Blvd, Suite 210',
    enrollment: 'Active',
    attendants: '22 active attendants',
    history: '1 provider education letter in 2024; no sanctions on record',
  },
  attendant: {
    dataSource,
    sourceId: 'attendant:ATT-2087',
    sourceUpdatedAt,
    name: 'Jordan Ellis',
    id: 'ATT-2087',
    role: 'Personal Care Attendant',
    cert: 'PCA-556210',
    certStatus: 'Expired 2026-03-31',
    docs: ['Signed training acknowledgment', 'Current background-check attestation'],
  },
  claims: [
    { id: 'CLM-0468', dos: '2026-03-03', member: 'MBR-33915', billed: 16, evv: 16, timesheet: 16, poc: 20, improper: 0, pocOverage: 0, status: 'Cleared', note: 'Matched EVV and timesheet', source: 'EVV-88201' },
    { id: 'CLM-0475', dos: '2026-03-10', member: 'MBR-33915', billed: 16, evv: 16, timesheet: 16, poc: 20, improper: 0, pocOverage: 0, status: 'Under Review', note: 'Manual/no-GPS method flag only', source: 'EVV-88208' },
    { id: 'CLM-0491', dos: '2026-04-14', member: 'MBR-33915', billed: 24, evv: 16, timesheet: 16, poc: 20, improper: 8, pocOverage: 4, status: 'Flagged', note: 'Overlap day; billed above EVV and POC', source: 'DOC-SN-0414' },
    { id: 'CLM-0492', dos: '2026-04-14', member: 'MBR-40122', billed: 14, evv: 14, timesheet: 14, poc: 16, improper: 0, pocOverage: 0, status: 'Under Review', note: 'Second member on overlap day', source: 'EVV-88237' },
    { id: 'CLM-0503', dos: '2026-04-16', member: 'MBR-33915', billed: 24, evv: 24, timesheet: 16, poc: 20, improper: 8, pocOverage: 4, status: 'Flagged', note: 'Timesheet DOC-TS-0416 supports 08:00-12:00', source: 'DOC-TS-0416' },
    { id: 'CLM-0517', dos: '2026-04-21', member: 'MBR-33915', billed: 18, evv: 18, timesheet: 18, poc: 20, improper: 0, pocOverage: 0, status: 'Cleared', note: 'Matched EVV and timesheet', source: 'EVV-88250' },
    { id: 'CLM-0528', dos: '2026-04-28', member: 'MBR-33915', billed: 20, evv: 20, timesheet: 20, poc: 20, improper: 0, pocOverage: 0, status: 'Under Review', note: 'Manual/no-GPS method flag only', source: 'EVV-88258' },
    { id: 'CLM-0540', dos: '2026-05-19', member: 'MBR-33915', billed: 24, evv: 24, timesheet: 20, poc: 20, improper: 4, pocOverage: 4, status: 'Flagged', note: 'Timesheet DOC-TS-0519 supports 08:00-13:00', source: 'DOC-TS-0519' },
    { id: 'CLM-0549', dos: '2026-05-26', member: 'MBR-33915', billed: 20, evv: 16, timesheet: 16, poc: 20, improper: 4, pocOverage: 0, status: 'Flagged', note: 'EVV-88288 supports 16 units', source: 'EVV-88288' },
  ].map((claim) => ({ ...claim, dataSource, sourceId: `claim:${claim.id}`, sourceUpdatedAt })),
  riskSignals: withDemoSource<Omit<RiskSignalModel, keyof SourceMetadata>>([
    { id: 'RS-01', name: 'Overlapping visits', rule: 'Same attendant, two EVV rows, time intervals intersect same date', result: '1 overlap on 2026-04-14; window 10:30-12:00 = 90 minutes across two members', severity: 'High', citations: ['EVV-88231', 'EVV-88237'] },
    { id: 'RS-02', name: 'Manual EVV / missing GPS', rule: 'count(capture_method=Manual and gps_confirmed=No) over period', result: '12 of 44 visits (27.3%)', severity: 'Medium', citations: ['EVV sample'] },
    { id: 'RS-03', name: 'Units above plan of care', rule: 'units_billed > poc_daily_units; overage = billed - poc', result: '3 dates of service; total overage 12 units', severity: 'High', citations: ['DOC-POC-33915', 'CLM-0491', 'CLM-0503', 'CLM-0540'] },
    { id: 'RS-04', name: 'Unsupported units', rule: 'improper = units_billed - min(evv_supported, timesheet_supported); flag > 0', result: '4 claims; 24 de-duplicated unsupported units', severity: 'High', citations: ['CLM-0491', 'CLM-0503', 'CLM-0540', 'CLM-0549'] },
    { id: 'RS-05', name: 'Personnel documentation gap', rule: 'credential_expiry < DOS or required document missing', result: 'Cert lapsed 2026-03-31; 8 DOS after lapse; 2 required docs missing', severity: 'Medium', citations: ['DOC-PP-2087'] },
  ], 'risk-signal'),
  evidenceDocuments: withDemoSource<Omit<EvidenceDocumentModel, keyof SourceMetadata>>([
    { id: 'DOC-TS-0416', type: 'Timesheet', source: 'Provider portal upload', confidence: 0.71, status: 'Human-validated', note: 'Handwritten time_out confirmed 12:00; contradicts CLM-0503', fields: { attendant: 'Jordan Ellis', member: 'MBR-33915', date: '2026-04-16', time_in: '08:00', time_out: '12:00', supported_units: '16' } },
    { id: 'DOC-TS-0519', type: 'Timesheet', source: 'Provider portal upload', confidence: 0.88, status: 'Auto-confirmed', note: 'Contradicts CLM-0540', fields: { attendant: 'Jordan Ellis', member: 'MBR-33915', date: '2026-05-19', time_in: '08:00', time_out: '13:00', supported_units: '20' } },
    { id: 'DOC-POC-33915', type: 'Plan of Care', source: 'Legacy care-management pull', confidence: 0.94, status: 'Auto-confirmed', note: 'Establishes 20 units/day used by RS-03', fields: { member: 'MBR-33915', authorized_units_per_day: '20', authorized_units_per_week: '80', service: 'Personal Care', effective: '2026-01-01', expires: '2026-12-31' } },
    { id: 'DOC-SN-0414', type: 'Service Note', source: 'Provider portal upload', confidence: 0.83, status: 'Needs review', note: 'Narrative supports AM-only visit; relevant to RS-01 / CLM-0491', fields: { member: 'MBR-33915', date: '2026-04-14', documented_end: '12:00', narrative: 'left at noon' } },
    { id: 'DOC-PP-2087', type: 'Personnel Packet', source: 'Provider records request', confidence: 0.9, status: 'Human-validated', note: 'Feeds RS-05; 2 docs missing; cert lapsed', fields: { attendant: 'ATT-2087', certification: 'PCA-556210', certification_expiry: '2026-03-31', missing_documents: '2' } },
    { id: 'DOC-CORR-01', type: 'Correspondence', source: 'Records-request inbox', confidence: 0.86, status: 'Human-validated', note: 'Provider response does not resolve the 04-16 EVV/timesheet mismatch', fields: { received: '2026-07-28', summary: 'Provider states 04-16 visit extended to 14:00 due to member need; acknowledges certification renewal in progress.' } },
  ], 'evidence'),
  caseTasks: withDemoSource<Omit<CaseTaskModel, keyof SourceMetadata>>([
    { id: 1002, folderId: 987654, type: 'App', title: 'Investigator review - reconciliation and narrative', priority: 'High', status: 'Pending', assignee: 'inv.taylor', sla: 'Due soon', gated: false, stageLabel: 'Investigation and case management', actionCenterUrl: 'https://cloud.uipath.com/demo/playground_/tasks/1002', createdAt: '2026-07-24T11:10:00Z' },
    { id: 1003, folderId: 987654, type: 'App', title: 'Supervisor approval - refer for audit and recovery', priority: 'High', status: 'Unassigned', assignee: '-', sla: 'Due soon', gated: true, stageLabel: 'Supervisor review and approval', actionCenterUrl: 'https://cloud.uipath.com/demo/playground_/tasks/1003', createdAt: '2026-07-28T14:30:00Z' },
  ], 'action-center-task').map((task, index) => ({
    ...task,
    sourceUpdatedAt: ['2026-07-29T13:45:00Z', '2026-07-29T13:50:00Z'][index],
  })),
  folderTasks: withDemoSource<Omit<CaseTaskModel, keyof SourceMetadata>>([
    { id: 1001, folderId: 987654, type: 'Form', title: 'Validate low-confidence extraction - DOC-SN-0414', priority: 'Medium', status: 'Pending', assignee: 'inv.taylor', sla: 'On time', gated: false, stageLabel: 'Evidence acquisition and validation', actionCenterUrl: 'https://cloud.uipath.com/demo/playground_/tasks/1001', createdAt: '2026-07-23T08:20:00Z' },
  ], 'action-center-task').map((task) => ({
    ...task,
    sourceUpdatedAt: '2026-07-29T13:40:00Z',
  })),
  executionTimeline: [
    { id: 'ACT-0001', timestamp: '2026-07-22 09:12', source: 'maestro', severity: 'info', status: 'Case created', summary: 'Opened from alert ALERT-CA-2026-7781.', caseId: 'PI-PCS-2026-0041', correlationId: 'corr-act-0001' },
    { id: 'ACT-0002', timestamp: '2026-07-22 10:41', source: 'maestro', severity: 'info', status: 'Signal computed', summary: 'Computed RS-01 through RS-05.', caseId: 'PI-PCS-2026-0041', correlationId: 'corr-act-0002' },
    { id: 'ACT-0003', timestamp: '2026-07-22 10:45', source: 'agent', severity: 'info', status: 'Agent output', summary: 'Priority explained as High, grounded in RS-01, RS-03, RS-04.', caseId: 'PI-PCS-2026-0041', correlationId: 'corr-act-0003' },
    { id: 'ACT-0004', timestamp: '2026-07-23 08:20', source: 'maestro', severity: 'info', status: 'Doc extracted', summary: 'Six evidence documents extracted; two fields below confidence threshold.', caseId: 'PI-PCS-2026-0041', correlationId: 'corr-act-0004' },
    { id: 'ACT-0005', timestamp: '2026-07-23 09:05', source: 'user', severity: 'info', status: 'Human validated', summary: 'Validated DOC-TS-0416 time_out as 12:00.', caseId: 'PI-PCS-2026-0041', correlationId: 'corr-act-0005' },
    { id: 'ACT-0006', timestamp: '2026-07-23 09:30', source: 'agent', severity: 'info', status: 'Agent output', summary: 'Grouped findings into Unsupported billing, Visit integrity, and Credentialing / personnel.', caseId: 'PI-PCS-2026-0041', correlationId: 'corr-act-0006' },
    { id: 'ACT-0007', timestamp: '2026-07-23 09:35', source: 'agent', severity: 'info', status: 'Agent output', summary: 'Recommended records request and no adverse action pending provider response.', caseId: 'PI-PCS-2026-0041', correlationId: 'corr-act-0007' },
    { id: 'ACT-0008', timestamp: '2026-07-24 11:10', source: 'user', severity: 'info', status: 'Edit', summary: 'Reclassified CLM-0475 method flag as informational.', caseId: 'PI-PCS-2026-0041', correlationId: 'corr-act-0008' },
    { id: 'ACT-0009', timestamp: '2026-07-24 11:20', source: 'user', severity: 'info', status: 'Decision', summary: 'Recorded DEC-0001: proceed to records request.', caseId: 'PI-PCS-2026-0041', correlationId: 'corr-act-0009' },
    { id: 'ACT-0010', timestamp: '2026-07-24 11:25', source: 'maestro', severity: 'info', status: 'Request sent', summary: 'Status moved to Awaiting Provider.', caseId: 'PI-PCS-2026-0041', correlationId: 'corr-act-0010' },
    { id: 'ACT-0011', timestamp: '2026-07-28 14:02', source: 'maestro', severity: 'info', status: 'Response received', summary: 'Received DOC-CORR-01 and moved status back to In Review.', caseId: 'PI-PCS-2026-0041', correlationId: 'corr-act-0011' },
    { id: 'ACT-0012', timestamp: '2026-07-28 14:30', source: 'agent', severity: 'info', status: 'Agent output', summary: 'Drafted supervisor-facing summary v2.', caseId: 'PI-PCS-2026-0041', correlationId: 'corr-act-0012' },
    { id: 'ACT-0013', timestamp: '2026-07-29 13:50', source: 'user', severity: 'info', status: 'Approval', summary: 'Approved DEC-0002: refer for audit and open overpayment recovery.', caseId: 'PI-PCS-2026-0041', correlationId: 'corr-act-0013' },
    { id: 'ACT-0014', timestamp: '2026-07-29 14:00', source: 'maestro', severity: 'info', status: 'Action executed', summary: 'Referral packet created and recovery opened for confirmed unsupported units.', caseId: 'PI-PCS-2026-0041', correlationId: 'corr-act-0014' },
  ] satisfies ActivityEvent[],
});

export function createDemoCaseWorkspace(): CaseWorkspaceSnapshot {
  return deepFreeze(structuredClone(DEMO_CASE_WORKSPACE));
}

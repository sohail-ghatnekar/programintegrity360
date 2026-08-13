import type { UiPath } from '@uipath/uipath-typescript/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const sdkMocks = vi.hoisted(() => ({
  choiceSetsGetById: vi.fn(),
  entitiesGetAllRecords: vi.fn(),
  entitiesGetById: vi.fn(),
}));

vi.mock('@uipath/uipath-typescript/entities', () => ({
  ChoiceSets: class ChoiceSets {
    getById = sdkMocks.choiceSetsGetById;
  },
  Entities: class Entities {
    getAllRecords = sdkMocks.entitiesGetAllRecords;
    getById = sdkMocks.entitiesGetById;
  },
}));

import { DataFabricCaseRepository } from './dataFabricCaseRepository';
import { createDemoCaseWorkspace } from '../../features/cases/demoCase';
import type { CaseRepository } from '../../features/cases/types';

const entityIds = {
  cases: 'case-entity-id',
  providers: 'provider-entity-id',
  attendants: 'attendant-entity-id',
  claims: 'claim-entity-id',
  evvVisits: 'evv-entity-id',
  riskSignals: 'risk-entity-id',
  evidenceDocuments: 'evidence-entity-id',
  investigationActions: 'action-entity-id',
  decisions: 'decision-entity-id',
};

const expectedNames = {
  cases: 'PI360ProgramIntegrityCase',
  providers: 'PI360Provider',
  attendants: 'PI360Attendant',
  claims: 'PI360Claim',
  evvVisits: 'PI360EvvVisit',
  riskSignals: 'PI360RiskSignal',
  evidenceDocuments: 'PI360EvidenceDocument',
  investigationActions: 'PI360InvestigationAction',
  decisions: 'PI360Decision',
};

const choiceIds = {
  priority: 'priority-choice-id',
  stage: 'stage-choice-id',
  caseStatus: 'case-status-choice-id',
  claimStatus: 'claim-status-choice-id',
  severity: 'severity-choice-id',
  documentType: 'document-type-choice-id',
  validationStatus: 'validation-status-choice-id',
  actorKind: 'actor-kind-choice-id',
  decisionRole: 'decision-role-choice-id',
};

const choiceValues: Record<string, Array<{ numberId: number; displayName: string }>> = {
  [choiceIds.priority]: [{ numberId: 0, displayName: 'High' }],
  [choiceIds.stage]: [
    { numberId: 1, displayName: 'Automated evidence collection' },
    { numberId: 8, displayName: 'Closure and monitoring' },
  ],
  [choiceIds.caseStatus]: [
    { numberId: 0, displayName: 'Open' },
    { numberId: 4, displayName: 'Closed' },
  ],
  [choiceIds.claimStatus]: [
    { numberId: 0, displayName: 'Under Review' },
    { numberId: 2, displayName: 'Flagged' },
  ],
  [choiceIds.severity]: [{ numberId: 0, displayName: 'High' }],
  [choiceIds.documentType]: [
    { numberId: 0, displayName: 'Timesheet' },
    { numberId: 5, displayName: 'Hospital Record' },
    { numberId: 6, displayName: 'Policy Reference' },
  ],
  [choiceIds.validationStatus]: [
    { numberId: 1, displayName: 'Needs review' },
    { numberId: 2, displayName: 'Human-validated' },
  ],
  [choiceIds.actorKind]: [
    { numberId: 0, displayName: 'Human' },
    { numberId: 1, displayName: 'System' },
    { numberId: 2, displayName: 'Agent' },
  ],
  [choiceIds.decisionRole]: [
    { numberId: 0, displayName: 'Investigator' },
    { numberId: 1, displayName: 'Supervisor' },
  ],
};

const schemas: Record<string, { name: string; fields: Array<Record<string, unknown>> }> = Object.fromEntries(
  Object.entries(entityIds).map(([key, id]) => [id, { name: expectedNames[key as keyof typeof expectedNames], fields: [] }]),
);

schemas[entityIds.cases].fields = [
  { name: 'priority', referenceChoiceSet: { id: choiceIds.priority } },
  { name: 'stage', referenceChoiceSet: { id: choiceIds.stage } },
  { name: 'status', referenceChoiceSet: { id: choiceIds.caseStatus } },
];
schemas[entityIds.claims].fields = [{ name: 'status', referenceChoiceSet: { id: choiceIds.claimStatus } }];
schemas[entityIds.riskSignals].fields = [{ name: 'severity', referenceChoiceSet: { id: choiceIds.severity } }];
schemas[entityIds.evidenceDocuments].fields = [
  { name: 'doc_type', referenceChoiceSet: { id: choiceIds.documentType } },
  { name: 'validation_status', referenceChoiceSet: { id: choiceIds.validationStatus } },
];
schemas[entityIds.investigationActions].fields = [{ name: 'actor_kind', referenceChoiceSet: { id: choiceIds.actorKind } }];
schemas[entityIds.decisions].fields = [{ name: 'decision_role', referenceChoiceSet: { id: choiceIds.decisionRole } }];

const hospiceCase = {
  Id: 'case-record-id',
  CaseId: 'PI-HSP-2026-0042',
  CaseType: 'StateMedicaidHospice',
  Title: 'Harbor Home Support Services — hospice location conflict review',
  Program: 'State Medicaid Hospice',
  TriggerType: 'Claims Analytics Alert',
  TriggerRef: 'ALERT-HSP-2026-0714',
  ProviderId: 'PRV-100482',
  AttendantId: 'ATT-HSP-4401',
  MemberId: 'MBR-071426',
  MemberName: 'Jordan Ellis',
  ServicePeriodStart: '2026-07-13',
  ServicePeriodEnd: '2026-07-16',
  Priority: 0,
  Stage: 1,
  Status: 0,
  RiskSignalCount: 1,
  PotentialExposureLow: 0,
  PotentialExposurePeriodEstimate: 1500,
  PotentialExposureHigh: 3250,
  AssignedInvestigator: 'inv.taylor',
  AssignedSupervisor: 'sup.morgan',
  AlertDate: '2026-07-20',
  OpenedAt: '2026-07-20T09:00:00-05:00',
  SlaDue: '2026-07-23T09:00:00-05:00',
  UpdatedAt: '2026-07-20T09:00:00-05:00',
};

const pcsCase = {
  ...hospiceCase,
  Id: 'pcs-case-record-id',
  CaseId: 'PI-PCS-2026-0041',
  CaseType: 'MedicaidPCS',
  Program: 'Medicaid PCS',
  Stage: 8,
  Status: 4,
};

const records: Record<string, Array<Record<string, unknown>>> = {
  [entityIds.cases]: [hospiceCase],
  [entityIds.providers]: [{
    Id: 'provider-record-id',
    ProviderId: 'PRV-100482',
    Name: 'Harbor Home Support Services',
    MedicaidProviderId: 'MPI-4471902',
    Npi: '1730456789',
    Address: '2200 Marina Blvd, Suite 210',
    EnrollmentStatus: 'Active',
    ActiveAttendantCount: 22,
    PriorIntegrityHistory: 'No sanctions on record',
  }],
  [entityIds.attendants]: [{
    Id: 'attendant-record-id',
    AttendantId: 'ATT-HSP-4401',
    ProviderId: 'PRV-100482',
    Name: 'Taylor Brooks',
    Role: 'Hospice Caregiver',
    CredentialId: 'HSP-PC-4401',
    CredentialExpiry: '2027-03-31',
    PersonnelDocsComplete: true,
    MissingDocs: '[]',
  }],
  [entityIds.claims]: [{
    Id: 'claim-record-id',
    ClaimId: 'CLM-HSP-2026-0714-001',
    CaseId: 'PI-HSP-2026-0042',
    CaseType: 'StateMedicaidHospice',
    MemberId: 'MBR-071426',
    AttendantId: 'ATT-HSP-4401',
    UnitsBilled: 52,
    BilledAmount: 3250,
    FlaggedLineId: 'LINE-0714-01',
    Status: 2,
    Notes: 'Human validation is required.',
    ClaimLinesJson: JSON.stringify([
      { line_id: 'LINE-0713-01', date_of_service: '2026-07-13', units_billed: 16, status: 'Under Review' },
      { line_id: 'LINE-0714-01', date_of_service: '2026-07-14', units_billed: 24, status: 'Flagged' },
      { line_id: 'LINE-0716-01', date_of_service: '2026-07-16', units_billed: 12, status: 'Under Review' },
    ]),
  }],
  [entityIds.evvVisits]: [],
  [entityIds.riskSignals]: [{
    Id: 'risk-record-id',
    SignalId: 'RS-HSP-01',
    CaseId: 'PI-HSP-2026-0042',
    Name: 'Claimed home service overlaps institutional encounter',
    RuleExpression: 'Intersect claimed and encounter intervals.',
    ResultValue: JSON.stringify({ overlap_minutes: 360, location_conflict: true, determination: 'Review indicator only' }),
    Inputs: JSON.stringify({ claim_line_id: 'LINE-0714-01', encounter_id: 'ENC-SYN-20260714-JE' }),
    Severity: 0,
    ComputedAt: '2026-07-20T09:05:00-05:00',
  }],
  [entityIds.evidenceDocuments]: [
    {
      Id: 'timesheet-record-id',
      DocId: 'DOC-HSP-TS-0714',
      CaseId: 'PI-HSP-2026-0042',
      DocType: 0,
      SourceSystem: 'Orchestrator Storage Bucket: Timesheets',
      ExtractedFields: JSON.stringify({ member: 'Jordan Ellis', total_units: 52 }),
      ExtractionConfidence: 0.92,
      ValidationStatus: 1,
      Note: 'The service side of RS-HSP-01.',
    },
    {
      Id: 'hospital-record-id',
      DocId: 'DOC-HSP-MR-0714',
      CaseId: 'PI-HSP-2026-0042',
      DocType: 5,
      SourceSystem: 'Orchestrator Storage Bucket: Hospital Records',
      ExtractedFields: JSON.stringify({ patient_class: 'Observation', encounter_id: 'ENC-SYN-20260714-JE' }),
      ExtractionConfidence: 0.95,
      ValidationStatus: 1,
      Note: 'Observation status, not inpatient status.',
    },
    {
      Id: 'policy-record-id',
      DocId: 'DOC-HSP-POL-PCS47',
      CaseId: 'PI-HSP-2026-0042',
      DocType: 6,
      SourceSystem: 'Orchestrator Storage Bucket: Policy Docs',
      ExtractedFields: JSON.stringify({ policy_id: 'PCS-4.7' }),
      ValidationStatus: 2,
      Note: 'Agent grounding only.',
    },
  ],
  [entityIds.investigationActions]: [{
    Id: 'action-record-id',
    ActionId: 'ACT-HSP-0001',
    CaseId: 'PI-HSP-2026-0042',
    ActionType: 'Signal computed',
    Actor: 'deterministic-calc-v2',
    ActorKind: 1,
    Timestamp: '2026-07-20T09:05:00-05:00',
    Detail: 'Computed the 360-minute location/time overlap.',
  }],
  [entityIds.decisions]: [],
};

describe('DataFabricCaseRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sdkMocks.entitiesGetById.mockImplementation(async (id: string) => schemas[id]);
    sdkMocks.entitiesGetAllRecords.mockImplementation(async (id: string) => ({
      items: records[id] ?? [],
      hasNextPage: false,
      supportsPageJump: false,
    }));
    sdkMocks.choiceSetsGetById.mockImplementation(async (id: string) => ({
      items: choiceValues[id] ?? [],
      hasNextPage: false,
      supportsPageJump: false,
    }));
  });

  it('uses the configured PI360 case entity and translates live choice values', async () => {
    const repository = new DataFabricCaseRepository({} as UiPath, { entityIds }, null);

    const cases = await repository.listCases();

    expect(sdkMocks.entitiesGetById).toHaveBeenCalledWith(entityIds.cases);
    expect(sdkMocks.entitiesGetAllRecords).toHaveBeenCalledWith(entityIds.cases, { pageSize: 100 });
    expect(cases).toEqual([
      expect.objectContaining({
        id: 'PI-HSP-2026-0042',
        caseType: 'StateMedicaidHospice',
        memberId: 'MBR-071426',
        memberName: 'Jordan Ellis',
        priority: 'High',
        stage: 'Automated evidence collection',
        status: 'Open',
      }),
    ]);
  });

  it('hydrates the hospice workspace from all nine Data Fabric entities', async () => {
    const repository = new DataFabricCaseRepository({} as UiPath, { entityIds }, null);

    const result = await repository.loadWorkspaceWithWarnings('PI-HSP-2026-0042');

    expect(result.data.dataSource).toBe('live');
    expect(result.data.provider.name).toBe('Harbor Home Support Services');
    expect(result.data.attendant).toMatchObject({ name: 'Taylor Brooks', role: 'Hospice Caregiver' });
    expect(result.data.claims.map((claim) => claim.id)).toEqual([
      'LINE-0713-01',
      'LINE-0714-01',
      'LINE-0716-01',
    ]);
    expect(result.data.claims.find((claim) => claim.id === 'LINE-0714-01')).toMatchObject({
      billed: 24,
      status: 'Flagged',
    });
    expect(result.data.riskSignals[0]).toMatchObject({
      id: 'RS-HSP-01',
      result: '360-minute overlap; location conflict: Yes; Review indicator only',
      severity: 'High',
    });
    expect(result.data.evidenceDocuments.map((document) => document.type)).toEqual([
      'Timesheet',
      'Hospital Record',
      'Policy Reference',
    ]);
    expect(result.data.stages.find((stage) => stage.key === 'evidence')?.status).toBe('active');
    expect(result.data.executionTimeline).toEqual([
      expect.objectContaining({ id: 'ACT-HSP-0001', source: 'maestro' }),
    ]);
    expect(Object.values(entityIds).every((id) => (
      sdkMocks.entitiesGetAllRecords.mock.calls.some(([requestedId]) => requestedId === id)
    ))).toBe(true);
    expect(result.warnings).toEqual([]);
  });

  it('rejects a configured ID that resolves to the wrong Data Fabric entity', async () => {
    sdkMocks.entitiesGetById.mockImplementation(async (id: string) => (
      id === entityIds.providers ? { name: 'WrongProviderEntity', fields: [] } : schemas[id]
    ));
    const repository = new DataFabricCaseRepository({} as UiPath, { entityIds }, null);

    await expect(repository.loadWorkspace('PI-HSP-2026-0042')).rejects.toThrow(
      'expected PI360Provider but resolved WrongProviderEntity',
    );
  });

  it('follows Data Fabric cursors instead of treating the first page as the full case queue', async () => {
    sdkMocks.entitiesGetAllRecords.mockImplementation(async (id: string, options: { cursor?: { value: string } }) => {
      if (id !== entityIds.cases) {
        return { items: records[id] ?? [], hasNextPage: false, supportsPageJump: false };
      }
      if (options.cursor?.value === 'case-page-2') {
        return { items: [pcsCase], hasNextPage: false, supportsPageJump: false };
      }
      return {
        items: [hospiceCase],
        hasNextPage: true,
        nextCursor: { value: 'case-page-2' },
        supportsPageJump: false,
      };
    });
    const repository = new DataFabricCaseRepository({} as UiPath, { entityIds }, null);

    const cases = await repository.listCases();

    expect(cases.map((item) => item.id)).toEqual(['PI-HSP-2026-0042', 'PI-PCS-2026-0041']);
    expect(sdkMocks.entitiesGetAllRecords).toHaveBeenCalledWith(entityIds.cases, {
      pageSize: 100,
      cursor: { value: 'case-page-2' },
    });
  });

  it('retries schema discovery after a transient failure instead of caching the rejection', async () => {
    sdkMocks.entitiesGetById.mockRejectedValueOnce(new Error('Temporary schema failure'));
    const repository = new DataFabricCaseRepository({} as UiPath, { entityIds }, null);

    await expect(repository.listCases()).rejects.toThrow('Temporary schema failure');
    await expect(repository.listCases()).resolves.toHaveLength(1);

    expect(sdkMocks.entitiesGetById).toHaveBeenCalledTimes(2);
  });

  it('retries choice translation after a transient failure instead of caching the rejection', async () => {
    sdkMocks.choiceSetsGetById.mockRejectedValueOnce(new Error('Temporary choice failure'));
    const repository = new DataFabricCaseRepository({} as UiPath, { entityIds }, null);

    await expect(repository.listCases()).rejects.toThrow('Temporary choice failure');
    await expect(repository.listCases()).resolves.toEqual([
      expect.objectContaining({ priority: 'High' }),
    ]);

    expect(sdkMocks.choiceSetsGetById.mock.calls.filter(([id]) => id === choiceIds.priority)).toHaveLength(2);
  });

  it('correlates optional runtime enrichment by business case ID without overriding Data Fabric stage state', async () => {
    const runtimeWorkspace = createDemoCaseWorkspace();
    const runtimeCase = {
      ...runtimeWorkspace.case,
      id: 'opaque-uipath-instance-id',
      businessCaseId: 'PI-HSP-2026-0042',
      title: 'Harbor Home Support Services review',
    };
    const runtimeRepository = {
      listCases: vi.fn().mockResolvedValue([runtimeCase]),
      loadWorkspace: vi.fn().mockResolvedValue(runtimeWorkspace),
      refreshTasks: vi.fn().mockResolvedValue({ caseTasks: [], folderTasks: [] }),
    } satisfies CaseRepository;
    const repository = new DataFabricCaseRepository({} as UiPath, { entityIds }, runtimeRepository);

    const result = await repository.loadWorkspaceWithWarnings('PI-HSP-2026-0042');

    expect(runtimeRepository.loadWorkspace).toHaveBeenCalledWith('opaque-uipath-instance-id');
    expect(result.data.caseTasks).toHaveLength(runtimeWorkspace.caseTasks.length);
    expect(result.data.stages.find((stage) => stage.key === 'evidence')?.status).toBe('active');
    expect(result.data.stages.find((stage) => stage.key === 'investigation')?.status).toBe('not-started');
  });
});

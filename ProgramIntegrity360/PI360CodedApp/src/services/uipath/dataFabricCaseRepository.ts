import { ChoiceSets, Entities } from '@uipath/uipath-typescript/entities';
import type { EntityGetResponse, EntityRecord } from '@uipath/uipath-typescript/entities';
import type { PaginationCursor, UiPath } from '@uipath/uipath-typescript/core';
import type { Pi360EntityIds } from '../../config/uipath';
import { ActivityLog, createActivityEvent } from '../../features/activity/activityLog';
import { STAGE_DEFINITIONS } from '../../features/cases/stages';
import type {
  ActivityEvent,
  AttendantModel,
  CaseRepository,
  CaseStageKey,
  CaseStageModel,
  CaseSummary,
  CaseWorkspaceModel,
  CaseWorkspaceSnapshot,
  ClaimModel,
  DeepReadonly,
  EvidenceDocumentModel,
  ProviderModel,
  RiskSignalModel,
  Severity,
  TaskRefreshSnapshot,
} from '../../features/cases/types';
import type { RepositoryOperationResult } from './liveCaseRepository';

const PAGE_SIZE = 100;
const MAX_CURSOR_PAGES = 100;
const NOT_AVAILABLE = 'Not available';

type EntityKey = keyof Pi360EntityIds;

const EXPECTED_ENTITY_NAMES: Record<EntityKey, string> = {
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

const ENTITY_KEYS = Object.keys(EXPECTED_ENTITY_NAMES) as EntityKey[];

type RuntimeRepository = CaseRepository & {
  listCasesWithWarnings?: () => Promise<RepositoryOperationResult<readonly DeepReadonly<CaseSummary>[]>>;
  loadWorkspaceWithWarnings?: (caseId: string) => Promise<RepositoryOperationResult<CaseWorkspaceSnapshot>>;
  refreshTasksWithWarnings?: (caseId: string) => Promise<RepositoryOperationResult<TaskRefreshSnapshot>>;
};

export type DataFabricCaseRepositoryConfig = {
  entityIds: Partial<Pi360EntityIds>;
};

type CursorPage<T> = {
  items: T[];
  hasNextPage?: boolean;
  nextCursor?: PaginationCursor;
};

function deepFreeze<T>(value: T): DeepReadonly<T> {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) {
      deepFreeze(child);
    }
  }
  return value as DeepReadonly<T>;
}

function canonical(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLocaleLowerCase().replace(/[^a-z0-9]/g, '') : '';
}

function field(record: Record<string, unknown>, ...names: string[]): unknown {
  const wanted = new Set(names.map(canonical));
  for (const [key, value] of Object.entries(record)) {
    if (wanted.has(canonical(key))) return value;
  }
  return undefined;
}

function text(value: unknown, fallback = NOT_AVAILABLE): string {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return fallback;
}

function numberValue(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = typeof value === 'string' ? Number(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
}

function booleanValue(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  return canonical(value) === 'true' || canonical(value) === 'yes';
}

function jsonValue(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function jsonRecord(value: unknown): Record<string, unknown> {
  const parsed = jsonValue(value);
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
    ? parsed as Record<string, unknown>
    : {};
}

function stringArray(value: unknown): string[] {
  const parsed = jsonValue(value);
  return Array.isArray(parsed) ? parsed.map((item) => text(item, '')).filter(Boolean) : [];
}

function currency(value: unknown): string {
  const amount = numberValue(value);
  const fractionDigits = Number.isInteger(amount) ? 0 : 2;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: 2,
  }).format(amount);
}

function severity(value: string): Severity {
  const normalized = canonical(value);
  if (normalized === 'high' || normalized === 'critical') return 'High';
  if (normalized === 'low') return 'Low';
  return 'Medium';
}

function recordId(record: Record<string, unknown>): string {
  return text(field(record, 'Id', 'id'), 'unknown-record');
}

function sourceUpdatedAt(record: Record<string, unknown>): string {
  return text(field(record, 'UpdatedAt', 'updated_at', 'UpdateTime'), '1970-01-01T00:00:00.000Z');
}

function stageKey(value: string): CaseStageKey {
  const normalized = canonical(value);
  if (normalized.includes('alert') || normalized.includes('intake') || normalized.includes('triage')) return 'intake';
  if (normalized.includes('evidencecollection') || normalized.includes('documentextraction')) return 'evidence';
  if (normalized.includes('providerrecord') || normalized.includes('waitstate')) return 'provider-response';
  if (normalized.includes('supervisor') || normalized.includes('approvedaction')) return 'supervisor-review';
  if (normalized.includes('closure') || normalized.includes('monitoring')) return 'closure';
  return 'investigation';
}

function buildStages(caseSummary: CaseSummary): CaseStageModel[] {
  const currentKey = stageKey(caseSummary.stage);
  const currentIndex = STAGE_DEFINITIONS.findIndex((definition) => definition.key === currentKey);
  const isClosed = canonical(caseSummary.status) === 'closed';

  return STAGE_DEFINITIONS.map((definition, index) => ({
    ...definition,
    dataSource: 'live' as const,
    sourceId: `data-fabric-stage:${caseSummary.id}:${definition.key}`,
    sourceUpdatedAt: caseSummary.sourceUpdatedAt,
    status: isClosed || index < currentIndex
      ? 'completed' as const
      : index === currentIndex
        ? 'active' as const
        : 'not-started' as const,
  }));
}

function mergeStageTiming(
  stages: readonly DeepReadonly<CaseStageModel>[],
  enrichment: readonly DeepReadonly<CaseStageModel>[],
): CaseStageModel[] {
  const timingByKey = new Map(enrichment.map((stage) => [stage.key, stage]));
  return stages.map((stage) => {
    const timing = timingByKey.get(stage.key);
    return {
      ...stage,
      enteredAt: timing?.enteredAt ?? stage.enteredAt,
      completedAt: timing?.completedAt ?? stage.completedAt,
    };
  });
}

function resultText(value: unknown): string {
  const parsed = jsonValue(value);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return text(parsed);
  const result = parsed as Record<string, unknown>;
  const overlapMinutes = numberValue(field(result, 'overlap_minutes', 'OverlapMinutes'), Number.NaN);
  if (Number.isFinite(overlapMinutes)) {
    const locationConflict = booleanValue(field(result, 'location_conflict', 'LocationConflict')) ? 'Yes' : 'No';
    const determination = text(field(result, 'determination', 'Determination'), 'Review indicator only');
    return `${overlapMinutes}-minute overlap; location conflict: ${locationConflict}; ${determination}`;
  }
  return Object.entries(result).map(([key, item]) => `${key}: ${text(item, JSON.stringify(item))}`).join('; ');
}

function citationIds(value: unknown): string[] {
  const serialized = typeof value === 'string' ? value : JSON.stringify(value ?? '');
  return [...new Set(serialized.match(/\b(?:ACT|ALERT|CLM|DEC|DOC|ENC|EVV|LINE|RS)-[A-Z0-9-]+\b/g) ?? [])];
}

function displayFields(value: unknown): Record<string, string> {
  const parsed = jsonRecord(value);
  return Object.fromEntries(Object.entries(parsed).map(([key, item]) => [
    key,
    item && typeof item === 'object' ? JSON.stringify(item) : text(item, ''),
  ]));
}

function mergeActivity(primary: readonly ActivityEvent[], enrichment: readonly ActivityEvent[]): ActivityEvent[] {
  return [...new ActivityLog([primary, enrichment]).events];
}

export class DataFabricCaseRepository implements CaseRepository {
  private readonly entities: Entities;
  private readonly choiceSets: ChoiceSets;
  private readonly entityIds: Pi360EntityIds;
  private readonly runtimeRepository: RuntimeRepository | null;
  private readonly schemaCache = new Map<EntityKey, Promise<EntityGetResponse>>();
  private readonly choiceCache = new Map<string, Promise<Map<number, string>>>();

  constructor(
    sdk: UiPath,
    config: DataFabricCaseRepositoryConfig,
    runtimeRepository: RuntimeRepository | null = null,
  ) {
    this.entities = new Entities(sdk);
    this.choiceSets = new ChoiceSets(sdk);
    this.entityIds = this.requireEntityIds(config.entityIds);
    this.runtimeRepository = runtimeRepository;
  }

  async listCases(): Promise<readonly DeepReadonly<CaseSummary>[]> {
    return (await this.listCasesWithWarnings()).data;
  }

  async listCasesWithWarnings(): Promise<RepositoryOperationResult<readonly DeepReadonly<CaseSummary>[]>> {
    const records = await this.loadRecords('cases');
    const cases = await Promise.all(records.map((record) => this.normalizeCase(record)));
    return { data: deepFreeze(cases), warnings: [] };
  }

  async loadWorkspace(caseId: string): Promise<CaseWorkspaceSnapshot> {
    return (await this.loadWorkspaceWithWarnings(caseId)).data;
  }

  async loadWorkspaceWithWarnings(caseId: string): Promise<RepositoryOperationResult<CaseWorkspaceSnapshot>> {
    const warnings: string[] = [];
    const [
      caseRecords,
      providerRecords,
      attendantRecords,
      claimRecords,
      evvRecords,
      riskRecords,
      evidenceRecords,
      actionRecords,
      decisionRecords,
    ] = await Promise.all(ENTITY_KEYS.map((key) => this.loadRecords(key)));

    const caseRecord = caseRecords.find((record) => text(field(record, 'CaseId', 'case_id'), '') === caseId);
    if (!caseRecord) throw new Error(`Data Fabric case not found: ${caseId}`);

    const caseSummary = await this.normalizeCase(caseRecord);
    const providerId = caseSummary.providerId;
    const attendantId = caseSummary.attendantId;
    const providerRecord = providerRecords.find((record) => text(field(record, 'ProviderId', 'provider_id'), '') === providerId);
    const attendantRecord = attendantRecords.find((record) => text(field(record, 'AttendantId', 'attendant_id'), '') === attendantId);
    const caseClaims = claimRecords.filter((record) => text(field(record, 'CaseId', 'case_id'), '') === caseId);
    const caseRisks = riskRecords.filter((record) => text(field(record, 'CaseId', 'case_id'), '') === caseId);
    const caseEvidence = evidenceRecords.filter((record) => text(field(record, 'CaseId', 'case_id'), '') === caseId);
    const caseActions = actionRecords.filter((record) => text(field(record, 'CaseId', 'case_id'), '') === caseId);
    const caseDecisions = decisionRecords.filter((record) => text(field(record, 'CaseId', 'case_id'), '') === caseId);
    const attendantEvv = evvRecords.filter((record) => text(field(record, 'AttendantId', 'attendant_id'), '') === attendantId);

    const [claims, riskSignals, evidenceDocuments, executionTimeline] = await Promise.all([
      this.normalizeClaims(caseClaims, attendantEvv),
      Promise.all(caseRisks.map((record) => this.normalizeRisk(record))),
      Promise.all(caseEvidence.map((record) => this.normalizeEvidence(record))),
      this.normalizeTimeline(caseId, caseActions, caseDecisions),
    ]);

    let workspace: CaseWorkspaceModel = {
      dataSource: 'live',
      sourceId: `data-fabric-workspace:${caseId}`,
      sourceUpdatedAt: caseSummary.sourceUpdatedAt,
      case: caseSummary,
      stages: buildStages(caseSummary),
      provider: this.normalizeProvider(providerRecord, caseSummary),
      attendant: this.normalizeAttendant(attendantRecord, caseSummary),
      claims,
      riskSignals,
      evidenceDocuments,
      caseTasks: [],
      folderTasks: [],
      executionTimeline,
    };

    if (this.runtimeRepository) {
      const enrichment = await this.loadRuntimeEnrichment(caseSummary, warnings);
      if (enrichment) {
        workspace = {
          ...workspace,
          stages: mergeStageTiming(workspace.stages, enrichment.stages),
          caseTasks: [...enrichment.caseTasks],
          folderTasks: [...enrichment.folderTasks],
          executionTimeline: mergeActivity(workspace.executionTimeline, enrichment.executionTimeline),
        };
      }
    }

    return { data: deepFreeze(workspace), warnings: Object.freeze(warnings) };
  }

  async refreshTasks(caseId: string): Promise<TaskRefreshSnapshot> {
    if (!this.runtimeRepository) return { caseTasks: [], folderTasks: [] };
    const cases = await this.listCases();
    const selected = cases.find((candidate) => candidate.id === caseId);
    if (!selected) throw new Error(`Data Fabric case not found: ${caseId}`);
    const runtimeCase = await this.findRuntimeCase(selected);
    if (!runtimeCase) return { caseTasks: [], folderTasks: [] };
    if (this.runtimeRepository.refreshTasksWithWarnings) {
      return (await this.runtimeRepository.refreshTasksWithWarnings(runtimeCase.id)).data;
    }
    return this.runtimeRepository.refreshTasks(runtimeCase.id);
  }

  private requireEntityIds(ids: Partial<Pi360EntityIds>): Pi360EntityIds {
    const missing = ENTITY_KEYS.filter((key) => !ids[key]?.trim());
    if (missing.length > 0) {
      throw new Error(`PI360 Data Fabric entity configuration is incomplete: ${missing.join(', ')}`);
    }
    return ids as Pi360EntityIds;
  }

  private schema(key: EntityKey): Promise<EntityGetResponse> {
    const cached = this.schemaCache.get(key);
    if (cached) return cached;
    const expectedName = EXPECTED_ENTITY_NAMES[key];
    const requestedId = this.entityIds[key];
    const request = this.entities.getById(requestedId).then((schema) => {
      if (schema.name !== expectedName) {
        throw new Error(`Data Fabric entity mapping failed: expected ${expectedName} but resolved ${schema.name || 'an unnamed entity'} (${requestedId}).`);
      }
      return schema;
    });
    this.schemaCache.set(key, request);
    void request.catch(() => {
      if (this.schemaCache.get(key) === request) this.schemaCache.delete(key);
    });
    return request;
  }

  private async loadRecords(key: EntityKey): Promise<Array<Record<string, unknown>>> {
    await this.schema(key);
    const entityId = this.entityIds[key];
    const records: Array<Record<string, unknown>> = [];
    const seenCursors = new Set<string>();
    let cursor: PaginationCursor | undefined;

    for (let pageIndex = 0; pageIndex < MAX_CURSOR_PAGES; pageIndex += 1) {
      const page = await this.entities.getAllRecords(entityId, cursor
        ? { pageSize: PAGE_SIZE, cursor }
        : { pageSize: PAGE_SIZE }) as CursorPage<EntityRecord>;
      records.push(...page.items as Array<Record<string, unknown>>);
      if (!page.hasNextPage) return records;
      if (!page.nextCursor?.value || seenCursors.has(page.nextCursor.value)) {
        throw new Error(`Data Fabric pagination failed for ${EXPECTED_ENTITY_NAMES[key]}: missing or repeated cursor.`);
      }
      seenCursors.add(page.nextCursor.value);
      cursor = page.nextCursor;
    }
    throw new Error(`Data Fabric pagination exceeded ${MAX_CURSOR_PAGES} pages for ${EXPECTED_ENTITY_NAMES[key]}.`);
  }

  private async choiceMap(choiceSetId: string): Promise<Map<number, string>> {
    const cached = this.choiceCache.get(choiceSetId);
    if (cached) return cached;
    const request = (async () => {
      const values = new Map<number, string>();
      const seenCursors = new Set<string>();
      let cursor: PaginationCursor | undefined;
      for (let pageIndex = 0; pageIndex < MAX_CURSOR_PAGES; pageIndex += 1) {
        const page = await this.choiceSets.getById(choiceSetId, cursor
          ? { pageSize: PAGE_SIZE, cursor }
          : { pageSize: PAGE_SIZE });
        for (const item of page.items) values.set(item.numberId, item.displayName);
        if (!page.hasNextPage) return values;
        if (!page.nextCursor?.value || seenCursors.has(page.nextCursor.value)) {
          throw new Error(`Data Fabric choice-set pagination failed for ${choiceSetId}.`);
        }
        seenCursors.add(page.nextCursor.value);
        cursor = page.nextCursor;
      }
      throw new Error(`Data Fabric choice-set pagination exceeded ${MAX_CURSOR_PAGES} pages for ${choiceSetId}.`);
    })();
    this.choiceCache.set(choiceSetId, request);
    void request.catch(() => {
      if (this.choiceCache.get(choiceSetId) === request) this.choiceCache.delete(choiceSetId);
    });
    return request;
  }

  private async choiceDisplay(
    key: EntityKey,
    fieldName: string,
    rawValue: unknown,
    fallback: string,
  ): Promise<string> {
    if (typeof rawValue === 'string' && rawValue.trim() && Number.isNaN(Number(rawValue))) return rawValue.trim();
    const schema = await this.schema(key);
    const metadata = schema.fields.find((candidate) => canonical(candidate.name) === canonical(fieldName));
    const choiceSetId = metadata?.referenceChoiceSet?.id;
    if (!choiceSetId) return fallback;
    const choices = await this.choiceMap(choiceSetId);
    return choices.get(numberValue(rawValue, Number.NaN)) ?? fallback;
  }

  private async normalizeCase(record: Record<string, unknown>): Promise<CaseSummary> {
    const [priority, stage, status] = await Promise.all([
      this.choiceDisplay('cases', 'priority', field(record, 'Priority', 'priority'), 'Medium'),
      this.choiceDisplay('cases', 'stage', field(record, 'Stage', 'stage'), NOT_AVAILABLE),
      this.choiceDisplay('cases', 'status', field(record, 'Status', 'status'), NOT_AVAILABLE),
    ]);
    const low = field(record, 'PotentialExposureLow', 'potential_exposure_low');
    const high = field(record, 'PotentialExposureHigh', 'potential_exposure_high');
    return {
      dataSource: 'live',
      sourceId: `data-fabric-case:${recordId(record)}`,
      sourceUpdatedAt: sourceUpdatedAt(record),
      id: text(field(record, 'CaseId', 'case_id')),
      businessCaseId: text(field(record, 'CaseId', 'case_id')),
      caseType: text(field(record, 'CaseType', 'case_type')),
      memberId: text(field(record, 'MemberId', 'member_id'), ''),
      memberName: text(field(record, 'MemberName', 'member_name'), ''),
      title: text(field(record, 'Title', 'title')),
      program: text(field(record, 'Program', 'program')),
      priority: severity(priority),
      status,
      stage,
      trigger: text(field(record, 'TriggerRef', 'trigger_ref', 'TriggerType', 'trigger_type')),
      alertDate: text(field(record, 'AlertDate', 'alert_date')),
      servicePeriod: `${text(field(record, 'ServicePeriodStart', 'service_period_start'))} to ${text(field(record, 'ServicePeriodEnd', 'service_period_end'))}`,
      opened: text(field(record, 'OpenedAt', 'opened_at')),
      slaDue: text(field(record, 'SlaDue', 'sla_due')),
      investigator: text(field(record, 'AssignedInvestigator', 'assigned_investigator'), 'Unassigned'),
      supervisor: text(field(record, 'AssignedSupervisor', 'assigned_supervisor'), 'Unassigned'),
      providerId: text(field(record, 'ProviderId', 'provider_id')),
      attendantId: text(field(record, 'AttendantId', 'attendant_id')),
      riskSignalCount: numberValue(field(record, 'RiskSignalCount', 'risk_signal_count')),
      sampleExposure: currency(low),
      periodExposure: currency(field(record, 'PotentialExposurePeriodEstimate', 'potential_exposure_period_estimate')),
      rangeExposure: `${currency(low)}–${currency(high)}`,
    };
  }

  private normalizeProvider(record: Record<string, unknown> | undefined, caseSummary: CaseSummary): ProviderModel {
    if (!record) {
      return {
        dataSource: 'live', sourceId: `data-fabric-provider:${caseSummary.providerId}:missing`, sourceUpdatedAt: caseSummary.sourceUpdatedAt,
        name: NOT_AVAILABLE, medicaidId: NOT_AVAILABLE, npi: NOT_AVAILABLE, address: NOT_AVAILABLE,
        enrollment: NOT_AVAILABLE, attendants: NOT_AVAILABLE, history: NOT_AVAILABLE,
      };
    }
    return {
      dataSource: 'live',
      sourceId: `data-fabric-provider:${recordId(record)}`,
      sourceUpdatedAt: sourceUpdatedAt(record),
      name: text(field(record, 'Name', 'name')),
      medicaidId: text(field(record, 'MedicaidProviderId', 'medicaid_provider_id')),
      npi: text(field(record, 'Npi', 'npi')),
      address: text(field(record, 'Address', 'address')),
      enrollment: text(field(record, 'EnrollmentStatus', 'enrollment_status')),
      attendants: `${numberValue(field(record, 'ActiveAttendantCount', 'active_attendant_count'))} active attendants`,
      history: text(field(record, 'PriorIntegrityHistory', 'prior_integrity_history')),
    };
  }

  private normalizeAttendant(record: Record<string, unknown> | undefined, caseSummary: CaseSummary): AttendantModel {
    if (!record) {
      return {
        dataSource: 'live', sourceId: `data-fabric-attendant:${caseSummary.attendantId}:missing`, sourceUpdatedAt: caseSummary.sourceUpdatedAt,
        name: NOT_AVAILABLE, id: caseSummary.attendantId, role: NOT_AVAILABLE, cert: NOT_AVAILABLE, certStatus: NOT_AVAILABLE, docs: [],
      };
    }
    const expiry = text(field(record, 'CredentialExpiry', 'credential_expiry'));
    const complete = booleanValue(field(record, 'PersonnelDocsComplete', 'personnel_docs_complete'));
    return {
      dataSource: 'live',
      sourceId: `data-fabric-attendant:${recordId(record)}`,
      sourceUpdatedAt: sourceUpdatedAt(record),
      name: text(field(record, 'Name', 'name')),
      id: text(field(record, 'AttendantId', 'attendant_id')),
      role: text(field(record, 'Role', 'role')),
      cert: text(field(record, 'CredentialId', 'credential_id')),
      certStatus: `${complete ? 'Current through' : 'Expired'} ${expiry}`,
      docs: stringArray(field(record, 'MissingDocs', 'missing_docs')),
    };
  }

  private async normalizeClaims(
    records: Array<Record<string, unknown>>,
    evvRecords: Array<Record<string, unknown>>,
  ): Promise<ClaimModel[]> {
    const claims: ClaimModel[] = [];
    for (const record of records) {
      const claimId = text(field(record, 'ClaimId', 'claim_id'));
      const caseType = text(field(record, 'CaseType', 'case_type'), 'MedicaidPCS');
      const parsedLines = jsonValue(field(record, 'ClaimLinesJson', 'claim_lines_json'));
      if (canonical(caseType) === 'statemedicaidhospice' && Array.isArray(parsedLines)) {
        for (const line of parsedLines as Array<Record<string, unknown>>) {
          const lineId = text(field(line, 'line_id', 'LineId'));
          const units = numberValue(field(line, 'units_billed', 'UnitsBilled'));
          claims.push({
            dataSource: 'live',
            sourceId: `data-fabric-claim:${recordId(record)}:${lineId}`,
            sourceUpdatedAt: sourceUpdatedAt(record),
            id: lineId,
            dos: text(field(line, 'date_of_service', 'DateOfService')),
            member: text(field(line, 'member_id', 'MemberId'), text(field(record, 'MemberId', 'member_id'))),
            billed: units,
            evv: units,
            timesheet: units,
            poc: 0,
            improper: 0,
            pocOverage: 0,
            status: text(field(line, 'status', 'Status'), 'Under Review'),
            note: lineId === text(field(record, 'FlaggedLineId', 'flagged_line_id'), '')
              ? text(field(record, 'Notes', 'notes', 'MethodFlag', 'method_flag'))
              : `${claimId} source claim line`,
            source: claimId,
          });
        }
        continue;
      }

      const status = await this.choiceDisplay('claims', 'status', field(record, 'Status', 'status'), 'Under Review');
      const attendantId = text(field(record, 'AttendantId', 'attendant_id'), '');
      const memberId = text(field(record, 'MemberId', 'member_id'), '');
      const dos = text(field(record, 'DateOfService', 'date_of_service'), '');
      const evv = evvRecords.find((visit) => (
        text(field(visit, 'AttendantId', 'attendant_id'), '') === attendantId
        && text(field(visit, 'MemberId', 'member_id'), '') === memberId
        && text(field(visit, 'ServiceDate', 'service_date'), '') === dos
      ));
      claims.push({
        dataSource: 'live',
        sourceId: `data-fabric-claim:${recordId(record)}`,
        sourceUpdatedAt: sourceUpdatedAt(record),
        id: claimId,
        dos,
        member: memberId,
        billed: numberValue(field(record, 'UnitsBilled', 'units_billed')),
        evv: numberValue(field(record, 'EvvSupportedUnits', 'evv_supported_units')),
        timesheet: numberValue(field(record, 'TimesheetSupportedUnits', 'timesheet_supported_units')),
        poc: numberValue(field(record, 'PocDailyUnits', 'poc_daily_units')),
        improper: numberValue(field(record, 'ImproperUnits', 'improper_units')),
        pocOverage: 0,
        status,
        note: text(field(record, 'Notes', 'notes', 'MethodFlag', 'method_flag'), 'No exception note recorded.'),
        source: evv ? text(field(evv, 'EvvId', 'evv_id'), claimId) : claimId,
      });
    }
    return claims;
  }

  private async normalizeRisk(record: Record<string, unknown>): Promise<RiskSignalModel> {
    const severityDisplay = await this.choiceDisplay('riskSignals', 'severity', field(record, 'Severity', 'severity'), 'Medium');
    const inputs = field(record, 'Inputs', 'inputs');
    return {
      dataSource: 'live',
      sourceId: `data-fabric-risk:${recordId(record)}`,
      sourceUpdatedAt: text(field(record, 'ComputedAt', 'computed_at'), sourceUpdatedAt(record)),
      id: text(field(record, 'SignalId', 'signal_id')),
      name: text(field(record, 'Name', 'name')),
      rule: text(field(record, 'RuleExpression', 'rule_expression')),
      result: resultText(field(record, 'ResultValue', 'result_value')),
      severity: severity(severityDisplay),
      citations: citationIds(inputs),
    };
  }

  private async normalizeEvidence(record: Record<string, unknown>): Promise<EvidenceDocumentModel> {
    const [type, status] = await Promise.all([
      this.choiceDisplay('evidenceDocuments', 'doc_type', field(record, 'DocType', 'doc_type'), 'Document'),
      this.choiceDisplay('evidenceDocuments', 'validation_status', field(record, 'ValidationStatus', 'validation_status'), 'Needs review'),
    ]);
    return {
      dataSource: 'live',
      sourceId: `data-fabric-evidence:${recordId(record)}`,
      sourceUpdatedAt: sourceUpdatedAt(record),
      id: text(field(record, 'DocId', 'doc_id')),
      type,
      source: text(field(record, 'SourceSystem', 'source_system')),
      confidence: numberValue(field(record, 'ExtractionConfidence', 'extraction_confidence')),
      status,
      note: text(field(record, 'Note', 'note')),
      fields: displayFields(field(record, 'ExtractedFields', 'extracted_fields')),
    };
  }

  private async normalizeTimeline(
    caseId: string,
    actions: Array<Record<string, unknown>>,
    decisions: Array<Record<string, unknown>>,
  ): Promise<ActivityEvent[]> {
    const actionEvents = await Promise.all(actions.map(async (record) => {
      const actorKind = await this.choiceDisplay(
        'investigationActions',
        'actor_kind',
        field(record, 'ActorKind', 'actor_kind'),
        'System',
      );
      const source: ActivityEvent['source'] = canonical(actorKind) === 'human'
        ? 'user'
        : canonical(actorKind) === 'agent'
          ? 'agent'
          : 'maestro';
      const status = text(field(record, 'ActionType', 'action_type'));
      return createActivityEvent({
        id: text(field(record, 'ActionId', 'action_id')),
        timestamp: text(field(record, 'Timestamp', 'timestamp'), sourceUpdatedAt(record)),
        source,
        severity: canonical(status).includes('fault') || canonical(status).includes('error') ? 'error' : 'info',
        status,
        summary: text(field(record, 'Detail', 'detail')),
        caseId,
      });
    }));
    const decisionEvents = await Promise.all(decisions.map(async (record) => {
      const role = await this.choiceDisplay('decisions', 'decision_role', field(record, 'DecisionRole', 'decision_role'), 'Investigator');
      const approved = booleanValue(field(record, 'Approved', 'approved'));
      return createActivityEvent({
        id: text(field(record, 'DecisionId', 'decision_id')),
        timestamp: text(field(record, 'DecidedAt', 'decided_at'), sourceUpdatedAt(record)),
        source: 'user',
        severity: 'info',
        status: approved && canonical(role) === 'supervisor' ? 'Approval' : 'Decision',
        summary: `${text(field(record, 'DecisionType', 'decision_type'))}: ${text(field(record, 'Rationale', 'rationale'))}`,
        caseId,
      });
    }));
    return [...new ActivityLog([actionEvents, decisionEvents]).events];
  }

  private async findRuntimeCase(caseSummary: DeepReadonly<CaseSummary>): Promise<DeepReadonly<CaseSummary> | null> {
    if (!this.runtimeRepository) return null;
    const result = this.runtimeRepository.listCasesWithWarnings
      ? await this.runtimeRepository.listCasesWithWarnings()
      : { data: await this.runtimeRepository.listCases(), warnings: [] };
    const caseIdentity = canonical(caseSummary.id);
    return result.data.find((candidate) => (
      canonical(candidate.id) === caseIdentity
      || canonical(candidate.businessCaseId) === caseIdentity
      || canonical(candidate.title).includes(caseIdentity)
    )) ?? null;
  }

  private async loadRuntimeEnrichment(
    caseSummary: CaseSummary,
    warnings: string[],
  ): Promise<CaseWorkspaceSnapshot | null> {
    if (!this.runtimeRepository) return null;
    try {
      const runtimeCase = await this.findRuntimeCase(caseSummary);
      if (!runtimeCase) return null;
      const result = this.runtimeRepository.loadWorkspaceWithWarnings
        ? await this.runtimeRepository.loadWorkspaceWithWarnings(runtimeCase.id)
        : { data: await this.runtimeRepository.loadWorkspace(runtimeCase.id), warnings: [] };
      warnings.push(...result.warnings);
      return result.data;
    } catch (reason) {
      warnings.push(`Data Fabric loaded, but UiPath case/task enrichment is unavailable: ${reason instanceof Error ? reason.message : String(reason)}.`);
      return null;
    }
  }
}

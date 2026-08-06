export type DemoRole = 'investigator' | 'supervisor';
export type DataSource = 'live' | 'demo';
export type StageStatus = 'not-started' | 'active' | 'waiting' | 'completed' | 'faulted';
export type TaskStatus = 'Unassigned' | 'Pending' | 'Completed';
export type Severity = 'High' | 'Medium' | 'Low';
export type DeepReadonly<T> = T extends readonly (infer Item)[]
  ? readonly DeepReadonly<Item>[]
  : T extends object
    ? { readonly [Key in keyof T]: DeepReadonly<T[Key]> }
    : T;
export type CaseStageKey =
  | 'intake'
  | 'evidence'
  | 'investigation'
  | 'provider-response'
  | 'supervisor-review'
  | 'closure';

export interface SourceMetadata {
  dataSource: DataSource;
  sourceId: string;
  sourceUpdatedAt: string;
}

export interface CaseSummary extends SourceMetadata {
  id: string;
  title: string;
  program: string;
  priority: Severity;
  status: string;
  stage: string;
  trigger: string;
  alertDate: string;
  servicePeriod: string;
  opened: string;
  slaDue: string;
  investigator: string;
  supervisor: string;
  providerId: string;
  attendantId: string;
  riskSignalCount: number;
  sampleExposure: string;
  periodExposure: string;
  rangeExposure: string;
}

export interface CaseStageDefinition {
  key: CaseStageKey;
  label: string;
  description: string;
}

export interface CaseStageModel extends SourceMetadata {
  key: CaseStageKey;
  label: string;
  description: string;
  status: StageStatus;
  enteredAt?: string;
  completedAt?: string;
}

export interface CaseTaskModel extends SourceMetadata {
  id: number;
  folderId: number;
  type: 'Form' | 'App';
  title: string;
  priority: Severity;
  assignee: string;
  status: TaskStatus;
  stageLabel: string;
  actionCenterUrl: string;
  createdAt: string;
  sla: string;
  gated: boolean;
}

export interface ActivityEvent {
  id: string;
  timestamp: string;
  source: 'maestro' | 'task' | 'agent' | 'user' | 'app';
  severity: 'info' | 'warning' | 'error';
  status: string;
  summary: string;
  caseId?: string;
  taskId?: number;
  correlationId: string;
}

export interface ProviderModel extends SourceMetadata {
  name: string;
  medicaidId: string;
  npi: string;
  address: string;
  enrollment: string;
  attendants: string;
  history: string;
}

export interface AttendantModel extends SourceMetadata {
  name: string;
  id: string;
  role: string;
  cert: string;
  certStatus: string;
  docs: string[];
}

export interface ClaimModel extends SourceMetadata {
  id: string;
  dos: string;
  member: string;
  billed: number;
  evv: number;
  timesheet: number;
  poc: number;
  improper: number;
  pocOverage: number;
  status: string;
  note: string;
  source: string;
}

export interface RiskSignalModel extends SourceMetadata {
  id: string;
  name: string;
  rule: string;
  result: string;
  severity: Severity;
  citations: string[];
}

export interface EvidenceDocumentModel extends SourceMetadata {
  id: string;
  type: string;
  source: string;
  confidence: number;
  status: string;
  note: string;
  fields: Record<string, string>;
}

export interface CaseWorkspaceModel extends SourceMetadata {
  case: CaseSummary;
  stages: CaseStageModel[];
  provider: ProviderModel;
  attendant: AttendantModel;
  claims: ClaimModel[];
  riskSignals: RiskSignalModel[];
  evidenceDocuments: EvidenceDocumentModel[];
  caseTasks: CaseTaskModel[];
  folderTasks: CaseTaskModel[];
  executionTimeline: ActivityEvent[];
}

export type CaseWorkspaceSnapshot = DeepReadonly<CaseWorkspaceModel>;
export type TaskRefreshSnapshot = {
  readonly caseTasks: readonly DeepReadonly<CaseTaskModel>[];
  readonly folderTasks: readonly DeepReadonly<CaseTaskModel>[];
};

export interface CaseRepository {
  listCases(): Promise<readonly DeepReadonly<CaseSummary>[]>;
  loadWorkspace(caseId: string): Promise<CaseWorkspaceSnapshot>;
  refreshTasks(caseId: string): Promise<TaskRefreshSnapshot>;
}

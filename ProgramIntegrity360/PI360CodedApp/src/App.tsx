import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { getUiPathAuthSetup, getUiPathConfigurationError } from './config/uipath';
import { AuthProvider } from './hooks/useAuth';
import { RecordAssistantPanel } from './components/RecordAssistantPanel';

type Role = 'investigator' | 'supervisor';
type Severity = 'High' | 'Medium' | 'Low';
type ScreenId =
  | 'command'
  | 'case360'
  | 'reconciliation'
  | 'evidence'
  | 'decisions'
  | 'provider'
  | 'timeline'
  | 'signals'
  | 'tasks';

type Claim = {
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
};

type RiskSignal = {
  id: string;
  name: string;
  rule: string;
  result: string;
  severity: Severity;
  citations: string[];
};

type EvidenceDocument = {
  id: string;
  type: string;
  source: string;
  confidence: number;
  status: string;
  note: string;
  fields: Record<string, string>;
};

type Action = {
  id: string;
  timestamp: string;
  actorKind: 'Human' | 'System' | 'Agent';
  actor: string;
  type: string;
  detail: string;
};

const authSetup = getUiPathAuthSetup();
const configurationError = getUiPathConfigurationError(authSetup.missingFields);

const caseRecord = {
  id: 'PI-PCS-2026-0041',
  title: 'Harbor Home Support Services - PCS billing integrity review',
  program: 'Medicaid PCS',
  priority: 'High',
  status: 'In Review',
  stage: 'Investigator human review',
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
};

const provider = {
  name: 'Harbor Home Support Services',
  medicaidId: 'MPI-4471902',
  npi: '1730456789',
  address: '2200 Marina Blvd, Suite 210',
  enrollment: 'Active',
  attendants: '22 active attendants',
  history: '1 provider education letter in 2024; no sanctions on record',
};

const attendant = {
  name: 'Jordan Ellis',
  id: 'ATT-2087',
  role: 'Personal Care Attendant',
  cert: 'PCA-556210',
  certStatus: 'Expired 2026-03-31',
  docs: ['Signed training acknowledgment', 'Current background-check attestation'],
};

const claims: Claim[] = [
  { id: 'CLM-0468', dos: '2026-03-03', member: 'MBR-33915', billed: 16, evv: 16, timesheet: 16, poc: 20, improper: 0, pocOverage: 0, status: 'Cleared', note: 'Matched EVV and timesheet', source: 'EVV-88201' },
  { id: 'CLM-0475', dos: '2026-03-10', member: 'MBR-33915', billed: 16, evv: 16, timesheet: 16, poc: 20, improper: 0, pocOverage: 0, status: 'Under Review', note: 'Manual/no-GPS method flag only', source: 'EVV-88208' },
  { id: 'CLM-0491', dos: '2026-04-14', member: 'MBR-33915', billed: 24, evv: 16, timesheet: 16, poc: 20, improper: 8, pocOverage: 4, status: 'Flagged', note: 'Overlap day; billed above EVV and POC', source: 'DOC-SN-0414' },
  { id: 'CLM-0492', dos: '2026-04-14', member: 'MBR-40122', billed: 14, evv: 14, timesheet: 14, poc: 16, improper: 0, pocOverage: 0, status: 'Under Review', note: 'Second member on overlap day', source: 'EVV-88237' },
  { id: 'CLM-0503', dos: '2026-04-16', member: 'MBR-33915', billed: 24, evv: 24, timesheet: 16, poc: 20, improper: 8, pocOverage: 4, status: 'Flagged', note: 'Timesheet DOC-TS-0416 supports 08:00-12:00', source: 'DOC-TS-0416' },
  { id: 'CLM-0517', dos: '2026-04-21', member: 'MBR-33915', billed: 18, evv: 18, timesheet: 18, poc: 20, improper: 0, pocOverage: 0, status: 'Cleared', note: 'Matched EVV and timesheet', source: 'EVV-88250' },
  { id: 'CLM-0528', dos: '2026-04-28', member: 'MBR-33915', billed: 20, evv: 20, timesheet: 20, poc: 20, improper: 0, pocOverage: 0, status: 'Under Review', note: 'Manual/no-GPS method flag only', source: 'EVV-88258' },
  { id: 'CLM-0540', dos: '2026-05-19', member: 'MBR-33915', billed: 24, evv: 24, timesheet: 20, poc: 20, improper: 4, pocOverage: 4, status: 'Flagged', note: 'Timesheet DOC-TS-0519 supports 08:00-13:00', source: 'DOC-TS-0519' },
  { id: 'CLM-0549', dos: '2026-05-26', member: 'MBR-33915', billed: 20, evv: 16, timesheet: 16, poc: 20, improper: 4, pocOverage: 0, status: 'Flagged', note: 'EVV-88288 supports 16 units', source: 'EVV-88288' },
];

const signals: RiskSignal[] = [
  {
    id: 'RS-01',
    name: 'Overlapping visits',
    rule: 'Same attendant, two EVV rows, time intervals intersect same date',
    result: '1 overlap on 2026-04-14; window 10:30-12:00 = 90 minutes across two members',
    severity: 'High',
    citations: ['EVV-88231', 'EVV-88237'],
  },
  {
    id: 'RS-02',
    name: 'Manual EVV / missing GPS',
    rule: 'count(capture_method=Manual and gps_confirmed=No) over period',
    result: '12 of 44 visits (27.3%)',
    severity: 'Medium',
    citations: ['EVV sample'],
  },
  {
    id: 'RS-03',
    name: 'Units above plan of care',
    rule: 'units_billed > poc_daily_units; overage = billed - poc',
    result: '3 dates of service; total overage 12 units',
    severity: 'High',
    citations: ['DOC-POC-33915', 'CLM-0491', 'CLM-0503', 'CLM-0540'],
  },
  {
    id: 'RS-04',
    name: 'Unsupported units',
    rule: 'improper = units_billed - min(evv_supported, timesheet_supported); flag > 0',
    result: '4 claims; 24 de-duplicated unsupported units',
    severity: 'High',
    citations: ['CLM-0491', 'CLM-0503', 'CLM-0540', 'CLM-0549'],
  },
  {
    id: 'RS-05',
    name: 'Personnel documentation gap',
    rule: 'credential_expiry < DOS or required document missing',
    result: 'Cert lapsed 2026-03-31; 8 DOS after lapse; 2 required docs missing',
    severity: 'Medium',
    citations: ['DOC-PP-2087'],
  },
];

const evidenceDocs: EvidenceDocument[] = [
  {
    id: 'DOC-TS-0416',
    type: 'Timesheet',
    source: 'Provider portal upload',
    confidence: 0.71,
    status: 'Human-validated',
    note: 'Handwritten time_out confirmed 12:00; contradicts CLM-0503',
    fields: { attendant: 'Jordan Ellis', member: 'MBR-33915', date: '2026-04-16', time_in: '08:00', time_out: '12:00', supported_units: '16' },
  },
  {
    id: 'DOC-TS-0519',
    type: 'Timesheet',
    source: 'Provider portal upload',
    confidence: 0.88,
    status: 'Auto-confirmed',
    note: 'Contradicts CLM-0540',
    fields: { attendant: 'Jordan Ellis', member: 'MBR-33915', date: '2026-05-19', time_in: '08:00', time_out: '13:00', supported_units: '20' },
  },
  {
    id: 'DOC-POC-33915',
    type: 'Plan of Care',
    source: 'Legacy care-management pull',
    confidence: 0.94,
    status: 'Auto-confirmed',
    note: 'Establishes 20 units/day used by RS-03',
    fields: { member: 'MBR-33915', authorized_units_per_day: '20', authorized_units_per_week: '80', service: 'Personal Care', effective: '2026-01-01', expires: '2026-12-31' },
  },
  {
    id: 'DOC-SN-0414',
    type: 'Service Note',
    source: 'Provider portal upload',
    confidence: 0.83,
    status: 'Needs review',
    note: 'Narrative supports AM-only visit; relevant to RS-01 / CLM-0491',
    fields: { member: 'MBR-33915', date: '2026-04-14', documented_end: '12:00', narrative: 'left at noon' },
  },
  {
    id: 'DOC-PP-2087',
    type: 'Personnel Packet',
    source: 'Provider records request',
    confidence: 0.9,
    status: 'Human-validated',
    note: 'Feeds RS-05; 2 docs missing; cert lapsed',
    fields: { attendant: 'ATT-2087', certification: 'PCA-556210', certification_expiry: '2026-03-31', missing_documents: '2' },
  },
  {
    id: 'DOC-CORR-01',
    type: 'Correspondence',
    source: 'Records-request inbox',
    confidence: 0.86,
    status: 'Human-validated',
    note: 'Provider response does not resolve the 04-16 EVV/timesheet mismatch',
    fields: { received: '2026-07-28', summary: 'Provider states 04-16 visit extended to 14:00 due to member need; acknowledges certification renewal in progress.' },
  },
];

const actions: Action[] = [
  { id: 'ACT-0001', timestamp: '2026-07-22 09:12', actorKind: 'System', actor: 'Case intake', type: 'Case created', detail: 'Opened from alert ALERT-CA-2026-7781.' },
  { id: 'ACT-0002', timestamp: '2026-07-22 10:41', actorKind: 'System', actor: 'deterministic-calc-v1', type: 'Signal computed', detail: 'Computed RS-01 through RS-05.' },
  { id: 'ACT-0003', timestamp: '2026-07-22 10:45', actorKind: 'Agent', actor: 'Triage Agent', type: 'Agent output', detail: 'Priority explained as High, grounded in RS-01, RS-03, RS-04.' },
  { id: 'ACT-0004', timestamp: '2026-07-23 08:20', actorKind: 'System', actor: 'IXP', type: 'Doc extracted', detail: 'Six evidence documents extracted; two fields below confidence threshold.' },
  { id: 'ACT-0005', timestamp: '2026-07-23 09:05', actorKind: 'Human', actor: 'inv.taylor', type: 'Human validated', detail: 'Validated DOC-TS-0416 time_out as 12:00.' },
  { id: 'ACT-0006', timestamp: '2026-07-23 09:30', actorKind: 'Agent', actor: 'Evidence Correlation Agent', type: 'Agent output', detail: 'Grouped findings into Unsupported billing, Visit integrity, and Credentialing / personnel.' },
  { id: 'ACT-0007', timestamp: '2026-07-23 09:35', actorKind: 'Agent', actor: 'Investigation Planning Agent', type: 'Agent output', detail: 'Recommended records request and no adverse action pending provider response.' },
  { id: 'ACT-0008', timestamp: '2026-07-24 11:10', actorKind: 'Human', actor: 'inv.taylor', type: 'Edit', detail: 'Reclassified CLM-0475 method flag as informational.' },
  { id: 'ACT-0009', timestamp: '2026-07-24 11:20', actorKind: 'Human', actor: 'inv.taylor', type: 'Decision', detail: 'Recorded DEC-0001: proceed to records request.' },
  { id: 'ACT-0010', timestamp: '2026-07-24 11:25', actorKind: 'System', actor: 'Records request workflow', type: 'Request sent', detail: 'Status moved to Awaiting Provider.' },
  { id: 'ACT-0011', timestamp: '2026-07-28 14:02', actorKind: 'System', actor: 'Records inbox', type: 'Response received', detail: 'Received DOC-CORR-01 and moved status back to In Review.' },
  { id: 'ACT-0012', timestamp: '2026-07-28 14:30', actorKind: 'Agent', actor: 'Summary Agent', type: 'Agent output', detail: 'Drafted supervisor-facing summary v2.' },
  { id: 'ACT-0013', timestamp: '2026-07-29 13:50', actorKind: 'Human', actor: 'sup.morgan', type: 'Approval', detail: 'Approved DEC-0002: refer for audit and open overpayment recovery.' },
  { id: 'ACT-0014', timestamp: '2026-07-29 14:00', actorKind: 'System', actor: 'Action execution workflow', type: 'Action executed', detail: 'Referral packet created and recovery opened for confirmed unsupported units.' },
];

const tasks = [
  { title: 'Validate low-confidence extraction - DOC-SN-0414', type: 'Form', priority: 'Medium', status: 'Pending', assignee: 'inv.taylor', sla: 'On time', gated: false },
  { title: 'Investigator review - reconciliation and narrative', type: 'App', priority: 'High', status: 'Pending', assignee: 'inv.taylor', sla: 'Due soon', gated: false },
  { title: 'Supervisor approval - refer for audit and recovery', type: 'App', priority: 'High', status: 'Unassigned', assignee: '-', sla: 'Due soon', gated: true },
];

const navItems: Array<{ id: ScreenId; label: string }> = [
  { id: 'command', label: 'Command' },
  { id: 'case360', label: 'Case 360' },
  { id: 'reconciliation', label: 'Reconcile' },
  { id: 'evidence', label: 'Evidence' },
  { id: 'decisions', label: 'Decisions' },
  { id: 'provider', label: 'Provider' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'signals', label: 'Signals' },
  { id: 'tasks', label: 'Tasks' },
];

const stageLabels = ['Intake', 'Collect', 'Extract', 'Correlate', 'Review', 'Records', 'Approve', 'Execute', 'Close'];

function App() {
  return (
    <AuthProvider config={authSetup.config}>
      <ProgramIntegrityDashboard />
    </AuthProvider>
  );
}

function ProgramIntegrityDashboard() {
  const [activeScreen, setActiveScreen] = useState<ScreenId>('command');
  const [role, setRole] = useState<Role>('investigator');
  const [isRecordAssistantOpen, setIsRecordAssistantOpen] = useState(false);
  const selectedEvidence = useMemo(() => evidenceDocs[0], []);
  const recordContext = useMemo(() => ({
    caseRecord,
    provider,
    attendant,
    claims,
    riskSignals: signals,
    evidenceDocuments: evidenceDocs,
    actions,
    tasks,
    stageLabels,
    activeStage: caseRecord.stage,
  }), []);

  return (
    <div className="min-h-screen bg-[#f7f8f4] text-slate-900">
      <TopBar
        role={role}
        setRole={setRole}
        onOpenRecordAssistant={() => setIsRecordAssistantOpen(true)}
      />
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1600px] items-center gap-2 overflow-x-auto px-4 py-2">
          {stageLabels.map((stage, index) => (
            <div
              key={stage}
              className={`flex min-w-fit items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold ${
                index === 4 ? 'bg-amber-100 text-amber-900 ring-1 ring-amber-300' : 'bg-slate-50 text-slate-600'
              }`}
            >
              <span className="tabular-nums">{index + 1}</span>
              <span>{stage}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mx-auto grid max-w-[1600px] grid-cols-1 lg:grid-cols-[184px_1fr]">
        <aside className="border-b border-slate-200 bg-white p-3 lg:min-h-[calc(100vh-113px)] lg:border-b-0 lg:border-r">
          <nav className="grid grid-cols-3 gap-2 lg:grid-cols-1">
            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveScreen(item.id)}
                className={`min-w-0 rounded-md px-3 py-2 text-left text-sm font-semibold transition ${
                  activeScreen === item.id
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
                }`}
                title={item.label}
              >
                <span className="block truncate">{item.label}</span>
              </button>
            ))}
          </nav>
        </aside>

        <main className="min-w-0 p-4 lg:p-6">
          {configurationError && (
            <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
              Local fixture mode. OAuth is not configured yet; the UI is rendering synthetic Program Integrity 360 data.
            </div>
          )}
          {activeScreen === 'command' && <CommandCenter onOpenCase={() => setActiveScreen('case360')} />}
          {activeScreen === 'case360' && <Case360 onOpenDecision={() => setActiveScreen('decisions')} />}
          {activeScreen === 'reconciliation' && <Reconciliation />}
          {activeScreen === 'evidence' && <EvidenceStudio selected={selectedEvidence} />}
          {activeScreen === 'decisions' && <DecisionCenter role={role} />}
          {activeScreen === 'provider' && <ProviderResponse />}
          {activeScreen === 'timeline' && <Timeline />}
          {activeScreen === 'signals' && <RiskSignals />}
          {activeScreen === 'tasks' && <TaskList role={role} />}
        </main>
      </div>
      <RecordAssistantPanel
        isOpen={isRecordAssistantOpen}
        onClose={() => setIsRecordAssistantOpen(false)}
        recordContext={recordContext}
        configurationError={configurationError}
      />
    </div>
  );
}

function TopBar({
  role,
  setRole,
  onOpenRecordAssistant,
}: {
  role: Role;
  setRole: (role: Role) => void;
  onOpenRecordAssistant: () => void;
}) {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-3 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="truncate text-lg font-bold tracking-normal text-slate-950">Program Integrity 360</div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-600">
            <span className="rounded-md bg-amber-50 px-2 py-1 font-semibold text-amber-900 ring-1 ring-amber-200">
              Risk signals - not a determination
            </span>
            <span>Case {caseRecord.id}</span>
            <span>Restricted work product</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
            Role:
            <select
              value={role}
              onChange={(event) => setRole(event.target.value as Role)}
              className="ml-2 bg-transparent font-semibold outline-none"
            >
              <option value="investigator">Investigator</option>
              <option value="supervisor">Supervisor</option>
            </select>
          </div>
          <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
            {authSetup.config.orgName}/{authSetup.config.tenantName || 'Playground'}
          </div>
          <button
            type="button"
            onClick={onOpenRecordAssistant}
            className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-700"
          >
            Record Assistant
          </button>
        </div>
      </div>
    </header>
  );
}

function CommandCenter({ onOpenCase }: { onOpenCase: () => void }) {
  return (
    <Screen title="Command Center" subtitle="Assigned work queue, signal posture, SLA, and exposure context.">
      <div className="grid gap-3 md:grid-cols-4">
        <Metric label="Open cases" value="1" />
        <Metric label="Priority High" value="1" tone="red" />
        <Metric label="Awaiting provider" value="0" />
        <Metric label="Tasks due in 48h" value="2" tone="amber" />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.35fr_1fr]">
        <Panel title="Case Queue">
          <div className="overflow-x-auto">
            <table className="w-full table-fixed text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
                <tr>
                  <th className="w-40 px-3 py-2">Case</th>
                  <th className="px-3 py-2">Title</th>
                  <th className="w-36 px-3 py-2">Provider</th>
                  <th className="w-24 px-3 py-2">Priority</th>
                  <th className="w-32 px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-slate-100">
                  <td className="px-3 py-3 font-mono text-xs">{caseRecord.id}</td>
                  <td className="min-w-0 px-3 py-3">
                    <button type="button" onClick={onOpenCase} className="block max-w-full truncate font-semibold text-slate-900 hover:underline" title={caseRecord.title}>
                      {caseRecord.title}
                    </button>
                  </td>
                  <td className="px-3 py-3">{caseRecord.providerId}</td>
                  <td className="px-3 py-3"><SeverityTag severity="High" /></td>
                  <td className="px-3 py-3">{caseRecord.status}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title="SLA / Workload">
          <KeyValue rows={[
            ['Intake SLA due', caseRecord.slaDue],
            ['Case opened', caseRecord.opened],
            ['Investigator', caseRecord.investigator],
            ['Supervisor', caseRecord.supervisor],
            ['Service period', caseRecord.servicePeriod],
          ]} />
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_1fr]">
        <Panel title="Risk Signal Heatmap">
          <div className="grid gap-2 sm:grid-cols-2">
            {signals.map((signal) => (
              <div key={signal.id} className="min-w-0 rounded-md border border-slate-200 bg-white p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-mono text-xs text-slate-500">{signal.id}</span>
                  <SeverityTag severity={signal.severity} />
                </div>
                <div className="mt-2 truncate text-sm font-semibold" title={signal.name}>{signal.name}</div>
              </div>
            ))}
          </div>
        </Panel>
        <ExposurePanel />
      </div>
    </Screen>
  );
}

function Case360({ onOpenDecision }: { onOpenDecision: () => void }) {
  return (
    <Screen title="Case 360" subtitle={`${caseRecord.id} - ${caseRecord.title}`}>
      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Provider">
          <KeyValue rows={[
            ['Name', provider.name],
            ['Provider ID', caseRecord.providerId],
            ['Medicaid ID', provider.medicaidId],
            ['NPI', provider.npi],
            ['Address', provider.address],
            ['Enrollment', provider.enrollment],
            ['Prior history', provider.history],
          ]} />
        </Panel>
        <Panel title="Attendant Subject">
          <KeyValue rows={[
            ['Name', attendant.name],
            ['Attendant ID', attendant.id],
            ['Role', attendant.role],
            ['Certification', `${attendant.cert} - ${attendant.certStatus}`],
            ['Missing docs', attendant.docs.join('; ')],
          ]} />
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_1fr_1fr]">
        <Panel title="Case Posture">
          <KeyValue rows={[
            ['Program', caseRecord.program],
            ['Priority', caseRecord.priority],
            ['Status', caseRecord.status],
            ['Stage', caseRecord.stage],
            ['Trigger', `${caseRecord.trigger} on ${caseRecord.alertDate}`],
          ]} />
        </Panel>
        <Panel title="Members Receiving Care">
          <KeyValue rows={[
            ['MBR-33915', 'R.A. - 20 units/day, 80 units/week'],
            ['MBR-40122', 'T.N. - 16 units/day, 60 units/week'],
            ['Unit convention', '1 unit = 15 minutes; blended rate $7.20/unit'],
          ]} />
        </Panel>
        <Panel title="Signals and Exposure">
          <div className="space-y-3">
            <div className="text-sm"><span className="font-semibold">Signals:</span> {caseRecord.riskSignalCount}</div>
            <div className="text-sm"><span className="font-semibold">Sample:</span> {caseRecord.sampleExposure}</div>
            <div className="text-sm"><span className="font-semibold">Reviewed period:</span> {caseRecord.periodExposure}</div>
            <button type="button" onClick={onOpenDecision} className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-700">
              Open Decision Center
            </button>
          </div>
        </Panel>
      </div>
    </Screen>
  );
}

function Reconciliation() {
  return (
    <Screen title="Claims vs EVV Reconciliation" subtitle="Deterministic review of billed units, supported units, and stored improper units.">
      <Panel title="Claim Sample">
        <div className="overflow-x-auto">
          <table className="w-full table-fixed text-left text-xs">
            <thead className="border-b border-slate-200 uppercase text-slate-500">
              <tr>
                {['Claim', 'DOS', 'Member', 'Billed', 'EVV', 'TS', 'POC', 'Improper', 'POC over', 'Status'].map((header) => (
                  <th key={header} className="px-2 py-2">{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {claims.map((claim) => (
                <tr key={claim.id} className="border-b border-slate-100 align-top">
                  <td className="px-2 py-3 font-mono">{claim.id}</td>
                  <td className="px-2 py-3">{claim.dos}</td>
                  <td className="px-2 py-3">{claim.member}</td>
                  <td className="px-2 py-3 tabular-nums">{claim.billed}</td>
                  <td className="px-2 py-3 tabular-nums">{claim.evv}</td>
                  <td className="px-2 py-3 tabular-nums">{claim.timesheet}</td>
                  <td className="px-2 py-3 tabular-nums">{claim.poc}</td>
                  <td className={`px-2 py-3 tabular-nums ${claim.improper > 0 ? 'font-bold text-red-700' : ''}`}>{claim.improper}</td>
                  <td className={`px-2 py-3 tabular-nums ${claim.pocOverage > 0 ? 'font-bold text-amber-700' : ''}`}>{claim.pocOverage}</td>
                  <td className="min-w-0 px-2 py-3">
                    <div className="truncate" title={`${claim.status}: ${claim.note}`}>{claim.status}</div>
                    <div className="truncate text-slate-500" title={claim.source}>{claim.source}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_1fr]">
        <Panel title="Overlap Anchor">
          <div className="space-y-3 text-sm">
            <div><b>EVV-88231</b> MBR-33915, 08:00-12:00, 16 units.</div>
            <div><b>EVV-88237</b> MBR-40122, 10:30-14:00, 14 units.</div>
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-red-950">
              Stored result: overlap window 10:30-12:00 = 90 minutes. Source: RS-01.
            </div>
          </div>
        </Panel>
        <ExposurePanel />
      </div>
    </Screen>
  );
}

function EvidenceStudio({ selected }: { selected: EvidenceDocument }) {
  return (
    <Screen title="Evidence Studio" subtitle="Document validation, extracted fields, source preview state, and claim contradictions.">
      <div className="grid gap-4 xl:grid-cols-[280px_1fr_360px]">
        <Panel title="Documents">
          <div className="space-y-2">
            {evidenceDocs.map((doc) => (
              <div key={doc.id} className={`rounded-md border p-3 ${doc.id === selected.id ? 'border-slate-900 bg-slate-50' : 'border-slate-200 bg-white'}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-mono text-xs font-semibold" title={doc.id}>{doc.id}</span>
                  <span className="text-xs tabular-nums">{doc.confidence.toFixed(2)}</span>
                </div>
                <div className="mt-1 truncate text-sm font-semibold" title={doc.type}>{doc.type}</div>
                <div className="mt-1 truncate text-xs text-slate-500" title={doc.status}>{doc.status}</div>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title={`Extracted Fields - ${selected.id}`}>
          <KeyValue rows={Object.entries(selected.fields)} />
          <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
            {selected.note}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white">Confirm field</button>
            <button type="button" className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700">Correct value</button>
          </div>
        </Panel>
        <Panel title="Source Preview">
          <div className="flex aspect-[4/5] items-center justify-center rounded-md border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">
            Bucket preview placeholder for pi-evidence/{caseRecord.id}/{selected.id.toLowerCase()}.pdf
          </div>
          <button type="button" className="mt-3 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700">Download source</button>
        </Panel>
      </div>
    </Screen>
  );
}

function DecisionCenter({ role }: { role: Role }) {
  return (
    <Screen title="Decision Center" subtitle="Recommendations are separated from human decisions and supervisor-gated dispositions.">
      <Panel title="Agent Recommendation">
        <FactInference
          facts={['RS-01, RS-03, and RS-04 support a provider records request.', 'No provider response was available at the Stage 5 planning gate.']}
          inferences={['Recommended next step: request provider records, then hold adverse or financial action pending response.']}
          citations={['RS-01', 'RS-03', 'RS-04', 'ACT-0007']}
        />
      </Panel>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Panel title="Investigator Decisions">
          <button type="button" className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white">Proceed to records request</button>
          <p className="mt-3 text-sm text-slate-600">DEC-0001 pattern. adverse_or_financial = false.</p>
        </Panel>
        <Panel title="Supervisor Dispositions">
          <div className="flex flex-wrap gap-2">
            <GatedButton role={role}>Refer for audit</GatedButton>
            <GatedButton role={role}>Open recovery</GatedButton>
            <GatedButton role={role}>Provider education</GatedButton>
            <GatedButton role={role}>Close - no action</GatedButton>
          </div>
        </Panel>
      </div>

      <Panel title="Decision Record" className="mt-4">
        <div className="space-y-3 text-sm">
          <DecisionLine id="DEC-0001" actor="inv.taylor" role="Investigator" text="Proceed to records request. Provider has an opportunity to respond before any financial action." />
          <DecisionLine id="DEC-0002" actor="sup.morgan" role="Supervisor" text="Approved audit referral and recovery limited to confirmed unsupported units. Program-integrity action, not a determination." />
        </div>
      </Panel>
    </Screen>
  );
}

function ProviderResponse() {
  return (
    <Screen title="Provider Response Tracking" subtitle="Records request, wait state, response intake, and reprocessing context.">
      <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <Panel title="Request Timeline">
          <KeyValue rows={[
            ['Request sent', '2026-07-24 11:25Z - status to Awaiting Provider'],
            ['Wait state', '5 business day SLA, cleared'],
            ['Response received', '2026-07-28 14:02Z - DOC-CORR-01'],
            ['Summary redrafted', '2026-07-28 14:30Z - Summary Agent v2'],
          ]} />
        </Panel>
        <Panel title="Response Impact">
          <div className="space-y-3 text-sm">
            <p>Provider states the 04-16 visit extended to 14:00 due to member need and acknowledges certification renewal in progress.</p>
            <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-950">
              The response does not reconcile DOC-TS-0416 with CLM-0503. The stored unsupported unit figure remains 24.
            </p>
            <button type="button" className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white">Acknowledge / reprocess</button>
          </div>
        </Panel>
      </div>
    </Screen>
  );
}

function Timeline() {
  return (
    <Screen title="Case Timeline" subtitle="Append-only investigation action stream.">
      <Panel title="Actions">
        <div className="space-y-3">
          {actions.map((action) => (
            <div key={action.id} className="grid gap-2 rounded-md border border-slate-200 bg-white p-3 text-sm lg:grid-cols-[160px_88px_1fr_96px]">
              <div className="font-mono text-xs text-slate-500">{action.timestamp}</div>
              <ActorTag kind={action.actorKind} />
              <div className="min-w-0">
                <div className="truncate font-semibold" title={`${action.actor} - ${action.type}`}>{action.actor} - {action.type}</div>
                <div className="mt-1 text-slate-600">{action.detail}</div>
              </div>
              <div className="font-mono text-xs text-slate-500">{action.id}</div>
            </div>
          ))}
        </div>
      </Panel>
    </Screen>
  );
}

function RiskSignals() {
  return (
    <Screen title="Risk Signals and Agent Rationale" subtitle="Stored deterministic signals beside cited agent rationale.">
      <div className="grid gap-4 xl:grid-cols-[1fr_420px]">
        <div className="grid gap-3">
          {signals.map((signal) => (
            <Panel key={signal.id} title={`${signal.id} - ${signal.name}`}>
              <div className="flex flex-wrap items-center gap-2">
                <SeverityTag severity={signal.severity} />
                <Provenance />
              </div>
              <p className="mt-3 text-sm text-slate-700"><b>Rule:</b> {signal.rule}</p>
              <p className="mt-2 text-sm text-slate-700"><b>Result:</b> {signal.result}</p>
              <CitationRow citations={signal.citations} />
            </Panel>
          ))}
        </div>
        <Panel title="Agent Rationale">
          <div className="space-y-4">
            <FactInference
              title="Triage Agent"
              facts={['Priority High is grounded in RS-01, RS-03, and RS-04.']}
              inferences={['The cluster warrants investigator review before any downstream action.']}
              citations={['ACT-0003', 'RS-01', 'RS-03', 'RS-04']}
            />
            <FactInference
              title="Evidence Correlation Agent"
              facts={['Findings group into Unsupported billing, Visit integrity, and Credentialing / personnel.']}
              inferences={['Start with the 04-16 timesheet mismatch and 04-14 overlap.']}
              citations={['ACT-0006', 'CLM-0503', 'DOC-TS-0416']}
            />
            <FactInference
              title="Summary Agent"
              facts={['24 unsupported units remain after provider response DOC-CORR-01.']}
              inferences={['Supervisor can consider recovery limited to confirmed unsupported units.']}
              citations={['ACT-0012', 'DOC-CORR-01', 'DEC-0002']}
            />
          </div>
        </Panel>
      </div>
    </Screen>
  );
}

function TaskList({ role }: { role: Role }) {
  return (
    <Screen title="Tasks and SLA" subtitle="Action Center task queue with visible supervisor gates.">
      <div className="grid gap-3 md:grid-cols-4">
        <Metric label="Overdue" value="0" />
        <Metric label="Due soon" value="1" tone="amber" />
        <Metric label="On time" value="2" />
        <Metric label="Intake SLA" value="Aug 5" />
      </div>

      <Panel title="Task List" className="mt-4">
        <div className="overflow-x-auto">
          <table className="w-full table-fixed text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">Title</th>
                <th className="w-24 px-3 py-2">Type</th>
                <th className="w-24 px-3 py-2">Priority</th>
                <th className="w-28 px-3 py-2">Status</th>
                <th className="w-32 px-3 py-2">Assignee</th>
                <th className="w-44 px-3 py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => (
                <tr key={task.title} className="border-b border-slate-100">
                  <td className="min-w-0 px-3 py-3"><div className="truncate font-semibold" title={task.title}>{task.title}</div><div className="text-xs text-slate-500">{task.sla}</div></td>
                  <td className="px-3 py-3">{task.type}</td>
                  <td className="px-3 py-3">{task.priority}</td>
                  <td className="px-3 py-3">{task.status}</td>
                  <td className="px-3 py-3">{task.assignee}</td>
                  <td className="px-3 py-3">{task.gated ? <GatedButton role={role}>Complete</GatedButton> : <button type="button" className="rounded-md bg-slate-900 px-3 py-2 text-xs font-semibold text-white">Complete</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 text-xs text-slate-500">Showing 1-3 of 3</div>
      </Panel>
    </Screen>
  );
}

function Screen({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <section>
      <div className="mb-4 min-w-0">
        <h1 className="text-2xl font-bold tracking-normal text-slate-950">{title}</h1>
        <p className="mt-1 max-w-4xl text-sm text-slate-600">{subtitle}</p>
      </div>
      {children}
    </section>
  );
}

function Panel({ title, children, className = '' }: { title: string; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-md border border-slate-200 bg-white p-4 shadow-sm ${className}`}>
      <h2 className="mb-3 text-sm font-bold uppercase tracking-normal text-slate-600">{title}</h2>
      {children}
    </section>
  );
}

function Metric({ label, value, tone = 'slate' }: { label: string; value: string; tone?: 'slate' | 'amber' | 'red' }) {
  const tones = {
    slate: 'bg-slate-900 text-white',
    amber: 'bg-amber-500 text-slate-950',
    red: 'bg-red-600 text-white',
  };
  return (
    <div className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-normal text-slate-500">{label}</div>
      <div className={`mt-3 inline-flex min-w-16 justify-center rounded-md px-3 py-2 text-2xl font-bold tabular-nums ${tones[tone]}`}>
        {value}
      </div>
    </div>
  );
}

function ExposurePanel() {
  return (
    <Panel title="Exposure Headline">
      <div className="grid gap-3 sm:grid-cols-3">
        <Metric label="Sample" value={caseRecord.sampleExposure} />
        <Metric label="Reviewed period" value={caseRecord.periodExposure} tone="amber" />
        <Metric label="Provider range" value={caseRecord.rangeExposure} />
      </div>
      <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
        Indicative range, subject to human validation. Not a determination or a demand for repayment.
      </div>
      <div className="mt-3 text-sm text-slate-600">
        Stored values: 24 unsupported units at $7.20/unit; RS-03 and RS-04 can touch the same dates, so exposure uses the de-duplicated RS-04 figure.
      </div>
    </Panel>
  );
}

function SeverityTag({ severity }: { severity: Severity }) {
  const classes = {
    High: 'bg-red-50 text-red-700 ring-red-200',
    Medium: 'bg-amber-50 text-amber-800 ring-amber-200',
    Low: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  };
  return <span className={`rounded-md px-2 py-1 text-xs font-bold ring-1 ${classes[severity]}`}>{severity}</span>;
}

function ActorTag({ kind }: { kind: Action['actorKind'] }) {
  const classes = {
    Human: 'bg-blue-50 text-blue-700 ring-blue-200',
    System: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    Agent: 'bg-amber-50 text-amber-800 ring-amber-200',
  };
  return <span className={`h-fit rounded-md px-2 py-1 text-xs font-bold ring-1 ${classes[kind]}`}>{kind}</span>;
}

function Provenance() {
  return <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">computed_by: deterministic-calc-v1</span>;
}

function KeyValue({ rows }: { rows: Array<[string, string]> }) {
  return (
    <dl className="grid gap-2 text-sm">
      {rows.map(([key, value]) => (
        <div key={key} className="grid grid-cols-[140px_1fr] gap-3 border-b border-slate-100 pb-2 last:border-b-0">
          <dt className="min-w-0 truncate text-slate-500" title={key}>{key}</dt>
          <dd className="min-w-0 break-words font-medium text-slate-900">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function CitationRow({ citations }: { citations: string[] }) {
  return (
    <div className="mt-3 flex flex-wrap gap-1">
      {citations.map((citation) => (
        <span key={citation} className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 font-mono text-[11px] text-slate-600">{citation}</span>
      ))}
    </div>
  );
}

function FactInference({ title, facts, inferences, citations }: { title?: string; facts: string[]; inferences: string[]; citations: string[] }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-3">
      {title && <h3 className="mb-2 font-semibold text-slate-900">{title}</h3>}
      <div className="border-l-4 border-slate-700 pl-3">
        <div className="text-xs font-bold uppercase text-slate-500">FACT (cited)</div>
        <ul className="mt-1 list-disc space-y-1 pl-4 text-sm text-slate-700">
          {facts.map((fact) => <li key={fact}>{fact}</li>)}
        </ul>
      </div>
      <div className="mt-3 border-l-4 border-dashed border-amber-500 pl-3">
        <div className="text-xs font-bold uppercase text-amber-700">INFERENCE (suggested, for human review)</div>
        <ul className="mt-1 list-disc space-y-1 pl-4 text-sm text-slate-700">
          {inferences.map((inference) => <li key={inference}>{inference}</li>)}
        </ul>
      </div>
      <CitationRow citations={citations} />
    </div>
  );
}

function GatedButton({ role, children }: { role: Role; children: ReactNode }) {
  const disabled = role !== 'supervisor';
  return (
    <button
      type="button"
      disabled={disabled}
      title={disabled ? 'Supervisor approval required' : String(children)}
      className={`rounded-md px-3 py-2 text-xs font-semibold ${
        disabled
          ? 'cursor-not-allowed border border-slate-200 bg-slate-100 text-slate-500'
          : 'bg-red-600 text-white hover:bg-red-700'
      }`}
    >
      {children}
      {disabled && <span className="ml-1">- supervisor required</span>}
    </button>
  );
}

function DecisionLine({ id, actor, role, text }: { id: string; actor: string; role: string; text: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
      <div className="flex flex-wrap gap-2 text-xs text-slate-500">
        <span className="font-mono">{id}</span>
        <span>{actor}</span>
        <span>{role}</span>
      </div>
      <p className="mt-2 text-slate-700">{text}</p>
    </div>
  );
}

export default App;

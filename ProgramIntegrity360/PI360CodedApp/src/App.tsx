import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { getUiPathAuthSetup, getUiPathConfigurationError } from './config/uipath';
import { AuthProvider } from './hooks/useAuth';
import { RecordAssistantPanel } from './components/RecordAssistantPanel';

import { createDemoCaseWorkspace } from './features/cases/demoRepository';
import type {
  ActivityEvent,
  DemoRole,
  EvidenceDocumentModel,
  Severity as CaseSeverity,
} from './features/cases/types';

type Role = DemoRole;
type Severity = CaseSeverity;
type EvidenceDocument = EvidenceDocumentModel;
type Action = ActivityEvent;
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

const authSetup = getUiPathAuthSetup();
const configurationError = getUiPathConfigurationError(authSetup.missingFields);

const workspace = createDemoCaseWorkspace();
const caseRecord = workspace.case;
const caseStages = workspace.stages;
const provider = workspace.provider;
const attendant = workspace.attendant;
const claims = workspace.claims;
const signals = workspace.riskSignals;
const evidenceDocs = workspace.evidenceDocuments;
const actions = workspace.executionTimeline;
const tasks = [...workspace.folderTasks, ...workspace.caseTasks];
const stageLabels = caseStages.map((stage) => stage.label);

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
          {caseStages.map((stage, index) => (
            <div
              key={stage.key}
              className={`flex min-w-fit items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold ${
                stage.status === 'active' ? 'bg-amber-100 text-amber-900 ring-1 ring-amber-300' : 'bg-slate-50 text-slate-600'
              }`}
            >
              <span className="tabular-nums">{index + 1}</span>
              <span>{stage.label}</span>
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

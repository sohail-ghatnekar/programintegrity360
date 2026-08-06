import { Alert, AlertDescription, AlertTitle, Badge } from '@uipath/apollo-wind';
import { AlertTriangle, CheckCircle2, Scale, ShieldCheck } from 'lucide-react';
import type { CaseWorkspaceSnapshot, DemoRole } from './types';

type DecisionWorkspaceProps = {
  workspace: CaseWorkspaceSnapshot;
  role: DemoRole;
};

const dispositionOptions = [
  ['Refer for audit', 'Escalate the verified case record for audit review.'],
  ['Open recovery', 'Limit recovery review to confirmed unsupported units.'],
  ['Provider education', 'Route confirmed process gaps to provider education.'],
  ['Close - no action', 'Record the supervisor rationale and close monitoring.'],
] as const;

export function DecisionWorkspace({ workspace, role }: DecisionWorkspaceProps) {
  const decisionEvents = workspace.executionTimeline.filter((event) => (
    event.type === 'Decision' || event.type === 'Approval'
  ));

  if (role === 'supervisor') {
    return (
      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section aria-labelledby="supervisor-dispositions-heading">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 id="supervisor-dispositions-heading" className="text-base font-semibold text-slate-950">Supervisor dispositions</h2>
              <p className="mt-1 text-sm text-slate-600">Authorized outcomes presented for supervisor review.</p>
            </div>
            <Badge variant="warning"><ShieldCheck aria-hidden="true" className="mr-1 h-3.5 w-3.5" />Supervisor only</Badge>
          </div>

          <Alert className="mb-3">
            <Scale aria-hidden="true" className="h-4 w-4" />
            <AlertTitle>Presentation mode</AlertTitle>
            <AlertDescription>Disposition execution remains in the authorized UiPath task workflow.</AlertDescription>
          </Alert>

          <ul className="divide-y divide-slate-200 border-y border-slate-200 bg-white">
            {dispositionOptions.map(([label, description]) => (
              <li key={label} className="flex items-start gap-3 px-3 py-3">
                <CheckCircle2 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-900">{label}</div>
                  <p className="mt-0.5 text-xs text-slate-500">{description}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <DecisionHistory events={decisionEvents} />
      </div>
    );
  }

  return (
    <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <section aria-labelledby="investigator-decision-heading">
        <h2 id="investigator-decision-heading" className="text-base font-semibold text-slate-950">Investigator assessment</h2>
        <p className="mt-1 text-sm text-slate-600">Evidence-based next steps remain separate from supervisor disposition.</p>
        <Alert className="mt-3">
          <AlertTriangle aria-hidden="true" className="h-4 w-4" />
          <AlertTitle>Current assessment</AlertTitle>
          <AlertDescription>
            Reconcile the provider response against the 24 stored unsupported units before routing the case for supervisor review.
          </AlertDescription>
        </Alert>
        <dl className="mt-4 grid border-y border-slate-200 bg-white sm:grid-cols-3">
          <DecisionMetric label="Flagged claims" value={String(workspace.claims.filter((claim) => claim.status === 'Flagged').length)} />
          <DecisionMetric label="Open evidence review" value={String(workspace.evidenceDocuments.filter((document) => document.status === 'Needs review').length)} />
          <DecisionMetric label="Investigator tasks" value={String(workspace.caseTasks.filter((task) => !task.gated && task.status !== 'Completed').length)} />
        </dl>
      </section>

      <DecisionHistory events={decisionEvents} />
    </div>
  );
}

function DecisionHistory({ events }: { events: readonly CaseWorkspaceSnapshot['executionTimeline'][number][] }) {
  return (
    <section aria-labelledby="decision-history-heading" className="border-l-0 border-slate-200 xl:border-l xl:pl-5">
      <h2 id="decision-history-heading" className="text-base font-semibold text-slate-950">Decision history</h2>
      <ol className="mt-3 divide-y divide-slate-200 border-y border-slate-200">
        {events.map((event) => (
          <li key={event.id} className="py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Badge variant={event.type === 'Approval' ? 'success' : 'info'}>{event.type}</Badge>
              <code className="text-xs text-slate-500">{event.id}</code>
            </div>
            <p className="mt-2 text-sm text-slate-700">{event.detail}</p>
            <div className="mt-1 text-xs text-slate-500">{event.actor} · {event.timestamp}</div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function DecisionMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-slate-200 px-4 py-3 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-1 text-xl font-semibold tabular-nums text-slate-950">{value}</dd>
    </div>
  );
}

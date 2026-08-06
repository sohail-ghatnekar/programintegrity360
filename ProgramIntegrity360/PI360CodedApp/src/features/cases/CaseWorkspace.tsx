import { Badge, Tabs, TabsContent, TabsList, TabsTrigger } from '@uipath/apollo-wind';
import { ActivityTimeline } from '../activity/ActivityTimeline';
import { CaseOverview } from './CaseOverview';
import { DecisionWorkspace } from './DecisionWorkspace';
import { EvidenceWorkspace } from './EvidenceWorkspace';
import { RoleWorkQueue } from './RoleWorkQueue';
import { StageJourney } from './StageJourney';
import type { CaseWorkspaceSnapshot, DemoRole } from './types';

type CaseWorkspaceProps = {
  workspace: CaseWorkspaceSnapshot;
  role: DemoRole;
};

export function CaseWorkspace({ workspace, role }: CaseWorkspaceProps) {
  const allTasks = [...workspace.caseTasks, ...workspace.folderTasks];
  const pendingEvidence = workspace.evidenceDocuments.filter((document) => document.status === 'Needs review').length;
  const flaggedClaims = workspace.claims.filter((claim) => claim.status === 'Flagged').length;
  const supervisorTasks = allTasks.filter((task) => task.gated && task.status !== 'Completed').length;
  const activeStageIndex = workspace.stages.findIndex((stage) => stage.status === 'active');

  return (
    <section aria-labelledby="case-workspace-heading" className="min-w-0">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 id="case-workspace-heading" className="text-xl font-semibold text-slate-950">Case workspace</h1>
          <p className="mt-1 max-w-4xl break-words text-sm font-medium text-slate-800">{workspace.case.title}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <code>{workspace.case.id}</code>
            <span>{workspace.case.program}</span>
            <span>Opened {workspace.case.opened}</span>
            <Badge variant={workspace.case.priority === 'High' ? 'error' : 'warning'}>{workspace.case.priority} priority</Badge>
          </div>
        </div>
        <div className="text-right text-xs text-slate-500">
          <div>Source updated</div>
          <time className="font-mono">{workspace.sourceUpdatedAt}</time>
        </div>
      </div>

      <StageJourney stages={workspace.stages} tasks={allTasks} />

      <section aria-labelledby="role-workbench-heading" className="mt-5 border-y border-slate-200 bg-slate-50 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="role-workbench-heading" className="text-sm font-semibold text-slate-950">
              {role === 'supervisor' ? 'Supervisor workbench' : 'Investigator work'}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {role === 'supervisor'
                ? 'Approval posture, exposure, escalation, and decision context.'
                : 'Evidence, reconciliation, provider response, and investigator workload.'}
            </p>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
            {role === 'supervisor' ? (
              <>
                <RoleMetric label="Approvals" value={String(supervisorTasks)} />
                <RoleMetric label="Period exposure" value={workspace.case.periodExposure} />
                <RoleMetric label="High signals" value={String(workspace.riskSignals.filter((signal) => signal.severity === 'High').length)} />
              </>
            ) : (
              <>
                <RoleMetric label="Evidence review" value={String(pendingEvidence)} />
                <RoleMetric label="Flagged claims" value={String(flaggedClaims)} />
                <RoleMetric label="Active route" value={activeStageIndex >= 0 ? `Stage ${activeStageIndex + 1}` : 'None'} />
              </>
            )}
          </div>
        </div>
        <RoleWorkQueue role={role} tasks={allTasks} />
      </section>

      <Tabs defaultValue="overview" className="mt-5 min-w-0">
        <TabsList aria-label="Case workspace sections" className="max-w-full overflow-x-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="evidence">Evidence</TabsTrigger>
          <TabsTrigger value="decisions">Decisions</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="mt-4"><CaseOverview workspace={workspace} role={role} /></TabsContent>
        <TabsContent value="evidence" className="mt-4"><EvidenceWorkspace workspace={workspace} /></TabsContent>
        <TabsContent value="decisions" className="mt-4"><DecisionWorkspace workspace={workspace} role={role} /></TabsContent>
        <TabsContent value="activity" className="mt-4"><ActivityTimeline events={workspace.executionTimeline} /></TabsContent>
      </Tabs>
    </section>
  );
}

function RoleMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-24">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-0.5 font-semibold tabular-nums text-slate-950">{value}</div>
    </div>
  );
}

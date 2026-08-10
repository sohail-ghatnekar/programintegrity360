import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { createDemoCaseWorkspace } from '../features/cases/demoCase';
import type { CaseWorkspaceSnapshot, DemoRole, StageStatus } from '../features/cases/types';
import type { CaseStartStatus } from '../features/cases/useCaseWorkspace';
import { AppShell } from './AppShell';
import { CaseWorkspace } from '../features/cases/CaseWorkspace';
import { StageJourney } from '../features/cases/StageJourney';

const workspace = createDemoCaseWorkspace();

afterEach(cleanup);

function ShellHarness({
  initialRole = 'investigator',
  onSelectCase = vi.fn(),
}: {
  initialRole?: DemoRole;
  onSelectCase?: (caseId: string) => void | Promise<void>;
}) {
  const [role, setRole] = useState<DemoRole>(initialRole);

  return (
    <AppShell
      cases={[workspace.case]}
      workspace={workspace}
      status="demo"
      warnings={[]}
      identity={{
        isAuthenticated: true,
        name: 'Authenticated UiPath user',
        email: null,
      }}
      role={role}
      onRoleChange={setRole}
      onSelectCase={onSelectCase}
      onRefresh={vi.fn()}
      onUseDemoData={vi.fn()}
    />
  );
}

const replacementWorkspace = {
  ...workspace,
  sourceId: 'demo-case-workspace:PI-PCS-2026-0099',
  case: {
    ...workspace.case,
    id: 'PI-PCS-2026-0099',
    title: 'Lakeside Personal Care - replacement review',
    sourceId: 'case:PI-PCS-2026-0099',
  },
} as CaseWorkspaceSnapshot;

const newestWorkspace = {
  ...workspace,
  sourceId: 'demo-case-workspace:PI-PCS-2026-0100',
  case: {
    ...workspace.case,
    id: 'PI-PCS-2026-0100',
    title: 'Northstar Personal Care - newest review',
    sourceId: 'case:PI-PCS-2026-0100',
  },
} as CaseWorkspaceSnapshot;

const demoRecoveryWorkspace = {
  ...workspace,
  sourceId: 'demo-case-workspace:PI-DEMO-2026-0001',
  case: {
    ...workspace.case,
    id: 'PI-DEMO-2026-0001',
    title: 'Demo recovery workspace',
    sourceId: 'case:PI-DEMO-2026-0001',
  },
} as CaseWorkspaceSnapshot;

const registeredWorkspace = {
  ...workspace,
  sourceId: 'data-fabric-workspace:PI-HSP-2026-NEW123',
  case: {
    ...workspace.case,
    id: 'PI-HSP-2026-NEW123',
    businessCaseId: 'PI-HSP-2026-NEW123',
    title: 'Jordan Ellis hospice overlap investigation',
    sourceId: 'data-fabric-case:PI-HSP-2026-NEW123',
  },
} as CaseWorkspaceSnapshot;

function RegisteredLaunchHarness() {
  const [cases, setCases] = useState([workspace.case]);
  const [currentWorkspace, setCurrentWorkspace] = useState<CaseWorkspaceSnapshot | null>(workspace);
  const [startStatus, setStartStatus] = useState<CaseStartStatus>('idle');
  const [startMessage, setStartMessage] = useState<string | null>(null);

  return (
    <AppShell
      cases={cases}
      workspace={currentWorkspace}
      status="live"
      warnings={[]}
      identity={{ isAuthenticated: true, name: 'Investigator', email: 'investigator@example.gov' }}
      role="investigator"
      onRoleChange={vi.fn()}
      onSelectCase={vi.fn()}
      onStartCase={async () => {
        setCases([registeredWorkspace.case]);
        setCurrentWorkspace(registeredWorkspace);
        setStartStatus('registered');
        setStartMessage(`Case ${registeredWorkspace.case.id} is ready.`);
        return {
          status: 'registered',
          caseId: registeredWorkspace.case.id,
          jobKey: 'job-registered',
        };
      }}
      caseStartStatus={startStatus}
      caseStartMessage={startMessage}
      onRefresh={vi.fn()}
      onUseDemoData={vi.fn()}
    />
  );
}

const pendingCaseId = 'PI-HSP-2026-PEND123';
const pendingMessage = `Process started; workspace registration is pending for ${pendingCaseId}.`;

function PendingLaunchHarness() {
  const [startStatus, setStartStatus] = useState<CaseStartStatus>('idle');
  const [startMessage, setStartMessage] = useState<string | null>(null);

  return (
    <AppShell
      cases={[workspace.case]}
      workspace={workspace}
      status="live"
      warnings={[]}
      identity={{ isAuthenticated: true, name: 'Investigator', email: 'investigator@example.gov' }}
      role="investigator"
      onRoleChange={vi.fn()}
      onSelectCase={vi.fn()}
      onStartCase={async () => {
        setStartStatus('pending');
        setStartMessage(pendingMessage);
        return { status: 'pending', caseId: pendingCaseId, jobKey: 'job-pending' };
      }}
      caseStartStatus={startStatus}
      caseStartMessage={startMessage}
      onRefresh={vi.fn()}
      onUseDemoData={vi.fn()}
    />
  );
}

const emptyWorkspace = {
  ...workspace,
  claims: [],
  evidenceDocuments: [],
  executionTimeline: [],
  caseTasks: [],
  folderTasks: [],
} as CaseWorkspaceSnapshot;

const misleadingInvestigatorApp = {
  ...workspace.caseTasks[0],
  id: 1901,
  title: 'Investigator App task with stale gate metadata',
  gated: true,
  stageLabel: 'Investigation and case management',
  sourceId: 'action-center-task:1901',
};

const unrelatedFolderGate = {
  ...workspace.caseTasks[1],
  id: 2901,
  title: 'Folder-wide supervisor approval for another case',
  sourceId: 'action-center-task:2901',
};

const taskSafetyWorkspace = {
  ...workspace,
  caseTasks: [misleadingInvestigatorApp, ...workspace.caseTasks],
  folderTasks: [...workspace.folderTasks, unrelatedFolderGate],
} as CaseWorkspaceSnapshot;

function DelayedSelectionHarness({ selection }: { selection: Promise<void> }) {
  const [selectedWorkspace, setSelectedWorkspace] = useState<CaseWorkspaceSnapshot>(workspace);

  const selectCase = async (caseId: string) => {
    await selection;
    if (caseId === replacementWorkspace.case.id) {
      setSelectedWorkspace(replacementWorkspace);
    }
  };

  return (
    <AppShell
      cases={[workspace.case, replacementWorkspace.case]}
      workspace={selectedWorkspace}
      status="demo"
      warnings={[]}
      identity={{ isAuthenticated: true, name: 'Authenticated UiPath user', email: null }}
      role="investigator"
      onRoleChange={vi.fn()}
      onSelectCase={selectCase}
      onRefresh={vi.fn()}
      onUseDemoData={vi.fn()}
    />
  );
}

function SelectionRecoveryHarness({
  retry,
  demoReplacement,
}: {
  retry: Promise<void>;
  demoReplacement: Promise<void>;
}) {
  const [selectedWorkspace, setSelectedWorkspace] = useState<CaseWorkspaceSnapshot>(workspace);
  const [status, setStatus] = useState<'loading' | 'live' | 'demo'>('live');

  return (
    <AppShell
      cases={[workspace.case, replacementWorkspace.case]}
      workspace={selectedWorkspace}
      status={status}
      warnings={['Live case source returned a partial warning.']}
      identity={{ isAuthenticated: true, name: 'Authenticated UiPath user', email: null }}
      role="investigator"
      onRoleChange={vi.fn()}
      onSelectCase={async () => {
        throw new Error('Selection failed');
      }}
      onRefresh={async () => {
        setStatus('loading');
        await retry;
        setSelectedWorkspace(workspace);
        setStatus('live');
      }}
      onUseDemoData={async () => {
        setStatus('loading');
        await demoReplacement;
        setSelectedWorkspace(demoRecoveryWorkspace);
        setStatus('demo');
      }}
    />
  );
}

function OverlappingSelectionHarness({
  olderSelection,
  newerSelection,
}: {
  olderSelection: Promise<void>;
  newerSelection: Promise<void>;
}) {
  const [selectedWorkspace, setSelectedWorkspace] = useState<CaseWorkspaceSnapshot>(workspace);

  const selectCase = async (caseId: string) => {
    const selection = caseId === replacementWorkspace.case.id ? olderSelection : newerSelection;
    await selection;
    setSelectedWorkspace(caseId === replacementWorkspace.case.id ? replacementWorkspace : newestWorkspace);
  };

  return (
    <AppShell
      cases={[workspace.case, replacementWorkspace.case, newestWorkspace.case]}
      workspace={selectedWorkspace}
      status="demo"
      warnings={[]}
      identity={{ isAuthenticated: true, name: 'Authenticated UiPath user', email: null }}
      role="investigator"
      onRoleChange={vi.fn()}
      onSelectCase={selectCase}
      onRefresh={vi.fn()}
      onUseDemoData={vi.fn()}
    />
  );
}

describe('AppShell', () => {
  test('shows signed-in identity, demo provenance, labeled navigation, and the authority boundary', () => {
    render(<ShellHarness />);

    expect(screen.getByText('Authenticated UiPath user')).toBeInTheDocument();
    expect(screen.getByText('Demo data')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Primary navigation' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Command center' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Case workspace' })).toBeInTheDocument();
    expect(screen.getByText(/UiPath permissions remain authoritative/i)).toBeInTheDocument();
  });

  test('opens the selected case and preserves command-center navigation', async () => {
    const user = userEvent.setup();
    const onSelectCase = vi.fn();
    render(<ShellHarness onSelectCase={onSelectCase} />);

    expect(screen.getByRole('heading', { name: 'Command center' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: `Open case ${workspace.case.id}` }));

    expect(onSelectCase).toHaveBeenCalledWith(workspace.case.id);
    expect(screen.getByRole('heading', { name: 'Case workspace' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Command center' }));
    expect(screen.getByRole('heading', { name: 'Command center' })).toBeInTheDocument();
  });

  test('does not render the previous workspace while a different case selection is pending', async () => {
    const user = userEvent.setup();
    let resolveSelection!: () => void;
    const selection = new Promise<void>((resolve) => {
      resolveSelection = resolve;
    });
    render(<DelayedSelectionHarness selection={selection} />);

    await user.click(screen.getByRole('button', { name: `Open case ${replacementWorkspace.case.id}` }));

    expect(screen.getByRole('status', { name: `Loading case ${replacementWorkspace.case.id}` })).toBeInTheDocument();
    expect(screen.queryByText(workspace.case.title)).not.toBeInTheDocument();
    expect(screen.queryByText(replacementWorkspace.case.title)).not.toBeInTheDocument();

    await act(async () => resolveSelection());

    expect(await screen.findByText(replacementWorkspace.case.title)).toBeInTheDocument();
    expect(screen.queryByRole('status', { name: `Loading case ${replacementWorkspace.case.id}` })).not.toBeInTheDocument();
  });

  test('keeps a selection error exclusive and recovers through terminal retry', async () => {
    const user = userEvent.setup();
    let resolveRetry!: () => void;
    const retry = new Promise<void>((resolve) => {
      resolveRetry = resolve;
    });
    render(<SelectionRecoveryHarness retry={retry} demoReplacement={Promise.resolve()} />);

    await user.click(screen.getByRole('button', { name: `Open case ${replacementWorkspace.case.id}` }));

    expect(await screen.findByRole('heading', { name: 'Case data unavailable' })).toBeInTheDocument();
    expect(screen.getByText(`Unable to open case ${replacementWorkspace.case.id}.`)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Data source notice' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(screen.getByRole('status', { name: 'Refreshing case data' })).toBeInTheDocument();
    expect(screen.queryByText(workspace.case.title)).not.toBeInTheDocument();

    await act(async () => resolveRetry());

    expect(await screen.findByText(workspace.case.title)).toBeInTheDocument();
    expect(screen.queryByText('Selected case unavailable')).not.toBeInTheDocument();
  });

  test('clears failed live selection intent when demo data replaces the workspace', async () => {
    const user = userEvent.setup();
    let resolveDemo!: () => void;
    const demoReplacement = new Promise<void>((resolve) => {
      resolveDemo = resolve;
    });
    render(<SelectionRecoveryHarness retry={Promise.resolve()} demoReplacement={demoReplacement} />);

    await user.click(screen.getByRole('button', { name: `Open case ${replacementWorkspace.case.id}` }));
    expect(await screen.findByRole('heading', { name: 'Case data unavailable' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Use demo data' }));
    expect(screen.getByRole('status', { name: 'Loading demo case data' })).toBeInTheDocument();

    await act(async () => resolveDemo());

    expect(await screen.findByText(demoRecoveryWorkspace.case.title)).toBeInTheDocument();
    expect(screen.queryByText('Selected case unavailable')).not.toBeInTheDocument();
  });

  test('keeps the newest case when overlapping selections resolve in reverse order', async () => {
    const user = userEvent.setup();
    let resolveOlder!: () => void;
    let resolveNewer!: () => void;
    const olderSelection = new Promise<void>((resolve) => {
      resolveOlder = resolve;
    });
    const newerSelection = new Promise<void>((resolve) => {
      resolveNewer = resolve;
    });
    render(<OverlappingSelectionHarness olderSelection={olderSelection} newerSelection={newerSelection} />);

    await user.click(screen.getByRole('button', { name: `Open case ${replacementWorkspace.case.id}` }));
    await user.click(screen.getByRole('button', { name: 'Command center' }));
    await user.click(screen.getByRole('button', { name: `Open case ${newestWorkspace.case.id}` }));

    expect(screen.getByRole('status', { name: `Loading case ${newestWorkspace.case.id}` })).toBeInTheDocument();
    await act(async () => resolveNewer());
    expect(await screen.findByText(newestWorkspace.case.title)).toBeInTheDocument();

    await act(async () => resolveOlder());
    expect(screen.getByText(newestWorkspace.case.title)).toBeInTheDocument();
    expect(screen.queryByText(replacementWorkspace.case.title)).not.toBeInTheDocument();
    expect(screen.queryByText('Selected case unavailable')).not.toBeInTheDocument();
  });

  test('renders loading, terminal error, and stable empty command states exclusively', () => {
    const commonProps = {
      cases: [],
      workspace: null,
      warnings: [] as readonly string[],
      identity: { isAuthenticated: false, name: 'Demo session', email: null },
      role: 'investigator' as const,
      onRoleChange: vi.fn(),
      onSelectCase: vi.fn(),
      onRefresh: vi.fn(),
      onUseDemoData: vi.fn(),
    };
    const { rerender } = render(<AppShell {...commonProps} status="loading" />);

    expect(screen.getByRole('status', { name: 'Loading command center' })).toBeInTheDocument();
    expect(screen.queryByText('No cases available')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Case data unavailable' })).not.toBeInTheDocument();

    rerender(<AppShell {...commonProps} status="error" warnings={['UiPath case service failed.']} />);

    expect(screen.getByRole('heading', { name: 'Case data unavailable' })).toBeInTheDocument();
    expect(screen.queryByRole('status', { name: 'Loading command center' })).not.toBeInTheDocument();
    expect(screen.queryByText('No cases available')).not.toBeInTheDocument();

    rerender(<AppShell {...commonProps} status="demo" />);

    expect(screen.getByRole('heading', { name: 'Command center' })).toBeInTheDocument();
    expect(screen.getByText('No cases available.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start new case' })).toBeDisabled();
    expect(screen.queryByRole('status', { name: 'Loading command center' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Case data unavailable' })).not.toBeInTheDocument();
  });

  test('keeps an authenticated empty live command center available for case launch', () => {
    render(
      <AppShell
        cases={[]}
        workspace={null}
        status="live"
        warnings={[]}
        identity={{ isAuthenticated: true, name: 'Investigator', email: 'investigator@example.gov' }}
        role="investigator"
        onRoleChange={vi.fn()}
        onSelectCase={vi.fn()}
        onStartCase={vi.fn()}
        caseStartStatus="idle"
        caseStartMessage={null}
        onRefresh={vi.fn()}
        onUseDemoData={vi.fn()}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Command center' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start new case' })).toBeEnabled();
    expect(screen.getByText('No cases available.')).toBeInTheDocument();
  });

  test('opens the exact newly registered case workspace returned by the start flow', async () => {
    const user = userEvent.setup();
    render(<RegisteredLaunchHarness />);

    expect(screen.getByText(workspace.case.id)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Start new case' }));
    await user.click(screen.getByRole('button', { name: 'Start case' }));
    expect(await screen.findByRole('heading', { name: 'Case workspace' })).toBeInTheDocument();
    expect(screen.getByText(registeredWorkspace.case.id)).toBeInTheDocument();
    expect(screen.getByText(registeredWorkspace.case.title)).toBeInTheDocument();
    expect(screen.queryByText(workspace.case.id)).not.toBeInTheDocument();
  });

  test('transitions from idle to the exact pending message while staying on Command center', async () => {
    const user = userEvent.setup();
    render(<PendingLaunchHarness />);
    expect(screen.getByRole('heading', { name: 'Command center' })).toBeInTheDocument();
    expect(screen.queryByText(pendingMessage)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Start new case' }));
    await user.click(screen.getByRole('button', { name: 'Start case' }));

    expect(await screen.findByText(pendingMessage)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Command center', hidden: true })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Case workspace', hidden: true })).not.toBeInTheDocument();
  });

  test('renders a stable empty workspace separately from loading', async () => {
    const user = userEvent.setup();
    render(
      <AppShell
        cases={[]}
        workspace={null}
        status="demo"
        warnings={[]}
        identity={{ isAuthenticated: false, name: 'Demo session', email: null }}
        role="investigator"
        onRoleChange={vi.fn()}
        onSelectCase={vi.fn()}
        onRefresh={vi.fn()}
        onUseDemoData={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Case workspace' }));

    expect(screen.getByRole('status', { name: 'No case selected' })).toBeInTheDocument();
    expect(screen.queryByRole('status', { name: 'Loading case workspace' })).not.toBeInTheDocument();
  });

  test('exposes identity and labeled navigation in the mobile sheet', async () => {
    const user = userEvent.setup();
    render(<ShellHarness />);

    await user.click(screen.getByRole('button', { name: 'Open navigation' }));
    const sheet = screen.getByRole('dialog');

    expect(within(sheet).getByText('Authenticated UiPath user')).toBeInTheDocument();
    expect(within(sheet).getByRole('navigation', { name: 'Mobile navigation' })).toBeInTheDocument();
    expect(within(sheet).getByText(/UiPath permissions remain authoritative/i)).toBeInTheDocument();
  });

  test('uses compact, shrink-safe header controls and keeps refresh available on mobile', async () => {
    const user = userEvent.setup();
    const commonProps = {
      cases: [],
      workspace: null,
      warnings: [] as readonly string[],
      identity: { isAuthenticated: true, name: 'Authenticated UiPath user', email: null },
      role: 'investigator' as const,
      onRoleChange: vi.fn(),
      onSelectCase: vi.fn(),
      onRefresh: vi.fn(),
      onUseDemoData: vi.fn(),
    };
    const { rerender } = render(<AppShell {...commonProps} status="loading" />);
    const header = screen.getByRole('banner');
    const headerRow = screen.getByTestId('app-header-row');

    expect(headerRow).toHaveClass('min-w-0', 'max-w-full');
    const loadingBadge = within(header).getByLabelText('Loading data');
    expect(within(loadingBadge).getByText('Loading')).toHaveClass('sm:hidden');
    expect(within(loadingBadge).getByText('Loading data')).toHaveClass('hidden', 'sm:inline');
    expect(within(header).getByRole('button', { name: 'Refresh case data' })).toHaveClass(
      'hidden',
      'min-[400px]:inline-flex',
    );

    await user.click(within(header).getByRole('button', { name: 'Open navigation' }));
    const sheet = screen.getByRole('dialog');
    expect(within(sheet).getByRole('button', { name: 'Refresh case data' })).toBeVisible();
    await user.click(within(sheet).getByRole('button', { name: 'Close' }));

    rerender(<AppShell {...commonProps} status="error" warnings={['UiPath case service failed.']} />);
    const errorBadge = within(screen.getByRole('banner')).getByLabelText('Data unavailable');
    expect(within(errorBadge).getByText('Error')).toHaveClass('sm:hidden');
  });

  test('renders the exact canonical six-stage journey', async () => {
    const user = userEvent.setup();
    render(<ShellHarness />);

    await user.click(screen.getByRole('button', { name: 'Case workspace' }));
    const journey = screen.getByRole('list', { name: 'Case stages' });
    const stages = within(journey).getAllByTestId('case-stage');

    expect(stages).toHaveLength(6);
    expect(stages.map((stage) => within(stage).getByRole('heading').textContent)).toEqual([
      'Alert intake and triage',
      'Evidence acquisition and validation',
      'Investigation and case management',
      'Provider response',
      'Supervisor review and approval',
      'Closure and monitoring',
    ]);
  });

  test('distinguishes every stage state with visible text', () => {
    const statuses: StageStatus[] = [
      'completed',
      'active',
      'waiting',
      'faulted',
      'not-started',
      'not-started',
    ];
    const stages = workspace.stages.map((stage, index) => ({
      ...stage,
      status: statuses[index],
    }));

    render(<StageJourney stages={stages} tasks={workspace.caseTasks} />);

    expect(screen.getByText('Completed')).toBeInTheDocument();
    expect(screen.getByText('Active route')).toBeInTheDocument();
    expect(screen.getByText('Waiting')).toBeInTheDocument();
    expect(screen.getByText('Faulted')).toBeInTheDocument();
    expect(screen.getAllByText('Not started')).toHaveLength(2);
  });

  test('keeps lifecycle completion separate from linked task progress', () => {
    const completedStage = {
      ...workspace.stages[0],
      status: 'completed' as const,
    };
    const pendingTask = {
      ...workspace.caseTasks[0],
      stageLabel: completedStage.label,
      status: 'Pending' as const,
    };

    render(<StageJourney stages={[completedStage]} tasks={[pendingTask]} />);

    expect(screen.getByText('Completed')).toBeInTheDocument();
    expect(screen.getByText('0/1 tasks complete')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: `${completedStage.label} task progress` })).toHaveAttribute(
      'aria-valuetext',
      '0 of 1 tasks complete',
    );
    expect(screen.getByRole('progressbar', { name: `${completedStage.label} task progress` })).toHaveAttribute(
      'aria-valuenow',
      '0',
    );
  });

  test('renders explicit accessible empty states across workspace sections', async () => {
    const user = userEvent.setup();
    render(<CaseWorkspace workspace={emptyWorkspace} role="investigator" />);

    expect(screen.getByRole('status', { name: 'No claims available' })).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Evidence' }));
    expect(screen.getByRole('status', { name: 'No evidence documents' })).toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'No reconciliation exceptions' })).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Decisions' }));
    expect(screen.getByRole('status', { name: 'No decision history' })).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Activity' }));
    expect(screen.getByRole('status', { name: 'No activity recorded' })).toBeInTheDocument();
  });

  test('changes presentation by role and hides supervisor dispositions from investigators', async () => {
    const user = userEvent.setup();
    render(<ShellHarness />);

    await user.click(screen.getByRole('button', { name: 'Case workspace' }));
    await user.click(screen.getByRole('tab', { name: 'Decisions' }));

    expect(screen.getByRole('heading', { name: 'Investigator work' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Supervisor dispositions' })).not.toBeInTheDocument();
    expect(screen.queryByText('Refer for audit')).not.toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: 'Supervisor' }));

    expect(screen.getByRole('heading', { name: 'Supervisor workbench' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Supervisor dispositions' })).toBeInTheDocument();
    expect(screen.getByText('Refer for audit')).toBeInTheDocument();
    expect(screen.getByText('Open recovery')).toBeInTheDocument();
  });

  test('exposes compact role-relevant work records and binds dispositions to a supervisor task', async () => {
    const user = userEvent.setup();
    render(<ShellHarness />);

    await user.click(screen.getByRole('button', { name: 'Case workspace' }));
    const investigatorQueue = screen.getByRole('region', { name: 'Investigator work queue' });

    expect(within(investigatorQueue).getByText('Investigator review - reconciliation and narrative')).toBeInTheDocument();
    expect(within(investigatorQueue).queryByText('Validate low-confidence extraction - DOC-SN-0414')).not.toBeInTheDocument();
    expect(within(investigatorQueue).getAllByText('Pending')).toHaveLength(1);
    expect(within(investigatorQueue).queryByText('Supervisor approval - refer for audit and recovery')).not.toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: 'Supervisor' }));
    const supervisorQueue = screen.getByRole('region', { name: 'Supervisor work queue' });

    expect(within(supervisorQueue).getByText('Supervisor approval - refer for audit and recovery')).toBeInTheDocument();
    expect(within(supervisorQueue).getByText('Unassigned')).toBeInTheDocument();
    expect(within(supervisorQueue).getByText('Stage: Supervisor review and approval')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Decisions' }));
    const dispositions = screen.getByRole('region', { name: 'Supervisor dispositions' });
    expect(within(dispositions).getByText('Supervisor task 1003')).toBeInTheDocument();
    expect(within(dispositions).getByText('Supervisor approval - refer for audit and recovery')).toBeInTheDocument();
    expect(within(dispositions).getByText('Refer for audit')).toBeInTheDocument();
  });

  test('uses only qualifying case tasks for current-case queues, progress, and supervisor disposition', async () => {
    const user = userEvent.setup();
    render(<CaseWorkspace workspace={taskSafetyWorkspace} role="supervisor" />);

    const workbench = screen.getByRole('region', { name: 'Supervisor workbench' });
    expect(within(workbench).getByText('Approvals').nextElementSibling).toHaveTextContent('1');

    const supervisorQueue = screen.getByRole('region', { name: 'Supervisor work queue' });
    expect(within(supervisorQueue).getByText('Supervisor approval - refer for audit and recovery')).toBeInTheDocument();
    expect(within(supervisorQueue).queryByText(misleadingInvestigatorApp.title)).not.toBeInTheDocument();
    expect(within(supervisorQueue).queryByText(unrelatedFolderGate.title)).not.toBeInTheDocument();

    const supervisorStage = within(screen.getByRole('list', { name: 'Case stages' }))
      .getAllByTestId('case-stage')
      .find((stage) => within(stage).queryByRole('heading', { name: 'Supervisor review and approval' }));
    expect(supervisorStage).toBeDefined();
    expect(within(supervisorStage!).getByText('0/1 tasks complete')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Decisions' }));
    const dispositions = screen.getByRole('region', { name: 'Supervisor dispositions' });
    expect(within(dispositions).getByText('Supervisor task 1003')).toBeInTheDocument();
    expect(within(dispositions).queryByText(misleadingInvestigatorApp.title)).not.toBeInTheDocument();
    expect(within(dispositions).queryByText(unrelatedFolderGate.title)).not.toBeInTheDocument();
  });

  test('does not present supervisor dispositions without a gated task record', async () => {
    const user = userEvent.setup();
    render(<CaseWorkspace workspace={emptyWorkspace} role="supervisor" />);

    expect(screen.getByRole('status', { name: 'No supervisor work records' })).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Decisions' }));

    expect(screen.getByRole('status', { name: 'No supervisor disposition task' })).toBeInTheDocument();
    expect(screen.queryByText('Refer for audit')).not.toBeInTheDocument();
    expect(screen.queryByText('Open recovery')).not.toBeInTheDocument();
  });
});

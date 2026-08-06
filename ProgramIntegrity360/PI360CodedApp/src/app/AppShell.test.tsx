import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { createDemoCaseWorkspace } from '../features/cases/demoCase';
import type { CaseWorkspaceSnapshot, DemoRole, StageStatus } from '../features/cases/types';
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

const emptyWorkspace = {
  ...workspace,
  claims: [],
  evidenceDocuments: [],
  executionTimeline: [],
  caseTasks: [],
  folderTasks: [],
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

    expect(screen.getByRole('status', { name: 'No cases available' })).toBeInTheDocument();
    expect(screen.queryByRole('status', { name: 'Loading command center' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Case data unavailable' })).not.toBeInTheDocument();
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
    expect(within(investigatorQueue).getByText('Validate low-confidence extraction - DOC-SN-0414')).toBeInTheDocument();
    expect(within(investigatorQueue).getAllByText('Pending')).toHaveLength(2);
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

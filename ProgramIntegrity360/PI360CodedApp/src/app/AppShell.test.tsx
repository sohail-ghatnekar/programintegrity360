import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { createDemoCaseWorkspace } from '../features/cases/demoCase';
import type { DemoRole, StageStatus } from '../features/cases/types';
import { AppShell } from './AppShell';
import { StageJourney } from '../features/cases/StageJourney';

const workspace = createDemoCaseWorkspace();

afterEach(cleanup);

function ShellHarness({
  initialRole = 'investigator',
  onSelectCase = vi.fn(),
}: {
  initialRole?: DemoRole;
  onSelectCase?: (caseId: string) => void;
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

  test('exposes identity and labeled navigation in the mobile sheet', async () => {
    const user = userEvent.setup();
    render(<ShellHarness />);

    await user.click(screen.getByRole('button', { name: 'Open navigation' }));
    const sheet = screen.getByRole('dialog');

    expect(within(sheet).getByText('Authenticated UiPath user')).toBeInTheDocument();
    expect(within(sheet).getByRole('navigation', { name: 'Mobile navigation' })).toBeInTheDocument();
    expect(within(sheet).getByText(/UiPath permissions remain authoritative/i)).toBeInTheDocument();
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
});

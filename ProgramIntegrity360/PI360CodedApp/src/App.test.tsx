import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

const authState = vi.hoisted(() => ({
  current: {
    isAuthenticated: false,
    isLoading: false,
    currentUserName: null as string | null,
    currentUserEmail: null as string | null,
    sdk: {},
    login: vi.fn(),
    logout: vi.fn(),
    error: null as string | null,
  },
}));

const taskSdk = vi.hoisted(() => ({
  getById: vi.fn(),
}));

vi.mock('./hooks/useAuth', () => ({
  AuthProvider: ({ children }: { children: ReactNode }) => children,
  useAuth: () => authState.current,
  useOptionalAuth: () => undefined,
}));

vi.mock('@uipath/uipath-typescript/tasks', () => ({
  Tasks: class Tasks {
    getById = taskSdk.getById;
  },
}));

vi.mock('./features/cases/useCaseWorkspace', () => ({
  useCaseWorkspace: vi.fn(),
}));

import App from './App';
import { createDemoCaseWorkspace } from './features/cases/demoCase';
import { useCaseWorkspace } from './features/cases/useCaseWorkspace';

beforeEach(() => {
  authState.current = {
    isAuthenticated: false,
    isLoading: false,
    currentUserName: null,
    currentUserEmail: null,
    sdk: {},
    login: vi.fn(),
    logout: vi.fn(),
    error: null,
  };
  taskSdk.getById.mockReset();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

test('renders exact canonical stages and Demo data provenance', async () => {
  const workspace = createDemoCaseWorkspace();
  vi.mocked(useCaseWorkspace).mockReturnValue({
    cases: [workspace.case],
    workspace,
    status: 'demo',
    warnings: [],
    refresh: vi.fn(),
    useDemoData: vi.fn(),
    selectCase: vi.fn(),
  });

  const user = userEvent.setup();
  render(<App />);

  expect(screen.getByText('Demo data')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Case workspace' }));
  expect(screen.getByText('Alert intake and triage')).toBeInTheDocument();
  expect(screen.getByText('Evidence acquisition and validation')).toBeInTheDocument();
  expect(screen.getByText('Investigation and case management')).toBeInTheDocument();
  expect(screen.getByText('Provider response')).toBeInTheDocument();
  expect(screen.getByText('Supervisor review and approval')).toBeInTheDocument();
  expect(screen.getByText('Closure and monitoring')).toBeInTheDocument();
});

test('integrates the real Task Center and its only Action Center iframe into shell navigation', async () => {
  const workspace = createDemoCaseWorkspace();
  vi.mocked(useCaseWorkspace).mockReturnValue({
    cases: [workspace.case],
    workspace,
    status: 'demo',
    warnings: [],
    refresh: vi.fn(),
    useDemoData: vi.fn(),
    selectCase: vi.fn(),
  });

  const user = userEvent.setup();
  render(<App />);

  await user.click(screen.getByRole('button', { name: 'Task Center' }));
  expect(screen.getByRole('heading', { name: 'Task Center' })).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: `Open task ${workspace.caseTasks[0].id}` }));
  expect(screen.getAllByTitle(`Action Center task ${workspace.caseTasks[0].id}`)).toHaveLength(1);
  expect(screen.getByText(/Live task polling is unavailable/i)).toBeInTheDocument();
});

test('keeps the demo assistant next task as a non-completable preview', async () => {
  const workspace = createDemoCaseWorkspace();
  vi.mocked(useCaseWorkspace).mockReturnValue({
    cases: [workspace.case],
    workspace,
    status: 'demo',
    warnings: [],
    refresh: vi.fn(),
    useDemoData: vi.fn(),
    selectCase: vi.fn(),
  });

  const user = userEvent.setup();
  render(<App />);

  await user.click(screen.getByRole('button', { name: 'Open record assistant' }));
  await user.click(screen.getByRole('button', { name: 'What is my next task?' }));
  await user.click(screen.getByRole('button', { name: 'Send message' }));

  expect(screen.getByText('Demo task preview')).toBeInTheDocument();
  expect(screen.getAllByText(/non-completable demo preview/i)).not.toHaveLength(0);
  expect(screen.queryByTitle(`Action Center task ${workspace.caseTasks[0].id}`)).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /complete task/i })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: `Open task ${workspace.caseTasks[0].id} in Action Center` })).not.toBeInTheDocument();
});

test('retains task status observations across refreshes and resets them for a different case', async () => {
  const firstWorkspace = createDemoCaseWorkspace();
  let workspace = firstWorkspace;
  vi.mocked(useCaseWorkspace).mockImplementation(() => ({
    cases: [workspace.case],
    workspace,
    status: 'demo',
    warnings: [],
    refresh: vi.fn(),
    useDemoData: vi.fn(),
    selectCase: vi.fn(),
  }));

  const user = userEvent.setup();
  const view = render(<App />);
  await user.click(screen.getByRole('button', { name: 'Case workspace' }));
  await user.click(screen.getByRole('tab', { name: 'Activity' }));
  expect(await screen.findByText(/Task 1002.+is Pending/)).toBeInTheDocument();

  workspace = {
    ...firstWorkspace,
    caseTasks: firstWorkspace.caseTasks.map((task) => (
      task.id === 1002
        ? { ...task, status: 'Completed' as const, sourceUpdatedAt: '2026-08-06T16:00:00Z' }
        : task
    )),
  };
  view.rerender(<App />);

  expect(await screen.findByText(/Task 1002.+is Pending/)).toBeInTheDocument();
  expect(await screen.findByText(/Task 1002.+is Completed/)).toBeInTheDocument();

  workspace = {
    ...firstWorkspace,
    sourceId: 'demo-case-workspace:CASE-2',
    case: { ...firstWorkspace.case, id: 'CASE-2', sourceId: 'case:CASE-2' },
    caseTasks: [{ ...firstWorkspace.caseTasks[0], id: 2001, sourceId: 'task:2001' }],
  };
  view.rerender(<App />);

  await waitFor(() => {
    expect(screen.queryByText(/Task 1002/)).not.toBeInTheDocument();
    expect(screen.getByText(/Task 2001.+is Pending/)).toBeInTheDocument();
  });
});

test('refreshes case tasks, stages, and timeline once after Tasks API confirms completion', async () => {
  vi.useFakeTimers();
  const workspace = createDemoCaseWorkspace();
  const refresh = vi.fn().mockResolvedValue({ ok: true as const });
  authState.current = {
    ...authState.current,
    isAuthenticated: true,
    currentUserName: 'Authenticated UiPath user',
  };
  taskSdk.getById.mockResolvedValue({ status: 'Completed' });
  vi.mocked(useCaseWorkspace).mockReturnValue({
    cases: [workspace.case],
    workspace,
    status: 'live',
    warnings: [],
    refresh,
    useDemoData: vi.fn(),
    selectCase: vi.fn(),
  });

  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: 'Task Center' }));
  fireEvent.click(screen.getByRole('button', { name: `Open task ${workspace.caseTasks[0].id}` }));

  await act(() => vi.advanceTimersByTimeAsync(3000));

  expect(taskSdk.getById).toHaveBeenCalledWith(workspace.caseTasks[0].id, undefined, workspace.caseTasks[0].folderId);
  expect(refresh).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('status', { name: 'Task completed' })).toBeInTheDocument();
  await act(() => vi.advanceTimersByTimeAsync(30_000));
  expect(refresh).toHaveBeenCalledTimes(1);
});

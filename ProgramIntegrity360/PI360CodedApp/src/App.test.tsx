import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
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

test('refreshes case tasks, stages, and timeline once after Tasks API confirms completion', async () => {
  vi.useFakeTimers();
  const workspace = createDemoCaseWorkspace();
  const refresh = vi.fn().mockResolvedValue(undefined);
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

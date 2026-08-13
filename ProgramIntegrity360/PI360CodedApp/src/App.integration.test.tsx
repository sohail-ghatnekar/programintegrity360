import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

const authState = vi.hoisted(() => ({
  current: {
    isAuthenticated: true,
    isLoading: false,
    currentUserName: 'Authenticated UiPath user' as string | null,
    currentUserEmail: 'investigator@example.com' as string | null,
    sdk: {},
    login: vi.fn(),
    logout: vi.fn(),
    error: null as string | null,
  },
}));

const repository = vi.hoisted(() => ({
  listCases: vi.fn(),
  loadWorkspace: vi.fn(),
  refreshTasks: vi.fn(),
}));

const taskSdk = vi.hoisted(() => ({
  getById: vi.fn(),
}));

vi.mock('./hooks/useAuth', () => ({
  AuthProvider: ({ children }: { children: ReactNode }) => children,
  useAuth: () => authState.current,
  useOptionalAuth: () => authState.current,
}));

vi.mock('./services/uipath/liveCaseRepository', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./services/uipath/liveCaseRepository')>();

  return {
    ...actual,
    LiveCaseRepository: class LiveCaseRepository {
      listCases = repository.listCases;
      loadWorkspace = repository.loadWorkspace;
      refreshTasks = repository.refreshTasks;
    },
  };
});

vi.mock('@uipath/uipath-typescript/tasks', () => ({
  Tasks: class Tasks {
    getById = taskSdk.getById;
  },
}));

import App from './App';
import { createDemoCaseWorkspace } from './features/cases/demoCase';

beforeEach(() => {
  repository.listCases.mockReset();
  repository.loadWorkspace.mockReset();
  repository.refreshTasks.mockReset();
  taskSdk.getById.mockReset();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

test('keeps completion confirmed and exposes retry when the real workspace refresh contract fails', async () => {
  const demoWorkspace = createDemoCaseWorkspace();
  const liveWorkspace = { ...demoWorkspace, dataSource: 'live' as const };
  const task = liveWorkspace.caseTasks[0];
  repository.listCases
    .mockResolvedValueOnce([liveWorkspace.case])
    .mockRejectedValueOnce(new Error('Case workspace reload unavailable'))
    .mockResolvedValueOnce([liveWorkspace.case]);
  repository.loadWorkspace.mockResolvedValue(liveWorkspace);
  taskSdk.getById.mockResolvedValue({ status: 'Completed' });

  render(<App />);
  expect(await screen.findByText('Live UiPath')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Start new case' }));
  expect(screen.getByRole('dialog', { name: 'Start new case' })).toBeInTheDocument();
  expect(screen.getByRole('textbox', { name: 'Requester email' })).toHaveValue('investigator@example.com');
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

  vi.useFakeTimers();
  fireEvent.click(screen.getByRole('button', { name: 'Task Center' }));
  fireEvent.click(screen.getByRole('button', { name: `Open task ${task.id}` }));
  await act(() => vi.advanceTimersByTimeAsync(3000));

  expect(screen.getByRole('status', { name: 'Task completed' })).toBeInTheDocument();
  expect(screen.getByText(/Task completion is confirmed, but the workspace refresh failed/)).toHaveTextContent(
    'Case workspace reload unavailable',
  );
  expect(repository.listCases).toHaveBeenCalledTimes(2);

  fireEvent.click(screen.getByRole('button', { name: 'Retry workspace refresh' }));
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });

  expect(screen.getByText('Workspace refreshed.')).toBeInTheDocument();
  expect(screen.getByRole('status', { name: 'Task completed' })).toBeInTheDocument();
  expect(repository.listCases).toHaveBeenCalledTimes(3);

  await act(() => vi.advanceTimersByTimeAsync(30_000));
  expect(taskSdk.getById).toHaveBeenCalledTimes(1);
  expect(repository.listCases).toHaveBeenCalledTimes(3);
});

test('renders an authenticated empty live queue through the real workspace hook', async () => {
  repository.listCases.mockResolvedValue([]);

  render(<App />);

  expect(await screen.findByText('Live UiPath')).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Command center' })).toBeInTheDocument();
  expect(screen.getByText('No cases available.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Start new case' })).toBeEnabled();
  expect(repository.loadWorkspace).not.toHaveBeenCalled();
});

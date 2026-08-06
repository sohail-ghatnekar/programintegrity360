import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, expect, test, vi } from 'vitest';

vi.mock('./hooks/useAuth', () => ({
  AuthProvider: ({ children }: { children: ReactNode }) => children,
  useAuth: () => ({
    isAuthenticated: false,
    isLoading: false,
    currentUserName: null,
    currentUserEmail: null,
    login: vi.fn(),
    logout: vi.fn(),
    error: null,
  }),
  useOptionalAuth: () => undefined,
}));

vi.mock('./features/cases/useCaseWorkspace', () => ({
  useCaseWorkspace: vi.fn(),
}));

import App from './App';
import { createDemoCaseWorkspace } from './features/cases/demoCase';
import { useCaseWorkspace } from './features/cases/useCaseWorkspace';

afterEach(cleanup);

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

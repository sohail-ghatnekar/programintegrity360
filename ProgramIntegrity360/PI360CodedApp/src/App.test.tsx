import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { expect, test, vi } from 'vitest';

vi.mock('./hooks/useAuth', () => ({
  AuthProvider: ({ children }: { children: ReactNode }) => children,
}));

vi.mock('./components/RecordAssistantPanel', () => ({
  RecordAssistantPanel: () => null,
}));

import App from './App';

test('renders exact canonical stages and Demo data provenance', () => {
  render(<App />);

  expect(screen.getByText('Demo data')).toBeInTheDocument();
  expect(screen.getByText('Alert intake and triage')).toBeInTheDocument();
  expect(screen.getByText('Evidence acquisition and validation')).toBeInTheDocument();
  expect(screen.getByText('Investigation and case management')).toBeInTheDocument();
  expect(screen.getByText('Provider response')).toBeInTheDocument();
  expect(screen.getByText('Supervisor review and approval')).toBeInTheDocument();
  expect(screen.getByText('Closure and monitoring')).toBeInTheDocument();
});

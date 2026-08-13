import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, test, vi } from 'vitest';
import { createDemoCaseWorkspace } from './demoCase';
import type { CaseSummary } from './types';
import { CommandCenter } from './CommandCenter';

const template = createDemoCaseWorkspace().case;

function makeCase(index: number, updatedAt?: string): CaseSummary {
  const suffix = String(index).padStart(6, '0');
  const id = `PI-PCS-2026-${suffix}`;
  return {
    ...template,
    id,
    title: `Case ${suffix}`,
    sourceId: `case:${id}`,
    sourceUpdatedAt: updatedAt ?? new Date(Date.UTC(2026, 0, index)).toISOString(),
  };
}

function renderCenter(cases: readonly CaseSummary[], options: {
  selectedCaseId?: string;
  isAuthenticated?: boolean;
} = {}) {
  return render(
    <CommandCenter
      cases={cases}
      selectedCaseId={options.selectedCaseId}
      isAuthenticated={options.isAuthenticated ?? true}
      identityEmail="investigator@example.gov"
      caseStartStatus="idle"
      caseStartMessage={null}
      onStartCase={vi.fn()}
      onSelectCase={vi.fn()}
    />,
  );
}

afterEach(cleanup);

test('keeps an authenticated empty queue mounted with the orange launch action beside the total', () => {
  renderCenter([]);

  expect(screen.getByRole('heading', { name: 'Command center' })).toBeInTheDocument();
  const queue = screen.getByRole('region', { name: 'Case queue' });
  expect(within(queue).getByText('0 total')).toBeInTheDocument();
  expect(within(queue).getByRole('button', { name: 'Start new case' })).toHaveClass(
    'bg-orange-600',
    'text-white',
  );
  expect(within(queue).getByText('No cases available.')).toBeInTheDocument();
});

test('disables launch in demo mode and visibly explains how to enable it', () => {
  renderCenter([], { isAuthenticated: false });

  expect(screen.getByRole('button', { name: 'Start new case' })).toBeDisabled();
  expect(screen.getByText('Connect UiPath to start a case.')).toBeVisible();
});

test('sorts a copy newest-first with case ID as the tie-breaker', () => {
  const cases = [
    makeCase(1, '2026-01-01T00:00:00Z'),
    makeCase(2, '2026-01-03T00:00:00Z'),
    makeCase(3, '2026-01-03T00:00:00Z'),
  ];
  const originalOrder = cases.map((candidate) => candidate.id);
  renderCenter(cases);

  expect(screen.getAllByRole('button', { name: /Open case/ }).map((button) => button.getAttribute('aria-label'))).toEqual([
    `Open case ${cases[2].id}`,
    `Open case ${cases[1].id}`,
    `Open case ${cases[0].id}`,
  ]);
  expect(cases.map((candidate) => candidate.id)).toEqual(originalOrder);
});

test('paginates 23 newest-first cases in ten-row pages with correct ranges and boundaries', async () => {
  const user = userEvent.setup();
  const cases = Array.from({ length: 23 }, (_, index) => makeCase(index + 1));
  renderCenter(cases);

  expect(screen.getAllByRole('button', { name: /Open case/ })).toHaveLength(10);
  expect(screen.getByText('Showing 1-10 of 23')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Next page' })).toBeEnabled();

  await user.click(screen.getByRole('button', { name: 'Next page' }));
  expect(screen.getByText('Showing 11-20 of 23')).toBeInTheDocument();
  expect(screen.getAllByRole('button', { name: /Open case/ })).toHaveLength(10);

  await user.click(screen.getByRole('button', { name: 'Next page' }));
  expect(screen.getByText('Showing 21-23 of 23')).toBeInTheDocument();
  expect(screen.getAllByRole('button', { name: /Open case/ })).toHaveLength(3);
  expect(screen.getByRole('button', { name: 'Previous page' })).toBeEnabled();
  expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled();
});

test('clamps safely when rows shrink and resets to page one when the selected case rises to the head', async () => {
  const user = userEvent.setup();
  const cases = Array.from({ length: 23 }, (_, index) => makeCase(index + 1));
  const view = renderCenter(cases, { selectedCaseId: cases[0].id });

  await user.click(screen.getByRole('button', { name: 'Next page' }));
  await user.click(screen.getByRole('button', { name: 'Next page' }));
  expect(screen.getByText('Showing 21-23 of 23')).toBeInTheDocument();

  view.rerender(
    <CommandCenter
      cases={cases.slice(0, 4)}
      selectedCaseId={cases[0].id}
      isAuthenticated
      identityEmail="investigator@example.gov"
      caseStartStatus="idle"
      caseStartMessage={null}
      onStartCase={vi.fn()}
      onSelectCase={vi.fn()}
    />,
  );
  expect(screen.getByText('Showing 1-4 of 4')).toBeInTheDocument();

  const registered = makeCase(99, '2026-12-31T23:59:59Z');
  view.rerender(
    <CommandCenter
      cases={[...cases, registered]}
      selectedCaseId={registered.id}
      isAuthenticated
      identityEmail="investigator@example.gov"
      caseStartStatus="registered"
      caseStartMessage={`Case ${registered.id} is ready.`}
      onStartCase={vi.fn()}
      onSelectCase={vi.fn()}
    />,
  );
  expect(screen.getByText('Showing 1-10 of 24')).toBeInTheDocument();
  expect(screen.getAllByRole('button', { name: /Open case/ })[0]).toHaveAccessibleName(`Open case ${registered.id}`);
});

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, test, vi } from 'vitest';
import type { CaseStartOutcome, CaseStartStatus } from './useCaseWorkspace';
import { StartCaseDialog } from './StartCaseDialog';

const registered: CaseStartOutcome = {
  status: 'registered',
  caseId: 'PI-PCS-2026-ABC123',
  jobKey: 'job-123',
};

function renderDialog(options: {
  identityEmail?: string | null;
  isAuthenticated?: boolean;
  startStatus?: CaseStartStatus;
  startMessage?: string | null;
  onStartCase?: (input: {
    caseType: 'MedicaidPCS' | 'StateMedicaidHospice';
    requesterEmail: string;
  }) => Promise<CaseStartOutcome>;
} = {}) {
  const onStartCase = options.onStartCase ?? vi.fn().mockResolvedValue(registered);
  const props = {
    identityEmail: options.identityEmail ?? 'investigator@example.gov',
    isAuthenticated: options.isAuthenticated ?? true,
    startStatus: options.startStatus ?? 'idle' as const,
    startMessage: options.startMessage ?? null,
    onStartCase,
  };
  const view = render(<StartCaseDialog {...props} />);
  return { ...view, onStartCase, props };
}

afterEach(cleanup);

test('defaults to Medicaid PCS and the authenticated email while allowing an edited requester', async () => {
  const user = userEvent.setup();
  const { onStartCase } = renderDialog();

  await user.click(screen.getByRole('button', { name: 'Start new case' }));
  expect(screen.getByRole('dialog', { name: 'Start new case' })).toHaveClass('bg-white');
  expect(screen.getByRole('combobox', { name: 'Case type' })).toHaveTextContent('Medicaid PCS');
  const email = screen.getByRole('textbox', { name: 'Requester email' });
  expect(email).toHaveValue('investigator@example.gov');

  await user.clear(email);
  await user.type(email, 'Reviewer@Example.Gov');
  await user.click(screen.getByRole('button', { name: 'Start case' }));

  expect(onStartCase).toHaveBeenCalledOnce();
  expect(onStartCase).toHaveBeenCalledWith({
    caseType: 'MedicaidPCS',
    requesterEmail: 'Reviewer@Example.Gov',
  });
  expect(screen.queryByRole('dialog', { name: 'Start new case' })).not.toBeInTheDocument();
});

test('submits the exact StateMedicaidHospice CaseType', async () => {
  const user = userEvent.setup();
  const { onStartCase } = renderDialog({
    onStartCase: vi.fn().mockResolvedValue({
      status: 'registered',
      caseId: 'PI-HSP-2026-ABC123',
      jobKey: 'job-hsp',
    }),
  });

  await user.click(screen.getByRole('button', { name: 'Start new case' }));
  fireEvent.keyDown(screen.getByRole('combobox', { name: 'Case type' }), { key: 'ArrowDown' });
  fireEvent.click(screen.getByRole('option', { name: 'State Medicaid Hospice' }));
  await user.click(screen.getByRole('button', { name: 'Start case' }));

  expect(onStartCase).toHaveBeenCalledWith({
    caseType: 'StateMedicaidHospice',
    requesterEmail: 'investigator@example.gov',
  });
});

test('shows inline email validation and makes no submission for an invalid address', async () => {
  const user = userEvent.setup();
  const { onStartCase } = renderDialog();

  await user.click(screen.getByRole('button', { name: 'Start new case' }));
  const email = screen.getByRole('textbox', { name: 'Requester email' });
  await user.clear(email);
  await user.type(email, 'not-an-email');
  await user.click(screen.getByRole('button', { name: 'Start case' }));

  expect(screen.getByRole('alert')).toHaveTextContent('Enter one valid requester email address.');
  expect(email).toHaveAttribute('aria-invalid', 'true');
  expect(onStartCase).not.toHaveBeenCalled();
});

test('prevents duplicate submission and locks the form while a start is pending', async () => {
  const user = userEvent.setup();
  let resolveStart!: (outcome: CaseStartOutcome) => void;
  const onStartCase = vi.fn(() => new Promise<CaseStartOutcome>((resolve) => {
    resolveStart = resolve;
  }));
  renderDialog({ onStartCase });

  await user.click(screen.getByRole('button', { name: 'Start new case' }));
  await user.click(screen.getByRole('button', { name: 'Start case' }));

  expect(screen.getByRole('button', { name: 'Starting case…' })).toBeDisabled();
  expect(screen.getByRole('combobox', { name: 'Case type' })).toBeDisabled();
  expect(screen.getByRole('textbox', { name: 'Requester email' })).toBeDisabled();
  await user.click(screen.getByRole('button', { name: 'Starting case…' }));
  expect(onStartCase).toHaveBeenCalledOnce();

  resolveStart({ status: 'pending', caseId: 'PI-PCS-2026-ABC123', jobKey: 'job-123' });
  expect(await screen.findByRole('dialog', { name: 'Start new case' })).toBeInTheDocument();
});

test('keeps the dialog open for start errors and closes it only after registration', async () => {
  const user = userEvent.setup();
  const onStartCase = vi.fn()
    .mockRejectedValueOnce(new Error('UiPath process start failed.'))
    .mockResolvedValueOnce(registered);
  renderDialog({ onStartCase });

  await user.click(screen.getByRole('button', { name: 'Start new case' }));
  await user.click(screen.getByRole('button', { name: 'Start case' }));

  expect(await screen.findByRole('dialog', { name: 'Start new case' })).toBeInTheDocument();
  expect(screen.getByRole('alert')).toHaveTextContent('UiPath process start failed.');

  await user.click(screen.getByRole('button', { name: 'Start case' }));
  expect(screen.queryByRole('dialog', { name: 'Start new case' })).not.toBeInTheDocument();
});

test('does not show a previous submission error after the dialog is closed and reopened', async () => {
  const user = userEvent.setup();
  const onStartCase = vi.fn().mockRejectedValue(new Error('UiPath process start failed.'));
  const { rerender, props } = renderDialog({ onStartCase });

  await user.click(screen.getByRole('button', { name: 'Start new case' }));
  await user.click(screen.getByRole('button', { name: 'Start case' }));
  rerender(
    <StartCaseDialog
      {...props}
      startStatus="error"
      startMessage="UiPath process start failed."
    />,
  );

  expect(await screen.findByRole('alert')).toHaveTextContent('UiPath process start failed.');
  await user.click(screen.getByRole('button', { name: 'Cancel' }));
  await user.click(screen.getByRole('button', { name: 'Start new case' }));

  expect(screen.getByRole('dialog', { name: 'Start new case' })).toBeInTheDocument();
  expect(screen.queryByText('UiPath process start failed.')).not.toBeInTheDocument();
});

test('resets defaults on reopen and profile changes without overwriting active edits', async () => {
  const user = userEvent.setup();
  const { rerender, props } = renderDialog();

  await user.click(screen.getByRole('button', { name: 'Start new case' }));
  const email = screen.getByRole('textbox', { name: 'Requester email' });
  await user.clear(email);
  await user.type(email, 'custom@example.gov');
  rerender(<StartCaseDialog {...props} identityEmail="new-profile@example.gov" />);
  expect(screen.getByRole('textbox', { name: 'Requester email' })).toHaveValue('custom@example.gov');

  await user.click(screen.getByRole('button', { name: 'Cancel' }));
  await user.click(screen.getByRole('button', { name: 'Start new case' }));
  expect(screen.getByRole('textbox', { name: 'Requester email' })).toHaveValue('new-profile@example.gov');
  expect(screen.getByRole('combobox', { name: 'Case type' })).toHaveTextContent('Medicaid PCS');
});

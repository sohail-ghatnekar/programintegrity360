import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDemoCaseWorkspace } from '../cases/demoCase';
import type { CaseTaskModel } from '../cases/types';
import { TaskCenter } from './TaskCenter';
import { TaskDrawer } from './TaskDrawer';

const workspace = createDemoCaseWorkspace();
const caseTask = workspace.caseTasks[0];
const folderTask = workspace.folderTasks[0];

function task(overrides: Partial<CaseTaskModel>): CaseTaskModel {
  return {
    ...caseTask,
    ...overrides,
  } as CaseTaskModel;
}

afterEach(cleanup);

describe('TaskCenter', () => {
  it('keeps This Case and Folder Inbox records in separate tabs', async () => {
    const user = userEvent.setup();
    render(<TaskCenter caseTasks={workspace.caseTasks} folderTasks={workspace.folderTasks} onOpenTask={vi.fn()} />);

    expect(screen.getByRole('tab', { name: /This Case/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText(caseTask.title)).toBeInTheDocument();
    expect(screen.queryByText(folderTask.title)).not.toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /Folder Inbox/ }));

    expect(screen.getByText(folderTask.title)).toBeInTheDocument();
    expect(screen.queryByText(caseTask.title)).not.toBeInTheDocument();
    expect(screen.getByText(/Folder Inbox tasks are not relabeled as current-case work/i)).toBeInTheDocument();
  });

  it('filters the active tab by status, type, and priority', async () => {
    const user = userEvent.setup();
    const completedForm = task({
      id: 2001,
      title: 'Completed medium form',
      status: 'Completed',
      type: 'Form',
      priority: 'Medium',
    });
    const pendingHighApp = task({ id: 2002, title: 'Pending high app', status: 'Pending', type: 'App', priority: 'High' });
    render(<TaskCenter caseTasks={[completedForm, pendingHighApp]} folderTasks={[]} onOpenTask={vi.fn()} />);

    await user.selectOptions(screen.getByRole('combobox', { name: 'Status' }), 'Completed');
    expect(screen.getByText(completedForm.title)).toBeInTheDocument();
    expect(screen.queryByText(pendingHighApp.title)).not.toBeInTheDocument();

    await user.selectOptions(screen.getByRole('combobox', { name: 'Type' }), 'Form');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Priority' }), 'Medium');
    expect(screen.getByText(completedForm.title)).toBeInTheDocument();

    await user.selectOptions(screen.getByRole('combobox', { name: 'Priority' }), 'High');
    expect(screen.getByRole('status', { name: 'No matching tasks' })).toBeInTheDocument();
  });

  it('renders distinct source-empty and filter-empty states', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<TaskCenter caseTasks={[]} folderTasks={[]} onOpenTask={vi.fn()} />);

    expect(screen.getByRole('status', { name: 'No tasks for this case' })).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: /Folder Inbox/ }));
    expect(screen.getByRole('status', { name: 'Folder inbox is empty' })).toBeInTheDocument();

    rerender(<TaskCenter caseTasks={[caseTask]} folderTasks={[]} onOpenTask={vi.fn()} />);
    await user.click(screen.getByRole('tab', { name: /This Case/ }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Status' }), 'Completed');
    expect(screen.getByRole('status', { name: 'No matching tasks' })).toBeInTheDocument();
  });

  it('opens any selected task with its immutable source scope', async () => {
    const user = userEvent.setup();
    const onOpenTask = vi.fn();
    render(<TaskCenter caseTasks={workspace.caseTasks} folderTasks={workspace.folderTasks} onOpenTask={onOpenTask} />);

    await user.click(screen.getByRole('tab', { name: /Folder Inbox/ }));
    await user.click(screen.getByRole('button', { name: `Open task ${folderTask.id}` }));

    expect(onOpenTask).toHaveBeenCalledWith(folderTask, 'folder');
  });

  it('paginates a finite number of rows without resizing the task surface', async () => {
    const user = userEvent.setup();
    const tasks = Array.from({ length: 8 }, (_, index) => task({ id: 3000 + index, title: `Task row ${index + 1}` }));
    render(<TaskCenter caseTasks={tasks} folderTasks={[]} onOpenTask={vi.fn()} />);

    expect(screen.getAllByRole('row')).toHaveLength(7);
    expect(screen.getByText('Showing 1-6 of 8')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next task page' }));
    expect(screen.getByText('Showing 7-8 of 8')).toBeInTheDocument();
    expect(screen.getByText('Task row 8')).toBeInTheDocument();
  });
});

describe('TaskDrawer', () => {
  it('creates exactly one iframe only for an open non-completed task and retains the direct link', () => {
    const { rerender } = render(
      <TaskDrawer
        task={caseTask}
        taskScope="case"
        open
        onClose={vi.fn()}
        onCompleted={vi.fn()}
        readTaskStatus={vi.fn().mockResolvedValue({ status: 'Pending' })}
      />,
    );

    expect(screen.getAllByTitle(`Action Center task ${caseTask.id}`)).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'Open in Action Center' })).toHaveAttribute('href', caseTask.actionCenterUrl);

    rerender(
      <TaskDrawer
        task={folderTask}
        taskScope="folder"
        open
        onClose={vi.fn()}
        onCompleted={vi.fn()}
        readTaskStatus={vi.fn().mockResolvedValue({ status: 'Pending' })}
      />,
    );

    expect(screen.getAllByTitle(`Action Center task ${folderTask.id}`)).toHaveLength(1);
    expect(screen.queryByTitle(`Action Center task ${caseTask.id}`)).not.toBeInTheDocument();
    expect(screen.getByText(/Folder Inbox task/)).toBeInTheDocument();
  });

  it('does not embed a completed task but keeps its confirmed status and direct link visible', () => {
    const completedTask = task({ id: 4001, status: 'Completed', title: 'Completed supervisor task' });
    render(
      <TaskDrawer
        task={completedTask}
        taskScope="case"
        open
        onClose={vi.fn()}
        onCompleted={vi.fn()}
        readTaskStatus={vi.fn()}
      />,
    );

    expect(screen.queryByTitle(`Action Center task ${completedTask.id}`)).not.toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Task completed' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open in Action Center' })).toHaveAttribute('href', completedTask.actionCenterUrl);
  });

  it('states when live polling is unavailable and does not simulate completion', () => {
    const onCompleted = vi.fn();
    render(
      <TaskDrawer
        task={caseTask}
        taskScope="case"
        open
        onClose={vi.fn()}
        onCompleted={onCompleted}
      />,
    );

    expect(screen.getByText(/Live task polling is unavailable for this demo or unpublished task/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open in Action Center' })).toBeInTheDocument();
    expect(onCompleted).not.toHaveBeenCalled();
  });

  it('keeps the direct-link command visible when the task URL is unavailable', () => {
    const unpublishedTask = task({ id: 4002, actionCenterUrl: '' });
    render(
      <TaskDrawer
        task={unpublishedTask}
        taskScope="case"
        open
        onClose={vi.fn()}
        onCompleted={vi.fn()}
      />,
    );

    expect(screen.queryByTitle(`Action Center task ${unpublishedTask.id}`)).not.toBeInTheDocument();
    const fallback = screen.getByRole('button', { name: 'Open in Action Center' });
    expect(fallback).toBeDisabled();
    expect(within(screen.getByRole('status', { name: 'Action Center link unavailable' })).getByText(/not published/i)).toBeInTheDocument();
  });
});

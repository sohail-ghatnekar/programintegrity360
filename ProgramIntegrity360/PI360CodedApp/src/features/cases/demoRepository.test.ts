import { describe, expect, it } from 'vitest';
import { createDemoCaseWorkspace, DemoCaseRepository } from './demoRepository';

describe('demo case repository', () => {
  it('returns the canonical demo case workspace', () => {
    const workspace = createDemoCaseWorkspace();

    expect(workspace.dataSource).toBe('demo');
    expect(workspace.case.id).toBe('PI-PCS-2026-0041');
    expect(workspace.stages.map((stage) => stage.key)).toEqual([
      'intake',
      'evidence',
      'investigation',
      'provider-response',
      'supervisor-review',
      'closure',
    ]);
    expect(workspace.stages.map((stage) => stage.label)).toEqual([
      'Alert intake and triage',
      'Evidence acquisition and validation',
      'Investigation and case management',
      'Provider response',
      'Supervisor review and approval',
      'Closure and monitoring',
    ]);
    expect(workspace.case.stage).toBe('Investigation and case management');
    expect(workspace.caseTasks.filter((task) => task.type === 'App')).toHaveLength(2);
    expect(workspace.executionTimeline).not.toHaveLength(0);
  });

  it('keeps the demo fixture private and returns deeply frozen snapshots', async () => {
    const workspace = createDemoCaseWorkspace();
    const fixtureModule = await import('./demoCase');

    expect(fixtureModule).not.toHaveProperty('DEMO_CASE_WORKSPACE');
    expect(Object.isFrozen(workspace)).toBe(true);
    expect(Object.isFrozen(workspace.stages)).toBe(true);
    expect(Object.isFrozen(workspace.stages[0])).toBe(true);
    expect(Object.isFrozen(workspace.evidenceDocuments[0].fields)).toBe(true);
  });

  it('returns immutable demo task snapshots without simulating completion', async () => {
    const repository = new DemoCaseRepository();
    const initialWorkspace = createDemoCaseWorkspace();
    const initialTasks = await repository.refreshTasks(initialWorkspace.case.id);

    expect(() => {
      (initialTasks.caseTasks[0] as { status: string }).status = 'Completed';
    }).toThrow(TypeError);
    const refreshedTasks = await repository.refreshTasks(initialWorkspace.case.id);

    expect(refreshedTasks.caseTasks[0].status).toBe('Pending');
    expect(refreshedTasks.caseTasks).toEqual(initialWorkspace.caseTasks);
    expect(refreshedTasks.folderTasks).toEqual(initialWorkspace.folderTasks);
  });
});

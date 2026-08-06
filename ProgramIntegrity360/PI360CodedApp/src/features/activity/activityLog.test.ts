import { describe, expect, it } from 'vitest';
import {
  ActivityLog,
  buildTaskActivityEvents,
  createActivityEvent,
  redactActivityData,
  updateTaskActivityHistory,
} from './activityLog';
import type { ActivityEvent } from '../cases/types';
import { createDemoCaseWorkspace } from '../cases/demoCase';

function event(overrides: Partial<ActivityEvent> = {}): ActivityEvent {
  return {
    id: 'event-1',
    timestamp: '2026-08-06T10:00:00.000Z',
    source: 'app',
    severity: 'info',
    status: 'ready',
    summary: 'Ready for review.',
    caseId: 'CASE-1',
    correlationId: 'corr-event-1',
    ...overrides,
  };
}

describe('activity data safety', () => {
  it('recursively redacts token, OAuth callback, and raw payload fields', () => {
    const value = redactActivityData({
      accessToken: 'secret-access',
      nested: {
        refresh_token: 'secret-refresh',
        oauthCallback: { code: 'secret-code' },
        rawPayload: { memberId: 'MBR-1' },
        safeSummary: 'Evidence was reviewed.',
      },
      records: [{ callbackUrl: 'https://example.test/?code=secret' }],
    });

    expect(value).toEqual({
      accessToken: '[REDACTED]',
      nested: {
        refresh_token: '[REDACTED]',
        oauthCallback: '[REDACTED]',
        rawPayload: '[REDACTED]',
        safeSummary: 'Evidence was reviewed.',
      },
      records: [{ callbackUrl: '[REDACTED]' }],
    });
    expect(JSON.stringify(value)).not.toContain('secret');
    expect(JSON.stringify(value)).not.toContain('MBR-1');
  });

  it('generates a stable correlation ID when the producer omits one', () => {
    const first = createActivityEvent({
      id: 'agent-connected',
      timestamp: '2026-08-06T10:00:00.000Z',
      source: 'agent',
      severity: 'info',
      status: 'connected',
      summary: 'Live agent connected.',
      caseId: 'CASE-1',
    });
    const second = createActivityEvent({
      id: 'agent-connected',
      timestamp: '2026-08-06T10:00:00.000Z',
      source: 'agent',
      severity: 'info',
      status: 'connected',
      summary: 'Live agent connected.',
      caseId: 'CASE-1',
    });

    expect(first.correlationId).toMatch(/^corr-[a-z0-9]+$/);
    expect(second.correlationId).toBe(first.correlationId);
  });

  it('scrubs bearer credentials and OAuth query values embedded in event text', () => {
    const safeEvent = createActivityEvent({
      id: 'oauth-error',
      timestamp: '2026-08-06T10:00:00.000Z',
      source: 'app',
      severity: 'error',
      status: 'callback-error',
      summary: 'Bearer secret-bearer failed at https://app.test/callback?code=secret-code&access_token=secret-token',
    });

    expect(safeEvent.summary).toContain('Bearer [REDACTED]');
    expect(safeEvent.summary).toContain('code=[REDACTED]');
    expect(safeEvent.summary).toContain('access_token=[REDACTED]');
    expect(safeEvent.summary).not.toContain('secret-');
  });

  it.each([
    'Request failed rawPayload={"member":{"id":"MBR-1"},"secret":"nested-secret"} trailing-secret',
    'Request failed raw_payload=[{"memberId":"MBR-2"},["array-secret"]] trailing-array-secret',
    'Request failed raw-payload:\n{\n  "member": { "id": "MBR-3" },\n  "secret": "multiline-secret"\n}\ntrailing-multiline-secret',
    'Request failed rawPayload="string-secret" trailing-string-secret',
  ])('conservatively redacts a serialized raw payload and everything after its marker', (unsafe) => {
    const safe = redactActivityData(unsafe);

    expect(safe).toMatch(/^Request failed raw[_-]?payload[:=]\[REDACTED\]$/i);
    expect(safe).not.toMatch(/MBR-|nested-secret|array-secret|multiline-secret|string-secret|trailing/i);
  });
});

describe('ActivityLog', () => {
  it('merges sources in deterministic timestamp, source, and ID order', () => {
    const log = new ActivityLog([
      [event({ id: 'user-b', source: 'user', timestamp: '2026-08-06T10:01:00Z' })],
      [event({ id: 'task-b', source: 'task', timestamp: '2026-08-06T10:00:00Z' })],
      [event({ id: 'maestro-b', source: 'maestro', timestamp: '2026-08-06T10:00:00Z' })],
      [event({ id: 'maestro-a', source: 'maestro', timestamp: '2026-08-06T10:00:00Z' })],
    ]);

    expect(log.events.map((item) => item.id)).toEqual([
      'maestro-a',
      'maestro-b',
      'task-b',
      'user-b',
    ]);
  });

  it('filters by source and status without changing event order', () => {
    const log = new ActivityLog([[
      event({ id: 'maestro', source: 'maestro', status: 'Completed' }),
      event({ id: 'task-pending', source: 'task', status: 'Pending', timestamp: '2026-08-06T10:01:00Z' }),
      event({ id: 'task-completed', source: 'task', status: 'Completed', timestamp: '2026-08-06T10:02:00Z' }),
    ]]);

    expect(log.filter({ sources: ['task'], statuses: ['Completed'] }).events.map((item) => item.id))
      .toEqual(['task-completed']);
  });

  it('records each current task state at its task-specific source update time', () => {
    const workspace = createDemoCaseWorkspace();
    const events = buildTaskActivityEvents(workspace.caseTasks, workspace.case.id);

    expect(events).toHaveLength(workspace.caseTasks.length);
    expect(events.find((item) => item.taskId === 1002)).toMatchObject({
      source: 'task',
      status: 'observed:Pending',
      timestamp: workspace.caseTasks[0].sourceUpdatedAt,
      summary: expect.stringContaining('Observed current task state'),
      caseId: workspace.case.id,
    });
    expect(events.find((item) => item.taskId === 1003)).toMatchObject({ status: 'observed:Unassigned' });
    expect(events.every((item) => item.timestamp !== workspace.caseTasks[0].createdAt)).toBe(true);
    expect(events.some((item) => item.status === 'Completed')).toBe(false);
  });

  it('preserves distinct status observations for the selected case without inventing transitions', () => {
    const workspace = createDemoCaseWorkspace();
    const initial = updateTaskActivityHistory(
      { caseId: null, events: [] },
      workspace.caseTasks,
      workspace.case.id,
    );
    const completedAt = '2026-08-06T16:00:00.000Z';
    const refreshedTasks = workspace.caseTasks.map((task) => (
      task.id === 1002
        ? { ...task, status: 'Completed' as const, sourceUpdatedAt: completedAt }
        : task
    ));

    const refreshed = updateTaskActivityHistory(initial, refreshedTasks, workspace.case.id);

    expect(refreshed.events.filter((item) => item.taskId === 1002)).toEqual([
      expect.objectContaining({ status: 'observed:Pending', timestamp: workspace.caseTasks[0].sourceUpdatedAt }),
      expect.objectContaining({ status: 'observed:Completed', timestamp: completedAt }),
    ]);
    expect(refreshed.events.every((item) => !item.status.startsWith('transition:'))).toBe(true);
  });

  it('resets retained task observations when the selected case changes', () => {
    const workspace = createDemoCaseWorkspace();
    const firstCase = updateTaskActivityHistory(
      { caseId: null, events: [] },
      workspace.caseTasks,
      workspace.case.id,
    );
    const secondCase = updateTaskActivityHistory(
      firstCase,
      [{ ...workspace.caseTasks[0], id: 2001, sourceId: 'task:2001' }],
      'CASE-2',
    );

    expect(secondCase.caseId).toBe('CASE-2');
    expect(secondCase.events.map((item) => item.taskId)).toEqual([2001]);
    expect(secondCase.events.every((item) => item.caseId === 'CASE-2')).toBe(true);
  });
});

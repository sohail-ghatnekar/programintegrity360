import { describe, expect, it } from 'vitest';
import {
  ActivityLog,
  buildTaskActivityEvents,
  createActivityEvent,
  redactActivityData,
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

  it('derives task events from truthful task state and never synthesizes completion', () => {
    const workspace = createDemoCaseWorkspace();
    const events = buildTaskActivityEvents(workspace.caseTasks, workspace.case.id);

    expect(events).toHaveLength(workspace.caseTasks.length);
    expect(events.find((item) => item.taskId === 1002)).toMatchObject({
      source: 'task',
      status: 'Pending',
      caseId: workspace.case.id,
    });
    expect(events.find((item) => item.taskId === 1003)).toMatchObject({ status: 'Unassigned' });
    expect(events.some((item) => item.status === 'Completed')).toBe(false);
  });
});

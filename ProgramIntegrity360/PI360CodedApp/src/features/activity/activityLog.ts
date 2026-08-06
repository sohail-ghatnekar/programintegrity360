import type { ActivityEvent, CaseTaskModel, DeepReadonly } from '../cases/types';

export type ActivityEventInput = Omit<ActivityEvent, 'correlationId'> & {
  correlationId?: string;
};

export type ActivityFilters = {
  sources?: readonly ActivityEvent['source'][];
  statuses?: readonly string[];
};

const SOURCE_ORDER: Record<ActivityEvent['source'], number> = {
  maestro: 0,
  task: 1,
  agent: 2,
  user: 3,
  app: 4,
};

const REDACTED = '[REDACTED]';

function isSensitiveKey(key: string): boolean {
  const normalized = key.replace(/[^a-z0-9]/gi, '').toLowerCase();
  return normalized.includes('token')
    || normalized.includes('authorization')
    || normalized.includes('callback')
    || (normalized.includes('raw') && normalized.includes('payload'));
}

function redactSensitiveText(value: string): string {
  const safeText = value
    .replace(/\bBearer\s+[^\s,;]+/gi, 'Bearer [REDACTED]')
    .replace(/([?&](?:code|state|access[_-]?token|refresh[_-]?token|id[_-]?token)=)[^&\s]+/gi, '$1[REDACTED]')
    .replace(/\b((?:access|refresh|id)[_-]?token=)[^&\s]+/gi, '$1[REDACTED]');
  const payloadMarker = /\b(raw[\s_-]*payload)\b\s*([:=])\s*/i.exec(safeText);

  if (!payloadMarker || payloadMarker.index === undefined) return safeText;

  return `${safeText.slice(0, payloadMarker.index)}${payloadMarker[1]}${payloadMarker[2]}${REDACTED}`;
}

export function redactActivityData<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => redactActivityData(item)) as T;
  }

  if (typeof value === 'string') {
    return redactSensitiveText(value) as T;
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  const redacted = Object.fromEntries(Object.entries(value).map(([key, child]) => (
    [key, isSensitiveKey(key) ? REDACTED : redactActivityData(child)]
  )));
  return redacted as T;
}

function stableHash(value: string): string {
  let hash = 2_166_136_261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }

  return (hash >>> 0).toString(36);
}

function generatedCorrelationId(event: ActivityEventInput): string {
  const seed = [
    event.source,
    event.id,
    event.caseId ?? '',
    event.taskId ?? '',
    event.timestamp,
  ].join('|');
  return `corr-${stableHash(seed)}`;
}

export function createActivityEvent(input: ActivityEventInput): ActivityEvent {
  const safeInput = redactActivityData(input);
  return {
    ...safeInput,
    correlationId: safeInput.correlationId?.trim() || generatedCorrelationId(safeInput),
  };
}

function compareEvents(left: ActivityEvent, right: ActivityEvent): number {
  const leftTime = Date.parse(left.timestamp);
  const rightTime = Date.parse(right.timestamp);
  const timestampOrder = Number.isFinite(leftTime) && Number.isFinite(rightTime)
    ? leftTime - rightTime
    : left.timestamp.localeCompare(right.timestamp);

  return timestampOrder
    || SOURCE_ORDER[left.source] - SOURCE_ORDER[right.source]
    || left.id.localeCompare(right.id)
    || left.correlationId.localeCompare(right.correlationId);
}

export function filterActivityEvents(
  events: readonly ActivityEvent[],
  filters: ActivityFilters = {},
): ActivityEvent[] {
  const sourceFilter = new Set(filters.sources ?? []);
  const statusFilter = new Set(filters.statuses ?? []);

  return events.filter((event) => (
    (sourceFilter.size === 0 || sourceFilter.has(event.source))
    && (statusFilter.size === 0 || statusFilter.has(event.status))
  ));
}

export class ActivityLog {
  readonly events: readonly ActivityEvent[];

  constructor(groups: readonly (readonly ActivityEventInput[])[]) {
    const unique = new Map<string, ActivityEvent>();

    for (const group of groups) {
      for (const input of group) {
        const safeEvent = createActivityEvent(input);
        unique.set(`${safeEvent.source}:${safeEvent.id}`, safeEvent);
      }
    }

    this.events = [...unique.values()].sort(compareEvents);
  }

  filter(filters: ActivityFilters): ActivityLog {
    return new ActivityLog([filterActivityEvents(this.events, filters)]);
  }
}

export function buildTaskActivityEvents(
  tasks: readonly DeepReadonly<CaseTaskModel>[],
  caseId: string,
): ActivityEvent[] {
  return tasks.map((task) => {
    const observedAt = task.sourceUpdatedAt || task.createdAt;
    return createActivityEvent({
      id: `task-observation:${task.id}:${task.status}:${observedAt}`,
      timestamp: observedAt,
      source: 'task',
      severity: task.status === 'Unassigned' ? 'warning' : 'info',
      status: `observed:${task.status}`,
      summary: `Observed current task state: Task ${task.id}, ${task.title}, is ${task.status}.`,
      caseId,
      taskId: task.id,
    });
  });
}

export type TaskActivityHistory = {
  caseId: string | null;
  events: readonly ActivityEvent[];
};

export function updateTaskActivityHistory(
  history: TaskActivityHistory,
  tasks: readonly DeepReadonly<CaseTaskModel>[],
  caseId: string,
): TaskActivityHistory {
  const retained = history.caseId === caseId ? history.events : [];
  return {
    caseId,
    events: new ActivityLog([retained, buildTaskActivityEvents(tasks, caseId)]).events,
  };
}

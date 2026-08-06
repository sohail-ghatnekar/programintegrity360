import { useCallback, useEffect, useRef, useState } from 'react';
import { Tasks } from '@uipath/uipath-typescript/tasks';
import type { UiPath } from '@uipath/uipath-typescript/core';
import type { TaskStatus } from '../cases/types';

export const TASK_POLL_INTERVAL_MS = 3_000;
export const TASK_POLL_TIMEOUT_MS = 120_000;

export type TaskStatusReader = (
  taskId: number,
  folderId: number,
) => Promise<{ status: TaskStatus | string }>;

export type TaskPollingState =
  | 'idle'
  | 'unavailable'
  | 'polling'
  | 'retrying'
  | 'completed'
  | 'timed-out'
  | 'terminal-unavailable';

export type CompletionRefreshState = 'idle' | 'refreshing' | 'succeeded' | 'failed';

export type UseTaskPollingOptions = {
  taskId: number;
  folderId: number;
  open: boolean;
  readTaskStatus?: TaskStatusReader;
  onCompleted: (taskId: number) => void | Promise<void>;
  onRefreshWorkspace?: () => void | Promise<void>;
};

type TaskReadFailureKind = 'transient' | 'terminal';
type CompletedSession = { generation: number; taskId: number };

function objectValue(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : null;
}

function numericStatus(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && /^\d{3}$/.test(value.trim())) return Number(value);
  return null;
}

function statusFromError(reason: unknown): number | null {
  const error = objectValue(reason);
  if (!error) return null;
  const response = objectValue(error.response);

  return numericStatus(error.status)
    ?? numericStatus(error.statusCode)
    ?? numericStatus(response?.status);
}

function taskReadErrorMessage(reason: unknown): string {
  if (reason instanceof Error && reason.message.trim()) return reason.message.trim();
  const error = objectValue(reason);
  if (typeof error?.message === 'string' && error.message.trim()) return error.message.trim();
  const status = statusFromError(reason);
  return status === null ? 'Unknown Tasks API error.' : `Tasks API request failed with status ${status}.`;
}

export function classifyTaskReadFailure(reason: unknown): TaskReadFailureKind {
  const status = statusFromError(reason);
  if (status !== null) {
    if ([400, 401, 403, 404].includes(status)) return 'terminal';
    if (status === 0 || status === 408 || status === 429 || status >= 500) return 'transient';
  }

  const message = taskReadErrorMessage(reason).toLowerCase();
  if (/bad request|unauth|authentication|forbidden|not[ -]?found|validation|invalid/.test(message)) {
    return 'terminal';
  }
  if (/network|fetch|timed?[ -]?out|temporar|rate[ -]?limit|too many|unavailable|connection|\b408\b|\b429\b|\b5\d\d\b/.test(message)) {
    return 'transient';
  }

  return 'terminal';
}

export function createSdkTaskStatusReader(sdk: UiPath): TaskStatusReader {
  const tasks = new Tasks(sdk);

  return async (taskId, folderId) => {
    const task = await tasks.getById(taskId, undefined, folderId);
    return { status: task.status };
  };
}

export function useTaskPolling({
  taskId,
  folderId,
  open,
  readTaskStatus,
  onCompleted,
  onRefreshWorkspace,
}: UseTaskPollingOptions) {
  const [state, setState] = useState<TaskPollingState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [completionRefreshState, setCompletionRefreshState] = useState<CompletionRefreshState>('idle');
  const [completionRefreshError, setCompletionRefreshError] = useState<string | null>(null);
  const readerRef = useRef(readTaskStatus);
  const onCompletedRef = useRef(onCompleted);
  const onRefreshWorkspaceRef = useRef(onRefreshWorkspace);
  const generationRef = useRef(0);
  const completedSessionRef = useRef<CompletedSession | null>(null);

  readerRef.current = readTaskStatus;
  onCompletedRef.current = onCompleted;
  onRefreshWorkspaceRef.current = onRefreshWorkspace;

  useEffect(() => {
    const generation = ++generationRef.current;
    const deadlineAt = Date.now() + TASK_POLL_TIMEOUT_MS;
    const timers: {
      interval?: ReturnType<typeof setInterval>;
      deadline?: ReturnType<typeof setTimeout>;
    } = {};
    let inFlight = false;
    let terminal = false;
    let completionSent = false;

    const isCurrent = () => generationRef.current === generation;
    const clearTimers = () => {
      if (timers.interval !== undefined) clearInterval(timers.interval);
      if (timers.deadline !== undefined) clearTimeout(timers.deadline);
    };
    const finish = (nextState: Extract<TaskPollingState, 'completed' | 'timed-out' | 'terminal-unavailable'>) => {
      if (terminal || !isCurrent()) return;
      terminal = true;
      clearTimers();
      if (nextState === 'completed') {
        completedSessionRef.current = { generation, taskId };
      }
      setState(nextState);
    };
    const completionSessionIsCurrent = () => (
      isCurrent()
      && completedSessionRef.current?.generation === generation
      && completedSessionRef.current.taskId === taskId
    );
    const notifyCompletion = async () => {
      setCompletionRefreshState('refreshing');
      setCompletionRefreshError(null);
      try {
        await onCompletedRef.current(taskId);
        if (!completionSessionIsCurrent()) return;
        setCompletionRefreshState('succeeded');
      } catch (reason) {
        if (!completionSessionIsCurrent()) return;
        setCompletionRefreshState('failed');
        setCompletionRefreshError(reason instanceof Error ? reason.message : 'Workspace refresh failed.');
      }
    };
    const poll = async () => {
      if (terminal || inFlight || !isCurrent()) return;
      if (Date.now() >= deadlineAt) {
        finish('timed-out');
        return;
      }

      const reader = readerRef.current;
      if (!reader) {
        setState('unavailable');
        return;
      }

      inFlight = true;
      try {
        const result = await reader(taskId, folderId);
        inFlight = false;
        if (terminal || !isCurrent()) return;
        if (Date.now() >= deadlineAt) {
          finish('timed-out');
          return;
        }

        setError(null);
        if (result.status === 'Completed') {
          finish('completed');
          if (!completionSent) {
            completionSent = true;
            void notifyCompletion();
          }
          return;
        }

        setState('polling');
      } catch (reason) {
        inFlight = false;
        if (terminal || !isCurrent()) return;
        if (Date.now() >= deadlineAt) {
          finish('timed-out');
          return;
        }

        const message = taskReadErrorMessage(reason);
        setError(message);
        if (classifyTaskReadFailure(reason) === 'terminal') {
          finish('terminal-unavailable');
          return;
        }
        setState('retrying');
      }
    };

    completedSessionRef.current = null;
    setError(null);
    setCompletionRefreshState('idle');
    setCompletionRefreshError(null);

    if (!open) {
      setState('idle');
      return () => {
        if (generationRef.current === generation) generationRef.current += 1;
      };
    }

    setState(readerRef.current ? 'polling' : 'unavailable');
    timers.deadline = setTimeout(() => finish('timed-out'), TASK_POLL_TIMEOUT_MS);
    timers.interval = setInterval(() => {
      void poll();
    }, TASK_POLL_INTERVAL_MS);

    return () => {
      terminal = true;
      clearTimers();
      if (generationRef.current === generation) generationRef.current += 1;
      if (completedSessionRef.current?.generation === generation) completedSessionRef.current = null;
    };
  }, [folderId, open, taskId]);

  const retryWorkspaceRefresh = useCallback(async () => {
    const session = completedSessionRef.current;
    const refreshWorkspace = onRefreshWorkspaceRef.current;
    if (!session || !refreshWorkspace || generationRef.current !== session.generation) return;

    setCompletionRefreshState('refreshing');
    setCompletionRefreshError(null);
    try {
      await refreshWorkspace();
      if (completedSessionRef.current === session && generationRef.current === session.generation) {
        setCompletionRefreshState('succeeded');
      }
    } catch (reason) {
      if (completedSessionRef.current === session && generationRef.current === session.generation) {
        setCompletionRefreshState('failed');
        setCompletionRefreshError(reason instanceof Error ? reason.message : 'Workspace refresh failed.');
      }
    }
  }, []);

  return {
    state,
    error,
    completionRefreshState,
    completionRefreshError,
    canRetryWorkspaceRefresh: Boolean(onRefreshWorkspace),
    retryWorkspaceRefresh,
  };
}

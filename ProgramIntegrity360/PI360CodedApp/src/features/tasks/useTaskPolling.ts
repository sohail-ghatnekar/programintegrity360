import { useEffect, useRef, useState } from 'react';
import { Tasks } from '@uipath/uipath-typescript/tasks';
import type { UiPath } from '@uipath/uipath-typescript/core';
import type { TaskStatus } from '../cases/types';

export const TASK_POLL_INTERVAL_MS = 3_000;
export const TASK_POLL_TIMEOUT_MS = 120_000;

export type TaskStatusReader = (
  taskId: number,
  folderId: number,
) => Promise<{ status: TaskStatus | string }>;

export type TaskPollingState = 'idle' | 'unavailable' | 'polling' | 'retrying' | 'completed' | 'timed-out';

export type UseTaskPollingOptions = {
  taskId: number;
  folderId: number;
  open: boolean;
  readTaskStatus?: TaskStatusReader;
  onCompleted: (taskId: number) => void | Promise<void>;
};

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
}: UseTaskPollingOptions) {
  const [state, setState] = useState<TaskPollingState>('idle');
  const readerRef = useRef(readTaskStatus);
  const onCompletedRef = useRef(onCompleted);

  readerRef.current = readTaskStatus;
  onCompletedRef.current = onCompleted;

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let completionSent = false;
    const startedAt = Date.now();

    if (!open) {
      setState('idle');
      return undefined;
    }

    if (!readerRef.current) {
      setState('unavailable');
      return undefined;
    }

    setState('polling');

    const poll = async () => {
      if (cancelled) return;
      if (Date.now() - startedAt >= TASK_POLL_TIMEOUT_MS) {
        setState('timed-out');
        return;
      }

      try {
        const result = await readerRef.current?.(taskId, folderId);
        if (cancelled) return;

        if (result?.status === 'Completed') {
          setState('completed');
          if (!completionSent) {
            completionSent = true;
            await onCompletedRef.current(taskId);
          }
          return;
        }

        setState('polling');
      } catch {
        if (cancelled) return;
        setState('retrying');
      }

      if (!cancelled) {
        timer = setTimeout(poll, TASK_POLL_INTERVAL_MS);
      }
    };

    timer = setTimeout(poll, TASK_POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      if (timer !== undefined) clearTimeout(timer);
    };
  }, [folderId, open, taskId]);

  return { state };
}

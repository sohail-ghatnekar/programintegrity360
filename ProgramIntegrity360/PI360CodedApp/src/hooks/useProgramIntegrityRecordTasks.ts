import { useCallback, useMemo, useState } from 'react';
import { Tasks, TaskPriority, TaskType, type TaskCreateResponse, type TaskGetResponse } from '@uipath/uipath-typescript/tasks';
import { useAuth } from './useAuth';
import type { ProgramIntegrityRecordContext } from './useProgramIntegrityRecordAgent';

const DEFAULT_TASK_FOLDER_ID = 3295396;

function getConfiguredFolderId(): number {
  const rawValue = import.meta.env.VITE_PI360_TASK_FOLDER_ID
    || import.meta.env.VITE_UIPATH_FOLDER_ID
    || String(DEFAULT_TASK_FOLDER_ID);
  const parsed = Number(rawValue);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TASK_FOLDER_ID;
}

function getCaseId(recordContext: ProgramIntegrityRecordContext | null): string {
  const caseRecord = recordContext?.caseRecord as { id?: unknown } | undefined;
  return typeof caseRecord?.id === 'string' ? caseRecord.id : 'PI-PCS-2026-0041';
}

function toTaskSummary(task: TaskCreateResponse | TaskGetResponse) {
  return {
    id: task.id,
    title: task.title,
    status: task.status,
    type: task.type,
    folderId: task.folderId,
  };
}

export function useProgramIntegrityRecordTasks(recordContext: ProgramIntegrityRecordContext | null) {
  const { sdk, isAuthenticated, currentUserEmail } = useAuth();
  const taskFolderId = useMemo(() => getConfiguredFolderId(), []);
  const tasks = useMemo(() => new Tasks(sdk), [sdk]);
  const [activeTask, setActiveTask] = useState<TaskCreateResponse | TaskGetResponse | null>(null);
  const [isWorking, setIsWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const createReviewTask = useCallback(async () => {
    if (!isAuthenticated) {
      throw new Error('Connect to UiPath before creating a task.');
    }

    setIsWorking(true);
    setError(null);
    setNotice(null);

    try {
      const caseId = getCaseId(recordContext);
      const createdTask = await tasks.create({
        title: `PI360 record review - ${caseId}`,
        priority: TaskPriority.High,
        data: {
          caseId,
          source: 'PI360RecordConversationAgent',
          requestedBy: currentUserEmail || 'current user',
          recordContext,
        },
      }, taskFolderId);

      setActiveTask(createdTask);
      setNotice(`Created task ${createdTask.id}.`);
      return toTaskSummary(createdTask);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create task.';
      setError(message);
      throw new Error(message);
    } finally {
      setIsWorking(false);
    }
  }, [currentUserEmail, isAuthenticated, recordContext, taskFolderId, tasks]);

  const completeCurrentTask = useCallback(async () => {
    if (!isAuthenticated) {
      throw new Error('Connect to UiPath before completing a task.');
    }
    if (!activeTask) {
      throw new Error('Create a record review task before completing it.');
    }

    setIsWorking(true);
    setError(null);
    setNotice(null);

    try {
      const latestTask = await tasks.getById(activeTask.id, undefined, activeTask.folderId || taskFolderId);
      if (latestTask.type === TaskType.External) {
        await latestTask.complete({
          type: TaskType.External,
          action: 'Resolved',
          data: {
            completedBy: currentUserEmail || 'current user',
            resolution: 'Reviewed from Program Integrity 360 record assistant',
          },
        });
      } else {
        await latestTask.complete({
          type: latestTask.type,
          action: latestTask.action || 'Submit',
          data: {
            completedBy: currentUserEmail || 'current user',
            resolution: 'Reviewed from Program Integrity 360 record assistant',
          },
        });
      }

      const completedTask = {
        ...latestTask,
        status: 'Completed' as typeof latestTask.status,
      };
      setActiveTask(completedTask);
      setNotice(`Completed task ${latestTask.id}.`);
      return {
        ...toTaskSummary(completedTask),
        action: 'Resolved',
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to complete task.';
      setError(message);
      throw new Error(message);
    } finally {
      setIsWorking(false);
    }
  }, [activeTask, currentUserEmail, isAuthenticated, taskFolderId, tasks]);

  return {
    activeTask: activeTask ? toTaskSummary(activeTask) : null,
    createReviewTask,
    completeCurrentTask,
    isWorking,
    error,
    notice,
    taskFolderId,
  };
}

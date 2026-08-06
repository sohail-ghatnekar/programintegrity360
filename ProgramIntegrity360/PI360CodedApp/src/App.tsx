import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppShell } from './app/AppShell';
import { getUiPathAuthSetup, getUiPathConfigurationError } from './config/uipath';
import { ActivityLog, updateTaskActivityHistory } from './features/activity/activityLog';
import type { TaskActivityHistory } from './features/activity/activityLog';
import { RecordAssistantPanel } from './features/assistant/RecordAssistantPanel';
import { useRecordAssistant } from './features/assistant/useRecordAssistant';
import type { CaseTaskModel, DeepReadonly, DemoRole } from './features/cases/types';
import { useCaseWorkspace } from './features/cases/useCaseWorkspace';
import { TaskCenter } from './features/tasks/TaskCenter';
import type { TaskScope } from './features/tasks/TaskCenter';
import { TaskDrawer } from './features/tasks/TaskDrawer';
import { createSdkTaskStatusReader } from './features/tasks/useTaskPolling';
import { AuthProvider, useAuth } from './hooks/useAuth';

const authSetup = getUiPathAuthSetup();
const configurationError = getUiPathConfigurationError(authSetup.missingFields);

function App() {
  return (
    <AuthProvider config={authSetup.config}>
      <ProgramIntegrityWorkbench />
    </AuthProvider>
  );
}

function ProgramIntegrityWorkbench() {
  const auth = useAuth();
  const caseWorkspace = useCaseWorkspace();
  const refreshWorkspace = caseWorkspace.refresh;
  const [role, setRole] = useState<DemoRole>('investigator');
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [taskActivityHistory, setTaskActivityHistory] = useState<TaskActivityHistory>({
    caseId: null,
    events: [],
  });
  const [taskSelection, setTaskSelection] = useState<{
    task: DeepReadonly<CaseTaskModel>;
    scope: TaskScope;
  } | null>(null);
  const warnings = useMemo(() => {
    if (!configurationError || auth.isAuthenticated) {
      return caseWorkspace.warnings;
    }

    return [
      'UiPath OAuth is not configured for this local session. Demo records are labeled and remain synthetic.',
      ...caseWorkspace.warnings,
    ];
  }, [auth.isAuthenticated, caseWorkspace.warnings]);
  const taskStatusReader = useMemo(() => (
    auth.isAuthenticated && caseWorkspace.status === 'live'
      ? createSdkTaskStatusReader(auth.sdk)
      : undefined
  ), [auth.isAuthenticated, auth.sdk, caseWorkspace.status]);
  const assistant = useRecordAssistant(caseWorkspace.workspace, assistantOpen);
  const currentTaskActivityHistory = useMemo(() => (
    caseWorkspace.workspace
      ? updateTaskActivityHistory(
        taskActivityHistory,
        caseWorkspace.workspace.caseTasks,
        caseWorkspace.workspace.case.id,
      )
      : { caseId: null, events: [] }
  ), [caseWorkspace.workspace, taskActivityHistory]);

  useEffect(() => {
    if (!caseWorkspace.workspace) {
      setTaskActivityHistory((current) => (
        current.caseId === null && current.events.length === 0
          ? current
          : { caseId: null, events: [] }
      ));
      return;
    }

    setTaskActivityHistory((current) => updateTaskActivityHistory(
      current,
      caseWorkspace.workspace?.caseTasks ?? [],
      caseWorkspace.workspace?.case.id ?? '',
    ));
  }, [caseWorkspace.workspace]);

  const activityEvents = useMemo(() => {
    if (!caseWorkspace.workspace) return [];

    return new ActivityLog([
      caseWorkspace.workspace.executionTimeline,
      currentTaskActivityHistory.events,
      assistant.activityEvents,
    ]).events;
  }, [assistant.activityEvents, caseWorkspace.workspace, currentTaskActivityHistory.events]);
  const refreshCaseWorkspace = useCallback(async () => {
    const result = await refreshWorkspace();
    if (!result.ok) throw result.error;
  }, [refreshWorkspace]);
  const selectedTask = useMemo(() => {
    if (!taskSelection || !caseWorkspace.workspace) return taskSelection?.task ?? null;
    const tasks = taskSelection.scope === 'case'
      ? caseWorkspace.workspace.caseTasks
      : caseWorkspace.workspace.folderTasks;
    return tasks.find((task) => task.id === taskSelection.task.id) ?? taskSelection.task;
  }, [caseWorkspace.workspace, taskSelection]);
  const taskCenter = (
    <TaskCenter
      caseTasks={caseWorkspace.workspace?.caseTasks ?? []}
      folderTasks={caseWorkspace.workspace?.folderTasks ?? []}
      onOpenTask={(task, scope) => setTaskSelection({ task, scope })}
    />
  );
  const assistantPanel = assistantOpen ? (
    <RecordAssistantPanel
      isOpen
      onClose={() => setAssistantOpen(false)}
      workspace={caseWorkspace.workspace}
      assistant={assistant}
      onOpenTask={(task) => {
        if (caseWorkspace.workspace?.dataSource !== 'live' || task.dataSource !== 'live') return;
        setTaskSelection({ task, scope: 'case' });
      }}
    />
  ) : undefined;

  return (
    <>
      <AppShell
        cases={caseWorkspace.cases}
        workspace={caseWorkspace.workspace}
        status={caseWorkspace.status}
        warnings={warnings}
        identity={{
          isAuthenticated: auth.isAuthenticated,
          name: auth.currentUserName ?? 'Demo session',
          email: auth.currentUserEmail,
        }}
        role={role}
        onRoleChange={setRole}
        onSelectCase={caseWorkspace.selectCase}
        onRefresh={refreshCaseWorkspace}
        onUseDemoData={caseWorkspace.useDemoData}
        onLogin={auth.login}
        onLogout={auth.logout}
        authLoading={auth.isLoading}
        authError={auth.error}
        assistant={assistantPanel}
        activityEvents={activityEvents}
        onOpenAssistant={() => setAssistantOpen(true)}
        taskCenter={taskCenter}
      />
      {taskSelection && selectedTask && (
        <TaskDrawer
          task={selectedTask}
          taskScope={taskSelection.scope}
          open
          onClose={() => setTaskSelection(null)}
          onCompleted={refreshCaseWorkspace}
          onRefreshWorkspace={refreshCaseWorkspace}
          readTaskStatus={taskStatusReader}
        />
      )}
    </>
  );
}

export default App;

import { useMemo, useState } from 'react';
import { AppShell } from './app/AppShell';
import { getUiPathAuthSetup, getUiPathConfigurationError } from './config/uipath';
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
  const [role, setRole] = useState<DemoRole>('investigator');
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
        onRefresh={caseWorkspace.refresh}
        onUseDemoData={caseWorkspace.useDemoData}
        onLogin={auth.login}
        onLogout={auth.logout}
        authLoading={auth.isLoading}
        authError={auth.error}
        taskCenter={taskCenter}
      />
      {taskSelection && selectedTask && (
        <TaskDrawer
          task={selectedTask}
          taskScope={taskSelection.scope}
          open
          onClose={() => setTaskSelection(null)}
          onCompleted={async () => {
            await caseWorkspace.refresh();
          }}
          onRefreshWorkspace={caseWorkspace.refresh}
          readTaskStatus={taskStatusReader}
        />
      )}
    </>
  );
}

export default App;

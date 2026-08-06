import { useMemo, useState } from 'react';
import { AppShell } from './app/AppShell';
import { getUiPathAuthSetup, getUiPathConfigurationError } from './config/uipath';
import type { DemoRole } from './features/cases/types';
import { useCaseWorkspace } from './features/cases/useCaseWorkspace';
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
  const warnings = useMemo(() => {
    if (!configurationError || auth.isAuthenticated) {
      return caseWorkspace.warnings;
    }

    return [
      'UiPath OAuth is not configured for this local session. Demo records are labeled and remain synthetic.',
      ...caseWorkspace.warnings,
    ];
  }, [auth.isAuthenticated, caseWorkspace.warnings]);

  return (
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
    />
  );
}

export default App;

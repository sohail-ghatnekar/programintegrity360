import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  Skeleton,
  ToggleGroup,
  ToggleGroupItem,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@uipath/apollo-wind';
import {
  BriefcaseBusiness,
  ClipboardCheck,
  CircleUserRound,
  Database,
  FolderOpen,
  Inbox,
  LayoutDashboard,
  LogIn,
  LogOut,
  Menu,
  PanelRightOpen,
  RefreshCw,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react';
import logoUrl from '../assets/uipath-logo-png_seeklogo-618304.png';
import { CaseWorkspace } from '../features/cases/CaseWorkspace';
import { CommandCenter } from '../features/cases/CommandCenter';
import type { ActivityEvent, CaseSummary, CaseWorkspaceSnapshot, DemoRole } from '../features/cases/types';
import type { CaseType } from '../features/cases/caseIntakeCatalog';
import type { CaseStartOutcome, CaseStartStatus, CaseWorkspaceStatus } from '../features/cases/useCaseWorkspace';

type ShellView = 'command' | 'workspace' | 'tasks';
type RecoveryOperation = 'refresh' | 'demo';

export type AppShellIdentity = {
  isAuthenticated: boolean;
  name: string;
  email: string | null;
};

export type AppShellProps = {
  cases: readonly CaseSummary[];
  workspace: CaseWorkspaceSnapshot | null;
  status: CaseWorkspaceStatus;
  warnings: readonly string[];
  identity: AppShellIdentity;
  role: DemoRole;
  onRoleChange: (role: DemoRole) => void;
  onSelectCase: (caseId: string) => void | Promise<void>;
  onStartCase?: (input: {
    caseType: CaseType;
    requesterEmail: string;
  }) => Promise<CaseStartOutcome>;
  caseStartStatus?: CaseStartStatus;
  caseStartMessage?: string | null;
  onRefresh: () => void | Promise<void>;
  onUseDemoData: () => void | Promise<void>;
  onLogin?: () => void | Promise<void>;
  onLogout?: () => void;
  authLoading?: boolean;
  authError?: string | null;
  assistant?: ReactNode;
  activityEvents?: readonly ActivityEvent[];
  onOpenAssistant?: () => void;
  taskCenter?: ReactNode;
};

const navigation = [
  { id: 'command' as const, label: 'Command center', icon: LayoutDashboard },
  { id: 'workspace' as const, label: 'Case workspace', icon: BriefcaseBusiness },
  { id: 'tasks' as const, label: 'Task Center', icon: ClipboardCheck },
];

export function AppShell({
  cases,
  workspace,
  status,
  warnings,
  identity,
  role,
  onRoleChange,
  onSelectCase,
  onStartCase,
  caseStartStatus = 'idle',
  caseStartMessage = null,
  onRefresh,
  onUseDemoData,
  onLogin,
  onLogout,
  authLoading = false,
  authError,
  assistant,
  activityEvents,
  onOpenAssistant,
  taskCenter,
}: AppShellProps) {
  const [activeView, setActiveView] = useState<ShellView>('command');
  const [selectionIntent, setSelectionIntent] = useState<string | null>(null);
  const [pendingSelection, setPendingSelection] = useState<string | null>(null);
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const [recoveryPending, setRecoveryPending] = useState<RecoveryOperation | null>(null);
  const selectionRequest = useRef(0);
  const acceptedWorkspace = useRef<CaseWorkspaceSnapshot | null>(workspace);

  useEffect(() => {
    if (!selectionIntent || workspace?.case.id === selectionIntent) {
      acceptedWorkspace.current = workspace;
    }
  }, [selectionIntent, workspace]);

  const openCase = async (caseId: string) => {
    const request = ++selectionRequest.current;
    setSelectionIntent(caseId);
    setPendingSelection(caseId);
    setSelectionError(null);
    setRecoveryPending(null);
    setActiveView('workspace');
    try {
      await onSelectCase(caseId);
    } catch {
      if (request === selectionRequest.current) {
        setSelectionError(`Unable to open case ${caseId}.`);
      }
    } finally {
      if (request === selectionRequest.current) {
        setPendingSelection(null);
      }
    }
  };

  const runRecovery = async (operation: RecoveryOperation, action: () => void | Promise<void>) => {
    const request = ++selectionRequest.current;
    setSelectionIntent(null);
    setPendingSelection(null);
    setSelectionError(null);
    setRecoveryPending(operation);

    try {
      await action();
    } catch {
      if (request === selectionRequest.current) {
        setSelectionError(operation === 'refresh'
          ? 'Unable to refresh case data.'
          : 'Unable to load demo case data.');
      }
    } finally {
      if (request === selectionRequest.current) {
        setRecoveryPending(null);
      }
    }
  };

  const refreshCaseData = () => runRecovery('refresh', onRefresh);
  const useDemoCaseData = () => runRecovery('demo', onUseDemoData);
  const launchCase = async (input: { caseType: CaseType; requesterEmail: string }) => {
    if (!onStartCase) {
      throw new Error('Connect UiPath to start a case.');
    }

    const outcome = await onStartCase(input);
    if (outcome.status === 'registered') {
      selectionRequest.current += 1;
      setSelectionIntent(outcome.caseId);
      setPendingSelection(null);
      setSelectionError(null);
      setRecoveryPending(null);
      setActiveView('workspace');
    }
    return outcome;
  };
  const visibleWorkspace = selectionIntent
    && workspace?.case.id !== selectionIntent
    && acceptedWorkspace.current?.case.id === selectionIntent
    ? acceptedWorkspace.current
    : workspace;

  const sourceLabel = status === 'live'
    ? 'Live UiPath'
    : status === 'demo'
      ? 'Demo data'
      : status === 'error'
        ? 'Data unavailable'
        : 'Loading data';
  const compactSourceLabel = status === 'live'
    ? 'Live'
    : status === 'demo'
      ? 'Demo'
      : status === 'error'
        ? 'Error'
        : 'Loading';
  const sourceVariant = status === 'live' ? 'success' : status === 'error' ? 'error' : status === 'demo' ? 'info' : 'secondary';

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-slate-50 text-slate-950">
        <header className="sticky top-0 z-40 h-14 border-b border-slate-200 bg-white">
          <div data-testid="app-header-row" className="flex h-full max-w-full min-w-0 items-center gap-2 px-3 lg:px-4">
            <Sheet>
              <SheetTrigger asChild>
                <Button type="button" variant="ghost" size="icon" aria-label="Open navigation" className="shrink-0 lg:hidden">
                  <Menu aria-hidden="true" className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[min(88vw,320px)] p-0">
                <SheetHeader className="border-b border-slate-200 p-4 text-left">
                  <SheetTitle>Program Integrity 360</SheetTitle>
                  <SheetDescription>Case-management navigation</SheetDescription>
                </SheetHeader>
                <div className="flex items-start gap-3 border-b border-slate-200 p-4">
                  <CircleUserRound aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-slate-900">{identity.name}</div>
                    <div className="mt-0.5 truncate text-xs text-slate-500">
                      {identity.isAuthenticated ? identity.email ?? 'UiPath authenticated' : 'Local demo session'}
                    </div>
                    <Badge variant={sourceVariant} className="mt-2 w-fit gap-1">
                      <Database aria-hidden="true" className="h-3.5 w-3.5" />
                      {sourceLabel}
                    </Badge>
                  </div>
                </div>
                <div className="p-3">
                  <MobileNavigation activeView={activeView} onNavigate={setActiveView} showTaskCenter={Boolean(taskCenter)} />
                  <Button
                    type="button"
                    variant="ghost"
                    className="mt-1 w-full justify-start gap-2"
                    aria-label="Refresh case data"
                    onClick={() => void refreshCaseData()}
                  >
                    <RefreshCw aria-hidden="true" className="h-4 w-4" />
                    Refresh case data
                  </Button>
                  <div className="mt-5 border-t border-slate-200 pt-4">
                    <RoleControl role={role} onRoleChange={onRoleChange} />
                    <AuthorityNotice />
                  </div>
                </div>
              </SheetContent>
            </Sheet>

            <img src={logoUrl} alt="UiPath" className="hidden h-7 w-7 shrink-0 object-contain min-[360px]:block" />
            <div className="hidden min-w-0 flex-1 min-[480px]:block">
              <div className="truncate text-sm font-semibold text-slate-950 sm:text-base">Program Integrity 360</div>
            </div>

            <Badge aria-label={sourceLabel} variant={sourceVariant} className="ml-auto flex min-w-0 shrink-0 gap-1">
              <Database aria-hidden="true" className="h-3.5 w-3.5" />
              <span className="sm:hidden">{compactSourceLabel}</span>
              <span className="hidden sm:inline">{sourceLabel}</span>
            </Badge>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Refresh case data"
                  className="hidden shrink-0 min-[400px]:inline-flex"
                  onClick={() => void refreshCaseData()}
                >
                  <RefreshCw aria-hidden="true" className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Refresh case data</TooltipContent>
            </Tooltip>

            {onOpenAssistant && !assistant && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button type="button" variant="ghost" size="icon" aria-label="Open record assistant" className="shrink-0" onClick={onOpenAssistant}>
                    <PanelRightOpen aria-hidden="true" className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Open record assistant</TooltipContent>
              </Tooltip>
            )}

            {identity.isAuthenticated ? (
              <div className="hidden min-w-0 items-center gap-2 border-l border-slate-200 pl-3 md:flex">
                <CircleUserRound aria-hidden="true" className="h-5 w-5 shrink-0 text-slate-500" />
                <div className="min-w-0">
                  <div className="max-w-48 truncate text-xs font-semibold text-slate-800">{identity.name}</div>
                  <div className="truncate text-[11px] text-slate-500">{identity.email ?? 'UiPath authenticated'}</div>
                </div>
                {onLogout && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button type="button" variant="ghost" size="icon" aria-label="Sign out" onClick={onLogout}>
                        <LogOut aria-hidden="true" className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Sign out</TooltipContent>
                  </Tooltip>
                )}
              </div>
            ) : onLogin ? (
              <Button type="button" size="sm" variant="outline" disabled={authLoading} onClick={() => void onLogin()}>
                <LogIn aria-hidden="true" className="h-4 w-4" />
                <span className="hidden sm:inline">Connect UiPath</span>
              </Button>
            ) : (
              <div className="hidden min-w-0 items-center gap-2 border-l border-slate-200 pl-3 md:flex">
                <CircleUserRound aria-hidden="true" className="h-5 w-5 shrink-0 text-slate-500" />
                <div className="max-w-48 truncate text-xs font-semibold text-slate-800">{identity.name}</div>
              </div>
            )}
          </div>
        </header>

        <div className={assistant ? 'lg:grid lg:grid-cols-[208px_minmax(0,1fr)] xl:grid-cols-[208px_minmax(0,1fr)_320px]' : 'lg:grid lg:grid-cols-[208px_minmax(0,1fr)]'}>
          <aside className="hidden min-h-[calc(100vh-56px)] w-52 border-r border-slate-200 bg-white lg:flex lg:flex-col">
            <DesktopNavigation activeView={activeView} onNavigate={setActiveView} showTaskCenter={Boolean(taskCenter)} />
            <div className="mt-auto border-t border-slate-200 p-3">
              <RoleControl role={role} onRoleChange={onRoleChange} />
              <AuthorityNotice />
            </div>
          </aside>

          <main className="min-w-0 px-3 py-4 sm:px-5 lg:px-6">
            {warnings.length > 0 && status !== 'error' && !selectionError && !recoveryPending && (
              <Alert className="mb-4">
                <TriangleAlert aria-hidden="true" className="h-4 w-4" />
                <AlertTitle>Data source notice</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc space-y-1 pl-4">
                    {warnings.map((warning) => <li key={warning}>{warning}</li>)}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {authError && (
              <Alert variant="destructive" className="mb-4">
                <TriangleAlert aria-hidden="true" className="h-4 w-4" />
                <AlertTitle>UiPath connection failed</AlertTitle>
                <AlertDescription>{authError}</AlertDescription>
              </Alert>
            )}

            <ShellContent
              activeView={activeView}
              cases={cases}
              workspace={visibleWorkspace}
              status={status}
              warnings={warnings}
              role={role}
              identity={identity}
              onStartCase={launchCase}
              caseStartStatus={caseStartStatus}
              caseStartMessage={caseStartMessage}
              selectionIntent={selectionIntent}
              pendingSelection={pendingSelection}
              selectionError={selectionError}
              recoveryPending={recoveryPending}
              onSelectCase={openCase}
              onRefresh={refreshCaseData}
              onUseDemoData={useDemoCaseData}
              taskCenter={taskCenter}
              activityEvents={activityEvents}
            />
          </main>

          {assistant && (
            <aside aria-label="Assistant" className="fixed bottom-0 right-0 top-14 z-30 w-[min(320px,100vw)] min-w-0 border-l border-slate-200 bg-white shadow-xl xl:static xl:z-auto xl:min-h-[calc(100vh-56px)] xl:w-auto xl:shadow-none">
              {assistant}
            </aside>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}

type ShellContentProps = Pick<AppShellProps, 'cases' | 'workspace' | 'status' | 'warnings' | 'role' | 'identity' | 'onRefresh' | 'onUseDemoData' | 'taskCenter' | 'activityEvents' | 'caseStartStatus' | 'caseStartMessage'> & {
  activeView: ShellView;
  selectionIntent: string | null;
  pendingSelection: string | null;
  selectionError: string | null;
  recoveryPending: RecoveryOperation | null;
  onSelectCase: (caseId: string) => void | Promise<void>;
  onStartCase: (input: { caseType: CaseType; requesterEmail: string }) => Promise<CaseStartOutcome>;
};

function ShellContent({
  activeView,
  cases,
  workspace,
  status,
  warnings,
  role,
  identity,
  selectionIntent,
  pendingSelection,
  selectionError,
  recoveryPending,
  onSelectCase,
  onStartCase,
  caseStartStatus,
  caseStartMessage,
  onRefresh,
  onUseDemoData,
  taskCenter,
  activityEvents,
}: ShellContentProps) {
  if (selectionError) {
    return (
      <TerminalDataError
        messages={[selectionError]}
        onRefresh={onRefresh}
        onUseDemoData={onUseDemoData}
      />
    );
  }

  if (recoveryPending) {
    return <WorkspaceSkeleton label={recoveryPending === 'refresh' ? 'Refreshing case data' : 'Loading demo case data'} />;
  }

  if (status === 'error') {
    return (
      <TerminalDataError
        messages={warnings}
        onRefresh={onRefresh}
        onUseDemoData={onUseDemoData}
      />
    );
  }

  if (activeView === 'command' && pendingSelection) {
    return (
      <CommandCenter
        cases={cases}
        selectedCaseId={workspace?.case.id}
        identityEmail={identity.email}
        isAuthenticated={identity.isAuthenticated}
        caseStartStatus={caseStartStatus}
        caseStartMessage={caseStartMessage}
        onStartCase={onStartCase}
        onSelectCase={onSelectCase}
      />
    );
  }

  if (pendingSelection) {
    return <WorkspaceSkeleton label={`Loading case ${pendingSelection}`} />;
  }

  if (status === 'idle' || status === 'loading') {
    return activeView === 'command'
      ? <CommandCenterSkeleton />
      : <WorkspaceSkeleton label="Loading case workspace" />;
  }

  if (activeView === 'tasks' && taskCenter) {
    return taskCenter;
  }

  if (activeView === 'command') {
    return (
      <CommandCenter
        cases={cases}
        selectedCaseId={workspace?.case.id}
        identityEmail={identity.email}
        isAuthenticated={identity.isAuthenticated}
        caseStartStatus={caseStartStatus}
        caseStartMessage={caseStartMessage}
        onStartCase={onStartCase}
        onSelectCase={onSelectCase}
      />
    );
  }

  if (!workspace) {
    return <EmptyState label="No case selected" detail="Select a case from Command center to open its workspace." icon={FolderOpen} />;
  }

  if (selectionIntent && workspace.case.id !== selectionIntent) {
    return <EmptyState label="Selected case unavailable" detail={`The workspace for ${selectionIntent} is not available.`} icon={FolderOpen} />;
  }

  return <CaseWorkspace workspace={workspace} role={role} activityEvents={activityEvents} />;
}

function TerminalDataError({
  messages,
  onRefresh,
  onUseDemoData,
}: {
  messages: readonly string[];
  onRefresh: AppShellProps['onRefresh'];
  onUseDemoData: AppShellProps['onUseDemoData'];
}) {
  return (
    <Alert variant="destructive">
      <TriangleAlert aria-hidden="true" className="h-4 w-4" />
      <AlertTitle>Case data unavailable</AlertTitle>
      <AlertDescription>
        <ul className="list-disc space-y-1 pl-4">
          {(messages.length > 0 ? messages : ['The current data source did not return a usable case workspace.'])
            .map((message) => <li key={message}>{message}</li>)}
        </ul>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="button" size="sm" onClick={() => void onRefresh()}>Retry</Button>
          <Button type="button" size="sm" variant="outline" onClick={() => void onUseDemoData()}>Use demo data</Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}

function EmptyState({ label, detail, icon: Icon }: { label: string; detail: string; icon: typeof Inbox }) {
  return (
    <section role="status" aria-label={label} className="border-y border-slate-200 bg-white px-4 py-10 text-center">
      <Icon aria-hidden="true" className="mx-auto h-6 w-6 text-slate-400" />
      <h1 className="mt-3 text-base font-semibold text-slate-900">{label}</h1>
      <p className="mt-1 text-sm text-slate-500">{detail}</p>
    </section>
  );
}

function CommandCenterSkeleton() {
  return (
    <section role="status" aria-label="Loading command center" className="space-y-4">
      <span className="sr-only">Loading command center</span>
      <Skeleton className="h-7 w-48" />
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-64 w-full" />
    </section>
  );
}

function DesktopNavigation({ activeView, onNavigate, showTaskCenter }: { activeView: ShellView; onNavigate: (view: ShellView) => void; showTaskCenter: boolean }) {
  return (
    <nav aria-label="Primary navigation" className="space-y-1 p-3">
      {navigation.filter((item) => item.id !== 'tasks' || showTaskCenter).map((item) => {
        const Icon = item.icon;
        const active = activeView === item.id;
        return (
          <Button
            key={item.id}
            type="button"
            variant={active ? 'secondary' : 'ghost'}
            className="h-9 w-full justify-start gap-2 px-2 text-sm"
            aria-current={active ? 'page' : undefined}
            onClick={() => onNavigate(item.id)}
          >
            <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
            <span className="truncate">{item.label}</span>
          </Button>
        );
      })}
    </nav>
  );
}

function MobileNavigation({ activeView, onNavigate, showTaskCenter }: { activeView: ShellView; onNavigate: (view: ShellView) => void; showTaskCenter: boolean }) {
  return (
    <nav aria-label="Mobile navigation" className="space-y-1">
      {navigation.filter((item) => item.id !== 'tasks' || showTaskCenter).map((item) => {
        const Icon = item.icon;
        return (
          <SheetClose asChild key={item.id}>
            <Button type="button" variant={activeView === item.id ? 'secondary' : 'ghost'} className="w-full justify-start gap-2" onClick={() => onNavigate(item.id)}>
              <Icon aria-hidden="true" className="h-4 w-4" />
              {item.label}
            </Button>
          </SheetClose>
        );
      })}
    </nav>
  );
}

function RoleControl({ role, onRoleChange }: { role: DemoRole; onRoleChange: (role: DemoRole) => void }) {
  return (
    <div>
      <div className="mb-2 text-xs font-semibold text-slate-600">Presentation role</div>
      <ToggleGroup
        type="single"
        value={role}
        onValueChange={(value) => {
          if (value === 'investigator' || value === 'supervisor') onRoleChange(value);
        }}
        aria-label="Presentation role"
        className="grid grid-cols-2"
      >
        <ToggleGroupItem value="investigator" aria-label="Investigator" className="text-xs">Investigator</ToggleGroupItem>
        <ToggleGroupItem value="supervisor" aria-label="Supervisor" className="text-xs">Supervisor</ToggleGroupItem>
      </ToggleGroup>
    </div>
  );
}

function AuthorityNotice() {
  return (
    <div className="mt-3 flex gap-2 text-[11px] leading-4 text-slate-500">
      <ShieldCheck aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>Role changes presentation only. UiPath permissions remain authoritative.</span>
    </div>
  );
}

function WorkspaceSkeleton({ label }: { label: string }) {
  return (
    <section role="status" aria-label={label} className="space-y-4">
      <span className="sr-only">{label}</span>
      <Skeleton className="h-7 w-48" />
      <Skeleton className="h-4 w-full max-w-xl" />
      <div className="flex gap-2 overflow-hidden border-y border-slate-200 py-3">
        {Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-40 w-[196px] min-w-[196px]" />)}
      </div>
      <Skeleton className="h-64 w-full" />
    </section>
  );
}

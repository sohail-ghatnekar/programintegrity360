import { useState } from 'react';
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
  CircleUserRound,
  Database,
  LayoutDashboard,
  LogIn,
  LogOut,
  Menu,
  RefreshCw,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react';
import logoUrl from '../assets/uipath-logo-png_seeklogo-618304.png';
import { CaseWorkspace } from '../features/cases/CaseWorkspace';
import { CommandCenter } from '../features/cases/CommandCenter';
import type { CaseSummary, CaseWorkspaceSnapshot, DemoRole } from '../features/cases/types';
import type { CaseWorkspaceStatus } from '../features/cases/useCaseWorkspace';

type ShellView = 'command' | 'workspace';

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
  onRefresh: () => void | Promise<void>;
  onUseDemoData: () => void | Promise<void>;
  onLogin?: () => void | Promise<void>;
  onLogout?: () => void;
  authLoading?: boolean;
  authError?: string | null;
  assistant?: ReactNode;
};

const navigation = [
  { id: 'command' as const, label: 'Command center', icon: LayoutDashboard },
  { id: 'workspace' as const, label: 'Case workspace', icon: BriefcaseBusiness },
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
  onRefresh,
  onUseDemoData,
  onLogin,
  onLogout,
  authLoading = false,
  authError,
  assistant,
}: AppShellProps) {
  const [activeView, setActiveView] = useState<ShellView>('command');

  const openCase = (caseId: string) => {
    setActiveView('workspace');
    void onSelectCase(caseId);
  };

  const sourceLabel = status === 'live'
    ? 'Live UiPath'
    : status === 'demo'
      ? 'Demo data'
      : status === 'error'
        ? 'Data unavailable'
        : 'Loading data';
  const sourceVariant = status === 'live' ? 'success' : status === 'error' ? 'error' : status === 'demo' ? 'info' : 'secondary';

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-slate-50 text-slate-950">
        <header className="sticky top-0 z-40 h-14 border-b border-slate-200 bg-white">
          <div className="flex h-full min-w-0 items-center gap-2 px-3 lg:px-4">
            <Sheet>
              <SheetTrigger asChild>
                <Button type="button" variant="ghost" size="icon" aria-label="Open navigation" className="lg:hidden">
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
                  <MobileNavigation activeView={activeView} onNavigate={setActiveView} />
                  <div className="mt-5 border-t border-slate-200 pt-4">
                    <RoleControl role={role} onRoleChange={onRoleChange} />
                    <AuthorityNotice />
                  </div>
                </div>
              </SheetContent>
            </Sheet>

            <img src={logoUrl} alt="UiPath" className="h-7 w-7 shrink-0 object-contain" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-slate-950 sm:text-base">Program Integrity 360</div>
            </div>

            <Badge variant={sourceVariant} className="flex shrink-0 gap-1">
              <Database aria-hidden="true" className="h-3.5 w-3.5" />
              {sourceLabel}
            </Badge>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button type="button" variant="ghost" size="icon" aria-label="Refresh case data" onClick={() => void onRefresh()}>
                  <RefreshCw aria-hidden="true" className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Refresh case data</TooltipContent>
            </Tooltip>

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
            <DesktopNavigation activeView={activeView} onNavigate={setActiveView} />
            <div className="mt-auto border-t border-slate-200 p-3">
              <RoleControl role={role} onRoleChange={onRoleChange} />
              <AuthorityNotice />
            </div>
          </aside>

          <main className="min-w-0 px-3 py-4 sm:px-5 lg:px-6">
            {warnings.length > 0 && (
              <Alert variant={status === 'error' ? 'destructive' : 'default'} className="mb-4">
                <TriangleAlert aria-hidden="true" className="h-4 w-4" />
                <AlertTitle>{status === 'error' ? 'Case data unavailable' : 'Data source notice'}</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc space-y-1 pl-4">
                    {warnings.map((warning) => <li key={warning}>{warning}</li>)}
                  </ul>
                  {status === 'error' && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button type="button" size="sm" onClick={() => void onRefresh()}>Retry</Button>
                      <Button type="button" size="sm" variant="outline" onClick={() => void onUseDemoData()}>Use demo data</Button>
                    </div>
                  )}
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

            {activeView === 'command' ? (
              <CommandCenter cases={cases} selectedCaseId={workspace?.case.id} onSelectCase={openCase} />
            ) : workspace ? (
              <CaseWorkspace workspace={workspace} role={role} />
            ) : (
              <WorkspaceSkeleton />
            )}
          </main>

          {assistant && (
            <aside aria-label="Assistant" className="hidden min-h-[calc(100vh-56px)] min-w-0 border-l border-slate-200 bg-white xl:block">
              {assistant}
            </aside>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}

function DesktopNavigation({ activeView, onNavigate }: { activeView: ShellView; onNavigate: (view: ShellView) => void }) {
  return (
    <nav aria-label="Primary navigation" className="space-y-1 p-3">
      {navigation.map((item) => {
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

function MobileNavigation({ activeView, onNavigate }: { activeView: ShellView; onNavigate: (view: ShellView) => void }) {
  return (
    <nav aria-label="Mobile navigation" className="space-y-1">
      {navigation.map((item) => {
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

function WorkspaceSkeleton() {
  return (
    <section aria-label="Loading case workspace" className="space-y-4">
      <Skeleton className="h-7 w-48" />
      <Skeleton className="h-4 w-full max-w-xl" />
      <div className="flex gap-2 overflow-hidden border-y border-slate-200 py-3">
        {Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-40 w-[196px] min-w-[196px]" />)}
      </div>
      <Skeleton className="h-64 w-full" />
    </section>
  );
}

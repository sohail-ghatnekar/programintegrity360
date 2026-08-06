# Program Integrity 360 Coded App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and deploy an OAuth-enabled, live-first Program Integrity case-management workbench with six-stage visibility, investigator and supervisor views, live Action Center task completion, and an embedded conversational agent.

**Architecture:** Split the current 947-line static application into typed domain models, live and demo repositories, focused feature components, and a small composition root. UiPath SDK services provide live cases, stages, execution history, tasks, and agent conversations; the deterministic demo adapter provides the identical view model when live data is unavailable. Action Center is embedded only in a task drawer and completion is confirmed through API polling.

**Tech Stack:** React 19, TypeScript 5.8, Vite 7, `@uipath/uipath-typescript`, `@uipath/apollo-wind` 2.32+, Lucide React, Vitest, Testing Library, Playwright, OAuth 2.0 Authorization Code with PKCE.

## Global Constraints

- Modify only `ProgramIntegrity360/PI360CodedApp` plus repository documentation and Git metadata.
- Use the Apollo Wind package and Apollo Vertex design principles from `https://github.com/UiPath/apollo-ui`.
- The two demo-switchable roles are `investigator` and `supervisor`; switching roles never bypasses UiPath permissions.
- Mirror exactly six case stages: Alert intake and triage, Evidence acquisition and validation, Investigation and case management, Provider response, Supervisor review and approval, Closure and monitoring.
- Use live UiPath data first and clearly label deterministic fallback data as `Demo data`.
- The Action Center task page is the only external iframe.
- Never claim a task is complete until the Tasks API returns `Completed`.
- Use `base: './'` and `getAppBase()`-safe deployed paths.
- Do not handle, print, or persist access tokens manually.
- Run `npm test` after every JavaScript or TypeScript behavior change and before every task commit.
- Do not perform a UiPath push, publish, deploy, solution uninstall, or folder deletion without explicit user approval.
- Target staging org `uipathlabs`, tenant `Playground`, folder `AMER Presales/Public Sector/ProgramIntegrity360 1`, folder key `25fea2ac-3f4e-4f6f-a7f6-a3cab1b92be4`.

---

### Task 1: Repository And Test Foundation

**Files:**
- Create: `.gitignore`
- Modify: `ProgramIntegrity360/PI360CodedApp/package.json`
- Modify: `ProgramIntegrity360/PI360CodedApp/package-lock.json`
- Create: `ProgramIntegrity360/PI360CodedApp/vitest.config.ts`
- Create: `ProgramIntegrity360/PI360CodedApp/src/test/setup.ts`
- Create: `ProgramIntegrity360/PI360CodedApp/src/test/smoke.test.ts`
- Create: `ProgramIntegrity360/PI360CodedApp/playwright.config.ts`
- Modify: `ProgramIntegrity360/PI360CodedApp/src/components/ClaimsDashboard.tsx` (only the existing lint-blocking declaration)

**Interfaces:**
- Consumes: existing Vite application and npm lockfile.
- Produces: `npm test`, `npm run lint`, and `npm run test:e2e` commands used by every later task.

- [ ] **Step 1: Initialize Git at the repository root**

Run:

```bash
git init -b main
git remote add origin https://github.com/sohail-ghatnekar/programintegrity360.git
```

Verify:

```bash
git remote -v
git ls-remote origin
```

Expected: `origin` points at the requested repository and `ls-remote` returns no refs before the first push.

- [ ] **Step 2: Add repository exclusions**

Create `.gitignore` with:

```gitignore
.DS_Store
**/node_modules/
**/dist/
**/.env
**/.env.*
!**/.env.example
**/.uipath/
**/.local/
**/__pycache__/
**/*.pyc
**/*.log
**/*.nupkg
**/.playwright-mcp/
ProgramIntegrity360/.solution-packages/
*.uis
```

- [ ] **Step 3: Install the design and test dependencies**

Run in `ProgramIntegrity360/PI360CodedApp`:

```bash
npm install @uipath/apollo-wind lucide-react
npm install --save-dev vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event @playwright/test
```

Change scripts to:

```json
{
  "test": "vitest run",
  "test:watch": "vitest",
  "test:e2e": "playwright test",
  "build": "tsc -b && vite build && node scripts/prepare-codedapp-index.mjs",
  "lint": "eslint ."
}
```

- [ ] **Step 4: Configure component tests**

Create `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: true,
  },
});
```

Create `src/test/setup.ts`:

```ts
import '@testing-library/jest-dom/vitest';
```

Create `src/test/smoke.test.ts` with one focused assertion that proves the jsdom environment and Testing Library matcher setup are active. This gives `npm test` a meaningful green baseline without weakening Vitest's empty-suite behavior.

- [ ] **Step 5: Configure visual tests**

Create `playwright.config.ts`:

```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } } },
    { name: 'mobile', use: { ...devices['iPhone 13'], viewport: { width: 390, height: 844 } } },
  ],
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4173',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: true,
  },
});
```

- [ ] **Step 6: Verify and commit the foundation**

Run:

```bash
npm test
npm run lint
npm run build
git add .
git commit -m "chore: initialize PI360 coded app repository"
```

Expected: all commands pass and the task is committed on the isolated feature branch. The repository baseline was pushed to `origin/main` before isolated execution; Task 8 integrates and pushes the reviewed implementation to `main`.

---

### Task 2: Typed Case Model And Demo Repository

**Files:**
- Create: `ProgramIntegrity360/PI360CodedApp/src/features/cases/types.ts`
- Create: `ProgramIntegrity360/PI360CodedApp/src/features/cases/stages.ts`
- Create: `ProgramIntegrity360/PI360CodedApp/src/features/cases/demoCase.ts`
- Create: `ProgramIntegrity360/PI360CodedApp/src/features/cases/demoRepository.ts`
- Create: `ProgramIntegrity360/PI360CodedApp/src/features/cases/demoRepository.test.ts`
- Modify: `ProgramIntegrity360/PI360CodedApp/src/App.tsx`

**Interfaces:**
- Produces: `CaseWorkspaceModel`, `CaseStageModel`, `CaseTaskModel`, `ActivityEvent`, `CaseRepository`, `STAGE_DEFINITIONS`, and `createDemoCaseWorkspace()`.
- Consumes: no live services.

- [ ] **Step 1: Write failing model tests**

Test that `createDemoCaseWorkspace()` returns data source `demo`, exactly six ordered stages, case ID `PI-PCS-2026-0041`, both action tasks, and a non-empty execution timeline.

```ts
expect(workspace.stages.map(stage => stage.key)).toEqual([
  'intake',
  'evidence',
  'investigation',
  'provider-response',
  'supervisor-review',
  'closure',
]);
```

- [ ] **Step 2: Verify the tests fail**

Run `npm test -- demoRepository.test.ts`.

Expected: FAIL because the repository and types do not exist.

- [ ] **Step 3: Define stable view-model contracts**

Define these exact discriminators:

```ts
export type DemoRole = 'investigator' | 'supervisor';
export type DataSource = 'live' | 'demo';
export type StageStatus = 'not-started' | 'active' | 'waiting' | 'completed' | 'faulted';
export type TaskStatus = 'Unassigned' | 'Pending' | 'Completed';

export interface CaseRepository {
  listCases(): Promise<CaseSummary[]>;
  loadWorkspace(caseId: string): Promise<CaseWorkspaceModel>;
  refreshTasks(caseId: string): Promise<{ caseTasks: CaseTaskModel[]; folderTasks: CaseTaskModel[] }>;
}
```

Each model includes source identifiers and timestamps needed for transparency. `CaseTaskModel` includes numeric `id`, numeric `folderId`, type, title, priority, assignee, status, stage label, and Action Center URL.

- [ ] **Step 4: Extract the deterministic record**

Move current provider, attendant, claims, evidence, risks, decisions, tasks, and timeline constants from `App.tsx` into `demoCase.ts`. Replace the nine labels with the six canonical stages and preserve the current case narrative.

- [ ] **Step 5: Implement the demo repository**

`createDemoCaseWorkspace()` returns a deep, immutable view model and never mutates module constants. `DemoCaseRepository.refreshTasks()` returns the current demo tasks without simulating a live completion.

- [ ] **Step 6: Verify and commit**

Run:

```bash
npm test
npm run lint
npm run build
git add ProgramIntegrity360/PI360CodedApp/src
git commit -m "refactor: define PI360 case workspace model"
```

---

### Task 3: OAuth Session And Runtime Configuration

**Files:**
- Modify: `ProgramIntegrity360/PI360CodedApp/uipath.json`
- Modify: `ProgramIntegrity360/PI360CodedApp/vite.config.ts`
- Modify: `ProgramIntegrity360/PI360CodedApp/src/config/uipath.ts`
- Modify: `ProgramIntegrity360/PI360CodedApp/src/hooks/useAuth.tsx`
- Create: `ProgramIntegrity360/PI360CodedApp/src/config/uipath.test.ts`
- Create: `ProgramIntegrity360/PI360CodedApp/src/hooks/useAuth.test.tsx`

**Interfaces:**
- Produces: `UiPathRuntimeConfig`, `getUiPathRuntimeConfig()`, and `AuthContextType` with `isAuthenticated`, identity, `login`, `logout`, and initialized `sdk`.
- Consumes: UiPath-injected runtime metadata and local `uipath.json` defaults.

- [ ] **Step 1: Write failing OAuth tests**

Cover:

```ts
it('does not clear a valid SDK session on a normal refresh', async () => {
  const sdk = createSdkMock({ authenticated: true, callback: false });
  renderAuthProvider(sdk);
  await waitFor(() => expect(screen.getByTestId('auth-state')).toHaveTextContent('authenticated'));
  expect(sessionStorage.removeItem).not.toHaveBeenCalled();
});

it('completes an OAuth callback once and removes code parameters', async () => {
  history.replaceState({}, '', '/?code=abc&state=xyz');
  const sdk = createSdkMock({ authenticated: true, callback: true });
  renderAuthProvider(sdk);
  await waitFor(() => expect(sdk.completeOAuth).toHaveBeenCalledTimes(1));
  expect(location.search).toBe('');
});

it('reports missing local client ID without exposing credentials', () => {
  const setup = getUiPathAuthSetup({ clientId: '', orgName: 'uipathlabs', tenantName: 'Playground' });
  expect(setup.missingFields).toContain('VITE_UIPATH_CLIENT_ID');
  expect(JSON.stringify(setup)).not.toContain('access_token');
});
```

Add an optional `sdkFactory` prop to `AuthProvider` for dependency injection in tests; production defaults to `(config) => new UiPath(config)`.

- [ ] **Step 2: Verify the tests fail**

Run `npm test -- useAuth.test.tsx uipath.test.ts`.

Expected: the refresh test fails because the current provider clears the SDK token whenever no `code` query parameter is present.

- [ ] **Step 3: Extend runtime configuration**

Add these non-secret defaults to `uipath.json`:

```json
{
  "orgName": "uipathlabs",
  "tenantName": "Playground",
  "baseUrl": "https://staging.api.uipath.com",
  "folderPath": "AMER Presales/Public Sector/ProgramIntegrity360 1",
  "folderKey": "25fea2ac-3f4e-4f6f-a7f6-a3cab1b92be4",
  "folderId": 3295396,
  "caseProcessName": "Program Integrity 360 Case",
  "recordAgentName": "PI360RecordConversationAgent"
}
```

Keep `clientId` runtime-injected for deployment and local-environment supplied for development.

- [ ] **Step 4: Fix OAuth lifecycle behavior**

Only clear auth storage during explicit logout or when `completeOAuth()` fails with an invalid callback. Preserve a valid SDK session during ordinary initialization. After successful callback completion, call `history.replaceState` with the code and state parameters removed.

- [ ] **Step 5: Verify and commit**

Run:

```bash
npm test
npm run lint
npm run build
git add ProgramIntegrity360/PI360CodedApp
git commit -m "fix: preserve PI360 OAuth sessions"
```

---

### Task 4: Live UiPath Case And Task Repository

**Files:**
- Create: `ProgramIntegrity360/PI360CodedApp/src/services/uipath/collection.ts`
- Create: `ProgramIntegrity360/PI360CodedApp/src/services/uipath/actionCenterUrl.ts`
- Create: `ProgramIntegrity360/PI360CodedApp/src/services/uipath/liveCaseRepository.ts`
- Create: `ProgramIntegrity360/PI360CodedApp/src/services/uipath/liveCaseRepository.test.ts`
- Create: `ProgramIntegrity360/PI360CodedApp/src/services/uipath/actionCenterUrl.test.ts`
- Create: `ProgramIntegrity360/PI360CodedApp/src/features/cases/useCaseWorkspace.ts`

**Interfaces:**
- Produces: `itemsOf<T>()`, `buildActionCenterTaskUrl()`, `LiveCaseRepository`, and `useCaseWorkspace()`.
- Consumes: `UiPath`, runtime folder config, `Cases`, `CaseInstances`, and `Tasks` SDK services.

- [ ] **Step 1: Write failing repository tests**

Mock the SDK services and verify:

- Case discovery selects the configured Program Integrity process.
- Instance loading calls `getStages()`, `getActionTasks()`, and `getExecutionHistory()`.
- Folder tasks call `Tasks.getAll({ folderId: 3295396 })`.
- Unknown backend stage names map conservatively without dropping data.
- Partial service failure yields warnings while preserving the case workspace.

- [ ] **Step 2: Write failing task URL tests**

```ts
expect(buildActionCenterTaskUrl({
  portalOrigin: 'https://staging.uipath.com',
  organizationName: 'uipathlabs',
  tenantName: 'Playground',
  taskId: 123,
})).toBe('https://staging.uipath.com/uipathlabs/Playground/actions_/tasks/123');
```

- [ ] **Step 3: Verify failures**

Run `npm test -- liveCaseRepository.test.ts actionCenterUrl.test.ts`.

- [ ] **Step 4: Implement the repository**

Use constructor imports:

```ts
import { Cases, CaseInstances } from '@uipath/uipath-typescript/cases';
import { Tasks } from '@uipath/uipath-typescript/tasks';
```

Do not use deprecated SDK dot chains. Normalize array and paginated responses through `itemsOf<T>()`. Match the configured case name against `name`, `packageId`, and `processKey`, then select the most recently started non-completed instance before falling back to the most recent instance.

- [ ] **Step 5: Implement live-first orchestration**

`useCaseWorkspace()` exposes:

```ts
{
  cases,
  workspace,
  status: 'idle' | 'loading' | 'live' | 'demo' | 'error',
  warnings,
  refresh,
  useDemoData,
  selectCase,
}
```

An unauthenticated local session starts in demo mode. An authenticated failure shows retry before allowing explicit fallback.

- [ ] **Step 6: Verify and commit**

Run `npm test`, `npm run lint`, and `npm run build`, then commit as `feat: connect PI360 cases and tasks`.

---

### Task 5: Apollo Shell And Six-Stage Workbench

**Files:**
- Modify: `ProgramIntegrity360/PI360CodedApp/src/main.tsx`
- Replace: `ProgramIntegrity360/PI360CodedApp/src/App.tsx`
- Replace: `ProgramIntegrity360/PI360CodedApp/src/index.css`
- Create: `ProgramIntegrity360/PI360CodedApp/src/app/AppShell.tsx`
- Create: `ProgramIntegrity360/PI360CodedApp/src/app/AppShell.test.tsx`
- Create: `ProgramIntegrity360/PI360CodedApp/src/features/cases/CommandCenter.tsx`
- Create: `ProgramIntegrity360/PI360CodedApp/src/features/cases/CaseWorkspace.tsx`
- Create: `ProgramIntegrity360/PI360CodedApp/src/features/cases/StageJourney.tsx`
- Create: `ProgramIntegrity360/PI360CodedApp/src/features/cases/CaseOverview.tsx`
- Create: `ProgramIntegrity360/PI360CodedApp/src/features/cases/EvidenceWorkspace.tsx`
- Create: `ProgramIntegrity360/PI360CodedApp/src/features/cases/DecisionWorkspace.tsx`
- Create: `ProgramIntegrity360/PI360CodedApp/src/features/activity/ActivityTimeline.tsx`

**Interfaces:**
- Produces: the primary operational UI and `onSelectCase(caseId)`, `role`, and `onRoleChange(role)` component contracts.
- Consumes: `CaseWorkspaceModel`, `useCaseWorkspace()`, and Apollo Wind components.

- [ ] **Step 1: Write failing shell and role tests**

Verify the shell renders the signed-in identity, data-source badge, six stages, labeled navigation, and the role switch. Verify supervisor-only dispositions do not render in investigator mode.

- [ ] **Step 2: Verify tests fail**

Run `npm test -- AppShell.test.tsx`.

- [ ] **Step 3: Apply Apollo Wind**

Import `@uipath/apollo-wind/tailwind.css` once in `main.tsx`. Use Apollo `Button`, `Badge`, `Tabs`, `Progress`, `Table`, `Sheet`, `Alert`, `Skeleton`, `Tooltip`, and `ToggleGroup` primitives. Use Lucide icons for navigation and commands.

- [ ] **Step 4: Build the operational shell**

Use a 56px header, 208px labeled desktop navigation, flexible workspace, and optional 320px assistant panel. On mobile, use a compact header and sheet navigation. Do not nest cards; reserve bordered panels for individual work items and framed tools.

- [ ] **Step 5: Implement the six-stage journey**

Each stage has a stable width, status icon, task progress, and transparent route context. Completed, active, waiting, faulted, and not-started states must be distinguishable by icon and text, not color alone.

- [ ] **Step 6: Implement role-specific workspaces**

Investigator view exposes evidence, reconciliation, provider response, and investigator work. Supervisor view leads with approvals, exposure, escalations, and decision history. Both retain the full case timeline.

- [ ] **Step 7: Verify and commit**

Run `npm test`, `npm run lint`, and `npm run build`, then commit as `feat: build Apollo PI360 case workbench`.

---

### Task 6: Action Center Task Center And Iframe Drawer

**Files:**
- Create: `ProgramIntegrity360/PI360CodedApp/src/features/tasks/TaskCenter.tsx`
- Create: `ProgramIntegrity360/PI360CodedApp/src/features/tasks/TaskDrawer.tsx`
- Create: `ProgramIntegrity360/PI360CodedApp/src/features/tasks/useTaskPolling.ts`
- Create: `ProgramIntegrity360/PI360CodedApp/src/features/tasks/TaskCenter.test.tsx`
- Create: `ProgramIntegrity360/PI360CodedApp/src/features/tasks/useTaskPolling.test.ts`
- Modify: `ProgramIntegrity360/PI360CodedApp/src/App.tsx`

**Interfaces:**
- Produces: `TaskCenter({ caseTasks, folderTasks, onOpenTask })`, `TaskDrawer({ task, open, onClose, onCompleted })`, and `useTaskPolling()`.
- Consumes: `CaseTaskModel`, `Tasks.getById()`, and canonical task URLs.

- [ ] **Step 1: Write failing task-center tests**

Cover `This Case` and `Folder Inbox` tabs, status/type/priority filters, empty states, selected task, and disabled completion for completed tasks.

- [ ] **Step 2: Write failing polling tests**

Use fake timers. Verify polling every three seconds, one completion callback, stop on close, stop after two minutes, and retryable transient failures without falsely completing.

- [ ] **Step 3: Verify failures**

Run `npm test -- TaskCenter.test.tsx useTaskPolling.test.ts`.

- [ ] **Step 4: Implement the task center**

Render task rows with title, stage, type, priority, assignee, SLA, and status. Keep pagination finite and preserve selection when refreshing.

- [ ] **Step 5: Implement the iframe drawer**

Use an Apollo `Sheet` occupying up to `min(1120px, 96vw)`. Render task metadata above:

```tsx
<iframe
  title={`Action Center task ${task.id}`}
  src={task.actionCenterUrl}
  className="h-full min-h-[560px] w-full border-0"
  allow="clipboard-read; clipboard-write"
/>
```

The iframe is created only for a selected Action Center task. Include Refresh, Open in Action Center, and Close commands. The direct-link fallback remains visible because browser CSP failures cannot be reliably inspected cross-origin.

- [ ] **Step 6: Refresh after confirmed completion**

When polling returns `Completed`, announce completion through an accessible live region, call `onCompleted(task.id)`, refresh tasks/stages/timeline, and keep the completion status visible until the user closes the drawer.

- [ ] **Step 7: Verify and commit**

Run `npm test`, `npm run lint`, and `npm run build`, then commit as `feat: embed Action Center task completion`.

---

### Task 7: Conversational Agent And Unified Activity Log

**Files:**
- Move/modify: `ProgramIntegrity360/PI360CodedApp/src/components/RecordAssistantPanel.tsx` to `ProgramIntegrity360/PI360CodedApp/src/features/assistant/RecordAssistantPanel.tsx`
- Move/modify: `ProgramIntegrity360/PI360CodedApp/src/hooks/useProgramIntegrityRecordAgent.ts` to `ProgramIntegrity360/PI360CodedApp/src/features/assistant/useRecordAssistant.ts`
- Delete: `ProgramIntegrity360/PI360CodedApp/src/hooks/useProgramIntegrityRecordTasks.ts`
- Create: `ProgramIntegrity360/PI360CodedApp/src/features/activity/activityLog.ts`
- Create: `ProgramIntegrity360/PI360CodedApp/src/features/activity/activityLog.test.ts`
- Create: `ProgramIntegrity360/PI360CodedApp/src/features/assistant/RecordAssistantPanel.test.tsx`
- Modify: `ProgramIntegrity360/PI360CodedApp/src/App.tsx`

**Interfaces:**
- Produces: `ActivityLog`, `ActivityEvent`, `useRecordAssistant(workspace, open)`, and an Apollo embedded-copilot panel.
- Consumes: selected `CaseWorkspaceModel`, authenticated SDK, and `PI360RecordConversationAgent`.

- [ ] **Step 1: Write failing activity and assistant tests**

Verify generated correlation IDs, token/payload redaction, ordered event merging, agent discovery by configured name, session reset on case change, and grounding with stage/task/decision context.

- [ ] **Step 2: Verify failures**

Run `npm test -- activityLog.test.ts RecordAssistantPanel.test.tsx`.

- [ ] **Step 3: Implement structured activity logging**

Emit safe events shaped as:

```ts
interface ActivityEvent {
  id: string;
  timestamp: string;
  source: 'maestro' | 'task' | 'agent' | 'user' | 'app';
  severity: 'info' | 'warning' | 'error';
  status: string;
  summary: string;
  caseId?: string;
  taskId?: number;
  correlationId: string;
}
```

Never log access tokens, raw OAuth callbacks, or complete private record payloads.

- [ ] **Step 4: Refactor the assistant**

Use the configured agent name `PI360RecordConversationAgent`. Ground each new session with the normalized selected case. Keep suggested prompts editable, free text always available, and agent state visible. Remove the old synthetic create/complete-task helper because real tasks are completed through the Action Center drawer.

- [ ] **Step 5: Merge execution visibility**

Combine Maestro execution events, task transitions, agent state changes, fallback activation, and user decisions in `ActivityTimeline` sorted by timestamp with source/status filters.

- [ ] **Step 6: Verify and commit**

Run `npm test`, `npm run lint`, and `npm run build`, then commit as `feat: integrate PI360 record assistant and activity log`.

---

### Task 8: Responsive And End-To-End Verification

**Files:**
- Create: `ProgramIntegrity360/PI360CodedApp/e2e/workbench.spec.ts`
- Create: `ProgramIntegrity360/PI360CodedApp/e2e/task-drawer.spec.ts`
- Create: `ProgramIntegrity360/PI360CodedApp/e2e/assistant.spec.ts`
- Modify: `ProgramIntegrity360/PI360CodedApp/src/index.css`
- Modify: `ProgramIntegrity360/PI360CodedApp/README.md`

**Interfaces:**
- Consumes: the complete local app in deterministic demo mode.
- Produces: desktop/mobile regression coverage and concise operating documentation.

- [ ] **Step 1: Write Playwright tests**

Test desktop investigator, desktop supervisor, mobile case workspace, six-stage strip, task drawer with a stub task URL, and assistant open/close behavior. Assert that no critical control is clipped and no horizontal page overflow exists.

- [ ] **Step 2: Run component verification**

Run:

```bash
npm test
npm run lint
npm run build
```

- [ ] **Step 3: Run and inspect visual tests**

Run:

```bash
npx playwright install chromium
npm run test:e2e
```

Inspect screenshots at 1440x1000, 1024x768, and 390x844. Correct overlap, truncation, inaccessible focus, unstable dimensions, and blank iframe/panel states before proceeding.

- [ ] **Step 4: Update the concise README**

Document local prerequisites, `npm install`, `npm run dev`, required non-secret OAuth config names, test commands, live/demo behavior, and the deployment boundary. Do not include tokens or generated package metadata.

- [ ] **Step 5: Final local verification and commit**

Run `npm test`, `npm run lint`, `npm run build`, and `npm run test:e2e`, then commit as `test: verify PI360 coded app experience`.

- [ ] **Step 6: Push GitHub implementation**

Run:

```bash
git status --short
git log --oneline --decorate -8
git push origin main
```

Expected: clean tracked worktree except ignored generated artifacts, and GitHub `main` contains all implementation commits.

---

### Task 9: Approved UiPath Delivery And Folder Consolidation

**Files:**
- Generated after approval: `ProgramIntegrity360/PI360CodedApp/.uipath/app.config.json`
- Generated after approval: `ProgramIntegrity360/PI360CodedApp/.uipath/pi360-coded-app.<version>.nupkg`

**Interfaces:**
- Consumes: a passing production build and explicit user approval.
- Produces: deployed OAuth coded web app URL and one retained solution folder.

- [ ] **Step 1: Stop and request deployment approval**

Report the exact mutations:

1. Push `PI360CodedApp` source to Studio Web.
2. Pack and publish the next `pi360-coded-app` version as type `Web`.
3. Deploy it to folder key `25fea2ac-3f4e-4f6f-a7f6-a3cab1b92be4`.
4. Verify OAuth, live cases, stages, tasks, task iframe, polling, and agent chat.
5. Uninstall the obsolete solution deployment whose folder key is `298b6df0-eaa5-40a7-a93f-0b179fe7521c`, only after verification.

Do not continue without explicit approval.

- [ ] **Step 2: Reauthenticate and verify the target**

Run `uip login status --output json`. If expired, ask the user to complete `uip login --authority https://staging.uipath.com --tenant Playground`. Verify org `uipathlabs`, tenant `Playground`, target folder key, numeric folder ID, and available OAuth scopes.

- [ ] **Step 3: Execute the coded-app pipeline**

Run from `PI360CodedApp`:

```bash
npm test
npm run lint
npm run build
uip codedapp push
uip codedapp pack dist -n pi360-coded-app --version 0.4.0
uip codedapp publish
uip codedapp deploy -n pi360-coded-app --version 0.4.0 --folder-key 25fea2ac-3f4e-4f6f-a7f6-a3cab1b92be4
```

Before packaging, verify that `0.4.0` is unused. If cloud state shows that `0.4.0` already exists, stop and amend this plan and the commands to the next unused semantic version rather than republishing an existing version.

- [ ] **Step 4: Verify the live app**

Open the returned `appUrl` and verify OAuth callback persistence, live case selection, six stages, both role views, case and folder tasks, Action Center iframe/direct-link behavior, completion polling, and the conversational agent. Capture the deployed URL, app version, deployment ID, and folder path.

- [ ] **Step 5: Consolidate the solution folders**

List Program Integrity solution deployments and verify the newest active deployment remains on folder key `25fea2ac-3f4e-4f6f-a7f6-a3cab1b92be4`. Uninstall only the obsolete deployment tied to folder key `298b6df0-eaa5-40a7-a93f-0b179fe7521c`. Re-list folders and deployments to prove only `ProgramIntegrity360 1` remains.

- [ ] **Step 6: Report delivery evidence**

Report the live app URL, OAuth status, version, deployment ID, folder path/key, task iframe result, conversational-agent result, removed deployment key, and verification commands. Explicitly report any iframe CSP limitation or unavailable live case/task data.

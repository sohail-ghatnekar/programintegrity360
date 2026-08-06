# Task 5 Report: Apollo Shell And Six-Stage Workbench

## Result

Implemented the operational Program Integrity 360 shell and six-stage case workbench. The app now consumes `useCaseWorkspace()` and Task 3 identity, starts at a dense Command Center, opens a selected case into role-specific workspaces, and keeps data provenance and UiPath authorization boundaries visible.

No Task Center iframe or conversational-agent UI was added. `AppShell` exposes an optional 320px `assistant` React region that has no layout or visible placeholder until later work supplies real content.

## RED / GREEN

Initial focused RED:

```text
npm test -- AppShell.test.tsx
Test Files 1 failed (1)
Failed to resolve import "./AppShell" before implementation.
```

Focused implementation cycle:

```text
npm test -- AppShell.test.tsx
Test Files 1 passed (1)
Tests 5 passed (5)
```

Mobile sheet RED:

```text
npm test -- AppShell.test.tsx
Tests 1 failed | 5 passed
The open mobile sheet did not expose authenticated identity.
```

Final focused GREEN:

```text
npm test -- AppShell.test.tsx
Test Files 1 passed (1)
Tests 6 passed (6)
```

The first full-suite run also correctly identified that the legacy `App.test.tsx` mock did not provide the newly consumed `useAuth()` contract. The smoke test was updated to inject both auth and workspace contracts and to navigate from Command Center into the case workspace before asserting the six stages.

## Component Structure

- `App.tsx`: 58-line composition root for `AuthProvider`, `useAuth()`, `useCaseWorkspace()`, role state, and shell callbacks.
- `app/AppShell.tsx`: 56px header, 208px desktop navigation, mobile Apollo `Sheet`, identity, provenance, role control, warnings, login/logout, and optional 320px assistant extension region.
- `features/cases/CommandCenter.tsx`: metrics, paginated case queue, source labels, and `onSelectCase(caseId)`.
- `features/cases/CaseWorkspace.tsx`: case header, role summary, stage journey, and Apollo tabs.
- `features/cases/StageJourney.tsx`: six stable 196px stages with icon plus text state, linked-task progress, and route descriptions.
- `features/cases/CaseOverview.tsx`: provider, subject, ownership, and claims context.
- `features/cases/EvidenceWorkspace.tsx`: evidence confidence, validation state, provider response, and reconciliation exceptions.
- `features/cases/DecisionWorkspace.tsx`: investigator assessment or supervisor-only read-only disposition presentation plus decision history.
- `features/activity/ActivityTimeline.tsx`: complete human, system, and agent execution timeline.

## Apollo Imports Verified

Inspected installed `@uipath/apollo-wind` 2.32.1 before selecting imports:

- `package.json` exports the root module, `./tailwind.css`, and `./postcss`.
- `dist/index.d.ts` exports `Button`, `Badge`, `Tabs`, `Progress`, `Table`, `Sheet`, `Alert`, `Skeleton`, `Tooltip`, and `ToggleGroup` with their required subcomponents.
- Component declarations verified Button variants/sizes, Badge variants, Sheet sides, and ToggleGroup's Radix radio semantics.
- `README.md` documents the exact `@uipath/apollo-wind/tailwind.css` import and official Apollo PostCSS export.

The Tailwind CSS is imported once in `main.tsx`. `postcss.config.js` now uses the official Apollo PostCSS export so the installed Tailwind v4 Apollo stylesheet and application utilities compile together.

## Files

Created:

- `ProgramIntegrity360/PI360CodedApp/src/app/AppShell.tsx`
- `ProgramIntegrity360/PI360CodedApp/src/app/AppShell.test.tsx`
- `ProgramIntegrity360/PI360CodedApp/src/features/cases/CommandCenter.tsx`
- `ProgramIntegrity360/PI360CodedApp/src/features/cases/CaseWorkspace.tsx`
- `ProgramIntegrity360/PI360CodedApp/src/features/cases/StageJourney.tsx`
- `ProgramIntegrity360/PI360CodedApp/src/features/cases/CaseOverview.tsx`
- `ProgramIntegrity360/PI360CodedApp/src/features/cases/EvidenceWorkspace.tsx`
- `ProgramIntegrity360/PI360CodedApp/src/features/cases/DecisionWorkspace.tsx`
- `ProgramIntegrity360/PI360CodedApp/src/features/activity/ActivityTimeline.tsx`
- `.superpowers/sdd/2026-08-06-pi360-coded-app-implementation/task-5-report.md`

Modified:

- `ProgramIntegrity360/PI360CodedApp/src/main.tsx`
- `ProgramIntegrity360/PI360CodedApp/src/App.tsx`
- `ProgramIntegrity360/PI360CodedApp/src/App.test.tsx`
- `ProgramIntegrity360/PI360CodedApp/src/index.css`
- `ProgramIntegrity360/PI360CodedApp/postcss.config.js`
- `ProgramIntegrity360/PI360CodedApp/src/services/uipath/liveCaseRepository.ts`

The Task 4 repository edit is behavior-neutral: consuming `useCaseWorkspace()` from the compiled app exposed a pre-existing `erasableSyntaxOnly` error on a TypeScript constructor parameter property. It was converted to an explicit class field assignment so Task 5 can build without changing repository behavior.

## Final Verification

```text
npm test
Test Files 8 passed (8)
Tests 61 passed (61)

npm run lint
0 errors, 61 warnings

npm run build
TypeScript and Vite build passed; 5320 modules transformed.
dist/assets/index-BNrVV4kD.css 167.20 kB, gzip 26.59 kB
dist/assets/index-CkUwJNU8.js 551.90 kB, gzip 167.88 kB

git diff --check
Exit 0

curl -I http://127.0.0.1:5174/
HTTP/1.1 200 OK
```

The 61 lint warnings are pre-existing and outside Task 5 files. Vite retains its chunk-size advisory above 500 kB.

## Self-Review

- Confirmed the model remains immutable and UI components do not mutate workspace arrays or records.
- Confirmed exactly six stage items render and all five stage states use distinct icons and visible text, not color alone.
- Confirmed investigator presentation contains no supervisor disposition content.
- Confirmed supervisor dispositions are explicitly read-only presentation and point to the authorized UiPath task workflow instead of claiming execution works.
- Confirmed the role control states that it changes presentation only and that UiPath permissions remain authoritative.
- Confirmed source badges distinguish live, demo, loading, and error states.
- Confirmed identity and labeled navigation are available in both desktop shell and mobile sheet.
- Confirmed no gradients, decorative blobs, oversized hero, iframe, nested cards, Task Center placeholder, or active assistant placeholder was introduced.
- Confirmed Apollo progress bars have explicit ARIA values because the installed wrapper does not forward its visual `value` to the Radix root.
- Confirmed no cloud, publish, deploy, push, or external iframe operation was run.

## Concerns

1. No browser backend was available for screenshot inspection in this session. Automated component behavior, generated CSS utility presence, production build, and local HTTP serving were verified. Task 8 owns full Playwright desktop/mobile visual verification.
2. The production JavaScript chunk is 551.90 kB and retains Vite's existing advisory. Code splitting can be evaluated after Task Center and assistant boundaries are implemented.
3. The existing 61 lint warnings remain outside Task 5 scope.

## Fix Round 1

### Findings Addressed

- Case selection now records an explicit selection intent and pending request. The previous workspace is masked until the selected case resolves, stale request completions are ignored, and a mismatched returned workspace cannot render under the new intent.
- Loading, terminal error, stable command-center empty, and stable workspace empty states are mutually exclusive and have named status regions.
- Claims, evidence documents, reconciliation exceptions, decision history, and activity each provide an explicit accessible empty state.
- Stage lifecycle state and linked-task completion are independent. Visible task counts, `aria-valuetext`, and `aria-valuenow` are calculated from the same task records.
- A compact read-only role work queue exposes existing case and folder task records by gated role, including status, stage, SLA, and assignee. Supervisor dispositions render only with an actual gated supervisor task record and remain non-actionable in this task.
- The 320px header now has explicit `min-w-0`/`max-w-full` containment, compact provenance labels, responsive brand/logo visibility, and a header refresh breakpoint. Refresh remains available in the mobile navigation sheet. Global horizontal overflow clipping was removed.

### RED And GREEN

Delayed selection and shell-state RED:

```text
npm test -- AppShell.test.tsx
Test Files 1 failed (1)
Tests 3 failed | 6 passed (9)
Failures: delayed replacement rendered the prior workspace; loading/error/empty states were not exclusive; stable empty workspace fell through to loading.
```

Shell-state GREEN:

```text
npm test -- AppShell.test.tsx
Test Files 1 passed (1)
Tests 9 passed (9)
```

Empty sections and progress RED:

```text
npm test -- AppShell.test.tsx
Test Files 1 failed (1)
Tests 2 failed | 9 passed (11)
Failures: completed lifecycle forced aria-valuenow=100 for a pending task; claims had no named empty status.
```

Empty sections and progress GREEN:

```text
npm test -- AppShell.test.tsx
Test Files 1 passed (1)
Tests 11 passed (11)
```

Role records RED:

```text
npm test -- AppShell.test.tsx
Test Files 1 failed (1)
Tests 2 failed | 11 passed (13)
Failures: no investigator/supervisor work queue regions and no empty supervisor task gate.
```

Role records GREEN:

```text
npm test -- AppShell.test.tsx
Test Files 1 passed (1)
Tests 13 passed (13)
```

Mobile header RED:

```text
npm test -- AppShell.test.tsx
Test Files 1 failed (1)
Tests 1 failed | 13 passed (14)
Failure: no explicit shrink-safe header contract or compact responsive source controls.
```

Final focused GREEN:

```text
npm test -- AppShell.test.tsx
Test Files 1 passed (1)
Tests 14 passed (14)
```

The first full-suite run found an ambiguous exact stage-label query because the new work queue repeated stage labels without context:

```text
npm test
Test Files 1 failed | 7 passed (8)
Tests 1 failed | 68 passed (69)
```

Queue stage values were labeled `Stage: ...`; the focused suite and full suite then passed.

### Component Structure

- `app/AppShell.tsx`: explicit async selection state machine, exclusive shell-state renderer, named loading/empty/error surfaces, and responsive header/mobile refresh composition.
- `features/cases/RoleWorkQueue.tsx`: focused read-only role queue over existing immutable task models.
- `features/cases/CaseWorkspace.tsx`: composes role metrics with the role queue without introducing Task Center actions.
- `features/cases/DecisionWorkspace.tsx`: binds supervisor disposition context to the current gated task and handles absent supervisor work explicitly.
- Existing overview, evidence, activity, decision history, and stage components own their local empty/progress semantics.

### Apollo Imports Verified

No guessed Apollo component names were introduced. The new queue uses the previously verified root `Badge` export. Shell changes continue to use the verified `Button`, `Badge`, `Sheet`, `Alert`, `Skeleton`, and `Tooltip` exports. Apollo's official Tailwind CSS remains imported exactly once in `main.tsx`.

### Files

Created:

- `ProgramIntegrity360/PI360CodedApp/src/features/cases/RoleWorkQueue.tsx`

Modified:

- `ProgramIntegrity360/PI360CodedApp/src/app/AppShell.tsx`
- `ProgramIntegrity360/PI360CodedApp/src/app/AppShell.test.tsx`
- `ProgramIntegrity360/PI360CodedApp/src/features/activity/ActivityTimeline.tsx`
- `ProgramIntegrity360/PI360CodedApp/src/features/cases/CaseOverview.tsx`
- `ProgramIntegrity360/PI360CodedApp/src/features/cases/CaseWorkspace.tsx`
- `ProgramIntegrity360/PI360CodedApp/src/features/cases/DecisionWorkspace.tsx`
- `ProgramIntegrity360/PI360CodedApp/src/features/cases/EvidenceWorkspace.tsx`
- `ProgramIntegrity360/PI360CodedApp/src/features/cases/StageJourney.tsx`
- `ProgramIntegrity360/PI360CodedApp/src/index.css`
- `.superpowers/sdd/2026-08-06-pi360-coded-app-implementation/task-5-report.md`

### Final Verification

```text
npm test
Test Files 8 passed (8)
Tests 69 passed (69)

npm run lint
0 errors, 61 warnings

npm run build
TypeScript and Vite build passed; 5321 modules transformed.
dist/assets/index-CINOupNE.css 168.00 kB, gzip 26.72 kB
dist/assets/index-Gip1Xgdj.js 559.39 kB, gzip 169.45 kB

git diff --check
Exit 0

curl -I http://127.0.0.1:5174/
HTTP/1.1 200 OK
```

The 61 lint warnings remain pre-existing and outside Task 5 files. Vite retains its existing chunk-size advisory above 500 kB.

### Self-Review

- Confirmed request sequencing prevents an older selection from clearing or replacing the latest pending intent.
- Confirmed terminal errors do not coexist with source-warning, loading, or empty command content.
- Confirmed all requested live-empty collections expose named status regions without creating card-styled page sections.
- Confirmed lifecycle badges never alter linked-task progress and visible/ARIA values share one calculation.
- Confirmed role queues are filtered from existing immutable task arrays and expose no iframe, link, completion, or Task Center claim.
- Confirmed supervisor disposition context is absent when no gated task exists and identifies task `1003` in the demo workspace.
- Confirmed the header has local flex containment and no longer relies on body overflow clipping.
- Confirmed no cloud, publish, deploy, push, or external iframe operation was run.

### Concerns

1. No browser backend was available for screenshot inspection in this session. Component semantics, responsive utility presence, production output, and local HTTP serving were verified; Task 8 still owns full Playwright visual coverage.
2. The production JavaScript chunk is now 559.39 kB and retains Vite's existing advisory. Task Center and assistant boundaries remain the natural future code-splitting points.
3. The existing 61 lint warnings remain outside Task 5 scope.

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

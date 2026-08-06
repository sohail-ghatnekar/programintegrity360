# Task 6 Report: Action Center Task Center And Iframe Drawer

## Result

Implemented Task Center as a real third view in the reviewed Apollo shell. It has separate `This Case` and `Folder Inbox` tabs, finite six-row pagination, status/type/priority filters, source-specific empty states, and task rows with title, stage, type, priority, assignee, SLA, and status.

Selecting a task opens an Apollo right-side `Sheet` with metadata and the task commands. A non-completed task with a published URL creates one Action Center iframe. Completed or unpublished tasks create no iframe. `Open in Action Center` is always visible because cross-origin CSP failures cannot be inspected reliably. Folder Inbox selection remains labeled as folder work and is never presented as current-case work.

No cloud, publish, deploy, push, task-completion, or other remote operation was run.

## RED / GREEN

Initial task-module RED:

```text
npm test -- TaskCenter.test.tsx useTaskPolling.test.ts
Test Files 2 failed (2)
Failed to resolve ./TaskCenter and ./useTaskPolling before implementation.
```

Stage-preservation RED:

```text
npm test -- liveCaseRepository.test.ts -t "preserves case-task stage metadata"
Test Files 1 failed (1)
Expected CaseInstances.getStages("active-instance", "folder-key"); calls: 0.
```

Shell-composition RED:

```text
npm test -- App.test.tsx -t "Task Center|refreshes case tasks"
Tests 2 failed
Task Center navigation did not exist before App/AppShell integration.
```

Completion-refresh race RED:

```text
npm test -- useTaskPolling.test.ts -t "retains confirmed completion"
Expected: completed
Received: unavailable
```

The root cause was the polling effect treating temporary SDK-reader removal during a full workspace refresh as a new polling session. Reader changes now update a ref without resetting the task/open polling-session identity.

Focused GREEN:

```text
npm test -- TaskCenter.test.tsx useTaskPolling.test.ts App.test.tsx liveCaseRepository.test.ts
Test Files 4 passed (4)
Tests 49 passed (49)
```

## SDK Evidence

Installed package: `@uipath/uipath-typescript` `1.1.0`.

Inspected declaration in `node_modules/@uipath/uipath-typescript/dist/tasks/index.d.ts`:

```ts
getById(
  id: number,
  options?: TaskGetByIdOptions,
  folderId?: number,
): Promise<TaskGetResponse>;
```

The injected live adapter therefore calls:

```ts
tasks.getById(taskId, undefined, folderId)
```

Passing `folderId` in the third argument also satisfies the installed declaration's form-task requirement. Existing `uipath.json` already includes `OR.Tasks.Read` and broader configured task scopes; no scope change was needed.

## Polling Contract

- Local and component tests inject `TaskStatusReader`; they instantiate no live SDK and make no cloud calls.
- Authenticated `live` composition creates the SDK reader. Demo, disconnected, loading, and unpublished states do not create a reader.
- Automatic polling starts after exactly `3000ms` and schedules the next read after each settled attempt.
- Polling terminates on drawer close, Tasks API `Completed`, or `120000ms` elapsed.
- Transient read failures display a retry state and retry after 3 seconds without invoking completion.
- Only a Tasks API response whose `status === "Completed"` invokes `onCompleted(taskId)`.
- Completion is terminal for that open drawer and invokes the callback once, including while the subsequent workspace refresh temporarily changes live-reader availability.
- Confirmed completion removes the iframe, announces through an accessible live region, and stays visible until close.

## Demo / Live Boundary

The deterministic demo lists and opens the supplied task artifacts and keeps the direct Action Center command visible. It states that live task polling is unavailable and never simulates completion.

The live path is intentionally injectable pending publication. When authenticated data status is `live`, `createSdkTaskStatusReader(auth.sdk)` uses `Tasks.getById`. Completion triggers the existing full `caseWorkspace.refresh()`, which reloads tasks, stages, and execution timeline.

The explicit brief route remains unchanged: `/{org}/{tenant}/actions_/tasks/{taskId}`. The newer skill route is reserved for live-browser verification after artifacts are published; no third route was invented.

## Stage Preservation

Task 4's `refreshTasksWithWarnings()` previously normalized every refreshed case task with `Unmapped UiPath stage`. It now loads the selected case's stage references, builds the same task-stage lookup used by full workspace loading, and normalizes case tasks with that lookup. Folder tasks remain normalized only as `Folder inbox`, preserving the case/folder boundary.

If the stage request itself fails, the existing warning/fallback contract remains in force rather than fabricating stage metadata.

## Files

Created:

- `ProgramIntegrity360/PI360CodedApp/src/features/tasks/TaskCenter.tsx`
- `ProgramIntegrity360/PI360CodedApp/src/features/tasks/TaskDrawer.tsx`
- `ProgramIntegrity360/PI360CodedApp/src/features/tasks/useTaskPolling.ts`
- `ProgramIntegrity360/PI360CodedApp/src/features/tasks/TaskCenter.test.tsx`
- `ProgramIntegrity360/PI360CodedApp/src/features/tasks/useTaskPolling.test.ts`
- `.superpowers/sdd/2026-08-06-pi360-coded-app-implementation/task-6-report.md`

Modified:

- `ProgramIntegrity360/PI360CodedApp/src/App.tsx`
- `ProgramIntegrity360/PI360CodedApp/src/App.test.tsx`
- `ProgramIntegrity360/PI360CodedApp/src/app/AppShell.tsx`
- `ProgramIntegrity360/PI360CodedApp/src/services/uipath/liveCaseRepository.ts`
- `ProgramIntegrity360/PI360CodedApp/src/services/uipath/liveCaseRepository.test.ts`

The pre-existing modification in `ProgramIntegrity360/docs/superpowers/plans/2026-08-06-pi360-coded-app-implementation.md` was not changed or staged by Task 6.

## Final Verification

```text
npm test
Test Files 10 passed (10)
Tests 92 passed (92)

npm run lint
0 errors, 61 warnings

npm run build
TypeScript and Vite build passed; 5325 modules transformed.
dist/assets/index-BuHl6eQ2.css 169.10 kB, gzip 26.95 kB
dist/assets/index-CxYmMM0r.js 571.75 kB, gzip 173.03 kB

git diff --check
Exit 0

curl -I http://127.0.0.1:5175/
HTTP/1.1 200 OK
```

All 61 lint warnings are pre-existing and outside Task 6 files. Vite retains its chunk-size advisory above 500 kB.

## Self-Review

- Confirmed `caseTasks` and `folderTasks` are never concatenated or reclassified.
- Confirmed Folder Inbox rows and drawer metadata use `Folder Inbox`, not a current-case stage.
- Confirmed selection stores source scope and re-resolves by ID within only that source after refresh.
- Confirmed all folder tasks, including completed records, can open their metadata/direct-link drawer.
- Confirmed completed tasks have no embedded completion surface and no local completion action.
- Confirmed absent URLs keep a disabled visible direct-link command, explain unpublished state, and create no iframe.
- Confirmed cross-origin CSP is never inferred; the direct link remains visible beside every published task.
- Confirmed the active Task 5/6 composition has one external iframe source: the conditional iframe in `TaskDrawer`. Older unmounted legacy components still contain iframe source code and were not refactored in this task.
- Confirmed no task-completion SDK method exists in the Task 6 implementation. Only `Tasks.getById` can confirm completion.
- Confirmed the Task Drawer is bounded by `min(1120px, 96vw)` and the fixed-format task table has stable column widths and finite pagination.
- Confirmed no cloud operations were executed.

## Concerns

1. Live task artifacts are not fully published, so tenant CSP, the approved `/actions_/tasks/{id}` route, live task type behavior, and real status transitions still require browser verification after publication.
2. The in-app browser runtime reported no available browser backend. Automated component behavior, production compilation, generated CSS, and local HTTP serving were verified, but screenshot-level desktop/mobile visual QA was not available in this session.
3. The production JavaScript chunk is now 571.75 kB and retains Vite's existing size advisory. Task 8 should evaluate splitting after Task 7 establishes the assistant boundary.
4. Dormant legacy components contain other iframe source code, but they are not imported into the active shell composition. A future cleanup can remove those legacy surfaces once the replacement app is complete.

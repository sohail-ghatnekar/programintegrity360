# Task 4 Report: Live UiPath Case And Task Repository

## Result

Implemented the live UiPath case/task adapter and live-first workspace hook without cloud operations. The repository uses SDK constructor imports, preserves immutable partial workspaces, records per-service warnings, and supplies deterministic render-safe defaults for missing SDK fields.

## Files

- `ProgramIntegrity360/PI360CodedApp/src/services/uipath/collection.ts`
- `ProgramIntegrity360/PI360CodedApp/src/services/uipath/actionCenterUrl.ts`
- `ProgramIntegrity360/PI360CodedApp/src/services/uipath/liveCaseRepository.ts`
- `ProgramIntegrity360/PI360CodedApp/src/services/uipath/liveCaseRepository.test.ts`
- `ProgramIntegrity360/PI360CodedApp/src/services/uipath/actionCenterUrl.test.ts`
- `ProgramIntegrity360/PI360CodedApp/src/features/cases/useCaseWorkspace.ts`

## Behavior

- Discovers the configured case process by normalized `name`, `packageId`, or `processKey`.
- Orders the newest non-completed instance first, then falls back to the newest instance.
- Calls `CaseInstances.getStages()`, `getActionTasks()`, and `getExecutionHistory()` for a selected instance.
- Calls `Tasks.getAll({ folderId })` for the folder inbox.
- Normalizes arrays and SDK `{ items }` responses through `itemsOf<T>()`.
- Keeps the canonical six-stage baseline and preserves unknown stages with safe labels, status, metadata, and a conservative `investigation` key.
- Converts case tasks, folder tasks, and execution history to Task 2 models without relying on optional fields.
- Deep-freezes live snapshots and warning arrays.
- Preserves successful service data when stages, case tasks, folder tasks, or history fail independently.
- Starts unauthenticated sessions in demo mode; authenticated failures remain in `error` until retry or explicit demo fallback.
- Protects hook state from stale asynchronous responses and supports refresh and case selection.

## SDK Declarations Inspected

- `node_modules/@uipath/uipath-typescript/dist/cases/index.d.ts`
  - `Cases`, `CasesServiceModel.getAll(): Promise<CaseGetAllResponse[]>`
  - `CaseGetAllResponse`
  - `CaseInstances`, `CaseInstancesServiceModel.getAll()` array-wrapper/paginated conditional response
  - `CaseInstanceGetResponse` and `RawCaseInstanceGetResponse`
  - `CaseInstances.getStages(caseInstanceId, folderKey)` and `CaseGetStageResponse`
  - `CaseInstances.getActionTasks(caseInstanceId, options?)` and `TaskGetResponse`
  - `CaseInstances.getExecutionHistory(instanceId, folderKey)` and `CaseInstanceExecutionHistoryResponse`
  - `ElementExecutionMetadata` and `StageTask`
- `node_modules/@uipath/uipath-typescript/dist/tasks/index.d.ts`
  - `Tasks`, `TaskServiceModel.getAll(options?)`
  - `TaskGetAllOptions.folderId`
  - `TaskGetResponse`, `RawTaskGetResponse`, `TaskBaseResponse`, and SLA/assignee fields
- Existing Task 2/3 contracts:
  - `src/features/cases/types.ts`
  - `src/features/cases/stages.ts`
  - `src/features/cases/demoRepository.ts`
  - `src/config/uipath.ts`
  - `src/hooks/useAuth.tsx`

## Test Evidence

RED:

```text
npm test -- liveCaseRepository.test.ts actionCenterUrl.test.ts
Test Files 2 failed (2)
Both failures were unresolved Task 4 module imports before implementation.
```

Hook RED:

```text
npm test -- liveCaseRepository.test.ts
Test Files 1 failed (1)
Failure was the unresolved useCaseWorkspace module before implementation.
```

Focused GREEN:

```text
npm test -- liveCaseRepository.test.ts actionCenterUrl.test.ts
Test Files 2 passed (2)
Tests 14 passed (14)
```

Full verification:

```text
npm test
Test Files 7 passed (7)
Tests 36 passed (36)

npm run lint
0 errors, 61 warnings

npm run build
TypeScript and Vite build passed; 447 modules transformed.
```

The 61 lint warnings are pre-existing and occur outside Task 4 files. The build reports the existing large-chunk advisory for the 770.19 kB application bundle.

## Self-Review

- Confirmed `new Cases(sdk)`, `new CaseInstances(sdk)`, and `new Tasks(sdk)` constructor usage.
- Confirmed no deprecated SDK dot-chain access.
- Confirmed tests replace all SDK service constructors and make no cloud calls.
- Confirmed optional stage/task/history fields receive explicit string, number, array, status, and metadata fallbacks.
- Confirmed service failures are isolated with `Promise.allSettled()` and warning messages identify the failed source.
- Confirmed authenticated live errors do not silently become demo results.
- Confirmed implementation changes remain within the six Task 4 files; this report is the only additional artifact requested by the task.

## Concerns

1. `uipath.json` currently omits the `PIMS` OAuth scope required by the installed UiPath Maestro Cases guidance. Live case calls may return 401/403 until a later configuration task adds that scope. Changing it is outside Task 4 files.
2. The Task 4 brief requires `/actions_/tasks/{taskId}` and its exact test is implemented. The installed `uipath-tasks` skill documents `/actions_/current-task/tasks/{taskId}` as the newer standalone canonical route. This needs live browser verification before Task 6 iframe work.
3. The inspected Cases SDK responses do not expose PI360 provider, claim, evidence, or risk-signal records. The live repository therefore returns explicit `Not available` values and empty collections for those unsupported sections rather than presenting demo records as live data.

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

## Fix Round 1

### Findings Addressed

- Added `PIMS` to `ProgramIntegrity360/PI360CodedApp/uipath.json` and asserted the committed hosted OAuth scope directly in the repository test suite.
- Scoped case process discovery by the installed `CaseGetAllResponse.folderKey` field. When the process field is absent, discovery records a warning and enforces the configured folder against instance responses.
- Filtered out any `CaseInstanceGetResponse` whose available `folderKey` conflicts with the configured folder. Missing instance folder identity is accepted only with a warning, and all detail calls use the configured folder key.
- Exhausted CaseInstances, case action tasks, and folder Tasks through the installed cursor options. Each first call uses `{ pageSize: 100 }`; continuation calls add the SDK `PaginationCursor` through `{ cursor }` while preserving `processKey` or `folderId` where supported.
- Added repeated-cursor, missing-cursor, and 100-page guards that preserve collected items and emit truncation warnings.
- Normalized backend stages into exactly six canonical entries with six unique keys. Unknown and duplicate backend stage IDs, names, statuses, and task-group counts are retained in canonical stage descriptions and accompanied by source warnings.
- Replaced repository-global warning state with immutable `RepositoryOperationResult<T>` values returned by `listCasesWithWarnings()`, `loadWorkspaceWithWarnings()`, and `refreshTasksWithWarnings()`.
- Added a hook request-generation check immediately after case listing, before workspace loading, so superseded requests do not start obsolete detail work.
- Preserved render-safe empty task URLs while surfacing the exact Action Center URL configuration error as an operation warning.
- Included the user-amended implementation plan at `ProgramIntegrity360/docs/superpowers/plans/2026-08-06-pi360-coded-app-implementation.md` in the staged change.

### Installed SDK Evidence

- `CaseGetAllResponse.folderKey: string` supports process-level folder selection.
- `RawCaseInstanceGetResponse.folderKey: string` supports response-level instance enforcement.
- `CaseInstanceGetAllOptions` supports `processKey`, `packageId`, `packageVersion`, and `errorCode`; it does not expose a folder filter.
- `CaseInstanceGetAllWithPaginationOptions` adds installed `PaginationOptions`: `pageSize`, `cursor`, or `jumpToPage`.
- `CaseInstances.getActionTasks()` accepts installed `TaskGetAllOptions`, including `pageSize` and `cursor`.
- `Tasks.getAll()` accepts installed `TaskGetAllOptions`, including `folderId`, `pageSize`, and `cursor`.
- `PaginationCursor` is the installed `{ value: string }` cursor object exported from `@uipath/uipath-typescript/core`.

No unsupported folder or pagination parameters were added.

### RED Evidence

```text
npm test -- liveCaseRepository.test.ts actionCenterUrl.test.ts
Test Files 1 failed | 1 passed (2)
Tests 15 failed | 8 passed (23)
```

The failures covered missing `PIMS`, unscoped process/instance selection, absent page options and continuation calls, missing operation-result APIs, seven/duplicate stage output, swallowed URL errors, missing warning propagation, and obsolete hook workspace loading.

An explicit strict typecheck also found one execution-history fallback generic mismatch before the final fix:

```text
npx tsc --noEmit ... liveCaseRepository.ts useCaseWorkspace.ts
TS2345: Argument of type '{}' is not assignable to CaseInstanceExecutionHistoryResponse.
```

### GREEN Evidence

```text
npm test -- liveCaseRepository.test.ts actionCenterUrl.test.ts
Test Files 2 passed (2)
Tests 23 passed (23)

npx tsc --noEmit --target ES2022 --module ESNext --moduleResolution bundler \
  --lib ES2022,DOM,DOM.Iterable --types vite/client --jsx react-jsx --strict \
  --skipLibCheck --allowImportingTsExtensions --verbatimModuleSyntax \
  src/services/uipath/collection.ts \
  src/services/uipath/actionCenterUrl.ts \
  src/services/uipath/liveCaseRepository.ts \
  src/features/cases/useCaseWorkspace.ts
Exit 0
```

### Final Verification

```text
npm test
Test Files 7 passed (7)
Tests 45 passed (45)

npm run lint
0 errors, 61 warnings

npm run build
TypeScript and Vite build passed; 447 modules transformed.
```

All lint warnings remain outside Task 4 files. The existing 770.19 kB bundle-size advisory remains unchanged. No cloud, publish, deploy, or push command was run.

### Remaining Concerns

1. The brief-required `/actions_/tasks/{taskId}` route still differs from the installed task skill's newer `/actions_/current-task/tasks/{taskId}` guidance. This remains a Task 6 live-browser verification item.
2. The Cases SDK still does not supply PI360 provider, claim, evidence, or risk-signal records; those live sections continue to use explicit unavailable/empty values.

## Fix Round 2

This section supersedes the open Task 4 folder-scope, unknown-stage, and first-page error findings from the prior review rounds.

### Findings Addressed

- Process selection now requires an exact `folderKey` match. Matching processes with missing or conflicting folder identities fail before CaseInstances discovery, with the discovered folder identities included in the error.
- Instance selection now excludes both missing and conflicting `folderKey` values. Only instances whose response folder key exactly matches the configured folder can be listed, loaded, or refreshed.
- First-page CaseInstances failures are rethrown unchanged, so PIMS authorization failures and outages reach the hook as their root cause. Failures after at least one page preserve verified items and emit an explicit partial-data truncation warning.
- Unknown backend stages no longer map to Investigation or any canonical stage. Their ID, name, status, task-group count, and task-reference count are retained in operation warnings; matching execution history remains visible as unmapped source activity.
- Tasks referenced only by unknown stages retain `Unmapped UiPath stage` instead of receiving a canonical stage label.
- Duplicate known stages merge only into their matched canonical key. Status, source ID, update time, and execution timestamps use deterministic status/time/source-ID precedence independent of response order.
- Hook catch paths retain warnings already returned by case discovery when workspace loading subsequently fails.
- Added direct tests for first-page failure, later-page partial preservation, missing cursor, repeated cursor, the 100-page cap, unknown-stage non-influence, duplicate order independence, and hook root-cause/warning behavior.

### RED Evidence

Initial focused RED after adding folder, first-page, unknown-stage, guard, and catch-path tests:

```text
npm test -- liveCaseRepository.test.ts
Test Files 1 failed (1)
Tests 5 failed | 21 passed (26)
```

The five failures proved that missing process and instance folder identity was accepted, a page-one 403 became an empty result, Recovery Hold changed Investigation state, and hook catch discarded discovery warnings. The new missing-cursor and 100-page tests passed because those guards existed but previously lacked direct test evidence.

A second RED isolated order-dependent duplicate-stage metadata:

```text
npm test -- liveCaseRepository.test.ts
Test Files 1 failed (1)
Tests 1 failed | 26 passed (27)
```

The faulted duplicate won status but did not win `sourceId` when it appeared second.

### GREEN Evidence

```text
npm test -- liveCaseRepository.test.ts
Test Files 1 passed (1)
Tests 29 passed (29)

npx tsc --noEmit --target ES2022 --module ESNext --moduleResolution bundler \
  --lib ES2022,DOM,DOM.Iterable --types vite/client --jsx react-jsx --strict \
  --skipLibCheck --allowImportingTsExtensions --verbatimModuleSyntax \
  src/services/uipath/collection.ts \
  src/services/uipath/actionCenterUrl.ts \
  src/services/uipath/liveCaseRepository.ts \
  src/features/cases/useCaseWorkspace.ts
Exit 0
```

### Final Verification

```text
npm test
Test Files 7 passed (7)
Tests 54 passed (54)

npm run lint
0 errors, 61 warnings

npm run build
TypeScript and Vite build passed; 447 modules transformed.
```

All 61 lint warnings remain outside Task 4 files. The existing 770.19 kB bundle-size advisory remains unchanged. No cloud, publish, deploy, push, or other remote operation was run.

### Self-Review

- Confirmed CaseInstances still receives only installed SDK options: `processKey`, `pageSize`, and `cursor`.
- Confirmed no process or instance lacking an exact configured folder identity can reach detail calls.
- Confirmed unknown stage data changes neither canonical status nor canonical source/task metadata.
- Confirmed later-page failures preserve only already-verified items and first-page failures preserve the original error.
- Confirmed repository warnings remain operation-local and hook catch paths retain earlier operation warnings.

### Remaining Concerns

No new Task 4 concerns were introduced. The Action Center route and unsupported PI360 domain-record limitations documented above remain follow-up items for their owning tasks.

## Fix Round 3

### Finding Addressed

- Cursor collection now returns both collected items and an explicit completeness flag. A partial page set can still support rendering/listing verified items, but it cannot support a definitive selected-instance absence decision.
- `loadWorkspaceWithWarnings()` now throws `RepositoryOperationError` when truncated or warning-bearing discovery cannot verify the requested case. The error carries an immutable copy of current-operation warnings and uses an accurate verification failure message instead of `instance not found`.
- `refreshTasksWithWarnings()` applies the same warning-preserving verification contract.
- The hook extracts structured repository warnings from rejected operations, merges them with prior list warnings without duplicates, and retains the operation error message in its error state.
- Added a combined hook/repository regression test where initial listing finds the case, workspace re-discovery loads a different first page, page two fails, and the UI receives both the PIMS outage/truncation warning and a non-definitive verification error.

### RED Evidence

```text
npm test -- liveCaseRepository.test.ts
Test Files 1 failed (1)
Tests 1 failed | 29 passed (30)
```

The new combined test received only `UiPath case instance not found: active-instance`; the current page-two outage warning was absent.

### GREEN Evidence

```text
npm test -- liveCaseRepository.test.ts
Test Files 1 passed (1)
Tests 30 passed (30)

npx tsc --noEmit --target ES2022 --module ESNext --moduleResolution bundler \
  --lib ES2022,DOM,DOM.Iterable --types vite/client --jsx react-jsx --strict \
  --skipLibCheck --allowImportingTsExtensions --verbatimModuleSyntax \
  src/services/uipath/collection.ts \
  src/services/uipath/actionCenterUrl.ts \
  src/services/uipath/liveCaseRepository.ts \
  src/features/cases/useCaseWorkspace.ts
Exit 0
```

### Final Verification

```text
npm test
Test Files 7 passed (7)
Tests 55 passed (55)

npm run lint
0 errors, 61 warnings

npm run build
TypeScript and Vite build passed; 447 modules transformed.
```

All 61 lint warnings remain outside Task 4 files. The existing 770.19 kB bundle-size advisory remains unchanged. No cloud, publish, deploy, push, or other remote operation was run.

### Self-Review

- Confirmed complete CaseInstances discovery still returns a definitive not-found error when the requested ID is genuinely absent.
- Confirmed first-page failures still propagate their original error directly.
- Confirmed later-page failure, missing cursor, repeated cursor, and page-cap exits all mark discovery incomplete.
- Confirmed structured warnings are copied and frozen, remain operation-local, and survive the hook rejection path.
- Confirmed the hook deduplicates prior list warnings, rejected-operation warnings, and its user-facing error message.

### Remaining Concerns

No new Task 4 concerns were introduced. The previously documented Action Center route and unsupported PI360 domain-record limitations remain follow-up items for their owning tasks.

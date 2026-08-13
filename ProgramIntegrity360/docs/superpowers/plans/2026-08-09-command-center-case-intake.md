# Command Center Case Intake Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan.

**Goal:** Let an authenticated PI360 user launch either Medicaid PCS or State Medicaid Hospice from Command center, have Maestro register the case idempotently in Data Fabric as its first task, and open the new case from a newest-first ten-row queue.

**Architecture:** The coded app owns input collection, typed scenario payload construction, UiPath process start, and bounded polling. The first Maestro intake API-workflow task owns the authoritative `PI360ProgramIntegrityCase` upsert. Existing case stages, entity IDs, evidence paths, human tasks, and app layout remain intact.

**Tech Stack:** React 19, TypeScript 5.8, Vitest/Testing Library, UiPath TypeScript SDK 1.1, UiPath API Workflows, Maestro Case Management, Data Fabric, UiPath Solution CLI, pytest.

## Global Constraints

- Work only on branch `codex/pi360-multiscenario-refit` in `/Users/sohail.ghatnekar/Dev/program-integrity-360/.worktrees/pi360-multiscenario-refit`.
- Preserve the nine confirmed live Data Fabric entity IDs in `PI360CodedApp/uipath.json`.
- Preserve the six trigger objects exactly: `caseInput`, `claimInput`, `memberInput`, `providerInput`, `serviceEventInput`, and `documentInput`. Put `requesterEmail` inside `caseInput`; do not add a seventh case trigger input.
- Do not write the case entity from the coded app. Maestro task `tINT1case` is the single authoritative registration owner.
- Treat `Observation` as the institutional patient class and the 360-minute overlap as a review indicator, never an autonomous fraud or repayment determination.
- Use `apply_patch` for repository edits. Do not rewrite `caseplan.json` with scripts, Python, `jq`, or formatters.
- Run `npm test` after every TypeScript/TSX change set and use `uv run pytest` for Python tests.
- Generate every Integration Service activity with `uip api-workflow registry resolve` and `stub`; never invent a connector type ID, object name, or connection ID.
- Before any `uip df` command, read the full Data Fabric reference required by the `uipath-platform` skill.
- Do not run a real API workflow or create a smoke-test case until the user explicitly approves that side effect.
- Commit after each green task. Do not stage unrelated user changes.

---

## Task 1: Lock the Data Fabric schema contract

**Files:**

- Modify: `test/test_platform_schema.py`
- Modify: `platform/02_entities.js`
- Modify: `platform/data-fabric-and-plumbing.md`

**Step 1: Add the failing schema assertions**

Extend `test_entities_use_cap_safe_fields_on_the_nine_existing_pi360_entities`:

```python
for required in (
    "requester_email",
    "maestro_instance_id",
):
    assert required in source
```

Keep the existing cap-safety and nine-entity assertions unchanged.

**Step 2: Prove the test fails**

Run:

```bash
uv run pytest test/test_platform_schema.py -q
```

Expected: failure because `requester_email` and `maestro_instance_id` are absent.

**Step 3: Add optional fields to the existing case entity**

In the `PI360ProgramIntegrityCase` field list in `platform/02_entities.js`, add:

```javascript
S('requester_email'), S('maestro_instance_id')
```

Do not create a new entity or change `case_id` uniqueness. Update the entity table in `platform/data-fabric-and-plumbing.md` to state that `case_id` is the business correlation key, `requester_email` is optional, and `maestro_instance_id` is optional when Maestro exposes a runtime identifier.

**Step 4: Verify and commit**

Run:

```bash
uv run pytest test/test_platform_schema.py -q
npm --prefix ProgramIntegrity360/PI360CodedApp test
git add test/test_platform_schema.py platform/02_entities.js platform/data-fabric-and-plumbing.md
git commit -m "feat: extend PI360 case registration fields"
```

`npm test` is required because a JavaScript schema file changed.

---

## Task 2: Resolve the live Data Fabric Integration Service activities

**Files:**

- Inspect: `ProgramIntegrity360/PI360ApiWorkflows/Main.json`
- Inspect: `ProgramIntegrity360/resources/solution_folder/process/api/PI360ApiWorkflows.json`
- Inspect: `ProgramIntegrity360/resources/solution_folder/package/PI360ApiWorkflows.json`
- Modify only if required by resource refresh: `ProgramIntegrity360/resources/solution_folder/**`

**Step 1: Confirm the authenticated target**

Run:

```bash
uip login status --output json
uip is connectors list --output table
```

Verify organization `uipathlabs`, tenant `Playground`, and folder `AMER Presales/Public Sector/ProgramIntegrity360`.

**Step 2: Resolve, do not guess, the connector and activities**

Run:

```bash
uip api-workflow registry resolve "Data Fabric query entity records" --output json
uip api-workflow registry resolve "Data Fabric create entity record" --output json
uip api-workflow registry resolve "Data Fabric update entity record" --output json
```

From the returned TypeCache candidates, select only activities whose connector metadata identifies UiPath Data Fabric and whose operation matches query, create, or update.

**Step 3: Find and validate a real connection**

List connections using the connector key returned by the registry metadata:

```bash
uip is connections list uipath-uipath-dataservice --output json
```

For each returned UUID, pass that UUID to `uip is connections ping`. Pass the successful UUID to `uip is resources list uipath-uipath-dataservice --connection-id` and inspect the JSON resources.

Select the existing `PI360ProgramIntegrityCase` object, whose live entity ID is `497c2d5c-7492-f111-b338-000d3ab4d3b7`.

If no connection pings successfully, stop implementation and request the user to repair or create the Playground Data Fabric connection. Do not insert a placeholder.

**Step 4: Generate exact activity stubs**

For each query/create/update activity type ID returned by `resolve`, call `uip api-workflow registry stub` with that activity ID, the successful connection UUID, `--object-name PI360ProgramIntegrityCase`, and `--output json`.

Retain the three generated JSON objects for Task 3. This task is read-only unless solution resource metadata must be refreshed; there is no commit by default.

---

## Task 3: Implement idempotent intake registration in the API workflow

**Files:**

- Modify: `test/test_api_workflow_contract.py`
- Modify: `ProgramIntegrity360/PI360ApiWorkflows/Main.json`
- Modify: `ProgramIntegrity360/PI360ApiWorkflows/entry-points.json`

**Step 1: Add failing contract tests**

Add tests that assert the lifecycle input schema and entry point expose the six objects, and that `IntakeClaimByCaseType` contains the generated Data Fabric query/create/update activities:

```python
LIFECYCLE_ENTRY_POINTS_PATH = (
    ROOT / "ProgramIntegrity360" / "PI360ApiWorkflows" / "entry-points.json"
)


def test_intake_registration_accepts_six_trigger_objects():
    workflow = load_json(LIFECYCLE_WORKFLOW_PATH)
    properties = workflow["input"]["schema"]["document"]["properties"]
    entry = load_json(LIFECYCLE_ENTRY_POINTS_PATH)["entryPoints"][0]
    entry_properties = entry["input"]["properties"]
    for name in (
        "caseInput",
        "claimInput",
        "memberInput",
        "providerInput",
        "serviceEventInput",
        "documentInput",
    ):
        assert properties[name]["type"] == "object"
        assert entry_properties[name]["type"] == "object"


def test_intake_registration_is_a_real_idempotent_data_fabric_upsert():
    workflow = load_json(LIFECYCLE_WORKFLOW_PATH)
    raw = json.dumps(workflow)
    assert "PI360ProgramIntegrityCase" in raw
    assert "UiPath.IntSvc" in raw
    assert "requester_email" in raw
    assert "maestro_instance_id" in raw
    assert "registrationMode" in raw
    assert "Demo contract only; no external write is performed." not in raw
    assert "recordsAffected" in raw
```

Strengthen the second test after inserting the generated activities to assert their exact `metadata.uiPathActivityTypeId` values and connection UUID.

**Step 2: Prove the tests fail**

Run:

```bash
uv run pytest test/test_api_workflow_contract.py -q
```

Expected: failure because the object inputs and live upsert are not present.

**Step 3: Extend the input contract**

Add all six object properties to both workflow and entry-point schemas. Retain the scalar inputs used by later lifecycle calls. For intake, normalize these values from the objects:

```javascript
const caseInput = input.caseInput || {};
const claimInput = input.claimInput || {};
const memberInput = input.memberInput || {};
const providerInput = input.providerInput || {};
const serviceEventInput = input.serviceEventInput || {};
const documentInput = input.documentInput || {};
const caseType = String(caseInput.caseType || caseInput.case_type || input.caseType || '').trim();
const caseId = String(caseInput.caseId || caseInput.case_id || input.caseId || '').trim();
const requesterEmail = String(caseInput.requesterEmail || caseInput.requester_email || '').trim();
const maestroInstanceId = String(caseInput.maestroInstanceId || caseInput.maestro_instance_id || '').trim();
```

Reject missing/invalid case type, case ID, or requester email before calling Data Fabric.

**Step 4: Insert the generated upsert activities**

For `workflowName === 'IntakeClaimByCaseType'`:

1. Query `PI360ProgramIntegrityCase` by `case_id`.
2. Build the initial record from the six objects with `status = Open`, `stage = Intake and triage`, the scenario program/title, timestamps, requester email, and optional Maestro instance ID.
3. Update the existing record when the query returns one row.
4. Create the record when the query returns zero rows.
5. Fault when the query returns more than one row.
6. Return `recordsAffected: 1`, `persistedCaseId`, and `registrationMode` equal to `Created` or `Updated`.

Use the exact registry-generated `UiPath.IntSvc` stubs from Task 2. Other lifecycle catalog entries remain unchanged.

**Step 5: Validate, test, and commit**

Run:

```bash
uip api-workflow validate ProgramIntegrity360/PI360ApiWorkflows/Main.json --output json
uv run pytest test/test_api_workflow_contract.py -q
git add test/test_api_workflow_contract.py ProgramIntegrity360/PI360ApiWorkflows/Main.json ProgramIntegrity360/PI360ApiWorkflows/entry-points.json
git commit -m "feat: register cases during Maestro intake"
```

Do not run `uip api-workflow run` yet; that would write a real record.

---

## Task 4: Wire the first Maestro task to the full intake contract

**Files:**

- Modify: `test/test_caseplan_multiscenario.py`
- Modify: `ProgramIntegrity360/PI360CaseManagement/content/caseplan.json`

**Step 1: Add the failing first-node test**

Add a helper to locate task `tINT1case`, then assert:

```python
def test_first_intake_task_registers_all_trigger_objects_before_triage():
    caseplan = load_caseplan()
    tasks = [task for stage in stage_nodes(caseplan) for task in stage_tasks(stage)]
    intake = next(task for task in tasks if task["id"] == "tINT1case")
    names = {item["name"] for item in intake["data"]["inputs"]}
    assert {
        "workflowName",
        "caseType",
        "caseId",
        "caseInput",
        "claimInput",
        "memberInput",
        "providerInput",
        "serviceEventInput",
        "documentInput",
    } <= names
    assert intake["shouldRunOnlyOnce"] is True

    triage = next(task for task in tasks if task["id"] == "tTRI1agnt")
    assert "tINT1case" in json.dumps(triage)
```

**Step 2: Prove the test fails**

Run:

```bash
uv run pytest test/test_caseplan_multiscenario.py -q
```

**Step 3: Reconcile brownfield state before editing**

Download the current Studio Web solution to a temporary directory and compare the cloud `PI360CaseManagement/content/caseplan.json` with the branch. If cloud contains newer unrelated edits, stop and reconcile them before continuing.

**Step 4: Make the targeted caseplan edit**

Using `apply_patch`, change only task `tINT1case` so it passes the six case variables directly to `PI360ApiWorkflows` with `workflowName = IntakeClaimByCaseType`. Preserve task ID, display name, `shouldRunOnlyOnce: true`, stage ordering, and the triage dependency.

The object mappings must be:

```text
caseInput -> =vars.caseInput
claimInput -> =vars.claimInput
memberInput -> =vars.memberInput
providerInput -> =vars.providerInput
serviceEventInput -> =vars.serviceEventInput
documentInput -> =vars.documentInput
```

**Step 5: Validate, test, and commit**

Run:

```bash
uip maestro case validate ProgramIntegrity360/PI360CaseManagement/content/caseplan.json --output json
uv run pytest test/test_caseplan_multiscenario.py -q
git add test/test_caseplan_multiscenario.py ProgramIntegrity360/PI360CaseManagement/content/caseplan.json
git commit -m "feat: wire Maestro intake registration inputs"
```

---

## Task 5: Build the typed scenario catalog and unique case IDs

**Files:**

- Create: `ProgramIntegrity360/PI360CodedApp/src/features/cases/caseIntakeCatalog.ts`
- Create: `ProgramIntegrity360/PI360CodedApp/src/features/cases/caseIntakeCatalog.test.ts`

**Step 1: Write failing catalog tests**

Cover:

- `MedicaidPCS` produces `PI-PCS-2026-ABC123` when clock/random dependencies are fixed.
- `StateMedicaidHospice` produces `PI-HSP-2026-ABC123`.
- Each payload has exactly the six top-level trigger objects.
- `caseInput.requesterEmail` contains the edited value.
- Hospice retains Jordan Ellis, $3,250 total, $2,500 threshold, July 14 09:00–15:00 home service, Observation, and the three approved bucket paths.
- PCS retains the current fallback facts and does not activate a hospital-record request.
- Unsupported case type and invalid email throw before a process call.

Example assertion:

```typescript
expect(Object.keys(request.inputArguments)).toEqual([
  'caseInput',
  'claimInput',
  'memberInput',
  'providerInput',
  'serviceEventInput',
  'documentInput',
]);
expect(request.inputArguments.caseInput).toMatchObject({
  caseId: 'PI-HSP-2026-ABC123',
  caseType: 'StateMedicaidHospice',
  requesterEmail: 'investigator@example.gov',
});
```

**Step 2: Prove the tests fail**

Run:

```bash
cd ProgramIntegrity360/PI360CodedApp
npm test -- src/features/cases/caseIntakeCatalog.test.ts
```

**Step 3: Implement the catalog**

Export:

```typescript
export type CaseType = 'MedicaidPCS' | 'StateMedicaidHospice';
export type CaseTriggerInputName =
  | 'caseInput'
  | 'claimInput'
  | 'memberInput'
  | 'providerInput'
  | 'serviceEventInput'
  | 'documentInput';

export type CaseStartPayload = Record<CaseTriggerInputName, Record<string, unknown>>;

export function createCaseId(
  caseType: CaseType,
  now: Date,
  suffix: string,
): string;

export function buildCaseStartPayload(input: {
  caseType: CaseType;
  requesterEmail: string;
  now?: Date;
  suffix?: string;
}): { caseId: string; inputArguments: CaseStartPayload };
```

Default suffix generation uses six uppercase alphanumeric characters from `crypto.getRandomValues`. Bucket paths interpolate the generated case ID. Normalize email with `trim().toLowerCase()` and validate it with a small email predicate.

**Step 4: Verify and commit**

Run:

```bash
npm test
git add src/features/cases/caseIntakeCatalog.ts src/features/cases/caseIntakeCatalog.test.ts
git commit -m "feat: add PI360 case intake catalog"
```

---

## Task 6: Load the authenticated requester profile

**Files:**

- Modify: `ProgramIntegrity360/PI360CodedApp/src/hooks/useAuth.tsx`
- Modify: `ProgramIntegrity360/PI360CodedApp/src/hooks/useAuth.test.tsx`

**Step 1: Add failing identity tests**

Mock the modular SDK user service and test:

```typescript
expect(await screen.findByTestId('auth-name')).toHaveTextContent('Sohail Ghatnekar');
expect(screen.getByTestId('auth-email')).toHaveTextContent('sohail@example.gov');
```

Also test a `getSettings()` rejection: authentication remains true, the name falls back to `Authenticated UiPath user`, and email remains `null`.

Update the test `AuthState` component to render `currentUserEmail`.

**Step 2: Prove the tests fail**

Run:

```bash
npm test -- src/hooks/useAuth.test.tsx
```

**Step 3: Fetch profile settings after authentication**

Import:

```typescript
import { User } from '@uipath/uipath-typescript/conversational-agent';
```

After `activeSdk.isAuthenticated()` returns true, call `new User(activeSdk).getSettings()`. Apply `settings.name` and `settings.email` only while the current auth generation is active. A profile failure must not fail OAuth. Clear identity on logout as today.

**Step 4: Verify and commit**

Run:

```bash
npm test
git add src/hooks/useAuth.tsx src/hooks/useAuth.test.tsx
git commit -m "feat: load authenticated requester profile"
```

---

## Task 7: Add the UiPath process-start service

**Files:**

- Create: `ProgramIntegrity360/PI360CodedApp/src/services/uipath/caseStarter.ts`
- Create: `ProgramIntegrity360/PI360CodedApp/src/services/uipath/caseStarter.test.ts`

**Step 1: Write failing service tests**

Mock `Processes` and assert the service:

- calls `getAll({ folderId: 2182825 })`;
- selects the process named `Program Integrity 360 Case`;
- calls `start` once with the selected process key, `reference: caseId`, and stringified six-object `inputArguments`;
- returns the started job key and case ID;
- throws a clear error for no matching release, ambiguous matching releases, an empty start response, or SDK failure;
- never imports or constructs `Entities`.

**Step 2: Prove the tests fail**

Run:

```bash
npm test -- src/services/uipath/caseStarter.test.ts
```

**Step 3: Implement the service**

Use the installed SDK contract:

```typescript
import { Processes } from '@uipath/uipath-typescript/processes';

const releases = await processes.getAll({ folderId });
const matches = releases.items.filter((release) => release.name === processName);
const jobs = await processes.start({
  processKey: matches[0].key,
  reference: caseId,
  inputArguments: JSON.stringify(inputArguments),
}, folderId);
```

Export a factory that accepts the `UiPath` SDK and optional `Processes` factory so unit tests do not make network calls.

**Step 4: Verify and commit**

Run:

```bash
npm test
git add src/services/uipath/caseStarter.ts src/services/uipath/caseStarter.test.ts
git commit -m "feat: start PI360 cases through UiPath"
```

---

## Task 8: Coordinate process start with bounded Data Fabric polling

**Files:**

- Modify: `ProgramIntegrity360/PI360CodedApp/src/features/cases/useCaseWorkspace.ts`
- Create: `ProgramIntegrity360/PI360CodedApp/src/features/cases/useCaseWorkspace.test.tsx`

**Step 1: Write failing hook tests**

Inject a case starter, delay function, and poll policy. Test:

- unauthenticated/demo mode rejects with `Connect UiPath to start a case.`;
- successful start polls the live repository until the generated ID appears, then loads that workspace;
- exactly one process start occurs regardless of poll count;
- timeout returns `Process started; workspace registration is pending for PI-HSP-2026-ABC123.` and preserves the generated case ID;
- a process-start failure performs no polling;
- a superseded/unmounted request does not update state.

Use a zero-delay test policy such as `{ attempts: 3, intervalMs: 0 }`; production uses a bounded policy such as 10 attempts at 1.5 seconds.

**Step 2: Prove the tests fail**

Run:

```bash
npm test -- src/features/cases/useCaseWorkspace.test.tsx
```

**Step 3: Extend the hook contract**

Return:

```typescript
startCase: (input: { caseType: CaseType; requesterEmail: string }) => Promise<CaseStartOutcome>;
caseStartStatus: 'idle' | 'starting' | 'polling' | 'registered' | 'pending' | 'error';
caseStartMessage: string | null;
```

The hook builds the payload, starts the process, polls `listCasesWithWarnings(liveRepository)`, and calls `loadLive(caseId)` only after finding the record. It must never call `startCase` from a retry loop.

**Step 4: Verify and commit**

Run:

```bash
npm test
git add src/features/cases/useCaseWorkspace.ts src/features/cases/useCaseWorkspace.test.tsx
git commit -m "feat: wait for Maestro case registration"
```

---

## Task 9: Add the launch dialog and ten-row newest-first queue

**Files:**

- Create: `ProgramIntegrity360/PI360CodedApp/src/features/cases/StartCaseDialog.tsx`
- Create: `ProgramIntegrity360/PI360CodedApp/src/features/cases/StartCaseDialog.test.tsx`
- Create: `ProgramIntegrity360/PI360CodedApp/src/features/cases/CommandCenter.test.tsx`
- Modify: `ProgramIntegrity360/PI360CodedApp/src/features/cases/CommandCenter.tsx`
- Modify: `ProgramIntegrity360/PI360CodedApp/src/app/AppShell.tsx`
- Modify: `ProgramIntegrity360/PI360CodedApp/src/app/AppShell.test.tsx`
- Modify: `ProgramIntegrity360/PI360CodedApp/src/App.tsx`
- Modify: `ProgramIntegrity360/PI360CodedApp/src/App.test.tsx`
- Modify: `ProgramIntegrity360/PI360CodedApp/src/App.integration.test.tsx`

**Step 1: Write failing dialog and pagination tests**

Component tests must assert:

- orange `Start new case` appears in the Case queue header beside the case-count total badge;
- an authenticated empty queue still renders Command center and its launch button instead of replacing the page with an empty-state component;
- the button is disabled with a connect-to-UiPath explanation in demo mode;
- the modal defaults to `Medicaid PCS` and the authenticated email, while allowing edits;
- both scenario options submit their exact `CaseType`;
- invalid email is inline and causes zero submissions;
- pending submit disables both duplicate submit and scenario changes;
- start errors keep the modal open; registered success closes it;
- command queue sorts `sourceUpdatedAt` descending and then case ID;
- only 10 rows render per page;
- Previous and Next are disabled at boundaries;
- `Showing 1-10 of 23`, `Showing 11-20 of 23`, and `Showing 21-23 of 23` update correctly;
- a newly registered/selected case resets the queue to page one.

**Step 2: Prove the tests fail**

Run:

```bash
npm test -- src/features/cases/StartCaseDialog.test.tsx src/features/cases/CommandCenter.test.tsx src/app/AppShell.test.tsx src/App.test.tsx src/App.integration.test.tsx
```

**Step 3: Implement the modal**

Use Apollo Wind dialog, select, input, alert, and button primitives already available in the app. The primary action label changes from `Start case` to `Starting case…`; the orange styling is explicit and accessible:

```tsx
className="bg-orange-600 text-white hover:bg-orange-700 focus-visible:ring-orange-600"
```

`StartCaseDialog` receives identity email, authenticated state, start status/message, and `onStartCase`.

**Step 4: Implement ordering and paging**

Set `PAGE_SIZE = 10`. Derive a copied/sorted array:

```typescript
const orderedCases = useMemo(() => [...cases].sort((left, right) => {
  const updated = Date.parse(right.sourceUpdatedAt) - Date.parse(left.sourceUpdatedAt);
  return updated || right.id.localeCompare(left.id);
}), [cases]);
```

Paginate `orderedCases`, not the incoming array. Reset `page` to zero when the registered/selected case changes or when sorting changes put the selected new record at the head.

Keep Command center mounted for an empty case list so the launch action remains available; the table's existing `No cases available.` row is the empty presentation.

**Step 5: Wire app state**

Pass `caseWorkspace.startCase`, `caseStartStatus`, and `caseStartMessage` from `App.tsx` through `AppShell` to `CommandCenter`. On registered success, `AppShell` switches to the workspace view for the new case. On pending registration, stay on Command center and show the exact pending case-ID message.

**Step 6: Verify and commit**

Run:

```bash
npm test
npm run lint
npm run build
git add src/features/cases/StartCaseDialog.tsx src/features/cases/StartCaseDialog.test.tsx src/features/cases/CommandCenter.tsx src/features/cases/CommandCenter.test.tsx src/app/AppShell.tsx src/app/AppShell.test.tsx src/App.tsx src/App.test.tsx src/App.integration.test.tsx
git commit -m "feat: launch and page PI360 cases"
```

---

## Task 10: Run full local verification and review the diff

**Files:**

- Modify only for discovered regressions: files touched in Tasks 1–9
- Inspect: `ProgramIntegrity360/docs/superpowers/specs/2026-08-09-command-center-case-intake-design.md`

**Step 1: Run all repository contract tests**

```bash
uv run pytest test -q
```

Expected: all tests pass.

**Step 2: Run the complete coded-app gate**

```bash
cd ProgramIntegrity360/PI360CodedApp
npm test
npm run lint
npm run build
```

Expected: all tests pass, ESLint reports no errors, and the production build succeeds.

**Step 3: Validate UiPath artifacts**

```bash
cd /Users/sohail.ghatnekar/Dev/program-integrity-360/.worktrees/pi360-multiscenario-refit
uip api-workflow validate ProgramIntegrity360/PI360ApiWorkflows/Main.json --output json
uip maestro case validate ProgramIntegrity360/PI360CaseManagement/content/caseplan.json --output json
uip solution restore ProgramIntegrity360 --output json
uip solution pack ProgramIntegrity360 --dry-run --output json
```

**Step 4: Self-review against the approved design**

Run:

```bash
git diff origin/codex/pi360-multiscenario-refit...HEAD --check
git status --short
git log --oneline --decorate -12
```

Verify all of the following manually in the diff:

- no coded-app Data Fabric write;
- one process start per submission;
- six input objects and nested requester email;
- first Maestro task owns idempotent upsert;
- both scenario paths remain intact;
- page size is 10 and ordering is stable;
- no entity IDs or OAuth scopes were lost;
- no mock claim/hospital facts are presented as runtime IXP extraction.

Fix any defect with a failing regression test first, rerun the affected full gate, and commit with a scoped message.

---

## Task 11: Deploy UiPath first, publish the coded app, then update GitHub

**Files:**

- Modify: solution resource metadata produced by `uip solution resources refresh`
- Modify: coded-app version metadata required by `uip codedapp push/publish`
- Modify: `platform/cloud-playground-migration.json`
- Modify: `README.md` and `docs/04-demo-script.md` only for the new launch behavior and live version references

**Step 1: Open the deployment skills and re-confirm live target**

Read the full `uipath-solution` skill and the Data Fabric reference before making cloud changes. Then run:

```bash
uip login status --output json
git status --short --branch
```

Verify branch `codex/pi360-multiscenario-refit`, tenant `Playground`, and folder ID `2182825`.

**Step 2: Apply the additive Data Fabric schema**

Run the repository's established entity deployment command from the workspace root after the Data Fabric reference confirms its semantics:

```bash
node platform/02_entities.js
```

Read back entity `497c2d5c-7492-f111-b338-000d3ab4d3b7` and confirm `requester_email` and `maestro_instance_id` exist while all prior fields and all nine entity IDs remain intact.

**Step 3: Refresh and deploy the solution before exposing the UI**

Use current CLI help to confirm exact flags, then perform this order:

```bash
uip solution resources refresh --solution-folder ProgramIntegrity360 --output json
uip solution restore ProgramIntegrity360 --output json
uip solution pack ProgramIntegrity360 ProgramIntegrity360/.solution-packages --name ProgramIntegrity360 --version 0.6.2 --output json
uip solution publish ProgramIntegrity360/.solution-packages/ProgramIntegrity360_0.6.2.zip --wait --output json
uip solution deploy run --name ProgramIntegrity360-cloud-0.5.1 --package-name ProgramIntegrity360 --package-version 0.6.2 --folder-name ProgramIntegrity360 --parent-folder-key 7ea9add1-8aa5-4829-8939-0964c751b123 --output json
```

Pass the `PipelineDeploymentId` returned by `deploy run` to `uip solution deploy status --output json` and require `DeploymentSucceeded` plus successful activation.

Wait for a successful deployment and verify the released `Program Integrity 360 Case` contains the updated API workflow and caseplan. First try `uip solution upload ProgramIntegrity360 --output json`; the existing cloud solution is expected to refuse a non-forced upload. Before using `uip solution upload ProgramIntegrity360 --force --output json`, request explicit destructive-action approval because `--force` preserves solution ID `494be60c-8bb2-4478-3beb-08def46ec69f` but erases its Studio Web version history.

**Step 4: Publish the coded app to the existing URL**

Bump the coded app from deployed `0.5.5` to `0.5.6`, then run from `ProgramIntegrity360/PI360CodedApp`:

```bash
npm test
npm run lint
npm run build
uip codedapp push --project-id 28789571-ca47-4370-9649-d3f1b63d3a14 --build-dir dist --version 0.5.6 --output json
uip codedapp pack dist --name pi360-coded-app --version 0.5.6 --description "Program Integrity 360 Data Fabric case workbench with Command center intake" --author "UiPath Public Sector" --content-type webapp --output .uipath
uip codedapp publish --name pi360-coded-app --version 0.5.6 --type Web --uipath-dir .uipath --output json
uip codedapp deploy --name pi360-coded-app --version 0.5.6 --folder-key 5db31dd1-1073-4f9e-b44b-76f5484e03c4 --org-name uipathlabs --output json
```

Before `push`, verify project ID `28789571-ca47-4370-9649-d3f1b63d3a14` is still the coded-app project referenced by the user-supplied Studio Web link. The deployment must upgrade system `ID278b47bdb4d24033ab498eb94bec6e8b` so the URL remains `https://uipathlabs.uipath.host/pi360-coded-app`. Verify the live page authenticates and shows the orange button, 10-row paging, and both scenario options.

**Step 5: Obtain side-effect approval for one smoke case**

Ask the user to approve one live process start. After approval, create one scenario through the UI and verify:

1. exactly one Orchestrator job is started with the case ID as `reference`;
2. the first Maestro task creates one `PI360ProgramIntegrityCase` record;
3. the queue finds it, resets to page one, and opens its workspace;
4. refreshing or retrying the intake task updates rather than duplicates the record.

If approval is not granted, stop after deployment verification and report that runtime creation was intentionally not exercised.

**Step 6: Update docs, verify, commit, and push**

Keep README changes concise and update the demo script to start from Command center. Then run:

```bash
uv run pytest test -q
cd ProgramIntegrity360/PI360CodedApp
npm test
npm run lint
npm run build
cd /Users/sohail.ghatnekar/Dev/program-integrity-360/.worktrees/pi360-multiscenario-refit
git add README.md docs/04-demo-script.md platform/cloud-playground-migration.json ProgramIntegrity360/resources ProgramIntegrity360/PI360CodedApp
git commit -m "chore: deploy command center case intake"
git push origin codex/pi360-multiscenario-refit
```

Update the existing pull request rather than opening a competing PR. Report the commit SHA, solution deployment ID/status, coded-app version/revision, unchanged hosted URL, and whether the live smoke case was exercised.

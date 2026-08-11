# Task 4 Report: PI360 Provider-Record BPMN

## Status

Implemented the provider-record wait process in `PI360AdHocReviewBpmn`. The investigator gate prevents an unapproved provider request, the approved path reaches the visible P3D timer, a missing record returns an awaiting-provider timeout without claiming analysis, and a received record is synchronously intaken before returning `NextStageId = Stage_Corr4a`.

## Registry and template resolution

- UiPath CLI: `1.198.0-preview.102`; all commands used `UIPATH_CLI_DISABLE_VERSION_SYNC=1`.
- The first sandboxed registry-pull attempt was denied before it could write `~/.uipath/maestro/registry.json`. The approved retry completed the one successful fresh registry pull: 30 extension types and 1,206 processes, including 48 API processes.
- `registry search PI360ApiWorkflows` resolved one API process:
  - Process key: `ProgramIntegrity360.Api.PI360ApiWorkflows`
  - Process version: `1.0.0`
  - Release key: `02F01EE0-324D-4397-8433-5F074899A866`
  - Folder: `AMER Presales/Public Sector/ProgramIntegrity360`
  - Folder key: `5db31dd1-1073-4f9e-b44b-76f5484e03c4`
- The local solution artifact `resources/solution_folder/process/api/PI360ApiWorkflows.json` is the package binding authority:
  - Solution process resource key: `9c77c6aa-3a07-4053-a559-28c98f2520a3`
  - Project key: `9dd25760-de4f-4b0b-bfc8-ecdbcd48f863`
  - Package resource key: `f3c10615-185f-4eea-bcb8-c6c549eaab80`
  - Solution-relative resource identity: `solution_folder.PI360ApiWorkflows`
- `registry get Orchestrator.ExecuteApiWorkflow` returned `Extension type not found`.
- The current registry exposes `Orchestrator.ExecuteApiWorkflowAsync` as the sole API-workflow activity. Its authoritative label is `Start and wait for API workflow [Preview]`, its host is `bpmn:ServiceTask`, and its output contract is `Process response` / `Orchestrator.RunJob`. Both API tasks use that exact registry-backed start-and-wait payload so downstream work has a result before continuing.
- `registry get Intsvc.TimerTrigger` returned a start-event-only trigger template with a PT1H default. It is not valid for an intermediate wait. The P3D `bpmn:intermediateCatchEvent` therefore comes from the mandated structural BPMN timer contract; intermediate timer payloads are a registry gap and carry no `uipath:*` activity payload.
- `uip user` reported `Not logged in`, so direct current-user/tenant confirmation remained unavailable. Registry process discovery still succeeded. No tenant operation was executed.

## Structural edits

Preserved compatible brownfield identities:

- Definitions: `Definitions_PI360_AdHocReview`
- Process: `Process_1`
- Entry point ID: `653364ff-7770-494b-b2e3-9d0217d16635`
- Migration version: `18`
- Operate project ID remained unchanged in the untouched `operate.json`.

The executable topology is:

```text
Start -> InvestigatorProceed?
  false -> Blocked end
  true  -> RequestHospitalRecord -> P3D timer -> HospitalRecordAvailable?
    false -> TimedOutAwaitingProvider end
    true  -> IntakeHospitalRecord -> Return to Investigation
```

Removed all Evidence Snapshot RPA, Case Manager agent, unsupported audit-trail activity, and their variables/bindings. The BPMN contains no RPA, IXP, email, agent, or `CreateCaseAuditTrail` activity.

The diagram has one non-overlapping `BPMNShape` for every event, gateway, and activity, plus one `BPMNEdge` with waypoints for every sequence flow. The P3D timer has its own visible shape.

## Interface and binding changes

`entry-points.json` now declares exactly these PascalCase inputs:

- `CaseId`
- `CaseType`
- `ProviderId`
- `HospitalRecordAvailable`
- `InvestigatorProceed`

It declares exactly these outputs:

- `ProviderRequestStatus`
- `HospitalRecordAvailable`
- `NextStageId`
- `AuditMessage`

Outcome mappings are explicit:

- `InvestigatorProceed = false`: `Blocked`, `Stage_Prreq6`, and a no-analysis audit message. `RequestHospitalRecord` is not called.
- No record after P3D: `TimedOutAwaitingProvider`, `Stage_Prreq6`, and a no-analysis audit message. `IntakeHospitalRecord` is not called.
- Record available: `Completed`, `HospitalRecordAvailable = true`, `Stage_Corr4a`, and return-to-Investigation audit text.

`bindings_v2.json` contains only the exact local PI360 API process resource key `9c77c6aa-3a07-4053-a559-28c98f2520a3`. The BPMN keeps the existing stable `Bind_ApiKey`, `Bind_ApiFolder`, and `Bind_ApiName` identifiers and resolves them through `solution_folder.PI360ApiWorkflows`.

## Validation and tests

Bundled validator:

```text
node validate-bpmn.mjs .../PI360AdHocReviewBpmn.bpmn
VALID
```

Focused Task 4 contract test:

```text
1 passed in 0.01s
```

The test now pins the registry-backed start-and-wait activity type, its `Process response` output, the exact API resource key, exact entry-point property sets, the pre-request investigator gate, blocked no-analysis behavior, Request-to-Timer-to-Intake reachability, the P3D timer shape, timeout status, and successful `Stage_Corr4a` output.

Required two-file focused command:

```text
10 passed, 3 failed in 0.06s
```

All three failures are outside Task 4 and were already present in the baseline run: the Case Plan still lacks PI360CaseManagerFlow and PI360AdHocReviewBpmn bindings/tasks, still contains the closure-email task, and its generated `bindings_v2.json` lacks the two new process bindings. The Task 4 BPMN test passes within that command.

`git diff --check` passed. The banned-activity scan returned no matches in `PI360AdHocReviewBpmn`.

## Files and commit

Modified:

- `ProgramIntegrity360/PI360AdHocReviewBpmn/PI360AdHocReviewBpmn.bpmn`
- `ProgramIntegrity360/PI360AdHocReviewBpmn/bindings_v2.json`
- `ProgramIntegrity360/PI360AdHocReviewBpmn/entry-points.json`
- `test/test_solution_upgrade_safety.py`

Added:

- `.superpowers/sdd/2026-08-11-case-flow-bpmn-orchestration/task-4-report.md`

Commit message: `feat: orchestrate hospice provider record wait in bpmn`. The resulting commit hash is recorded in the task handoff and Git history.

## Self-review and concerns

- Every `uipath:activity` payload is based on the current `registry get Orchestrator.ExecuteApiWorkflowAsync` template; structural gateways, timer, flows, conditions, and DI follow the structural reference.
- The `Async` type suffix is misleading in this installed registry. The registry itself labels this type `Start and wait for API workflow [Preview]`; the non-Async key required by the prose does not exist. This mismatch is pinned in the contract test through the exact type and result output.
- The P3D wait is a modeled timer. This task did not run an instance, authenticated API Workflow, Case/Flow debug, cloud upload/publish/deploy, IXP, RPA, agent, or email.
- The full focused command remains red only because dependent Case Plan work is not yet present; Task 4's own validator and focused contract test are green.

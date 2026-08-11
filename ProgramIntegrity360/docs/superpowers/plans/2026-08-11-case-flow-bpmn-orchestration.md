# Program Integrity 360 Case Flow and BPMN Orchestration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Case Plan explicitly execute the existing Maestro Flow for evidence routing and the existing Maestro BPMN for the hospice provider-record wait path, using the two published Beeceptor claim endpoints and excluding IXP, RPA automation, and automated email from the active runtime graph.

**Architecture:** The Case Plan remains the lifecycle authority and invokes `PI360CaseManagerFlow` as the Evidence Acquisition process dependency. The Flow retrieves normalized claim details through `PI360ClaimDetailsApi`, applies the deterministic rules agent, and returns a routing recommendation; the Case Plan invokes `PI360AdHocReviewBpmn` only for the State Medicaid Hospice provider-record stage, where the BPMN requests the hospital record, waits 72 hours, ingests response metadata, and returns control to Investigation. Existing Data Fabric intake, human tasks, investigator/supervisor agents, and closure persistence remain in place.

**Tech Stack:** UiPath Case Management (`caseplan.json`), UiPath Maestro Flow (`.flow`), UiPath Process Orchestration (`.bpmn`), UiPath API Workflows (Serverless Workflow JSON), UiPath Solution CLI, Python/pytest contract tests, Node-based BPMN validator.

## Global Constraints

- Use `CaseType` as the initial route driver with exact values `MedicaidPCS` and `StateMedicaidHospice`.
- Use `https://medicaid-claim-demo.free.beeceptor.com/MedicaidPCS` for PCS and `https://medicaid-claim-demo.free.beeceptor.com/StateMedicaidHospice` for hospice.
- Claim retrieval must use HTTP `GET`.
- Keep the six manual-trigger objects separate: `caseInput`, `claimInput`, `memberInput`, `providerInput`, `serviceEventInput`, and `documentInput`.
- Do not execute IXP, RPA automation, or automated email in the active Case, Flow, or BPMN graph.
- Preserve Data Fabric intake through `PI360ApiWorkflows/IntakeClaimByCaseType` and its existing `Program Integrity Fabric` connection.
- Preserve investigator and supervisor human-intervention tasks and the existing agentic investigation boundary.
- Hospice threshold is `$2,500`; PCS threshold is `360` conflict minutes.
- Preserve stable project IDs and existing unsuffixed solution resources; do not create `_1` copies.
- Do not run Case debug, Flow debug, BPMN instances, or authenticated API Workflow executions without a separate explicit runtime consent.
- Before upload, publish, or deploy: validate locally, refresh solution resources, inspect the package, and verify the active login target is `uipathlabs / Playground`.
- Do not force-overwrite Studio Web history unless the user separately authorizes that destructive operation.

---

### Task 1: Lock the orchestration contract with failing tests and reconcile cloud state

**Files:**
- Modify: `test/test_api_workflow_contract.py`
- Modify: `test/test_case_manager_flow.py`
- Modify: `test/test_caseplan_multiscenario.py`
- Modify: `test/test_solution_upgrade_safety.py`
- Test: the four files above

**Interfaces:**
- Consumes: the approved design in `ProgramIntegrity360/docs/superpowers/specs/2026-08-11-case-flow-bpmn-orchestration-design.md`.
- Produces: executable assertions for the Claim API, Flow, BPMN, Case Plan, and solution resource relationships used by Tasks 2–5.

- [ ] **Step 1: Download the current Studio Web solution to a temporary directory and compare it with this worktree**

Run the read-only download using `UIPATH_CLI_DISABLE_VERSION_SYNC=1`, verify the returned solution ID is `494be60c-8bb2-4478-3beb-08def46ec69f`, and record any cloud-only changes before editing. Do not replace local files automatically.

- [ ] **Step 2: Add a failing Claim API assertion for GET and the exact two routes**

Extend `test_claim_workflow_uses_stubbed_http_activity_for_both_beeceptor_routes` to assert:

```python
assert activity["with"]["method"] == "GET"
assert activity["with"]["bodyParameters"]["method"] == "GET"
assert '"httpMethod":"GET"' in activity["metadata"]["configuration"]
assert "https://medicaid-claim-demo.free.beeceptor.com/MedicaidPCS" in url_expression
assert "https://medicaid-claim-demo.free.beeceptor.com/StateMedicaidHospice" in url_expression
```

- [ ] **Step 3: Replace Flow assertions that require IXP/RPA with the approved active graph**

Assert that:

```python
node_types = {node["type"] for node in flow["nodes"]}
assert "core.logic.mock" not in node_types
assert not any("rpa" in node_type.lower() for node_type in node_types)
assert "extractServiceEvidenceIxp" not in {node["id"] for node in flow["nodes"]}
assert "extractInstitutionalEncounterIxp" not in {node["id"] for node in flow["nodes"]}
assert "evidenceSnapshotRpa" not in {node["id"] for node in flow["nodes"]}
```

Also assert the Flow exposes the output contract `caseId`, `caseType`, `claimCount`, `lineCount`, `totalUnits`, `totalBilled`, `claimThreshold`, `thresholdExceeded`, `recommendedStageId`, and `routeReason`.

- [ ] **Step 4: Replace Case assertions with one Flow process task and one BPMN process task**

Assert the Evidence stage contains one `process` task named `Flow - acquire and validate claim evidence`, the Provider stage contains one `process` task named `BPMN - request and await hospital record`, the provider process runs only for `StateMedicaidHospice`, and active task display names contain none of `IXP`, `RPA`, or `send closure summary`.

- [ ] **Step 5: Add BPMN and solution-resource assertions**

Parse `PI360AdHocReviewBpmn.bpmn` as XML and assert it contains the request API activity, a timer with `P3D`, the intake API activity, a complete BPMN diagram, and no RPA activity. Extend solution safety assertions so both `PI360CaseManagerFlow` and `PI360AdHocReviewBpmn` resolve as unique unsuffixed process resources and Case bindings reference their exact resource keys.

- [ ] **Step 6: Run the focused tests and verify the new assertions fail for the expected legacy graph**

Run:

```bash
uv run --with pytest pytest test/test_api_workflow_contract.py test/test_case_manager_flow.py test/test_caseplan_multiscenario.py test/test_solution_upgrade_safety.py -q
```

Expected: failures specifically identify HTTP POST, active IXP/RPA nodes, missing Case process tasks, and the old BPMN chain.

- [ ] **Step 7: Commit the red contract tests**

```bash
git add test/test_api_workflow_contract.py test/test_case_manager_flow.py test/test_caseplan_multiscenario.py test/test_solution_upgrade_safety.py
git commit -m "test: define case flow and bpmn runtime contract"
```

### Task 2: Correct the Beeceptor Claim API contract

**Files:**
- Modify: `ProgramIntegrity360/PI360ClaimDetailsApi/Workflow.json`
- Test: `test/test_api_workflow_contract.py`

**Interfaces:**
- Consumes: `caseType` with `MedicaidPCS` or `StateMedicaidHospice`.
- Produces: normalized `payload`, `claimCount`, `lineCount`, `totalUnits`, and `totalBilled` used by the Flow.

- [ ] **Step 1: Inspect the existing HTTP activity and preserve its registry-generated identity fields**

Confirm the activity remains `call: "UiPath.Http"`, uses `ImplicitConnection`, and retains its existing `uiPathActivityTypeId`, slot key, export bucket key, connector key, object name, package version, and saved JIT input field ID.

- [ ] **Step 2: Change only the request contract to GET and exact CaseType routing**

Set both `with.method` and `bodyParameters.method` to `GET`, and change both `httpMethod` values inside `metadata.configuration` to `GET`. Preserve the conditional expression but ensure its two literal URLs are exactly:

```text
https://medicaid-claim-demo.free.beeceptor.com/MedicaidPCS
https://medicaid-claim-demo.free.beeceptor.com/StateMedicaidHospice
```

- [ ] **Step 3: Validate the API Workflow statically**

Run:

```bash
UIPATH_CLI_DISABLE_VERSION_SYNC=1 uip api-workflow validate ProgramIntegrity360/PI360ClaimDetailsApi/Workflow.json --output json
```

Expected: `Result: Success` and `Data.Status: Valid`. Do not run the workflow.

- [ ] **Step 4: Run the focused contract test**

```bash
uv run --with pytest pytest test/test_api_workflow_contract.py -q
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add ProgramIntegrity360/PI360ClaimDetailsApi/Workflow.json
git commit -m "fix: retrieve claim details from beeceptor with get"
```

### Task 3: Refactor `PI360CaseManagerFlow` into the evidence-routing process

**Files:**
- Modify: `ProgramIntegrity360/PI360CaseManagerFlow/PI360CaseManagerFlow.flow`
- Modify if required by validation: `ProgramIntegrity360/PI360CaseManagerFlow/bindings_v2.json`
- Modify if required by validation: `ProgramIntegrity360/PI360CaseManagerFlow/entry-points.json`
- Test: `test/test_case_manager_flow.py`

**Interfaces:**
- Consumes: the six separate object inputs and the Claim API output from Task 2.
- Produces: `caseId`, `caseType`, `claimCount`, `lineCount`, `totalUnits`, `totalBilled`, `claimThreshold`, `thresholdExceeded`, `recommendedStageId`, and `routeReason`.

- [ ] **Step 1: Pull and inspect the Flow registry, then verify sibling resources**

Run tenant search and local solution discovery for `PI360ClaimDetailsApi`, `PI360QuickRulesCodedAgent`, and `PI360CaseManagerAgent`. Reuse their current exact resource node types and keys; do not create resources.

- [ ] **Step 2: Remove the two IXP mock nodes and the Evidence Snapshot RPA node**

Delete nodes `extractServiceEvidenceIxp`, `extractInstitutionalEncounterIxp`, and `evidenceSnapshotRpa`, plus only their incident edges, variables, and dead bindings.

- [ ] **Step 3: Wire the deterministic active chain**

The active order must be:

```text
start -> normalizeCase -> claimDetailsByCaseType -> quickRulesByCaseType
      -> buildGroundedCaseContext -> agentSelectNextCaseStage1
      -> needsProviderResponse -> route/end
```

The grounded context must use normalized claim totals and rule outputs rather than IXP/RPA placeholders. The agent recommendation must be constrained to `Stage_Evcol2`, `Stage_Corr4a`, `Stage_Prreq6`, `Stage_Supv7a`, or `Stage_Clos9a`; the deterministic hospice-provider condition takes precedence when the hospital record is not yet available.

- [ ] **Step 4: Emit the complete routing output contract**

Map the ten output fields exactly. For hospice at or above `$2,500`, set `recommendedStageId` to the Provider Request stage; for PCS at or above `360` conflict minutes, recommend Investigation; otherwise return the existing lower-risk review/closure route defined by the Flow.

- [ ] **Step 5: Validate and format the Flow**

Run the supported local `uip maestro flow validate` command for this CLI version, inspect warnings as well as exit status, and format only after validation. Do not run Flow debug.

- [ ] **Step 6: Run the focused tests**

```bash
uv run --with pytest pytest test/test_case_manager_flow.py test/test_api_workflow_contract.py -q
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add ProgramIntegrity360/PI360CaseManagerFlow test/test_case_manager_flow.py
git commit -m "feat: make maestro flow own claim evidence routing"
```

### Task 4: Refactor `PI360AdHocReviewBpmn` into the provider-record wait process

**Files:**
- Modify: `ProgramIntegrity360/PI360AdHocReviewBpmn/PI360AdHocReviewBpmn.bpmn`
- Modify: `ProgramIntegrity360/PI360AdHocReviewBpmn/bindings_v2.json`
- Modify: `ProgramIntegrity360/PI360AdHocReviewBpmn/entry-points.json`
- Test: `test/test_caseplan_multiscenario.py`
- Test: `test/test_solution_upgrade_safety.py`

**Interfaces:**
- Consumes: `CaseId`, `CaseType`, `ProviderId`, `HospitalRecordAvailable`, and `InvestigatorProceed` from the Case Plan.
- Produces: `ProviderRequestStatus`, `HospitalRecordAvailable`, `NextStageId`, and `AuditMessage`; the successful route returns `NextStageId = Stage_Corr4a`.

- [ ] **Step 1: Pull the BPMN registry once and fetch exact API Workflow and timer templates**

Resolve the existing `PI360ApiWorkflows` entry point for `RequestHospitalRecord` and `IntakeHospitalRecord`, plus the timer node. Persist their exact registry-provided `uipath:*` payloads and resource identifiers; do not reuse the unsupported `CreateCaseAuditTrail` binding.

- [ ] **Step 2: Read the structural BPMN reference and preserve stable project/process identifiers**

Keep existing definitions, process, entry point, migration metadata, and project IDs when compatible. Make surgical replacements for the old RPA/agent/audit chain.

- [ ] **Step 3: Author the required sequence**

Use this visible canvas sequence:

```text
Start -> API: Request hospital record -> Timer: Await response (P3D)
      -> API: Intake hospital record -> End: Return to Investigation
```

No RPA, IXP, email, CaseManager agent, or audit-trail call may remain in this BPMN.

- [ ] **Step 4: Add complete BPMN DI layout**

Create one `BPMNShape` for each event/activity and one `BPMNEdge` for each sequence flow, with non-overlapping left-to-right bounds and valid waypoints.

- [ ] **Step 5: Synchronize BPMN bindings and entry-point schemas**

Bind only the exact `PI360ApiWorkflows` resource needed by the two API activities. Declare the exact PascalCase inputs and outputs in the interface above; remove stale Evidence Snapshot RPA, agent, and unsupported audit-trail bindings. If `InvestigatorProceed` is false, return a blocked result; if the timer expires without a record, return a timed-out or awaiting-provider result without claiming analysis occurred.

- [ ] **Step 6: Validate with the bundled BPMN validator**

Run:

```bash
cd /Users/sohail.ghatnekar/.agents/skills/uipath-maestro-bpmn/validator
npm install --silent
node validate-bpmn.mjs /Users/sohail.ghatnekar/Dev/program-integrity-360/.worktrees/pi360-multiscenario-refit/ProgramIntegrity360/PI360AdHocReviewBpmn/PI360AdHocReviewBpmn.bpmn
```

Expected: `VALID`, with no ERROR-severity findings. Do not run a BPMN instance.

- [ ] **Step 7: Run focused tests and commit**

```bash
uv run --with pytest pytest test/test_caseplan_multiscenario.py test/test_solution_upgrade_safety.py -q
git add ProgramIntegrity360/PI360AdHocReviewBpmn test/test_caseplan_multiscenario.py test/test_solution_upgrade_safety.py
git commit -m "feat: orchestrate hospice provider record wait in bpmn"
```

### Task 5: Wire Flow and BPMN into the brownfield Case Plan

**Files:**
- Modify: `ProgramIntegrity360/PI360CaseManagement/content/caseplan.json`
- Modify: `ProgramIntegrity360/PI360CaseManagement/bindings_v2.json`
- Modify: `ProgramIntegrity360/PI360CaseManagement/entry-points.json`
- Regenerate: `ProgramIntegrity360/PI360CaseManagement/content/caseplan.json.bpmn`
- Test: `test/test_caseplan_multiscenario.py`
- Test: `test/test_solution_upgrade_safety.py`

**Interfaces:**
- Consumes: Flow and BPMN process resource keys resolved from the fresh Case registry.
- Produces: a six-stage Case lifecycle whose Evidence and Provider stages execute those two process dependencies.

- [ ] **Step 1: Pull the current Case registry and describe both ProcessOrchestration resources**

Resolve `PI360CaseManagerFlow` and `PI360AdHocReviewBpmn` from the refreshed `processOrchestration-index.json`, then run `uip maestro case tasks describe --type process --id <entityKey> --output json` for each. Persist their selected matches and rationale in the existing Case registry-resolution audit file if present.

- [ ] **Step 2: Replace the Evidence task group with the Flow process task**

Create one required `process` task named `Flow - acquire and validate claim evidence`, use `=bindings.<flowBindingId>` for its process name/folder path fields, map the six Case inputs, and map its ten outputs into Case variables. Remove the direct claim API, service-evidence IXP mock, and evidence-validation mock from this stage.

- [ ] **Step 3: Replace the Provider task group with the BPMN process task**

Create one required `process` task named `BPMN - request and await hospital record`, use `=bindings.<bpmnBindingId>`, pass Case/claim/provider/document context, and map the BPMN outputs. Its entry condition must require `caseType == 'StateMedicaidHospice'` and the Flow recommendation for the Provider Request stage.

- [ ] **Step 4: Simplify downstream boundaries without changing the journey**

Keep the Evidence Correlation agent, investigator human action, Agentic Caseworker confirmation, supervisor human action, and closure persistence API. Remove `PrepareSupervisorPacket` as a required predecessor and remove the `SendClosureSummaryEmail` task. Feed the supervisor action directly from investigator findings plus agentic evidence.

- [ ] **Step 5: Update Case bindings using exact unsuffixed resource keys**

The Case project must contain exactly the existing CaseManager agent binding, existing escalation app binding, new Flow process binding, and new BPMN process binding. Do not bind any `_1` resource.

- [ ] **Step 6: Validate and regenerate the compiled Case BPMN**

Run full Case validation using the supported CLI contract for this version. Regenerate `content/caseplan.json.bpmn`, verify the manual-trigger entry point remains `/content/caseplan.json.bpmn#trigger_1`, and do not run Case debug.

- [ ] **Step 7: Run focused tests and commit**

```bash
uv run --with pytest pytest test/test_caseplan_multiscenario.py test/test_solution_upgrade_safety.py -q
git add ProgramIntegrity360/PI360CaseManagement test/test_caseplan_multiscenario.py test/test_solution_upgrade_safety.py
git commit -m "feat: invoke flow and bpmn from case plan"
```

### Task 6: Align authoritative demo documentation

**Files:**
- Modify: `README.md`
- Modify: `CANON.md`
- Modify: `docs/03-data-model.md`
- Modify: `docs/04-demo-script.md`
- Modify: `docs/05-launch-checklist.md`

**Interfaces:**
- Consumes: final artifact behavior from Tasks 2–5.
- Produces: one consistent shareable story and operator checklist.

- [ ] **Step 1: Update the runtime architecture narrative**

Describe Case as lifecycle authority, Flow as claim-evidence/routing authority, BPMN as the 72-hour hospice provider-record wait path, and Data Fabric as the persistent system of record.

- [ ] **Step 2: Update the demo script with both CaseType paths**

Show exact Beeceptor GET routes, PCS `360`-minute rule, hospice `$2,500` threshold, Jordan Ellis inpatient contradiction, provider BPMN timer, investigation handoff, supervisor evidence tab, and closure disposition. State explicitly that IXP, RPA automation, and automated email are deferred and are not executed in this build.

- [ ] **Step 3: Update the launch checklist**

Add checks for Flow/BPMN Case bindings, GET endpoints, regenerated Case BPMN, no `_1` dependencies, and absence of active IXP/RPA/email nodes.

- [ ] **Step 4: Check documentation for contradictory active-runtime claims**

Run:

```bash
rg -n "IXP|Evidence Snapshot|SendClosureSummaryEmail|automated email|RPA" README.md CANON.md docs/03-data-model.md docs/04-demo-script.md docs/05-launch-checklist.md
```

Every remaining match must clearly say deferred/not active or identify a historical artifact that is not invoked.

- [ ] **Step 5: Commit**

```bash
git add README.md CANON.md docs/03-data-model.md docs/04-demo-script.md docs/05-launch-checklist.md
git commit -m "docs: align demo with case flow and bpmn runtime"
```

### Task 7: Verify, package, upgrade UiPath, and update GitHub

**Files:**
- Modify through CLI only: `ProgramIntegrity360/ProgramIntegrity360.uipx` and generated solution-resource artifacts when `resources refresh` changes them
- Create outside source tree: packaged solution build output in `/private/tmp`

**Interfaces:**
- Consumes: the complete locally validated branch.
- Produces: a verified solution package, an upgraded `uipathlabs / Playground` deployment, and an updated remote branch/PR.

- [ ] **Step 1: Run all repository contract tests**

```bash
uv run --with pytest pytest test -q
```

Expected: PASS.

- [ ] **Step 2: Run Coded App validation because the branch contains JavaScript changes from earlier tasks**

From `ProgramIntegrity360/PI360CodedApp`, run:

```bash
npm test
npm run lint
npm run build
```

Expected: all PASS. Do not change the Coded App unless a regression is attributable to this branch.

- [ ] **Step 3: Re-run all UiPath artifact validators**

Validate the Claim API, Flow, BPMN, and Case Plan using the exact commands established in Tasks 2–5. Confirm no debug/run command was invoked.

- [ ] **Step 4: Verify authentication and probe the solution CLI**

Run:

```bash
UIPATH_CLI_DISABLE_VERSION_SYNC=1 uip login status --output json
UIPATH_CLI_DISABLE_VERSION_SYNC=1 uip solution init --help --output json
```

Proceed only when the target is organization `uipathlabs`, tenant `Playground`.

- [ ] **Step 5: Refresh resources and inspect the solution manifest**

Run `uip solution resources refresh --solution-folder ProgramIntegrity360 --output json`. Verify `.uipx` and `resources/solution_folder/` contain the same project/resource set, no suffixed duplicates appear, and Case runtime dependencies include the exact Flow and BPMN process keys.

- [ ] **Step 6: Pack into a fresh temporary directory**

Use `mktemp -d` and run `uip solution pack` with the next non-colliding package version. Inspect the resulting ZIP manifest and bundled Case/Flow/BPMN/API artifacts before publishing.

- [ ] **Step 7: Upload/publish/deploy the existing solution upgrade**

Use `uip solution upload` only for the existing Studio Web solution and `uip solution publish` plus `uip solution deploy run` for the existing deployed solution/folder. Preserve solution ID `494be60c-8bb2-4478-3beb-08def46ec69f` and existing deployment ownership. If the CLI reports that upload requires force-overwrite/version-history deletion, stop and request explicit destructive approval instead of forcing it.

- [ ] **Step 8: Verify the deployed solution state**

Read deployment status with `uip solution deploy status --output json`; confirm the deployment is active and its resources resolve without `_1` copies. Do not start a Case, Flow, BPMN, or API runtime during this verification.

- [ ] **Step 9: Commit generated resource-refresh changes if any**

```bash
git add ProgramIntegrity360/ProgramIntegrity360.uipx ProgramIntegrity360/resources ProgramIntegrity360/userProfile
git commit -m "build: refresh orchestration solution resources"
```

Skip this commit if refresh produced no tracked changes.

- [ ] **Step 10: Push the isolated branch and update the existing pull request**

```bash
git push origin codex/pi360-multiscenario-refit
```

Verify the remote head matches local HEAD and report the existing PR URL.

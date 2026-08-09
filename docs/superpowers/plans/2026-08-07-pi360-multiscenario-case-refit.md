# Program Integrity 360 Multi-Scenario Case Refit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve the working Medicaid PCS case, add the state Medicaid hospice case, simplify the shared six-stage journey, publish two IXP extraction models, and deploy solution version `0.6.1` to UiPath Playground.

**Architecture:** `CaseType` selects `MedicaidPCS` or `StateMedicaidHospice` at intake. Both scenarios reuse the existing Case Management project, Maestro Flow, deterministic quick-rules agent, Agentic Caseworker, Data Fabric audit model, human gates, and coded-app contracts; only the evidence profile, rules, Beeceptor route, and provider-request behavior vary.

**Tech Stack:** UiPath CLI `1.198.x`, Case Management, Maestro Flow, API Workflows, UiPath Agents, IXP, Action Center, Data Fabric, Orchestrator Storage Buckets, Python 3.11 with `uv`, ReportLab, pypdf, Node.js, Git, and GitHub.

## Global Constraints

- Target `https://cloud.uipath.com`, organization `uipathlabs`, tenant `Playground`.
- Target folder `AMER Presales/Public Sector/ProgramIntegrity360`, folder key `5db31dd1-1073-4f9e-b44b-76f5484e03c4`.
- Preserve the existing coded-app visual design and do not publish a coded-app release in this pass.
- Preserve `PI-PCS-2026-0041` and add `PI-HSP-2026-0042`.
- Accept only `MedicaidPCS` and `StateMedicaidHospice` as `CaseType` values.
- Use `https://medicaid-claim-demo.free.beeceptor.com/MedicaidPCS` and `https://medicaid-claim-demo.free.beeceptor.com/StateMedicaidHospice`.
- Use a `$2,500` hospice routing threshold and a 72-hour provider-response timer.
- Deterministic code calculates thresholds, supported units, overlaps, and location conflicts; agents explain and organize only.
- Never describe the hospital packet as inpatient; its patient class is observation.
- Run `npm test` after every JavaScript modification.
- Use `uv` for all Python dependency management.
- Preserve `ProgramIntegrity360-Demo-Build-Gap-Analysis.docx`, `build_gap_analysis.py`, and `build_gap_analysis_condensed.py` without staging them.
- Do not delete or overwrite the active `0.5.1` deployment as a rollback mechanism.

---

## File Structure

- `data/case_type_profiles.json`: canonical case-type routing and evidence profiles.
- `data/hospice_case.json`, `data/hospice_claims.json`, `data/hospice_members.json`, `data/institutional_encounters.json`: hospice fixtures.
- `documents/generate_pcs_documents.py`: deterministic synthetic PCS PDF generator.
- `documents/pcs/*.pdf`: six generated PCS evidence PDFs.
- `documents/tests/test_generate_pcs_documents.py`: content assertions for generated PDFs.
- `ProgramIntegrity360/PI360QuickRulesCodedAgent/main.py`: deterministic case-type and conflict rules.
- `ProgramIntegrity360/PI360QuickRulesCodedAgent/tests/test_quick_rules.py`: unit tests for PCS and hospice routing.
- `ProgramIntegrity360/PI360ApiWorkflows/Main.json`: Beeceptor GET, response normalization, and workflow contracts.
- `ProgramIntegrity360/PI360CaseManagement/content/caseplan.json`: shared six-stage case and simplified tasks.
- `ProgramIntegrity360/PI360CaseManagerFlow/PI360CaseManagerFlow.flow`: six-object intake normalization and `CaseType` routing.
- `ProgramIntegrity360/PI360CaseManagerAgent/agent.json`: Agentic Caseworker prompt and output contract.
- `ixp/ixp-taxonomy.md`: two-model taxonomy and confidence routing.
- `platform/01_choicesets.js`, `platform/02_entities.js`, `platform/03_seed.js`: additive Data Fabric schema and both-case seed data.
- `platform/cloud-playground-migration.json`: version `0.6.1` deployment and model/bucket identifiers.
- `README.md`, `CANON.md`, `docs/03-data-model.md`, `docs/04-demo-script.md`, `solution/deploy.md`: multi-scenario narrative and operations.

---

### Task 1: Freeze Baseline and Verify Live Resources

**Required specialist skills:** `uipath-platform`, then `uipath-solution` for deployment inspection only.

**Files:**
- Read: `platform/cloud-playground-migration.json`
- Read: `ProgramIntegrity360/ProgramIntegrity360.uipx`
- Modify: none

**Interfaces:**
- Consumes: current branch, auth session, active solution, bucket inventory, Data Fabric inventory, and IXP inventory.
- Produces: verified baseline for every later mutation.

- [ ] **Step 1: Verify repository isolation**

Run:

```bash
git status --short --branch
git diff --check
```

Expected: isolated branch `codex/pi360-multiscenario-refit`; the three known gap-analysis files remain only in the original checkout and are never staged.

- [ ] **Step 2: Verify UiPath auth and installed surfaces**

Run:

```bash
uip login status --output json
uip tools list --output json
```

Expected: `cloud.uipath.com / uipathlabs / Playground`; tools expose solution, Maestro, Agent, IXP, API Workflow, Orchestrator, and Data Fabric commands.

- [ ] **Step 3: Read back the active solution and folder**

Run:

```bash
uip solution deploy status 30c60010-f31f-4d6e-d26d-08def493cb98 --output json
uip or folders list --all --name ProgramIntegrity360 --output json
```

Expected: active version `0.5.1`, activation `SuccessfulActivate`, folder key `5db31dd1-1073-4f9e-b44b-76f5484e03c4`.

- [ ] **Step 4: Inventory storage, IXP, and Data Fabric without mutation**

Use the exact read-only list commands exposed by `uip --help-all` for buckets, bucket files, IXP projects/models, choice sets, entities, and record counts. Save command output under `/private/tmp/pi360-0.6.1-baseline/` and record only durable identifiers in `platform/cloud-playground-migration.json` during Task 8.

---

### Task 2: Add Canonical Multi-Scenario Fixtures

**Files:**
- Create: `data/case_type_profiles.json`
- Create: `data/hospice_case.json`
- Create: `data/hospice_claims.json`
- Create: `data/hospice_members.json`
- Create: `data/institutional_encounters.json`
- Create: `test/test_multiscenario_fixtures.py`
- Modify: `data/cases.json`
- Modify: `data/evidence_documents.json`
- Modify: `data/risk_signals.json`

**Interfaces:**
- Consumes: approved case IDs and exact Beeceptor/document facts.
- Produces: `CaseTypeProfile`, hospice case, claim lines, member, encounter, evidence, and deterministic signal fixtures used by Tasks 3-8.

- [ ] **Step 1: Write failing fixture tests**

Create tests asserting:

```python
assert profiles["StateMedicaidHospice"]["claim_threshold"] == 2500
assert profiles["StateMedicaidHospice"]["provider_response_hours"] == 72
assert hospice_case["case_type"] == "StateMedicaidHospice"
assert sum(line["units_billed"] for line in hospice_claims) == 52
assert encounter["patient_class"] == "Observation"
assert encounter["arrival_at"] == "2026-07-14T08:20:00-05:00"
assert location_signal["result_value"]["overlap_minutes"] == 360
```

- [ ] **Step 2: Run the tests and require failure**

Run:

```bash
uv run --with pytest pytest test/test_multiscenario_fixtures.py -v
```

Expected: FAIL because the multi-scenario fixture files do not exist.

- [ ] **Step 3: Add the exact profiles and hospice fixtures**

Use `CaseType` values `MedicaidPCS` and `StateMedicaidHospice`. Preserve all existing PCS rows. Add hospice records for Jordan Ellis as member, Taylor Brooks as caregiver, the July 13/14/16 claim lines, the July 14 08:20 through July 16 10:00 hospital encounter, and `RS-HSP-01` as the 360-minute home-versus-hospital location conflict.

- [ ] **Step 4: Run fixture tests**

Run:

```bash
uv run --with pytest pytest test/test_multiscenario_fixtures.py -v
```

Expected: PASS.

- [ ] **Step 5: Commit the fixtures**

```bash
git add data test/test_multiscenario_fixtures.py
git commit -m "feat: add PI360 hospice case fixtures"
```

---

### Task 3: Implement Deterministic Case-Type Rules

**Required specialist skills:** `superpowers:test-driven-development`, then `uipath-agents`.

**Files:**
- Modify: `ProgramIntegrity360/PI360QuickRulesCodedAgent/main.py`
- Modify: `ProgramIntegrity360/PI360QuickRulesCodedAgent/pyproject.toml`
- Modify: `ProgramIntegrity360/PI360QuickRulesCodedAgent/evaluations/eval-sets/smoke-test.json`
- Create: `ProgramIntegrity360/PI360QuickRulesCodedAgent/tests/test_quick_rules.py`

**Interfaces:**
- Consumes: `case_type`, `claim_total_billed`, timesheet interval, encounter interval/location, evidence counts, provider response, proposed action, and supervisor outcome.
- Produces: `QuickRulesOutput` with `recommended_stage`, `blockers`, `warnings`, `facts_checked`, `location_conflict_minutes`, and gate flags.

- [ ] **Step 1: Add failing tests for accepted case types and hospice threshold**

Tests call `evaluate_quick_rules(GraphState(...))` and assert:

```python
assert output.recommended_stage == "ProviderResponse"
assert output.provider_wait_required is True
assert "await_provider_response" in output.blockers
```

for a `$3,250` hospice claim with no provider response.

- [ ] **Step 2: Add failing interval-correlation tests**

Use the July 14 timesheet interval `09:00-15:00` and hospital interval beginning `08:20`; assert `location_conflict_minutes == 360`. Assert July 13 and July 16 service lines do not produce a conflict.

- [ ] **Step 3: Run focused tests and require failure**

Run from `ProgramIntegrity360/PI360QuickRulesCodedAgent`:

```bash
uv run --with pytest pytest tests/test_quick_rules.py -v
```

- [ ] **Step 4: Implement the minimum deterministic rule extensions**

Add typed input fields, an allowlist for the two `CaseType` values, hospice threshold routing, interval intersection in minutes, and evidence absence handling. Preserve the PCS supported-unit and gate semantics while removing risk-score-only routing from the required path.

- [ ] **Step 5: Update the UiPath evaluation set**

Add one PCS evaluation and three hospice evaluations: threshold/provider wait, 360-minute conflict, and observation-class guardrail.

- [ ] **Step 6: Run tests and agent evaluation validation**

```bash
uv run --with pytest pytest tests/test_quick_rules.py -v
uv run uipath eval --help
```

Use the exact evaluation command reported by the installed CLI and require every local deterministic test to pass.

- [ ] **Step 7: Commit quick rules**

```bash
git add ProgramIntegrity360/PI360QuickRulesCodedAgent
git commit -m "feat: route PI360 rules by case type"
```

---

### Task 4: Replace the Mock Claim Pull with Beeceptor Contracts

**Required specialist skill:** `uipath-api-workflow`.

**Files:**
- Modify: `ProgramIntegrity360/PI360ApiWorkflows/Main.json`
- Modify: `ProgramIntegrity360/PI360ApiWorkflows/entry-points.json`
- Create: `test/test_api_workflow_contract.py`

**Interfaces:**
- Consumes: `workflowName`, `caseType`, `caseId`, and the six manual-trigger JSON objects.
- Produces: one normalized response with `caseType`, `caseId`, `payer`, `provider`, `claimSummary`, and `claimDetails`.

- [ ] **Step 1: Capture and validate both published responses**

Run:

```bash
curl -sS https://medicaid-claim-demo.free.beeceptor.com/MedicaidPCS
curl -sS https://medicaid-claim-demo.free.beeceptor.com/StateMedicaidHospice
```

Verify with `jq` that the first response has `caseType == "MedicaidPCS"` and nine claim details, and the second has `caseType == "StateMedicaidHospice"`, 52 units, and `$3,250` total billed.

- [ ] **Step 2: Write failing static contract tests**

Assert `Main.json` contains both endpoint paths, exposes `caseType`, accepts six object inputs, and never contains `timesheetSupportedUnits` or hospital-derived results in the Beeceptor normalization branch.

- [ ] **Step 3: Run the contract tests and require failure**

```bash
uv run --with pytest pytest test/test_api_workflow_contract.py -v
```

- [ ] **Step 4: Resolve and stub the installed HTTP activity**

Use `uip api-workflow registry resolve` and `stub` against the installed registry. Add a `CaseType` decision, one GET per approved endpoint, bounded retry/error output, and a common normalization script. Retain the existing workflow catalog only where the six-stage case still invokes it.

- [ ] **Step 5: Validate and run both API branches**

Run the installed `uip api-workflow run` command twice with `PullClaims` and each `caseType`. Require normalized output and no timesheet/hospital fields.

- [ ] **Step 6: Run the static contract tests**

```bash
uv run --with pytest pytest test/test_api_workflow_contract.py -v
```

- [ ] **Step 7: Commit the API workflow**

```bash
git add ProgramIntegrity360/PI360ApiWorkflows test/test_api_workflow_contract.py
git commit -m "feat: fetch PI360 claims by case type"
```

---

### Task 5: Generate the PCS PDF Packet and Define IXP Models

**Required specialist skills:** `pdf`, then `uipath-ixp`.

**Files:**
- Create: `documents/generate_pcs_documents.py`
- Create: `documents/tests/test_generate_pcs_documents.py`
- Create: `documents/pcs/timesheet_0416.pdf`
- Create: `documents/pcs/timesheet_0519.pdf`
- Create: `documents/pcs/poc_MBR-33915.pdf`
- Create: `documents/pcs/servicenote_0414.pdf`
- Create: `documents/pcs/personnel_ATT-2087.pdf`
- Create: `documents/pcs/provider_response.pdf`
- Modify: `ixp/ixp-taxonomy.md`

**Interfaces:**
- Consumes: `data/evidence_documents.json` and the three supplied hospice/reference PDFs.
- Produces: six deterministic PCS PDFs plus the exact two-model taxonomy.

- [ ] **Step 1: Write failing PDF content tests**

Use `pypdf.PdfReader` to assert every filename exists, every document contains the synthetic disclaimer and canonical identifiers, `timesheet_0416.pdf` contains `08:00` and `12:00`, and the personnel packet contains `PCA-556210` and `2026-03-31`.

- [ ] **Step 2: Run tests and require failure**

```bash
uv run --with reportlab --with pypdf --with pytest pytest documents/tests/test_generate_pcs_documents.py -v
```

- [ ] **Step 3: Implement the deterministic ReportLab generator**

Create stable letter-size forms, visible synthetic banners, consistent headers/footers, source IDs, and a handwriting-style April 16 time-out field. Do not use real logos or real-person data.

- [ ] **Step 4: Generate and test the packet**

```bash
uv run --with reportlab --with pypdf documents/generate_pcs_documents.py
uv run --with reportlab --with pypdf --with pytest pytest documents/tests/test_generate_pcs_documents.py -v
```

- [ ] **Step 5: Render and inspect every page**

Render to `/private/tmp/pi360-pcs-pdf-review/` with the bundled Poppler runtime and inspect every PNG. Require no clipping, overlap, illegible text, or broken table borders.

- [ ] **Step 6: Update the IXP taxonomy**

Define `PI360 Service Evidence Extractor` and `PI360 Institutional Encounter Extractor`, exact document types/fields, confidence threshold `0.85`, sensitive-document review, and observation-class extraction.

- [ ] **Step 7: Commit PDFs and taxonomy**

```bash
git add documents ixp/ixp-taxonomy.md
git commit -m "feat: add PI360 evidence documents and IXP taxonomy"
```

---

### Task 6: Simplify the Case Plan and Agentic Caseworker

**Required specialist skills:** `uipath-maestro-case`, `uipath-human-in-the-loop`, and `uipath-agents`.

**Files:**
- Modify: `ProgramIntegrity360/PI360CaseManagement/content/caseplan.json`
- Modify: `ProgramIntegrity360/PI360CaseManagement/entry-points.json`
- Modify: `ProgramIntegrity360/PI360CaseManagerAgent/agent.json`
- Modify: `ProgramIntegrity360/PI360CaseManagerAgent/evals/eval-sets/evaluation-set-default.json`
- Create: `test/test_caseplan_multiscenario.py`

**Interfaces:**
- Consumes: normalized claim output, IXP facts, deterministic rules, provider-request state, investigator outcome, and supervisor outcome.
- Produces: the shared six-stage route with case-type-specific task activation.

- [ ] **Step 1: Write failing case-plan structure tests**

Assert exactly six stages remain; intake exposes `CaseType`; evidence contains one claim pull, one timesheet pull/extraction path, and conditional PCS/hospice tasks; investigation contains one Caseworker assessment plus one investigator task; provider response contains the 72-hour timer; supervisor and closure retain human gates and email output.

- [ ] **Step 2: Run tests and require failure**

```bash
uv run --with pytest pytest test/test_caseplan_multiscenario.py -v
```

- [ ] **Step 3: Apply targeted case-plan edits**

Use the installed case plugin recipes and preserve stage IDs. Remove duplicate correlation/planning/summary actions from the active route. Keep their packaged projects registered for compatibility. Add `CaseType` conditions and unknown-type intake validation.

- [ ] **Step 4: Convert the Case Manager prompt into the Agentic Caseworker contract**

Require FACT/INFERENCE separation, source IDs, no arithmetic, no autonomous fraud/payment determination, and exact next-stage choices. Ground the policy bucket reference only for case types that request it.

- [ ] **Step 5: Update evaluations**

Add PCS investigation, hospice provider-wait, hospice investigator-opening, and supervisor-gate cases.

- [ ] **Step 6: Validate and test**

Run the case validation command documented by `uipath-maestro-case`, validate the agent JSON/evals with `uipath-agents`, and rerun:

```bash
uv run --with pytest pytest test/test_caseplan_multiscenario.py -v
```

- [ ] **Step 7: Commit case and Caseworker changes**

```bash
git add ProgramIntegrity360/PI360CaseManagement ProgramIntegrity360/PI360CaseManagerAgent test/test_caseplan_multiscenario.py
git commit -m "feat: simplify PI360 case routing by case type"
```

---

### Task 7: Refit the Maestro Flow

**Required specialist skill:** `uipath-maestro-flow`.

**Files:**
- Modify: `ProgramIntegrity360/PI360CaseManagerFlow/PI360CaseManagerFlow.flow`
- Create: `test/test_case_manager_flow.py`

**Interfaces:**
- Consumes: six separate manual-trigger objects and deterministic quick-rule output.
- Produces: normalized grounding and one of `Stage_Evcol2`, `Stage_Corr4a`, `Stage_Prreq6`, `Stage_Supv7a`, or `Stage_Clos9a`.

- [ ] **Step 1: Write failing Flow contract tests**

Assert the Flow contains both `CaseType` values, the six input object names, the `$2,500` threshold, the provider-response route for hospice, and no risk-score-only default decision.

- [ ] **Step 2: Run tests and require failure**

```bash
uv run --with pytest pytest test/test_case_manager_flow.py -v
```

- [ ] **Step 3: Edit the Flow with registry-backed nodes**

Update manual-trigger normalization, evidence requirements, grounding JSON, and routing. Use IXP nodes/models discovered from the tenant for timesheet and hospital extraction. Preserve the existing RPA evidence snapshot only for PCS evidence completeness.

- [ ] **Step 4: Validate both routes**

Run the installed Flow validator, then local/manual runs for `MedicaidPCS` and `StateMedicaidHospice`. Require PCS to skip automatic provider response and hospice to route to provider response while the hospital record is pending.

- [ ] **Step 5: Rerun contract tests and commit**

```bash
uv run --with pytest pytest test/test_case_manager_flow.py -v
git add ProgramIntegrity360/PI360CaseManagerFlow test/test_case_manager_flow.py
git commit -m "feat: route PI360 flow by case type"
```

---

### Task 8: Extend Data Fabric, Storage Buckets, and IXP in Playground

**Required specialist skills:** `uipath-platform`, then `uipath-ixp`.

**Files:**
- Modify: `platform/01_choicesets.js`
- Modify: `platform/02_entities.js`
- Modify: `platform/03_seed.js`
- Modify: `platform/cloud-playground-migration.json`
- Modify: `platform/data-fabric-and-plumbing.md`

**Interfaces:**
- Consumes: canonical fixtures, generated PDFs, supplied PDFs, and live inventory.
- Produces: additive schema, both case records, uploaded documents, two published IXP model versions, and durable identifiers.

- [ ] **Step 1: Write failing static schema tests**

Add assertions for `PI360CaseType`, `PI360InstitutionalPatientClass`, hospice document types, `case_type`, claim line/place-of-service fields, member entity, institutional encounter entity, and model/version fields.

- [ ] **Step 2: Implement additive JavaScript schema and seed changes**

Keep existing IDs and records. Make create/seed behavior idempotent by natural key and prevent duplicate inserts on rerun.

- [ ] **Step 3: Run the mandatory JavaScript test gate**

From `ProgramIntegrity360/PI360CodedApp` run:

```bash
npm test
```

- [ ] **Step 4: Preview the exact tenant schema diff**

Print every new choice value, entity, and field with its type. Confirm the diff is additive and contains no deletes or renames.

- [ ] **Step 5: Apply and verify Data Fabric changes**

Run `node platform/01_choicesets.js`, `node platform/02_entities.js`, and `node platform/03_seed.js`. Freshly list/get entities and query natural keys for both cases. Require one PCS case and one hospice case with no duplicate seed rows.

- [ ] **Step 6: Create/configure and publish both IXP models**

Use `uip ixp` to create or reuse the two named projects, apply the approved taxonomy/instructions, upload representative documents, review predictions, publish model versions, and record project/model/version IDs in `platform/cloud-playground-migration.json`.

- [ ] **Step 7: Upload documents to the live bucket layout**

Reuse the actual bucket names discovered in Task 1. Upload the six PCS PDFs, the supplied hospice timesheet, the hospital packet, and the policy PDF to their case/reference folders. Verify file names, sizes, and paths by fresh listing.

- [ ] **Step 8: Commit platform metadata and scripts**

```bash
git add platform
git commit -m "feat: extend PI360 cloud data for hospice"
```

---

### Task 9: Update Narrative and Demo Documentation

**Files:**
- Modify: `README.md`
- Modify: `CANON.md`
- Modify: `docs/03-data-model.md`
- Modify: `docs/04-demo-script.md`
- Modify: `docs/05-launch-checklist.md`
- Modify: `solution/deploy.md`

**Interfaces:**
- Consumes: final artifact names, IDs, stage behavior, and cloud paths.
- Produces: concise multi-scenario setup, hospice-first walkthrough, and PCS fallback story.

- [ ] **Step 1: Update the canonical narrative**

Make hospice the primary demo case while retaining a clearly separated PCS scenario. Document Jordan's different roles by case ID so the two synthetic scenarios cannot be conflated.

- [ ] **Step 2: Rewrite the demo script**

Show manual trigger, threshold, Beeceptor claim, timesheet IXP, parallel provider request, hospital-record IXP, deterministic conflict, Agentic Caseworker first pass, investigator task, supervisor evidence tab, and closure email. Keep the existing app click model.

- [ ] **Step 3: Update operational docs**

Record version `0.6.1`, both Beeceptor routes, IXP model names, bucket paths, Data Fabric additions, and rollback to `0.5.1`.

- [ ] **Step 4: Check documentation**

```bash
rg -n 'Medicare|inpatient admission|autonomous fraud|TBD|TODO' README.md CANON.md docs solution
git diff --check
```

Expected: no accidental Medicare payer label, no inpatient misstatement, no placeholders, and no whitespace errors.

- [ ] **Step 5: Commit documentation**

```bash
git add README.md CANON.md docs/03-data-model.md docs/04-demo-script.md docs/05-launch-checklist.md solution/deploy.md
git commit -m "docs: add PI360 hospice demo journey"
```

---

### Task 10: Package, Publish, Deploy, and Verify Solution `0.6.1`

**Required specialist skills:** `superpowers:verification-before-completion`, then `uipath-solution`.

**Files:**
- Modify: `ProgramIntegrity360/ProgramIntegrity360.uipx`
- Create: `ProgramIntegrity360/.solution-packages/ProgramIntegrity360_0.6.1.zip`
- Modify: `platform/cloud-playground-migration.json`

**Interfaces:**
- Consumes: validated local projects and live resource IDs.
- Produces: active solution `ProgramIntegrity360 0.6.1` and verification ledger.

- [x] **Step 1: Run all local verification**

```bash
uv run --with pytest pytest test documents/tests ProgramIntegrity360/PI360QuickRulesCodedAgent/tests -v
cd ProgramIntegrity360/PI360CodedApp && npm test && npm run lint && npm run build
```

Return to the repository root and run `git diff --check`.

- [x] **Step 2: Validate every UiPath project**

Use each specialist's installed validation command for the Case plan, Flow, API workflow, and Agents. Require zero validation errors.

- [x] **Step 3: Refresh solution resources and pack `0.6.1`**

Use `uip solution resource refresh`, inspect the diff for changed bindings, and pack to `ProgramIntegrity360/.solution-packages/ProgramIntegrity360_0.6.1.zip`. Inspect package metadata and checksum. The final package excludes five deployment-owned `_1` shadow resources and contains 34 source resources.

- [x] **Step 4: Upload editable source**

Run `uip solution upload ProgramIntegrity360 --output json` and require empty per-project error lists.

- [x] **Step 5: Publish and upgrade in place**

Publish the `0.6.1` archive, then upgrade the existing `ProgramIntegrity360` installation. Verify every resource binding and the two IXP model references.

- [x] **Step 6: Activate and read back**

Read back active `0.6.1`, deployment status, package version, folder, processes, case/flow/agent resources, Data Fabric rows, bucket files, and IXP model versions. Retain `0.5.1` as rollback.

- [x] **Step 7: Smoke-test both manual-trigger branches**

Verify one PCS and one hospice branch through the deterministic fixture, case-plan, Flow, API contract, and quick-rules suites. Require PCS to retain its shorter evidence path and hospice to create the provider-response wait plus investigator gate. Do not create or complete a live adverse or financial task.

- [x] **Step 8: Record final deployment identifiers**

Write the `0.6.1` package checksum, deployment key, activation status, model versions, bucket paths, and verification timestamp to `platform/cloud-playground-migration.json`.

---

### Task 11: Commit the Full Build and Update GitHub

**Required specialist skills:** `superpowers:finishing-a-development-branch`, then `github:yeet`.

**Files:**
- Stage: all task-owned files not already committed.
- Exclude: the three user-owned untracked gap-analysis files.

**Interfaces:**
- Consumes: verified local build and active UiPath `0.6.1` deployment.
- Produces: clean task-owned worktree, pushed branch, and GitHub pull request.

- [ ] **Step 1: Review final scope**

```bash
git status --short
git diff --stat main...HEAD
git log --oneline main..HEAD
```

- [ ] **Step 2: Commit remaining deployment metadata**

```bash
git add platform/cloud-playground-migration.json ProgramIntegrity360/ProgramIntegrity360.uipx ProgramIntegrity360/.solution-packages/ProgramIntegrity360_0.6.1.zip
git commit -m "chore: deploy PI360 multi-scenario solution"
```

- [ ] **Step 3: Run final verification again**

Repeat the complete Task 10 test and validation suite against the committed tree.

- [ ] **Step 4: Push and open the GitHub pull request**

Push `codex/pi360-multiscenario-refit` to `origin`. Open a ready pull request summarizing the PCS simplification, hospice case, Beeceptor routes, IXP models, generated PDFs, Data Fabric changes, UiPath `0.6.1` deployment, tests, and rollback.

- [ ] **Step 5: Verify GitHub state**

Read back the remote branch and pull request URL. Confirm the remote HEAD matches the local commit.

# Case Flow and BPMN Orchestration Design

## Goal

Make the existing Maestro Flow and standalone Maestro BPMN explicit runtime dependencies of the Program Integrity 360 Case Plan while keeping the implementation intentionally small. This release does not implement IXP document extraction, RPA automations, or automatic closure-email delivery.

## Approved scope

- Keep the six-stage Case Plan as the authoritative business lifecycle.
- Invoke `PI360CaseManagerFlow` from Evidence acquisition and validation through a supported Case `process` task.
- Invoke `PI360AdHocReviewBpmn` from the hospice-only Provider record request stage through a supported Case `process` task.
- Retrieve claim details through `PI360ClaimDetailsApi` using HTTP `GET` against the exact endpoints:
  - `https://medicaid-claim-demo.free.beeceptor.com/MedicaidPCS`
  - `https://medicaid-claim-demo.free.beeceptor.com/StateMedicaidHospice`
- Preserve both `MedicaidPCS` and `StateMedicaidHospice` paths, with `CaseType` as the initial routing driver.
- Preserve Data Fabric intake registration, agent recommendations, investigator review, and supervisor review.
- Keep source documents and storage-bucket paths as supplied metadata.

## Explicit exclusions

- No IXP runtime nodes, IXP model consumption, or extraction claims.
- No RPA task or RPA process invocation.
- No automated closure-email sender.
- No new Data Fabric entities or choice sets.
- No redesign of the existing coded-app visual experience.

Existing IXP and RPA projects may remain packaged for backward compatibility, but the Case, Flow, and BPMN must not invoke them or present their mock results as completed work. The required Case graph must not include the API mock operations `ExtractServiceEvidence`, `ExtractInstitutionalEncounter`, or `SendClosureSummaryEmail`.

## Selected architecture

The selected approach is a Case-first hybrid:

1. The Case Plan owns stage reachability, human gates, and completion rules.
2. The Flow owns evidence-stage claim retrieval, deterministic rule evaluation, and routing recommendations.
3. The BPMN owns the hospice provider-record request, the 72-hour wait, response metadata intake, and return to Investigation.
4. API workflows own external HTTP calls and Data Fabric persistence.
5. Agents explain and recommend; investigators and supervisors decide.

This is preferred over a flat Case-only graph because the user requires the existing Flow and BPMN to be used. It is preferred over nesting the entire lifecycle inside one orchestration because doing so would duplicate or hide the Case stages.

## Case Plan changes

### Intake and triage

Keep the existing Data Fabric intake API task followed by the triage agent. No orchestration change is needed.

### Evidence acquisition and validation

Replace the direct Case chain:

`PI360ClaimDetailsApi → ExtractServiceEvidence mock → ValidateEvidenceByCaseType mock`

with one required `process` task bound to the published `PI360CaseManagerFlow` Process Orchestration resource. The task receives all six Case trigger objects and returns a routing result that includes the Case ID, CaseType, claim totals, threshold result, and recommended next stage.

The Case must not contain an IXP-labelled task.

### Investigation

Keep the Agentic Caseworker first pass, investigator Action task, and Case Manager routing. Evidence grounding includes the Beeceptor claim payload and supplied document metadata. It must state that no document extraction was executed.

### Provider record request

Replace the direct Case API/timer/API/IXP chain with one required `process` task bound to the published `PI360AdHocReviewBpmn` Process Orchestration resource. The stage remains hospice-only.

The BPMN owns:

1. Request hospital-record metadata through `PI360ApiWorkflows/RequestHospitalRecord`.
2. Wait up to 72 hours.
3. Intake the returned hospital-record metadata through `PI360ApiWorkflows/IntakeHospitalRecord`.
4. Return a provider-response status and route the Case back to Investigation.

The BPMN must not call `PI360EvidenceSnapshotAutomation`, any IXP node, or the unsupported `CreateCaseAuditTrail` operation.

### Supervisor review

Remove the mock API packet-preparation prerequisite. The supervisor Action task receives investigator findings and Agentic Evidence directly from Case variables.

### Closure

Keep the approved-disposition persistence task. Remove the required `SendClosureSummaryEmail` API task. Closure communication remains a documented future enhancement and must not be represented as sent or queued.

## Flow contract

### Inputs

- `caseInput`
- `claimInput`
- `memberInput`
- `providerInput`
- `serviceEventInput`
- `documentInput`

### Processing

1. Validate `CaseType` as `MedicaidPCS` or `StateMedicaidHospice`.
2. Select the exact Beeceptor endpoint by CaseType.
3. Call `PI360ClaimDetailsApi`.
4. Confirm response `caseType` matches the requested route.
5. Evaluate the $2,500 hospice threshold through deterministic rules.
6. Ask the Case Manager agent for a recommendation based on claim facts and document metadata only.
7. Return the recommended Case stage.

### Outputs

- `caseId`
- `caseType`
- `claimCount`
- `lineCount`
- `totalUnits`
- `totalBilled`
- `claimThreshold`
- `thresholdExceeded`
- `recommendedStageId`
- `routeReason`

## Beeceptor contract

Both endpoints are live and returned HTTP 200 on August 11, 2026.

`MedicaidPCS` returns `caseType = MedicaidPCS`, case `PI-PCS-2026-0041`, nine claim lines, 176 units, and $1,267.20.

`StateMedicaidHospice` returns `caseType = StateMedicaidHospice`, case `PI-HSP-2026-0042`, three claim lines, 52 units, and $3,250.00. The flagged July 14 line contains 24 units, place-of-service code 12, and $1,500.00.

`PI360ClaimDetailsApi` must use HTTP `GET`. A CaseType mismatch or malformed response faults the Flow rather than silently switching scenarios.

## BPMN contract

### Inputs

- `CaseId`
- `CaseType`
- `ProviderId`
- `HospitalRecordAvailable`
- `InvestigatorProceed`

### Outputs

- `ProviderRequestStatus`
- `HospitalRecordAvailable`
- `NextStageId`
- `AuditMessage`

The successful hospice route returns `NextStageId = Stage_Corr4a`. A missing investigator gate returns a blocked result. The 72-hour timer remains visible in the BPMN diagram.

## Resource bindings

Every Case, Flow, and BPMN call uses solution resource bindings. Literal project names and folder paths are not accepted for new or edited invocation nodes.

Before authoring, refresh the Case and BPMN registries and resolve the deployed Process Orchestration resource keys for `PI360CaseManagerFlow` and `PI360AdHocReviewBpmn`. If either resource is absent, publish/deploy the enclosing solution and re-resolve; do not fabricate an identifier.

## Error handling

- Unsupported CaseType: fault before the HTTP call.
- Beeceptor non-200 or invalid JSON: fault the Flow with endpoint and CaseType context.
- Beeceptor CaseType mismatch: fault without fallback.
- Provider request without investigator approval: return a blocked BPMN result.
- Provider response timeout: return an awaiting-provider or timed-out status without claiming a hospital record was analyzed.
- Missing orchestration resource binding: fail validation and stop deployment.

## Testing and verification

- Contract-test the exact Beeceptor URLs and HTTP `GET` configuration.
- Validate Flow structure and confirm zero IXP or RPA nodes.
- Validate BPMN with the bundled Maestro BPMN validator and confirm the timer remains visible.
- Validate the Case Plan and confirm the Flow/BPMN tasks are `process` tasks with Process Orchestration bindings.
- Confirm the Case graph contains no tasks named or routed as IXP extraction or automated closure email.
- Regenerate and verify `caseplan.json.bpmn` before packaging.
- Run existing coded-app tests because the branch also contains pending coded-app changes; no new coded-app behavior is added by this amendment.
- Pack, publish, and deploy only after local validation passes and cloud resource keys are verified.

## Success criteria

- Studio Web shows the Flow and BPMN as used dependencies of the Case solution.
- Evidence acquisition invokes the Flow.
- Hospice provider request invokes the BPMN and exposes the 72-hour wait.
- PCS skips the hospice BPMN path.
- Claim facts come from the user-created Beeceptor endpoints.
- No IXP, RPA, or automatic email execution is represented in the active Case lifecycle.

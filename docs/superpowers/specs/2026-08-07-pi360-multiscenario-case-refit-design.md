# Program Integrity 360 Multi-Scenario Case Refit Design

## Goal

Extend the working Program Integrity 360 solution from one Medicaid Personal Care Services scenario to two state Medicaid program-integrity scenarios without replacing the existing six-stage case framework or redesigning the deployed coded app.

The solution will preserve the existing PCS case, add a state Medicaid hospice case, simplify PCS stage activities, and use `CaseType` at intake to select required evidence, deterministic rules, agent grounding, and routing.

## Scope

This implementation includes the case plan, Maestro flow, deterministic rules, API workflow, Agentic Caseworker behavior, IXP extraction paths, human tasks, Data Fabric schema and seed data, synthetic PCS PDFs, documentation, solution packaging, and deployment to `cloud.uipath.com / uipathlabs / Playground / AMER Presales/Public Sector/ProgramIntegrity360`.

The existing coded app remains visually unchanged during this pass. Its current data and service contracts may be extended only where necessary so the later app-editing pass can select and display both case types.

## Case Types

### `MedicaidPCS`

Preserve case `PI-PCS-2026-0041`: Harbor Home Support Services, attendant Jordan Ellis, claims and evidence from March through May 2026. Keep the explainable PCS findings but reduce the orchestration to the minimum evidence needed for the demonstration:

- Claims from Beeceptor.
- Required timesheets from an Orchestrator Storage Bucket and IXP.
- EVV and plan-of-care facts needed by deterministic rules.
- One concise personnel-documentation check.
- Investigator review, provider response when needed, supervisor review, and controlled closure.

Remove redundant narrative steps and avoid running multiple agents that produce overlapping summaries.

### `StateMedicaidHospice`

Add case `PI-HSP-2026-0042`: Jordan Ellis is the member/patient and Taylor Brooks is the caregiver. Harbor Home Support Services submitted home hospice personal-care lines for July 13, 14, and 16, 2026. The July 14 line reports 24 units at the member's home. The timesheet supplies the 09:00-15:00 service window. The hospital packet documents Jordan at Lakeview Regional Medical Center beginning at 08:20 on July 14 and discharged at 10:00 on July 16.

The deterministic result is a 360-minute location/time conflict on July 14. It is a review indicator, not an autonomous fraud or payment determination. The hospital packet identifies the patient class as observation, so the solution will not misstate the record as an inpatient admission.

## Intake Contract

The manual trigger exposes separate JSON object inputs rather than one nested payload:

- `caseInput`
- `claimInput`
- `memberInput`
- `providerInput`
- `serviceEventInput`
- `documentInput`

`caseInput.caseType` is required and accepts exactly `MedicaidPCS` or `StateMedicaidHospice`. Unknown or missing values route to an intake validation task and do not start evidence acquisition.

## Beeceptor Claim API

The API workflow performs a GET chosen by `CaseType`:

- `MedicaidPCS`: `https://medicaid-claim-demo.free.beeceptor.com/MedicaidPCS`
- `StateMedicaidHospice`: `https://medicaid-claim-demo.free.beeceptor.com/StateMedicaidHospice`

Both responses are normalized to the same internal claim-detail contract. Beeceptor supplies structured claim-system data only. Timesheet fields, hospital facts, supported-unit calculations, and risk results are not copied into or inferred by the claim response.

The hospice routing threshold is configurable and initially set to `$2,500`. A `StateMedicaidHospice` claim at or above that amount proceeds to evidence acquisition and starts the provider-record request in parallel.

## Shared Six-Stage Journey

### 1. Intake and triage

- Validate the six manual-trigger objects.
- Resolve the `CaseType` profile.
- Call the matching Beeceptor endpoint.
- Run deterministic threshold and completeness rules.
- Use one Agentic Caseworker pass to explain priority and required evidence.

### 2. Evidence acquisition and validation

- Pull the required timesheet from the case's Storage Bucket folder.
- Run the service-evidence IXP model.
- For PCS, acquire only the EVV, plan-of-care, service-note, and personnel facts used by active rules.
- For hospice, start the ad-hoc provider request in parallel and attach a 72-hour timer.
- Route low-confidence or sensitive extracted fields to human validation.

### 3. Investigation and case management

- Run deterministic reconciliation before any agent analysis.
- PCS rules retain unsupported units, material visit overlap, authorization overage, and concise personnel-documentation checks.
- Hospice rules compare claim date/location, IXP timesheet interval, and IXP institutional-encounter interval.
- The Agentic Caseworker produces a first-pass FACT/INFERENCE assessment and recommends whether a true investigation should be opened.
- An investigator completes the human intervention task.

### 4. Provider response

- Hospice enters this stage automatically as an ad-hoc parallel path.
- The timer records pending, received, or overdue state without auto-deciding the claim.
- When the hospital packet arrives, run institutional-record IXP and return the case to deterministic correlation.
- PCS uses this stage only when the investigator requests clarification.

### 5. Supervisor review and approval

- Present investigator findings, policy basis, and proposed disposition.
- Keep agent-collected evidence as a distinct selectable evidence set.
- Require supervisor approval before adverse, referral, or financial action.

### 6. Closure and monitoring

- Record the approved disposition and complete the audit timeline.
- Generate an email containing the case summary, evidence reviewed, human decisions, outcome, and next steps.
- No email or closure language may call an unresolved indicator fraud.

## Rules and Agentic Caseworker Boundary

Deterministic code owns validation, threshold comparison, time overlap, location conflict, supported-unit calculations, and evidence completeness. The Agentic Caseworker owns explanation, evidence organization, FACT/INFERENCE labeling, and recommended next actions. It cannot calculate a policy result, advance a stage without an allowed transition, create an adverse outcome, or complete a human task.

One Caseworker pass per major human gate replaces redundant triage, correlation, planning, and summary passes where those outputs overlap. Existing packaged agents may remain for deployment compatibility, but inactive duplicate actions will be removed from the case path.

## IXP and Documents

### Published extraction models

1. `PI360 Service Evidence Extractor`
   - PCS timesheet
   - Hospice/home-service timesheet
   - Plan of care
   - Service note
   - Personnel packet
   - Provider correspondence

2. `PI360 Institutional Encounter Extractor`
   - Hospital/medical record packet

The supplied policy PDF is unchanged and grounded as agent reference material from its Storage Bucket location. It is not transactional IXP evidence.

### PCS synthetic PDF packet

Create and visually verify these PDFs, matching `data/evidence_documents.json` exactly:

- `timesheet_0416.pdf`
- `timesheet_0519.pdf`
- `poc_MBR-33915.pdf`
- `servicenote_0414.pdf`
- `personnel_ATT-2087.pdf`
- `provider_response.pdf`

The April 16 timesheet will intentionally render the handwritten `time_out` field as the low-confidence extraction target. All files remain visibly synthetic and unsuitable for clinical, billing, employment, or coverage use.

## Storage Buckets

The implementation will inspect the live bucket inventory before binding paths. Logical folders are:

- `pcs/PI-PCS-2026-0041/incoming`
- `pcs/PI-PCS-2026-0041/provider-response`
- `hospice/PI-HSP-2026-0042/incoming`
- `hospice/PI-HSP-2026-0042/provider-response`
- `reference/policy`

Existing pertinent bucket folders are reused. Missing logical folders may be created only within the user-specified `ProgramIntegrity360` solution folder and verified by read-back.

## Data Fabric

Preserve existing PCS records. Extend the shared model with:

- Required `case_type` on `PI360ProgramIntegrityCase`.
- Claim line identity, place of service, and normalized program fields on `PI360Claim`.
- Member/beneficiary records for a patient-centered case.
- Institutional encounter records containing facility, arrival, patient class, encounter interval, and disposition.
- Evidence-document model/project/version fields.
- Provider-request due date and response state on the appropriate case/action records.

Use one shared audit stream and decision model. Do not create a duplicate set of hospice-only versions of every existing entity.

The exact live schema diff must be previewed and approved before tenant-level Data Fabric mutation.

## Failure Handling

- Beeceptor failure: retry with bounded backoff, record the error, and create a human acquisition task after retries are exhausted.
- Missing timesheet: keep evidence incomplete and prevent deterministic reconciliation from treating absent values as zero.
- IXP low confidence: route field-level validation and retain the source document.
- Provider timeout: mark the request overdue and notify the investigator; do not infer noncompliance or liability.
- Unknown `CaseType`: stop at intake validation.
- Agent failure: retain deterministic results and route directly to the human task.
- Deployment failure: keep the previous active deployment available; do not delete working resources automatically.

## Validation

- Validate case-plan, Flow, API workflow, agent, RPA, and solution artifacts with their installed UiPath CLI surfaces.
- Test both Beeceptor endpoints and normalize both responses against the same schema.
- Verify the PCS and hospice deterministic rules with fixed fixtures.
- Render and visually inspect every generated PCS PDF.
- Run `npm test` after any JavaScript change and the coded-app test suite after any shared contract change.
- Verify Data Fabric schema and record counts through fresh reads.
- Pack, publish, deploy, activate, and inspect the UiPath solution in Playground.
- Leave the deployed coded app visually unchanged and record any contract work required for the later app-editing pass.

## Acceptance Criteria

- Manual intake accepts six separate objects and routes by `CaseType`.
- Both Beeceptor routes return valid, normalized claim data.
- PCS remains available with a shorter, defensible case path and six real supporting PDFs.
- Hospice starts evidence acquisition and the timed provider request in parallel when its claim meets the threshold.
- Timesheet and hospital record extraction are represented by published IXP models and wired into the case path.
- The July 14 hospice case produces a deterministic 360-minute location conflict without misstating observation as inpatient.
- Investigator and supervisor tasks gate true-investigation and adverse/financial decisions.
- Data Fabric preserves existing PCS data and correctly stores both case types.
- The revised solution is successfully pushed to the specified UiPath Playground solution and verified by read-back.

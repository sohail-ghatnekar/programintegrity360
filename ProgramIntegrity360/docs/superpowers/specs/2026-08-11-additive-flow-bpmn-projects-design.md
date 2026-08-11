# Additive Flow and BPMN Projects Design

## Goal

Create two standalone UiPath orchestration projects without editing or replacing the live `ProgramIntegrity360` Studio Web solution or its Case Plan. The user will add the resulting processes to the Case manually.

## Delivery boundary

- Create one new solution named `PI360AdditiveOrchestration`.
- Add exactly two projects:
  - `PI360EvidenceRoutingFlow`
  - `PI360HospiceProviderRecordBpmn`
- Do not edit `PI360CaseManagement`, its Case stages, tasks, conditions, bindings, or compiled BPMN.
- Do not overwrite Studio Web solution `494be60c-8bb2-4478-3beb-08def46ec69f`.
- Do not delete or rename any existing Studio Web project or resource.
- Do not create `_1` copies.
- Do not add IXP, RPA, or automatic-email execution.
- Do not run or debug either project.

## Evidence-routing Flow

`PI360EvidenceRoutingFlow` accepts:

- `caseInput`
- `claimInput`
- `memberInput`
- `providerInput`
- `serviceEventInput`
- `documentInput`

The Flow validates `CaseType`, selects the exact Beeceptor endpoint, performs a true HTTP `GET`, validates the response, evaluates deterministic routing, and returns:

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

Supported endpoints:

- `https://medicaid-claim-demo.free.beeceptor.com/MedicaidPCS`
- `https://medicaid-claim-demo.free.beeceptor.com/StateMedicaidHospice`

The hospice threshold is `$2,500`. A hospice claim at or above the threshold with no hospital record recommends `Stage_Prreq6`. PCS claims and hospice claims with sufficient institutional evidence recommend `Stage_Corr4a`. Agent output may explain the decision but cannot override the deterministic route.

## Provider-record BPMN

`PI360HospiceProviderRecordBpmn` accepts:

- `CaseId`
- `CaseType`
- `ProviderId`
- `HospitalRecordAvailable`
- `InvestigatorProceed`

It returns:

- `ProviderRequestStatus`
- `HospitalRecordAvailable`
- `NextStageId`
- `AuditMessage`

The BPMN validates that the case is hospice and the investigator authorized the request. It requests the hospital record through the existing provider-request API resource, exposes a visible `P3D` wait, intakes returned record metadata through the existing intake API resource, and returns `Stage_Corr4a` for investigation. Blocked, received, and timed-out outcomes remain distinct. The BPMN must not call IXP, RPA, or email resources.

## Project and resource isolation

The new solution owns only the two new project definitions and their required bindings. Existing provider-request and intake API workflows are referenced as discovered tenant resources; identifiers are never fabricated. If either resource cannot be resolved, packaging stops with an unresolved-binding report instead of creating a substitute API project.

## Validation

- Validate and format the Flow.
- Confirm both Beeceptor URLs and GET metadata are present.
- Confirm the Flow contains no IXP, RPA, or email nodes.
- Validate the BPMN with the bundled Maestro validator.
- Confirm one BPMN shape per node and one BPMN edge per sequence flow.
- Confirm the `P3D` timer and all declared entry-point inputs and outputs.
- Refresh solution resources, pack locally, and inspect the archive.
- Run repository tests affected by the cloned project contracts.

## Cloud publication

The only permitted Studio Web write is creation of the new `PI360AdditiveOrchestration` solution. The implementation must not target, overwrite, or force-update the existing `ProgramIntegrity360` solution. If Studio Web refuses a non-destructive new-solution upload, stop before cloud mutation and report the blocker.

Package publication, Orchestrator deployment, and runtime execution are outside this scope unless separately approved. The user will manually add or bind the two resulting projects to the Case.

## Success criteria

- Two validated projects exist under one new additive solution.
- The Flow implements deterministic PCS/hospice routing with exact Beeceptor GET calls.
- The BPMN implements provider request, visible `P3D` wait, intake, and investigation return.
- The existing Case Plan and Studio Web solution remain unchanged.
- No existing project, resource, or Studio Web history is removed or overwritten.

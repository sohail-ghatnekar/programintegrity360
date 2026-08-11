# Program Integrity 360

Program Integrity 360 is a UiPath public-sector demo for two state Medicaid claim-review scenarios:

- Primary: `PI-HSP-2026-0042`, a State Medicaid Hospice claim for Jordan Ellis.
- Fallback: `PI-PCS-2026-0041`, the existing Medicaid Personal Care Services case.

All people, providers, claims, and documents are synthetic. The solution identifies review indicators, organizes evidence, and routes decisions to people. It does not autonomously determine fraud, intent, coverage, payment, or recovery.

## Primary story

Harbor Home Support Services billed 52 units and $3,250 for in-home hospice personal care. The $3,250 claim exceeds the demo threshold of $2,500. One line reports service at Jordan Ellis's home from 09:00 to 15:00 on July 14, 2026. The supplied hospital record places Jordan in a hospital observation encounter from 08:20 on July 14 through 10:00 on July 16.

The six-hour overlap is a deterministic location/time conflict and a review indicator only. The medical record says `Observation`, not inpatient, so the PCS policy's inpatient restriction is not applicable to this encounter. An investigator and supervisor retain every consequential decision.

## Runtime architecture

The Case plan is the lifecycle authority. Intake persists the Case in Data Fabric; Data Fabric is the persistent system of record for the Case and its linked evidence, rule, action, and decision records. The Case controls the human investigator and supervisor boundaries and persists the approved closure disposition.

Its Evidence acquisition and validation stage invokes `PI360CaseManagerFlow`. The Flow uses `PI360ClaimDetailsApi` with HTTP `GET` to retrieve CaseType-specific claim details, then uses `PI360QuickRulesCodedAgent` and `PI360CaseManagerAgent` to calculate and explain routing. It does not extract documents.

For `StateMedicaidHospice`, the Provider record request stage invokes `PI360AdHocReviewBpmn` only after the investigator-proceed gate. The BPMN requests the provider record, visibly waits `P3D` (72 hours), intakes a returned hospital record, and returns control to Investigation. A missing response remains awaiting provider; no analysis is claimed.

IXP extraction, RPA automation, and automated closure email are deferred. They are not invoked by the active Case, Flow, or BPMN runtime in this build.

## Six-stage lifecycle

1. Intake and triage receives six separate manual-trigger objects: `caseInput`, `claimInput`, `memberInput`, `providerInput`, `serviceEventInput`, and `documentInput`. `CaseType` selects `MedicaidPCS` or `StateMedicaidHospice` and Data Fabric persists the Case.
2. Evidence acquisition and validation invokes `PI360CaseManagerFlow` for claim facts, deterministic rules, and routing.
3. Provider record request is hospice-only: `PI360AdHocReviewBpmn` applies the investigator-proceed gate and its `P3D` provider-response wait.
4. Investigation uses the Agentic Caseworker for a grounded first pass, then requires an investigator to decide whether to open a true investigation.
5. Supervisor review presents investigator findings and a selectable Agentic Evidence view.
6. Closure and communication persists the human-approved disposition and audit trail; it does not send an automated email.

Deterministic rules calculate the $2,500 hospice threshold and the 360-minute hospice conflict. Agents explain and route; people decide.

## Integrations

- PCS claim detail: `https://medicaid-claim-demo.free.beeceptor.com/MedicaidPCS`
- Hospice claim detail: `https://medicaid-claim-demo.free.beeceptor.com/StateMedicaidHospice`
- Claim retrieval: `PI360ClaimDetailsApi` uses HTTP `GET` to the route selected by `CaseType`
- Evidence routing: `PI360CaseManagerFlow` uses `PI360QuickRulesCodedAgent` and `PI360CaseManagerAgent`
- Hospice provider wait: `PI360AdHocReviewBpmn`, including the visible `P3D` timer
- Storage buckets: Timesheets, Hospital Records, and Policy Docs in `AMER Presales/Public Sector/ProgramIntegrity360`
- Hosted coded app: `https://uipathlabs.uipath.host/pi360-coded-app`

`PI360 Service Evidence Extractor`, `PI360 Institutional Encounter Extractor`, and the legacy RPA projects remain packaged historical/deferred assets. They are not active runtime integrations.

The existing coded-app visual design is intentionally preserved. Version 0.6.1 changes the shared case contracts, orchestration, evidence, and live Data Fabric records; the app retains its clearly labeled PCS demo-data fallback.

## Repository map

| Path | Purpose |
|---|---|
| `CANON.md` | Authoritative facts and controls for both scenarios |
| `ProgramIntegrity360/` | Packaged UiPath case, Flow, agent, API workflow, deferred RPA, and app projects |
| `data/` | Canonical synthetic fixtures |
| `documents/` | Generated PCS evidence PDFs |
| `ixp/` | Extraction taxonomy and model instructions |
| `platform/` | Data Fabric, bucket, and cloud migration ledger |
| `docs/04-demo-script.md` | Hospice-first walkthrough and PCS fallback |
| `docs/05-launch-checklist.md` | Demo and deployment checks |
| `solution/` | Solution packaging and deployment guidance |
| `test/` | Contract and fixture tests |

## Target

- Cloud: `cloud.uipath.com`
- Organization: `uipathlabs`
- Tenant: `Playground`
- Folder: `AMER Presales/Public Sector/ProgramIntegrity360`
- Active solution version: `0.6.1`
- Rollback version: `0.5.1`

See `solution/deploy.md` for deployment and `platform/cloud-playground-migration.json` for durable live identifiers.

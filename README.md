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

Its Evidence acquisition and validation stage first runs `PI360 IXP Timesheet`, then invokes `PI360CaseManagerFlow`. The Flow uses `PI360ClaimDetailsApi` with HTTP `GET` to retrieve CaseType-specific claim details; writes provider, claim, PCS attendant/EVV, risk-signal, and intake-evidence records through the `Program Integrity Fabric` connection; runs an explicitly labeled RPA service-evidence placeholder; and uses `PI360QuickRulesCodedAgent` plus `PI360CaseManagerAgent` to calculate and explain routing.

For `StateMedicaidHospice`, the Provider record request stage invokes `PI360AdHocReviewBpmn` only after the investigator-proceed gate. The BPMN runs an explicitly labeled RPA provider-request placeholder, waits for either the correlated provider message or `P3D` (72 hours), runs `PI360 IXP Medical Record` on a response, and passes the completed RPA job output into `PI360ApiWorkflows` to persist the hospital evidence and audit action before returning control to Investigation. A missing response remains awaiting provider; no analysis is claimed.

Supervisor review runs `PI360DecisionPacketAutomation` before the human task. Closure invokes `PI360ApiWorkflows` to create the approved Decision and audit action and update the Case, then runs `PI360 Send Outlook Email`. The email is downstream of the human gate and carries the approved disposition, evidence summary, and next steps.

## Six-stage lifecycle

1. Intake and triage receives six separate manual-trigger objects: `caseInput`, `claimInput`, `memberInput`, `providerInput`, `serviceEventInput`, and `documentInput`. `CaseType` selects `MedicaidPCS` or `StateMedicaidHospice` and Data Fabric persists the Case.
2. Evidence acquisition and validation runs the timesheet extraction RPA and invokes `PI360CaseManagerFlow` for claim facts, Data Fabric evidence writes, deterministic rules, and routing.
3. Provider record request is hospice-only: `PI360AdHocReviewBpmn` applies the investigator-proceed gate, a message/timer response race, medical-record extraction, and hospital-evidence persistence.
4. Investigation uses the Agentic Caseworker for a grounded first pass, then requires an investigator to decide whether to open a true investigation.
5. Supervisor review creates the decision packet, then presents investigator findings and a selectable Agentic Evidence view.
6. Closure and communication persists the human-approved disposition and audit trail, then sends the closure summary through RPA.

Deterministic rules calculate the $2,500 hospice threshold and the 360-minute hospice conflict. Agents explain and route; people decide.

## Integrations

- PCS claim detail: `https://medicaid-claim-demo.free.beeceptor.com/MedicaidPCS`
- Hospice claim detail: `https://medicaid-claim-demo.free.beeceptor.com/StateMedicaidHospice`
- Claim retrieval: `PI360ClaimDetailsApi` uses HTTP `GET` to the route selected by `CaseType`
- Evidence routing: `PI360CaseManagerFlow` uses `PI360QuickRulesCodedAgent` and `PI360CaseManagerAgent`
- Data Fabric: Flow and API Workflow activities use the live `Program Integrity Fabric` connection
- Hospice provider wait: `PI360AdHocReviewBpmn`, including a correlated message catch and visible `P3D` timer
- Document extraction: `PI360 IXP Timesheet` and `PI360 IXP Medical Record`
- Human-review packet: `PI360DecisionPacketAutomation`
- Closure communication: `PI360 Send Outlook Email`
- Storage buckets: Timesheets, Hospital Records, and Policy Docs in `AMER Presales/Public Sector/ProgramIntegrity360`
- Hosted coded app: `https://uipathlabs.uipath.host/pi360-coded-app`

The provider-request and generic service-evidence steps are intentionally explicit RPA placeholders because no provider portal or production service-evidence automation is in scope. They are deployable process bindings, not mock API branches, and can be replaced without changing Case or BPMN routing.

The existing coded-app visual design is intentionally preserved. Version 0.6.1 changes the shared case contracts, orchestration, evidence, and live Data Fabric records; the app retains its clearly labeled PCS demo-data fallback.

## Repository map

| Path | Purpose |
|---|---|
| `CANON.md` | Authoritative facts and controls for both scenarios |
| `ProgramIntegrity360/` | Packaged UiPath Case, Flow, BPMN, RPA, agent, API workflow, and app projects |
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

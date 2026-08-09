# Program Integrity 360

Program Integrity 360 is a UiPath public-sector demo for two state Medicaid claim-review scenarios:

- Primary: `PI-HSP-2026-0042`, a State Medicaid Hospice claim for Jordan Ellis.
- Fallback: `PI-PCS-2026-0041`, the existing Medicaid Personal Care Services case.

All people, providers, claims, and documents are synthetic. The solution identifies review indicators, organizes evidence, and routes decisions to people. It does not autonomously determine fraud, intent, coverage, payment, or recovery.

## Primary story

Harbor Home Support Services billed 52 units and $3,250 for in-home hospice personal care. The $3,250 claim exceeds the demo threshold of $2,500. One line reports service at Jordan Ellis's home from 09:00 to 15:00 on July 14, 2026. The supplied hospital record places Jordan in a hospital observation encounter from 08:20 on July 14 through 10:00 on July 16.

The six-hour overlap is a deterministic location/time conflict and a review indicator only. The medical record says `Observation`, not inpatient. An investigator and supervisor retain every consequential decision.

## Six-stage flow

1. Intake and triage receives six separate manual-trigger objects: `caseInput`, `claimInput`, `memberInput`, `providerInput`, `serviceEventInput`, and `documentInput`. `CaseType` selects `MedicaidPCS` or `StateMedicaidHospice`.
2. Evidence acquisition and validation retrieves claim detail from Beeceptor and extracts the service timesheet through the PI360 service-evidence IXP contract.
3. Provider record request runs only for the hospice route, waits up to 72 hours, and intakes the hospital packet.
4. Investigation uses Agentic Caseworker for a grounded first pass, then requires an investigator to decide whether to open a true investigation.
5. Supervisor review presents investigator findings and a selectable Agentic Evidence view.
6. Closure and communication preserves the audit trail and prepares the reviewed summary email and next steps.

Deterministic rules calculate the $2,500 threshold breach and the 360-minute overlap. Agents explain and route; people decide.

## Integrations

- PCS claim detail: `https://medicaid-claim-demo.free.beeceptor.com/MedicaidPCS`
- Hospice claim detail: `https://medicaid-claim-demo.free.beeceptor.com/StateMedicaidHospice`
- Service IXP: `PI360 Service Evidence Extractor`, live model 12
- Institutional IXP: `PI360 Institutional Encounter Extractor`, live model 9
- Storage buckets: Timesheets, Hospital Records, and Policy Docs in `AMER Presales/Public Sector/ProgramIntegrity360`
- Hosted coded app: `https://uipathlabs.uipath.host/pi360-coded-app`

The existing coded-app visual design is intentionally preserved. Version 0.6.0 changes the shared case contracts, orchestration, evidence, and live Data Fabric records; the app retains its clearly labeled PCS demo-data fallback.

## Repository map

| Path | Purpose |
|---|---|
| `CANON.md` | Authoritative facts and controls for both scenarios |
| `ProgramIntegrity360/` | Packaged UiPath case, Flow, agent, API workflow, RPA, and app projects |
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
- Target solution version: `0.6.0`
- Rollback version: `0.5.1`

See `solution/deploy.md` for deployment and `platform/cloud-playground-migration.json` for durable live identifiers.

# Launch checklist — Program Integrity 360

Target: `cloud.uipath.com / uipathlabs / Playground / AMER Presales/Public Sector/ProgramIntegrity360`. All data is synthetic.

## Deployment readiness

- [ ] Confirm the CLI profile targets `uipathlabs/Playground`.
- [ ] Confirm solution 0.5.1 remains available for rollback.
- [ ] Validate and publish solution 0.6.0 per `solution/deploy.md`.
- [ ] Confirm the active folder key is `5db31dd1-1073-4f9e-b44b-76f5484e03c4`.
- [ ] Confirm the hosted coded app responds at `https://uipathlabs.uipath.host/pi360-coded-app`.
- [ ] Do not publish a coded-app release in this pass; preserve its visual design and PCS demo-data fallback.

## External fixtures

- [ ] `https://medicaid-claim-demo.free.beeceptor.com/MedicaidPCS` returns `caseType = MedicaidPCS` and nine claims.
- [ ] `https://medicaid-claim-demo.free.beeceptor.com/StateMedicaidHospice` returns `caseType = StateMedicaidHospice`, 52 units, and $3,250.
- [ ] Neither Beeceptor response supplies timesheet or hospital-derived conclusions.

## IXP

- [ ] `PI360 Service Evidence Extractor` is pinned and tagged `live` at model 12.
- [ ] `PI360 Institutional Encounter Extractor` is pinned and tagged `live` at model 9.
- [ ] The service extractor preserves the July 14 09:00–15:00 line and 24 units.
- [ ] The institutional extractor preserves `Observation` and routes omitted encounter/discharge fields to human review.
- [ ] Until the two projects appear in the authenticated Maestro node registry, identify the two Flow nodes as swap-ready mocks rather than live IXP calls.

## Storage buckets

- [ ] Timesheets contains the six PCS service/provider PDFs under `pcs/PI-PCS-2026-0041/` and the supplied hospice timesheet under `hospice/PI-HSP-2026-0042/incoming/`.
- [ ] Hospital Records contains the Jordan Ellis packet under `hospice/PI-HSP-2026-0042/provider-response/`.
- [ ] Policy Docs contains the PCS plan of care and `reference/policy/03_personal_care_services_policy.pdf`.
- [ ] Fresh listings show PDF content types and nonzero sizes.

## Data Fabric

Playground is at its 500-object cap. Do not create replacement entities or choice sets.

- [ ] Confirm exactly nine `PI360*` entities with the recorded IDs.
- [ ] Confirm record counts: cases 2, providers 1, attendants 2, claims 10, EVV 12, signals 6, evidence 9, actions 15, decisions 2.
- [ ] Confirm total records: 59.
- [ ] Confirm one `PI-PCS-2026-0041` row and one `PI-HSP-2026-0042` row.
- [ ] Confirm the hospice case stores Jordan Ellis as member and Taylor Brooks as caregiver.
- [ ] Confirm the hospice claim stores 52 units, $3,250, `LINE-0714-01`, place of service 12, and the three lines in `claim_lines_json`.
- [ ] Confirm the hospital evidence row stores `Observation`, the exact arrival/discharge interval, and IXP model 9.

## Local verification

- [ ] Run the complete Python contract and PDF suite.
- [ ] From `ProgramIntegrity360/PI360CodedApp`, run `npm test`, `npm run lint`, and `npm run build`.
- [ ] Validate the Case plan, Maestro Flow, both API workflows, and agents with the installed UiPath CLI.
- [ ] Run `git diff --check`.

## Hospice-first smoke path

- [ ] Supply all six manual-trigger objects separately.
- [ ] Confirm `CaseType = StateMedicaidHospice` selects the hospice profile.
- [ ] Confirm $3,250 exceeds the $2,500 threshold.
- [ ] Confirm the claim API selects `/StateMedicaidHospice`.
- [ ] Confirm service-evidence extraction precedes the institutional record.
- [ ] Confirm the missing hospital record opens `Provider record request` with a 72-hour timer.
- [ ] Confirm the returned record preserves patient class `Observation`.
- [ ] Confirm deterministic rules return 360 overlap minutes and `reviewIndicatorOnly = true`.
- [ ] Confirm Agentic Caseworker recommends but does not open the true investigation.
- [ ] Confirm an investigator task is required before supervisor review.
- [ ] Confirm supervisor review exposes Investigator Findings and Agentic Evidence.
- [ ] Confirm closure and summary email remain blocked until human approval.

## PCS fallback smoke path

- [ ] Confirm `CaseType = MedicaidPCS` selects `/MedicaidPCS`.
- [ ] Confirm PCS retains its five deterministic signals and existing evidence.
- [ ] Confirm PCS skips the automatic hospital-record request.
- [ ] Confirm the coded app's `Demo data` state is described as PCS fallback, never as live hospice data.

## Demo guardrails

- [ ] Keep the payer label state Medicaid hospice.
- [ ] Preserve the printed patient class Observation without recasting it as a different hospital status.
- [ ] Call automated outputs review indicators or risk signals, not fraud findings.
- [ ] Do not complete a real adverse or financial task.
- [ ] Do not claim IXP runtime binding until the Maestro registry exposes the models.
- [ ] Keep Jordan's member role and attendant role separated by case ID.

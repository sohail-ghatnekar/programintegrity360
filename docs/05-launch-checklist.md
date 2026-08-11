# Launch checklist — Program Integrity 360

Target: `cloud.uipath.com / uipathlabs / Playground / AMER Presales/Public Sector/ProgramIntegrity360`. All data is synthetic.

## Deployment readiness

- [x] Confirm the CLI profile targets `uipathlabs/Playground`.
- [x] Confirm solution 0.5.1 remains available for rollback.
- [x] Validate, publish, and activate solution 0.6.1 per `solution/deploy.md`.
- [x] Confirm the active folder key is `5db31dd1-1073-4f9e-b44b-76f5484e03c4`.
- [x] Confirm the hosted coded app responds at `https://uipathlabs.uipath.host/pi360-coded-app`.
- [x] Do not publish a coded-app release in this pass; preserve its visual design and PCS demo-data fallback.
- [ ] Regenerate `caseplan.json.bpmn` from the current Case plan before packaging.
- [ ] Confirm the Case Evidence task is bound to `solution_folder.PI360CaseManagerFlow` and the hospice Provider task is bound to `solution_folder.PI360AdHocReviewBpmn`.
- [ ] Confirm no Case, Flow, or BPMN binding resolves to a `_1` resource.

## External fixtures

- [ ] `PI360ClaimDetailsApi` uses HTTP `GET` to `https://medicaid-claim-demo.free.beeceptor.com/MedicaidPCS` and returns `caseType = MedicaidPCS` and nine claims.
- [ ] `PI360ClaimDetailsApi` uses HTTP `GET` to `https://medicaid-claim-demo.free.beeceptor.com/StateMedicaidHospice` and returns `caseType = StateMedicaidHospice`, 52 units, and $3,250.
- [ ] Neither Beeceptor response supplies timesheet or hospital-derived conclusions.

## Deferred IXP, RPA, and email integrations

- [ ] Confirm no active Case, Flow, or BPMN node invokes IXP extraction, RPA automation, or automated email.
- [ ] Confirm `PI360 Service Evidence Extractor` model 12 and `PI360 Institutional Encounter Extractor` model 9 are identified only as deferred packaged assets.
- [ ] Confirm no demo output presents deferred IXP/RPA/email work as completed, queued, or sent.

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
- [ ] Confirm the hospital evidence row stores `Observation`, the exact arrival/discharge interval, and deferred IXP model-9 provenance (not a runtime IXP call).
- [ ] Confirm logical joins use `case_id` for Case-linked claims, signals, evidence documents, actions, and decisions; `provider_id` for Provider context; and `attendant_id`/`member_id` for service context. Do not create relationship entities at the tenant cap.

## Local verification

- [ ] Run the complete Python contract and PDF suite.
- [ ] From `ProgramIntegrity360/PI360CodedApp`, run `npm test`, `npm run lint`, and `npm run build`.
- [ ] Validate the Case plan, Maestro Flow, both API workflows, and agents with the installed UiPath CLI.
- [ ] Run `git diff --check`.

## Hospice-first smoke path

- [ ] Supply all six manual-trigger objects separately.
- [ ] Confirm `CaseType = StateMedicaidHospice` selects the hospice profile.
- [ ] Confirm $3,250 exceeds the $2,500 threshold.
- [ ] Confirm the Evidence Case task invokes `PI360CaseManagerFlow`, which uses `PI360ClaimDetailsApi` with HTTP `GET` to `/StateMedicaidHospice`, then QuickRules and CaseManager agents.
- [ ] Confirm the hospice Flow recommendation opens `Provider record request` and invokes `PI360AdHocReviewBpmn`.
- [ ] Confirm the BPMN's investigator-proceed gateway occurs before `API: Request hospital record` and its visible timer is `P3D` (72 hours).
- [ ] Confirm a missing hospital record remains awaiting provider without claiming analysis; a returned record is intaken before return to Investigation.
- [ ] Confirm the returned record preserves patient class `Observation`.
- [ ] Confirm deterministic rules return 360 overlap minutes and `reviewIndicatorOnly = true`.
- [ ] Confirm Agentic Caseworker recommends but does not open the true investigation.
- [ ] Confirm an investigator task is required before supervisor review.
- [ ] Confirm supervisor review exposes Investigator Findings and Agentic Evidence.
- [ ] Confirm closure persists the human-approved disposition and audit trail; no automated closure email is sent or queued.

## PCS fallback smoke path

- [ ] Confirm `CaseType = MedicaidPCS` selects `PI360ClaimDetailsApi` HTTP `GET` route `/MedicaidPCS`.
- [ ] Confirm PCS retains its five deterministic signals and existing evidence.
- [ ] Confirm the PCS overlapping-visit signal remains 90 minutes; the 360-minute location/time conflict is hospice `RS-HSP-01`.
- [ ] Confirm PCS skips the automatic hospital-record request.
- [ ] Confirm the coded app's `Demo data` state is described as PCS fallback, never as live hospice data.

## Demo guardrails

- [ ] Keep the payer label state Medicaid hospice.
- [ ] Preserve the printed patient class Observation without recasting it as a different hospital status.
- [ ] Call automated outputs review indicators or risk signals, not fraud findings.
- [ ] Do not complete a real adverse or financial task.
- [ ] Do not claim IXP runtime binding, RPA execution, or automated email delivery; all are deferred in this build.
- [ ] Keep Jordan's member role and attendant role separated by case ID.

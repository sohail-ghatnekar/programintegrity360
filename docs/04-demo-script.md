# Program Integrity 360 demo script

Length: 10–12 minutes. Audience: state Medicaid program-integrity leaders and delivery teams. All data is synthetic.

## Opening

Say:

> "Program Integrity 360 identifies review indicators, organizes evidence, and routes decisions to accountable people. Deterministic rules calculate; agents explain and recommend; investigators and supervisors decide. The system does not autonomously determine fraud, intent, coverage, payment, or recovery."

The primary walkthrough is `PI-HSP-2026-0042`, State Medicaid Hospice. The current coded-app visual design is unchanged. Use the live hospice record only when the app badge says `Live UiPath` and the record is visible. If the badge says `Demo data`, use the separate PCS fallback below and do not represent it as the hospice case.

The Case plan owns lifecycle and human checkpoints; Data Fabric is the persistent system of record. In this build, Evidence invokes `PI360CaseManagerFlow`, and the hospice provider-record stage invokes `PI360AdHocReviewBpmn`. IXP extraction, RPA automation, and automated email are deferred and are not executed.

## Manual-trigger inputs

Enter these as six separate JSON inputs, not as one wrapper object:

```json
caseInput = {
  "caseId": "PI-HSP-2026-0042",
  "caseType": "StateMedicaidHospice",
  "currentStage": "Stage_Aintk1",
  "riskScore": 82
}
```

```json
claimInput = {
  "claimId": "CLM-HSP-2026-0714-001",
  "totalUnits": 52,
  "totalBilled": 3250.00,
  "claimThreshold": 2500.00
}
```

```json
memberInput = {
  "memberId": "MBR-071426",
  "medicaidId": "NMCD-SYN-071426",
  "memberName": "Jordan Ellis",
  "dateOfBirth": "1991-02-08"
}
```

```json
providerInput = {
  "providerId": "PRV-100482",
  "providerName": "Harbor Home Support Services",
  "caregiverId": "ATT-HSP-4401",
  "caregiverName": "Taylor Brooks"
}
```

```json
serviceEventInput = {
  "lineId": "LINE-0714-01",
  "dateOfService": "2026-07-14",
  "placeOfServiceCode": "12",
  "placeOfServiceDescription": "Member home",
  "claimedServiceStartAt": "2026-07-14T09:00:00-05:00",
  "claimedServiceEndAt": "2026-07-14T15:00:00-05:00",
  "units": 24
}
```

```json
documentInput = {
  "timesheetBucketPath": "Timesheets/hospice/PI-HSP-2026-0042/incoming/01_personal_care_timesheet.pdf",
  "hospitalRecordBucketPath": "Hospital Records/hospice/PI-HSP-2026-0042/provider-response/jordan_ellis_synthetic_medical_record_packet.pdf",
  "policyBucketPath": "Policy Docs/reference/policy/03_personal_care_services_policy.pdf",
  "hospitalRecordAvailable": false,
  "patientClass": "Observation"
}
```

## Timed walkthrough

| Time | Surface | Story point |
|---|---|---|
| 0:00–1:15 | Manual trigger and Intake | CaseType routing and threshold |
| 1:15–2:45 | Evidence acquisition | Case invokes Flow: Beeceptor GET, QuickRules, and Caseworker routing |
| 2:45–4:15 | Provider record request | Hospice BPMN investigator gate and visible `P3D` wait |
| 4:15–5:45 | Rules and Caseworker | 360-minute conflict and grounded first pass |
| 5:45–7:45 | Coded app and investigator task | Human confirmation to open a true investigation |
| 7:45–9:30 | Supervisor review | Investigator Findings and Agentic Evidence |
| 9:30–11:00 | Closure | Audit trail, reviewed disposition, and next steps |

### 1. Intake and triage

Show the six inputs and `CaseType = StateMedicaidHospice`, then point out the corresponding Case row in Data Fabric.

Say:

> "CaseType is the first routing decision. The deterministic rule compares the $3,250 claim total with the $2,500 demo threshold. Because the threshold is exceeded, the Case invokes its evidence-routing Flow. The Case record is the lifecycle authority; Data Fabric persists the Case and its linked evidence, actions, and decisions. An unknown CaseType is rejected rather than guessed."

### 2. Evidence acquisition and validation

Show the Case task `Flow - acquire and validate claim evidence`, then show `PI360CaseManagerFlow` calling `PI360ClaimDetailsApi` with HTTP `GET`:

`https://medicaid-claim-demo.free.beeceptor.com/StateMedicaidHospice`

Point to the three claim lines, 52 units, and $3,250 total. Then show the Timesheets bucket path as supplied evidence and the Flow's `PI360QuickRulesCodedAgent` and `PI360CaseManagerAgent` steps.

Say:

> "The API supplies claim facts only. The timesheet is separate supplied evidence. The Flow uses QuickRules for deterministic routing and the Agentic Caseworker for a cited recommendation; neither decides fraud or opens an investigation. IXP extraction is deferred in this build, so no IXP result is presented as a runtime action."

Do not say the Beeceptor response contains hospital or timesheet facts.

### 3. Provider record request

Show the hospice-only Case task `BPMN - request and await hospital record` and the `PI360AdHocReviewBpmn` diagram. Point first to `Investigator proceed?`, then to `API: Request hospital record`, `Await response (P3D)`, and `API: Intake hospital record`. Show the supplied hospital packet in the Hospital Records bucket only as the provider response becomes available.

Say:

> "Hospice adds a BPMN-owned provider-record stage. The investigator-proceed gateway blocks the request until approval. Once approved, the BPMN visibly waits `P3D`, or 72 hours, for the provider response. A returned record is intaken and control returns to Investigation; a missing record remains awaiting provider and no analysis is claimed. The printed patient class is Observation, not inpatient."

Do not present an institutional IXP extraction as executed; that integration is deferred.

### 4. Deterministic conflict and Agentic Caseworker

Show `RS-HSP-01` and its persisted evidence references:

- Claimed member-home service: July 14, 09:00–15:00.
- Observation encounter: July 14 at 08:20 through July 16 at 10:00.
- Intersection: 360 minutes.

Say:

> "Deterministic code compares the two intervals and records a six-hour location/time conflict. That result is a review indicator only. The Agentic Caseworker receives cited claim facts, supplied evidence, policy reference, and rule output. It organizes facts and recommends whether an investigator should open a true investigation; it does not make that decision."

Say explicitly that Jordan's record says `Observation`. The policy's inpatient restriction cannot be applied as if Jordan were inpatient.

### 5. Coded app and investigator intervention

Open `https://uipathlabs.uipath.host/pi360-coded-app` and verify the source badge.

With `Live UiPath`, open `PI-HSP-2026-0042` from `Command center`. Use the existing click model: `Case workspace` → `Evidence` → `Decisions` → `Task Center`.

Point to:

- Jordan Ellis as member/patient.
- Taylor Brooks as caregiver.
- Claim total and threshold.
- Timesheet, hospital record, and policy reference.
- Patient class `Observation`.
- Caseworker recommendation and cited evidence.

Open the investigator task and show the brief that asks the person to confirm whether a true investigation should be opened.

Say:

> "The coded app assembles the persisted evidence and agentic recommendation in the existing workbench. The investigator can validate, edit, and decide whether to open a true investigation. Closing a drawer or receiving an agent response does not complete the task; only the Tasks API `Completed` state does."

Do not complete a real operational task during the demo.

### 6. Supervisor review

Switch to `Supervisor`, open `Decisions`, and show the existing supervisor workbench.

Say:

> "The supervisor receives the investigator's findings first. The Agentic Evidence view is selectable, so the recommendation and citations remain available without replacing the investigator's judgment. Any adverse or financial direction remains a human decision."

### 7. Closure and communication

Show `Closure and communication` in the six-stage strip and the API workflow that closes the Case and persists the approved disposition.

Say:

> "Closure occurs only after the required human review. The Case persists the supervisor-approved disposition and audit trail in Data Fabric. It preserves Observation exactly and never labels the review indicator as a fraud determination. Automated closure email is deferred and is not sent or queued in this build."

## PCS fallback

Use this only when the app shows `Demo data` or the live hospice record is unavailable.

Open `PI-PCS-2026-0041` and state clearly:

> "This is the retained Medicaid PCS fallback, not the hospice patient story. Jordan Ellis is the attendant in this separate synthetic case."

Show the existing 90-minute overlapping visit, 24 unsupported units, timesheet evidence, investigator decision, supervisor gate, and audit timeline. PCS uses `PI360ClaimDetailsApi` with HTTP `GET` to `https://medicaid-claim-demo.free.beeceptor.com/MedicaidPCS` and skips the hospice provider-record BPMN.

## Presenter guardrails

- Keep the payer label `state Medicaid hospice`.
- Preserve the printed patient class `Observation`; do not recast it as a different hospital status.
- Call the 360-minute result a review indicator or location/time conflict, not fraud.
- Do not imply the policy automatically denies the claim.
- Do not describe IXP, RPA automation, or automated email as active runtime work; all are deferred.
- Do not claim task completion without the explicit Tasks API `Completed` confirmation.
- Keep Jordan's roles separated by case ID.

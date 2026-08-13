# Program Integrity 360 demo script

Length: 10–12 minutes. Audience: state Medicaid program-integrity leaders and delivery teams. All data is synthetic.

## Opening

Say:

> "Program Integrity 360 identifies review indicators, organizes evidence, and routes decisions to accountable people. Deterministic rules calculate; agents explain and recommend; investigators and supervisors decide. The system does not autonomously determine fraud, intent, coverage, payment, or recovery."

The primary walkthrough is `PI-HSP-2026-0042`, State Medicaid Hospice. The current coded-app visual design is unchanged. Use the live hospice record only when the app badge says `Live UiPath` and the record is visible. If the badge says `Demo data`, use the separate PCS fallback below and do not represent it as the hospice case.

The Case plan owns lifecycle and human checkpoints; Data Fabric is the persistent system of record. Evidence runs the timesheet RPA and `PI360CaseManagerFlow`; the hospice provider-record stage runs `PI360AdHocReviewBpmn`; supervisor review creates an RPA decision packet; and closure persists the approved result before the Outlook RPA sends its summary.

## Manual-trigger inputs

Enter only these two case inputs:

```json
{
  "caseType": "StateMedicaidHospice",
  "caseworkerEmail": "sohail.ghatnekar@uipath.com"
}
```

Use `MedicaidPCS` for the PCS branch or `StateMedicaidHospice` for the hospice branch. The Case generates a unique Case ID and hydrates the selected scenario's synthetic claim, member, provider, service, and document data internally.

## Timed walkthrough

| Time | Surface | Story point |
|---|---|---|
| 0:00–1:15 | Manual trigger and Intake | CaseType routing and threshold |
| 1:15–2:45 | Evidence acquisition | Timesheet RPA, Beeceptor GET, Data Fabric writes, QuickRules, and Caseworker routing |
| 2:45–4:15 | Provider record request | Hospice BPMN gate, RPA request, response/`P3D` race, medical-record RPA, and persistence |
| 4:15–5:45 | Rules and Caseworker | 360-minute conflict and grounded first pass |
| 5:45–7:45 | Coded app and investigator task | Human confirmation to open a true investigation |
| 7:45–9:30 | Supervisor review | Investigator Findings and Agentic Evidence |
| 9:30–11:00 | Closure | Data Fabric decision/update, audit trail, and RPA closure email |

### 1. Intake and triage

Show the two inputs and `caseType = StateMedicaidHospice`, then point out the corresponding generated Case row in Data Fabric.

Say:

> "CaseType is the first routing decision. The deterministic rule compares the $3,250 claim total with the $2,500 demo threshold. Because the threshold is exceeded, the Case invokes its evidence-routing Flow. The Case record is the lifecycle authority; Data Fabric persists the Case and its linked evidence, actions, and decisions. An unknown CaseType is rejected rather than guessed."

### 2. Evidence acquisition and validation

Show `RPA - extract service timesheet`, then the Case task `Flow - acquire and validate claim evidence`. Show `PI360CaseManagerFlow` calling `PI360ClaimDetailsApi` with HTTP `GET`:

`https://medicaid-claim-demo.free.beeceptor.com/StateMedicaidHospice`

Point to the three claim lines, 52 units, and $3,250 total. Then trace the Flow's Data Fabric writes: Provider, Claim, intake Evidence Document, and Risk Signal. The hospice branch skips Attendant and EVV; the PCS branch writes both. Finish with `PI360QuickRulesCodedAgent` and `PI360CaseManagerAgent`.

Say:

> "The claim API supplies claim facts only. The timesheet RPA handles the supplied service document. The Flow persists the normalized facts and intake evidence through Program Integrity Fabric, then uses QuickRules for deterministic routing and the Agentic Caseworker for a cited recommendation. Neither decides fraud or opens an investigation."

Do not say the Beeceptor response contains hospital or timesheet facts.

### 3. Provider record request

Show the hospice-only Case task `BPMN - request and await hospital record` and `PI360AdHocReviewBpmn`. Point first to `Investigator proceed?`, then to `RPA placeholder: send provider record request` and the event-based response race. Follow the message path through `RPA: extract hospital medical record` and `API: persist hospital evidence to Data Fabric`. Also point to the alternate `P3D` timeout end. Show the supplied hospital packet in the Hospital Records bucket only as the provider response becomes available.

Say:

> "Hospice adds a BPMN-owned provider-record stage. The investigator-proceed gateway blocks the request until approval. The provider-request integration is an explicit RPA placeholder. After it runs, BPMN waits for either a Case-correlated response or `P3D`. A response runs the medical-record extraction RPA and persists the hospital evidence and audit action before control returns to Investigation. A timeout remains awaiting provider. The printed patient class is Observation, not inpatient."

Do not claim the hospital record is available before the correlated provider-response message. Do not describe the RPA placeholder as a working provider-portal integration.

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

Switch to `Supervisor`, show `RPA - build supervisor decision packet`, then open `Decisions` and the existing supervisor workbench.

Say:

> "The supervisor receives the investigator's findings first. The Agentic Evidence view is selectable, so the recommendation and citations remain available without replacing the investigator's judgment. Any adverse or financial direction remains a human decision."

### 7. Closure and communication

Show `Closure and communication` in the six-stage strip. Trace `CloseCaseAndEmitMetrics`: it creates the final Decision and closure audit action, resolves the Case by `case_id`, and updates it to Closure/Closed. Then show the sequential `RPA - send closure summary email` task.

Say:

> "Closure occurs only after the required human review. The API workflow persists the supervisor-approved Decision and audit action and updates the Case to Closed. Only then does the Outlook RPA send the approved disposition, evidence summary, and next steps. It preserves Observation exactly and never labels the review indicator as a fraud determination."

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
- Distinguish the active timesheet, medical-record, decision-packet, and email RPA projects from the two explicitly labeled integration placeholders.
- Do not claim task completion without the explicit Tasks API `Completed` confirmation.
- Keep Jordan's roles separated by case ID.

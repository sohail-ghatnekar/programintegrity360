# CANON — Program Integrity 360

Every artifact must match this file. All data is synthetic.

## Positioning

Program Integrity 360 identifies review indicators, organizes evidence, and routes decisions to people. It does not autonomously determine fraud, intent, coverage, payment, or recovery.

- Deterministic rules calculate thresholds, overlaps, overages, and unsupported units.
- Agents separate cited facts from inferences and recommend next steps.
- Investigators validate evidence and decide whether to proceed.
- Supervisors retain adverse and financial decisions.
- `Observation` and `inpatient` are never used interchangeably.

## Intake contract

The manual trigger receives six separate objects:

1. `caseInput`
2. `claimInput`
3. `memberInput`
4. `providerInput`
5. `serviceEventInput`
6. `documentInput`

`caseInput.caseType` is required and accepts `MedicaidPCS` or `StateMedicaidHospice`.

## Primary case: State Medicaid Hospice

| Field | Value |
|---|---|
| Case ID | `PI-HSP-2026-0042` |
| CaseType | `StateMedicaidHospice` |
| Program | State Medicaid Hospice |
| Alert | `ALERT-HSP-2026-0714` |
| Provider | Harbor Home Support Services, `PRV-100482` |
| Member/patient | Jordan Ellis, `MBR-071426` |
| Medicaid ID | `NMCD-SYN-071426` |
| Date of birth | 1991-02-08 |
| Caregiver | Taylor Brooks, `ATT-HSP-4401` |
| Claim | `CLM-HSP-2026-0714-001` |
| Claim total | 52 units, $3,250 |
| Demo threshold | $2,500 |
| Priority | High |

Jordan Ellis is the patient/member in this case. Taylor Brooks is the caregiver. Jordan's PCS attendant role belongs only to the separate PCS case below.

### Hospice claim lines

| Line | Date | Claimed home interval | Units | Amount | Status |
|---|---|---|---:|---:|---|
| `LINE-0713-01` | 2026-07-13 | 09:00–13:00 | 16 | $1,000 | Under Review |
| `LINE-0714-01` | 2026-07-14 | 09:00–15:00 | 24 | $1,500 | Flagged for review |
| `LINE-0716-01` | 2026-07-16 | 13:00–16:00 | 12 | $750 | Under Review |

All three use place of service 12, `Member home`, and a 15-minute unit convention.

### Service and hospital evidence

- Timesheet: `01_personal_care_timesheet.pdf`.
- Timesheet document ID: `TS-PCS-2026-0719-10482`.
- The timesheet reports the three claim intervals and 52 total units.
- It also prints hospitalized July 14 through July 16 and a manual EVV exception entered July 17.
- Hospital packet: `jordan_ellis_synthetic_medical_record_packet.pdf`.
- Encounter ID: `ENC-SYN-20260714-JE`.
- Facility: Lakeview Regional Medical Center, fictional.
- Patient class: `Observation`.
- Arrival: `2026-07-14T08:20:00-05:00`.
- Discharge: `2026-07-16T10:00:00-05:00`.
- Disposition: Home, self-care.

The July 14 claimed home-service interval overlaps the observation encounter by 360 minutes. `RS-HSP-01` records that exact deterministic comparison. It is a review indicator, not a finding of fraud or an automatic denial.

### Policy reference

`03_personal_care_services_policy.pdf`, policy `PCS-4.7`, is grounding for the agent. Its inpatient restriction must not be applied as if this observation encounter were inpatient. The policy is not an IXP extraction target and is marked `reference_only`.

### Hospice route

The $3,250 claim exceeds the $2,500 threshold, so evidence acquisition continues. The service timesheet is extracted first. Because `CaseType = StateMedicaidHospice`, an ad-hoc provider record request opens a 72-hour wait for the hospital packet. Institutional extraction and deterministic interval comparison then precede the Agentic Caseworker recommendation and investigator decision.

## Fallback case: Medicaid PCS

| Field | Value |
|---|---|
| Case ID | `PI-PCS-2026-0041` |
| CaseType | `MedicaidPCS` |
| Provider | Harbor Home Support Services, `PRV-100482` |
| Attendant | Jordan Ellis, `ATT-2087` |
| Service period | 2026-03-01 through 2026-05-31 |
| Priority | High |

This is the existing simplified PCS story. Jordan is the attendant, not the patient. The deterministic signals remain:

- `RS-01`: one 90-minute overlapping visit on April 14.
- `RS-02`: 12 of 44 visits manually entered without GPS confirmation.
- `RS-03`: 12 units above the plan of care across three dates.
- `RS-04`: 24 de-duplicated unsupported units across four claims.
- `RS-05`: expired credential and two missing personnel documents.

The reviewed-sample basis is $172.80; the reviewed-period estimate is about $1,600; the provider-wide range is $18,000–$42,000 pending audit. Every amount carries the non-determination disclaimer.

## Shared six-stage lifecycle

| Stage | Required behavior |
|---|---|
| Intake and triage | Validate six inputs, select profile by CaseType, apply deterministic threshold routing |
| Evidence acquisition and validation | Call the CaseType-specific Beeceptor route and extract service evidence |
| Provider record request | Hospice-only ad-hoc branch; wait up to 72 hours and extract the institutional encounter |
| Investigation | Agentic Caseworker first pass, coded-app brief, mandatory investigator decision |
| Supervisor review | Investigator Findings and Agentic Evidence views, mandatory human disposition |
| Closure and communication | Persist reviewed outcome, audit trail, closure summary email, and next steps |

## Endpoints and IXP

- PCS: `https://medicaid-claim-demo.free.beeceptor.com/MedicaidPCS`
- Hospice: `https://medicaid-claim-demo.free.beeceptor.com/StateMedicaidHospice`
- Service extractor: `PI360 Service Evidence Extractor`, project `pi360_timesheets-46b073f4-ixp`, live model 12.
- Institutional extractor: `PI360 Institutional Encounter Extractor`, project `pi360-institutional-encounter-extractor-53d63c92-ixp`, live model 9.

The current authenticated Maestro registry does not expose those two IXP projects as selectable nodes. The Flow therefore uses explicitly labeled swap-ready mocks carrying the real model metadata. Do not describe those nodes as active IXP runtime calls until registry binding is verified.

## Data Fabric C-light model

Playground is at its 500-object Data Fabric cap. Version 0.6.0 therefore preserves the nine existing PI360 entities and extends them additively.

- `case_type` and member identity live on `PI360ProgramIntegrityCase`.
- The hospice claim is one `PI360Claim` header; all three source lines remain in `claim_lines_json`.
- Institutional encounter columns live on the hospital `PI360EvidenceDocument` row.
- There are 59 records total: 2 cases, 1 provider, 2 attendants, 10 claims, 12 EVV visits, 6 signals, 9 evidence documents, 15 actions, and 2 decisions.

No entity or choice-set deletion, rename, or replacement is permitted.

## Storage

- Timesheets: PCS incoming/provider-response and hospice incoming prefixes.
- Hospital Records: hospice provider-response prefix.
- Policy Docs: PCS plan-of-care prefix and shared `reference/policy` prefix.

Exact keys and paths are recorded in `platform/cloud-playground-migration.json`.

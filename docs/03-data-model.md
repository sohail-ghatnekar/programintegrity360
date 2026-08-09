# Data model — Program Integrity 360

The live `uipathlabs/Playground` tenant is at its 500-object Data Fabric cap. Version 0.6.0 uses a C-light additive model on the nine existing PI360 entities. It creates no new entities or choice sets and preserves every existing ID.

## Record counts

| Entity | Rows | Natural key |
|---|---:|---|
| `PI360ProgramIntegrityCase` | 2 | `case_id` |
| `PI360Provider` | 1 | `provider_id` |
| `PI360Attendant` | 2 | `attendant_id` |
| `PI360Claim` | 10 | `claim_id` |
| `PI360EvvVisit` | 12 | `evv_id` |
| `PI360RiskSignal` | 6 | `signal_id` |
| `PI360EvidenceDocument` | 9 | `doc_id` |
| `PI360InvestigationAction` | 15 | `action_id` |
| `PI360Decision` | 2 | `decision_id` |

Total: 59.

## Case

`PI360ProgramIntegrityCase` is the aggregate root. Existing lifecycle, assignment, exposure, and audit fields remain unchanged. Version 0.6.0 adds:

| Field | Type | Hospice example |
|---|---|---|
| `case_type` | String | `StateMedicaidHospice` |
| `member_id` | String | `MBR-071426` |
| `member_name` | String | Jordan Ellis |
| `member_date_of_birth` | Date | 1991-02-08 |
| `member_medicaid_id` | String | `NMCD-SYN-071426` |
| `caregiver_name` | String | Taylor Brooks |
| `claim_total_billed` | Decimal(2) | 3250.00 |
| `claim_threshold` | Decimal(2) | 2500.00 |

`case_type` is a string because the tenant cap prevents creation of `PI360CaseType`. The application contract still allows only `MedicaidPCS` and `StateMedicaidHospice`.

## Claim

Nine existing PCS rows remain unchanged in identity. One hospice aggregate row, `CLM-HSP-2026-0714-001`, stores 52 units and $3,250. New fields are:

| Field | Type | Purpose |
|---|---|---|
| `case_type` | String | CaseType routing value |
| `program` | String | Normalized Medicaid program |
| `provider_id` | String | Provider reference |
| `claim_lines_json` | Multiline text | All three hospice source lines |
| `flagged_line_id` | String | `LINE-0714-01` |
| `service_type` | String | In-home hospice personal care |
| `place_of_service_code` | String | `12` |
| `place_of_service_description` | String | Member home |
| `claimed_service_start_at` | DateTime with timezone | July 14 at 09:00 -05:00 |
| `claimed_service_end_at` | DateTime with timezone | July 14 at 15:00 -05:00 |
| `unit_minutes` | Decimal | 15 |
| `source_claim_status` | String | Paid |

The aggregate avoids violating the existing unique `claim_id` constraint while retaining exact source lines for evidence review.

## Evidence document

Existing extraction fields and validation status remain. Version 0.6.0 adds:

| Field | Type | Purpose |
|---|---|---|
| `ixp_model` | String | Extractor title |
| `ixp_model_version` | String | Published model version |
| `reference_only` | Boolean | Separates policy grounding from extraction evidence |
| `patient_class` | String | `Observation` |
| `encounter_id` | String | `ENC-SYN-20260714-JE` |
| `facility_name` | String | Fictional hospital |
| `care_area` | String | Hospital Medicine - Observation |
| `encounter_arrival_at` | DateTime with timezone | 2026-07-14T08:20:00-05:00 |
| `encounter_discharge_at` | DateTime with timezone | 2026-07-16T10:00:00-05:00 |
| `encounter_disposition` | String | Home, self-care |

Institutional fields are normalized onto the hospital evidence row. The full extraction payload remains in `extracted_fields`.

## Other entities

- `PI360Provider`: shared provider enrollment context.
- `PI360Attendant`: Jordan Ellis for PCS and Taylor Brooks for hospice.
- `PI360EvvVisit`: PCS EVV evidence.
- `PI360RiskSignal`: deterministic rule, inputs, output, severity, version, and timestamp. `RS-HSP-01` records the 360-minute location/time conflict.
- `PI360InvestigationAction`: shared audit stream distinguishing system, agent, and human actions.
- `PI360Decision`: investigator and supervisor decisions; adverse or financial action remains human-gated.

`PI360DocType` includes Timesheet, Plan of Care, Service Note, Personnel Packet, Correspondence, Hospital Record, Policy Reference, and Hospice Service Record.

## Idempotency

`platform/03_seed.js` queries each entity by its natural key, includes the UiPath system `Id` for updates, and inserts only when no match exists. A duplicate natural key stops the script rather than silently choosing a row.

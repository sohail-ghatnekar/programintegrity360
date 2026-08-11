# Data model — Program Integrity 360

The live `uipathlabs/Playground` tenant is at its 500-object Data Fabric cap. Version 0.6.1 uses a C-light additive model on the nine existing PI360 entities. It creates no new entities or choice sets and preserves every existing ID.

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

`PI360ProgramIntegrityCase` is the lifecycle aggregate root and the authoritative Case record. Intake writes the Case record; the Case lifecycle controls investigator and supervisor boundaries; closure persists the approved disposition to the Case. Existing lifecycle, assignment, exposure, and audit fields remain unchanged. Version 0.6.1 adds:

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

## Logical relationships

The C-light model contains no new Data Fabric relationship entities or enforced foreign keys. It uses stable identifier fields as logical joins:

| From | Logical join | To | Meaning |
|---|---|---|---|
| Case | `provider_id` | Provider | Provider under review |
| Case | `attendant_id` | Attendant | PCS attendant or hospice caregiver context |
| Claim | `case_id` | Case | Claim evidence for a Case lifecycle |
| Claim | `provider_id`, `attendant_id`, `member_id` | Provider, Attendant, member identity | Claim participants and beneficiary context |
| Risk signal, Evidence document, Investigation action, Decision | `case_id` | Case | Evidence, audit, and decision records for that Case |
| EVV visit | `attendant_id`, `member_id` | Attendant and member identity | PCS service evidence; it does not carry a `case_id` field |

The hospice Case has one aggregate Claim header containing the three source lines. Its hospital packet is a `PI360EvidenceDocument` row joined by `case_id`; the Observation encounter fields are attributes of that evidence row, not a separate encounter entity.

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

Existing extraction fields and validation status remain. Version 0.6.1 adds:

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

Institutional fields are normalized onto the hospital evidence row. The full extraction payload remains in `extracted_fields`. The `ixp_model` and `ixp_model_version` columns preserve provenance for existing/deferred content; no IXP runtime extraction is invoked in this build.

## Other entities

- `PI360Provider`: shared provider enrollment context.
- `PI360Attendant`: Jordan Ellis for PCS and Taylor Brooks for hospice.
- `PI360EvvVisit`: PCS EVV evidence.
- `PI360RiskSignal`: deterministic rule, inputs, output, severity, version, and timestamp. `RS-HSP-01` records the 360-minute location/time conflict; it is a review indicator only.
- `PI360InvestigationAction`: shared audit stream distinguishing system, agent, and human actions.
- `PI360Decision`: investigator and supervisor decisions; adverse or financial action remains human-gated.

`PI360DocType` includes Timesheet, Plan of Care, Service Note, Personnel Packet, Correspondence, Hospital Record, Policy Reference, and Hospice Service Record.

The Case, Flow, and BPMN do not invoke IXP, RPA automation, or automated email. Those assets may remain packaged, but they do not create or update the records described here.

## Idempotency

`platform/03_seed.js` queries each entity by its natural key, includes the UiPath system `Id` for updates, and inserts only when no match exists. A duplicate natural key stops the script rather than silently choosing a row.

# Data model — Program Integrity 360

The `uipathlabs/Playground` implementation uses the nine existing PI360 Data Fabric entities through the live `Program Integrity Fabric` connection. The design is additive: it preserves every entity ID, adds no entity or relationship object, and uses stable business identifiers for logical joins. All records are synthetic.

## Ownership and write paths

| Runtime component | Data Fabric responsibility |
|---|---|
| `PI360ApiWorkflows / IntakeClaimByCaseType` | Creates the Case aggregate or returns the existing row for the same `case_id` |
| `PI360CaseManagerFlow` | Creates Provider, Claim, PCS Attendant and EVV, Risk Signal, and intake Evidence Document records |
| `PI360 IXP Medical Record` | Returns extracted admission/discharge dates and normalized encounter metadata for the hospital-evidence write |
| `PI360ApiWorkflows / IntakeHospitalRecord` | Consumes the medical-record RPA output plus the correlated provider message, then creates the hospice hospital Evidence Document and an Investigation Action |
| `PI360DecisionPacketAutomation` | Produces the supervisor packet; the Case task captures its outputs |
| Human investigator and supervisor tasks | Supply findings, decision, rationale, and next steps to the Case context |
| `PI360ApiWorkflows / CloseCaseAndEmitMetrics` | Creates the final Decision and closure Investigation Action, then updates the Case to Closed |
| `PI360 Send Outlook Email` | Communicates the already-approved closure; it is not a Data Fabric writer |

The Flow tolerates an already-existing Provider or Attendant master row so a new Case can reuse stable participants. Case, Claim, EVV, Signal, Document, Action, and Decision IDs are case-scoped to avoid collisions.

## Entity catalog

| Entity | Live ID | Natural key | Parent join | Runtime writer |
|---|---|---|---|---|
| `PI360ProgramIntegrityCase` | `497c2d5c-7492-f111-b338-000d3ab4d3b7` | `case_id` | aggregate root | API Workflow intake and closure |
| `PI360Provider` | `6e7c2d5c-7492-f111-b338-000d3ab4d3b7` | `provider_id` | reused by Case and Claim | Flow |
| `PI360Attendant` | `827c2d5c-7492-f111-b338-000d3ab4d3b7` | `attendant_id` | reused by Case, Claim, and EVV | Flow, PCS branch only |
| `PI360Claim` | `947c2d5c-7492-f111-b338-000d3ab4d3b7` | `claim_id` | `case_id` | Flow |
| `PI360EvvVisit` | `b2acb462-7492-f111-b338-000d3ab4d3b7` | `evv_id` | `attendant_id`, `member_id` | Flow, PCS branch only |
| `PI360RiskSignal` | `c6acb462-7492-f111-b338-000d3ab4d3b7` | `signal_id` | `case_id` | Flow |
| `PI360EvidenceDocument` | `deacb462-7492-f111-b338-000d3ab4d3b7` | `doc_id` | `case_id` | Flow and API Workflow |
| `PI360InvestigationAction` | `f2acb462-7492-f111-b338-000d3ab4d3b7` | `action_id` | `case_id` | API Workflow |
| `PI360Decision` | `05adb462-7492-f111-b338-000d3ab4d3b7` | `decision_id` | `case_id` | API Workflow closure |

## Complete field schema

Types shown below are the UiPath Data Fabric field types. `*` marks a required, unique natural key.

### PI360ProgramIntegrityCase

| Fields | Type |
|---|---|
| `case_id`* | String |
| `case_type`, `title`, `program`, `trigger_type`, `trigger_ref`, `requester_email`, `maestro_instance_id` | String |
| `provider_id`, `member_id`, `member_name`, `member_medicaid_id`, `attendant_id`, `caregiver_name` | String |
| `member_date_of_birth`, `service_period_start`, `service_period_end`, `alert_date` | Date |
| `claim_total_billed`, `claim_threshold`, `risk_signal_count`, `potential_exposure_low`, `potential_exposure_period_estimate`, `potential_exposure_high` | Decimal |
| `priority` | `PI360Priority` choice |
| `stage` | `PI360CaseStage` choice |
| `status` | `PI360CaseStatus` choice |
| `exposure_disclaimer`, `assigned_investigator`, `assigned_supervisor`, `disposition` | String |
| `opened_at`, `sla_due`, `closed_at`, `created_at`, `updated_at` | DateTime with timezone |

Accepted `case_type` values are `MedicaidPCS` and `StateMedicaidHospice`. The active stage values are Intake `0`, Evidence `1`, Document Extraction `2`, Correlation `3`, Investigator `4`, Provider Request `5`, Supervisor `6`, Action Execution `7`, and Closure `8`. Status values are Open `0`, In Review `1`, Awaiting Provider `2`, Pending Approval `3`, and Closed `4`.

### PI360Provider

| Fields | Type |
|---|---|
| `provider_id`* | String |
| `name`, `medicaid_provider_id`, `npi`, `address`, `enrollment_status`, `prior_integrity_history`, `watch_list_reason` | String |
| `active_attendant_count` | Decimal |
| `watch_list` | Boolean |

### PI360Attendant

| Fields | Type |
|---|---|
| `attendant_id`* | String |
| `name`, `provider_id`, `role`, `credential_id`, `missing_docs` | String |
| `credential_expiry` | Date |
| `personnel_docs_complete` | Boolean |

### PI360Claim

| Fields | Type |
|---|---|
| `claim_id`* | String |
| `case_id`, `case_type`, `program`, `provider_id`, `attendant_id`, `member_id` | String |
| `date_of_service` | Date |
| `units_billed`, `unit_rate`, `billed_amount`, `evv_supported_units`, `timesheet_supported_units`, `poc_daily_units`, `improper_units`, `unit_minutes` | Decimal |
| `claim_lines_json` | Multiline text |
| `flagged_line_id`, `service_type`, `place_of_service_code`, `place_of_service_description`, `source_claim_status`, `notes`, `method_flag` | String |
| `claimed_service_start_at`, `claimed_service_end_at` | DateTime with timezone |
| `status` | `PI360ClaimStatus` choice |

The hospice row is an aggregate claim header. `claim_lines_json` retains the Beeceptor lines while `flagged_line_id` and the claimed interval normalize the line under review.

### PI360EvvVisit

| Fields | Type |
|---|---|
| `evv_id`* | String |
| `attendant_id`, `member_id`, `start_time`, `end_time`, `overlaps_with` | String |
| `service_date` | Date |
| `units` | Decimal |
| `capture_method` | `PI360CaptureMethod` choice |
| `gps_confirmed` | `PI360GpsConfirmed` choice |

This entity is PCS-specific and has no `case_id`; the logical link is through attendant and member identifiers.

### PI360RiskSignal

| Fields | Type |
|---|---|
| `signal_id`* | String |
| `case_id`, `name`, `result_value`, `computed_by` | String |
| `rule_expression`, `inputs` | Multiline text |
| `severity` | `PI360Priority` choice |
| `computed_at` | DateTime with timezone |

For hospice, the persisted signal represents a location/time conflict for review. It is not a fraud or coverage determination.

### PI360EvidenceDocument

| Fields | Type |
|---|---|
| `doc_id`* | String |
| `case_id`, `source_system`, `storage_uri`, `validated_by`, `ixp_model`, `ixp_model_version` | String |
| `doc_type` | `PI360DocType` choice |
| `extracted_fields` | Multiline text |
| `extraction_confidence` | Decimal |
| `validation_status` | `PI360ValidationStatus` choice |
| `reference_only` | Boolean |
| `patient_class`, `encounter_id`, `facility_name`, `care_area`, `encounter_disposition`, `note` | String |
| `encounter_arrival_at`, `encounter_discharge_at` | DateTime with timezone |

The Flow writes `<case_id>-SERVICE-EVIDENCE` for initial claim/timesheet evidence. The BPMN response path writes `<case_id>-HOSPITAL-RECORD` only after medical-record extraction, preventing intake metadata from masquerading as a returned provider record.

Hospital-evidence contract: BPMN passes the complete `Orchestrator.RunJob` response from `PI360 IXP Medical Record` as `documentInput` and the correlated provider message as `providerMessageInput`. `IntakeHospitalRecord` searches the nested job response for `out_AdmissionDate`, `out_DischargeDate`, `out_PatientClass`, `out_EncounterId`, `out_FacilityName`, `out_CareArea`, `out_ArrivalAt`, `out_DischargeAt`, `out_Disposition`, `out_StorageUri`, and `out_ExtractionConfidence`. Provider-message values are secondary fallbacks; document-specific demo defaults are used only when neither source supplies a field.

### PI360InvestigationAction

| Fields | Type |
|---|---|
| `action_id`* | String |
| `case_id`, `action_type`, `actor` | String |
| `actor_kind` | `PI360ActorKind` choice |
| `timestamp` | DateTime with timezone |
| `detail`, `before_value`, `after_value` | Multiline text |

This is the shared audit stream for provider-response intake and approved closure.

### PI360Decision

| Fields | Type |
|---|---|
| `decision_id`* | String |
| `case_id`, `decision_type`, `recommended_by`, `decided_by` | String |
| `decision_role` | `PI360DecisionRole` choice |
| `rationale` | Multiline text |
| `adverse_or_financial`, `approved` | Boolean |
| `decided_at` | DateTime with timezone |

Only the supervisor-approved closure path writes this entity.

## Logical relationship map

```text
PI360ProgramIntegrityCase (case_id)
├── PI360Claim.case_id
├── PI360RiskSignal.case_id
├── PI360EvidenceDocument.case_id
├── PI360InvestigationAction.case_id
└── PI360Decision.case_id

PI360Provider.provider_id
├── PI360ProgramIntegrityCase.provider_id
└── PI360Claim.provider_id

PI360Attendant.attendant_id
├── PI360ProgramIntegrityCase.attendant_id
├── PI360Claim.attendant_id
└── PI360EvvVisit.attendant_id
```

Member identity is intentionally denormalized across Case, Claim, and EVV because no standalone member entity is introduced at the tenant object cap.

## Scenario write matrix

| Entity | MedicaidPCS | StateMedicaidHospice |
|---|---|---|
| Case | Intake create; closure update | Intake create; closure update |
| Provider | Create or reuse | Create or reuse |
| Attendant | Create or reuse | Not written by the Flow branch |
| Claim | Create | Create aggregate header |
| EVV | Create | Not written |
| Risk Signal | PCS validation signal | Threshold/location-review signal |
| Evidence Document | Service/timesheet evidence | Initial service evidence plus later hospital record |
| Investigation Action | Closure audit | Hospital-response audit plus closure audit |
| Decision | Approved closure | Approved closure |

## Idempotency and safety

- Intake queries by `case_id` after a duplicate-create response and returns the existing Case.
- Provider and Attendant are stable master records; their Flow nodes merge create-success and already-existing paths.
- Case-scoped child natural keys prevent cross-case collisions.
- Closure requires `supervisorApproved = true`; the agent cannot directly create a final Decision.
- Data Fabric stores review evidence and human decisions. A time/location conflict remains an indicator, not an autonomous finding of fraud or intent.

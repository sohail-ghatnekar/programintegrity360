# Data Model — Program Integrity 360 (Data Fabric entities)

All entities live in **UiPath Data Fabric** (managed via `/uipath-platform`). Every write also appends an
`InvestigationAction` row so the case carries a complete, immutable audit trail. IDs, values, and examples
must match `CANON.md`.

Legend: 🔑 primary key · 🔗 foreign key · ⚙️ system/audit field.

---

## 1. ProgramIntegrityCase
The case aggregate root; drives the Maestro case lifecycle.

| Field | Type | Notes / example |
|---|---|---|
| 🔑 case_id | Text | `PI-PCS-2026-0041` |
| title | Text | Harbor Home Support Services — PCS billing integrity review |
| program | Choice | `Medicaid PCS` |
| trigger_type | Choice | `Claims Analytics Alert` |
| trigger_ref | Text | `ALERT-CA-2026-7781` |
| 🔗 provider_id | Text | `PRV-100482` |
| 🔗 attendant_id | Text | `ATT-2087` |
| service_period_start | Date | 2026-03-01 |
| service_period_end | Date | 2026-05-31 |
| priority | Choice | `High` / Medium / Low |
| stage | Choice | one of the 9 stages (see docs/02) |
| status | Choice | Open / In Review / Awaiting Provider / Pending Approval / Closed |
| risk_signal_count | Number | 5 |
| potential_exposure_low | Currency | 172.80 (reviewed 4-claim sample) |
| potential_exposure_period_estimate | Currency | 1600.00 (full 44-visit period projection) |
| potential_exposure_high | Currency | 42000.00 (provider-wide indicative, pending audit) |
| exposure_disclaimer | Text | "Indicative range, subject to human validation. Not a determination." |
| assigned_investigator | Text | e.g. `inv.taylor` |
| assigned_supervisor | Text | e.g. `sup.morgan` |
| sla_due | DateTime | intake SLA |
| ⚙️ created_at / updated_at | DateTime | |

## 2. Provider
| Field | Type | Example |
|---|---|---|
| 🔑 provider_id | Text | `PRV-100482` |
| name | Text | Harbor Home Support Services |
| medicaid_provider_id | Text | `MPI-4471902` |
| npi | Text | `1730456789` |
| address | Text | 2200 Marina Blvd, Suite 210 |
| enrollment_status | Choice | Active |
| active_attendant_count | Number | 22 |
| prior_integrity_history | Text | 1 education letter (2024), no sanctions |
| watch_list | Boolean | set true at closure |

## 3. Attendant
| Field | Type | Example |
|---|---|---|
| 🔑 attendant_id | Text | `ATT-2087` |
| name | Text | Jordan Ellis |
| 🔗 provider_id | Text | `PRV-100482` |
| role | Choice | Personal Care Attendant |
| credential_id | Text | `PCA-556210` |
| credential_expiry | Date | 2026-03-31 |
| personnel_docs_complete | Boolean | false |
| missing_docs | Text[] | ["Signed training acknowledgment","Current background-check attestation"] |

## 4. Claim
| Field | Type | Example |
|---|---|---|
| 🔑 claim_id | Text | `CLM-0491` |
| 🔗 case_id | Text | `PI-PCS-2026-0041` |
| 🔗 attendant_id | Text | `ATT-2087` |
| member_id | Text | `MBR-33915` |
| date_of_service | Date | 2026-04-14 |
| units_billed | Number | 24 |
| unit_rate | Currency | 7.20 |
| billed_amount | Currency | 172.80 |
| evv_supported_units | Number | 16 |
| timesheet_supported_units | Number | 16 |
| improper_units | Number | 8 (deterministic: billed − min(evv,timesheet)) |
| status | Choice | Under Review / Cleared / Flagged |

## 5. EVVVisit
| Field | Type | Example |
|---|---|---|
| 🔑 evv_id | Text | `EVV-88231` |
| 🔗 attendant_id | Text | `ATT-2087` |
| member_id | Text | `MBR-33915` |
| service_date | Date | 2026-04-14 |
| start_time | Text (HH:MM) | 08:00  *(Data Fabric has no native TIME type; stored as HH:MM string, consumed by the deterministic overlap calc)* |
| end_time | Text (HH:MM) | 12:00 |
| units | Number | 16 |
| capture_method | Choice | Mobile-GPS / Telephony / Manual |
| gps_confirmed | Choice | Yes / No / N/A |
| overlaps_with | Text | `EVV-88237` (set by RS-01 calc) |

## 6. RiskSignal
| Field | Type | Example |
|---|---|---|
| 🔑 signal_id | Text | `RS-01` |
| 🔗 case_id | Text | `PI-PCS-2026-0041` |
| name | Text | Overlapping visits |
| rule_expression | Text | the exact deterministic rule (auditable) |
| inputs | JSON | the records/values evaluated |
| result_value | Text | "1 overlap on 2026-04-14 (90 min)" |
| severity | Choice | High / Medium / Low |
| computed_by | Text | `deterministic-calc-v1` (never an agent) |
| computed_at | DateTime | |

## 7. EvidenceDocument
| Field | Type | Example |
|---|---|---|
| 🔑 doc_id | Text | `DOC-TS-0416` |
| 🔗 case_id | Text | `PI-PCS-2026-0041` |
| doc_type | Choice | Timesheet / Plan of Care / Service Note / Personnel Packet / Correspondence |
| source_system | Text | Provider portal / Legacy care-mgmt (RPA) / Records-request inbox |
| storage_uri | Text | bucket path |
| extracted_fields | JSON | IXP output |
| extraction_confidence | Number | 0.0–1.0 |
| validation_status | Choice | Auto-confirmed / Needs review / Human-validated |
| validated_by | Text | investigator id, if human-validated |

## 8. InvestigationAction  (the audit trail)
| Field | Type | Example |
|---|---|---|
| 🔑 action_id | Text | `ACT-...` |
| 🔗 case_id | Text | `PI-PCS-2026-0041` |
| action_type | Choice | Signal computed / Doc extracted / Human validated / Edit / Request sent / Response received / Approval / Action executed |
| actor | Text | user id, `system`, or agent name |
| actor_kind | Choice | Human / System / Agent |
| timestamp | DateTime | |
| detail | Text | human-readable description |
| before_value / after_value | JSON | for edits |

## 9. Decision
| Field | Type | Example |
|---|---|---|
| 🔑 decision_id | Text | `DEC-...` |
| 🔗 case_id | Text | `PI-PCS-2026-0041` |
| decision_type | Choice | Proceed to records request / Refer for audit / Open overpayment recovery / Provider education / Close-no-action |
| recommended_by | Text | Investigation Planning Agent (recommendation only) |
| decided_by | Text | supervisor id (the human who approves) |
| decision_role | Choice | Investigator / Supervisor |
| rationale | Text | narrative + citations |
| adverse_or_financial | Boolean | true → supervisor approval required |
| approved | Boolean | |
| decided_at | DateTime | |

---

## Relationships (summary)
- One **ProgramIntegrityCase** → one Provider, one Attendant, many Claims/EVVVisits/RiskSignals/EvidenceDocuments/InvestigationActions/Decisions.
- **Claim** ↔ **EVVVisit** matched on (attendant, member, date). Mismatch drives RS-04.
- **RiskSignal.computed_by** is always `deterministic-calc-v1` — agents never populate it.
- Every state change → one **InvestigationAction** (immutable append-only).

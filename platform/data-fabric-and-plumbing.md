# Program Integrity 360 platform state

This document records the live `uipathlabs/Playground` substrate for the Medicaid PCS and State Medicaid Hospice demo. All data is synthetic.

## Scope

- Folder: `AMER Presales/Public Sector/ProgramIntegrity360`
- Folder key: `5db31dd1-1073-4f9e-b44b-76f5484e03c4`
- Data Fabric scope: tenant
- Solution target: `ProgramIntegrity360` 0.6.0
- Rollback package: 0.5.1

Playground reports that its Data Fabric environment is at the 500-object cap. The C-light implementation therefore preserves and extends the nine existing PI360 entities. It creates no new entities or choice sets and performs no deletes or renames.

## Data Fabric

`CaseType` is stored as a string because a new choice set cannot be created at the tenant cap. The accepted application values remain `MedicaidPCS` and `StateMedicaidHospice`.

| Entity | Rows | C-light use |
|---|---:|---|
| `PI360ProgramIntegrityCase` | 2 | Shared case header, `case_type`, member identity, caregiver, threshold, claim total, stage and assignments |
| `PI360Provider` | 1 | Shared Medicaid provider |
| `PI360Attendant` | 2 | Jordan Ellis for PCS; Taylor Brooks for hospice |
| `PI360Claim` | 10 | Nine PCS claims plus one hospice claim header with the three claim lines serialized in `claim_lines_json` |
| `PI360EvvVisit` | 12 | PCS EVV evidence |
| `PI360RiskSignal` | 6 | Five PCS signals plus the hospice location/time conflict indicator |
| `PI360EvidenceDocument` | 9 | Six PCS documents plus hospice timesheet, hospital record, and policy reference |
| `PI360InvestigationAction` | 15 | Shared audit stream |
| `PI360Decision` | 2 | Existing investigator and supervisor decisions |

Total: 59 records.

The hospice claim row retains the exact claim identity and totals: `CLM-HSP-2026-0714-001`, 52 units, and $3,250. `claim_lines_json` retains all three source lines. The normalized review line is `LINE-0714-01`, place of service 12, 09:00–15:00 on July 14.

The hospital evidence row retains `patient_class = Observation`, encounter `ENC-SYN-20260714-JE`, arrival `2026-07-14T08:20:00-05:00`, and discharge `2026-07-16T10:00:00-05:00`. These fields support a review indicator; they do not make an autonomous fraud, coverage, payment, or intent determination.

`PI360DocType` was extended with `Hospital Record`, `Policy Reference`, and `Hospice Service Record`.

## Storage buckets

| Bucket | Key | Paths |
|---|---|---|
| Timesheets | `ee5b39e1-60de-4ddd-92c3-3bc05d0d74c4` | `pcs/PI-PCS-2026-0041/incoming/`, `pcs/PI-PCS-2026-0041/provider-response/`, `hospice/PI-HSP-2026-0042/incoming/` |
| Hospital Records | `72623e80-55ba-4cfc-abd1-343af54beae0` | `hospice/PI-HSP-2026-0042/provider-response/` |
| Policy Docs | `27f97497-c423-4204-9a4e-f95bdb37f099` | `pcs/PI-PCS-2026-0041/incoming/`, `reference/policy/` |

The live layout contains the six generated PCS PDFs and the three supplied hospice/reference PDFs. Fresh list operations verified each path, content type, and file size.

## IXP

| Extractor | Project | ID | Live model |
|---|---|---|---:|
| PI360 Service Evidence Extractor | `pi360_timesheets-46b073f4-ixp` | `db86ac99-70f8-80e1-9c2e-42e09362d0cb` | 12 |
| PI360 Institutional Encounter Extractor | `pi360-institutional-encounter-extractor-53d63c92-ixp` | `3d9b9c8e-4ac3-80a9-9529-89a013670910` | 9 |

Both models are pinned, published, and tagged `live`. The current authenticated Maestro registry does not expose either project as a selectable IXP node, so the Flow contains clearly labeled swap-ready mocks with the real project/model metadata in grounded context.

## Idempotent maintenance

Run only after reviewing the exact tenant diff:

```bash
node platform/01_choicesets.js
node platform/02_entities.js
node platform/03_seed.js
```

The scripts add missing document-type values and fields, then query by natural key before updating or inserting. Reruns preserve entity IDs and do not duplicate rows.

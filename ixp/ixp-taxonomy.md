# PI360 IXP Extraction Design

Program Integrity 360 uses two IXP document-extraction projects. IXP returns source facts and confidence; deterministic rules perform comparisons and arithmetic; people make investigative, coverage, payment, and fraud determinations.

## Projects

| Display title | UiPath project name | Purpose | Model configuration |
|---|---|---|---|
| PI360 Service Evidence Extractor | `pi360_timesheets-46b073f4-ixp` | Medicaid PCS and hospice timesheets, plans of care, service notes, personnel packets, and provider correspondence | `gemini_2_5_flash`, `table_mini` |
| PI360 Institutional Encounter Extractor | `pi360-institutional-encounter-extractor-53d63c92-ixp` | Synthetic hospital and institutional encounter records | `gemini_2_5_flash`, `table_mini` |

The confidence threshold is `0.85`. Predictions below that threshold route to human validation. Personnel packets and provider correspondence are sensitive and always route to human validation regardless of score.

## Service Evidence Extractor

### Caregiver Monthly Timesheet

- Member and caregiver names
- Document, case, provider, member, and attendant identifiers when present
- Admission and discharge dates
- Hospitalization checkboxes
- EVV exception text
- Signature names and dates
- Total units
- Repeatable daily entries: date, first and second shift time-in/time-out, and daily units

For the hospice case, the model must return the July 14 entry as `09:00` to `15:00`, `24` units, and preserve the printed hospitalization facts. For the PCS case, `DOC-TS-0416` includes a handwritten-style `12:00` time-out and is routed to validation.

### Plan of Care

- Member ID
- Authorization ID
- Authorized units per day and week
- Service
- Effective and expiration dates

### Service Note

- Member ID
- Date of service
- Attendant ID
- Narrative
- Documented end time

### Personnel Packet

- Attendant name and ID
- Credential ID and expiration date
- Training acknowledgment present
- Background-check attestation present

### Correspondence

- Sender
- Received date
- Case ID
- Summary grounded only in the document
- Attachment count

## Institutional Encounter Extractor

### Medical Record

- Member identity
- Date of birth
- Medical record number
- Encounter identifier
- Facility
- Patient class
- Arrival date and time
- Discharge date and time
- Disposition

The patient class must be extracted verbatim. For Jordan Ellis, the value is `Observation`. The model and downstream agents must never restate it as `Inpatient`.

## Reference-only policy document

`03_personal_care_services_policy.pdf` is agent grounding in the Policy Docs storage bucket. It is not transactional extraction evidence and is not uploaded to either IXP project. Its inpatient restriction must not be applied as though an observation encounter were inpatient.

## Review contract

- IXP extracts document facts and source locations.
- Deterministic code computes time intersections, unsupported units, and thresholds.
- A location/time conflict is a review indicator, not an autonomous determination.
- Field corrections are used only for OCR garble. Wrong predictions remain unconfirmed and prompts are improved.
- Models are published only after predictions have been reviewed against the unchanged source documents.

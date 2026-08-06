# IXP Taxonomy & Extraction Design — Program Integrity 360

> Authoring skill: **`/uipath-ixp`** (Document Understanding / IXP project — taxonomy, fields, data
> types, per-field extraction instructions, confidence, model publishing).
> Routing partner: **`/uipath-human-in-the-loop`** (validation tasks for low-confidence / sensitive docs).
>
> **Positioning.** IXP **produces facts** — it reads what a document says (a time-out of `12:00`, a
> credential expiry of `2026-03-31`) with a confidence score. It does **not** compute overages,
> unsupported units, or any risk signal, and it makes **no** determination. Extraction facts flow to
> `deterministic-calc-v1`, which does the arithmetic (e.g. RS-04). **All documents are synthetic.**

Project (mock): `program_integrity_360-ixp`. Five document types (CANON §6). Built-in data types are
reused wherever possible (`/uipath-ixp` Rule 17): **Exact Text, Inferred Text, Number, Date, Monetary
Quantity, Boolean**. No hand-rolled clones.

---

## Confidence thresholds & routing

| Rule | Behavior |
|---|---|
| Per-field / document confidence **≥ 0.85** | **Auto-confirm** the prediction (`validation_status = Auto-confirmed`). |
| Confidence **< 0.85** | **Route to human validation** via `/uipath-human-in-the-loop` (`validation_status = Needs review` → `Human-validated` after a person confirms). |
| Any **adverse or sensitive** doc type (Personnel Packet, Correspondence) | **Always human-reviewed** regardless of score — a policy gate on top of the confidence gate. |

> On-screen this is stated plainly: "IXP suggests; a person confirms anything below 0.85 or anything
> that feeds an adverse action." Confirmation goes through `labellings confirm --fields` field-by-field
> (`/uipath-ixp` Rules 8/11) — a human validates predictions; IXP never blind-confirms, and a wrong
> value is left unannotated / prompt-improved rather than hand-edited.

---

## Taxonomy by document type

### 1. Timesheet  (field group: `Timesheet`)
| Field | Data type | Per-field extraction instruction |
|---|---|---|
| attendant | Inferred Text | Name of the personal care attendant who signed the sheet. |
| member | Exact Text | Member ID in `MBR-#####` form. |
| date | Date | Date of service (single day). |
| time_in | Exact Text | Clock-in time, 24h `HH:MM`. Handwritten — read carefully. |
| time_out | Exact Text | Clock-out time, 24h `HH:MM`. **Handwritten — often the lowest-confidence field.** |
| supported_units | Number | Units supported by the recorded in/out span (15 min = 1 unit). Read the printed/derived value; do not recompute. |

### 2. Plan of Care  (field group: `PlanOfCare`)
| Field | Data type | Per-field extraction instruction |
|---|---|---|
| member | Exact Text | Member ID the plan authorizes. |
| authorized_units_per_day | Number | Daily authorized PCS units. |
| authorized_units_per_week | Number | Weekly authorized PCS units. |
| service | Inferred Text | Authorized service name (e.g. "Personal Care"). |
| effective | Date | Authorization start date. |
| expires | Date | Authorization end date. |

### 3. Service Note  (field group: `ServiceNote`)
| Field | Data type | Per-field extraction instruction |
|---|---|---|
| member | Exact Text | Member ID the note concerns. |
| date | Date | Date the service was rendered. |
| narrative | Inferred Text | Free-text description of the visit as written. |
| documented_end | Exact Text | End time the narrative documents, `HH:MM`, if stated. |

### 4. Personnel Packet  (field group: `PersonnelPacket`)  — *always human-reviewed*
| Field | Data type | Per-field extraction instruction |
|---|---|---|
| attendant | Inferred Text | Attendant the packet belongs to. |
| credential_id | Exact Text | Certification ID in `PCA-######` form. |
| credential_expiry | Date | Certification expiry date. |
| training_ack_present | Boolean | True only if a signed training acknowledgment is present. |
| background_check_attestation_present | Boolean | True only if a current background-check attestation is present. |

### 5. Correspondence  (field group: `Correspondence`)  — *always human-reviewed*
| Field | Data type | Per-field extraction instruction |
|---|---|---|
| from | Inferred Text | Sender / provider organization name. |
| received | Date | Date the correspondence was received. |
| summary | Inferred Text | One- to two-sentence summary of the provider's statement. |
| attachments | Number | Count of attachments included. |

---

## Extracted values for the 6 documents (`data/evidence_documents.json`)

| Doc ID | Type | Confidence | Extracted values (verbatim) | Routing / status |
|---|---|---|---|---|
| **DOC-TS-0416** | Timesheet | **0.71** | attendant=Jordan Ellis, member=MBR-33915, date=2026-04-16, time_in=08:00, time_out=12:00, supported_units=16 | **< 0.85 → human review**; investigator confirmed handwritten time_out=12:00 → **Human-validated** (`inv.taylor`) |
| DOC-TS-0519 | Timesheet | 0.88 | attendant=Jordan Ellis, member=MBR-33915, date=2026-05-19, time_in=08:00, time_out=13:00, supported_units=20 | ≥ 0.85 → **Auto-confirmed** |
| DOC-POC-33915 | Plan of Care | 0.94 | member=MBR-33915, authorized_units_per_day=20, authorized_units_per_week=80, service=Personal Care, effective=2026-01-01, expires=2026-12-31 | ≥ 0.85 → **Auto-confirmed** |
| **DOC-SN-0414** | Service Note | **0.83** | member=MBR-33915, date=2026-04-14, narrative="Assisted with morning bathing and breakfast; left at noon.", documented_end=12:00 | **< 0.85 → human review** → currently **Needs review** (pending validation) |
| DOC-PP-2087 | Personnel Packet | 0.90 | attendant=Jordan Ellis, credential_id=PCA-556210, credential_expiry=2026-03-31, training_ack_present=false, background_check_attestation_present=false | ≥ 0.85 but **sensitive doc → Human-validated** (`inv.taylor`) |
| DOC-CORR-01 | Correspondence | 0.86 | from=Harbor Home Support Services, received=2026-07-28, summary="Provider states 04-16 visit extended to 14:00 due to member need; acknowledges cert renewal in progress.", attachments=1 | ≥ 0.85 but **sensitive doc → Human-validated** (`inv.taylor`) |

**Routed to human review by the confidence gate:** **DOC-TS-0416 (0.71)** and **DOC-SN-0414 (0.83)** —
the two below 0.85. (DOC-PP-2087 and DOC-CORR-01 also show `Human-validated`, but by the *sensitive-doc
policy gate*, not the confidence gate — both score above 0.85. This distinction is worth calling out in
the demo so the two routing reasons stay clear.)

---

## Extraction facts → deterministic RS-04 (extraction produces facts, code does the math)

RS-04 = *unsupported units*: `improper_units = units_billed − min(evv_supported_units,
timesheet_supported_units)`, flagged when `> 0`. IXP's only role is to establish
`timesheet_supported_units` from the scanned timesheet — it hands over a **fact**, not a calculation.

| Step | Owner | Value |
|---|---|---|
| Read timesheet time_in/time_out and supported_units | **IXP (fact)** | DOC-TS-0416 → 08:00–12:00, **16 units** (confidence 0.71 → human-confirmed) |
| Provide claim billed / EVV-supported units | claims + EVV pulls | CLM-0503: billed **24**, EVV-supported **24** |
| Compute `min(evv, timesheet)` and `improper` | **`deterministic-calc-v1` (math)** | `24 − min(24, 16) = 24 − 16 = ` **8 improper units** |

Same pattern for **DOC-TS-0519 → CLM-0540**: IXP reads 08:00–13:00 = **20 units** (0.88, auto-confirmed);
the calc computes `24 − min(24, 20) =` **4 improper units**. Across the flagged claims (CLM-0491 8,
CLM-0503 8, CLM-0540 4, CLM-0549 4) the calc totals **24 de-duplicated unsupported units** (CANON §3/§4).

> The agents (Evidence Correlation, Summary) *cite* these extracted fields and deterministic results by
> ID — they never re-extract or re-add them (CANON §8). IXP = facts; code = arithmetic; humans = the
> validation on anything below 0.85 or anything adverse.

---

## Model lifecycle (`/uipath-ixp`)

Author the taxonomy (field groups + fields + per-field instructions above) → upload the 6 sample docs →
review predictions field-by-field, confirming correct fields and improving prompts where confidence is
low (the handwritten `time_out` on timesheets is the field to tune) → `get-metrics` → publish/tag the
model version. Deployment to an Orchestrator folder (which makes the model available to the Maestro Flow
IXP node) is a product-side step, done in-product — not part of this skill.

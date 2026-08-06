# Human-in-the-Loop — Program Integrity 360

> Authored per the `/uipath-human-in-the-loop` design pattern. **Spec artifact on disk** — no `uip`
> CLI, login, publish, or deploy is invoked.
>
> **Demo / synthetic data.** All IDs, dates, and numbers match `CANON.md`; if anything disagrees,
> CANON wins.
>
> **Case modeled:** `PI-PCS-2026-0041` — Harbor Home Support Services · Attendant `ATT-2087` (Jordan Ellis)
> **People:** investigator `inv.taylor` · supervisor `sup.morgan`

---

## 0. Design principles (apply to every task)

Every human gate is an **Action Center task** created from the Maestro case flow and **rendered inside
the "Program Integrity 360" coded app** (screens: **Evidence Studio**, **Decision Center**,
**Task List & SLA widgets**). The coded app calls Action Center to create, assign, poll, and complete
tasks; the human never leaves the app.

Non-negotiable rules, aligned to the agent hard constraints:

1. **Agents recommend; humans decide.** No agent output advances the case on its own. A `Decision` row is
   written **only** by a human completing a task.
2. **Deterministic values are read-only to humans in the arithmetic sense.** A human may *validate*,
   *reclassify* (fact → informational), or *dispute* a signal, but the case never asks a human to
   recompute a figure — the numbers come from `deterministic-calc-v1`.
3. **Every task completion appends an immutable `InvestigationAction` row** (append-only audit trail).
4. **Adverse or financial actions REQUIRE supervisor approval.** Any `Decision` with
   `adverse_or_financial = true` (audit referral, overpayment recovery, sanction) can be completed only
   by the **Stage-7 supervisor gate** (`sup.morgan`). The investigator gate can authorize only
   non-adverse steps (e.g., a records request).
5. **Never "fraud determination."** Task labels/forms use "risk signal", "validate", "unsupported units",
   "audit referral", "overpayment recovery".

Task-type vocabulary used below (Action Center): **Document Validation** (IXP/Action App with document
preview), **Form / Task-form action** (structured review with typed outcomes), **Approval** (approve/reject
gate).

---

## A. IXP Document Validation task — Stage 3

**Purpose:** Route low-confidence document extractions, and always-sensitive documents, to a human before
any downstream correlation trusts them.

- **Task type:** Document Validation (IXP validation station embedded in **Evidence Studio**; document
  preview + extracted-field editor).
- **Assigned to:** `inv.taylor` (Investigator). Group fallback: OPI Investigator queue.
- **Trigger / which documents:**
  - **Low-confidence (< 0.85):** `DOC-TS-0416` (timesheet, confidence 0.71, `Needs review`) and
    `DOC-SN-0414` (service note, confidence 0.83, `Needs review`).
  - **Always-review sensitive (regardless of confidence):** `DOC-PP-2087` (personnel packet) and
    `DOC-CORR-01` (provider correspondence). These are always human-validated even when confidence is
    high (`DOC-PP-2087` = 0.90; `DOC-CORR-01` = 0.86) because they carry personnel/PII and legal weight.
  - Auto-confirmed and *not* routed unless sensitive: `DOC-TS-0519` (0.88), `DOC-POC-33915` (0.94).
- **Form fields (per document):**
  - Read-only: `doc_id`, `doc_type`, `source_system`, `extraction_confidence`, document preview (from
    `storage_uri`).
  - Editable extracted fields, e.g. for `DOC-TS-0416`: `time_in`, `time_out`, `supported_units`
    (the handwritten `time_out` is the low-confidence field — confirm `12:00`).
  - `validation_decision` (choice): **Confirm as extracted** / **Correct field(s)** / **Mark field missing**
    / **Reject document**.
  - `validated_by` (auto = current user), `reviewer_note` (free text).
- **Outcomes / routes:**
  - Confirm/Correct → set `validation_status = Human-validated`, `validated_by = inv.taylor`; document
    becomes trusted input for the Evidence Correlation Agent.
  - Mark field missing → field flagged; correlation treats it as unsupported.
  - Reject document → route to **Exception Handling task (§C)** for re-acquisition.
- **SLA:** 2 business days (Stage 3 human-validation window). Breach → escalate to OPI Investigator queue.
- **Audit row written (example — `DOC-TS-0416`):**
  ```json
  {
    "action_id": "ACT-0005",
    "case_id": "PI-PCS-2026-0041",
    "action_type": "Human validated",
    "actor": "inv.taylor",
    "actor_kind": "Human",
    "timestamp": "2026-07-23T09:05:00Z",
    "detail": "Validated timesheet DOC-TS-0416 time_out = 12:00 (was low confidence).",
    "before_value": { "time_out": "12:0?" },
    "after_value": { "time_out": "12:00" }
  }
  ```
  One `Human validated` row is written per validated document (`DOC-SN-0414`, `DOC-PP-2087`,
  `DOC-CORR-01` each write their own).

---

## B. Investigator Review task — Stage 5  **[HUMAN GATE — investigator]**

**Purpose:** The investigator validates the deterministic signals, edits the agent-drafted narrative, and
decides whether to proceed. This gate can authorize **only non-adverse** steps.

- **Task type:** Form / Task-form action, rendered in **Decision Center**.
- **Assigned to:** `inv.taylor` (Investigator).
- **Prerequisites shown:** Evidence Correlation Agent clusters, Investigation Planning Agent
  recommendation, Summary Agent **v1** narrative (FACT/INFERENCE labeled).
- **Form fields:**
  - **Validate signals** — for each of `RS-01`..`RS-05`: `signal_disposition` (choice) =
    **Validated** / **Reclassify to informational** / **Dispute (send to exception)** + optional note.
    (Values are read-only; the human validates meaning, not arithmetic.)
  - **Edit narrative** — editable copy of the Summary Agent v1 draft; `before_value`/`after_value`
    captured on save. Example on this case: reclassify the `CLM-0475` manual-EVV flag as **informational,
    not improper**.
  - **Stage-5 decision** — `decision_type` (choice) constrained to **non-adverse** options:
    **Proceed to records request** (default) / **Request more evidence** / **Route to exception**.
    `adverse_or_financial` is **locked to `false`** on this form; adverse/financial options are greyed out
    with the message "Requires supervisor approval (Stage 7)."
  - `rationale` (free text, citations required), `decided_by` (auto = `inv.taylor`).
- **Outcomes / routes:**
  - **Proceed to records request** → writes `Decision` `DEC-0001` (`decision_role = Investigator`,
    `adverse_or_financial = false`, `approved = true`); case advances to **Stage 6** (records request +
    wait state).
  - Request more evidence → loop back to Stage 3.
  - Route to exception → **Exception Handling task (§C)**.
- **SLA:** 3 business days (Stage 5). Breach → reassign within OPI Investigator queue; notify supervisor.
- **Audit rows written:**
  ```json
  [
    {
      "action_id": "ACT-0008",
      "case_id": "PI-PCS-2026-0041",
      "action_type": "Edit",
      "actor": "inv.taylor",
      "actor_kind": "Human",
      "timestamp": "2026-07-24T11:10:00Z",
      "detail": "Investigator edited summary narrative; reclassified CLM-0475 method flag as informational, not improper.",
      "before_value": { "CLM-0475": "flag" },
      "after_value": { "CLM-0475": "informational" }
    },
    {
      "action_id": "ACT-0009",
      "case_id": "PI-PCS-2026-0041",
      "action_type": "Decision",
      "actor": "inv.taylor",
      "actor_kind": "Human",
      "timestamp": "2026-07-24T11:20:00Z",
      "detail": "Investigator decision: proceed to provider records request.",
      "before_value": null,
      "after_value": { "decision_id": "DEC-0001" }
    }
  ]
  ```

---

## C. Exception Handling task

**Purpose:** Catch anything that cannot proceed on the happy path — a rejected/failed extraction, a
disputed signal, a data-quality gap, or a **Stage-6 wait-timer expiry** (provider does not respond within
the 15-calendar-day window).

- **Task type:** Form / Task-form action, rendered in **Task List & SLA widgets** / **Provider Response
  Tracking**.
- **Assigned to:** `inv.taylor` (Investigator) first; may escalate to `sup.morgan` (Supervisor) for
  policy calls. Group fallback: OPI Investigator queue.
- **Trigger sources:**
  - Rejected/failed IXP extraction from §A (e.g., illegible document).
  - Signal disputed at §B.
  - **Provider non-response** — Stage-6 wait timer expires with no `DOC-CORR-01`.
- **Form fields:** `exception_type` (choice: Extraction failure / Signal dispute / Missing evidence /
  Provider non-response / Other), `affected_ids` (doc/signal/claim IDs), `resolution` (choice: Re-acquire
  document / Re-run extraction / Override with note / Escalate to supervisor / Proceed without item),
  `resolution_note` (required), `assignee_override`.
- **Outcomes / routes:**
  - Re-acquire / Re-run → back to Stage 3.
  - Provider non-response → escalate; supervisor may proceed to Stage 7 on the record as it stands.
  - Escalate to supervisor → hand off to §D.
- **SLA:** 1 business day to acknowledge; resolution target 2 business days.
- **Audit row written (example):**
  ```json
  {
    "action_id": "ACT-00E1",
    "case_id": "PI-PCS-2026-0041",
    "action_type": "Edit",
    "actor": "inv.taylor",
    "actor_kind": "Human",
    "timestamp": "2026-07-28T15:00:00Z",
    "detail": "Exception handled: provider response DOC-CORR-01 arrived before wait-timer expiry; no escalation needed.",
    "before_value": { "exception_type": "Provider non-response (pending)" },
    "after_value": { "resolution": "Response received; correlation re-run" }
  }
  ```
  *(Illustrative `action_id`; the runtime assigns the next sequential `ACT-...`. On this demo path the
  provider responded in time, so the exception self-cleared.)*

---

## D. Supervisor Approval task — Stage 7  **[HUMAN GATE — supervisor, adverse/financial]**

**Purpose:** The **only** gate that can authorize an adverse or financial action. The supervisor reviews
the post-response record and approves or rejects the disposition.

- **Task type:** Approval (approve/reject), rendered in **Decision Center** (gated view).
- **Assigned to:** `sup.morgan` (Supervisor). **Cannot** be completed by an investigator.
- **Prerequisites shown:** Summary Agent **v2** narrative (post `DOC-CORR-01`), the standing signals
  (`RS-01`, `RS-03`, `RS-04` High; `RS-05` Medium), the 24 de-duplicated unsupported units, and the
  exposure block with disclaimer.
- **Form fields:**
  - Read-only summary: 24 unsupported units across `CLM-0491`, `CLM-0503`, `CLM-0540`, `CLM-0549`;
    provider explanation (`DOC-CORR-01`) noted as **not reconciling** the 04-16 timesheet/EVV mismatch.
  - Exposure (read-only, deterministic): sample **$172.80** (24 units × $7.20), reviewed-period
    **≈ $1,600**, provider-wide indicative **$18,000 – $42,000** (pending audit) + disclaimer
    "Indicative range, subject to human validation. Not a determination or a demand."
  - `decision_type` (choice, adverse/financial enabled here): **Refer for audit + open overpayment
    recovery** (`DEC-0002`) / **Provider education** / **Close-no-action**.
  - `approval` (choice): **Approve** / **Reject**.
  - `rationale` (required, citations), `decided_by` (auto = `sup.morgan`).
- **Outcomes / routes:**
  - **Approve "Refer for audit + open overpayment recovery"** → writes `Decision` `DEC-0002`
    (`decision_role = Supervisor`, `adverse_or_financial = true`, `approved = true`); case advances to
    **Stage 8** (referral packet + recovery opened for the confirmed unsupported units).
  - Reject → route to **Stage 9** `Close-no-action`.
- **SLA:** 2 business days (Stage 7). Breach → notify OPI supervisor lead; case holds (no auto-approval —
  adverse action can never be auto-completed).
- **Audit row written:**
  ```json
  {
    "action_id": "ACT-0013",
    "case_id": "PI-PCS-2026-0041",
    "action_type": "Approval",
    "actor": "sup.morgan",
    "actor_kind": "Human",
    "timestamp": "2026-07-29T13:50:00Z",
    "detail": "Supervisor approved disposition: refer for audit + open overpayment recovery for confirmed unsupported units.",
    "before_value": { "status": "Pending Approval" },
    "after_value": { "decision_id": "DEC-0002", "approved": true }
  }
  ```
  The `DEC-0002` record (`adverse_or_financial = true`, `decided_by = sup.morgan`) is the canonical
  disposition; downstream execution (`ACT-0014`) runs only what this approval authorized. **This is a
  program-integrity referral and recovery action, NOT a fraud determination.**

---

## E. Gate summary

| Task | Stage | Type | Assignee | Adverse/financial? | Decision written | Audit row(s) |
|---|---|---|---|---|---|---|
| A. IXP Document Validation | 3 | Document Validation | `inv.taylor` | No | — (sets `validation_status`) | `Human validated` (e.g. `ACT-0005`) |
| B. Investigator Review | 5 | Form action | `inv.taylor` | **No (locked false)** | `DEC-0001` (Proceed to records request) | `Edit` `ACT-0008`, `Decision` `ACT-0009` |
| C. Exception Handling | any | Form action | `inv.taylor` → `sup.morgan` | No (routes only) | — | `Edit` (next `ACT-...`) |
| D. Supervisor Approval | 7 | Approval | `sup.morgan` | **Yes (required)** | `DEC-0002` (Refer for audit + open overpayment recovery) | `Approval` `ACT-0013` |

**Bottom line:** the investigator gate (B) can move the case forward only with **non-adverse** steps; any
**adverse or financial action requires the supervisor approval gate (D)**. Every completion appends an
immutable `InvestigationAction`, and no agent ever completes a task on a human's behalf.

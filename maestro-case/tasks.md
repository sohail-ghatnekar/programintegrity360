# Case Plan Task Breakdown — PI-PCS (Program Integrity 360)

> Authored per the `/uipath-maestro-case` workflow: this `tasks.md` is the case-plan
> breakdown produced **before** `caseplan.json` is written. It is a **demo/synthetic**
> artifact — no real person, provider, or claim.
>
> **Case type:** `PI-PCS` (Medicaid PCS billing integrity review)
> **Modeled instance:** `PI-PCS-2026-0041` — Harbor Home Support Services
> **Provider:** `PRV-100482` · **Attendant under review:** `ATT-2087` (Jordan Ellis)
> **Investigator assignee:** `inv.taylor` · **Supervisor assignee:** `sup.morgan`
> **Service period under review:** 2026-03-01 → 2026-05-31
> **Timeline anchors:** alert `ALERT-CA-2026-7781` 2026-07-20 · case opened 2026-07-22 · demo "now" 2026-07-29

## Positioning discipline (applies to every stage)

- The case plan **identifies risk signals, organizes evidence, and routes decisions to humans.**
  It never issues a fraud determination.
- **All arithmetic is deterministic** (`deterministic-calc-v1`) — overlaps, unit overages,
  unsupported units, exposure math. Agents explain and organize only; they never compute.
- **Adverse or financial actions require supervisor approval** (Stage 7 human gate).
- Every task appends an `InvestigationAction` row → immutable audit trail.

---

## Stage 1 — Alert intake & triage

- **Purpose:** Convert the claims-analytics alert into an open case and explain (not decide) its priority.
- **Trigger / entry:** Inbound claims-analytics alert `ALERT-CA-2026-7781` (batch anomaly model), alert date 2026-07-20.
- **Automations invoked:**
  - `intake-alert` — **`/uipath-api-workflow`** ingests the alert payload, creates the
    `ProgramIntegrityCase` record (`PI-PCS-2026-0041`, status `Open`, priority `High`), seeds parties
    (`PRV-100482`, `ATT-2087`), and writes the opening `InvestigationAction`.
  - **Triage Agent** via **`/uipath-agents`** — explains why the case is prioritized **High**, citing the
    deterministic signal summary. No re-scoring; cites signals only.
- **Human tasks:** none (automated intake). Triage rationale is presented for later human context.
- **Exit gate:** Case record created; priority set to `High`; triage rationale attached and grounded.
- **SLA:** intake within 4 business hours of alert receipt (`sla_due` seeded on the case).

## Stage 2 — Automated evidence collection  *(automation task)*

- **Purpose:** Pull all source evidence into Data Fabric + storage buckets, then run the deterministic
  risk-signal and exposure calculations.
- **Trigger / entry:** Stage 1 exit (case opened).
- **Automations invoked:**
  - **`evidence-collection.bpmn`** via **`/uipath-maestro-bpmn`** — orchestrates:
    - claims pull (**`/uipath-api-workflow`**) → `Claim` entities
    - EVV + Plan of Care pull from legacy care-mgmt system (**`/uipath-rpa`**) → `EVVVisit`, POC docs
    - document intake to buckets → `EvidenceDocument` rows
    - deterministic risk-signal calc **RS-01..RS-05** and exposure math (`deterministic-calc-v1`)
- **Human tasks:** none.
- **Exit gate:** All source records landed in Data Fabric; `RS-01..RS-05` written to `RiskSignal`
  (`risk_signal_count = 5`); exposure fields populated ($172.80 low → $42,000 high).
- **SLA:** 1 business day.

## Stage 3 — Document extraction & validation

- **Purpose:** Extract fields from timesheets, POC, service notes, and personnel packet; route
  low-confidence extractions to a human.
- **Trigger / entry:** Stage 2 exit (documents landed in buckets).
- **Automations invoked:**
  - IXP extraction via **`/uipath-ixp`** — timesheets (`DOC-TS-0416`, `DOC-TS-0519`), Plan of Care
    (`DOC-POC-33915`), service note (`DOC-SN-0414`), personnel packet (`DOC-PP-2087`).
- **Human tasks:** **Validation task** (`/uipath-human-in-the-loop`) — investigator confirms
  low-confidence / needs-review extractions; sets `validation_status = Human-validated`.
- **Exit gate:** All evidence docs at `Auto-confirmed` or `Human-validated`.
- **SLA:** 2 business days (human validation portion).

## Stage 4 — Evidence correlation & investigation planning

- **Purpose:** Group deterministic findings, explain conflicts, and recommend next steps — no arithmetic.
- **Trigger / entry:** Stage 3 exit (extractions validated).
- **Automations invoked:**
  - **Evidence Correlation Agent** (`/uipath-agents`) — groups findings, explains the 2026-04-14 overlap
    and the timesheet/EVV mismatches; references deterministic values **by ID** (RS-01..RS-05).
  - **Investigation Planning Agent** (`/uipath-agents`) — recommends next steps (e.g., proceed to records
    request); recommends only, flags every human gate.
- **Human tasks:** none (agent outputs staged for Stage 5 review).
- **Exit gate:** Correlated findings + planning recommendation attached; FACT vs INFERENCE labeled.
- **SLA:** 4 business hours.

## Stage 5 — Investigator human review  **[HUMAN GATE — investigator]**

- **Purpose:** Investigator validates the deterministic signals, edits the narrative, and decides whether
  to proceed.
- **Trigger / entry:** Stage 4 exit (correlation + plan ready).
- **Automations invoked:** Decision Center screen served via **`/uipath-coded-apps`**; narrative drafted by
  **Summary Agent** (`/uipath-agents`, FACT/INFERENCE labeling, citations mandatory).
- **Human tasks:** **Investigator review task** (`/uipath-human-in-the-loop`, assignee `inv.taylor`) —
  validate RS-01..RS-05, edit narrative, record a `Decision` (`decision_role = Investigator`,
  e.g. `Proceed to records request`). This is a **recommendation**, not an adverse action.
- **Exit gate:** Investigator submits decision to proceed; `Decision` row written.
- **SLA:** 3 business days.

## Stage 6 — Provider records request & wait state  **[WAIT STATE]**

- **Purpose:** Send the outbound provider records request, then **wait** for the provider response and
  reprocess it on arrival.
- **Trigger / entry:** Stage 5 exit (investigator elected to proceed).
- **Automations invoked:**
  - **`records-request.bpmn`** via **`/uipath-maestro-bpmn`** — assembles + sends the request
    (**`/uipath-api-workflow`**), sets the **wait/receive state**, intakes the response (`DOC-CORR-01`),
    and re-runs correlation.
  - Case status set to `Awaiting Provider` by **`/uipath-maestro-case`**.
- **Human tasks:** none while waiting.
- **Wait state:** case pauses on a receive/message event for the provider response (`DOC-CORR-01`)
  arriving in the records-request inbox. Timer boundary for escalation.
- **Exit gate:** Response received and reprocessed (correlation re-run); or wait timer expires → escalate.
- **SLA:** wait window 15 calendar days; escalation on timer expiry.

## Stage 7 — Supervisor approval / disposition  **[HUMAN GATE — supervisor]**

- **Purpose:** Supervisor approves (or rejects) the adverse/financial disposition.
- **Trigger / entry:** Stage 6 exit (provider response reprocessed).
- **Automations invoked:** Decision Center (gated) via **`/uipath-coded-apps`**; Summary Agent narrative
  refreshed with post-response facts.
- **Human tasks:** **Supervisor approval task** (`/uipath-human-in-the-loop`, assignee `sup.morgan`) —
  review the disposition where `adverse_or_financial = true`; approve or reject. Records a `Decision`
  (`decision_role = Supervisor`, `approved = true/false`).
- **Exit gate:** Supervisor `approved = true` → Stage 8; `approved = false` → route to Stage 9
  (`Close-no-action`).
- **SLA:** 2 business days.

## Stage 8 — Approved action execution  *(automation task)*

- **Purpose:** Execute the supervisor-approved actions.
- **Trigger / entry:** Stage 7 approval (`approved = true`).
- **Automations invoked:**
  - **`referral-packet.bpmn`** via **`/uipath-maestro-bpmn`** — generates the referral packet, opens an
    overpayment recovery record for the **24 confirmed unsupported units**
    (`/uipath-api-workflow`, `/uipath-rpa` for legacy write-back), and queues the provider notice.
- **Human tasks:** none (executes only what the supervisor approved).
- **Exit gate:** Referral packet generated; recovery record opened (24 units × $7.20 = $172.80 sample
  basis); provider notice queued.
- **SLA:** 1 business day.

## Stage 9 — Closure & monitoring  *(automation task)*

- **Purpose:** Close the case, write the final audit record, add the provider to monitoring, emit metrics.
- **Trigger / entry:** Stage 8 exit (or Stage 7 rejection → close-no-action).
- **Automations invoked:**
  - **`closure.bpmn`** via **`/uipath-maestro-bpmn`** — writes final audit `InvestigationAction`,
    sets case `status = Closed`, sets `Provider.watch_list = true` (`/uipath-platform`), emits Insights
    metrics (`/uipath-insights`).
- **Human tasks:** none.
- **Exit gate:** Case `Closed`; provider on watch list; closure audit + Insights metrics emitted.
- **SLA:** 1 business day.

---

## Human gates & wait state — summary

| Stage | Kind | Assignee | Rule |
|---|---|---|---|
| 5 | **Human gate** | `inv.taylor` (Investigator) | Validate signals, decide to proceed (recommendation) |
| 6 | **Wait state** | — | Case waits on provider response `DOC-CORR-01`; timer escalation |
| 7 | **Human gate** | `sup.morgan` (Supervisor) | Approve any `adverse_or_financial` action before Stage 8 |

## Canonical numbers referenced (must not drift)

- 24 de-duplicated unsupported units · 90-minute overlap on 2026-04-14 (EVV-88231 × EVV-88237)
- Blended rate $7.20/unit · sample exposure **$172.80** · reviewed-period projection **≈ $1,600** ·
  provider-wide indicative range **$18,000 – $42,000** (pending audit)
- Risk signals: RS-01 (overlap, High) · RS-02 (manual/no-GPS 12 of 44 = 27.3%, Medium) ·
  RS-03 (units > POC, 3 DOS / 12 units, High) · RS-04 (unsupported units, 4 claims / 24 units, High) ·
  RS-05 (personnel gap, cert lapsed 2026-03-31 / 8 DOS after / 2 docs missing, Medium)

# Insights Spec — Program Integrity 360

*Operational + program-integrity metrics for the SLED / State HHS buyer. Authored per `/uipath-insights`.*

> **Read `CANON.md` first.** All entity/field references bind to `docs/03-data-model.md`. Synthetic data only.

## Data sources & guardrails

- **Data Fabric entities** (`docs/03-data-model.md`): `ProgramIntegrityCase`, `Provider`, `Attendant`, `Claim`, `EVVVisit`, `RiskSignal`, `EvidenceDocument`, `InvestigationAction`, `Decision`.
- **Job / process telemetry** from Orchestrator + Maestro (job success/failure, run duration, human-task queue) surfaced through `uip insights`.
- **Positioning guardrail (must appear on every Program-Integrity view):** *"Metrics describe **risk signals and case operations**, not fraud determinations. Exposure figures are indicative ranges subject to human validation — not a determination or a demand. Synthetic demo data."*
- **Non-determination rule:** no metric name, tile, or tooltip uses the words "fraud", "fraudulent", or "determination" to describe system output. Use "risk signal", "flagged", "potential", "indicative".

The dashboards are demo-shaped around the single canonical case (**PI-PCS-2026-0041**), so single-case values are shown as illustrative; every metric is defined to aggregate across many cases in production.

---

# Dashboard A — Operational

*Question it answers: "Is the program-integrity operation healthy, fast, and keeping up?"*

### A1. Cases opened / closed
- **Definition:** Count of `ProgramIntegrityCase` created vs. moved to `status = Closed` in the period; show net backlog.
- **Source:** `ProgramIntegrityCase.created_at`, `ProgramIntegrityCase.status`, `ProgramIntegrityCase.updated_at`.
- **Illustrative (this case):** 1 opened 2026-07-22; open as of "now" 2026-07-29 until Stage 9 closes it.
- **Why a SLED buyer cares:** Throughput and backlog trend — can the OPI unit keep pace with alert volume without headcount blowing up?

### A2. Cycle time by stage
- **Definition:** Median/avg elapsed time a case spends in each of the 9 stages (Alert intake → Closure & monitoring).
- **Source:** Derived from `InvestigationAction` timestamps at stage transitions; `ProgramIntegrityCase.stage`.
- **Why a SLED buyer cares:** Pinpoints where cases stall (e.g., waiting on provider vs. investigator review) so leadership can target the real bottleneck.

### A3. SLA adherence
- **Definition:** % of cases (and stage-level tasks) closed within their SLA; count of breached/at-risk.
- **Source:** `ProgramIntegrityCase.sla_due` vs. actual completion timestamps; Action Center task due dates.
- **Why a SLED buyer cares:** Statutory/policy timeliness obligations; a defensible, reportable service level to oversight bodies.

### A4. Human-task backlog
- **Definition:** Count and age of open Action Center human tasks (validations, exceptions, approvals) by assignee/role.
- **Source:** Human-task queue telemetry; `InvestigationAction` (Human validated / Approval pending).
- **Why a SLED buyer cares:** Shows whether the human gates (which we never remove) are creating a review bottleneck — staffing signal.

### A5. Extraction auto-confirm rate
- **Definition:** % of `EvidenceDocument` extractions with `validation_status = Auto-confirmed` vs. `Needs review` / `Human-validated`.
- **Source:** `EvidenceDocument.validation_status`, `EvidenceDocument.extraction_confidence`.
- **Illustrative (this case):** high-confidence docs (e.g., DOC-POC-33915) auto-confirm; **DOC-TS-0416** low-confidence → routed to human. Auto-confirm rate is a governed number, not a target to max out.
- **Why a SLED buyer cares:** Straight-through automation rate and, inversely, how much human review documents demand — cost and accuracy lever.

### A6. Job success rate
- **Definition:** % of automation jobs (RPA legacy pulls, API lookups, BPMN subprocesses) completing successfully vs. faulted; top failure reasons.
- **Source:** Orchestrator/Maestro job telemetry via `uip insights`.
- **Why a SLED buyer cares:** Reliability of the evidence-collection plumbing — a failed pull means an investigator waits or works blind.

### A7. Agent-assist usage
- **Definition:** Count of agent invocations (Triage, Evidence Correlation, Investigation Planning, Summary) per case and % of cases where agent narrative was used/edited by the investigator.
- **Source:** `InvestigationAction` rows with `actor_kind = Agent`; agent job telemetry.
- **Why a SLED buyer cares:** Adoption and value of the AI assist — and a reminder that agents *assist*, they don't decide.

---

# Dashboard B — Program Integrity

*Question it answers: "What are we finding, what did humans decide, and how much of it holds up?"*

**Banner disclaimer (persistent):** *"Risk signals and indicative exposure — not fraud determinations. Subject to human validation. Synthetic demo data."*

### B1. Risk signals by type & severity
- **Definition:** Count of `RiskSignal` grouped by name (RS-01…RS-05) and severity (High/Medium/Low).
- **Source:** `RiskSignal.name`, `RiskSignal.severity`, `RiskSignal.case_id`; `computed_by = deterministic-calc-v1`.
- **Illustrative (this case):** RS-01 Overlap (High, 1 on 2026-04-14, 90 min) · RS-02 Manual/no-GPS (Medium, 12 of 44 = 27.3%) · RS-03 Units above POC (High, 3 DOS, overage 12 units) · RS-04 Unsupported units (High, 4 claims, 24 units) · RS-05 Personnel gap (Medium, cert lapsed 2026-03-31, 8 DOS after, 2 docs missing).
- **Why a SLED buyer cares:** Shows *what kinds* of integrity risk the program is surfacing and where severity concentrates — informs policy and provider education.

### B2. Cases by disposition
- **Definition:** Count of `Decision` grouped by `decision_type` (Proceed to records request / Refer for audit / Open overpayment recovery / Provider education / Close-no-action).
- **Source:** `Decision.decision_type`, `Decision.case_id`, `Decision.decided_at`.
- **Why a SLED buyer cares:** Outcome mix — how often reviews escalate vs. clear vs. resolve via education. Board-level reporting.

### B3. Potential vs. recovered exposure
- **Definition:** Sum of indicative potential exposure vs. amounts moved to recovery — **shown as ranges with the non-determination disclaimer**.
- **Source:** `ProgramIntegrityCase.potential_exposure_low/high`, `Claim.improper_units × Claim.unit_rate`; recovery amounts from executed `Decision` (Open overpayment recovery).
- **Illustrative (this case):** reviewed sample **$172.80** (24 units × $7.20) · reviewed period **≈ $1,600** · provider-wide indicative **$18,000–$42,000 pending audit**.
- **Why a SLED buyer cares:** ROI story — but framed honestly as *potential/indicative*, which protects the agency from over-claiming. Never rendered as a demand.

### B4. Provider watch list
- **Definition:** Providers with `watch_list = true` and their open/closed signal + disposition history.
- **Source:** `Provider.watch_list`, joined to `ProgramIntegrityCase` / `RiskSignal` history.
- **Illustrative (this case):** Harbor Home Support Services (PRV-100482) added at closure (Stage 9).
- **Why a SLED buyer cares:** Continuous monitoring of repeat-risk providers — closes the loop from investigation to ongoing oversight.

### B5. Overturn rate (human disagrees with signal)
- **Definition:** % of risk signals a human set aside / adjusted during review, out of all signals reviewed. Also break out by signal type.
- **Source:** `InvestigationAction` edits against `RiskSignal` (before/after values); investigator review actions.
- **Why a SLED buyer cares:** The false-positive quality metric — a high overturn rate on a rule means the rule needs tuning. Direct evidence the humans are genuinely in control, not rubber-stamping.

### B6. % actions with human approval
- **Definition:** Of all executed **adverse or financial** actions (`Decision.adverse_or_financial = true`), the % carrying a recorded supervisor approval (`approved = true`, `decision_role = Supervisor`). **Target = 100%.**
- **Source:** `Decision.adverse_or_financial`, `Decision.approved`, `Decision.decided_by`, `Decision.decision_role`.
- **Illustrative (this case):** the refer-for-audit + overpayment-recovery disposition carries `sup.morgan` approval → 100%.
- **Why a SLED buyer cares:** The compliance headline metric. Any value below 100% is an alarm: it would mean an adverse/financial action executed without a human gate. This is the single number an oversight body will ask for.

---

## Cross-cutting notes
- All Program-Integrity metrics derive from **Data Fabric** entities; all Operational reliability metrics derive from **job/process telemetry**. Neither implies the system *determines* anything — it counts risk signals, tracks operations, and records the human decisions.
- Recommended default period: rolling 90 days, with the reviewed service window (2026-03-01 → 2026-05-31) selectable for the canonical case.
- Every tile links back to the underlying case/timeline so a viewer can drill from a number to its `InvestigationAction` audit trail.

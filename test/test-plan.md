# Test Plan — Program Integrity 360

*Authored per `/uipath-test`. Small but credible coverage across deterministic calculators, IXP extraction, agent grounding, workflow/integration, HITL gates, end-to-end, and audit trail.*

> **Read `CANON.md` first.** Every expected value below is bound to CANON. Synthetic data only.

**Scope:** one canonical case **PI-PCS-2026-0041** (Harbor Home Support Services, attendant ATT-2087 / Jordan Ellis).
**Pass/fail convention:** a test **passes** only if the actual result equals the expected result exactly (numbers, IDs, dates, routing target). Any deviation is a **fail** — including a "right number for the wrong reason."

Test ID scheme: `UT-*` unit · `IX-*` IXP · `AG-*` agent grounding · `WF-*` workflow/integration · `HG-*` HITL gate · `E2E-*` end-to-end · `AU-*` audit.

---

## A. Unit tests — deterministic calculators (`deterministic-calc-v1`)

### UT-01 — Overlap detection (RS-01), the 2026-04-14 anchor
- **Steps:** Feed EVV-88231 (MBR-33915, 08:00–12:00) and EVV-88237 (MBR-40122, 10:30–14:00), same attendant ATT-2087, same date.
- **Expected:** Overlap detected = **true**; overlap window **10:30–12:00 = 90 minutes**; `overlaps_with` set both directions; RS-01 result = "1 overlap on 2026-04-14 (90 min)", severity High.
- **Pass/fail:** Pass iff overlap minutes = **90** and exactly **1** overlap flagged for the period.

### UT-02 — No false overlap on non-overlapping visits
- **Steps:** Feed two visits for ATT-2087 on different dates / non-intersecting ranges (e.g., EVV-88201 and EVV-88215).
- **Expected:** Overlap = false; no RS-01 flag added.
- **Pass/fail:** Pass iff zero overlaps flagged.

### UT-03 — Improper units per claim (RS-04), `billed − min(evv, timesheet)`
- **Steps:** Compute improper units for the 4 flagged claims.
- **Expected:** **CLM-0491 = 8** (24 − min(16,16)); **CLM-0503 = 8** (24 − min(24,16)); **CLM-0540 = 4** (24 − min(24,20)); **CLM-0549 = 4** (20 − min(16,16)). Clean claims (CLM-0468, 0475, 0492, 0517, 0528) = **0**.
- **Pass/fail:** Pass iff each per-claim value matches exactly and clean claims compute 0.

### UT-04 — De-duplicated improper-units total (RS-04)
- **Steps:** Sum improper units across flagged claims without double-counting RS-03/RS-04 overlap on shared DOS.
- **Expected:** **8 + 8 + 4 + 4 = 24 units**; exposure = 24 × $7.20 = **$172.80**.
- **Pass/fail:** Pass iff total = **24 units** and **$172.80**.

### UT-05 — Units above plan of care (RS-03), overage
- **Steps:** Compare `units_billed` to member POC daily authorization (MBR-33915 = 20/day, MBR-40122 = 16/day).
- **Expected:** **3 DOS** over plan — 2026-04-14 (CLM-0491, +4), 2026-04-16 (CLM-0503, +4), 2026-05-19 (CLM-0540, +4); **total overage = 12 units**. CLM-0549 (20 units, = POC) is **not** flagged.
- **Pass/fail:** Pass iff exactly 3 DOS flagged and overage = **12 units** (CLM-0549 excluded).

### UT-06 — Manual EVV / missing GPS (RS-02)
- **Steps:** Count visits over the full 44-visit period where `capture_method = Manual` AND `gps_confirmed = No`.
- **Expected:** **12 of 44 visits (27.3%)**, severity Medium. (Representative 12-row sample shows 6 such visits; the signal is computed on the full period.)
- **Pass/fail:** Pass iff count = **12/44** and percentage renders **27.3%**.

### UT-07 — Personnel documentation gap (RS-05)
- **Steps:** Evaluate credential expiry vs. DOS and required-doc completeness for ATT-2087.
- **Expected:** Cert `PCA-556210` lapsed **2026-03-31**; **8 DOS after lapse**; **2 docs missing** (Training acknowledgment, Background-check attestation); severity Medium.
- **Pass/fail:** Pass iff lapse date, 8 DOS, and 2 missing docs all match.

### UT-08 — Rule auditability / no-arithmetic-by-agent guard
- **Steps:** Inspect each produced `RiskSignal` record.
- **Expected:** Every signal carries `rule_expression`, `inputs`, `result_value`, and `computed_by = deterministic-calc-v1` — never an agent name.
- **Pass/fail:** Pass iff all 5 signals have `computed_by = deterministic-calc-v1`.

---

## B. IXP extraction tests

### IX-01 — Low-confidence routing to human (DOC-TS-0416)
- **Steps:** Run extraction on handwritten timesheet DOC-TS-0416 (04-16).
- **Expected:** Extracted shift **08:00–12:00** (16 units) contradicting CLM-0503 (24u); confidence **below auto-confirm threshold** → `validation_status = Needs review`, routed to human `inv.taylor`; **not** auto-confirmed.
- **Pass/fail:** Pass iff status = **Needs review** and a human task is created; **fail** if auto-confirmed.

### IX-02 — High-confidence auto-confirm (DOC-POC-33915)
- **Steps:** Run extraction on the Plan of Care pulled from the legacy system.
- **Expected:** Extracted **20 units/day**; confidence ≥ threshold → `validation_status = Auto-confirmed`; no human task.
- **Pass/fail:** Pass iff status = **Auto-confirmed** and value = 20 units/day.

### IX-03 — Second timesheet extraction (DOC-TS-0519)
- **Steps:** Extract DOC-TS-0519 (05-19).
- **Expected:** Extracted **08:00–13:00** (20 units) contradicting CLM-0540 (24u); feeds timesheet_supported = 20 for CLM-0540.
- **Pass/fail:** Pass iff extracted window yields 20 supported units for CLM-0540.

### IX-04 — Service note corroboration (DOC-SN-0414)
- **Steps:** Extract service note DOC-SN-0414 for 04-14.
- **Expected:** Note describes a **single-member AM-only** visit on 04-14, consistent with the overlap read.
- **Pass/fail:** Pass iff extracted content flags single-member/AM-only.

### IX-05 — Human validation write-back
- **Steps:** Human confirms/corrects DOC-TS-0416 in Evidence Studio.
- **Expected:** `validation_status → Human-validated`; `validated_by = inv.taylor`; an `InvestigationAction` (Human validated) appended.
- **Pass/fail:** Pass iff status flips and audit row is written with the human actor.

---

## C. Agent grounding tests (Triage, Correlation, Planning, Summary)

### AG-01 — No uncited factual claim
- **Steps:** Capture each agent's narrative output for the case.
- **Expected:** Every FACT statement carries a citation to a signal/claim/doc ID; no factual assertion lacks a source.
- **Pass/fail:** **Fail** on any uncited factual claim.

### AG-02 — No arithmetic by agents
- **Steps:** Scan agent output for computed values.
- **Expected:** Any number the agent states is quoted from a deterministic result **by ID** (e.g., "24 units per RS-04"); the agent performs no calculation.
- **Pass/fail:** **Fail** if an agent derives a number not present in a deterministic record.

### AG-03 — FACT vs INFERENCE labeling present
- **Steps:** Inspect Summary/Correlation output structure.
- **Expected:** Output explicitly separates **FACT (cited)** from **INFERENCE (suggested, for human review)**.
- **Pass/fail:** Pass iff both labels are present and inferences are marked for human review.

### AG-04 — Triage does not re-score
- **Steps:** Review Triage Agent rationale for priority High.
- **Expected:** Cites the deterministic signals that drove priority; does **not** compute or alter a risk score.
- **Pass/fail:** **Fail** if Triage output changes/creates a numeric priority score.

### AG-05 — Planning recommends only, flags gates
- **Steps:** Review Investigation Planning Agent output.
- **Expected:** Produces recommendations only (e.g., "Proceed to records request"), never executes, and explicitly flags the human approval gate for adverse/financial actions.
- **Pass/fail:** **Fail** if the agent output triggers execution or omits the gate flag.

---

## D. Workflow / integration tests

### WF-01 — RPA legacy pull (Plan of Care)
- **Steps:** Run the RPA legacy care-mgmt pull.
- **Expected:** DOC-POC-33915 (20 units/day for MBR-33915) landed in the bucket + Data Fabric; job success.
- **Pass/fail:** Pass iff document present and job status = Successful.

### WF-02 — API lookups (claims + EVV)
- **Steps:** Run API workflows to pull claims and EVV into Data Fabric.
- **Expected:** 9 claims and the EVV visit set loaded, matched on (attendant, member, date).
- **Pass/fail:** Pass iff all 9 claims present and Claim↔EVV matching populated.

### WF-03 — Records request outbound + wait
- **Steps:** Trigger the provider records request (Stage 6).
- **Expected:** Request sent to provider; case enters **Awaiting Provider** wait state (suspended, not faulted); SLA clock tracked.
- **Pass/fail:** Pass iff case status = Awaiting Provider and instance is suspended (resumable).

### WF-04 — Response intake + resume/reprocess
- **Steps:** Deliver DOC-CORR-01 into the records-request inbox.
- **Expected:** Case **resumes**, reprocesses the new document into the same case record, status flips **Awaiting Provider → In Review**.
- **Pass/fail:** Pass iff case auto-resumes and DOC-CORR-01 is attached + reprocessed.

### WF-05 — Approved action execution
- **Steps:** After supervisor approval, run Stage 8.
- **Expected:** Referral packet generated, overpayment recovery opened, provider notified; each an `InvestigationAction (Action executed)`.
- **Pass/fail:** Pass iff all three artifacts produced and logged.

---

## E. HITL gate tests

### HG-01 — Adverse action blocked without supervisor approval
- **Steps:** As investigator `inv.taylor`, attempt to execute refer-for-audit + open-overpayment-recovery (`adverse_or_financial = true`) without supervisor approval.
- **Expected:** Action **blocked**; no execution; user prompted for supervisor approval.
- **Pass/fail:** **Fail** if any adverse/financial action executes without `approved = true`.

### HG-02 — Supervisor approval unblocks + records decision
- **Steps:** As supervisor `sup.morgan`, review and approve the disposition.
- **Expected:** `Decision` recorded with `decided_by = sup.morgan`, `decision_role = Supervisor`, `adverse_or_financial = true`, `approved = true`; action now executable.
- **Pass/fail:** Pass iff decision record complete and action proceeds only after approval.

### HG-03 — Non-adverse action does not require supervisor
- **Steps:** As investigator, select "Proceed to records request" (`adverse_or_financial = false`).
- **Expected:** Proceeds without supervisor approval; logged with `decision_role = Investigator`.
- **Pass/fail:** Pass iff information request proceeds and is correctly classified non-adverse.

### HG-04 — Low-confidence extraction requires human before it counts
- **Steps:** Attempt to let DOC-TS-0416 (Needs review) drive a disposition without human validation.
- **Expected:** System requires human validation first; unvalidated low-confidence extraction cannot finalize an adverse disposition.
- **Pass/fail:** **Fail** if an unvalidated Needs-review doc drives an adverse outcome.

---

## F. End-to-end smoke test

### E2E-01 — All 9 stages, one pass
- **Steps:** Walk PI-PCS-2026-0041 through Stages 1→9: alert intake/triage → evidence collection → extraction/validation (incl. DOC-TS-0416 human route) → correlation/planning → investigator review (proceed to records request) → records request + wait + DOC-CORR-01 resume → supervisor approval → action execution → closure + watch list.
- **Expected:** Case reaches `status = Closed`; provider `watch_list = true`; all key numbers match CANON (90-min overlap, 24 improper units, $172.80 / ≈$1,600 / $18K–$42K, 5 signals); no stage skipped; no adverse action without approval.
- **Pass/fail:** Pass iff the case closes with every checkpoint in the smoke checklist below satisfied.

---

## G. Audit-trail completeness test

### AU-01 — Every state change appends an InvestigationAction
- **Steps:** After E2E-01, enumerate `InvestigationAction` rows and reconcile against events.
- **Expected:** One row per state change — signal computed, doc extracted, human validated, edit, request sent, response received, approval, action executed — each with `actor`, `actor_kind` (Human/System/Agent), timestamp, and (for edits) before/after values. Append-only / immutable.
- **Pass/fail:** Pass iff there are no state changes without a corresponding audit row and no audit rows were mutated/deleted.

### AU-02 — Traceability from screen number to source
- **Steps:** Pick any figure on any screen (e.g., 90-min overlap, 24 units) and drill down.
- **Expected:** Figure traces to a deterministic `RiskSignal`/`Claim` record and its `InvestigationAction`.
- **Pass/fail:** Pass iff every sampled figure reconciles to source.

---

## Smoke-test checklist (compact)

| # | Checkpoint | Expected | Pass/Fail |
|---|---|---|---|
| 1 | Case opens from alert | PI-PCS-2026-0041 open, priority High, from ALERT-CA-2026-7781 | ☐ |
| 2 | Evidence collected | 9 claims + 44 EVV (12-row sample shown) + POC loaded | ☐ |
| 3 | Overlap computed | 2026-04-14, EVV-88231 ∩ EVV-88237 = **90 min** | ☐ |
| 4 | Improper units | CLM 0491/0503/0540/0549 = 8/8/4/4 → **24 units** | ☐ |
| 5 | POC overage (RS-03) | 3 DOS, overage **12 units** | ☐ |
| 6 | Manual/no-GPS (RS-02) | **12 of 44 (27.3%)** | ☐ |
| 7 | Personnel gap (RS-05) | cert lapsed 2026-03-31, 8 DOS after, 2 docs missing | ☐ |
| 8 | Exposure | sample **$172.80** / period **≈$1,600** / provider-wide **$18K–$42K** + disclaimer | ☐ |
| 9 | Low-confidence extract | DOC-TS-0416 → **Needs review**, routed to human | ☐ |
| 10 | Agent grounding | FACT/INFERENCE labels present; no uncited claim; no agent arithmetic | ☐ |
| 11 | Records request wait | Case → **Awaiting Provider**, suspended/resumable | ☐ |
| 12 | Response resume | DOC-CORR-01 reprocessed; **In Review** | ☐ |
| 13 | Adverse-action gate | Blocked without `sup.morgan` approval | ☐ |
| 14 | Supervisor approval | Decision `approved=true`, `decision_role=Supervisor` | ☐ |
| 15 | Execution | Referral packet + recovery opened + provider notified | ☐ |
| 16 | Closure + monitoring | Case Closed; Provider `watch_list=true` | ☐ |
| 17 | Audit trail | Every state change → one immutable InvestigationAction | ☐ |
| 18 | % adverse w/ approval | **100%** | ☐ |

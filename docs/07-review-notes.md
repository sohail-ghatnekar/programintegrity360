# 07 — Review Notes — Program Integrity 360

*Authored per `/uipath-review`: a **read-only** design self-audit. No files were changed. Scope: the
Program Integrity 360 demo (Medicaid PCS, case `PI-PCS-2026-0041`, synthetic data). Findings reference
exact repo files. Every number checked against `../CANON.md`.*

---

## (a) Strengths

- **Single source of truth is real, not aspirational.** `../CANON.md` fixes every ID, date, and number,
  and the executable artifacts inherit them: `../maestro-case/caseplan.json` carries the same exposure
  figures ($172.80 / ~$1,600 / $18K–$42K), the 90-minute overlap, the 24 unsupported units, and the
  $7.20/unit rate in a header comment and in-line.
- **Determinism is enforced structurally.** Every `RiskSignal` row in `../data/risk_signals.json` stores
  `rule_expression`, `inputs`, `result_value`, and `computed_by = deterministic-calc-v1`. Arithmetic
  never touches an agent. The BPMN spec (`../maestro-bpmn/evidence-collection.bpmn.md`) does the calc in a
  Script Task, not an agent step.
- **Clean skill boundaries.** Integration surface drives the choice: REST mocks → IS connector + API
  workflow; UI-only legacy mocks → RPA (`../connector-builder/mock-connectors.md`,
  `../rpa/legacy-pulls.md`). IXP produces *facts*, code produces *numbers*, agents produce *words*.
- **Two real human gates + a wait state**, all explicit in `caseplan.json`: Stage 5 (investigator),
  Stage 7 (supervisor, gates adverse/financial), Stage 6 (P15D receive/timer wait).
- **Audit trail is append-only by policy**, declared in `caseplan.json` `auditPolicy` and honored by
  `../maestro-bpmn/closure.bpmn.md` (final `InvestigationAction`).
- **Positioning discipline is consistent** across every spec: "risk signals, not fraud determination,"
  FACT vs INFERENCE, non-determination disclaimer on exposure.

## (b) Best-practice checks passed

| Check | Result | Evidence |
|---|---|---|
| **Grounding** | PASS | Agent constraints in `caseplan.json` (Correlation: "reference deterministic values by ID"; Summary: "citations mandatory"); each `RiskSignal` stores rule + inputs. |
| **Determinism** | PASS | `computed_by = deterministic-calc-v1` on all 5 signals; exposure math in a BPMN Script Task; agents forbidden arithmetic. |
| **Human gates** | PASS | `humanGate: true` at stages 5 and 7; Stage-7 `requiresApprovalWhen: adverse_or_financial == true`; Stage-3 sensitive docs always human-reviewed (`../ixp/ixp-taxonomy.md`). |
| **Audit trail** | PASS | Append-only `InvestigationAction`; `actor_kind` distinguishes Human/System/Agent; edits keep before/after (`../docs/03-data-model.md` §8). |
| **Least privilege** | PASS | Three roles in `caseplan.json` (`investigator`, `supervisor`, `system`); only supervisor approves adverse/financial; `system` never decides. |
| **Naming** | MOSTLY PASS | IDs and stage names consistent; one wording drift in `missing_docs` (see (c)). |
| **Reject/close path** | PASS | `caseplan.json` Stage-7 transition `approved == false → stage-9` (Close-no-action); guard in `../maestro-bpmn/referral-packet.bpmn.md`. |
| **Confidentiality** | PASS | Members by initials only (R.A./T.N.), synthetic data, Restricted classification (`CANON.md` §1). |

## (c) Risks / watch-outs for a live demo

1. **Two different "12"s can be conflated.** The EVV sample is **12 rows of 44** (`CANON.md` §2) and RS-02
   is **12 manual/no-GPS visits of 44** (`../data/risk_signals.json`). These are numerically equal but
   conceptually different. Say on-screen "12 of the full 44 visits were manual/no-GPS" and keep the
   sample-size language separate.
2. **12 vs 24 units.** RS-03 (POC overage) totals **12 units**; RS-04 (unsupported units) totals **24
   units**; the exposure math uses **24**. An auditor may ask why they differ — the answer (they measure
   different rules; CANON §4 note prevents double-counting) must be ready. The Claims vs EVV Reconciliation
   screen should show both without implying they add up.
3. **"De-duplicated" wording.** `../data/risk_signals.json` RS-04 says "24 de-duplicated unsupported
   units," but the four claims (CLM-0491/0503/0540/0549) are already distinct; "de-duplicated" really means
   *not double-counted against RS-03*. Explain it that way or the term invites a question.
4. **`missing_docs` wording drift.** Three files phrase the two missing docs slightly differently:
   `CANON.md` §1 ("signed training acknowledgment"), `../data/attendants.json`-model
   ("Training acknowledgment"), and `../data/risk_signals.json` ("Signed training acknowledgment").
   Harmless but a sharp reviewer will notice — align to CANON's phrasing.
5. **Unwritten specs.** Several skill deliverables referenced by the case plan are not yet on disk:
   `../agents/*`, `../hitl/human-in-the-loop.md`, `../coded-app/*`, `../platform/*`,
   `../insights/insights-spec.md`, `../test/test-plan.md`, `../solution/*`, and `../docs/04-demo-script.md`
   / `../docs/05-launch-checklist.md`. The live demo narration and reset steps depend on 04/05.
6. **Wait-state timing in a live demo.** Stage 6's P15D timer is realistic but the demo "now" is
   2026-07-29; the provider response `DOC-CORR-01` must be pre-staged to arrive on cue, or the wait state
   will visibly stall. Confirm the reprocessing re-runs correlation deterministically.
7. **Exposure phrasing.** Never let the headline ($172.80 / ~$1,600 / $18K–$42K) appear without the
   non-determination disclaimer (`CANON.md` §5). This is the single most important sentence for a SLED
   audience.

## (d) Defensibility for public sector — checklist

| Requirement | How it is met | Where in the repo |
|---|---|---|
| **Auditability** | Append-only `InvestigationAction` on every mutation; signals store rule + inputs + `computed_by` + `computed_at`; edits keep before/after; final audit at closure. | `caseplan.json` `auditPolicy`; `../data/risk_signals.json`; `../docs/03-data-model.md` §8; `../maestro-bpmn/closure.bpmn.md` |
| **Transparency** | Deterministic rules are human-readable and shown on-screen; agents label FACT vs INFERENCE with citations; exposure always paired with the disclaimer. | `CANON.md` §4–5; `../ixp/ixp-taxonomy.md`; `../data/risk_signals.json`; coded-app Risk Signals & Agent Rationale screen (`CANON.md` §10) |
| **Process control** | Fixed 9-stage lifecycle with explicit entry/exit gates and transitions; adverse/financial work cannot execute without the Stage-7 gate; BPMN guard aborts if not approved. | `caseplan.json` (stages, transitions); `../maestro-bpmn/referral-packet.bpmn.md` (approval guard) |
| **Human oversight** | Stage-3 validation of low-confidence/sensitive extractions; Stage-5 investigator decision; Stage-7 supervisor approval of any adverse/financial action; agents recommend only. | `caseplan.json` (`humanGate`); `../ixp/ixp-taxonomy.md`; `hitl/human-in-the-loop.md` *(planned)* |

## (e) Pre-go-live punch list

1. **Write the missing specs** so the case plan's references resolve: `../agents/*` (4),
   `../hitl/human-in-the-loop.md`, `../coded-app/*`, `../platform/*`, `../insights/insights-spec.md`,
   `../test/test-plan.md`, `../solution/*`.
2. **Author `../docs/04-demo-script.md` and `../docs/05-launch-checklist.md`** — the ~12-min narration and
   the smoke + reset steps; both are in the outline but not on disk.
3. **Align `missing_docs` wording** across `CANON.md`, the attendant data, and `risk_signals.json`.
4. **Pre-stage `DOC-CORR-01`** so Stage 6 resolves on cue; verify correlation re-runs deterministically
   after intake.
5. **Verify the numbers live**: 90-min overlap (EVV-88231 × EVV-88237), 24 unsupported units
   (8+8+4+4), $172.80 sample, ~$1,600 projection, $18K–$42K indicative — each reconstructable on the
   Reconciliation screen.
6. **Confirm role separation in the target tenant**: `inv.taylor` cannot approve adverse/financial;
   only `sup.morgan` can (Stage 7).
7. **Rehearse the disclaimer**: exposure headline never shown without the non-determination sentence.
8. **Smoke-test the reject path**: Stage-7 `approved == false` routes straight to Stage 9 Close-no-action
   with a full audit record.

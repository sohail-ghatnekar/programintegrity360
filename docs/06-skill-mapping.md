# 06 — Skill Mapping — Program Integrity 360

*How each of the 15 `/uipath-*` skills contributes to the demo, the exact file(s) in this repo that
implement it, and the case stage(s) it touches. **Synthetic data only.** Every ID/number ties to
`../CANON.md`.*

> Stage numbers refer to the 9-stage lifecycle in `02-case-stages.md` / `../maestro-case/caseplan.json`.
> Files listed under "Implementing file(s)" are the canonical repo paths from
> `00-implementation-outline.md` §A. Items marked *(planned)* are specified in the outline and referenced
> by the executable case plan but not yet written to disk.

## Mapping table

| # | Skill | Contribution to this demo | Implementing file(s) | Case stage(s) |
|---|---|---|---|---|
| 1 | **`/uipath-maestro-case`** | The case aggregate + 9-stage lifecycle: gates, wait state, transitions, roles, append-only audit policy. Drives everything. Sets `Awaiting Provider`/`Closed` statuses. | `../maestro-case/caseplan.json`, `../maestro-case/tasks.md` | 1–9 (owns all) |
| 2 | **`/uipath-maestro-bpmn`** | Four deterministic subprocesses invoked by the case: evidence collection + calc, records request + wait, referral packet, closure. Contains the Stage-6 receive/timer and the Stage-8 approval guard. | `../maestro-bpmn/evidence-collection.bpmn.md`, `../maestro-bpmn/records-request.bpmn.md`, `../maestro-bpmn/referral-packet.bpmn.md`, `../maestro-bpmn/closure.bpmn.md` | 2, 6, 8, 9 |
| 3 | **`/uipath-rpa`** | UI-automation robots for the two legacy mocks with no API: legacy care-mgmt (Plan of Care) and EVV vendor portal; plus legacy write-back at execution. Collects/organizes only — no arithmetic, no signals. | `../rpa/legacy-pulls.md` | 2 (pulls), 6 (response intake to bucket), 8 (write-back) |
| 4 | **`/uipath-api-workflow`** | Modern REST lookups + outbound actions (JSON, Serverless Workflow DSL): alert intake & case creation, claims pull, send records request, open recovery record, queue provider notice, write audit. | `../api-workflows/api-lookups.md` | 1 (intake), 2 (claims), 6 (send/intake), 8 (recovery/notice), 9 (audit write) |
| 5 | **`/uipath-ixp`** | Document Understanding taxonomy + extraction over 5 doc types (timesheets, POC, service note, personnel packet); produces cited facts with confidence; routes low-confidence/sensitive to HITL. Produces facts, never signals. | `../ixp/ixp-taxonomy.md` | 3 |
| 6 | **`/uipath-agents`** | Four grounded, non-deciding agents: Triage (explain priority), Evidence Correlation (group/explain by ID), Investigation Planning (recommend only), Summary (FACT vs INFERENCE narrative). | `../agents/triage-agent.md`, `../agents/evidence-correlation-agent.md`, `../agents/investigation-planning-agent.md`, `../agents/summary-agent.md` *(planned)* | 1 (Triage), 4 (Correlation, Planning), 5 & 7 (Summary) |
| 7 | **`/uipath-human-in-the-loop`** | The human gates: Stage-3 extraction validation, Stage-5 investigator review/decision, Stage-7 supervisor approval that gates every adverse/financial action. | `../hitl/human-in-the-loop.md` *(planned)* | 3, 5, 7 |
| 8 | **`/uipath-coded-apps`** | The investigator/supervisor workbench (9 screens incl. Command Center, Case 360, Claims vs EVV Reconciliation, Evidence Studio, Decision Center, Case Timeline, Risk Signals & Agent Rationale). | `../coded-app/app-spec.md`, `../coded-app/wireframes.md` *(planned)* | 5, 7 (decision surfaces); read-only across 1–9 |
| 9 | **`/uipath-platform`** | Data Fabric (9 entities) as system of record, storage buckets for source docs, queues/triggers/jobs, `Provider.watch_list` write, and hosting the deterministic landing of records. | `../platform/data-fabric-and-plumbing.md` *(planned)* | 2 (land), 6, 8, 9 (watch_list); underpins all |
| 10 | **`/uipath-solution`** | Bundles the case, BPMN, RPA, API workflows, agents, coded app, and connectors into one deployable `.uipx` for cloud.uipath.com / uipathlabs / Playground. | `../solution/solution.md`, `../solution/project-structure.md`, `../solution/deploy.md` | Cross-cutting (deployment) |
| 11 | **`/uipath-insights`** | Operational + program-integrity metrics emitted at closure (case cycle time, SLA adherence, signal counts, exposure); watch-list monitoring feed. | `../insights/insights-spec.md` *(planned)* | 9 |
| 12 | **`/uipath-review`** | Read-only design self-audit of structure, grounding, determinism, gates, audit trail, least-privilege, naming. | `07-review-notes.md` | Cross-cutting (design QA) |
| 13 | **`/uipath-test`** | Test plan / smoke tests validating the deterministic numbers (24 units, 90-min overlap, $172.80), the gates, and the wait-state reprocessing. | `../test/test-plan.md` *(planned)* | Cross-cutting (verification of 1–9) |
| 14 | **`/uipath-connector-builder`** | Custom IS connector pattern for the two REST mocks: claims-analytics alert source and records-request inbox (send request / read response). | `../connector-builder/mock-connectors.md` | 1 (alert source), 6 (records inbox) |
| 15 | **`/uipath-planner`** | Turns CANON into the implementation plan / SDD and the architecture + stage design; derives the multi-skill task list. | `00-implementation-outline.md`, `01-architecture.md`, `02-case-stages.md` | Cross-cutting (design) |

---

## Notes on boundaries (why each skill and not another)

- **RPA vs connector vs API workflow.** The split is decided by integration surface, per
  `../connector-builder/mock-connectors.md`: REST+JSON mocks (alert source, records inbox) → IS
  **connector** consumed by **API workflows**; UI-only legacy mocks (care-mgmt, EVV portal) → **RPA**.
- **IXP vs `deterministic-calc-v1`.** IXP *reads what a document says* (e.g. timesheet 08:00–12:00) with a
  confidence score. It does **not** compute overages or unsupported units. Those are deterministic code
  (RS-01..RS-05), which is not a `/uipath-*` authoring skill but the `system` engine referenced throughout
  (`../maestro-bpmn/evidence-collection.bpmn.md`).
- **Agents vs humans.** `/uipath-agents` only explains/organizes and recommends; `/uipath-human-in-the-loop`
  owns the actual gates where a person validates or approves. Adverse/financial dispositions cannot pass
  without the Stage-7 supervisor gate.
- **Maestro-case vs Maestro-bpmn.** The **case** (`/uipath-maestro-case`) owns lifecycle, gates, and
  status; the **BPMN** subprocesses (`/uipath-maestro-bpmn`) are the deterministic worker flows the case
  invokes.

## Coverage check

- All **15** requested skills are mapped: maestro-case, maestro-bpmn, rpa, ixp, agents,
  human-in-the-loop, coded-apps, api-workflow, platform, solution, insights, review, test,
  connector-builder, planner.
- Every case stage (1–9) is covered by at least one skill; Stages 5 and 7 are the two human gates,
  Stage 6 holds the wait state, and no skill performs arithmetic except the `deterministic-calc-v1`
  engine embedded in the BPMN/platform layer.

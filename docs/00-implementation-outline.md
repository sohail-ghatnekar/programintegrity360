# Program Integrity 360 — Implementation Outline

*Medicaid Personal Care Services (PCS) program-integrity investigation demo for a State HHS / SLED audience.*
*Single case: **PI-PCS-2026-0041**, Harbor Home Support Services, attendant Jordan Ellis. Synthetic data only.*

> **Read `CANON.md` first.** It is the single source of truth for every ID, date, and number below.

---

## A. Recommended file structure

```
program-integrity-360/
├── CANON.md                         # single source of truth — everything ties to this
├── README.md                        # how the demo hangs together + how to run/deploy
├── docs/
│   ├── 00-implementation-outline.md # this file
│   ├── 01-architecture.md           # component + data-flow diagrams, skill boundaries
│   ├── 02-case-stages.md            # 9-stage lifecycle, gates, SLAs
│   ├── 03-data-model.md             # 9 entities, fields, relationships
│   ├── 04-demo-script.md            # live screen-by-screen narration (~12 min)
│   ├── 05-launch-checklist.md       # pre-demo smoke + reset steps
│   ├── 06-skill-mapping.md          # which /uipath-* skill owns which asset
│   └── 07-review-notes.md           # /uipath-review self-audit
├── solution/
│   ├── solution.md                  # /uipath-solution packaging design
│   ├── project-structure.md         # projects bundled into the .uipx
│   └── deploy.md                    # exact login + pack/publish/deploy commands (staging/uipathlabs)
├── maestro-case/                    # /uipath-maestro-case
│   ├── tasks.md                     # case plan task breakdown
│   └── caseplan.json                # the case lifecycle definition
├── maestro-bpmn/                    # /uipath-maestro-bpmn (deterministic subprocesses)
│   ├── evidence-collection.bpmn.md
│   ├── records-request.bpmn.md
│   ├── referral-packet.bpmn.md
│   └── closure.bpmn.md
├── rpa/                             # /uipath-rpa (mocked legacy systems, no API)
│   └── legacy-pulls.md
├── api-workflows/                   # /uipath-api-workflow (modern API lookups + outbound)
│   └── api-lookups.md
├── ixp/                             # /uipath-ixp (document extraction)
│   └── ixp-taxonomy.md
├── agents/                          # /uipath-agents (grounded, non-deciding)
│   ├── triage-agent.md
│   ├── evidence-correlation-agent.md
│   ├── investigation-planning-agent.md
│   └── summary-agent.md
├── hitl/                            # /uipath-human-in-the-loop
│   └── human-in-the-loop.md
├── coded-app/                       # /uipath-coded-apps
│   ├── app-spec.md
│   └── wireframes.md
├── platform/                        # /uipath-platform (Data Fabric, queues, buckets, triggers)
│   └── data-fabric-and-plumbing.md
├── insights/                        # /uipath-insights
│   └── insights-spec.md
├── connector-builder/               # /uipath-connector-builder (mock external systems)
│   └── mock-connectors.md
├── test/                            # /uipath-test
│   └── test-plan.md
└── data/                            # synthetic sample data (JSON)
    ├── cases.json
    ├── providers.json
    ├── attendants.json
    ├── claims.json
    ├── evv_visits.json
    ├── risk_signals.json
    ├── evidence_documents.json
    ├── investigation_actions.json
    └── decisions.json
```

## B. Which parts belong to each /uipath-* skill

| Skill | Owns | Deliverable |
|---|---|---|
| `/uipath-maestro-case` | Case lifecycle PI-PCS-2026-0041 | `maestro-case/caseplan.json`, `tasks.md` |
| `/uipath-maestro-bpmn` | Deterministic subprocesses | 4 `.bpmn` specs |
| `/uipath-rpa` | Legacy system pulls (no API) | `rpa/legacy-pulls.md` |
| `/uipath-api-workflow` | Modern API lookups + outbound | `api-workflows/api-lookups.md` |
| `/uipath-ixp` | Timesheets, POC, notes, personnel, correspondence | `ixp/ixp-taxonomy.md` |
| `/uipath-agents` | Triage, Correlation, Planning, Summary | 4 agent specs |
| `/uipath-human-in-the-loop` | Validation, exceptions, supervisor approval | `hitl/human-in-the-loop.md` |
| `/uipath-coded-apps` | Investigator workbench front end | `coded-app/*` |
| `/uipath-platform` | Data Fabric, queues, buckets, jobs, triggers | `platform/*` |
| `/uipath-solution` | Package as deployable solution | `solution/*` |
| `/uipath-insights` | Operational + program-integrity metrics | `insights/insights-spec.md` |
| `/uipath-test` | Test plan / smoke tests | `test/test-plan.md` |
| `/uipath-review` | Design quality sanity check | `docs/07-review-notes.md` |
| `/uipath-connector-builder` | Custom connector pattern for mocked systems | `connector-builder/mock-connectors.md` |
| `/uipath-planner` | Turn into implementation plan / SDD | `docs/00` (this) + `docs/01`, `docs/02` |

## C. Main demo screens (coded app)

Command Center → Case 360 → Claims vs EVV Reconciliation → Evidence Studio →
Risk Signals & Agent Rationale → Decision Center → Provider Response Tracking →
Case Timeline → Task List & SLA widgets. (Full specs in `coded-app/`.)

## D. Case stages

1. Alert intake & triage → 2. Automated evidence collection → 3. Document extraction & validation →
4. Evidence correlation & investigation planning → 5. Investigator human review →
6. Provider records request & wait state → 7. Supervisor approval / disposition →
8. Approved action execution → 9. Closure & monitoring. (Full specs in `docs/02-case-stages.md`.)

## E. Primary synthetic data objects

`ProgramIntegrityCase`, `Provider`, `Attendant`, `Claim`, `EVVVisit`, `RiskSignal`,
`EvidenceDocument`, `InvestigationAction`, `Decision`. One case, one provider, one attendant,
2 members, 12 sampled EVV visits (of 44), 9 claims, 5 risk signals, 6 evidence documents.

## F. Build order (how this repo was produced)

1. `CANON.md` — lock all facts/numbers.
2. Anchor docs (this outline, README, data model).
3. Synthetic data (`data/*.json`) derived from CANON.
4. Platform plumbing + solution packaging.
5. Case plan + BPMN subprocesses.
6. RPA + API workflows + IXP taxonomy + connectors.
7. Agents + HITL.
8. Coded app spec + wireframes.
9. Insights + test plan + demo script + launch checklist + review notes.

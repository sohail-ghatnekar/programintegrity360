# Solution Packaging — Program Integrity 360

*Authored per `/uipath-solution`. How the whole demo packs into ONE deployable solution.*

> **Read `CANON.md` first.** Solution name, cloud, org, and tenant are canonical (§11). Synthetic data only.

## 1. The one solution

Everything in this repo ships as a **single deployable solution** named **`Program Integrity 360`**, produced as one **`.uipx`** by `uip solution pack`. One solution = one versioned, atomically deployable unit that bundles every project and declares every shared resource and binding, so a target tenant gets a consistent, activatable case-management application in one shot.

- **Solution name:** `Program Integrity 360`
- **Target:** cloud `cloud.uipath.com`, org `uipathlabs`, tenant `Playground`, folder `AMER Presales/Public Sector/ProgramIntegrity360` (see `solution/deploy.md`)
- **Artifact:** `Program Integrity 360.uipx`

## 2. Projects bundled into the solution

Each project keeps its own `project.json` / project descriptor and is referenced by the solution's `solution.json` project list. (Concrete folders in `solution/project-structure.md`.)

| # | Project | Type | Skill | Role in the case |
|---|---|---|---|---|
| P1 | `pi360-case` | Maestro **Case** (`caseplan.json`) | `/uipath-maestro-case` | Orchestrates the 9-stage lifecycle of PI-PCS-2026-0041; the top-level aggregate. |
| P2 | `pi360-bpmn-subprocesses` | Maestro **BPMN** (`.bpmn`) | `/uipath-maestro-bpmn` | Deterministic subprocesses: evidence-collection, records-request (+wait), referral-packet, closure. |
| P3 | `pi360-rpa-legacy` | **RPA** (`.xaml`/`.cs`) | `/uipath-rpa` | Legacy care-mgmt pulls (Plan of Care) — no API available. |
| P4 | `pi360-api-workflows` | **API Workflow** (JSON) | `/uipath-api-workflow` | Modern API lookups (claims, EVV) + outbound provider notification. |
| P5 | `pi360-ixp` | **IXP** taxonomy/model | `/uipath-ixp` | Extract timesheets, POC, service notes, personnel packet, correspondence. |
| P6 | `pi360-agents` | **Agents** (coded/low-code) | `/uipath-agents` | Triage, Evidence Correlation, Investigation Planning, Summary — grounded, non-deciding. |
| P7 | `pi360-app` | **Coded App** (React/TS) | `/uipath-coded-apps` | Investigator workbench — the 9 screens. |

The deterministic calculators (`deterministic-calc-v1`: overlap, units-above-POC, unsupported units, thresholds) are packaged as coded functions / library logic consumed by the BPMN and case projects, and are the **only** producers of `RiskSignal.result_value`. HITL nodes (validation + supervisor approval) live inside the Case (P1) and BPMN (P2) projects and surface as Action Center tasks.

## 3. Shared resources (declared once at the solution level)

Declared in the solution so every project binds to the same tenant objects at deploy time:

- **Data Fabric entities** (9, per `docs/03-data-model.md`): `ProgramIntegrityCase`, `Provider`, `Attendant`, `Claim`, `EVVVisit`, `RiskSignal`, `EvidenceDocument`, `InvestigationAction`, `Decision`.
- **Queues:** `pi360-evidence-collection` (evidence pull work items), `pi360-records-intake` (inbound provider responses → resume).
- **Storage buckets:** `pi360-evidence` (source documents: timesheets, POC, notes, personnel packet, correspondence), `pi360-referral-packets` (generated output).
- **Connections:** legacy care-mgmt (RPA target), claims/EVV API endpoints, records-request inbox (Integration Service). Mocked for the demo per `connector-builder/mock-connectors.md`.
- **Assets:** `pi360.unit_rate = 7.20`, `pi360.poc.MBR-33915 = 20`, `pi360.poc.MBR-40122 = 16`, `pi360.autoconfirm_threshold` (IXP), `pi360.sla.intake`, `pi360.roles.investigator = inv.taylor`, `pi360.roles.supervisor = sup.morgan`. (Assets carry demo config so numbers stay in sync with CANON.)
- **Human tasks / Action Center:** validation tasks (Stage 3) and the supervisor approval gate (Stage 7).

## 4. Dependencies & bindings

- **P1 (Case)** is the root; it invokes **P2 (BPMN)** subprocesses, consumes **P6 (Agents)** for narrative, and reads/writes all 9 Data Fabric entities.
- **P2 (BPMN)** invokes **P3 (RPA)** and **P4 (API workflows)** for evidence collection and outbound actions; hosts the records-request wait/resume against the `pi360-records-intake` queue.
- **P5 (IXP)** outputs populate `EvidenceDocument.extracted_fields` / `extraction_confidence`; low-confidence → HITL validation task.
- **P6 (Agents)** are read-only over deterministic outputs; they may **only** reference `RiskSignal`/`Claim`/`EvidenceDocument` values by ID and never write `RiskSignal.computed_by`.
- **P7 (Coded App)** reads all entities via the UiPath TypeScript SDK and renders the 9 screens; it triggers case actions through P1's exposed actions (subject to HITL gates).
- **Binding discipline:** all cross-project references resolve to the **solution-level shared resources** (entities, queues, buckets, connections, assets) — no project hard-codes a tenant object. At deploy, `uip solution` resolves each binding to the `Playground` tenant; unresolved bindings must be set before `activate`.

## 5. Versioning

- Solution version follows **semver** (start `1.0.0`); bump the solution version on any project or resource change so a deploy is reproducible.
- Each bundled project carries its own package version; the solution pins the exact project versions it ships (no floating "latest") so a re-pack is deterministic.
- Tag releases to match CANON revisions; a CANON number change → new solution patch/minor version + re-pack + re-publish.
- Rollback = re-deploy the previous published solution version (see `deploy.md`).

## 6. What "one solution" buys the buyer
A single governed unit to review, approve, deploy, version, and roll back — with every entity, queue, bucket, connection, and human gate declared in one place. Nothing about packaging changes the positioning: deterministic math, grounded agents, human gates on every adverse/financial action, synthetic data.

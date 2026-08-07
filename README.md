# Program Integrity 360

**A UiPath demo: Medicaid Personal Care Services (PCS) program-integrity investigation for State HHS / SLED.**

Program Integrity 360 turns a single claims-analytics alert into an organized, auditable investigation
that a human owns from start to finish. It shows RPA, IDP/IXP, agents, human-in-the-loop, a coded-app
investigator workbench, and Maestro case orchestration working as one system on **one realistic case**.

> ⚠️ **Positioning (non-negotiable in this demo):** the system **identifies risk signals, organizes
> evidence, and routes decisions to humans**. It does **not** make a fraud determination. Deterministic
> code — not the agents — computes every overlap, overage, and unsupported unit. Every adverse or
> financial action is gated by a human approval. All data is **synthetic**.

---

## The case
- **Case:** `PI-PCS-2026-0041` — Harbor Home Support Services (provider), Jordan Ellis (attendant)
- **Program:** Medicaid Personal Care Services
- **Trigger:** claims analytics alert `ALERT-CA-2026-7781`
- **What we find (as risk signals, not conclusions):** an overlapping-visit conflict on 2026-04-14,
  manual EVV entries with no GPS, billed units above the plan of care, timesheet mismatches, and an
  incomplete personnel packet with a lapsed certification.
- **Where it lands:** investigator validates → provider records request + wait state → supervisor
  approves disposition → referral packet + overpayment recovery opened → case closed and provider
  added to monitoring.

Everything about the case (IDs, dates, numbers, math) is fixed in **`CANON.md`** — read that first.

---

## How the pieces fit together

```
                    Claims Analytics Alert (ALERT-CA-2026-7781)
                                     │
              /uipath-api-workflow  ─┤ create case in Data Fabric
                                     ▼
        ┌───────────────  /uipath-maestro-case : PI-PCS-2026-0041  ───────────────┐
        │  (owns the 9-stage lifecycle, gates, SLAs, human tasks)                  │
        │                                                                          │
        │  Stage 2  Evidence collection ── /uipath-maestro-bpmn                     │
        │             ├── /uipath-rpa           pull EVV + Plan of Care (legacy, no API)
        │             ├── /uipath-api-workflow  pull claims + provider enrollment (API)
        │             └── /uipath-platform      land into Data Fabric + storage buckets
        │  Stage 3  Extraction ────────── /uipath-ixp  (timesheets, POC, notes, personnel, corr.)
        │             └── /uipath-human-in-the-loop  validate low-confidence fields
        │  (deterministic calc) ────────  RS-01..RS-05 risk signals + exposure math
        │  Stage 4  Correlation/plan ──── /uipath-agents (Correlation, Planning) — grounded
        │  Stage 5  Investigator review ─ /uipath-human-in-the-loop + /uipath-coded-apps
        │  Stage 6  Records request ───── /uipath-maestro-bpmn + wait state + response intake
        │  Stage 7  Supervisor approval ─ /uipath-human-in-the-loop (adverse/financial gate)
        │  Stage 8  Execute action ────── /uipath-maestro-bpmn (referral packet, recovery, notice)
        │  Stage 9  Closure & monitor ─── /uipath-maestro-bpmn + /uipath-insights
        └──────────────────────────────────────────────────────────────────────────┘
                                     │
      /uipath-coded-apps : "Program Integrity 360" investigator workbench (9 screens)
      /uipath-insights   : operational + program-integrity metrics
      /uipath-solution   : packages all projects into one deployable Program Integrity 360 .uipx
```

The **Summary Agent** drafts the investigator- and supervisor-facing narrative at each human gate,
always labeling **FACT (cited)** vs **INFERENCE (for human review)**.

---

## Repo map
| Path | What's in it | Skill |
|---|---|---|
| `CANON.md` | Single source of truth (read first) | — |
| `docs/` | Outline, architecture, stages, demo script, checklist, skill map, review | `/uipath-planner`, `/uipath-review` |
| `data/` | Synthetic sample data (9 entity JSON files) | `/uipath-platform` |
| `maestro-case/` | Case plan (`caseplan.json`) + task breakdown | `/uipath-maestro-case` |
| `maestro-bpmn/` | 4 deterministic subprocess specs | `/uipath-maestro-bpmn` |
| `rpa/` | Legacy-system pull specs | `/uipath-rpa` |
| `api-workflows/` | Modern API lookup/outbound specs | `/uipath-api-workflow` |
| `ixp/` | Document taxonomy + extraction config | `/uipath-ixp` |
| `agents/` | 4 grounded agent specs + prompts | `/uipath-agents` |
| `hitl/` | Human task designs (validate, exception, approve) | `/uipath-human-in-the-loop` |
| `coded-app/` | Investigator workbench spec + wireframes | `/uipath-coded-apps` |
| `platform/` | Data Fabric, queues, buckets, triggers | `/uipath-platform` |
| `insights/` | Metrics view | `/uipath-insights` |
| `connector-builder/` | Mock external-system connector pattern | `/uipath-connector-builder` |
| `test/` | Test plan + smoke tests | `/uipath-test` |
| `solution/` | Packaging + deploy commands | `/uipath-solution` |

---

## Run it as a live demo
1. Read `docs/04-demo-script.md` — a ~12-minute screen-by-screen narration.
2. Reset state with `docs/05-launch-checklist.md`.
3. Smoke-test with `test/test-plan.md`.

## Deploy it
Target: **cloud.uipath.com**, org **uipathlabs**, tenant **Playground**, folder
**AMER Presales/Public Sector/ProgramIntegrity360**. Solution name **Program Integrity 360**.
Hosted app: **https://uipathlabs.uipath.host/pi360-coded-app**.
See `solution/deploy.md` for the exact `uip login` + `uip solution pack/publish/deploy/activate` sequence.
Deployment requires an interactive browser login and pushes to a live tenant, so it is run by a human
operator, not automatically.

## Why it's defensible for a public-sector buyer
- **Auditability:** every action writes an immutable `InvestigationAction` row; risk signals store their
  exact rule and inputs.
- **Transparency:** the reconciliation screen shows the arithmetic; agents cite sources and separate fact
  from inference.
- **Process control:** Maestro enforces the stage gates and SLAs.
- **Human oversight:** agents recommend, humans decide; adverse/financial actions require supervisor
  approval; the phrase "fraud determination" is never applied to system output.

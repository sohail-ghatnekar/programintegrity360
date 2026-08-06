# Project Structure — Program Integrity 360 (.uipx layout)

*Authored per `/uipath-solution`. The concrete project list, folders, and packed `.uipx` layout.*

> **Read `CANON.md` first.** Names bind to `solution/solution.md`. Synthetic data only.

## 1. On-disk solution workspace

```
program-integrity-360/                      # solution root (uip solution init here)
├── solution.json                           # solution manifest: name, version, projects[], resources[]
├── uipath.json                             # solution-level config (functions map, deterministic-calc-v1)
├── Program Integrity 360.uipx              # packed artifact (output of `uip solution pack`)
│
├── projects/
│   ├── pi360-case/                         # P1 — Maestro Case  (/uipath-maestro-case)
│   │   ├── caseplan.json                   #   9-stage lifecycle of PI-PCS-2026-0041
│   │   ├── project.json
│   │   └── tasks.md
│   │
│   ├── pi360-bpmn-subprocesses/            # P2 — Maestro BPMN  (/uipath-maestro-bpmn)
│   │   ├── evidence-collection.bpmn
│   │   ├── records-request.bpmn            #   outbound + wait/resume
│   │   ├── referral-packet.bpmn
│   │   ├── closure.bpmn
│   │   └── project.json
│   │
│   ├── pi360-rpa-legacy/                   # P3 — RPA  (/uipath-rpa)
│   │   ├── LegacyPocPull.xaml              #   Plan of Care pull (no API)
│   │   ├── project.json
│   │   └── Main.xaml
│   │
│   ├── pi360-api-workflows/                # P4 — API Workflows  (/uipath-api-workflow)
│   │   ├── claims-lookup.json
│   │   ├── evv-lookup.json
│   │   ├── provider-notify.json            #   outbound notification
│   │   └── project.json
│   │
│   ├── pi360-ixp/                          # P5 — IXP  (/uipath-ixp)
│   │   ├── taxonomy.json                   #   timesheet/POC/note/personnel/correspondence
│   │   ├── extraction-config.json
│   │   └── project.json
│   │
│   ├── pi360-agents/                       # P6 — Agents  (/uipath-agents)
│   │   ├── triage-agent/
│   │   ├── evidence-correlation-agent/
│   │   ├── investigation-planning-agent/
│   │   ├── summary-agent/
│   │   └── project.json
│   │
│   └── pi360-app/                          # P7 — Coded App  (/uipath-coded-apps)
│       ├── src/                            #   React/TS, @uipath/uipath-typescript SDK
│       │   └── screens/                    #   the 9 screens (CANON §10)
│       ├── package.json
│       └── project.json
│
├── functions/                              # deterministic-calc-v1 (coded functions)
│   ├── overlap_detect.py                   #   RS-01
│   ├── units_above_poc.py                  #   RS-03
│   ├── unsupported_units.py                #   RS-04
│   ├── manual_nogps.py                     #   RS-02
│   ├── personnel_gap.py                    #   RS-05
│   └── entry-points.json
│
├── resources/                              # solution-level shared resources (declared in solution.json)
│   ├── entities/                           #   9 Data Fabric entity definitions
│   ├── queues/                             #   pi360-evidence-collection, pi360-records-intake
│   ├── buckets/                            #   pi360-evidence, pi360-referral-packets
│   ├── connections/                        #   legacy-care-mgmt, claims-api, evv-api, records-inbox
│   └── assets/                             #   unit_rate=7.20, poc.*, autoconfirm_threshold, roles.*
│
└── data/                                   # synthetic seed data (JSON) — loads into entities for the demo
    ├── cases.json  providers.json  attendants.json
    ├── claims.json  evv_visits.json  risk_signals.json
    ├── evidence_documents.json  investigation_actions.json  decisions.json
```

## 2. Project list (summary)

| ID | Folder | Type | Package version | Depends on |
|---|---|---|---|---|
| P1 | `projects/pi360-case` | Maestro Case | 1.0.0 | P2, P6, entities |
| P2 | `projects/pi360-bpmn-subprocesses` | Maestro BPMN | 1.0.0 | P3, P4, functions, queues |
| P3 | `projects/pi360-rpa-legacy` | RPA | 1.0.0 | legacy-care-mgmt connection, buckets |
| P4 | `projects/pi360-api-workflows` | API Workflow | 1.0.0 | claims-api, evv-api, records-inbox connections |
| P5 | `projects/pi360-ixp` | IXP | 1.0.0 | buckets, entities |
| P6 | `projects/pi360-agents` | Agents | 1.0.0 | entities (read-only) |
| P7 | `projects/pi360-app` | Coded App | 1.0.0 | entities, P1 actions |

## 3. Packed `.uipx` layout (conceptual)

```
Program Integrity 360.uipx
├── [Content_Types].xml
├── solution.manifest              # name "Program Integrity 360", version 1.0.0
├── projects/                      # each project as its own nested package (P1–P7, pinned versions)
├── resources.manifest             # entities, queues, buckets, connections, assets + binding refs
└── deploy.metadata                # target hints; actual tenant resolved at deploy/activate
```

## 4. Notes
- All 7 projects and all shared resources are declared in `solution.json`; `uip solution pack` pins each project's exact version so the `.uipx` re-packs deterministically.
- `data/*.json` is **synthetic seed data** only, loaded to make the single canonical case (PI-PCS-2026-0041) demo-ready; it is not part of the runtime logic.
- The deterministic `functions/` are the sole producers of risk-signal math (`computed_by = deterministic-calc-v1`); agents never appear in that path.

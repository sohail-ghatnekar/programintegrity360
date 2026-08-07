# Platform Plumbing — Data Fabric, Orchestrator & Integration Surface

> Authored per `/uipath-platform`. The operational substrate under **Program Integrity 360** (case **PI-PCS-2026-0041**): the 9 Data Fabric entities, Orchestrator queues / storage buckets / triggers / jobs, the folder + role model, and the assets/credentials for the mocked legacy systems.
>
> **This document specifies `uip df` / `uip or` / `uip resource` operations as on-disk notes.** Deploy target: org **`uipathlabs`**, tenant **`Playground`**, folder **`AMER Presales/Public Sector/ProgramIntegrity360`**, API base `https://api.uipath.com` (see `../solution/deploy.md`). Every ID/number matches `CANON.md`.
>
> **Positioning.** This layer *stores and moves* data. It computes no risk signals and makes no determination. `deterministic-calc-v1` does the math; the Stage 5 / Stage 7 human gates do the deciding. **Synthetic data only.**

---

## 0. Folder structure (Orchestrator)

A single **Solution folder** houses everything; a personal/dev folder is used for debug runs.

```
Playground (tenant)
└── AMER Presales
    └── Public Sector
        └── ProgramIntegrity360     ← Solution folder (created by solution deploy)
            ├── Processes        (API workflows, RPA robots, BPMN subprocesses, coded-app deployment target)
            ├── Queues           (pi-evidence-collection, pi-document-extraction, pi-human-review,
            │                     pi-recovery-writeback, pi-closure)
            ├── Storage Buckets  (pi-evidence)
            ├── Triggers         (tr-intake-alert, tr-records-response, tr-* queue triggers)
            ├── Assets           (mock-system URLs, IXP thresholds, SLA config, rate)
            ├── Credentials      (CareMgmt_*, EvvPortal_*, mock-api-key, records-inbox-*)
            └── Data Fabric      (tenant-scoped — 9 entities, see §1; folder-scoped writes via --folder-key)
```

Notes:
- **Data Fabric entities are tenant-level**, not folder-bound; writes from folder-scoped automations pass `--folder-key <Program Integrity 360 GUID>`.
- The coded app (`Program Integrity 360`) deploys to this folder via `uip codedapp deploy --folder-key <GUID>` (separate lifecycle from the solution — coded apps are not `.uipx` members).
- Resolve the folder GUID with `uip or folders list --output json` (match `Name == "Program Integrity 360"`, read `Key`). **Do not run here** — recorded for the deploy step.

---

## 1. Data Fabric entities (the 9 from the data model)

Nine entities per `docs/03-data-model.md` §1–9. Below: `uip df`-style **create notes** (author-time, not executed) with each field's DF **field data type**. Choice fields carry a shared choice set (§1a). Every write elsewhere in the system also appends an `InvestigationAction` (§1, entity 8).

> **Create pattern (illustrative, do NOT run):**
> `uip df entities create --name ProgramIntegrityCase --display-name "Program Integrity Case" --output json`
> then add fields with `uip df entities add-fields <ENTITY_ID> --file <fields.json>`.
> Choice fields reference a choice set by id (`CHOICE_SET_SINGLE`); multi-value doc lists use `CHOICE_SET_MULTIPLE` or a `STRING`/`MULTILINE_TEXT`. `FILE`-typed fields are written only via `uip df files upload` (record writes silently strip FILE values).

### 1a. Choice sets (shared enumerations — create first)

`uip df choice-sets create --name <cs> ...`. Choice values use immutable integer `NumberId`s (the SDK/app translates name↔numberId).

| Choice set | Values |
|---|---|
| `cs_program` | Medicaid PCS |
| `cs_trigger_type` | Claims Analytics Alert, Provider Complaint, Data Match, Referral |
| `cs_priority` | High, Medium, Low |
| `cs_case_stage` | Alert intake & triage, Automated evidence collection, Document extraction & validation, Evidence correlation & investigation planning, Investigator human review, Provider records request & wait state, Supervisor approval / disposition, Approved action execution, Closure & monitoring |
| `cs_case_status` | Open, In Review, Awaiting Provider, Pending Approval, Closed |
| `cs_claim_status` | Under Review, Cleared, Flagged |
| `cs_capture_method` | Mobile-GPS, Telephony, Manual |
| `cs_gps_confirmed` | Yes, No, N/A |
| `cs_severity` | High, Medium, Low |
| `cs_doc_type` | Timesheet, Plan of Care, Service Note, Personnel Packet, Correspondence |
| `cs_validation_status` | Auto-confirmed, Needs review, Human-validated |
| `cs_action_type` | Case created, Signal computed, Agent output, Doc extracted, Human validated, Edit, Decision, Request sent, Response received, Approval, Action executed |
| `cs_actor_kind` | Human, System, Agent |
| `cs_decision_type` | Proceed to records request, Refer for audit + open overpayment recovery, Refer for audit, Open overpayment recovery, Provider education, Close — no action |
| `cs_decision_role` | Investigator, Supervisor |

### 1b. Entities & fields

**1. `ProgramIntegrityCase`** (root aggregate)
| Field | DF type | Notes |
|---|---|---|
| case_id | STRING | `PI-PCS-2026-0041` (business key) |
| title | STRING | |
| program | CHOICE_SET_SINGLE → cs_program | Medicaid PCS |
| trigger_type | CHOICE_SET_SINGLE → cs_trigger_type | Claims Analytics Alert |
| trigger_ref | STRING | `ALERT-CA-2026-7781` |
| provider_id | STRING | FK → Provider |
| attendant_id | STRING | FK → Attendant |
| service_period_start / _end | DATE | 2026-03-01 / 2026-05-31 |
| priority | CHOICE_SET_SINGLE → cs_priority | High |
| stage | CHOICE_SET_SINGLE → cs_case_stage | |
| status | CHOICE_SET_SINGLE → cs_case_status | |
| risk_signal_count | INTEGER | 5 |
| potential_exposure_low | DECIMAL(2) | 172.80 |
| potential_exposure_period_estimate | DECIMAL(2) | 1600.00 (headline "≈ $1,600"; not in data-model doc — see §9 note) |
| potential_exposure_high | DECIMAL(2) | 42000.00 |
| exposure_disclaimer | STRING | non-determination text |
| assigned_investigator | STRING | inv.taylor |
| assigned_supervisor | STRING | sup.morgan |
| alert_date | DATE | 2026-07-20 |
| opened_at | DATETIME_WITH_TZ | 2026-07-22T09:12:00Z |
| sla_due | DATETIME_WITH_TZ | 2026-08-05T17:00:00Z |

*(DF auto-manages CreateTime/UpdateTime — domain timestamps use the explicit fields above.)*

**2. `Provider`** — provider_id (STRING key), name, medicaid_provider_id, npi, address (STRING); enrollment_status (STRING/CHOICE); active_attendant_count (INTEGER, 22); prior_integrity_history (STRING); watch_list (BOOLEAN, set true at closure).

**3. `Attendant`** — attendant_id (key), name, provider_id (FK), role, credential_id (`PCA-556210`), credential_expiry (DATE, 2026-03-31), personnel_docs_complete (BOOLEAN, false), missing_docs (CHOICE_SET_MULTIPLE or MULTILINE_TEXT — ["Signed training acknowledgment","Current background-check attestation"]).

**4. `Claim`** — claim_id (key), case_id (FK), attendant_id (FK), member_id, date_of_service (DATE), units_billed (INTEGER), unit_rate (DECIMAL, 7.20), billed_amount (DECIMAL), evv_supported_units (INTEGER), timesheet_supported_units (INTEGER), poc_daily_units (INTEGER), improper_units (INTEGER — deterministic), status (CHOICE → cs_claim_status). 9 rows.

**5. `EVVVisit`** — evv_id (key), attendant_id (FK), member_id, service_date (DATE), start_time / end_time (STRING `HH:MM`; DF has no TIME type — store as STRING or DATETIME), units (INTEGER), capture_method (CHOICE → cs_capture_method), gps_confirmed (CHOICE → cs_gps_confirmed), overlaps_with (STRING — set by RS-01 calc). 12-row sample of the 44-visit period.

**6. `RiskSignal`** — signal_id (key), case_id (FK), name (STRING), rule_expression (MULTILINE_TEXT), inputs (MULTILINE_TEXT / JSON string), result_value (MULTILINE_TEXT), severity (CHOICE → cs_severity), computed_by (STRING — always `deterministic-calc-v1`), computed_at (DATETIME_WITH_TZ). 5 rows (RS-01..RS-05).

**7. `EvidenceDocument`** — doc_id (key), case_id (FK), doc_type (CHOICE → cs_doc_type), source_system (STRING), storage_uri (STRING — `pi-evidence` bucket path), extracted_fields (MULTILINE_TEXT / JSON), extraction_confidence (DECIMAL/FLOAT 0–1), validation_status (CHOICE → cs_validation_status), validated_by (STRING), **source_file (FILE — optional inline attachment; written via `uip df files upload`, never via record insert)**. 6 rows.

**8. `InvestigationAction`** (append-only audit) — action_id (key), case_id (FK), action_type (CHOICE → cs_action_type), actor (STRING), actor_kind (CHOICE → cs_actor_kind), timestamp (DATETIME_WITH_TZ), detail (MULTILINE_TEXT), before_value / after_value (MULTILINE_TEXT / JSON). 14 rows (ACT-0001..ACT-0014). **No update/delete in normal operation** — appended by every mutating automation and human action.

**9. `Decision`** — decision_id (key), case_id (FK), decision_type (CHOICE → cs_decision_type), recommended_by (STRING — e.g. `Investigation Planning Agent`), decided_by (STRING — supervisor/investigator id), decision_role (CHOICE → cs_decision_role), rationale (MULTILINE_TEXT), adverse_or_financial (BOOLEAN — true → supervisor gate), approved (BOOLEAN), decided_at (DATETIME_WITH_TZ). 2 rows (DEC-0001 investigator non-adverse; DEC-0002 supervisor adverse/approved).

> **Seeding.** Basic field types load via `uip df records import <ENTITY_ID> --file data/<entity>.csv`. Complex fields (CHOICE_SET, FILE, JSON) require `uip df records insert <ENTITY_ID> --file <json>` with choice values translated to `NumberId`. The repo's `data/*.json` are the canonical seed payloads. Do NOT run here.

---

## 2. Storage buckets

### `pi-evidence` — source documents & raw exports
`uip or bucket create --name pi-evidence` (in the Program Integrity 360 folder). One folder prefix per case: `PI-PCS-2026-0041/`.

| Object | Written by | Consumed by |
|---|---|---|
| `PI-PCS-2026-0041/timesheet_0416.pdf` | RPA/portal intake (Stage 2) | IXP (Stage 3), Evidence Studio preview (`DOC-TS-0416`) |
| `PI-PCS-2026-0041/timesheet_0519.pdf` | portal intake | IXP, Evidence Studio (`DOC-TS-0519`) |
| `PI-PCS-2026-0041/poc_MBR-33915.pdf` | `PullPlanOfCare.xaml` (RPA) | IXP, Evidence Studio (`DOC-POC-33915`) |
| `PI-PCS-2026-0041/servicenote_0414.pdf` | portal intake | IXP, Evidence Studio (`DOC-SN-0414`) |
| `PI-PCS-2026-0041/personnel_ATT-2087.pdf` | provider records request | IXP, Evidence Studio (`DOC-PP-2087`) |
| `PI-PCS-2026-0041/provider_response.pdf` | Stage 6 response intake | IXP, Provider Response screen (`DOC-CORR-01`) |
| `PI-PCS-2026-0041/evv_ATT-2087.csv` | `PullEvvVisits.xaml` (RPA) | evidence-collection.bpmn land step |

- Upload: `uip or bucket-files upload pi-evidence <local> PI-PCS-2026-0041/<name>` (do NOT run).
- Coded-app read: SDK `Buckets.getReadUri('pi-evidence','PI-PCS-2026-0041/<name>')` for the Evidence Studio / Provider Response previews. Each `EvidenceDocument.storage_uri` points here.
- Least privilege: only the RPA robot account and the collection/intake processes get write; the coded app + investigators get read.

---

## 3. Orchestrator queues

Queues buffer the per-record work each stage produces so it is retryable and auditable. Every processed item ends by appending an `InvestigationAction`.

| Queue | Feeds stage | Producer | Consumer | Item payload |
|---|---|---|---|---|
| `pi-evidence-collection` | Stage 2 | `tr-intake-alert` → intake API workflow | `evidence-collection.bpmn` service tasks (claims API pull, `PullPlanOfCare.xaml`, `PullEvvVisits.xaml`, land-to-DF) | `{ caseId, source: claims|evv|poc|docs, providerId, attendantId, servicePeriod }` |
| `pi-document-extraction` | Stage 3 | evidence-collection land step (one item per document in `pi-evidence`) | IXP extraction process `pcs-document-extraction`; low-confidence/sensitive items branch to `pi-human-review` | `{ caseId, docId, storageUri, docType }` |
| `pi-human-review` | Stages 3, 5, 7 | IXP (low-confidence/sensitive), Stage-4 completion, Stage-6 completion | Action Center HITL tasks surfaced in the coded app (validation, investigator review, supervisor approval) | `{ caseId, taskKind: extraction-validation|investigator-review|supervisor-approval, ref }` |
| `pi-recovery-writeback` | Stage 8 | `referral-packet.bpmn` (only after supervisor approval) | recovery-record API workflow + legacy write-back RPA | `{ caseId, decisionId: DEC-0002, confirmedUnits: 24, amount: 172.80 }` |
| `pi-closure` | Stage 9 | `referral-packet.bpmn` end / Stage-7 reject | `closure.bpmn` (watch-list flag, Insights metrics, final audit) | `{ caseId, disposition: executed|close-no-action }` |

- Create: `uip or queue create --name pi-evidence-collection --folder-key <GUID>` (do NOT run).
- **SpecificData / retry:** default max retries 2 on transient faults; poison items surface to `inv.taylor`. `pi-recovery-writeback` items are created **only** when `Decision.adverse_or_financial == true AND approved == true` (Stage 7 gate) — the queue is empty until the supervisor approves, which is where the financial gate is physically enforced in the plumbing.

---

## 4. Triggers

| Trigger | Kind | Fires | Starts | Notes |
|---|---|---|---|---|
| `tr-intake-alert` | External/API (IS connector `Get Alert`) | claims-analytics alert `ALERT-CA-2026-7781` lands (alert date 2026-07-20) | `IntakeAlertCreateCase` API workflow → creates `ProgramIntegrityCase`, enqueues `pi-evidence-collection` | Stage 1 entry. Backed by the `design-uipathlabs-pi360-mock` connector's **Get Alert** activity (`../connector-builder/mock-connectors.md`). |
| `tr-records-response` | External/message (IS connector `Get Provider Response`) | provider response `DOC-CORR-01` arrives in the records-request inbox (received 2026-07-28) | `records-request.bpmn` receive/wait event → intake to `pi-evidence`, write `EvidenceDocument`, re-run correlation, advance Stage 6→7 | Correlates to `PI-PCS-2026-0041` via the case's open records request; satisfies the Stage-6 wait state. Timer boundary **P15D** escalates to `sup.morgan` on expiry. |
| `tr-q-evidence-collection` | Queue trigger | new `pi-evidence-collection` item | evidence-collection service task job | one job per source item |
| `tr-q-document-extraction` | Queue trigger | new `pi-document-extraction` item | IXP `pcs-document-extraction` job | branches low-confidence to `pi-human-review` |
| `tr-q-recovery-writeback` | Queue trigger | new `pi-recovery-writeback` item | recovery + legacy write-back jobs | only populated post-approval |
| `tr-q-closure` | Queue trigger | new `pi-closure` item | `closure.bpmn` job | watch-list + metrics + final audit |

- Time triggers: none required for the demo (event/queue-driven). SLA timers (`PT4H`, `P1D`, `P2D`, `P3D`, `P15D`) live on the Maestro case stages (`../docs/02-case-stages.md`), not Orchestrator schedules.
- Create: `uip or triggers create ...` (do NOT run). The two external triggers (`tr-intake-alert`, `tr-records-response`) depend on pinged IS connections (§7).

---

## 5. Jobs / processes (deployable units)

| Process (Orchestrator) | Skill / artifact | Stage | Trigger/queue |
|---|---|---|---|
| `IntakeAlertCreateCase` | `/uipath-api-workflow` (`intake-alert`) | 1 | `tr-intake-alert` |
| `evidence-collection` | `/uipath-maestro-bpmn` (`evidence-collection.bpmn`) | 2 | `pi-evidence-collection` |
| `PullPlanOfCare` | `/uipath-rpa` (`PullPlanOfCare.xaml`) | 2 | called by evidence-collection |
| `PullEvvVisits` | `/uipath-rpa` (`PullEvvVisits.xaml`) | 2 | called by evidence-collection |
| `pcs-document-extraction` | `/uipath-ixp` | 3 | `pi-document-extraction` |
| `SendProviderRecordsRequest` / `records-request` | `/uipath-api-workflow` + `/uipath-maestro-bpmn` (`records-request.bpmn`) | 6 | Stage-5 decision; waits on `tr-records-response` |
| `referral-packet` | `/uipath-maestro-bpmn` (`referral-packet.bpmn`) | 8 | `pi-recovery-writeback` (post-approval) |
| `closure` | `/uipath-maestro-bpmn` (`closure.bpmn`) | 9 | `pi-closure` |
| `Program Integrity 360` (coded app) | `/uipath-coded-apps` | 3,5,7 (HITL surfaces) | deployed to folder; reads DF + tasks |

Agents (`Triage`, `Evidence Correlation`, `Investigation Planning`, `Summary`) run within Stages 1/4/5/7 per `caseplan.json`; they read DF and write agent-output `InvestigationAction` rows — they enqueue nothing and decide nothing.

**Runtimes:** starting jobs requires the folder to have machine templates with Unattended runtimes assigned (else Orchestrator error 2818). Recorded for deploy; not run here.

---

## 6. Roles & permissions (least privilege)

Two human roles + one system/robot role, mirroring `caseplan.json` `roles[]` and enforced in the coded app's gate.

| Role | Identity | Entities (DF) | Queues | Tasks (Action Center) | Adverse/financial |
|---|---|---|---|---|---|
| **OPI Investigator** | `inv.taylor` | Read all; **Write** `EvidenceDocument.validation_status/validated_by`, `Decision` (non-adverse), `InvestigationAction` (append) | View all; process `pi-human-review` (validation, investigator-review) | Complete validation + investigator-review tasks | **No** — cannot approve `adverse_or_financial` dispositions |
| **OPI Supervisor** | `sup.morgan` | Read all; Write `Decision` (incl. adverse/financial), `InvestigationAction` (append) | View all; process `pi-human-review` (supervisor-approval) | Complete supervisor-approval tasks | **Yes** — sole approver of `adverse_or_financial == true` |
| **System / robot** (`deterministic-calc-v1`, RPA/API/BPMN processes) | robot account | Write source entities + `RiskSignal` + exposure + `InvestigationAction`; **never** writes `Decision` | Produce/consume all `pi-*` queues | — | **Never decides** |

- Custom Orchestrator roles: `PI360-Investigator`, `PI360-Supervisor`, `PI360-Robot`. Author with `uip admin` (Authorization) — see `/uipath-admin`; recorded here, not run.
- **The financial gate is enforced in three places, defense-in-depth:** (1) the coded app disables adverse/financial buttons for non-supervisors (`<GatedButton requires="supervisor">`); (2) the Stage-7 HITL task is assigned only to `sup.morgan`; (3) `pi-recovery-writeback` items are created only after `Decision.approved == true`, so no execution job can start without the supervisor's approved decision.
- Members appear by initials only (R.A., T.N.); case is Restricted / investigative work product.

---

## 7. Assets & credentials (mocked legacy systems)

Assets (`uip or assets create ...`) and credentials (`uip or assets create --type Credential ...`) in the Program Integrity 360 folder. **Values below are placeholders for synthetic mocks — no real secret.** Do NOT run.

| Name | Type | Value / purpose | Used by |
|---|---|---|---|
| `CareMgmt_Url` | Text | `https://mock-caremgmt.local/login` | `PullPlanOfCare.xaml` |
| `CareMgmt_Cred` | Credential | mock care-mgmt login (user+password) | `PullPlanOfCare.xaml` (never inline) |
| `EvvPortal_Url` | Text | `https://mock-evv.local/portal` | `PullEvvVisits.xaml` |
| `EvvPortal_Cred` | Credential | mock EVV portal login | `PullEvvVisits.xaml` |
| `PI360_Mock_ApiKey` | Credential/Secret | header API key for the `design-uipathlabs-pi360-mock` IS connector | alert + records-inbox activities |
| `PI360_Mock_BaseUrl` | Text | `https://mock-pi360.local/api/v1` | IS connector base URL |
| `IXP_AutoConfirm_Threshold` | Integer/Text | `0.85` — confidence ≥ auto-confirms; below routes to `pi-human-review` | `pcs-document-extraction` |
| `PCS_Unit_Rate` | Text | `7.20` (blended $/unit) — read by `deterministic-calc-v1` for exposure math | evidence-collection.bpmn |
| `Case_SLA_Config` | Text | stage SLA map (PT4H/P1D/P2D/P3D/P15D) | case lifecycle |

**Integration Service connection:** the `design-uipathlabs-pi360-mock` connector needs one **pinged connection** (UUID) created via `uip is connections create <connector-key>`; the two external triggers (`tr-intake-alert`, `tr-records-response`) and the API workflows bind to that connection UUID. Credentials for the connection use `customApiKey` (the `PI360_Mock_ApiKey` secret), supplied at connection time — the connector stores only the auth *type*, never the key (`/uipath-connector-builder` Rule 9).

**Legacy-system integration recap** (why each surface uses what — from `../connector-builder/mock-connectors.md` / `../rpa/legacy-pulls.md`):
- Care-management + EVV portal → **no API** → RPA UI automation (credential assets above).
- Alert source + records inbox → **REST/JSON** → IS connector (API-key connection above).

---

## 8. Stage → plumbing map (end to end)

| Stage | Automation | Trigger/Queue | DF writes | Bucket | Human gate |
|---|---|---|---|---|---|
| 1 Intake & triage | `IntakeAlertCreateCase` (API) + Triage Agent | `tr-intake-alert` | `ProgramIntegrityCase` (Open), `InvestigationAction` ACT-0001; Triage rationale ACT-0003 | — | — |
| 2 Evidence collection | `evidence-collection.bpmn` + `PullPlanOfCare`/`PullEvvVisits` (RPA) + claims API + `deterministic-calc-v1` | `pi-evidence-collection` | `Claim[]`, `EVVVisit[]`, `EvidenceDocument[]`, `RiskSignal[]` (RS-01..05), exposure fields, ACT-0002 | write POC pdf, EVV csv, timesheets, service note | — |
| 3 Extraction & validation | `pcs-document-extraction` (IXP) | `pi-document-extraction` → `pi-human-review` | `EvidenceDocument.extracted_fields/confidence/validation_status`, ACT-0004/ACT-0005 | read docs | **Investigator** validates <0.85 & sensitive (DOC-TS-0416, DOC-PP-2087) |
| 4 Correlation & planning | Evidence Correlation + Investigation Planning agents | — | agent-output `InvestigationAction` ACT-0006/ACT-0007 | — | — |
| 5 Investigator review | Summary Agent + coded-app Decision Center | `pi-human-review` (investigator-review) | `Decision` DEC-0001 (non-adverse), edit ACT-0008, ACT-0009 | — | **Investigator** decides "Proceed to records request" |
| 6 Records request & wait | `records-request.bpmn` (API send + wait) | Stage-5 decision; `tr-records-response`; status→Awaiting Provider | `EvidenceDocument` DOC-CORR-01, ACT-0010 (Request sent), ACT-0011 (Response received) | write `provider_response.pdf` | wait state (P15D → escalate `sup.morgan`) |
| 7 Supervisor approval | Summary Agent v2 + coded-app Decision Center (gated) | `pi-human-review` (supervisor-approval) | `Decision` DEC-0002 (adverse, approved), ACT-0012 (summary v2), ACT-0013 (Approval) | — | **Supervisor** approves adverse/financial |
| 8 Execution | `referral-packet.bpmn` + recovery API + legacy write-back RPA | `pi-recovery-writeback` (only if approved) | recovery record (24 units × $7.20 = $172.80), ACT-0014 (Action executed) | — | — (executes only what was approved) |
| 9 Closure & monitoring | `closure.bpmn` + Insights | `pi-closure` | case status→Closed, `Provider.watch_list=true`, final `InvestigationAction`, Insights metrics | — | — |

Consistency check: this matches `docs/02-case-stages.md`, `maestro-case/caseplan.json`, and the four `maestro-bpmn/*.bpmn.md` subprocesses. The reviewed-sample recovery basis is **24 units × $7.20 = $172.80**; reviewed-period projection **≈ $1,600**; provider-wide indicative **$18K–$42K pending audit** — always paired with the non-determination disclaimer.

---

## 9. Data-model / fixture notes for the deploy team

1. **`potential_exposure_period_estimate` (≈ $1,600)** exists in `data/cases.json` and is used for the demo headline, but `docs/03-data-model.md` §1 documents only `potential_exposure_low` / `potential_exposure_high`. Add this third field to the `ProgramIntegrityCase` schema (done in §1b above) or the headline number has no home. **Flag for reconciliation.**
2. **Case `stage`/`status` vs. timeline.** `data/cases.json` has `stage = "Investigator human review"` (Stage 5) / `status = "In Review"`, but `data/investigation_actions.json` already contains supervisor approval (ACT-0013) and executed action (ACT-0014) — i.e., the case has actually reached Stage 8. Also, no `InvestigationAction` records the transition into `Pending Approval` that ACT-0013's `before_value` implies. Reconcile the case header (advance to Stage 8/9) or trim the timeline before the live demo so stage, status, and audit trail agree. **Flag for reconciliation.**
3. **Time fields.** DF has no native `TIME` type; `EVVVisit.start_time/end_time` are stored as `STRING` (`HH:MM`). The RS-01 overlap (10:30–12:00 = 90 min) is computed by `deterministic-calc-v1` from these strings; the app renders them verbatim.
4. **Choice values as NumberId.** All seed inserts must translate choice labels to `NumberId` (per §1a); the `data/*.json` files store labels for readability — the import step maps them.

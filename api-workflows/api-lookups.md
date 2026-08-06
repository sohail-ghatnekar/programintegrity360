# API Workflows — Modern Lookups & Outbound Actions

> Authoring skill: **`/uipath-api-workflow`** (UiPath API Workflows — JSON, CNCF Serverless Workflow
> DSL 1.0.0, `Type: "Api"` projects run by `uip api-workflow run`).
> Related: **`/uipath-maestro-bpmn`** / **`/uipath-maestro-case`** (invoke these as service tasks),
> **`/uipath-connector-builder`** (the alert source + records inbox connectors these call),
> **`/uipath-platform`** (Data Fabric reads/writes).
>
> **Positioning.** These workflows *move data and open records*. They receive an alert, read claims and
> enrollment, and open outbound requests/records **after a human approval gate**. They compute no risk
> signals and make no determination. Every mutation also appends an `InvestigationAction`. **Synthetic
> data throughout.**

Each workflow below is authored per `/uipath-api-workflow`: one root `Sequence` whose `do[]` begins with
`WorkflowStart`, activities from {Assign, JavaScript, If (`#Wrapper`/`#Then`/`#Else`), ForEach, HTTP /
connector via `registry resolve`+`stub`, Response}. Inputs are read as `$workflow.input.<name>`;
connector output is read from `$context.outputs.<ExportBucketKey>.content.<field>`. Outbound connector
calls (`UiPath.IntSvc`) need a pinged connection — the alert source and records inbox come from the
custom connector in [`../connector-builder/mock-connectors.md`](../connector-builder/mock-connectors.md).

---

## Summary

| # | Workflow | Trigger | Kind | Data Fabric R/W | Stage |
|---|---|---|---|---|---|
| a | `IntakeAlertCreateCase` | Alert received (`ALERT-CA-2026-7781`) | HTTP/connector in → DF write | **Write** `ProgramIntegrityCase` (+ Provider/Attendant upsert) | 1 |
| b | `PullClaims` | Called by evidence-collection BPMN | HTTP (claims DW) → DF write | **Write** `Claim` ×9 | 2 |
| c | `LookupProviderEnrollment` | Called by intake/evidence | HTTP (enrollment) → DF write | **Write** `Provider` | 1–2 |
| d | `SendProviderRecordsRequest` | Investigator decision (Stage 6) | connector out (records inbox) | **Read** case/attendant; **Write** `InvestigationAction` | 6 |
| e | `OpenOverpaymentRecovery` | **Supervisor approval** (Stage 8) | connector out (recovery API) | **Read** `Decision`; **Write** `InvestigationAction` | 8 |

> **d** and **e** are the adverse/financial actions — both are gated. `d` fires only after the
> investigator proceeds (`/uipath-human-in-the-loop`); `e` fires only after the supervisor approves an
> `adverse_or_financial = true` `Decision`. The workflow re-checks `approved == true` before any
> outbound call.

---

## a. `IntakeAlertCreateCase`

**Trigger.** Receives the claims-analytics alert payload `ALERT-CA-2026-7781` (dated **2026-07-20**) via
the alert-source connector / inbound HTTP. Opens the case on **2026-07-22**.

**do[] outline**
1. `WorkflowStart`
2. `Assign` — `alertId = $workflow.input.alertId` (`"ALERT-CA-2026-7781"`)
3. `JavaScript_ParsePayload` — read `providerId`, `attendantId`, `servicePeriod` from the alert body;
   `return` a normalized object. (Parse only — no scoring.)
4. `If_ValidAlert#Wrapper` — `when: "${$context.outputs.Javascript_ParsePayload.alertId.length > 0}"`
   - `#Then` — create the case (step 5), `then: "exit"`
   - `#Else` — `Response` marks the job failed, `then: "end"`
5. Connector/HTTP **Create Entity Record → `ProgramIntegrityCase`** (Data Fabric write)
6. `Response` — `"${{ caseId: 'PI-PCS-2026-0041', status: 'Open' }}"`, `then: "end"`

**Request (alert payload)**
```json
{ "alertId": "ALERT-CA-2026-7781", "alertDate": "2026-07-20", "model": "batch-anomaly",
  "providerId": "PRV-100482", "attendantId": "ATT-2087",
  "servicePeriod": { "start": "2026-03-01", "end": "2026-05-31" } }
```
**Response**
```json
{ "caseId": "PI-PCS-2026-0041", "status": "Open", "createdAt": "2026-07-22" }
```
**Writes** `ProgramIntegrityCase`: `case_id=PI-PCS-2026-0041`, `title="Harbor Home Support Services — PCS
billing integrity review"`, `program="Medicaid PCS"`, `trigger_type="Claims Analytics Alert"`,
`trigger_ref="ALERT-CA-2026-7781"`, `provider_id=PRV-100482`, `attendant_id=ATT-2087`,
`service_period_start=2026-03-01`, `service_period_end=2026-05-31`, `stage=1 (Alert intake & triage)`,
`status="Open"`. Priority `High` is explained by the Triage Agent (CANON §8) — the workflow stores the
value the triage stage produces; it does not re-score. Appends `InvestigationAction`
(`action_type="Response received"`/case-created, `actor_kind=System`).

---

## b. `PullClaims`

**Trigger.** Service task called by `evidence-collection.bpmn` (Stage 2).

**do[] outline**
1. `WorkflowStart`
2. `Assign` — `caseId`, `attendantId`, service-period dates from `$workflow.input`
3. HTTP **GET claims** from the claims data-warehouse API (query by attendant + period)
4. `Assign` — `claims = $context.outputs.<bucket>.content.claims`
5. `ForEach` over `claims` → `#Body`: Create Entity Record **`Claim`** (Data Fabric write), one per claim
6. `Response` — `"${{ count: 9, deDupImproperUnits: 24 }}"`, `then: "end"`

**Request** `GET /claims?attendantId=ATT-2087&from=2026-03-01&to=2026-05-31`
**Response** — the **9 claims** (CANON §3 / `data/claims.json`), verbatim:

| Claim | DOS | Member | Billed | EVV sup. | TS sup. | Improper | Status |
|---|---|---|---|---|---|---|---|
| CLM-0468 | 2026-03-03 | MBR-33915 | 16 | 16 | 16 | 0 | Cleared |
| CLM-0475 | 2026-03-10 | MBR-33915 | 16 | 16 | 16 | 0 | Under Review |
| CLM-0491 | 2026-04-14 | MBR-33915 | 24 | 16 | 16 | **8** | Flagged |
| CLM-0492 | 2026-04-14 | MBR-40122 | 14 | 14 | 14 | 0 | Under Review |
| CLM-0503 | 2026-04-16 | MBR-33915 | 24 | 24 | 16 | **8** | Flagged |
| CLM-0517 | 2026-04-21 | MBR-33915 | 18 | 18 | 18 | 0 | Cleared |
| CLM-0528 | 2026-04-28 | MBR-33915 | 20 | 20 | 20 | 0 | Under Review |
| CLM-0540 | 2026-05-19 | MBR-33915 | 24 | 24 | 20 | **4** | Flagged |
| CLM-0549 | 2026-05-26 | MBR-33915 | 20 | 16 | 16 | **4** | Flagged |

> The workflow **stores** `evv_supported_units`, `timesheet_supported_units`, and `improper_units` as
> received from the warehouse extract; the de-duplicated total (8+8+4+4 = **24 units**) is computed by
> `deterministic-calc-v1`, not by this workflow. The claim rows are the inputs to RS-03 / RS-04.

**Writes** `Claim` ×9 (each `case_id=PI-PCS-2026-0041`, `attendant_id=ATT-2087`, `unit_rate=7.20`).
Appends `InvestigationAction` per batch.

---

## c. `LookupProviderEnrollment`

**Trigger.** Called during intake/evidence to enrich the provider record.

**do[] outline**
1. `WorkflowStart`
2. `Assign` — `providerId = $workflow.input.providerId` (`"PRV-100482"`)
3. HTTP **GET provider enrollment** by internal id / MPI / NPI
4. `If_Active#Wrapper` — branch on `enrollment_status`; `#Then` upsert, `#Else` flag for manual check
5. Create/Update Entity Record **`Provider`** (Data Fabric write)
6. `Response` — enrollment summary, `then: "end"`

**Request** `GET /providers/PRV-100482` (also resolvable by `MPI-4471902` / NPI `1730456789`)
**Response**
```json
{ "provider_id": "PRV-100482", "name": "Harbor Home Support Services",
  "medicaid_provider_id": "MPI-4471902", "npi": "1730456789",
  "address": "2200 Marina Blvd, Suite 210", "enrollment_status": "Active",
  "active_attendant_count": 22, "prior_integrity_history": "1 education letter (2024), no sanctions" }
```
**Writes** `Provider` (all fields above; `watch_list=false` until closure).

---

## d. `SendProviderRecordsRequest`  (outbound — gated)

**Trigger.** Fires only after the **investigator decides to proceed** (Stage 6,
`/uipath-human-in-the-loop`). The workflow reads the case posture and asserts the human gate before
sending.

**do[] outline**
1. `WorkflowStart`
2. Read Entity Record **`ProgramIntegrityCase`** + **`Attendant`** (Data Fabric read) — need
   `ATT-2087` / Jordan Ellis and the requested doc list (personnel packet, timesheets, service notes).
3. `If_ProceedApproved#Wrapper` — `when: "${$workflow.input.investigatorProceed === true}"`
   - `#Else` → `Response` job failed ("human gate not satisfied"), `then: "end"`
4. Connector **Post Records Request** → records-request inbox (`UiPath.IntSvc`, pinged connection)
5. `Assign` — set case `status = "Awaiting Provider"`; update record
6. Create Entity Record **`InvestigationAction`** (`action_type="Request sent"`, `actor_kind=Human`
   for the deciding investigator, `actor_kind=System` for the send)
7. `Response` — `{ requestId, sentAt }`, `then: "end"`

**Request (to inbox)**
```json
{ "caseId": "PI-PCS-2026-0041", "providerId": "PRV-100482", "attendantId": "ATT-2087",
  "requestedDocs": ["Personnel packet", "Timesheets 04-16 / 05-19", "Service note 04-14"],
  "respondBy": "2026-08-12" }
```
The response arrives later as correspondence **`DOC-CORR-01`** (received 2026-07-28) during the Stage 6
**wait state**, which triggers reprocessing (BPMN). **Reads** case + attendant; **writes**
`InvestigationAction` and updates case `status`.

---

## e. `OpenOverpaymentRecovery`  (outbound — financial, gated)

**Trigger.** Fires only after the **supervisor approves** a `Decision` where
`adverse_or_financial = true` (Stage 7 → 8). This is the financial action; the guard is mandatory.

**do[] outline**
1. `WorkflowStart`
2. Read Entity Record **`Decision`** for the case (Data Fabric read).
3. `If_Approved#Wrapper` —
   `when: "${$workflow.input.decisionType === 'Open overpayment recovery' && $workflow.input.approved === true}"`
   - `#Else` → `Response` job failed ("supervisor approval required — not opening recovery"),
     `then: "end"`
4. Connector **Post Recovery Record** → overpayment-recovery API (`UiPath.IntSvc`, pinged connection)
5. Create Entity Record **`InvestigationAction`** (`action_type="Action executed"`,
   `actor_kind=Human` = approving supervisor / `System` = execution)
6. `Response` — `{ recoveryId, amount, disclaimer }`, `then: "end"`

**Request (to recovery API)**
```json
{ "caseId": "PI-PCS-2026-0041", "providerId": "PRV-100482",
  "basis": "24 unsupported units (reviewed sample), 4 claims",
  "sampleAmount": 172.80, "reviewedPeriodEstimate": 1600,
  "indicativeRange": { "low": 18000, "high": 42000 },
  "disclaimer": "Indicative range, subject to human validation. Not a determination." }
```
> The **amounts are read from the deterministic exposure calc** (CANON §5: sample $172.80 = 24 × $7.20;
> reviewed period ≈ $1,600; provider-wide indicative $18K–$42K pending audit). This workflow never
> computes them and always carries the non-determination disclaimer. **Reads** `Decision`; **writes**
> `InvestigationAction`.

---

## Cross-cutting notes

- **Authoring flow** (`/uipath-api-workflow`): scaffold each project with `uip api-workflow init`,
  edit `Workflow.json`, `uip api-workflow validate` (offline, autonomous), then run only with explicit
  consent. Connector activities come from `uip api-workflow registry resolve` + `stub` — never
  hand-authored; IntSvc calls need a pinged connection UUID.
- **String-literal wrapping**: `Assign`/`Response`/`If` literals as `"${'literal'}"`; connector
  `bodyParameters` take **bare** literals (the wrap is inverted there).
- **Audit**: every DF mutation appends one `InvestigationAction` (append-only), per
  [`../docs/03-data-model.md`](../docs/03-data-model.md) §8.
- **Packaging**: all five ship inside the `Program Integrity 360` solution
  (`uip solution pack`/`publish`, per `/uipath-solution`).

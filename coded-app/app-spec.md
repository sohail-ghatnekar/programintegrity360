# Program Integrity 360 — Coded Web App Specification

> **Type:** UiPath **Coded Web App** (React + TypeScript, Vite) built per `/uipath-coded-apps`.
> **SDK:** `@uipath/uipath-typescript` (subpath imports: `/entities`, `/tasks`, `/buckets`).
> **Auth:** OAuth 2.0 **Authorization Code + PKCE** for public client `57201488-1566-4f9b-a696-1b3773c2af33`; no client secret. The app performs the exact-scope PKCE exchange, then hands the token to the UiPath SDK.
> **Deploy target:** org `uipathlabs`, tenant `Playground`, folder `AMER Presales/Public Sector/ProgramIntegrity360`, API base `https://api.uipath.com`, hosted URL `https://uipathlabs.uipath.host/pi360-coded-app` (see `solution/deploy.md`).
>
> **This is a demo built on synthetic data.** Nothing here is a real person, provider, or claim. Every number, ID, and date in this spec matches `CANON.md` exactly.

---

## 0. What this app is (and is not)

**Program Integrity 360** is the investigator's operating environment for a single Medicaid Personal Care Services (PCS) billing-integrity review, **case `PI-PCS-2026-0041`** ("Harbor Home Support Services — PCS billing integrity review").

The app **identifies risk signals, organizes evidence, and routes decisions to humans.** It does **not** make a fraud determination. Positioning discipline enforced in the UI everywhere:

- The word **"fraud"** never appears as a system verdict. The UI says **"risk signals."**
- **Deterministic code** (`deterministic-calc-v1`), not agents, computes every overlap, overage, unsupported-unit, and threshold number. Agents **explain and organize**; agent text always separates **FACT (cited)** from **INFERENCE (suggested, for human review)**.
- Every **adverse or financial action is gated by a human**, and financial/adverse actions require the **supervisor** role.
- A non-determination disclaimer is always visible wherever exposure dollars appear: *"Indicative range, subject to human validation. Not a determination or a demand for repayment."*

---

## 1. Design language

**Dense but calm. Evidence-forward. Color = severity, never a verdict.**

| Principle | How it shows up |
|---|---|
| **Evidence-forward** | Every claim, unit, and dollar links to the source record or document that supports it. No number is shown without a "why" affordance (hover/expand shows the deterministic rule or the cited doc). |
| **Color = severity, not judgment** | High = amber/red-600 accent (never a full red "FRAUD" banner). Medium = amber-500. Low/clean = slate/green. Color marks *severity of a signal to review*, not guilt. |
| **Calm density** | Tabular, monospace numerics, generous whitespace between regions; one primary action per screen region. No dashboards-of-doom. |
| **Non-determination is a first-class UI element** | A persistent disclaimer chip in the app header + inline disclaimer on any screen showing exposure. |
| **Human gates are visually obvious** | Adverse/financial buttons render with a shield/lock glyph and a "Supervisor approval required" caption; disabled (not hidden) for non-supervisors so the control is discoverable but inert. |
| **FACT vs INFERENCE** | Agent text is rendered in two visually distinct blocks: `FACT` (cited, solid left border, source chips) and `INFERENCE` (suggested, dashed left border, "for human review" tag). |
| **Provenance chips** | `computed_by: deterministic-calc-v1` badge on every deterministic number; agent name badge on every agent narrative. |

Typography: system UI sans for chrome, tabular-nums for all figures. Palette follows the `dataviz` skill (severity ramp, accessible in light + dark). No emoji in the product UI.

---

## 2. Component / route structure

```
src/
  main.tsx                       # bootstraps <App/>, initializes SDK (PKCE)
  App.tsx                        # AppShell + <Routes>
  uipath.ts                      # export const sdk = new UiPath();  (reads meta tags)
  hooks/
    useAuth.ts                   # SDK session + current user + role (investigator|supervisor)
    useCase.ts                   # loads the one ProgramIntegrityCase aggregate
    useEntityRecords.ts          # generic DF list/get/query hook (per entity)
    useTasks.ts                  # Action Center tasks (getAll/getById/complete/assign)
    useChoiceMaps.ts             # numberId<->name maps for every choice field (loaded once)
  services/
    entities.ts                  # thin wrappers: new Entities(sdk); getById/getAllRecords/queryRecordsById/updateRecordById
    tasks.ts                     # new Tasks(sdk); getAll/getById/complete/assign
    buckets.ts                   # new Buckets(sdk); getReadUri for pi-evidence documents
    audit.ts                     # appendInvestigationAction(...) — writes one InvestigationAction row per mutation
    calc.ts                      # DISPLAY-ONLY re-statement of deterministic figures already stored (never recomputes policy)
  routes/
    CommandCenter.tsx            # /                (Screen 1)
    Case360.tsx                  # /case/:caseId    (Screen 2)
    Reconciliation.tsx           # /case/:caseId/reconciliation   (Screen 3)
    EvidenceStudio.tsx           # /case/:caseId/evidence         (Screen 4)
    DecisionCenter.tsx           # /case/:caseId/decisions        (Screen 5)
    ProviderResponse.tsx         # /case/:caseId/provider-response (Screen 6)
    Timeline.tsx                 # /case/:caseId/timeline         (Screen 7)
    RiskSignals.tsx              # /case/:caseId/signals          (Screen 8)
    Tasks.tsx                    # /case/:caseId/tasks            (Screen 9)
  components/
    AppShell/ (TopBar, SideNav, DisclaimerChip, RoleBadge, StageStepper)
    common/ (DataCard, SeverityTag, ProvenanceBadge, FactInferenceBlock, GatedButton,
             EmptyState, LoadingSkeleton, ErrorState, MoneyRange, UnitMath)
```

**Routing:** React Router. Router `basename` MUST be derived from `getAppBase()` (deployed apps mount at a non-root prefix). Vite `base: './'`. Single case in the demo, but routes are parameterized by `:caseId` so the shape generalizes.

### App shell (persistent chrome)
- **TopBar:** app name · `DisclaimerChip` (non-determination, always visible) · global search (stub) · `RoleBadge` (Investigator / Supervisor, from `useAuth`).
- **StageStepper:** 9 Maestro case stages (CANON §7) with the current stage highlighted from `case.stage`.
- **SideNav:** the 9 screens.

---

## 3. Auth & roles

- **OAuth-PKCE.** `uipath.ts` exports `const sdk = new UiPath()`; `main.tsx` calls `await sdk.initialize()` before render (starts or completes the PKCE redirect). SDK config (`clientId`, `scope`, `orgName`, `tenantName`, `baseUrl`, `redirectUri`) comes from `<meta name="uipath:*">` tags injected from `uipath.json` in dev and by the platform in prod.
- **Runtime OAuth scopes** (declared in `uipath.json`): `DataFabric.Schema.Read DataFabric.Data.Read DataFabric.Data.Write OR.Tasks OR.Administration` (buckets read) — read + write DF, list/complete tasks, read evidence bucket.
- **Roles.** `useAuth` resolves the signed-in user to `investigator` or `supervisor` (from the tenant group / an Orchestrator role check surfaced to the app). Case fixtures: investigator `inv.taylor`, supervisor `sup.morgan`.
- **Role gate (hard rule):** any action where the underlying `Decision.adverse_or_financial === true` — refer for audit, open overpayment recovery, notify provider of adverse action — renders through `<GatedButton requires="supervisor">`. For a non-supervisor the button is **disabled with a visible caption "Supervisor approval required,"** not hidden. Investigator-only actions (validate a signal, edit narrative, decide "proceed to records request") are enabled for investigators.
- Every completed action writes an `InvestigationAction` row via `services/audit.ts` (actor = current user, `actor_kind: Human`).

---

## 4. Data binding model (Data Fabric entities)

The app binds to the 9 Data Fabric entities from `docs/03-data-model.md`. Entity IDs (GUIDs) are resolved once at load by name via `entities.getAll()` and cached; records are fetched with `getAllRecords` / `queryRecordsById` / `getRecordById` and written with `updateRecordById` (fires DF triggers) or `insertRecordById`.

| Entity | Screen(s) that bind it | Primary key |
|---|---|---|
| `ProgramIntegrityCase` | 1,2,5,6,7,8 | `case_id` = `PI-PCS-2026-0041` |
| `Provider` | 2 | `provider_id` = `PRV-100482` |
| `Attendant` | 2,8 | `attendant_id` = `ATT-2087` |
| `Claim` | 3 | `claim_id` (9 rows) |
| `EVVVisit` | 3,8 | `evv_id` (12-row sample of 44) |
| `RiskSignal` | 1,8 | `signal_id` (RS-01..RS-05) |
| `EvidenceDocument` | 4,6 | `doc_id` (6 docs) |
| `InvestigationAction` | 7 (read) + all (append) | `action_id` (ACT-0001..ACT-0014) |
| `Decision` | 5 | `decision_id` (DEC-0001, DEC-0002) |

**Choice-field handling (per SDK gotchas):** `status`, `priority`, `stage`, `severity`, `validation_status`, `capture_method`, `gps_confirmed`, `decision_type`, `action_type`, `actor_kind` come back as integer `numberId`s on every read. `useChoiceMaps` builds `numberId→name` and `name→numberId` maps once on load (via `choiceSets.getById`) and every read/write/filter translates. **No client-side re-aggregation of dollars or units** — display components read the already-stored deterministic values (`improper_units`, `risk_signal_count`, exposure fields).

---

## 5. Screens

Each screen below lists: **Purpose · Layout regions · Data binding (entity.field) · SDK calls · Actions & gates · Empty/Loading/Error states.**

---

### Screen 1 — Command Center (dashboard)  `/`

**Purpose.** The investigator's landing view: the work queue, SLA posture, workload, and a risk-signal heatmap — a calm operational overview, not a scoreboard.

**Layout regions.**
1. **KPI strip:** Open cases (1) · Priority High (1) · Cases awaiting provider (0 now; was 1) · Tasks due ≤48h · Potential exposure headline.
2. **Case queue table:** one row (this case) with case_id, title, provider, priority, stage, status, SLA due.
3. **SLA / workload panel:** intake SLA `2026-08-05 17:00Z`; time-in-stage; investigator `inv.taylor`, supervisor `sup.morgan`.
4. **Risk-signal heatmap:** 5 tiles (RS-01..RS-05) colored by severity (RS-01 High, RS-02 Medium, RS-03 High, RS-04 High, RS-05 Medium).
5. **Exposure headline card:** *"≈ $1,600 potential overpayment identified in the reviewed period; provider-wide indicative exposure $18K–$42K pending audit,"* with the non-determination disclaimer inline.

**Data binding.** `ProgramIntegrityCase` (case_id, title, priority, stage, status, sla_due, risk_signal_count=5, potential_exposure_low=172.80, potential_exposure_period_estimate=1600, potential_exposure_high=42000, exposure_disclaimer); `RiskSignal` (severity per signal); `Task` count from Action Center.

**SDK calls.**
- `new Entities(sdk)`; `caseEntity.getAllRecords({ pageSize: 25 })` → queue rows.
- `riskEntity.queryRecordsById(riskEntityId, { filterGroup: { queryFilters: [{ fieldName:'case_id', operator: Equals, value:'PI-PCS-2026-0041' }] } })` → heatmap.
- `new Tasks(sdk); tasks.getAll({ folderId, filter: "Status ne 'Completed'", pageSize: 25 })` → due-soon count (SLA via `TaskSlaStatus`).

**Actions & gates.** Row click → Case 360. No mutating actions here (read-only landing).

**States.** *Loading:* KPI + table skeletons. *Empty:* "No open cases assigned to you." *Error:* `ErrorState` with retry; never blank numbers.

---

### Screen 2 — Case 360 (detail)  `/case/:caseId`

**Purpose.** Single-glance case identity and posture: header, parties, stage, signals summary, exposure — the hub the other screens hang off.

**Layout regions.**
1. **Case header:** `PI-PCS-2026-0041` · "Harbor Home Support Services — PCS billing integrity review" · Program **Medicaid PCS** · Trigger **Claims Analytics Alert `ALERT-CA-2026-7781`** (alert date 2026-07-20) · Priority **High** · Status · Stage · Confidentiality "Restricted / investigative work product."
2. **Posture bar / StageStepper:** current stage highlighted (see §7 note).
3. **Parties panel — Provider:** Harbor Home Support Services, `PRV-100482`, Medicaid `MPI-4471902`, NPI `1730456789`, 2200 Marina Blvd Suite 210, Active, 22 active attendants, prior history "1 provider education letter (2024); no sanctions on record."
4. **Parties panel — Attendant (subject):** Jordan Ellis `ATT-2087`, Personal Care Attendant, cert `PCA-556210` **expired 2026-03-31**, personnel docs incomplete (missing: Signed training acknowledgment, Current background-check attestation).
5. **Members receiving care:** `MBR-33915` (R.A.) 20 units/day / 80/week; `MBR-40122` (T.N.) 16 units/day / 60/week. *Unit convention: 1 unit = 15 min; blended rate $7.20/unit.*
6. **Signal summary + exposure:** 5 signals (link to Screen 8); exposure range with disclaimer.
7. **Service period:** 2026-03-01 → 2026-05-31. Case opened 2026-07-22.

**Data binding.** `ProgramIntegrityCase` (all header fields) join `Provider` on `provider_id`, `Attendant` on `attendant_id`; member facts from CANON §1 (static reference in-app, sourced from POC docs). Signal count and severities from `RiskSignal`.

**SDK calls.** `caseEntity.getRecord('<recId of PI-PCS-2026-0041>')`; `providerEntity.queryRecordsById(..., filter provider_id = PRV-100482)`; `attendantEntity.queryRecordsById(..., filter attendant_id = ATT-2087)`.

**Actions & gates.** Navigation only + "Open Decision Center." No mutations.

**States.** *Loading:* header skeleton + party skeletons. *Empty:* "Case not found." *Error:* retry; show cached header if partial.

---

### Screen 3 — Claims vs EVV Reconciliation  `/case/:caseId/reconciliation`

**Purpose.** The deterministic core: line-by-line, show for every claim how billed units reconcile against EVV, timesheet, and plan-of-care — and where the **improper units** come from. This screen must make the math unarguable and clearly labeled as code-computed, not agent-judged.

**Layout regions.**
1. **Reconciliation table** — one row per claim (all **9** claims), columns:
   `Claim | DOS | Member | Billed | EVV supp. | Timesheet supp. | POC/day | Improper units = billed − min(EVV,TS) | POC overage = max(0, billed − POC) | Status`
2. **Per-row expander:** the exact rule string and the source records (EVV id, timesheet doc id) that produced the supported values; a `ProvenanceBadge: deterministic-calc-v1`.
3. **Overlap callout (anchor event):** 2026-04-14 — EVV-88231 (MBR-33915, 08:00–12:00) vs EVV-88237 (MBR-40122, 10:30–14:00), overlap **10:30–12:00 = 90 minutes**, "one attendant cannot serve two members in two places at once."
4. **Totals bar:** de-duplicated improper units **= 8 + 8 + 4 + 4 = 24 units**; sample exposure **24 × $7.20 = $172.80**; note that RS-03 (POC overage) and RS-04 (unsupported) can touch the same DOS, so exposure uses the **de-duplicated** figure and never double-counts. Non-determination disclaimer.

**The exact 9 claims (must render verbatim):**

| Claim | DOS | Member | Billed | EVV | TS | POC/day | Improper (RS-04) | POC overage (RS-03) | Status |
|---|---|---|---|---|---|---|---|---|---|
| CLM-0468 | 2026-03-03 | MBR-33915 | 16 | 16 | 16 | 20 | 0 | 0 | Cleared |
| CLM-0475 | 2026-03-10 | MBR-33915 | 16 | 16 | 16 | 20 | 0 | 0 | Under Review (Manual/no-GPS, method flag only) |
| CLM-0491 | 2026-04-14 | MBR-33915 | 24 | 16 | 16 | 20 | **8** | **4** | Flagged (overlap day; billed > EVV and POC) |
| CLM-0492 | 2026-04-14 | MBR-40122 | 14 | 14 | 14 | 16 | 0 | 0 | Under Review (2nd member on overlap day) |
| CLM-0503 | 2026-04-16 | MBR-33915 | 24 | 24 | 16 | 20 | **8** | **4** | Flagged (timesheet DOC-TS-0416 = 08:00–12:00) |
| CLM-0517 | 2026-04-21 | MBR-33915 | 18 | 18 | 18 | 20 | 0 | 0 | Cleared |
| CLM-0528 | 2026-04-28 | MBR-33915 | 20 | 20 | 20 | 20 | 0 | 0 | Under Review (Manual/no-GPS, method flag only) |
| CLM-0540 | 2026-05-19 | MBR-33915 | 24 | 24 | 20 | 20 | **4** | **4** | Flagged (timesheet DOC-TS-0519 = 08:00–13:00) |
| CLM-0549 | 2026-05-26 | MBR-33915 | 20 | 16 | 16 | 20 | **4** | 0 | Flagged (billed > EVV; EVV-88288 = 16) |

> De-duplicated improper units = **24**. RS-03 total POC overage = **12 units** across 04-14, 04-16, 05-19. These are shown side by side but the exposure math uses the RS-04 de-duplicated **24** so RS-03/RS-04 overlap is never double-counted.

**Data binding.** `Claim` (claim_id, date_of_service, member_id, units_billed, evv_supported_units, timesheet_supported_units, poc_daily_units, improper_units, billed_amount, unit_rate, status, notes/method_flag); `EVVVisit` (matched on attendant+member+date, for expander + overlap: start_time, end_time, units, capture_method, gps_confirmed, overlaps_with). Improper-units column reads the stored `improper_units` value; the formula is shown but the number is **not recomputed in JS**.

**SDK calls.** `claimEntity.queryRecordsById(claimEntityId, { filterGroup:{ queryFilters:[{fieldName:'case_id', operator:Equals, value:'PI-PCS-2026-0041'}] }, sortOptions:[{fieldName:'date_of_service', isDescending:false}] })`; `evvEntity.queryRecordsById(...)` for the expander/overlap.

**Actions & gates.** Read-only reconciliation. "Confirm reconciliation" (investigator) marks review complete and appends an `InvestigationAction` — no adverse effect, so investigator-enabled.

**States.** *Loading:* table skeleton (9 rows). *Empty:* "No claims in the reviewed sample." *Error:* row-level error chip if an EVV match fails; totals never render from partial data.

---

### Screen 4 — Evidence Studio  `/case/:caseId/evidence`

**Purpose.** Extracted document fields beside the source-document preview, with the human validation control — the IXP-in-the-loop surface.

**Layout regions.**
1. **Document list (left):** the 6 evidence docs with type, source system, confidence, validation status chip.
2. **Extracted fields (center):** key/value from `extracted_fields`, each field with its confidence; low-confidence fields (< 0.85) highlighted for review.
3. **Source preview (right):** the document rendered from the `pi-evidence` bucket via a signed read URL.
4. **Validation control (footer of center):** "Confirm field" / "Correct value" → sets `validation_status` = Human-validated and stamps `validated_by`.
5. **Contradiction banner:** where a doc contradicts a claim (e.g., DOC-TS-0416 08:00–12:00 → contradicts CLM-0503's 24 units), a link jumps to the reconciliation row.

**The 6 evidence documents (verbatim):**

| Doc | Type | Source | Confidence | Validation | Note |
|---|---|---|---|---|---|
| DOC-TS-0416 | Timesheet | Provider portal upload | 0.71 | Human-validated (inv.taylor) | Handwritten time_out confirmed 12:00; contradicts CLM-0503 (24u) |
| DOC-TS-0519 | Timesheet | Provider portal upload | 0.88 | Auto-confirmed | Contradicts CLM-0540 (24u) |
| DOC-POC-33915 | Plan of Care | Legacy care-mgmt (RPA pull) | 0.94 | Auto-confirmed | Establishes 20 units/day used by RS-03 |
| DOC-SN-0414 | Service Note | Provider portal upload | 0.83 | **Needs review** | Narrative supports AM-only visit; relevant to RS-01 / CLM-0491 |
| DOC-PP-2087 | Personnel Packet | Provider records request | 0.90 | Human-validated (inv.taylor) | Feeds RS-05; 2 docs missing; cert lapsed |
| DOC-CORR-01 | Correspondence | Records-request inbox | 0.86 | Human-validated (inv.taylor) | Provider response; arrives in Stage 6 wait; doesn't resolve 04-16 mismatch |

**Data binding.** `EvidenceDocument` (doc_id, doc_type, source_system, storage_uri, extracted_fields JSON, extraction_confidence, validation_status, validated_by, note).

**SDK calls.** `evidenceEntity.queryRecordsById(..., filter case_id = PI-PCS-2026-0041)`; source preview via `new Buckets(sdk)` → `buckets.getReadUri('pi-evidence', '<storage_uri path>')` (read from `EvidenceDocument.storage_uri`, e.g. `PI-PCS-2026-0041/timesheet_0416.pdf`). Validation write: `evidenceEntity.updateRecord(recordId, { validation_status: <numberId Human-validated>, validated_by: currentUser })` (fires DF trigger) + `audit.appendInvestigationAction({ action_type:'Human validated', ... })`.

**Actions & gates.** *Confirm / correct extracted field* → investigator-enabled (evidentiary, not adverse). Editing a value writes `before_value`/`after_value` into the `InvestigationAction`.

**States.** *Loading:* list + preview skeletons. *Empty:* "No documents collected yet." *Error:* if the bucket read URL fails, show a download-link fallback (per SDK note — contentType/extension unreliable, offer download).

---

### Screen 5 — Decision Center  `/case/:caseId/decisions`

**Purpose.** Where investigator and supervisor decisions are recorded — with the human gate enforced. Adverse/financial dispositions require the supervisor role.

**Layout regions.**
1. **Recommendation panel:** the Investigation Planning Agent's recommendation (recommendation only), rendered as FACT/INFERENCE with citations, with an explicit "Recommendation only — not executed" tag.
2. **Investigator decisions:** "Proceed to records request" (DEC-0001 pattern) — `adverse_or_financial: false` → investigator-enabled.
3. **Supervisor dispositions (gated):** "Refer for audit," "Open overpayment recovery," "Provider education," "Close — no action." The refer/recovery/adverse options are `adverse_or_financial: true` → **supervisor-only** `<GatedButton requires="supervisor">`.
4. **Decision record / audit:** DEC-0001 (investigator, 2026-07-24) and DEC-0002 (supervisor sup.morgan, 2026-07-29 13:50, approved: refer for audit + open overpayment recovery for the confirmed 24 unsupported units across CLM-0491/0503/0540/0549). Each shows rationale + the explicit "program-integrity referral and recovery action, NOT a fraud determination" line.
5. **Non-determination disclaimer** pinned to the disposition panel.

**Data binding.** `Decision` (decision_id, decision_type, recommended_by, decided_by, decision_role, rationale, adverse_or_financial, approved, decided_at); `ProgramIntegrityCase.status` transitions on decision.

**SDK calls.** Read: `decisionEntity.queryRecordsById(..., filter case_id = PI-PCS-2026-0041, sort decided_at)`. Write a decision: `decisionEntity.insertRecord({ decision_type, recommended_by:'Investigation Planning Agent', decided_by: currentUser, decision_role, rationale, adverse_or_financial, approved:true, decided_at:<now> })` + update `caseEntity.updateRecord(caseRecId, { status:<numberId> })` + `audit.appendInvestigationAction({ action_type: decision_role==='Supervisor' ? 'Approval' : 'Decision', actor: currentUser, actor_kind:'Human', ... })`.

**Actions & gates (hard rule).** Any button whose resulting `Decision.adverse_or_financial === true` is disabled for non-supervisors with the "Supervisor approval required" caption. Supervisor approval also flips the linked `caseEntity` status and appends an `Approval` action. Investigator "Proceed to records request" is never gated.

**States.** *Loading:* recommendation + decision-log skeletons. *Empty:* "No decisions recorded." *Error:* if a write fails, keep the button and show inline error; never leave a half-written decision without an audit row.

---

### Screen 6 — Provider Response Tracking  `/case/:caseId/provider-response`

**Purpose.** Track the outbound records request, the wait state, and the intake/reprocessing of the provider's response.

**Layout regions.**
1. **Request timeline:** Request sent `2026-07-24 11:25Z` → wait state (SLA 5 business days) → Response received `2026-07-28 14:02Z` → correlation re-run.
2. **Wait-state banner:** shows "Awaiting Provider" when active (now cleared); countdown against the 5-business-day SLA.
3. **Response viewer:** DOC-CORR-01 — from Harbor Home Support Services, received 2026-07-28, summary "Provider states 04-16 visit extended to 14:00 due to member need; acknowledges cert renewal in progress," 1 attachment. Explicit note: **does not resolve the EVV/timesheet mismatch for 04-16.**
4. **Impact panel:** which signals/claims the response touches (CLM-0503 / RS-01), and that 24 unsupported units remain after response.

**Data binding.** `EvidenceDocument` where doc_id = DOC-CORR-01; `InvestigationAction` rows ACT-0010 (Request sent), ACT-0011 (Response received), ACT-0012 (Summary Agent re-draft); `ProgramIntegrityCase.status` history.

**SDK calls.** `evidenceEntity.queryRecordsById(..., filter doc_type = Correspondence)`; `actionEntity.queryRecordsById(..., filter case_id, action_type in {Request sent, Response received})`; response doc preview via `buckets.getReadUri('pi-evidence','PI-PCS-2026-0041/provider_response.pdf')`.

**Actions & gates.** "Acknowledge response / reprocess" (investigator). No adverse action here.

**States.** *Loading:* timeline skeleton. *Empty (before send):* "No records request sent yet." *Waiting:* wait-state banner with SLA. *Error:* retry; preserve wait-state indicator.

---

### Screen 7 — Case Timeline  `/case/:caseId/timeline`

**Purpose.** The immutable event stream — the complete, append-only audit trail. Read-only.

**Layout regions.**
1. **Vertical timeline:** all 14 `InvestigationAction` rows (ACT-0001 → ACT-0014), newest or oldest first (toggle), each with timestamp, actor + `actor_kind` badge (Human / System / Agent), action_type, detail, and before→after diff when present.
2. **Filter chips:** by actor_kind (Human / System / Agent) and action_type.
3. **Provenance legend:** System (deterministic-calc-v1, IXP), Agent (Triage / Correlation / Planning / Summary), Human (inv.taylor / sup.morgan).

**The 14 actions (verbatim source):** ACT-0001 Case created (system, 07-22 09:12) → ACT-0002 Signal computed (deterministic-calc-v1, 07-22 10:41) → ACT-0003 Triage Agent priority High (07-22 10:45) → ACT-0004 Doc extracted ×6 (IXP, 07-23 08:20) → ACT-0005 Human validated DOC-TS-0416 (inv.taylor, 07-23 09:05) → ACT-0006 Evidence Correlation Agent 3 clusters (07-23 09:30) → ACT-0007 Investigation Planning Agent recommendation (07-23 09:35) → ACT-0008 Edit CLM-0475 method flag → informational (inv.taylor, 07-24 11:10) → ACT-0009 Investigator decision DEC-0001 (07-24 11:20) → ACT-0010 Request sent, status→Awaiting Provider (07-24 11:25) → ACT-0011 Response received DOC-CORR-01 (07-28 14:02) → ACT-0012 Summary Agent v2 (07-28 14:30) → ACT-0013 Approval DEC-0002 (sup.morgan, 07-29 13:50) → ACT-0014 Action executed: referral packet + recovery opened (system, 07-29 14:00).

**Data binding.** `InvestigationAction` (action_id, action_type, actor, actor_kind, timestamp, detail, before_value, after_value).

**SDK calls.** `actionEntity.queryRecordsById(..., filter case_id = PI-PCS-2026-0041, sortOptions:[{fieldName:'timestamp', isDescending:false}], pageSize:50)` — loop cursor if > one page.

**Actions & gates.** **None** — immutable/append-only. No edit/delete controls at all (the entity is written only through other screens' audit calls).

**States.** *Loading:* timeline skeleton. *Empty:* "No activity recorded." *Error:* retry; never partially render then silently drop rows (loop the cursor to completeness).

---

### Screen 8 — Risk Signals & Agent Rationale  `/case/:caseId/signals`

**Purpose.** The 5 deterministic risk signals with their auditable inputs and rules, alongside the agents' grounded rationale — with the FACT/INFERENCE separation and the "agents never score or do arithmetic" discipline front and center.

**Layout regions.**
1. **Signal cards (5):** each shows name, the exact `rule_expression`, `inputs`, `result_value`, `severity` tag, and a `ProvenanceBadge: computed_by = deterministic-calc-v1` (with the caption "computed by code, never an agent").
2. **Agent rationale panel:** Triage / Evidence Correlation / Investigation Planning / Summary agent text, each split into a **FACT** block (cited: signal IDs, claim IDs, doc IDs) and an **INFERENCE** block (suggested, "for human review"). Each agent statement carries a citation chip resolving to the underlying record.
3. **Constraint banner:** "Agents explain and organize. They do not compute numbers or make determinations."

**The 5 signals (verbatim):**

| Signal | Name | Rule | Result | Severity |
|---|---|---|---|---|
| RS-01 | Overlapping visits | Same attendant, two EVV rows, time intervals intersect > 0 min same date | 1 overlap on 2026-04-14; window 10:30–12:00 = 90 min across two members (EVV-88231 vs EVV-88237) | High |
| RS-02 | Manual EVV / missing GPS | count(capture_method=Manual AND gps_confirmed=No) over period | 12 of 44 visits (27.3%) | Medium |
| RS-03 | Units above plan of care | units_billed > poc_daily_units; overage = billed − poc | 3 DOS (04-14, 04-16, 05-19); total overage 12 units | High |
| RS-04 | Unsupported units | improper = units_billed − min(evv_supported, timesheet_supported); flag >0 | 4 claims (CLM-0491/0503/0540/0549); 24 de-duplicated unsupported units | High |
| RS-05 | Personnel documentation gap | credential_expiry < DOS OR required doc missing | Cert lapsed 2026-03-31; 8 DOS after lapse; 2 docs missing | Medium |

**Example FACT/INFERENCE rendering (Triage Agent):**
- **FACT (cited):** "Priority set High. Grounded in RS-01 (overlap, High), RS-03 (POC overage, High), RS-04 (unsupported units, High)." → chips: RS-01, RS-03, RS-04.
- **INFERENCE (for human review):** "Pattern is consistent with time-inflation on manual-entry days; suggest prioritizing timesheet validation. Human to confirm."

**Data binding.** `RiskSignal` (all fields); agent narratives sourced from `InvestigationAction` agent-output rows (ACT-0003/0006/0007/0012) + case summary field.

**SDK calls.** `riskEntity.queryRecordsById(..., filter case_id = PI-PCS-2026-0041, sort signal_id)`; agent text from `actionEntity.queryRecordsById(..., filter actor_kind = Agent)`.

**Actions & gates.** "Validate signal" / "Flag for follow-up" (investigator) → appends `InvestigationAction`. No re-scoring control exists (agents/humans cannot mutate `result_value` — it is deterministic output).

**States.** *Loading:* 5 card skeletons. *Empty:* "Signals not yet computed." *Error:* per-card error; never show a signal without its rule + provenance.

---

### Screen 9 — Task List & SLA widgets  `/case/:caseId/tasks`

**Purpose.** The Action Center work surface: human tasks for this case with due dates and SLA status, plus complete/assign actions (gated for adverse tasks).

**Layout regions.**
1. **Task table:** title, type, priority, status, assignee, SLA status/due — paginated (25–50/page, "Showing X–Y of Z").
2. **SLA widgets:** Overdue / Overdue soon / On time counts (from `TaskSlaStatus`), and the case intake SLA (`2026-08-05 17:00Z`).
3. **Task detail drawer:** the task payload + complete/assign controls.

**Representative tasks (map to the HITL gates in the case flow):** "Validate low-confidence extraction — DOC-SN-0414" (investigator), "Investigator review — reconciliation & narrative" (investigator), "Supervisor approval — refer for audit + open overpayment recovery" (**supervisor-gated**, corresponds to DEC-0002).

**Data binding.** Action Center `Task` (id, title, type, priority, status, assignedToUser, taskSlaDetail, data). Linked to the case via the folder + `ExternalTag`/`CreatorJobKey`.

**SDK calls.**
- `new Tasks(sdk); tasks.getAll({ folderId, filter: "Status ne 'Completed'", orderby:'CreatedTime desc', pageSize: 25 })`.
- Complete: prefer task-attached `task.complete(...)`. External task → `task.complete({ type: TaskType.External, action:'Approve' })`; App/Form task → `task.complete({ type: task.type, action:'Approve', data:{} })` (explicit if/else branch, per SDK union rule).
- Assign: `task.assign({ userNameOrEmail })`; users via `tasks.getUsers(folderId)`.

**Actions & gates.** Completing a task whose disposition is adverse/financial (the supervisor-approval task) is disabled for non-supervisors via `<GatedButton requires="supervisor">`. Investigator tasks (validation, review) are enabled for investigators. Every completion appends an `InvestigationAction`.

**States.** *Loading:* table skeleton. *Empty:* "No open tasks for this case." *Error:* retry; if complete/assign fails show inline error and keep the task open (never mark complete optimistically).

---

## 6. Cross-cutting behaviors

- **Every mutation → one `InvestigationAction`.** `services/audit.ts` is called on every write (validate, edit, decide, approve, complete). `before_value`/`after_value` captured on edits. This keeps the Timeline (Screen 7) complete and immutable.
- **No client-side policy math.** `services/calc.ts` only *re-states* stored deterministic values for display (e.g., renders "24 × $7.20 = $172.80" from stored fields); it never recomputes improper units, overage, or exposure. The authoritative numbers are the DF fields written by `deterministic-calc-v1`.
- **Choice translation everywhere** (per SDK gotchas): read = numberId→name, write/filter = name→numberId.
- **Pagination discipline:** all list reads that can exceed one page loop the cursor (`while (page.hasNextPage) …`); tables paginate 25–50/page.
- **Loading / empty / error** are first-class for every screen (skeletons, explicit empty copy, retryable error states) — never a blank region or a bare number.
- **Text-overflow guards** on all tabular/label surfaces.

---

## 7. Note on case stage/status (data consistency)

The header StageStepper reads `ProgramIntegrityCase.stage`. In the fixtures `stage = "Investigator human review"` (Stage 5) and `status = "In Review"`, **but** the `InvestigationAction` stream already contains supervisor approval (ACT-0013) and executed action (ACT-0014), i.e., the case has actually progressed to Stage 8 ("Approved action execution"). The app should render the stage/status from the case record while surfacing the timeline as the source of truth; this discrepancy is flagged to the demo authors (see the delivery note) so the fixture can be reconciled before the live demo.

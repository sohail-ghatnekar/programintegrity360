# Program Integrity 360 — Wireframes (all 9 screens)

> ASCII/monospace wireframes for the Coded Web App. Annotated with **[bind: entity.field]** and human-gate buttons **[GATE: supervisor]**. Populated with real case data for **PI-PCS-2026-0041**. Numbers match `CANON.md` exactly.
> Legend: `‹…›` = bound value · `[button]` = enabled action · `[⛨ button]` = gated (supervisor) · `⚙ deterministic-calc-v1` = code-computed provenance · `FACT/INFERENCE` = agent text split.

---

## Persistent app shell (all screens)

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ PROGRAM INTEGRITY 360   ⚠ Risk signals — not a determination. Synthetic demo data.     │
│                                                    [🔍 search]   Role: ‹Investigator›   │
├──────────────────────────────────────────────────────────────────────────────────────┤
│ Stage: ①Intake ②Collect ③Extract ④Correlate ▸⑤Review◂ ⑥Records ⑦Approve ⑧Execute ⑨Close │  [bind: case.stage]
├────────────┬─────────────────────────────────────────────────────────────────────────┤
│ NAV        │                                                                           │
│ ▸Command   │                         « screen body »                                   │
│  Case 360  │                                                                           │
│  Reconcile │                                                                           │
│  Evidence  │                                                                           │
│  Decisions │                                                                           │
│  Provider  │                                                                           │
│  Timeline  │                                                                           │
│  Signals   │                                                                           │
│  Tasks     │                                                                           │
└────────────┴─────────────────────────────────────────────────────────────────────────┘
```

---

## Screen 1 — Command Center  `/`   (DETAILED)

```
┌ COMMAND CENTER ─────────────────────────────────────────────────────────────────────┐
│                                                                                       │
│ ┌ KPIs ───────────┬──────────────────┬──────────────────┬───────────────────────────┐│
│ │ OPEN CASES       │ PRIORITY HIGH    │ AWAITING PROVIDER │ TASKS DUE ≤48h            ││
│ │      1           │      1           │      0            │      2                    ││
│ └──────────────────┴──────────────────┴──────────────────┴───────────────────────────┘│
│                                                          [bind: case, tasks(SLA)]      │
│ ┌ CASE QUEUE ─────────────────────────────────────────────────────────────────────┐  │
│ │ CASE            TITLE                          PROVIDER        PRI  STAGE   STATUS  │ │
│ │ PI-PCS-2026-0041 Harbor Home Support Services  Harbor Home    HIGH  ⑤Review In Rev.│ │ ← click → Case 360
│ │                  — PCS billing integrity review PRV-100482                          │ │
│ └────────────────────────────────────────────────────────────────────────────────┘  │  [bind: case.*]
│                                                                                       │
│ ┌ RISK-SIGNAL HEATMAP ─────────────┐   ┌ SLA / WORKLOAD ───────────────────────────┐ │
│ │ RS-01 Overlap        ███ HIGH     │   │ Intake SLA due:  2026-08-05 17:00Z         │ │
│ │ RS-02 Manual/no-GPS  ▒▒  MED      │   │ Case opened:     2026-07-22                 │ │
│ │ RS-03 Above POC      ███ HIGH     │   │ Investigator:    inv.taylor                 │ │
│ │ RS-04 Unsupported    ███ HIGH     │   │ Supervisor:      sup.morgan                 │ │
│ │ RS-05 Personnel gap  ▒▒  MED      │   │ Service period:  2026-03-01 → 2026-05-31    │ │
│ └───────────────────────────────────┘   └────────────────────────────────────────────┘ │
│                                       [bind: risk_signal.severity]   [bind: case.*]    │
│ ┌ EXPOSURE HEADLINE ───────────────────────────────────────────────────────────────┐ │
│ │ ≈ $1,600 potential overpayment identified in the reviewed period;                  │ │
│ │ provider-wide indicative exposure $18K–$42K pending audit.                         │ │
│ │ ⚠ Indicative range, subject to human validation. Not a determination or a demand.  │ │
│ └────────────────────────────────────────────────────────────────────────────────┘  │  [bind: case.potential_exposure_*]
└───────────────────────────────────────────────────────────────────────────────────────┘
Loading: KPI + queue skeletons · Empty: "No open cases assigned to you." · Error: retry
```

---

## Screen 2 — Case 360  `/case/PI-PCS-2026-0041`   (DETAILED)

```
┌ CASE 360 ───────────────────────────────────────────────────────────────────────────┐
│ PI-PCS-2026-0041  ·  Harbor Home Support Services — PCS billing integrity review       │  [bind: case.case_id, case.title]
│ Program: Medicaid PCS   Priority: HIGH   Status: In Review   Stage: ⑤ Investigator review│  [bind: case.program/priority/status/stage]
│ Trigger: Claims Analytics Alert  ALERT-CA-2026-7781  (alert 2026-07-20)                 │  [bind: case.trigger_type/trigger_ref]
│ Confidentiality: Restricted / investigative work product                                │
├───────────────────────────────────────┬───────────────────────────────────────────────┤
│ PROVIDER                                │ ATTENDANT (subject of review)                 │
│  Harbor Home Support Services           │  Jordan Ellis                                 │
│  PRV-100482                             │  ATT-2087 · Personal Care Attendant           │
│  Medicaid MPI-4471902 · NPI 1730456789  │  Cert PCA-556210  ⚠ EXPIRED 2026-03-31        │
│  2200 Marina Blvd, Suite 210            │  Personnel docs: INCOMPLETE                   │
│  Enrollment: Active · 22 attendants     │   – Missing: Signed training acknowledgment   │
│  Prior: 1 education letter (2024),      │   – Missing: Current background-check attest. │
│         no sanctions on record          │                                               │
│  [bind: provider.*]                     │  [bind: attendant.*]                          │
├───────────────────────────────────────┴───────────────────────────────────────────────┤
│ MEMBERS RECEIVING CARE (initials only — privacy)                                        │
│  MBR-33915 (R.A.)  POC 20 units/day (5.0 hrs) · 80 units/week                           │
│  MBR-40122 (T.N.)  POC 16 units/day (4.0 hrs) · 60 units/week                           │
│  Unit convention: 1 unit = 15 min · blended rate $7.20/unit                             │
├─────────────────────────────────────────────────────────────────────────────────────┤
│ SIGNALS: 5 (2 High math, 1 High overlap, 2 Medium) → [View Risk Signals]                │  [bind: case.risk_signal_count=5]
│ EXPOSURE: sample $172.80 · period ≈ $1,600 · provider-wide $18K–$42K   ⚠ not a determ.  │
│                                                                       [Open Decision Center]│
└───────────────────────────────────────────────────────────────────────────────────────┘
Loading: header+party skeletons · Empty: "Case not found." · Error: retry (partial header ok)
```

---

## Screen 3 — Claims vs EVV Reconciliation  `/…/reconciliation`   (DETAILED)

```
┌ CLAIMS vs EVV RECONCILIATION ───────────────────────────────  ⚙ deterministic-calc-v1 ─┐
│ Improper = billed − min(EVV, Timesheet)   ·   POC overage = max(0, billed − POC/day)     │
│                                                                                          │
│ CLAIM     DOS        MBR       BILL EVV  TS  POC  IMPROPER  POCovr  STATUS               │
│ CLM-0468  2026-03-03 MBR-33915  16  16   16  20     0        0      Cleared              │
│ CLM-0475  2026-03-10 MBR-33915  16  16   16  20     0        0      Under Review ⓘmethod  │
│ CLM-0491  2026-04-14 MBR-33915  24  16   16  20    ▸8◂      ▸4◂     FLAGGED  ⟵ overlap day │
│ CLM-0492  2026-04-14 MBR-40122  14  14   14  16     0        0      Under Review (2nd mbr) │
│ CLM-0503  2026-04-16 MBR-33915  24  24   16  20    ▸8◂      ▸4◂     FLAGGED  TS=08:00-12:00│
│ CLM-0517  2026-04-21 MBR-33915  18  18   18  20     0        0      Cleared              │
│ CLM-0528  2026-04-28 MBR-33915  20  20   20  20     0        0      Under Review ⓘmethod  │
│ CLM-0540  2026-05-19 MBR-33915  24  24   20  20    ▸4◂      ▸4◂     FLAGGED  TS=08:00-13:00│
│ CLM-0549  2026-05-26 MBR-33915  20  16   16  20    ▸4◂       0      FLAGGED  EVV-88288=16 │
│                                                                        [bind: claim.*]    │
│ ┌ EXPANDER (CLM-0491) ─────────────────────────────────────────────────────────────┐   │
│ │ Rule (RS-04): improper = 24 − min(EVV 16, TS 16) = 8   ⚙ deterministic-calc-v1     │   │
│ │ Sources: EVV-88231 (08:00-12:00, 16u) · Timesheet supported 16u                    │   │
│ └────────────────────────────────────────────────────────────────────────────────┘    │  [bind: evv_visit.*]
│                                                                                          │
│ ┌ ⚠ OVERLAP CALLOUT — anchor event 2026-04-14 ──────────────────────────────────────┐  │
│ │ EVV-88231 MBR-33915 08:00–12:00   ▓▓▓▓▓▓▓▓                                          │  │
│ │ EVV-88237 MBR-40122 10:30–14:00        ▓▓▓▓▓▓▓▓▓                                    │  │
│ │ OVERLAP 10:30–12:00 = 90 min. One attendant cannot serve two members at once.       │  │
│ └────────────────────────────────────────────────────────────────────────────────┘    │  [bind: evv.overlaps_with]
│                                                                                          │
│ ┌ TOTALS ────────────────────────────────────────────────────────────────────────┐    │
│ │ De-duplicated improper units = 8 + 8 + 4 + 4 = 24 units                            │    │
│ │ Sample exposure = 24 × $7.20 = $172.80                                             │    │
│ │ RS-03 POC overage total = 12 units (04-14, 04-16, 05-19). Exposure uses the        │    │
│ │ de-duplicated RS-04 figure (24u) so RS-03/RS-04 overlap is never double-counted.   │    │
│ │ ⚠ Not a determination or a demand for repayment.          [Confirm reconciliation] │    │
│ └────────────────────────────────────────────────────────────────────────────────┘    │
└───────────────────────────────────────────────────────────────────────────────────────┘
Loading: 9-row skeleton · Empty: "No claims in reviewed sample." · Error: row chip; totals never from partial data
```

---

## Screen 4 — Evidence Studio  `/…/evidence`   (DETAILED)

```
┌ EVIDENCE STUDIO ───────────────────────────────────────────────────────────────────────┐
│ ┌ DOCUMENTS ──────────────┐ ┌ EXTRACTED FIELDS (DOC-TS-0416) ─┐ ┌ SOURCE PREVIEW ──────┐ │
│ │▸DOC-TS-0416 Timesheet    │ │ attendant : Jordan Ellis         │ │ [ pi-evidence bucket ]│ │
│ │  conf 0.71  ✔Human-valid │ │ member    : MBR-33915            │ │  timesheet_0416.pdf   │ │
│ │ DOC-TS-0519 Timesheet    │ │ date      : 2026-04-16           │ │  ┌──────────────┐     │ │
│ │  conf 0.88  ●Auto-conf   │ │ time_in   : 08:00                │ │  │ (handwritten │     │ │
│ │ DOC-POC-33915 Plan of Care│ │ time_out  : 12:00  ⚠was low-conf │ │  │  timesheet   │     │ │
│ │  conf 0.94  ●Auto-conf   │ │ supported_units : 16             │ │  │  scan image) │     │ │
│ │ DOC-SN-0414 Service Note │ │                                  │ │  └──────────────┘     │ │
│ │  conf 0.83  ⧗Needs review│ │ ⚠ Contradicts CLM-0503 (24u)     │ │ getReadUri(pi-evidence│ │
│ │ DOC-PP-2087 Personnel    │ │    → [jump to reconciliation]    │ │  /…/timesheet_0416.pdf)│ │
│ │  conf 0.90  ✔Human-valid │ │                                  │ │  fallback: [download] │ │
│ │ DOC-CORR-01 Corresp.     │ │ ┌ VALIDATION ──────────────────┐ │ │                       │ │
│ │  conf 0.86  ✔Human-valid │ │ │ [Confirm field] [Correct…]   │ │ │                       │ │
│ │ [bind: evidence_document]│ │ │ → status=Human-validated,    │ │ │                       │ │
│ │                          │ │ │   validated_by=inv.taylor    │ │ │                       │ │
│ └──────────────────────────┘ └──────────────────────────────┘ └───────────────────────┘ │
│                                [bind: evidence.extracted_fields/validation_status]        │
│ Note: low-confidence fields (<0.85) highlighted for review. Correcting a value writes     │
│ before/after into an InvestigationAction (audit).                                         │
└───────────────────────────────────────────────────────────────────────────────────────┘
Loading: list+preview skeletons · Empty: "No documents collected yet." · Error: preview→download-link fallback
```

---

## Screen 5 — Decision Center  `/…/decisions`   (DETAILED)

```
┌ DECISION CENTER ────────────────────────────────────────────────────────────────────────┐
│ ┌ AGENT RECOMMENDATION (Investigation Planning Agent) ── recommendation only, not executed┐│
│ │ FACT (cited): RS-01, RS-03, RS-04 warrant provider records to test whether billed       ││
│ │   units are supported. [RS-01][RS-03][RS-04]                                            ││
│ │ INFERENCE (for human review): recommend records request before any adverse action.      ││
│ └───────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                            │
│ ┌ INVESTIGATOR DECISIONS ───────────────┐ ┌ SUPERVISOR DISPOSITIONS (adverse/financial) ─┐│
│ │ adverse_or_financial = false           │ │ adverse_or_financial = true → GATE            ││
│ │ [Proceed to records request]           │ │ [⛨ Refer for audit]       Supervisor approval ││
│ │  (enabled for investigator)            │ │ [⛨ Open overpayment recovery]      required   ││
│ │                                        │ │ [⛨ Provider education]                        ││
│ │                                        │ │ [⛨ Close — no action]                         ││
│ └────────────────────────────────────────┘ └───────────────────────────────────────────┘ │
│                                       [GATE: supervisor — disabled + caption for others]   │
│ ┌ DECISION RECORD (audit) ────────────────────────────────────────────────────────────┐  │
│ │ DEC-0001  Proceed to records request   by inv.taylor (Investigator)  2026-07-24 11:20 │  │
│ │   rationale: RS-01/RS-03/RS-04 warrant records; no adverse action; provider may respond│  │
│ │ DEC-0002  Refer for audit + open overpayment recovery  by sup.morgan (Supervisor)     │  │
│ │           2026-07-29 13:50  ✔APPROVED                                                  │  │
│ │   rationale: 24 unsupported units remain across CLM-0491/0503/0540/0549; provider      │  │
│ │   04-16 explanation does not reconcile with EVV/timesheet. Recover confirmed units only.│  │
│ │   ▸ This is a program-integrity referral and recovery action, NOT a fraud determination.│  │
│ └──────────────────────────────────────────────────────────────────────────────────┘    │  [bind: decision.*]
│ ⚠ Indicative range, subject to human validation. Not a determination or a demand.          │
└───────────────────────────────────────────────────────────────────────────────────────┘
Loading: recommendation+log skeletons · Empty: "No decisions recorded." · Error: keep button, inline error, always audit
```

---

## Screen 6 — Provider Response Tracking  `/…/provider-response`

```
┌ PROVIDER RESPONSE TRACKING ─────────────────────────────────────────────────────────────┐
│ REQUEST → WAIT → RESPONSE → REPROCESS                                                     │
│  ● Request sent      2026-07-24 11:25Z   status → Awaiting Provider   (SLA 5 business days)│  [bind: action ACT-0010]
│  ⧗ Wait state        (cleared)                                                            │
│  ● Response received 2026-07-28 14:02Z   status → In Review; correlation re-run           │  [bind: action ACT-0011]
│  ● Summary re-drafted 2026-07-28 14:30Z  (Summary Agent v2)                               │  [bind: action ACT-0012]
├───────────────────────────────────────────────────────────────────────────────────────┤
│ ┌ RESPONSE — DOC-CORR-01 ───────────────────────────────────────────────────────────┐   │
│ │ From: Harbor Home Support Services      Received: 2026-07-28      Attachments: 1     │   │
│ │ Summary: "Provider states 04-16 visit extended to 14:00 due to member need;          │   │
│ │           acknowledges cert renewal in progress."                                    │   │
│ │ ⚠ Does NOT resolve the EVV/timesheet mismatch for 04-16.        [preview / download] │   │
│ └────────────────────────────────────────────────────────────────────────────────┘     │  [bind: evidence DOC-CORR-01]
│ ┌ IMPACT ───────────────────────────────────────────────────────────────────────────┐   │
│ │ Touches CLM-0503 / RS-01. After response: 24 unsupported units remain.               │   │
│ └────────────────────────────────────────────────────────────────────────────────┘     │
│                                                              [Acknowledge / reprocess]     │
└───────────────────────────────────────────────────────────────────────────────────────┘
Loading: timeline skeleton · Empty: "No records request sent yet." · Waiting: SLA banner · Error: retry, keep wait indicator
```

---

## Screen 7 — Case Timeline  `/…/timeline`   (immutable — no edit/delete controls)

```
┌ CASE TIMELINE (append-only audit trail) ─── filter: [Human][System][Agent] ── order: oldest▾┐
│ ● 2026-07-22 09:12  [System] Case created — from alert ALERT-CA-2026-7781        ACT-0001  │
│ ● 2026-07-22 10:41  [System] Signal computed — RS-01..RS-05  ⚙deterministic-calc  ACT-0002  │
│ ● 2026-07-22 10:45  [Agent ] Triage Agent — priority High (RS-01,RS-03,RS-04)     ACT-0003  │
│ ● 2026-07-23 08:20  [System] Doc extracted ×6 (IXP); 2 flagged conf<0.85          ACT-0004  │
│ ● 2026-07-23 09:05  [Human ] inv.taylor validated DOC-TS-0416 time_out=12:00      ACT-0005  │
│                              before {time_out:"12:0?"} → after {time_out:"12:00"}            │
│ ● 2026-07-23 09:30  [Agent ] Evidence Correlation Agent — 3 clusters              ACT-0006  │
│ ● 2026-07-23 09:35  [Agent ] Investigation Planning Agent — recommend records req. ACT-0007  │
│ ● 2026-07-24 11:10  [Human ] inv.taylor edit — CLM-0475 flag → informational      ACT-0008  │
│ ● 2026-07-24 11:20  [Human ] inv.taylor decision — proceed to records (DEC-0001)  ACT-0009  │
│ ● 2026-07-24 11:25  [System] Request sent — status → Awaiting Provider            ACT-0010  │
│ ● 2026-07-28 14:02  [System] Response received DOC-CORR-01 — status → In Review   ACT-0011  │
│ ● 2026-07-28 14:30  [Agent ] Summary Agent — supervisor summary v2                ACT-0012  │
│ ● 2026-07-29 13:50  [Human ] sup.morgan APPROVED — refer + recovery (DEC-0002)    ACT-0013  │
│ ● 2026-07-29 14:00  [System] Action executed — referral packet + recovery opened  ACT-0014  │
│                                                          [bind: investigation_action.*]     │
│ (Read-only. No edit or delete. Loop cursor to load all rows.)                               │
└───────────────────────────────────────────────────────────────────────────────────────┘
Loading: timeline skeleton · Empty: "No activity recorded." · Error: retry, never drop rows silently
```

---

## Screen 8 — Risk Signals & Agent Rationale  `/…/signals`

```
┌ RISK SIGNALS ─── ⚙ computed by code (deterministic-calc-v1), never an agent ──────────────┐
│ ┌ RS-01 Overlapping visits ── HIGH ─────────────────────────────────────────────────┐    │
│ │ Rule: same attendant, two EVV rows, intervals intersect >0 min same date            │    │
│ │ Inputs: EVV-88231 (08:00-12:00, MBR-33915) · EVV-88237 (10:30-14:00, MBR-40122)      │    │
│ │ Result: 1 overlap on 2026-04-14; window 10:30-12:00 = 90 min across two members      │    │
│ └────────────────────────────────────────────────────────────────────────────────┘      │
│ ┌ RS-02 Manual EVV / missing GPS ── MED ────────────────────────────────────────────┐    │
│ │ Rule: count(capture_method=Manual AND gps_confirmed=No) over period                 │    │
│ │ Result: 12 of 44 visits (27.3%)                                                      │    │
│ └────────────────────────────────────────────────────────────────────────────────┘      │
│ ┌ RS-03 Units above plan of care ── HIGH ───────────────────────────────────────────┐    │
│ │ Rule: units_billed > poc_daily_units; overage = billed − poc                        │    │
│ │ Result: 3 DOS (04-14, 04-16, 05-19); total overage 12 units                          │    │
│ └────────────────────────────────────────────────────────────────────────────────┘      │
│ ┌ RS-04 Unsupported units ── HIGH ──────────────────────────────────────────────────┐    │
│ │ Rule: improper = units_billed − min(evv_supported, timesheet_supported); flag >0    │    │
│ │ Result: 4 claims (CLM-0491/0503/0540/0549); 24 de-duplicated unsupported units       │    │
│ └────────────────────────────────────────────────────────────────────────────────┘      │
│ ┌ RS-05 Personnel documentation gap ── MED ─────────────────────────────────────────┐    │
│ │ Rule: credential_expiry < DOS OR required doc missing                               │    │
│ │ Result: cert lapsed 2026-03-31; 8 DOS after lapse; 2 required docs missing           │    │
│ └────────────────────────────────────────────────────────────────────────────────┘      │  [bind: risk_signal.*]
│                                                            [Validate signal] [Flag follow-up]│
├───────────────────────────────────────────────────────────────────────────────────────┤
│ AGENT RATIONALE — agents explain & organize; they do not compute numbers or determine     │
│ ┌ Triage Agent ──────────────────────────────────────────────────────────────────────┐  │
│ │ ┃FACT (cited): Priority High, grounded in RS-01, RS-03, RS-04.  [RS-01][RS-03][RS-04]│  │
│ │ ┋INFERENCE (for human review): pattern consistent with time-inflation on manual-entry │  │
│ │  days; suggest prioritizing timesheet validation. Human to confirm.                   │  │
│ └────────────────────────────────────────────────────────────────────────────────┘      │
│ ┌ Evidence Correlation Agent ─┐ ┌ Investigation Planning Agent ─┐ ┌ Summary Agent ─────┐  │
│ │ ┃FACT: 3 clusters; billed vs │ │ ┃FACT: recommend records req. │ │ ┃FACT: 24 unsupported│  │
│ │  EVV/TS conflict [CLM-0503]  │ │  [RS-01][RS-03][RS-04]         │ │  units remain post- │  │
│ │ ┋INFERENCE: prioritize 04-16 │ │ ┋INFERENCE: no adverse action  │ │  response [DEC-0002]│  │
│ │  timesheet review            │ │  pending response              │ │ ┋INFERENCE: refer   │  │
│ └──────────────────────────────┘ └────────────────────────────────┘ └────────────────────┘ │  [bind: investigation_action actor_kind=Agent]
└───────────────────────────────────────────────────────────────────────────────────────┘
Loading: 5 card skeletons · Empty: "Signals not yet computed." · Error: per-card; never a signal without rule+provenance
```

---

## Screen 9 — Task List & SLA widgets  `/…/tasks`

```
┌ TASKS & SLA ──────────────────────────────────────────────────────────────────────────┐
│ ┌ SLA WIDGETS ──────────────────────────────────────────────────────────────────────┐  │
│ │ Overdue: 0    Overdue soon: 1    On time: 2    ·    Intake SLA: 2026-08-05 17:00Z    │  │
│ └────────────────────────────────────────────────────────────────────────────────┘    │  [bind: task.taskSlaDetail, case.sla_due]
│ ┌ TASK LIST ─────────────────────────────────────────────  Showing 1–3 of 3 ────────┐  │
│ │ TITLE                                        TYPE  PRI   STATUS      ASSIGNEE   SLA  │  │
│ │ Validate low-conf extraction — DOC-SN-0414   Form  Med   Pending     inv.taylor  ✓  │  │
│ │   [Open] [Assign…] [Complete]  (investigator)                                        │  │
│ │ Investigator review — reconciliation & narr. App   High  Pending     inv.taylor  ⧗  │  │
│ │   [Open] [Assign…] [Complete]  (investigator)                                        │  │
│ │ Supervisor approval — refer for audit +      App   High  Unassigned  —          ⧗  │  │
│ │   open overpayment recovery                                                          │  │
│ │   [Open] [Assign…] [⛨ Complete/Approve]   [GATE: supervisor — disabled for others]   │  │
│ └────────────────────────────────────────────────────────────────────────────────┘    │  [bind: Action Center task.*]
│ Complete via task-attached task.complete({type, action:'Approve', data:{}}). Each         │
│ completion appends an InvestigationAction. Table paginates 25–50/page.                    │
└───────────────────────────────────────────────────────────────────────────────────────┘
Loading: table skeleton · Empty: "No open tasks for this case." · Error: inline; never mark complete optimistically
```

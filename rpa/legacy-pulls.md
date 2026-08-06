# RPA Legacy Pulls — Program Integrity 360

> Authoring skill: **`/uipath-rpa`** (XAML workflows, Object Repository selectors, UI automation).
> Related: **`/uipath-maestro-bpmn`** (calls these as unattended service tasks), **`/uipath-platform`** (Data Fabric + buckets).
>
> **Positioning.** These robots *collect and organize evidence*. They pull records, write them to
> Data Fabric, and drop the source artifact in a bucket. They compute **no risk signals**, make **no**
> determination, and do **no** arithmetic — that is `deterministic-calc-v1` and the human-gated stages.
> **All systems and data here are synthetic mocks.** Nothing is a real portal, provider, or member.

---

## Why RPA (and not a connector)

Two source systems in this demo have **no API and no webhook** — the only integration surface is a
human-facing web UI behind a login. RPA (UI automation with Object Repository selectors) is the
correct pattern: the robot drives the same screens a clerk would.

Systems that *do* expose a REST facade (the claims-analytics alert source, the records-request inbox)
are handled by an Integration Service connector instead — see
[`../connector-builder/mock-connectors.md`](../connector-builder/mock-connectors.md).

| Source system (mock) | Integration surface | Pattern | This doc |
|---|---|---|---|
| Legacy Medicaid **care-management** system (Plan of Care) | Web UI only, no API | **RPA** | ✅ Workflow A |
| Legacy **EVV vendor portal** (raw visit records) | Web UI only, no API | **RPA** | ✅ Workflow B |
| Claims analytics alert source | REST | IS connector | see connector doc |
| Records-request inbox | REST | IS connector | see connector doc |

Both workflows run **unattended, as service tasks invoked by `evidence-collection.bpmn`** (CANON §7
Stage 2). The BPMN process orchestrates them alongside the API-based pulls; each robot is a discrete
job started by the Maestro BPMN engine and reports success/failure back to the process.

---

## Project shape

- Project type: **Process**, modern (`targetFramework: Windows`, `expressionLanguage: VisualBasic`).
  Created with `uip rpa init` (never hand-authored) per `/uipath-rpa` Common Rule 2/2a.
- Packages: `UiPath.UIAutomation.Activities` (Object Repository + `NApplicationCard`/UIA),
  `UiPath.System.Activities`, `UiPath.DataService.Activities` (Data Fabric writes),
  `UiPath.Platform` / storage-bucket activities for artifact upload.
- Object Repository: one **UI Library** per mock app (`OR/CareMgmtApp`, `OR/EvvPortalApp`) holding
  captured screen + control descriptors. **Selectors are captured with `uia-configure-target`, never
  hand-written** (`/uipath-rpa` Rule 7). Descriptors are reused across runs; anchor-based selectors
  keep them resilient to layout drift.
- Run mode: **unattended** (robot account, no interactive user). Screenshots-on-error enabled.

---

## Workflow A — `PullPlanOfCare.xaml`

**Purpose.** Log in to the legacy care-management web app, open the member's active Plan of Care,
export it, extract the authorization values, and land them in Data Fabric + the evidence bucket as
`EvidenceDocument` **`DOC-POC-33915`**.

**Populates:** `EvidenceDocument` (doc_type = `Plan of Care`, source_system = `Legacy care-management
system (RPA pull)`). Downstream, `/uipath-ixp` confirms the extracted fields (POC auto-confirms at
0.94 — see [`../ixp/ixp-taxonomy.md`](../ixp/ixp-taxonomy.md)).

### .xaml structure (Sequence)

```
Main (Sequence)
├─ Try
│  ├─ NApplicationCard  "Care-Mgmt Portal"   (OR: CareMgmtApp/LoginScreen)
│  │   → Open Browser to https://mock-caremgmt.local/login   (Object Repository app target)
│  ├─ Retry Scope  (MaxRetries=3, Interval=00:00:05)         ── LOGIN
│  │   ├─ NTypeInto  username   (OR: LoginScreen/txtUser)  → asset "CareMgmt_User"
│  │   ├─ NTypeInto  password   (OR: LoginScreen/txtPass)  → Orchestrator credential asset
│  │   └─ NClick     "Sign in"  (OR: LoginScreen/btnSignIn)
│  ├─ NClick   "Members"        (OR: NavBar/lnkMembers)      ── NAVIGATE
│  ├─ NTypeInto member search   (OR: MemberSearch/txtMemberId) → "MBR-33915"
│  ├─ NClick   "Search" then open the POC row (OR: MemberSearch/btnGo, gridPOC/rowActive)
│  ├─ NClick   "Export PDF"     (OR: PocDetail/btnExport)    ── DOWNLOAD
│  ├─ Wait For Download → poc_MBR-33915.pdf
│  ├─ NGetText authorized_units_per_day  (OR: PocDetail/lblUnitsDay)   → 20   [TextString!]
│  ├─ NGetText authorized_units_per_week (OR: PocDetail/lblUnitsWeek)  → 80
│  ├─ NGetText effective / expires        (OR: PocDetail/lblEffective, lblExpires)
│  ├─ Upload Storage File  → buckets/pi-evidence/PI-PCS-2026-0041/poc_MBR-33915.pdf   ── BUCKET
│  ├─ Create Entity Record  EvidenceDocument  (Data Fabric)                            ── DATA FABRIC
│  │     doc_id="DOC-POC-33915", case_id="PI-PCS-2026-0041", doc_type="Plan of Care",
│  │     source_system="Legacy care-management system (RPA pull)",
│  │     storage_uri="buckets/.../poc_MBR-33915.pdf",
│  │     extracted_fields={member,authorized_units_per_day,authorized_units_per_week,service,effective,expires},
│  │     validation_status="Auto-confirmed"   (IXP sets confidence 0.94 at extraction stage)
│  └─ Create Entity Record  InvestigationAction  (action_type="Doc extracted", actor_kind="System")
├─ Catch (System exception → retry/escalate; take screenshot; write failed InvestigationAction)
└─ Finally  Close Browser / Close Application
```

> **Note on `NGetText`:** the output member is `TextString`, not `Value` (`/uipath-rpa` Rule 21) — the
> robot reads the on-screen value only; it does not transform or compute it.

### POC values written (exact — from `data/evidence_documents.json` `DOC-POC-33915`)

| Field | Value |
|---|---|
| doc_id | `DOC-POC-33915` |
| member | `MBR-33915` |
| authorized_units_per_day | **20** |
| authorized_units_per_week | **80** |
| service | Personal Care |
| effective | 2026-01-01 |
| expires | 2026-12-31 |
| storage_uri | `buckets/pi-evidence/PI-PCS-2026-0041/poc_MBR-33915.pdf` |
| extraction_confidence (set by IXP) | 0.94 → Auto-confirmed |

> The **20 units/day** authorization is the input to the deterministic **RS-03** rule
> (`claim.units_billed > member.poc_daily_units`). The robot supplies the fact; the calc does the compare.

---

## Workflow B — `PullEvvVisits.xaml`

**Purpose.** Log in to the legacy EVV vendor portal, filter to attendant **`ATT-2087`** over the
service period **2026-03-01 → 2026-05-31**, scrape the visit table, export the CSV, and land each visit
as an `EVVVisit` row in Data Fabric plus the raw export in the bucket.

**Populates:** `EVVVisit` (one record per scraped row). The **12-row representative sample** below is
what the demo shows on screen; CANON §2 notes the full reviewed period is **44 visits** and the sample
is flagged as representative. The robot pulls raw rows only — the `overlaps_with` field and RS-01/RS-02
counts are set later by `deterministic-calc-v1`, never by the robot.

### .xaml structure (Sequence)

```
Main (Sequence)
├─ Try
│  ├─ NApplicationCard  "EVV Vendor Portal"  (OR: EvvPortalApp/LoginScreen)
│  │   → Open Browser to https://mock-evv.local/portal
│  ├─ Retry Scope (3× / 5s)  LOGIN  (NTypeInto user+pass from assets, NClick Sign in)
│  ├─ NClick "Visits" (OR: NavBar/lnkVisits)                              ── NAVIGATE
│  ├─ NTypeInto attendant filter (OR: VisitFilter/txtAttendant) → "ATT-2087"
│  ├─ NTypeInto date-from / date-to (OR: VisitFilter/dtFrom,dtTo) → 2026-03-01 / 2026-05-31
│  ├─ NClick "Apply" (OR: VisitFilter/btnApply)
│  ├─ Extract Table Data (OR: VisitGrid/tblVisits)  → dtVisits (DataTable)  ── EXTRACT TABLE
│  │     (structured-data scrape; pattern-based, resilient to row count)
│  ├─ NClick "Export CSV" (OR: VisitGrid/btnExport) → evv_ATT-2087.csv     ── DOWNLOAD
│  ├─ Upload Storage File → buckets/pi-evidence/PI-PCS-2026-0041/evv_ATT-2087.csv  ── BUCKET
│  ├─ For Each row In dtVisits                                              ── DATA FABRIC
│  │   └─ Create Entity Record  EVVVisit
│  │        evv_id, attendant_id="ATT-2087", member_id, service_date,
│  │        start_time, end_time, units, capture_method, gps_confirmed,
│  │        overlaps_with = Nothing   (set later by deterministic-calc-v1)
│  └─ Create Entity Record  InvestigationAction (action_type="Doc extracted", actor_kind="System",
│         detail="Pulled 12 EVV rows for ATT-2087 (representative sample of 44-visit period)")
├─ Catch (System exception → retry/escalate; screenshot; failed InvestigationAction)
└─ Finally  Close Browser
```

### Exact EVV rows pulled (CANON §2 / `data/evv_visits.json`)

| EVV ID | Date | Member | Start–End | Units | Capture method | GPS confirmed |
|---|---|---|---|---|---|---|
| EVV-88201 | 2026-03-03 | MBR-33915 | 09:00–13:00 | 16 | Mobile-GPS | Yes |
| EVV-88208 | 2026-03-10 | MBR-33915 | 09:00–13:00 | 16 | Manual | No |
| EVV-88215 | 2026-03-24 | MBR-40122 | 13:00–16:00 | 12 | Telephony | N/A |
| EVV-88231 | 2026-04-14 | MBR-33915 | 08:00–12:00 | 16 | Manual | No |
| EVV-88237 | 2026-04-14 | MBR-40122 | 10:30–14:00 | 14 | Mobile-GPS | Yes |
| EVV-88244 | 2026-04-16 | MBR-33915 | 08:00–14:00 | 24 | Manual | No |
| EVV-88250 | 2026-04-21 | MBR-33915 | 09:00–13:30 | 18 | Mobile-GPS | Yes |
| EVV-88258 | 2026-04-28 | MBR-33915 | 08:00–13:00 | 20 | Manual | No |
| EVV-88266 | 2026-05-05 | MBR-40122 | 13:00–16:30 | 14 | Telephony | N/A |
| EVV-88273 | 2026-05-12 | MBR-33915 | 09:00–13:00 | 16 | Mobile-GPS | Yes |
| EVV-88280 | 2026-05-19 | MBR-33915 | 08:00–14:00 | 24 | Manual | No |
| EVV-88288 | 2026-05-26 | MBR-33915 | 09:00–13:00 | 16 | Manual | No |

> The **2026-04-14 pair** (EVV-88231 08:00–12:00 for MBR-33915 and EVV-88237 10:30–14:00 for MBR-40122)
> is the raw material for the deterministic **RS-01 overlap** flag (90-minute intersection 10:30–12:00).
> The robot pulls both rows as-is; it does **not** set `overlaps_with` or declare an overlap — that is
> the calc's job, stated on-screen so the number stays defensible.

---

## Selectors approach

- **Object Repository descriptors only**, captured via `uia-configure-target` (`/uipath-rpa` Rule 7).
  No hand-written selectors.
- **Anchor-based** targets (label → adjacent input) so the descriptors survive minor DOM/layout drift
  in the mock apps.
- Screen states organized per app (`LoginScreen`, `MemberSearch`, `PocDetail`, `VisitFilter`,
  `VisitGrid`), each a group in the UI Library — reusable across future robots.
- Table scrape uses **structured-data extraction** (pattern-based), so a changing row count needs no
  code change.

## Resilience

| Concern | Handling |
|---|---|
| Transient login / page load faults | **Retry Scope** — 3 attempts, 5 s interval; recover to a known screen before retrying. |
| Element not ready | UIA activity `WaitForReady` / timeout (default 30 s) on each `NClick`/`NTypeInto`/`NGetText`. |
| Download completion | Explicit *Wait For Download* before bucket upload. |
| Unrecoverable fault | **Try/Catch**: system exception → screenshot-on-error, write a failed `InvestigationAction`, fault the job so the BPMN branch can route to a human. |
| Idempotency | `Create Entity Record` keyed on `evv_id` / `doc_id`; a re-run upserts rather than duplicating. |
| Credentials | Pulled from Orchestrator **credential assets**; never inline. Robot account is least-privilege. |

## Audit

Every write appends an `InvestigationAction` (`actor_kind = System`, `actor = PullPlanOfCare` /
`PullEvvVisits`), giving the case the immutable trail required by the data model
([`../docs/03-data-model.md`](../docs/03-data-model.md) §8).

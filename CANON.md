# CANON — Program Integrity 360 (single source of truth)

> **Every asset in this repo MUST match the facts, IDs, and numbers in this file.**
> If a workflow, screen, agent prompt, or data file disagrees with CANON, CANON wins.
> This is a **demo** built on **synthetic data**. Nothing here is a real person, provider, or claim.

---

## 0. Positioning (say this out loud in the demo)

Program Integrity 360 **identifies risk signals, organizes evidence, and routes decisions to humans.**
It does **not** make a fraud determination. Every adverse or financial action is gated by a human
approval. Deterministic code — not the agents — computes overlaps, unit overages, unsupported units,
and threshold breaches. Agents **explain and organize**; they never score policy or do the arithmetic,
and every agent statement is grounded in a cited source document or a deterministic calculation.

Vocabulary discipline used everywhere in this repo:
- **"Risk signal"** = a deterministic, explainable indicator worth a human looking at.
- **"Fraud determination"** = a human/legal conclusion. The system never uses this phrase about its own output.
- Agent text always separates **FACT (cited)** from **INFERENCE (suggested, for human review)**.

---

## 1. The one case

| Field | Value |
|---|---|
| Case ID | **PI-PCS-2026-0041** |
| Case title | Harbor Home Support Services — PCS billing integrity review |
| Program | Medicaid **Personal Care Services (PCS)** |
| Trigger | **Claims analytics alert** (batch anomaly model), alert ID `ALERT-CA-2026-7781` |
| Alert date | **2026-07-20** |
| Case opened | **2026-07-22** |
| Service period under review | **2026-03-01 → 2026-05-31** |
| Today (demo "now") | **2026-07-29** |
| Priority | **High** (see Triage Agent rationale) |
| Owning unit | State Medicaid Agency — Office of Program Integrity (OPI) |
| Confidentiality | Restricted / investigative work product |

### Provider
| Field | Value |
|---|---|
| Provider ID (internal) | `PRV-100482` |
| Name | **Harbor Home Support Services** |
| Medicaid Provider ID | `MPI-4471902` |
| NPI | `1730456789` |
| Address | 2200 Marina Blvd, Suite 210 |
| Enrollment status | Active |
| Active attendants (provider-wide) | 22 |
| Prior integrity history | 1 prior education letter (2024), no sanctions |

### Attendant (subject of this review)
| Field | Value |
|---|---|
| Attendant ID | `ATT-2087` |
| Name | **Jordan Ellis** |
| Role | Personal Care Attendant (PCA) |
| Credential | Cert `PCA-556210`, **expired 2026-03-31** |
| Personnel packet gaps | Missing signed training acknowledgment; missing current background-check attestation |

### Members receiving care (initials only — privacy)
| Member ID | Initials | POC daily authorization | POC weekly authorization |
|---|---|---|---|
| `MBR-33915` | R.A. | **20 units/day** (5.0 hrs) | 80 units/week |
| `MBR-40122` | T.N. | 16 units/day (4.0 hrs) | 60 units/week |

> **Unit convention:** 1 unit = 15 minutes. Blended PCS rate used for exposure math = **$7.20 / unit**.

---

## 2. Synthetic EVV visits (attendant ATT-2087)

The `data/evv_visits.json` file holds this representative sample (12 rows). The full reviewed period
contains **44 visits**; the sample is flagged as representative. Risk-signal counts below are computed
on the **full 44-visit period** and this is stated on-screen so numbers stay defensible.

| EVV ID | Date | Member | Start–End | Units | Capture method | GPS confirmed |
|---|---|---|---|---|---|---|
| EVV-88201 | 2026-03-03 | MBR-33915 | 09:00–13:00 | 16 | Mobile-GPS | Yes |
| EVV-88208 | 2026-03-10 | MBR-33915 | 09:00–13:00 | 16 | **Manual** | **No** |
| EVV-88215 | 2026-03-24 | MBR-40122 | 13:00–16:00 | 12 | Telephony | N/A |
| EVV-88231 | 2026-04-14 | MBR-33915 | 08:00–12:00 | 16 | **Manual** | **No** |
| EVV-88237 | 2026-04-14 | MBR-40122 | 10:30–14:00 | 14 | Mobile-GPS | Yes |
| EVV-88244 | 2026-04-16 | MBR-33915 | 08:00–14:00 | 24 | **Manual** | **No** |
| EVV-88250 | 2026-04-21 | MBR-33915 | 09:00–13:30 | 18 | Mobile-GPS | Yes |
| EVV-88258 | 2026-04-28 | MBR-33915 | 08:00–13:00 | 20 | **Manual** | **No** |
| EVV-88266 | 2026-05-05 | MBR-40122 | 13:00–16:30 | 14 | Telephony | N/A |
| EVV-88273 | 2026-05-12 | MBR-33915 | 09:00–13:00 | 16 | Mobile-GPS | Yes |
| EVV-88280 | 2026-05-19 | MBR-33915 | 08:00–14:00 | 24 | **Manual** | **No** |
| EVV-88288 | 2026-05-26 | MBR-33915 | 09:00–13:00 | 16 | **Manual** | **No** |

**The anchor event — 2026-04-14 overlap:** EVV-88231 (MBR-33915, 08:00–12:00) and EVV-88237
(MBR-40122, 10:30–14:00) overlap **10:30–12:00 = 90 minutes**. One attendant cannot serve two
members in two locations at once → deterministic overlap flag.

---

## 3. Synthetic claims (billed to Medicaid)

`data/claims.json`. "Supported units" = the lesser of EVV-supported and timesheet-supported units.

| Claim ID | DOS | Member | Units billed | EVV supported | Timesheet supported | Improper units (billed − supported) | Notes |
|---|---|---|---|---|---|---|---|
| CLM-0468 | 2026-03-03 | MBR-33915 | 16 | 16 | 16 | 0 | Clean |
| CLM-0475 | 2026-03-10 | MBR-33915 | 16 | 16 | 16 | 0 | Manual/no-GPS visit (method flag only) |
| CLM-0491 | 2026-04-14 | MBR-33915 | 24 | 16 | 16 | **8** | Overlap day; billed > EVV |
| CLM-0492 | 2026-04-14 | MBR-40122 | 14 | 14 | 14 | 0 | Other member on overlap day |
| CLM-0503 | 2026-04-16 | MBR-33915 | 24 | 24 | 16 | **8** | Timesheet shows 08:00–12:00 only |
| CLM-0517 | 2026-04-21 | MBR-33915 | 18 | 18 | 18 | 0 | Clean |
| CLM-0528 | 2026-04-28 | MBR-33915 | 20 | 20 | 20 | 0 | Manual/no-GPS visit (method flag only) |
| CLM-0540 | 2026-05-19 | MBR-33915 | 24 | 24 | 20 | **4** | Timesheet shows 08:00–13:00 |
| CLM-0549 | 2026-05-26 | MBR-33915 | 20 | 16 | 16 | **4** | Billed > EVV |

**De-duplicated potentially-improper units (this sample) = 8 + 8 + 4 + 4 = 24 units.**

---

## 4. Deterministic risk signals (computed by code, NOT agents)

`data/risk_signals.json`. Each signal stores its inputs and the exact rule so it is fully auditable.

| Signal ID | Name | Rule (deterministic) | Result on this case | Severity |
|---|---|---|---|---|
| RS-01 | Overlapping visits | Same attendant, two visits, time ranges intersect > 0 min | **1 overlap** on 2026-04-14 (90 min) | High |
| RS-02 | Manual EVV / missing GPS | capture_method = Manual AND gps_confirmed = No | **12 of 44 visits (27.3%)** | Medium |
| RS-03 | Units above plan of care | claim.units_billed > member.poc_daily_units | **3 DOS** (04-14, 04-16, 05-19), overage **12 units** | High |
| RS-04 | Unsupported units (timesheet/EVV mismatch) | claim.units_billed > min(evv_supported, timesheet_supported) | **4 claims**, **24 unsupported units** | High |
| RS-05 | Personnel documentation gap | cert.expiry < DOS OR required doc missing | Cert lapsed 2026-03-31; **8 DOS** after lapse; 2 docs missing | Medium |

> RS-03 and RS-04 can touch the same DOS. The **de-duplicated** improper-units figure (§3) is what
> the exposure math uses, so we never double-count. This is stated on the reconciliation screen.

---

## 5. Financial exposure (deterministic + transparent, NEVER a "determination")

Presented on-screen as a **range for investigator context**, explicitly "subject to human validation,
not a determination or a demand."

| Level | Basis | Amount |
|---|---|---|
| Reviewed sample (4 claims) | 24 improper units × $7.20 | **$172.80** |
| Reviewed period (projected) | full 44-visit period at the observed defect rate | **≈ $1,600** |
| Provider-wide indicative range | pattern projected across 22 attendants, pending audit | **$18,000 – $42,000** |

The demo headline number is **"≈ $1,600 potential overpayment identified in the reviewed period;
provider-wide indicative exposure $18K–$42K pending audit."** Always paired with the non-determination
disclaimer.

---

## 6. Evidence documents (IDP/IXP extraction targets)

`data/evidence_documents.json`. Each has extracted fields + a confidence + a validation status.

| Doc ID | Type | Source system | IXP outcome of note |
|---|---|---|---|
| DOC-TS-0416 | Timesheet (scanned, handwritten) | Provider portal upload | Extracted 08:00–12:00 → contradicts CLM-0503 (24u) |
| DOC-TS-0519 | Timesheet (scanned) | Provider portal upload | Extracted 08:00–13:00 → contradicts CLM-0540 (24u) |
| DOC-POC-33915 | Plan of Care | Legacy care-mgmt system (RPA pull) | 20 units/day authorization |
| DOC-SN-0414 | Service note | Provider portal upload | Note describes single-member visit AM only on 04-14 |
| DOC-PP-2087 | Personnel packet (Jordan Ellis) | Provider records request | Cert expiry 2026-03-31; 2 docs missing |
| DOC-CORR-01 | Provider correspondence (response letter) | Records-request inbox | Arrives during wait state; reprocessed |

---

## 7. Case stages (Maestro case lifecycle) → skill ownership

| # | Stage | Primary skill(s) | What happens |
|---|---|---|---|
| 1 | Alert intake & triage | `/uipath-maestro-case`, `/uipath-api-workflow`, `/uipath-agents` (Triage) | Alert creates case; triage agent explains priority |
| 2 | Automated evidence collection | `/uipath-maestro-bpmn`, `/uipath-rpa`, `/uipath-api-workflow`, `/uipath-platform` | Pull claims, EVV, POC, docs into Data Fabric + buckets |
| 3 | Document extraction & validation | `/uipath-ixp`, `/uipath-human-in-the-loop` | Extract timesheets/POC/notes/personnel; human validates low-confidence |
| 4 | Evidence correlation & investigation planning | `/uipath-agents` (Correlation, Planning) + deterministic calc | Group findings, explain conflicts, recommend next steps |
| 5 | Investigator human review | `/uipath-human-in-the-loop`, `/uipath-coded-apps` | Investigator validates signals, edits narrative, decides to proceed |
| 6 | Provider records request & wait state | `/uipath-maestro-bpmn`, `/uipath-api-workflow`, `/uipath-maestro-case` | Outbound request; case waits; response intake reprocesses |
| 7 | Supervisor approval / disposition | `/uipath-human-in-the-loop` | Supervisor approves adverse/financial action |
| 8 | Approved action execution | `/uipath-maestro-bpmn`, `/uipath-api-workflow`, `/uipath-rpa` | Generate referral packet, open recovery, notify provider |
| 9 | Closure & monitoring | `/uipath-maestro-bpmn`, `/uipath-insights`, `/uipath-platform` | Close case, write audit record, add provider to watch list |

---

## 8. Agents (all grounded, none decide)

| Agent | Purpose | Inputs (grounding) | Hard constraints |
|---|---|---|---|
| **Triage Agent** | Explain why case was prioritized High | alert payload, deterministic signal summary | No re-scoring; cite the signals that drove priority |
| **Evidence Correlation Agent** | Group findings, explain conflicts | risk_signals, claims, evv_visits, evidence docs | No arithmetic; reference deterministic values by ID |
| **Investigation Planning Agent** | Recommend next steps | correlated findings, case posture | Recommends only; never executes; flags human gates |
| **Summary Agent** | Draft investigator + supervisor narrative | all of the above + human edits | FACT vs INFERENCE labeling; citations mandatory |

---

## 9. Data model (entities in Data Fabric)

`ProgramIntegrityCase`, `Provider`, `Attendant`, `Claim`, `EVVVisit`, `RiskSignal`,
`EvidenceDocument`, `InvestigationAction`, `Decision`. Full field lists in `docs/03-data-model.md`.
Every mutation writes an `InvestigationAction` row → complete audit trail.

---

## 10. Coded app "Program Integrity 360" — screens

1. **Command Center** dashboard (queue, SLA, workload, signal heatmap)
2. **Case 360** detail view (header, posture, stage, parties)
3. **Claims vs EVV Reconciliation** (line-by-line, improper-unit math shown)
4. **Evidence Studio** (extracted fields + source doc preview, validation)
5. **Decision Center** (investigator + supervisor actions, gated)
6. **Provider Response Tracking** (request sent, wait state, intake)
7. **Case Timeline** (immutable event stream)
8. **Risk Signals & Agent Rationale** (signals + FACT/INFERENCE agent text)
9. **Task List & SLA widgets** (Action Center tasks, due dates)

---

## 11. Deployment target (per user request)

- Solution name: **Program Integrity 360**
- Target cloud: **staging.uipath.com**, organization **uipathlabs**, tenant **Playground**
- Requires interactive `uip login` (browser) then `uip solution pack/publish/deploy/activate`.
- See `solution/deploy.md` for the exact command sequence.

# Demo Script — Program Integrity 360 (~12 minutes, live)

*Screen-by-screen narration for the coded app. Audience: State HHS / Medicaid Office of Program Integrity (OPI), SLED buyers.*
*One case: **PI-PCS-2026-0041**, Harbor Home Support Services, attendant Jordan Ellis. Synthetic data only.*

> **Read `CANON.md` first.** Every ID, date, and number in this script is bound to CANON. If the app on screen disagrees with CANON, stop and fix the app, not the script.

**The three money lines — say each one out loud at the marked beats:**
1. "These are **risk signals, not a fraud determination**."
2. "**Deterministic code did the math; the agent explained it** — in plain language, with citations."
3. "**No adverse action without a human approval.** The system cannot act on its own."

**Roles on screen:** investigator `inv.taylor`, supervisor `sup.morgan`.
**Positioning discipline:** risk signals not determinations · deterministic math · human gates · synthetic data.

---

## Timing map (12:00 total)

| Beat | Screen | Stage(s) | Target time | Running |
|---|---|---|---|---|
| Cold open | Command Center (1) | — | 0:45 | 0:45 |
| 1 | Command Center (1) | 1 Intake & triage | 1:15 | 2:00 |
| 2 | Case 360 (2) | 1 → 2 | 1:15 | 3:15 |
| 3 | Claims vs EVV Reconciliation (3) | 2–4 | 2:00 | 5:15 |
| 4 | Evidence Studio (4) | 3 | 1:30 | 6:45 |
| 5 | Risk Signals & Agent Rationale (8) | 4 | 1:30 | 8:15 |
| 6 | Decision Center — investigator (5) | 5 | 0:45 | 9:00 |
| 7 | Provider Response Tracking (6) | 6 | 1:00 | 10:00 |
| 8 | Decision Center — supervisor (5) | 7 | 0:45 | 10:45 |
| 9 | Case Timeline (7) + Task List/SLA (9) | 8–9 | 0:45 | 11:30 |
| Close | Command Center (1) | 9 | 0:30 | 12:00 |

Screens referenced by their CANON §10 numbers: 1 Command Center · 2 Case 360 · 3 Claims vs EVV Reconciliation · 4 Evidence Studio · 5 Decision Center · 6 Provider Response Tracking · 7 Case Timeline · 8 Risk Signals & Agent Rationale · 9 Task List & SLA widgets.

---

## COLD OPEN (0:00–0:45) — Command Center

**Do:** Open the app on the **Command Center** dashboard. Do not click anything yet. Let the queue, SLA tiles, and the signal heatmap sit on screen.

**Say:**
> "A State Medicaid program has millions of Personal Care Services claims a month. Somewhere in that volume is a handful of billing patterns worth a human's attention — an attendant billed as if they were in two homes at once, units billed above what the plan of care authorized, a scanned timesheet that doesn't match the claim. Today I'll walk one case, end to end, the way an investigator in your Office of Program Integrity would. Everything you see is **synthetic** — no real person, provider, or claim. And I want you to hold me to one promise the whole way through: **this system produces risk signals, not a fraud determination.** A human decides. Let's open the case the analytics alert created."

**So what (buyer):** This is triage at scale with an auditable trail — not a black box that accuses providers.

---

## BEAT 1 (0:45–2:00) — Command Center · Stage 1: Alert intake & triage

**Do:**
- Point at the queue row for **PI-PCS-2026-0041 — Harbor Home Support Services**. Note priority **High**.
- Point at the SLA tile and the intake date. Say the case was **opened 2026-07-22** off alert **ALERT-CA-2026-7781** dated **2026-07-20**; "today" is **2026-07-29**.
- Point at the **signal heatmap** — five signal types lit for this case.
- Click into the case to open **Case 360**.

**Say:**
> "A batch claims-analytics model raised alert ALERT-CA-2026-7781 on July 20th. Two days later it opened this case automatically — provider Harbor Home Support Services, one attendant under review. Notice it came in as **High** priority. It didn't come in High because an AI 'felt' it was risky. A **Triage Agent** read the deterministic signal summary and explained, in plain language, which signals drove the priority — and it's required to cite them. The agent explains; it does not re-score. **These are risk signals, not a fraud determination.**"

**So what (buyer):** Prioritization is explainable and defensible on day one — you can tell an auditor exactly why this case jumped the queue.

---

## BEAT 2 (2:00–3:15) — Case 360 · Stage 1 → Stage 2: Automated evidence collection

**Do:**
- Walk the header: **Provider PRV-100482** (Medicaid Provider ID **MPI-4471902**, NPI **1730456789**), **Attendant ATT-2087 — Jordan Ellis**, service period **2026-03-01 → 2026-05-31**.
- Point at the two members, initials only: **MBR-33915 (R.A.)**, POC **20 units/day**; **MBR-40122 (T.N.)**, POC **16 units/day**.
- Point at the posture/stage strip advancing into **Automated evidence collection**, and the counts populating: 9 claims, 44 EVV visits (12-row representative sample shown), evidence documents.

**Say:**
> "Case 360 is the investigator's home base. Members are shown by initials only — R.A. and T.N. — privacy is built into the view, not bolted on. While I've been talking, the platform already did the boring part: RPA pulled the plan of care out of a legacy care-management system that has no API, and API workflows pulled claims and electronic-visit-verification records into Data Fabric. One attendant, two members, a three-month service window. The reviewed period holds **44 visits**; the app shows a **representative 12-visit sample**, and it says so on screen so the numbers stay defensible."

**So what (buyer):** Modern APIs and legacy screen-automation feed the same case record, so an investigator isn't re-keying data across five systems.

---

## BEAT 3 (3:15–5:15) — Claims vs EVV Reconciliation · Stages 2–4

*This is the technical heart of the demo. Slow down. Two anchor beats live here.*

**Do:**
- Open **Claims vs EVV Reconciliation**. Show the line-by-line grid: units billed vs EVV-supported vs timesheet-supported vs improper units.

**Anchor beat A — the 2026-04-14 90-minute overlap:**
- Highlight **EVV-88231** (MBR-33915, **08:00–12:00**) and **EVV-88237** (MBR-40122, **10:30–14:00**) on the same day, same attendant.
- Point at the computed overlap band: **10:30–12:00 = 90 minutes**.

**Say:**
> "Here's the one everyone remembers. On April 14th, Jordan Ellis is recorded serving member R.A. from 8 to noon, and member T.N. from 10:30 to 2. Those two visits overlap from 10:30 to noon — **90 minutes**. One attendant cannot be in two homes at once. Now — the important part — **this 90-minute number was computed by deterministic code**, a rule that checks whether two visit time-ranges intersect. Not an AI guess. I can show you the exact rule and the exact records it ran on. **Deterministic code did the math; the agent explained it.**"

**Anchor beat B — timesheet-vs-billed mismatch:**
- Move to **CLM-0503** (DOS 2026-04-16, MBR-33915): **billed 24**, EVV-supported 24, **timesheet-supported 16 → improper 8**.
- Then **CLM-0491** (04-14): billed 24, EVV 16 → improper **8**. **CLM-0540** (05-19): billed 24, timesheet 20 → improper **4**. **CLM-0549** (05-26): billed 20, EVV 16 → improper **4**.
- Point at the footer total: **24 potentially-improper units** across 4 claims.

**Say:**
> "Supported units are the *lesser* of what the visit record supports and what the timesheet supports — the conservative number, on purpose. Claim CLM-0503 bills 24 units for April 16th, but the scanned timesheet only supports 16. That's 8 units the provider would need to explain. Across four claims — 0491, 0503, 0540, 0549 — that's **8 plus 8 plus 4 plus 4 — 24 units** the billing outruns the evidence. At the blended PCS rate of **$7.20 a unit**, the reviewed sample is **$172.80**. Small — but it's the *pattern* that matters, and the math is transparent enough to hand to opposing counsel."

**So what (buyer):** Every dollar of exposure traces to a specific claim, a specific rule, and a specific source record — no hand-waving.

---

## BEAT 4 (5:15–6:45) — Evidence Studio · Stage 3: Document extraction & validation

**Do:**
- Open **Evidence Studio**. Show the extracted-fields panel beside the source-document preview.
- Show **DOC-TS-0416** (handwritten timesheet, 04-16): extracted **08:00–12:00**, which contradicts CLM-0503's 24 units.
- Point at its **low confidence** score and its **"Needs review"** status → it was **routed to a human** (`inv.taylor`), not auto-confirmed.
- Contrast with a high-confidence doc that was **auto-confirmed** (e.g. **DOC-POC-33915**, plan of care, 20 units/day, pulled by RPA).
- Show **DOC-SN-0414** (service note: single-member AM-only visit on 04-14) corroborating the overlap read.

**Say:**
> "This is where documents become evidence. IXP extracted a handwritten timesheet — DOC-TS-0416 — and read the shift as 8 to noon. But look: the model's confidence on this scan was **low**, so the system did exactly the right thing — it **did not auto-confirm it**. It routed it to a human to validate before it counts against the provider. The plan of care, pulled cleanly from the legacy system, came in high-confidence and auto-confirmed. **The system knows what it's unsure about, and it asks.** A confident wrong answer is the thing you should fear from AI; here, low confidence is a routing decision, not a silent guess."

**So what (buyer):** Extraction accuracy is governed, not assumed — uncertain reads become human tasks, which is auditable and defensible.

---

## BEAT 5 (6:45–8:15) — Risk Signals & Agent Rationale · Stage 4: Correlation & planning

**Do:**
- Open **Risk Signals & Agent Rationale**. Walk the five signals, each showing its **deterministic rule**, inputs, result, severity, and `computed_by = deterministic-calc-v1`:
  - **RS-01** Overlapping visits — **1 overlap on 2026-04-14 (90 min)** — High
  - **RS-02** Manual EVV / missing GPS — **12 of 44 visits (27.3%)** — Medium
  - **RS-03** Units above plan of care — **3 DOS (04-14, 04-16, 05-19), overage 12 units** — High
  - **RS-04** Unsupported units — **4 claims, 24 unsupported units** — High
  - **RS-05** Personnel documentation gap — **cert lapsed 2026-03-31, 8 DOS after lapse, 2 docs missing** — Medium
- Scroll to the **Evidence Correlation Agent** and **Summary Agent** narrative. Point out the explicit **FACT (cited)** vs **INFERENCE (suggested, for human review)** labeling and the citations back to signal/claim/doc IDs.

**Say:**
> "Five deterministic signals — and every one shows the rule it ran and the records it ran on. The overlap. Manual visits with no GPS — 12 of 44. Units above the authorized plan of care — 12 units over across three days. Unsupported units — the 24 we just reconciled. And a personnel gap — Jordan Ellis's PCA certification lapsed March 31st, yet there are 8 dates of service after that, plus two missing personnel documents. Now read the agent's narrative. Notice it separates **FACT** — with a citation to a signal or a document — from **INFERENCE**, which it labels as *suggested, for human review*. The agent never does arithmetic and never invents a claim; it references the deterministic values by ID and organizes them into something a human can read in thirty seconds. **Deterministic code did the math; the agent explained it — and every sentence is grounded.**"

**So what (buyer):** You get the speed of AI narrative with none of the hallucination risk — because the agent is fenced to cited facts and forbidden from scoring or calculating.

---

## BEAT 6 (8:15–9:00) — Decision Center (investigator) · Stage 5: Investigator human review

**Do:**
- Open **Decision Center** as **`inv.taylor`**. Show the investigator validating/adjusting signals and editing the narrative.
- Investigator selects **"Proceed to records request"** and records a rationale. Note this is *not* an adverse/financial action — it's an information request.

**Say:**
> "The investigator, Taylor, is in control here. Taylor can accept a signal, adjust it, or set it aside — and the case narrative is editable. Taylor decides the responsible next step isn't to accuse anyone; it's to **ask the provider for records** and give them a chance to explain. That's due process, and it's a human's call."

**So what (buyer):** The workflow enforces give-the-provider-a-chance before anything punitive — good government, and it's built into the tool.

---

## BEAT 7 (9:00–10:00) — Provider Response Tracking · Stage 6: Records request & wait state

**Do:**
- Open **Provider Response Tracking**. Show the outbound **records request** sent to Harbor Home Support Services and the case entering an **Awaiting Provider** wait state.
- Show inbound **DOC-CORR-01** (provider correspondence) arriving into the records-request inbox during the wait; the case **resumes** and **reprocesses** the new document.
- Point out the case status flips **Awaiting Provider → back In Review**.

**Say:**
> "The request goes out and the case does something most systems can't do gracefully — it **waits**. It's not stuck; it's suspended, holding its place in the queue with the SLA clock managed. When the provider's response — DOC-CORR-01 — lands in the intake inbox, the case **wakes up on its own and reprocesses** the new evidence into the same record. No investigator sitting on it, no email thread lost. A long-running case that pauses for the real world and picks up exactly where it left off."

**So what (buyer):** Real investigations take weeks and involve outside parties — the platform models that wait natively instead of forcing a human to babysit it.

---

## BEAT 8 (10:00–10:45) — Decision Center (supervisor) · Stage 7: Supervisor approval / disposition

**Do:**
- Switch role to supervisor **`sup.morgan`**.
- Try to advance an **adverse/financial** disposition (refer for audit + open overpayment recovery). Show the **gate**: the action is **blocked without supervisor approval**.
- Supervisor reviews the narrative + citations and **approves**. Show the decision record capturing `decided_by = sup.morgan`, `adverse_or_financial = true`, `approved = true`.

**Say:**
> "Now the consequential step. The recommendation to refer for audit and open an overpayment recovery is exactly that — a **recommendation** from the Planning Agent. Watch what happens when we try to execute it without approval: **the system stops us.** Any adverse or financial action is gated. Supervisor Morgan reviews the same evidence and the same citations, and Morgan — a human — approves it. The decision record stamps who approved it and when. **No adverse action without a human approval.** The AI cannot cross this line by itself, by design."

**So what (buyer):** This is the compliance headline — a hard, logged human gate on every action that affects a provider or moves money.

---

## BEAT 9 (10:45–11:30) — Case Timeline (7) + Task List & SLA (9) · Stages 8–9

**Do:**
- **Stage 8:** Show the **referral packet** generated and the **overpayment recovery** opened, provider notified.
- Open **Case Timeline** — the immutable event stream. Scroll it: every signal computed, doc extracted, human validation, request sent, response received, approval, action executed — each an `InvestigationAction` with actor and actor-kind (Human / System / Agent).
- **Stage 9:** Show closure — case **Closed**, audit record written, **Harbor Home Support Services added to the provider watch list**.
- Glance at **Task List & SLA widgets** — Action Center tasks and due dates for the executed items and monitoring.

**Say:**
> "Once approved, execution is automated: the referral packet assembles itself, the overpayment recovery opens, the provider is notified. And here's the artifact your auditors and your legal team will actually live in — the **case timeline**. It's immutable and append-only. Every single event — every signal the code computed, every document extracted, every human validation, the request, the response, the approval, the execution — is stamped with who did it and whether it was a human, the system, or an agent. We close the case, write the audit record, and add the provider to a **watch list** so the pattern gets monitored going forward. Nothing in this case happened that we can't reconstruct."

**So what (buyer):** Complete chain of custody and a monitoring loop — audit-ready by construction, not as an afterthought.

---

## CLOSE (11:30–12:00) — Command Center

**Do:** Return to **Command Center**. The case has left the active queue; the heatmap and SLA tiles reflect the closure.

**Say:**
> "That's one case, start to finish, in about ten minutes — and the same pattern scales across your whole PCS book. What did the platform actually do? It **found the risk signals** — deterministically, with the math shown. It **organized the evidence** and explained it in language a human can act on, with citations. And it **routed every real decision to a person**, and refused to take adverse action without one. Risk signals, not determinations. Deterministic math, explained by grounded agents. Human gates on everything that matters. On synthetic data today — on your data, in your tenant, next."

---

## APPENDIX — "If asked" Q&A

**Q: Is this auditable? Can you prove what happened?**
Yes. Every state change appends an immutable `InvestigationAction` row — actor, actor-kind (Human / System / Agent), timestamp, before/after values. The Case Timeline (screen 7) renders that stream. Deterministic signals store their exact rule expression and the inputs they ran on (`computed_by = deterministic-calc-v1`). You can reconstruct any number on any screen back to source.

**Q: What about data privacy / PHI?**
Members are shown by **initials only** (R.A., T.N.) throughout the UI. The case is marked **Restricted / investigative work product**. In a real deployment this runs in your tenant with your access controls; today it's **entirely synthetic data** — no real person, provider, or claim. Agents are grounded on case data only and don't retain or train on it.

**Q: How do you handle false positives?**
Two ways. First, signals are **risk indicators, not conclusions** — a signal existing doesn't accuse anyone. Second, the workflow builds in the provider's chance to respond (Stage 6 records request) *before* any disposition, and a human can set aside any signal in the Decision Center. The system also tracks an **overturn rate** (how often a human disagrees with a signal) so you can tune the rules. Low-confidence extractions never auto-confirm — they go to a human (Stage 3).

**Q: Can the AI act on its own — refer a provider, claw back money?**
**No.** Deterministic code computes the signals; agents only explain and organize and are forbidden from scoring policy or doing arithmetic. Every adverse or financial action is **hard-gated behind a supervisor approval** (Stage 7) — we demonstrated the system blocking the action until `sup.morgan` approved. The metric for this in Insights should read **100% of adverse/financial actions carry a human approval**.

**Q: Does the system determine fraud?**
No — and we're deliberate about the vocabulary. The system produces **risk signals**: deterministic, explainable indicators worth a human looking at. A **fraud determination** is a human and legal conclusion the system never claims to make about its own output.

**Q: Where do the exposure numbers come from, and are they a demand?**
Deterministic math on the improper units: reviewed sample **$172.80** (24 units × $7.20), reviewed period **≈ $1,600** projected, provider-wide **indicative $18K–$42K pending audit**. Always presented as a **range for investigator context — subject to human validation, not a determination or a demand**.

**Q: Deterministic vs agent — where's the line exactly?**
Deterministic calculators do all arithmetic and rule evaluation: overlap detection, units-above-POC, unsupported units, threshold breaches. Agents (Triage, Evidence Correlation, Investigation Planning, Summary) read those results and the source documents and produce grounded narrative — FACT (cited) separated from INFERENCE (suggested, for human review). If an agent ever states a number, it's quoting a deterministic result by ID, not computing it.

**Q: What if the provider's response changes the picture?**
The case reopens and reprocesses it (we showed DOC-CORR-01 arriving in the wait state). New evidence flows into the same record and the narrative updates before any disposition is finalized.

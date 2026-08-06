# Program Integrity 360 Demo Script

**Length:** 10-12 minutes

**Audience:** State Medicaid Office of Program Integrity leaders and delivery teams

**Case:** `PI-PCS-2026-0041`, Harbor Home Support Services - PCS billing integrity review
**Data:** Synthetic. The app's `Demo data` label means deterministic fallback records, not live UiPath case data.

## Objective And Narrative

Show how an investigator moves from a claims-analytics alert to organized evidence, a bounded human work item, supervisor decision context, and an auditable closure path without allowing an agent or a rule to make a fraud determination.

The case concerns Harbor Home Support Services and attendant Jordan Ellis. A claims-analytics alert found patterns worth review: a 90-minute overlapping visit on 2026-04-14, billed units above the plan of care, unsupported units where claims, EVV, and timesheets disagree, and a personnel documentation gap. The investigator validates the record and requests evidence; the provider response does not resolve the 04-16 mismatch. A supervisor can then evaluate a referral and recovery recommendation. These are **risk signals, not a fraud determination**.

Say early and repeat at the decision point:

> "Deterministic rules calculate the overlaps, unit overages, and unsupported units. Agents explain the evidence and organize next steps. A human approval is required before any adverse or financial action."

## Why This Workbench

This is a live-first, six-stage workbench rather than a collection of disconnected screens. OAuth connects the app to UiPath when approved case, task, and agent artifacts are available; otherwise, the same view model uses clearly labeled deterministic demo records. That makes the demonstration reliable without silently presenting synthetic records as live.

The case workspace keeps evidence, decisions, and activity on one selected record. Task work remains separated into `This Case` and `Folder Inbox`, and the only external iframe is the selected Action Center task drawer. Completion is never inferred from an agent response or an iframe: the app polls the Tasks API and only treats a returned `Completed` status as completion. The Record Assistant is grounded in selected-case context and can hand a person to an Action Center task, but it does not create or complete work.

## Setup And Reset

1. Start in a clean browser session with no task drawer or Record Assistant panel open. Select `Investigator` and open `Command center`.
2. Confirm the header source badge before speaking. Use `Demo data` for the deterministic presentation path. For a pre-approved live proof, click `Connect UiPath`, complete OAuth, and proceed only when the badge reads `Live UiPath` and the intended case/task records are visible.
3. In `Command center`, confirm that `PI-PCS-2026-0041` is present. Its expected demo state is `High`, `In Review`, and `Investigation and case management`.
4. For the live completion branch, pre-verify a published, non-production test task and its Action Center URL. Do not complete a real operational task during the presentation.
5. Do not describe the target as deployed. The intended deployment location is `staging.uipath.com`, organization `uipathlabs`, tenant `Playground`, folder `AMER Presales/Public Sector/ProgramIntegrity360 1`, folder key `25fea2ac-3f4e-4f6f-a7f6-a3cab1b92be4`.

**Deterministic fallback:** If OAuth fails, live discovery fails, or the live artifact is unpublished, use `Use demo data` when offered, verify the `Demo data` badge, and continue the scripted record. In demo mode, no action completes a real task and no simulated completion is shown. Unpublished live case, task, and agent artifacts still require contract verification after publication.

## Timed Walkthrough

| Time | Click path | Point to |
|---|---|---|
| 0:00-1:00 | source badge -> `Command center` | live-first status and one case narrative |
| 1:00-2:15 | open `PI-PCS-2026-0041` -> `Case workspace` | six-stage journey and investigator context |
| 2:15-4:30 | `Evidence` | signals, reconciliation, documents, provider response |
| 4:30-6:15 | `Decisions` -> `Task Center` | human gate, case versus folder work, Action Center drawer |
| 6:15-7:30 | `Open record assistant` | question, answer, and app handoff |
| 7:30-8:45 | `Activity` | ordered evidence of case, task, agent, and user activity |
| 8:45-10:15 | `Supervisor` -> `Decisions` | approval posture and decision context |
| 10:15-11:00 | six-stage strip -> `Command center` | closure path and operating value |

### 1. Source Status And Command Center (0:00-1:00)

**Click:** Confirm `Demo data` or `Live UiPath` in the header, then select `Command center`. If presenting the live branch, start with `Connect UiPath` and say that this is OAuth connectivity, not a claim that the case artifacts are already published or contract-verified.

**Say:**

> "Program Integrity 360 gives an investigator one controlled path from a signal to a human decision. The source badge is deliberate. `Live UiPath` means the app retrieved live UiPath data through the configured OAuth session. `Demo data` means this deterministic synthetic case is being used for a reliable walkthrough. We do not blend the two or label demo records as live."

**Click:** In `Case queue`, open `PI-PCS-2026-0041` using its `Open` control.

**Say:**

> "The queue makes workload, priority, stage, SLA, and exposure visible before someone opens a record. The value is triage: an investigator can direct attention to explainable risk without treating a provider as fraudulent."

### 2. Six-Stage Case Workspace (1:00-2:15)

**Click:** Remain in `Case workspace`. Read the `Six-stage case journey` left to right: `Alert intake and triage`, `Evidence acquisition and validation`, `Investigation and case management`, `Provider response`, `Supervisor review and approval`, and `Closure and monitoring`.

**Say:**

> "This is the entire operating path, not nine disconnected application screens. In this demo snapshot, intake and evidence are complete and investigation is the active route. The strip makes route state and linked work visible without pretending that later stages have occurred. It is valuable because work can be handed off with its context, not reconstructed from email and spreadsheets."

**Point to:** `Investigator work`, including evidence review, flagged claims, and active route. On `Overview`, show `Claims under review` and `Case context` for Harbor Home Support Services, Jordan Ellis, and the restricted case posture.

**Say:**

> "The case is scoped to one provider, one attendant, and a three-month service period. Members are represented by identifiers, and the investigator sees the evidence posture rather than a black-box score."

### 3. Investigator Evidence, Signals, And Decision Basis (2:15-4:30)

**Click:** Select `Evidence`. In `Evidence validation`, show `DOC-TS-0416`, then `Reconciliation exceptions`. Keep the `Provider response` notice in view.

**Say:**

> "The investigator validates evidence instead of accepting extraction blindly. DOC-TS-0416 is human-validated: the handwritten timesheet supports 16 units on April 16, while claim CLM-0503 billed 24. That is a specific discrepancy a provider can address, not a determination."

**Point to:** the reconciliation rows for CLM-0491, CLM-0503, CLM-0540, and CLM-0549; then the risk-signal list.

**Say:**

> "The rules are transparent. RS-01 finds one 90-minute overlap on April 14 between EVV-88231 and EVV-88237. RS-03 identifies 12 units above the plan of care across three dates. RS-04 identifies 24 de-duplicated unsupported units across four claims. Deterministic rules calculate these values; agents do not do the arithmetic. The provider response is retained because evidence that does not resolve a discrepancy is still evidence."

**So what:** The click path gives the investigator a reviewable chain from source document and calculation to the next human decision, rather than an unexplained risk score.

### 4. Decisions And Action Center Work (4:30-6:15)

**Click:** Select `Decisions`. In investigator mode, show `Investigator assessment` and `Decision history`.

**Say:**

> "The assessment can recommend a records request or escalation, but the decision history preserves who took the action and why. Nothing here labels the signals as fraud, and no adverse or financial action is automated."

**Click:** Select `Task Center`, then `This Case (2)`. Open Task `1002`, `Investigator review - reconciliation and narrative`, by clicking `Open`.

**Say:**

> "This is selected-case work, not a generic to-do list. The drawer is the only external iframe in the product: the Action Center form is embedded only after a person opens this specific task. Its stage, assignee, SLA, and source scope stay visible around it."

**Live-only branch:** With `Live UiPath` visible and a verified published test task, leave the drawer open after the form is completed in Action Center. The app polls the Tasks API every three seconds. Only when the drawer states, `Tasks API confirmed this task is Completed`, say:

> "Completion is confirmed by the Tasks API, not inferred from the iframe, an agent response, or a button click. The workspace refresh follows that confirmation."

Do not claim completion if that message is absent.

**Demo/unpublished fallback:** With `Demo data`, or when the drawer says `Live task polling is unavailable for this demo or unpublished task`, say:

> "This fallback intentionally does not complete anything. Use `Open in Action Center` only to inspect the available route; the demo never completes a real task."

**Click:** Close the drawer. Select `Folder Inbox (1)`, open `Validate low-confidence extraction - DOC-SN-0414`, point out `Folder Inbox task`, then close it.

**Say:**

> "Folder inbox work stays explicitly separate from this case. That separation prevents an unrelated task from being represented as a case decision."

### 5. Record Assistant And Handoff (6:15-7:30)

**Click:** Return to `Case workspace`, then click `Open record assistant`. Enter `What is my next task?` in `Message Record Assistant` and send it.

**Say:**

> "The assistant is grounded in the selected case's stage, evidence, decisions, tasks, and correlation IDs. In demo mode its answer is visibly labeled `Demo data`; in a verified live path the panel is labeled `Live agent`. In both cases, it explains and routes. It does not calculate policy results or take action."

**Demo branch:** In the response, show `Demo task preview` for Task 1002. Point out that it is intentionally non-completable and does not expose an Action Center control.

**Verified live-only branch:** When the source badge reads `Live UiPath` and the assistant returns a real selected-case task, show `App handoff`, click `Open in Action Center`, and close the drawer without completing the task unless the pre-approved completion branch is part of the session.

**Say:**

> "The live handoff is intentionally app navigation, not an agent tool call. In demo mode we show only a task preview. In live mode, the assistant still cannot complete the task: a human works it in Action Center, and only a Tasks API `Completed` response can change the app's completion posture."

### 6. Activity And Correlation (7:30-8:45)

**Click:** Close the assistant, select `Activity`, and filter `Source` to `Task` and then `Agent`; return to `All sources`.

**Say:**

> "This is the full case timeline: Maestro, task, agent, user, and app events in deterministic order. Each row has a correlation ID. We can trace an alert, rule calculation, evidence validation, recommendation, and approval context without exposing tokens, OAuth callback data, or raw private payloads."

**So what:** A reviewer can distinguish what the platform calculated, what an agent said, and what a person did.

### 7. Supervisor Context And Closure (8:45-11:00)

**Click:** Use the `Supervisor` role switch. Return to `Decisions` and show `Supervisor workbench`, `Supervisor dispositions`, and `Decision history`.

**Say:**

> "The role switch changes the workbench's context; it does not bypass UiPath permissions. The supervisor sees approval posture, period exposure, high signals, the gated approval task, and the decision history. The recommendation may be to refer for audit and open recovery, but it remains a human decision subject to validation."

**Point to:** the six-stage strip's `Closure and monitoring` stage.

**Say:**

> "Closure is a controlled final stage, not an automatic consequence of a signal. After the required human approval and any approved action, the case record can close with monitoring and a correlated audit trail. This snapshot remains in investigation; we do not advance or close it for effect."

**Click:** Return to `Command center`.

**Close with:**

> "Program Integrity 360 identifies risk signals, organizes evidence, and routes decisions to accountable people. Deterministic rules calculate, agents explain, and human approval gates adverse action. The workbench is designed live-first, with a truthful demo fallback while unpublished live case, task, and agent contracts are verified later."

## Presenter Guardrails

- Do not call a risk signal fraud, a finding, a recovery demand, or a determination.
- Do not say a live case, task, Action Center route, or record agent is deployed or verified unless the source badge, records, and contract checks prove it in that session.
- Do not represent an iframe load, agent answer, task drawer close, or demo interaction as task completion. Say `Completed` only after the explicit Tasks API confirmation appears.
- Do not show a real operational task. Use a pre-approved test task for the live-only completion branch, or continue with `Demo data`.

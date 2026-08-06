# Launch Checklist — Program Integrity 360

A short, repeatable runbook to get the demo into a known-good state and recover fast if something drifts.
Target environment: **staging.uipath.com / uipathlabs / Playground**. All data is **synthetic**.

---

## T-1 day — provisioning (run once)
- [ ] `uip login` to staging.uipath.com, org **uipathlabs**, tenant **Playground** (interactive browser).
- [ ] Deploy the solution per `solution/deploy.md` (`pack → publish → deploy → activate`, name **Program Integrity 360**).
- [ ] Confirm Data Fabric entities exist (9): ProgramIntegrityCase, Provider, Attendant, Claim, EVVVisit,
      RiskSignal, EvidenceDocument, InvestigationAction, Decision — see `platform/data-fabric-and-plumbing.md`.
- [ ] Confirm queues (`pi-evidence-collection`, `pi-human-review`, …), bucket `pi-evidence`, and the two
      triggers (`tr-intake-alert`, `tr-records-response`) are present.
- [ ] Confirm the Coded App **Program Integrity 360** is published and reachable; OAuth-PKCE login works.
- [ ] Confirm the 4 agents (Triage, Evidence Correlation, Investigation Planning, Summary) are deployed and
      bound to the case type.
- [ ] Confirm two demo users exist with correct roles: `inv.taylor` (Investigator), `sup.morgan` (Supervisor).

## T-1 hour — seed / reset the reference case
> Goal: the tenant holds exactly ONE case, `PI-PCS-2026-0041`, in a clean, internally consistent state.
- [ ] Seed entities from `data/*.json` (providers → attendants → case → claims → evv_visits → risk_signals →
      evidence_documents → decisions → investigation_actions). Load order matters (FK references).
- [ ] Verify the deterministic calculator has run and stored RS-01..RS-05 with `computed_by = deterministic-calc-v1`.
- [ ] Verify exposure fields on the case: low **$172.80**, period **≈$1,600**, high **$42,000** + disclaimer.
- [ ] Upload the 6 evidence documents to bucket `pi-evidence/PI-PCS-2026-0041/`.
- [ ] Decide the demo mode (pick ONE):
  - **A. Completed reference case** (default): case = `Closed`, full timeline visible (ACT-0001..ACT-0015).
    Best for narrating the whole arc quickly.
  - **B. Live walk-through**: reset case to `stage = Investigator human review`, `status = In Review`, remove
    ACT-0009..ACT-0015 and DEC-0002 so you can click through the investigator decision, provider-response
    resume, and supervisor approval live. (Keep RS-01..RS-05, docs, agent v1 narrative.)

## T-15 min — smoke test (do not skip)
Run the compact smoke checklist in `test/test-plan.md`. Minimum green-light set:
- [ ] Command Center loads and shows case `PI-PCS-2026-0041` with 5 risk signals.
- [ ] Reconciliation screen shows the 9 claims and the improper-unit math (8+8+4+4 = **24**).
- [ ] Risk Signals screen shows the **90-minute** overlap on **2026-04-14** (EVV-88231 × EVV-88237).
- [ ] Evidence Studio shows DOC-TS-0416 flagged for human validation (confidence 0.71).
- [ ] Agent rationale renders with **FACT / INFERENCE** labels and citations; no uncited claim.
- [ ] Decision Center: adverse/financial action is **disabled** for `inv.taylor`, **enabled** for `sup.morgan`.
- [ ] Case Timeline renders the InvestigationAction rows in order.
- [ ] The non-determination disclaimer is visible on the case header.

## Demo-day runbook (order of screens)
Follow `docs/04-demo-script.md`. Screen order: Command Center → Case 360 → Claims vs EVV Reconciliation →
Evidence Studio → Risk Signals & Agent Rationale → Decision Center (investigator) → Provider Response
Tracking → Decision Center (supervisor approval) → Case Timeline → Insights.

## Fallbacks (if the live tenant misbehaves)
- [ ] Have `docs/04-demo-script.md` open with the wireframes (`coded-app/wireframes.md`) as a static backup.
- [ ] Have screenshots of the 9 screens captured T-1 day as a slide backup.
- [ ] If an agent call is slow/unavailable, narrate from the pre-stored agent outputs in
      `agents/*.md` and `investigation_actions.json` (ACT-0003/0006/0007/0012).
- [ ] If entity writes fail, switch to demo mode **A** (read-only completed case) and narrate.

## Reset between runs
- [ ] Re-seed from `data/*.json` (mode A) or re-apply the mode-B trim.
- [ ] Clear any human tasks generated during a live run from Action Center.
- [ ] Confirm no second/duplicate case was created by an accidental trigger fire.

## Talk-track guardrails (say these, every time)
- "Program Integrity 360 surfaces **risk signals** and organizes evidence — it does **not** make a fraud determination."
- "**Deterministic code** computed every number; the **agent explained** it and cited the source."
- "**No adverse or financial action** happens without a **human approval**."
- "All data here is **synthetic**."

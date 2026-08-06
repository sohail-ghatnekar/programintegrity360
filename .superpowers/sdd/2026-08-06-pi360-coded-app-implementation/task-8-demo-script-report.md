# Task 8 Report: PI360 Demo Script Rewrite

## Result

Replaced the obsolete nine-stage, multi-screen narrative in `docs/04-demo-script.md` with a 10-12 minute script for the current six-stage live-first workbench.

The script is grounded in the approved design and implementation plan, `CANON.md`, and the current React UI. It covers the header source state, `Command center`, `Case workspace`, the six-stage journey, investigator evidence and decisions, `Task Center` with `This Case` and `Folder Inbox`, the single Action Center iframe drawer, live Tasks API confirmation, the `Record Assistant` handoff, activity correlation, supervisor context, and the closure path.

## Truthfulness Boundaries

- `Live UiPath` is presented as an OAuth-backed path only when the badge and the visible records support it. `Demo data` is explicitly deterministic synthetic fallback.
- Demo mode never completes a real task. The script permits completion language only when the UI states that the Tasks API confirmed `Completed`.
- The script states that unpublished live case, task, and agent artifacts require contract verification after publication.
- The stated intended deployment target is `staging.uipath.com`, organization `uipathlabs`, tenant `Playground`, folder `AMER Presales/Public Sector/ProgramIntegrity360 1`, folder key `25fea2ac-3f4e-4f6f-a7f6-a3cab1b92be4`. It makes no claim that the app is deployed there.
- No application code, cloud command, deployment command, or GitHub push was run.

## Verification

Reviewed the rewritten script against:

- `CANON.md`
- `ProgramIntegrity360/docs/superpowers/specs/2026-08-06-pi360-coded-app-design.md`
- `ProgramIntegrity360/docs/superpowers/plans/2026-08-06-pi360-coded-app-implementation.md`
- Current `ProgramIntegrity360/PI360CodedApp` React source for labels, source states, task polling, assistant handoff, timeline, role switch, and six stages

Ran `git diff --check` after the documentation edit. No JavaScript or TypeScript files changed, so the workspace rule requiring `npm test` after JavaScript modification did not apply.

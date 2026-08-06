# Program Integrity 360 Coded App Design

## Objective

Rebuild `PI360CodedApp` as an OAuth-enabled, live-first case-management workbench for the Program Integrity 360 demo. The app must tell the end-to-end story of a case while preserving human control, exposing UiPath execution state, and allowing Action Center tasks to be completed without leaving the case workspace.

The app serves two demo-switchable views:

- Investigator/Caseworker
- Supervisor

The authenticated UiPath identity and platform permissions remain authoritative. Changing the demo role changes presentation and available UI controls, but does not bypass UiPath authorization.

## Scope

The redesign is limited to the coded web app in `PI360CodedApp`. Existing Maestro, Case Management, agent, automation, API workflow, and coded action-app projects are consumed as deployed dependencies and are not redesigned in this work.

The app will be deployed independently as a UiPath Coded Web App into:

`AMER Presales/Public Sector/ProgramIntegrity360 1`

The friendly UI label may use `Program Integrity 360 1`.

After the new app is verified, the obsolete `AMER Presales/Public Sector/ProgramIntegrity360` solution deployment may be uninstalled so that only the newest solution folder remains. This destructive step requires explicit deployment approval and must happen only after the new app is healthy.

## Experience

### Application Shell

Use Apollo Vertex principles and components from the official [UiPath Apollo UI repository](https://github.com/UiPath/apollo-ui):

- Compact, task-focused application shell
- Labeled navigation and recognition over recall
- Apollo tokens and Tailwind-oriented Vertex styling
- Transparent status, source, confidence, and ownership indicators
- Restrained use of cards, dialogs, and decorative elements
- Accessible focus, contrast, keyboard behavior, and responsive layouts

The first screen is the operational Command Center, not a marketing page.

### Primary Views

1. Command Center
   - Live case queue
   - Workload, priority, SLA, exposure, and task metrics
   - Clear live-data or demo-data status
2. Case Workspace
   - Provider and subject context
   - Claims and EVV reconciliation
   - Evidence and source confidence
   - Human and agent decisions
   - Provider response
   - Audit and execution timeline
3. Task Center
   - `This Case` tab for tasks returned by the selected case instance
   - `Folder Inbox` tab for tasks accessible in the target folder
   - Status, type, priority, assignee, SLA, stage, and last update
4. Record Assistant
   - Embedded conversational-agent panel grounded in the selected case
   - Case context remains visible while chatting
   - Advisory responses distinguish facts, inferences, and human decisions

### Six-Stage Journey

The app mirrors the deployed case plan instead of the obsolete nine-step frontend model:

1. Alert intake and triage
2. Evidence acquisition and validation
3. Investigation and case management
4. Provider response
5. Supervisor review and approval
6. Closure and monitoring

Each stage displays its live state, task counts, completion progress, decision reason, and relevant execution events. Ad-hoc routes remain visible without implying a fixed linear sequence.

### Role Views

Investigator/Caseworker emphasizes evidence validation, reconciliation, provider-response work, case notes, and investigator tasks.

Supervisor emphasizes approval tasks, exposure context, escalation posture, decision history, and gated dispositions.

A visible segmented role control supports demo narration. The signed-in identity remains visible in the shell.

## Action Center Tasks

The app lists live tasks through the UiPath TypeScript SDK.

- Case tasks come from `CaseInstances.getActionTasks()`.
- Folder tasks come from `Tasks.getAll({ folderId })`.
- Task assignment and completion state is refreshed from UiPath after every operation.

Selecting a task opens a large task drawer. The native Action Center task page is rendered in an iframe and is the only external experience embedded by the app. The case workspace remains behind the drawer for context.

Because Action Center is cross-origin, the app does not inspect iframe content. While the drawer is open, it polls the Tasks API. When the task becomes completed, the app refreshes the task list, stages, and timeline.

If UiPath or browser framing policy blocks the task page, the drawer preserves the task context and exposes a canonical authenticated `Open in Action Center` link. The app must not claim that a task completed until the Tasks API confirms it.

## Authentication

Use OAuth 2.0 Authorization Code with PKCE through `@uipath/uipath-typescript`.

- Runtime configuration comes from UiPath-injected metadata and `uipath.json` for local development.
- No access tokens or secrets are manually handled or persisted by application code.
- OAuth state survives normal page refreshes.
- Callback parameters are removed after successful completion without clearing a valid session.
- Authentication loss produces a recoverable reconnect state without discarding the current case selection.

Required scopes cover cases, Maestro process visibility, Action Center tasks, folders, users, jobs, conversational agents, and traces needed by the app.

## Data Architecture

### Live Adapter

The live adapter uses the UiPath SDK services:

- `Cases` for available case processes
- `CaseInstances` for instances, stages, action tasks, and execution history
- `Tasks` for the folder inbox and task operations
- `ConversationalAgent` for `PI360RecordConversationAgent`

The app discovers the Program Integrity case by deployed name/process metadata rather than relying on obsolete hard-coded process identifiers.

### Demo Adapter

The existing deterministic Program Integrity record becomes a typed demo adapter. It supplies the same view model as the live adapter when:

- Authentication is intentionally skipped during local visual testing
- No live case instance exists
- A live request fails and the user elects to continue with demo data

Demo state is always labeled. It must never be presented as a successful live API result.

### View Model

Both adapters normalize into a shared model containing:

- Case identity and ownership
- Provider and subject details
- Six stages and their tasks
- Claims, evidence, and risk signals
- Human decisions and agent recommendations
- Action Center tasks
- Execution and UI activity events

This keeps components independent of raw SDK response shapes and allows deterministic testing.

## Conversational Agent

`PI360RecordConversationAgent` remains the selected agent. A new session is created for the selected case and reset when the case changes.

The grounding payload includes the normalized case, stage status, evidence, decisions, pending tasks, and recent execution events. The agent may explain records and coordinate task intent, but it must not claim an external action occurred until the host app provides a confirmed API result.

The chat uses the Apollo embedded-copilot model: a stable right-side panel that does not reflow with navigation changes. Suggested prompts remain editable and free-text input is always available.

## Visibility And Logging

The app presents a unified timeline combining:

- Maestro case execution history
- Stage and task transitions
- Action Center state changes
- Agent session and exchange events
- User decisions and UI operations
- Live-data failures and demo fallback activation

Client operations emit structured log entries with timestamp, source, severity, status, case identifier, task identifier when applicable, and a generated correlation identifier. Logs support the demo narrative without exposing tokens or sensitive payloads.

## Error Handling

- Preserve usable data when one service fails.
- Identify the failing source and affected feature.
- Offer retry before demo fallback.
- Stop task polling on completion, timeout, drawer close, or authentication loss.
- Do not enable supervisor actions in investigator mode.
- Do not represent agent recommendations as determinations.
- Do not represent iframe interaction as completion until verified by the Tasks API.
- Provide a direct task link when iframe embedding fails.

## Testing

Automated tests cover:

- Live and demo adapter normalization
- OAuth callback and session persistence
- Case discovery and six-stage mapping
- Role-specific visibility and controls
- Case and folder task filtering
- Canonical Action Center task URL construction
- Task polling and completion refresh
- Agent context creation and case-session reset
- Partial failures and fallback behavior

Required local verification:

- `npm test`
- `npm run lint`
- Production build
- Playwright desktop and mobile screenshots
- Visual checks for both roles, all six stages, task drawer states, and the agent panel
- Overflow, overlap, focus, and responsive-layout checks

Required cloud verification after explicit approval:

- OAuth sign-in and refresh persistence
- Live case and six-stage loading
- Case and folder task inventories
- Action Center iframe behavior and direct-link fallback
- Task completion reflected in tasks, stages, and timeline
- Conversational agent availability
- App deployment in `ProgramIntegrity360 1`
- Old solution folder removed only after successful verification

## Deployment Boundary

Local implementation and testing proceed without additional permission. Before any Studio Web push, coded-app publish, coded-app deploy, solution uninstall, or folder removal, request explicit user approval and report the exact target and destructive operations.

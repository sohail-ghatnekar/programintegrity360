# Command Center Case Intake Design

## Goal

Extend the existing Program Integrity 360 coded app so an authenticated user can start a new Medicaid review case from Command center, see it registered by the Maestro intake stage in Data Fabric, and open it from a newest-first paginated queue.

## User experience

- Place an orange **Start new case** button beside the existing total-case badge.
- Open a compact modal with:
  - a scenario selector for **Medicaid PCS** or **State Medicaid Hospice**;
  - a requester email prefilled from the authenticated UiPath profile when available and editable before submission;
  - Cancel and Start case actions.
- Generate a unique business case ID for every submission:
  - PCS: `PI-PCS-<year>-<six-character suffix>`
  - Hospice: `PI-HSP-<year>-<six-character suffix>`
- Disable duplicate submission while the start request is pending.
- After the process starts, wait briefly for the Maestro-owned Data Fabric registration, refresh the case queue, select the new case, and open its workspace.

## Scenario catalog

Keep the two launch paths in a typed scenario catalog rather than embedding conditionals in the form. Each catalog entry builds the six existing trigger objects:

- `caseInput`
- `claimInput`
- `memberInput`
- `providerInput`
- `serviceEventInput`
- `documentInput`

`caseInput` also carries `requesterEmail`. The catalog reuses the approved synthetic PCS and hospice facts. Adding a future path requires a new catalog entry and corresponding Maestro `CaseType` branch, not a new form architecture.

## Process start contract

The coded app resolves the deployed **Program Integrity 360 Case** release in folder ID `2182825` and starts it through the UiPath Processes SDK. The request passes the six trigger objects as input arguments and uses the unique case ID as the correlation reference.

The coded app does not write the authoritative Data Fabric case record.

## Maestro-owned registration

The existing first required task in **Intake and triage**, `API - intake claim and select CaseType profile`, remains the first node after the trigger. Its `IntakeClaimByCaseType` path is extended to perform an idempotent registration of the case in `PI360ProgramIntegrityCase`.

Registration behavior:

1. Validate `CaseType`, case ID, and requester email.
2. Build the initial case record from the six trigger objects.
3. Insert or update by the unique `case_id` so task retries cannot create duplicates.
4. Return a registration status and the persisted case ID.
5. Only then allow the existing triage agent task to run.

The entity gains two optional fields:

- `requester_email`
- `maestro_instance_id`

`case_id` remains the business correlation key. `maestro_instance_id` records the runtime correlation when Maestro exposes it to the intake task; otherwise it is left empty rather than populated with a job key or guessed value.

## Queue refresh and consistency

After a successful process-start response, the app polls the Data Fabric case list for the generated case ID for a bounded period. When found, it refreshes the workspace and opens the case.

If registration is still pending at the timeout, the app reports:

> Process started; workspace registration is pending for <case ID>.

The app does not automatically resubmit. The user can refresh the queue safely because the Maestro registration is idempotent.

## Pagination and ordering

- Sort cases by `sourceUpdatedAt` descending, with case ID as a stable tie-breaker.
- Show 10 cases per page.
- Keep Previous and Next controls with disabled boundary states.
- Reset to the first page when a newly registered case is loaded so the newest record is visible.
- Display `Showing X-Y of Z` for the current page.

## Error handling

- Invalid scenario or email: reject before calling UiPath.
- Process start failure: keep the modal open and show the service error.
- Process started but registration delayed: show the pending message and preserve the generated case ID.
- Data Fabric registration failure: fault the Maestro intake task with a clear error so the case can be diagnosed and retried without duplicating the record.
- Unauthenticated demo mode: disable case creation and direct the user to connect UiPath.

## Testing

- Unit-test unique ID generation and both scenario payload builders.
- Unit-test requester email prefill and editable override.
- Unit-test process-start request construction and start failures.
- Unit-test bounded registration polling, success, timeout, and no-resubmit behavior.
- Component-test the orange launch button, modal validation, pending state, and success transition.
- Component-test newest-first ordering, 10-row pagination, boundary buttons, and page reset.
- Contract-test the Maestro intake registration input mapping and idempotent Data Fabric behavior.
- Run the full coded-app test, lint, and production build suites before deployment.

## Deployment

Update and deploy the API workflow/case package first so the intake write exists before exposing the coded-app button. Then publish and deploy the coded app using its existing system name and URL. Preserve both existing scenarios and all current Data Fabric entity bindings.

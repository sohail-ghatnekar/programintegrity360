### Task 8: Preserve the Full Cloud Solution and Publish an Additive Upgrade

**Files:**
- Reconcile CLI-first: `ProgramIntegrity360/ProgramIntegrity360.uipx` and `ProgramIntegrity360/resources/solution_folder/`. The Step 3 official-download fallback may restore these artifacts byte-for-byte, but they must never be field-edited.
- Modify in place with stable IDs: `ProgramIntegrity360/PI360CaseManagement/content/caseplan.json`
- Modify as required by preserved Case bindings: `ProgramIntegrity360/PI360CaseManagement/bindings_v2.json`
- Test: `test/test_solution_upgrade_safety.py`
- Test: `test/test_caseplan_multiscenario.py`

**Interfaces:**
- Consumes: fresh Studio Web backup `/private/tmp/pi360-before-final-force.9dpq1N/ProgramIntegrity360-before-final-force`, solution ID `494be60c-8bb2-4478-3beb-08def46ec69f`, and the currently active `uipathlabs / Playground` deployment.
- Produces: a versioned solution package whose project/resource/Case-node inventory is a superset of the cloud baseline while retaining the net-new Flow, BPMN, and Beeceptor GET behavior.

- [ ] **Step 1: Write failing preservation tests before changing solution metadata or the Case Plan**

Add assertions that the local solution contains every cloud project name, project ID, resource key, Case stage ID, and Case task ID. The assertions may allow additional local projects/resources/nodes but must fail on any cloud baseline item that is absent. Preserve the exact cloud resource identities, including `PI360 IXP Timesheet`, `Timesheets`, both unsuffixed Action Apps, and both existing IXP deployments.

- [ ] **Step 2: Verify the red failures describe only missing preservation items**

Run the focused solution and Case tests. Confirm failures identify the cloud project/resources/Case nodes currently absent locally, not fixture or parsing errors.

- [ ] **Step 3: Restore cloud-only definitions with a CLI-first downloaded-artifact fallback**

First attempt the supported `uip solution project import`, `uip solution resources add --source remote --cloud-key ...`, and resource-refresh commands. Verify the resulting project IDs and full resource identities after each mutation. If the installed CLI provably rekeys an official downloaded project/resource or cannot address its exact solution-definition ID, preserve the required cloud baseline by restoring only the corresponding artifact from the official `uip solution download` directory byte-for-byte. This is a brownfield preservation fallback, not metadata authoring: never field-edit `.uipx`, resource JSON, or downloaded project files. Record the CLI failure or rekey evidence and prove restored equality with checksums and `diff`/`cmp`. Do not remove or replace user-authored resources. Keep IXP, RPA, and email resources present but inactive.

- [ ] **Step 4: Reconcile the Case Plan as a brownfield stable-ID merge**

Treat the fresh cloud Case Plan as the preservation baseline. Retain every existing cloud stage/task ID and all unrelated task configuration. Add the Flow evidence task and hospice-only BPMN provider-record task at the relevant stages. Any preserved IXP, RPA, or automated-email task must be made unreachable/dormant without deleting its node or reactivating that integration. Preserve the current manual trigger, Data Fabric intake, human intervention, agentic investigation, supervisor review, and closure persistence behavior.

- [ ] **Step 5: Refresh resources and prove the local inventory is a superset**

Run `uip solution resources refresh`, then list projects/resources for both the fresh cloud backup and local solution. Fail the task if any cloud project ID, resource key, Case stage ID, or Case task ID is missing, or if any `_1` copy is introduced. The local solution may contain net-new Flow/BPMN dependencies.

- [ ] **Step 6: Validate and package without touching Studio Web history**

Run all repository tests and validators, pack version `1.0.1`, and inspect the ZIP. Do not run `uip solution upload` and never pass `--force`. The packed inventory must remain a superset of the cloud baseline and contain the exact Beeceptor GET routes plus the Flow/BPMN Case bindings.

- [ ] **Step 7: Commit the additive local reconciliation for review**

Commit the preservation tests and reconciled solution artifacts. Do not publish, deploy, push, upload, or force-overwrite anything until the task review confirms that the resulting package is a cloud-inventory superset.

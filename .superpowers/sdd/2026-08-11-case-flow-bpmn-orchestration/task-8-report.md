# Task 8 preservation report

Status: **DONE** after the corrective follow-up appended below. The earlier `DONE_WITH_CONCERNS` result is retained as historical RED evidence and is superseded by the follow-up. No upload, force, publish, deploy, push, runtime, or debug was performed.

## Baseline and target

- Fresh backup: `/private/tmp/pi360-before-final-force.9dpq1N/ProgramIntegrity360-before-final-force`
- Solution ID: `494be60c-8bb2-4478-3beb-08def46ec69f`
- Auth target: `uipathlabs / Playground`
- Local worktree/branch: `.worktrees/pi360-multiscenario-refit`, `codex/pi360-multiscenario-refit`

## Project inventory

Cloud before (name | ID):

```text
PI360SummaryAgent | 734cac0b-a987-4ec4-8cd4-dc5d3b1e6d4c
PI360CaseManagerAgent | 72209049-a669-4dee-af0f-f67a87df1253
PI360ClaimDetailsApi | 2b115f5e-5658-4c0e-b9b3-8abc0b169713
PI360TriageAgent | d38cd7b3-689b-42c7-90b2-677dc8bd97e5
PI360RecordConversationAgent | 2c65953d-0ff3-4ea7-adba-d6c56817ad72
PI360CaseManagerFlow | d150de15-dafd-45ed-8573-a311d655a055
PI360EscalationActionApp | e0eab46c-4d80-4aac-8ef9-47644098ceaf
PI360QuickRulesCodedAgent | 47fa13a5-3cc9-40ee-a687-b9a8fd53b216
PI360CaseManagement | 465532d2-519c-4823-b2f7-9e4ef9a76be7
PI360AdHocReviewBpmn | 442a257b-bb42-4053-93c2-dd511080885f
PI360InvestigationPlanningAgent | f27c930e-42d5-4db7-8597-5c606122a15d
PI360EvidenceCorrelationAgent | 49768f19-d2bb-4abb-aad5-2701160b0392
PI360ApiWorkflows | 9dd25760-de4f-4b0b-bfc8-ecdbcd48f863
PI360DecisionPacketAutomation | 6f19e849-d1e4-4509-a32f-e4a2335996ac
PI360EvidenceSnapshotAutomation | 58e4aa89-7358-47ee-a0d4-6711e9792208
PI360 IXP Timesheet | 616518cc-4755-4790-a5ad-3f2c7b4191a5
PI360RecoveryAuthorizationActionApp | ec7a30ac-2270-421a-b5f7-0d9676d3bbe4
```

Local before contained the same 16 projects except `PI360 IXP Timesheet`; all 16 IDs matched. Local after contains all 17 names, but the supported `uip solution project import` command minted `79fb4fb4-73e6-4c82-aa3d-4548ca62d677` for `PI360 IXP Timesheet` instead of preserving cloud ID `616518cc-4755-4790-a5ad-3f2c7b4191a5`. All other after IDs equal the cloud list above.

## Resource inventory

Cloud before keys (41):

```text
03d46443-0ae3-460a-8ad5-dce6e8fdea62 app PI360EscalationActionApp
cc65fd9e-f779-447e-a45d-24fda4ee318e app PI360RecoveryAuthorizationActionApp
54f913fa-10c8-4eec-85ef-58f05e15b6d5 app pi360-escalation-action-app
f03d4cd5-2d9b-4202-b8df-9042004b7325 app pi360-recovery-approval
ee5b39e1-60de-4ddd-92c3-3bc05d0d74c4 bucket Timesheets
a0bd364e-c6cc-4749-9f92-f6a46e59fe4d connection Program Integrity Fabric
b8b2d499-1a77-8063-8c63-d58052db357d ixpDeployment PI360 Service Evidence Extractor
9482957c-64bb-8001-8030-26e03416127d ixpDeployment PI360 Timesheet Extraction
4dafc4c7-2090-4d24-bbc2-7a51f0b539ca package PI360AdHocReviewBpmn
f3c10615-185f-4eea-bcb8-c6c549eaab80 package PI360ApiWorkflows
6b0b4cb2-318e-48a2-9126-ce021507131d package PI360CaseManagement
7767e490-7d90-4a12-80af-b567e63d4235 package PI360CaseManagerAgent
eeb0ef1d-53cd-4174-8fd6-a13b54f8ae8a package PI360CaseManagerFlow
d4fc01a6-9cba-4245-bfca-2bfc9e0726a9 package PI360ClaimDetailsApi
e52e6a4d-5992-43f5-83bb-6c03a54daea5 package PI360DecisionPacketAutomation
1358edb0-6f6c-4267-a180-2f862e29713d package PI360EscalationActionApp
0f60dc9b-ee5c-4380-b92d-a06689f8b19f package PI360EvidenceCorrelationAgent
86dcc831-9532-40a1-9a96-309010314afc package PI360EvidenceSnapshotAutomation
c5a54f6f-1c99-4153-8078-7c70c0e1d861 package PI360InvestigationPlanningAgent
f94a79e7-44cd-42a6-ab3f-8164a63408cd package PI360QuickRulesCodedAgent
5ebc2453-4dca-4159-93f5-deaf778da54f package PI360RecordConversationAgent
eb0ebd1d-1112-4cac-8768-03575403b597 package PI360RecoveryAuthorizationActionApp
165318d1-7e06-4a0d-8827-18158c01bddb package PI360SummaryAgent
a9e226dd-1ea4-4352-b71e-9c482d328736 package PI360TriageAgent
d8a8ac1a-bcb8-4342-926c-c15664b5d225 package PI360 IXP Timesheet
pi360-escalation-action-app:0.2.0 package pi360-escalation-action-app
pi360-recovery-approval:0.2.0 package pi360-recovery-approval
64ee0873-ac2c-4393-a970-7f67f9c7a423 process/agent PI360CaseManagerAgent
d7ec72d4-6fa4-4a00-b86b-dcf4dbe8380f process/agent PI360EvidenceCorrelationAgent
f8e4b893-098d-4435-9a8d-52ec75e7a9fa process/agent PI360InvestigationPlanningAgent
fabc409c-d468-4964-92e0-2171e0ced3ba process/agent PI360QuickRulesCodedAgent
78a50d04-e2a1-4a50-a51c-7cbb3f16ef4d process/agent PI360RecordConversationAgent
63198c10-58f0-4380-b41a-b51f567ea457 process/agent PI360SummaryAgent
07bc936d-d767-4ca8-845d-f6be376a0e2b process/agent PI360TriageAgent
9c77c6aa-3a07-4053-a559-28c98f2520a3 process/api PI360ApiWorkflows
6d04d330-e36f-4da8-a0ae-b74fef97f1b4 process/api PI360ClaimDetailsApi
1e19a003-38dc-4bd3-a70e-14f262d4c19c process/caseManagement PI360CaseManagement
8dd7c4ad-7050-4e54-b915-854f29fa5fd6 process/flow PI360CaseManagerFlow
4b3445e2-e309-4462-98b1-ee5a8e19c24b process/process PI360DecisionPacketAutomation
58e4aa89-7358-47ee-a0d4-6711e9792208 process/process PI360EvidenceSnapshotAutomation
da8d33bc-864b-4ac0-ad48-220a77834bbd process/process PI360 IXP Timesheet
5fb67ceb-1d49-475b-96a3-1037eb152b2d process/processOrchestration PI360AdHocReviewBpmn
```

Local before had 35 keys. Missing cloud keys were `03d46443-0ae3-460a-8ad5-dce6e8fdea62`, `cc65fd9e-f779-447e-a45d-24fda4ee318e`, `ee5b39e1-60de-4ddd-92c3-3bc05d0d74c4`, `b8b2d499-1a77-8063-8c63-d58052db357d`, `9482957c-64bb-8001-8030-26e03416127d`, `1358edb0-6f6c-4267-a180-2f862e29713d`, `eb0ebd1d-1112-4cac-8768-03575403b597`, `d8a8ac1a-bcb8-4342-926c-c15664b5d225`, and `da8d33bc-864b-4ac0-ad48-220a77834bbd`.

Local after has 42 keys. It added exact cloud keys for `Timesheets` and both IXP deployments. It also added CLI-minted/imported keys `47ac3d84-e9d4-4023-93e5-d8c0b955bd83` (unsuffixed escalation App), `4ee71527-4a70-4bff-b216-6b520fe71d30` (IXP package), `fa5b106f-e39c-47e9-871c-747728fd58c0` (IXP process), and `ProgramIntegrity360.AppV2.PI360EscalationActionApp:1.0.0` (App package dependency). The six cloud solution-definition keys still missing are:

```text
03d46443-0ae3-460a-8ad5-dce6e8fdea62
cc65fd9e-f779-447e-a45d-24fda4ee318e
1358edb0-6f6c-4267-a180-2f862e29713d
eb0ebd1d-1112-4cac-8768-03575403b597
d8a8ac1a-bcb8-4342-926c-c15664b5d225
da8d33bc-864b-4ac0-ad48-220a77834bbd
```

No `_1` resource name was introduced.

## Case inventory

Cloud before stages: `Stage_Aintk1`, `Stage_Evcol2`, `Stage_Corr4a`, `Stage_Prreq6`, `Stage_Supv7a`, `Stage_Clos9a`.

Cloud before task IDs: `tCaseManagerAgent`, `tINT1case`, `tTRI1agnt`, `tCLM2pull`, `tUeO6EGo3`, `tQAC3rec`, `tCOR4evid`, `tREV5task`, `tCMR4route`, `tREQ6send`, `tPRV6wait`, `tH5yKJJef`, `tPKT7prep`, `tSUP7gate`, `tCLS9case`, `thmyc7i2S`.

Local before and after stages are the same six IDs. Local before and after task IDs are `tCaseManagerAgent`, `tINT1case`, `tTRI1agnt`, `tCLM2pull`, `tCOR4evid`, `tREV5task`, `tCMR4route`, `tREQ6send`, `tSUP7gate`, and `tCLS9case`. Missing cloud task IDs remain `tUeO6EGo3`, `tQAC3rec`, `tPRV6wait`, `tH5yKJJef`, `tPKT7prep`, and `thmyc7i2S`.

The Case schema does support a deterministic dormant task entry rule (`rule: "adhoc"`, `conditionExpression: "=js:false"`). No Case mutation was made because the solution preservation baseline could not first be reconstructed through the mandated CLI-only solution commands; proceeding would leave an unreviewable partial merge.

## TDD evidence

RED command:

```text
uv run --with pytest pytest -q test/test_solution_upgrade_safety.py test/test_caseplan_multiscenario.py
4 failed, 14 passed in 0.11s
```

The four failures identified only the missing cloud project ID, nine cloud resource keys, six cloud Case task IDs, and absent dormant entries.

Post-CLI preservation command:

```text
uv run --with pytest pytest -q test/test_solution_upgrade_safety.py test/test_caseplan_multiscenario.py
4 failed, 14 passed in 0.07s
```

The remaining failures identify one mismatched project ID, six missing cloud resource keys, six missing Case task IDs, and absent dormant entries. GREEN was not reached.

## CLI mutations and probes

1. `uip solution init --help --output json` — post-rename CLI confirmed.
2. `uip login status --output json` — logged into `uipathlabs / Playground`.
3. Project/resource list commands against backup and local — inventories above.
4. `uip solution project import '<backup>/PI360 IXP Timesheet' --solutionFile ProgramIntegrity360/ProgramIntegrity360.uipx --output json` — success, but minted project ID and package/process keys.
5. `uip solution resources add ... Timesheets ... ee5b...` — sandbox network failure, then escalated success.
6. `uip solution resources add ... 03d...` — failure: no remote resource at backup solution key.
7. Remote list probes showed escalation App cloud key `47ac3d84-e9d4-4023-93e5-d8c0b955bd83` and exact IXP deployment keys.
8. Two IXP deployment `resources add --source remote --cloud-key` commands — success with exact keys.
9. IXP Timesheet process import using `da8...` — failure: no remote resource at backup solution key; remote search by name returned empty.
10. Escalation App import using actual remote key `47ac...` — success, but did not recreate backup solution key `03d...`; it also imported package dependency `ProgramIntegrity360.AppV2.PI360EscalationActionApp:1.0.0`.
11. `uip solution resources refresh --solution-folder ProgramIntegrity360 --output json` — success: `Created 0, Imported 1, Skipped 0`; Data Fabric connection refreshed.

No `resource remove`, `project remove`, file deletion, upload, `--force`, publish, deploy, push, runtime, or debug command was used.

## Validation, packaging, and SHA-256

- Unchanged local Case validation: `uip maestro case validate ...` returned `Status: Valid` before the preservation attempts.
- Fresh backup Case validation under CLI `1.198.0-preview.102` reports its version `30.0.0` is newer than the validator's required `27.0.0`; this is a tool-version mismatch, not a baseline parse failure.
- Solution package `1.0.1` was intentionally not produced because the preservation tests remained red. Therefore there is no package SHA-256 or ZIP inspection evidence. Packaging an inventory known not to be a cloud superset would violate the Task 8 gate.

## Git diff and self-review

- `git diff --check`: reports trailing-whitespace warnings in the cloud-imported `PI360 IXP Timesheet/Main.xaml`; the imported source was left byte-for-byte unchanged rather than mechanically rewriting the preservation baseline.
- Changes are limited to the in-scope plan, preservation tests, CLI-generated solution/project/resource/debug-overwrite artifacts, and this report.
- The preservation assertions use literal, independently captured cloud names/IDs/keys and allow additive local entries.
- No JavaScript file changed, so the repository `npm test` working agreement is not triggered.
- Concern: supported imports do not preserve solution-generated IDs from an extracted backup. Hand-editing `.uipx` or `resources/solution_folder` would resolve the literals but is explicitly prohibited. A CLI path that imports a solution-definition resource while retaining its existing solution key is required before this task can safely continue to Case merge, GREEN, package, and SHA verification.

## Corrective follow-up: authoritative cloud restore and brownfield Case merge

This follow-up supersedes the earlier concern. The fresh `uip solution download` directory at `/private/tmp/pi360-before-final-force.9dpq1N/ProgramIntegrity360-before-final-force` was designated as the authoritative cloud definition for `.uipx`, `resources/solution_folder`, the `PI360 IXP Timesheet` project, and user-profile overwrite metadata. The six-stage local Case design, local Flow, BPMN, API workflows, agents, RPA projects, and Coded Apps remained the brownfield source baseline.

### Corrective RED and TDD scope

The preservation tests were strengthened before the corrective source changes to require the exact IXP process binding and the exact IDs, types, display names, and runtime configuration of the six cloud-only Case tasks.

```text
uv run --with pytest pytest -q test/test_solution_upgrade_safety.py test/test_caseplan_multiscenario.py
6 failed, 13 passed in 0.09s
```

Those six failures covered the wrong IXP project ID, missing/minted resource definitions, the absent pinned IXP Case binding, and the six missing cloud Case tasks.

### Restored and removed paths

- Replaced `ProgramIntegrity360/ProgramIntegrity360.uipx` byte-for-byte from the authoritative download. SHA-256 for both copies: `79970b348443da1cda756c1a3ea663bb0603b15fdc1e828479a6909fc7e3bb92`.
- Replaced all 42 authoritative JSON definitions under `ProgramIntegrity360/resources/solution_folder` from the download. The pre-existing local-only process resource `e29e2659-7e63-4328-97e7-8eb5daaa7d0d` (`PI360EscalationActionApp`) was intentionally retained as the only additive resource.
- Replaced the complete six-file `ProgramIntegrity360/PI360 IXP Timesheet` project byte-for-byte: `.project/JitCustomTypes.json`, `.project/PackagerFlags.json`, `Main.xaml`, `entry-points.json`, `project.json`, and `project.uiproj`. `diff -qr` and per-file `cmp` were clean.
- Restored the authoritative user-profile overwrite files, including profile `513e46a9-7b43-4b84-8034-5a52fcd468f2`.
- Removed the incorrect minted package definition `resources/solution_folder/package/ProgramIntegrity360.AppV2.PI360EscalationActionApp.json` from the workspace; its recoverable copy is `/private/tmp/task8-minted-ProgramIntegrity360.AppV2.PI360EscalationActionApp.json`.
- Removed the incorrect minted `resources/solution_folder/Bucket` tree and restored the authoritative `resources/solution_folder/bucket/orchestratorBucket/Timesheets.json`; the recoverable minted tree is `/private/tmp/task8-minted-Bucket`.
- The successful pack generated transient IXP compiler metadata and stamped 1.0.1 build values into source-side resource files. After ZIP creation, `.uipx`, the full authoritative resource tree, and the IXP project were restored again from the download. Final comparison is exact except for the single intentional `e29e...` resource.

No user-authored Flow, BPMN, API workflow, agent, RPA, or Coded App source folder was overwritten by this restore.

### Corrected inventory

The final project inventory exactly matches all 17 cloud project names and IDs listed in the original Project inventory section. In particular, `PI360 IXP Timesheet` now retains cloud project ID `616518cc-4755-4790-a5ad-3f2c7b4191a5`; no minted `79fb...` project remains.

The original resource heading incorrectly said 41; the enumerated authoritative list contains 42 resource JSON files. Final local resources are those exact 42 cloud definitions plus only the pre-existing local process resource:

```text
e29e2659-7e63-4328-97e7-8eb5daaa7d0d process/process PI360EscalationActionApp
```

The incorrect minted `47ac...`, `4ee...`, `fa5...`, and `ProgramIntegrity360.AppV2.PI360EscalationActionApp:1.0.0` definitions are absent. No `_1` name exists.

The final Case retains the six cloud stage IDs and now contains the complete 16-task cloud set while preserving the local replacements and workflow boundaries:

```text
tCaseManagerAgent tINT1case tTRI1agnt tCLM2pull
tUeO6EGo3 tQAC3rec tCOR4evid tREV5task tCMR4route
tREQ6send tPRV6wait tH5yKJJef tPKT7prep tSUP7gate
tCLS9case thmyc7i2S
```

- `tCLM2pull` remains the local Case Manager Flow task.
- `tREQ6send` remains the local provider-request BPMN task.
- `tQAC3rec`, `tPRV6wait` (`P3D`), and `tPKT7prep` retain the exact cloud IDs and runtime configuration.
- `tUeO6EGo3`, `tH5yKJJef`, and `thmyc7i2S` retain their exact cloud IDs/configuration but are non-required and deterministically dormant with `rule: "adhoc"` and `conditionExpression: "=js:false"`.
- Case bindings retain the local Flow key `8dd7c4ad-7050-4e54-b915-854f29fa5fd6`, local BPMN key `5fb67ceb-1d49-475b-96a3-1037eb152b2d`, and authoritative IXP process key `da8d33bc-864b-4ac0-ad48-220a77834bbd`.
- The BPMN retains its API workflow binding key `9c77c6aa-3a07-4053-a559-28c98f2520a3`; the Flow retains Claim Details API key `6d04d330-e36f-4da8-a0ae-b74fef97f1b4`.
- The supported `uip maestro case pack` generator rebuilt `caseplan.json.bpmn` from the merged plan. The regenerated compiled BPMN contains every restored task ID, both local replacement task IDs, the IXP bindings, and all three dormant conditions. The stale generated file was moved recoverably to `/private/tmp/task8-stale-caseplan.json.bpmn` before regeneration.

All Case plan and Case binding changes were made by direct `apply_patch` edits under Maestro Case Rule 13. No script, `jq`, `sed`, or Python mutation was used on Case artifacts.

### Refresh, validation, and test evidence

- `uip solution resources refresh --solution-folder ProgramIntegrity360 --output json`: `Success`, `Created 0, Imported 1, Skipped 0`; only the Data Fabric connection was refreshed.
- Focused preservation suite after restore and again after refresh: `19 passed`; final rerun was `19 passed in 0.05s`.
- Full repository Python suite: `78 passed in 1.31s`.
- Coded App `npm test`: 22 files and 248 tests passed.
- Coded App `npm run lint`: 0 errors and 53 pre-existing warnings.
- Coded App `npm run build`: success, with one non-blocking chunk-size warning.
- Case validator: `Status: Valid`.
- Standalone Case pack/regeneration: `Success`, producing a 568,882-byte merged `caseplan.json.bpmn`.
- Flow validator with `--strict-bindings`: `Status: Valid`. Offline dynamic-manifest fetch warnings were emitted, but validation completed successfully from pinned solution bindings.
- API workflow validator: `Status: Valid`.
- BPMN validator: `VALID`.

### Local 1.0.1 package and ZIP inspection

The first sandboxed pack attempt failed only because four pinned cloud files could not be downloaded. The same command was rerun with network access and completed successfully; nothing was uploaded or published.

```text
Package: /private/tmp/pi360-pack-final-1.0.1.EB3kZI/ProgramIntegrity360_1.0.1.zip
SHA-256: feabce9fd1ecf4e11ee00b278542d70f36ec0c48596d39d39b64c9e69dd5ef6d
Archive entries: 99
Resource JSON files: 43 (42 cloud + the intentional e29e... local resource)
```

ZIP inspection confirmed:

- all 17 project packages, including the cloud-ID IXP project package;
- both pinned IXP exports and both preserved 0.2.0 cloud Action App packages;
- the Case package contains all six restored task IDs, the three dormant `=js:false` expressions, and the Flow/BPMN/IXP bindings above in both `caseplan.json` and the regenerated 568,882-byte `caseplan.json.bpmn`;
- the Flow package contains the local orchestration and pinned Claim Details API binding;
- the BPMN package contains the local provider-record orchestration and pinned API workflow binding;
- the Claim Details API contains the exact GET routes `https://medicaid-claim-demo.free.beeceptor.com/MedicaidPCS` and `https://medicaid-claim-demo.free.beeceptor.com/StateMedicaidHospice`.

### Mutation log and final review

Corrective mutations were limited to the authorized `cp`/`rsync` restore, recoverable `mv` operations for the minted and stale generated artifacts, direct `apply_patch` Case/test/report edits, one resource refresh, supported Case BPMN regeneration, local pack output under `/private/tmp`, and restoration of pack side effects. The package itself is outside the repository and was not staged.

Final `git diff --check` is clean. The authoritative IXP `Main.xaml` is byte-identical to the download, so no cosmetic rewrite was applied. The only remaining warnings are the pre-existing Coded App lint warnings, one build chunk-size warning, and offline Flow dynamic-manifest warnings; none invalidate the focused tests, full test suite, validators, or packed artifact.

No force, upload, publish, deploy, push, runtime, or debug command was used.

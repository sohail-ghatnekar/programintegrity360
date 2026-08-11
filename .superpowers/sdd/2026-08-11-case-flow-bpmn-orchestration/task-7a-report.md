# Task 7A Report: Repair Case packaging layout and Flow runtime bindings

Date: 2026-08-11

## Status

Implemented and locally verified the focused packaging repair. The supported Case
packer now includes the Case source and compiled BPMN, and the solution packer
resolves the Claim API and QuickRules Flow bindings without either prior
`folderPath` warning.

One CLI limitation remains: UiPath CLI `1.198.0-preview.102` emits both resolved
Flow dependencies into the nested Flow package's generated `bindings_v2.json`,
but does not add `runtimeDependencies` to the Flow solution resource descriptor.
This behavior remained unchanged after the required solution resource refresh
and a new pack. The generated descriptor was not fabricated or hand-edited.

No upload, publish, deployment, push, run, debug, or other cloud mutation was
performed.

## Environment

- Starting HEAD: `afae580aed4e38f2f1ce9b48f6006574c673a35b`
- Branch: `codex/pi360-multiscenario-refit`
- CLI: `1.198.0-preview.102`
- Every `uip` invocation used `UIPATH_CLI_DISABLE_VERSION_SYNC=1`.
- Authentication: logged in to organization `uipathlabs`, tenant `Playground`.
- `uip solution init --help --output json` succeeded, confirming the post-rename
  solution CLI surface.

## Changes

- Added a Case packaging regression test requiring root `caseplan.json`, root
  `caseplan.json.bpmn`, no nested source, and the existing descriptor mappings
  to `content/caseplan.json` and `content/caseplan.json.bpmn`.
- Added a Flow packaging regression test requiring exactly the two target
  definitions and exact object-shaped `model.bindings.values`.
- Moved `PI360CaseManagement/content/caseplan.json` to the Case project root.
- Updated the existing Case test loader to use the root source.
- Generated root `caseplan.json.bpmn` only through
  `uip maestro case pack`; it was not manually edited.
- Changed only the two target Flow definition binding values:
  - Claim API: `{ "name": "PI360ClaimDetailsApi", "folderPath": "" }`
  - QuickRules: `{ "name": "PI360QuickRulesCodedAgent", "folderPath": "" }`

## RED evidence

Command:

```bash
uv run --with pytest pytest -q \
  test/test_solution_upgrade_safety.py::test_case_project_keeps_packager_inputs_at_root_with_content_mappings \
  test/test_case_manager_flow.py::test_flow_resource_definition_bindings_are_packager_resolvable
```

Result: exit 1, `2 failed in 0.03s`.

- Case test failed because root `PI360CaseManagement/caseplan.json` did not
  exist.
- Flow test failed because both target definition values were descriptor arrays,
  not exact binding objects.

The first attempt using bare `uv run pytest` could not spawn `pytest`; the RED
command was corrected to the repository's established ephemeral dependency form
shown above.

## GREEN evidence

Focused command after the minimal repair:

```bash
uv run --with pytest pytest -q \
  test/test_solution_upgrade_safety.py::test_case_project_keeps_packager_inputs_at_root_with_content_mappings \
  test/test_case_manager_flow.py::test_flow_resource_definition_bindings_are_packager_resolvable
```

Result: exit 0, `2 passed in 0.01s`.

Full repository command:

```bash
uv run --with pytest pytest test -q
```

Result: exit 0, `73 passed in 1.36s`.

An exploratory unscoped `pytest -q` stopped during collection because nested
projects have separate lockfiles and the root ephemeral environment lacked
`langgraph` and `pypdf`. The established SDD repository suite is `pytest test
-q`, which passed as shown above.

## UiPath validators

### Case

```bash
UIPATH_CLI_DISABLE_VERSION_SYNC=1 uip maestro case validate \
  ProgramIntegrity360/PI360CaseManagement/caseplan.json --output json
```

Exit 0: `Result: Success`, `Code: CaseValidate`, `Status: Valid`.

### Flow format and authenticated validation

```bash
UIPATH_CLI_DISABLE_VERSION_SYNC=1 uip maestro flow format \
  ProgramIntegrity360/PI360CaseManagerFlow/PI360CaseManagerFlow.flow
```

Exit 0: 20 nodes, 19 edges, 79 variables, 0 repositioned, 0 resized.

```bash
UIPATH_CLI_DISABLE_VERSION_SYNC=1 uip maestro flow validate \
  ProgramIntegrity360/PI360CaseManagerFlow/PI360CaseManagerFlow.flow --output json
```

The sandboxed validator returned Valid but could not fetch tenant manifests. The
network-enabled read-only rerun fetched 2,613 dynamic nodes and returned exit 0,
`Result: Success`, `Code: FlowValidate`, `Status: Valid`, without manifest or
Flow validation warnings.

## Direct Case package inspection

Supported pack command used a fresh output directory:

```bash
UIPATH_CLI_DISABLE_VERSION_SYNC=1 uip maestro case pack \
  ProgramIntegrity360/PI360CaseManagement \
  /private/tmp/pi360-task7a-case.mcg8cD
```

Result: exit 0, package
`PI360CaseManagement.case.Case.1.0.0.nupkg`.

The package contained 11 files. Its `content/` files were:

- `bindings_v2.json`
- `caseplan.json` exactly once
- `caseplan.json.bpmn` exactly once
- `entry-points.json`
- `operate.json`
- `package-descriptor.json`
- `project.uiproj`

`cmp` confirmed packaged `caseplan.json` and `caseplan.json.bpmn` both match the
root source/generated files byte for byte.

## Solution package inspection

The required resource refresh completed with exit 0:

```text
Created: 0
Imported: 1
Skipped: 0
Warnings: []
```

The imported/read resource was the existing `Program Integrity Fabric`
connection. It created no tracked diff.

The first sandboxed solution pack failed only because network access blocked
downloads of the two existing Action App packages. Network-enabled probes used
new output directories. The final post-refresh pack was:

```bash
UIPATH_CLI_DISABLE_VERSION_SYNC=1 uip solution pack ProgramIntegrity360 \
  /private/tmp/pi360-task7a-solution-final.WAaRut \
  --name ProgramIntegrity360 --version 1.0.1 --output json
```

Result: exit 0, `Code: SolutionPack`, package
`ProgramIntegrity360@1.0.1`.

- Path: `/private/tmp/pi360-task7a-solution-final.WAaRut/ProgramIntegrity360_1.0.1.zip`
- Size: 812,540 bytes
- SHA-256: `c86998b25eda3d2e7e98f49b469399ed7aa7c3ebc134028fc2a54e97c0505c92`
- Target `folderPath` binding-resolution warnings: 0
- Binding-resolution log: both `claimDetailsByCaseType` and
  `quickRulesByCaseType` reported `Resolved process bindings`.
- Other packaging warnings: two existing RPA compiler warnings saying package
  paths were recovered by scanning output folders (`UV-15007` workaround).

Nested Case package:

- `content/caseplan.json` exactly once
- `content/caseplan.json.bpmn` exactly once
- Packaged Case source matches root source byte for byte.
- Packaged Case BPMN matches root generated BPMN byte for byte.

Nested Flow package:

- Packaged `content/PI360CaseManagerFlow.flow` matches root Flow byte for byte.
- Generated `content/bindings_v2.json` contains:
  - `6d04d330-e36f-4da8-a0ae-b74fef97f1b4`, subtype `Api`, default name
    `PI360ClaimDetailsApi`, empty folder path
  - `fabc409c-d468-4964-92e0-2171e0ced3ba`, subtype `Agent`, default name
    `PI360QuickRulesCodedAgent`, empty folder path

## Descriptor limitation

After resource refresh and the final fresh pack, the packaged descriptor at
`resources/solution_folder/process/flow/PI360CaseManagerFlow.json` still had no
`runtimeDependencies` property. The tracked source descriptor still has
`runtimeDependencies: []`. A recursive search of the solution package found the
two exact keys in their owned sibling resource descriptors and in the nested
Flow `bindings_v2.json`, but not as Flow process `runtimeDependencies`.

This is an evidence-backed limitation of the installed packer path, not a
remaining `folderPath` binding failure: both nodes resolved, generated bindings
are exact, and there were zero target warnings. The task prohibited fabricating
or manually editing generated packaging metadata, so no unsupported descriptor
workaround was applied.

## Safety and concerns

- No JavaScript files changed; `npm test` was therefore not required by the
  workspace agreement.
- No Case IDs, Flow nodes/edges, node types, service types, resource keys,
  project IDs, contexts, schemas, inputs/outputs, business routing, or Beeceptor
  routes changed.
- No Studio Web upload, solution publish, deploy, activate, Git push, artifact
  run, or debug command was executed.
- Remaining concern: if deployment tooling requires Flow dependencies duplicated
  in the solution process descriptor rather than consuming the generated nested
  bindings, CLI `1.198.0-preview.102` needs a supported fix or clarification.

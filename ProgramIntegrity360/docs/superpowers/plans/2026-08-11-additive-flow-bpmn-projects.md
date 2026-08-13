# Additive Flow and BPMN Projects Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and upload one new UiPath Studio Web solution containing only a deterministic claim-evidence Flow and a hospice provider-record BPMN, leaving the existing ProgramIntegrity360 solution and Case Plan untouched.

**Architecture:** `PI360AdditiveOrchestration` is a new solution boundary with exactly two projects. `PI360EvidenceRoutingFlow` performs direct Beeceptor GET calls and deterministic routing without IXP, RPA, email, agents, or sibling API projects; `PI360HospiceProviderRecordBpmn` preserves the reviewed provider-request, P3D wait, intake, and investigation-return contract while binding only to the existing published provider API resource. The solution is uploaded as a new Studio Web solution without `--force`; the user wires the resulting Process Orchestration resources into the Case manually.

**Tech Stack:** UiPath CLI 1.198.0-preview.102, Maestro Flow JSON, Maestro BPMN XML, Python 3 with pytest, Node-based BPMN validator, Git.

## Global Constraints

- Create solution `PI360AdditiveOrchestration` with exactly `PI360EvidenceRoutingFlow` and `PI360HospiceProviderRecordBpmn`.
- Do not modify anything under `ProgramIntegrity360/PI360CaseManagement/`.
- Do not target or overwrite Studio Web solution `494be60c-8bb2-4478-3beb-08def46ec69f`.
- Never run `uip solution upload --force`.
- Do not delete, rename, or replace any existing Studio Web project/resource/history.
- Do not create a project or resource whose name ends in `_1` or another numeric suffix.
- Do not add or invoke IXP, RPA, automatic email, or agent nodes.
- Do not run/debug the Flow, BPMN, Case, API workflows, RPA, IXP, or agents.
- Use true HTTP `GET` for both exact Beeceptor routes.
- Use hospice threshold `$2,500`; missing hospital record routes to `Stage_Prreq6`, otherwise route to `Stage_Corr4a`.
- Resolve published provider API identifiers from the tenant registry; never fabricate IDs.
- Use `UIPATH_CLI_DISABLE_VERSION_SYNC=1` and `--output json` for parsed UiPath CLI calls.
- Use `apply_patch` for authored source/test/document edits; CLI-owned scaffolding/formatting/generation remains CLI-owned.
- Use `uv run --with pytest pytest ...` for Python tests; never use `pip`.
- Upload only after local tests, validators, resource refresh, pack, archive inspection, and task review pass.

---

### Task 1: Scaffold the isolated two-project solution

**Files:**
- Create: `PI360AdditiveOrchestration/PI360AdditiveOrchestration.uipx`
- Create: `PI360AdditiveOrchestration/PI360EvidenceRoutingFlow/project.uiproj`
- Create: `PI360AdditiveOrchestration/PI360EvidenceRoutingFlow/PI360EvidenceRoutingFlow.flow`
- Create: `PI360AdditiveOrchestration/PI360HospiceProviderRecordBpmn/project.uiproj`
- Create: `PI360AdditiveOrchestration/PI360HospiceProviderRecordBpmn/PI360HospiceProviderRecordBpmn.bpmn`
- Test: `test/test_additive_orchestration_solution.py`

**Interfaces:**
- Consumes: approved design `ProgramIntegrity360/docs/superpowers/specs/2026-08-11-additive-flow-bpmn-projects-design.md`.
- Produces: an isolated solution manifest with two unique project IDs and no Case project.

- [ ] **Step 1: Write the failing isolation test**

```python
import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOLUTION = ROOT / "PI360AdditiveOrchestration"


def test_additive_solution_contains_exactly_two_non_case_projects():
    manifest = json.loads(
        (SOLUTION / "PI360AdditiveOrchestration.uipx").read_text()
    )
    projects = manifest["Projects"]
    names = {
        Path(project["ProjectRelativePath"]).parent.name for project in projects
    }
    ids = [project["Id"] for project in projects]

    assert names == {
        "PI360EvidenceRoutingFlow",
        "PI360HospiceProviderRecordBpmn",
    }
    assert len(projects) == 2
    assert len(ids) == len(set(ids)) == 2
    assert all(re.fullmatch(r"[0-9a-f-]{36}", project_id) for project_id in ids)
    assert not any(re.fullmatch(r".+_\d+", name) for name in names)
    assert not any("case" in name.lower() for name in names)
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
uv run --with pytest pytest test/test_additive_orchestration_solution.py -q
```

Expected: FAIL because `PI360AdditiveOrchestration.uipx` does not exist.

- [ ] **Step 3: Probe the installed solution surface and scaffold through the CLI**

Run from the repository root:

```bash
UIPATH_CLI_DISABLE_VERSION_SYNC=1 uip solution init --help --output json
UIPATH_CLI_DISABLE_VERSION_SYNC=1 uip solution init PI360AdditiveOrchestration --output json
cd PI360AdditiveOrchestration
UIPATH_CLI_DISABLE_VERSION_SYNC=1 uip maestro flow init PI360EvidenceRoutingFlow --output json
UIPATH_CLI_DISABLE_VERSION_SYNC=1 uip maestro bpmn init PI360HospiceProviderRecordBpmn --process-id PI360HospiceProviderRecordProcess --output json
```

Verify both init commands auto-register exactly one project in the nearest `.uipx`; do not run `project add` if the manifest already contains both entries.

- [ ] **Step 4: Run the isolation test and verify GREEN**

Run:

```bash
uv run --with pytest pytest test/test_additive_orchestration_solution.py -q
```

Expected: `1 passed`.

- [ ] **Step 5: Commit the scaffold and isolation contract**

```bash
git add PI360AdditiveOrchestration test/test_additive_orchestration_solution.py
git commit -m "feat: scaffold additive PI360 orchestration solution"
```

---

### Task 2: Implement the deterministic Beeceptor evidence-routing Flow

**Files:**
- Modify: `PI360AdditiveOrchestration/PI360EvidenceRoutingFlow/PI360EvidenceRoutingFlow.flow`
- Test: `test/test_additive_evidence_routing_flow.py`

**Interfaces:**
- Consumes: six input objects: `caseInput`, `claimInput`, `memberInput`, `providerInput`, `serviceEventInput`, `documentInput`.
- Produces: `caseId`, `caseType`, `claimCount`, `lineCount`, `totalUnits`, `totalBilled`, `claimThreshold`, `thresholdExceeded`, `recommendedStageId`, `routeReason`.

- [ ] **Step 1: Write failing Flow contract tests**

```python
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
FLOW_PATH = (
    ROOT
    / "PI360AdditiveOrchestration"
    / "PI360EvidenceRoutingFlow"
    / "PI360EvidenceRoutingFlow.flow"
)


def load_flow():
    return json.loads(FLOW_PATH.read_text())


def test_additive_flow_has_exact_manual_contract():
    flow = load_flow()
    inputs = {
        item["id"]
        for item in flow["variables"]["globals"]
        if item.get("direction") == "in"
    }
    outputs = {
        item["id"]
        for item in flow["variables"]["globals"]
        if item.get("direction") == "out"
    }
    assert inputs == {
        "caseInput", "claimInput", "memberInput", "providerInput",
        "serviceEventInput", "documentInput",
    }
    assert outputs == {
        "caseId", "caseType", "claimCount", "lineCount", "totalUnits",
        "totalBilled", "claimThreshold", "thresholdExceeded",
        "recommendedStageId", "routeReason",
    }


def test_additive_flow_uses_exact_get_routes_and_deterministic_threshold():
    flow = load_flow()
    raw = FLOW_PATH.read_text()
    http_nodes = [node for node in flow["nodes"] if node["type"] == "core.action.http.v2"]
    assert len(http_nodes) == 1
    assert "https://medicaid-claim-demo.free.beeceptor.com/MedicaidPCS" in raw
    assert "https://medicaid-claim-demo.free.beeceptor.com/StateMedicaidHospice" in raw
    assert '"method":"GET"' in raw.replace(" ", "")
    assert "2500" in raw
    assert "Stage_Prreq6" in raw
    assert "Stage_Corr4a" in raw


def test_additive_flow_has_no_forbidden_runtime_nodes():
    raw = FLOW_PATH.read_text().lower()
    node_types = {node["type"].lower() for node in load_flow()["nodes"]}
    assert not any("ixp" in node_type for node_type in node_types)
    assert not any("rpa" in node_type for node_type in node_types)
    assert not any("agent" in node_type for node_type in node_types)
    for forbidden in ("sendclosuresummaryemail", "extractserviceevidence", "extractinstitutionalencounter"):
        assert forbidden not in raw
```

- [ ] **Step 2: Run the Flow tests and verify RED**

Run:

```bash
uv run --with pytest pytest test/test_additive_evidence_routing_flow.py -q
```

Expected: FAIL because the scaffold lacks the declared variables, GET node, routes, and routing scripts.

- [ ] **Step 3: Confirm Beeceptor has no tenant connector and add the CLI-owned HTTP node**

Run, capturing the generated ID through the CLI's own output filter:

```bash
UIPATH_CLI_DISABLE_VERSION_SYNC=1 uip maestro flow registry search "Beeceptor" --output json
PI360_HTTP_NODE_ID="$(UIPATH_CLI_DISABLE_VERSION_SYNC=1 uip maestro flow node add PI360AdditiveOrchestration/PI360EvidenceRoutingFlow/PI360EvidenceRoutingFlow.flow core.action.http.v2 --label "Get Medicaid claim details" --output plain --output-filter "Node.Id")"
test -n "$PI360_HTTP_NODE_ID"
UIPATH_CLI_DISABLE_VERSION_SYNC=1 uip maestro flow node list PI360AdditiveOrchestration/PI360EvidenceRoutingFlow/PI360EvidenceRoutingFlow.flow --output json
```

Require the registry search to return no suitable Beeceptor connector. Capture the exact generated HTTP node ID from `node add`/`node list`, then configure that node in manual mode:

```bash
UIPATH_CLI_DISABLE_VERSION_SYNC=1 uip maestro flow node configure PI360AdditiveOrchestration/PI360EvidenceRoutingFlow/PI360EvidenceRoutingFlow.flow "$PI360_HTTP_NODE_ID" --detail '{"authentication":"manual","method":"GET","url":"=js:$vars.normalizeInputs.output.endpoint"}' --output json
```

- [ ] **Step 4: Author the user-owned Flow nodes, variables, edges, and deterministic scripts**

Use `apply_patch` for the Flow JSON. The normalization script must implement this exact logic:

```javascript
const trigger = ($vars.start && $vars.start.output) || {};
const caseInput = trigger.caseInput || {};
const claimInput = trigger.claimInput || {};
const documentInput = trigger.documentInput || {};
const caseType = String(
  caseInput.caseType || caseInput.case_type ||
  claimInput.caseType || claimInput.case_type || ""
).trim();
if (!["MedicaidPCS", "StateMedicaidHospice"].includes(caseType)) {
  throw new Error(`Unsupported CaseType '${caseType}'.`);
}
const endpoint = caseType === "StateMedicaidHospice"
  ? "https://medicaid-claim-demo.free.beeceptor.com/StateMedicaidHospice"
  : "https://medicaid-claim-demo.free.beeceptor.com/MedicaidPCS";
return {
  caseType,
  endpoint,
  hospitalRecordAvailable: Boolean(
    documentInput.hospitalRecordAvailable ??
    documentInput.hospital_record_available ?? false
  )
};
```

The final routing script must normalize the current Beeceptor response shape and return the public contract:

```javascript
const normalized = $vars.normalizeInputs.output;
const response = $vars.getClaimDetails.output || {};
if (Number(response.statusCode || 200) !== 200) {
  throw new Error(`Beeceptor returned HTTP ${response.statusCode}.`);
}
let payload = response.body ?? response.data ?? response;
if (typeof payload === "string") payload = JSON.parse(payload);
if (String(payload.caseType || "") !== normalized.caseType) {
  throw new Error(`Claim response CaseType '${payload.caseType}' does not match '${normalized.caseType}'.`);
}
const summary = payload.claimSummary || {};
const claimThreshold = 2500;
const totalBilled = Number(summary.totalBilledAmount || 0);
const thresholdExceeded = totalBilled >= claimThreshold;
const providerRoute = normalized.caseType === "StateMedicaidHospice" &&
  thresholdExceeded && normalized.hospitalRecordAvailable !== true;
return {
  caseId: String(payload.caseId || ""),
  caseType: normalized.caseType,
  claimCount: Number(summary.claimCount || 0),
  lineCount: Number(summary.lineCount || 0),
  totalUnits: Number(summary.totalUnitsBilled || 0),
  totalBilled,
  claimThreshold,
  thresholdExceeded,
  recommendedStageId: providerRoute ? "Stage_Prreq6" : "Stage_Corr4a",
  routeReason: providerRoute
    ? `Hospice billed total ${totalBilled} meets the ${claimThreshold} threshold and no hospital record is available.`
    : "The claim is ready for investigator review."
};
```

Wire `start → normalizeInputs → getClaimDetails → buildRoutingResult → end`. Map the end/global outputs one-to-one from `buildRoutingResult.output`.

- [ ] **Step 5: Format and validate the Flow**

Run:

```bash
UIPATH_CLI_DISABLE_VERSION_SYNC=1 uip maestro flow format PI360AdditiveOrchestration/PI360EvidenceRoutingFlow/PI360EvidenceRoutingFlow.flow --output json
UIPATH_CLI_DISABLE_VERSION_SYNC=1 uip maestro flow validate PI360AdditiveOrchestration/PI360EvidenceRoutingFlow/PI360EvidenceRoutingFlow.flow --strict-bindings --output json
uv run --with pytest pytest test/test_additive_evidence_routing_flow.py -q
```

Expected: Flow status `Valid`; focused tests pass with no warnings.

- [ ] **Step 6: Commit the Flow**

```bash
git add PI360AdditiveOrchestration/PI360EvidenceRoutingFlow test/test_additive_evidence_routing_flow.py
git commit -m "feat: add deterministic PI360 evidence routing flow"
```

---

### Task 3: Implement the standalone hospice provider-record BPMN

**Files:**
- Modify: `PI360AdditiveOrchestration/PI360HospiceProviderRecordBpmn/PI360HospiceProviderRecordBpmn.bpmn`
- Regenerate: `PI360AdditiveOrchestration/PI360HospiceProviderRecordBpmn/bindings_v2.json`
- Regenerate: `PI360AdditiveOrchestration/PI360HospiceProviderRecordBpmn/entry-points.json`
- Regenerate: `PI360AdditiveOrchestration/PI360HospiceProviderRecordBpmn/operate.json`
- Regenerate: `PI360AdditiveOrchestration/PI360HospiceProviderRecordBpmn/package-descriptor.json`
- Test: `test/test_additive_provider_record_bpmn.py`

**Interfaces:**
- Consumes: `CaseId`, `CaseType`, `ProviderId`, `HospitalRecordAvailable`, `InvestigatorProceed`; tenant-discovered `PI360ApiWorkflows` provider request/intake resource.
- Produces: `ProviderRequestStatus`, `HospitalRecordAvailable`, `NextStageId`, `AuditMessage`.

- [ ] **Step 1: Write failing BPMN contract and topology tests**

```python
import xml.etree.ElementTree as ET
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
BPMN_PATH = (
    ROOT
    / "PI360AdditiveOrchestration"
    / "PI360HospiceProviderRecordBpmn"
    / "PI360HospiceProviderRecordBpmn.bpmn"
)
NS = {
    "bpmn": "http://www.omg.org/spec/BPMN/20100524/MODEL",
    "bpmndi": "http://www.omg.org/spec/BPMN/20100524/DI",
    "uipath": "http://uipath.org/schema/bpmn",
}


def test_provider_bpmn_contract_and_timer():
    root = ET.parse(BPMN_PATH).getroot()
    raw = BPMN_PATH.read_text()
    inputs = {item.attrib["name"] for item in root.findall(".//uipath:input", NS)}
    outputs = {item.attrib["name"] for item in root.findall(".//uipath:output", NS)}
    assert inputs == {"CaseId", "CaseType", "ProviderId", "HospitalRecordAvailable", "InvestigatorProceed"}
    assert outputs == {"ProviderRequestStatus", "HospitalRecordAvailable", "NextStageId", "AuditMessage"}
    assert "RequestHospitalRecord" in raw
    assert "IntakeHospitalRecord" in raw
    assert "P3D" in raw
    assert "Stage_Corr4a" in raw


def test_provider_bpmn_has_complete_diagram_and_no_forbidden_resources():
    root = ET.parse(BPMN_PATH).getroot()
    nodes = root.findall(".//bpmn:startEvent", NS) + root.findall(".//bpmn:endEvent", NS) + root.findall(".//bpmn:serviceTask", NS) + root.findall(".//bpmn:exclusiveGateway", NS) + root.findall(".//bpmn:intermediateCatchEvent", NS)
    flows = root.findall(".//bpmn:sequenceFlow", NS)
    shapes = root.findall(".//bpmndi:BPMNShape", NS)
    edges = root.findall(".//bpmndi:BPMNEdge", NS)
    raw = BPMN_PATH.read_text().lower()
    assert len(shapes) == len(nodes)
    assert len(edges) == len(flows)
    for forbidden in ("ixp", "rpa", "sendclosuresummaryemail", "evidencesnapshotautomation"):
        assert forbidden not in raw
```

- [ ] **Step 2: Run the BPMN tests and verify RED**

Run:

```bash
uv run --with pytest pytest test/test_additive_provider_record_bpmn.py -q
```

Expected: FAIL because the scaffold does not contain the provider request/intake topology or contract.

- [ ] **Step 3: Pull the BPMN registry and resolve the existing API process**

Run exactly once and capture the verified release key through the CLI's own output filter:

```bash
UIPATH_CLI_DISABLE_VERSION_SYNC=1 uip maestro bpmn registry pull --output json
UIPATH_CLI_DISABLE_VERSION_SYNC=1 uip maestro bpmn registry search "PI360ApiWorkflows" --output json
PI360_PROVIDER_API_RELEASE_KEY="$(UIPATH_CLI_DISABLE_VERSION_SYNC=1 uip maestro bpmn registry search "PI360ApiWorkflows" --output plain --output-filter "Processes[?Name=='PI360ApiWorkflows'] | [0].ReleaseKey")"
test -n "$PI360_PROVIDER_API_RELEASE_KEY"
```

Require exactly one `PI360ApiWorkflows` process match. Record its returned process/cloud key and folder metadata in the task report. If the match is absent or ambiguous, stop without creating a substitute project or binding.

- [ ] **Step 4: Author the new BPMN from the reviewed provider-record source**

Use `apply_patch` to replace only the generated `.bpmn` source. Take `ProgramIntegrity360/PI360AdHocReviewBpmn/PI360AdHocReviewBpmn.bpmn` as the reviewed structural/registry-payload baseline and apply these exact identity changes:

```text
Process_PI360AdHocReview → PI360HospiceProviderRecordProcess
PI360 Ad Hoc Review → PI360 Hospice Provider Record
```

Preserve the reviewed source's stable element IDs, registry-owned `uipath:*` payloads, input/output mappings, exclusive gateways, `P3D` timer, three end outcomes, sequence-flow topology, and complete BPMN diagram. Do not copy the old `project.uiproj` or old solution project ID.

- [ ] **Step 5: Import the discovered API process and regenerate BPMN metadata**

Use the exact cloud key returned in Step 3:

```bash
UIPATH_CLI_DISABLE_VERSION_SYNC=1 uip solution resources add --source remote --kind Process --cloud-key "$PI360_PROVIDER_API_RELEASE_KEY" --solution-folder PI360AdditiveOrchestration --output json
UIPATH_CLI_DISABLE_VERSION_SYNC=1 uip solution resources refresh --solution-folder PI360AdditiveOrchestration --output json
UIPATH_CLI_DISABLE_VERSION_SYNC=1 uip maestro bpmn pack PI360AdditiveOrchestration/PI360HospiceProviderRecordBpmn /private/tmp/pi360-additive-bpmn-pack --output json
```

Do not substitute the old solution-definition key `9c77c6aa-3a07-4053-a559-28c98f2520a3` for the registry-returned `ReleaseKey`.

- [ ] **Step 6: Validate the BPMN and focused tests**

Run:

```bash
UIPATH_CLI_DISABLE_VERSION_SYNC=1 uip maestro bpmn validate PI360AdditiveOrchestration/PI360HospiceProviderRecordBpmn/PI360HospiceProviderRecordBpmn.bpmn --output json
node /Users/sohail.ghatnekar/.agents/skills/uipath-maestro-bpmn/validator/validate-bpmn.mjs PI360AdditiveOrchestration/PI360HospiceProviderRecordBpmn/PI360HospiceProviderRecordBpmn.bpmn
uv run --with pytest pytest test/test_additive_provider_record_bpmn.py -q
```

Expected: CLI status `Valid`, bundled validator `VALID`, focused tests pass.

- [ ] **Step 7: Commit the BPMN**

```bash
git add PI360AdditiveOrchestration/PI360HospiceProviderRecordBpmn PI360AdditiveOrchestration/resources test/test_additive_provider_record_bpmn.py
git commit -m "feat: add standalone hospice provider record BPMN"
```

---

### Task 4: Add the manual Case-binding handoff and verify the package

**Files:**
- Create: `PI360AdditiveOrchestration/README.md`
- Modify only if generated by refresh: `PI360AdditiveOrchestration/PI360AdditiveOrchestration.uipx`
- Test: `test/test_additive_orchestration_solution.py`

**Interfaces:**
- Consumes: validated Flow and BPMN projects.
- Produces: concise manual-binding instructions and one inspected local solution package.

- [ ] **Step 1: Add the handoff contract to the solution test**

```python
def test_additive_solution_handoff_names_both_processes_and_no_case_edit():
    handoff = (SOLUTION / "README.md").read_text()
    assert "PI360EvidenceRoutingFlow" in handoff
    assert "PI360HospiceProviderRecordBpmn" in handoff
    assert "Stage_Evcol2" in handoff
    assert "Stage_Prreq6" in handoff
    assert "Stage_Corr4a" in handoff
    assert "No Case Plan files are included" in handoff
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
uv run --with pytest pytest test/test_additive_orchestration_solution.py -q
```

Expected: FAIL because `README.md` does not exist.

- [ ] **Step 3: Write the concise manual-binding README**

Document only:

```text
Evidence stage Stage_Evcol2: add a process task bound to PI360EvidenceRoutingFlow and map the six object inputs plus ten outputs.
Provider stage Stage_Prreq6: add a process task bound to PI360HospiceProviderRecordBpmn and map five inputs plus four outputs.
Investigation Stage_Corr4a: accept recommendedStageId/NextStageId equal to Stage_Corr4a.
No Case Plan files are included; existing Case edits remain manual.
```

Include the exact input/output names from Tasks 2 and 3; do not include tenant GUIDs or private folder values.

- [ ] **Step 4: Run complete local verification**

Run:

```bash
uv run --with pytest pytest -q
UIPATH_CLI_DISABLE_VERSION_SYNC=1 uip maestro flow format PI360AdditiveOrchestration/PI360EvidenceRoutingFlow/PI360EvidenceRoutingFlow.flow --output json
UIPATH_CLI_DISABLE_VERSION_SYNC=1 uip maestro flow validate PI360AdditiveOrchestration/PI360EvidenceRoutingFlow/PI360EvidenceRoutingFlow.flow --strict-bindings --output json
UIPATH_CLI_DISABLE_VERSION_SYNC=1 uip maestro bpmn validate PI360AdditiveOrchestration/PI360HospiceProviderRecordBpmn/PI360HospiceProviderRecordBpmn.bpmn --output json
node /Users/sohail.ghatnekar/.agents/skills/uipath-maestro-bpmn/validator/validate-bpmn.mjs PI360AdditiveOrchestration/PI360HospiceProviderRecordBpmn/PI360HospiceProviderRecordBpmn.bpmn
UIPATH_CLI_DISABLE_VERSION_SYNC=1 uip solution resources refresh --solution-folder PI360AdditiveOrchestration --output json
```

Also run:

```bash
git diff a838303 -- ProgramIntegrity360/PI360CaseManagement
```

Expected: no output; the Case Plan is byte-for-byte untouched.

- [ ] **Step 5: Pack and inspect the additive solution**

Create a temporary directory with `mktemp -d`, then run:

```bash
PI360_ADDITIVE_PACK_DIR="$(mktemp -d)"
test -d "$PI360_ADDITIVE_PACK_DIR"
UIPATH_CLI_DISABLE_VERSION_SYNC=1 uip solution pack PI360AdditiveOrchestration "$PI360_ADDITIVE_PACK_DIR" --version 1.0.0 --output json
```

Inspect the ZIP and require:

- exactly two project packages;
- no `PI360CaseManagement`, IXP, RPA, app, agent, or email project;
- both Beeceptor URLs and GET metadata in the Flow package;
- `P3D`, provider request/intake, and `Stage_Corr4a` in the BPMN package;
- no project/resource name ending in `_1` or another numeric suffix.

- [ ] **Step 6: Commit the handoff and reviewed generated metadata**

```bash
git add PI360AdditiveOrchestration test/test_additive_orchestration_solution.py
git commit -m "docs: add PI360 orchestration binding handoff"
```

---

### Task 5: Upload only the new solution and update GitHub

**Files:**
- No intended source edits.
- Record command outputs and archive checksum in the subagent task report under `.superpowers/sdd/`.

**Interfaces:**
- Consumes: reviewed additive solution source and inspected version `1.0.0` package.
- Produces: one new Studio Web solution URL plus the updated GitHub branch.

- [ ] **Step 1: Re-run the mutation gate**

Run:

```bash
git status --short --branch
git diff a838303 -- ProgramIntegrity360/PI360CaseManagement
UIPATH_CLI_DISABLE_VERSION_SYNC=1 uip login status --output json
UIPATH_CLI_DISABLE_VERSION_SYNC=1 uip solution upload --help --output json
```

Require a clean worktree, no Case diff, target `uipathlabs / Playground`, and help text confirming a new SolutionId imports without `--force`.

- [ ] **Step 2: Verify the local SolutionId cannot target the existing solution**

Read `PI360AdditiveOrchestration/PI360AdditiveOrchestration.uipx` and assert its `SolutionId` is present, is a GUID, and is not `494be60c-8bb2-4478-3beb-08def46ec69f`. Query Studio Web read-only for that new ID through `uip solution upload`'s preflight behavior or the supported solution GET surface; require that no cloud solution exists with the new ID.

- [ ] **Step 3: Upload the new solution without force**

Run exactly:

```bash
UIPATH_CLI_DISABLE_VERSION_SYNC=1 uip solution upload PI360AdditiveOrchestration --output json
```

Never add `--force`. Stop if the CLI reports an existing SolutionId, overwrite, replacement, deletion, history mutation, or any target equal to `494be60c-8bb2-4478-3beb-08def46ec69f`.

- [ ] **Step 4: Verify the new Studio Web solution**

Confirm the returned SolutionId differs from the existing ProgramIntegrity360 ID, the DesignerUrl opens the new solution, and its project inventory contains exactly:

```text
PI360EvidenceRoutingFlow
PI360HospiceProviderRecordBpmn
```

Do not publish, deploy, run, or debug either project.

- [ ] **Step 5: Push the reviewed branch**

Run:

```bash
git push origin codex/pi360-multiscenario-refit
git rev-parse HEAD
git ls-remote origin refs/heads/codex/pi360-multiscenario-refit
```

Require the local and remote commit hashes to match. Report the existing pull request and new Studio Web URL.

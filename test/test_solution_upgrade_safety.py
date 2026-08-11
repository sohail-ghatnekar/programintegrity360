import json
import re
import xml.etree.ElementTree as ET
from pathlib import Path


SOLUTION_ROOT = Path(__file__).parents[1] / "ProgramIntegrity360"
RESOURCE_ROOT = SOLUTION_ROOT / "resources" / "solution_folder"
USER_PROFILE_ROOT = SOLUTION_ROOT / "userProfile"
CASE_MANAGER_RESOURCE_KEY = "64ee0873-ac2c-4393-a970-7f67f9c7a423"
ESCALATION_APP_RESOURCE_KEY = "54f913fa-10c8-4eec-85ef-58f05e15b6d5"
PROGRAM_INTEGRITY_FABRIC_RESOURCE_KEY = "a0bd364e-c6cc-4749-9f92-f6a46e59fe4d"
CASE_MANAGER_FLOW_RESOURCE_KEY = "8dd7c4ad-7050-4e54-b915-854f29fa5fd6"
AD_HOC_REVIEW_BPMN_RESOURCE_KEY = "5fb67ceb-1d49-475b-96a3-1037eb152b2d"
API_WORKFLOWS_RESOURCE_KEY = "9c77c6aa-3a07-4053-a559-28c98f2520a3"
IXP_TIMESHEET_RESOURCE_KEY = "da8d33bc-864b-4ac0-ad48-220a77834bbd"
BPMN_PATH = SOLUTION_ROOT / "PI360AdHocReviewBpmn" / "PI360AdHocReviewBpmn.bpmn"
CLOUD_PROJECTS = {
    "PI360SummaryAgent": "734cac0b-a987-4ec4-8cd4-dc5d3b1e6d4c",
    "PI360CaseManagerAgent": "72209049-a669-4dee-af0f-f67a87df1253",
    "PI360ClaimDetailsApi": "2b115f5e-5658-4c0e-b9b3-8abc0b169713",
    "PI360TriageAgent": "d38cd7b3-689b-42c7-90b2-677dc8bd97e5",
    "PI360RecordConversationAgent": "2c65953d-0ff3-4ea7-adba-d6c56817ad72",
    "PI360CaseManagerFlow": "d150de15-dafd-45ed-8573-a311d655a055",
    "PI360EscalationActionApp": "e0eab46c-4d80-4aac-8ef9-47644098ceaf",
    "PI360QuickRulesCodedAgent": "47fa13a5-3cc9-40ee-a687-b9a8fd53b216",
    "PI360CaseManagement": "465532d2-519c-4823-b2f7-9e4ef9a76be7",
    "PI360AdHocReviewBpmn": "442a257b-bb42-4053-93c2-dd511080885f",
    "PI360InvestigationPlanningAgent": "f27c930e-42d5-4db7-8597-5c606122a15d",
    "PI360EvidenceCorrelationAgent": "49768f19-d2bb-4abb-aad5-2701160b0392",
    "PI360ApiWorkflows": "9dd25760-de4f-4b0b-bfc8-ecdbcd48f863",
    "PI360DecisionPacketAutomation": "6f19e849-d1e4-4509-a32f-e4a2335996ac",
    "PI360EvidenceSnapshotAutomation": "58e4aa89-7358-47ee-a0d4-6711e9792208",
    "PI360 IXP Timesheet": "616518cc-4755-4790-a5ad-3f2c7b4191a5",
    "PI360RecoveryAuthorizationActionApp": "ec7a30ac-2270-421a-b5f7-0d9676d3bbe4",
}
CLOUD_RESOURCE_KEYS = {
    "03d46443-0ae3-460a-8ad5-dce6e8fdea62",
    "cc65fd9e-f779-447e-a45d-24fda4ee318e",
    "54f913fa-10c8-4eec-85ef-58f05e15b6d5",
    "f03d4cd5-2d9b-4202-b8df-9042004b7325",
    "ee5b39e1-60de-4ddd-92c3-3bc05d0d74c4",
    "a0bd364e-c6cc-4749-9f92-f6a46e59fe4d",
    "b8b2d499-1a77-8063-8c63-d58052db357d",
    "9482957c-64bb-8001-8030-26e03416127d",
    "4dafc4c7-2090-4d24-bbc2-7a51f0b539ca",
    "f3c10615-185f-4eea-bcb8-c6c549eaab80",
    "6b0b4cb2-318e-48a2-9126-ce021507131d",
    "7767e490-7d90-4a12-80af-b567e63d4235",
    "eeb0ef1d-53cd-4174-8fd6-a13b54f8ae8a",
    "d4fc01a6-9cba-4245-bfca-2bfc9e0726a9",
    "e52e6a4d-5992-43f5-83bb-6c03a54daea5",
    "1358edb0-6f6c-4267-a180-2f862e29713d",
    "0f60dc9b-ee5c-4380-b92d-a06689f8b19f",
    "86dcc831-9532-40a1-9a96-309010314afc",
    "c5a54f6f-1c99-4153-8078-7c70c0e1d861",
    "f94a79e7-44cd-42a6-ab3f-8164a63408cd",
    "5ebc2453-4dca-4159-93f5-deaf778da54f",
    "eb0ebd1d-1112-4cac-8768-03575403b597",
    "165318d1-7e06-4a0d-8827-18158c01bddb",
    "a9e226dd-1ea4-4352-b71e-9c482d328736",
    "d8a8ac1a-bcb8-4342-926c-c15664b5d225",
    "pi360-escalation-action-app:0.2.0",
    "pi360-recovery-approval:0.2.0",
    "64ee0873-ac2c-4393-a970-7f67f9c7a423",
    "d7ec72d4-6fa4-4a00-b86b-dcf4dbe8380f",
    "f8e4b893-098d-4435-9a8d-52ec75e7a9fa",
    "fabc409c-d468-4964-92e0-2171e0ced3ba",
    "78a50d04-e2a1-4a50-a51c-7cbb3f16ef4d",
    "63198c10-58f0-4380-b41a-b51f567ea457",
    "07bc936d-d767-4ca8-845d-f6be376a0e2b",
    "9c77c6aa-3a07-4053-a559-28c98f2520a3",
    "6d04d330-e36f-4da8-a0ae-b74fef97f1b4",
    "1e19a003-38dc-4bd3-a70e-14f262d4c19c",
    "8dd7c4ad-7050-4e54-b915-854f29fa5fd6",
    "4b3445e2-e309-4462-98b1-ee5a8e19c24b",
    "58e4aa89-7358-47ee-a0d4-6711e9792208",
    "da8d33bc-864b-4ac0-ad48-220a77834bbd",
    "5fb67ceb-1d49-475b-96a3-1037eb152b2d",
}


def _all_solution_resources() -> list[dict]:
    resources = []
    for path in RESOURCE_ROOT.rglob("*.json"):
        payload = json.loads(path.read_text())
        resource = payload.get("resource", {})
        if resource.get("key"):
            resources.append(resource)
    return resources


def _deployment_resources() -> list[dict]:
    return [
        resource
        for resource in _all_solution_resources()
        if resource.get("kind") in {"app", "process"}
    ]


def test_local_solution_preserves_every_cloud_project_name_and_id():
    manifest = json.loads((SOLUTION_ROOT / "ProgramIntegrity360.uipx").read_text())
    actual = {
        Path(project["ProjectRelativePath"]).parent.name: project["Id"]
        for project in manifest["Projects"]
    }

    missing_or_changed = {
        name: project_id
        for name, project_id in CLOUD_PROJECTS.items()
        if actual.get(name) != project_id
    }
    assert missing_or_changed == {}, (
        "Local solution must preserve every cloud project name and ID: "
        f"{missing_or_changed}"
    )


def test_local_solution_resource_keys_are_a_superset_of_cloud_baseline():
    actual = {resource["key"] for resource in _all_solution_resources()}
    missing = CLOUD_RESOURCE_KEYS - actual

    assert missing == set(), (
        "Local solution must preserve every cloud resource key: "
        f"{sorted(missing)}"
    )


def test_case_project_keeps_packager_inputs_at_root_with_content_mappings():
    project_root = SOLUTION_ROOT / "PI360CaseManagement"
    package_files = json.loads(
        (project_root / "package-descriptor.json").read_text()
    )["files"]

    assert (project_root / "caseplan.json").is_file()
    assert (project_root / "caseplan.json.bpmn").is_file()
    assert not (project_root / "content" / "caseplan.json").exists()
    assert package_files["caseplan.json"] == "content/caseplan.json"
    assert package_files["caseplan.json.bpmn"] == "content/caseplan.json.bpmn"


def test_solution_has_no_shadow_copies_of_owned_deployment_resources():
    resources = _deployment_resources()
    identities = {
        (resource["kind"], resource.get("type"), resource["name"])
        for resource in resources
    }

    shadow_copies = []
    for resource in resources:
        match = re.fullmatch(r"(.+)_\d+", resource["name"])
        if not match:
            continue
        base_identity = (resource["kind"], resource.get("type"), match.group(1))
        if base_identity in identities:
            shadow_copies.append(resource["name"])

    assert shadow_copies == [], (
        "Solution upgrades cannot bundle suffixed reference copies of resources "
        f"already owned by the deployment: {sorted(shadow_copies)}"
    )


def test_concrete_runtime_dependency_keys_resolve_locally():
    resources = _deployment_resources()
    local_keys = {resource["key"] for resource in _all_solution_resources()}
    unresolved = []

    for resource in resources:
        for dependency in resource.get("runtimeDependencies", []):
            dependency_key = dependency.get("resourceKey")
            if dependency_key and dependency_key not in local_keys:
                unresolved.append((resource["name"], dependency_key))

    assert unresolved == [], (
        "Concrete runtime dependency keys must resolve to resources in the "
        f"upgrade package: {unresolved}"
    )


def test_api_workflows_requires_program_integrity_fabric_dependency():
    path = RESOURCE_ROOT / "process" / "api" / "PI360ApiWorkflows.json"
    resource = json.loads(path.read_text())["resource"]
    dependencies = {
        (
            dependency.get("resourceKey"),
            dependency.get("resourceName"),
            dependency.get("resourceKind"),
            dependency.get("resourceType"),
        )
        for dependency in resource.get("runtimeDependencies", [])
    }

    assert (
        PROGRAM_INTEGRITY_FABRIC_RESOURCE_KEY,
        "Program Integrity Fabric",
        "Connection",
        "uipath-uipath-dataservice",
    ) in dependencies


def test_debug_overwrites_reference_local_solution_resources():
    local_keys = {
        json.loads(path.read_text())["resource"]["key"]
        for path in RESOURCE_ROOT.rglob("*.json")
    }
    stale_overwrites = []

    for path in USER_PROFILE_ROOT.rglob("debug_overwrites.json"):
        payload = json.loads(path.read_text())
        for tenant in payload.get("tenants", []):
            for item in tenant.get("resources", []):
                key = item.get("solutionResourceKey")
                if key not in local_keys:
                    stale_overwrites.append((str(path.relative_to(SOLUTION_ROOT)), key))

    assert stale_overwrites == [], (
        "Debug overwrites must not keep references to shadow resources that "
        f"are absent from the solution package: {stale_overwrites}"
    )


def test_caseworker_app_binding_is_solution_relative_and_unique():
    project_root = SOLUTION_ROOT / "PI360CaseManagerAgent"
    bindings = json.loads((project_root / "bindings_v2.json").read_text())
    app_bindings = [
        binding
        for binding in bindings["resources"]
        if binding["resource"] == "app"
        and binding["key"] == ESCALATION_APP_RESOURCE_KEY
    ]
    action = json.loads(
        (
            project_root
            / "resources"
            / "SupervisorEscalation"
            / "resource.json"
        ).read_text()
    )

    assert len(app_bindings) == 1
    folder_path = app_bindings[0]["value"].get("folderPath", {}).get(
        "defaultValue"
    )
    assert folder_path in {None, "solution_folder"}
    assert action["channels"][0]["properties"]["folderName"] == "solution_folder"


def test_owned_sibling_bindings_are_pinned_to_solution_resource_keys():
    expected = {
        SOLUTION_ROOT / "PI360CaseManagement" / "bindings_v2.json": {
            ("process", CASE_MANAGER_RESOURCE_KEY),
            ("app", ESCALATION_APP_RESOURCE_KEY),
            ("process", CASE_MANAGER_FLOW_RESOURCE_KEY),
            ("process", AD_HOC_REVIEW_BPMN_RESOURCE_KEY),
            ("process", IXP_TIMESHEET_RESOURCE_KEY),
        },
        SOLUTION_ROOT / "PI360CaseManagerAgent" / "bindings_v2.json": {
            ("app", ESCALATION_APP_RESOURCE_KEY),
        },
    }

    for path, expected_bindings in expected.items():
        payload = json.loads(path.read_text())
        actual = {
            (binding["resource"], binding["key"])
            for binding in payload["resources"]
        }
        assert actual == expected_bindings
        for binding in payload["resources"]:
            assert "name" not in binding.get("value", {}), (
                "Owned sibling bindings must resolve directly by the solution "
                "resource key. A name value makes resource refresh import the "
                "live deployment as a suffixed shadow resource."
            )


def test_case_orchestration_resources_are_unique_unsuffixed_processes():
    resources = _deployment_resources()
    expected = {
        ("PI360CaseManagerFlow", "flow"): CASE_MANAGER_FLOW_RESOURCE_KEY,
        ("PI360AdHocReviewBpmn", "processOrchestration"): (
            AD_HOC_REVIEW_BPMN_RESOURCE_KEY
        ),
    }

    for (name, resource_type), resource_key in expected.items():
        matches = [
            resource
            for resource in resources
            if resource["name"] == name and resource.get("type") == resource_type
        ]
        assert len(matches) == 1
        assert matches[0]["key"] == resource_key
        assert re.fullmatch(r".+_\d+", matches[0]["name"]) is None


def test_bpmn_provider_request_contract_is_complete_and_contains_no_rpa_activity():
    namespaces = {
        "bpmn": "http://www.omg.org/spec/BPMN/20100524/MODEL",
        "bpmndi": "http://www.omg.org/spec/BPMN/20100524/DI",
        "uipath": "http://uipath.org/schema/bpmn",
    }
    root = ET.parse(BPMN_PATH).getroot()
    process = root.find("bpmn:process", namespaces)
    assert process is not None
    service_tasks = process.findall("bpmn:serviceTask", namespaces)

    def api_task(workflow_name):
        matches = [
            task
            for task in service_tasks
            if task.find(".//uipath:type", namespaces).attrib["value"]
            == "Orchestrator.ExecuteApiWorkflowAsync"
            and workflow_name in ET.tostring(task, encoding="unicode")
        ]
        assert len(matches) == 1
        return matches[0]

    request_task = api_task("RequestHospitalRecord")
    intake_task = api_task("IntakeHospitalRecord")
    for task in (request_task, intake_task):
        response_outputs = [
            output
            for output in task.findall(".//uipath:output", namespaces)
            if output.attrib.get("name") == "Process response"
            and output.attrib.get("type") == "Orchestrator.RunJob"
        ]
        assert len(response_outputs) == 1

    bindings = json.loads(
        (BPMN_PATH.parent / "bindings_v2.json").read_text()
    )["resources"]
    assert {
        (binding["resource"], binding["key"]) for binding in bindings
    } == {("process", API_WORKFLOWS_RESOURCE_KEY)}

    entry_point = json.loads(
        (BPMN_PATH.parent / "entry-points.json").read_text()
    )["entryPoints"][0]
    assert set(entry_point["input"]["properties"]) == {
        "CaseId",
        "CaseType",
        "ProviderId",
        "HospitalRecordAvailable",
        "InvestigatorProceed",
    }
    assert set(entry_point["output"]["properties"]) == {
        "ProviderRequestStatus",
        "HospitalRecordAvailable",
        "NextStageId",
        "AuditMessage",
    }

    sequence_flows = process.findall("bpmn:sequenceFlow", namespaces)
    proceed_gateway = process.find(
        "bpmn:exclusiveGateway[@id='Gateway_InvestigatorProceed']", namespaces
    )
    assert proceed_gateway is not None
    assert any(
        flow.attrib["sourceRef"] == proceed_gateway.attrib["id"]
        and flow.attrib["targetRef"] == request_task.attrib["id"]
        and flow.find("bpmn:conditionExpression", namespaces) is not None
        and "Var_InvestigatorProceed"
        in flow.find("bpmn:conditionExpression", namespaces).text
        for flow in sequence_flows
    )
    blocked_flow = next(
        flow
        for flow in sequence_flows
        if flow.attrib["id"] == proceed_gateway.attrib["default"]
    )
    assert blocked_flow.attrib["targetRef"] != request_task.attrib["id"]
    blocked_end = process.find(
        f"bpmn:endEvent[@id='{blocked_flow.attrib['targetRef']}']", namespaces
    )
    assert blocked_end is not None
    blocked_xml = ET.tostring(blocked_end, encoding="unicode")
    assert "Blocked" in blocked_xml
    assert "no analysis was performed" in blocked_xml
    timer_matches = [
        event
        for event in process.findall("bpmn:intermediateCatchEvent", namespaces)
        if event.find("bpmn:timerEventDefinition/bpmn:timeDuration", namespaces)
        is not None
    ]
    assert len(timer_matches) == 1
    timer = timer_matches[0]
    timer_duration = timer.find(
        "bpmn:timerEventDefinition/bpmn:timeDuration", namespaces
    )
    assert timer_duration.text == "P3D"

    sequence_graph = {}
    for sequence_flow in sequence_flows:
        sequence_graph.setdefault(sequence_flow.attrib["sourceRef"], set()).add(
            sequence_flow.attrib["targetRef"]
        )

    def reaches(source_id, target_id):
        pending = [source_id]
        visited = set()
        while pending:
            current = pending.pop()
            if current == target_id:
                return True
            if current in visited:
                continue
            visited.add(current)
            pending.extend(sequence_graph.get(current, ()))
        return False

    assert reaches(request_task.attrib["id"], timer.attrib["id"])
    assert reaches(timer.attrib["id"], intake_task.attrib["id"])
    process_xml = ET.tostring(process, encoding="unicode")
    assert "TimedOutAwaitingProvider" in process_xml
    assert "Stage_Corr4a" in process_xml

    activities = root.findall(".//uipath:activity", namespaces)
    activity_types = [
        activity.find("uipath:type", namespaces).attrib["value"]
        for activity in activities
    ]

    diagram = root.find(".//bpmndi:BPMNDiagram", namespaces)
    assert diagram is not None
    assert diagram.find("bpmndi:BPMNPlane", namespaces) is not None
    assert diagram.findall(".//bpmndi:BPMNShape", namespaces)
    assert diagram.findall(".//bpmndi:BPMNEdge", namespaces)
    assert diagram.find(
        f".//bpmndi:BPMNShape[@bpmnElement='{timer.attrib['id']}']", namespaces
    ) is not None
    assert "Orchestrator.StartJob" not in activity_types
    assert not any(
        "ixp" in ET.tostring(activity, encoding="unicode").lower()
        for activity in activities
    )
    assert "CreateCaseAuditTrail" not in ET.tostring(process, encoding="unicode")

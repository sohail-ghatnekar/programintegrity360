import json
import xml.etree.ElementTree as ET
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PROJECT_DIR = (
    ROOT
    / "PI360AdditiveOrchestration"
    / "PI360HospiceProviderRecordBpmn"
)
BPMN_PATH = PROJECT_DIR / "PI360HospiceProviderRecordBpmn.bpmn"
NS = {
    "bpmn": "http://www.omg.org/spec/BPMN/20100524/MODEL",
    "bpmndi": "http://www.omg.org/spec/BPMN/20100524/DI",
    "uipath": "http://uipath.org/schema/bpmn",
}


def _root_and_process():
    root = ET.parse(BPMN_PATH).getroot()
    process = root.find("./bpmn:process", NS)
    assert process is not None
    return root, process


def _variables(process):
    variables = process.find("./bpmn:extensionElements/uipath:variables", NS)
    assert variables is not None
    return variables


def _public_variable_names(variables, tags):
    return {
        item.attrib["name"]
        for item in variables
        if item.tag.rsplit("}", 1)[-1] in tags
        and item.attrib.get("elementId") == "Event_Start"
    }


def _flows_by_id(process):
    return {
        flow.attrib["id"]: flow
        for flow in process.findall("./bpmn:sequenceFlow", NS)
    }


def _assert_flow(flows, flow_id, source, target):
    flow = flows[flow_id]
    assert flow.attrib["sourceRef"] == source
    assert flow.attrib["targetRef"] == target
    return flow


def _end_outputs(process, end_id):
    end = process.find(f"./bpmn:endEvent[@id='{end_id}']", NS)
    assert end is not None
    return {
        item.attrib["name"]: item.attrib
        for item in end.findall(
            "./bpmn:extensionElements/uipath:mapping/uipath:output", NS
        )
    }


def test_provider_bpmn_exposes_only_the_required_entry_point_contract():
    _, process = _root_and_process()
    variables = _variables(process)

    assert process.attrib == {
        "id": "PI360HospiceProviderRecordProcess",
        "name": "PI360 Hospice Provider Record",
        "isExecutable": "true",
    }
    assert _public_variable_names(variables, {"input", "inputOutput"}) == {
        "CaseId",
        "CaseType",
        "ProviderId",
        "HospitalRecordAvailable",
        "InvestigatorProceed",
    }
    assert _public_variable_names(variables, {"output", "inputOutput"}) == {
        "ProviderRequestStatus",
        "HospitalRecordAvailable",
        "NextStageId",
        "AuditMessage",
    }


def test_provider_bpmn_has_exact_blocked_received_and_timed_out_paths():
    _, process = _root_and_process()
    flows = _flows_by_id(process)

    _assert_flow(flows, "Flow_Start_ProceedGate", "Event_Start", "Gateway_InvestigatorProceed")
    proceed = _assert_flow(
        flows,
        "Flow_Proceed_Request",
        "Gateway_InvestigatorProceed",
        "Task_RequestHospitalRecord",
    )
    _assert_flow(
        flows,
        "Flow_Proceed_Blocked",
        "Gateway_InvestigatorProceed",
        "Event_EndBlocked",
    )
    _assert_flow(
        flows,
        "Flow_Request_ResponseRace",
        "Task_RequestHospitalRecord",
        "Gateway_ProviderResponseRace",
    )
    _assert_flow(
        flows,
        "Flow_Race_Received",
        "Gateway_ProviderResponseRace",
        "Event_ProviderRecordReceived",
    )
    _assert_flow(
        flows,
        "Flow_Race_Timeout",
        "Gateway_ProviderResponseRace",
        "Event_AwaitProviderResponse",
    )
    _assert_flow(
        flows,
        "Flow_Received_Intake",
        "Event_ProviderRecordReceived",
        "Task_IntakeHospitalRecord",
    )
    _assert_flow(
        flows,
        "Flow_Timeout_Awaiting",
        "Event_AwaitProviderResponse",
        "Event_EndAwaitingProvider",
    )
    _assert_flow(
        flows,
        "Flow_Intake_Investigation",
        "Task_IntakeHospitalRecord",
        "Event_EndInvestigation",
    )

    proceed_gate = process.find(
        "./bpmn:exclusiveGateway[@id='Gateway_InvestigatorProceed']", NS
    )
    response_race = process.find(
        "./bpmn:eventBasedGateway[@id='Gateway_ProviderResponseRace']", NS
    )
    assert proceed_gate is not None
    assert response_race is not None
    assert proceed_gate.attrib["default"] == "Flow_Proceed_Blocked"
    assert proceed.findtext("./bpmn:conditionExpression", namespaces=NS) == (
        '=vars.Var_CaseType == "StateMedicaidHospice" '
        "&& vars.Var_InvestigatorProceed == true"
    )
    assert process.find(
        "./bpmn:exclusiveGateway[@id='Gateway_HospitalRecordAvailable']", NS
    ) is None
    assert {
        outgoing.text for outgoing in response_race.findall("./bpmn:outgoing", NS)
    } == {"Flow_Race_Received", "Flow_Race_Timeout"}

    duration = process.findtext(
        "./bpmn:intermediateCatchEvent[@id='Event_AwaitProviderResponse']"
        "/bpmn:timerEventDefinition/bpmn:timeDuration",
        namespaces=NS,
    )
    assert duration == "P3D"


def test_provider_bpmn_correlates_the_received_message_by_case_id():
    _, process = _root_and_process()
    variables = _variables(process)
    response_variable = variables.find(
        "./uipath:inputOutput[@id='Var_ProviderRecordMessageResponse']", NS
    )
    received = process.find(
        "./bpmn:intermediateCatchEvent[@id='Event_ProviderRecordReceived']", NS
    )

    assert response_variable is not None
    assert response_variable.attrib == {
        "id": "Var_ProviderRecordMessageResponse",
        "name": "ProviderRecordMessageResponse",
        "type": "Maestro.ReceiveMessageEvent",
        "elementId": "Event_ProviderRecordReceived",
    }
    assert received is not None
    assert received.attrib["name"] == "PI360ProviderRecordReceived"
    event = received.find("./bpmn:extensionElements/uipath:event", NS)
    assert event is not None
    event_type = event.find("./uipath:type", NS)
    assert event_type is not None
    assert event_type.attrib == {
        "value": "Maestro.ReceiveMessageEvent",
        "version": "v1",
    }
    context = {
        item.attrib["name"]: item.attrib.get("value")
        for item in event.findall("./uipath:context/uipath:input", NS)
    }
    assert context == {
        "name": "PI360ProviderRecordReceived",
        "_label": "Provider record received",
    }
    reference = event.find("./uipath:input[@name='Reference']", NS)
    assert reference is not None
    assert reference.attrib == {
        "name": "Reference",
        "type": "string",
        "value": "=vars.Var_CaseId",
        "target": "bodyField",
    }
    response = event.find("./uipath:output[@name='response']", NS)
    assert response is not None
    assert response.attrib == {
        "name": "response",
        "type": "Maestro.ReceiveMessageEvent",
        "var": "Var_ProviderRecordMessageResponse",
    }
    assert received.find("./bpmn:messageEventDefinition", NS) is not None


def test_provider_bpmn_passes_received_record_metadata_to_intake():
    _, process = _root_and_process()
    intake = process.find("./bpmn:serviceTask[@id='Task_IntakeHospitalRecord']", NS)

    assert intake is not None
    job_arguments = intake.find(
        "./bpmn:extensionElements/uipath:activity/"
        "uipath:input[@name='JobArguments']",
        NS,
    )
    assert job_arguments is not None
    assert json.loads(job_arguments.text)["documentInput"] == (
        "=vars.Var_ProviderRecordMessageResponse"
    )


def test_provider_bpmn_maps_each_distinct_outcome():
    _, process = _root_and_process()

    blocked = _end_outputs(process, "Event_EndBlocked")
    timed_out = _end_outputs(process, "Event_EndAwaitingProvider")
    received = _end_outputs(process, "Event_EndInvestigation")

    assert blocked["ProviderRequestStatus"]["source"] == "Blocked"
    assert blocked["NextStageId"]["source"] == "Stage_Prreq6"
    assert timed_out["ProviderRequestStatus"]["source"] == "TimedOutAwaitingProvider"
    assert timed_out["NextStageId"]["source"] == "Stage_Prreq6"
    assert received["ProviderRequestStatus"]["source"] == "Completed"
    assert received["NextStageId"]["source"] == "Stage_Corr4a"

    assert blocked["HospitalRecordAvailable"]["source"] == (
        "=vars.Var_HospitalRecordAvailable"
    )
    assert timed_out["HospitalRecordAvailable"]["source"] == "false"
    assert received["HospitalRecordAvailable"]["source"] == "true"
    assert "StateMedicaidHospice" in blocked["AuditMessage"]["source"]
    assert "investigator authorization" in blocked["AuditMessage"]["source"]

    for outputs in (blocked, timed_out, received):
        assert set(outputs) == {
            "ProviderRequestStatus",
            "HospitalRecordAvailable",
            "NextStageId",
            "AuditMessage",
        }
        assert outputs["AuditMessage"]["source"]


def test_provider_bpmn_uses_only_the_discovered_api_workflow_binding():
    _, process = _root_and_process()
    bindings = process.findall(
        "./bpmn:extensionElements/uipath:bindings/uipath:binding", NS
    )
    binding_by_id = {binding.attrib["id"]: binding.attrib for binding in bindings}
    assert binding_by_id == {
        "Bind_ApiKey": {
            "id": "Bind_ApiKey",
            "name": "releaseKey",
            "type": "string",
            "resource": "process",
            "resourceSubType": "Api",
            "resourceKey": "solution_folder.PI360ApiWorkflows",
            "propertyAttribute": "Key",
        },
        "Bind_ApiFolder": {
            "id": "Bind_ApiFolder",
            "name": "folderPath",
            "type": "string",
            "default": "solution_folder",
            "resource": "process",
            "resourceSubType": "Api",
            "resourceKey": "solution_folder.PI360ApiWorkflows",
            "propertyAttribute": "folderPath",
        },
        "Bind_ApiName": {
            "id": "Bind_ApiName",
            "name": "name",
            "type": "string",
            "default": "PI360ApiWorkflows",
            "resource": "process",
            "resourceSubType": "Api",
            "resourceKey": "solution_folder.PI360ApiWorkflows",
            "propertyAttribute": "name",
        },
    }

    expected_workflow_names = {
        "Task_RequestHospitalRecord": "RequestHospitalRecord",
        "Task_IntakeHospitalRecord": "IntakeHospitalRecord",
    }
    for task_id, workflow_name in expected_workflow_names.items():
        task = process.find(f"./bpmn:serviceTask[@id='{task_id}']", NS)
        assert task is not None
        activity = task.find("./bpmn:extensionElements/uipath:activity", NS)
        assert activity is not None
        type_element = activity.find("./uipath:type", NS)
        assert type_element is not None
        assert type_element.attrib["value"] == "Orchestrator.ExecuteApiWorkflowAsync"
        context = {
            item.attrib["name"]: item.attrib.get("value")
            for item in activity.findall("./uipath:context/uipath:input", NS)
        }
        assert context == {
            "releaseKey": "=bindings.Bind_ApiKey",
            "folderId": "",
            "folderPath": "=bindings.Bind_ApiFolder",
            "name": "=bindings.Bind_ApiName",
        }
        arguments = activity.find("./uipath:input[@name='JobArguments']", NS)
        assert arguments is not None
        assert json.loads(arguments.text)["workflowName"] == workflow_name

    intake = process.find("./bpmn:serviceTask[@id='Task_IntakeHospitalRecord']", NS)
    assert intake is not None
    intake_arguments = intake.find(
        "./bpmn:extensionElements/uipath:activity/"
        "uipath:input[@name='JobArguments']",
        NS,
    )
    assert intake_arguments is not None
    assert json.loads(intake_arguments.text)["hospitalRecordAvailable"] is True

    raw = BPMN_PATH.read_text().lower()
    assert "9c77c6aa-3a07-4053-a559-28c98f2520a3" not in raw
    for forbidden in (
        "ixp",
        "sendclosuresummaryemail",
        "evidencesnapshotautomation",
        "orchestrator.startjob",
        "orchestrator.startagentjob",
    ):
        assert forbidden not in raw


def test_provider_bpmn_diagram_has_exact_node_and_flow_parity():
    root, process = _root_and_process()
    node_tags = {
        f"{{{NS['bpmn']}}}startEvent",
        f"{{{NS['bpmn']}}}endEvent",
        f"{{{NS['bpmn']}}}serviceTask",
        f"{{{NS['bpmn']}}}exclusiveGateway",
        f"{{{NS['bpmn']}}}eventBasedGateway",
        f"{{{NS['bpmn']}}}intermediateCatchEvent",
    }
    node_ids = {
        element.attrib["id"] for element in process if element.tag in node_tags
    }
    flow_ids = set(_flows_by_id(process))
    shape_ids = {
        shape.attrib["bpmnElement"]
        for shape in root.findall(".//bpmndi:BPMNShape", NS)
    }
    edge_ids = {
        edge.attrib["bpmnElement"]
        for edge in root.findall(".//bpmndi:BPMNEdge", NS)
    }
    plane = root.find("./bpmndi:BPMNDiagram/bpmndi:BPMNPlane", NS)

    assert node_ids == {
        "Event_Start",
        "Gateway_InvestigatorProceed",
        "Task_RequestHospitalRecord",
        "Gateway_ProviderResponseRace",
        "Event_ProviderRecordReceived",
        "Event_AwaitProviderResponse",
        "Task_IntakeHospitalRecord",
        "Event_EndBlocked",
        "Event_EndAwaitingProvider",
        "Event_EndInvestigation",
    }
    assert shape_ids == node_ids
    assert edge_ids == flow_ids
    assert plane is not None
    assert plane.attrib["bpmnElement"] == "PI360HospiceProviderRecordProcess"


def test_provider_bpmn_generated_metadata_matches_the_reviewed_contract():
    entry_points = json.loads((PROJECT_DIR / "entry-points.json").read_text())
    bindings = json.loads((PROJECT_DIR / "bindings_v2.json").read_text())
    operate = json.loads((PROJECT_DIR / "operate.json").read_text())
    descriptor = json.loads((PROJECT_DIR / "package-descriptor.json").read_text())

    assert len(entry_points["entryPoints"]) == 1
    entry_point = entry_points["entryPoints"][0]
    assert entry_point["filePath"] == (
        "/content/PI360HospiceProviderRecordBpmn.bpmn#Event_Start"
    )
    assert entry_point["uniqueId"] == "653364ff-7770-494b-b2e3-9d0217d16635"
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

    assert bindings == {
        "version": "2.0",
        "resources": [
            {
                "resource": "process",
                "key": "02f01ee0-324d-4397-8433-5f074899a866",
                "id": "process02f01ee0-324d-4397-8433-5f074899a866",
                "value": {
                    "folderPath": {
                        "defaultValue": "solution_folder",
                        "isExpression": False,
                        "displayName": "Folder path",
                    }
                },
                "metadata": {
                    "ActivityName": "PI360 hospice provider record request and intake",
                    "BindingsVersion": "2.2",
                    "DisplayLabel": "PI360ApiWorkflows",
                    "SolutionsSupport": "true",
                    "subType": "Api",
                },
            }
        ],
    }
    assert operate["main"] == (
        "/content/PI360HospiceProviderRecordBpmn.bpmn#Event_Start"
    )
    assert descriptor["files"]["PI360HospiceProviderRecordBpmn.bpmn"] == (
        "PI360HospiceProviderRecordBpmn.bpmn"
    )
    assert "PI360AdHocReviewBpmn.bpmn" not in descriptor["files"]


def test_provider_bpmn_imported_api_resource_uses_the_discovered_release_key():
    resource_path = (
        ROOT
        / "PI360AdditiveOrchestration"
        / "resources"
        / "solution_folder"
        / "Process"
        / "Api"
        / "PI360ApiWorkflows.json"
    )
    resource = json.loads(resource_path.read_text())
    additive_raw = "\n".join(
        path.read_text(errors="ignore")
        for path in (ROOT / "PI360AdditiveOrchestration").rglob("*")
        if path.is_file()
    ).lower()

    assert resource["resource"]["key"] == "02f01ee0-324d-4397-8433-5f074899a866"
    assert "9c77c6aa-3a07-4053-a559-28c98f2520a3" not in additive_raw
    assert "pi360adhocreviewbpmn.bpmn" not in additive_raw

import copy
import json
import re
from collections import Counter
from pathlib import Path

import pytest


ROOT = Path(__file__).resolve().parents[1]
CASEPLAN_PATH = (
    ROOT
    / "ProgramIntegrity360"
    / "PI360CaseManagement"
    / "caseplan.json"
)
FLOW_RESOURCE_KEY = "solution_folder.PI360CaseManagerFlow"
BPMN_RESOURCE_KEY = "solution_folder.PI360AdHocReviewBpmn"
CLOUD_STAGE_IDS = {
    "Stage_Aintk1",
    "Stage_Evcol2",
    "Stage_Corr4a",
    "Stage_Prreq6",
    "Stage_Supv7a",
    "Stage_Clos9a",
}
CLOUD_TASK_IDS = {
    "tCaseManagerAgent",
    "tINT1case",
    "tTRI1agnt",
    "tCLM2pull",
    "tUeO6EGo3",
    "tQAC3rec",
    "tCOR4evid",
    "tREV5task",
    "tCMR4route",
    "tREQ6send",
    "tPRV6wait",
    "tH5yKJJef",
    "tPKT7prep",
    "tSUP7gate",
    "tCLS9case",
    "thmyc7i2S",
}
DORMANT_CLOUD_TASK_IDS = {"tUeO6EGo3", "tH5yKJJef", "thmyc7i2S"}
CLOUD_ONLY_TASK_CONFIG = {
    "tUeO6EGo3": ("rpa", "IXP Extraction TimeSheet @Matt"),
    "tQAC3rec": ("api-workflow", "Rules - validate threshold and evidence indicators"),
    "tPRV6wait": ("wait-for-timer", "Timer - await hospital record (72 hours)"),
    "tH5yKJJef": ("rpa", "IXP Extraction Medical Record @Matt"),
    "tPKT7prep": ("api-workflow", "API - prepare investigator findings and agentic evidence"),
    "thmyc7i2S": ("rpa", "RPA - send outlook to someone"),
}


def load_caseplan():
    return json.loads(CASEPLAN_PATH.read_text())


def stage_nodes(caseplan):
    return [
        node
        for node in caseplan["nodes"]
        if node.get("type") == "case-management:Stage"
    ]


def stage_tasks(stage):
    return [task for lane in stage["data"].get("tasks", []) for task in lane]


def task_by_id(caseplan, task_id):
    tasks = [task for stage in stage_nodes(caseplan) for task in stage_tasks(stage)]
    return next(task for task in tasks if task["id"] == task_id)


def task_location(caseplan, task_id):
    for stage_index, stage in enumerate(stage_nodes(caseplan)):
        for lane_index, lane in enumerate(stage["data"].get("tasks", [])):
            for task_index, task in enumerate(lane):
                if task["id"] == task_id:
                    return stage, (stage_index, lane_index, task_index)
    raise StopIteration(task_id)


def all_task_ids(caseplan):
    ids = {
        task["id"]
        for stage in stage_nodes(caseplan)
        for task in stage_tasks(stage)
    }
    for lane in caseplan["metadata"]["caseManagerData"]["data"].get("tasks", []):
        ids.update(task["id"] for task in lane)
    return ids


def is_deterministically_dormant(task):
    rules = [
        rule
        for condition in task.get("entryConditions", [])
        for group in condition.get("rules", [])
        for rule in group
    ]
    return (
        task.get("isRequired") is False
        and len(rules) == 1
        and rules[0].get("rule") == "adhoc"
        and rules[0].get("conditionExpression") == "=js:false"
    )


def test_caseplan_stage_and_task_ids_are_a_superset_of_cloud_baseline():
    caseplan = load_caseplan()
    actual_stage_ids = {stage["id"] for stage in stage_nodes(caseplan)}

    assert CLOUD_STAGE_IDS - actual_stage_ids == set()
    assert CLOUD_TASK_IDS - all_task_ids(caseplan) == set()


def test_preserved_ixp_rpa_and_email_tasks_are_present_but_unreachable():
    caseplan = load_caseplan()

    for task_id in DORMANT_CLOUD_TASK_IDS:
        assert is_deterministically_dormant(task_by_id(caseplan, task_id)), task_id


def test_cloud_only_tasks_keep_their_ids_types_names_and_runtime_configuration():
    caseplan = load_caseplan()

    for task_id, (task_type, display_name) in CLOUD_ONLY_TASK_CONFIG.items():
        task = task_by_id(caseplan, task_id)
        assert (task["type"], task["displayName"]) == (task_type, display_name)

    timesheet = task_by_id(caseplan, "tUeO6EGo3")
    assert timesheet["data"]["name"] == "=bindings.b7DAhSveV"
    assert timesheet["data"]["folderPath"] == "=bindings.bpqtM3QdN"
    assert timesheet["data"]["outputs"][0]["id"] == "error"

    validation = task_by_id(caseplan, "tQAC3rec")
    assert validation["data"]["inputs"][0]["value"] == (
        "ValidateEvidenceByCaseType"
    )
    assert [item["name"] for item in validation["data"]["inputs"]] == [
        "workflowName",
        "caseType",
        "caseId",
        "claimTotalBilled",
        "hospitalRecordAvailable",
    ]

    timer = task_by_id(caseplan, "tPRV6wait")
    assert timer["data"] == {"timerType": "timeDuration", "timeDuration": "P3D"}

    packet = task_by_id(caseplan, "tPKT7prep")
    assert packet["data"]["inputs"][0]["value"] == "PrepareSupervisorPacket"


def assert_first_intake_contract(caseplan):
    expected_names = (
        "workflowName",
        "caseType",
        "caseId",
        "caseInput",
        "claimInput",
        "memberInput",
        "providerInput",
        "serviceEventInput",
        "documentInput",
    )
    object_names = expected_names[3:]
    intake = task_by_id(caseplan, "tINT1case")
    intake_stage, intake_position = task_location(caseplan, intake["id"])
    triage = task_by_id(caseplan, "tTRI1agnt")
    triage_stage, triage_position = task_location(caseplan, triage["id"])
    input_items = intake["data"]["inputs"]

    assert intake["type"] == "api-workflow"
    assert intake["shouldRunOnlyOnce"] is True
    assert Counter(item["name"] for item in input_items) == Counter(expected_names)

    inputs = {item["name"]: item for item in input_items}
    assert inputs["workflowName"]["value"] == "IntakeClaimByCaseType"
    assert (
        inputs["caseType"]["value"]
        == "=js:vars.caseInput?.caseType ?? vars.caseInput?.case_type"
    )
    assert (
        inputs["caseId"]["value"]
        == "=js:vars.caseInput?.caseId ?? vars.caseInput?.case_id"
    )

    object_ids = []
    for name in object_names:
        item = inputs[name]
        assert item["type"] == "object"
        assert item["value"] == f"=vars.{name}"
        assert item["id"] == item["var"]
        assert re.fullmatch(r"v[A-Za-z0-9]{8}", item["id"])
        assert item["elementId"] == intake["elementId"]
        object_ids.append(item["id"])
    assert len(set(object_ids)) == len(object_ids)

    dependency_rules = [
        rule
        for condition in triage.get("entryConditions", [])
        for rule_group in condition.get("rules", [])
        for rule in rule_group
        if rule.get("rule") == "selected-tasks-completed"
    ]
    assert len(dependency_rules) == 1
    assert dependency_rules[0]["selectedTasksIds"] == ["tINT1case"]

    assert intake_stage["id"] == triage_stage["id"] == "Stage_Aintk1"
    assert intake_position < triage_position


def test_caseplan_preserves_shared_six_stage_journey_and_six_object_intake():
    caseplan = load_caseplan()
    stages = stage_nodes(caseplan)
    assert {stage["id"] for stage in stages} == {
        "Stage_Aintk1",
        "Stage_Evcol2",
        "Stage_Prreq6",
        "Stage_Corr4a",
        "Stage_Supv7a",
        "Stage_Clos9a",
    }

    input_names = {item["name"] for item in caseplan["variables"]["inputs"]}
    assert input_names == {
        "caseInput",
        "claimInput",
        "memberInput",
        "providerInput",
        "serviceEventInput",
        "documentInput",
    }
    assert all(item["type"] == "jsonSchema" for item in caseplan["variables"]["inputs"])


def test_caseplan_uses_flow_and_bpmn_process_tasks_for_orchestration():
    caseplan = load_caseplan()
    stages = {stage["id"]: stage for stage in stage_nodes(caseplan)}
    bindings = caseplan["bindings"]

    def binding_id(resource_key, name):
        matches = [
            binding
            for binding in bindings
            if binding["resourceKey"] == resource_key and binding["name"] == name
        ]
        assert len(matches) == 1
        return matches[0]["id"]

    flow_name_binding = binding_id(FLOW_RESOURCE_KEY, "name")
    flow_folder_binding = binding_id(FLOW_RESOURCE_KEY, "folderPath")
    bpmn_name_binding = binding_id(BPMN_RESOURCE_KEY, "name")
    bpmn_folder_binding = binding_id(BPMN_RESOURCE_KEY, "folderPath")

    evidence_tasks = [
        task
        for task in stage_tasks(stages["Stage_Evcol2"])
        if task["displayName"] == "Flow - acquire and validate claim evidence"
    ]
    assert [(task["type"], task["displayName"]) for task in evidence_tasks] == [
        ("process", "Flow - acquire and validate claim evidence")
    ]
    evidence_process = evidence_tasks[0]
    assert evidence_process["data"]["name"] == f"=bindings.{flow_name_binding}"
    assert evidence_process["data"]["folderPath"] == (
        f"=bindings.{flow_folder_binding}"
    )
    assert evidence_process["data"]["name"] != "PI360CaseManagerFlow"
    assert evidence_process["data"]["folderPath"] != "solution_folder"
    assert [item["name"] for item in evidence_process["data"]["inputs"]] == [
        "caseInput",
        "claimInput",
        "memberInput",
        "providerInput",
        "serviceEventInput",
        "documentInput",
    ]
    assert [item["value"] for item in evidence_process["data"]["inputs"]] == [
        "=vars.caseInput",
        "=vars.claimInput",
        "=vars.memberInput",
        "=vars.providerInput",
        "=vars.serviceEventInput",
        "=vars.documentInput",
    ]
    assert [item["name"] for item in evidence_process["data"]["outputs"]] == [
        "caseId",
        "caseType",
        "claimCount",
        "lineCount",
        "totalUnits",
        "totalBilled",
        "claimThreshold",
        "thresholdExceeded",
        "recommendedStageId",
        "routeReason",
    ]

    provider_tasks = [
        task
        for task in stage_tasks(stages["Stage_Prreq6"])
        if task["displayName"] == "BPMN - request and await hospital record"
    ]
    assert [(task["type"], task["displayName"]) for task in provider_tasks] == [
        ("process", "BPMN - request and await hospital record")
    ]
    provider_process = provider_tasks[0]
    assert provider_process["data"]["name"] == f"=bindings.{bpmn_name_binding}"
    assert provider_process["data"]["folderPath"] == (
        f"=bindings.{bpmn_folder_binding}"
    )
    assert provider_process["data"]["name"] != "PI360AdHocReviewBpmn"
    assert provider_process["data"]["folderPath"] != "solution_folder"
    assert [item["name"] for item in provider_process["data"]["inputs"]] == [
        "CaseId",
        "CaseType",
        "ProviderId",
        "HospitalRecordAvailable",
        "InvestigatorProceed",
    ]
    assert [item["name"] for item in provider_process["data"]["outputs"]] == [
        "ProviderRequestStatus",
        "HospitalRecordAvailable",
        "NextStageId",
        "AuditMessage",
    ]
    provider_rules = [
        rule
        for condition in stages["Stage_Prreq6"]["data"].get("entryConditions", [])
        for rule_group in condition.get("rules", [])
        for rule in rule_group
    ]
    assert len(provider_rules) == 1
    assert provider_rules[0]["conditionExpression"] == (
        "=js:((vars.caseInput?.caseType ?? vars.caseInput?.case_type) "
        "=== 'StateMedicaidHospice') && "
        "(vars.recommendedStageId === 'Stage_Prreq6')"
    )
    assert provider_rules[0]["selectedStageId"] == "Stage_Evcol2"

    investigation_rules = [
        rule
        for condition in stages["Stage_Corr4a"]["data"].get("entryConditions", [])
        for rule_group in condition.get("rules", [])
        for rule in rule_group
    ]
    assert any(
        rule.get("selectedStageId") == "Stage_Evcol2"
        and rule.get("conditionExpression")
        == "=js:vars.recommendedStageId === 'Stage_Corr4a'"
        for rule in investigation_rules
    )
    assert any(
        rule.get("selectedStageId") == "Stage_Prreq6"
        and rule.get("conditionExpression")
        == "=js:vars.providerNextStageId === 'Stage_Corr4a'"
        for rule in investigation_rules
    )

    active_display_names = [
        task["displayName"]
        for stage in stage_nodes(caseplan)
        for task in stage_tasks(stage)
        if not is_deterministically_dormant(task)
    ]
    forbidden = ("ixp", "rpa", "send closure summary")
    assert not any(
        forbidden_name in display_name.lower()
        for display_name in active_display_names
        for forbidden_name in forbidden
    )


def test_caseplan_keeps_investigator_supervisor_and_closure_human_boundaries():
    caseplan = load_caseplan()
    stages = {stage["id"]: stage for stage in stage_nodes(caseplan)}

    investigation = stage_tasks(stages["Stage_Corr4a"])
    supervisor = stage_tasks(stages["Stage_Supv7a"])
    closure = stage_tasks(stages["Stage_Clos9a"])

    assert any(task["type"] == "action" for task in investigation)
    assert any(task["type"] == "action" for task in supervisor)
    assert any("Agentic Caseworker" in task["displayName"] for task in investigation)
    supervisor_human = [task for task in supervisor if task["type"] == "action"]
    assert [task["displayName"] for task in supervisor_human] == [
        "Human - supervisor review and disposition"
    ]
    assert supervisor_human[0]["entryConditions"][0]["rules"][0][0]["rule"] == (
        "current-stage-entered"
    )
    assert all(
        "send closure summary" not in task["displayName"].lower()
        for task in closure
        if not is_deterministically_dormant(task)
    )


def test_first_intake_task_registers_all_trigger_objects_before_triage():
    caseplan = load_caseplan()
    assert_first_intake_contract(caseplan)


def test_first_intake_contract_rejects_duplicate_or_nonsemantic_dependencies():
    duplicate_input = copy.deepcopy(load_caseplan())
    duplicate_intake = task_by_id(duplicate_input, "tINT1case")
    duplicate_intake["data"]["inputs"].append(
        copy.deepcopy(duplicate_intake["data"]["inputs"][3])
    )
    with pytest.raises(AssertionError):
        assert_first_intake_contract(duplicate_input)

    nonsemantic_dependency = copy.deepcopy(load_caseplan())
    triage = task_by_id(nonsemantic_dependency, "tTRI1agnt")
    triage["entryConditions"][0]["rules"][0][0]["rule"] = "current-stage-entered"
    with pytest.raises(AssertionError):
        assert_first_intake_contract(nonsemantic_dependency)

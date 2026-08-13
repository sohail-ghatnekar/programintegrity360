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
ENTRY_POINTS_PATH = CASEPLAN_PATH.parent / "entry-points.json"
FLOW_RESOURCE_KEY = "solution_folder.PI360CaseManagerFlow"
BPMN_RESOURCE_KEY = "solution_folder.PI360AdHocReviewBpmn"
REQUIRED_STAGE_IDS = {
    "Stage_Aintk1",
    "Stage_Evcol2",
    "Stage_Corr4a",
    "Stage_Prreq6",
    "Stage_Supv7a",
    "Stage_Clos9a",
}
REQUIRED_TASK_IDS = {
    "tCaseManagerAgent",
    "tINT1case",
    "tTRI1agnt",
    "tCLM2pull",
    "tmXrnnlxY",
    "tCOR4evid",
    "tREV5task",
    "tCMR4route",
    "tREQ6send",
    "tOsyyZpTf",
    "tSUP7gate",
    "tCLS9case",
    "tsxxZlma3",
}
OBSOLETE_PLACEHOLDER_TASK_IDS = {
    "tUeO6EGo3",
    "tQAC3rec",
    "tPRV6wait",
    "tH5yKJJef",
    "tPKT7prep",
    "thmyc7i2S",
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


def test_caseplan_stage_and_task_ids_preserve_current_orchestration():
    caseplan = load_caseplan()
    actual_stage_ids = {stage["id"] for stage in stage_nodes(caseplan)}
    actual_task_ids = all_task_ids(caseplan)

    assert REQUIRED_STAGE_IDS - actual_stage_ids == set()
    assert REQUIRED_TASK_IDS - actual_task_ids == set()
    assert OBSOLETE_PLACEHOLDER_TASK_IDS.isdisjoint(actual_task_ids)


def test_required_rpa_tasks_are_active_and_bound_to_the_current_journey():
    caseplan = load_caseplan()
    rpa_tasks = {
        task["id"]: task
        for stage in stage_nodes(caseplan)
        for task in stage_tasks(stage)
        if task["type"] == "rpa"
    }
    assert set(rpa_tasks) == {"tmXrnnlxY", "tOsyyZpTf", "tsxxZlma3"}
    assert all(task["isRequired"] is True for task in rpa_tasks.values())
    assert all(not is_deterministically_dormant(task) for task in rpa_tasks.values())
    assert rpa_tasks["tmXrnnlxY"]["displayName"] == "RPA - extract service timesheet"
    assert rpa_tasks["tOsyyZpTf"]["displayName"] == (
        "RPA - assemble supervisor decision packet"
    )
    assert rpa_tasks["tsxxZlma3"]["displayName"] == (
        "RPA - send closure summary email"
    )


def assert_first_intake_contract(caseplan):
    expected_names = (
        "workflowName",
        "caseType",
        "caseId",
        "requesterEmail",
        "caseInput",
        "claimInput",
        "memberInput",
        "providerInput",
        "serviceEventInput",
        "documentInput",
    )
    object_names = expected_names[4:]
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
    assert inputs["caseType"]["value"] == "=vars.caseType"
    assert inputs["requesterEmail"]["value"] == "=vars.caseworkerEmail"
    assert inputs["caseId"]["value"].startswith("=js:`PI-${vars.caseType")
    assert "StateMedicaidHospice" in inputs["caseId"]["value"]
    assert "HSP" in inputs["caseId"]["value"]
    assert "PCS" in inputs["caseId"]["value"]

    object_ids = []
    for name in object_names:
        item = inputs[name]
        assert item["type"] == "object"
        assert item["value"].startswith("=js:vars.caseType ===")
        assert "StateMedicaidHospice" in item["value"]
        assert "Medicaid" in item["value"] or name != "caseInput"
        assert item["id"] == item["var"]
        assert re.fullmatch(r"v[A-Za-z0-9]{8}", item["id"])
        assert item["elementId"] == intake["elementId"]
        object_ids.append(item["id"])
    assert len(set(object_ids)) == len(object_ids)

    assert intake["data"]["outputs"] == [
        {
            "name": "caseId",
            "type": "string",
            "id": "caseId",
            "var": "caseId",
            "value": "caseId",
            "source": "=caseId",
            "target": "=caseId",
            "elementId": "Stage_Aintk1-tINT1case",
        }
    ]

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


def test_caseplan_preserves_shared_six_stage_journey_with_two_scalar_inputs():
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

    inputs = caseplan["variables"]["inputs"]
    assert {item["name"] for item in inputs} == {"caseType", "caseworkerEmail"}
    assert all(item["type"] == "string" for item in inputs)
    assert all(item["required"] is True for item in inputs)

    trigger = next(node for node in caseplan["nodes"] if node["id"] == "trigger_1")
    assert [item["name"] for item in trigger["data"]["inputs"]["outputs"]] == [
        "caseType",
        "caseworkerEmail",
    ]


def test_case_entry_point_exposes_only_two_required_strings():
    entry_point = json.loads(ENTRY_POINTS_PATH.read_text())["entryPoints"][0]
    input_schema = entry_point["input"]

    assert set(input_schema["properties"]) == {"caseType", "caseworkerEmail"}
    assert input_schema["required"] == ["caseType", "caseworkerEmail"]
    assert all(
        property_schema["type"] == "string"
        for property_schema in input_schema["properties"].values()
    )


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
    assert all(
        item["value"].startswith("=js:vars.caseType ===")
        and "StateMedicaidHospice" in item["value"]
        for item in evidence_process["data"]["inputs"]
    )
    assert "vars.caseId" in evidence_process["data"]["inputs"][0]["value"]
    assert "vars.caseworkerEmail" in evidence_process["data"]["inputs"][0]["value"]
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
        "=js:vars.caseType === 'StateMedicaidHospice' && "
        "vars.recommendedStageId === 'Stage_Prreq6'"
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

    active_display_names = {
        task["displayName"]
        for stage in stage_nodes(caseplan)
        for task in stage_tasks(stage)
        if not is_deterministically_dormant(task)
    }
    assert {
        "RPA - extract service timesheet",
        "RPA - assemble supervisor decision packet",
        "RPA - send closure summary email",
    }.issubset(active_display_names)
    obsolete_names = (
        "ixp extraction timesheet @matt",
        "ixp extraction medical record @matt",
        "rpa - send outlook to someone",
    )
    assert not any(
        obsolete_name in display_name.lower()
        for display_name in active_display_names
        for obsolete_name in obsolete_names
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
    supervisor_rule = supervisor_human[0]["entryConditions"][0]["rules"][0][0]
    assert supervisor_rule["rule"] == "selected-tasks-completed"
    assert supervisor_rule["selectedTasksIds"] == ["tOsyyZpTf"]
    assert supervisor_human[0]["data"]["recipient"]["Value"] == (
        "=vars.caseworkerEmail"
    )

    investigator_human = [task for task in investigation if task["type"] == "action"]
    assert investigator_human[0]["data"]["recipient"]["Value"] == (
        "=vars.caseworkerEmail"
    )

    closure_email = next(task for task in closure if task["id"] == "tsxxZlma3")
    email_inputs = {item["name"]: item for item in closure_email["data"]["inputs"]}
    assert email_inputs["in_RecipientEmail"]["value"] == "=vars.caseworkerEmail"


def test_first_intake_task_hydrates_internal_objects_before_triage():
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

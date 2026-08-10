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
    / "content"
    / "caseplan.json"
)


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


def test_caseplan_contains_simplified_claim_ixp_rules_and_provider_wait_path():
    caseplan = load_caseplan()
    stages = {stage["id"]: stage for stage in stage_nodes(caseplan)}

    evidence_names = {
        task["displayName"] for task in stage_tasks(stages["Stage_Evcol2"])
    }
    assert evidence_names == {
        "API - retrieve CaseType claim details",
        "IXP - extract service evidence",
        "Rules - validate threshold and evidence indicators",
    }

    provider_tasks = stage_tasks(stages["Stage_Prreq6"])
    assert {task["displayName"] for task in provider_tasks} == {
        "API - request hospital record",
        "Timer - await hospital record (72 hours)",
        "API - intake hospital record",
        "IXP - extract institutional encounter",
    }
    timer = next(task for task in provider_tasks if task["type"] == "wait-for-timer")
    assert timer["data"]["timeDuration"] == "P3D"

    raw = CASEPLAN_PATH.read_text()
    assert "StateMedicaidHospice" in raw
    assert "MedicaidPCS" in raw
    assert "2500" in raw
    assert "Observation" in raw
    assert "360" in raw


def test_caseplan_keeps_investigator_supervisor_and_closure_human_boundaries():
    caseplan = load_caseplan()
    stages = {stage["id"]: stage for stage in stage_nodes(caseplan)}

    investigation = stage_tasks(stages["Stage_Corr4a"])
    supervisor = stage_tasks(stages["Stage_Supv7a"])
    closure = stage_tasks(stages["Stage_Clos9a"])

    assert any(task["type"] == "action" for task in investigation)
    assert any(task["type"] == "action" for task in supervisor)
    assert any("Agentic Caseworker" in task["displayName"] for task in investigation)
    assert any(
        "send closure summary and next steps" in task["displayName"]
        for task in closure
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

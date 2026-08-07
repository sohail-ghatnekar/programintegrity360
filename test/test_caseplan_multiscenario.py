import json
from pathlib import Path


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

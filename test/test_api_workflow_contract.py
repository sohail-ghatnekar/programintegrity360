import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
WORKFLOW_PATH = (
    ROOT / "ProgramIntegrity360" / "PI360ClaimDetailsApi" / "Workflow.json"
)
ENTRY_POINTS_PATH = (
    ROOT / "ProgramIntegrity360" / "PI360ClaimDetailsApi" / "entry-points.json"
)


def load_json(path: Path):
    return json.loads(path.read_text())


def walk(value):
    if isinstance(value, dict):
        yield value
        for child in value.values():
            yield from walk(child)
    elif isinstance(value, list):
        for child in value:
            yield from walk(child)


def test_claim_workflow_declares_case_type_and_normalized_claim_output():
    workflow = load_json(WORKFLOW_PATH)
    inputs = workflow["input"]["schema"]["document"]["properties"]
    outputs = workflow["output"]["schema"]["document"]["properties"]

    assert inputs["caseType"]["default"] == "MedicaidPCS"
    assert outputs["payload"]["type"] == "object"
    assert outputs["claimCount"]["type"] == "number"
    assert outputs["totalBilled"]["type"] == "number"


def test_claim_workflow_uses_stubbed_http_activity_for_both_beeceptor_routes():
    workflow = load_json(WORKFLOW_PATH)
    activities = list(walk(workflow["do"]))
    http_activities = [item for item in activities if item.get("call") == "UiPath.Http"]

    assert len(http_activities) == 1
    activity = http_activities[0]
    assert activity["with"]["connectionId"] == "ImplicitConnection"
    assert activity["metadata"]["uiPathActivityTypeId"] == (
        "5c4cc855-b42a-37e6-b910-de8588998fce"
    )
    url_expression = activity["with"]["bodyParameters"]["url"]
    assert "/MedicaidPCS" in url_expression
    assert "/StateMedicaidHospice" in url_expression
    assert "http_request_1" in activity["export"]["as"]


def test_api_entry_point_exposes_case_type_and_claim_totals():
    entry_point = load_json(ENTRY_POINTS_PATH)["entryPoints"][0]
    assert "caseType" in entry_point["input"]["properties"]
    assert "claimCount" in entry_point["output"]["properties"]
    assert "totalBilled" in entry_point["output"]["properties"]

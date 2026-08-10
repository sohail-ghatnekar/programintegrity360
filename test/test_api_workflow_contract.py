import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
WORKFLOW_PATH = (
    ROOT / "ProgramIntegrity360" / "PI360ClaimDetailsApi" / "Workflow.json"
)
ENTRY_POINTS_PATH = (
    ROOT / "ProgramIntegrity360" / "PI360ClaimDetailsApi" / "entry-points.json"
)
LIFECYCLE_WORKFLOW_PATH = (
    ROOT / "ProgramIntegrity360" / "PI360ApiWorkflows" / "Main.json"
)
LIFECYCLE_ENTRY_POINTS_PATH = (
    ROOT / "ProgramIntegrity360" / "PI360ApiWorkflows" / "entry-points.json"
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


def test_case_lifecycle_api_supports_every_simplified_case_stage_contract():
    raw = LIFECYCLE_WORKFLOW_PATH.read_text()
    for workflow_name in (
        "IntakeClaimByCaseType",
        "GetClaimDetailsByCaseType",
        "ExtractServiceEvidence",
        "ValidateEvidenceByCaseType",
        "RequestHospitalRecord",
        "IntakeHospitalRecord",
        "ExtractInstitutionalEncounter",
        "PrepareSupervisorPacket",
        "CloseCaseAndEmitMetrics",
        "SendClosureSummaryEmail",
    ):
        assert workflow_name in raw

    assert "PI360 Service Evidence Extractor" in raw
    assert "PI360 Institutional Encounter Extractor" in raw
    assert "Observation" in raw
    assert "locationConflictMinutes: 360" in raw
    assert "responseTimer: 'P3D'" in raw


def test_intake_registration_accepts_six_trigger_objects():
    workflow = load_json(LIFECYCLE_WORKFLOW_PATH)
    properties = workflow["input"]["schema"]["document"]["properties"]
    entry = load_json(LIFECYCLE_ENTRY_POINTS_PATH)["entryPoints"][0]
    entry_properties = entry["input"]["properties"]

    for name in (
        "caseInput",
        "claimInput",
        "memberInput",
        "providerInput",
        "serviceEventInput",
        "documentInput",
    ):
        assert properties[name]["type"] == "object"
        assert entry_properties[name]["type"] == "object"


def test_intake_registration_is_a_real_idempotent_data_fabric_upsert():
    workflow = load_json(LIFECYCLE_WORKFLOW_PATH)
    activities = list(walk(workflow["do"]))
    connector_activities = [
        item for item in activities if item.get("call") == "UiPath.IntSvc"
    ]
    by_activity_type = {
        item["metadata"]["uiPathActivityTypeId"]: item
        for item in connector_activities
    }
    expected_activity_types = {
        "703065b9-a310-33b8-9d4d-12df0a6f520b",
        "dfd2bc7a-ca4b-3316-8a1f-57c9e106dfbf",
        "718fdc36-73a8-3607-8604-ddef95bb9967",
    }

    assert set(by_activity_type) == expected_activity_types
    for activity in connector_activities:
        assert activity["with"]["connectionId"] == (
            "a0bd364e-c6cc-4749-9f92-f6a46e59fe4d"
        )
        assert activity["with"]["connectionResourceId"] == (
            "a0bd364e-c6cc-4749-9f92-f6a46e59fe4d"
        )
        assert activity["with"]["pathParameters"]["entityName"] == (
            "PI360ProgramIntegrityCase"
        )

    query = by_activity_type["703065b9-a310-33b8-9d4d-12df0a6f520b"]
    create = by_activity_type["dfd2bc7a-ca4b-3316-8a1f-57c9e106dfbf"]
    update = by_activity_type["718fdc36-73a8-3607-8604-ddef95bb9967"]
    assert "'case_id'" in query["with"]["queryParameters"]["queryExpression"]
    assert update["with"]["queryParameters"]["recordId"] == (
        "${$context.outputs.InspectExistingCase.recordId}"
    )
    for field in (
        "case_id",
        "case_type",
        "title",
        "program",
        "status",
        "stage",
        "requester_email",
        "maestro_instance_id",
        "created_at",
        "updated_at",
    ):
        assert field in create["with"]["bodyParameters"]
        assert field in update["with"]["bodyParameters"]
    for activity in (create, update):
        assert activity["with"]["bodyParameters"]["priority"] == 0
        assert activity["with"]["bodyParameters"]["stage"] == 0
        assert activity["with"]["bodyParameters"]["status"] == 0

    raw = json.dumps(workflow)
    assert "requester_email" in raw
    assert "maestro_instance_id" in raw
    assert "registrationMode" in raw
    assert "Demo contract only; no external write is performed." not in raw
    assert "recordsAffected" in raw

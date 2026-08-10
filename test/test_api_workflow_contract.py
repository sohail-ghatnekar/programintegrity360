import json
import subprocess
from datetime import datetime, timezone
from pathlib import Path

import pytest


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
LIFECYCLE_BINDINGS_PATH = (
    ROOT / "ProgramIntegrity360" / "PI360ApiWorkflows" / "bindings_v2.json"
)
SOLUTION_CONNECTION_ROOT = (
    ROOT / "ProgramIntegrity360" / "resources" / "solution_folder" / "connection"
)
SOLUTION_USER_PROFILE_ROOT = ROOT / "ProgramIntegrity360" / "userProfile"


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


def lifecycle_activity(name: str):
    workflow = load_json(LIFECYCLE_WORKFLOW_PATH)
    for item in walk(workflow["do"]):
        if name in item and isinstance(item[name], dict):
            return item[name]
    raise AssertionError(f"Activity {name!r} was not found")


def activity_keys(items):
    return [next(iter(item)) for item in items]


def run_lifecycle_script(name: str, *, workflow_input=None, context=None):
    code = lifecycle_activity(name)["run"]["script"]["code"]
    payload = json.dumps(
        {
            "workflowInput": workflow_input or {},
            "context": context or {},
        }
    )
    harness = f"""
const harnessPayload = JSON.parse(process.argv[1]);
globalThis.$workflow = {{ input: harnessPayload.workflowInput }};
globalThis.$context = harnessPayload.context;
globalThis.$input = {{}};
try {{
  const result = (() => {{
{code}
  }})();
  process.stdout.write(JSON.stringify({{ ok: true, result }}));
}} catch (error) {{
  process.stdout.write(JSON.stringify({{ ok: false, error: String(error.message || error) }}));
}}
"""
    completed = subprocess.run(
        ["node", "-e", harness, payload],
        check=True,
        capture_output=True,
        text=True,
    )
    return json.loads(completed.stdout)


def valid_intake_input(**case_overrides):
    year = datetime.now(timezone.utc).year
    case_input = {
        "caseType": "MedicaidPCS",
        "caseId": f"PI-PCS-{year}-ABC123",
        "requesterEmail": "investigator@example.gov",
        **case_overrides,
    }
    return {
        "workflowName": "IntakeClaimByCaseType",
        "caseInput": case_input,
        "claimInput": {},
        "memberInput": {},
        "providerInput": {},
        "serviceEventInput": {},
        "documentInput": {},
    }


def inspect_context(content):
    return {
        "outputs": {
            "PrepareLifecycleRequest": {
                "caseId": valid_intake_input()["caseInput"]["caseId"],
                "record": {
                    "created_at": "2026-08-09T12:00:00Z",
                    "opened_at": "2026-08-09T12:00:00Z",
                },
            },
            "QueryEntityRecordsCurated_1": {"content": content},
        }
    }


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

    assert len(connector_activities) == 3
    assert set(by_activity_type) == expected_activity_types
    for activity_type in expected_activity_types:
        assert sum(
            item["metadata"]["uiPathActivityTypeId"] == activity_type
            for item in connector_activities
        ) == 1
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


@pytest.mark.parametrize(
    "case_id",
    (
        "arbitrary-case-id",
        "PI-PCS-2026-abc123",
        "PI-PCS-2026-ABC12",
        "PI-PCS-1999-ABC123",
        "PI-HSP-2026-ABC123",
    ),
)
def test_intake_validation_rejects_case_ids_before_the_first_connector(case_id):
    result = run_lifecycle_script(
        "PrepareLifecycleRequest",
        workflow_input=valid_intake_input(caseId=case_id),
    )

    assert result["ok"] is False
    assert "case ID" in result["error"]


@pytest.mark.parametrize(
    "email",
    (
        "person@@example.gov",
        "person @example.gov",
        "person@example.gov\nsecond@example.gov",
        "person@example.gov,second@example.gov",
        "person@example.gov;second@example.gov",
    ),
)
def test_intake_validation_rejects_non_single_emails_before_the_first_connector(email):
    result = run_lifecycle_script(
        "PrepareLifecycleRequest",
        workflow_input=valid_intake_input(requesterEmail=email),
    )

    assert result["ok"] is False
    assert "requesterEmail" in result["error"]


def test_intake_validation_precedes_query_and_inspection_follows_query():
    main_do = load_json(LIFECYCLE_WORKFLOW_PATH)["do"][0]["Main"]["do"]
    assert activity_keys(main_do)[:3] == [
        "WorkflowStart",
        "PrepareLifecycleRequest",
        "If_Intake#Wrapper",
    ]
    intake_then = lifecycle_activity("If_Intake#Then")["do"]
    assert activity_keys(intake_then) == [
        "QueryEntityRecordsCurated_1",
        "InspectExistingCase",
        "If_Existing#Wrapper",
    ]


@pytest.mark.parametrize(
    "content",
    (
        [],
        "[]",
        {"value": []},
        {"items": []},
        {"Items": []},
        {"results": []},
        {"data": []},
        '{"value": []}',
    ),
)
def test_query_inspection_recognizes_explicit_empty_list_shapes(content):
    result = run_lifecycle_script(
        "InspectExistingCase",
        context=inspect_context(content),
    )

    assert result == {
        "ok": True,
        "result": {
            "exists": False,
            "recordId": None,
            "createdAt": "2026-08-09T12:00:00Z",
            "openedAt": "2026-08-09T12:00:00Z",
        },
    }


@pytest.mark.parametrize(
    "content",
    (
        None,
        {},
        {"unexpected": []},
        '{"unexpected": []}',
        "not-json",
        {"value": "not-a-list"},
    ),
)
def test_query_inspection_fails_closed_on_unrecognized_or_malformed_payloads(content):
    result = run_lifecycle_script(
        "InspectExistingCase",
        context=inspect_context(content),
    )

    assert result["ok"] is False
    assert "query response" in result["error"]


def test_query_inspection_routes_zero_one_and_duplicate_rows_safely():
    empty = run_lifecycle_script(
        "InspectExistingCase",
        context=inspect_context([]),
    )
    one = run_lifecycle_script(
        "InspectExistingCase",
        context=inspect_context([{"Id": "record-1"}]),
    )
    duplicate = run_lifecycle_script(
        "InspectExistingCase",
        context=inspect_context([{"Id": "record-1"}, {"Id": "record-2"}]),
    )

    assert empty["result"]["exists"] is False
    assert one["result"]["exists"] is True
    assert one["result"]["recordId"] == "record-1"
    assert duplicate["ok"] is False
    assert "returned 2" in duplicate["error"]


def test_query_inspection_faults_when_the_existing_row_has_no_record_id():
    result = run_lifecycle_script(
        "InspectExistingCase",
        context=inspect_context([{"case_id": "PI-PCS-2026-ABC123"}]),
    )

    assert result["ok"] is False
    assert "no record ID" in result["error"]


def test_create_and_update_are_exclusive_and_return_the_matching_mode():
    update_keys = activity_keys(lifecycle_activity("If_Existing#Then")["do"])
    create_keys = activity_keys(lifecycle_activity("If_Existing#Else")["do"])
    assert update_keys == ["UpdateEntityRecordV2_1", "ReturnUpdatedRegistration"]
    assert create_keys == ["CreateEntityRecordCurated_1", "ReturnCreatedRegistration"]

    prepared = run_lifecycle_script(
        "PrepareLifecycleRequest",
        workflow_input=valid_intake_input(),
    )["result"]
    context = {"outputs": {"PrepareLifecycleRequest": prepared}}
    created = run_lifecycle_script("ReturnCreatedRegistration", context=context)
    updated = run_lifecycle_script("ReturnUpdatedRegistration", context=context)
    assert created["result"]["registrationMode"] == "Created"
    assert updated["result"]["registrationMode"] == "Updated"
    assert created["result"]["persistedCaseId"] == prepared["caseId"]
    assert updated["result"]["persistedCaseId"] == prepared["caseId"]


def test_api_workflow_binds_the_folder_scoped_data_fabric_connection():
    bindings = load_json(LIFECYCLE_BINDINGS_PATH)["resources"]
    assert bindings == [
        {
            "resource": "Connection",
            "key": "a0bd364e-c6cc-4749-9f92-f6a46e59fe4d",
            "id": "Connectiona0bd364e-c6cc-4749-9f92-f6a46e59fe4d",
            "value": {
                "ConnectionId": {
                    "defaultValue": "a0bd364e-c6cc-4749-9f92-f6a46e59fe4d",
                    "isExpression": False,
                    "displayName": "Program Integrity Fabric",
                }
            },
            "metadata": {
                "ActivityName": "PI360 Program Integrity Case Upsert",
                "BindingsVersion": "2.2",
                "DisplayLabel": "Program Integrity Fabric",
                "UseConnectionService": "true",
                "Connector": "uipath-uipath-dataservice",
            },
        }
    ]


def test_solution_catalog_contains_the_program_integrity_fabric_connection():
    resources = [
        load_json(path)["resource"]
        for path in SOLUTION_CONNECTION_ROOT.rglob("*.json")
    ]
    matches = [
        resource
        for resource in resources
        if resource.get("key") == "a0bd364e-c6cc-4749-9f92-f6a46e59fe4d"
    ]
    assert len(matches) == 1
    assert matches[0]["name"] == "Program Integrity Fabric"
    assert matches[0]["kind"] == "connection"
    assert matches[0]["type"] == "uipath-uipath-dataservice"


def test_solution_catalog_records_the_exact_connection_folder_overwrite():
    overwrites = []
    for path in SOLUTION_USER_PROFILE_ROOT.rglob("debug_overwrites.json"):
        payload = load_json(path)
        for tenant in payload.get("tenants", []):
            overwrites.extend(tenant.get("resources", []))

    matches = [
        item["overwrite"]
        for item in overwrites
        if item.get("solutionResourceKey")
        == "a0bd364e-c6cc-4749-9f92-f6a46e59fe4d"
    ]
    assert len(matches) == 1
    assert matches[0]["resourceName"] == "Program Integrity Fabric"
    assert matches[0]["kind"] == "connection"
    assert matches[0]["folderFullyQualifiedName"] == (
        "AMER Presales/Public Sector/ProgramIntegrity360"
    )
    assert matches[0]["folderKey"] == "5db31dd1-1073-4f9e-b44b-76f5484e03c4"

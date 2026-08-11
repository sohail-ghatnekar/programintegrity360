import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
FLOW_PATH = (
    ROOT
    / "ProgramIntegrity360"
    / "PI360CaseManagerFlow"
    / "PI360CaseManagerFlow.flow"
)


def load_flow():
    return json.loads(FLOW_PATH.read_text())


def test_flow_resource_definition_bindings_are_packager_resolvable():
    flow = load_flow()
    expected = {
        "uipath.core.api-workflow.6d04d330-e36f-4da8-a0ae-b74fef97f1b4": {
            "name": "PI360ClaimDetailsApi",
            "folderPath": "",
        },
        "uipath.core.agent.fabc409c-d468-4964-92e0-2171e0ced3ba": {
            "name": "PI360QuickRulesCodedAgent",
            "folderPath": "",
        },
    }
    definitions = [
        definition
        for definition in flow["definitions"]
        if definition.get("nodeType") in expected
    ]

    assert len(definitions) == 2
    assert {definition["nodeType"] for definition in definitions} == set(expected)
    for definition in definitions:
        assert definition["model"]["bindings"]["values"] == expected[
            definition["nodeType"]
        ]


def test_flow_exposes_six_separate_manual_trigger_objects():
    flow = load_flow()
    inputs = {
        item["id"]: item
        for item in flow["variables"].get("globals", [])
        if item.get("direction") == "in"
    }
    assert set(inputs) == {
        "caseInput",
        "claimInput",
        "memberInput",
        "providerInput",
        "serviceEventInput",
        "documentInput",
    }
    assert all(item["type"] == "object" for item in inputs.values())
    assert all(item["triggerNodeId"] == "start" for item in inputs.values())


def test_flow_uses_case_type_claim_api_deterministic_rules_and_caseworker():
    flow = load_flow()
    nodes = {node["id"]: node for node in flow["nodes"]}
    node_types = {node["type"] for node in flow["nodes"]}

    assert nodes["claimDetailsByCaseType"]["type"].startswith(
        "uipath.core.api-workflow."
    )
    assert nodes["quickRulesByCaseType"]["type"].startswith("uipath.core.agent.")
    assert nodes["agentSelectNextCaseStage1"]["type"].startswith(
        "uipath.core.agent."
    )
    assert "core.logic.mock" not in node_types
    assert not any("rpa" in node_type.lower() for node_type in node_types)
    assert "extractServiceEvidenceIxp" not in nodes
    assert "extractInstitutionalEncounterIxp" not in nodes
    assert "evidenceSnapshotRpa" not in nodes

    active_serialized_flow = json.dumps(
        {
            key: flow[key]
            for key in ("nodes", "edges", "variables", "bindings")
            if key in flow
        }
    ).lower()
    for forbidden_reference in (
        "ixp",
        "pi360 service evidence extractor",
        "pi360 institutional encounter extractor",
        "extract service evidence",
        "extract institutional encounter",
        "extractserviceevidenceixp",
        "extractinstitutionalencounterixp",
        "hasinstitutionalrecordforixp",
        "rpaevidencecompletenesssnapshot1",
        "evidencesnapshotrpa",
        "pi360evidencesnapshotautomation",
    ):
        assert forbidden_reference not in active_serialized_flow

    outputs = {
        item["id"]
        for item in flow["variables"].get("globals", [])
        if item.get("direction") == "out"
    }
    assert outputs == {
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
    }

    raw = FLOW_PATH.read_text()
    assert "MedicaidPCS" in raw
    assert "StateMedicaidHospice" in raw
    assert "2500" in raw
    assert "360" in raw
    assert "Observation" in raw


def test_flow_has_explicit_hospice_provider_route_and_no_risk_only_default():
    flow = load_flow()
    nodes = {node["id"]: node for node in flow["nodes"]}

    normalize_script = nodes["normalizeCase"]["inputs"]["script"]
    assert "StateMedicaidHospice" in normalize_script
    assert "MedicaidPCS" in normalize_script
    assert "providerResponseNeeded" in normalize_script
    assert "riskScore >=" not in normalize_script

    provider_expression = nodes["needsProviderResponse"]["inputs"]["expression"]
    assert "Stage_Prreq6" in provider_expression
    assert "riskScore" not in provider_expression


def test_provider_route_reason_distinguishes_deterministic_hospice_from_agent_selection():
    flow = load_flow()
    nodes = {node["id"]: node for node in flow["nodes"]}

    provider_expression = nodes["needsProviderResponse"]["inputs"]["expression"]
    provider_script = nodes["routeProviderResponse"]["inputs"]["script"]

    assert "StateMedicaidHospice" in provider_expression
    assert "Stage_Prreq6" in provider_expression
    assert "const deterministicHospiceProviderRequest =" in provider_script
    assert "deterministicHospiceProviderRequest ?" in provider_script
    assert ": String(route.routeReason" in provider_script
    assert "hospital record is not yet available" in provider_script

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

    assert nodes["claimDetailsByCaseType"]["type"].startswith(
        "uipath.core.api-workflow."
    )
    assert nodes["quickRulesByCaseType"]["type"].startswith("uipath.core.agent.")
    assert nodes["agentSelectNextCaseStage1"]["type"].startswith(
        "uipath.core.agent."
    )
    assert nodes["extractServiceEvidenceIxp"]["type"] == "core.logic.mock"
    assert nodes["extractInstitutionalEncounterIxp"]["type"] == "core.logic.mock"
    assert "IXP runtime registration pending" in nodes[
        "extractServiceEvidenceIxp"
    ]["display"]["label"]

    raw = FLOW_PATH.read_text()
    assert "MedicaidPCS" in raw
    assert "StateMedicaidHospice" in raw
    assert "2500" in raw
    assert "360" in raw
    assert "Observation" in raw
    assert "PI360 Service Evidence Extractor" in raw
    assert "PI360 Institutional Encounter Extractor" in raw


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

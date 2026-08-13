import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
FLOW_PATH = (
    ROOT
    / "PI360AdditiveOrchestration"
    / "PI360EvidenceRoutingFlow"
    / "PI360EvidenceRoutingFlow.flow"
)


def load_flow():
    return json.loads(FLOW_PATH.read_text())


def test_additive_flow_has_exact_manual_contract():
    flow = load_flow()
    inputs = {
        item["id"]
        for item in flow["variables"]["globals"]
        if item.get("direction") == "in"
    }
    outputs = {
        item["id"]
        for item in flow["variables"]["globals"]
        if item.get("direction") == "out"
    }
    assert inputs == {
        "caseInput", "claimInput", "memberInput", "providerInput",
        "serviceEventInput", "documentInput",
    }
    assert outputs == {
        "caseId", "caseType", "claimCount", "lineCount", "totalUnits",
        "totalBilled", "claimThreshold", "thresholdExceeded",
        "recommendedStageId", "routeReason",
    }


def test_additive_flow_uses_exact_get_routes_and_deterministic_threshold():
    flow = load_flow()
    raw = FLOW_PATH.read_text()
    http_nodes = [node for node in flow["nodes"] if node["type"] == "core.action.http.v2"]
    assert len(http_nodes) == 1
    assert "https://medicaid-claim-demo.free.beeceptor.com/MedicaidPCS" in raw
    assert "https://medicaid-claim-demo.free.beeceptor.com/StateMedicaidHospice" in raw
    assert '"method":"GET"' in raw.replace(" ", "")
    assert "2500" in raw
    assert "Stage_Prreq6" in raw
    assert "Stage_Corr4a" in raw


def test_additive_flow_has_no_forbidden_runtime_nodes():
    raw = FLOW_PATH.read_text().lower()
    node_types = {node["type"].lower() for node in load_flow()["nodes"]}
    assert not any("ixp" in node_type for node_type in node_types)
    assert not any("rpa" in node_type for node_type in node_types)
    assert not any("agent" in node_type for node_type in node_types)
    for forbidden in ("sendclosuresummaryemail", "extractserviceevidence", "extractinstitutionalencounter"):
        assert forbidden not in raw

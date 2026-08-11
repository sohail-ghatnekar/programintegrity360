import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOLUTION = ROOT / "PI360AdditiveOrchestration"


def test_additive_solution_contains_exactly_two_non_case_projects():
    manifest = json.loads(
        (SOLUTION / "PI360AdditiveOrchestration.uipx").read_text()
    )
    projects = manifest["Projects"]
    names = {
        Path(project["ProjectRelativePath"]).parent.name for project in projects
    }
    ids = [project["Id"] for project in projects]

    assert names == {
        "PI360EvidenceRoutingFlow",
        "PI360HospiceProviderRecordBpmn",
    }
    assert len(projects) == 2
    assert len(ids) == len(set(ids)) == 2
    assert all(re.fullmatch(r"[0-9a-f-]{36}", project_id) for project_id in ids)
    assert not any(re.fullmatch(r".+_\d+", name) for name in names)
    assert not any("case" in name.lower() for name in names)


def test_additive_solution_handoff_names_both_processes_and_no_case_edit():
    handoff = (SOLUTION / "README.md").read_text()

    assert "PI360EvidenceRoutingFlow" in handoff
    assert "PI360HospiceProviderRecordBpmn" in handoff
    assert "Stage_Evcol2" in handoff
    assert "Stage_Prreq6" in handoff
    assert "Stage_Corr4a" in handoff
    assert "PI360ProviderRecordReceived" in handoff
    assert "Reference = CaseId" in handoff
    assert "No Case Plan files are included" in handoff

    for name in (
        "caseInput",
        "claimInput",
        "memberInput",
        "providerInput",
        "serviceEventInput",
        "documentInput",
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
        "CaseId",
        "CaseType",
        "ProviderId",
        "HospitalRecordAvailable",
        "InvestigatorProceed",
        "ProviderRequestStatus",
        "NextStageId",
        "AuditMessage",
    ):
        assert name in handoff

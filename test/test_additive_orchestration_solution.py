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

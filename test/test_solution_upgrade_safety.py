import json
import re
from pathlib import Path


SOLUTION_ROOT = Path(__file__).parents[1] / "ProgramIntegrity360"
RESOURCE_ROOT = SOLUTION_ROOT / "resources" / "solution_folder"


def _deployment_resources() -> list[dict]:
    resources = []
    for path in RESOURCE_ROOT.rglob("*.json"):
        payload = json.loads(path.read_text())
        resource = payload.get("resource", {})
        if resource.get("kind") in {"app", "process"}:
            resources.append(resource)
    return resources


def test_solution_has_no_shadow_copies_of_owned_deployment_resources():
    resources = _deployment_resources()
    identities = {
        (resource["kind"], resource.get("type"), resource["name"])
        for resource in resources
    }

    shadow_copies = []
    for resource in resources:
        match = re.fullmatch(r"(.+)_\d+", resource["name"])
        if not match:
            continue
        base_identity = (resource["kind"], resource.get("type"), match.group(1))
        if base_identity in identities:
            shadow_copies.append(resource["name"])

    assert shadow_copies == [], (
        "Solution upgrades cannot bundle suffixed reference copies of resources "
        f"already owned by the deployment: {sorted(shadow_copies)}"
    )


def test_concrete_runtime_dependency_keys_resolve_locally():
    resources = _deployment_resources()
    local_keys = {resource["key"] for resource in resources}
    unresolved = []

    for resource in resources:
        for dependency in resource.get("runtimeDependencies", []):
            dependency_key = dependency.get("resourceKey")
            if dependency_key and dependency_key not in local_keys:
                unresolved.append((resource["name"], dependency_key))

    assert unresolved == [], (
        "Concrete runtime dependency keys must resolve to resources in the "
        f"upgrade package: {unresolved}"
    )


def test_caseworker_app_binding_is_solution_relative_and_unique():
    project_root = SOLUTION_ROOT / "PI360CaseManagerAgent"
    bindings = json.loads((project_root / "bindings_v2.json").read_text())
    app_bindings = [
        binding
        for binding in bindings["resources"]
        if binding["resource"] == "app"
        and binding["key"] == "pi360-escalation-action-app"
    ]
    action = json.loads(
        (
            project_root
            / "resources"
            / "SupervisorEscalation"
            / "resource.json"
        ).read_text()
    )

    assert len(app_bindings) == 1
    folder_path = app_bindings[0]["value"].get("folderPath", {}).get(
        "defaultValue"
    )
    assert folder_path in {None, "solution_folder"}
    assert action["channels"][0]["properties"]["folderName"] == "solution_folder"

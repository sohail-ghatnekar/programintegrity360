import json
import re
from pathlib import Path


SOLUTION_ROOT = Path(__file__).parents[1] / "ProgramIntegrity360"
RESOURCE_ROOT = SOLUTION_ROOT / "resources" / "solution_folder"
USER_PROFILE_ROOT = SOLUTION_ROOT / "userProfile"
CASE_MANAGER_RESOURCE_KEY = "64ee0873-ac2c-4393-a970-7f67f9c7a423"
ESCALATION_APP_RESOURCE_KEY = "54f913fa-10c8-4eec-85ef-58f05e15b6d5"


def _all_solution_resources() -> list[dict]:
    resources = []
    for path in RESOURCE_ROOT.rglob("*.json"):
        payload = json.loads(path.read_text())
        resource = payload.get("resource", {})
        if resource.get("key"):
            resources.append(resource)
    return resources


def _deployment_resources() -> list[dict]:
    return [
        resource
        for resource in _all_solution_resources()
        if resource.get("kind") in {"app", "process"}
    ]


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
    local_keys = {resource["key"] for resource in _all_solution_resources()}
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


def test_debug_overwrites_reference_local_solution_resources():
    local_keys = {
        json.loads(path.read_text())["resource"]["key"]
        for path in RESOURCE_ROOT.rglob("*.json")
    }
    stale_overwrites = []

    for path in USER_PROFILE_ROOT.rglob("debug_overwrites.json"):
        payload = json.loads(path.read_text())
        for tenant in payload.get("tenants", []):
            for item in tenant.get("resources", []):
                key = item.get("solutionResourceKey")
                if key not in local_keys:
                    stale_overwrites.append((str(path.relative_to(SOLUTION_ROOT)), key))

    assert stale_overwrites == [], (
        "Debug overwrites must not keep references to shadow resources that "
        f"are absent from the solution package: {stale_overwrites}"
    )


def test_caseworker_app_binding_is_solution_relative_and_unique():
    project_root = SOLUTION_ROOT / "PI360CaseManagerAgent"
    bindings = json.loads((project_root / "bindings_v2.json").read_text())
    app_bindings = [
        binding
        for binding in bindings["resources"]
        if binding["resource"] == "app"
        and binding["key"] == ESCALATION_APP_RESOURCE_KEY
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


def test_owned_sibling_bindings_are_pinned_to_solution_resource_keys():
    expected = {
        SOLUTION_ROOT / "PI360CaseManagement" / "bindings_v2.json": {
            ("process", CASE_MANAGER_RESOURCE_KEY),
            ("app", ESCALATION_APP_RESOURCE_KEY),
        },
        SOLUTION_ROOT / "PI360CaseManagerAgent" / "bindings_v2.json": {
            ("app", ESCALATION_APP_RESOURCE_KEY),
        },
    }

    for path, expected_bindings in expected.items():
        payload = json.loads(path.read_text())
        actual = {
            (binding["resource"], binding["key"])
            for binding in payload["resources"]
        }
        assert actual == expected_bindings
        for binding in payload["resources"]:
            assert "name" not in binding.get("value", {}), (
                "Owned sibling bindings must resolve directly by the solution "
                "resource key. A name value makes resource refresh import the "
                "live deployment as a suffixed shadow resource."
            )

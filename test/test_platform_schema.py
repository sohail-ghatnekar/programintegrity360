import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CHOICE_SCRIPT = ROOT / "platform" / "01_choicesets.js"
ENTITY_SCRIPT = ROOT / "platform" / "02_entities.js"
SEED_SCRIPT = ROOT / "platform" / "03_seed.js"
MIGRATION_RECORD = ROOT / "platform" / "cloud-playground-migration.json"


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def test_choice_sets_extend_only_the_existing_document_type_set_at_tenant_cap():
    source = read(CHOICE_SCRIPT)

    for required in (
        "Hospital Record",
        "Policy Reference",
        "Hospice Service Record",
    ):
        assert required in source

    assert "PI360CaseType" not in source
    assert "PI360InstitutionalPatientClass" not in source


def test_entities_use_cap_safe_fields_on_the_nine_existing_pi360_entities():
    source = read(ENTITY_SCRIPT)

    for required in (
        "case_type",
        "member_name",
        "member_date_of_birth",
        "member_medicaid_id",
        "claim_total_billed",
        "claim_threshold",
        "claim_lines_json",
        "flagged_line_id",
        "place_of_service_code",
        "claimed_service_start_at",
        "ixp_model",
        "ixp_model_version",
        "reference_only",
        "patient_class",
        "encounter_arrival_at",
        "encounter_discharge_at",
        "requester_email",
        "maestro_instance_id",
    ):
        assert required in source

    assert "PI360ClaimLine" not in source
    assert "PI360Member" not in source
    assert "PI360InstitutionalEncounter" not in source
    assert "entities','update" in source
    assert "addFields" in source


def test_seed_consolidates_hospice_source_data_into_existing_entities():
    source = read(SEED_SCRIPT)

    for required in (
        "hospice_claims.json",
        "hospice_members.json",
        "institutional_encounters.json",
        "claim_lines_json",
        "member_name",
        "patient_class",
        "records','query",
        "records','update",
        "records','insert",
    ):
        assert required in source

    assert "naturalKey" in source
    assert "selectedFields: ['Id', naturalKey]" in source
    assert "PI360ClaimLine" not in source
    assert "PI360Member" not in source
    assert "PI360InstitutionalEncounter" not in source


def test_migration_record_matches_the_package_only_coded_app_upgrade():
    coded_app = json.loads(read(MIGRATION_RECORD))["codedWebApp"]

    assert coded_app["version"] == "0.5.6"
    assert coded_app["systemName"] == "ID278b47bdb4d24033ab498eb94bec6e8b"
    assert coded_app["packageSha256"] == (
        "b0f6f050c92336b41ff231e59acd0f47a989d659e682695d4140442637b13958"
    )
    assert coded_app["appUrl"] == "https://uipathlabs.uipath.host/pi360-coded-app"
    assert coded_app["deploymentId"] == "12eb1198-bd15-49e8-a009-d17410ad0477"
    assert coded_app["deploymentRevision"] == 7
    assert coded_app["deployedAt"] == "2026-08-10T17:27:54.940Z"
    assert coded_app["deploymentNote"] == (
        "Package-only upgrade from 0.5.5 to 0.5.6; no Studio Web source push "
        "was performed."
    )

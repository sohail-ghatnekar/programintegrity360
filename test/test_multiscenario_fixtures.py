import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"


def load_fixture(name: str):
    path = DATA / name
    assert path.exists(), f"missing canonical fixture: {path}"
    return json.loads(path.read_text(encoding="utf-8"))


def test_case_type_profiles_define_hospice_threshold_and_provider_timer():
    profiles = load_fixture("case_type_profiles.json")

    assert set(profiles) == {"MedicaidPCS", "StateMedicaidHospice"}
    assert profiles["StateMedicaidHospice"]["claim_threshold"] == 2500
    assert profiles["StateMedicaidHospice"]["provider_response_hours"] == 72


def test_hospice_case_identifies_jordan_as_member_and_taylor_as_caregiver():
    hospice_case = load_fixture("hospice_case.json")

    assert hospice_case["case_id"] == "PI-HSP-2026-0042"
    assert hospice_case["case_type"] == "StateMedicaidHospice"
    assert hospice_case["member_id"] == "MBR-071426"
    assert hospice_case["attendant_id"] == "ATT-HSP-4401"
    assert hospice_case["caregiver_name"] == "Taylor Brooks"


def test_hospice_member_fixture_matches_the_claim_and_medical_record():
    member = load_fixture("hospice_members.json")[0]

    assert member["member_id"] == "MBR-071426"
    assert member["medicaid_id"] == "NMCD-SYN-071426"
    assert member["name"] == "Jordan Ellis"
    assert member["date_of_birth"] == "1991-02-08"


def test_hospice_claim_lines_match_the_published_beeceptor_response():
    hospice_claims = load_fixture("hospice_claims.json")

    assert [line["line_id"] for line in hospice_claims] == [
        "LINE-0713-01",
        "LINE-0714-01",
        "LINE-0716-01",
    ]
    assert sum(line["units_billed"] for line in hospice_claims) == 52
    assert sum(line["billed_amount"] for line in hospice_claims) == 3250.0
    july_14 = next(line for line in hospice_claims if line["line_id"] == "LINE-0714-01")
    assert july_14["place_of_service_code"] == "12"
    assert july_14["units_billed"] == 24


def test_institutional_encounter_preserves_observation_class_and_exact_interval():
    encounter = load_fixture("institutional_encounters.json")[0]

    assert encounter["member_id"] == "MBR-071426"
    assert encounter["patient_class"] == "Observation"
    assert encounter["arrival_at"] == "2026-07-14T08:20:00-05:00"
    assert encounter["discharge_at"] == "2026-07-16T10:00:00-05:00"


def test_location_signal_records_the_six_hour_review_indicator():
    signals = load_fixture("risk_signals.json")
    location_signal = next(signal for signal in signals if signal["signal_id"] == "RS-HSP-01")

    assert location_signal["case_id"] == "PI-HSP-2026-0042"
    assert location_signal["result_value"]["overlap_minutes"] == 360
    assert location_signal["result_value"]["determination"] == "Review indicator only"


def test_existing_pcs_case_is_preserved_with_explicit_case_type():
    cases = load_fixture("cases.json")
    pcs_case = next(case for case in cases if case["case_id"] == "PI-PCS-2026-0041")

    assert {case["case_id"] for case in cases} == {"PI-PCS-2026-0041", "PI-HSP-2026-0042"}
    assert pcs_case["case_type"] == "MedicaidPCS"
    assert pcs_case["provider_id"] == "PRV-100482"


def test_hospice_documents_keep_policy_reference_separate_from_ixp_evidence():
    documents = load_fixture("evidence_documents.json")
    hospice_documents = [doc for doc in documents if doc["case_id"] == "PI-HSP-2026-0042"]

    assert {doc["doc_id"] for doc in hospice_documents} == {
        "DOC-HSP-TS-0714",
        "DOC-HSP-MR-0714",
        "DOC-HSP-POL-PCS47",
    }
    policy = next(doc for doc in hospice_documents if doc["doc_id"] == "DOC-HSP-POL-PCS47")
    assert policy["reference_only"] is True
    assert policy["ixp_model"] is None

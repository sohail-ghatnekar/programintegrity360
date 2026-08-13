import asyncio
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from main import GraphState, evaluate_quick_rules


def evaluate(**kwargs):
    return asyncio.run(evaluate_quick_rules(GraphState(**kwargs)))


def test_hospice_claim_at_threshold_waits_for_provider_response():
    output = evaluate(
        case_id="PI-HSP-2026-0042",
        case_type="StateMedicaidHospice",
        current_stage="IntakeTriage",
        claim_total_billed=3250.0,
        provider_response_needed=False,
        provider_response_received=False,
        missing_evidence_count=0,
        unsupported_units=0,
        proposed_action="continue evidence acquisition",
    )

    assert output.recommended_stage == "ProviderResponse"
    assert output.provider_wait_required is True
    assert "await_provider_response" in output.blockers


def test_hospice_timesheet_and_encounter_intersection_is_six_hours():
    output = evaluate(
        case_id="PI-HSP-2026-0042",
        case_type="StateMedicaidHospice",
        claim_total_billed=3250.0,
        provider_response_received=True,
        claimed_service_start_at="2026-07-14T09:00:00-05:00",
        claimed_service_end_at="2026-07-14T15:00:00-05:00",
        encounter_arrival_at="2026-07-14T08:20:00-05:00",
        encounter_discharge_at="2026-07-16T10:00:00-05:00",
        patient_class="Observation",
        missing_evidence_count=0,
        unsupported_units=0,
        proposed_action="continue investigation",
    )

    assert output.model_dump().get("location_conflict_minutes") == 360
    assert "location_time_conflict_detected" in output.warnings
    assert "observation_status_not_inpatient" in output.warnings
    assert "inpatient" not in " ".join(output.facts_checked).lower()


@pytest.mark.parametrize(
    ("service_start", "service_end"),
    [
        ("2026-07-13T09:00:00-05:00", "2026-07-13T13:00:00-05:00"),
        ("2026-07-16T13:00:00-05:00", "2026-07-16T16:00:00-05:00"),
    ],
)
def test_service_outside_encounter_has_no_location_conflict(service_start, service_end):
    output = evaluate(
        case_id="PI-HSP-2026-0042",
        case_type="StateMedicaidHospice",
        claim_total_billed=3250.0,
        provider_response_received=True,
        claimed_service_start_at=service_start,
        claimed_service_end_at=service_end,
        encounter_arrival_at="2026-07-14T08:20:00-05:00",
        encounter_discharge_at="2026-07-16T10:00:00-05:00",
        patient_class="Observation",
        missing_evidence_count=0,
        unsupported_units=0,
        proposed_action="continue investigation",
    )

    assert output.model_dump().get("location_conflict_minutes") == 0
    assert "location_time_conflict_detected" not in output.warnings


def test_unknown_case_type_stops_at_intake_validation():
    output = evaluate(
        case_id="PI-UNKNOWN-2026-0001",
        case_type="CommercialHospice",
        claim_total_billed=5000.0,
        provider_response_received=False,
        missing_evidence_count=0,
        unsupported_units=0,
    )

    assert output.recommended_stage == "IntakeValidation"
    assert "unsupported_case_type" in output.blockers


def test_missing_hospice_encounter_routes_back_to_evidence():
    output = evaluate(
        case_id="PI-HSP-2026-0042",
        case_type="StateMedicaidHospice",
        claim_total_billed=3250.0,
        provider_response_received=True,
        missing_evidence_count=1,
        unsupported_units=0,
        proposed_action="continue investigation",
    )

    assert output.recommended_stage == "Evidence"
    assert output.evidence_gap is True
    assert "missing_material_evidence" in output.blockers


def test_pcs_adverse_action_still_requires_supervisor_approval():
    output = evaluate(
        case_id="PI-PCS-2026-0041",
        case_type="MedicaidPCS",
        risk_score=10,
        unsupported_units=24,
        missing_evidence_count=0,
        provider_response_needed=False,
        provider_response_received=True,
        supervisor_approved=False,
        proposed_action="refer for audit and overpayment recovery",
    )

    assert output.recommended_stage == "SupervisorEscalation"
    assert output.supervisor_gate_required is True
    assert "supervisor_approval_required" in output.blockers

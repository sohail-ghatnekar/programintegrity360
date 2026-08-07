from __future__ import annotations

import json
from datetime import datetime
from typing import Any

from langgraph.graph import END, START, StateGraph
from pydantic import BaseModel, Field


class QuickRulesInput(BaseModel):
    case_id: str = Field(
        default="PI-PCS-2026-0041",
        description="Program Integrity case identifier.",
    )
    case_type: str = Field(
        description="Required intake type: MedicaidPCS or StateMedicaidHospice.",
    )
    current_stage: str = Field(
        default="Investigation",
        description="Current case stage or state when the rules check starts.",
    )
    risk_score: int | None = Field(
        default=None,
        description="Risk score from the case record, expected to be 0 through 100.",
    )
    claim_total_billed: float | None = Field(
        default=None,
        description="Total billed amount for threshold routing.",
    )
    claim_threshold: float | None = Field(
        default=2500.0,
        description="Configurable hospice intake threshold.",
    )
    unsupported_units: int | None = Field(
        default=24,
        description="De-duplicated units that are not supported by evidence.",
    )
    missing_evidence_count: int | None = Field(
        default=0,
        description="Count of material evidence items still missing or unresolved.",
    )
    provider_response_needed: bool | None = Field(
        default=False,
        description="Whether a provider response is required before moving forward.",
    )
    provider_response_received: bool | None = Field(
        default=True,
        description="Whether the required provider response has been received.",
    )
    claimed_service_start_at: str | None = Field(
        default=None,
        description="ISO-8601 start of the service interval extracted from the timesheet.",
    )
    claimed_service_end_at: str | None = Field(
        default=None,
        description="ISO-8601 end of the service interval extracted from the timesheet.",
    )
    encounter_arrival_at: str | None = Field(
        default=None,
        description="ISO-8601 arrival time extracted from the institutional record.",
    )
    encounter_discharge_at: str | None = Field(
        default=None,
        description="ISO-8601 discharge time extracted from the institutional record.",
    )
    patient_class: str | None = Field(
        default=None,
        description="Patient class extracted verbatim from the institutional record.",
    )
    supervisor_approved: bool | None = Field(
        default=False,
        description="Whether the supervisor gate has already been approved.",
    )
    proposed_action: str | None = Field(
        default="",
        description="Proposed next action, such as refer for audit or close.",
    )
    gating_json: str | None = Field(
        default=None,
        description="Optional JSON string with fields that override the typed inputs.",
    )


class QuickRulesOutput(BaseModel):
    case_id: str = Field(description="Program Integrity case identifier.")
    status: str = Field(description="blocked or clear_for_case_manager.")
    recommended_stage: str = Field(
        description="Recommended next ad-hoc stage for the Case Manager agent.",
    )
    blockers: list[str] = Field(
        default_factory=list,
        description="Blocking rule failures that must be resolved before closure.",
    )
    warnings: list[str] = Field(
        default_factory=list,
        description="Non-blocking issues for the case manager to review.",
    )
    facts_checked: list[str] = Field(
        default_factory=list,
        description="Primitive facts used by the deterministic rules.",
    )
    supervisor_gate_required: bool = Field(
        default=False,
        description="True when the proposed action requires supervisor approval.",
    )
    provider_wait_required: bool = Field(
        default=False,
        description="True when provider response is still required.",
    )
    evidence_gap: bool = Field(
        default=False,
        description="True when material evidence is missing.",
    )
    location_conflict_minutes: int = Field(
        default=0,
        description="Minutes where claimed home service intersects the institutional encounter.",
    )


class GraphState(QuickRulesInput):
    status: str = ""
    recommended_stage: str = ""
    blockers: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
    facts_checked: list[str] = Field(default_factory=list)
    supervisor_gate_required: bool = False
    provider_wait_required: bool = False
    evidence_gap: bool = False
    location_conflict_minutes: int = 0


CASE_TYPES = {"MedicaidPCS", "StateMedicaidHospice"}
HOSPICE_CASE_TYPE = "StateMedicaidHospice"


def _as_bool(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.strip().lower() in {"true", "yes", "y", "1", "proceed", "approved"}
    if isinstance(value, (int, float)):
        return value != 0
    return False


def _as_int(value: Any, default: int = 0) -> int:
    if isinstance(value, bool):
        return int(value)
    if isinstance(value, (int, float)):
        return int(value)
    if isinstance(value, str):
        try:
            return int(float(value.strip()))
        except ValueError:
            return default
    return default


def _as_float(value: Any, default: float = 0.0) -> float:
    if isinstance(value, bool):
        return float(value)
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        try:
            return float(value.strip())
        except ValueError:
            return default
    return default


def _parse_datetime(value: Any) -> datetime | None:
    if not isinstance(value, str) or not value.strip():
        return None
    try:
        return datetime.fromisoformat(value.strip().replace("Z", "+00:00"))
    except ValueError:
        return None


def _interval_overlap_minutes(
    service_start_raw: Any,
    service_end_raw: Any,
    encounter_start_raw: Any,
    encounter_end_raw: Any,
) -> tuple[int, bool]:
    raw_values = (
        service_start_raw,
        service_end_raw,
        encounter_start_raw,
        encounter_end_raw,
    )
    if not any(raw_values):
        return 0, False

    parsed = tuple(_parse_datetime(value) for value in raw_values)
    if any(value is None for value in parsed):
        return 0, True

    service_start, service_end, encounter_start, encounter_end = parsed
    if service_end <= service_start or encounter_end <= encounter_start:
        return 0, True

    overlap_start = max(service_start, encounter_start)
    overlap_end = min(service_end, encounter_end)
    if overlap_end <= overlap_start:
        return 0, False
    return int((overlap_end - overlap_start).total_seconds() // 60), False


def _load_overrides(raw: str | None) -> dict[str, Any]:
    if not raw:
        return {}
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        return {}
    return parsed if isinstance(parsed, dict) else {}


def _get(state: GraphState, overrides: dict[str, Any], name: str) -> Any:
    return overrides.get(name, getattr(state, name))


async def evaluate_quick_rules(state: GraphState) -> QuickRulesOutput:
    overrides = _load_overrides(state.gating_json)
    case_id = str(_get(state, overrides, "case_id") or "PI-PCS-2026-0041")
    case_type = str(_get(state, overrides, "case_type") or "")
    current_stage = str(_get(state, overrides, "current_stage") or "Investigation")
    proposed_action = str(_get(state, overrides, "proposed_action") or "")
    risk_score = _as_int(_get(state, overrides, "risk_score"), 0)
    claim_total_billed = _as_float(_get(state, overrides, "claim_total_billed"), 0.0)
    claim_threshold = _as_float(_get(state, overrides, "claim_threshold"), 2500.0)
    unsupported_units = _as_int(_get(state, overrides, "unsupported_units"), 0)
    missing_evidence_count = _as_int(_get(state, overrides, "missing_evidence_count"), 0)
    provider_response_needed = _as_bool(_get(state, overrides, "provider_response_needed"))
    provider_response_received = _as_bool(_get(state, overrides, "provider_response_received"))
    supervisor_approved = _as_bool(_get(state, overrides, "supervisor_approved"))
    patient_class = str(_get(state, overrides, "patient_class") or "")
    location_conflict_minutes, invalid_interval = _interval_overlap_minutes(
        _get(state, overrides, "claimed_service_start_at"),
        _get(state, overrides, "claimed_service_end_at"),
        _get(state, overrides, "encounter_arrival_at"),
        _get(state, overrides, "encounter_discharge_at"),
    )

    blockers: list[str] = []
    warnings: list[str] = []
    facts_checked = [
        f"case_id={case_id}",
        f"case_type={case_type or 'missing'}",
        f"current_stage={current_stage}",
        f"risk_score={risk_score}",
        f"claim_total_billed={claim_total_billed:.2f}",
        f"claim_threshold={claim_threshold:.2f}",
        f"unsupported_units={unsupported_units}",
        f"missing_evidence_count={missing_evidence_count}",
        f"provider_response_needed={provider_response_needed}",
        f"provider_response_received={provider_response_received}",
        f"supervisor_approved={supervisor_approved}",
        f"proposed_action={proposed_action or 'none'}",
        f"patient_class={patient_class or 'not_provided'}",
        f"location_conflict_minutes={location_conflict_minutes}",
    ]

    valid_case_type = case_type in CASE_TYPES
    if not valid_case_type:
        blockers.append("unsupported_case_type")

    if risk_score < 0 or risk_score > 100:
        blockers.append("risk_score_out_of_range")

    if unsupported_units < 0:
        blockers.append("unsupported_units_negative")

    if claim_total_billed < 0 or claim_threshold < 0:
        blockers.append("claim_amount_or_threshold_negative")

    if invalid_interval:
        blockers.append("invalid_service_or_encounter_interval")

    evidence_gap = missing_evidence_count > 0
    if evidence_gap:
        blockers.append("missing_material_evidence")

    hospice_threshold_met = (
        case_type == HOSPICE_CASE_TYPE and claim_total_billed >= claim_threshold
    )
    provider_response_needed = provider_response_needed or hospice_threshold_met
    provider_wait_required = provider_response_needed and not provider_response_received
    if provider_wait_required:
        blockers.append("await_provider_response")

    gated_terms = ("recovery", "overpayment", "refer", "audit", "sanction", "notice", "adverse")
    supervisor_gate_required = any(term in proposed_action.lower() for term in gated_terms)
    if supervisor_gate_required and not supervisor_approved:
        blockers.append("supervisor_approval_required")

    if unsupported_units == 0 and "close" not in proposed_action.lower():
        warnings.append("no_unsupported_units_in_input")

    if case_type == HOSPICE_CASE_TYPE and claim_total_billed < claim_threshold:
        warnings.append("hospice_claim_below_threshold")

    if location_conflict_minutes > 0:
        warnings.append("location_time_conflict_detected")

    if patient_class.strip().lower() == "observation":
        warnings.append("observation_status_not_inpatient")

    if not valid_case_type:
        recommended_stage = "IntakeValidation"
    elif case_type == HOSPICE_CASE_TYPE and not hospice_threshold_met:
        recommended_stage = "IntakeTriage"
    elif provider_wait_required:
        recommended_stage = "ProviderResponse"
    elif evidence_gap:
        recommended_stage = "Evidence"
    elif supervisor_gate_required and not supervisor_approved:
        recommended_stage = "SupervisorEscalation"
    elif not blockers:
        recommended_stage = "Investigation"
    else:
        recommended_stage = "SupervisorEscalation"

    return QuickRulesOutput(
        case_id=case_id,
        status="blocked" if blockers else "clear_for_case_manager",
        recommended_stage=recommended_stage,
        blockers=blockers,
        warnings=warnings,
        facts_checked=facts_checked,
        supervisor_gate_required=supervisor_gate_required,
        provider_wait_required=provider_wait_required,
        evidence_gap=evidence_gap,
        location_conflict_minutes=location_conflict_minutes,
    )


builder = StateGraph(
    GraphState,
    input_schema=QuickRulesInput,
    output_schema=QuickRulesOutput,
)
builder.add_node("evaluate_quick_rules", evaluate_quick_rules)
builder.add_edge(START, "evaluate_quick_rules")
builder.add_edge("evaluate_quick_rules", END)

graph = builder.compile()

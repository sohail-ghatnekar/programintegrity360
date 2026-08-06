from __future__ import annotations

import json
from typing import Any

from langgraph.graph import END, START, StateGraph
from pydantic import BaseModel, Field


class QuickRulesInput(BaseModel):
    case_id: str = Field(
        default="PI-PCS-2026-0041",
        description="Program Integrity case identifier.",
    )
    current_stage: str = Field(
        default="Investigation",
        description="Current case stage or state when the rules check starts.",
    )
    risk_score: int | None = Field(
        default=86,
        description="Risk score from the case record, expected to be 0 through 100.",
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


class GraphState(QuickRulesInput):
    status: str = ""
    recommended_stage: str = ""
    blockers: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
    facts_checked: list[str] = Field(default_factory=list)
    supervisor_gate_required: bool = False
    provider_wait_required: bool = False
    evidence_gap: bool = False


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
    current_stage = str(_get(state, overrides, "current_stage") or "Investigation")
    proposed_action = str(_get(state, overrides, "proposed_action") or "")
    risk_score = _as_int(_get(state, overrides, "risk_score"), 0)
    unsupported_units = _as_int(_get(state, overrides, "unsupported_units"), 0)
    missing_evidence_count = _as_int(_get(state, overrides, "missing_evidence_count"), 0)
    provider_response_needed = _as_bool(_get(state, overrides, "provider_response_needed"))
    provider_response_received = _as_bool(_get(state, overrides, "provider_response_received"))
    supervisor_approved = _as_bool(_get(state, overrides, "supervisor_approved"))

    blockers: list[str] = []
    warnings: list[str] = []
    facts_checked = [
        f"case_id={case_id}",
        f"current_stage={current_stage}",
        f"risk_score={risk_score}",
        f"unsupported_units={unsupported_units}",
        f"missing_evidence_count={missing_evidence_count}",
        f"provider_response_needed={provider_response_needed}",
        f"provider_response_received={provider_response_received}",
        f"supervisor_approved={supervisor_approved}",
        f"proposed_action={proposed_action or 'none'}",
    ]

    if risk_score < 0 or risk_score > 100:
        blockers.append("risk_score_out_of_range")

    if unsupported_units < 0:
        blockers.append("unsupported_units_negative")

    evidence_gap = missing_evidence_count > 0
    if evidence_gap:
        blockers.append("missing_material_evidence")

    provider_wait_required = provider_response_needed and not provider_response_received
    if provider_wait_required:
        blockers.append("await_provider_response")

    gated_terms = ("recovery", "overpayment", "refer", "audit", "sanction", "notice", "adverse")
    supervisor_gate_required = any(term in proposed_action.lower() for term in gated_terms)
    if supervisor_gate_required and not supervisor_approved:
        blockers.append("supervisor_approval_required")

    if risk_score >= 85 and not supervisor_gate_required:
        warnings.append("high_risk_review_recommended")

    if unsupported_units == 0 and "close" not in proposed_action.lower():
        warnings.append("no_unsupported_units_in_input")

    if provider_wait_required:
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
    )


builder = StateGraph(GraphState, input=QuickRulesInput, output=QuickRulesOutput)
builder.add_node("evaluate_quick_rules", evaluate_quick_rules)
builder.add_edge(START, "evaluate_quick_rules")
builder.add_edge("evaluate_quick_rules", END)

graph = builder.compile()

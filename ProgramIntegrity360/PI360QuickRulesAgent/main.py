from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Any


@dataclass
class QuickRulesIn:
    case_id: str = "PI-PCS-2026-0041"
    current_stage: str = "Investigation"
    risk_score: int | None = 86
    unsupported_units: int | None = 24
    missing_evidence_count: int | None = 0
    provider_response_needed: bool | None = False
    provider_response_received: bool | None = True
    supervisor_approved: bool | None = False
    proposed_action: str | None = ""
    gating_json: str | None = None


@dataclass
class QuickRulesOut:
    case_id: str
    status: str
    recommended_stage: str
    blockers: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    facts_checked: list[str] = field(default_factory=list)
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


def _get(input_value: QuickRulesIn, overrides: dict[str, Any], name: str) -> Any:
    return overrides.get(name, getattr(input_value, name))


def main(input: QuickRulesIn) -> QuickRulesOut:
    overrides = _load_overrides(input.gating_json)
    case_id = str(_get(input, overrides, "case_id") or "PI-PCS-2026-0041")
    current_stage = str(_get(input, overrides, "current_stage") or "Investigation")
    proposed_action = str(_get(input, overrides, "proposed_action") or "")
    risk_score = _as_int(_get(input, overrides, "risk_score"), 0)
    unsupported_units = _as_int(_get(input, overrides, "unsupported_units"), 0)
    missing_evidence_count = _as_int(_get(input, overrides, "missing_evidence_count"), 0)
    provider_response_needed = _as_bool(_get(input, overrides, "provider_response_needed"))
    provider_response_received = _as_bool(_get(input, overrides, "provider_response_received"))
    supervisor_approved = _as_bool(_get(input, overrides, "supervisor_approved"))

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

    status = "blocked" if blockers else "clear_for_case_manager"

    return QuickRulesOut(
        case_id=case_id,
        status=status,
        recommended_stage=recommended_stage,
        blockers=blockers,
        warnings=warnings,
        facts_checked=facts_checked,
        supervisor_gate_required=supervisor_gate_required,
        provider_wait_required=provider_wait_required,
        evidence_gap=evidence_gap,
    )

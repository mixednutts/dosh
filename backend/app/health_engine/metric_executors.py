"""Metric executors — code-backed scoring logic for each metric template.

Each executor receives:
- formula_result: Decimal from evaluating the metric's formula
- threshold_value: the user's threshold/benchmark value for this metric
- scoring_sensitivity: int 0-100 controlling steepness of penalty curves
- tone: str "supportive" | "factual" | "friendly"

Returns a dict with:
- score: int 0-100
- status: str "Strong" | "Watch" | "Needs Attention"
- summary: str (tone-aware message)
- evidence: list[str] (supporting details)
- drill_down: list[dict] (optional structured references)
"""

from __future__ import annotations

import json
from decimal import Decimal
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from sqlalchemy.orm import Session
    from ..models import Budget, FinancialPeriod


HEALTH_STRONG = "Strong"
HEALTH_WATCH = "Watch"
HEALTH_ATTENTION = "Needs Attention"


def _health_status(score: int) -> str:
    if score >= 80:
        return HEALTH_STRONG
    if score >= 55:
        return HEALTH_WATCH
    return HEALTH_ATTENTION


def _select_summary(template: dict, tone: str) -> str:
    """Select summary text based on tone preference.

    Supports both nested {"summary_templates": {"tone": ...}} and
    flat {"supportive": ..., "factual": ..., "friendly": ...} formats.
    """
    if "summary_templates" in template:
        templates = template.get("summary_templates", {})
        return templates.get(tone, templates.get("factual", "Health check completed."))
    # Flat format fallback
    return template.get(tone, template.get("factual", "Health check completed."))


# Registry mapping metric template keys to executor functions.
METRIC_EXECUTORS: dict[str, Any] = {}


# Registry mapping scoring logic types to executor functions.
SCORING_LOGIC_EXECUTORS: dict[str, Any] = {}


def _custom_metric_v1_executor(
    *,
    db,
    budget,
    period,
    formula_result,
    threshold_value,
    scoring_sensitivity,
    tone,
    source_values,
    metric_name="Metric",
    evidence_templates=None,
    **kwargs,
):
    """Generic threshold-based executor for custom metrics.

    Interprets formula_result as 'lower is better' against threshold_value.
    """
    from decimal import Decimal

    threshold = threshold_value if threshold_value is not None else Decimal(0)

    if formula_result <= threshold:
        score = 100
        status = HEALTH_STRONG
    else:
        delta = float(formula_result - threshold)
        penalty = delta * max(0.01, scoring_sensitivity / 50.0)
        score = max(0, int(100 - penalty))
        status = _health_status(score)

    summary = _select_summary(evidence_templates or {}, tone)
    if summary == "Health check completed.":
        if score >= 80:
            summary = f"{metric_name} is within target."
        else:
            summary = f"{metric_name} has exceeded the threshold."

    evidence = [f"{metric_name}: {formula_result:.2f} (threshold: {threshold:.2f})"]

    return {
        "score": score,
        "status": status,
        "summary": summary,
        "evidence": evidence,
        "drill_down": [],
    }


SCORING_LOGIC_EXECUTORS["custom_metric_v1"] = _custom_metric_v1_executor


def get_executor(metric_template_key: str, scoring_logic_type: str | None = None):
    """Get the executor function for a metric template key or scoring logic type."""
    executor = METRIC_EXECUTORS.get(metric_template_key)
    if executor is None and scoring_logic_type:
        executor = SCORING_LOGIC_EXECUTORS.get(scoring_logic_type)
    if executor is None:
        # Default fallback — return neutral score
        def fallback_executor(*args, **kwargs):
            return {
                "score": 50,
                "status": HEALTH_WATCH,
                "summary": "Metric evaluation not yet implemented.",
                "evidence": [],
                "drill_down": [],
            }
        return fallback_executor
    return executor

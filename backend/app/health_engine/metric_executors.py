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
    """Select summary text based on tone preference."""
    templates = template.get("summary_templates", {})
    return templates.get(tone, templates.get("factual", "Health check completed."))


# Registry mapping metric template keys to executor functions.
# Previously populated with system metric executors; now empty so that
# all metrics are created from the UI and matched by fallback behaviour
# until an executor is promoted to the registry.
METRIC_EXECUTORS: dict[str, Any] = {}


def get_executor(metric_template_key: str):
    """Get the executor function for a metric template key."""
    executor = METRIC_EXECUTORS.get(metric_template_key)
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

"""AI Insights service — payload builder, prompt builder, LLM caller."""

import json
import logging
from decimal import Decimal
from typing import Any

import httpx

from .encryption import decrypt_value, encryption_ready
from .models import Budget
from .url_security import UnsafeUrlError, validate_external_url

logger = logging.getLogger(__name__)

DEFAULT_SYSTEM_PROMPT = (
    "You are a personal finance advisor. Review the provided budget period data "
    "and offer a concise, constructive insight. Lead with what is going well, "
    "then mention any watchouts. Keep the tone {tone}. Be specific and evidence-based. "
    "Avoid generic praise. Respond in plain text, no markdown."
)

OPENROUTER_CHAT_URL = "https://openrouter.ai/api/v1/chat/completions"


def _to_float(value: Any) -> float:
    if value is None:
        return 0.0
    if isinstance(value, Decimal):
        return float(value)
    return float(value)


def build_period_payload(
    period_detail: dict,
    health: dict | None,
    budget: Budget,
    closeout_comments: str | None = None,
    closeout_goals: str | None = None,
) -> dict:
    """Build a concise, LLM-friendly payload from period detail."""
    period = period_detail.get("period", {})
    incomes = period_detail.get("incomes", [])
    expenses = period_detail.get("expenses", [])
    investments = period_detail.get("investments", [])
    balances = period_detail.get("balances", [])

    income_budget = sum(_to_float(i.get("budgetamount", 0)) for i in incomes)
    income_actual = sum(_to_float(i.get("actualamount", 0)) for i in incomes)
    expense_budget = sum(_to_float(e.get("budgetamount", 0)) for e in expenses)
    expense_actual = sum(_to_float(e.get("actualamount", 0)) for e in expenses)
    investment_budget = sum(_to_float(inv.get("budgeted_amount", 0)) for inv in investments)
    investment_actual = sum(_to_float(inv.get("actualamount", 0)) for inv in investments)
    surplus_actual = income_actual - expense_actual - investment_actual

    payload: dict[str, Any] = {
        "budget": {
            "description": budget.description or "",
            "frequency": budget.budget_frequency,
            "currency": budget.currency,
            "timezone": budget.timezone,
            "health_tone": budget.health_tone or "supportive",
        },
        "period": {
            "cycle_stage": getattr(period, "cycle_stage", "Current"),
            "start_date": getattr(period, "startdate", None),
            "end_date": getattr(period, "enddate", None),
            "is_locked": getattr(period, "islocked", False),
        },
        "totals": {
            "income_budget": round(income_budget, 2),
            "income_actual": round(income_actual, 2),
            "expense_budget": round(expense_budget, 2),
            "expense_actual": round(expense_actual, 2),
            "investment_budget": round(investment_budget, 2),
            "investment_actual": round(investment_actual, 2),
            "surplus_actual": round(surplus_actual, 2),
        },
        "income_lines": [
            {
                "description": i.get("incomedesc", ""),
                "budget": _to_float(i.get("budgetamount", 0)),
                "actual": _to_float(i.get("actualamount", 0)),
                "status": i.get("status", "Current"),
                "is_system": i.get("is_system", False),
            }
            for i in incomes
        ],
        "expense_lines": [
            {
                "description": e.get("expensedesc", ""),
                "budget": _to_float(e.get("budgetamount", 0)),
                "actual": _to_float(e.get("actualamount", 0)),
                "remaining": _to_float(e.get("remaining_amount", 0)),
                "status": e.get("status", "Current"),
                "paytype": e.get("paytype"),
                "schedule": e.get("freqtype"),
            }
            for e in expenses
        ],
        "investment_lines": [
            {
                "description": inv.get("investmentdesc", ""),
                "budget": _to_float(inv.get("budgeted_amount", 0)),
                "actual": _to_float(inv.get("actualamount", 0)),
                "status": inv.get("status", "Current"),
            }
            for inv in investments
        ],
        "balances": [
            {
                "account": b.get("balancedesc", ""),
                "type": b.get("balance_type"),
                "opening": _to_float(b.get("opening_amount", 0)),
                "movement": _to_float(b.get("movement_amount", 0)),
                "closing": _to_float(b.get("closing_amount", 0)),
            }
            for b in balances
        ],
        "line_counts": {
            "income_total": len(incomes),
            "expense_total": len(expenses),
            "investment_total": len(investments),
            "expense_paid": sum(1 for e in expenses if e.get("status") == "Paid"),
            "expense_revised": sum(1 for e in expenses if e.get("status") == "Revised"),
            "expense_current": sum(1 for e in expenses if e.get("status") not in ("Paid", "Revised")),
        },
    }

    if health:
        current_check = health.get("current_period_check") or {}
        payload["health"] = {
            "overall_score": health.get("overall_score"),
            "overall_status": health.get("overall_status"),
            "momentum_status": health.get("momentum_status"),
            "momentum_delta": health.get("momentum_delta"),
            "current_period_check": {
                "score": current_check.get("score"),
                "status": current_check.get("status"),
                "summary": current_check.get("summary"),
            } if current_check else None,
            "metrics": [
                {
                    "name": m.get("name"),
                    "score": m.get("score"),
                    "status": m.get("status"),
                    "summary": m.get("summary"),
                }
                for m in (current_check.get("metrics", []) if current_check else [])
            ],
        }

    if closeout_comments or closeout_goals:
        payload["closeout_context"] = {
            "comments": closeout_comments,
            "goals": closeout_goals,
        }

    return payload


def build_prompt(payload: dict, tone: str, user_prompt: str | None) -> str:
    system = (user_prompt or DEFAULT_SYSTEM_PROMPT).format(tone=tone)
    data_json = json.dumps(payload, indent=2, default=str)
    return f"{system}\n\nBudget Period Data:\n{data_json}"


def _resolve_provider_config(budget: Budget) -> tuple[str, str, str]:
    """Return (base_url, model_id, api_key) for the configured provider."""
    provider = budget.ai_provider
    if provider == "openrouter":
        return OPENROUTER_CHAT_URL, budget.ai_model or "", ""
    if provider == "openai_compatible":
        return budget.ai_base_url or "", budget.ai_custom_model or "", ""
    raise ValueError(f"Unsupported AI provider: {provider}")


def generate_insight(
    budget: Budget,
    period_detail: dict,
    health: dict | None,
    closeout_comments: str | None = None,
    closeout_goals: str | None = None,
) -> dict:
    """Generate AI insight for the current period.

    Returns a dict with:
        insight: str
        model_used: str
        prompt_tokens: int
        completion_tokens: int
    """
    if not encryption_ready():
        raise ValueError("DOSH_ENCRYPTION_SECRET is not configured on the server")

    if not budget.ai_insights_enabled:
        raise ValueError("AI insights are not enabled for this budget")

    api_key = decrypt_value(budget.ai_api_key_encrypted)
    if not api_key:
        raise ValueError("No API key configured for this budget")

    raw_url, model_id, _ = _resolve_provider_config(budget)
    if not raw_url:
        raise ValueError("AI provider base URL is not configured")
    if not model_id:
        raise ValueError("AI model is not configured")
    try:
        validate_external_url(raw_url)
    except UnsafeUrlError as exc:
        raise ValueError(f"Invalid AI provider URL: {exc}") from exc

    # Use a verified URL variable for the HTTP call to satisfy SSRF taint analysis.
    # openrouter uses a hardcoded URL; openai_compatible was validated above.
    provider = budget.ai_provider
    if provider == "openrouter":
        _verified_url = OPENROUTER_CHAT_URL
    else:
        _verified_url = raw_url

    tone = budget.health_tone or "supportive"
    user_prompt = budget.ai_system_prompt

    payload = build_period_payload(period_detail, health, budget, closeout_comments, closeout_goals)
    prompt = build_prompt(payload, tone, user_prompt)

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    if provider == "openrouter":
        headers["HTTP-Referer"] = "https://dosh.mixednutts.ddns.net"

    request_body = {
        "model": model_id,
        "messages": [
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.7,
        "max_tokens": 800,
    }

    try:
        with httpx.Client(timeout=60.0) as client:
            response = client.post(_verified_url, headers=headers, json=request_body)
            response.raise_for_status()
            data = response.json()
    except httpx.HTTPStatusError as exc:
        logger.warning("LLM API error: %s - %s", exc.response.status_code, exc.response.text)
        raise ValueError(f"LLM API returned error: {exc.response.status_code}") from exc
    except Exception as exc:
        logger.warning("LLM request failed: %s", exc)
        raise ValueError(f"Failed to contact LLM API: {exc}") from exc

    choice = data.get("choices", [{}])[0]
    insight_text = choice.get("message", {}).get("content", "").strip()
    usage = data.get("usage", {})

    return {
        "insight": insight_text,
        "model_used": data.get("model", model_id),
        "prompt_tokens": usage.get("prompt_tokens", 0),
        "completion_tokens": usage.get("completion_tokens", 0),
    }

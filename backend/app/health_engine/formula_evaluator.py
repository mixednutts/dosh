"""Safe formula evaluator for health metric expressions.

Supports only:
- Decimal numbers (including negatives)
- +, -, *, / operators
- Parentheses
- References to data source keys (resolved via a provided mapping)

Any other token or character is rejected.
"""

from __future__ import annotations

import re
from decimal import Decimal, InvalidOperation


# Token specification
_TOKEN_RE = re.compile(
    r"""
        (?P<NUMBER>\d+\.?\d*)
        |(?P<NAME>[a-zA-Z_][a-zA-Z0-9_]*)
        |(?P<OP>[+\-*/()])
        |(?P<WS>\s+)
        |(?P<INVALID>.)
    """,
    re.VERBOSE,
)


def _tokenize(expression: str):
    for mo in _TOKEN_RE.finditer(expression):
        kind = mo.lastgroup
        value = mo.group()
        if kind == "WS":
            continue
        if kind == "INVALID":
            raise ValueError(f"Invalid character in formula: {value!r}")
        yield (kind, value)


class _Parser:
    def __init__(self, tokens: list[tuple[str, str]], source_values: dict[str, Decimal]):
        self.tokens = tokens
        self.pos = 0
        self.source_values = source_values

    def _peek(self) -> tuple[str, str] | None:
        if self.pos < len(self.tokens):
            return self.tokens[self.pos]
        return None

    def _consume(self, expected_kind: str | None = None) -> tuple[str, str]:
        token = self._peek()
        if token is None:
            raise ValueError("Unexpected end of formula")
        kind, value = token
        if expected_kind is not None and kind != expected_kind:
            raise ValueError(f"Expected {expected_kind} but found {kind} ({value!r})")
        self.pos += 1
        return kind, value

    def parse(self) -> Decimal:
        result = self._expr()
        if self._peek() is not None:
            raise ValueError("Unexpected token after end of formula")
        return result

    def _expr(self) -> Decimal:
        result = self._term()
        while True:
            token = self._peek()
            if token and token[1] in ("+", "-"):
                self._consume()
                rhs = self._term()
                if token[1] == "+":
                    result = result + rhs
                else:
                    result = result - rhs
            else:
                break
        return result

    def _term(self) -> Decimal:
        result = self._factor()
        while True:
            token = self._peek()
            if token and token[1] in ("*", "/"):
                self._consume()
                rhs = self._factor()
                if token[1] == "*":
                    result = result * rhs
                else:
                    if rhs == 0:
                        raise ZeroDivisionError("Division by zero in formula")
                    result = result / rhs
            else:
                break
        return result

    def _factor(self) -> Decimal:
        token = self._peek()
        if token is None:
            raise ValueError("Unexpected end of formula")
        kind, value = token
        if kind == "OP" and value == "(":
            self._consume()
            result = self._expr()
            self._consume(expected_kind="OP")  # expect ')'
            if value != "(":
                # We already consumed '(' above; this next consume must be ')'
                pass
            next_token = self.tokens[self.pos - 1]
            if next_token[1] != ")":
                raise ValueError("Expected closing parenthesis")
            return result
        if kind == "NUMBER":
            self._consume()
            try:
                return Decimal(value)
            except InvalidOperation as exc:
                raise ValueError(f"Invalid number: {value!r}") from exc
        if kind == "NAME":
            self._consume()
            if value not in self.source_values:
                raise ValueError(f"Unknown data source reference: {value!r}")
            return self.source_values[value]
        raise ValueError(f"Unexpected token: {value!r}")


def evaluate_formula(expression: str, source_values: dict[str, Decimal]) -> Decimal:
    """Evaluate a safe arithmetic expression using only provided source values.

    Args:
        expression: The formula string (e.g. "income_source_count + active_expense_count")
        source_values: Mapping from data source key to Decimal value.

    Returns:
        The computed Decimal result.

    Raises:
        ValueError: If the expression contains invalid tokens or references.
        ZeroDivisionError: If division by zero occurs.
    """
    tokens = list(_tokenize(expression))
    if not tokens:
        raise ValueError("Empty formula expression")
    parser = _Parser(tokens, source_values)
    return parser.parse()

from pathlib import Path
import re

TEST_DIR = Path("/home/ubuntu/dosh/backend/tests")


def get_budget_expr_for_line(lines, line_idx):
    func_start = 0
    for i in range(line_idx, -1, -1):
        if lines[i].strip().startswith("def "):
            func_start = i
            break

    func_def = lines[func_start]
    func_body = "".join(lines[func_start:line_idx + 1])

    if "budgetid" in func_def:
        return "{budgetid}"
    if re.search(r"\bbudgetid\s*=", func_body):
        return "{budgetid}"
    if re.search(r"\bbudget\s*=", func_body) or 'setup["budget"]' in func_body:
        return "{budget.budgetid}"
    return "{1}"


def process_file(path: Path):
    content = path.read_text()
    lines = content.splitlines(keepends=True)

    # Pass 1: replace /api/periods/budget/{expr} and /api/periods/budget/{expr}/summary
    new_lines = []
    for line in lines:
        if "/api/periods/budget/" not in line:
            new_lines.append(line)
            continue

        # f"/api/periods/budget/{budget.budgetid}/summary"
        line = re.sub(
            r'f"/api/periods/budget/(\{[^}]+\})/summary"',
            r'f"/api/budgets/\1/periods/summary"',
            line,
        )
        # f"/api/periods/budget/{budget.budgetid}"
        line = re.sub(
            r'f"/api/periods/budget/(\{[^}]+\})"',
            r'f"/api/budgets/\1/periods"',
            line,
        )
        # "/api/periods/budget/123" (unlikely but handle)
        line = re.sub(
            r'"/api/periods/budget/(\d+)"',
            r'"/api/budgets/\1/periods"',
            line,
        )
        new_lines.append(line)
    lines = new_lines

    # Pass 2: replace remaining /api/periods/ references
    new_lines = []
    for i, line in enumerate(lines):
        if "/api/periods" not in line:
            new_lines.append(line)
            continue

        budget_expr = get_budget_expr_for_line(lines, i)

        # f-strings with double quotes
        if 'f"' in line:
            line = re.sub(
                r'f"/api/periods/',
                f'f"/api/budgets/{budget_expr}/periods/',
                line,
            )
        # f-strings with single quotes
        if "f'" in line:
            line = re.sub(
                r"f'/api/periods/",
                f"f'/api/budgets/{budget_expr}/periods/",
                line,
            )

        # plain strings without f prefix - add f prefix and budget expr
        # But only if they haven't already been processed above
        if 'f"' not in line and 'f\'' not in line:
            line = re.sub(
                r'(?<!f)"/api/periods/([^"]+)"',
                f'f"/api/budgets/{budget_expr}/periods/\\1"',
                line,
            )
            line = re.sub(
                r"(?<!f)'/api/periods/([^']+)'",
                f"f'/api/budgets/{budget_expr}/periods/\\1'",
                line,
            )

        new_lines.append(line)

    path.write_text("".join(new_lines))
    print(f"Updated {path.name}")


if __name__ == "__main__":
    for f in sorted(TEST_DIR.glob("test_*.py")):
        process_file(f)
    process_file(TEST_DIR / "factories.py")

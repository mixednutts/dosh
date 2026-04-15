from pathlib import Path
import re

TEST_DIR = Path("/home/ubuntu/dosh/backend/tests")


def budgetid_is_local(lines, line_idx):
    func_start = 0
    for i in range(line_idx, -1, -1):
        if lines[i].strip().startswith("def "):
            func_start = i
            break
    func_body = "".join(lines[func_start:line_idx + 1])
    return bool(re.search(r"\bbudgetid\s*\=", func_body))


for f in sorted(TEST_DIR.glob("*.py")):
    lines = f.read_text().splitlines(keepends=True)
    for i, line in enumerate(lines):
        if "/api/budgets/{budgetid}" in line and not budgetid_is_local(lines, i):
            print(f"{f.name}:{i+1}  {line.strip()}")

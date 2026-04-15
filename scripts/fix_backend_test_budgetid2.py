from pathlib import Path
import re

TEST_DIR = Path("/home/ubuntu/dosh/backend/tests")


def fix_file(path: Path):
    text = path.read_text()

    # Split into top header + function blocks.
    # We split on lines that start with "def ".
    lines = text.splitlines(keepends=True)
    blocks = []
    current = []
    for line in lines:
        if line.startswith("def ") and current:
            blocks.append("".join(current))
            current = [line]
        else:
            current.append(line)
    if current:
        blocks.append("".join(current))

    out = []
    for block in blocks:
        has_local_budgetid = bool(re.search(r"\bbudgetid\s*\=", block))
        if not has_local_budgetid:
            block = block.replace("{budgetid}", "{budget.budgetid}")
        out.append(block)

    path.write_text("".join(out))
    print(f"Fixed {path.name}")


if __name__ == "__main__":
    for f in sorted(TEST_DIR.glob("test_*.py")):
        fix_file(f)

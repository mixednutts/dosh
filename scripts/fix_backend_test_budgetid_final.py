from pathlib import Path
import re

TEST_DIR = Path("/home/ubuntu/dosh/backend/tests")


def has_local_budgetid_var(block: str) -> bool:
    # A real variable assignment: line starts with budgetid = ... and does NOT end with a comma
    # (to exclude keyword arguments like budgetid=budget.budgetid, inside calls)
    for line in block.splitlines():
        m = re.match(r'^\s*budgetid\s*=(.*)', line)
        if m:
            rest = m.group(1).strip()
            if rest and not rest.endswith(','):
                return True
    return False


def fix_file(path: Path):
    text = path.read_text()
    lines = text.splitlines(keepends=True)

    blocks = []
    current = []
    for line in lines:
        if line.startswith("def ") and current:
            blocks.append(current)
            current = [line]
        else:
            current.append(line)
    if current:
        blocks.append(current)

    out = []
    for block_lines in blocks:
        block_text = "".join(block_lines)
        if not has_local_budgetid_var(block_text):
            block_text = block_text.replace("{budgetid}", "{budget.budgetid}")
        out.append(block_text)

    path.write_text("".join(out))
    print(f"Fixed {path.name}")


if __name__ == "__main__":
    for f in sorted(TEST_DIR.glob("test_*.py")):
        fix_file(f)

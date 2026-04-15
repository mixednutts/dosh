from pathlib import Path
import re

TEST_DIR = Path("/home/ubuntu/dosh/backend/tests")


def fix_file(path: Path):
    text = path.read_text()
    lines = text.splitlines(keepends=True)

    # partition into function blocks
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

    new_blocks = []
    for block in blocks:
        block_text = "".join(block)
        has_local_budgetid = bool(re.search(r"\bbudgetid\s*\=", block_text))
        if has_local_budgetid:
            block_text = block_text.replace("{budget.budgetid}", "{budgetid}")
        new_blocks.append(block_text)

    path.write_text("".join(new_blocks))
    print(f"Fixed {path.name}")


if __name__ == "__main__":
    for f in sorted(TEST_DIR.glob("test_*.py")):
        fix_file(f)

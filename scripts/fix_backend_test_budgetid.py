from pathlib import Path
import re

TEST_DIR = Path("/home/ubuntu/dosh/backend/tests")


def fix_file(path: Path):
    lines = path.read_text().splitlines(keepends=True)

    # partition by function
    func_ranges = []
    start = 0
    for i, line in enumerate(lines):
        if i == 0:
            continue
        if line.startswith("def "):
            func_ranges.append((start, i))
            start = i
    func_ranges.append((start, len(lines)))

    new_lines = []
    for start, end in func_ranges:
        block = lines[start:end]
        block_text = "".join(block)

        # does this block assign budgetid locally?
        has_local_budgetid = bool(re.search(r"\bbudgetid\s*\=", block_text))

        if not has_local_budgetid and "{budgetid}" in block_text:
            # try to determine which expression to use
            if 'budget = setup["budget"]' in block_text or "budget = setup['budget']" in block_text:
                for i, line in enumerate(block):
                    if "{budgetid}" in line and "{budget.budgetid}" not in line:
                        block[i] = line.replace("{budgetid}", "{budget.budgetid}")
            elif "setup[\"budget\"]" in block_text:
                for i, line in enumerate(block):
                    if "{budgetid}" in line and "{setup['budget'].budgetid}" not in line:
                        block[i] = line.replace("{budgetid}", "{setup['budget'].budgetid}")
            elif "setup['budget']" in block_text:
                for i, line in enumerate(block):
                    if "{budgetid}" in line and "{setup['budget'].budgetid}" not in line:
                        block[i] = line.replace("{budgetid}", "{setup['budget'].budgetid}")
            elif "budget" in block_text and re.search(r"\bbudget\s*=\s*", block_text):
                for i, line in enumerate(block):
                    if "{budgetid}" in line and "{budget.budgetid}" not in line:
                        block[i] = line.replace("{budgetid}", "{budget.budgetid}")
            else:
                # fallback: just replace with {1} — but this shouldn't happen often
                # Actually many functions have `budget` variable or `setup` dict.
                pass

        new_lines.extend(block)

    path.write_text("".join(new_lines))
    print(f"Fixed {path.name}")


if __name__ == "__main__":
    for f in sorted(TEST_DIR.glob("test_*.py")):
        fix_file(f)

from pathlib import Path
import re

path = Path("/home/ubuntu/dosh/backend/app/routers/periods.py")
text = path.read_text()

# Find every public route function (preceded by @router.) that lacks budgetid in its signature
lines = text.splitlines(keepends=True)
out = []
prev_is_router = False
for line in lines:
    if prev_is_router and line.startswith("def "):
        m = re.match(r'def ([A-Za-z_]\w*)\((.*?)\):', line)
        if m:
            func_name = m.group(1)
            params = m.group(2)
            if not func_name.startswith("_") and "budgetid" not in params:
                line = f"def {func_name}(budgetid: int, {params}):\n"
    prev_is_router = line.strip().startswith("@router.")
    out.append(line)

path.write_text("".join(out))
print("Fixed missing budgetid params in periods.py")

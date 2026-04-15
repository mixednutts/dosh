from pathlib import Path
import re

BASE = Path("/home/ubuntu/dosh/backend/app/routers")

# ── periods.py ───────────────────────────────────────────────────────────────
path = BASE / "periods.py"
lines = path.read_text().splitlines(keepends=True)

new_lines = []
i = 0
while i < len(lines):
    line = lines[i]

    if 'router = APIRouter(prefix="/periods"' in line:
        line = line.replace('prefix="/periods"', 'prefix="/budgets/{budgetid}/periods"')

    if '@router.get("/budget/{budgetid}"' in line:
        line = line.replace('@router.get("/budget/{budgetid}"', '@router.get(""')
    if '@router.get("/budget/{budgetid}/summary"' in line:
        line = line.replace('@router.get("/budget/{budgetid}/summary"', '@router.get("/summary"')

    if line.startswith("def _get_period_or_404(finperiodid: int, db: Session)"):
        line = "def _get_period_or_404(finperiodid: int, budgetid: int, db: Session) -> FinancialPeriod:\n"
        new_lines.append(line)
        i += 1  # p = db.get...
        new_lines.append(lines[i])
        i += 1  # if not p:
        new_lines.append(lines[i])
        i += 1  # raise HTTPException...
        new_lines.append(lines[i])
        i += 1  # return p
        new_lines.append("    if p.budgetid != budgetid:\n")
        new_lines.append('        raise HTTPException(404, "Period not found")\n')
        new_lines.append(lines[i])
        i += 1
        continue

    if '_get_period_or_404(finperiodid, db)' in line:
        line = line.replace('_get_period_or_404(finperiodid, db)', '_get_period_or_404(finperiodid, budgetid, db)')

    new_lines.append(line)
    i += 1

content = "".join(new_lines)
lines2 = content.splitlines(keepends=True)
out2 = []
prev_is_router = False
for line in lines2:
    if prev_is_router and line.startswith("def "):
        m = re.match(r'def ([A-Za-z_]\w*)\((.*)\):', line)
        if m:
            func_name = m.group(1)
            params = m.group(2)
            if not func_name.startswith("_") and 'budgetid' not in params:
                line = f"def {func_name}(budgetid: int, {params}):\n"
    prev_is_router = line.strip().startswith("@router.")
    out2.append(line)
content = "".join(out2)

parts = content.split("def generate_period(")
if len(parts) == 2:
    header = parts[0]
    rest = parts[1]
    next_def = re.search(r'\ndef [A-Za-z_]', rest)
    if next_def:
        gen_body = rest[:next_def.start()]
        after = rest[next_def.start():]
        gen_body = gen_body.replace("payload.budgetid", "budgetid")
        content = header + "def generate_period(" + gen_body + after
    else:
        content = header + "def generate_period(" + rest.replace("payload.budgetid", "budgetid")

path.write_text(content)
print("Updated periods.py")

# ── period_transactions.py ───────────────────────────────────────────────────
path = BASE / "period_transactions.py"
content = path.read_text()
content = content.replace('router = APIRouter(prefix="/periods"', 'router = APIRouter(prefix="/budgets/{budgetid}/periods"')
old_helper = '''def _get_period_or_404(finperiodid: int, db: Session) -> FinancialPeriod:
    period = db.get(FinancialPeriod, finperiodid)
    if not period:
        raise HTTPException(404, "Period not found")
    return period'''
new_helper = '''def _get_period_or_404(finperiodid: int, budgetid: int, db: Session) -> FinancialPeriod:
    period = db.get(FinancialPeriod, finperiodid)
    if not period or period.budgetid != budgetid:
        raise HTTPException(404, "Period not found")
    return period'''
content = content.replace(old_helper, new_helper)
content = content.replace("_get_period_or_404(finperiodid, db)", "_get_period_or_404(finperiodid, budgetid, db)")
lines = content.splitlines(keepends=True)
out = []
prev_is_router = False
for line in lines:
    if prev_is_router and line.startswith("def "):
        m = re.match(r'def ([A-Za-z_]\w*)\((.*)\):', line)
        if m and 'budgetid' not in m.group(2):
            line = f"def {m.group(1)}(budgetid: int, {m.group(2)}):\n"
    prev_is_router = line.strip().startswith("@router.")
    out.append(line)
path.write_text("".join(out))
print("Updated period_transactions.py")

# ── balance_types.py ─────────────────────────────────────────────────────────
path = BASE / "balance_types.py"
content = path.read_text()
content = content.replace('period_router = APIRouter(prefix="/periods"', 'period_router = APIRouter(prefix="/budgets/{budgetid}/periods"')
old_list = '''@period_router.get("/{finperiodid}/balances", response_model=list[PeriodBalanceOut], responses=error_responses(404))
def list_period_balances(finperiodid: int, db: DbSession):
    period = db.get(FinancialPeriod, finperiodid)
    if not period:
        raise HTTPException(404, "Period not found")'''
new_list = '''@period_router.get("/{finperiodid}/balances", response_model=list[PeriodBalanceOut], responses=error_responses(404))
def list_period_balances(budgetid: int, finperiodid: int, db: DbSession):
    period = db.get(FinancialPeriod, finperiodid)
    if not period or period.budgetid != budgetid:
        raise HTTPException(404, "Period not found")'''
content = content.replace(old_list, new_list)

old_patch = '''@period_router.patch("/{finperiodid}/balances/{balancedesc}", response_model=PeriodBalanceOut, responses=error_responses(405))
def update_period_balance(
    finperiodid: int,
    balancedesc: str,
    payload: PeriodBalanceUpdate,
    db: DbSession,
):'''
new_patch = '''@period_router.patch("/{finperiodid}/balances/{balancedesc}", response_model=PeriodBalanceOut, responses=error_responses(405))
def update_period_balance(
    budgetid: int,
    finperiodid: int,
    balancedesc: str,
    payload: PeriodBalanceUpdate,
    db: DbSession,
):'''
content = content.replace(old_patch, new_patch)
old_body = '''def update_period_balance(
    budgetid: int,
    finperiodid: int,
    balancedesc: str,
    payload: PeriodBalanceUpdate,
    db: DbSession,
):
    raise HTTPException(405, "Period balance movement is calculated from transactions and cannot be edited directly")'''
new_body = '''def update_period_balance(
    budgetid: int,
    finperiodid: int,
    balancedesc: str,
    payload: PeriodBalanceUpdate,
    db: DbSession,
):
    period = db.get(FinancialPeriod, finperiodid)
    if not period or period.budgetid != budgetid:
        raise HTTPException(404, "Period not found")
    raise HTTPException(405, "Period balance movement is calculated from transactions and cannot be edited directly")'''
content = content.replace(old_body, new_body)
path.write_text(content)
print("Updated balance_types.py")

# ── expense_entries.py ───────────────────────────────────────────────────────
path = BASE / "expense_entries.py"
content = path.read_text()
content = content.replace(
    'router = APIRouter(prefix="/periods/{finperiodid}/expenses/{expensedesc}/entries"',
    'router = APIRouter(prefix="/budgets/{budgetid}/periods/{finperiodid}/expenses/{expensedesc}/entries"'
)
old_helper = '''def _get_period_expense(finperiodid: int, expensedesc: str, db: Session) -> PeriodExpense:
    pe = (
        db.query(PeriodExpense)
        .filter(
            PeriodExpense.finperiodid == finperiodid,
            PeriodExpense.expensedesc == expensedesc,
        )
        .first()
    )
    if not pe:
        raise HTTPException(404, "Expense line item not found in this period")
    return pe'''
new_helper = '''def _get_period_expense(finperiodid: int, expensedesc: str, budgetid: int, db: Session) -> PeriodExpense:
    pe = (
        db.query(PeriodExpense)
        .filter(
            PeriodExpense.finperiodid == finperiodid,
            PeriodExpense.expensedesc == expensedesc,
        )
        .first()
    )
    if not pe or pe.budgetid != budgetid:
        raise HTTPException(404, "Expense line item not found in this period")
    return pe'''
content = content.replace(old_helper, new_helper)
content = content.replace("_get_period_expense(finperiodid, expensedesc, db)", "_get_period_expense(finperiodid, expensedesc, budgetid, db)")
content = content.replace(
    'def list_entries(finperiodid: int, expensedesc: str, db: DbSession):\n    pe = _get_period_expense(finperiodid, expensedesc, budgetid, db)',
    'def list_entries(budgetid: int, finperiodid: int, expensedesc: str, db: DbSession):\n    pe = _get_period_expense(finperiodid, expensedesc, budgetid, db)'
)
content = content.replace(
    '''def add_entry(
    finperiodid: int,
    expensedesc: str,
    payload: ExpenseEntryCreate,
    db: DbSession,
):
    pe = _get_period_expense(finperiodid, expensedesc, budgetid, db)''',
    '''def add_entry(
    budgetid: int,
    finperiodid: int,
    expensedesc: str,
    payload: ExpenseEntryCreate,
    db: DbSession,
):
    pe = _get_period_expense(finperiodid, expensedesc, budgetid, db)'''
)
content = content.replace(
    '''def delete_entry(
    finperiodid: int,
    expensedesc: str,
    entry_id: int,
    db: DbSession,
):
    pe = _get_period_expense(finperiodid, expensedesc, budgetid, db)''',
    '''def delete_entry(
    budgetid: int,
    finperiodid: int,
    expensedesc: str,
    entry_id: int,
    db: DbSession,
):
    pe = _get_period_expense(finperiodid, expensedesc, budgetid, db)'''
)
path.write_text(content)
print("Updated expense_entries.py")

# ── income_transactions.py ───────────────────────────────────────────────────
path = BASE / "income_transactions.py"
content = path.read_text()
content = content.replace(
    'prefix="/periods/{finperiodid}/income/{incomedesc}/transactions"',
    'prefix="/budgets/{budgetid}/periods/{finperiodid}/income/{incomedesc}/transactions"'
)
old_helper = '''def _get_period_income(finperiodid: int, incomedesc: str, db: Session) -> PeriodIncome:
    pi = db.get(PeriodIncome, (finperiodid, incomedesc))
    if not pi:
        raise HTTPException(404, "Income line item not found in this period")
    return pi'''
new_helper = '''def _get_period_income(finperiodid: int, incomedesc: str, budgetid: int, db: Session) -> PeriodIncome:
    pi = db.get(PeriodIncome, (finperiodid, incomedesc))
    if not pi or pi.budgetid != budgetid:
        raise HTTPException(404, "Income line item not found in this period")
    return pi'''
content = content.replace(old_helper, new_helper)
content = content.replace("_get_period_income(finperiodid, incomedesc, db)", "_get_period_income(finperiodid, incomedesc, budgetid, db)")
lines = content.splitlines(keepends=True)
out = []
prev_is_router = False
for line in lines:
    if prev_is_router and line.startswith("def "):
        m = re.match(r'def ([A-Za-z_]\w*)\((.*)\):', line)
        if m and 'budgetid' not in m.group(2):
            line = f"def {m.group(1)}(budgetid: int, {m.group(2)}):\n"
    prev_is_router = line.strip().startswith("@router.")
    out.append(line)
path.write_text("".join(out))
print("Updated income_transactions.py")

# ── investment_transactions.py ───────────────────────────────────────────────
path = BASE / "investment_transactions.py"
content = path.read_text()
content = content.replace(
    'prefix="/periods/{finperiodid}/investments/{investmentdesc}/transactions"',
    'prefix="/budgets/{budgetid}/periods/{finperiodid}/investments/{investmentdesc}/transactions"'
)
old_helper = '''def _get_period_investment(finperiodid: int, investmentdesc: str, db: Session) -> PeriodInvestment:
    pi = db.get(PeriodInvestment, (finperiodid, investmentdesc))
    if not pi:
        raise HTTPException(404, "Investment line item not found in this period")
    return pi'''
new_helper = '''def _get_period_investment(finperiodid: int, investmentdesc: str, budgetid: int, db: Session) -> PeriodInvestment:
    pi = db.get(PeriodInvestment, (finperiodid, investmentdesc))
    if not pi or pi.budgetid != budgetid:
        raise HTTPException(404, "Investment line item not found in this period")
    return pi'''
content = content.replace(old_helper, new_helper)
content = content.replace("_get_period_investment(finperiodid, investmentdesc, db)", "_get_period_investment(finperiodid, investmentdesc, budgetid, db)")
lines = content.splitlines(keepends=True)
out = []
prev_is_router = False
for line in lines:
    if prev_is_router and line.startswith("def "):
        m = re.match(r'def ([A-Za-z_]\w*)\((.*)\):', line)
        if m and 'budgetid' not in m.group(2):
            line = f"def {m.group(1)}(budgetid: int, {m.group(2)}):\n"
    prev_is_router = line.strip().startswith("@router.")
    out.append(line)
path.write_text("".join(out))
print("Updated investment_transactions.py")

print("Done")

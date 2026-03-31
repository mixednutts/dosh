from sqlalchemy import (
    Boolean, Column, DateTime, ForeignKey, ForeignKeyConstraint, Integer,
    Numeric, String, UniqueConstraint,
)
from sqlalchemy.orm import relationship
from .database import Base


class AppInfo(Base):
    __tablename__ = "appinfo"

    id = Column(Integer, primary_key=True, autoincrement=True)
    versionnum = Column(String, nullable=False)


class Budget(Base):
    __tablename__ = "budgets"

    budgetid = Column(Integer, primary_key=True, autoincrement=True)
    budgetowner = Column(String, nullable=False)
    description = Column(String)
    # Weekly | Fortnightly | Monthly
    budget_frequency = Column(String, nullable=False)

    periods = relationship("FinancialPeriod", back_populates="budget")
    income_types = relationship("IncomeType", back_populates="budget")
    expense_items = relationship("ExpenseItem", back_populates="budget")
    investment_items = relationship("InvestmentItem", back_populates="budget")


class PayType(Base):
    __tablename__ = "paytypes"

    # AUTO | MANUAL
    paytype = Column(String, primary_key=True)


class FinancialPeriod(Base):
    __tablename__ = "financialperiods"

    finperiodid = Column(Integer, primary_key=True, autoincrement=True)
    budgetid = Column(Integer, ForeignKey("budgets.budgetid"), nullable=False)
    startdate = Column(DateTime, nullable=False)
    enddate = Column(DateTime, nullable=False)
    budgetowner = Column(String)
    islocked = Column(Boolean, default=False, nullable=False)

    budget = relationship("Budget", back_populates="periods")
    period_incomes = relationship("PeriodIncome", back_populates="period", cascade="all, delete-orphan")
    period_expenses = relationship("PeriodExpense", back_populates="period", cascade="all, delete-orphan")


class IncomeType(Base):
    __tablename__ = "incometypes"

    budgetid = Column(Integer, ForeignKey("budgets.budgetid"), primary_key=True)
    incomedesc = Column(String, primary_key=True)
    issavings = Column(Boolean, default=False, nullable=False)
    isfixed = Column(Boolean, default=False, nullable=False)
    # auto-set to True when isfixed is True
    autoinclude = Column(Boolean, default=False, nullable=False)
    amount = Column(Numeric(10, 2), default=0)

    budget = relationship("Budget", back_populates="income_types")


class PeriodIncome(Base):
    __tablename__ = "periodincome"

    finperiodid = Column(Integer, ForeignKey("financialperiods.finperiodid"), primary_key=True)
    # FK to incometypes(budgetid, incomedesc) via application logic
    budgetid = Column(Integer, nullable=False)
    incomedesc = Column(String, primary_key=True)
    budgetamount = Column(Numeric(10, 2), default=0)
    actualamount = Column(Numeric(10, 2), default=0)
    varianceamount = Column(Numeric(10, 2), default=0)

    period = relationship("FinancialPeriod", back_populates="period_incomes")


class ExpenseItem(Base):
    __tablename__ = "expenseitems"

    budgetid = Column(Integer, ForeignKey("budgets.budgetid"), primary_key=True)
    expensedesc = Column(String, primary_key=True)
    active = Column(Boolean, default=True, nullable=False)
    # Fixed Day of Month | Days
    freqtype = Column(String)
    # For "Fixed Day of Month": day of month (1-31)
    # For "Days": interval in days (e.g. 30)
    frequency_value = Column(Integer)
    # AUTO | MANUAL
    paytype = Column(String, ForeignKey("paytypes.paytype"))
    revisionnum = Column(Integer, default=0, nullable=False)
    # first due / commencement date
    effectivedate = Column(DateTime)
    expenseamount = Column(Numeric(10, 2), default=0)

    budget = relationship("Budget", back_populates="expense_items")
    period_expenses = relationship("PeriodExpense", back_populates="expense_item")


class PeriodExpense(Base):
    __tablename__ = "periodexpenses"

    finperiodid = Column(Integer, ForeignKey("financialperiods.finperiodid"), primary_key=True)
    budgetid = Column(Integer, primary_key=True)
    expensedesc = Column(String, primary_key=True)
    budgetamount = Column(Numeric(10, 2), default=0)
    actualamount = Column(Numeric(10, 2), default=0)
    varianceamount = Column(Numeric(10, 2), default=0)
    # True = added as a one-off to this period only
    is_oneoff = Column(Boolean, default=False, nullable=False)

    period = relationship("FinancialPeriod", back_populates="period_expenses")
    expense_item = relationship(
        "ExpenseItem",
        primaryjoin="and_(PeriodExpense.budgetid == ExpenseItem.budgetid, "
                    "PeriodExpense.expensedesc == ExpenseItem.expensedesc)",
        foreign_keys="[PeriodExpense.budgetid, PeriodExpense.expensedesc]",
        back_populates="period_expenses",
    )

    __table_args__ = (
        ForeignKeyConstraint(
            ["budgetid", "expensedesc"],
            ["expenseitems.budgetid", "expenseitems.expensedesc"],
        ),
    )


class InvestmentItem(Base):
    __tablename__ = "investmentitems"

    budgetid = Column(Integer, ForeignKey("budgets.budgetid"), primary_key=True)
    investmentdesc = Column(String, primary_key=True)
    active = Column(Boolean, default=True, nullable=False)
    effectivedate = Column(DateTime)
    initial_value = Column(Numeric(10, 2), default=0)

    budget = relationship("Budget", back_populates="investment_items")

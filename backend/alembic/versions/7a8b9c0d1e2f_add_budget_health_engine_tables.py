"""add budget health engine tables

Revision ID: 7a8b9c0d1e2f
Revises: 4bf1bf54b0bb
Create Date: 2026-04-14 01:20:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.orm import Session

# Import seed utilities — uses app models which require the new schema
from app.health_engine_seed import seed_and_migrate  # noqa: E402


# revision identifiers, used by Alembic.
revision: str = '7a8b9c0d1e2f'
down_revision: Union[str, Sequence[str], None] = '4bf1bf54b0bb'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add health_tone to budgets table
    op.add_column('budgets', sa.Column('health_tone', sa.String(), nullable=False, server_default='supportive'))

    # Create health engine tables
    op.create_table('healthdatasources',
        sa.Column('source_key', sa.String(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('version', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('executor_path', sa.String(), nullable=False),
        sa.Column('return_type', sa.String(), nullable=False),
        sa.Column('cache_ttl_seconds', sa.Integer(), nullable=True, server_default='0'),
        sa.PrimaryKeyConstraint('source_key')
    )

    op.create_table('healthscales',
        sa.Column('scale_key', sa.String(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('scale_type', sa.String(), nullable=False),
        sa.Column('min_value', sa.Numeric(), nullable=True),
        sa.Column('max_value', sa.Numeric(), nullable=True),
        sa.Column('step_value', sa.Numeric(), nullable=True),
        sa.Column('unit_label', sa.String(), nullable=True),
        sa.PrimaryKeyConstraint('scale_key')
    )

    op.create_table('healththresholddefinitions',
        sa.Column('threshold_key', sa.String(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('scale_key', sa.String(), nullable=False),
        sa.Column('default_value_json', sa.Text(), nullable=False, server_default='{}'),
        sa.ForeignKeyConstraint(['scale_key'], ['healthscales.scale_key'], ),
        sa.PrimaryKeyConstraint('threshold_key')
    )

    op.create_table('healthmetrictemplates',
        sa.Column('template_key', sa.String(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('scope', sa.String(), nullable=False),
        sa.Column('formula_expression', sa.Text(), nullable=False),
        sa.Column('formula_data_sources_json', sa.Text(), nullable=False),
        sa.Column('default_threshold_key', sa.String(), nullable=True),
        sa.Column('scoring_logic_json', sa.Text(), nullable=False),
        sa.Column('evidence_template_json', sa.Text(), nullable=False),
        sa.Column('drill_down_enabled', sa.Boolean(), nullable=True, server_default='0'),
        sa.Column('is_system', sa.Boolean(), nullable=True, server_default='0'),
        sa.ForeignKeyConstraint(['default_threshold_key'], ['healththresholddefinitions.threshold_key'], ),
        sa.PrimaryKeyConstraint('template_key')
    )

    op.create_table('healthmatrixtemplates',
        sa.Column('template_key', sa.String(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('is_system', sa.Boolean(), nullable=True, server_default='0'),
        sa.PrimaryKeyConstraint('template_key')
    )

    op.create_table('healthmetrics',
        sa.Column('metric_id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('template_key', sa.String(), nullable=True),
        sa.Column('budgetid', sa.Integer(), nullable=True),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('scope', sa.String(), nullable=False),
        sa.Column('formula_expression', sa.Text(), nullable=False),
        sa.Column('formula_data_sources_json', sa.Text(), nullable=False),
        sa.Column('threshold_key', sa.String(), nullable=True),
        sa.Column('scoring_logic_json', sa.Text(), nullable=False),
        sa.Column('evidence_template_json', sa.Text(), nullable=False),
        sa.Column('drill_down_enabled', sa.Boolean(), nullable=True, server_default='0'),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['budgetid'], ['budgets.budgetid'], ),
        sa.ForeignKeyConstraint(['threshold_key'], ['healththresholddefinitions.threshold_key'], ),
        sa.ForeignKeyConstraint(['template_key'], ['healthmetrictemplates.template_key'], ),
        sa.PrimaryKeyConstraint('metric_id')
    )

    op.create_table('healthdatasourceparameters',
        sa.Column('source_key', sa.String(), nullable=False),
        sa.Column('param_name', sa.String(), nullable=False),
        sa.Column('param_type', sa.String(), nullable=False),
        sa.Column('default_value', sa.Text(), nullable=True),
        sa.Column('is_required', sa.Boolean(), nullable=True, server_default='1'),
        sa.ForeignKeyConstraint(['source_key'], ['healthdatasources.source_key'], ),
        sa.PrimaryKeyConstraint('source_key', 'param_name')
    )

    op.create_table('healthscaleoptions',
        sa.Column('scale_key', sa.String(), nullable=False),
        sa.Column('option_value', sa.String(), nullable=False),
        sa.Column('option_label', sa.String(), nullable=False),
        sa.Column('option_order', sa.Integer(), nullable=True, server_default='0'),
        sa.ForeignKeyConstraint(['scale_key'], ['healthscales.scale_key'], ),
        sa.PrimaryKeyConstraint('scale_key', 'option_value')
    )

    op.create_table('healthmatrixtemplateitems',
        sa.Column('template_key', sa.String(), nullable=False),
        sa.Column('metric_template_key', sa.String(), nullable=False),
        sa.Column('weight', sa.Numeric(precision=5, scale=4), nullable=False),
        sa.Column('display_order', sa.Integer(), nullable=True, server_default='0'),
        sa.ForeignKeyConstraint(['metric_template_key'], ['healthmetrictemplates.template_key'], ),
        sa.ForeignKeyConstraint(['template_key'], ['healthmatrixtemplates.template_key'], ),
        sa.PrimaryKeyConstraint('template_key', 'metric_template_key')
    )

    op.create_table('budgethealthmatrices',
        sa.Column('matrix_id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('budgetid', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('based_on_template_key', sa.String(), nullable=True),
        sa.Column('cloned_from_matrix_id', sa.Integer(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=True, server_default='1'),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['based_on_template_key'], ['healthmatrixtemplates.template_key'], ),
        sa.ForeignKeyConstraint(['budgetid'], ['budgets.budgetid'], ),
        sa.ForeignKeyConstraint(['cloned_from_matrix_id'], ['budgethealthmatrices.matrix_id'], ),
        sa.PrimaryKeyConstraint('matrix_id'),
        sa.UniqueConstraint('budgetid')
    )

    op.create_table('budgethealthmatrixitems',
        sa.Column('matrix_id', sa.Integer(), nullable=False),
        sa.Column('metric_id', sa.Integer(), nullable=False),
        sa.Column('weight', sa.Numeric(precision=5, scale=4), nullable=False),
        sa.Column('scoring_sensitivity', sa.Integer(), nullable=False, server_default='50'),
        sa.Column('display_order', sa.Integer(), nullable=True, server_default='0'),
        sa.Column('is_enabled', sa.Boolean(), nullable=True, server_default='1'),
        sa.ForeignKeyConstraint(['matrix_id'], ['budgethealthmatrices.matrix_id'], ),
        sa.ForeignKeyConstraint(['metric_id'], ['healthmetrics.metric_id'], ),
        sa.PrimaryKeyConstraint('matrix_id', 'metric_id')
    )

    op.create_table('budgethealthsummaries',
        sa.Column('budgetid', sa.Integer(), nullable=False),
        sa.Column('matrix_id', sa.Integer(), nullable=False),
        sa.Column('evaluated_at', sa.DateTime(), nullable=True),
        sa.Column('overall_score', sa.Integer(), nullable=False),
        sa.Column('overall_status', sa.String(), nullable=False),
        sa.Column('momentum_status', sa.String(), nullable=False),
        sa.Column('momentum_delta', sa.Integer(), nullable=True, server_default='0'),
        sa.Column('metric_results_json', sa.Text(), nullable=False, server_default='[]'),
        sa.ForeignKeyConstraint(['budgetid'], ['budgets.budgetid'], ),
        sa.ForeignKeyConstraint(['matrix_id'], ['budgethealthmatrices.matrix_id'], ),
        sa.PrimaryKeyConstraint('budgetid')
    )

    op.create_table('budgetmetricthresholds',
        sa.Column('budgetid', sa.Integer(), nullable=False),
        sa.Column('metric_id', sa.Integer(), nullable=False),
        sa.Column('threshold_key', sa.String(), nullable=False),
        sa.Column('value_json', sa.Text(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['budgetid'], ['budgets.budgetid'], ),
        sa.ForeignKeyConstraint(['metric_id'], ['healthmetrics.metric_id'], ),
        sa.ForeignKeyConstraint(['threshold_key'], ['healththresholddefinitions.threshold_key'], ),
        sa.PrimaryKeyConstraint('budgetid', 'metric_id')
    )

    op.create_table('periodhealthresults',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('finperiodid', sa.Integer(), nullable=False),
        sa.Column('matrix_id', sa.Integer(), nullable=False),
        sa.Column('metric_id', sa.Integer(), nullable=False),
        sa.Column('evaluated_at', sa.DateTime(), nullable=True),
        sa.Column('score', sa.Integer(), nullable=False),
        sa.Column('status', sa.String(), nullable=False),
        sa.Column('summary', sa.Text(), nullable=False),
        sa.Column('evidence_json', sa.Text(), nullable=False, server_default='[]'),
        sa.Column('drill_down_json', sa.Text(), nullable=True),
        sa.Column('is_snapshot', sa.Boolean(), nullable=True, server_default='0'),
        sa.ForeignKeyConstraint(['finperiodid'], ['financialperiods.finperiodid'], ),
        sa.ForeignKeyConstraint(['matrix_id'], ['budgethealthmatrices.matrix_id'], ),
        sa.ForeignKeyConstraint(['metric_id'], ['healthmetrics.metric_id'], ),
        sa.PrimaryKeyConstraint('id')
    )

    # Seed catalogs and migrate existing budgets
    bind = op.get_bind()
    session = Session(bind=bind)
    seed_and_migrate(session)
    session.commit()


def downgrade() -> None:
    # Drop tables in reverse order of creation
    op.drop_table('periodhealthresults')
    op.drop_table('budgetmetricthresholds')
    op.drop_table('budgethealthsummaries')
    op.drop_table('budgethealthmatrixitems')
    op.drop_table('budgethealthmatrices')
    op.drop_table('healthmatrixtemplateitems')
    op.drop_table('healthscaleoptions')
    op.drop_table('healthdatasourceparameters')
    op.drop_table('healthmetrics')
    op.drop_table('healthmatrixtemplates')
    op.drop_table('healthmetrictemplates')
    op.drop_table('healththresholddefinitions')
    op.drop_table('healthscales')
    op.drop_table('healthdatasources')
    
    # Remove health_tone column from budgets
    op.drop_column('budgets', 'health_tone')

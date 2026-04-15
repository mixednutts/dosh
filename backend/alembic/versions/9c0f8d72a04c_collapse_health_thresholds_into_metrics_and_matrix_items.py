"""collapse health thresholds into metrics and matrix items

Revision ID: 9c0f8d72a04c
Revises: a1b2c3d4e5f6
Create Date: 2026-04-15 12:27:21.550404

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.orm import Session

# revision identifiers, used by Alembic.
revision: str = '9c0f8d72a04c'
down_revision: Union[str, Sequence[str], None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add new columns to healthmetrictemplates (batch for SQLite)
    with op.batch_alter_table('healthmetrictemplates') as batch_op:
        batch_op.add_column(sa.Column('scale_key', sa.String(), nullable=True))
        batch_op.add_column(sa.Column('default_value_json', sa.Text(), nullable=False, server_default='{}'))
        batch_op.create_foreign_key('fk_healthmetrictemplates_scale_key_healthscales', 'healthscales', ['scale_key'], ['scale_key'])

    # 2. Add new columns to healthmetrics (batch for SQLite)
    with op.batch_alter_table('healthmetrics') as batch_op:
        batch_op.add_column(sa.Column('scale_key', sa.String(), nullable=True))
        batch_op.add_column(sa.Column('default_value_json', sa.Text(), nullable=False, server_default='{}'))
        batch_op.create_foreign_key('fk_healthmetrics_scale_key_healthscales', 'healthscales', ['scale_key'], ['scale_key'])

    # 3. Add threshold_value_json to budgethealthmatrixitems
    with op.batch_alter_table('budgethealthmatrixitems') as batch_op:
        batch_op.add_column(sa.Column('threshold_value_json', sa.Text(), nullable=True))

    # 4. Migrate data: copy scale/default from threshold definitions into templates and metrics
    bind = op.get_bind()
    session = Session(bind=bind)

    # Map threshold_key -> scale_key, default_value_json
    rows = session.execute(sa.text('SELECT threshold_key, scale_key, default_value_json FROM healththresholddefinitions')).fetchall()
    for row in rows:
        session.execute(
            sa.text('UPDATE healthmetrictemplates SET scale_key = :sc, default_value_json = :dv WHERE default_threshold_key = :tk'),
            {'sc': row.scale_key, 'dv': row.default_value_json, 'tk': row.threshold_key}
        )
        session.execute(
            sa.text('UPDATE healthmetrics SET scale_key = :sc, default_value_json = :dv WHERE threshold_key = :tk'),
            {'sc': row.scale_key, 'dv': row.default_value_json, 'tk': row.threshold_key}
        )

    # 5. Migrate existing budgetmetricthresholds into budgethealthmatrixitems
    threshold_rows = session.execute(
        sa.text('SELECT budgetid, metric_id, value_json FROM budgetmetricthresholds')
    ).fetchall()
    for tr in threshold_rows:
        # Find matrix_id for this budget
        matrix = session.execute(
            sa.text('SELECT matrix_id FROM budgethealthmatrices WHERE budgetid = :bid AND is_active = 1'),
            {'bid': tr.budgetid}
        ).fetchone()
        if matrix:
            session.execute(
                sa.text('UPDATE budgethealthmatrixitems SET threshold_value_json = :vj WHERE matrix_id = :mid AND metric_id = :mid2'),
                {'vj': tr.value_json, 'mid': matrix.matrix_id, 'mid2': tr.metric_id}
            )

    session.commit()

    # 6. Drop old columns and tables (batch for SQLite)
    with op.batch_alter_table('healthmetrictemplates') as batch_op:
        batch_op.drop_column('default_threshold_key')

    with op.batch_alter_table('healthmetrics') as batch_op:
        batch_op.drop_column('threshold_key')

    op.drop_table('budgetmetricthresholds')
    op.drop_table('healththresholddefinitions')


def downgrade() -> None:
    # Recreate healththresholddefinitions
    op.create_table('healththresholddefinitions',
        sa.Column('threshold_key', sa.String(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('scale_key', sa.String(), nullable=False),
        sa.Column('default_value_json', sa.Text(), nullable=False, server_default='{}'),
        sa.ForeignKeyConstraint(['scale_key'], ['healthscales.scale_key']),
        sa.PrimaryKeyConstraint('threshold_key')
    )

    # Restore default_threshold_key on templates
    with op.batch_alter_table('healthmetrictemplates') as batch_op:
        batch_op.add_column(sa.Column('default_threshold_key', sa.String(), nullable=True))
        batch_op.create_foreign_key('fk_healthmetrictemplates_default_threshold_key_healththresholddefinitions', 'healththresholddefinitions', ['default_threshold_key'], ['threshold_key'])

    # Restore threshold_key on metrics
    with op.batch_alter_table('healthmetrics') as batch_op:
        batch_op.add_column(sa.Column('threshold_key', sa.String(), nullable=True))
        batch_op.create_foreign_key('fk_healthmetrics_threshold_key_healththresholddefinitions', 'healththresholddefinitions', ['threshold_key'], ['threshold_key'])

    # Recreate budgetmetricthresholds
    op.create_table('budgetmetricthresholds',
        sa.Column('budgetid', sa.Integer(), nullable=False),
        sa.Column('metric_id', sa.Integer(), nullable=False),
        sa.Column('threshold_key', sa.String(), nullable=False),
        sa.Column('value_json', sa.Text(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['budgetid'], ['budgets.budgetid']),
        sa.ForeignKeyConstraint(['metric_id'], ['healthmetrics.metric_id']),
        sa.ForeignKeyConstraint(['threshold_key'], ['healththresholddefinitions.threshold_key']),
        sa.PrimaryKeyConstraint('budgetid', 'metric_id')
    )

    # Drop new columns
    with op.batch_alter_table('budgethealthmatrixitems') as batch_op:
        batch_op.drop_column('threshold_value_json')

    with op.batch_alter_table('healthmetrics') as batch_op:
        batch_op.drop_constraint('fk_healthmetrics_scale_key_healthscales', type_='foreignkey')
        batch_op.drop_column('default_value_json')
        batch_op.drop_column('scale_key')

    with op.batch_alter_table('healthmetrictemplates') as batch_op:
        batch_op.drop_constraint('fk_healthmetrictemplates_scale_key_healthscales', type_='foreignkey')
        batch_op.drop_column('default_value_json')
        batch_op.drop_column('scale_key')

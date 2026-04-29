"""recalculate cargo freight shares

Revision ID: b9c0d1e2f3a4
Revises: a8b9c0d1e2f3
Create Date: 2026-04-29
"""

from typing import Sequence, Union

from alembic import op


revision: str = "b9c0d1e2f3a4"
down_revision: Union[str, None] = "a8b9c0d1e2f3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        WITH booking_base AS (
            SELECT
                b.id,
                upper(coalesce(b.mode, '')) AS mode,
                coalesce(
                    b.sell_freight_cost,
                    CASE
                        WHEN b.freight_cost IS NOT NULL
                        THEN b.freight_cost * (1 + coalesce(b.markup_pct, 0) / 100)
                        ELSE NULL
                    END
                ) AS sell_freight,
                coalesce(
                    b.max_cbm,
                    CASE b.container_size
                        WHEN '20GP' THEN 28::numeric
                        WHEN '40GP' THEN 57::numeric
                        WHEN '40HQ' THEN 72::numeric
                        ELSE NULL
                    END
                ) AS capacity_cbm,
                CASE b.container_size
                    WHEN '20GP' THEN acr.sell_20gp
                    WHEN '40GP' THEN acr.sell_40ft
                    WHEN '40HQ' THEN acr.sell_40hq
                    ELSE NULL
                END AS fcl_sell
            FROM bookings b
            LEFT JOIN agent_carrier_rates acr ON acr.id = b.agent_carrier_rate_id
        ),
        line_totals AS (
            SELECT
                booking_id,
                sum(coalesce(cbm, 0)) AS total_cbm,
                count(*) AS line_count,
                sum(CASE WHEN is_full_container_client THEN 1 ELSE 0 END) AS full_count
            FROM booking_cargo_lines
            GROUP BY booking_id
        ),
        lcl_base AS (
            SELECT
                bb.*,
                lt.total_cbm,
                lt.line_count,
                lt.full_count,
                CASE
                    WHEN bb.fcl_sell IS NOT NULL
                        AND bb.capacity_cbm IS NOT NULL
                        AND bb.capacity_cbm > 0
                        AND bb.sell_freight >= bb.fcl_sell
                    THEN bb.fcl_sell / bb.capacity_cbm
                    ELSE bb.sell_freight
                END AS lcl_sell_per_cbm
            FROM booking_base bb
            JOIN line_totals lt ON lt.booking_id = bb.id
        ),
        calc AS (
            SELECT
                cl.id,
                CASE
                    WHEN lb.sell_freight IS NULL THEN NULL
                    WHEN lb.mode = 'AIR' THEN round(
                        lb.sell_freight * coalesce(cl.chargeable_weight_kg, cl.gross_weight_kg, 0),
                        2
                    )
                    WHEN lb.mode = 'LCL' AND lb.total_cbm > 0 AND coalesce(cl.cbm, 0) > 0 THEN round(
                        (
                            CASE
                                WHEN lb.fcl_sell IS NOT NULL
                                THEN least(lb.lcl_sell_per_cbm * lb.total_cbm, lb.fcl_sell)
                                ELSE lb.lcl_sell_per_cbm * lb.total_cbm
                            END
                        ) * cl.cbm / lb.total_cbm,
                        2
                    )
                    WHEN lb.mode = 'LCL' THEN 0::numeric
                    WHEN lb.mode = 'FCL' AND lb.full_count > 0 THEN
                        CASE WHEN cl.is_full_container_client THEN lb.sell_freight ELSE 0::numeric END
                    WHEN lb.mode = 'FCL'
                        AND lb.total_cbm > 0
                        AND coalesce(cl.cbm, 0) > 0
                        AND lb.capacity_cbm IS NOT NULL
                        AND lb.capacity_cbm > 0
                    THEN round(lb.sell_freight * cl.cbm / greatest(lb.capacity_cbm, lb.total_cbm), 2)
                    WHEN lb.mode = 'FCL' AND lb.total_cbm > 0 AND coalesce(cl.cbm, 0) > 0 THEN round(
                        lb.sell_freight * cl.cbm / lb.total_cbm,
                        2
                    )
                    WHEN lb.line_count > 0 THEN round(lb.sell_freight / lb.line_count, 2)
                    ELSE NULL
                END AS new_freight_share
            FROM booking_cargo_lines cl
            JOIN lcl_base lb ON lb.id = cl.booking_id
        )
        UPDATE booking_cargo_lines cl
        SET freight_share = calc.new_freight_share
        FROM calc
        WHERE calc.id = cl.id
        """
    )


def downgrade() -> None:
    pass

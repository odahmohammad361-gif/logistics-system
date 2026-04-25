#!/usr/bin/env python3
"""Insert five sample shipping agents with carrier-line prices.

Safe to run multiple times: existing agents are skipped by name.

Run from backend/ locally:
    python scripts/seed_shipping_agent_samples.py

Run inside Docker:
    docker exec logistics_backend python scripts/seed_shipping_agent_samples.py
"""
import os
import sys
from datetime import date, timedelta
from decimal import Decimal

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal
from app.models.company_warehouse import CompanyWarehouse
from app.models.shipping_agent import AgentCarrierRate, ShippingAgent


TODAY = date.today()
EXPIRY = TODAY + timedelta(days=7)
SEALING = TODAY + timedelta(days=5)
VESSEL = TODAY + timedelta(days=8)


def money(value: int | float | str) -> Decimal:
    return Decimal(str(value)).quantize(Decimal("0.01"))


SAMPLES = [
    {
        "agent": dict(
            name="Guangzhou Silk Route Logistics",
            name_ar="لوجستيات طريق الحرير غوانغجو",
            country="China",
            contact_person="Kevin Zhou",
            phone="+8613822201101",
            whatsapp="+8613822201101",
            wechat_id="silkroute_gz",
            email="ops@gz-silkroute.cn",
            warehouse_city="Guangzhou",
            warehouse_address="Shahe Textile Market, Tianhe District",
            serves_sea=True,
            serves_air=False,
            transit_sea_days=24,
            offer_valid_from=TODAY,
            offer_valid_to=EXPIRY,
            notes="Sample sea agent with FCL and LCL rates.",
        ),
        "warehouse_city": "Guangzhou",
        "rates": [
            ("CMA CGM", "Nansha, Guangzhou", "Aqaba, Jordan", 1120, 1400, 1780, 2225, 1980, 2475, 38, 48, 35, 44, 33, 42, 24),
            ("PIL", "Shekou, Shenzhen", "Aqaba, Jordan", 1080, 1350, 1720, 2150, 1920, 2400, 37, 46, 34, 43, 32, 40, 23),
        ],
    },
    {
        "agent": dict(
            name="Shenzhen Blue Harbor Freight",
            name_ar="شحن الميناء الأزرق شنتشن",
            country="China",
            contact_person="Amy Lin",
            phone="+8618677002202",
            whatsapp="+8618677002202",
            wechat_id="blueharbor_sz",
            email="amy@blueharborfreight.cn",
            warehouse_city="Shenzhen",
            warehouse_address="Longhua District, Shenzhen",
            serves_sea=True,
            serves_air=True,
            transit_sea_days=22,
            transit_air_days=5,
            price_air_kg=money("4.80"),
            offer_valid_from=TODAY,
            offer_valid_to=EXPIRY,
            notes="Sample mixed sea/air agent.",
        ),
        "warehouse_city": "Shenzhen",
        "rates": [
            ("MSC", "Yantian, Shenzhen", "Aqaba, Jordan", 1180, 1475, 1860, 2325, 2050, 2562.50, 39, 48.75, 36, 45, 34, 42.50, 22),
            ("COSCO", "Shekou, Shenzhen", "Aqaba, Jordan", 1150, 1437.50, 1810, 2262.50, 2010, 2512.50, 38, 47.50, 35, 43.75, 33, 41.25, 23),
        ],
    },
    {
        "agent": dict(
            name="Foshan Cargo Link",
            name_ar="رابط شحن فوشان",
            country="China",
            contact_person="Jason Chen",
            phone="+8613600453303",
            whatsapp="+8613600453303",
            wechat_id="fscargolink",
            email="jason@fscargolink.cn",
            warehouse_city="Foshan",
            warehouse_address="Foshan Garment City, Nanhai District",
            serves_sea=True,
            serves_air=False,
            transit_sea_days=27,
            offer_valid_from=TODAY,
            offer_valid_to=EXPIRY,
            notes="Sample Foshan warehouse-to-port rates.",
        ),
        "warehouse_city": "Foshan",
        "rates": [
            ("Evergreen", "Nansha, Guangzhou", "Aqaba, Jordan", 1090, 1362.50, 1740, 2175, 1940, 2425, 36, 45, 33, 41.25, 31, 38.75, 27),
            ("OOCL", "Nansha, Guangzhou", "Aqaba, Jordan", 1110, 1387.50, 1760, 2200, 1960, 2450, 37, 46.25, 34, 42.50, 32, 40, 26),
        ],
    },
    {
        "agent": dict(
            name="Yiwu Market Consolidation",
            name_ar="تجميع سوق إيوو",
            country="China",
            contact_person="Grace Sun",
            phone="+8613777884404",
            whatsapp="+8613777884404",
            wechat_id="yiwu_consol",
            email="grace@yiwuconsolidation.cn",
            warehouse_city="Yiwu",
            warehouse_address="Yiwu International Trade City, Phase 4",
            serves_sea=True,
            serves_air=True,
            transit_sea_days=29,
            transit_air_days=6,
            price_air_kg=money("5.20"),
            offer_valid_from=TODAY,
            offer_valid_to=EXPIRY,
            notes="Sample consolidation agent for Yiwu market cargo.",
        ),
        "warehouse_city": "Yiwu",
        "rates": [
            ("Hapag-Lloyd", "Ningbo, China", "Aqaba, Jordan", 1210, 1512.50, 1900, 2375, 2100, 2625, 41, 51.25, 38, 47.50, 35, 43.75, 29),
            ("ONE", "Ningbo, China", "Aqaba, Jordan", 1190, 1487.50, 1880, 2350, 2080, 2600, 40, 50, 37, 46.25, 34, 42.50, 28),
        ],
    },
    {
        "agent": dict(
            name="Ningbo Jordan Express",
            name_ar="نينغبو الأردن إكسبريس",
            country="China",
            contact_person="Leo Xu",
            phone="+8613355015505",
            whatsapp="+8613355015505",
            wechat_id="nb_jordan_ex",
            email="leo@nbjordanexpress.cn",
            warehouse_city="Ningbo",
            warehouse_address="Ningbo Port Area",
            serves_sea=True,
            serves_air=False,
            transit_sea_days=30,
            offer_valid_from=TODAY,
            offer_valid_to=EXPIRY,
            notes="Sample Ningbo direct sea rates to Aqaba.",
        ),
        "warehouse_city": "Yiwu",
        "rates": [
            ("Yang Ming", "Ningbo, China", "Aqaba, Jordan", 1160, 1450, 1840, 2300, 2040, 2550, 39, 48.75, 36, 45, 34, 42.50, 30),
            ("ZIM", "Ningbo, China", "Aqaba, Jordan", 1140, 1425, 1820, 2275, 2020, 2525, 38, 47.50, 35, 43.75, 33, 41.25, 31),
        ],
    },
]


def main() -> None:
    with SessionLocal() as db:
        warehouses = {
            w.city: w
            for w in db.query(CompanyWarehouse)
            .filter(
                CompanyWarehouse.is_active == True,
                CompanyWarehouse.warehouse_type == "loading",
            )
            .all()
        }

        added: list[str] = []
        skipped: list[str] = []
        for item in SAMPLES:
            data = item["agent"]
            existing = db.query(ShippingAgent).filter(ShippingAgent.name == data["name"]).first()
            if existing:
                skipped.append(data["name"])
                continue

            first_rate = item["rates"][0]
            agent = ShippingAgent(
                **data,
                price_20gp=money(first_rate[4]),
                price_40ft=money(first_rate[6]),
                price_40hq=money(first_rate[8]),
            )
            db.add(agent)
            db.flush()

            warehouse = warehouses.get(item["warehouse_city"])
            for rate in item["rates"]:
                (
                    carrier,
                    pol,
                    pod,
                    b20,
                    s20,
                    b40,
                    s40,
                    bhq,
                    shq,
                    l20b,
                    l20s,
                    l40b,
                    l40s,
                    lhqb,
                    lhqs,
                    transit,
                ) = rate
                db.add(
                    AgentCarrierRate(
                        agent_id=agent.id,
                        carrier_name=carrier,
                        pol=pol,
                        pod=pod,
                        effective_date=TODAY,
                        expiry_date=EXPIRY,
                        buy_20gp=money(b20),
                        sell_20gp=money(s20),
                        cbm_20gp=money(28),
                        buy_40ft=money(b40),
                        sell_40ft=money(s40),
                        cbm_40ft=money(67),
                        buy_40hq=money(bhq),
                        sell_40hq=money(shq),
                        cbm_40hq=money(76),
                        buy_lcl_20gp=money(l20b),
                        sell_lcl_20gp=money(l20s),
                        buy_lcl_40ft=money(l40b),
                        sell_lcl_40ft=money(l40s),
                        buy_lcl_40hq=money(lhqb),
                        sell_lcl_40hq=money(lhqs),
                        transit_sea_days=transit,
                        sealing_day=SEALING,
                        vessel_day=VESSEL,
                        loading_warehouse_id=warehouse.id if warehouse else None,
                        fee_loading=money(120),
                        fee_bl=money(75),
                        fee_trucking=money(260),
                        fee_other=money(40),
                        notes="Sample weekly offer to Aqaba.",
                        is_active=True,
                    )
                )

            added.append(data["name"])

        db.commit()

    print(f"Added {len(added)} shipping agents.")
    for name in added:
        print(f"  + {name}")
    if skipped:
        print(f"Skipped {len(skipped)} existing shipping agents.")
        for name in skipped:
            print(f"  = {name}")


if __name__ == "__main__":
    main()

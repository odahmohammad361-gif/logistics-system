#!/usr/bin/env python3
"""
Seed script — inserts realistic test data into all tables.
Safe to run multiple times: skips records that already exist.

Run from backend/ directory:
    python scripts/seed_data.py
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from decimal import Decimal
from datetime import datetime, date, timedelta

from app.database import SessionLocal
from app.core.security import hash_password
from app.models.branch import Branch
from app.models.user import User, UserRole
from app.models.client import Client
from app.models.customer import Customer
from app.models.shipping_agent import ShippingAgent
from app.models.clearance_agent import ClearanceAgent
from app.models.supplier import Supplier
from app.models.product import Product, ProductPhoto
from app.models.market_rate import MarketRate
from app.models.company_settings import CompanySettings
from app.models.company_warehouse import CompanyWarehouse
from app.models.shipping_quote import ShippingQuote, QuoteServiceMode, QuoteStatus, Incoterm
from app.models.invoice import Invoice, InvoiceType, InvoiceStatus
from app.models.invoice_item import InvoiceItem
from app.models.booking import Booking, BookingCargoLine

db = SessionLocal()
today = datetime.now()
today_date = date.today()

def skip(model, **kwargs):
    return db.query(model).filter_by(**kwargs).first() is not None

try:

    # ── 1. BRANCHES ───────────────────────────────────────────────────────────────
    print("Seeding branches...")
    branch_rows = [
        dict(name="Jordan Branch",  name_ar="فرع الأردن",  code="JO", country="Jordan", city="Amman"),
        dict(name="Iraq Branch",    name_ar="فرع العراق",  code="IQ", country="Iraq", city="Baghdad"),
        dict(name="China Office",   name_ar="مكتب الصين",  code="CN", country="China", city="Guangzhou"),
    ]
    for r in branch_rows:
        if not skip(Branch, code=r["code"]):
            db.add(Branch(**r)); db.flush()
    db.commit()
    B = {r["code"]: db.query(Branch).filter_by(code=r["code"]).first() for r in branch_rows}
    print(f"  ✓ {len(B)} branches")

    # ── 2. USERS ──────────────────────────────────────────────────────────────────
    print("Seeding users...")
    user_rows = [
        dict(full_name="Omar Al-Hassan",    full_name_ar="عمر الحسن",      email="omar@logistics.jo",     role=UserRole.SUPER_ADMIN,    branch_id=B["JO"].id),
        dict(full_name="Fatima Al-Rashid",  full_name_ar="فاطمة الراشد",   email="fatima@logistics.jo",   role=UserRole.ADMIN,          branch_id=B["JO"].id),
        dict(full_name="Mohammed Al-Sayed", full_name_ar="محمد السيد",      email="mohammed@logistics.jo", role=UserRole.BRANCH_MANAGER, branch_id=B["IQ"].id),
        dict(full_name="Layla Ibrahim",     full_name_ar="ليلى إبراهيم",   email="layla@logistics.jo",    role=UserRole.STAFF,          branch_id=B["JO"].id),
        dict(full_name="Ahmad Karimi",      full_name_ar="أحمد كريمي",     email="ahmad@logistics.jo",    role=UserRole.STAFF,          branch_id=B["CN"].id),
        dict(full_name="Nour Al-Din",       full_name_ar="نور الدين",       email="nour@logistics.jo",     role=UserRole.STAFF,          branch_id=B["JO"].id),
        dict(full_name="Khaled Mansour",    full_name_ar="خالد منصور",     email="khaled@logistics.jo",   role=UserRole.VIEWER,         branch_id=B["IQ"].id),
        dict(full_name="Sara Al-Jabri",     full_name_ar="سارة الجابري",   email="sara@logistics.jo",     role=UserRole.VIEWER,         branch_id=B["JO"].id),
        dict(full_name="Yusuf Al-Tamimi",   full_name_ar="يوسف التميمي",   email="yusuf@logistics.jo",    role=UserRole.BRANCH_MANAGER, branch_id=B["JO"].id),
        dict(full_name="Rania Hassan",      full_name_ar="رانيا حسن",      email="rania@logistics.jo",    role=UserRole.ADMIN,          branch_id=B["IQ"].id),
    ]
    for r in user_rows:
        if not skip(User, email=r["email"]):
            db.add(User(**r, hashed_password=hash_password("Test@1234"))); db.flush()
    db.commit()
    U = [db.query(User).filter_by(email=r["email"]).first() for r in user_rows]
    print(f"  ✓ {len(U)} users  (password: Test@1234)")

    # ── 3. CLIENTS ────────────────────────────────────────────────────────────────
    print("Seeding clients...")
    client_rows = [
        dict(client_code="JO-0001", name="Al-Noor Trading Co.",       name_ar="شركة النور للتجارة",       phone="+962791234567", email="alnoor@trade.jo",       country="Jordan", city="Amman",   company_name="Al-Noor Trading LLC", branch_id=B["JO"].id),
        dict(client_code="JO-0002", name="Gulf Star Import",           name_ar="نجمة الخليج للاستيراد",   phone="+962799876543", email="gulfstar@import.jo",    country="Jordan", city="Zarqa",   company_name="Gulf Star LLC",       branch_id=B["JO"].id),
        dict(client_code="IQ-0001", name="Baghdad Fashion House",      name_ar="بيت بغداد للأزياء",       phone="+9647801234567",email="bgdfashion@mail.iq",    country="Iraq",   city="Baghdad",                             branch_id=B["IQ"].id),
        dict(client_code="IQ-0002", name="Erbil Wholesale Market",     name_ar="سوق أربيل بالجملة",       phone="+9647709876543",email="erbilmarket@mail.iq",   country="Iraq",   city="Erbil",                               branch_id=B["IQ"].id),
        dict(client_code="JO-0003", name="Al-Aqaba Traders",           name_ar="تجار العقبة",              phone="+962777111222", email="aqabatrade@jo.net",     country="Jordan", city="Aqaba",                               branch_id=B["JO"].id),
        dict(client_code="IQ-0003", name="Basra Commerce Group",       name_ar="مجموعة البصرة التجارية",  phone="+9647800111222",email="basraco@mail.iq",       country="Iraq",   city="Basra",                               branch_id=B["IQ"].id),
        dict(client_code="JO-0004", name="Jordan Direct Import",       name_ar="الاستيراد المباشر الأردني",phone="+962788333444",email="jdi@import.jo",         country="Jordan", city="Irbid",   company_name="JDI Co.",             branch_id=B["JO"].id),
        dict(client_code="JO-0005", name="Al-Rashid Brothers",         name_ar="إخوة الراشد",              phone="+962795555666", email="rashid.bros@jo.com",    country="Jordan", city="Amman",                               branch_id=B["JO"].id),
        dict(client_code="IQ-0004", name="Mosul Textile Trading",      name_ar="تجارة الموصل للأقمشة",    phone="+9647721234567",email="mosultextile@mail.iq",  country="Iraq",   city="Mosul",                               branch_id=B["IQ"].id),
        dict(client_code="JO-0006", name="Al-Zarqa General Trading",   name_ar="الزرقاء للتجارة العامة",  phone="+962796777888", email="zarqatrade@jo.net",     country="Jordan", city="Zarqa",                               branch_id=B["JO"].id),
    ]
    for r in client_rows:
        if not skip(Client, client_code=r["client_code"]):
            db.add(Client(**r, created_by_id=U[0].id)); db.flush()
    db.commit()
    C = [db.query(Client).filter_by(client_code=r["client_code"]).first() for r in client_rows]
    print(f"  ✓ {len(C)} clients")

    # ── 4. CUSTOMERS ──────────────────────────────────────────────────────────────
    print("Seeding customers...")
    customer_rows = [
        dict(full_name="Hassan Al-Shammari", email="hassan.sh@gmail.com",    phone="+962799001122",  telegram="hassan_sh",  country="jordan"),
        dict(full_name="Maryam Al-Zubaidi",  email="maryam.z@hotmail.com",   phone="+9647800223344", telegram="maryam_zb",  country="iraq"),
        dict(full_name="Tariq Saleh",        email="tariq.saleh@gmail.com",  phone="+962788334455",  telegram="tariq_s",    country="jordan"),
        dict(full_name="Nadia Al-Obeidi",    email="nadia.ob@gmail.com",     phone="+9647721334455", telegram=None,         country="iraq"),
        dict(full_name="Samir Khalil",       email="samir.kh@outlook.com",   phone="+962796445566",  telegram="samir_kh",   country="jordan"),
        dict(full_name="Zainab Al-Hakim",    email="zainab.h@gmail.com",     phone="+9647809556677", telegram="zainab_h",   country="iraq"),
        dict(full_name="Walid Al-Masri",     email="walid.m@gmail.com",      phone="+962779667788",  telegram=None,         country="jordan"),
        dict(full_name="Dina Farouk",        email="dina.farouk@yahoo.com",  phone="+962788778899",  telegram="dina_f",     country="jordan"),
        dict(full_name="Karim Al-Ani",       email="karim.ani@gmail.com",    phone="+9647730889900", telegram="karim_ani",  country="iraq"),
        dict(full_name="Rana Mustafa",       email="rana.mustafa@gmail.com", phone="+962791990011",  telegram="rana_m",     country="jordan"),
    ]
    added = 0
    for r in customer_rows:
        if not skip(Customer, email=r["email"]):
            db.add(Customer(**r, hashed_password=hash_password("Customer@123"), is_verified=False)); added += 1
    db.commit()
    print(f"  ✓ {added} customers  (password: Customer@123)")

    # ── 5. SHIPPING AGENTS ────────────────────────────────────────────────────────
    print("Seeding shipping agents...")
    agent_rows = [
        dict(name="Guangzhou Ocean Freight",   name_ar="شحن غوانغجو البحري",          country="China", contact_person="Zhang Wei",  phone="+8613812345678", wechat_id="zhangwei_gz",    warehouse_city="Guangzhou", price_20gp=Decimal("1200"), price_40ft=Decimal("1800"), price_40hq=Decimal("2000"), transit_sea_days=25, serves_sea=True,  serves_air=False),
        dict(name="Shenzhen Fast Cargo",        name_ar="شنتشن للشحن السريع",           country="China", contact_person="Li Mei",     phone="+8618987654321", wechat_id="limei_sz",       warehouse_city="Shenzhen",  price_20gp=Decimal("1350"), price_40ft=Decimal("2000"), price_40hq=Decimal("2200"), transit_sea_days=22, serves_sea=True,  serves_air=False),
        dict(name="Emirates Sky Cargo Agent",   name_ar="وكيل طيران الإمارات للشحن",   country="China", contact_person="Wang Fang",  phone="+8615612345678", wechat_id="wangfang_air",   warehouse_city="Guangzhou", price_air_kg=Decimal("28"),                                                                             transit_air_days=5,  serves_sea=False, serves_air=True),
        dict(name="Foshan Textile Freight",     name_ar="شحن فوشان النسيج",             country="China", contact_person="Chen Jing",  phone="+8613698765432", wechat_id="chenjing_fs",    warehouse_city="Foshan",    price_20gp=Decimal("1100"), price_40ft=Decimal("1700"), price_40hq=Decimal("1900"), transit_sea_days=28, serves_sea=True,  serves_air=False),
        dict(name="China Air Express",          name_ar="الصين للشحن الجوي السريع",     country="China", contact_person="Liu Yang",   phone="+8617612345678", wechat_id="liuyang_air",    warehouse_city="Shanghai",  price_air_kg=Decimal("32"),                                                                             transit_air_days=4,  serves_sea=False, serves_air=True),
        dict(name="Pearl River Logistics",      name_ar="لوجستيات نهر اللؤلؤ",          country="China", contact_person="Huang Bo",   phone="+8613512345678", wechat_id="huangbo_pr",     warehouse_city="Guangzhou", price_20gp=Decimal("1250"), price_40ft=Decimal("1900"), price_40hq=Decimal("2100"), transit_sea_days=26, serves_sea=True,  serves_air=False),
        dict(name="Ningbo Sea Bridge",          name_ar="جسر نينغبو البحري",             country="China", contact_person="Xu Lei",     phone="+8613312345678", wechat_id="xulei_nb",       warehouse_city="Ningbo",    price_20gp=Decimal("1150"), price_40ft=Decimal("1750"), price_40hq=Decimal("1950"), transit_sea_days=30, serves_sea=True,  serves_air=False),
        dict(name="Guangzhou Air Hub",          name_ar="مركز غوانغجو الجوي",            country="China", contact_person="Zhao Min",   phone="+8615012345678", wechat_id="zhaomin_ah",     warehouse_city="Guangzhou", price_air_kg=Decimal("25"),                                                                             transit_air_days=6,  serves_sea=False, serves_air=True),
        dict(name="Yiwu Global Freight",        name_ar="إيوو للشحن العالمي",            country="China", contact_person="Sun Wei",    phone="+8613712345678", wechat_id="sunwei_yw",      warehouse_city="Yiwu",      price_20gp=Decimal("1300"), price_40ft=Decimal("1950"), price_40hq=Decimal("2150"), transit_sea_days=27, serves_sea=True,  serves_air=False),
        dict(name="Dongguan Express Cargo",     name_ar="دونغقوان للشحن السريع",         country="China", contact_person="Ma Li",      phone="+8613612345678", wechat_id="mali_dg",        warehouse_city="Dongguan",  price_20gp=Decimal("1180"), price_40ft=Decimal("1780"), price_40hq=Decimal("1980"), transit_sea_days=24, serves_sea=True,  serves_air=False),
    ]
    for r in agent_rows:
        if not skip(ShippingAgent, name=r["name"]):
            db.add(ShippingAgent(**r)); db.flush()
    db.commit()
    A = [db.query(ShippingAgent).filter_by(name=r["name"]).first() for r in agent_rows]
    print(f"  ✓ {len(A)} shipping agents")

    # ── 6. CLEARANCE AGENTS ───────────────────────────────────────────────────────
    print("Seeding clearance agents...")
    clearance_rows = [
        dict(name="Aqaba Clearance Services",    name_ar="خدمات التخليص في العقبة",       country="Jordan", city="Aqaba",   phone="+96232012345",  license_number="JO-CUS-2021-0451", clearance_fee=Decimal("350"), service_fee=Decimal("150"), transport_fee=Decimal("200"), handling_fee=Decimal("80"),  storage_fee_per_day=Decimal("25")),
        dict(name="Amman Customs Brokers",       name_ar="وسطاء الجمارك عمان",             country="Jordan", city="Amman",   phone="+96264123456",  license_number="JO-CUS-2019-0223", clearance_fee=Decimal("400"), service_fee=Decimal("180"), transport_fee=Decimal("250"), handling_fee=Decimal("100"), storage_fee_per_day=Decimal("30")),
        dict(name="Basra Port Clearance",        name_ar="تخليص ميناء البصرة",             country="Iraq",   city="Basra",   phone="+9647701234567",license_number="IQ-CUS-2020-1122", clearance_fee=Decimal("450"), service_fee=Decimal("200"), transport_fee=Decimal("300"), handling_fee=Decimal("120"), storage_fee_per_day=Decimal("35")),
        dict(name="Baghdad Customs Agency",      name_ar="وكالة جمارك بغداد",              country="Iraq",   city="Baghdad", phone="+9647711234567",license_number="IQ-CUS-2018-0891", clearance_fee=Decimal("500"), service_fee=Decimal("220"), transport_fee=Decimal("350"), handling_fee=Decimal("130"), storage_fee_per_day=Decimal("40")),
        dict(name="Umm Qasr Terminal Services",  name_ar="خدمات ميناء أم قصر",             country="Iraq",   city="Basra",   phone="+9647721234567",license_number="IQ-CUS-2022-0334", clearance_fee=Decimal("420"), service_fee=Decimal("190"), transport_fee=Decimal("280"), handling_fee=Decimal("110"), storage_fee_per_day=Decimal("32")),
        dict(name="Zarqa Free Zone Brokers",     name_ar="وسطاء المنطقة الحرة الزرقاء",   country="Jordan", city="Zarqa",   phone="+96253456789",  license_number="JO-CUS-2020-0567", clearance_fee=Decimal("380"), service_fee=Decimal("160"), transport_fee=Decimal("220"), handling_fee=Decimal("90"),  storage_fee_per_day=Decimal("28")),
        dict(name="Erbil Import Clearance",      name_ar="تخليص استيراد أربيل",            country="Iraq",   city="Erbil",   phone="+9647731234567",license_number="IQ-CUS-2021-0445", clearance_fee=Decimal("430"), service_fee=Decimal("195"), transport_fee=Decimal("310"), handling_fee=Decimal("115"), storage_fee_per_day=Decimal("38")),
        dict(name="Irbid Logistics Clearance",   name_ar="تخليص لوجستيات إربد",           country="Jordan", city="Irbid",   phone="+96227891234",  license_number="JO-CUS-2022-0312", clearance_fee=Decimal("360"), service_fee=Decimal("155"), transport_fee=Decimal("210"), handling_fee=Decimal("85"),  storage_fee_per_day=Decimal("26")),
        dict(name="Mosul Customs Brokers",       name_ar="وسطاء جمارك الموصل",             country="Iraq",   city="Mosul",   phone="+9647741234567",license_number="IQ-CUS-2019-0678", clearance_fee=Decimal("460"), service_fee=Decimal("205"), transport_fee=Decimal("320"), handling_fee=Decimal("125"), storage_fee_per_day=Decimal("36")),
        dict(name="Jordan Aqaba Special Zone",   name_ar="منطقة العقبة الاقتصادية",        country="Jordan", city="Aqaba",   phone="+96232098765",  license_number="JO-CUS-2017-0189", clearance_fee=Decimal("320"), service_fee=Decimal("140"), transport_fee=Decimal("180"), handling_fee=Decimal("75"),  storage_fee_per_day=Decimal("22")),
    ]
    added = 0
    for r in clearance_rows:
        if not skip(ClearanceAgent, name=r["name"]):
            db.add(ClearanceAgent(**r)); added += 1
    db.commit()
    print(f"  ✓ {added} clearance agents")

    # ── 7. SUPPLIERS ──────────────────────────────────────────────────────────────
    print("Seeding suppliers...")
    supplier_rows = [
        dict(code="SHA-001", name="Shahe Fashion Factory",      name_ar="مصنع شاهي للأزياء",          market_location="Shahe Market, Block A, Shop 12",              wechat_id="shahe_001", phone="+8613912345678"),
        dict(code="BAI-002", name="Baiyun Textile Co.",          name_ar="شركة باييون للنسيج",          market_location="Baiyun Market, Floor 3, Unit 45",             wechat_id="baiyun_02", phone="+8613812398765"),
        dict(code="SHA-003", name="Guangzhou Jeans Factory",     name_ar="مصنع غوانغجو للجينز",         market_location="Shahe Market, Block C, Shop 88",              wechat_id="gz_jeans",  phone="+8615712345678"),
        dict(code="FOS-004", name="Foshan Kids Wear",            name_ar="فوشان لملابس الأطفال",         market_location="Foshan Garment City, Zone B, #23",            wechat_id="fs_kids",   phone="+8613612398765"),
        dict(code="YIW-005", name="Yiwu Accessories Hub",        name_ar="مركز إيوو للإكسسوارات",       market_location="Yiwu International Trade City, Hall 5",       wechat_id="yw_acc",    phone="+8613512345678"),
        dict(code="SHA-006", name="Shahe Jacket Wholesale",      name_ar="شاهي للجاكيتات بالجملة",      market_location="Shahe Market, Block D, Shop 34",              wechat_id="sha_jkt",   phone="+8613712345678"),
        dict(code="GZH-007", name="Guangzhou Sports Wear",       name_ar="غوانغجو للملابس الرياضية",    market_location="Guangzhou Sports City, Unit 17",              wechat_id="gz_sport",  phone="+8615612345678"),
        dict(code="CHE-008", name="Chengdu Ethnic Fashion",      name_ar="تشنغدو للأزياء التراثية",     market_location="Chengdu Textile Market, Row 8",               wechat_id="cd_eth",    phone="+8613812345698"),
        dict(code="SHA-009", name="Shahe Underwear Factory",     name_ar="مصنع شاهي للملابس الداخلية",  market_location="Shahe Market, Block B, Shop 56",              wechat_id="sha_uw",    phone="+8613612398700"),
        dict(code="FOB-010", name="Foshan Bags & Luggage",       name_ar="فوشان للحقائب والأمتعة",      market_location="Foshan Leather Market, Zone A",               wechat_id="fs_bags",   phone="+8615512345678"),
    ]
    for r in supplier_rows:
        if not skip(Supplier, code=r["code"]):
            db.add(Supplier(**r)); db.flush()
    db.commit()
    S = [db.query(Supplier).filter_by(code=r["code"]).first() for r in supplier_rows]
    print(f"  ✓ {len(S)} suppliers")

    # ── 8. PRODUCTS ───────────────────────────────────────────────────────────────
    print("Seeding products...")
    product_rows = [
        dict(code="TS-001", name="Men's Basic T-Shirt",          name_ar="تيشيرت رجالي أساسي",           category="t-shirt",   supplier_id=S[0].id, price_cny=Decimal("18.50"), pcs_per_carton=120, cbm_per_carton=Decimal("0.08"), min_order_cartons=3, is_featured=True),
        dict(code="JN-002", name="Slim Fit Jeans",               name_ar="جينز ضيق",                     category="jeans",     supplier_id=S[2].id, price_cny=Decimal("55.00"), pcs_per_carton=60,  cbm_per_carton=Decimal("0.12"), min_order_cartons=2, is_featured=True),
        dict(code="JK-003", name="Winter Jacket Unisex",         name_ar="جاكيت شتوي يونيسيكس",          category="jacket",    supplier_id=S[5].id, price_cny=Decimal("120.00"),pcs_per_carton=30,  cbm_per_carton=Decimal("0.18"), min_order_cartons=2, is_featured=False),
        dict(code="KW-004", name="Children's Tracksuit Set",     name_ar="طقم رياضي للأطفال",             category="kids",      supplier_id=S[3].id, price_cny=Decimal("38.00"), pcs_per_carton=80,  cbm_per_carton=Decimal("0.10"), min_order_cartons=3, is_featured=True),
        dict(code="SW-005", name="Men's Sports Set",             name_ar="طقم رياضي رجالي",               category="sportswear",supplier_id=S[6].id, price_cny=Decimal("68.00"), pcs_per_carton=50,  cbm_per_carton=Decimal("0.14"), min_order_cartons=2, is_featured=False),
        dict(code="TS-006", name="Women's Polo T-Shirt",         name_ar="تيشيرت بولو نسائي",             category="t-shirt",   supplier_id=S[0].id, price_cny=Decimal("22.00"), pcs_per_carton=100, cbm_per_carton=Decimal("0.09"), min_order_cartons=3, is_featured=False),
        dict(code="JN-007", name="Wide Leg Jeans Women",         name_ar="جينز واسع نسائي",               category="jeans",     supplier_id=S[2].id, price_cny=Decimal("62.00"), pcs_per_carton=50,  cbm_per_carton=Decimal("0.13"), min_order_cartons=2, is_featured=True),
        dict(code="BG-008", name='Travel Trolley Bag 24"',       name_ar='شنطة سفر ترولي 24 بوصة',       category="bags",      supplier_id=S[9].id, price_cny=Decimal("88.00"), pcs_per_carton=20,  cbm_per_carton=Decimal("0.22"), min_order_cartons=1, is_featured=False),
        dict(code="UW-009", name="Men's Underwear Pack (6pcs)",  name_ar="باكيت ملابس داخلية رجالية",    category="underwear", supplier_id=S[8].id, price_cny=Decimal("28.00"), pcs_per_carton=150, cbm_per_carton=Decimal("0.07"), min_order_cartons=5, is_featured=False),
        dict(code="JK-010", name="Leather Biker Jacket",         name_ar="جاكيت جلد موتوسيكل",           category="jacket",    supplier_id=S[5].id, price_cny=Decimal("185.00"),pcs_per_carton=20,  cbm_per_carton=Decimal("0.20"), min_order_cartons=1, is_featured=True),
    ]
    for r in product_rows:
        if not skip(Product, code=r["code"]):
            db.add(Product(**r)); db.flush()
    db.commit()
    P = [db.query(Product).filter_by(code=r["code"]).first() for r in product_rows]
    print(f"  ✓ {len(P)} products")

    # ── 9. MARKET RATES ───────────────────────────────────────────────────────────
    print("Seeding market rates...")
    rates = [("CNY",Decimal("7.24")),("JOD",Decimal("0.709")),("IQD",Decimal("1310.0")),
             ("EUR",Decimal("0.921")),("GBP",Decimal("0.787")),("AED",Decimal("3.673")),
             ("SAR",Decimal("3.751")),("TRY",Decimal("32.50")),("EGP",Decimal("48.60")),("KWD",Decimal("0.307"))]
    for target, rate in rates:
        db.add(MarketRate(base_currency="USD", target_currency=target, rate=rate))
    db.commit()
    print(f"  ✓ {len(rates)} market rates")

    # ── 10. COMPANY SETTINGS ──────────────────────────────────────────────────────
    print("Seeding company settings...")
    if not db.query(CompanySettings).first():
        db.add(CompanySettings(
            name="Ard Al-Wisam Trading & Shipping",  name_ar="أرض الوسام للتجارة والشحن",
            tagline="Your trusted bridge between China and the Middle East",  tagline_ar="جسرك الموثوق بين الصين والشرق الأوسط",
            address="King Abdullah II Street, Amman, Jordan",  address_ar="شارع الملك عبدالله الثاني، عمان، الأردن",
            phone="+962 6 123 4567", email="info@ardwisam.jo", website="www.ardwisam.jo",
            bank_account_name="Ard Al-Wisam Trading Co.",
            bank_account_no="JO94ABCO3200000000519000401",
            bank_swift="ABCOJOAD", bank_name="Arab Bank PLC",
            bank_address="Abdali Branch, Amman, Jordan",
        ))
        db.commit()
        print("  ✓ Company settings created")
    else:
        print("  ✓ Company settings already exists, skipped")

    # ── 11. COMPANY WAREHOUSES ────────────────────────────────────────────────────
    print("Seeding warehouses...")
    warehouse_rows = [
        dict(name="Guangzhou Main Warehouse",    name_ar="مستودع غوانغجو الرئيسي",    warehouse_type="loading",   country="CN", city="Guangzhou", address="Shahe Textile Market, Tianhe District",  contact_name="Ahmad Karimi",      phone="+8613812345678", branch_id=B["CN"].id),
        dict(name="Aqaba Unloading Depot",       name_ar="مستودع العقبة للتفريغ",     warehouse_type="unloading", country="JO", city="Aqaba",     address="Aqaba Container Port, Warehouse Zone 4", contact_name="Layla Ibrahim",     phone="+96232012345",  branch_id=B["JO"].id),
        dict(name="Basra Receiving Warehouse",   name_ar="مستودع البصرة للاستقبال",   warehouse_type="unloading", country="IQ", city="Basra",     address="Umm Qasr Port, Industrial Area",         contact_name="Mohammed Al-Sayed", phone="+9647801234567",branch_id=B["IQ"].id),
        dict(name="Shenzhen Backup Warehouse",   name_ar="مستودع شنتشن الاحتياطي",   warehouse_type="loading",   country="CN", city="Shenzhen",  address="Longhua District, Shenzhen",             contact_name="Ahmad Karimi",      phone="+8618987654321",branch_id=B["CN"].id),
        dict(name="Amman Distribution Center",   name_ar="مركز توزيع عمان",            warehouse_type="unloading", country="JO", city="Amman",    address="Al-Marka Industrial Area, East Amman",   contact_name="Nour Al-Din",       phone="+96264123456",  branch_id=B["JO"].id),
        dict(name="Yiwu Sourcing Warehouse",     name_ar="مستودع إيوو للمصادر",        warehouse_type="loading",   country="CN", city="Yiwu",     address="Yiwu International Trade City, Phase 4", contact_name="Ahmad Karimi",      phone="+8613512345678",branch_id=B["CN"].id),
        dict(name="Zarqa Logistics Hub",         name_ar="مركز لوجستيات الزرقاء",      warehouse_type="unloading", country="JO", city="Zarqa",    address="Sahab Industrial Estate, Zarqa",         contact_name="Nour Al-Din",       phone="+96253456789",  branch_id=B["JO"].id),
        dict(name="Baghdad Central Depot",       name_ar="المستودع المركزي بغداد",     warehouse_type="unloading", country="IQ", city="Baghdad",  address="Al-Nasr Industrial Area, Baghdad",       contact_name="Rania Hassan",      phone="+9647711234567",branch_id=B["IQ"].id),
        dict(name="Foshan Pick-up Point",        name_ar="نقطة استلام فوشان",           warehouse_type="loading",   country="CN", city="Foshan",   address="Foshan Garment City, Nanhai District",   contact_name="Ahmad Karimi",      phone="+8613612398765",branch_id=B["CN"].id),
        dict(name="Erbil Storage Facility",      name_ar="مرفق تخزين أربيل",            warehouse_type="unloading", country="IQ", city="Erbil",    address="Erbil Free Zone, Industrial Area",       contact_name="Khaled Mansour",    phone="+9647709876543",branch_id=B["IQ"].id),
    ]
    added = 0
    for r in warehouse_rows:
        if not skip(CompanyWarehouse, name=r["name"]):
            db.add(CompanyWarehouse(**r)); added += 1
    db.commit()
    print(f"  ✓ {added} warehouses")

    # ── 12. SHIPPING QUOTES ───────────────────────────────────────────────────────
    print("Seeding shipping quotes...")
    quote_rows = [
        dict(quote_number="QT-2026-0001", agent_id=A[0].id, service_mode=QuoteServiceMode.SEA_FCL, container_type="20GP", incoterm=Incoterm.FOB, incoterm_point="FOB Guangzhou",  carrier="CMA CGM",          port_of_loading="Nansha, China",       port_of_discharge="Aqaba, Jordan",      validity_from=today, validity_to=today+timedelta(days=90), status=QuoteStatus.ACTIVE, currency="USD", ocean_freight=Decimal("1200"), baf=Decimal("80"),  thc_origin=Decimal("120"), bl_fee=Decimal("60"), doc_fee=Decimal("40"), trucking_origin=Decimal("80"), stuffing_fee=Decimal("50"), thc_destination=Decimal("100"), customs_destination=Decimal("350"), trucking_destination=Decimal("200"), transit_days=25, free_days_origin=7, free_days_destination=14, total_origin=Decimal("350"), total_destination=Decimal("650"), total_surcharges=Decimal("80"),  total_all=Decimal("2280"), is_active=True, created_by_id=U[0].id),
        dict(quote_number="QT-2026-0002", agent_id=A[0].id, service_mode=QuoteServiceMode.SEA_FCL, container_type="40HQ", incoterm=Incoterm.FOB, incoterm_point="FOB Guangzhou",  carrier="MSC",              port_of_loading="Nansha, China",       port_of_discharge="Aqaba, Jordan",      validity_from=today, validity_to=today+timedelta(days=90), status=QuoteStatus.ACTIVE, currency="USD", ocean_freight=Decimal("2000"), baf=Decimal("120"), thc_origin=Decimal("150"), bl_fee=Decimal("60"), doc_fee=Decimal("40"), trucking_origin=Decimal("100"),stuffing_fee=Decimal("70"), thc_destination=Decimal("130"), customs_destination=Decimal("350"), trucking_destination=Decimal("250"), transit_days=25, free_days_origin=7, free_days_destination=14, total_origin=Decimal("420"), total_destination=Decimal("730"), total_surcharges=Decimal("120"), total_all=Decimal("3270"), is_active=True, created_by_id=U[0].id),
        dict(quote_number="QT-2026-0003", agent_id=A[2].id, service_mode=QuoteServiceMode.AIR,     container_type=None,   incoterm=Incoterm.EXW, incoterm_point="EXW Guangzhou",  carrier="Emirates SkyCargo", port_of_loading="CAN - Guangzhou",    port_of_discharge="AMM - Amman",        validity_from=today, validity_to=today+timedelta(days=60), status=QuoteStatus.ACTIVE, currency="USD", air_freight_per_kg=Decimal("28"), min_chargeable_weight_kg=Decimal("45"), thc_origin=Decimal("50"), doc_fee=Decimal("30"), thc_destination=Decimal("80"), customs_destination=Decimal("150"), transit_days=5,  total_origin=Decimal("80"),  total_destination=Decimal("230"), total_surcharges=Decimal("0"),   total_all=Decimal("310"),  is_active=True, created_by_id=U[0].id),
        dict(quote_number="QT-2026-0004", agent_id=A[1].id, service_mode=QuoteServiceMode.SEA_FCL, container_type="40GP", incoterm=Incoterm.FOB, incoterm_point="FOB Shenzhen",   carrier="Evergreen",         port_of_loading="Yantian, China",     port_of_discharge="Umm Qasr, Iraq",     validity_from=today, validity_to=today+timedelta(days=90), status=QuoteStatus.ACTIVE, currency="USD", ocean_freight=Decimal("1800"), baf=Decimal("100"), war_risk_surcharge=Decimal("80"), thc_origin=Decimal("140"), bl_fee=Decimal("60"), trucking_origin=Decimal("90"), stuffing_fee=Decimal("60"), thc_destination=Decimal("150"), customs_destination=Decimal("450"), trucking_destination=Decimal("300"), transit_days=30, free_days_origin=7, free_days_destination=10, total_origin=Decimal("350"), total_destination=Decimal("900"), total_surcharges=Decimal("180"), total_all=Decimal("3230"), is_active=True, created_by_id=U[0].id),
        dict(quote_number="QT-2026-0005", agent_id=A[3].id, service_mode=QuoteServiceMode.LCL,     container_type=None,   incoterm=Incoterm.FOB, incoterm_point="FOB Foshan",     carrier="PIL",               port_of_loading="Nansha, China",      port_of_discharge="Aqaba, Jordan",      validity_from=today, validity_to=today+timedelta(days=60), status=QuoteStatus.ACTIVE, currency="USD", ocean_freight=Decimal("45"), min_chargeable_cbm=Decimal("1"),  thc_origin=Decimal("30"), warehouse_handling=Decimal("20"), thc_destination=Decimal("50"),  customs_destination=Decimal("180"), transit_days=35, total_origin=Decimal("50"),  total_destination=Decimal("230"), total_surcharges=Decimal("0"),   total_all=Decimal("280"),  is_active=True, created_by_id=U[0].id),
        dict(quote_number="QT-2026-0006", agent_id=A[5].id, service_mode=QuoteServiceMode.SEA_FCL, container_type="20GP", incoterm=Incoterm.CIF, incoterm_point="CIF Aqaba",      carrier="Yang Ming",         port_of_loading="Nansha, China",      port_of_discharge="Aqaba, Jordan",      validity_from=today-timedelta(days=30), validity_to=today+timedelta(days=60), status=QuoteStatus.ACTIVE, currency="USD", ocean_freight=Decimal("1250"), baf=Decimal("90"), thc_origin=Decimal("110"), bl_fee=Decimal("55"), thc_destination=Decimal("95"), customs_destination=Decimal("340"), transit_days=26, total_origin=Decimal("165"), total_destination=Decimal("435"), total_surcharges=Decimal("90"),  total_all=Decimal("1940"), is_active=True, created_by_id=U[0].id),
        dict(quote_number="QT-2026-0007", agent_id=A[4].id, service_mode=QuoteServiceMode.AIR,     container_type=None,   incoterm=Incoterm.EXW, incoterm_point="EXW Shanghai",   carrier="China Southern",    port_of_loading="PVG - Shanghai",     port_of_discharge="BGW - Baghdad",      validity_from=today, validity_to=today+timedelta(days=45), status=QuoteStatus.ACTIVE, currency="USD", air_freight_per_kg=Decimal("32"), min_chargeable_weight_kg=Decimal("45"), thc_origin=Decimal("45"), doc_fee=Decimal("25"), thc_destination=Decimal("90"),  customs_destination=Decimal("200"), transit_days=4,  total_origin=Decimal("70"),  total_destination=Decimal("290"), total_surcharges=Decimal("0"),   total_all=Decimal("360"),  is_active=True, created_by_id=U[0].id),
        dict(quote_number="QT-2026-0008", agent_id=A[6].id, service_mode=QuoteServiceMode.SEA_FCL, container_type="40HQ", incoterm=Incoterm.FOB, incoterm_point="FOB Ningbo",     carrier="COSCO",             port_of_loading="Ningbo, China",      port_of_discharge="Aqaba, Jordan",      validity_from=today-timedelta(days=10), validity_to=today+timedelta(days=80), status=QuoteStatus.ACTIVE, currency="USD", ocean_freight=Decimal("1950"), baf=Decimal("110"), thc_origin=Decimal("145"), bl_fee=Decimal("65"), doc_fee=Decimal("45"), stuffing_fee=Decimal("65"), thc_destination=Decimal("125"), customs_destination=Decimal("350"), trucking_destination=Decimal("230"), transit_days=30, total_origin=Decimal("320"), total_destination=Decimal("705"), total_surcharges=Decimal("110"), total_all=Decimal("3085"), is_active=True, created_by_id=U[0].id),
        dict(quote_number="QT-2026-0009", agent_id=A[8].id, service_mode=QuoteServiceMode.SEA_FCL, container_type="20GP", incoterm=Incoterm.FOB, incoterm_point="FOB Yiwu/Ningbo",carrier="Hapag-Lloyd",       port_of_loading="Yiwu/Ningbo, China", port_of_discharge="Umm Qasr, Iraq",     validity_from=today, validity_to=today+timedelta(days=90), status=QuoteStatus.ACTIVE, currency="USD", ocean_freight=Decimal("1300"), baf=Decimal("85"), war_risk_surcharge=Decimal("75"), thc_origin=Decimal("125"), bl_fee=Decimal("60"), thc_destination=Decimal("145"), customs_destination=Decimal("440"), trucking_destination=Decimal("290"), transit_days=27, total_origin=Decimal("185"), total_destination=Decimal("875"), total_surcharges=Decimal("160"), total_all=Decimal("2620"), is_active=True, created_by_id=U[0].id),
        dict(quote_number="QT-2026-0010", agent_id=A[7].id, service_mode=QuoteServiceMode.AIR,     container_type=None,   incoterm=Incoterm.EXW, incoterm_point="EXW Guangzhou",  carrier="Air Arabia Cargo",  port_of_loading="CAN - Guangzhou",    port_of_discharge="AMM - Amman",        validity_from=today, validity_to=today+timedelta(days=30), status=QuoteStatus.ACTIVE, currency="USD", air_freight_per_kg=Decimal("25"), min_chargeable_weight_kg=Decimal("45"), thc_origin=Decimal("40"), thc_destination=Decimal("75"),  customs_destination=Decimal("140"), transit_days=6,  total_origin=Decimal("40"),  total_destination=Decimal("215"), total_surcharges=Decimal("0"),   total_all=Decimal("255"),  is_active=True, created_by_id=U[0].id),
    ]
    added = 0
    for r in quote_rows:
        if not skip(ShippingQuote, quote_number=r["quote_number"]):
            db.add(ShippingQuote(**r)); added += 1
    db.commit()
    print(f"  ✓ {added} shipping quotes")

    # ── 13. INVOICES + ITEMS ──────────────────────────────────────────────────────
    print("Seeding invoices...")
    invoices = [
        dict(invoice_number="PO-2026-0001", invoice_type=InvoiceType.PRICE_OFFER, status=InvoiceStatus.SENT,     client_id=C[0].id, issue_date=today-timedelta(days=10), currency="USD", origin="China", payment_terms="30% deposit, 70% before shipment", shipping_term="FOB", port_of_loading="Nansha, China", port_of_discharge="Aqaba, Jordan",   subtotal=Decimal("7462.20"), discount=Decimal("0"),      total=Decimal("7462.20"), created_by_id=U[1].id, branch_id=B["JO"].id,
             items=[
                dict(description="Men's Basic T-Shirt",        description_ar="تيشيرت رجالي أساسي",    hs_code="6109.10", quantity=Decimal("300"), unit="pcs",  unit_price=Decimal("2.56"),  total_price=Decimal("768.00"),  cartons=3,  cbm=Decimal("0.24")),
                dict(description="Slim Fit Jeans",             description_ar="جينز ضيق",               hs_code="6203.42", quantity=Decimal("120"), unit="pcs",  unit_price=Decimal("7.60"),  total_price=Decimal("912.00"),  cartons=2,  cbm=Decimal("0.24")),
                dict(description="Winter Jacket Unisex",       description_ar="جاكيت شتوي يونيسيكس",   hs_code="6201.13", quantity=Decimal("60"),  unit="pcs",  unit_price=Decimal("16.57"), total_price=Decimal("994.20"),  cartons=2,  cbm=Decimal("0.36")),
                dict(description="Children's Tracksuit Set",   description_ar="طقم رياضي للأطفال",      hs_code="6211.43", quantity=Decimal("240"), unit="sets", unit_price=Decimal("5.25"),  total_price=Decimal("1260.00"), cartons=3,  cbm=Decimal("0.30")),
                dict(description="Men's Sports Set",           description_ar="طقم رياضي رجالي",        hs_code="6211.33", quantity=Decimal("150"), unit="sets", unit_price=Decimal("9.39"),  total_price=Decimal("1408.50"), cartons=3,  cbm=Decimal("0.42")),
             ]),
        dict(invoice_number="PI-2026-0001", invoice_type=InvoiceType.PI,           status=InvoiceStatus.APPROVED, client_id=C[1].id, issue_date=today-timedelta(days=20), due_date=today+timedelta(days=10), currency="USD", origin="China", payment_terms="50% TT advance, balance against BL", shipping_term="FOB", port_of_loading="Yantian, China", port_of_discharge="Aqaba, Jordan", subtotal=Decimal("12480.00"), discount=Decimal("480.00"), total=Decimal("12000.00"), created_by_id=U[1].id, branch_id=B["JO"].id,
             items=[
                dict(description="Wide Leg Jeans Women",       description_ar="جينز واسع نسائي",        hs_code="6204.62", quantity=Decimal("200"), unit="pcs",   unit_price=Decimal("8.57"),  total_price=Decimal("1714.00"), cartons=4,  cbm=Decimal("0.52")),
                dict(description="Leather Biker Jacket",       description_ar="جاكيت جلد موتوسيكل",     hs_code="6201.11", quantity=Decimal("40"),  unit="pcs",   unit_price=Decimal("25.55"), total_price=Decimal("1022.00"), cartons=2,  cbm=Decimal("0.40")),
                dict(description='Travel Trolley Bag 24"',     description_ar="شنطة سفر ترولي 24 بوصة", hs_code="4202.12", quantity=Decimal("60"),  unit="pcs",   unit_price=Decimal("12.15"), total_price=Decimal("729.00"),  cartons=3,  cbm=Decimal("0.66")),
                dict(description="Men's Underwear Pack (6pcs)",description_ar="باكيت ملابس داخلية",      hs_code="6107.11", quantity=Decimal("450"), unit="packs", unit_price=Decimal("3.87"),  total_price=Decimal("1741.50"), cartons=3,  cbm=Decimal("0.21")),
                dict(description="Women's Polo T-Shirt",       description_ar="تيشيرت بولو نسائي",       hs_code="6106.10", quantity=Decimal("400"), unit="pcs",   unit_price=Decimal("3.04"),  total_price=Decimal("1216.00"), cartons=4,  cbm=Decimal("0.36")),
             ]),
        dict(invoice_number="CI-2026-0001", invoice_type=InvoiceType.CI,           status=InvoiceStatus.PAID,     client_id=C[2].id, issue_date=today-timedelta(days=45), currency="USD", origin="China", payment_terms="100% TT paid", shipping_term="CIF", port_of_loading="Nansha, China", port_of_discharge="Umm Qasr, Iraq", container_no="CMAU3456789", seal_no="SL-98765", bl_number="CMDU2026IQ001", vessel_name="CMA CGM MARCO POLO", voyage_number="0234E", subtotal=Decimal("9750.00"), discount=Decimal("0"), total=Decimal("9750.00"), created_by_id=U[1].id, branch_id=B["IQ"].id,
             items=[
                dict(description="Men's Basic T-Shirt (Assorted)", description_ar="تيشيرت رجالي متنوع",  hs_code="6109.10", quantity=Decimal("500"), unit="pcs",  unit_price=Decimal("2.56"),  total_price=Decimal("1280.00"), cartons=5,  cbm=Decimal("0.40"), gross_weight=Decimal("62.50"), net_weight=Decimal("58.00")),
                dict(description="Slim Fit Jeans (Dark Blue)",     description_ar="جينز ضيق أزرق داكن",   hs_code="6203.42", quantity=Decimal("240"), unit="pcs",  unit_price=Decimal("7.60"),  total_price=Decimal("1824.00"), cartons=4,  cbm=Decimal("0.48"), gross_weight=Decimal("96.00"), net_weight=Decimal("88.00")),
                dict(description="Children's Tracksuit Set",       description_ar="طقم رياضي للأطفال",   hs_code="6211.43", quantity=Decimal("400"), unit="sets", unit_price=Decimal("5.25"),  total_price=Decimal("2100.00"), cartons=5,  cbm=Decimal("0.50"), gross_weight=Decimal("60.00"), net_weight=Decimal("55.00")),
                dict(description="Men's Sports Set",               description_ar="طقم رياضي رجالي",      hs_code="6211.33", quantity=Decimal("200"), unit="sets", unit_price=Decimal("9.39"),  total_price=Decimal("1878.00"), cartons=4,  cbm=Decimal("0.56"), gross_weight=Decimal("68.00"), net_weight=Decimal("62.00")),
                dict(description="Winter Jacket Unisex",           description_ar="جاكيت شتوي يونيسيكس", hs_code="6201.13", quantity=Decimal("120"), unit="pcs",  unit_price=Decimal("16.57"), total_price=Decimal("1988.40"), cartons=4,  cbm=Decimal("0.72"), gross_weight=Decimal("72.00"), net_weight=Decimal("64.00")),
             ]),
        dict(invoice_number="PO-2026-0002", invoice_type=InvoiceType.PRICE_OFFER, status=InvoiceStatus.DRAFT,    client_id=C[3].id, issue_date=today-timedelta(days=3),  currency="USD", origin="China", payment_terms="To be confirmed", shipping_term="FOB", port_of_loading="Nansha, China", port_of_discharge="Umm Qasr, Iraq", subtotal=Decimal("6200.00"), discount=Decimal("200.00"), total=Decimal("6000.00"), created_by_id=U[3].id, branch_id=B["IQ"].id,
             items=[
                dict(description="Men's Basic T-Shirt",        description_ar="تيشيرت رجالي أساسي",    hs_code="6109.10", quantity=Decimal("600"), unit="pcs", unit_price=Decimal("2.50"), total_price=Decimal("1500.00"), cartons=5, cbm=Decimal("0.40")),
                dict(description="Wide Leg Jeans Women",       description_ar="جينز واسع نسائي",        hs_code="6204.62", quantity=Decimal("150"), unit="pcs", unit_price=Decimal("8.00"), total_price=Decimal("1200.00"), cartons=3, cbm=Decimal("0.39")),
                dict(description="Leather Biker Jacket",       description_ar="جاكيت جلد موتوسيكل",     hs_code="6201.11", quantity=Decimal("30"),  unit="pcs", unit_price=Decimal("25.00"),total_price=Decimal("750.00"),  cartons=2, cbm=Decimal("0.40")),
             ]),
        dict(invoice_number="PI-2026-0002", invoice_type=InvoiceType.PI,           status=InvoiceStatus.SENT,     client_id=C[4].id, issue_date=today-timedelta(days=7),  due_date=today+timedelta(days=23), currency="USD", origin="China", payment_terms="40% advance, 60% against shipping docs", shipping_term="FOB", port_of_loading="Foshan/Nansha, China", port_of_discharge="Aqaba, Jordan", subtotal=Decimal("5150.00"), discount=Decimal("150.00"), total=Decimal("5000.00"), created_by_id=U[3].id, branch_id=B["JO"].id,
             items=[
                dict(description="Women's Polo T-Shirt",       description_ar="تيشيرت بولو نسائي",  hs_code="6106.10", quantity=Decimal("300"), unit="pcs",   unit_price=Decimal("3.04"),  total_price=Decimal("912.00"),  cartons=3, cbm=Decimal("0.27")),
                dict(description="Children's Tracksuit Set",   description_ar="طقم رياضي للأطفال",  hs_code="6211.43", quantity=Decimal("200"), unit="sets",  unit_price=Decimal("5.25"),  total_price=Decimal("1050.00"), cartons=3, cbm=Decimal("0.30")),
                dict(description='Travel Trolley Bag 24"',     description_ar="شنطة سفر 24 بوصة",   hs_code="4202.12", quantity=Decimal("80"),  unit="pcs",   unit_price=Decimal("12.15"), total_price=Decimal("972.00"),  cartons=4, cbm=Decimal("0.88")),
                dict(description="Men's Underwear Pack (6pcs)",description_ar="باكيت ملابس داخلية", hs_code="6107.11", quantity=Decimal("300"), unit="packs", unit_price=Decimal("3.87"),  total_price=Decimal("1161.00"), cartons=2, cbm=Decimal("0.14")),
             ]),
        dict(invoice_number="CI-2026-0002", invoice_type=InvoiceType.CI,           status=InvoiceStatus.APPROVED, client_id=C[5].id, issue_date=today-timedelta(days=15), currency="USD", origin="China", payment_terms="100% TT paid", shipping_term="CIF", port_of_loading="Yantian, China", port_of_discharge="Umm Qasr, Iraq", container_no="MSCU7654321", seal_no="SL-11223", bl_number="MSDU2026IQ002", vessel_name="MSC DIANA", voyage_number="0145W", subtotal=Decimal("7800.00"), discount=Decimal("300.00"), total=Decimal("7500.00"), created_by_id=U[1].id, branch_id=B["IQ"].id,
             items=[
                dict(description="Slim Fit Jeans (Various)",   description_ar="جينز ضيق متنوع",       hs_code="6203.42", quantity=Decimal("300"), unit="pcs",  unit_price=Decimal("7.60"),  total_price=Decimal("2280.00"), cartons=5, cbm=Decimal("0.60")),
                dict(description="Winter Jacket Unisex",       description_ar="جاكيت شتوي يونيسيكس", hs_code="6201.13", quantity=Decimal("90"),  unit="pcs",  unit_price=Decimal("16.57"), total_price=Decimal("1491.30"), cartons=3, cbm=Decimal("0.54")),
                dict(description="Men's Sports Set",           description_ar="طقم رياضي رجالي",      hs_code="6211.33", quantity=Decimal("180"), unit="sets", unit_price=Decimal("9.39"),  total_price=Decimal("1690.20"), cartons=4, cbm=Decimal("0.56")),
             ]),
        dict(invoice_number="PO-2026-0003", invoice_type=InvoiceType.PRICE_OFFER, status=InvoiceStatus.DRAFT,    client_id=C[6].id, issue_date=today, currency="USD", origin="China", payment_terms="TBD", shipping_term="FOB", subtotal=Decimal("4320.00"), discount=Decimal("0"), total=Decimal("4320.00"), created_by_id=U[3].id, branch_id=B["JO"].id,
             items=[
                dict(description="Men's Basic T-Shirt",  description_ar="تيشيرت رجالي أساسي",  hs_code="6109.10", quantity=Decimal("400"), unit="pcs", unit_price=Decimal("2.56"),  total_price=Decimal("1024.00"), cartons=4, cbm=Decimal("0.32")),
                dict(description="Leather Biker Jacket", description_ar="جاكيت جلد موتوسيكل",   hs_code="6201.11", quantity=Decimal("50"),  unit="pcs", unit_price=Decimal("25.55"), total_price=Decimal("1277.50"), cartons=3, cbm=Decimal("0.60")),
                dict(description="Wide Leg Jeans Women", description_ar="جينز واسع نسائي",      hs_code="6204.62", quantity=Decimal("100"), unit="pcs", unit_price=Decimal("8.57"),  total_price=Decimal("857.00"),  cartons=2, cbm=Decimal("0.26")),
             ]),
        dict(invoice_number="PI-2026-0003", invoice_type=InvoiceType.PI,           status=InvoiceStatus.APPROVED, client_id=C[7].id, issue_date=today-timedelta(days=12), due_date=today+timedelta(days=18), currency="USD", origin="China", payment_terms="50% advance, 50% before shipping", shipping_term="FOB", port_of_loading="Nansha, China", port_of_discharge="Aqaba, Jordan", subtotal=Decimal("6875.00"), discount=Decimal("375.00"), total=Decimal("6500.00"), created_by_id=U[1].id, branch_id=B["JO"].id,
             items=[
                dict(description="Slim Fit Jeans",       description_ar="جينز ضيق",            hs_code="6203.42", quantity=Decimal("180"), unit="pcs",  unit_price=Decimal("7.60"), total_price=Decimal("1368.00"), cartons=3, cbm=Decimal("0.36")),
                dict(description="Men's Sports Set",     description_ar="طقم رياضي رجالي",     hs_code="6211.33", quantity=Decimal("250"), unit="sets", unit_price=Decimal("9.39"), total_price=Decimal("2347.50"), cartons=5, cbm=Decimal("0.70")),
                dict(description="Women's Polo T-Shirt", description_ar="تيشيرت بولو نسائي",   hs_code="6106.10", quantity=Decimal("500"), unit="pcs",  unit_price=Decimal("3.04"), total_price=Decimal("1520.00"), cartons=5, cbm=Decimal("0.45")),
             ]),
        dict(invoice_number="CI-2026-0003", invoice_type=InvoiceType.CI,           status=InvoiceStatus.PAID,     client_id=C[8].id, issue_date=today-timedelta(days=60), currency="USD", origin="China", payment_terms="Paid in full", shipping_term="FOB", port_of_loading="Ningbo, China", port_of_discharge="Umm Qasr, Iraq", container_no="EVGU1234567", seal_no="SL-44556", bl_number="EVDU2025IQ003", vessel_name="EVER GIVEN", voyage_number="0088E", subtotal=Decimal("11250.00"), discount=Decimal("250.00"), total=Decimal("11000.00"), created_by_id=U[1].id, branch_id=B["IQ"].id,
             items=[
                dict(description="Men's Basic T-Shirt (Bulk)",   description_ar="تيشيرت رجالي بالجملة", hs_code="6109.10", quantity=Decimal("1200"),unit="pcs",  unit_price=Decimal("2.50"), total_price=Decimal("3000.00"), cartons=10, cbm=Decimal("0.80"), gross_weight=Decimal("150.00"), net_weight=Decimal("138.00")),
                dict(description="Children's Tracksuit Set",     description_ar="طقم رياضي للأطفال",    hs_code="6211.43", quantity=Decimal("600"), unit="sets", unit_price=Decimal("5.25"), total_price=Decimal("3150.00"), cartons=8,  cbm=Decimal("0.80"), gross_weight=Decimal("96.00"),  net_weight=Decimal("88.00")),
                dict(description='Travel Trolley Bag 24"',       description_ar="شنطة سفر 24 بوصة",     hs_code="4202.12", quantity=Decimal("100"), unit="pcs",  unit_price=Decimal("12.15"),total_price=Decimal("1215.00"), cartons=5,  cbm=Decimal("1.10"), gross_weight=Decimal("75.00"),  net_weight=Decimal("68.00")),
             ]),
        dict(invoice_number="PO-2026-0004", invoice_type=InvoiceType.PRICE_OFFER, status=InvoiceStatus.SENT,     client_id=C[9].id, issue_date=today-timedelta(days=5),  currency="USD", origin="China", payment_terms="30% deposit, balance before shipping", shipping_term="FOB", port_of_loading="Nansha, China", port_of_discharge="Aqaba, Jordan", subtotal=Decimal("3850.00"), discount=Decimal("0"), total=Decimal("3850.00"), created_by_id=U[3].id, branch_id=B["JO"].id,
             items=[
                dict(description="Men's Underwear Pack (6pcs)", description_ar="باكيت ملابس داخلية", hs_code="6107.11", quantity=Decimal("750"), unit="packs", unit_price=Decimal("3.87"), total_price=Decimal("2902.50"), cartons=5, cbm=Decimal("0.35")),
                dict(description="Women's Polo T-Shirt",        description_ar="تيشيرت بولو نسائي",  hs_code="6106.10", quantity=Decimal("300"), unit="pcs",   unit_price=Decimal("3.04"), total_price=Decimal("912.00"),  cartons=3, cbm=Decimal("0.27")),
             ]),
    ]
    added = 0
    for inv in invoices:
        if not skip(Invoice, invoice_number=inv["invoice_number"]):
            items = inv.pop("items")
            invoice = Invoice(**inv)
            db.add(invoice); db.flush()
            for i, item in enumerate(items):
                db.add(InvoiceItem(**item, invoice_id=invoice.id, sort_order=i))
            added += 1
    db.commit()
    print(f"  ✓ {added} invoices with items")

    # ── 14. BOOKINGS + CARGO LINES ────────────────────────────────────────────────
    print("Seeding bookings...")
    bookings = [
        dict(booking_number="BK-2026-0001", mode="FCL", status="in_transit",  shipping_agent_id=A[0].id, branch_id=B["JO"].id, container_size="40HQ", container_no="CMAU3456789", seal_no="SL-98765", bl_number="CMDU2026JO001", vessel_name="CMA CGM MARCO POLO", voyage_number="0234E", port_of_loading="Nansha, China",       port_of_discharge="Aqaba, Jordan",  etd=today_date-timedelta(days=10), eta=today_date+timedelta(days=15), incoterm="FOB", freight_cost=Decimal("2000"), max_cbm=Decimal("72"), markup_pct=Decimal("15"), currency="USD", is_direct_booking="0", carrier_name="CMA CGM",
             lines=[dict(client_id=C[0].id, description="T-Shirts and Jeans Assorted",  description_ar="تيشيرتات وجينز متنوعة",  cartons=25, cbm=Decimal("18.5"), gross_weight_kg=Decimal("450"), freight_share=Decimal("513.89"), sort_order=1),
                    dict(client_id=C[1].id, description="Women's Fashion Items",         description_ar="أزياء نسائية متنوعة",    cartons=30, cbm=Decimal("22.0"), gross_weight_kg=Decimal("520"), freight_share=Decimal("611.11"), sort_order=2),
                    dict(client_id=C[4].id, description="Sports and Activewear",         description_ar="ملابس رياضية",            cartons=20, cbm=Decimal("15.0"), gross_weight_kg=Decimal("320"), freight_share=Decimal("416.67"), sort_order=3)]),
        dict(booking_number="BK-2026-0002", mode="FCL", status="confirmed",   shipping_agent_id=A[1].id, branch_id=B["IQ"].id, container_size="40GP", port_of_loading="Yantian, China",      port_of_discharge="Umm Qasr, Iraq", etd=today_date+timedelta(days=8),  eta=today_date+timedelta(days=38), incoterm="FOB", freight_cost=Decimal("1800"), max_cbm=Decimal("57"), markup_pct=Decimal("18"), currency="USD", is_direct_booking="0", carrier_name="Evergreen",
             lines=[dict(client_id=C[2].id, description="Jackets and Outerwear",         description_ar="جاكيتات وملابس خارجية",  cartons=18, cbm=Decimal("14.0"), gross_weight_kg=Decimal("280"), freight_share=Decimal("442.11"), sort_order=1),
                    dict(client_id=C[5].id, description="Jeans Wholesale Mixed",          description_ar="جينز بالجملة مشكل",      cartons=22, cbm=Decimal("16.5"), gross_weight_kg=Decimal("396"), freight_share=Decimal("521.05"), sort_order=2),
                    dict(client_id=C[8].id, description="Children's Clothing Set",        description_ar="مجموعة ملابس أطفال",      cartons=15, cbm=Decimal("11.0"), gross_weight_kg=Decimal("198"), freight_share=Decimal("347.37"), sort_order=3)]),
        dict(booking_number="BK-2026-0003", mode="AIR", status="arrived",     shipping_agent_id=A[2].id, branch_id=B["JO"].id, awb_number="EK-176-12345678", flight_number="EK9721", port_of_loading="CAN - Guangzhou Baiyun", port_of_discharge="AMM - Queen Alia Amman", etd=today_date-timedelta(days=8), eta=today_date-timedelta(days=3), incoterm="EXW", freight_cost=Decimal("1680"), markup_pct=Decimal("20"), currency="USD", is_direct_booking="0", carrier_name="Emirates SkyCargo",
             lines=[dict(client_id=C[0].id, description="Urgent Fashion Samples",        description_ar="عينات أزياء عاجلة",      cartons=5, cbm=Decimal("0.5"), gross_weight_kg=Decimal("60"), chargeable_weight_kg=Decimal("60"), freight_share=Decimal("840.00"), sort_order=1),
                    dict(client_id=C[7].id, description="Leather Jackets Sample",         description_ar="عينات جاكيت جلد",        cartons=3, cbm=Decimal("0.3"), gross_weight_kg=Decimal("36"), chargeable_weight_kg=Decimal("36"), freight_share=Decimal("504.00"), sort_order=2)]),
        dict(booking_number="BK-2026-0004", mode="FCL", status="draft",                              branch_id=B["JO"].id, container_size="20GP", port_of_loading="Nansha, China",       port_of_discharge="Aqaba, Jordan",  etd=today_date+timedelta(days=20), eta=today_date+timedelta(days=45), incoterm="FOB", freight_cost=Decimal("1200"), max_cbm=Decimal("28"), markup_pct=Decimal("15"), currency="USD", is_direct_booking="1", carrier_name="MSC",
             lines=[dict(client_id=C[3].id, description="Bags and Accessories",           description_ar="حقائب وإكسسوارات",       cartons=12, cbm=Decimal("10.5"), gross_weight_kg=Decimal("180"), freight_share=Decimal("450.00"), sort_order=1),
                    dict(client_id=C[6].id, description="Underwear and Basics",            description_ar="ملابس داخلية وأساسيات",  cartons=10, cbm=Decimal("7.0"),  gross_weight_kg=Decimal("140"), freight_share=Decimal("300.00"), sort_order=2)]),
        dict(booking_number="BK-2026-0005", mode="LCL", status="delivered",   shipping_agent_id=A[3].id, branch_id=B["JO"].id, bl_number="PILNSH2026003", vessel_name="PIL MERCURY", voyage_number="0055E", port_of_loading="Nansha, China", port_of_discharge="Aqaba, Jordan", etd=today_date-timedelta(days=45), eta=today_date-timedelta(days=10), incoterm="FOB", freight_cost=Decimal("630"), markup_pct=Decimal("12"), currency="USD", is_direct_booking="0", carrier_name="PIL",
             lines=[dict(client_id=C[9].id, description="T-Shirts Small Shipment",        description_ar="شحنة صغيرة تيشيرتات",    cartons=8, cbm=Decimal("6.0"), gross_weight_kg=Decimal("96"),  freight_share=Decimal("270.00"), sort_order=1),
                    dict(client_id=C[4].id, description="Polo Shirts Sample Order",        description_ar="طلب عينة قمصان بولو",    cartons=6, cbm=Decimal("4.8"), gross_weight_kg=Decimal("72"),  freight_share=Decimal("216.00"), sort_order=2)]),
        dict(booking_number="BK-2026-0006", mode="FCL", status="confirmed",   shipping_agent_id=A[5].id, branch_id=B["IQ"].id, container_size="40HQ", port_of_loading="Nansha, China",       port_of_discharge="Umm Qasr, Iraq", etd=today_date+timedelta(days=5),  eta=today_date+timedelta(days=31), incoterm="CIF", freight_cost=Decimal("2100"), max_cbm=Decimal("72"), markup_pct=Decimal("16"), currency="USD", is_direct_booking="0", carrier_name="Yang Ming",
             lines=[dict(client_id=C[2].id, description="Mixed Clothing Wholesale",        description_ar="ملابس مشكلة بالجملة",    cartons=35, cbm=Decimal("28.0"), gross_weight_kg=Decimal("560"), freight_share=Decimal("816.67"), sort_order=1),
                    dict(client_id=C[5].id, description="Sports Collection",               description_ar="مجموعة رياضية",           cartons=28, cbm=Decimal("22.0"), gross_weight_kg=Decimal("440"), freight_share=Decimal("641.67"), sort_order=2)]),
        dict(booking_number="BK-2026-0007", mode="AIR", status="in_transit",  shipping_agent_id=A[4].id, branch_id=B["IQ"].id, awb_number="CS-748-87654321", flight_number="CZ6069", port_of_loading="PVG - Shanghai Pudong", port_of_discharge="BGW - Baghdad International", etd=today_date-timedelta(days=2), eta=today_date+timedelta(days=2), incoterm="EXW", freight_cost=Decimal("2240"), markup_pct=Decimal("22"), currency="USD", is_direct_booking="0", carrier_name="China Southern Cargo",
             lines=[dict(client_id=C[3].id, description="Priority Fashion Goods",          description_ar="بضائع أزياء ذات أولوية", cartons=8, cbm=Decimal("0.8"), gross_weight_kg=Decimal("70"), chargeable_weight_kg=Decimal("70"), freight_share=Decimal("2240.00"), sort_order=1)]),
        dict(booking_number="BK-2026-0008", mode="FCL", status="arrived",     shipping_agent_id=A[6].id, branch_id=B["JO"].id, container_size="20GP", container_no="HLCU9876543", seal_no="SL-77889", bl_number="HLDU2026JO002", vessel_name="HAPAG EXPRESS", voyage_number="0119W", port_of_loading="Ningbo, China", port_of_discharge="Aqaba, Jordan", etd=today_date-timedelta(days=32), eta=today_date-timedelta(days=2), incoterm="FOB", freight_cost=Decimal("1150"), max_cbm=Decimal("28"), markup_pct=Decimal("14"), currency="USD", is_direct_booking="0", carrier_name="Hapag-Lloyd",
             lines=[dict(client_id=C[7].id, description="Jeans Collection Winter",         description_ar="مجموعة جينز شتوية",      cartons=20, cbm=Decimal("12.0"), gross_weight_kg=Decimal("340"), freight_share=Decimal("493.75"), sort_order=1),
                    dict(client_id=C[9].id, description="Basic T-Shirts Bulk",              description_ar="تيشيرتات أساسية بالجملة",cartons=16, cbm=Decimal("9.5"),  gross_weight_kg=Decimal("228"), freight_share=Decimal("390.63"), sort_order=2)]),
        dict(booking_number="BK-2026-0009", mode="FCL", status="draft",       shipping_agent_id=A[8].id, branch_id=B["JO"].id, container_size="40HQ", port_of_loading="Yiwu/Ningbo, China",  port_of_discharge="Aqaba, Jordan",  etd=today_date+timedelta(days=30), eta=today_date+timedelta(days=57), incoterm="FOB", freight_cost=Decimal("1950"), max_cbm=Decimal("72"), markup_pct=Decimal("15"), currency="USD", is_direct_booking="0", carrier_name="Hapag-Lloyd",
             lines=[dict(client_id=C[0].id, description="Spring/Summer Collection 2026",   description_ar="مجموعة ربيع وصيف 2026",  cartons=40, cbm=Decimal("25.0"), gross_weight_kg=Decimal("600"), freight_share=Decimal("677.08"), sort_order=1),
                    dict(client_id=C[1].id, description="Women's Summer Line",              description_ar="خط الصيف النسائي",       cartons=35, cbm=Decimal("22.0"), gross_weight_kg=Decimal("495"), freight_share=Decimal("593.75"), sort_order=2),
                    dict(client_id=C[6].id, description="Kids Summer Clothing",             description_ar="ملابس أطفال صيفية",      cartons=20, cbm=Decimal("14.0"), gross_weight_kg=Decimal("280"), freight_share=Decimal("381.94"), sort_order=3)]),
        dict(booking_number="BK-2026-0010", mode="FCL", status="cancelled",   shipping_agent_id=A[9].id, branch_id=B["IQ"].id, container_size="20GP", port_of_loading="Dongguan, China",     port_of_discharge="Umm Qasr, Iraq", etd=today_date-timedelta(days=5),  eta=today_date+timedelta(days=19), incoterm="FOB", freight_cost=Decimal("1180"), max_cbm=Decimal("28"), markup_pct=Decimal("15"), currency="USD", is_direct_booking="0", carrier_name="COSCO", notes="Cancelled — client changed destination port",
             lines=[dict(client_id=C[8].id, description="Sportswear Order (Cancelled)",    description_ar="طلب ملابس رياضية (ملغى)",cartons=15, cbm=Decimal("9.0"),  gross_weight_kg=Decimal("198"), freight_share=Decimal("0"),      sort_order=1)]),
    ]
    added = 0
    for bk in bookings:
        if not skip(Booking, booking_number=bk["booking_number"]):
            lines = bk.pop("lines")
            booking = Booking(**bk)
            db.add(booking); db.flush()
            for line in lines:
                db.add(BookingCargoLine(**line, booking_id=booking.id))
            added += 1
    db.commit()
    print(f"  ✓ {added} bookings with cargo lines")

    print("\n✅ All done!")
    print("─" * 40)
    print("Admin login:    omar@logistics.jo  /  Test@1234")
    print("Customer login: hassan.sh@gmail.com  /  Customer@123")

except Exception as e:
    db.rollback()
    print(f"\n❌ Error: {e}")
    import traceback; traceback.print_exc()
finally:
    db.close()

"""
Import product photos from Telegram Desktop folders into the website.

Source: /home/odah/Downloads/Telegram Desktop/
Each subfolder (A70-1, A50-2, JEANS-1 ...) becomes one product listing.

Usage:
  cd ~/Downloads/logistics-system-jo
  .venv/bin/python scripts/import_local_photos.py

Requirements: pip install requests
"""

import os
import re
import sys
import time
import shutil
import getpass
from pathlib import Path

try:
    import requests
except ImportError:
    sys.exit("Install requests first:  pip install requests")

# ─── CONFIG ────────────────────────────────────────────────────
SOURCE_DIR  = Path("/home/odah/Downloads/Telegram Desktop")
API_BASE    = "http://localhost:8000/api/v1"
UPLOADS_DIR = Path("backend/uploads/products")       # where backend serves photos
LOG_FILE    = Path("scripts/import_results.json")
DELAY       = 0.15   # seconds between API calls
# ───────────────────────────────────────────────────────────────

IMAGE_EXT = {".jpg", ".jpeg", ".png", ".webp"}

# ── Product metadata per code prefix ───────────────────────────
# Source: the Telegram posts you shared, converted to formal language
PRODUCT_DB = {
    "A50": {
        "name_en":  "Pajama Set — Full Length Trousers",
        "name_ar":  "بيجامة مع بنطرون طول",
        "category": "Pajamas",
        "desc_en": (
            "High-quality wholesale pajama set with full-length trousers. "
            "Premium Chinese manufacturing. "
            "Available sizes: 30 · 31 · 32 · 33 · 34 · 36. "
            "Min. order: 1 bag — colors & quantities as per client specification."
        ),
        "desc_ar": (
            "بيجامة جملة عالية الجودة مع بنطرون طول. "
            "تصنيع صيني متميز. "
            "المقاسات المتوفرة: 30 · 31 · 32 · 33 · 34 · 36. "
            "الحد الأدنى للطلب: شوال واحد — الألوان والكميات حسب رغبة العميل."
        ),
        "pcs": 200,
        "cbm": "0.25",
    },
    "A61": {
        "name_en":  "Premium T-Shirt Collection — Polo & Round Neck",
        "name_ar":  "تيشيرت بريميوم — ياقة وحلقة",
        "category": "T-Shirts",
        "desc_en": (
            "Master-quality wholesale T-shirt collection — includes polo collar & round-neck styles. "
            "320 GSM fabric weight. "
            "Available sizes: L · XL · 2XL · 3XL. "
            "Min. order: 1 bag (256 pcs) — sizes & colors as per client specification."
        ),
        "desc_ar": (
            "مجموعة تيشيرت جملة ماستر كوالتي — تشمل موديل ياقة بولو وموديل حلقي. "
            "وزن القماش 320 غرام. "
            "المقاسات المتوفرة: L · XL · 2XL · 3XL. "
            "الحد الأدنى: شوال (256 قطعة) — المقاسات والألوان حسب طلب العميل."
        ),
        "pcs": 256,
        "cbm": "0.22",
    },
    "A70": {
        "name_en":  "Sportswear Mixed Set — Shorts, Track & T-Shirts",
        "name_ar":  "مجموعة رياضية متنوعة — برامودة وتراك وتيشيرت",
        "category": "Sportswear",
        "desc_en": (
            "Premium wholesale sportswear mixed set — includes sports shorts, track shorts & round-neck T-shirts. "
            "Master quality fabric. "
            "Available sizes: L · XL · 2XL · 3XL | Also 30–36 for select styles. "
            "Min. order: 1 bag — styles, sizes & colors fully customizable per order."
        ),
        "desc_ar": (
            "مجموعة ملابس رياضية جملة متنوعة عالية الجودة — تشمل برمودة رياضية وتراك برمودة وتيشيرت حلقي. "
            "قماش ماستر كوالتي. "
            "المقاسات: L · XL · 2XL · 3XL | وكذلك 30–36 لبعض الموديلات. "
            "الحد الأدنى: شوال واحد — الموديلات والمقاسات والألوان حسب طلب العميل بالكامل."
        ),
        "pcs": 256,
        "cbm": "0.20",
    },
    "A33": {
        "name_en":  "High Quality T-Shirt Set — Round Neck & Polo",
        "name_ar":  "تيشيرت كوالتي عالي — حلقة وياقة",
        "category": "T-Shirts",
        "desc_en": (
            "Master-quality wholesale T-shirt set — round neck & polo collar styles. "
            "320 GSM premium fabric. "
            "Available sizes: L · XL · 2XL · 3XL. "
            "Min. order: 1 bag (256 pcs) — sizes & colors as per client specification."
        ),
        "desc_ar": (
            "مجموعة تيشيرت ماستر كوالتي للجملة — موديل حلقي وموديل ياقة. "
            "قماش بريميوم 320 غرام. "
            "المقاسات المتوفرة: L · XL · 2XL · 3XL. "
            "الحد الأدنى: شوال (256 قطعة) — المقاسات والألوان حسب طلب العميل."
        ),
        "pcs": 256,
        "cbm": "0.22",
    },
    "A35": {
        "name_en":  "Premium Track Shorts — High Quality Fabric",
        "name_ar":  "تراك برمودة — قماش عالي الجودة",
        "category": "Sportswear",
        "desc_en": (
            "Wholesale track shorts — premium quality fabric. "
            "Available sizes: L · XL · 2XL · 3XL. "
            "Min. order: 1 bag (256 pcs) — sizes & colors as per client specification."
        ),
        "desc_ar": (
            "تراك برمودة جملة — قماش عالي الجودة. "
            "المقاسات المتوفرة: L · XL · 2XL · 3XL. "
            "الحد الأدنى: شوال (256 قطعة) — المقاسات والألوان حسب طلب العميل."
        ),
        "pcs": 256,
        "cbm": "0.20",
    },
    "A48": {
        "name_en":  "High Quality Jeans Trousers",
        "name_ar":  "بنطرون جينز كوالتي عالي",
        "category": "Jeans",
        "desc_en": (
            "Master-quality wholesale jeans trousers. "
            "Regular fit sizes: 29–36. Special fit sizes: 32–42. "
            "Multiple styles & washes available. "
            "Min. order: 1 bag (256 pcs) — styles, sizes & colors as per client specification."
        ),
        "desc_ar": (
            "بنطرون جينز جملة ماستر كوالتي. "
            "قياس عادي: 29–36. قياس خاص: 32–42. "
            "موديلات وغسلات متعددة. "
            "الحد الأدنى: شوال (256 قطعة) — الموديلات والمقاسات والألوان حسب طلب العميل."
        ),
        "pcs": 256,
        "cbm": "0.30",
    },
    "A105": {
        "name_en":  "Half-Sleeve Shirt — Premium Quality",
        "name_ar":  "قميص نص كم — كوالتي عالي",
        "category": "Shirts",
        "desc_en": (
            "Wholesale half-sleeve shirts — premium quality fabric. "
            "Multiple styles & patterns available. "
            "Available sizes: L · XL · 2XL · 3XL. "
            "Min. order: 1 bag (256 pcs) — styles, sizes & colors as per client specification."
        ),
        "desc_ar": (
            "قميص نص كم جملة — كوالتي عالي. "
            "موديلات وتصاميم متعددة. "
            "المقاسات المتوفرة: L · XL · 2XL · 3XL. "
            "الحد الأدنى: شوال (256 قطعة) — الموديلات والمقاسات والألوان حسب طلب العميل."
        ),
        "pcs": 256,
        "cbm": "0.22",
    },
    "W": {
        "name_en":  "Premium Fabric & Jeans Trousers — Iraqi Fit",
        "name_ar":  "بنطرون قماش وجينز — قالب عراقي",
        "category": "Trousers",
        "desc_en": (
            "High-quality wholesale fabric trousers & jeans — authentic Iraqi fit. "
            "First-grade material. "
            "Available sizes: 30 · 31 · 32 · 33 · 34 · 36 · 38. "
            "Min. order: 1 bag — colors & quantities as per client specification."
        ),
        "desc_ar": (
            "بنطرون قماش وجينز جملة عالي الجودة — قالب عراقي صحيح. "
            "مادة درجة أولى. "
            "المقاسات المتوفرة: 30 · 31 · 32 · 33 · 34 · 36 · 38. "
            "الحد الأدنى للطلب: شوال واحد — الألوان والكميات حسب رغبة العميل."
        ),
        "pcs": 200,
        "cbm": "0.28",
    },
    "FAPRIC-TROUSERS": {
        "name_en":  "Premium Fabric Trousers",
        "name_ar":  "بنطرون قماش كوالتي عالي",
        "category": "Trousers",
        "desc_en": (
            "High-quality wholesale fabric trousers. "
            "Premium material, multiple colors & styles. "
            "Min. order: 1 bag — sizes & colors as per client specification."
        ),
        "desc_ar": (
            "بنطرون قماش جملة كوالتي عالي. "
            "خامة ممتازة — ألوان وموديلات متعددة. "
            "الحد الأدنى للطلب: شوال واحد — المقاسات والألوان حسب طلب العميل."
        ),
        "pcs": 200,
        "cbm": "0.28",
    },
    "JEANS-1": {
        "name_en":  "Wholesale Jeans Collection",
        "name_ar":  "مجموعة جينز للجملة",
        "category": "Jeans",
        "desc_en": (
            "Premium wholesale jeans collection. "
            "Multiple styles, washes & fits available. "
            "Min. order: 1 bag — sizes, styles & colors as per client specification."
        ),
        "desc_ar": (
            "مجموعة جينز جملة بريميوم. "
            "موديلات وغسلات وقوالب متعددة. "
            "الحد الأدنى للطلب: شوال واحد — المقاسات والموديلات والألوان حسب طلب العميل."
        ),
        "pcs": 256,
        "cbm": "0.30",
    },
    "PEJAMA-1": {
        "name_en":  "Wholesale Pajama Collection",
        "name_ar":  "مجموعة بيجامات للجملة",
        "category": "Pajamas",
        "desc_en": (
            "High-quality wholesale pajama collection. "
            "Premium fabric, multiple colors & prints. "
            "Available sizes: 30–38. "
            "Min. order: 1 bag (200 pcs) — colors & quantities as per client specification."
        ),
        "desc_ar": (
            "مجموعة بيجامات جملة عالية الجودة. "
            "قماش ممتاز — ألوان وتصاميم متعددة. "
            "المقاسات المتوفرة: 30–38. "
            "الحد الأدنى للطلب: شوال (200 قطعة) — الألوان والكميات حسب طلب العميل."
        ),
        "pcs": 200,
        "cbm": "0.25",
    },
}

# Folders to skip entirely
SKIP_FOLDERS = {
    "vpnnew", ".DS_Store", "__pycache__",
}


def get_product_data(folder_name: str) -> dict:
    """Match folder name to product data. A70-1 → A70, A50-3 → A50, etc."""
    # Exact match first
    if folder_name in PRODUCT_DB:
        return PRODUCT_DB[folder_name]

    # Strip trailing -N variant suffix: A70-1 → A70
    m = re.match(r'^([A-Z0-9]+(?:-[A-Z]+)*)-\d+$', folder_name)
    if m:
        base = m.group(1)
        if base in PRODUCT_DB:
            return PRODUCT_DB[base]

    # First alpha-only prefix: FAPRIC-TROUSERS stays as-is (already in DB)
    return None


def get_images(folder: Path) -> list[Path]:
    imgs = sorted([
        f for f in folder.iterdir()
        if f.is_file() and f.suffix.lower() in IMAGE_EXT
    ])
    return imgs


def login(email: str, password: str) -> str:
    r = requests.post(f"{API_BASE}/auth/login",
                      data={"username": email, "password": password}, timeout=10)
    if r.status_code != 200:
        sys.exit(f"❌  Login failed: {r.text}")
    print("✅  Logged in")
    return r.json()["access_token"]


def get_suppliers(headers: dict) -> list:
    r = requests.get(f"{API_BASE}/suppliers", headers=headers, timeout=10)
    return r.json().get("results", []) if r.ok else []


def product_exists(headers: dict, code: str) -> int | None:
    r = requests.get(f"{API_BASE}/products/admin",
                     params={"search": code, "page_size": 5},
                     headers=headers, timeout=10)
    if r.ok:
        for p in r.json().get("results", []):
            if p["code"] == code:
                return p["id"]
    return None


def create_product(headers: dict, payload: dict) -> dict | None:
    r = requests.post(f"{API_BASE}/products/admin", json=payload,
                      headers=headers, timeout=10)
    if r.status_code == 201:
        return r.json()
    if r.status_code == 400:
        return "exists"
    print(f"\n  ⚠️  Create failed ({r.status_code}): {r.text[:120]}")
    return None


def upload_photo(headers: dict, product_id: int, img_path: Path, is_main: bool) -> bool:
    # Copy to uploads dir first so backend can serve it
    UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    with open(img_path, "rb") as f:
        r = requests.post(
            f"{API_BASE}/products/admin/{product_id}/photos",
            headers=headers,
            files={"file": (img_path.name, f, "image/jpeg")},
            data={"is_main": "true" if is_main else "false"},
            timeout=30,
        )
    return r.ok


def run():
    print("=" * 65)
    print("  Import Product Photos from Telegram Desktop")
    print("=" * 65)

    # Discover product folders
    folders = sorted([
        d for d in SOURCE_DIR.iterdir()
        if d.is_dir() and d.name not in SKIP_FOLDERS
    ])
    # Only folders that have images
    folders = [f for f in folders if get_images(f)]

    print(f"\n📂  Source: {SOURCE_DIR}")
    print(f"📦  {len(folders)} product folders found:\n")
    for f in folders:
        imgs = get_images(f)
        data = get_product_data(f.name)
        matched = f"✅ {data['name_en']}" if data else "⚠️  no metadata — will use folder name"
        print(f"    {f.name:<22} {len(imgs):>3} photos   {matched}")

    print()
    confirm = input("Continue? [Y/n]: ").strip().lower()
    if confirm == 'n':
        sys.exit("Cancelled.")

    # Login
    print("\n── Admin Login ───────────────────────────────────────────")
    email    = input("Admin email: ").strip()
    password = getpass.getpass("Password: ")
    token    = login(email, password)
    headers  = {"Authorization": f"Bearer {token}"}

    # Suppliers
    suppliers = get_suppliers(headers)
    if suppliers:
        print("\n── Available Suppliers ───────────────────────────────────")
        for s in suppliers:
            print(f"  [{s['id']:>3}] {s['code']} — {s['name']}")

    supplier_id_str = input("\nDefault supplier ID (blank = none): ").strip()
    default_supplier_id = int(supplier_id_str) if supplier_id_str.isdigit() else None

    default_price = input("Default price CNY (blank = 0.00): ").strip() or "0.00"

    print(f"\n── Importing {len(folders)} products ─────────────────────────────\n")

    created = []
    skipped = []
    failed  = []
    t_start = time.time()

    for i, folder in enumerate(folders, 1):
        folder_name = folder.name
        images      = get_images(folder)
        data        = get_product_data(folder_name)

        if data:
            name_en  = data["name_en"]
            name_ar  = data["name_ar"]
            desc_en  = data["desc_en"]
            desc_ar  = data["desc_ar"]
            category = data["category"]
            pcs      = data["pcs"]
            cbm      = data["cbm"]
        else:
            # Fallback for unknown folders
            name_en  = folder_name.replace("-", " ").title()
            name_ar  = folder_name
            desc_en  = f"Wholesale {name_en}. Min. order: 1 bag — sizes & colors as per client specification."
            desc_ar  = f"جملة {name_ar}. الحد الأدنى: شوال واحد — المقاسات والألوان حسب طلب العميل."
            category = "Clothing"
            pcs      = 250
            cbm      = "0.25"

        print(f"  [{i:>2}/{len(folders)}] {folder_name:<22}", end="  ", flush=True)

        # Check if already exists
        existing_id = product_exists(headers, folder_name)
        if existing_id:
            print(f"⏭  already in DB (id={existing_id}) — uploading any new photos")
            product_id = existing_id
            skipped.append(folder_name)
        else:
            payload = {
                "code":             folder_name,
                "name":             name_en,
                "name_ar":          name_ar,
                "description":      desc_en,
                "description_ar":   desc_ar,
                "category":         category,
                "supplier_id":      default_supplier_id,
                "price_cny":        default_price,
                "pcs_per_carton":   pcs,
                "cbm_per_carton":   cbm,
                "min_order_cartons": 1,
                "is_active":        True,
                "is_featured":      False,
            }
            result = create_product(headers, payload)

            if result == "exists":
                existing_id = product_exists(headers, folder_name)
                product_id = existing_id
                skipped.append(folder_name)
                print(f"⏭  exists", end="  ")
            elif result is None:
                failed.append(folder_name)
                print("❌  create failed")
                continue
            else:
                product_id = result["id"]
                created.append({"code": folder_name, "id": product_id})
                print(f"✅  created (id={product_id})", end="  ")

        # Upload photos
        ok_count = 0
        for j, img in enumerate(images):
            ok = upload_photo(headers, product_id, img, is_main=(j == 0))
            if ok:
                ok_count += 1
            print(f"\r  [{i:>2}/{len(folders)}] {folder_name:<22}  📸 {ok_count}/{len(images)} photos uploaded    ",
                  end="", flush=True)
            time.sleep(DELAY)

        elapsed = time.time() - t_start
        rate    = i / elapsed
        eta     = (len(folders) - i) / rate
        eta_str = f"{int(eta//60)}m {int(eta%60)}s" if eta >= 60 else f"{int(eta)}s"
        print(f"\r  [{i:>2}/{len(folders)}] {folder_name:<22}  ✅ {ok_count}/{len(images)} photos  ETA {eta_str}   ")

    elapsed = time.time() - t_start
    print(f"\n{'='*65}")
    print(f"  ✅  Imported : {len(created)} new products")
    print(f"  ⏭   Skipped  : {len(skipped)} already existed")
    print(f"  ❌  Failed   : {len(failed)}")
    print(f"  ⏱   Time     : {int(elapsed//60)}m {int(elapsed%60)}s")
    print(f"{'='*65}")
    print(f"\n👉  Open http://localhost:5173/shop to see your products!")
    print(f"    Admin panel: http://localhost:5173/products\n")


if __name__ == "__main__":
    run()

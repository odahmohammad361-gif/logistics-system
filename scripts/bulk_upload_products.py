"""
Bulk-create products and upload photos via the backend API.
Reads the manifest produced by download_tg_photos.py.

Usage:
  python scripts/bulk_upload_products.py

Requirements:
  pip install requests

The script will:
  1. Log in to admin API and get a token
  2. Ask you for default values (price, supplier, pcs/carton, CBM)
  3. Create a product for each entry in the manifest
  4. Upload the photo
  5. Skip entries that already exist (by product code)
"""

import json
import os
import sys
import getpass
from pathlib import Path

try:
    import requests
except ImportError:
    print("Install requests first:  pip install requests")
    sys.exit(1)

# ─── CONFIG ────────────────────────────────────────────────────
API_BASE    = "http://localhost:8000/api/v1"
PHOTOS_DIR  = Path("scripts/tg_photos")
MANIFEST    = PHOTOS_DIR / "manifest.json"
RESULTS_LOG = PHOTOS_DIR / "upload_results.json"
# ───────────────────────────────────────────────────────────────


def login(email: str, password: str) -> str:
    r = requests.post(f"{API_BASE}/auth/login",
                      data={"username": email, "password": password})
    if r.status_code != 200:
        print(f"❌  Login failed: {r.text}")
        sys.exit(1)
    token = r.json()["access_token"]
    print("✅  Logged in")
    return token


def get_suppliers(headers: dict) -> list:
    r = requests.get(f"{API_BASE}/suppliers", headers=headers)
    return r.json().get("results", []) if r.ok else []


def create_product(headers: dict, payload: dict) -> dict | None:
    r = requests.post(f"{API_BASE}/products/admin", json=payload, headers=headers)
    if r.status_code == 201:
        return r.json()
    if r.status_code == 400 and "already exists" in r.text:
        return "exists"
    print(f"  ⚠️  Create failed ({r.status_code}): {r.text[:120]}")
    return None


def upload_photo(headers: dict, product_id: int, photo_path: Path) -> bool:
    with open(photo_path, "rb") as f:
        r = requests.post(
            f"{API_BASE}/products/admin/{product_id}/photos",
            headers=headers,
            files={"file": (photo_path.name, f, "image/jpeg")},
            data={"is_main": "true"},
        )
    return r.ok


def run():
    print("=" * 55)
    print("  Bulk Product Upload")
    print("=" * 55)

    if not MANIFEST.exists():
        print(f"\n❌  Manifest not found: {MANIFEST}")
        print("    Run download_tg_photos.py first.\n")
        sys.exit(1)

    with open(MANIFEST, encoding="utf-8") as f:
        manifest: dict = json.load(f)

    print(f"\n📋  {len(manifest)} photos in manifest")

    # Login
    print("\n── Admin Login ───────────────────────────────────────")
    email    = input("Admin email: ").strip()
    password = getpass.getpass("Password: ")
    token    = login(email, password)
    headers  = {"Authorization": f"Bearer {token}"}

    # Show suppliers
    suppliers = get_suppliers(headers)
    if suppliers:
        print("\n── Available Suppliers ───────────────────────────────")
        for s in suppliers:
            print(f"  [{s['id']:>3}] {s['code']} — {s['name']}")
    else:
        print("\n  (No suppliers yet — products will have no supplier)")

    supplier_id_str = input("\nDefault supplier ID (leave blank for none): ").strip()
    default_supplier_id = int(supplier_id_str) if supplier_id_str.isdigit() else None

    # Defaults
    print("\n── Default Values for all products ───────────────────")
    print("  (Press Enter to accept defaults shown in brackets)\n")

    def ask(prompt, default):
        val = input(f"  {prompt} [{default}]: ").strip()
        return val if val else str(default)

    default_price        = ask("Price CNY (¥)",        "0.00")
    default_pcs          = ask("Pcs per carton",        "250")
    default_cbm          = ask("CBM per carton",        "0.20")
    default_min_order    = ask("Min order (cartons)",   "1")
    default_category     = ask("Category (e.g. Jeans)", "")

    print("\n── Starting Upload ───────────────────────────────────\n")

    results = {"created": [], "skipped": [], "failed": []}

    for filename, info in manifest.items():
        photo_path = PHOTOS_DIR / filename
        if not photo_path.exists():
            print(f"  ⚠️  File not found: {filename} — skipping")
            results["failed"].append({"file": filename, "reason": "file not found"})
            continue

        code = info["code"]
        name = info["name"] or code
        print(f"  → {code}  {name[:40]}", end="  ")

        payload = {
            "code":             code,
            "name":             name,
            "supplier_id":      default_supplier_id,
            "price_cny":        default_price,
            "pcs_per_carton":   int(default_pcs),
            "cbm_per_carton":   default_cbm,
            "min_order_cartons": int(default_min_order),
            "category":         default_category or None,
            "is_active":        True,
            "is_featured":      False,
        }

        result = create_product(headers, payload)

        if result == "exists":
            print("⏭  already exists — skipping")
            results["skipped"].append(code)
            continue

        if result is None:
            print("❌  failed")
            results["failed"].append({"file": filename, "code": code, "reason": "create error"})
            continue

        product_id = result["id"]

        # Upload photo
        ok = upload_photo(headers, product_id, photo_path)
        if ok:
            print(f"✅  created (id={product_id}) + photo uploaded")
        else:
            print(f"✅  created (id={product_id}) ⚠️  photo failed")

        results["created"].append({"id": product_id, "code": code, "file": filename})

    # Summary
    print("\n" + "=" * 55)
    print(f"  ✅  Created : {len(results['created'])}")
    print(f"  ⏭   Skipped : {len(results['skipped'])}")
    print(f"  ❌  Failed  : {len(results['failed'])}")
    print("=" * 55)

    with open(RESULTS_LOG, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    print(f"\n📄  Full log saved → {RESULTS_LOG}")
    print(f"\n👉  Open http://localhost:5173/shop to see your products!\n")


if __name__ == "__main__":
    run()

"""
Bulk-create products and upload photos via the backend API.
Reads the manifest produced by download_tg_photos.py.
Safe to stop and restart — skips already-created products.

Usage:
  python scripts/bulk_upload_products.py

Requirements:
  pip install requests
"""

import json
import os
import sys
import time
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

DELAY = 0.1   # seconds between API calls


def login(email: str, password: str) -> str:
    r = requests.post(f"{API_BASE}/auth/login",
                      data={"username": email, "password": password}, timeout=10)
    if r.status_code != 200:
        print(f"❌  Login failed: {r.text}")
        sys.exit(1)
    print("✅  Logged in")
    return r.json()["access_token"]


def get_suppliers(headers: dict) -> list:
    r = requests.get(f"{API_BASE}/suppliers", headers=headers, timeout=10)
    return r.json().get("results", []) if r.ok else []


def product_exists(headers: dict, code: str) -> int | None:
    """Returns product id if exists, else None."""
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
    if r.status_code == 400 and "already exists" in r.text:
        return "exists"
    return None


def upload_photo(headers: dict, product_id: int, photo_path: Path) -> bool:
    with open(photo_path, "rb") as f:
        r = requests.post(
            f"{API_BASE}/products/admin/{product_id}/photos",
            headers=headers,
            files={"file": (photo_path.name, f, "image/jpeg")},
            data={"is_main": "true"},
            timeout=30,
        )
    return r.ok


def load_results() -> dict:
    if RESULTS_LOG.exists():
        with open(RESULTS_LOG, encoding="utf-8") as f:
            return json.load(f)
    return {"created": [], "skipped": [], "failed": [], "done_codes": []}


def save_results(results: dict):
    with open(RESULTS_LOG, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)


def format_eta(seconds: float) -> str:
    if seconds < 60:   return f"{int(seconds)}s"
    if seconds < 3600: return f"{int(seconds//60)}m {int(seconds%60)}s"
    return f"{int(seconds//3600)}h {int((seconds%3600)//60)}m"


def run():
    print("=" * 60)
    print("  Bulk Product Upload")
    print("=" * 60)

    if not MANIFEST.exists():
        print(f"\n❌  No manifest found at {MANIFEST}")
        print("    Run download_tg_photos.py first.\n")
        sys.exit(1)

    with open(MANIFEST, encoding="utf-8") as f:
        manifest: dict = json.load(f)

    total = len(manifest)
    print(f"\n📋  {total:,} photos in manifest")

    # Load previous run results (resume support)
    results = load_results()
    done_codes = set(results.get("done_codes", []))
    if done_codes:
        print(f"⏩  Resuming — {len(done_codes):,} already uploaded, {total - len(done_codes):,} remaining")

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
        print("\n  (No suppliers yet)")

    supplier_id_str = input("\nDefault supplier ID (blank = none): ").strip()
    default_supplier_id = int(supplier_id_str) if supplier_id_str.isdigit() else None

    # Defaults
    print("\n── Default values (Enter to keep shown default) ──────")

    def ask(prompt, default):
        val = input(f"  {prompt} [{default}]: ").strip()
        return val if val else str(default)

    default_price     = ask("Price CNY (¥)",      "0.00")
    default_pcs       = ask("Pcs per carton",      "250")
    default_cbm       = ask("CBM per carton",      "0.20")
    default_min       = ask("Min order (cartons)", "1")
    default_category  = ask("Category",            "")

    print(f"\n── Uploading {total:,} products ──────────────────────────\n")

    count    = 0
    t_start  = time.time()

    for filename, info in manifest.items():
        code = info["code"]

        # Resume: skip already done
        if code in done_codes:
            continue

        photo_path = PHOTOS_DIR / filename
        count += 1

        # ETA
        elapsed   = time.time() - t_start
        rate      = count / elapsed if elapsed > 0 else 0.001
        remaining = (total - len(done_codes) - count) / rate
        progress  = len(done_codes) + count
        print(
            f"\r  [{progress:>6}/{total}] "
            f"{rate:.1f}/s  ETA {format_eta(remaining)}  "
            f"{code[:20]:<20}",
            end="", flush=True
        )

        if not photo_path.exists():
            results["failed"].append({"file": filename, "reason": "file not found"})
            done_codes.add(code)
            continue

        # Check if already exists in DB
        existing_id = product_exists(headers, code)
        if existing_id:
            results["skipped"].append(code)
            done_codes.add(code)
            results["done_codes"] = list(done_codes)
            if count % 100 == 0:
                save_results(results)
            time.sleep(DELAY)
            continue

        # Create product
        payload = {
            "code":             code,
            "name":             info["name"] or code,
            "supplier_id":      default_supplier_id,
            "price_cny":        default_price,
            "pcs_per_carton":   int(default_pcs),
            "cbm_per_carton":   default_cbm,
            "min_order_cartons": int(default_min),
            "category":         default_category or None,
            "is_active":        True,
            "is_featured":      False,
        }

        result = create_product(headers, payload)

        if result == "exists" or result is None:
            results["skipped"].append(code)
            done_codes.add(code)
        elif result:
            pid = result["id"]
            ok  = upload_photo(headers, pid, photo_path)
            results["created"].append({"id": pid, "code": code})
            done_codes.add(code)

        results["done_codes"] = list(done_codes)

        # Save progress every 100 items
        if count % 100 == 0:
            save_results(results)

        time.sleep(DELAY)

    # Final save
    save_results(results)

    print(f"\n\n{'='*60}")
    print(f"  ✅  Created : {len(results['created']):,}")
    print(f"  ⏭   Skipped : {len(results['skipped']):,}")
    print(f"  ❌  Failed  : {len(results['failed']):,}")
    elapsed = time.time() - t_start
    print(f"  ⏱   Time    : {format_eta(elapsed)}")
    print(f"{'='*60}")
    print(f"\n📄  Log saved → {RESULTS_LOG}")
    print(f"👉  Open http://localhost:5173/shop\n")


if __name__ == "__main__":
    run()

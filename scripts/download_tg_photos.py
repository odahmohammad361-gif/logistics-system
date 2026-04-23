"""
Download all photos from a Telegram group/channel.
Supports resume — safe to stop and restart at any time.

Setup:
  pip install telethon

Get API credentials (2 min, free):
  1. Open my.telegram.org on your PHONE browser
  2. Log in → "API development tools" → Create App
  3. Copy api_id and api_hash below

Usage:
  python scripts/download_tg_photos.py
"""

import os
import re
import asyncio
import json
import time
from pathlib import Path
from telethon import TelegramClient
from telethon.tl.types import MessageMediaPhoto

# ─── FILL THESE IN ─────────────────────────────────────────────
API_ID   = 0           # number from my.telegram.org
API_HASH = ""          # string from my.telegram.org
PHONE    = ""          # your number e.g. "+962791234567"
GROUP    = ""          # e.g. "husamsalah3" or "@husamsalah3" or numeric ID
# ───────────────────────────────────────────────────────────────

OUTPUT_DIR   = Path("scripts/tg_photos")
MANIFEST     = OUTPUT_DIR / "manifest.json"
PROGRESS     = OUTPUT_DIR / ".progress"   # last downloaded message ID (resume)
SESSION      = "scripts/tg_session"

# Delay between downloads (seconds) — keeps Telegram happy
DELAY        = 0.3   # ~200 photos/min, safe for large groups

CODE_RE = re.compile(r'^([A-Za-z]{2,5}-?\d{2,4})\s*(.*)', re.UNICODE)


def parse_caption(caption: str, msg_id: int) -> dict:
    caption = (caption or "").strip()
    if not caption:
        return {"code": f"IMG-{msg_id:05d}", "name": f"Product {msg_id}", "caption": ""}
    m = CODE_RE.match(caption)
    if m:
        code = m.group(1).upper()
        name = m.group(2).strip() or code
        return {"code": code, "name": name, "caption": caption}
    safe = re.sub(r'[^A-Za-z0-9]', '', caption[:8]).upper() or "P"
    return {"code": f"{safe}-{msg_id:05d}", "name": caption, "caption": caption}


def load_manifest() -> dict:
    if MANIFEST.exists():
        with open(MANIFEST, encoding="utf-8") as f:
            return json.load(f)
    return {}


def save_manifest(manifest: dict):
    with open(MANIFEST, "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)


def load_progress() -> int:
    """Returns last successfully downloaded message ID (for resume)."""
    if PROGRESS.exists():
        try:
            return int(PROGRESS.read_text().strip())
        except Exception:
            pass
    return 0


def save_progress(msg_id: int):
    PROGRESS.write_text(str(msg_id))


def format_eta(seconds: float) -> str:
    if seconds < 60:
        return f"{int(seconds)}s"
    if seconds < 3600:
        return f"{int(seconds//60)}m {int(seconds%60)}s"
    return f"{int(seconds//3600)}h {int((seconds%3600)//60)}m"


async def download():
    if API_ID == 0 or not API_HASH or not PHONE or not GROUP:
        print("\n❌  Fill in API_ID, API_HASH, PHONE, and GROUP at the top of this script.")
        print("    Get credentials at my.telegram.org (use your PHONE browser if PC gives error)\n")
        return

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    manifest = load_manifest()
    resume_from = load_progress()

    if resume_from:
        print(f"⏩  Resuming from message ID {resume_from} ({len(manifest)} already downloaded)")

    async with TelegramClient(SESSION, API_ID, API_HASH) as client:
        await client.start(phone=PHONE)
        me = await client.get_me()
        print(f"✅  Connected as {me.first_name} ({me.phone})")

        entity = await client.get_entity(GROUP)
        group_title = getattr(entity, 'title', GROUP)
        print(f"📂  Group: {group_title}")

        # Count total photos first (for ETA)
        print("🔢  Counting photos... ", end="", flush=True)
        total = 0
        async for _ in client.iter_messages(entity, filter=MessageMediaPhoto):
            total += 1
        print(f"{total:,} photos found")

        if resume_from:
            print(f"    {len(manifest):,} already done, ~{total - len(manifest):,} remaining\n")
        else:
            print(f"    Estimated time: ~{format_eta(total * DELAY)}\n")

        count_session = 0
        count_total   = len(manifest)
        t_start       = time.time()
        existing_files = {f for f in os.listdir(OUTPUT_DIR) if f.endswith('.jpg')}

        async for msg in client.iter_messages(entity, filter=MessageMediaPhoto):
            # Resume: skip messages we already processed
            if resume_from and msg.id <= resume_from:
                continue

            info = parse_caption(msg.message, msg.id)
            safe = re.sub(r'[^\w\-]', '_', info["code"])
            filename = f"{safe}.jpg"

            # Deduplicate filename
            base = OUTPUT_DIR / filename
            i = 2
            while base.name in existing_files and base.name not in manifest:
                base = OUTPUT_DIR / f"{safe}_{i}.jpg"
                i += 1
            filename = base.name

            # Download
            try:
                await client.download_media(msg, file=str(OUTPUT_DIR / filename))
            except Exception as e:
                print(f"\n  ⚠️  Failed msg {msg.id}: {e}")
                await asyncio.sleep(2)
                continue

            manifest[filename] = info
            existing_files.add(filename)
            save_progress(msg.id)
            count_session += 1
            count_total   += 1

            # Save manifest every 50 photos
            if count_session % 50 == 0:
                save_manifest(manifest)

            # Progress line
            elapsed  = time.time() - t_start
            rate     = count_session / elapsed if elapsed > 0 else 0
            remaining = (total - count_total) / rate if rate > 0 else 0
            caption_short = (info['caption'][:30] + '…') if len(info['caption']) > 30 else info['caption']
            print(
                f"\r  [{count_total:>5}/{total}] "
                f"{count_session/elapsed:.1f}/s  "
                f"ETA {format_eta(remaining)}  "
                f"← {caption_short or '(no caption)'}          ",
                end="", flush=True
            )

            await asyncio.sleep(DELAY)

        # Final save
        save_manifest(manifest)

        print(f"\n\n✅  Done! {count_total:,} photos in {OUTPUT_DIR}/")
        print(f"📋  Manifest: {MANIFEST}")

        if PROGRESS.exists():
            PROGRESS.unlink()  # clean up resume file

        print(f"\n👉  Next step:")
        print(f"    python scripts/bulk_upload_products.py\n")


if __name__ == "__main__":
    asyncio.run(download())

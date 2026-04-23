"""
Download all photos from a Telegram group/channel.

Setup:
  pip install telethon

Get your API credentials (free, 2 min):
  1. Go to https://my.telegram.org
  2. Log in with your phone number
  3. Click "API development tools"
  4. Create an app → copy api_id and api_hash

Usage:
  python scripts/download_tg_photos.py

On first run it will ask for your phone + verification code (like logging in).
A session file is saved so you only authenticate once.

Caption format expected (flexible):
  "SHA-023 بنطلون جينز"  →  code=SHA-023, name=بنطلون جينز
  "WI-001"               →  code=WI-001,  name=WI-001
  "جاكيت شتوي"           →  code=auto,    name=جاكيت شتوي
  (no caption)           →  code=auto,    name=photo_{msg_id}
"""

import os
import re
import asyncio
import json
from pathlib import Path
from telethon import TelegramClient
from telethon.tl.types import MessageMediaPhoto

# ─── CONFIG — fill these in ────────────────────────────────────
API_ID   = 0           # your api_id from my.telegram.org
API_HASH = ""          # your api_hash from my.telegram.org
PHONE    = ""          # your phone number e.g. "+962791234567"
GROUP    = ""          # group username e.g. "@mygroup" or group name or numeric ID
# ───────────────────────────────────────────────────────────────

OUTPUT_DIR  = Path("scripts/tg_photos")
MANIFEST    = OUTPUT_DIR / "manifest.json"   # maps filename → {code, name, caption}
SESSION     = "scripts/tg_session"

# Matches codes like: SHA-023, WI-001, ABC-123, SH023, etc.
CODE_RE = re.compile(r'^([A-Za-z]{2,5}-?\d{2,4})\s*(.*)', re.UNICODE)


def parse_caption(caption: str, msg_id: int) -> dict:
    caption = (caption or "").strip()
    if not caption:
        return {"code": f"IMG-{msg_id:04d}", "name": f"Product {msg_id}", "caption": ""}

    m = CODE_RE.match(caption)
    if m:
        code = m.group(1).upper()
        name = m.group(2).strip() or code
        return {"code": code, "name": name, "caption": caption}

    # No code found — use caption as name, generate code from it
    safe_code = re.sub(r'[^A-Za-z0-9]', '', caption[:8]).upper() or f"P{msg_id:04d}"
    return {"code": f"{safe_code}-{msg_id:04d}", "name": caption, "caption": caption}


async def download():
    if API_ID == 0 or not API_HASH or not PHONE or not GROUP:
        print("\n❌  Please fill in API_ID, API_HASH, PHONE, and GROUP at the top of this script.")
        print("    Get credentials at: https://my.telegram.org\n")
        return

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    manifest = {}

    async with TelegramClient(SESSION, API_ID, API_HASH) as client:
        await client.start(phone=PHONE)
        print(f"✅  Connected as {(await client.get_me()).first_name}")

        entity = await client.get_entity(GROUP)
        print(f"📂  Group: {getattr(entity, 'title', GROUP)}")
        print("⬇   Downloading photos...\n")

        count = 0
        async for msg in client.iter_messages(entity, filter=MessageMediaPhoto):
            info = parse_caption(msg.message, msg.id)
            ext  = ".jpg"
            safe_name = re.sub(r'[^\w\-]', '_', info["code"])
            filename  = f"{safe_name}{ext}"

            # Avoid overwriting — append _2, _3, etc.
            base = OUTPUT_DIR / filename
            i = 2
            while base.exists():
                base = OUTPUT_DIR / f"{safe_name}_{i}{ext}"
                i += 1
            filename = base.name

            path = await client.download_media(msg, file=str(OUTPUT_DIR / filename))
            manifest[filename] = info
            count += 1
            print(f"  [{count:>4}] {filename}  ← {info['caption'][:50] or '(no caption)'}")

        # Save manifest
        with open(MANIFEST, "w", encoding="utf-8") as f:
            json.dump(manifest, f, ensure_ascii=False, indent=2)

        print(f"\n✅  Downloaded {count} photos → {OUTPUT_DIR}/")
        print(f"📋  Manifest saved → {MANIFEST}")
        print(f"\n👉  Next step: python scripts/bulk_upload_products.py")


if __name__ == "__main__":
    asyncio.run(download())

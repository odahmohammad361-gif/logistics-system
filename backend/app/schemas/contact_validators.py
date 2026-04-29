from __future__ import annotations

import re
from typing import Any


EMAIL_PATTERN = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
PHONE_PREFIXES = ("+962", "+86", "+964")


def clean_optional_phone(value: Any) -> str | None:
    if value is None:
        return None
    raw = str(value).strip()
    if not raw:
        return None
    compact = re.sub(r"[^\d+]", "", raw)
    if compact.startswith("00"):
        compact = f"+{compact[2:]}"
    digits = re.sub(r"\D", "", compact)
    matched_prefix = next((prefix for prefix in PHONE_PREFIXES if compact.startswith(prefix) or digits.startswith(prefix[1:])), None)
    if matched_prefix:
        local = digits[len(matched_prefix) - 1:] if digits.startswith(matched_prefix[1:]) else digits
        if not 8 <= len(local) <= 12:
            raise ValueError("Phone number must be 8 to 12 digits after the country code")
        return f"{matched_prefix}{local}"
    if 8 <= len(digits) <= 12:
        return digits
    raise ValueError("Phone number must be 8 to 12 digits")


def clean_required_phone(value: Any) -> str:
    cleaned = clean_optional_phone(value)
    if not cleaned:
        raise ValueError("Phone number is required")
    return cleaned


def clean_optional_email(value: Any) -> str | None:
    if value is None:
        return None
    email = str(value).strip().lower()
    if not email:
        return None
    if not EMAIL_PATTERN.match(email):
        raise ValueError("Invalid email format")
    return email

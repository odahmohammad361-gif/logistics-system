from __future__ import annotations

import re
from typing import Any


EMAIL_PATTERN = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
PHONE_PREFIXES = ("+962", "+86", "+964")
ARABIC_RE = re.compile(r"[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]")
LATIN_RE = re.compile(r"[A-Za-z]")


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


def clean_english_name(value: Any) -> str | None:
    if value is None:
        return None
    name = str(value).strip()
    if not name:
        return None
    if ARABIC_RE.search(name):
        raise ValueError("English name cannot contain Arabic letters")
    return name


def clean_required_english_name(value: Any) -> str:
    name = clean_english_name(value)
    if not name:
        raise ValueError("English name is required")
    return name


def clean_arabic_name(value: Any) -> str | None:
    if value is None:
        return None
    name = str(value).strip()
    if not name:
        return None
    if LATIN_RE.search(name):
        raise ValueError("Arabic name cannot contain English letters")
    return name

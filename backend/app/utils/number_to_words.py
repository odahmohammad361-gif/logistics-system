"""Convert numeric amounts to English and Arabic words for invoices."""

ONES_EN = [
    "", "ONE", "TWO", "THREE", "FOUR", "FIVE", "SIX", "SEVEN", "EIGHT", "NINE",
    "TEN", "ELEVEN", "TWELVE", "THIRTEEN", "FOURTEEN", "FIFTEEN",
    "SIXTEEN", "SEVENTEEN", "EIGHTEEN", "NINETEEN",
]
TENS_EN = ["", "", "TWENTY", "THIRTY", "FORTY", "FIFTY", "SIXTY", "SEVENTY", "EIGHTY", "NINETY"]

ONES_AR = [
    "", "واحد", "اثنان", "ثلاثة", "أربعة", "خمسة", "ستة", "سبعة", "ثمانية", "تسعة",
    "عشرة", "أحد عشر", "اثنا عشر", "ثلاثة عشر", "أربعة عشر", "خمسة عشر",
    "ستة عشر", "سبعة عشر", "ثمانية عشر", "تسعة عشر",
]
TENS_AR = ["", "", "عشرون", "ثلاثون", "أربعون", "خمسون", "ستون", "سبعون", "ثمانون", "تسعون"]


def _chunk_en(n: int) -> str:
    if n == 0:
        return ""
    elif n < 20:
        return ONES_EN[n]
    elif n < 100:
        return TENS_EN[n // 10] + (" " + ONES_EN[n % 10] if n % 10 else "")
    else:
        rest = _chunk_en(n % 100)
        return ONES_EN[n // 100] + " HUNDRED" + (" " + rest if rest else "")


def _chunk_ar(n: int) -> str:
    if n == 0:
        return ""
    elif n < 20:
        return ONES_AR[n]
    elif n < 100:
        ones = ONES_AR[n % 10]
        tens = TENS_AR[n // 10]
        return (ones + " و" + tens) if ones else tens
    else:
        hundreds = {1: "مائة", 2: "مئتان", 3: "ثلاثمائة", 4: "أربعمائة",
                    5: "خمسمائة", 6: "ستمائة", 7: "سبعمائة", 8: "ثمانمائة", 9: "تسعمائة"}
        rest = _chunk_ar(n % 100)
        return hundreds[n // 100] + (" و" + rest if rest else "")


def amount_to_words_en(amount: float) -> str:
    """Convert float USD amount to English words."""
    dollars = int(amount)
    cents = round((amount - dollars) * 100)

    parts = []
    billions = dollars // 1_000_000_000
    millions = (dollars % 1_000_000_000) // 1_000_000
    thousands = (dollars % 1_000_000) // 1_000
    remainder = dollars % 1_000

    if billions:
        parts.append(_chunk_en(billions) + " BILLION")
    if millions:
        parts.append(_chunk_en(millions) + " MILLION")
    if thousands:
        parts.append(_chunk_en(thousands) + " THOUSAND")
    if remainder:
        parts.append(_chunk_en(remainder))

    result = " ".join(parts) if parts else "ZERO"
    result += " US DOLLARS"
    if cents:
        result += f" AND {_chunk_en(cents)} CENTS"
    return result + " ONLY."


def amount_to_words_ar(amount: float) -> str:
    """Convert float USD amount to Arabic words."""
    dollars = int(amount)
    cents = round((amount - dollars) * 100)

    parts = []
    billions = dollars // 1_000_000_000
    millions = (dollars % 1_000_000_000) // 1_000_000
    thousands = (dollars % 1_000_000) // 1_000
    remainder = dollars % 1_000

    if billions:
        parts.append(_chunk_ar(billions) + " مليار")
    if millions:
        parts.append(_chunk_ar(millions) + " مليون")
    if thousands:
        parts.append(_chunk_ar(thousands) + " ألف")
    if remainder:
        parts.append(_chunk_ar(remainder))

    result = " و".join(parts) if parts else "صفر"
    result += " دولار أمريكي"
    if cents:
        result += f" و{_chunk_ar(cents)} سنت"
    return result + " فقط لا غير."

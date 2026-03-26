import httpx
from app.config import settings

# Currencies relevant to China → Jordan / Iraq trade
TARGET_CURRENCIES = ["JOD", "IQD", "CNY", "EUR", "SAR", "AED"]

# Fallback rates used when API key is missing or API is unreachable
FALLBACK_RATES: dict[str, float] = {
    "JOD": 0.709,      # Jordanian Dinar (USD peg ~0.709)
    "IQD": 1308.0,     # Iraqi Dinar
    "CNY": 7.23,       # Chinese Yuan
    "EUR": 0.92,       # Euro
    "SAR": 3.75,       # Saudi Riyal
    "AED": 3.67,       # UAE Dirham
}


def fetch_rates() -> dict[str, float]:
    """
    Fetch latest USD→* exchange rates from exchangerate-api.com.
    Returns FALLBACK_RATES silently on any failure or missing API key.
    """
    if not settings.CURRENCY_API_KEY:
        return FALLBACK_RATES.copy()

    url = f"https://v6.exchangerate-api.com/v6/{settings.CURRENCY_API_KEY}/latest/USD"
    try:
        with httpx.Client(timeout=8.0) as client:
            resp = client.get(url)
            resp.raise_for_status()
            data = resp.json()
        if data.get("result") != "success":
            return FALLBACK_RATES.copy()
        all_rates: dict = data.get("conversion_rates", {})
        return {c: float(all_rates[c]) for c in TARGET_CURRENCIES if c in all_rates}
    except Exception:
        return FALLBACK_RATES.copy()

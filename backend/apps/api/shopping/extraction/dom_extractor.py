"""DOM tabanli veri cikarimi — Turkce fiyat/stok/teslimat metinlerini ayristirir."""

from __future__ import annotations

import re

from apps.api.shopping.schemas import Offer

_PRICE_RE = re.compile(r"\d[\d.,]*")

_OUT_OF_STOCK_TOKENS = ("tükendi", "stokta yok", "satışta değil", "gelince haber ver")
_LOW_STOCK_RE = re.compile(r"son\s+(\d+)", re.IGNORECASE)

_DELIVERY_KEYWORDS: tuple[tuple[str, int], ...] = (
    ("aynı gün", 0),
    ("bugün kargoda", 1),
    ("yarın kargoda", 1),
    ("hızlı teslimat", 2),
)
_DELIVERY_DAYS_RE = re.compile(r"(\d+)\s*(?:iş\s*)?gün(?:de|\s*içinde)?", re.IGNORECASE)


def parse_price_tr(text: str | None) -> float | None:
    """Turkce fiyat bicimlerini sayiya cevirir: '40.999 TL' -> 40999.0, '1.299,90' -> 1299.9."""
    if not text:
        return None
    match = _PRICE_RE.search(text)
    if not match:
        return None
    raw = match.group()
    if "," in raw and "." in raw:
        raw = raw.replace(".", "").replace(",", ".")
    elif "," in raw:
        head, _, tail = raw.rpartition(",")
        raw = f"{head}.{tail}" if len(tail) == 2 else raw.replace(",", "")
    elif raw.count(".") > 1 or (raw.count(".") == 1 and len(raw.split(".")[1]) == 3):
        raw = raw.replace(".", "")
    try:
        return float(raw)
    except ValueError:
        return None


def parse_stock_tr(text: str | None) -> tuple[bool, int | None]:
    """Kart metninden (stokta_mi, stok_adedi) cikarir; bilinmiyorsa (True, None)."""
    t = (text or "").casefold()
    if any(token in t for token in _OUT_OF_STOCK_TOKENS):
        return False, 0
    low = _LOW_STOCK_RE.search(t)
    if low:
        return True, int(low.group(1))
    return True, None


def parse_delivery_tr(text: str | None) -> int | None:
    """Kart metninden tahmini teslimat gununu cikarir; bulunamazsa None."""
    t = (text or "").casefold()
    for token, days in _DELIVERY_KEYWORDS:
        if token in t:
            return days
    match = _DELIVERY_DAYS_RE.search(t)
    return int(match.group(1)) if match else None


def build_offer(
    *,
    site: str,
    title: str | None,
    price_text: str | None,
    url: str = "",
    context_text: str = "",
) -> Offer | None:
    """Ham kart alanlarindan Offer uretir; baslik/fiyat yoksa None (satir atlanir)."""
    price = parse_price_tr(price_text)
    if not title or not title.strip() or price is None:
        return None
    in_stock, stock_level = parse_stock_tr(context_text)
    return Offer(
        site=site,
        title=title.strip(),
        url=url,
        price=price,
        in_stock=in_stock,
        stock_level=stock_level,
        delivery_days=parse_delivery_tr(context_text),
        extracted_via="dom",
    )

